const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');
const { number } = require('../../utils/scp-readonly');
const sections = { Alerts: 'alert', Notifications: 'notification', Tasks: 'task' };
class DashboardAnalyticsPage extends BasePage {
  constructor(page) { super(page); this.main = page.getByRole('main'); }
  records(body, status) {
    expect([200, 201], 'Dashboard list transport status').toContain(status);
    // Confirmed deployed empty-list contract; unexpected missing arrays still fail.
    if (status === 201 && body.status_code === 201 && body.message === 'No data found.') return [];
    expect(Array.isArray(body.data), `Dashboard list must contain records: ${JSON.stringify(body)}`).toBe(true);
    return body.data;
  }
  async section(name) {
    if (!sections[name]) throw new Error(`Unknown Dashboard section ${name}`);
    // The dashboard loads every section's Unread list with the page; since 27 Oct 2026 expanding a section reuses that
    // data instead of refetching. Capture the load-time response, then expand; the displayed count is checked against it.
    const loaded = this.page.waitForResponse(r => this.isList(r, name) && new URL(r.url()).searchParams.get('marked_read') === 'False');
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    const response = await loaded;
    await this.main.getByRole('button', { name: new RegExp(`^${name}(?:\\s*\\d+\\+?)?$`) }).click();
    const rows = this.records(await response.json(), response.status());
    const unit = name === 'Alerts' ? 'alert' : name === 'Tasks' ? 'task' : 'notification';
    await expect(this.main.getByText(`${rows.length} ${unit}${rows.length === 1 ? '' : 's'}`, { exact: true })).toBeVisible();
    await expect(this.main.getByRole('button', { name: /^(?:icon\s+)?Unread$/, exact: true })).toBeVisible();
    this.name = name; this.requestUrl = response.url(); return rows;
  }
  isList(response, name = this.name) {
    const url = new URL(response.url()); return response.request().method() === 'GET' && url.pathname.endsWith('/notification_system/list_notifications/') && url.searchParams.get('notification_type') === sections[name];
  }
  async allRecords() {
    const result = await this.page.evaluate(async url => {
      const parsed = new URL(url); parsed.searchParams.delete('marked_read');
      const response = await fetch(parsed, { headers: { Authorization: `Bearer ${localStorage.getItem('_sso_access')}` } });
      if (!response.ok) throw new Error(`Dashboard source read failed: ${response.status}`);
      return { status: response.status, body: await response.json() };
    }, this.requestUrl);
    return this.records(result.body, result.status);
  }
  async filter(status) {
    const current = this.main.getByRole('button', { name: /^(?:icon\s+)?(Unread|Read|All)$/, exact: true });
    const pending = this.page.waitForResponse(r => this.isList(r) &&
      (new URL(r.url()).searchParams.get('marked_read') || '') === ({ All: '', Read: 'True', Unread: 'False' }[status]));
    await current.click(); await this.page.getByRole('option', { name: status, exact: true }).click();
    const response = await pending; await expect(this.main.getByRole('button', { name: new RegExp(`^(?:icon\\s+)?${status}$`), exact: true })).toBeVisible();
    return this.records(await response.json(), response.status());
  }
  chartTitle() { return this.name === 'Alerts' ? 'Project Aggregate Stats' : this.name === 'Tasks' ? 'Task Charts' : 'Notification Charts'; }
  async findDatedRecords(info, policy = 'historical') {
    const { searchHistoricalDates, setDateInputs } = require('../../utils/historical-date-search');
    const { date } = require('../../utils/enterprise/enterprise-metrics');
    const { displayDate } = require('../../utils/calendar-date');
    const from = this.main.getByPlaceholder('Start date', { exact: true });
    const to = this.main.getByPlaceholder('End date', { exact: true });
    await expect(from).toHaveCount(1); await expect(to).toHaveCount(1);
    return searchHistoricalDates({ page: this.page, info, policy,
      context: { module: 'Management Dashboard', submodule: this.name, scenario: `${this.name} dated source records` },
      applyAndValidate: async range => {
        const loaded = this.page.waitForResponse(response => {
          const url = new URL(response.url());
          return this.isList(response) && url.searchParams.get('from_date') === range.from && url.searchParams.get('to_date') === range.to;
        });
        loaded.catch(() => {});
        await setDateInputs({ page: this.page, from, to, range });
        const response = await loaded;
        this.requestUrl = response.url();
        const records = this.records(await response.json(), response.status());
        await expect(from).toHaveValue(displayDate(range.from));
        await expect(to).toHaveValue(displayDate(range.to));
        for (const record of records) {
          expect(date(record.created_at)).toBeGreaterThanOrEqual(date(range.from));
          expect(date(record.created_at)).toBeLessThanOrEqual(date(range.to));
        }
        await this.expectVisibleRecords(records);
        const unit = this.name === 'Tasks' ? 'task' : this.name === 'Alerts' ? 'alert' : 'notification';
        await expect(this.main.getByText(`${records.length} ${unit}${records.length === 1 ? '' : 's'}`, { exact: true })).toBeVisible();
        return { records };
      } });
  }
  async charts() {
    const responses = [];
    const listener = response => { if (response.request().method() === 'GET' && /notification_system\/.+\/(pie|status-pie|by-category|by-type-status|aging)\/?|get_project_aggregation/.test(new URL(response.url()).pathname)) responses.push(response); };
    this.page.on('response', listener);
    try {
      await this.main.getByRole('heading', { name: this.chartTitle(), exact: true }).click();
      const expectedTitle = this.name === 'Alerts' ? 'Project Overview' : this.name === 'Tasks' ? 'Distribution of Tasks by Status' : 'Distribution of Notifications by Type';
      // Alerts shows its aggregate empty state instead of Project Overview when the project has no aggregate data.
      const opened = this.main.getByRole('heading', { name: expectedTitle, exact: true });
      await expect(this.name === 'Alerts' ? opened.or(this.aggregateEmpty()) : opened).toBeVisible();
      const expected = this.name === 'Alerts' ? 1 : 3;
      await expect.poll(() => responses.length).toBeGreaterThanOrEqual(expected);
      const data = [];
      for (const response of responses) { expect(response.status()).toBe(200); data.push({ url: response.url(), body: await response.json() }); }
      return data;
    } finally { this.page.off('response', listener); }
  }
  async collapse() {
    await this.main.getByRole('heading', { name: this.chartTitle(), exact: true }).click();
    await expect(this.main.getByRole('heading', { name: /^(Project Overview|Distribution of Tasks by Status|Distribution of Notifications by Type)$/ })).toHaveCount(0);
    await expect(this.aggregateEmpty()).toHaveCount(0);
  }
  aggregateEmpty() { return this.main.getByText('No aggregate data available for this project', { exact: true }); }
  async expectVisibleRecords(records) {
    const table = this.main.locator('table'); await expect(table).toHaveCount(1);
    const descriptions = table.locator('tbody tr').getByRole('cell').filter({ hasText: /\S/ });
    expect(await descriptions.count()).toBeGreaterThanOrEqual(records.length ? 1 : 0);
    expect(new Set(records.map(r => r.notification_id)).size).toBe(records.length);
    const request = new URL(this.requestUrl);
    for (const record of records) expect(record.project_id).toBe(request.searchParams.get('project_id'));
  }
  async expectPie(label, count, total) {
    const percent = total ? (count / total * 100).toFixed(1) : '0.0';
    await expect(this.main.getByText(`${label}: ${count} (${percent}%)`, { exact: true })).toBeVisible();
  }
  async expectAggregate(payload, projectId) {
    const projects = (payload.data || []).filter(p => p.project_id === projectId);
    // The empty state is correct only when the source has no aggregate record for the project, and vice versa.
    const empty = await this.aggregateEmpty().isVisible();
    expect(empty, `Aggregate empty state must match the source (${projects.length} source record(s) for ${projectId})`).toBe(projects.length === 0);
    if (empty) return { empty: true };
    expect(projects).toHaveLength(1);
    const record = projects[0];
    for (const [label, field] of [['Submittals', 'submittal_count'], ['Materials', 'material_count'], ['Suppliers', 'supplier_count'], ['Locations', 'location_count'], ['Items', 'item_count']]) {
      const card = this.main.getByText(label, { exact: true }).locator('..').filter({ has: this.page.locator('span.text-2xl') });
      await expect(card).toHaveCount(1);
      expect(number(await card.locator('span.text-2xl').innerText())).toBe(record[field]);
    }
  }
}
module.exports = { DashboardAnalyticsPage, sections };
