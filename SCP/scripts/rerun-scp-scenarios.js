const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { randomUUID } = require('crypto');
const root = path.resolve(__dirname, '..');
require('../utils/env').loadEnvFile();
const cli = require.resolve('@playwright/test/cli');
function selectedScenarios(report, { id, status = 'failed' } = {}) {
  const scenarios = report.scenarios || [];
  return scenarios.filter(scenario => (!id || scenario.id === id) &&
    (id || status === 'all' ? ['Failed', 'Blocked', 'Access Validation Failed'].includes(scenario.status) :
      status === 'access' ? scenario.status === 'Access Validation Failed' : scenario.status.toLowerCase() === status));
}
function resolveCurrentCase(registry, scenario) {
  const matches = [];
  function visit(suites) {
    for (const suite of suites || []) {
      for (const spec of suite.specs || []) if (spec.title === scenario.title &&
        spec.tests.some(test => test.projectName === scenario.project)) matches.push(spec);
      visit(suite.suites);
    }
  }
  visit(registry.suites);
  if (matches.length !== 1) throw new Error(`Scenario ${scenario.id} must match exactly one current title/project; source changes must not rerun a different case`);
  return matches[0];
}
function contained(file, directory) {
  const relative = path.relative(directory, file);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}
function main(args) {
  const [input, ...flags] = args;
  if (!input || flags.some(flag => !/^--(?:id=.+|status=(?:failed|blocked|access|all)|execute)$/.test(flag))) throw new Error('Usage: node scripts/rerun-scp-scenarios.js execution.json [--id=SCP-ID] [--status=failed|blocked|access|all] [--execute]');
  const report = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'));
  const id = flags.find(flag => flag.startsWith('--id='))?.slice(5);
  const status = flags.find(flag => flag.startsWith('--status='))?.slice(9) || 'failed';
  const selected = selectedScenarios(report, { id, status });
  if (id && !selected.length) throw new Error('The requested ID is not a failed/blocked scenario in this report');
  const output = path.join(root, 'reports', `targeted-recovery-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`);
  fs.mkdirSync(output, { recursive: true });
  const plan = { sourceReport: path.resolve(input), mode: flags.includes('--execute') ? 'execute' : 'plan', scenarios: [] };
  let failed = false;
  for (const scenario of selected) {
    const config = path.resolve(scenario.configFile || path.join(root, 'playwright.config.js'));
    const file = path.resolve(root, 'tests', scenario.file);
    if (!contained(config, root) || !contained(file, path.join(root, 'tests'))) throw new Error('Reruns must use SCP workspace configuration and test files');
    const destination = path.join(output, scenario.id);
    const fileArgument = path.relative(root, file).replace(/\\/g, '/');
    const allowedInputs = new Set(['SCP_INVENTORY_DATA', 'SCP_PROCUREMENT_DATA', 'SCP_FDI_READONLY_DATA', 'SCP_INVENTORY_MUTATIONS',
      'SCP_ACCESS_EXPECTATIONS', 'SCP_ACCESS_PROJECTS', 'SCP_REGRESSION_MODULE', 'SCP_DEFAULT_ROLE', 'SCP_PROJECT_NAME', 'SCP_BASE_URL', 'SCP_FDI_OWNED_DATA', 'SCP_FDI_OWNED_MUTATIONS', 'SCP_SHIPMENT_OWNED_DATA', 'SCP_SHIPMENT_ROUTE_DATA', 'SCP_SHIPMENT_OWNED_MUTATIONS']);
    const savedInputs = Object.fromEntries(Object.entries(scenario.executionInputs || {}).filter(([key]) => allowedInputs.has(key)));
    const env = { ...process.env, ...savedInputs, SCP_PENDING_RUN_DIR: destination, SCP_INVENTORY_RUN_DIR: destination,
      SCP_EXECUTION_DIR: destination, SCP_DETAILED_RUN_DIR: destination,
      ...(scenario.checkpoint ? { SCP_RECOVERY_DIR: path.dirname(scenario.checkpoint) } : {}) };
    if (scenario.context?.baseUrl) env.SCP_BASE_URL = scenario.context.baseUrl;
    if (scenario.context?.project) env.SCP_PROJECT_NAME = scenario.context.project;
    if (scenario.checkpoint && !contained(path.resolve(scenario.checkpoint), root)) throw new Error('Recovery checkpoint must remain in the SCP workspace');
    if (flags.includes('--execute') && scenario.context?.account) {
      const username = require('../config/scp.config').credentialsFor(env).username;
      const fingerprint = require('crypto').createHash('sha256').update(username).digest('hex').slice(0, 12);
      if (fingerprint !== scenario.context.account) throw new Error('Select the original account before resuming its owned-record checkpoint');
    }
    const listed = spawnSync(process.execPath, [cli, 'test', `--config=${config}`, fileArgument, '--list', '--reporter=json'], { cwd: root, env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    if (listed.status !== 0) {
      let reason = listed.stderr;
      try { reason ||= JSON.parse(listed.stdout).errors.map(error => error.message).join('\n'); } catch {}
      throw new Error(`Registration failed for ${scenario.id}: ${reason || 'inspect current test configuration'}`);
    }
    const current = resolveCurrentCase(JSON.parse(listed.stdout), scenario);
    const titlePattern = `${scenario.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`;
    const command = ['test', `--config=${config}`, `${fileArgument}:${current.line}`, `--project=${scenario.project}`, '--grep', titlePattern, '--workers=1', '--retries=0'];
    const verified = spawnSync(process.execPath, [cli, ...command, '--list', '--reporter=json'], { cwd: root, env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    if (verified.status !== 0) throw new Error(`Exact-case registration failed for ${scenario.id}`);
    const exactRegistry = JSON.parse(verified.stdout);
    let selectedCount = 0;
    const count = suites => { for (const suite of suites || []) { for (const spec of suite.specs || []) selectedCount += spec.tests.length; count(suite.suites); } };
    count(exactRegistry.suites);
    if (selectedCount !== 1) throw new Error(`Refusing to rerun ${selectedCount} cases for a single scenario ID`);
    const entry = { id: scenario.id, title: scenario.title, previousStatus: scenario.status,
      checkpoint: scenario.checkpoint, sourceLine: current.line, command: [process.execPath, cli, ...command], evidence: destination };
    plan.scenarios.push(entry);
    console.log(`${entry.id}: ${entry.title} (${plan.mode}; ${scenario.checkpoint ? 'recovery checkpoint retained' : 'no checkpoint available'})`);
    if (flags.includes('--execute')) {
      const result = spawnSync(process.execPath, [cli, ...command], { cwd: root, env, stdio: 'inherit' });
      entry.exitCode = result.status; failed ||= result.status !== 0;
    }
    fs.writeFileSync(path.join(output, 'rerun-summary.json'), JSON.stringify(plan, null, 2));
  }
  fs.writeFileSync(path.join(output, 'rerun-summary.json'), JSON.stringify(plan, null, 2));
  console.log(`Targeted rerun summary: ${output}`);
  if (failed) process.exitCode = 1;
  return plan;
}
if (require.main === module) { try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { selectedScenarios, resolveCurrentCase, main };
