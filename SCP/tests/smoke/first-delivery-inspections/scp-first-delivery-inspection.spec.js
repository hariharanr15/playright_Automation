const { test, expect } = require('../../support/test-base');
const { FirstDeliveryInspectionsPage } = require('../../../pages/first-delivery-inspections/first-delivery-inspections.page');

test('FDI smoke: use an existing eligible inspection', async ({ scpProject, runData }, testInfo) => {
  test.setTimeout(600000);
  const { page, dashboard, config } = scpProject;
  const inspections = new FirstDeliveryInspectionsPage(page, config);
  const email = runData.useData('currentUser', 'First Delivery Inspections').email;
  const targetSubmittal = process.env.SCP_FDI_SMOKE_SUBMITTAL;

  let record;
  await test.step('Find an existing eligible inspection', async () => {
    await inspections.open(dashboard);
    test.skip(!(await inspections.hasRecords()), 'No FDI records are available in the past six months.');
    const targeted = targetSubmittal
      ? inspections.rows().filter({ hasText: targetSubmittal }).first()
      : null;
    const eligibleTarget = targeted?.filter({
      has: page.getByRole('button', { name: /Self assign|Fill Inspection Report/i })
    });
    const owned = inspections.rows().filter({ hasText: /Awaiting inspection completion/i })
      .filter({ hasText: email }).first();
    const available = inspections.rows().filter({ has: page.getByRole('button', { name: /Self assign/i }) }).first();
    const row = eligibleTarget && await eligibleTarget.isVisible().catch(() => false)
      ? eligibleTarget
      : await owned.isVisible().catch(() => false) ? owned : available;
    test.skip(!(await row.isVisible().catch(() => false)), 'No editable or self-assignable FDI record is available.');
    record = await inspections.rowData(row);
    runData.captureData('inspectionRecord', record, 'First Delivery Inspections');
    if (/Auditor not yet assigned/i.test(record.status)) await inspections.selfAssign(row, email);
  });

  await test.step('Open the existing inspection report', async () => {
    await inspections.openReport(inspections.recordRow(record));
    await expect(page.getByRole('heading', { name: 'First Delivery Inspection', exact: true })).toBeVisible();
  });

  let answers;
  await test.step('Save progress and retain report values', async () => {
    answers = await inspections.fillReport(runData.runId);
    await inspections.saveProgress();
    const inputs = await inspections.reportQuestions();
    for (let index = 0; index < answers.length; index += 1) {
      await expect(inputs.nth(index)).toHaveValue(answers[index]);
    }
  });

  await test.step('Submit inspection and view completed record', async () => {
    const photoInput = page.locator('input[type="file"]').first();
    if (await photoInput.count()) {
      const photo = testInfo.outputPath('inspection-photo.png');
      await page.screenshot({ path: photo });
      await inspections.uploadPhoto(photo);
    }
    await inspections.submit();
    for (const answer of answers) await expect(page.getByText(`Response: ${answer}`, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Progress' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    const row = inspections.recordRow(record);
    await expect(row).toContainText(/Inspection completed/i);
    await expect(row.getByRole('button', { name: /Fill inspection report/i })).toHaveCount(0);
    await row.getByRole('button', { name: 'View' }).click();
    await expect(page.getByRole('heading', { name: 'Inspection Detail' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Progress' })).toHaveCount(0);
  });
});
