const fs = require('fs');
const { randomUUID } = require('crypto');
const { test, expect } = require('../../../fixtures/baseTest');
const { ProcurementLogPage } = require('../../../pages/procurement-log/procurement-log.page');
const { InternationalShipmentsPage } = require('../../../pages/international-shipments/international-shipments.page');
const { createInventoryData } = require('../../../utils/dynamic-data');
const { readInventoryApi } = require('../../../utils/inventory-data');
const { InventoryRecoverySources, complete, missing } = require('../../../utils/inventory-recovery');
const { managedStep } = require('../../../utils/scp-step');
const { ScpBlocked } = require('../../../utils/scp-readonly');
const { isHeadless } = require('../../../utils/execution-mode');

test('SCP-IS-101 Owned submittal: international flag, shipment, shipping edit and status persistence', async ({ scpProject: ctx, executionJournal: journal }, info) => {
  info.setTimeout(600000);
  if (process.env.SCP_SHIPMENT_OWNED_MUTATIONS !== 'true') throw new ScpBlocked('Enable SCP_SHIPMENT_OWNED_MUTATIONS with qualified reference and route allocations');
  if (!new URL(ctx.config.baseUrl).hostname.startsWith('stg-')) throw new ScpBlocked('Owned shipment mutations are limited to configured staging');
  const inputs = [process.env.SCP_SHIPMENT_OWNED_DATA, process.env.SCP_SHIPMENT_ROUTE_DATA];
  if (inputs.some(file => !file || !fs.existsSync(file))) throw new ScpBlocked('SCP_SHIPMENT_OWNED_DATA and SCP_SHIPMENT_ROUTE_DATA are required');
  const [reference, route] = inputs.map(file => JSON.parse(fs.readFileSync(file, 'utf8')));
  expect(reference.project).toBe(ctx.config.projectName); expect(reference.sourceCase).toBeTruthy();
  expect(reference.data.grn.file_size).toBeGreaterThan(0);
  expect(route.projectId).toBe(await ctx.projectSelector.activeProjectReference());
  for (const key of ['country', 'city', 'loadingPort', 'dischargePort']) expect(typeof route[key] === 'string' && !!route[key].trim(), key).toBe(true);
  expect(route.sourceIds.length).toBeGreaterThan(0);
  journal.scenario.module = 'International Shipment';
  journal.scenario.objective = 'Create and verify a dedicated shipment using validated reference data and a qualified project route; never alter source shipments';
  const data = journal.data('ownedShipmentData', () => ({ ...createInventoryData(), material: reference.master.material_name,
    supplier: reference.data.supplier, supplierDetails: reference.data.supplierDetails, componentItem: reference.master.material_name,
    leadTime: reference.data.leadTime, inventorySetup: true, expectedUom: reference.master.uom_name, expectedCategory: reference.master.category,
    ownerProject: reference.project, ownerSite: reference.site }));
  expect(data.material).toBe(reference.master.material_name); expect(data.supplier).toBe(reference.data.supplier);
  expect(data.submittalNumber).not.toBe(reference.data.submittalNumber);
  expect(data.submittalNumber).not.toBe('SUB-2026-525');
  const runId = journal.data('shipmentRunId', () => randomUUID().slice(0, 16));
  const container = `SCP-${runId}`; const updatedReference = `BL-UPDATED-${runId}`;
  const procurement = new ProcurementLogPage(ctx.page); const shipments = new InternationalShipmentsPage(ctx.page);
  const read = (endpoint, params) => readInventoryApi(ctx.page, endpoint, params);
  const sources = new InventoryRecoverySources({ page: ctx.page, read }, data);
  const ownedIds = new Set([data.submittalId, ...(journal.state.data.ownedShipmentIds || [])].filter(Boolean));
  const forbidden = []; const origin = new URL(ctx.config.baseUrl).origin;
  const guard = routeRequest => {
    const request = routeRequest.request(); const url = new URL(request.url());
    if (url.origin !== origin || ['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return routeRequest.continue();
    const scopedPath = /^\/api\/(submittal_master|submittal_schedule|international_shipment)\//.test(url.pathname);
    const payload = `${url.pathname} ${request.postData() || ''}`;
    const owned = payload.includes(data.submittalNumber) || payload.includes(container) || [...ownedIds].some(id => payload.includes(id));
    if (scopedPath && owned) return routeRequest.continue();
    forbidden.push({ method: request.method(), path: url.pathname }); return routeRequest.abort('blockedbyclient');
  };
  await ctx.scpSession.context.route('**/api/**', guard);
  async function trackSubmittal() {
    const record = await sources.submittalRecordForNumber();
    if (record) { data.submittalId = record.submittal_id; ownedIds.add(record.submittal_id); journal.setData('ownedShipmentData', data); }
    return record;
  }
  async function live() {
    const body = await read('international_shipment/list-by-project/');
    expect(Array.isArray(body.data)).toBe(true);
    const rows = body.data.filter(record => record.submittal === data.submittalId);
    for (const record of rows) {
      expect(record.submittal_no).toBe(data.submittalNumber);
      expect(record.project_id).toBe(route.projectId);
      expect(route.sourceIds).not.toContain(record.shipment_id);
      ownedIds.add(record.shipment_id);
    }
    journal.setData('ownedShipmentIds', rows.map(record => record.shipment_id));
    return rows;
  }
  const ids = ['shipment-reference', 'shipment-submittal', 'shipment-flag', 'shipment-log', 'shipment-edit', 'shipment-status'];
  journal.define(ids.map((id, index) => ({ id, name: id, dependsOn: index ? [ids[index - 1]] : [] })));
  const step = (index, name, action, verify) => managedStep(test, ctx.page, name, action,
    { id: ids[index], dependsOn: index ? [ids[index - 1]] : [], mutation: index > 0, verify });
  try {
    await step(0, 'Validate existing owned material, SKU, supplier and mapping', async () => {
      expect((await sources.material()).status).toBe('complete');
      expect(sources.masterRecord.material_master_id).toBe(reference.master.material_master_id);
      expect((await sources.supplier()).status).toBe('complete');
    });
    await step(1, 'Create only the missing dedicated submittal and component', async () => {
      await procurement.open(); await procurement.restoreOwnedContext(data);
      if (!await trackSubmittal()) await procurement.createSubmittal(data);
      await trackSubmittal(); await procurement.searchExactSubmittal(data.submittalNumber);
      if (!await sources.component()) await procurement.addComponent(data);
    }, async () => { await trackSubmittal(); return sources.submittal(); });
    await step(2, 'Flag only the dedicated submittal with the qualified origin', async () => {
      await shipments.flagProcurementRecord(data.submittalNumber, route.country, route.city);
    }, async () => {
      const all = await live();
      const rows = all.filter(record => !record.container_number);
      expect(rows.length, 'An owned international flag must not be duplicated').toBeLessThanOrEqual(1);
      if (!rows.length) {
        const existing = all.find(record => record.container_number === container && record.manufacturer_country === route.country);
        return existing ? complete(existing) : missing();
      }
      expect(rows[0].manufacturer_country).toBe(route.country); expect(rows[0].manufacturer_city).toBe(route.city);
      return complete(rows[0]);
    });
    await step(3, 'Log one uniquely numbered container for the same owned submittal', async () => {
      const flagged = (await live()).find(record => !record.container_number);
      await shipments.open();
      expect(await shipments.logShipment({ submittalNumber: data.submittalNumber, manufacturerName: flagged.manufacturer_name, ...route }, runId)).toBe(container);
    }, async () => {
      const rows = (await live()).filter(record => record.container_number === container);
      expect(rows.length, 'The same container must never be submitted twice').toBeLessThanOrEqual(1);
      if (!rows.length) return missing();
      expect(rows[0].port_of_origin).toBe(route.loadingPort); expect(rows[0].port_of_destination).toBe(route.dischargePort);
      return complete(rows[0]);
    });
    await step(4, 'Edit and reload the shipping reference of only the owned container', async () => {
      await shipments.open(); await shipments.openShipmentsTab(); await shipments.editShippingInfo(container, updatedReference);
    }, async () => {
      const record = (await live()).find(row => row.container_number === container);
      if (record.bill_of_lading !== updatedReference) return missing();
      expect(record.shipping_line).toBe('Updated Automation Shipping Line'); return complete(record);
    });
    await step(5, 'Set Ordered status and verify persistence without another record', async () => {
      await shipments.open(); await ctx.page.getByRole('button', { name: 'Risk Dashboard', exact: true }).click();
      await shipments.setStatus(data.submittalNumber, 'Ordered');
    }, async () => {
      const rows = await live();
      const updated = rows.find(record => record.status === 'ordered');
      return updated ? complete(updated) : missing();
    });
    const rows = await live(); expect(rows.length).toBeGreaterThanOrEqual(1); expect(rows.length).toBeLessThanOrEqual(2);
    expect(rows.filter(record => !record.container_number).length).toBeLessThanOrEqual(1);
    expect(rows.filter(record => record.container_number === container)).toHaveLength(1);
    journal.setData('completedOwnedShipment', { submittal: data.submittalNumber, container, route, records: rows });
    await shipments.open(); await shipments.openShipmentsTab(); await expect(shipments.shipmentRow(container)).toContainText(updatedReference);
    await info.attach('owned-shipment-completed', { body: await ctx.page.screenshot({ fullPage: isHeadless() }), contentType: 'image/png' });
  } finally {
    await ctx.scpSession.context.unroute('**/api/**', guard);
    journal.setData('forbiddenShipmentWrites', forbidden);
    expect(forbidden, 'Only newly owned submittal/component/shipment records may be changed').toEqual([]);
  }
});
