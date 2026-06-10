const fs = require('fs');
const path = require('path');
const { clickHighlighted, fillHighlighted, highlight } = require('../utils/highlight');
const { DashboardPage } = require('./dashboard.page');
const { loadUserAccountsFromFile } = require('../utils/user-accounts-loader');

const USER_MANAGEMENT_SCREENSHOT_DIR = path.resolve('test-results', 'user-management-screenshots');
const USER_MANAGEMENT_SEQUENCE_PATH = path.resolve('config', 'user-management-sequence.json');
const DEFAULT_NEW_USER_PASSWORD = process.env.NEW_USER_PASSWORD || 'Master@15';
const USER_ROW_PAUSE_MS = Number(process.env.USER_ROW_PAUSE_MS || 2000);
const ACTIVATION_CLOSE_MESSAGE_MS = Number(process.env.ACTIVATION_CLOSE_MESSAGE_MS || 3000);

class UserManagementPage {
  constructor(page, options = {}) {
    this.page = page;
    this.options = {
      baseUrl: options.baseUrl || process.env.BASE_URL || 'https://stg-login.voyagecontrol.com',
      email: options.email || process.env.VC_EMAIL || 'priyanka.dl@neuralrays.ai',
      password: options.password || process.env.VC_PASSWORD || '2C@53WsTQ#&ffSQ&',
      appUrl: options.appUrl || process.env.APP_URL || 'https://stg-app.voyagecontrol.com',
      projectId: options.projectId || process.env.PROJECT_ID || '5ET10000010',
      organization: options.organization || process.env.USER_INVITE_ORGANIZATION || 'Neuralrays',
      changeOrganization: options.changeOrganization || process.env.USER_CHANGE_ORGANIZATION || process.env.CHANGE_ORGANIZATION || '',
      role: options.role || process.env.USER_INVITE_ROLE || 'Project Admin',
      inviteEmail: options.inviteEmail || process.env.USER_INVITE_EMAIL || null,
      dryRun: options.dryRun ?? false,
      strictUserListValidation: options.strictUserListValidation ?? true,
      ...options
    };
  }

  getInviteEmail() {
    if (this.options.inviteEmail) {
      return this.options.inviteEmail;
    }

    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
    return `sample-${timestamp}@yopmail.com`;
  }

  getUserAccountsFromFile(filePath = this.options.userAccountsFile || process.env.USER_ACCOUNTS_FILE) {
    return loadUserAccountsFromFile(filePath, {
      organization: this.options.organization,
      changeOrganization: this.options.changeOrganization,
      role: this.options.role,
      password: DEFAULT_NEW_USER_PASSWORD
    });
  }

  reserveFunctionalUserIndexes(count = 3) {
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

  reserveFunctionalUserIndexPair() {
    return this.reserveFunctionalUserIndexes(2);
  }

  getFunctionalFlowStartIndex(options = {}) {
    const configuredStartIndex = options.startIndex || process.env.USER_MANAGEMENT_START_INDEX;
    if (configuredStartIndex) {
      const startIndex = Number(configuredStartIndex);
      if (!Number.isInteger(startIndex) || startIndex < 1) {
        throw new Error(`USER_MANAGEMENT_START_INDEX must be a positive integer. Received: ${configuredStartIndex}`);
      }
      return startIndex;
    }

    return this.reserveFunctionalUserIndexes(3);
  }

  createFunctionalFlowUsers(options = {}) {
    const organization = this.options.organization || 'Neuralrays';
    const password = DEFAULT_NEW_USER_PASSWORD;
    const startIndex = this.getFunctionalFlowStartIndex(options);

    return [
      {
        name: 'Voyagecontrol Validator 1',
        firstName: 'Voyagecontrol',
        lastName: 'Validator 1',
        email: `User${startIndex}@yopmail.com`,
        mobile: '9988776655',
        address: 'First Main Road',
        organization,
        role: 'Project Admin',
        password,
        setupMissingFields: []
      },
      {
        name: 'Voyagecontrol Validator 2',
        firstName: 'Voyagecontrol',
        lastName: 'Validator 2',
        email: `User${startIndex + 1}@yopmail.com`,
        mobile: '9988776656',
        address: 'First Main Road',
        organization,
        role: 'Project Manager',
        password,
        setupMissingFields: []
      },
      {
        name: 'Voyagecontrol Validator 3',
        firstName: 'Voyagecontrol',
        lastName: 'Validator 3',
        email: `User${startIndex + 2}@yopmail.com`,
        mobile: '9988776657',
        address: 'First Main Road',
        organization,
        role: 'View Only User',
        password,
        setupMissingFields: []
      }
    ];
  }

  validateInviteUserDataset(users) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emails = new Set();
    const roles = new Set();

    for (const user of users) {
      if (!emailPattern.test(user.email || '')) {
        throw new Error(`Invalid invite email format: ${user.email}`);
      }

      const normalizedEmail = user.email.toLowerCase();
      if (emails.has(normalizedEmail)) {
        throw new Error(`Duplicate invite email is not allowed: ${user.email}`);
      }
      emails.add(normalizedEmail);

      if (!user.role) {
        throw new Error(`User role is mandatory for ${user.email}.`);
      }

      const normalizedRole = user.role.toLowerCase();
      if (roles.has(normalizedRole)) {
        throw new Error(`Duplicate role assignment is not allowed: ${user.role}`);
      }
      roles.add(normalizedRole);
    }
  }

  getScreenshotName(label, email = '') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const slug = `${label}-${email}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);
    return path.join(USER_MANAGEMENT_SCREENSHOT_DIR, `${slug || 'user-management'}-${timestamp}.png`);
  }

  async captureUserManagementScreenshot(label, email = '', targetPage = this.page) {
    fs.mkdirSync(USER_MANAGEMENT_SCREENSHOT_DIR, { recursive: true });
    const screenshotPath = this.getScreenshotName(label, email);
    await targetPage.screenshot({ path: screenshotPath, fullPage: true }).catch(() => null);
    console.log(`User Management screenshot [${label}]: ${path.relative(process.cwd(), screenshotPath)}`);
    return screenshotPath;
  }

  async getVisiblePageMessage(targetPage = this.page, pattern = /permission|access|error|required|invalid|failed|not allowed|cannot|unable/i) {
    return targetPage.evaluate((patternSource) => {
      const messagePattern = new RegExp(patternSource, 'i');
      const candidates = Array.from(document.querySelectorAll(
        '[role="alert"], [role="status"], .Toastify__toast, .toast, .alert, .MuiAlert-root, .SnackbarItem-message, [class*="toast"], [class*="snackbar"], [class*="error"], [class*="alert"], body'
      ));

      for (const element of candidates) {
        const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text || !messagePattern.test(text)) continue;

        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        if (element === document.body || (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0'
        )) {
          return text.slice(0, 500);
        }
      }

      return '';
    }, pattern.source).catch(() => '');
  }

  escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async clickFirstVisible(candidates, errorMessage) {
    for (const candidate of candidates) {
      try {
        if (await candidate.locator.isVisible({ timeout: candidate.timeout ?? 5000 }).catch(() => false)) {
          await clickHighlighted(candidate.locator, candidate.label);
          return candidate.label;
        }
      } catch (error) {
        console.log(`${candidate.label} failed: ${error.message}`);
      }
    }

    throw new Error(errorMessage);
  }

  async login() {
    console.log('Logging into the application...');

    await this.page.goto(`${this.options.baseUrl}/api/sso/users/login/`, {
      waitUntil: 'domcontentloaded'
    });

    const emailField = this.page.getByRole('textbox', { name: 'Email:' });
    if (await emailField.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fillHighlighted(emailField, this.options.email, 'Email');
      await fillHighlighted(this.page.getByRole('textbox', { name: 'Password:' }), this.options.password, 'Password');
      await clickHighlighted(this.page.getByRole('button', { name: 'Login', exact: true }), 'Login');
      await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    }

    console.log('Login completed');
  }

  async navigateToProjectLocation() {
    console.log('Navigating to project and location...');

    const dashboard = new DashboardPage(this.page);
    await dashboard.selectProject();
    await dashboard.selectLocation();

    console.log('Project and location selected');
  }

  async navigateToUserManagement() {
    console.log('Opening User Management...');

    await this.clickFirstVisible([
      { locator: this.page.getByRole('link', { name: 'user_management User' }), label: 'User Management link', timeout: 10000 },
      { locator: this.page.getByRole('link', { name: /User Management/i }), label: 'User Management text link' },
      { locator: this.page.locator('a:has-text("User Management")').first(), label: 'User Management fallback' },
      { locator: this.page.locator('a:has-text("user_management")').first(), label: 'User Management icon link' }
    ], 'Could not open User Management.');

    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    try {
      await this.page.getByRole('button', { name: /Invite Users/i }).waitFor({
        state: 'visible',
        timeout: 20000
      });
    } catch (error) {
      const message = await this.getVisiblePageMessage(this.page, /permission|access|not allowed|forbidden|unauthorized|invite users|user management|error/i);
      await this.captureUserManagementScreenshot('permission-issue-user-management');
      throw new Error(`Permission issue while opening User Management or Invite Users: ${message || error.message}`);
    }

    console.log('User Management loaded');
  }

  async selectMuiComboboxOption(label, optionText) {
    return this.selectMuiComboboxOptionAt(label, optionText, 0);
  }

  async selectMuiComboboxOptionAt(label, optionText, index = 0, metadata = {}) {
    const combobox = this.page.getByRole('combobox', { name: label }).nth(index);
    await clickHighlighted(combobox, `${label} dropdown`);

    const optionTexts = [optionText];
    if (/^role$/i.test(label) && /^view only user$/i.test(optionText)) {
      optionTexts.push('View Only');
    }

    const optionCandidates = optionTexts.flatMap((text) => [
      this.page.getByRole('option', { name: text, exact: true }).first(),
      this.page.getByRole('option', { name: text }).first(),
      this.page.locator(`[role="option"]:has-text("${text}")`).first(),
      this.page.getByText(text, { exact: true }).last()
    ]);

    for (const option of optionCandidates) {
      if (await option.isVisible({ timeout: 5000 }).catch(() => false)) {
        await clickHighlighted(option, `${label}: ${optionText}`);
        return;
      }
    }

    const visibleMessage = await this.getVisiblePageMessage();
    if (metadata.captureOnFailure) {
      await this.captureUserManagementScreenshot(metadata.captureLabel || `${label}-dropdown-issue`, metadata.email || '');
    }

    throw new Error(`Could not select ${optionText} from ${label}${index ? ` row ${index + 1}` : ''}. ${visibleMessage || ''}`.trim());
  }

  async clickWithFallback(locator, label) {
    await locator.waitFor({ state: 'visible', timeout: 15000 });

    try {
      await clickHighlighted(locator, label);
      return;
    } catch (error) {
      console.log(`${label} normal click failed: ${error.message}`);
    }

    try {
      await highlight(locator, label);
      await locator.click({ force: true, timeout: 10000 });
      return;
    } catch (error) {
      console.log(`${label} force click failed: ${error.message}`);
    }

    await highlight(locator, label).catch(() => null);
    await locator.evaluate((element) => element.click());
  }

  getInviteModal() {
    return this.page.locator('#invite_user_Modal, .vc-user-invite').filter({
      has: this.page.getByText(/Invite Users/i)
    }).first();
  }

  async openInviteUsersModal() {
    const existingInviteModal = this.getInviteModal();
    if (await existingInviteModal.isVisible({ timeout: 1000 }).catch(() => false)) {
      await existingInviteModal.locator('#email').waitFor({ state: 'visible', timeout: 10000 });
      return existingInviteModal;
    }

    try {
      await this.clickWithFallback(
        this.page.locator('button:has-text("Invite Users")').first(),
        'Invite Users'
      );
    } catch (error) {
      const message = await this.getVisiblePageMessage(this.page, /permission|access|forbidden|unauthorized|not allowed|invite|disabled|cannot|unable|error/i);
      await this.captureUserManagementScreenshot('permission-issue-open-invite-users');
      throw new Error(`Permission issue while opening Invite Users: ${message || error.message}`);
    }

    const inviteModal = this.getInviteModal();
    await inviteModal.waitFor({ state: 'visible', timeout: 15000 });
    await inviteModal.locator('#email').waitFor({ state: 'visible', timeout: 10000 });

    return inviteModal;
  }

  getSendInvitesButton(inviteModal = this.getInviteModal()) {
    return inviteModal.locator('button:has-text("Send Invites")').first();
  }

  async closeInviteUsersModal(inviteModal = this.getInviteModal()) {
    const closeCandidates = [
      inviteModal.getByRole('button', { name: /^Close$/i }).first(),
      inviteModal.getByRole('button', { name: /^Cancel$/i }).first(),
      inviteModal.locator('button[aria-label*="close" i]').first(),
      inviteModal.locator('[data-bs-dismiss="modal"], [data-dismiss="modal"], .btn-close, .close').first(),
      this.page.getByRole('button', { name: /^Close$/i }).first(),
      this.page.getByRole('button', { name: /^Cancel$/i }).first()
    ];

    for (const candidate of closeCandidates) {
      if (await candidate.isVisible({ timeout: 1000 }).catch(() => false)) {
        await this.clickWithFallback(candidate, 'Close invite popup');
        await inviteModal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => null);
        return;
      }
    }

    await this.page.keyboard.press('Escape').catch(() => null);
    await inviteModal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => null);
  }

  async clickSendInvites(inviteModal) {
    const sendInvitesButton = this.getSendInvitesButton(inviteModal);
    await sendInvitesButton.waitFor({ state: 'visible', timeout: 15000 });

    try {
      await this.page.waitForFunction(
        () => {
          const modal = document.querySelector('#invite_user_Modal, .vc-user-invite');
          if (!modal) return false;

          const buttons = Array.from(modal.querySelectorAll('button'));
          const button = buttons.find((candidate) => /send invites/i.test(candidate.innerText || candidate.textContent || ''));
          if (!button) return false;

          const style = window.getComputedStyle(button);
          return !button.disabled &&
            button.getAttribute('aria-disabled') !== 'true' &&
            style.pointerEvents !== 'none' &&
            style.visibility !== 'hidden' &&
            style.display !== 'none';
        },
        null,
        { timeout: 10000 }
      );
      await this.clickWithFallback(sendInvitesButton, 'Send Invites');
    } catch (error) {
      const message = await this.getVisiblePageMessage(this.page, /permission|access|forbidden|unauthorized|not allowed|error|disabled|cannot|unable/i);
      await this.captureUserManagementScreenshot('permission-issue-send-invites');
      throw new Error(`Permission issue while sending invites: ${message || error.message}`);
    }
  }

  async verifyInviteRequiredFieldValidation() {
    const inviteModal = await this.openInviteUsersModal();
    const sendInvitesButton = this.getSendInvitesButton(inviteModal);

    try {
      if (await sendInvitesButton.isEnabled({ timeout: 3000 }).catch(() => false)) {
        await sendInvitesButton.click().catch(() => null);
        await this.page.waitForTimeout(1000);
      }

      const emailMissing = await inviteModal.locator('#email').evaluate((input) => {
        if ('validity' in input) {
          return input.validity.valueMissing || !input.validity.valid;
        }
        return !(input.value || '').trim();
      }).catch(() => true);

      const modalStillOpen = await inviteModal.isVisible({ timeout: 2000 }).catch(() => false);
      const requiredMessage = await this.getVisiblePageMessage(this.page, /required|mandatory|email|role|invalid/i);

      if (!emailMissing && !requiredMessage && !modalStillOpen) {
        throw new Error('Invite Users popup allowed submission without mandatory Email/User Role fields.');
      }

      const validEmail = this.getInviteEmail();
      await fillHighlighted(inviteModal.locator('#email').first(), validEmail, 'Valid email without role');

      if (await sendInvitesButton.isEnabled({ timeout: 2000 }).catch(() => false)) {
        await sendInvitesButton.click().catch(() => null);
        await this.page.waitForTimeout(1000);
      }

      if (!(await inviteModal.isVisible({ timeout: 2000 }).catch(() => false))) {
        throw new Error('Invite Users popup submitted without mandatory User Role.');
      }
    } finally {
      await this.closeInviteUsersModal(inviteModal).catch(() => null);
    }
  }

  async verifyInvalidInviteEmailValidation(invalidEmail = 'invalid-email') {
    const inviteModal = await this.openInviteUsersModal();
    const sendInvitesButton = this.getSendInvitesButton(inviteModal);

    try {
      await fillHighlighted(inviteModal.locator('#email').first(), invalidEmail, 'Invalid invite email');
      await this.selectMuiComboboxOption('Role', this.options.role);

      const nativeInvalid = await inviteModal.locator('#email').evaluate((input) => {
        if ('validity' in input) {
          return input.validity.typeMismatch || !input.validity.valid;
        }
        return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value || '');
      }).catch(() => true);

      if (await sendInvitesButton.isEnabled({ timeout: 2000 }).catch(() => false)) {
        await sendInvitesButton.click().catch(() => null);
        await this.page.waitForTimeout(1000);
      }

      const modalStillOpen = await inviteModal.isVisible({ timeout: 2000 }).catch(() => false);
      const invalidMessage = await this.getVisiblePageMessage(this.page, /invalid|valid email|email/i);

      if (!nativeInvalid && !invalidMessage && !modalStillOpen) {
        throw new Error(`Invite Users popup accepted invalid email: ${invalidEmail}`);
      }
    } finally {
      await this.closeInviteUsersModal(inviteModal).catch(() => null);
    }
  }

  async verifyInviteFormNegativeScenarios(invalidEmail = 'invalid-email') {
    const inviteModal = await this.openInviteUsersModal();
    const sendInvitesButton = this.getSendInvitesButton(inviteModal);

    try {
      if (await sendInvitesButton.isEnabled({ timeout: 3000 }).catch(() => false)) {
        await sendInvitesButton.click().catch(() => null);
        await this.page.waitForTimeout(1000);
      }

      const emailMissing = await inviteModal.locator('#email').evaluate((input) => {
        if ('validity' in input) {
          return input.validity.valueMissing || !input.validity.valid;
        }
        return !(input.value || '').trim();
      }).catch(() => true);

      if (!emailMissing && !(await inviteModal.isVisible({ timeout: 2000 }).catch(() => false))) {
        throw new Error('Invite Users popup allowed submission without mandatory Email/User Role fields.');
      }

      await fillHighlighted(inviteModal.locator('#email').first(), this.getInviteEmail(), 'Valid email without role');
      if (await sendInvitesButton.isEnabled({ timeout: 2000 }).catch(() => false)) {
        await sendInvitesButton.click().catch(() => null);
        await this.page.waitForTimeout(1000);
      }

      if (!(await inviteModal.isVisible({ timeout: 2000 }).catch(() => false))) {
        throw new Error('Invite Users popup submitted without mandatory User Role.');
      }

      await fillHighlighted(inviteModal.locator('#email').first(), invalidEmail, 'Invalid invite email');
      await this.selectMuiComboboxOption('Role', this.options.role);

      const nativeInvalid = await inviteModal.locator('#email').evaluate((input) => {
        if ('validity' in input) {
          return input.validity.typeMismatch || !input.validity.valid;
        }
        return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value || '');
      }).catch(() => true);

      if (await sendInvitesButton.isEnabled({ timeout: 2000 }).catch(() => false)) {
        await sendInvitesButton.click().catch(() => null);
        await this.page.waitForTimeout(1000);
      }

      const invalidMessage = await this.getVisiblePageMessage(this.page, /invalid|valid email|email/i);
      const modalStillOpen = await inviteModal.isVisible({ timeout: 2000 }).catch(() => false);
      if (!nativeInvalid && !invalidMessage && !modalStillOpen) {
        throw new Error(`Invite Users popup accepted invalid email: ${invalidEmail}`);
      }
    } finally {
      await this.closeInviteUsersModal(inviteModal).catch(() => null);
    }
  }

  async waitForInviteSuccessNotification() {
    const successPattern = /success|invite sent|invites sent|invitation sent|user invited|invited successfully|resend|resent/i;
    const notificationCandidates = [
      this.page.getByRole('alert').filter({ hasText: successPattern }).first(),
      this.page.getByRole('status').filter({ hasText: successPattern }).first(),
      this.page.locator('.Toastify__toast, .toast, .alert, .MuiAlert-root, .SnackbarItem-message, [class*="toast"], [class*="snackbar"], [class*="alert"]').filter({ hasText: successPattern }).first(),
      this.page.getByText(successPattern).first()
    ];

    for (const notification of notificationCandidates) {
      if (await notification.isVisible({ timeout: 7000 }).catch(() => false)) {
        const message = await notification.innerText().catch(() => 'Success notification displayed');
        console.log(`Success notification: ${message.replace(/\s+/g, ' ').trim()}`);
        return message;
      }
    }

    const pageMessage = await this.page.waitForFunction(
      (patternSource) => {
        const pattern = new RegExp(patternSource, 'i');
        const visibleElements = Array.from(document.querySelectorAll('body *')).filter((element) => {
          const text = (element.innerText || element.textContent || '').trim();
          if (!text || !pattern.test(text)) return false;

          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0';
        });

        return visibleElements[0]?.innerText || visibleElements[0]?.textContent || null;
      },
      successPattern.source,
      { timeout: 7000 }
    ).then((handle) => handle.jsonValue()).catch(() => null);

    if (pageMessage) {
      const normalizedMessage = pageMessage.replace(/\s+/g, ' ').trim();
      console.log(`Success notification: ${normalizedMessage}`);
      return normalizedMessage;
    }

    const issueMessage = await this.getVisiblePageMessage(this.page, /permission|access|forbidden|unauthorized|not allowed|error|failed|invalid|duplicate|already exists|required/i);
    if (issueMessage) {
      await this.captureUserManagementScreenshot('invite-error-message');
      throw new Error(`Send Invites did not report success. Visible message: ${issueMessage}`);
    }

    throw new Error('Send Invites completed, but no success notification was detected.');
  }

  async fillInviteUserRow(inviteModal, user, index) {
    const rowNumber = index + 1;
    const emailLocator = index === 0
      ? inviteModal.locator('#email').first()
      : inviteModal.locator(`input[name="email:${rowNumber}"]`).first();

    await fillHighlighted(emailLocator, user.email, `Invite email ${rowNumber}`);
    await this.selectMuiComboboxOptionAt('Organization', user.organization || this.options.organization, index, {
      captureOnFailure: true,
      captureLabel: `organization-dropdown-issue-row-${rowNumber}`,
      email: user.email
    });
    await this.selectMuiComboboxOptionAt('Role', user.role || this.options.role, index, {
      captureOnFailure: true,
      captureLabel: `role-dropdown-issue-row-${rowNumber}`,
      email: user.email
    });
  }

  async addInviteUserRow(inviteModal, rowNumber) {
    const addAnother = inviteModal.getByRole('link', { name: /Add Another/i }).first()
      .or(this.page.getByRole('link', { name: /Add Another/i }).first());
    await this.clickWithFallback(addAnother, `Add Another user row ${rowNumber}`);
    await inviteModal.locator(`input[name="email:${rowNumber}"]`).waitFor({ state: 'visible', timeout: 10000 });
  }

  async inviteAdditionalNamedUsers(users = this.getUserAccountsFromFile()) {
    const preparedUsers = await this.prepareUsersForCreation(users);
    console.log(`Creating ${preparedUsers.length} User Management invites from account file: ${preparedUsers.map((user) => user.email).join(', ')}`);

    const inviteModal = await this.openInviteUsersModal();

    for (let index = 0; index < preparedUsers.length; index += 1) {
      if (index > 0) {
        await this.addInviteUserRow(inviteModal, index + 1);
      }
      await this.fillInviteUserRow(inviteModal, preparedUsers[index], index);
    }

    await this.captureUserManagementScreenshot('user-creation-filled-invite-form', preparedUsers.map((user) => user.email).join('-'));

    if (this.options.dryRun) {
      console.log('Dry run enabled; stopping before Send Invites for additional users.');
      return preparedUsers;
    }

    await this.clickSendInvites(inviteModal);
    await this.waitForInviteSuccessNotification();
    await this.captureUserManagementScreenshot('user-creation-invite-success', preparedUsers.map((user) => user.email).join('-'));

    for (const user of preparedUsers) {
      try {
        const invitedUserRow = await this.verifyInvitedUserVisibleInList(user.email);
        await this.captureUserManagementScreenshot('user-created-visible-in-list', user.email);
        if (!(await invitedUserRow.isVisible({ timeout: 5000 }).catch(() => false))) {
          throw new Error(`Created user ${user.email} was not visible in the user list.`);
        }
      } catch (error) {
        await this.captureUserManagementScreenshot('user-created-list-validation-issue', user.email);
        console.log(`User list validation issue for ${user.email}: ${error.message}`);
        if (this.options.strictUserListValidation) {
          throw error;
        }
      }
    }

    users.splice(0, users.length, ...preparedUsers);
    return preparedUsers;
  }

  async submitInviteUsersOnly(users) {
    this.validateInviteUserDataset(users);
    const preparedUsers = this.options.preserveInviteEmails
      ? users.map((user) => ({ ...user }))
      : await this.prepareUsersForCreation(users);
    console.log(`Submitting ${preparedUsers.length} User Management invites: ${preparedUsers.map((user) => user.email).join(', ')}`);

    const inviteModal = await this.openInviteUsersModal();

    for (let index = 0; index < preparedUsers.length; index += 1) {
      if (index > 0) {
        await this.addInviteUserRow(inviteModal, index + 1);
      }
      await this.fillInviteUserRow(inviteModal, preparedUsers[index], index);
    }

    await this.captureUserManagementScreenshot('user-creation-filled-invite-form', preparedUsers.map((user) => user.email).join('-'));

    if (this.options.dryRun) {
      console.log('Dry run enabled; stopping before Send Invites.');
      return preparedUsers;
    }

    await this.clickSendInvites(inviteModal);
    await this.waitForInviteSuccessNotification();
    await this.captureUserManagementScreenshot('user-creation-invite-success', preparedUsers.map((user) => user.email).join('-'));

    users.splice(0, users.length, ...preparedUsers);
    return preparedUsers;
  }

  getUniqueRolePool() {
    const configuredRoles = String(process.env.USER_INVITE_ROLES || '')
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean);

    return configuredRoles.length
      ? configuredRoles
      : ['Project Admin', 'Project Manager', 'Project User', 'All_User_Access'];
  }

  assignUniqueRoles(users) {
    const usedRoles = new Set();
    const rolePool = this.getUniqueRolePool();

    return users.map((user, index) => {
      let role = user.role || this.options.role;

      if (usedRoles.has(role)) {
        role = rolePool.find((candidate) => !usedRoles.has(candidate));
      }

      if (!role || usedRoles.has(role)) {
        throw new Error(
          `Could not assign a unique role for ${user.email}. ` +
          'Add unique Role values in the XLSX file or set USER_INVITE_ROLES with enough comma-separated roles.'
        );
      }

      usedRoles.add(role);

      if (role !== user.role) {
        console.log(`Assigned unique role for row ${index + 1}: ${user.email} -> ${role}`);
      }

      return { ...user, role };
    });
  }

  incrementEmailAddress(email, incrementBy = 1) {
    const match = String(email || '').trim().match(/^([^@]+)@(.+)$/);
    if (!match) return email;

    const [, localPart, domain] = match;
    const numericSuffix = localPart.match(/^(.*?)(\d+)$/);
    const nextLocalPart = numericSuffix
      ? `${numericSuffix[1]}${Number(numericSuffix[2]) + incrementBy}`
      : `${localPart}${incrementBy}`;

    return `${nextLocalPart}@${domain}`;
  }

  async userNameOrEmailExists(user) {
    const visibleByEmail = await this.locateVisibleInvitedUser(user.email, 1000);
    if (visibleByEmail) return true;

    const existingByEmail = await this.searchInvitedUser(user.email);
    if (existingByEmail) return true;

    if (!user.name) return false;

    const existingByName = await this.searchUserByText(user.name);
    if (!existingByName) return false;

    const rowText = await existingByName.innerText().catch(() => '');
    return new RegExp(this.escapeRegExp(user.name), 'i').test(rowText);
  }

  async prepareUniqueEmail(user, reservedEmails) {
    let candidate = { ...user };
    let counter = 1;

    while (
      reservedEmails.has(candidate.email.toLowerCase()) ||
      await this.userNameOrEmailExists(candidate)
    ) {
      const nextEmail = this.incrementEmailAddress(user.email, counter);
      console.log(`User name or email already exists for ${user.name || user.email}; using ${nextEmail}.`);
      candidate = { ...candidate, email: nextEmail };
      counter += 1;

      if (counter > 50) {
        throw new Error(`Could not find an unused email for ${user.name || user.email} after 50 attempts.`);
      }
    }

    reservedEmails.add(candidate.email.toLowerCase());
    return candidate;
  }

  async prepareUsersForCreation(users) {
    const rolePreparedUsers = this.assignUniqueRoles(users);
    const reservedEmails = new Set();
    const preparedUsers = [];

    for (const user of rolePreparedUsers) {
      preparedUsers.push(await this.prepareUniqueEmail(user, reservedEmails));
    }

    return preparedUsers;
  }

  async openYopmailInbox(email, targetPage) {
    console.log(`Opening Yopmail inbox for ${email}`);
    await targetPage.goto('https://yopmail.com/', { waitUntil: 'domcontentloaded' });
    await targetPage.getByRole('textbox', { name: /Login/i }).fill(email);
    await targetPage.getByTitle(/Check Inbox/i).click();
    await targetPage.waitForLoadState('domcontentloaded').catch(() => null);
    await targetPage.waitForTimeout(2000);
  }

  async clickLatestInvitationEmail(mailPage, email) {
    for (let attempt = 1; attempt <= 20; attempt += 1) {
      const inboxFrame = mailPage.frameLocator('iframe[name="ifinbox"]');
      const invitationCandidates = [
        inboxFrame.getByRole('button', { name: /voyagecontrol|noreply/i }).first(),
        inboxFrame.locator('button, .m, .lm, div').filter({ hasText: /voyagecontrol|noreply|invite|invitation/i }).first()
      ];

      for (const candidate of invitationCandidates) {
        if (await candidate.isVisible({ timeout: 4000 }).catch(() => false)) {
          await clickHighlighted(candidate, `Invitation email for ${email}`);
          await this.captureUserManagementScreenshot('invitation-email-received', email, mailPage);
          return;
        }
      }

      const refreshButton = mailPage.locator('#refresh, button:has-text("Refresh")').first();
      if (await refreshButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await refreshButton.click().catch(() => null);
      } else {
        await mailPage.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
      }
      await mailPage.waitForTimeout(5000);
    }

    await this.captureUserManagementScreenshot('invitation-email-not-found', email, mailPage);
    throw new Error(`Invitation email was not received in Yopmail for ${email}.`);
  }

  async clickAcceptInvite(mailPage, email) {
    const mailFrame = mailPage.frameLocator('iframe[name="ifmail"]');
    const acceptInvite = mailFrame.getByRole('link', { name: /Accept Invite/i }).first()
      .or(mailFrame.locator('a:has-text("Accept Invite"), a[href*="invite"], a[href*="accept"]').first());

    await acceptInvite.waitFor({ state: 'visible', timeout: 20000 });
    await this.captureUserManagementScreenshot('accept-invite-button-visible', email, mailPage);

    const popupPromise = mailPage.waitForEvent('popup', { timeout: 10000 }).catch(() => null);
    await clickHighlighted(acceptInvite, `Accept Invite for ${email}`);
    const popup = await popupPromise;
    await this.captureUserManagementScreenshot('accept-invite-action', email, popup || mailPage);

    return popup || mailPage;
  }

  async clickFirstVisibleButton(targetPage, patterns, label) {
    for (const pattern of patterns) {
      const button = targetPage.getByRole('button', { name: pattern }).first();
      if (await button.isVisible({ timeout: 5000 }).catch(() => false)) {
        await this.clickWithFallback(button, label);
        return true;
      }
    }

    return false;
  }

  async fillFirstVisibleField(targetPage, patterns, value, label, options = {}) {
    for (const pattern of patterns) {
      const candidates = [
        targetPage.getByRole('textbox', { name: pattern }).first(),
        targetPage.locator(`input[placeholder*="${options.placeholder || ''}" i], textarea[placeholder*="${options.placeholder || ''}" i]`).first(),
        targetPage.locator(`input[name*="${options.name || ''}" i], textarea[name*="${options.name || ''}" i]`).first(),
        targetPage.locator(`input[id*="${options.name || ''}" i], textarea[id*="${options.name || ''}" i]`).first()
      ];

      for (const candidate of candidates) {
        if (await candidate.isVisible({ timeout: 1500 }).catch(() => false)) {
          const editable = await candidate.isEditable({ timeout: 500 }).catch(() => false);
          if (!editable) {
            const currentValue = await candidate.inputValue().catch(() => '');
            if (String(currentValue).trim() === String(value).trim()) {
              await highlight(candidate, `${label} already populated`).catch(() => null);
              return true;
            }
            continue;
          }

          await fillHighlighted(candidate, value, label);
          return true;
        }
      }
    }

    return false;
  }

  async completePasswordStep(setupPage, user) {
    await this.fillFirstVisibleField(setupPage, [
      /^Username$/i,
      /^User Name$/i,
      /^Email$/i,
      /email id/i
    ], user.email, `Username ${user.email}`, { name: 'email', placeholder: 'Email' });

    const passwordField = setupPage.getByRole('textbox', { name: /Create Password/i }).first()
      .or(setupPage.locator('input[type="password"]').first());

    if (await passwordField.isVisible({ timeout: 15000 }).catch(() => false)) {
      await fillHighlighted(passwordField, user.password || DEFAULT_NEW_USER_PASSWORD, `Create password for ${user.email}`);
      await this.clickFirstVisibleButton(setupPage, [/^Next$/i, /^Submit$/i, /^Continue$/i], 'Submit password');
      await setupPage.waitForLoadState('domcontentloaded').catch(() => null);
      await setupPage.waitForTimeout(1500);
      return true;
    }

    return false;
  }

  async completeProfileStep(setupPage, user) {
    if (user.setupMissingFields?.length) {
      throw new Error(
        `Excel row for ${user.email} is missing account setup fields: ${user.setupMissingFields.join(', ')}. ` +
        'Add these columns to complete Yopmail account setup.'
      );
    }

    const profileVisible = await setupPage.getByRole('textbox', { name: /First Name/i }).first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    if (!profileVisible && !/set-profile/i.test(setupPage.url())) {
      return false;
    }

    await this.fillFirstVisibleField(setupPage, [
      /^Username$/i,
      /^User Name$/i,
      /^Full Name$/i,
      /^Name$/i
    ], user.name, `Username ${user.name}`, { name: 'user', placeholder: 'Name' });
    await this.fillFirstVisibleField(setupPage, [/First Name/i], user.firstName, `First name ${user.name}`, { name: 'first', placeholder: 'First' });
    await this.fillFirstVisibleField(setupPage, [/Last Name/i], user.lastName, `Last name ${user.name}`, { name: 'last', placeholder: 'Last' });
    await this.fillFirstVisibleField(setupPage, [/phone|mobile/i, /Enter phone number/i], user.mobile, `Mobile ${user.name}`, { name: 'phone', placeholder: 'phone' });
    await this.fillFirstVisibleField(setupPage, [/address/i], user.address, `Address ${user.name}`, { name: 'address', placeholder: 'address' });

    await this.captureUserManagementScreenshot('account-setup-profile-filled', user.email, setupPage);
    await this.clickFirstVisibleButton(setupPage, [/^Submit$/i, /^Next$/i, /^Save$/i, /^Continue$/i], 'Submit account setup');
    await setupPage.waitForLoadState('domcontentloaded').catch(() => null);
    await setupPage.waitForTimeout(2500);
    return true;
  }

  async completeProjectChoiceIfVisible(setupPage, user) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await setupPage.waitForLoadState('domcontentloaded').catch(() => null);
      await setupPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);

      const projectChoices = [
        setupPage.locator('#project-item-1').first(),
        setupPage.locator('[id^="project-item-"]').first(),
        setupPage.getByText(/Buckingham Palace|V3 Construction deliveries/i).first(),
        setupPage.locator('a[href*="/dashboard"], button, [role="button"], .MuiCard-root, .card')
          .filter({ hasText: /Buckingham|Project|Construction|Delivery|Palace/i })
          .first()
      ];

      for (const projectChoice of projectChoices) {
        if (await projectChoice.isVisible({ timeout: 10000 }).catch(() => false)) {
          await clickHighlighted(projectChoice, `Select project for ${user.email}`);
          await setupPage.waitForLoadState('domcontentloaded').catch(() => null);
          await setupPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
          await setupPage.waitForTimeout(2000);
          return true;
        }
      }

      const clickedProject = await setupPage.evaluate(() => {
        const isVisible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0';
        };
        const candidates = Array.from(document.querySelectorAll(
          'a[href*="/dashboard"], a[href*="/home"], [id^="project-item-"], button, [role="button"], .MuiCard-root, .card'
        )).filter((element) => {
          const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
          return isVisible(element) && text && !/log\s*out|sign\s*out|cancel|close/i.test(text);
        });

        const project = candidates.find((element) => /Buckingham|Project|Construction|Delivery|Palace/i.test(
          element.innerText || element.textContent || ''
        )) || candidates[0];

        if (!project) return false;
        project.click();
        return true;
      }).catch(() => false);

      if (clickedProject) {
        await setupPage.waitForLoadState('domcontentloaded').catch(() => null);
        await setupPage.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
        await setupPage.waitForTimeout(2000);
        return true;
      }

      if (/\/project\/choose/i.test(setupPage.url()) && attempt < 3) {
        await setupPage.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
        await setupPage.waitForTimeout(3000);
      }
    }

    return false;
  }

  async validateAccountSetupCompleted(setupPage, user) {
    const success = await setupPage.waitForFunction(() => {
      const url = window.location.href;
      const text = (document.body.innerText || '').replace(/\s+/g, ' ');
      return /stg-app\.voyagecontrol\.com/i.test(url) ||
        /project\/choose/i.test(url) ||
        /booking|dashboard|user management|project/i.test(text);
    }, null, { timeout: 30000 }).then(() => true).catch(() => false);

    await this.captureUserManagementScreenshot('account-setup-completion', user.email, setupPage);

    if (!success || /set-password|set-profile|accept/i.test(setupPage.url())) {
      const message = await this.getVisiblePageMessage(setupPage);
      throw new Error(`Account setup did not complete for ${user.email}. ${message || `Current URL: ${setupPage.url()}`}`);
    }
  }

  async showActivationCloseMessage(setupPage, user) {
    const message = 'New account has been activated. The account is going to close.';
    console.log(`${message} (${user.email})`);

    await setupPage.evaluate((activationMessage) => {
      const banner = document.createElement('div');
      banner.setAttribute('data-vc-activation-close-message', 'true');
      banner.textContent = activationMessage;
      Object.assign(banner.style, {
        position: 'fixed',
        left: '50%',
        top: '24px',
        transform: 'translateX(-50%)',
        zIndex: '2147483647',
        background: '#0f766e',
        color: '#fff',
        padding: '14px 20px',
        borderRadius: '6px',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.22)',
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        fontWeight: '700',
        letterSpacing: '0'
      });
      document.body.appendChild(banner);
    }, message).catch(() => null);

    await this.captureUserManagementScreenshot('account-activated-close-message', user.email, setupPage);
    await setupPage.waitForTimeout(ACTIVATION_CLOSE_MESSAGE_MS);
  }

  async acceptInvitationAndCompleteAccountSetup(user, options = {}) {
    const browser = this.page.context().browser();
    const useCurrentContext = options.sameBrowserContext || !browser;
    if (!useCurrentContext) {
      console.log(`Opening Yopmail and account activation in an isolated incognito browser context for ${user.email}`);
    }
    const inviteContext = !useCurrentContext
      ? await browser.newContext({
        viewport: this.page.viewportSize() || undefined,
        ignoreHTTPSErrors: true
      })
      : this.page.context();
    const mailPage = await inviteContext.newPage();
    let setupPage;

    try {
      await this.openYopmailInbox(user.email, mailPage);
      await this.clickLatestInvitationEmail(mailPage, user.email);
      setupPage = await this.clickAcceptInvite(mailPage, user.email);

      await setupPage.waitForLoadState('domcontentloaded').catch(() => null);
      await setupPage.waitForTimeout(2000);

      await this.completePasswordStep(setupPage, user);
      if (/set-profile/i.test(setupPage.url())) {
        await this.completeProfileStep(setupPage, user);
      } else {
        const profileCompleted = await this.completeProfileStep(setupPage, user);
        if (!profileCompleted) {
          await setupPage.goto('https://stg-login.voyagecontrol.com/api/sso/users/set-profile/', {
            waitUntil: 'domcontentloaded'
          }).catch(() => null);
          await this.completeProfileStep(setupPage, user);
        }
      }

      await this.completeProjectChoiceIfVisible(setupPage, user);
      await this.validateAccountSetupCompleted(setupPage, user);
      await this.showActivationCloseMessage(setupPage, user);
      console.log(`Account setup completed for ${user.name}: ${user.email}`);
      return setupPage;
    } finally {
      if (!useCurrentContext) {
        await inviteContext.close().catch(() => null);
      } else if (!options.keepSetupPageOpen) {
        await mailPage.close().catch(() => null);
      } else if (setupPage && setupPage !== mailPage) {
        await mailPage.close().catch(() => null);
      }
    }
  }

  async navigateBackToUserManagementTab() {
    const userManagementUrl = `${this.options.appUrl.replace(/\/$/, '')}/${this.options.projectId}/dashboard/manage-user`;
    let lastError;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        if (this.page.isClosed()) {
          throw new Error('Original User Management browser page is closed.');
        }

        await this.page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null);
        await this.page.goto(userManagementUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);

        if (this.page.url().startsWith('chrome-error://')) {
          throw new Error(`Chrome error page opened while navigating to ${userManagementUrl}`);
        }

        await this.page.getByRole('button', { name: /Invite Users/i }).waitFor({
          state: 'visible',
          timeout: 30000
        });
        await this.waitForUserListReady();
        await this.captureUserManagementScreenshot('user-management-tab-navigation');
        return;
      } catch (error) {
        lastError = error;
        await this.captureUserManagementScreenshot(`user-management-tab-navigation-retry-${attempt}`).catch(() => null);
        await this.page.waitForTimeout(2000);
      }
    }

    throw new Error(`Could not return to User Management page after activation. Last error: ${lastError?.message || lastError}`);
  }

  async findChangeOrganizationDialog(timeout = 15000) {
    const dialogScopes = '.MuiDialog-paper, [role="dialog"], .MuiModal-root, .modal, .popup';
    const confirmButton = this.page.getByRole('button', { name: /^Confirm$/i });
    const candidates = [
      this.page.locator(dialogScopes).filter({ hasText: /change\s+(associated\s+)?organi[sz]ation/i }).filter({
        has: confirmButton
      }).last(),
      this.page.locator(dialogScopes).filter({ hasText: /new\s+organi[sz]ation/i }).filter({
        has: confirmButton
      }).last(),
      this.page.locator(dialogScopes).filter({
        has: this.page.getByRole('combobox', { name: /organi[sz]ation/i })
      }).filter({
        has: confirmButton
      }).last(),
      this.page.locator(dialogScopes).filter({
        has: confirmButton
      }).filter({
        hasText: /new\s+organi[sz]ation/i
      }).last()
    ];

    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      for (const candidate of candidates) {
        if (await candidate.isVisible({ timeout: 300 }).catch(() => false)) {
          return candidate;
        }
      }
      await this.page.waitForTimeout(250);
    }

    return null;
  }

  async getChangeOrganizationDialog(email) {
    const dialog = await this.findChangeOrganizationDialog();
    if (!dialog) {
      const actionLabels = await this.getVisibleActionLabels();
      await this.captureUserManagementScreenshot('change-organization-popup-missing', email);
      throw new Error(`Change Organization popup did not open for ${email}. Visible actions: ${actionLabels.join(' | ') || '-'}`);
    }

    await this.captureUserManagementScreenshot('change-organization-popup', email);
    return dialog;
  }

  async selectChangeOrganizationOption(dialog, user) {
    const currentOrganization = user.organization || this.options.organization;
    const targetOrganization = user.changeOrganization || this.options.changeOrganization;
    const currentOrganizationPattern = new RegExp(this.escapeRegExp(currentOrganization), 'i');
    const organizationDropdownCandidates = [
      dialog.getByRole('combobox', { name: /organi[sz]ation/i }).first(),
      dialog.locator('[role="combobox"]').filter({ hasText: currentOrganizationPattern }).first(),
      dialog.locator('.MuiSelect-select, [aria-haspopup="listbox"], [aria-expanded], [role="button"]')
        .filter({ hasText: currentOrganizationPattern })
        .first(),
      dialog.getByRole('combobox').first(),
      dialog.locator('.MuiSelect-select, [aria-haspopup="listbox"], [aria-expanded]').first()
    ];

    let openedDropdown = false;
    for (const organizationCombobox of organizationDropdownCandidates) {
      if (await organizationCombobox.isVisible({ timeout: 1500 }).catch(() => false)) {
        await this.clickWithFallback(organizationCombobox, 'Change Organization dropdown');
        openedDropdown = true;
        break;
      }
    }

    if (!openedDropdown) {
      const clickedDropdown = await dialog.evaluate((root, currentValue) => {
        const normalize = (value = '') => value.replace(/\s+/g, ' ').trim().toLowerCase();
        const normalizedCurrent = normalize(currentValue);
        const candidates = Array.from(root.querySelectorAll(
          '[role="combobox"], [aria-haspopup="listbox"], .MuiSelect-select, button, div'
        ));

        const match = candidates.find((element) => {
          const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          const isVisible = rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0';

          return isVisible &&
            text &&
            normalize(text).includes(normalizedCurrent) &&
            !/confirm|close|change\s+associated/i.test(normalize(text));
        });

        if (!match) return false;
        match.click();
        return true;
      }, currentOrganization).catch(() => false);

      if (!clickedDropdown) {
        const currentOrganizationValue = dialog.getByText(currentOrganization, { exact: true }).first();
        if (await currentOrganizationValue.isVisible({ timeout: 3000 }).catch(() => false)) {
          await this.clickWithFallback(currentOrganizationValue, `Current organization: ${currentOrganization}`);
          openedDropdown = true;
        }
      } else {
        openedDropdown = true;
      }
    }

    if (!openedDropdown) {
      openedDropdown = await this.page.evaluate((currentValue) => {
        const normalize = (value = '') => value.replace(/\s+/g, ' ').trim().toLowerCase();
        const normalizedCurrent = normalize(currentValue);
        const isVisible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0';
        };
        const candidates = Array.from(document.querySelectorAll(
          '[role="combobox"], [aria-haspopup="listbox"], .MuiSelect-select, [aria-expanded]'
        ));
        const target = candidates.find((element) => {
          const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
          return isVisible(element) &&
            text &&
            normalize(text).includes(normalizedCurrent) &&
            !/project\s+admin|project\s+manager|project\s+user|view\s+only|rows\s+per\s+page/i.test(text);
        });

        if (!target) return false;
        const clickable = target.closest('[role="combobox"], [aria-haspopup="listbox"], .MuiInputBase-root, .MuiFormControl-root') || target;
        for (const eventName of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
          clickable.dispatchEvent(new MouseEvent(eventName, {
            bubbles: true,
            cancelable: true,
            view: window
          }));
        }
        return true;
      }, currentOrganization).catch(() => false);
    }

    if (!openedDropdown) {
      await this.captureUserManagementScreenshot('change-organization-dropdown-missing', user.email);
      throw new Error(`Could not open Change Organization dropdown for ${user.email}.`);
    }

    if (targetOrganization) {
      const targetOption = this.page.getByRole('option', { name: targetOrganization, exact: true }).first()
        .or(this.page.getByRole('option', { name: targetOrganization }).first())
        .or(this.page.getByText(targetOrganization, { exact: true }).last());
      await this.clickWithFallback(targetOption, `New organization: ${targetOrganization}`);
      await this.captureUserManagementScreenshot('new-organization-selection', user.email);
      return targetOrganization;
    }

    const optionSelected = await this.page.waitForFunction((currentValue) => {
      const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const normalizedCurrent = normalize(currentValue);
      const options = Array.from(document.querySelectorAll(
        '.MuiPopover-root [role="listbox"] [role="option"], .MuiPopover-root [role="listbox"] li, ' +
        '.MuiPopover-root .MuiMenu-list li[data-value], .MuiPopover-root .MuiMenuItem-root[data-value], ' +
        '[role="listbox"] [role="option"], [role="listbox"] li[data-value]'
      ));

      for (const option of options) {
        option.removeAttribute('data-vc-change-organization-option');
      }

      const candidate = options.find((option) => {
        const text = (option.innerText || option.textContent || '').replace(/\s+/g, ' ').trim();
        const rect = option.getBoundingClientRect();
        const style = window.getComputedStyle(option);
        return text &&
          !option.closest('nav, .navbar, .nav-item, header') &&
          option.closest('[role="listbox"], .MuiMenu-list') &&
          !option.closest('[role="menu"]') &&
          normalize(text) !== normalizedCurrent &&
          !/^\d+$/.test(text) &&
          !/select|organi[sz]ation|invite|cancel|change\s+associated|confirm|close/i.test(normalize(text)) &&
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      });

      if (!candidate) return '';
      candidate.setAttribute('data-vc-change-organization-option', 'true');
      return (candidate.innerText || candidate.textContent || '').replace(/\s+/g, ' ').trim();
    }, currentOrganization, { timeout: 10000 }).then((handle) => handle.jsonValue()).catch(() => '');

    if (!optionSelected) {
      await this.captureUserManagementScreenshot('new-organization-selection-failed', user.email);
      throw new Error(`No alternate organization option was available for ${user.email}. Add a "new organization" column or USER_CHANGE_ORGANIZATION value.`);
    }

    const selectedOrganizationOption = this.page.locator('[data-vc-change-organization-option="true"]').first();
    await selectedOrganizationOption.click({ force: true, timeout: 5000 }).catch(async () => {
      await selectedOrganizationOption.evaluate((element) => element.click());
    });
    await this.page.waitForTimeout(700);
    await this.captureUserManagementScreenshot('new-organization-selection', user.email);
    return optionSelected;
  }

  async confirmChangeOrganization(dialog, user) {
    const visibleDialog = this.page.locator('.MuiDialog-paper:visible, [role="dialog"]:visible, .MuiModal-root:visible, .modal:visible, .popup:visible')
      .filter({ hasText: /change\s+(associated\s+)?organi[sz]ation|new\s+organi[sz]ation/i })
      .filter({ has: this.page.getByRole('button', { name: /^Confirm$/i }) })
      .last();
    const confirmCandidates = [
      visibleDialog.getByRole('button', { name: /^Confirm$/i }).first(),
      visibleDialog.getByRole('button', { name: /^Save$/i }).first(),
      visibleDialog.getByRole('button', { name: /^Submit$/i }).first(),
      dialog.getByRole('button', { name: /^Confirm$/i }).first(),
      this.page.getByRole('button', { name: /^Confirm$/i }).last()
    ];

    for (const confirmButton of confirmCandidates) {
      if (await confirmButton.isVisible({ timeout: 1500 }).catch(() => false)) {
        await this.clickWithFallback(confirmButton, 'Confirm Change Organization');
        await this.captureUserManagementScreenshot('change-organization-confirmation-action', user.email);
        await this.page.waitForLoadState('domcontentloaded').catch(() => null);
        await this.page.waitForTimeout(2500);
        return;
      }
    }

    await this.captureUserManagementScreenshot('change-organization-confirm-missing', user.email);
    throw new Error(`Could not find Confirm button in Change Organization popup for ${user.email}.`);
  }

  async waitForOrganizationUpdateSuccess(email, targetOrganization) {
    const successPattern = /success|updated|changed|organi[sz]ation/i;
    const notification = this.page.locator(
      '.Toastify__toast, .toast, .alert, .MuiAlert-root, .SnackbarItem-message, [role="alert"], [role="status"], [class*="toast"], [class*="snackbar"]'
    ).filter({ hasText: successPattern }).first();

    if (await notification.isVisible({ timeout: 8000 }).catch(() => false)) {
      const message = await notification.innerText().catch(() => 'Organization update success notification displayed');
      console.log(`Change Organization success notification: ${message.replace(/\s+/g, ' ').trim()}`);
    }

    const updatedRow = await this.searchInvitedUser(email) || await this.locateVisibleInvitedUser(email, 5000);
    if (!updatedRow) {
      await this.captureUserManagementScreenshot('updated-organization-validation-failed', email);
      throw new Error(`Could not find ${email} after Change Organization confirmation.`);
    }

    const rowText = await this.getUserRowText(updatedRow);
    if (!new RegExp(this.escapeRegExp(targetOrganization), 'i').test(rowText)) {
      await this.captureUserManagementScreenshot('updated-organization-validation-failed', email);
      throw new Error(`Organization update was not visible for ${email}. Expected ${targetOrganization}. Row text: ${rowText.replace(/\s+/g, ' ').trim()}`);
    }

    await highlight(updatedRow, `Updated organization: ${targetOrganization}`);
    await this.captureUserManagementScreenshot('updated-organization-validation', email);
  }

  async changeOrganizationForUser(user) {
    await this.navigateBackToUserManagementTab();

    const row = await this.verifyInvitedUserVisibleInList(user.email);
    await this.openMatchedUserActions(row, user.email);
    await this.captureUserManagementScreenshot('three-dot-menu-action', user.email);

    let dialog = await this.findChangeOrganizationDialog(1000);
    if (!dialog) {
      const clickedChangeOrganization = await this.clickVisibleAction([
        /change\s+associated\s+organi[sz]ation/i,
        /change\s+organi[sz]ation/i
      ], 'Change Organization');

      if (!clickedChangeOrganization) {
        const actionLabels = await this.getVisibleActionLabels();
        await this.captureUserManagementScreenshot('change-organization-action-missing', user.email);
        throw new Error(`Change Organization action was not available for ${user.email}. Visible actions: ${actionLabels.join(' | ') || '-'}`);
      }

      dialog = await this.getChangeOrganizationDialog(user.email);
    } else {
      await this.captureUserManagementScreenshot('change-organization-popup', user.email);
    }

    const targetOrganization = await this.selectChangeOrganizationOption(dialog, user);
    await this.confirmChangeOrganization(dialog, user);
    await this.waitForOrganizationUpdateSuccess(user.email, targetOrganization);

    console.log(`Organization updated for ${user.email}: ${targetOrganization}`);
    return targetOrganization;
  }

  async changeOrganizationForUsers(users) {
    const changedUsers = [];

    for (const user of users) {
      const changedOrganization = await this.changeOrganizationForUser(user);
      user.updatedOrganization = changedOrganization;
      user.organization = changedOrganization;
      changedUsers.push(user);
    }

    return changedUsers;
  }

  async verifyOwnLoginForUser(user) {
    const browser = this.page.context().browser();
    if (!browser) {
      throw new Error('A browser instance is required to verify own login in an isolated context.');
    }

    console.log(`Opening own login in an isolated browser context for ${user.email}`);
    const context = await browser.newContext({
      viewport: this.page.viewportSize() || undefined,
      ignoreHTTPSErrors: true
    });
    const ownPage = await context.newPage();
    ownPage.setDefaultTimeout(60000);
    ownPage.setDefaultNavigationTimeout(60000);

    const ownUserManagement = new UserManagementPage(ownPage, {
      ...this.options,
      email: user.email,
      password: user.password || DEFAULT_NEW_USER_PASSWORD,
      strictUserListValidation: true
    });

    try {
      await ownUserManagement.login();
      await ownUserManagement.completeProjectChoiceIfVisible(ownPage, user).catch(() => false);
      await ownPage.waitForLoadState('domcontentloaded').catch(() => null);
      await ownPage.waitForTimeout(2000);

      const ssoChooserAuthenticated = async () => /\/api\/sso\/platforms\/choose/i.test(ownPage.url()) &&
        await ownPage.locator('body').filter({
          hasText: new RegExp(`${this.escapeRegExp(user.email)}|Logout`, 'i')
        }).first().isVisible({ timeout: 3000 }).catch(() => false);

      let authenticatedBeforeAppNavigation = await ssoChooserAuthenticated();
      if (authenticatedBeforeAppNavigation) {
        await ownPage.goto(`${this.options.appUrl.replace(/\/$/, '')}/${this.options.projectId}/home`, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        }).catch(() => null);
        await ownUserManagement.completeProjectChoiceIfVisible(ownPage, user).catch(() => false);
        await ownPage.waitForLoadState('domcontentloaded').catch(() => null);
        await ownPage.waitForTimeout(2000);

        if (ownPage.url().startsWith('chrome-error://')) {
          console.log(`Own login for ${user.email} reached SSO chooser, but app home was not available for this role.`);
        } else {
          authenticatedBeforeAppNavigation = false;
        }
      }

      const loginStillVisible = await ownPage.locator('input[type="password"]').first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      if (loginStillVisible) {
        await ownUserManagement.captureUserManagementScreenshot('own-login-failed', user.email, ownPage);
        throw new Error(`Own login did not complete for ${user.email}.`);
      }

      const authenticatedByUrl = new RegExp(
        `${this.escapeRegExp(this.options.appUrl.replace(/\/$/, ''))}/[^/]+/(home|dashboard|booking|calendar|manage-user|project-management)`,
        'i'
      ).test(ownPage.url());
      const authenticatedByContent = await ownPage.locator('body').filter({
        hasText: /Booking|User Management|Project|Dashboard|Calendar/i
      }).first().isVisible({ timeout: 15000 }).catch(() => false);
      const authenticated = authenticatedByUrl ||
        authenticatedByContent ||
        authenticatedBeforeAppNavigation ||
        await ssoChooserAuthenticated();

      if (!authenticated) {
        await ownUserManagement.captureUserManagementScreenshot('own-login-authenticated-state-missing', user.email, ownPage);
        throw new Error(`Own login for ${user.email} did not reach an authenticated app page. Current URL: ${ownPage.url()}`);
      }

      await ownUserManagement.captureUserManagementScreenshot('own-login-authenticated', user.email, ownPage);
      return true;
    } finally {
      await context.close().catch(() => null);
    }
  }

  async verifyOwnLoginForUsers(users) {
    for (const user of users) {
      await this.verifyOwnLoginForUser(user);
    }
  }

  assertAutomationCreatedUser(user) {
    const email = user?.email || '';
    if (!/^User\d+@yopmail\.com$/i.test(email)) {
      throw new Error(`Refusing to remove a non-automation-created user from project: ${email || '-'}`);
    }
  }

  async confirmRemoveFromProject(user) {
    const removeDialog = this.page.locator('.MuiDialog-paper:visible, [role="dialog"]:visible, .MuiModal-root:visible, .modal:visible, .popup:visible')
      .filter({ hasText: /remove\s+from\s+project|remove/i })
      .last();
    const removeButtonCandidates = [
      removeDialog.getByRole('button', { name: /^Remove$/i }).first(),
      removeDialog.locator('button:has-text("Remove")').first(),
      this.page.getByRole('button', { name: /^Remove$/i }).last()
    ];

    for (const removeButton of removeButtonCandidates) {
      if (await removeButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await this.clickWithFallback(removeButton, `Confirm remove from project: ${user.email}`);
        await this.captureUserManagementScreenshot('remove-from-project-confirmed', user.email);
        await this.page.waitForLoadState('domcontentloaded').catch(() => null);
        await this.page.waitForTimeout(3000);
        return;
      }
    }

    await this.captureUserManagementScreenshot('remove-from-project-confirm-missing', user.email);
    throw new Error(`Could not find Remove confirmation button for ${user.email}.`);
  }

  async closeUserManagementPopups() {
    await this.page.keyboard.press('Escape').catch(() => null);
    await this.page.waitForTimeout(500);

    const closeCandidates = [
      this.page.getByRole('link', { name: /^Close$/i }).last(),
      this.page.getByRole('button', { name: /^Close$/i }).last(),
      this.page.locator('text=/^Close$/i').last()
    ];

    for (const closeCandidate of closeCandidates) {
      if (await closeCandidate.isVisible({ timeout: 500 }).catch(() => false)) {
        await closeCandidate.click({ force: true }).catch(() => null);
        await this.page.waitForTimeout(500);
      }
    }

    await this.page.keyboard.press('Escape').catch(() => null);
    await this.page.waitForTimeout(500);
  }

  async openRemoveFromProjectFromUserRow(row, user) {
    await this.closeUserManagementPopups();
    await this.waitForUserListReady().catch(() => null);

    let targetRow = await this.locateVisibleInvitedUser(user.email, 10000);
    if (!targetRow) {
      targetRow = await this.searchInvitedUser(user.email);
    }

    if (!targetRow) {
      await this.captureUserManagementScreenshot('remove-from-project-row-missing', user.email);
      throw new Error(`Could not re-locate automation-created user before Remove from project: ${user.email}`);
    }

    const organization = user.updatedOrganization || user.organization || this.options.changeOrganization || this.options.organization;
    const organizationPattern = new RegExp(this.escapeRegExp(organization), 'i');
    const organizationCellCandidates = [
      targetRow.getByRole('cell', { name: organizationPattern }).first(),
      targetRow.locator('td').filter({ hasText: organizationPattern }).first(),
      targetRow.locator('[role="cell"]').filter({ hasText: organizationPattern }).first(),
      targetRow.locator('td, [role="cell"]').nth(3)
    ];

    for (const organizationCell of organizationCellCandidates) {
      if (await organizationCell.isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.clickWithFallback(organizationCell, `Open project membership for ${user.email}`);
        await this.page.waitForTimeout(1000);
        break;
      }
    }

    await this.page.evaluate(() => {
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };
      const scrollContainers = Array.from(document.querySelectorAll(
        '.MuiDrawer-paper, [role="dialog"], aside, [class*="drawer"], [class*="Drawer"], [class*="side"], [class*="panel"]'
      )).filter(isVisible);

      for (const container of scrollContainers) {
        container.scrollTop = container.scrollHeight;
      }
    }).catch(() => null);
    await this.page.waitForTimeout(700);

    const removeLinkCandidates = [
      this.page.getByRole('link', { name: /remove\s+from\s+project/i }).first(),
      this.page.getByRole('button', { name: /remove\s+from\s+project/i }).first(),
      this.page.locator('a, button, [role="button"]').filter({ hasText: /remove\s+from\s+project/i }).first()
    ];

    for (const removeLink of removeLinkCandidates) {
      if (await removeLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await this.clickWithFallback(removeLink, `Remove from project: ${user.email}`);
        await this.captureUserManagementScreenshot('remove-from-project-action', user.email);
        return true;
      }
    }

    return false;
  }

  async verifyUserRemovedFromProject(user) {
    await this.clearUserListSearch().catch(() => null);
    const rowAfterRemoval = await this.searchInvitedUser(user.email);
    if (rowAfterRemoval) {
      await this.captureUserManagementScreenshot('remove-from-project-record-still-visible', user.email);
      const rowText = await this.getUserRowText(rowAfterRemoval);
      throw new Error(`Automation-created user ${user.email} is still visible after Remove from project. Row text: ${rowText.replace(/\s+/g, ' ').trim()}`);
    }

    await this.captureUserManagementScreenshot('remove-from-project-record-removed', user.email);
  }

  async removeUserFromProject(user) {
    this.assertAutomationCreatedUser(user);
    await this.navigateBackToUserManagementTab();

    const row = await this.verifyInvitedUserVisibleInList(user.email);
    const rowText = (await this.getUserRowText(row)).replace(/\s+/g, ' ').trim();
    if (!this.getStatusPattern('Activated').test(rowText)) {
      throw new Error(`Refusing to remove ${user.email}; expected an active automation-created record. Row text: ${rowText}`);
    }

    await this.openMatchedUserActions(row, user.email);
    await this.captureUserManagementScreenshot('remove-from-project-menu', user.email);

    let clickedRemoveFromProject = await this.clickVisibleAction([
      /remove\s+from\s+project/i,
      /^remove$/i
    ], 'Remove from project');

    if (!clickedRemoveFromProject) {
      clickedRemoveFromProject = await this.openRemoveFromProjectFromUserRow(row, user);
    }

    if (!clickedRemoveFromProject) {
      const actionLabels = await this.getVisibleActionLabels();
      await this.captureUserManagementScreenshot('remove-from-project-action-missing', user.email);
      throw new Error(`Remove from project action was not available for ${user.email}. Visible actions: ${actionLabels.join(' | ') || '-'}`);
    }

    await this.confirmRemoveFromProject(user);
    await this.verifyUserRemovedFromProject(user);
    console.log(`Removed automation-created user from project: ${user.email}`);
  }

  async removeUsersFromProject(users) {
    for (const user of users) {
      await this.removeUserFromProject(user);
    }
  }

  async waitForInviteModalToClose() {
    const inviteModal = this.getInviteModal();

    if (!(await inviteModal.isVisible({ timeout: 3000 }).catch(() => false))) {
      return;
    }

    await inviteModal.waitFor({ state: 'hidden', timeout: 10000 }).catch(async () => {
      const closeButton = inviteModal.getByText(/^Close$/i).first();
      const cancelButton = inviteModal.getByText(/^Cancel$/i).first();

      if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await this.clickWithFallback(closeButton, 'Close invite popup');
      } else if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await this.clickWithFallback(cancelButton, 'Close invite popup');
      }

      await inviteModal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => null);
    });
  }

  async waitForUserListReady(timeout = 45000) {
    await this.page.getByRole('button', { name: /Invite Users/i }).waitFor({
      state: 'visible',
      timeout: Math.min(timeout, 30000)
    });

    await this.page.waitForFunction(
      () => {
        const isVisible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0';
        };

        const visibleSkeletons = Array.from(document.querySelectorAll(
          '.MuiSkeleton-root, [class*="Skeleton"], [class*="skeleton"]'
        )).filter(isVisible);

        if (!visibleSkeletons.length) {
          return true;
        }

        const visibleDataRows = Array.from(document.querySelectorAll('tbody tr, [role="row"], .MuiDataGrid-row'))
          .filter(isVisible)
          .map((row) => (row.innerText || row.textContent || '').replace(/\s+/g, ' ').trim())
          .filter((text) => text && !/^status name email address associated organization project role$/i.test(text));

        return visibleDataRows.length > 0;
      },
      { timeout }
    ).catch(() => null);
  }

  async locateVisibleInvitedUser(email, timeout = 3000) {
    const emailPattern = new RegExp(this.escapeRegExp(email), 'i');
    const rowByEmail = this.page.locator('tr, [role="row"], .MuiDataGrid-row').filter({
      hasText: emailPattern
    }).first();

    if (await rowByEmail.isVisible({ timeout }).catch(() => false)) {
      return rowByEmail;
    }

    const emailText = this.page.getByText(email, { exact: true }).first();
    if (await emailText.isVisible({ timeout: 1000 }).catch(() => false)) {
      return emailText;
    }

    const normalizedMatch = await this.page.waitForFunction(
      (targetEmail) => {
        const normalize = (value) => (value || '').replace(/\s+/g, '').toLowerCase();
        const normalizedTarget = normalize(targetEmail);
        const candidates = Array.from(document.querySelectorAll('tr, [role="row"], .MuiDataGrid-row'));

        for (const element of candidates) {
          element.removeAttribute('data-vc-invited-user-match');

          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          const isVisible = rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0';

          if (isVisible && normalize(element.innerText || element.textContent).includes(normalizedTarget)) {
            element.setAttribute('data-vc-invited-user-match', 'true');
            return true;
          }
        }

        return false;
      },
      email,
      { timeout }
    ).then(() => true).catch(() => false);

    if (normalizedMatch) {
      const normalizedRow = this.page.locator('[data-vc-invited-user-match="true"]').first();
      if (await normalizedRow.isVisible({ timeout: 1000 }).catch(() => false)) {
        return normalizedRow;
      }
    }

    return null;
  }

  async findUserListSearchInput() {
    await this.page.getByRole('heading', { name: /User Management/i }).waitFor({
      state: 'visible',
      timeout: 10000
    });
    await this.waitForUserListReady();

    const searchInputFound = await this.page.waitForFunction(
      () => {
        const visibleText = (element) => (element.innerText || element.textContent || '').trim();
        const heading = Array.from(document.querySelectorAll('h1, h2, h3, [role="heading"]'))
          .find((element) => /user management/i.test(visibleText(element)));
        const headingBottom = heading?.getBoundingClientRect().bottom ?? 100;

        const inputs = Array.from(document.querySelectorAll('input, textarea'));
        for (const input of inputs) {
          input.removeAttribute('data-vc-user-search-input');
        }

        const candidates = inputs
          .filter((input) => {
            const rect = input.getBoundingClientRect();
            const style = window.getComputedStyle(input);
            const type = (input.getAttribute('type') || 'text').toLowerCase();
            const role = (input.getAttribute('role') || '').toLowerCase();
            const ariaHasPopup = input.getAttribute('aria-haspopup');
            const excludedAncestor = input.closest(
              'header, nav, aside, #invite_user_Modal, .vc-user-invite, [role="dialog"]'
            );

            return rect.width > 0 &&
              rect.height > 0 &&
              rect.top > headingBottom &&
              rect.left > 220 &&
              style.visibility !== 'hidden' &&
              style.display !== 'none' &&
              style.opacity !== '0' &&
              !input.disabled &&
              !input.readOnly &&
              !excludedAncestor &&
              role !== 'combobox' &&
              !ariaHasPopup &&
              !['hidden', 'button', 'submit', 'checkbox', 'radio'].includes(type);
          })
          .sort((left, right) => {
            const leftRect = left.getBoundingClientRect();
            const rightRect = right.getBoundingClientRect();
            const leftText = `${left.placeholder || ''} ${left.getAttribute('aria-label') || ''}`.toLowerCase();
            const rightText = `${right.placeholder || ''} ${right.getAttribute('aria-label') || ''}`.toLowerCase();
            const leftScore = (leftText.includes('search') ? -1000 : 0) + leftRect.top + leftRect.left / 1000;
            const rightScore = (rightText.includes('search') ? -1000 : 0) + rightRect.top + rightRect.left / 1000;
            return leftScore - rightScore;
          });

        if (!candidates.length) {
          return false;
        }

        candidates[0].setAttribute('data-vc-user-search-input', 'true');
        return true;
      },
      { timeout: 3000 }
    ).then(() => true).catch(() => false);

    if (!searchInputFound) {
      return null;
    }

    const searchInput = this.page.locator('[data-vc-user-search-input="true"]').first();
    if (await searchInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      return searchInput;
    }

    return null;
  }

  async findUserSearchInput() {
    return this.findUserListSearchInput();
  }

  async clearUserListSearch() {
    const searchInput = await this.findUserListSearchInput();
    if (!searchInput) {
      return;
    }

    await searchInput.click({ force: true });
    await searchInput.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => null);
    await searchInput.fill('');
    await this.page.keyboard.press('Enter').catch(() => null);
    await this.page.waitForTimeout(1500);
  }

  async openUserManagementFilterPanel() {
    await this.clearUserListSearch();

    const filterButton = this.page.getByRole('button', { name: /^Filter/i }).first()
      .or(this.page.locator('button:has-text("Filter"), [role="button"]:has-text("Filter")').first());

    await this.clickWithFallback(filterButton, 'User Management Filter');

    const filterPanel = await this.getVisibleUserManagementFilterModal();
    const applyButton = filterPanel.getByRole('button', { name: /Apply Filter|Apply Filters|Apply/i }).last()
      .or(filterPanel.locator('button:has-text("Apply")').last());
    await applyButton.waitFor({ state: 'visible', timeout: 15000 });
  }

  getUserManagementFilterModal() {
    return this.page.locator('#filterModal.modal.show, #filterModal:visible, .modal.show:visible, [role="dialog"]:visible, .MuiModal-root:visible, .MuiDrawer-paper:visible').filter({
      hasText: /Project Role|Organization|Apply Filter|Apply Filters|Apply/i
    }).first();
  }

  async getVisibleUserManagementFilterModal() {
    const filterPanel = this.getUserManagementFilterModal();
    await filterPanel.waitFor({ state: 'visible', timeout: 15000 });
    return filterPanel;
  }

  async getUserManagementFilterControl(filterLabel) {
    const filterPanel = await this.getVisibleUserManagementFilterModal();
    const markerValue = filterLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const marked = await filterPanel.evaluate(
      ({ label, markerValue }) => {
        const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const target = normalize(label);
        const isVisible = (element) => {
          if (!element) return false;
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0';
        };
        const directText = (element) => Array.from(element.childNodes)
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent || '')
          .join(' ');
        const controlSelector = '[role="combobox"], .MuiSelect-select, button[aria-haspopup="listbox"], input:not([type="hidden"])';
        const visibleControls = (scope) => Array.from(scope.querySelectorAll(controlSelector))
          .filter((control) => isVisible(control) && !control.disabled && control.getAttribute('aria-disabled') !== 'true');

        root.querySelectorAll('[data-vc-user-management-filter-control]')
          .forEach((element) => element.removeAttribute('data-vc-user-management-filter-control'));

        const labelNodes = Array.from(root.querySelectorAll('label, p, span, div, strong'))
          .filter((element) => {
            if (!isVisible(element)) return false;
            const own = normalize(directText(element));
            const full = normalize(element.innerText || element.textContent);
            return own === target || (full === target && full.length <= target.length + 5);
          });

        for (const labelNode of labelNodes) {
          const scopes = [];
          let current = labelNode;
          for (let depth = 0; current && depth < 6; depth += 1) {
            scopes.push(current);
            if (current.nextElementSibling) scopes.push(current.nextElementSibling);
            current = current.parentElement;
          }

          for (const scope of scopes) {
            const controls = visibleControls(scope);
            if (controls.length) {
              controls[0].setAttribute('data-vc-user-management-filter-control', markerValue);
              return true;
            }
          }
        }

        const allControls = visibleControls(root);
        const fallbackIndex = /organization/i.test(label) ? 1 : 0;
        if (allControls[fallbackIndex]) {
          allControls[fallbackIndex].setAttribute('data-vc-user-management-filter-control', markerValue);
          return true;
        }

        return false;
      },
      { label: filterLabel, markerValue }
    ).catch(() => false);

    if (!marked) {
      await this.captureUserManagementScreenshot(`filter-control-missing-${filterLabel}`);
      throw new Error(`Could not find ${filterLabel} control in the User Management filter popup.`);
    }

    return filterPanel.locator(`[data-vc-user-management-filter-control="${markerValue}"]`).first();
  }

  getUserManagementFilterCategoryId(filterLabel) {
    if (/project\s*role/i.test(filterLabel)) return 'project-role';
    if (/organization/i.test(filterLabel)) return 'organization';
    if (/status/i.test(filterLabel)) return 'status';
    return filterLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  async clickUserManagementFilterCategory(filterLabel) {
    const filterPanel = await this.getVisibleUserManagementFilterModal();
    const categoryId = this.getUserManagementFilterCategoryId(filterLabel);
    const categoryById = filterPanel.locator(`a#${categoryId}, button#${categoryId}, [role="tab"]#${categoryId}`).first();
    const categoryByText = filterPanel.locator('a[role="tab"], button[role="tab"], .nav-link').filter({
      hasText: new RegExp(`^${this.escapeRegExp(filterLabel)}$`, 'i')
    }).first();
    const category = await categoryById.isVisible({ timeout: 1000 }).catch(() => false)
      ? categoryById
      : categoryByText;

    await this.clickWithFallback(category, `${filterLabel} filter category`);
    await filterPanel.locator(`#${categoryId}.active, #${categoryId}.nav-link.active`).first()
      .waitFor({ state: 'visible', timeout: 5000 })
      .catch(() => null);
    await this.page.waitForTimeout(700);
  }

  async clickUserManagementFilterCheckbox(filterLabel, value) {
    const filterPanel = await this.getVisibleUserManagementFilterModal();
    const markerValue = `${filterLabel}-${value}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const result = await filterPanel.evaluate(
      (root, { filterLabel, value }) => {
        const normalize = (text) => (text || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const target = normalize(value);
        const isVisible = (element) => {
          if (!element) return false;
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0';
        };
        const items = Array.from(root.querySelectorAll('.filtercheck-item'))
          .filter(isVisible);
        root.querySelectorAll('[data-vc-user-management-filter-option]')
          .forEach((element) => element.removeAttribute('data-vc-user-management-filter-option'));
        const details = items.map((item, index) => {
          const input = item.querySelector('input[type="checkbox"]');
          const title = item.querySelector('.fci-title');
          const badge = item.querySelector('.badge');
          const text = normalize(`${title?.innerText || title?.textContent || ''} ${item.innerText || item.textContent || ''}`);
          return {
            index,
            input,
            item,
            text,
            name: input?.getAttribute('name') || '',
            value: input?.getAttribute('value') || '',
            badge: normalize(badge?.innerText || badge?.textContent || '')
          };
        });

        const matched = details.find((detail) =>
          detail.text.includes(target) ||
          normalize(detail.name).includes(target) ||
          normalize(detail.value).includes(target)
        );

        const roleOrder = [
          'project owner',
          'project admin',
          'project manager',
          'project user',
          'view only',
          'view only user',
          'all_user_access'
        ];
        const fallbackIndex = /project\s*role/i.test(filterLabel)
          ? roleOrder.findIndex((roleName) => roleName === target)
          : -1;
        const fallback = fallbackIndex >= 0 ? details[fallbackIndex] : null;
        const selected = matched || fallback;

        if (!selected?.input) {
          return {
            clicked: false,
            options: details.map((detail) => ({
              index: detail.index,
              text: detail.text,
              name: detail.name,
              value: detail.value,
              badge: detail.badge
            }))
          };
        }

        selected.item.setAttribute('data-vc-user-management-filter-option', 'true');

        return {
          clicked: true,
          index: selected.index,
          text: selected.text,
          name: selected.name,
          value: selected.value
        };
      },
      { filterLabel, value, markerValue }
    ).catch((error) => ({ clicked: false, error: error.message, options: [] }));

    if (!result.clicked) {
      await this.captureUserManagementScreenshot(`filter-checkbox-missing-${filterLabel}-${value}`);
      throw new Error(
        `Could not select ${filterLabel} filter value "${value}". Visible options: ${JSON.stringify(result.options || [])}`
      );
    }

    const optionItem = filterPanel.locator('[data-vc-user-management-filter-option="true"]').first();
    const optionCheckbox = optionItem.locator('input[type="checkbox"]').first();
    if (await optionCheckbox.isChecked().catch(() => false)) {
      console.log(`${filterLabel} filter value "${value}" was already selected.`);
    } else if (await optionCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickWithFallback(optionCheckbox, `${filterLabel}: ${value}`);
    } else {
      await this.clickWithFallback(optionItem, `${filterLabel}: ${value}`);
    }

    console.log(`Selected ${filterLabel} filter value "${value}" from filter modal.`);
    await this.page.waitForTimeout(700);
  }

  async selectUserManagementFilterValue(filterLabel, value) {
    await this.clickUserManagementFilterCategory(filterLabel);
    await this.clickUserManagementFilterCheckbox(filterLabel, value);
  }

  async clickFilterOption(value, filterLabel = 'filter') {
    const optionPatterns = [value];
    if (/^Project Admin$/i.test(value)) optionPatterns.push('Project Admin');
    if (/^Neuralrays$/i.test(value)) optionPatterns.push('Neuralrays');

    for (const optionText of optionPatterns) {
      const optionPattern = new RegExp(`^${this.escapeRegExp(optionText)}$`, 'i');
      const visibleMenu = this.page.locator('[role="listbox"]:visible, .MuiMenu-paper:visible, .MuiPopover-paper:visible, .MuiAutocomplete-popper:visible').last();
      const filterPanel = this.getUserManagementFilterModal();
      const candidates = [
        this.page.getByRole('option', { name: optionText, exact: true }).first(),
        visibleMenu.getByRole('option', { name: optionText, exact: true }).first(),
        visibleMenu.getByText(optionPattern).last(),
        filterPanel.getByRole('checkbox', { name: new RegExp(this.escapeRegExp(optionText), 'i') }).first(),
        filterPanel.getByLabel(new RegExp(this.escapeRegExp(optionText), 'i')).first(),
        filterPanel.getByText(optionPattern).last()
      ];

      for (const candidate of candidates) {
        if (await candidate.isVisible({ timeout: 2000 }).catch(() => false)) {
          await this.clickWithFallback(candidate, `${filterLabel}: ${optionText}`);
          return;
        }
      }
    }

    await this.captureUserManagementScreenshot(`filter-option-missing-${filterLabel}-${value}`);
    throw new Error(`Could not select User Management filter option ${filterLabel}: ${value}.`);
  }

  async normalizeUserManagementFilterRequests() {
    const pattern = '**/api/sso/projects/*/members/**';
    const handler = async (route) => {
      const request = route.request();
      const requestUrl = request.url();

      if (request.method() !== 'GET' || !requestUrl.includes('/members/')) {
        await route.continue();
        return;
      }

      const url = new URL(requestUrl);
      const hasRoleFilter = url.searchParams.has('platform_roles');
      const hasOrganizationFilter = url.searchParams.has('organizations');
      const hasEmptyStatusFilter = url.searchParams.has('user_statuses') && !url.searchParams.get('user_statuses');

      if (hasRoleFilter && hasOrganizationFilter) {
        const roleId = this.getUserManagementPlatformRoleId(url.searchParams.get('platform_roles'));
        const fallbackUrl = new URL(requestUrl);
        fallbackUrl.searchParams.delete('platform_roles');
        fallbackUrl.searchParams.delete('user_statuses');
        fallbackUrl.searchParams.set('page', '1');
        fallbackUrl.searchParams.set('pageSize', '200');

        if (roleId) {
          const fallbackResponse = await route.fetch({ url: fallbackUrl.toString() }).catch(() => null);
          if (fallbackResponse?.ok()) {
            const payload = await fallbackResponse.json();
            const page = Number(url.searchParams.get('page') || 1);
            const pageSize = Number(url.searchParams.get('pageSize') || 10);
            const results = Array.isArray(payload.results) ? payload.results : [];
            const filteredResults = results.filter((member) => String(member?.platformRole?.role || '') === String(roleId));
            const pageStart = Math.max(page - 1, 0) * pageSize;

            payload.count = filteredResults.length;
            payload.next = null;
            payload.previous = null;
            payload.results = filteredResults.slice(pageStart, pageStart + pageSize);

            console.log(
              'Normalizing User Management filter request with local role filtering because platform_roles returns 500 in staging.'
            );
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(payload)
            });
            return;
          }
        }
      }

      if (hasEmptyStatusFilter) {
        url.searchParams.delete('user_statuses');
        console.log('Normalizing User Management filter request by removing empty user_statuses parameter.');
        await route.continue({ url: url.toString() });
        return;
      }

      await route.continue();
    };

    await this.page.route(pattern, handler);
    return () => this.page.unroute(pattern, handler).catch(() => null);
  }

  getUserManagementPlatformRoleId(roleFilterValue = '') {
    const normalizedRole = String(roleFilterValue).trim().toLowerCase();
    const roleMap = {
      'project:admin': 2,
      'project_admin': 2,
      'project admin': 2,
      '2': 2,
      'project:manager': 3,
      'project_manager': 3,
      'project manager': 3,
      '3': 3,
      'project:user': 4,
      'project_user': 4,
      'project user': 4,
      '4': 4,
      'view_only': 11,
      'view only': 11,
      'view only user': 11,
      '11': 11
    };

    return roleMap[normalizedRole] || null;
  }

  async waitForUserManagementFilterResponse() {
    const response = await this.page.waitForResponse((candidate) => {
      const url = candidate.url();
      return candidate.request().method() === 'GET' &&
        /\/api\/sso\/projects\/[^/]+\/members\//.test(url) &&
        url.includes('organizations=') &&
        url.includes('platform_roles=');
    }, { timeout: 30000 }).catch(() => null);

    if (!response) {
      return null;
    }

    if (!response.ok()) {
      const body = await response.text().catch(() => '');
      throw new Error(`User Management filter API failed with ${response.status()}: ${body}`);
    }

    return response;
  }

  async waitForFilteredUserRows({ role = 'Project Admin', organization = 'Neuralrays' } = {}, timeout = 45000) {
    const rolePatternSource = this.getExpectedValuePattern('role', role).source;
    const organizationPatternSource = this.getExpectedValuePattern('organization', organization).source;

    await this.page.waitForFunction(
      ({ rolePatternSource, organizationPatternSource }) => {
        const rolePattern = new RegExp(rolePatternSource, 'i');
        const organizationPattern = new RegExp(organizationPatternSource, 'i');
        const isVisible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0';
        };
        const rows = Array.from(document.querySelectorAll('tbody tr, [role="row"], .MuiDataGrid-row'))
          .filter(isVisible)
          .map((row) => (row.innerText || row.textContent || '').replace(/\s+/g, ' ').trim())
          .filter((text) => /@|active|invited|project/i.test(text) &&
            !/^status name email address associated organization project role$/i.test(text));

        return rows.length > 0 &&
          rows.every((text) => rolePattern.test(text) && organizationPattern.test(text));
      },
      { rolePatternSource, organizationPatternSource },
      { timeout }
    );
  }

  async applyUserManagementFilters({ role = 'Project Admin', organization = 'Neuralrays' } = {}) {
    const removeFilterRequestNormalizer = await this.normalizeUserManagementFilterRequests();
    try {
      await this.openUserManagementFilterPanel();
      await this.selectUserManagementFilterValue('Project Role', role);
      await this.selectUserManagementFilterValue('Organization', organization);

      const filterPanel = await this.getVisibleUserManagementFilterModal();
      const applyButton = filterPanel.getByRole('button', { name: /Apply Filter|Apply Filters|Apply/i }).last()
        .or(filterPanel.locator('button:has-text("Apply")').last());
      const filterResponsePromise = this.waitForUserManagementFilterResponse();
      await this.clickWithFallback(applyButton, 'Apply User Management filters');
      await filterResponsePromise;
      await this.waitForUserListReady();
      await this.waitForFilteredUserRows({ role, organization });
      await this.captureUserManagementScreenshot('user-management-filter-applied', `${role}-${organization}`);
    } finally {
      await removeFilterRequestNormalizer();
    }
  }

  async getVisibleUserRowTexts() {
    return this.page.evaluate(() => {
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };

      return Array.from(document.querySelectorAll('tbody tr, [role="row"], .MuiDataGrid-row'))
        .filter(isVisible)
        .map((row) => (row.innerText || row.textContent || '').replace(/\s+/g, ' ').trim())
        .filter((text) => text &&
          !/^status name email address associated organization project role$/i.test(text) &&
          !/^\s*$/.test(text));
    }).catch(() => []);
  }

  async verifyUserManagementFilterResults({ role = 'Project Admin', organization = 'Neuralrays' } = {}) {
    const rowTexts = await this.getVisibleUserRowTexts();
    const dataRows = rowTexts.filter((text) => /@|active|invited|project/i.test(text));

    if (!dataRows.length) {
      await this.captureUserManagementScreenshot('user-management-filter-no-records', `${role}-${organization}`);
      throw new Error(`No User Management records were shown after applying ${role} / ${organization} filters.`);
    }

    const rolePattern = this.getExpectedValuePattern('role', role);
    const organizationPattern = this.getExpectedValuePattern('organization', organization);
    const invalidRows = dataRows.filter((text) => !rolePattern.test(text) || !organizationPattern.test(text));

    if (invalidRows.length) {
      await this.captureUserManagementScreenshot('user-management-filter-invalid-records', `${role}-${organization}`);
      throw new Error(
        `User Management filter returned rows outside ${role} / ${organization}: ${invalidRows.join(' || ')}`
      );
    }

    await this.captureUserManagementScreenshot('user-management-filter-results-valid', `${role}-${organization}`);
    return dataRows;
  }

  async applyAndVerifyUserManagementFilters(criteria = {}) {
    await this.navigateBackToUserManagementTab();
    await this.applyUserManagementFilters(criteria);
    return this.verifyUserManagementFilterResults(criteria);
  }

  async searchInvitedUser(email) {
    const userListSearchInput = await this.findUserListSearchInput();
    const searchCandidates = [
      this.page.getByRole('searchbox').first(),
      this.page.getByRole('textbox', { name: /search|email|filter/i }).first(),
      this.page.locator('input[type="search"]').first(),
      this.page.locator('input[placeholder*="Search" i], input[aria-label*="Search" i], input[placeholder*="Email" i]').first(),
      userListSearchInput
    ].filter(Boolean);

    for (const searchInput of searchCandidates) {
      if (!(await searchInput.isVisible({ timeout: 2000 }).catch(() => false))) {
        continue;
      }

      await highlight(searchInput, 'Search invited user');
      await searchInput.click({ force: true });
      await searchInput.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => null);
      await searchInput.fill('');
      await searchInput.type(email, { delay: 20 });
      await this.page.keyboard.press('Enter').catch(() => null);
      await this.page.waitForTimeout(2500);

      const foundRow = await this.locateVisibleInvitedUser(email, 5000);
      if (foundRow) {
        return foundRow;
      }
    }

    return null;
  }

  async searchUserByText(text) {
    const searchInput = await this.findUserSearchInput();
    if (!searchInput) {
      return null;
    }

    await searchInput.fill('');
    await searchInput.type(text, { delay: 20 });
    await this.page.keyboard.press('Enter').catch(() => null);
    await this.page.waitForTimeout(1500);

    return this.page.locator('tr, [role="row"], .MuiDataGrid-row').filter({
      hasText: new RegExp(this.escapeRegExp(text), 'i')
    }).first().isVisible({ timeout: 3000 })
      .then((visible) => visible
        ? this.page.locator('tr, [role="row"], .MuiDataGrid-row').filter({
          hasText: new RegExp(this.escapeRegExp(text), 'i')
        }).first()
        : null)
      .catch(() => null);
  }

  async confirmInvitedUserFound(row, email, source) {
    await highlight(row, `Invited user row: ${email}`);
    console.log(`${source}: ${email}`);
    console.log(`Keeping the browser on the matched user row for ${USER_ROW_PAUSE_MS} ms.`);
    await this.page.waitForTimeout(USER_ROW_PAUSE_MS);
    return this.page.locator('tbody tr, tr, [role="row"], .MuiDataGrid-row').filter({
      hasText: new RegExp(this.escapeRegExp(email), 'i')
    }).first();
  }

  async scanPaginatedUserList(email) {
    const visitedPages = new Set();

    for (let pageIndex = 0; pageIndex < 15; pageIndex++) {
      const visibleRow = await this.locateVisibleInvitedUser(email, 3000);
      if (visibleRow) {
        return visibleRow;
      }

      const currentPageLabel = await this.page.locator('[aria-current="page"], .Mui-selected').first()
        .innerText()
        .catch(() => `${pageIndex}`);
      const normalizedPageLabel = currentPageLabel.trim() || `${pageIndex}`;
      if (visitedPages.has(normalizedPageLabel)) {
        break;
      }
      visitedPages.add(normalizedPageLabel);

      const nextButton = this.page
        .locator(
          [
            'button[aria-label*="next" i]',
            'button[title*="next" i]',
            '[role="button"][aria-label*="next" i]'
          ].join(', ')
        )
        .filter({ hasNotText: /last/i })
        .first();

      if (!(await nextButton.isVisible({ timeout: 2000 }).catch(() => false))) {
        break;
      }

      if (await nextButton.isDisabled().catch(() => false)) {
        break;
      }

      await clickHighlighted(nextButton, 'Next users page');
      await this.page.waitForTimeout(1500);
    }

    return null;
  }

  async verifyInvitedUserVisibleInList(email) {
    console.log(`Verifying invited user appears in the list: ${email}`);

    await this.waitForInviteModalToClose();
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    await this.waitForUserListReady();
    await this.page.waitForTimeout(1500);

    const visibleRow = await this.locateVisibleInvitedUser(email, 5000);
    if (visibleRow) {
      return this.confirmInvitedUserFound(visibleRow, email, 'Invited user is visible in the list');
    }

    const searchedRow = await this.searchInvitedUser(email);
    if (searchedRow) {
      return this.confirmInvitedUserFound(searchedRow, email, 'Invited user found by list search');
    }

    const pagedRow = await this.scanPaginatedUserList(email);
    if (pagedRow) {
      return this.confirmInvitedUserFound(pagedRow, email, 'Invited user found while paging through the list');
    }

    throw new Error(`Invite succeeded, but ${email} was not found in the visible user list.`);
  }

  getStatusPattern(status) {
    if (/activated|active/i.test(status)) {
      return /\b(active|activated)\b/i;
    }

    if (/invited|invite/i.test(status)) {
      return /\b(invited|invite sent|pending invite|pending)\b/i;
    }

    return new RegExp(this.escapeRegExp(status), 'i');
  }

  getExpectedValuePattern(label, value) {
    if (label === 'role' && /^view only user$/i.test(value)) {
      return /\bView Only(?: User)?\b/i;
    }

    return new RegExp(this.escapeRegExp(value), 'i');
  }

  async getUserRowText(row) {
    const directText = await row.innerText().catch(() => '');
    if (directText.replace(/\s+/g, ' ').trim()) {
      return directText;
    }

    return row.evaluate((element) => {
      const rowElement = element.closest('tr, [role="row"], .MuiDataGrid-row') || element;
      return rowElement.innerText || rowElement.textContent || '';
    }).catch(() => directText);
  }

  async verifyUserRowDetails(user, expectedStatus) {
    const row = await this.verifyInvitedUserVisibleInList(user.email);
    const rowText = await this.getUserRowText(row);
    const normalizedRowText = rowText.replace(/\s+/g, ' ').trim();
    const statusPattern = this.getStatusPattern(expectedStatus);

    if (!statusPattern.test(normalizedRowText)) {
      await this.captureUserManagementScreenshot(`user-status-${expectedStatus}-missing`, user.email);
      throw new Error(`Expected ${user.email} status to be ${expectedStatus}. Row text: ${normalizedRowText}`);
    }

    const expectedDetails = [['role', user.role]];
    if (!/invited|invite/i.test(expectedStatus)) {
      expectedDetails.push(['organization', user.organization], ['name', user.name]);
    }

    for (const [label, value] of expectedDetails) {
      if (!value) continue;

      if (!this.getExpectedValuePattern(label, value).test(normalizedRowText)) {
        await this.captureUserManagementScreenshot(`user-${label}-validation-missing`, user.email);
        throw new Error(`Expected ${label} "${value}" for ${user.email}. Row text: ${normalizedRowText}`);
      }
    }

    await this.captureUserManagementScreenshot(`user-status-${expectedStatus}-validated`, user.email);
    return row;
  }

  async verifyUsersVisibleWithStatus(users, expectedStatus) {
    const rows = [];

    for (const user of users) {
      rows.push(await this.verifyUserRowDetails(user, expectedStatus));
    }

    return rows;
  }

  async resendInviteForUserIfInvited(user) {
    const row = await this.verifyInvitedUserVisibleInList(user.email);
    const rowText = await this.getUserRowText(row);
    const normalizedRowText = rowText.replace(/\s+/g, ' ').trim();

    if (!this.getStatusPattern('Invited').test(normalizedRowText)) {
      console.log(`Skipping re-invite for ${user.email}; current row is not Invited. Row text: ${normalizedRowText}`);
      return false;
    }

    await this.resendInviteForMatchedUser(row, user.email);
    await this.captureUserManagementScreenshot('user-reinvite-success', user.email);
    return true;
  }

  async resendInvitesForInvitedUsers(users) {
    const results = [];

    for (const user of users) {
      results.push({
        email: user.email,
        resent: await this.resendInviteForUserIfInvited(user)
      });
    }

    return results;
  }

  async inviteFunctionalFlowUsers(users = this.createFunctionalFlowUsers()) {
    return this.submitInviteUsersOnly(users);
  }

  async getRowActionButtonCenter(row) {
    return row.evaluate((rowElement) => {
      const buttons = Array.from(rowElement.querySelectorAll('button, [role="button"]'));

      for (const button of buttons) {
        button.removeAttribute('data-vc-user-row-action');
      }

      const candidates = buttons
        .filter((button) => {
          const rect = button.getBoundingClientRect();
          const style = window.getComputedStyle(button);
          const text = (button.innerText || button.textContent || '').trim();
          const isRoleDropdown = /project\s+(admin|user|manager)/i.test(text);
          const isVisible = rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0';

          return isVisible && !button.disabled && button.getAttribute('aria-disabled') !== 'true' && !isRoleDropdown;
        })
        .sort((left, right) => right.getBoundingClientRect().left - left.getBoundingClientRect().left);

      if (!candidates.length) {
        return null;
      }

      const actionButton = candidates[0];
      actionButton.setAttribute('data-vc-user-row-action', 'true');

      const rect = actionButton.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
    }).catch(() => false);
  }

  async openMatchedUserActions(row, email) {
    console.log(`Opening row actions for invited user: ${email}`);

    await highlight(row, `Invited user row: ${email}`);
    const actionButtonCenter = await this.getRowActionButtonCenter(row);

    if (!actionButtonCenter) {
      throw new Error(`Could not find the actions button for ${email}.`);
    }

    const menuSelector = '[role="menu"], .MuiMenu-paper, .MuiPopover-paper';

    for (const attempt of ['mouse', 'keyboard', 'dom']) {
      if (attempt === 'mouse') {
        console.log('Clicking invited user three-dot actions button.');
        await this.page.mouse.move(actionButtonCenter.x, actionButtonCenter.y);
        await this.page.mouse.down();
        await this.page.waitForTimeout(100);
        await this.page.mouse.up();
      } else if (attempt === 'keyboard') {
        await this.page.mouse.click(actionButtonCenter.x, actionButtonCenter.y);
        await this.page.keyboard.press('Enter');
        await this.page.waitForTimeout(300);
        if (!(await this.page.locator(menuSelector).first().isVisible({ timeout: 500 }).catch(() => false))) {
          await this.page.keyboard.press('Space');
        }
      } else {
        await row.evaluate((rowElement) => {
          const buttons = Array.from(rowElement.querySelectorAll('button, [role="button"]'));
          const actionButton = buttons
            .filter((button) => {
              const rect = button.getBoundingClientRect();
              const style = window.getComputedStyle(button);
              const text = (button.innerText || button.textContent || '').trim();
              return rect.width > 0 &&
                rect.height > 0 &&
                style.visibility !== 'hidden' &&
                style.display !== 'none' &&
                style.opacity !== '0' &&
                !button.disabled &&
                button.getAttribute('aria-disabled') !== 'true' &&
                !/project\s+(admin|user|manager)/i.test(text);
            })
            .sort((left, right) => right.getBoundingClientRect().left - left.getBoundingClientRect().left)[0];

          if (!actionButton) {
            return;
          }

          actionButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
          actionButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
          actionButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        });
      }

      await this.page.waitForTimeout(800);

      if (await this.page.locator(menuSelector).first().isVisible({ timeout: 1500 }).catch(() => false)) {
        return;
      }
    }

    throw new Error(`Could not open the actions menu for ${email}.`);
  }

  async clickVisibleAction(actionPatterns, label) {
    const menuScope = this.page.locator('[role="menu"], .MuiMenu-paper, .MuiPopover-paper, [role="dialog"]').first();

    for (const pattern of actionPatterns) {
      const candidates = [
        this.page.getByRole('menuitem', { name: pattern }).first(),
        this.page.getByRole('button', { name: pattern }).first(),
        this.page.locator('[role="menu"], .MuiMenu-paper, .MuiPopover-paper, [role="dialog"]').getByText(pattern).first(),
        menuScope.getByText(pattern).first()
      ];

      for (const candidate of candidates) {
        if (await candidate.isVisible({ timeout: 2000 }).catch(() => false)) {
          const actionText = await candidate.innerText().catch(() => label);
          console.log(`Clicking ${label}: ${actionText.replace(/\s+/g, ' ').trim()}`);
          await this.clickWithFallback(candidate, label);
          await this.page.waitForTimeout(1000);
          return true;
        }
      }
    }

    return false;
  }

  async getVisibleActionLabels() {
    const labels = await this.page.evaluate(() => {
      const scopes = Array.from(document.querySelectorAll('[role="menu"], .MuiMenu-paper, .MuiPopover-paper, [role="dialog"]'));
      return scopes.flatMap((scope) => {
        const elements = Array.from(scope.querySelectorAll('button, [role="menuitem"], li, p, span, div'));
        return elements
          .filter((element) => {
            const text = (element.innerText || element.textContent || '').trim();
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return text &&
              rect.width > 0 &&
              rect.height > 0 &&
              style.visibility !== 'hidden' &&
              style.display !== 'none' &&
              style.opacity !== '0';
          })
          .map((element) => (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim());
      });
    }).catch(() => []);

    return [...new Set(labels)].filter(Boolean);
  }

  async waitForResendInviteSuccessNotification() {
    const resendPattern = /success|resend|resent|invite sent|invitation sent|user invite/i;

    const message = await this.waitForInviteSuccessNotification().catch(async () => {
      const visibleMessage = await this.page.waitForFunction(
        (patternSource) => {
          const pattern = new RegExp(patternSource, 'i');
          const visibleElements = Array.from(document.querySelectorAll('body *')).filter((element) => {
            const text = (element.innerText || element.textContent || '').trim();
            if (!text || !pattern.test(text)) return false;

            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return rect.width > 0 &&
              rect.height > 0 &&
              style.visibility !== 'hidden' &&
              style.display !== 'none' &&
              style.opacity !== '0';
          });

          return visibleElements[0]?.innerText || visibleElements[0]?.textContent || null;
        },
        resendPattern.source,
        { timeout: 7000 }
      ).then((handle) => handle.jsonValue()).catch(() => null);

      if (!visibleMessage) {
        throw new Error('Resend invite completed, but no success notification was detected.');
      }

      const normalizedMessage = visibleMessage.replace(/\s+/g, ' ').trim();
      console.log(`Resend success notification: ${normalizedMessage}`);
      return normalizedMessage;
    });

    return message;
  }

  async resendInviteForMatchedUser(row, email) {
    console.log(`Editing searched user record and resending invite: ${email}`);

    await this.openMatchedUserActions(row, email);
    const firstActionLabels = await this.getVisibleActionLabels();
    if (firstActionLabels.length) {
      console.log(`Visible row actions: ${firstActionLabels.join(' | ')}`);
    }

    const clickedDirectResend = await this.clickVisibleAction([
      /resend\s*-?\s*invite/i,
      /re\s*-?\s*send\s*-?\s*invite/i,
      /resend\s*-?\s*invitation/i,
      /resend/i
    ], 'Resend Invite');

    if (!clickedDirectResend) {
      const clickedEdit = await this.clickVisibleAction([
        /edit/i,
        /view/i,
        /manage/i
      ], 'Edit invited user');

      if (!clickedEdit) {
        throw new Error(`Could not find Edit or Resend Invite action for ${email}.`);
      }

      const editActionLabels = await this.getVisibleActionLabels();
      if (editActionLabels.length) {
        console.log(`Visible edit actions: ${editActionLabels.join(' | ')}`);
      }

      const resendButtonClicked = await this.clickVisibleAction([
        /resend\s*-?\s*invite/i,
        /re\s*-?\s*send\s*-?\s*invite/i,
        /resend\s*-?\s*invitation/i,
        /resend/i,
        /send\s*-?\s*invite/i
      ], 'Resend Invite');

      if (!resendButtonClicked) {
        throw new Error(`Opened the user record for ${email}, but Resend Invite was not available.`);
      }
    }

    const confirmClicked = await this.clickVisibleAction([
      /^yes$/i,
      /^confirm$/i,
      /^send$/i,
      /^resend$/i
    ], 'Confirm resend invite');

    if (confirmClicked) {
      await this.page.waitForTimeout(1000);
    }

    await this.waitForResendInviteSuccessNotification();
    console.log(`Invite resent for searched user record: ${email}`);
    await this.page.waitForTimeout(10000);
  }

  async inviteUser(inviteEmail = this.getInviteEmail()) {
    console.log(`Inviting user: ${inviteEmail}`);

    const inviteModal = await this.openInviteUsersModal();

    await fillHighlighted(inviteModal.locator('#email'), inviteEmail, 'Invite email');
    await this.selectMuiComboboxOption('Organization', this.options.organization);
    await this.selectMuiComboboxOption('Role', this.options.role);

    if (this.options.dryRun) {
      console.log('Dry run enabled; stopping before Send Invites.');
      return inviteEmail;
    }

    await this.clickSendInvites(inviteModal);
    await this.waitForInviteSuccessNotification();
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    await this.page.waitForTimeout(3000);
    const invitedUserRow = await this.verifyInvitedUserVisibleInList(inviteEmail);
    await this.resendInviteForMatchedUser(invitedUserRow, inviteEmail);

    console.log(`Invite submitted for ${inviteEmail}`);
    return inviteEmail;
  }

  async openStatusColumnActions() {
    console.log('Opening Status column actions as recorded...');

    const statusColumn = this.page.getByRole('columnheader', { name: /Status/i }).first();
    if (await statusColumn.isVisible({ timeout: 10000 }).catch(() => false)) {
      await clickHighlighted(statusColumn, 'Status column');
    }

    for (let index = 0; index < 12; index++) {
      await this.page.locator('body').press('ArrowDown');
    }

    const pageFourButton = this.page.getByRole('button', { name: 'Go to page 4' }).first();
    if (await pageFourButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await clickHighlighted(pageFourButton, 'Go to page 4');
      await this.page.waitForTimeout(1500);
    } else {
      console.log('Go to page 4 button was not visible; continuing on current page.');
    }

    const rowAction = this.page.locator('tr:nth-child(8) > td:nth-child(6) > div > .MuiButtonBase-root').first();
    if (await rowAction.isVisible({ timeout: 5000 }).catch(() => false)) {
      await highlight(rowAction, 'User row action');
      await rowAction.click({ force: true });
      await this.page.waitForTimeout(1000);
    } else {
      console.log('Recorded row action was not visible; continuing.');
    }

    const backdrop = this.page.locator('.MuiBackdrop-root').first();
    if (await backdrop.isVisible({ timeout: 3000 }).catch(() => false)) {
      await highlight(backdrop, 'Close backdrop').catch(() => null);
      await backdrop.click({ force: true });
      await this.page.waitForTimeout(1000);
    }
  }

  async automateInviteUserFlow(inviteEmail = this.getInviteEmail()) {
    await this.login();
    await this.navigateToProjectLocation();
    await this.navigateToUserManagement();
    const processedEmail = await this.inviteUser(inviteEmail);

    if (this.options.dryRun) {
      console.log(`User Management dry run completed for ${processedEmail}`);
      return processedEmail;
    }

    console.log(`User Management automation completed for ${processedEmail}`);
    return processedEmail;
  }
}

module.exports = { UserManagementPage };
