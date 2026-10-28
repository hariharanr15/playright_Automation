const path = require('path');
const base = require('./playwright.config');
const run = process.env.SCP_INVENTORY_RUN_DIR || path.join('reports', `inventory-${new Date().toISOString().replace(/[:.]/g, '-')}`);
module.exports = {
  ...base,
  testMatch: ['smoke/inventory-management/**/*.spec.js', 'regression/inventory-management/**/*.spec.js'],
  retries: 0,
  use: { ...base.use, trace: 'on', screenshot: 'off' },
  timeout: 240000,
  reporter: [['list'], ['html', { outputFolder: path.join(run, 'html'), open: 'never' }],
    ['json', { outputFile: path.join(run, 'results.json') }], [require.resolve('./scripts/inventory-reporter.js'), { outputFile: path.join(run, 'coverage.json') }]],
  outputDir: path.join(run, 'artifacts')
};
