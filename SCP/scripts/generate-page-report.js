#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { redactUrlsInText, safeName } = require('../utils/evidence');

const root = path.resolve(__dirname, '..');
const reportsDir = path.join(root, 'reports');
const outputPath = path.join(reportsDir, 'scp-page-report.html');
const since = Number(process.argv[2]) || 0;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function readCurrentJson(file) {
  if (!fs.existsSync(file) || fs.statSync(file).mtimeMs < since) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function pageFromFile(file) {
  const normalized = String(file || '').replace(/\\/g, '/').toLowerCase();
  const pages = [
    ['supplier-list', 'Supplier List'],
    ['user-management', 'User Management'],
    ['first-delivery-inspections', 'First Delivery Inspections'],
    ['international-shipments', 'International Shipments'],
    ['management-dashboard', 'Management Dashboard'],
    ['procurement-log', 'Procurement Log'],
    ['scp-tabs', 'SCP Tabs']
  ];
  return pages.find(([key]) => normalized.includes(key))?.[1] || 'Other SCP Pages';
}

function pageFromScenario(name) {
  const pages = [
    [/Common Utilities/i, 'Common Utilities'],
    [/Common UoM/i, 'Common UoM'],
    [/material category on the dashboard/i, 'Watched Materials / Management Dashboard'],
    [/Material Category/i, 'Material Category'],
    [/Project Management options/i, 'Configuration Options'],
    [/First Delivery Inspection settings|FDI inspector|FDI question/i, 'First Delivery Inspection Config'],
    [/creates a material/i, 'Material Master'],
    [/inventory balance rule/i, 'Inventory Control'],
    [/PreShipping Checklist/i, 'PreShipping Checklist'],
    [/System Message/i, 'System Messages'],
    [/Procurement Log fields/i, 'Procurement Log Configuration'],
    [/creates a site/i, 'Site Details'],
    [/procurement submittal/i, 'Procurement Log'],
    [/Analytics and remaining controls/i, 'Analytics / Setup Wizard / Integrations']
  ];
  return pages.find(([pattern]) => pattern.test(name))?.[1] || 'Other Project Management Pages';
}

function relativeEvidence(file) {
  if (!file) return '';
  const absolute = path.isAbsolute(file) ? file : path.join(root, file);
  if (!fs.existsSync(absolute)) return '';
  return path.relative(reportsDir, absolute).replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/');
}

function playwrightRows(report) {
  const rows = [];
  function visit(suite) {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const result = test.results?.[test.results.length - 1] || {};
        const status = result.status || 'skipped';
        const error = (result.errors || []).map((item) => item.message).filter(Boolean).join('\n')
          || result.error?.message
          || (status === 'skipped' ? test.annotations?.find((item) => item.type === 'skip')?.description : '')
          || '';
        const screenshot = (result.attachments || []).find((item) => item.name === 'screenshot' && item.path);
        const trace = (result.attachments || []).find((item) => item.name === 'trace' && item.path);
        rows.push({
          page: pageFromFile(spec.file || suite.file),
          name: spec.title,
          source: 'Playwright',
          status,
          error: redactUrlsInText(error),
          evidence: relativeEvidence(screenshot?.path),
          trace: relativeEvidence(trace?.path)
        });
      }
    }
    for (const child of suite.suites || []) visit(child);
  }
  for (const suite of report?.suites || []) visit(suite);
  return rows;
}

function cucumberRows(report) {
  const rows = [];
  for (const feature of Array.isArray(report) ? report : []) {
    for (const scenario of feature.elements || []) {
      if (scenario.type === 'background') continue;
      const steps = scenario.steps || [];
      const failed = steps.find((step) => step.result?.status === 'failed');
      const afterFailure = (scenario.after || []).find((hook) => hook.result?.status === 'failed');
      const skipped = steps.some((step) => step.result?.status === 'skipped');
      const skipReason = steps.flatMap((step) => step.embeddings || []).map((attachment) => {
        if (attachment.mime_type !== 'application/json') return '';
        try {
          const payload = JSON.parse(Buffer.from(attachment.data, 'base64').toString('utf8'));
          return payload.type === 'skip' ? payload.reason : '';
        } catch {
          return '';
        }
      }).find(Boolean);
      const error = failed?.result?.error_message || afterFailure?.result?.error_message || skipReason || '';
      const screenshotPath = path.join(reportsDir, 'screenshots', `FAILED_${safeName(scenario.name)}.png`);
      rows.push({
        page: pageFromScenario(scenario.name),
        name: scenario.name,
        source: 'Cucumber',
        status: failed || afterFailure ? 'failed' : skipped ? 'skipped' : 'passed',
        error: redactUrlsInText(error),
        evidence: failed || afterFailure ? relativeEvidence(screenshotPath) : '',
        trace: ''
      });
    }
  }
  return rows;
}

function pageStatus(rows) {
  if (rows.some((row) => ['failed', 'timedOut', 'interrupted'].includes(row.status))) return 'failed';
  if (rows.some((row) => row.status === 'skipped')) {
    return rows.some((row) => row.status === 'passed') ? 'partial' : 'skipped';
  }
  return 'passed';
}

function reportHtml(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.page)) groups.set(row.page, []);
    groups.get(row.page).push(row);
  }
  const sections = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([page, tests]) => `
    <section>
      <h2>${escapeHtml(page)} <span class="status ${pageStatus(tests)}">${pageStatus(tests)}</span></h2>
      <table><thead><tr><th>Flow</th><th>Suite</th><th>Status</th><th>Failure and evidence</th></tr></thead><tbody>
      ${tests.map((row) => `<tr>
        <td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.source)}</td>
        <td><span class="status ${escapeHtml(row.status)}">${escapeHtml(row.status)}</span></td>
        <td>${row.error ? `<details><summary>${escapeHtml(row.error.split('\n')[0].slice(0, 180))}</summary><pre>${escapeHtml(row.error)}</pre></details>` : '-'}
        ${row.evidence ? `<a href="${row.evidence}">Screenshot</a>` : ''}
        ${row.trace ? `<a href="${row.trace}">Trace</a>` : ''}</td>
      </tr>`).join('')}
      </tbody></table>
    </section>`).join('');
  const passed = rows.filter((row) => row.status === 'passed').length;
  const failed = rows.filter((row) => ['failed', 'timedOut', 'interrupted'].includes(row.status)).length;
  const skipped = rows.length - passed - failed;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>SCP Page Report</title><style>
    :root{font-family:Segoe UI,Arial,sans-serif;color:#222;background:#f5f7f8}*{box-sizing:border-box}body{margin:0}
    main{max-width:1250px;margin:auto;padding:24px 20px 50px}h1{font-size:24px;margin:0 0 6px}h2{font-size:17px;margin:26px 0 8px}
    .meta{color:#53606a;font-size:13px}.summary{margin:18px 0;padding:12px 0;border-top:1px solid #ccd4d9;border-bottom:1px solid #ccd4d9}
    section{overflow-x:auto}table{width:100%;border-collapse:collapse;background:white;font-size:13px}th,td{border-bottom:1px solid #dce2e5;padding:10px;text-align:left;vertical-align:top}th{background:#e9eff1}
    td:first-child{min-width:220px}td:last-child{width:45%;overflow-wrap:anywhere}.status{display:inline-block;padding:3px 7px;border-radius:4px;font-size:11px;text-transform:capitalize}
    .passed{background:#dbf3e5;color:#126a38}.failed,.timedOut,.interrupted{background:#fce2e0;color:#a3211d}.skipped{background:#e6ebee;color:#53606a}.partial{background:#fff0c9;color:#755300}
    details{max-width:600px}summary{cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px}a{display:inline-block;margin:5px 12px 0 0;color:#08607c}
    @media print{body{background:white}section{break-inside:avoid}}
    </style></head><body><main><h1>SCP Page Report</h1><div class="meta">Google Chrome | ${escapeHtml(new Date().toLocaleString('en-GB'))}</div>
    <div class="summary">${rows.length} flows &nbsp; | &nbsp; ${passed} passed &nbsp; | &nbsp; ${failed} failed &nbsp; | &nbsp; ${skipped} skipped</div>
    ${sections || '<p>No results were produced by this run.</p>'}</main></body></html>`;
}

try {
  const rows = [
    ...cucumberRows(readCurrentJson(path.join(reportsDir, 'cucumber-report.json'))),
    ...playwrightRows(readCurrentJson(path.join(root, 'test-results', 'scp-results.json')))
  ];
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(outputPath, reportHtml(rows), 'utf8');
  console.log(`Page-wise report: ${outputPath} (${rows.length} flows)`);
} catch (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
}
