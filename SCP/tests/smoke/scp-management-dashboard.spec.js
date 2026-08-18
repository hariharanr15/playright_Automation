const { test, expect, runStep, expectVisible } = require('../support/test-base');
const { PlatformChooserPage } = require('../../pages/platform-chooser.page');
const { ManagementDashboardPage } = require('../../pages/management-dashboard.page');

test.describe('Smoke Tests - SCP Management Dashboard', () => {
  test('Smoke TC-01 - login and land on Management Dashboard', async ({ scpApp }) => {
    const { page, config } = scpApp;
    const platformChooser = new PlatformChooserPage(page, config);
    const dashboard = new ManagementDashboardPage(page, config);

    await runStep(page, 'Select Supply Chain Planner Supply card and app link', async () => {
      await platformChooser.openSupplyChainPlanner();
    });

    await runStep(page, 'Open Management Dashboard', async () => {
      await dashboard.open();
      await dashboard.expectLoaded();
    }, async () => {
      await expect(page).toHaveURL(config.managementDashboardUrl);
      await expectVisible(page.getByRole('heading', { name: /Management Dashboard/i }), 'Management Dashboard heading');
    });
  });
});
