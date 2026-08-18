const {
  expect,
  openAuthenticatedDashboard,
  runStep,
  test
} = require('../support/test-base');
const { AnalyticsPage } = require('../../pages/booking/analytics.page');

test.describe('Smoke Tests - Environment Reports @environment-reports @smoke', () => {
  test('Environment Reports page opens without changing data @environment-reports-smoke', async ({ page }) => {
    const analytics = new AnalyticsPage(page);

    await runStep(page, 'Open authenticated dashboard', async () => {
      await openAuthenticatedDashboard(page);
    });

    await runStep(page, 'Open Environment Reports', async () => {
      await analytics.openAnalyticsSection('Environment Reports');
    }, async () => {
      await expect(page.locator('body')).toContainText(/Environment Reports/i);
    });
  });
});
