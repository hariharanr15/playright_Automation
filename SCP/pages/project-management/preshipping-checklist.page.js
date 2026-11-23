const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');
const { clickHighlighted } = require('../../utils/highlight');

class PreshippingChecklistPage extends BasePage {
  constructor(page) {
    super(page);
    this.addQuestionButton = page.getByRole('button', { name: 'Add Question', exact: true });
    this.modalHeading = page.getByRole('heading', { name: 'Add Question', exact: true });
  }

  async open(dashboard) {
    const checklistLoaded = this.page.waitForResponse((response) => {
      const url = response.url();
      return url.includes('/api/project_pre_shipping_check_list/list_project_checklists/') &&
        /[?&]project_id=(?!null(?:&|$))[^&]+/.test(url);
    }, { timeout: 30000 }).catch(() => null);
    await dashboard.openProjectManagementModule(
      'PreShipping Checklist',
      'preshipping-checklist',
      'PreShipping Checklist'
    );
    const response = await checklistLoaded;
    const toast = await this.page.getByText(/Error fetching questions/i).first().innerText({ timeout: 3000 }).catch(() => null);
    if (!response) throw new Error(`PreShipping checklist questions were not requested within 30 seconds${toast ? `; the page shows "${toast}"` : ''}`);
    if ([401, 403].includes(response.status())) {
      const { ScpBlocked } = require('../../utils/scp-readonly');
      throw new ScpBlocked(`This account may not read PreShipping checklist questions (HTTP ${response.status()})`);
    }
    expect(response.ok(), `NRVC_Hall PreShipping checklist should load successfully (HTTP ${response.status()}${toast ? `, page shows "${toast}"` : ''})`).toBeTruthy();
    if (!(await this.addQuestionButton.isVisible({ timeout: 10000 }).catch(() => false))) {
      const { ScpBlocked } = require('../../utils/scp-readonly');
      throw new ScpBlocked('PreShipping Checklist loaded without an Add Question action for this account');
    }
  }

  async verifyBlankQuestionIsRejected() {
    await this.clickFirstVisible([{ locator: this.addQuestionButton, label: 'Add Question' }], 'Add Question', 10000);
    await expect(this.modalHeading).toBeVisible();
    await this.clickFirstVisible([
      { locator: this.page.getByRole('button', { name: 'Add', exact: true }), label: 'Add checklist question' }
    ], 'Add checklist question', 5000);
    await expect(this.modalHeading, 'Blank checklist question must not be submitted').toBeVisible();
  }

  async addQuestion(questionText) {
    await expect(this.row(questionText), `Question "${questionText}" must be unique`).toHaveCount(0);
    if (!(await this.modalHeading.isVisible().catch(() => false))) {
      await this.clickFirstVisible([{ locator: this.addQuestionButton, label: 'Add Question' }], 'Add Question', 10000);
      await expect(this.modalHeading).toBeVisible();
    }
    await this.fillVisible(this.fieldBesideLabel('Question Text'), questionText, 'PreShipping question');
    await this.clickFirstVisible([
      { locator: this.page.getByRole('button', { name: 'Add', exact: true }), label: 'Add checklist question' }
    ], 'Add checklist question', 10000);
    await this.expectQuestion(questionText);
  }

  async createCurrentRunQuestion(questionText) {
    await this.addQuestion(questionText);
    await expect(this.row(questionText), `Current run question "${questionText}" should be created once`).toHaveCount(1);
  }

  async ensureQuestionEnabled(questionText) {
    const row = this.row(questionText);
    await expect(row, `Only the current run question "${questionText}" should match`).toHaveCount(1);
    await expect(row, `The current run question "${questionText}" should already exist`).toBeVisible({ timeout: 30000 });

    if (await this.modalHeading.isVisible().catch(() => false)) {
      await this.clickFirstVisible([
        { locator: this.modalHeading.locator('..').getByRole('button', { name: 'close' }), label: 'Close question dialog' }
      ], 'Close question dialog', 5000);
    }

    const checkbox = row.getByRole('checkbox');
    await expect(checkbox, `The new question "${questionText}" should initially be disabled`).not.toBeChecked();
    await clickHighlighted(checkbox, `Enable ${questionText}`);
    const answerTypeHeading = this.page.getByRole('heading', { name: 'Select Answer Type', exact: true });
    await expect(answerTypeHeading).toBeVisible();
    await this.selectDropdownOption(
      this.page.getByRole('button', { name: 'Choose Answer Type', exact: true }),
      'Text',
      'PreShipping Answer Type'
    );
    await expect(this.page.getByRole('button', { name: 'Text', exact: true })).toBeVisible();

    const saved = this.page.waitForResponse((response) => (
      response.url().includes('/api/project_pre_shipping_check_list/') &&
      response.request().method() !== 'GET'
    ), { timeout: 30000 });
    await this.clickFirstVisible([
      { locator: this.page.getByRole('button', { name: 'Add', exact: true }), label: 'Add Answer Type' }
    ], 'Add Answer Type', 5000);
    const response = await saved;
    expect(response.ok(), `Enabling ${questionText} should save successfully`).toBeTruthy();
    const requestBody = (response.request().postData() || '').toLowerCase();
    expect(requestBody, `${questionText} save request should configure Text answer type`).toContain('text');
    await expect(answerTypeHeading).toBeHidden();
    await expect(checkbox).toBeChecked();

    const pageSave = this.page.getByRole('button', { name: 'Save', exact: true });
    if (await pageSave.isVisible().catch(() => false)) {
      await this.clickFirstVisible([{ locator: pageSave, label: 'Save PreShipping Checklist' }], 'Save PreShipping Checklist', 5000);
    }

    const checklistReloaded = this.page.waitForResponse((response) => {
      const url = response.url();
      return url.includes('/api/project_pre_shipping_check_list/list_project_checklists/') &&
        /[?&]project_id=(?!null(?:&|$))[^&]+/.test(url);
    }, { timeout: 30000 });
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    const reloadResponse = await checklistReloaded;
    expect(reloadResponse.ok(), 'Saved NRVC_Hall PreShipping checklist should reload successfully').toBeTruthy();
    await this.waitForReady();
    await expect(this.row(questionText).getByRole('checkbox')).toBeChecked();
  }

  row(questionText) {
    const questionCell = this.page.getByRole('cell', { name: questionText, exact: true });
    return this.page.getByRole('row').filter({ has: questionCell });
  }

  async expectQuestion(questionText) {
    const row = this.row(questionText);
    await expect(row).toBeVisible({ timeout: 30000 });
    await expect(row).toContainText(questionText);
  }
}

module.exports = { PreshippingChecklistPage };
