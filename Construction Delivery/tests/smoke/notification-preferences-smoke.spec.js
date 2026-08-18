const {
  expect,
  openAuthenticatedDashboard,
  runStep,
  test
} = require('../support/test-base');
const { NotificationPreferencePage } = require('../../pages/booking/notification-preference.page');

test.describe('Smoke Tests - Notification Preferences @notification-preferences @smoke', () => {
  test('Notification Preferences page opens without changing data @notification-preferences-smoke', async ({ page }) => {
    const notificationPreference = new NotificationPreferencePage(page);

    await runStep(page, 'Open authenticated dashboard', async () => {
      await openAuthenticatedDashboard(page);
    });

    await runStep(page, 'Open Notification Preferences', async () => {
      await notificationPreference.openNotificationPreferences();
    }, async () => {
      await expect(page.locator('body')).toContainText(/Notification Preferences|My Bookings/i);
    });
  });
});
