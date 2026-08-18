#!/usr/bin/env node

const path = require('path');
const { loadEnvFile } = require('../utils/env');
const { runPlaywrightFlow } = require('../utils/flow-runner');

const ROOT_DIR = path.resolve(__dirname, '..');
const RESULTS_DIR = path.join(ROOT_DIR, 'test-results');
const FLOW_KEY = 'project-settings';

loadEnvFile();
process.env.DISABLE_AUTOMATION_VISUALS = process.env.DISABLE_AUTOMATION_VISUALS || '1';
process.env.HIGHLIGHT_MS = process.env.HIGHLIGHT_MS || '0';
process.env.STEP_WAIT_MS = process.env.STEP_WAIT_MS || '0';
process.env.PROJECT_SETTINGS_SETTLE_MS = process.env.PROJECT_SETTINGS_SETTLE_MS || '500';

runPlaywrightFlow({
  rootDir: ROOT_DIR,
  resultsDir: RESULTS_DIR,
  playwrightJsonDir: path.join(RESULTS_DIR, `${FLOW_KEY}-json`),
  specPath: 'tests/regression/project-settings-tab.spec.js',
  flowKey: FLOW_KEY,
  flowName: 'Project Settings',
  workflow: 'project-settings-tab',
  timeoutEnvName: 'PROJECT_SETTINGS_TAB_TIMEOUT_MS',
  defaultTimeout: 600000,
  successFallbackSteps: [
    'Login to Construction application',
    'Open Project Setting tab',
    'Set Automatic Approval',
    'Set Emission Settings'
  ]
});
