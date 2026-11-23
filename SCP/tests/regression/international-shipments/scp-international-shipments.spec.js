const path = require('path');
const { test, expect, runStep: baseRunStep } = require('../../support/test-base');
const { ProcurementLogPage } = require('../../../pages/procurement-log/procurement-log.page');
const { InternationalShipmentsPage } = require('../../../pages/international-shipments/international-shipments.page');
const { requireRunDataset } = require('../../../utils/run-dataset');
const { ScpBlocked } = require('../../../utils/scp-readonly');
const OPERATION_PAUSE_MS = Number(process.env.SCP_MODULE_OPERATION_PAUSE_MS || 1500);
const runStep = (page, title, action, validate) => baseRunStep(page, title, action, validate, {
  waitMs: OPERATION_PAUSE_MS,
  afterActionWaitMs: OPERATION_PAUSE_MS
});

test('International Shipment follows a current-run Procurement Log submittal', async ({ scpProject, runData }) => {
  test.setTimeout(600000);
  const { page } = scpProject;
  const procurement = new ProcurementLogPage(page);
  const shipments = new InternationalShipmentsPage(page);
  // The run's shared submittal (created once by the Procurement Log module) is flagged; no submittal is created here.
  const shared = requireRunDataset(scpProject.config.projectName, ScpBlocked);
  const data = { submittalNumber: shared.data.submittalNumber };
  let before;
  let record;

  await runStep(page, 'Capture International Shipment KPI before flagging', async () => {
    await shipments.open();
    before = await shipments.totalCount();
  });
  await runStep(page, `Use the shared run submittal ${data.submittalNumber}`, async () => {
    await procurement.open();
    if (shared.site) await scpProject.siteSelector.ensureSite(shared.site);
    await procurement.searchExactSubmittal(data.submittalNumber);
    runData.captureData('internationalSubmittal', data.submittalNumber, 'Procurement Log');
  });
  await runStep(page, 'Flag the exact procurement record as international', async () => {
    record = await shipments.flagProcurementRecord(
      runData.useData('internationalSubmittal', 'International Shipments'), 'China', 'Shenzhen'
    );
    runData.captureData('flaggedInternationalRecord', record, 'Procurement Log');
  });
  await runStep(page, 'Verify the linked record and KPI increase', async () => {
    await shipments.open();
    const flagged = runData.useData('flaggedInternationalRecord', 'International Shipments');
    await expect(shipments.row(flagged.submittalNumber)).toContainText(flagged.manufacturerName);
    await expect(shipments.row(flagged.submittalNumber)).toContainText(flagged.country);
    await expect.poll(() => shipments.totalCount()).toBe(before + 1);
  });
  await runStep(page, 'Log shipment mapped to the same submittal', async () => {
    const container = await shipments.logShipment(record, runData.runId);
    runData.captureData('internationalContainer', container, 'International Shipments');
    await shipments.openShipmentsTab();
    await expect(shipments.shipmentRow(container)).toBeVisible({ timeout: 30000 });
  });
  await runStep(page, 'Edit and retain shipping information for the logged container', async () => {
    const container = runData.useData('internationalContainer', 'Shipment edit');
    const reference = `BL-UPDATED-${runData.runId}`;
    await shipments.editShippingInfo(container, reference);
    await page.reload();
    await shipments.openShipmentsTab();
    await expect(shipments.shipmentRow(container)).toContainText(reference);
    runData.captureData('updatedShippingReference', reference, 'International Shipments');
  });
  await runStep(page, 'Set and retain the shipment status without duplicating the record', async () => {
    await page.getByRole('button', { name: 'Risk Dashboard', exact: true }).click();
    await shipments.setStatus(record.submittalNumber, 'Ordered');
  });
});
