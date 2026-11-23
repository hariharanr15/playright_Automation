const { test, expect, runStep: baseRunStep } = require('../../support/test-base');

const OPERATION_PAUSE_MS = Number(process.env.SCP_MODULE_OPERATION_PAUSE_MS || 1500);
const runStep = (page, title, action, validate) => baseRunStep(page, title, action, validate, {
  waitMs: OPERATION_PAUSE_MS,
  afterActionWaitMs: OPERATION_PAUSE_MS
});

test('International Shipments opens as a separate SCP module', async ({ scpProject }) => {
  const { page } = scpProject;
  await runStep(page, 'Open International Shipments', async () => {
    await page.getByRole('button', { name: /^International Shipments(?:\s+\d+\+?)?$/i }).click();
    await expect(page).toHaveURL(/\/international-shipments\/?$/);
    await expect(page.getByText('International Shipments', { exact: true }).last()).toBeVisible();
  });
  await runStep(page, 'Reject an empty shipment form', async () => {
    await page.getByRole('button', { name: '+ Log Shipment', exact: true }).click();
    const modal = page.locator('div.fixed.inset-0').filter({ hasText: 'Log new shipment' }).last();
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'Log shipment', exact: true }).click();
    await expect(modal, 'An empty shipment must not be created').toBeVisible();
    await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(modal).toBeHidden();
  });
});
