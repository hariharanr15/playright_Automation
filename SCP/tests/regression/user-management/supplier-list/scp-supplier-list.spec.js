const { test, expect, runStep: baseRunStep } = require('../../../support/test-base');
const { SupplierListPage } = require('../../../../pages/user-management/supplier-list/supplier-list.page');

const pause = Number(process.env.SCP_MODULE_OPERATION_PAUSE_MS || 1500);
const runStep = (page, title, action, validate) => baseRunStep(page, title, action, validate,
  { waitMs: pause, afterActionWaitMs: pause });

test('Supplier List: create, find, map, filter, and export', async ({ scpProject, runData }) => {
  const { page } = scpProject;
  const suppliers = new SupplierListPage(page);
  const n = runData.nextSequence();
  const supplier = {
    name: `supplier${n}`,
    contact: `test user${n}`,
    email: `supplier${n}@yopmail.com`,
    phone: `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`
  };
  await runStep(page, 'Open Supplier List', () => suppliers.open());
  await runStep(page, 'Create unique supplier', () => suppliers.create(supplier), async () => {
    await expect(page.getByRole('row').filter({ hasText: supplier.email })).toContainText(supplier.name);
  });
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
