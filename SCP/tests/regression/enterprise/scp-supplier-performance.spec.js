const { test, expect } = require('../../../fixtures/readonlyTest');
const { SupplierPerformancePage } = require('../../../pages/enterprise/supplier-performance.page');
test('Supplier Performance: all KPI values, project and supplier rows', async ({ readonly: ctx }) => {
  const view = new SupplierPerformancePage(ctx.page); const data = await view.load(); await view.expectData(data);
});
test('Supplier Performance: six/twelve-month buckets and aggregate invariance', async ({ readonly: ctx }) => {
  const view = new SupplierPerformancePage(ctx.page); const initial = await view.load();
  expect(initial.trend_months).toBe(6); expect(initial.deliveries_per_month).toHaveLength(6);
  const twelve = await view.months(12); expect(twelve.kpis).toEqual(initial.kpis);
  const six = await view.months(6); expect(six.deliveries_per_month).toEqual(initial.deliveries_per_month);
});
