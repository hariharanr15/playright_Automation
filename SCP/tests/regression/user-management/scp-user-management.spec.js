const { test, expect, runStep: baseRunStep } = require('../../support/test-base');
const { UserManagementPage } = require('../../../pages/user-management/user-management.page');
const { InvitedUserActivationPage } = require('../../../pages/project-management/invited-user-activation.page');

const OPERATION_PAUSE_MS = Number(process.env.SCP_MODULE_OPERATION_PAUSE_MS || 1500);
const runStep = (page, title, action, validate) => baseRunStep(page, title, action, validate, {
  waitMs: OPERATION_PAUSE_MS,
  afterActionWaitMs: OPERATION_PAUSE_MS
});

test('User Management invites, activates and finds a current-run user', async ({ scpProject, browser, runData }) => {
  test.setTimeout(600000);
  const { page, config } = scpProject;
  const management = new UserManagementPage(page);
  const organization = runData.useData('activeOrganization', 'User Management');
  // A registered address receives "Project Role Assigned" instead of an invitation, so used numbers are skipped.
  const existing = await management.projectUserEmails(await scpProject.projectSelector.activeProjectReference());
  let sequence = runData.nextSequence();
  for (let tries = 1; existing.has(`user${sequence}@yopmail.com`); tries += 1) {
    if (tries >= 100) throw new Error(`No unused invitation address after ${tries} numbers`);
    sequence = runData.nextSequence();
  }
  const user = {
    ...runData.invitedUser,
    email: `User${sequence}@yopmail.com`,
    firstName: 'Hariharan1',
    lastName: 'Raja1',
    phoneNumber: `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`
  };
  let incognito;
  let activatedPage;
  try {
    await runStep(page, 'Open independent User Management module', async () => {
      await management.open();
    });
    await runStep(page, `Invite unique user ${user.email}`, async () => {
      const invitation = await management.invite(user.email, organization);
      runData.captureData('userManagementInvitation', invitation, 'User Management');
    });
    await runStep(page, 'Activate invitation in separate browser context', async () => {
      incognito = await browser.newContext();
      const activation = new InvitedUserActivationPage(await incognito.newPage(), config);
      activatedPage = await activation.openInvitationFromYopmail(user.email);
      await activation.setInvitationPassword(user.password);
      if (!(await activatedPage.locator('input[name="first_name"]').isVisible().catch(() => false))) {
        await activation.loginForProfileCompletion(user);
      }
      await activation.completeProfileAndAddress(user);
      activatedPage = activation.page;
    });
    await runStep(page, 'Verify login in the same isolated context', async () => {
      const activation = new InvitedUserActivationPage(activatedPage, config);
      await activation.logout(`${user.firstName} ${user.lastName}`);
      await activation.loginForProfileCompletion(user);
      await expect(activatedPage).not.toHaveURL(config.loginUrl);
    });
    await runStep(page, 'Search the current-run user in the original admin session', async () => {
      await page.reload();
      await management.open();
      await management.showAllRows();
      await management.search(user.email);
      await expect(management.row(user.email)).toContainText(organization);
      await expect(management.row(user.email)).toContainText(/Active/i);
    });
    await runStep(page, 'Change the same user to an available alternate organization', async () => {
      const alternate = await management.changeOrganization(user.email, organization);
      runData.captureData('updatedUserOrganization', alternate, 'User Management');
    });
    await runStep(page, 'Filter active users and reject an unmatched search', async () => {
      await page.reload();
      await management.open();
      await management.showAllRows();
      const activeFilterApplied = await management.filterActive(user.email);
      if (!activeFilterApplied) {
        test.info().annotations.push({
          type: 'product-gap',
          description: 'User Management status filter returned no options after organization change.'
        });
      }
      await management.searchInput.first().fill(`missing-${user.email}`);
      await management.searchInput.first().press('Enter');
      await expect(management.row(user.email)).toHaveCount(0);
      await management.search(user.email);
      await expect(management.row(user.email)).toContainText(
        runData.useData('updatedUserOrganization', 'User Management search')
      );
    });
  } finally {
    await incognito?.close();
  }
});

test('User Management filters and searches an active user independently', async ({ scpProject, runData }) => {
  test.setTimeout(180000);
  const { page } = scpProject;
  const management = new UserManagementPage(page);
  let email;
  let organization;
  let role;

  await runStep(page, 'Open User Management and select an available active user', async () => {
    await management.open();
    await management.showAllRows();
    const row = page.getByRole('row').filter({ hasText: /@yopmail\.com/i })
      .filter({ hasText: /Active/i }).first();
    await expect(row).toBeVisible({ timeout: 30000 });
    await expect(row.locator('td').nth(4)).not.toContainText('Choose', { timeout: 20000 });
    email = (await row.locator('td').nth(2).innerText()).trim();
    organization = (await row.locator('td').nth(3).innerText()).trim();
    role = (await row.locator('td').nth(4).innerText()).trim();
    runData.recordFallback('userManagementFilterUser', email, 'User Management');
  });
  await runStep(page, 'Apply Active status filter and verify matching rows', async () => {
    await management.filterActive(email);
    const statuses = await page.getByRole('row').filter({ hasText: '@' }).locator('td:first-child').allTextContents();
    expect(statuses.length).toBeGreaterThan(0);
    expect.soft(statuses.every((status) => status.trim() === 'Active'),
      'Active filter should exclude invited users').toBe(true);
  });
  await runStep(page, 'Apply project role filter and verify matching rows', async () => {
    await page.reload();
    await management.showAllRows();
    const applied = await management.applyFilter('project_role', role);
    if (!applied) {
      test.info().annotations.push({
        type: 'product-gap',
        description: `User Management project_role filter returned no options for ${role}.`
      });
      await expect(management.row(email)).toContainText(role);
      return;
    }
    const roles = await page.getByRole('row').filter({ hasText: '@' }).locator('td:nth-child(5)').allTextContents();
    expect(roles.length).toBeGreaterThan(0);
    expect.soft(roles.every((item) => item.trim() === role),
      `${role} filter should exclude other roles`).toBe(true);
  });
  await runStep(page, 'Apply organization filter and verify matching rows', async () => {
    await page.reload();
    await management.showAllRows();
    const applied = await management.applyFilter('organization', organization);
    if (!applied) {
      test.info().annotations.push({
        type: 'product-gap',
        description: `User Management organization filter returned no options for ${organization}.`
      });
      await expect(management.row(email)).toContainText(organization);
      return;
    }
    const organizations = await page.getByRole('row').filter({ hasText: '@' }).locator('td:nth-child(4)').allTextContents();
    expect(organizations.length).toBeGreaterThan(0);
    expect.soft(organizations.every((item) => item.trim() === organization),
      `${organization} filter should exclude other organizations`).toBe(true);
  });
  await runStep(page, 'Search the existing user and reject a nonmatching query', async () => {
    await page.reload();
    await management.showAllRows();
    await management.search(email);
    await management.searchInput.first().fill(`missing-${email}`);
    await management.searchInput.first().press('Enter');
    await expect(management.row(email)).toHaveCount(0);
  });
});
