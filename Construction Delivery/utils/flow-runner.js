const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function parseFlowArguments(defaultTimeout) {
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
    timeout: getArgNumber('timeout', defaultTimeout)
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

function normalizePlaywrightReport(json, config, options, startedAt, endedAt) {
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
      const fallbackSteps = config.successFallbackSteps || [testCase.title];
      const perStepDuration = Math.round((result.duration || 0) / fallbackSteps.length);

      for (const stepName of fallbackSteps) {
        tests.push({
          stepNumber: tests.length + 1,
          id: `TC-${String(tests.length + 1).padStart(2, '0')}`,
          flowName: config.flowName,
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
        flowName: config.flowName,
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
        flowName: config.flowName,
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
    workflow: config.workflow,
    environmentName: process.env.ENVIRONMENT_NAME || 'Staging',
    appUrl: process.env.APP_URL || 'https://stg-app.voyagecontrol.com',
    browserMode: options.headless ? 'headless' : 'headed',
    viewport: null,
    tests,
    timestamp: endedAt.toISOString(),
    source: {
      spec: config.specPath,
      playwrightStatus: status
    }
  };
}

function findLatestPlaywrightJson(directory, label) {
  if (!fs.existsSync(directory)) {
    throw new Error(`No ${label} Playwright JSON directory found: ${directory}`);
  }

  const [latest] = fs
    .readdirSync(directory)
    .filter((fileName) => fileName.endsWith('.json'))
    .map((fileName) => {
      const filePath = path.join(directory, fileName);
      return { filePath, mtimeMs: fs.statSync(filePath).mtimeMs };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  if (!latest) {
    throw new Error(`No ${label} Playwright JSON reports found in ${directory}`);
  }

  return latest.filePath;
}

function createFailedFallbackReport(config, options, startedAt, endedAt, result) {
  return {
    startTime: startedAt.toISOString(),
    endTime: endedAt.toISOString(),
    duration: endedAt.getTime() - startedAt.getTime(),
    status: 'failed',
    total: 1,
    passed: 0,
    failed: 1,
    workflow: config.workflow,
    environmentName: process.env.ENVIRONMENT_NAME || 'Staging',
    appUrl: process.env.APP_URL || 'https://stg-app.voyagecontrol.com',
    browserMode: options.headless ? 'headless' : 'headed',
    viewport: null,
    tests: [{
      stepNumber: 1,
      id: 'TC-01',
      flowName: config.flowName,
      name: `Run ${config.flowName} Playwright spec`,
      status: 'failed',
      timestamp: startedAt.toISOString(),
      duration: endedAt.getTime() - startedAt.getTime(),
      error: `Playwright did not create the JSON report. Exit code: ${result.status ?? 1}`
    }],
    timestamp: endedAt.toISOString(),
    source: {
      spec: config.specPath,
      playwrightStatus: 'failed'
    }
  };
}

function runPlaywright(config, options, jsonPath) {
  const playwrightCli = require.resolve('@playwright/test/cli');
  const specSelector = config.specSelector || config.specPath;
  const args = [
    playwrightCli,
    'test',
    specSelector,
    '--project=Google Chrome',
    '--workers=1',
    '--reporter=json',
    `--timeout=${options.timeout}`
  ];

  if (!options.headless) {
    args.push('--headed');
  }

  console.log(`Running ${config.flowName} automation in ${options.headless ? 'headless' : 'headed'} Chrome...`);
  console.log(`${process.execPath} ${args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg)).join(' ')}`);

  return spawnSync(process.execPath, args, {
    cwd: config.rootDir,
    env: {
      ...process.env,
      PLAYWRIGHT_JSON_OUTPUT_NAME: jsonPath,
      PLAYWRIGHT_HEADLESS: options.headless ? 'true' : 'false',
      [config.timeoutEnvName]: String(options.timeout),
      HIGHLIGHT_MS: process.env.HIGHLIGHT_MS || '900',
      STEP_WAIT_MS: process.env.STEP_WAIT_MS || '1000'
    },
    stdio: 'inherit'
  });
}

function generateDashboard(config, options) {
  if (!options.generateReport) return;

  const reportArgs = ['generate-automation-report.js', '--latest-flow', config.flowKey];
  if (options.noOpen) reportArgs.push('--no-open');

  const result = spawnSync('node', reportArgs, {
    cwd: config.rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    throw new Error(`${config.flowName} automation completed, but dashboard generation failed.`);
  }
}

function runPlaywrightFlow(config) {
  const options = parseFlowArguments(config.defaultTimeout);
  let startedAt = new Date();
  let endedAt = startedAt;
  let jsonPath = options.reportOnly
    ? null
    : path.join(config.playwrightJsonDir, `${config.flowKey}-playwright-${formatTimestampForFile(startedAt)}.json`);
  let result = { status: 0 };
  let playwrightJson = null;

  fs.mkdirSync(config.playwrightJsonDir, { recursive: true });
  fs.mkdirSync(config.resultsDir, { recursive: true });

  if (options.reportOnly) {
    jsonPath = findLatestPlaywrightJson(config.playwrightJsonDir, config.flowName);
    console.log(`Regenerating ${config.flowName} dashboard from ${path.relative(config.rootDir, jsonPath)}`);
  } else {
    result = runPlaywright(config, options, jsonPath);
  }

  endedAt = new Date();
  if (fs.existsSync(jsonPath)) {
    playwrightJson = readJson(jsonPath);
    ({ startedAt, endedAt } = getRunTimes(playwrightJson, startedAt, endedAt));
  }

  const normalized = playwrightJson
    ? normalizePlaywrightReport(playwrightJson, config, options, startedAt, endedAt)
    : createFailedFallbackReport(config, options, startedAt, endedAt, result);
  const reportPath = path.join(config.resultsDir, `${config.flowKey}-report-${formatTimestampForFile(endedAt)}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(normalized, null, 2), 'utf8');

  console.log(`\n${config.flowName} Automation Report`);
  console.log(`Status: ${normalized.status.toUpperCase()}`);
  console.log(`Test Steps: ${normalized.passed}/${normalized.total} passed`);
  console.log(`Duration: ${Math.round(normalized.duration / 1000)}s`);
  console.log(`Report: ${path.relative(config.rootDir, reportPath)}`);

  generateDashboard(config, options);

  if ((result.status ?? 1) !== 0 || normalized.status !== 'passed') {
    process.exitCode = result.status || 1;
  }
}

module.exports = { runPlaywrightFlow };
