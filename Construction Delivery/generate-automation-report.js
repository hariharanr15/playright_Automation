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
  const skipped = typeof report.skipped === 'number' ? report.skipped : tests.filter((test) => test.status === 'skipped').length;
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
    skipped,
    bookingId: report.bookingId || null,
    inviteEmail: report.inviteEmail || null,
    workflow: report.workflow || null,
    environmentName: report.environmentName || 'Staging',
    appUrl: report.appUrl || null,
    browserName: report.browserName || 'Google Chrome',
    browserVersion: report.browserVersion || null,
    browserMode: report.browserMode || null,
    viewport: report.viewport || null,
    bookingTypeAvailability: Array.isArray(report.bookingTypeAvailability) ? report.bookingTypeAvailability : [],
    bookingTypeResults: Array.isArray(report.bookingTypeResults) ? report.bookingTypeResults : [],
    approvalValidationResults: Array.isArray(report.approvalValidationResults) ? report.approvalValidationResults : [],
    roleNavigationResults: Array.isArray(report.roleNavigationResults) ? report.roleNavigationResults : [],
    roleNavigationSummary: report.roleNavigationSummary || null,
    roleFunctionalResults: Array.isArray(report.roleFunctionalResults) ? report.roleFunctionalResults : [],
    roleFunctionalSummary: report.roleFunctionalSummary || null,
    createdUsers: Array.isArray(report.createdUsers) ? report.createdUsers : [],
    dynamicTestData: report.dynamicTestData || null,
    blockedScenarios: Array.isArray(report.blockedScenarios) ? report.blockedScenarios : [],
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
    return '<tr><td colspan="8">No testcase step data found.</td></tr>';
  }

  let previousPage = null;
  return rows.map(({ run, test }) => {
    const pageName = derivePageName(test, run.flowName);
    const pageHeader = pageName !== previousPage
      ? `<tr class="page-group"><td colspan="8">${escapeHtml(pageName)} page</td></tr>`
      : '';
    previousPage = pageName;
    const status = escapeHtml(test.status || 'unknown');
    return `${pageHeader}
    <tr class="testcase-row ${status}">
      <td>${escapeHtml(test.id || `TC-${String(test.stepNumber || '').padStart(2, '0')}`)}</td>
      <td>${escapeHtml(test.userRole || '-')}</td>
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
    return '<tr><td colspan="10">No dynamic booking-type data found.</td></tr>';
  }

  return rows.map(({ run, result, availability }) => {
    const status = escapeHtml(result.status || 'unknown');
    const evidence = result.screenshot
      ? `<a href="../${escapeHtml(result.screenshot)}">${escapeHtml(result.screenshot)}</a>`
      : '-';
    return `<tr class="testcase-row ${status}">
      <td>${escapeHtml(result.userRole || '-')}</td>
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
    return '<tr><td colspan="14">No role-based navigation data found.</td></tr>';
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
    const failedPermitted = (result.permittedAccess || [])
      .filter((check) => check.status === 'failed')
      .map((check) => check.tabName);
    const passedPermitted = (result.permittedAccess || [])
      .filter((check) => check.status === 'passed')
      .map((check) => check.tabName);
    const permittedSummary = failedPermitted.length
      ? `Failed: ${failedPermitted.join(', ')}`
      : passedPermitted.length
        ? `Passed: ${passedPermitted.join(', ')}`
        : 'None';
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
      <td>${escapeHtml(permittedSummary)}</td>
      <td>${escapeHtml(directSummary)}</td>
      <td><span class="status ${status}">${status}</span></td>
      <td>${escapeHtml(result.reason || '-')}</td>
      <td>${screenshot}</td>
    </tr>`;
  }).join('');
}

function makeRoleFunctionalFlowRows(runs) {
  const rows = runs.flatMap((run) =>
    (run.roleFunctionalResults || []).map((result) => ({ run, result }))
  );

  if (!rows.length) {
    return '<tr><td colspan="9">No role-based functional flow data found.</td></tr>';
  }

  const formatList = (items) => Array.isArray(items) && items.length ? items.join(', ') : 'None';

  return rows.map(({ run, result }) => {
    const status = escapeHtml(result.status || 'unknown');
    const evidence = result.evidence
      ? `<a href="../${escapeHtml(result.evidence)}">${escapeHtml(result.evidence)}</a>`
      : escapeHtml(run.fileName);

    return `<tr class="testcase-row ${status}">
      <td>${escapeHtml(result.userRole || '-')}</td>
      <td>${escapeHtml(result.username || '-')}</td>
      <td>${escapeHtml(result.tabName || '-')}</td>
      <td>${escapeHtml(result.flowName || '-')}</td>
      <td><span class="status ${status}">${status}</span></td>
      <td>${formatDuration(result.duration)}</td>
      <td>${escapeHtml(formatList(result.visibleTabs))}</td>
      <td>${escapeHtml(result.reason || '-')}</td>
      <td>${evidence}</td>
    </tr>`;
  }).join('');
}

function makeGeneratedUserRows(runs) {
  const rows = runs.flatMap((run) =>
    (run.createdUsers || []).map((user) => ({ run, user }))
  );

  if (!rows.length) {
    return '<tr><td colspan="9">No generated user details found.</td></tr>';
  }

  return rows.map(({ run, user }) => {
    const status = user.accountSetupSkipped ? 'skipped' : 'passed';
    return `<tr class="testcase-row ${status}">
      <td>${escapeHtml(user.createdByRole || '-')}</td>
      <td>${escapeHtml(user.role || '-')}</td>
      <td>${escapeHtml(user.name || '-')}</td>
      <td>${escapeHtml(user.email || '-')}</td>
      <td>${escapeHtml(user.password || '-')}</td>
      <td><span class="status ${status}">${status}</span></td>
      <td>${escapeHtml((user.setupMissingFields || []).join(', ') || '-')}</td>
      <td>${escapeHtml(user.updatedOrganization || '-')}</td>
      <td>${escapeHtml(run.fileName)}</td>
    </tr>`;
  }).join('');
}

function makeDynamicTestDataRows(runs) {
  const rows = runs
    .filter((run) => run.dynamicTestData)
    .map((run) => ({ run, data: run.dynamicTestData }));

  if (!rows.length) {
    return '<tr><td colspan="9">No dynamic Project Management data references found.</td></tr>';
  }

  return rows.map(({ run, data }) => `<tr>
    <td>${escapeHtml(data.projectId || '-')}</td>
    <td>${escapeHtml(data.accessPointName || '-')}</td>
    <td>${escapeHtml(data.accessPointId || '-')}</td>
    <td>${escapeHtml(data.resourceName || '-')}</td>
    <td>${escapeHtml(data.resourceAvailabilityEnabledName || '-')}</td>
    <td>${escapeHtml(data.vehicleName || '-')}</td>
    <td>${escapeHtml(data.vehicleFuelType || '-')}</td>
    <td>${escapeHtml(data.equipmentName || '-')}</td>
    <td>${escapeHtml(run.fileName)}</td>
  </tr>`).join('');
}

function makeBlockedRows(runs) {
  const rows = runs.flatMap((run) =>
    (run.blockedScenarios || []).map((scenario) => ({ run, scenario }))
  );

  if (!rows.length) {
    return '<tr><td colspan="7">No blocked or dependency-skipped scenarios found.</td></tr>';
  }

  return rows.map(({ run, scenario }) => `<tr class="testcase-row skipped">
    <td>${escapeHtml(scenario.id || '-')}</td>
    <td>${escapeHtml(scenario.flowName || '-')}</td>
    <td>${escapeHtml(scenario.name || '-')}</td>
    <td><span class="status skipped">${escapeHtml(scenario.status || 'skipped')}</span></td>
    <td>${escapeHtml(scenario.dependsOn || '-')}</td>
    <td>${escapeHtml(scenario.error || scenario.reason || '-')}</td>
    <td>${escapeHtml(run.fileName)}</td>
  </tr>`).join('');
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

const REQUESTED_ROLE_NAMES = ['Project Admin', 'Project User', 'View-Only User'];

function normalizeRoleName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\buser\b/g, '')
    .replace(/[-_\s]+/g, ' ')
    .trim();
}

function roleFileStem(roleName) {
  return String(roleName || 'role')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sameRole(left, right) {
  return normalizeRoleName(left) === normalizeRoleName(right);
}

function uniqueList(items) {
  return [...new Set((items || []).filter(Boolean))];
}

function formatList(items) {
  return uniqueList(items).length ? uniqueList(items).join(', ') : '-';
}

function statusCounts(items) {
  return items.reduce((counts, item) => {
    const status = String(item.status || 'skipped').toLowerCase();
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, { passed: 0, failed: 0, skipped: 0 });
}

function passPercentage(passed, failed) {
  const executed = Number(passed || 0) + Number(failed || 0);
  return executed ? ((Number(passed || 0) / executed) * 100).toFixed(2) : '0.00';
}

function roleNamesForRun(run) {
  return uniqueList([
    ...REQUESTED_ROLE_NAMES,
    ...(run.roleFunctionalResults || []).map((result) => result.userRole),
    ...(run.roleNavigationResults || []).map((result) => result.userRole),
    ...(run.tests || []).map((test) => test.userRole),
    ...(run.bookingTypeResults || []).map((result) => result.userRole)
  ]).filter((roleName) => REQUESTED_ROLE_NAMES.some((requested) => sameRole(requested, roleName)));
}

function roleData(run, roleName) {
  const tests = (run.tests || []).filter((test) => sameRole(test.userRole, roleName));
  const functionalResults = (run.roleFunctionalResults || []).filter((result) => sameRole(result.userRole, roleName));
  const navigationResults = (run.roleNavigationResults || []).filter((result) => sameRole(result.userRole, roleName));
  const bookingTypeResults = (run.bookingTypeResults || []).filter((result) => sameRole(result.userRole, roleName));
  const approvalResults = (run.approvalValidationResults || []).filter((result) => sameRole(result.role || result.userRole, roleName));
  const blocked = (run.blockedScenarios || []).filter((scenario) => sameRole(scenario.userRole, roleName));
  const cases = [
    ...tests,
    ...functionalResults,
    ...navigationResults,
    ...bookingTypeResults,
    ...approvalResults,
    ...blocked
  ];
  const counts = statusCounts(cases);
  const nav = navigationResults[0] || {};
  const visibleTabs = uniqueList([
    ...(nav.actualTabs || []),
    ...functionalResults.flatMap((result) => result.visibleTabs || [])
  ]);
  const restrictedTabs = uniqueList([
    ...(nav.restrictedTabs || []),
    ...navigationResults.flatMap((result) => result.restrictedTabs || [])
  ]);
  const directAccess = navigationResults.flatMap((result) => result.directAccess || []);
  const permittedAccess = navigationResults.flatMap((result) => result.permittedAccess || []);

  return {
    roleName,
    tests,
    functionalResults,
    navigationResults,
    bookingTypeResults,
    approvalResults,
    blocked,
    cases,
    counts,
    passRate: passPercentage(counts.passed, counts.failed),
    visibleTabs,
    restrictedTabs,
    directAccess,
    permittedAccess,
    username: nav.username || functionalResults.find((result) => result.username)?.username || tests.find((test) => test.username)?.username || '-'
  };
}

function makeRoleModuleRows(data) {
  const modules = new Map();
  const add = (name, status, reason = '') => {
    const moduleName = name || 'Application';
    if (!modules.has(moduleName)) {
      modules.set(moduleName, { moduleName, passed: 0, failed: 0, skipped: 0, reasons: [] });
    }
    const item = modules.get(moduleName);
    const normalizedStatus = String(status || 'skipped').toLowerCase();
    item[normalizedStatus] = (item[normalizedStatus] || 0) + 1;
    if (reason) item.reasons.push(reason);
  };

  for (const test of data.tests) add(test.pageName || derivePageName(test), test.status, test.error);
  for (const result of data.functionalResults) add(result.tabName, result.status, result.reason);
  for (const result of data.bookingTypeResults) add('New Booking', result.status, result.reason);
  for (const result of data.navigationResults) add('Role-Based Access', result.status, result.reason);
  for (const scenario of data.blocked) add(scenario.pageName || scenario.flowName, 'skipped', scenario.error || scenario.reason);

  if (!modules.size) return '<tr><td colspan="6">No role-scoped module data was recorded.</td></tr>';

  return Array.from(modules.values()).map((module) => {
    const status = module.failed ? 'failed' : module.passed ? 'passed' : 'skipped';
    return `<tr class="testcase-row ${status}">
      <td>${escapeHtml(module.moduleName)}</td>
      <td><span class="status ${status}">${status}</span></td>
      <td>${module.passed}</td>
      <td>${module.failed}</td>
      <td>${module.skipped}</td>
      <td>${escapeHtml(formatList(module.reasons))}</td>
    </tr>`;
  }).join('');
}

function scenarioKind(record) {
  const text = `${record.name || ''} ${record.flowName || ''} ${record.reason || ''} ${record.error || ''}`.toLowerCase();
  return /(invalid|empty|required|mandatory|duplicate|unauthori[sz]ed|direct url|logout|expiry|expired|boundary|minimum|maximum|capacity|cutoff|file type|file content|api|error|reject|cancel)/i.test(text)
    ? 'Negative'
    : 'Positive';
}

function makeScenarioCoverageRows(data) {
  const rows = data.cases.map((record) => ({
    kind: scenarioKind(record),
    module: record.pageName || record.tabName || derivePageName(record, record.flowName),
    scenario: record.name || record.flowName || record.label || record.tabName || '-',
    status: String(record.status || 'skipped').toLowerCase(),
    reason: record.error || record.reason || record.message || '-'
  }));

  if (!rows.length) return '<tr><td colspan="5">No role-scoped scenario data was recorded.</td></tr>';

  return rows.map((row) => `<tr class="testcase-row ${escapeHtml(row.status)}">
    <td>${escapeHtml(row.kind)}</td>
    <td>${escapeHtml(row.module)}</td>
    <td>${escapeHtml(row.scenario)}</td>
    <td><span class="status ${escapeHtml(row.status)}">${escapeHtml(row.status)}</span></td>
    <td>${escapeHtml(row.reason)}</td>
  </tr>`).join('');
}

function makeRoleBookingRows(data, run) {
  const rows = data.bookingTypeResults.length
    ? data.bookingTypeResults
    : (run.bookingTypeAvailability || []).map((type) => ({
      label: type.label,
      status: type.available && type.enabled ? 'skipped' : 'skipped',
      reason: type.available && type.enabled
        ? `${data.roleName} did not execute this booking type in the captured role data.`
        : `${type.label} was not visible or enabled in this environment.`,
      bookingRef: '-',
      screenshot: type.screenshot
    }));

  if (!rows.length) return '<tr><td colspan="6">No booking type discovery data was recorded.</td></tr>';

  return rows.map((row) => {
    const status = String(row.status || 'skipped').toLowerCase();
    const evidence = row.screenshot ? `<a href="../${escapeHtml(row.screenshot)}">${escapeHtml(row.screenshot)}</a>` : '-';
    return `<tr class="testcase-row ${status}">
      <td>${escapeHtml(row.label || row.key || '-')}</td>
      <td><span class="status ${status}">${status}</span></td>
      <td>${escapeHtml(row.bookingRef || '-')}</td>
      <td>${escapeHtml(row.reason || row.message || '-')}</td>
      <td>${formatDuration(row.duration)}</td>
      <td>${evidence}</td>
    </tr>`;
  }).join('');
}

function makeRestrictedRows(data) {
  const rows = [
    ...data.restrictedTabs.map((tab) => ({
      feature: tab,
      check: 'Navigation control hidden or unavailable',
      status: data.visibleTabs.includes(tab) ? 'failed' : 'passed',
      reason: data.visibleTabs.includes(tab) ? 'Restricted feature is visible.' : 'Restricted feature is not visible for this role.'
    })),
    ...data.directAccess.map((check) => ({
      feature: check.tabName,
      check: 'Direct URL access',
      status: check.status,
      reason: check.reason || check.finalUrl || '-'
    })),
    ...data.permittedAccess.map((check) => ({
      feature: check.tabName,
      check: 'Permitted navigation access',
      status: check.status,
      reason: check.reason || check.finalUrl || '-'
    }))
  ];

  if (!rows.length) return '<tr><td colspan="4">No restricted feature checks were recorded for this role.</td></tr>';

  return rows.map((row) => {
    const status = String(row.status || 'skipped').toLowerCase();
    return `<tr class="testcase-row ${status}">
      <td>${escapeHtml(row.feature || '-')}</td>
      <td>${escapeHtml(row.check || '-')}</td>
      <td><span class="status ${status}">${status}</span></td>
      <td>${escapeHtml(row.reason || '-')}</td>
    </tr>`;
  }).join('');
}

function makeEvidenceRows(data, run) {
  const rows = [
    ...data.tests.map((test) => ({
      item: test.id || test.name || '-',
      screenshot: test.screenshot,
      logs: run.progressLogPath,
      video: test.video,
      trace: test.trace,
      reason: test.error
    })),
    ...data.functionalResults.map((result) => ({
      item: result.flowName || result.tabName || '-',
      screenshot: result.evidence,
      logs: run.progressLogPath,
      video: result.video,
      trace: result.trace,
      reason: result.reason
    })),
    ...data.navigationResults.map((result) => ({
      item: 'Role navigation',
      screenshot: result.screenshot,
      logs: run.progressLogPath,
      video: result.video,
      trace: result.trace,
      reason: result.reason
    }))
  ].filter((row) => row.screenshot || row.logs || row.video || row.trace || row.reason);

  if (!rows.length) return '<tr><td colspan="6">No evidence artifacts were attached.</td></tr>';

  const linkOrDash = (value) => value ? `<a href="../${escapeHtml(value)}">${escapeHtml(value)}</a>` : '-';
  return rows.map((row) => `<tr>
    <td>${escapeHtml(row.item)}</td>
    <td>${linkOrDash(row.screenshot)}</td>
    <td>${linkOrDash(row.video)}</td>
    <td>${linkOrDash(row.trace)}</td>
    <td>${linkOrDash(row.logs)}</td>
    <td>${escapeHtml(row.reason || '-')}</td>
  </tr>`).join('');
}

function roleReportHtml(run, data) {
  const executed = data.counts.passed + data.counts.failed;
  const browser = `${run.browserName || 'Google Chrome'}${run.browserVersion ? ` ${run.browserVersion}` : ''}`;
  const positiveCount = data.cases.filter((record) => scenarioKind(record) === 'Positive').length;
  const negativeCount = data.cases.filter((record) => scenarioKind(record) === 'Negative').length;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(data.roleName)} Report</title>
  <style>
    body { margin: 0; background: #f4f6f9; color: #172033; font-family: Inter, Segoe UI, Arial, sans-serif; }
    header, main { padding: 28px 40px; }
    header { background: #fff; border-bottom: 1px solid #dfe5ee; }
    h1, h2, p { margin: 0; }
    h1 { font-size: 30px; }
    h2 { margin: 24px 0 12px; font-size: 20px; }
    .grid { display: grid; gap: 14px; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 18px; }
    .card { background: #fff; border: 1px solid #dfe5ee; border-radius: 8px; padding: 16px; }
    .label { color: #607089; font-size: 12px; text-transform: uppercase; font-weight: 800; letter-spacing: .08em; }
    .value { display: block; margin-top: 7px; font-size: 25px; font-weight: 800; overflow-wrap: anywhere; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #dfe5ee; table-layout: fixed; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #dfe5ee; text-align: left; vertical-align: top; font-size: 14px; overflow-wrap: anywhere; }
    th { background: #f8fafc; color: #3e4b61; text-transform: uppercase; font-size: 12px; letter-spacing: .05em; }
    .status { display: inline-flex; border-radius: 999px; padding: 4px 9px; font-weight: 800; font-size: 12px; text-transform: uppercase; }
    .passed { background: #dff8ee; color: #04745a; }
    .failed { background: #ffe3e0; color: #af2f2a; }
    .skipped { background: #fff7d6; color: #8a5a00; }
    tr.failed { box-shadow: inset 6px 0 0 #e02424; background: #fff0ef; }
    tr.skipped { box-shadow: inset 6px 0 0 #d99a00; background: #fffaf0; }
    a { color: #2c6fbb; font-weight: 650; }
    @media (max-width: 1000px) { .grid { grid-template-columns: 1fr; } header, main { padding-left: 20px; padding-right: 20px; } }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(data.roleName)} Report</h1>
    <div class="grid">
      <div class="card"><span class="label">Environment</span><strong class="value">${escapeHtml(run.environmentName || 'Staging')}</strong></div>
      <div class="card"><span class="label">Browser</span><strong class="value">${escapeHtml(browser)}</strong></div>
      <div class="card"><span class="label">Execution Date</span><strong class="value">${formatDate(run.startTime)}</strong></div>
      <div class="card"><span class="label">Duration</span><strong class="value">${formatDuration(run.duration)}</strong></div>
    </div>
  </header>
  <main>
    <section class="grid">
      <div class="card"><span class="label">Total Test Cases</span><strong class="value">${data.cases.length}</strong></div>
      <div class="card"><span class="label">Passed</span><strong class="value">${data.counts.passed}</strong></div>
      <div class="card"><span class="label">Failed / Skipped</span><strong class="value">${data.counts.failed} / ${data.counts.skipped}</strong></div>
      <div class="card"><span class="label">Pass Percentage</span><strong class="value">${data.passRate}%</strong><p>${data.counts.passed} passed / ${executed} executed</p></div>
      <div class="card"><span class="label">Role User</span><strong class="value">${escapeHtml(data.username)}</strong></div>
      <div class="card"><span class="label">Modules Available</span><strong class="value">${escapeHtml(formatList(data.visibleTabs))}</strong></div>
      <div class="card"><span class="label">Positive Scenarios</span><strong class="value">${positiveCount}</strong></div>
      <div class="card"><span class="label">Negative Scenarios</span><strong class="value">${negativeCount}</strong></div>
    </section>
    <section>
      <h2>Module-wise Coverage</h2>
      <table><thead><tr><th>Module</th><th>Status</th><th>Passed</th><th>Failed</th><th>Skipped</th><th>Reason</th></tr></thead><tbody>${makeRoleModuleRows(data)}</tbody></table>
    </section>
    <section>
      <h2>Positive and Negative Scenario Coverage</h2>
      <table><thead><tr><th>Type</th><th>Module</th><th>Scenario</th><th>Status</th><th>Reason</th></tr></thead><tbody>${makeScenarioCoverageRows(data)}</tbody></table>
    </section>
    <section>
      <h2>Booking Types Covered</h2>
      <table><thead><tr><th>Booking Type</th><th>Status</th><th>Booking Ref</th><th>Reason</th><th>Duration</th><th>Evidence</th></tr></thead><tbody>${makeRoleBookingRows(data, run)}</tbody></table>
    </section>
    <section>
      <h2>Restricted Features Validated</h2>
      <table><thead><tr><th>Feature</th><th>Check</th><th>Status</th><th>Reason</th></tr></thead><tbody>${makeRestrictedRows(data)}</tbody></table>
    </section>
    <section>
      <h2>Failure Screenshots, Videos, Traces, and Logs</h2>
      <table><thead><tr><th>Item</th><th>Screenshot</th><th>Video</th><th>Trace</th><th>Log</th><th>Reason</th></tr></thead><tbody>${makeEvidenceRows(data, run)}</tbody></table>
    </section>
  </main>
</body>
</html>`;
}

function consolidatedRoleSummaryHtml(run, roleDataItems) {
  const rows = roleDataItems.map((data) => {
    const executed = data.counts.passed + data.counts.failed;
    const status = data.counts.failed ? 'failed' : data.counts.passed ? 'passed' : 'skipped';
    return `<tr class="testcase-row ${status}">
      <td>${escapeHtml(data.roleName)}</td>
      <td><span class="status ${status}">${status}</span></td>
      <td>${data.cases.length}</td>
      <td>${data.counts.passed}</td>
      <td>${data.counts.failed}</td>
      <td>${data.counts.skipped}</td>
      <td>${executed}</td>
      <td>${data.passRate}%</td>
      <td>${escapeHtml(formatList(data.visibleTabs))}</td>
      <td>${escapeHtml(formatList(data.restrictedTabs))}</td>
    </tr>`;
  }).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Consolidated Role Summary Report</title>
  <style>
    body { margin: 0; background: #f4f6f9; color: #172033; font-family: Inter, Segoe UI, Arial, sans-serif; }
    header, main { padding: 28px 40px; }
    header { background: #fff; border-bottom: 1px solid #dfe5ee; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #dfe5ee; table-layout: fixed; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #dfe5ee; text-align: left; vertical-align: top; font-size: 14px; overflow-wrap: anywhere; }
    th { background: #f8fafc; color: #3e4b61; text-transform: uppercase; font-size: 12px; letter-spacing: .05em; }
    .status { display: inline-flex; border-radius: 999px; padding: 4px 9px; font-weight: 800; font-size: 12px; text-transform: uppercase; }
    .passed { background: #dff8ee; color: #04745a; }
    .failed { background: #ffe3e0; color: #af2f2a; }
    .skipped { background: #fff7d6; color: #8a5a00; }
    tr.failed { box-shadow: inset 6px 0 0 #e02424; background: #fff0ef; }
    tr.skipped { box-shadow: inset 6px 0 0 #d99a00; background: #fffaf0; }
  </style>
</head>
<body>
  <header>
    <h1>Consolidated Role Summary Report</h1>
    <p>Environment: ${escapeHtml(run.environmentName || 'Staging')} | Browser: ${escapeHtml(run.browserName || 'Google Chrome')} ${escapeHtml(run.browserVersion || '')} | Execution: ${formatDate(run.startTime)} | Duration: ${formatDuration(run.duration)}</p>
  </header>
  <main>
    <table>
      <thead><tr><th>Role</th><th>Status</th><th>Total</th><th>Passed</th><th>Failed</th><th>Skipped</th><th>Executed</th><th>Pass %</th><th>Available Features</th><th>Restricted Features</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="10">No role data was recorded.</td></tr>'}</tbody>
    </table>
  </main>
</body>
</html>`;
}

function writeRoleReports(runs) {
  const run = runs[0];
  if (!run) return [];

  const roleNames = roleNamesForRun(run);
  const roleDataItems = roleNames.map((roleName) => roleData(run, roleName));
  const written = [];

  for (const data of roleDataItems) {
    const filePath = path.join(REPORTS_DIR, `${roleFileStem(data.roleName)}-report.html`);
    fs.writeFileSync(filePath, roleReportHtml(run, data), 'utf8');
    written.push(filePath);
  }

  const summaryPath = path.join(REPORTS_DIR, 'consolidated-role-summary-report.html');
  fs.writeFileSync(summaryPath, consolidatedRoleSummaryHtml(run, roleDataItems), 'utf8');
  written.push(summaryPath);
  return written;
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
      <h2>Generated Project Management Data</h2>
      <table>
        <thead><tr><th>Project ID</th><th>Access Point</th><th>Access Point ID</th><th>Resource</th><th>Availability Resource</th><th>Vehicle</th><th>Fuel Type</th><th>Equipment</th><th>Source</th></tr></thead>
        <tbody>${makeDynamicTestDataRows(runs)}</tbody>
      </table>
    </section>
    <section>
      <h2>Generated Role Users</h2>
      <table>
        <thead><tr><th>Created By Role</th><th>User Role</th><th>Name</th><th>Email</th><th>Password</th><th>Setup Status</th><th>Missing Setup Fields</th><th>Updated Organization</th><th>Source</th></tr></thead>
        <tbody>${makeGeneratedUserRows(runs)}</tbody>
      </table>
    </section>
    <section>
      <h2>Blocked / Skipped Dependencies</h2>
      <table>
        <thead><tr><th>Case ID</th><th>Flow</th><th>Scenario</th><th>Status</th><th>Depends On</th><th>Reason</th><th>Source</th></tr></thead>
        <tbody>${makeBlockedRows(runs)}</tbody>
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
        <thead><tr><th>User Role</th><th>Booking Type</th><th>Available</th><th>Enabled</th><th>Result</th><th>Booking Ref</th><th>Reason / Message</th><th>Duration</th><th>Evidence</th><th>Source</th></tr></thead>
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
        <thead><tr><th>User Role</th><th>Username</th><th>My Account Role</th><th>Expected Tabs</th><th>Actual Tabs</th><th>Missing Tabs</th><th>Unexpected Tabs</th><th>Additional Tabs</th><th>Vehicle Tracking</th><th>Permitted Actions</th><th>Direct URL Access</th><th>Result</th><th>Failure Reason</th><th>Screenshot</th></tr></thead>
        <tbody>${makeRoleNavigationRows(runs)}</tbody>
      </table>
    </section>
    <section>
      <h2>Role-Based Functional Flows</h2>
      <table>
        <thead><tr><th>User Role</th><th>Username</th><th>Available Tab</th><th>Functional Flow</th><th>Result</th><th>Duration</th><th>Visible Tabs</th><th>Reason</th><th>Evidence / Source</th></tr></thead>
        <tbody>${makeRoleFunctionalFlowRows(runs)}</tbody>
      </table>
    </section>
    <section>
      <h2>Entire Testcase Report</h2>
      <table>
        <thead><tr><th>Case ID</th><th>User Role</th><th>Flow</th><th>Step</th><th>Status</th><th>Duration</th><th>Timestamp</th><th>Error</th></tr></thead>
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
  const roleReportPaths = writeRoleReports(runs);

  console.log('Automation graphical report generated.');
  console.log(`Latest: ${latestPath}`);
  console.log(`Summary: ${summaryPath}`);
  for (const reportPath of roleReportPaths) {
    console.log(`Role report: ${reportPath}`);
  }

  if (options.noOpen) {
    console.log('Skipped opening latest dashboard in Chrome.');
  } else {
    openReportInChrome(latestPath);
    console.log('Opened latest dashboard in Chrome.');
  }
}

main();
