const { clickHighlighted } = require('../../utils/highlight');
const { waitForBookingConfirmation } = require('../../utils/booking-confirmation');
const { clickBookingType } = require('../../utils/booking-types');
const { projectManagementPreferredValue } = require('../../utils/project-management-setup-state');

// Constants
const COMPANY_NAME = 'Construction Company';
const BOOKING_COMPLETE_WAIT_MS = 10000;
const REQUIRED_TEXT_VALUE = 'Test Value';
const TIME_SLOT_PATTERN = /\b\d{1,2}:\d{2}\s*(?:AM|PM)?\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM)?\b/i;

class ResourceOnlyBookingPage {
  constructor(page, options = {}) {
    this.page = page;
    this.bookingTypeIndex = options.bookingTypeIndex ?? 3; // 4th booking type (index 3)
    this.bookingTypeLabel = options.bookingTypeLabel || 'Resource';

    // Main booking elements
    this.newBookingButton = page.getByRole('button', { name: /New Booking/i });
    this.bookingTypeImage = page.locator('div:nth-child(4) > .book-type-block > .book-type-img');
    this.nextButton = page.getByRole('button', { name: /Next/i });

    // Resource selection elements - more flexible selectors
    this.resourceDropdown = page.getByLabel('', { exact: true });
    this.resourceDropdownFallback = page.locator('[role="combobox"]').first();
    this.resourceOptions = page.locator('[role="option"]');
    this.backdrop = page.locator('.MuiBackdrop-root');

    // Submit button - multiple selectors
    this.submitBookingButton = page.getByRole('button', { name: /Submit Booking|Submit/i });
    this.submitBookingButtonFallback = page.locator('button[type="submit"]');
    
    // Additional details - more flexible selectors
    this.useMyDetailsCheckbox = page.locator('#active');
    this.useMyDetailsCheckboxFallback = page.getByRole('checkbox', { name: /Use My Details/i });
    this.additionalCommentArea = page.locator('div').filter({ hasText: /^Additional CommentComment0\/500$/ });
    this.additionalCommentAreaFallback = page.locator('textarea, [role="textbox"]').last();
  }

  // Main booking flow
  async createResourceBooking() {
    await this.startNewBooking();
    await this.selectResourceBookingType();
    await this.selectResources();
    await this.selectFirstAvailableBookingDate();
    await this.selectFirstAvailableBookingTime();
    await this.completeBookingDetails();
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

  // Step 2: Select resource booking type (4th option)
  async selectResourceBookingType() {
    await this.page.getByText(/What kind of booking do you/i).first().waitFor({ state: 'visible' });
    await clickBookingType(this.page, 'Resource-Only', this.bookingTypeIndex);
    await this.clickNext(`${this.bookingTypeLabel} type next`);
  }

  // Step 3: Select resources
  async selectResources() {
    console.log('🔧 Selecting resources...');
    
    // Try to click on resource dropdown with fallback
    let dropdownClicked = false;
    try {
      if (await this.isVisible(this.resourceDropdown)) {
        await clickHighlighted(this.resourceDropdown, 'Resource dropdown');
        dropdownClicked = true;
      }
    } catch (error) {
      console.log('⚠️ Primary resource dropdown failed, trying fallback...');
    }
    
    if (!dropdownClicked) {
      try {
        await clickHighlighted(this.resourceDropdownFallback, 'Resource dropdown fallback');
        dropdownClicked = true;
      } catch (error) {
        console.log('⚠️ Fallback resource dropdown also failed:', error.message);
      }
    }
    
    if (dropdownClicked) {
      // Wait for options to appear
      await this.page.waitForTimeout(1000);
      const selectedPreferred = await this.selectPreferredProjectManagementResource();
      
      if (!selectedPreferred) {
        // Select Forklift (first option)
        try {
          const forkliftOption = this.page.getByText('Forklift');
          if (await this.isVisible(forkliftOption)) {
            await clickHighlighted(forkliftOption, 'Forklift resource');
          }
        } catch (error) {
          console.log('⚠️ Could not select Forklift:', error.message);
        }
        
        // Select additional resources as shown in codegen
        try {
          const palletTruckOption = this.page.getByRole('option', { name: 'Pallet Truck' }).getByRole('checkbox');
          if (await this.isVisible(palletTruckOption)) {
            await palletTruckOption.check();
          }
        } catch (error) {
          console.log('⚠️ Could not select Pallet Truck:', error.message);
        }
        
        try {
          const towerCraneOption = this.page.getByRole('option', { name: 'Tower Crane' }).getByRole('checkbox');
          if (await this.isVisible(towerCraneOption)) {
            await towerCraneOption.check();
          }
        } catch (error) {
          console.log('⚠️ Could not select Tower Crane:', error.message);
        }
      }
      
      // Close dropdown
      try {
        await this.page.keyboard.press('Escape');
      } catch (error) {
        console.log('⚠️ Could not close dropdown with backdrop; trying keyboard escape:', error.message);
        await this.page.keyboard.press('Escape').catch(() => null);
      }
    }
    
    await this.closeResourceDropdown();
    await this.clickNext('Resource selection next');
    await this.waitForStep('Booking Date', 60000);
  }

  async selectPreferredProjectManagementResource() {
    const preferredResource = projectManagementPreferredValue('Resource');
    if (!preferredResource) return false;

    const exactResource = this.page.getByRole('option', {
      name: new RegExp(`^${this.escapeRegExp(preferredResource)}$`, 'i')
    }).first();

    if (!(await this.isVisible(exactResource))) {
      console.log(`Project Management setup Resource was not visible for Resource-only booking: ${preferredResource}`);
      return false;
    }

    const checkbox = exactResource.getByRole('checkbox').first();
    if (await this.isVisible(checkbox)) {
      await checkbox.check({ force: true });
    } else {
      await clickHighlighted(exactResource, `Project Management Resource ${preferredResource}`);
    }

    console.log(`Selected Project Management setup Resource: ${preferredResource}`);
    return true;
  }

  async closeResourceDropdown() {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const openMenu = this.page.locator('[role="listbox"], .MuiPopover-root, .MuiMenu-root').first();
      if (!(await openMenu.isVisible({ timeout: 1000 }).catch(() => false))) {
        return;
      }

      await this.page.keyboard.press('Escape').catch(() => null);
      await openMenu.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => null);
    }

    await this.page.evaluate(() => {
      document.activeElement?.blur?.();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
    }).catch(() => null);

    const stillOpen = await this.page.locator('[role="listbox"], .MuiPopover-root, .MuiMenu-root')
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    if (stillOpen) {
      throw new Error('Resource dropdown did not close before continuing.');
    }
  }

  // Handle resource refinement (back/forth navigation from codegen)
  async handleResourceRefinement() {
    console.log('🔄 Handling resource refinement...');
    
    // Go back to refine selection
    const backButton = this.page.getByRole('button', { name: 'Back' });
    await clickHighlighted(backButton, 'Back to resources');
    
    // Open dropdown again
    const resourceCombobox = this.page.getByRole('combobox', { name: 'Forklift, Pallet Truck, Tower' });
    await clickHighlighted(resourceCombobox, 'Resource combobox');
    
    // Uncheck Tower Crane and Pallet Truck (keep only Forklift)
    const towerCraneCheckbox = this.page.getByRole('option', { name: 'Tower Crane' }).getByRole('checkbox');
    await towerCraneCheckbox.uncheck();
    
    const palletTruckCheckbox = this.page.getByRole('option', { name: 'Pallet Truck' }).getByRole('checkbox');
    await palletTruckCheckbox.uncheck();
    
    // Close dropdown
    await clickHighlighted(this.backdrop, 'Close refined dropdown');
    
    await this.clickNext('Refined resource next');
  }

  // Step 4: Select first available booking date
  async selectFirstAvailableBookingDate() {
    console.log('📅 Selecting first available booking date...');
    
    await this.waitForStep('Booking Date', 60000);
    
    // Click on calendar heading to open date picker
    const calendarHeading = this.page.getByRole('heading').filter({ hasText: /^$/ });
    await clickHighlighted(calendarHeading, 'Open calendar');
    
    // Select first available date (day 6 as shown in codegen, but we'll select first available)
    await this.clickFirstAvailableCalendarDate();
    
    await this.clickNext('Date selection next');
  }

  // Step 5: Select first available booking time
  async selectFirstAvailableBookingTime() {
    console.log('⏰ Selecting first available booking time...');
    
    // Wait for time slots to load
    await this.page.waitForTimeout(3000);
    
    // Select first available time slot (codegen shows :00 AM - 2:00 AM pattern)
    await this.selectFirstAvailableTimeSlot();
    
    await this.clickNext('Time selection next');
    await this.waitForBusyState(60000);
    await this.waitForBookingDetailsForm(60000);
  }

  // Step 6: Complete booking details
  async completeBookingDetails() {
    await this.waitForBusyState(60000);
    await this.waitForBookingDetailsForm(60000);
    console.log('📝 Completing booking details...');
    
    // Check "Use My Details" checkbox with fallback
    try {
      if (await this.isVisible(this.useMyDetailsCheckbox)) {
        await this.useMyDetailsCheckbox.check();
        console.log('✅ Used primary Use My Details checkbox');
      } else if (await this.isVisible(this.useMyDetailsCheckboxFallback)) {
        await this.useMyDetailsCheckboxFallback.check();
        console.log('✅ Used fallback Use My Details checkbox');
      }
    } catch (error) {
      console.log('⚠️ Could not find Use My Details checkbox:', error.message);
    }
    
    await this.clickNext('Booking details next');
    await this.waitForBusyState(60000);
    
    // Handle additional comment area with fallback
    try {
      if (await this.isVisible(this.additionalCommentArea)) {
        await clickHighlighted(this.additionalCommentArea, 'Additional comment area');
        await this.page.keyboard.press('ArrowDown');
      } else if (await this.isVisible(this.additionalCommentAreaFallback)) {
        await clickHighlighted(this.additionalCommentAreaFallback, 'Additional comment area fallback');
        await this.page.keyboard.press('ArrowDown');
      }
    } catch (error) {
      console.log('⚠️ Could not interact with comment area:', error.message);
    }
  }

  // Step 7: Submit booking
  async submitBooking() {
    await this.completeAdditionalComments().catch((error) => {
      console.log('Could not fill additional comment before submit:', error.message);
    });
    await this.waitForBusyState(60000);
    console.log('✅ Submitting resource booking...');
    
    let submitted = false;
    
    // Try primary submit button
    try {
      if (await this.isVisible(this.submitBookingButton)) {
        await clickHighlighted(this.submitBookingButton, 'Submit Booking');
        submitted = true;
      }
    } catch (error) {
      console.log('⚠️ Primary submit button failed:', error.message);
    }
    
    // Try fallback submit button
    if (!submitted) {
      try {
        if (await this.isVisible(this.submitBookingButtonFallback)) {
          await clickHighlighted(this.submitBookingButtonFallback, 'Submit Booking Fallback');
          submitted = true;
        }
      } catch (error) {
        console.log('⚠️ Fallback submit button failed:', error.message);
      }
    }
    
    if (!submitted) {
      throw new Error('Could not find any submit button to click');
    }
    
    await this.page.waitForTimeout(BOOKING_COMPLETE_WAIT_MS);
    const confirmation = await waitForBookingConfirmation(this.page, 'Resource booking');
    console.log('✅ Resource booking submitted successfully');
    return confirmation;
  }

  async completeAdditionalComments() {
    const commentText = `Resource booking automation ${Date.now()}`;
    const candidates = [
      this.page.getByRole('textbox', { name: /Comment/i }).last(),
      this.page.locator('textarea[name*="comment" i], input[name*="comment" i]').last(),
      this.page.locator('textarea').last(),
      this.page.locator('[contenteditable="true"]').last(),
      this.additionalCommentAreaFallback
    ];

    for (const candidate of candidates) {
      if (!(await this.isVisible(candidate))) {
        continue;
      }

      try {
        await candidate.fill(commentText);
        console.log('Filled additional comment');
        return;
      } catch (error) {
        await clickHighlighted(candidate, 'Additional comment field');
        await this.page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => null);
        await this.page.keyboard.insertText(commentText);
        console.log('Entered additional comment with keyboard fallback');
        return;
      }
    }

    if (await this.isVisible(this.additionalCommentArea)) {
      await clickHighlighted(this.additionalCommentArea, 'Additional comment area');
      await this.page.keyboard.insertText(commentText);
      console.log('Filled additional comment area');
    }
  }

  // Helper methods
  async clickFirstAvailableCalendarDate() {
    // Look for clickable date elements
    const dateElements = this.page.locator('div').filter({ hasText: /^\d{1,2}$/ });
    const totalDates = await dateElements.count();

    for (let index = 0; index < totalDates; index++) {
      const dateElement = dateElements.nth(index);
      
      if (await this.isClickableCalendarDate(dateElement)) {
        const dateText = await dateElement.textContent();
        console.log(`📅 Selecting first available date: ${dateText}`);
        await clickHighlighted(dateElement, `Date ${dateText}`);
        return;
      }
    }

    // Fallback: click on day 6 as shown in codegen
    const day6 = this.page.getByText('6', { exact: true });
    if (await this.isVisible(day6)) {
      await clickHighlighted(day6, 'Day 6');
    }
  }

  async selectFirstAvailableTimeSlot() {
    console.log('🔍 Looking for first available time slot...');
    
    // Wait for time slots to appear
    await this.page.waitForFunction(
      () => {
        const text = document.body.innerText || '';
        return /\b\d{1,2}:\d{2}\s*(?:AM|PM)?\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM)?\b/i.test(text);
      },
      null,
      { timeout: 30000 }
    );

    // Find and click first available time slot
    const timeSlotClicked = await this.page.evaluate(() => {
      const timePattern = new RegExp(String.raw`\b\d{1,2}:\d{2}\s*(?:AM|PM)?\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM)?\b`, 'i');
      const elements = Array.from(document.querySelectorAll('*'));
      
      for (const element of elements) {
        const text = (element.innerText || element.textContent || '').trim();
        const style = window.getComputedStyle(element);
        
        if (timePattern.test(text) && 
            style.cursor === 'pointer' && 
            style.pointerEvents !== 'none' &&
            text.length <= 40) {
          
          element.scrollIntoView({ block: 'center', inline: 'center' });
          element.click();
          return text;
        }
      }
      return null;
    });

    if (timeSlotClicked) {
      console.log(`✅ Selected first available time slot: ${timeSlotClicked}`);
    } else {
      // Fallback: look for specific pattern from codegen (:00 AM - 2:00 AM)
      const fallbackTimeSlot = this.page.getByText(':00 AM - 2:00 AM');
      if (await this.isVisible(fallbackTimeSlot)) {
        await clickHighlighted(fallbackTimeSlot, 'Fallback time slot');
      } else {
        throw new Error('No available time slot found');
      }
    }
  }

  async clickNext(label) {
    const nextBtn = await this.visibleNextButton();
    
    if (!nextBtn) {
      throw new Error(`No visible Next button found for ${label}`);
    }

    // Wait for button to be enabled
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
    
    await clickHighlighted(nextBtn, label);
  }

  async visibleNextButton() {
    const candidates = [
      this.page.getByRole('button', { name: /Next/i }).last(),
      this.page.locator('button:has-text("Next")').last(),
      this.page.getByRole('button', { name: 'NextForward' }) // From codegen
    ];

    for (const candidate of candidates) {
      if (await candidate.isVisible({ timeout: 10000 }).catch(() => false)) {
        return candidate;
      }
    }

    return null;
  }

  async waitForStep(stepName, timeout = 30000) {
    await this.page
      .getByText(stepName, { exact: true })
      .first()
      .waitFor({ state: 'visible', timeout });
  }

  async waitForBusyState(timeout = 30000) {
    await this.page
      .locator('[role="progressbar"], .MuiCircularProgress-root')
      .first()
      .waitFor({ state: 'hidden', timeout })
      .catch(() => null);

    await this.page.waitForTimeout(500);
  }

  async waitForBookingDetailsForm(timeout = 60000) {
    await this.page.waitForFunction(
      () => {
        const bodyText = document.body.innerText || '';
        const hasBookingDetailsStep = bodyText.includes('Booking Details');
        const hasEnabledNext = Array.from(document.querySelectorAll('button')).some((button) => (
          /Next/i.test(button.innerText || button.textContent || '') &&
          !button.disabled &&
          button.getAttribute('aria-disabled') !== 'true'
        ));
        const hasUseMyDetails = Boolean(document.querySelector('#active'));

        return hasBookingDetailsStep && (hasEnabledNext || hasUseMyDetails);
      },
      null,
      { timeout }
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

module.exports = { ResourceOnlyBookingPage };
