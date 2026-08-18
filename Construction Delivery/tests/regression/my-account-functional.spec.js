const {
  expect,
  expectVisible,
  runStep,
  test
} = require('../support/test-base');
const { MyAccountPage } = require('../../pages/booking/my-account.page');

test.use({ storageState: undefined });

test.describe('Regression Tests - My Account Preferences Flow', () => {
  test('Regression TC-14 - My Account details, preferences, and roles are validated', async ({ page }) => {
    test.setTimeout(Number(process.env.MY_ACCOUNT_FLOW_TIMEOUT_MS || 900000));

    const myAccount = new MyAccountPage(page);
    let details;
    let preferences;
    let accountAccess;

    await runStep(page, 'Login from SSO page', async () => {
      await myAccount.openAuthenticatedShell();
    }, async () => {
      await expectVisible(page.locator('body'), 'Logged in application shell');
    });

    await runStep(page, 'Open My Account from Account settings', async () => {
      await myAccount.openMyAccount();
    }, async () => {
      await expectVisible(page.getByText(/My Details|My Preferences/i).first(), 'My Account page');
    });

    await runStep(page, 'Update editable My Details values', async () => {
      details = await myAccount.updateMyDetails();
    }, async () => {
      expect(details).toEqual(expect.objectContaining({
        updateCheck: expect.objectContaining({
          firstName: expect.stringContaining(myAccount.options.updateCheckFirstName),
          lastName: expect.stringContaining(myAccount.options.updateCheckLastName)
        }),
        firstName: expect.stringContaining(myAccount.options.finalFirstName),
        lastName: expect.stringContaining(myAccount.options.finalLastName),
        phone: expect.stringContaining(myAccount.options.phone)
      }));
    });

    await runStep(page, 'Validate My Preferences dropdown values and persistence', async () => {
      preferences = await myAccount.verifyPreferenceDropdowns();
    }, async () => {
      expect(preferences.languageOptions).toEqual(expect.arrayContaining(['English', 'Japanese', 'Spanish']));
      for (const key of ['language', 'dateFormat', 'timeFormat', 'calendarStartDay']) {
        if (!preferences.selected[key]) {
          continue;
        }
        expect(preferences.persisted[key], `${key} preference should persist after reload`).toBeTruthy();
        expect(preferences.persisted[key]).not.toMatch(/^\s*select\s*\.\.\.?\s*$/i);
        expect(preferences.persisted[key]).toContain(preferences.selected[key]);
      }
    });

    await runStep(page, 'Validate My Preference values are reflected in Booking List', async () => {
      const applicationPreferences = await myAccount.verifyPreferencesAppliedAcrossApplication(preferences);

      expect(applicationPreferences.surface).toBe('booking-list');
      expect(applicationPreferences.application.dateFormatApplied).toBeTruthy();
      expect(applicationPreferences.application.timeFormatApplied).toBeTruthy();
      expect(applicationPreferences.application.calendarStartDayApplied).toBeTruthy();
      expect(applicationPreferences.confirmation).toContain('Confirmed in Booking List');
    });

    await runStep(page, 'Verify company and read-only role values', async () => {
      accountAccess = await myAccount.readCompanyAndRoles();
    }, async () => {
      expect(accountAccess.company.value, 'Company should be displayed').toBeTruthy();
      expect(accountAccess.organizationRole.value, 'Organization Role should be displayed').toBeTruthy();
      expect(accountAccess.projectRole.value, 'Project Role should be displayed').toBeTruthy();
      expect(accountAccess.organizationRole.editable, 'Organization Role should be read-only').toBeFalsy();
      expect(accountAccess.projectRole.editable, 'Project Role should be read-only').toBeFalsy();
    });
  });
});
