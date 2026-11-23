// Shared harness for the Project Management flow specs: one browser tab, one sign-in, one report per run.
const fs = require('fs');
const path = require('path');
const { getScpConfig } = require('../../../config/scp.config');
const { maskEmail } = require('../../../utils/access/access-model');
const { installVisuals, setBanner } = require('./pm-visuals');
const { PmNavigator } = require('./pm-navigator');
const { PmRun } = require('./pm-runner');
const { writeReport } = require('./pm-report');

function outputDirectory(suite) {
  if (process.env.PM_FLOW_OUT) return path.resolve(process.env.PM_FLOW_OUT);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.resolve(__dirname, '../../../reports/pm-flow', `${suite.toLowerCase()}-${stamp}`);
}

async function runPmSuite({ page, browserName, suite, scenarios }) {
  const config = getScpConfig();
  const outDir = outputDirectory(suite);
  fs.mkdirSync(outDir, { recursive: true });
  await installVisuals(page.context());
  const navigator = new PmNavigator(page, config);
  const only = String(process.env.PM_FLOW_ONLY || '').split(',').map(item => item.trim()).filter(Boolean);
  const run = new PmRun({ suite, page, outDir, only, recover: () => navigator.recover() });
  run.result.environment = {
    project: config.projectName,
    account: maskEmail(config.username),
    role: 'Project Admin',
    browser: `Google Chrome ${page.context().browser()?.version() || ''}`.trim(),
    baseUrl: config.baseUrl,
    logins: 1
  };
  console.log(`PM ${suite} run → ${outDir}`);
  try {
    await scenarios({ run, page, navigator, config, outDir });
  } finally {
    run.result.environment.navigations = navigator.navigations;
    await setBanner(page, { suite: suite.toUpperCase(), title: 'Run complete – see report', step: '' });
    const result = run.finish();
    const report = writeReport(result, outDir);
    const s = result.summary;
    console.log(`\nPM ${suite}: ${s.passed} passed, ${s.failed} failed, ${s.blocked} blocked, ${s.skipped} skipped of ${s.total}`);
    console.log(`Report: ${report}`);
    if (result.rerun.length) console.log(`Re-run later: PM_FLOW_ONLY=${result.rerun.join(',')}`);
  }
  return run.result;
}

module.exports = { runPmSuite };
