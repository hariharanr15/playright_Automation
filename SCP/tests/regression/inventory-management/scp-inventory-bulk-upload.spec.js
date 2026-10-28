const { test, expect } = require('../../../fixtures/inventoryTest');
const { InventoryBulkUploadPage } = require('../../../pages/inventory-management/inventory-bulk-upload.page');
const { inventoryUploadRows, writeInventoryWorkbook, readWorkbook } = require('../../../utils/bulk-upload/inventory-workbook');
const { createDataset, openOwnedActivity, verifyInventoryState, verifyBothSearches, ledger, details } = require('../../support/inventory-management-flow');
const { InventoryBlocked, exactOne } = require('../../../utils/inventory-data');
const { currentJournal } = require('../../../utils/scp-step');

async function setup(ctx, info, negative) {
  test.setTimeout(360000);
  if (process.env.SCP_INVENTORY_MUTATIONS !== 'true') throw new InventoryBlocked('Approved staging mutations must be enabled for owned bulk-upload setup');
  currentJournal()?.setData('inventoryBulkKind', negative ? 'negative' : 'positive');
  await createDataset(ctx, info);
  const rows = inventoryUploadRows(ctx.owned, ctx.allocation, negative);
  const dialog = new InventoryBulkUploadPage(ctx.page);
  await ctx.assertContext();
  await dialog.open();
  const live = await dialog.downloadTemplate(info.outputPath('bulk-upload/inventory/templates/live-template.xlsx'));
  const file = info.outputPath(`bulk-upload/inventory/${negative ? 'negative-atomicity' : 'positive-delivered-stock-actions'}.xlsx`);
  writeInventoryWorkbook(live, file, rows);
  for (const row of rows) {
    expect(row['Submittal No']).toBe(ctx.owned.data.submittalNumber);
    expect(row['Date Required On Site'].split('/').reverse().join('-')).toBe(ctx.owned.schedule.date_required_on_site);
    expect(row['PO Number']).toBe(ctx.owned.schedule.po_number || '');
  }
  await info.attach('inventory-upload-file', { path: file, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await info.attach('procurement-upload-date-contract', { body: Buffer.from(JSON.stringify({
    submittalId: ctx.owned.submittal.submittal_id, submittalNumber: ctx.owned.data.submittalNumber,
    componentId: ctx.owned.schedule.submittal_schedule_id, dateRequiredOnSite: ctx.owned.schedule.date_required_on_site, rows
  }, null, 2)), contentType: 'application/json' });
  return { dialog, file, rows };
}

// Exactly one retained negative upload scenario. No duplicate retry/upload-another-file flows.
test('Inventory bulk upload: reject one overdraft file atomically and download its errors', async ({ inventory: ctx }, info) => {
  const { dialog, file } = await setup(ctx, info, true);
  await ctx.assertContext();
  await dialog.submit(file);
  await dialog.expectFailure();
  const errorFile = await dialog.downloadErrors(info.outputPath('bulk-upload/inventory/errors/overdraft-errors.xlsx'));
  const errorContent = JSON.stringify(readWorkbook(errorFile));
  expect(errorContent).toContain(ctx.owned.data.submittalNumber);
  expect(errorContent).toMatch(/stock|available|insufficient/i);
  await info.attach('inventory-error-workbook', { path: errorFile, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await dialog.close();
  await ctx.reset();
  await ctx.inv.expectMaterial(ctx.owned.master, ctx.owned.baselineBalance);
  await ctx.inv.openView(ctx.owned.master.material_name, 'Actions');
  const saved = await ledger(ctx);
  expect([200, 201]).toContain(saved.status_code);
  expect(saved.data?.activities || []).toHaveLength(ctx.owned.baseline.activities.length);
  expect(Number(saved.data.closing_balance)).toBe(ctx.owned.baselineBalance);
  const schedules = (await ctx.read('submittal_schedule/list_submittal_schedules/', { submittal_id: ctx.owned.submittal.submittal_id })).data.schedules;
  expect(Number(exactOne(schedules, s => s.submittal_schedule_id === ctx.owned.schedule.submittal_schedule_id, 'Unchanged component').received_quantity)).toBe(Number(ctx.owned.data.deliveryQuantity));
  await verifyBothSearches(ctx, ctx.owned.baselineBalance);
});

test('Inventory bulk upload: four stock actions after delivered receipt with exact Procurement dates', async ({ inventory: ctx }, info) => {
  const { dialog, file, rows } = await setup(ctx, info, false);
  await ctx.assertContext();
  await dialog.submit(file);
  await dialog.expectSuccess();
  await dialog.close();
  await ctx.reset();
  const expected = ctx.owned.baselineBalance - 3 * ctx.owned.data.movementQuantity;
  await ctx.inv.expectMaterial(ctx.owned.master, expected);
  const display = await openOwnedActivity(ctx, 'Incoming Load');
  await ctx.inv.cancelActivity();
  const activities = rows.map(row => ({ ...display, action: row.Action, quantity: row.Quantity, comments: row.Comments,
    source: row['From Location'], destination: row['To Location'] }));
  ctx.owned.activities = activities;
  currentJournal()?.setData('inventoryOwned', ctx.owned);
  await verifyInventoryState(ctx, activities, expected);
  const metadata = await details(ctx, ctx.owned.master.material_master_id);
  const source = exactOne(metadata.locations, l => l.location_name === ctx.allocation.sourceLocation, 'Bulk source balance');
  const destination = exactOne(metadata.locations, l => l.location_name === ctx.allocation.destinationLocation, 'Bulk destination balance');
  expect(Number(source.available_quantity)).toBe(ctx.owned.baselineBalance - 4 * ctx.owned.data.movementQuantity);
  expect(Number(destination.available_quantity)).toBe(ctx.owned.data.movementQuantity);
  expect(Number(source.available_quantity) + Number(destination.available_quantity)).toBe(expected);
  await verifyBothSearches(ctx, expected);
});
