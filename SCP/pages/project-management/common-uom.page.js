const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');

class CommonUomPage extends BasePage {
  constructor(page) {
    super(page);
    this.referenceDataMenu = page.getByRole('button', { name: 'Reference Data', exact: true });
    this.menu = page.getByRole('button', { name: 'Common UoM', exact: true });
    this.addButton = page.getByRole('button', { name: 'Add UOM', exact: true });
    this.searchInput = page.getByRole('textbox', { name: /Search UOM/i });
  }

  async open(dashboard) {
    await dashboard.openProjectManagement();
    if (!(await this.menu.isVisible({ timeout: 1000 }).catch(() => false))) {
      await this.clickFirstVisible([{ locator: this.referenceDataMenu, label: 'Reference Data' }], 'Reference Data', 20000);
    }
    await this.clickFirstVisible([{ locator: this.menu, label: 'Common UoM' }], 'Common UoM', 20000);
    await expect(this.page).toHaveURL(/\/common-uom\/?$/i, { timeout: 30000 });
    await expect(this.addButton).toBeVisible();
  }

  async add(name) {
    await this.clickFirstVisible([{ locator: this.addButton, label: 'Add UOM' }], 'Add UOM', 20000);
    const form = this.page.locator('form').filter({ visible: true }).last();
    await this.fillVisible(form.getByRole('textbox').first(), name, 'UOM name');
    await this.clickFirstVisible([
      { locator: this.page.getByRole('button', { name: 'Add', exact: true }), label: 'Add' }
    ], 'Add UOM', 10000);
    await this.expectUom(name);
  }

  async update(existingName, updatedName) {
    await this.search(existingName);
    const row = this.row(existingName);
    const actions = row.locator('.inline-flex.cursor-pointer, button[aria-haspopup="menu"], [role="button"]').last();
    await this.clickFirstVisible([{ locator: actions, label: `${existingName} actions` }], `${existingName} actions`, 10000);
    await this.clickFirstVisible([
      { locator: this.page.getByRole('menuitem', { name: 'Edit', exact: true }), label: 'Edit' }
    ], 'Edit UOM', 10000);
    const form = this.page.locator('form').filter({ visible: true }).last();
    await this.fillVisible(form.getByRole('textbox').first(), updatedName, 'Updated UOM name');
    await this.clickFirstVisible([
      { locator: this.page.getByRole('button', { name: 'Update', exact: true }), label: 'Update' }
    ], 'Update UOM', 10000);
    await this.expectUom(updatedName);
  }

  row(name) {
    return this.page.locator('tr').filter({ hasText: name }).first();
  }

  async search(name) {
    await this.searchInput.fill(name);
    await expect(this.row(name)).toBeVisible({ timeout: 20000 });
  }

  async expectUom(name) {
    await this.search(name);
    await expect(this.row(name)).toContainText(name);
  }

  async clearSearch() {
    await this.clearSearchAndPause(this.searchInput, 'Common UoM search');
  }
}

module.exports = { CommonUomPage };
