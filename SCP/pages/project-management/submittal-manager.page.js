const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');

class SubmittalManagerPage extends BasePage {
  async open(dashboard) {
    await dashboard.openProjectManagementModule('Submittal Manager', 'submittal-manager', 'Submittal Manager');
    await expect(this.page.getByRole('heading', { name: 'Submittal Manager', exact: true }).first()).toBeVisible();
  }
}

module.exports = { SubmittalManagerPage };
