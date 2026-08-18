#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const REPORTS_DIR = path.join(ROOT_DIR, 'reports');
const RESULTS_DIR = path.join(ROOT_DIR, 'test-results');

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    headless: !args.includes('--headed'),
    noOpen: !args.includes('--open'),
    safeOnly: args.includes('--safe-only'),
    skipPlaywrightSuites: args.includes('--skip-playwright-suites'),
    skipFullApplication: args.includes('--skip-full-application'),
    skipDynamicApproval: args.includes('--skip-dynamic-approval'),
    skipRoleNavigation: args.includes('--skip-role-navigation'),
    stopOnFailure: args.includes('--stop-on-failure')
  };
}

function commandLine(command, args) {
  return [command, ...args].join(' ');
}

function runCommand(step) {
  const startedAt = new Date();
  console.log(`\n=== ${step.name} ===`);
  console.log(commandLine(step.command, step.args));

  const result = spawnSync(step.command, step.args, {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      DISABLE_AUTOMATION_VISUALS: process.env.DISABLE_AUTOMATION_VISUALS || '1',
      HIGHLIGHT_MS: process.env.HIGHLIGHT_MS || '0',
      STEP_WAIT_MS: process.env.STEP_WAIT_MS || '0'
    },
    shell: process.platform === 'win32',
    stdio: 'inherit'
  });

  const endedAt = new Date();
  return {
    ...step,
    commandText: commandLine(step.command, step.args),
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs: endedAt.getTime() - startedAt.getTime(),
    status: result.status === 0 ? 'passed' : 'failed',
    exitCode: result.status ?? 1,
    signal: result.signal || null,
    error: result.error?.message || ''
  };
}

function buildPlan(options) {
  const node = process.platform === 'win32' ? 'node' : process.execPath;
  const commonReportArgs = options.noOpen ? ['--no-open'] : [];
  const headlessArg = options.headless ? ['--headless'] : [];
  const plan = [
    {
      key: 'catalog',
      name: 'Cucumber catalog: positive and negative traceability',
      command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
      args: ['run', 'cucumber:catalog'],
      category: 'safe',
      coverage: 'Positive and negative catalog validation'
    },
    {
      key: 'construction-navigation',
      name: 'Cucumber safe application navigation',
      command: node,
      args: ['scripts/run-cucumber-suite.js', '--suite', 'construction', ...headlessArg, ...commonReportArgs],
      category: 'safe',
      coverage: 'Read-only module navigation'
    }
  ];

  if (!options.skipRoleNavigation) {
    plan.push({
      key: 'role-navigation',
      name: 'Role-based left navigation and restricted direct URL validation',
      command: node,
      args: ['scripts/run-role-navigation-flow.js', ...headlessArg, ...commonReportArgs],
      category: 'access-control',
      coverage: 'Role-based positive and negative access validation'
    });
  }

  if (!options.safeOnly) {
    if (!options.skipDynamicApproval) {
      plan.push({
        key: 'dynamic-booking-approval',
        name: 'Dynamic booking types and automatic approval matrix',
        command: node,
        args: ['run-full-application.js', '--fast', '--booking-creation-only', '--approval-matrix', '--continue-on-failure', ...headlessArg, ...commonReportArgs],
        category: 'mutating',
        coverage: 'Booking creation, optional booking-type skips, approval enabled/disabled status'
      });
    }

    if (!options.skipFullApplication) {
      plan.push({
        key: 'full-application',
        name: 'Full application positive functional flow',
        command: node,
        args: ['run-full-application.js', '--fast', '--continue-on-failure', ...headlessArg, ...commonReportArgs],
        category: 'mutating',
        coverage: 'Bookings, lifecycle, filters, calendar, analytics, equipment, users, account, organization, notifications'
      });
    }

    if (!options.skipPlaywrightSuites) {
      plan.push({
        key: 'playwright-smoke-regression',
        name: 'Playwright smoke and regression suites',
        command: node,
        args: ['scripts/run-test-suites.js', '--no-open'],
        category: 'mutating',
        coverage: 'Executable smoke/regression specs including positive and implemented negative checks'
      });
    }
  }

  return plan;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDuration(milliseconds) {
  const seconds = Math.round(Number(milliseconds || 0) / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function writeReport(results, options, startedAt, endedAt) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const passed = results.filter((result) => result.status === 'passed').length;
  const failed = results.filter((result) => result.status === 'failed').length;
  const report = {
    workflow: 'complete-automation-flow',
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs: endedAt.getTime() - startedAt.getTime(),
    status: failed ? 'failed' : 'passed',
    passed,
    failed,
    total: results.length,
    options,
    results
  };

  const stamp = timestamp();
  const jsonPath = path.join(RESULTS_DIR, `complete-automation-flow-${stamp}.json`);
  const htmlPath = path.join(REPORTS_DIR, `complete-automation-flow-${stamp}.html`);
  const latestHtmlPath = path.join(REPORTS_DIR, 'complete-automation-flow-latest.html');

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Complete Automation Flow Report</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; color: #172033; background: #f6f8fb; }
    header { background: #172033; color: #fff; padding: 28px 36px; }
    main { padding: 28px 36px 48px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    p { margin: 0; color: #617089; }
    header p { color: #d6deea; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
    .card { background: #fff; color: #172033; border-radius: 6px; padding: 14px; }
    .card strong { display: block; font-size: 24px; }
    table { width: 100%; border-collapse: collapse; background: #fff; table-layout: fixed; }
    th, td { border: 1px solid #dce3ed; padding: 10px; text-align: left; vertical-align: top; word-break: break-word; }
    th { background: #eef3f9; }
    .pill { border-radius: 999px; padding: 5px 10px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .passed { background: #dff8e7; color: #126c34; }
    .failed { background: #ffe2e2; color: #9d2020; }
    tr.failed { background: #fff2f2; box-shadow: inset 6px 0 0 #d92d20; }
  </style>
</head>
<body>
  <header>
    <h1>Complete Automation Flow Report</h1>
    <p>${escapeHtml(report.startedAt)} to ${escapeHtml(report.endedAt)} · ${escapeHtml(options.headless ? 'headless' : 'headed')}</p>
    <section class="grid">
      <div class="card"><strong>${escapeHtml(report.status.toUpperCase())}</strong><span>Status</span></div>
      <div class="card"><strong>${passed}/${results.length}</strong><span>Passed</span></div>
      <div class="card"><strong>${failed}</strong><span>Failed</span></div>
      <div class="card"><strong>${formatDuration(report.durationMs)}</strong><span>Duration</span></div>
    </section>
  </header>
  <main>
    <table>
      <thead><tr><th>Order</th><th>Flow</th><th>Category</th><th>Coverage</th><th>Status</th><th>Duration</th><th>Command</th><th>Error</th></tr></thead>
      <tbody>
        ${results.map((result, index) => `<tr class="${escapeHtml(result.status)}">
          <td>${index + 1}</td>
          <td>${escapeHtml(result.name)}</td>
          <td>${escapeHtml(result.category)}</td>
          <td>${escapeHtml(result.coverage)}</td>
          <td><span class="pill ${escapeHtml(result.status)}">${escapeHtml(result.status)}</span></td>
          <td>${formatDuration(result.durationMs)}</td>
          <td>${escapeHtml(result.commandText)}</td>
          <td>${escapeHtml(result.error || (result.exitCode ? `Exit code ${result.exitCode}` : '-'))}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </main>
</body>
</html>`;

  fs.writeFileSync(htmlPath, html, 'utf8');
  fs.copyFileSync(htmlPath, latestHtmlPath);
  console.log(`\nComplete flow JSON: ${path.relative(ROOT_DIR, jsonPath)}`);
  console.log(`Complete flow HTML: ${path.relative(ROOT_DIR, latestHtmlPath)}`);
  return report;
}

function main() {
  const options = parseArgs();
  const startedAt = new Date();
  const plan = buildPlan(options);
  const results = [];

  for (const step of plan) {
    const result = runCommand(step);
    results.push(result);
    if (result.status === 'failed' && options.stopOnFailure) {
      break;
    }
  }

  const report = writeReport(results, options, startedAt, new Date());
  process.exitCode = report.status === 'passed' ? 0 : 1;
}

main();
