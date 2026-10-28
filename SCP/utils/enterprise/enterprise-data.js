const { expect } = require('@playwright/test');
const { ScpBlocked } = require('../scp-readonly');
async function mapLimit(records, operation, limit = 4) {
  let cursor = 0; const result = new Array(records.length);
  await Promise.all(Array.from({ length: Math.min(limit, records.length) }, async () => {
    while (cursor < records.length) { const index = cursor++; result[index] = await operation(records[index]); }
  }));
  return result;
}
async function sourceRecords(ctx, projects, range) {
  const submittals = []; const components = []; const deliveries = [];
  await mapLimit(projects, async project => {
    let page = 1; const seen = new Set();
    while (true) {
      const body = await ctx.read('submittal_master/list_submittals_by_project_id/', {
        project_id: project.project_no, from_date: range.from, to_date: range.to, page, page_size: 200
      });
      const data = Array.isArray(body.data) ? body.data : body.data?.results;
      if (!Array.isArray(data)) throw new ScpBlocked(`Procurement pagination schema unavailable for ${project.project_no}`);
      for (const record of data) {
        expect(seen.has(record.submittal_id), 'Source pagination must not repeat a submittal').toBe(false);
        seen.add(record.submittal_id);
        submittals.push({ ...record, id: record.submittal_id, projectId: project.project_no });
      }
      const total = body.total_count ?? body.count ?? body.pagination?.total;
      if (total !== undefined && seen.size >= total) break;
      if (data.length < 200) break;
      page++;
      if (page > 1000) throw new Error('Procurement pagination did not terminate');
    }
  });
  await mapLimit(submittals, async submittal => {
    const body = await ctx.read('submittal_schedule/list_submittal_schedules/', { project_id: submittal.projectId, submittal_id: submittal.id });
    expect(Array.isArray(body.data?.schedules)).toBe(true);
    for (const record of body.data.schedules) components.push({ ...record,
      id: record.submittal_schedule_id, submittalId: submittal.id, projectId: submittal.projectId,
      supplierId: submittal.supplier_id, supplierName: submittal.supplier_name,
      category: submittal.material_category, quantity: record.actual_quantity, receivedQuantity: record.received_quantity,
      expectedDate: record.expected_delivery_date, requiredOnSite: record.date_required_on_site,
      leadTimeConfirmed: record.lead_time_confirmed_flag, confirmedWeeks: record.lead_time_in_weeks });
  });
  await mapLimit(components, async component => {
    const body = await ctx.read('schedule_delivery/list_schedule_delivery/', { project_id: component.projectId, submittal_schedule_id: component.id });
    const records = body.statuscode === 201 && /^No schedule deliveries found/.test(body.message || '') ? [] : body.data;
    if (!Array.isArray(records)) throw new ScpBlocked(`Delivery source schema unavailable for ${component.id}`);
    for (const record of records) deliveries.push({ ...record, id: record.schedule_delivery_id,
      componentId: component.id, projectId: component.projectId, supplierId: component.supplierId, category: component.category,
      actualDate: record.actual_date_of_delivery, componentExpectedDate: component.expectedDate,
      requiredOnSite: component.requiredOnSite, poDate: component.po_date });
  });
  return { capturedAt: new Date().toISOString(), range, submittals, components, deliveries };
}
// Supplier-to-Material default lead time (weeks) for each component's submittal supplier and material, as defaultWeeks.
async function supplierDefaults(ctx, components) {
  const pairs = [...new Map(components.filter(c => c.supplierId).map(c => [`${c.projectId}|${c.supplierId}`, c])).values()];
  const defaults = new Map();
  await mapLimit(pairs, async component => {
    const body = await ctx.read('supplier_material_mapping/list_material_by_supplier_id/', { supplier_master_id: component.supplierId, project_id: component.projectId });
    for (const item of Array.isArray(body.data) ? body.data : []) defaults.set(`${component.projectId}|${component.supplierId}|${item.material_master}`, item.lead_time_in_weeks);
  });
  for (const component of components) component.defaultWeeks = defaults.get(`${component.projectId}|${component.supplierId}|${component.material_id}`) ?? null;
  return defaults.size;
}
// Unread (active) alerts per project for the range, read with the Management Dashboard's own filters for the signed-in user.
async function unreadAlerts(ctx, projectRefs, range) {
  const user = await ctx.page.evaluate(() => JSON.parse(localStorage.getItem('userInfo') || '{}').email || '');
  expect(user, 'Signed-in user email for the alert filter').toBeTruthy();
  const counts = {};
  await mapLimit(projectRefs, async ref => {
    const body = await ctx.read('notification_system/list_notifications/', { project_id: ref, notification_type: 'alert', marked_read: 'False',
      from_date: range.from, to_date: range.to, added_by: user });
    counts[ref] = Array.isArray(body.data) ? body.data.length : 0;
  });
  return counts;
}
module.exports = { sourceRecords, supplierDefaults, unreadAlerts, mapLimit };
