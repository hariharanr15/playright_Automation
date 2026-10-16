const { chromium } = require('@playwright/test');
const { getBrowserLaunchOptions, getContextOptions } = require('../../utils/execution-mode');

let browser = null;
let context = null;
let page = null;

async function acquireBrowserSession(contextOverrides = {}) {
  if (browser?.isConnected() && context && page && !page.isClosed()) {
    return { browser, context, page };
  }

  browser = await chromium.launch(getBrowserLaunchOptions());
  context = await browser.newContext({ ...getContextOptions(), ...contextOverrides });
  page = await context.newPage();
  return { browser, context, page };
}

async function closeBrowserSession() {
  await context?.close().catch(() => null);
  await browser?.close().catch(() => null);
  browser = null;
  context = null;
  page = null;
}

module.exports = { acquireBrowserSession, closeBrowserSession };
