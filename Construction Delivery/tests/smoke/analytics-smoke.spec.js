const {
  expect,
  openAuthenticatedDashboard,
  runStep,
  test
} = require('../support/test-base');
const { AnalyticsPage } = require('../../pages/booking/analytics.page');

test.describe('Smoke Tests - Analytics @analytics @smoke', () => {
  test.use({ permissions: ['notifications'] });

  test('Analytics summary opens without changing data @analytics-smoke', async ({ page }) => {
    const analytics = new AnalyticsPage(page);

    await runStep(page, 'Open authenticated dashboard', async () => {
      await openAuthenticatedDashboard(page);
    });

    await runStep(page, 'Open Analytics summary', async () => {
      await analytics.openAnalyticsSection('Summary Emission');
    }, async () => {
      await expect(page.locator('body')).toContainText(/Summary Emission|Vehicle Emissions|Equipment Emissions/i);
    });
  });
});
