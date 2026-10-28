const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');
const { isHeadless } = require('../../utils/execution-mode');

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

  // Explicit Search for Inventory integration; existing callers retain their behavior.
  async searchExactSubmittal(submittalNumber) {
    const search = this.page.locator('input[placeholder^="Search submittals"]');
    await expect(search).toHaveCount(1);
    if (await search.inputValue()) {
      const cleared = this.page.waitForResponse(response => response.request().method() === 'GET' &&
        new URL(response.url()).pathname.includes('/submittal_master/list_submittals_by_project_id') &&
        !new URL(response.url()).searchParams.get('search'));
      await search.fill('');
      expect((await cleared).ok(), 'Clearing Procurement Search must refresh its results').toBe(true);
    }
    const loaded = this.page.waitForResponse(response => response.request().method() === 'GET' &&
      new URL(response.url()).pathname.startsWith('/api/') &&
      [...new URL(response.url()).searchParams.values()].some(value => value === submittalNumber));
    await search.fill(submittalNumber);
    await search.press('Enter');
    const response = await loaded;
    expect(response.ok(), 'Filtered Procurement request must succeed').toBe(true);
    await response.finished();
    await expect(search).toHaveValue(submittalNumber);
    const row = this.page.getByRole('row').filter({ has: this.page.getByRole('cell', { name: submittalNumber, exact: true }) });
    await expect(row, 'Procurement Search must return one exact submittal').toHaveCount(1);
    await expect(row).toBeVisible();
    await expect(this.page.locator('main table tbody tr').filter({ has: this.page.locator('td:nth-child(2)') })).toHaveCount(1);
    return row;
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
    const submittalField = this.page.locator('div:nth-child(7) > div > .flex-grow > .mt-4:visible').last();
    const fillIdentity = async () => {
      await this.fillVisible(textboxes.nth(3), data.specificationNumber, 'Specification number');
      await this.fillVisible(textboxes.nth(4), data.description, 'Specification description');
      await this.fillVisible(textboxes.nth(5), data.scheduleNumber, 'Schedule number');
      await this.fillVisible(submittalField, data.submittalNumber, 'Submittal number');
    };
    await fillIdentity();

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

    // A 409 means the number already exists and nothing was saved: the same form is resubmitted with the
    // run's next identity. The data object is updated in place so later steps use the saved number.
    const { createProcurementLogData } = require('../../utils/dynamic-data');
    for (let attempt = 1; ; attempt += 1) {
      const saved = this.page.waitForResponse(response => response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/submittal_master/', { timeout: 30000 });
      await this.clickFirstVisible([
        { locator: this.page.getByRole('button', { name: 'Add', exact: true }), label: 'Add submittal' }
      ], 'Add submittal', 10000);
      const response = await saved;
      if (response.ok()) break;
      const body = await response.json().catch(() => ({}));
      const message = body.message || JSON.stringify(body.error || {});
      if (response.status() !== 409 || !data.procurementRunId || attempt >= 25) {
        throw new Error(`Submittal ${data.submittalNumber} was not saved (HTTP ${response.status()}): ${message}`);
      }
      const skipped = data.submittalNumber;
      Object.assign(data, createProcurementLogData(data.procurementRunId, data.procurementVariant + 1));
      const note = `${skipped} already exists; using ${data.submittalNumber}`;
      // Cucumber runs outside the Playwright runner, where test.info() is unavailable.
      try { require('@playwright/test').test.info().annotations.push({ type: 'procurement-number', description: note }); }
      catch { process.stderr.write(`[procurement] ${note}\n`); }
      await fillIdentity();
    }
    await expect(this.page.getByRole('heading', { name: 'Add Submittal', exact: true }), 'Add Submittal closes after a saved submittal')
      .toBeHidden({ timeout: 30000 });
    await this.expectSubmittal(data.submittalNumber);
  }

  // A component row in the open submittal's Details panel, identified by its exact material.
  componentRow(materialName) {
    return this.page.getByRole('row')
      .filter({ has: this.page.getByRole('checkbox', { name: 'Select this component' }) })
      .filter({ has: this.page.getByRole('cell', { name: materialName, exact: true }) });
  }

  async addComponent(data) {
    const row = this.submittalRow(data.submittalNumber);
    await expect(row).toBeVisible({ timeout: 30000 });
    await this.clickFirstVisible([
      ...(data.inventorySetup
        ? [{ locator: row.getByRole('cell', { name: data.specificationNumber, exact: true }), label: data.specificationNumber }]
        : [{ locator: row.getByRole('cell', { name: data.supplier }).first(), label: data.supplier }]),
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
    // Component rows have no Delivery button; a delivery is created from the component opened by clicking its row.
    const componentRow = this.page.getByRole('row')
      .filter({ has: this.page.getByRole('checkbox', { name: 'Select this component' }) })
      .filter({ hasText: new RegExp(escapedItem, 'i') })
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
    // Component rows have no Delivery button; a delivery is created from the component opened by clicking its row.
    const componentRow = this.page.getByRole('row')
      .filter({ has: this.page.getByRole('checkbox', { name: 'Select this component' }) })
      .filter({ hasText: new RegExp(escapedItem, 'i') })
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
    const itemTrigger = deliveryModal.getByRole('button', { name: 'Choose Item Name', exact: true });
    const deliveryItem = data.exactDeliveryItem
      ? (await this.selectDropdownOption(itemTrigger, data.exactDeliveryItem, 'Delivery item'), data.exactDeliveryItem)
      : await this.selectFirstDropdownOption(itemTrigger, 'Delivery item');
    await this.fillVisible(deliveryModal.getByRole('spinbutton').first(), data.deliveryQuantity, 'Delivery quantity');
    const savedRequest = data.dynamicChecklist ? this.page.waitForResponse(response =>
      response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/schedule_delivery/add_schedule_delivery/') : null;
    savedRequest?.catch(() => {});
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
    let record;
    if (savedRequest) {
      const response = await savedRequest;
      expect(response.ok(), 'Delivery creation must succeed').toBe(true);
      record = (await response.json()).data;
      expect(record.schedule_delivery_id).toBeTruthy();
      expect(Number(record.quantity)).toBe(Number(data.deliveryQuantity));
    }
    return { item: deliveryItem, record };
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
      const input = questionInputs.nth(index);
      const type = await input.getAttribute('type');
      if (data.dynamicChecklist && (type === 'date' || type === 'datetime-local' || await input.getAttribute('readonly') !== null)) {
        if (type === 'date') await input.fill(new Date().toISOString().slice(0, 10));
        else await this.chooseCalendarDate(input, 0, `Pre-shipping date ${index + 1}`);
        continue;
      }
      const value = data.dynamicChecklist ? String(data.quantity) : data.preShipping.textValues[index] ?? data.preShipping.booleanValue;
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
    if (data.dynamicChecklist && !data.shippingMode) {
      data.shippingMode = await this.selectFirstDropdownOption(shippingMode, 'Shipping mode');
    } else await this.selectDropdownOption(
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
    if (data.dynamicChecklist) {
      const heading = this.page.getByRole('heading', { name: 'Add Delivery Conditions', exact: true });
      const modal = heading.locator('xpath=ancestor::div[.//button[normalize-space()="Add"]][1]');
      for (const [label, value] of [['Good', data.deliveryQuantity], ['Damage', '0'], ['Shortage', '0']]) {
        const input = modal.getByText(label, { exact: true }).locator('..').getByRole('spinbutton');
        await expect(input).toHaveCount(1);
        if (await input.isEditable()) await input.fill(String(value));
        else await expect(input, `${label} must reconcile with the full delivery quantity`).toHaveValue(String(value));
      }
      await modal.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(heading, 'Delivery conditions must be saved before generating the GRN').toBeHidden();
      return;
    }
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

  async openOwnedDelivery(data) {
    await this.page.goto(new URL('/procurement-log', this.page.url()).href, { waitUntil: 'domcontentloaded' });
    await expect(this.addSubmittalButton).toBeVisible();
    await this.restoreOwnedContext(data);
    const row = await this.searchExactSubmittal(data.submittalNumber);
    await row.getByRole('cell', { name: data.specificationNumber, exact: true }).click();
    // Clicking anywhere on the component row opens it with its deliveries and the + Log Delivery action.
    const component = this.componentRow(data.material);
    await expect(component).toHaveCount(1);
    await component.getByRole('cell', { name: data.material, exact: true }).click();
    await expect(this.logDeliveryButton.last(), 'Opened component offers + Log Delivery').toBeVisible({ timeout: 30000 });
    this.deliveryActionScope = this.logDeliveryButton.last().locator('xpath=ancestor::div[.//table][1]').getByRole('row')
      .filter({ has: this.page.getByRole('cell', { name: data.exactDeliveryItem, exact: true }) })
      .filter({ hasText: data.deliveryLocation });
    await expect(this.deliveryActionScope).toHaveCount(1);
  }

  async restoreOwnedContext(data) {
    if (data.ownerProject) {
      const { ProjectSelectorPage } = require('../project-selector.page');
      await new ProjectSelectorPage(this.page, { projectName: data.ownerProject }).expectActiveProject(data.ownerProject);
    }
    if (data.ownerSite) {
      const { SiteSelectorPage } = require('../site-selector.page');
      const selector = new SiteSelectorPage(this.page);
      await selector.ensureSite(data.ownerSite);
      expect(await selector.activeSiteName(), 'Delivery must retain its owned site before any update').toBe(data.ownerSite);
    }
  }

  async completeOwnedDelivery(data, info, sources) {
    const { currentJournal, managedStep } = require('../../utils/scp-step');
    const { complete, missing } = require('../../utils/inventory-recovery');
    const journal = currentJournal();
    const keys = ['order', 'log', 'checklist', 'approval', 'date', 'shipping', 'conditions', 'grn'];
    journal?.define(keys.map((key, index) => ({ id: `delivery-${key}`, name: `Delivery ${key}`,
      dependsOn: index ? [`delivery-${keys[index - 1]}`] : ['submittal'] })));
    let index = 0;
    const step = async (name, action, verify) => {
      const key = keys[index++];
      await managedStep(require('@playwright/test').test, this.page, name, async () => {
        const responses = [];
        const collect = response => {
          if (new URL(response.url()).origin === new URL(this.page.url()).origin &&
              !['GET', 'HEAD', 'OPTIONS'].includes(response.request().method())) responses.push(response);
        };
        this.page.on('response', collect);
        try {
          await action();
          for (const response of responses) {
            expect(response.ok(), `${name}: ${new URL(response.url()).pathname} must succeed`).toBe(true);
            if ((response.headers()['content-type'] || '').includes('application/json')) {
              const body = await response.json();
              const status = body.status_code ?? body.statuscode;
              if (status !== undefined) {
                expect(Number(status), `${name}: successful application response`).toBeGreaterThanOrEqual(200);
                expect(Number(status)).toBeLessThan(300);
              }
            }
          }
        } finally { this.page.off('response', collect); }
        await info.attach(name, { body: await this.page.screenshot({ fullPage: isHeadless() }), contentType: 'image/png' });
      }, { id: `delivery-${key}`, dependsOn: journal ? key === 'order' ? ['submittal'] : [`delivery-${keys[index - 2]}`] : [],
        mutation: true, verify: sources ? verify : undefined,
        expected: `${name} is persisted for the exact generated component and delivery` });
    };
    const liveDelivery = async () => sources.delivery();
    await step('Delivery: order the exact created component', async () => {
      await this.page.goto(new URL('/procurement-log', this.page.url()).href, { waitUntil: 'domcontentloaded' });
      await this.searchExactSubmittal(data.submittalNumber);
      await this.orderComponent(data);
    }, async () => {
      const component = await sources.component();
      if (!component.po_number) return missing();
      expect(component.po_number).toBe(data.purchaseOrderNumber); return complete(component);
    });
    await step('Delivery: log the same material, supplier, location and quantity', async () => {
      await this.page.goto(new URL('/procurement-log', this.page.url()).href, { waitUntil: 'domcontentloaded' });
      await this.restoreOwnedContext(data);
      await this.searchExactSubmittal(data.submittalNumber);
      const saved = await this.logDelivery(data);
      expect(saved.item).toBe(data.exactDeliveryItem);
      data.deliveryRecord = saved.record;
      const deliveryPanel = this.logDeliveryButton.last().locator('xpath=ancestor::div[.//table][1]');
      this.deliveryActionScope = deliveryPanel.getByRole('row')
        .filter({ has: this.page.getByRole('cell', { name: saved.item, exact: true }) })
        .filter({ hasText: data.deliveryLocation });
      await expect(this.deliveryActionScope, 'Exactly one delivery for the generated item and location').toHaveCount(1);
    }, async () => { const delivery = await liveDelivery(); return delivery ? complete(delivery) : missing(); });
    try {
      await step('Delivery: complete mandatory pre-shipping checklist', async () => {
        await this.openOwnedDelivery(data); await this.completePreShippingChecklist(data);
      }, async () => {
        const delivery = await liveDelivery();
        return delivery.pre_shipping_checklist_status === 'approved' || delivery.supplier_comment === data.preShipping.supplierNote ? complete(delivery) : missing();
      });
      await step('Delivery: approve the pre-shipping checklist', async () => {
        await this.openOwnedDelivery(data);
        await this.approvePreShippingChecklist(data);
        await expect(this.page.getByRole('button', { name: 'Approve', exact: true })).toBeHidden();
      }, async () => { const delivery = await liveDelivery(); return delivery.pre_shipping_checklist_status === 'approved' ? complete(delivery) : missing(); });
      await step('Delivery: save actual delivery date', async () => {
        await this.openOwnedDelivery(data);
        const { currentCalendarDate } = require('../../utils/calendar-date');
        const today = await currentCalendarDate(this.page);
        data.actualDeliveryDate ||= today;
        const offset = Math.round((Date.parse(data.actualDeliveryDate) - Date.parse(today)) / 86400000);
        await this.updateDeliveryDate(offset);
        await expect(this.page.getByRole('button', { name: 'Update', exact: true }), 'Actual delivery date must finish saving').toBeHidden();
      }, async () => {
        const delivery = await liveDelivery(); if (!delivery.actual_date_of_delivery) return missing();
        const iso = value => /^\d{2}-\d{2}-\d{4}$/.test(value) ? value.split('-').reverse().join('-') : value.slice(0, 10);
        const expected = data.actualDeliveryDate || iso(data.deliveryRecord.expected_date_of_delivery);
        expect(iso(delivery.actual_date_of_delivery)).toBe(expected); data.actualDeliveryDate = expected; return complete(delivery);
      });
      await step('Delivery: save shipping information using an available mode', async () => {
        await this.openOwnedDelivery(data); await this.updateShippingInformation(data);
      }, async () => {
        const shipping = await sources.shipping(); if (!shipping?.shipping_id) return missing();
        expect(shipping.shipping_ref).toBe(data.shippingReference);
        const modes = (await sources.ctx.read('utils/get_utils_by_type/', { type: 'shipping_mode' })).data;
        const mode = modes.filter(record => record.util_id === shipping.shipping_mode);
        // The API uses enum names (vc_booking_system); the UI renders their spaced labels.
        const modeLabel = value => value.trim().toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ');
        expect(mode).toHaveLength(1); expect(modeLabel(mode[0].name)).toBe(modeLabel(data.shippingMode));
        return complete(shipping);
      });
      await step('Delivery: save delivery conditions', async () => {
        await this.openOwnedDelivery(data); await this.addDeliveryConditions(data);
      }, async () => {
        const conditions = await sources.conditions(); if (!conditions?.condition_at_delivery_id) return missing();
        expect(Number(conditions.good)).toBe(Number(data.deliveryQuantity));
        expect(Number(conditions.damage)).toBe(0); expect(Number(conditions.shortage)).toBe(0);
        return complete(conditions);
      });
      await step('Delivery: generate and validate the GRN for the exact saved delivery', async () => {
        await this.openOwnedDelivery(data);
        const pending = this.page.waitForResponse(response => response.request().method() === 'POST' &&
          new URL(response.url()).pathname === '/api/shipping_details/generate_grn_pdf/');
        pending.catch(() => {});
        await this.generateGrn();
        const response = await pending;
        expect(response.status()).toBe(201);
        const grn = (await response.json()).data;
        expect(grn.file_name).toBe(`GRN_${data.deliveryRecord.schedule_delivery_id}.pdf`);
        expect(grn.folder_name.endsWith(`/${data.deliveryRecord.submittal_schedule}/${data.deliveryRecord.schedule_delivery_id}/`)).toBe(true);
        expect(Number(grn.file_size), 'Generated GRN must not be empty').toBeGreaterThan(0);
        data.grn = grn;
        await info.attach('generated-grn-source', { body: Buffer.from(JSON.stringify(grn)), contentType: 'application/json' });
      }, async () => {
        if (!data.grn) {
          if (journal?.runningStep?.mutationObserved || journal?.state.steps['delivery-grn']?.mutationObserved) {
            return { status: 'unknown', reason: 'GRN may already have been created; its saved metadata must be recovered before generating another file' };
          }
          return missing();
        }
        expect(data.grn.file_name).toBe(`GRN_${data.deliveryRecord.schedule_delivery_id}.pdf`);
        expect(Number(data.grn.file_size)).toBeGreaterThan(0); return complete(data.grn);
      });
    } finally { this.deliveryActionScope = null; }
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
    if (this.deliveryActionScope) {
      const image = this.deliveryActionScope.getByRole('img', { name, exact: true });
      await expect(image, `Exactly one ${name} action on the owned delivery`).toHaveCount(1);
      await image.click();
      await this.waitForReady();
      await this.pauseAfterOperation();
      return;
    }
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
    // A date in another month (e.g. today + 5 at month end) needs the calendar's month/year selects first.
    if (!(await calendarDay.first().isVisible({ timeout: 1000 }).catch(() => false))) {
      const calendar = this.page.locator('[data-date]').first().locator('xpath=ancestor::div[.//select][1]');
      if (await calendar.isVisible().catch(() => false)) {
        await calendar.locator('select').filter({ has: this.page.locator(`option[value="${date.getFullYear()}"]`) }).selectOption(String(date.getFullYear()));
        await calendar.locator('select').filter({ has: this.page.getByRole('option', { name: month, exact: true }) }).selectOption({ label: month });
      }
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
