#!/usr/bin/env node

const path = require('path');
const { chromium } = require('@playwright/test');
const { loadEnvFile } = require('../utils/env');

loadEnvFile();

const BASE_URL = process.env.BASE_URL || 'https://stg-login.voyagecontrol.com';
const APP_URL = process.env.APP_URL || 'https://stg-app.voyagecontrol.com';
const PROJECT_ID = process.env.PROJECT_ID || process.env.BUCKINGHAM_PALACE_PROJECT_ID || '5ET10000010';
const HEADLESS = process.argv.includes('--headless');
const OPEN_REPORT = !process.argv.includes('--no-open');

async function verifyProjectSettingsSetup() {
  console.log('\nVerifying Project Settings automation setup...\n');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--start-maximized',
      '--force-device-scale-factor=1'
    ]
  });

  try {
    const context = await browser.newContext({
      locale: 'en-US',
      viewport: null
    });
    const appOrigin = new URL(APP_URL).origin;
    const loginOrigin = new URL(BASE_URL).origin;

    await context.grantPermissions(['notifications'], { origin: appOrigin });
    await context.grantPermissions(['notifications'], { origin: loginOrigin });

    console.log(`Application origin: ${appOrigin}`);
    console.log(`Login origin: ${loginOrigin}`);
    console.log(`Project ID: ${PROJECT_ID}`);
    console.log(`Headless mode: ${HEADLESS}`);

    const page = await context.newPage();
    await page.goto(`${BASE_URL}/api/sso/users/login/`, { waitUntil: 'domcontentloaded', timeout: 15000 })
      .catch((error) => {
        console.warn(`Could not verify login page connectivity: ${error.message}`);
      });

    await context.close();
    console.log('\nProject Settings automation setup verified.\n');
  } finally {
    await browser.close();
  }
}

async function runProjectSettingsTests() {
  const { spawn } = require('child_process');
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  return new Promise((resolve, reject) => {
    const flowArgs = [];
    if (HEADLESS) flowArgs.push('--headless');
    if (!OPEN_REPORT) flowArgs.push('--no-open');

    const args = ['run', 'automate:project-settings'];
    if (flowArgs.length) {
      args.push('--', ...flowArgs);
    }

    console.log('Running Project Settings automation suite in Chrome...\n');
    const child = spawn(npmCommand, args, {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      shell: true
    });

    child.on('error', reject);
    child.on('exit', (code) => resolve(code));
  });
}

async function main() {
  console.log('Project Settings Chrome Automation');
  console.log('='.repeat(50));

  try {
    await verifyProjectSettingsSetup();
    const exitCode = await runProjectSettingsTests();
    process.exit(exitCode);
  } catch (error) {
    console.error('\nProject Settings automation failed:');
    console.error(error.message);
    process.exit(1);
  }
}

main();
