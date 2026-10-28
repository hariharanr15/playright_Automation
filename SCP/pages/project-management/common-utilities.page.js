const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');

class CommonUtilitiesPage extends BasePage {
  constructor(page, config) {
    super(page);
    this.config = config;
    this.referenceDataMenu = page.getByRole('button', { name: 'Reference Data', exact: true });
    this.commonUtilitiesMenu = page.getByRole('button', { name: 'Common Utilities', exact: true });
    this.addButton = page.getByRole('button', { name: 'Add Common Util', exact: true });
    this.searchInput = page.getByRole('textbox', { name: /Search utils/i });
  }

  async open(dashboard) {
    await dashboard.openProjectManagement();
    if (!(await this.commonUtilitiesMenu.isVisible({ timeout: 1000 }).catch(() => false))) {
      await this.clickFirstVisible([{ locator: this.referenceDataMenu, label: 'Reference Data' }], 'Reference Data', 20000);
    }
    await this.clickFirstVisible([{ locator: this.commonUtilitiesMenu, label: 'Common Utilities' }], 'Common Utilities', 20000);
    await expect(this.page).toHaveURL(/\/common-utilities\/?$/i, { timeout: 30000 });
    await expect(this.addButton).toBeVisible();
  }

  async add(name, type = 'currency_type') {
    await this.clickFirstVisible([{ locator: this.addButton, label: 'Add Common Util' }], 'Add Common Util', 20000);
    const form = this.page.locator('form').filter({ visible: true }).last();
    const nameInput = form.getByRole('textbox').first();
    await this.fillVisible(nameInput, name, 'Common utility name');
    await this.clickFirstVisible([
      { locator: form.getByRole('button', { name: /Choose CommonUtil Type/i }), label: 'Common utility type' }
    ], 'Common utility type', 10000);
    await this.clickFirstVisible([
      { locator: this.page.getByRole('option', { name: type, exact: true }), label: type }
    ], type, 10000);
    await this.clickFirstVisible([
      { locator: this.page.getByRole('button', { name: 'Add', exact: true }), label: 'Add' }
    ], 'Add common utility', 10000);
    await this.expectUtility(name);
  }

  async update(existingName, updatedName, type = 'currency_type') {
    await this.search(existingName);
    const row = this.utilityRow(existingName);
    await expect(row).toBeVisible();
    const actions = row.locator('.inline-flex.cursor-pointer, button[aria-haspopup="menu"], [role="button"]').last();
    await this.clickFirstVisible([{ locator: actions, label: `${existingName} actions` }], `${existingName} actions`, 10000);
    await this.clickFirstVisible([
      { locator: this.page.getByRole('menuitem', { name: 'Edit', exact: true }), label: 'Edit' }
    ], 'Edit common utility', 10000);

    const form = this.page.locator('form').filter({ visible: true }).last();
    await this.fillVisible(form.getByRole('textbox').first(), updatedName, 'Updated common utility name');
    const typeButton = form.getByRole('button', { name: type, exact: true });
    if (await typeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await this.clickFirstVisible([{ locator: typeButton, label: type }], type, 5000);
      await this.clickFirstVisible([
        { locator: this.page.getByRole('option', { name: type, exact: true }), label: type }
      ], type, 5000);
    }
    await this.clickFirstVisible([
      { locator: this.page.getByRole('button', { name: 'Update', exact: true }), label: 'Update' }
    ], 'Update common utility', 10000);
    await this.expectUtility(updatedName);
  }

  async search(name) {
    await this.searchInput.fill(name);
    await expect(this.utilityRow(name)).toBeVisible({ timeout: 20000 });
  }

  utilityRow(name) {
    return this.page.locator('tr').filter({ hasText: name }).first();
  }

  async expectUtility(name) {
    await this.search(name);
    await expect(this.utilityRow(name)).toContainText(name);
  }

  async clearSearch() {
    await this.clearSearchAndPause(this.searchInput, 'Common Utilities search');
  }
}

module.exports = { CommonUtilitiesPage };
