const fs = require('fs');
const path = require('path');
const { test: base, expect } = require('@playwright/test');
const { DashboardPage } = require('../../pages/booking/dashboard.page');
const { highlight } = require('../../utils/highlight');

const STEP_WAIT_MS = Number(process.env.STEP_WAIT_MS || 1500);
const AUTH_STATE_PATH = path.resolve(__dirname, '..', '..', 'auth.json');
const DEFAULT_LOGIN_EMAIL = 'hariharan.r@neuralrays.ai';
const DEFAULT_LOGIN_PASSWORD = 'Master@15';

function loadEnvFile(filePath = path.resolve(__dirname, '..', '..', '.env')) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const test = base.extend({});

function authStateMatchesEmail(authStatePath, email) {
  if (!email || !fs.existsSync(authStatePath)) return false;

  return fs.readFileSync(authStatePath, 'utf8').includes(email);
}

function getLoginEmail() {
  return process.env.VC_EMAIL || DEFAULT_LOGIN_EMAIL;
}

function getLoginPassword() {
  return process.env.VC_PASSWORD || DEFAULT_LOGIN_PASSWORD;
}

test.use({
  storageState: authStateMatchesEmail(AUTH_STATE_PATH, getLoginEmail())
    ? AUTH_STATE_PATH
    : undefined
});

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

async function loginIfNeeded(page) {
  const emailField = page.locator([
    'input[type="email"]',
    'input[name*="email" i]',
    'input[id*="email" i]',
    'input[placeholder*="email" i]',
    'input[type="text"]'
  ].join(', ')).first();
  const passwordField = page.locator([
    'input[type="password"]',
    'input[name*="password" i]',
    'input[id*="password" i]',
    'input[placeholder*="password" i]'
  ].join(', ')).first();

  if (!(await emailField.isVisible({ timeout: 5000 }).catch(() => false))) {
    return;
  }

  const email = getLoginEmail();
  const password = getLoginPassword();
  if (!email || !password) {
    throw new Error('Login page is visible and VC_EMAIL/VC_PASSWORD are not configured in .env.');
  }

  await emailField.fill(email);
  await passwordField.fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click()
    .catch(async () => page.locator('button:has-text("Login"), input[type="submit"]').first().click());
  await page.waitForLoadState('domcontentloaded').catch(() => null);
  await page.waitForTimeout(1500);

  if (await emailField.isVisible({ timeout: 3000 }).catch(() => false)) {
    throw new Error('Login did not complete; check the configured smoke automation credentials.');
  }

  await page.context().storageState({ path: AUTH_STATE_PATH }).catch(() => null);
}

async function openAuthenticatedDashboard(page) {
  const baseUrl = process.env.BASE_URL || 'https://stg-login.voyagecontrol.com';

  await page.goto(`${baseUrl}/api/sso/users/login/`, { waitUntil: 'domcontentloaded' });
  await loginIfNeeded(page);

  await expect(page.locator('body')).toContainText(/V3 Construction deliveries|Buckingham Palace|Booking/i, {
    timeout: 30000
  });
}

async function openBookingList(page) {
  await openAuthenticatedDashboard(page);

  const dashboard = new DashboardPage(page);
  try {
    if (await dashboard.clickLocationProjectCard('Buckingham Palace')) {
      await dashboard.waitForPageState(dashboard.bookingMenu, 'Booking menu');
    } else {
      await dashboard.selectProject();
      await dashboard.selectLocation();
    }
    await dashboard.goToBookings();
  } catch (error) {
    console.log(`Dashboard navigation fallback to direct Booking List: ${error.message}`);
    const bookingUrl = 'https://stg-app.voyagecontrol.com/5ET10000010/booking';

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await page.goto(bookingUrl, { waitUntil: 'domcontentloaded' }).catch((gotoError) => {
        console.log(`Direct Booking List navigation attempt ${attempt} did not settle: ${gotoError.message}`);
      });

      await loginIfNeeded(page);
      await page.locator('[role="progressbar"], .MuiCircularProgress-root').first()
        .waitFor({ state: 'hidden', timeout: 30000 })
        .catch(() => null);
      await page.waitForTimeout(2000);

      if (await dashboard.clickLocationProjectCard('Buckingham Palace')) {
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
  openAuthenticatedDashboard,
  openBookingList,
  runStep,
  test
};
