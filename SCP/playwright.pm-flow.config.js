// Project Management flow: one headed Google Chrome window sized to the screen, one worker, one test per suite.
// Step-level retries are owned by tests/pm-flow/support/pm-runner.js, so Playwright retries stay at 0.
const path = require('path');
const { defineConfig } = require('@playwright/test');
const { loadEnvFile } = require('./utils/env');

loadEnvFile();
const out = process.env.PM_FLOW_OUT ? path.resolve(process.env.PM_FLOW_OUT) : path.resolve(__dirname, 'reports/pm-flow/latest');

module.exports = defineConfig({
  testDir: './tests/pm-flow',
  testMatch: '*.spec.js',
  timeout: 60 * 60 * 1000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: path.join(out, 'playwright-results.json') }]],
  outputDir: path.join(out, 'playwright-artifacts'),
  use: {
    baseURL: process.env.SCP_BASE_URL,
    headless: /^true$/i.test(process.env.PM_FLOW_HEADLESS || ''),
    actionTimeout: 20000,
    navigationTimeout: 45000,
    screenshot: 'off',
    trace: 'retain-on-failure',
    video: 'off',
    acceptDownloads: true,
    viewport: null,
    launchOptions: { args: ['--start-maximized', ...(process.env.SCP_FORCE_SCALE_1 === 'true' ? ['--force-device-scale-factor=1'] : [])] }
  },
  projects: [{ name: 'Google Chrome', use: { channel: 'chrome', viewport: null } }]
});
