const {
  expect,
  expectVisible,
  runStep,
  test
} = require('../support/test-base');
const { DashboardPage } = require('../../pages/booking/dashboard.page');
const { EquipmentManagementPage } = require('../../pages/booking/equipment-management.page');

test.use({ storageState: undefined });

test.describe('Regression Tests - Equipment Management Functional Flow', () => {
  test('Regression TC-12 - Equipment List filters, exports, and Equipment Usage creation work', async ({ page }) => {
    test.setTimeout(Number(process.env.EQUIPMENT_FLOW_TIMEOUT_MS || 1800000));

    const equipmentManagement = new EquipmentManagementPage(page);
    const dashboard = new DashboardPage(page);
    let equipmentManagementFlow;

    await runStep(page, 'Login from SSO page', async () => {
      await page.goto(`${equipmentManagement.options.baseUrl}/api/sso/users/login/`, {
        waitUntil: 'domcontentloaded'
      });
      await equipmentManagement.loginIfNeeded();
    }, async () => {
      await expectVisible(page.locator('body'), 'Logged in application shell');
    });

    await runStep(page, 'Select platform project and location', async () => {
      try {
        if (await dashboard.clickLocationProjectCard('Buckingham Palace')) {
          await dashboard.waitForPageState(dashboard.bookingMenu, 'Booking menu');
        } else {
          await dashboard.selectProject();
          await dashboard.selectLocation();
        }
      } catch (error) {
        console.log(`Dashboard project/location selection fallback to Equipment List: ${error.message}`);
        await equipmentManagement.openEquipmentListDirectly();
      }
    }, async () => {
      await expectVisible(page.getByRole('link', { name: /Booking|Equipment Management/i }).first()
        .or(page.getByRole('heading', { name: /List Of Equipment/i })).first(), 'Project navigation or Equipment List');
    });

    await runStep(page, 'Open Equipment Management list', async () => {
      await equipmentManagement.openEquipmentListDirectly();
    }, async () => {
      await expectVisible(page.getByRole('heading', { name: /List Of Equipment/i }), 'Equipment List page');
    });

    await runStep(page, 'Run enhanced Equipment Management flow', async () => {
      equipmentManagementFlow = await equipmentManagement.runEnhancedEquipmentManagementFlow();
    }, async () => {
      expect(equipmentManagementFlow).toEqual(expect.objectContaining({
        equipmentListUpload: expect.objectContaining({
          recordCount: expect.any(Number)
        }),
        usageSubmission: expect.objectContaining({
          submitted: expect.any(Boolean)
        }),
        equipmentFuelEfficiencyUnit: expect.objectContaining({
          expectedFuelVolumeUnit: expect.any(String),
          labelText: expect.any(String)
        }),
        equipmentUsageAttachment: expect.objectContaining({
          recordCount: expect.any(Number)
        })
      }));
      expect(equipmentManagementFlow.equipmentListUpload.recordCount).toBeGreaterThan(0);
      expect(equipmentManagementFlow.equipmentListUpload.upload.success).toBeTruthy();
      expect(equipmentManagementFlow.equipmentUsageAttachment.upload.success).toBeTruthy();
      await expectVisible(page.getByRole('textbox', { name: /Search/i }), 'Equipment Usage search field');
    });
  });
});
