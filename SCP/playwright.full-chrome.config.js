const path = require('path');
const base = require('./playwright.config');
// Entire in-scope SCP application in installed Chrome. Setup Wizard is excluded scope, not held.
if (!process.env.SCP_EXECUTION_DIR) throw new Error('Set SCP_EXECUTION_DIR to a new evidence directory; existing reports must be preserved.');
// Targeted reruns set SCP_PLAYWRIGHT_SUBDIR (playwright-rerun-*) so the original attempt is preserved.
const run = path.resolve(process.env.SCP_EXECUTION_DIR, process.env.SCP_PLAYWRIGHT_SUBDIR || 'playwright');
const headless = /^true$/i.test(process.env.HEADLESS || '');
module.exports = { ...base,
  testMatch: ['smoke/**/*.spec.js', 'regression/**/*.spec.js'],
  testIgnore: ['regression/project-setup-wizard/**'],
  workers: 1, retries: 0, timeout: 300000,
  use: { ...base.use, headless, trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'retain-on-failure' },
  projects: [{ name: 'Google Chrome', use: { channel: 'chrome', headless, viewport: null } }],
  reporter: [['list'], ['html', { outputFolder: path.join(run, 'html'), open: 'never' }],
    ['json', { outputFile: path.join(run, 'results.json') }],
    [require.resolve('./scripts/scp-readonly-reporter'), { outputFile: path.join(run, 'coverage.json') }]],
  outputDir: path.join(run, 'artifacts') };
