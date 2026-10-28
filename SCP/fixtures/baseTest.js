const path = require('path');
const { test: base, expect } = require('@playwright/test');
const { loadEnvFile } = require('../utils/env');
const { getScpConfig } = require('../config/scp.config');
const { AppShellPage } = require('../pages/app-shell.page');
const { ManagementDashboardPage } = require('../pages/management-dashboard/management-dashboard.page');
const { PlatformChooserPage } = require('../pages/platform-chooser.page');
const { ProjectSelectorPage } = require('../pages/project-selector.page');
const { SiteSelectorPage } = require('../pages/site-selector.page');
const { createRunData } = require('../utils/dynamic-data');
const sharedBrowser = require('../utils/shared-browser');

loadEnvFile(path.resolve(__dirname, '..', '.env'));

// Shared-browser mode: browser, context and page all resolve to the run's single Chrome instance and tab,
// so no fixture can launch a second browser or open another tab.
const sharedBrowserFixtures = {
  browser: [async ({}, use) => {
    const browser = await sharedBrowser.connectSharedBrowser();
    await use(browser);
    // No browser.close() here: on this CDP connection it closed the shared tab (logged as tab closed, context closed,
    // disconnected). After a failed test Playwright replaces the worker while the next test is already running, so
    // that close removed the next test's tab. The connection ends when the worker process exits and Chrome keeps its tab.
  }, { scope: 'worker' }],
  context: async ({ scpSession }, use) => use(scpSession.context),
  page: async ({ scpSession }, use) => use(scpSession.page),
  // Playwright's own trace option already records the CDP-attached context, so no second trace is started here.
  // A tab left unresponsive by the previous scenario is replaced in the same browser instead of hanging this one.
  sharedTabHealth: [async ({ scpSession }, use, info) => {
    const page = scpSession.page;
    const responsive = await Promise.race([page.evaluate(() => true).catch(() => false),
      new Promise(resolve => setTimeout(() => resolve(false), 10000))]);
    if (!responsive) {
      process.stderr.write(`[shared-browser] ${new Date().toISOString()} tab unresponsive before "${info.title}"; replaced in the same browser\n`);
      info.annotations.push({ type: 'shared-browser', description: 'The shared tab was unresponsive and was replaced in the same browser before this scenario' });
      await sharedBrowser.discardUnresponsivePage(page);
    }
    await use();
  }, { auto: true }]
};

const test = base.extend({
  executionJournal: [async ({}, use, info) => {
    const { createJournal, forgetJournal } = require('../utils/scp-step');
    const journal = createJournal(info);
    try { await use(journal); }
    finally {
      await info.attach('scp-execution-journal', { body: Buffer.from(JSON.stringify(journal.snapshot())), contentType: 'application/json' });
      forgetJournal(info);
    }
  }, { auto: true }],
  ...(process.env.SCP_READONLY_EXECUTION === 'true' ? require('./chromeReadonlyExecution').executionFixtures : {}),
  ...(sharedBrowser.isSharedBrowser() ? sharedBrowserFixtures : {}),
  scpSession: [async ({ browser }, use) => {
    const shared = sharedBrowser.isSharedBrowser();
    const { context, page } = shared ? await sharedBrowser.sharedContextAndPage(browser) : { context: await browser.newContext({
      acceptDownloads: true,
      ignoreHTTPSErrors: true,
      viewport: null
    }) };
    await require('../utils/active-navigation').installActiveNavigationHighlight(context);
    const onRequest = request => {
      const { currentJournal } = require('../utils/scp-step');
      const journal = currentJournal();
      if (!journal || ['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return;
      const url = new URL(request.url());
      const reportQuery = request.method() === 'POST' && /^\/api\/submittal_status\/(by_submittal|by_supplier|by_material|submittal_status_counts|count_of_submittal_component)\/?$/.test(url.pathname);
      if (!reportQuery && url.origin === new URL(journal.context.baseUrl).origin) {
        (journal.observedWrites ||= []).push({ method: request.method(), path: url.pathname });
        require('../utils/execution-journal').observeMutation(journal.runningStep);
      }
    };
    const onResponse = response => {
      const journal = require('../utils/scp-step').currentJournal();
      if (!journal?.runningStep || new URL(response.url()).origin !== new URL(journal.context.baseUrl).origin) return;
      const responses = journal.runningStep.responses ||= [];
      if (responses.length < 100) responses.push({ method: response.request().method(), path: new URL(response.url()).pathname, status: response.status() });
    };
    context.on('request', onRequest);
    context.on('response', onResponse);
    const session = { context, page: page || await context.newPage(), initialized: false, shared };
    if (shared) {
      // Lifecycle events of the shared browser are logged so a lost tab or connection is reported, never silent.
      const note = event => process.stderr.write(`[shared-browser] ${new Date().toISOString()} ${event}\n`);
      browser.on('disconnected', () => note('CDP connection disconnected'));
      context.on('close', () => note('context closed'));
      context.on('page', item => note(`tab opened ${item.url()}`));
      for (const item of context.pages()) {
        item.on('crash', () => note(`tab crashed ${item.url()}`));
        item.on('close', () => note(`tab closed ${item.url()}`));
      }
      // A defect-recovery tab swap (discardUnresponsivePage) replaces the tab; always hand out the live one.
      let current = session.page;
      Object.defineProperty(session, 'page', { enumerable: true, get() {
        if (current.isClosed()) current = context.pages().find(item => !item.isClosed()) || current;
        return current;
      } });
    }
    await use(session);
    context.off('request', onRequest);
    context.off('response', onResponse);
    // The shared context and tab belong to the whole run; only isolated sessions are closed here.
    if (!shared) await context.close();
  }, { scope: 'worker' }],

  runData: async ({ executionJournal }, use) => {
    const data = createRunData(undefined, executionJournal.state.data.runData, () => executionJournal.save());
    executionJournal.state.data.runData = data;
    executionJournal.save();
    try { await use(data); } finally { executionJournal.setData('runData', data); }
  },

  scpApp: async ({ scpSession, executionJournal }, use, info) => {
    const { page } = scpSession;
    const config = getScpConfig();
    executionJournal.page = page;

    if (!config.baseUrl && !config.loginUrl) {
      throw new Error('SCP_BASE_URL is not configured. Add it to SCP/.env or the environment.');
    }

    const appShell = new AppShellPage(page, config);
    if (scpSession.shared && !scpSession.initialized) {
      // A previous stage may already have signed in this account in the shared tab; another account's session is cleared.
      const primary = config.accounts[config.defaultRole]?.username || config.username;
      scpSession.initialized = await sharedBrowser.ensureAccountSession(page, config, primary);
    }
    if (!scpSession.initialized) {
      await appShell.open();
    } else if (!page.url().startsWith(config.managementDashboardUrl)) {
      await page.goto(config.managementDashboardUrl, { waitUntil: 'domcontentloaded' });
    }

    await use({
      page,
      appShell,
      config,
      scpSession
    });
  },

  scpProject: async ({ scpApp, runData, executionJournal }, use, info) => {
    const { page, config } = scpApp;
    const platformChooser = new PlatformChooserPage(page, config);
    const dashboard = new ManagementDashboardPage(page, config);
    const projectSelector = new ProjectSelectorPage(page, config);
    const siteSelector = new SiteSelectorPage(page);

    if (!scpApp.scpSession.initialized) {
      await platformChooser.openSupplyChainPlanner();
      await dashboard.expectLoaded();
      await projectSelector.ensureProject(config.projectName);
      scpApp.scpSession.initialized = true;
    } else {
      await dashboard.expectLoaded();
      // In the shared tab an earlier stage (for example access discovery) may have left another project selected.
      if (scpApp.scpSession.shared) await projectSelector.ensureProject(config.projectName);
      else await projectSelector.expectActiveProject(config.projectName);
    }
    if (process.env.SCP_REGRESSION_MODULE) {
      await require('../utils/access/module-gate').requireModuleAccess({ page, config, projectSelector }, info, executionJournal, process.env.SCP_REGRESSION_MODULE);
    }
    const activeSession = await projectSelector.activeProjectSession();
    runData.captureData('currentUser', {
      email: config.accounts[config.defaultRole]?.username || config.username,
      credentialProfile: config.defaultRole,
      role: activeSession.role ? { code: activeSession.role.code, name: activeSession.role.name, permissions: activeSession.role.permissions || [] } : null
    }, 'Authentication');
    runData.captureData(
      'activeProject',
      await projectSelector.activeProjectName(),
      'Project Selection'
    );
    runData.captureData(
      'activeOrganization',
      await projectSelector.activeOrganizationName(),
      'Project Selection > Session Organization'
    );
    runData.captureData(
      'activeProjectReference',
      await projectSelector.activeProjectReference(),
      'Project Selection > Session Project Reference'
    );

    await use({
      ...scpApp,
      dashboard,
      platformChooser,
      projectSelector,
      siteSelector
    });
  }
});

require('../utils/scp-step').installStepPolicy(test);

module.exports = { test, expect };
