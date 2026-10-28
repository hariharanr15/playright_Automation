#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const { loadEnvFile } = require('../utils/env');
const { redactUrlsInText } = require('../utils/evidence');

loadEnvFile();

const RESULTS_JSON = path.resolve(__dirname, '..', 'test-results', 'scp-results.json');
const REPORTS_DIR = path.resolve(__dirname, '..', 'reports');
const HTML_PATH = path.join(REPORTS_DIR, 'scp-test-summary.html');
const PDF_PATH = path.join(REPORTS_DIR, 'scp-test-summary.pdf');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDuration(milliseconds) {
  const ms = Number(milliseconds) || 0;
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function statusOf(test) {
  const last = test.results?.[test.results.length - 1];
  if (!last) return 'skipped';
  if (last.status === 'passed' && test.results.length > 1) return 'flaky';
  return last.status || 'skipped';
}

function flattenSuite(suite, breadcrumb, rows) {
  const nextBreadcrumb = suite.title ? [...breadcrumb, suite.title] : breadcrumb;

  for (const spec of suite.specs || []) {
    for (const test of spec.tests || []) {
      const last = test.results?.[test.results.length - 1] || {};
      const errorMessage = (last.errors || []).map((e) => e.message).filter(Boolean).join('\n')
        || last.error?.message || '';

      rows.push({
        suite: nextBreadcrumb.join(' > ') || 'SCP Automation',
        title: spec.title,
        file: spec.file || suite.file || '-',
        project: test.projectName || '-',
        status: statusOf(test),
        retries: test.results ? test.results.length - 1 : 0,
        duration: (test.results || []).reduce((sum, r) => sum + (Number(r.duration) || 0), 0),
        startTime: last.startTime || null,
        error: redactUrlsInText(errorMessage),
        steps: last.steps || []
      });
    }
  }

  for (const child of suite.suites || []) {
    flattenSuite(child, nextBreadcrumb, rows);
  }
}

function flattenNamedSteps(rows) {
  const flattened = [];
  const visit = (steps, row, parent = '') => {
    for (const step of steps || []) {
      const action = parent ? `${parent} > ${step.title}` : step.title;
      const error = step.error?.message || step.error || '';
      flattened.push({
        flow: row.suite.split(' > ').pop() || row.title,
        action,
        status: error ? 'failed' : 'passed',
        duration: Number(step.duration) || 0,
        error: String(error || '')
      });
      visit(step.steps, row, action);
    }
  };

  for (const row of rows) visit(row.steps, row);
  return flattened;
}

function loadRows() {
  if (!fs.existsSync(RESULTS_JSON)) {
    return { rows: [], stepRows: [], stats: null, config: null };
  }

  const report = JSON.parse(fs.readFileSync(RESULTS_JSON, 'utf8'));
  const rows = [];
  for (const suite of report.suites || []) {
    flattenSuite(suite, [], rows);
  }
  return {
    rows,
    stepRows: flattenNamedSteps(rows),
    stats: report.stats || null,
    config: report.config || null
  };
}

function statusBadge(status) {
  const cls = status === 'passed' ? 'passed' : status === 'failed' || status === 'timedOut' ? 'failed'
    : status === 'flaky' ? 'flaky' : 'skipped';
  return `<span class="status ${cls}">${escapeHtml(status)}</span>`;
}

function rowClass(status) {
  if (status === 'failed' || status === 'timedOut') return 'failed';
  if (status === 'flaky') return 'flaky';
  if (status === 'skipped') return 'skipped';
  return 'passed';
}

function buildTableRows(rows) {
  if (!rows.length) {
    return '<tr><td colspan="6">No test results found. Run npm run test:smoke or npm run test:regression first.</td></tr>';
  }

  let previousSuite = null;
  return rows.map((row) => {
    const groupHeader = row.suite !== previousSuite
      ? `<tr class="suite-group"><td colspan="6">${escapeHtml(row.suite)}</td></tr>`
      : '';
    previousSuite = row.suite;

    return `${groupHeader}
    <tr class="test-row ${rowClass(row.status)}">
      <td>${escapeHtml(row.title)}</td>
      <td>${statusBadge(row.status)}</td>
      <td>${escapeHtml(row.project)}</td>
      <td>${formatDuration(row.duration)}</td>
      <td>${row.retries || '-'}</td>
      <td>${escapeHtml(row.error ? row.error.split('\n')[0].slice(0, 160) : '-')}</td>
    </tr>`;
  }).join('');
}

function buildStepTableRows(stepRows) {
  if (!stepRows.length) return '';
  return stepRows.map((step, index) => `
    <tr class="test-row ${rowClass(step.status)}">
      <td><strong>Step ${index + 1}</strong></td>
      <td>${escapeHtml(step.flow)}</td>
      <td>${escapeHtml(step.action)}</td>
      <td>${statusBadge(step.status)}</td>
      <td>${formatDuration(step.duration)}</td>
    </tr>`).join('');
}

function buildFailurePanel(rows) {
  const failed = rows.filter((row) => row.status === 'failed' || row.status === 'timedOut');
  if (!failed.length) return '';

  return `<section class="failure-panel">
    <h2>Failed Tests — Action Required</h2>
    ${failed.map((row) => `<article class="failure-item">
      <strong>${escapeHtml(row.suite)} — ${escapeHtml(row.title)}</strong>
      <code>${escapeHtml(row.error || 'No error message was recorded.')}</code>
    </article>`).join('')}
  </section>`;
}

function buildHtml({ rows, stepRows, stats, config }) {
  const resultRows = stepRows.length ? stepRows : rows;
  const total = resultRows.length;
  const passed = resultRows.filter((r) => r.status === 'passed').length;
  const failed = resultRows.filter((r) => r.status === 'failed' || r.status === 'timedOut').length;
  const flaky = resultRows.filter((r) => r.status === 'flaky').length;
  const skipped = resultRows.filter((r) => r.status === 'skipped').length;
  const executed = passed + failed;
  const passRate = executed ? ((passed / executed) * 100).toFixed(1) : '0.0';
  const duration = stats?.duration || rows.reduce((sum, r) => sum + r.duration, 0);
  const startTime = rows.find((r) => r.startTime)?.startTime || Date.now();
  const environment = process.env.SCP_BASE_URL || '-';
  const projectNames = [...new Set(rows.map((r) => r.project).filter(Boolean))].join(', ') || '-';
  const metricLabel = stepRows.length ? 'Playwright Actions' : 'Playwright Tests';
  const passedLabel = stepRows.length ? 'Passed Actions' : 'Passed Tests';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>SCP Automation Test Report</title>
<style>
  @page { size: A4; margin: 14mm 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f4f6f9; color: #172033; font-family: Arial, Segoe UI, sans-serif; font-size: 12px; }
  header { padding: 18px 0; border-bottom: 2px solid #2c6fbb; }
  h1 { margin: 0 0 6px; font-size: 22px; color: #172033; }
  h2 { font-size: 15px; margin: 18px 0 8px; color: #1f4779; }
  .meta { color: #607089; font-size: 12px; }
  main { padding: 12px 0 24px; }
  .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
  .card { background: #fff; border: 1px solid #dfe5ee; border-radius: 6px; padding: 10px 12px; }
  .label { color: #607089; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; font-weight: 700; }
  .value { display: block; margin-top: 4px; font-size: 20px; font-weight: 800; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #dfe5ee; table-layout: fixed; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #dfe5ee; text-align: left; vertical-align: top; font-size: 11px; overflow-wrap: anywhere; }
  th { background: #f8fafc; color: #3e4b61; text-transform: uppercase; font-size: 10px; letter-spacing: .04em; }
  .status { display: inline-flex; border-radius: 999px; padding: 2px 8px; font-weight: 700; font-size: 10px; text-transform: uppercase; }
  .passed { background: #dff8ee; color: #04745a; }
  .failed { background: #ffe3e0; color: #af2f2a; }
  .flaky { background: #fff2d6; color: #8a5a00; }
  .skipped { background: #eef1f5; color: #56607a; }
  tr.failed td { background: #fff0ef; }
  tr.flaky td { background: #fffaf0; }
  .suite-group td { background: #eaf0f8; color: #1f4779; font-weight: 800; font-size: 11px; }
  .failure-panel { margin-top: 16px; padding: 10px 12px; border: 2px solid #e02424; border-radius: 8px; background: #fff0ef; break-inside: avoid; }
  .failure-panel h2 { color: #a11111; margin-top: 0; }
  .failure-item { margin-top: 8px; padding: 8px 10px; border-left: 5px solid #e02424; background: #fff; break-inside: avoid; }
  .failure-item strong { display: block; color: #a11111; font-size: 12px; margin-bottom: 4px; }
  .failure-item code { white-space: pre-wrap; overflow-wrap: anywhere; color: #741515; font-size: 10px; }
  section { break-inside: avoid; }
</style>
</head>
<body>
<header>
  <h1>SCP Automation Test Report</h1>
  <div class="meta">Environment: ${escapeHtml(environment)} | Browser: ${escapeHtml(projectNames)} | Generated: ${formatDate(Date.now())} | Run started: ${formatDate(startTime)}</div>
</header>
<main>
  <section class="grid">
    <div class="card"><span class="label">Playwright Tests</span><strong class="value">${rows.length}</strong></div>
    <div class="card"><span class="label">${metricLabel}</span><strong class="value">${total}</strong></div>
    <div class="card"><span class="label">${passedLabel}</span><strong class="value">${passed}</strong></div>
    <div class="card"><span class="label">Failed</span><strong class="value">${failed}</strong></div>
    <div class="card"><span class="label">Skipped / Flaky</span><strong class="value">${skipped} / ${flaky}</strong></div>
    <div class="card"><span class="label">Pass Rate</span><strong class="value">${passRate}%</strong></div>
    <div class="card"><span class="label">Duration</span><strong class="value">${formatDuration(duration)}</strong></div>
  </section>
  ${buildFailurePanel(rows)}
  ${stepRows.length ? `<section class="card">
    <span class="label">Execution Flow</span>
    <div style="margin-top:6px;line-height:1.7">${stepRows.map((step) => escapeHtml(step.action)).join(' &rarr; ')}</div>
  </section>
  <section>
    <h2>Step-by-Step Results</h2>
    <table>
      <thead><tr><th style="width:9%">Step</th><th style="width:18%">Flow</th><th>Automation Action</th><th style="width:12%">Status</th><th style="width:12%">Duration</th></tr></thead>
      <tbody>${buildStepTableRows(stepRows)}</tbody>
    </table>
  </section>` : ''}
  <section>
    <h2>Test Case Results</h2>
    <table>
      <thead><tr><th>Test</th><th>Status</th><th>Browser</th><th>Duration</th><th>Retries</th><th>Error</th></tr></thead>
      <tbody>${buildTableRows(rows)}</tbody>
    </table>
  </section>
</main>
</body>
</html>`;
}

async function renderPdf(htmlPath, pdfPath) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'load' });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '14mm', bottom: '16mm', left: '10mm', right: '10mm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: '<div style="font-size:9px;width:100%;text-align:center;color:#889;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>'
    });
  } finally {
    await browser.close();
  }
}

async function main() {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const data = loadRows();
  const html = buildHtml(data);
  fs.writeFileSync(HTML_PATH, html, 'utf8');
  console.log(`HTML summary: ${HTML_PATH}`);

  await renderPdf(HTML_PATH, PDF_PATH);
  console.log(`PDF (A4): ${PDF_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
