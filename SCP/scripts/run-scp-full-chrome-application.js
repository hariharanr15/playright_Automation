#!/usr/bin/env node

// Entire in-scope SCP application in installed Google Chrome: every Playwright smoke/regression
// spec and the in-scope Project Management Cucumber scenarios, with isolated evidence per run.
// Existing reports are never overwritten; each suite runs even when an earlier one fails.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const headless = args.includes('--headless');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const executionDir = path.resolve(ROOT, process.env.SCP_EXECUTION_DIR || path.join('reports', `full-chrome-application-${stamp}`));
if (fs.existsSync(executionDir) && fs.readdirSync(executionDir).length) {
  throw new Error(`Execution directory already has evidence: ${executionDir}`);
}
fs.mkdirSync(path.join(executionDir, 'logs'), { recursive: true });

const env = { ...process.env, SCP_EXECUTION_DIR: executionDir, HEADLESS: headless ? 'true' : 'false',
  PLAYWRIGHT_HEADLESS: headless ? 'true' : 'false', SCP_EXECUTION_MODE: 'normal' };

const suites = [
  { name: 'Playwright smoke and regression', bin: path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js'),
    args: ['test', '--config=playwright.full-chrome.config.js'] },
  { name: 'Project Management Cucumber', bin: path.join(ROOT, 'node_modules', '@cucumber', 'cucumber', 'bin', 'cucumber.js'),
    args: ['--config', 'cucumber.full-chrome.js'] }
];

const run = { application: 'Supply Chain Planner (SCP)', browser: 'Google Chrome', mode: headless ? 'headless' : 'headed',
  startedAt: new Date().toISOString(), executionDir, suites: [] };
for (const suite of suites) {
  console.log(`\nRunning ${suite.name}...`);
  const startedAt = Date.now();
  const result = spawnSync(process.execPath, [suite.bin, ...suite.args], { cwd: ROOT, env, stdio: 'inherit' });
  run.suites.push({ name: suite.name, exitCode: result.status ?? 1, durationMs: Date.now() - startedAt });
}
run.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(executionDir, 'logs', 'run.json'), JSON.stringify(run, null, 2));

const report = spawnSync(process.execPath, ['scripts/generate-scp-full-chrome-report.js', executionDir], { cwd: ROOT, env, stdio: 'inherit' });
console.log(`\nFull SCP Chrome evidence: ${executionDir}`);
process.exitCode = run.suites.some(s => s.exitCode !== 0) || report.status !== 0 ? 1 : 0;
