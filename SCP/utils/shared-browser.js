// One Google Chrome instance, context and tab for a whole regression run.
// The orchestrator owns the Chrome process; every stage process attaches over CDP and only disconnects when it ends.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { getSlowMoMs } = require('./execution-mode');

const ENDPOINT_ENV = 'SCP_SHARED_BROWSER_CDP';

function sharedEndpoint() {
  return process.env[ENDPOINT_ENV] || '';
}

function isSharedBrowser() {
  return Boolean(sharedEndpoint());
}

function chromeExecutable() {
  const candidates = [process.env.SCP_CHROME_PATH,
    process.platform === 'win32' && path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.platform === 'win32' && path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.platform === 'win32' && process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.platform === 'darwin' && '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'].filter(Boolean);
  const found = candidates.find(candidate => fs.existsSync(candidate));
  if (!found) throw new Error(`Google Chrome was not found. Set SCP_CHROME_PATH. Checked: ${candidates.join(', ')}`);
  return found;
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Synchronous so the orchestrator, which runs stages with spawnSync, can check the browser between stages.
function probeSync(endpoint, timeoutMs = 5000) {
  const script = `fetch(process.argv[1] + '/json/version', { signal: AbortSignal.timeout(${timeoutMs}) })
    .then(r => r.json()).then(v => { process.stdout.write(JSON.stringify(v)); }).catch(e => { process.stderr.write(e.message); process.exit(1); });`;
  const outcome = spawnSync(process.execPath, ['-e', script, endpoint], { encoding: 'utf8', timeout: timeoutMs + 2000 });
  if (outcome.status !== 0) return { alive: false, error: (outcome.stderr || outcome.error?.message || 'No response').trim() };
  try { return { alive: true, version: JSON.parse(outcome.stdout) }; } catch { return { alive: false, error: 'Invalid DevTools response' }; }
}

function processExists(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
}

// Launches Chrome once. The DevTools port is bound to 127.0.0.1 and the profile is a throwaway directory.
function launchSharedBrowser({ headless }) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scp-shared-chrome-'));
  const args = ['--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${userDataDir}`,
    '--no-first-run', '--no-default-browser-check', '--disable-default-apps', '--disable-popup-blocking', '--password-store=basic',
    '--disable-features=Translate,PasswordLeakDetection,AutofillServerCommunication', '--force-device-scale-factor=1',
    ...(headless ? ['--headless=new', '--window-size=1440,900'] : ['--start-maximized']), 'about:blank'];
  const executable = chromeExecutable();
  // Optional diagnostics: SCP_SHARED_BROWSER_LOG=<file> captures Chrome's own log (renderer crashes, DevTools disconnects).
  const logFile = process.env.SCP_SHARED_BROWSER_LOG;
  if (logFile) args.splice(args.length - 1, 0, '--enable-logging=stderr', '--v=0');
  const output = logFile ? fs.openSync(logFile, 'a') : 'ignore';
  const child = spawn(executable, args, { stdio: ['ignore', output, output], detached: process.platform !== 'win32', windowsHide: headless });
  child.unref();
  const portFile = path.join(userDataDir, 'DevToolsActivePort');
  const deadline = Date.now() + 30000;
  while (!fs.existsSync(portFile) || !fs.readFileSync(portFile, 'utf8').trim()) {
    if (Date.now() > deadline) throw new Error(`Shared Chrome did not publish a DevTools port within 30 s (${executable})`);
    sleepSync(200);
  }
  const port = Number(fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0]);
  const endpoint = `http://127.0.0.1:${port}`;
  const probe = probeSync(endpoint);
  if (!probe.alive) throw new Error(`Shared Chrome is not responding on ${endpoint}: ${probe.error}`);
  return { pid: child.pid, endpoint, userDataDir, executable, headless, version: probe.version.Browser, launchedAt: new Date().toISOString() };
}

function checkSharedBrowser(handle) {
  if (!processExists(handle.pid)) return { alive: false, error: `Chrome process ${handle.pid} is no longer running` };
  return probeSync(handle.endpoint);
}

// Graceful CDP Browser.close, then a forced stop of the process tree if Chrome does not exit.
function closeSharedBrowser(handle) {
  const script = `(async () => {
    const version = await (await fetch(process.argv[1] + '/json/version', { signal: AbortSignal.timeout(5000) })).json();
    const socket = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    socket.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
    await new Promise(resolve => setTimeout(resolve, 1000));
  })().then(() => process.exit(0), () => process.exit(1));`;
  spawnSync(process.execPath, ['-e', script, handle.endpoint], { timeout: 15000 });
  const deadline = Date.now() + 10000;
  while (processExists(handle.pid) && Date.now() < deadline) sleepSync(250);
  const forced = processExists(handle.pid);
  if (forced) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(handle.pid), '/T', '/F']);
    else { try { process.kill(-handle.pid, 'SIGKILL'); } catch { /* already gone */ } }
  }
  try { fs.rmSync(handle.userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }); } catch { /* Chrome may still hold files briefly */ }
  return { closedAt: new Date().toISOString(), forced };
}

// Stage side: attach to the shared browser. Never launches a replacement when the shared browser is unavailable.
async function connectSharedBrowser() {
  const { chromium } = require('@playwright/test');
  try {
    return await chromium.connectOverCDP(sharedEndpoint(), { slowMo: getSlowMoMs(), timeout: 30000 });
  } catch (error) {
    const interrupted = new Error(`Shared browser unavailable at ${sharedEndpoint()}; no replacement browser is launched. ${error.message}`);
    interrupted.failureCategory = 'Environment';
    throw interrupted;
  }
}

// The single context and tab. A tab is created only when Chrome has none (first attach after launch).
async function sharedContextAndPage(browser) {
  const context = browser.contexts()[0];
  if (!context) throw new Error('The shared browser exposes no default context');
  const pages = context.pages().filter(page => !page.isClosed());
  const page = pages[0] || await context.newPage();
  return { context, page };
}

// Escapes a tab hung by an application defect. Closing the only tab would quit the shared Chrome, so in shared mode
// a fresh tab is opened in the same context first; the run still has exactly one tab afterwards.
async function discardUnresponsivePage(page) {
  if (isSharedBrowser() && !page.isClosed()) await page.context().newPage().catch(() => null);
  await page.close({ runBeforeUnload: false }).catch(() => null);
}

function sessionOrigins(config) {
  return [...new Set([config.baseUrl, config.loginUrl].filter(Boolean).map(url => new URL(url).origin))];
}

async function signedInEmail(page) {
  return page.evaluate(() => {
    try { return String(JSON.parse(localStorage.getItem('userInfo') || '{}').email || '').toLowerCase(); } catch { return ''; }
  }).catch(() => '');
}

// Switching accounts in the same tab: clear cookies and every storage type for the SCP and SSO origins,
// so nothing from the previous user is carried into the next login.
async function clearAuthentication(page, config) {
  const context = page.context();
  await context.clearCookies();
  const session = await context.newCDPSession(page);
  try {
    for (const origin of sessionOrigins(config)) {
      await session.send('Storage.clearDataForOrigin', { origin, storageTypes: 'all' });
    }
  } finally {
    await session.detach().catch(() => null);
  }
}

// Re-uses the signed-in session only when it belongs to the expected account; otherwise clears it.
async function ensureAccountSession(page, config, username) {
  const expected = String(username || '').trim().toLowerCase();
  const onApp = (() => { try { return new URL(page.url()).origin === new URL(config.baseUrl).origin; } catch { return false; } })();
  const current = onApp ? await signedInEmail(page) : '';
  if (current && current === expected) return true;
  if (current || onApp) await clearAuthentication(page, config);
  return false;
}

module.exports = {
  ENDPOINT_ENV,
  checkSharedBrowser,
  clearAuthentication,
  closeSharedBrowser,
  connectSharedBrowser,
  discardUnresponsivePage,
  ensureAccountSession,
  isSharedBrowser,
  launchSharedBrowser,
  sharedContextAndPage,
  sharedEndpoint,
  signedInEmail
};
