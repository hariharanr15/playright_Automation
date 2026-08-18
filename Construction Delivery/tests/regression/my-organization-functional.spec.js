const {
  expect,
  expectVisible,
  runStep,
  test
} = require('../support/test-base');
const { MyOrganizationPage } = require('../../pages/booking/my-organization.page');

test.use({ storageState: undefined });

test.describe('Regression Tests - My Organization Functional Flow', () => {
  test('Regression TC-15 - My Organization details plus Users search and This Project Only are validated', async ({ page }) => {
    test.setTimeout(Number(process.env.MY_ORGANIZATION_FLOW_TIMEOUT_MS || 900000));

    const organization = new MyOrganizationPage(page);
    let details;
    let usersValidation;

    await runStep(page, 'Login from SSO page', async () => {
      await organization.openAuthenticatedShell();
    }, async () => {
      await expectVisible(page.locator('body'), 'Logged in application shell');
    });

    await runStep(page, 'Open My Organization from Account settings', async () => {
      await organization.openMyOrganization();
    }, async () => {
      await expectVisible(organization.organizationName, 'My Organization name field');
    });

    await runStep(page, 'Validate My Organization detail fields', async () => {
      details = await organization.updateOrganizationDetails();
    }, async () => {
      expect(details.before.organizationName, 'Organization name should be visible').toBeTruthy();
      expect(details.after.organizationName, 'Organization name should not be changed').toBe(details.before.organizationName);
      expect(details.submitted, 'Organization details should be saved after Trade Type update').toBeTruthy();
      expect(details.tradeTypeUpdated, 'Trade Type must be updated').toBeTruthy();
      expect(details.selectedTradeType, 'Selected Trade Type should be captured').toBeTruthy();
      expect(details.after.tradeType, 'Updated Trade Type should persist after save').toContain(details.selectedTradeType);
    });

    await runStep(page, 'Validate Users tab search and This project only', async () => {
      usersValidation = await organization.validateUsersSearchAndThisProjectOnly();
    }, async () => {
      expect(usersValidation.users.count, 'Users tab should show at least one user').toBeGreaterThan(0);
      expect(usersValidation.projectOnly.visible, 'This project only checkbox should be visible').toBeTruthy();
      expect(usersValidation.projectOnly.checked, 'This project only checkbox should be checked').toBeTruthy();
      expect(usersValidation.rowsAfterProjectOnly.count, 'This project only should keep at least one user visible').toBeGreaterThan(0);
      expect(usersValidation.searchTerm, 'Users search term should be captured').toBeTruthy();
      expect(usersValidation.searchResults.count, 'Users search should return at least one row').toBeGreaterThan(0);
      expect(usersValidation.clearedRows.count, 'Users list should still be visible after clearing search').toBeGreaterThan(0);
    });
  });
});
