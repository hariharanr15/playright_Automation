const fs = require('fs');
const path = require('path');
const { isHeadless } = require('./execution-mode');

const EXECUTION_DIR = process.env.SCP_EXECUTION_DIR
  ? path.resolve(process.env.SCP_EXECUTION_DIR)
  : path.resolve(__dirname, '..', 'reports');
const SCREENSHOT_DIR = path.join(EXECUTION_DIR, 'screenshots');

function safeName(value) {
  return String(value || 'evidence')
    .replace(/[^a-z0-9_-]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100) || 'evidence';
}

function redactUrl(value) {
  try {
    const url = new URL(value);
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

function redactUrlsInText(value) {
  return String(value || '').replace(/(https?:\/\/[^\s?#<>"']+)[?#][^\s<>"']*/g, '$1');
}

async function captureEvidence(page, attach, name) {
  if (!page || page.isClosed()) {
    return '';
  }

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const baseName = safeName(name);
  let screenshotPath = path.join(SCREENSHOT_DIR, `${baseName}.png`);
  let suffix = 1;
  while (fs.existsSync(screenshotPath)) {
    screenshotPath = path.join(SCREENSHOT_DIR, `${baseName}_${suffix}.png`);
    suffix += 1;
  }
  const screenshot = await page.screenshot({ path: screenshotPath, fullPage: isHeadless() });

  if (attach) {
    await attach(screenshot, 'image/png');
  }

  return screenshotPath;
}

module.exports = { captureEvidence, redactUrl, redactUrlsInText, safeName, SCREENSHOT_DIR };
