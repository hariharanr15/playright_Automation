const { expect } = require('@playwright/test');
const { date } = require('../../utils/enterprise/enterprise-metrics');
const { displayDate } = require('../../utils/calendar-date');
class InventoryActivityCalendarPage {
  constructor(ctx) {
    this.ctx = ctx;
    this.page = ctx.page;
    this.drawer = ctx.inv.drawer();
    this.from = this.drawer.getByPlaceholder('select start date', { exact: true });
    this.to = this.drawer.getByPlaceholder('select End date', { exact: true });
  }
  matches(response, range) {
    const url = new URL(response.url());
    return response.request().method() === 'GET' && url.pathname === '/api/inventory/list_inv_action/' &&
      url.searchParams.get('material_master_id') === this.ctx.calendarMaterial.material_master_id &&
      url.searchParams.get('site_master_id') === this.ctx.siteId &&
      (!range || url.searchParams.get('from_date') === range.from && url.searchParams.get('to_date') === range.to);
  }
  async open() {
    await this.ctx.assertContext();
    const loaded = this.page.waitForResponse(response => this.matches(response));
    await this.ctx.inv.openView(this.ctx.calendarMaterial.material_name, 'Actions');
    this.response = await loaded;
    expect(this.response.ok()).toBe(true);
    await expect(this.from).toHaveCount(1);
    await expect(this.to).toHaveCount(1);
    await this.ctx.assertContext();
  }
  async range() {
    return { from: new Date(date(await this.from.inputValue())).toISOString().slice(0, 10),
      to: new Date(date(await this.to.inputValue())).toISOString().slice(0, 10) };
  }
  async expectRange(range, { soft = false } = {}) {
    const assertion = soft ? expect.soft : expect;
    await assertion(this.from).toHaveValue(displayDate(range.from));
    await assertion(this.to).toHaveValue(displayDate(range.to));
  }
  async verifyActivities(response = this.response) {
    await this.ctx.assertContext();
    const range = await this.range();
    expect(this.matches(response, range), 'Activity request must use exact material/site and both displayed date bounds').toBe(true);
    const body = await response.json();
    expect([200, 201]).toContain(body.status_code);
    // Confirmed deployed empty-range contract; all other missing arrays fail.
    const emptyRange = response.status() === 201 && body.status_code === 201 &&
      body.error?.error === 'No data found for the provided parameters.' &&
      body.message === 'No activities or balance records found for the specified date range and identifiers.';
    const records = emptyRange ? [] : body.data?.activities;
    expect(Array.isArray(records), 'Activity response must contain records or the exact confirmed empty-range contract').toBe(true);
    for (const record of records) {
      expect(date(record.date), 'Activity on/after selected From Date').toBeGreaterThanOrEqual(date(range.from));
      expect(date(record.date), 'Activity on/before selected To Date').toBeLessThanOrEqual(date(range.to));
    }
    const table = this.drawer.locator('table');
    const rows = table.locator('tbody tr').filter({ has: this.page.locator('td:nth-child(2)') });
    await expect(rows).toHaveCount(records.length);
    if (!records.length) await expect(this.drawer.getByText('No data available', { exact: true })).toBeVisible();
    if (records.length) {
      const headers = await table.getByRole('columnheader').allTextContents();
      const index = pattern => {
        const found = headers.map((text, i) => pattern.test(text.trim()) ? i : -1).filter(i => i >= 0);
        expect(found, `One exact Inventory activity column ${pattern}`).toHaveLength(1);
        return found[0];
      };
      const columns = [index(/^(?:(?:activity|action) )?date$/i), index(/^item(?: name)?$/i), index(/^action$/i), index(/^(?:qty|quantity)$/i), index(/^total qty$/i)];
      const cells = await rows.evaluateAll(nodes => nodes.map(row => [...row.cells].map(cell => cell.innerText.trim())));
      const numeric = value => {
        const text = value.replace(/,/g, '');
        const parsed = text.match(/^(-?\d+(?:\.\d+)?)(?:\s+(.+))?$/);
        expect(parsed, 'Activity quantity/total must be numeric with only its optional exact UOM').toBeTruthy();
        if (parsed[2]) expect(parsed[2]).toBe(this.ctx.calendarMaterial.uom_name);
        return Number(parsed[1]);
      };
      const displayed = cells.map(row => [date(row[columns[0]]), row[columns[1]], row[columns[2]].toLowerCase().replace(/ /g, '_'), numeric(row[columns[3]]), numeric(row[columns[4]])]);
      const expected = records.map(record => [date(record.date), record.item_name, record.utility_action_name, Math.abs(Number(record.action_quantity)), Number(record.total_value)]);
      const multiset = values => values.map(value => JSON.stringify(value)).sort();
      expect(multiset(displayed), 'Every rendered activity date/item/action/quantity/total matches the exact source population').toEqual(multiset(expected));
    }
    await this.ctx.assertContext();
    return { range, records };
  }
  async changeRange(range) {
    await this.ctx.assertContext();
    const loaded = this.page.waitForResponse(response => this.matches(response, range));
    loaded.catch(() => {}); // The original promise is still awaited; avoid a second unhandled rejection if the picker crashes.
    // Existing Inventory picker includes synchronization and render-loop detection.
    await this.ctx.inv.chooseDate(this.to, range.to);
    await this.ctx.inv.chooseDate(this.from, range.from);
    this.response = await loaded;
    expect(this.response.ok()).toBe(true);
    await this.expectRange(range);
    return this.verifyActivities();
  }
  async findExistingActivities(info) {
    const { searchHistoricalDates } = require('../../utils/historical-date-search');
    return searchHistoricalDates({ page: this.page, info,
      context: { module: 'Inventory Management', submodule: 'Activity Calendar', scenario: 'Existing activity historical search' },
      applyAndValidate: range => this.changeRange(range) });
  }
}
module.exports = { InventoryActivityCalendarPage };
