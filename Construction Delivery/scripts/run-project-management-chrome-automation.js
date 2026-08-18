#!/usr/bin/env node

/**
 * Project Management Chrome Automation Runner
 * 
 * This script automates the Project Management tab in Chrome by:
 * - Setting up a Chrome browser context with proper configuration
 * - Logging in to the application
 * - Running the full Project Management Environment Setting test flow
 * - Capturing test evidence and generating reports
 * 
 * Usage:
 *   npm run automate:project-management-chrome             (headed mode, opens report)
 *   npm run automate:project-management-chrome:headless    (headless mode, opens report)
 *   npm run automate:project-management-chrome -- --no-open
 * 
 * Environment Variables:
 *   - CHROME_PROJECT_MANAGEMENT_TIMEOUT_MS: Test timeout (default: 1800000ms / 30min)
 *   - PROJECT_MANAGEMENT_ACTION_GAP_MS: Delay between actions (default: 2000ms)
 *   - BASE_URL: Login base URL (default: https://stg-login.voyagecontrol.com)
 *   - APP_URL: Application URL (default: https://stg-app.voyagecontrol.com)
 *   - PROJECT_ID or BUCKINGHAM_PALACE_PROJECT_ID: Project ID (default: 5ET10000010)
 *   - VC_EMAIL: Login email
 *   - VC_PASSWORD: Login password
 */

const path = require('path');
const { loadEnvFile } = require('../utils/env');

loadEnvFile();

const BASE_URL = process.env.BASE_URL || 'https://stg-login.voyagecontrol.com';
const APP_URL = process.env.APP_URL || 'https://stg-app.voyagecontrol.com';
const HEADLESS = process.argv.includes('--headless');
const OPEN_REPORT = !process.argv.includes('--no-open');
const PROJECT_ID = process.env.PROJECT_ID || process.env.BUCKINGHAM_PALACE_PROJECT_ID || '5ET10000010';

/**
 * Verify Chrome is properly configured for Project Management automation
 */
async function verifyProjectManagementSetup() {
  console.log('\n🔍 Verifying Project Management automation setup...\n');
  console.log(`✅ Application origin: ${new URL(APP_URL).origin}`);
  console.log(`✅ Login origin: ${new URL(BASE_URL).origin}`);
  console.log(`✅ Project ID: ${PROJECT_ID}`);
  console.log(`✅ Headless mode: ${HEADLESS}`);
  console.log('✅ Browser verification is configuration-only so the automation opens one Chrome session.');
  console.log('\n✅ Project Management automation setup verified!\n');
}

/**
 * Run the Project Management test suite
 */
async function runProjectManagementTests() {
  const { spawn } = require('child_process');
  const playgroundCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  return new Promise((resolve, reject) => {
    console.log('Running Project Management automation suite in Chrome...\n');

    const flowArgs = [];
    if (HEADLESS) flowArgs.push('--headless');
    if (!OPEN_REPORT) flowArgs.push('--no-open');

    const args = ['run', 'automate:project-management-flow'];
    if (flowArgs.length) {
      args.push('--', ...flowArgs);
    }
    const testProcess = spawn(playgroundCommand, args, {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      shell: true
    });

    testProcess.on('error', (error) => {
      console.error('\n❌ Automation process error:', error.message);
      reject(error);
    });

    testProcess.on('exit', (code) => {
      if (code === 0) {
        console.log('\n✅ Project Management automation completed successfully!');
        resolve(code);
      } else {
        console.log(`\n⚠️  Automation completed with exit code ${code}`);
        resolve(code);
      }
    });
  });
}

/**
 * Main entry point
 */
async function main() {
  console.log('🚀 Project Management Chrome Automation');
  console.log('═'.repeat(50));

  try {
    await verifyProjectManagementSetup();
    const exitCode = await runProjectManagementTests();
    process.exit(exitCode);
  } catch (error) {
    console.error('\n❌ Project Management automation failed:');
    console.error(error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
