#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { UserManagementPage } = require('../pages/user-management.page');
const { DashboardPage } = require('../pages/dashboard.page');

const AUTH_STATE_PATH = path.resolve('auth.json');
const USER_MANAGEMENT_SEQUENCE_PATH = path.resolve('config', 'user-management-sequence.json');

function getArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

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

function createGeneratedUserAccountsFile() {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
  const outputDir = path.resolve('test-results', 'user-management-inputs');
  fs.mkdirSync(outputDir, { recursive: true });

  const roles = String(process.env.USER_INVITE_ROLES || 'Project Admin,Project Manager,View Only User')
    .split(',')
    .map((role) => role.trim())
    .filter(Boolean);
  const organization = process.env.USER_INVITE_ORGANIZATION || 'Neuralrays';
  const changeOrganization = process.env.USER_CHANGE_ORGANIZATION || process.env.CHANGE_ORGANIZATION || '';
  const password = process.env.NEW_USER_PASSWORD || 'Master@15';
  const startIndex = reserveGeneratedUserIndexes(3);
  const users = [
    {
      name: 'Voyagecontrol Validator 1',
      email: `User${startIndex}@yopmail.com`,
      mobile: '9988776655',
      address: 'First Main Road',
      organization,
      role: roles[0] || 'Project Admin',
      password,
      changeOrganization
    },
    {
      name: 'Voyagecontrol Validator 2',
      email: `User${startIndex + 1}@yopmail.com`,
      mobile: '9988776656',
      address: 'First Main Road',
      organization,
      role: roles[1] || roles[0] || 'Project Manager',
      password,
      changeOrganization
    },
    {
      name: 'Voyagecontrol Validator 3',
      email: `User${startIndex + 2}@yopmail.com`,
      mobile: '9988776657',
      address: 'First Main Road',
      organization,
      role: roles[2] || 'View Only User',
      password,
      changeOrganization
    }
  ];

  const csvEscape = (value) => `"${String(value || '').replace(/"/g, '""')}"`;
  const header = ['name', 'email', 'mobile', 'address', 'organization', 'role', 'password', 'new organization'];
  const rows = users.map((user) => [
    user.name,
    user.email,
    user.mobile,
    user.address,
    user.organization,
    user.role,
    user.password,
    user.changeOrganization
  ].map(csvEscape).join(','));

  const filePath = path.join(outputDir, `generated-user-management-users-${timestamp}-user${startIndex}-user${startIndex + 2}.csv`);
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

async function ensureUserManagementOpen(page, userManagement, appUrl, projectId) {
  const userManagementUrl = `${appUrl.replace(/\/$/, '')}/${projectId}/dashboard/manage-user`;
  const dashboard = new DashboardPage(page);

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await page.goto(`${appUrl.replace(/\/$/, '')}/${projectId}/dashboard/manage-user`, {
      waitUntil: 'domcontentloaded'
    }).catch(() => null);

    await loginIfNeeded(page);
    if (await dashboard.openPlatformIfChooser()) {
      await page.waitForTimeout(2000);
    }
    await selectProjectIfNeeded(page);

    if (await page.getByRole('button', { name: /Invite Users/i }).isVisible({ timeout: 5000 }).catch(() => false)) {
      return;
    }

    const userManagementLink = page.getByRole('link', { name: /user_management User|User Management/i }).first();
    if (await userManagementLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await userManagement.navigateToUserManagement();
      return;
    }

    if (!page.url().startsWith(userManagementUrl)) {
      await page.goto(userManagementUrl, { waitUntil: 'domcontentloaded' }).catch(() => null);
    }

    await page.waitForTimeout(2500);
  }

  throw new Error(`Could not open User Management. Current URL: ${page.url()}`);
}

async function loginIfNeeded(page, credentials = {}) {
  const emailField = await firstVisibleLocator(page, [
    page.getByRole('textbox', { name: /Email/i }).first(),
    page.locator('input[type="email"]').first(),
    page.locator('input[name*="email" i], input[id*="email" i], input[placeholder*="email" i]').first(),
    page.locator('input[type="text"]').first()
  ], 15000);

  if (!emailField) {
    return;
  }

  const passwordField = await firstVisibleLocator(page, [
    page.getByRole('textbox', { name: /Password/i }).first(),
    page.locator('input[type="password"]').first(),
    page.locator('input[name*="password" i], input[id*="password" i], input[placeholder*="password" i]').first()
  ], 5000);

  if (!passwordField) {
    throw new Error('Login page is visible but the password field was not found.');
  }

  const email = credentials.email || process.env.VC_EMAIL || 'hariharan.r@neuralrays.ai';
  const password = credentials.password || process.env.VC_PASSWORD || 'Master@15';

  await emailField.fill(email);
  await passwordField.fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click()
    .catch(async () => page.locator('button:has-text("Login"), input[type="submit"]').first().click());
  await page.waitForLoadState('domcontentloaded').catch(() => null);
  await page.waitForTimeout(2000);

  if (await emailField.isVisible({ timeout: 3000 }).catch(() => false)) {
    throw new Error(`Login did not complete for ${email}; check credentials.`);
  }
}

async function loginAsNewUserAndOpenUserManagement(browser, user, appUrl, projectId) {
  const context = await browser.newContext({
    viewport: null,
    ignoreHTTPSErrors: true
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);

  const userManagement = new UserManagementPage(page, {
    strictUserListValidation: true,
    userAccountsFile: process.env.USER_ACCOUNTS_FILE
  });

  await page.goto(`${appUrl.replace(/\/$/, '')}/${projectId}/dashboard/manage-user`, {
    waitUntil: 'domcontentloaded'
  }).catch(() => null);
  await loginIfNeeded(page, {
    email: user.email,
    password: user.password || process.env.NEW_USER_PASSWORD || 'Master@15'
  });
  await selectProjectIfNeeded(page);
  await ensureUserManagementOpen(page, userManagement, appUrl, projectId);

  return { context, page, userManagement };
}

async function firstVisibleLocator(page, locators, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const locator of locators) {
      if (await locator.isVisible({ timeout: 500 }).catch(() => false)) {
        return locator;
      }
    }
    await page.waitForTimeout(500);
  }
  return null;
}

async function selectProjectIfNeeded(page) {
  if (!/project\/choose/i.test(page.url())) {
    return;
  }

  const dashboard = new DashboardPage(page);
  if (await dashboard.clickLocationProjectCard('Buckingham Palace').catch(() => false)) {
    await page.waitForLoadState('domcontentloaded').catch(() => null);
    await page.waitForTimeout(2000);
    return;
  }

  const projectChoice = page.locator('#project-item-1').first()
    .or(page.locator('[id^="project-item-"]').first())
    .or(page.getByText(/Buckingham Palace|V3 Construction deliveries/i).first());

  if (await projectChoice.isVisible({ timeout: 15000 }).catch(() => false)) {
    await projectChoice.click();
    await page.waitForLoadState('domcontentloaded').catch(() => null);
    await page.waitForTimeout(2000);
  }
}

async function runExistingInviteAndResend(userManagement) {
  const inviteEmail = userManagement.getInviteEmail();
  console.log(`Running existing User Management invite/resend scenario for ${inviteEmail}`);

  const inviteModal = await userManagement.openInviteUsersModal();
  await inviteModal.locator('#email').fill(inviteEmail);
  await userManagement.selectMuiComboboxOption('Organization', userManagement.options.organization);
  await userManagement.selectMuiComboboxOption('Role', userManagement.options.role);
  await userManagement.clickSendInvites(inviteModal);
  await userManagement.waitForInviteSuccessNotification();

  const invitedUserRow = await userManagement.verifyInvitedUserVisibleInList(inviteEmail);
  await userManagement.resendInviteForMatchedUser(invitedUserRow, inviteEmail);
  return inviteEmail;
}

async function main() {
  loadEnvironment();

  const appUrl = process.env.APP_URL || 'https://stg-app.voyagecontrol.com';
  const projectId = process.env.PROJECT_ID || '5ET10000010';
  const usersFile = getArg('users-file', process.env.USER_ACCOUNTS_FILE) || createGeneratedUserAccountsFile();
  process.env.USER_ACCOUNTS_FILE = usersFile;
  console.log(`Using User Management account file: ${path.resolve(usersFile)}`);

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: hasFlag('headless'),
    slowMo: Number(process.env.SLOW_MO || 150),
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: null,
    ignoreHTTPSErrors: true,
    storageState: process.env.USE_AUTH_STATE === '1' && fs.existsSync(AUTH_STATE_PATH) ? AUTH_STATE_PATH : undefined
  });

  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);

  const userManagement = new UserManagementPage(page, {
    userAccountsFile: usersFile,
    strictUserListValidation: false
  });
  const accountUsers = userManagement.getUserAccountsFromFile();

  try {
    await ensureUserManagementOpen(page, userManagement, appUrl, projectId);
    await page.goto(`${appUrl.replace(/\/$/, '')}/${projectId}/dashboard/manage-user`, {
      waitUntil: 'domcontentloaded'
    });
    await ensureUserManagementOpen(page, userManagement, appUrl, projectId);
    await userManagement.inviteAdditionalNamedUsers(accountUsers);

    const setupReadyUsers = accountUsers.filter((user) => !user.setupMissingFields?.length);
    const setupSkippedUsers = accountUsers.filter((user) => user.setupMissingFields?.length);

    for (const user of setupReadyUsers) {
      await userManagement.acceptInvitationAndCompleteAccountSetup(user);
    }

    if (setupReadyUsers.length) {
      try {
        const changedOrganization = await userManagement.changeOrganizationForUser(setupReadyUsers[0]);
        setupReadyUsers[0].updatedOrganization = changedOrganization;
      } catch (error) {
        const message =
          `Change Organization was not completed for ${setupReadyUsers[0].email}: ${error.message}`;

        if (process.env.REQUIRE_CHANGE_ORGANIZATION === '1') {
          throw new Error(message);
        }

        console.log(`${message}. Continuing because REQUIRE_CHANGE_ORGANIZATION is not set.`);
      }
    }

    if (setupSkippedUsers.length) {
      console.log(
        `Skipped account setup for ${setupSkippedUsers.length} Excel user(s) because setup fields are missing: ` +
        setupSkippedUsers.map((user) => `${user.email} (${user.setupMissingFields.join(', ')})`).join('; ')
      );
    }

    console.log('\nUser Management flow completed.');
    console.log(`Created users: ${accountUsers.map((user) => `${user.name} <${user.email}>`).join(', ')}`);
    await context.storageState({ path: AUTH_STATE_PATH }).catch(() => null);
  } finally {
    if (process.env.KEEP_BROWSER_OPEN === '1') {
      console.log('KEEP_BROWSER_OPEN=1 set, leaving Chrome open for inspection.');
    } else {
      await browser.close().catch(() => null);
    }
  }
}

main().catch((error) => {
  console.error(`\nUser Management flow failed: ${error.message}`);
  process.exit(1);
});
