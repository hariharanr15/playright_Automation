const { randomUUID } = require('crypto');
const { test, expect } = require('../../../fixtures/procurementReadonlyTest');

test('Procurement smoke: exact owned submittal Search preserves project, site and material identity', async ({ procurementReadonly: ctx }) => {
  const row = await ctx.procurement.searchExactSubmittal(ctx.fixture.data.submittalNumber);
  await ctx.assertContext();
  for (const value of [ctx.fixture.data.specificationNumber, ctx.fixture.master.material_name, ctx.fixture.data.supplier]) {
    await expect(row).toContainText(value);
  }
});

test('Procurement smoke: unique no-match Search and reset restore the exact owned record', async ({ procurementReadonly: ctx }) => {
  await ctx.procurement.searchExactSubmittal(ctx.fixture.data.submittalNumber);
  const search = ctx.page.locator('input[placeholder^="Search submittals"]');
  const query = `qa-no-match-${randomUUID()}`;
  const loaded = ctx.page.waitForResponse(response => response.request().method() === 'GET' &&
    new URL(response.url()).pathname.includes('/submittal_master/list_submittals_by_project_id') &&
    [...new URL(response.url()).searchParams.values()].includes(query));
  await search.fill(query);
  await search.press('Enter');
  expect((await loaded).ok()).toBe(true);
  await expect(search).toHaveValue(query);
  await expect(ctx.page.locator('main table tbody tr').filter({ has: ctx.page.locator('td:nth-child(2)') })).toHaveCount(0);
  await ctx.assertContext();
  const restored = await ctx.procurement.searchExactSubmittal(ctx.fixture.data.submittalNumber);
  await expect(restored).toContainText(ctx.fixture.master.material_name);
  await ctx.assertContext();
});

test('Procurement smoke: exact saved component identity, date, quantity and UOM', async ({ procurementReadonly: ctx }, info) => {
  const row = await ctx.procurement.searchExactSubmittal(ctx.fixture.data.submittalNumber);
  const loaded = ctx.page.waitForResponse(response => response.request().method() === 'GET' &&
    new URL(response.url()).pathname === '/api/submittal_schedule/list_submittal_schedules/' &&
    new URL(response.url()).searchParams.get('submittal_id') === ctx.fixture.submittal.submittal_id);
  await row.getByRole('cell', { name: ctx.fixture.data.specificationNumber, exact: true }).click();
  const response = await loaded;
  expect(response.status()).toBe(200);
  const records = (await response.json()).data.schedules;
  const matches = records.filter(record => record.submittal_schedule_id === ctx.component.submittal_schedule_id);
  expect(matches).toHaveLength(1);
  expect(matches[0]).toEqual(ctx.component);
  // The component row is identified by its material; row actions depend on its delivery state.
  const component = ctx.procurement.componentRow(ctx.fixture.master.material_name);
  await expect(component).toHaveCount(1);
  await expect(component).toBeVisible();
  await expect(component).toContainText(ctx.component.uom_name);
  const date = ctx.fixture.schedule.date_required_on_site.split('-').reverse().join('/');
  await expect(component).toContainText(date);
  const cells = await component.getByRole('cell').allTextContents();
  const headers = await component.locator('xpath=ancestor::table[1]').getByRole('columnheader').allTextContents();
  const quantities = headers.map((label, index) => /^(?:qty\.?|quantity|actual quantity)$/i.test(label.trim()) ? index : -1).filter(index => index >= 0);
  expect(quantities, 'One exact component quantity column is required').toHaveLength(1);
  const quantityText = cells[quantities[0]].trim().replace(/,/g, '');
  const unitSuffix = ` ${ctx.component.uom_name}`;
  expect(quantityText.endsWith(unitSuffix), 'Quantity column must display the exact saved UOM').toBe(true);
  const quantity = quantityText.slice(0, -unitSuffix.length).trim();
  expect(quantity, 'Quantity preceding the saved UOM must be numeric').toMatch(/^\d+(?:\.\d+)?$/);
  expect(Number(quantity)).toBe(Number(ctx.component.actual_quantity));
  await ctx.assertContext();
  await info.attach('procurement-component-rendered-cells', { body: Buffer.from(JSON.stringify(cells)), contentType: 'application/json' });
});
