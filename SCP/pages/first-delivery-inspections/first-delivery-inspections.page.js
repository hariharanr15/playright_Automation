const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');

class FirstDeliveryInspectionsPage extends BasePage {
  constructor(page, config) {
    super(page);
    this.config = config;
    this.heading = page.getByRole('heading', { name: 'First Delivery Inspections', exact: true }).last();
    this.selfAssignButtons = page.getByRole('button', { name: 'Self Assign', exact: true });
  }

  async open(dashboard) {
    const menu = dashboard.leftNavigation.getByRole('button', {
      name: 'First Delivery Inspections',
      exact: true
    });
    await menu.first().waitFor({ state: 'visible', timeout: 30000 });
    const inspectionsLoaded = this.page.waitForResponse(response =>
      new URL(response.url()).pathname === '/api/first_delivery_inspection/list_inspections/' &&
      response.request().method() === 'GET', { timeout: 30000 });
    // Register before navigation so the initial empty render is not treated as loaded data.
    const listReady = inspectionsLoaded.then(async response => {
      if (!response.ok()) throw new Error(`FDI list request failed with HTTP ${response.status()}.`);
      await response.finished();
    });
    listReady.catch(() => {});
    await menu.first().click();
    await this.page.waitForURL(this.config.firstDeliveryInspectionsUrl, { timeout: 30000 });
    await listReady;
    await expect(this.heading).toBeVisible();
  }


  async validateConfiguredSettings(settings) {
    if (!(await this.hasRecords())) {
      return { skipped: true, reason: 'No FDI records are available for configured-field validation.' };
    }
    let fillReport = this.page.getByRole('button', {
      name: 'Fill Inspection Report',
      exact: true
    }).first();
    if (!(await fillReport.isVisible().catch(() => false))) {
      const available = this.rows().filter({ has: this.page.getByRole('button', {
        name: /Self assign/i
      }) }).first();
      if (await available.isVisible().catch(() => false)) {
        const record = await this.rowData(available);
        await available.getByRole('button', { name: /Self assign/i }).click();
        fillReport = this.recordRow(record).getByRole('button', {
          name: 'Fill Inspection Report', exact: true
        });
      }
    }
    if (!(await fillReport.isVisible().catch(() => false))) {
      return { skipped: true, reason: 'No editable or self-assignable FDI report is available for configured-field validation.' };
    }
    await this.clickFirstVisible([{
      locator: fillReport,
      label: 'Fill Inspection Report'
    }], 'Fill Inspection Report', 10000);
    await expect(this.page.getByRole('heading', {
      name: 'First Delivery Inspection',
      exact: true
    })).toBeVisible();

    // The form renders its sections progressively; assert only after it settles so a hidden check cannot pass on an unrendered form.
    await this.page.getByRole('button', { name: 'PASS', exact: true }).first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => null);
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
    const overallNotes = this.page.getByPlaceholder('Add overall observations or notes for this inspection...');
    const photos = this.page.getByText(/^Photos(?: \(\d+\))?$/);
    const photoInput = this.page.locator('input[type="file"]');
    const documents = this.page.getByText('Submittal Spec Documents', { exact: true });

    await this.expectConfiguredControl(
      overallNotes,
      settings['Need Overall Notes to be captured'],
      'Overall inspection notes'
    );
    await this.expectConfiguredControl(this.page.getByText('Observation/Notes', { exact: true }),
      settings['Need Overall Notes to be captured'], 'Observation/Notes section');
    await this.expectConfiguredControl(
      photos,
      settings['Enable Uploading of Photos?'],
      'Photo upload section'
    );
    await this.expectConfiguredControl(
      documents,
      settings['Provide Link to Submittal Spec Documents?'],
      'Submittal Spec Documents section'
    );

    if (settings['Photos are mandatory?'] && settings['Enable Uploading of Photos?']) {
      await expect(photoInput, 'Mandatory photo configuration should expose the photo input').toBeAttached();
    }
    return { skipped: false };
  }

  async expectConfiguredControl(locator, enabled, label) {
    if (enabled) {
      await expect(locator, `${label} should be available when enabled`).toBeVisible({ timeout: 15000 });
    } else {
      await expect(locator, `${label} should be hidden when disabled`).toBeHidden({ timeout: 15000 });
    }
  }

  async expectInspectorCanSelfAssign() {
    await expect(this.heading).toBeVisible();
    await expect(this.selfAssignButtons.first(), 'Enabled inspector should be able to self-assign an FDI').toBeVisible();
  }

  async expectInspectorCanOpenPage() {
    await expect(this.heading, 'Activated inspector should be able to open First Delivery Inspections').toBeVisible();
  }

  async expectInspectorCannotSelfAssign() {
    await expect(this.heading).toBeVisible();
    await expect(this.selfAssignButtons, 'Disabled inspector must not be able to self-assign an FDI').toHaveCount(0);
  }

  rows() {
    return this.page.locator('main table tbody tr').filter({ has: this.page.locator('td:nth-child(9)') });
  }

  async hasRecords() {
    const emptyState = this.page.getByText(/no (inspection|record|data)/i).first();
    await expect.poll(async () => (
      (await this.rows().first().isVisible().catch(() => false)) ||
      (await emptyState.isVisible().catch(() => false))
    ), { message: 'FDI list should show records or an empty state', timeout: 30000 }).toBe(true);
    if (await this.rows().first().isVisible().catch(() => false)) return true;

    const range = this.page.getByRole('button', { name: /date range|past 6 months/i }).first();
    if (await range.isVisible().catch(() => false)) {
      await range.click();
      await this.page.getByRole('option', { name: /past 6 months/i }).click();
    } else {
      const from = this.page.locator('main input[type="date"]').first();
      if (!(await from.isVisible().catch(() => false))) {
        // Current SCP uses separate calendar controls with no default date range.
        // An empty, loaded list is valid when no range control is available.
        return false;
      }
      const date = new Date();
      date.setMonth(date.getMonth() - 6);
      await from.fill(date.toISOString().slice(0, 10));
    }
    return this.rows().first().waitFor({ state: 'visible', timeout: 30000 })
      .then(() => true).catch(() => false);
  }

  async ensureRecords() {
    if (!(await this.hasRecords())) {
      throw new Error('No FDI record was found in the past six months.');
    }
  }

  async waitForGeneratedRecord({ material, supplier, submittal }, timeout = 180000) {
    const row = this.rows()
      .filter({ hasText: material })
      .filter({ hasText: supplier })
      .filter({ hasText: submittal })
      .first();
    await expect.poll(async () => {
      if (await row.isVisible().catch(() => false)) return true;
      await this.page.reload({ waitUntil: 'domcontentloaded' });
      await this.waitForReady();
      return row.isVisible().catch(() => false);
    }, {
      message: `FDI record for ${material}, ${supplier}, and ${submittal} should be generated`,
      timeout,
      intervals: [5000, 10000, 15000]
    }).toBe(true);
    return row;
  }

  async rowData(row) {
    const cells = await row.getByRole('cell').allTextContents();
    return {
      material: cells[1]?.trim(),
      supplier: cells[2]?.trim(),
      submittal: cells[3]?.trim(),
      deliveryDate: cells[4]?.trim(),
      assignedTo: cells[5]?.trim(),
      status: cells[6]?.trim()
    };
  }

  recordRow(record) {
    let rows = this.rows()
      .filter({ hasText: record.material })
      .filter({ hasText: record.supplier });
    if (record.submittal) rows = rows.filter({ hasText: record.submittal });
    return rows.first();
  }

  async openAdminAssignment(row) {
    await expect(row).toContainText(/Auditor not yet assigned|Awaiting inspection completion/i);
    // Keep the exact required Assign-label assertion in the listing test; allow the
    // deployed Reassign label here so lifecycle behavior can be checked independently.
    await row.getByRole('button', { name: /^(Assign|Reassign)$/ }).click();
    const heading = this.page.getByRole('heading', { name: /^(Assign|Reassign) Inspector$/ });
    await expect(heading).toBeVisible();
    const accessibleDialog = this.page.getByRole('dialog').filter({ has: heading });
    const dialog = await accessibleDialog.count() ? accessibleDialog :
      heading.locator('xpath=ancestor::div[.//select or .//*[@role="combobox"]][1]');
    await expect(dialog).toBeVisible();
    return dialog;
  }

  async assignInspector(row, inspector, { eligible = [], excluded = [] } = {}) {
    const record = await this.rowData(row);
    const dialog = await this.openAdminAssignment(row);
    const dropdown = dialog.getByRole('combobox');
    await expect(dropdown).toBeVisible();
    const native = await dropdown.evaluate(element => element.tagName === 'SELECT');
    if (!native) await dropdown.click();
    const options = native ? dropdown.locator('option') : this.page.getByRole('option');
    const names = await options.allTextContents();
    for (const identity of [...eligible, inspector]) {
      expect(names.some(name => name.includes(identity)), `${identity} must be eligible for this material`).toBe(true);
    }
    for (const identity of excluded) {
      expect(names.some(name => name.includes(identity)), `${identity} must not be selectable`).toBe(false);
    }
    const matches = names.filter(name => name.includes(inspector));
    expect(matches, 'Inspector identity must select exactly one option').toHaveLength(1);
    if (native) await dropdown.selectOption({ label: matches[0].trim() });
    else await this.page.getByRole('option', { name: matches[0].trim(), exact: true }).click();
    await dialog.getByRole('button', { name: /^(Assign|Reassign|Confirm)$/i }).click();
    await expect(dialog).toBeHidden();
    const selected = this.recordRow(record);
    await expect(selected).toContainText(inspector);
    await expect(selected).toContainText(/Awaiting inspection completion/i);
    await expect(selected.getByRole('button', { name: 'Self Assign', exact: true })).toHaveCount(0);
    return selected;
  }

  async expectAssigneeActions(row, assignedToCurrentUser) {
    for (const name of ['Fill Inspection Report', 'Unassign Self']) {
      const button = row.getByRole('button', { name, exact: true });
      if (assignedToCurrentUser) await expect(button).toBeVisible();
      else await expect(button).toHaveCount(0);
    }
  }

  async expectReportSettings(settings) {
    await this.expectConfiguredControl(this.page.getByText('Observation/Notes', { exact: true }),
      settings['Need Overall Notes to be captured'], 'Observation/Notes section');
    await this.expectConfiguredControl(
      this.page.getByPlaceholder('Add overall observations or notes for this inspection...'),
      settings['Need Overall Notes to be captured'], 'Observation/Notes');
    await this.expectConfiguredControl(this.page.getByText(/^Photos(?: \(\d+\))?$/),
      settings['Enable Uploading of Photos?'], 'Photos');
    await this.expectConfiguredControl(this.page.getByText('Submittal Spec Documents', { exact: true }),
      settings['Provide Link to Submittal Spec Documents?'], 'Spec documents');
    if (!settings['Enable Uploading of Photos?']) {
      await expect(this.page.getByRole('button', { name: 'Add photo', exact: true })).toBeHidden();
    }
    if (settings['Need Overall Notes to be captured']) {
      const notes = this.page.getByPlaceholder('Add overall observations or notes for this inspection...');
      const lastQuestion = this.page.getByPlaceholder('Enter response...').last();
      if (await lastQuestion.count()) {
        const notesHandle = await notes.elementHandle();
        try {
          expect(await lastQuestion.evaluate((question, overallNotes) =>
            Boolean(question.compareDocumentPosition(overallNotes) & Node.DOCUMENT_POSITION_FOLLOWING), notesHandle),
          'Observation/Notes must follow the inspection questions').toBe(true);
        } finally {
          await notesHandle.dispose();
        }
      }
    }
  }

  photoThumbnails() {
    return this.page.locator('main').getByRole('button', { name: 'Enlarge', exact: true })
      .getByRole('img', { name: 'Inspection', exact: true });
  }

  async expectSpecDocumentState({ specSectionNo, documents = [] }) {
    await expect(this.page.getByText('Submittal Spec Documents', { exact: true })).toBeVisible();
    if (!specSectionNo) {
      await expect(this.page.getByText('No Spec Section No provided in submittal.', { exact: true })).toBeVisible();
    } else if (!documents.length) {
      await expect(this.page.getByText(/no (spec |linked |specification )?documents/i).first()).toBeVisible();
    } else {
      for (const name of documents) await expect(this.page.getByText(name, { exact: true })).toBeVisible();
    }
  }

  async rejectNonImage() {
    await this.page.locator('input[type="file"]').first().setInputFiles({
      name: 'invalid-inspection-document.pdf', mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\nInvalid photo fixture\n%%EOF')
    });
    await expect(this.page.getByRole('alert').or(this.page.getByRole('status'))
      .filter({ hasText: /image|file type|format/i }).first()).toBeVisible();
    await expect(this.page.getByText('invalid-inspection-document.pdf', { exact: true })).toBeHidden();
  }

  async expectMandatoryPhotoBlocked() {
    await this.page.getByRole('button', { name: 'Submit Inspection' }).click();
    await expect(this.page.getByRole('alert').or(this.page.getByRole('status'))
      .filter({ hasText: /photo.*(required|mandatory|at least)|(?:required|at least).*photo/i }).first()).toBeVisible();
    await expect(this.page).toHaveURL(/\/form\/?$/);
  }

  async expectPhotoViewer(thumbnails) {
    await expect(thumbnails.first()).toBeVisible({ timeout: 30000 });
    expect(await thumbnails.count(), 'Photo navigation requires at least two photos').toBeGreaterThanOrEqual(2);
    await thumbnails.first().click();
    const accessibleViewer = this.page.getByRole('dialog').filter({ visible: true });
    const next = this.page.getByRole('button', { name: 'Next photo', exact: true });
    const viewer = await accessibleViewer.count() ? accessibleViewer :
      next.locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
    await expect(viewer).toBeVisible();
    const photo = viewer.getByRole('img', { name: 'Inspection', exact: true });
    await expect(photo).toBeVisible();
    const first = await photo.getAttribute('src');
    await viewer.getByRole('button', { name: /next/i }).click();
    await expect(viewer).toBeVisible();
    await expect(photo).not.toHaveAttribute('src', first);
    await viewer.getByRole('button', { name: /previous/i }).click();
    await expect(photo).toHaveAttribute('src', first);
    await viewer.getByRole('button', { name: /close/i }).click();
    await expect(viewer).toBeHidden();
  }

  async selfAssign(row, email) {
    const record = await this.rowData(row);
    const selected = this.recordRow(record);
    await expect(row).toContainText(/Auditor not yet assigned/i);
    await expect(row.getByRole('button', { name: /Self assign/i })).toBeVisible();
    await row.getByRole('button', { name: /Self assign/i }).click();
    await expect(selected).toContainText(/Awaiting inspection completion/i);
    await expect(selected).toContainText(email);
    await expect(selected.getByRole('button', { name: /Self assign/i })).toHaveCount(0);
    await expect(selected.getByRole('button', { name: /Fill inspection report/i })).toBeVisible();
    await expect(selected.getByRole('button', { name: /Unassign self/i })).toBeVisible();
    return selected;
  }

  async unassign(row, email) {
    const record = await this.rowData(row);
    const selected = this.recordRow(record);
    await row.getByRole('button', { name: /Unassign self/i }).click();
    await expect(selected).toContainText(/Auditor not yet assigned/i);
    await expect(selected).not.toContainText(email);
    await expect(selected.getByRole('button', { name: /Fill inspection report/i })).toHaveCount(0);
    await expect(selected.getByRole('button', { name: /Self assign/i })).toBeVisible();
  }

  async openReport(row) {
    await row.getByRole('button', { name: /Fill inspection report/i }).click();
    await expect(this.page.getByRole('heading', { name: 'First Delivery Inspection', exact: true })).toBeVisible();
  }

  async setDeliveryDateRange(from, to) {
    const fields = this.page.getByPlaceholder('DD/MM/YYYY', { exact: true });
    await expect(fields).toHaveCount(2);
    for (const [index, value] of [from, to].entries()) {
      const field = fields.nth(index);
      if (!await field.evaluate(element => element.readOnly)) {
        await field.fill(value);
        await field.press('Tab');
        continue;
      }
      if (!value) {
        if (await field.inputValue()) {
          await field.locator('..').getByRole('button', { name: /clear|reset/i }).click();
          await expect(field).toHaveValue('');
        }
        continue;
      }
      const parts = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!parts) throw new Error('Delivery date must use DD/MM/YYYY');
      const date = new Date(Number(parts[3]), Number(parts[2]) - 1, Number(parts[1]));
      const month = date.toLocaleString('en-US', { month: 'long' });
      await field.click();
      const day = this.page.getByRole('button', {
        name: new RegExp(`^${month} ${date.getDate()}, ${date.getFullYear()}$`, 'i')
      });
      const existing = await field.inputValue();
      const initial = existing ? existing.split('/').map(Number) : null;
      const current = initial ? new Date(initial[2], initial[1] - 1, initial[0]) : new Date();
      const months = (date.getFullYear() - current.getFullYear()) * 12 + date.getMonth() - current.getMonth();
      if (Math.abs(months) > 120) throw new Error('Delivery date exceeds the supported ten-year calendar navigation range');
      if (!await day.isVisible()) {
        for (let step = 0; step < Math.abs(months); step += 1) {
          await this.page.getByRole('button', { name: months > 0 ? /next month/i : /previous month/i }).click();
        }
      }
      await day.click();
      await expect(field).toHaveValue(value);
    }
  }

  async clearFilters() {
    const filters = this.page.locator('main').getByRole('combobox');
    await filters.nth(0).selectOption({ label: 'All Materials' });
    await filters.nth(1).selectOption({ label: 'All Suppliers' });
    await filters.nth(2).selectOption({ label: 'All Statuses' });
    await this.page.getByPlaceholder('Inspector email').clear();
    await this.setDeliveryDateRange('', '');
  }

  async reportQuestions() {
    const inputs = this.page.getByPlaceholder('Enter response...');
    await expect(inputs.first(), 'Inspection report needs at least one configured question').toBeVisible();
    return inputs;
  }

  async fillReport(runId) {
    const inputs = await this.reportQuestions();
    const values = [];
    for (let index = 0; index < await inputs.count(); index += 1) {
      const value = `Automated inspection ${runId} answer ${index + 1}`;
      await inputs.nth(index).fill(value);
      values.push(value);
    }
    const notes = this.page.getByPlaceholder('Add overall observations or notes for this inspection...');
    if (await notes.isVisible().catch(() => false)) await notes.fill(`Inspection ${runId} completed`);
    return values;
  }

  async saveProgress() {
    await this.page.getByRole('button', { name: 'Save Progress' }).click();
    await expect(this.page.getByRole('button', { name: 'Submit Inspection' })).toBeVisible();
  }

  async uploadPhoto(filePath) {
    const input = this.page.locator('input[type="file"]').first();
    if (await input.count()) {
      await input.setInputFiles(filePath);
    } else {
      const chooser = this.page.waitForEvent('filechooser');
      await this.page.getByRole('button', { name: 'Add photo' }).click();
      await (await chooser).setFiles(filePath);
    }
    await expect(this.page.getByRole('button', { name: 'Add photo', exact: true })).toBeEnabled({ timeout: 60000 });
    await expect(this.page.getByText('Loading photos…', { exact: true })).toBeHidden({ timeout: 60000 });
    await expect(this.page.getByText('No photos yet. Click Add photo to upload one.')).toBeHidden();
    await expect(this.photoThumbnails().first()).toBeVisible({ timeout: 30000 });
  }

  async submit() {
    await this.page.getByRole('button', { name: 'Submit Inspection' }).click();
    const confirm = this.page.getByRole('button', { name: /Confirm|Yes, submit/i });
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    await this.page.waitForURL(/\/first-delivery-inspection\/[^/]+\/?$/, { timeout: 30000 });
    await expect(this.page.getByText('inspection completed', { exact: true })).toBeVisible();
  }
}

module.exports = { FirstDeliveryInspectionsPage };
