const { defineConfig } = require('@playwright/test');
const { loadAutomationEnvironment } = require('./utils/env');

loadAutomationEnvironment();
const headless = /^true$/i.test(process.env.PLAYWRIGHT_HEADLESS || process.env.HEADLESS || '');
const slowMo = Number(process.env.PLAYWRIGHT_SLOW_MO_MS ?? 150);

module.exports = defineConfig({
  testDir: './tests',
  testMatch: [
    'smoke/**/*.spec.js',
    'regression/**/*.spec.js'
  ],
  timeout: 420000,
  fullyParallel: false,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/playwright-html', open: 'never' }]
  ],
  outputDir: 'test-results/playwright-artifacts',
  use: {
    headless,
    actionTimeout: 45000,
    navigationTimeout: 45000,
    viewport: null,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: {
      slowMo,
      args: ['--start-maximized', '--force-device-scale-factor=1', '--high-dpi-support=1']
    }
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
