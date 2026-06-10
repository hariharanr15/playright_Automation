#!/usr/bin/env node

const { chromium } = require('playwright');
const { UserManagementPage } = require('../pages/booking/user-management.page');

function getArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

async function main() {
  const email = getArg('email');
  if (!email) {
    throw new Error('Pass --email=user@yopmail.com');
  }

  const name = getArg('name', 'Hari 2');
  const [firstName, ...lastParts] = name.split(/\s+/);
  const user = {
    name,
    firstName: getArg('first-name', firstName || name),
    lastName: getArg('last-name', lastParts.join(' ') || 'Automation'),
    email,
    mobile: getArg('mobile', '9876543210'),
    address: getArg('address', '2nd Main Road')
  };

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    slowMo: Number(process.env.SLOW_MO || 150),
    args: ['--start-maximized']
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true
  });
  const page = await context.newPage();
  const userManagement = new UserManagementPage(page);

  try {
    await userManagement.acceptInvitationAndCompleteAccountSetup(user);
  } finally {
    if (process.env.KEEP_BROWSER_OPEN === '1') {
      console.log('KEEP_BROWSER_OPEN=1 set, leaving Chrome open for inspection.');
    } else {
      await browser.close().catch(() => null);
    }
  }
}

main().catch((error) => {
  console.error(`\nAccept existing invite failed: ${error.message}`);
  process.exit(1);
});
