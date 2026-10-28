const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');
const { FirstDeliveryInspectionConfigPage } = require('../project-management/first-delivery-inspection-config.page');

class UserManagementPage extends BasePage {
  constructor(page) {
    super(page);
    this.navigation = page.getByRole('button', { name: 'User Management', exact: true });
    this.searchInput = page.locator('input[placeholder^="Search users"]');
  }

  async open() {
    await this.navigation.first().waitFor({ state: 'visible', timeout: 30000 });
    if (!/\/user-management\/?$/.test(this.page.url())) {
      await this.navigation.first().click();
      await this.navigation.last().click();
    }
    await expect(this.page).toHaveURL(/\/user-management\/?$/);
    await expect(this.page.getByRole('button', { name: 'Invite Users' })).toBeVisible();
  }

  // Lower-cased emails of every user already in the project, read page by page until the reported count is reached.
  async projectUserEmails(projectId) {
    const { read } = require('../../utils/scp-readonly');
    const emails = new Set(); let count = Infinity;
    for (let page = 1; emails.size < count && page <= 100; page += 1) {
      const body = await read(this.page, 'project_user/get_users_by_project/', { project_id: projectId, page });
      expect(Array.isArray(body.data), 'Project users list').toBe(true);
      count = Number(body.count ?? body.data.length);
      const before = emails.size;
      for (const user of body.data) emails.add(String(user.user_email_id || '').toLowerCase());
      if (emails.size === before) break;
    }
    return emails;
  }

  row(email) {
    return this.page.getByRole('row').filter({ hasText: email }).first();
  }

  async showAllRows() {
    const selector = this.page.getByText('Rows per page', { exact: true }).locator('..').getByRole('combobox');
    await selector.click();
    const options = this.page.getByRole('option');
    const values = (await options.allTextContents()).map((text) => Number(text.trim())).filter(Number.isFinite);
    const largest = Math.max(...values);
    if (!Number.isFinite(largest)) throw new Error('User list page-size options were unavailable.');
    await this.page.getByRole('option', { name: String(largest), exact: true }).click();
    await expect(selector).toContainText(String(largest));
  }

  async findRow(email) {
    const row = this.row(email);
    if (await row.isVisible().catch(() => false)) return row;
    for (let pageNumber = 2; pageNumber <= 10; pageNumber += 1) {
      const pageButton = this.page.getByRole('button', { name: String(pageNumber), exact: true });
      if (!(await pageButton.isVisible().catch(() => false))) break;
      await pageButton.click();
      if (await row.isVisible().catch(() => false)) return row;
    }
    throw new Error(`User ${email} was not found on the available list pages.`);
  }

  async invite(email, organization) {
    await this.page.getByRole('button', { name: 'Invite Users' }).click();
    await expect(this.page.getByRole('button', { name: 'Send Invites', exact: true })).toBeDisabled();
    await this.page.getByPlaceholder('Enter email address').fill(email);
    const dropdowns = new FirstDeliveryInspectionConfigPage(this.page);
    const chosenOrganization = await dropdowns.selectInviteOption(
      'Choose Organization', [organization], 'Logged-in organization'
    );
    const role = await dropdowns.selectInviteOption(
      'Choose Role', ['Project Admin', 'Project Manager'], 'Project role'
    );
    await this.page.getByRole('button', { name: 'Send Invites', exact: true }).click();
    await this.searchInput.first().fill(email);
    await this.searchInput.first().press('Enter');
    await expect(this.row(email)).toBeVisible({ timeout: 30000 });
    return { email, organization: chosenOrganization, role };
  }

  async search(email) {
    await this.searchInput.first().fill(email);
    await this.searchInput.first().press('Enter');
    await expect(this.row(email)).toBeVisible({ timeout: 30000 });
    const rows = this.page.getByRole('row').filter({ hasText: '@' });
    await expect(rows).toHaveCount(1);
  }

  async clearSearch() {
    await this.searchInput.first().fill('');
  }

  async changeOrganization(email, currentOrganization) {
    const row = await this.findRow(email);
    await expect(row).toBeVisible();
    await row.locator('td').last().locator('svg').click();
    await this.page.getByText('Change Associated Organization', { exact: true }).click();
    const dialog = this.page.getByRole('heading', { name: 'Change Associated Organization' })
      .locator('xpath=ancestor::div[.//button[normalize-space()="Confirm"]][1]');
    await expect(dialog).toBeVisible();
    await dialog.locator('[role="button"][aria-haspopup="listbox"]').first().click();
    const options = this.page.locator('[role="option"]:visible');
    await options.first().waitFor({ state: 'visible' });
    const choices = (await options.allTextContents()).map((value) => value.trim());
    const alternate = choices.find((value) => value.length > 2 && value !== currentOrganization);
    if (!alternate) throw new Error('No alternate organization is available in Change Associated Organization.');
    await options.filter({ hasText: alternate }).first().click();
    await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(row).toContainText(alternate, { timeout: 30000 });
    return alternate;
  }

  async closeProfileDrawer() {
    const drawer = this.page.getByRole('heading', { name: 'User Profile', exact: true })
      .locator('xpath=ancestor::*[button and .//h3[normalize-space()="User Profile"]][1]');
    if (await drawer.isVisible({ timeout: 1000 }).catch(() => false)) {
      await drawer.getByRole('button').first().click({ force: true }).catch(async () => {
        await this.page.keyboard.press('Escape');
      });
      await expect(drawer).toBeHidden({ timeout: 10000 }).catch(() => null);
    }
  }

  async applyFilter(category, value) {
    await this.closeProfileDrawer();
    await this.page.getByRole('button', { name: 'Filter', exact: true }).click();
    const heading = this.page.getByRole('heading', { name: 'Filter', exact: true });
    await expect(heading).toBeVisible({ timeout: 30000 });
    const dialog = heading.locator(
      'xpath=ancestor::div[.//button[normalize-space()="Apply Filter"]][1]'
    );
    await dialog.getByRole('tab', { name: category, exact: true }).click();
    const panel = dialog.getByRole('tabpanel');
    const option = panel.getByText(value, { exact: true });
    const optionAvailable = await option.waitFor({
      state: 'visible',
      timeout: 10000
    }).then(() => true).catch(() => false);
    if (!optionAvailable) {
      await dialog.getByRole('button', { name: 'close', exact: true }).click();
      await expect(heading).toBeHidden({ timeout: 30000 });
      return false;
    }
    await option.locator('..').locator('input[type="checkbox"]').check();
    await dialog.getByRole('button', { name: 'Apply Filter', exact: true }).click();
    await expect(heading).toBeHidden({ timeout: 30000 });
    return true;
  }

  async filterActive(email) {
    await this.searchInput.first().fill('');
    await this.searchInput.first().press('Enter');
    const applied = await this.applyFilter('status', 'Active');
    const row = await this.findRow(email);
    await expect(row).toContainText(/Active/i);
    return applied;
  }
}

module.exports = { UserManagementPage };
