#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('@playwright/test');
const { generateStepReport, OUTPUT_PATH: STEP_REPORT_PATH } = require('./generate-cucumber-step-report');

const REPORT_JSON_PATH = path.resolve(__dirname, '..', 'reports', 'cucumber-report.json');
const HTML_DIR = path.resolve(__dirname, '..', 'reports', 'html');
const PDF_DIR = path.resolve(__dirname, '..', 'reports', 'pdf');
const PREVIEW_PATH = path.join(HTML_DIR, 'SCP_Project_Management_PDF_Preview.html');
const PDF_PATH = path.join(PDF_DIR, 'SCP_Project_Management_Report.pdf');

const htmlEscape = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function statusOf(result = {}) {
  const value = String(result.status || 'skipped').toLowerCase();
  if (value === 'passed') return 'passed';
  if (value === 'skipped' || value === 'unknown') return 'skipped';
  return 'failed';
}

function durationMs(result = {}) {
  const duration = result.duration;
  if (typeof duration === 'number') return duration / 1_000_000;
  if (duration && typeof duration === 'object') {
    return ((Number(duration.seconds) || 0) * 1000) + ((Number(duration.nanos) || 0) / 1_000_000);
  }
  return 0;
}

function formatDuration(milliseconds) {
  if (milliseconds >= 60_000) {
    const minutes = Math.floor(milliseconds / 60_000);
    return `${minutes}m ${((milliseconds % 60_000) / 1000).toFixed(1)}s`;
  }
  if (milliseconds >= 1000) return `${(milliseconds / 1000).toFixed(1)}s`;
  return `${Math.max(0, Math.round(milliseconds))}ms`;
}

function scenarioStatus(steps) {
  const statuses = steps.map((step) => step.status);
  if (statuses.includes('failed')) return 'failed';
  if (statuses.length && statuses.every((status) => status === 'passed')) return 'passed';
  return 'skipped';
}

function parseReport(report) {
  return report.flatMap((feature, featureIndex) => {
    const scenarios = (feature.elements || [])
      .filter((element) => element.type !== 'background')
      .map((scenario, scenarioIndex) => {
        const steps = (scenario.steps || [])
          .filter((step) => !step.hidden)
          .map((step, stepIndex) => ({
            id: `${featureIndex + 1}.${scenarioIndex + 1}.${stepIndex + 1}`,
            keyword: String(step.keyword || '').trim(),
            name: step.name || 'Unnamed step',
            line: step.line,
            status: statusOf(step.result),
            duration: durationMs(step.result),
            error: step.result?.error_message || '',
            evidenceCount: Array.isArray(step.embeddings) ? step.embeddings.length : 0,
          }));

        return {
          name: scenario.name || 'Unnamed scenario',
          line: scenario.line,
          tags: (scenario.tags || []).map((tag) => tag.name).filter(Boolean),
          steps,
          status: scenarioStatus(steps),
          duration: steps.reduce((total, step) => total + step.duration, 0),
        };
      });

    return [{
      name: feature.name || 'Unnamed feature',
      uri: feature.uri || '',
      scenarios,
    }];
  });
}

function statusIcon(status) {
  if (status === 'passed') return '&#10003;';
  if (status === 'failed') return '&#10005;';
  return '&#8212;';
}

function renderStep(step) {
  const source = step.line ? `Step ${step.id} &middot; line ${step.line}` : `Step ${step.id}`;
  const evidence = step.evidenceCount
    ? `<span class="evidence">${step.evidenceCount} screenshot${step.evidenceCount === 1 ? '' : 's'}</span>`
    : '';
  const failure = step.error
    ? `<pre class="failure-detail">${htmlEscape(step.error)}</pre>`
    : '';

  return `
    <div class="step-block">
      <div class="step-row ${step.status}">
        <span class="status-icon" aria-label="${step.status}">${statusIcon(step.status)}</span>
        <div class="step-copy">
          <div class="step-name"><span class="keyword">${htmlEscape(step.keyword)}</span>${htmlEscape(step.name)}</div>
          <div class="step-meta">${source}${evidence}</div>
        </div>
        <span class="status-label">${htmlEscape(step.status)}</span>
        <span class="duration">${formatDuration(step.duration)}</span>
      </div>
      ${failure}
    </div>`;
}

function renderScenario(scenario, uri) {
  const tags = scenario.tags.map((tag) => `<span class="tag">${htmlEscape(tag)}</span>`).join('');
  const location = [uri, scenario.line ? `line ${scenario.line}` : ''].filter(Boolean).join(' | ');

  return `
    <section class="scenario">
      <div class="scenario-header">
        <span class="chevron">&#8964;</span>
        <span class="scenario-status ${scenario.status}">${statusIcon(scenario.status)}</span>
        <div class="scenario-copy">
          <strong>${htmlEscape(scenario.name)}</strong>
          <div class="scenario-meta">${htmlEscape(location)} ${tags}</div>
        </div>
        <span class="browser-chip">Chrome</span>
        <span class="scenario-duration">${formatDuration(scenario.duration)}</span>
      </div>
      <div class="steps">${scenario.steps.map(renderStep).join('')}</div>
    </section>`;
}

function createHtml(features) {
  const scenarios = features.flatMap((feature) => feature.scenarios);
  const steps = scenarios.flatMap((scenario) => scenario.steps);
  const totals = {
    all: steps.length,
    passed: steps.filter((step) => step.status === 'passed').length,
    failed: steps.filter((step) => step.status === 'failed').length,
    skipped: steps.filter((step) => step.status === 'skipped').length,
    flaky: 0,
  };
  const totalDuration = scenarios.reduce((total, scenario) => total + scenario.duration, 0);
  const generatedAt = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'Asia/Kolkata',
  }).format(new Date());

  const featureSections = features.map((feature) => `
    <section class="feature">
      <div class="feature-header">
        <div>
          <div class="feature-name">${htmlEscape(feature.name)}</div>
          <div class="feature-path">${htmlEscape(feature.uri || 'Cucumber feature')}</div>
        </div>
        <span>${feature.scenarios.length} scenario${feature.scenarios.length === 1 ? '' : 's'}</span>
      </div>
      ${feature.scenarios.map((scenario) => renderScenario(scenario, feature.uri)).join('')}
    </section>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SCP Project Management Test Report</title>
  <style>
    :root {
      --ink: #202124;
      --muted: #697386;
      --line: #d9dee8;
      --surface: #ffffff;
      --page: #f5f7fa;
      --passed: #168344;
      --passed-bg: #e8f6ed;
      --failed: #c62828;
      --failed-bg: #fdecec;
      --flaky: #a96300;
      --flaky-bg: #fff3d6;
      --skipped: #667085;
      --skipped-bg: #eef1f5;
    }
    * { box-sizing: border-box; }
    @page { size: A4 landscape; margin: 11mm 10mm 15mm; }
    body {
      margin: 0;
      background: var(--page);
      color: var(--ink);
      font: 12px/1.45 "Segoe UI", Arial, sans-serif;
      letter-spacing: 0;
    }
    .report { max-width: 1280px; margin: 0 auto; padding: 22px; }
    .title-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 14px; }
    h1 { margin: 0; font-size: 21px; font-weight: 650; letter-spacing: 0; }
    .subtitle { margin-top: 3px; color: var(--muted); }
    .run-meta { color: var(--muted); text-align: right; white-space: nowrap; }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 48px;
      padding: 8px;
      margin-bottom: 14px;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 6px;
    }
    .search {
      display: flex;
      align-items: center;
      width: 310px;
      height: 31px;
      margin-right: 4px;
      padding: 0 10px;
      color: #8a94a6;
      border: 1px solid var(--line);
      border-radius: 4px;
    }
    .search-icon { font-size: 15px; margin-right: 8px; color: #65758b; }
    .counter {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 31px;
      padding: 0 10px;
      border: 1px solid var(--line);
      border-radius: 4px;
      background: #fff;
      font-weight: 600;
      white-space: nowrap;
    }
    .counter strong { min-width: 18px; padding: 1px 5px; border-radius: 9px; text-align: center; background: #eef1f5; }
    .counter.passed { color: var(--passed); }
    .counter.passed strong { background: var(--passed-bg); }
    .counter.failed { color: var(--failed); }
    .counter.failed strong { background: var(--failed-bg); }
    .counter.flaky { color: var(--flaky); }
    .counter.flaky strong { background: var(--flaky-bg); }
    .counter.skipped { color: var(--skipped); }
    .toolbar-summary { margin-left: auto; color: var(--muted); white-space: nowrap; }
    .feature {
      margin-bottom: 14px;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 6px;
      overflow: hidden;
    }
    .feature-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 48px;
      padding: 8px 14px;
      background: #f8f9fb;
      border-bottom: 1px solid var(--line);
      color: var(--muted);
    }
    .feature-name { color: var(--ink); font-size: 13px; font-weight: 650; }
    .feature-path { margin-top: 1px; font-size: 10px; }
    .scenario + .scenario { border-top: 1px solid var(--line); }
    .scenario-header {
      display: grid;
      grid-template-columns: 16px 22px minmax(0, 1fr) auto 62px;
      align-items: center;
      gap: 8px;
      min-height: 54px;
      padding: 7px 12px;
      background: #fff;
    }
    .chevron { color: #65758b; font-size: 16px; transform: translateY(-2px); }
    .scenario-status, .status-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      border-radius: 50%;
      font-weight: 700;
    }
    .scenario-status { width: 20px; height: 20px; }
    .scenario-status.passed, .status-icon { color: var(--passed); background: var(--passed-bg); }
    .scenario-status.failed, .step-row.failed .status-icon { color: var(--failed); background: var(--failed-bg); }
    .scenario-status.skipped, .step-row.skipped .status-icon { color: var(--skipped); background: var(--skipped-bg); }
    .scenario-copy { min-width: 0; }
    .scenario-copy strong { display: block; overflow-wrap: anywhere; font-size: 12px; }
    .scenario-meta { margin-top: 2px; color: var(--muted); font-size: 10px; }
    .tag, .browser-chip, .evidence, .status-label {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 8px;
      font-size: 9px;
      line-height: 16px;
      white-space: nowrap;
    }
    .tag { margin-left: 5px; color: #6b4aa3; background: #f2ecfb; }
    .browser-chip { color: #245bb2; background: #e9f1ff; border: 1px solid #b9d1fb; }
    .scenario-duration, .duration { color: #475467; font-variant-numeric: tabular-nums; text-align: right; }
    .steps { border-top: 1px solid #edf0f4; }
    .step-block { break-inside: avoid; }
    .step-row {
      display: grid;
      grid-template-columns: 22px minmax(0, 1fr) 56px 62px;
      align-items: center;
      gap: 9px;
      min-height: 42px;
      padding: 6px 13px 6px 48px;
      border-top: 1px solid #edf0f4;
    }
    .step-row:first-child { border-top: 0; }
    .status-icon { width: 18px; height: 18px; font-size: 11px; }
    .step-copy { min-width: 0; }
    .step-name { overflow-wrap: anywhere; }
    .keyword { margin-right: 5px; color: #475467; font-weight: 650; }
    .step-meta { margin-top: 1px; color: #8a94a6; font-size: 9px; }
    .evidence { margin-left: 6px; color: #52657d; background: #eef3f8; }
    .status-label { text-align: center; text-transform: capitalize; }
    .step-row.passed .status-label { color: var(--passed); background: var(--passed-bg); }
    .step-row.failed .status-label { color: var(--failed); background: var(--failed-bg); }
    .step-row.skipped .status-label { color: var(--skipped); background: var(--skipped-bg); }
    .failure-detail {
      margin: 0;
      padding: 10px 14px 11px 79px;
      color: #8f1d1d;
      background: #fff6f6;
      border-top: 1px solid #f4cccc;
      font: 9px/1.45 Consolas, "Courier New", monospace;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .empty { padding: 30px; text-align: center; color: var(--muted); }
    @media print {
      body { background: #fff; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .report { max-width: none; padding: 0; }
      .feature-header, .scenario-header { break-after: avoid; }
    }
  </style>
</head>
<body>
  <main class="report">
    <div class="title-row">
      <div>
        <h1>SCP Project Management Test Report</h1>
        <div class="subtitle">NRVC_Hall &middot; End-to-end automation &middot; Google Chrome</div>
      </div>
      <div class="run-meta">Generated ${htmlEscape(generatedAt)}<br>${scenarios.length} scenario${scenarios.length === 1 ? '' : 's'} &middot; ${formatDuration(totalDuration)}</div>
    </div>
    <div class="toolbar">
      <div class="search"><span class="search-icon">&#128269;</span>Search test steps</div>
      <span class="counter">All <strong>${totals.all}</strong></span>
      <span class="counter passed">Passed <strong>${totals.passed}</strong></span>
      <span class="counter failed">Failed <strong>${totals.failed}</strong></span>
      <span class="counter flaky">Flaky <strong>${totals.flaky}</strong></span>
      <span class="counter skipped">Skipped <strong>${totals.skipped}</strong></span>
      <span class="toolbar-summary">Total time: ${formatDuration(totalDuration)}</span>
    </div>
    ${featureSections || '<div class="feature empty">No Cucumber scenarios were found.</div>'}
  </main>
</body>
</html>`;
}

async function main() {
  if (!fs.existsSync(REPORT_JSON_PATH)) {
    throw new Error(`Cucumber JSON report not found: ${REPORT_JSON_PATH}`);
  }

  const report = JSON.parse(fs.readFileSync(REPORT_JSON_PATH, 'utf8'));
  const features = parseReport(Array.isArray(report) ? report : []);
  const html = createHtml(features);

  fs.mkdirSync(HTML_DIR, { recursive: true });
  fs.mkdirSync(PDF_DIR, { recursive: true });
  fs.writeFileSync(PREVIEW_PATH, html, 'utf8');
  generateStepReport();

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(pathToFileURL(STEP_REPORT_PATH).href, { waitUntil: 'load' });
    await page.pdf({
      path: PDF_PATH,
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '11mm', right: '10mm', bottom: '15mm', left: '10mm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `
        <div style="width:100%;padding:0 10mm;color:#697386;font:9px Arial,sans-serif;display:flex;justify-content:space-between;">
          <span>SCP Project Management &middot; NRVC_Hall &middot; Chrome</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>`,
    });
  } finally {
    await browser.close();
  }

  console.log(`PDF source generated: ${STEP_REPORT_PATH}`);
  console.log(`PDF report generated: ${PDF_PATH}`);
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
