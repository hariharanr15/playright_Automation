#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function copyIfPresent(source, destination) {
  if (!fs.existsSync(source)) return;
  fs.cpSync(source, destination, { recursive: true, force: true });
}

function archiveSuiteOutputs(executionDir, suite) {
  const suiteDir = path.join(executionDir, 'suites', slug(suite.name));
  fs.mkdirSync(suiteDir, { recursive: true });

  if (suite.kind === 'cucumber') {
    copyIfPresent(path.join(ROOT, 'reports', 'html'), path.join(suiteDir, 'html'));
    copyIfPresent(path.join(ROOT, 'reports', 'pdf'), path.join(suiteDir, 'pdf'));
    copyIfPresent(path.join(ROOT, 'reports', 'screenshots'), path.join(suiteDir, 'screenshots'));
    copyIfPresent(path.join(ROOT, 'reports', 'cucumber-report.json'), path.join(suiteDir, 'cucumber-report.json'));
  }

  if (suite.kind === 'playwright') {
    copyIfPresent(path.join(ROOT, 'reports', 'scp-test-summary.html'), path.join(suiteDir, 'scp-test-summary.html'));
    copyIfPresent(path.join(ROOT, 'reports', 'scp-test-summary.pdf'), path.join(suiteDir, 'scp-test-summary.pdf'));
    copyIfPresent(path.join(ROOT, 'reports', 'scp-page-report.html'), path.join(suiteDir, 'scp-page-report.html'));
    copyIfPresent(path.join(ROOT, 'test-results', 'scp-results.json'), path.join(suiteDir, 'scp-results.json'));
    copyIfPresent(path.join(ROOT, 'test-results', 'playwright-artifacts'), path.join(suiteDir, 'playwright-artifacts'));
  }
}

const args = process.argv.slice(2);
const demo = args.includes('--demo');
const headed = demo || args.includes('--headed');
const headless = args.includes('--headless') || !headed;
const executionDir = path.join(ROOT, 'reports', `execution-${timestamp()}-entire-scp`);

for (const folder of ['suites', 'html', 'pdf', 'logs', 'artifacts']) {
  fs.mkdirSync(path.join(executionDir, folder), { recursive: true });
}

const env = {
  ...process.env,
  SCP_EXECUTION_DIR: executionDir,
  SCP_EXECUTION_MODE: demo ? 'demo' : 'normal',
  PLAYWRIGHT_HEADLESS: headless ? 'true' : 'false',
  HEADLESS: headless ? 'true' : 'false'
};

const browserArgs = headed ? ['--headed'] : [];
const cucumberMode = demo ? '--demo' : headed ? '--headed' : '--headless';
const suites = [
  {
    name: 'SCP smoke navigation',
    kind: 'playwright',
    script: 'scripts/run-and-report.js',
    args: ['tests/smoke', '--project=Google Chrome', '--workers=1', ...browserArgs]
  },
  {
    name: 'Project Management end-to-end regression',
    kind: 'cucumber',
    script: 'scripts/run-cucumber-and-report.js',
    args: ['--profile', 'projectManagement', cucumberMode]
  },
  {
    name: 'SCP Playwright module regression',
    kind: 'playwright',
    script: 'scripts/run-and-report.js',
    args: ['tests/regression', '--project=Google Chrome', '--workers=1', ...browserArgs]
  }
];

const summary = {
  application: 'Supply Chain Planner (SCP)',
  project: process.env.SCP_PROJECT_NAME || 'NRVC_Hall',
  browser: 'Google Chrome',
  executionType: 'Entire SCP application',
  mode: demo ? 'demo' : headed ? 'headed' : 'headless',
  startedAt: new Date().toISOString(),
  executionDir,
  suites: []
};

let failed = false;
for (const suite of suites) {
  console.log(`\nRunning ${suite.name}...`);
  const startedAt = Date.now();
  const result = spawnSync(process.execPath, [suite.script, ...suite.args], {
    cwd: ROOT,
    env,
    stdio: 'inherit'
  });
  const exitCode = result.status ?? 1;
  summary.suites.push({
    name: suite.name,
    exitCode,
    durationMs: Date.now() - startedAt
  });
  archiveSuiteOutputs(executionDir, suite);
  if (exitCode !== 0) failed = true;
}

console.log('\nGenerating consolidated SCP application report...');
const consolidatedStartedAt = Date.now();
const consolidated = spawnSync(process.execPath, ['scripts/generate-consolidated-scp-report.js'], {
  cwd: ROOT,
  env,
  stdio: 'inherit'
});
const consolidatedExitCode = consolidated.status ?? 1;
summary.suites.push({
  name: 'Consolidated SCP application report',
  exitCode: consolidatedExitCode,
  durationMs: Date.now() - consolidatedStartedAt
});
if (consolidatedExitCode !== 0) failed = true;

copyIfPresent(path.join(ROOT, 'reports', 'html'), path.join(executionDir, 'html'));
copyIfPresent(path.join(ROOT, 'reports', 'pdf'), path.join(executionDir, 'pdf'));
copyIfPresent(path.join(ROOT, 'reports', 'modules'), path.join(executionDir, 'modules'));
copyIfPresent(path.join(ROOT, 'reports', 'scp-test-summary.html'), path.join(executionDir, 'scp-test-summary.html'));
copyIfPresent(path.join(ROOT, 'reports', 'scp-test-summary.pdf'), path.join(executionDir, 'scp-test-summary.pdf'));
copyIfPresent(path.join(ROOT, 'reports', 'scp-page-report.html'), path.join(executionDir, 'scp-page-report.html'));
copyIfPresent(path.join(ROOT, 'reports', 'cucumber-report.json'), path.join(executionDir, 'logs', 'cucumber-report.json'));
copyIfPresent(path.join(ROOT, 'test-results', 'scp-results.json'), path.join(executionDir, 'logs', 'scp-results.json'));
copyIfPresent(path.join(ROOT, 'test-results', 'playwright-artifacts'), path.join(executionDir, 'artifacts', 'playwright'));

summary.finishedAt = new Date().toISOString();
summary.status = failed ? 'failed' : 'passed';
fs.writeFileSync(
  path.join(executionDir, 'logs', 'execution-summary.json'),
  JSON.stringify(summary, null, 2),
  'utf8'
);

console.log(`\nFull SCP application evidence: ${executionDir}`);
process.exitCode = failed ? 1 : 0;
