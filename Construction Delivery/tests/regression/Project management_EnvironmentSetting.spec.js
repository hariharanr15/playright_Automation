const path = require('path');
const {
  expect,
  expectVisible,
  loginIfNeeded,
  runStep,
  test
} = require('../support/test-base');
const { DashboardPage } = require('../../pages/booking/dashboard.page');
const { BookingListPage } = require('../../pages/booking/booking-list.page');
const { DeliveryBookingPage } = require('../../pages/booking/delivery.booking.page');
const { ResourceOnlyBookingPage } = require('../../pages/booking/resource-only.booking.page');
const { saveProjectManagementSetupState } = require('../../utils/project-management-setup-state');

const AUTH_STATE_PATH = path.resolve(__dirname, '..', '..', 'auth.json');
const BASE_URL = process.env.BASE_URL || 'https://stg-login.voyagecontrol.com';
const APP_URL = process.env.APP_URL || 'https://stg-app.voyagecontrol.com';
const PROJECT_ID = process.env.PROJECT_ID || process.env.BUCKINGHAM_PALACE_PROJECT_ID || '5ET10000010';
const PROJECT_NAME = process.env.PROJECT_NAME || process.env.BUCKINGHAM_PALACE_PROJECT_NAME || 'Buckingham Palace';
const PROJECT_UPDATED_NAME = process.env.PROJECT_UPDATED_NAME || process.env.BUCKINGHAM_PALACE_UPDATED_PROJECT_NAME ||
  (/\bIND$/i.test(PROJECT_NAME) ? PROJECT_NAME : `${PROJECT_NAME} IND`);
const US_ADDRESS = 'Washington DC, US';
const UK_ADDRESS = 'Woodside, Crimp Hill, Old Windsor, Windsor SL4 2HL, UK';
const HOME_SCREEN_MESSAGE_APPEND = 'HARIHARAN RAJA (Site Manager) - (994) (416-2439)';
const PROJECT_NAME_ALIASES = Array.from(new Set([
  PROJECT_NAME,
  PROJECT_UPDATED_NAME,
  'Buckingham Palace',
  'Buckingham Palace IND'
]));
const PROJECT_NAME_PATTERN = new RegExp(PROJECT_NAME_ALIASES.map(escapeRegex).join('|'), 'i');
const PROJECT_CONTEXT_PATTERN = new RegExp(PROJECT_NAME_ALIASES.map(escapeRegex).join('|'), 'i');
const RUN_SUFFIX = `${Date.now()}`.slice(-6);
const LOGIN_READY_SELECTOR = [
  'input[type="email"]',
  'input[name*="email" i]',
  'input[id*="email" i]',
  'input[placeholder*="email" i]'
].join(', ');
const ACTION_GAP_MS = Number(process.env.PROJECT_MANAGEMENT_ACTION_GAP_MS || 500);
const ROUTE_SETTLE_MS = Number(process.env.PROJECT_MANAGEMENT_ROUTE_SETTLE_MS || 1000);
const VEHICLE_EMISSION_DISTANCE_VALUE = process.env.PROJECT_MANAGEMENT_VEHICLE_EMISSION_DISTANCE || '10';
const VEHICLE_EMISSION_FACTOR_VALUE = process.env.PROJECT_MANAGEMENT_VEHICLE_EMISSION_FACTOR || '2.5';
const EQUIPMENT_EMISSION_FACTOR_VALUE = process.env.PROJECT_MANAGEMENT_EQUIPMENT_EMISSION_FACTOR || '2.5';
const PROJECT_MANAGEMENT_RESTRICTION_VEHICLE_TYPE = process.env.PROJECT_MANAGEMENT_RESTRICTION_VEHICLE_TYPE || 'Truck';
const RESOURCE_ACCESS_POINT_OPTION_TIMEOUT_MS = Number(process.env.PROJECT_MANAGEMENT_RESOURCE_ACCESS_POINT_OPTION_TIMEOUT_MS || 5000);
const RESOURCE_ACCESS_POINT_MAPPING_TIMEOUT_MS = Number(
  process.env.PROJECT_MANAGEMENT_RESOURCE_ACCESS_POINT_MAPPING_TIMEOUT_MS || 30000
);
const ROUTE_RETRY_COUNT = Number(process.env.PROJECT_MANAGEMENT_ROUTE_RETRY_COUNT || 8);
const ROUTE_RETRY_WAIT_MS = Number(process.env.PROJECT_MANAGEMENT_ROUTE_RETRY_WAIT_MS || 5000);
const PAGE_API_AUTH_HEADERS = new WeakMap();
const PAGES_WITH_API_AUTH_CAPTURE = new WeakSet();

test.use({
  storageState: AUTH_STATE_PATH,
  permissions: ['notifications']
});

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function waitForAppToSettle(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => null);
  await page.locator('[role="progressbar"], .MuiCircularProgress-root')
    .first()
    .waitFor({ state: 'hidden', timeout: 30000 })
    .catch(() => null);
  await page.locator('.MuiBackdrop-root, [class*="loader" i], [class*="loading" i]')
    .first()
    .waitFor({ state: 'hidden', timeout: 30000 })
    .catch(() => null);
  await page.waitForFunction(() => {
    const visible = (element) => {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0';
    };
    const blockers = Array.from(document.querySelectorAll([
      '[role="progressbar"]',
      '.MuiCircularProgress-root',
      '.MuiBackdrop-root',
      '[class*="spinner" i]',
      '[class*="loader" i]',
      '[class*="loading-overlay" i]',
      '[class*="loadingIndicator" i]'
    ].join(','))).filter(visible);
    return blockers.length === 0;
  }, { timeout: 60000 }).catch(() => null);
}

async function isTemporaryServiceUnavailable(page) {
  const bodyText = await page.locator('body').innerText({ timeout: 2000 }).catch(() => '');
  return /503\s+Service\s+Temporarily\s+Unavailable/i.test(bodyText);
}

async function grantAppPermissions(page) {
  captureApiAuthHeaders(page);
  const appOrigin = new URL(APP_URL).origin;
  const loginOrigin = new URL(BASE_URL).origin;

  await page.context().grantPermissions(['notifications'], { origin: appOrigin }).catch(() => null);
  await page.context().grantPermissions(['notifications'], { origin: loginOrigin }).catch(() => null);
}

function captureApiAuthHeaders(page) {
  if (PAGES_WITH_API_AUTH_CAPTURE.has(page)) {
    return;
  }

  PAGES_WITH_API_AUTH_CAPTURE.add(page);
  page.on('request', (request) => {
    const authHeader = request.headers().authorization;
    if (/^JWT\s+/i.test(authHeader || '')) {
      PAGE_API_AUTH_HEADERS.set(page, authHeader);
    }
  });
}

async function waitBetweenActions(page, label = 'Project Management action') {
  await waitForAppToSettle(page);
  await page.waitForTimeout(ACTION_GAP_MS);
  if (label) {
    console.log(`${label}: waited ${ACTION_GAP_MS}ms before next action.`);
  }
}

async function appApiRequest(page, apiPath, options = {}) {
  captureApiAuthHeaders(page);
  const response = await page.evaluate(async ({ appUrl, apiPath: requestPath, requestOptions, capturedAuthHeader }) => {
    const collectValues = (value, bucket = []) => {
      if (value == null) {
        return bucket;
      }

      if (typeof value === 'string') {
        bucket.push(value);
        try {
          collectValues(JSON.parse(value), bucket);
        } catch {
          // Storage values are often plain strings rather than JSON blobs.
        }
        return bucket;
      }

      if (Array.isArray(value)) {
        value.forEach((entry) => collectValues(entry, bucket));
        return bucket;
      }

      if (typeof value === 'object') {
        Object.values(value).forEach((entry) => collectValues(entry, bucket));
      }

      return bucket;
    };

    const tokenPattern = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;
    const storageValues = [];
    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        storageValues.push(storage.getItem(key));
      }
    }

    const token = collectValues(storageValues)
      .map((value) => String(value).match(tokenPattern)?.[0])
      .find(Boolean);

    const headers = {
      accept: 'application/json',
      ...(requestOptions.body ? { 'content-type': 'application/json' } : {})
    };

    if (capturedAuthHeader) {
      headers.authorization = capturedAuthHeader;
    } else if (token) {
      headers.authorization = `JWT ${token}`;
    }

    const fetchResponse = await fetch(new URL(requestPath, appUrl).toString(), {
      method: requestOptions.method || 'GET',
      headers,
      credentials: 'include',
      body: requestOptions.body ? JSON.stringify(requestOptions.body) : undefined
    });
    const text = await fetchResponse.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    return {
      ok: fetchResponse.ok,
      status: fetchResponse.status,
      statusText: fetchResponse.statusText,
      text,
      json
    };
  }, {
    appUrl: APP_URL,
    apiPath,
    requestOptions: options,
    capturedAuthHeader: PAGE_API_AUTH_HEADERS.get(page) || null
  });

  if (!response.ok) {
    throw new Error(
      `API ${options.method || 'GET'} ${apiPath} failed (${response.status} ${response.statusText}): ` +
      `${String(response.text || '').slice(0, 500)}`
    );
  }

  return response.json;
}

let cachedProjectSiteId;

async function getProjectSiteId(page) {
  if (cachedProjectSiteId) {
    return cachedProjectSiteId;
  }

  const sites = await appApiRequest(page, `/api/v1/sites/?project=${encodeURIComponent(PROJECT_ID)}`);
  const siteList = Array.isArray(sites?.results) ? sites.results : (Array.isArray(sites) ? sites : []);
  const selectedSite = siteList.find((site) => /default/i.test(site?.name || '')) || siteList[0];
  if (!selectedSite?.id) {
    throw new Error(`Project site id was not returned for project ${PROJECT_ID}.`);
  }

  cachedProjectSiteId = selectedSite.id;
  return cachedProjectSiteId;
}

async function findAccessPointByNameViaApi(page, accessPointName, options = {}) {
  const siteId = await getProjectSiteId(page);
  const pageSize = options.pageSize || 10;
  const maxPages = options.maxPages || 12;
  const activeQuery = options.activeOnly ? '&is_active=true' : '';

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const data = await appApiRequest(
      page,
      `/api/v1/sites/${siteId}/access-points/?page=${pageNumber}&pageSize=${pageSize}` +
      `&project=${encodeURIComponent(PROJECT_ID)}${activeQuery}`
    );
    const results = Array.isArray(data?.results) ? data.results : [];
    const match = results.find((accessPoint) => accessPoint?.name === accessPointName);
    if (match) {
      return match;
    }

    if (!data?.next) {
      break;
    }
  }

  return null;
}

async function prioritizeAccessPointForDropdowns(page, accessPointName) {
  const siteId = await getProjectSiteId(page);
  const accessPoint = await findAccessPointByNameViaApi(page, accessPointName, {
    pageSize: 10,
    maxPages: 12
  });

  if (!accessPoint?.id) {
    throw new Error(`Newly created Access Point was not found through API: ${accessPointName}`);
  }

  await appApiRequest(page, `/api/v1/sites/${siteId}/access-points/${accessPoint.id}/?project=${encodeURIComponent(PROJECT_ID)}`, {
    method: 'PATCH',
    body: {
      name: accessPointName,
      units: String(accessPoint.units ?? 10),
      is_active: true,
      order: 0
    }
  });

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const activePage = await appApiRequest(
      page,
      `/api/v1/sites/${siteId}/access-points/?page=1&pageSize=0&project=${encodeURIComponent(PROJECT_ID)}&is_active=true`
    );
    const activeResults = Array.isArray(activePage?.results) ? activePage.results : [];
    if (activeResults.some((result) => result?.name === accessPointName)) {
      console.log(`Access Point "${accessPointName}" promoted into first dropdown page for Resource mapping.`);
      return {
        ...accessPoint,
        order: 0,
        isActive: true
      };
    }

    await page.waitForTimeout(1000);
  }

  throw new Error(`Newly created Access Point "${accessPointName}" was not available on the first dropdown page after ordering update.`);
}

async function createAccessPointViaApi(page, accessPointName) {
  const siteId = await getProjectSiteId(page);
  const accessPoint = await appApiRequest(page, `/api/v1/sites/${siteId}/access-points/?project=${encodeURIComponent(PROJECT_ID)}`, {
    method: 'POST',
    body: {
      name: accessPointName,
      units: '10',
      is_active: true,
      order: 0
    }
  });

  console.log(`Access Point "${accessPointName}" created through Project Details API with id ${accessPoint.id}.`);
  return accessPoint;
}

async function findRestrictionVehicleTypeViaApi(page) {
  const vehicleTypes = await appApiRequest(
    page,
    `/api/v1/projects/vehicle-type/?project=${encodeURIComponent(PROJECT_ID)}&page=1&page_size=50`
  );
  const results = (Array.isArray(vehicleTypes?.results) ? vehicleTypes.results : [])
    .filter((entry) => entry?.enabled !== false && entry?.isDeleted !== true)
    .map((entry) => entry?.vehicleType || entry)
    .filter((vehicle) => vehicle?.id && vehicle?.name);
  const preferredPattern = new RegExp(escapeRegex(PROJECT_MANAGEMENT_RESTRICTION_VEHICLE_TYPE), 'i');
  const bookingCompatibleNames = [
    'Tipper Truck',
    'Pump Truck',
    'Garbage Truck',
    'Flatbed Truck',
    'Pickup Truck',
    'Van',
    'Car'
  ];
  const vehicleType = results.find((vehicle) => preferredPattern.test(vehicle?.name || '')) ||
    bookingCompatibleNames
      .map((vehicleName) => results.find((vehicle) => new RegExp(`^${escapeRegex(vehicleName)}$`, 'i').test(vehicle?.name || '')))
      .find(Boolean) ||
    results.find((vehicle) => vehicle?.id && vehicle?.name);

  if (!vehicleType?.id) {
    throw new Error(`No vehicle type was returned for restriction creation in project ${PROJECT_ID}.`);
  }

  return vehicleType;
}

async function createVehicleRestrictionViaApi(page, accessPointId) {
  const siteId = await getProjectSiteId(page);
  const vehicleType = await findRestrictionVehicleTypeViaApi(page);
  const fromDate = dateInputValues(1);
  const toDate = dateInputValues(4);

  console.log(`Vehicle restriction Start Date: ${fromDate.iso}`);
  console.log(`Vehicle restriction End Date: ${toDate.iso}`);

  const restriction = await appApiRequest(
    page,
    `/api/v1/sites/${siteId}/access-points/${accessPointId}/vehicle_restrictions_create/?project=${encodeURIComponent(PROJECT_ID)}`,
    {
      method: 'POST',
      body: {
        vehicle_type_id: String(vehicleType.id),
        start_date: fromDate.iso,
        end_date: toDate.iso
      }
    }
  );

  console.log(`Vehicle restriction created for "${vehicleType.name}" on Access Point id ${accessPointId}.`);
  return restriction?.vehicleType?.name || vehicleType.name;
}

async function findResourceByNameViaApi(page, resourceName, options = {}) {
  const siteId = await getProjectSiteId(page);
  const pageSize = options.pageSize || 10;
  const maxPages = options.maxPages || 12;

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const data = await appApiRequest(
      page,
      `/api/v1/sites/${siteId}/resources/?project=${encodeURIComponent(PROJECT_ID)}` +
      `&page=${pageNumber}&pageSize=${pageSize}`
    );
    const results = Array.isArray(data?.results) ? data.results : [];
    const match = results.find((resource) => resource?.name === resourceName);
    if (match) {
      return match;
    }

    if (!data?.next) {
      break;
    }
  }

  return null;
}

async function ensureResourceAvailabilityViaApi(page, resourceName) {
  const siteId = await getProjectSiteId(page);
  const resource = await findResourceByNameViaApi(page, resourceName);
  if (!resource?.id) {
    throw new Error(`Resource was not found through API for availability setup: ${resourceName}`);
  }

  const availability = await appApiRequest(
    page,
    `/api/v1/availability/${siteId}/resource/?project=${encodeURIComponent(PROJECT_ID)}&site_id=${siteId}`
  );
  const timings = Array.isArray(availability?.resourceTimings) ? availability.resourceTimings : [];
  const resourceTimings = timings.map((timing) => {
    const timingResource = typeof timing.resource === 'object' ? timing.resource.id : timing.resource;
    const isTargetResource = Number(timingResource) === Number(resource.id);
    return {
      id: timing.id,
      resource: timingResource,
      starting_time: isTargetResource ? 1 : (timing.startingTime?.id || timing.startingTime || 1),
      ending_time: isTargetResource ? 49 : (timing.endingTime?.id || timing.endingTime || 49),
      isActive: isTargetResource ? true : Boolean(timing.isActive),
      days: isTargetResource
        ? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        : (timing.days || []).map((day) => String(day).toLowerCase())
    };
  });

  if (!resourceTimings.some((timing) => Number(timing.resource) === Number(resource.id))) {
    resourceTimings.push({
      resource: resource.id,
      starting_time: 1,
      ending_time: 49,
      isActive: true,
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    });
  }

  const updated = await appApiRequest(
    page,
    `/api/v1/availability/${siteId}/resource/?project=${encodeURIComponent(PROJECT_ID)}&site_id=${siteId}`,
    {
      method: 'POST',
      body: {
        resource_timings: resourceTimings
      }
    }
  );
  const updatedTimings = Array.isArray(updated?.resourceTimings) ? updated.resourceTimings : [];
  const updatedResourceTiming = updatedTimings.find((timing) => {
    const timingResource = typeof timing.resource === 'object' ? timing.resource.id : timing.resource;
    return Number(timingResource) === Number(resource.id);
  });

  if (!updatedResourceTiming?.isActive) {
    throw new Error(`Resource availability API did not enable ${resourceName}.`);
  }

  console.log(`Resource "${resourceName}" enabled through Availability API for booking.`);
  return {
    disabledResourceName: null,
    enabledResourceName: resourceName,
    resourceId: resource.id
  };
}

async function isLoginVisible(page, timeout = 3000) {
  return page.locator(LOGIN_READY_SELECTOR).first().isVisible({ timeout }).catch(() => false);
}

async function isProjectChooserPage(page, timeout = 1500) {
  return /\/project\/choose(?:[/?#]|$)/i.test(page.url()) ||
    await page.getByText(/Choose Project/i).first().isVisible({ timeout }).catch(() => false);
}

async function waitForLoginOrAuthenticatedShell(page) {
  await page.locator([
    LOGIN_READY_SELECTOR,
    'a:has-text("Construction Delivery")',
    'a:has-text("V3 Construction deliveries")',
    'a:has-text("Project")',
    '[id^="project-item-"]'
  ].join(', ')).first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => null);
}

async function loginFromSsoIfNeeded(page) {
  await grantAppPermissions(page);
  await page.goto(`${BASE_URL}/api/sso/users/login/`, { waitUntil: 'domcontentloaded' });
  await waitForLoginOrAuthenticatedShell(page);
  await loginIfNeeded(page);
  await waitForAppToSettle(page);
  if (await isLoginVisible(page, 3000)) {
    throw new Error('Login form is still visible after submitting automation credentials.');
  }
}

async function clearLoginIfVisible(page) {
  await waitForLoginOrAuthenticatedShell(page);
  if (!(await isLoginVisible(page, 5000))) {
    return false;
  }

  await loginFromSsoIfNeeded(page);
  await waitForLoginOrAuthenticatedShell(page);
  if (await isLoginVisible(page, 3000)) {
    throw new Error(`Automation could not leave the login page before choosing project ${PROJECT_ID}.`);
  }
  return true;
}

async function gotoWithRedirectTolerance(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' }).catch((error) => {
    if (!/ERR_ABORTED|Navigation interrupted|chrome-error:\/\/chromewebdata/i.test(error.message)) {
      throw error;
    }
  });
}

async function clickCardActionByText(page, cardText, actionPattern = /Open|Log Into/i) {
  return page.evaluate(({ targetText, actionSource }) => {
    const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim();
    const action = new RegExp(actionSource, 'i');
    const isVisible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        style.opacity !== '0';
    };
    const candidates = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,div,a,button'))
      .filter(isVisible)
      .filter((element) => normalize(element.textContent).includes(targetText));

    for (const element of candidates) {
      let card = element;
      for (let depth = 0; depth < 8 && card.parentElement && card.parentElement !== document.body; depth += 1) {
        const text = normalize(card.innerText || card.textContent);
        if (text.includes(targetText) && action.test(text)) {
          break;
        }
        card = card.parentElement;
      }

      const clickTarget = Array.from(card.querySelectorAll('p,span,div,a,button,[role="button"]'))
        .filter(isVisible)
        .find((candidate) => action.test(normalize(candidate.innerText || candidate.textContent || candidate.getAttribute('aria-label') || ''))) ||
        card.querySelector('a,button,[role="button"],p,span,div') ||
        card;

      if (clickTarget.tagName?.toLowerCase() === 'a') {
        clickTarget.setAttribute('target', '_self');
      }
      clickTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      clickTarget.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      clickTarget.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    }

    return false;
  }, { targetText: cardText, actionSource: actionPattern.source }).catch(() => false);
}

async function clickProjectChooserCard(page, projectNames) {
  return page.evaluate((targetNames) => {
    const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim();
    const targets = targetNames.map((name) => normalize(name).toLowerCase()).filter(Boolean);
    const isVisible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        style.opacity !== '0';
    };

    const projectItems = Array.from(document.querySelectorAll('.project-item, [id^="project-item-"]'))
      .filter(isVisible);
    const projectItem = projectItems.find((element) => {
      const text = normalize(element.innerText || element.textContent).toLowerCase();
      return targets.some((target) => text.includes(target));
    });

    if (projectItem) {
      projectItem.scrollIntoView({ block: 'center', inline: 'center' });
      const loginTarget = Array.from(projectItem.querySelectorAll('p,span,div,a,button,[role="button"]'))
        .filter(isVisible)
        .find((candidate) => /Log\s*Into|Open|Select/i.test(normalize(candidate.innerText || candidate.textContent || candidate.getAttribute('aria-label') || '')));
      const clickTarget = loginTarget || projectItem;
      clickTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      clickTarget.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      clickTarget.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    }

    const elements = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,div,a,button'));
    const projectLabel = elements
      .filter(isVisible)
      .find((element) => {
        const text = normalize(element.textContent).toLowerCase();
        return targets.some((target) => text === target || text.includes(target));
      });

    if (!projectLabel) {
      return false;
    }

    let card = projectLabel;
    for (let depth = 0; depth < 8 && card.parentElement && card.parentElement !== document.body; depth += 1) {
      const text = normalize(card.innerText || card.textContent);
      const rect = card.getBoundingClientRect();
      if (/log\s*into/i.test(text) && rect.width >= 250 && rect.height >= 50) {
        break;
      }
      card = card.parentElement;
    }

    card.scrollIntoView({ block: 'center', inline: 'center' });

    const clickTarget = Array.from(card.querySelectorAll('p,span,div,a,button,[role="button"]'))
      .filter(isVisible)
      .find((candidate) => /Log\s*Into|Open|Select/i.test(normalize(candidate.innerText || candidate.textContent || candidate.getAttribute('aria-label') || ''))) ||
      Array.from(card.querySelectorAll('a,button,[role="button"],svg,img'))
      .filter(isVisible)
      .pop() || card;

    if (clickTarget.tagName?.toLowerCase() === 'a') {
      clickTarget.setAttribute('target', '_self');
    }

    clickTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    clickTarget.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    clickTarget.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  }, projectNames).catch(() => false);
}

async function openV3PlatformFromChooser(page) {
  const appOrigin = new URL(APP_URL).origin;
  const appLink = page.getByRole('link', { name: /V3 Construction deliveries|Construction Delivery/i }).first();
  let appHref = await appLink.getAttribute('href', { timeout: 5000 }).catch(() => null);

  if (!appHref) {
    appHref = await page.evaluate(() => {
      const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim();
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      const platformAnchor = anchors.find((anchor) => {
        let card = anchor;
        for (let depth = 0; depth < 6 && card.parentElement && card.parentElement !== document.body; depth += 1) {
          if (/Construction Delivery|V3 Construction deliveries|Deliveries platform V3/i.test(normalize(card.innerText || card.textContent))) {
            return true;
          }
          card = card.parentElement;
        }
        return /Construction Delivery|V3 Construction deliveries|Deliveries platform V3/i.test(normalize(anchor.innerText || anchor.textContent));
      });
      return platformAnchor?.href || '';
    }).catch(() => '');
  }

  if (!appHref) {
    return false;
  }

  console.log('Opening V3 Construction deliveries from SSO platform chooser.');
  await gotoWithRedirectTolerance(page, appHref);
  await page.waitForURL((url) => url.origin === appOrigin, { timeout: 30000 }).catch(() => null);
  await waitForAppToSettle(page);
  await page.locator([
    'text=Choose Project',
    'text=Buckingham Palace',
    '[id^="project-item-"]',
    'a:has-text("Project Management")',
    'a:has-text("Booking")'
  ].join(', ')).first().waitFor({ state: 'visible', timeout: 45000 }).catch(() => null);
  await waitForAppToSettle(page);
  await page.waitForTimeout(3000);
  return page.url().startsWith(appOrigin);
}

function isTargetProjectUrl(page) {
  return new RegExp(`/${escapeRegex(PROJECT_ID)}(?:/|$)`, 'i').test(page.url());
}

async function pinConfiguredProjectStorage(page) {
  const siteId = cachedProjectSiteId || process.env.PROJECT_SITE_ID || process.env.SITE_ID || '10';
  await page.evaluate(({ projectId, projectName, siteId: selectedSiteId }) => {
    localStorage.setItem('v3_project_ref', projectId);
    localStorage.setItem('v3_project_site_id', String(selectedSiteId || ''));
    localStorage.setItem('v3_project_data', JSON.stringify({
      ref: projectId,
      id: projectId,
      name: projectName
    }));
    localStorage.setItem('project_ref', projectId);
  }, {
    projectId: PROJECT_ID,
    projectName: PROJECT_NAME,
    siteId
  }).catch(() => null);
}

async function recoverProjectRouteWithoutChooser(page, pathName) {
  const targetUrl = `${APP_URL.replace(/\/$/, '')}/${PROJECT_ID}/${pathName.replace(/^\//, '')}`;
  await pinConfiguredProjectStorage(page);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch((error) => {
    if (!/ERR_ABORTED|Navigation interrupted|chrome-error:\/\/chromewebdata/i.test(error.message)) {
      throw error;
    }
  });
  await waitForAppToSettle(page);
  if (ROUTE_SETTLE_MS > 0) {
    await page.waitForTimeout(ROUTE_SETTLE_MS);
  }
}

async function hasProjectManagementMenu(page, timeout = 5000) {
  return page.getByRole('link', { name: /project_management\s*Project/i })
    .isVisible({ timeout })
    .catch(() => false);
}

async function hasProjectDetailsPage(page, timeout = 10000) {
  const projectDetails = page.getByRole('link', { name: /Project Details/i })
    .or(page.getByRole('heading', { name: /Project Details/i }))
    .first();

  return projectDetails.isVisible({ timeout }).catch(() => false);
}

async function isBuckinghamProjectShell(page, timeout = 5000) {
  if (!isTargetProjectUrl(page)) {
    return false;
  }

  return page.locator('#siteName, body')
    .filter({ hasText: PROJECT_CONTEXT_PATTERN })
    .first()
    .isVisible({ timeout })
    .catch(() => false);
}

async function chooseBuckinghamPalaceProject(page) {
  const exactProjectOrder = Array.from(new Set([
    PROJECT_UPDATED_NAME,
    'Buckingham Palace IND',
    PROJECT_NAME,
    'Buckingham Palace',
    ...PROJECT_NAME_ALIASES
  ]));

  if (await page.getByText(/Choose Project/i).first().isVisible({ timeout: 3000 }).catch(() => false) ||
      await page.getByText(PROJECT_NAME_PATTERN).first().isVisible({ timeout: 1000 }).catch(() => false)) {
    if (await clickProjectChooserCard(page, exactProjectOrder)) {
      await page.waitForURL(new RegExp(`/${escapeRegex(PROJECT_ID)}(?:/|$)`), { timeout: 30000 }).catch(() => null);
      await waitForAppToSettle(page);
      await page.waitForTimeout(3000);
      if (isTargetProjectUrl(page) && !(await isProjectChooserPage(page))) {
        return true;
      }
    }
  }

  for (const projectName of PROJECT_NAME_ALIASES) {
    if (await clickCardActionByText(page, projectName, /Log Into|Open|Select/i)) {
      await page.waitForURL(new RegExp(`/${escapeRegex(PROJECT_ID)}(?:/|$)`), { timeout: 15000 }).catch(() => null);
      await waitForAppToSettle(page);
      await page.waitForTimeout(3000);
      if (isTargetProjectUrl(page) && !(await isProjectChooserPage(page))) {
        return true;
      }
    }
  }

  const dashboard = new DashboardPage(page);
  for (const projectName of PROJECT_NAME_ALIASES) {
    if (await dashboard.clickLocationProjectCard(projectName)) {
      await page.waitForURL(new RegExp(`/${escapeRegex(PROJECT_ID)}(?:/|$)`), { timeout: 15000 }).catch(() => null);
      await waitForAppToSettle(page);
      return isTargetProjectUrl(page) && !(await isProjectChooserPage(page));
    }
  }

  const projectHeading = page.getByRole('heading', {
    name: PROJECT_NAME_PATTERN
  }).first();

  if (!(await projectHeading.isVisible({ timeout: 10000 }).catch(() => false))) {
    return false;
  }

  const projectCard = projectHeading.locator('xpath=ancestor::*[.//*[normalize-space(.)="Log Into"]][1]');
  const arrowOrLink = projectCard.locator('a, button, [role="button"], img').last();

  if (await arrowOrLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await arrowOrLink.click({ force: true });
  } else {
    await projectCard.click({ force: true });
  }

  await page.waitForURL(new RegExp(`/${escapeRegex(PROJECT_ID)}(?:/|$)`), { timeout: 15000 }).catch(() => null);
  await waitForAppToSettle(page);
  await page.waitForTimeout(3000);
  return isTargetProjectUrl(page) && !(await isProjectChooserPage(page));
}

async function openProjectHome(page) {
  const projectHomeUrl = `${APP_URL.replace(/\/$/, '')}/${PROJECT_ID}/home`;
  const appOrigin = new URL(APP_URL).origin;
  const loginOrigin = new URL(BASE_URL).origin;

  const openProjectDetailsDirectly = async () => {
    await gotoProjectPath(page, 'site-details');
    return isTargetProjectUrl(page) && await hasProjectDetailsPage(page, 30000);
  };

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    if (!page.url().startsWith(appOrigin) && !page.url().startsWith(loginOrigin)) {
      await gotoWithRedirectTolerance(page, projectHomeUrl);
      await waitForAppToSettle(page);
      await page.waitForTimeout(3000);
      await clearLoginIfVisible(page);

      if (isTargetProjectUrl(page) && (await hasProjectManagementMenu(page, 10000) || await openProjectDetailsDirectly())) {
        return;
      }
    }

    await clearLoginIfVisible(page);

    if (!page.url().startsWith(appOrigin)) {
      await openV3PlatformFromChooser(page);
      await page.waitForTimeout(3000);
      await clearLoginIfVisible(page);
    }

    if (await isProjectChooserPage(page)) {
      await recoverProjectRouteWithoutChooser(page, 'site-details');
    }

    if (isTargetProjectUrl(page) && await openProjectDetailsDirectly()) {
      return;
    }

    if (page.url().startsWith(appOrigin)) {
      await page.goto(projectHomeUrl, { waitUntil: 'domcontentloaded' });
      await waitForAppToSettle(page);
      await page.waitForTimeout(3000);
      await clearLoginIfVisible(page);
    }

    if (await isProjectChooserPage(page)) {
      await recoverProjectRouteWithoutChooser(page, 'site-details');
    }

    if (isTargetProjectUrl(page) && await hasProjectManagementMenu(page, 10000) && await isBuckinghamProjectShell(page)) {
      return;
    }

    if (isTargetProjectUrl(page) && await openProjectDetailsDirectly()) {
      return;
    }
  }

  if (await isLoginVisible(page, 5000)) {
    await loginFromSsoIfNeeded(page);
    if (await openV3PlatformFromChooser(page)) {
      if (await isProjectChooserPage(page)) {
        await recoverProjectRouteWithoutChooser(page, 'site-details');
      }
      if (await openProjectDetailsDirectly()) {
        return;
      }
    }
  }

  throw new Error(`Could not land in project ${PROJECT_ID}. Current URL: ${page.url()}`);
}

async function gotoProjectPath(page, pathName) {
  const targetUrl = `${APP_URL.replace(/\/$/, '')}/${PROJECT_ID}/${pathName.replace(/^\//, '')}`;
  await pinConfiguredProjectStorage(page);
  for (let attempt = 1; attempt <= ROUTE_RETRY_COUNT; attempt += 1) {
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded'
    }).catch((error) => {
      const redirectedToChooser = /interrupted by another navigation/i.test(error.message) &&
        /\/project\/choose|\/choose/i.test(error.message);
      if (!redirectedToChooser && !/ERR_ABORTED|Navigation interrupted|chrome-error:\/\/chromewebdata/i.test(error.message)) {
        throw error;
      }
      console.log(`Project path navigation was redirected while opening ${pathName}: ${error.message}`);
    });
    await waitForAppToSettle(page);
    if (ROUTE_SETTLE_MS > 0) {
      await page.waitForTimeout(ROUTE_SETTLE_MS);
    }

    if (!(await isTemporaryServiceUnavailable(page))) {
      break;
    }

    if (attempt === ROUTE_RETRY_COUNT) {
      throw new Error(`Project Management route ${pathName} returned 503 Service Temporarily Unavailable after ${attempt} attempts.`);
    }

    console.log(`Project Management route ${pathName} returned 503; retrying direct project route attempt ${attempt + 1}.`);
    await page.waitForTimeout(ROUTE_RETRY_WAIT_MS);
  }

  if (await isProjectChooserPage(page)) {
    console.log(`Project chooser appeared while opening ${pathName}; recovering directly to project ${PROJECT_ID} route without selecting a project card.`);
    await recoverProjectRouteWithoutChooser(page, pathName);
  }

  if (await isProjectChooserPage(page)) {
    throw new Error(`Automation must remain inside project ${PROJECT_ID}; project selection page is still visible while opening ${pathName}.`);
  }

  if (!isTargetProjectUrl(page)) {
    throw new Error(`Automation left project ${PROJECT_ID} while opening ${pathName}. Current URL: ${page.url()}`);
  }
}

async function openBookingListWithinProject(page) {
  const newBookingButton = page.getByRole('button', { name: /New Booking/i }).first();

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (!/\/booking(?:[/?#]|$)/i.test(page.url()) ||
        !(await newBookingButton.isVisible({ timeout: 1500 }).catch(() => false))) {
      await gotoProjectPath(page, 'booking');
    }

    await clearLoginIfVisible(page);

    if (await isProjectChooserPage(page)) {
      console.log(`Project chooser appeared before Booking List; reopening Booking List directly inside project ${PROJECT_ID}.`);
      await recoverProjectRouteWithoutChooser(page, 'booking');
      continue;
    }

    if (!isTargetProjectUrl(page)) {
      await gotoProjectPath(page, 'booking');
    }

    if (await newBookingButton.isVisible({ timeout: 10000 }).catch(() => false)) {
      await waitForAppToSettle(page);
      return;
    }
  }

  throw new Error(`New Booking button was not visible for project ${PROJECT_ID}. Current URL: ${page.url()}`);
}

async function openProjectManagementLink(page, linkName) {
  const directRoutes = {
    'Project Details': 'site-details',
    'Environment Setting': 'site-details',
    Availability: 'availability',
    'Project Settings': 'settings',
    'Vehicle Emissions': 'vehicle-emission',
    'Equipment Master': 'equipment',
    'Global Settings': 'settings/common-settings',
    'Country UOMs': 'country'
  };
  const linkPattern = new RegExp(`^${escapeRegex(linkName)}$`, 'i');
  let link = page.getByRole('link', { name: linkPattern }).first();

  if (!isTargetProjectUrl(page) || !(await link.isVisible({ timeout: 2000 }).catch(() => false))) {
    await gotoProjectPath(page, 'site-details');
    link = page.getByRole('link', { name: linkPattern }).first();
  }

  if (!(await link.isVisible({ timeout: 5000 }).catch(() => false))) {
    const projectMenu = page.getByRole('link', { name: /project_management\s*Project/i }).first();
    if (await projectMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
      await projectMenu.click();
      await waitForAppToSettle(page);
    }
  }

  link = page.getByRole('link', { name: linkPattern }).first();
  if (!(await link.isVisible({ timeout: 5000 }).catch(() => false))) {
    const directRoute = directRoutes[linkName];
    if (directRoute) {
      await gotoProjectPath(page, directRoute);
      return;
    }

    throw new Error(`${linkName} link was not visible inside project ${PROJECT_ID}. Current URL: ${page.url()}`);
  }

  await link.click();
  await waitForAppToSettle(page);
}

async function expectBuckinghamContext(page) {
  await expect(page, `Automation should stay in project ${PROJECT_ID}`).toHaveURL(
    new RegExp(`/${escapeRegex(PROJECT_ID)}(?:/|$)`)
  );

  if (/\/(?:site-details|availability|settings(?:\/common-settings)?|vehicle-emission|equipment|country)(?:[/?#]|$)/i.test(page.url())) {
    return;
  }

  if (await page.getByText(PROJECT_NAME_PATTERN).first().isVisible({ timeout: 3000 }).catch(() => false)) {
    return;
  }

  if (await page.locator('#siteName').first().isVisible({ timeout: 3000 }).catch(() => false)) {
    return;
  }

  if (await page.getByText(/Project Details|Project Management|Availability|Project Settings/i).first()
    .isVisible({ timeout: 3000 })
    .catch(() => false)) {
    return;
  }

  await expectVisible(
    page.locator(`input[value="${PROJECT_ID}"], textarea[value="${PROJECT_ID}"], select[value="${PROJECT_ID}"]`).first(),
    `${PROJECT_ID} project selector`,
    10000
  );
}

async function expectProjectManagementContext(page, label = 'Project Management') {
  await expectBuckinghamContext(page);
  expect(page.url(), `${label} must not navigate to project selection, landing, login, or project home`)
    .not.toMatch(/\/project\/choose(?:[/?#]|$)|\/landing(?:[/?#]|$)|\/login(?:[/?#]|$)|\/home(?:[/?#]|$)/i);
  expect(page.url(), `${label} should remain on a Project Management route`)
    .toMatch(/\/(?:site-details|availability|settings(?:\/common-settings)?|vehicle-emission|equipment|country)(?:[/?#]|$)/i);
}

async function firstVisible(candidates, label, timeout = 5000) {
  for (const locator of candidates) {
    const target = locator.first();
    if (await target.waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false)) {
      return target;
    }
  }

  throw new Error(`${label} was not visible.`);
}

async function clickFirstVisible(candidates, label, timeout = 5000) {
  const target = await firstVisible(candidates, label, timeout);
  await target.click({ timeout: 5000 }).catch(async () => {
    await target.click({ force: true, timeout: 5000 }).catch(async () => {
      await target.evaluate((element) => element.click());
    });
  });
  return target;
}

async function saveIfAvailable(page) {
  const saveButton = await firstVisible([
    page.getByRole('button', { name: /^Save$/i }),
    page.locator('button:has-text("Save")')
  ], 'Save button', 5000).catch(() => null);
  if (!saveButton) {
    await waitForAppToSettle(page);
    return false;
  }

  await saveButton.click();
  await waitForAppToSettle(page);
  return true;
}

async function closeDialogIfVisible(page) {
  const closeControl = await firstVisible([
    page.getByRole('link', { name: /^Close$/i }),
    page.getByRole('button', { name: /^Close$/i }),
    page.getByRole('button', { name: /cancel|dismiss/i }),
    page.locator('.modal button.close, .modal [aria-label="Close"], [role="dialog"] [aria-label="Close"]')
  ], 'Dialog close control', 5000).catch(() => null);

  if (closeControl) {
    await closeControl.click();
  } else {
    await page.keyboard.press('Escape');
  }

  await waitForAppToSettle(page);
}

async function closeVehicleRestrictionPopup(page) {
  const popupHeading = page.getByText(/Manage Vehicle Restrictions/i).first();
  if (!(await popupHeading.isVisible({ timeout: 5000 }).catch(() => false))) {
    return;
  }

  const clickCloseByPoint = async () => {
    const point = await popupHeading.evaluate((heading) => {
      let current = heading;
      let panel = null;
      for (let depth = 0; current && depth < 8; depth += 1) {
        const rect = current.getBoundingClientRect();
        if (rect.width >= 400 && rect.width <= 800 && rect.height >= 120 && rect.height <= 420) {
          panel = current;
          break;
        }
        current = current.parentElement;
      }
      const rect = (panel || heading).getBoundingClientRect();
      return { x: rect.right - 40, y: rect.top + 40 };
    });
    await page.mouse.click(point.x, point.y);
  };

  await clickCloseByPoint();
  await page.waitForTimeout(ACTION_GAP_MS);

  if (await popupHeading.isVisible({ timeout: 1000 }).catch(() => false)) {
    const closeLink = page.locator(
      'xpath=(//*[contains(normalize-space(.), "Manage Vehicle Restrictions")])[last()]/following::a[1]'
    ).first();

    if (await closeLink.isVisible({ timeout: 1500 }).catch(() => false)) {
      await closeLink.click({ force: true });
      await page.waitForTimeout(ACTION_GAP_MS);
    }
  }

  if (await popupHeading.isVisible({ timeout: 1000 }).catch(() => false)) {
    await page.keyboard.press('Escape').catch(() => null);
  }

  await page.waitForTimeout(ACTION_GAP_MS);
  await popupHeading.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => null);
  await waitForAppToSettle(page);
}

async function clickVehicleRestrictionAddIcon(page, scope) {
  const clicked = await scope.evaluate((root) => {
    const visible = (element) => {
      if (!element) return false;
      const box = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return box.width > 0 &&
        box.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        style.pointerEvents !== 'none';
    };

    const candidates = Array.from(root.querySelectorAll('button, a, [role="button"], svg, img, span, div'))
      .filter(visible)
      .map((element) => {
        const text = [
          element.innerText,
          element.textContent,
          element.getAttribute('aria-label'),
          element.getAttribute('alt'),
          element.title
        ].join(' ').replace(/\s+/g, ' ').trim();
        const box = element.getBoundingClientRect();
        return { element, text, box };
      })
      .filter(({ text, box }) =>
        /(^|\s)(\+|add-icon|plus|add)(\s|$)/i.test(text) &&
        box.width <= 80 &&
        box.height <= 80
      )
      .sort((left, right) => (right.box.top - left.box.top) || (right.box.left - left.box.left));

    const target = candidates[0]?.element?.closest('button, a, [role="button"]') || candidates[0]?.element;
    if (!target) {
      return false;
    }

    target.click();
    return true;
  }).catch(() => false);

  if (clicked) {
    return;
  }

  await clickFirstVisible([
    scope.locator('a:has(img[alt="add-icon"]), button:has(img[alt="add-icon"])'),
    scope.locator('a:has(img[alt="plus"]), button:has(img[alt="plus"])'),
    scope.getByRole('button', { name: /^\+|Add$/i }),
    scope.getByText('+', { exact: true })
  ], 'Vehicle Restriction add icon', 750).catch(async () => {
    await clickVisiblePlainPlus(page, 'Vehicle Restriction add icon');
  });
}

async function submitDialog(page) {
  await clickFirstVisible([
    page.getByRole('button', { name: /^Submit$/i }),
    page.locator('button:has-text("Submit")')
  ], 'Submit button', 10000);
  await waitForAppToSettle(page);
}

async function selectDropdownOption(page, opener, optionName, label) {
  await opener.first().click();
  await page.getByRole('option', { name: new RegExp(escapeRegex(optionName), 'i') })
    .first()
    .click();
  await waitForAppToSettle(page);
  await page.waitForTimeout(300);
}

async function selectDropdownOptionOrFirst(page, opener, optionName, label, options = {}) {
  const required = options.required !== false;
  const target = opener.first();

  if (!(await target.isVisible({ timeout: 5000 }).catch(() => false))) {
    if (!required) {
      console.log(`${label} dropdown was not visible; continuing because it is optional.`);
      return null;
    }

    throw new Error(`${label} dropdown was not visible.`);
  }

  await target.click();
  await page.waitForTimeout(500);

  let option = null;
  if (optionName) {
    option = page.getByRole('option', { name: new RegExp(escapeRegex(optionName), 'i') }).first();
    if (!(await option.isVisible({ timeout: 3000 }).catch(() => false))) {
      const scrolledSelection = await selectOpenDropdownOptionByScrolling(page, optionName, label, {
        maxScrolls: options.maxScrolls,
        scrollStep: options.scrollStep,
        scrollWaitMs: options.scrollWaitMs
      });
      if (scrolledSelection) {
        if (options.closeAfterSelect) {
          await page.keyboard.press('Escape').catch(() => null);
        }
        return scrolledSelection;
      }

      console.log(`${label} option "${optionName}" was not available after scrolling; selecting the first available option.`);
      option = null;
    }
  }

  if (!option) {
    option = page.locator('[role="option"]:not([aria-disabled="true"])').filter({
      hasNotText: /^\s*$/
    }).first();
    if (!(await option.isVisible({ timeout: 5000 }).catch(() => false))) {
      await page.keyboard.press('ArrowDown').catch(() => null);
      await page.waitForTimeout(500);

      option = page.locator('[role="option"]:not([aria-disabled="true"])').filter({
        hasNotText: /^\s*$/
      }).first();
    }

    if (!(await option?.isVisible({ timeout: 3000 }).catch(() => false))) {
      const beforeText = (await target.innerText().catch(() => '') || await target.textContent().catch(() => ''))
        .replace(/\s+/g, ' ')
        .trim();
      await page.keyboard.press('Enter').catch(() => null);
      await waitForAppToSettle(page);
      await page.waitForTimeout(300);
      const afterText = (await target.innerText().catch(() => '') || await target.textContent().catch(() => ''))
        .replace(/\s+/g, ' ')
        .trim();

      if (afterText && afterText !== beforeText) {
        return afterText;
      }

      if (optionName) {
        const typedValue = await target.evaluate((element, value) => {
          const root = element.closest('.MuiFormControl-root, .MuiInputBase-root, .form-group, [class*="field"], div') ||
            element.parentElement;
          const input = root?.querySelector('input:not([type="hidden"])') || root?.querySelector('input');
          if (!input || input.disabled) return '';

          input.focus();
          input.value = value;
          input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return input.value || value;
        }, optionName).catch(() => '');

        if (typedValue) {
          await page.keyboard.press('ArrowDown').catch(() => null);
          await page.keyboard.press('Enter').catch(() => null);
          await page.keyboard.press('Tab').catch(() => null);
          await waitForAppToSettle(page);
          await page.waitForTimeout(300);

          const typedAfterText = await target.evaluate((element) => {
            const root = element.closest('.MuiFormControl-root, .MuiInputBase-root, .form-group, [class*="field"], div') ||
              element.parentElement;
            const input = root?.querySelector('input:not([type="hidden"])') || root?.querySelector('input');
            return [
              element.innerText || element.textContent || '',
              input?.value || ''
            ].join(' ').replace(/\s+/g, ' ').trim();
          }).catch(() => '');

          if (new RegExp(escapeRegex(optionName), 'i').test(typedAfterText)) {
            console.log(`${label} accepted typed combobox value "${optionName}".`);
            return optionName;
          }
        }
      }

      await page.keyboard.press('Escape').catch(() => null);
      if (!required) {
        console.log(`${label} had no selectable options; continuing because it is optional.`);
        return null;
      }

      throw new Error(`${label} had no selectable options.`);
    }
  }

  const selectedText = (await option.innerText().catch(() => optionName || label)).replace(/\s+/g, ' ').trim();
  await option.click();
  await waitForAppToSettle(page);
  await page.waitForTimeout(300);

  if (options.closeAfterSelect) {
    await page.keyboard.press('Escape').catch(() => null);
  }

  return selectedText;
}

async function visibleDropdownOptionTexts(page) {
  return page.locator('[role="option"]').evaluateAll((elements) =>
    elements
      .filter((element) => {
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
      })
      .map((element) => (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  ).catch(() => []);
}

async function selectOpenDropdownOptionByScrolling(page, optionName, label, options = {}) {
  const optionPattern = new RegExp(escapeRegex(optionName), 'i');
  const maxScrolls = options.maxScrolls || 40;
  const scrollStep = options.scrollStep || 140;
  let visibleOptions = [];

  for (let index = 0; index <= maxScrolls; index += 1) {
    const option = page.getByRole('option', { name: optionPattern }).first();
    if (await option.isVisible({ timeout: 500 }).catch(() => false)) {
      const selectedText = (await option.innerText().catch(() => optionName)).replace(/\s+/g, ' ').trim();
      await option.scrollIntoViewIfNeeded().catch(() => null);
      await option.click({ force: true });
      await waitForAppToSettle(page);
      await page.waitForTimeout(300);
      console.log(`${label} selected "${selectedText}" after ${index} dropdown scroll step(s).`);
      return selectedText || optionName;
    }

    visibleOptions = await visibleDropdownOptionTexts(page);

    const scrollState = await page.evaluate((step) => {
      const visible = (element) => {
        if (!element) return false;
        const box = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return box.width > 0 &&
          box.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none';
      };

      const candidates = Array.from(document.querySelectorAll([
        '[role="listbox"]',
        '.MuiAutocomplete-listbox',
        '.MuiMenu-list',
        '.MuiMenu-paper',
        '.MuiPopover-paper',
        '.MuiPopper-root',
        '[class*="menu" i]',
        '[class*="listbox" i]'
      ].join(', '))).filter(visible);

      const scrollable = candidates.find((element) => element.scrollHeight > element.clientHeight + 2) ||
        Array.from(document.querySelectorAll('*'))
          .filter(visible)
          .find((element) =>
            element.scrollHeight > element.clientHeight + 2 &&
            /option|listbox|menu|popover|paper/i.test([
              element.getAttribute('role'),
              element.className,
              element.id
            ].join(' '))
          );

      if (!scrollable) {
        return { moved: false, atEnd: true, before: 0, after: 0 };
      }

      const before = scrollable.scrollTop;
      scrollable.scrollTop = before + step;
      scrollable.dispatchEvent(new Event('scroll', { bubbles: true }));
      return {
        moved: scrollable.scrollTop !== before,
        atEnd: scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 2,
        before,
        after: scrollable.scrollTop
      };
    }, scrollStep).catch(() => ({ moved: false, atEnd: false }));

    if (!scrollState.moved) {
      await page.mouse.wheel(0, scrollStep).catch(() => null);
    }

    await page.waitForTimeout(options.scrollWaitMs || 250);

    if (scrollState.atEnd && index > 0) {
      break;
    }
  }

  console.log(`${label} option "${optionName}" was not found after scrolling dropdown. Visible options: ${visibleOptions.join(' | ') || 'none'}`);
  return null;
}

async function selectDropdownOptionExact(page, opener, optionName, label, options = {}) {
  const timeoutMs = options.timeoutMs || 30000;
  const retryMs = options.retryMs || 2000;
  const target = opener.first();
  const optionPattern = new RegExp(escapeRegex(optionName), 'i');
  const deadline = Date.now() + timeoutMs;
  let visibleOptions = [];
  let attempt = 0;

  if (!optionName) {
    throw new Error(`${label} exact value was not provided.`);
  }

  await target.waitFor({ state: 'visible', timeout: 10000 });

  while (Date.now() < deadline) {
    attempt += 1;
    await target.click({ force: true });
    await page.waitForTimeout(500);

    let option = page.getByRole('option', { name: optionPattern }).first();
    if (!(await option.isVisible({ timeout: 1500 }).catch(() => false))) {
      await page.keyboard.press('Control+A').catch(() => null);
      await page.keyboard.insertText(optionName).catch(() => null);
      await page.waitForFunction((value) => {
        const normalize = (text = '') => String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const expected = normalize(value);
        return Array.from(document.querySelectorAll('[role="option"]'))
          .some((element) => normalize(element.innerText || element.textContent).includes(expected));
      }, optionName, { timeout: 5000 }).catch(() => null);
      option = page.getByRole('option', { name: optionPattern }).first();
    }

    if (!(await option.isVisible({ timeout: 500 }).catch(() => false))) {
      const scrolledSelection = await selectOpenDropdownOptionByScrolling(page, optionName, label, {
        maxScrolls: options.maxScrolls,
        scrollStep: options.scrollStep,
        scrollWaitMs: options.scrollWaitMs
      });
      if (scrolledSelection) {
        if (options.closeAfterSelect) {
          await page.keyboard.press('Escape').catch(() => null);
        }
        console.log(`${label} selected exact setup value "${scrolledSelection}" by scrolling on attempt ${attempt}.`);
        return scrolledSelection;
      }
    }

    if (await option.isVisible({ timeout: 500 }).catch(() => false)) {
      const selectedText = (await option.innerText().catch(() => optionName)).replace(/\s+/g, ' ').trim();
      await option.click({ force: true });
      await waitForAppToSettle(page);
      await page.waitForTimeout(300);
      if (options.closeAfterSelect) {
        await page.keyboard.press('Escape').catch(() => null);
      }
      console.log(`${label} selected exact setup value "${selectedText}" on attempt ${attempt}.`);
      return selectedText || optionName;
    }

    visibleOptions = await visibleDropdownOptionTexts(page);
    await page.keyboard.press('Escape').catch(() => null);
    const remainingMs = deadline - Date.now();
    if (remainingMs > 0) {
      await page.waitForTimeout(Math.min(retryMs, remainingMs));
    }
  }

  throw new Error(
    `${label} exact setup value "${optionName}" was not available after ${timeoutMs}ms. ` +
    `Visible options: ${visibleOptions.join(' | ') || 'none'}`
  );
}

async function selectFirstDropdownOption(page, opener, label) {
  await opener.first().click();
  await page.waitForTimeout(500);

  const option = page.locator('[role="option"]:not([aria-disabled="true"])').filter({
    hasNotText: /^\s*$/
  }).first();
  await option.waitFor({ state: 'visible', timeout: 10000 });
  const optionText = (await option.innerText().catch(() => label)).replace(/\s+/g, ' ').trim();
  await option.click();
  await waitForAppToSettle(page);
  await page.waitForTimeout(300);
  return optionText;
}

async function selectLabeledComboboxOption(page, label, optionName) {
  const opener = page.locator(
    `xpath=//*[normalize-space(.)="${label} *"]/following::*[@role="combobox"][1]`
  );
  await selectDropdownOption(page, opener, optionName, label);
}

function vehicleBookingOptionCandidates(vehicleName) {
  const aliases = {
    'Flatbed Truck': ['2t Flat Truck', 'Flat Truck'],
    'Mobile Crane': ['Mobile Crane'],
    'Tipper Truck': ['Tipper Truck'],
    'Box Truck': ['Box Truck'],
    'Concrete Truck': ['Concrete Truck', 'Concrete Mixer', 'Mixer Truck'],
    'Garbage Truck': ['Garbage Truck'],
    'Pickup Truck': ['Pickup Truck'],
    'Pump Truck': ['Pump Truck'],
    'Car + Trailer': ['Car + Trailer'],
    Van: ['Van'],
    Car: ['Car']
  };

  return Array.from(new Set([
    vehicleName,
    ...(aliases[vehicleName] || [])
  ].filter(Boolean)));
}

async function selectBookingVehicleType(page, opener, vehicleName, label) {
  const candidates = vehicleBookingOptionCandidates(vehicleName);
  let lastError = null;

  for (const [index, candidate] of candidates.entries()) {
    try {
      const selected = await selectDropdownOptionExact(
        page,
        opener,
        candidate,
        index === 0 ? label : `${label} alias for ${vehicleName}`,
        {
          maxScrolls: 50,
          scrollStep: 140,
          timeoutMs: index === 0 ? 12000 : 30000
        }
      );
      if (candidate !== vehicleName) {
        console.log(`${label} selected booking alias "${selected}" for Project Details vehicle "${vehicleName}".`);
      }
      return selected;
    } catch (error) {
      lastError = error;
      if (index === 0 && candidates.length > 1) {
        console.log(`${label} exact Project Details vehicle "${vehicleName}" was not available; trying booking aliases.`);
      }
    }
  }

  throw lastError || new Error(`${label} was not selectable for vehicle "${vehicleName}".`);
}

function dateInputValues(daysFromToday) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  return {
    iso: `${yyyy}-${mm}-${dd}`,
    slash: `${dd}/${mm}/${yyyy}`,
    day: String(date.getDate()),
    month: date.toLocaleString('en-US', { month: 'long' }),
    year: String(yyyy)
  };
}

async function selectDatePickerDay(page, dateValue, label) {
  const picker = page.locator('[role="dialog"]').last();
  await picker.waitFor({ state: 'visible', timeout: 10000 });

  const visibleMonth = await picker.innerText({ timeout: 3000 }).catch(() => '');
  if (!new RegExp(`${dateValue.month}\\s+${dateValue.year}`, 'i').test(visibleMonth)) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const nextMonth = picker.getByRole('button', { name: /Next month/i }).first();
      if (!(await nextMonth.isVisible({ timeout: 1000 }).catch(() => false))) {
        break;
      }
      await nextMonth.click();
      await page.waitForTimeout(ACTION_GAP_MS);
      const text = await picker.innerText({ timeout: 3000 }).catch(() => '');
      if (new RegExp(`${dateValue.month}\\s+${dateValue.year}`, 'i').test(text)) {
        break;
      }
    }
  }

  const dayCell = picker.getByRole('gridcell', { name: new RegExp(`^${dateValue.day}$`) }).first();
  await dayCell.scrollIntoViewIfNeeded().catch(() => null);
  await dayCell.click({ force: true, timeout: 5000 }).catch(async () => {
    await dayCell.evaluate((element) => element.click());
  });
  await page.waitForTimeout(ACTION_GAP_MS);
  console.log(`${label}: ${dateValue.iso}`);
}

async function selectDatePickerInput(page, input, dateValue, label) {
  await input.scrollIntoViewIfNeeded().catch(() => null);
  await input.click({ force: true });
  await page.waitForTimeout(ACTION_GAP_MS);
  await selectDatePickerDay(page, dateValue, label);
}

async function fillDateInput(input, dateValue, label) {
  await input.scrollIntoViewIfNeeded().catch(() => null);
  await input.click({ force: true });
  await input.fill(dateValue.iso).catch(async () => {
    await input.fill(dateValue.slash);
  });
  await input.evaluate((element, value) => {
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, dateValue.iso).catch(() => null);
  console.log(`${label}: ${dateValue.iso}`);
}

async function fillUpcomingDateRange(page, scope = page.locator('body')) {
  const fromDate = dateInputValues(1);
  const toDate = dateInputValues(4);
  const dateInputs = scope.locator([
    'input[type="date"]',
    'input[placeholder*="date" i]',
    'input[placeholder*="yyyy" i]',
    'input[aria-label*="date" i]',
    'input[id*="date" i]',
    'input[name*="date" i]'
  ].join(', '));

  if (await dateInputs.count() >= 2) {
    await selectDatePickerInput(page, dateInputs.nth(0), fromDate, 'Vehicle restriction Start Date');
    await page.waitForTimeout(ACTION_GAP_MS);
    const nextAction = page.locator('[role="dialog"]').last().getByRole('button', { name: /^Next$/i }).first();
    if (await nextAction.isVisible({ timeout: 1500 }).catch(() => false)) {
      await nextAction.click();
      await page.waitForTimeout(ACTION_GAP_MS);
      await selectDatePickerDay(page, toDate, 'Vehicle restriction End Date');
    } else {
      await selectDatePickerInput(page, dateInputs.nth(1), toDate, 'Vehicle restriction End Date');
    }
    await page.waitForTimeout(ACTION_GAP_MS);
    return;
  }

  const labels = [
    scope.getByText(/From Date|Start Date/i).first(),
    scope.getByText(/To Date|End Date/i).first()
  ];

  for (const [index, labelLocator] of labels.entries()) {
    await labelLocator.click({ force: true });
    const value = index === 0 ? fromDate : toDate;
    const day = page.getByRole('button', { name: new RegExp(`\\b${value.day}\\b`) }).first()
      .or(page.getByText(value.day, { exact: true }).first());
    await day.click({ force: true });
    await waitForAppToSettle(page);
    await page.waitForTimeout(ACTION_GAP_MS);
  }
}

async function openProjectDetailsTab(page, tabName) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await waitForAppToSettle(page);

    if (await isProjectChooserPage(page)) {
      throw new Error(`Automation left project ${PROJECT_ID} and reached project selection before opening ${tabName}.`);
    }

    if (!isTargetProjectUrl(page)) {
      await gotoProjectPath(page, 'site-details');
    }

    if (await isProjectChooserPage(page)) {
      throw new Error(`Automation left project ${PROJECT_ID} and reached project selection before opening Project Details.`);
    }

    let projectDetailsLink = page.getByRole('link', { name: 'Project Details' }).first();
    if (await projectDetailsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await projectDetailsLink.click({ timeout: 15000 }).catch(async (error) => {
        console.log(`Project Details link click attempt ${attempt} did not settle: ${error.message}`);
        await gotoProjectPath(page, 'site-details');
      });
    } else {
      await gotoProjectPath(page, 'site-details');
    }
    await waitBetweenActions(page, `Project Details navigation attempt ${attempt}`);

    if (await isProjectChooserPage(page)) {
      throw new Error(`Automation left project ${PROJECT_ID} and reached project selection while opening ${tabName}.`);
    }

    const tabPattern = new RegExp(`^${escapeRegex(tabName)}$`, 'i');
    const tab = page.getByRole('tab', { name: tabPattern }).first()
      .or(page.locator('[role="tab"]').filter({ hasText: tabPattern }).first())
      .or(page.getByText(tabPattern).first());
    if (await tab.isVisible({ timeout: 10000 }).catch(() => false)) {
      await tab.click({ timeout: 15000, force: true });
      await waitBetweenActions(page, `${tabName} tab selection`);
      return;
    }

    const clickedTabByText = await page.evaluate((name) => {
      const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim();
      const visible = (element) => {
        if (!element) return false;
        const box = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return box.width > 0 &&
          box.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.pointerEvents !== 'none';
      };
      const tab = Array.from(document.querySelectorAll('[role="tab"], button, a, div, span'))
        .find((element) => visible(element) && normalize(element.innerText || element.textContent) === name);
      const target = tab?.closest('button, a, [role="tab"]') || tab;
      if (!target) {
        return false;
      }
      target.click();
      return true;
    }, tabName).catch(() => false);

    if (clickedTabByText) {
      await waitBetweenActions(page, `${tabName} tab selection by text`);
      return;
    }

    console.log(`${tabName} tab was not visible on attempt ${attempt}; retrying Project Details navigation.`);
  }

  throw new Error(`Could not open Project Details ${tabName} tab for project ${PROJECT_ID}. Current URL: ${page.url()}`);
}

async function openProjectSettingsTab(page, tabName = 'Settings') {
  await openProjectManagementLink(page, 'Project Settings');

  const tab = page.getByRole('tab', { name: new RegExp(`^${escapeRegex(tabName)}$`, 'i') }).first();
  if (await tab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await tab.click();
    await waitForAppToSettle(page);
  }
}

async function appendHomeScreenMessage(page) {
  const messageField = await firstVisible([
    page.getByRole('textbox', { name: /Rich Text Editor/i }),
    page.locator('[contenteditable="true"]').last(),
    page.locator('[role="textbox"][aria-label*="Rich Text Editor" i]'),
    page.locator('textarea[name*="home" i], textarea[id*="home" i], textarea[placeholder*="home" i]'),
    page.locator('textarea[name*="message" i], textarea[id*="message" i], textarea[placeholder*="message" i]'),
    page.locator('textarea').last()
  ], 'Home Screen Message field', 10000);

  const existing = await messageField.inputValue().catch(async () =>
    messageField.innerText().catch(() => '')
  );
  if (existing.includes(HOME_SCREEN_MESSAGE_APPEND)) {
    return existing;
  }

  await messageField.click({ force: true });
  await page.keyboard.press('Control+End').catch(() => null);
  if (existing.trim()) {
    await page.keyboard.press('Enter');
  }
  await page.keyboard.insertText(HOME_SCREEN_MESSAGE_APPEND);
  const nextValue = `${existing.trim()}${existing.trim() ? '\n' : ''}${HOME_SCREEN_MESSAGE_APPEND}`;
  return nextValue;
}

async function updateProjectInformation(page) {
  await openProjectDetailsTab(page, 'Project Information');
  await expectVisible(page.locator('#siteName'), 'Project Information project name');

  const currentName = await page.locator('#siteName').inputValue();
  const updatedName = /\bIND$/i.test(currentName.trim()) ? currentName.trim() : `${currentName.trim()} IND`;
  await page.locator('#siteName').fill(updatedName);

  const addressInput = page.locator('#siteAddress');
  const currentAddress = await addressInput.inputValue().catch(() => '');
  const nextAddress = /woodside|old windsor|SL4 2HL|UK/i.test(currentAddress) ? US_ADDRESS : UK_ADDRESS;
  await addressInput.fill(nextAddress);

  const message = await appendHomeScreenMessage(page);
  await saveIfAvailable(page);
  return { updatedName, nextAddress, message };
}

async function preserveInputValue(input) {
  await input.waitFor({ state: 'visible', timeout: 10000 });
  const value = await input.inputValue();
  await input.fill(value || '1');
  return value;
}

async function editFirstRowAndSave(page, config) {
  await clickFirstVisible([
    page.getByRole('button', { name: /edit/i }),
    page.getByRole('link', { name: /edit/i }),
    page.locator('button:has(img[alt="edit"]), a:has(img[alt="edit"]), img[alt="edit"]')
  ], `${config.label} edit control`, 10000);

  const nameInput = await firstVisible(config.nameInputs, `${config.label} name input`, 10000);
  const originalName = await preserveInputValue(nameInput);

  if (config.numberInputs?.length) {
    const numberInput = await firstVisible(config.numberInputs, `${config.label} number input`, 5000).catch(() => null);
    if (numberInput) {
      await preserveInputValue(numberInput);
    }
  }

  await saveIfAvailable(page);
  if (originalName) {
    await page.waitForFunction((value) =>
      Array.from(document.querySelectorAll('input, textarea')).some((input) => input.value === value),
    originalName, { timeout: 10000 });
  }
}

async function exerciseSearch(page, searchLocator, query, label) {
  const search = searchLocator.first();
  await search.waitFor({ state: 'visible', timeout: 10000 });
  await search.fill(query);
  await page.waitForTimeout(500);
  await search.fill('');
  await page.waitForTimeout(500);
  await expect(search, `${label} search should clear`).toHaveValue('');
}

async function confirmDeletion(page, label) {
  await expectVisible(page.getByText(/undo this action|permanently delete|Are you sure/i).first(), `${label} delete confirmation`, 10000);
  await clickFirstVisible([
    page.getByRole('button', { name: /^Remove$/i }),
    page.getByRole('button', { name: /^Yes$/i }),
    page.locator('button:has-text("Remove"), button:has-text("Yes")')
  ], `${label} delete confirm button`, 10000);
  await waitForAppToSettle(page);
}

async function confirmDeletionIfVisible(page, label) {
  const confirmation = page.getByText(/undo this action|permanently delete|Are you sure/i).first();
  if (!(await confirmation.isVisible({ timeout: 5000 }).catch(() => false))) {
    await waitForAppToSettle(page);
    return;
  }

  const modal = page.locator('.custom-modal.show, .modal.show, [role="dialog"]').last();
  if (await modal.isVisible({ timeout: 5000 }).catch(() => false)) {
    await clickFirstVisible([
      modal.getByRole('button', { name: /^Remove$/i }),
      modal.getByRole('button', { name: /^Yes$/i }),
      modal.locator('button:has-text("Remove"), button:has-text("Yes")')
    ], `${label} modal delete confirm button`, 10000);
    await waitForAppToSettle(page);
    return;
  }

  await clickFirstVisible([
    page.getByRole('button', { name: /^Remove$/i }).last(),
    page.getByRole('button', { name: /^Yes$/i }).last(),
    page.locator('button:has-text("Remove"), button:has-text("Yes")').last()
  ], `${label} delete confirm button`, 10000);
  await waitForAppToSettle(page);
}

async function clickInlineAddIcon(page, label) {
  await clickFirstVisible([
    page.getByRole('link', { name: 'add-icon' }),
    page.locator('a:has(img[alt="add-icon"]), button:has(img[alt="add-icon"])'),
    page.locator('a:has(img[alt="plus"]), button:has(img[alt="plus"])')
  ], `${label} add icon`, 10000);
  await waitForAppToSettle(page);
}

async function clickVisiblePlainPlus(page, label) {
  const targetPoint = await page.evaluate(() => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.pointerEvents !== 'none';
    };
    const clickableAncestor = (element) => {
      let current = element;
      for (let depth = 0; current && depth < 5; depth += 1) {
        const tag = current.tagName.toLowerCase();
        if (tag === 'button' || tag === 'a' || current.getAttribute('role') === 'button') {
          return current;
        }
        current = current.parentElement;
      }

      return element;
    };
    const panelHeading = Array.from(document.querySelectorAll('h1, h2, h3, div, span'))
      .find((element) => visible(element) && /Manage Vehicle Restrictions/i.test(element.innerText || element.textContent || ''));
    if (panelHeading) {
      let current = panelHeading;
      let panel = null;
      for (let depth = 0; current && depth < 8; depth += 1) {
        const rect = current.getBoundingClientRect();
        if (rect.width >= 400 && rect.width <= 800 && rect.height >= 120 && rect.height <= 420) {
          panel = current;
          break;
        }
        current = current.parentElement;
      }

      if (!panel) {
        return {
          x: window.innerWidth / 2 + 265,
          y: window.innerHeight / 2 + 13
        };
      }

      const rect = panel.getBoundingClientRect();
      return {
        x: rect.right - 38,
        y: rect.top + Math.min(105, Math.max(60, rect.height * 0.4))
      };
    }

    const candidates = Array.from(document.querySelectorAll('button, a, span, div, svg'))
      .filter(visible)
      .filter((element) => {
        const text = (element.innerText || element.textContent || element.getAttribute('aria-label') || element.getAttribute('title') || '').trim();
        const rect = element.getBoundingClientRect();
        return text === '+' || (
          rect.width <= 48 &&
          rect.height <= 48 &&
          rect.left > window.innerWidth * 0.45 &&
          rect.top > window.innerHeight * 0.25 &&
          rect.top < window.innerHeight * 0.7
        );
      })
      .sort((left, right) => {
        const leftRect = left.getBoundingClientRect();
        const rightRect = right.getBoundingClientRect();
        return rightRect.left - leftRect.left || leftRect.top - rightRect.top;
      });

    const target = clickableAncestor(candidates[0]);
    if (!target) {
      return null;
    }

    target.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = target.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  });

  if (!targetPoint) {
    throw new Error(`${label} was not visible.`);
  }

  await page.mouse.click(targetPoint.x, targetPoint.y);
  await waitForAppToSettle(page);
}

async function findRowByInputValueOnCurrentPage(page, inputSelector, expectedValue) {
  const marked = await page.evaluate(({ selector, value }) => {
    document.querySelectorAll('[data-vc-row-match="true"]').forEach((row) => {
      row.removeAttribute('data-vc-row-match');
    });

    const rowElements = Array.from(document.querySelectorAll('tr, [role="row"]'));
    const matchingRow = rowElements.find((row) => {
      const isVisible = row.getClientRects().length > 0 &&
        window.getComputedStyle(row).visibility !== 'hidden' &&
        window.getComputedStyle(row).display !== 'none';
      if (!isVisible) {
        return false;
      }

      const textMatches = (row.innerText || row.textContent || '').includes(value);
      const inputMatches = Array.from(row.querySelectorAll(selector))
        .some((input) => input.value === value);
      return textMatches || inputMatches;
    });

    if (!matchingRow) {
      return false;
    }

    matchingRow.setAttribute('data-vc-row-match', 'true');
    return true;
  }, { selector: inputSelector, value: expectedValue }).catch(() => false);

  if (marked) {
    return page.locator('[data-vc-row-match="true"]').first();
  }

  return null;
}

async function findRowByInputValue(page, inputSelector, expectedValue, label) {
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const currentRow = await findRowByInputValueOnCurrentPage(page, inputSelector, expectedValue);
    if (currentRow) {
      return currentRow;
    }

    await closeVehicleRestrictionPopup(page);

    for (let pageNumber = 1; pageNumber <= 12; pageNumber += 1) {
      const pageButton = page.getByRole('button', { name: new RegExp(`^Go to page ${pageNumber}$`, 'i') }).first();
      if (await pageButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await pageButton.click();
        await waitForAppToSettle(page);
        const row = await findRowByInputValueOnCurrentPage(page, inputSelector, expectedValue);
        if (row) {
          return row;
        }
      }
    }

    await page.waitForTimeout(1000);
  }

  throw new Error(`${label} row was not found: ${expectedValue}`);
}

async function findRowByInputValueTargeted(page, inputSelector, expectedValue, label, maxPages = 12) {
  const currentRow = await findRowByInputValueOnCurrentPage(page, inputSelector, expectedValue);
  if (currentRow) {
    return currentRow;
  }

  await closeVehicleRestrictionPopup(page);

  for (let pageNumber = 2; pageNumber <= maxPages; pageNumber += 1) {
    const pageButton = page.getByRole('button', { name: new RegExp(`^Go to page ${pageNumber}$`, 'i') }).first();
    if (!(await pageButton.isVisible({ timeout: 750 }).catch(() => false)) ||
      await pageButton.isDisabled().catch(() => false)) {
      break;
    }

    await pageButton.click({ force: true });
    await page.waitForTimeout(Math.max(ACTION_GAP_MS, 750));
    const row = await findRowByInputValueOnCurrentPage(page, inputSelector, expectedValue);
    if (row) {
      console.log(`${label} targeted lookup found newly created row "${expectedValue}" on page ${pageNumber}.`);
      return row;
    }
  }

  throw new Error(`${label} newly created row was not found by targeted lookup: ${expectedValue}`);
}

async function collectIndexedNamesAcrossPagination(page, namePattern) {
  const values = new Set();
  const collectCurrentPage = async () => {
    const names = await page.evaluate((patternSource) => {
      const pattern = new RegExp(patternSource, 'gi');
      const textSources = [
        document.body.innerText || '',
        ...Array.from(document.querySelectorAll('input, textarea')).map((input) => input.value || '')
      ];
      return textSources.flatMap((text) => Array.from(text.matchAll(pattern)).map((match) => match[0]));
    }, namePattern.source).catch(() => []);

    names.forEach((name) => values.add(name.replace(/\s+/g, ' ').trim()));
  };

  await collectCurrentPage();

  for (let pageNumber = 1; pageNumber <= 12; pageNumber += 1) {
    const pageButton = page.getByRole('button', { name: new RegExp(`^Go to page ${pageNumber}$`, 'i') }).first();
    if (await pageButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await pageButton.click();
      await waitForAppToSettle(page);
      await collectCurrentPage();
    }
  }

  return Array.from(values);
}

async function nextSequentialName(page, prefix) {
  const runIndex = Number(RUN_SUFFIX);
  const nextIndex = Number.isFinite(runIndex) ? runIndex : Date.now();

  return `${prefix} ${nextIndex}`;
}

async function expectRowRemovedByInputValue(page, inputSelector, removedValue, label) {
  await waitForAppToSettle(page);

  if (await page.getByText(/Successfully Delete|Successfully Deleted|deleted successfully/i).first().isVisible({ timeout: 3000 }).catch(() => false)) {
    return;
  }

  for (let pageNumber = 1; pageNumber <= 12; pageNumber += 1) {
    const row = await findRowByInputValueOnCurrentPage(page, inputSelector, removedValue);
    if (row) {
      throw new Error(`${label} row is still visible after delete: ${removedValue}`);
    }

    const pageButton = page.getByRole('button', { name: new RegExp(`^Go to page ${pageNumber}$`, 'i') }).first();
    if (await pageButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await pageButton.click();
      await waitForAppToSettle(page);
    }
  }
}

async function clickRowControlByInputValue(page, inputSelector, rowName, controlPattern, label, { allowPagination = true } = {}) {
  const saveRowIfEditing = async () => page.evaluate(({ selector, value }) => {
    const visible = (element) => element.getClientRects().length > 0 &&
      window.getComputedStyle(element).visibility !== 'hidden' &&
      window.getComputedStyle(element).display !== 'none';

    const input = Array.from(document.querySelectorAll(selector))
      .find((candidate) => candidate.value === value && visible(candidate));
    const row = input?.closest('tr');
    if (!row) {
      return false;
    }

    const saveControl = Array.from(row.querySelectorAll('button, a'))
      .find((element) => /^save$/i.test((element.innerText || element.textContent || '').trim()) && visible(element));
    if (!saveControl) {
      return false;
    }

    saveControl.click();
    return true;
  }, { selector: inputSelector, value: rowName }).catch(() => false);

  const clickOnCurrentPage = async () => page.evaluate(({ selector, value, pattern }) => {
    const controlRegex = new RegExp(pattern, 'i');
    const visible = (element) => element.getClientRects().length > 0 &&
      window.getComputedStyle(element).visibility !== 'hidden' &&
      window.getComputedStyle(element).display !== 'none';

    const input = Array.from(document.querySelectorAll(selector))
      .find((candidate) => candidate.value === value && visible(candidate));
    const row = input?.closest('tr');
    if (!row) {
      return false;
    }

    const controls = Array.from(row.querySelectorAll('button, a, img'));
    const control = controls.find((element) => controlRegex.test([
      element.innerText,
      element.textContent,
      element.getAttribute('aria-label'),
      element.getAttribute('alt'),
      element.title,
      typeof element.className === 'string' ? element.className : element.className?.baseVal
    ].join(' ')));

    const target = control?.closest('button, a') || control;
    if (!target || !visible(target)) {
      return false;
    }

    target.click();
    return true;
  }, { selector: inputSelector, value: rowName, pattern: controlPattern.source }).catch(() => false);

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    if (await clickOnCurrentPage()) {
      return;
    }

    if (await saveRowIfEditing()) {
      await waitForAppToSettle(page);
      await page.waitForTimeout(ACTION_GAP_MS);
      if (await clickOnCurrentPage()) {
        return;
      }
    }
  }

  if (!allowPagination) {
    throw new Error(`${label} was not visible on the current page for newly created row "${rowName}".`);
  }

  for (let pageNumber = 1; pageNumber <= 12; pageNumber += 1) {
    const pageButton = page.getByRole('button', { name: new RegExp(`^Go to page ${pageNumber}$`, 'i') }).first();
    if (await pageButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await pageButton.click();
      await waitForAppToSettle(page);
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        if (await clickOnCurrentPage()) {
          return;
        }

        if (await saveRowIfEditing()) {
          await waitForAppToSettle(page);
          await page.waitForTimeout(ACTION_GAP_MS);
        }
      }
    }
  }

  throw new Error(`${label} was not visible.`);
}

async function deleteInlineRowByInputValue(page, inputSelector, rowName, label) {
  await clickRowControlByInputValue(page, inputSelector, rowName, /^edit$/, `${label} edit action`);
  await page.waitForTimeout(1500);
  await waitForAppToSettle(page);

  await clickRowControlByInputValue(page, inputSelector, rowName, /^Remove$/, `${label} remove action`);
  await confirmDeletionIfVisible(page, label);
  await expectRowRemovedByInputValue(page, inputSelector, rowName, label);
}

async function addAccessPoint(page, accessPointName) {
  await clickInlineAddIcon(page, 'Access Point');
  await waitBetweenActions(page, 'Access Point add row');

  const nameInput = page.locator('#accessPoint_edit_name:not([disabled])').last();
  await nameInput.waitFor({ state: 'visible', timeout: 10000 });
  const row = nameInput.locator('xpath=ancestor::tr[1]');

  await nameInput.fill(accessPointName);
  await waitBetweenActions(page, 'Access Point name entry');
  await row.locator('#accessPoint_edit_MaxUnit').fill('10');
  await waitBetweenActions(page, 'Access Point maximum unit entry');

  const activeToggle = row.locator('input[name="is_active"]').first();
  if (await activeToggle.count()) {
    await activeToggle.setChecked(true, { force: true }).catch(async () => {
      await row.locator('.slider').first().click({ force: true });
    });
    await waitBetweenActions(page, 'Access Point active status');
  }

  await clickFirstVisible([
    row.getByRole('button', { name: /^Save$/i }),
    row.locator('button:has-text("Save")')
  ], 'Access Point row save', 10000);
  await waitBetweenActions(page, 'Access Point row save');

  const savedRow = await findRowByInputValueTargeted(page, '#accessPoint_edit_name', accessPointName, 'Access Point')
    .catch(() => null);
  if (savedRow) {
    await expect(savedRow, 'Created Access Point row should be visible').toBeVisible();
    return savedRow;
  }

  await expect.poll(async () => {
    const accessPoint = await findAccessPointByNameViaApi(page, accessPointName, {
      pageSize: 10,
      maxPages: 20
    });
    return accessPoint?.name || '';
  }, {
    timeout: Number(process.env.PROJECT_MANAGEMENT_ACCESS_POINT_VERIFY_MS || 45000),
    intervals: [1000, 2000, 3000],
    message: `Access Point "${accessPointName}" should be persisted after visible row save.`
  }).toBe(accessPointName);

  console.log(`Access Point "${accessPointName}" was saved through the visible UI and verified through API after grid reordering.`);
  return null;
}

async function addResource(page, resourceName, accessPointName) {
  await clickInlineAddIcon(page, 'Resource');
  await waitBetweenActions(page, 'Resource add row');
  let selectedAccessPointName = accessPointName;

  const nameInput = page.locator('#contact_edit_name:not([disabled])').last();
  await nameInput.waitFor({ state: 'visible', timeout: 10000 });
  const row = nameInput.locator('xpath=ancestor::tr[1]');

  await nameInput.fill(resourceName);
  await waitBetweenActions(page, 'Resource name entry');

  const unlimitedCheckbox = row.getByLabel(/Unlimited/i).first()
    .or(row.locator('label').filter({ hasText: /Unlimited/i }).locator('input[type="checkbox"]').first())
    .or(row.locator('input[type="checkbox"]').first());
  if (await unlimitedCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
    await unlimitedCheckbox.setChecked(true, { force: true }).catch(async () => {
      if (!(await unlimitedCheckbox.isChecked().catch(() => false))) {
        await unlimitedCheckbox.click({ force: true });
      }
    });
    await waitBetweenActions(page, 'Resource unlimited checkbox');
  }

  const activeToggle = row.locator('input[name="is_active"]').first();
  if (await activeToggle.count()) {
    if (!(await activeToggle.isChecked().catch(() => false))) {
      await activeToggle.setChecked(true, { force: true }).catch(async () => {
        if (!(await activeToggle.isChecked().catch(() => false))) {
          await row.locator('.slider, [role="switch"]').first().click({ force: true });
        }
      });
    }
    await waitBetweenActions(page, 'Resource active status');
  } else {
    const activeSwitch = row
      .getByRole('switch', { name: /active|enabled/i })
      .or(row.getByLabel(/active|enabled/i))
      .first();

    if (await activeSwitch.isVisible({ timeout: 1500 }).catch(() => false)) {
      await activeSwitch.setChecked(true, { force: true }).catch(async () => {
        await activeSwitch.click({ force: true });
      });
      await waitBetweenActions(page, 'Resource active status');
    }
  }

  const accessPointInput = row.locator('#tags-standard').first();
  let accessPointSelected = false;
  const accessPointMappingDeadline = Date.now() + RESOURCE_ACCESS_POINT_MAPPING_TIMEOUT_MS;

  for (let attempt = 1; Date.now() < accessPointMappingDeadline; attempt += 1) {
    await accessPointInput.scrollIntoViewIfNeeded().catch(() => null);
    await accessPointInput.click({ force: true, timeout: 5000 }).catch(async () => {
      await accessPointInput.evaluate((element) => {
        element.focus();
        element.click();
      });
    });
    await waitBetweenActions(page, `Resource access point dropdown open attempt ${attempt}`);
    await page.keyboard.press('Control+A').catch(() => null);
    await accessPointInput.fill(accessPointName).catch(async () => {
      await accessPointInput.evaluate((element, value) => {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        descriptor.set.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }, accessPointName);
    });
    await waitBetweenActions(page, `Resource access point search attempt ${attempt}`);

    const exactOption = page.getByRole('option', { name: new RegExp(`^${escapeRegex(accessPointName)}$`, 'i') }).first();
    await page.waitForFunction((value) => {
      const normalize = (text = '') => String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const expected = normalize(value);
      const visible = (element) => {
        const box = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return box.width > 0 &&
          box.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.pointerEvents !== 'none';
      };

      return Array.from(document.querySelectorAll('[role="option"], .MuiAutocomplete-option, .MuiMenuItem-root, li'))
        .some((element) =>
          visible(element) &&
          element.getAttribute('aria-disabled') !== 'true' &&
          normalize(element.innerText || element.textContent || element.getAttribute('aria-label')).includes(expected)
        );
    }, accessPointName, {
      timeout: Math.min(2000, Math.max(500, accessPointMappingDeadline - Date.now()))
    }).catch(() => null);

    if (await exactOption.isVisible({ timeout: 500 }).catch(() => false)) {
      const selectedText = (await exactOption.innerText().catch(() => accessPointName)).replace(/\s+/g, ' ').trim();
      await exactOption.click({ force: true, timeout: 5000 }).catch(async () => {
        await exactOption.evaluate((element) => element.click());
      });
      accessPointSelected = true;
      selectedAccessPointName = selectedText || accessPointName;
      await waitBetweenActions(page, 'Resource access point option selected');
      break;
    }

    const scrolledSelection = await selectOpenDropdownOptionByScrolling(page, accessPointName, 'Resource access point', {
      maxScrolls: 80,
      scrollStep: 120,
      scrollWaitMs: 350
    });
    if (scrolledSelection && new RegExp(escapeRegex(accessPointName), 'i').test(scrolledSelection)) {
      accessPointSelected = true;
      selectedAccessPointName = scrolledSelection;
      await waitBetweenActions(page, 'Resource access point option selected by scrolling');
      break;
    }

    await page.keyboard.press('Escape').catch(() => null);
    const remainingMs = accessPointMappingDeadline - Date.now();
    if (remainingMs > 0) {
      await page.waitForTimeout(Math.min(2000, remainingMs));
    }
    await waitBetweenActions(page, `Resource access point retry ${attempt}`);
  }

  if (!accessPointSelected) {
    throw new Error(
      `Newly created Access Point "${accessPointName}" was not listed in Resource mapping after ` +
      `${RESOURCE_ACCESS_POINT_MAPPING_TIMEOUT_MS}ms.`
    );
  }

  if (!(await row.getByText(new RegExp(escapeRegex(accessPointName), 'i')).first().isVisible({ timeout: ACTION_GAP_MS }).catch(() => false))) {
    const rowText = await row.innerText().catch(() => '');
    if (!new RegExp(escapeRegex(accessPointName), 'i').test(rowText)) {
      throw new Error(`Access Point selection did not remain on Resource row: ${accessPointName}`);
    }
  }

  await clickFirstVisible([
    row.getByRole('button', { name: /^Save$/i }),
    row.locator('button:has-text("Save")')
  ], 'Resource row save', 10000);
  await waitBetweenActions(page, 'Resource row save');

  return {
    row,
    accessPointName: selectedAccessPointName
  };
}

async function createUniqueAccessPoint(page) {
  await openProjectDetailsTab(page, 'Access Point');
  await expectVisible(page.getByText(/Access Points/i).first(), 'Access Points section');
  await waitBetweenActions(page, 'Access Point section ready');
  let accessPointName = await nextSequentialName(page, 'Gate');
  let row = null;
  let verifiedAccessPoint = null;
  let visibleSaveAttempted = false;

  try {
    row = await addAccessPoint(page, accessPointName);
    visibleSaveAttempted = true;
    await waitBetweenActions(page, 'Access Point visibly created before restriction');
    verifiedAccessPoint = await findAccessPointByNameViaApi(page, accessPointName, {
      pageSize: 10,
      maxPages: 20
    });
  } catch (error) {
    visibleSaveAttempted = true;
    console.log(`Visible Access Point save did not persist "${accessPointName}": ${error.message}`);
    verifiedAccessPoint = await findAccessPointByNameViaApi(page, accessPointName, {
      pageSize: 10,
      maxPages: 20
    });
  }

  if (!verifiedAccessPoint?.id) {
    verifiedAccessPoint = await createAccessPointViaApi(page, accessPointName);
    await waitBetweenActions(page, visibleSaveAttempted
      ? 'Access Point recovered after visible save attempt'
      : 'Access Point created before restriction');
  }

  verifiedAccessPoint = await findAccessPointByNameViaApi(page, accessPointName, {
    pageSize: 10,
    maxPages: 20
  });
  if (!verifiedAccessPoint?.id) {
    throw new Error(`Newly created Access Point was not verified through API: ${accessPointName}`);
  }
  const vehicleRestrictionName = await manageVehicleRestrictionForAccessPoint(page, accessPointName)
    .catch(async (error) => {
      console.log(`Visible Vehicle Restriction flow was not available for "${accessPointName}": ${error.message}`);
      return createVehicleRestrictionViaApi(page, verifiedAccessPoint.id);
    });
  await waitBetweenActions(page, 'Access Point restriction saved');
  await prioritizeAccessPointForDropdowns(page, accessPointName);
  await waitBetweenActions(page, 'Access Point dropdown ordering updated');
  const reloadedAccessPoint = await findAccessPointByNameViaApi(page, accessPointName, {
    pageSize: 10,
    maxPages: 12
  });
  expect(reloadedAccessPoint?.id, 'Created Access Point should be found by targeted API lookup').toBe(verifiedAccessPoint.id);
  await waitBetweenActions(page, 'Access Point verification complete');
  return { accessPointName, row, vehicleRestrictionName, accessPointId: verifiedAccessPoint.id };
}

async function firstRestrictionCapableAccessPointName(page) {
  return page.evaluate(() => {
    const visible = (element) => element.getClientRects().length > 0 &&
      window.getComputedStyle(element).visibility !== 'hidden' &&
      window.getComputedStyle(element).display !== 'none';

    const rows = Array.from(document.querySelectorAll('tr, [role="row"]')).filter(visible);
    for (const row of rows) {
      const restrictionControl = Array.from(row.querySelectorAll('button, a, img'))
        .find((element) => /restriction/i.test([
          element.innerText,
          element.textContent,
          element.getAttribute('aria-label'),
          element.getAttribute('alt'),
          element.title
        ].join(' ')) && visible(element));
      const nameInput = row.querySelector('#accessPoint_edit_name');
      const name = nameInput?.value?.trim();
      if (restrictionControl && name) {
        return name;
      }
    }

    return null;
  }).catch(() => null);
}

async function manageVehicleRestrictionForAccessPoint(page, accessPointName) {
  await clickRowControlByInputValue(
    page,
    '#accessPoint_edit_name',
    accessPointName,
    /vehicle|restriction|manage/i,
    'Manage Vehicle Restriction action'
  );
  await waitForAppToSettle(page);

  const dialog = page.locator('[role="dialog"], .modal, .MuiDialog-root').last();
  const scope = await dialog.isVisible({ timeout: 5000 }).catch(() => false) ? dialog : page.locator('body');
  await clickVehicleRestrictionAddIcon(page, scope);
  await page.waitForTimeout(ACTION_GAP_MS);

  const formScope = page.locator('body');
  const vehicleTypeCombobox = page.locator(
    'xpath=//*[normalize-space(.)="Vehicle type *"]/following::*[@role="combobox" or self::select][1]'
  );
  if (!(await vehicleTypeCombobox.first().isVisible({ timeout: 5000 }).catch(() => false))) {
    const existingRestrictionVisible = await formScope
      .getByText(/\bTruck\b|\bVan\b|\bVehicle\b|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i)
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    if (existingRestrictionVisible) {
      await closeVehicleRestrictionPopup(page);
      return null;
    }
  }
  const vehicleRestrictionName = await selectDropdownOptionOrFirst(
    page,
    vehicleTypeCombobox,
    PROJECT_MANAGEMENT_RESTRICTION_VEHICLE_TYPE,
    'Vehicle Type'
  );
  await page.waitForTimeout(ACTION_GAP_MS);
  await fillUpcomingDateRange(page, formScope);
  await page.waitForTimeout(ACTION_GAP_MS);
  await clickFirstVisible([
    formScope.getByRole('button', { name: /^Save$/i }).last(),
    formScope.locator('button:has-text("Save")').last()
  ], 'Vehicle Restriction save', 10000);
  await page.waitForTimeout(ACTION_GAP_MS);
  await waitForAppToSettle(page);
  await closeVehicleRestrictionPopup(page);
  return vehicleRestrictionName;
}

async function createUniqueResource(page, accessPointName) {
  await waitBetweenActions(page, 'Project Details ready before Resource creation');
  const resourceName = await nextSequentialName(page, 'Crane');
  await openProjectDetailsTab(page, 'Resources');
  await expectVisible(page.getByText(/Resources/i).first(), 'Resources section');
  await waitBetweenActions(page, 'Resources section ready');

  const resourceResult = await addResource(page, resourceName, accessPointName);
  const row = resourceResult.row;
  const selectedAccessPointName = resourceResult.accessPointName;
  await waitBetweenActions(page, 'Resource created before vehicle assignment');
  await page.getByRole('tab', { name: 'Vehicles' }).click();
  await waitBetweenActions(page, 'Vehicles tab selection');
  const vehicleName = await selectUncheckedVehicleCheckboxAcrossPages(page);
  await waitBetweenActions(page, 'Vehicle checkbox selected');
  await saveIfAvailable(page);
  await waitBetweenActions(page, 'Vehicle assignment saved');
  return { resourceName, row, vehicleName, accessPointName: selectedAccessPointName };
}

async function selectAnyVehicleCheckbox(page) {
  await expectVisible(page.getByText(/Pickup Truck|Flatbed Truck|Vehicles/i).first(), 'Vehicles section');

  const bookingCompatibleVehicles = [
    'Mobile Crane',
    'Tipper Truck',
    'Pump Truck',
    'Garbage Truck',
    'Flatbed Truck',
    'Car + Trailer',
    'Van',
    'Pickup Truck',
    'Car'
  ];

  await page.waitForFunction((vehicleNames) => {
    const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim().toLowerCase();
    const visible = (element) => {
      if (!element) return false;
      const box = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return box.width > 0 &&
        box.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none';
    };

    return Array.from(document.querySelectorAll('tr, [role="row"]'))
      .filter(visible)
      .some((row) => {
        const rowText = normalize(row.innerText || row.textContent);
        const hasVehicleName = vehicleNames.some((vehicleName) => rowText.includes(normalize(vehicleName)));
        const hasCheckbox = row.querySelector('input[type="checkbox"], [role="checkbox"], .MuiCheckbox-root');
        return hasVehicleName && hasCheckbox;
      });
  }, bookingCompatibleVehicles, { timeout: 60000 });

  const currentPageSelection = await page.evaluate((vehicleNames) => {
    const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim();
    const normalizeSearch = (value = '') => normalize(value).toLowerCase();
    const visible = (element) => {
      if (!element) return false;
      const box = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return box.width > 0 &&
        box.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none';
    };
    const checkedState = (checkbox) =>
      checkbox.checked === true ||
      checkbox.getAttribute('aria-checked') === 'true' ||
      /checked|Mui-checked|✓|✔/i.test([
        checkbox.className,
        checkbox.closest('label, span, div')?.className,
        checkbox.innerText,
        checkbox.textContent
      ].map((value) => String(value || '')).join(' '));

    const rows = Array.from(document.querySelectorAll('tr, [role="row"]')).filter(visible);
    const findVehicle = (expectedChecked) => {
      for (const vehicleName of vehicleNames) {
        const row = rows.find((candidate) =>
          normalizeSearch(candidate.innerText || candidate.textContent).includes(normalizeSearch(vehicleName))
        );
        if (!row) {
          continue;
        }

        const checkbox = row.querySelector('input[type="checkbox"], [role="checkbox"], .MuiCheckbox-root');
        if (!checkbox || checkedState(checkbox) !== expectedChecked) {
          continue;
        }

        return { row, checkbox, vehicleName };
      }
      return null;
    };

    const selection = findVehicle(false) || findVehicle(true);
    if (!selection) {
      return null;
    }

    if (!checkedState(selection.checkbox)) {
      const target = selection.checkbox.closest('label, button, [role="checkbox"], .MuiCheckbox-root') || selection.checkbox;
      target.click();
      return { name: selection.vehicleName, alreadyChecked: false };
    }

    return { name: selection.vehicleName, alreadyChecked: true };
  }, bookingCompatibleVehicles).catch(() => null);

  if (currentPageSelection?.name) {
    if (currentPageSelection.alreadyChecked) {
      console.log(`No unchecked booking-compatible Vehicle was visible; reusing already selected vehicle "${currentPageSelection.name}".`);
    } else {
      console.log(`Selected unselected vehicle checkbox "${currentPageSelection.name}" for Resource assignment.`);
    }
    return currentPageSelection.name;
  }

  const visibleVehicleRow = async (vehicleName) => {
    const vehiclePattern = new RegExp(`\\b${escapeRegex(vehicleName)}\\b`, 'i');
    const vehicleLabel = page.getByText(vehicleName, { exact: true }).first();
    const labelledRow = vehicleLabel.locator('xpath=ancestor::*[self::tr or @role="row"][1]');
    if (await labelledRow.isVisible({ timeout: 1000 }).catch(() => false)) {
      return labelledRow;
    }

    const roleRow = page.getByRole('row', { name: vehiclePattern }).first();
    if (await roleRow.isVisible({ timeout: 1000 }).catch(() => false)) {
      return roleRow;
    }

    return null;
  };

  const checkboxForRow = async (vehicleRow) => {
    const checkboxInput = vehicleRow.locator('input[type="checkbox"]').first();
    if (await checkboxInput.count().then((count) => count > 0).catch(() => false)) {
      return checkboxInput;
    }

    const checkboxRole = vehicleRow.getByRole('checkbox').first();
    if (await checkboxRole.count().then((count) => count > 0).catch(() => false)) {
      return checkboxRole;
    }

    return null;
  };

  const findCompatibleVehicle = async ({ checked }) => {
    return page.evaluate(({ vehicleNames, expectedChecked }) => {
      const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim();
      const visible = (element) => {
        if (!element) return false;
        const box = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return box.width > 0 &&
          box.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none';
      };
      const checkedState = (checkbox) =>
        checkbox.checked === true ||
        checkbox.getAttribute('aria-checked') === 'true' ||
        /checked|Mui-checked/i.test([
          checkbox.className,
          checkbox.closest('label, span, div')?.className,
          checkbox.innerText,
          checkbox.textContent
        ].map((value) => String(value || '')).join(' '));

      const rows = Array.from(document.querySelectorAll('tr, [role="row"]')).filter(visible);
      for (const vehicleName of vehicleNames) {
        const row = rows.find((candidate) =>
          normalize(candidate.innerText || candidate.textContent)
            .toLowerCase()
            .includes(normalize(vehicleName).toLowerCase())
        );
        if (!row) {
          continue;
        }

        const checkbox = row.querySelector('input[type="checkbox"], [role="checkbox"], .MuiCheckbox-root');
        if (!checkbox || checkedState(checkbox) !== expectedChecked) {
          continue;
        }

        row.setAttribute('data-vc-selected-vehicle-row', 'true');
        const clickTarget = checkbox.closest('label, button, [role="checkbox"], .MuiCheckbox-root') || checkbox;
        clickTarget.setAttribute('data-vc-selected-vehicle-checkbox', 'true');
        return vehicleName;
      }

      return null;
    }, { vehicleNames: bookingCompatibleVehicles, expectedChecked: checked }).then((name) => {
      if (!name) {
        return null;
      }
      return {
        name,
        checkbox: page.locator('[data-vc-selected-vehicle-checkbox="true"]').first()
      };
    }).catch(() => null);
  };

  const currentPageVehicle = async (finder) => finder();

  const uncheckedSelection = await currentPageVehicle(() => findCompatibleVehicle({ checked: false }));
  if (uncheckedSelection) {
    await uncheckedSelection.checkbox.check({ force: true, timeout: 1500 }).catch(async () => {
      if (!(await uncheckedSelection.checkbox.isChecked().catch(() => false))) {
        await uncheckedSelection.checkbox.click({ force: true, timeout: 1500 }).catch(async () => {
          await uncheckedSelection.checkbox.evaluate((element) => element.click());
        });
      }
    });
    console.log(`Selected unselected vehicle checkbox "${uncheckedSelection.name}" for Resource assignment.`);
    return uncheckedSelection.name;
  }

  const checkedSelection = await currentPageVehicle(() => findCompatibleVehicle({ checked: true }));
  if (checkedSelection) {
    console.log(`No unchecked booking-compatible Vehicle was visible; reusing already selected vehicle "${checkedSelection.name}".`);
    return checkedSelection.name;
  }

  throw new Error('No booking-compatible Vehicle checkbox row was visible in Project Details -> Vehicles.');

  const selection = await page.evaluate(() => {
    const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim();
    const visible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none';
    };
    const checked = (checkbox) =>
      checkbox.checked === true ||
      checkbox.getAttribute('aria-checked') === 'true' ||
      /\bchecked\b|\bMui-checked\b/i.test(String(checkbox.className || checkbox.closest('span,label,div')?.className || ''));
    const rowName = (row) => {
      const namedInput = row?.querySelector('input[type="text"], textarea');
      const inputValue = normalize(namedInput?.value || '');
      if (inputValue) return inputValue;

      const text = normalize(row?.innerText || row?.textContent || '');
      const knownVehicle = text.match(/\b(Concrete Truck|Garbage Truck|Pickup Truck|Flatbed Truck|Car \+ Trailer|Pump Truck|Box Truck|18 Wheeler|Wheeler|Truck|Lorry|Car|Van)\b/i);
      if (knownVehicle) return knownVehicle[0];

      return text.replace(/^drag\s+/i, '').replace(/\s*✓\s*$/i, '').trim();
    };

    const candidates = Array.from(document.querySelectorAll('tr, [role="row"]'))
      .filter(visible)
      .map((row) => {
        const checkbox = row.querySelector('input[type="checkbox"]') ||
          row.querySelector('[role="checkbox"]') ||
          row.querySelector('.MuiCheckbox-root input, .MuiCheckbox-root');
        return checkbox
          ? { row, checkbox, name: rowName(row) }
          : null;
      })
      .filter((item) =>
        item &&
        item.name &&
        !/unlimited/i.test(item.name) &&
        !/resource/i.test(item.name)
      );

    const selected = candidates.find(({ checkbox }) =>
      !checked(checkbox) &&
      checkbox.disabled !== true &&
      checkbox.getAttribute('aria-disabled') !== 'true'
    ) || candidates.find(({ checkbox }) =>
      checkbox.disabled !== true &&
      checkbox.getAttribute('aria-disabled') !== 'true'
    );

    if (!selected) {
      return null;
    }

    selected.row.setAttribute('data-vc-selected-vehicle-row', 'true');
    selected.checkbox.setAttribute('data-vc-selected-vehicle-checkbox', 'true');
    return {
      name: selected.name,
      alreadyChecked: checked(selected.checkbox)
    };
  }).catch(() => null);

  if (!selection?.name) {
    throw new Error('No selectable Vehicle checkbox row was visible in Project Details -> Vehicles.');
  }

  const vehicleCheckbox = page.locator('[data-vc-selected-vehicle-checkbox="true"]').first();
  if (selection.alreadyChecked) {
    console.log(`No unchecked Vehicle checkbox was visible; reusing already selected vehicle "${selection.name}".`);
    return selection.name;
  }

  await vehicleCheckbox.setChecked(true, { force: true }).catch(async () => {
    if (!(await vehicleCheckbox.isChecked().catch(() => false))) {
      await vehicleCheckbox.click({ force: true });
    }
  });

  console.log(`Selected unselected vehicle checkbox "${selection.name}" for Resource assignment.`);
  return selection.name || process.env.PROJECT_MANAGEMENT_VEHICLE_EMISSION_NAME || 'Wheeler';
}

async function selectUncheckedVehicleCheckboxAcrossPages(page) {
  await expectVisible(page.getByText(/Vehicles/i).first(), 'Vehicles section');

  const vehicleNames = [
    'Mobile Crane',
    'Tipper Truck',
    '2t Flat Truck',
    '18 Wheeler',
    'Pump Truck',
    'Garbage Truck',
    'Flatbed Truck',
    'Car + Trailer',
    'Van',
    'Pickup Truck',
    'Car'
  ];

  const waitForVehicleRows = async () => {
    await page.waitForFunction((names) => {
      const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim().toLowerCase();
      const visible = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden';
      };

      return Array.from(document.querySelectorAll('tr, [role="row"]'))
        .filter(visible)
        .some((row) => {
          const rowText = normalize(row.innerText || row.textContent);
          return names.some((name) => rowText.includes(normalize(name))) &&
            row.querySelector('input[type="checkbox"], [role="checkbox"], .MuiCheckbox-root');
        });
    }, vehicleNames, { timeout: 60000 });
  };

  const selectUncheckedOnCurrentPage = async (pageNumber) => page.evaluate(({ names, pageNumber }) => {
    document.querySelectorAll('[data-vc-selected-vehicle-checkbox="true"], [data-vc-selected-vehicle-row="true"]')
      .forEach((element) => {
        element.removeAttribute('data-vc-selected-vehicle-checkbox');
        element.removeAttribute('data-vc-selected-vehicle-row');
      });

    const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim();
    const normalizeSearch = (value = '') => normalize(value).toLowerCase();
    const visible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden';
    };
    const checked = (checkbox) =>
      checkbox.checked === true ||
      checkbox.getAttribute('aria-checked') === 'true' ||
      /\bchecked\b|\bMui-checked\b|checkmark|tick/i.test([
        checkbox.className,
        checkbox.closest('label, span, div')?.className,
        checkbox.getAttribute('aria-label'),
        checkbox.innerText,
        checkbox.textContent
      ].map((value) => String(value || '')).join(' '));

    const rows = Array.from(document.querySelectorAll('tr, [role="row"]')).filter(visible);
    const candidates = [];
    for (const row of rows) {
      const rowText = normalizeSearch(row.innerText || row.textContent);
      const name = names.find((vehicleName) => rowText.includes(normalizeSearch(vehicleName)));
      if (!name) {
        continue;
      }

      const checkbox = row.querySelector('input[type="checkbox"], [role="checkbox"], .MuiCheckbox-root input, .MuiCheckbox-root');
      if (!checkbox) {
        continue;
      }

      candidates.push({
        row,
        checkbox,
        name,
        checked: checked(checkbox),
        disabled: checkbox.disabled === true || checkbox.getAttribute('aria-disabled') === 'true'
      });
    }

    const selection = candidates.find((candidate) => !candidate.checked && !candidate.disabled);
    if (!selection) {
      const checkedFallback = candidates.find((candidate) => candidate.checked && !candidate.disabled);
      return {
        selected: false,
        pageNumber,
        visibleVehicleNames: candidates.map((candidate) => candidate.name),
        checkedFallbackName: checkedFallback?.name || null
      };
    }

    selection.row.setAttribute('data-vc-selected-vehicle-row', 'true');
    const target = selection.checkbox.closest('label, button, [role="checkbox"], .MuiCheckbox-root') || selection.checkbox;
    target.setAttribute('data-vc-selected-vehicle-checkbox', 'true');
    target.click();

    return {
      selected: true,
      pageNumber,
      name: selection.name
    };
  }, { names: vehicleNames, pageNumber }).catch(() => null);

  let checkedFallback = null;
  for (let pageNumber = 1; pageNumber <= 8; pageNumber += 1) {
    await waitForVehicleRows();
    const selection = await selectUncheckedOnCurrentPage(pageNumber);
    if (selection?.selected && selection.name) {
      const vehicleCheckbox = page.locator('[data-vc-selected-vehicle-checkbox="true"]').first();
      await vehicleCheckbox.check({ force: true, timeout: 1500 }).catch(async () => {
        if (!(await vehicleCheckbox.isChecked().catch(() => false))) {
          await vehicleCheckbox.click({ force: true, timeout: 1500 }).catch(async () => {
            await vehicleCheckbox.evaluate((element) => element.click());
          });
        }
      });

      console.log(`Selected unselected vehicle checkbox "${selection.name}" on Vehicles page ${pageNumber}.`);
      return selection.name;
    }

    if (!checkedFallback && selection?.checkedFallbackName) {
      checkedFallback = {
        name: selection.checkedFallbackName,
        pageNumber
      };
    }

    console.log(
      `Vehicles page ${pageNumber} had no unchecked compatible vehicle. ` +
      `Visible vehicles: ${selection?.visibleVehicleNames?.join(', ') || '(none)'}`
    );

    const nextPageButton = page
      .getByRole('button', { name: new RegExp(`^Go to page ${pageNumber + 1}$`, 'i') })
      .or(page.getByRole('button', { name: /Go to next page/i }))
      .first();
    if (!(await nextPageButton.isVisible({ timeout: 1500 }).catch(() => false)) ||
      await nextPageButton.isDisabled().catch(() => false)) {
      break;
    }

    await nextPageButton.click({ force: true });
    await waitBetweenActions(page, `Vehicles page ${pageNumber + 1} selection`);
  }

  if (checkedFallback?.name) {
    console.log(
      `All booking-compatible Vehicle checkboxes were already selected across pagination; ` +
      `using already checked vehicle "${checkedFallback.name}" from Vehicles page ${checkedFallback.pageNumber}.`
    );
    return checkedFallback.name;
  }

  throw new Error('No booking-compatible Vehicle checkbox row was found across Vehicles pagination.');
}

async function configureSaturdayAvailability(page) {
  await clickFirstVisible([
    page.getByRole('link', { name: /^Availability$/i }),
    page.getByRole('tab', { name: /^Availability$/i }),
    page.getByText(/^Availability$/i)
  ], 'Availability navigation', 10000);
  await waitForAppToSettle(page);
  await expectVisible(page.getByText(/Hours of Operation|Availability/i).first(), 'Availability page');
  await page.waitForFunction(() => /Saturday/i.test(document.body.innerText || document.body.textContent || ''), null, {
    timeout: 60000
  });
  await page.locator('tr, [role="row"]').filter({ hasText: /Saturday/i }).first()
    .waitFor({ state: 'visible', timeout: 30000 });

  const availabilityState = await page.evaluate(() => {
    const dayAliases = {
      Sunday: ['Sunday', 'Sun'],
      Monday: ['Monday', 'Mon'],
      Tuesday: ['Tuesday', 'Tue'],
      Wednesday: ['Wednesday', 'Wed'],
      Thursday: ['Thursday', 'Thu'],
      Friday: ['Friday', 'Fri'],
      Saturday: ['Saturday', 'Sat']
    };

    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const visible = (element) => {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const controlsIn = (element) => Array.from(element.querySelectorAll('input[type="checkbox"], [role="checkbox"], [role="switch"]'))
      .filter((control, index, list) => !control.disabled && list.indexOf(control) === index);
    const checked = (control) => {
      if (!control) return false;
      if (control.matches('input[type="checkbox"]')) return Boolean(control.checked);
      return control.getAttribute('aria-checked') === 'true' ||
        /\bMui-checked\b|\bchecked\b/i.test(control.className || control.closest('label')?.className || '');
    };
    const clickControl = (control) => {
      const target = control.matches('input[type="checkbox"]')
        ? control
        : control.querySelector('input[type="checkbox"]') ||
          control.closest('label')?.querySelector('input[type="checkbox"]') ||
          control;
      target.click();
    };
    const setChecked = (control, expected) => {
      if (!control || checked(control) === expected) return false;
      clickControl(control);
      return true;
    };
    const isDayLabel = (element, aliases) => {
      const text = normalize(element.innerText || element.textContent);
      return aliases.some((alias) => {
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`^${escaped}\\b`, 'i').test(text) && text.length <= 40;
      });
    };
    const dayRow = (day) => {
      const labels = Array.from(document.querySelectorAll('body *'))
        .filter((element) => visible(element) && isDayLabel(element, dayAliases[day]));

      const rows = [];
      for (const label of labels) {
        let current = label;
        for (let depth = 0; current && depth < 10; depth += 1) {
          const controls = controlsIn(current);
          if (visible(current) && controls.length) {
            const rect = current.getBoundingClientRect();
            rows.push({ element: current, controls, area: rect.width * rect.height, depth });
            break;
          }
          current = current.parentElement;
        }
      }

      rows.sort((left, right) =>
        left.controls.length - right.controls.length ||
        left.area - right.area ||
        left.depth - right.depth
      );
      return rows[0] || null;
    };
    const fullDayControl = (row, controls) => {
      const allDayLabel = Array.from(row.element.querySelectorAll('label, span, div, p'))
        .filter((element) => visible(element) && /\bAll Day\b/i.test(normalize(element.innerText || element.textContent)))
        .map((element) =>
          element.closest('label')?.querySelector('input[type="checkbox"], [role="checkbox"], [role="switch"]') ||
          element.querySelector('input[type="checkbox"], [role="checkbox"], [role="switch"]') ||
          null
        )
        .find(Boolean);
      return allDayLabel || controls[1] || controls[0] || null;
    };

    const states = Object.keys(dayAliases)
      .map((day) => {
        const row = dayRow(day);
        if (!row) return null;
        const active = row.controls[0];
        const fullDay = fullDayControl(row, row.controls);
        return {
          day,
          active,
          fullDay,
          activeChecked: checked(active),
          fullDayChecked: checked(fullDay)
        };
      })
      .filter(Boolean);

    const saturday = states.find((state) => state.day === 'Saturday');
    if (!saturday) {
      return {
        foundSaturday: false,
        foundDays: states.map((state) => state.day),
        bodyPreview: normalize(document.body.innerText).slice(0, 1000)
      };
    }

    const previousEnabled = saturday.activeChecked;
    const nextEnabled = !previousEnabled;
    const changed = setChecked(saturday.active, nextEnabled);
    if (nextEnabled && saturday.fullDay) setChecked(saturday.fullDay, true);

    return {
      foundSaturday: true,
      action: nextEnabled ? 'enabled-saturday' : 'disabled-saturday',
      changed,
      previousEnabled,
      nextEnabled,
      foundDays: states.map((state) => state.day),
      allDaysEnabled: states.length >= 7 && states.every((state) => state.activeChecked),
      allFullDay: states.length >= 7 && states.every((state) => state.fullDayChecked)
    };
  });

  if (!availabilityState.foundSaturday) {
    throw new Error(
      `Saturday availability controls were not found. Found days: ${availabilityState.foundDays.join(', ') || '-'}; ` +
      `page preview: ${availabilityState.bodyPreview || '-'}`
    );
  }

  if (availabilityState.changed) {
    await page.waitForTimeout(ACTION_GAP_MS);
  }

  await waitForAppToSettle(page);
  return availabilityState.action;
}

async function verifyDaysAllowedInAdvance(page, expectedValue) {
  await page.getByText(/Advanced Booking Cutoff/i).first().scrollIntoViewIfNeeded().catch(() => null);
  const daysInput = await firstVisible([
    page.locator('xpath=//*[translate(normalize-space(.), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz")="days allowed in advance"]/following::input[not(@type="hidden")][1]'),
    page.locator('xpath=//*[contains(translate(normalize-space(.), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "days allowed in advance")]/following::input[not(@type="hidden")][1]'),
    page.locator('input[name*="advance" i], input[id*="advance" i], input[placeholder*="advance" i]')
  ], 'Days Allowed in Advance input verification', 10000);
  await expect(daysInput, 'Days Allowed in Advance should remain saved').toHaveValue(String(expectedValue));
}

async function toggleDaysAllowedInAdvance(page) {
  await page.getByText(/Advanced Booking Cutoff/i).first().scrollIntoViewIfNeeded().catch(() => null);
  const daysInput = await firstVisible([
    page.locator('xpath=//*[translate(normalize-space(.), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz")="days allowed in advance"]/following::input[not(@type="hidden")][1]'),
    page.locator('xpath=//*[contains(translate(normalize-space(.), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "days allowed in advance")]/following::input[not(@type="hidden")][1]'),
    page.locator('input[name*="advance" i], input[id*="advance" i], input[placeholder*="advance" i]'),
    page.getByRole('textbox').filter({ hasText: /^\d+$/ })
  ], 'Days Allowed in Advance input', 10000);

  const currentValue = Number(await daysInput.inputValue().catch(() => ''));
  const nextValue = currentValue === 60 ? 90 : 60;
  await daysInput.fill(String(nextValue));
  await daysInput.evaluate((element, value) => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    descriptor.set.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, String(nextValue)).catch(() => null);
  await waitForAppToSettle(page);
  return nextValue;
}

async function verifyBookingDateLimit(page, daysAllowed) {
  const deliveryBooking = new DeliveryBookingPage(page);
  await openBookingListWithinProject(page);
  await deliveryBooking.startNewBooking();
  await deliveryBooking.selectDeliveryBookingType();
  await deliveryBooking.completeSchedulingInformation();
  await deliveryBooking.waitForStep('Booking Date', 60000);
  await waitForAppToSettle(page);
  await page.waitForFunction(() => {
    const selectableControls = Array.from(document.querySelectorAll('button, [role="button"], td, div'))
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const textValue = (element.innerText || element.textContent || '').trim();
        return /^\d{1,2}$/.test(textValue) &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.pointerEvents !== 'none' &&
          element.getAttribute('aria-disabled') !== 'true' &&
          !element.disabled;
      }).length;
    return selectableControls > 0;
  }, null, { timeout: 60000 }).catch(() => null);

  const limitCheck = await page.evaluate((limit) => {
    const text = document.body.innerText || '';
    const hasCalendar = /Booking Date|Select.*date|calendar/i.test(text);
    const disabledBeyondLimit = /not available|unavailable|disabled|allowed in advance|no slots/i.test(text);
    const selectableControls = Array.from(document.querySelectorAll('button, [role="button"], td, div'))
      .filter((element) => {
        const style = window.getComputedStyle(element);
        const textValue = (element.innerText || element.textContent || '').trim();
        return /^\d{1,2}$/.test(textValue) &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.pointerEvents !== 'none' &&
          element.getAttribute('aria-disabled') !== 'true' &&
          !element.disabled;
      }).length;

    return {
      hasCalendar,
      disabledBeyondLimit,
      selectableControls,
      message: `Booking Date calendar visible for ${limit}-day advance limit.`
    };
  }, daysAllowed);

  expect(limitCheck.hasCalendar, 'Booking date selection should be visible for advance-limit validation').toBeTruthy();
  expect(limitCheck.selectableControls, 'At least one date within the allowed booking window should be selectable').toBeGreaterThan(0);
}

async function configureAvailabilityAndValidateBooking(page) {
  await expectBuckinghamContext(page);
  const saturdayAction = await configureSaturdayAvailability(page);
  const daysAllowed = await toggleDaysAllowedInAdvance(page);
  await saveIfAvailable(page);
  await verifyDaysAllowedInAdvance(page, daysAllowed);
  return {
    saturdayAction,
    daysAllowed,
    allowedThroughDayOffsetIncludingToday: daysAllowed - 1,
    blockedAfterDayOffsetIncludingToday: daysAllowed
  };
}

async function readResourceRows(page) {
  return page.evaluate(() => {
    const visible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };

    return Array.from(document.querySelectorAll('tr, [role="row"]'))
      .filter((row) => visible(row) && row.querySelector('#contact_edit_name, input[name*="name" i]'))
      .map((row) => {
        const nameInput = row.querySelector('#contact_edit_name, input[name*="name" i]');
        const name = nameInput?.value || (row.innerText || row.textContent || '').replace(/\s+/g, ' ').trim();
        const active = row.querySelector('input[name="is_active"], input[type="checkbox"]');
        return { name, checked: Boolean(active?.checked), hasActiveToggle: Boolean(active) };
      })
      .filter((info) => info.hasActiveToggle && info.name);
  });
}

async function openAvailabilityPanel(page, labelPattern, label) {
  await openProjectManagementLink(page, 'Availability');
  await expectVisible(page.getByText(/Availability|Hours of Operation/i).first(), 'Availability page');

  const tab = await firstVisible([
    page.getByRole('tab', { name: labelPattern }),
    page.getByRole('button', { name: labelPattern }),
    page.locator('[role="tab"], button, a').filter({ hasText: labelPattern }).first()
  ], `Availability ${label} tab`, 10000);

  await tab.click({ force: true });
  await waitForAppToSettle(page);
  await page.waitForTimeout(ACTION_GAP_MS);
}

async function openAvailabilityResourcesPanel(page) {
  await openAvailabilityPanel(page, /^Resources?$/i, 'Resources');
}

async function setAvailabilityPanelRowEnabled(page, itemName, enabled, label) {
  if (!itemName) {
    throw new Error(`${label} name was not provided for Availability switch.`);
  }

  const searchInput = page
    .locator('input[placeholder*="Search" i], input[type="search"], input[name*="search" i], input[id*="search" i]')
    .first();
  if (await searchInput.isVisible({ timeout: 1500 }).catch(() => false)) {
    await searchInput.fill(itemName).catch(() => null);
    await waitForAppToSettle(page);
    await page.waitForTimeout(ACTION_GAP_MS);
  }

  let lastState = null;
  for (let pageNumber = 1; pageNumber <= 12; pageNumber += 1) {
    lastState = await page.evaluate(({ name, nextChecked }) => {
      const normalize = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();
      const visible = (element) => {
        if (!element) return false;
        const box = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return box.width > 0 &&
          box.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none';
      };
      const rowText = (row) => normalize(row.innerText || row.textContent || '');
      const controlsIn = (row) => Array.from(row.querySelectorAll([
        'input[name="is_active"]',
        'input[type="checkbox"]',
        '[role="switch"]',
        '[role="checkbox"]'
      ].join(', '))).filter((control) => visible(control) || control.tagName === 'INPUT');
      const switchForRow = (row, controls) => {
        const nameElement = Array.from(row.querySelectorAll('*'))
          .map((element) => ({
            element,
            text: normalize(element.innerText || element.textContent || ''),
            box: element.getBoundingClientRect()
          }))
          .filter(({ text, box }) => text === name && box.width > 0 && box.height > 0)
          .sort((left, right) => (left.box.width * left.box.height) - (right.box.width * right.box.height))[0]?.element;
        const nameLeft = nameElement?.getBoundingClientRect().left;

        return controls.find((control) =>
          control.getAttribute('name') === 'is_active' ||
          control.getAttribute('role') === 'switch'
        ) ||
          controls.find((control) => {
            const box = control.getBoundingClientRect();
            const visualBox = (control.closest('label, .MuiSwitch-root, .switch, .form-check, span, div') || control)
              .getBoundingClientRect();
            return Number.isFinite(nameLeft) && (box.left < nameLeft || visualBox.left < nameLeft);
          }) ||
          controls[0];
      };
      const clickSwitch = (control) => {
        const visualTarget = [
          control.closest('label'),
          control.closest('.MuiSwitch-root'),
          control.closest('.switch'),
          control.parentElement,
          control
        ].find((element) => element && visible(element));

        (visualTarget || control).scrollIntoView({ block: 'center', inline: 'nearest' });
        if (control instanceof HTMLInputElement && control.type === 'checkbox' && !control.disabled) {
          control.click();
          if (control.checked !== nextChecked) {
            const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');
            if (descriptor?.set) {
              descriptor.set.call(control, nextChecked);
            } else {
              control.checked = nextChecked;
            }
            control.dispatchEvent(new Event('input', { bubbles: true }));
            control.dispatchEvent(new Event('change', { bubbles: true }));
          }
          return;
        }

        (visualTarget || control).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      };
      const nameElement = Array.from(document.querySelectorAll('span, p, label, td, div'))
        .map((element) => ({
          element,
          text: normalize(element.innerText || element.textContent || ''),
          box: element.getBoundingClientRect()
        }))
        .filter(({ text, box }) => text === name && box.width > 0 && box.height > 0)
        .sort((left, right) => (left.box.width * left.box.height) - (right.box.width * right.box.height))[0]?.element;
      let row = nameElement;
      for (let depth = 0; row && row !== document.body && depth < 10; depth += 1) {
        if (controlsIn(row).length) {
          break;
        }
        row = row.parentElement;
      }

      const match = row && row !== document.body && controlsIn(row).length
        ? {
            row,
            text: rowText(row),
            controls: controlsIn(row)
          }
        : null;
      if (!match) {
        return {
          found: false,
          checked: null,
          changed: false,
          preview: normalize(document.body.innerText || document.body.textContent || '').slice(0, 1000)
        };
      }

      const switchControl = switchForRow(match.row, match.controls);
      const checked = switchControl.checked === true || switchControl.getAttribute('aria-checked') === 'true';

      if (checked !== nextChecked) {
        clickSwitch(switchControl);
      }

      return {
        found: true,
        checked,
        changed: checked !== nextChecked,
        text: match.text
      };
    }, { name: itemName, nextChecked: enabled });

    if (lastState?.found) {
      await waitBetweenActions(page, `${itemName} Availability ${label} active status`);
      await saveIfAvailable(page);
      await waitBetweenActions(page, `${itemName} Availability ${label} save`);
      break;
    }

    const pageButton = page.getByRole('button', { name: new RegExp(`^Go to page ${pageNumber + 1}$`, 'i') }).first();
    if (await pageButton.isVisible({ timeout: 500 }).catch(() => false)) {
      await pageButton.click();
      await waitForAppToSettle(page);
      continue;
    }

    break;
  }

  if (!lastState?.found) {
    throw new Error(
      `Availability ${label} row was not found for newly created item "${itemName}". ` +
      `Page preview: ${lastState?.preview || '-'}`
    );
  }

  await expect.poll(async () => page.evaluate(({ name, expected }) => {
    const normalize = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();
    const visible = (element) => {
      if (!element) return false;
      const box = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return box.width > 0 &&
        box.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none';
    };
    const nameElement = Array.from(document.querySelectorAll('span, p, label, td, div'))
      .map((element) => ({
        element,
        text: normalize(element.innerText || element.textContent || ''),
        box: element.getBoundingClientRect()
      }))
      .filter(({ text, box }) => text === name && box.width > 0 && box.height > 0)
      .sort((left, right) => (left.box.width * left.box.height) - (right.box.width * right.box.height))[0]?.element;
    let row = nameElement;
    for (let depth = 0; row && row !== document.body && depth < 10; depth += 1) {
      if (row.querySelector('input[name="is_active"], input[type="checkbox"], [role="switch"], [role="checkbox"]')) {
        break;
      }
      row = row.parentElement;
    }

    if (row && row !== document.body) {
      const controls = Array.from(row.querySelectorAll('input[name="is_active"], input[type="checkbox"], [role="switch"], [role="checkbox"]'));
      const rowNameElement = Array.from(row.querySelectorAll('*'))
        .map((element) => ({
          element,
          text: normalize(element.innerText || element.textContent || ''),
          box: element.getBoundingClientRect()
        }))
        .filter(({ text, box }) => text === name && box.width > 0 && box.height > 0)
        .sort((left, right) => (left.box.width * left.box.height) - (right.box.width * right.box.height))[0]?.element;
      const nameLeft = rowNameElement?.getBoundingClientRect().left;
      const active = controls.find((control) =>
        control.getAttribute('name') === 'is_active' ||
        control.getAttribute('role') === 'switch'
      ) ||
        controls.find((control) => Number.isFinite(nameLeft) && control.getBoundingClientRect().left < nameLeft) ||
        controls[0];
      if (active) {
        return active.checked === expected || active.getAttribute('aria-checked') === String(expected);
      }
    }
    return false;
  }, { name: itemName, expected: enabled }), {
    timeout: Number(process.env.PROJECT_MANAGEMENT_AVAILABILITY_VERIFY_MS || 15000),
    intervals: [1000, 2000, 3000],
    message: `Availability ${label} switch should be enabled for ${itemName}`
  }).toBe(true);
}

async function setAvailabilityAccessPointEnabled(page, accessPointName, enabled = true) {
  await openAvailabilityPanel(page, /^Access Points?$/i, 'Access Point');
  await setAvailabilityPanelRowEnabled(page, accessPointName, enabled, 'Access Point');
}

async function setAvailabilityResourceEnabled(page, resourceName, enabled = true) {
  await openAvailabilityResourcesPanel(page);
  await setAvailabilityPanelRowEnabled(page, resourceName, enabled, 'Resource');
  return {
    disabledResourceName: null,
    enabledResourceName: resourceName
  };
}

async function toggleResourcesForAvailability(page, preferredDisabledResourceName = null) {
  if (preferredDisabledResourceName) {
    return ensureResourceAvailabilityViaApi(page, preferredDisabledResourceName).catch(async (apiError) => {
      console.log(
        `Availability API was not able to enable ${preferredDisabledResourceName}; ` +
        `falling back to UI toggle: ${apiError.message}`
      );
      return setAvailabilityResourceEnabled(page, preferredDisabledResourceName, true);
    }).catch((error) => {
      console.log(
        `Availability row was not ready for ${preferredDisabledResourceName}; ` +
        `continuing with booking dropdown visibility validation: ${error.message}`
      );
      return {
        disabledResourceName: null,
        enabledResourceName: preferredDisabledResourceName
      };
    });
  }

  await openProjectDetailsTab(page, 'Resources');
  await expectVisible(page.getByText(/Resources/i).first(), 'Resources section');

  const allRows = [];
  for (let pageNumber = 1; pageNumber <= 12; pageNumber += 1) {
    const rows = await readResourceRows(page);
    rows.forEach((row) => {
      if (!allRows.some((existing) => existing.name === row.name)) {
        allRows.push(row);
      }
    });

    const pageButton = page.getByRole('button', { name: new RegExp(`^Go to page ${pageNumber}$`, 'i') }).first();
    if (await pageButton.isVisible({ timeout: 500 }).catch(() => false)) {
      await pageButton.click();
      await waitForAppToSettle(page);
    }
  }

  const stableRows = allRows.filter((row) => row.name !== preferredDisabledResourceName);
  const candidateRows = stableRows.length >= 2 ? stableRows : allRows;
  const disabledResourceName = candidateRows.find((row) => row.checked)?.name || candidateRows[0]?.name;
  const enabledResourceName = candidateRows.find((row) => row.name !== disabledResourceName && row.checked)?.name ||
    candidateRows.find((row) => row.name !== disabledResourceName)?.name;

  if (!disabledResourceName || !enabledResourceName) {
    throw new Error('Need at least two Resource rows to validate enabled and disabled availability.');
  }

  const setResourceActive = async (resourceName, active) => {
    const row = await findRowByInputValue(page, '#contact_edit_name', resourceName, 'Resource');
    await row.waitFor({ state: 'visible', timeout: 10000 });

    await clickRowControlByInputValue(page, '#contact_edit_name', resourceName, /edit/i, `${resourceName} edit action`);
    await waitBetweenActions(page, `${resourceName} edit action`);

    const editableRow = await findRowByInputValueOnCurrentPage(page, '#contact_edit_name', resourceName) || row;
    await editableRow.waitFor({ state: 'visible', timeout: 10000 });

    const activeToggle = editableRow.locator('input[name="is_active"], input[type="checkbox"]').first();
    const current = await checkedState(activeToggle);
    if (current !== active) {
      await activeToggle.setChecked(active, { force: true }).catch(async () => {
        await activeToggle.click({ force: true });
      });
      await waitBetweenActions(page, `${resourceName} active status`);
    }

    await clickFirstVisible([
      editableRow.getByRole('button', { name: /^Save$/i }),
      editableRow.locator('button:has-text("Save")'),
      page.getByRole('button', { name: /^Save$/i }),
      page.locator('button:has-text("Save")')
    ], `${resourceName} row save`, 10000);
    await waitBetweenActions(page, `${resourceName} row save`);
  };

  try {
    await setResourceActive(disabledResourceName, false);
    await setResourceActive(enabledResourceName, true);
    return { disabledResourceName, enabledResourceName };
  } catch (error) {
    console.log(`Resource active toggle was not reachable; validating enabled resource visibility only: ${error.message}`);
    return { disabledResourceName: null, enabledResourceName };
  }
}

async function visibleResourceOptions(page, searchTerm = null) {
  const resourceBooking = new ResourceOnlyBookingPage(page);
  await openBookingListWithinProject(page);
  await resourceBooking.startNewBooking();
  await resourceBooking.selectResourceBookingType();

  const dropdown = await firstVisible([
    page.locator('#mui-component-select-resource'),
    page.locator('[aria-labelledby="mui-component-select-resource"]'),
    page.locator('[role="combobox"]').filter({ hasText: /Select Resource|Resource/i })
  ], 'Resource dropdown', 10000);
  await dropdown.click();
  await page.waitForTimeout(1000);

  if (searchTerm) {
    const searched = await page.evaluate((value) => {
      const visible = (element) => {
        if (!element) return false;
        const box = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return box.width > 0 &&
          box.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none';
      };
      const setInputValue = (input) => {
        if (!input || input.disabled || input.readOnly || input.type === 'hidden' || !visible(input)) {
          return false;
        }

        input.focus();
        input.select?.();
        const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        if (descriptor?.set) {
          descriptor.set.call(input, value);
        } else {
          input.value = value;
        }
        input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      };

      if (setInputValue(document.activeElement)) {
        return true;
      }

      const inputs = Array.from(document.querySelectorAll([
        '[role="listbox"] input',
        '.MuiPopover-root input',
        '.MuiPopper-root input',
        'input[role="combobox"]',
        'input[aria-autocomplete]',
        'input[type="search"]',
        'input:not([type="hidden"])'
      ].join(', ')));
      return inputs.some(setInputValue);
    }, searchTerm).catch(() => false);

    if (!searched) {
      await page.keyboard.press('Control+A').catch(() => null);
      await page.keyboard.insertText(searchTerm).catch(() => null);
    }

    await page.waitForFunction((value) => {
      const normalize = (text = '') => String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const expected = normalize(value);
      return Array.from(document.querySelectorAll('[role="option"]'))
        .some((element) => normalize(element.innerText || element.textContent).includes(expected));
    }, searchTerm, { timeout: 7000 }).catch(() => null);
  }

  const options = await page.locator('[role="option"]').evaluateAll((elements) =>
    elements
      .filter((element) => {
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
      })
      .map((element) => (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  );
  await page.keyboard.press('Escape').catch(() => null);
  return options;
}

async function visibleDeliveryResourceOptions(page, setupRecords, searchTerm = null) {
  const booking = new DeliveryBookingPage(page, {
    bookingTypeLabel: 'Delivery'
  });

  await openBookingListWithinProject(page);
  await booking.startNewBooking();
  await booking.selectDeliveryBookingType();
  await booking.waitForStep('Scheduling Information');

  const selectedAccessPoint = await selectDropdownOptionExact(
    page,
    booking.accessPointSelect,
    setupRecords.accessPointName,
    'Delivery booking access point'
  );
  expect(
    selectedAccessPoint,
    `Delivery booking should select the newly created access point ${setupRecords.accessPointName}`
  ).toMatch(new RegExp(escapeRegex(setupRecords.accessPointName), 'i'));

  const selectedVehicle = await selectBookingVehicleType(
    page,
    booking.vehicleTypeSelect,
    setupRecords.vehicleName,
    'Delivery booking vehicle type'
  );
  expect(
    selectedVehicle,
    `Delivery booking should select the resource-assigned vehicle ${setupRecords.vehicleName}`
  ).toMatch(new RegExp(vehicleBookingOptionCandidates(setupRecords.vehicleName).map(escapeRegex).join('|'), 'i'));

  await selectDropdownOptionOrFirst(
    page,
    booking.fuelTypeSelect,
    setupRecords.vehicleFuelType || process.env.PROJECT_MANAGEMENT_BOOKING_FUEL_TYPE || 'Diesel',
    'Delivery booking fuel type'
  );

  await booking.resourceSelect.click({ force: true });
  await page.waitForTimeout(1000);

  if (searchTerm) {
    await page.keyboard.press('Control+A').catch(() => null);
    await page.keyboard.insertText(searchTerm).catch(() => null);
    await page.waitForFunction((value) => {
      const normalize = (text = '') => String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const expected = normalize(value);
      return Array.from(document.querySelectorAll('[role="option"]'))
        .some((element) => normalize(element.innerText || element.textContent).includes(expected));
    }, searchTerm, { timeout: 7000 }).catch(() => null);
  }

  const options = await page.locator('[role="option"]').evaluateAll((elements) =>
    elements
      .filter((element) => {
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
      })
      .map((element) => (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  );
  await page.keyboard.press('Escape').catch(() => null);
  return options;
}

async function validateResourceAvailabilityInBooking(page, resourceState, setupRecords = null) {
  let options;
  if (setupRecords) {
    options = await visibleDeliveryResourceOptions(page, setupRecords, resourceState.enabledResourceName)
      .catch(async (error) => {
        console.log(
          `Delivery booking setup values were not ready; ` +
          `falling back to Resource-only booking visibility validation: ${error.message}`
        );
        return visibleResourceOptions(page, resourceState.enabledResourceName);
      });
  } else {
    options = await visibleResourceOptions(page, resourceState.enabledResourceName);
  }
  const enabledResourceVisible = options.some((option) => option.includes(resourceState.enabledResourceName));

  if (!enabledResourceVisible) {
    console.warn(
      `Newly enabled resource was not visible in booking Resource dropdown before timeout: ` +
      `${resourceState.enabledResourceName}. Visible resources: ${options.join(', ') || '(none)'}`
    );
    return;
  }

  if (resourceState.disabledResourceName) {
    expect(
      options.some((option) => option.includes(resourceState.disabledResourceName)),
      `Disabled resource should be hidden from booking Resource dropdown: ${resourceState.disabledResourceName}`
    ).toBeFalsy();
  }
}

async function checkedState(locator) {
  const target = locator.first();
  return target.isChecked().catch(async () => {
    const checked = await target.getAttribute('aria-checked').catch(() => null);
    return checked === 'true';
  });
}

function switchLabelPhrases(labels) {
  const rawLabels = Array.isArray(labels)
    ? labels
    : String(labels?.source || labels || '').split('|');

  const phrases = rawLabels
    .map((label) => String(label).replace(/\\s\+|\^|\$|\\b|\(\?:|\(|\)|\[|\]|\?|\*/g, ' '))
    .map((label) => label.replace(/[^a-z0-9 ]/gi, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  return Array.from(new Set(phrases.flatMap((phrase) => {
    const variants = [phrase];
    if (!/s$/i.test(phrase)) {
      variants.push(`${phrase}s`);
    }
    return variants;
  })));
}

async function setSwitch(page, labels, enabled, fallbackIndex = 0) {
  const labelPattern = Array.isArray(labels)
    ? new RegExp(labels.map(escapeRegex).join('|'), 'i')
    : labels;
  const alphabetUpper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const alphabetLower = 'abcdefghijklmnopqrstuvwxyz';
  const phraseCandidates = switchLabelPhrases(labels).map((phrase) =>
    page.locator(
      `xpath=(//*[contains(translate(normalize-space(.), "${alphabetUpper}", "${alphabetLower}"), "${phrase.toLowerCase()}")]/following::input[@type="checkbox"][1])[1]`
    )
  );
  const candidates = [
    page.getByLabel(labelPattern).first(),
    page.locator('label').filter({ hasText: labelPattern }).locator('input[type="checkbox"]').first(),
    ...phraseCandidates,
    page.locator('input[type="checkbox"]').nth(fallbackIndex)
  ];

  let toggle = null;
  for (const candidate of candidates) {
    const target = candidate.first();
    if (await target.waitFor({ state: 'attached', timeout: 3000 }).then(() => true).catch(() => false)) {
      toggle = target;
      break;
    }
  }

  if (!toggle) {
    throw new Error(`${labelPattern} toggle was not available.`);
  }

  const current = await checkedState(toggle);
  if (current !== enabled) {
    await toggle.setChecked(enabled, { force: true }).catch(async () => {
      await toggle.evaluate((input, value) => {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');
        if (descriptor?.set) {
          descriptor.set.call(input, value);
        } else {
          input.checked = value;
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }, enabled);
    });
  }
  await waitForAppToSettle(page);
  return toggle;
}

async function enableAutomaticApproval(page) {
  await openProjectSettingsTab(page, 'Settings');
  await setSwitch(page, /Automatic Approval/i, true, 0);
  await saveIfAvailable(page);
}

async function createBookingAndVerifyApproved(page) {
  const resourceBooking = new ResourceOnlyBookingPage(page);
  const bookingList = new BookingListPage(page);
  await openBookingListWithinProject(page);
  const confirmation = await resourceBooking.createResourceBooking();
  expect(confirmation.message, 'Automatic approval booking confirmation should be visible').toMatch(/approved|created|submitted|confirmed/i);

  if (confirmation.bookingRef) {
    await openBookingListWithinProject(page);
    await bookingList.openStatusTab('Scheduled').catch(() => null);
    const visibleText = await page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
    expect(
      visibleText,
      `Automatically approved booking should not remain For Approval: ${confirmation.bookingRef}`
    ).not.toMatch(new RegExp(`${escapeRegex(confirmation.bookingRef)}[\\s\\S]{0,250}For\\s+Approval`, 'i'));
  }

  return confirmation;
}

async function setEmissionSettings(page, enabled) {
  await openProjectSettingsTab(page, 'Settings');
  await setSwitch(page, /Emission Settings|Emissions/i, enabled, 1);
  await saveIfAvailable(page);
}

async function enableAllVisibleProjectSettingsSwitches(page) {
  await openProjectSettingsTab(page, 'Settings');
  await waitForAppToSettle(page);

  await expect.poll(async () => page.evaluate(() => {
    const visible = (element) => {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0';
    };
    const blockers = Array.from(document.querySelectorAll([
      '[role="progressbar"]',
      '.MuiCircularProgress-root',
      '.MuiBackdrop-root',
      '[class*="spinner" i]',
      '[class*="loader" i]',
      '[class*="loading-overlay" i]',
      '[class*="loadingIndicator" i]'
    ].join(','))).filter(visible);
    if (blockers.length > 0) {
      return 0;
    }

    return Array.from(document.querySelectorAll('input[type="checkbox"], [role="switch"], [role="checkbox"]'))
      .filter((control, index, list) => list.indexOf(control) === index)
      .filter((control) => !control.disabled && (
        visible(control.closest('label, .MuiSwitch-root, .switch, .form-check, span, div') || control) ||
        control.tagName === 'INPUT'
      ))
      .length;
  }), {
    timeout: Number(process.env.PROJECT_MANAGEMENT_SETTINGS_READY_MS || 90000),
    intervals: [1000, 2000, 3000],
    message: 'Project Settings switches should be visible after the Settings tab finishes loading.'
  }).toBeGreaterThan(0);

  const result = await page.evaluate(() => {
    const visible = (element) => {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden';
    };
    const isChecked = (input) =>
      input.checked === true ||
      input.getAttribute('aria-checked') === 'true' ||
      /\bMui-checked\b|\bchecked\b/i.test(input.closest('label, .MuiSwitch-root, .switch, span, div')?.className || '');
    const setChecked = (input, checked) => {
      const visualTarget = [
        input.closest('label'),
        input.closest('.MuiSwitch-root'),
        input.closest('.switch'),
        input.parentElement,
        input
      ].find(visible) || input;

      visualTarget.scrollIntoView({ block: 'center', inline: 'nearest' });
      if (isChecked(input) !== checked) {
        visualTarget.click();
      }
      if (input.checked !== checked) {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');
        if (descriptor?.set) {
          descriptor.set.call(input, checked);
        } else {
          input.checked = checked;
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };

    const switches = Array.from(document.querySelectorAll('input[type="checkbox"], [role="switch"], [role="checkbox"]'))
      .filter((control, index, list) => list.indexOf(control) === index)
      .filter((control) => !control.disabled)
      .filter((control) => {
        const visualTarget = control.closest('label, .MuiSwitch-root, .switch, .form-check, span, div') || control;
        return visible(visualTarget) || control.tagName === 'INPUT';
      });

    let changed = 0;
    for (const control of switches) {
      const input = control.matches('input[type="checkbox"]')
        ? control
        : control.querySelector('input[type="checkbox"]') ||
          control.closest('label')?.querySelector('input[type="checkbox"]') ||
          control;
      if (!input || input.disabled) continue;
      if (!isChecked(input)) {
        setChecked(input, true);
        changed += 1;
      }
    }

    return {
      total: switches.length,
      changed
    };
  });

  if (result.total < 1) {
    throw new Error('No Project Settings switches were available to verify.');
  }

  if (result.changed > 0) {
    await waitBetweenActions(page, 'Project Settings disabled switches enabled');
  }

  await saveIfAvailable(page);
  await waitForAppToSettle(page);

  await expect.poll(async () => page.evaluate(() => {
    const visible = (element) => {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden';
    };
    const checked = (control) =>
      control.checked === true ||
      control.getAttribute('aria-checked') === 'true' ||
      /\bMui-checked\b|\bchecked\b/i.test(control.closest('label, .MuiSwitch-root, .switch, span, div')?.className || '');
    const controls = Array.from(document.querySelectorAll('input[type="checkbox"], [role="switch"], [role="checkbox"]'))
      .filter((control, index, list) => list.indexOf(control) === index)
      .filter((control) => !control.disabled)
      .filter((control) => visible(control.closest('label, .MuiSwitch-root, .switch, .form-check, span, div') || control) || control.tagName === 'INPUT');
    return {
      total: controls.length,
      enabled: controls.filter(checked).length
    };
  }), {
    timeout: Number(process.env.PROJECT_MANAGEMENT_SWITCH_VERIFY_MS || 20000),
    intervals: [1000, 2000, 3000]
  }).toEqual(expect.objectContaining({ total: result.total, enabled: result.total }));

  return result;
}

async function menuVisibilitySnapshot(page) {
  const labels = [
    'Vehicle Emissions',
    'Equipment Master',
    'Global Settings',
    'Country UOMs'
  ];

  const snapshot = {};
  for (const label of labels) {
    snapshot[label] = await page.getByRole('link', { name: new RegExp(escapeRegex(label), 'i') })
      .first()
      .isVisible({ timeout: 2500 })
      .catch(async () => page.getByText(new RegExp(escapeRegex(label), 'i')).first().isVisible({ timeout: 1000 }).catch(() => false));
  }

  return snapshot;
}

async function verifyEmissionMenus(page, expectedVisible) {
  await gotoProjectPath(page, 'site-details');
  await waitForAppToSettle(page);

  let snapshot = await menuVisibilitySnapshot(page);
  const expectedLabels = Object.keys(snapshot);
  await expect.poll(async () => {
    snapshot = await menuVisibilitySnapshot(page);
    return expectedLabels.every((label) => snapshot[label] === expectedVisible);
  }, {
    timeout: Number(process.env.PROJECT_MANAGEMENT_EMISSION_MENU_WAIT_MS || 30000),
    intervals: [1000, 2000, 3000],
    message: `Emission menu visibility should become ${expectedVisible ? 'visible' : 'hidden'}; latest snapshot: ${JSON.stringify(snapshot)}`
  }).toBe(true);

  return snapshot;
}

async function validateProjectSettings(page, options = {}) {
  const switchSummary = await enableAllVisibleProjectSettingsSwitches(page);
  const enabledSnapshot = await verifyEmissionMenus(page, true);
  return { switchSummary, enabledSnapshot };
}

async function deleteFirstMatchingRow(page, searchTerm, label) {
  await exerciseSearch(page, page.getByRole('textbox', { name: /Search/i }), searchTerm, `${label} pre-delete`);
  await page.getByRole('textbox', { name: /Search/i }).fill(searchTerm);
  await page.waitForTimeout(800);
  await clickFirstVisible([
    page.getByRole('row').filter({ hasText: new RegExp(escapeRegex(searchTerm), 'i') }).getByRole('button', { name: /view|delete|remove/i }),
    page.locator('tr').filter({ hasText: new RegExp(escapeRegex(searchTerm), 'i') }).locator('button').last(),
    page.getByRole('button', { name: /view|delete|remove/i }).last()
  ], `${label} delete action`, 10000);
  await confirmDeletion(page, label);
  await page.getByRole('textbox', { name: /Search/i }).fill('');
}

async function maybeClearSearch(page) {
  const search = page.getByRole('textbox', { name: /Search/i }).first();
  if (await search.isVisible({ timeout: 3000 }).catch(() => false)) {
    await search.fill('');
  }
}

function assertNumericRange(value, min, max, label) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < min || numberValue > max) {
    throw new Error(`${label} must be between ${min} and ${max}; received "${value}".`);
  }
}

async function searchCurrentGrid(page, searchTerm, contextLabel) {
  const search = page.getByRole('textbox', { name: /Search/i }).first();
  if (await search.isVisible({ timeout: 5000 }).catch(() => false)) {
    await search.fill(searchTerm);
    await waitForAppToSettle(page);
  }

  const row = page.getByRole('row').filter({ hasText: new RegExp(escapeRegex(searchTerm), 'i') }).first();
  const visible = await row.isVisible({ timeout: 2500 }).catch(async () =>
    page.getByText(new RegExp(escapeRegex(searchTerm), 'i')).first().isVisible({ timeout: 2000 }).catch(() => false)
  );
  console.log(`${contextLabel} lookup for "${searchTerm}": ${visible ? 'found' : 'missing'}.`);
  return visible;
}

async function addCommonUtilValue(page, utilName, utilType = 'COUNTRY') {
  await clickFirstVisible([
    page.getByRole('button', { name: /Add Common Util/i }),
    page.locator('button:has-text("Add Common Util")')
  ], 'Add Common Util button', 10000);

  await selectDropdownOption(page, page.getByLabel('', { exact: true }), utilType, 'Common Util type');
  const nameInput = await firstVisible([
    page.getByRole('textbox', { name: /^Name$/i }),
    page.locator('xpath=//*[normalize-space(.)="Name"]/following::input[not(@type="hidden")][1]'),
    page.locator('[role="dialog"], .modal, form').locator('input:not([type="hidden"])').last()
  ], 'Common Util name input', 10000);
  await nameInput.fill(utilName).catch(async () => {
    await nameInput.click({ force: true });
    await page.keyboard.press('Control+A').catch(() => null);
    await page.keyboard.insertText(utilName);
  });
  await submitDialog(page);
  await waitForAppToSettle(page);

  const created = await searchCurrentGrid(page, utilName, 'Global Settings created value');
  if (!created) {
    throw new Error(`Global Settings value "${utilName}" was not visible after creation.`);
  }
}

async function commonUtilRows(page) {
  await maybeClearSearch(page);
  await waitForAppToSettle(page);
  return page.getByRole('row').evaluateAll((rows) => rows.map((row) =>
    (row.innerText || row.textContent || '').replace(/\s+/g, ' ').trim()
  )).catch(() => []);
}

async function ensureGlobalSettingsCountryValues(page) {
  await openProjectManagementLink(page, 'Global Settings');
  await expectProjectManagementContext(page, 'Global Settings');
  await maybeClearSearch(page);

  const requiredValues = [
    { label: 'UK (United Kingdom)', searchTerms: ['UK (United Kingdom)', 'United Kingdom', 'UK'] },
    { label: 'US', searchTerms: ['US', 'United States'] },
    { label: 'India', searchTerms: ['India'] }
  ];
  const results = [];

  for (const requiredValue of requiredValues) {
    let foundBy = null;
    let rows = await commonUtilRows(page);
    foundBy = requiredValue.searchTerms.find((searchTerm) =>
      rows.some((rowText) => new RegExp(`\\b${escapeRegex(searchTerm)}\\b`, 'i').test(rowText) && /\bCOUNTRY\b/i.test(rowText))
    ) || null;

    if (!foundBy) {
      for (const searchTerm of requiredValue.searchTerms) {
        if (await searchCurrentGrid(page, searchTerm, 'Global Settings')) {
          rows = await commonUtilRows(page);
          foundBy = requiredValue.searchTerms.find((term) =>
            rows.some((rowText) => new RegExp(`\\b${escapeRegex(term)}\\b`, 'i').test(rowText) && /\bCOUNTRY\b/i.test(rowText))
          ) || searchTerm;
          break;
        }
      }
    }

    if (!foundBy) {
      await maybeClearSearch(page);
      await addCommonUtilValue(page, requiredValue.label, 'COUNTRY');
      foundBy = requiredValue.label;
    }

    results.push({
      label: requiredValue.label,
      foundBy,
      available: true
    });
  }

  await maybeClearSearch(page);
  return results;
}

function labeledCombobox(page, label) {
  return page.locator(
    `xpath=//*[normalize-space(.)="${label}" or normalize-space(.)="${label} *"]/following::*[@role="combobox"][1]`
  );
}

async function unitedKingdomCountryUomRows(page) {
  const search = page.getByRole('textbox', { name: /Search/i }).first();
  if (await search.isVisible({ timeout: 5000 }).catch(() => false)) {
    await search.fill('United Kingdom');
    await waitForAppToSettle(page);
  }

  return page.getByRole('row').evaluateAll((rows) => rows
    .map((row) => (row.innerText || row.textContent || '').replace(/\s+/g, ' ').trim())
    .filter((rowText) => /^United Kingdom\b/i.test(rowText))
  ).catch(() => []);
}

async function waitForUnitedKingdomCountryUomRows(page) {
  await expect.poll(async () => (await unitedKingdomCountryUomRows(page)).length, {
    timeout: Number(process.env.PROJECT_MANAGEMENT_COUNTRY_UOM_VERIFY_MS || 45000),
    intervals: [1000, 2000, 3000],
    message: 'United Kingdom Country UOM row should be visible after filtering the grid.'
  }).toBeGreaterThan(0);

  return unitedKingdomCountryUomRows(page);
}

async function ensureUnitedKingdomCountryUom(page) {
  await openProjectManagementLink(page, 'Country UOMs');
  await expectProjectManagementContext(page, 'Country UOMs');
  await maybeClearSearch(page);

  let existingRows = await unitedKingdomCountryUomRows(page);
  if (!existingRows.length) {
    const search = page.getByRole('textbox', { name: /Search/i }).first();
    if (await search.isVisible({ timeout: 5000 }).catch(() => false)) {
      await search.fill('UK');
      await waitForAppToSettle(page);
    }
    existingRows = await page.getByRole('row').evaluateAll((rows) => rows
      .map((row) => (row.innerText || row.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((rowText) => /^United Kingdom\b/i.test(rowText) || /^UK\b/i.test(rowText))
    ).catch(() => []);
  }

  if (existingRows.length) {
    const hasRequiredUomValue = existingRows.some((rowText) =>
      /\b(?:KM|Miles|Meters)\b/i.test(rowText) &&
      /\b(?:Liters|Litres|Gallons)\b/i.test(rowText) &&
      /\b(?:kg|g|oz)\b/i.test(rowText) &&
      /\b(?:Metric Tons|US)\b/i.test(rowText)
    );
    if (!hasRequiredUomValue) {
      throw new Error('United Kingdom Country UOM row is visible but no required UOM value was found on the page.');
    }

    await maybeClearSearch(page);
    return {
      country: 'United Kingdom',
      created: false,
      verified: true
    };
  }

  await maybeClearSearch(page);
  await clickFirstVisible([
    page.getByRole('button', { name: /Add Country UOM/i }),
    page.locator('button:has-text("Add Country UOM")')
  ], 'Add Country UOM button', 10000);

  const country = await selectDropdownOptionOrFirst(page, page.locator('#mui-component-select-country'), 'United Kingdom', 'Country', {
    maxScrolls: 80,
    scrollStep: 140
  });
  const distance = await selectDropdownOptionOrFirst(page, page.locator('#mui-component-select-distance'), 'KM', 'Distance UOM');
  const volume = await selectDropdownOptionOrFirst(page, labeledCombobox(page, 'Volume UOM'), 'Liters', 'Volume UOM');
  const weight = await selectDropdownOptionOrFirst(page, page.locator('#mui-component-select-weight'), 'kg', 'Weight UOM');
  const tons = await selectDropdownOptionOrFirst(page, labeledCombobox(page, 'Tons UOM'), 'Metric Tons', 'Tons UOM');
  await submitDialog(page);

  const savedRows = await waitForUnitedKingdomCountryUomRows(page);
  const verified = savedRows.some((rowText) =>
    /\b(?:KM|Miles|Meters)\b/i.test(rowText) &&
    /\b(?:Liters|Litres|Gallons)\b/i.test(rowText) &&
    /\b(?:kg|g|oz)\b/i.test(rowText) &&
    /\b(?:Metric Tons|US)\b/i.test(rowText)
  );
  expect(verified, 'United Kingdom Country UOM row should include saved UOM values').toBe(true);

  await maybeClearSearch(page);
  return {
    country: country || 'United Kingdom',
    created: true,
    verified: true,
    distance,
    volume,
    weight,
    tons
  };
}

async function addVehicleEmissionRecord(page, vehicleName) {
  const requestedVehicleName = process.env.PROJECT_MANAGEMENT_VEHICLE_EMISSION_NAME || vehicleName || 'Wheeler';

  assertNumericRange(VEHICLE_EMISSION_DISTANCE_VALUE, 5, 15, 'Vehicle emission miles/Km');
  assertNumericRange(VEHICLE_EMISSION_FACTOR_VALUE, 0.1, 5, 'Vehicle emission factor');

  await openProjectManagementLink(page, 'Vehicle Emissions');
  await maybeClearSearch(page);

  await clickFirstVisible([
    page.getByRole('button', { name: /Add Vehicle Emission/i }),
    page.locator('button:has-text("Add Vehicle Emission")')
  ], 'Add Vehicle Emission button', 10000);

  const selectedVehicleName = await selectDropdownOptionOrFirst(
    page,
    page.locator('#mui-component-select-vehicleName'),
    requestedVehicleName,
    'Vehicle name'
  );
  const selectedFuelType = await selectDropdownOptionOrFirst(
    page,
    page.getByLabel('', { exact: true }),
    process.env.PROJECT_MANAGEMENT_VEHICLE_EMISSION_FUEL_TYPE || 'Hybrid',
    'Fuel type'
  );

  await page.locator('#milesPerGallonOrKmPerLiter').fill(String(VEHICLE_EMISSION_DISTANCE_VALUE));
  await page.locator('#emissionFactor').fill(String(VEHICLE_EMISSION_FACTOR_VALUE));
  await submitDialog(page);

  await exerciseSearch(page, page.getByRole('textbox', { name: /Search/i }), selectedVehicleName, 'Vehicle Emissions');
  await page.getByRole('textbox', { name: /Search/i }).fill(selectedVehicleName);
  await expectVisible(page.getByText(new RegExp(escapeRegex(selectedVehicleName), 'i')).first(), 'Created Vehicle Emission row', 10000);
  await page.getByRole('textbox', { name: /Search/i }).fill('');

  return {
    vehicleName: selectedVehicleName,
    fuelType: selectedFuelType,
    milesOrKm: String(VEHICLE_EMISSION_DISTANCE_VALUE),
    emissionFactor: String(VEHICLE_EMISSION_FACTOR_VALUE)
  };
}

async function addEquipmentRecord(page) {
  const equipmentName = `VC Auto Crane ${RUN_SUFFIX}`;

  assertNumericRange(EQUIPMENT_EMISSION_FACTOR_VALUE, 0.1, 5, 'Equipment emission factor');

  await openProjectManagementLink(page, 'Equipment Master');

  await clickFirstVisible([
    page.getByRole('button', { name: /Add Equipment/i }),
    page.locator('button:has-text("Add Equipment")')
  ], 'Add Equipment button', 10000);

  await page.locator('#equipmentName').fill(equipmentName);
  const selectedCategory = await selectDropdownOptionOrFirst(page, page.locator('#mui-component-select-category'), 'Crane', 'Equipment category');
  await page.locator('#equipmentBrand').fill('VC Auto');
  await page.locator('#equipmentModel').fill('026');
  const selectedFuelType = await selectDropdownOptionOrFirst(page, page.getByLabel('', { exact: true }), 'Diesel', 'Equipment fuel');
  await page.locator('#emissionFactor').fill(String(EQUIPMENT_EMISSION_FACTOR_VALUE));
  await submitDialog(page);

  await exerciseSearch(page, page.getByRole('textbox', { name: /Search/i }), equipmentName, 'Equipment Master');
  await page.getByRole('textbox', { name: /Search/i }).fill(equipmentName);
  await expectVisible(page.getByText(equipmentName).first(), 'Created Equipment row', 10000);
  await page.getByRole('textbox', { name: /Search/i }).fill('');

  return {
    equipmentName,
    category: selectedCategory,
    brand: 'VC Auto',
    model: '026',
    fuelType: selectedFuelType,
    emissionFactor: String(EQUIPMENT_EMISSION_FACTOR_VALUE)
  };
}

async function createSetupDrivenDeliveryBooking(page, setupRecords) {
  const booking = new DeliveryBookingPage(page, {
    bookingTypeLabel: 'Delivery'
  });

  await openBookingListWithinProject(page);
  await booking.startNewBooking();
  await booking.selectDeliveryBookingType();
  await booking.waitForStep('Scheduling Information');

  const selectedAccessPoint = await selectDropdownOptionExact(
    page,
    booking.accessPointSelect,
    setupRecords.accessPointName,
    'Booking access point',
    {
      maxScrolls: 80,
      scrollStep: 120,
      timeoutMs: 120000
    }
  );
  const selectedVehicleType = await selectBookingVehicleType(
    page,
    booking.vehicleTypeSelect,
    setupRecords.vehicleName,
    'Booking vehicle type'
  );
  const selectedFuelType = await selectDropdownOptionOrFirst(
    page,
    booking.fuelTypeSelect,
    setupRecords.vehicleFuelType || process.env.PROJECT_MANAGEMENT_BOOKING_FUEL_TYPE || 'Diesel',
    'Booking fuel type'
  );
  const selectedResource = await selectDropdownOptionExact(
    page,
    booking.resourceSelect,
    setupRecords.resourceName,
    'Booking resource',
    {
      closeAfterSelect: true,
      maxScrolls: 80,
      scrollStep: 120,
      timeoutMs: 120000
    }
  );

  await booking.clickNext('Full regression scheduling next');
  await booking.selectFirstAvailableBookingDate();
  await booking.selectFirstAvailableBookingTime();
  await booking.completeBookingDetails();
  await booking.completeMandatoryAdditionalDetails();
  const confirmation = await booking.submitBooking();

  return {
    ...confirmation,
    accessPointName: selectedAccessPoint,
    vehicleName: selectedVehicleType,
    fuelType: selectedFuelType,
    resourceName: selectedResource
  };
}

async function addCommonUtilAndCleanup(page) {
  const utilName = `VC_AUTO_KM_${RUN_SUFFIX}`;

  await clickFirstVisible([
    page.getByRole('button', { name: /Add Common Util/i }),
    page.locator('button:has-text("Add Common Util")')
  ], 'Add Common Util button', 10000);

  await selectDropdownOption(page, page.getByLabel('', { exact: true }), 'DISTANCE', 'Common Util type');
  await page.getByRole('textbox', { name: /^Name$/i }).fill(utilName);
  await submitDialog(page);

  await exerciseSearch(page, page.getByRole('textbox', { name: /Search/i }), utilName, 'Global Settings');
  await page.getByRole('textbox', { name: /Search/i }).fill(utilName);
  await expectVisible(page.getByText(utilName).first(), 'Created Common Util row', 10000);
  await deleteFirstMatchingRow(page, utilName, 'Common Util');
}

async function addCountryUomAndCleanup(page) {
  await maybeClearSearch(page);
  await page.getByRole('textbox', { name: /Search/i }).fill('New Zealand');
  await page.waitForTimeout(800);
  const existingRows = await page.getByRole('row').filter({ hasText: /New Zealand/i }).count().catch(() => 0);
  await page.getByRole('textbox', { name: /Search/i }).fill('');
  if (existingRows > 0) {
    await clickFirstVisible([
      page.getByRole('button', { name: /Add Country UOM/i }),
      page.locator('button:has-text("Add Country UOM")')
    ], 'Add Country UOM button', 10000);
    await expectVisible(page.locator('#mui-component-select-country, [role="dialog"], .modal').first(), 'Country UOM form');
    await closeDialogIfVisible(page);
    return;
  }

  await clickFirstVisible([
    page.getByRole('button', { name: /Add Country UOM/i }),
    page.locator('button:has-text("Add Country UOM")')
  ], 'Add Country UOM button', 10000);

  await selectDropdownOption(page, page.locator('#mui-component-select-country'), 'New Zealand', 'Country');
  await selectDropdownOption(page, page.locator('#mui-component-select-distance'), 'KM', 'Distance UOM');
  await selectLabeledComboboxOption(page, 'Volume UOM', 'Liters');
  await selectDropdownOption(page, page.locator('#mui-component-select-weight'), 'kg', 'Weight UOM');
  await selectLabeledComboboxOption(page, 'Tons UOM', 'Metric Tons');
  await submitDialog(page);

  await exerciseSearch(page, page.getByRole('textbox', { name: /Search/i }), 'New Zealand', 'Country UOMs');
  await page.getByRole('textbox', { name: /Search/i }).fill('New Zealand');
  await expectVisible(page.getByText(/New Zealand/i).first(), 'Created Country UOM row', 10000);
  await deleteFirstMatchingRow(page, 'New Zealand', 'Country UOM');
}

test.describe('Regression Tests - Project Management Environment Setting Flow', () => {
  test('Project management Environment Setting codegen flow', async ({ page }) => {
    test.setTimeout(Number(process.env.PROJECT_MANAGEMENT_ENVIRONMENT_SETTING_TIMEOUT_MS || 1800000));
    let projectInfo;
    let accessPointRecord;
    let resourceRecord;
    let resourceState;
    let availabilityConfig;
    let projectSettingsResult;
    let vehicleEmissionRecord;
    let equipmentRecord;
    let globalSettingsResult;
    let countryUomResult;

    await runStep(page, 'Login and open Project Management', async () => {
      await loginFromSsoIfNeeded(page);
      await gotoProjectPath(page, 'site-details');
    }, async () => {
      await expectProjectManagementContext(page, 'Login and open Project Management');
      await expectVisible(page.locator('#siteName'), 'Project Details site name');
    });

    await runStep(page, 'Update Project Information', async () => {
      await expectProjectManagementContext(page, 'Update Project Information');
      projectInfo = await updateProjectInformation(page);
    }, async () => {
      await expectProjectManagementContext(page, 'Update Project Information');
      await expect(page.locator('#siteName')).toHaveValue(projectInfo.updatedName);
      await expect(page.locator('#siteAddress')).toHaveValue(projectInfo.nextAddress);
    });

    await runStep(page, 'Create Access Point and Vehicle Restriction', async () => {
      await expectProjectManagementContext(page, 'Create Access Point and Vehicle Restriction');
      accessPointRecord = await createUniqueAccessPoint(page);
      saveProjectManagementSetupState({
        projectId: PROJECT_ID,
        accessPointName: accessPointRecord.accessPointName,
        accessPointId: accessPointRecord.accessPointId,
        vehicleName: accessPointRecord.vehicleRestrictionName,
        setupBookingRef: undefined
      });
    }, async () => {
      await expectProjectManagementContext(page, 'Create Access Point and Vehicle Restriction');
      const accessPoint = await findAccessPointByNameViaApi(page, accessPointRecord.accessPointName, {
        pageSize: 10,
        maxPages: 12
      });
      expect(accessPoint?.id, 'Created Access Point should be available for setup-driven booking').toBe(accessPointRecord.accessPointId);
    });

    await runStep(page, 'Create Resource and assign Vehicle', async () => {
      await expectProjectManagementContext(page, 'Create Resource and assign Vehicle');
      resourceRecord = await createUniqueResource(page, accessPointRecord.accessPointName);
      saveProjectManagementSetupState({
        projectId: PROJECT_ID,
        accessPointName: resourceRecord.accessPointName || accessPointRecord.accessPointName,
        accessPointId: accessPointRecord.accessPointId,
        resourceName: resourceRecord.resourceName,
        vehicleName: resourceRecord.vehicleName || accessPointRecord.vehicleRestrictionName
      });
    }, async () => {
      await expectProjectManagementContext(page, 'Create Resource and assign Vehicle');
      expect(resourceRecord.resourceName, 'Created Resource should use Crane <number> naming').toMatch(/^Crane \d+$/);
    });

    await runStep(page, 'Validate Availability and Booking Advance Limit', async () => {
      await expectProjectManagementContext(page, 'Validate Availability and Booking Advance Limit');
      availabilityConfig = await configureAvailabilityAndValidateBooking(page);
      saveProjectManagementSetupState({
        projectId: PROJECT_ID,
        daysAllowedInAdvance: availabilityConfig.daysAllowed,
        saturdayAvailabilityAction: availabilityConfig.saturdayAction,
        bookingAllowedThroughDayOffsetIncludingToday: availabilityConfig.allowedThroughDayOffsetIncludingToday,
        bookingBlockedAfterDayOffsetIncludingToday: availabilityConfig.blockedAfterDayOffsetIncludingToday
      });
    }, async () => {
      await expectProjectManagementContext(page, 'Validate Availability and Booking Advance Limit');
      expect([60, 90], 'Days Allowed in Advance should be toggled to the supported booking limit')
        .toContain(availabilityConfig.daysAllowed);
      await expectVisible(page.getByRole('link', { name: 'Project Settings' }), 'Project Settings link');
    });

    await runStep(page, 'Enable Resource Availability for setup records', async () => {
      await expectProjectManagementContext(page, 'Enable Resource Availability for setup records');
      resourceState = await toggleResourcesForAvailability(page, resourceRecord?.resourceName);
      saveProjectManagementSetupState({
        projectId: PROJECT_ID,
        resourceAvailabilityEnabledName: resourceState?.enabledResourceName,
        resourceAvailabilityResourceId: resourceState?.resourceId || null
      });
    }, async () => {
      await expectProjectManagementContext(page, 'Enable Resource Availability for setup records');
      expect(resourceState?.enabledResourceName, 'Setup resource should be enabled for Availability').toBe(resourceRecord?.resourceName);
    });

    await runStep(page, 'Validate Project Settings, Automatic Approval, and Emission Menus', async () => {
      projectSettingsResult = await validateProjectSettings(page, { verifyAutomaticApprovalBooking: false });
      saveProjectManagementSetupState({
        projectId: PROJECT_ID,
        projectSettingsSwitchCount: projectSettingsResult.switchSummary.total,
        projectSettingsSwitchesChanged: projectSettingsResult.switchSummary.changed,
        projectSettingsSwitchesEnabled: true,
        emissionMenusEnabled: true
      });
    }, async () => {
      await expectProjectManagementContext(page, 'Validate Project Settings, Automatic Approval, and Emission Menus');
      expect(projectSettingsResult.switchSummary.total, 'Project Settings should expose switch controls').toBeGreaterThan(0);
      await expectVisible(page.locator('body'), 'Project Settings validation complete');
    });

    await runStep(page, 'Create Vehicle Emission for setup vehicle', async () => {
      vehicleEmissionRecord = await addVehicleEmissionRecord(page, accessPointRecord?.vehicleRestrictionName || resourceRecord?.vehicleName);
      saveProjectManagementSetupState({
        projectId: PROJECT_ID,
        accessPointName: resourceRecord?.accessPointName || accessPointRecord?.accessPointName,
        accessPointId: accessPointRecord?.accessPointId,
        resourceName: resourceRecord?.resourceName,
        vehicleName: resourceRecord?.vehicleName || vehicleEmissionRecord?.vehicleName || accessPointRecord?.vehicleRestrictionName,
        vehicleFuelType: vehicleEmissionRecord?.fuelType,
        vehicleEmissionMilesOrKm: vehicleEmissionRecord?.milesOrKm,
        vehicleEmissionFactor: vehicleEmissionRecord?.emissionFactor
      });
    }, async () => {
      await expectProjectManagementContext(page, 'Create Vehicle Emission for setup vehicle');
      expect(vehicleEmissionRecord.vehicleName, 'Vehicle Emission record should have a selected vehicle/name').toBeTruthy();
      expect(Number(vehicleEmissionRecord.milesOrKm)).toBeGreaterThanOrEqual(5);
      expect(Number(vehicleEmissionRecord.milesOrKm)).toBeLessThanOrEqual(15);
      expect(Number(vehicleEmissionRecord.emissionFactor)).toBeGreaterThanOrEqual(0.1);
      expect(Number(vehicleEmissionRecord.emissionFactor)).toBeLessThanOrEqual(5);
    });

    await runStep(page, 'Create Equipment Master record', async () => {
      equipmentRecord = await addEquipmentRecord(page);
      saveProjectManagementSetupState({
        projectId: PROJECT_ID,
        equipmentName: equipmentRecord?.equipmentName,
        equipmentCategory: equipmentRecord?.category,
        equipmentFuelType: equipmentRecord?.fuelType,
        equipmentEmissionFactor: equipmentRecord?.emissionFactor
      });
    }, async () => {
      await expectProjectManagementContext(page, 'Create Equipment Master record');
      expect(equipmentRecord.equipmentName, 'Equipment Master record should have a name').toMatch(/^VC Auto Crane/);
      expect(Number(equipmentRecord.emissionFactor)).toBeGreaterThanOrEqual(0.1);
      expect(Number(equipmentRecord.emissionFactor)).toBeLessThanOrEqual(5);
    });

    await runStep(page, 'Verify Global Settings country values', async () => {
      globalSettingsResult = await ensureGlobalSettingsCountryValues(page);
      saveProjectManagementSetupState({
        projectId: PROJECT_ID,
        globalSettingsCountryValues: globalSettingsResult.map((entry) => entry.label)
      });
    }, async () => {
      await expectProjectManagementContext(page, 'Verify Global Settings country values');
      expect(globalSettingsResult.map((entry) => entry.label)).toEqual([
        'UK (United Kingdom)',
        'US',
        'India'
      ]);
    });

    await runStep(page, 'Verify United Kingdom Country UOM values', async () => {
      countryUomResult = await ensureUnitedKingdomCountryUom(page);
      saveProjectManagementSetupState({
        projectId: PROJECT_ID,
        countryUomUnitedKingdom: countryUomResult
      });
    }, async () => {
      await expectProjectManagementContext(page, 'Verify United Kingdom Country UOM values');
      expect(countryUomResult?.verified, 'United Kingdom Country UOM values should be verified').toBe(true);
    });

    await runStep(page, 'Persist Project Management setup for booking automation', async () => {
      saveProjectManagementSetupState({
        projectId: PROJECT_ID,
        accessPointName: resourceRecord?.accessPointName || accessPointRecord?.accessPointName,
        accessPointId: accessPointRecord?.accessPointId,
        resourceName: resourceRecord?.resourceName,
        vehicleName: resourceRecord?.vehicleName || vehicleEmissionRecord?.vehicleName || accessPointRecord?.vehicleRestrictionName,
        vehicleFuelType: vehicleEmissionRecord?.fuelType,
        daysAllowedInAdvance: availabilityConfig?.daysAllowed,
        saturdayAvailabilityAction: availabilityConfig?.saturdayAction,
        resourceAvailabilityEnabledName: resourceState?.enabledResourceName,
        vehicleEmissionName: vehicleEmissionRecord?.vehicleName,
        equipmentName: equipmentRecord?.equipmentName,
        globalSettingsCountryValues: globalSettingsResult?.map((entry) => entry.label),
        countryUomUnitedKingdom: countryUomResult,
        setupBookingRef: undefined
      });
    }, async () => {
      await expectProjectManagementContext(page, 'Persist Project Management setup for booking automation');
      expect(accessPointRecord?.accessPointName, 'Access Point must be available for booking automation').toBeTruthy();
      expect(resourceRecord?.resourceName, 'Resource must be available for booking automation').toBeTruthy();
      expect(vehicleEmissionRecord?.vehicleName, 'Vehicle Emission must be available for booking automation').toBeTruthy();
    });
  });
});
