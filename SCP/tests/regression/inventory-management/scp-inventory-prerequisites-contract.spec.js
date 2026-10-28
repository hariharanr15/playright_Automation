const { test, expect } = require('@playwright/test');
const { MaterialMasterPage } = require('../../../pages/project-management/material-master.page');
const { SupplierListPage } = require('../../../pages/user-management/supplier-list/supplier-list.page');
const { createDataset, openOwnedActivity } = require('../../support/inventory-management-flow');

for (const failure of ['material', 'mapping']) {
  test(`Inventory prerequisites: ${failure} failure stops dependent work and records evidence`, async () => {
    const calls = []; const attachments = []; let material;
    const originals = [];
    const replace = (prototype, key, action) => {
      const original = prototype[key];
      originals.push(() => { prototype[key] = original; });
      prototype[key] = action;
    };
    replace(MaterialMasterPage.prototype, 'open', async () => {});
    replace(MaterialMasterPage.prototype, 'addMaterial', async name => {
      calls.push('material');
      if (failure === 'material') throw new Error('Simulated material failure');
      material = { material_name: name, material_master_id: 'owned-material', uom_name: 'test-unit' };
    });
    replace(MaterialMasterPage.prototype, 'addInventoryItem', async () => ({ item_id: 'owned-item' }));
    replace(SupplierListPage.prototype, 'open', async () => {});
    let supplier;
    replace(SupplierListPage.prototype, 'create', async value => { calls.push('supplier'); supplier = value; });
    replace(SupplierListPage.prototype, 'mapMaterial', async (supplierName, materialName) => {
      calls.push('mapping');
      expect(supplierName).toBe(supplier.name);
      expect(materialName).toBe(material.material_name);
      throw new Error('Simulated mapping failure');
    });
    const ctx = {
      allocation: { referenceMaterialId: 'reference' }, createdRecords: [],
      assertContext: async () => {},
      read: async () => ({ data: [{ material_master_id: 'reference', material_name: 'Reference', uom_name: 'test-unit' }, ...(material ? [material] : [])] }),
      page: { getByRole: () => ({}), screenshot: async () => Buffer.from('failure evidence') },
      inv: { open: async () => { calls.push('inventory'); } }
    };
    const info = { timeout: 1000, setTimeout: () => {}, attach: async (name, body) => attachments.push({ name, ...body }) };
    try {
      await expect(createDataset(ctx, info)).rejects.toThrow(`Simulated ${failure} failure`);
      expect(calls).toEqual(failure === 'material' ? ['material'] : ['material', 'supplier', 'mapping']);
      expect(ctx.owned).toBeUndefined();
      expect(attachments.map(a => a.name)).toContain('inventory-prerequisite-failure');
      const evidence = JSON.parse(attachments.find(a => a.name === 'inventory-prerequisite-failure-details').body.toString());
      expect(evidence.stages.at(-1).status).toBe('Failed');
      expect(evidence.stages.some(stage => /Prerequisite [34]/.test(stage.name))).toBe(false);
    } finally { originals.reverse().forEach(restore => restore()); }
  });
}

test('Inventory prerequisites: an activity cannot open before delivery completion', async () => {
  let opened = false;
  await expect(openOwnedActivity({ owned: { deliveryCompleted: false }, inv: {
    openActivity: async () => { opened = true; }
  } }, 'Incoming Load', 1)).rejects.toThrow('successfully completed delivery prerequisites');
  expect(opened).toBe(false);
});

test('Inventory prerequisites: uploads retain the generated supplier and overdraft the delivered baseline', () => {
  const { inventoryUploadRows } = require('../../../utils/bulk-upload/inventory-workbook');
  expect(() => inventoryUploadRows({}, {})).toThrow('completed delivery');
  const owned = { deliveryCompleted: true, baselineBalance: 80,
    data: { quantity: 20, movementQuantity: 5, supplier: 'Generated supplier', submittalNumber: 'Generated submittal', comments: 'Generated comments' },
    schedule: { date_required_on_site: '2026-10-26', po_number: 'Generated PO' },
    master: { material_id: 'Generated ID', material_name: 'Generated material' }, item: { item_name: 'Generated item' } };
  const rows = inventoryUploadRows(owned, { sourceLocation: 'Source', destinationLocation: 'Destination', supplier: 'Unrelated supplier' }, true);
  expect(rows[0].Supplier).toBe(owned.data.supplier);
  expect(rows[1].Quantity).toBeGreaterThan(owned.baselineBalance + owned.data.quantity);
});
