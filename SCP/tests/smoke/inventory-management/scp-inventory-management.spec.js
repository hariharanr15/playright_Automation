const { randomUUID } = require('crypto');
const { test, expect, inventoryStep } = require('../../../fixtures/inventoryTest');
const { prepareContext } = require('../../support/inventory-management-flow');

test('Inventory smoke: exact context, material identity, Search, no-match and reset', async ({ inventory: ctx }) => {
  await prepareContext(ctx);
  const baseline = (await ctx.read('ledger_balance/list_inv_materials/', { site_master_id: ctx.siteId })).data;
  const expected = baseline.find(m => m.material_master_id === ctx.reference.material_master_id);
  expect(expected, 'Configured reference material belongs to the selected Inventory site').toBeTruthy();
  await inventoryStep(ctx.page, 'Search exact material and verify identity, UOM and server balance', async () => {
    await ctx.assertContext();
    await ctx.inv.expectMaterial(ctx.reference, Number(expected.inventory));
    for (const query of [ctx.reference.material_id, ctx.reference.material_name.toUpperCase(), ctx.reference.material_name.slice(0, -1)]) {
      await ctx.inv.searchInput.fill(query);
      await expect(ctx.inv.materialRow(ctx.reference.material_name)).toHaveCount(1);
      await expect(ctx.inv.materialRow(ctx.reference.material_name)).toBeVisible();
    }
  });
  await inventoryStep(ctx.page, 'Reject nonmatching Search and restore material', async () => {
    await ctx.inv.searchInput.fill(`absent-${randomUUID()}`);
    await expect(ctx.inv.main.locator('tbody tr').filter({ has: ctx.page.locator('td:nth-child(2)') })).toHaveCount(0);
    await expect(ctx.inv.main.getByText('No data available', { exact: true })).toBeVisible();
    await ctx.inv.searchInput.fill('');
    await ctx.inv.expectMaterial(ctx.reference, Number(expected.inventory));
  });
});

test('Inventory smoke: Location, Submittals and UOM views retain exact material identity', async ({ inventory: ctx }) => {
  const { numeric } = require('../../../utils/inventory-data');
  await prepareContext(ctx);
  for (const view of ['Location', 'Submittals', 'UOM']) {
    await inventoryStep(ctx.page, `Verify ${view} for the configured material`, async () => {
      await ctx.assertContext();
      const drawer = await ctx.inv.openView(ctx.reference.material_name, view);
      for (const [label, value] of [['Material ID', ctx.reference.material_id], ['Material Name', ctx.reference.material_name], ['UOM', ctx.reference.uom_name]]) {
        await expect(drawer.getByText(label, { exact: true }).locator('..').locator('p').last()).toHaveText(value);
      }
      const records = ctx.inv.lastViewData;
      expect(Array.isArray(records), `${view} should return structured records`).toBe(true);
      expect(records.length, `The configured reference must have ${view} records`).toBeGreaterThan(0);
      for (const record of records) {
        const key = view === 'Location' ? record.location_name : view === 'UOM' ? record.item_name : record.submittal_no;
        const row = drawer.getByRole('row').filter({ has: ctx.page.getByRole('cell', { name: key, exact: true }) });
        await expect(row).toHaveCount(1);
        if (view !== 'Submittals') {
          await expect.poll(async () => numeric(await row.getByRole('cell').last().innerText())).toBe(Number(record.total_value_sum));
        }
      }
      await ctx.reset();
    });
  }
});

test('Inventory smoke: required fields and action-dependent destination without stock changes', async ({ inventory: ctx }) => {
  await prepareContext(ctx);
  await ctx.inv.openView(ctx.reference.material_name, 'Actions');
  await ctx.inv.openActivity();
  await ctx.inv.expectRejected('Item is required');
  for (const label of ['Action', 'From Location', 'QTY', 'Comments', 'Supplier', 'Subcontractor', 'Submittal', 'Schedule']) {
    await expect(ctx.page.getByText(`${label} is required`, { exact: true })).toBeVisible();
  }
  await ctx.inv.choose('Action', 'Internal Movement');
  await ctx.inv.expectRejected('To Location is required');
  await ctx.inv.choose('Action', 'Incoming Load');
  await expect(ctx.inv.form.getByText('To Location', { exact: false })).toHaveCount(0);
  await ctx.inv.cancelActivity();
  await ctx.inv.openActivity();
  await expect(ctx.inv.field('QTY').getByRole('spinbutton')).toHaveValue('');
  await expect(ctx.inv.field('Comments').getByRole('textbox')).toHaveValue('');
  await ctx.inv.cancelActivity();
});
