const { test, expect } = require('../../../fixtures/readonlyTest');
const { DocumentsPage } = require('../../../pages/document-management/documents.page');
const { requireValue, one } = require('../../../utils/scp-readonly');
test('All Documents: exact page records, identities, project total and pagination metadata', async ({ readonly: ctx }) => {
  const page = new DocumentsPage(ctx.page); const { body } = await page.all(ctx.config); await page.expectAll(body);
});
test('All Documents: no-match Search returns zero records', async ({ readonly: ctx }) => {
  const page = new DocumentsPage(ctx.page); await page.all(ctx.config); await page.searchNoMatch();
});
test('Spec Documents: saved filename, status, uploader and specification association', async ({ readonly: ctx }) => {
  const page = new DocumentsPage(ctx.page); const { body } = await page.specs(ctx.config); await page.expectSpecs(body);
});
test('Spec Documents: exact existing document download filenames and byte sizes', async ({ readonly: ctx }, info) => {
  const page = new DocumentsPage(ctx.page); const { body } = await page.specs(ctx.config);
  if (!body.data.length) throw new (require('../../../utils/scp-readonly').ScpBlocked)('No existing specification documents available for download validation');
  for (const record of body.data) {
    await page.downloadSpec(record, info.outputPath('documents', record.spec_document_id, require('path').basename(record.original_filename)));
  }
});
for (const route of ['po-validation', 'bom-validation']) {
  test(`${route}: unsupported input file rejected before upload or application mutation`, async ({ readonly: ctx }) => {
    await new DocumentsPage(ctx.page).rejectUnsupportedFile(route, ctx.config);
  });
}
