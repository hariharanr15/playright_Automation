const fs = require('fs');
const path = require('path');
const {
  expect,
  expectVisible,
  openBookingList,
  runStep,
  test
} = require('../support/test-base');
const { BookingListPage } = require('../../pages/booking/booking-list.page');
const { DeliveryBookingPage } = require('../../pages/booking/delivery.booking.page');
const { EditBookingPage } = require('../../pages/booking/edit.booking.page');
const { NotificationPreferencePage } = require('../../pages/booking/notification-preference.page');
const { ResourceOnlyBookingPage } = require('../../pages/booking/resource-only.booking.page');
const { UserManagementPage } = require('../../pages/booking/user-management.page');
const {
  clearBrowserNotifications,
  installBrowserNotificationObserver,
  waitForBrowserNotification
} = require('../../utils/browser-notification-observer');

test.use({
  storageState: undefined,
  permissions: ['notifications']
});

const EVENT_WAIT_MS = Number(process.env.NOTIFICATION_STATUS_EVENT_WAIT_MS || 20000);
const ACTION_PREPARE_SETTLE_MS = Number(process.env.NOTIFICATION_ACTION_PREPARE_SETTLE_MS || 3000);
const PUSH_WAIT_MS = Number(process.env.STATUS_BROWSER_NOTIFICATION_WAIT_MS || 10000);
const ABSENT_PUSH_WAIT_MS = Number(process.env.STATUS_ABSENT_BROWSER_NOTIFICATION_WAIT_MS || 4000);

const ALL_EVENT_DEFINITIONS = [
  {
    key: 'bookingCreated',
    label: 'New Booking Created',
    emailPattern: /Booking\s+Approved\s+-\s+Buckingham Palace/i,
    pushPattern: /booking\s+approved|approved/i,
    requireBookingReference: true,
    referenceLabel: 'Booking Approved',
    action: (page, email) => createDeliveryBooking(page, email)
  },
  {
    key: 'checkedIn',
    label: 'Booking Checked In',
    emailPattern: /Booking\s+Checked\s+In\s+-\s+Buckingham Palace/i,
    pushPattern: /checked\s*in|booking checked in/i,
    prepare: (page, email) => createDeliveryBooking(page, email),
    action: (page, email, prepared) => triggerCheckIn(page, prepared)
  },
  {
    key: 'checkedOut',
    label: 'Booking Checked Out',
    emailPattern: /Booking\s+Checked\s+Out\s+-\s+Buckingham Palace/i,
    pushPattern: /checked\s*out|booking checked out/i,
    prepare: (page, email) => createDeliveryBooking(page, email),
    action: (page, email, prepared) => triggerCheckOut(page, prepared)
  },
  {
    key: 'cancelled',
    label: 'Booking Cancelled',
    emailPattern: /Booking\s+Cancelled\s+-\s+Buckingham Palace/i,
    pushPattern: /cancelled|canceled|booking cancelled|booking canceled/i,
    prepare: (page, email) => createDeliveryBooking(page, email),
    action: (page, email, prepared) => triggerCancel(page, prepared)
  },
  {
    key: 'declined',
    label: 'Booking Declined',
    emailPattern: /Booking\s+(?:Declined|Refused)\s+-\s+Buckingham Palace/i,
    pushPattern: /declined|refused|rejected|booking declined|booking refused/i,
    prepare: (page, email) => createDeliveryBooking(page, email),
    action: (page, email, prepared) => triggerDecline(page, prepared)
  },
  {
    key: 'resourceBookingCreated',
    label: 'Resource Booking Created',
    emailPattern: /Booking\s+Approved\s+-\s+Buckingham Palace/i,
    pushPattern: /booking\s+approved|approved/i,
    requireBookingReference: true,
    referenceLabel: 'Booking Approved',
    action: (page) => createResourceOnlyBooking(page)
  }
];

function selectedEventDefinitions() {
  const configured = String(process.env.NOTIFICATION_STATUS_EVENT_KEYS || 'all')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);

  if (!configured.length || configured.some((key) => /^all$/i.test(key))) {
    return ALL_EVENT_DEFINITIONS;
  }

  const selected = ALL_EVENT_DEFINITIONS.filter((eventDefinition) =>
    configured.includes(eventDefinition.key)
  );

  if (!selected.length) {
    throw new Error(`No notification events matched NOTIFICATION_STATUS_EVENT_KEYS=${configured.join(',')}`);
  }

  return selected;
}

const EVENT_DEFINITIONS = selectedEventDefinitions();

const ALL_NOTIFICATION_MODES = [
  {
    key: 'allEnabled',
    label: 'All Notifications Enabled',
    emailExpected: true,
    pushExpected: true,
    pushEnabled: true,
    emailEnabled: true,
    mobileEnabled: true
  },
  {
    key: 'allDisabled',
    label: 'All Notifications Disabled',
    emailExpected: false,
    pushExpected: false,
    pushEnabled: false,
    emailEnabled: false,
    mobileEnabled: false
  },
  {
    key: 'pushOnly',
    label: 'Push Notification Only',
    emailExpected: false,
    pushExpected: true,
    pushEnabled: true,
    emailEnabled: false,
    mobileEnabled: true
  },
  {
    key: 'emailOnly',
    label: 'Email Notification Only',
    emailExpected: true,
    pushExpected: false,
    pushEnabled: false,
    emailEnabled: true,
    mobileEnabled: false
  }
];

function selectedNotificationModes() {
  const configured = String(process.env.NOTIFICATION_STATUS_MODE_KEYS || 'all')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);

  if (!configured.length || configured.some((key) => /^all$/i.test(key))) {
    return ALL_NOTIFICATION_MODES;
  }

  const selected = ALL_NOTIFICATION_MODES.filter((mode) =>
    configured.includes(mode.key)
  );

  if (!selected.length) {
    throw new Error(`No notification modes matched NOTIFICATION_STATUS_MODE_KEYS=${configured.join(',')}`);
  }

  return selected;
}

const NOTIFICATION_MODES = selectedNotificationModes();

function normalizeMessage(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function truncateMessage(value = '', limit = 420) {
  const normalized = normalizeMessage(value);
  if (normalized.length <= limit) return normalized || '-';
  return `${normalized.slice(0, limit - 3)}...`;
}

function sanitizeLabel(value) {
  return String(value || 'notification').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function isYopmailAddress(email) {
  return /@yopmail\.com$/i.test(String(email || '').trim());
}

function bookingRefFrom(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.match(/BK[A-Z0-9]{10,}/)?.[0] || null;
  return value.bookingRef || value.bookingId || value.ref || null;
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function textHasBookingRef(text, bookingRef) {
  if (!bookingRef) return false;
  return new RegExp(escapeRegExp(bookingRef), 'i').test(normalizeMessage(text));
}

function textHasPattern(text, pattern) {
  if (!pattern) return true;
  const regex = new RegExp(pattern.source, pattern.flags);
  return regex.test(normalizeMessage(text));
}

function actualStatus(expected, actual) {
  return expected === actual ? 'PASS' : 'FAIL';
}

function receivedText(value) {
  return value ? 'received' : 'not received';
}

function expectedText(value) {
  return value ? 'received' : 'not received';
}

async function getCurrentUserEmail(page) {
  const detected = await page.evaluate(() => {
    const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
    const candidates = [];
    const collect = (value) => {
      const match = String(value || '').match(emailPattern);
      if (match) candidates.push(match[0]);
    };

    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        collect(key);
        collect(storage.getItem(key));
      }
    }
    collect(document.body?.innerText || '');
    return candidates.find((email) => /@yopmail\.com$/i.test(email)) || candidates[0] || '';
  }).catch(() => '');

  return detected || process.env.VC_EMAIL || 'hari90@yopmail.com';
}

async function openYopmail(page, email) {
  await new UserManagementPage(page).openYopmailInbox(email, page);
}

function yopmailRows(page) {
  return page.frameLocator('iframe[name="ifinbox"]').locator('button, .m, .lm, [role="button"]');
}

async function readYopmailMatches(page, pattern) {
  const rows = yopmailRows(page);
  const count = await rows.count().catch(() => 0);
  const matches = [];

  for (let index = 0; index < count; index += 1) {
    const row = rows.nth(index);
    const text = normalizeMessage(await row.innerText({ timeout: 1000 }).catch(() => ''));
    if (!text || text.length > 500) continue;
    if (!/voyagecontrol|noreply|booking/i.test(text)) continue;
    if (pattern.test(text)) {
      matches.push({ index, text });
    }
  }

  return matches;
}

async function readEmailBaseline(context, email, pattern) {
  const mailPage = await context.newPage();
  try {
    await openYopmail(mailPage, email);
    const matches = await readYopmailMatches(mailPage, pattern);
    return {
      count: matches.length,
      matches,
      texts: matches.map((match) => normalizeMessage(match.text))
    };
  } finally {
    await mailPage.close().catch(() => null);
  }
}

async function waitForEmailEvent(context, email, pattern, baselineCount, testInfo, label, emailExpected, options = {}) {
  const mailPage = await context.newPage();
  const deadline = Date.now() + EVENT_WAIT_MS;
  let matches = [];
  const baselineTexts = new Set((options.baselineTexts || []).map((text) => normalizeMessage(text)));
  const bookingRef = options.bookingRef || null;
  const requireBookingReference = Boolean(options.requireBookingReference && bookingRef);
  const requiredPattern = options.requiredPattern || pattern;
  let exactMessage = emailExpected
    ? `No ${label} email was received within ${Math.round(EVENT_WAIT_MS / 1000)}s.`
    : `No ${label} email was received as expected.`;

  try {
    await openYopmail(mailPage, email);
    while (Date.now() < deadline) {
      matches = await readYopmailMatches(mailPage, pattern);

      const candidates = matches
        .filter((match) =>
          matches.length > baselineCount ||
          !baselineTexts.has(normalizeMessage(match.text)) ||
          (bookingRef && textHasBookingRef(match.text, bookingRef))
        )
        .slice(0, 8);

      for (const match of candidates) {
        const row = yopmailRows(mailPage).nth(match.index);
        await row.click();
        await mailPage.waitForTimeout(1000);
        const mailText = normalizeMessage(await mailPage.frameLocator('iframe[name="ifmail"]').locator('body')
          .innerText({ timeout: 5000 })
          .catch(() => ''));
        exactMessage = mailText || match.text;
        const combinedText = normalizeMessage(`${match.text} ${mailText}`);
        const hasReference = textHasBookingRef(combinedText, bookingRef);
        const hasRequiredPattern = textHasPattern(combinedText, requiredPattern);

        if (requireBookingReference && (!hasReference || !hasRequiredPattern)) {
          continue;
        }

        const screenshotPath = testInfo.outputPath(`${sanitizeLabel(label)}-email.png`);
        await mailPage.screenshot({ path: screenshotPath, fullPage: true }).catch(() => null);
        if (fs.existsSync(screenshotPath)) {
          await testInfo.attach(`${label} email`, { path: screenshotPath, contentType: 'image/png' });
        }

        return {
          received: true,
          referenceMatched: requireBookingReference ? hasReference : null,
          requiredPatternMatched: hasRequiredPattern,
          exactMessage,
          matchingCount: matches.length,
          baselineCount
        };
      }

      const refresh = mailPage.locator('#refresh, button:has-text("Refresh")').first();
      if (await refresh.isVisible({ timeout: 1000 }).catch(() => false)) {
        await refresh.click().catch(() => null);
      } else {
        await mailPage.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
      }
      await mailPage.waitForTimeout(5000);
    }

    return {
      received: false,
      referenceMatched: requireBookingReference ? false : null,
      requiredPatternMatched: false,
      exactMessage,
      matchingCount: matches.length,
      baselineCount
    };
  } finally {
    await mailPage.close().catch(() => null);
  }
}

async function waitForPushReferenceEvent(notificationPreference, bookingRef, pattern, options = {}) {
  if (!bookingRef) {
    return {
      checked: false,
      found: false,
      referenceMatched: false,
      requiredPatternMatched: false,
      text: '',
      reason: 'No booking reference was available.'
    };
  }

  const timeout = options.timeout ?? EVENT_WAIT_MS;
  const deadline = Date.now() + timeout;
  let text = '';

  while (Date.now() < deadline) {
    await notificationPreference.openNotificationCenter().catch(() => null);
    text = await notificationPreference.readNotificationCenterText();
    const referenceMatched = textHasBookingRef(text, bookingRef);
    const requiredPatternMatched = textHasPattern(text, pattern);
    if (referenceMatched && requiredPatternMatched) {
      return {
        checked: true,
        found: true,
        referenceMatched,
        requiredPatternMatched,
        text
      };
    }
    await notificationPreference.page.keyboard.press('Escape').catch(() => null);
    await notificationPreference.page.waitForTimeout(1500);
  }

  return {
    checked: true,
    found: false,
    referenceMatched: textHasBookingRef(text, bookingRef),
    requiredPatternMatched: textHasPattern(text, pattern),
    text
  };
}

async function evaluateNotificationEvent(page, testInfo, evidence, mode, eventDefinition, email) {
  const notificationPreference = new NotificationPreferencePage(page);
  const label = `${mode.label} - ${eventDefinition.label}`;
  let prepared = null;

  if (eventDefinition.prepare) {
    try {
      prepared = await test.step(`Prepare booking for ${label}`, async () => {
        const result = await eventDefinition.prepare(page, email);
        await page.waitForTimeout(ACTION_PREPARE_SETTLE_MS);
        return result;
      });
    } catch (error) {
      evidence[eventDefinition.key] = {
        label,
        expected: {
          email: mode.emailExpected,
          push: mode.pushExpected
        },
        actual: {
          email: false,
          push: false
        },
        status: {
          email: mode.emailExpected ? 'FAIL' : 'PASS',
          push: mode.pushExpected ? 'FAIL' : 'PASS',
          overall: 'FAIL'
        },
        prepareError: error.message
      };
      await test.step(`Verification FAIL: ${label} | Prepare booking error: ${truncateMessage(error.message)}`, async () => {});
      expect.soft(false, `${label} could not prepare a booking: ${error.message}`).toBeTruthy();
      return;
    }
  }

  await clearBrowserNotifications(page);
  const emailBaseline = eventDefinition.requireBookingReference
    ? { count: 0, matches: [], texts: [] }
    : await readEmailBaseline(page.context(), email, eventDefinition.emailPattern);
  const badgeBefore = await notificationPreference.readNotificationBadgeCount();

  let actionResult;
  try {
    actionResult = await test.step(`Perform ${label}`, async () => {
      return eventDefinition.action(page, email, prepared);
    });
  } catch (error) {
    evidence[eventDefinition.key] = {
      label,
      expected: {
        email: mode.emailExpected,
        push: mode.pushExpected
      },
      actual: {
        email: false,
        push: false
      },
      status: {
        email: mode.emailExpected ? 'FAIL' : 'PASS',
        push: mode.pushExpected ? 'FAIL' : 'PASS',
        overall: 'FAIL'
      },
      prepared,
      bookingRef: bookingRefFrom(prepared),
      actionError: error.message
    };
    await test.step(`Verification FAIL: ${label} | Booking action error: ${truncateMessage(error.message)}`, async () => {});
    expect.soft(false, `${label} booking action failed: ${error.message}`).toBeTruthy();
    return;
  }

  const actionBookingRef = bookingRefFrom(actionResult) || bookingRefFrom(prepared);
  const requiresReference = Boolean(eventDefinition.requireBookingReference && actionBookingRef);
  const browserNotification = await waitForBrowserNotification(page, {
    timeout: mode.pushExpected ? PUSH_WAIT_MS : ABSENT_PUSH_WAIT_MS,
    pattern: eventDefinition.pushPattern
  });

  const badgeResult = mode.pushExpected
    ? await notificationPreference.waitForNotificationBadgeIncrease(badgeBefore, EVENT_WAIT_MS)
    : { increased: false, before: badgeBefore, after: await notificationPreference.readNotificationBadgeCount() };

  const emailResult = await waitForEmailEvent(
    page.context(),
    email,
    eventDefinition.emailPattern,
    emailBaseline.count,
    testInfo,
    label,
    mode.emailExpected,
    {
      baselineTexts: emailBaseline.texts || [],
      bookingRef: actionBookingRef,
      requireBookingReference: requiresReference,
      requiredPattern: eventDefinition.emailPattern
    }
  );

  if (!mode.pushExpected) {
    badgeResult.after = await notificationPreference.readNotificationBadgeCount();
    badgeResult.increased = Number.isFinite(badgeResult.before) &&
      Number.isFinite(badgeResult.after) &&
      badgeResult.after > badgeResult.before;
  }

  const pushReferenceResult = requiresReference
    ? await waitForPushReferenceEvent(notificationPreference, actionBookingRef, eventDefinition.pushPattern, {
      timeout: mode.pushExpected ? EVENT_WAIT_MS : ABSENT_PUSH_WAIT_MS
    })
    : {
      checked: false,
      found: false,
      referenceMatched: null,
      requiredPatternMatched: null,
      text: ''
    };
  const browserNotificationText = normalizeMessage(browserNotification.notification?.text);
  const browserReferenceMatched = requiresReference
    ? textHasBookingRef(browserNotificationText, actionBookingRef) &&
      textHasPattern(browserNotificationText, eventDefinition.pushPattern)
    : browserNotification.matched;
  const pushReceived = requiresReference
    ? browserReferenceMatched || pushReferenceResult.found
    : browserNotification.matched || badgeResult.increased;
  const exactPushMessage = normalizeMessage(browserNotification.notification?.text) ||
    normalizeMessage(pushReferenceResult.text) ||
    (badgeResult.increased
      ? `${label} app notification badge increased from ${badgeResult.before} to ${badgeResult.after}.`
      : `${label} push/app notification was not received.`);
  const emailStatus = actualStatus(mode.emailExpected, emailResult.received);
  const pushStatus = actualStatus(mode.pushExpected, pushReceived);
  const overallStatus = emailStatus === 'PASS' && pushStatus === 'PASS' ? 'PASS' : 'FAIL';

  evidence[eventDefinition.key] = {
    label,
    expected: {
      email: mode.emailExpected,
      push: mode.pushExpected
    },
    actual: {
      email: emailResult.received,
      push: pushReceived
    },
    status: {
      email: emailStatus,
      push: pushStatus,
      overall: overallStatus
    },
    prepared,
    actionResult,
    bookingRef: actionBookingRef,
    referenceValidation: {
      required: requiresReference,
      bookingRef: actionBookingRef,
      emailReferenceMatched: emailResult.referenceMatched,
      emailRequiredPatternMatched: emailResult.requiredPatternMatched,
      pushBrowserReferenceMatched: browserReferenceMatched,
      pushCenterReferenceMatched: pushReferenceResult.referenceMatched,
      pushRequiredPatternMatched: pushReferenceResult.requiredPatternMatched
    },
    emailBaseline,
    browserNotification,
    badgeResult,
    pushReferenceResult,
    emailResult,
    exactEmailMessage: emailResult.exactMessage,
    exactPushMessage
  };

  await test.step(
    `Verification ${overallStatus}: ${label} | Email expected ${expectedText(mode.emailExpected)}, actual ${receivedText(emailResult.received)} | Push expected ${expectedText(mode.pushExpected)}, actual ${receivedText(pushReceived)}`,
    async () => {}
  );
  if (requiresReference) {
    await test.step(
      `${eventDefinition.referenceLabel || eventDefinition.label} reference validation: ${actionBookingRef} | Email ref=${emailResult.referenceMatched} | Push browser ref=${browserReferenceMatched} | Push center ref=${pushReferenceResult.referenceMatched}`,
      async () => {}
    );
  }
  await test.step(`Exact ${label} email message: ${truncateMessage(emailResult.exactMessage)}`, async () => {});
  await test.step(`Exact ${label} push/app message: ${truncateMessage(exactPushMessage)}`, async () => {});
  expect.soft(
    emailResult.received,
    `${label} email notification should be ${expectedText(mode.emailExpected)}. Evidence: ${JSON.stringify({
      bookingRef: evidence[eventDefinition.key].bookingRef,
      referenceMatched: emailResult.referenceMatched,
      baselineCount: emailResult.baselineCount,
      matchingCount: emailResult.matchingCount,
      exactMessage: emailResult.exactMessage
    })}`
  ).toBe(mode.emailExpected);
  expect.soft(
    pushReceived,
    `${label} push notification should be ${expectedText(mode.pushExpected)}. Evidence: ${JSON.stringify({
      bookingRef: evidence[eventDefinition.key].bookingRef,
      browserMatched: browserNotification.matched,
      browserReferenceMatched,
      pushCenterReferenceMatched: pushReferenceResult.referenceMatched,
      badgeResult,
      exactMessage: exactPushMessage
    })}`
  ).toBe(mode.pushExpected);
}

async function createDeliveryBooking(page, email) {
  await openBookingList(page);
  const booking = new DeliveryBookingPage(page, { bookingEmail: email, useMyDetails: false });
  const result = await booking.createDeliveryBooking();
  return {
    ...result,
    bookingRef: result.bookingRef || bookingRefFrom(result.message)
  };
}

async function createResourceOnlyBooking(page) {
  await openBookingList(page);
  const booking = new ResourceOnlyBookingPage(page);
  const result = await booking.createResourceBooking();
  return {
    ...result,
    bookingRef: result.bookingRef || bookingRefFrom(result.message)
  };
}

async function openBookingForListAction(page, prepared, requiredActions = ['checkIn']) {
  await openBookingList(page);
  const bookingList = new BookingListPage(page);
  await bookingList.waitForList();
  await bookingList.openStatusTab('All').catch(() => null);
  const preparedRef = bookingRefFrom(prepared);

  if (preparedRef && await bookingList.markBookingRow(preparedRef).catch(() => false)) {
    return { bookingList, bookingId: preparedRef };
  }

  const booking = await bookingList.findScheduledBookingWithActions(requiredActions);
  return { bookingList, bookingId: booking.bookingId };
}

async function triggerCheckIn(page, prepared = null) {
  const { bookingList, bookingId } = await openBookingForListAction(page, prepared, ['checkIn']);
  await bookingList.clickRowStatusAction(bookingId, 'checkIn', 'Scheduled');
  await bookingList.waitForBookingStatus(bookingId, 'Checked In');
  return { bookingRef: bookingId, status: 'Checked In' };
}

async function triggerCheckOut(page, prepared = null) {
  const { bookingList, bookingId } = await openBookingForListAction(page, prepared, ['checkIn']);
  await bookingList.clickRowStatusAction(bookingId, 'checkIn', 'Scheduled');
  await bookingList.waitForBookingStatus(bookingId, 'Checked In');
  await bookingList.clickRowStatusAction(bookingId, 'checkOut', 'Checked In');
  await bookingList.waitForBookingStatus(bookingId, 'Checked Out');
  return { bookingRef: bookingId, status: 'Checked Out' };
}

async function triggerDecline(page, prepared = null) {
  const { bookingList, bookingId } = await openBookingForListAction(page, prepared, ['refuse']);
  await bookingList.clickRowStatusAction(bookingId, 'refuse', 'Scheduled');
  await bookingList.waitForBookingStatus(bookingId, 'Refused').catch(async () => {
    await bookingList.waitForBookingStatus(bookingId, 'Declined');
  });
  return { bookingRef: bookingId, status: 'Declined or Refused' };
}

async function triggerCancel(page, prepared = null) {
  await openBookingList(page);
  const editBooking = new EditBookingPage(page);
  await editBooking.applyDefaultViewFilter().catch(() => null);
  await editBooking.applyBookingListDateRange().catch(() => null);
  const preparedRef = bookingRefFrom(prepared);
  const booking = preparedRef
    ? { bookingId: preparedRef }
    : await editBooking.findFirstBookingByStatus(['Scheduled']);

  await editBooking.selectBookingById(booking.bookingId);
  await editBooking.waitForBookingDetailsReady();
  await editBooking.cancelBooking({ keepBookingDetailsOpen: false });
  await page.keyboard.press('Escape').catch(() => null);
  await editBooking.returnToBookingListPage({ applyDefaultView: true, applyDateRange: true }).catch(() => null);
  return { bookingRef: booking.bookingId, status: 'Cancelled' };
}

async function applyNotificationMode(page, notificationPreference, evidence, mode) {
  await runStep(page, `Set notification mode: ${mode.label}`, async () => {
    await notificationPreference.openNotificationPreferences();
    evidence[mode.key] = evidence[mode.key] || {};
    evidence[mode.key].mode = mode;
    evidence[mode.key].pushState = mode.pushEnabled
      ? await notificationPreference.enablePushNotifications()
      : await notificationPreference.disablePushNotifications();
    evidence[mode.key].preferences = await notificationPreference.setMyBookingsNotificationPreferences({
      email: mode.emailEnabled,
      mobile: mode.mobileEnabled
    });
  }, async () => {
    expect(evidence[mode.key].pushState.appPushSwitch.isEnabled).toBe(mode.pushEnabled);
  });
}

test.describe('Regression Tests - Notification Status Matrix', () => {
  test('validates email and push notifications across enabled, disabled, push-only, and email-only modes', async ({ page }, testInfo) => {
    test.setTimeout(Number(process.env.NOTIFICATION_STATUS_MATRIX_TIMEOUT_MS || 2400000));

    const notificationPreference = new NotificationPreferencePage(page);
    const evidence = {
      initial: {},
      allEnabled: {},
      allDisabled: {},
      pushOnly: {},
      emailOnly: {},
      restored: {}
    };
    let email;
    let shouldRestore = false;

    try {
      await runStep(page, 'Open authenticated project and detect current Yopmail user', async () => {
        await installBrowserNotificationObserver(page);
        await notificationPreference.openAuthenticatedShell();
        email = await getCurrentUserEmail(page);
      }, async () => {
        expect(isYopmailAddress(email), `Current user email must be Yopmail. Detected: ${email}`).toBeTruthy();
        await expectVisible(page.locator('body'), 'Logged in application shell');
      });

      await runStep(page, `Open Notification settings and verify Push and Email switches for ${EVENT_DEFINITIONS.map((eventDefinition) => eventDefinition.label).join(', ')}`, async () => {
        await notificationPreference.openNotificationPreferences();
        evidence.initial.pushState = await notificationPreference.readPushNotificationState();
        evidence.initial.preferences = await notificationPreference.captureMyBookingsNotificationPreferences(['email', 'mobile']);
      }, async () => {
        expect(evidence.initial.pushState.appPushSwitch.found).toBeTruthy();
        expect(evidence.initial.preferences.found).toBeTruthy();
      });

      for (const mode of NOTIFICATION_MODES) {
        await applyNotificationMode(page, notificationPreference, evidence, mode);
        shouldRestore = true;

        for (const eventDefinition of EVENT_DEFINITIONS) {
          await evaluateNotificationEvent(page, testInfo, evidence[mode.key], mode, eventDefinition, email);
        }
      }
    } finally {
      if (shouldRestore && !/^true$/i.test(process.env.NOTIFICATION_SKIP_RESTORE || '')) {
        await test.step('Restore all My Bookings email and push notifications', async () => {
          await notificationPreference.openNotificationPreferences().catch(() => null);
          evidence.restored.pushState = await notificationPreference.enablePushNotifications().catch((error) => ({ error: error.message }));
          evidence.restored.preferences = await notificationPreference.setMyBookingsNotificationPreferences({
            email: true,
            mobile: true
          }).catch((error) => ({ error: error.message }));
        });
      }

      const evidencePath = testInfo.outputPath('notification-status-matrix-evidence.json');
      fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), 'utf8');
      await testInfo.attach('Notification status matrix evidence JSON', {
        path: evidencePath,
        contentType: 'application/json'
      });
      console.log(`Notification status matrix evidence saved in ${path.dirname(evidencePath)}`);
    }
  });
});
