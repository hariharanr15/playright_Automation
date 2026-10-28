const { test } = require('node:test');
const assert = require('node:assert/strict');
const { InventoryRecoverySources } = require('../../utils/inventory-recovery');

test('the documented no-deliveries response authorizes only the missing delivery', async () => {
  const source = new InventoryRecoverySources({ read: async () => ({ statuscode: 201, message: 'No schedule deliveries found for the given submittal_schedule_id.' }) }, { scheduleId: 'owned-schedule' });
  assert.equal(await source.delivery(), undefined);
});
test('an incomplete delivery response cannot authorize another delivery', async () => {
  const source = new InventoryRecoverySources({ read: async () => ({ statuscode: 200 }) }, { scheduleId: 'owned-schedule' });
  await assert.rejects(() => source.delivery(), /Delivery lookup must return a list/);
});

test('an existing material with no SKU resumes only the missing prerequisite', async () => {
  const reads = [];
  const source = new InventoryRecoverySources({ read: async (endpoint, params) => {
    reads.push({ endpoint, params });
    return { data: endpoint.startsWith('material_master/') ? [{ material_master_id: 'owned-material', material_name: 'Owned', uom_name: 'Each', category: 'General' }] : null };
  } }, { material: 'Owned', expectedUom: 'Each', expectedCategory: 'General' });
  assert.deepEqual(await source.material(), { status: 'missing' });
  assert.equal(source.masterRecord.material_master_id, 'owned-material');
  assert.deepEqual(reads.at(-1).params, { material_id: 'owned-material', ensure_default: false });
});
test('a malformed SKU response cannot authorize another creation', async () => {
  const source = new InventoryRecoverySources({ read: async endpoint => ({ data: endpoint.startsWith('material_master/') ?
    [{ material_master_id: 'owned-material', material_name: 'Owned', uom_name: 'Each', category: 'General' }] : { unexpected: true } }) },
  { material: 'Owned', expectedUom: 'Each', expectedCategory: 'General' });
  await assert.rejects(() => source.material(), /SKU lookup must return a list/);
});
