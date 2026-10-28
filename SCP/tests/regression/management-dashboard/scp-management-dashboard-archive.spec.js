const fs = require('fs');
const path = require('path');
const { test, expect } = require('../../../fixtures/readonlyTest');
const { DashboardAnalyticsPage } = require('../../../pages/management-dashboard/dashboard-analytics.page');
const { requireValue } = require('../../../utils/scp-readonly');
const { date } = require('../../../utils/enterprise/enterprise-metrics');

test('Management Dashboard: configured archive period and complete supported option set', async ({ readonly: ctx }) => {
  const projectId = await ctx.page.evaluate(() => localStorage.getItem('selectedProjectId'));
  const config = (await ctx.read('project_config/', { project_id: projectId })).data;
  expect([30, 60, 90, 120, 150, 180, 360]).toContain(config.notification_archive_days);
  // Existing projects may intentionally differ from the fresh-project default of 90.
  const { ConfigurationOptionsPage } = require('../../../pages/project-management/configuration-options.page');
  const page = new ConfigurationOptionsPage(ctx.page); await page.open(ctx.dashboard);
  const label = ctx.page.getByRole('main').locator('p').filter({ hasText: /^Archive Read Items After/ }); await expect(label).toBeVisible();
  const row = label.locator('xpath=ancestor::div[contains(@class,"justify-between")][1]');
  const trigger = row.getByRole('button', { name: `${config.notification_archive_days} days`, exact: true }); await expect(trigger).toHaveCount(1);
  await trigger.click();
  expect(await ctx.page.getByRole('listbox').getByRole('option').allTextContents()).toEqual([30, 60, 90, 120, 150, 180, 360].map(n => `${n} days`));
  await ctx.page.keyboard.press('Escape');
});
for (const name of ['Alerts', 'Notifications', 'Tasks']) {
  test(`Management Dashboard: ${name} independently validates personal archival and old unread retention`, async ({ readonly: ctx }, info) => {
    const file = requireValue(ctx.allocation.dashboard?.archiveSourceFile, 'Archive source fixture required: raw records including hidden archived IDs, triggeredAt, per-user read state and server asOf');
    const source = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
    const ref = await ctx.page.evaluate(() => JSON.parse(localStorage.getItem('userInfo') || '{}').ref);
    expect(source.accountRef).toBe(ref); requireValue(source.asOf, 'Archive asOf is required');
    const view = new DashboardAnalyticsPage(ctx.page); await view.section(name); const visible = await view.allRecords();
    const query = new URL(view.requestUrl); const projectId = query.searchParams.get('project_id');
    const config = (await ctx.read('project_config/', { project_id: projectId })).data;
    const type = ({ Alerts: 'alert', Notifications: 'notification', Tasks: 'task' })[name];
    const expected = source.records.filter(r => r.type === type && r.projectId === projectId &&
      date(r.triggeredAt) >= date(query.searchParams.get('from_date')) && date(r.triggeredAt) <= date(query.searchParams.get('to_date')) &&
      !(r.readBy.includes(ref) && date(source.asOf) - date(r.triggeredAt) > config.notification_archive_days * 86400000));
    expect(visible.map(r => r.notification_id).sort()).toEqual(expected.map(r => r.id).sort());
    await info.attach('archive-source', { path: path.resolve(file), contentType: 'application/json' });
  });
}
