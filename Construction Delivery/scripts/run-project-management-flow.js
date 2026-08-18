#!/usr/bin/env node

const path = require('path');
const { loadEnvFile } = require('../utils/env');
const { runPlaywrightFlow } = require('../utils/flow-runner');

const ROOT_DIR = path.resolve(__dirname, '..');
const RESULTS_DIR = path.join(ROOT_DIR, 'test-results');
const FLOW_KEY = 'project-management';

loadEnvFile();
process.env.DISABLE_AUTOMATION_VISUALS = process.env.DISABLE_AUTOMATION_VISUALS || '0';
process.env.HIGHLIGHT_MS = process.env.HIGHLIGHT_MS || '500';
process.env.STEP_WAIT_MS = process.env.STEP_WAIT_MS || '250';
process.env.PROJECT_MANAGEMENT_ACTION_GAP_MS = process.env.PROJECT_MANAGEMENT_ACTION_GAP_MS || '700';
process.env.PROJECT_MANAGEMENT_ROUTE_SETTLE_MS = process.env.PROJECT_MANAGEMENT_ROUTE_SETTLE_MS || '500';

runPlaywrightFlow({
  rootDir: ROOT_DIR,
  resultsDir: RESULTS_DIR,
  playwrightJsonDir: path.join(RESULTS_DIR, `${FLOW_KEY}-json`),
  specPath: 'tests/regression/Project management_EnvironmentSetting.spec.js',
  specSelector: 'Project management_EnvironmentSetting.spec.js',
  flowKey: FLOW_KEY,
  flowName: 'Project Management',
  workflow: 'project-management-environment-setting',
  timeoutEnvName: 'PROJECT_MANAGEMENT_ENVIRONMENT_SETTING_TIMEOUT_MS',
  defaultTimeout: 1800000,
  successFallbackSteps: [
    'Login and open Project Management',
    'Update Project Information',
    'Create Access Point and Vehicle Restriction',
    'Create Resource and assign Vehicle',
    'Validate Availability and Booking Advance Limit',
    'Enable Resource Availability for setup records',
    'Validate Project Settings, Automatic Approval, and Emission Menus',
    'Create Vehicle Emission for setup vehicle',
    'Create Equipment Master record',
    'Verify Global Settings country values',
    'Verify United Kingdom Country UOM values',
    'Persist Project Management setup for booking automation'
  ]
});
