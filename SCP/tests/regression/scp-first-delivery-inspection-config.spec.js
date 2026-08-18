const { test, expect, runStep, expectVisible } = require('../support/test-base');
const { PlatformChooserPage } = require('../../pages/platform-chooser.page');
const { ManagementDashboardPage } = require('../../pages/management-dashboard.page');

test.describe('Regression Tests - SCP First Delivery Inspection Config', () => {
  test('Regression TC-01 - open First Delivery Inspection Config from Project Management', async ({ scpApp }) => {
    const { page, config } = scpApp;
    const platformChooser = new PlatformChooserPage(page, config);
    const dashboard = new ManagementDashboardPage(page, config);

    await runStep(page, 'Select Supply Chain Planner platform', async () => {
      await platformChooser.openSupplyChainPlanner();
    });

    await runStep(page, 'Open First Delivery Inspection Config', async () => {
      await dashboard.expectLoaded();
      await dashboard.openFirstDeliveryInspectionConfig();
    }, async () => {
      await expect(page).toHaveURL(config.firstDeliveryInspectionConfigUrl);
      await expectVisible(page.locator('body'), 'First Delivery Inspection Config page');
    });
  });
});
