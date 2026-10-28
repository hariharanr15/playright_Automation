const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');
const { ReadOnlyReportPage } = require('./read-only-report.page');
const { columns, numeric, sourceTuples, multiset, nameCounts, groupedSortDirections } = require('../../utils/issue-records');
const { parseCsv } = require('../../utils/scp-readonly');
const { readWorkbook } = require('../../utils/bulk-upload/inventory-workbook');
const { expandIssueRows } = require('../../utils/issue-table-rows');
class SubcontractorIssuesPage extends ReadOnlyReportPage {
  async load(config, ctx) {
    const { definitions } = require('./analytics.page');
    let result;
    if (ctx) {
      await ctx.assertContext();
      const projectId = await ctx.projectSelector.activeProjectReference();
      const issues = response => response.request().method() === 'GET' &&
        new URL(response.url()).pathname === `/api/${definitions.subcontractor.endpoint}` &&
        new URL(response.url()).searchParams.get('project_id') === projectId;
      const pending = this.page.waitForResponse(issues);
      pending.catch(() => {});
      const child = this.page.getByRole('button', { name: 'Subcontractor Issues', exact: true });
      if (!(await child.isVisible())) await this.page.getByRole('button', { name: 'Analytics', exact: true }).click();
      await ctx.appShell.navigateToTab('Subcontractor Issues');
      // In the shared tab the view may already be open, so the menu click does not refetch; reload it to read the source.
      let response = await pending.catch(() => null);
      if (!response) {
        const reloaded = this.page.waitForResponse(issues);
        await this.page.reload({ waitUntil: 'domcontentloaded' });
        response = await reloaded;
      }
      expect(response.status()).toBe(200);
      result = { body: await response.json(), requestUrl: response.url() };
      await expect(this.page).toHaveURL(/\/subcontractor-issues\/?$/);
      await ctx.assertContext();
    } else result = await this.open(definitions.subcontractor, config);
    expect(Array.isArray(result.body.data)).toBe(true);
    this.source = result.body.data;
    this.table = this.main.getByRole('table');
    await expect(this.table).toHaveCount(1);
    return result.body;
  }
  async readRows() {
    const rows = await this.table.locator('tbody tr').evaluateAll(nodes => nodes.map(row => ({
      group: [...row.closest('table').tBodies].indexOf(row.parentElement),
      cells: [...row.cells].map(cell => ({ text: cell.innerText.trim(), rowSpan: cell.rowSpan, colSpan: cell.colSpan }))
    })));
    return expandIssueRows(rows, this.source || this.rowSource || []);
  }
  async expectIdentityPopulation(records = this.source) {
    const expected = sourceTuples(records);
    await expect.poll(async () => (await this.readRows()).length, 'Count issue records, not unique subcontractors').toBe(expected.length);
    const actual = await this.readRows();
    expect(multiset(actual.map(row => row.slice(0, 2))), 'Every name/project occurrence must remain; names are not unique identifiers').toEqual(multiset(expected.map(row => row.slice(0, 2))));
    expect(nameCounts(actual), 'All records per exact subcontractor name must remain').toEqual(nameCounts(expected));
    return actual;
  }
  async expectRecords(records = this.source) {
    this.rowSource = records;
    const table = this.table || this.main.getByRole('table');
    await expect(table).toHaveCount(1);
    const headers = await table.getByRole('columnheader').allTextContents();
    const indices = columns.map(([label]) => {
      const matches = headers.map((text, i) => text.trim() === label ? i : -1).filter(i => i >= 0);
      expect(matches, `Exactly one required issue column ${label}`).toHaveLength(1);
      return matches[0];
    });
    await expect.poll(async () => (await this.readRows()).length).toBe(records.length);
    const rows = await this.readRows();
    const projected = rows.map((row, index) => {
      expect(row.length, `Issue record ${index + 1}: subcontractor plus all seven associated values`).toBe(headers.length);
      return indices.map((column, i) => i < 2 ? row[column].trim() : numeric(row[column]));
    });
    expect(multiset(projected), 'Complete issue-record multiset: preserve duplicate names, identical rows and all field associations').toEqual(multiset(sourceTuples(records)));
  }
  search() { return this.main.getByPlaceholder(/^Search(?:…|\.\.\.)?$/i); }
  async filterName(query) {
    await expect(this.search()).toHaveCount(1);
    await this.search().fill(query);
    const expected = this.source.filter(record => record.subcontractor.toLowerCase().includes(query.toLowerCase()));
    await this.expectIdentityPopulation(expected);
    return expected;
  }
  async sort(label) {
    const header = this.table.getByRole('columnheader', { name: new RegExp(`^${label}(?:\\s*[↑↓])?$`) });
    await expect(header).toHaveCount(1);
    const directions = new Set();
    let varied = false;
    const column = columns.findIndex(([name]) => name === label);
    for (let turn = 0; turn < 2; turn++) {
      await header.click();
      const rows = await this.expectIdentityPopulation();
      rows.forEach((row, index) => {
        expect(row[column], `Record ${index + 1}: sorted ${label} cell exists`).toBeDefined();
      });
      // The deployed AnalyticsTable sorts records within each subcontractor
      // group; it preserves group order. Validate that supported contract while
      // retaining the separate name/group-order check and complete population.
      const result = groupedSortDirections(rows, column);
      expect(result.directions.length, `${label}: one consistent direction across every subcontractor group`).toBeGreaterThan(0);
      varied ||= result.varied;
      if (result.directions.length === 1) directions.add(result.directions[0]);
    }
    if (!varied) throw new (require('../../utils/scp-readonly').ScpBlocked)(`${label}: no differing values within the supported sort groups; record preservation was checked, but both sorting directions require varied existing data`);
    expect(directions.size, `${label}: both sorting directions exercised`).toBe(2);
  }
  async exportAndVerify(info) {
    await this.main.getByRole('button', { name: 'Export', exact: true }).click();
    const menu = this.main.getByRole('menu');
    await expect(menu).toBeVisible();
    await info.attach('subcontractor-export-options', { body: Buffer.from(JSON.stringify(await menu.getByRole('menuitem').allTextContents())), contentType: 'application/json' });
    // The deployed menu labels its download action this way. File contents,
    // not the button name or download event, establish report correctness.
    const pending = this.page.waitForEvent('download');
    pending.catch(() => {});
    await menu.getByRole('menuitem', { name: 'Download Template', exact: true }).click();
    const download = await pending;
    expect(await download.failure()).toBeNull();
    const file = info.outputPath('exports', path.basename(download.suggestedFilename()));
    await download.saveAs(file);
    await info.attach('subcontractor-issues-export', { path: file, contentType: /\.csv$/i.test(file) ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    let grid;
    if (/\.csv$/i.test(file)) grid = parseCsv(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    else {
      expect(file, 'Supported report workbook format').toMatch(/\.xlsx$/i);
      const sheets = Object.values(readWorkbook(file));
      expect(sheets).toHaveLength(1);
      grid = sheets[0].map(row => {
        const values = [];
        for (const [address, value] of Object.entries(row)) {
          const letters = address.match(/^[A-Z]+/)[0];
          const column = [...letters].reduce((n, letter) => n * 26 + letter.charCodeAt(0) - 64, 0) - 1;
          values[column] = value;
        }
        return values;
      });
    }
    const headerRows = grid.map((row, i) => row.includes('Subcontractor') && row.includes('Project Name') ? i : -1).filter(i => i >= 0);
    expect(headerRows, 'One report header row').toHaveLength(1);
    const headers = grid[headerRows[0]];
    const indices = columns.map(([name]) => {
      const indices = headers.map((header, index) => header === name ? index : -1).filter(index => index >= 0);
      expect(indices, `Export must include ${name}`).toHaveLength(1);
      return indices[0];
    });
    const records = grid.slice(headerRows[0] + 1).filter(row => row.some(value => String(value).trim()));
    const actual = records.map(row => indices.map((index, column) => {
      expect(row[index], `Export value ${columns[column][0]} must exist for each individual record`).toBeDefined();
      return column < 2 ? String(row[index]).trim() : numeric(row[index]);
    }));
    expect(actual.length, 'Export counts issue records rather than unique subcontractors').toBe(this.source.length);
    expect(multiset(actual), 'Export preserves all seven associated values and duplicate-name multiplicity').toEqual(multiset(sourceTuples(this.source)));
  }
}
module.exports = { SubcontractorIssuesPage };
