const { defineConfig } = require('@playwright/test');
const { loadEnvFile } = require('./utils/env');

loadEnvFile();
const { getSlowMoMs } = require('./utils/execution-mode');

const headless = /^true$/i.test(process.env.PLAYWRIGHT_HEADLESS || process.env.HEADLESS || '');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: [
    'smoke/**/*.spec.js',
    'regression/**/*.spec.js'
  ],
  timeout: 300000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/playwright-html', open: 'never' }],
    ['json', { outputFile: 'test-results/scp-results.json' }],
    [require.resolve('./scripts/detailed-execution-reporter'), {}]
  ],
  outputDir: 'test-results/playwright-artifacts',
  use: {
    baseURL: process.env.SCP_BASE_URL,
    headless,
    actionTimeout: 30000,
    navigationTimeout: 45000,
    screenshot: 'only-on-failure',
    trace: 'on',
    video: 'retain-on-failure',
    launchOptions: {
      // Low-level slowMo only in demo mode; normal mode paces major actions instead (utils/execution-mode.js).
      slowMo: getSlowMoMs(),
      args: ['--start-maximized', '--force-device-scale-factor=1']
    },
    viewport: null
  },
  projects: [
    {
      name: 'Google Chrome',
      use: {
        channel: 'chrome',
        viewport: null
      }
    }
  ]
});
