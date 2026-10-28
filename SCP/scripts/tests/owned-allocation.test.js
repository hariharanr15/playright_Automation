const { test } = require('node:test');
const assert = require('node:assert/strict');
const { qualifyOwnedDelivery } = require('../../utils/owned-allocation');
const scenario = () => ({ title: 'Owned delivery', status: 'Passed', context: { project: 'P' }, data: { inventoryOwned: {
  deliveryCompleted: true, master: { material_master_id: 'M', material_name: 'Inventory QA owned' },
  submittal: { submittal_id: 'S', spec_section_no: 'SPEC' }, schedule: { material_id: 'M', submittal_schedule_id: 'C', received_quantity: 10 },
  data: { ownerProject: 'P', ownerSite: 'S', material: 'Inventory QA owned', submittalNumber: 'owned-submittal', submittalId: 'S', specificationNumber: 'SPEC', deliveryQuantity: 10,
    deliveryRecord: { submittal_schedule: 'C', schedule_delivery_id: 'D', quantity: 10 }, grn: { file_size: 100, file_name: 'GRN_D.pdf' } }
} } });
test('only a passed owned delivery can feed later FDI and Shipment stages', () => {
  assert.equal(qualifyOwnedDelivery([scenario()], 'P', 'S', 'results.json').data.deliveryRecord.schedule_delivery_id, 'D');
  assert.equal(qualifyOwnedDelivery([{ ...scenario(), status: 'Failed' }], 'P', 'S', 'results.json'), null);
  assert.equal(qualifyOwnedDelivery([scenario()], 'Other', 'S', 'results.json'), null);
  assert.equal(qualifyOwnedDelivery([scenario()], 'P', 'Other', 'results.json'), null);
});
test('mismatched material, quantity or GRN cannot qualify as a prerequisite handoff', () => {
  for (const mutate of [owned => { owned.schedule.material_id = 'Other'; }, owned => { owned.data.deliveryRecord.quantity = 9; }, owned => { owned.data.grn.file_name = 'GRN_OTHER.pdf'; }]) {
    const value = scenario(); mutate(value.data.inventoryOwned);
    assert.equal(qualifyOwnedDelivery([value], 'P', 'S', 'results.json'), null);
  }
});
