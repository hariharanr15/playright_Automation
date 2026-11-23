const { test, expect } = require('../../../fixtures/readonlyTest');
const { EnterpriseViewPage } = require('../../../pages/enterprise/enterprise-view.page');
const { selectCalendarDate } = require('../../../utils/date-picker');
const { date } = require('../../../utils/enterprise/enterprise-metrics');
test('Enterprise View: single-day range refreshes summary/project requests and CSV date scope', async ({ readonly: ctx }, info) => {
  const view = new EnterpriseViewPage(ctx.page); await view.load();
  const from = view.main.getByText('From', { exact: true }).locator('..').getByRole('textbox');
  const to = view.main.getByText('To', { exact: true }).locator('..').getByRole('textbox');
  const iso = new Date(date(await to.inputValue())).toISOString().slice(0, 10);
  const matches = response => { const url = new URL(response.url()); return url.searchParams.get('from_date') === iso && url.searchParams.get('to_date') === iso; };
  const summary = ctx.page.waitForResponse(r => r.url().includes('/enterprise/summary/') && matches(r));
  const projects = ctx.page.waitForResponse(r => r.url().includes('/enterprise/projects/') && matches(r));
  await selectCalendarDate(ctx.page, from, iso);
  const data = (await (await summary).json()).data; const rows = (await (await projects).json()).data.projects;
  expect(rows.map(r => r.project_no).sort()).toEqual(view.projects.map(r => r.project_no).sort());
  const exported = await view.exportAndVerify(data, info.outputPath('enterprise-single-day.csv'));
  for (const key of ['from_date', 'to_date']) {
    const value = exported.filter(r => r[0] === 'Scope' && r[1] === key); expect(value).toHaveLength(1); expect(value[0][2]).toBe(iso);
  }
});
