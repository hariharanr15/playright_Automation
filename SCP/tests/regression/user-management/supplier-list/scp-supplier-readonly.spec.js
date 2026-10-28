const { randomUUID } = require('crypto');
const { test, expect } = require('../../../../fixtures/readonlyTest');
const { SupplierListPage } = require('../../../../pages/user-management/supplier-list/supplier-list.page');
const { isHeadless } = require('../../../../utils/execution-mode');

test('Supplier List: initialized required fields retain valid input and cancellation saves nothing', async ({ readonly: ctx }, info) => {
  const view = new SupplierListPage(ctx.page);
  await view.open();
  await ctx.assertContext();
  await view.openCreate();
  const identity = randomUUID().slice(0, 8);
  await view.fillForm({ name: `Unsaved QA ${identity}`, contact: `QA ${identity}`, email: `unsaved-${identity}@example.invalid`, phone: '9000000001' });
  await info.attach('supplier-initialized-form', { body: await ctx.page.screenshot({ fullPage: isHeadless() }), contentType: 'image/png' });
  await ctx.page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(ctx.page.getByRole('button', { name: /Add Supplier/i })).toBeVisible();
  await expect(ctx.page.getByText(`Unsaved QA ${identity}`, { exact: true })).toHaveCount(0);
  await ctx.assertContext();
});
