const { test, requireMinimumTabs, runStep } = require('../support/test-base');
const { FirstTabPage } = require('../../pages/tabs/first-tab.page');
const { SecondTabPage } = require('../../pages/tabs/second-tab.page');
const { ScpTabPage } = require('../../pages/tabs/scp-tab.page');

test.describe('Regression Tests - SCP Configured Tabs', () => {
  test('Regression TC-01 - first two SCP tabs load through their page objects', async ({ scpApp }) => {
    const { page, appShell, config } = scpApp;
    requireMinimumTabs(config.tabs, 2);

    await runStep(page, `Validate ${config.tabs[0].name}`, async () => {
      const firstTab = new FirstTabPage(page, config.tabs[0]);
      await firstTab.open(appShell);
      await firstTab.validateDefaultState();
    });

    await runStep(page, `Validate ${config.tabs[1].name}`, async () => {
      const secondTab = new SecondTabPage(page, config.tabs[1]);
      await secondTab.open(appShell);
      await secondTab.validateDefaultState();
    });
  });

  test('Regression TC-02 - every configured SCP tab remains reachable', async ({ scpApp }) => {
    const { page, appShell, config } = scpApp;
    requireMinimumTabs(config.tabs, 2);

    for (const tab of config.tabs) {
      await runStep(page, `Navigate to ${tab.name}`, async () => {
        await new ScpTabPage(page, tab).open(appShell);
      });
    }
  });
});
