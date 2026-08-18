const {
  openConfiguredProjectHome,
  runStep,
  test
} = require('../support/test-base');
const { ProfileMenuComponent } = require('../../components/profile-menu.component');
const { MyAccountPage } = require('../../pages/booking/my-account.page');
const { MyOrganizationPage } = require('../../pages/booking/my-organization.page');
const { NotificationPreferencePage } = require('../../pages/booking/notification-preference.page');

test.describe('Smoke Tests - Top-right Profile Menu @profile-menu @smoke', () => {
  test('Profile menu exposes My Account, My Organisation, Notification Preferences, and Logout @profile-menu-smoke', async ({ page }) => {
    const profileMenu = new ProfileMenuComponent(page);
    const myAccount = new MyAccountPage(page);
    const myOrganization = new MyOrganizationPage(page);
    const notificationPreference = new NotificationPreferencePage(page);

    await runStep(page, 'Log in and open configured project home page', async () => {
      await openConfiguredProjectHome(page);
    });

    await runStep(page, 'Validate Profile menu items', async () => {
      await profileMenu.validateMenuItems();
    });

    await runStep(page, 'Validate My Account menu flow', async () => {
      await myAccount.openMyAccount();
      await myAccount.waitForLoaded();
    });

    await runStep(page, 'Validate My Organisation menu flow', async () => {
      await myOrganization.openMyOrganization();
      await myOrganization.waitForLoaded();
    });

    await runStep(page, 'Validate Notification Preferences menu flow', async () => {
      await notificationPreference.openNotificationPreferences();
    });

    await runStep(page, 'Validate Logout is available without logging out', async () => {
      await profileMenu.validateMenuItems();
    });
  });
});
