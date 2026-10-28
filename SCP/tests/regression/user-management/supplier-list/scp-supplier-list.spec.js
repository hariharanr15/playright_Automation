const { test, expect, runStep: baseRunStep } = require('../../../support/test-base');
const { SupplierListPage } = require('../../../../pages/user-management/supplier-list/supplier-list.page');

const pause = Number(process.env.SCP_MODULE_OPERATION_PAUSE_MS || 1500);
const runStep = (page, title, action, validate, scp) => baseRunStep(page, title, action, validate,
  { waitMs: pause, afterActionWaitMs: pause, scp });

test('Supplier List: create, find, map, filter, and export', async ({ scpProject, runData }) => {
  const { page } = scpProject;
  const suppliers = new SupplierListPage(page);
  let supplier;
  await runStep(page, 'Open Supplier List', () => suppliers.open());
  // Existing project suppliers are read first; numbers already used by earlier runs are skipped.
  await runStep(page, 'Choose an unused supplier name', async () => {
    const chosen = await suppliers.uniqueSupplier(() => runData.nextSequence());
    supplier = chosen.supplier;
    runData.captureData('supplier', { name: supplier.name, email: supplier.email }, 'Supplier List');
    await test.info().attach('supplier-name-selection', { body: Buffer.from(JSON.stringify({ chosen: supplier.name, skippedExisting: chosen.skipped, existingSuppliers: chosen.existingCount }, null, 2)), contentType: 'application/json' });
  });
  await runStep(page, 'Create unique supplier', () => suppliers.create(supplier), async () => {
    await expect(page.getByRole('row').filter({ hasText: supplier.email })).toContainText(supplier.name);
  }, { mutation: true, verify: () => suppliers.verifySupplier(supplier) });
  await runStep(page, 'Export supplier list', async () => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
    await download.saveAs(test.info().outputPath(download.suggestedFilename()));
  });
  await runStep(page, 'Open bulk mapping', () => suppliers.openBulkMap());
  await runStep(page, 'Filter supplier selection', async () => {
    await page.getByPlaceholder(/Filter by supplier name/).fill(supplier.name);
    await expect(page.getByRole('row').filter({ hasText: supplier.name })).toBeVisible();
  });
  await runStep(page, 'Select supplier and material', async () => {
    await page.getByRole('row').filter({ hasText: supplier.name }).locator('input[type=checkbox]').check();
    const material = page.getByRole('row').filter({ hasText: 'Mobile Battery' }).first();
    await material.locator('input[type=checkbox]').check();
    await expect(page.getByRole('button', { name: 'Selected only (1)' })).toHaveCount(2);
  });
  await runStep(page, 'Create material mapping', async () => {
    await page.getByRole('button', { name: 'Map Suppliers to Materials' }).click();
    await expect(page.getByRole('heading', { name: 'Default Lead Time' })).toBeVisible();
    await page.getByPlaceholder('e.g. 2 or 0.5').fill('1');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Default Lead Time' })).toBeHidden({ timeout: 30000 });
    const stagedRow = page.getByRole('row').filter({ hasText: supplier.name }).filter({ hasText: 'Lava Agni Battery' });
    await expect(stagedRow).toContainText('New');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeHidden({ timeout: 30000 });
  });
});
