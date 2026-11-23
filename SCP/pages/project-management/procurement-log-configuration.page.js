const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');

class ProcurementLogConfigurationPage extends BasePage {
  constructor(page) {
    super(page);
    this.addFieldButton = page.getByRole('button', { name: 'Add Log Fields', exact: true });
    this.saveChangesButton = page.getByRole('button', { name: 'Save Changes', exact: true });
    this.modalHeading = page.getByRole('heading', { name: 'Add Procurement Log Fields', exact: true });
  }

  async open(dashboard) {
    await dashboard.openProjectManagementModule(
      'Procurement Log Configuration',
      'procurement-log-configuration',
      'Procurement Log Configuration'
    );
    await expect(this.addFieldButton).toBeVisible();
    await this.waitForFieldsLoaded();
  }

  async waitForFieldsLoaded() {
    await this.page.locator('tbody tr').first().waitFor({ state: 'visible', timeout: 30000 });
  }

  async verifyBlankFieldIsRejected() {
    await this.clickFirstVisible([{ locator: this.addFieldButton, label: 'Add Log Fields' }], 'Add Log Fields', 10000);
    await expect(this.modalHeading).toBeVisible();
    await this.clickFirstVisible([
      { locator: this.page.getByRole('button', { name: 'Add', exact: true }), label: 'Add procurement field' }
    ], 'Add procurement field', 5000);
    await expect(this.modalHeading, 'Blank procurement field must not be submitted').toBeVisible();
  }

  async ensureField(fieldName, fieldType = 'Number') {
    if (await this.modalHeading.isVisible().catch(() => false)) {
      const closeButton = this.modalHeading.locator('..').getByRole('button').first();
      await this.clickFirstVisible([{ locator: closeButton, label: 'Close procurement field dialog' }], 'Close dialog', 5000);
      await expect(this.modalHeading).toBeHidden();
    }

    const existingRow = this.fieldRow(fieldName);
    const fieldAlreadyExists = await existingRow.isVisible().catch(() => false);
    if (!fieldAlreadyExists) {
      await this.clickFirstVisible([{ locator: this.addFieldButton, label: 'Add Log Fields' }], 'Add Log Fields', 10000);
      await this.fillVisible(this.fieldBesideLabel('Field Name'), fieldName, 'Procurement field name');
      await this.selectDropdownOption(
        this.page.getByRole('button', { name: 'Choose Field Type', exact: true }),
        fieldType,
        'Procurement field type'
      );
      const addResponsePromise = this.page.waitForResponse((response) =>
        response.request().method() === 'POST' &&
        /\/api\/procore_submittal\/add_column_procore_submittals\//i.test(response.url()),
      { timeout: 30000 });
      await this.clickFirstVisible([
        { locator: this.page.getByRole('button', { name: 'Add', exact: true }), label: 'Add procurement field' }
      ], 'Add procurement field', 10000);
      const addResponse = await addResponsePromise;
      expect(addResponse.ok(), `Adding ${fieldName} failed with HTTP ${addResponse.status()}`).toBeTruthy();
      await expect(this.modalHeading).toBeHidden({ timeout: 10000 });
    }

    await this.expectField(fieldName);
    const enabledCheckbox = this.fieldRow(fieldName).locator('input[type="checkbox"]');
    if (!await enabledCheckbox.isChecked()) {
      await this.clickFirstVisible([
        { locator: enabledCheckbox, label: `Enable ${fieldName}` }
      ], `Enable ${fieldName}`, 5000);
    }
    await expect(enabledCheckbox, `${fieldName} should be enabled`).toBeChecked();

    const saveResponsePromise = this.page.waitForResponse((response) => {
      const method = response.request().method();
      return ['POST', 'PUT', 'PATCH'].includes(method) &&
        /\/api\/project_submittal_col\/add_sub_col_list\//i.test(response.url());
    }, { timeout: 30000 });
    await this.clickFirstVisible([{ locator: this.saveChangesButton, label: 'Save Changes' }], 'Save Changes', 10000);
    const saveResponse = await saveResponsePromise;
    expect(saveResponse.ok(), `Procurement Log Configuration save failed with HTTP ${saveResponse.status()}`).toBeTruthy();

    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.waitForReady();
    await this.waitForFieldsLoaded();
    await this.expectField(fieldName);
    await expect(
      this.fieldRow(fieldName).locator('input[type="checkbox"]'),
      `${fieldName} should remain enabled after reload`
    ).toBeChecked();
    return !fieldAlreadyExists;
  }

  fieldRow(fieldName) {
    const escapedName = String(fieldName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.page.locator('tr')
      .filter({ hasText: new RegExp(`${escapedName}\\s*\\(Custom\\)`, 'i') })
      .first();
  }

  async expectField(fieldName) {
    const row = this.fieldRow(fieldName);
    await expect(row).toBeVisible({ timeout: 30000 });
    const escapedName = String(fieldName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await expect(row).toContainText(new RegExp(escapedName, 'i'));
  }
}

module.exports = { ProcurementLogConfigurationPage };
