#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PLAYWRIGHT_CLI = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
const playwrightArgs = process.argv.slice(2);
const startedAt = Date.now() - 1000;

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
    cwd: ROOT
  });
  if (result.error) console.error(result.error);
  return result.status ?? 1;
}

const testExitCode = run(process.execPath, [PLAYWRIGHT_CLI, 'test', ...playwrightArgs]);
const reportExitCode = run(process.execPath, ['scripts/generate-scp-report.js']);
const pageReportExitCode = run(process.execPath, ['scripts/generate-page-report.js', String(startedAt)]);

process.exit(reportExitCode !== 0 ? reportExitCode : pageReportExitCode !== 0 ? pageReportExitCode : testExitCode);
