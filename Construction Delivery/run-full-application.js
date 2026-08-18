#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { chromium } = require('playwright');
const { DashboardPage } = require('./pages/booking/dashboard.page');
const { DeliveryBookingPage } = require('./pages/booking/delivery.booking.page');
const { ResourceOnlyBookingPage } = require('./pages/booking/resource-only.booking.page');
const { RecurringBookingPage } = require('./pages/booking/recurring.booking.page');
const { MultiVehicleBookingPage } = require('./pages/booking/multi-vehicle.booking.page');
const { EditBookingPage } = require('./pages/booking/edit.booking.page');
const { Filter } = require('./pages/booking/filter.page');
const { BookingListPage } = require('./pages/booking/booking-list.page');
const { CalendarBookingPage } = require('./pages/booking/calendar.booking.page');
const { UserManagementPage } = require('./pages/booking/user-management.page');
const { AnalyticsPage } = require('./pages/booking/analytics.page');
const { EquipmentManagementPage } = require('./pages/booking/equipment-management.page');
const { MyAccountPage } = require('./pages/booking/my-account.page');
const { MyOrganizationPage } = require('./pages/booking/my-organization.page');
const { NotificationPreferencePage } = require('./pages/booking/notification-preference.page');
const { ProjectSettingsPage } = require('./pages/booking/project-settings.page');
const { loadEnvFile } = require('./utils/env');
const { ScreenDetector } = require('./utils/screen-detector');
const { clickHighlighted, fillHighlighted } = require('./utils/highlight');
const { BOOKING_TYPES, discoverAvailableBookingTypes } = require('./utils/booking-types');

const RESULTS_DIR = path.resolve('test-results');
const AUTH_STATE_PATH = path.resolve('auth.json');
const USER_MANAGEMENT_SEQUENCE_PATH = path.resolve('config', 'user-management-sequence.json');
const DEFAULT_LOGIN_EMAIL = 'hariharan.r@neuralrays.ai';
const DEFAULT_LOGIN_PASSWORD = 'Master@15';
const FLOW_PAGE_NAMES = Object.freeze({
  'Delivery Booking': 'Booking Creation',
  'Recurring Booking': 'Booking Creation',
  'Multi-Vehicle Booking': 'Booking Creation',
  'Resource-only Booking': 'Booking Creation',
  'Edit Booking': 'Booking List',
  'Booking List Filters': 'Booking List',
  'Booking List': 'Booking List',
  Calendar: 'Calendar',
  Analytics: 'Analytics',
  'Equipment Management': 'Equipment Management',
  'User Management': 'User Management',
  'My Account': 'My Account',
  'Notification Preferences': 'Notification Preferences',
  'My Organization': 'My Organization'
});

function reserveGeneratedUserIndexes(count = 3) {
  fs.mkdirSync(path.dirname(USER_MANAGEMENT_SEQUENCE_PATH), { recursive: true });

  let nextUserIndex = 1;
  if (fs.existsSync(USER_MANAGEMENT_SEQUENCE_PATH)) {
    const sequence = JSON.parse(fs.readFileSync(USER_MANAGEMENT_SEQUENCE_PATH, 'utf8'));
    nextUserIndex = Number(sequence.nextUserIndex || 1);
  }

  if (!Number.isInteger(nextUserIndex) || nextUserIndex < 1) {
    nextUserIndex = 1;
  }

  fs.writeFileSync(
    USER_MANAGEMENT_SEQUENCE_PATH,
    JSON.stringify({
      nextUserIndex: nextUserIndex + count,
      updatedAt: new Date().toISOString()
    }, null, 2),
    'utf8'
  );

  return nextUserIndex;
}

function createGeneratedUserAccountsFile(count = 3) {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
  const runSuffix = timestamp.slice(-8);
  const outputDir = path.resolve('test-results', 'user-management-inputs');
  fs.mkdirSync(outputDir, { recursive: true });

  const roles = String(process.env.USER_INVITE_ROLES || 'Project Admin,Project Manager,View Only User')
    .split(',')
    .map((role) => role.trim())
    .filter(Boolean);
  const organization = process.env.USER_INVITE_ORGANIZATION || 'Neuralrays';
  const changeOrganization = process.env.USER_CHANGE_ORGANIZATION || process.env.CHANGE_ORGANIZATION || '';
  const password = process.env.NEW_USER_PASSWORD || DEFAULT_LOGIN_PASSWORD;
  const userCount = Math.max(1, Math.floor(Number(count) || 3));
  const startIndex = reserveGeneratedUserIndexes(userCount);
  const csvEscape = (value) => `"${String(value || '').replace(/"/g, '""')}"`;
  const header = ['name', 'email', 'mobile', 'address', 'organization', 'role', 'password', 'new organization'];
  const rows = Array.from({ length: userCount }, (_, index) => {
    const userNumber = index + 1;
    const userIndex = startIndex + index;
    return [
      `Voyagecontrol Validator ${userNumber}`,
      `User${userIndex}${runSuffix}@yopmail.com`,
      String(9988776654 + userNumber),
      'First Main Road',
      organization,
      roles[index] || roles[0] || 'Project Admin',
      password,
      changeOrganization
    ].map(csvEscape).join(',');
  });

  const filePath = path.join(outputDir, `generated-user-management-users-${timestamp}-user${startIndex}${runSuffix}-user${startIndex + userCount - 1}${runSuffix}.csv`);
  fs.writeFileSync(filePath, `${header.join(',')}\n${rows.join('\n')}\n`, 'utf8');
  return filePath;
}

function loadEnvironment() {
  loadEnvFile();
}

function authStateMatchesEmail(authStatePath, email) {
  if (!email || !fs.existsSync(authStatePath)) return false;

  try {
    const rawState = fs.readFileSync(authStatePath, 'utf8');
    if (rawState.includes(email)) return true;

    const state = JSON.parse(rawState);
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

function parseArguments() {
  const args = process.argv.slice(2);
  const slowMoIndex = args.indexOf('--slow-mo');
  const gapIndex = args.indexOf('--action-gap');
  const highlightIndex = args.indexOf('--highlight-ms');
  const getArgValue = (name) => {
    const prefix = `--${name}=`;
    const inline = args.find((arg) => arg.startsWith(prefix));
    if (inline) return inline.slice(prefix.length);
    const index = args.indexOf(`--${name}`);
    return index !== -1 ? args[index + 1] : undefined;
  };
  const singleBrowser = !args.includes('--multi-browser');
  const turbo = args.includes('--turbo') || singleBrowser;
  const slowMo = slowMoIndex !== -1 ? Number(args[slowMoIndex + 1]) : args.includes('--slow') ? 1000 : turbo ? 0 : 150;
  const actionGap = gapIndex !== -1 ? Number(args[gapIndex + 1]) : turbo ? 0 : args.includes('--fast') ? 250 : 1500;
  const highlightMs = highlightIndex !== -1 ? Number(args[highlightIndex + 1]) : turbo ? 0 : args.includes('--fast') ? 0 : 1200;
  const generatedUsers = Number(getArgValue('generated-users') || process.env.GENERATED_USER_COUNT || 3);
  const explicitUserAccountsFile = getArgValue('users-file') || getArgValue('user-accounts-file') || '';
  const reuseEnvUsers = args.includes('--reuse-env-users');

  return {
    headless: args.includes('--headless'),
    freshAuth: args.includes('--fresh-auth'),
    skipLogin: args.includes('--skip-login'),
    bookingCreationOnly: args.includes('--booking-creation-only'),
    bookingListPageOnly: args.includes('--booking-list-page-only'),
    continueOnFailure: args.includes('--continue-on-failure'),
    generateReport: !args.includes('--no-report'),
    noOpen: args.includes('--no-open'),
    skipUserManagement: args.includes('--skip-user-management'),
    skipAnalytics: args.includes('--skip-analytics'),
    skipEquipmentManagement: args.includes('--skip-equipment-management'),
    skipBookingFlows: args.includes('--skip-booking-flows'),
    skipFilter: args.includes('--skip-filter'),
    skipBookingListValidation: args.includes('--skip-booking-list-validation'),
    skipCalendar: args.includes('--skip-calendar'),
    skipMyAccount: args.includes('--skip-my-account'),
    skipMyOrganization: args.includes('--skip-my-organization'),
    skipNotificationPreferences: args.includes('--skip-notification-preferences'),
    approvalMatrix: args.includes('--approval-matrix') || args.includes('--automatic-approval-matrix'),
    singleBrowser,
    turbo,
    slowMo: Number.isFinite(slowMo) ? slowMo : 150,
    actionGap: Number.isFinite(actionGap) ? actionGap : 900,
    highlightMs: Number.isFinite(highlightMs) ? highlightMs : 800,
    baseUrl: process.env.BASE_URL || 'https://stg-login.voyagecontrol.com',
    appUrl: process.env.APP_URL || 'https://stg-app.voyagecontrol.com',
    projectId: process.env.PROJECT_ID || '5ET10000010',
    email: process.env.VC_EMAIL || DEFAULT_LOGIN_EMAIL,
    password: process.env.VC_PASSWORD || DEFAULT_LOGIN_PASSWORD,
    userAccountsFile: explicitUserAccountsFile || (reuseEnvUsers ? process.env.USER_ACCOUNTS_FILE || '' : ''),
    userAccountsFileExplicit: Boolean(explicitUserAccountsFile),
    generatedUsers: Number.isFinite(generatedUsers) && generatedUsers > 0 ? Math.floor(generatedUsers) : 3
  };
}

function formatTimestampForFile(value = new Date()) {
  return value.toISOString().replace(/[:.]/g, '-');
}

function redactSensitiveUrl(url) {
  return String(url)
    .replace(/((?:access|refresh|token)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]');
}

class FullApplicationRunner {
  constructor(options) {
    this.options = options;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.viewport = null;
    this.steps = [];
    this.bookingCreations = [];
    this.bookingTypeAvailability = [];
    this.bookingTypeResults = [];
    this.approvalValidationResults = [];
    this.recentHttpErrors = [];
    this.stepCounter = 0;
    this.startTime = null;
    this.endTime = null;
  }

  async setupBrowser() {
    process.env.HIGHLIGHT_MS = String(this.options.highlightMs);
    process.env.ACTION_PAUSE_MS = String(this.options.actionGap);
    process.env.DISABLE_AUTOMATION_VISUALS = this.options.turbo
      ? 'true'
      : process.env.DISABLE_AUTOMATION_VISUALS || '';
    if (this.options.turbo) {
      process.env.USER_ROW_PAUSE_MS = process.env.USER_ROW_PAUSE_MS || '0';
      process.env.ACTIVATION_CLOSE_MESSAGE_MS = process.env.ACTIVATION_CLOSE_MESSAGE_MS || '0';
      process.env.CALENDAR_SETTLE_MS = process.env.CALENDAR_SETTLE_MS || '0';
      process.env.MY_ACCOUNT_SETTLE_MS = process.env.MY_ACCOUNT_SETTLE_MS || '0';
      process.env.MY_ORGANIZATION_SETTLE_MS = process.env.MY_ORGANIZATION_SETTLE_MS || '0';
    }

    const screenDetector = new ScreenDetector();
    if (this.options.singleBrowser) {
      screenDetector.screenInfo = {
        width: Number(process.env.BROWSER_WIDTH || 1920),
        height: Number(process.env.BROWSER_HEIGHT || 1080),
        availWidth: Number(process.env.BROWSER_WIDTH || 1920),
        availHeight: Number(process.env.BROWSER_HEIGHT || 1040),
        devicePixelRatio: 1,
        colorDepth: 24,
        orientation: 'landscape-primary'
      };
      console.log('Single-browser mode: skipped temporary Chrome screen detection.');
    } else {
      await screenDetector.detectScreenResolution();
    }
    this.viewport = screenDetector.getOptimalViewport(100);

    this.browser = await chromium.launch({
      channel: 'chrome',
      headless: this.options.headless,
      slowMo: this.options.slowMo,
      args: screenDetector.getBrowserArgs(100)
    });

    this.context = await this.browser.newContext({
      viewport: this.options.headless ? this.viewport : null,
      screen: this.options.headless ? this.viewport : undefined,
      deviceScaleFactor: this.options.headless ? 1 : undefined,
      ignoreHTTPSErrors: true,
      storageState: !this.options.freshAuth && authStateMatchesEmail(AUTH_STATE_PATH, this.options.email)
        ? AUTH_STATE_PATH
        : undefined,
      permissions: ['notifications']
    });

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(60000);
    this.page.setDefaultNavigationTimeout(60000);

    this.page.on('pageerror', (error) => console.log(`Page error: ${error.message}`));
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') console.log(`Console error: ${msg.text()}`);
    });
    this.page.on('requestfailed', (request) => {
      console.log(`Request failed: ${request.method()} ${redactSensitiveUrl(request.url())}`);
    });
    this.page.on('response', (response) => {
      const status = response.status();
      if (status < 400) return;

      const url = redactSensitiveUrl(response.url());
      if (!/voyagecontrol|amazonaws|cloudfront/i.test(url)) return;

      this.recentHttpErrors.push({
        status,
        url,
        method: response.request().method()
      });
      this.recentHttpErrors = this.recentHttpErrors.slice(-12);
      console.log(`HTTP ${status}: ${response.request().method()} ${url}`);
    });

    await this.maximizeWindow();
    await this.page.bringToFront().catch(() => null);
    const actualViewport = this.page.viewportSize() ||
      await this.page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight })).catch(() => this.viewport);
    this.viewport = actualViewport || this.viewport;
    console.log(`Chrome browser launched once at browser-fit viewport: ${this.viewport.width}x${this.viewport.height}`);
  }

  async maximizeWindow() {
    try {
      const session = await this.page.context().newCDPSession(this.page);
      const { windowId } = await session.send('Browser.getWindowForTarget');
      await session.send('Browser.setWindowBounds', {
        windowId,
        bounds: { windowState: 'maximized' }
      });
    } catch (error) {
      console.log(`Could not resize Chrome window through CDP: ${error.message}`);
    }
  }

  async cleanup() {
    if (this.context) {
      await this.context.close().catch(() => null);
    }
    if (this.browser) {
      await this.browser.close().catch(() => null);
    }
  }

  async getPageState() {
    return this.page.evaluate(() => ({
      url: window.location.href,
      text: (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 300)
    })).catch(() => ({ url: this.page.url(), text: '' }));
  }

  async getBookingListDiagnostics() {
    const state = await this.page.evaluate(() => {
      const visibleText = (document.body.innerText || '').replace(/\s+/g, ' ').trim();
      const storageKeys = [
        'v3_project_ref',
        'v3_project_site_id',
        'v3_project_data',
        'v3_access_token',
        'v3_refresh_token'
      ];
      const storage = Object.fromEntries(storageKeys.map((key) => {
        const value = localStorage.getItem(key);
        if (/token/i.test(key)) return [key, value ? '[present]' : '[missing]'];
        if (key === 'v3_project_data' && value) {
          try {
            const parsed = JSON.parse(value);
            return [key, {
              ref: parsed?.ref || '',
              id: parsed?.id || '',
              name: parsed?.name || ''
            }];
          } catch {
            return [key, '[unparseable]'];
          }
        }
        return [key, value || ''];
      }));
      const progressCount = document.querySelectorAll('[role="progressbar"], .MuiCircularProgress-root').length;
      const buttons = Array.from(document.querySelectorAll('button'))
        .map((button) => (button.innerText || button.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, 12);

      return {
        url: window.location.href,
        readyState: document.readyState,
        text: visibleText.slice(0, 500),
        textLength: visibleText.length,
        progressCount,
        storage,
        buttons
      };
    }).catch(() => ({
      url: this.page.url(),
      readyState: '',
      text: '',
      textLength: 0,
      progressCount: null,
      storage: {},
      buttons: []
    }));

    return {
      ...state,
      recentHttpErrors: [...this.recentHttpErrors]
    };
  }

  formatBookingListDiagnostics(diagnostics) {
    const projectData = diagnostics.storage?.v3_project_data;
    const project = typeof projectData === 'object' && projectData
      ? `${projectData.name || '-'} (${projectData.ref || '-'})`
      : String(projectData || '-');
    const httpErrors = (diagnostics.recentHttpErrors || [])
      .slice(-5)
      .map((item) => `${item.status} ${item.method} ${item.url}`)
      .join(' | ');

    return [
      `URL: ${diagnostics.url}`,
      `readyState: ${diagnostics.readyState || '-'}`,
      `textLength: ${diagnostics.textLength}`,
      `loaderCount: ${diagnostics.progressCount}`,
      `projectRef: ${diagnostics.storage?.v3_project_ref || '-'}`,
      `projectSiteId: ${diagnostics.storage?.v3_project_site_id || '-'}`,
      `projectData: ${project}`,
      `buttons: ${(diagnostics.buttons || []).join(', ') || '-'}`,
      `text: ${diagnostics.text || '-'}`,
      `recentHttpErrors: ${httpErrors || '-'}`
    ].join('; ');
  }

  async fillLoginFormIfVisible(timeout = 8000) {
    const emailField = this.page.locator([
      'input[type="email"]',
      'input[name*="email" i]',
      'input[id*="email" i]',
      'input[placeholder*="email" i]'
    ].join(', ')).first();
    const passwordField = this.page.locator([
      'input[type="password"]',
      'input[name*="password" i]',
      'input[id*="password" i]',
      'input[placeholder*="password" i]'
    ].join(', ')).first();

    if (!(await emailField.isVisible({ timeout }).catch(() => false))) return false;

    await fillHighlighted(emailField, this.options.email, 'Email');
    await fillHighlighted(passwordField, this.options.password, 'Password');
    await clickHighlighted(this.page.getByRole('button', { name: 'Login', exact: true }), 'Login');
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    await this.page.waitForTimeout(1500);
    return true;
  }

  async assertLoginCompleted(contextLabel = 'login') {
    const emailField = this.page.locator([
      'input[type="email"]',
      'input[name*="email" i]',
      'input[id*="email" i]',
      'input[placeholder*="email" i]'
    ].join(', ')).first();

    if (await emailField.isVisible({ timeout: 3000 }).catch(() => false)) {
      const pageState = await this.getPageState();
      throw new Error(
        `Login did not complete during ${contextLabel}. ` +
        `Check VC_EMAIL/VC_PASSWORD and the staging login page. URL: ${pageState.url}. Page text: ${pageState.text || '-'}`
      );
    }
  }

  async loginOnce() {
    console.log('Logging in once for the full application suite...');
    await this.page.goto(`${this.options.baseUrl}/api/sso/users/login/`, { waitUntil: 'domcontentloaded' });

    if (!(await this.fillLoginFormIfVisible(8000))) {
      console.log('Existing authenticated session found.');
    }

    await this.completeSsoHandoff();
    await this.assertLoginCompleted('initial SSO handoff');
    await this.forceTargetProjectStorage();
    await this.context.storageState({ path: AUTH_STATE_PATH });
    console.log('Shared login session saved and will be reused in the same browser.');
  }

  async completeSsoHandoff() {
    const dashboard = new DashboardPage(this.page);

    for (let attempt = 1; attempt <= 15; attempt += 1) {
      if (await this.fillLoginFormIfVisible(1000)) {
        continue;
      }

      if (await dashboard.openPlatformIfChooser()) {
        await this.page.waitForTimeout(2000);
        await this.page.goto(`${this.options.appUrl.replace(/\/$/, '')}/${this.options.projectId}/home`, {
          waitUntil: 'domcontentloaded'
        }).catch((error) => {
          if (!/ERR_ABORTED|Navigation interrupted|interrupted by another navigation|net::ERR_ABORTED/i.test(error.message)) {
            throw error;
          }
        });
        await this.page.waitForTimeout(2000);
        continue;
      }

      const url = this.page.url();
      if (url.startsWith(this.options.appUrl) && await this.waitForAppAuthState()) {
        return;
      }

      if (url.startsWith(this.options.appUrl) && /\/login\b/i.test(url) && attempt % 3 === 0) {
        console.log(`SSO app login handoff is still loading; reloading attempt ${attempt}.`);
        await this.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
        await this.page.waitForTimeout(2000);
        continue;
      }

      if (await dashboard.location.isVisible({ timeout: 1000 }).catch(() => false)) {
        return;
      }

      await this.page.waitForTimeout(1000);
    }

    const pageState = await this.getPageState();
    throw new Error(`SSO handoff did not reach the app. URL: ${pageState.url}. Page text: ${pageState.text || '-'}`);
  }

  async waitForAppAuthState() {
    return this.page.waitForFunction(() => {
      const hasAccessToken = Boolean(localStorage.getItem('v3_access_token'));
      const hasRefreshToken = Boolean(localStorage.getItem('v3_refresh_token'));
      const isPastLoginRoute = !/\/login\/?$/i.test(window.location.pathname);
      const hasProjectChooser = /choose project/i.test(document.body.innerText || '');

      return hasAccessToken && hasRefreshToken && (isPastLoginRoute || hasProjectChooser);
    }, null, { timeout: 15000 }).then(() => true).catch(() => false);
  }

  async forceTargetProjectStorage() {
    const changed = await this.page.evaluate((projectId) => {
      const values = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        values.push(localStorage.getItem(localStorage.key(index)));
      }

      for (const value of values) {
        try {
          const parsed = JSON.parse(value);
          const projects = Array.isArray(parsed?.projects) ? parsed.projects : [];
          const project = projects.find((candidate) => candidate?.ref === projectId);
          if (project) {
            localStorage.setItem('v3_project_data', JSON.stringify(project));
            localStorage.setItem('v3_project_ref', project.ref);
            localStorage.setItem('v3_project_site_id', String(project.id));
            return project.name || project.ref;
          }
        } catch {
          // Ignore non-JSON localStorage entries.
        }
      }

      return null;
    }, this.options.projectId).catch(() => null);

    if (changed) console.log(`Target project selected in browser storage: ${changed}`);
  }

  getProjectId() {
    const match = this.page.url().match(/\/(5ET[A-Z0-9]+)\//i);
    return match ? match[1] : this.options.projectId;
  }

  isBookingListUrl() {
    return /\/booking(?:[/?#]|$)/i.test(this.page.url());
  }

  async gotoProjectPath(routePath) {
    const projectId = this.getProjectId();
    const targetUrl = `${this.options.appUrl.replace(/\/$/, '')}/${projectId}${routePath}`;
    await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    const dashboard = new DashboardPage(this.page);
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      if (await this.fillLoginFormIfVisible(2000)) {
        await this.completeSsoHandoff();
        await this.forceTargetProjectStorage();
        await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
        continue;
      }

      if (await dashboard.openPlatformIfChooser()) {
        await this.page.waitForTimeout(1500);
        await this.forceTargetProjectStorage();
        await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
        continue;
      }

      await this.forceTargetProjectStorage();
      return;
    }
  }

  async isNewBookingButtonReady(timeout = 1500) {
    if (!this.isBookingListUrl()) return false;

    const candidates = [
      this.page.getByRole('button', { name: /New Booking/i }).first(),
      this.page.locator('button:has-text("New Booking")').first()
    ];

    for (const candidate of candidates) {
      const visible = await candidate.isVisible({ timeout }).catch(() => false);
      if (visible && await candidate.isEnabled({ timeout: 500 }).catch(() => false)) return true;
    }

    return false;
  }

  async waitForBookingListReady(timeout = 45000) {
    if (await this.isNewBookingButtonReady(1000)) return true;

    return this.page.waitForFunction(() => {
      if (!/\/booking\/?$/i.test(window.location.pathname)) return false;

      const buttons = Array.from(document.querySelectorAll('button'));
      const hasNewBookingButton = buttons.some((button) =>
        /new\s+booking/i.test((button.innerText || button.textContent || '').replace(/\s+/g, ' ')) &&
          !button.disabled &&
          !button.className.includes('disabled') &&
          button.getAttribute('aria-disabled') !== 'true'
      );
      const text = (document.body.innerText || '').replace(/\s+/g, ' ');
      return hasNewBookingButton && /Booking List/i.test(text);
    }, null, { timeout, polling: 500 }).then(() => true).catch(() => false);
  }

  async openBookingList() {
    if (!(await this.waitForBookingListReady(1500))) {
      await this.gotoProjectPath('/booking');
      if (await this.waitForBookingListReady(45000)) return;
    }

    const dashboard = new DashboardPage(this.page);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if (await this.waitForBookingListReady(5000)) return;

      if (/\/home(?:[/?#]|$)/i.test(this.page.url())) {
        await this.forceTargetProjectStorage();
        await this.gotoProjectPath('/booking');
        if (await this.waitForBookingListReady(45000)) return;
        continue;
      }

      if (await dashboard.projectLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dashboard.selectProject();
        continue;
      }

      if (await dashboard.location.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dashboard.selectLocation();
        continue;
      }

      if (await dashboard.bookingMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dashboard.goToBookings();
        continue;
      }

      console.log(`Booking List is not ready yet; reopening through project chooser attempt ${attempt}.`);
      await this.page.goto(`${this.options.appUrl.replace(/\/$/, '')}/project/choose`, { waitUntil: 'domcontentloaded' }).catch(() => null);
      await this.page.waitForTimeout(2000);
      if (await dashboard.clickLocationProjectCard('Buckingham Palace').catch(() => false)) {
        await this.forceTargetProjectStorage();
        await this.gotoProjectPath('/booking');
      } else {
        await this.gotoProjectPath('/booking');
      }

      if (await this.waitForBookingListReady(45000)) return;
    }

    if (!(await this.waitForBookingListReady(10000))) {
      const diagnostics = await this.getBookingListDiagnostics();
      throw new Error(`Booking List did not become ready. ${this.formatBookingListDiagnostics(diagnostics)}`);
    }
  }

  async openUserManagement() {
    const inviteUsersButton = this.page.getByRole('button', { name: /Invite Users/i }).first();
    if (!(await inviteUsersButton.isVisible({ timeout: 1500 }).catch(() => false))) {
      await this.gotoProjectPath('/dashboard/manage-user');
    }

    const userManagement = new UserManagementPage(this.page);
    if (await inviteUsersButton.waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false)) {
      return userManagement;
    }

    await userManagement.navigateToUserManagement();
    return userManagement;
  }

  getPageName(flowName) {
    return FLOW_PAGE_NAMES[flowName] || flowName || 'Application';
  }

  async showTestCaseBanner(record, status, errorMessage = '') {
    await this.page.evaluate(({ testCase, currentStatus, error }) => {
      const existing = document.getElementById('vc-full-application-testcase-banner');
      if (existing) existing.remove();

      const colors = {
        running: { background: '#173b73', border: '#60a5fa' },
        passed: { background: '#075f4b', border: '#34d399' },
        failed: { background: '#8b1d1d', border: '#ff4d4f' }
      };
      const palette = colors[currentStatus] || colors.running;
      const banner = document.createElement('div');
      banner.id = 'vc-full-application-testcase-banner';
      banner.setAttribute('data-status', currentStatus);
      banner.textContent = [
        `${testCase.id} | ${testCase.pageName}`,
        testCase.name,
        currentStatus.toUpperCase(),
        error ? `ERROR: ${error}` : ''
      ].filter(Boolean).join(' — ');
      banner.style.cssText = [
        'position:fixed',
        'top:12px',
        'left:50%',
        'transform:translateX(-50%)',
        'z-index:2147483647',
        `background:${palette.background}`,
        'color:#fff',
        `border:4px solid ${palette.border}`,
        'box-shadow:0 0 0 7px rgba(255,77,79,.20),0 8px 24px rgba(0,0,0,.28)',
        'border-radius:8px',
        'padding:11px 18px',
        'max-width:90vw',
        'font:700 14px Arial,sans-serif',
        'text-align:center'
      ].join(';');
      document.body.appendChild(banner);
    }, {
      testCase: record,
      currentStatus: status,
      error: String(errorMessage || '').slice(0, 500)
    }).catch(() => null);
  }

  async runStep(flowName, stepName, action) {
    const stepNumber = this.stepCounter + 1;
    const startedAt = new Date();
    const record = {
      stepNumber,
      id: `TC-${String(stepNumber).padStart(2, '0')}`,
      flowName,
      pageName: this.getPageName(flowName),
      name: stepName,
      status: 'running',
      timestamp: startedAt.toISOString(),
      duration: 0,
      error: null
    };

    this.stepCounter = stepNumber;
    this.steps.push(record);
    console.log(`\n${record.id} [${flowName}] ${stepName}`);
    await this.page.bringToFront().catch(() => null);
    await this.showTestCaseBanner(record, 'running');

    try {
      await action();
      record.status = 'passed';
      await this.showTestCaseBanner(record, 'passed');
      console.log(`${record.id} passed`);
    } catch (error) {
      record.status = 'failed';
      record.error = error.message;
      console.log(`${record.id} failed: ${error.message}`);
      await this.showTestCaseBanner(record, 'failed', error.message);
      await this.captureFailureScreenshot(record);
      await this.recoverAfterStepFailure(record).catch((cleanupError) => {
        console.log(`Post-failure cleanup issue after ${record.id}: ${cleanupError.message}`);
      });
      if (!this.options.continueOnFailure) throw error;
    } finally {
      record.duration = Date.now() - startedAt.getTime();
      await this.page.waitForTimeout(this.options.actionGap).catch(() => null);
    }
  }

  async recoverAfterStepFailure(record) {
    await this.page.keyboard.press('Escape').catch(() => null);
    const closeCandidates = [
      this.page.getByRole('button', { name: /^(Close|Cancel|OK|Done)$/i }).last(),
      this.page.locator('button[aria-label*="close" i], .btn-close, button.close').last()
    ];

    for (const candidate of closeCandidates) {
      if (await candidate.isVisible({ timeout: 1000 }).catch(() => false)) {
        await candidate.click({ force: true, timeout: 3000 }).catch(() => null);
      }
    }

    if (record.pageName === 'Calendar') {
      await this.page.goto(`${this.options.appUrl.replace(/\/$/, '')}/${this.options.projectId}/home`, {
        waitUntil: 'domcontentloaded'
      }).catch(() => null);
    }
  }

  async captureFailureScreenshot(record) {
    const screenshotsDir = path.resolve('screenshots');
    fs.mkdirSync(screenshotsDir, { recursive: true });
    const screenshotPath = path.join(screenshotsDir, `full_app_${record.id}_${formatTimestampForFile()}.png`);
    await this.page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => null);
    record.screenshot = path.relative(process.cwd(), screenshotPath);
  }

  async captureEvidenceScreenshot(label) {
    const screenshotsDir = path.resolve('screenshots');
    fs.mkdirSync(screenshotsDir, { recursive: true });
    const safeLabel = String(label || 'evidence')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
    const screenshotPath = path.join(screenshotsDir, `full_app_${safeLabel}_${formatTimestampForFile()}.png`);
    await this.page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => null);
    return path.relative(process.cwd(), screenshotPath);
  }

  async runDeliverySchedulingSteps(flowName, booking) {
    await this.runStep(flowName, 'Select Access point', async () => {
      await booking.selectFirstDropdownValue(booking.accessPointSelect, 'Access point');
    });
    await this.runStep(flowName, 'Select Vehicle type', async () => {
      await booking.selectFirstDropdownValue(booking.vehicleTypeSelect, 'Vehicle type');
    });
    await this.runStep(flowName, 'Select Fuel type', async () => {
      await booking.selectFirstDropdownValue(booking.fuelTypeSelect, 'Fuel type');
    });
    await this.runStep(flowName, 'Select Resource', async () => {
      if (/^(Delivery|Multi-Vehicle) Booking$/i.test(flowName) && !/^true$/i.test(process.env.SELECT_OPTIONAL_BOOKING_RESOURCE || '')) {
        console.log(`${flowName}: skipping optional Resource to keep booking slot availability broad.`);
        return;
      }
      await booking.selectResourceWithAccessPointFallback(3);
    });
    await this.runStep(flowName, 'Continue from Scheduling Information', async () => {
      await booking.clickNext('Scheduling next');
    });
  }

  async runDeliveryDateSteps(flowName, booking) {
    await this.runStep(flowName, 'Open Booking Date calendar', async () => {
      await booking.waitForStep('Booking Date');
    });
    await this.runStep(flowName, 'Select first available booking date', async () => {
      await booking.selectFirstAvailableBookingDate();
    });
    await this.runStep(flowName, 'Continue from Booking Date', async () => {
      await booking.waitForStep('Booking Time');
    });
  }

  async runDeliveryTimeSteps(flowName, booking) {
    await this.runStep(flowName, 'Load available booking time slots', async () => {
      await booking.waitForStep('Booking Time');
      await this.page.waitForTimeout(5000);
      await booking.loadTimeSlots();
      await booking.waitForAvailableTimeSlots();
    });
    await this.runStep(flowName, 'Select first available booking time', async () => {
      if (booking.lastTimeSlotState === 'no-slots') {
        console.log(`${flowName}: no booking time slots are available; continuing because the app enables Next.`);
        return;
      }
      const timeSlotSelected = await booking.trySelectTimeSlot();
      if (!timeSlotSelected) {
        await booking.clickFirstAvailableTimeSlot('Fallback time slot');
      }
      await this.page.waitForTimeout(1000);
    });
    await this.runStep(flowName, 'Continue from Booking Time', async () => {
      await booking.clickNext('Booking time next');
      await booking.waitForBusyState();
      await booking.waitForStep('Booking Details');
    });
  }

  async runDeliveryBookingDetailsSteps(flowName, booking) {
    await this.runStep(flowName, 'Wait for Booking Details form', async () => {
      await booking.waitForStep('Booking Details');
      await booking.waitForBookingDetailsContent();
    });
    await this.runStep(flowName, 'Use requester details', async () => {
      await booking.checkUseMyDetails();
    });
    await this.runStep(flowName, 'Fill visible booking detail fields', async () => {
      await booking.fillVisibleBookingDetailsFields();
    });
    await this.runStep(flowName, 'Select required booking detail dropdowns', async () => {
      await booking.selectVisibleRequiredDropdowns();
    });
    await this.runStep(flowName, 'Continue from Booking Details', async () => {
      await booking.clickNext('Booking details next');
    });
  }

  async runRecurringSchedulingSteps(flowName, recurringBooking) {
    await this.runStep(flowName, 'Select Access point', async () => {
      await recurringBooking.selectFirstOption('#mui-component-select-accesspoint', 'Access point');
    });
    await this.runStep(flowName, 'Select Vehicle type', async () => {
      await recurringBooking.selectFirstOption('#mui-component-select-vehicleType', 'Vehicle type');
    });
    await this.runStep(flowName, 'Select Fuel type', async () => {
      await recurringBooking.selectFirstOption('#mui-component-select-fuelType', 'Fuel type');
    });
    await this.runStep(flowName, 'Select optional resources', async () => {
      await recurringBooking.selectOptionalResources();
    });
    await this.runStep(flowName, 'Continue from Scheduling Information', async () => {
      await recurringBooking.clickNext('Scheduling information');
    });
  }

  async runRecurringDateSteps(flowName, recurringBooking) {
    await this.runStep(flowName, 'Wait for recurring date fields', async () => {
      await this.page.waitForFunction(
        () => document.querySelectorAll('.custom-date-input.custom-date-input-width').length >= 2,
        null,
        { timeout: 90000 }
      );
    });
    await this.runStep(flowName, 'Select recurring start date', async () => {
      await recurringBooking.selectDateInput(0, 0);
    });
    await this.runStep(flowName, 'Select recurring end date', async () => {
      await recurringBooking.selectDateInput(1, 2);
    });
    await this.runStep(flowName, 'Continue from Recurring Date Range', async () => {
      await recurringBooking.clickNext('Date selection');
    });
  }

  async runRecurringDaysSteps(flowName, recurringBooking) {
    await this.runStep(flowName, 'Wait for recurring day selector', async () => {
      await this.page.waitForFunction(
        () => document.body.innerText.includes('Repeat on'),
        null,
        { timeout: 30000 }
      );
    });
    await this.runStep(flowName, 'Select recurring days', async () => {
      const selectedDays = await recurringBooking.selectAllAvailableRecurringDays();
      if (!selectedDays.length) {
        throw new Error('Could not find available recurring day buttons');
      }
      console.log(`Selected recurring days: ${selectedDays.join(', ')}`);
    });
    await this.runStep(flowName, 'Continue from Recurring Days', async () => {
      await recurringBooking.clickNext('Recurring days');
    });
  }

  async runRecurringBookingDetailsSteps(flowName, recurringBooking) {
    await this.runStep(flowName, 'Wait for Booking Details form', async () => {
      await this.page.getByText('Booking Details', { exact: true }).first().waitFor({ state: 'visible' });
    });
    await this.runStep(flowName, 'Use requester details', async () => {
      const useMyDetails = this.page.locator('#active');
      if (await recurringBooking.isVisible(useMyDetails) && !(await useMyDetails.isChecked())) {
        await useMyDetails.check();
      }
    });
    await this.runStep(flowName, 'Continue from Booking Details', async () => {
      await recurringBooking.clickNext('Booking details');
    });
  }

  flowMethodForBookingType(typeKey) {
    return {
      delivery: () => this.runDeliveryFlow(),
      recurring: () => this.runRecurringFlow(),
      multiVehicle: () => this.runMultiVehicleFlow(),
      resourceOnly: () => this.runResourceFlow()
    }[typeKey];
  }

  async discoverBookingTypesForRun() {
    await this.openBookingList();
    const discoveryBooking = new DeliveryBookingPage(this.page);
    await discoveryBooking.startNewBooking();
    const discoveredTypes = await discoverAvailableBookingTypes(this.page);
    const screenshot = await this.captureEvidenceScreenshot('available-booking-types');

    this.bookingTypeAvailability = discoveredTypes.map((type) => ({
      key: type.key,
      label: type.label,
      flowName: type.flowName,
      mandatory: type.mandatory,
      available: Boolean(type.available),
      enabled: Boolean(type.enabled),
      sourceText: type.sourceText || null,
      screenshot
    }));

    console.log(`Available booking types: ${
      this.bookingTypeAvailability
        .filter((type) => type.available && type.enabled)
        .map((type) => type.label)
        .join(', ') || 'none detected'
    }`);

    return this.bookingTypeAvailability;
  }

  recordBookingTypeOutcome(type, outcome) {
    const existingIndex = this.bookingTypeResults.findIndex((result) => result.key === type.key);
    const record = {
      key: type.key,
      label: type.label,
      mandatory: Boolean(type.mandatory),
      status: outcome.status,
      reason: outcome.reason || null,
      bookingRef: outcome.bookingRef || null,
      message: outcome.message || null,
      duration: outcome.duration || 0,
      screenshot: outcome.screenshot || null,
      automaticApproval: outcome.automaticApproval ?? null,
      expectedStatus: outcome.expectedStatus || null,
      actualStatus: outcome.actualStatus || null
    };

    if (existingIndex === -1) {
      this.bookingTypeResults.push(record);
    } else {
      this.bookingTypeResults[existingIndex] = record;
    }
  }

  async runDiscoveredBookingCreationFlows() {
    const availability = await this.discoverBookingTypesForRun();

    for (const type of availability) {
      if (!type.available || !type.enabled) {
        const reason = type.mandatory
          ? 'Mandatory Delivery booking type was not visible or enabled.'
          : `${type.label} option was unavailable in the New Booking screen.`;
        const screenshot = await this.captureEvidenceScreenshot(`${type.label}-booking-type-skipped`);
        this.recordBookingTypeOutcome(type, {
          status: type.mandatory ? 'failed' : 'skipped',
          reason,
          screenshot
        });

        if (type.mandatory) {
          throw new Error(reason);
        }

        console.log(`${type.label} skipped: ${reason}`);
        continue;
      }

      const startedAt = Date.now();
      const beforeCount = this.bookingCreations.length;
      const beforeStepCount = this.steps.length;
      try {
        const runFlow = this.flowMethodForBookingType(type.key);
        if (!runFlow) {
          throw new Error(`No booking flow is registered for ${type.label}.`);
        }
        await runFlow();
        const failedStep = this.steps
          .slice(beforeStepCount)
          .find((step) => step.flowName === type.flowName && step.status === 'failed');
        if (failedStep) {
          throw new Error(`${failedStep.id} ${failedStep.name} failed: ${failedStep.error}`);
        }
        const creation = this.bookingCreations.slice(beforeCount).pop() || {};
        const screenshot = await this.captureEvidenceScreenshot(`${type.label}-booking-type-passed`);
        this.recordBookingTypeOutcome(type, {
          status: 'passed',
          reason: null,
          bookingRef: creation.bookingRef,
          message: creation.message,
          duration: Date.now() - startedAt,
          screenshot
        });
      } catch (error) {
        const screenshot = await this.captureEvidenceScreenshot(`${type.label}-booking-type-failed`);
        this.recordBookingTypeOutcome(type, {
          status: 'failed',
          reason: error.message,
          duration: Date.now() - startedAt,
          screenshot
        });

        if (!this.options.continueOnFailure) {
          throw error;
        }
      }
    }
  }

  async runDeliveryFlow() {
    const flowName = 'Delivery Booking';
    const deliveryBooking = new DeliveryBookingPage(this.page);
    await this.runStep(flowName, 'Open authenticated Booking List', async () => this.openBookingList());
    await this.runStep(flowName, 'Start a new booking', async () => deliveryBooking.startNewBooking());
    await this.runStep(flowName, 'Select Delivery booking type', async () => deliveryBooking.selectBookingType());
    await this.runDeliverySchedulingSteps(flowName, deliveryBooking);
    await this.runDeliveryDateSteps(flowName, deliveryBooking);
    await this.runDeliveryTimeSteps(flowName, deliveryBooking);
    await this.runDeliveryBookingDetailsSteps(flowName, deliveryBooking);
    await this.runStep(flowName, 'Complete mandatory additional details', async () => deliveryBooking.completeMandatoryAdditionalDetails());
    await this.runStep(flowName, 'Submit delivery booking', async () => {
      this.recordBookingCreation(flowName, await deliveryBooking.submitBooking());
    });
  }

  async runRecurringFlow() {
    const flowName = 'Recurring Booking';
    const recurringBooking = new RecurringBookingPage(this.page);
    await this.runStep(flowName, 'Open authenticated Booking List', async () => this.openBookingList());
    await this.runStep(flowName, 'Start a new booking', async () => recurringBooking.startNewBooking());
    await this.runStep(flowName, 'Select Recurring booking type', async () => recurringBooking.selectRecurringBookingType());
    await this.runRecurringSchedulingSteps(flowName, recurringBooking);
    await this.runRecurringDateSteps(flowName, recurringBooking);
    await this.runRecurringDaysSteps(flowName, recurringBooking);
    await this.runStep(flowName, 'Select first available recurring time', async () => recurringBooking.selectFirstAvailableBookingTime());
    await this.runRecurringBookingDetailsSteps(flowName, recurringBooking);
    await this.runStep(flowName, 'Complete mandatory additional details', async () => recurringBooking.completeMandatoryAdditionalDetails());
    await this.runStep(flowName, 'Submit recurring booking', async () => {
      this.recordBookingCreation(flowName, await recurringBooking.submitBooking());
    });
  }

  async runMultiVehicleFlow() {
    const flowName = 'Multi-Vehicle Booking';
    const multiVehicleBooking = new MultiVehicleBookingPage(this.page);
    await this.runStep(flowName, 'Open authenticated Booking List', async () => this.openBookingList());
    await this.runStep(flowName, 'Start a new booking', async () => multiVehicleBooking.startNewBooking());
    await this.runStep(flowName, 'Select Multi-Vehicle booking type', async () => multiVehicleBooking.selectBookingType());
    await this.runDeliverySchedulingSteps(flowName, multiVehicleBooking);
    await this.runDeliveryDateSteps(flowName, multiVehicleBooking);
    await this.runDeliveryTimeSteps(flowName, multiVehicleBooking);
    await this.runDeliveryBookingDetailsSteps(flowName, multiVehicleBooking);
    await this.runStep(flowName, 'Complete mandatory additional details', async () => multiVehicleBooking.completeMandatoryAdditionalDetails());
    await this.runStep(flowName, 'Submit multi-vehicle booking', async () => {
      this.recordBookingCreation(flowName, await multiVehicleBooking.submitBooking());
    });
  }

  async runResourceFlow() {
    const flowName = 'Resource-only Booking';
    const resourceBooking = new ResourceOnlyBookingPage(this.page);
    await this.runStep(flowName, 'Open authenticated Booking List', async () => this.openBookingList());
    await this.runStep(flowName, 'Start a new booking', async () => resourceBooking.startNewBooking());
    await this.runStep(flowName, 'Select Resource Only booking type', async () => resourceBooking.selectResourceBookingType());
    await this.runStep(flowName, 'Select resources', async () => resourceBooking.selectResources());
    await this.runStep(flowName, 'Select first available booking date', async () => resourceBooking.selectFirstAvailableBookingDate());
    await this.runStep(flowName, 'Select first available booking time', async () => resourceBooking.selectFirstAvailableBookingTime());
    await this.runStep(flowName, 'Complete booking details', async () => resourceBooking.completeBookingDetails());
    await this.runStep(flowName, 'Submit resource booking', async () => {
      this.recordBookingCreation(flowName, await resourceBooking.submitBooking());
    });
  }

  recordBookingCreation(type, confirmation) {
    this.bookingCreations.push({
      type,
      bookingRef: confirmation?.bookingRef || null,
      message: confirmation?.message || null
    });
  }

  automaticApprovalRoles() {
    const projectAdminEmail = process.env.PROJECT_ADMIN_EMAIL || this.options.email;
    const projectAdminPassword = process.env.PROJECT_ADMIN_PASSWORD || this.options.password;
    const projectOwnerEmail = process.env.PROJECT_OWNER_EMAIL || process.env.ROLE_PROJECT_OWNER_EMAIL || '';
    const projectOwnerPassword = process.env.PROJECT_OWNER_PASSWORD || process.env.ROLE_PROJECT_OWNER_PASSWORD || '';

    return [
      {
        key: 'projectAdmin',
        label: 'Project Admin',
        email: projectAdminEmail,
        password: projectAdminPassword,
        configured: Boolean(projectAdminEmail && projectAdminPassword)
      },
      {
        key: 'projectOwner',
        label: 'Project Owner',
        email: projectOwnerEmail,
        password: projectOwnerPassword,
        configured: Boolean(projectOwnerEmail && projectOwnerPassword)
      }
    ];
  }

  automaticApprovalCredentialHint(role) {
    if (role.key === 'projectOwner') {
      return 'PROJECT_OWNER_EMAIL/PROJECT_OWNER_PASSWORD or ROLE_PROJECT_OWNER_EMAIL/ROLE_PROJECT_OWNER_PASSWORD';
    }
    return 'PROJECT_ADMIN_EMAIL/PROJECT_ADMIN_PASSWORD';
  }

  async resetBrowserContextForRole(role) {
    await this.context?.close().catch(() => null);
    this.context = await this.browser.newContext({
      viewport: this.options.headless ? this.viewport : null,
      screen: this.options.headless ? this.viewport : undefined,
      deviceScaleFactor: this.options.headless ? 1 : undefined,
      ignoreHTTPSErrors: true,
      permissions: ['notifications']
    });

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(60000);
    this.page.setDefaultNavigationTimeout(60000);
    this.page.on('pageerror', (error) => console.log(`Page error: ${error.message}`));
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') console.log(`Console error: ${msg.text()}`);
    });
    this.page.on('requestfailed', (request) => {
      console.log(`Request failed: ${request.method()} ${redactSensitiveUrl(request.url())}`);
    });

    const previousEmail = this.options.email;
    const previousPassword = this.options.password;
    this.options.email = role.email;
    this.options.password = role.password;
    try {
      await this.loginOnce();
    } finally {
      this.options.email = previousEmail;
      this.options.password = previousPassword;
    }
  }

  expectedApprovalStatuses(automaticApprovalEnabled) {
    return automaticApprovalEnabled
      ? ['Approved', 'Scheduled', 'Active']
      : ['For Approval', 'Pending', 'Provisional'];
  }

  async findBookingStatusInList(bookingRef, expectedStatuses) {
    const bookingList = new BookingListPage(this.page);
    await this.openBookingList();

    for (const status of expectedStatuses) {
      try {
        await bookingList.openStatusTab(status);
        if (await bookingList.findBookingAcrossCurrentPagination(bookingRef, status)) {
          return {
            location: 'Booking List',
            status,
            screenshot: await this.captureEvidenceScreenshot(`${bookingRef}-${status}-booking-list`)
          };
        }
      } catch (error) {
        console.log(`Booking List status check skipped for ${status}: ${error.message}`);
      }
    }

    await bookingList.openStatusTab('All').catch(() => null);
    const row = await this.page.evaluate((id) => {
      const rows = Array.from(document.querySelectorAll('table tbody tr, tr, [role="row"], .booking-row, .table-row'));
      const match = rows.find((candidate) => (candidate.innerText || candidate.textContent || '').includes(id));
      return match ? (match.innerText || match.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500) : '';
    }, bookingRef).catch(() => '');

    const detected = expectedStatuses.find((status) => new RegExp(status.replace(/\s+/g, String.raw`\s+`), 'i').test(row));
    if (detected) {
      return {
        location: 'Booking List',
        status: detected,
        rowText: row,
        screenshot: await this.captureEvidenceScreenshot(`${bookingRef}-${detected}-booking-list`)
      };
    }

    throw new Error(`Booking ${bookingRef} was not found with expected status ${expectedStatuses.join(' or ')}. Row text: ${row || '-'}`);
  }

  async captureBookingDetailStatus(bookingRef) {
    const editBooking = new EditBookingPage(this.page);
    await this.openBookingList();
    await editBooking.selectBookingById(bookingRef);
    await editBooking.waitForBookingDetailsReady();
    const text = await this.page.locator('#myModal2, [role="dialog"], body').first().innerText({ timeout: 5000 }).catch(() => '');
    return {
      location: 'Booking Details',
      text: text.replace(/\s+/g, ' ').trim().slice(0, 500),
      screenshot: await this.captureEvidenceScreenshot(`${bookingRef}-booking-details-status`)
    };
  }

  async captureCalendarStatus(bookingRef) {
    const calendar = new CalendarBookingPage(this.page, {
      appUrl: this.options.appUrl,
      projectId: this.options.projectId
    });

    await calendar.navigateToCalendar();
    await calendar.selectBookingScope('All Project Bookings').catch(() => null);
    const bodyText = await this.page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
    return {
      location: 'Calendar',
      found: bodyText.includes(bookingRef),
      screenshot: await this.captureEvidenceScreenshot(`${bookingRef}-calendar-status`)
    };
  }

  async validateCreatedBookingApprovalStatus({ bookingRef, automaticApprovalEnabled }) {
    if (!bookingRef) {
      throw new Error('Booking reference was not captured after submission, so status could not be validated.');
    }

    const expectedStatuses = this.expectedApprovalStatuses(automaticApprovalEnabled);
    const listStatus = await this.findBookingStatusInList(bookingRef, expectedStatuses);
    const details = await this.captureBookingDetailStatus(bookingRef).catch((error) => ({
      location: 'Booking Details',
      error: error.message
    }));
    const calendar = await this.captureCalendarStatus(bookingRef).catch((error) => ({
      location: 'Calendar',
      error: error.message
    }));

    return {
      expectedStatuses,
      actualStatus: listStatus.status,
      evidence: [listStatus, details, calendar]
    };
  }

  async runBookingTypeForApprovalValidation(type, automaticApprovalEnabled, roleLabel) {
    const startedAt = Date.now();
    const beforeCount = this.bookingCreations.length;
    const beforeStepCount = this.steps.length;
    const runFlow = this.flowMethodForBookingType(type.key);
    if (!runFlow) {
      throw new Error(`No booking flow is registered for ${type.label}.`);
    }

    await runFlow();
    const failedStep = this.steps
      .slice(beforeStepCount)
      .find((step) => step.flowName === type.flowName && step.status === 'failed');
    if (failedStep) {
      throw new Error(`${failedStep.id} ${failedStep.name} failed: ${failedStep.error}`);
    }
    const creation = this.bookingCreations.slice(beforeCount).pop() || {};
    const status = await this.validateCreatedBookingApprovalStatus({
      bookingRef: creation.bookingRef,
      automaticApprovalEnabled
    });

    return {
      role: roleLabel,
      bookingType: type.label,
      automaticApproval: automaticApprovalEnabled,
      expectedStatus: status.expectedStatuses.join(' / '),
      actualStatus: status.actualStatus,
      bookingRef: creation.bookingRef || null,
      message: creation.message || null,
      status: 'passed',
      reason: null,
      duration: Date.now() - startedAt,
      evidence: status.evidence
    };
  }

  recordApprovalValidationResult(record) {
    this.approvalValidationResults.push({
      role: record.role,
      bookingType: record.bookingType,
      automaticApproval: record.automaticApproval,
      expectedStatus: record.expectedStatus,
      actualStatus: record.actualStatus || null,
      bookingRef: record.bookingRef || null,
      message: record.message || null,
      status: record.status,
      reason: record.reason || null,
      duration: record.duration || 0,
      evidence: record.evidence || [],
      screenshot: record.screenshot || null
    });
  }

  async runAutomaticApprovalValidationMatrix() {
    const discoveredTypes = (this.bookingTypeAvailability.length
      ? this.bookingTypeAvailability
      : await this.discoverBookingTypesForRun()
    );
    const availableTypes = discoveredTypes.filter((type) => type.available && type.enabled);
    const unavailableTypes = discoveredTypes.filter((type) => !type.available || !type.enabled);
    const roles = this.automaticApprovalRoles();

    for (const role of roles) {
      for (const type of unavailableTypes) {
        for (const automaticApproval of [true, false]) {
          this.recordApprovalValidationResult({
            role: role.label,
            bookingType: type.label,
            automaticApproval,
            expectedStatus: this.expectedApprovalStatuses(automaticApproval).join(' / '),
            status: 'skipped',
            reason: `${type.label} option was unavailable in the New Booking screen.`
          });
        }
      }

      if (!role.configured) {
        for (const type of availableTypes) {
          for (const automaticApproval of [true, false]) {
            this.recordApprovalValidationResult({
              role: role.label,
              bookingType: type.label,
              automaticApproval,
              expectedStatus: this.expectedApprovalStatuses(automaticApproval).join(' / '),
              status: 'skipped',
              reason: `${role.label} credentials were not configured. Set ${this.automaticApprovalCredentialHint(role)}.`
            });
          }
        }
        continue;
      }

      await this.resetBrowserContextForRole(role);
      const settings = new ProjectSettingsPage(this.page, {
        appUrl: this.options.appUrl,
        projectId: this.options.projectId
      });

      for (const automaticApproval of [true, false]) {
        let configuration;
        try {
          configuration = await settings.setAutomaticApprovals(automaticApproval);
          const screenshot = await this.captureEvidenceScreenshot(`${role.label}-automatic-approval-${automaticApproval ? 'enabled' : 'disabled'}`);
          console.log(`${role.label} set Automatic Approvals to ${configuration.actual}. Screenshot: ${screenshot}`);
        } catch (error) {
          for (const type of availableTypes) {
            this.recordApprovalValidationResult({
              role: role.label,
              bookingType: type.label,
              automaticApproval,
              expectedStatus: this.expectedApprovalStatuses(automaticApproval).join(' / '),
              status: 'failed',
              reason: `Could not set Automatic Approvals to ${automaticApproval}: ${error.message}`,
              screenshot: await this.captureEvidenceScreenshot(`${role.label}-automatic-approval-config-failed`)
            });
          }
          if (!this.options.continueOnFailure) throw error;
          continue;
        }

        for (const type of availableTypes) {
          try {
            const result = await this.runBookingTypeForApprovalValidation(type, automaticApproval, role.label);
            this.recordApprovalValidationResult(result);
          } catch (error) {
            const screenshot = await this.captureEvidenceScreenshot(`${role.label}-${type.label}-automatic-approval-${automaticApproval}-failed`);
            this.recordApprovalValidationResult({
              role: role.label,
              bookingType: type.label,
              automaticApproval,
              expectedStatus: this.expectedApprovalStatuses(automaticApproval).join(' / '),
              status: 'failed',
              reason: error.message,
              screenshot
            });
            if (!this.options.continueOnFailure) throw error;
          }
        }
      }
    }
  }

  async getScheduledBookingCandidates() {
    return this.page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr, tr, .booking-row, .table-row, div[role="row"]'));
      const seen = new Set();
      const candidates = [];

      for (const row of rows) {
        const text = row.innerText || row.textContent || '';
        const bookingIdMatch = text.match(/BK[A-Z0-9]{10,}/);
        if (!bookingIdMatch || !/\bScheduled\b/i.test(text)) continue;
        const bookingId = bookingIdMatch[0];
        if (seen.has(bookingId)) continue;
        seen.add(bookingId);
        candidates.push({ bookingId, rowText: text.replace(/\s+/g, ' ').trim().slice(0, 240) });
      }

      return candidates;
    });
  }

  async selectFirstEditableScheduledBooking(editBooking) {
    const candidates = await this.getScheduledBookingCandidates();
    for (const candidate of candidates.slice(0, 12)) {
      console.log(`Checking scheduled candidate for edit flow: ${candidate.bookingId}`);
      await editBooking.selectBookingById(candidate.bookingId);
      await editBooking.waitForBookingDetailsReady();

      const detailsText = await this.page.locator('#myModal2').innerText({ timeout: 5000 }).catch(() => '');
      const isMultiVehicleDetails = /Multi-Vehicle|Add Another|Expected Vehicles\s*-\s*[2-9]/i.test(detailsText);
      const hasCheckInAction = Boolean(await editBooking.findBookingDetailsActionButton('Check In', ['Checked-in', 'Checked In'], { timeout: 1500 }));
      if (!isMultiVehicleDetails && hasCheckInAction) return candidate.bookingId;

      console.log(`Skipping ${candidate.bookingId}; editable single-booking Check In action was not available.`);
      await editBooking.closeSideBarModal();
      await this.page.waitForTimeout(1000);
    }

    throw new Error('No editable single scheduled booking was found for the edit booking flow.');
  }

  async runEditBookingFlow() {
    const flowName = 'Edit Booking';
    const editBooking = new EditBookingPage(this.page);
    let bookingId;

    await this.runStep(flowName, 'Open authenticated Booking List', async () => {
      await this.openBookingList();
      await editBooking.applyDefaultViewFilter();
      await editBooking.applyBookingListDateRange();
    });
    await this.runStep(flowName, 'Select first Scheduled booking', async () => {
      bookingId = await this.selectFirstEditableScheduledBooking(editBooking);
      if (!/^BK[A-Z0-9]+/.test(bookingId)) throw new Error(`Invalid booking id selected: ${bookingId}`);
    });
    await this.runStep(flowName, 'Check in the selected booking', async () => editBooking.checkInBooking({ keepBookingDetailsOpen: true }));
    await this.runStep(flowName, 'Check out the selected booking', async () => {
      await this.page.waitForTimeout(2000);
      await editBooking.checkOutBooking({ keepBookingDetailsOpen: true });
    });
    await this.runStep(flowName, 'Return to list and reopen the same booking', async () => {
      await editBooking.returnToBookingListPage({ applyDefaultView: true, applyDateRange: true });
      await editBooking.selectBookingById(bookingId);
      await editBooking.waitForBookingDetailsReady();
    });
    await this.runStep(flowName, 'Undo checkout for this booking', async () => editBooking.undoBookingAction({ keepBookingDetailsOpen: true }));
    await this.runStep(flowName, 'Undo check-in for this booking', async () => {
      await this.page.waitForTimeout(2000);
      await editBooking.undoBookingAction({ keepBookingDetailsOpen: true });
    });
    await this.runStep(flowName, 'Cancel the booking and confirm Cancel Booking popup', async () => {
      await this.page.waitForTimeout(2000);
      await editBooking.cancelBooking({ keepBookingDetailsOpen: true });
    });
    await this.runStep(flowName, 'Return to Booking List', async () => {
      await editBooking.returnToBookingListPage({ applyDefaultView: true, applyDateRange: true });
      if (!(await this.page.getByRole('button', { name: /New Booking/i }).isVisible({ timeout: 15000 }).catch(() => false))) {
        throw new Error('Booking List did not reopen after cancel.');
      }
    });

    this.bookingId = bookingId;
  }

  async runFilterFlow() {
    const flowName = 'Booking List Filters';
    const filter = new Filter(this.page);
    let filterResult;

    await this.runStep(flowName, 'Open authenticated Booking List', async () => {
      await this.gotoProjectPath('/booking');
      await this.openBookingList();
    });
    await this.runStep(flowName, 'Apply date range, layout, and advanced filters', async () => {
      filterResult = await filter.applyCodegenRecordedFilterFlow();
      if (filterResult.initialRecordCount < 1 || filterResult.finalRecordCount < 1) {
        throw new Error('Booking list filter flow did not return visible records.');
      }
    });

    this.filterResult = filterResult;
  }

  async runBookingListValidationFlow() {
    const flowName = 'Booking List';
    const bookingList = new BookingListPage(this.page);
    const visitedStatuses = [];
    let statusCounts;
    let sortedRefs;

    await this.runStep(flowName, 'Validate status counts and Booking Ref sorting', async () => {
      await this.openBookingList();
      await bookingList.waitForList();
      statusCounts = await bookingList.getStatusTabCounts();

      const missingCounts = ['All', ...bookingList.statuses]
        .filter((status) => !Number.isInteger(statusCounts[status]));
      if (missingCounts.length) {
        throw new Error(`Booking List status counts are missing for: ${missingCounts.join(', ')}`);
      }

      sortedRefs = await bookingList.sortByBookingRef('ascending');
      if (!sortedRefs.length || !bookingList.isBookingRefsSorted(sortedRefs, 'ascending')) {
        throw new Error('Booking List references were not sorted in ascending order.');
      }
    });

    await this.runStep(flowName, 'Visit every Booking List status tab', async () => {
      for (const status of bookingList.statuses) {
        await bookingList.openStatusTab(status);
        visitedStatuses.push(status);
      }
    });

    this.bookingListFlow = {
      statusCounts,
      sortedReferenceCount: sortedRefs?.length || 0,
      visitedStatuses
    };
  }

  async runCalendarFlow() {
    const flowName = 'Calendar';
    const calendar = new CalendarBookingPage(this.page, {
      appUrl: this.options.appUrl,
      projectId: this.options.projectId
    });
    let result;

    await this.runStep(flowName, 'Validate calendar scope, filters, dates, and navigation', async () => {
      result = await calendar.runCodegenCalendarFlow();
      if (!result?.scope) {
        throw new Error('Calendar booking scope was not selected.');
      }
      if (!result?.selectedDateRange?.selectedDate) {
        throw new Error('Calendar did not select a working date.');
      }
    });

    this.calendarFlow = result;
  }

  createMyAccountPage() {
    return new MyAccountPage(this.page, {
      appUrl: this.options.appUrl,
      baseUrl: this.options.baseUrl,
      email: this.options.email,
      password: this.options.password
    });
  }

  async runMyAccountFlow() {
    const flowName = 'My Account';
    const myAccount = this.createMyAccountPage();
    const result = {};

    await this.runStep(flowName, 'Open My Account and update editable details', async () => {
      await myAccount.openMyAccount();
      result.details = await myAccount.updateMyDetails();
      if (!result.details.firstName || !result.details.lastName || !result.details.phone) {
        throw new Error('My Account editable details did not retain values.');
      }
    });

    await this.runStep(flowName, 'Validate and persist account preferences', async () => {
      result.preferences = await myAccount.verifyPreferenceDropdowns();
      const preferenceWarnings = [];
      for (const key of ['language', 'dateFormat', 'timeFormat', 'calendarStartDay']) {
        const selected = result.preferences.selected[key];
        const persisted = result.preferences.persisted[key];
        if (!selected || !persisted || persisted.includes(selected)) {
          continue;
        }
        preferenceWarnings.push(`${key} selected "${selected}" but reloaded as "${persisted}".`);
      }
      result.preferences.warnings = preferenceWarnings;
      if (preferenceWarnings.length) {
        console.log(`My Account preference persistence warning: ${preferenceWarnings.join(' ')}`);
      }
    });

    await this.runStep(flowName, 'Validate company, roles, and password dialog', async () => {
      result.accountAccess = await myAccount.readCompanyAndRoles();
      for (const key of ['company', 'organizationRole', 'projectRole']) {
        if (!result.accountAccess[key]?.value) {
          throw new Error(`My Account ${key} value is missing.`);
        }
      }
      if (result.accountAccess.organizationRole.editable || result.accountAccess.projectRole.editable) {
        throw new Error('My Account role values must be read-only.');
      }

      result.password = await myAccount.verifyUpdatePassword();
      if (!result.password.dialogOpened) {
        result.password.warning = result.password.reason || 'Password action was not available for this account.';
        console.log(`My Account password validation warning: ${result.password.warning}`);
      }
    });

    this.myAccountFlow = result;
  }

  createNotificationPreferencePage() {
    return new NotificationPreferencePage(this.page, {
      appUrl: this.options.appUrl,
      baseUrl: this.options.baseUrl,
      email: this.options.email,
      password: this.options.password
    });
  }

  async runNotificationPreferencesFlow() {
    const flowName = 'Notification Preferences';
    const notificationPreference = this.createNotificationPreferencePage();
    const result = {};

    await this.runStep(flowName, 'Open Notification Preferences with Chrome permission', async () => {
      result.browserPermission = await notificationPreference.openNotificationPreferences();
      if (result.browserPermission !== 'granted') {
        throw new Error(`Chrome notification permission is ${result.browserPermission}.`);
      }
    });

    await this.runStep(flowName, 'Enable push and My Bookings notification preferences', async () => {
      result.pushNotifications = await notificationPreference.enablePushNotifications();
      result.myBookings = await notificationPreference.enableMyBookingsPreferences();
      if (!result.pushNotifications.appPushSwitch?.isEnabled) {
        throw new Error('Application push notifications were not enabled.');
      }
      if (!result.myBookings.verified?.rows?.length) {
        throw new Error('No My Bookings notification preference rows were found.');
      }
    });

    this.notificationPreferencesFlow = result;
  }

  createMyOrganizationPage() {
    return new MyOrganizationPage(this.page, {
      appUrl: this.options.appUrl,
      baseUrl: this.options.baseUrl,
      email: this.options.email,
      password: this.options.password
    });
  }

  async runMyOrganizationFlow() {
    const flowName = 'My Organization';
    const organization = this.createMyOrganizationPage();
    const result = {};

    await this.runStep(flowName, 'Open and validate My Organization details', async () => {
      await organization.openMyOrganization();
      result.details = await organization.updateOrganizationDetails();
      if (!result.details.before?.organizationName ||
          result.details.after?.organizationName !== result.details.before.organizationName) {
        throw new Error('My Organization name was missing or changed unexpectedly.');
      }
      if (!result.details.tradeTypeUpdated || !result.details.submitted) {
        throw new Error('My Organization Trade Type was not updated and saved.');
      }
    });

    await this.runStep(flowName, 'Validate organization users and role controls', async () => {
      result.roleValidation = await organization.validateOrAssignUserRole();
      const usersLoaded = result.roleValidation.users?.count > 0 || result.roleValidation.users?.noData;
      if (!usersLoaded || !result.roleValidation.submitted) {
        throw new Error('My Organization user role validation did not complete.');
      }
    });

    this.myOrganizationFlow = result;
  }

  createAnalyticsPage() {
    const analytics = new AnalyticsPage(this.page);
    Object.assign(analytics.options, {
      appUrl: this.options.appUrl,
      projectId: this.options.projectId,
      baseUrl: this.options.baseUrl,
      email: this.options.email,
      password: this.options.password
    });
    return analytics;
  }

  summarizeAnalyticsFlow(result) {
    const projectConfiguration = result?.projectConfiguration || {};
    return {
      country: projectConfiguration.country || null,
      countryUom: projectConfiguration.countryUom || null,
      configuredCountryUom: projectConfiguration.expectedUnits?.configuredCountryUom || null,
      countryUomFallbackApplied: Boolean(projectConfiguration.expectedUnits?.fallbackApplied),
      expectedDistanceUnit: projectConfiguration.expectedUnits?.distanceUnit || null,
      expectedEmissionUnit: projectConfiguration.expectedUnits?.emissionUnit || null,
      summaryEmissionRecordCount: result?.summaryEmission?.dateRange?.recordCount || 0,
      summaryEmissionDownloaded: Boolean(result?.summaryEmission?.download),
      vehicleEmissionRecordCount: result?.vehicleEmission?.dateRange?.recordCount || 0,
      vehicleSearchExecuted: Boolean(result?.vehicleSearch?.searched),
      vehicleEmissionDownloaded: Boolean(result?.vehicleDownload),
      equipmentEmissionRecordCount: result?.equipmentEmission?.dateRange?.recordCount || 0,
      equipmentSearchExecuted: Boolean(result?.equipmentSearch?.searched),
      equipmentEmissionDownloaded: Boolean(result?.equipmentDownload),
      environmentReportsRecordCount: result?.environmentReports?.dateRange?.recordCount || 0
    };
  }

  async runAnalyticsFlow() {
    const flowName = 'Analytics';
    const analytics = this.createAnalyticsPage();
    let analyticsFlow;

    await this.runStep(flowName, 'Validate emissions date ranges and UOM labels', async () => {
      analyticsFlow = await analytics.runAnalyticsEmissionValidationFlow();
      if ((analyticsFlow?.vehicleEmission?.dateRange?.recordCount || 0) < 1) {
        throw new Error('Vehicle Emission analytics did not show records.');
      }
      if ((analyticsFlow?.equipmentEmission?.dateRange?.recordCount || 0) < 1) {
        throw new Error('Equipment Emission analytics did not show records.');
      }
      if ((analyticsFlow?.environmentReports?.dateRange?.recordCount || 0) < 1) {
        throw new Error('Environment Reports analytics did not show records.');
      }
    });

    this.analyticsFlow = this.summarizeAnalyticsFlow(analyticsFlow);
  }

  createEquipmentManagementPage() {
    const equipmentManagement = new EquipmentManagementPage(this.page);
    Object.assign(equipmentManagement.options, {
      appUrl: this.options.appUrl,
      projectId: this.options.projectId,
      baseUrl: this.options.baseUrl,
      email: this.options.email,
      password: this.options.password
    });
    return equipmentManagement;
  }

  summarizeEquipmentManagementFlow(result) {
    const equipmentListVerification = result?.equipmentListUpload?.verification || {};
    return {
      equipmentListUploadRecordCount: result?.equipmentListUpload?.recordCount || 0,
      equipmentListUploadStatus: result?.equipmentListUpload?.upload?.status || null,
      equipmentListUploadFallback: equipmentListVerification.fallback || null,
      equipmentListUploadWarning: equipmentListVerification.warning || null,
      equipmentListExportDownloaded: Boolean(result?.equipmentListExport),
      equipmentListPdfDownloaded: Boolean(result?.equipmentListPdf),
      equipmentUsageSubmitted: Boolean(result?.usageSubmission?.submitted),
      equipmentUsageYear: result?.usageSubmission?.selectedValues?.year || null,
      equipmentUsageMonth: result?.usageSubmission?.selectedValues?.month || null,
      equipmentUsageAttachmentRecordCount: result?.equipmentUsageAttachment?.recordCount || 0,
      equipmentUsageAttachmentStatus: result?.equipmentUsageAttachment?.upload?.status || null
    };
  }

  async runEquipmentManagementFlow() {
    const flowName = 'Equipment Management';
    const equipmentManagement = this.createEquipmentManagementPage();
    let equipmentManagementFlow;

    await this.runStep(flowName, 'Open authenticated Equipment List', async () => {
      await equipmentManagement.openEquipmentListDirectly();
    });

    await this.runStep(flowName, 'Run Equipment List and Usage automation', async () => {
      equipmentManagementFlow = await equipmentManagement.runEnhancedEquipmentManagementFlow();
      const equipmentListUpload = equipmentManagementFlow?.equipmentListUpload || {};
      const equipmentListVerification = equipmentListUpload.verification || {};
      const hasEquipmentListUploadEvidence = Boolean(
        equipmentListUpload.upload?.success ||
        equipmentListUpload.upload?.message ||
        equipmentListVerification.fallback ||
        equipmentListVerification.warning
      );
      if ((equipmentListUpload.recordCount || 0) < 1 && !hasEquipmentListUploadEvidence) {
        throw new Error('Equipment List upload verification did not find records.');
      }
      if (!equipmentManagementFlow?.usageSubmission?.submitted) {
        throw new Error('Equipment Usage creation did not submit a new record.');
      }
      if ((equipmentManagementFlow?.equipmentUsageAttachment?.recordCount || 0) < 1) {
        throw new Error('Equipment Usage attachment upload verification did not find records.');
      }
    });

    this.equipmentManagementFlow = this.summarizeEquipmentManagementFlow(equipmentManagementFlow);
  }

  async runUserManagementFlow() {
    const flowName = 'User Management';
    const userManagement = new UserManagementPage(this.page, {
      userAccountsFile: this.options.userAccountsFile,
      strictUserListValidation: false
    });
    const accountUsers = this.getUserManagementAccounts(userManagement);

    await this.runStep(flowName, 'Open authenticated User Management page', async () => this.openUserManagement());
    await this.runStep(flowName, 'Negative: reject duplicate roles and invalid invite details', async () => {
      const duplicateRoleUsers = accountUsers.slice(0, 2).map((user) => ({ ...user }));
      if (duplicateRoleUsers.length === 2) {
        duplicateRoleUsers[1].role = duplicateRoleUsers[0].role;
        let duplicateRejected = false;
        try {
          userManagement.validateInviteUserDataset(duplicateRoleUsers);
        } catch (error) {
          duplicateRejected = /duplicate role/i.test(error.message);
        }
        if (!duplicateRejected) {
          throw new Error('Duplicate invite roles were not rejected by validation.');
        }
      }
      await userManagement.verifyInviteFormNegativeScenarios('invalid-email');
    });
    for (let index = 0; index < accountUsers.length; index += 1) {
      const accountUser = accountUsers[index];
      let preparedUser = accountUser;
      let inviteModal;

      await this.runStep(flowName, `Prepare user ${index + 1} invite data`, async () => {
        [preparedUser] = await userManagement.prepareUsersForCreation([accountUser]);
        Object.assign(accountUser, preparedUser);
      });
      await this.runStep(flowName, `Open Invite Users popup for user ${index + 1}`, async () => {
        await this.gotoProjectPath('/dashboard/manage-user');
        await this.openUserManagement();
        inviteModal = await userManagement.openInviteUsersModal();
      });
      await this.runStep(flowName, `Fill invite details for ${accountUser.email}`, async () => {
        await userManagement.fillInviteUserRow(inviteModal, accountUser, 0);
        await userManagement.captureUserManagementScreenshot('user-creation-filled-invite-form', accountUser.email);
      });
      await this.runStep(flowName, `Send invite for ${accountUser.email}`, async () => {
        await userManagement.clickSendInvites(inviteModal);
        await userManagement.waitForInviteSuccessNotification();
        await userManagement.captureUserManagementScreenshot('user-creation-invite-success', accountUser.email);
      });
      await this.runStep(flowName, `Verify invited user visible for ${accountUser.email}`, async () => {
        const invitedUserRow = await userManagement.verifyInvitedUserVisibleInList(accountUser.email);
        await userManagement.captureUserManagementScreenshot('user-created-visible-in-list', accountUser.email);
        if (!(await invitedUserRow.isVisible({ timeout: 5000 }).catch(() => false))) {
          throw new Error(`Created user ${accountUser.email} was not visible in the user list.`);
        }
      });
    }

    const setupReadyUsers = accountUsers.filter((accountUser) => !accountUser.setupMissingFields?.length);

    for (const user of setupReadyUsers) {
      await this.runStep(flowName, `Accept invite and complete account setup for ${user.name}`, async () => {
        await userManagement.acceptInvitationAndCompleteAccountSetup(user, {
          sameBrowserContext: this.options.singleBrowser,
          keepSetupPageOpen: false
        });
      });
    }

    if (setupReadyUsers.length) {
      await this.runStep(flowName, 'Change organization for one completed user account', async () => {
        const changedOrganization = await userManagement.changeOrganizationForUser(setupReadyUsers[0]);
        setupReadyUsers[0].updatedOrganization = changedOrganization;
      });
    }

    const setupSkippedUsers = accountUsers.filter((user) => user.setupMissingFields?.length);
    if (setupSkippedUsers.length) {
      console.log(
        `Skipping account setup for ${setupSkippedUsers.length} Excel user(s) because setup fields are missing: ` +
        setupSkippedUsers.map((user) => `${user.email} (${user.setupMissingFields.join(', ')})`).join('; ')
      );
    }

    this.inviteEmail = null;
    this.createdUsers = accountUsers.map((user) => ({
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      address: user.address,
      updatedOrganization: user.updatedOrganization || null,
      accountSetupSkipped: Boolean(user.setupMissingFields?.length),
      setupMissingFields: user.setupMissingFields || []
    }));
  }

  getUserManagementAccounts(userManagement) {
    if (this.options.userAccountsFile && (this.options.userAccountsFileExplicit || !this.options.singleBrowser)) {
      const accountUsers = userManagement.getUserAccountsFromFile(this.options.userAccountsFile);
      this.userAccountsSource = path.resolve(this.options.userAccountsFile);
      return accountUsers;
    }

    const generatedFile = createGeneratedUserAccountsFile(this.options.generatedUsers);
    this.options.userAccountsFile = generatedFile;
    this.userAccountsSource = path.resolve(generatedFile);
    console.log(`Generated User Management account file: ${this.userAccountsSource}`);
    return userManagement.getUserAccountsFromFile(generatedFile);
  }

  async runAllFlows() {
    this.startTime = new Date();
    await this.setupBrowser();

    try {
      if (this.options.skipLogin && authStateMatchesEmail(AUTH_STATE_PATH, this.options.email)) {
        console.log('Skipping SSO bootstrap and using existing auth.json session.');
      } else {
        await this.loginOnce();
      }
      if (this.options.bookingListPageOnly) {
        console.log('Running Booking List page only: Edit Booking, filters, and Booking List validations.');
        await this.runEditBookingFlow();
        await this.runFilterFlow();
        await this.runBookingListValidationFlow();
        return;
      }
      if (this.options.skipBookingFlows) {
        this.bookingFlowsSkipped = true;
        console.log('Skipping booking creation and lifecycle flows because --skip-booking-flows was provided.');
      } else {
        await this.runDiscoveredBookingCreationFlows();
        if (this.options.approvalMatrix) {
          await this.runAutomaticApprovalValidationMatrix();
        }
        if (this.options.bookingCreationOnly) {
          console.log('Dynamic booking creation flows completed; stopping before lifecycle and application-area flows.');
          return;
        }
        await this.runEditBookingFlow();
      }
      if (this.options.skipFilter) {
        this.filterSkipped = true;
        console.log('Skipping Booking List filter flow because --skip-filter was provided.');
      } else {
        await this.runFilterFlow();
      }
      if (this.options.skipBookingListValidation) {
        this.bookingListValidationSkipped = true;
        console.log('Skipping Booking List validation because --skip-booking-list-validation was provided.');
      } else {
        await this.runBookingListValidationFlow();
      }
      if (this.options.skipCalendar) {
        this.calendarSkipped = true;
        console.log('Skipping Calendar flow because --skip-calendar was provided.');
      } else {
        await this.runCalendarFlow();
      }
      if (this.options.skipAnalytics) {
        this.analyticsSkipped = true;
        console.log('Skipping Analytics flow because --skip-analytics was provided.');
      } else {
        await this.runAnalyticsFlow();
      }
      if (this.options.skipEquipmentManagement) {
        this.equipmentManagementSkipped = true;
        console.log('Skipping Equipment Management flow because --skip-equipment-management was provided.');
      } else {
        await this.runEquipmentManagementFlow();
      }
      if (this.options.skipUserManagement) {
        this.userManagementSkipped = true;
        console.log('Skipping User Management flow because --skip-user-management was provided.');
      } else {
        await this.runUserManagementFlow();
      }
      if (this.options.skipMyAccount) {
        this.myAccountSkipped = true;
        console.log('Skipping My Account flow because --skip-my-account was provided.');
      } else {
        await this.runMyAccountFlow();
      }
      if (this.options.skipNotificationPreferences) {
        this.notificationPreferencesSkipped = true;
        console.log('Skipping Notification Preferences because --skip-notification-preferences was provided.');
      } else {
        await this.runNotificationPreferencesFlow();
      }
      if (this.options.skipMyOrganization) {
        this.myOrganizationSkipped = true;
        console.log('Skipping My Organization flow because --skip-my-organization was provided.');
      } else {
        await this.runMyOrganizationFlow();
      }
    } catch (error) {
      if (!this.steps.some((step) => step.status === 'failed')) {
        const startedAt = new Date();
        const record = {
          stepNumber: ++this.stepCounter,
          id: `TC-${String(this.stepCounter).padStart(2, '0')}`,
          flowName: 'Application Bootstrap',
          pageName: 'Application',
          name: 'Open Construction Delivery application',
          status: 'failed',
          timestamp: startedAt.toISOString(),
          duration: 0,
          error: error.message
        };
        await this.captureFailureScreenshot(record).catch(() => null);
        this.steps.push(record);
      }
      throw error;
    } finally {
      this.endTime = new Date();
      await this.writeReport();
      await this.cleanup();
    }
  }

  getReportStatus() {
    const stepFailed = this.steps.some((step) => step.status === 'failed');
    const bookingTypeFailed = this.bookingTypeResults.some((result) => result.status === 'failed');
    const approvalFailed = this.approvalValidationResults.some((result) => result.status === 'failed');
    return stepFailed || bookingTypeFailed || approvalFailed ? 'failed' : 'passed';
  }

  getPageReports() {
    const pages = new Map();

    for (const step of this.steps) {
      const pageName = step.pageName || this.getPageName(step.flowName);
      if (!pages.has(pageName)) {
        pages.set(pageName, {
          pageName,
          status: 'passed',
          total: 0,
          passed: 0,
          failed: 0,
          duration: 0,
          testCaseIds: [],
          failedTestCaseIds: []
        });
      }

      const pageReport = pages.get(pageName);
      pageReport.total += 1;
      pageReport.duration += Number(step.duration) || 0;
      pageReport.testCaseIds.push(step.id);
      if (step.status === 'failed') {
        pageReport.status = 'failed';
        pageReport.failed += 1;
        pageReport.failedTestCaseIds.push(step.id);
      } else if (step.status === 'passed') {
        pageReport.passed += 1;
      }
    }

    return Array.from(pages.values());
  }

  async writeReport() {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });

    const endTime = this.endTime || new Date();
    const status = this.getReportStatus();
    const matrixRows = [...this.bookingTypeResults, ...this.approvalValidationResults];
    const passed = this.steps.filter((step) => step.status === 'passed').length +
      matrixRows.filter((row) => row.status === 'passed').length;
    const failed = this.steps.filter((step) => step.status === 'failed').length +
      matrixRows.filter((row) => row.status === 'failed').length;
    const skipped = this.steps.filter((step) => step.status === 'skipped').length +
      matrixRows.filter((row) => row.status === 'skipped').length;
    const report = {
      startTime: this.startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: endTime.getTime() - this.startTime.getTime(),
      status,
      total: this.steps.length + matrixRows.length,
      passed,
      failed,
      skipped,
      pages: this.getPageReports(),
      failedTestCases: this.steps
        .filter((step) => step.status === 'failed')
        .map((step) => ({
          id: step.id,
          pageName: step.pageName,
          flowName: step.flowName,
          name: step.name,
          error: step.error,
          screenshot: step.screenshot || null
        })),
      bookingId: this.bookingId || null,
      bookingCreations: this.bookingCreations,
      bookingTypeAvailability: this.bookingTypeAvailability,
      bookingTypeResults: this.bookingTypeResults,
      approvalValidationResults: this.approvalValidationResults,
      inviteEmail: this.inviteEmail || null,
      createdUsers: this.createdUsers || [],
      userAccountsSource: this.userAccountsSource || null,
      userManagementSkipped: Boolean(this.userManagementSkipped),
      analyticsSkipped: Boolean(this.analyticsSkipped),
      equipmentManagementSkipped: Boolean(this.equipmentManagementSkipped),
      bookingFlowsSkipped: Boolean(this.bookingFlowsSkipped),
      filterSkipped: Boolean(this.filterSkipped),
      bookingListValidationSkipped: Boolean(this.bookingListValidationSkipped),
      calendarSkipped: Boolean(this.calendarSkipped),
      myAccountSkipped: Boolean(this.myAccountSkipped),
      notificationPreferencesSkipped: Boolean(this.notificationPreferencesSkipped),
      myOrganizationSkipped: Boolean(this.myOrganizationSkipped),
      filterResult: this.filterResult || null,
      bookingListFlow: this.bookingListFlow || null,
      calendarFlow: this.calendarFlow || null,
      analyticsFlow: this.analyticsFlow || null,
      equipmentManagementFlow: this.equipmentManagementFlow || null,
      myAccountFlow: this.myAccountFlow || null,
      notificationPreferencesFlow: this.notificationPreferencesFlow || null,
      myOrganizationFlow: this.myOrganizationFlow || null,
      workflow: this.options.bookingCreationOnly
        ? (this.options.approvalMatrix ? 'dynamic-booking-approval-matrix' : 'dynamic-booking-creation')
        : 'single-session-full-application',
      environmentName: process.env.ENVIRONMENT_NAME || 'Staging',
      baseUrl: this.options.baseUrl,
      appUrl: this.options.appUrl,
      browserMode: this.options.headless ? 'headless' : 'headed',
      viewport: this.viewport,
      actionGap: this.options.actionGap,
      highlightMs: this.options.highlightMs,
      tests: this.steps,
      timestamp: endTime.toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };

    const reportPath = path.join(RESULTS_DIR, `full-application-report-${formatTimestampForFile(endTime)}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    this.reportPath = reportPath;

    console.log('\nFull Application Automation Report');
    console.log(`Status: ${status.toUpperCase()}`);
    console.log(`Test Steps: ${this.steps.filter((step) => step.status === 'passed').length}/${this.steps.length} passed`);
    if (matrixRows.length) {
      console.log(`Matrix Rows: ${matrixRows.filter((row) => row.status === 'passed').length} passed, ${matrixRows.filter((row) => row.status === 'failed').length} failed, ${matrixRows.filter((row) => row.status === 'skipped').length} skipped`);
    }
    console.log(`Duration: ${Math.round(report.duration / 1000)}s`);
    console.log(`Report: ${path.relative(process.cwd(), reportPath)}`);
  }
}

async function main() {
  loadEnvironment();
  const options = parseArguments();
  const runner = new FullApplicationRunner(options);
  let runError = null;

  try {
    await runner.runAllFlows();
  } catch (error) {
    runError = error;
  }

  if (options.generateReport) {
    const reportArgs = ['generate-automation-report.js', '--latest-flow', 'full-application'];
    if (options.noOpen) reportArgs.push('--no-open');

    const result = spawnSync('node', reportArgs, {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });
    if (result.status !== 0) process.exitCode = result.status || 1;
  }

  if (runError) throw runError;
  if (runner.getReportStatus() !== 'passed') process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`\nFull application automation failed: ${error.message}`);
    process.exit(1);
  });
}
