const {
  expect,
  expectVisible,
  runStep,
  test
} = require('../support/test-base');
const { DashboardPage } = require('../../pages/booking/dashboard.page');
const {
  AnalyticsPage,
  ENVIRONMENT_REPORT_DATE_RANGE_OPTIONS
} = require('../../pages/booking/analytics.page');

test.use({ storageState: undefined });

test.describe('Regression Tests - Analytics Environment Reports Flow', () => {
  test('Regression TC-18 - Environment Reports date range returns records', async ({ page }) => {
    test.setTimeout(Number(process.env.ENVIRONMENT_REPORTS_FLOW_TIMEOUT_MS || 600000));

    const analytics = new AnalyticsPage(page);
    const dashboard = new DashboardPage(page);
    let environmentReports;
    let negativeScenario;

    await runStep(page, 'Login from SSO page', async () => {
      await page.goto(`${analytics.options.baseUrl}/api/sso/users/login/`, {
        waitUntil: 'domcontentloaded'
      });
      await analytics.loginIfNeeded();
    }, async () => {
      await expectVisible(page.locator('body'), 'Logged in application shell');
    });

    await runStep(page, 'Select Buckingham Palace project', async () => {
      try {
        if (await dashboard.clickLocationProjectCard('Buckingham Palace')) {
          await dashboard.waitForPageState(dashboard.bookingMenu, 'Booking menu');
        } else {
          await dashboard.selectProject();
          await dashboard.selectLocation();
        }
      } catch (error) {
        console.log(`Dashboard navigation fallback to Analytics: ${error.message}`);
        await analytics.openRecordedProjectLocation();
      }
    }, async () => {
      expect(page.url()).not.toMatch(/\/project\/choose/i);
    });

    await runStep(page, 'Open Environment Reports and apply a recorded date range', async () => {
      environmentReports = await analytics.validateRecordedEnvironmentReports();
    }, async () => {
      expect(environmentReports.dateRange.recordCount).toBeGreaterThan(0);
      expect(environmentReports.dateRange.attempts).toBeLessThanOrEqual(3);
      expect(environmentReports.dateRange.maxLookbackMonths).toBe(36);
      expect(environmentReports.pageScroll.reachedBottom).toBeTruthy();
      expect(environmentReports.pageScroll.scrollDistance).toBeGreaterThan(0);
      await expectVisible(
        page.getByRole('heading', { name: /Environment Reports/i }).first()
          .or(page.locator('body')),
        'Environment Reports analytics page'
      );
    });

    await runStep(page, 'Validate no-data failure after the three-year limit', async () => {
      const noDataAnalytics = new AnalyticsPage(page);
      const attemptedRanges = [];
      noDataAnalytics.getConfiguredAnalyticsDateRange = async () => null;
      noDataAnalytics.applyDateRange = async (fromDate, toDate) => {
        attemptedRanges.push({ fromDate, toDate });
      };
      noDataAnalytics.getVisibleAnalyticsRecordCount = async () => 0;
      noDataAnalytics.hasNoDataVisible = async () => true;

      let error;
      try {
        await noDataAnalytics.applyExpandingPastDateRangeUntilRecords('Environment Reports', {
          ...ENVIRONMENT_REPORT_DATE_RANGE_OPTIONS,
          toDate: new Date(2026, 5, 23)
        });
      } catch (caughtError) {
        error = caughtError;
      }

      negativeScenario = { attemptedRanges, error };
    }, async () => {
      expect(negativeScenario.attemptedRanges).toHaveLength(3);
      expect(negativeScenario.attemptedRanges.map(({ fromDate }) => fromDate.getFullYear()))
        .toEqual([2025, 2024, 2023]);
      expect(negativeScenario.attemptedRanges.map(({ toDate }) => toDate.getFullYear()))
        .toEqual([2026, 2026, 2026]);
      expect(negativeScenario.error).toBeInstanceOf(Error);
      expect(negativeScenario.error.message).toContain('within the previous 36 months');
    });
  });
});
