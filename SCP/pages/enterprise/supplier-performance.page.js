const { expect } = require('@playwright/test');
const { EnterprisePage } = require('./enterprise.page');
const { number, sum } = require('../../utils/scp-readonly');
class SupplierPerformancePage extends EnterprisePage {
  async load() { return this.open('Supplier Performance'); }
  async expectData(data) {
    const k = data.kpis;
    for (const [label, value] of [['On-time delivery', Math.round(k.on_time_delivery_rate * 100)], ['Active components', k.active_schedules],
      ['Overdue', k.overdue_schedules], ['Lead times confirmed', Math.round(k.confirmed_lead_times_rate * 100)],
      ['Avg lead time', k.avg_lead_time_weeks], ['Deliveries \\(90d\\)', k.total_deliveries_last_90d]]) await this.expectCard(label, value);
    expect(sum(data.by_project, 'active')).toBe(k.active_schedules);
    expect(sum(data.by_project, 'overdue')).toBe(k.overdue_schedules);
    expect(sum(data.by_project, 'deliveries_last_90d')).toBe(k.total_deliveries_last_90d);
    for (const [header, records, identity] of [['Project', data.by_project, 'project_id'], ['Supplier', data.by_supplier, 'supplier_name']]) {
      const table = this.table(header); await this.tableRecords(table, records.length);
      for (const record of records) {
        const row = table.getByRole('row').filter({ hasText: record[identity] }); await expect(row).toHaveCount(1);
        const cells = row.getByRole('cell');
        expect(number(await cells.nth(2).innerText())).toBe(record.active);
        expect(number(await cells.nth(3).innerText())).toBe(record.overdue);
        expect(number(await cells.nth(4).innerText())).toBe(Math.round(record.confirmed_lead_times_rate * 100));
        expect(number(await cells.nth(5).innerText())).toBe(record.avg_lead_time_weeks);
        expect(number(await cells.nth(6).innerText())).toBe(record.deliveries_last_90d);
      }
    }
  }
  async months(months) {
    const loaded = this.page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/supplier_analytics/') && new URL(r.url()).searchParams.get('months') === String(months));
    await this.main.getByRole('button', { name: `${months} months`, exact: true }).click();
    const data = (await (await loaded).json()).data;
    expect(data.trend_months).toBe(months); expect(data.deliveries_per_month).toHaveLength(months);
    expect(new Set(data.deliveries_per_month.map(m => m.month)).size).toBe(months);
    for (let i = 1; i < data.deliveries_per_month.length; i++) {
      const previous = new Date(`${data.deliveries_per_month[i - 1].month}-01T00:00:00Z`);
      previous.setUTCMonth(previous.getUTCMonth() + 1);
      expect(data.deliveries_per_month[i].month).toBe(previous.toISOString().slice(0, 7));
    }
    return data;
  }
}
module.exports = { SupplierPerformancePage };
