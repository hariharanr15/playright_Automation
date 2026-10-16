const { test, expect, runStep: baseRunStep } = require('../../support/test-base');

const OPERATION_PAUSE_MS = Number(process.env.SCP_MODULE_OPERATION_PAUSE_MS || 1500);
const runStep = (page, title, action, validate) => baseRunStep(page, title, action, validate, {
  waitMs: OPERATION_PAUSE_MS,
  afterActionWaitMs: OPERATION_PAUSE_MS
});

test('User Management opens independently and validates blank invitation', async ({ scpProject }) => {
  const { page } = scpProject;
  await runStep(page, 'Open User Management', async () => {
    await page.getByRole('button', { name: 'User Management', exact: true }).first().click();
    await page.getByRole('button', { name: 'User Management', exact: true }).last().click();
    await expect(page).toHaveURL(/\/user-management\/?$/);
    await expect(page.getByRole('button', { name: 'Invite Users' })).toBeVisible();
  });
  await runStep(page, 'Reject blank user invitation', async () => {
    await page.getByRole('button', { name: 'Invite Users' }).click();
    await expect(page.getByRole('button', { name: 'Send Invites', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  });
});
