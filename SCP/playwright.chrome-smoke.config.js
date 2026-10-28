const path = require('path');
process.env.SCP_READONLY_EXECUTION = 'true';
const base = require('./playwright.config');
const { safeSmokeFiles } = require('./fixtures/chromeReadonlyExecution');
if (!process.env.SCP_EXECUTION_DIR) throw new Error('Set SCP_EXECUTION_DIR to a new evidence directory; existing reports must be preserved.');
const run = path.resolve(process.env.SCP_EXECUTION_DIR);
module.exports = { ...base, testMatch: safeSmokeFiles, workers: 1, retries: 0, timeout: 120000,
  use: { ...base.use, trace: 'on', screenshot: 'off', actionTimeout: 20000 },
  projects: [{ name: 'Google Chrome', use: { channel: 'chrome', viewport: null } }],
  reporter: [['list'], ['html', { outputFolder: path.join(run, 'html'), open: 'never' }],
    ['json', { outputFile: path.join(run, 'results.json') }],
    [require.resolve('./scripts/scp-readonly-reporter'), { outputFile: path.join(run, 'coverage.json') }]],
  outputDir: path.join(run, 'artifacts') };
