const fs = require('fs');
const { test, expect } = require('../../../fixtures/readonlyTest');
const { EnterpriseViewPage } = require('../../../pages/enterprise/enterprise-view.page');
const { SupplierInboxPage } = require('../../../pages/enterprise/supplier-inbox.page');
const { ProcurementLogPage } = require('../../../pages/procurement-log/procurement-log.page');
const { requireValue, ScpBlocked } = require('../../../utils/scp-readonly');

function allocation(ctx) {
  if (ctx.allocation.inventory) return ctx.allocation.inventory;
  return JSON.parse(fs.readFileSync(requireValue(process.env.SCP_INVENTORY_DATA,
    'Approved existing Inventory allocation required for exact Enterprise context/integration checks'), 'utf8'));
}

test('Enterprise context: configured sites preserve exact context and global totals during navigation', async ({ readonly: ctx }) => {
  const fixture = allocation(ctx); expect(fixture.project).toBe(ctx.config.projectName);
  const sites = [requireValue(fixture.site, 'Primary allocated site required'), requireValue(fixture.secondSite, 'Second allocated site required')];
  expect(new Set(sites).size).toBe(2);
  const original = await ctx.siteSelector.activeSiteName();
  const view = new EnterpriseViewPage(ctx.page); const baseline = await view.load();
  try {
    for (const site of sites) {
      await ctx.appShell.navigateToTab('Management Dashboard'); await ctx.dashboard.expectLoaded();
      await ctx.siteSelector.ensureSite(site);
      expect(await ctx.siteSelector.activeSiteName()).toBe(site);
      await ctx.assertContext();
      const refreshed = await view.load();
      await ctx.assertContext(); expect(await ctx.siteSelector.activeSiteName()).toBe(site);
      expect(refreshed).toEqual(baseline); await view.expectSummary(refreshed);
    }
  } finally { await ctx.siteSelector.ensureSite(original); }
});

test('Enterprise context: safe refresh preserves exact site before persisted metric validation', async ({ readonly: ctx }, info) => {
  const fixture = allocation(ctx); expect(fixture.project).toBe(ctx.config.projectName);
  const site = requireValue(fixture.site, 'Allocated site required for safe-refresh capability check');
  const original = await ctx.siteSelector.activeSiteName();
  try {
    await ctx.siteSelector.ensureSite(site); expect(await ctx.siteSelector.activeSiteName()).toBe(site);
    const view = new EnterpriseViewPage(ctx.page); const baseline = await view.load();
    const loaded = ctx.page.waitForResponse(r => new URL(r.url()).pathname === '/api/enterprise/summary/');
    await ctx.page.reload({ waitUntil: 'domcontentloaded' });
    const refreshed = (await (await loaded).json()).data;
    await ctx.assertContext(); const actualSite = await ctx.siteSelector.activeSiteName();
    await info.attach('refresh-context-capability', { body: Buffer.from(JSON.stringify({ project: ctx.config.projectName, expectedSite: site, actualSite })), contentType: 'application/json' });
    if (actualSite !== site) throw new ScpBlocked(`Refresh resets the selected site from ${site} to ${actualSite}; persisted metric validation is unsafe and was not performed`);
    expect(refreshed).toEqual(baseline);
  } finally { await ctx.siteSelector.ensureSite(original); }
});

test('Supplier Inbox: allocated exact component Open and Procurement Search preserve record relationship', async ({ readonly: ctx }, info) => {
  const fixture = allocation(ctx); expect(fixture.project).toBe(ctx.config.projectName);
  const projectId = await ctx.projectSelector.activeProjectReference();
  const view = new SupplierInboxPage(ctx.page); await view.load();
  await view.filter('Project', projectId);
  const filtered = await view.filter('Material', fixture.referenceMaterialId);
  const section = filtered.sections.find(s => s.key === 'unconfirmed_lead_times'); expect(section).toBeTruthy();
  const expanded = await view.expandSection(section);
  if (expanded.items.length !== 1) throw new ScpBlocked('Exact allocated material must have one uniquely addressable Inbox component for drill-down; allocate its component identity if ambiguous');
  const record = expanded.items[0]; expect(record.project_id).toBe(projectId);
  if (record.submittal_no === 'SUB-2026-525') throw new Error('Completed FDI submittal is excluded from reuse');
  const row = view.main.locator('tbody tr').filter({ has: ctx.page.getByRole('cell', { name: record.submittal_no, exact: true }) })
    .filter({ has: ctx.page.getByRole('cell', { name: record.material_name, exact: true }) });
  await expect(row).toHaveCount(1);
  const opened = ctx.page.waitForResponse(r => new URL(r.url()).pathname === '/api/submittal_schedule/list_submittal_schedules/' &&
    new URL(r.url()).searchParams.get('submittal_id') === record.submittal_id);
  await row.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(ctx.page).toHaveURL(/\/procurement-log(?:\?|$)/);
  await ctx.assertContext(); expect(await ctx.projectSelector.activeProjectReference()).toBe(record.project_id);
  const response = await opened; expect(response.status()).toBe(200);
  const components = (await response.json()).data.schedules;
  expect(components.filter(component => component.submittal_schedule_id === record.submittal_schedule_id)).toHaveLength(1);
  // Open lands either on the Procurement Log row or (since 27 Oct 2026) directly on the component detail view.
  const destination = ctx.page.getByRole('row').filter({ has: ctx.page.getByRole('cell', { name: record.submittal_no, exact: true }) });
  const field = label => ctx.page.getByText(label, { exact: true }).locator('..').filter({ visible: true }).first();
  const detail = field('Submittal no.');
  await expect(destination.or(detail).first()).toBeVisible();
  if (await destination.count()) {
    await expect(destination).toHaveCount(1); await expect(destination).toContainText(record.material_name);
  } else {
    await expect(detail).toContainText(record.submittal_no);
    await expect(field('Material')).toContainText(record.material_name);
    for (const label of ['Required QTY', 'QTY Received']) {
      await expect.soft(field(label), `Application defect: ${label} must show its unit of measure`).not.toContainText('undefined');
    }
  }
  // Fresh read-only navigation clears drill-down expansion before reusing the
  // existing exact Search helper, whose one-parent-row assertion is preserved.
  await ctx.page.goto(new URL('/procurement-log', ctx.config.baseUrl).href, { waitUntil: 'domcontentloaded' });
  const procurement = new ProcurementLogPage(ctx.page);
  const saved = await procurement.searchExactSubmittal(record.submittal_no);
  await expect(saved).toContainText(record.material_name);
  await expect(saved).toContainText(record.supplier_name);
  await info.attach('inbox-procurement-relationship', { body: Buffer.from(JSON.stringify(record)), contentType: 'application/json' });
});
