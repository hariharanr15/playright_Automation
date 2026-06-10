#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { chromium } = require('playwright');
const { DashboardPage } = require('./pages/dashboard.page');
const { DeliveryBookingPage } = require('./pages/booking/delivery.booking.page');
const { ResourceBookingPage } = require('./pages/booking/resource.booking.page');
const { ImprovedRecurringBookingPage } = require('./pages/booking/improved.recurring.booking.page');
const { EditBookingPage } = require('./pages/booking/edit.booking.page');
const { Filter } = require('./pages/booking/Filter');
const { UserManagementPage } = require('./pages/user-management.page');
const { ScreenDetector } = require('./utils/screen-detector');
const { clickHighlighted, fillHighlighted } = require('./utils/highlight');

const RESULTS_DIR = path.resolve('test-results');
const AUTH_STATE_PATH = path.resolve('auth.json');
const USER_MANAGEMENT_SEQUENCE_PATH = path.resolve('config', 'user-management-sequence.json');
const DEFAULT_LOGIN_EMAIL = 'hariharan.r@neuralrays.ai';
const DEFAULT_LOGIN_PASSWORD = 'Master@15';

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
      `User${userIndex}@yopmail.com`,
      String(9988776654 + userNumber),
      'First Main Road',
      organization,
      roles[index] || roles[0] || 'Project Admin',
      password,
      changeOrganization
    ].map(csvEscape).join(',');
  });

  const filePath = path.join(outputDir, `generated-user-management-users-${timestamp}-user${startIndex}-user${startIndex + userCount - 1}.csv`);
  fs.writeFileSync(filePath, `${header.join(',')}\n${rows.join('\n')}\n`, 'utf8');
  return filePath;
}

function loadEnvironment() {
  const envPath = path.resolve('.env');
  if (!fs.existsSync(envPath)) return;

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

function authStateMatchesEmail(authStatePath, email) {
  if (!email || !fs.existsSync(authStatePath)) return false;

  return fs.readFileSync(authStatePath, 'utf8').includes(email);
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
  const slowMo = slowMoIndex !== -1 ? Number(args[slowMoIndex + 1]) : args.includes('--slow') ? 1000 : 150;
  const actionGap = gapIndex !== -1 ? Number(args[gapIndex + 1]) : args.includes('--fast') ? 900 : 1500;
  const highlightMs = highlightIndex !== -1 ? Number(args[highlightIndex + 1]) : args.includes('--fast') ? 800 : 1200;
  const generatedUsers = Number(getArgValue('generated-users') || process.env.GENERATED_USER_COUNT || 3);

  return {
    headless: args.includes('--headless'),
    freshAuth: args.includes('--fresh-auth'),
    skipLogin: args.includes('--skip-login'),
    continueOnFailure: args.includes('--continue-on-failure'),
    generateReport: !args.includes('--no-report'),
    noOpen: args.includes('--no-open'),
    skipUserManagement: args.includes('--skip-user-management'),
    slowMo: Number.isFinite(slowMo) ? slowMo : 150,
    actionGap: Number.isFinite(actionGap) ? actionGap : 900,
    highlightMs: Number.isFinite(highlightMs) ? highlightMs : 800,
    baseUrl: process.env.BASE_URL || 'https://stg-login.voyagecontrol.com',
    appUrl: process.env.APP_URL || 'https://stg-app.voyagecontrol.com',
    projectId: process.env.PROJECT_ID || '5ET10000010',
    email: process.env.VC_EMAIL || DEFAULT_LOGIN_EMAIL,
    password: process.env.VC_PASSWORD || DEFAULT_LOGIN_PASSWORD,
    userAccountsFile: getArgValue('users-file') || getArgValue('user-accounts-file') || process.env.USER_ACCOUNTS_FILE || '',
    generatedUsers: Number.isFinite(generatedUsers) && generatedUsers > 0 ? Math.floor(generatedUsers) : 3
  };
}

function formatTimestampForFile(value = new Date()) {
  return value.toISOString().replace(/[:.]/g, '-');
}

class FullApplicationRunner {
  constructor(options) {
    this.options = options;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.viewport = null;
    this.steps = [];
    this.stepCounter = 0;
    this.startTime = null;
    this.endTime = null;
  }

  async setupBrowser() {
    process.env.HIGHLIGHT_MS = String(this.options.highlightMs);

    const screenDetector = new ScreenDetector();
    await screenDetector.detectScreenResolution();
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
        : undefined
    });

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(60000);
    this.page.setDefaultNavigationTimeout(60000);

    this.page.on('pageerror', (error) => console.log(`Page error: ${error.message}`));
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') console.log(`Console error: ${msg.text()}`);
    });
    this.page.on('requestfailed', (request) => {
      console.log(`Request failed: ${request.method()} ${request.url()}`);
    });

    await this.maximizeWindow();
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
      await this.context.storageState({ path: AUTH_STATE_PATH }).catch(() => null);
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

  async fillLoginFormIfVisible(timeout = 8000) {
    const emailField = this.page.locator([
      'input[type="email"]',
      'input[name*="email" i]',
      'input[id*="email" i]',
      'input[placeholder*="email" i]',
      'input[type="text"]'
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
      'input[placeholder*="email" i]',
      'input[type="text"]'
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
    if (!/\/booking\b/i.test(this.page.url())) return false;

    const newBookingButton = this.page.getByRole('button', { name: /New Booking/i }).first();
    const visible = await newBookingButton.isVisible({ timeout }).catch(() => false);
    if (!visible) return false;
    return await newBookingButton.isEnabled({ timeout: 500 }).catch(() => false);
  }

  async openBookingList() {
    if (!(await this.isNewBookingButtonReady(1500))) {
      await this.gotoProjectPath('/booking');
    }

    const dashboard = new DashboardPage(this.page);
    for (let attempt = 1; attempt <= 30; attempt += 1) {
      if (await this.isNewBookingButtonReady(3000)) return;

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

      if (attempt % 5 === 0) {
        console.log(`Booking List is not ready yet; reopening through project chooser attempt ${attempt}.`);
        await this.page.goto(`${this.options.appUrl.replace(/\/$/, '')}/project/choose`, { waitUntil: 'domcontentloaded' }).catch(() => null);
        await this.page.waitForTimeout(1500);
        if (await dashboard.clickLocationProjectCard('Buckingham Palace').catch(() => false)) {
          await dashboard.goToBookings().catch(() => null);
        } else {
          await this.gotoProjectPath('/booking');
        }
        continue;
      }

      await this.page.waitForLoadState('domcontentloaded').catch(() => null);
      await this.page.waitForTimeout(1000);
    }

    if (!(await this.isNewBookingButtonReady(10000))) {
      const pageState = await this.getPageState();
      throw new Error(`Booking List did not become ready. URL: ${pageState.url}. Page text: ${pageState.text || '-'}`);
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

  async runStep(flowName, stepName, action) {
    const stepNumber = this.stepCounter + 1;
    const startedAt = new Date();
    const record = {
      stepNumber,
      id: `TC-${String(stepNumber).padStart(2, '0')}`,
      flowName,
      name: stepName,
      status: 'running',
      timestamp: startedAt.toISOString(),
      duration: 0,
      error: null
    };

    this.stepCounter = stepNumber;
    this.steps.push(record);
    console.log(`\n${record.id} [${flowName}] ${stepName}`);

    try {
      await action();
      record.status = 'passed';
      console.log(`${record.id} passed`);
    } catch (error) {
      record.status = 'failed';
      record.error = error.message;
      console.log(`${record.id} failed: ${error.message}`);
      await this.captureFailureScreenshot(record);
      if (!this.options.continueOnFailure) throw error;
    } finally {
      record.duration = Date.now() - startedAt.getTime();
      await this.page.waitForTimeout(this.options.actionGap).catch(() => null);
    }
  }

  async captureFailureScreenshot(record) {
    const screenshotsDir = path.resolve('screenshots');
    fs.mkdirSync(screenshotsDir, { recursive: true });
    const screenshotPath = path.join(screenshotsDir, `full_app_${record.id}_${formatTimestampForFile()}.png`);
    await this.page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => null);
    record.screenshot = path.relative(process.cwd(), screenshotPath);
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
      await booking.selectFirstDropdownValue(booking.resourceSelect, 'Resource', {
        optional: true,
        closeAfterSelect: true
      });
    });
    await this.runStep(flowName, 'Continue from Scheduling Information', async () => {
      await booking.clickNext('Scheduling next');
    });
  }

  async runDeliveryDateSteps(flowName, booking) {
    await this.runStep(flowName, 'Open Booking Date calendar', async () => {
      await booking.waitForStep('Booking Date');
      await booking.openCalendar();
    });
    await this.runStep(flowName, 'Select first available booking date', async () => {
      await booking.clickFirstAvailableCalendarDate();
    });
    await this.runStep(flowName, 'Continue from Booking Date', async () => {
      await booking.clickNext('Booking date next');
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
    await this.runStep(flowName, 'Submit delivery booking', async () => deliveryBooking.submitBooking());
  }

  async runRecurringFlow() {
    const flowName = 'Recurring Booking';
    const recurringBooking = new ImprovedRecurringBookingPage(this.page);
    await this.runStep(flowName, 'Open authenticated Booking List', async () => this.openBookingList());
    await this.runStep(flowName, 'Start a new booking', async () => recurringBooking.startNewBooking());
    await this.runStep(flowName, 'Select Recurring booking type', async () => recurringBooking.selectRecurringBookingType());
    await this.runRecurringSchedulingSteps(flowName, recurringBooking);
    await this.runRecurringDateSteps(flowName, recurringBooking);
    await this.runRecurringDaysSteps(flowName, recurringBooking);
    await this.runStep(flowName, 'Select first available recurring time', async () => recurringBooking.selectFirstAvailableBookingTime());
    await this.runRecurringBookingDetailsSteps(flowName, recurringBooking);
    await this.runStep(flowName, 'Complete mandatory additional details', async () => recurringBooking.completeMandatoryAdditionalDetails());
    await this.runStep(flowName, 'Submit recurring booking', async () => recurringBooking.submitBooking());
  }

  async runMultiVehicleFlow() {
    const flowName = 'Multi-Vehicle Booking';
    const multiVehicleBooking = new DeliveryBookingPage(this.page, {
      bookingTypeIndex: 2,
      bookingTypeLabel: 'Multi-Vehicle'
    });
    await this.runStep(flowName, 'Open authenticated Booking List', async () => this.openBookingList());
    await this.runStep(flowName, 'Start a new booking', async () => multiVehicleBooking.startNewBooking());
    await this.runStep(flowName, 'Select Multi-Vehicle booking type', async () => multiVehicleBooking.selectBookingType());
    await this.runDeliverySchedulingSteps(flowName, multiVehicleBooking);
    await this.runDeliveryDateSteps(flowName, multiVehicleBooking);
    await this.runDeliveryTimeSteps(flowName, multiVehicleBooking);
    await this.runDeliveryBookingDetailsSteps(flowName, multiVehicleBooking);
    await this.runStep(flowName, 'Complete mandatory additional details', async () => multiVehicleBooking.completeMandatoryAdditionalDetails());
    await this.runStep(flowName, 'Submit multi-vehicle booking', async () => multiVehicleBooking.submitBooking());
  }

  async runResourceFlow() {
    const flowName = 'Resource-only Booking';
    const resourceBooking = new ResourceBookingPage(this.page);
    await this.runStep(flowName, 'Open authenticated Booking List', async () => this.openBookingList());
    await this.runStep(flowName, 'Start a new booking', async () => resourceBooking.startNewBooking());
    await this.runStep(flowName, 'Select Resource Only booking type', async () => resourceBooking.selectResourceBookingType());
    await this.runStep(flowName, 'Select resources', async () => resourceBooking.selectResources());
    await this.runStep(flowName, 'Select first available booking date', async () => resourceBooking.selectFirstAvailableBookingDate());
    await this.runStep(flowName, 'Select first available booking time', async () => resourceBooking.selectFirstAvailableBookingTime());
    await this.runStep(flowName, 'Complete booking details', async () => resourceBooking.completeBookingDetails());
    await this.runStep(flowName, 'Submit resource booking', async () => resourceBooking.submitBooking());
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

  async runUserManagementFlow() {
    const flowName = 'User Management';
    const userManagement = new UserManagementPage(this.page, {
      userAccountsFile: this.options.userAccountsFile,
      strictUserListValidation: false
    });
    const accountUsers = this.getUserManagementAccounts(userManagement);

    await this.runStep(flowName, 'Open authenticated User Management page', async () => this.openUserManagement());
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
        await userManagement.acceptInvitationAndCompleteAccountSetup(user);
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
    if (this.options.userAccountsFile) {
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
      await this.runDeliveryFlow();
      await this.runRecurringFlow();
      await this.runMultiVehicleFlow();
      await this.runResourceFlow();
      await this.runEditBookingFlow();
      await this.runFilterFlow();
      if (this.options.skipUserManagement) {
        this.userManagementSkipped = true;
        console.log('Skipping User Management flow because --skip-user-management was provided.');
      } else {
        await this.runUserManagementFlow();
      }
    } finally {
      this.endTime = new Date();
      await this.writeReport();
      await this.cleanup();
    }
  }

  getReportStatus() {
    return this.steps.some((step) => step.status === 'failed') ? 'failed' : 'passed';
  }

  async writeReport() {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });

    const endTime = this.endTime || new Date();
    const status = this.getReportStatus();
    const passed = this.steps.filter((step) => step.status === 'passed').length;
    const failed = this.steps.filter((step) => step.status === 'failed').length;
    const report = {
      startTime: this.startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: endTime.getTime() - this.startTime.getTime(),
      status,
      total: this.steps.length,
      passed,
      failed,
      bookingId: this.bookingId || null,
      inviteEmail: this.inviteEmail || null,
      createdUsers: this.createdUsers || [],
      userAccountsSource: this.userAccountsSource || null,
      userManagementSkipped: Boolean(this.userManagementSkipped),
      filterResult: this.filterResult || null,
      workflow: 'single-session-full-application',
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
    console.log(`Test Steps: ${passed}/${this.steps.length} passed`);
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
