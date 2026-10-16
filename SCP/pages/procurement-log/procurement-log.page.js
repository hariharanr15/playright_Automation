const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');

class ProcurementLogPage extends BasePage {
  constructor(page) {
    super(page);
    this.navigation = page.getByRole('button', { name: 'Procurement Log', exact: true });
    this.addSubmittalButton = page.getByRole('button', { name: 'Add Submittal', exact: true });
    this.logDeliveryButton = page.getByRole('button', { name: '+ Log Delivery', exact: true });
  }

  async open() {
    await this.clickFirstVisible([
      { locator: this.navigation, label: 'Procurement Log' }
    ], 'Procurement Log', 20000);
    await expect(this.addSubmittalButton).toBeVisible({ timeout: 30000 });
  }

  submittalRow(submittalNumber) {
    return this.page.getByRole('row').filter({ hasText: submittalNumber }).first();
  }

  async assignResponsible(submittalNumber, identity, { eligible = [], excluded = [] } = {}) {
    const row = this.submittalRow(submittalNumber);
    await row.getByRole('button', { name: /assign responsible/i }).click();
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const dropdown = dialog.getByRole('combobox');
    const native = await dropdown.evaluate(element => element.tagName === 'SELECT');
    if (!native) await dropdown.click();
    const options = native ? dropdown.locator('option') : this.page.getByRole('option');
    const names = await options.allTextContents();
    for (const member of [...eligible, identity]) {
      expect(names.some(name => name.includes(member)), `${member} must be selectable as Responsible`).toBe(true);
    }
    for (const member of excluded) {
      expect(names.some(name => name.includes(member)), `${member} must not be selectable as Responsible`).toBe(false);
    }
    const matches = names.filter(name => name.includes(identity));
    expect(matches).toHaveLength(1);
    if (native) await dropdown.selectOption({ label: matches[0].trim() });
    else await this.page.getByRole('option', { name: matches[0].trim(), exact: true }).click();
    await dialog.getByRole('button', { name: /^(Assign|Save|Confirm)$/i }).click();
    await expect(dialog).toBeHidden();
    await expect(row).toContainText(identity);
  }

  async expectSubmittal(submittalNumber) {
    const row = this.submittalRow(submittalNumber);
    if (!(await row.isVisible().catch(() => false))) {
      const search = this.page.locator('input[placeholder^="Search submittals"]').first();
      await search.waitFor({ state: 'visible', timeout: 30000 });
      await search.fill(submittalNumber);
      await search.press('Enter');
    }
    await expect(row, `Procurement submittal ${submittalNumber} should be displayed`)
      .toBeVisible({ timeout: 30000 });
  }

  async createSubmittal(data) {
    await this.clickFirstVisible([
      { locator: this.addSubmittalButton, label: 'Add Submittal' }
    ], 'Add Submittal', 10000);

    const textboxes = this.page.getByRole('textbox');
    await this.fillVisible(textboxes.nth(3), data.specificationNumber, 'Specification number');
    await this.fillVisible(textboxes.nth(4), data.description, 'Specification description');
    await this.fillVisible(textboxes.nth(5), data.scheduleNumber, 'Schedule number');

    const submittalField = this.page.locator('div:nth-child(7) > div > .flex-grow > .mt-4:visible').last();
    await this.fillVisible(submittalField, data.submittalNumber, 'Submittal number');

    await this.selectDropdownOption(
      this.page.getByRole('button', { name: 'Choose Suppliers', exact: true }),
      data.supplier,
      'Supplier'
    );
    await this.selectDropdownOption(
      this.page.getByRole('button', { name: 'Choose Materials', exact: true }),
      data.material,
      'Material'
    );

    const numericFields = this.page.getByRole('spinbutton');
    if (await numericFields.count() >= 2) {
      await this.fillVisible(numericFields.nth(1), data.lotQuantity, 'Lot quantity');
      await this.fillVisible(numericFields.first(), data.leadTime, 'Lead time');
    }

    await this.clickFirstVisible([
      { locator: this.page.getByRole('button', { name: 'Add', exact: true }), label: 'Add submittal' }
    ], 'Add submittal', 10000);
    await this.expectSubmittal(data.submittalNumber);
  }

  async addComponent(data) {
    const row = this.submittalRow(data.submittalNumber);
    await expect(row).toBeVisible({ timeout: 30000 });
    await this.clickFirstVisible([
      { locator: row.getByRole('cell', { name: data.supplier }).first(), label: data.supplier },
      { locator: row, label: data.submittalNumber }
    ], `Open ${data.submittalNumber}`, 10000);

    const addComponentButton = this.page.getByRole('button', { name: 'Add Component', exact: true }).last();
    await addComponentButton.waitFor({ state: 'visible', timeout: 30000 });
    await this.clickFirstVisible([
      { locator: addComponentButton, label: 'Add Component' }
    ], 'Add Component', 10000);

    await this.page.getByRole('heading', { name: 'Add Component', exact: true })
      .waitFor({ state: 'visible', timeout: 30000 });
    await this.chooseCalendarDate(this.page.getByRole('textbox').nth(3), 0, 'Component date');
    const numericFields = this.page.getByRole('spinbutton');
    await this.fillVisible(numericFields.first(), data.componentQuantity, 'Component quantity');
    await this.fillVisible(numericFields.nth(1), data.componentValue, 'Component value');
    await this.clickFirstVisible([
      { locator: this.page.getByRole('button', { name: 'ADD', exact: true }), label: 'Add component' }
    ], 'Add component', 10000);

    const escapedItem = String(data.componentItem).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const componentRow = this.page.getByRole('row')
      .filter({ hasText: new RegExp(escapedItem, 'i') })
      .filter({ has: this.page.getByRole('button', { name: 'Delivery', exact: true }) })
      .last();
    await expect(componentRow, `Component ${data.componentItem} should be added`).toBeVisible({ timeout: 30000 });
    await this.closeTopOverlay();
  }

  async logDelivery(data) {
    const submittalRow = this.submittalRow(data.submittalNumber);
    await submittalRow.waitFor({ state: 'visible', timeout: 30000 });
    await this.clickFirstVisible([
      { locator: submittalRow, label: data.submittalNumber }
    ], `Open ${data.submittalNumber}`, 20000);

    await this.page.getByRole('button', { name: 'Add Component', exact: true }).last()
      .waitFor({ state: 'visible', timeout: 30000 });
    const escapedItem = String(data.componentItem).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const componentRow = this.page.getByRole('row')
      .filter({ hasText: new RegExp(escapedItem, 'i') })
      .filter({ has: this.page.getByRole('button', { name: 'Delivery', exact: true }) })
      .last();
    await componentRow.waitFor({ state: 'visible', timeout: 30000 });
    const componentCell = componentRow.getByRole('cell').filter({ hasText: new RegExp(escapedItem, 'i') }).first();
    await this.clickFirstVisible([
      { locator: componentCell, label: data.componentItem }
    ], `Open component ${data.componentItem}`, 10000);

    const logDeliveryButton = this.logDeliveryButton.last();
    await logDeliveryButton.waitFor({ state: 'visible', timeout: 30000 });
    await this.clickFirstVisible([
      { locator: logDeliveryButton, label: 'Log Delivery' }
    ], 'Log Delivery', 10000);
    const deliveryHeading = this.page.getByRole('heading', { name: 'Add Delivery', exact: true });
    await deliveryHeading.waitFor({ state: 'visible', timeout: 30000 });
    const deliveryModal = deliveryHeading.locator(
      'xpath=ancestor::div[.//button[normalize-space()="Add"]][1]'
    );
    const deliveryDates = deliveryModal.getByRole('textbox');
    if (!(await deliveryDates.first().inputValue()).trim()) {
      await this.chooseCalendarDate(deliveryDates.first(), 0, 'Expected delivery date');
    }
    await expect(deliveryDates.nth(1), 'Actual delivery date must remain blank during delivery creation')
      .toHaveValue('');

    await this.selectDropdownFromCandidates(
      ['All Locations', 'Choose Location'],
      data.deliveryLocation,
      'Delivery location',
      deliveryModal
    );
    const deliveryItem = await this.selectFirstDropdownOption(
      deliveryModal.getByRole('button', { name: 'Choose Item Name', exact: true }),
      'Delivery item'
    );
    await this.fillVisible(deliveryModal.getByRole('spinbutton').first(), data.deliveryQuantity, 'Delivery quantity');
    await this.clickFirstVisible([
      { locator: deliveryModal.getByRole('button', { name: 'Add', exact: true }), label: 'Add delivery' }
    ], 'Add delivery', 10000);
    await expect(deliveryHeading, 'Delivery should be saved before continuing').toBeHidden({ timeout: 30000 });
    const savedDelivery = this.page.getByRole('row')
      .filter({ hasText: data.deliveryLocation })
      .filter({ hasText: deliveryItem })
      .filter({ hasText: data.deliveryQuantity })
      .last();
    await expect(
      savedDelivery,
      `Delivery for ${data.componentItem} should be listed before the pre-shipping checklist`
    ).toBeVisible({ timeout: 30000 });
    return { item: deliveryItem };
  }

  async orderComponent(data) {
    const submittalRow = this.submittalRow(data.submittalNumber);
    await submittalRow.waitFor({ state: 'visible', timeout: 30000 });
    await this.clickFirstVisible([
      { locator: submittalRow, label: data.submittalNumber }
    ], `Open ${data.submittalNumber}`, 20000);

    const escapedItem = String(data.componentItem).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const componentRow = this.page.getByRole('row')
      .filter({ hasText: new RegExp(escapedItem, 'i') })
      .filter({ has: this.page.getByRole('button', { name: 'Order', exact: true }) })
      .last();
    await expect(componentRow, `Component ${data.componentItem} should be available to order`)
      .toBeVisible({ timeout: 30000 });
    await componentRow.getByRole('button', { name: 'Order', exact: true }).click();

    const editHeading = this.page.getByRole('heading', { name: 'Edit Component', exact: true });
    await expect(editHeading, 'Ordering a component should open its PO details').toBeVisible({ timeout: 30000 });
    const editModal = editHeading.locator(
      'xpath=ancestor::div[.//button[normalize-space()="Update"]][1]'
    );
    const poNumber = data.purchaseOrderNumber || `PO-${data.scheduleNumber}`;
    const poNumberInput = editModal.getByText('PO no.', { exact: true })
      .locator('xpath=..').getByRole('textbox');
    await this.fillVisible(poNumberInput, poNumber, 'PO number');

    const poDateInput = editModal.getByText('PO Date', { exact: true })
      .locator('xpath=..').getByRole('textbox');
    await this.chooseCalendarDate(poDateInput, 0, 'PO date');
    await editModal.getByRole('button', { name: 'Update', exact: true }).click();
    await expect(editHeading, 'PO details should be saved before delivery logging')
      .toBeHidden({ timeout: 30000 });

    await expect.poll(async () => {
      const text = await componentRow.innerText().catch(() => '');
      const orderVisible = await componentRow.getByRole('button', { name: 'Order', exact: true })
        .isVisible().catch(() => false);
      return !/Not Ordered/i.test(text) || !orderVisible;
    }, {
      message: `Component ${data.componentItem} should be ordered before delivery logging`,
      timeout: 30000
    }).toBe(true);
    await this.closeTopOverlay();
  }

  async completePreShippingChecklist(data) {
    await this.clickImageAction('Pre Shipping Info', 1);
    const heading = this.page.getByRole('heading', { name: 'Add Pre-Shipping Details', exact: true });
    await expect(heading).toBeVisible({ timeout: 30000 });
    const modal = heading.locator(
      'xpath=ancestor::div[.//button[normalize-space()="Confirm Checklist"]][1]'
    );
    const questionInputs = modal.locator(
      'input:visible:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])'
    );
    const questionCount = await questionInputs.count();
    expect(questionCount, 'Pre-Shipping checklist should contain at least one question input').toBeGreaterThan(0);
    for (let index = 0; index < questionCount; index += 1) {
      const value = data.preShipping.textValues[index] ?? data.preShipping.booleanValue;
      await this.fillVisible(questionInputs.nth(index), value, `Pre-shipping value ${index + 1}`);
    }

    await this.answerAllYesNoQuestions();
    await this.fillVisible(modal.locator('textarea:visible').first(), data.preShipping.supplierNote, 'Supplier note');
    await this.clickFirstVisible([
      { locator: modal.getByRole('button', { name: 'Confirm Checklist', exact: true }), label: 'Confirm Checklist' }
    ], 'Confirm Checklist', 10000);
    await expect(heading, 'Pre-Shipping checklist modal should close after confirmation')
      .toBeHidden({ timeout: 30000 });
  }

  async approvePreShippingChecklist(data) {
    await this.clickImageAction('Approve Pre-Shipping Checklist');
    await this.fillVisible(this.page.locator('textarea:visible').last(), data.preShipping.approverNote, 'Approver note');
    await this.clickFirstVisible([
      { locator: this.page.getByRole('button', { name: 'Approve', exact: true }), label: 'Approve checklist' }
    ], 'Approve checklist', 10000);
  }

  async updateDeliveryDate(daysFromToday = 5) {
    await this.clickImageAction('Edit', 1);
    await this.chooseCalendarDate(this.page.getByRole('textbox').nth(4), daysFromToday, 'Updated delivery date');
    await this.clickFirstVisible([
      { locator: this.page.getByRole('button', { name: 'Update', exact: true }), label: 'Update delivery' }
    ], 'Update delivery', 10000);
  }

  async updateShippingInformation(data) {
    await this.clickImageAction('Update Shipping Info', 1);
    const heading = this.page.getByRole('heading', { name: 'Add Shipping Info', exact: true });
    await expect(heading).toBeVisible({ timeout: 30000 });
    const modal = heading.locator('xpath=ancestor::div[.//button[normalize-space()="Add"]][1]');
    const shippingMode = modal.getByRole('button', { name: 'Choose Shipping Mode', exact: true });
    await shippingMode.waitFor({ state: 'visible', timeout: 30000 });
    await this.selectDropdownOption(
      shippingMode,
      data.shippingMode,
      'Shipping mode'
    );
    const shippingReference = modal.getByText('Shipping Reference Number', { exact: true })
      .locator('xpath=..').getByRole('textbox');
    await this.fillVisible(shippingReference, data.shippingReference, 'Shipping reference');
    await this.clickFirstVisible([
      { locator: modal.getByRole('button', { name: 'Add', exact: true }), label: 'Add shipping information' }
    ], 'Add shipping information', 10000);
    await expect(heading, 'Shipping information should be saved').toBeHidden({ timeout: 30000 });
  }

  async addDeliveryConditions(data) {
    await this.clickImageAction('Update Delivery Condition', 1);
    for (const condition of data.deliveryConditions) {
      await this.fillVisible(this.page.getByRole('spinbutton').first(), condition, 'Delivery condition');
      await this.clickFirstVisible([
        { locator: this.page.getByRole('button', { name: 'Add', exact: true }), label: 'Add delivery condition' }
      ], 'Add delivery condition', 10000);
    }
  }

  async generateGrn() {
    await this.clickImageAction('Generate GRN', 1);
  }

  async answerAllYesNoQuestions() {
    const unansweredButtons = this.page.getByRole('button', { name: 'Y/N', exact: true });
    const questionCount = await unansweredButtons.count();
    for (let answered = 0; answered < questionCount; answered += 1) {
      await this.clickFirstVisible([
        { locator: unansweredButtons.first(), label: 'Y/N' }
      ], 'Y/N', 5000);
      await this.clickFirstVisible([
        { locator: this.page.getByRole('option', { name: 'YES', exact: true }), label: 'YES' }
      ], 'YES', 5000);
    }
    await expect(unansweredButtons, 'Every Pre-Shipping Y/N question should be answered').toHaveCount(0);
    return questionCount;
  }

  async selectDropdownFromCandidates(triggerNames, optionName, label, scope = this.page) {
    const triggers = triggerNames.map((name) => ({
      locator: scope.getByRole('button', { name, exact: true }),
      label: name
    }));
    const trigger = await this.firstVisible(triggers, 3000);
    if (!trigger) {
      throw new Error(`${label} dropdown was not visible. Current URL: ${this.page.url()}`);
    }
    await this.selectDropdownOption(trigger.locator, optionName, label);
  }

  async clickImageAction(name, preferredIndex = 0) {
    const images = this.page.getByRole('img', { name });
    const candidates = preferredIndex > 0
      ? [
          { locator: images.nth(preferredIndex), label: name },
          { locator: images.first(), label: name }
        ]
      : [{ locator: images.first(), label: name }];
    const image = await this.firstVisible(candidates, 5000);
    if (!image) {
      throw new Error(`${name} action was not visible. Current URL: ${this.page.url()}`);
    }
    await this.clickFirstVisible([image], name, 5000);
  }

  async closeTopOverlay() {
    const backdrop = this.page.locator(
      'div.fixed.inset-0.bg-bgGrey.bg-opacity-50.backdrop-blur-md:visible'
    ).last();
    await backdrop.waitFor({ state: 'visible', timeout: 10000 });
    await this.page.keyboard.press('Escape');
    if (await backdrop.isVisible().catch(() => false)) {
      const overlayButtons = this.page.locator('div.fixed.inset-0[class*="z-[100]"]:visible button:visible');
      const buttonCount = await overlayButtons.count();
      let leftEdgeButton;
      for (let index = 0; index < buttonCount; index += 1) {
        const candidate = overlayButtons.nth(index);
        const box = await candidate.boundingBox();
        if (box && box.x < 330) {
          leftEdgeButton = candidate;
          break;
        }
      }
      if (leftEdgeButton) {
        await leftEdgeButton.click({ force: true });
      } else {
        await backdrop.click({ position: { x: 10, y: 10 }, force: true });
      }
    }
    await backdrop.waitFor({ state: 'hidden', timeout: 30000 });
    await this.waitForReady();
  }

  async chooseCalendarDate(field, daysFromToday, label) {
    await field.waitFor({ state: 'visible', timeout: 30000 });
    await this.clickFirstVisible([{ locator: field, label }], label, 10000);
    const date = new Date();
    date.setDate(date.getDate() + daysFromToday);
    const month = date.toLocaleString('en-US', { month: 'long' });
    const calendarDay = this.page.getByRole('button', {
      name: new RegExp(`^${month} ${date.getDate()},`, 'i')
    });
    if (!(await calendarDay.first().isVisible({ timeout: 1000 }).catch(() => false))) {
      const calendarIcon = field.locator('xpath=..').locator('svg').first();
      if (await calendarIcon.isVisible().catch(() => false)) await calendarIcon.click();
    }
    if (await calendarDay.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickFirstVisible([
        { locator: calendarDay, label: `${month} ${date.getDate()}` }
      ], label, 10000);
      return;
    }

    const pad = (value) => String(value).padStart(2, '0');
    const isoDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const displayDate = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
    const value = await field.getAttribute('type') === 'date' ? isoDate : displayDate;
    await field.fill(value).catch(async () => {
      await field.evaluate((element, nextValue) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(element, nextValue);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }, value);
    });
    await expect(field, `${label} should be populated`).not.toHaveValue('');
  }
}

module.exports = { ProcurementLogPage };
