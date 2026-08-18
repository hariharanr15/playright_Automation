#!/usr/bin/env node

const path = require('path');
const { loadEnvFile } = require('../utils/env');
const { runPlaywrightFlow } = require('../utils/flow-runner');

const ROOT_DIR = path.resolve(__dirname, '..');
const RESULTS_DIR = path.join(ROOT_DIR, 'test-results');
const FLOW_KEY = 'my-organization';

loadEnvFile();
process.env.HIGHLIGHT_MS = process.env.HIGHLIGHT_MS || '350';
process.env.STEP_WAIT_MS = process.env.STEP_WAIT_MS || '600';

runPlaywrightFlow({
  rootDir: ROOT_DIR,
  resultsDir: RESULTS_DIR,
  playwrightJsonDir: path.join(RESULTS_DIR, `${FLOW_KEY}-json`),
  specPath: 'tests/regression/my-organization-functional.spec.js',
  flowKey: FLOW_KEY,
  flowName: 'My Organization',
  workflow: 'my-organization-validation',
  timeoutEnvName: 'MY_ORGANIZATION_FLOW_TIMEOUT_MS',
  defaultTimeout: 900000,
  successFallbackSteps: [
    'Login from SSO page',
    'Open My Organization from Account settings',
    'Validate My Organization detail fields',
    'Validate Users tab search and This project only'
  ]
});
