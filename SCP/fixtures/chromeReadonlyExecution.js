const path = require('path');
const { expect } = require('@playwright/test');
const { getScpConfig } = require('../config/scp.config');
const { loadInventoryEnvironment } = require('../utils/inventory-data');
const { excluded } = require('../utils/scp-readonly');
const { isHeadless } = require('../utils/execution-mode');

const safeSmokeFiles = [
  'smoke/enterprise/scp-enterprise.spec.js',
  'smoke/inventory-management/scp-inventory-management.spec.js',
  'smoke/management-dashboard/scp-management-dashboard.spec.js',
  'smoke/international-shipments/scp-international-shipments.spec.js',
  'smoke/user-management/scp-user-management.spec.js',
  'smoke/scp-tabs-smoke.spec.js'
];

// Opt-in only: the default framework and approved mutable suites are unchanged.
const executionFixtures = {
  chromeExecutionGuard: [async ({ scpSession }, use, info) => {
    const file = path.relative(path.resolve(__dirname, '../tests'), info.file).replace(/\\/g, '/');
    if (!safeSmokeFiles.includes(file)) throw new Error(`Not allowlisted for read-only smoke execution: ${file}`);
    const { page, context } = scpSession;
    const origin = new URL(getScpConfig().baseUrl).origin;
    const requests = []; const pageErrors = []; const renderErrors = [];
    const guard = async route => {
      const request = route.request(); const url = new URL(request.url());
      // SSO authentication has its own origin; this guard covers SCP business APIs.
      if (url.origin !== origin) return route.continue();
      const shellRead = request.method() === 'GET' && url.pathname === '/api/system_messages/active/';
      if ((!shellRead && excluded.test(url.pathname)) || !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        requests.push({ method: request.method(), path: url.pathname });
        return route.abort('blockedbyclient');
      }
      return route.continue();
    };
    const uncaught = error => { if (pageErrors.length < 30) pageErrors.push(error.message); };
    const consoleError = message => {
      if (message.type() === 'error' && /Unhandled render error caught by ErrorBoundary|Maximum update depth exceeded/.test(message.text()) && renderErrors.length < 30) renderErrors.push(message.text());
    };
    await context.route('**/api/**', guard);
    page.on('pageerror', uncaught); page.on('console', consoleError);
    try {
      await use();
      expect(requests, 'Read-only smoke must attempt no SCP business writes or excluded endpoints').toEqual([]);
      expect(pageErrors, 'No uncaught application errors').toEqual([]);
      expect(renderErrors, 'No hidden application render failures').toEqual([]);
    } finally {
      await context.unroute('**/api/**', guard);
      page.off('pageerror', uncaught); page.off('console', consoleError);
      await info.attach('chrome-execution-guard', { body: Buffer.from(JSON.stringify({ requests, pageErrors, renderErrors,
        browser: context.browser().version(), channel: 'chrome', headed: !info.project.use.headless })), contentType: 'application/json' });
      if (!page.isClosed()) {
        const image = await page.screenshot({ fullPage: isHeadless(), timeout: 5000 }).catch(() => null);
        if (image) await info.attach(info.status !== info.expectedStatus ? 'chrome-execution-failure' : 'chrome-execution-final', { body: image, contentType: 'image/png' });
      }
    }
  }, { auto: true }],
  chromeExecutionContext: [async ({ chromeExecutionGuard, scpProject }, use, info) => {
    const allocation = loadInventoryEnvironment();
    expect(allocation.project, 'Approved allocation must match configured project').toBe(scpProject.config.projectName);
    await scpProject.page.setViewportSize({ width: 1920, height: 1080 });
    await scpProject.projectSelector.expectActiveProject(allocation.project);
    await scpProject.siteSelector.ensureSite(allocation.site);
    expect(await scpProject.siteSelector.activeSiteName(), 'Exact approved starting site').toBe(allocation.site);
    const account = await scpProject.page.evaluate(() => JSON.parse(localStorage.getItem('userInfo') || '{}'));
    expect(account.ref, 'Authenticated account identity must be present').toBeTruthy();
    const username = scpProject.config.accounts[scpProject.config.defaultRole]?.username || scpProject.config.username;
    if (username.includes('@')) expect(account.email.toLowerCase(), 'Authenticated account must match configured credentials').toBe(username.trim().toLowerCase());
    const before = { project: await scpProject.projectSelector.activeProjectName(),
      projectRef: await scpProject.projectSelector.activeProjectReference(), site: await scpProject.siteSelector.activeSiteName(), accountRef: account.ref };
    try { await use(); }
    finally {
      const site = await scpProject.siteSelector.activeSiteName().catch(() => 'unavailable');
      await info.attach('chrome-execution-context', { body: Buffer.from(JSON.stringify({ before, after: { site },
        siteRetainedAtEnd: site === before.site,
        note: 'Starting context was asserted. Navigation-only smoke does not establish refresh/site persistence; business tests retain their own context assertions.' })), contentType: 'application/json' });
    }
  }, { auto: true }]
};
module.exports = { safeSmokeFiles, executionFixtures };
