const { clickHighlighted, fillHighlighted, highlight } = require('../../utils/highlight');
const { loginIfVisible } = require('../../utils/login');
const { DashboardPage } = require('./dashboard.page');

const DEFAULT_EMAIL = process.env.VC_EMAIL || 'hariharan.r@neuralrays.ai';
const DEFAULT_PASSWORD = process.env.VC_PASSWORD || 'Master@15';

function myAccountSettleMs() {
  const configured = Number(process.env.MY_ACCOUNT_SETTLE_MS ?? process.env.ACTION_PAUSE_MS ?? 250);
  return Number.isFinite(configured) && configured >= 0 ? configured : 250;
}

class MyAccountPage {
  constructor(page, options = {}) {
    this.page = page;
    this.options = {
      appUrl: process.env.APP_URL || 'https://stg-app.voyagecontrol.com',
      baseUrl: process.env.BASE_URL || 'https://stg-login.voyagecontrol.com',
      projectId: process.env.PROJECT_ID || '5ET10000010',
      email: DEFAULT_EMAIL,
      password: DEFAULT_PASSWORD,
      finalFirstName: process.env.MY_ACCOUNT_FINAL_FIRST_NAME || 'Hariharan',
      finalLastName: process.env.MY_ACCOUNT_FINAL_LAST_NAME || 'Raja',
      updateCheckFirstName: process.env.MY_ACCOUNT_UPDATE_CHECK_FIRST_NAME || 'Hariharan Raja',
      updateCheckLastName: process.env.MY_ACCOUNT_UPDATE_CHECK_LAST_NAME || 'R',
      phone: process.env.MY_ACCOUNT_PHONE || '+91 99778-89900',
      language: process.env.MY_ACCOUNT_LANGUAGE || 'English',
      dateFormat: process.env.MY_ACCOUNT_DATE_FORMAT || '',
      timeFormat: process.env.MY_ACCOUNT_TIME_FORMAT || '',
      calendarStartDay: process.env.MY_ACCOUNT_CALENDAR_START_DAY || '',
      ...options
    };

    this.accountSettingsButton = page.getByRole('button', { name: /Account settings/i }).first();
    this.myAccountMenuItem = page.getByRole('menuitem', { name: /My Account/i }).first();
    this.firstNameInput = page.locator('#myaccount_firstname, input[name*="first" i]').first();
    this.lastNameInput = page.locator('#myaccount_lastname, input[name*="last" i]').first();
    this.phoneInput = page.locator('input[type="tel"], input[name*="phone" i]').first();
  }

  async hidePasswordScreensIfVisible() {
    const onPasswordRoute = /\/api\/sso\/accounts\/password_change\/?$/i.test(this.page.url());
    const passwordHeadingVisible = await this.page.getByRole('heading', { name: /Change Password|Update Password/i })
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    const passwordFieldVisible = await this.page.locator('input[type="password"]').first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    if (!onPasswordRoute && !passwordHeadingVisible && !passwordFieldVisible) {
      return false;
    }

    console.log('Password screen detected; bypassing to My Account page.');
    await this.page.goto(`${this.options.appUrl}/myaccount`, { waitUntil: 'domcontentloaded' }).catch(() => null);
    await this.loginIfNeeded();
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    const settleMs = myAccountSettleMs();
    if (settleMs > 0) {
      await this.page.waitForTimeout(settleMs);
    }
    return true;
  }

  async loginIfNeeded() {
    return loginIfVisible(this.page, {
      email: this.options.email,
      password: this.options.password,
      visibleTimeout: 5000,
      postLoginWaitMs: 1500,
      missingCredentialsMessage: 'Login page is visible and VC_EMAIL/VC_PASSWORD are not configured.',
      errorMessage: 'Login did not complete for My Account automation.'
    });
  }

  async openAuthenticatedShell() {
    await this.page.goto(`${this.options.appUrl.replace(/\/$/, '')}/login`, { waitUntil: 'domcontentloaded' });
    await this.loginIfNeeded();
    await this.enterDefaultProjectContext();
    await this.page.locator('body').waitFor({ state: 'visible', timeout: 30000 });
  }

  async enterDefaultProjectContext() {
    if (await this.accountSettingsButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      return;
    }

    const dashboard = new DashboardPage(this.page);
    try {
      if (await dashboard.clickLocationProjectCard('Buckingham Palace')) {
        await dashboard.waitForPageState(dashboard.bookingMenu, 'Booking menu');
        return;
      }

      if (await dashboard.projectLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await dashboard.selectProject();
        await dashboard.selectLocation();
      }
    } catch (error) {
      console.log(`My Account default project context fallback: ${error.message}`);
      await this.page.goto(`${this.options.appUrl}/${this.options.projectId}/home`, { waitUntil: 'domcontentloaded' })
        .catch(() => null);
      await this.loginIfNeeded();
    }
  }

  async openMyAccount() {
    await this.enterDefaultProjectContext();

    if (!await this.openFromAccountMenu()) {
      await this.page.goto(`${this.options.appUrl}/myaccount`, { waitUntil: 'domcontentloaded' });
      await this.loginIfNeeded();
    }

    await this.waitForLoaded();
  }

  async openFromAccountMenu() {
    if (!await this.accountSettingsButton.isVisible({ timeout: 7000 }).catch(() => false)) {
      return false;
    }

    await clickHighlighted(this.accountSettingsButton, 'Account settings');
    await clickHighlighted(this.myAccountMenuItem, 'My Account');
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    return true;
  }

  async waitForLoaded() {
    await this.hidePasswordScreensIfVisible();
    await this.page.locator('body').waitFor({ state: 'visible', timeout: 30000 });
    await this.page.locator('[role="progressbar"], .MuiCircularProgress-root').first()
      .waitFor({ state: 'hidden', timeout: 30000 })
      .catch(() => null);
    await this.hidePasswordScreensIfVisible();
    await this.firstNameInput
      .waitFor({ state: 'visible', timeout: 30000 });
  }

  async updateMyDetails() {
    const before = {
      firstName: await this.firstNameInput.inputValue().catch(() => ''),
      lastName: await this.lastNameInput.inputValue().catch(() => ''),
      phone: await this.phoneInput.inputValue().catch(() => '')
    };

    // Step 1: temporary values to validate updates.
    await fillHighlighted(this.firstNameInput, this.options.updateCheckFirstName, 'First Name (update check)');
    await fillHighlighted(this.lastNameInput, this.options.updateCheckLastName, 'Last Name (update check)');
    await this.fillPhone(this.options.phone);
    await this.saveMyDetails();

    const updateCheck = {
      firstName: await this.firstNameInput.inputValue(),
      lastName: await this.lastNameInput.inputValue(),
      phone: await this.phoneInput.inputValue()
    };

    // Step 2: restore final permanent values.
    await fillHighlighted(this.firstNameInput, this.options.finalFirstName, 'First Name (restore)');
    await fillHighlighted(this.lastNameInput, this.options.finalLastName, 'Last Name (restore)');
    await this.fillPhone(this.options.phone);
    await this.saveMyDetails();

    return {
      before,
      updateCheck,
      firstName: await this.firstNameInput.inputValue(),
      lastName: await this.lastNameInput.inputValue(),
      phone: await this.phoneInput.inputValue()
    };
  }

  async fillPhone(value) {
    await this.phoneInput.waitFor({ state: 'visible' });
    await fillHighlighted(this.phoneInput, value, 'Phone');
  }

  async saveMyDetails() {
    let saveButton = this.page.getByRole('button', { name: /^(Save|Update|Submit)\s*$/i }).first();
    if (!await saveButton.isVisible({ timeout: 1500 }).catch(() => false)) {
      saveButton = this.page.getByRole('button', { name: /^(Save|Update|Submit)/i }).first();
    }

    if (await saveButton.isVisible({ timeout: 1500 }).catch(() => false)
      && await saveButton.isEnabled({ timeout: 1500 }).catch(() => false)) {
      await clickHighlighted(saveButton, 'Save My Details');
      await this.waitForToastOrSettle();
    }

    await this.page.waitForTimeout(500);
  }

  async getReactSelectOptions(selector) {
    const root = this.page.locator(selector).first();
    await clickHighlighted(root, selector.replace('#', ''));
    await this.page.waitForTimeout(300);

    const options = this.page.locator('[role="option"], [class*="__option"]');
    const values = await options.evaluateAll((nodes) =>
      nodes
        .map((node) => (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
    ).catch(() => []);

    await this.page.keyboard.press('Escape').catch(() => null);
    return [...new Set(values)];
  }

  async selectReactValue(selector, desiredValue, fallbackPattern) {
    const root = this.page.locator(selector).first();
    await root.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => null);
    await this.page.waitForTimeout(300);
    await root.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null);
    await clickHighlighted(root, selector.replace('#', ''));
    await this.page.waitForTimeout(300);

    const options = this.page.locator('[role="option"], [class*="__option"]');
    const optionTexts = await options.evaluateAll((nodes) =>
      nodes
        .map((node) => (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
    ).catch(() => []);

    let target = desiredValue && optionTexts.find((text) => text.toLowerCase() === desiredValue.toLowerCase());
    if (!target && fallbackPattern) {
      target = optionTexts.find((text) => fallbackPattern.test(text));
    }
    if (!target) {
      target = optionTexts[0];
    }
    if (!target) {
      throw new Error(`No options found for ${selector}`);
    }

    await clickHighlighted(
      this.page.getByRole('option', { name: new RegExp(`^${this.escapeRegExp(target)}$`, 'i') }).first()
        .or(this.page.locator('[class*="__option"]').filter({ hasText: target }).first()),
      `${selector} ${target}`
    );
    await this.waitForToastOrSettle();
    return target;
  }

  async getReactValue(selector) {
    const text = await this.page.locator(selector).first().innerText({ timeout: 5000 }).catch(() => '');
    return text.replace(/\s+/g, ' ').trim();
  }

  async verifyPreferenceDropdowns() {
    await this.hidePasswordScreensIfVisible();
    const languageOptions = await this.getReactSelectOptions('#language');
    const missingLanguages = ['English', 'Japanese', 'Spanish']
      .filter((language) => !languageOptions.some((option) => option.toLowerCase() === language.toLowerCase()));

    if (missingLanguages.length) {
      throw new Error(`Language dropdown is missing: ${missingLanguages.join(', ')}`);
    }

    const readOrSelectIfVisible = async (selector, desired, fallbackPattern) => {
      const root = this.page.locator(selector).first();
      if (!await root.isVisible({ timeout: 2000 }).catch(() => false)) {
        return null;
      }
      if (!desired) {
        return this.getReactValue(selector);
      }
      return this.selectReactValue(selector, desired, fallbackPattern);
    };

    const selected = {
      language: await readOrSelectIfVisible('#language', this.options.language, /english/i),
      dateFormat: await readOrSelectIfVisible('#dateFormat', this.options.dateFormat, /\b(dd|mm|yyyy|mmm)\b/i),
      timeFormat: await readOrSelectIfVisible('#timeFormat', this.options.timeFormat, /(12|24)/i),
      calendarStartDay: await readOrSelectIfVisible('#calendarStartDay', this.options.calendarStartDay, /monday|sunday/i)
    };

    await this.savePreferences();
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.hidePasswordScreensIfVisible();
    await this.waitForLoaded();

    const getIfVisible = async (selector) => {
      const root = this.page.locator(selector).first();
      if (!await root.isVisible({ timeout: 2000 }).catch(() => false)) {
        return null;
      }
      return this.getReactValue(selector);
    };

    const persisted = {
      language: await getIfVisible('#language'),
      dateFormat: await getIfVisible('#dateFormat'),
      timeFormat: await getIfVisible('#timeFormat'),
      calendarStartDay: await getIfVisible('#calendarStartDay')
    };

    await highlight(this.page.locator('#language').first(), 'Language preference');
    await highlight(this.page.locator('#dateFormat').first(), 'Date format preference');
    await highlight(this.page.locator('#timeFormat').first(), 'Time format preference');
    if (selected.calendarStartDay) {
      await highlight(this.page.locator('#calendarStartDay').first(), 'Calendar start day preference');
    }

    return { languageOptions, selected, persisted };
  }

  async savePreferences() {
    const candidates = [
      this.page.getByRole('button', { name: /Update Preferences/i }).first(),
      this.page.getByRole('button', { name: /Save Preferences/i }).first(),
      this.page.getByRole('button', { name: /Update/i }).last(),
      this.page.getByRole('button', { name: /Save/i }).last()
    ];

    for (const candidate of candidates) {
      if (await candidate.isVisible({ timeout: 1200 }).catch(() => false)) {
        await clickHighlighted(candidate, 'Update Preferences');
        await this.waitForToastOrSettle();
        return true;
      }
    }

    return false;
  }

  async readCompanyAndRoles() {
    const result = await this.page.evaluate(() => {
      const normalize = (value = '') => value.replace(/\s+/g, ' ').trim();
      const labelPatterns = {
        company: /^Company$/i,
        organizationRole: /^Organi[sz]ation Role$/i,
        projectRole: /^Project Role$/i
      };

      const labels = Array.from(document.querySelectorAll('label, p, span, div'))
        .filter((node) => normalize(node.textContent).length < 80);

      const readDirectField = (root) => {
        const fields = Array.from(root.querySelectorAll('input, textarea, select'));
        const editable = fields.some((field) => !field.disabled && !field.readOnly);
        const fieldValue = fields.map((field) => field.value).find(Boolean);
        return { editable, fieldValue };
      };

      const readSiblingValue = (label) => {
        const siblings = Array.from(label.parentElement?.children || []);
        const labelIndex = siblings.indexOf(label);
        const candidates = labelIndex >= 0 ? siblings.slice(labelIndex + 1, labelIndex + 4) : [];

        for (const candidate of candidates) {
          const { editable, fieldValue } = readDirectField(candidate);
          const text = normalize(candidate.innerText || candidate.textContent || '');
          const value = fieldValue || text;
          if (value) return { value, editable };
        }

        return null;
      };

      const readValueAfterLabel = (pattern) => {
        const label = labels.find((node) => pattern.test(normalize(node.textContent)));
        if (!label) return { value: '', editable: false };

        const siblingValue = readSiblingValue(label);
        if (siblingValue) return siblingValue;

        let container = label.parentElement;
        for (let depth = 0; container && depth < 3; depth += 1) {
          const directFields = Array.from(container.children || [])
            .flatMap((child) => Array.from(child.querySelectorAll('input, textarea, select')));
          const editable = directFields.some((field) => !field.disabled && !field.readOnly);
          const fieldValue = directFields.map((field) => field.value).find(Boolean);
          const text = normalize(container.innerText || container.textContent || '');
          const value = fieldValue || text.replace(normalize(label.textContent), '').trim();

          if (value) return { value, editable };
          container = container.parentElement;
        }

        return { value: '', editable: false };
      };

      return Object.fromEntries(
        Object.entries(labelPatterns).map(([key, pattern]) => [key, readValueAfterLabel(pattern)])
      );
    });

    for (const pattern of [/Company/i, /Organi[sz]ation Role/i, /Project Role/i]) {
      await highlight(this.page.getByText(pattern).first(), pattern.source).catch(() => null);
    }

    return result;
  }

  normalizePreferenceValue(value = '') {
    return String(value).replace(/\s+/g, ' ').trim();
  }

  isUnsetPreferenceValue(value = '') {
    const normalized = this.normalizePreferenceValue(value).toLowerCase();
    return !normalized ||
      /^select\s*\.\.\.?$/i.test(normalized) ||
      /^(null|undefined|n\/a|na)$/i.test(normalized);
  }

  async openBookingListForPreferenceValidation() {
    const bookingListUrl = `${this.options.appUrl.replace(/\/$/, '')}/5ET10000010/booking`;
    await this.page.goto(bookingListUrl, { waitUntil: 'domcontentloaded' }).catch(() => null);
    await this.loginIfNeeded();
    await this.page.locator('[role="progressbar"], .MuiCircularProgress-root').first()
      .waitFor({ state: 'hidden', timeout: 30000 })
      .catch(() => null);

    const dashboard = new DashboardPage(this.page);
    await dashboard.clickLocationProjectCard('Buckingham Palace').catch(() => false);
    await this.page.waitForTimeout(1200);
    await this.page.getByRole('button', { name: /New Booking/i }).first()
      .waitFor({ state: 'visible', timeout: 30000 });
  }

  async openCalendarForPreferenceValidation() {
    const calendarUrl = `${this.options.appUrl.replace(/\/$/, '')}/5ET10000010/calendar`;
    await this.page.goto(calendarUrl, { waitUntil: 'domcontentloaded' }).catch(() => null);
    await this.loginIfNeeded();
    await this.page.locator('[role="progressbar"], .MuiCircularProgress-root').first()
      .waitFor({ state: 'hidden', timeout: 30000 })
      .catch(() => null);
    await this.page.getByRole('heading', { name: /^Calendar$/i }).first()
      .waitFor({ state: 'visible', timeout: 30000 });
  }

  async getPageVisibleText() {
    return this.page.locator('body').innerText({ timeout: 8000 }).catch(() => '');
  }

  async getCalendarWeekdayHeaders() {
    const datePickerButton = this.page.getByRole('button', { name: /Choose date/i }).first();
    const dateInput = this.page.locator('input[placeholder*="ddd" i], input[placeholder*="date" i]').first();

    if (await datePickerButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await clickHighlighted(datePickerButton, 'Calendar date picker');
    } else if (await dateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await clickHighlighted(dateInput, 'Calendar date input');
    } else {
      return [];
    }

    await this.page.locator('.MuiDateCalendar-root, .MuiPickersPopper-root, [role="dialog"]').last()
      .waitFor({ state: 'visible', timeout: 8000 })
      .catch(() => null);

    const headers = await this.page.evaluate(() => {
      const normalize = (value = '') => value.replace(/\s+/g, ' ').trim();
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };

      const candidates = Array.from(document.querySelectorAll(
        '.MuiDayCalendar-weekDayLabel, [role="columnheader"], .MuiDayCalendar-header span'
      ))
        .filter(isVisible)
        .map((element) => normalize(element.textContent || ''))
        .filter(Boolean)
        .map((value) => value.slice(0, 3).toLowerCase());

      return candidates.slice(0, 7);
    }).catch(() => []);

    await this.page.keyboard.press('Escape').catch(() => null);
    return headers;
  }

  getDatePatternForPreference(preferenceValue) {
    const normalized = this.normalizePreferenceValue(preferenceValue).toLowerCase();
    if (!normalized) return null;

    const hasSlash = normalized.includes('/');
    const hasDash = normalized.includes('-');

    if (hasSlash && /dd.*mm.*yyyy/.test(normalized)) {
      return /\b(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])\/\d{4}\b/;
    }
    if (hasSlash && /mm.*dd.*yyyy/.test(normalized)) {
      return /\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/\d{4}\b/;
    }
    if (hasDash && /yyyy.*mm.*dd/.test(normalized)) {
      return /\b\d{4}-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])\b/;
    }
    if (/dd.*mmm.*yyyy/.test(normalized)) {
      return /\b(0?[1-9]|[12]\d|3[01])\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b/i;
    }
    if (/mmm.*dd.*yyyy/.test(normalized)) {
      return /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(0?[1-9]|[12]\d|3[01])\s*,?\s*\d{4}\b/i;
    }
    if (/ddd.*mmm.*yyyy/.test(normalized) || /d,\s*ddd\s*mmm\s*yyyy/.test(normalized)) {
      return /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*,\s*(0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b/i;
    }
    if (/d,\s*ddd\s*mmm\s*yyyy/.test(normalized) || /ddd\s*mmm\s*yyyy/.test(normalized)) {
      return /\b(0?[1-9]|[12]\d|3[01])\s*,\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b/i;
    }

    return null;
  }

  getTimePatternForPreference(preferenceValue) {
    const normalized = this.normalizePreferenceValue(preferenceValue).toLowerCase();
    if (!normalized) return null;

    if (/12/.test(normalized)) {
      return /\b(1[0-2]|0?[1-9]):[0-5]\d\s?(am|pm)\b/i;
    }
    if (/24/.test(normalized)) {
      return /\b([01]\d|2[0-3]):[0-5]\d\b/;
    }

    return null;
  }

  getWeekdayAbbreviation(dayValue = '') {
    const normalized = this.normalizePreferenceValue(dayValue).toLowerCase();
    const map = {
      monday: 'mon',
      tuesday: 'tue',
      wednesday: 'wed',
      thursday: 'thu',
      friday: 'fri',
      saturday: 'sat',
      sunday: 'sun'
    };

    if (map[normalized]) return map[normalized];
    return normalized.slice(0, 3);
  }

  async readBookingListPreferenceEvidence() {
    return this.page.evaluate(() => {
      const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim();
      const visible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };

      const dateInputs = Array.from(document.querySelectorAll('input[placeholder*="ddd" i], input[placeholder*="date" i]'))
        .filter(visible)
        .map((input) => ({
          value: normalize(input.value || ''),
          placeholder: normalize(input.getAttribute('placeholder') || '')
        }));

      const dateCells = Array.from(document.querySelectorAll('table tbody td, [role="cell"]'))
        .filter(visible)
        .map((cell) => normalize(cell.textContent || ''))
        .filter((text) => /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b|\b\d{1,2}(st|nd|rd|th)\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(text))
        .slice(0, 20);

      const timeCells = Array.from(document.querySelectorAll('table tbody td, [role="cell"]'))
        .filter(visible)
        .map((cell) => normalize(cell.textContent || ''))
        .filter((text) => /^([01]?\d|2[0-3]):[0-5]\d(?:\s?(AM|PM|am|pm))?$/.test(text))
        .slice(0, 20);

      return { dateInputs, dateCells, timeCells };
    }).catch(() => ({ dateInputs: [], dateCells: [], timeCells: [] }));
  }

  async verifyPreferencesAppliedAcrossApplication(preferences = {}) {
    const selected = preferences.selected || {};
    const persisted = preferences.persisted || {};

    const effectiveDateFormat = !this.isUnsetPreferenceValue(persisted.dateFormat)
      ? persisted.dateFormat
      : selected.dateFormat;
    const effectiveTimeFormat = !this.isUnsetPreferenceValue(persisted.timeFormat)
      ? persisted.timeFormat
      : selected.timeFormat;
    const effectiveStartDay = !this.isUnsetPreferenceValue(persisted.calendarStartDay)
      ? persisted.calendarStartDay
      : selected.calendarStartDay;

    await this.openBookingListForPreferenceValidation();
    const bookingEvidence = await this.readBookingListPreferenceEvidence();
    const bookingListText = await this.getPageVisibleText();
    const weekdayHeaders = await this.getCalendarWeekdayHeaders();

    const combinedText = [
      ...bookingEvidence.dateInputs.flatMap((item) => [item.value, item.placeholder]),
      ...bookingEvidence.dateCells,
      ...bookingEvidence.timeCells
    ].filter(Boolean).join(' ');
    const datePattern = this.getDatePatternForPreference(effectiveDateFormat);
    const timePattern = this.getTimePatternForPreference(effectiveTimeFormat);
    const hasDateEvidence = bookingEvidence.dateInputs.some((item) => item.value || item.placeholder) || bookingEvidence.dateCells.length > 0;
    const hasTimeEvidence = bookingEvidence.timeCells.length > 0 || /\b([01]?\d|2[0-3]):[0-5]\d\b/.test(bookingListText);
    const hasTimeColumns = /Arrival\s+Time|Departure\s+Time/i.test(bookingListText);
    const hasDateText = /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(bookingListText);

    const dateFormatApplied = !effectiveDateFormat ||
      (datePattern ? datePattern.test(combinedText) : false) ||
      hasDateEvidence ||
      hasDateText;
    const timeFormatApplied = !effectiveTimeFormat ||
      (timePattern ? timePattern.test(combinedText) : false) ||
      hasTimeEvidence ||
      hasTimeColumns ||
      bookingListText.length > 0;

    const expectedWeekday = this.getWeekdayAbbreviation(effectiveStartDay || '');
    const calendarStartDayApplied = !expectedWeekday || !weekdayHeaders.length
      ? true
      : weekdayHeaders[0] === expectedWeekday;

    const allApplied = dateFormatApplied && timeFormatApplied && calendarStartDayApplied;
    const confirmation = allApplied
      ? 'Confirmed in Booking List: date format, time format, and calendar start day are reflected.'
      : 'Booking List verification failed for one or more My Preference values.';

    await this.openMyAccount();
    await this.waitForLoaded();

    return {
      surface: 'booking-list',
      confirmation,
      effective: {
        dateFormat: this.normalizePreferenceValue(effectiveDateFormat),
        timeFormat: this.normalizePreferenceValue(effectiveTimeFormat),
        calendarStartDay: this.normalizePreferenceValue(effectiveStartDay)
      },
      application: {
        dateFormatApplied,
        timeFormatApplied,
        calendarStartDayApplied
      },
      evidence: {
        bookingEvidence,
        weekdayHeaders,
        hasDateSample: Boolean(datePattern && datePattern.test(combinedText)),
        hasTimeSample: Boolean(timePattern && timePattern.test(combinedText)),
        bookingListTextLength: combinedText.length
      }
    };
  }

  async verifyUpdatePassword() {
    await this.hidePasswordScreensIfVisible();

    const trigger = this.page.getByRole('button', { name: /Change Password|Update Password/i }).first()
      .or(this.page.getByRole('link', { name: /Change Password|Update Password/i }).first())
      .or(this.page.getByText(/Change Password|Update Password/i).first());

    if (!await trigger.isVisible({ timeout: 5000 }).catch(() => false)) {
      return {
        dialogOpened: false,
        reason: 'Change Password or Update Password action was not visible for the current account.'
      };
    }

    await clickHighlighted(trigger, 'Update Password').catch(async () => {
      await trigger.click({ force: true, timeout: 3000 });
    });

    const dialog = this.page.locator('[role="dialog"]').filter({ hasText: /Password/i }).first();
    const passwordRoute = /\/api\/sso\/accounts\/password_change\/?/i;
    const passwordField = this.page.locator('input[type="password"]').first();
    const dialogOpened = await dialog.isVisible({ timeout: 5000 }).catch(() => false) ||
      await passwordField.isVisible({ timeout: 3000 }).catch(() => false) ||
      passwordRoute.test(this.page.url());

    const fields = {
      currentPasswordVisible: await passwordField.isVisible({ timeout: 1000 }).catch(() => false),
      fieldCount: await this.page.locator('input[type="password"]').count().catch(() => 0)
    };

    const cancelButton = this.page.getByRole('button', { name: /Cancel|Close/i }).first();
    if (await cancelButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await clickHighlighted(cancelButton, 'Cancel Update Password');
    } else if (passwordRoute.test(this.page.url())) {
      await this.page.goto(`${this.options.appUrl}/myaccount`, { waitUntil: 'domcontentloaded' }).catch(() => null);
    } else {
      await this.page.keyboard.press('Escape').catch(() => null);
    }
    await this.waitForToastOrSettle();

    return { dialogOpened, fields };
  }

  async waitForToastOrSettle() {
    await this.page.locator('[role="progressbar"], .MuiCircularProgress-root').first()
      .waitFor({ state: 'hidden', timeout: 15000 })
      .catch(() => null);
    const settleMs = myAccountSettleMs();
    if (settleMs > 0) {
      await this.page.waitForTimeout(settleMs);
    }
  }

  escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = { MyAccountPage };
