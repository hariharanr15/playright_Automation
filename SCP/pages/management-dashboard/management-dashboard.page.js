const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');

class ManagementDashboardPage extends BasePage {
  constructor(page, config) {
    super(page);
    this.config = config;
    this.leftNavigation = page.locator('nav').first();
    this.projectManagementMenu = this.leftNavigation.getByRole('button', {
      name: new RegExp(this.escapeForRegex(config.projectManagementName), 'i')
    });
    this.referenceDataMenu = this.leftNavigation.getByRole('button', {
      name: 'Reference Data',
      exact: true
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

  async expectWatchedMaterial(category) {
    await this.open();
    await expect(this.page.getByRole('heading', { name: /Your watched materials/i }))
      .toBeVisible({ timeout: 30000 });
    await expect(
      this.page.getByText(category, { exact: true }),
      `Dashboard should display watched category ${category}`
    ).toBeVisible({ timeout: 30000 });
  }

  async openProjectManagement() {
    if (await this.isReferenceDataVisible(1000)) {
      return;
    }

    await this.clickLeftMenu(this.projectManagementMenu, this.config.projectManagementName);
    await this.expectVisible(this.referenceDataMenu, 'Reference Data', 20000);
  }

  async openFirstDeliveryInspectionConfig() {
    if (!(await this.isFirstDeliveryInspectionConfigVisible(1000))) {
      await this.openProjectManagement();
    }

    await this.clickLeftMenu(this.firstDeliveryInspectionConfigMenu, this.config.firstDeliveryInspectionConfigName);

    await this.expectFirstDeliveryInspectionConfigUrl();
  }

  async openProjectManagementModule(name, route, heading = name) {
    await this.openProjectManagement();
    const menu = this.leftNavigation.getByRole('button', { name, exact: true });
    // Access is verified as it is: a menu entry the account does not have is Blocked, with the page's own message as evidence.
    if (!(await menu.first().isVisible({ timeout: 20000 }).catch(() => false))) {
      const visibleMenus = await this.getVisibleLeftMenuItems();
      await this.page.goto(new URL(`/${route}`, this.page.url()).href, { waitUntil: 'domcontentloaded' });
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
      const shown = (await this.page.locator('main').innerText({ timeout: 10000 }).catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 200);
      const { ScpBlocked } = require('../../utils/scp-readonly');
      throw new ScpBlocked(`${name} is not in this account's Project Management menu (visible: ${visibleMenus.join(', ') || 'none'}); /${route} shows "${shown || 'no content'}"`);
    }
    await this.clickLeftMenu(menu, name);
    await this.page.waitForURL(new RegExp(`/${this.escapeForRegex(route)}/?$`, 'i'), { timeout: 30000 });
    if (heading) {
      await this.expectVisible(this.page.getByRole('heading', { name: heading, exact: false }), `${heading} heading`);
    }
  }

  escapeForRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async isFirstDeliveryInspectionConfigVisible(timeout = 3000) {
    return this.firstDeliveryInspectionConfigMenu.first().isVisible({ timeout }).catch(() => false);
  }

  async isReferenceDataVisible(timeout = 3000) {
    return this.referenceDataMenu.first().isVisible({ timeout }).catch(() => false);
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
