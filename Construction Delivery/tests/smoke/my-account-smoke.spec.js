const {
  expect,
  openAuthenticatedDashboard,
  runStep,
  test
} = require('../support/test-base');
const { MyAccountPage } = require('../../pages/booking/my-account.page');

test.describe('Smoke Tests - My Account @my-account @smoke', () => {
  test('My Account page opens without changing data @my-account-smoke', async ({ page }) => {
    const myAccount = new MyAccountPage(page);

    await runStep(page, 'Open authenticated dashboard', async () => {
      await openAuthenticatedDashboard(page);
    });

    await runStep(page, 'Open My Account', async () => {
      await myAccount.openMyAccount();
    }, async () => {
      await expect(page.locator('body')).toContainText(/My Details|My Preferences/i);
    });
  });
});
