const { test, expect } = require('../../../fixtures/readonlyTest');
const { ReadOnlyReportPage } = require('../../../pages/reports/read-only-report.page');
test('Project Management: Bulk Upload Status exact uploader, file names and success/failure outcomes', async ({ readonly: ctx }, info) => {
  const page = new ReadOnlyReportPage(ctx.page);
  const { body } = await page.open({ label: 'Bulk Upload Status', route: 'bulk-upload-status', endpoint: 'bulk_upload_log/list/' }, ctx.config);
  expect(body.count).toBeGreaterThanOrEqual(body.data.length);
  const rendered = body.data.map(r => ({ ...r, displayStatus: r.status === null ? null : r.status.charAt(0).toUpperCase() + r.status.slice(1) }));
  await page.tableFields(rendered, 'Added By', { 'Added By': 'uploaded_by', Status: 'displayStatus', 'Uploaded File': 'uploaded_file_name' });
  for (const record of body.data) {
    expect(record.project_name).toBe(await ctx.projectSelector.activeProjectReference());
    if (record.status === 'success') expect(record.success_file_name).toBeTruthy();
    if (record.status === 'failed') expect(record.failure_file_name).toBeTruthy();
  }
  await info.attach('upload-status-source', { body: Buffer.from(JSON.stringify(body)), contentType: 'application/json' });
  // Agreed rule (27 Oct 2026): every upload must carry a success or failure status; a missing status is a product defect.
  const unknown = body.data.filter(r => r.status === null);
  expect(unknown.map(r => `${r.uploaded_file_name} (success file: ${r.success_file_name ? 'yes' : 'no'}, failure file: ${r.failure_file_name ? 'yes' : 'no'})`),
    `Application defect: ${unknown.length} upload record(s) have no status`).toEqual([]);
});
test('Project Management: Submittal Manager supported business surface', async ({ readonly: ctx }, info) => {
  await ctx.page.goto(new URL('/submittal-manager', ctx.config.baseUrl).href, { waitUntil: 'domcontentloaded' });
  await expect(ctx.page.getByRole('heading', { name: 'Submittal Manager', exact: true, level: 1 })).toBeVisible();
  // Agreed scope (27 Oct 2026): while the page is repurposed, only its load and notice are validated.
  if (await ctx.page.getByText(/This page is being repurposed/).isVisible()) {
    info.annotations.push({ type: 'observation', description: 'Submittal Manager is being repurposed; only the page load and notice were validated' });
    await ctx.assertContext();
    return;
  }
  await expect(ctx.page.getByRole('main').locator('table')).toHaveCount(1);
});
