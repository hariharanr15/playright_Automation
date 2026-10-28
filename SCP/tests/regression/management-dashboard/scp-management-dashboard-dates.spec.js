const { test, expect } = require('../../../fixtures/readonlyTest');
const { DashboardAnalyticsPage } = require('../../../pages/management-dashboard/dashboard-analytics.page');
const { selectCalendarDate } = require('../../../utils/date-picker');
const { date } = require('../../../utils/enterprise/enterprise-metrics');
for (const name of ['Alerts', 'Notifications', 'Tasks']) {
  test(`Management Dashboard: ${name} single-day boundary and restore dates`, async ({ readonly: ctx }) => {
    const view = new DashboardAnalyticsPage(ctx.page); await view.section(name); const records = await view.allRecords();
    // Every eligible record supplies its own business date; no arbitrary first-record fixture.
    const dates = [...new Set(records.map(r => r.created_at).filter(Boolean))].map(date).sort((a, b) => a - b);
    if (!dates.length) throw new (require('../../../utils/scp-readonly').ScpBlocked)(`${name} has no existing dated records for boundary validation`);
    const target = dates[dates.length - 1]; const iso = new Date(target).toISOString().slice(0, 10);
    const start = view.main.getByPlaceholder('Start date', { exact: true });
    const end = view.main.getByPlaceholder('End date', { exact: true });
    const loaded = ctx.page.waitForResponse(r => view.isList(r) && new URL(r.url()).searchParams.get('from_date') === iso && new URL(r.url()).searchParams.get('to_date') === iso);
    await selectCalendarDate(ctx.page, start, iso);
    await selectCalendarDate(ctx.page, end, iso); const actual = (await (await loaded).json()).data;
    const expected = records.filter(r => !r.is_read && date(r.created_at) === target).map(r => r.notification_id).sort();
    expect(actual.map(r => r.notification_id).sort()).toEqual(expected);
  });
}
