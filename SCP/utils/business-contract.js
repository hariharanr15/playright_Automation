const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');
const { requireValue, number, excluded } = require('./scp-readonly');
const { date } = require('./enterprise/enterprise-metrics');
const at = (value, key) => key.split('.').reduce((node, part) => node?.[part], value);
function calculate(records, rule) {
  const values = rule.field ? records.map(row => at(row, rule.field)) : records;
  if (rule.operation === 'count') return records.length;
  if (rule.operation === 'distinct') return new Set(values.filter(v => v !== null && v !== undefined)).size;
  for (const value of values) expect(typeof value, 'An independent numeric source value is required').toBe('number');
  const total = values.reduce((a, b) => a + b, 0);
  if (rule.operation === 'sum') return total;
  if (rule.operation === 'mean') return values.length ? total / values.length : null;
  if (rule.operation === 'min') return values.length ? Math.min(...values) : null;
  if (rule.operation === 'max') return values.length ? Math.max(...values) : null;
  throw new Error(`Unrecognised approved calculation ${rule.operation}`);
}
async function verifyBusinessContract(ctx, info, moduleKey) {
  const descriptor = requireValue(ctx.allocation.businessSources?.[moduleKey], `${moduleKey}: provide an independent source contract; business requirements/source records cannot be invented`);
  if (excluded.test(descriptor.route || '')) throw new Error('Business contract references excluded functionality');
  const sourcePath = path.resolve(requireValue(descriptor.sourceFile, `${moduleKey}: sourceFile is required`));
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  requireValue(source.provenance, `${moduleKey}: independent source provenance is required`);
  const account = await ctx.page.evaluate(() => JSON.parse(localStorage.getItem('userInfo') || '{}').ref);
  expect(source.accountRef).toBe(account);
  expect(date(source.asOf)).toBe(await ctx.page.evaluate(() => { const now = new Date(); return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()); }));
  const rules = requireValue(descriptor.rules, `${moduleKey}: confirmed formula rules are required`);
  expect(rules.length, 'A source fixture without business assertions is not coverage').toBeGreaterThan(0);
  const projectId = await ctx.projectSelector.activeProjectReference();
  expect(source.projectRefs).toContain(projectId);
  const actual = await ctx.read(descriptor.endpoint, { ...descriptor.params, project_id: projectId });
  await ctx.page.goto(new URL(`/${descriptor.route}`, ctx.config.baseUrl).href, { waitUntil: 'domcontentloaded' });
  await ctx.assertContext();
  for (const rule of rules) {
    const records = requireValue(at(source, rule.recordsPath), `${moduleKey}: source record collection ${rule.recordsPath} missing`);
    expect(Array.isArray(records)).toBe(true);
    let expected = calculate(records, rule);
    if (expected !== null && rule.decimals !== undefined) expected = Number(expected.toFixed(rule.decimals));
    expect(at(actual, rule.actualPath), `${moduleKey}: ${rule.operation}(${rule.recordsPath}.${rule.field || '*'})`).toBe(expected);
    const control = ctx.page.getByRole('main').getByText(rule.uiLabel, { exact: true }).locator('..');
    await expect(control).toHaveCount(1);
    if (expected === null) await expect(control).toContainText('—');
    else expect(number(await control.innerText())).toBe(expected);
  }
  await info.attach('independent-business-contract', { body: Buffer.from(JSON.stringify({ moduleKey, descriptor, actual, source })), contentType: 'application/json' });
}
module.exports = { verifyBusinessContract, calculate };
