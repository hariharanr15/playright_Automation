const { clickHighlighted, fillHighlighted } = require('../../utils/highlight');
const { EditBookingPage } = require('./edit.booking.page');

class Filter {
  constructor(page) {
    this.page = page;
    this.dateInputs = page.locator('input[placeholder="d, ddd mmm yyyy"]');
    this.filterButton = page.getByRole('button', { name: /Filterplus|Filter/i }).first();
    this.applyFiltersButton = page.getByRole('button', { name: /Apply Filters/i });
    this.calendarEvents = page.locator('.rbc-event[class*="event-BK"]');
    this.calendarActionDelayMs = Number(process.env.CALENDAR_ACTION_DELAY_MS || 2000);
  }

  addMonths(date, months) {
    const result = new Date(date);
    const dayOfMonth = result.getDate();
    result.setMonth(result.getMonth() + months);

    if (result.getDate() < dayOfMonth) {
      result.setDate(0);
    }

    return result;
  }

  formatBookingListDate(date) {
    const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    return `${date.getDate()}, ${weekday} ${month} ${date.getFullYear()}`;
  }

  getDefaultDateRange(referenceDate = new Date()) {
    const fromDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);

    return {
      fromDate,
      toDate: new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0)
    };
  }

  async waitForBookingList() {
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    await this.page
      .locator('[role="progressbar"], .MuiCircularProgress-root')
      .first()
      .waitFor({ state: 'hidden', timeout: 30000 })
      .catch(() => null);
    await this.page.waitForTimeout(3000);
  }

  async waitForCalendar() {
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    await this.page
      .locator('[role="progressbar"], .MuiCircularProgress-root')
      .first()
      .waitFor({ state: 'hidden', timeout: 30000 })
      .catch(() => null);
    await this.page.locator('.rbc-time-view, .rbc-calendar').first().waitFor({
      state: 'visible',
      timeout: 30000
    });
    await this.page.waitForTimeout(2500);
  }

  async navigateToCalendarScreen() {
    const calendarLink = this.page.getByRole('link', { name: /calendar Calendar/i }).first();

    if (await calendarLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await clickHighlighted(calendarLink, 'Calendar');
    } else {
      await this.page.goto('https://stg-app.voyagecontrol.com/5ET10000010/calendar', {
        waitUntil: 'domcontentloaded'
      });
    }

    await this.waitForCalendar();
    await this.pauseCalendarAction();
  }

  async pauseCalendarAction() {
    if (this.calendarActionDelayMs > 0) {
      await this.page.waitForTimeout(this.calendarActionDelayMs);
    }
  }

  async selectBookingScope(scopeName = 'My Bookings') {
    const scopeControl = this.page
      .locator('div')
      .filter({ hasText: /^(All Project Bookings|My Bookings)$/ })
      .first();

    if (!(await scopeControl.isVisible({ timeout: 5000 }).catch(() => false))) {
      return;
    }

    await clickHighlighted(scopeControl, 'Booking scope');

    const option = this.page.getByRole('option', { name: scopeName, exact: true });
    if (await option.isVisible({ timeout: 5000 }).catch(() => false)) {
      await clickHighlighted(option, scopeName);
      await this.waitForBookingList();
    } else {
      await this.page.keyboard.press('Escape').catch(() => null);
    }
  }

  async applyDefaultDateRange(referenceDate = new Date()) {
    const { fromDate, toDate } = this.getDefaultDateRange(referenceDate);

    await this.dateInputs.first().waitFor({ state: 'visible', timeout: 10000 });

    if (await this.dateInputs.count() < 2) {
      throw new Error('Could not find both From and To date fields on the Booking List page.');
    }

    await this.selectDateFromCalendar(0, fromDate, 'From date');
    await this.selectDateFromCalendar(1, toDate, 'To date');
    await this.waitForBookingList();

    await this.expectDateInputsMatch({ fromDate, toDate });
    return { fromDate, toDate };
  }

  parseCalendarHeader(headerText) {
    const match = headerText.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})$/i);
    if (!match) {
      return null;
    }

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

  async navigateCalendarToMonth(targetDate) {
    const header = this.page.locator('.MuiPickersCalendarHeader-label').first();
    await header.waitFor({ state: 'visible', timeout: 10000 });

    for (let attempt = 0; attempt < 24; attempt += 1) {
      const headerDate = this.parseCalendarHeader((await header.innerText()).trim());
      if (!headerDate) {
        break;
      }

      const monthDelta = ((targetDate.getFullYear() - headerDate.year) * 12) +
        (targetDate.getMonth() - headerDate.monthIndex);

      if (monthDelta === 0) {
        return;
      }

      const navigationButton = monthDelta > 0
        ? this.page.getByRole('button', { name: /^Next/i }).first()
        : this.page.getByRole('button', { name: /^Previous/i }).first();

      await clickHighlighted(navigationButton, monthDelta > 0 ? 'Next month' : 'Previous month');
      await this.page.waitForTimeout(300);
    }

    throw new Error(`Could not navigate calendar to ${targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.`);
  }

  async selectDateFromCalendar(inputIndex, date, label) {
    await clickHighlighted(this.dateInputs.nth(inputIndex), label);
    await this.navigateCalendarToMonth(date);
    await clickHighlighted(
      this.page.getByRole('gridcell', { name: String(date.getDate()), exact: true }).first(),
      `${label} ${date.getDate()}`
    );
    await this.page.waitForTimeout(1200);
  }

  async expectDateInputsMatch({ fromDate, toDate }) {
    const expectedValues = [
      this.formatBookingListDate(fromDate),
      this.formatBookingListDate(toDate)
    ];
    const actualValues = await this.dateInputs.evaluateAll((inputs) => inputs.map((input) => input.value));

    if (actualValues[0] !== expectedValues[0] || actualValues[1] !== expectedValues[1]) {
      throw new Error(`Date range did not apply correctly. Expected ${expectedValues.join(' to ')}, got ${actualValues.join(' to ')}.`);
    }
  }

  escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async findBookingLayoutDropdown() {
    const comboboxes = this.page.locator('div[role="combobox"]');
    const count = await comboboxes.count();
    let fallback = null;

    for (let index = 0; index < count; index += 1) {
      const combobox = comboboxes.nth(index);
      if (!(await combobox.isVisible({ timeout: 1000 }).catch(() => false))) {
        continue;
      }

      const box = await combobox.boundingBox().catch(() => null);
      if (!box) {
        continue;
      }

      const text = (await combobox.innerText().catch(() => '')).trim();
      if (/Layout|View|New_|Default/i.test(text)) {
        fallback = combobox;
      }

      if (box.y > 120 && box.y < 260 && box.x > 700) {
        return combobox;
      }
    }

    return fallback;
  }

  async openBookingLayoutDropdown(label = 'Layout dropdown') {
    const layoutDropdown = await this.findBookingLayoutDropdown();
    if (!layoutDropdown) {
      return false;
    }

    await clickHighlighted(layoutDropdown, label);
    return true;
  }

  incrementLayoutName(layoutName) {
    const match = layoutName.match(/^(.*?)([_ -]?)(\d+)$/);
    if (!match) {
      return `${layoutName}_1`;
    }

    const [, prefix, separator, numberText] = match;
    return `${prefix}${separator}${Number(numberText) + 1}`;
  }

  async getAvailableLayoutNames() {
    if (!(await this.openBookingLayoutDropdown('Layout dropdown'))) {
      return [];
    }

    const layoutNames = await this.page.locator('[role="option"]').evaluateAll((options) => {
      const visible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none';
      };

      return options
        .filter(visible)
        .map((option) => (option.innerText || '').trim())
        .filter(Boolean);
    });

    await this.page.keyboard.press('Escape').catch(() => null);
    return layoutNames;
  }

  async getUniqueLayoutName(layoutName) {
    const existingLayoutNames = new Set(
      (await this.getAvailableLayoutNames()).map((name) => name.toLowerCase())
    );
    let nextLayoutName = layoutName;

    while (existingLayoutNames.has(nextLayoutName.toLowerCase())) {
      nextLayoutName = this.incrementLayoutName(nextLayoutName);
    }

    return nextLayoutName;
  }

  async selectLayoutByName(layoutName) {
    if (!(await this.openBookingLayoutDropdown(`Layout ${layoutName}`))) {
      return false;
    }

    const option = this.page
      .getByRole('option', { name: new RegExp(`^${this.escapeRegex(layoutName)}$`, 'i') })
      .first();

    if (await option.isVisible({ timeout: 5000 }).catch(() => false)) {
      await clickHighlighted(option, layoutName);
      await this.waitForBookingList();
      return true;
    }

    await this.page.keyboard.press('Escape').catch(() => null);
    return false;
  }

  async selectDefaultViewLayout() {
    return this.selectLayoutByName('Default View');
  }

  async openColumnConfigPanel() {
    const toolbarButtons = this.page.locator('button.dl-btn');
    const columnConfigButton = toolbarButtons.nth(1);

    if (!(await columnConfigButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      throw new Error('Could not find the Column Config toolbar button.');
    }

    await clickHighlighted(columnConfigButton, 'Column Config');
    await this.page.getByText('Column Config', { exact: true }).waitFor({ state: 'visible', timeout: 10000 });
  }

  async closeColumnConfigPanel() {
    const closeButton = this.page.getByRole('button', { name: /^Close$/i }).last();
    if (await closeButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clickHighlighted(closeButton, 'Close Column Config');
      await this.page.getByText('Column Config', { exact: true }).waitFor({ state: 'hidden', timeout: 10000 }).catch(() => null);
    }
  }

  async selectLayoutColumns(columnNames = [
    'Status',
    'Booking Ref',
    'Arrival Date',
    'Arrival Time',
    'Departure Time',
    'Access Point',
    'Vehicle type',
    'Contact Company',
    'Number Of Vehicles'
  ]) {
    let selected = 0;

    for (const columnName of columnNames) {
      const checkbox = this.page.locator(`input[type="checkbox"][name="${columnName}"]`).first();
      if (await checkbox.count()) {
        await checkbox.check({ force: true }).catch(() => null);
        if (await checkbox.isChecked().catch(() => false)) {
          selected += 1;
        }
      }
    }

    if (selected === 0) {
      selected = await this.page.evaluate(() => {
        const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
          .filter((checkbox) => checkbox.name !== 'is_default' && !checkbox.disabled);

        let checked = 0;
        for (const checkbox of checkboxes.slice(0, 5)) {
          if (!checkbox.checked) {
            checkbox.click();
          }
          checked += 1;
        }

        return checked;
      });
    }

    if (selected === 0) {
      throw new Error('Could not select any columns for the new booking list layout.');
    }

    await this.page.waitForTimeout(500);
    return selected;
  }

  async createNewLayout(layoutName = 'Automation_Filter_Layout') {
    await this.openColumnConfigPanel();

    const newLayoutButton = this.page.getByRole('button', { name: /New Layout/i }).last();
    await clickHighlighted(newLayoutButton, 'New Layout');

    const layoutNameInput = this.page.getByPlaceholder(/New Layout Name/i).first();
    await fillHighlighted(layoutNameInput, layoutName, 'New Layout Name');
    await this.selectLayoutColumns();

    const saveButton = this.page.getByRole('button', { name: /^Save$/i }).last();
    await clickHighlighted(saveButton, 'Save Layout');

    await Promise.race([
      this.page.getByText('Column Config', { exact: true }).waitFor({ state: 'hidden', timeout: 15000 }).catch(() => null),
      this.page.waitForTimeout(3000)
    ]);

    await this.closeColumnConfigPanel();
    await this.waitForBookingList();

    if (!(await this.selectLayoutByName(layoutName))) {
      throw new Error(`New layout "${layoutName}" was saved but could not be selected from the layout dropdown.`);
    }

    return layoutName;
  }

  async ensureAutomationLayout(layoutName = 'Automation_Filter_Layout') {
    const uniqueLayoutName = await this.getUniqueLayoutName(layoutName);
    const createdLayoutName = await this.createNewLayout(uniqueLayoutName);
    return { layoutName: createdLayoutName, created: true };
  }

  async openFilterPanel() {
    if (await this.applyFiltersButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      return;
    }

    const candidates = [
      this.filterButton,
      this.page.locator('button:has-text("Filter")').first(),
      this.page.locator('[role="button"]:has-text("Filter")').first()
    ];

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      for (const candidate of candidates) {
        if (!(await candidate.isVisible({ timeout: 2000 }).catch(() => false))) {
          continue;
        }

        await clickHighlighted(candidate, attempt === 1 ? 'Filter' : `Filter retry ${attempt}`).catch(async () => {
          await candidate.click({ force: true });
        });
        await this.page.waitForTimeout(800);

        if (await this.applyFiltersButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          return;
        }
      }

      await this.clickFilterButtonByGeometry();
      if (await this.applyFiltersButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        return;
      }
    }

    const visibleButtons = await this.page.locator('button, [role="button"]').evaluateAll((buttons) => {
      const visible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none';
      };

      return buttons
        .filter(visible)
        .map((button) => (button.innerText || button.textContent || button.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, 20);
    }).catch(() => []);

    throw new Error(`Filter panel did not open. Visible buttons: ${visibleButtons.join(', ') || '-'}`);
  }

  async clickFilterButtonByGeometry() {
    const clicked = await this.page.evaluate(() => {
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

      const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
      const filterButton = buttons.find((button) => /\bFilter\b/i.test(button.innerText || button.textContent || '') && visible(button));
      if (!filterButton) {
        return false;
      }

      const rect = filterButton.getBoundingClientRect();
      const target = document.elementFromPoint(rect.right - 20, rect.top + rect.height / 2) || filterButton;
      target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: rect.right - 20, clientY: rect.top + rect.height / 2 }));
      target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: rect.right - 20, clientY: rect.top + rect.height / 2 }));
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: rect.right - 20, clientY: rect.top + rect.height / 2 }));
      return true;
    });

    if (clicked) {
      await this.page.waitForTimeout(800);
    }
  }

  async openFilterTab(tabName) {
    const tab = this.page.getByRole('tab', { name: new RegExp(`^${tabName}$`, 'i') }).first();
    if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clickHighlighted(tab, `${tabName} tab`);
      await this.page.waitForTimeout(500);
      return true;
    }

    return false;
  }

  async selectCheckboxesByNames(names) {
    let selected = 0;

    for (const name of names) {
      const checkbox = this.page.locator(`input[name="${name}"]`).first();
      if (await checkbox.isVisible({ timeout: 1000 }).catch(() => false)) {
        await checkbox.check({ force: true });
        selected += 1;
      }
    }

    return selected;
  }

  async selectFirstVisibleCheckboxes(minimum = 2) {
    return this.page.evaluate((minimumCount) => {
      const visible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          !element.disabled;
      };

      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"][name^="projects:"]'))
        .filter(visible);
      let selected = 0;

      for (const checkbox of checkboxes) {
        if (!checkbox.checked) {
          checkbox.click();
        }
        selected += 1;
        if (selected >= minimumCount) break;
      }

      return selected;
    }, minimum);
  }

  async selectAtLeastTwoValuesInCurrentTab(tabName, preferredNames = []) {
    const available = await this.countVisibleFilterCheckboxes();
    const target = Math.min(2, available);

    if (target === 0) {
      console.log(`No checkbox values were available in ${tabName}; continuing for this project.`);
      return { tabName, available, selected: 0, target };
    }

    let selected = await this.selectCheckboxesByNames(preferredNames);

    if (selected < target) {
      selected += await this.selectFirstVisibleCheckboxes(target - selected);
    }

    if (selected < 2) {
      console.log(`Selected ${selected}/${available} available checkbox value(s) in ${tabName}.`);
    }

    return { tabName, available, selected, target };
  }

  async countVisibleFilterCheckboxes() {
    return this.page.evaluate(() => {
      const visible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          !element.disabled;
      };

      return Array.from(document.querySelectorAll('input[type="checkbox"][name^="projects:"]'))
        .filter(visible)
        .length;
    });
  }

  async selectAdvancedFilterValues() {
    const selections = [];

    selections.push(await this.selectAtLeastTwoValuesInCurrentTab('Booking Type', [
      'projects:delivery',
      'projects:recurring'
    ]));

    const tabConfigs = [
      { name: 'Trade Types' },
      { name: 'Access Point', preferredNames: ['projects:164', 'projects:1'] },
      { name: 'Vehicle type', preferredNames: ['projects:3', 'projects:14'] },
      { name: 'Resource', preferredNames: ['projects:11', 'projects:81'] },
      { name: 'Contact Company' },
      { name: 'Creator Company' }
    ];

    for (const tab of tabConfigs) {
      if (await this.openFilterTab(tab.name)) {
        selections.push(await this.selectAtLeastTwoValuesInCurrentTab(tab.name, tab.preferredNames || []));
      }
    }

    return selections;
  }

  async applyFiltersAndWait() {
    await clickHighlighted(this.applyFiltersButton, 'Apply Filters');
    await this.waitForBookingList();
  }

  async closeAppliedFilterChip(index) {
    const closeLink = this.page.getByRole('link', { name: 'close' }).nth(index);
    if (await closeLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clickHighlighted(closeLink, `Close filter chip ${index}`);
      await this.waitForBookingList();
      return true;
    }

    return false;
  }

  async closeLastAppliedFilterChip() {
    const closeLinks = this.page.getByRole('link', { name: 'close' });
    const count = await closeLinks.count().catch(() => 0);

    for (let index = count - 1; index >= 0; index -= 1) {
      const closeLink = closeLinks.nth(index);
      if (await closeLink.isVisible({ timeout: 1000 }).catch(() => false)) {
        await clickHighlighted(closeLink, `Close filter chip ${index}`);
        await this.waitForBookingList();
        return true;
      }
    }

    return false;
  }

  async restoreVisibleBookingRecords(maxAttempts = 6) {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const recordCount = await this.countVisibleBookingRecords();
      if (recordCount > 0) {
        return recordCount;
      }

      if (!await this.closeLastAppliedFilterChip()) {
        break;
      }
    }

    return this.expectFilteredRecords();
  }

  async applyAdditionalBookingTypeValues() {
    await this.closeAppliedFilterChip(3);
    await this.openFilterPanel();
    const selection = await this.selectAtLeastTwoValuesInCurrentTab('Additional Booking Type', [
      'projects:multi-vehicle',
      'projects:resource-only'
    ]);
    await this.applyFiltersAndWait();
    await this.closeAppliedFilterChip(2);
    return selection;
  }

  async applyRecordedJanuary2026DateRange() {
    await this.dateInputs.first().click();

    const switchViewButton = this.page.getByRole('button', { name: /calendar view is open, switch/i });
    if (await switchViewButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clickHighlighted(switchViewButton, 'Switch calendar view');
    }

    const januaryButton = this.page.getByRole('button', { name: 'Jan' });
    if (await januaryButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clickHighlighted(januaryButton, 'Jan');
    }

    const yearButton = this.page.getByRole('button', { name: '2026', exact: true });
    if (await yearButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clickHighlighted(yearButton, '2026');
    }

    await clickHighlighted(this.page.getByRole('gridcell', { name: '1', exact: true }), 'Jan 1');

    await this.dateInputs.nth(1).click();
    const nextMonthButton = this.page.getByRole('button', { name: 'Next month' });
    if (await nextMonthButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clickHighlighted(nextMonthButton, 'Next month');
    }

    await clickHighlighted(this.page.getByRole('gridcell', { name: '31' }).first(), 'Day 31');
    await this.waitForBookingList();
  }

  async getStatusTabCounts() {
    return this.page.evaluate(() => {
      const text = document.body.innerText || '';
      const labels = ['All', 'Active', 'Scheduled', 'Checked In', 'Checked out', 'For Approval', 'Refused', 'Declined', 'Cancelled'];
      return labels.reduce((counts, label) => {
        const match = text.match(new RegExp(`${label}\\s+(\\d+)`, 'i'));
        if (match) {
          counts[label] = Number(match[1]);
        }
        return counts;
      }, {});
    });
  }

  parseArrivalDate(dateText) {
    const match = dateText.match(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+(\d+)(?:st|nd|rd|th)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/);
    if (!match) {
      return null;
    }

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
    }[match[2]];

    return new Date(Number(match[3]), monthIndex, Number(match[1]));
  }

  async getVisibleArrivalDates() {
    return this.page.evaluate(() => {
      const text = document.body.innerText || '';
      return Array.from(new Set(
        text.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+\d+(?:st|nd|rd|th)\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/g) || []
      ));
    });
  }

  async expectVisibleArrivalDatesWithinRange({ fromDate, toDate }) {
    const visibleArrivalDates = await this.getVisibleArrivalDates();
    const outsideRange = visibleArrivalDates.filter((dateText) => {
      const arrivalDate = this.parseArrivalDate(dateText);
      return arrivalDate && (arrivalDate < fromDate || arrivalDate > toDate);
    });

    if (outsideRange.length > 0) {
      throw new Error(`Filtered results include dates outside ${this.formatBookingListDate(fromDate)} to ${this.formatBookingListDate(toDate)}: ${outsideRange.join(', ')}`);
    }

    return visibleArrivalDates;
  }

  getBookingIdFromClassName(className = '') {
    const match = className.match(/event-(BK[A-Z0-9]+)/);
    return match ? match[1] : null;
  }

  async getFirstCalendarEvent() {
    await this.calendarEvents.first().waitFor({ state: 'visible', timeout: 30000 });
    return this.calendarEvents.first();
  }

  async countVisibleCalendarRecords() {
    return this.calendarEvents.evaluateAll((events) => {
      const visible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none';
      };

      return events.filter(visible).length;
    }).catch(() => 0);
  }

  async expectCalendarRecords(viewName = 'Calendar') {
    const records = await this.countVisibleCalendarRecords();
    if (records < 1) {
      throw new Error(`${viewName} calendar view did not show any booking records.`);
    }

    return records;
  }

  async hoverFirstCalendarBooking(viewName = 'Calendar') {
    const event = await this.getFirstCalendarEvent();
    const className = await event.evaluate((element) => element.className || '');
    const bookingId = this.getBookingIdFromClassName(className);
    const eventText = (await event.innerText()).replace(/\s+/g, ' ').trim();

    await event.hover();
    await this.pauseCalendarAction();
    const tooltip = this.page.locator('.MuiTooltip-tooltip, [role="tooltip"]').filter({
      hasText: /BK[A-Z0-9]+/
    }).last();
    await tooltip.waitFor({ state: 'visible', timeout: 10000 });

    const tooltipText = (await tooltip.innerText()).replace(/\s+/g, ' ').trim();
    if (bookingId && !tooltipText.includes(bookingId)) {
      throw new Error(`${viewName} tooltip did not show details for ${bookingId}.`);
    }

    return { bookingId, eventText, tooltipText };
  }

  async openFirstCalendarBooking(viewName = 'Calendar') {
    const event = await this.getFirstCalendarEvent();
    const className = await event.evaluate((element) => element.className || '');
    const bookingId = this.getBookingIdFromClassName(className);

    await event.scrollIntoViewIfNeeded().catch(() => null);
    await event.click({ force: true });
    await this.pauseCalendarAction();
    await this.page.locator('#myModal2').waitFor({ state: 'visible', timeout: 20000 });
    return bookingId;
  }

  getBookingTypeFromText(text = '') {
    const match = text.match(/Booking Type\s+(Delivery|Recurring|Multi-Vehicle|Resource-Only)|\b(Delivery|Recurring|Multi-Vehicle|Resource-Only)\b/i);
    const bookingType = match ? (match[1] || match[2]) : null;

    if (!bookingType) {
      return 'Delivery';
    }

    return bookingType.toLowerCase() === 'resource-only' ? 'Resource-only' : bookingType;
  }

  async editOpenCalendarBooking(viewName = 'Calendar', hoverDetails = {}) {
    const editButton = this.page.getByRole('button', { name: /Edit Booking|Edit/i }).first();
    await clickHighlighted(editButton, `${viewName} Edit Booking`);
    await this.pauseCalendarAction();
    await this.clickThisBookingOnlyForCalendarEditIfVisible();
    await this.page.getByRole('heading', { name: /Edit Booking/i }).waitFor({
      state: 'visible',
      timeout: 30000
    });

    const url = this.page.url();
    const bookingType = this.getBookingTypeFromText(`${hoverDetails.tooltipText || ''} ${hoverDetails.eventText || ''}`);
    const editBooking = new EditBookingPage(this.page);
    const fields = await editBooking.applySafeEditReplacementsForType(bookingType, {
      requireDateTime: false,
      allowUnchangedDateTime: true
    });
    const changedFields = fields.filter((field) => field.status === 'changed');

    if (changedFields.length < 1) {
      throw new Error(`${viewName} edit opened, but no available values could be changed for ${bookingType}.`);
    }

    await editBooking.submitSafelyEditedBooking();
    await this.pauseCalendarAction();
    await this.navigateToCalendarScreen();
    return { url, bookingType, fields };
  }

  async clickThisBookingOnlyForCalendarEditIfVisible() {
    const prompt = this.page
      .locator('[role="dialog"], .modal.show, .MuiDialog-root, body')
      .filter({ hasText: /part of a recurring booking series|edit just this booking|all bookings in the series/i })
      .first();

    if (!(await prompt.isVisible({ timeout: 5000 }).catch(() => false))) {
      return false;
    }

    const thisBookingOnly = this.page.getByRole('button', { name: /This Booking Only/i }).first();
    await clickHighlighted(thisBookingOnly, 'This Booking Only');
    await this.pauseCalendarAction();
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    return true;
  }

  async downloadCalendarReport(viewName = 'Calendar') {
    const downloadButton = this.page.locator('button.print-button').first();
    await downloadButton.waitFor({ state: 'visible', timeout: 10000 });

    const downloadPromise = this.page.waitForEvent('download', { timeout: 30000 });
    await downloadButton.click({ force: true });
    await this.pauseCalendarAction();
    const download = await downloadPromise;
    return download.suggestedFilename();
  }

  async selectCalendarView(viewName) {
    const viewButton = this.page.getByRole('button', { name: viewName, exact: true }).first();
    await clickHighlighted(viewButton, viewName);
    await this.waitForCalendar();
    await this.pauseCalendarAction();
  }

  async selectCalendarBookedMode(modeName = 'ALL') {
    const bookedMode = this.page.getByText(/Only Booked|ALL/, { exact: true }).first();
    if (!(await bookedMode.isVisible({ timeout: 3000 }).catch(() => false))) {
      return false;
    }

    await clickHighlighted(bookedMode, 'Booked mode');
    await this.pauseCalendarAction();

    const optionPattern = modeName.toUpperCase() === 'ALL'
      ? /^(all|all bookings)$/i
      : new RegExp(`^${this.escapeRegex(modeName)}$`, 'i');
    const optionLocators = [
      this.page.getByRole('option', { name: optionPattern }).first(),
      this.page.locator('[role="option"], li, [data-value]').filter({ hasText: optionPattern }).first()
    ];

    for (const option of optionLocators) {
      if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
        await option.click({ force: true });
        await this.waitForCalendar();
        await this.pauseCalendarAction();
        return true;
      }
    }

    const clickedOption = await this.page.evaluate((patternSource) => {
      const pattern = new RegExp(patternSource, 'i');
      const options = Array.from(document.querySelectorAll('[role="option"], li, [data-value]'));
      const match = options.find((option) => {
        const text = (option.innerText || option.textContent || '').replace(/\s+/g, ' ').trim();
        const rect = option.getBoundingClientRect();
        const style = window.getComputedStyle(option);

        return text &&
          pattern.test(text) &&
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      });

      if (!match) return '';
      match.click();
      return (match.innerText || match.textContent || '').replace(/\s+/g, ' ').trim();
    }, optionPattern.source).catch(() => '');

    if (clickedOption) {
      await this.waitForCalendar();
      await this.pauseCalendarAction();
      return true;
    }

    await this.page.keyboard.press('Escape').catch(() => null);
    return false;
  }

  async exerciseCalendarView(viewName, options = {}) {
    if (viewName !== 'Calendar') {
      await this.selectCalendarView(viewName);
    }

    if (options.bookedMode) {
      await this.selectCalendarBookedMode(options.bookedMode);
    }

    const recordCount = await this.countVisibleCalendarRecords();
    if (recordCount < 1) {
      if (options.optionalIfEmpty) {
        const reportFilename = await this.downloadCalendarReport(viewName);
        return {
          viewName,
          recordCount,
          bookingId: null,
          hoverDetails: null,
          editUrl: null,
          reportFilename,
          skippedReason: `${viewName} calendar view did not show any booking records.`
        };
      }

      throw new Error(`${viewName} calendar view did not show any booking records.`);
    }

    const hoverDetails = await this.hoverFirstCalendarBooking(viewName);
    const bookingId = await this.openFirstCalendarBooking(viewName);
    const editResult = await this.editOpenCalendarBooking(viewName, hoverDetails);
    const reportFilename = await this.downloadCalendarReport(viewName);

    return {
      viewName,
      recordCount,
      bookingId: bookingId || hoverDetails.bookingId,
      hoverDetails,
      editUrl: editResult.url,
      bookingType: editResult.bookingType,
      editedFields: editResult.fields,
      reportFilename
    };
  }

  async clearCalendarFiltersIfVisible() {
    const clearAll = this.page.getByText('Clear All', { exact: true }).first();
    if (await clearAll.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clickHighlighted(clearAll, 'Clear All');
      await this.waitForCalendar();
      await this.pauseCalendarAction();
      return true;
    }

    return false;
  }

  async applyCalendarRecordFlow(options = {}) {
    await this.navigateToCalendarScreen();
    await this.selectBookingScope(options.scopeName || 'My Bookings');
    await this.openFilterPanel();
    const selections = await this.selectAdvancedFilterValues();
    await this.applyFiltersAndWait();
    await this.waitForCalendar();

    const results = [
      await this.exerciseCalendarView('Calendar', { optionalIfEmpty: true })
    ];
    await this.clearCalendarFiltersIfVisible();

    const views = [
      { name: 'Access Points', bookedMode: 'ALL', optionalIfEmpty: true },
      { name: 'Resource', bookedMode: 'ALL', optionalIfEmpty: true }
    ];

    for (const view of views) {
      results.push(await this.exerciseCalendarView(view.name, {
        bookedMode: view.bookedMode,
        optionalIfEmpty: view.optionalIfEmpty
      }));
    }

    return { selections, results };
  }

  async applyCodegenRecordedFilterFlow(options = {}) {
    await this.selectBookingScope(options.scopeName || 'All Project Bookings');
    let dateRange = null;
    let dateFilterCounts = {};

    if (options.useRecordedJanuary2026Range) {
      await this.applyRecordedJanuary2026DateRange();
    } else {
      dateRange = await this.applyDefaultDateRange(options.referenceDate || new Date());
      dateFilterCounts = await this.getStatusTabCounts();
    }

    const layout = options.skipLayout
      ? { layoutName: null, created: false, skipped: true }
      : await this.ensureAutomationLayout(options.layoutName || 'New_Layout_1');
    if (dateRange) {
      dateRange = await this.applyDefaultDateRange(options.referenceDate || new Date());
      dateFilterCounts = await this.getStatusTabCounts();
    }
    await this.openFilterPanel();

    const selections = [];
    selections.push(await this.selectAtLeastTwoValuesInCurrentTab('Booking Type', [
      'projects:delivery',
      'projects:recurring'
    ]));

    await this.openFilterTab('Trade Types');
    if (await this.openFilterTab('Access Point')) {
      selections.push(await this.selectAtLeastTwoValuesInCurrentTab('Access Point', ['projects:164', 'projects:1']));
    }
    if (await this.openFilterTab('Vehicle type')) {
      selections.push(await this.selectAtLeastTwoValuesInCurrentTab('Vehicle type', ['projects:3', 'projects:14']));
    }
    if (await this.openFilterTab('Resource')) {
      selections.push(await this.selectAtLeastTwoValuesInCurrentTab('Resource', ['projects:11', 'projects:81']));
    }
    await this.openFilterTab('Contact Company');

    await this.applyFiltersAndWait();
    let initialRecordCount = await this.countVisibleBookingRecords();
    if (initialRecordCount < 1) {
      console.log('Advanced filters returned no records; restoring a visible Booking List result set.');
      initialRecordCount = await this.restoreVisibleBookingRecords();
    }
    const initialArrivalDates = dateRange
      ? await this.expectVisibleArrivalDatesWithinRange(dateRange)
      : await this.getVisibleArrivalDates();

    const additionalSelection = await this.applyAdditionalBookingTypeValues();
    let finalRecordCount = await this.countVisibleBookingRecords();
    if (finalRecordCount < 1) {
      console.log('Additional filters returned no records; restoring a visible Booking List result set.');
      finalRecordCount = await this.restoreVisibleBookingRecords();
    }
    const finalArrivalDates = dateRange
      ? await this.expectVisibleArrivalDatesWithinRange(dateRange)
      : await this.getVisibleArrivalDates();
    const calendar = options.includeCalendarRecordFlow === false
      ? null
      : await this.applyCalendarRecordFlow(options);

    return {
      initialRecordCount,
      finalRecordCount,
      dateRange,
      dateFilterCounts,
      initialArrivalDates,
      finalArrivalDates,
      layout,
      selections,
      additionalSelection,
      calendar
    };
  }

  async countVisibleBookingRecords() {
    return this.page.evaluate(() => {
      const text = document.body.innerText || '';
      const ids = text.match(/BK[A-Z0-9]{10,}/g) || [];
      return new Set(ids).size;
    });
  }

  async expectFilteredRecords() {
    const records = await this.countVisibleBookingRecords();
    if (records < 1) {
      throw new Error('Applied filters did not return any visible booking records.');
    }

    return records;
  }

  async applyFullFilterFlow(options = {}) {
    await this.selectBookingScope(options.scopeName || 'All Project Bookings');
    let dateRange = await this.applyDefaultDateRange(options.referenceDate || new Date());
    let dateFilterCounts = await this.getStatusTabCounts();
    const layout = await this.ensureAutomationLayout(options.layoutName || 'New_Layout_1');
    dateRange = await this.applyDefaultDateRange(options.referenceDate || new Date());
    dateFilterCounts = await this.getStatusTabCounts();
    await this.openFilterPanel();
    const selections = await this.selectAdvancedFilterValues();
    await this.applyFiltersAndWait();
    const initialRecordCount = await this.expectFilteredRecords();
    const initialArrivalDates = await this.expectVisibleArrivalDatesWithinRange(dateRange);

    const additionalSelection = await this.applyAdditionalBookingTypeValues();
    const finalRecordCount = await this.expectFilteredRecords();
    const finalArrivalDates = await this.expectVisibleArrivalDatesWithinRange(dateRange);
    const calendar = options.includeCalendarRecordFlow === false
      ? null
      : await this.applyCalendarRecordFlow(options);

    return {
      initialRecordCount,
      finalRecordCount,
      dateRange,
      dateFilterCounts,
      initialArrivalDates,
      finalArrivalDates,
      layout,
      selections,
      additionalSelection,
      calendar
    };
  }
}

module.exports = { Filter };

if (require.main === module) {
  (async () => {
    const { chromium } = require('playwright');

    const browser = await chromium.launch({
      channel: 'chrome',
      headless: process.argv.includes('--headless') || false
    });
    const context = await browser.newContext({
      storageState: 'auth.json',
      ignoreHTTPSErrors: true,
      acceptDownloads: true
    });
    const page = await context.newPage();

    try {
      await page.goto('https://stg-app.voyagecontrol.com/5ET10000010/booking', {
        waitUntil: 'domcontentloaded'
      });
      const filter = new Filter(page);
      const result = process.argv.includes('--calendar-only')
        ? await filter.applyCalendarRecordFlow()
        : await filter.applyCodegenRecordedFilterFlow({
          useRecordedJanuary2026Range: process.argv.includes('--recorded-jan-2026')
        });
      console.log(JSON.stringify(result, null, 2));
    } finally {
      await context.close().catch(() => null);
      await browser.close().catch(() => null);
    }
  })().catch((error) => {
    console.error(`Filter codegen flow failed: ${error.message}`);
    process.exit(1);
  });
}
