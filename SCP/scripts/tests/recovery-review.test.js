const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { identity, moduleFor, main } = require('../summarize-scp-recovery');
test('a recovery cannot replace another account or project result with the same scenario ID', () => {
  const base = { id: 'SCP-1', file: 'case.js', project: 'Google Chrome', context: { account: 'A', project: 'P' } };
  assert.notEqual(identity(base), identity({ ...base, context: { account: 'B', project: 'P' } }));
  assert.notEqual(identity(base), identity({ ...base, context: { account: 'A', project: 'Q' } }));
});
test('Supplier List keeps its reporting position despite its User Management source folder', () => {
  assert.equal(moduleFor({ file: 'regression/user-management/supplier-list/case.spec.js', module: 'User Management' }).order, 3);
});
test('an unfinished full run cannot be published as a completed recovery review', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'scp-review-'));
  fs.writeFileSync(path.join(directory, 'manifest.json'), '{}');
  await assert.rejects(() => main([directory]), /Wait for the original full run to finish/);
});
