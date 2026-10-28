const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BasePage } = require('../../pages/base.page');
test('a menu option that renders asynchronously is awaited without another click', async () => {
  const start = Date.now();
  const hidden = { first: () => ({ isVisible: async () => false }) };
  const delayed = { first: () => ({ isVisible: async () => Date.now() - start >= 40 }) };
  const candidates = [{ locator: hidden }, { locator: delayed }];
  assert.equal(await new BasePage({}).firstVisible(candidates, 500), candidates[1]);
});
test('an absent control remains absent after the bounded readiness wait', async () => {
  const locator = { first: () => ({ isVisible: async () => false }) };
  assert.equal(await new BasePage({}).firstVisible([{ locator }], 20), null);
});
