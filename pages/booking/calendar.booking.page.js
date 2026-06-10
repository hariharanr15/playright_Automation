const { chromium } = require('playwright');
const { clickHighlighted } = require('../../utils/highlight');

class CalendarBookingPage {
  constructor(page, options = {}) {
    this.page = page;
    this.options = {
      appUrl: process.env.APP_URL || 'https://stg-app.voyagecontrol.com',
      projectId: process.env.PROJECT_ID || '5ET10000010',
      checkboxRatio: 0.7,
      ...options
    };

    this.calendarHeading = page.getByRole('heading', { name: /^Calendar$/i }).first();
    this.scopeDropdown = page.locator('[role="combobox"]').filter({ hasText: /All Project Bookings|My Bookings/i }).first();
    this.filterButton = page.getByRole('button', { name: /^Filter/i }).first();
    this.dateInput = page.locator('input[placeholder="d, ddd mmm yyyy"]').first();
    this.datePickerButton = page.getByRole('button', { name: /Choose date/i }).first();
  }

  async waitForCalendarPage() {
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    await this.calendarHeading.waitFor({ state: 'visible', timeout: 30000 });
    await this.scopeDropdown.waitFor({ state: 'visible', timeout: 30000 });
    await this.waitForCalendarToSettle();
  }

  async waitForCalendarToSettle() {
    await this.page
      .locator('[role="progressbar"], .MuiCircularProgress-root')
      .first()
      .waitFor({ state: 'hidden', timeout: 30000 })
      .catch(() => null);
    await this.page.waitForTimeout(2000);
  }

  async navigateToCalendar() {
    const targetUrl = `${this.options.appUrl.replace(/\/$/, '')}/${this.options.projectId}/calendar`;
    await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await this.waitForCalendarPage();
  }

  async selectBookingScope(scopeName = 'All Project Bookings') {
    if (!(await this.scopeDropdown.isVisible({ timeout: 10000 }).catch(() => false))) {
      throw new Error('Calendar booking scope dropdown was not visible.');
    }

    const currentText = (await this.scopeDropdown.innerText().catch(() => '')).trim();
    if (new RegExp(`^${this.escapeRegex(scopeName)}$`, 'i').test(currentText)) {
      return { changed: false, value: currentText };
    }

    await clickHighlighted(this.scopeDropdown, 'Booking scope');
    const option = this.page.getByRole('option', { name: scopeName, exact: true }).first();
    if (await option.isVisible({ timeout: 5000 }).catch(() => false)) {
      await clickHighlighted(option, scopeName);
      await this.waitForCalendarToSettle();
      return { changed: true, value: scopeName };
    }

    await this.page.keyboard.press('Escape').catch(() => null);
    return { changed: false, value: currentText || null, reason: `${scopeName} option was not visible.` };
  }

  async selectAllFromSecondaryDropdown() {
    const comboboxes = this.page.locator('[role="combobox"]');
    const count = await comboboxes.count();

    for (let index = 0; index < count; index += 1) {
      const combobox = comboboxes.nth(index);
      if (!(await combobox.isVisible({ timeout: 1000 }).catch(() => false))) continue;

      const text = (await combobox.innerText().catch(() => '')).trim();
      if (/Buckingham Palace|All Project Bookings|My Bookings/i.test(text)) continue;

      await clickHighlighted(combobox, 'Secondary dropdown');
      const allOption = this.page.getByRole('option', { name: /^All$/i }).first();
      if (await allOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await clickHighlighted(allOption, 'All');
        await this.waitForCalendarToSettle();
        return { selected: true, dropdownText: text };
      }
      await this.page.keyboard.press('Escape').catch(() => null);
    }

    return { selected: false, reason: 'No secondary dropdown with an All option was available on this Calendar view.' };
  }

  async selectCalendarMode(modeName = 'Calendar') {
    const modeButton = this.page.getByLabel(modeName, { exact: true }).first();
    if (await modeButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clickHighlighted(modeButton, `${modeName} mode`);
      await this.waitForCalendarToSettle();
      return true;
    }

    const textButton = this.page.getByText(modeName, { exact: true }).first();
    if (await textButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clickHighlighted(textButton, `${modeName} mode`);
      await this.waitForCalendarToSettle();
      return true;
    }

    return false;
  }

  async selectCalendarPeriod(periodName = 'Week') {
    const periodButton = this.page.getByRole('button', { name: new RegExp(`^${this.escapeRegex(periodName)}$`, 'i') }).first();
    if (await periodButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clickHighlighted(periodButton, periodName);
      await this.waitForCalendarToSettle();
      return true;
    }

    return false;
  }

  async setCalendarCheckbox(label, checked = true) {
    const control = this.page.getByLabel(new RegExp(`^${this.escapeRegex(label)}$`, 'i')).first();
    if (!(await control.isVisible({ timeout: 3000 }).catch(() => false))) {
      return false;
    }

    const isChecked = await control.isChecked().catch(() => false);
    if (isChecked !== checked) {
      await clickHighlighted(control, label);
      await this.waitForCalendarToSettle();
    }

    return true;
  }

  async openFilterPanelIfAvailable() {
    if (!(await this.filterButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      return false;
    }

    await clickHighlighted(this.filterButton, 'Filter');
    await this.page.waitForTimeout(1500);

    const panelSignals = [
      this.page.getByRole('button', { name: /Apply Filters/i }).first(),
      this.page.getByRole('tab').first(),
      this.page.locator('input[type="checkbox"]').nth(2)
    ];

    for (const signal of panelSignals) {
      if (await signal.isVisible({ timeout: 1000 }).catch(() => false)) {
        return true;
      }
    }

    return false;
  }

  async applyFilterIconAndCheckboxTabs(ratio = this.options.checkboxRatio) {
    const filterPanelOpened = await this.openFilterPanelIfAvailable();
    const selections = [];

    if (filterPanelOpened) {
      const tabNames = await this.getVisibleFilterTabNames();
      if (tabNames.length > 0) {
        for (const tabName of tabNames) {
          await this.openFilterTab(tabName);
          selections.push(await this.selectCheckboxPercentInCurrentPanel(tabName, ratio));
        }
      } else {
        selections.push(await this.selectCheckboxPercentInCurrentPanel('Calendar filters', ratio));
      }

      const applyButton = this.page.getByRole('button', { name: /Apply Filters/i }).first();
      if (await applyButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await clickHighlighted(applyButton, 'Apply Filters');
      }
    } else {
      selections.push({
        tabName: 'Calendar quick filters',
        available: 2,
        selected: Number(await this.setCalendarCheckbox('Show weekends', true)) +
          Number(await this.setCalendarCheckbox('Show canceled and declined bookings', true)),
        target: 2,
        note: 'Calendar did not expose a checkbox filter drawer; used visible quick filter controls.'
      });
      if (await this.filterButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await clickHighlighted(this.filterButton, 'Apply Calendar filter');
      }
    }

    await this.waitForCalendarToSettle();
    return selections;
  }

  async getVisibleFilterTabNames() {
    return this.page.locator('[role="tab"]').evaluateAll((tabs) => {
      const visible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };

      return tabs
        .filter(visible)
        .map((tab) => (tab.innerText || tab.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    }).catch(() => []);
  }

  async openFilterTab(tabName) {
    const tab = this.page.getByRole('tab', { name: new RegExp(`^${this.escapeRegex(tabName)}$`, 'i') }).first();
    if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await clickHighlighted(tab, `${tabName} tab`);
      await this.page.waitForTimeout(500);
      return true;
    }

    return false;
  }

  async selectCheckboxPercentInCurrentPanel(tabName, ratio = 0.7) {
    const checkboxes = this.page.locator('.filtercheck-item input[type="checkbox"]');
    const available = await checkboxes.count();
    const target = available === 0
      ? 0
      : Math.max(1, Math.round(available * ratio));

    for (let index = 0; index < available; index += 1) {
      const selectedCount = await checkboxes.evaluateAll((elements) => elements.filter((checkbox) => checkbox.checked).length);
      if (selectedCount >= target) break;

      const checkbox = checkboxes.nth(index);
      if (await checkbox.isChecked().catch(() => false)) continue;

      await checkbox.click({ force: true });
      await this.page.waitForTimeout(250);
    }

    const selected = await checkboxes.evaluateAll((elements) => elements.filter((checkbox) => checkbox.checked).length);

    return {
      tabName,
      available,
      selected,
      target
    };
  }

  async selectDateRangeBasedOnDataAvailability() {
    const visibleDates = await this.getVisibleCalendarDates();
    const parsedDates = visibleDates.map((dateText) => this.parseVisibleCalendarDate(dateText)).filter(Boolean);

    if (parsedDates.length === 0) {
      const fallbackDate = new Date();
      await this.selectDateUsingDatePicker(fallbackDate);
      return { visibleDates, startDate: fallbackDate, endDate: fallbackDate, selectedDate: fallbackDate };
    }

    const startDate = parsedDates[0];
    const endDate = parsedDates[parsedDates.length - 1];
    const selectedDate = parsedDates[Math.floor(parsedDates.length / 2)];

    await this.selectDateUsingDatePicker(selectedDate);
    return { visibleDates, startDate, endDate, selectedDate };
  }

  async getVisibleCalendarDates() {
    return this.page.evaluate(() => {
      const text = document.body.innerText || '';
      return Array.from(new Set(
        text.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+\d+(?:st|nd|rd|th)\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/g) || []
      ));
    });
  }

  parseVisibleCalendarDate(dateText) {
    const match = dateText.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+(\d+)(?:st|nd|rd|th)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/);
    if (!match) return null;

    const monthIndex = {
      Jan: 0,
      Feb: 1,
      Mar: 2,
      Apr: 3,
      May: 4,
      Jun: 5,
      Jul: 6,
      Aug: 7,
      Sep: 8,
      Oct: 9,
      Nov: 10,
      Dec: 11
    }[match[3]];

    return new Date(Number(match[4]), monthIndex, Number(match[2]));
  }

  async chooseDateWithAvailableData() {
    const dateRange = await this.selectDateRangeBasedOnDataAvailability();
    return dateRange.selectedDate;
  }

  parseCalendarHeader(headerText) {
    const match = headerText.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})$/i);
    if (!match) return null;

    const monthIndex = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11
    }[match[1].slice(0, 3).toLowerCase()];

    return { monthIndex, year: Number(match[2]) };
  }

  async navigateDatePickerToMonth(targetDate) {
    const header = this.page.locator('.MuiPickersCalendarHeader-label').first();
    await header.waitFor({ state: 'visible', timeout: 10000 });

    for (let attempt = 0; attempt < 24; attempt += 1) {
      const headerDate = this.parseCalendarHeader((await header.innerText()).trim());
      if (!headerDate) break;

      const monthDelta = ((targetDate.getFullYear() - headerDate.year) * 12) +
        (targetDate.getMonth() - headerDate.monthIndex);
      if (monthDelta === 0) return;

      const navigationButton = monthDelta > 0
        ? this.page.getByRole('button', { name: /^Next/i }).first()
        : this.page.getByRole('button', { name: /^Previous/i }).first();

      await clickHighlighted(navigationButton, monthDelta > 0 ? 'Next month' : 'Previous month');
      await this.page.waitForTimeout(300);
    }

    throw new Error(`Could not navigate date picker to ${targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.`);
  }

  async selectDateUsingDatePicker(date) {
    if (await this.datePickerButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clickHighlighted(this.datePickerButton, 'Calendar date picker');
    } else {
      await clickHighlighted(this.dateInput, 'Calendar date input');
    }

    await this.navigateDatePickerToMonth(date);
    await clickHighlighted(
      this.page.getByRole('gridcell', { name: String(date.getDate()), exact: true }).first(),
      `Calendar day ${date.getDate()}`
    );
    await this.waitForCalendarToSettle();
  }

  async navigateRecords(direction) {
    const clicked = await this.page.evaluate((targetDirection) => {
      const visible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.pointerEvents !== 'none' &&
          !element.disabled;
      };

      const candidates = Array.from(document.querySelectorAll('button, [role="button"]'))
        .filter(visible)
        .map((element) => ({ element, rect: element.getBoundingClientRect(), text: element.innerText || element.textContent || element.getAttribute('aria-label') || '' }))
        .filter((candidate) => candidate.rect.y > 250 && candidate.rect.y < 340 && candidate.rect.width <= 60 && candidate.rect.x > window.innerWidth * 0.55)
        .sort((left, right) => left.rect.x - right.rect.x);

      const target = targetDirection === 'previous' ? candidates[0] : candidates[candidates.length - 1];
      if (!target) return false;

      target.element.click();
      return true;
    }, direction);

    if (!clicked) {
      throw new Error(`Could not find Calendar ${direction} navigation arrow.`);
    }

    await this.waitForCalendarToSettle();
  }

  async countVisibleCalendarRecords() {
    return this.page.evaluate(() => {
      const text = document.body.innerText || '';
      const bookingTypeMatches = text.match(/\b(Delivery|Recurring|Resource-Only|Multi-Vehicle)\b/g) || [];
      return bookingTypeMatches.length;
    });
  }

  async runCodegenCalendarFlow(options = {}) {
    await this.navigateToCalendar();
    const scope = await this.selectBookingScope(options.scopeName || 'All Project Bookings');
    const secondaryDropdown = await this.selectAllFromSecondaryDropdown();
    await this.selectCalendarMode(options.modeName || 'Calendar');
    await this.selectCalendarPeriod(options.periodName || 'Week');

    const filterSelections = await this.applyFilterIconAndCheckboxTabs(options.checkboxRatio || this.options.checkboxRatio);
    const selectedDateRange = await this.selectDateRangeBasedOnDataAvailability();
    const recordCountAfterDate = await this.countVisibleCalendarRecords();

    await this.navigateRecords('previous');
    const recordCountAfterPrevious = await this.countVisibleCalendarRecords();
    await this.navigateRecords('next');
    const recordCountAfterNext = await this.countVisibleCalendarRecords();

    return {
      scope,
      secondaryDropdown,
      filterSelections,
      selectedDateRange,
      recordCountAfterDate,
      recordCountAfterPrevious,
      recordCountAfterNext,
      visibleDates: await this.getVisibleCalendarDates()
    };
  }

  escapeRegex(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = { CalendarBookingPage };

if (require.main === module) {
  (async () => {
    const browser = await chromium.launch({
      channel: 'chrome',
      headless: process.argv.includes('--headless')
    });
    const context = await browser.newContext({
      storageState: 'auth.json',
      ignoreHTTPSErrors: true,
      viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();

    try {
      const calendar = new CalendarBookingPage(page);
      const result = await calendar.runCodegenCalendarFlow();
      console.log(JSON.stringify(result, null, 2));
    } finally {
      await context.close().catch(() => null);
      await browser.close().catch(() => null);
    }
  })().catch((error) => {
    console.error(`Calendar codegen flow failed: ${error.message}`);
    process.exit(1);
  });
}
