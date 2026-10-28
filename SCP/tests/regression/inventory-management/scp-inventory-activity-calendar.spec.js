const { test, expect } = require('../../../fixtures/inventoryCalendarTest');
const { currentCalendarDate, defaultInventoryRange, addCalendarDays } = require('../../../utils/calendar-date');
const { InventoryBlocked } = require('../../../utils/inventory-data');

test('Inventory calendar: dynamic default minus two and plus one calendar months', async ({ inventoryCalendar: ctx }, info) => {
  const today = await currentCalendarDate(ctx.page);
  const expected = defaultInventoryRange(today);
  await ctx.calendar.open();
  await info.attach('inventory-calendar-default-expectation', { body: Buffer.from(JSON.stringify({ today, timeZone: process.env.SCP_TIMEZONE || 'Asia/Calcutta', expected, actual: await ctx.calendar.range() })), contentType: 'application/json' });
  // Collect both field results. Soft assertions still fail the case on mismatch.
  await ctx.calendar.expectRange(expected, { soft: true });
  await ctx.calendar.verifyActivities();
});

test('Inventory calendar: every displayed activity matches its selected inclusive date range', async ({ inventoryCalendar: ctx }, info) => {
  await ctx.calendar.open();
  const result = await ctx.calendar.findExistingActivities(info);
  await info.attach('inventory-calendar-activity-source', { body: Buffer.from(JSON.stringify(result)), contentType: 'application/json' });
  if (!result.records.length) throw new InventoryBlocked('No activities in the approved material/date range; positive activity population validation needs existing allocated records');
});

test('Inventory calendar: changing date bounds refreshes exact filtered activities', async ({ inventoryCalendar: ctx }, info) => {
  await ctx.calendar.open();
  const before = await ctx.calendar.verifyActivities();
  if (!before.records.length) throw new InventoryBlocked('Range-refresh validation requires existing activities in the approved baseline range');
  const changed = { from: addCalendarDays(before.range.to, 1), to: addCalendarDays(before.range.to, 2) };
  const after = await ctx.calendar.changeRange(changed);
  await info.attach('inventory-calendar-range-refresh', { body: Buffer.from(JSON.stringify({ before, after })), contentType: 'application/json' });
  expect(after.range).toEqual(changed);
});
