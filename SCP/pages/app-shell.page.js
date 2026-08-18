const { BasePage } = require('./base.page');
const { LoginPage } = require('./login.page');

class AppShellPage extends BasePage {
  constructor(page, config) {
    super(page);
    this.config = config;
    this.loginPage = new LoginPage(page);
  }

  async open() {
    const entryUrl = this.config.loginUrl || this.config.baseUrl;
    await this.goto(entryUrl);
    await this.loginPage.loginIfVisible(this.config);
    await this.waitForReady();
  }

  escapeForRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  tabLocators(tabName) {
    const tabNamePattern = new RegExp(this.escapeForRegex(tabName), 'i');

    return [
      { locator: this.page.getByRole('tab', { name: tabNamePattern }), label: `${tabName} tab` },
      { locator: this.page.getByRole('link', { name: tabNamePattern }), label: `${tabName} link` },
      { locator: this.page.getByRole('button', { name: tabNamePattern }), label: `${tabName} button` },
      { locator: this.page.locator(`a:has-text("${tabName}"), button:has-text("${tabName}"), [role="menuitem"]:has-text("${tabName}")`), label: `${tabName} fallback` },
      { locator: this.page.getByText(tabName, { exact: false }), label: `${tabName} text` }
    ];
  }

  async navigateToTab(tab) {
    const tabName = typeof tab === 'string' ? tab : tab.name;

    if (!tabName) {
      throw new Error('Tab name is required.');
    }

    if (tab.route) {
      await this.goto(new URL(tab.route, this.config.baseUrl).toString());
      return;
    }

    await this.clickFirstVisible(this.tabLocators(tabName), tabName, 7000);
  }

  async expectTabAvailable(tabName) {
    await this.expectVisible(this.page.getByText(tabName, { exact: false }), `${tabName} navigation`);
  }
}

module.exports = { AppShellPage };
