#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..');
const REPORTS = path.join(ROOT, 'reports');
const CUCUMBER_JSON = path.join(REPORTS, 'cucumber-report.json');
const PLAYWRIGHT_JSON = path.join(ROOT, 'test-results', 'scp-results.json');
const HTML_PATH = path.join(REPORTS, 'html', 'SCP_Consolidated_Regression_Report.html');
const PDF_PATH = path.join(REPORTS, 'pdf', 'SCP_Consolidated_Regression_Report.pdf');
const MODULE_HTML_DIR = path.join(REPORTS, 'modules', 'html');
const MODULE_PDF_DIR = path.join(REPORTS, 'modules', 'pdf');

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
})[character]);

function readJson(file) {
  if (!fs.existsSync(file)) throw new Error(`Required report data is missing: ${file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function cucumberDuration(result = {}) {
  if (typeof result.duration === 'number') return result.duration / 1_000_000;
  return ((Number(result.duration?.seconds) || 0) * 1000)
    + ((Number(result.duration?.nanos) || 0) / 1_000_000);
}

function duration(value) {
  const milliseconds = Number(value) || 0;
  if (milliseconds < 1000) return `${Math.round(milliseconds)}ms`;
  if (milliseconds < 60000) return `${(milliseconds / 1000).toFixed(1)}s`;
  return `${Math.floor(milliseconds / 60000)}m ${Math.round((milliseconds % 60000) / 1000)}s`;
}

function normalizedStatus(value) {
  const status = String(value || 'skipped').toLowerCase();
  if (status === 'passed') return 'passed';
  if (['failed', 'timedout', 'interrupted', 'ambiguous', 'undefined'].includes(status)) return 'failed';
  return 'skipped';
}

function moduleFromPlaywright(file) {
  const value = String(file || '').replace(/\\/g, '/').toLowerCase();
  if (value.includes('first-delivery-inspection')) return 'First Delivery Inspection';
  if (value.includes('international-shipments')) return 'International Shipments';
  if (value.includes('procurement-log')) return 'Procurement Log';
  if (value.includes('supplier-list')) return 'Supplier List';
  if (value.includes('user-management')) return 'User Management';
  if (value.includes('scp-tabs')) return 'SCP Navigation';
  return 'Other SCP Modules';
}

function moduleFromCucumber(name) {
  const value = String(name || '');
  const mappings = [
    [/Common Utilities/i, 'Common Utilities'], [/Common UoM/i, 'Common UoM'],
    [/Material Category/i, 'Material Category'], [/Configuration Options|Project Management options/i, 'Configuration Options'],
    [/First Delivery|FDI/i, 'First Delivery Inspection Config'], [/Material Master|creates a material/i, 'Material Master'],
    [/Inventory/i, 'Inventory Control'], [/Pre.?Shipping/i, 'Pre-Shipping Checklist'],
    [/System Message/i, 'System Messages'], [/Procurement Log/i, 'Procurement Log Configuration'],
    [/Site/i, 'Site Details'], [/watched/i, 'Watched Materials'], [/Analytics/i, 'Analytics and Integrations']
  ];
  return mappings.find(([pattern]) => pattern.test(value))?.[1] || 'Project Management';
}

function parseCucumber(report) {
  const scenarios = [];
  for (const feature of report) {
    for (const scenario of feature.elements || []) {
      if (scenario.type === 'background') continue;
      const steps = (scenario.steps || []).map((step) => ({
        phase: step.hidden ? (/after/i.test(step.keyword || '') ? 'Teardown' : 'Setup') : String(step.keyword || 'Step').trim(),
        name: step.name || (step.hidden ? 'Prepare or close the scenario browser context' : 'Execute scenario step'),
        status: normalizedStatus(step.result?.status),
        duration: cucumberDuration(step.result),
        error: step.result?.error_message || '',
        evidence: (step.embeddings || []).length
      }));
      const status = steps.some((step) => step.status === 'failed') ? 'failed'
        : steps.some((step) => step.status === 'skipped') ? 'skipped' : 'passed';
      scenarios.push({
        source: 'Cucumber', module: moduleFromCucumber(scenario.name),
        name: scenario.name, status, duration: steps.reduce((sum, step) => sum + step.duration, 0), steps
      });
    }
  }
  return scenarios;
}

function parsePlaywright(report) {
  const tests = [];
  function visit(suite, parents = []) {
    const trail = suite.title ? [...parents, suite.title] : parents;
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const result = test.results?.[test.results.length - 1] || {};
        const steps = [];
        const addSteps = (items, phase = 'Test flow') => {
          for (const step of items || []) {
            const hasChildren = Array.isArray(step.steps) && step.steps.length > 0;
            steps.push({
              phase: hasChildren ? 'Phase' : phase,
              name: step.title, status: step.error ? 'failed' : 'passed', duration: Number(step.duration) || 0,
              error: step.error?.message || '', evidence: 0
            });
            addSteps(step.steps, step.title);
          }
        };
        addSteps(result.steps);
        tests.push({
          source: 'Playwright', module: moduleFromPlaywright(spec.file || suite.file),
          name: [...trail, spec.title]
            .filter((title) => title && !/\.spec\.js$/i.test(String(title)) && !/^[\\/]?regression[\\/]/i.test(String(title)))
            .join(' > '),
          status: normalizedStatus(result.status), duration: Number(result.duration) || 0, steps
        });
      }
    }
    for (const child of suite.suites || []) visit(child, trail);
  }
  for (const suite of report.suites || []) visit(suite);
  return tests;
}

function badge(status) {
  return `<span class="status ${status}">${escapeHtml(status)}</span>`;
}

function summaryByModule(flows) {
  const groups = new Map();
  for (const flow of flows) {
    const current = groups.get(flow.module) || { flows: 0, steps: 0, passed: 0, failed: 0, skipped: 0 };
    current.flows += 1;
    current.steps += flow.steps.length;
    current[flow.status] += 1;
    groups.set(flow.module, current);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b));
}

function safeName(value) {
  return String(value).replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
}

function createHtml(cucumberFlows, playwrightFlows, reportTitle = 'SCP Consolidated Regression Report') {
  const flows = [...cucumberFlows, ...playwrightFlows];
  const cucumberSteps = cucumberFlows.flatMap((flow) => flow.steps);
  const playwrightSteps = playwrightFlows.flatMap((flow) => flow.steps);
  const allSteps = [...cucumberSteps, ...playwrightSteps];
  const passedFlows = flows.filter((flow) => flow.status === 'passed').length;
  const failedFlows = flows.filter((flow) => flow.status === 'failed').length;
  const skippedFlows = flows.filter((flow) => flow.status === 'skipped').length;
  const generated = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' });

  const moduleRows = summaryByModule(flows).map(([module, item]) => `<tr><td>${escapeHtml(module)}</td><td>${item.flows}</td><td>${item.steps}</td><td>${item.passed}</td><td>${item.failed}</td><td>${item.skipped}</td></tr>`).join('');
  const sections = summaryByModule(flows).map(([module]) => {
    const moduleFlows = flows.filter((flow) => flow.module === module);
    return `<section class="module"><h2>${escapeHtml(module)}</h2>${moduleFlows.map((flow) => `
      <article class="flow">
        <div class="flow-head"><div><strong>${escapeHtml(flow.name)}</strong><small>${flow.source} | ${flow.steps.length} actions | ${duration(flow.duration)}</small></div>${badge(flow.status)}</div>
        <table><thead><tr><th>#</th><th>Phase</th><th>Action</th><th>Result</th><th>Status</th><th>Duration</th><th>Evidence</th></tr></thead><tbody>
        ${flow.steps.map((step, index) => `<tr class="${step.status}"><td>${index + 1}</td><td>${escapeHtml(step.phase || 'Action')}</td><td>${escapeHtml(step.name)}${step.error ? `<pre>${escapeHtml(step.error)}</pre>` : ''}</td><td>${step.status === 'passed' ? 'Completed successfully' : step.status === 'skipped' ? 'Not executed' : 'Action failed; see details'}</td><td>${badge(step.status)}</td><td>${duration(step.duration)}</td><td>${step.evidence ? `${step.evidence} attachment(s)` : '-'}</td></tr>`).join('') || '<tr><td colspan="7">No named actions were recorded.</td></tr>'}
        </tbody></table>
      </article>`).join('')}</section>`;
  }).join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(reportTitle)}</title><style>
  @page{size:A4 landscape;margin:11mm 9mm 15mm}*{box-sizing:border-box}body{margin:0;color:#182230;font:10px/1.35 "Segoe UI",Arial,sans-serif;background:#fff}header{border-bottom:3px solid #087f6b;padding:0 0 12px;margin-bottom:12px}h1{font-size:22px;margin:0}h2{font-size:16px;color:#075e54;border-bottom:2px solid #b9ddd7;padding-bottom:5px;margin:18px 0 8px}.meta,small{display:block;color:#627080;margin-top:3px}.cards{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin:12px 0}.card{border:1px solid #ccd6dc;padding:8px;border-radius:5px}.card span{display:block;color:#657482;text-transform:uppercase;font-size:8px;font-weight:700}.card strong{font-size:18px}.module,.flow{break-inside:avoid}.flow{border:1px solid #d7dfe4;margin:0 0 9px}.flow-head{display:flex;justify-content:space-between;align-items:center;padding:7px;background:#f1f6f5}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border-bottom:1px solid #dfe5e8;padding:4px 6px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#eaf1f0;font-size:8px;text-transform:uppercase}th:nth-child(1),td:nth-child(1){width:4%}th:nth-child(2),td:nth-child(2){width:12%}th:nth-child(4),td:nth-child(4){width:14%}th:nth-child(5),td:nth-child(5){width:9%}th:nth-child(6),td:nth-child(6){width:8%}th:nth-child(7),td:nth-child(7){width:9%}.status{display:inline-block;padding:2px 6px;border-radius:3px;font-size:8px;font-weight:700;text-transform:uppercase}.status.passed{background:#dff5ea;color:#076c47}.status.failed{background:#ffe3e0;color:#a52a24}.status.skipped{background:#e9edf0;color:#596571}tr.failed td{background:#fff2f1}pre{white-space:pre-wrap;font-size:8px;color:#a52a24}.overview th:nth-child(n),.overview td:nth-child(n){width:auto}
  </style></head><body><header><h1>${escapeHtml(reportTitle)}</h1><div class="meta">Project: ${escapeHtml(process.env.SCP_PROJECT_NAME || 'NRVC_Hall')} | Browser: Google Chrome | Generated: ${escapeHtml(generated)}</div></header>
  <div class="cards"><div class="card"><span>Total flows</span><strong>${flows.length}</strong></div><div class="card"><span>Passed / Failed / Skipped</span><strong>${passedFlows} / ${failedFlows} / ${skippedFlows}</strong></div><div class="card"><span>Cucumber scenarios / steps</span><strong>${cucumberFlows.length} / ${cucumberSteps.length}</strong></div><div class="card"><span>Playwright tests / actions</span><strong>${playwrightFlows.length} / ${playwrightSteps.length}</strong></div><div class="card"><span>Combined steps/actions</span><strong>${allSteps.length}</strong></div></div>
  <h2>Module Summary</h2><table class="overview"><thead><tr><th>Module</th><th>Flows</th><th>Steps/actions</th><th>Passed</th><th>Failed</th><th>Skipped</th></tr></thead><tbody>${moduleRows}</tbody></table>${sections}</body></html>`;
}

async function main() {
  const cucumberFlows = parseCucumber(readJson(CUCUMBER_JSON));
  const playwrightFlows = parsePlaywright(readJson(PLAYWRIGHT_JSON));
  fs.mkdirSync(path.dirname(HTML_PATH), { recursive: true });
  fs.mkdirSync(path.dirname(PDF_PATH), { recursive: true });
  fs.mkdirSync(MODULE_HTML_DIR, { recursive: true });
  fs.mkdirSync(MODULE_PDF_DIR, { recursive: true });
  fs.writeFileSync(HTML_PATH, createHtml(cucumberFlows, playwrightFlows), 'utf8');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(HTML_PATH).href, { waitUntil: 'load' });
    await page.pdf({ path: PDF_PATH, format: 'A4', landscape: true, printBackground: true,
      margin: { top: '11mm', right: '9mm', bottom: '15mm', left: '9mm' },
      displayHeaderFooter: true, headerTemplate: '<span></span>',
      footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#77818a">SCP Consolidated Regression Report | Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>' });

    const modules = [...new Set([...cucumberFlows, ...playwrightFlows].map((flow) => flow.module))]
      .sort((a, b) => a.localeCompare(b));
    for (const module of modules) {
      const moduleCucumber = cucumberFlows.filter((flow) => flow.module === module);
      const modulePlaywright = playwrightFlows.filter((flow) => flow.module === module);
      const filename = `SCP_${safeName(module)}_Regression_Report`;
      const moduleHtml = path.join(MODULE_HTML_DIR, `${filename}.html`);
      const modulePdf = path.join(MODULE_PDF_DIR, `${filename}.pdf`);
      fs.writeFileSync(moduleHtml, createHtml(moduleCucumber, modulePlaywright, `SCP ${module} Regression Report`), 'utf8');
      await page.goto(pathToFileURL(moduleHtml).href, { waitUntil: 'load' });
      await page.pdf({ path: modulePdf, format: 'A4', landscape: true, printBackground: true,
        margin: { top: '11mm', right: '9mm', bottom: '15mm', left: '9mm' },
        displayHeaderFooter: true, headerTemplate: '<span></span>',
        footerTemplate: `<div style="font-size:8px;width:100%;text-align:center;color:#77818a">SCP ${escapeHtml(module)} Report | Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>` });
    }
    console.log(`Module reports: ${modules.length} HTML and ${modules.length} PDF files.`);
  } finally {
    await browser.close();
  }
  console.log(`Consolidated HTML: ${HTML_PATH}`);
  console.log(`Consolidated PDF: ${PDF_PATH}`);
  console.log(`Module HTML directory: ${MODULE_HTML_DIR}`);
  console.log(`Module PDF directory: ${MODULE_PDF_DIR}`);
  console.log(`Coverage: ${cucumberFlows.length} Cucumber scenarios / ${cucumberFlows.flatMap((item) => item.steps).length} steps; ${playwrightFlows.length} Playwright tests / ${playwrightFlows.flatMap((item) => item.steps).length} actions.`);
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
