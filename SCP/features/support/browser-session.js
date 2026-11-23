const { chromium } = require('@playwright/test');
const { getBrowserLaunchOptions, getContextOptions } = require('../../utils/execution-mode');
const { installActiveNavigationHighlight } = require('../../utils/active-navigation');
const sharedBrowser = require('../../utils/shared-browser');

let browser = null;
let context = null;
let page = null;

async function acquireBrowserSession(contextOverrides = {}) {
  if (browser?.isConnected() && context && page && !page.isClosed()) {
    return { browser, context, page };
  }

  if (sharedBrowser.isSharedBrowser()) {
    // Full-regression runs attach to the run's single Chrome instance, context and tab.
    const { getScpConfig } = require('../../config/scp.config');
    const config = getScpConfig();
    browser = await sharedBrowser.connectSharedBrowser();
    ({ context, page } = await sharedBrowser.sharedContextAndPage(browser));
    await installActiveNavigationHighlight(context);
    await sharedBrowser.ensureAccountSession(page, config, config.accounts[config.defaultRole]?.username || config.username);
    return { browser, context, page };
  }

  browser = await chromium.launch(getBrowserLaunchOptions());
  context = await browser.newContext({ ...getContextOptions(), ...contextOverrides });
  await installActiveNavigationHighlight(context);
  page = await context.newPage();
  return { browser, context, page };
}

async function closeBrowserSession() {
  if (sharedBrowser.isSharedBrowser()) {
    // Disconnect only; the orchestrator closes the shared browser after the whole run.
    await browser?.close().catch(() => null);
  } else {
    await context?.close().catch(() => null);
    await browser?.close().catch(() => null);
  }
  browser = null;
  context = null;
  page = null;
}

module.exports = { acquireBrowserSession, closeBrowserSession };
