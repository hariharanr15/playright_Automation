const { expect } = require('@playwright/test');
const { MaterialMasterPage } = require('../../pages/project-management/material-master.page');
const { SupplierListPage } = require('../../pages/user-management/supplier-list/supplier-list.page');
const { ProcurementLogPage } = require('../../pages/procurement-log/procurement-log.page');
const { createInventoryData } = require('../../utils/dynamic-data');
const { exactOne, InventoryBlocked } = require('../../utils/inventory-data');
const { currentJournal, managedStep } = require('../../utils/scp-step');
const { InventoryRecoverySources, complete, missing, importOwnedSeed } = require('../../utils/inventory-recovery');
const { isHeadless } = require('../../utils/execution-mode');

async function details(ctx, materialId) {
  await ctx.assertContext();
  return (await ctx.read('inventory/get_inv_action_details/', { material_master_id: materialId,
    site_master_id: ctx.siteId, client_id: ctx.clientId })).data;
}

async function prepareContext(ctx) {
  await ctx.assertContext();
  if (!/\/inventory-management\/?$/.test(new URL(ctx.page.url()).pathname)) await ctx.inv.open();
  const project = await ctx.projectSelector.activeProjectSession();
  ctx.clientId = project.organization?.ref || project.client_id;
  // The client ID is read from the real Inventory request, not guessed from an organization name.
  const responsePromise = ctx.page.waitForResponse(r => r.url().includes('/inventory/get_inv_action_details/'));
  const masters = (await ctx.read('material_master/list_material_master_by_project_id/')).data;
  const reference = exactOne(masters, m => m.material_master_id === ctx.allocation.referenceMaterialId, 'Reference material', true);
  await ctx.inv.openView(reference.material_name, 'Actions');
  const response = await responsePromise;
  const url = new URL(response.url());
  ctx.siteId = url.searchParams.get('site_master_id');
  ctx.clientId = url.searchParams.get('client_id');
  if (!ctx.siteId || !ctx.clientId) throw new InventoryBlocked('Inventory request has no site/client identity');
  const metadata = (await response.json()).data;
  for (const key of ['sourceLocation', 'destinationLocation']) exactOne(metadata.locations, l => l.location_name === ctx.allocation[key], key, true);
  const baseItem = exactOne(metadata.items, i => Number(i.item_conversion) === 1, 'Reference base-unit SKU', true);
  ctx.unitConversion = Number(baseItem.item_conversion);
  ctx.reference = reference;
  await ctx.reset();
  return ctx;
}

async function createDataset(ctx, info) {
  ctx.owned = undefined;
  info.setTimeout(Math.max(info.timeout, 600000));
  const journal = currentJournal();
  const seed = journal && !journal.state.data.inventoryOwned ? importOwnedSeed(process.env.SCP_RECOVERY_SEED || journal.state.data.inventoryOrigin?.report, info.title, ctx.allocation) : null;
  if (seed) {
    journal.setData('inventoryOwned', seed);
    journal.setData('inventoryOrigin', { report: process.env.SCP_RECOVERY_SEED || journal.state.data.inventoryOrigin?.report, scenario: info.title });
  }
  const data = journal ? journal.data('inventoryData', () => seed?.data || createInventoryData()) : createInventoryData();
  data.ownerSite ||= data.deliverySite || ctx.allocation.site;
  data.ownerProject ||= ctx.allocation.project;
  expect(data.ownerSite, 'A recovery checkpoint must retain its allocated site').toBe(ctx.allocation.site);
  expect(data.ownerProject, 'A recovery checkpoint must retain its allocated project').toBe(ctx.allocation.project);
  const savedOwned = journal?.state.data.inventoryOwned || seed;
  if (savedOwned?.schedule.date_required_on_site) data.lookupDate ||= savedOwned.schedule.date_required_on_site;
  const sources = new InventoryRecoverySources(ctx, data);
  const plan = [
    { id: 'material', name: 'Create valid material and base-unit SKU', expected: 'One unique material/SKU with the configured category and UOM exists' },
    { id: 'supplier', name: 'Create supplier and persist material mapping', dependsOn: ['material'], expected: 'The generated supplier and material are mapped with the requested lead time' },
    { id: 'submittal', name: 'Create submittal and related component', dependsOn: ['supplier'], expected: 'The saved submittal/component uses the generated material, supplier, quantities and value' },
    { id: 'delivery', name: 'Complete dependent delivery', dependsOn: ['submittal'], expected: 'Order, checklist, actual date, shipping, conditions and GRN are valid' },
    { id: 'inventory', name: 'Validate delivered Inventory records', dependsOn: ['delivery'], expected: 'Inventory stock and history reconcile with completed delivery' },
    { id: 'inventory-operation', name: 'Execute dependent Inventory operations', dependsOn: ['inventory'], expected: 'Saved movements retain the same supplier, item, submittal and schedule' }
  ];
  journal?.define(plan);
  data.inventorySetup = true;
  const stages = [];
  const stage = async (id, name, action, verify, group = false) => {
    const record = { name, status: 'Running' }; stages.push(record);
    try {
      const definition = plan.find(step => step.id === id);
      const result = await managedStep(require('@playwright/test').test, ctx.page, name, action, {
        ...definition, verify, group, mutation: !['inventory'].includes(id)
      });
      record.status = 'Passed'; return result;
    } catch (error) {
      ctx.owned = undefined;
      record.status = 'Failed'; record.error = error.message;
      const image = await ctx.page.screenshot({ fullPage: isHeadless(), timeout: 5000 }).catch(() => null);
      if (image) await info.attach('inventory-prerequisite-failure', { body: image, contentType: 'image/png' });
      await info.attach('inventory-prerequisite-failure-details', { body: Buffer.from(JSON.stringify({ data, stages }, null, 2)), contentType: 'application/json' });
      throw error;
    }
  };
  await ctx.assertContext();
  ctx.unitConversion = 1;
  console.log('Inventory prerequisites: resolve and validate material', data.material);
  const materials = new MaterialMasterPage(ctx.page);
  let master;
  const reference = exactOne((await ctx.read('material_master/list_material_master_by_project_id/')).data,
    m => m.material_master_id === ctx.allocation.referenceMaterialId, 'Reference material', true);
  data.expectedUom ||= savedOwned?.master.uom_name || reference.uom_name;
  data.expectedCategory ||= savedOwned?.master.category || reference.category;
  await stage('material', 'Prerequisite 1: create and validate the new material and base-unit SKU', async () => {
  await materials.open(ctx.dashboard);
  if (!await sources.master()) await materials.addMaterial(data.material, data.expectedCategory, data.expectedUom);
  master = exactOne((await ctx.read('material_master/list_material_master_by_project_id/')).data,
    m => m.material_name.toLowerCase() === data.material.toLowerCase(), 'New owned material');
  expect(master.uom_name).toBe(reference.uom_name);
  data.material = master.material_name;
  ctx.createdRecords.push({ type: 'material', id: master.material_master_id, name: master.material_name });
  if ((await sources.material()).status !== 'complete') {
    const createdItem = await materials.addInventoryItem(master.material_name, master.material_name, ctx.unitConversion);
    ctx.createdRecords.push({ type: 'inventory item', ...createdItem });
  }
  data.componentItem = master.material_name;
  }, () => sources.material());
  master = sources.masterRecord || await sources.master();
  data.componentItem = master.material_name;
  // Only the new material is mapped; unrelated supplier/material associations are untouched.
  const suppliers = new SupplierListPage(ctx.page);
  await stage('supplier', 'Prerequisite 2: create the new supplier and map it to the same material', async () => {
  await suppliers.open();
  if (!await sources.supplierRecordForName()) await suppliers.create(data.supplierDetails);
  ctx.createdRecords.push({ type: 'supplier', ...data.supplierDetails });
  if ((await sources.supplier()).status !== 'complete') await suppliers.mapMaterial(data.supplier, data.material, data.leadTime);
  ctx.createdRecords.push({ type: 'supplier-material mapping', supplier: data.supplier, materialId: master.material_master_id });
  }, () => sources.supplier());
  console.log('Inventory prerequisites: supplier ready; resolve submittal', data.submittalNumber);
  await ctx.siteSelector.ensureSite(ctx.allocation.site);
  await ctx.assertContext();
  const procurement = new ProcurementLogPage(ctx.page);
  await stage('submittal', 'Prerequisite 3: create and validate the related submittal and component', async () => {
  await procurement.open();
  await ctx.assertContext();
  if (!await sources.submittalRecordForNumber()) await procurement.createSubmittal(data);
  ctx.createdRecords.push({ type: 'submittal', number: data.submittalNumber });
  await procurement.searchExactSubmittal(data.submittalNumber);
  if (!await sources.component()) await procurement.addComponent(data);
  console.log('Inventory setup: owned component saved');
  const row = await procurement.searchExactSubmittal(data.submittalNumber);
  await expect(row).toContainText(data.supplier);
  await expect(row).toContainText(data.material);
  }, () => sources.submittal());
  await sources.submittal();
  data.deliverySite = ctx.allocation.site;
  data.deliveryLocation = ctx.allocation.sourceLocation;
  data.deliveryQuantity = data.componentQuantity;
  data.exactDeliveryItem = data.material;
  data.dynamicChecklist = true;
  data.preShipping = { supplierNote: `Supplier confirmation ${data.submittalNumber}`, approverNote: `Approval ${data.submittalNumber}` };
  data.shippingReference = data.purchaseOrderNumber;
  await stage('delivery', 'Prerequisite 4: complete and validate delivery before Inventory operations', async () => {
    await procurement.completeOwnedDelivery(data, info, sources);
  }, undefined, true);
  const owned = await stage('inventory', 'Prerequisite 5: validate delivered identities before starting Inventory operations', async () => {
  await ctx.reset();
  await prepareContext(ctx);
  const meta = await details(ctx, master.material_master_id);
  const supplier = exactOne(meta.suppliers, s => s.supplier_name.toLowerCase() === data.supplier.toLowerCase(), 'New supplier associated with the delivered material');
  const item = exactOne(meta.items, i => i.item_name.toLowerCase() === data.material.toLowerCase(), 'Owned default SKU');
  expect(Number(item.item_conversion), 'Owned SKU uses the validated reference base-unit conversion').toBe(ctx.unitConversion);
  const submittal = exactOne(meta.submittal_master, s => s.spec_section_no === data.specificationNumber, 'Owned submittal');
  const scheduleIdentity = exactOne(submittal.submittal_schedules, () => true, 'Owned component schedule');
  const schedules = (await ctx.read('submittal_schedule/list_submittal_schedules/', { submittal_id: submittal.submittal_id })).data.schedules;
  const savedSchedule = exactOne(schedules, s => s.submittal_schedule_id === scheduleIdentity.submittal_schedule_id, 'Saved component');
  expect(savedSchedule.material_id).toBe(master.material_master_id);
  expect(savedSchedule.uom_name).toBe(master.uom_name);
  expect(Number(savedSchedule.actual_quantity)).toBe(Number(data.componentQuantity));
  expect(Number(savedSchedule.price)).toBe(Number(data.componentValue));
  expect(savedSchedule.po_number, 'Delivery must use the generated purchase order').toBe(data.purchaseOrderNumber);
  expect(data.deliveryRecord.submittal_schedule).toBe(savedSchedule.submittal_schedule_id);
  const locations = (await ctx.read('location_site/list_location_by_site_id/', { site_id: ctx.siteId })).data;
  const deliveryLocation = exactOne(locations, location => location.location_id === data.deliveryRecord.location_site, 'Saved delivery location in the selected site');
  expect(deliveryLocation.location_name).toBe(data.deliveryLocation);
  expect(deliveryLocation.site_id).toBe(ctx.siteId);
  if (data.deliveryRecord.site_master !== null) expect(data.deliveryRecord.site_master).toBe(ctx.siteId);
  const schedule = { ...savedSchedule, ...scheduleIdentity };
  const activity = { item: item.item_name, supplier: data.supplier, subcontractor: ctx.allocation.subcontractor,
    source: ctx.allocation.sourceLocation, destination: ctx.allocation.destinationLocation,
    submittal: data.submittalNumber, schedule: null, quantity: data.quantity, comments: data.comments,
    specificationNumber: data.specificationNumber };
  const baselineBalance = Number(data.deliveryQuantity);
  let activities = savedOwned?.activities || [];
  const uploadId = journal?.state.data.inventoryBulkReceipt?.data?.upload_id;
  if (journal?.state.data.inventoryBulkKind === 'positive' && uploadId && !activities.length) {
    const job = (await ctx.read(`bulk-uploads/uploads/${uploadId}/`)).data;
    const decision = require('../../utils/bulk-upload/recovery').bulkJobDecision(job, 'positive');
    if (decision.status === 'unknown') throw new InventoryBlocked(decision.reason);
    if (job.status === 'success') {
      const { currentCalendarDate, addCalendarDays } = require('../../utils/calendar-date');
      const source = await ctx.read('inventory/list_inv_action/', { from_date: addCalendarDays(data.lookupDate, -31),
        to_date: addCalendarDays(await currentCalendarDate(ctx.page), 1), material_master_id: master.material_master_id,
        site_master_id: ctx.siteId, client_id: ctx.clientId, location_id: '' });
      const rows = require('../../utils/bulk-upload/inventory-workbook').inventoryUploadRows({ data, master, item, schedule, baselineBalance, deliveryCompleted: true }, ctx.allocation, false);
      activities = require('../../utils/bulk-upload/recovery').recoverBulkActivities(rows, source.data.activities, submittal.submittal_id, schedule.submittal_schedule_id);
    }
  }
  const expectedCurrent = baselineBalance + activities.reduce((sum, entry) => sum + (entry.action === 'Internal Movement' ? 0 : entry.action === 'Incoming Load' ? Number(entry.quantity) : -Number(entry.quantity)), 0);
  const returned = activities.filter(entry => entry.action === 'Return').reduce((sum, entry) => sum + Number(entry.quantity), 0);
  expect(Number(savedSchedule.received_quantity), 'Net received quantity must reconcile completed delivery and recovered returns').toBe(Number(data.deliveryQuantity) - returned);
  ctx.owned = { data, master, supplier, item, submittal, schedule, scheduleIdentity, activity, procurement, activities, deliveryCompleted: true, prerequisiteStages: stages, baselineBalance };
  await ctx.inv.expectMaterial(master, expectedCurrent);
  await ctx.inv.openView(master.material_name, 'Actions');
  const baseline = await ledger(ctx);
  expect(Number(baseline.data.closing_balance), 'Delivered stock and saved recovery actions must reconcile').toBe(expectedCurrent);
  expect(Number(baseline.data.opening_balance) + baseline.data.activities.reduce((sum, entry) => sum + (entry.utility_action_name === 'internal_movement' ? 0 : Number(entry.total_value)), 0)).toBe(expectedCurrent);
  const deliveryEntries = baseline.data.activities.filter(entry => entry.utility_action_name === 'incoming_load' && entry.comments == null &&
    entry.submittal_id === submittal.submittal_id && entry.schedule_id === schedule.submittal_schedule_id);
  expect(deliveryEntries, 'Exactly one system receipt must represent the completed delivery').toHaveLength(1);
  expect(baseline.data.activities, 'Only the delivered receipt and explicitly recovered owned actions may exist; never resubmit an ambiguous upload').toHaveLength(deliveryEntries.length + activities.length);
  expect(Number(deliveryEntries[0].action_quantity)).toBe(baselineBalance);
  ctx.owned.baseline = savedOwned?.baseline || { ...baseline.data, activities: deliveryEntries, closing_balance: baselineBalance };
  await ctx.reset();
  return ctx.owned;
  });
  await info.attach('inventory-owned-records', { body: Buffer.from(JSON.stringify(owned, (key, value) => key === 'procurement' ? undefined : value, 2)), contentType: 'application/json' });
  journal?.setData('inventoryOwned', owned);
  return owned;
}

async function openOwnedActivity(ctx, action, quantity) {
  const { owned } = ctx;
  expect(owned?.deliveryCompleted, 'Inventory operations require successfully completed delivery prerequisites').toBe(true);
  await ctx.assertContext();
  await ctx.inv.openView(owned.master.material_name, 'Actions');
  await ctx.inv.openActivity();
  // Schedule labels are generated by the application from the owned component's date/material/PO.
  const d = owned.schedule;
  const date = new Date(`${d.date_required_on_site}T12:00:00Z`);
  const dateFormat = await ctx.page.evaluate(() => localStorage.getItem('dateDisplayFormat'));
  if (dateFormat && dateFormat !== 'DD/MM/YYYY') throw new InventoryBlocked(`Schedule date format ${dateFormat} needs explicit formatting support`);
  const dateLabel = `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`;
  const activity = { ...owned.activity, action, quantity: quantity ?? owned.data.quantity,
    schedule: [dateLabel, d.material_name, d.po_number].filter(Boolean).join('-'),
    // The history uses the sparse Inventory metadata; its exact schedule ID is verified below.
    historySchedule: [dateLabel, owned.scheduleIdentity.material_name, owned.scheduleIdentity.po_number].filter(Boolean).join('-') };
  return activity;
}

async function ledger(ctx, location = '') {
  await ctx.assertContext();
  const dates = await ctx.page.getByPlaceholder('select start date', { exact: true }).first().inputValue();
  const end = await ctx.page.getByPlaceholder('select End date', { exact: true }).inputValue();
  const iso = text => text.split('/').reverse().join('-');
  return ctx.read('inventory/list_inv_action/', { from_date: iso(dates), to_date: iso(end),
    material_master_id: ctx.owned.master.material_master_id, site_master_id: ctx.siteId, client_id: ctx.clientId, location_id: location });
}

async function postAndVerify(ctx, activity, expectedBalance) {
  const register = () => {
    if (!ctx.owned.activities.some(entry => entry.action === activity.action && entry.comments === activity.comments)) ctx.owned.activities.push(activity);
    currentJournal()?.setData('inventoryOwned', ctx.owned);
  };
  const verify = async () => {
    await ctx.reset();
    await ctx.inv.openView(ctx.owned.master.material_name, 'Actions');
    const source = await ledger(ctx);
    const matches = source.data.activities.filter(entry => entry.comments === activity.comments && entry.utility_action_name === activity.action.toLowerCase().replace(/ /g, '_'));
    expect(matches.length, 'Owned activity must never be duplicated during recovery').toBeLessThanOrEqual(1);
    if (!matches.length) return missing();
    const saved = matches[0];
    expect(saved.submittal_id).toBe(ctx.owned.submittal.submittal_id);
    expect(saved.schedule_id).toBe(ctx.owned.schedule.submittal_schedule_id);
    expect(Math.abs(Number(saved.action_quantity))).toBe(Number(activity.quantity));
    register();
    await verifyInventoryState(ctx, ctx.owned.activities, expectedBalance);
    await verifyBothSearches(ctx, expectedBalance);
    return complete(saved);
  };
  await managedStep(require('@playwright/test').test, ctx.page, `Save and reconcile ${activity.action} for the delivered material`, async () => {
    await ctx.reset();
    await ctx.assertContext();
    await ctx.inv.openView(ctx.owned.master.material_name, 'Actions');
    await ctx.inv.openActivity();
    await ctx.inv.fillActivity(activity);
    await ctx.inv.submitActivity();
    register();
  }, { id: 'inventory-operation', dependsOn: ['inventory'], mutation: true, verify,
    expected: 'One matching activity is saved; stock, history and exact record relationships reconcile' });
}

async function verifyInventoryState(ctx, activities, expectedBalance) {
  await ctx.assertContext();
  const saved = await ledger(ctx);
  expect(saved.status_code).toBe(200);
  const baseline = ctx.owned.baseline;
  expect(saved.data.activities).toHaveLength(baseline.activities.length + activities.length);
  const tuple = entry => JSON.stringify(['comments', 'utility_action_name', 'total_value', 'action_quantity', 'item_name', 'from_location_name', 'schedule_id', 'submittal_id'].map(key => entry[key]));
  const actualTuples = saved.data.activities.map(tuple);
  for (const entry of baseline.activities) {
    const index = actualTuples.indexOf(tuple(entry));
    expect(index, 'Delivery prerequisite history must remain intact').toBeGreaterThanOrEqual(0);
    actualTuples.splice(index, 1);
  }
  for (const activity of activities) {
    const entry = exactOne(saved.data.activities, a => a.comments === activity.comments && a.utility_action_name === activity.action.toLowerCase().replace(/ /g, '_'), 'Saved owned activity');
    const signed = (activity.action === 'Incoming Load' ? 1 : -1) * Number(activity.quantity);
    expect(Number(entry.total_value)).toBe(signed);
    expect(Number(entry.action_quantity)).toBe(signed);
    expect(entry.item_name).toBe(activity.item);
    expect(entry.from_location_name).toBe(activity.source);
    expect(entry.submittal_id).toBe(ctx.owned.submittal.submittal_id);
    expect(entry.schedule_id).toBe(ctx.owned.schedule.submittal_schedule_id);
    if (activity.action === 'Internal Movement') expect(entry.to_location_name).toBe(activity.destination);
    else expect(entry.to_location_id).toBeNull();
    await ctx.inv.expectHistory(activity, signed);
  }
  expect(Number(saved.data.closing_balance)).toBe(expectedBalance);
  expect(Number(saved.data.opening_balance)).toBe(Number(baseline.opening_balance));
  await expect.poll(async () => Number((await ledger(ctx)).data?.closing_balance)).toBe(expectedBalance);
  await expect.poll(async () => {
    const text = await ctx.inv.summary('Closing Balance').innerText();
    return Number(text.replace(/,/g, '').split(' ')[0]);
  }).toBe(expectedBalance);
  await expect(ctx.inv.summary('UOM')).toHaveText(ctx.owned.master.uom_name);
}

async function verifyBothSearches(ctx, expectedBalance) {
  // Navigation reloads server values, then exact project/site are explicitly re-established.
  await ctx.reset();
  await ctx.inv.expectMaterial(ctx.owned.master, expectedBalance);
  const procurement = ctx.owned.procurement;
  await procurement.open();
  await ctx.assertContext();
  const row = await procurement.searchExactSubmittal(ctx.owned.data.submittalNumber);
  await expect(row).toContainText(ctx.owned.data.supplier);
  await expect(row).toContainText(ctx.owned.master.material_name);
  await row.getByRole('cell', { name: ctx.owned.data.specificationNumber, exact: true }).click();
  await expect(ctx.page.getByRole('button', { name: 'Add Component', exact: true })).toBeVisible();
  // A partially delivered component no longer shows a Delivery action, so the row is found by its material.
  const component = procurement.componentRow(ctx.owned.master.material_name);
  await expect(component).toHaveCount(1);
  const schedules = (await ctx.read('submittal_schedule/list_submittal_schedules/', { submittal_id: ctx.owned.submittal.submittal_id })).data.schedules;
  const schedule = exactOne(schedules, s => s.submittal_schedule_id === ctx.owned.schedule.submittal_schedule_id, 'Procurement component after Inventory Search');
  expect(Number(schedule.actual_quantity)).toBe(Number(ctx.owned.data.componentQuantity));
  expect(schedule.uom_name).toBe(ctx.owned.master.uom_name);
  expect(Number(schedule.price)).toBe(Number(ctx.owned.data.componentValue));
  await ctx.reset();
}

module.exports = { prepareContext, createDataset, openOwnedActivity, postAndVerify, details, ledger, verifyInventoryState, verifyBothSearches };
