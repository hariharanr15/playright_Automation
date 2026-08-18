#!/usr/bin/env node

/**
 * Chrome Notification Automation Runner
 * 
 * This script automates browser notifications in Chrome by:
 * - Granting notification permissions to the app domain
 * - Installing a notification observer to capture all notification events
 * - Running the notification status matrix tests with notification capture enabled
 * 
 * Usage:
 *   npm run automate:notification-chrome              (headed mode)
 *   npm run automate:notification-chrome:headless    (headless mode)
 */

const path = require('path');
const { chromium } = require('@playwright/test');
const { loadEnvFile } = require('../utils/env');

loadEnvFile();

const CHROME_APP_URL = process.env.APP_URL || 'https://stg-app.voyagecontrol.com';
const CHROME_BASE_URL = process.env.BASE_URL || 'https://stg-login.voyagecontrol.com';
const HEADLESS = process.argv.includes('--headless');

async function testNotificationPermissions() {
  console.log('\n🔍 Testing Chrome notification permissions setup...\n');

  const browser = await chromium.launch({
    headless: HEADLESS,
    args: [
      '--start-maximized',
      '--force-device-scale-factor=1'
    ]
  });

  try {
    // Create a context with notification permissions granted
    const context = await browser.newContext({
      permissions: ['notifications'],
      locale: 'en-US'
    });

    // Grant specific permissions to app origins
    const appOrigin = new URL(CHROME_APP_URL).origin;
    const loginOrigin = new URL(CHROME_BASE_URL).origin;

    await context.grantPermissions(['notifications'], { origin: appOrigin });
    await context.grantPermissions(['notifications'], { origin: loginOrigin });

    console.log(`✅ Notification permissions granted to ${appOrigin}`);
    console.log(`✅ Notification permissions granted to ${loginOrigin}`);

    // Create a page and test notification detection
    const page = await context.newPage();

    // Install notification observer to capture all notification events
    const observerInstalled = await installNotificationObserver(page);
    console.log(observerInstalled
      ? '✅ Notification observer installed'
      : '⚠️  Notification observer install completed with warnings'
    );

    // Verify browser notification support
    const permission = await page.evaluate(() => {
      if (!('Notification' in window)) return 'unsupported';
      return Notification.permission;
    });

    console.log(`✅ Notification API permission: ${permission}`);

    // Test creating a browser notification
    const testNotified = await page.evaluate(() => {
      if (Notification.permission === 'granted') {
        try {
          new Notification('Test Notification', {
            body: 'This is a test notification from Playwright automation.',
            tag: 'test-notification',
            requireInteraction: false
          });
          return true;
        } catch (error) {
          return false;
        }
      }
      return false;
    });

    if (testNotified) {
      console.log('✅ Test notification created successfully');
    }

    // Read captured notifications
    const captured = await page.evaluate(() => window.__vcBrowserNotifications || []);
    console.log(`✅ Browser notifications captured: ${captured.length}`);

    if (captured.length > 0) {
      console.log('\n📋 Captured notifications:');
      captured.forEach((notification, index) => {
        console.log(`  ${index + 1}. ${notification.title} (${notification.source})`);
        if (notification.body) {
          console.log(`     Body: ${notification.body}`);
        }
      });
    }

    await context.close();
    console.log('\n✅ Chrome notification automation setup verified successfully!\n');
    console.log('Now running the full notification test suite...\n');

  } catch (error) {
    console.error('\n❌ Chrome notification setup verification failed:', error.message);
    console.error('\nDebug info:');
    console.error('  - APP_URL:', CHROME_APP_URL);
    console.error('  - BASE_URL:', CHROME_BASE_URL);
    console.error('  - Headless mode:', HEADLESS);
    throw error;
  } finally {
    await browser.close();
  }
}

async function installNotificationObserver(page) {
  const observerScript = `
(() => {
  if (window.__vcBrowserNotificationObserverInstalled) return;
  window.__vcBrowserNotificationObserverInstalled = true;
  window.__vcBrowserNotifications = window.__vcBrowserNotifications || [];

  const record = (source, title, options = {}) => {
    const notification = {
      source,
      title: String(title || ''),
      body: String(options?.body || ''),
      tag: String(options?.tag || ''),
      timestamp: new Date().toISOString()
    };
    window.__vcBrowserNotifications.push(notification);
    console.log('[VC-NOTIFICATION-OBSERVER]', JSON.stringify(notification));
  };

  // Hook into the native Notification constructor
  const OriginalNotification = window.Notification;
  if (typeof OriginalNotification === 'function') {
    function ObservedNotification(title, options) {
      record('Notification', title, options);
      if (OriginalNotification.permission === 'granted') {
        try {
          return new OriginalNotification(title, options);
        } catch (e) {
          console.error('[VC-NOTIFICATION-OBSERVER] Error creating notification:', e.message);
        }
      }
    }

    Object.setPrototypeOf(ObservedNotification, OriginalNotification);
    ObservedNotification.prototype = OriginalNotification.prototype;
    Object.defineProperty(ObservedNotification, 'permission', {
      get: () => OriginalNotification.permission,
      configurable: true
    });
    ObservedNotification.requestPermission = (...args) => OriginalNotification.requestPermission(...args);
    window.Notification = ObservedNotification;
  }

  // Hook into ServiceWorker notifications
  if (window.ServiceWorkerRegistration?.prototype?.showNotification) {
    const originalShowNotification = window.ServiceWorkerRegistration.prototype.showNotification;
    window.ServiceWorkerRegistration.prototype.showNotification = function observedShowNotification(title, options) {
      record('ServiceWorkerRegistration.showNotification', title, options);
      return originalShowNotification.call(this, title, options);
    };
  }
})();
`;

  try {
    await page.addInitScript({ content: observerScript });
    await page.evaluate(observerScript);
    return true;
  } catch (error) {
    console.warn('[VC-NOTIFICATION-OBSERVER] Warning during installation:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Chrome Notification Automation Setup');
  console.log('═'.repeat(50));

  try {
    // Run the notification permission and observer verification
    await testNotificationPermissions();

    // Now run the actual notification status matrix test
    const { spawn } = require('child_process');
    const playgroundCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    
    console.log('Running notification automation suite...');
    const args = [
      'run',
      'automate:notification-functional',
      ...(HEADLESS ? [] : [])
    ];

    const testProcess = spawn(playgroundCommand, args, {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      shell: true
    });

    testProcess.on('error', (error) => {
      console.error('\n❌ Automation process error:', error.message);
      process.exit(1);
    });

    testProcess.on('exit', (code) => {
      if (code === 0) {
        console.log('\n✅ Chrome notification automation completed successfully!');
      } else {
        console.log(`\n⚠️  Automation completed with exit code ${code}`);
      }
      process.exit(code);
    });

  } catch (error) {
    console.error('\n❌ Chrome notification automation failed:');
    console.error(error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
