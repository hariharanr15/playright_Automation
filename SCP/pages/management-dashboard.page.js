const { BasePage } = require('./base.page');

class ManagementDashboardPage extends BasePage {
  constructor(page, config) {
    super(page);
    this.config = config;
    this.leftNavigation = page.locator('nav').first();
    this.projectManagementMenu = this.leftNavigation.getByRole('button', {
      name: new RegExp(this.escapeForRegex(config.projectManagementName), 'i')
    });
    this.firstDeliveryInspectionConfigMenu = this.leftNavigation.getByText(config.firstDeliveryInspectionConfigName, {
      exact: false
    });
  }

  async open() {
    if (/\/management-dashboard\/?$/i.test(new URL(this.page.url()).pathname)) {
      await this.expectLoaded();
      return;
    }

    await this.goto(this.config.managementDashboardUrl);
  }

  async expectLoaded() {
    await this.page.waitForURL(this.config.managementDashboardUrl, { timeout: 30000 });
    await this.expectVisible(this.page.getByRole('heading', { name: /Management Dashboard/i }), 'Management Dashboard heading');
  }

  async openProjectManagement() {
    if (await this.isFirstDeliveryInspectionConfigVisible(1000)) {
      return;
    }

    await this.clickLeftMenu(this.projectManagementMenu, this.config.projectManagementName);
    await this.expectVisible(this.firstDeliveryInspectionConfigMenu, this.config.firstDeliveryInspectionConfigName, 20000);
  }

  async openFirstDeliveryInspectionConfig() {
    if (!(await this.isFirstDeliveryInspectionConfigVisible(1000))) {
      await this.openProjectManagement();
    }

    await this.clickLeftMenu(this.firstDeliveryInspectionConfigMenu, this.config.firstDeliveryInspectionConfigName);

    await this.expectFirstDeliveryInspectionConfigUrl();
  }

  escapeForRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async isFirstDeliveryInspectionConfigVisible(timeout = 3000) {
    return this.firstDeliveryInspectionConfigMenu.first().isVisible({ timeout }).catch(() => false);
  }

  async clickLeftMenu(locator, label) {
    if (!(await locator.first().isVisible({ timeout: 20000 }).catch(() => false))) {
      const visibleMenus = await this.getVisibleLeftMenuItems();
      throw new Error(
        `${label} was not visible in the left menu. ` +
        `Visible menu items: ${visibleMenus.join(', ') || 'none'}. Current URL: ${this.page.url()}`
      );
    }

    await this.clickFirstVisible([{ locator, label }], label, 5000);
  }

  async getVisibleLeftMenuItems() {
    return this.leftNavigation.locator('button, a, [role="button"], [role="menuitem"]')
      .evaluateAll((nodes) => nodes
        .map((node) => (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean))
      .catch(() => []);
  }

  async expectFirstDeliveryInspectionConfigUrl() {
    await this.page.waitForURL(this.config.firstDeliveryInspectionConfigUrl, { timeout: 30000 });
    await this.pauseAfterOperation();
  }
}

module.exports = { ManagementDashboardPage };
