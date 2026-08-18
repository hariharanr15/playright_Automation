const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');
const { test } = require('../../fixtures/baseTest');
const { highlight } = require('../../utils/highlight');

const STEP_WAIT_MS = Number(process.env.STEP_WAIT_MS || 700);

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) {
    return;
  }

  await testInfo.attach('failed-page-url', {
    body: page.url(),
    contentType: 'text/plain'
  });

  const screenshotPath = testInfo.outputPath('failure.png');
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => null);

  if (fs.existsSync(screenshotPath)) {
    await testInfo.attach('failure-screenshot', {
      path: screenshotPath,
      contentType: 'image/png'
    });
  }
});

async function showStepBanner(page, title) {
  await page.evaluate((stepTitle) => {
    const existing = document.getElementById('scp-automation-step-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'scp-automation-step-banner';
    banner.textContent = stepTitle;
    banner.style.cssText = [
      'position: fixed',
      'top: 12px',
      'left: 50%',
      'transform: translateX(-50%)',
      'z-index: 2147483647',
      'background: #111827',
      'color: #fff',
      'border: 3px solid #2563eb',
      'box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.22)',
      'border-radius: 6px',
      'padding: 10px 16px',
      'font: 600 14px Arial, sans-serif',
      'letter-spacing: 0'
    ].join(';');

    document.body.appendChild(banner);
  }, title).catch(() => null);
}

async function runStep(page, title, action, validate) {
  await test.step(title, async () => {
    await showStepBanner(page, title);
    await page.waitForTimeout(STEP_WAIT_MS);
    await action();

    if (validate) {
      await validate();
    }

    await page.waitForTimeout(STEP_WAIT_MS);
  });
}

async function expectVisible(locator, label, timeout = 20000) {
  await locator.first().waitFor({ state: 'visible', timeout });
  await highlight(locator.first(), label).catch(() => null);
  await expect(locator.first(), `${label} should be visible`).toBeVisible();
}

function requireMinimumTabs(tabs, count = 2) {
  if (!Array.isArray(tabs) || tabs.length < count) {
    throw new Error(`Configure at least ${count} SCP tabs using SCP_TAB_NAMES or test-data/scp-tabs.json.`);
  }
}

module.exports = {
  expect,
  expectVisible,
  path,
  requireMinimumTabs,
  runStep,
  test
};
