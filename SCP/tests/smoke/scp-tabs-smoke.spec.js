const { test, requireMinimumTabs, runStep } = require('../support/test-base');
const { ScpTabPage } = require('../../pages/tabs/scp-tab.page');

test.describe('Smoke Tests - SCP Tab Navigation', () => {
  test.describe.configure({ mode: 'serial' });

  test('Smoke TC-01 - configured SCP tabs are accessible', async ({ scpApp }) => {
    const { page, appShell, config } = scpApp;
    requireMinimumTabs(config.tabs, 2);

    for (const tab of config.tabs.slice(0, 2)) {
      await runStep(page, `Open ${tab.name}`, async () => {
        await new ScpTabPage(page, tab).open(appShell);
      });
    }
  });
});
