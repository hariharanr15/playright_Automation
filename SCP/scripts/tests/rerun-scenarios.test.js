const assert = require('node:assert/strict');
const { test } = require('node:test');
const { selectedScenarios, resolveCurrentCase } = require('../rerun-scp-scenarios');
test('rerun selection excludes passed/skipped scenarios and supports failed/blocked IDs', () => {
  const scenarios = ['Passed', 'Failed', 'Blocked', 'Skipped'].map((status, i) => ({ id: String(i), status }));
  assert.deepEqual(selectedScenarios({ scenarios }).map(item => item.status), ['Failed']);
  assert.deepEqual(selectedScenarios({ scenarios }, { status: 'all' }).map(item => item.status), ['Failed', 'Blocked']);
  assert.deepEqual(selectedScenarios({ scenarios }, { id: '2' }).map(item => item.status), ['Blocked']);
  assert.equal(selectedScenarios({ scenarios }, { id: '0' }).length, 0);
});
test('changed source line is resolved by exact scenario title and browser', () => {
  const registry = { suites: [{ specs: [
    { title: 'Inventory internal transfer', line: 50, tests: [{ projectName: 'Google Chrome' }] },
    { title: 'Inventory return', line: 50, tests: [{ projectName: 'Google Chrome' }] }
  ] }] };
  assert.equal(resolveCurrentCase(registry, { id: 'owned', title: 'Inventory internal transfer', project: 'Google Chrome' }).line, 50);
  assert.throws(() => resolveCurrentCase(registry, { id: 'old', title: 'Deleted scenario', project: 'Google Chrome' }), /exactly one/);
});
