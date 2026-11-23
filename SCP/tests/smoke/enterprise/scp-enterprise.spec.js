const { test, expect } = require('../../../fixtures/readonlyTest');
const { EnterprisePage, modules } = require('../../../pages/enterprise/enterprise.page');
for (const name of Object.keys(modules)) {
  test(`Enterprise smoke: ${name} data and read-only contract`, async ({ readonly: ctx }, info) => {
    const page = new EnterprisePage(ctx.page);
    const data = await page.open(name);
    await test.step('Verify a loaded business population, not just a route', async () => {
      expect(data).toBeTruthy();
      if (name === 'Enterprise View') expect(data.open_submittals.open).toBeLessThanOrEqual(data.open_submittals.total);
      if (name === 'Supplier Inbox') { expect(data.sections.length).toBeGreaterThan(0); for (const s of data.sections) expect(s.expanded).toBe(false); }
      if (name === 'Supplier Performance') expect(data.kpis.overdue_schedules).toBeLessThanOrEqual(data.kpis.active_schedules);
      if (name === 'Lead Time Benchmarks') expect(data.delivery_performance.on_time + data.delivery_performance.late).toBe(data.delivery_performance.total_delivered);
      await page.expectReadOnly();
    });
    await info.attach('loaded-business-data', { body: Buffer.from(JSON.stringify(data)), contentType: 'application/json' });
  });
}
