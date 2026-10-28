#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CUCUMBER_BIN = path.join(ROOT, 'node_modules', '@cucumber', 'cucumber', 'bin', 'cucumber.js');
const PDF_PATH = path.join(ROOT, 'reports', 'pdf', 'SCP_Project_Management_Report.pdf');
const STEP_REPORT_PATH = path.join(ROOT, 'reports', 'html', 'SCP_Project_Management_Step_Report.html');
const args = process.argv.slice(2);
const demo = args.includes('--demo');
const headless = args.includes('--headless');
const headed = args.includes('--headed');
const cucumberArgs = args.filter((arg) => !['--demo', '--headless', '--headed'].includes(arg));
const startedAt = Date.now() - 1000;

fs.mkdirSync(path.join(ROOT, 'reports', 'html'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'reports', 'pdf'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'reports', 'screenshots'), { recursive: true });
if (fs.existsSync(PDF_PATH)) {
  fs.rmSync(PDF_PATH);
}
if (fs.existsSync(STEP_REPORT_PATH)) {
  fs.rmSync(STEP_REPORT_PATH);
}

const env = {
  ...process.env,
  HEADLESS: headless || (!demo && !headed) ? 'true' : 'false'
};

env.SCP_EXECUTION_MODE = demo ? 'demo' : ['normal', 'fast'].includes(process.env.SCP_EXECUTION_MODE) ? process.env.SCP_EXECUTION_MODE
  : env.HEADLESS === 'true' ? 'fast' : 'normal';

const cucumber = spawnSync(process.execPath, [CUCUMBER_BIN, ...cucumberArgs], {
  cwd: ROOT,
  env,
  stdio: 'inherit'
});

const cucumberExitCode = cucumber.status ?? 1;
if (cucumberExitCode !== 0) {
  console.error('Cucumber reported a failure. Generating HTML and PDF reports with the failure details.');
}

const pdf = spawnSync(process.execPath, ['scripts/generate-cucumber-pdf.js'], {
  cwd: ROOT,
  env,
  stdio: 'inherit'
});

const pageReport = spawnSync(process.execPath, ['scripts/generate-page-report.js', String(startedAt)], {
  cwd: ROOT,
  env,
  stdio: 'inherit'
});

if ((pdf.status ?? 1) !== 0) process.exit(pdf.status ?? 1);
if ((pageReport.status ?? 1) !== 0) process.exit(pageReport.status ?? 1);
process.exit(cucumberExitCode);
