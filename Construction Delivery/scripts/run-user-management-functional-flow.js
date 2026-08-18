#!/usr/bin/env node

const path = require('path');
const { loadEnvFile } = require('../utils/env');
const { runPlaywrightFlow } = require('../utils/flow-runner');

const ROOT_DIR = path.resolve(__dirname, '..');
const RESULTS_DIR = path.join(ROOT_DIR, 'test-results');
const FLOW_KEY = 'user-management';

const usersArgument = process.argv.find((argument) => argument.startsWith('--users='));
process.env.USER_MANAGEMENT_USER_COUNT = usersArgument
  ? usersArgument.slice('--users='.length)
  : process.env.USER_MANAGEMENT_USER_COUNT || '1';

loadEnvFile();

runPlaywrightFlow({
  rootDir: ROOT_DIR,
  resultsDir: RESULTS_DIR,
  playwrightJsonDir: path.join(RESULTS_DIR, `${FLOW_KEY}-json`),
  specPath: 'tests/regression/user-management-functional.spec.js',
  flowKey: FLOW_KEY,
  flowName: 'User Management',
  workflow: 'user-management-functional-validation',
  timeoutEnvName: 'USER_MANAGEMENT_FLOW_TIMEOUT_MS',
  defaultTimeout: 1200000,
  successFallbackSteps: [
    'Open authenticated dashboard',
    'Navigate to User Management page',
    'Negative: validate mandatory fields and invalid email format',
    'Negative: reject duplicate roles before invite submission',
    'Positive: complete Invite Users form for configured users',
    'Positive: search User List and verify all created users are Invited',
    'Positive: re-invite newly created records while status is Invited',
    'Positive: activate created accounts through Yopmail in incognito browser contexts',
    'Positive: return to original User Management session',
    'Positive: search User List and verify all created users are Activated',
    'Positive: filter User List by Project Admin and Neuralrays',
    'Positive: change organization when an alternate is available',
    'Positive: verify the effective organization for each account',
    'Positive: verify each changed user can navigate through own login',
    'Positive: remove newly created users from project'
  ]
});
