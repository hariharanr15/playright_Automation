const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');

class ScpTabPage extends BasePage {
  constructor(page, tab) {
    super(page);
    this.tab = tab;
  }

  async open(appShell) {
    await appShell.navigateToTab(this.tab);
    await this.expectLoaded();
  }

  async expectLoaded() {
    await this.waitForReady();

    if (this.tab.route) {
      await expect(this.page).toHaveURL(new RegExp(this.escapeForRegex(this.tab.route)));
    }

    const expectedText = this.tab.expectedText || this.tab.name;
    if (expectedText) {
      await expect(this.page.locator('body')).toContainText(new RegExp(this.escapeForRegex(expectedText), 'i'), {
        timeout: 20000
      });
    }
  }

  escapeForRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = { ScpTabPage };
