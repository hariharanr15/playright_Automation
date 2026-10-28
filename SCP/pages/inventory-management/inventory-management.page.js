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
    const loaded = this.page.waitForResponse(r => /\/ledger_balance\/list_inv_materials\/?/.test(r.url()) && r.request().method() === 'GET');
    loaded.catch(() => {});
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
    const row = this.drawer().getByRole('row').filter({ has: this.page.getByRole('cell', { name: activity.action, exact: true }) })
      .filter({ has: this.page.getByRole('cell', { name: activity.item, exact: true }) });
    await expect(row, 'Each isolated activity type must have one history row').toHaveCount(1);
    const cells = row.getByRole('cell');
    await expect(cells.nth(1)).toHaveText(activity.specificationNumber);
    await expect(cells.nth(2)).toHaveText(activity.historySchedule);
    await expect(cells.nth(4)).toContainText(activity.source);
    if (activity.action === 'Internal Movement') await expect(cells.nth(4)).toContainText(activity.destination);
    await expect.poll(async () => numeric(await cells.nth(6).innerText())).toBe(Number(activity.quantity));
    await expect.poll(async () => numeric(await cells.nth(7).innerText())).toBe(expectedTotal);
  }
}
module.exports = { InventoryManagementPage, ACTIONS };
