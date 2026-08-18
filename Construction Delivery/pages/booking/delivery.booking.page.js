const { checkHighlighted, clickHighlighted, fillHighlighted } = require('../../utils/highlight');
const { waitForBookingConfirmation } = require('../../utils/booking-confirmation');
const { uploadRequiredFiles } = require('../../utils/upload-fixture');
const { clickBookingType } = require('../../utils/booking-types');
const { projectManagementPreferredValue } = require('../../utils/project-management-setup-state');

// Constants
const COMPANY_NAME = 'Construction Company';
const BOOKING_COMPLETE_WAIT_MS = 10000;
const REQUIRED_TEXT_VALUE = 'Test Value';
const TIME_SLOT_PATTERN = /\b\d{1,2}:\d{2}\s*(?:AM|PM)?\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM)?\b/i;
const AUTOMATION_GENERATED_OPTION_PATTERN = /\b(?:Gate|Crane)\s+\d+\b/i;

class DeliveryBookingPage {
  constructor(page, options = {}) {
    this.page = page;
    this.bookingTypeIndex = options.bookingTypeIndex ?? 0;
    this.bookingTypeLabel = options.bookingTypeLabel || 'Delivery';
    this.bookingEmail = options.bookingEmail || process.env.BOOKING_NOTIFICATION_EMAIL || '';
    this.useMyDetails = options.useMyDetails ?? !this.bookingEmail;

    // Main booking elements
    this.newBookingButton = page.getByRole('button', { name: /New Booking/i });
    this.bookingTypeImage = page.locator('.book-type-img img').nth(this.bookingTypeIndex);
    this.nextButton = page.getByRole('button', { name: /Next/i });

    // Scheduling dropdowns
    this.accessPointSelect = page.locator('#mui-component-select-accesspoint');
    this.vehicleTypeSelect = page.locator('#mui-component-select-vehicleType');
    this.fuelTypeSelect = page.locator('#mui-component-select-fuelType');
    this.resourceSelect = page.locator('.page-content').getByRole('combobox').nth(3);

    // Booking details
    this.useMyDetailsCheckbox = page.getByLabel(/Use My Details/i);
    this.useMyDetailsFallbackCheckbox = page.locator('#active');
    this.companyInput = page.locator('input[name="Free Text 22"]');
    this.selectField = page.locator('[id="mui-component-select-Select Field 24"]');

    // Submit button
    this.submitBookingButton = page.getByRole('button', { name: /Submit Booking|Submit/i });
  }

  // Main booking flow
  async createDeliveryBooking() {
    await this.startNewBooking();
    await this.selectBookingType();
    await this.completeSchedulingInformation();
    await this.selectFirstAvailableBookingDate();
    await this.selectFirstAvailableBookingTime();
    await this.completeBookingDetails();
    await this.completeMandatoryAdditionalDetails();
    return this.submitBooking();
  }

  // Step 1: Start new booking
  async startNewBooking() {
    if (await this.page.getByText(/What kind of booking do you/i).first().isVisible().catch(() => false)) {
      return;
    }

    await clickHighlighted(this.newBookingButton, 'New Booking');
    await this.page.getByText(/What kind of booking do you/i).first().waitFor({ state: 'visible' });
  }

  // Step 2: Select delivery booking type
  async selectBookingType() {
    await this.page.getByText(/What kind of booking do you/i).first().waitFor({ state: 'visible' });
    await clickBookingType(this.page, this.bookingTypeLabel, this.bookingTypeIndex);
    await this.clickNext(`${this.bookingTypeLabel} type next`);
  }

  async selectDeliveryBookingType() {
    await this.selectBookingType();
  }

  // Step 3: Complete scheduling information
  async completeSchedulingInformation() {
    const schedulingDropdowns = [
      { locator: this.accessPointSelect, label: 'Access point' },
      { locator: this.vehicleTypeSelect, label: 'Vehicle type' },
      { locator: this.fuelTypeSelect, label: 'Fuel type' },
      { locator: this.resourceSelect, label: 'Resource', optional: true, closeAfterSelect: true }
    ];

    for (const dropdown of schedulingDropdowns) {
      await this.selectFirstDropdownValue(dropdown.locator, dropdown.label, dropdown);
    }

    await this.clickNext('Scheduling next');
  }

  // Step 4: Select booking date
  async selectFirstAvailableBookingDate() {
    await this.waitForStep('Booking Date');
    await this.waitForBookingDateContent();
    await this.openCalendar();
    
    try {
      await this.clickFirstAvailableCalendarDate();
    } catch (error) {
      console.log(`⚠️ Calendar date selection failed: ${error.message}`);

      if (await this.tryAdvanceFromBookingDate('Booking date next without calendar selection')) {
        console.log('Booking Date advanced without selecting a calendar day.');
        return;
      }
      
      // Try keyboard date entry as fallback
      console.log('🔄 Attempting keyboard date entry fallback...');
      const dateEntry = await this.tryKeyboardDateEntry();
      if (dateEntry) {
        console.log('✅ Keyboard date entry succeeded');
        if (await this.tryAdvanceFromBookingDate('Booking date next after keyboard date entry')) {
          return;
        }
      }
      
      // Last resort: wait a bit and check if Next is now enabled
      await this.page.waitForTimeout(2000);
      if (await this.tryAdvanceFromBookingDate('Booking date next after wait')) {
        return;
      }
      
      throw error;
    }
    
    await this.clickNext('Booking date next');
  }

  async waitForBookingDateContent() {
    await this.waitForBusyState();

    await this.page.waitForFunction(() => {
      const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim();
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none';
      };

      const label = Array.from(document.querySelectorAll('label, h1, h2, h3, h4, p, span, div'))
        .find((element) => isVisible(element) && /^Choose date$/i.test(normalize(element.innerText || element.textContent)));

      if (!label) return false;

      const labelBox = label.getBoundingClientRect();
      return Array.from(document.querySelectorAll('input, button, [role="button"], svg, [class*="date" i], [class*="calendar" i], div'))
        .some((element) => {
          if (!isVisible(element)) return false;
          const box = element.getBoundingClientRect();
          const centerX = box.left + box.width / 2;
          const centerY = box.top + box.height / 2;
          return centerX >= labelBox.left - 30 &&
            centerX <= labelBox.left + 420 &&
            centerY >= labelBox.bottom &&
            centerY <= labelBox.bottom + 120;
        });
    }, null, { timeout: 60000 });
  }

  async tryAdvanceFromBookingDate(label) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        if (await this.clickBookingFormNextButton(label)) {
          await this.waitForBusyState();
          if (await this.isStepVisible('Booking Time')) {
            return true;
          }
        }
      } catch (error) {
        console.log(`Booking Date direct Next attempt ${attempt} failed: ${error.message}`);
      }

      await this.page.waitForTimeout(500);
    }

    try {
      await this.clickNext(label);
      await this.waitForBusyState();
      return this.isStepVisible('Booking Time');
    } catch (error) {
      console.log(`Booking Date fallback Next failed: ${error.message}`);
      return false;
    }
  }

  async tryKeyboardDateEntry() {
    try {
      // Find any visible text input that might be the date field
      const dateInputs = await this.page.locator('input[type="text"], input[placeholder*="date"], input[aria-label*="date"]').all();
      
      for (const input of dateInputs) {
        if (await this.isVisible(input)) {
          // Try typing a date in common formats
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const dateStr = tomorrow.toLocaleDateString('en-GB');
          
          await input.focus();
          await input.clear();
          await input.type(dateStr, { delay: 50 });
          await this.page.keyboard.press('Enter');
          await this.page.waitForTimeout(1000);
          
          // Check if Next button is now enabled
          if (await this.isNextEnabled()) {
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      console.log(`⚠️ Keyboard date entry failed: ${error.message}`);
      return false;
    }
  }

  // Step 5: Select booking time
  async selectFirstAvailableBookingTime() {
    await this.waitForStep('Booking Time');
    
    console.log('⏳ Waiting for time slots to load...');
    await this.page.waitForTimeout(5000);

    await this.loadTimeSlots();
    await this.waitForAvailableTimeSlots();
    
    // Try multiple approaches to find and click a time slot
    const timeSlotSelected = await this.trySelectTimeSlot();
    
    if (!timeSlotSelected) {
      // Try the original method as fallback
      console.log('🔄 Trying original time slot selection method...');
      try {
        await this.clickFirstAvailableTimeSlot('Fallback time slot');
        console.log('✅ Fallback method succeeded');
      } catch (error) {
        throw new Error('No available time slot could be selected');
      }
    }

    // Wait a bit after selection to ensure the form updates
    await this.page.waitForTimeout(1000);

    await this.clickNext('Booking time next');
    await this.waitForBusyState();
    await this.waitForStep('Booking Details');
  }

  // Step 6: Complete booking details
  async completeBookingDetails() {
    await this.waitForStep('Booking Details');
    await this.waitForBookingDetailsContent();
    
    if (this.useMyDetails) {
      try {
        await this.checkUseMyDetails();
      } catch (error) {
        console.log('⚠️ Use My Details step failed, continuing without it:', error.message);
      }
    }

    await this.fillConfiguredBookingEmail();
    await this.fillVisibleBookingDetailsFields();
    await this.selectVisibleRequiredDropdowns();
    
    await this.clickNext('Booking details next');
  }

  async waitForBookingDetailsContent() {
    await this.waitForBusyState();

    await this.page.waitForFunction(() => {
      const visible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none';
      };

      const hasVisibleNext = Array.from(document.querySelectorAll('button, [role="button"]'))
        .some((element) => /next/i.test(element.innerText || element.textContent || '') && visible(element));
      const hasVisibleInput = Array.from(document.querySelectorAll('input, textarea, [role="checkbox"], [role="combobox"]'))
        .some(visible);

      return hasVisibleNext && hasVisibleInput;
    }, null, { timeout: 60000 });
  }

  // Step 7: Complete additional details
  async completeMandatoryAdditionalDetails() {
    await this.waitForStep('Additional Details');

    if (await this.isVisible(this.companyInput)) {
      await fillHighlighted(this.companyInput, COMPANY_NAME, 'Company');
    }

    if (await this.isVisible(this.selectField)) {
      await this.selectFirstDropdownValue(this.selectField, 'Mandatory select field');
    }

    await this.fillVisibleRequiredTextFields();
    await this.selectVisibleRequiredDropdowns();
    await uploadRequiredFiles(this.page, `${this.bookingTypeLabel} booking required upload`);
  }

  // Step 8: Submit booking
  async submitBooking() {
    await clickHighlighted(this.submitBookingButton.last(), 'Submit Booking');
    await this.page.waitForTimeout(BOOKING_COMPLETE_WAIT_MS);
    return waitForBookingConfirmation(this.page, `${this.bookingTypeLabel} booking`);
  }

  async submitEmptyForm() {
    const submitButton = this.submitBookingButton.first();

    if (await this.isVisible(submitButton)) {
      await clickHighlighted(submitButton, 'Submit empty form');
      return;
    }

    await this.selectBookingType();
    await this.clickNext('Trigger required validation');
  }

  async waitForRequiredValidation() {
    const validationMessage = this.page
      .getByText(/required|mandatory|please select|please enter/i)
      .first();

    if (await this.isVisible(validationMessage)) {
      return;
    }

    await this.page
      .locator('[aria-invalid="true"], .Mui-error, [class*="error"]')
      .first()
      .waitFor({ state: 'visible', timeout: 10000 });
  }

  // Helper methods
  async trySelectTimeSlot() {
    console.log('🔍 Trying to find available time slots...');

    try {
      console.log('🔍 Method 0: Selecting visible time-slot button...');
      const clicked = await this.page.evaluate(() => {
        const timePattern = new RegExp(String.raw`\b\d{1,2}:\d{2}\s*(?:AM|PM)?\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM)?\b`, 'i');
        const elements = Array.from(document.querySelectorAll('button, [role="button"], div, span'));
        const slots = elements
          .map((element) => {
            const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);

            return { element, text, rect, style };
          })
          .filter(({ element, text, rect, style }) => {
            const ownTextLooksLikeSingleSlot = timePattern.test(text) && text.length <= 40;

            return (
              ownTextLooksLikeSingleSlot &&
              rect.width > 50 &&
              rect.height > 10 &&
              rect.top >= 0 &&
              rect.left >= 0 &&
              style.visibility !== 'hidden' &&
              style.display !== 'none' &&
              style.pointerEvents !== 'none' &&
              !element.closest('[disabled]') &&
              element.getAttribute('aria-disabled') !== 'true'
            );
          })
          .sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);

        const slot = slots[0]?.element;

        if (!slot) {
          return null;
        }

        slot.scrollIntoView({ block: 'center', inline: 'center' });
        slot.click();
        return (slot.innerText || slot.textContent || '').replace(/\s+/g, ' ').trim();
      });

      if (clicked) {
        console.log(`✅ Clicked visible time slot: ${clicked}`);
        await this.page.waitForTimeout(1000);

        if (await this.isNextEnabled()) {
          console.log('✅ Time slot selection verified - Next button enabled!');
          return true;
        }
      }
    } catch (error) {
      console.log('❌ Method 0 failed:', error.message);
    }
    
    // Method 1: Look for clickable divs with cursor pointer containing time patterns
    try {
      console.log('🔍 Method 1: Looking for clickable time slot divs...');
      
      // Find all elements with time patterns
      const timeElements = await this.page.locator('button, [role="button"], div, span').filter({
        hasText: TIME_SLOT_PATTERN
      }).all();
      
      console.log(`🔍 Found ${timeElements.length} time-like elements`);
      
      for (const element of timeElements) {
        const text = await element.textContent().catch(() => '');
        
        // Check if element has cursor pointer style
        const isClickable = await element.evaluate(el => {
          const style = window.getComputedStyle(el);
          return style.cursor === 'pointer';
        }).catch(() => false);
        
        if (isClickable && await this.isVisible(element) && text.trim().length <= 40) {
          console.log('✅ Found clickable time slot:', text.trim());
          await clickHighlighted(element, 'Time slot');
          await this.page.waitForTimeout(2000);
          
          // Verify selection by checking if Next button is enabled
          const nextBtn = this.nextButton.last();
          const isDisabled = await nextBtn.getAttribute('disabled');
          if (isDisabled === null) {
            console.log('✅ Time slot selection verified - Next button enabled!');
            return true;
          } else {
            console.log('⚠️ Time slot clicked but Next button still disabled');
          }
        }
      }
    } catch (error) {
      console.log('❌ Method 1 failed:', error.message);
    }

    // Method 2: Try clicking on any element containing specific time patterns
    try {
      console.log('🔍 Method 2: Trying specific time patterns...');
      
      const timePatterns = [
        /2:30\s*PM\s*-\s*4:30\s*PM/i,
        /3:00\s*PM\s*-\s*5:00\s*PM/i,
        /3:30\s*PM\s*-\s*5:30\s*PM/i,
        /4:00\s*PM\s*-\s*6:00\s*PM/i,
        /12:30\s*PM\s*-\s*2:30\s*PM/i,
        /1:00\s*PM\s*-\s*3:00\s*PM/i,
        /1:30\s*PM\s*-\s*3:30\s*PM/i,
        /2:00\s*PM\s*-\s*4:00\s*PM/i,
        /6:00\s*PM\s*-\s*8:00\s*PM/i,
        /6:30\s*PM\s*-\s*8:30\s*PM/i
      ];
      
      for (const pattern of timePatterns) {
        try {
          const timeSlot = this.page.getByText(pattern).first();
          if (await this.isVisible(timeSlot)) {
            const text = await timeSlot.textContent();
            console.log('✅ Trying time pattern:', text.trim());
            await clickHighlighted(timeSlot, 'Time pattern');
            await this.page.waitForTimeout(2000);
            
            // Check if selection worked
            const nextBtn = this.nextButton.last();
            const isDisabled = await nextBtn.getAttribute('disabled');
            if (isDisabled === null) {
              console.log('✅ Time pattern selection successful!');
              return true;
            }
          }
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      console.log('❌ Method 2 failed:', error.message);
    }

    console.log('❌ All methods failed to select a time slot');
    return false;
  }

  async clickFirstAvailableTimeSlot(label) {
    const clicked = await this.page.evaluate(
      ({ interactionLabel }) => {
        const elements = Array.from(document.querySelectorAll('body *'));
        const slot = elements.find((element) => {
          const text = (element.innerText || element.textContent || element.getAttribute('aria-label') || '').trim();
          const style = window.getComputedStyle(element);
          const looksLikeTimeSlot =
            /\b\d{1,2}:\d{2}\s*(?:AM|PM)?\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM)?\b/i.test(text);

          return looksLikeTimeSlot && style.cursor === 'pointer' && style.pointerEvents !== 'none';
        });

        if (!slot) {
          return false;
        }

        slot.scrollIntoView({ block: 'center', inline: 'center' });
        slot.dataset.highlightLabel = interactionLabel;
        slot.style.outline = '4px solid #ff2d55';
        slot.style.boxShadow = '0 0 0 8px rgba(255, 45, 85, 0.28)';
        slot.click();
        return true;
      },
      { interactionLabel: label }
    );

    if (!clicked) {
      throw new Error('No available time slot element was found.');
    }

    await this.page.waitForTimeout(700);
  }

  async checkUseMyDetails() {
    const checkbox = await this.visibleUseMyDetailsCheckbox();

    if (checkbox) {
      await checkHighlighted(checkbox, 'Use My Details');
      return;
    }

    // Try to wait for fallback checkbox with shorter timeout
    try {
      await this.useMyDetailsFallbackCheckbox.waitFor({ state: 'attached', timeout: 5000 });
      
      if (!(await this.useMyDetailsFallbackCheckbox.isChecked())) {
        await this.useMyDetailsFallbackCheckbox.check({ force: true });
      }
    } catch (error) {
      console.log('⚠️ Use My Details checkbox not found on this page, skipping...');
      // Don't throw error, just continue - this step might be optional
      return;
    }
  }

  async visibleUseMyDetailsCheckbox() {
    const checkboxOptions = [
      this.useMyDetailsCheckbox,
      this.page.getByRole('checkbox', { name: /Use My Details/i }),
      this.useMyDetailsFallbackCheckbox
    ];

    for (const checkbox of checkboxOptions) {
      if (await this.isVisible(checkbox)) {
        return checkbox;
      }
    }

    return null;
  }

  async openCalendar() {
    await this.page.keyboard.press('Escape').catch(() => null);
    await this.page.waitForTimeout(200);

    const chooseDateButton = this.page.getByRole('button', { name: /Choose date/i }).first();

    if (await this.isVisible(chooseDateButton)) {
      await clickHighlighted(chooseDateButton, 'Open calendar');
      await this.page.waitForTimeout(500);
      if (await this.hasSelectableCalendarDates()) {
        return;
      }
    }

    if (await this.clickCalendarTriggerByDom('Open calendar field')) {
      return;
    }

    const dateFieldPoint = await this.page.evaluate(() => {
      const normalize = (value = '') => value.replace(/\s+/g, ' ').trim();
      const isVisible = (element) => {
        const box = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return box.width > 0 &&
          box.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.pointerEvents !== 'none';
      };
      const labels = Array.from(document.querySelectorAll('h1, h2, h3, h4, p, span, div'))
        .filter((element) => isVisible(element) && /^Choose date$/i.test(normalize(element.textContent)));

      for (const label of labels) {
        const labelBox = label.getBoundingClientRect();
        return {
          x: labelBox.left + 32,
          y: labelBox.bottom + 40
        };
      }

      return null;
    });

    if (dateFieldPoint) {
      await this.page.mouse.click(dateFieldPoint.x, dateFieldPoint.y);
      await this.page.keyboard.press('Enter').catch(() => null);
      await this.page.waitForTimeout(500);
      const hasCalendarDays = await this.hasSelectableCalendarDates();

      if (!hasCalendarDays) {
        await this.page.mouse.click(dateFieldPoint.x + 140, dateFieldPoint.y).catch(() => null);
        await this.page.waitForTimeout(500);
      }

      if (!(await this.hasSelectableCalendarDates())) {
        await this.clickCalendarTriggerByDom('Open calendar retry');
        await this.page.waitForTimeout(500);
      }
    } else {
      // Try clicking a visible date input near the label if the Choose date button wasn't found
      try {
        const dateInput = this.page.locator('input[placeholder*="date"], input[aria-label*="date"], input[name*="date"], input[type="text"]').first();
        if (await this.isVisible(dateInput)) {
          await dateInput.click();
          await this.page.waitForTimeout(500);
          if (await this.hasSelectableCalendarDates()) {
            return;
          }
        }
      } catch (e) {
        // ignore and continue to other fallback
      }
      const headingPicker = this.calendar().locator('h2, h3').first();
      if (await this.isVisible(headingPicker)) {
        await clickHighlighted(headingPicker, 'Open calendar');
      }
    }
  }

  async hasSelectableCalendarDates() {
    return this.page.evaluate(() => {
      const normalize = (value = '') => value.replace(/\s+/g, ' ').trim();
      const isVisible = (element) => {
        const box = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return box.width > 0 &&
          box.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.pointerEvents !== 'none' &&
          box.top >= 0 &&
          box.left >= 0;
      };
      const chooseDateHeading = Array.from(document.querySelectorAll('label, h1, h2, h3, h4, p, span, div'))
        .find((element) => isVisible(element) && /^Choose date$/i.test(normalize(element.textContent)));

      const calendarRoots = Array.from(document.querySelectorAll([
        '.MuiPickersPopper-root',
        '.MuiDateCalendar-root',
        '.MuiCalendarPicker-root',
        '.react-datepicker',
        '[role="dialog"]',
        '[class*="datepicker" i]',
        '[class*="calendar" i]'
      ].join(', '))).filter(isVisible);

      if (chooseDateHeading) {
        let root = chooseDateHeading.parentElement;
        for (let depth = 0; root && depth < 6; depth += 1) {
          if (root.querySelectorAll('button, [role="button"], .day').length >= 5) {
            calendarRoots.push(root);
          }
          root = root.parentElement;
        }
      }

      const roots = Array.from(new Set(calendarRoots));
      if (!roots.length) return false;

      return roots.some((root) => Array.from(root.querySelectorAll('button, [role="button"], .day, div, span'))
        .some((element) => {
          const text = normalize(element.innerText || element.textContent || '');
          const className = String(element.className || '');
          return /^\d{1,2}$/.test(text) &&
            isVisible(element) &&
            !/disabled|disable-day|outside|unavailable/i.test(className) &&
            element.getAttribute('aria-disabled') !== 'true' &&
            !element.closest('[disabled], [aria-disabled="true"]');
        }));
    }).catch(() => false);
  }

  async clickCalendarTriggerByDom(label) {
    const clicked = await this.page.evaluate((interactionLabel) => {
      const normalize = (value = '') => value.replace(/\s+/g, ' ').trim();
      const isVisible = (element) => {
        const box = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return box.width > 0 &&
          box.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.pointerEvents !== 'none';
      };
      const center = (element) => {
        const box = element.getBoundingClientRect();
        return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      };
      const labelElement = Array.from(document.querySelectorAll('label, h1, h2, h3, h4, p, span, div'))
        .find((element) => isVisible(element) && /^Choose date$/i.test(normalize(element.textContent)));
      const labelBox = labelElement?.getBoundingClientRect();
      const roots = [];

      if (labelElement) {
        let root = labelElement.parentElement;
        for (let depth = 0; root && depth < 5; depth += 1) {
          roots.push(root);
          root = root.parentElement;
        }
      } else {
        roots.push(document.body);
      }

      const selectors = [
        'input:not([type="hidden"])',
        'button',
        '[role="button"]',
        '[class*="calendar" i]',
        '[class*="date" i]',
        'svg'
      ];
      const candidates = [];

      for (const root of roots) {
        for (const selector of selectors) {
          candidates.push(...Array.from(root.querySelectorAll(selector)));
        }
      }

      const uniqueCandidates = Array.from(new Set(candidates))
        .map((element) => {
          const target = element.closest('button, [role="button"], .MuiInputBase-root, .MuiFormControl-root, input') || element;
          const box = target.getBoundingClientRect();
          const point = center(target);
          const text = normalize(target.innerText || target.textContent || target.getAttribute('aria-label') || '');
          return { element: target, box, point, text };
        })
        .filter(({ element, box, point, text }) => {
          if (!isVisible(element)) return false;
          if (element.closest('header, nav, aside, [class*="profile" i], [class*="notification" i]')) return false;
          const looksLikeDateControl = /date|calendar|choose date/i.test(text) ||
            /date|calendar|picker/i.test(String(element.className || '')) ||
            element.matches('input, button, [role="button"]');
          const nearLabel = !labelBox || (
            point.x >= labelBox.left - 20 &&
            point.x <= labelBox.left + 460 &&
            point.y >= labelBox.top - 10 &&
            point.y <= labelBox.bottom + 100
          );
          return looksLikeDateControl && nearLabel && box.width > 0 && box.height > 0;
        })
        .sort((left, right) => left.box.top - right.box.top || left.box.left - right.box.left);

      const candidate = uniqueCandidates[0]?.element;
      if (!candidate) return false;

      candidate.setAttribute('data-highlight-label', interactionLabel);
      candidate.scrollIntoView({ block: 'center', inline: 'center' });
      candidate.click();
      return true;
    }, label).catch(() => false);

    if (!clicked) {
      return false;
    }

    await this.page.waitForTimeout(700);
    return this.hasSelectableCalendarDates();
  }

  async clickFirstAvailableCalendarDate() {
    const preferredDateIndex = Math.max(0, Math.floor(Number(process.env.BOOKING_DATE_OPTION_INDEX || 7) || 7));
    const clickCandidate = () => this.page.evaluate((dateIndex) => {
      const normalize = (value = '') => value.replace(/\s+/g, ' ').trim();
      const isVisible = (element) => {
        const box = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return box.width > 0 &&
          box.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.pointerEvents !== 'none' &&
          box.top >= 0 &&
          box.left >= 0;
      };
      const chooseDateHeading = Array.from(document.querySelectorAll('h1, h2, h3, h4, p, span, div'))
        .find((element) => isVisible(element) && /^Choose date$/i.test(normalize(element.textContent)));

      const calendarRoots = Array.from(document.querySelectorAll([
        '.MuiPickersPopper-root',
        '.MuiDateCalendar-root',
        '.MuiCalendarPicker-root',
        '.react-datepicker',
        '[role="dialog"]',
        '[class*="datepicker" i]',
        '[class*="calendar" i]'
      ].join(', '))).filter(isVisible);

      if (chooseDateHeading) {
        let root = chooseDateHeading.parentElement;
        for (let depth = 0; root && depth < 6; depth += 1) {
          if (root.querySelectorAll('.day, button, [role="button"]').length >= 5) {
            calendarRoots.push(root);
          }
          root = root.parentElement;
        }
      }

      const roots = Array.from(new Set(calendarRoots));
      if (!roots.length) {
        return false;
      }

      const candidates = roots.flatMap((root) => Array.from(root.querySelectorAll('button, [role="button"], .day, div, span')))
        .map((element) => ({
          element,
          text: (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim(),
          box: element.getBoundingClientRect(),
          style: window.getComputedStyle(element)
        }))
        .filter(({ element, text, style }) =>
          /^\d{1,2}$/.test(text) &&
          isVisible(element) &&
          (style.cursor === 'pointer' || element.matches('button, [role="button"]')) &&
          !/disabled|disable-day|outside|unavailable/i.test(element.className || '') &&
          element.getAttribute('aria-disabled') !== 'true' &&
          !element.closest('[disabled], [aria-disabled="true"]')
        )
        .sort((left, right) => left.box.top - right.box.top || left.box.left - right.box.left);

      const candidate = candidates[Math.min(dateIndex, candidates.length - 1)]?.element;
      if (!candidate) {
        return false;
      }

      candidate.scrollIntoView({ block: 'center', inline: 'center' });
      candidate.click();
      return true;
    }, preferredDateIndex);

    for (let attempt = 1; attempt <= 12; attempt += 1) {
      if (attempt === 1 && !(await this.hasSelectableCalendarDates())) {
        await this.clickCalendarTriggerByDom('Open calendar retry');
      }

      const clicked = await clickCandidate();
      if (clicked) {
        await this.page.waitForTimeout(500);
        return;
      }
      // If no candidate found, try navigating the calendar to the next month and retry
      const navigated = await this.page.evaluate(() => {
        try {
          const isVisible = (element) => {
            const box = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return box.width > 0 &&
              box.height > 0 &&
              style.visibility !== 'hidden' &&
              style.display !== 'none' &&
              style.pointerEvents !== 'none';
          };
          const roots = Array.from(document.querySelectorAll([
            '.MuiPickersPopper-root',
            '.MuiDateCalendar-root',
            '.MuiCalendarPicker-root',
            '.react-datepicker',
            '[role="dialog"]',
            '[class*="datepicker" i]',
            '[class*="calendar" i]'
          ].join(', '))).filter(isVisible);

          if (!roots.length) return false;

          // Common calendar next controls use aria-label like "Next month" or icons
          const candidates = roots.flatMap((root) => Array.from(root.querySelectorAll('button, [role="button"], .MuiIconButton-root')));
          const nextBtn = candidates.find((el) => {
            const aria = el.getAttribute && el.getAttribute('aria-label');
            const title = el.getAttribute && el.getAttribute('title');
            const className = String(el.className || '');
            const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
            return /next month|go to next month|next calendar/i.test(`${aria || ''} ${title || ''}`) ||
              (/MuiPickersArrowSwitcher-button/i.test(className) && !/next$/i.test(text));
          });

          if (nextBtn) {
            nextBtn.scrollIntoView({ block: 'center' });
            nextBtn.click();
            return true;
          }

          return false;
        } catch (e) {
          return false;
        }
      });

      if (navigated) {
        await this.page.waitForTimeout(700);
        continue;
      }

      await this.page.waitForTimeout(500);
    }

    throw new Error('No available booking date was found in the calendar.');
  }

  async selectFirstDropdownValue(selectLocator, label, options = {}) {
    if (!(await this.isVisible(selectLocator))) {
      if (options.optional) {
        console.log(`⚠️ Optional dropdown ${label} not visible, skipping`);
        return;
      }

      throw new Error(`${label} dropdown is not visible.`);
    }

    try {
      await clickHighlighted(selectLocator, label);

      await this.waitForDropdownOptions();
      const firstOption = await this.preferredVisibleOption(label);
      await firstOption.waitFor({ state: 'visible', timeout: 30000 });
      try {
        await clickHighlighted(firstOption, `${label} first value`);
      } catch (error) {
        console.log(`⚠️ ${label} first option click detached, retrying DOM option click: ${error.message}`);
        await this.clickFirstVisibleDropdownOption(`${label} first value retry`);
      }

      if (options.closeAfterSelect) {
        await this.page.waitForTimeout(500);
        await this.closeOpenDropdown();
      }
      
      console.log(`✅ Successfully selected ${label}`);
    } catch (error) {
      if (options.optional) {
        console.log(`⚠️ Optional dropdown ${label} selection failed, continuing: ${error.message}`);
        // Try to close any open dropdown
        await this.closeOpenDropdown();
        return;
      }
      throw error;
    }
  }

  async selectResourceWithAccessPointFallback(maxAlternativeAccessPoints = 3) {
    if (await this.trySelectResourceForCurrentAccessPoint()) {
      return true;
    }

    for (let attempt = 1; attempt <= maxAlternativeAccessPoints; attempt += 1) {
      const selectedAccessPoint = await this.selectDropdownOptionByIndex(
        this.accessPointSelect,
        'Resource-capable access point',
        attempt
      );

      if (!selectedAccessPoint) {
        console.log(`No additional access point option available for resource retry ${attempt}/${maxAlternativeAccessPoints}.`);
        break;
      }

      await this.reselectSchedulingRequirementsAfterAccessPointChange();
      await this.waitForBusyState();
      await this.page.waitForTimeout(700);
      console.log(`Retrying Resource after selecting access point option ${attempt + 1}.`);

      if (await this.trySelectResourceForCurrentAccessPoint()) {
        return true;
      }
    }

    console.log(`No Resource was available after the selected access point plus ${maxAlternativeAccessPoints} retry access point(s); continuing booking without Resource.`);
    return false;
  }

  async reselectSchedulingRequirementsAfterAccessPointChange() {
    await this.waitForBusyState();
    await this.page.waitForTimeout(500);
    await this.selectFirstDropdownValue(this.vehicleTypeSelect, 'Vehicle type');
    await this.selectFirstDropdownValue(this.fuelTypeSelect, 'Fuel type');
  }

  async trySelectResourceForCurrentAccessPoint() {
    if (!(await this.isVisible(this.resourceSelect))) {
      console.log('Resource dropdown not visible for the current access point.');
      return false;
    }

    try {
      await clickHighlighted(this.resourceSelect, 'Resource');
      await this.waitForDropdownOptions();

      const firstOption = await this.preferredVisibleOption('Resource');
      await firstOption.waitFor({ state: 'visible', timeout: 10000 });

      try {
        await clickHighlighted(firstOption, 'Resource first value');
      } catch (error) {
        console.log(`Resource first option click detached, retrying DOM option click: ${error.message}`);
        await this.clickFirstVisibleDropdownOption('Resource first value retry');
      }

      await this.page.waitForTimeout(500);
      await this.closeOpenDropdown();
      console.log('Successfully selected Resource');
      return true;
    } catch (error) {
      console.log(`Resource selection failed for current access point: ${error.message}`);
      await this.closeOpenDropdown();
      return false;
    }
  }

  async selectDropdownOptionByIndex(selectLocator, label, optionIndex) {
    if (!(await this.isVisible(selectLocator))) {
      console.log(`${label} dropdown is not visible for retry ${optionIndex}.`);
      return false;
    }

    try {
      await clickHighlighted(selectLocator, label);
      await this.waitForDropdownOptions();

      const options = this.page.locator('[role="option"]:not([aria-disabled="true"])').filter({ hasText: /\S/ });
      const optionCount = await options.count();

      if (optionIndex >= optionCount) {
        await this.closeOpenDropdown();
        return false;
      }

      const option = options.nth(optionIndex);
      const optionText = (await option.textContent().catch(() => '')).replace(/\s+/g, ' ').trim();
      await clickHighlighted(option, `${label} option ${optionIndex + 1}`);
      console.log(`Selected ${label}: ${optionText || `option ${optionIndex + 1}`}`);
      return true;
    } catch (error) {
      console.log(`Could not select ${label} option ${optionIndex + 1}: ${error.message}`);
      await this.closeOpenDropdown();
      return false;
    }
  }

  async fillVisibleRequiredTextFields() {
    const requiredTextFields = this.page.locator('input[required]:visible, textarea[required]:visible');
    const totalFields = await requiredTextFields.count();

    for (let index = 0; index < totalFields; index += 1) {
      const field = requiredTextFields.nth(index);
      const currentValue = await field.inputValue().catch(() => '');

      if (!currentValue) {
        await fillHighlighted(field, REQUIRED_TEXT_VALUE, 'Mandatory text field');
      }
    }
  }

  async fillVisibleBookingDetailsFields() {
    const fields = await this.page
      .locator('input:visible, textarea:visible')
      .evaluateAll((elements) =>
        elements
          .map((element, index) => {
            const input = element;
            const type = (input.getAttribute('type') || '').toLowerCase();
            const label = [
              input.getAttribute('name'),
              input.getAttribute('placeholder'),
              input.getAttribute('aria-label'),
              input.id
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();

            return {
              index,
              type,
              label,
              value: input.value || '',
              disabled: input.disabled,
              readOnly: input.readOnly
            };
          })
          .filter((field) => {
            if (field.disabled || field.readOnly || field.value.trim()) {
              return false;
            }

            if (['hidden', 'password', 'checkbox', 'radio', 'file', 'submit', 'button'].includes(field.type)) {
              return false;
            }

            if (field.label.includes('search') || field.label.includes('date') || field.label.includes('time')) {
              return false;
            }

            return true;
          })
      );

    for (const field of fields) {
      const locator = this.page.locator('input:visible, textarea:visible').nth(field.index);
      const value = this.valueForField(field);

      try {
        await fillHighlighted(locator, value, 'Booking detail field');
        console.log(`✅ Filled booking detail field: ${field.label || field.type || `field ${field.index}`}`);
      } catch (error) {
        console.log(`⚠️ Could not fill booking detail field ${field.index}: ${error.message}`);
      }
    }
  }

  async fillConfiguredBookingEmail() {
    if (!this.bookingEmail) {
      return false;
    }

    const filled = await this.page.evaluate((email) => {
      const normalize = (value = '') => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const isVisible = (element) => {
        const box = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return box.width > 0 &&
          box.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none';
      };
      const isEmailField = (input) => {
        const type = normalize(input.getAttribute('type'));
        const label = normalize([
          input.getAttribute('name'),
          input.getAttribute('placeholder'),
          input.getAttribute('aria-label'),
          input.id,
          input.closest('label')?.innerText,
          input.closest('.MuiFormControl-root')?.innerText,
          input.closest('[class*="field" i]')?.innerText
        ].filter(Boolean).join(' '));

        return type === 'email' || /\bemail\b|e-mail/.test(label);
      };

      const candidates = Array.from(document.querySelectorAll('input, textarea'))
        .filter((input) =>
          isVisible(input) &&
          isEmailField(input) &&
          !input.disabled &&
          !input.readOnly &&
          input.type !== 'hidden'
        );

      for (const input of candidates) {
        input.focus();
        input.value = email;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.blur();
      }

      return candidates.length;
    }, this.bookingEmail);

    if (filled) {
      console.log(`✅ Filled booking email recipient: ${this.bookingEmail}`);
      return true;
    }

    console.log(`⚠️ No editable booking email field was available for ${this.bookingEmail}`);
    return false;
  }

  valueForField(field) {
    if (field.type === 'email' || field.label.includes('email')) {
      return this.bookingEmail || 'automation@example.com';
    }

    if (field.type === 'tel' || field.label.includes('phone') || field.label.includes('mobile')) {
      return '07123456789';
    }

    if (field.label.includes('company')) {
      return COMPANY_NAME;
    }

    if (field.label.includes('name')) {
      return 'Automation User';
    }

    if (field.label.includes('registration') || field.label.includes('vehicle')) {
      return 'AUTO123';
    }

    return REQUIRED_TEXT_VALUE;
  }

  async selectVisibleRequiredDropdowns() {
    const requiredDropdowns = this.page.locator('[role="combobox"][aria-required="true"]:visible');
    const totalDropdowns = await requiredDropdowns.count();

    for (let index = 0; index < totalDropdowns; index += 1) {
      const dropdown = requiredDropdowns.nth(index);
      const selectedText = await dropdown.textContent().catch(() => '');

      if (!selectedText.trim()) {
        await this.selectFirstDropdownValue(dropdown, 'Mandatory dropdown');
      }
    }
  }

  async closeOpenDropdown() {
    const backdrop = this.page.locator('.MuiBackdrop-root').last();

    if (await this.isVisible(backdrop)) {
      await clickHighlighted(backdrop, 'Close dropdown');
      return;
    }

    await this.page.keyboard.press('Escape');
  }

  async loadTimeSlots() {
    const getSlotsButton = this.page.getByRole('button', { name: /Get Slots/i }).first();

    if (await this.isVisible(getSlotsButton)) {
      const disabled = await getSlotsButton.getAttribute('disabled').catch(() => null);

      if (disabled === null) {
        await clickHighlighted(getSlotsButton, 'Get Slots');
        await this.page.waitForTimeout(3000);
      }
    }
  }

  async waitForAvailableTimeSlots() {
    console.log('⏳ Waiting for available time slots to render...');

    const result = await this.page.waitForFunction(
      () => {
        const text = document.body.innerText || '';
        if (/\b\d{1,2}:\d{2}\s*(?:AM|PM)?\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM)?\b/i.test(text)) {
          return 'slots';
        }
        if (/No slots are available|No time slots are available/i.test(text)) {
          return 'no-slots';
        }
        return false;
      },
      null,
      { timeout: 60000 }
    ).then((handle) => handle.jsonValue());

    this.lastTimeSlotState = result;
    if (result === 'no-slots') {
      console.log('No time slots are available for the selected booking date; continuing with the app-provided no-slot state.');
      return result;
    }

    console.log('✅ Available time slots rendered');
    return result;
  }

  async clickNext(label) {
    await this.waitForBusyState();

    if (/booking date/i.test(label)) {
      for (let attempt = 1; attempt <= 20; attempt += 1) {
        if (await this.clickBookingFormNextButton(label)) {
          return;
        }
        console.log(`â³ Waiting for Booking Date Next button to be ready... (${attempt}/20)`);
        await this.page.waitForTimeout(500);
        await this.waitForBusyState();
      }
    }

    let nextBtn = await this.visibleNextButton();

    if (!nextBtn) {
      await this.waitForNextButtonVisible(60000).catch(() => null);
      await this.waitForBusyState();
      nextBtn = await this.visibleNextButton();
    }
    
    if (!nextBtn) {
      console.log(`⚠️ Next button not visible for ${label}, checking if we can proceed...`);

      const visibleButtons = await this.visibleButtonTexts();
      throw new Error(`No visible Next button found for ${label}. Visible buttons: ${visibleButtons.join(' | ') || 'none'}`);
    }

    try {
      await nextBtn.waitFor({ state: 'visible', timeout: 5000 });
    } catch (error) {
      throw error;
    }
    
    // Wait up to 10 seconds for the button to be enabled
    let attempts = 0;
    const maxAttempts = 20;
    
    while (attempts < maxAttempts) {
      const isDisabled = await nextBtn.getAttribute('disabled');
      if (isDisabled === null) {
        break;
      }
      
      console.log(`⏳ Waiting for Next button to be enabled... (${attempts + 1}/${maxAttempts})`);
      await this.page.waitForTimeout(500);
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      console.log('⚠️ Next button still disabled, trying to click anyway');
    }
    
    await clickHighlighted(nextBtn, label);

    if (label.includes('Booking time')) {
      await this.page.waitForTimeout(1000);
      if (await this.isStepVisible('Booking Details')) {
        console.log('✅ Advanced to Booking Details');
      }
    }
  }

  async waitForStep(stepName) {
    await this.page.getByText(stepName, { exact: true }).first().waitFor({ state: 'visible', timeout: 60000 });
  }

  async waitForBusyState() {
    await this.page
      .locator('[role="progressbar"], .MuiCircularProgress-root, .MuiBackdrop-root:has(.MuiCircularProgress-root)')
      .first()
      .waitFor({ state: 'hidden', timeout: 60000 })
      .catch(() => null);
  }

  async waitForNextButtonVisible(timeout = 60000) {
    await this.page.waitForFunction(() => {
      const isVisible = (element) => {
        const box = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return box.width > 0 &&
          box.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.pointerEvents !== 'none';
      };

      return Array.from(document.querySelectorAll('button, [role="button"]'))
        .some((element) => /next/i.test(element.innerText || element.textContent || '') && isVisible(element));
    }, null, { timeout });
  }

  async clickBookingFormNextButton(label) {
    const clicked = await this.page.evaluate((interactionLabel) => {
      const isVisible = (element) => {
        const box = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return box.width > 0 &&
          box.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.pointerEvents !== 'none';
      };
      const isEnabled = (element) =>
        !element.disabled &&
        element.getAttribute('disabled') === null &&
        element.getAttribute('aria-disabled') !== 'true';
      const candidates = Array.from(document.querySelectorAll('button, [role="button"]'))
        .map((element) => ({
          element,
          text: (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim(),
          box: element.getBoundingClientRect()
        }))
        .filter(({ element, text, box }) =>
          /^Next\b/i.test(text) &&
          isVisible(element) &&
          isEnabled(element) &&
          box.left >= 250 &&
          box.top >= 350 &&
          box.width <= 240 &&
          !element.closest('header, nav, aside, [class*="notification" i]')
        )
        .sort((left, right) => left.box.top - right.box.top || left.box.left - right.box.left);

      const candidate = candidates[0]?.element;
      if (!candidate) return false;

      candidate.dataset.highlightLabel = interactionLabel;
      candidate.scrollIntoView({ block: 'center', inline: 'center' });
      candidate.click();
      return true;
    }, label).catch(() => false);

    if (!clicked) {
      return false;
    }

    await this.page.waitForTimeout(700);
    await this.waitForBusyState();
    return true;
  }

  async isStepVisible(stepName) {
    return this.page.getByText(stepName, { exact: true }).first().isVisible().catch(() => false);
  }

  async visibleNextButton() {
    const candidates = [
      this.page.getByRole('button', { name: /Next/i }).last(),
      this.page.locator('button:has-text("Next")').last(),
      this.page.locator('[role="button"]:has-text("Next")').last(),
      this.page.locator('text=Next').last()
    ];

    for (const candidate of candidates) {
      if (await candidate.isVisible({ timeout: 1500 }).catch(() => false)) {
        return candidate;
      }
    }

    return null;
  }

  async isNextEnabled() {
    const nextBtn = await this.visibleNextButton();

    if (!nextBtn) {
      return false;
    }

    const disabled = await nextBtn.getAttribute('disabled').catch(() => null);
    const ariaDisabled = await nextBtn.getAttribute('aria-disabled').catch(() => null);
    const enabled = await nextBtn.isEnabled().catch(() => false);

    return disabled === null && ariaDisabled !== 'true' && enabled;
  }

  async visibleButtonTexts() {
    const buttons = await this.page.locator('button, [role="button"]').all();
    const texts = [];

    for (const button of buttons) {
      if (await this.isVisible(button)) {
        const text = await button.textContent().catch(() => '');
        if (text.trim()) {
          texts.push(text.trim().replace(/\s+/g, ' '));
        }
      }
    }

    return texts;
  }

  calendar() {
    return this.page.locator('div', { has: this.page.getByRole('heading', { name: 'Choose date' }) }).first();
  }

  firstVisibleOption() {
    return this.page.locator('[role="option"]:not([aria-disabled="true"])').filter({ hasText: /\S/ }).first();
  }

  async preferredVisibleOption(label) {
    const options = this.page.locator('[role="option"]:not([aria-disabled="true"])').filter({ hasText: /\S/ });
    const count = await options.count();

    if (!/(access point|resource)/i.test(label)) {
      return options.first();
    }

    const preferredValue = projectManagementPreferredValue(label);
    if (preferredValue) {
      for (let index = 0; index < count; index += 1) {
        const option = options.nth(index);
        const text = (await option.textContent().catch(() => '')).replace(/\s+/g, ' ').trim();
        if (text && new RegExp(`^${this.escapeRegExp(preferredValue)}$`, 'i').test(text)) {
          console.log(`Selected Project Management setup ${label} option: ${text}`);
          return option;
        }
      }
    }

    for (let index = 0; index < count; index += 1) {
      const option = options.nth(index);
      const text = (await option.textContent().catch(() => '')).replace(/\s+/g, ' ').trim();
      if (text && AUTOMATION_GENERATED_OPTION_PATTERN.test(text)) {
        console.log(`Selected latest automation-generated ${label} option: ${text}`);
        return option;
      }
    }

    for (let index = 0; index < count; index += 1) {
      const option = options.nth(index);
      const text = (await option.textContent().catch(() => '')).replace(/\s+/g, ' ').trim();
      if (text) {
        console.log(`Selected fallback ${label} option: ${text}`);
        return option;
      }
    }

    return options.first();
  }

  async clickFirstVisibleDropdownOption(label) {
    const clicked = await this.page.evaluate(({ interactionLabel, preferredValue }) => {
      const options = Array.from(document.querySelectorAll('[role="option"]:not([aria-disabled="true"])'));
      const isVisible = (element) => {
        const box = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return box.width > 0 &&
          box.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.pointerEvents !== 'none';
      };
      const avoidGeneratedSetup = /access point|resource/i.test(interactionLabel);
      const generatedPattern = /\b(?:Gate|Crane)\s+\d+\b/i;
      const visibleOptions = options.filter((element) => isVisible(element) && /\S/.test(element.innerText || element.textContent || ''));
      const textOf = (element) => (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
      const option = visibleOptions.find((element) => preferredValue && textOf(element).toLowerCase() === preferredValue.toLowerCase()) ||
        visibleOptions.find((element) => avoidGeneratedSetup && generatedPattern.test(textOf(element))) ||
        visibleOptions[0];

      if (!option) {
        return false;
      }

      option.dataset.highlightLabel = interactionLabel;
      option.scrollIntoView({ block: 'center', inline: 'center' });
      option.click();
      return true;
    }, { interactionLabel: label, preferredValue: projectManagementPreferredValue(label) });

    if (!clicked) {
      throw new Error(`No visible dropdown option found for ${label}.`);
    }

    await this.page.waitForTimeout(500);
  }

  async waitForDropdownOptions() {
    await this.page.waitForFunction(
      () => Array.from(document.querySelectorAll('[role="option"]')).some((option) => {
        const text = (option.innerText || option.textContent || '').trim();
        const style = window.getComputedStyle(option);
        return text &&
          !/loading/i.test(text) &&
          option.getAttribute('aria-disabled') !== 'true' &&
          style.visibility !== 'hidden' &&
          style.display !== 'none';
      }),
      null,
      { timeout: 30000 }
    );
  }

  async isVisible(locator) {
    return locator.isVisible().catch(() => false);
  }

  async isClickableCalendarDate(locator) {
    return locator
      .evaluate((element) => {
        const style = window.getComputedStyle(element);
        return style.cursor === 'pointer' && style.pointerEvents !== 'none';
      })
      .catch(() => false);
  }

  escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = { DeliveryBookingPage };
