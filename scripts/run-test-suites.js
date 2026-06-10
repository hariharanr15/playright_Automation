#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawn, spawnSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const RESULTS_DIR = path.join(ROOT_DIR, 'test-results', 'suite-json');
const REPORTS_DIR = path.join(ROOT_DIR, 'reports');
const REPORT_PATH = path.join(REPORTS_DIR, 'suite-execution-report.html');

const suites = [
  {
    key: 'smoke',
    name: 'Smoke Tests',
    testDir: 'tests/smoke',
    jsonPath: path.join(RESULTS_DIR, 'smoke-results.json')
  },
  {
    key: 'regression',
    name: 'Regression Tests',
    testDir: 'tests/regression',
    jsonPath: path.join(RESULTS_DIR, 'regression-results.json')
  }
];

function parseArguments() {
  const suiteIndex = process.argv.indexOf('--suite');
  const suiteValue = suiteIndex !== -1 ? process.argv[suiteIndex + 1] : null;

  return {
    suite: suiteValue || (process.argv.includes('--smoke-only') ? 'smoke' : process.argv.includes('--regression-only') ? 'regression' : 'all')
  };
}

function selectedSuites(options) {
  if (options.suite === 'all') {
    return suites;
  }

  const selected = suites.filter((suite) => suite.key === options.suite);
  if (!selected.length) {
    throw new Error(`Unknown suite "${options.suite}". Use smoke, regression, or all.`);
  }

  return selected;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function runSuite(suite) {
  ensureDir(path.dirname(suite.jsonPath));

  const args = [
    'playwright',
    'test',
    suite.testDir,
    '--project="Google Chrome"',
    '--headed',
    '--workers=1',
    '--reporter=json'
  ];

  console.log(`\n=== Running ${suite.name} ===`);
  console.log(`npx ${args.join(' ')}`);

  const result = spawnSync('npx', args, {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      HIGHLIGHT_MS: process.env.HIGHLIGHT_MS || '900',
      STEP_WAIT_MS: process.env.STEP_WAIT_MS || '1000',
      PLAYWRIGHT_JSON_OUTPUT_NAME: suite.jsonPath
    },
    shell: process.platform === 'win32',
    stdio: 'inherit'
  });

  return {
    ...suite,
    exitCode: result.status ?? 1,
    signal: result.signal || null
  };
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return {
      config: {},
      suites: [],
      errors: [{ message: `Could not parse JSON report: ${error.message}` }]
    };
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

function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds)) return '-';
  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function fileUrl(filePath) {
  return pathToFileURL(path.resolve(filePath)).href;
}

function flattenSteps(steps = []) {
  const rows = [];

  for (const step of steps) {
    rows.push({
      title: step.title || step.category || 'Unnamed step',
      category: step.category || '',
      duration: step.duration || 0,
      status: step.error ? 'failed' : 'passed',
      error: step.error?.message || step.error?.stack || ''
    });

    rows.push(...flattenSteps(step.steps || []));
  }

  return rows.filter((step) => step.category === 'test.step' || step.error || /TC-|Open|Select|Complete|Submit|Start|Enter|Send|Find|Return|Undo|Cancel|Check/i.test(step.title));
}

function flattenSuites(suitesToFlatten = [], suiteTitle = []) {
  const tests = [];

  for (const suite of suitesToFlatten) {
    const titleParts = [...suiteTitle, suite.title].filter(Boolean);

    for (const spec of suite.specs || []) {
      for (const testCase of spec.tests || []) {
        const result = testCase.results?.[testCase.results.length - 1] || {};
        const status = result.status || testCase.outcome || 'unknown';
        const attachments = result.attachments || [];
        const urlAttachment = attachments.find((attachment) => attachment.name === 'failed-page-url');
        const screenshotAttachments = attachments.filter((attachment) =>
          /screenshot|failure/i.test(attachment.name || '') ||
          /image\/png/i.test(attachment.contentType || '')
        );

        tests.push({
          title: spec.title,
          file: spec.file || '',
          suitePath: titleParts.join(' / '),
          status,
          duration: result.duration || 0,
          retry: result.retry || 0,
          error: result.error?.message || result.error?.stack || '',
          failedUrl: urlAttachment?.body || '',
          screenshots: screenshotAttachments.map((attachment) => attachment.path).filter(Boolean),
          steps: flattenSteps(result.steps || [])
        });
      }
    }

    tests.push(...flattenSuites(suite.suites || [], titleParts));
  }

  return tests;
}

function statusClass(status) {
  if (status === 'passed') return 'passed';
  if (status === 'skipped') return 'skipped';
  return 'failed';
}

function summarizeTests(tests) {
  return tests.reduce(
    (summary, testCase) => {
      summary.total += 1;
      if (testCase.status === 'passed') summary.passed += 1;
      else if (testCase.status === 'skipped') summary.skipped += 1;
      else summary.failed += 1;
      summary.duration += testCase.duration || 0;
      return summary;
    },
    { total: 0, passed: 0, failed: 0, skipped: 0, duration: 0 }
  );
}

function renderStepRows(steps) {
  if (!steps.length) {
    return '<tr><td colspan="4">No step details were reported.</td></tr>';
  }

  return steps.map((step) => `
    <tr>
      <td>${escapeHtml(step.title)}</td>
      <td><span class="pill ${statusClass(step.status)}">${escapeHtml(step.status)}</span></td>
      <td>${formatDuration(step.duration)}</td>
      <td>${escapeHtml(step.error)}</td>
    </tr>
  `).join('');
}

function renderTestCard(testCase) {
  const screenshots = testCase.screenshots.map((screenshotPath) => `
    <a href="${fileUrl(screenshotPath)}" target="_blank">
      <img src="${fileUrl(screenshotPath)}" alt="Failure screenshot" />
    </a>
  `).join('');

  return `
    <section class="test-card">
      <div class="test-header">
        <div>
          <h3>${escapeHtml(testCase.title)}</h3>
          <p>${escapeHtml(testCase.suitePath)}${testCase.file ? ` · ${escapeHtml(testCase.file)}` : ''}</p>
        </div>
        <span class="pill ${statusClass(testCase.status)}">${escapeHtml(testCase.status)}</span>
      </div>
      <dl class="meta">
        <div><dt>Duration</dt><dd>${formatDuration(testCase.duration)}</dd></div>
        <div><dt>Retry</dt><dd>${escapeHtml(testCase.retry)}</dd></div>
        <div><dt>Failed URL</dt><dd>${testCase.failedUrl ? escapeHtml(testCase.failedUrl) : '-'}</dd></div>
      </dl>
      ${testCase.error ? `<pre class="error">${escapeHtml(testCase.error)}</pre>` : ''}
      ${screenshots ? `<div class="screenshots">${screenshots}</div>` : ''}
      <table>
        <thead><tr><th>Step</th><th>Status</th><th>Duration</th><th>Error</th></tr></thead>
        <tbody>${renderStepRows(testCase.steps)}</tbody>
      </table>
    </section>
  `;
}

function renderSuite(suite) {
  const summary = summarizeTests(suite.tests);

  return `
    <section class="suite">
      <div class="suite-heading">
        <div>
          <h2>${escapeHtml(suite.name)}</h2>
          <p>Exit code: ${suite.exitCode}${suite.signal ? `, signal: ${escapeHtml(suite.signal)}` : ''}</p>
        </div>
        <div class="summary-grid compact">
          <div><strong>${summary.total}</strong><span>Total</span></div>
          <div><strong>${summary.passed}</strong><span>Passed</span></div>
          <div><strong>${summary.failed}</strong><span>Failed</span></div>
          <div><strong>${summary.skipped}</strong><span>Skipped</span></div>
          <div><strong>${formatDuration(summary.duration)}</strong><span>Duration</span></div>
        </div>
      </div>
      ${suite.tests.map(renderTestCard).join('')}
    </section>
  `;
}

function generateReport(results) {
  ensureDir(REPORTS_DIR);

  const suitesWithTests = results.map((suite) => {
    const json = readJson(suite.jsonPath);
    return {
      ...suite,
      tests: json ? flattenSuites(json.suites || []) : [],
      reportErrors: json?.errors || []
    };
  });

  const overall = summarizeTests(suitesWithTests.flatMap((suite) => suite.tests));
  const generatedAt = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const suiteLabel = suitesWithTests.length === 1
    ? `${suitesWithTests[0].name} execution`
    : 'Smoke and regression executed independently';

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Automation Suite Execution Report</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; color: #172033; background: #f6f8fb; }
    header { background: #172033; color: #fff; padding: 28px 36px; }
    header h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    header p { margin: 0; color: #d6deea; }
    main { padding: 28px 36px 48px; }
    h2, h3 { letter-spacing: 0; }
    .summary-grid { display: grid; grid-template-columns: repeat(5, minmax(120px, 1fr)); gap: 12px; margin-top: 20px; }
    .summary-grid div { background: #fff; border: 1px solid #dce3ed; border-radius: 6px; padding: 14px; }
    .summary-grid strong { display: block; font-size: 22px; }
    .summary-grid span { color: #637083; font-size: 12px; text-transform: uppercase; }
    .summary-grid.compact { margin-top: 0; min-width: 520px; }
    .suite { margin-top: 28px; }
    .suite-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 16px; }
    .suite-heading h2 { margin: 0 0 6px; }
    .suite-heading p { margin: 0; color: #637083; }
    .test-card { background: #fff; border: 1px solid #dce3ed; border-radius: 6px; margin: 16px 0; padding: 18px; }
    .test-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
    .test-header h3 { margin: 0 0 6px; font-size: 18px; }
    .test-header p { margin: 0; color: #637083; font-size: 13px; }
    .pill { border-radius: 999px; padding: 5px 10px; font-size: 12px; font-weight: 700; text-transform: uppercase; white-space: nowrap; }
    .passed { background: #dff8e7; color: #126c34; }
    .failed { background: #ffe2e2; color: #9d2020; }
    .skipped { background: #fff1c7; color: #7a5300; }
    .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; }
    .meta div { border: 1px solid #e6ebf2; border-radius: 6px; padding: 10px; min-width: 0; }
    .meta dt { color: #637083; font-size: 12px; text-transform: uppercase; }
    .meta dd { margin: 4px 0 0; word-break: break-word; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; table-layout: fixed; }
    th, td { border: 1px solid #e6ebf2; padding: 9px; text-align: left; vertical-align: top; word-break: break-word; }
    th { background: #f0f4f9; }
    pre.error { background: #301515; color: #ffecec; border-radius: 6px; padding: 12px; overflow: auto; white-space: pre-wrap; }
    .screenshots { display: flex; gap: 12px; flex-wrap: wrap; margin: 12px 0; }
    .screenshots img { max-width: 320px; border: 1px solid #dce3ed; border-radius: 6px; }
    @media (max-width: 900px) {
      main, header { padding-left: 18px; padding-right: 18px; }
      .suite-heading { display: block; }
      .summary-grid, .summary-grid.compact, .meta { grid-template-columns: 1fr; min-width: 0; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Automation Suite Execution Report</h1>
    <p>Generated ${escapeHtml(generatedAt)} · Chrome headed execution · ${escapeHtml(suiteLabel)}</p>
    <div class="summary-grid">
      <div><strong>${overall.total}</strong><span>Total Tests</span></div>
      <div><strong>${overall.passed}</strong><span>Passed</span></div>
      <div><strong>${overall.failed}</strong><span>Failed</span></div>
      <div><strong>${overall.skipped}</strong><span>Skipped</span></div>
      <div><strong>${formatDuration(overall.duration)}</strong><span>Total Duration</span></div>
    </div>
  </header>
  <main>
    ${suitesWithTests.map(renderSuite).join('')}
  </main>
</body>
</html>`;

  fs.writeFileSync(REPORT_PATH, html);
  return REPORT_PATH;
}

function openReportInChrome(reportPath) {
  if (process.argv.includes('--no-open')) {
    return;
  }

  const url = fileUrl(reportPath);
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const child = spawn(candidate, [url], { detached: true, stdio: 'ignore' });
      child.unref();
      return;
    }
  }

  const child = spawn('cmd', ['/c', 'start', 'chrome', url], {
    detached: true,
    stdio: 'ignore',
    shell: false
  });
  child.unref();
}

function main() {
  const options = parseArguments();
  const suitesToRun = selectedSuites(options);

  ensureDir(RESULTS_DIR);
  ensureDir(REPORTS_DIR);

  for (const suite of suitesToRun) {
    fs.rmSync(suite.jsonPath, { force: true });
  }

  const results = suitesToRun.map(runSuite);
  const reportPath = generateReport(results);
  console.log(`\nHTML report generated: ${reportPath}`);
  openReportInChrome(reportPath);

  const failed = results.some((result) => result.exitCode !== 0);
  process.exit(failed ? 1 : 0);
}

main();
