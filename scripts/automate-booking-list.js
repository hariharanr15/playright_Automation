const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const { DashboardPage } = require('../pages/dashboard.page');
const { Filter } = require('../pages/booking/Filter');

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

function getArgValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;

  const value = Number(process.argv[index + 1]);
  return Number.isFinite(value) ? value : fallback;
}

async function waitForQuietPage(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => null);
  await page.locator('[role="progressbar"], .MuiCircularProgress-root').first()
    .waitFor({ state: 'hidden', timeout: 30000 })
    .catch(() => null);
  await page.waitForTimeout(1500);
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

  await emailField.fill(process.env.VC_EMAIL);
  await passwordField.fill(process.env.VC_PASSWORD);
  await page.getByRole('button', { name: 'Login', exact: true }).click()
    .catch(async () => page.locator('button:has-text("Login"), input[type="submit"]').first().click());
  await waitForQuietPage(page);
  return true;
}

async function forceTargetProjectStorage(page, projectId) {
  const changed = await page.evaluate((targetProjectId) => {
    const values = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      values.push(localStorage.getItem(localStorage.key(index)));
    }

    for (const value of values) {
      try {
        const parsed = JSON.parse(value);
        const projects = Array.isArray(parsed?.projects) ? parsed.projects : [];
        const project = projects.find((candidate) => candidate?.ref === targetProjectId);
        if (project) {
          localStorage.setItem('v3_project_data', JSON.stringify(project));
          localStorage.setItem('v3_project_ref', project.ref);
          localStorage.setItem('v3_project_site_id', String(project.id));
          return project.name || project.ref;
        }
      } catch {
        // Ignore non-JSON storage entries.
      }
    }

    return null;
  }, projectId).catch(() => null);

  if (changed) console.log(`Target project selected in browser storage: ${changed}`);
}

async function openBookingList(page) {
  const baseUrl = process.env.BASE_URL || 'https://stg-login.voyagecontrol.com';
  const appUrl = process.env.APP_URL || 'https://stg-app.voyagecontrol.com';
  const projectId = process.env.PROJECT_ID || '5ET10000010';
  await page.goto(`${baseUrl}/api/sso/users/login/`, { waitUntil: 'domcontentloaded' });
  await waitForQuietPage(page);
  await loginIfNeeded(page);

  const dashboard = new DashboardPage(page);
  await dashboard.openPlatformIfChooser().catch(() => false);
  await forceTargetProjectStorage(page, projectId);
  const bookingUrl = `${appUrl.replace(/\/$/, '')}/${projectId}/booking`;

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    await page.goto(bookingUrl, { waitUntil: 'domcontentloaded' }).catch(() => null);
    await waitForQuietPage(page);

    if (await page.getByRole('button', { name: /New Booking/i }).first().isVisible({ timeout: 5000 }).catch(() => false)) {
      return;
    }

    if (await loginIfNeeded(page)) {
      await waitForQuietPage(page);
      continue;
    }

    if (await dashboard.openPlatformIfChooser().catch(() => false)) {
      await forceTargetProjectStorage(page, projectId);
      continue;
    }

    if (await dashboard.clickLocationProjectCard('Buckingham Palace').catch(() => false)) {
      await forceTargetProjectStorage(page, projectId);
      continue;
    }

    if (await dashboard.bookingMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dashboard.goToBookings();
      await waitForQuietPage(page);
      if (await page.getByRole('button', { name: /New Booking/i }).first().isVisible({ timeout: 5000 }).catch(() => false)) {
        return;
      }
    }

    await page.waitForTimeout(1000);
  }

  const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  throw new Error(`Booking List did not load. URL: ${page.url()}\n${bodyText.slice(0, 1000)}`);
}

async function clickToolbarButtonByOrder(page, index, label) {
  const button = page.locator('button.dl-btn').nth(index);
  await button.waitFor({ state: 'visible', timeout: 10000 });
  await button.click({ force: true });
  return `${label} toolbar button ${index}`;
}

async function saveDownload(page, outputDir) {
  const downloadPromise = page.waitForEvent('download', { timeout: 45000 });
  const clicked = await clickToolbarButtonByOrder(page, 2, 'download');
  const download = await downloadPromise;
  const suggested = download.suggestedFilename();
  const targetPath = path.join(outputDir, `${path.basename(suggested, path.extname(suggested))}-${Date.now()}.xlsx`);
  await download.saveAs(targetPath);
  return { clicked, suggested, savedAs: targetPath };
}

async function savePdfFromPrint(page, outputDir, browserPid) {
  const clicked = await clickToolbarButtonByOrder(page, 3, 'print');
  const targetPath = path.join(outputDir, `booking-list-filtered-${Date.now()}.pdf`);

  if (process.argv.includes('--headless')) {
    await page.waitForTimeout(1500);
    await page.emulateMedia({ media: 'print' });
    const client = await page.context().newCDPSession(page);
    const pdf = await client.send('Page.printToPDF', {
      printBackground: true,
      paperWidth: 8.27,
      paperHeight: 11.69,
      preferCSSPageSize: true
    });
    fs.writeFileSync(targetPath, Buffer.from(pdf.data, 'base64'));
    return { clicked, savedAs: targetPath, mode: 'headless-print-to-pdf' };
  }

  await clickChromePrintPreviewButtonAndSave(targetPath, browserPid);
  return { clicked, savedAs: targetPath, mode: 'chrome-print-preview-button' };
}

function clickChromePrintPreviewButtonAndSave(targetPath, browserPid) {
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
Start-Sleep -Milliseconds 5000
function Invoke-NativeButtonByName($name) {
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

  for ($attempt = 0; $attempt -lt 20; $attempt++) {
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
      Write-Host "Invoking native Print button at $($candidate.Current.BoundingRectangle)"
      $pattern = $candidate.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
      $pattern.Invoke()
      return $true
    }

    Start-Sleep -Milliseconds 500
  }

  return $false
}

$targetPid = ${Number.isFinite(browserPid) ? browserPid : 0}
$chromeCandidates = Get-Process chrome -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 -and ($_.MainWindowTitle -match 'Voyage Control|Print|Chrome') }
$chrome = $chromeCandidates | Where-Object { $_.Id -eq $targetPid } | Select-Object -First 1
if (-not $chrome) {
  $chrome = $chromeCandidates | Sort-Object StartTime -Descending | Select-Object -First 1
}
if (-not $chrome) {
  throw 'Could not find the Chrome print preview window.'
}
Write-Host "Focusing Chrome PID $($chrome.Id): $($chrome.MainWindowTitle)"
[Win32]::SetForegroundWindow($chrome.MainWindowHandle) | Out-Null
Start-Sleep -Milliseconds 1000
if (-not (Invoke-NativeButtonByName 'Print')) {
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
}
Start-Sleep -Milliseconds 3500
foreach ($title in @('Save Print Output As', 'Save As')) {
  $activatedSaveDialog = $wshell.AppActivate($title)
  if ($activatedSaveDialog) {
    Write-Host "Activated save dialog: $title"
  }
  Start-Sleep -Milliseconds 300
}
[System.Windows.Forms.Clipboard]::SetText(${JSON.stringify(targetPath)})
Start-Sleep -Milliseconds 300
$wshell.SendKeys('^v')
Start-Sleep -Milliseconds 300
$wshell.SendKeys('{ENTER}')
Start-Sleep -Milliseconds 5000
if (-not (Test-Path -LiteralPath ${JSON.stringify(targetPath)})) {
  $wshell.SendKeys('{ENTER}')
  Start-Sleep -Milliseconds 5000
}
if (-not (Test-Path -LiteralPath ${JSON.stringify(targetPath)})) {
  throw "PDF was not saved to ${targetPath}"
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

async function main() {
  loadEnvironment();

  const headless = process.argv.includes('--headless');
  const noExports = process.argv.includes('--no-exports');
  const keepOpenMs = getArgValue('--keep-open-ms', headless ? 0 : 15000);
  const authPath = path.resolve('auth.json');
  const outputDir = path.resolve('test-results', 'booking-list-exports');
  fs.mkdirSync(outputDir, { recursive: true });

  const contextOptions = {
    acceptDownloads: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    permissions: ['notifications']
  };
  if (fs.existsSync(authPath)) {
    contextOptions.storageState = authPath;
  }

  const browser = await chromium.launch({
    channel: 'chrome',
    headless,
    slowMo: headless ? 0 : 150
  });
  const browserPid = typeof browser.process === 'function' ? browser.process()?.pid : undefined;

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  try {
    console.log('Opening Booking List in Chrome...');
    await openBookingList(page);

    const newBookingButton = page.getByRole('button', { name: /New Booking/i }).first();
    if (!(await newBookingButton.isVisible({ timeout: 15000 }).catch(() => false))) {
      const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
      throw new Error(`Booking List did not load. URL: ${page.url()}\n${bodyText.slice(0, 1000)}`);
    }

    console.log('Applying Booking List filters only...');
    const filter = new Filter(page);
    const result = await filter.applyCodegenRecordedFilterFlow({
      includeCalendarRecordFlow: false
    });

    console.log(`Booking List automation complete. Visible filtered records: ${result.finalRecordCount}`);
    if (noExports) {
      console.log('Skipping Booking List exports because --no-exports was provided.');
    } else {
    console.log('Clicking download icon for XLSX...');
    const xlsxResult = await saveDownload(page, outputDir);
    console.log(`XLSX saved: ${xlsxResult.savedAs}`);

    console.log('Clicking print icon and saving PDF...');
    const pdfResult = await savePdfFromPrint(page, outputDir, browserPid);
    console.log(`PDF saved: ${pdfResult.savedAs}`);
    }

    if (keepOpenMs > 0) {
      console.log(`Keeping Chrome open for ${Math.round(keepOpenMs / 1000)} seconds...`);
      await page.waitForTimeout(keepOpenMs);
    }
  } finally {
    await Promise.race([
      context.close().catch(() => null),
      new Promise((resolve) => setTimeout(resolve, 5000))
    ]);
    await Promise.race([
      browser.close().catch(() => null),
      new Promise((resolve) => setTimeout(resolve, 5000))
    ]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
