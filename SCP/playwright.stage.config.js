const path = require('path');
const base = require('./playwright.config');
// One full-regression stage; the orchestrator passes the stage's files and a new evidence directory.
if (!process.env.SCP_EXECUTION_DIR) throw new Error('Set SCP_EXECUTION_DIR to a new evidence directory; existing reports must be preserved.');
const run = path.resolve(process.env.SCP_EXECUTION_DIR);
module.exports = { ...base,
  testMatch: ['smoke/**/*.spec.js', 'regression/**/*.spec.js'],
  testIgnore: ['regression/project-setup-wizard/**'],
  workers: 1, retries: 0,
  use: { ...base.use, trace: 'on', screenshot: 'off' },
  reporter: [['list'], ['html', { outputFolder: path.join(run, 'html'), open: 'never' }],
    ['json', { outputFile: path.join(run, 'results.json') }],
    [require.resolve('./scripts/scp-readonly-reporter'), { outputFile: path.join(run, 'coverage.json') }]],
  outputDir: path.join(run, 'artifacts') };
