const { expect } = require('@playwright/test');
const { BasePage } = require('./base.page');

class PlatformChooserPage extends BasePage {
  constructor(page, config) {
    super(page);
    this.config = config;
  }

  platformLocators(platformName = this.config.platformName) {
    const platformPattern = new RegExp(this.escapeForRegex(platformName), 'i');

    return [
      { locator: this.page.getByRole('link', { name: platformPattern }), label: platformName },
      { locator: this.page.getByRole('button', { name: platformPattern }), label: platformName },
      { locator: this.page.getByText(platformName, { exact: true }), label: `${platformName} text` },
      { locator: this.page.getByText(platformName, { exact: false }), label: `${platformName} fallback` }
    ];
  }

  platformCardLocators() {
    return [
      { locator: this.page.getByText(this.config.platformCardName, { exact: true }), label: this.config.platformCardName },
      { locator: this.page.getByText(this.config.platformCardName, { exact: false }), label: `${this.config.platformCardName} fallback` }
    ];
  }

  async choosePlatform(platformName = this.config.platformName) {
    if (await this.page.getByText(this.config.platformCardName, { exact: false }).first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.clickFirstVisible(this.platformCardLocators(), this.config.platformCardName, 15000);
    }

    if (await this.page.getByRole('link', { name: new RegExp(this.escapeForRegex(platformName), 'i') }).first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.clickFirstVisible([
        { locator: this.page.getByRole('link', { name: new RegExp(this.escapeForRegex(platformName), 'i') }), label: platformName }
      ], platformName, 10000);
      await this.waitForReady();
      return;
    }

    await this.clickFirstVisible(this.platformLocators(platformName), platformName, 15000);
    await this.waitForReady();
  }

  async openSupplyChainPlanner() {
    await this.choosePlatform(this.config.platformName);

    if (!/supplychain|management-dashboard/i.test(this.page.url())) {
      await this.goto(this.config.managementDashboardUrl);
    }

    await expect(this.page).toHaveURL(/supplychain|management-dashboard/i, { timeout: 30000 });
  }

  escapeForRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = { PlatformChooserPage };
