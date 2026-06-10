const { checkHighlighted, clickHighlighted, fillHighlighted } = require('../../utils/highlight');
const { waitForBookingConfirmation } = require('../../utils/booking-confirmation');
const { uploadRequiredFiles } = require('../../utils/upload-fixture');

// Constants
const COMPANY_NAME = 'Construction Company';
const BOOKING_COMPLETE_WAIT_MS = 10000;
const REQUIRED_TEXT_VALUE = 'Test Value';
const TIME_SLOT_PATTERN = /\b\d{1,2}:\d{2}\s*(?:AM|PM)?\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM)?\b/i;

class DeliveryBookingPage {
  constructor(page, options = {}) {
    this.page = page;
    this.bookingTypeIndex = options.bookingTypeIndex ?? 0;
    this.bookingTypeLabel = options.bookingTypeLabel || 'Delivery';

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
    await this.submitBooking();
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
    await clickHighlighted(this.bookingTypeImage, `${this.bookingTypeLabel} booking type`);
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
    await this.openCalendar();
    await this.clickFirstAvailableCalendarDate();
    await this.clickNext('Booking date next');
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
    
    try {
      await this.checkUseMyDetails();
    } catch (error) {
      console.log('⚠️ Use My Details step failed, continuing without it:', error.message);
    }

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
    const chooseDateButton = this.page.getByRole('button', { name: /Choose date/i }).first();

    if (await this.isVisible(chooseDateButton)) {
      await clickHighlighted(chooseDateButton, 'Open calendar');
      return;
    }

    const headingPicker = this.calendar().locator('h2').first();
    await clickHighlighted(headingPicker, 'Open calendar');
  }

  async clickFirstAvailableCalendarDate() {
    const dayCandidates = this.calendar().locator('div').filter({ hasText: /^\d{1,2}$/ });
    const totalDays = await dayCandidates.count();

    for (let index = 0; index < totalDays; index += 1) {
      const day = dayCandidates.nth(index);

      if (await this.isClickableCalendarDate(day)) {
        await clickHighlighted(day, 'First available date');
        return;
      }
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
      const firstOption = this.firstVisibleOption();
      await firstOption.waitFor({ state: 'visible', timeout: 30000 });
      await clickHighlighted(firstOption, `${label} first value`);

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

  valueForField(field) {
    if (field.type === 'email' || field.label.includes('email')) {
      return 'automation@example.com';
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

    await this.page.waitForFunction(
      () => {
        const text = document.body.innerText || '';
        return /\b\d{1,2}:\d{2}\s*(?:AM|PM)?\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM)?\b/i.test(text);
      },
      null,
      { timeout: 60000 }
    );

    console.log('✅ Available time slots rendered');
  }

  async clickNext(label) {
    const nextBtn = await this.visibleNextButton();
    
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
      .locator('[role="progressbar"], .MuiCircularProgress-root')
      .first()
      .waitFor({ state: 'hidden', timeout: 60000 })
      .catch(() => null);
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
}

module.exports = { DeliveryBookingPage };
