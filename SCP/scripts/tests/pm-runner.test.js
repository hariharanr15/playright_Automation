const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PmRun, knownDefect } = require('../../tests/pm-flow/support/pm-runner');

const DOWNLOAD_TIMEOUT = 'page.waitForEvent: Timeout 20000ms exceeded while waiting for event "download"';

test('a generic signature does not relabel a failure of another module', () => {
  // SCP-DEF-014 / SCP-DEF-035 belong to Analytics; an Inventory export timing out is a real failure.
  assert.equal(knownDefect(DOWNLOAD_TIMEOUT, { id: 'INV-SMK-07', module: 'Inventory Management' }), undefined);
  assert.equal(knownDefect(DOWNLOAD_TIMEOUT, { id: 'PM-REG-MM-14', module: 'Project Management' }), undefined);
});

test('the same signature still matches inside its own module', () => {
  assert.match(knownDefect(DOWNLOAD_TIMEOUT, { id: 'ANA-REG-02', module: 'Analytics' }).id, /^SCP-DEF-0(14|35)$/);
});

test('scenarioIds lets a defect apply to a listed scenario of another module', () => {
  const message = 'Dashboard spend differs from the Procurement Log Value Delivered: $12,500 vs ₹1,500';
  assert.equal(knownDefect(message, { id: 'TC-24', module: 'Analytics' }).id, 'SCP-DEF-049');
  assert.equal(knownDefect(message, { id: 'ANA-REG-01', module: 'Analytics' }), undefined);
  assert.equal(knownDefect(message, { id: 'TC-23', module: 'Management Dashboard' }).id, 'SCP-DEF-049');
});

const fakePage = () => ({ evaluate: async () => null, isClosed: () => false, screenshot: async () => null, keyboard: { press: async () => null },
  getByRole: () => ({ filter: () => ({ count: async () => 0 }) }), waitForTimeout: async () => null });

const newRun = () => {
  process.env.PM_FLOW_STEP_INTERVAL_MS = '0';
  return new PmRun({ suite: 'unit', page: fakePage(), outDir: fs.mkdtempSync(path.join(os.tmpdir(), 'pm-runner-')) });
};

test('a step that passes on its second attempt is flagged as retried, with the first error kept', async () => {
  const run = newRun();
  let calls = 0;
  const record = await run.scenario({ id: 'U-01', module: 'Unit', submodule: 'Unit', title: 'retry' }, async s => {
    await s.step('flaky', async () => { calls += 1; if (calls === 1) throw new Error('first try failed'); });
  });
  assert.equal(record.status, 'Passed');
  assert.equal(record.steps[0].retried, true);
  assert.equal(record.retriedSteps, 1);
  assert.match(record.steps[0].attempts[0].error, /first try failed/);
});

test('attempts: 1 runs a data-creating step once', async () => {
  const run = newRun();
  let calls = 0;
  const record = await run.scenario({ id: 'U-02', module: 'Unit', submodule: 'Unit', title: 'once' }, async s => {
    await s.step('create', async () => { calls += 1; throw new Error('save failed'); }, { attempts: 1 });
  });
  assert.equal(calls, 1);
  assert.equal(record.status, 'Failed');
  assert.equal(record.retriedSteps, undefined);
});

test('block() records an environment precondition as Blocked with its reason, not as Failed', () => {
  const run = newRun();
  run.block({ id: 'PM-REG-PSC-01', module: 'Project Management', submodule: 'PreShipping Checklist', title: 'List renders' }, 'Pre-Shipping option is switched off');
  const [record] = run.result.scenarios;
  assert.equal(record.status, 'Blocked');
  assert.equal(record.reason, 'Pre-Shipping option is switched off');
  assert.deepEqual(record.steps, []);
});
