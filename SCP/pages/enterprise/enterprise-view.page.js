const { expect } = require('@playwright/test');
const { EnterprisePage } = require('./enterprise.page');
const { number, parseCsv, one, sum } = require('../../utils/scp-readonly');
const fs = require('fs');
class EnterpriseViewPage extends EnterprisePage {
  async findDatedProjects(info) {
    const { searchHistoricalDates, setDateInputs } = require('../../utils/historical-date-search');
    const { displayDate } = require('../../utils/calendar-date');
    const from = this.main.getByText('From', { exact: true }).locator('..').getByRole('textbox');
    const to = this.main.getByText('To', { exact: true }).locator('..').getByRole('textbox');
    await expect(from).toHaveCount(1); await expect(to).toHaveCount(1);
    return searchHistoricalDates({ page: this.page, info,
      context: { module: 'Enterprise', submodule: 'Enterprise View', scenario: 'Dated project table and CSV reconciliation' },
      applyAndValidate: async range => {
        const matches = response => {
          const url = new URL(response.url());
          return response.request().method() === 'GET' && url.searchParams.get('from_date') === range.from && url.searchParams.get('to_date') === range.to;
        };
        const summary = this.page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/enterprise/summary/') && matches(response));
        const projects = this.page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/enterprise/projects/') && matches(response));
        summary.catch(() => {}); projects.catch(() => {});
        await setDateInputs({ page: this.page, from, to, range });
        const [summaryResponse, projectResponse] = await Promise.all([summary, projects]);
        expect(summaryResponse.status()).toBe(200); expect(projectResponse.status()).toBe(200);
        const summaryBody = await summaryResponse.json(); const projectBody = await projectResponse.json();
        expect(summaryBody.status_code).toBe(200); expect(projectBody.status_code).toBe(200);
        expect(Array.isArray(projectBody.data?.projects)).toBe(true);
        this.projects = projectBody.data.projects;
        await expect(from).toHaveValue(displayDate(range.from)); await expect(to).toHaveValue(displayDate(range.to));
        await this.tableRecords(this.table('Organization / Project'), this.projects.length);
        await this.expectProjects({ soft: true });
        const exported = await this.exportAndVerify(summaryBody.data, info.outputPath(`enterprise-date-attempt-${range.from}.csv`));
        for (const [key, value] of [['from_date', range.from], ['to_date', range.to]]) {
          const scope = exported.filter(row => row[0] === 'Scope' && row[1] === key);
          expect(scope).toHaveLength(1); expect(scope[0][2]).toBe(value);
        }
        return { records: this.projects, summary: summaryBody.data };
      } });
  }
  // Applies a header change (project or site) and returns the refreshed Enterprise data from the same /enterprise-view URL.
  // The application redirects to Management Dashboard after a project change; the redirect is recorded and the same
  // staging URL is reopened. When the page does not refetch, the summary is read for the same filters in the page.
  async changeInPlace(change, read) {
    const settle = path => this.page.waitForResponse(r => r.request().method() === 'GET' && new URL(r.url()).pathname.endsWith(path), { timeout: 15000 }).catch(() => null);
    const enterpriseUrl = new URL('/enterprise-view', this.page.url()).href;
    let summaryResponse = settle('/enterprise/summary/'); let projectResponse = settle('/enterprise/projects/');
    await change();
    await this.page.waitForURL(url => !/\/enterprise-view\/?$/.test(url.pathname), { timeout: 5000 }).catch(() => null);
    const redirectedTo = /\/enterprise-view\/?$/.test(new URL(this.page.url()).pathname) ? null : this.page.url();
    if (redirectedTo) {
      summaryResponse = settle('/enterprise/summary/'); projectResponse = settle('/enterprise/projects/');
      await this.page.goto(enterpriseUrl, { waitUntil: 'domcontentloaded' });
    }
    await expect(this.page, 'Enterprise is validated on /enterprise-view').toHaveURL(/\/enterprise-view\/?$/);
    const [summaryHit, projectHit] = await Promise.all([summaryResponse, projectResponse]);
    const params = summaryHit ? new URL(summaryHit.url()).searchParams : null;
    if (projectHit) this.projects = (await projectHit.json()).data.projects;
    let summary = summaryHit ? (await summaryHit.json()).data : null;
    if (!summary && read) {
      const inputs = await this.main.locator('input').evaluateAll(es => es.map(e => e.value));
      const { date } = require('../../utils/enterprise/enterprise-metrics');
      const iso = text => new Date(date(text)).toISOString().slice(0, 10);
      const query = new URLSearchParams({ from_date: iso(inputs[0]), to_date: iso(inputs[1]) });
      summary = (await read(`enterprise/summary/?${query}`)).data;
      this.projects = (await read(`enterprise/projects/?${query}`)).data.projects;
    }
    await this.tableRecords(this.table('Organization / Project'), this.projects.length);
    return { summary, refetched: Boolean(summaryHit), redirectedTo, requestParams: params ? Object.fromEntries(params) : null };
  }
  // Sets From/To and returns the summary Enterprise recalculates for exactly that range (projects in this.projects).
  async applyRange(range) {
    const { setDateInputs } = require('../../utils/historical-date-search');
    const { displayDate } = require('../../utils/calendar-date');
    const from = this.main.getByText('From', { exact: true }).locator('..').getByRole('textbox');
    const to = this.main.getByText('To', { exact: true }).locator('..').getByRole('textbox');
    const matches = response => { const url = new URL(response.url());
      return response.request().method() === 'GET' && url.searchParams.get('from_date') === range.from && url.searchParams.get('to_date') === range.to; };
    const summary = this.page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/enterprise/summary/') && matches(r));
    const projects = this.page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/enterprise/projects/') && matches(r));
    summary.catch(() => {}); projects.catch(() => {});
    await setDateInputs({ page: this.page, from, to, range });
    const [summaryResponse, projectResponse] = await Promise.all([summary, projects]);
    expect(summaryResponse.status()).toBe(200); expect(projectResponse.status()).toBe(200);
    await expect(from).toHaveValue(displayDate(range.from)); await expect(to).toHaveValue(displayDate(range.to));
    this.projects = (await projectResponse.json()).data.projects;
    await this.tableRecords(this.table('Organization / Project'), this.projects.length);
    return (await summaryResponse.json()).data;
  }
  async load() {
    const projects = this.page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/enterprise/projects/'));
    const benchmark = this.page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/enterprise/benchmark/'));
    const summary = await this.open('Enterprise View');
    this.projects = (await (await projects).json()).data.projects;
    this.benchmark = (await (await benchmark).json()).data;
    await this.tableRecords(this.table('Organization / Project'), this.projects.length);
    return summary;
  }
  async expectSummary(data) {
    // These assertions establish rendering. Independent source calculations are separate cases.
    const cards = [ ['Projects in scope', data.projects], ['Open submittals', data.open_submittals.open],
      // The card shows the rate as a percentage with one decimal place (e.g. 69.7).
      ['On-time delivery', Number((data.on_time_delivery.rate * 100).toFixed(1))], ['Active alerts', data.active_alerts.total],
      ['Lead-time variance', data.lead_time_variance.variance_pct] ];
    for (const [label, value] of cards) {
      const card = this.card(label); await expect(card).toHaveCount(1);
      const valueNode = card.locator('div.text-2xl');
      await expect.poll(async () => number(await valueNode.innerText())).toBe(value);
    }
    await expect(this.card('Open submittals')).toContainText(`of ${data.open_submittals.total}`);
    await expect(this.card('On-time delivery')).toContainText(`${data.on_time_delivery.on_time} of ${data.on_time_delivery.total}`);
    await expect(this.card('Lead-time variance')).toContainText(`n=${data.lead_time_variance.sample_size}`);
    expect(Object.values(data.open_submittals.by_status).reduce((a, b) => a + b, 0)).toBe(data.open_submittals.total);
    expect(data.on_time_delivery.on_time + data.on_time_delivery.late).toBe(data.on_time_delivery.total);
    expect(this.projects.reduce((a, p) => a + p.metrics.submittals_total, 0)).toBe(data.open_submittals.total);
    expect(this.projects.reduce((a, p) => a + p.metrics.submittals_open, 0)).toBe(data.open_submittals.open);
  }
  async expectSpend(data) {
    const table = this.table('% of total'); const suppliers = data.spend_by_supplier.top_suppliers;
    await this.tableRecords(table, suppliers.length);
    expect(sum(suppliers, 'spend')).toBe(data.spend_by_supplier.total_spend);
    for (const supplier of suppliers) {
      const row = this.row(table, supplier.supplier_name); await expect(row).toHaveCount(1);
      const cells = row.getByRole('cell');
      await expect.poll(async () => number(await cells.nth(2).innerText())).toBe(supplier.spend);
      const calculated = data.spend_by_supplier.total_spend ? supplier.spend / data.spend_by_supplier.total_spend * 100 : 0;
      expect(supplier.pct_of_total).toBe(Number(calculated.toFixed(1)));
      await expect(cells.nth(3)).toHaveText(`${calculated.toFixed(1)}%`);
    }
  }
  async expectProjects({ soft = false } = {}) {
    const table = this.table('Organization / Project');
    for (const project of this.projects) {
      const row = table.getByRole('row').filter({ hasText: project.project_no }); await expect(row).toHaveCount(1);
      await expect(row).toContainText(project.project_name);
      if (project.organization_name) await expect(row).toContainText(project.organization_name);
      if (project.organization_ref) await expect(row).toContainText(project.organization_ref);
      const cells = row.getByRole('cell');
      for (const [index, label, expected] of [[1, 'Open submittals', project.metrics.submittals_open],
        [4, 'Spend', project.metrics.spend], [5, 'Alerts', project.alerts.total]]) {
        const text = await cells.nth(index).innerText();
        let actual;
        try { actual = number(text); }
        catch (error) {
          if (!soft) throw error;
          expect.soft(false, `${project.project_no} / ${label}: ${error.message}; expected source value ${expected}`).toBe(true);
          continue;
        }
        (soft ? expect.soft : expect)(actual, `${project.project_no} / ${label}: exact source value`).toBe(expected);
      }
    }
  }
  async exportAndVerify(data, destination) {
    const pending = this.page.waitForEvent('download');
    await this.main.getByRole('button', { name: 'Download CSV', exact: true }).click();
    const download = await pending; expect(await download.failure()).toBeNull(); await download.saveAs(destination);
    const rows = parseCsv(fs.readFileSync(destination, 'utf8').replace(/^\uFEFF/, ''));
    expect(rows.shift()).toEqual(['Metric', 'Key', 'Value']);
    const metric = (name, key) => one(rows, row => row[0] === name && row[1] === key, `CSV ${name}/${key}`)[2];
    expect(Number(metric('Scope', 'projects_in_scope'))).toBe(data.projects);
    expect(Number(metric('Open Submittals', 'total'))).toBe(data.open_submittals.total);
    expect(Number(metric('Open Submittals', 'open'))).toBe(data.open_submittals.open);
    for (const [key, value] of Object.entries(data.open_submittals.by_status)) expect(Number(metric('Submittal Status', key))).toBe(value);
    for (const supplier of data.spend_by_supplier.top_suppliers) expect(Number(metric('Spend by Supplier', supplier.supplier_name))).toBe(supplier.spend);
    return rows;
  }
}
module.exports = { EnterpriseViewPage };
