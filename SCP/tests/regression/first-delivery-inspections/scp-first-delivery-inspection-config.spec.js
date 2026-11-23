const { test, expect, runStep, expectVisible } = require('../../support/test-base');
const { PlatformChooserPage } = require('../../../pages/platform-chooser.page');
const { ManagementDashboardPage } = require('../../../pages/management-dashboard/management-dashboard.page');
const { FirstDeliveryInspectionConfigPage } = require('../../../pages/project-management/first-delivery-inspection-config.page');

test('FDI Settings: exact controls, persisted Yes/No states and photo dependency', async ({ scpProject }) => {
  const { page, dashboard } = scpProject;
  const configuration = new FirstDeliveryInspectionConfigPage(page);
  await configuration.open(dashboard);
  await configuration.expectSettingsSection();
  const original = await configuration.readSettings();
  try {
    for (const enabled of [false, true]) {
      const states = Object.fromEntries(configuration.settings.map(name => [name, enabled]));
      await test.step(`Save and reload all settings as ${enabled ? 'Yes' : 'No'}`, async () => {
        await configuration.saveSettings(states);
      });
    }
    await test.step('Prevent mandatory photos when photo uploads are disabled', async () => {
      await configuration.expectPhotoDependency();
    });
  } finally {
    await configuration.open(dashboard);
    await configuration.saveSettings(original);
  }
});

test('FDI Settings: default No on an unconfigured test project', async ({ scpProject }) => {
  const project = process.env.SCP_FDI_UNCONFIGURED_PROJECT;
  test.skip(!project, 'Set SCP_FDI_UNCONFIGURED_PROJECT to a project with no prior FDI configuration');
  const { page, dashboard, projectSelector, config } = scpProject;
  const configuration = new FirstDeliveryInspectionConfigPage(page);
  try {
    await projectSelector.ensureProject(project);
    await configuration.open(dashboard);
    await configuration.expectSettings(Object.fromEntries(configuration.settings.map(name => [name, false])));
  } finally {
    await page.goto(config.managementDashboardUrl);
    await projectSelector.ensureProject(config.projectName);
  }
});

test('FDI Settings: changes are isolated to the selected project', async ({ scpProject }) => {
  const secondProject = process.env.SCP_FDI_SECOND_PROJECT;
  test.skip(!secondProject, 'Set SCP_FDI_SECOND_PROJECT for cross-project isolation coverage');
  const { page, dashboard, projectSelector, config } = scpProject;
  expect(secondProject).not.toBe(config.projectName);
  const configuration = new FirstDeliveryInspectionConfigPage(page);
  await projectSelector.ensureProject(secondProject);
  await configuration.open(dashboard);
  const secondSettings = await configuration.readSettings();
  await page.goto(config.managementDashboardUrl);
  await projectSelector.ensureProject(config.projectName);
  await configuration.open(dashboard);
  const original = await configuration.readSettings();
  try {
    await configuration.saveSettings({ ...original,
      'Need Overall Notes to be captured': !original['Need Overall Notes to be captured'] });
    await page.goto(config.managementDashboardUrl);
    await projectSelector.ensureProject(secondProject);
    await configuration.open(dashboard);
    await configuration.expectSettings(secondSettings);
  } finally {
    await page.goto(config.managementDashboardUrl);
    await projectSelector.ensureProject(config.projectName);
    await configuration.open(dashboard);
    await configuration.saveSettings(original);
  }
});

test.describe('Regression Tests - SCP First Delivery Inspection Config', () => {
  test('Regression TC-01 - open First Delivery Inspection Config from Project Management', async ({ scpApp }) => {
    const { page, config } = scpApp;
    const platformChooser = new PlatformChooserPage(page, config);
    const dashboard = new ManagementDashboardPage(page, config);

    await runStep(page, 'Select Supply Chain Planner platform', async () => {
      await platformChooser.openSupplyChainPlanner();
    });

    await runStep(page, 'Open First Delivery Inspection Config', async () => {
      await dashboard.expectLoaded();
      await dashboard.openFirstDeliveryInspectionConfig();
    }, async () => {
      await expect(page).toHaveURL(config.firstDeliveryInspectionConfigUrl);
      await expectVisible(page.locator('body'), 'First Delivery Inspection Config page');
    });
  });
});
