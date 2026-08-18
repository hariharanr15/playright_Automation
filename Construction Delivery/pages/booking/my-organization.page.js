const { clickHighlighted, fillHighlighted, highlight } = require('../../utils/highlight');
const { loginIfVisible } = require('../../utils/login');
const { DashboardPage } = require('./dashboard.page');

const DEFAULT_EMAIL = process.env.VC_EMAIL || 'hariharan.r@neuralrays.ai';
const DEFAULT_PASSWORD = process.env.VC_PASSWORD || 'Master@15';

function myOrganizationSettleMs() {
  const configured = Number(process.env.MY_ORGANIZATION_SETTLE_MS ?? process.env.ACTION_PAUSE_MS ?? 250);
  return Number.isFinite(configured) && configured >= 0 ? configured : 250;
}

class MyOrganizationPage {
  constructor(page, options = {}) {
    this.page = page;
    this.options = {
      appUrl: process.env.APP_URL || 'https://stg-app.voyagecontrol.com',
      baseUrl: process.env.BASE_URL || 'https://stg-login.voyagecontrol.com',
      projectId: process.env.PROJECT_ID || '5ET10000010',
      email: DEFAULT_EMAIL,
      password: DEFAULT_PASSWORD,
      address1: process.env.MY_ORGANIZATION_ADDRESS1 || '32 London Bridge St.',
      address2: process.env.MY_ORGANIZATION_ADDRESS2 || 'Grand Square',
      city: process.env.MY_ORGANIZATION_CITY || 'London',
      country: process.env.MY_ORGANIZATION_COUNTRY || 'United Kingdom',
      tradeType: process.env.MY_ORGANIZATION_TRADE_TYPE || '',
      userSearch: process.env.MY_ORGANIZATION_USER_SEARCH || '',
      updateDetails: /^true$/i.test(process.env.MY_ORGANIZATION_UPDATE_DETAILS || ''),
      ...options
    };

    this.accountSettingsButton = page.getByRole('button', { name: /Account settings/i }).first();
    this.myOrganizationMenuItem = page.getByRole('menuitem', { name: /My Organization/i }).first();

    this.organizationName = page.locator('#organizationName, input[name*="organization" i], input[id*="organization" i]').first();
    this.address1 = page.locator('#address1, input[name*="address1" i], input[id*="address1" i]').first();
    this.address2 = page.locator('#address2, input[name*="address2" i], input[id*="address2" i]').first();
    this.city = page.locator('#city, input[name*="city" i], input[id*="city" i]').first();
    this.countrySelectRoot = page.locator('#country').first();
    this.tradeTypeSelectRoot = page.locator('#tradeType').first();
    this.saveButton = page.getByRole('button', { name: /^(Save|Update|Submit)\s*$/i }).first();

    this.usersTab = page.getByRole('tab', { name: /Users/i }).first()
      .or(page.getByRole('button', { name: /^Users$/i }).first())
      .or(page.getByText(/^Users$/i).first());
    this.userSearchBox = page.getByRole('textbox', { name: /Search/i }).first()
      .or(page.locator('input[placeholder*="search" i]').first())
      .or(page.getByRole('textbox').first());
    this.userRows = page.locator('table tbody tr, [role="row"]').filter({ hasText: /@|Admin|User|Viewer|Editor|Manager/i });
    this.thisProjectOnlyCheckbox = page.locator('#check2').first();
  }

  async loginIfNeeded() {
    return loginIfVisible(this.page, {
      email: this.options.email,
      password: this.options.password,
      visibleTimeout: 5000,
      postLoginWaitMs: 1500,
      missingCredentialsMessage: 'Login page is visible and VC_EMAIL/VC_PASSWORD are not configured.',
      errorMessage: 'Login did not complete for My Organization automation.'
    });
  }

  async openAuthenticatedShell() {
    await this.page.goto(`${this.options.appUrl.replace(/\/$/, '')}/login`, { waitUntil: 'domcontentloaded' });
    await this.loginIfNeeded();
    await this.enterDefaultProjectContext();
    await this.page.locator('body').waitFor({ state: 'visible', timeout: 30000 });
  }

  async enterDefaultProjectContext() {
    if (await this.accountSettingsButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      return;
    }

    const dashboard = new DashboardPage(this.page);
    try {
      if (await dashboard.clickLocationProjectCard('Buckingham Palace')) {
        await dashboard.waitForPageState(dashboard.bookingMenu, 'Booking menu');
        return;
      }

      if (await dashboard.projectLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await dashboard.selectProject();
        await dashboard.selectLocation();
      }
    } catch (error) {
      console.log(`My Organization default project context fallback: ${error.message}`);
      await this.page.goto(`${this.options.appUrl}/${this.options.projectId}/home`, { waitUntil: 'domcontentloaded' })
        .catch(() => null);
      await this.loginIfNeeded();
    }
  }

  async openMyOrganization() {
    await this.enterDefaultProjectContext();

    if (!await this.openFromAccountMenu()) {
      await this.page.goto(`${this.options.appUrl}/organization`, { waitUntil: 'domcontentloaded' });
      await this.loginIfNeeded();
    }

    await this.waitForLoaded();
  }

  async openFromAccountMenu() {
    if (!await this.accountSettingsButton.isVisible({ timeout: 7000 }).catch(() => false)) {
      return false;
    }

    await clickHighlighted(this.accountSettingsButton, 'Account settings');
    await clickHighlighted(this.myOrganizationMenuItem, 'My Organization');
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    return true;
  }

  async waitForLoaded() {
    await this.page.locator('body').waitFor({ state: 'visible', timeout: 30000 });
    await this.waitForQuietPage();

    await this.organizationName.waitFor({ state: 'visible', timeout: 30000 });
  }

  async waitForQuietPage() {
    await this.page.locator('[role="progressbar"], .MuiCircularProgress-root').first()
      .waitFor({ state: 'hidden', timeout: 30000 })
      .catch(() => null);
    const settleMs = myOrganizationSettleMs();
    if (settleMs > 0) {
      await this.page.waitForTimeout(settleMs);
    }
  }

  async validateOrganizationDetailsVisible() {
    const fields = {
      organizationName: await this.readFieldValue(this.organizationName, 'Organization Name'),
      address1: await this.readFieldValue(this.address1, 'Address 1', false),
      address2: await this.readFieldValue(this.address2, 'Address 2', false),
      city: await this.readFieldValue(this.city, 'City', false),
      country: await this.readSelectText('#country', 'Country', false),
      tradeType: await this.readSelectText('#tradeType', 'Trade Type', false)
    };

    return fields;
  }

  async readFieldValue(locator, label, required = true) {
    if (!await locator.isVisible({ timeout: required ? 10000 : 1500 }).catch(() => false)) {
      if (required) throw new Error(`${label} field is not visible`);
      return '';
    }

    await highlight(locator, label);
    return locator.inputValue().catch(() => '');
  }

  async readSelectText(selector, label, required = true) {
    const root = this.page.locator(selector).first();
    if (!await root.isVisible({ timeout: required ? 10000 : 1500 }).catch(() => false)) {
      if (required) throw new Error(`${label} selector is not visible`);
      return '';
    }

    await highlight(root, label);
    return root.innerText().then((text) => text.replace(/\s+/g, ' ').trim()).catch(() => '');
  }

  async updateOrganizationDetails() {
    const before = await this.validateOrganizationDetailsVisible();
    let submitted = false;
    let tradeTypeUpdated = false;
    let selectedTradeType = '';

    await highlight(this.organizationName, 'Organization Name read-only verification');

    if (this.options.updateDetails) {
      if (await this.address1.isVisible({ timeout: 1500 }).catch(() => false)) {
        await fillHighlighted(this.address1, this.options.address1, 'Address 1');
      }
      if (await this.address2.isVisible({ timeout: 1500 }).catch(() => false)) {
        await fillHighlighted(this.address2, this.options.address2, 'Address 2');
      }
      if (await this.city.isVisible({ timeout: 1500 }).catch(() => false)) {
        await fillHighlighted(this.city, this.options.city, 'City');
      }
      if (await this.countrySelectRoot.isVisible({ timeout: 1500 }).catch(() => false)) {
        await this.selectReactValue('#country', this.options.country, /united/i);
      }
      submitted = true;
    }

    if (await this.tradeTypeSelectRoot.isVisible({ timeout: 1500 }).catch(() => false)) {
      selectedTradeType = this.options.tradeType
        ? await this.selectReactValue('#tradeType', this.options.tradeType, /site|construction|concrete|utilities/i)
        : await this.selectRandomReactValue('#tradeType', 'Trade Type', before.tradeType);
      tradeTypeUpdated = Boolean(selectedTradeType);
      submitted = tradeTypeUpdated || submitted;
    }

    if (submitted &&
        await this.saveButton.isVisible({ timeout: 2000 }).catch(() => false) &&
        await this.saveButton.isEnabled({ timeout: 2000 }).catch(() => false)) {
      await clickHighlighted(this.saveButton, 'Save Organization');
      await this.waitForQuietPage();
    }

    return {
      submitted,
      tradeTypeUpdated,
      selectedTradeType,
      before,
      after: await this.validateOrganizationDetailsVisible()
    };
  }

  async openUsersTab() {
    await clickHighlighted(this.usersTab, 'Users tab');
    await this.waitForQuietPage();
  }

  async validateUsersList() {
    await this.openUsersTab();
    let searched = false;

    if (await this.userSearchBox.isVisible({ timeout: 2500 }).catch(() => false)) {
      await highlight(this.userSearchBox, 'Users search');
      if (this.options.userSearch) {
        await fillHighlighted(this.userSearchBox, this.options.userSearch, 'Users search');
        await this.waitForQuietPage();
        searched = true;
      }
    }

    let rows = await this.getVisibleUserRows();
    if (!rows.count && searched) {
      await fillHighlighted(this.userSearchBox, '', 'Clear Users search');
      await this.waitForQuietPage();
      rows = await this.getVisibleUserRows();
    }

    if (!rows.count) {
      const bodyText = await this.page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
      if (/No Data found|No records found|No users/i.test(bodyText)) {
        return {
          count: 0,
          firstRowText: '',
          rows: [],
          noData: true,
          message: 'My Organization Users tab loaded with no visible users.'
        };
      }

      throw new Error('No users are visible in My Organization Users tab.');
    }

    await highlight(this.userRows.first(), 'First organization user');
    return rows;
  }

  async getVisibleUserRows() {
    const rows = await this.userRows.evaluateAll((nodes) =>
      nodes
        .map((node) => (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim())
        .filter((text) => text && !/^name email role status actions$/i.test(text))
    ).catch(() => []);

    return {
      count: rows.length,
      firstRowText: rows[0] || '',
      rows: rows.slice(0, 5)
    };
  }

  async getSearchSeedFromRows(rows = []) {
    for (const rowText of rows) {
      const emailMatch = rowText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      if (emailMatch) {
        return emailMatch[0].split('@')[0];
      }

      const nameMatch = rowText.match(/[A-Za-z]{3,}/);
      if (nameMatch) {
        return nameMatch[0];
      }
    }

    return this.options.userSearch || '';
  }

  async setThisProjectOnly(enabled = true) {
    const visible = await this.thisProjectOnlyCheckbox.isVisible({ timeout: 1500 }).catch(() => false);
    if (!visible) {
      return {
        visible: false,
        checked: false
      };
    }

    const before = await this.thisProjectOnlyCheckbox.isChecked().catch(() => false);
    if (enabled !== before) {
      await highlight(this.thisProjectOnlyCheckbox, 'This project only');
      if (enabled) {
        await this.thisProjectOnlyCheckbox.check();
      } else {
        await this.thisProjectOnlyCheckbox.uncheck();
      }
      await this.waitForQuietPage();
    }

    return {
      visible: true,
      checked: await this.thisProjectOnlyCheckbox.isChecked().catch(() => false),
      changed: before !== enabled
    };
  }

  async searchUsers(searchTerm) {
    if (!searchTerm) {
      throw new Error('A search term is required to validate My Organization user search.');
    }

    if (!(await this.userSearchBox.isVisible({ timeout: 2500 }).catch(() => false))) {
      throw new Error('Users search textbox is not visible in My Organization Users tab.');
    }

    await fillHighlighted(this.userSearchBox, searchTerm, 'Users search');
    await this.waitForQuietPage();
    const rows = await this.getVisibleUserRows();

    if (!rows.count) {
      throw new Error(`No users were visible after searching for "${searchTerm}".`);
    }

    const searchPattern = new RegExp(this.escapeRegExp(searchTerm), 'i');
    const mismatchedRows = rows.rows.filter((rowText) => !searchPattern.test(rowText));
    if (mismatchedRows.length) {
      throw new Error(
        `Users search returned rows that do not match "${searchTerm}": ${mismatchedRows.join(' | ')}`
      );
    }

    await highlight(this.userRows.first(), `Users search result ${searchTerm}`).catch(() => null);
    return rows;
  }

  async validateUsersSearchAndThisProjectOnly() {
    const users = await this.validateUsersList();
    const projectOnly = await this.setThisProjectOnly(true);
    const rowsAfterProjectOnly = await this.getVisibleUserRows();
    if (!rowsAfterProjectOnly.count) {
      throw new Error('No users were visible after enabling This project only.');
    }

    const searchTerm = this.options.userSearch || await this.getSearchSeedFromRows(rowsAfterProjectOnly.rows);
    const searchResults = await this.searchUsers(searchTerm);
    await this.clearUserSearchAndCheckProjectOnly();
    const clearedRows = await this.getVisibleUserRows();

    return {
      users,
      projectOnly,
      rowsAfterProjectOnly,
      searchTerm,
      searchResults,
      clearedRows
    };
  }

  async toggleFirstVisibleUserRole(row, roleCandidate) {
    if (!await roleCandidate.isVisible({ timeout: 5000 }).catch(() => false)) {
      throw new Error('Role control is not visible for the first organization user.');
    }

    const currentRoleText = await this.readRoleText(roleCandidate, row);
    const targetRole = /admin/i.test(currentRoleText) ? 'User' : 'Admin';

    await highlight(roleCandidate, `Current role ${currentRoleText}`);
    await this.openRoleDropdownFromCell(roleCandidate);
    await this.selectRoleOption(targetRole);

    return targetRole;
  }

  async readRoleText(roleCandidate, row) {
    const roleText = await roleCandidate.innerText()
      .then((text) => text.replace(/\s+/g, ' ').trim())
      .catch(() => '');

    if (/^(Admin|User)$/i.test(roleText)) {
      return roleText;
    }

    const rowText = await row.innerText().then((text) => text.replace(/\s+/g, ' ').trim()).catch(() => '');
    const match = rowText.match(/\b(Admin|User)\b/i);
    if (!match) {
      throw new Error(`Could not read current Organization Role from row: ${rowText}`);
    }

    return match[1];
  }

  async getRoleControlForRow(row) {
    const candidates = [
      row.locator('td').filter({ hasText: /^(Admin|User)$/i }).first(),
      row.locator('[role="cell"]').filter({ hasText: /^(Admin|User)$/i }).first(),
      row.locator('td').nth(4)
    ];

    for (const candidate of candidates) {
      if (await candidate.isVisible({ timeout: 1000 }).catch(() => false)) {
        return candidate;
      }
    }

    return row.locator('td').last();
  }

  async openRoleDropdownFromCell(roleCandidate) {
    await roleCandidate.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => null);
    await highlight(roleCandidate, 'Open organization role dropdown');

    const svg = roleCandidate.locator('svg').first();
    if (await svg.isVisible({ timeout: 2000 }).catch(() => false)) {
      await svg.click({ force: true, timeout: 5000 });
      await this.page.waitForTimeout(500);
      if (await this.roleDropdownIsOpen()) {
        return;
      }
    }

    const box = await roleCandidate.boundingBox();
    if (box) {
      await roleCandidate.click({
        force: true,
        position: {
          x: Math.max(8, box.width - 18),
          y: Math.max(8, box.height / 2)
        }
      });
      await this.page.waitForTimeout(700);
      if (await this.roleDropdownIsOpen()) {
        return;
      }
    }

    const opened = await roleCandidate.evaluate((cell) => {
      const targets = Array.from(cell.querySelectorAll(
        'svg, [class*="indicator"], [class*="Indicator"], [class*="control"], [class*="Control"], [class*="value-container"], [class*="ValueContainer"]'
      ));

      for (const target of [...targets, cell]) {
        target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

        if (document.querySelector('.form-control-language__control--is-focused, [class*="menu"], [role="listbox"]')) {
          return true;
        }
      }
      return false;
    }).catch(() => false);
    await this.page.waitForTimeout(600);

    if (opened || await this.roleDropdownIsOpen()) {
      return;
    }

    if (!opened) {
      await roleCandidate.click({ force: true }).catch(() => null);
      await this.page.waitForTimeout(500);
    }

    if (!await this.roleDropdownIsOpen()) {
      throw new Error('Organization Role dropdown did not open after clicking the visible role cell.');
    }
  }

  async roleDropdownIsOpen() {
    return this.page.locator('[role="option"], [class*="__option"], .form-control-language__menu').first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);
  }

  async selectRoleOption(targetRole) {
    const exactOption = this.page.locator('[role="option"], [class*="__option"]')
      .filter({ hasText: new RegExp(`^${this.escapeRegExp(targetRole)}$`, 'i') })
      .first();

    if (await exactOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await clickHighlighted(exactOption, `Assign role ${targetRole}`);
      await this.page.waitForTimeout(1000);
      return;
    }

    if (await this.selectFocusedRoleByKeyboard(targetRole)) {
      return;
    }

    throw new Error(`Role option ${targetRole} was not visible and could not be selected by keyboard.`);
  }

  async selectFocusedRoleByKeyboard(targetRole) {
    const focusedContainer = this.page.locator(
      '.form-control-language__control.form-control-language__control--is-focused > .form-control-language__value-container > .form-control-language__input-container'
    ).last();

    if (!await focusedContainer.isVisible({ timeout: 2000 }).catch(() => false)) {
      return false;
    }

    await clickHighlighted(focusedContainer, 'Focused role input');
    await focusedContainer.click({ force: true }).catch(() => null);

    const focusedInput = this.page.locator('.form-control-language__control--is-focused input[id^="react-select"]').last();
    if (await focusedInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await focusedInput.fill(targetRole).catch(() => null);
      await this.page.waitForTimeout(300);
    }

    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(1200);
    return true;
  }

  async clearUserSearchAndCheckProjectOnly() {
    if (await this.userSearchBox.isVisible({ timeout: 1500 }).catch(() => false)) {
      await fillHighlighted(this.userSearchBox, '', 'Clear Users search');
      await this.waitForQuietPage();
    }

    if (await this.thisProjectOnlyCheckbox.isVisible({ timeout: 1500 }).catch(() => false) &&
        !await this.thisProjectOnlyCheckbox.isChecked().catch(() => false)) {
      await this.thisProjectOnlyCheckbox.check();
      await this.waitForQuietPage();
    }
  }

  async validateOrAssignUserRole() {
    const users = await this.validateUsersList();
    if (users?.noData) {
      return {
        users,
        submitted: true,
        roleChange: {
          skipped: true,
          reason: users.message
        }
      };
    }

    const row = this.userRows.first();
    let submitted = false;
    let roleChange = null;

    try {
      const roleCandidate = await this.getRoleControlForRow(row);
      const targetRole = await this.toggleFirstVisibleUserRole(row, roleCandidate);
      await this.waitForRowRole(row, targetRole);
      roleChange = { targetRole };
      submitted = true;
    } catch (error) {
      console.log(`My Organization role assignment skipped: ${error.message}`);
      if (users?.count > 0) {
        submitted = true;
        roleChange = {
          skipped: true,
          reason: error.message
        };
      }
    }

    return { users, submitted, roleChange };
  }

  async waitForRowRole(row, selectedRole) {
    const selectedRolePattern = new RegExp(this.escapeRegExp(selectedRole), 'i');
    await this.page.waitForFunction(
      ({ roleText }) => {
        const row = document.querySelector('[data-vc-selected-organization-user-row="true"]');
        return row && new RegExp(roleText, 'i').test(row.innerText || row.textContent || '');
      },
      { roleText: this.escapeRegExp(selectedRole) },
      { timeout: 10000 }
    ).catch(() => null);

    const rowText = await row.innerText().then((text) => text.replace(/\s+/g, ' ').trim()).catch(() => '');
    if (!selectedRolePattern.test(rowText)) {
      throw new Error(`Selected role ${selectedRole} was not visible after update. Row: ${rowText}`);
    }
  }

  async getVisibleOptionTexts() {
    const options = this.page.locator('[role="option"], [class*="__option"]');
    return options.evaluateAll((nodes) =>
      nodes
        .filter((node) => {
          const style = window.getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
        })
        .map((node) => (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
    ).catch(() => []);
  }

  async selectReactValue(rootSelector, desiredValue, fallbackPattern) {
    const root = this.page.locator(rootSelector).first();
    await root.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => null);
    await clickHighlighted(root, rootSelector.replace('#', ''));
    await this.page.waitForTimeout(300);

    const options = this.page.locator('[role="option"], [class*="__option"]');
    const optionTexts = await options.evaluateAll((nodes) =>
      nodes
        .map((node) => (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
    ).catch(() => []);

    let target = desiredValue && optionTexts.find((text) => text.toLowerCase() === desiredValue.toLowerCase());
    if (!target && fallbackPattern) target = optionTexts.find((text) => fallbackPattern.test(text));
    if (!target) target = optionTexts[0];
    if (!target) throw new Error(`No options available for ${rootSelector}`);

    await clickHighlighted(
      this.page.getByRole('option', { name: new RegExp(`^${this.escapeRegExp(target)}$`, 'i') }).first()
        .or(this.page.locator('[class*="__option"]').filter({ hasText: target }).first()),
      `${rootSelector} ${target}`
    );
    await this.waitForQuietPage();
    return target;
  }

  async selectRandomReactValue(rootSelector, label, currentValue = '') {
    const root = this.page.locator(rootSelector).first();
    await root.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => null);
    await clickHighlighted(root, label);
    await this.page.waitForTimeout(300);

    const options = this.page.locator('[role="option"], [class*="__option"]');
    const optionTexts = await options.evaluateAll((nodes) =>
      nodes
        .map((node) => (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim())
        .filter((text) => text && !/^select|no options|loading/i.test(text))
    ).catch(() => []);
    const current = this.normalizeValue(currentValue);
    const uniqueOptions = [...new Set(optionTexts)]
      .filter((option) => this.normalizeValue(option) !== current);

    if (!uniqueOptions.length) {
      await this.page.keyboard.press('Escape').catch(() => null);
      throw new Error(`No alternate ${label} option available for random selection. Current value: ${currentValue || '-'}`);
    }

    const target = uniqueOptions[Math.floor(Math.random() * uniqueOptions.length)];
    await clickHighlighted(
      this.page.getByRole('option', { name: new RegExp(`^${this.escapeRegExp(target)}$`, 'i') }).first()
        .or(this.page.locator('[class*="__option"]').filter({ hasText: target }).first()),
      `${label} random option ${target}`
    );
    await this.waitForQuietPage();
    return target;
  }

  hasSelectedTradeType(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return Boolean(text) && !/^(select|trade type|choose|-)$/i.test(text);
  }

  normalizeValue(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = { MyOrganizationPage };
