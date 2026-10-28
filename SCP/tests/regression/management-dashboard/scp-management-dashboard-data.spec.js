const { test, expect } = require('../../../fixtures/readonlyTest');
const { DashboardAnalyticsPage } = require('../../../pages/management-dashboard/dashboard-analytics.page');
const { one } = require('../../../utils/scp-readonly');

for (const name of ['Alerts', 'Notifications', 'Tasks']) {
  test(`Management Dashboard: ${name} defaults to personal Unread and exact project`, async ({ readonly: ctx }, info) => {
    const view = new DashboardAnalyticsPage(ctx.page); const rows = await view.section(name);
    await view.expectVisibleRecords(rows);
    for (const record of rows) expect(record.is_read).toBe(false);
    await info.attach('personal-unread-source', { body: Buffer.from(JSON.stringify({ url: view.requestUrl, records: rows })), contentType: 'application/json' });
  });
  test(`Management Dashboard: ${name} Read/Unread/All record reconciliation`, async ({ readonly: ctx }) => {
    const view = new DashboardAnalyticsPage(ctx.page); const unread = await view.section(name); const all = await view.allRecords();
    const ids = records => records.map(r => r.notification_id).sort();
    expect(ids(unread)).toEqual(ids(all.filter(r => !r.is_read)));
    const read = await view.filter('Read'); expect(ids(read)).toEqual(ids(all.filter(r => r.is_read)));
    const displayedAll = await view.filter('All'); expect(ids(displayedAll)).toEqual(ids(all));
  });
}
test('Management Dashboard: Alerts aggregate cards and expand/collapse', async ({ readonly: ctx }) => {
  const view = new DashboardAnalyticsPage(ctx.page); await view.section('Alerts'); const charts = await view.charts();
  const payload = one(charts, c => c.url.includes('get_project_aggregation'), 'Project aggregate chart');
  await view.expectAggregate(payload.body, new URL(view.requestUrl).searchParams.get('project_id'));
  await view.collapse();
});
test('Management Dashboard: required Alerts distribution/category/ageing charts', async ({ readonly: ctx }) => {
  const view = new DashboardAnalyticsPage(ctx.page); await view.section('Alerts'); await view.charts();
  for (const title of ['Distribution of Alerts by Type', 'Alerts counts by Type and by status of Read', 'Distribution of Unread Alerts by Age']) {
    await expect(view.main.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }
});
test('Management Dashboard: Notifications pie/category counts independently grouped from list', async ({ readonly: ctx }, info) => {
  const view = new DashboardAnalyticsPage(ctx.page); await view.section('Notifications'); const all = await view.allRecords(); const charts = await view.charts();
  const pie = one(charts, c => c.url.includes('/notifications/pie/'), 'Notification pie').body.data;
  const read = all.filter(r => r.is_read).length; const unread = all.length - read;
  expect(pie).toEqual({ read_count: read, unread_count: unread, total_count: all.length });
  await view.expectPie('Read', read, all.length); await view.expectPie('Unread', unread, all.length);
  const bar = one(charts, c => c.url.includes('/notifications/by-category/'), 'Notification categories').body.data;
  const grouped = {};
  for (const record of all) { const key = record.notification_category_name || 'Uncategorized'; grouped[key] ??= { read: 0, unread: 0 }; grouped[key][record.is_read ? 'read' : 'unread']++; }
  for (const item of bar) { expect(item.read).toBe(grouped[item.category]?.read || 0); expect(item.unread).toBe(grouped[item.category]?.unread || 0); }
  expect(bar.reduce((n, item) => n + item.read + item.unread, 0)).toBe(all.length);
  await info.attach('independent-notification-groups', { body: Buffer.from(JSON.stringify(grouped)), contentType: 'application/json' });
  await view.collapse();
});
test('Management Dashboard: Tasks pie and category totals reconcile to exact unique list records', async ({ readonly: ctx }, info) => {
  const view = new DashboardAnalyticsPage(ctx.page); await view.section('Tasks'); const all = await view.allRecords(); const charts = await view.charts();
  const pie = one(charts, c => c.url.includes('/tasks/status-pie/'), 'Task pie').body.data;
  const bar = one(charts, c => c.url.includes('/tasks/by-type-status/'), 'Task breakdown').body.data;
  await info.attach('task-reconciliation', { body: Buffer.from(JSON.stringify({ sourceIds: all.map(r => r.notification_id), pie, bar })), contentType: 'application/json' });
  expect(Object.values(pie).reduce((a, b) => a + b, 0), 'Task pie and source list must have the same qualifying population').toBe(all.length);
  expect(bar.reduce((n, record) => n + record.count, 0)).toBe(all.length);
});
for (const name of ['Notifications', 'Tasks']) {
  test(`Management Dashboard: ${name} ageing request honours the selected date range`, async ({ readonly: ctx }) => {
    const view = new DashboardAnalyticsPage(ctx.page); await view.section(name); const charts = await view.charts();
    const ageing = one(charts, c => c.url.includes('/aging/'), `${name} ageing chart`);
    const list = new URL(view.requestUrl); const request = new URL(ageing.url);
    expect(request.searchParams.get('from_date'), 'Ageing must use the same selected start date').toBe(list.searchParams.get('from_date'));
    expect(request.searchParams.get('to_date'), 'Ageing must use the same selected end date').toBe(list.searchParams.get('to_date'));
  });
}
