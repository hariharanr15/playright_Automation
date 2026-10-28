const { test, expect, inventoryStep } = require('../../../fixtures/inventoryTest');
const { createDataset, openOwnedActivity, postAndVerify, ledger, details, verifyInventoryState, verifyBothSearches } = require('../../support/inventory-management-flow');
const { InventoryBlocked, exactOne } = require('../../../utils/inventory-data');

async function owned(ctx, info) {
  if (process.env.SCP_INVENTORY_MUTATIONS !== 'true') {
    info.annotations.push({ type: 'blocked', description: 'Set SCP_INVENTORY_MUTATIONS=true only for an approved dedicated staging run' });
    throw new InventoryBlocked('Stock-changing Inventory run is not enabled');
  }
  return createDataset(ctx, info);
}

for (const action of ['Incoming Load', 'Internal Movement', 'Issue To Construction', 'Loss', 'Return']) {
  test(action === 'Incoming Load' ? 'Inventory receipt: completed delivery populates stock and rejects duplicate Incoming Load' : `Inventory manual: ${action}, exact Search, history and persisted balance`, async ({ inventory: ctx }, info) => {
    await owned(ctx, info);
    if (action === 'Return' && ctx.allocation.returnReducesStock !== true) throw new InventoryBlocked('Return balance direction needs confirmation');
    const seed = ctx.owned.data.quantity;
    const initial = ctx.owned.baselineBalance;
    if (action === 'Incoming Load') {
      await inventoryStep(ctx.page, 'Reject receiving the fully delivered schedule a second time', async () => {
        const activity = await openOwnedActivity(ctx, 'Incoming Load', seed);
        await ctx.inv.fillActivity(activity);
        const pending = ctx.page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/inventory/add_inv_activity/');
        pending.catch(() => {});
        await ctx.page.getByRole('button', { name: 'ADD', exact: true }).click();
        const response = await pending; const body = await response.json();
        expect(response.status()).toBe(400);
        expect(body.message).toContain('scheduled_quantity required:0.00');
        expect(body.message).toContain(`quantity exceeds by ${Number(seed).toFixed(2)}`);
        await info.attach('duplicate-receipt-rejection', { body: Buffer.from(JSON.stringify(body)), contentType: 'application/json' });
        await ctx.inv.cancelActivity();
        await verifyInventoryState(ctx, [], initial);
        await verifyBothSearches(ctx, initial);
      });
      return;
    }
    const quantity = ctx.owned.data.movementQuantity;
    const activity = await openOwnedActivity(ctx, action, quantity);
    const balance = initial - (action === 'Internal Movement' ? 0 : quantity);
    await inventoryStep(ctx.page, `${action}: Search both modules and reconcile stock`, async () => {
      await postAndVerify(ctx, activity, balance);
    });
    if (action === 'Internal Movement') {
      const metadata = await details(ctx, ctx.owned.master.material_master_id);
      const source = exactOne(metadata.locations, l => l.location_name === ctx.allocation.sourceLocation, 'Source balance');
      const destination = exactOne(metadata.locations, l => l.location_name === ctx.allocation.destinationLocation, 'Destination balance');
      expect(Number(source.available_quantity)).toBe(initial - quantity);
      expect(Number(destination.available_quantity)).toBe(quantity);
      expect(Number(source.available_quantity) + Number(destination.available_quantity)).toBe(initial);
    }
  });
}

test('Inventory validation: omit each mandatory field independently', async ({ inventory: ctx }, info) => {
  test.setTimeout(480000);
  await owned(ctx, info);
  for (const label of ['Item', 'Action', 'From Location', 'To Location', 'QTY', 'Comments', 'Supplier', 'Subcontractor', 'Submittal', 'Schedule']) {
    await test.step(`Omit ${label}`, async () => {
      const activity = await openOwnedActivity(ctx, 'Internal Movement');
      await ctx.inv.fillActivity(activity, label);
      await ctx.inv.expectRejected(`${label} is required`);
      await ctx.inv.cancelActivity();
      const snapshot = await ledger(ctx);
      expect(snapshot.data?.activities || []).toHaveLength(ctx.owned.baseline.activities.length);
      expect(Number(snapshot.data.closing_balance)).toBe(ctx.owned.baselineBalance);
      await ctx.reset();
    });
  }
});

test('Inventory validation: nonpositive quantity, movement precision, same location and overdraft', async ({ inventory: ctx }, info) => {
  await owned(ctx, info);
  const available = ctx.owned.baselineBalance;
  const cases = [
    { quantity: 0, message: 'Quantity cannot be empty or zero or less' },
    { quantity: -ctx.owned.data.movementQuantity, message: 'Quantity cannot be empty or zero or less' },
    { quantity: `${ctx.owned.data.movementQuantity}.123`, message: 'Quantity can have at most 2 decimal places.' },
    { quantity: ctx.owned.data.movementQuantity, sameLocation: true, message: 'From Location and To Location must be different.' },
    { quantity: available + 1, message: `Not enough stock at ${ctx.allocation.sourceLocation}: only ${available} ${ctx.owned.master.uom_name} available, ${available + 1} requested.` }
  ];
  for (const scenario of cases) {
    await test.step(scenario.message, async () => {
      const activity = await openOwnedActivity(ctx, 'Internal Movement', scenario.quantity);
      if (scenario.sameLocation) activity.destination = activity.source;
      await ctx.inv.fillActivity(activity);
      await ctx.inv.expectRejected(scenario.message);
      await ctx.inv.cancelActivity();
      expect(Number((await ledger(ctx)).data.closing_balance)).toBe(available);
      await ctx.reset();
    });
  }
});

test('Inventory boundary: move exactly the available stock and conserve site total', async ({ inventory: ctx }, info) => {
  await owned(ctx, info);
  const available = ctx.owned.baselineBalance;
  await postAndVerify(ctx, await openOwnedActivity(ctx, 'Internal Movement', available), available);
  const metadata = await details(ctx, ctx.owned.master.material_master_id);
  expect(Number(exactOne(metadata.locations, l => l.location_name === ctx.allocation.sourceLocation, 'Source').available_quantity)).toBe(0);
  expect(Number(exactOne(metadata.locations, l => l.location_name === ctx.allocation.destinationLocation, 'Destination').available_quantity)).toBe(available);
});

test('Inventory filters: location balances, site isolation and date boundaries', async ({ inventory: ctx }, info) => {
  await owned(ctx, info);
  const moved = ctx.owned.data.movementQuantity;
  const available = ctx.owned.baselineBalance;
  await postAndVerify(ctx, await openOwnedActivity(ctx, 'Internal Movement', moved), available);
  const filter = ctx.inv.main.getByRole('combobox');
  for (const [location, quantity] of [[ctx.allocation.sourceLocation, available - moved], [ctx.allocation.destinationLocation, moved]]) {
    await test.step(`Location ${location}`, async () => {
      await ctx.assertContext();
      const loaded = ctx.page.waitForResponse(r => r.url().includes('/ledger_balance/list_inv_by_location/'));
      await filter.selectOption({ label: location });
      expect((await loaded).ok()).toBe(true);
      await ctx.inv.expectMaterial(ctx.owned.master, quantity);
    });
  }
  await filter.selectOption('');
  await ctx.inv.expectMaterial(ctx.owned.master, available);
  if (!ctx.allocation.secondSite) throw new InventoryBlocked('A second approved site is needed for isolation');
  await ctx.page.goto(ctx.config.managementDashboardUrl);
  await ctx.siteSelector.ensureSite(ctx.allocation.secondSite);
  await ctx.projectSelector.expectActiveProject(ctx.allocation.project);
  await expect(ctx.siteSelector.siteSelector).toHaveText(ctx.allocation.secondSite);
  await ctx.inv.open();
  await ctx.inv.expectMaterial(ctx.owned.master, 0);
  await ctx.reset();
  await ctx.inv.expectMaterial(ctx.owned.master, available);
  await ctx.inv.openView(ctx.owned.master.material_name, 'Actions');
  const snapshot = await ledger(ctx);
  const date = snapshot.data.activities[0].date.slice(0, 10);
  await ctx.inv.chooseDate(ctx.page.getByPlaceholder('select start date', { exact: true }), date);
  await ctx.inv.chooseDate(ctx.page.getByPlaceholder('select End date', { exact: true }), date);
  const expectedCount = 1 + ctx.owned.baseline.activities.filter(entry => entry.date.slice(0, 10) === date).length;
  await expect.poll(async () => (await ledger(ctx)).data?.activities.length).toBe(expectedCount);
  await expect(ctx.inv.drawer().getByRole('row').filter({ has: ctx.page.locator('td:nth-child(2)') })).toHaveCount(expectedCount);
});

test('Inventory date: selected activity date remains visible before submission', async ({ inventory: ctx }) => {
  test.setTimeout(60000);
  const { prepareContext } = require('../../support/inventory-management-flow');
  await prepareContext(ctx);
  await ctx.inv.openView(ctx.reference.material_name, 'Actions');
  await ctx.inv.openActivity();
  const today = await ctx.inv.form.getByPlaceholder('select start date').inputValue();
  const [day, month, year] = today.split('/').map(Number);
  const targetDay = day > 1 ? day - 1 : day + 1;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
  let listener;
  const applicationError = new Promise((resolve, reject) => {
    listener = message => { if (/Maximum update depth exceeded/.test(message.text())) reject(new Error('Application defect: Inventory date picker entered a React maximum-update-depth loop')); };
    ctx.page.on('console', listener);
  });
  try { await Promise.race([ctx.inv.chooseDate(ctx.inv.form.getByPlaceholder('select start date'), iso), applicationError]); }
  catch (error) { await require('../../../utils/shared-browser').discardUnresponsivePage(ctx.page); throw error; }
  finally { ctx.page.off('console', listener); }
  await ctx.inv.cancelActivity();
});
