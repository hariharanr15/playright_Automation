const { expect } = require('@playwright/test');
const { EnterprisePage } = require('./enterprise.page');
const { number } = require('../../utils/scp-readonly');
const { benchmarkStatus } = require('../../utils/enterprise/enterprise-metrics');
class LeadTimeBenchmarksPage extends EnterprisePage {
  async load() { return this.open('Lead Time Benchmarks'); }
  async expectPerformance(data) {
    const p = data.delivery_performance;
    for (const [label, value] of [['Total delivered', p.total_delivered], ['On time', p.on_time_percentage],
      ['On time count', p.on_time], ['Late', p.late], ['Avg delay', p.avg_delay_days]]) await this.expectCard(label, value);
    expect(p.on_time + p.late).toBe(p.total_delivered);
    if (p.total_delivered) expect(p.on_time_percentage).toBe(Number((p.on_time / p.total_delivered * 100).toFixed(1)));
  }
  async expectComparisons(data) {
    const table = this.main.locator('table'); await this.tableRecords(table, data.comparisons.length);
    for (const record of data.comparisons) {
      const row = this.row(table, record.category); await expect(row).toHaveCount(1);
      const cells = row.getByRole('cell');
      for (const [column, value] of [[1, record.your_avg_weeks], [2, record.client_avg_weeks], [3, record.platform_avg_weeks], [4, record.industry_avg_weeks]]) {
        const text = await cells.nth(column).innerText();
        if (value !== null) expect(number(text), `${record.category}: zero is a valid value in column ${column}`).toBe(value);
        else expect(text.trim(), `${record.category}: missing average must not become zero`).toMatch(/^(—|-|)$/);
      }
      if (record.your_avg_weeks !== null && record.platform_avg_weeks !== null) {
        const delta = Number((record.your_avg_weeks - record.platform_avg_weeks).toFixed(1));
        expect(record.difference_weeks).toBe(delta);
        expect(record.status).toBe(benchmarkStatus(delta));
      }
      await expect(cells.nth(10)).toHaveText(/^(—|-|)$/);
    }
  }
  async sortAndVerify(header, numeric = false) {
    const table = this.main.locator('table'); const control = table.getByRole('columnheader', { name: new RegExp(`^${header}`, 'i') });
    await expect(control).toHaveCount(1);
    const identities = await table.locator('tbody tr').evaluateAll(rows => rows.map(row => row.cells[0].innerText).sort());
    for (let turn = 0; turn < 2; turn++) {
      await control.click();
      expect(await table.locator('tbody tr').evaluateAll(rows => rows.map(row => row.cells[0].innerText).sort()), 'Sorting must retain every exact category').toEqual(identities);
      const headers = await table.getByRole('columnheader').allTextContents();
      const index = headers.findIndex(text => new RegExp(`^${header}`, 'i').test(text.trim()));
      const title = headers[index]; const ascending = title.includes('↑');
      expect(title, 'Sorted header declares a direction').toMatch(/[↑↓]/);
      const records = await table.locator('tbody tr').evaluateAll((rows, col) => rows.map(row => row.cells[col].innerText), index);
      const present = records.filter(t => /\d/.test(t) || (!numeric && t.trim() && !/^(—|-)$/.test(t.trim())));
      const values = present.map(t => numeric ? number(t) : t.trim());
      const ordered = [...values].sort((a, b) => numeric ? a - b : a.localeCompare(b));
      if (!ascending) ordered.reverse();
      expect(values).toEqual(ordered);
    }
  }
}
module.exports = { LeadTimeBenchmarksPage };
