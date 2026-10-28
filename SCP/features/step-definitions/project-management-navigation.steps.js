const { Given, Then, When } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

Given('the {string} user is logged into SCP', async function (role) {
  await this.loginAs(role);
  if (this.primarySessionReused) {
    await this.projectSelector.expectActiveProject(this.config.projectName);
  } else {
    await expect(this.page.getByRole('link', { name: this.config.platformName, exact: true })).toBeVisible();
  }
});

Given('the user opens the Supply Chain Planner platform', async function () {
  await this.openScpPlatform();
});

Given('the active SCP project is {string}', async function (projectName) {
  if (projectName !== this.config.projectName) {
    throw new Error(`Feature requested ${projectName}, but SCP_PROJECT_NAME is ${this.config.projectName}.`);
  }
  await this.ensureProject(projectName);
  this.runData.captureData(
    'activeProject',
    await this.projectSelector.activeProjectName(),
    'Project Selection'
  );
  this.runData.captureData(
    'activeOrganization',
    await this.projectSelector.activeOrganizationName(),
    'Project Selection > Session Organization'
  );
  this.runData.captureData(
    'activeProjectReference',
    await this.projectSelector.activeProjectReference(),
    'Project Selection > Session Project Reference'
  );
  await this.captureCheckpoint('TC_PM_001_NRVC_Hall_Selected');
});

When('the user opens Project Management', async function () {
  await this.openProjectManagement();
});

Then('the Project Management navigation is available', async function () {
  await expect(this.page.getByRole('button', { name: 'Reference Data', exact: true })).toBeVisible();
  await this.captureCheckpoint('TC_PM_001_Project_Management_Opened');
});
