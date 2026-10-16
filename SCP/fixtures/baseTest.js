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

loadEnvFile(path.resolve(__dirname, '..', '.env'));

const test = base.extend({
  scpSession: [async ({ browser }, use) => {
    const context = await browser.newContext({
      acceptDownloads: true,
      ignoreHTTPSErrors: true,
      viewport: null
    });
    const page = await context.newPage();
    await use({ context, page, initialized: false });
    await context.close();
  }, { scope: 'worker' }],

  runData: async ({}, use) => {
    await use(createRunData());
  },

  scpApp: async ({ scpSession }, use) => {
    const { page } = scpSession;
    const config = getScpConfig();

    if (!config.baseUrl && !config.loginUrl) {
      throw new Error('SCP_BASE_URL is not configured. Add it to SCP/.env or the environment.');
    }

    const appShell = new AppShellPage(page, config);
    if (!scpSession.initialized) {
      await appShell.open();
    } else {
      await page.goto(config.managementDashboardUrl, { waitUntil: 'domcontentloaded' });
    }

    await use({
      page,
      appShell,
      config,
      scpSession
    });
  },

  scpProject: async ({ scpApp, runData }, use) => {
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
      await projectSelector.expectActiveProject(config.projectName);
    }
    runData.captureData('currentUser', {
      email: config.accounts[config.defaultRole]?.username || config.username,
      role: config.defaultRole
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

module.exports = { test, expect };
