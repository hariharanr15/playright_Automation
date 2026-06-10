const COMPANY_NAME = 'Construction Company';
const REQUIRED_TEXT_VALUE = 'Test Value';
const BOOKING_COMPLETE_WAIT_MS = 10000;
const TIME_SLOT_PATTERN = /\b\d{1,2}:\d{2}\s*(?:AM|PM)?\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM)?\b/i;
const { waitForBookingConfirmation } = require('../../utils/booking-confirmation');
const { uploadRequiredFiles } = require('../../utils/upload-fixture');

class RecurringBookingPage {
  constructor(page) {
    this.page = page;
  }

  async createRecurringBooking() {
    await this.withRetry(() => this.startNewBooking(), 'Start New Booking');
    await this.withRetry(() => this.selectRecurringBookingType(), 'Select Booking Type');
    await this.withRetry(() => this.completeSchedulingInformation(), 'Complete Scheduling');
    await this.withRetry(() => this.selectRecurringDates(), 'Select Dates');
    await this.withRetry(() => this.selectRecurringDays(), 'Select Recurring Days');
    await this.withRetry(() => this.selectFirstAvailableBookingTime(), 'Select Time Slot');
    await this.withRetry(() => this.completeBookingDetails(), 'Complete Booking Details');
    await this.withRetry(() => this.completeMandatoryAdditionalDetails(), 'Complete Additional Details');
    await this.withRetry(() => this.submitBooking(), 'Submit Booking');
  }

  async startNewBooking() {
    const bookingTypeTitle = this.page.getByText(/What kind of booking do you/i).first();

    if (await this.isVisible(bookingTypeTitle)) {
      return;
    }

    await this.page.getByRole('button', { name: /New Booking/i }).click();
    await bookingTypeTitle.waitFor({ state: 'visible', timeout: 30000 });
  }

  async selectRecurringBookingType() {
    await this.page.getByText(/What kind of booking do you/i).first().waitFor({ state: 'visible' });
    await this.page.locator('div:nth-child(2) > .book-type-block > .book-type-img > img').click();
    await this.clickNext('Booking type');
  }

  async completeSchedulingInformation() {
    await this.selectFirstOption('#mui-component-select-accesspoint', 'Access point');
    await this.selectFirstOption('#mui-component-select-vehicleType', 'Vehicle type');
    await this.selectFirstOption('#mui-component-select-fuelType', 'Fuel type');
    await this.selectOptionalResources();
    await this.clickNext('Scheduling information');
  }

  async selectRecurringDates() {
    await this.page.waitForFunction(
      () => document.querySelectorAll('.custom-date-input.custom-date-input-width').length >= 2,
      null,
      { timeout: 90000 }
    );

    await this.selectDateInput(0, 0);
    await this.selectDateInput(1, 2);
    await this.clickNext('Date selection');
  }

  async selectRecurringDays() {
    await this.page.waitForFunction(
      () => document.body.innerText.includes('Repeat on'),
      null,
      { timeout: 30000 }
    );

    const selectedDays = await this.selectAllAvailableRecurringDays();
    if (!selectedDays.length) {
      throw new Error('Could not find available recurring day buttons');
    }

    console.log(`Selected recurring days: ${selectedDays.join(', ')}`);
    await this.clickNext('Recurring days');
  }

  async selectFirstAvailableBookingTime() {
    const getSlotsButton = this.page.getByRole('button', { name: /Get Slots/i }).first();

    if (await this.isVisible(getSlotsButton)) {
      await getSlotsButton.click();
    }

    await this.page.waitForFunction(
      (pattern) => new RegExp(pattern, 'i').test(document.body.innerText),
      TIME_SLOT_PATTERN.source,
      { timeout: 60000 }
    );

    const selectedSlot = await this.page.evaluate((pattern) => {
      const timePattern = new RegExp(pattern, 'i');
      const candidates = Array.from(document.querySelectorAll('button, [role="button"], div, span'))
        .map((element) => {
          const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return { element, text, rect, style };
        })
        .filter(({ element, text, rect, style }) => (
          timePattern.test(text) &&
          text.length <= 50 &&
          rect.width > 50 &&
          rect.height > 20 &&
          style.cursor === 'pointer' &&
          style.pointerEvents !== 'none' &&
          !element.closest('[disabled]') &&
          element.getAttribute('aria-disabled') !== 'true'
        ))
        .sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);

      const slot = candidates[0]?.element;
      if (!slot) {
        return null;
      }

      slot.scrollIntoView({ block: 'center' });
      slot.click();
      return (slot.innerText || slot.textContent || '').replace(/\s+/g, ' ').trim();
    }, TIME_SLOT_PATTERN.source);

    if (!selectedSlot) {
      throw new Error('No available time slot could be selected');
    }

    console.log(`Selected time slot: ${selectedSlot}`);
    await this.clickNext('Time slot');
  }

  async completeBookingDetails() {
    await this.page.getByText('Booking Details', { exact: true }).first().waitFor({ state: 'visible' });

    const useMyDetails = this.page.locator('#active');
    if (await this.isVisible(useMyDetails) && !(await useMyDetails.isChecked())) {
      await useMyDetails.check();
    }

    await this.clickNext('Booking details');
  }

  async completeMandatoryAdditionalDetails() {
    await this.page.getByText('Additional Details', { exact: true }).first().waitFor({ state: 'visible' });

    const companyInput = this.page.locator('input[name="Free Text 22"]');
    if (await this.isVisible(companyInput)) {
      await companyInput.fill(COMPANY_NAME);
    }

    const dropdown = this.page.locator('[id="mui-component-select-Select Field 24"]');
    if (await this.isVisible(dropdown)) {
      await this.selectFirstOption(dropdown, 'Mandatory dropdown');
    }

    await this.fillRequiredTextFields();
    await uploadRequiredFiles(this.page, 'Recurring booking required upload');
  }

  async submitBooking() {
    await this.page.getByRole('button', { name: /Submit Booking|Submit/i }).last().click();
    await this.page.waitForTimeout(BOOKING_COMPLETE_WAIT_MS);
    return waitForBookingConfirmation(this.page, 'Recurring booking');
  }

  async selectFirstOption(selectorOrLocator, label) {
    const dropdown = typeof selectorOrLocator === 'string'
      ? this.page.locator(selectorOrLocator)
      : selectorOrLocator;

    await dropdown.waitFor({ state: 'visible', timeout: 30000 });
    await dropdown.click();

    const firstOption = this.page.locator('[role="option"]:not([aria-disabled="true"])').first();
    await firstOption.waitFor({ state: 'visible', timeout: 10000 });
    await firstOption.click();
    console.log(`Selected ${label}`);
  }

  async selectOptionalResources() {
    const resourceDropdown = this.page.locator('#mui-component-select-resource, [data-testid="resource-select"]').first();

    if (!(await this.isVisible(resourceDropdown))) {
      return;
    }

    await resourceDropdown.click();
    const checkboxes = await this.page.locator('[role="option"] [role="checkbox"]').all();

    for (const checkbox of checkboxes.slice(0, 2)) {
      if (!(await checkbox.isChecked().catch(() => true))) {
        await checkbox.check();
      }
    }

    await this.page.keyboard.press('Escape');
  }

  async selectDateInput(inputIndex, dateOffset) {
    const input = this.page.locator('.custom-date-input.custom-date-input-width').nth(inputIndex);
    await input.click({ force: true });

    const dates = this.page.locator('.calendar:visible .day.enable-day').filter({ hasText: /^([1-9]|[12]\d|3[01])$/ });
    await dates.first().waitFor({ state: 'visible', timeout: 10000 });

    const count = await dates.count();
    const date = dates.nth(Math.min(dateOffset, count - 1));
    await date.click({ force: true });
  }

  async selectAllAvailableRecurringDays() {
    return this.page.evaluate(() => {
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.pointerEvents !== 'none';
      };

      const label = Array.from(document.querySelectorAll('*'))
        .filter(isVisible)
        .find((element) => (element.innerText || element.textContent || '').trim() === 'Repeat on');

      if (!label) {
        return [];
      }

      const labelRect = label.getBoundingClientRect();
      const dayLetters = new Set(['M', 'T', 'W', 'F', 'S']);
      const buttons = Array.from(document.querySelectorAll('button, [role="button"], a, div, span'))
        .filter((element) => {
          const text = (element.innerText || element.textContent || '').trim();
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          const className = typeof element.className === 'string' ? element.className.toLowerCase() : '';

          return dayLetters.has(text) &&
            isVisible(element) &&
            rect.top >= labelRect.top &&
            rect.top <= labelRect.top + 120 &&
            rect.left >= labelRect.left - 40 &&
            !element.disabled &&
            element.getAttribute('aria-disabled') !== 'true' &&
            !className.includes('disabled') &&
            Number(style.opacity || '1') >= 0.45;
        })
        .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);

      const uniqueButtons = [];
      for (const button of buttons) {
        const rect = button.getBoundingClientRect();
        const duplicate = uniqueButtons.some((existing) => {
          const existingRect = existing.getBoundingClientRect();
          return Math.abs(existingRect.left - rect.left) < 6 && Math.abs(existingRect.top - rect.top) < 6;
        });

        if (!duplicate) {
          uniqueButtons.push(button.closest('button, [role="button"], a') || button);
        }
      }

      return uniqueButtons.map((button) => {
        const text = (button.innerText || button.textContent || '').trim();
        const className = typeof button.className === 'string' ? button.className.toLowerCase() : '';
        const isSelected = button.getAttribute('aria-pressed') === 'true' ||
          button.getAttribute('aria-selected') === 'true' ||
          className.includes('active') ||
          className.includes('selected');

        if (!isSelected) {
          button.click();
        }

        return text;
      });
    });
  }

  async clickNext(context) {
    await this.page.waitForFunction(
      () => Array.from(document.querySelectorAll('button')).some((button) => (
        /Next/i.test(button.textContent || '') &&
        !button.disabled &&
        button.getAttribute('aria-disabled') !== 'true'
      )),
      null,
      { timeout: 30000 }
    );

    const nextButton = this.page.getByRole('button', { name: /Next/i }).last();
    await nextButton.click();
    console.log(`Clicked Next for ${context}`);
    await this.page.waitForTimeout(1000);
  }

  async fillRequiredTextFields() {
    const fields = await this.page.locator('input[required]:visible, textarea[required]:visible').all();

    for (const field of fields) {
      const currentValue = await field.inputValue().catch(() => '');
      if (!currentValue.trim()) {
        await field.fill(REQUIRED_TEXT_VALUE);
      }
    }
  }

  async withRetry(action, label, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        return await action();
      } catch (error) {
        if (attempt === retries) {
          throw new Error(`${label} failed: ${error.message}`);
        }

        await this.page.waitForTimeout(1000 * attempt);
      }
    }
  }

  async isVisible(locator) {
    return locator.isVisible({ timeout: 1000 }).catch(() => false);
  }
}

module.exports = { RecurringBookingPage };
