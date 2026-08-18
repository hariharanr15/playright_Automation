const BROWSER_NOTIFICATION_OBSERVER_SCRIPT = `
(() => {
  if (window.__vcBrowserNotificationObserverInstalled) return;
  window.__vcBrowserNotificationObserverInstalled = true;
  window.__vcBrowserNotifications = window.__vcBrowserNotifications || [];

  const record = (source, title, options = {}) => {
    window.__vcBrowserNotifications.push({
      source,
      title: String(title || ''),
      body: String(options?.body || ''),
      tag: String(options?.tag || ''),
      timestamp: new Date().toISOString()
    });
  };

  const OriginalNotification = window.Notification;
  if (typeof OriginalNotification === 'function') {
    function ObservedNotification(title, options) {
      record('Notification', title, options);
      return new OriginalNotification(title, options);
    }

    Object.setPrototypeOf(ObservedNotification, OriginalNotification);
    ObservedNotification.prototype = OriginalNotification.prototype;
    Object.defineProperty(ObservedNotification, 'permission', {
      get: () => OriginalNotification.permission
    });
    ObservedNotification.requestPermission = (...args) => OriginalNotification.requestPermission(...args);
    window.Notification = ObservedNotification;
  }

  const registrationPrototype = window.ServiceWorkerRegistration?.prototype;
  if (registrationPrototype?.showNotification && !registrationPrototype.__vcShowNotificationObserved) {
    const originalShowNotification = registrationPrototype.showNotification;
    registrationPrototype.showNotification = function observedShowNotification(title, options) {
      record('ServiceWorkerRegistration.showNotification', title, options);
      return originalShowNotification.call(this, title, options);
    };
    registrationPrototype.__vcShowNotificationObserved = true;
  }
})();
`;

async function installBrowserNotificationObserver(page) {
  await page.addInitScript({ content: BROWSER_NOTIFICATION_OBSERVER_SCRIPT });
  await page.evaluate(BROWSER_NOTIFICATION_OBSERVER_SCRIPT).catch(() => null);
}

async function readBrowserNotifications(page) {
  return page.evaluate(async () => {
    const normalizeNotification = (notification, source) => ({
      source,
      title: String(notification?.title || ''),
      body: String(notification?.body || ''),
      tag: String(notification?.tag || ''),
      timestamp: notification?.timestamp ? new Date(notification.timestamp).toISOString() : new Date().toISOString()
    });

    const observed = Array.isArray(window.__vcBrowserNotifications)
      ? window.__vcBrowserNotifications
      : [];
    const serviceWorkerNotifications = [];

    if (navigator.serviceWorker?.getRegistrations) {
      const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
      for (const registration of registrations) {
        const notifications = await registration.getNotifications({ includeTriggered: true }).catch(() => []);
        serviceWorkerNotifications.push(
          ...notifications.map((notification) => normalizeNotification(notification, 'ServiceWorkerRegistration.getNotifications'))
        );
      }
    }

    return [...observed, ...serviceWorkerNotifications]
      .map((notification) => ({
        ...notification,
        text: `${notification.title} ${notification.body}`.replace(/\s+/g, ' ').trim()
      }));
  }).catch(() => []);
}

async function clearBrowserNotifications(page) {
  await page.evaluate(() => {
    window.__vcBrowserNotifications = [];
  }).catch(() => null);
}

async function readPushNotificationDiagnostics(page) {
  const notifications = await readBrowserNotifications(page);

  const state = await page.evaluate(async () => {
    const result = {
      permission: 'unknown',
      serviceWorkerSupported: Boolean(navigator.serviceWorker),
      pushManagerSupported: Boolean(window.PushManager),
      serviceWorkerController: Boolean(navigator.serviceWorker?.controller),
      registrations: []
    };

    if ('Notification' in window) {
      result.permission = Notification.permission;
    }

    if (!navigator.serviceWorker?.getRegistrations) {
      return result;
    }

    const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
    for (const registration of registrations) {
      const subscription = await registration.pushManager?.getSubscription?.().catch(() => null);
      result.registrations.push({
        scope: registration.scope,
        active: Boolean(registration.active),
        waiting: Boolean(registration.waiting),
        installing: Boolean(registration.installing),
        hasPushSubscription: Boolean(subscription),
        endpointHost: subscription?.endpoint ? new URL(subscription.endpoint).host : ''
      });
    }

    return result;
  }).catch((error) => ({
    permission: 'unknown',
    serviceWorkerSupported: false,
    pushManagerSupported: false,
    serviceWorkerController: false,
    registrations: [],
    error: error.message
  }));

  return {
    ...state,
    notifications,
    hasPushSubscription: state.registrations.some((registration) => registration.hasPushSubscription)
  };
}

async function waitForPushSubscription(page, options = {}) {
  const timeout = options.timeout ?? Number(process.env.PUSH_SUBSCRIPTION_WAIT_MS || 45000);
  const deadline = Date.now() + timeout;
  let diagnostics = await readPushNotificationDiagnostics(page);

  while (Date.now() < deadline) {
    diagnostics = await readPushNotificationDiagnostics(page);
    if (diagnostics.permission === 'granted' && diagnostics.hasPushSubscription) {
      return diagnostics;
    }
    await page.waitForTimeout(1000);
  }

  return diagnostics;
}

async function waitForBrowserNotification(page, options = {}) {
  const {
    timeout = Number(process.env.BROWSER_NOTIFICATION_WAIT_MS || 60000),
    pattern = /booking|created|submitted|success|notification/i
  } = options;
  const deadline = Date.now() + timeout;
  let lastNotifications = [];

  while (Date.now() < deadline) {
    lastNotifications = await readBrowserNotifications(page);
    const match = lastNotifications.find((notification) => pattern.test(notification.text));

    if (match) {
      return {
        matched: true,
        notification: match,
        notifications: lastNotifications
      };
    }

    await page.waitForTimeout(1000);
  }

  return {
    matched: false,
    notification: null,
    notifications: lastNotifications
  };
}

module.exports = {
  clearBrowserNotifications,
  installBrowserNotificationObserver,
  readPushNotificationDiagnostics,
  readBrowserNotifications,
  waitForPushSubscription,
  waitForBrowserNotification
};
