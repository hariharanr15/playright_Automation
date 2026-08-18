#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { loadAutomationEnvironment } = require('../utils/env');

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join('-') + '_' + [
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join('-');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const getValue = (name, fallback = '') => {
    const inline = args.find((arg) => arg.startsWith(`--${name}=`));
    if (inline) return inline.slice(name.length + 3);
    const index = args.indexOf(`--${name}`);
    return index === -1 ? fallback : args[index + 1] || fallback;
  };

  return {
    suite: getValue('suite', 'default'),
    module: getValue('module'),
    feature: getValue('feature'),
    tags: getValue('tags'),
    name: getValue('name'),
    environmentName: getValue('env', process.env.TEST_ENV || 'staging'),
    headless: args.includes('--headless'),
    noOpen: args.includes('--no-open'),
    failed: args.includes('--failed')
  };
}

function profileForSuite(suite) {
  const normalized = String(suite || 'default').toLowerCase();
  const profiles = {
    default: 'default',
    smoke: 'smoke',
    regression: 'regression',
    catalog: 'applicationCatalog',
    construction: 'constructionDelivery',
    'user-management': 'userManagement'
  };
  return profiles[normalized] || normalized;
}

function cucumberExecutable() {
  return process.execPath;
}

function cucumberCliPath() {
  return path.resolve('node_modules', '@cucumber', 'cucumber', 'bin', 'cucumber-js');
}

function openReportInChrome(reportPath) {
  const fileUrl = `file:///${path.resolve(reportPath).replace(/\\/g, '/')}`;

  if (process.platform === 'win32') {
    const child = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `Start-Process -FilePath 'chrome.exe' -ArgumentList @('${fileUrl.replace(/'/g, "''")}')`
    ], { detached: true, stdio: 'ignore' });
    child.unref();
    return;
  }

  const child = spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [fileUrl], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
}

function normalizePath(value) {
  return path.normalize(String(value || ''));
}

function readRerunFile() {
  const latestRerunPath = path.resolve('reports', 'latest-cucumber-rerun.txt');
  if (!fs.existsSync(latestRerunPath)) return '';
  return fs.readFileSync(latestRerunPath, 'utf8').trim();
}

function buildCucumberArgs(options, reportDir) {
  const args = [cucumberCliPath()];
  const profile = profileForSuite(options.suite);
  const rerunPath = path.join(reportDir, 'rerun.txt');
  const formatPath = (formatter, outputPath) => `${formatter}:"${outputPath.replace(/"/g, '\\"')}"`;
  const scopedRun = Boolean(options.feature || options.module);

  if (options.failed) {
    const rerunContent = readRerunFile();
    if (!rerunContent) {
      throw new Error('No failed Cucumber scenarios were found in reports/latest-cucumber-rerun.txt.');
    }
    args.push(...rerunContent.split(/\s+/).filter(Boolean));
  } else if (scopedRun) {
    args.push('--config', path.resolve('config', 'cucumber-scoped.js'));
  } else {
    args.push('--profile', profile);
  }

  if (options.feature) {
    args.push(normalizePath(options.feature));
  } else if (options.module) {
    const modulePath = path.resolve('features', options.suite, options.module);
    if (!fs.existsSync(modulePath)) {
      throw new Error(`Module feature folder not found: ${modulePath}`);
    }
    args.push(modulePath);
  }

  if (options.tags) {
    args.push('--tags', options.tags);
  } else if (scopedRun && ['smoke', 'regression'].includes(String(options.suite).toLowerCase())) {
    args.push('--tags', `@${String(options.suite).toLowerCase()}`);
  }
  if (options.name) args.push('--name', options.name);

  args.push(
    '--format', 'progress',
    '--format', formatPath('html', path.join(reportDir, 'cucumber-report.html')),
    '--format', formatPath('json', path.join(reportDir, 'cucumber-report.json')),
    '--format', formatPath('rerun', rerunPath)
  );

  return { args, rerunPath };
}

function writeSummary(options, reportDir, result, startedAt, endedAt) {
  const exitCode = typeof result.status === 'number' ? result.status : 1;
  const summary = {
    applicationName: 'Construction Deliveries',
    environment: options.environmentName,
    suite: options.failed ? 'failed-rerun' : options.suite,
    browser: process.env.CUCUMBER_BROWSER_CHANNEL || 'chrome',
    headless: options.headless,
    startedAt,
    endedAt,
    durationMs: new Date(endedAt).getTime() - new Date(startedAt).getTime(),
    status: exitCode === 0 ? 'passed' : 'failed',
    exitCode,
    error: result.error?.message || '',
    htmlReport: path.join(reportDir, 'cucumber-report.html'),
    jsonReport: path.join(reportDir, 'cucumber-report.json'),
    rerunFile: path.join(reportDir, 'rerun.txt'),
    tags: options.tags || '',
    module: options.module || '',
    feature: options.feature || '',
    scenarioName: options.name || ''
  };

  fs.writeFileSync(path.join(reportDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  fs.writeFileSync(path.resolve('reports', 'latest-cucumber-report.json'), JSON.stringify(summary, null, 2), 'utf8');
}

function copyLatestRerun(reportDir) {
  const source = path.join(reportDir, 'rerun.txt');
  const target = path.resolve('reports', 'latest-cucumber-rerun.txt');
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, target);
  }
}

function main() {
  const options = parseArgs();
  const environment = loadAutomationEnvironment({
    environmentName: options.environmentName,
    rootDir: path.resolve(__dirname, '..')
  });
  options.environmentName = environment.displayName || environment.environmentName;
  const startedAt = new Date().toISOString();
  const suiteName = options.failed ? 'failed-rerun' : options.suite;
  const reportDir = path.resolve('reports', suiteName, timestamp());

  fs.mkdirSync(reportDir, { recursive: true });

  if (options.headless) {
    process.env.CUCUMBER_HEADLESS = 'true';
  }

  const { args } = buildCucumberArgs(options, reportDir);
  console.log(`Running Cucumber suite: ${suiteName}`);
  console.log(`Report folder: ${reportDir}`);
  console.log(`${cucumberExecutable()} ${args.join(' ')}`);

  const result = spawnSync(cucumberExecutable(), args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    shell: false
  });

  const endedAt = new Date().toISOString();
  writeSummary(options, reportDir, result, startedAt, endedAt);
  copyLatestRerun(reportDir);

  const htmlReport = path.join(reportDir, 'cucumber-report.html');
  if (!options.noOpen && fs.existsSync(htmlReport)) {
    openReportInChrome(htmlReport);
    console.log(`Opened Cucumber HTML report in Chrome: ${htmlReport}`);
  } else {
    console.log(`Cucumber HTML report: ${htmlReport}`);
  }

  if (result.error) {
    console.error(result.error.message || result.error);
  }

  process.exit(typeof result.status === 'number' ? result.status : 1);
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
