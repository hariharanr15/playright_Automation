const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');
const { test } = require('../../fixtures/baseTest');
const { highlight } = require('../../utils/highlight');
const { redactUrl } = require('../../utils/evidence');
const { captureEvidence } = require('../../utils/evidence');
const { getScreenshotOptions, getStepDelayMs } = require('../../utils/execution-mode');

test.afterEach(async ({ page, runData }, testInfo) => {
  if (runData?.dataUsage?.length) {
    await testInfo.attach('automation-data-usage', {
      body: Buffer.from(JSON.stringify({
        runId: runData.runId,
        dataUsage: runData.dataUsage
      }, null, 2)),
      contentType: 'application/json'
    });
  }

  if (testInfo.status === testInfo.expectedStatus) {
    return;
  }

  await testInfo.attach('failed-page-url', {
    body: redactUrl(page.url()),
    contentType: 'text/plain'
  });

  const screenshotPath = testInfo.outputPath('failure.png');
  await page.screenshot(getScreenshotOptions({ path: screenshotPath })).catch(() => null);

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
      'pointer-events: none',
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

async function hideStepBanner(page) {
  await page.evaluate(() => document.getElementById('scp-automation-step-banner')?.remove()).catch(() => null);
}

async function runStep(page, title, action, validate, timing = {}) {
  // Fast mode ignores per-step pacing overrides; synchronisation comes from the step's own waits.
  const waitMs = getStepDelayMs() > 0 ? (timing.waitMs ?? getStepDelayMs()) : 0;
  const afterActionWaitMs = getStepDelayMs() > 0 ? (timing.afterActionWaitMs ?? 0) : 0;
  // timing.scp passes step-policy options (mutation, verify) to the managed step.
  await test.step(title, async () => {
    await showStepBanner(page, title);
    if (waitMs > 0) await page.waitForTimeout(waitMs);
    await hideStepBanner(page);
    try {
      await action();

      if (afterActionWaitMs > 0) {
        await page.waitForTimeout(afterActionWaitMs);
      }

      if (validate) {
        await validate();
      }

      const info = test.info();
      const stepNumber = info.attachments.filter((item) => item.name.startsWith('step-')).length + 1;
      const screenshotPath = await captureEvidence(
        page,
        null,
        `${info.title}_Step_${String(stepNumber).padStart(2, '0')}_${title}`
      );
      await info.attach(`step-${String(stepNumber).padStart(2, '0')}-${title}`, {
        path: screenshotPath,
        contentType: 'image/png'
      });

      if (waitMs > 0) await page.waitForTimeout(waitMs);
    } finally {
      await hideStepBanner(page);
    }
  }, timing.scp ? { scp: timing.scp } : undefined);
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
