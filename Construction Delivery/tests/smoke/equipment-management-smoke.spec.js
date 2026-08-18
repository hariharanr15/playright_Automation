const {
  expectVisible,
  openBookingList,
  runStep,
  test
} = require('../support/test-base');
const { EquipmentManagementPage } = require('../../pages/booking/equipment-management.page');

test.describe('Smoke Tests - Equipment Management', () => {
  test('Smoke TC-04 - Equipment Management and Equipment List tab are accessible', async ({ page }) => {
    const equipmentManagement = new EquipmentManagementPage(page);

    await runStep(page, 'Open Booking List', async () => {
      await openBookingList(page);
    }, async () => {
      await expectVisible(page.getByRole('button', { name: /New Booking/i }), 'New Booking button');
    });

    await runStep(page, 'Open Equipment Management tab', async () => {
      await equipmentManagement.openEquipmentManagement();
    }, async () => {
      await expectVisible(page.getByRole('link', { name: /Equipment List/i }), 'Equipment List child tab');
    });

    await runStep(page, 'Open Equipment List child tab', async () => {
      await equipmentManagement.openEquipmentList();
    }, async () => {
      await expectVisible(page.locator('body'), 'Equipment List page');
    });

    await runStep(page, 'Apply recorded Equipment List filters', async () => {
      await equipmentManagement.applyRecordedEquipmentListFilters();
    }, async () => {
      await expectVisible(page.locator('body'), 'Filtered Equipment List page');
    });
  });
});
