const { test, expect } = require('../../../fixtures/readonlyTest');
const { DashboardAnalyticsPage } = require('../../../pages/management-dashboard/dashboard-analytics.page');
const { one } = require('../../../utils/scp-readonly');
for (const name of ['Alerts', 'Notifications', 'Tasks']) {
  test(`Management Dashboard: ${name} source-aware historical date search`, async ({ readonly: ctx }, info) => {
    await ctx.assertContext();
    const view = new DashboardAnalyticsPage(ctx.page);
    await view.section(name);
    // The task-specific exception is restricted to the expanded Task Chart test.
    await view.findDatedRecords(info);
    await ctx.assertContext();
  });
}
test('Management Dashboard: Task Chart fixed October 2025 start and dynamic current end', async ({ readonly: ctx }, info) => {
  await ctx.assertContext();
  const view = new DashboardAnalyticsPage(ctx.page);
  await view.section('Tasks'); await view.filter('All');
  await view.charts();
  await view.findDatedRecords(info, 'task-chart');
  const all = await view.allRecords();
  await view.collapse();
  const charts = await view.charts();
  const selected = new URL(view.requestUrl);
  for (const chart of charts) {
    const request = new URL(chart.url);
    for (const key of ['from_date', 'to_date']) expect.soft(request.searchParams.get(key), `Task Chart ${request.pathname} applies ${key}`).toBe(selected.searchParams.get(key));
  }
  const pie = one(charts, c => c.url.includes('/tasks/status-pie/'), 'Task pie').body.data;
  const bar = one(charts, c => c.url.includes('/tasks/by-type-status/'), 'Task categories').body.data;
  await info.attach('task-chart-date-source', { body: Buffer.from(JSON.stringify({ range: { from: selected.searchParams.get('from_date'), to: selected.searchParams.get('to_date') }, records: all, pie, bar })), contentType: 'application/json' });
  expect.soft(Object.values(pie).reduce((total, count) => total + count, 0), 'Every task counted once in the pie').toBe(all.length);
  expect.soft(bar.reduce((total, record) => total + record.count, 0), 'Every task counted once in the status breakdown').toBe(all.length);
  const lookup = await ctx.read('utils/get_utils_by_type/', { type: 'task_status', project_id: selected.searchParams.get('project_id') });
  expect(Array.isArray(lookup.data), 'Authoritative task-status lookup').toBe(true);
  const normalized = label => label.toLowerCase().replace(/[\s-]+/g, '_');
  const expectedStatuses = [];
  for (const status of lookup.data) {
    const expected = all.filter(record => record.task_status === status.util_id);
    expectedStatuses.push({ status: status.name, count: expected.length, ids: expected.map(record => record.notification_id) });
    expect.soft(pie[status.name], `Independent task count for ${status.name}`).toBe(expected.length);
    const matching = bar.filter(record => normalized(record.status) === normalized(status.name));
    expect.soft(matching.length, `At most one breakdown entry for ${status.name}`).toBeLessThanOrEqual(1);
    if (expected.length || matching.length) expect.soft(matching[0]?.count, `Breakdown count for ${status.name}`).toBe(expected.length);
  }
  // Null statuses need a confirmed classification rule; do not invent one by
  // equating them with a chart label. Total population checks still include them.
  await info.attach('task-status-independent-counts', { body: Buffer.from(JSON.stringify({ expectedStatuses, unclassified: all.filter(record => record.task_status == null).map(record => record.notification_id) })), contentType: 'application/json' });
  await ctx.assertContext();
});
