const { test, expect } = require('../../../fixtures/readonlyTest');
const { EnterpriseViewPage } = require('../../../pages/enterprise/enterprise-view.page');
const { sourceRecords, supplierDefaults, unreadAlerts } = require('../../../utils/enterprise/enterprise-data');
const { openSubmittals, enterpriseView, date } = require('../../../utils/enterprise/enterprise-metrics');
const { shiftCalendarMonths } = require('../../../utils/calendar-date');
const { setDateInputs } = require('../../../utils/historical-date-search');
const { isHeadless } = require('../../../utils/execution-mode');

test('Enterprise View: cards, status totals and project roll-up consistency', async ({ readonly: ctx }) => {
  const view = new EnterpriseViewPage(ctx.page); const data = await view.load();
  await test.step('Verify rendered metrics and distinct project totals', () => view.expectSummary(data));
  await test.step('Verify project and owning-organisation rows', () => view.expectProjects());
});
test('Enterprise View: supplier spend and independently calculated percentages', async ({ readonly: ctx }) => {
  const view = new EnterpriseViewPage(ctx.page); const data = await view.load();
  await view.expectSpend(data);
});
test('Enterprise View: CSV exact business values and selected dates', async ({ readonly: ctx }, info) => {
  const view = new EnterpriseViewPage(ctx.page); const data = await view.load();
  const rows = await view.exportAndVerify(data, info.outputPath('enterprise-view.csv'));
  const from = await ctx.page.getByText('From', { exact: true }).locator('..').getByRole('textbox').inputValue();
  const to = await ctx.page.getByText('To', { exact: true }).locator('..').getByRole('textbox').inputValue();
  for (const [key, value] of [['from_date', from], ['to_date', to]]) {
    const record = rows.filter(row => row[0] === 'Scope' && row[1] === key); expect(record).toHaveLength(1);
    expect(date(record[0][2])).toBe(date(value));
  }
});
test('Enterprise View: independent Procurement open-submittal reconciliation', async ({ readonly: ctx }, info) => {
  test.setTimeout(300000);
  const view = new EnterpriseViewPage(ctx.page); const data = await view.load();
  const fields = ctx.page.locator('main input');
  const values = await fields.evaluateAll(es => es.map(e => e.value)); expect(values).toHaveLength(2);
  const iso = text => new Date(date(text)).toISOString().slice(0, 10);
  const source = await sourceRecords(ctx, view.projects, { from: iso(values[0]), to: iso(values[1]) });
  await info.attach('independent-procurement-source', { body: Buffer.from(JSON.stringify(source)), contentType: 'application/json' });
  expect(source.submittals.length).toBe(data.open_submittals.total);
  expect(openSubmittals(source.submittals, source.components).length).toBe(data.open_submittals.open);
});
// Independent cumulative expectation: per-project Procurement records for the range, de-duplicated across projects.
async function cumulativeExpectation(ctx, accessible, range) {
  const source = await sourceRecords(ctx, accessible.map(project => ({ project_no: project.ref })), { from: '2000-01-01', to: '2100-12-31' });
  const submittals = [...new Map(source.submittals.map(record => [record.id, record])).values()];
  const open = openSubmittals(submittals, source.components);
  const perProject = accessible.map(project => ({ project: project.name, ref: project.ref,
    submittals: submittals.filter(record => record.projectId === project.ref).length,
    open: open.filter(record => record.projectId === project.ref).length }));
  return { range, perProject, duplicatesRemoved: source.submittals.length - submittals.length,
    totals: { projects: accessible.length, submittals: submittals.length, open: open.length } };
}
function compareCumulative(expected, data, projects, label) {
  const differences = [];
  const check = (name, actual, wanted) => { if (actual !== wanted) differences.push(`${label} / ${name}: Enterprise ${actual}, calculated ${wanted}`); };
  check('Projects in scope', data.projects, expected.totals.projects);
  check('Open submittals total', data.open_submittals.total, expected.totals.submittals);
  check('Open submittals open', data.open_submittals.open, expected.totals.open);
  for (const row of expected.perProject) {
    const shown = projects.find(project => project.project_no === row.ref);
    if (!shown) { differences.push(`${label} / ${row.project}: accessible project missing from Enterprise project table`); continue; }
    check(`${row.project} submittals`, shown.metrics.submittals_total, row.submittals);
    check(`${row.project} open submittals`, shown.metrics.submittals_open, row.open);
  }
  for (const shown of projects) {
    if (!expected.perProject.some(row => row.ref === shown.project_no)) differences.push(`${label} / ${shown.project_no}: in Enterprise but not accessible to the signed-in user`);
  }
  return differences;
}
test('Enterprise cumulative: all accessible projects reconcile independently for the selected and a changed date range', async ({ readonly: ctx }, info) => {
  test.setTimeout(900000);
  // Accessible projects come from the signed-in session, independently of the Enterprise endpoints.
  const accessible = await ctx.projectSelector.sessionProjects();
  expect(accessible.length, 'The signed-in user must be associated with at least one project').toBeGreaterThan(0);
  const view = new EnterpriseViewPage(ctx.page); const data = await view.load();
  const from = view.main.getByText('From', { exact: true }).locator('..').getByRole('textbox');
  const to = view.main.getByText('To', { exact: true }).locator('..').getByRole('textbox');
  const iso = text => new Date(date(text)).toISOString().slice(0, 10);
  const selected = { from: iso(await from.inputValue()), to: iso(await to.inputValue()) };
  const results = []; const differences = [];
  try {
    const first = await cumulativeExpectation(ctx, accessible, selected);
    differences.push(...compareCumulative(first, data, view.projects, `${selected.from}..${selected.to}`));
    results.push({ ...first, enterprise: { summary: data, projects: view.projects } });
    await info.attach('enterprise-cumulative-selected-range', { body: await ctx.page.screenshot({ fullPage: isHeadless() }), contentType: 'image/png' });
    // Changed range: two calendar months earlier start, same end. Enterprise must recalculate for the new range.
    const changed = { from: shiftCalendarMonths(selected.from, -2), to: selected.to };
    const matches = response => { const url = new URL(response.url()); return url.searchParams.get('from_date') === changed.from && url.searchParams.get('to_date') === changed.to; };
    const summary = ctx.page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/enterprise/summary/') && matches(r));
    const projects = ctx.page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/enterprise/projects/') && matches(r));
    await setDateInputs({ page: ctx.page, from, to, range: changed });
    const changedData = (await (await summary).json()).data; const changedProjects = (await (await projects).json()).data.projects;
    const second = await cumulativeExpectation(ctx, accessible, changed);
    differences.push(...compareCumulative(second, changedData, changedProjects, `${changed.from}..${changed.to}`));
    results.push({ ...second, enterprise: { summary: changedData, projects: changedProjects } });
    await info.attach('enterprise-cumulative-changed-range', { body: await ctx.page.screenshot({ fullPage: isHeadless() }), contentType: 'image/png' });
  } finally {
    await info.attach('enterprise-cross-project-comparison', { body: Buffer.from(JSON.stringify({ accessibleProjects: accessible, results, differences,
      notValidatedHere: 'On-time delivery needs the confirmed date field (enterprise.dateBasis); spend, alerts and lead-time variance need an independent source contract' }, null, 2)), contentType: 'application/json' });
  }
  expect(differences, 'Enterprise cumulative values must match the independently calculated per-project totals').toEqual([]);
});
test('Enterprise View: category planned averages, opposite delta sign and missing industry data', async ({ readonly: ctx }) => {
  const view = new EnterpriseViewPage(ctx.page); await view.load(); const table = view.table('Your avg (wks)');
  await view.tableRecords(table, view.benchmark.categories.length);
  for (const record of view.benchmark.categories) {
    const row = view.row(table, record.category); await expect(row).toHaveCount(1);
    if (record.platform_avg_weeks !== null && record.your_avg_weeks !== null) {
      const delta = (record.platform_avg_weeks - record.your_avg_weeks).toFixed(1);
      await expect(row.getByRole('cell').nth(4)).toHaveText(Number(delta) > 0 ? `+${delta}` : delta);
    }
    if (record.industry_avg_weeks === null) await expect(row.getByRole('cell').nth(3)).toHaveText('—');
  }
});
// BUGS-325 (docs/ENTERPRISE_REQUIREMENTS_BUGS-325.md): Enterprise View values recalculated from the Procurement source records of
// every project the signed-in user can access on this platform, using the same From-To as Enterprise's selection.
async function bugs325(ctx, info, { defaults = false, alerts = false } = {}) {
  // Enterprise's selected From-To is applied unchanged to the Procurement and alert reads, so both sides cover the same dates.
  // SCP_ENTERPRISE_FROM / SCP_ENTERPRISE_TO (YYYY-MM-DD) select a specific range in Enterprise first; otherwise its default is used.
  const view = new EnterpriseViewPage(ctx.page); let data = await view.load();
  const values = await ctx.page.locator('main input').evaluateAll(es => es.map(e => e.value)); expect(values).toHaveLength(2);
  const iso = text => new Date(date(text)).toISOString().slice(0, 10);
  let range = { from: iso(values[0]), to: iso(values[1]) };
  if (process.env.SCP_ENTERPRISE_FROM || process.env.SCP_ENTERPRISE_TO) {
    range = { from: process.env.SCP_ENTERPRISE_FROM || range.from, to: process.env.SCP_ENTERPRISE_TO || range.to };
    data = await view.applyRange(range);
  }
  const accessible = await ctx.projectSelector.sessionProjects();
  expect(accessible.length, 'The signed-in user must have at least one project on this platform').toBeGreaterThan(0);
  const source = await sourceRecords(ctx, accessible.map(project => ({ project_no: project.ref })), range);
  if (defaults) await supplierDefaults(ctx, source.components);
  const refs = accessible.map(project => project.ref);
  const unread = alerts ? await unreadAlerts(ctx, refs, range) : null;
  const unreadAllDates = alerts ? await unreadAlerts(ctx, refs, { from: '2000-01-01', to: '2100-12-31' }) : null;
  const expected = enterpriseView(source, accessible, unread);
  const differences = [];
  const check = (label, actual, wanted) => { if (actual !== wanted) differences.push(`${label}: Enterprise ${actual}, BUGS-325 ${wanted}`); };
  const row = ref => view.projects.find(project => project.project_no === ref);
  const attach = extra => info.attach('enterprise-cross-project-comparison', { body: Buffer.from(JSON.stringify({ requirement: 'BUGS-325', range,
    accessibleProjects: accessible.map(({ name, ref, organization }) => ({ name, ref, organization })), enterprise: { summary: data, projects: view.projects },
    expected: { ...expected, perProject: undefined }, perProject: expected.perProject, unreadAlertsAllDates: unreadAllDates, differences, ...extra }, null, 2)), contentType: 'application/json' });
  return { view, data, range, accessible, expected, differences, check, row, attach };
}
const pct4 = value => value === null ? null : Number(value.toFixed(4));
const pct1 = value => value === null ? null : Number(value.toFixed(1));
test('Enterprise View BUGS-325: Projects in Scope, Open Submittals, status chart and Spend from source records', async ({ readonly: ctx }, info) => {
  test.setTimeout(600000);
  const r = await bugs325(ctx, info);
  r.check('Projects in Scope', r.data.projects, r.expected.projects);
  for (const project of r.accessible) if (!r.row(project.ref)) r.differences.push(`${project.name}: accessible but missing from the Projects Summary`);
  for (const shown of r.view.projects) if (!r.accessible.some(project => project.ref === shown.project_no)) r.differences.push(`${shown.project_name}: in Enterprise but not accessible to the signed-in user`);
  r.check('Open Submittals (Y, total)', r.data.open_submittals.total, r.expected.submittals);
  r.check('Open Submittals (X, open)', r.data.open_submittals.open, r.expected.open);
  r.check('Submittals by status: bars sum to Y', Object.values(r.data.open_submittals.by_status).reduce((a, b) => a + b, 0), r.expected.submittals);
  r.check('Spend total', r.data.spend_by_supplier.total_spend, r.expected.spend);
  for (const supplier of r.data.spend_by_supplier.top_suppliers) r.check(`Spend ${supplier.supplier_name}`, supplier.spend, r.expected.spendBySupplier[supplier.supplier_name]);
  for (const [ref, project] of Object.entries(r.expected.perProject)) {
    const shown = r.row(ref); if (!shown) continue;
    r.check(`${project.name} submittals`, shown.metrics.submittals_total, project.submittals);
    r.check(`${project.name} Open`, shown.metrics.submittals_open, project.open);
    r.check(`${project.name} Spend`, shown.metrics.spend, project.spend);
    if (!shown.organization_name) r.differences.push(`${project.name}: Projects Summary row has no Organization`);
  }
  await r.attach();
  expect(r.differences, 'Enterprise View must match BUGS-325 (see enterprise-cross-project-comparison)').toEqual([]);
});
test('Enterprise View BUGS-325: On-Time Delivery counts every delivery with an Actual Delivery Date', async ({ readonly: ctx }, info) => {
  test.setTimeout(600000);
  const r = await bugs325(ctx, info);
  r.check('On-Time Delivery on-time count', r.data.on_time_delivery.on_time, r.expected.onTime.onTime);
  r.check('On-Time Delivery deliveries with an Actual Delivery Date', r.data.on_time_delivery.total, r.expected.onTime.total);
  r.check('On-Time Delivery rate', r.data.on_time_delivery.rate, pct4(r.expected.onTime.rate));
  for (const [ref, project] of Object.entries(r.expected.perProject)) {
    const shown = r.row(ref); if (shown) r.check(`${project.name} On-time`, shown.metrics.on_time_rate, pct4(project.onTime.rate));
  }
  await r.attach();
  expect(r.differences, 'On-Time Delivery must follow BUGS-325 (see enterprise-cross-project-comparison)').toEqual([]);
});
test('Enterprise View BUGS-325: Lead-Time Variance against confirmed or Supplier-to-Material planned lead time', async ({ readonly: ctx }, info) => {
  test.setTimeout(600000);
  const r = await bugs325(ctx, info, { defaults: true });
  r.check('Lead-Time Variance %', r.data.lead_time_variance.variance_pct, pct1(r.expected.variance.value));
  r.check('Lead-Time Variance n', r.data.lead_time_variance.sample_size, r.expected.variance.sample);
  for (const [ref, project] of Object.entries(r.expected.perProject)) {
    const shown = r.row(ref); if (!shown) continue;
    r.check(`${project.name} LT Var %`, shown.metrics.lead_time_variance_pct, pct1(project.variance.value));
    r.check(`${project.name} LT Var n`, shown.metrics.lead_time_sample, project.variance.sample);
  }
  await r.attach({ excludedComponents: r.expected.variance.excluded });
  expect(r.differences, 'Lead-Time Variance must follow BUGS-325 (see enterprise-cross-project-comparison)').toEqual([]);
});
test('Enterprise View BUGS-325: Active Alerts are the unread alerts and the projects that have them', async ({ readonly: ctx }, info) => {
  test.setTimeout(600000);
  const r = await bugs325(ctx, info, { alerts: true });
  r.check('Active Alerts', r.data.active_alerts.total, r.expected.alerts);
  r.check('Active Alerts projects', r.data.active_alerts.project_count, r.expected.alertProjects);
  for (const [ref, project] of Object.entries(r.expected.perProject)) {
    const shown = r.row(ref); if (shown) r.check(`${project.name} Alerts`, shown.alerts.total, project.alerts);
  }
  await r.attach();
  expect(r.differences, 'Active Alerts must be the unread alerts (see enterprise-cross-project-comparison)').toEqual([]);
});
