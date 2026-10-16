const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');

class ConfigurationOptionsPage extends BasePage {
  constructor(page) {
    super(page);
    this.menu = page.getByRole('button', { name: 'Configuration Options', exact: true });
    this.confirmedLeadTime = page.locator('input[name="cnf_lt_weeks_bf"]');
    this.noWeeksBefore = page.locator('input[name="no_weeks_bf"]');
    this.notBookedWeeksBefore = page.locator('input[name="item_not_bk_weeks_bf"]');
    this.saveButton = page.getByRole('button', { name: 'Save', exact: true });
    this.currencyButton = page.getByRole('button', {
      name: /^(?:INR\s*-\s*Indian Rupees|USD\s*-\s*US Dollars?)$/i
    });
  }

  async open(dashboard) {
    const configurationLoaded = this.page.waitForResponse((response) => (
      /\/api\/project_config\/?\?project_id=(?!null(?:&|$))[^&]+/.test(response.url()) &&
      response.request().method() === 'GET' && response.ok()
    ), { timeout: 30000 });
    await dashboard.openProjectManagement();
    await this.clickFirstVisible([
      { locator: this.menu, label: 'Configuration Options' }
    ], 'Configuration Options', 20000);
    const response = await configurationLoaded;
    expect(response.ok(), 'NRVC_Hall Configuration Options should load successfully').toBeTruthy();
    await expect(this.page).toHaveURL(/\/configuration-options\/?$/i, { timeout: 30000 });
    await expect(this.confirmedLeadTime).toBeVisible();
  }

  async alternateAndSaveValues() {
    const fields = [
      { key: 'leadTime', locator: this.confirmedLeadTime, label: 'Lead Time' },
      { key: 'notOrderedAlert', locator: this.noWeeksBefore, label: 'Not Ordered Alert' },
      { key: 'notBookedAlert', locator: this.notBookedWeeksBefore, label: 'Not Booked Alert' }
    ];
    const expected = {};

    for (const field of fields) {
      const currentValue = await field.locator.inputValue();
      expected[field.key] = currentValue === '1' ? '2' : '1';
      await this.fillVisible(field.locator, expected[field.key], field.label);
    }

    await expect(this.saveButton).toBeEnabled();
    const configurationSaved = this.page.waitForResponse((response) => (
      response.url().includes('/api/project_config') && response.request().method() !== 'GET'
    ), { timeout: 30000 });
    await this.clickFirstVisible([{ locator: this.saveButton, label: 'Save configuration' }], 'Save configuration', 10000);
    const saveResponse = await configurationSaved;
    expect(saveResponse.ok(), 'Configuration Options should save successfully').toBeTruthy();

    const configurationReloaded = this.page.waitForResponse((response) => (
      /\/api\/project_config\/?\?project_id=(?!null(?:&|$))[^&]+/.test(response.url()) &&
      response.request().method() === 'GET' && response.ok()
    ), { timeout: 30000 });
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    const reloadResponse = await configurationReloaded;
    expect(reloadResponse.ok(), 'Saved Configuration Options should reload successfully').toBeTruthy();
    await this.waitForReady();
    await this.expectValues(expected);
    return expected;
  }

  async expectValues(expected) {
    await expect(this.confirmedLeadTime).toHaveValue(expected.leadTime);
    await expect(this.noWeeksBefore).toHaveValue(expected.notOrderedAlert);
    await expect(this.notBookedWeeksBefore).toHaveValue(expected.notBookedAlert);
  }

  async toggleCurrencyAndSave() {
    await expect(this.currencyButton).toBeVisible();
    const currentText = (await this.currencyButton.innerText()).replace(/\s+/g, ' ').trim();
    const targetCode = /^USD\b/i.test(currentText) ? 'INR' : 'USD';

    await this.clickFirstVisible([
      { locator: this.currencyButton, label: `Current currency ${currentText}` }
    ], 'Currency Type', 10000);
    const targetOption = this.page.locator('[role="option"]:visible').filter({
      hasText: new RegExp(`^${targetCode}\\b`, 'i')
    }).first();
    await expect(targetOption, `${targetCode} currency option should be available`).toBeVisible();
    await this.clickFirstVisible([
      { locator: targetOption, label: `${targetCode} currency` }
    ], `${targetCode} currency`, 10000);

    const configurationSaved = this.page.waitForResponse((response) => (
      response.url().includes('/api/project_config') && response.request().method() !== 'GET'
    ), { timeout: 30000 });
    await this.clickFirstVisible([
      { locator: this.saveButton, label: 'Save currency configuration' }
    ], 'Save currency configuration', 10000);
    const saveResponse = await configurationSaved;
    expect(saveResponse.ok(), 'Currency configuration should save successfully').toBeTruthy();

    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.waitForReady();
    await this.expectCurrency(targetCode);
    return targetCode;
  }

  async expectCurrency(currencyCode) {
    await expect(this.page.getByRole('button', {
      name: new RegExp(`^${currencyCode}\\b`, 'i')
    })).toBeVisible();
  }
}

module.exports = { ConfigurationOptionsPage };
