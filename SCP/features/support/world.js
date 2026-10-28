const fs = require('fs');
const path = require('path');
const { setDefaultTimeout, setWorldConstructor } = require('@cucumber/cucumber');
const { loadEnvFile } = require('../../utils/env');
const { getScpConfig } = require('../../config/scp.config');
const { AppShellPage } = require('../../pages/app-shell.page');
const { ManagementDashboardPage } = require('../../pages/management-dashboard/management-dashboard.page');
const { PlatformChooserPage } = require('../../pages/platform-chooser.page');
const { ProjectSelectorPage } = require('../../pages/project-selector.page');
const { createRunData } = require('../../utils/dynamic-data');
const { captureEvidence } = require('../../utils/evidence');
const { getContextOptions, truthy } = require('../../utils/execution-mode');
const { acquireBrowserSession } = require('./browser-session');

loadEnvFile();
setDefaultTimeout(Number(process.env.CUCUMBER_STEP_TIMEOUT_MS || 300000));
let sharedRunData;
let primarySessionInitialized = false;

class ScpWorld {
  constructor({ attach, parameters }) {
    this.attach = attach;
    this.parameters = parameters;
    this.config = getScpConfig();
    this.role = this.config.defaultRole;
    this.runData = null;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.activationContext = null;
    this.activationPage = null;
    this.consoleErrors = [];
    this.networkFailures = [];
  }

  roleAccount(role = this.role) {
    const normalizedRole = String(role).trim().toLowerCase();
    const account = this.config.accounts[normalizedRole];
    if (!account) {
      throw new Error(`Unsupported SCP role: ${role}. Expected admin, subcontractor, or supplier.`);
    }
    if (!account.username || !account.password) {
      throw new Error(`Credentials are not configured for the SCP ${normalizedRole} role.`);
    }
    return { role: normalizedRole, ...account };
  }

  async openBrowser() {
    if (this.browser) return;

    this.runData = sharedRunData ||= createRunData();

    const contextOptions = {};
    const authStatePath = path.resolve(__dirname, '..', '..', 'auth', `${this.role}.json`);
    if (truthy(process.env.SCP_USE_AUTH_STATE) && fs.existsSync(authStatePath)) {
      contextOptions.storageState = authStatePath;
    }

    const session = await acquireBrowserSession(contextOptions);
    this.browser = session.browser;
    this.context = session.context;
    this.page = session.page;
    this.page.setDefaultTimeout(Number(process.env.CUCUMBER_ACTION_TIMEOUT_MS || 30000));
    this.page.setDefaultNavigationTimeout(Number(process.env.CUCUMBER_NAVIGATION_TIMEOUT_MS || 60000));
    this.page.removeAllListeners('console');
    this.page.removeAllListeners('requestfailed');
    this.page.on('console', (message) => {
      if (message.type() === 'error') this.consoleErrors.push(message.text());
    });
    this.page.on('requestfailed', (request) => {
      this.networkFailures.push(`${request.method()} ${request.url().split('?')[0]} - ${request.failure()?.errorText || 'request failed'}`);
    });
  }

  async loginAs(role) {
    const account = this.roleAccount(role);
    this.role = account.role;
    this.runData.captureData('currentUser', {
      email: account.username,
      role: account.role
    }, 'Authentication');
    const roleConfig = { ...this.config, username: account.username, password: account.password };
    this.appShell = new AppShellPage(this.page, roleConfig);
    this.platformChooser = new PlatformChooserPage(this.page, roleConfig);
    this.dashboard = new ManagementDashboardPage(this.page, roleConfig);
    this.projectSelector = new ProjectSelectorPage(this.page, roleConfig);
    this.primarySessionReused = primarySessionInitialized;
    if (!primarySessionInitialized) {
      await this.appShell.open();
    }
  }

  async openScpPlatform() {
    if (!primarySessionInitialized) {
      await this.platformChooser.openSupplyChainPlanner();
      await this.dashboard.expectLoaded();
    }
  }

  async ensureProject(projectName = this.config.projectName) {
    if (!primarySessionInitialized) {
      await this.projectSelector.ensureProject(projectName);
      primarySessionInitialized = true;
      return;
    }
    await this.projectSelector.expectActiveProject(projectName);
  }

  async openProjectManagement() {
    await this.projectSelector.expectActiveProject(this.config.projectName);
    await this.dashboard.openProjectManagement();
  }

  async captureCheckpoint(name) {
    return captureEvidence(this.page, this.attach, name);
  }

  async openActivationBrowserContext() {
    if (!this.browser) {
      throw new Error('The primary SCP browser must be open before creating an activation context.');
    }
    if (!this.activationContext) {
      this.activationContext = await this.browser.newContext(getContextOptions());
      this.activationPage = await this.activationContext.newPage();
    }
    return this.activationPage;
  }

  async closeActivationBrowserContext() {
    await this.activationContext?.close().catch(() => null);
    this.activationContext = null;
    this.activationPage = null;
  }

  async closeBrowser() {
    await this.closeActivationBrowserContext();
    this.context = null;
    this.browser = null;
    this.page = null;
  }
}

setWorldConstructor(ScpWorld);
