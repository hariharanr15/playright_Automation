const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');

class BulkUploadStatusPage extends BasePage {
  constructor(page) {
    super(page);
    this.searchInput = page.getByRole('textbox', { name: /Search by uploader/i });
    this.uploadTypeFilter = page.getByRole('button', { name: 'All Upload Types', exact: true });
  }

  async open(dashboard) {
    await dashboard.openProjectManagementModule('Bulk Upload Status', 'bulk-upload-status', 'Bulk Upload Status');
    await expect(this.searchInput).toBeVisible();
    await expect(this.uploadTypeFilter).toBeVisible();
  }

  async verifyUploaderSearch(query) {
    await this.fillVisible(this.searchInput, query, 'Bulk upload uploader search');
    await expect(this.searchInput).toHaveValue(query);
    await this.clearSearchAndPause(this.searchInput, 'Bulk Upload Status search');
  }
}

module.exports = { BulkUploadStatusPage };
