const { expect } = require('@playwright/test');
const { EnterprisePage } = require('./enterprise.page');
const { unique, number, requireValue } = require('../../utils/scp-readonly');
const { date } = require('../../utils/enterprise/enterprise-metrics');
class SupplierInboxPage extends EnterprisePage {
  async load() {
    const data = await this.open('Supplier Inbox');
    const projects = await this.page.evaluate(() => JSON.parse(localStorage.getItem('userInfo') || '{}').projects || []);
    this.projectNames = new Map(projects.map(project => [project.ref, project.name]));
    return data;
  }
  sectionButton(label) { return this.main.getByRole('button', { name: new RegExp(`^${label}`) }); }
  async expandSection(section) {
    const pending = this.page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/supplier_inbox/') && new URL(r.url()).searchParams.get('section') === section.key);
    await this.sectionButton(section.label).click();
    const body = await (await pending).json();
    const result = body.data.sections.find(s => s.key === section.key);
    expect(result, 'Exact expanded section').toBeTruthy();
    await this.expectResult(result);
    return result;
  }
  async expectResult(result) {
    const table = this.main.locator('table');
    if (result.items.length) {
      await this.tableRecords(table, result.items.length);
      await this.expectRenderedRows(result, table);
    }
    else {
      await expect(table).toHaveCount(0);
      const empty = { unconfirmed_lead_times: 'Nothing waiting on you - every assigned component has a confirmed lead time.',
        overdue_items: 'No overdue components.', deliveries_to_schedule: 'Every ordered component already has its full quantity scheduled.',
        pending_pre_shipping: 'No deliveries waiting on a pre-shipping checklist.' };
      await expect(this.main.getByText(empty[result.key], { exact: true })).toBeVisible();
    }
  }
  async expectRenderedRows(section, table) {
    const fields = [
      ['Project', r => requireValue(this.projectNames.get(r.project_id), `Project name source missing for ${r.project_id}`), 'text'],
      ['Submittal', r => r.submittal_no, 'text'], ['Material', r => r.material_name, 'text']
    ];
    if (section.key === 'pending_pre_shipping') fields.push(
      ['Supplier', r => r.supplier_name, 'text'], ['Qty', r => r.quantity, 'number'],
      ['Expected delivery', r => r.expected_date_of_delivery, 'date'],
      ['Pending with', r => ({ supplier: 'Supplier', subcontractor: 'Sub-contractor' })[r.pending_with], 'text']);
    else fields.push(['Required on site', r => r.date_required_on_site, 'date'], ['Expected delivery', r => r.expected_delivery_date, 'date']);
    if (section.key === 'overdue_items') fields.push(['Qty overdue', r => r.qty_overdue, 'number'], ['Ageing (days)', r => r.ageing_days, 'number']);
    if (section.key === 'deliveries_to_schedule') fields.push(['Scheduled', r => r.scheduled_quantity, 'number'], ['Qty yet to schedule', r => r.qty_yet_to_schedule, 'number']);
    const headers = await table.getByRole('columnheader').allTextContents();
    const indices = fields.map(([label]) => {
      const matches = headers.map((h, i) => h.trim() === label ? i : -1).filter(i => i >= 0);
      expect(matches, `Exact Inbox column ${label}`).toHaveLength(1); return matches[0];
    });
    const rows = await table.locator('tbody tr').evaluateAll(nodes => nodes.map(row => [...row.cells].map(cell => cell.innerText.trim())));
    const normalize = (value, kind) => value === null || value === undefined || /^(—|-|)$/.test(String(value).trim()) ? null :
      kind === 'date' ? date(value) : kind === 'number' ? number(value) : String(value).trim();
    const expected = section.items.map(record => fields.map(([, value, kind]) => normalize(value(record), kind)));
    const displayed = rows.map(row => fields.map(([, , kind], i) => normalize(row[indices[i]], kind)));
    // A multiset retains duplicate visible components without choosing an arbitrary row.
    const multiset = records => records.map(record => JSON.stringify(record)).sort();
    expect(multiset(displayed), `${section.label}: every displayed identity, date, quantity and ownership value matches its source`).toEqual(multiset(expected));
  }
  async collapseSection(section) { await this.sectionButton(section.label).click(); await expect(this.main.locator('table')).toHaveCount(0); }
  async expectSummary(section) {
    const button = this.sectionButton(section.label); await expect(button).toHaveCount(1);
    for (const [field, value] of Object.entries(section.summary)) {
      // Pre-Shipping counts deliveries: its header shows "Deliveries pending" in place of a components count.
      if (section.key === 'pending_pre_shipping' && field === 'components') continue;
      const label = field === 'deliveries_pending' ? 'Deliveries pending' : field;
      const block = button.getByText(new RegExp(`^${label}$`, 'i')).locator('..');
      await expect(block).toContainText(String(value));
    }
  }
  async expectExpandedData(section) {
    const records = section.items;
    expect(unique(records, section.key === 'pending_pre_shipping' ? 'schedule_delivery_id' : 'submittal_schedule_id')).toBe(records.length);
    // Only complete result sets can establish complete summary equality.
    if (!section.truncated) {
      expect(unique(records, 'project_id')).toBe(section.summary.projects);
      expect(unique(records, 'submittal_id')).toBe(section.summary.submittals);
      expect(unique(records, 'submittal_schedule_id')).toBe(section.summary.components);
      if (section.key === 'pending_pre_shipping') expect(records.length).toBe(section.summary.deliveries_pending);
    }
    for (const record of records) {
      expect(record.project_id).toBeTruthy(); expect(record.submittal_id).toBeTruthy();
      if (section.key === 'unconfirmed_lead_times') {
        expect(record.lead_time_confirmed_flag).toBe(false);
        expect(Number(record.received_quantity ?? 0)).toBeLessThan(Number(record.actual_quantity));
      }
      if (section.key === 'overdue_items') {
        expect(Number(record.qty_overdue)).toBe(Number(record.actual_quantity) - Number(record.received_quantity ?? 0));
        expect(record.ageing_days).toBeGreaterThan(0);
      }
      if (section.key === 'deliveries_to_schedule') {
        expect(Number(record.qty_yet_to_schedule)).toBeGreaterThan(0);
        expect(Number(record.scheduled_quantity)).toBeGreaterThanOrEqual(0);
      }
      if (section.key === 'pending_pre_shipping') {
        expect(record.actual_date_of_delivery).toBeNull(); expect(record.expected_date_of_delivery).toBeTruthy();
        expect(['supplier', 'subcontractor']).toContain(record.pending_with);
      }
    }
  }
  async filter(label, value) {
    const field = this.main.locator('label').filter({ has: this.page.getByText(label, { exact: true }) }).getByRole('combobox');
    const pending = this.page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/supplier_inbox/') && !new URL(r.url()).searchParams.has('section'));
    await field.selectOption(value); const response = await pending; return (await response.json()).data;
  }
}
module.exports = { SupplierInboxPage };
