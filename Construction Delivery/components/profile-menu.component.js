const { clickHighlighted } = require('../utils/highlight');

class ProfileMenuComponent {
  constructor(page) {
    this.page = page;
    this.accountSettingsButton = page.getByRole('button', { name: /Account settings/i }).first();
    this.myAccountMenuItem = page.getByRole('menuitem', { name: /My Account/i }).first();
    this.myOrganizationMenuItem = page.getByRole('menuitem', { name: /My Organi[sz]ation/i }).first();
    this.notificationPreferencesMenuItem = page.getByRole('menuitem', { name: /Notification Preferences/i }).first();
    this.logoutMenuItem = page.getByRole('menuitem', { name: /Logout|Log out/i }).first();
  }

  async open() {
    await this.accountSettingsButton.waitFor({ state: 'visible', timeout: 30000 });
    await clickHighlighted(this.accountSettingsButton, 'Account settings');
  }

  async close() {
    await this.page.keyboard.press('Escape').catch(() => null);
  }

  async validateMenuItems() {
    await this.open();
    const items = [
      ['My Account', this.myAccountMenuItem],
      ['My Organisation', this.myOrganizationMenuItem],
      ['Notification Preferences', this.notificationPreferencesMenuItem],
      ['Logout', this.logoutMenuItem]
    ];

    for (const [label, locator] of items) {
      await locator.waitFor({ state: 'visible', timeout: 10000 });
      if (!(await locator.isEnabled({ timeout: 2000 }).catch(() => false))) {
        throw new Error(`${label} menu item is visible but not enabled.`);
      }
    }

    await this.close();
  }
}

module.exports = { ProfileMenuComponent };
