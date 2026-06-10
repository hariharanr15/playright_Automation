const { defineConfig } = require('@playwright/test');

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
    headless: false,
    actionTimeout: 45000,
    navigationTimeout: 45000,
    viewport: null,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: {
      slowMo: 150,
      args: ['--start-maximized', '--force-device-scale-factor=1']
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
