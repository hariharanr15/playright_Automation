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

function derivePageName(test, fallbackFlowName) {
  if (test.pageName) return test.pageName;
  const flowName = test.flowName || fallbackFlowName || 'Application';
  const bookingCreationFlows = /^(Delivery Booking|Recurring Booking|Multi-Vehicle Booking|Resource-only Booking)$/i;
  if (bookingCreationFlows.test(flowName)) return 'Booking Creation';
  if (/^(Edit Booking|Booking List Filters|Booking List)$/i.test(flowName)) return 'Booking List';
  return flowName;
}

function buildPageReports(tests, fallbackFlowName, suppliedPages = []) {
  if (Array.isArray(suppliedPages) && suppliedPages.length) return suppliedPages;

  const pages = new Map();
  for (const test of tests) {
    const pageName = derivePageName(test, fallbackFlowName);
    if (!pages.has(pageName)) {
      pages.set(pageName, {
        pageName,
        status: 'passed',
        total: 0,
        passed: 0,
        failed: 0,
        duration: 0,
        failedTestCaseIds: []
      });
    }

    const page = pages.get(pageName);
    page.total += 1;
    page.duration += Number(test.duration) || 0;
    if (test.status === 'failed') {
      page.status = 'failed';
      page.failed += 1;
      page.failedTestCaseIds.push(test.id || `TC-${test.stepNumber || ''}`);
    } else if (test.status === 'passed') {
      page.passed += 1;
    }
  }
  return Array.from(pages.values());
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
  const flowName = titleCase(flowKey);
  const status = String(report.status || (report.failed ? 'failed' : 'passed')).toLowerCase();
  const tests = Array.isArray(report.tests) ? report.tests : [];
  const passed = typeof report.passed === 'number' ? report.passed : tests.filter((test) => test.status === 'passed').length;
  const failed = typeof report.failed === 'number' ? report.failed : tests.filter((test) => test.status === 'failed').length;
  const total = typeof report.total === 'number' ? report.total : Math.max(tests.length, passed + failed);

  return {
    fileName,
    flowKey,
    flowName,
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
    bookingTypeAvailability: Array.isArray(report.bookingTypeAvailability) ? report.bookingTypeAvailability : [],
    bookingTypeResults: Array.isArray(report.bookingTypeResults) ? report.bookingTypeResults : [],
    approvalValidationResults: Array.isArray(report.approvalValidationResults) ? report.approvalValidationResults : [],
    roleNavigationResults: Array.isArray(report.roleNavigationResults) ? report.roleNavigationResults : [],
    roleNavigationSummary: report.roleNavigationSummary || null,
    analyticsUomProtocol: report.analyticsUomProtocol || null,
    tests,
    pages: buildPageReports(tests, flowName, report.pages)
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
  return matching.slice(0, 1);
}

function makeStepRows(runs) {
  const rows = runs.flatMap((run) => run.tests.map((test) => ({ run, test })));
  if (!rows.length) {
    return '<tr><td colspan="7">No testcase step data found.</td></tr>';
  }

  let previousPage = null;
  return rows.map(({ run, test }) => {
    const pageName = derivePageName(test, run.flowName);
    const pageHeader = pageName !== previousPage
      ? `<tr class="page-group"><td colspan="7">${escapeHtml(pageName)} page</td></tr>`
      : '';
    previousPage = pageName;
    const status = escapeHtml(test.status || 'unknown');
    return `${pageHeader}
    <tr class="testcase-row ${status}">
      <td>${escapeHtml(test.id || `TC-${String(test.stepNumber || '').padStart(2, '0')}`)}</td>
      <td>${escapeHtml(test.flowName || run.flowName)}</td>
      <td>${escapeHtml(test.name || '-')}</td>
      <td><span class="status ${status}">${status}</span></td>
      <td>${formatDuration(test.duration)}</td>
      <td>${formatDate(test.timestamp || run.startTime)}</td>
      <td>${escapeHtml(test.error || '-')}</td>
    </tr>
  `;
  }).join('');
}

function makePageRows(runs) {
  const pages = runs.flatMap((run) => (run.pages || []).map((page) => ({ run, page })));
  if (!pages.length) return '<tr><td colspan="7">No page-wise data found.</td></tr>';

  return pages.map(({ run, page }) => {
    const status = escapeHtml(page.status || 'unknown');
    return `<tr class="page-report-row ${status}">
      <td>${escapeHtml(page.pageName || run.flowName)}</td>
      <td><span class="status ${status}">${status}</span></td>
      <td>${Number(page.passed) || 0}/${Number(page.total) || 0}</td>
      <td>${Number(page.failed) || 0}</td>
      <td>${formatDuration(page.duration)}</td>
      <td>${escapeHtml((page.failedTestCaseIds || []).join(', ') || '-')}</td>
      <td>${escapeHtml(run.fileName)}</td>
    </tr>`;
  }).join('');
}

function makeBookingTypeRows(runs) {
  const rows = runs.flatMap((run) => {
    const availability = new Map((run.bookingTypeAvailability || []).map((type) => [type.key, type]));
    return (run.bookingTypeResults || []).map((result) => ({ run, result, availability: availability.get(result.key) || {} }));
  });

  if (!rows.length) {
    return '<tr><td colspan="9">No dynamic booking-type data found.</td></tr>';
  }

  return rows.map(({ run, result, availability }) => {
    const status = escapeHtml(result.status || 'unknown');
    const evidence = result.screenshot
      ? `<a href="../${escapeHtml(result.screenshot)}">${escapeHtml(result.screenshot)}</a>`
      : '-';
    return `<tr class="testcase-row ${status}">
      <td>${escapeHtml(result.label || availability.label || '-')}</td>
      <td>${availability.available ? 'Yes' : 'No'}</td>
      <td>${availability.enabled ? 'Yes' : 'No'}</td>
      <td><span class="status ${status}">${status}</span></td>
      <td>${escapeHtml(result.bookingRef || '-')}</td>
      <td>${escapeHtml(result.reason || result.message || '-')}</td>
      <td>${formatDuration(result.duration)}</td>
      <td>${evidence}</td>
      <td>${escapeHtml(run.fileName)}</td>
    </tr>`;
  }).join('');
}

function makeApprovalRows(runs) {
  const rows = runs.flatMap((run) =>
    (run.approvalValidationResults || []).map((result) => ({ run, result }))
  );

  if (!rows.length) {
    return '<tr><td colspan="11">No Automatic Approval matrix data found.</td></tr>';
  }

  return rows.map(({ run, result }) => {
    const status = escapeHtml(result.status || 'unknown');
    const evidenceItems = [
      result.screenshot,
      ...(result.evidence || []).map((item) => item.screenshot)
    ].filter(Boolean);
    const evidence = evidenceItems.length
      ? evidenceItems.map((item) => `<a href="../${escapeHtml(item)}">${escapeHtml(item)}</a>`).join('<br>')
      : '-';

    return `<tr class="testcase-row ${status}">
      <td>${escapeHtml(result.role || '-')}</td>
      <td>${escapeHtml(result.bookingType || '-')}</td>
      <td>${result.automaticApproval === true ? 'Enabled' : result.automaticApproval === false ? 'Disabled' : '-'}</td>
      <td>${escapeHtml(result.expectedStatus || '-')}</td>
      <td>${escapeHtml(result.actualStatus || '-')}</td>
      <td><span class="status ${status}">${status}</span></td>
      <td>${escapeHtml(result.bookingRef || '-')}</td>
      <td>${escapeHtml(result.reason || result.message || '-')}</td>
      <td>${formatDuration(result.duration)}</td>
      <td>${evidence}</td>
      <td>${escapeHtml(run.fileName)}</td>
    </tr>`;
  }).join('');
}

function makeRoleNavigationRows(runs) {
  const rows = runs.flatMap((run) =>
    (run.roleNavigationResults || []).map((result) => ({ run, result }))
  );

  if (!rows.length) {
    return '<tr><td colspan="13">No role-based navigation data found.</td></tr>';
  }

  const formatList = (items) => Array.isArray(items) && items.length ? items.join(', ') : 'None';

  return rows.map(({ run, result }) => {
    const status = escapeHtml(result.status || 'unknown');
    const vehicle = result.vehicleTracking || {};
    const failedDirect = (result.directAccess || [])
      .filter((check) => check.status === 'failed')
      .map((check) => check.tabName);
    const passedDirect = (result.directAccess || [])
      .filter((check) => check.status === 'passed')
      .map((check) => check.tabName);
    const directSummary = failedDirect.length
      ? `Failed: ${failedDirect.join(', ')}`
      : passedDirect.length
        ? `Passed: ${passedDirect.join(', ')}`
        : 'None';
    const screenshot = result.screenshot
      ? `<a href="../${escapeHtml(result.screenshot)}">${escapeHtml(result.screenshot)}</a>`
      : '-';

    return `<tr class="testcase-row ${status}">
      <td>${escapeHtml(result.userRole || '-')}</td>
      <td>${escapeHtml(result.username || '-')}</td>
      <td>${escapeHtml(result.myAccountProjectRole || '-')}</td>
      <td>${escapeHtml(formatList(result.expectedTabs))}</td>
      <td>${escapeHtml(formatList(result.actualTabs))}</td>
      <td>${escapeHtml(formatList(result.missingTabs))}</td>
      <td>${escapeHtml(formatList(result.unexpectedTabs))}</td>
      <td>${escapeHtml(formatList(result.additionalTabs))}</td>
      <td>${escapeHtml(`${vehicle.configurationStatus || 'Unknown'} - ${
        result.actualTabs?.includes('Vehicle Tracking') ? 'Displayed' : 'Not displayed'
      }`)}</td>
      <td>${escapeHtml(directSummary)}</td>
      <td><span class="status ${status}">${status}</span></td>
      <td>${escapeHtml(result.reason || '-')}</td>
      <td>${screenshot}</td>
    </tr>`;
  }).join('');
}

function makeAnalyticsUomProjectRows(runs) {
  const rows = runs
    .filter((run) => run.analyticsUomProtocol)
    .map((run) => ({ run, protocol: run.analyticsUomProtocol }));

  if (!rows.length) {
    return '<tr><td colspan="8">No Analytics UOM protocol evidence found.</td></tr>';
  }

  return rows.map(({ run, protocol }) => {
    const project = protocol.projectConfiguration || {};
    const projectDetails = project.projectDetails || {};
    const countryUomPage = project.countryUomPage || {};
    const expected = project.expectedUnits || {};
    const expectedUnits = [
      `Distance: ${expected.distanceUnit || '-'}`,
      `Volume: ${expected.volumeUnit || '-'}`,
      `Weight: ${expected.weightUnit || '-'}`,
      `Tons: ${expected.tonsUnit || '-'}`
    ].join('; ');

    return `<tr>
      <td>${escapeHtml(projectDetails.country || expected.configuredCountry || '-')}</td>
      <td>${escapeHtml(projectDetails.projectAddress || '-')}</td>
      <td><span class="status ${countryUomPage.status === 'read' ? 'passed' : 'skipped'}">${escapeHtml(countryUomPage.status || 'unknown')}</span></td>
      <td>${escapeHtml(countryUomPage.countryUom || expected.configuredCountryUom || '-')}</td>
      <td>${escapeHtml(expected.fallbackApplied ? 'Yes' : 'No')}</td>
      <td>${escapeHtml(expectedUnits)}</td>
      <td>${escapeHtml(countryUomPage.issue || projectDetails.issue || '-')}</td>
      <td>${escapeHtml(run.fileName)}</td>
    </tr>`;
  }).join('');
}

function makeAnalyticsUomMetricRows(runs) {
  const rows = runs.flatMap((run) => {
    const sections = run.analyticsUomProtocol?.analyticsSections || [];
    return sections.flatMap((section) =>
      (section.checks || []).map((check) => ({ run, section, check }))
    );
  });

  if (!rows.length) {
    return '<tr><td colspan="9">No Analytics tab UOM checks found.</td></tr>';
  }

  const statusClass = (status) => /pass/i.test(status)
    ? 'passed'
    : /mismatch|missing|failed/i.test(status)
      ? 'failed'
      : 'skipped';

  return rows.map(({ run, section, check }) => {
    const status = escapeHtml(check.status || 'unknown');
    return `<tr class="testcase-row ${statusClass(check.status)}">
      <td>${escapeHtml(section.sectionName || '-')}</td>
      <td>${escapeHtml(check.metric || '-')}</td>
      <td>${escapeHtml(check.expectedUnit || '-')}</td>
      <td><span class="status ${statusClass(check.status)}">${status}</span></td>
      <td>${escapeHtml((check.visibleHeaders || []).join(' | ') || '-')}</td>
      <td>${escapeHtml((check.sampleValues || []).join(' | ') || '-')}</td>
      <td>${escapeHtml((check.valuesWithUnits || []).join(' | ') || '-')}</td>
      <td>${escapeHtml(check.issue || '-')}</td>
      <td>${escapeHtml(run.fileName)}</td>
    </tr>`;
  }).join('');
}

function makeFailurePanel(runs) {
  const failures = runs.flatMap((run) => run.tests
    .filter((test) => test.status === 'failed')
    .map((test) => ({ run, test })));
  if (!failures.length) return '';

  return `<section class="failure-panel" id="failed-testcases">
    <h2>Failed Testcases — Action Required</h2>
    ${failures.map(({ run, test }) => `<article class="failure-item">
      <strong>${escapeHtml(test.id || `TC-${test.stepNumber || ''}`)} — ${escapeHtml(derivePageName(test, run.flowName))}</strong>
      <span>${escapeHtml(test.name || '-')}</span>
      <code>${escapeHtml(test.error || 'No error message was recorded.')}</code>
    </article>`).join('')}
  </section>`;
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
    .status.skipped { background: #fff7d6; color: #8a5a00; }
    .testcase-row.failed, .page-report-row.failed { background: #fff0ef; box-shadow: inset 6px 0 0 #e02424; }
    .testcase-row.skipped { background: #fffaf0; box-shadow: inset 6px 0 0 #d99a00; }
    .testcase-row.failed td { border-top: 2px solid #ff8b85; border-bottom: 2px solid #ff8b85; font-weight: 650; }
    .page-group td { background: #eaf0f8; color: #1f4779; font-size: 15px; font-weight: 850; letter-spacing: .03em; }
    .failure-panel { padding: 18px; border: 3px solid #e02424; border-radius: 10px; background: #fff0ef; box-shadow: 0 0 0 6px rgba(224,36,36,.10); }
    .failure-panel h2 { color: #a11111; }
    .failure-item { display: grid; gap: 7px; margin-top: 12px; padding: 14px; border-left: 7px solid #e02424; background: #fff; }
    .failure-item strong { color: #a11111; font-size: 16px; }
    .failure-item code { white-space: pre-wrap; overflow-wrap: anywhere; color: #741515; }
    .run-status.failed { color: #b11919; text-transform: uppercase; }
    .run-status.passed { color: #04745a; text-transform: uppercase; }
    .env { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-top: 18px; padding: 16px; border: 1px solid #8be0c4; border-radius: 8px; background: #dff8ee; }
    .env span { color: #04745a; font-size: 12px; text-transform: uppercase; font-weight: 800; letter-spacing: .08em; }
    .env strong { display: block; margin-top: 5px; overflow-wrap: anywhere; }
    a { color: var(--blue); font-weight: 650; }
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
    ${makeFailurePanel(runs)}
    <section class="grid">
      <div class="card"><span class="label">Run Status</span><strong class="value run-status ${escapeHtml(latest.status || 'unknown')}">${escapeHtml(latest.status || 'unknown')}</strong><p class="sub">${passRate}% run pass rate</p></div>
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
      <h2>Page-wise Automation Report</h2>
      <table>
        <thead><tr><th>Application Page</th><th>Status</th><th>Passed</th><th>Failed</th><th>Duration</th><th>Failed Cases</th><th>Source</th></tr></thead>
        <tbody>${makePageRows(runs)}</tbody>
      </table>
    </section>
    <section>
      <h2>Analytics UOM Configuration Protocol</h2>
      <table>
        <thead><tr><th>Project Country</th><th>Project Address</th><th>Country UOM Status</th><th>Country UOM Record</th><th>Default Used</th><th>Expected Analytics Units</th><th>Issue</th><th>Source</th></tr></thead>
        <tbody>${makeAnalyticsUomProjectRows(runs)}</tbody>
      </table>
    </section>
    <section>
      <h2>Analytics Tab UOM Checks</h2>
      <table>
        <thead><tr><th>Analytics Tab</th><th>Metric</th><th>Expected UOM</th><th>Status</th><th>Visible Headers</th><th>Sample Values</th><th>Values With Units</th><th>Issue</th><th>Source</th></tr></thead>
        <tbody>${makeAnalyticsUomMetricRows(runs)}</tbody>
      </table>
    </section>
    <section>
      <h2>Dynamic Booking Types</h2>
      <table>
        <thead><tr><th>Booking Type</th><th>Available</th><th>Enabled</th><th>Result</th><th>Booking Ref</th><th>Reason / Message</th><th>Duration</th><th>Evidence</th><th>Source</th></tr></thead>
        <tbody>${makeBookingTypeRows(runs)}</tbody>
      </table>
    </section>
    <section>
      <h2>Automatic Approval Matrix</h2>
      <table>
        <thead><tr><th>User Role</th><th>Booking Type</th><th>Automatic Approval</th><th>Expected Status</th><th>Actual Status</th><th>Result</th><th>Booking Ref</th><th>Reason / Message</th><th>Duration</th><th>Evidence</th><th>Source</th></tr></thead>
        <tbody>${makeApprovalRows(runs)}</tbody>
      </table>
    </section>
    <section>
      <h2>Role-Based Left Navigation</h2>
      <table>
        <thead><tr><th>User Role</th><th>Username</th><th>My Account Role</th><th>Expected Tabs</th><th>Actual Tabs</th><th>Missing Tabs</th><th>Unexpected Tabs</th><th>Additional Tabs</th><th>Vehicle Tracking</th><th>Direct URL Access</th><th>Result</th><th>Failure Reason</th><th>Screenshot</th></tr></thead>
        <tbody>${makeRoleNavigationRows(runs)}</tbody>
      </table>
    </section>
    <section>
      <h2>Entire Testcase Report</h2>
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
