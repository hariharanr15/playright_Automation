const { test, expect, expectVisible, openAuthenticatedDashboard, runStep } = require('../support/test-base');
const { UserManagementPage } = require('../../pages/user-management.page');

test.describe('Regression Tests - User Management Functional Flow', () => {
  test('Regression TC-11 - User Management invite, separate activation, filters, change organization, and own login validation', async ({ page }) => {
    test.setTimeout(1200000);

    const userManagement = new UserManagementPage(page, {
      preserveInviteEmails: true,
      strictUserListValidation: true
    });
    const users = userManagement.createFunctionalFlowUsers();

    await runStep(page, 'Open authenticated dashboard', async () => {
      await openAuthenticatedDashboard(page);
    }, async () => {
      await expectVisible(page.locator('body'), 'Authenticated dashboard');
    });

    await runStep(page, 'Navigate to User Management page', async () => {
      await userManagement.navigateToProjectLocation();
      await userManagement.navigateToUserManagement();
    }, async () => {
      await expectVisible(page.getByRole('button', { name: /Invite Users/i }), 'Invite Users button');
    });

    await runStep(page, 'Negative: validate mandatory fields and invalid email format', async () => {
      await userManagement.verifyInviteFormNegativeScenarios('invalid-email');
    }, async () => {
      await expectVisible(page.getByRole('button', { name: /Invite Users/i }), 'Invite Users button after validation checks');
    });

    await runStep(page, 'Negative: reject duplicate roles before invite submission', async () => {
      const duplicateRoleUsers = users.map((user) => ({ ...user }));
      duplicateRoleUsers[1].role = duplicateRoleUsers[0].role;

      expect(() => userManagement.validateInviteUserDataset(duplicateRoleUsers)).toThrow(/Duplicate role/i);
    });

    await runStep(page, 'Positive: complete Invite Users form for three users under Neuralrays', async () => {
      await userManagement.inviteFunctionalFlowUsers(users);
    }, async () => {
      await expectVisible(page.getByRole('button', { name: /Invite Users/i }), 'Invite Users button after invite submission');
    });

    await runStep(page, 'Positive: search User List and verify all created users are Invited', async () => {
      await userManagement.verifyUsersVisibleWithStatus(users, 'Invited');
    });

    await runStep(page, 'Positive: re-invite newly created records while status is Invited', async () => {
      await userManagement.resendInvitesForInvitedUsers(users);
    });

    await runStep(page, 'Positive: activate all accounts through Yopmail in incognito browser contexts', async () => {
      for (const user of users) {
        await userManagement.acceptInvitationAndCompleteAccountSetup(user);
      }
    });

    await runStep(page, 'Positive: return to original User Management session', async () => {
      await userManagement.navigateBackToUserManagementTab();
    }, async () => {
      await expectVisible(page.getByRole('button', { name: /Invite Users/i }), 'Invite Users button in original admin session');
    });

    await runStep(page, 'Positive: search User List and verify all created users are Activated', async () => {
      await userManagement.verifyUsersVisibleWithStatus(users, 'Activated');
    });

    await runStep(page, 'Positive: filter User List by Project Admin and Neuralrays', async () => {
      await userManagement.applyAndVerifyUserManagementFilters({
        role: 'Project Admin',
        organization: 'Neuralrays'
      });
    });

    await runStep(page, 'Positive: change organization for each newly created account', async () => {
      await userManagement.changeOrganizationForUsers(users);
    });

    await runStep(page, 'Positive: verify changed organization is visible for each account', async () => {
      await userManagement.verifyUsersVisibleWithStatus(users, 'Activated');
    });

    await runStep(page, 'Positive: verify each changed user can navigate through own login', async () => {
      await userManagement.verifyOwnLoginForUsers(users);
    });

    await runStep(page, 'Positive: remove newly created users from project', async () => {
      await userManagement.removeUsersFromProject(users);
    });
  });
});
