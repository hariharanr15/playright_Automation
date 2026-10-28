// Full SCP regression in the mandatory module order, gated by the access discovered for the configured account and project.
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
require('../utils/env').loadEnvFile();
const { MODULES, moduleById } = require('../config/scp-module-registry');
const { STATUS, moduleAccess, maskEmail } = require('../utils/access/access-model');
const { getScpConfig } = require('../config/scp.config');
const { renderReport } = require('./generate-scp-full-regression-report');
const sharedBrowser = require('../utils/shared-browser');
const { KNOWN_DEFECT, classifyScenarios } = require('../utils/known-defects');

const ACCESS_SPEC = 'tests/regression/user-management/scp-dynamic-access.spec.js';
const FLAGS = ['--execute', '--with-inventory-mutations', '--with-owned-mutations', '--include-unqualified', '--demo', '--headless', '--headed', '--normal', '--fast', '--isolated-browser'];
const args = process.argv.slice(2);
const bad = args.filter(arg => !FLAGS.includes(arg) && !/^--module=[a-z-]+$/.test(arg) && !/^--access-matrix=.+$/.test(arg));
if (bad.length) throw new Error(`Unsupported: ${bad.join(' ')}. Supported: ${FLAGS.join(' ')} --module=ID (repeatable) --access-matrix=FILE`);
const execute = args.includes('--execute');
const ownedMutations = args.includes('--with-owned-mutations');
const mutations = args.includes('--with-inventory-mutations') || ownedMutations;
const unqualified = args.includes('--include-unqualified');
const demo = args.includes('--demo');
const headless = args.includes('--headless') || (!demo && !args.includes('--headed') && /^true$/i.test(process.env.PLAYWRIGHT_HEADLESS || process.env.HEADLESS || 'true'));
const selected = args.filter(arg => arg.startsWith('--module=')).map(arg => moduleById(arg.slice(9)).id);
const reusedMatrix = args.find(arg => arg.startsWith('--access-matrix='))?.slice(16);
if (args.includes('--normal') && args.includes('--fast')) throw new Error('Choose one execution speed: --normal or --fast');
// normal: 500–1,000 ms visual pacing between major actions; fast: condition-based waits only. Headed defaults to normal.
const configuredMode = String(process.env.SCP_EXECUTION_MODE || '').toLowerCase();
const executionMode = demo ? 'demo' : args.includes('--fast') ? 'fast' : args.includes('--normal') ? 'normal'
  : ['normal', 'fast'].includes(configuredMode) ? configuredMode : headless ? 'fast' : 'normal';
if (demo && mutations) throw new Error('The demo rehearsal is read-only; do not combine --demo with --with-inventory-mutations');

const config = getScpConfig();
// The regression runs on staging only (decision of 28 Oct 2026); UAT or production URLs are refused before anything starts.
const STAGING = /^https:\/\/stg-[a-z-]+\.voyagecontrol\.com$/;
for (const [name, url] of [['SCP_BASE_URL', config.baseUrl], ['SCP_LOGIN_URL', config.loginUrl], ['SCP_MANAGEMENT_DASHBOARD_URL', config.managementDashboardUrl]]) {
  if (!STAGING.test(new URL(url).origin)) throw new Error(`${name} must point to the staging environment (stg-*.voyagecontrol.com); got ${new URL(url).origin}`);
}
if (mutations && !process.env.SCP_INVENTORY_DATA) {
  const discovered = path.join(root, 'reports', 'inventory-discovery', 'environment.json');
  if (fs.existsSync(discovered)) {
    try {
      const allocation = JSON.parse(fs.readFileSync(discovered, 'utf8'));
      if (allocation.project === config.projectName) process.env.SCP_INVENTORY_DATA = discovered;
    } catch { /* Invalid discovery data is not a prerequisite allocation. */ }
  }
}
const cli = require.resolve('@playwright/test/cli');
const run = path.join(root, 'reports', `scp-full-regression-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`);
fs.mkdirSync(run, { recursive: true });
const matrixFile = path.join(run, 'access-matrix.json');
const manifest = { title: 'SCP full regression', mode: execute ? 'execute' : 'registration-only', headless, demo, executionMode,
  project: config.projectName, user: maskEmail(config.accounts[config.defaultRole]?.username || config.username),
  options: { mutations, ownedMutations, includeUnqualified: unqualified, modules: selected.length ? selected : 'all', reusedAccessMatrix: reusedMatrix || null },
  allocations: { inventory: process.env.SCP_INVENTORY_DATA || null, procurement: process.env.SCP_PROCUREMENT_DATA || null, fdi: process.env.SCP_FDI_READONLY_DATA || null,
    accessExpectations: process.env.SCP_ACCESS_EXPECTATIONS || null },
  policy: { executionMode, actionIntervalMs: executionMode === 'fast' ? 0 : Number(process.env.SCP_ACTION_INTERVAL_MS || 700), maximumAttemptsPerStep: 2, wholeTestRetries: 0, continueAfterFailure: true, order: MODULES.map(module => module.name) },
  startedAt: new Date().toISOString(), access: null, modules: [] };
const save = () => fs.writeFileSync(path.join(run, 'manifest.json'), JSON.stringify(manifest, null, 2));

// One Chrome instance, context and tab for the whole execution. Stage processes attach over CDP (utils/shared-browser.js);
// --isolated-browser restores one browser per stage process.
let sharedBrowserHandle = null;
let browserInterrupted = null;
if (execute && !args.includes('--isolated-browser')) {
  try {
    sharedBrowserHandle = sharedBrowser.launchSharedBrowser({ headless });
    const { userDataDir, ...visible } = sharedBrowserHandle;
    manifest.browser = { mode: 'shared', ...visible, interruptions: [] };
    console.log(`Shared browser: ${visible.version} (pid ${visible.pid}) at ${visible.endpoint}`);
  } catch (error) {
    manifest.browser = { mode: 'shared', error: error.message };
    save();
    throw error;
  }
} else manifest.browser = { mode: execute ? 'isolated per stage' : 'none (registration only)' };
save();

function closeBrowserOnce() {
  if (!sharedBrowserHandle || manifest.browser.closedAt) return;
  Object.assign(manifest.browser, sharedBrowser.closeSharedBrowser(sharedBrowserHandle));
  save();
}
// Explicit termination still closes the single browser; a normal run closes it after the reports.
process.on('exit', closeBrowserOnce);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { manifest.terminatedBy = signal; process.exit(130); });

// Checks the shared browser before a stage. An unresponsive or crashed browser is reported, never silently replaced.
function sharedBrowserReady(label, phase = 'before') {
  if (!sharedBrowserHandle) return true;
  if (browserInterrupted) return false;
  const state = sharedBrowser.checkSharedBrowser(sharedBrowserHandle);
  if (state.alive) return true;
  browserInterrupted = { stage: label, phase, at: new Date().toISOString(), error: state.error };
  manifest.browser.interruptions.push(browserInterrupted);
  console.log(`Shared browser interrupted ${phase} ${label}: ${state.error}. No replacement browser is launched; remaining stages are Blocked.`);
  save();
  return false;
}
const interruptedResult = () => ({ status: 'Blocked',
  reason: `Shared browser interrupted ${browserInterrupted.phase} ${browserInterrupted.stage} (${browserInterrupted.error}); no replacement browser was launched` });

function stageEnv(destination, stage) {
  const env = { ...process.env, SCP_READONLY_EXECUTION: 'false', HEADLESS: String(headless), PLAYWRIGHT_HEADLESS: String(headless),
    SCP_EXECUTION_MODE: executionMode, SCP_PENDING_RUN_DIR: destination, SCP_INVENTORY_RUN_DIR: destination,
    SCP_EXECUTION_DIR: destination, SCP_DETAILED_RUN_DIR: destination, SCP_ACCESS_MATRIX_FILE: matrixFile,
    SCP_REGRESSION_MODULE: stage.moduleId || '',
    // Each full run keeps its own recovery checkpoints, so data and step history from earlier runs are never replayed.
    // Targeted reruns resume from the checkpoint folder of the run they rerun.
    SCP_RECOVERY_DIR: process.env.SCP_RECOVERY_DIR || path.join(run, 'recovery'),
    SCP_INVENTORY_MUTATIONS: stage.mutation && mutations ? 'true' : 'false',
    SCP_FDI_OWNED_MUTATIONS: ownedMutations ? 'true' : process.env.SCP_FDI_OWNED_MUTATIONS || 'false',
    SCP_SHIPMENT_OWNED_MUTATIONS: ownedMutations ? 'true' : process.env.SCP_SHIPMENT_OWNED_MUTATIONS || 'false' };
  if (sharedBrowserHandle) env[sharedBrowser.ENDPOINT_ENV] = sharedBrowserHandle.endpoint;
  else delete env[sharedBrowser.ENDPOINT_ENV];
  for (const [key, allocation] of [['SCP_FDI_READONLY_DATA', 'ownedDelivery'], ['SCP_FDI_OWNED_DATA', 'ownedDelivery'],
    ['SCP_SHIPMENT_OWNED_DATA', 'ownedDelivery'], ['SCP_SHIPMENT_ROUTE_DATA', 'shipmentRoute']]) {
    if (!env[key] && manifest.allocations[allocation]) env[key] = manifest.allocations[allocation];
  }
  if (env.SCP_INVENTORY_DATA && fs.existsSync(path.resolve(root, env.SCP_INVENTORY_DATA))) {
    try {
      const allocation = JSON.parse(fs.readFileSync(path.resolve(root, env.SCP_INVENTORY_DATA), 'utf8'));
      if (allocation.project === config.projectName) env.SCP_EXECUTION_SITE = allocation.site;
    } catch { /* The Inventory fixture reports invalid input; other modules remain independent. */ }
  }
  return env;
}

function countRegistered(registry) {
  const count = suites => (suites || []).reduce((total, suite) => total + (suite.specs || []).reduce((n, spec) => n + spec.tests.length, 0) + count(suite.suites), 0);
  return count(registry.suites);
}

function cucumberScenarios(file, stage) {
  if (!fs.existsSync(file)) return [];
  const scenarios = [];
  for (const feature of JSON.parse(fs.readFileSync(file, 'utf8'))) {
    for (const element of feature.elements || []) {
      if (element.type === 'background') continue;
      const steps = (element.steps || []).filter(step => !step.hidden).map((step, index) => ({ id: `${element.id}-${index + 1}`, name: `${String(step.keyword || '').trim()} ${step.name}`,
        // A step that stops with the framework's BLOCKED: error is reported as Blocked, as in the Playwright suites.
        status: step.result?.status === 'failed' && /BLOCKED:/.test(step.result?.error_message || '') ? 'Blocked'
          : { passed: 'Passed', failed: 'Failed', skipped: 'Skipped' }[step.result?.status] || 'Skipped', durationMs: (step.result?.duration || 0) / 1e6,
        actual: step.result?.error_message || '', attemptCount: 1, attempts: [] }));
      const status = steps.some(step => step.status === 'Failed') ? 'Failed' : steps.some(step => step.status === 'Blocked') ? 'Blocked'
        : steps.every(step => step.status === 'Passed') ? 'Passed' : 'Skipped';
      // The scenario carries its first failing step and that step's message, as Playwright scenarios do.
      const failed = steps.find(step => step.status === 'Failed' || step.status === 'Blocked');
      const error = failed ? `${failed.name}: ${failed.actual.replace(/\u001b\[[0-9;]*m/g, '').split('\n').filter(Boolean).slice(0, 6).join('\n')}` : undefined;
      scenarios.push({ id: `SCP-PM-CUC-${scenarios.length + 1}`, title: element.name, file: feature.uri, module: 'Project Management', status, steps,
        actual: error || (status === 'Passed' ? 'All Gherkin steps passed' : status), errors: error ? [error] : [],
        objective: `Validate ${element.name}`, prerequisites: ['Cucumber Project Management profile'], expected: 'Every Gherkin step passes',
        durationMs: steps.reduce((total, step) => total + step.durationMs, 0), rerun: `npm run cucumber -- --profile ${stage.profile} --name "${element.name}"` });
    }
  }
  return scenarios;
}

function runPlaywright(stage, destination) {
  const command = ['test', `--config=${stage.config || 'playwright.stage.config.js'}`, ...stage.files, '--workers=1'];
  if (!execute) command.push('--list', '--reporter=json');
  const outcome = spawnSync(process.execPath, [cli, ...command], { cwd: root, env: stageEnv(destination, stage), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
    stdio: execute ? ['ignore', 'pipe', 'pipe'] : undefined });
  fs.writeFileSync(path.join(destination, 'stdout.log'), outcome.stdout || '');
  fs.writeFileSync(path.join(destination, 'stderr.log'), outcome.stderr || '');
  const result = { exitCode: outcome.status, error: outcome.error?.message, command: ['npx', 'playwright', ...command].join(' ') };
  if (!execute) {
    try { const registry = JSON.parse(outcome.stdout); result.registeredCases = countRegistered(registry); fs.writeFileSync(path.join(destination, 'registered.json'), JSON.stringify(registry, null, 2)); }
    catch { result.registrationError = (outcome.stderr || outcome.stdout || '').slice(0, 2000); }
    return result;
  }
  const report = path.join(destination, 'execution.json');
  result.scenarios = fs.existsSync(report) ? JSON.parse(fs.readFileSync(report, 'utf8')).scenarios : [];
  return result;
}

function runCucumber(stage, destination) {
  if (!execute) return { exitCode: 0, reason: `Cucumber profile ${stage.profile}; scenarios are listed when executed` };
  const mode = demo ? '--demo' : headless ? '--headless' : '--headed';
  const outcome = spawnSync(process.execPath, ['scripts/run-cucumber-and-report.js', '--profile', stage.profile, mode],
    { cwd: root, env: stageEnv(destination, stage), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  fs.writeFileSync(path.join(destination, 'stdout.log'), outcome.stdout || '');
  fs.writeFileSync(path.join(destination, 'stderr.log'), outcome.stderr || '');
  for (const item of ['cucumber-report.json', 'html', 'pdf']) {
    const source = path.join(root, 'reports', item);
    if (fs.existsSync(source)) fs.cpSync(source, path.join(destination, item), { recursive: true, force: true });
  }
  return { exitCode: outcome.status, error: outcome.error?.message, scenarios: cucumberScenarios(path.join(destination, 'cucumber-report.json'), stage) };
}

function stageStatus(result) {
  if (!execute) return result.exitCode === 0 && !result.registrationError ? 'Registered' : 'Failed';
  const statuses = (result.scenarios || []).map(scenario => scenario.status);
  for (const status of ['Failed', STATUS.failed, 'Blocked']) if (statuses.includes(status)) return status;
  // Playwright exits non-zero for failures that were reclassified as registered known defects.
  const knownOnly = statuses.includes(KNOWN_DEFECT) && statuses.every(status => ['Passed', 'Skipped', KNOWN_DEFECT, STATUS.notAccessible].includes(status));
  if ((result.exitCode === 0 || knownOnly) && statuses.length) {
    if (statuses.every(status => status === STATUS.notAccessible)) return STATUS.notAccessible;
    if (knownOnly) return KNOWN_DEFECT;
    return statuses.includes('Passed') ? 'Passed' : 'Skipped';
  }
  return result.exitCode === 0 ? 'Skipped' : 'Failed';
}

// Phase 0: access discovery, reported under User Management as SCP-UM-001.
manifest.access = { status: 'Running', startedAt: new Date().toISOString() };
save();
let accessStage = null;
if (reusedMatrix) {
  fs.copyFileSync(path.resolve(reusedMatrix), path.join(run, 'prior-access-matrix.json'));
  manifest.previousAccessMatrix = path.resolve(reusedMatrix);
}
{
  const destination = path.join(run, '00-access-discovery');
  fs.mkdirSync(destination, { recursive: true });
  console.log('Access discovery (SCP-UM-001)...');
  if (execute && !sharedBrowserReady('access-validation')) {
    accessStage = { name: 'access-validation', mode: 'read-only navigation and page probes', files: [ACCESS_SPEC], report: destination, ...interruptedResult() };
  } else {
    const result = runPlaywright({ name: 'access-validation', config: 'playwright.stage.config.js', files: [ACCESS_SPEC] }, destination);
    accessStage = { name: 'access-validation', mode: 'read-only navigation and page probes', files: [ACCESS_SPEC], report: destination, ...result, status: stageStatus(result) };
    if (execute) sharedBrowserReady('access-validation', 'during');
  }
  manifest.access = { status: accessStage.status, report: destination };
}
const matrix = fs.existsSync(matrixFile) ? JSON.parse(fs.readFileSync(matrixFile, 'utf8')) : null;
save();

for (const module of MODULES.filter(item => !selected.length || selected.includes(item.id) || (item.id === 'user-management' && accessStage))) {
  const access = moduleAccess(matrix, config.projectName, module.id);
  const entry = { id: module.id, name: module.name, order: module.order, coveredBy: module.coveredBy,
    access: { status: access.status, observed: access.observed, validated: access.validated, findings: access.findings || [], reason: access.reason || access.note }, stages: [] };
  manifest.modules.push(entry);
  if (module.id === 'user-management' && accessStage) entry.stages.push(accessStage);
  // Access discovery is always reported under User Management; its other stages run only when the module is selected.
  if (selected.length && !selected.includes(module.id)) continue;
  for (const stage of module.stages) {
    const item = { name: stage.name, kind: stage.kind || 'playwright', config: stage.config, files: stage.files,
      mode: stage.mode || (stage.qualified === false ? 'unqualified: creates or changes records' : 'guarded read-only') };
    entry.stages.push(item);
    const requirement = (stage.requiresAccess || []).map(id => ({ id, access: moduleAccess(matrix, config.projectName, id) }))
      .find(({ access: required }) => required.observed !== STATUS.accessible);
    if (stage.enabledBy && process.env[stage.enabledBy] !== 'true' && !ownedMutations) Object.assign(item, { status: 'Skipped', reason: `Enable ${stage.enabledBy} with a qualified owned allocation` });
    else if (stage.qualified === false && !unqualified) Object.assign(item, { status: 'Skipped', reason: `Not qualified: ${stage.reason}. Use --include-unqualified once inputs exist` });
    else if (stage.mutation && !mutations) Object.assign(item, { status: 'Skipped', reason: 'Creates owned records; run with --with-inventory-mutations' });
    else if (stage.exceptWithMutations && mutations) Object.assign(item, { status: 'Skipped', reason: 'Covered by the inventory-mutations stage' });
    else if (execute && stage.requiresModuleAccess !== false && access.status === 'Unknown') Object.assign(item, { status: 'Blocked', reason: access.reason });
    else if (execute && stage.requiresModuleAccess !== false && access.observed === STATUS.notAccessible) {
      Object.assign(item, access.status === STATUS.failed ? { status: STATUS.failed, reason: `Not executed: ${access.note}; ${access.findings.join('; ') || 'no further findings'}` }
        : { status: STATUS.notAccessible, reason: `${module.name} is not accessible to the account on ${config.projectName}` });
    } else if (execute && requirement) {
      Object.assign(item, { status: 'Blocked', reason: `Requires access to ${moduleById(requirement.id).name} (${requirement.access.observed || requirement.access.status})` });
    } else if (execute && !sharedBrowserReady(`${module.name} / ${stage.name}`)) {
      Object.assign(item, interruptedResult());
    } else {
      const destination = path.join(run, `${String(module.order).padStart(2, '0')}-${module.id}`, stage.name);
      fs.mkdirSync(destination, { recursive: true });
      console.log(`${module.order}. ${module.name} / ${stage.name}...`);
      item.startedAt = new Date().toISOString();
      item.status = 'Running';
      item.report = destination;
      save();
      Object.assign(item, item.kind === 'cucumber' ? runCucumber({ ...stage, moduleId: module.id }, destination) : runPlaywright({ ...stage, moduleId: module.id }, destination), { report: destination });
      if (item.scenarios) item.scenarios = classifyScenarios(item.scenarios.map(scenario => ({ ...scenario, module: module.name })));
      if (execute && stage.name === 'inventory-mutations' && process.env.SCP_INVENTORY_DATA) {
        try {
          const allocation = JSON.parse(fs.readFileSync(path.resolve(root, process.env.SCP_INVENTORY_DATA), 'utf8'));
          const owned = require('../utils/owned-allocation').qualifyOwnedDelivery(item.scenarios, config.projectName, allocation.site, path.join(destination, 'results.json'));
          if (owned) {
            const file = path.join(run, 'owned-delivery-allocation.json'); fs.writeFileSync(file, JSON.stringify(owned, null, 2));
            manifest.allocations.ownedDelivery = file;
          }
        } catch (error) { item.qualificationError = `Owned data handoff unavailable: ${error.message}`; }
      }
      if (execute && stage.name === 'international-shipments-source') {
        const file = item.scenarios?.filter(scenario => scenario.status === 'Passed' && scenario.context?.project === config.projectName)
          .flatMap(scenario => scenario.attachments || []).find(attachment => attachment.name === 'qualified-shipment-route')?.path;
        if (file && fs.existsSync(file)) manifest.allocations.shipmentRoute = file;
      }
      item.finishedAt = new Date().toISOString();
      item.status = stageStatus(item);
      if (execute) sharedBrowserReady(`${module.name} / ${stage.name}`, 'during');
    }
    console.log(`${module.order}. ${module.name} / ${stage.name}: ${item.status}${item.registeredCases !== undefined ? ` (${item.registeredCases} registered)` : ''}${item.reason ? ` — ${item.reason}` : ''}`);
    save();
  }
}

// Consolidated scenario list, in hierarchy order, in the detailed-reporter schema used by the rerun manager.
manifest.finishedAt = new Date().toISOString();
const scenarios = [];
for (const module of manifest.modules) {
  for (const stage of module.stages) {
    for (const scenario of stage.scenarios || []) scenarios.push({ ...scenario, module: module.name, moduleOrder: module.order, stage: stage.name });
    delete stage.scenarios;
  }
}
const counts = scenarios.reduce((total, item) => ({ ...total, [item.status]: (total[item.status] || 0) + 1 }), {});
manifest.counts = counts;
manifest.knownDefects = {
  reproduced: scenarios.filter(item => item.knownDefect).map(item => ({ defect: item.knownDefect.id, summary: item.knownDefect.summary, scenario: item.id, title: item.title })),
  notReproduced: scenarios.filter(item => item.knownDefectNotReproduced).map(item => ({ defects: item.knownDefectNotReproduced, scenario: item.id, title: item.title }))
};
fs.writeFileSync(path.join(run, 'execution.json'), JSON.stringify({ generatedAt: manifest.finishedAt, policy: manifest.policy, counts, scenarios }, null, 2));
for (const status of ['Failed', 'Blocked', STATUS.failed]) {
  fs.writeFileSync(path.join(run, `${status.toLowerCase().replace(/ /g, '-')}-scenarios.json`), JSON.stringify({ status, scenarios: scenarios.filter(item => item.status === status) }, null, 2));
}
save();

// Reports are generated while the shared browser is still open; it is closed only afterwards.
renderReport(run).then(({ html, pdf }) => {
  console.log(`Report: ${html}${pdf ? `\nPDF: ${pdf}` : ''}\nEvidence: ${run}`);
  const stages = manifest.modules.flatMap(module => module.stages);
  if (stages.some(stage => ['Failed', 'Blocked', STATUS.failed].includes(stage.status))) process.exitCode = 1;
}).catch(error => { console.error(`Report generation failed: ${error.stack || error.message}`); process.exitCode = 1; })
  .finally(() => {
    closeBrowserOnce();
    if (sharedBrowserHandle) console.log(`Shared browser closed${manifest.browser.forced ? ' (forced)' : ''}`);
    if (browserInterrupted) process.exitCode = 1;
  });
