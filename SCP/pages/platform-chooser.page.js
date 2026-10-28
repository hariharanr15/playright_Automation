const { expect } = require('@playwright/test');
const { BasePage } = require('./base.page');
const { LoginPage } = require('./login.page');

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

  platformCard(platformName = this.config.platformName) {
    return this.page.getByRole('link', { name: platformName, exact: true }).locator('..');
  }

  isAuthenticatedAppUrl(urlValue = this.page.url()) {
    const currentUrl = new URL(urlValue);
    const appUrl = new URL(this.config.baseUrl);
    return currentUrl.origin === appUrl.origin && !/^\/auth\/?$/i.test(currentUrl.pathname);
  }

  async choosePlatform(platformName = this.config.platformName) {
    if (this.isAuthenticatedAppUrl()) {
      return;
    }

    const appOrigin = new URL(this.config.baseUrl).origin;
    const loginPage = new LoginPage(this.page);

      await loginPage.loginIfVisible(this.config);
      const platformTitle = this.page.getByRole('link', { name: platformName, exact: true });
      // An account with access to only this platform is redirected straight into the app, without the chooser.
      const landed = await Promise.race([
        this.page.waitForURL(url => url.origin === appOrigin && !/^\/auth\/?$/i.test(url.pathname), { timeout: 30000 }).then(() => 'app'),
        platformTitle.first().waitFor({ state: 'visible', timeout: 30000 }).then(() => 'chooser')
      ]).catch(() => null);
      if (landed === 'app' && this.isAuthenticatedAppUrl()) return;
      try {
        await this.expectVisible(platformTitle, `${platformName} platform card`, 30000);
      } catch (error) {
        throw error;
      }
      const openLink = this.platformCard(platformName).getByRole('link', { name: 'Open', exact: true });
      if (!(await openLink.getAttribute('href'))) {
        throw new Error(`The ${platformName} platform card does not contain an Open URL.`);
      }
      const authenticated = this.page.waitForURL(
        (url) => url.origin === appOrigin && !/^\/auth\/?$/i.test(url.pathname),
        { timeout: 45000 }
      ).then(() => true).catch(() => false);

      await openLink.click();

      await authenticated;

    if (!this.isAuthenticatedAppUrl()) {
      throw new Error('SCP platform authentication did not complete. The step retry manager owns the single permitted retry.');
    }

    await this.waitForReady();
  }

  async openSupplyChainPlanner() {
    await this.choosePlatform(this.config.platformName);

    if (!/\/management-dashboard\/?$/i.test(new URL(this.page.url()).pathname)) {
      await this.goto(this.config.managementDashboardUrl);
    }

    await expect(this.page).toHaveURL(this.config.managementDashboardUrl, { timeout: 30000 });
  }

  escapeForRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = { PlatformChooserPage };
