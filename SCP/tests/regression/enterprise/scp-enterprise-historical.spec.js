const { test } = require('../../../fixtures/readonlyTest');
const { EnterpriseViewPage } = require('../../../pages/enterprise/enterprise-view.page');
test('Enterprise View: common historical range reconciles project table and CSV scope', async ({ readonly: ctx }, info) => {
  await ctx.assertContext();
  const view = new EnterpriseViewPage(ctx.page);
  await test.step('Open Enterprise View in the selected project context', () => view.load());
  await test.step('Apply dates, validate project values and verify downloaded CSV content', () => view.findDatedProjects(info));
  await ctx.assertContext();
});
