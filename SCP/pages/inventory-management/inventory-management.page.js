const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');
const { numeric } = require('../../utils/inventory-data');

const ACTIONS = ['Incoming Load', 'Internal Movement', 'Issue To Construction', 'Loss', 'Return'];
class InventoryManagementPage extends BasePage {
  constructor(page) {
    super(page);
    this.main = page.getByRole('main');
    this.searchInput = page.getByPlaceholder('Search inventory…', { exact: true });
    this.form = page.locator('form').filter({ has: page.locator('label').filter({ hasText: /^Comments\*$/ }) });
  }

  async open() {
    // Already on Inventory (the scenario continued on this page): the menu would not reload the list, so the page is
    // reused as it is, with the search cleared; each scenario's own Search queries the current data.
    if (/\/inventory-management\/?$/.test(new URL(this.page.url()).pathname)
      && await require('../../utils/page-cleanup').clearLeftovers(this.page)
      && await this.searchInput.isVisible().catch(() => false)) {
      if (await this.searchInput.inputValue().catch(() => '')) await this.searchInput.fill('');
      await expect(this.page.getByRole('heading', { name: 'Inventory Management', exact: true })).toBeVisible();
      return;
    }
    const loaded = this.page.waitForResponse(r => /\/ledger_balance\/list_inv_materials\/?/.test(r.url()) && r.request().method() === 'GET');
    loaded.catch(() => {});
    // A loading backdrop or a dialog from the previous screen must not cover the menu.
    await require('../../utils/page-cleanup').clearLeftovers(this.page);
    await this.page.getByRole('button', { name: 'Inventory Management', exact: true }).click();
    const response = await loaded;
    expect(response.ok()).toBe(true);
    await response.finished();
    await expect(this.page).toHaveURL(/\/inventory-management\/?$/);
    await expect(this.page.getByRole('heading', { name: 'Inventory Management', exact: true })).toBeVisible();
    await expect(this.searchInput).toBeVisible();
  }

  materialRow(name) {
    return this.main.locator('table').first().getByRole('row').filter({ has: this.page.getByRole('cell', { name, exact: true }) });
  }

  async search(name) {
    await this.searchInput.fill(name);
    await expect(this.searchInput).toHaveValue(name);
    const row = this.materialRow(name);
    await expect(row, 'Inventory Search must identify exactly one material').toHaveCount(1);
    await expect(row).toBeVisible();
    return row;
  }

  async expectMaterial(record, balance) {
    const row = await this.search(record.material_name);
    const cells = row.getByRole('cell');
    await expect(this.main.locator('table').first().getByRole('columnheader').filter({ hasText: /\S/ }))
      .toHaveText(['Category', 'Material ID', 'Material Name', 'Inventory', 'UOM']);
    await expect(cells.nth(0)).toHaveText(record.category);
    await expect(cells.nth(1)).toHaveText(record.material_id);
    await expect(cells.nth(2)).toHaveText(record.material_name);
    await expect(cells.nth(4)).toHaveText(record.uom_name || record.uom);
    await expect.poll(async () => numeric(await cells.nth(3).innerText())).toBe(balance);
  }

  async openView(name, view) {
    const row = await this.search(name);
    await row.getByRole('img', { name: 'Menu', exact: true }).click();
    const endpoint = { Actions: 'get_inv_action_details', Location: 'list_inv_location', UOM: 'list_inv_uom', Submittals: 'list_submittal' }[view];
    const loaded = this.page.waitForResponse(r => r.request().method() === 'GET' && r.url().includes(endpoint));
    await this.page.getByRole('menuitem', { name: view, exact: true }).click();
    const response = await loaded;
    expect(response.ok()).toBe(true);
    await response.finished();
    this.lastViewData = (await response.json()).data;
    await expect(this.page.getByRole('heading', { name: view, exact: true })).toBeVisible();
    // The drawer is the only ancestor of its heading that contains its data table.
    return this.drawer(view);
  }

  drawer(view = 'Actions') {
    return this.page.getByRole('heading', { name: view, exact: true })
      .locator('xpath=ancestor::div[.//table][1]');
  }

  async openActivity() {
    await this.page.getByRole('button', { name: 'Add Activity', exact: true }).click();
    await expect(this.page.getByRole('heading', { name: 'Add Activity', exact: true })).toBeVisible();
    await expect(this.form).toHaveCount(1);
  }

  field(label) {
    return this.form.locator('label').filter({ hasText: new RegExp(`^${label}\\*$`) }).locator('..');
  }

  async choose(label, value) {
    await this.field(label).getByRole('button').click();
    const option = this.page.getByRole('listbox').getByRole('option', { name: value, exact: true });
    await expect(option, `${label}: exact valid option ${value}`).toHaveCount(1);
    await option.click();
    await expect(this.field(label).getByRole('button')).toContainText(value);
  }

  async fillActivity(data, omit) {
    for (const [label, value] of Object.entries({ Item: data.item, Action: data.action, 'From Location': data.source,
      ...(data.action === 'Internal Movement' ? { 'To Location': data.destination } : {}),
      Supplier: data.supplier, Subcontractor: data.subcontractor, Submittal: data.submittal, Schedule: data.schedule })) {
      // A deliberately missing parent leaves its dependent control unavailable.
      // The caller still asserts the parent's mandatory validation and no write.
      if (label === omit || (label === 'To Location' && omit === 'Action') ||
        (label === 'Schedule' && omit === 'Submittal')) continue;
      await this.choose(label, value);
    }
    if (omit !== 'QTY') await this.field('QTY').getByRole('spinbutton').fill(String(data.quantity));
    if (omit !== 'Comments') await this.field('Comments').getByRole('textbox').fill(data.comments);
  }

  async cancelActivity() {
    await this.page.getByRole('heading', { name: 'Add Activity', exact: true }).locator('..').getByRole('button').click();
    await expect(this.form).toHaveCount(0);
  }

  async submitActivity() {
    const submitted = this.page.waitForResponse(r => r.request().method() === 'POST' && /\/inventory\/add_inv_activity\//.test(r.url()));
    await this.page.getByRole('button', { name: 'ADD', exact: true }).click();
    const response = await submitted;
    expect(response.ok(), 'Inventory activity save must succeed').toBe(true);
    const body = await response.json();
    expect(body.statuscode ?? body.status_code, JSON.stringify(body)).toBe(200);
    await expect(this.form).toHaveCount(0);
    return body;
  }

  async expectRejected(message) {
    const writes = [];
    const listener = request => { if (request.method() === 'POST' && request.url().includes('/inventory/add_inv_activity/')) writes.push(request.url()); };
    this.page.on('request', listener);
    try {
      await this.page.getByRole('button', { name: 'ADD', exact: true }).click();
      await expect(this.page.getByText(message, { exact: true })).toBeVisible();
      await expect(this.form).toBeVisible();
      expect(writes, 'Client-invalid activity must not be submitted').toEqual([]);
    } finally { this.page.off('request', listener); }
  }

  summary(label) {
    return this.drawer().getByText(label, { exact: true }).locator('..').locator('p').last();
  }

  async chooseDate(field, isoDate) {
    const [year, month, day] = isoDate.split('-').map(Number);
    let listener;
    const defect = new Promise((resolve, reject) => {
      listener = message => { if (/Maximum update depth exceeded/.test(message.text())) reject(new Error('Application defect: Inventory calendar entered a React maximum-update-depth loop')); };
      this.page.on('console', listener);
    });
    const select = async () => {
      await field.click();
      const calendar = this.page.locator('[data-date]').first().locator('xpath=ancestor::div[.//select][1]');
      const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)));
      await calendar.getByRole('combobox').nth(1).selectOption(String(year));
      await calendar.getByRole('combobox').nth(0).selectOption({ label: monthName });
      const label = `${monthName} ${day}, ${year}`;
      const button = calendar.getByRole('button', { name: label, exact: true });
      await expect(button, `Calendar must expose ${label}`).toHaveCount(1);
      await button.click();
      await expect(field).toHaveValue(`${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`);
    };
    try { await Promise.race([select(), defect]); }
    catch (error) {
      if (/maximum-update-depth/.test(error.message)) await require('../../utils/shared-browser').discardUnresponsivePage(this.page);
      throw error;
    } finally { this.page.off('console', listener); }
  }

  async expectHistory(activity, expectedTotal) {
    const rows = this.drawer().getByRole('row').filter({ has: this.page.getByRole('cell', { name: activity.action, exact: true }) })
      .filter({ has: this.page.getByRole('cell', { name: activity.item, exact: true }) });
    // All inventory tests of a run share one material (one submittal per run, 29 Oct 2026), so its history holds rows
    // from earlier tests too. This test's row is the one with its own quantity and the expected running total.
    let index = -1;
    await expect.poll(async () => {
      const values = await rows.evaluateAll(list => list.map(r => [...r.cells].map(c => c.innerText)));
      index = values.findIndex(cells => numeric(cells[6]) === Number(activity.quantity) && numeric(cells[7]) === expectedTotal);
      return index;
    }, { message: `History row for this ${activity.action} (quantity ${activity.quantity}, total ${expectedTotal})`, timeout: 15000 }).toBeGreaterThanOrEqual(0);
    const cells = rows.nth(index).getByRole('cell');
    await expect(cells.nth(1)).toHaveText(activity.specificationNumber);
    await expect(cells.nth(2)).toHaveText(activity.historySchedule);
    await expect(cells.nth(4)).toContainText(activity.source);
    if (activity.action === 'Internal Movement') await expect(cells.nth(4)).toContainText(activity.destination);
    await expect.poll(async () => numeric(await cells.nth(6).innerText())).toBe(Number(activity.quantity));
    await expect.poll(async () => numeric(await cells.nth(7).innerText())).toBe(expectedTotal);
  }

  // ===========================================================================================================
  // Methods used by the Inventory Management regression (tests/pm-flow/inv-regression.spec.js).
  // They follow the screen as it behaves on NRVC_Hall today (21 Nov 2026). The older methods above are kept
  // unchanged for the specs under tests/regression/inventory-management.
  // ===========================================================================================================

  /**
   * Opens the Inventory Management list with a fresh page load and puts the header site back.
   * A page load resets the header site to the newest site (OBS-INV-12), and the location lists follow that site,
   * so the test site is restored before anything else is read.
   */
  async openListOnSite(siteSelector, siteName) {
    await this.page.keyboard.press('Escape').catch(() => null);
    await this.page.goto('/inventory-management', { waitUntil: 'domcontentloaded' });
    await siteSelector.keepSite(siteName);
    await expect.poll(() => this.listedItemCount(), { message: 'Inventory list shows its items', timeout: 30000 }).toBeGreaterThan(0);
  }

  /** Number of materials in the list, read from the "N items" label above the table. */
  async listedItemCount() {
    const text = await this.main.innerText();
    const match = text.match(/(\d+) items?/);
    return match ? Number(match[1]) : NaN;
  }

  /** Row of one material in the list, matched on the exact material name. */
  listRowOf(material) {
    return this.main.locator('table tbody tr').filter({ has: this.page.getByRole('cell', { name: material, exact: true }) }).first();
  }

  /** Searches the list for a material and returns its stock (the "Inventory" column, 4th cell). */
  async readListInventory(material) {
    await this.searchInput.fill(material);
    const row = this.listRowOf(material);
    await expect(row, `Material ${material} is listed`).toBeVisible({ timeout: 15000 });
    return numeric(await row.getByRole('cell').nth(3).innerText());
  }

  /**
   * Opens one of the material's detail views from its row menu: "Actions" (the stock ledger), "Location",
   * "Submittals" or "UOM". Waits until the view's heading and its table are shown.
   */
  async openMaterialView(material, viewName) {
    await this.searchInput.fill(material);
    const row = this.listRowOf(material);
    await expect(row, `Material ${material} is listed`).toBeVisible({ timeout: 15000 });
    await row.locator('img[alt="Menu"]').click();
    await this.page.getByRole('menuitem', { name: viewName, exact: true }).click();
    await expect(this.page.getByRole('heading', { name: viewName, exact: true })).toBeVisible({ timeout: 15000 });
    // The view's rows arrive after the heading. Wait until the page has finished loading, then for the ledger
    // ("Actions") until its table shows rows. The extra 1.5 s pause is the settle time the suite has always used:
    // the pilot run of 21 Nov showed the ledger still updating without it (Closing Balance and rows not yet loaded).
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
    if (viewName === 'Actions') {
      await this.ledgerTable().locator('tbody tr').filter({ has: this.page.locator('td') }).first()
        .waitFor({ timeout: 15000 }).catch(() => null);
    }
    await this.page.waitForTimeout(1500);
  }

  /**
   * Reads the "Closing Balance" shown at the top of the ledger.
   * While the ledger loads it briefly shows "Closing Balance 0" (seen in the 21 Nov pilot run), so by default the
   * value is read again until it is a number other than 0. Pass `{ allowZero: true }` for a material that may
   * really have no stock.
   */
  async readClosingBalance({ allowZero = false } = {}) {
    let balance = NaN;
    await expect.poll(async () => {
      const text = await this.page.locator('body').innerText();
      const match = text.match(/Closing Balance\s*:?\s*(-?[\d,.]+)/);
      balance = match ? Number(match[1].replace(/,/g, '')) : NaN;
      return Number.isFinite(balance) && (allowZero || balance !== 0);
    }, { message: 'Ledger shows its Closing Balance (a number, not the 0 shown while loading)', timeout: 15000 }).toBe(true);
    return balance;
  }

  /** Data rows of the tables on screen (the ledger rows when the ledger is open). */
  ledgerRows() {
    return this.page.getByRole('row').filter({ has: this.page.locator('td') });
  }

  /** The ledger table: the table whose header has a "Total QTY" column. */
  ledgerTable() {
    return this.page.locator('table').filter({ has: this.page.getByRole('columnheader', { name: /Total QTY/i }) }).last();
  }

  /** Stock of the material at one location, read from the "Location" view (0 when the location is not listed). */
  async readStockAtLocation(location) {
    const row = this.page.getByRole('row').filter({ hasText: new RegExp(escapeRegex(location), 'i') }).first();
    if (!(await row.count())) return 0;
    return numeric(await row.getByRole('cell').last().innerText());
  }

  // ---------- "Add Activity" form on the ledger ----------

  addActivityButton() {
    return this.page.getByRole('button', { name: 'Add Activity' }).last();
  }

  /** The form's own "ADD" (save) button. */
  activitySaveButton() {
    return this.page.getByRole('button', { name: 'ADD', exact: true }).last();
  }

  /** Opens the Add Activity form from the ledger and waits until its save button is shown. */
  async openActivityForm() {
    await this.addActivityButton().click();
    await this.activitySaveButton().waitFor();
  }

  /**
   * The input control that belongs to a form label (the first input, list, select or dropdown button after it).
   * Labels of mandatory fields end with "*".
   */
  activityControl(label) {
    return this.page.getByText(new RegExp(`^${escapeRegex(label)}\\s*\\*?$`)).last()
      .locator('xpath=following::*[self::input[not(@type="checkbox") and not(@readonly)] or self::textarea or self::select or self::button or @role="button"][1]');
  }

  /**
   * Sets one field of the Add Activity form and returns the options the field offered.
   * - Text and number fields are typed into.
   * - Dropdowns: `choice` is the exact option text, or a function that picks the first matching option.
   *   When nothing matches, the dropdown is closed and only the offered options are returned.
   */
  async setActivityField(label, choice) {
    const control = this.activityControl(label);
    const tagName = await control.evaluate(element => element.tagName);
    if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
      await control.fill(String(choice));
      return [];
    }
    if (tagName === 'SELECT') {
      const offered = (await control.locator('option').allInnerTexts()).map(text => text.trim()).filter(Boolean);
      const wanted = typeof choice === 'function' ? offered.find(choice) : choice;
      if (wanted !== undefined) await control.selectOption({ label: wanted });
      return offered;
    }
    await control.click();
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
    await this.page.waitForTimeout(400);
    const list = this.page.getByRole('listbox').last();
    const offered = (await list.getByRole('option').allInnerTexts()).map(text => text.trim()).filter(Boolean);
    const wanted = typeof choice === 'function' ? offered.find(choice) : choice;
    if (wanted === undefined) {
      await this.page.keyboard.press('Escape');
      return offered;
    }
    await list.getByRole('option', { name: wanted, exact: true }).first().click();
    // A choice reloads the dependent fields and the "Available at" hint; let the page finish before the next field
    // (the same settle the suite used before the 21 Nov rewrite – without it the hint was read as 0).
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
    await this.page.waitForTimeout(400);
    return offered;
  }

  /** Text currently shown in a dropdown field (for example the chosen Submittal or Schedule). */
  async readActivityField(label) {
    const dropdown = this.page.getByText(new RegExp(`^${escapeRegex(label)}\\s*\\*?$`)).last().locator('xpath=following::*[@role="button"][1]');
    return (await dropdown.innerText()).trim();
  }

  /**
   * Fills the whole Add Activity form (the form must be open) and returns what the dropdowns offered.
   * The Submittal is tried from `submittalCandidates(offeredSubmittals)` in order until one has schedule lines,
   * because some submittals (for example imported ones) have none. `chosenSubmittal` is undefined when no
   * candidate had a schedule. After each Submittal change the Schedule list reloads (about one second, OBS-INV-3),
   * so `waitForScheduleMs` gives it time before it is read.
   */
  async fillActivityForm({ item, action, fromLocation, toLocation, quantity, comments, supplier, subcontractor,
    submittalCandidates, schedule = () => true, waitForScheduleMs = 2000 }) {
    await this.setActivityField('Item', item);
    await this.setActivityField('Action', action);
    const locations = await this.setActivityField('From Location', fromLocation);
    if (toLocation) await this.setActivityField('To Location', toLocation);
    await this.setActivityField('QTY', quantity);
    await this.setActivityField('Comments', comments);
    const suppliers = await this.setActivityField('Supplier', supplier);
    const subcontractors = await this.setActivityField('Subcontractor', subcontractor);
    // Read the submittals offered for this material without choosing one yet.
    const submittals = await this.setActivityField('Submittal', () => undefined);
    let schedules = [];
    let chosenSubmittal;
    for (const candidate of submittalCandidates(submittals)) {
      await this.setActivityField('Submittal', candidate);
      if (waitForScheduleMs) await this.page.waitForTimeout(waitForScheduleMs);
      schedules = await this.setActivityField('Schedule', schedule);
      if (schedules.length) {
        chosenSubmittal = candidate;
        break;
      }
    }
    return { locations, suppliers, subcontractors, submittals, schedules, chosenSubmittal };
  }

  /** The "Available at <location>: <qty>" hint shown in the form; returns the quantity and the full text. */
  async readAvailableStockHint() {
    const hint = (await this.page.getByText(/Available at .+: [\d.]+/).first().innerText()).trim();
    return { text: hint, quantity: Number(hint.match(/: ([\d.]+)/)[1]) };
  }

  /**
   * Clicks "ADD" and waits for the outcome: the form closes after a save, or a validation or rejection message
   * appears and the form stays open. The caller checks which of the two happened.
   */
  async clickAddAndWaitForOutcome() {
    const saveRequest = this.page.waitForResponse(
      response => response.request().method() === 'POST' && response.url().includes('/inventory/add_inv_activity/'),
      { timeout: 15000 }).catch(() => null);
    await this.activitySaveButton().click();
    await Promise.race([saveRequest, this.validationMessages().first().waitFor({ timeout: 15000 }).catch(() => null)]);
    // A rejection message is shown just after the server answers; let the page finish before it is read.
    await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => null);
    // After a successful save the form needs a moment to close.
    await this.activitySaveButton().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => null);
  }

  /** True while the Add Activity form is still open (for example after a rejected save). */
  async isActivityFormOpen() {
    return this.activitySaveButton().isVisible().catch(() => false);
  }

  /** Validation and rejection texts the form and the app show. */
  validationMessages() {
    return this.page.getByText(/required|cannot|not enough|must be|invalid/i);
  }

  /** All toasts and form messages currently shown, as one text (used to report what the app said). */
  async readActivityMessages() {
    const toasts = (await this.page.getByRole('status').allInnerTexts()).join(' | ');
    const formMessages = await this.validationMessages().allInnerTexts().catch(() => []);
    return `${toasts} ${formMessages}`.trim();
  }

  /** Closes the Add Activity form without saving, if it is open. */
  async closeActivityFormIfOpen() {
    if (await this.isActivityFormOpen()) {
      await this.page.keyboard.press('Escape');
      await this.activitySaveButton().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => null);
    }
  }

  // ---------- Export ----------

  /** Clicks "Export" on the list page and saves the downloaded file. */
  async exportListTo(file) {
    const download = this.page.waitForEvent('download');
    await this.main.getByRole('button', { name: 'Export', exact: true }).first().click();
    await (await download).saveAs(file);
    return file;
  }

  /** Options of the list page's location filter, without "All locations". */
  async readLocationFilterOptions() {
    const options = await this.main.locator('select').first().locator('option').allInnerTexts();
    return options.map(text => text.trim()).filter(text => text && text !== 'All locations');
  }
}

const escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { InventoryManagementPage, ACTIONS };
