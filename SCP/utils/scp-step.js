const path = require('path');
const { createHash } = require('crypto');
const { test: nativeTest } = require('@playwright/test');
const { ExecutionJournal, stableId, scenarioId, activeStep } = require('./execution-journal');
const { isHeadless } = require('./execution-mode');
const engines = new Map();
const nativeSteps = new WeakMap();
function currentJournal() {
  try { return engines.get(nativeTest.info().testId); } catch { return undefined; }
}
function moduleName(file) {
  const normalized = file.replace(/\\/g, '/');
  if (normalized.includes('/supplier-list/')) return 'Supplier List';
  if (normalized.includes('/first-delivery-inspections/')) return 'First Delivery Inspection';
  if (normalized.includes('/international-shipments/')) return 'International Shipment';
  const folder = normalized.split('/').find((part, index, parts) => ['smoke', 'regression'].includes(parts[index - 1]));
  if (folder === 'pending') {
    if (/document/.test(normalized)) return 'Document Management';
    if (/project-management/.test(normalized)) return 'Project Management';
    return 'Analytics / Independent Reconciliation';
  }
  return folder ? folder.replace(/-/g, ' ').replace(/\b\w/g, value => value.toUpperCase()) : 'SCP Application';
}
function createJournal(info) {
  const { getScpConfig } = require('../config/scp.config');
  const config = getScpConfig();
  const file = path.relative(path.resolve(__dirname, '../tests'), info.file).replace(/\\/g, '/');
  const scenario = { id: scenarioId(file, info.title), file, line: info.line, title: info.title,
    module: moduleName(file), objective: `Validate ${info.title}`,
    prerequisites: ['Configured SCP account and selected project', 'Module-specific data and dependencies declared in the executed steps'],
    expected: 'The named business checks, saved data and record relationships satisfy every declared assertion.' };
  const inputNames = ['SCP_INVENTORY_DATA', 'SCP_PROCUREMENT_DATA', 'SCP_FDI_READONLY_DATA', 'SCP_INVENTORY_MUTATIONS',
    'SCP_ACCESS_EXPECTATIONS', 'SCP_ACCESS_PROJECTS', 'SCP_REGRESSION_MODULE', 'SCP_DEFAULT_ROLE', 'SCP_PROJECT_NAME', 'SCP_FDI_OWNED_DATA', 'SCP_FDI_OWNED_MUTATIONS', 'SCP_SHIPMENT_OWNED_DATA', 'SCP_SHIPMENT_ROUTE_DATA', 'SCP_SHIPMENT_OWNED_MUTATIONS'];
  scenario.executionInputs = Object.fromEntries(inputNames.filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
  Object.assign(scenario.executionInputs, { SCP_BASE_URL: config.baseUrl, SCP_PROJECT_NAME: config.projectName, SCP_DEFAULT_ROLE: config.defaultRole });
  const context = { baseUrl: config.baseUrl, project: config.projectName,
    account: createHash('sha256').update(config.accounts[config.defaultRole]?.username || config.username).digest('hex').slice(0, 12) };
  const directory = process.env.SCP_RECOVERY_DIR || path.resolve(__dirname, '../.state/scp-recovery');
  const journal = new ExecutionJournal({ directory, scenario, context, evidence: async ({ step, attempt, error }) => {
    const evidence = { error: error.stack || error.message };
    if (journal.page && !journal.page.isClosed()) {
      const screenshot = info.outputPath('step-failures', `${step.id.replace(/[^a-z0-9_-]/gi, '_')}-${attempt}.png`);
      await journal.page.screenshot({ path: screenshot, fullPage: isHeadless(), timeout: 5000 });
      await info.attach(`${step.name}: attempt ${attempt}`, { path: screenshot, contentType: 'image/png' });
      evidence.screenshot = screenshot;
    } else evidence.screenshotUnavailable = 'No active application page was available for this step';
    return evidence;
  } });
  journal.ordinal = new Map();
  engines.set(info.testId, journal);
  return journal;
}
async function managedStep(test, page, name, body, options = {}) {
  const native = nativeSteps.get(test) || nativeTest.step.bind(nativeTest);
  const journal = currentJournal();
  if (!journal || activeStep.getStore()) return native(name, body, options.native || {});
  if (page) journal.page = page;
  const ordinal = (journal.ordinal.get(name) || 0) + 1; journal.ordinal.set(name, ordinal);
  const id = options.id || stableId(journal.scenario.file, `${name}:${ordinal}`);
  const definition = { id, name, expected: options.expected || `Complete ${name} and satisfy its declared validation`,
    dependsOn: options.dependsOn || [], mutation: options.mutation || false, group: options.group || false,
    verify: options.verify, success: options.success };
  return native(name, () => journal.execute(definition, ({ attempt } = {}) =>
    native(`Attempt ${attempt || 1} of 2 — ${name}`, body, options.native || {})), options.native || {});
}
function installStepPolicy(test) {
  if (nativeSteps.has(test)) return test;
  nativeSteps.set(test, test.step.bind(test));
  test.step = (name, body, options = {}) => managedStep(test, null, name, body, {
    ...(options.scp || {}), native: Object.fromEntries(Object.entries(options).filter(([key]) => key !== 'scp'))
  });
  const extend = test.extend.bind(test);
  test.extend = fixtures => installStepPolicy(extend(fixtures));
  return test;
}
function forgetJournal(info) { engines.delete(info.testId); }
module.exports = { createJournal, currentJournal, managedStep, installStepPolicy, forgetJournal, moduleName };
