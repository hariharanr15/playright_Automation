const fs = require('fs');
const { randomUUID } = require('crypto');
const { test, expect } = require('../../../fixtures/readonlyTest');
const { ScpBlocked } = require('../../../utils/scp-readonly');
const { FirstDeliveryInspectionsPage } = require('../../../pages/first-delivery-inspections/first-delivery-inspections.page');
const { FirstDeliveryInspectionConfigPage } = require('../../../pages/project-management/first-delivery-inspection-config.page');

async function allocated(ctx, info) {
  const file = process.env.SCP_FDI_READONLY_DATA;
  if (!file || !fs.existsSync(file)) throw new ScpBlocked('SCP_FDI_READONLY_DATA must identify a passed, dedicated completed-delivery allocation');
  const target = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!target.sourceCase || !target.qualifiedAt || !target.data?.grn || !target.data?.deliveryRecord) throw new ScpBlocked('FDI allocation needs passed owned delivery and generated GRN evidence');
  expect(target.project).toBe(ctx.config.projectName);
  expect(target.data.submittalNumber).not.toBe('SUB-2026-525');
  await ctx.siteSelector.ensureSite(target.site);
  await ctx.assertContext();
  expect(await ctx.siteSelector.activeSiteName()).toBe(target.site);
  const view = new FirstDeliveryInspectionsPage(ctx.page, ctx.config);
  await view.open(ctx.dashboard);
  const filters = ctx.page.locator('main').getByRole('combobox');
  await expect(filters).toHaveCount(3);
  const names = await filters.nth(0).locator('option').allTextContents();
  if (!names.some(name => name.trim() === target.master.material_name)) throw new ScpBlocked('The dedicated delivered material is not eligible/listed in FDI; an eligible owned inspection is required');
  await filters.nth(0).selectOption({ label: target.master.material_name });
  await filters.nth(1).selectOption({ label: target.data.supplier });
  const row = view.rows().filter({ has: ctx.page.getByRole('cell', { name: target.data.submittalNumber, exact: true }) });
  await expect(row, 'Exact owned submittal must have one inspection after material/supplier filters').toHaveCount(1);
  const record = await view.rowData(row);
  expect(record.material).toBe(target.master.material_name);
  expect(record.supplier).toBe(target.data.supplier);
  await info.attach('fdi-owned-delivery-allocation', { body: Buffer.from(JSON.stringify({ sourceCase: target.sourceCase, submittal: target.data.submittalNumber, record })), contentType: 'application/json' });
  return { target, view, row, record, filters };
}

test('FDI read-only: exact delivered material, supplier, submittal and state', async ({ readonly: ctx }, info) => {
  const { row, record, target } = await allocated(ctx, info);
  expect(record.status).toMatch(/^(Auditor not yet assigned|Awaiting inspection completion|Inspection completed)$/i);
  const date = target.data.deliveryRecord.expected_date_of_delivery.slice(0, 10).split('-').reverse().join('/');
  expect(record.deliveryDate).toBe(date);
  if (/Inspection completed/i.test(record.status)) {
    await expect(row.getByRole('button', { name: /Fill inspection report|Self assign/i })).toHaveCount(0);
  }
});

test('FDI read-only: no-match filter and clear restore the exact owned inspection', async ({ readonly: ctx }, info) => {
  const { view, row } = await allocated(ctx, info);
  const inspector = ctx.page.getByPlaceholder('Inspector email');
  await inspector.fill(`absent-${randomUUID()}@example.invalid`);
  await expect(view.rows()).toHaveCount(0);
  await inspector.fill('');
  await expect(row).toHaveCount(1);
  await view.clearFilters();
  await expect(row).toHaveCount(1);
});

test('FDI read-only: inclusive delivery-date boundary and combined status filters', async ({ readonly: ctx }, info) => {
  const { view, row, record, filters } = await allocated(ctx, info);
  await view.setDeliveryDateRange(record.deliveryDate, record.deliveryDate);
  await filters.nth(2).selectOption({ label: record.status });
  await expect(row).toHaveCount(1);
  const count = await view.rows().count();
  for (let index = 0; index < count; index++) {
    const actual = await view.rowData(view.rows().nth(index));
    expect(actual.material).toBe(record.material);
    expect(actual.supplier).toBe(record.supplier);
    expect(actual.status).toBe(record.status);
    expect(actual.deliveryDate).toBe(record.deliveryDate);
  }
  await ctx.assertContext();
});

test('FDI read-only: configured settings and photo dependency survive reload without saving', async ({ readonly: ctx }, info) => {
  const view = new FirstDeliveryInspectionConfigPage(ctx.page);
  await view.open(ctx.dashboard);
  await view.expectSettingsSection();
  const before = await view.readSettings();
  if (before['Photos are mandatory?']) expect(before['Enable Uploading of Photos?']).toBe(true);
  // After a reload the page can request the config before the project hydrates (project_id=null, 404) and then
  // repeat it for the selected project; only the project-scoped response is the saved configuration.
  const prematureRequests = [];
  const premature = response => {
    const url = new URL(response.url());
    if (url.pathname === '/api/fdi_config/' && ['', 'null', 'undefined'].includes(url.searchParams.get('project_id') ?? '')) prematureRequests.push(response.status());
  };
  ctx.page.on('response', premature);
  const loaded = ctx.page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === '/api/fdi_config/' && response.request().method() === 'GET' && !['', 'null', 'undefined'].includes(url.searchParams.get('project_id') ?? '');
  });
  await ctx.page.reload({ waitUntil: 'domcontentloaded' });
  const response = await loaded.finally(() => ctx.page.off('response', premature));
  if (prematureRequests.length) info.annotations.push({ type: 'observation', description: `FDI config was requested without a project after reload (HTTP ${prematureRequests.join(', ')}) before the project-scoped request` });
  expect(response.ok(), 'Saved FDI configuration must load successfully').toBe(true);
  await response.finished();
  await view.expectSettingsSection();
  await expect.poll(() => view.readSettings(), { message: 'Hydrated settings must match their saved state after reload', timeout: 15000 }).toEqual(before);
  await ctx.assertContext();
  await info.attach('fdi-readonly-settings', { body: Buffer.from(JSON.stringify(before)), contentType: 'application/json' });
});
