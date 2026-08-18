#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { loadEnvFile } = require('../utils/env');
const { runPlaywrightFlow } = require('../utils/flow-runner');

const ROOT_DIR = path.resolve(__dirname, '..');
const RESULTS_DIR = path.join(ROOT_DIR, 'test-results');
const isFunctionalFlow = process.argv.includes('--functional');
const FLOW_KEY = isFunctionalFlow ? 'notification-functional-flow' : 'notification-status-matrix';

loadEnvFile();

process.env.NOTIFICATION_STATUS_EVENT_KEYS = process.env.NOTIFICATION_STATUS_EVENT_KEYS ||
  (isFunctionalFlow ? 'bookingCreated' : 'all');
process.env.NOTIFICATION_STATUS_MODE_KEYS = process.env.NOTIFICATION_STATUS_MODE_KEYS ||
  (isFunctionalFlow ? 'allEnabled' : 'all');
process.env.NOTIFICATION_SKIP_RESTORE = process.env.NOTIFICATION_SKIP_RESTORE ||
  (isFunctionalFlow ? 'true' : 'false');
process.env.NOTIFICATION_STATUS_EVENT_WAIT_MS = process.env.NOTIFICATION_STATUS_EVENT_WAIT_MS ||
  (isFunctionalFlow ? '60000' : '20000');

function assertInside(parentPath, candidatePath) {
  const parent = path.resolve(parentPath);
  const candidate = path.resolve(candidatePath);
  if (candidate !== parent && !candidate.startsWith(`${parent}${path.sep}`)) {
    throw new Error(`Refusing to remove path outside ${parent}: ${candidate}`);
  }
}

function removePath(targetPath, rootPath) {
  if (!fs.existsSync(targetPath)) return 0;
  assertInside(rootPath, targetPath);
  fs.rmSync(targetPath, { recursive: true, force: true });
  return 1;
}

function cleanupOldNotificationOutput() {
  if (process.argv.includes('--keep-history')) return;

  let removed = 0;
  const artifactDir = path.join(RESULTS_DIR, 'playwright-artifacts');
  const screenshotsDir = path.join(ROOT_DIR, 'screenshots');

  if (fs.existsSync(RESULTS_DIR)) {
    for (const entry of fs.readdirSync(RESULTS_DIR, { withFileTypes: true })) {
      const targetPath = path.join(RESULTS_DIR, entry.name);
      if (entry.isFile() && /^notification.*-report-.*\.json$/i.test(entry.name)) {
        removed += removePath(targetPath, RESULTS_DIR);
      }
      if (entry.isDirectory() && /^notification.*-json$/i.test(entry.name)) {
        removed += removePath(targetPath, RESULTS_DIR);
      }
    }
  }

  if (fs.existsSync(artifactDir)) {
    for (const entry of fs.readdirSync(artifactDir, { withFileTypes: true })) {
      if (entry.isDirectory() && /notification/i.test(entry.name)) {
        removed += removePath(path.join(artifactDir, entry.name), artifactDir);
      }
    }
  }

  if (fs.existsSync(screenshotsDir)) {
    for (const entry of fs.readdirSync(screenshotsDir, { withFileTypes: true })) {
      if (entry.isFile() && /notification/i.test(entry.name)) {
        removed += removePath(path.join(screenshotsDir, entry.name), screenshotsDir);
      }
    }
  }

  if (removed > 0) {
    console.log(`Cleaned ${removed} old notification output item(s).`);
  }
}

const functionalConfig = {
  flowName: 'Notification Functional Flow',
  workflow: 'notification-functional-new-booking-validation',
  timeoutEnvName: 'NOTIFICATION_FUNCTIONAL_FLOW_TIMEOUT_MS',
  defaultTimeout: 1800000,
  successFallbackSteps: [
    'Open authenticated project and detect current Yopmail user',
    'Open Notification settings and verify Push and Email switches for New Booking Created',
    'Set notification mode: All Notifications Enabled',
    'Validate Booking Approved email and push notification with booking reference',
    'Restore all My Bookings email and push notifications'
  ]
};

const matrixConfig = {
  flowName: 'Notification Status Matrix',
  workflow: 'notification-status-matrix-validation',
  timeoutEnvName: 'NOTIFICATION_STATUS_MATRIX_TIMEOUT_MS',
  defaultTimeout: 2400000,
  successFallbackSteps: [
    'Open authenticated project and detect current Yopmail user',
    'Open Notification settings and verify Push and Email switches',
    'Set notification mode: All Notifications Enabled',
    'Validate New Booking Created / Booking Approved email and push notifications with booking reference',
    'Validate Booking Checked In email and push notifications',
    'Validate Booking Checked Out email and push notifications',
    'Validate Booking Cancelled email and push notifications',
    'Validate Booking Declined email and push notifications',
    'Set notification mode: All Notifications Disabled',
    'Validate disabled email and push notifications for all booking events',
    'Set notification mode: Push Notification Only',
    'Validate push-only notifications for all booking events',
    'Set notification mode: Email Notification Only',
    'Validate email-only notifications for all booking events',
    'Restore all My Bookings email and push notifications'
  ]
};

const selectedConfig = isFunctionalFlow ? functionalConfig : matrixConfig;

cleanupOldNotificationOutput();

runPlaywrightFlow({
  rootDir: ROOT_DIR,
  resultsDir: RESULTS_DIR,
  playwrightJsonDir: path.join(RESULTS_DIR, `${FLOW_KEY}-json`),
  specPath: 'tests/regression/notification-status-matrix.spec.js',
  flowKey: FLOW_KEY,
  ...selectedConfig
});
