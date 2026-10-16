#!/usr/bin/env node

const { spawnSync } = require('child_process');

const headed = process.argv.includes('--headed');
const startedAt = Date.now() - 1000;
const suites = [
  ['Project Management', 'scripts/run-cucumber-and-report.js', ['--profile', 'projectManagement', headed ? '--headed' : '--headless']],
  ['Playwright', 'scripts/run-and-report.js', ['--workers=1']]
];

let failed = false;
for (const [name, script, args] of suites) {
  console.log(`\nRunning ${name} in Chrome...`);
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: require('path').resolve(__dirname, '..'),
    env: { ...process.env, PLAYWRIGHT_HEADLESS: headed ? 'false' : 'true' },
    stdio: 'inherit'
  });
  if (result.error) console.error(`${name}: ${result.error.message}`);
  if (result.status !== 0) failed = true;
}

const report = spawnSync(process.execPath, ['scripts/generate-page-report.js', String(startedAt)], {
  cwd: require('path').resolve(__dirname, '..'),
  stdio: 'inherit'
});
if (report.error) console.error(`Page report: ${report.error.message}`);
if (report.status !== 0) failed = true;

process.exitCode = failed ? 1 : 0;
