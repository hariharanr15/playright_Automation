const { expect } = require('@playwright/test');
const { exactOne } = require('./inventory-data');
const complete = value => ({ status: 'complete', value });
const missing = () => ({ status: 'missing' });
const equalName = (left, right) => String(left).toLowerCase() === String(right).toLowerCase();
class InventoryRecoverySources {
  constructor(ctx, data) { this.ctx = ctx; this.data = data; }
  async master() {
    const records = (await this.ctx.read('material_master/list_material_master_by_project_id/')).data;
    const matches = records.filter(record => equalName(record.material_name, this.data.material));
    expect(matches.length, 'Generated material name must remain unique').toBeLessThanOrEqual(1);
    this.masterRecord = matches[0]; return this.masterRecord;
  }
  async material() {
    const record = await this.master(); if (!record) return missing();
    expect(record.uom_name).toBe(this.data.expectedUom);
    expect(record.category).toBe(this.data.expectedCategory);
    this.data.material = record.material_name; this.data.componentItem = record.material_name;
    const body = await this.ctx.read('item_material/list_item_by_material_id/', { material_id: record.material_master_id, ensure_default: false });
    // This read-only endpoint returns data:null when no SKU has been created yet.
    const items = body.data === null ? [] : body.data;
    expect(Array.isArray(items), 'SKU lookup must return a list or an explicit empty result').toBe(true);
    const matches = items.filter(item => equalName(item.item_name, record.material_name));
    expect(matches.length, 'Generated SKU must remain unique').toBeLessThanOrEqual(1);
    if (!matches.length) return missing();
    expect(Number(matches[0].item_conversion)).toBe(1);
    this.itemRecord = matches[0]; return complete(record);
  }
  async supplierRecordForName() {
    const records = (await this.ctx.read('supplier_master/list_suppliers_by_project_id/')).data;
    const matches = records.filter(record => equalName(record.supplier_name, this.data.supplier));
    expect(matches.length, 'Generated supplier name must remain unique').toBeLessThanOrEqual(1);
    this.supplierRecord = matches[0]; return this.supplierRecord;
  }
  async supplier() {
    const supplier = await this.supplierRecordForName(); if (!supplier) return missing();
    expect(supplier.contact_email).toBe(this.data.supplierDetails.email);
    const mappingBody = await this.ctx.read('supplier_material_mapping/list_material_by_supplier_id/', { supplier_master_id: supplier.supplier_master_id });
    const mappings = mappingBody.data === null ? [] : mappingBody.data;
    expect(Array.isArray(mappings), 'Material mapping lookup must return a list or an explicit empty result').toBe(true);
    const matches = mappings.filter(record => record.material_master === this.masterRecord.material_master_id);
    expect(matches.length).toBeLessThanOrEqual(1);
    if (!matches.length) return missing();
    expect(Number(matches[0].lead_time_in_weeks)).toBe(Number(this.data.leadTime));
    return complete(supplier);
  }
  async submittalRecordForNumber() {
    const { currentCalendarDate, addCalendarDays } = require('./calendar-date');
    this.data.lookupDate ||= await currentCalendarDate(this.ctx.page);
    const body = await this.ctx.read('submittal_master/list_submittals_by_project_id/', { search: this.data.submittalNumber,
      from_date: addCalendarDays(this.data.lookupDate, -31), to_date: addCalendarDays(this.data.lookupDate, 31), page: 1, page_size: 100 });
    const matches = body.data.filter(record => record.submittal_no === this.data.submittalNumber);
    expect(matches.length, 'Generated submittal number must remain unique').toBeLessThanOrEqual(1);
    this.submittalRecord = matches[0]; return this.submittalRecord;
  }
  async component() {
    const submittal = this.submittalRecord || await this.submittalRecordForNumber();
    if (!submittal) return null;
    const records = (await this.ctx.read('submittal_schedule/list_submittal_schedules/', { submittal_id: submittal.submittal_id })).data.schedules;
    const matches = records.filter(record => record.material_id === this.masterRecord.material_master_id);
    expect(matches.length, 'Owned submittal must have at most one matching component').toBeLessThanOrEqual(1);
    this.scheduleRecord = matches[0]; return this.scheduleRecord;
  }
  async submittal() {
    const submittal = await this.submittalRecordForNumber(); if (!submittal) return missing();
    expect(submittal.spec_section_no).toBe(this.data.specificationNumber);
    expect(submittal.supplier_name).toBe(this.data.supplier);
    const schedule = await this.component(); if (!schedule) return missing();
    expect(Number(schedule.actual_quantity)).toBe(Number(this.data.componentQuantity));
    expect(Number(schedule.price)).toBe(Number(this.data.componentValue));
    this.data.submittalId = submittal.submittal_id;
    this.data.scheduleId = schedule.submittal_schedule_id;
    return complete(submittal);
  }
  async delivery() {
    const body = await this.ctx.read('schedule_delivery/list_schedule_delivery/', { submittal_schedule_id: this.data.scheduleId });
    const explicitEmpty = body.statuscode === 201 && body.message === 'No schedule deliveries found for the given submittal_schedule_id.';
    const records = body.data === null || explicitEmpty ? [] : body.data;
    expect(Array.isArray(records), 'Delivery lookup must return a list or an explicit empty result').toBe(true);
    const matches = records.filter(record => record.item_name === this.data.exactDeliveryItem && record.location_name === this.data.deliveryLocation && !record.received_via_inventory);
    expect(matches.length, 'Owned delivery must not be duplicated').toBeLessThanOrEqual(1);
    const record = matches[0];
    if (record) {
      expect(Number(record.quantity)).toBe(Number(this.data.deliveryQuantity));
      const date = record.expected_date_of_delivery;
      this.data.deliveryRecord = { ...record, expected_date_of_delivery: /^\d{2}-\d{2}-\d{4}$/.test(date) ? date.split('-').reverse().join('-') : date,
        submittal_schedule: record.submittal_schedule_id, location_site: record.location_site_id, site_master: null };
    }
    return record;
  }
  async singleRecord(endpoint) {
    const data = (await this.ctx.read(endpoint, { schedule_delivery_id: this.data.deliveryRecord.schedule_delivery_id })).data;
    const records = Array.isArray(data) ? data : data ? [data] : [];
    expect(records.length, `At most one owned ${endpoint} record may exist`).toBeLessThanOrEqual(1);
    return records[0];
  }
  async shipping() { return this.singleRecord('shipping_details/'); }
  async conditions() { return this.singleRecord('condition_at_delivery/'); }
}

function importOwnedSeed(file, title, allocation) {
  if (!file) return null;
  const fs = require('fs'); const report = JSON.parse(fs.readFileSync(file, 'utf8')); const matches = [];
  const visit = suites => { for (const suite of suites || []) { for (const spec of suite.specs || []) if (spec.title === title) {
    for (const test of spec.tests || []) for (const result of test.results || []) if (result.status === 'passed') matches.push(result);
  } visit(suite.suites); } };
  visit(report.suites);
  expect(matches, 'Recovery import requires exactly one passed scenario with the same title').toHaveLength(1);
  const contexts = matches[0].attachments.filter(attachment => attachment.name === 'inventory-context');
  expect(contexts).toHaveLength(1);
  const context = JSON.parse(Buffer.from(contexts[0].body, 'base64').toString('utf8'));
  expect(context.project).toBe(allocation.project); expect(context.site).toBe(allocation.site);
  const manifests = matches[0].attachments.filter(attachment => attachment.name === 'inventory-owned-records');
  expect(manifests).toHaveLength(1);
  const owned = JSON.parse(Buffer.from(manifests[0].body, 'base64').toString('utf8'));
  expect(owned.deliveryCompleted).toBe(true);
  expect(owned.data.deliverySite).toBe(allocation.site);
  expect(owned.data.submittalNumber).not.toBe('SUB-2026-525');
  return owned;
}
module.exports = { InventoryRecoverySources, complete, missing, importOwnedSeed };
