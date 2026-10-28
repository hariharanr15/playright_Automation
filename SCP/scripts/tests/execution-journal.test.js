const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ExecutionJournal, stableId } = require('../../utils/execution-journal');
const scenario = { id: stableId('inventory.spec.js', 'Delivery to Inventory'), title: 'Delivery to Inventory' };
const create = (directory, extra = {}) => new ExecutionJournal({ directory: directory || fs.mkdtempSync(path.join(os.tmpdir(), 'scp-recovery-')), scenario, ...extra });

test('related prerequisite data is isolated by account, project and environment', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'scp-related-'));
  const context = { project: 'P', account: 'A', baseUrl: 'https://stg.example.test' };
  const first = create(directory, { scenario: { id: 'SCP-IS-101' }, context });
  first.setData('ownedShipmentData', { submittalId: 'owned' });
  const next = create(directory, { scenario: { id: 'SCP-IS-102' }, context });
  assert.equal(next.relatedData('SCP-IS-101').ownedShipmentData.submittalId, 'owned');
  const foreign = create(directory, { scenario: { id: 'SCP-IS-102' }, context: { ...context, project: 'Q' } });
  assert.equal(foreign.relatedData('SCP-IS-101'), null);
  assert.throws(() => next.relatedData('../SCP-IS-101'), /invalid/);
});

test('page-level access evidence survives serialization while secrets are removed', () => {
  const journal = create();
  journal.setData('access', { page: { probed: true, reachable: true, reason: 'Opened' }, password: 'do-not-store' });
  assert.deepEqual(journal.snapshot().data.access, { page: { probed: true, reachable: true, reason: 'Opened' } });
});

test('a transient Windows checkpoint lock does not repeat a business action', async t => {
  const rename = fs.renameSync;
  let locked = true;
  t.mock.method(fs, 'renameSync', (...args) => {
    if (locked) { locked = false; const error = new Error('Temporary file lock'); error.code = 'EPERM'; throw error; }
    return rename(...args);
  });
  const journal = create();
  let actions = 0;
  await journal.execute({ id: 'one-action', name: 'Read owned record' }, async () => { actions++; return 'owned'; });
  assert.equal(actions, 1);
  assert.equal(JSON.parse(fs.readFileSync(journal.file, 'utf8')).steps['one-action'].status, 'Passed');
});

test('persistent failure runs twice, records both failures and captures evidence twice', async () => {
  let actions = 0; let screenshots = 0;
  const journal = create(null, { evidence: async () => ({ screenshot: `failure-${++screenshots}.png` }) });
  await assert.rejects(journal.execute({ id: 'read', name: 'Verify exact material', expected: 'The saved identity matches' }, async () => { actions++; throw new Error('Wrong material'); }), /Wrong material/);
  assert.equal(actions, 2); assert.equal(screenshots, 2);
  assert.equal(journal.steps[0].status, 'Failed'); assert.equal(journal.steps[0].attemptCount, 2);
});

test('transient failure retries only the failed step and preserves its failed attempt', async () => {
  let actions = 0;
  const journal = create();
  const result = await journal.execute({ id: 'lookup', name: 'Search exact submittal' }, async () => { if (++actions === 1) throw new Error('Network changed'); return 'owned-submittal'; });
  assert.equal(result, 'owned-submittal');
  assert.deepEqual(journal.steps[0].attempts.map(attempt => attempt.status), ['Failed', 'Passed']);
});

test('creation committed before failure is recovered without creating a duplicate', async () => {
  let exists = false; let creations = 0;
  const journal = create();
  const result = await journal.execute({ id: 'create', name: 'Create unique supplier', mutation: true,
    verify: async () => exists ? { status: 'complete', value: 'supplier-id' } : { status: 'missing' }
  }, async () => { creations++; exists = true; throw new Error('Response lost after save'); });
  assert.equal(creations, 1); assert.equal(result, 'supplier-id');
  assert.equal(journal.steps[0].attempts[1].reused, true);
  assert.equal(journal.steps[0].attempts[1].actionExecuted, false);
});

test('targeted recovery revalidates saved prerequisites and executes only missing records', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'scp-recovery-'));
  let material = true; let supplier = false; const created = [];
  const first = create(directory); first.data('generated', () => ({ material: 'unique-material', supplier: 'unique-supplier' }));
  const second = create(directory);
  await second.runPlan([
    { id: 'material', name: 'Create material', mutation: true, verify: async () => ({ status: material ? 'complete' : 'missing' }), action: async () => { created.push('material'); material = true; } },
    { id: 'supplier', name: 'Create mapped supplier', dependsOn: ['material'], mutation: true, verify: async () => ({ status: supplier ? 'complete' : 'missing' }), action: async () => { created.push('supplier'); supplier = true; } }
  ]);
  assert.deepEqual(created, ['supplier']);
  assert.equal(second.state.data.generated.material, 'unique-material');
});

test('failed submittal blocks delivery and inventory while independent dashboard runs', async () => {
  const actions = []; const journal = create();
  const result = await journal.runPlan([
    { id: 'submittal', name: 'Create valid submittal', action: async () => { actions.push('submittal'); throw new Error('Save failed'); } },
    { id: 'delivery', name: 'Complete related delivery', dependsOn: ['submittal'], action: async () => actions.push('delivery') },
    { id: 'inventory', name: 'Transfer delivered stock', dependsOn: ['delivery'], action: async () => actions.push('inventory') },
    { id: 'dashboard', name: 'Read independent dashboard', action: async () => actions.push('dashboard') }
  ]);
  assert.deepEqual(actions, ['submittal', 'submittal', 'dashboard']);
  assert.deepEqual(result.steps.map(step => step.status), ['Failed', 'Blocked', 'Blocked', 'Passed']);
});

test('unsafe creation retry is suppressed, counted and remains a failed action', async () => {
  let creates = 0; const journal = create();
  await assert.rejects(journal.execute({ id: 'create', name: 'Create record', mutation: true }, async () => { creates++; throw new Error('Unknown save outcome'); }), /existence verifier/);
  assert.equal(creates, 1); assert.equal(journal.steps[0].attemptCount, 2);
  assert.equal(journal.steps[0].status, 'Failed'); assert.equal(journal.steps[0].attempts[1].retrySuppressed, true);
});

test('nested wrappers never multiply the two-attempt limit', async () => {
  let actions = 0; const journal = create();
  await assert.rejects(journal.execute({ id: 'outer', name: 'Business action' }, () =>
    journal.execute({ id: 'inner', name: 'Nested helper' }, async () => { actions++; throw new Error('Persistent error'); })));
  assert.equal(actions, 2);
});

test('dependency cycles are rejected before execution', () => {
  assert.throws(() => create().define([{ id: 'a', dependsOn: ['b'] }, { id: 'b', dependsOn: ['a'] }]), /cycle/);
});
