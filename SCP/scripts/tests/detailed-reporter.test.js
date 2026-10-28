const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Reporter = require('../detailed-execution-reporter');

function capture(type, nativeStatus) {
  const reporter = new Reporter();
  reporter.onTestEnd({ id: 'case', title: 'SCP-UM-001 Access', location: { file: path.resolve('tests/access.spec.js'), line: 1 },
    annotations: [{ type, description: 'Configured access differs' }], parent: { project: () => ({ name: 'Google Chrome' }) } },
  { attachments: [], annotations: [], errors: [], status: nativeStatus, startTime: new Date(), duration: 1 });
  return reporter.scenarios[0];
}
test('explicit access mismatch cannot be hidden by a native passed status', () => {
  const result = capture('access-validation-failed', 'passed');
  assert.equal(result.status, 'Access Validation Failed');
  assert.equal(result.actual, 'Configured access differs');
});
test('inaccessible scenario reports its reason rather than successful assertions', () => {
  const result = capture('not-accessible', 'skipped');
  assert.equal(result.status, 'Not Accessible');
  assert.doesNotMatch(result.actual, /assertions passed/);
});
