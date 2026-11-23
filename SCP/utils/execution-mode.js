function truthy(value) {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

const MODES = ['normal', 'fast', 'demo'];
const DEFAULT_ACTION_INTERVAL_MS = 700;

function isHeadless() {
  const configured = process.env.PLAYWRIGHT_HEADLESS ?? process.env.HEADLESS;
  if (configured !== undefined && configured !== '') {
    return truthy(configured);
  }

  return !truthy(process.env.SCP_DEMO_MODE) && String(process.env.SCP_EXECUTION_MODE || '').trim().toLowerCase() !== 'demo';
}

// normal: observable pacing between major actions (headed default).
// fast:   condition-based waits only (headless default).
// demo:   normal pacing plus element highlighting and slowMo.
function getExecutionMode() {
  if (truthy(process.env.SCP_DEMO_MODE)) {
    return 'demo';
  }

  const configured = String(process.env.SCP_EXECUTION_MODE || '').trim().toLowerCase();
  if (MODES.includes(configured)) {
    return configured;
  }

  return isHeadless() ? 'fast' : 'normal';
}

function isDemoMode() {
  return getExecutionMode() === 'demo';
}

function isFastMode() {
  return getExecutionMode() === 'fast';
}

// Visual pacing only; synchronisation must use Playwright's condition-based waits.
function getActionDelayMs() {
  if (isFastMode()) {
    return 0;
  }

  const configured = Number(process.env.SCP_ACTION_INTERVAL_MS || process.env.ACTION_PAUSE_MS || DEFAULT_ACTION_INTERVAL_MS);
  return Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_ACTION_INTERVAL_MS;
}

function getStepDelayMs() {
  if (isFastMode()) {
    return 0;
  }

  const configured = Number(process.env.STEP_WAIT_MS || getActionDelayMs());
  return Number.isFinite(configured) && configured >= 0 ? configured : getActionDelayMs();
}

function getHighlightDurationMs() {
  if (!isDemoMode()) {
    return 0;
  }

  return Number(process.env.HIGHLIGHT_MS || 350);
}

function getSlowMoMs() {
  return isDemoMode() ? Number(process.env.SCP_SLOW_MO || 100) : 0;
}

// A full-page capture resizes the visible Chrome window in headed runs; keep it for headless evidence only.
function getScreenshotOptions(options = {}) {
  return { fullPage: isHeadless(), ...options };
}

function getBrowserLaunchOptions() {
  return {
    channel: process.env.SCP_BROWSER_CHANNEL || 'chrome',
    headless: isHeadless(),
    slowMo: getSlowMoMs(),
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
  getScreenshotOptions,
  getSlowMoMs,
  getStepDelayMs,
  isDemoMode,
  isFastMode,
  isHeadless,
  truthy
};
