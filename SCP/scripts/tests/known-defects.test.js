const { test } = require('node:test');
const assert = require('node:assert/strict');
const { KNOWN_DEFECT, classifyScenario } = require('../../utils/known-defects');
const bulk = (status, actual) => ({ module: 'Project Management', status, actual,
  title: 'Project Management: Bulk Upload Status exact uploader, file names and success/failure outcomes', steps: [] });
test('a registered scenario failing with its own signature becomes a Known Defect', () => {
  const result = classifyScenario(bulk('Failed', 'Error: Application defect: 6 upload record(s) have no status'));
  assert.equal(result.status, KNOWN_DEFECT);
  assert.equal(result.originalStatus, 'Failed');
  assert.equal(result.knownDefect.id, 'SCP-DEF-001');
});
test('a different failure in a registered scenario stays Failed', () => {
  assert.equal(classifyScenario(bulk('Failed', 'TimeoutError: locator.click: Timeout 15000ms exceeded.')).status, 'Failed');
});
test('the signature is also found in a failed step or attempt', () => {
  const scenario = { ...bulk('Failed', ''), steps: [{ status: 'Failed', actual: '', attempts: [{ error: 'Application defect: 2 upload record(s) have no status' }] }] };
  assert.equal(classifyScenario(scenario).status, KNOWN_DEFECT);
});
test('a passing registered scenario is flagged as not reproduced', () => {
  const result = classifyScenario(bulk('Passed', ''));
  assert.equal(result.status, 'Passed');
  assert.deepEqual(result.knownDefectNotReproduced, ['SCP-DEF-001']);
});
test('module filters and allowed statuses are honoured', () => {
  const dash = { title: 'Lead Time Benchmarks: all category values', status: 'Failed', actual: 'Expected a number, received "—"', steps: [] };
  assert.equal(classifyScenario({ ...dash, module: 'Enterprise' }).status, KNOWN_DEFECT);
  assert.equal(classifyScenario({ ...dash, module: 'Inventory Management' }).status, 'Failed');
  const refresh = { module: 'Enterprise', title: 'Enterprise context: safe refresh preserves exact site before persisted metric validation',
    actual: 'ScpBlocked: BLOCKED: Refresh resets the selected site from A to B', steps: [] };
  assert.equal(classifyScenario({ ...refresh, status: 'Blocked' }).status, KNOWN_DEFECT);
  assert.equal(classifyScenario({ ...bulk('Blocked', 'Application defect: 6 upload record(s) have no status') }).status, 'Blocked');
});
