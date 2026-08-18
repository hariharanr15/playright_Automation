const assert = require('assert');
const { Then, When } = require('@cucumber/cucumber');
const { AnalyticsPage } = require('../../pages/booking/analytics.page');
const { EquipmentManagementPage } = require('../../pages/booking/equipment-management.page');
const { MyAccountPage } = require('../../pages/booking/my-account.page');
const { MyOrganizationPage } = require('../../pages/booking/my-organization.page');
const { NotificationPreferencePage } = require('../../pages/booking/notification-preference.page');
const { loadAutomationEnvironment } = require('../../utils/env');

loadAutomationEnvironment();
const APP_URL = process.env.APP_URL || 'https://stg-app.voyagecontrol.com';
const PROJECT_ID = process.env.PROJECT_ID || process.env.BUCKINGHAM_PALACE_PROJECT_ID || '5ET10000010';

function projectUrl(pathName) {
  return `${APP_URL.replace(/\/$/, '')}/${PROJECT_ID}/${pathName.replace(/^\//, '')}`;
}

function markerPattern(markerText) {
  const alternatives = String(markerText || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'));

  return new RegExp(alternatives.join('|'), 'i');
}

function routeReady(moduleName, currentUrl) {
  const normalized = moduleName.toLowerCase();
  const routePatterns = {
    'booking list': /\/booking(?:[/?#]|$)/i,
    calendar: /\/calendar(?:[/?#]|$)/i,
    'project management': /\/site-details(?:[/?#]|$)/i,
    'user management': /\/dashboard\/manage-user(?:[/?#]|$)/i,
    'equipment management': /\/list-equipment(?:[/?#]|$)/i,
    analytics: /\/(summary-emissions-report|material-emission-report|off-road-emissions-report)(?:[/?#]|$)/i,
    'environment reports': /\/environment-report(?:[/?#]|$)/i,
    'my account': /\/myaccount(?:[/?#]|$)/i,
    'my organization': /\/organization(?:[/?#]|$)/i,
    'notification preferences': /\/notification\/preference(?:[/?#]|$)/i
  };

  return Boolean(routePatterns[normalized]?.test(currentUrl));
}

function projectManagementAreaRouteReady(areaName, currentUrl) {
  const normalized = areaName.toLowerCase();
  const routePatterns = {
    'project details': /\/site-details(?:[/?#]|$)/i,
    'environment setting': /\/site-details(?:[/?#]|$)/i,
    availability: /\/availability(?:[/?#]|$)/i,
    'project settings': /\/settings(?:[/?#]|$)/i,
    'vehicle emissions': /\/vehicle-emission(?:[/?#]|$)/i,
    'equipment master': /\/equipment(?:[/?#]|$)/i,
    'global settings': /\/settings\/common-settings(?:[/?#]|$)/i,
    'country uoms': /\/country(?:[/?#]|$)/i
  };

  return Boolean(routePatterns[normalized]?.test(currentUrl));
}

async function waitForQuietPage(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => null);
  await page.locator('[role="progressbar"], .MuiCircularProgress-root')
    .first()
    .waitFor({ state: 'hidden', timeout: 30000 })
    .catch(() => null);
  await page.locator('.MuiBackdrop-root, [class*="loader" i], [class*="loading" i]')
    .first()
    .waitFor({ state: 'hidden', timeout: 30000 })
    .catch(() => null);
}

async function openDirectProjectRoute(page, routePath) {
  await page.goto(projectUrl(routePath), { waitUntil: 'domcontentloaded' });
  await waitForQuietPage(page);
}

async function openConstructionDeliveryModule(world, moduleName) {
  const page = world.page;
  const normalized = moduleName.toLowerCase();

  if (normalized === 'booking list') {
    await openDirectProjectRoute(page, 'booking');
    return;
  }

  if (normalized === 'calendar') {
    await openDirectProjectRoute(page, 'calendar');
    return;
  }

  if (normalized === 'project management') {
    await openDirectProjectRoute(page, 'site-details');
    return;
  }

  if (normalized === 'user management') {
    await openDirectProjectRoute(page, 'dashboard/manage-user');
    await waitForQuietPage(page);
    return;
  }

  if (normalized === 'equipment management') {
    const equipmentManagement = new EquipmentManagementPage(page);
    await equipmentManagement.openEquipmentListDirectly();
    await waitForQuietPage(page);
    return;
  }

  if (normalized === 'analytics') {
    const analytics = new AnalyticsPage(page);
    await analytics.openAnalyticsSection('Summary Emission');
    await waitForQuietPage(page);
    return;
  }

  if (normalized === 'environment reports') {
    const analytics = new AnalyticsPage(page);
    await analytics.openAnalyticsSection('Environment Reports');
    await waitForQuietPage(page);
    return;
  }

  if (normalized === 'my account') {
    const myAccount = new MyAccountPage(page);
    await myAccount.openMyAccount();
    await waitForQuietPage(page);
    return;
  }

  if (normalized === 'my organization') {
    const myOrganization = new MyOrganizationPage(page);
    await myOrganization.openMyOrganization();
    await waitForQuietPage(page);
    return;
  }

  if (normalized === 'notification preferences') {
    const notificationPreference = new NotificationPreferencePage(page);
    await notificationPreference.openNotificationPreferences();
    await waitForQuietPage(page);
    return;
  }

  throw new Error(`Unsupported Construction Delivery module: ${moduleName}`);
}

async function openProjectManagementArea(world, areaName) {
  const routes = {
    'project details': 'site-details',
    'environment setting': 'site-details',
    availability: 'availability',
    'project settings': 'settings',
    'vehicle emissions': 'vehicle-emission',
    'equipment master': 'equipment',
    'global settings': 'settings/common-settings',
    'country uoms': 'country'
  };
  const routePath = routes[areaName.toLowerCase()];

  if (!routePath) {
    throw new Error(`Unsupported Project Management area: ${areaName}`);
  }

  await openDirectProjectRoute(world.page, routePath);
}

When('I open the following Construction Delivery modules:', async function (dataTable) {
  this.moduleReviewResults = [];

  for (const row of dataTable.hashes()) {
    const moduleName = row.module;
    const expectedScreenMarker = row['expected screen marker'];
    await openConstructionDeliveryModule(this, moduleName);

    const bodyText = await this.page.locator('body').innerText({ timeout: 30000 });
    const currentUrl = this.page.url();
    const ready = markerPattern(expectedScreenMarker).test(bodyText) || routeReady(moduleName, currentUrl);
    this.moduleReviewResults.push({
      moduleName,
      expectedScreenMarker,
      url: currentUrl,
      ready
    });

    assert(
      ready,
      `${moduleName} did not show expected screen marker "${expectedScreenMarker}" or expected route. Current URL: ${currentUrl}`
    );
  }
});

When('I review the following Project Management areas:', async function (dataTable) {
  this.projectManagementReviewResults = [];

  for (const row of dataTable.hashes()) {
    const areaName = row.area;
    const expectedScreenMarker = row['expected screen marker'];
    await openProjectManagementArea(this, areaName);

    const bodyText = await this.page.locator('body').innerText({ timeout: 30000 });
    const currentUrl = this.page.url();
    const ready = markerPattern(expectedScreenMarker).test(bodyText) ||
      projectManagementAreaRouteReady(areaName, currentUrl);

    this.projectManagementReviewResults.push({
      areaName,
      expectedScreenMarker,
      url: currentUrl,
      ready
    });

    assert(
      ready,
      `${areaName} did not show expected screen marker "${expectedScreenMarker}" or expected route. Current URL: ${currentUrl}`
    );
  }
});

Then('each requested Construction Delivery module should be ready for review', async function () {
  assert(this.moduleReviewResults?.length, 'No Construction Delivery modules were reviewed.');

  const failed = this.moduleReviewResults.filter((result) => !result.ready);
  assert.deepStrictEqual(
    failed,
    [],
    `Modules not ready: ${failed.map((result) => result.moduleName).join(', ')}`
  );
});

Then('each requested Project Management area should be ready for review', async function () {
  assert(this.projectManagementReviewResults?.length, 'No Project Management areas were reviewed.');

  const failed = this.projectManagementReviewResults.filter((result) => !result.ready);
  assert.deepStrictEqual(
    failed,
    [],
    `Project Management areas not ready: ${failed.map((result) => result.areaName).join(', ')}`
  );
});

Then('no data-changing action should be performed', async function () {
  assert.strictEqual(this.inviteSubmitted, false, 'No invite should be submitted in safe Cucumber navigation scenarios.');
});
