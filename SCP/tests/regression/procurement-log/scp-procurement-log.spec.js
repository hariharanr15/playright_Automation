const path = require('path');
const { test, runStep } = require('../../support/test-base');
const { loadJsonFile } = require('../../../utils/data-loader');
const { createProcurementLogData } = require('../../../utils/dynamic-data');
const { runProcurementLogFlow } = require('../../support/procurement-log-flow');

const DATA_PATH = path.resolve(__dirname, '..', '..', '..', 'test-data', 'procurement-log.json');
const baselineData = loadJsonFile(DATA_PATH, {});

test.describe('SCP Procurement Log', () => {
  test('Admin completes the Procurement Log flow in NRVC_Hall', async ({ scpProject, runData }) => {
    test.setTimeout(900000);
    const { page, siteSelector } = scpProject;
    const data = {
      ...baselineData,
      ...createProcurementLogData(runData.runId)
    };

    await runProcurementLogFlow({
      page,
      siteSelector,
      runData,
      data,
      runStep
    });
  });
});
