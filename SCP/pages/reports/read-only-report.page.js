const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');
const { number, ScpBlocked, excluded } = require('../../utils/scp-readonly');
class ReadOnlyReportPage extends BasePage {
  constructor(page) { super(page); this.main = page.getByRole('main'); }
  async open(definition, config) {
    if (excluded.test(definition.route)) throw new Error(`Excluded destination ${definition.route}`);
    const pending = this.page.waitForResponse(r => new URL(r.url()).pathname === `/api/${definition.endpoint}` &&
      (!definition.projectScoped || new URL(r.url()).searchParams.get('project_id') && new URL(r.url()).searchParams.get('project_id') !== 'null'));
    await this.page.goto(new URL(`/${definition.route}`, config.baseUrl).href, { waitUntil: 'domcontentloaded' });
    const response = await pending;
    expect(response.status(), definition.label).toBe(200);
    const body = await response.json();
    await expect(this.main.getByText(/^Loading[^\n]*$/)).toHaveCount(0);
    await expect(this.page).toHaveURL(new RegExp(`/${definition.route}/?$`));
    return { body, requestUrl: response.url() };
  }
  async tableFields(records, identityHeader, mapping, { zeroAsDash = false, rowKeys = null, grouped = false } = {}) {
    const table = this.main.locator('table').filter({ has: this.page.getByRole('columnheader', { name: new RegExp(`^${identityHeader}$`, 'i') }) });
    await expect(table).toHaveCount(1);
    const headers = await table.getByRole('columnheader').evaluateAll(cells => cells.filter(c => c.colSpan === 1).map(c => c.innerText));
    const indices = {};
    for (const header of Object.keys(mapping)) {
      const matches = headers.map((h, i) => h.trim().toLowerCase() === header.toLowerCase() ? i : -1).filter(i => i >= 0);
      expect(matches, `One required column ${header}`).toHaveLength(1); indices[header] = matches[0];
    }
    const extract = () => table.locator('tbody tr').evaluateAll((rows, expand) => {
      const spans = []; const output = [];
      for (const row of rows) {
        if (row.cells.length <= 1) continue;
        const values = [];
        for (let col = 0; col < spans.length; col++) if (spans[col]?.remaining) {
          values[col] = spans[col].text; spans[col].remaining--;
        }
        let col = 0;
        for (const cell of row.cells) {
          while (values[col] !== undefined) col++;
          const text = cell.querySelector('input')?.value ?? cell.innerText.trim();
          values[col] = text;
          if (expand && cell.rowSpan > 1) spans[col] = { text, remaining: cell.rowSpan - 1 };
          col++;
        }
        output.push(values);
      }
      return expand ? output.filter(row => !row.some(cell => /^Total$/i.test(cell))) : output;
    }, grouped);
    await expect.poll(async () => (await extract()).length).toBe(records.length);
    const displayed = await extract();
    for (let i = 0; i < records.length; i++) {
      expect(displayed[i].length, `Row ${i + 1}: every required header must have a corresponding data cell`).toBe(headers.length);
      const matches = rowKeys ? records.filter(record => rowKeys.every(header => String(record[mapping[header]]) === displayed[i][indices[header]])) : [records[i]];
      expect(matches, `Row ${i + 1}: unique exact source identity`).toHaveLength(1);
      for (const [header, field] of Object.entries(mapping)) {
      const actual = displayed[i][indices[header]]; const expected = matches[0][field];
      if (typeof expected === 'number') {
        if (zeroAsDash && expected === 0 && /^(—|-)$/.test(actual)) continue;
        expect(number(actual), `Row ${i + 1}, ${header}`).toBe(expected);
      } else if (expected !== null && expected !== undefined) expect(actual).toBe(String(expected));
      else expect(actual).toMatch(/^(—|-|)$/);
      }
    }
  }
  async requireSource(allocation, key) {
    if (!allocation.businessSources?.[key]) throw new ScpBlocked(`${key}: independent source fixture/business rules are required for complete reconciliation; rendering alone is insufficient`);
    return allocation.businessSources[key];
  }
}
module.exports = { ReadOnlyReportPage };
