const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const runner = path.join(root, 'scripts/run-scp-reviewed-application.js');
function run(args) {
  return spawnSync(process.execPath, [runner, ...args], {
    cwd: root, encoding: 'utf8', timeout: 60000,
    env: { ...process.env, HEADLESS: 'false', PLAYWRIGHT_HEADLESS: 'false' }
  });
}

test('focused registration selects only Procurement and records headless mode', () => {
  const result = run(['--stage=procurement', '--headless']);
  assert.equal(result.status, 0, result.stderr);
  const folder = result.stdout.match(/Manifest and isolated reports: (.+)/)[1].trim();
  const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json'), 'utf8'));
  assert.equal(manifest.mode, 'registration-only');
  assert.equal(manifest.headless, true);
  assert.deepEqual(manifest.selectedStages, ['procurement']);
  assert.equal(manifest.stages.length, 1);
  assert.equal(manifest.stages[0].registeredCases, 3);
  assert.ok(fs.existsSync(path.join(folder, 'procurement/registered.json')));
});

test('unknown or unavailable demo stages fail before dispatch', () => {
  for (const args of [['--stage=typo'], ['--demo', '--stage=documents']]) {
    const result = run(args);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unknown stage/);
    assert.doesNotMatch(result.stdout, /Registered|Passed/);
  }
});

test('mutation mode cannot be silently requested without Inventory', () => {
  const result = run(['--with-inventory-mutations', '--stage=procurement']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /requires the inventory stage/);
  assert.doesNotMatch(result.stdout, /Registered|Passed/);
});

test('Chrome smoke inherits headless mode and keeps its read-only guard', () => {
  const result = spawnSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const config = require('./playwright.chrome-smoke.config');
    assert.equal(config.use.headless, true);
    assert.notEqual(config.projects[0].use.headless, false);
    assert.equal(process.env.SCP_READONLY_EXECUTION, 'true');
  `], {
    cwd: root, encoding: 'utf8', env: { ...process.env,
      PLAYWRIGHT_HEADLESS: 'true', SCP_EXECUTION_DIR: 'reports/runner-config-check' }
  });
  assert.equal(result.status, 0, result.stderr);
});
