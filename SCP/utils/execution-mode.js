function truthy(value) {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

function getExecutionMode() {
  if (truthy(process.env.SCP_DEMO_MODE)) {
    return 'demo';
  }

  return String(process.env.SCP_EXECUTION_MODE || 'normal').trim().toLowerCase();
}

function isDemoMode() {
  return getExecutionMode() === 'demo';
}

function getActionDelayMs() {
  if (!isDemoMode()) {
    return 0;
  }

  return Number(process.env.SCP_ACTION_INTERVAL_MS || process.env.ACTION_PAUSE_MS || 500);
}

function getHighlightDurationMs() {
  if (!isDemoMode()) {
    return 0;
  }

  return Number(process.env.HIGHLIGHT_MS || 350);
}

function isHeadless() {
  const configured = process.env.PLAYWRIGHT_HEADLESS ?? process.env.HEADLESS;
  if (configured !== undefined && configured !== '') {
    return truthy(configured);
  }

  return !isDemoMode();
}

function getBrowserLaunchOptions() {
  return {
    channel: process.env.SCP_BROWSER_CHANNEL || 'chrome',
    headless: isHeadless(),
    slowMo: isDemoMode() ? Number(process.env.SCP_SLOW_MO || 100) : 0,
    args: ['--start-maximized', '--force-device-scale-factor=1']
  };
}

function getContextOptions() {
  return {
    acceptDownloads: true,
    ignoreHTTPSErrors: true,
    viewport: isHeadless() ? { width: 1440, height: 900 } : null
  };
}

module.exports = {
  getActionDelayMs,
  getBrowserLaunchOptions,
  getContextOptions,
  getExecutionMode,
  getHighlightDurationMs,
  isDemoMode,
  isHeadless,
  truthy
};
