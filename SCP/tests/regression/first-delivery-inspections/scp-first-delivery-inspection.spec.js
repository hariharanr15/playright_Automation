const path = require('path');
const { test, expect, runStep } = require('../../support/test-base');
const { FirstDeliveryInspectionConfigPage } = require('../../../pages/project-management/first-delivery-inspection-config.page');
const { FirstDeliveryInspectionsPage } = require('../../../pages/first-delivery-inspections/first-delivery-inspections.page');
const { MaterialMasterPage } = require('../../../pages/project-management/material-master.page');
const { SupplierListPage } = require('../../../pages/user-management/supplier-list/supplier-list.page');
const { loadJsonFile } = require('../../../utils/data-loader');
const { createProcurementLogData } = require('../../../utils/dynamic-data');
const { runProcurementLogFlow } = require('../../support/procurement-log-flow');

const procurementDefaults = loadJsonFile(
  path.resolve(__dirname, '..', '..', '..', 'test-data', 'procurement-log.json'),
  {}
);

test('FDI regression: assignment, draft, required photo, completion and sync', async ({ scpProject, runData }, testInfo) => {
  test.setTimeout(900000);
  const { page, dashboard, config, siteSelector } = scpProject;
  const configuration = new FirstDeliveryInspectionConfigPage(page);
  const inspections = new FirstDeliveryInspectionsPage(page, config);
  const materials = new MaterialMasterPage(page);
  const suppliers = new SupplierListPage(page);
  const email = runData.useData('currentUser', 'First Delivery Inspections').email;
  const question = runData.useData('fdiQuestion', 'First Delivery Inspection Config');
  const supplier = process.env.SCP_FDI_REGRESSION_SUPPLIER || procurementDefaults.supplier;
  const materialName = `FDI Material ${runData.runId}-${runData.nextSequence()}`;
  const procurementData = {
    ...procurementDefaults,
    ...createProcurementLogData(runData.runId),
    supplier,
    material: materialName,
    componentItem: materialName
  };
  const photo = testInfo.outputPath('inspection-photo.png');
  const secondPhoto = testInfo.outputPath('inspection-photo-2.jpg');
  let record;
  let answers;
  await configuration.open(dashboard);
  const originalSettings = await configuration.readSettings();
  runData.captureData('originalFdiSettings', originalSettings, 'First Delivery Inspection Config');
  const reportSettings = Object.fromEntries(configuration.settings.map(name => [name, true]));

  try {
    await test.step('Create a question for the current-run inspection', async () => {
      await configuration.saveSettings(reportSettings);
      await configuration.verifyBlankQuestionIsRejected();
      await configuration.addQuestion(question, 'text');
      runData.captureData('configuredInspectionQuestion', question, 'First Delivery Inspection Config');
    });

    await test.step('Create a unique material', async () => {
      await materials.open(dashboard);
      const material = await materials.addMaterial(
        materialName,
        process.env.SCP_FDI_MATERIAL_CATEGORY,
        process.env.SCP_FDI_MATERIAL_UOM
      );
      runData.captureData('fdiMaterial', material, 'Material Master');
    });

    await test.step(`Map ${materialName} to ${supplier}`, async () => {
      await suppliers.open();
      const mapping = await suppliers.mapMaterial(supplier, materialName);
      runData.captureData('fdiSupplierMapping', mapping, 'Supplier List');
    });

    await test.step('Complete the existing Procurement Log functional flow', async () => {
      await runProcurementLogFlow({
        page,
        siteSelector,
        runData,
        data: procurementData,
        runStep,
        dataPrefix: 'fdiProcurement'
      });
    });

    await test.step('Open the generated current-run inspection', async () => {
      await inspections.open(dashboard);
      await inspections.ensureRecords();
    });

    await test.step('Check row states and assignment permissions', async () => {
      const row = await inspections.waitForGeneratedRecord({
        material: materialName,
        supplier,
        submittal: procurementData.submittalNumber
      });
      await expect(row).toContainText(/Auditor not yet assigned/i);
      record = await inspections.rowData(row);
      expect((await inspections.rowData(inspections.rows().first())).submittal,
        'The freshly created inspection must appear first regardless of its delivery date').toBe(record.submittal);
      runData.captureData('inspectionRecord', record, 'First Delivery Inspections');
      expect(record.assignedTo).not.toContain('@');
      const other = inspections.rows().filter({ hasText: /Awaiting inspection completion/i })
        .filter({ hasNotText: email }).first();
      if (await other.isVisible().catch(() => false)) {
        const otherData = await inspections.rowData(other);
        expect(otherData.assignedTo).toContain('@');
        await expect(other.getByRole('button', { name: /Fill inspection report|Unassign self/i })).toHaveCount(0);
      }
      await inspections.selfAssign(row, email);
      await inspections.unassign(inspections.recordRow(record), email);
      if (config.defaultRole === 'admin') {
        await inspections.assignInspector(inspections.recordRow(record), email);
        await inspections.expectAssigneeActions(inspections.recordRow(record), true);
        await inspections.unassign(inspections.recordRow(record), email);
      }
      await inspections.selfAssign(inspections.recordRow(record), email);
    });

    await test.step('Save and reopen the editable inspection twice', async () => {
      await inspections.openReport(inspections.recordRow(record));
      await inspections.expectReportSettings(reportSettings);
      await inspections.expectSpecDocumentState({ specSectionNo: procurementData.specificationNumber, documents: [] });
      await expect(page.getByText(question, { exact: false }).first()).toBeVisible();
      answers = await inspections.fillReport(runData.runId);
      await inspections.saveProgress();
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      await inspections.openReport(inspections.recordRow(record));
      const inputs = await inspections.reportQuestions();
      for (let index = 0; index < answers.length; index += 1) {
        await expect(inputs.nth(index)).toHaveValue(answers[index]);
      }
      await inputs.first().fill(`${answers[0]} revised`);
      answers[0] += ' revised';
      await inspections.saveProgress();
      await expect(inputs.first()).toHaveValue(answers[0]);
    });

    await test.step('Project settings hide report sections and apply to the saved draft', async () => {
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      await configuration.open(dashboard);
      await configuration.saveSettings(Object.fromEntries(configuration.settings.map(name => [name, false])));
      await inspections.open(dashboard);
      await inspections.openReport(inspections.recordRow(record));
      await inspections.expectReportSettings(Object.fromEntries(configuration.settings.map(name => [name, false])));
      await expect(page.getByPlaceholder('Enter response...').first()).toHaveValue(answers[0]);
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      await configuration.open(dashboard);
      await configuration.saveSettings(reportSettings);
      await inspections.open(dashboard);
      await inspections.openReport(inspections.recordRow(record));
    });

    await test.step('Reject a non-image attachment without losing saved answers', async () => {
      await inspections.rejectNonImage();
      await expect(page.getByPlaceholder('Enter response...').first()).toHaveValue(answers[0]);
    });

    if (config.defaultRole === 'admin' && process.env.SCP_FDI_REASSIGN_INSPECTOR) {
      await test.step('Reassign the draft and retain its answers when assigning it back', async () => {
        await page.getByRole('button', { name: 'Back', exact: true }).click();
        const target = process.env.SCP_FDI_REASSIGN_INSPECTOR;
        expect(target).not.toBe(email);
        await inspections.assignInspector(inspections.recordRow(record), target);
        await inspections.expectAssigneeActions(inspections.recordRow(record), false);
        await inspections.assignInspector(inspections.recordRow(record), email);
        await inspections.expectAssigneeActions(inspections.recordRow(record), true);
        await inspections.openReport(inspections.recordRow(record));
        const inputs = await inspections.reportQuestions();
        for (let index = 0; index < answers.length; index += 1) await expect(inputs.nth(index)).toHaveValue(answers[index]);
      });
    } else {
      testInfo.annotations.push({ type: 'coverage-gap', description: 'Reassignment needs an admin session and SCP_FDI_REASSIGN_INSPECTOR' });
    }

    await test.step('Reject incomplete submission and retain the draft', async () => {
      await inspections.expectMandatoryPhotoBlocked();
      await expect(page.getByPlaceholder('Enter response...').first()).toHaveValue(answers[0]);
    });

    await test.step('Complete and inspect the read-only report', async () => {
      await page.screenshot({ path: photo });
      await inspections.uploadPhoto(photo);
      await page.screenshot({ path: secondPhoto });
      await inspections.uploadPhoto(secondPhoto);
      await inspections.expectPhotoViewer(inspections.photoThumbnails());
      await inspections.submit();
      await inspections.expectPhotoViewer(inspections.photoThumbnails());
      await expect(page.getByText(question, { exact: false }).first()).toBeVisible();
      for (const answer of answers) await expect(page.getByText(`Response: ${answer}`, { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Save Progress' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Submit Inspection' })).toHaveCount(0);
      await page.reload();
      await expect(page.getByRole('button', { name: 'Save Progress' })).toHaveCount(0);
      await expect(page.getByText(`Response: ${answers[0]}`, { exact: true })).toBeVisible();
    });

    await test.step('Trigger provider sync once and verify feedback', async () => {
      await page.getByRole('button', { name: 'Sync to Provider' }).click();
      await expect(page.getByRole('status').or(page.getByText(/synced|sync failed|sync error/i)).first()).toBeVisible();
    });

    await test.step('Verify completed list row', async () => {
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      const row = inspections.recordRow(record);
      await expect(row).toContainText(/Inspection completed/i);
      await expect(row.getByRole('button', { name: /Fill inspection report|Unassign self|Self assign/i })).toHaveCount(0);
      await expect(row.getByRole('button', { name: 'View' })).toBeVisible();
      await expect(row.getByRole('button', { name: /Sync/i })).toBeVisible();
      await row.getByRole('button', { name: 'View' }).click();
      await expect(page.getByRole('heading', { name: 'Inspection Detail' })).toBeVisible();
      for (const answer of answers) {
        await expect(page.getByText(`Response: ${answer}`, { exact: true })).toBeVisible();
      }
      await expect(page.getByRole('button', { name: 'Save Progress' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Submit Inspection' })).toHaveCount(0);
    });
  } finally {
    // Direct navigation also recovers from a failed test leaving a blocking modal open.
    await page.goto(config.firstDeliveryInspectionConfigUrl, { waitUntil: 'domcontentloaded' });
    await expect(configuration.heading).toBeVisible();
    await configuration.saveSettings(originalSettings);
  }
});
