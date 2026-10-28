#!/usr/bin/env node

const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const REPORT_RUNNER = path.join(ROOT, 'scripts', 'run-and-report.js');
const SPEC_PATH = 'tests/regression/procurement-log/scp-procurement-log.spec.js';

const env = {
  ...process.env,
  SCP_EXECUTION_MODE: 'demo',
  SCP_ACTION_INTERVAL_MS: process.env.PROCUREMENT_ACTION_INTERVAL_MS || '600',
  STEP_WAIT_MS: process.env.PROCUREMENT_STEP_WAIT_MS || '1000',
  HEADLESS: 'false',
  PLAYWRIGHT_HEADLESS: 'false'
};

const result = spawnSync(process.execPath, [
  REPORT_RUNNER,
  SPEC_PATH,
  '--project=Google Chrome',
  '--headed',
  '--workers=1',
  '--timeout=600000'
], {
  cwd: ROOT,
  env,
  stdio: 'inherit'
});

process.exit(result.status ?? 1);
