const { randomUUID } = require('crypto');
const { test, expect } = require('../../../fixtures/readonlyTest');
const { SubcontractorIssuesPage } = require('../../../pages/reports/subcontractor-issues.page');
const { columns, sourceTuples, nameCounts } = require('../../../utils/issue-records');
const { ScpBlocked } = require('../../../utils/scp-readonly');
async function open(ctx, info) {
  const view = new SubcontractorIssuesPage(ctx.page);
  const source = await view.load(ctx.config, ctx);
  await ctx.assertContext();
  await info.attach('subcontractor-issue-record-source', { body: Buffer.from(JSON.stringify(source)), contentType: 'application/json' });
  return view;
}
test('Subcontractor Issues: total records and every repeated-name occurrence are preserved', async ({ readonly: ctx }, info) => {
  const view = await open(ctx, info);
  await view.expectIdentityPopulation();
  const duplicates = nameCounts(sourceTuples(view.source)).filter(([, count]) => count > 1);
  if (!duplicates.length) throw new ScpBlocked('Positive repeated-name validation needs existing multiple issue records for one subcontractor');
  await info.attach('repeated-subcontractor-record-counts', { body: Buffer.from(JSON.stringify(duplicates)), contentType: 'application/json' });
});
test('Subcontractor Issues: all seven associated values stay mapped to every independent record', async ({ readonly: ctx }, info) => {
  const view = await open(ctx, info); await view.expectRecords();
});
test('Subcontractor Issues: name Search returns all matching records and reset restores all occurrences', async ({ readonly: ctx }, info) => {
  const view = await open(ctx, info);
  const candidates = nameCounts(sourceTuples(view.source)).filter(([name, count]) => count > 1 && name !== 'Subcontractor not found').sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (!candidates.length) throw new ScpBlocked('No existing repeated-name subcontractor is available for Search');
  // Deliberately choose the largest repeated-name population, not a first record.
  const query = candidates[0][0];
  const matches = await view.filterName(query);
  expect(matches.length).toBeGreaterThan(1);
  await view.filterName('');
});
test('Subcontractor Issues: no-match Search preserves no stale rows and reset restores duplicates', async ({ readonly: ctx }, info) => {
  const view = await open(ctx, info);
  await view.filterName(`absent-${randomUUID()}`);
  await view.filterName('');
});

test('Subcontractor Issues: supported project Search verifies exact record population and clear restores every occurrence', async ({ readonly: ctx }, info) => {
  const view = await test.step('Open report and confirm selected project and site context', () => open(ctx, info));
  const projectId = await ctx.projectSelector.activeProjectReference();
  const expected = view.source.filter(record => record.project_id.toLowerCase().includes(projectId.toLowerCase()));
  if (!expected.length) throw new ScpBlocked('No issue records for the exact selected project are available for the supported project Search');
  await test.step('Search selected project ID and verify every matching issue occurrence', async () => {
    await view.search().fill(projectId);
    // The deployed input normalizes its value to lowercase on every change.
    await expect(view.search()).toHaveValue(projectId.toLowerCase());
    await view.expectIdentityPopulation(expected);
    await ctx.assertContext();
  });
  await test.step('Clear Search and verify all record occurrences are restored', async () => {
    await view.filterName('');
    await ctx.assertContext();
  });
});
for (const [label] of columns) test(`Subcontractor Issues: ${label} sorts both directions without losing issue records`, async ({ readonly: ctx }, info) => {
  const view = await open(ctx, info); await view.sort(label);
});
test('Subcontractor Issues: pagination preserves every issue record across pages when supported', async ({ readonly: ctx }, info) => {
  const view = await open(ctx, info);
  const next = view.main.getByRole('button', { name: /^(?:Next|Next page)$/i });
  // Not applicable rather than Blocked: the surface renders every record on one page.
  test.skip(!(await next.count()), 'Not applicable: Subcontractor Issues exposes no pagination controls and renders all records on one page');
  await expect(next).toHaveCount(1);
  const activePage = view.main.locator('[aria-current="page"]');
  if (await activePage.count() !== 1) throw new ScpBlocked('Pagination needs a qualified current-page indicator; identical record contents must not be mistaken for a repeated page');
  const rows = []; const visited = new Set();
  for (let page = 0; page < 100; page++) {
    const current = await view.readRows(); const token = await activePage.innerText();
    expect(visited.has(token), 'Pagination must advance its page indicator').toBe(false);
    visited.add(token); rows.push(...current);
    if (await next.isDisabled()) {
      expect(rows.length).toBe(view.source.length);
      const { multiset } = require('../../../utils/issue-records');
      expect(multiset(rows.map(row => row.slice(0, 2)))).toEqual(multiset(sourceTuples(view.source).map(row => row.slice(0, 2))));
      return;
    }
    await next.click();
    await expect.poll(async () => activePage.innerText()).not.toBe(token);
  }
  throw new Error('Pagination exceeded safety bound without reaching its final page');
});
test('Subcontractor Issues: exported report retains every record and all seven associated values', async ({ readonly: ctx }, info) => {
  const view = await open(ctx, info); await view.exportAndVerify(info);
});
