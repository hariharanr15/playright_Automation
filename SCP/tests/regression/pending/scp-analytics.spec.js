const { test, expect } = require('../../../fixtures/readonlyTest');
const { AnalyticsPage, definitions } = require('../../../pages/reports/analytics.page');
const { sum, requireValue, number } = require('../../../utils/scp-readonly');
for (const [key, method] of [['aggregate', 'expectAggregate'], ['financial', 'expectFinancial'], ['invoiced', 'expectTov'], ['outflow', 'expectTov'], ['subcontractor', 'expectIssues'], ['supplier', 'expectIssues']]) {
  test(`Analytics: ${definitions[key].label} saved table values and arithmetic`, async ({ readonly: ctx }, info) => {
    const page = new AnalyticsPage(ctx.page); const body = await page.load(key, ctx.config);
    await ctx.assertContext(); await page[method](body, key === 'outflow' || key === 'subcontractor');
    await info.attach('report-source-and-scope', { body: Buffer.from(JSON.stringify({ request: page.requestUrl, body })), contentType: 'application/json' });
  });
}
test('Analytics: EPD counts, status distribution and embodied-carbon totals', async ({ readonly: ctx }) => {
  const page = new AnalyticsPage(ctx.page); const body = await page.load('epd', ctx.config);
  const project_id = new URL(page.requestUrl).searchParams.get('project_id'); const records = (await ctx.read('epd/', { project_id })).data;
  expect(body.data.total_epds).toBe(records.length);
  expect(Object.values(body.data.by_status).reduce((a, b) => a + b, 0)).toBe(records.length);
  // EPD records carry their processing state in parse_status (e.g. "completed").
  for (const [status, count] of Object.entries(body.data.by_status)) expect(count, `EPDs with parse_status ${status}`).toBe(records.filter(r => r.parse_status === status).length);
  for (const value of Object.values(body.data.embodied_carbon)) expect(Number.isFinite(value)).toBe(true);
  await expect(page.main.getByText('Total EPDs', { exact: true }).locator('..')).toContainText(String(records.length));
  for (const [label, expected] of [['Parsed', body.data.completed_epds], ['A1-A3 (kg CO2e)', body.data.embodied_carbon.gwp_a1_a3_kg_co2e], ['Total GWP (kg CO2e)', body.data.embodied_carbon.gwp_total_kg_co2e]]) {
    const card = page.main.getByText(label, { exact: true }).locator('..'); await expect(card).toHaveCount(1);
    expect(number(await card.innerText()), label).toBe(expected);
  }
});
test('Analytics: Emission Report grouped mass, distance and unit reconciliation', async ({ readonly: ctx }) => {
  const page = new AnalyticsPage(ctx.page); const body = await page.load('emissions', ctx.config); const data = body.data;
  const modes = Object.values(data.by_mode);
  expect(sum(modes, 'co2_kg')).toBe(data.total_co2_kg); expect(sum(modes, 'distance_km')).toBe(data.total_distance_km); expect(sum(modes, 'leg_count')).toBe(data.total_legs);
  expect(data.total_co2_tonnes).toBe(data.total_co2_kg / 1000);
  for (const mode of modes) expect(mode.percentage).toBe(data.total_co2_kg ? Number((mode.co2_kg / data.total_co2_kg * 100).toFixed(2)) : 0);
  const rows = (await ctx.read('emissions/by-submittal/', { project_id: new URL(page.requestUrl).searchParams.get('project_id') })).data;
  expect(sum(rows, 'total_co2_kg')).toBe(data.total_co2_kg);
  for (const [label, expected] of [['Total CO2 (tonnes)', data.total_co2_tonnes], ['Total CO2 (kg)', data.total_co2_kg], ['Total Distance (km)', data.total_distance_km]]) {
    const card = page.main.getByText(label, { exact: true }).locator('..'); await expect(card).toHaveCount(1);
    expect(number(await card.innerText()), label).toBe(expected);
  }
});
test('Analytics: Inventory Report uses selected project and returns structured consumption records', async ({ readonly: ctx }, info) => {
  const page = new AnalyticsPage(ctx.page); const body = await page.load('inventory', ctx.config);
  expect(new URL(page.requestUrl).searchParams.get('project_id')).toBe(await ctx.projectSelector.activeProjectReference());
  expect(Array.isArray(body.data)).toBe(true);
  await info.attach('inventory-report-source', { body: Buffer.from(JSON.stringify(body)), contentType: 'application/json' });
  const fixture = requireValue(ctx.allocation.analytics?.inventory, 'Inventory Report positive balance/consumption oracle needs allocated material/site IDs and confirmed date basis');
  const match = body.data.filter(r => r.material_master_id === fixture.materialId); expect(match).toHaveLength(1);
  const ledger = (await ctx.read('ledger_balance/list_inv_materials/', { project_id: fixture.projectId, site_master_id: fixture.siteId })).data;
  const material = ledger.filter(r => r.material_master_id === fixture.materialId); expect(material).toHaveLength(1);
  expect(match[0].closing_balance).toBe(material[0].inventory);
});
test('Analytics: Status Report quantity columns reproduce returned record values', async ({ readonly: ctx }) => {
  const page = new AnalyticsPage(ctx.page); const body = await page.load('status', ctx.config);
  await page.tableFields(body.data, 'Submittals', { Submittals: 'submittal_no', Material: 'material_name', Supplier: 'supplier_name',
    'QTY Ordered On Time': 'ordered_on_time', 'QTY Not Ordered and Safe': 'not_ordered_safe', 'QTY Delivered On Time': 'delivered_on_time', 'QTY With Issues': 'with_issues' });
});
