const { test, expect } = require('../../../fixtures/readonlyTest');
const { SupplierInboxPage } = require('../../../pages/enterprise/supplier-inbox.page');
const labels = ['Unconfirmed Lead Times', 'Overdue Items', 'Deliveries to Schedule', 'Pending Pre-Shipping Checklists'];
for (const label of labels) {
  test(`Supplier Inbox: ${label} summary, exact records and qualification`, async ({ readonly: ctx }, info) => {
    const view = new SupplierInboxPage(ctx.page); const data = await view.load();
    const sections = data.sections.filter(s => s.label === label); expect(sections).toHaveLength(1);
    const section = sections[0];
    await test.step('Expand and validate the complete returned record identities and business rules', async () => {
      const expanded = await view.expandSection(section);
      await view.expectExpandedData(expanded);
      await info.attach('inbox-records-and-completeness', { body: Buffer.from(JSON.stringify(expanded)), contentType: 'application/json' });
    });
    await test.step('Collapse and verify all required summary dimensions', async () => {
      await view.collapseSection(section); await view.expectSummary(section);
    });
  });
}
test('Supplier Inbox: full-list requirement must not silently accept a truncated preview', async ({ readonly: ctx }) => {
  const view = new SupplierInboxPage(ctx.page); const data = await view.load();
  for (const section of data.sections) {
    const expanded = await view.expandSection(section);
    expect(expanded.truncated, `${section.label}: required full list, summary ${JSON.stringify(section.summary)}, returned ${expanded.items.length}`).toBe(false);
    await view.collapseSection(section);
  }
});
test('Supplier Inbox: Pending With filter is supported only for checklist ownership', async ({ readonly: ctx }) => {
  const view = new SupplierInboxPage(ctx.page); const data = await view.load();
  const section = data.sections.find(s => s.key === 'pending_pre_shipping'); expect(section).toBeTruthy();
  await view.expandSection(section);
  for (const [label, value] of [['Supplier', 'supplier'], ['Sub-contractor', 'subcontractor'], ['All', null]]) {
    const button = view.main.getByRole('button', { name: label, exact: true });
    await expect(button).toHaveCount(1);
    const pending = ctx.page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/supplier_inbox/') &&
      new URL(r.url()).searchParams.get('section') === section.key && new URL(r.url()).searchParams.get('pending_with') === value);
    await button.click();
    const body = await (await pending).json(); const result = body.data.sections.find(s => s.key === section.key);
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await view.expectExpandedData(result);
    if (value) for (const record of result.items) expect(record.pending_with).toBe(value);
    await view.expectResult(result);
  }
});
test('Supplier Inbox: deterministic no-match Submittal filter and reset', async ({ readonly: ctx }) => {
  const view = new SupplierInboxPage(ctx.page); const initial = await view.load();
  const search = view.main.getByPlaceholder('e.g. SUB-3307', { exact: true });
  const query = `absent-${require('crypto').randomUUID()}`;
  let response = ctx.page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/supplier_inbox/') && new URL(r.url()).searchParams.get('submittal_id') === query);
  await search.fill(query); const empty = (await (await response).json()).data;
  for (const section of empty.sections) for (const count of Object.values(section.summary)) expect(count).toBe(0);
  for (const section of empty.sections) {
    const expanded = await view.expandSection(section); expect(expanded.items).toEqual([]);
    await view.collapseSection(section);
  }
  response = ctx.page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/supplier_inbox/') && !new URL(r.url()).searchParams.has('submittal_id'));
  await search.fill(''); const reset = (await (await response).json()).data;
  expect(reset.sections.map(s => s.summary)).toEqual(initial.sections.map(s => s.summary));
});
