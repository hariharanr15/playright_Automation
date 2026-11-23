const { test, expect } = require('../../support/test-base');
const { ProjectSetupWizardPage } = require('../../../pages/project-management/project-setup-wizard.page');
const { MaterialCategoryPage } = require('../../../pages/project-management/material-category.page');
const { MaterialMasterPage } = require('../../../pages/project-management/material-master.page');
const { SupplierListPage } = require('../../../pages/user-management/supplier-list/supplier-list.page');

async function openWizard(scpProject) {
  const project = process.env.SCP_WIZARD_PROJECT;
  test.skip(!project, 'Set SCP_WIZARD_PROJECT to a dedicated project with an accessible setup wizard');
  await scpProject.projectSelector.ensureProject(project);
  const wizard = new ProjectSetupWizardPage(scpProject.page, scpProject.config);
  try { await wizard.open(); }
  catch (error) { await restoreProject(scpProject); throw error; }
  return wizard;
}

async function restoreProject({ page, projectSelector, config }) {
  await page.goto(config.managementDashboardUrl);
  await projectSelector.ensureProject(config.projectName);
}

test('Setup Wizard: nine-step order, new step controls, limits and Skip', async ({ scpProject }) => {
  const wizard = await openWizard(scpProject);
  try {
    await wizard.expectStepOrder();
    for (const name of ['Material Category', 'Materials', 'Suppliers', 'Suppliers->Materials']) {
      await wizard.expectStepConventions(name);
      await wizard.skipStep(name);
    }
    await wizard.selectStep('First Submittal');
    await expect(wizard.root.getByRole('button', { name: 'Finish', exact: true })).toBeVisible();
  } finally { await restoreProject(scpProject); }
});

test('Setup Wizard: create reference data, validate inputs and verify admin persistence', async ({ scpProject, runData }) => {
  test.skip(process.env.SCP_WIZARD_CREATE_DATA !== 'true', 'Set SCP_WIZARD_CREATE_DATA=true to create data in the dedicated wizard project');
  const uom = process.env.SCP_WIZARD_UOM;
  expect(Boolean(uom), 'Set SCP_WIZARD_UOM to an existing master Unit of Measure').toBe(true);
  const wizard = await openWizard(scpProject);
  const { page, dashboard } = scpProject;
  let category = `Wizard Category ${runData.runId}`;
  let material = `Wizard Material ${runData.runId}`;
  const supplier = `Wizard Supplier ${runData.runId}`;
  const supplierData = { 'Supplier Name': supplier, 'Contact Person': 'Automation Tester',
    'Contact Email': `wizard-${Date.now()}@example.com`,
    'Contact Phone No': process.env.SCP_WIZARD_PHONE || '+919876543210' };
  try {
    for (const name of ['Material Category', 'Materials', 'Suppliers', 'Suppliers->Materials']) {
      await wizard.selectStep(name);
      expect(await wizard.rows().count(), `${name} needs an available slot in the dedicated project`).toBeLessThan(5);
    }
    await wizard.addCategory(category);
    const categoryForm = await wizard.openPopup(category);
    await expect(categoryForm.getByLabel('Category Name', { exact: true })).toHaveValue(category);
    category += ' Revised';
    await wizard.fillFields(categoryForm, { 'Category Name': category });
    await wizard.savePopup(categoryForm, category);
    await wizard.addMaterial({ category, name: material, uom, packagingUnit: 'Box', multiplier: 10 });
    const materialForm = await wizard.openPopup(material);
    await expect(materialForm.getByLabel('Material Name', { exact: true })).toHaveValue(material);
    await wizard.rejectInvalidField(materialForm, 'Conversion Multiplier', '1.5');
    material += ' Revised';
    await wizard.fillFields(materialForm, { 'Material Name': material, 'Conversion Multiplier': 12 });
    await wizard.savePopup(materialForm, material);
    await wizard.selectStep('Suppliers');
    const supplierForm = await wizard.openPopup();
    await wizard.fillFields(supplierForm, supplierData);
    await wizard.rejectInvalidField(supplierForm, 'Contact Email', 'invalid-email');
    await wizard.fillFields(supplierForm, supplierData);
    await wizard.rejectInvalidField(supplierForm, 'Contact Phone No', 'invalid-phone');
    await wizard.fillFields(supplierForm, supplierData);
    await wizard.savePopup(supplierForm, supplier);
    const supplierEdit = await wizard.openPopup(supplier);
    await expect(supplierEdit.getByLabel('Contact Email', { exact: true })).toHaveValue(supplierData['Contact Email']);
    await wizard.rejectInvalidField(supplierEdit, 'Contact Email', 'invalid-email');
    await wizard.fillFields(supplierEdit, { 'Contact Email': supplierData['Contact Email'], 'Contact Person': 'Updated Tester' });
    await wizard.savePopup(supplierEdit, supplier);
    await wizard.selectStep('Suppliers->Materials');
    const mappingForm = await wizard.openPopup();
    await wizard.selectField(mappingForm, 'Supplier', supplier);
    await wizard.selectField(mappingForm, 'Material', material);
    await wizard.rejectInvalidField(mappingForm, 'Lead Time in Weeks', '-1');
    await wizard.fillFields(mappingForm, { 'Lead Time in Weeks': 0 });
    await wizard.savePopup(mappingForm, supplier);
    await expect(wizard.row(supplier)).toContainText(material);
    const mappingEdit = await wizard.openPopup(supplier);
    await expect(mappingEdit.getByLabel('Lead Time in Weeks', { exact: true })).toHaveValue('0');
    await wizard.fillFields(mappingEdit, { 'Lead Time in Weeks': 2 });
    await wizard.savePopup(mappingEdit, supplier);
    await wizard.selectStep('First Submittal');
    await wizard.root.getByRole('button', { name: 'Finish', exact: true }).click();
    await expect(page).toHaveURL(/\/management-dashboard\/?$/);
    await new MaterialCategoryPage(page).open(dashboard);
    await new MaterialCategoryPage(page).expectCategory(category);
    const materials = new MaterialMasterPage(page);
    await materials.open(dashboard);
    await materials.expectMaterial(material);
    const suppliers = new SupplierListPage(page);
    await suppliers.open();
    const supplierRow = page.getByRole('row').filter({ hasText: supplier });
    await expect(supplierRow).toBeVisible();
    runData.captureData('wizardCreatedRecords', { category, material, supplier }, 'Project Setup Wizard');
  } finally { await restoreProject(scpProject); }
});
