const { test, expect } = require('../../../fixtures/readonlyTest');
const { LeadTimeBenchmarksPage } = require('../../../pages/enterprise/lead-time-benchmarks.page');

async function openAnalysis(ctx) {
  const nav = ctx.page.locator('nav');
  await nav.getByRole('button', { name: 'Analytics', exact: true }).click();
  const pending = ctx.page.waitForResponse(r => new URL(r.url()).pathname === '/api/enterprise/lead-time-benchmarks/');
  await nav.getByRole('button', { name: 'Lead Time Analysis', exact: true }).click();
  await expect(ctx.page).toHaveURL(/\/lead-time-analysis\/?$/);
  const response = await pending; expect(response.status()).toBe(200);
  const data = (await response.json()).data;
  await expect(ctx.page.getByRole('heading', { name: 'Your Delivery Performance', exact: true })).toBeVisible();
  return { view: new LeadTimeBenchmarksPage(ctx.page), data };
}

test('Lead Time Analysis: Analytics navigation and completed delivery performance reconciliation', async ({ readonly: ctx }) => {
  const { view, data } = await openAnalysis(ctx);
  await ctx.assertContext(); await view.expectPerformance(data);
  // This deployed view explicitly uses every accessible project, not just the header project.
  await expect(view.main.getByText(/Your = every project you have access to, combined/)).toBeVisible();
});

test('Lead Time Analysis: all category averages, zero values and benchmark comparisons', async ({ readonly: ctx }) => {
  const { view, data } = await openAnalysis(ctx);
  await view.expectComparisons(data);
});
