const { Then, When } = require('@cucumber/cucumber');
const { ConfigurationOptionsPage } = require('../../pages/project-management/configuration-options.page');

When('the user opens Configuration Options', async function () {
  this.configurationOptions = new ConfigurationOptionsPage(this.page);
  await this.configurationOptions.open(this.dashboard);
});

When('the user alternates and saves the Project Management alert values', async function () {
  this.runData.configurationValues = await this.configurationOptions.alternateAndSaveValues();
  this.runData.captureData(
    'configurationValues',
    this.runData.configurationValues,
    'Project Management > Configuration Options'
  );
});

Then('the alternating Configuration Options values are persisted', async function () {
  await this.configurationOptions.expectValues(this.runData.configurationValues);
  await this.captureCheckpoint('TC_PM_CO_001_Configuration_Options');
});

When('the user switches and saves the Project Management currency', async function () {
  this.runData.currency = await this.configurationOptions.toggleCurrencyAndSave();
  this.runData.captureData(
    'projectCurrency',
    this.runData.currency,
    'Project Management > Configuration Options'
  );
});

Then('the alternate Project Management currency is persisted', async function () {
  await this.configurationOptions.expectCurrency(this.runData.currency);
  await this.captureCheckpoint('TC_PM_CO_002_Currency_Changed');
});
