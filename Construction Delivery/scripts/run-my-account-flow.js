#!/usr/bin/env node

const path = require('path');
const { loadEnvFile } = require('../utils/env');
const { runPlaywrightFlow } = require('../utils/flow-runner');

const ROOT_DIR = path.resolve(__dirname, '..');
const RESULTS_DIR = path.join(ROOT_DIR, 'test-results');
const FLOW_KEY = 'my-account';

loadEnvFile();

runPlaywrightFlow({
  rootDir: ROOT_DIR,
  resultsDir: RESULTS_DIR,
  playwrightJsonDir: path.join(RESULTS_DIR, `${FLOW_KEY}-json`),
  specPath: 'tests/regression/my-account-functional.spec.js',
  flowKey: FLOW_KEY,
  flowName: 'My Account',
  workflow: 'my-account-preferences-validation',
  timeoutEnvName: 'MY_ACCOUNT_FLOW_TIMEOUT_MS',
  defaultTimeout: 900000,
  successFallbackSteps: [
    'Login from SSO page',
    'Open My Account from Account settings',
    'Update editable My Details values',
    'Validate My Preferences dropdown values and persistence',
    'Verify company and read-only role values'
  ]
});
