#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { chromium } = require('playwright');
const { DashboardPage } = require('../pages/booking/dashboard.page');
const { MyAccountPage } = require('../pages/booking/my-account.page');
const { RoleNavigationPage } = require('../pages/booking/role-navigation.page');
const { loadEnvFile } = require('../utils/env');
const { loginIfVisible } = require('../utils/login');

const ROOT_DIR = path.resolve(__dirname, '..');
const RESULTS_DIR = path.join(ROOT_DIR, 'test-results');
const ROLE_MATRIX_PATH = path.join(ROOT_DIR, 'test-data', 'roles', 'role-navigation-matrix.json');
const FLOW_KEY = 'role-navigation';

function truthy(value) {
  return /^(1|true|yes|enabled)$/i.test(String(value || ''));
}

function parseArguments() {
  const args = process.argv.slice(2);
  return {
    headless: args.includes('--headless'),
    noOpen: args.includes('--no-open'),
    generateReport: !args.includes('--no-report'),
    continueOnFailure: !args.includes('--stop-on-failure'),
    baseUrl: process.env.BASE_URL || 'https://stg-login.voyagecontrol.com',
    appUrl: process.env.APP_URL || 'https://stg-app.voyagecontrol.com',
    projectId: process.env.PROJECT_ID || process.env.BUCKINGHAM_PALACE_PROJECT_ID || '5ET10000010',
    vehicleTrackingEnabled: process.env.VEHICLE_TRACKING_ENABLED || 'unknown',
    vehicleTrackingRoles: String(process.env.VEHICLE_TRACKING_ROLES || '')
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean)
  };
}

function formatTimestampForFile(value = new Date()) {
  return value.toISOString().replace(/[:.]/g, '-');
}

function readRoleMatrix() {
  return JSON.parse(fs.readFileSync(ROLE_MATRIX_PATH, 'utf8'));
}

function listDiff(left, right) {
  const rightSet = new Set(right);
  return left.filter((item) => !rightSet.has(item));
}

function duplicateNames(tabs) {
  return tabs
    .filter((tab) => tab.visibleCount > 1)
    .map((tab) => `${tab.name} (${tab.visibleCount})`);
}

function strictDuplicateFailuresEnabled() {
  return truthy(process.env.ROLE_NAVIGATION_FAIL_ON_DUPLICATES);
}

class RoleNavigationRunner {
  constructor(options) {
    this.options = options;
    this.browser = null;
    this.results = [];
    this.steps = [];
    this.stepCounter = 0;
    this.startTime = null;
    this.endTime = null;
  }

  async setupBrowser() {
    this.browser = await chromium.launch({
      channel: process.env.CUCUMBER_BROWSER_CHANNEL || 'chrome',
      headless: this.options.headless,
      slowMo: Number(process.env.SLOW_MO || 100),
      args: ['--start-maximized', '--force-device-scale-factor=1']
    });
  }

  async cleanup() {
    await this.browser?.close().catch(() => null);
  }

  async createRoleContext() {
    const context = await this.browser.newContext({
      viewport: this.options.headless ? { width: 1440, height: 900 } : null,
      ignoreHTTPSErrors: true,
      permissions: ['notifications']
    });
    const page = await context.newPage();
    page.setDefaultTimeout(Number(process.env.ROLE_NAVIGATION_ACTION_TIMEOUT_MS || 60000));
    page.setDefaultNavigationTimeout(Number(process.env.ROLE_NAVIGATION_NAV_TIMEOUT_MS || 60000));
    return { context, page };
  }

  async captureScreenshot(page, label) {
    const dir = path.join(ROOT_DIR, 'screenshots', 'role-navigation');
    fs.mkdirSync(dir, { recursive: true });
    const safeLabel = String(label || 'role-navigation')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
    const filePath = path.join(dir, `${safeLabel}-${formatTimestampForFile()}.png`);
    await page.screenshot({ path: filePath, fullPage: true }).catch(() => null);
    return path.relative(ROOT_DIR, filePath);
  }

  addStep(flowName, name, status, duration, error = null) {
    const stepNumber = ++this.stepCounter;
    this.steps.push({
      stepNumber,
      id: `TC-${String(stepNumber).padStart(2, '0')}`,
      flowName,
      pageName: 'Role Navigation',
      name,
      status,
      timestamp: new Date().toISOString(),
      duration,
      error
    });
  }

  credentialsFor(roleConfig) {
    const email = process.env[roleConfig.emailEnv || ''];
    const password = process.env[roleConfig.passwordEnv || ''];
    return { email, password };
  }

  async loginAndOpenProject(page, roleConfig, credentials) {
    const dashboard = new DashboardPage(page);
    await page.goto(`${this.options.baseUrl}/api/sso/users/login/`, { waitUntil: 'domcontentloaded' });
    await loginIfVisible(page, {
      email: credentials.email,
      password: credentials.password,
      visibleTimeout: 8000,
      postLoginWaitMs: 1500,
      missingCredentialsMessage: `Credentials are missing for ${roleConfig.name}.`,
      errorMessage: `Login did not complete for ${roleConfig.name}.`
    });

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await this.openV3PlatformFromChooser(page);
      if (await dashboard.clickLocationProjectCard(process.env.PROJECT_NAME || 'Buckingham Palace').catch(() => false)) {
        await page.waitForTimeout(1500);
      }
      await page.goto(`${this.options.appUrl.replace(/\/$/, '')}/${this.options.projectId}/booking`, {
        waitUntil: 'domcontentloaded'
      }).catch(() => null);
      await page.waitForTimeout(1500);

      if (/\/api\/sso\/platforms\/choose/i.test(page.url())) {
        continue;
      }

      if (new RegExp(`/${this.options.projectId}/booking(?:[/?#]|$)`, 'i').test(page.url()) &&
          await page.getByText(/Booking List|New Booking/i).first().isVisible({ timeout: 5000 }).catch(() => false)) {
        return;
      }
    }

    if (!new RegExp(`/${this.options.projectId}/booking(?:[/?#]|$)`, 'i').test(page.url()) ||
        /\/api\/sso\/platforms\/choose/i.test(page.url())) {
      throw new Error(`Could not open project ${this.options.projectId} for ${roleConfig.name}. Current URL: ${page.url()}`);
    }
  }

  async openV3PlatformFromChooser(page) {
    const targetPoint = await page.evaluate(() => {
      const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim();
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0';
      };
      const v3Anchor = Array.from(document.querySelectorAll('a[href]'))
        .filter(isVisible)
        .find((anchor) => /stg-app\.voyagecontrol\.com\/login/i.test(anchor.href || '') ||
          /^V3 Construction deliveries$/i.test(normalize(anchor.innerText || anchor.textContent)));
      if (v3Anchor?.href) {
        return { href: v3Anchor.href };
      }

      const labels = Array.from(document.querySelectorAll('h1, h2, h3, h4, p, span, div'))
        .filter(isVisible)
        .filter((element) => /^V3 Construction deliveries$/i.test(normalize(element.innerText || element.textContent)) ||
          /^V3 Construction deliveries$/i.test(normalize(element.textContent)));

      const label = labels[0] || Array.from(document.querySelectorAll('h1, h2, h3, h4, p, span, div'))
        .filter(isVisible)
        .find((element) => /V3 Construction deliveries/i.test(normalize(element.innerText || element.textContent)));
      if (!label) return null;

      let container = label;
      for (let depth = 0; container && depth < 6; depth += 1) {
        const text = normalize(container.innerText || container.textContent);
        const rect = container.getBoundingClientRect();
        if (/V3 Construction deliveries/i.test(text) &&
            /Open/i.test(text) &&
            rect.width >= 120 &&
            rect.width <= 420 &&
            rect.height >= 180 &&
            rect.height <= 420) {
          break;
        }
        container = container.parentElement;
      }

      const scope = container || label;
      const anchor = scope.querySelector('a[href]');
      if (anchor?.href) {
        return { href: anchor.href };
      }

      const clickTarget = Array.from(scope.querySelectorAll('a, button, [role="button"], p, img, span'))
        .filter(isVisible)
        .find((element) => /Open/i.test(normalize(element.innerText || element.textContent || element.getAttribute('aria-label') || ''))) ||
        scope;

      if (clickTarget.tagName?.toLowerCase() === 'a') {
        clickTarget.setAttribute('target', '_self');
      }
      const rect = clickTarget.getBoundingClientRect();
      const scopeRect = scope.getBoundingClientRect();
      return {
        x: rect.width > 0 ? rect.left + rect.width / 2 : scopeRect.left + scopeRect.width / 2,
        y: rect.height > 0 ? rect.top + rect.height / 2 : scopeRect.bottom - 36
      };
    }).catch(() => false);

    if (targetPoint?.href) {
      await page.goto(targetPoint.href, { waitUntil: 'domcontentloaded' }).catch(() => null);
      await page.waitForTimeout(3000);
      return true;
    }

    if (targetPoint?.x && targetPoint?.y) {
      const popupPromise = page.waitForEvent('popup', { timeout: 5000 }).catch(() => null);
      await page.mouse.click(targetPoint.x, targetPoint.y).catch(() => null);
      const popup = await popupPromise;
      if (popup) {
        await popup.waitForLoadState('domcontentloaded').catch(() => null);
        await page.goto(popup.url(), { waitUntil: 'domcontentloaded' }).catch(() => null);
        await popup.close().catch(() => null);
      } else {
        await page.waitForLoadState('domcontentloaded').catch(() => null);
      }
      await page.waitForTimeout(3000);
      return true;
    }

    return false;
  }

  vehicleTrackingExpectation(roleConfig) {
    const configured = this.options.vehicleTrackingEnabled;
    if (/^unknown$/i.test(configured)) {
      return {
        configurationStatus: 'Unknown',
        expectedVisible: null,
        reason: 'VEHICLE_TRACKING_ENABLED was not configured for this environment.'
      };
    }

    const enabled = truthy(configured);
    const roleAllowed = this.options.vehicleTrackingRoles.length === 0 ||
      this.options.vehicleTrackingRoles.some((role) => role.toLowerCase() === roleConfig.name.toLowerCase());

    return {
      configurationStatus: enabled ? 'Enabled' : 'Disabled',
      expectedVisible: enabled && roleAllowed,
      reason: enabled && !roleAllowed
        ? `${roleConfig.name} is not listed in VEHICLE_TRACKING_ROLES.`
        : null
    };
  }

  async readMyAccountRole(page) {
    const myAccount = new MyAccountPage(page);
    await myAccount.openMyAccount();
    const accountAccess = await myAccount.readCompanyAndRoles();
    return {
      company: accountAccess.company?.value || '',
      organizationRole: accountAccess.organizationRole?.value || '',
      projectRole: accountAccess.projectRole?.value || ''
    };
  }

  evaluateRole(roleConfig, actualTabs, directAccess, vehicleTracking, screenshot, accountRole) {
    const actualNames = actualTabs.map((tab) => tab.name);
    const optionalNames = ['Vehicle Tracking'].filter((tab) => actualNames.includes(tab));
    const expectedTabs = [...roleConfig.expectedTabs];
    const restrictedTabs = [...roleConfig.restrictedTabs];
    const definedTabs = new Set([...expectedTabs, ...restrictedTabs, ...optionalNames]);
    const missingTabs = listDiff(expectedTabs, actualNames);
    const unexpectedTabs = restrictedTabs.filter((tab) => actualNames.includes(tab));
    const additionalTabs = actualNames.filter((tab) => !definedTabs.has(tab));
    const disabledTabs = actualTabs.filter((tab) => !tab.enabled || !tab.clickable).map((tab) => tab.name);
    const duplicates = duplicateNames(actualTabs);
    const failedDirectAccess = directAccess.filter((check) => check.status === 'failed').map((check) => check.tabName);
    const rolePattern = new RegExp(roleConfig.rolePattern || roleConfig.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const roleMismatch = Boolean(accountRole.projectRole || accountRole.organizationRole) &&
      !rolePattern.test(accountRole.projectRole || '') &&
      !rolePattern.test(accountRole.organizationRole || '');

    if (vehicleTracking.expectedVisible === true && !actualNames.includes('Vehicle Tracking')) {
      missingTabs.push('Vehicle Tracking');
    }
    if (vehicleTracking.expectedVisible === false && actualNames.includes('Vehicle Tracking')) {
      unexpectedTabs.push('Vehicle Tracking');
    }

    const failures = [
      missingTabs.length ? `Missing tabs: ${missingTabs.join(', ')}` : '',
      unexpectedTabs.length ? `Unexpected restricted tabs: ${unexpectedTabs.join(', ')}` : '',
      disabledTabs.length ? `Visible but disabled/not clickable: ${disabledTabs.join(', ')}` : '',
      strictDuplicateFailuresEnabled() && duplicates.length ? `Duplicate tabs: ${duplicates.join(', ')}` : '',
      failedDirectAccess.length ? `Restricted direct URL access succeeded: ${failedDirectAccess.join(', ')}` : '',
      roleMismatch ? `My Account project role mismatch: expected ${roleConfig.name}, actual ${accountRole.projectRole}` : ''
    ].filter(Boolean);

    return {
      userRole: roleConfig.name,
      username: roleConfig.emailEnv ? process.env[roleConfig.emailEnv] || '' : '',
      myAccountProjectRole: accountRole.projectRole || '',
      myAccountOrganizationRole: accountRole.organizationRole || '',
      expectedTabs,
      restrictedTabs,
      actualTabs: actualNames,
      missingTabs,
      unexpectedTabs,
      additionalTabs,
      optionalTabs: optionalNames,
      disabledTabs,
      duplicateTabs: duplicates,
      vehicleTracking,
      directAccess,
      screenshot,
      status: failures.length ? 'failed' : 'passed',
      reason: failures.join(' | ') || null
    };
  }

  async validateRole(roleConfig) {
    const startedAt = Date.now();
    const flowName = `Role Navigation - ${roleConfig.name}`;
    const credentials = this.credentialsFor(roleConfig);

    if (!credentials.email || !credentials.password) {
      const result = {
        userRole: roleConfig.name,
        username: '',
        expectedTabs: roleConfig.expectedTabs,
        restrictedTabs: roleConfig.restrictedTabs,
        actualTabs: [],
        missingTabs: [],
        unexpectedTabs: [],
        additionalTabs: [],
        optionalTabs: [],
        disabledTabs: [],
        duplicateTabs: [],
        vehicleTracking: this.vehicleTrackingExpectation(roleConfig),
        directAccess: [],
        status: 'skipped',
        reason: `Credentials not configured. Set ${roleConfig.emailEnv}/${roleConfig.passwordEnv}.`,
        duration: 0
      };
      this.results.push(result);
      this.addStep(flowName, 'Skip role because credentials are missing', 'skipped', 0, result.reason);
      return;
    }

    const { context, page } = await this.createRoleContext();
    try {
      await this.loginAndOpenProject(page, roleConfig, credentials);
      const roleNavigation = new RoleNavigationPage(page, this.options);
      await page.goto(roleNavigation.projectUrl('booking'), { waitUntil: 'domcontentloaded' }).catch(() => null);
      const actualTabs = await roleNavigation.collectVisibleNavigationTabs();
      const screenshot = await this.captureScreenshot(page, `${roleConfig.name}-left-navigation`);
      const vehicleTracking = this.vehicleTrackingExpectation(roleConfig);
      const directAccess = [];

      for (const tab of roleConfig.restrictedTabs) {
        directAccess.push(await roleNavigation.attemptDirectAccess(tab));
      }

      const accountRole = await this.readMyAccountRole(page).catch((error) => ({
        projectRole: '',
        organizationRole: '',
        company: '',
        error: error.message
      }));
      const result = this.evaluateRole(roleConfig, actualTabs, directAccess, vehicleTracking, screenshot, accountRole);
      result.duration = Date.now() - startedAt;
      this.results.push(result);
      this.addStep(flowName, 'Validate expected and restricted left navigation tabs', result.status, result.duration, result.reason);
    } catch (error) {
      const screenshot = await this.captureScreenshot(page, `${roleConfig.name}-failed`).catch(() => null);
      const result = {
        userRole: roleConfig.name,
        username: credentials.email,
        expectedTabs: roleConfig.expectedTabs,
        restrictedTabs: roleConfig.restrictedTabs,
        actualTabs: [],
        missingTabs: [],
        unexpectedTabs: [],
        additionalTabs: [],
        optionalTabs: [],
        disabledTabs: [],
        duplicateTabs: [],
        vehicleTracking: this.vehicleTrackingExpectation(roleConfig),
        directAccess: [],
        screenshot,
        status: 'failed',
        reason: error.message,
        duration: Date.now() - startedAt
      };
      this.results.push(result);
      this.addStep(flowName, 'Validate expected and restricted left navigation tabs', 'failed', result.duration, error.message);
      if (!this.options.continueOnFailure) {
        throw error;
      }
    } finally {
      await context.close().catch(() => null);
    }
  }

  async run() {
    this.startTime = new Date();
    await this.setupBrowser();
    try {
      const matrix = readRoleMatrix();
      for (const roleConfig of matrix.roles) {
        await this.validateRole(roleConfig);
      }
    } finally {
      this.endTime = new Date();
      await this.writeReport();
      await this.cleanup();
    }
  }

  async writeReport() {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    const failed = this.results.filter((result) => result.status === 'failed').length;
    const passed = this.results.filter((result) => result.status === 'passed').length;
    const skipped = this.results.filter((result) => result.status === 'skipped').length;
    const report = {
      startTime: this.startTime.toISOString(),
      endTime: this.endTime.toISOString(),
      duration: this.endTime.getTime() - this.startTime.getTime(),
      status: failed ? 'failed' : 'passed',
      total: this.steps.length,
      passed: this.steps.filter((step) => step.status === 'passed').length,
      failed: this.steps.filter((step) => step.status === 'failed').length,
      workflow: 'role-based-left-navigation-validation',
      environmentName: process.env.ENVIRONMENT_NAME || 'Staging',
      appUrl: this.options.appUrl,
      browserMode: this.options.headless ? 'headless' : 'headed',
      tests: this.steps,
      roleNavigationResults: this.results,
      roleNavigationSummary: { passed, failed, skipped },
      timestamp: this.endTime.toISOString()
    };
    const reportPath = path.join(RESULTS_DIR, `${FLOW_KEY}-report-${formatTimestampForFile(this.endTime)}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\nRole Navigation Automation Report`);
    console.log(`Status: ${report.status.toUpperCase()}`);
    console.log(`Roles: ${passed} passed, ${failed} failed, ${skipped} skipped`);
    console.log(`Report: ${path.relative(ROOT_DIR, reportPath)}`);
  }
}

async function main() {
  loadEnvFile();
  const options = parseArguments();
  const runner = new RoleNavigationRunner(options);
  await runner.run();

  if (options.generateReport) {
    const args = ['generate-automation-report.js', '--latest-flow', FLOW_KEY];
    if (options.noOpen) args.push('--no-open');
    const result = spawnSync('node', args, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });
    if (result.status !== 0) process.exitCode = result.status || 1;
  }

  if (runner.results.some((result) => result.status === 'failed')) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Role navigation automation failed: ${error.message}`);
  process.exit(1);
});
