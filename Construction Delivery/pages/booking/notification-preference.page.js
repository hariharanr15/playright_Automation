const { clickHighlighted, highlight } = require('../../utils/highlight');
const { loginIfVisible } = require('../../utils/login');
const { DashboardPage } = require('./dashboard.page');

const DEFAULT_EMAIL = process.env.VC_EMAIL || 'hariharan.r@neuralrays.ai';
const DEFAULT_PASSWORD = process.env.VC_PASSWORD || 'Master@15';

class NotificationPreferencePage {
  constructor(page, options = {}) {
    this.page = page;
    this.options = {
      appUrl: process.env.APP_URL || 'https://stg-app.voyagecontrol.com',
      baseUrl: process.env.BASE_URL || 'https://stg-login.voyagecontrol.com',
      projectId: process.env.PROJECT_ID || '5ET10000010',
      email: DEFAULT_EMAIL,
      password: DEFAULT_PASSWORD,
      ...options
    };

    this.platformProjectLink = page.getByRole('link', { name: /Construction Delivery|V3 Construction deliveries/i }).first();
    this.locationHeading = page.getByRole('heading', { name: /Buckingham Palace/i }).first();
    this.accountSettingsButton = page.getByRole('button', { name: /Account settings/i }).first();
    this.notificationPreferencesMenuItem = page
      .getByRole('menuitem', { name: /Notification Preferences/i })
      .first();
  }

  async allowBrowserNotifications() {
    const origins = [
      new URL(this.options.baseUrl).origin,
      new URL(this.options.appUrl).origin
    ];

    for (const origin of origins) {
      await this.page.context().grantPermissions(['notifications'], { origin });
    }

    return this.getBrowserNotificationPermission();
  }

  async getBrowserNotificationPermission() {
    return this.page.evaluate(() => {
      if (!('Notification' in window)) return 'unsupported';
      return Notification.permission;
    }).catch(() => 'unknown');
  }

  async loginIfNeeded() {
    return loginIfVisible(this.page, {
      email: this.options.email,
      password: this.options.password,
      visibleTimeout: 7000,
      postLoginWaitMs: 1500,
      fill: async (locator, value, label) => locator.fill(value, { timeout: 15000 }).catch(async () => {
        await highlight(locator, label).catch(() => null);
        await locator.fill(value);
      }),
      click: clickHighlighted,
      missingCredentialsMessage: 'Login page is visible and VC_EMAIL/VC_PASSWORD are not configured.',
      errorMessage: 'Notification Preference flow could not log in; check VC_EMAIL/VC_PASSWORD.'
    });
  }

  async openAuthenticatedShell() {
    await this.allowBrowserNotifications();
    await this.page.goto(`${this.options.appUrl.replace(/\/$/, '')}/login`, { waitUntil: 'domcontentloaded' });
    await this.loginIfNeeded();
    await this.enterDefaultProjectContext();
    await this.page.locator('body').waitFor({ state: 'visible', timeout: 30000 });
    return this.allowBrowserNotifications();
  }

  async enterDefaultProjectContext() {
    if (await this.accountSettingsButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      return;
    }

    if (await this.platformProjectLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await clickHighlighted(this.platformProjectLink, 'Construction Delivery');
      await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    }

    if (await this.locationHeading.isVisible({ timeout: 7000 }).catch(() => false)) {
      await clickHighlighted(this.locationHeading, 'Buckingham Palace');
      await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    }

    if (await this.accountSettingsButton.isVisible({ timeout: 7000 }).catch(() => false)) {
      return;
    }

    const dashboard = new DashboardPage(this.page);
    try {
      if (await dashboard.clickLocationProjectCard('Buckingham Palace')) {
        await dashboard.waitForPageState(dashboard.bookingMenu, 'Booking menu');
        return;
      }

      if (await dashboard.projectLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await dashboard.selectProject();
        await dashboard.selectLocation();
      }
    } catch (error) {
      console.log(`Notification Preference project navigation fallback: ${error.message}`);
      await this.page.goto(`${this.options.appUrl}/5ET10000010/home`, { waitUntil: 'domcontentloaded' })
        .catch(() => null);
      await this.loginIfNeeded();
    }
  }

  async openNotificationPreferences() {
    const preferenceUrls = [
      `${this.options.appUrl}/${this.options.projectId}/notification/preference`,
      `${this.options.appUrl}/notification/preference`
    ];
    let lastError;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await this.dismissBlockingDialogs();
      await this.enterDefaultProjectContext();

      if (!await this.openFromAccountMenu()) {
        await this.page.goto(preferenceUrls[attempt % preferenceUrls.length], { waitUntil: 'domcontentloaded' });
        await this.loginIfNeeded();
      }

      try {
        await this.waitForLoaded();
        return this.getBrowserNotificationPermission();
      } catch (error) {
        lastError = error;
        await this.page.goto(`${this.options.appUrl}/${this.options.projectId}/home`, { waitUntil: 'domcontentloaded' })
          .catch(() => null);
        await this.loginIfNeeded();
      }
    }

    throw lastError || new Error('Notification Preferences did not load.');
  }

  async dismissBlockingDialogs() {
    await this.page.keyboard.press('Escape').catch(() => null);
    await this.page.waitForTimeout(500).catch(() => null);

    const closeCandidates = [
      this.page.getByRole('button', { name: /^Close$/i }).first(),
      this.page.getByRole('button', { name: /^Cancel$/i }).first(),
      this.page.locator('button.close, [aria-label="Close"], .modal.show button:has-text("Close")').first()
    ];

    for (const candidate of closeCandidates) {
      if (await candidate.isVisible({ timeout: 500 }).catch(() => false)) {
        await candidate.click({ force: true, timeout: 1500 }).catch(() => null);
        await this.page.waitForTimeout(500).catch(() => null);
      }
    }
  }

  async openFromAccountMenu() {
    if (!await this.accountSettingsButton.isVisible({ timeout: 7000 }).catch(() => false)) {
      return false;
    }

    await clickHighlighted(this.accountSettingsButton, 'Account settings');
    await clickHighlighted(this.notificationPreferencesMenuItem, 'Notification Preferences');
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    return true;
  }

  async waitForLoaded() {
    await this.page.locator('body').waitFor({ state: 'visible', timeout: 30000 });
    await this.page.locator('[role="progressbar"], .MuiCircularProgress-root').first()
      .waitFor({ state: 'hidden', timeout: 30000 })
      .catch(() => null);

    await this.page.getByText(/Notification Preferences|Push Notifications?|My Bookings/i)
      .first()
      .waitFor({ state: 'visible', timeout: 30000 });
    await this.waitForPreferenceTableReady();
  }

  async readNotificationBadgeCount() {
    return this.page.evaluate(() => {
      const normalize = (value = '') => value.replace(/\s+/g, ' ').trim();
      const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
      const notificationButton = buttons.find((button) => {
        const text = normalize([
          button.getAttribute('aria-label'),
          button.getAttribute('title'),
          button.innerText,
          button.textContent,
          Array.from(button.querySelectorAll('img'))
            .map((image) => image.getAttribute('alt'))
            .join(' ')
        ].filter(Boolean).join(' '));

        return /notification/i.test(text);
      });

      if (!notificationButton) {
        return null;
      }

      const text = normalize(notificationButton.innerText || notificationButton.textContent || '');
      const badge = text.match(/\d+/);
      return badge ? Number(badge[0]) : 0;
    }).catch(() => null);
  }

  async waitForNotificationBadgeIncrease(previousCount, timeout = Number(process.env.NOTIFICATION_BADGE_WAIT_MS || 60000)) {
    const deadline = Date.now() + timeout;
    let currentCount = await this.readNotificationBadgeCount();

    while (Date.now() < deadline) {
      currentCount = await this.readNotificationBadgeCount();
      if (typeof previousCount === 'number' && typeof currentCount === 'number' && currentCount > previousCount) {
        return { increased: true, before: previousCount, after: currentCount };
      }
      await this.page.waitForTimeout(1000);
    }

    return { increased: false, before: previousCount, after: currentCount };
  }

  async openNotificationCenter() {
    const notificationButton = this.page
      .getByRole('button', { name: /notification/i })
      .first();

    await clickHighlighted(notificationButton, 'Notification center');
    await this.page.waitForTimeout(1500);
  }

  async readNotificationCenterText() {
    return this.page.evaluate(() => {
      const normalize = (value = '') => value.replace(/\s+/g, ' ').trim();
      const isVisible = (element) => {
        const box = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return box.width > 0 &&
          box.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };

      const overlaySelectors = [
        '[role="dialog"]',
        '[role="menu"]',
        '[role="listbox"]',
        '.MuiPopover-root',
        '.MuiMenu-root',
        '.MuiPaper-root',
        '[class*="notification" i]'
      ];
      const overlays = Array.from(document.querySelectorAll(overlaySelectors.join(', ')))
        .filter(isVisible)
        .map((element) => normalize(element.innerText || element.textContent || ''))
        .filter(Boolean);

      return Array.from(new Set(overlays)).join(' | ');
    }).catch(() => '');
  }

  async waitForBookingNotificationInCenter(bookingRef, timeout = Number(process.env.NOTIFICATION_CENTER_WAIT_MS || 60000)) {
    const deadline = Date.now() + timeout;
    const expected = bookingRef
      ? new RegExp(`${this.escapeRegExp(bookingRef)}|booking|created|scheduled|delivery`, 'i')
      : /booking|created|scheduled|delivery/i;
    let text = '';

    while (Date.now() < deadline) {
      await this.openNotificationCenter().catch(() => null);
      text = await this.readNotificationCenterText();
      if (expected.test(text)) {
        return { found: true, text };
      }
      await this.page.keyboard.press('Escape').catch(() => null);
      await this.page.waitForTimeout(1500);
    }

    return { found: false, text };
  }

  async enablePushNotifications() {
    return this.setPushNotificationsEnabled(true);
  }

  async disablePushNotifications() {
    return this.setPushNotificationsEnabled(false);
  }

  async readPushNotificationState() {
    await this.page.getByText(/Push Notifications?/i).first()
      .waitFor({ state: 'visible', timeout: 30000 });

    return {
      browserPermission: await this.getBrowserNotificationPermission(),
      appPushSwitch: await this.readSwitchNearText(/Push Notifications?/i, 'Push notifications')
    };
  }

  async setPushNotificationsEnabled(enabled) {
    await this.allowBrowserNotifications();
    const browserPermission = await this.getBrowserNotificationPermission();
    if (browserPermission !== 'granted') {
      throw new Error(`Browser notifications are not granted for automation. Current permission: ${browserPermission}`);
    }

    await this.page.getByText(/Push Notifications?/i).first()
      .waitFor({ state: 'visible', timeout: 30000 });
    const appPushSwitch = await this.setSwitchNearText(/Push Notifications?/i, 'Push notifications', enabled);
    await this.waitForToastOrSettle();

    return {
      browserPermission: await this.getBrowserNotificationPermission(),
      appPushSwitch
    };
  }

  async enableMyBookingsPreferences() {
    await this.waitForPreferenceTableReady();
    const updated = await this.setMyBookingsSwitches(true);
    await this.saveIfAvailable();
    await this.waitForToastOrSettle();
    await this.waitForPreferenceTableReady();
    const verified = await this.readMyBookingsSwitches();

    return {
      updated,
      verified
    };
  }

  async disableMyBookingsEmailAndPushPreferences() {
    await this.waitForPreferenceTableReady();
    const updated = await this.setMyBookingsSwitches(false, ['email', 'push']);
    await this.saveIfAvailable();
    await this.waitForToastOrSettle();
    await this.waitForPreferenceTableReady();
    const verified = await this.readMyBookingsSwitches(['email', 'push'], false);

    return {
      updated,
      verified
    };
  }

  async disableAllMyBookingsEmailPreferences() {
    await this.waitForPreferenceTableReady();
    const updated = await this.setMyBookingsSwitches(false, ['email']);
    await this.saveIfAvailable();
    await this.waitForToastOrSettle();
    await this.waitForPreferenceTableReady();
    const verified = await this.readMyBookingsSwitches(['email'], false);

    return { updated, verified };
  }

  async setMyBookingsNotificationPreferences({ email = true, mobile = true } = {}) {
    await this.waitForPreferenceTableReady();
    const updated = {
      email: await this.setMyBookingsSwitches(email, ['email']),
      mobile: await this.setMyBookingsSwitches(mobile, ['mobile'])
    };
    await this.saveIfAvailable();
    await this.waitForToastOrSettle();
    await this.waitForPreferenceTableReady();
    const verified = {
      email: await this.readMyBookingsSwitches(['email'], email),
      mobile: await this.readMyBookingsSwitches(['mobile'], mobile)
    };

    return { updated, verified };
  }

  async captureMyBookingsNotificationPreferences(columns = ['email', 'mobile']) {
    await this.waitForPreferenceTableReady();
    return this.evaluateMyBookingsSwitches({
      click: false,
      columns,
      expectedEnabled: null
    });
  }

  async enableOnlyMyBookingsEmailRows(rowPatterns = []) {
    await this.waitForPreferenceTableReady();
    const disableAll = await this.setMyBookingsSwitches(false, ['email']);
    const enabledRows = await this.setMyBookingsRowsSwitches(rowPatterns, ['email'], true);
    await this.saveIfAvailable();
    await this.waitForToastOrSettle();
    await this.waitForPreferenceTableReady();

    return {
      disableAll,
      enabledRows,
      verified: await this.readMyBookingsRowsSwitches(rowPatterns, ['email'], true)
    };
  }

  async waitForPreferenceTableReady() {
    await this.page.waitForFunction(() => {
      const normalize = (value = '') => value.replace(/\s+/g, ' ').trim();
      const isVisible = (element) => {
        const box = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return box.width > 0 &&
          box.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };
      const bodyText = normalize(document.body.innerText || document.body.textContent || '');
      const hasMyBookingsText = /Pending Approval/i.test(bodyText) && /\bEmail\b/i.test(bodyText) && /\bMobile\b/i.test(bodyText);
      const hasVisibleSwitches = Array.from(document.querySelectorAll(
        'input[type="checkbox"], [role="switch"], button[aria-checked], .MuiSwitch-root input'
      )).some((control) => {
        const visibleWrapper = control.closest('label') || control.closest('.MuiSwitch-root') || control.parentElement;
        return visibleWrapper && isVisible(visibleWrapper);
      });

      return hasMyBookingsText && hasVisibleSwitches;
    }, null, { timeout: 30000 });
  }

  async ensureSwitchNearText(pattern, label) {
    return this.setSwitchNearText(pattern, label, true);
  }

  async setSwitchNearText(pattern, label, enabled) {
    await highlight(this.page.getByText(pattern).first(), label).catch(() => null);

    const result = await this.page.evaluate(({ source, flags, enabled }) => {
      const targetPattern = new RegExp(source, flags);
      const normalize = (value = '') => value.replace(/\s+/g, ' ').trim();
      const isVisible = (element) => {
        const box = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      };
      const isControlVisible = (control) => isVisible(control) ||
        isVisible(control.closest('label') || control.closest('.MuiSwitch-root') || control.parentElement);
      const getSwitches = (root) => Array.from(root.querySelectorAll(
        'input[type="checkbox"], [role="switch"], button[aria-checked], .MuiSwitch-root input'
      )).filter(isControlVisible);
      const isEnabled = (control) => {
        if ('checked' in control) return Boolean(control.checked);
        const ariaChecked = control.getAttribute('aria-checked');
        if (ariaChecked !== null) return ariaChecked === 'true';
        return /checked/i.test(control.className || control.closest('[class*="checked" i]')?.className || '');
      };
      const clickControl = (control) => {
        const target = control.closest('label') ||
          control.closest('.MuiSwitch-root')?.querySelector('.MuiSwitch-switchBase') ||
          control;
        target.click();
      };

      const textCandidates = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, label, p, span, div, td, th'))
        .filter((element) => isVisible(element) && targetPattern.test(normalize(element.textContent)));

      for (const textElement of textCandidates) {
        let container = textElement;
        for (let depth = 0; container && depth < 7; depth += 1) {
          const [control] = getSwitches(container);
          if (control) {
            const wasEnabled = isEnabled(control);
            if (wasEnabled !== enabled) clickControl(control);
            return {
              found: true,
              labelText: normalize(textElement.textContent),
              wasEnabled,
              isEnabled: isEnabled(control)
            };
          }
          container = container.parentElement;
        }
      }

      return { found: false, wasEnabled: false, isEnabled: false, labelText: '' };
    }, { source: pattern.source, flags: pattern.flags, enabled });

    if (!result.found) {
      throw new Error(`Could not find ${label} switch on Notification Preferences.`);
    }

    if (result.isEnabled !== enabled) {
      throw new Error(`${label} switch was found but did not become ${enabled ? 'enabled' : 'disabled'}.`);
    }

    return result;
  }

  async readSwitchNearText(pattern, label) {
    await highlight(this.page.getByText(pattern).first(), label).catch(() => null);

    const result = await this.page.evaluate(({ source, flags }) => {
      const targetPattern = new RegExp(source, flags);
      const normalize = (value = '') => value.replace(/\s+/g, ' ').trim();
      const isVisible = (element) => {
        const box = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      };
      const isControlVisible = (control) => isVisible(control) ||
        isVisible(control.closest('label') || control.closest('.MuiSwitch-root') || control.parentElement);
      const getSwitches = (root) => Array.from(root.querySelectorAll(
        'input[type="checkbox"], [role="switch"], button[aria-checked], .MuiSwitch-root input'
      )).filter(isControlVisible);
      const isEnabled = (control) => {
        if ('checked' in control) return Boolean(control.checked);
        const ariaChecked = control.getAttribute('aria-checked');
        if (ariaChecked !== null) return ariaChecked === 'true';
        return /checked/i.test(control.className || control.closest('[class*="checked" i]')?.className || '');
      };

      const textCandidates = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, label, p, span, div, td, th'))
        .filter((element) => isVisible(element) && targetPattern.test(normalize(element.textContent)));

      for (const textElement of textCandidates) {
        let container = textElement;
        for (let depth = 0; container && depth < 7; depth += 1) {
          const [control] = getSwitches(container);
          if (control) {
            return {
              found: true,
              labelText: normalize(textElement.textContent),
              isEnabled: isEnabled(control)
            };
          }
          container = container.parentElement;
        }
      }

      return { found: false, isEnabled: false, labelText: '' };
    }, { source: pattern.source, flags: pattern.flags });

    if (!result.found) {
      throw new Error(`Could not find ${label} switch on Notification Preferences.`);
    }

    return result;
  }

  async setMyBookingsSwitches(enabled, columns = ['email', 'mobile', 'push']) {
    return this.evaluateMyBookingsSwitches({
      enabled,
      click: true,
      columns,
      expectedEnabled: enabled
    });
  }

  async readMyBookingsSwitches(columns = ['email', 'mobile', 'push'], expectedEnabled = true) {
    return this.evaluateMyBookingsSwitches({
      enabled: expectedEnabled,
      click: false,
      columns,
      expectedEnabled
    });
  }

  async setMyBookingsRowsSwitches(rowPatterns, columns, enabled) {
    return this.evaluateMyBookingsRowsSwitches({
      rowPatterns: rowPatterns.map((pattern) => pattern.source ? pattern.source : String(pattern)),
      rowFlags: rowPatterns.map((pattern) => pattern.flags || 'i'),
      columns,
      enabled,
      click: true,
      expectedEnabled: enabled
    });
  }

  async readMyBookingsRowsSwitches(rowPatterns, columns, expectedEnabled = true) {
    return this.evaluateMyBookingsRowsSwitches({
      rowPatterns: rowPatterns.map((pattern) => pattern.source ? pattern.source : String(pattern)),
      rowFlags: rowPatterns.map((pattern) => pattern.flags || 'i'),
      columns,
      enabled: expectedEnabled,
      click: false,
      expectedEnabled
    });
  }

  async evaluateMyBookingsRowsSwitches(options) {
    await this.waitForPreferenceTableReady();
    const result = await this.page.evaluate(({ rowPatterns, rowFlags, columns, enabled, click, expectedEnabled }) => {
      const normalize = (value = '') => value.replace(/\s+/g, ' ').trim();
      const targetColumns = Array.isArray(columns) && columns.length ? columns : ['email'];
      const rowMatchers = rowPatterns.map((source, index) => new RegExp(source, rowFlags[index] || 'i'));
      const isVisible = (element) => {
        const box = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      };
      const isControlVisible = (control) => isVisible(control) ||
        isVisible(control.closest('label') || control.closest('.MuiSwitch-root') || control.parentElement);
      const switchSelector = 'input[type="checkbox"], [role="switch"], button[aria-checked], .MuiSwitch-root input';
      const isSwitchEnabled = (control) => {
        if ('checked' in control) return Boolean(control.checked);
        const ariaChecked = control.getAttribute('aria-checked');
        if (ariaChecked !== null) return ariaChecked === 'true';
        return /checked/i.test(control.className || control.closest('[class*="checked" i]')?.className || '');
      };
      const clickControl = (control) => {
        const target = control.closest('label') ||
          control.closest('.MuiSwitch-root')?.querySelector('.MuiSwitch-switchBase') ||
          control;
        target.click();
      };
      const centerX = (element) => {
        const box = element.getBoundingClientRect();
        return box.left + (box.width / 2);
      };
      const columnFromHeader = (control, headers) => {
        const cellText = normalize(control.closest('td, [role="cell"]')?.textContent || '');
        if (/^Email\b/i.test(cellText)) return 'email';
        if (/^Mobile\b/i.test(cellText)) return 'mobile';
        if (/^Push\b|^Browser\b/i.test(cellText)) return 'push';
        if (!headers.length) return 'unknown';
        const x = centerX(control);
        return headers
          .map((header) => ({ ...header, distance: Math.abs(header.x - x) }))
          .sort((left, right) => left.distance - right.distance)[0].name;
      };

      const table = Array.from(document.querySelectorAll('table'))
        .find((candidate) => isVisible(candidate) && candidate.querySelectorAll(switchSelector).length >= 2);
      const root = table || document.body;
      const headers = Array.from(root.querySelectorAll('th, [role="columnheader"], p, span, div'))
        .filter(isVisible)
        .map((element) => ({ text: normalize(element.textContent), x: centerX(element) }))
        .filter((header) => /^(Email|Mobile|Push|Browser)$/i.test(header.text))
        .map((header) => ({
          name: /email/i.test(header.text) ? 'email' : /mobile/i.test(header.text) ? 'mobile' : 'push',
          x: header.x
        }));
      const rowElements = Array.from(root.querySelectorAll('tr, [role="row"], li, div'))
        .filter((row) => isVisible(row) && row.querySelectorAll(switchSelector).length && rowMatchers.some((matcher) => matcher.test(normalize(row.textContent))));

      const rows = [];
      for (const row of rowElements) {
        const states = {};
        const controls = Array.from(row.querySelectorAll(switchSelector)).filter(isControlVisible);
        for (const control of controls) {
          const column = columnFromHeader(control, headers);
          if (!targetColumns.includes(column)) continue;
          const before = isSwitchEnabled(control);
          if (click && before !== enabled) clickControl(control);
          if (!states[column]) states[column] = [];
          states[column].push({ before, after: isSwitchEnabled(control) });
        }
        if (Object.keys(states).length) {
          rows.push({
            name: normalize(row.textContent).replace(/\b(Email|Mobile|Push|Browser)\b/gi, '').trim(),
            states
          });
        }
      }

      return { found: rows.length > 0, rows, targetColumns, expectedEnabled, message: rows.length ? '' : 'No matching My Bookings rows were found.' };
    }, options);

    if (!result.found) {
      throw new Error(result.message);
    }

    const expectedEnabled = result.expectedEnabled !== false;
    const mismatches = [];
    for (const row of result.rows) {
      for (const column of result.targetColumns || ['email']) {
        const states = row.states[column] || [];
        if (!states.length || states.some((state) => state.after !== expectedEnabled)) {
          mismatches.push(`${row.name} ${column}`);
        }
      }
    }

    if (mismatches.length) {
      throw new Error(`My Bookings row switches are not ${expectedEnabled ? 'enabled' : 'disabled'}: ${mismatches.join(', ')}`);
    }

    return result;
  }

  async evaluateMyBookingsSwitches(options) {
    await this.waitForPreferenceTableReady();
    const result = await this.page.evaluate(({ enabled, click, columns, expectedEnabled }) => {
      const normalize = (value = '') => value.replace(/\s+/g, ' ').trim();
      const targetColumns = Array.isArray(columns) && columns.length
        ? columns
        : ['email', 'mobile', 'push'];
      const isVisible = (element) => {
        const box = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      };
      const isControlVisible = (control) => isVisible(control) ||
        isVisible(control.closest('label') || control.closest('.MuiSwitch-root') || control.parentElement);
      const switchSelector = 'input[type="checkbox"], [role="switch"], button[aria-checked], .MuiSwitch-root input';
      const isSwitchEnabled = (control) => {
        if ('checked' in control) return Boolean(control.checked);
        const ariaChecked = control.getAttribute('aria-checked');
        if (ariaChecked !== null) return ariaChecked === 'true';
        return /checked/i.test(control.className || control.closest('[class*="checked" i]')?.className || '');
      };
      const clickControl = (control) => {
        const target = control.closest('label') ||
          control.closest('.MuiSwitch-root')?.querySelector('.MuiSwitch-switchBase') ||
          control;
        target.click();
      };
      const centerX = (element) => {
        const box = element.getBoundingClientRect();
        return box.left + (box.width / 2);
      };
      const columnFromHeader = (control, headers) => {
        const cellText = normalize(control.closest('td, [role="cell"]')?.textContent || '');
        if (/^Email\b/i.test(cellText)) return 'email';
        if (/^Mobile\b/i.test(cellText)) return 'mobile';
        if (/^Push\b|^Browser\b/i.test(cellText)) return 'push';
        if (!headers.length) return 'unknown';
        const x = centerX(control);
        return headers
          .map((header) => ({ ...header, distance: Math.abs(header.x - x) }))
          .sort((left, right) => left.distance - right.distance)[0].name;
      };
      const findSectionRoot = () => {
        const table = Array.from(document.querySelectorAll('table'))
          .find((candidate) => isVisible(candidate) && candidate.querySelectorAll(switchSelector).length >= 2);
        if (table) return table;

        const labels = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, button, [role="tab"], p, span, div, td, th'))
          .filter((element) => isVisible(element) && /^My Boo(?:kings|\.\.\.)?/i.test(normalize(element.textContent)));

        for (const label of labels) {
          let container = label;
          for (let depth = 0; container && depth < 8; depth += 1) {
            if (container.querySelectorAll(switchSelector).length >= 2) return container;
            container = container.parentElement;
          }
        }

        return null;
      };
      const rowRootFor = (control, sectionRoot) => {
        let container = control;
        while (container && container !== sectionRoot) {
          if (/^(tr|li)$/i.test(container.tagName) || container.getAttribute('role') === 'row') {
            return container;
          }
          container = container.parentElement;
        }

        container = control.parentElement;
        let lastUseful = control.parentElement;
        while (container && container !== sectionRoot) {
          const text = normalize(container.textContent);
          const switches = container.querySelectorAll(switchSelector).length;
          if (switches >= 1 && text.length > 0 && text.length < 500) {
            lastUseful = container;
          }
          container = container.parentElement;
        }
        return lastUseful || control.parentElement;
      };

      const root = findSectionRoot();
      if (!root) {
        return {
          found: false,
          rows: [],
          message: 'Could not find the My Bookings notification section.'
        };
      }

      const headers = Array.from(root.querySelectorAll('th, [role="columnheader"], p, span, div'))
        .filter(isVisible)
        .map((element) => ({ text: normalize(element.textContent), x: centerX(element) }))
        .filter((header) => /^(Email|Mobile|Push|Browser)$/i.test(header.text))
        .map((header) => ({
          name: /email/i.test(header.text) ? 'email' : /mobile/i.test(header.text) ? 'mobile' : 'push',
          x: header.x
        }));

      const controls = Array.from(root.querySelectorAll(switchSelector)).filter(isControlVisible);
      const rowsByElement = new Map();
      for (const control of controls) {
        const row = rowRootFor(control, root);
        if (!rowsByElement.has(row)) {
          rowsByElement.set(row, {
            name: normalize(row.textContent).replace(/\b(Email|Mobile|Push|Browser)\b/gi, '').trim() || 'My Bookings',
            controls: []
          });
        }
        rowsByElement.get(row).controls.push(control);
      }

      const rows = [];
      for (const row of rowsByElement.values()) {
        const states = {};
        for (const control of row.controls) {
          const column = columnFromHeader(control, headers);
          if (!states[column]) states[column] = [];
          const before = isSwitchEnabled(control);
          const shouldManage = headers.length
            ? targetColumns.includes(column)
            : true;

          if (click && shouldManage && before !== enabled) {
            clickControl(control);
          }

          states[column].push({
            before,
            after: isSwitchEnabled(control)
          });
        }
        rows.push({ name: row.name, states });
      }

      return {
        found: true,
        rows,
        message: '',
        targetColumns,
        expectedEnabled
      };
    }, options);

    if (!result.found) {
      throw new Error(result.message);
    }

    const shouldValidateExpected = result.expectedEnabled !== null && result.expectedEnabled !== undefined;
    const missing = [];
    const expectedEnabled = result.expectedEnabled !== false;
    if (shouldValidateExpected) {
      for (const row of result.rows) {
        for (const column of result.targetColumns || ['email', 'mobile', 'push']) {
          const states = row.states[column] || [];
          if (states.length && states.some((state) => state.after !== expectedEnabled)) {
            missing.push(`${row.name} ${column}`);
          }
        }
      }
    }

    if (missing.length) {
      throw new Error(`My Bookings notification switches are not ${expectedEnabled ? 'enabled' : 'disabled'}: ${missing.join(', ')}`);
    }

    await highlight(this.page.getByText(/^My Bookings$/i).first(), 'My Bookings notification preferences')
      .catch(() => null);

    return result;
  }

  async saveIfAvailable() {
    const candidates = [
      this.page.getByRole('button', { name: /Update Preferences/i }).first(),
      this.page.getByRole('button', { name: /Save Preferences/i }).first(),
      this.page.getByRole('button', { name: /Save Changes/i }).first(),
      this.page.getByRole('button', { name: /^Update$/i }).first(),
      this.page.getByRole('button', { name: /^Save$/i }).first()
    ];

    for (const candidate of candidates) {
      if (await candidate.isVisible({ timeout: 1200 }).catch(() => false)
        && await candidate.isEnabled({ timeout: 1200 }).catch(() => false)) {
        await clickHighlighted(candidate, 'Save Notification Preferences');
        return true;
      }
    }

    return false;
  }

  async waitForToastOrSettle() {
    await this.page.locator('[role="progressbar"], .MuiCircularProgress-root').first()
      .waitFor({ state: 'hidden', timeout: 15000 })
      .catch(() => null);
    await this.page.waitForTimeout(1000);
  }

  escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = { NotificationPreferencePage };
