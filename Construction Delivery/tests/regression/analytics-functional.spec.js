const {
  expect,
  expectVisible,
  runStep,
  test
} = require('../support/test-base');
const fs = require('fs');
const path = require('path');
const { DashboardPage } = require('../../pages/booking/dashboard.page');
const { AnalyticsPage } = require('../../pages/booking/analytics.page');

test.use({ storageState: undefined });

const UOM_EVIDENCE_PATH = path.resolve(__dirname, '..', '..', 'test-results', 'analytics-uom-protocol-latest.json');

function writeUomEvidence(evidence) {
  fs.mkdirSync(path.dirname(UOM_EVIDENCE_PATH), { recursive: true });
  fs.writeFileSync(UOM_EVIDENCE_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    ...evidence
  }, null, 2), 'utf8');
}

test.describe('Regression Tests - Analytics Functional Flow', () => {
  test('Regression TC-13 - Analytics emissions honor date range and configured UOM', async ({ page }, testInfo) => {
    test.setTimeout(Number(process.env.ANALYTICS_FLOW_TIMEOUT_MS || 900000));

    const analytics = new AnalyticsPage(page);
    const dashboard = new DashboardPage(page);
    let projectConfiguration;
    let summaryEmission;
    let vehicleEmission;
    let vehicleSearch;
    let vehicleDownload;
    let equipmentEmission;
    let equipmentSearch;
    let equipmentDownload;
    let environmentReports;
    const analyticsUomProtocol = {
      projectConfiguration: null,
      analyticsSections: [],
      issues: []
    };
    const uomIssues = [];

    const recordSectionUomEvidence = async (sectionName, protocolEvidence = null) => {
      const evidence = protocolEvidence || await analytics.validateAnalyticsUomProtocol(sectionName, projectConfiguration)
        .catch((error) => ({
          sectionName,
          country: projectConfiguration?.country || null,
          countryUom: projectConfiguration?.countryUom || null,
          checks: [],
          issue: error.message
        }));
      analyticsUomProtocol.analyticsSections = analyticsUomProtocol.analyticsSections
        .filter((section) => section.sectionName !== sectionName);
      analyticsUomProtocol.analyticsSections.push(evidence);
      for (let index = uomIssues.length - 1; index >= 0; index -= 1) {
        if (uomIssues[index].sectionName === sectionName) {
          uomIssues.splice(index, 1);
        }
      }
      for (const check of evidence.checks || []) {
        if (/mismatch|missing-unit/i.test(check.status || '')) {
          uomIssues.push({
            sectionName,
            metric: check.metric,
            expectedUnit: check.expectedUnit,
            status: check.status,
            issue: check.issue
          });
        }
      }
      analyticsUomProtocol.issues = uomIssues;
      writeUomEvidence(analyticsUomProtocol);
      return evidence;
    };

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
        console.log(`Dashboard project/location selection fallback to Analytics project context: ${error.message}`);
        await analytics.openRecordedProjectLocation();
      }
    }, async () => {
      expect(page.url()).not.toMatch(/\/project\/choose/i);
      if (new RegExp(`/${analytics.options.projectId}(?:/|$)`).test(page.url())) {
        return;
      }
      await expectVisible(
        page.getByRole('link', { name: /Booking|Equipment Management|Analytics/i }).first()
          .or(page.getByRole('heading', { name: /Summary Emission|Vehicle Emissions|Equipment Emissions|Environment Reports/i })).first(),
        'Buckingham Palace project navigation'
      );
    });

    await runStep(page, 'Verify project details and derive Country UOM', async () => {
      projectConfiguration = await analytics.readProjectUomConfigurationProtocol();
      analyticsUomProtocol.projectConfiguration = projectConfiguration.uomProtocolEvidence;
      writeUomEvidence(analyticsUomProtocol);
    }, async () => {
      expect(projectConfiguration).toEqual(expect.objectContaining({
        expectedUnits: expect.objectContaining({
          distanceUnit: expect.any(String),
          volumeUnit: expect.any(String),
          weightUnit: expect.any(String),
          tonsUnit: expect.any(String),
          emissionUnit: expect.any(String)
        })
      }));
    });

    await runStep(page, 'Validate Summary Emission analytics date range and download', async () => {
      summaryEmission = await analytics.validateRecordedSummaryEmission();
    }, async () => {
      expect(summaryEmission.dateRange.recordCount).toBeGreaterThan(0);
      await expectVisible(page.locator('body'), 'Summary Emission analytics page');
    });

    await runStep(page, 'Validate Vehicle Emission analytics units and records', async () => {
      try {
        vehicleEmission = await analytics.validateEmissionSection('Vehicle Emissions', projectConfiguration);
        await recordSectionUomEvidence('Vehicle Emissions', vehicleEmission.unitValidation.protocolEvidence);
      } catch (error) {
        await recordSectionUomEvidence('Vehicle Emissions');
        throw error;
      }
      vehicleSearch = await analytics.searchAndClearSection('Vehicle Emissions', 'neuralrays');
      vehicleDownload = await analytics.downloadCurrentSection('Vehicle Emissions');
    }, async () => {
      if (!vehicleEmission.dateRange.noRecords) {
        expect(vehicleEmission.dateRange.recordCount).toBeGreaterThan(0);
      }
      expect(vehicleEmission.unitValidation.distanceLabel).toMatch(projectConfiguration.expectedUnits.distancePattern);
      expect(vehicleEmission.unitValidation.emissionLabel).toMatch(projectConfiguration.expectedUnits.emissionPattern);
      expect(vehicleSearch.searched).toBeTruthy();
      await expectVisible(page.locator('body'), 'Vehicle Emission analytics page');
    });

    await runStep(page, 'Validate Equipment Emission analytics units and records', async () => {
      try {
        equipmentEmission = await analytics.validateEmissionSection('Equipment Emissions', projectConfiguration);
        await recordSectionUomEvidence('Equipment Emissions', equipmentEmission.unitValidation.protocolEvidence);
      } catch (error) {
        await recordSectionUomEvidence('Equipment Emissions');
        throw error;
      }
      equipmentSearch = await analytics.searchAndClearSection('Equipment Emissions', 'july');
      equipmentDownload = await analytics.downloadCurrentSection('Equipment Emissions');
    }, async () => {
      expect(equipmentEmission.dateRange.recordCount).toBeGreaterThan(0);
      expect(equipmentEmission.dateRange.attempts).toBeLessThanOrEqual(5);
      expect(equipmentEmission.dateRange.maxLookbackMonths).toBe(24);
      if (!/not present/i.test(equipmentEmission.unitValidation.distanceLabel)) {
        expect(equipmentEmission.unitValidation.distanceLabel).toMatch(projectConfiguration.expectedUnits.distancePattern);
      }
      expect(equipmentEmission.unitValidation.emissionLabel).toMatch(projectConfiguration.expectedUnits.emissionPattern);
      expect(equipmentSearch.searched).toBeTruthy();
      await expectVisible(page.locator('body'), 'Equipment Emission analytics page');
    });

    await runStep(page, 'Validate Environment Reports analytics date range', async () => {
      environmentReports = await analytics.validateRecordedEnvironmentReports();
    }, async () => {
      expect(environmentReports.dateRange.recordCount).toBeGreaterThan(0);
      expect(environmentReports.dateRange.attempts).toBeLessThanOrEqual(3);
      expect(environmentReports.dateRange.maxLookbackMonths).toBe(36);
      expect(environmentReports.pageScroll.reachedBottom).toBeTruthy();
      expect(environmentReports.pageScroll.scrollDistance).toBeGreaterThan(0);
      expect(uomIssues, `Analytics UOM protocol issues: ${uomIssues.map((issue) =>
        `${issue.sectionName} ${issue.metric} ${issue.status} expected ${issue.expectedUnit}`
      ).join('; ')}`).toEqual([]);
      await expectVisible(page.locator('body'), 'Environment Reports analytics page');
    });

    await testInfo.attach('Analytics UOM protocol evidence', {
      path: UOM_EVIDENCE_PATH,
      contentType: 'application/json'
    });
  });
});
