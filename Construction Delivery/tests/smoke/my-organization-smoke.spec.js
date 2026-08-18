const {
  expect,
  openAuthenticatedDashboard,
  runStep,
  test
} = require('../support/test-base');
const { MyOrganizationPage } = require('../../pages/booking/my-organization.page');

test.describe('Smoke Tests - My Organization @my-organization @smoke', () => {
  test('My Organization page opens without changing data @my-organization-smoke', async ({ page }) => {
    const myOrganization = new MyOrganizationPage(page);

    await runStep(page, 'Open authenticated dashboard', async () => {
      await openAuthenticatedDashboard(page);
    });

    await runStep(page, 'Open My Organization', async () => {
      await myOrganization.openMyOrganization();
    }, async () => {
      await expect(page.locator('body')).toContainText(/Organization/i);
    });
  });
});
