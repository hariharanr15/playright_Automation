const { test, expect } = require('../../support/test-base');
const { FirstDeliveryInspectionsPage } = require('../../../pages/first-delivery-inspections/first-delivery-inspections.page');

async function openRecords(scpProject, runData) {
  const { page, dashboard, config } = scpProject;
  const inspections = new FirstDeliveryInspectionsPage(page, config);
  await inspections.open(dashboard);
  test.skip(!(await inspections.hasRecords()), 'No FDI records were found in the past six months.');
  const record = await inspections.rowData(inspections.rows().first());
  runData.captureData('inspectionFilterRecord', record, 'First Delivery Inspections');
  const currentUser = runData.useData('currentUser', 'First Delivery Inspections').email.toLowerCase();
  return { page, inspections, record, currentUser };
}

test('FDI list: record states and allowed actions', async ({ scpProject, runData }) => {
  const { inspections, currentUser } = await openRecords(scpProject, runData);

  await test.step('Validate visible record states and allowed actions', async () => {
    const count = await inspections.rows().count();
    for (let index = 0; index < count; index += 1) {
      const row = inspections.rows().nth(index);
      const data = await inspections.rowData(row);
      if (/auditor not yet assigned/i.test(data.status)) {
        await expect(row.getByRole('button', { name: 'View', exact: true })).toHaveCount(0);
        expect(data.assignedTo).not.toContain('@');
        // Eligibility is material-specific; visibility alone does not grant Self Assign.
        if (process.env.SCP_FDI_CURRENT_USER_ELIGIBLE === 'true') {
          await expect(row.getByRole('button', { name: 'Self Assign', exact: true })).toBeVisible();
        }
      } else if (/awaiting inspection completion/i.test(data.status)) {
        await expect(row.getByRole('button', { name: 'View', exact: true })).toHaveCount(0);
        await expect(row.getByRole('button', { name: 'Self Assign', exact: true })).toHaveCount(0);
        expect(data.assignedTo).toContain('@');
        if (data.assignedTo.toLowerCase() === currentUser) {
          await expect(row.getByRole('button', { name: /Fill inspection report/i })).toBeVisible();
          await expect(row.getByRole('button', { name: /Unassign self/i })).toBeVisible();
        } else {
          await expect(row.getByRole('button', { name: /Fill inspection report|Unassign self/i })).toHaveCount(0);
        }
      } else if (/inspection completed/i.test(data.status)) {
        await expect(row.getByRole('button', { name: 'View' })).toBeVisible();
        const sync = row.getByRole('button', { name: 'Sync', exact: true });
        if (scpProject.config.defaultRole === 'admin') await expect(sync).toBeVisible();
        else await expect(sync).toHaveCount(0);
        await expect(row.getByRole('button', { name: /Fill inspection report/i })).toHaveCount(0);
      } else {
        throw new Error(`Unexpected inspection status: ${data.status}`);
      }
      const assign = row.getByRole('button', { name: 'Assign', exact: true });
      if (scpProject.config.defaultRole === 'admin' && !/inspection completed/i.test(data.status)) {
        await expect(assign).toBeVisible();
      } else await expect(assign).toHaveCount(0);
    }
  });
});

test('FDI draft: open an assigned report without changing it', async ({ scpProject, runData }) => {
  const { page, inspections, currentUser } = await openRecords(scpProject, runData);
  let owned = inspections.rows().filter({ hasText: /Awaiting inspection completion/i })
    .filter({ hasText: currentUser }).first();
  if (!(await owned.isVisible().catch(() => false))) {
    const available = inspections.rows().filter({ hasText: /Auditor not yet assigned/i })
      .filter({ has: page.getByRole('button', { name: 'Self Assign', exact: true }) }).first();
    await expect(available, 'An owned or self-assignable FDI draft should be available').toBeVisible();
    owned = await inspections.selfAssign(available, currentUser);
  }
  await test.step('Open an assigned draft without changing it', async () => {
    const ownedRecord = await inspections.rowData(owned);
    runData.captureData('editableInspectionViewed', ownedRecord, 'First Delivery Inspections');
    await inspections.openReport(owned);
    await expect(page.getByRole('heading', { name: 'First Delivery Inspection', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Progress' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit Inspection' })).toBeVisible();
    await expect(page.getByPlaceholder('Enter response...').first()).toBeVisible();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(inspections.recordRow(ownedRecord)).toContainText(/Awaiting inspection completion/i);
  });
});

test('FDI completed report: read-only view', async ({ scpProject, runData }) => {
  const { page, inspections } = await openRecords(scpProject, runData);
  const completed = inspections.rows().filter({ hasText: /Inspection completed/i }).first();
  test.skip(!(await completed.isVisible().catch(() => false)), 'No completed FDI report is available.');
  await test.step('Open a completed report in read-only mode', async () => {
    const completedRecord = await inspections.rowData(completed);
    runData.captureData('completedInspectionViewed', completedRecord, 'First Delivery Inspections');
    await completed.getByRole('button', { name: 'View' }).click();
    await expect(page.getByRole('heading', { name: 'Inspection Detail' })).toBeVisible();
    await expect(page.getByText('inspection completed', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Inspection Responses/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Progress' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Submit Inspection' })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Save Progress' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(inspections.recordRow(completedRecord)).toContainText(/Inspection completed/i);
  });
});

async function filterContext(scpProject, runData) {
  const { page, inspections, record } = await openRecords(scpProject, runData);
  const filters = page.locator('main').getByRole('combobox');
  const material = filters.nth(0);
  const supplier = filters.nth(1);
  const status = filters.nth(2);
  const assigned = page.getByPlaceholder('Inspector email');

  async function expectRowsMatch(column, expected) {
    await expect.poll(async () => {
      const count = await inspections.rows().count();
      if (!count) return false;
      for (let index = 0; index < count; index += 1) {
        const data = await inspections.rowData(inspections.rows().nth(index));
        if (data[column]?.toLowerCase() !== expected.toLowerCase()) return false;
      }
      return true;
    }, { timeout: 30000 }).toBe(true);
  }
  return { page, inspections, record, material, supplier, status, assigned, expectRowsMatch };
}

test('FDI filter: material', async ({ scpProject, runData }) => {
  const { material, record, expectRowsMatch } = await filterContext(scpProject, runData);
  await material.selectOption({ label: record.material });
  await expectRowsMatch('material', record.material);
});

test('FDI filter: supplier', async ({ scpProject, runData }) => {
  const { supplier, record, expectRowsMatch } = await filterContext(scpProject, runData);
  await supplier.selectOption({ label: record.supplier });
  await expectRowsMatch('supplier', record.supplier);
});

test('FDI filter: status', async ({ scpProject, runData }) => {
  const { status, record, expectRowsMatch } = await filterContext(scpProject, runData);
  await status.selectOption({ label: record.status });
  await expectRowsMatch('status', record.status);
});

test('FDI filter: assigned inspector', async ({ scpProject, runData }) => {
  const { assigned, record, expectRowsMatch } = await filterContext(scpProject, runData);
  test.skip(!record.assignedTo.includes('@'), 'Selected FDI record has no assigned inspector.');
  await assigned.fill(record.assignedTo);
  await expectRowsMatch('assignedTo', record.assignedTo);
});

test('FDI filter: inclusive delivery date boundaries and combined filters', async ({ scpProject, runData }) => {
  const { inspections, record, material, supplier, status, expectRowsMatch } =
    await filterContext(scpProject, runData);
  expect(record.deliveryDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  await inspections.setDeliveryDateRange(record.deliveryDate, record.deliveryDate);
  await expect(inspections.recordRow(record)).toBeVisible();
  await expectRowsMatch('deliveryDate', record.deliveryDate);
  await material.selectOption({ label: record.material });
  await supplier.selectOption({ label: record.supplier });
  await status.selectOption({ label: record.status });
  await expect(inspections.recordRow(record)).toBeVisible();
  await expectRowsMatch('material', record.material);
  await expectRowsMatch('supplier', record.supplier);
  await expectRowsMatch('status', record.status);
  await expectRowsMatch('deliveryDate', record.deliveryDate);
  await inspections.clearFilters();
  await expect(inspections.rows().first()).toBeVisible();
});

test('FDI filter: combined criteria', async ({ scpProject, runData }) => {
  const { inspections, record, material, supplier, status, assigned, expectRowsMatch } =
    await filterContext(scpProject, runData);
  if (record.assignedTo.includes('@')) await assigned.fill(record.assignedTo);
  await material.selectOption({ label: record.material });
  await expectRowsMatch('material', record.material);
  await supplier.selectOption({ label: record.supplier });
  await expectRowsMatch('supplier', record.supplier);
  await status.selectOption({ label: record.status });
  await expect(inspections.recordRow(record)).toBeVisible();
  await expectRowsMatch('status', record.status);
});

test('FDI filter: no-match and reset', async ({ scpProject, runData }) => {
  const { inspections, record, material, supplier, status, assigned } =
    await filterContext(scpProject, runData);
  await assigned.fill(`no-match-${runData.runId}@example.invalid`);
  await expect(inspections.recordRow(record)).toHaveCount(0);
  await assigned.clear();
  await expect(inspections.recordRow(record)).toBeVisible();
  await inspections.clearFilters();
  await expect(inspections.rows().first()).toBeVisible();
});

test('FDI operational: save, submit, view and sync', async ({ scpProject, runData }, testInfo) => {
  test.setTimeout(600000);
  const { page, inspections, currentUser } = await openRecords(scpProject, runData);
  const owned = inspections.rows().filter({ hasText: /Awaiting inspection completion/i })
    .filter({ hasText: currentUser }).first();
  const available = inspections.rows().filter({ has: page.getByRole('button', { name: /Self assign/i }) }).first();
  test.skip(!(await owned.isVisible().catch(() => false)) && !(await available.isVisible().catch(() => false)),
    'No editable or self-assignable FDI inspection is available.');
  let activeRecord;
  let answers;
  await test.step('Use an editable inspection or self-assign an unassigned one', async () => {
    if (await owned.isVisible().catch(() => false)) {
      activeRecord = await inspections.rowData(owned);
    } else {
      activeRecord = await inspections.rowData(available);
      await inspections.selfAssign(available, currentUser);
    }
    runData.captureData('inspectionBeingCompleted', activeRecord, 'First Delivery Inspections');
    await inspections.openReport(inspections.recordRow(activeRecord));
  });

  await test.step('Save and reopen the editable report', async () => {
    await inspections.saveProgress();
    answers = await inspections.fillReport(runData.runId);
    await inspections.saveProgress();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await inspections.openReport(inspections.recordRow(activeRecord));
    const inputs = await inspections.reportQuestions();
    for (let index = 0; index < answers.length; index += 1) {
      await expect(inputs.nth(index)).toHaveValue(answers[index]);
    }
    answers[0] += ' updated';
    await inputs.first().fill(answers[0]);
    await inspections.saveProgress();
    await expect(inputs.first()).toHaveValue(answers[0]);
  });

  await test.step('Submit and verify the completed report is read-only', async () => {
    if (await page.getByRole('button', { name: 'Add photo' }).isVisible().catch(() => false)) {
      const photo = testInfo.outputPath('inspection-photo.png');
      await page.screenshot({ path: photo });
      await inspections.uploadPhoto(photo);
    }
    await inspections.submit();
    for (const answer of answers) {
      await expect(page.getByText(`Response: ${answer}`, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Save Progress' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Submit Inspection' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    const completed = inspections.recordRow(activeRecord);
    await expect(completed).toContainText(/Inspection completed/i);
    await expect(completed.getByRole('button', { name: 'View' })).toBeVisible();
    await expect(completed.getByRole('button', { name: /Sync/i })).toBeVisible();
    await expect(completed.getByRole('button', { name: /Fill inspection report|Unassign self|Self assign/i })).toHaveCount(0);
    await completed.getByRole('button', { name: 'View' }).click();
    for (const answer of answers) {
      await expect(page.getByText(`Response: ${answer}`, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Save Progress' })).toHaveCount(0);
  });

  await test.step('Trigger provider sync once', async () => {
    await page.getByRole('button', { name: 'Sync to Provider' }).click();
    await expect(page.getByRole('status').or(page.getByText(/synced|sync failed|sync error/i)).first()).toBeVisible();
  });
});
