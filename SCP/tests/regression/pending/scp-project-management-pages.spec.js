const { test, expect } = require('../../../fixtures/readonlyTest');
const { CommonUtilitiesPage } = require('../../../pages/project-management/common-utilities.page');
const { CommonUomPage } = require('../../../pages/project-management/common-uom.page');
const { MaterialCategoryPage } = require('../../../pages/project-management/material-category.page');
const { ConfigurationOptionsPage } = require('../../../pages/project-management/configuration-options.page');
const { FirstDeliveryInspectionConfigPage } = require('../../../pages/project-management/first-delivery-inspection-config.page');
const { InventoryControlPage } = require('../../../pages/project-management/inventory-control.page');
const { MaterialMasterPage } = require('../../../pages/project-management/material-master.page');
const { PreshippingChecklistPage } = require('../../../pages/project-management/preshipping-checklist.page');
const { BulkUploadStatusPage } = require('../../../pages/project-management/bulk-upload-status.page');
const { ProcurementLogConfigurationPage } = require('../../../pages/project-management/procurement-log-configuration.page');
const { SiteDetailsPage } = require('../../../pages/project-management/site-details.page');
const { WatchedMaterialsPage } = require('../../../pages/project-management/watched-materials.page');

// Read-only load checks for every in-scope Project Management page; System Messages, Integrations,
// Setup Wizard and Inventory Rebuild are excluded scope. Record-level behaviour stays in the qualified suites.
const pages = [
  ['Common Utilities', 'common-utilities', page => new CommonUtilitiesPage(page)],
  ['Common UoM', 'common-uom', page => new CommonUomPage(page)],
  ['Material Category', 'material-category', page => new MaterialCategoryPage(page)],
  ['Configuration Options', 'configuration-options', page => new ConfigurationOptionsPage(page)],
  ['First Delivery Inspection Config', 'first-delivery-inspection-config', page => new FirstDeliveryInspectionConfigPage(page)],
  ['Inventory Control', 'inventory-control', page => new InventoryControlPage(page)],
  ['Material Master', 'material-master', page => new MaterialMasterPage(page)],
  ['PreShipping Checklist', 'preshipping-checklist', page => new PreshippingChecklistPage(page)],
  ['Bulk Upload Status', 'bulk-upload-status', page => new BulkUploadStatusPage(page)],
  ['Procurement Log Configuration', 'procurement-log-configuration', page => new ProcurementLogConfigurationPage(page)],
  ['Site Details', 'site-details', page => new SiteDetailsPage(page)],
  ['Watched Materials', 'watched-materials', page => new WatchedMaterialsPage(page)]
];
const withoutProject = url => ['null', 'undefined', ''].includes(url.searchParams.get('project_id') ?? 'present');

for (const [name, route, create] of pages) {
  test(`Project Management page: ${name} opens with project-scoped data`, async ({ readonly: ctx }, info) => {
    const origin = new URL(ctx.config.baseUrl).origin;
    const failures = []; const premature = [];
    const listener = response => {
      const url = new URL(response.url());
      if (url.origin !== origin || !url.pathname.startsWith('/api/') || response.status() < 400) return;
      (withoutProject(url) ? premature : failures).push(`${response.request().method()} ${url.pathname} -> ${response.status()}`);
    };
    ctx.page.on('response', listener);
    try {
      await test.step(`Open ${name} from Project Management navigation`, async () => {
        await create(ctx.page).open(ctx.dashboard);
        await expect(ctx.page).toHaveURL(new RegExp(`/${route}/?$`, 'i'));
        await ctx.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
      });
      await test.step(`Validate ${name} loaded without errors for the selected project`, async () => {
        await expect(ctx.page.getByRole('main').getByText(/something went wrong|failed to load|unable to load/i), `${name} shows no load error`).toHaveCount(0);
        expect(failures, `${name}: project-scoped API requests must succeed`).toEqual([]);
        await ctx.assertContext();
      });
    } finally {
      ctx.page.off('response', listener);
      if (premature.length) info.annotations.push({ type: 'observation', description: `${name} sent requests without a project before hydration: ${[...new Set(premature)].join('; ')}` });
    }
  });
}
