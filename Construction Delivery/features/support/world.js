const fs = require('fs');
const path = require('path');
const { setDefaultTimeout, setWorldConstructor } = require('@cucumber/cucumber');
const { chromium } = require('playwright');
const { UserManagementPage } = require('../../pages/booking/user-management.page');
const { loadAutomationEnvironment } = require('../../utils/env');

loadAutomationEnvironment();
setDefaultTimeout(Number(process.env.CUCUMBER_STEP_TIMEOUT_MS || 120000));

const AUTH_STATE_PATH = path.resolve(__dirname, '..', '..', 'auth.json');

function truthy(value) {
  return /^(1|true|yes)$/i.test(String(value || ''));
}

class ConstructionDeliveryWorld {
  constructor({ attach, parameters }) {
    this.attach = attach;
    this.parameters = parameters;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.userManagement = null;
    this.inviteModal = null;
    this.preparedUsers = [];
    this.inviteSubmitted = false;
    this.consoleErrors = [];
    this.networkFailures = [];
  }

  async openBrowser() {
    if (this.page) {
      return;
    }

    const headless = truthy(process.env.CUCUMBER_HEADLESS || process.env.HEADLESS || process.env.PLAYWRIGHT_HEADLESS);
    this.browser = await chromium.launch({
      channel: process.env.CUCUMBER_BROWSER_CHANNEL || 'chrome',
      headless,
      slowMo: Number(process.env.SLOW_MO || 150),
      args: ['--start-maximized', '--force-device-scale-factor=1']
    });

    const contextOptions = {
      viewport: null,
      ignoreHTTPSErrors: true
    };

    if (truthy(process.env.CUCUMBER_RECORD_VIDEO)) {
      contextOptions.recordVideo = { dir: path.resolve(__dirname, '..', '..', 'videos', 'cucumber') };
    }

    if (truthy(process.env.USE_AUTH_STATE) && fs.existsSync(AUTH_STATE_PATH)) {
      contextOptions.storageState = AUTH_STATE_PATH;
    }

    this.context = await this.browser.newContext(contextOptions);
    this.page = await this.context.newPage();
    this.page.on('console', (message) => {
      if (message.type() === 'error') {
        this.consoleErrors.push(message.text());
      }
    });
    this.page.on('requestfailed', (request) => {
      this.networkFailures.push(`${request.method()} ${request.url()} - ${request.failure()?.errorText || 'request failed'}`);
    });
    this.page.setDefaultTimeout(Number(process.env.CUCUMBER_ACTION_TIMEOUT_MS || 60000));
    this.page.setDefaultNavigationTimeout(Number(process.env.CUCUMBER_NAVIGATION_TIMEOUT_MS || 60000));
    this.userManagement = new UserManagementPage(this.page, {
      dryRun: !truthy(process.env.CUCUMBER_SEND_INVITES),
      strictUserListValidation: false,
      preserveInviteEmails: false
    });
  }

  async closeBrowser() {
    if (truthy(process.env.KEEP_BROWSER_OPEN)) {
      return;
    }

    await this.context?.close().catch(() => null);
    await this.browser?.close().catch(() => null);
    this.context = null;
    this.browser = null;
    this.page = null;
  }
}

setWorldConstructor(ConstructionDeliveryWorld);
