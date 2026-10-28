const { expect } = require('@playwright/test');
const { ReadOnlyReportPage } = require('../reports/read-only-report.page');
const { number, ScpBlocked } = require('../../utils/scp-readonly');
const fs = require('fs');
class DocumentsPage extends ReadOnlyReportPage {
  async all(config) { return this.open({ label: 'All Documents', route: 'all-documents', endpoint: 'submittal_schedule_file/list-all-documents/', projectScoped: true }, config); }
  async specs(config) { return this.open({ label: 'Spec Documents', route: 'spec-documents', endpoint: 'spec_documents/', projectScoped: true }, config); }
  async expectAll(body) {
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeLessThanOrEqual(body.pagination.page_size);
    expect(body.pagination.total_count).toBeGreaterThanOrEqual(body.data.length);
    await expect(this.main.getByText(`${body.pagination.total_count} document(s) across this project`, { exact: true })).toBeVisible();
    await this.tableFields(body.data, 'Filename', { Filename: 'filename', Material: 'material_name', Submittal: 'submittal_no', 'Uploaded By': 'uploaded_by' });
  }
  async expectSpecs(body) {
    await this.tableFields(body.data, 'Filename', { Filename: 'original_filename', Status: 'status', 'Uploaded by': 'uploaded_by', 'Spec Section No': 'spec_section_no' });
    for (const record of body.data) expect(record.project_id).toBeTruthy();
  }
  async searchNoMatch() {
    const search = this.main.getByRole('textbox'); await expect(search).toHaveCount(1);
    const query = `absent-${require('crypto').randomUUID()}`;
    const pending = this.page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/list-all-documents/') && new URL(r.url()).searchParams.get('search') === query);
    await search.fill(query); await this.main.getByRole('button', { name: 'Search', exact: true }).click();
    const body = await (await pending).json(); expect(body.data).toEqual([]); expect(body.pagination.total_count).toBe(0);
    await expect(this.main.locator('tbody tr').filter({ has: this.page.locator('td:nth-child(2)') })).toHaveCount(0);
  }
  async downloadSpec(record, destination) {
    const row = this.main.getByRole('row').filter({ has: this.page.getByRole('cell', { name: record.original_filename, exact: true }) });
    await expect(row, 'Allocated exact document, not an arbitrary row').toHaveCount(1);
    const pending = this.page.waitForEvent('download').then(download => ({ download }), error => ({ error }));
    const response = this.page.waitForResponse(r => new URL(r.url()).pathname === `/api/spec_documents/${record.spec_document_id}/download/`);
    await row.getByRole('button', { name: 'Download', exact: true }).click();
    expect((await response).status(), 'Existing specification download endpoint must return the file').toBe(200);
    const outcome = await pending; if (outcome.error) throw outcome.error;
    const download = outcome.download; expect(await download.failure()).toBeNull();
    expect(download.suggestedFilename()).toBe(record.original_filename); await download.saveAs(destination);
    expect(fs.statSync(destination).size).toBe(record.size_bytes);
  }
  async rejectUnsupportedFile(route, config) {
    await this.page.goto(new URL(`/${route}`, config.baseUrl).href, { waitUntil: 'domcontentloaded' });
    const upload = this.main.locator('input[type=file]'); await expect(upload).toHaveCount(1);
    await upload.setInputFiles({ name: `invalid-${require('crypto').randomUUID()}.txt`, mimeType: 'text/plain', buffer: Buffer.from('invalid format client-validation fixture') });
    await expect(this.page.getByText(route === 'po-validation' ? 'Please upload Excel (.xlsx, .xls) or PDF files.' : 'Please upload an Excel (.xlsx, .xls) or PDF file.', { exact: true })).toBeVisible();
  }
}
module.exports = { DocumentsPage };
