const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');

class InventoryBulkUploadPage extends BasePage {
  constructor(page) {
    super(page);
    this.dialog = page.getByRole('dialog', { name: 'Upload inventory activities', exact: true });
  }
  stepOptions(method) {
    return method === 'submit' ? { verify: () => this.verifySubmittedJob() } : {};
  }
  async verifySubmittedJob() {
    const journal = require('../../utils/scp-step').currentJournal();
    const receipt = journal?.state.data.inventoryBulkReceipt;
    if (!receipt?.data?.upload_id) {
      const uncertain = Object.values(journal?.state.steps || {}).some(step => step.name === 'InventoryBulkUploadPage: submit' && step.mutationObserved);
      return uncertain ? { status: 'unknown', reason: 'A previous upload may have committed without a receipt; do not submit it again' } : { status: 'missing' };
    }
    const body = await require('../../utils/inventory-data').readInventoryApi(this.page, `bulk-uploads/uploads/${receipt.data.upload_id}/`);
    expect(body.data.upload_id).toBe(receipt.data.upload_id);
    const decision = require('../../utils/bulk-upload/recovery').bulkJobDecision(body.data, journal.state.data.inventoryBulkKind);
    if (decision.status === 'complete') this.recoveredUpload = body.data;
    return decision;
  }
  async open() {
    await this.page.getByRole('main').getByRole('button', { name: 'Upload', exact: true }).click();
    await expect(this.dialog).toBeVisible();
    await expect(this.dialog.getByRole('button', { name: 'Upload', exact: true })).toBeDisabled();
  }
  async downloadTemplate(file) {
    const pending = this.page.waitForEvent('download');
    await this.dialog.getByRole('button', { name: 'Download template', exact: true }).click();
    const download = await pending;
    expect(await download.failure()).toBeNull();
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
    await download.saveAs(file);
    return file;
  }
  async submit(file) {
    await this.dialog.getByTestId('bulk-upload-file-input').setInputFiles(file);
    await expect(this.dialog.getByRole('button', { name: 'Upload', exact: true })).toBeEnabled();
    const accepted = this.page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/bulk-uploads/bulk-upload-parse/'));
    await this.dialog.getByRole('button', { name: 'Upload', exact: true }).click();
    const response = await accepted;
    expect(response.ok(), 'Bulk upload request must be accepted').toBe(true);
    const receipt = await response.json();
    const journal = require('../../utils/scp-step').currentJournal();
    if (journal) {
      journal.setData('inventoryBulkReceipt', receipt);
      if (journal.runningStep) journal.runningStep.records = receipt;
      journal.save();
    }
    await expect(this.dialog.getByText(/All rows were valid and have been saved\.|The upload failed\. Nothing was saved\.|couldn't check the status|taking longer than expected/i))
      .toBeVisible({ timeout: 150000 });
    return receipt;
  }
  async expectSuccess() {
    if (this.recoveredUpload) { expect(this.recoveredUpload.status).toBe('success'); return; }
    await expect(this.dialog.getByText('All rows were valid and have been saved.', { exact: true })).toBeVisible();
  }
  async expectFailure() {
    if (this.recoveredUpload) { expect(this.recoveredUpload.status).toBe('failed'); return; }
    await expect(this.dialog.getByText('The upload failed. Nothing was saved.', { exact: true })).toBeVisible();
    await expect(this.dialog.getByRole('button', { name: 'Download error file', exact: true })).toBeEnabled();
  }
  async downloadErrors(file) {
    const pending = this.page.waitForEvent('download');
    if (this.recoveredUpload) {
      await this.page.evaluate(async uploadId => {
        const response = await fetch(`/api/bulk-uploads/uploads/${uploadId}/download-file/?file_type=error`, { headers: { Authorization: `Bearer ${localStorage.getItem('_sso_access')}` } });
        if (!response.ok) throw new Error(`Owned upload error download returned HTTP ${response.status}`);
        const link = document.createElement('a'); link.href = URL.createObjectURL(await response.blob()); link.download = 'inventory-owned-errors.xlsx';
        document.body.appendChild(link); link.click(); link.remove();
      }, this.recoveredUpload.upload_id);
      const download = await pending; expect(await download.failure()).toBeNull(); await download.saveAs(file); return file;
    }
    await this.dialog.getByRole('button', { name: 'Download error file', exact: true }).click();
    const download = await pending;
    expect(await download.failure()).toBeNull();
    await download.saveAs(file);
    return file;
  }
  async close() {
    await this.dialog.getByRole('button', { name: 'Close', exact: true }).first().click();
    await expect(this.dialog).toBeHidden();
  }

  // ===========================================================================================================
  // Methods used by the Inventory Management regression (tests/pm-flow/inv-regression.spec.js), following the
  // upload dialog as it behaves on NRVC_Hall today (21 Nov 2026): a successful upload says "uploaded successfully".
  // The older methods above are kept unchanged for the specs under tests/regression/inventory-management.
  // ===========================================================================================================

  /** Opens the "Upload inventory activities" dialog from the Inventory Management list. */
  async openUploadDialog() {
    await this.page.getByRole('main').getByRole('button', { name: 'Upload', exact: true }).first().click();
    await expect(this.page.getByText('Upload inventory activities').first()).toBeVisible();
  }

  /** Downloads the upload template from the open dialog into `file`. */
  async saveTemplateTo(file) {
    const download = this.page.waitForEvent('download');
    await this.page.getByRole('button', { name: 'Download template' }).click();
    await (await download).saveAs(file);
    return file;
  }

  /** Closes the dialog with "Cancel" (no upload). */
  /** Closes the upload dialog with "Cancel". Does nothing when it is already closed (e.g. on a step retry). */
  async cancelUploadDialog() {
    const cancel = this.page.getByRole('button', { name: 'Cancel', exact: true }).last();
    if (await cancel.isVisible().catch(() => false)) await cancel.click();
  }

  /**
   * Chooses `file`, clicks "Upload" and waits until the upload has finished.
   * Returns the result line the dialog shows ("… uploaded successfully" or "The upload failed. Nothing was saved."),
   * or an empty text when the dialog showed neither.
   */
  async uploadAndReadResult(file) {
    await this.page.locator('input[type="file"]').last().setInputFiles(file);
    await this.page.getByRole('button', { name: 'Upload', exact: true }).last().click();
    // The dialog's help text already mentions "the error file", so the end of the "Uploading…" state is awaited instead.
    await expect(this.page.getByRole('button', { name: /Uploading/ })).toHaveCount(0, { timeout: 120000 }).catch(() => null);
    await this.page.getByText(/uploaded successfully|upload failed|nothing was saved/i).first().waitFor({ timeout: 15000 }).catch(() => null);
    const pageText = await this.page.locator('body').innerText();
    return pageText.match(/[^\n]*(uploaded successfully|upload failed|Nothing was saved)[^\n]*/i)?.[0] || '';
  }

  /** Clicks "Download error file" after a failed upload and saves the file. */
  async saveErrorFileTo(file) {
    const download = this.page.waitForEvent('download');
    await this.page.getByRole('button', { name: /Download error file/ }).click();
    await (await download).saveAs(file);
    return file;
  }

  /** Closes the dialog after an upload ("Close", or Escape when the button is not offered). */
  async closeUploadDialog() {
    await this.page.getByRole('button', { name: 'Close', exact: true }).last().click({ timeout: 5000 })
      .catch(() => this.page.keyboard.press('Escape'));
  }
}
module.exports = { InventoryBulkUploadPage };
