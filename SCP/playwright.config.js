const { defineConfig } = require('@playwright/test');
const { loadEnvFile } = require('./utils/env');

loadEnvFile();

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
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/playwright-html', open: 'never' }]
  ],
  outputDir: 'test-results/playwright-artifacts',
  use: {
    baseURL: process.env.SCP_BASE_URL,
    headless,
    actionTimeout: 30000,
    navigationTimeout: 45000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    launchOptions: {
      slowMo: Number(process.env.SCP_SLOW_MO || 100),
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
