const path = require('path');
const base = require('./playwright.config');
const run = process.env.SCP_PENDING_RUN_DIR || path.join('reports', `scp-pending-${new Date().toISOString().replace(/[:.]/g, '-')}`);
module.exports = { ...base,
  testMatch: ['smoke/enterprise/**/*.spec.js', 'regression/enterprise/**/*.spec.js', 'regression/management-dashboard/**/*.spec.js',
    'regression/pending/**/*.spec.js'],
  retries: 0, workers: 1, timeout: 90000,
  use: { ...base.use, trace: 'on', screenshot: 'off', actionTimeout: 15000 },
  reporter: [['list'], ['html', { outputFolder: path.join(run, 'html'), open: 'never' }],
    ['json', { outputFile: path.join(run, 'results.json') }],
    [require.resolve('./scripts/scp-readonly-reporter'), { outputFile: path.join(run, 'coverage.json') }]],
  outputDir: path.join(run, 'artifacts') };
