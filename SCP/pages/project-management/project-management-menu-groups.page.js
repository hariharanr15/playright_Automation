const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');

class ProjectManagementMenuGroupsPage extends BasePage {
  async verifySetupWizard(dashboard) {
    await dashboard.openProjectManagement();
    const control = dashboard.leftNavigation.getByRole('button', { name: 'Setup Wizard', exact: true });
    const setupWizardNavigation = this.page.waitForURL(/\/setup-wizard\/?$/i, { timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    await dashboard.clickLeftMenu(control, 'Setup Wizard');
    const reachedSetupWizard = await setupWizardNavigation;
    await expect(this.page).toHaveURL(/\/(setup-wizard|management-dashboard)\/?$/i);
    if (reachedSetupWizard) {
      await this.page.waitForURL(/\/management-dashboard\/?$/i, { timeout: 30000 }).catch(() => null);
    }
  }

  async verifyNonNavigatingControl(dashboard, name) {
    await dashboard.openProjectManagement();
    const control = dashboard.leftNavigation.getByRole('button', { name, exact: true });
    const currentUrl = this.page.url();
    await dashboard.clickLeftMenu(control, name);
    await expect(control).toBeVisible();
    await expect(this.page).toHaveURL(currentUrl);
  }
}

module.exports = { ProjectManagementMenuGroupsPage };
