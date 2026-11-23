const { test, expect } = require('../../../fixtures/readonlyTest');
const { EnterprisePage, modules } = require('../../../pages/enterprise/enterprise.page');
test('Enterprise navigation: parent collapse/reopen preserves all four in-scope entries', async ({ readonly: ctx }) => {
  const view = new EnterprisePage(ctx.page); await view.expand();
  await view.nav.getByRole('button', { name: 'Enterprise', exact: true }).click();
  for (const name of Object.keys(modules)) await expect(view.nav.getByRole('button', { name, exact: true })).toBeHidden();
  await view.expand(); const source = await view.open('Enterprise View');
  expect(source.projects).toBeGreaterThan(0); await view.expectReadOnly();
});
