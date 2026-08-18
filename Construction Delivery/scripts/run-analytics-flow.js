#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadEnvFile } = require('../utils/env');

const ROOT_DIR = path.resolve(__dirname, '..');
const RESULTS_DIR = path.join(ROOT_DIR, 'test-results');
const PLAYWRIGHT_JSON_DIR = path.join(RESULTS_DIR, 'analytics-json');
const UOM_EVIDENCE_PATH = path.join(RESULTS_DIR, 'analytics-uom-protocol-latest.json');
const SPEC_PATH = 'tests/regression/analytics-functional.spec.js';
const FLOW_KEY = 'analytics';
const FLOW_NAME = 'Analytics';
const SUCCESS_FALLBACK_STEPS = [
  'Navigate into Buckingham Palace project',
  'Verify project details and derive Country UOM',
  'Validate Summary Emission analytics date range and download',
  'Validate Vehicle Emission analytics units and records',
  'Validate Equipment Emission analytics units and records',
  'Validate Environment Reports analytics date range'
];

function parseArguments() {
  const args = process.argv.slice(2);
  const getArgNumber = (name, fallback) => {
    const prefix = `--${name}=`;
    const inline = args.find((arg) => arg.startsWith(prefix));
    const value = inline ? inline.slice(prefix.length) : args[args.indexOf(`--${name}`) + 1];
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };

  return {
    headless: args.includes('--headless'),
    noOpen: args.includes('--no-open'),
    reportOnly: args.includes('--report-only'),
    generateReport: !args.includes('--no-report'),
    timeout: getArgNumber('timeout', 900000)
  };
}

function formatTimestampForFile(value = new Date()) {
  return value.toISOString().replace(/[:.]/g, '-');
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read Playwright JSON report ${filePath}: ${error.message}`);
  }
}

function readOptionalJson(filePath) {
  try {
    return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : null;
  } catch {
    return null;
  }
}

function flattenSuites(suites = []) {
  const tests = [];

  for (const suite of suites) {
    for (const spec of suite.specs || []) {
      for (const testCase of spec.tests || []) {
        tests.push({
          title: spec.title,
          file: spec.file || '',
          outcome: testCase.outcome || 'unknown',
          results: testCase.results || []
        });
      }
    }

    tests.push(...flattenSuites(suite.suites || []));
  }

  return tests;
}

function flattenSteps(steps = []) {
  const rows = [];

  for (const step of steps) {
    if (step.title) rows.push(step);
    rows.push(...flattenSteps(step.steps || []));
  }

  return rows;
}

function findLatestPlaywrightJson() {
  if (!fs.existsSync(PLAYWRIGHT_JSON_DIR)) {
    throw new Error(`No Analytics Playwright JSON directory found: ${PLAYWRIGHT_JSON_DIR}`);
  }

  const [latest] = fs
    .readdirSync(PLAYWRIGHT_JSON_DIR)
    .filter((fileName) => fileName.endsWith('.json'))
    .map((fileName) => {
      const filePath = path.join(PLAYWRIGHT_JSON_DIR, fileName);
      return { filePath, mtimeMs: fs.statSync(filePath).mtimeMs };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  if (!latest) {
    throw new Error(`No Analytics Playwright JSON reports found in ${PLAYWRIGHT_JSON_DIR}`);
  }

  return latest.filePath;
}

function getRunTimes(json, fallbackStart, fallbackEnd) {
  const statsStart = json?.stats?.startTime ? new Date(json.stats.startTime) : null;
  const duration = Number(json?.stats?.duration);

  if (statsStart && !Number.isNaN(statsStart.getTime()) && Number.isFinite(duration)) {
    return {
      startedAt: statsStart,
      endedAt: new Date(statsStart.getTime() + duration)
    };
  }

  return {
    startedAt: fallbackStart,
    endedAt: fallbackEnd
  };
}

function getErrorMessage(result, step) {
  return step?.error?.message ||
    step?.error?.stack ||
    result?.error?.message ||
    result?.error?.stack ||
    null;
}

function normalizePlaywrightReport(json, options, startedAt, endedAt) {
  const testCases = flattenSuites(json.suites || []);
  const latestResults = testCases.map((testCase) => ({
    testCase,
    result: testCase.results[testCase.results.length - 1] || {}
  }));
  const status = latestResults.every(({ result, testCase }) =>
    (result.status || testCase.outcome) === 'passed' || (result.status || testCase.outcome) === 'skipped'
  ) ? 'passed' : 'failed';

  const tests = [];
  for (const { testCase, result } of latestResults) {
    const steps = flattenSteps(result.steps || []);
    const testStatus = result.status || testCase.outcome || 'unknown';

    if (!steps.length && testStatus === 'passed') {
      const perStepDuration = Math.round((result.duration || 0) / SUCCESS_FALLBACK_STEPS.length);
      for (const stepName of SUCCESS_FALLBACK_STEPS) {
        tests.push({
          stepNumber: tests.length + 1,
          id: `TC-${String(tests.length + 1).padStart(2, '0')}`,
          flowName: FLOW_NAME,
          name: stepName,
          status: 'passed',
          timestamp: startedAt.toISOString(),
          duration: perStepDuration,
          error: null
        });
      }
      continue;
    }

    if (!steps.length) {
      tests.push({
        stepNumber: tests.length + 1,
        id: `TC-${String(tests.length + 1).padStart(2, '0')}`,
        flowName: FLOW_NAME,
        name: testCase.title,
        status: testStatus,
        timestamp: startedAt.toISOString(),
        duration: result.duration || 0,
        error: getErrorMessage(result, null)
      });
      continue;
    }

    for (const step of steps) {
      const stepStatus = step.error ? 'failed' : 'passed';
      tests.push({
        stepNumber: tests.length + 1,
        id: `TC-${String(tests.length + 1).padStart(2, '0')}`,
        flowName: FLOW_NAME,
        name: step.title || testCase.title,
        status: stepStatus,
        timestamp: startedAt.toISOString(),
        duration: step.duration || 0,
        error: stepStatus === 'failed' ? getErrorMessage(result, step) : null
      });
    }
  }

  const passed = tests.filter((test) => test.status === 'passed').length;
  const failed = tests.filter((test) => test.status === 'failed').length;

  return {
    startTime: startedAt.toISOString(),
    endTime: endedAt.toISOString(),
    duration: endedAt.getTime() - startedAt.getTime(),
    status,
    total: tests.length,
    passed,
    failed,
    workflow: 'analytics-emissions-uom-automation',
    environmentName: process.env.ENVIRONMENT_NAME || 'Staging',
    appUrl: process.env.APP_URL || 'https://stg-app.voyagecontrol.com',
    browserMode: options.headless ? 'headless' : 'headed',
    viewport: null,
    analyticsUomProtocol: readOptionalJson(UOM_EVIDENCE_PATH),
    tests,
    timestamp: endedAt.toISOString(),
    source: {
      spec: SPEC_PATH,
      playwrightStatus: status
    }
  };
}

function runPlaywright(options, jsonPath) {
  const args = [
    'playwright',
    'test',
    SPEC_PATH,
    '--project="Google Chrome"',
    '--workers=1',
    '--reporter=json',
    `--timeout=${options.timeout}`
  ];

  if (options.headless) {
    args.push('--headed=false');
  } else {
    args.push('--headed');
  }

  console.log(`Running Analytics automation in ${options.headless ? 'headless' : 'headed'} Chrome...`);
  console.log(`npx ${args.join(' ')}`);

  return spawnSync('npx', args, {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      PLAYWRIGHT_JSON_OUTPUT_NAME: jsonPath,
      ANALYTICS_FLOW_TIMEOUT_MS: String(options.timeout),
      HIGHLIGHT_MS: process.env.HIGHLIGHT_MS || '900',
      STEP_WAIT_MS: process.env.STEP_WAIT_MS || '1000'
    },
    shell: process.platform === 'win32',
    stdio: 'inherit'
  });
}

function generateDashboard(options) {
  if (!options.generateReport) return;

  const reportArgs = ['generate-automation-report.js', '--latest-flow', FLOW_KEY];
  if (options.noOpen) reportArgs.push('--no-open');

  const result = spawnSync('node', reportArgs, {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    throw new Error('Analytics automation completed, but dashboard generation failed.');
  }
}

function createFailedFallbackReport(options, startedAt, endedAt, result) {
  return {
    startTime: startedAt.toISOString(),
    endTime: endedAt.toISOString(),
    duration: endedAt.getTime() - startedAt.getTime(),
    status: 'failed',
    total: 1,
    passed: 0,
    failed: 1,
    workflow: 'analytics-emissions-uom-automation',
    environmentName: process.env.ENVIRONMENT_NAME || 'Staging',
    appUrl: process.env.APP_URL || 'https://stg-app.voyagecontrol.com',
    browserMode: options.headless ? 'headless' : 'headed',
    viewport: null,
    analyticsUomProtocol: readOptionalJson(UOM_EVIDENCE_PATH),
    tests: [{
      stepNumber: 1,
      id: 'TC-01',
      flowName: FLOW_NAME,
      name: 'Run Analytics Playwright spec',
      status: 'failed',
      timestamp: startedAt.toISOString(),
      duration: endedAt.getTime() - startedAt.getTime(),
      error: `Playwright did not create the JSON report. Exit code: ${result.status ?? 1}`
    }],
    timestamp: endedAt.toISOString(),
    source: {
      spec: SPEC_PATH,
      playwrightStatus: 'failed'
    }
  };
}

function main() {
  loadEnvFile();
  const options = parseArguments();
  let startedAt = new Date();
  let endedAt = startedAt;
  let jsonPath = options.reportOnly
    ? null
    : path.join(PLAYWRIGHT_JSON_DIR, `analytics-playwright-${formatTimestampForFile(startedAt)}.json`);
  let result = { status: 0 };
  let playwrightJson = null;

  fs.mkdirSync(PLAYWRIGHT_JSON_DIR, { recursive: true });
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  if (options.reportOnly) {
    jsonPath = findLatestPlaywrightJson();
    console.log(`Regenerating Analytics dashboard from ${path.relative(ROOT_DIR, jsonPath)}`);
  } else {
    fs.rmSync(UOM_EVIDENCE_PATH, { force: true });
    result = runPlaywright(options, jsonPath);
  }

  endedAt = new Date();
  if (fs.existsSync(jsonPath)) {
    playwrightJson = readJson(jsonPath);
    ({ startedAt, endedAt } = getRunTimes(playwrightJson, startedAt, endedAt));
  }

  const normalized = playwrightJson
    ? normalizePlaywrightReport(playwrightJson, options, startedAt, endedAt)
    : createFailedFallbackReport(options, startedAt, endedAt, result);
  const reportPath = path.join(RESULTS_DIR, `${FLOW_KEY}-report-${formatTimestampForFile(endedAt)}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(normalized, null, 2), 'utf8');

  console.log('\nAnalytics Automation Report');
  console.log(`Status: ${normalized.status.toUpperCase()}`);
  console.log(`Test Steps: ${normalized.passed}/${normalized.total} passed`);
  console.log(`Duration: ${Math.round(normalized.duration / 1000)}s`);
  console.log(`Report: ${path.relative(ROOT_DIR, reportPath)}`);

  generateDashboard(options);

  if ((result.status ?? 1) !== 0 || normalized.status !== 'passed') {
    process.exitCode = result.status || 1;
  }
}

main();
