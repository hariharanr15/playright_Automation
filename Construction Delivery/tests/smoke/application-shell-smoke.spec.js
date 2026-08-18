const {
  expect,
  openConfiguredProjectHome,
  runStep,
  test
} = require('../support/test-base');

test.describe('Smoke Tests - Application Shell @application @smoke', () => {
  test('Login and configured project home page open successfully @login @project-home', async ({ page }) => {
    await runStep(page, 'Log in and open configured project home page', async () => {
      await openConfiguredProjectHome(page);
    }, async () => {
      await expect(page.locator('body')).toContainText(/Account settings|Booking|Project Management|User Management|Analytics/i);
    });
  });
});
