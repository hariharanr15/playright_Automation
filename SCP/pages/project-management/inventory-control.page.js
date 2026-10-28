const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');

class InventoryControlPage extends BasePage {
  constructor(page) {
    super(page);
    this.addRuleButton = page.getByRole('button', { name: 'Add Rule', exact: true });
    this.modalHeading = page.getByRole('heading', { name: 'Add Rule', exact: true });
  }

  async open(dashboard) {
    await dashboard.openProjectManagementModule('Inventory Control', 'inventory-control', 'Inventory Control');
    await expect(this.addRuleButton).toBeVisible();
  }

  async openAddRule() {
    await this.clickFirstVisible([{ locator: this.addRuleButton, label: 'Add Rule' }], 'Add Rule', 10000);
    await expect(this.modalHeading).toBeVisible();
  }

  async verifyBlankRuleIsRejected() {
    await this.openAddRule();
    await this.clickFirstVisible([
      { locator: this.page.getByRole('button', { name: 'Add', exact: true }), label: 'Add inventory rule' }
    ], 'Add inventory rule', 5000);
    await expect(this.modalHeading, 'Blank inventory rule must not be submitted').toBeVisible();
  }

  async addRule(materialName, minimum = '100', maximum = '900') {
    if (!(await this.modalHeading.isVisible().catch(() => false))) {
      await this.openAddRule();
    }
    await this.selectDropdownOption(
      this.page.getByRole('button', { name: 'Choose Inventory Item', exact: true }),
      materialName,
      'Inventory item'
    );
    const balances = this.page.getByRole('spinbutton');
    await this.fillVisible(balances.nth(0), minimum, 'Minimum inventory balance');
    await this.fillVisible(balances.nth(1), maximum, 'Maximum inventory balance');
    await this.enableAllNotificationSwitches();
    await this.clickFirstVisible([
      { locator: this.page.getByRole('button', { name: 'Add', exact: true }), label: 'Add inventory rule' }
    ], 'Add inventory rule', 10000);
    await this.expectRule(materialName, minimum, maximum);
  }

  async enableAllNotificationSwitches() {
    const labels = ['Notify on min balance breach', 'Notify on max balance breach'];

    for (const label of labels) {
      const field = this.page.getByText(label, { exact: true });
      await expect(field).toBeVisible();
      const toggle = field.locator('..').locator('div').first();
      const classes = await toggle.getAttribute('class');
      if (/bg-switchGray/.test(classes || '')) {
        await this.clickFirstVisible([{ locator: toggle, label }], label, 5000);
      }
      await expect(toggle, `${label} should be enabled`).not.toHaveClass(/bg-switchGray/);
    }
  }

  async expectRule(materialName, minimum, maximum) {
    const escapedName = String(materialName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const material = this.page.getByText(new RegExp(`^${escapedName}$`, 'i')).first();
    await expect(material).toBeVisible({ timeout: 30000 });
    const row = this.page.locator('div')
      .filter({ has: material })
      .filter({ hasText: new RegExp(`${minimum}[\\s\\S]*${maximum}`) })
      .last();
    await expect(row).toBeVisible({ timeout: 30000 });
    await expect(row).toContainText(new RegExp(escapedName, 'i'));
    await expect(row).toContainText(minimum);
    await expect(row).toContainText(maximum);
  }
}

module.exports = { InventoryControlPage };
