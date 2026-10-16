const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');

class SystemMessagesPage extends BasePage {
  constructor(page) {
    super(page);
    this.newMessageButton = page.getByRole('button', { name: 'New message', exact: true });
    this.createButton = page.getByRole('button', { name: 'Create', exact: true });
    this.cancelButton = page.getByRole('button', { name: 'Cancel', exact: true });
    this.titleInput = page.getByRole('textbox', { name: 'Title (optional)', exact: true });
    this.bodyInput = page.getByRole('textbox', { name: /Body \(markdown\)/i });
    this.startsAtInput = page.getByRole('textbox', { name: 'Starts at', exact: true });
    this.endsAtInput = page.getByRole('textbox', { name: 'Ends at', exact: true });
  }

  async open(dashboard) {
    await dashboard.openProjectManagementModule('System Messages', 'system-messages', 'System Messages');
    await expect(this.newMessageButton).toBeVisible();
  }

  async verifyBlankMessageIsRejected() {
    await this.clickFirstVisible([{ locator: this.newMessageButton, label: 'New message' }], 'New message', 10000);
    await expect(this.createButton, 'A message without a body must not be created').toBeDisabled();
  }

  async createCodegenMessage(data) {
    await this.page.getByLabel(/Scope/i).selectOption('project');
    await this.fillVisible(this.titleInput, data.title, 'System message title');
    await this.fillVisible(this.bodyInput, data.body, 'System message body');
    await this.fillVisible(this.startsAtInput, data.startsAt, 'System message start');
    await this.fillVisible(this.endsAtInput, data.endsAt, 'System message end');
    const preview = this.page.locator('span').filter({ hasText: data.body }).first();
    await expect(preview).toHaveText(data.body);
    await expect(this.createButton).toBeEnabled();

    const created = this.page.waitForResponse((response) => (
      response.request().method() === 'POST' && /message/i.test(response.url())
    ), { timeout: 30000 });
    await this.clickFirstVisible([{ locator: this.createButton, label: 'Create system message' }], 'Create system message', 5000);
    const response = await created;
    expect(response.ok(), 'System Message should be created successfully').toBeTruthy();
    await expect(this.newMessageButton, 'System Message form should close after creation').toBeVisible({ timeout: 30000 });
    await expect(
      this.page.getByText(data.title, { exact: true }),
      `Created System Message "${data.title}" should be displayed`
    ).toBeVisible({ timeout: 30000 });
  }

  async cancelMessage() {
    await this.clickFirstVisible([{ locator: this.cancelButton, label: 'Cancel message' }], 'Cancel message', 5000);
    await expect(this.newMessageButton).toBeVisible();
  }
}

module.exports = { SystemMessagesPage };
