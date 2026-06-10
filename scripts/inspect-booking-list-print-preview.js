const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { DashboardPage } = require('../pages/dashboard.page');
const { Filter } = require('../pages/booking/Filter');

function loadEnvironment() {
  const envPath = path.resolve('.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) continue;
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = value;
    }
  }

  process.env.VC_EMAIL = process.env.VC_EMAIL || 'priyanka.dl@neuralrays.ai';
  process.env.VC_PASSWORD = process.env.VC_PASSWORD || '2C@53WsTQ#&ffSQ&';
}

async function waitForQuietPage(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => null);
  await page.locator('[role="progressbar"], .MuiCircularProgress-root').first()
    .waitFor({ state: 'hidden', timeout: 30000 })
    .catch(() => null);
  await page.waitForTimeout(1500);
}

async function loginIfNeeded(page) {
  const emailField = page.locator('input[type="email"], input[name*="email" i], input[id*="email" i], input[placeholder*="email" i], input[type="text"]').first();
  const passwordField = page.locator('input[type="password"], input[name*="password" i], input[id*="password" i], input[placeholder*="password" i]').first();
  if (!(await emailField.isVisible({ timeout: 5000 }).catch(() => false)) ||
      !(await passwordField.isVisible({ timeout: 5000 }).catch(() => false))) {
    return false;
  }

  await emailField.fill(process.env.VC_EMAIL);
  await passwordField.fill(process.env.VC_PASSWORD);
  await page.getByRole('button', { name: 'Login', exact: true }).click()
    .catch(async () => page.locator('button:has-text("Login"), input[type="submit"]').first().click());
  await waitForQuietPage(page);
  return true;
}

async function openBookingList(page) {
  const baseUrl = process.env.BASE_URL || 'https://stg-login.voyagecontrol.com';
  await page.goto(`${baseUrl}/api/sso/users/login/`, { waitUntil: 'domcontentloaded' });
  await waitForQuietPage(page);
  await loginIfNeeded(page);

  const dashboard = new DashboardPage(page);
  if (await dashboard.projectLink.isVisible({ timeout: 15000 }).catch(() => false) ||
      await dashboard.projectLinkFallback1.isVisible({ timeout: 1000 }).catch(() => false)) {
    await dashboard.selectProject();
  }
  if (await dashboard.location.isVisible({ timeout: 15000 }).catch(() => false) ||
      await dashboard.locationFallback1.isVisible({ timeout: 1000 }).catch(() => false)) {
    await dashboard.selectLocation();
  }

  await dashboard.goToBookings();
  await waitForQuietPage(page);
}

async function main() {
  loadEnvironment();
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    slowMo: 150
  });
  const context = await browser.newContext({
    acceptDownloads: true,
    storageState: fs.existsSync(path.resolve('auth.json')) ? path.resolve('auth.json') : undefined,
    viewport: { width: 1280, height: 720 }
  });
  const browserSession = await browser.newBrowserCDPSession();
  const page = await context.newPage();

  context.on('page', async (newPage) => {
    await newPage.waitForLoadState('domcontentloaded').catch(() => null);
    console.log('NEW PAGE:', newPage.url());
  });
  page.on('dialog', async (dialog) => {
    console.log('DIALOG:', dialog.type(), dialog.message());
    await dialog.dismiss().catch(() => null);
  });

  await openBookingList(page);
  const filter = new Filter(page);
  const result = await filter.applyCodegenRecordedFilterFlow({ includeCalendarRecordFlow: false });
  console.log('Filtered records:', result.finalRecordCount);

  console.log('Clicking app print icon...');
  await page.locator('button.dl-btn').nth(3).click({ force: true });
  await page.waitForTimeout(30000);
  console.log('Known pages:', context.pages().map((knownPage) => knownPage.url()));
  const targets = await browserSession.send('Target.getTargets').catch((error) => ({ error: error.message }));
  console.log('CDP targets:', JSON.stringify(targets, null, 2));
  const printTarget = targets.targetInfos?.find((target) => target.url === 'chrome://print/');
  if (printTarget) {
    const attach = await browserSession.send('Target.attachToTarget', {
      targetId: printTarget.targetId,
      flatten: true
    });
    const sessionId = attach.sessionId;
    const evaluate = async (expression) => browserSession.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      sessionId
    });

    const domInfo = await evaluate(`(() => {
      const deep = (root, depth = 0) => {
        if (!root || depth > 8) return [];
        const out = [];
        const nodes = root.querySelectorAll ? Array.from(root.querySelectorAll('*')) : [];
        for (const node of nodes) {
          const style = getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          const visible = style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
          if (/button|cr-button|print-preview|viewer|download|save/i.test(node.localName + ' ' + node.id + ' ' + node.className + ' ' + node.textContent)) {
            out.push({
              tag: node.localName,
              id: node.id,
              cls: String(node.className || ''),
              text: (node.innerText || node.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120),
              aria: node.getAttribute('aria-label') || '',
              visible,
              rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
            });
          }
          if (node.shadowRoot) out.push(...deep(node.shadowRoot, depth + 1));
        }
        return out;
      };
      return deep(document);
    })()`);
    console.log('Print preview DOM:', JSON.stringify(domInfo.result?.value, null, 2));
  }

  await context.close().catch(() => null);
  await browser.close().catch(() => null);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
