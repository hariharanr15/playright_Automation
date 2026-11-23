const { test, expect } = require('../../support/test-base');
const { FirstDeliveryInspectionsPage } = require('../../../pages/first-delivery-inspections/first-delivery-inspections.page');
const { isHeadless } = require('../../../utils/execution-mode');

test.beforeAll(() => {
  const missing = ['SCP_FDI_SMOKE_SITE', 'SCP_FDI_SMOKE_SUBMITTAL']
    .filter(name => !process.env[name]?.trim());
  if (missing.length) {
    throw new Error(`FDI demo preflight: configure ${missing.join(', ')} with a dedicated eligible inspection and its site. Each successful run completes its inspection; use a fresh dedicated record for the next run.`);
  }
});

test('FDI smoke: use an existing eligible inspection', async ({ scpProject, runData }, testInfo) => {
  test.setTimeout(600000);
  const { page, dashboard, config, projectSelector, siteSelector } = scpProject;
  const inspections = new FirstDeliveryInspectionsPage(page, config);
  const email = runData.useData('currentUser', 'First Delivery Inspections').email;
  const targetSubmittal = process.env.SCP_FDI_SMOKE_SUBMITTAL.trim();
  const targetSite = process.env.SCP_FDI_SMOKE_SITE.trim();
  if (!email) throw new Error('FDI demo preflight: current-user identity is unavailable.');
  const dedicatedRow = () => inspections.rows().filter({
    has: page.getByRole('cell', { name: targetSubmittal, exact: true })
  });
  const expectContext = async () => {
    await projectSelector.expectActiveProject(config.projectName);
    await expect(siteSelector.siteSelector, 'Exact dedicated FDI site must be selected')
      .toHaveText(targetSite);
  };

  let record;
  await test.step('Find an existing eligible inspection', async () => {
    await projectSelector.expectActiveProject(config.projectName);
    await siteSelector.ensureSite(targetSite);
    await inspections.open(dashboard);
    await expectContext();
    const row = dedicatedRow();
    await expect(row, 'Dedicated FDI submittal must identify exactly one loaded record')
      .toHaveCount(1, { timeout: 30000 });
    record = await inspections.rowData(row);
    expect(record.submittal).toBe(targetSubmittal);
    await testInfo.attach('dedicated-inspection-before-assignment', {
      body: await page.screenshot({ fullPage: isHeadless() }), contentType: 'image/png'
    });
    runData.captureData('inspectionRecord', record, 'First Delivery Inspections');
    if (/^Auditor not yet assigned$/i.test(record.status)) {
      await expect(row.getByRole('button', { name: /^Self assign$/i })).toBeVisible();
      await inspections.selfAssign(row, email);
    } else {
      expect(record.status, 'Dedicated inspection must await completion; completed records cannot be reused')
        .toMatch(/^Awaiting inspection completion$/i);
      expect(record.assignedTo.toLowerCase(), 'Dedicated inspection must belong to the current user')
        .toBe(email.trim().toLowerCase());
    }
    await expectContext();
    const updatedRow = dedicatedRow();
    await expect(updatedRow).toHaveCount(1);
    await expect(updatedRow.getByRole('cell', { name: email.trim(), exact: true })).toBeVisible();
    await expect(updatedRow.getByRole('cell', { name: /^Awaiting inspection completion$/i })).toBeVisible();
    await expect(updatedRow.getByRole('button', { name: /^Fill inspection report$/i })).toBeVisible();
    await testInfo.attach('assigned-inspection', {
      body: await page.screenshot({ fullPage: isHeadless() }), contentType: 'image/png'
    });
  });

  await test.step('Open the existing inspection report', async () => {
    await expectContext();
    await expect(dedicatedRow()).toHaveCount(1);
    await inspections.openReport(dedicatedRow());
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
    await expectContext();
    const row = dedicatedRow();
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(/Inspection completed/i);
    await expect(row.getByRole('button', { name: /Fill inspection report/i })).toHaveCount(0);
    const refreshedList = page.waitForResponse(response =>
      new URL(response.url()).pathname === '/api/first_delivery_inspection/list_inspections/' &&
      response.request().method() === 'GET');
    await page.reload({ waitUntil: 'domcontentloaded' });
    const response = await refreshedList;
    expect(response.ok(), 'Refreshed FDI list request must succeed').toBe(true);
    await response.finished();
    await projectSelector.expectActiveProject(config.projectName);
    await expect(row).toHaveCount(1);
    await expect(row.getByRole('cell', { name: /^Inspection completed$/i })).toBeVisible();
    await expect(row.getByRole('button', { name: /Fill inspection report/i })).toHaveCount(0);
    await testInfo.attach('completed-inspection-after-refresh', {
      body: await page.screenshot({ fullPage: isHeadless() }), contentType: 'image/png'
    });
    await row.getByRole('button', { name: 'View' }).click();
    await expect(page.getByRole('heading', { name: 'Inspection Detail' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Progress' })).toHaveCount(0);
  });
});
