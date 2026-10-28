const { test } = require('node:test');
const assert = require('node:assert/strict');
const { bulkJobDecision, recoverBulkActivities } = require('../../utils/bulk-upload/recovery');
test('processing uploads block resubmission and completed jobs are reused', () => {
  assert.equal(bulkJobDecision({ is_finished: false }, 'positive').status, 'unknown');
  assert.equal(bulkJobDecision({ is_finished: true, status: 'success' }, 'positive').status, 'complete');
  assert.equal(bulkJobDecision({ is_finished: true, status: 'failed' }, 'negative').status, 'complete');
  assert.equal(bulkJobDecision({ is_finished: true, status: 'failed' }, 'positive').status, 'missing');
});
test('committed rows are recovered only with exact owned IDs, quantity and unique comments', () => {
  const row = { Action: 'Loss', Quantity: 5, Comments: 'unique', 'From Location': 'A', 'To Location': '' };
  const saved = { comments: 'unique', utility_action_name: 'loss', submittal_id: 'S', schedule_id: 'C', action_quantity: -5 };
  assert.equal(recoverBulkActivities([row], [saved], 'S', 'C')[0].quantity, 5);
  assert.throws(() => recoverBulkActivities([row], [saved, saved], 'S', 'C'), /2 saved matches/);
  assert.throws(() => recoverBulkActivities([row], [{ ...saved, schedule_id: 'other' }], 'S', 'C'), /different owned identifiers/);
  assert.throws(() => recoverBulkActivities([row], [{ ...saved, action_quantity: 6 }], 'S', 'C'), /different owned identifiers/);
  assert.throws(() => recoverBulkActivities([row], [{ ...saved, action_quantity: 5 }], 'S', 'C'), /different owned identifiers/);
});
