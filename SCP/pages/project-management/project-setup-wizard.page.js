const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');

const STEPS = ['Integration', 'Directory', 'Project Config', 'Sites', 'Material Category',
  'Materials', 'Suppliers', 'Suppliers->Materials', 'First Submittal'];
const TITLES = { 'Material Category': 'Add Material Categories', Materials: 'Add Materials',
  Suppliers: 'Add Suppliers', 'Suppliers->Materials': 'Map Suppliers to Materials' };
const NOTES = {
  'Material Category': 'Add only important categories at this stage. You can manage many categories easily using the menu option Project Management->Reference data ->Material Category.',
  Materials: 'Add only important materials (max up to 5) at this stage. You can manage any number of materials easily using the menu option Project Management->Material Master.',
  Suppliers: 'Add only major suppliers of the important materials (max up to 5) at this stage. You can manage any number of suppliers using the menu option User Management->Supplier List.',
  'Suppliers->Materials': 'Add only major supplier to material mappings (max up to 5) at this stage. You can manage any number of supplier to material mappings using the menu option User Management->Supplier List.'
};

class ProjectSetupWizardPage extends BasePage {
  constructor(page, config) {
    super(page);
    this.config = config;
    this.root = page.locator('main');
  }

  async open() {
    await this.page.goto(new URL('/setup-wizard', this.config.baseUrl).toString());
    await expect(this.page).toHaveURL(/\/setup-wizard\/?$/);
    await expect(this.root).toBeVisible();
  }

  step(name) {
    if (!STEPS.includes(name)) throw new Error(`Unknown setup step: ${name}`);
    return this.root.getByText(name, { exact: true });
  }

  async expectStepOrder() {
    let previous;
    for (const name of STEPS) {
      const step = this.step(name);
      await expect(step).toBeVisible();
      const handle = await step.elementHandle();
      if (previous) {
        try {
          expect(await step.evaluate((current, prior) =>
            Boolean(prior.compareDocumentPosition(current) & Node.DOCUMENT_POSITION_FOLLOWING), previous),
          `${name} must follow the preceding wizard step`).toBe(true);
        } finally { await previous.dispose(); }
      }
      previous = handle;
    }
    if (previous) await previous.dispose();
  }

  async selectStep(name) {
    await this.step(name).click();
    if (TITLES[name]) await expect(this.root.getByRole('heading', { name: TITLES[name], exact: true })).toBeVisible();
  }

  rows() {
    return this.root.locator('table tbody tr').filter({ has: this.page.locator('td') })
      .filter({ hasNot: this.page.locator('td[colspan]') });
  }

  row(identity) {
    return this.rows().filter({ hasText: identity });
  }

  async expectStepConventions(name) {
    await this.selectStep(name);
    expect(await this.rows().count(), `${name} must display at most five records`).toBeLessThanOrEqual(5);
    for (const button of ['Back', 'Skip', 'Next']) {
      await expect(this.root.getByRole('button', { name: button, exact: true })).toBeVisible();
    }
    const note = NOTES[name];
    await expect(this.root.getByText(note, { exact: false })).toBeVisible();
    if (name === 'Suppliers->Materials') {
      await expect(this.root.getByText(/to map materials for the supplier\./)).toBeVisible();
    }
    const rows = this.rows();
    for (let index = 0; index < await rows.count(); index += 1) {
      await expect(rows.nth(index).getByRole('button', { name: /edit/i })
        .or(rows.nth(index).getByRole('img', { name: /edit/i }))).toBeVisible();
    }
    if (await rows.count() === 5) {
      const add = this.root.getByRole('button', { name: /^Add(?:\s|$)/ }).first();
      if (await add.isVisible()) await expect(add).toBeDisabled();
    }
  }

  async skipStep(name) {
    await this.selectStep(name);
    await this.root.getByRole('button', { name: 'Skip', exact: true }).click();
    const next = STEPS[STEPS.indexOf(name) + 1];
    if (TITLES[next]) await expect(this.root.getByRole('heading', { name: TITLES[next], exact: true })).toBeVisible();
    else await expect(this.step(next)).toBeVisible();
  }

  async openPopup(identity) {
    if (identity) {
      const row = this.row(identity);
      await row.getByRole('button', { name: /edit/i }).or(row.getByRole('img', { name: /edit/i })).click();
    } else await this.root.getByRole('button', { name: /^Add(?:\s|$)/ }).first().click();
    const dialog = this.page.getByRole('dialog').filter({ visible: true });
    if (await dialog.count()) {
      await expect(dialog).toBeVisible();
      return dialog;
    }
    const form = this.page.locator('form').filter({ visible: true }).last();
    await expect(form).toBeVisible();
    return form;
  }

  async selectField(form, name, value) {
    const control = form.getByLabel(name, { exact: true });
    await expect(control).toBeVisible();
    if (await control.evaluate(element => element.tagName === 'SELECT')) {
      await control.selectOption({ label: value });
    } else {
      await control.click();
      await this.page.getByRole('option', { name: value, exact: true }).click();
    }
  }

  async fillFields(form, data) {
    for (const [name, value] of Object.entries(data)) {
      await form.getByLabel(name, { exact: true }).fill(String(value));
    }
  }

  async savePopup(form, identity) {
    await form.getByRole('button', { name: /^(Save|Add|Update)$/ }).click();
    await expect(form).toBeHidden();
    await expect(this.row(identity)).toBeVisible();
  }

  async addCategory(name) {
    await this.selectStep('Material Category');
    const form = await this.openPopup();
    await this.fillFields(form, { 'Category Name': name });
    await this.savePopup(form, name);
  }

  async addMaterial({ category, name, uom, packagingUnit, multiplier }) {
    await this.selectStep('Materials');
    const form = await this.openPopup();
    await this.selectField(form, 'Category', category);
    await this.selectField(form, 'Unit of Measure', uom);
    await this.fillFields(form, { 'Material Name': name, 'Packaging Unit': packagingUnit,
      'Conversion Multiplier': multiplier });
    await this.savePopup(form, name);
  }

  async addSupplier(data) {
    await this.selectStep('Suppliers');
    const form = await this.openPopup();
    await this.fillFields(form, data);
    await this.savePopup(form, data['Supplier Name']);
  }

  async addMapping(supplier, material, weeks) {
    await this.selectStep('Suppliers->Materials');
    const form = await this.openPopup();
    await this.selectField(form, 'Supplier', supplier);
    await this.selectField(form, 'Material', material);
    await this.fillFields(form, { 'Lead Time in Weeks': weeks });
    await this.savePopup(form, supplier);
    await expect(this.row(supplier)).toContainText(material);
  }

  async rejectInvalidField(form, name, value) {
    await form.getByLabel(name, { exact: true }).fill(value);
    await form.getByRole('button', { name: /^(Save|Add|Update)$/ }).click();
    await expect(form, `${name} must not be saved with invalid input`).toBeVisible();
    const field = form.getByLabel(name, { exact: true });
    await expect.poll(async () => (
      await field.evaluate(element => Boolean(element.validity && !element.validity.valid)) ||
      await form.getByRole('alert').isVisible().catch(() => false) ||
      await form.getByText(/invalid|must be|positive|valid email|valid phone|integer/i).first().isVisible().catch(() => false)
    ), { message: `${name} should display a validation error` }).toBe(true);
  }
}

module.exports = { ProjectSetupWizardPage, STEPS };
