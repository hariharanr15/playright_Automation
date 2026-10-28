// Reviewed module allowlists. Never dispatch the legacy unfiltered application runner.
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
require('../utils/env').loadEnvFile();
const args = process.argv.slice(2);
if (args.some(arg => !['--execute', '--with-inventory-mutations', '--demo', '--headless'].includes(arg) && !/^--stage=[a-z-]+$/.test(arg))) throw new Error('Supported flags: --execute --with-inventory-mutations --demo --headless --stage=NAME (repeatable)');
const execute = args.includes('--execute');
const mutations = args.includes('--with-inventory-mutations');
const demo = args.includes('--demo');
const headless = args.includes('--headless') || (!demo && /^true$/i.test(process.env.PLAYWRIGHT_HEADLESS || process.env.HEADLESS || ''));
const selectedStages = args.filter(arg => arg.startsWith('--stage=')).map(arg => arg.slice('--stage='.length));
if (demo && mutations) throw new Error('The demo rehearsal is read-only; do not combine --demo with --with-inventory-mutations');
const cli = require.resolve('@playwright/test/cli');
const run = path.join(root, 'reports', `application-reviewed-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`);
const reviewedStages = [
  { name: 'inventory', config: mutations ? 'playwright.inventory.config.js' : 'playwright.chrome-smoke.config.js',
    files: mutations ? ['tests/regression/inventory-management/scp-inventory-management.spec.js',
      'tests/regression/inventory-management/scp-inventory-bulk-upload.spec.js', 'tests/smoke/inventory-management'] : ['tests/smoke/inventory-management'], mode: mutations ? 'owned-record mutations' : 'pre-auth guarded read-only' },
  { name: 'inventory-calendar', config: 'playwright.inventory.config.js', files: [
    'tests/regression/inventory-management/scp-inventory-activity-calendar.spec.js',
    'tests/regression/inventory-management/scp-inventory-calendar-dates.spec.js',
    'tests/regression/inventory-management/scp-inventory-prerequisites-contract.spec.js'], mode: 'guarded read-only plus calendar arithmetic and prerequisite failure contracts' },
  { name: 'procurement', config: 'playwright.application-readonly.config.js', files: ['tests/smoke/procurement-log'], mode: 'qualified-record read-only' },
  { name: 'enterprise', files: ['tests/smoke/enterprise', 'tests/regression/enterprise'] },
  { name: 'dashboard', files: ['tests/regression/management-dashboard'] },
  { name: 'documents', files: ['tests/regression/pending/scp-document-management.spec.js'] },
  { name: 'analytics', files: ['tests/regression/pending/scp-analytics.spec.js', 'tests/regression/pending/scp-lead-time-analysis.spec.js',
    'tests/regression/pending/scp-subcontractor-issues.spec.js', 'tests/regression/pending/scp-issue-records-contract.spec.js',
    'tests/regression/pending/scp-issue-table-rows-contract.spec.js',
    'tests/regression/pending/scp-historical-date-search-contract.spec.js'] },
  { name: 'independent-source-contracts', files: ['tests/regression/pending/scp-independent-business-contracts.spec.js'] },
  { name: 'project-management', files: ['tests/regression/pending/scp-project-management-readonly.spec.js'] },
  { name: 'other-reviewed-smoke', config: 'playwright.chrome-smoke.config.js', files: ['tests/smoke/international-shipments',
    'tests/smoke/user-management', 'tests/smoke/management-dashboard', 'tests/smoke/scp-tabs-smoke.spec.js'], mode: 'pre-auth guarded read-only' }
];
const demoFiles = {
  'inventory': ['tests/smoke/inventory-management'],
  'inventory-calendar': ['tests/regression/inventory-management/scp-inventory-activity-calendar.spec.js'],
  'procurement': ['tests/smoke/procurement-log'],
  'enterprise': ['tests/regression/enterprise/scp-enterprise-historical.spec.js'],
  'dashboard': ['tests/regression/management-dashboard/scp-management-dashboard-historical.spec.js'],
  'analytics': ['tests/regression/pending/scp-subcontractor-issues.spec.js']
};
const availableStages = demo ? reviewedStages.filter(stage => demoFiles[stage.name]).map(stage => ({ ...stage, files: demoFiles[stage.name] })) : reviewedStages;
for (const name of selectedStages) {
  if (!availableStages.some(stage => stage.name === name)) throw new Error(`Unknown stage ${name}. Available stages: ${availableStages.map(stage => stage.name).join(', ')}`);
}
const stages = availableStages.filter(stage => !selectedStages.length || selectedStages.includes(stage.name));
if (mutations && !stages.some(stage => stage.name === 'inventory')) throw new Error('--with-inventory-mutations requires the inventory stage');
fs.mkdirSync(run, { recursive: true });
const manifest = { profile: demo ? 'read-only functional rehearsal including known failures' : 'reviewed application', mode: execute ? 'execute' : 'registration-only', mutationScope: mutations ? 'dedicated Inventory records only' : 'none',
  headless, selectedStages: stages.map(stage => stage.name),
  exclusions: ['Construction Delivery', 'Enterprise Shipment', 'Setup Wizard', 'Integrations', 'System Messages workflows'],
  qualificationGaps: path.join(root, 'reports/approved-regression-20261025/QUALIFICATION-GAPS.md'), stages: [] };
function save() {
  fs.writeFileSync(path.join(run, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  fs.writeFileSync(path.join(run, 'index.html'), `<!doctype html><meta charset="utf-8"><title>SCP reviewed application run</title><h1>SCP reviewed application run</h1><p>Mode: ${escape(manifest.mode)}. Registration is not execution. Passes cover executed assertions, not complete modules. Known defects and prerequisite gaps remain explicit.</p><table border="1" cellpadding="8"><tr><th>Stage</th><th>Mode</th><th>Status</th><th>Cases / results</th><th>Evidence</th></tr>${manifest.stages.map(stage => `<tr><td>${escape(stage.name)}</td><td>${escape(stage.mode)}</td><td>${escape(stage.status)}</td><td>${escape(stage.registeredCases ?? JSON.stringify(stage.counts || {}))}</td><td><a href="${stage.name}/${execute ? 'html/index.html' : 'registered.json'}">${execute ? 'Native HTML' : 'Registration'}</a></td></tr>`).join('')}</table><p>See manifest.json for excluded scope and qualification gaps. Shared SSO failures are retained by the pre-auth smoke guard.</p>`);
}
let failed = false;
for (const stage of stages) {
  const destination = path.join(run, stage.name);
  const env = { ...process.env, SCP_READONLY_EXECUTION: 'false', HEADLESS: String(headless), PLAYWRIGHT_HEADLESS: String(headless),
    SCP_PENDING_RUN_DIR: destination, SCP_INVENTORY_RUN_DIR: destination, SCP_EXECUTION_DIR: destination,
    SCP_INVENTORY_MUTATIONS: stage.name === 'inventory' && mutations ? 'true' : 'false' };
  if (env.SCP_INVENTORY_DATA && fs.existsSync(path.resolve(root, env.SCP_INVENTORY_DATA))) {
    env.SCP_EXECUTION_SITE = JSON.parse(fs.readFileSync(path.resolve(root, env.SCP_INVENTORY_DATA), 'utf8')).site;
  }
  const entry = { ...stage, config: stage.config || 'playwright.pending.config.js', mode: stage.mode || 'guarded read-only', report: destination };
  manifest.stages.push(entry);
  entry.status = 'Running';
  entry.startedAt = new Date().toISOString();
  save();
  const command = ['test', `--config=${entry.config}`, ...stage.files, '--workers=1'];
  if (!execute) command.push('--list', '--reporter=json');
  fs.mkdirSync(destination, { recursive: true });
  const outcome = spawnSync(process.execPath, [cli, ...command], { cwd: root, env, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
  fs.writeFileSync(path.join(destination, 'stdout.log'), outcome.stdout || '');
  fs.writeFileSync(path.join(destination, 'stderr.log'), outcome.stderr || '');
  entry.exitCode = outcome.status;
  entry.finishedAt = new Date().toISOString();
  entry.error = outcome.error?.message;
  entry.status = outcome.status === 0 ? (execute ? 'Passed' : 'Registered') : 'Failed';
  if (!execute && outcome.status === 0) {
    const registry = JSON.parse(outcome.stdout);
    const count = suites => (suites || []).reduce((total, suite) => total + (suite.specs || []).reduce((n, spec) => n + spec.tests.length, 0) + count(suite.suites), 0);
    entry.registeredCases = count(registry.suites);
    fs.writeFileSync(path.join(destination, 'registered.json'), JSON.stringify(registry, null, 2));
  }
  if (execute && fs.existsSync(path.join(destination, 'coverage.json'))) {
    const coverage = JSON.parse(fs.readFileSync(path.join(destination, 'coverage.json'), 'utf8'));
    entry.counts = (coverage.scenarios || coverage.cases || []).reduce((counts, item) => {
      counts[item.status] = (counts[item.status] || 0) + 1; return counts;
    }, {});
    if (entry.counts.Blocked && !entry.counts.Failed) entry.status = 'Blocked';
  }
  failed ||= outcome.status !== 0;
  save();
  console.log(`${stage.name}: ${entry.status}${entry.registeredCases !== undefined ? ` (${entry.registeredCases} registered)` : ''}`);
}
console.log(`Manifest and isolated reports: ${run}`);
if (failed) process.exitCode = 1;
