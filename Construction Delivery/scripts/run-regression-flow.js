#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadAutomationEnvironment } = require('../utils/env');
const { mandatoryCompleteApplicationOrder } = require('../config/suite-map');
const { clearProjectManagementSetupState } = require('../utils/project-management-setup-state');

const ROOT_DIR = path.resolve(__dirname, '..');
const REGRESSION_DIR = path.join(ROOT_DIR, 'tests', 'regression');
const SETUP_SPEC = path.join(REGRESSION_DIR, 'Project management_EnvironmentSetting.spec.js');
const SINGLE_SESSION_SPEC = 'full-regression-single-session.spec.js';

function testFilePattern(filePath) {
  const fileName = path.basename(filePath);
  if (/Project management_EnvironmentSetting/i.test(fileName)) {
    return 'EnvironmentSetting';
  }
  if (/VC_Superadmin_Project Creation/i.test(fileName)) {
    return 'VC_Superadmin';
  }

  return fileName;
}

function parseArgs() {
  const rawArgs = process.argv.slice(2);
  const dryRun = rawArgs.includes('--dry-run');
  const headless = rawArgs.includes('--headless');
  const headed = rawArgs.includes('--headed') || !headless;
  const passthrough = rawArgs.filter((arg) => !['--dry-run', '--headless', '--headed'].includes(arg));

  return { dryRun, headed, passthrough };
}

function regressionSpecs() {
  const ordered = mandatoryCompleteApplicationOrder
    .flatMap((item) => item.regression)
    .filter(Boolean)
    .map((filePath) => path.resolve(ROOT_DIR, filePath));
  const missing = ordered.filter((filePath) => !fs.existsSync(filePath));

  if (missing.length) {
    throw new Error(`Mandatory regression order references missing specs: ${missing.join(', ')}`);
  }

  const setup = testFilePattern(ordered.find((filePath) => path.resolve(filePath) === path.resolve(SETUP_SPEC)) || ordered[0]);
  const remaining = ordered
    .filter((filePath) => testFilePattern(filePath) !== setup)
    .map(testFilePattern);

  return { setup, remaining };
}

function runPlaywright(files, options) {
  const executable = 'npx';
  const projectArg = process.platform === 'win32' ? '--project="Google Chrome"' : '--project=Google Chrome';
  const args = [
    'playwright',
    'test',
    ...files,
    projectArg,
    '--workers=1',
    ...options.passthrough
  ];
  if (options.headed) {
    args.push('--headed');
  }

  console.log(`\n${executable} ${args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg)).join(' ')}`);

  if (options.dryRun) {
    return 0;
  }

  const result = spawnSync(executable, args, {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      PLAYWRIGHT_HEADLESS: options.headed ? process.env.PLAYWRIGHT_HEADLESS : 'true',
      PLAYWRIGHT_JSON_OUTPUT_NAME: process.env.REGRESSION_MAIN_JSON_OUTPUT_NAME ||
        process.env.REGRESSION_SETUP_JSON_OUTPUT_NAME ||
        process.env.PLAYWRIGHT_JSON_OUTPUT_NAME,
      PROJECT_MANAGEMENT_ACTION_GAP_MS: process.env.PROJECT_MANAGEMENT_ACTION_GAP_MS || '150',
      PROJECT_MANAGEMENT_ROUTE_SETTLE_MS: process.env.PROJECT_MANAGEMENT_ROUTE_SETTLE_MS || '0',
      DISABLE_AUTOMATION_VISUALS: process.env.DISABLE_AUTOMATION_VISUALS || 'true',
      HIGHLIGHT_MS: process.env.HIGHLIGHT_MS || '0',
      STEP_WAIT_MS: process.env.STEP_WAIT_MS || '0'
    },
    shell: process.platform === 'win32',
    stdio: 'inherit'
  });

  if (result.error) {
    console.error(result.error.message);
  }

  return result.status ?? 1;
}

function main() {
  const options = parseArgs();
  loadAutomationEnvironment({ rootDir: ROOT_DIR });
  const { setup, remaining } = regressionSpecs();

  console.log('Regression flow order:');
  console.log(`1. ${setup}`);
  remaining.forEach((file, index) => console.log(`${index + 2}. ${file}`));

  clearProjectManagementSetupState();
  console.log('Running the full regression order in one Playwright browser worker/session.');
  process.exit(runPlaywright([SINGLE_SESSION_SPEC], options));
}

main();
