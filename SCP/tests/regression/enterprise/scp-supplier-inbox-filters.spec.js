const fs = require('fs');
const { test, expect } = require('../../../fixtures/readonlyTest');
const { SupplierInboxPage } = require('../../../pages/enterprise/supplier-inbox.page');
const { requireValue, ScpBlocked } = require('../../../utils/scp-readonly');
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
// The filter lists only values that have Supplier Inbox records, and a listed value can still have no open items.
// The configured value is tried first, then the other listed values, until one returns positive records (max 8 tries).
async function positiveFilter(view, label, preferred, check) {
  const field = view.main.locator('label').filter({ has: view.page.getByText(label, { exact: true }) }).getByRole('combobox');
  const options = (await field.locator('option').evaluateAll(nodes => nodes.map(node => ({ value: node.value, text: node.textContent.trim() }))))
    .filter(option => option.value);
  const ordered = [...options.filter(preferred), ...options.filter(option => !preferred(option))].slice(0, 8);
  const tried = [];
  for (const option of ordered) {
    const data = await view.filter(label, option.value);
    let matched = 0;
    for (const section of data.sections.filter(section => Object.values(section.summary || {}).some(Number))) {
      const expanded = await view.expandSection(section);
      matched += expanded.items.length;
      for (const record of expanded.items) check(record, option);
      await view.collapseSection(section);
    }
    tried.push(`${option.text}: ${matched}`);
    if (matched > 0) {
      test.info().annotations.push({ type: 'filter-value', description: `${label} ${option.text} (${preferred(option) ? 'configured' : 'configured value has no open records; tried ' + tried.join(', ')})` });
      return { option, matched };
    }
  }
  throw new ScpBlocked(`No Test Data Available: Supplier Inbox ${label} filter has no value with open records (${tried.join(', ') || 'no options'})`);
}
test('Supplier Inbox: exact configured material filter preserves material identity', async ({ readonly: ctx }) => {
  const fixture = allocation(ctx); const view = new SupplierInboxPage(ctx.page); await view.load();
  const masters = (await ctx.read('material_master/list_material_master_by_project_id/', { project_id: await ctx.projectSelector.activeProjectReference() })).data;
  const names = new Map(masters.map(master => [master.material_master_id, master.material_name]));
  await positiveFilter(view, 'Material', option => option.value === fixture.referenceMaterialId,
    (record, option) => expect(record.material_name).toBe(names.get(option.value) || option.text));
});
test('Supplier Inbox: exact configured supplier filter and reset', async ({ readonly: ctx }) => {
  const fixture = allocation(ctx); const view = new SupplierInboxPage(ctx.page); const initial = await view.load();
  const configured = initial.filter_options.suppliers.filter(s => s.label === fixture.supplier || s.name === fixture.supplier);
  expect(configured, 'One configured supplier option').toHaveLength(1);
  await positiveFilter(view, 'Supplier', option => option.value === (configured[0].id || configured[0].value),
    (record, option) => expect(record.supplier_name).toBe(option.text));
  const reset = await view.filter('Supplier', ''); expect(reset.sections.map(s => s.summary)).toEqual(initial.sections.map(s => s.summary));
});
