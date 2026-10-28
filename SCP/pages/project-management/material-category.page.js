const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');

class MaterialCategoryPage extends BasePage {
  constructor(page) {
    super(page);
    this.referenceDataMenu = page.getByRole('button', { name: 'Reference Data', exact: true });
    this.menu = page.getByRole('button', { name: 'Material Category', exact: true });
    this.addButton = page.getByRole('button', { name: 'Add Material Category', exact: true });
    this.searchInput = page.getByRole('textbox', { name: /Search categories/i });
  }

  async open(dashboard) {
    await dashboard.openProjectManagement();
    if (!(await this.menu.isVisible({ timeout: 1000 }).catch(() => false))) {
      await this.clickFirstVisible([{ locator: this.referenceDataMenu, label: 'Reference Data' }], 'Reference Data', 20000);
    }
    await this.clickFirstVisible([{ locator: this.menu, label: 'Material Category' }], 'Material Category', 20000);
    await expect(this.addButton).toBeVisible({ timeout: 30000 });
  }

  async add(name) {
    await this.clickFirstVisible([
      { locator: this.addButton, label: 'Add Material Category' }
    ], 'Add Material Category', 20000);
    const form = this.page.locator('form').filter({ visible: true }).last();
    await this.fillVisible(form.getByRole('textbox').first(), name, 'Material category name');
    await this.clickFirstVisible([
      { locator: this.page.getByRole('button', { name: 'Add', exact: true }), label: 'Add' }
    ], 'Add Material Category', 10000);
    await this.expectCategory(name);
  }

  async update(existingName, updatedName) {
    await this.search(existingName);
    const row = this.row(existingName);
    await this.clickFirstVisible([
      { locator: row.getByRole('img', { name: 'Edit' }), label: `${existingName} edit` },
      { locator: row.locator('[aria-label="Edit"], img[alt="Edit"]'), label: `${existingName} edit` }
    ], `Edit ${existingName}`, 10000);
    const form = this.page.locator('form').filter({ visible: true }).last();
    await this.fillVisible(form.getByRole('textbox').first(), updatedName, 'Updated material category name');
    await this.clickFirstVisible([
      { locator: this.page.getByRole('button', { name: 'Update', exact: true }), label: 'Update' }
    ], 'Update Material Category', 10000);
    await this.expectCategory(updatedName);
  }

  row(name) {
    return this.page.locator('tr').filter({ hasText: name }).first();
  }

  async search(name) {
    await this.searchInput.fill(name);
    await expect(this.row(name)).toBeVisible({ timeout: 20000 });
  }

  async expectCategory(name) {
    await this.search(name);
    await expect(this.row(name)).toContainText(name);
  }

  async clearSearch() {
    await this.clearSearchAndPause(this.searchInput, 'Material Category search');
  }
}

module.exports = { MaterialCategoryPage };
