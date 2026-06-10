#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const RESULTS_DIR = path.resolve('test-results');
const REPORTS_DIR = path.resolve('reports');

function parseArguments() {
  const args = process.argv.slice(2);
  const latestFlowIndex = args.indexOf('--latest-flow');

  return {
    latestFlow: latestFlowIndex !== -1 ? args[latestFlowIndex + 1] : 'full-application',
    noOpen: args.includes('--no-open'),
    allHistory: args.includes('--all-history')
  };
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function titleCase(value) {
  return String(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDuration(milliseconds) {
  if (!Number.isFinite(Number(milliseconds))) return '-';
  const seconds = Math.round(Number(milliseconds) / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function getFlowFromFileName(fileName) {
  return fileName.replace(/-report-\d{4}-\d{2}-\d{2}T.*\.json$/i, '');
}

function normalizeRun(fileName, report) {
  const flowKey = getFlowFromFileName(fileName);
  const status = String(report.status || (report.failed ? 'failed' : 'passed')).toLowerCase();
  const tests = Array.isArray(report.tests) ? report.tests : [];
  const passed = typeof report.passed === 'number' ? report.passed : tests.filter((test) => test.status === 'passed').length;
  const failed = typeof report.failed === 'number' ? report.failed : tests.filter((test) => test.status === 'failed').length;
  const total = typeof report.total === 'number' ? report.total : Math.max(tests.length, passed + failed);

  return {
    fileName,
    flowKey,
    flowName: titleCase(flowKey),
    status,
    startTime: report.startTime || report.timestamp || report.endTime || null,
    endTime: report.endTime || report.timestamp || null,
    duration: Number(report.duration) || 0,
    total,
    passed,
    failed,
    bookingId: report.bookingId || null,
    inviteEmail: report.inviteEmail || null,
    workflow: report.workflow || null,
    environmentName: report.environmentName || 'Staging',
    appUrl: report.appUrl || null,
    browserMode: report.browserMode || null,
    viewport: report.viewport || null,
    tests
  };
}

function loadRuns() {
  if (!fs.existsSync(RESULTS_DIR)) return [];

  return fs
    .readdirSync(RESULTS_DIR)
    .filter((fileName) => fileName.endsWith('.json') && fileName.includes('-report-'))
    .map((fileName) => {
      const report = readJson(path.join(RESULTS_DIR, fileName));
      return report ? normalizeRun(fileName, report) : null;
    })
    .filter(Boolean)
    .sort((left, right) => new Date(right.startTime || 0) - new Date(left.startTime || 0));
}

function selectRuns(runs, options) {
  if (options.allHistory) return runs;

  const matching = runs.filter((run) => run.flowKey.toLowerCase() === options.latestFlow.toLowerCase());
  return matching.find((run) => run.status === 'passed')
    ? [matching.find((run) => run.status === 'passed')]
    : matching.slice(0, 1);
}

function makeStepRows(runs) {
  const rows = runs.flatMap((run) => run.tests.map((test) => ({ run, test })));
  if (!rows.length) {
    return '<tr><td colspan="7">No testcase step data found.</td></tr>';
  }

  return rows.map(({ run, test }) => `
    <tr>
      <td>${escapeHtml(test.id || `TC-${String(test.stepNumber || '').padStart(2, '0')}`)}</td>
      <td>${escapeHtml(test.flowName || run.flowName)}</td>
      <td>${escapeHtml(test.name || '-')}</td>
      <td><span class="status ${escapeHtml(test.status || 'unknown')}">${escapeHtml(test.status || 'unknown')}</span></td>
      <td>${formatDuration(test.duration)}</td>
      <td>${formatDate(test.timestamp || run.startTime)}</td>
      <td>${escapeHtml(test.error || '-')}</td>
    </tr>
  `).join('');
}

function buildHtml(runs, options) {
  const latest = runs[0] || {};
  const passedRuns = runs.filter((run) => run.status === 'passed').length;
  const totalCases = runs.reduce((sum, run) => sum + run.total, 0);
  const passedCases = runs.reduce((sum, run) => sum + run.passed, 0);
  const failedCases = runs.reduce((sum, run) => sum + run.failed, 0);
  const passRate = runs.length ? Math.round((passedRuns / runs.length) * 100) : 0;
  const viewport = latest.viewport ? `${latest.viewport.width}x${latest.viewport.height}` : '-';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Automation Flow Dashboard</title>
  <style>
    :root {
      --bg: #f4f6f9;
      --panel: #fff;
      --ink: #172033;
      --muted: #607089;
      --line: #dfe5ee;
      --green: #0f9f7a;
      --red: #d94d45;
      --blue: #2c6fbb;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font-family: Inter, Segoe UI, Arial, sans-serif; }
    header { padding: 28px 40px 22px; background: #fff; border-bottom: 1px solid var(--line); }
    h1, h2, p { margin: 0; }
    h1 { font-size: 30px; }
    header p { margin-top: 6px; color: var(--muted); }
    main { padding: 28px 40px 48px; }
    .grid { display: grid; gap: 18px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .card { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 20px; box-shadow: 0 8px 24px rgba(33, 45, 67, .07); }
    .label { color: var(--muted); font-size: 13px; text-transform: uppercase; letter-spacing: .08em; }
    .value { display: block; margin-top: 8px; font-size: 30px; font-weight: 750; }
    .sub { color: var(--muted); margin-top: 4px; font-size: 14px; }
    section { margin-top: 22px; }
    h2 { margin-bottom: 14px; font-size: 20px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; table-layout: fixed; }
    th, td { padding: 11px 12px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; font-size: 14px; overflow-wrap: anywhere; }
    th { background: #f8fafc; color: #3e4b61; font-size: 13px; text-transform: uppercase; letter-spacing: .05em; }
    .status { display: inline-flex; border-radius: 999px; padding: 4px 9px; font-weight: 700; font-size: 12px; text-transform: uppercase; }
    .status.passed { background: #dff8ee; color: #04745a; }
    .status.failed { background: #ffe3e0; color: #af2f2a; }
    .env { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-top: 18px; padding: 16px; border: 1px solid #8be0c4; border-radius: 8px; background: #dff8ee; }
    .env span { color: #04745a; font-size: 12px; text-transform: uppercase; font-weight: 800; letter-spacing: .08em; }
    .env strong { display: block; margin-top: 5px; overflow-wrap: anywhere; }
    @media (max-width: 1000px) { .grid, .env { grid-template-columns: 1fr; } main, header { padding-left: 20px; padding-right: 20px; } }
  </style>
</head>
<body>
  <header>
    <h1>Automation Flow Dashboard</h1>
    <div class="env">
      <div><span>Environment</span><strong>${escapeHtml(latest.environmentName || 'Staging')}</strong></div>
      <div><span>Application URL</span><strong>${escapeHtml(latest.appUrl || '-')}</strong></div>
      <div><span>Browser</span><strong>${escapeHtml(latest.browserMode || '-')} / Chrome</strong></div>
      <div><span>Viewport</span><strong>${escapeHtml(viewport)}</strong></div>
    </div>
  </header>
  <main>
    <section class="grid">
      <div class="card"><span class="label">Run Status</span><strong class="value">${escapeHtml(latest.status || 'unknown')}</strong><p class="sub">${passRate}% run pass rate</p></div>
      <div class="card"><span class="label">Checks Passed</span><strong class="value">${passedCases}/${totalCases}</strong><p class="sub">${failedCases} failed checks</p></div>
      <div class="card"><span class="label">Duration</span><strong class="value">${formatDuration(latest.duration)}</strong><p class="sub">Latest run duration</p></div>
      <div class="card"><span class="label">Primary Record</span><strong class="value">${escapeHtml(latest.bookingId || '-')}</strong><p class="sub">${escapeHtml(latest.inviteEmail || latest.workflow || '-')}</p></div>
    </section>
    <section>
      <h2>Recent Runs</h2>
      <table>
        <thead><tr><th>Flow</th><th>Status</th><th>Started</th><th>Duration</th><th>Checks</th><th>Source</th></tr></thead>
        <tbody>
          ${runs.map((run) => `<tr><td>${escapeHtml(run.flowName)}</td><td><span class="status ${escapeHtml(run.status)}">${escapeHtml(run.status)}</span></td><td>${formatDate(run.startTime)}</td><td>${formatDuration(run.duration)}</td><td>${run.passed}/${run.total}</td><td>${escapeHtml(run.fileName)}</td></tr>`).join('')}
        </tbody>
      </table>
    </section>
    <section>
      <h2>Testcase Wise Steps</h2>
      <table>
        <thead><tr><th>Case ID</th><th>Flow</th><th>Step</th><th>Status</th><th>Duration</th><th>Timestamp</th><th>Error</th></tr></thead>
        <tbody>${makeStepRows(runs)}</tbody>
      </table>
    </section>
  </main>
</body>
</html>`;
}

function openReportInChrome(reportPath) {
  const fileUrl = `file:///${path.resolve(reportPath).replace(/\\/g, '/')}`;

  if (process.platform === 'win32') {
    const child = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `Start-Process -FilePath 'chrome.exe' -ArgumentList @('${fileUrl.replace(/'/g, "''")}')`
    ], { detached: true, stdio: 'ignore' });
    child.unref();
    return;
  }

  const child = spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [fileUrl], { detached: true, stdio: 'ignore' });
  child.unref();
}

function main() {
  const options = parseArguments();
  const runs = selectRuns(loadRuns(), options);

  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const html = buildHtml(runs, options);
  const latestPath = path.join(REPORTS_DIR, 'automation-dashboard-latest.html');
  const summaryPath = path.join(REPORTS_DIR, 'automation-dashboard-summary.json');

  fs.writeFileSync(latestPath, html, 'utf8');
  fs.writeFileSync(summaryPath, JSON.stringify({ generatedAt: new Date().toISOString(), runs }, null, 2), 'utf8');

  console.log('Automation graphical report generated.');
  console.log(`Latest: ${latestPath}`);
  console.log(`Summary: ${summaryPath}`);

  if (options.noOpen) {
    console.log('Skipped opening latest dashboard in Chrome.');
  } else {
    openReportInChrome(latestPath);
    console.log('Opened latest dashboard in Chrome.');
  }
}

main();
