#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { redactUrlsInText } = require('../utils/evidence');

const ROOT = path.resolve(__dirname, '..');
const REPORT_JSON_PATH = path.join(ROOT, 'reports', 'cucumber-report.json');
const SEQUENCE_PATH = path.join(ROOT, 'test-results', 'scp-data-sequence.json');
const OUTPUT_PATH = path.join(ROOT, 'reports', 'html', 'SCP_Project_Management_Step_Report.html');

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function statusOf(result = {}) {
  const status = String(result.status || 'skipped').toLowerCase();
  if (status === 'passed') return 'passed';
  if (status === 'skipped' || status === 'unknown') return 'skipped';
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

function flowForStep(stepName, currentFlow) {
  const name = String(stepName || '');
  const markers = [
    [/logged into SCP/i, 'Login'],
    [/Supply Chain Planner platform/i, 'Platform Selection'],
    [/active SCP project/i, 'Project Selection > NRVC_Hall'],
    [/opens Project Management|Project Management navigation/i, 'Project Management'],
    [/Common Utilities|common utility/i, 'Project Management > Reference Data > Common Utilities'],
    [/Common UoM/i, 'Project Management > Reference Data > Common UoM'],
    [/Material Category|material category/i, 'Project Management > Reference Data > Material Category'],
    [/Configuration Options|alert values|Management currency/i, 'Project Management > Configuration Options'],
    [/First Delivery Inspection|FDI setting/i, 'Project Management > First Delivery Inspection Config'],
    [/Material Master|creates a material|new material/i, 'Project Management > Material Master'],
    [/Inventory Control|inventory fields|inventory balance/i, 'Project Management > Inventory Control'],
    [/PreShipping|Pre-Shipping/i, 'Project Management > PreShipping Checklist'],
    [/System Message/i, 'Project Management > System Messages'],
    [/Procurement Log Configuration|log fields|procurement log field/i, 'Project Management > Procurement Log Configuration'],
    [/opens Procurement Log$|procurement submittal/i, 'Procurement Log'],
    [/Site Details|site fields|new site/i, 'Project Management > Site Details'],
    [/Management Dashboard for watched-material|same watched category/i, 'Management Dashboard > Your Watched Materials'],
    [/Watched Materials|category watch|watched-material configuration/i, 'Project Management > Watched Materials'],
    [/Analytics/i, 'Project Management > Analytics'],
    [/Setup Wizard|Integrations controls|remaining Project Management controls/i, 'Project Management > Setup Wizard and Integrations'],
  ];
  return markers.find(([pattern]) => pattern.test(name))?.[1] || currentFlow;
}

function collectSteps(report) {
  let stepNumber = 0;
  return report.flatMap((feature) => (feature.elements || [])
    .filter((scenario) => scenario.type !== 'background')
    .flatMap((scenario) => {
      let currentFlow = 'SCP Project Management';
      return (scenario.steps || [])
        .map((step) => {
          const hook = step.hidden ? String(step.keyword || '').trim().toLowerCase() : '';
          const stepName = hook === 'before'
            ? 'Initialize the shared Chrome browser session and test context'
            : hook === 'after'
              ? 'Capture the final result and close the browser session'
              : step.name || 'Unnamed step';
          currentFlow = hook === 'before'
            ? 'Test Setup'
            : hook === 'after'
              ? 'Test Cleanup'
              : flowForStep(stepName, currentFlow);
          return {
            number: ++stepNumber,
            feature: feature.name || 'SCP Project Management',
            scenario: scenario.name || 'Unnamed scenario',
            flow: currentFlow,
            keyword: String(step.keyword || '').trim(),
            name: stepName,
            status: statusOf(step.result),
            duration: durationMs(step.result),
            error: redactUrlsInText(step.result?.error_message || ''),
            evidenceCount: Array.isArray(step.embeddings) ? step.embeddings.length : 0,
          };
        });
    }));
}

function readRunId() {
  if (!fs.existsSync(SEQUENCE_PATH)) return '-';
  try {
    return String(JSON.parse(fs.readFileSync(SEQUENCE_PATH, 'utf8')).runs || '-');
  } catch {
    return '-';
  }
}

function createRows(steps) {
  return steps.map((step) => {
    const error = step.error
      ? `<pre class="error">${escapeHtml(step.error)}</pre>`
      : '';
    return `
      <tr class="step-row ${step.status}" data-status="${step.status}">
        <td class="step-number">Step ${step.number}</td>
        <td class="flow">${escapeHtml(step.flow)}</td>
        <td>
          <div class="step-name"><span class="keyword">${escapeHtml(step.keyword)}</span> ${escapeHtml(step.name)}</div>
          <div class="context">${escapeHtml(step.feature)} | ${escapeHtml(step.scenario)}</div>
          ${error}
        </td>
        <td><span class="status ${step.status}">${escapeHtml(step.status)}</span></td>
        <td class="duration">${formatDuration(step.duration)}</td>
        <td class="evidence">${step.evidenceCount}</td>
      </tr>`;
  }).join('');
}

function createHtml(steps) {
  const totals = {
    passed: steps.filter((step) => step.status === 'passed').length,
    failed: steps.filter((step) => step.status === 'failed').length,
    skipped: steps.filter((step) => step.status === 'skipped').length,
  };
  const totalDuration = steps.reduce((total, step) => total + step.duration, 0);
  const flowSequence = [...new Set(steps.map((step) => step.flow))];
  const generatedAt = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'Asia/Kolkata',
  }).format(new Date());

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SCP Step-by-Step Test Report</title>
  <style>
    :root {
      --ink: #1f2937;
      --muted: #667085;
      --line: #d7dde5;
      --page: #f5f7f9;
      --surface: #ffffff;
      --passed: #147a3f;
      --passed-bg: #e8f6ed;
      --failed: #b42318;
      --failed-bg: #fdecec;
      --skipped: #5f6b7a;
      --skipped-bg: #eef1f5;
    }
    * { box-sizing: border-box; }
    body { margin: 0; color: var(--ink); background: var(--page); font: 13px/1.45 "Segoe UI", Arial, sans-serif; letter-spacing: 0; }
    main { width: min(1280px, calc(100% - 32px)); margin: 20px auto 36px; }
    .heading { display: flex; justify-content: space-between; align-items: end; gap: 24px; margin-bottom: 14px; }
    h1 { margin: 0; font-size: 22px; }
    .subheading, .meta, .context { color: var(--muted); }
    .meta { text-align: right; white-space: nowrap; }
    .summary { display: flex; align-items: center; gap: 8px; padding: 10px; margin-bottom: 14px; background: var(--surface); border: 1px solid var(--line); border-radius: 6px; }
    .count { padding: 5px 9px; border: 1px solid var(--line); border-radius: 4px; font-weight: 600; background: #fff; }
    .count.passed { color: var(--passed); background: var(--passed-bg); }
    .count.failed { color: var(--failed); background: var(--failed-bg); }
    .count.skipped { color: var(--skipped); background: var(--skipped-bg); }
    .total-time { margin-left: auto; color: var(--muted); }
    .flow-sequence { margin-bottom: 14px; padding: 10px 12px; color: #344054; background: var(--surface); border: 1px solid var(--line); border-radius: 6px; }
    .flow-sequence strong { display: block; margin-bottom: 6px; }
    .flow-path { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; color: var(--muted); font-size: 12px; }
    .flow-node { color: #344054; font-weight: 600; }
    .table-wrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 6px; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 10px 12px; text-align: left; color: #475467; background: #f0f3f6; border-bottom: 1px solid var(--line); font-size: 12px; }
    td { padding: 10px 12px; border-top: 1px solid #e8ebef; vertical-align: top; }
    tbody tr:first-child td { border-top: 0; }
    tr.failed { background: #fffafa; }
    .step-number { width: 88px; font-weight: 700; white-space: nowrap; }
    .flow { width: 245px; color: #344054; font-size: 12px; font-weight: 600; }
    .step-name { font-weight: 600; }
    .keyword { color: #475467; }
    .context { margin-top: 3px; font-size: 11px; }
    .status { display: inline-block; min-width: 66px; padding: 3px 8px; border-radius: 10px; text-align: center; text-transform: capitalize; font-size: 11px; font-weight: 700; }
    .status.passed { color: var(--passed); background: var(--passed-bg); }
    .status.failed { color: var(--failed); background: var(--failed-bg); }
    .status.skipped { color: var(--skipped); background: var(--skipped-bg); }
    .duration, .evidence { white-space: nowrap; font-variant-numeric: tabular-nums; }
    .error { margin: 8px 0 0; padding: 9px; color: #8f1d1d; background: var(--failed-bg); border: 1px solid #f4cccc; border-radius: 4px; white-space: pre-wrap; overflow-wrap: anywhere; font: 11px/1.4 Consolas, monospace; }
    @media print {
      body { background: #fff; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      main { width: 100%; margin: 0; }
      .table-wrap { overflow: visible; }
      tr { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main>
    <header class="heading">
      <div>
        <h1>SCP Step-by-Step Test Report</h1>
        <div class="subheading">Project Management | NRVC_Hall | Google Chrome</div>
      </div>
      <div class="meta">Run ${escapeHtml(readRunId())}<br>${escapeHtml(generatedAt)}</div>
    </header>
    <section class="summary">
      <span class="count">All: ${steps.length}</span>
      <span class="count passed">Passed: ${totals.passed}</span>
      <span class="count failed">Failed: ${totals.failed}</span>
      <span class="count skipped">Skipped: ${totals.skipped}</span>
      <span class="total-time">Total time: ${formatDuration(totalDuration)}</span>
    </section>
    <section class="flow-sequence">
      <strong>Execution Flow</strong>
      <div class="flow-path">${flowSequence.map((flow, index) => `${index ? '<span>&rarr;</span>' : ''}<span class="flow-node">${escapeHtml(flow)}</span>`).join('')}</div>
    </section>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Step</th><th>Flow</th><th>Automation Action</th><th>Status</th><th>Duration</th><th>Screenshots</th></tr></thead>
        <tbody>${createRows(steps)}</tbody>
      </table>
    </div>
  </main>
</body>
</html>`;
}

function generateStepReport() {
  if (!fs.existsSync(REPORT_JSON_PATH)) {
    throw new Error(`Cucumber JSON report not found: ${REPORT_JSON_PATH}`);
  }
  const report = JSON.parse(fs.readFileSync(REPORT_JSON_PATH, 'utf8'));
  const steps = collectSteps(Array.isArray(report) ? report : []);
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, createHtml(steps), 'utf8');
  console.log(`Step-by-step HTML report generated: ${OUTPUT_PATH}`);
  console.log(`Steps: ${steps.length}, Passed: ${steps.filter((step) => step.status === 'passed').length}, Failed: ${steps.filter((step) => step.status === 'failed').length}, Skipped: ${steps.filter((step) => step.status === 'skipped').length}`);
  return { outputPath: OUTPUT_PATH, steps };
}

if (require.main === module) {
  try {
    generateStepReport();
  } catch (error) {
    console.error(error.stack || error.message || error);
    process.exit(1);
  }
}

module.exports = { generateStepReport, OUTPUT_PATH };
