const fs = require('fs');
const path = require('path');
const { test, expect } = require('../../../fixtures/baseTest');
const sharedBrowser = require('../../../utils/shared-browser');
const { getScpConfig } = require('../../../config/scp.config');
const { AppShellPage } = require('../../../pages/app-shell.page');
const { PlatformChooserPage } = require('../../../pages/platform-chooser.page');
const { ManagementDashboardPage } = require('../../../pages/management-dashboard/management-dashboard.page');
const { ProjectSelectorPage } = require('../../../pages/project-selector.page');
const { FirstDeliveryInspectionsPage } = require('../../../pages/first-delivery-inspections/first-delivery-inspections.page');

// Explicit seeded expectations avoid deriving expected permissions from the application under test.
const fixturePath = process.env.SCP_FDI_ACCESS_CASES;
const cases = fixturePath ? JSON.parse(fs.readFileSync(path.resolve(fixturePath), 'utf8')) : [];
if (!Array.isArray(cases)) throw new Error('SCP_FDI_ACCESS_CASES must contain a JSON array');

test('FDI access: role and organisation fixtures configured', async () => {
  test.skip(!cases.length, 'Set SCP_FDI_ACCESS_CASES to seeded account/record expectations; organisation and Responsible-user coverage is unavailable without these fixtures');
});

async function expectAction(row, name, allowed) {
  if (typeof allowed !== 'boolean') throw new Error(`Expected a boolean for action ${name}`);
  const action = row.getByRole('button', { name, exact: true });
  if (allowed) await expect(action).toBeVisible();
  else await expect(action).toHaveCount(0);
}

for (const scenario of cases) {
  test(`FDI access: ${scenario.name}`, async ({ page }) => {
    const username = process.env[scenario.usernameEnv];
    const password = process.env[scenario.passwordEnv];
    expect(Boolean(username && password), 'Both account credential environment variables must be configured').toBe(true);
    const config = { ...getScpConfig(), username, password };
    // In the shared tab, switch to this scenario's account; the previous user's session is cleared first.
    if (sharedBrowser.isSharedBrowser()) await sharedBrowser.ensureAccountSession(page, config, username);
    await new AppShellPage(page, config).open();
    await new PlatformChooserPage(page, config).openSupplyChainPlanner();
    const dashboard = new ManagementDashboardPage(page, config);
    await dashboard.expectLoaded();
    await new ProjectSelectorPage(page, config).ensureProject(scenario.project || config.projectName);

    if (scenario.procurement?.length) {
      await page.getByRole('button', { name: 'Procurement Log', exact: true }).click();
      const search = page.locator('input[placeholder^="Search submittals"]').first();
      await expect(search).toBeVisible();
      for (const record of scenario.procurement) {
        await search.fill(record.submittal);
        const loaded = page.waitForResponse(response => response.request().method() === 'GET' &&
          new URL(response.url()).pathname.startsWith('/api/') &&
          [...new URL(response.url()).searchParams.values()].some(value => value.includes(record.submittal)));
        await search.press('Enter');
        const response = await loaded;
        expect(response.ok(), 'Filtered procurement request must succeed').toBe(true);
        await response.finished();
        const row = page.getByRole('row').filter({ has: page.getByText(record.submittal, { exact: true }) });
        if (record.visible) {
          await expect(row).toBeVisible();
          if (typeof record.edit === 'boolean') await expectAction(row, 'Edit', record.edit);
          if (typeof record.assignResponsible === 'boolean') {
            const action = row.getByRole('button', { name: /assign responsible/i });
            if (record.assignResponsible) await expect(action).toBeVisible();
            else await expect(action).toHaveCount(0);
          }
        } else await expect(row).toHaveCount(0);
      }
    }

    if (scenario.inspections?.length) {
      const inspections = new FirstDeliveryInspectionsPage(page, config);
      await inspections.open(dashboard);
      for (const record of scenario.inspections) {
        // Seed all relevant records on the first unfiltered page; see the fixture guide.
        const row = inspections.recordRow(record);
        if (!record.visible) {
          await expect(row).toHaveCount(0);
          continue;
        }
        await expect(row).toBeVisible();
        for (const [key, label] of Object.entries({ view: 'View', fill: 'Fill Inspection Report',
          unassign: 'Unassign Self', selfAssign: 'Self Assign', assign: 'Assign' })) {
          if (key in record) await expectAction(row, label, record[key]);
        }
        if (record.report) {
          await row.getByRole('button', { name: record.fill ? 'Fill Inspection Report' : 'View', exact: true }).click();
          if (record.report.settings) await inspections.expectReportSettings(record.report.settings);
          if ('specSectionNo' in record.report) await inspections.expectSpecDocumentState(record.report);
          for (const name of record.report.documents || []) {
            await page.getByText(name, { exact: true }).click();
            const viewer = page.getByRole('dialog');
            await expect(viewer).toBeVisible();
            await expect(viewer.locator('iframe, embed, object, img').first()).toBeVisible();
            await viewer.getByRole('button', { name: /close/i }).click();
          }
          if (record.report.submitWithoutPhotos) {
            expect(record.fill, 'A submission fixture must be assigned to this account').toBe(true);
            expect(record.report.settings?.['Photos are mandatory?'], 'Optional-photo submission needs explicit No setting').toBe(false);
            await expect(page.getByText('No photos yet. Click Add photo to upload one.', { exact: true })).toBeVisible();
            await inspections.fillReport(`optional-photo-${Date.now()}`);
            await inspections.saveProgress();
            await inspections.submit();
          }
          await page.getByRole('button', { name: 'Back', exact: true }).click();
        }
      }
    }
  });
}
