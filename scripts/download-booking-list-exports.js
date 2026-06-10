const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const { DashboardPage } = require('../pages/booking/dashboard.page');
const { Filter } = require('../pages/booking/filter.page');
const { highlight } = require('../utils/highlight');

function loadEnvironment() {
  const envPath = path.resolve('.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = value;
    }
  }

  process.env.VC_EMAIL = process.env.VC_EMAIL || 'priyanka.dl@neuralrays.ai';
  process.env.VC_PASSWORD = process.env.VC_PASSWORD || '2C@53WsTQ#&ffSQ&';
}

async function waitForQuietPage(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => null);
  await page.locator('[role="progressbar"], .MuiCircularProgress-root').first()
    .waitFor({ state: 'hidden', timeout: 30000 })
    .catch(() => null);
  await page.waitForTimeout(2000);
}

async function loginIfNeeded(page) {
  const emailField = page.locator([
    'input[type="email"]',
    'input[name*="email" i]',
    'input[id*="email" i]',
    'input[placeholder*="email" i]',
    'input[type="text"]'
  ].join(', ')).first();
  const passwordField = page.locator([
    'input[type="password"]',
    'input[name*="password" i]',
    'input[id*="password" i]',
    'input[placeholder*="password" i]'
  ].join(', ')).first();

  if (!(await emailField.isVisible({ timeout: 5000 }).catch(() => false)) ||
      !(await passwordField.isVisible({ timeout: 5000 }).catch(() => false))) {
    return false;
  }

  const email = process.env.VC_EMAIL;
  const password = process.env.VC_PASSWORD;

  await emailField.fill(email);
  await passwordField.fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click()
    .catch(async () => page.locator('button:has-text("Login"), input[type="submit"]').first().click());
  await waitForQuietPage(page);
  return true;
}

async function visibleControlSummary(page) {
  return page.evaluate((onlyExportLike = true) => {
    const visible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        rect.width > 0 &&
        rect.height > 0;
    };

    return Array.from(document.querySelectorAll('button, a, [role="button"]'))
      .filter(visible)
      .map((element, index) => ({
        index,
        text: (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim(),
        aria: element.getAttribute('aria-label') || '',
        title: element.getAttribute('title') || '',
        className: element.className ? String(element.className) : '',
        testIds: Array.from(element.querySelectorAll('[data-testid]'))
          .map((child) => child.getAttribute('data-testid'))
          .filter(Boolean),
        html: element.outerHTML.slice(0, 220)
      }));
  }, true);
}

async function allVisibleControlSummary(page) {
  return page.evaluate(() => {
    const visible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        rect.width > 0 &&
        rect.height > 0;
    };

    return Array.from(document.querySelectorAll('button, a, [role="button"]'))
      .filter(visible)
      .map((element, index) => {
        const rect = element.getBoundingClientRect();
        return {
          index,
          text: (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim(),
          aria: element.getAttribute('aria-label') || '',
          title: element.getAttribute('title') || '',
          className: element.className ? String(element.className) : '',
          testIds: Array.from(element.querySelectorAll('[data-testid]'))
            .map((child) => child.getAttribute('data-testid'))
            .filter(Boolean),
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          },
          html: element.outerHTML.slice(0, 220)
        };
      });
  });
}

async function exportLikeControlSummary(page) {
  const controls = await allVisibleControlSummary(page);
  return controls.filter((control) => /download|export|excel|xlsx|print|pdf|FileDownload|Print|GetApp|cloud_download|dl-btn/i.test(
        `${control.text} ${control.aria} ${control.title} ${control.className} ${control.testIds.join(' ')} ${control.html}`
      ));
}

async function clickFirstVisible(page, candidates, label) {
  for (const selector of candidates) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible({ timeout: 2500 }).catch(() => false)) {
      await locator.click({ force: true });
      return selector;
    }
  }

  const controls = await visibleControlSummary(page);
  throw new Error(`Could not find ${label} control. Matching visible controls: ${JSON.stringify(controls, null, 2)}`);
}

async function chooseFormatIfMenuAppears(page, pattern, label) {
  const option = page.getByRole('menuitem', { name: pattern }).first();
  if (await option.isVisible({ timeout: 2500 }).catch(() => false)) {
    await option.click();
    return `${label} menuitem`;
  }

  const button = page.getByRole('button', { name: pattern }).first();
  if (await button.isVisible({ timeout: 1000 }).catch(() => false)) {
    await button.click();
    return `${label} button`;
  }

  const text = page.getByText(pattern).first();
  if (await text.isVisible({ timeout: 1000 }).catch(() => false)) {
    await text.click();
    return `${label} text`;
  }

  return null;
}

async function clickToolbarButtonByOrder(page, index, label) {
  const button = page.locator('button.dl-btn').nth(index);
  await button.waitFor({ state: 'visible', timeout: 10000 });
  if (/print/i.test(label)) {
    await highlight(button, 'Print');
    await page.waitForTimeout(Number(process.env.PRINT_CLICK_PREVIEW_MS || 1200));
  }
  await button.click({ force: true });
  return `${label} toolbar button ${index}`;
}

async function probeToolbarButton(page, index) {
  const events = [];
  const record = (type, detail) => {
    events.push({ type, detail, at: new Date().toISOString() });
  };

  const onRequest = (request) => {
    const url = request.url();
    if (/pdf|xlsx|excel|export|download|booking/i.test(url)) {
      record('request', { method: request.method(), url });
    }
  };
  const onResponse = async (response) => {
    const url = response.url();
    const headers = response.headers();
    if (/pdf|xlsx|excel|export|download|booking/i.test(url) ||
        /pdf|spreadsheet|excel|octet-stream/i.test(`${headers['content-type'] || ''} ${headers['content-disposition'] || ''}`)) {
      record('response', {
        status: response.status(),
        url,
        contentType: headers['content-type'] || '',
        contentDisposition: headers['content-disposition'] || ''
      });
    }
  };
  const onPopup = (popup) => record('popup', { url: popup.url() });

  page.on('request', onRequest);
  page.on('response', onResponse);
  page.on('popup', onPopup);

  const downloadPromise = page.waitForEvent('download', { timeout: 15000 })
    .then((download) => record('download', { suggested: download.suggestedFilename(), url: download.url() }))
    .catch((error) => record('download-timeout', error.message));

  try {
    await clickToolbarButtonByOrder(page, index, `probe-${index}`);
    await page.waitForTimeout(15000);
    await downloadPromise;
    record('visible-controls-after-click', await exportLikeControlSummary(page).catch((error) => ({ error: error.message })));
    record('url-after-click', page.url());
    return events;
  } finally {
    page.off('request', onRequest);
    page.off('response', onResponse);
    page.off('popup', onPopup);
  }
}

function sanitizeFilenamePart(value, fallback = 'booking-list') {
  const cleaned = String(value || fallback)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');

  return cleaned || fallback;
}

function currentDateForFilename() {
  const timeZone = process.env.REPORT_TIME_ZONE || 'Asia/Calcutta';
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const valueFor = (type) => parts.find((part) => part.type === type)?.value;
  return `${valueFor('year')}-${valueFor('month')}-${valueFor('day')}`;
}

async function getProjectName(page) {
  if (process.env.PROJECT_NAME) return process.env.PROJECT_NAME;

  const visibleProjectName = await page.locator('body').innerText({ timeout: 5000 })
    .then((text) => {
      const knownProject = text.match(/V3 Construction deliveries/i);
      return knownProject ? knownProject[0] : null;
    })
    .catch(() => null);

  if (visibleProjectName) return visibleProjectName;

  const storageProjectName = await page.evaluate(() => {
    const parseJson = (value) => {
      try {
        return JSON.parse(value);
      } catch (error) {
        return null;
      }
    };

    const projectData = parseJson(localStorage.getItem('v3_project_data'));
    if (projectData?.name) return projectData.name;
    if (projectData?.ref) return projectData.ref;

    return localStorage.getItem('v3_project_name') ||
      localStorage.getItem('v3_project_ref') ||
      null;
  }).catch(() => null);

  if (storageProjectName && !/^Buckingham Palace$/i.test(storageProjectName)) {
    return storageProjectName;
  }

  return 'V3 Construction deliveries';
}

function buildExportBaseName(projectName) {
  return `${sanitizeFilenamePart(projectName)}-${currentDateForFilename()}`;
}

function nextAvailableFilePath(outputDir, baseName, extension) {
  let candidate = path.join(outputDir, `${baseName}${extension}`);
  for (let index = 1; fs.existsSync(candidate); index++) {
    candidate = path.join(outputDir, `${baseName}-${index}${extension}`);
  }
  return candidate;
}

async function openBookingList(page) {
  const baseUrl = process.env.BASE_URL || 'https://stg-login.voyagecontrol.com';
  await page.goto(`${baseUrl}/api/sso/users/login/`, { waitUntil: 'domcontentloaded' });
  await waitForQuietPage(page);
  await loginIfNeeded(page);

  const dashboard = new DashboardPage(page);
  if (await dashboard.projectLink.isVisible({ timeout: 15000 }).catch(() => false) ||
      await dashboard.projectLinkFallback1.isVisible({ timeout: 1000 }).catch(() => false)) {
    await dashboard.selectProject();
  }

  if (await dashboard.location.isVisible({ timeout: 15000 }).catch(() => false) ||
      await dashboard.locationFallback1.isVisible({ timeout: 1000 }).catch(() => false)) {
    await dashboard.selectLocation();
  }

  await dashboard.goToBookings();
  await waitForQuietPage(page);
}

async function saveDownload(page, clickAction, outputDir, expectedExtension, baseName) {
  const downloadPromise = page.waitForEvent('download', { timeout: 45000 });
  let clicked;
  try {
    clicked = await clickAction();
  } catch (error) {
    downloadPromise.catch(() => null);
    throw error;
  }
  const download = await downloadPromise;
  const suggested = download.suggestedFilename();
  const extension = expectedExtension || path.extname(suggested);
  const targetPath = path.join(outputDir, `${baseName}${extension}`);
  if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
  await download.saveAs(targetPath);
  return { clicked, suggested, savedAs: targetPath };
}

async function clickChromePrintPreviewPrintButton(browser) {
  const browserSession = await browser.newBrowserCDPSession();
  let sessionId = null;

  try {
    for (let attempt = 0; attempt < 40; attempt++) {
      const targets = await browserSession.send('Target.getTargets').catch(() => ({ targetInfos: [] }));
      const printTarget = targets.targetInfos?.find((target) => /^chrome:\/\/print\/?/i.test(target.url));
      if (printTarget) {
        const attach = await browserSession.send('Target.attachToTarget', {
          targetId: printTarget.targetId
        });
        sessionId = attach.sessionId;
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (!sessionId) {
      throw new Error('Chrome print preview target did not open.');
    }

    let messageId = 0;
    const pending = new Map();
    const onMessage = (event) => {
      if (event.sessionId !== sessionId) return;
      const message = JSON.parse(event.message);
      const waiter = pending.get(message.id);
      if (!waiter) return;

      pending.delete(message.id);
      if (message.error) {
        waiter.reject(new Error(`${message.error.message || 'CDP command failed'} (${message.error.code})`));
      } else {
        waiter.resolve(message.result);
      }
    };
    browserSession.on('Target.receivedMessageFromTarget', onMessage);

    const sendToPrintTarget = async (method, params = {}) => {
      const id = ++messageId;
      const responsePromise = new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
      await browserSession.send('Target.sendMessageToTarget', {
        sessionId,
        message: JSON.stringify({ id, method, params })
      });
      return responsePromise;
    };

    const expression = `(() => {
      const visible = (node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };
      const candidates = [];
      const visit = (root) => {
        const nodes = root.querySelectorAll ? Array.from(root.querySelectorAll('*')) : [];
        for (const node of nodes) {
          const text = (node.innerText || node.textContent || '').replace(/\\s+/g, ' ').trim();
          const aria = node.getAttribute('aria-label') || '';
          const id = node.id || '';
          const className = String(node.className || '');
          const isButton = /button/i.test(node.localName) || node.getAttribute('role') === 'button';
          if (isButton && /print/i.test([text, aria, id, className].join(' ')) && visible(node)) {
            const rect = node.getBoundingClientRect();
            candidates.push({ node, bottom: rect.bottom, text, aria, id, className });
          }
          if (node.shadowRoot) visit(node.shadowRoot);
        }
      };
      visit(document);
      candidates.sort((a, b) => b.bottom - a.bottom);
      const candidate = candidates.find(({ node }) => !node.disabled && node.getAttribute('aria-disabled') !== 'true')?.node;
      if (!candidate) return { clicked: false, candidates: candidates.map(({ text, aria, id, className }) => ({ text, aria, id, className })) };
      const rect = candidate.getBoundingClientRect();
      candidate.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }));
      candidate.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }));
      candidate.click();
      return { clicked: true, text: candidate.innerText || candidate.textContent || '', id: candidate.id || '', className: String(candidate.className || '') };
    })()`;

    let value = null;
    for (let attempt = 0; attempt < 40; attempt++) {
      const result = await sendToPrintTarget('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      value = result.result?.value;
      if (value?.clicked) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (!value?.clicked) {
      throw new Error(`Chrome print preview Print button was not found: ${JSON.stringify(value)}`);
    }
    browserSession.off('Target.receivedMessageFromTarget', onMessage);
  } finally {
    if (sessionId) {
      await browserSession.send('Target.detachFromTarget', { sessionId }).catch(() => null);
    }
    await browserSession.detach().catch(() => null);
  }
}

function psSingleQuoted(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function saveChromePrintDialogFile(targetPath, options = {}) {
  const targetDir = path.dirname(targetPath);
  const targetFile = path.basename(targetPath);
  const shouldClickPrint = options.clickPrintPreviewButton !== false;
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName UIAutomationClient
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int cButtons, int dwExtraInfo);
}
public struct RECT {
  public int Left;
  public int Top;
  public int Right;
  public int Bottom;
}
"@
$wshell = New-Object -ComObject WScript.Shell
$targetPath = ${psSingleQuoted(targetPath)}
$targetDir = ${psSingleQuoted(targetDir)}
$targetFile = ${psSingleQuoted(targetFile)}
$filenamePreviewMs = ${Number(process.env.PDF_FILENAME_PREVIEW_MS || 5000)}

function Invoke-VisibleButtonByName($name) {
  $root = [System.Windows.Automation.AutomationElement]::RootElement
  $nameCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::NameProperty,
    $name
  )
  $buttonCondition = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Button
  )
  $condition = New-Object System.Windows.Automation.AndCondition($nameCondition, $buttonCondition)

  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    $matches = $root.FindAll([System.Windows.Automation.TreeScope]::Subtree, $condition)
    $candidate = $null
    $candidateBottom = -1

    for ($index = 0; $index -lt $matches.Count; $index++) {
      $element = $matches.Item($index)
      if ($element.Current.IsOffscreen) {
        continue
      }

      $rect = $element.Current.BoundingRectangle
      if ($rect.Width -lt 20 -or $rect.Height -lt 20) {
        continue
      }

      if ($rect.Bottom -gt $candidateBottom) {
        $candidate = $element
        $candidateBottom = $rect.Bottom
      }
    }

    if ($candidate -ne $null) {
      Write-Host "Invoking $name button at $($candidate.Current.BoundingRectangle)"
      $pattern = $candidate.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
      $pattern.Invoke()
      return $true
    }

    Start-Sleep -Milliseconds 500
  }

  return $false
}

function Click-ChromePrintPreviewButton {
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    $chrome = Get-Process chrome -ErrorAction SilentlyContinue |
      Where-Object { $_.MainWindowHandle -ne 0 -and ($_.MainWindowTitle -match 'Voyage Control|Print|Chrome') } |
      Sort-Object StartTime -Descending |
      Select-Object -First 1

    if ($chrome) {
      Write-Host "Focusing Chrome PID $($chrome.Id): $($chrome.MainWindowTitle)"
      [Win32]::SetForegroundWindow($chrome.MainWindowHandle) | Out-Null
      Start-Sleep -Milliseconds 1000

      if (Invoke-VisibleButtonByName 'Print') {
        return $true
      }

      Write-Host 'Native Print button not found; using coordinate fallback.'
      $rect = New-Object RECT
      [Win32]::GetWindowRect($chrome.MainWindowHandle, [ref]$rect) | Out-Null
      $printX = $rect.Right - 175
      $printY = $rect.Bottom - 52
      [Win32]::SetCursorPos($printX, $printY) | Out-Null
      Start-Sleep -Milliseconds 250
      [Win32]::mouse_event(0x0002, 0, 0, 0, 0)
      Start-Sleep -Milliseconds 100
      [Win32]::mouse_event(0x0004, 0, 0, 0, 0)
      return $true
    }

    Start-Sleep -Milliseconds 500
  }

  return $false
}

function Set-SaveDialogFileName {
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    foreach ($title in @('Save Print Output As', 'Save As')) {
      if ($wshell.AppActivate($title)) {
        Write-Host "Activated save dialog: $title"
        Start-Sleep -Milliseconds 800

        Write-Host "Opening Desktop folder: $targetDir"
        $wshell.SendKeys('%d')
        Start-Sleep -Milliseconds 250
        [System.Windows.Forms.Clipboard]::SetText($targetDir)
        Start-Sleep -Milliseconds 250
        $wshell.SendKeys('^v')
        Start-Sleep -Milliseconds 250
        $wshell.SendKeys('{ENTER}')
        Start-Sleep -Milliseconds 1000

        Write-Host "Entering PDF file name: $targetFile"
        $wshell.SendKeys('%n')
        Start-Sleep -Milliseconds 300
        [System.Windows.Forms.Clipboard]::SetText($targetFile)
        Start-Sleep -Milliseconds 200
        $wshell.SendKeys('^a')
        Start-Sleep -Milliseconds 100
        $wshell.SendKeys('^v')
        Write-Host "Waiting $filenamePreviewMs ms so the entered PDF file name is visible."
        Start-Sleep -Milliseconds $filenamePreviewMs
        $wshell.SendKeys('{ENTER}')
        return $true
      }
    }

    Start-Sleep -Milliseconds 500
  }

  return $false
}

if (${shouldClickPrint ? '$true' : '$false'}) {
  Start-Sleep -Milliseconds 3000
  if (-not (Click-ChromePrintPreviewButton)) {
    throw 'Could not click the Chrome print preview Print button.'
  }
}

Start-Sleep -Milliseconds 1500
if (-not (Set-SaveDialogFileName)) {
  throw 'Could not activate the PDF save dialog.'
}

Start-Sleep -Milliseconds 5000
if (-not (Test-Path -LiteralPath $targetPath)) {
  $wshell.SendKeys('{ENTER}')
  Start-Sleep -Milliseconds 5000
}
if (-not (Test-Path -LiteralPath $targetPath)) {
  throw "PDF was not saved to $targetPath"
}
`;

  execFileSync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    script
  ], { stdio: 'inherit' });
}

async function savePdfFromChromePrintPreview(page, outputDir, baseName, browser) {
  if (process.argv.includes('--headless')) {
    throw new Error('The real Chrome print-preview PDF requires headed Chrome. Run npm run automate:booking-list-exports.');
  }

  const clicked = await clickToolbarButtonByOrder(page, 3, 'print');
  const targetPath = nextAvailableFilePath(outputDir, baseName, '.pdf');
  await clickChromePrintPreviewPrintButton(browser);
  saveChromePrintDialogFile(targetPath, { clickPrintPreviewButton: false });
  return { clicked, savedAs: targetPath, mode: 'chrome-print-preview' };
}

async function main() {
  loadEnvironment();

  const authPath = path.resolve('auth.json');
  const outputDir = process.env.BOOKING_EXPORT_DIR || path.join(os.homedir(), 'Desktop');
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: process.argv.includes('--headless'),
    slowMo: process.argv.includes('--headless') ? 0 : 100
  });

  const contextOptions = {
    acceptDownloads: true,
    viewport: { width: 1280, height: 720 }
  };
  if (fs.existsSync(authPath)) {
    contextOptions.storageState = authPath;
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  try {
    await openBookingList(page);

    if (!(await page.getByRole('button', { name: /New Booking/i }).first().isVisible({ timeout: 10000 }).catch(() => false))) {
      const pageText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
      const controls = await exportLikeControlSummary(page).catch(() => []);
      throw new Error(`Booking List did not load. Current URL: ${page.url()}\nPage text: ${pageText.slice(0, 1200)}\nVisible export controls: ${JSON.stringify(controls, null, 2)}`);
    }

    const filter = new Filter(page);
    const filterResult = await filter.applyCodegenRecordedFilterFlow({
      includeCalendarRecordFlow: false
    });

    await waitForQuietPage(page);
    console.log('Filtered booking records:', filterResult.finalRecordCount);

    const projectName = await getProjectName(page);
    const exportBaseName = buildExportBaseName(projectName);
    const pdfBaseName = sanitizeFilenamePart(process.env.PDF_EXPORT_NAME || currentDateForFilename());
    console.log(`Saving booking list exports to: ${outputDir}`);
    console.log(`Export filename base: ${exportBaseName}`);
    console.log(`PDF filename base: ${pdfBaseName}`);

    if (process.argv.includes('--inspect-only')) {
      console.log('All visible controls:', JSON.stringify(await allVisibleControlSummary(page), null, 2));
      console.log('Export-like visible controls:', JSON.stringify(await exportLikeControlSummary(page), null, 2));
      return;
    }

    const probeIndexArg = process.argv.find((arg) => arg.startsWith('--probe-toolbar-index='));
    if (probeIndexArg) {
      const index = Number(probeIndexArg.split('=')[1]);
      if (!Number.isInteger(index)) throw new Error(`Invalid probe toolbar index: ${probeIndexArg}`);
      console.log(`Toolbar button ${index} probe:`, JSON.stringify(await probeToolbarButton(page, index), null, 2));
      return;
    }

    const xlsxResult = await saveDownload(
      page,
      async () => {
        const clicked = await clickToolbarButtonByOrder(page, 2, 'download');
        const format = await chooseFormatIfMenuAppears(page, /xlsx|excel/i, 'XLSX');
        return format || clicked;
      },
      outputDir,
      '.xlsx',
      exportBaseName
    );
    console.log('XLSX download:', JSON.stringify(xlsxResult, null, 2));

    await waitForQuietPage(page);

    const pdfResult = await savePdfFromChromePrintPreview(page, outputDir, pdfBaseName, browser);
    console.log('PDF download:', JSON.stringify(pdfResult, null, 2));
  } finally {
    await context.close().catch(() => null);
    await browser.close().catch(() => null);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
