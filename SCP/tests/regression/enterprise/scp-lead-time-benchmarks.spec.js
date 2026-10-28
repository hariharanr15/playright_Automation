const { test, expect } = require('../../../fixtures/readonlyTest');
const { LeadTimeBenchmarksPage } = require('../../../pages/enterprise/lead-time-benchmarks.page');
test('Lead Time Benchmarks: completed, on-time, late and delay cards', async ({ readonly: ctx }) => {
  const view = new LeadTimeBenchmarksPage(ctx.page); await view.expectPerformance(await view.load());
});
test('Lead Time Benchmarks: all category values, zero averages, delta and blank alerts', async ({ readonly: ctx }) => {
  const view = new LeadTimeBenchmarksPage(ctx.page); await view.expectComparisons(await view.load());
});
for (const [header, numeric] of [['CATEGORY', false], ['YOUR AVG', true], ['PLATFORM AVG', true]]) {
  test(`Lead Time Benchmarks: ${header} sort both directions without losing records`, async ({ readonly: ctx }) => {
    const view = new LeadTimeBenchmarksPage(ctx.page); const data = await view.load();
    await view.sortAndVerify(header, numeric); await view.tableRecords(view.main.locator('table'), data.comparisons.length);
  });
}
