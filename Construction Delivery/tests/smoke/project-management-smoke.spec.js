const {
  expect,
  openAuthenticatedDashboard,
  runStep,
  test
} = require('../support/test-base');
const { ProjectManagementPage } = require('../../pages/booking/project-management.page');

test.use({
  permissions: ['notifications']
});

test.describe('Smoke Tests - Project Management @project-management @smoke', () => {
  const projectManagementAreas = new ProjectManagementPage(null).areas;

  for (const area of projectManagementAreas) {
    test(`Project Management smoke - ${area.name} opens without changing data @project-management-smoke`, async ({ page }, testInfo) => {
      const projectManagement = new ProjectManagementPage(page);
      let result;

      await runStep(page, 'Open authenticated dashboard', async () => {
        await openAuthenticatedDashboard(page);
      }, async () => {
        await expect(page.locator('body')).toContainText(/Choose Project|Buckingham Palace|Construction Delivery|V3 Construction deliveries|Booking/i);
      });

      await runStep(page, `Open ${area.name}`, async () => {
        result = await projectManagement.openArea(area);
      }, async () => {
        await testInfo.attach(`project-management-${area.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, {
          body: JSON.stringify(result, null, 2),
          contentType: 'application/json'
        });
        expect(result.ready).toBe(true);
      });
    });
  }
});
