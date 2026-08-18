const {
  expectVisible,
  openAuthenticatedDashboard,
  runStep,
  test
} = require('../support/test-base');
const { UserManagementPage } = require('../../pages/booking/user-management.page');

test.describe('Smoke Tests - User Management @user-management @smoke', () => {
  test('User Management page and invite form open without submitting @user-management-smoke', async ({ page }) => {
    const userManagement = new UserManagementPage(page, { dryRun: true });

    await runStep(page, 'Open authenticated dashboard', async () => {
      await openAuthenticatedDashboard(page);
    });

    await runStep(page, 'Open User Management page', async () => {
      await userManagement.navigateToProjectLocation();
      await userManagement.navigateToUserManagement();
    }, async () => {
      await expectVisible(page.getByRole('button', { name: /Invite Users/i }), 'Invite Users button');
    });
  });
});
