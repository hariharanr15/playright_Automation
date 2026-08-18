const {
  expect,
  expectVisible,
  openAuthenticatedDashboard,
  runStep,
  test
} = require('../support/test-base');
const { ProjectSettingsPage } = require('../../pages/booking/project-settings.page');

const PROJECT_ID = process.env.PROJECT_ID || process.env.BUCKINGHAM_PALACE_PROJECT_ID || '5ET10000010';

test.use({
  permissions: ['notifications']
});

function booleanFromEnv(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') {
    return fallback;
  }
  return /^(1|true|yes|on|enabled)$/i.test(raw);
}

function enabledLabel(value) {
  return value ? 'enabled' : 'disabled';
}

test.describe('Project Setting Tab Automation', () => {
  test('automates Construction Delivery or Construction FM Project Setting tab', async ({ page }) => {
    test.setTimeout(Number(process.env.PROJECT_SETTINGS_TAB_TIMEOUT_MS || 600000));

    const automaticApprovalEnabled = booleanFromEnv('PROJECT_SETTINGS_AUTOMATIC_APPROVAL_ENABLED', true);
    const emissionSettingsEnabled = booleanFromEnv('PROJECT_SETTINGS_EMISSION_SETTINGS_ENABLED', true);
    const projectSettings = new ProjectSettingsPage(page);
    let automaticApprovalResult;
    let emissionSettingsResult;

    await runStep(page, 'Open authenticated Construction application', async () => {
      await openAuthenticatedDashboard(page);
    }, async () => {
      await expect(page.locator('body')).not.toContainText(/Welcome To Voyage Control|Please log In|Login with SSO/i, {
        timeout: 10000
      });
    });

    await runStep(page, 'Open Project Setting tab', async () => {
      await projectSettings.openProjectSettingTab('Settings');
    }, async () => {
      expect(page.url(), `Project Settings URL should include project ${PROJECT_ID}`).toMatch(
        new RegExp(`/${PROJECT_ID}/settings(?:[/?#]|$)`, 'i')
      );
      await expectVisible(
        page.getByText(/Project Settings|Core Features|Automatic Approval|Automatic Approvals/i).first(),
        'Project Setting tab content',
        30000
      );
    });

    await runStep(page, `Set Automatic Approval ${enabledLabel(automaticApprovalEnabled)}`, async () => {
      automaticApprovalResult = await projectSettings.setAutomaticApprovals(automaticApprovalEnabled);
    }, async () => {
      expect(automaticApprovalResult.actual).toBe(automaticApprovalEnabled);
    });

    await runStep(page, `Set Emission Settings ${enabledLabel(emissionSettingsEnabled)}`, async () => {
      emissionSettingsResult = await projectSettings.setEmissionSettings(emissionSettingsEnabled);
    }, async () => {
      expect(emissionSettingsResult.actual).toBe(emissionSettingsEnabled);
    });
  });
});
