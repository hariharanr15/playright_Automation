const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');

class MaterialMasterPage extends BasePage {
  constructor(page) {
    super(page);
    this.addMaterialButton = page.getByRole('button', { name: 'Add Material', exact: true });
    this.searchInput = page.getByRole('textbox', { name: /Search materials/i });
    this.modalHeading = page.getByRole('heading', { name: 'Add Material', exact: true });
  }

  async open(dashboard) {
    await dashboard.openProjectManagementModule('Material Master', 'material-master', 'Material Master');
    await expect(this.addMaterialButton).toBeVisible();
  }

  async openAddMaterial() {
    await this.clickFirstVisible([{ locator: this.addMaterialButton, label: 'Add Material' }], 'Add Material', 10000);
    await expect(this.modalHeading).toBeVisible();
  }

  async verifyBlankMaterialIsRejected() {
    await this.openAddMaterial();
    await this.clickFirstVisible([
      { locator: this.page.getByRole('button', { name: 'Add', exact: true }), label: 'Add material' }
    ], 'Add material', 5000);
    await expect(this.modalHeading, 'Blank material must not be submitted').toBeVisible();
  }

  async addMaterial(name, category, uom) {
    if (!(await this.modalHeading.isVisible().catch(() => false))) {
      await this.openAddMaterial();
    }
    const categoryTrigger = this.page.getByRole('button', { name: 'Choose Category', exact: true });
    const selectedCategory = category
      ? (await this.selectDropdownOption(categoryTrigger, category, 'Material category'), category)
      : await this.selectFirstDropdownOption(categoryTrigger, 'Material category');
    await this.fillVisible(this.fieldBesideLabel('Material Name'), name, 'Material name');
    const uomTrigger = this.page.getByRole('button', { name: 'Choose Unit', exact: true });
    const selectedUom = uom
      ? (await this.selectDropdownOption(uomTrigger, uom, 'Material UOM'), uom)
      : await this.selectFirstDropdownOption(uomTrigger, 'Material UOM');
    await this.clickFirstVisible([
      { locator: this.page.getByRole('button', { name: 'Add', exact: true }), label: 'Add material' }
    ], 'Add material', 10000);
    await this.expectMaterial(name);
    return { name, category: selectedCategory, uom: selectedUom };
  }

  row(name) {
    return this.page.locator('tr').filter({ hasText: name }).first();
  }

  async expectMaterial(name) {
    await this.searchInput.fill(name);
    await expect(this.row(name)).toBeVisible({ timeout: 30000 });
    const escapedName = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await expect(this.row(name)).toContainText(new RegExp(escapedName, 'i'));
  }

  async clearSearch() {
    await this.clearSearchAndPause(this.searchInput, 'Material Master search');
  }
}

module.exports = { MaterialMasterPage };
