const fs = require('fs');
const { test, expect } = require('../../../fixtures/readonlyTest');
const { SupplierInboxPage } = require('../../../pages/enterprise/supplier-inbox.page');
const { requireValue } = require('../../../utils/scp-readonly');
function allocation(ctx) {
  if (ctx.allocation.inventory) return ctx.allocation.inventory;
  requireValue(process.env.SCP_INVENTORY_DATA, 'Reuse SCP_INVENTORY_DATA or set readonly allocation.inventory for exact existing material/supplier filter fixtures');
  return JSON.parse(fs.readFileSync(process.env.SCP_INVENTORY_DATA, 'utf8'));
}
test('Supplier Inbox: exact selected-project filter applies to every expanded section', async ({ readonly: ctx }) => {
  const view = new SupplierInboxPage(ctx.page); await view.load();
  const projectId = await ctx.projectSelector.activeProjectReference();
  const data = await view.filter('Project', projectId);
  for (const section of data.sections) {
    const expanded = await view.expandSection(section);
    for (const record of expanded.items) expect(record.project_id).toBe(projectId);
    expect(expanded.summary.projects).toBeLessThanOrEqual(1);
    await view.collapseSection(section);
  }
});
test('Supplier Inbox: exact configured material filter preserves material identity', async ({ readonly: ctx }) => {
  const fixture = allocation(ctx); const view = new SupplierInboxPage(ctx.page); await view.load();
  const masters = (await ctx.read('material_master/list_material_master_by_project_id/', { project_id: await ctx.projectSelector.activeProjectReference() })).data;
  const selected = masters.filter(m => m.material_master_id === fixture.referenceMaterialId); expect(selected).toHaveLength(1);
  const data = await view.filter('Material', fixture.referenceMaterialId);
  let matched = 0;
  for (const section of data.sections) {
    const expanded = await view.expandSection(section);
    matched += expanded.items.length;
    for (const record of expanded.items) expect(record.material_name).toBe(selected[0].material_name);
    await view.collapseSection(section);
  }
  expect(matched, 'Configured material must exercise a positive filter, not only empty sections').toBeGreaterThan(0);
});
test('Supplier Inbox: exact configured supplier filter and reset', async ({ readonly: ctx }) => {
  const fixture = allocation(ctx); const view = new SupplierInboxPage(ctx.page); const initial = await view.load();
  const suppliers = initial.filter_options.suppliers.filter(s => s.label === fixture.supplier || s.name === fixture.supplier);
  expect(suppliers, 'One configured supplier option').toHaveLength(1);
  const data = await view.filter('Supplier', suppliers[0].id || suppliers[0].value);
  let matched = 0;
  for (const section of data.sections) {
    const expanded = await view.expandSection(section);
    matched += expanded.items.length;
    for (const record of expanded.items) expect(record.supplier_name).toBe(fixture.supplier);
    await view.collapseSection(section);
  }
  expect(matched, 'Configured supplier must exercise positive matching records').toBeGreaterThan(0);
  const reset = await view.filter('Supplier', ''); expect(reset.sections.map(s => s.summary)).toEqual(initial.sections.map(s => s.summary));
});
