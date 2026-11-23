const { test } = require('../tests/support/test-base');

test('Inspect shipment submenu and user filter controls', async ({ scpProject }) => {
  const { page } = scpProject;
  await page.getByRole('button', { name: 'International Shipments', exact: true }).click();
  await page.getByRole('button', { name: /^Shipments\d+$/ }).waitFor({ state: 'visible', timeout: 45000 });
  await page.getByText('Loading international shipments...').waitFor({ state: 'hidden', timeout: 45000 });
  await page.getByRole('button', { name: /^Shipments\d+$/ }).click();
  await page.getByText('Loading international shipments...').waitFor({ state: 'hidden', timeout: 45000 });
  await page.waitForTimeout(1000);
  console.log('SHIP_VIEW', (await page.locator('main').innerText()).slice(0, 5000));
  console.log('SHIP_ROW_HTML', (await page.getByRole('row').nth(1).evaluate(el => el.outerHTML).catch(() => '')).slice(-3500));
  await page.getByRole('row').filter({ hasText: 'SCP-109' }).getByRole('button', { name: 'Edit', exact: true }).click();
  console.log('EDIT_DIALOG', (await page.locator('main').innerText()).slice(-1200));
  console.log('EDIT_FIELDS', JSON.stringify(await page.locator('input:visible').evaluateAll(els => els.map(el => ({ value: el.value, placeholder: el.placeholder, outer: el.outerHTML.slice(0, 300) })))));
  await page.reload();
  await page.getByRole('button', { name: 'User Management', exact: true }).first().click();
  await page.getByRole('button', { name: 'User Management', exact: true }).last().click();
  await page.getByRole('row').filter({ hasText: '@' }).first().waitFor({ state: 'visible', timeout: 30000 });
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  await page.getByRole('tab', { name: 'status', exact: true }).click();
  await page.waitForTimeout(1000);
  console.log('FILTER_VIEW', (await page.getByRole('tabpanel').innerText()).slice(0, 2500));
  console.log('FILTER_HTML', (await page.getByRole('tabpanel').evaluate(el => el.outerHTML)).slice(0, 3500));
  for (const category of ['project_role', 'organization']) {
    await page.getByRole('tab', { name: category, exact: true }).click();
    console.log(`FILTER_${category}`, (await page.getByRole('tabpanel').evaluate(el => el.outerHTML)).slice(0, 1800));
  }
});
