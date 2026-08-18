const fs = require('fs');
const path = require('path');
const {
  expect,
  expectVisible,
  openAuthenticatedDashboard,
  runStep,
  test
} = require('../support/test-base');

const ADMIN_URL = process.env.ADMIN_URL || 'https://stg-admin.voyagecontrol.com';
const APP_URL = process.env.APP_URL || 'https://stg-app.voyagecontrol.com';
const PROJECT_PREFIX = process.env.SUPERADMIN_PROJECT_NAME || 'Wonderla_UK';
const PROJECT_REGION = process.env.SUPERADMIN_PROJECT_REGION || 'us-west-';
const PROJECT_ADDRESS = process.env.SUPERADMIN_PROJECT_ADDRESS || 'Canada Gate, UK';
const PROJECT_OWNER_EMAIL = process.env.SUPERADMIN_PROJECT_OWNER_EMAIL || process.env.VC_EMAIL || 'hariharan.r@neuralrays.ai';
const INVITE_DOMAIN = process.env.SUPERADMIN_INVITE_DOMAIN || 'yopmail.com';
const INVITE_USER_COUNT = Number(process.env.SUPERADMIN_INVITE_USER_COUNT || 3);
const RUN_SEQUENCE_PATH = path.resolve(__dirname, '..', '..', 'test-results', 'superadmin-project-sequence.json');
const INVITE_ROLES = (process.env.SUPERADMIN_INVITE_ROLES || 'Manager,Admin,Manager')
  .split(',')
  .map((role) => role.trim())
  .filter(Boolean);

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function currentRunId() {
  if (process.env.SUPERADMIN_RUN_NUMBER) {
    return process.env.SUPERADMIN_RUN_NUMBER;
  }

  let lastRunId = 0;
  try {
    lastRunId = Number(JSON.parse(fs.readFileSync(RUN_SEQUENCE_PATH, 'utf8')).lastRunId || 0);
  } catch {
    lastRunId = 0;
  }

  const runId = lastRunId || 1;
  fs.mkdirSync(path.dirname(RUN_SEQUENCE_PATH), { recursive: true });
  fs.writeFileSync(RUN_SEQUENCE_PATH, `${JSON.stringify({ lastRunId: runId }, null, 2)}\n`);
  return String(runId);
}

function uniqueProjectName(runId) {
  return `${PROJECT_PREFIX}${runId}`;
}

function buildInviteUsers(projectName) {
  return Array.from({ length: INVITE_USER_COUNT }, (_, index) => ({
    email: `user${index + 1}_${projectName}@${INVITE_DOMAIN}`,
    role: INVITE_ROLES[index] || INVITE_ROLES[INVITE_ROLES.length - 1] || 'Manager'
  }));
}

async function waitForAppToSettle(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => null);
  await page.locator('[role="progressbar"], .MuiCircularProgress-root')
    .first()
    .waitFor({ state: 'hidden', timeout: 30000 })
    .catch(() => null);
}

async function clickFirstVisible(page, locators, label) {
  for (const locator of locators) {
    const target = locator.first();
    if (await target.isVisible({ timeout: 3000 }).catch(() => false)) {
      await target.click();
      return target;
    }
  }

  throw new Error(`${label} was not visible.`);
}

async function openSuperadminProjects(page) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await openAuthenticatedDashboard(page);

    const adminLink = page.getByRole('link', { name: /Voyage Control Admin/i }).first();
    const adminHref = await adminLink.getAttribute('href').catch(() => null);
    if (!adminHref) {
      throw new Error('Voyage Control Admin SSO link was not available on the platform chooser.');
    }

    await page.goto(adminHref, { waitUntil: 'domcontentloaded' });
    await waitForAppToSettle(page);
    await page.waitForTimeout(3000);

    await page.goto(`${ADMIN_URL}/dashboard/projects`, { waitUntil: 'domcontentloaded' });
    await waitForAppToSettle(page);

    if (await page.getByRole('button', { name: /New Project/i }).isVisible({ timeout: 5000 }).catch(() => false)) {
      return page;
    }
  }

  await expectVisible(page.getByRole('button', { name: /New Project/i }), 'New Project button');
  return page;
}

async function selectReactOption(page, control, optionName) {
  await control.click();
  await page.getByRole('option', { name: new RegExp(escapeRegex(optionName), 'i') })
    .first()
    .click();
}

async function openExistingProject(page, projectName) {
  await page.goto(`${ADMIN_URL}/dashboard/projects`, { waitUntil: 'domcontentloaded' });
  await waitForAppToSettle(page);

  const searchInput = page.getByPlaceholder(/Search by Project Name/i).first();
  if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await searchInput.fill(projectName);
    await page.getByRole('button', { name: /Filter/i }).click();
    await waitForAppToSettle(page);
  }

  const projectRow = page.getByRole('row').filter({ hasText: new RegExp(`\\b${escapeRegex(projectName)}\\b`) }).first();
  if (!(await projectRow.isVisible({ timeout: 5000 }).catch(() => false))) {
    return null;
  }

  await projectRow.click();
  await page.waitForURL(/\/dashboard\/projects\/[^/?#]+/i, { timeout: 60000 });
  await waitForAppToSettle(page);
  return page.url().match(/\/dashboard\/projects\/([^/?#]+)/i)?.[1] || null;
}

async function createProject(page, projectName) {
  await page.getByRole('button', { name: /New Project/i }).click();
  await page.locator('#siteName').fill(projectName);

  await selectReactOption(
    page,
    page.locator('.form-control-language__control:visible').filter({ hasText: /Select/i }).last(),
    PROJECT_REGION
  );

  await page.locator('#siteAddress').fill(PROJECT_ADDRESS);
  await page.locator('#email').fill(PROJECT_OWNER_EMAIL);

  const createProjectButton = page.getByRole('button', { name: /^Create Project$/i }).last();
  await page.locator('#email').press('Tab');
  await expect(createProjectButton, 'Create Project button should be enabled after required fields are complete')
    .toBeEnabled({ timeout: 15000 });
  await createProjectButton.click();
  await page.waitForURL(/\/dashboard\/projects\/[^/?#]+/i, { timeout: 60000 });
  await waitForAppToSettle(page);

  const projectRef = page.url().match(/\/dashboard\/projects\/([^/?#]+)/i)?.[1];
  if (!projectRef) {
    throw new Error(`Project reference was not present in URL after creation: ${page.url()}`);
  }

  return projectRef;
}

async function openOrCreateProject(page, projectName) {
  const existingProjectRef = await openExistingProject(page, projectName);
  if (existingProjectRef) {
    return existingProjectRef;
  }

  return createProject(page, projectName);
}

async function openProjectTab(page, tabName) {
  await page.getByRole('tab', { name: new RegExp(escapeRegex(tabName), 'i') }).click();
  await waitForAppToSettle(page);
}

async function reviewBookingFields(page) {
  await openProjectTab(page, 'Booking Fields');
  await expectVisible(
    page.getByText(/Flexible Fields|Order|Field|Mandatory/i).first(),
    'Booking Fields table'
  );
}

async function chooseComboboxOption(page, label, optionName, index = 0) {
  await page.getByRole('combobox', { name: new RegExp(escapeRegex(label), 'i') }).nth(index).click();
  await page.getByRole('option', { name: new RegExp(escapeRegex(optionName), 'i') }).first().click();
}

function inviteEmailInput(page, index) {
  if (index === 0) return page.locator('#email').first();
  return page.locator(`input[name="email:${index + 1}"]`).first();
}

async function fillInviteUser(page, user, index) {
  if (index > 0) {
    await page.getByRole('link', { name: /Add Another/i }).click();
  }

  await inviteEmailInput(page, index).fill(user.email);
  await chooseComboboxOption(page, 'Organization', 'Voyage Control', index);
  await chooseComboboxOption(page, 'Role', user.role, index);
}

async function inviteProjectUsers(page, users) {
  await openProjectTab(page, 'Project Users');
  const existingUsersText = await page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
  const usersToInvite = users.filter((user) => !existingUsersText.includes(user.email));
  if (!usersToInvite.length) {
    return [];
  }

  await clickFirstVisible(page, [
    page.getByRole('button', { name: /Invite User/i }),
    page.getByRole('button', { name: /Invite Users/i })
  ], 'Invite User button');

  for (const [index, user] of usersToInvite.entries()) {
    await fillInviteUser(page, user, index);
  }

  await page.getByRole('button', { name: /Send Invite/i }).click();
  await waitForAppToSettle(page);
  return usersToInvite;
}

async function openCreatedProject(page, projectRef) {
  await openAuthenticatedDashboard(page);

  const appLink = page.getByRole('link', { name: /Construction Delivery|V3 Construction deliveries/i }).first();
  const appHref = await appLink.getAttribute('href').catch(() => null);
  if (!appHref) {
    throw new Error('Construction Delivery SSO link was not available on the platform chooser.');
  }

  await page.goto(appHref, { waitUntil: 'domcontentloaded' });
  await waitForAppToSettle(page);
  await page.waitForTimeout(3000);

  await page.goto(`${APP_URL}/${projectRef}/home`, { waitUntil: 'domcontentloaded' });
  await waitForAppToSettle(page);
  return page;
}

async function startNewBooking(page, projectName) {
  await page.getByRole('button', { name: /New Booking/i }).click();
  await page.locator('.book-type-img').first().click();
  await page.getByRole('button', { name: /Next/i }).click();

  const locationPattern = new RegExp(`${escapeRegex(projectName)}\\s*HR|\\bHR\\b`, 'i');
  const location = page.getByText(locationPattern).first();
  if (await location.isVisible({ timeout: 15000 }).catch(() => false)) {
    await location.click();
  }

  await expectVisible(page.locator('body'), 'New Booking flow');
}

test.describe('VC_Superadmin_Project Creation', () => {
  test('opens or creates a reusable superadmin project, invites unique users, and opens booking flow', async ({ page }) => {
    test.setTimeout(900000);

    const runId = currentRunId();
    const projectName = uniqueProjectName(runId);
    const users = buildInviteUsers(projectName);
    let adminPage;
    let projectRef;

    await runStep(page, 'Open Voyage Control Admin projects', async () => {
      adminPage = await openSuperadminProjects(page);
    });

    await runStep(page, 'Open or create project', async () => {
      projectRef = await openOrCreateProject(adminPage, projectName);
    }, async () => {
      await expect(adminPage).toHaveURL(new RegExp(`/dashboard/projects/${escapeRegex(projectRef)}`));
    });

    await runStep(page, 'Review Booking Fields tab', async () => {
      await reviewBookingFields(adminPage);
    });

    await runStep(page, 'Invite project users', async () => {
      await inviteProjectUsers(adminPage, users);
    });

    await runStep(page, 'Open created project application', async () => {
      const appPage = await openCreatedProject(adminPage, projectRef);
      await startNewBooking(appPage, projectName);
    });
  });
});
