#!/usr/bin/env node

const path = require('path');
const { loadEnvFile } = require('../utils/env');
const { runPlaywrightFlow } = require('../utils/flow-runner');

const ROOT_DIR = path.resolve(__dirname, '..');
const RESULTS_DIR = path.join(ROOT_DIR, 'test-results');
const FLOW_KEY = 'environment-reports';

loadEnvFile();

runPlaywrightFlow({
  rootDir: ROOT_DIR,
  resultsDir: RESULTS_DIR,
  playwrightJsonDir: path.join(RESULTS_DIR, `${FLOW_KEY}-json`),
  specPath: 'tests/regression/environment-reports-functional.spec.js',
  flowKey: FLOW_KEY,
  flowName: 'Environment Reports',
  workflow: 'analytics-environment-reports-validation',
  timeoutEnvName: 'ENVIRONMENT_REPORTS_FLOW_TIMEOUT_MS',
  defaultTimeout: 600000,
  successFallbackSteps: [
    'Login from SSO page',
    'Select Buckingham Palace project',
    'Open Environment Reports and apply a recorded date range',
    'Validate no-data failure after the three-year limit'
  ]
});
