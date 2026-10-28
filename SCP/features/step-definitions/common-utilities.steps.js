const { Then, When } = require('@cucumber/cucumber');
const { CommonUtilitiesPage } = require('../../pages/project-management/common-utilities.page');

When('the user opens Common Utilities from Reference Data', async function () {
  this.commonUtilities = new CommonUtilitiesPage(this.page, this.config);
  await this.commonUtilities.open(this.dashboard);
});

When('the user adds a unique currency common utility', async function () {
  this.runData.commonUtilityName = `Srilankan Rupees ${this.runData.runId}`;
  await this.commonUtilities.add(this.runData.commonUtilityName, 'currency_type');
});

Then('the new common utility is displayed in search results', async function () {
  await this.commonUtilities.expectUtility(this.runData.commonUtilityName);
  await this.captureCheckpoint('TC_PM_CU_001_Common_Utility_Created');
});

When('the user updates the common utility name', async function () {
  this.runData.updatedCommonUtilityName = `${this.runData.commonUtilityName}.`;
  await this.commonUtilities.update(
    this.runData.commonUtilityName,
    this.runData.updatedCommonUtilityName,
    'currency_type'
  );
  this.runData.captureData(
    'commonUtility',
    this.runData.updatedCommonUtilityName,
    'Reference Data > Common Utilities'
  );
});

Then('the updated common utility is displayed in search results', async function () {
  await this.commonUtilities.expectUtility(this.runData.updatedCommonUtilityName);
  await this.captureCheckpoint('TC_PM_CU_001_Common_Utility_Updated');
  await this.commonUtilities.clearSearch();
});
