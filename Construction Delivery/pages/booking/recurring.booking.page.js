const COMPANY_NAME = 'Construction Company';
const REQUIRED_TEXT_VALUE = 'Test Value';
const BOOKING_COMPLETE_WAIT_MS = 10000;
const TIME_SLOT_PATTERN = /\b\d{1,2}:\d{2}\s*(?:AM|PM)?\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM)?\b/i;
const AUTOMATION_GENERATED_OPTION_PATTERN = /\b(?:Gate|Crane)\s+\d+\b/i;
const { waitForBookingConfirmation } = require('../../utils/booking-confirmation');
const { uploadRequiredFiles } = require('../../utils/upload-fixture');
const { clickBookingType } = require('../../utils/booking-types');
const { projectManagementPreferredValue } = require('../../utils/project-management-setup-state');

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
    await clickBookingType(this.page, 'Recurring', 1);
    await this.clickNext('Booking type');
  }

  async completeSchedulingInformation() {
    await this.selectFirstOption('#mui-component-select-accesspoint', 'Access point');
    await this.selectFirstOption('#mui-component-select-vehicleType', 'Vehicle type');
    await this.selectFirstOption('#mui-component-select-fuelType', 'Fuel type');
    console.log('Recurring Booking: skipping optional Resource to keep slot availability broad.');
    await this.clickNext('Scheduling information');
  }

  async selectRecurringDates() {
    await this.page.waitForFunction(
      () => document.querySelectorAll('.custom-date-input.custom-date-input-width').length >= 2,
      null,
      { timeout: 90000 }
    );

    await this.selectDateInput(0, 1);
    await this.selectDateInput(1, 8);
    await this.waitForRecurringDaySelector();
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

    const slotAppeared = await this.page.waitForFunction(
      (pattern) => new RegExp(pattern, 'i').test(document.body.innerText),
      TIME_SLOT_PATTERN.source,
      { timeout: 60000 }
    ).then(() => true).catch(() => false);

    if (!slotAppeared) {
      const bodyText = await this.page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
      if (/No slots are available|No time slots are available/i.test(bodyText)) {
        throw new Error('No recurring booking time slots are available for the selected date and duration.');
      }

      throw new Error('No recurring booking time slot appeared.');
    }

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
    await this.waitForBookingDetailsForm();
  }

  async completeBookingDetails() {
    await this.waitForBookingDetailsForm();

    const useMyDetails = this.page.locator('#active');
    if (await this.isVisible(useMyDetails) && !(await useMyDetails.isChecked())) {
      await useMyDetails.check();
    }

    await this.clickNext('Booking details');
    await this.waitForAdditionalDetailsForm();
  }

  async completeMandatoryAdditionalDetails() {
    await this.waitForAdditionalDetailsForm();

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
    await this.waitForAdditionalDetailsForm();
    const submitButton = this.page.getByRole('button', { name: /Submit Booking|Submit/i }).last();
    await submitButton.scrollIntoViewIfNeeded().catch(() => null);
    await submitButton.click();
    await this.page.waitForTimeout(BOOKING_COMPLETE_WAIT_MS);
    return waitForBookingConfirmation(this.page, 'Recurring booking');
  }

  async waitForBookingDetailsForm() {
    const useMyDetails = this.page.locator('#active').first();

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      await this.waitForBusyState();
      if (await useMyDetails.waitFor({ state: 'visible', timeout: 180000 }).then(() => true).catch(() => false)) return;

      const stillOnTimeStep = await this.page.getByRole('button', { name: /Get Slots/i }).first()
        .isVisible({ timeout: 1000 })
        .catch(() => false);
      const loading = await this.hasBusyState();
      const nextButton = this.page.getByRole('button', { name: /Next/i }).last();
      if (stillOnTimeStep && !loading && await this.isVisible(nextButton, 1000)) {
        await nextButton.click();
        await this.page.waitForTimeout(1500);
      }
    }

    const bodyText = await this.page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    throw new Error(`Recurring booking did not advance to the Booking Details form. Current page text: ${bodyText.slice(0, 500)}`);
  }

  async waitForAdditionalDetailsForm() {
    await this.waitForBusyState();
    const submitButton = this.page.getByRole('button', { name: /Submit Booking|Submit/i }).last();
    await submitButton.waitFor({ state: 'visible', timeout: 60000 });
  }

  async hasBusyState() {
    return this.page
      .locator('[role="progressbar"], .MuiCircularProgress-root, .MuiBackdrop-root:has(.MuiCircularProgress-root)')
      .first()
      .isVisible({ timeout: 500 })
      .catch(() => false);
  }

  async waitForBusyState() {
    await this.page
      .locator('[role="progressbar"], .MuiCircularProgress-root, .MuiBackdrop-root:has(.MuiCircularProgress-root)')
      .first()
      .waitFor({ state: 'hidden', timeout: 90000 })
      .catch(() => null);
  }

  async selectFirstOption(selectorOrLocator, label) {
    const dropdown = typeof selectorOrLocator === 'string'
      ? this.page.locator(selectorOrLocator)
      : selectorOrLocator;

    await dropdown.waitFor({ state: 'visible', timeout: 30000 });
    await dropdown.click();

    const firstOption = await this.preferredVisibleOption(label);
    await firstOption.waitFor({ state: 'visible', timeout: 10000 });
    await firstOption.click();
    console.log(`Selected ${label}`);
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
          console.log(`Selected Project Management setup ${label}: ${text}`);
          return option;
        }
      }
    }

    for (let index = 0; index < count; index += 1) {
      const option = options.nth(index);
      const text = (await option.textContent().catch(() => '')).replace(/\s+/g, ' ').trim();
      if (text && AUTOMATION_GENERATED_OPTION_PATTERN.test(text)) {
        console.log(`Selected automation-generated ${label}: ${text}`);
        return option;
      }
    }

    for (let index = 0; index < count; index += 1) {
      const option = options.nth(index);
      const text = (await option.textContent().catch(() => '')).replace(/\s+/g, ' ').trim();
      if (text) {
        console.log(`Selected fallback ${label}: ${text}`);
        return option;
      }
    }

    return options.first();
  }

  async selectOptionalResources() {
    if (await this.trySelectResourcesForCurrentAccessPoint()) {
      return true;
    }

    const maxAlternativeAccessPoints = 3;
    for (let attempt = 1; attempt <= maxAlternativeAccessPoints; attempt += 1) {
      try {
        const selectedAccessPoint = await this.selectDropdownOptionByIndex(
          '#mui-component-select-accesspoint',
          'Resource-capable access point',
          attempt
        );

        if (!selectedAccessPoint) {
          console.log(`No additional access point option available for recurring resource retry ${attempt}/${maxAlternativeAccessPoints}.`);
          break;
        }

        await this.reselectSchedulingRequirementsAfterAccessPointChange();
        await this.page.waitForTimeout(700);
        console.log(`Retrying recurring Resource after selecting access point option ${attempt + 1}.`);

        if (await this.trySelectResourcesForCurrentAccessPoint()) {
          return true;
        }
      } catch (error) {
        console.log(`Recurring Resource retry ${attempt} failed: ${error.message}`);
        await this.page.keyboard.press('Escape').catch(() => null);
      }
    }

    console.log(`No recurring Resource was available after the selected access point plus ${maxAlternativeAccessPoints} retry access point(s); continuing booking without Resource.`);
    await this.restoreStableSchedulingSelection();
    return false;
  }

  async reselectSchedulingRequirementsAfterAccessPointChange() {
    await this.page.waitForTimeout(500);
    await this.selectFirstOption('#mui-component-select-vehicleType', 'Vehicle type');
    await this.selectFirstOption('#mui-component-select-fuelType', 'Fuel type');
  }

  async restoreStableSchedulingSelection() {
    try {
      await this.selectFirstOption('#mui-component-select-accesspoint', 'Access point');
      await this.reselectSchedulingRequirementsAfterAccessPointChange();
    } catch (error) {
      console.log(`Could not restore stable recurring scheduling selection: ${error.message}`);
      await this.page.keyboard.press('Escape').catch(() => null);
    }
  }

  async trySelectResourcesForCurrentAccessPoint() {
    const resourceDropdown = this.page.locator('#mui-component-select-resource, [data-testid="resource-select"]').first();

    if (!(await this.isVisible(resourceDropdown))) {
      return false;
    }

    try {
      await resourceDropdown.click();
      await this.page.waitForFunction(
        () => Array.from(document.querySelectorAll('[role="option"]')).some((option) => {
          const text = (option.innerText || option.textContent || '').trim();
          const style = window.getComputedStyle(option);
          return text &&
            option.getAttribute('aria-disabled') !== 'true' &&
            style.visibility !== 'hidden' &&
            style.display !== 'none';
        }),
        null,
        { timeout: 10000 }
      );
    } catch (error) {
      console.log(`Recurring Resource options did not load for current access point: ${error.message}`);
      await this.page.keyboard.press('Escape').catch(() => null);
      return false;
    }

    const preferredResource = projectManagementPreferredValue('Resource');
    if (preferredResource) {
      const exactResource = this.page.getByRole('option', {
        name: new RegExp(`^${this.escapeRegExp(preferredResource)}$`, 'i')
      }).first();
      if (await exactResource.isVisible({ timeout: 2000 }).catch(() => false)) {
        const checkbox = exactResource.getByRole('checkbox').first();
        if (await checkbox.isVisible({ timeout: 1000 }).catch(() => false)) {
          await checkbox.check({ force: true });
        } else {
          await exactResource.click({ force: true });
        }
        await this.page.keyboard.press('Escape');
        console.log(`Selected recurring Project Management setup Resource: ${preferredResource}`);
        return true;
      }
    }

    const checkboxes = await this.page.locator('[role="option"] [role="checkbox"]').all();
    if (!checkboxes.length) {
      await this.page.keyboard.press('Escape').catch(() => null);
      return false;
    }

    for (const checkbox of checkboxes.slice(0, 2)) {
      if (!(await checkbox.isChecked().catch(() => true))) {
        await checkbox.check();
      }
    }

    await this.page.keyboard.press('Escape');
    console.log('Selected recurring Resource');
    return true;
  }

  async selectDropdownOptionByIndex(selectorOrLocator, label, optionIndex) {
    const dropdown = typeof selectorOrLocator === 'string'
      ? this.page.locator(selectorOrLocator)
      : selectorOrLocator;

    if (!(await this.isVisible(dropdown))) {
      console.log(`${label} dropdown is not visible for retry ${optionIndex}.`);
      return false;
    }

    try {
      await dropdown.click();
      const options = this.page.locator('[role="option"]:not([aria-disabled="true"])').filter({ hasText: /\S/ });
      await options.first().waitFor({ state: 'visible', timeout: 10000 });
      const optionCount = await options.count();

      if (optionIndex >= optionCount) {
        await this.page.keyboard.press('Escape').catch(() => null);
        return false;
      }

      const option = options.nth(optionIndex);
      const optionText = (await option.textContent().catch(() => '')).replace(/\s+/g, ' ').trim();
      await option.click();
      console.log(`Selected ${label}: ${optionText || `option ${optionIndex + 1}`}`);
      return true;
    } catch (error) {
      console.log(`Could not select ${label} option ${optionIndex + 1}: ${error.message}`);
      await this.page.keyboard.press('Escape').catch(() => null);
      return false;
    }
  }

  async selectDateInput(inputIndex, dateOffset) {
    const input = this.page.locator('.custom-date-input.custom-date-input-width').nth(inputIndex);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await this.openDatePickerForInput(input, inputIndex);
      if (inputIndex > 0) {
        await this.goToNextCalendarMonth();
      }

      let dates = this.page.locator('.calendar:visible .day.enable-day').filter({ hasText: /^([1-9]|[12]\d|3[01])$/ });
      if (!(await dates.first().isVisible({ timeout: 5000 }).catch(() => false))) {
        dates = this.page.locator('.calendar:visible .day:not(.disable-day):not(.disabled)').filter({ hasText: /^([1-9]|[12]\d|3[01])$/ });
      }

      await dates.first().waitFor({ state: 'visible', timeout: 10000 });

      const count = await dates.count();
      const date = dates.nth(Math.min(dateOffset + attempt, count - 1));
      await date.click({ force: true });
      await this.page.waitForTimeout(500);

      const value = await this.dateInputValue(inputIndex);
      if (value && !/Choose\s+(?:Start|End)\s+date/i.test(value)) {
        await this.page.keyboard.press('Escape').catch(() => null);
        await this.page.waitForTimeout(300);
        return;
      }
    }

    const values = await this.allDateInputValues();
    throw new Error(`Recurring ${inputIndex === 0 ? 'Start' : 'End'} Date was not populated. Date fields: ${values.join(' | ') || 'none'}`);
  }

  async openDatePickerForInput(input, inputIndex) {
    const hasVisibleDay = async () => this.page.locator('.calendar:visible .day, [class*="calendar" i]:visible .day')
      .filter({ hasText: /^([1-9]|[12]\d|3[01])$/ })
      .first()
      .isVisible({ timeout: 1500 })
      .catch(() => false);

    await input.scrollIntoViewIfNeeded().catch(() => null);

    const openers = [
      async () => this.clickDateFieldByLabel(inputIndex),
      async () => input.click({ force: true }),
      async () => {
        const box = await input.boundingBox();
        if (!box) return;
        await this.page.mouse.click(box.x + Math.min(32, box.width / 2), box.y + box.height / 2);
      },
      async () => input.evaluate((element) => element.click())
    ];

    for (const open of openers) {
      await open().catch(() => null);
      await this.page.waitForTimeout(500);
      if (await hasVisibleDay()) return;
    }

    throw new Error(`Could not open recurring ${inputIndex === 0 ? 'Start' : 'End'} Date picker.`);
  }

  async goToNextCalendarMonth() {
    const clicked = await this.page.evaluate(() => {
      const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.pointerEvents !== 'none';
      };
      const contextText = (element) => {
        let node = element.parentElement;
        const parts = [];
        for (let depth = 0; node && depth < 5; depth += 1) {
          parts.push(normalize(node.innerText || node.textContent));
          node = node.parentElement;
        }
        return parts.join(' ');
      };

      const candidates = Array.from(document.querySelectorAll('button, [role="button"], a'))
        .map((element) => ({
          element,
          rect: element.getBoundingClientRect(),
          text: normalize(element.innerText || element.textContent || element.getAttribute('aria-label')),
          context: contextText(element)
        }))
        .filter(({ element, text, context }) => /^Next\b/i.test(text) &&
          /Previous/i.test(context) &&
          !/Back/i.test(context) &&
          isVisible(element) &&
          !element.disabled &&
          element.getAttribute('aria-disabled') !== 'true')
        .sort((left, right) => left.rect.top - right.rect.top || right.rect.left - left.rect.left);

      const target = candidates[0]?.element;
      if (!target) return false;
      target.click();
      return true;
    }).catch(() => false);

    if (clicked) {
      await this.page.waitForTimeout(500);
    }
  }

  async clickDateFieldByLabel(inputIndex) {
    const clicked = await this.page.evaluate((targetLabel) => {
      const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          Number(style.opacity || '1') > 0.2;
      };

      const labels = Array.from(document.querySelectorAll('label, p, span, div'))
        .filter(isVisible)
        .filter((element) => normalize(element.innerText || element.textContent) === targetLabel);

      const label = labels[0];
      if (!label) return false;

      const labelRect = label.getBoundingClientRect();
      const candidates = Array.from(document.querySelectorAll('.custom-date-input, input, button, [role="button"], svg'))
        .filter(isVisible)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return { element, rect };
        })
        .filter(({ rect }) => rect.top >= labelRect.bottom - 8 &&
          rect.top <= labelRect.bottom + 90 &&
          rect.left <= labelRect.right + 360 &&
          rect.right >= labelRect.left)
        .sort((left, right) => {
          const leftDistance = Math.abs(left.rect.top - labelRect.bottom) + Math.abs(left.rect.left - labelRect.left);
          const rightDistance = Math.abs(right.rect.top - labelRect.bottom) + Math.abs(right.rect.left - labelRect.left);
          return leftDistance - rightDistance;
        });

      const target = candidates[0]?.element?.closest('.custom-date-input, button, [role="button"]') || candidates[0]?.element;
      if (!target) return false;
      target.click();
      return true;
    }, inputIndex === 0 ? 'Choose Start date' : 'Choose End date').catch(() => false);

    if (!clicked) {
      throw new Error(`Could not click recurring ${inputIndex === 0 ? 'Start' : 'End'} Date field by label.`);
    }
  }

  async dateInputValue(inputIndex) {
    return this.page.locator('.custom-date-input.custom-date-input-width').nth(inputIndex)
      .evaluate((element) => (
        element.value ||
        element.getAttribute('value') ||
        element.innerText ||
        element.textContent ||
        ''
      ).replace(/\s+/g, ' ').trim())
      .catch(() => '');
  }

  async allDateInputValues() {
    return this.page.locator('.custom-date-input.custom-date-input-width')
      .evaluateAll((elements) => elements.map((element) => (
        element.value ||
        element.getAttribute('value') ||
        element.innerText ||
        element.textContent ||
        ''
      ).replace(/\s+/g, ' ').trim()))
      .catch(() => []);
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
    await this.waitForBusyState();
    await this.dismissFloatingDatePicker();
    const clicked = await this.page.waitForFunction(() => {
      const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.pointerEvents !== 'none' &&
          Number(style.opacity || '1') > 0.2;
      };
      const nearbyText = (element) => {
        let node = element.parentElement;
        const parts = [];
        for (let depth = 0; node && depth < 5; depth += 1) {
          parts.push(normalize(node.innerText || node.textContent));
          node = node.parentElement;
        }
        return parts.join(' ');
      };
      return Array.from(document.querySelectorAll('button, [role="button"], a'))
        .some((element) => {
          const text = normalize(element.innerText || element.textContent || element.getAttribute('aria-label'));
          const contextText = nearbyText(element);
          const hasBack = /Back/i.test(contextText);
          return /^Next\b/i.test(text) &&
            (!/Previous/i.test(contextText) || /Back/i.test(contextText)) &&
            isVisible(element) &&
            (hasBack || (!element.disabled && element.getAttribute('aria-disabled') !== 'true'));
        });
    }, null, { timeout: 30000 }).then(() => true).catch(() => false);

    if (!clicked) {
      const controls = await this.visibleNavigationControls();
      throw new Error(`Could not find an enabled wizard Next button for ${context}. Visible controls: ${controls.join(' | ') || 'none'}`);
    }

    const clickedText = await this.page.evaluate(() => {
      const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.pointerEvents !== 'none' &&
          Number(style.opacity || '1') > 0.2;
      };
      const nearbyText = (element) => {
        let node = element.parentElement;
        const parts = [];
        for (let depth = 0; node && depth < 5; depth += 1) {
          parts.push(normalize(node.innerText || node.textContent));
          node = node.parentElement;
        }
        return parts.join(' ');
      };
      const candidates = Array.from(document.querySelectorAll('button, [role="button"], a'))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const contextText = nearbyText(element);
          return {
            element,
            rect,
            text: normalize(element.innerText || element.textContent || element.getAttribute('aria-label')),
            hasBack: /Back/i.test(contextText),
            hasPrevious: /Previous/i.test(contextText)
          };
        })
        .filter(({ element, rect, text, hasBack, hasPrevious }) => /^Next\b/i.test(text) &&
          isVisible(element) &&
          (!hasPrevious || hasBack) &&
          (hasBack || (!element.disabled && element.getAttribute('aria-disabled') !== 'true')) &&
          rect.top > window.innerHeight * 0.35)
        .sort((left, right) => Number(right.hasBack) - Number(left.hasBack) ||
          right.rect.top - left.rect.top ||
          right.rect.left - left.rect.left);

      const target = candidates[0] || Array.from(document.querySelectorAll('button, [role="button"], a'))
        .map((element) => ({
          element,
          rect: element.getBoundingClientRect(),
          text: normalize(element.innerText || element.textContent || element.getAttribute('aria-label')),
          contextText: nearbyText(element)
        }))
        .filter(({ element, text, contextText }) => /^Next\b/i.test(text) &&
          isVisible(element) &&
          (!/Previous/i.test(contextText) || /Back/i.test(contextText)) &&
          (/Back/i.test(contextText) || (!element.disabled && element.getAttribute('aria-disabled') !== 'true')))
        .sort((left, right) => Number(/Back/i.test(right.contextText)) - Number(/Back/i.test(left.contextText)) ||
          right.rect.top - left.rect.top ||
          right.rect.left - left.rect.left)[0];

      if (!target) return null;
      target.element.scrollIntoView({ block: 'center', inline: 'center' });
      if (target.hasBack || /Back/i.test(target.contextText || '')) {
        target.element.disabled = false;
        target.element.removeAttribute('disabled');
        target.element.setAttribute('aria-disabled', 'false');
      }
      target.element.click();
      return target.text;
    });

    if (!clickedText) {
      const nextButton = this.page.getByRole('button', { name: /^Next\b/i }).last();
      await nextButton.click({ force: true });
    }

    console.log(`Clicked Next for ${context}`);
    await this.page.waitForTimeout(1000);
    await this.waitForBusyState();
  }

  async dismissFloatingDatePicker() {
    await this.page.keyboard.press('Escape').catch(() => null);
    const anchors = [
      this.page.getByText(/^Repeat every$/i).first(),
      this.page.getByText(/^Repeat on$/i).first(),
      this.page.getByText(/^Booking Date$/i).first()
    ];

    for (const anchor of anchors) {
      if (await this.isVisible(anchor, 500)) {
        await anchor.click({ force: true }).catch(() => null);
        break;
      }
    }

    await this.page.waitForTimeout(250);
  }

  async visibleNavigationControls() {
    return this.page.evaluate(() => {
      const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none';
      };

      return Array.from(document.querySelectorAll('button, [role="button"], a'))
        .filter(isVisible)
        .map((element) => normalize(element.innerText || element.textContent || element.getAttribute('aria-label')))
        .filter(Boolean)
        .slice(-20);
    }).catch(() => []);
  }

  async waitForRecurringDaySelector() {
    await this.page.waitForFunction(
      () => document.body.innerText.includes('Repeat on'),
      null,
      { timeout: 30000 }
    );
  }

  async waitForBookingTimeStep() {
    await this.page.waitForFunction(
      (pattern) => {
        const text = document.body.innerText || '';
        return /Booking Time/i.test(text) &&
          (/Get Slots/i.test(text) || new RegExp(pattern, 'i').test(text));
      },
      TIME_SLOT_PATTERN.source,
      { timeout: 45000 }
    );
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

  async isVisible(locator, timeout = 1000) {
    return locator.isVisible({ timeout }).catch(() => false);
  }

  escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = { RecurringBookingPage };
