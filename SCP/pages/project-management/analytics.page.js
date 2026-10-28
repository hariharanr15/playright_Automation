const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');

class AnalyticsPage extends BasePage {
  async open(dashboard) {
    await dashboard.openProjectManagement();
    const analyticsMenu = dashboard.leftNavigation.getByRole('button', { name: 'Analytics', exact: true });
    const currentUrl = this.page.url();
    await dashboard.clickLeftMenu(analyticsMenu, 'Analytics');
    await expect(analyticsMenu).toBeVisible();
    await expect(this.page).toHaveURL(currentUrl);
  }
}

module.exports = { AnalyticsPage };
