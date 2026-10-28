const { test: base, expect } = require('./baseTest');
const { InventoryManagementPage } = require('../pages/inventory-management/inventory-management.page');
const { loadInventoryEnvironment, InventoryBlocked, readInventoryApi } = require('../utils/inventory-data');
const { isHeadless } = require('../utils/execution-mode');

const test = base.extend({
  inventory: async ({ scpProject }, use, info) => {
    const { page, scpSession, projectSelector, siteSelector, config } = scpProject;
    await page.setViewportSize({ width: 1920, height: 1080 });
    const allocation = loadInventoryEnvironment();
    if (allocation.project !== config.projectName) throw new InventoryBlocked('Inventory allocation and SCP_PROJECT_NAME differ');
    if (!new URL(config.baseUrl).hostname.startsWith('stg-')) throw new InventoryBlocked('Inventory mutations are limited to configured staging');
    const inv = new InventoryManagementPage(page);
    const createdRecords = [];
    const events = [];
    const consoleListener = message => { if (message.type() === 'error' && events.length < 50) events.push(message.text()); };
    page.on('console', consoleListener);
    const assertContext = async () => {
      await projectSelector.expectActiveProject(allocation.project);
      await expect(siteSelector.siteSelector, 'Exact Inventory site').toHaveText(allocation.site);
    };
    const reset = async () => {
      await page.goto(config.managementDashboardUrl, { waitUntil: 'domcontentloaded' });
      await projectSelector.ensureProject(allocation.project);
      await siteSelector.ensureSite(allocation.site);
      await assertContext();
      await inv.open();
      await assertContext();
    };
    try {
      await page.goto(config.managementDashboardUrl, { waitUntil: 'domcontentloaded' });
      await projectSelector.ensureProject(allocation.project);
      await siteSelector.ensureSite(allocation.site);
      await assertContext();
      await use({ ...scpProject, allocation, inv, assertContext, reset,
        createdRecords,
        read: (endpoint, params) => readInventoryApi(page, endpoint, params) });
    } catch (error) {
      if (error instanceof InventoryBlocked) info.annotations.push({ type: 'blocked', description: error.message });
      throw error;
    } finally {
      page.off('console', consoleListener);
      await info.attach('inventory-created-records', { body: Buffer.from(JSON.stringify(createdRecords, null, 2)), contentType: 'application/json' });
      await info.attach('inventory-context', { body: Buffer.from(JSON.stringify({ project: await projectSelector.projectSelector.innerText({ timeout: 2000 }).catch(() => 'unavailable'), site: await siteSelector.siteSelector.innerText({ timeout: 2000 }).catch(() => 'unavailable') })), contentType: 'application/json' });
      await info.attach('inventory-console-errors', { body: Buffer.from(JSON.stringify(events)), contentType: 'application/json' });
      if (info.status !== info.expectedStatus) {
        const screenshot = await page.screenshot({ fullPage: isHeadless(), timeout: 5000 }).catch(() => null);
        if (screenshot) await info.attach('inventory-failure', { body: screenshot, contentType: 'image/png' });
        else await info.attach('inventory-screenshot-unavailable', { body: 'The application page was unresponsive; inspect console errors and trace.', contentType: 'text/plain' });
      }
    }
  }
});

async function inventoryStep(page, title, action) {
  await require('../utils/scp-step').managedStep(test, page, title, async () => {
    await action();
    await test.info().attach(title, { body: await page.screenshot({ fullPage: isHeadless() }), contentType: 'image/png' });
  }, { group: true });
}
module.exports = { test, expect, inventoryStep };
