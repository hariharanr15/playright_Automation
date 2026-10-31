const { test, expect } = require('../../../fixtures/inventoryTest');
const { createDataset } = require('../../support/inventory-management-flow');
const { InventoryBlocked } = require('../../../utils/inventory-data');
const { loadRunDataset } = require('../../../utils/run-dataset');

// The only test of a full run that creates a submittal (decision of 29 Oct 2026). It builds the run's shared chain
// (new material and supplier, submittal, component, order, pre-shipping, actual date, shipping, conditions, GRN);
// Inventory, FDI and International Shipment reuse it.
test.describe('SCP Procurement Log', () => {
  test('Admin completes the Procurement Log flow in NRVC_Hall', async ({ inventory: ctx }, info) => {
    test.setTimeout(900000);
    if (process.env.SCP_INVENTORY_MUTATIONS !== 'true') throw new InventoryBlocked('Creating the run submittal needs the approved write run (--with-owned-mutations)');
    const owned = await createDataset(ctx, info, { fresh: true });
    expect(owned.deliveryCompleted).toBe(true);
    expect(owned.data.grn?.file_size, 'GRN generated for the delivery').toBeGreaterThan(0);
    const saved = loadRunDataset(ctx.allocation.project, ctx.allocation.site);
    expect(saved?.data.submittalNumber, 'Run submittal stored for the later modules').toBe(owned.data.submittalNumber);
    info.annotations.push({ type: 'run-submittal', description: `${owned.data.submittalNumber} / ${owned.master.material_name} / delivery ${owned.data.deliveryQuantity}` });
  });
});
