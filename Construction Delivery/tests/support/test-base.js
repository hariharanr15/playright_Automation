const fs = require('fs');
const path = require('path');
const { test: base, expect } = require('@playwright/test');
const { DashboardPage } = require('../../pages/booking/dashboard.page');
const { loadAutomationEnvironment } = require('../../utils/env');
const { highlight } = require('../../utils/highlight');
const { loginIfVisible } = require('../../utils/login');
const { redactSensitiveCodes } = require('../../utils/redaction');

const STEP_WAIT_MS = Number(process.env.STEP_WAIT_MS || 0);
const VISUAL_EFFECTS_DISABLED = /^(1|true|yes)$/i.test(process.env.DISABLE_AUTOMATION_VISUALS || '');
const AUTH_STATE_PATH = path.resolve(__dirname, '..', '..', 'auth.json');
const DEFAULT_LOGIN_EMAIL = 'hariharan.r@neuralrays.ai';
const DEFAULT_LOGIN_PASSWORD = 'Master@15';

loadAutomationEnvironment();

async function enforceBrowserScale(page) {
  await page.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => {
      document.documentElement.style.zoom = '100%';
      document.body.style.zoom = '100%';
    }, { once: true });
  }).catch(() => null);

  const session = await page.context().newCDPSession(page).catch(() => null);
  if (session) {
    await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 }).catch(() => null);
    await session.detach().catch(() => null);
  }
}

const test = base.extend({
  sharedContext: [async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: authStateMatchesEmail(AUTH_STATE_PATH, getLoginEmail())
        ? AUTH_STATE_PATH
        : undefined,
      permissions: ['notifications'],
      viewport: null,
      ignoreHTTPSErrors: true
    });

    await use(context);
    await context.close().catch(() => null);
  }, { scope: 'worker' }],

  sharedPage: [async ({ sharedContext }, use) => {
    const page = await sharedContext.newPage();
    page.setDefaultTimeout(Number(process.env.PLAYWRIGHT_DEFAULT_TIMEOUT_MS || 45000));
    page.setDefaultNavigationTimeout(Number(process.env.PLAYWRIGHT_DEFAULT_NAVIGATION_TIMEOUT_MS || 45000));
    await enforceBrowserScale(page);

    await use(page);
    await page.close().catch(() => null);
  }, { scope: 'worker' }],

  context: async ({ sharedContext }, use) => {
    await use(sharedContext);
  },

  page: async ({ sharedPage }, use) => {
    await enforceBrowserScale(sharedPage);
    await use(sharedPage);
  }
});

function authStateMatchesEmail(authStatePath, email) {
  if (!email || !fs.existsSync(authStatePath)) return false;

  try {
    const state = JSON.parse(fs.readFileSync(authStatePath, 'utf8'));
    const nowInSeconds = Date.now() / 1000;
    return (state.cookies || []).some((cookie) =>
      cookie.name === 'sessionid' &&
      /voyagecontrol\.com$/i.test(cookie.domain || '') &&
      (cookie.expires === -1 || Number(cookie.expires) > nowInSeconds)
    );
  } catch {
    return false;
  }
}

function getLoginEmail() {
  return process.env.VC_EMAIL || DEFAULT_LOGIN_EMAIL;
}

function getLoginPassword() {
  return process.env.VC_PASSWORD || DEFAULT_LOGIN_PASSWORD;
}

function getConfiguredProjectId() {
  return process.env.PROJECT_ID || process.env.BUCKINGHAM_PALACE_PROJECT_ID || '';
}

function getConfiguredProjectName() {
  return process.env.PROJECT_NAME || process.env.BUCKINGHAM_PALACE_PROJECT_NAME || '';
}

test.use({});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) {
    return;
  }

  await testInfo.attach('failed-page-url', {
    body: redactSensitiveCodes(page.url()),
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
  if (VISUAL_EFFECTS_DISABLED) {
    return;
  }

  await page.evaluate((stepTitle) => {
    const existing = document.getElementById('vc-automation-step-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'vc-automation-step-banner';
    banner.textContent = stepTitle;
    banner.style.cssText = [
      'position: fixed',
      'top: 12px',
      'left: 50%',
      'transform: translateX(-50%)',
      'z-index: 2147483647',
      'background: #111827',
      'color: #fff',
      'border: 3px solid #ff2d55',
      'box-shadow: 0 0 0 6px rgba(255, 45, 85, 0.22)',
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
    if (STEP_WAIT_MS > 0) {
      await page.waitForTimeout(STEP_WAIT_MS);
    }
    await action();
    if (validate) {
      await validate();
    }
    if (STEP_WAIT_MS > 0) {
      await page.waitForTimeout(STEP_WAIT_MS);
    }
  });
}

async function expectVisible(locator, label, timeout = 20000) {
  await locator.first().waitFor({ state: 'visible', timeout });
  await highlight(locator.first(), label).catch(() => null);
  await expect(locator.first(), `${label} should be visible`).toBeVisible();
}

async function loginIfNeeded(page) {
  return loginIfVisible(page, {
    email: getLoginEmail(),
    password: getLoginPassword(),
    visibleTimeout: 5000,
    postLoginWaitMs: 1500,
    missingCredentialsMessage: 'Login page is visible and VC_EMAIL/VC_PASSWORD are not configured in .env.',
    errorMessage: 'Login did not complete; check the configured smoke automation credentials.',
    storageStatePath: AUTH_STATE_PATH
  });
}

async function gotoWithSsoRedirectTolerance(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' }).catch((error) => {
    if (!/ERR_ABORTED|Navigation interrupted|interrupted by another navigation|net::ERR_ABORTED/i.test(error.message)) {
      throw error;
    }
  });
}

async function waitForAutomationShell(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => null);
  await page.locator('[role="progressbar"], .MuiCircularProgress-root')
    .first()
    .waitFor({ state: 'hidden', timeout: 30000 })
    .catch(() => null);
}

async function isAuthenticatedAppState(page) {
  const appUrl = (process.env.APP_URL || 'https://stg-app.voyagecontrol.com').replace(/\/$/, '');
  const url = page.url();
  if (!url.startsWith(appUrl) && !/\/api\/sso\/platforms\/choose/i.test(url)) {
    return false;
  }

  const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
  return /Choose Project|Buckingham Palace|Booking|Project Management|User Management|Analytics|Construction Delivery|V3 Construction deliveries/i.test(bodyText);
}

async function completeAuthenticationHandoff(page, dashboard) {
  const appUrl = (process.env.APP_URL || 'https://stg-app.voyagecontrol.com').replace(/\/$/, '');

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await waitForAutomationShell(page);

    if (await loginIfNeeded(page)) {
      await page.waitForLoadState('domcontentloaded').catch(() => null);
      await page.waitForTimeout(1000);
    }

    if (await dashboard.openPlatformIfChooser().catch(() => false)) {
      await page.waitForLoadState('domcontentloaded').catch(() => null);
      await page.waitForTimeout(1000);
    }

    await waitForAutomationShell(page);
    if (await isAuthenticatedAppState(page)) {
      return true;
    }

    if (!page.url().startsWith(appUrl) && !/\/api\/sso\/users\/login/i.test(page.url())) {
      await gotoWithSsoRedirectTolerance(page, `${appUrl}/login`);
    } else {
      await page.waitForTimeout(1000);
    }
  }

  return isAuthenticatedAppState(page);
}

async function openAuthenticatedDashboard(page) {
  const appUrl = (process.env.APP_URL || 'https://stg-app.voyagecontrol.com').replace(/\/$/, '');
  const dashboard = new DashboardPage(page);

  if (!(await isAuthenticatedAppState(page))) {
    await gotoWithSsoRedirectTolerance(page, `${appUrl}/login`);
  }

  if (!(await completeAuthenticationHandoff(page, dashboard))) {
    throw new Error(`Could not complete authenticated app handoff. Current URL: ${page.url()}`);
  }

  await page.context().storageState({ path: AUTH_STATE_PATH }).catch(() => null);

  const configuredProjectId = getConfiguredProjectId();
  if (configuredProjectId) {
    await dashboard.openConfiguredProjectHome();
  }

  const projectName = getConfiguredProjectName();
  const projectPattern = projectName ? `${projectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|` : '';
  await expect(page.locator('body')).toContainText(new RegExp(`Construction Delivery|V3 Construction deliveries|${projectPattern}Booking|Project`, 'i'), {
    timeout: 30000
  });

  if (configuredProjectId) {
    await expect(page, `Automation must stay in configured project ${configuredProjectId}`).toHaveURL(
      new RegExp(`/${configuredProjectId}(?:/|$)`, 'i')
    );
  }
}

async function openConfiguredProjectHome(page) {
  await openAuthenticatedDashboard(page);
  const dashboard = new DashboardPage(page);
  await dashboard.openConfiguredProjectHome();
}

async function openBookingList(page) {
  await openAuthenticatedDashboard(page);

  const dashboard = new DashboardPage(page);
  const projectName = getConfiguredProjectName() || 'Buckingham Palace';
  try {
    if (await dashboard.clickLocationProjectCard(projectName)) {
      await dashboard.waitForPageState(dashboard.bookingMenu, 'Booking menu');
    } else {
      await dashboard.selectProject();
      await dashboard.selectLocation();
    }
    await dashboard.goToBookings();
  } catch (error) {
    console.log(`Dashboard navigation fallback to direct Booking List: ${error.message}`);
    const appUrl = process.env.APP_URL || 'https://stg-app.voyagecontrol.com';
    const projectId = process.env.PROJECT_ID || process.env.BUCKINGHAM_PALACE_PROJECT_ID || '5ET10000010';
    const bookingUrl = `${appUrl.replace(/\/$/, '')}/${projectId}/booking`;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await page.goto(bookingUrl, { waitUntil: 'domcontentloaded' }).catch((gotoError) => {
        console.log(`Direct Booking List navigation attempt ${attempt} did not settle: ${gotoError.message}`);
      });

      await loginIfNeeded(page);
      await page.locator('[role="progressbar"], .MuiCircularProgress-root').first()
        .waitFor({ state: 'hidden', timeout: 30000 })
        .catch(() => null);
      await page.waitForTimeout(2000);

      if (await dashboard.clickLocationProjectCard(projectName)) {
        await dashboard.waitForPageState(dashboard.bookingMenu, 'Booking menu').catch(() => null);
        await dashboard.goToBookings().catch(() => null);
      }

      if (await page.getByRole('button', { name: /New Booking/i }).isVisible({ timeout: 5000 }).catch(() => false)) {
        break;
      }
    }
  }

  await expectVisible(page.getByRole('button', { name: /New Booking/i }), 'New Booking button');
}

module.exports = {
  expect,
  expectVisible,
  loginIfNeeded,
  openAuthenticatedDashboard,
  openBookingList,
  openConfiguredProjectHome,
  runStep,
  test
};
