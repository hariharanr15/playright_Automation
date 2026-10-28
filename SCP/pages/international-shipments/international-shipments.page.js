const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');

class InternationalShipmentsPage extends BasePage {
  constructor(page) {
    super(page);
    this.navigation = page.getByRole('button', { name: /^International Shipments(?:\s+\d+\+?)?$/i });
  }

  async open() {
    await this.navigation.waitFor({ state: 'visible', timeout: 30000 });
    await this.clickFirstVisible([{ locator: this.navigation, label: 'International Shipments' }], 'International Shipments', 20000);
    await expect(this.page).toHaveURL(/\/international-shipments\/?$/);
    await expect(this.page.getByText('Loading international shipments...')).toBeHidden({ timeout: 45000 });
    await expect(this.page.getByRole('button', { name: '+ Log Shipment', exact: true })).toBeVisible();
  }

  row(submittalNumber) {
    return this.page.getByRole('row').filter({ hasText: submittalNumber }).first();
  }

  async totalCount() {
    const label = this.page.getByText('Total International', { exact: true });
    await expect(label).toBeVisible();
    const container = label.locator('..');
    const text = await container.innerText();
    const count = Number(text.match(/\b\d+\b/)?.[0]);
    if (!Number.isInteger(count)) throw new Error(`Unable to parse Total International KPI: ${text}`);
    return count;
  }

  async flagProcurementRecord(submittalNumber, country, city) {
    await this.page.getByRole('button', { name: 'Procurement Log', exact: true }).click();
    const { ProcurementLogPage } = require('../procurement-log/procurement-log.page');
    const row = await new ProcurementLogPage(this.page).searchExactSubmittal(submittalNumber);
    await expect(row).toBeVisible({ timeout: 30000 });
    // The menu handler is on the action icon, not the surrounding table cell.
    await row.locator('td').last().locator('svg, img').first().click();
    await this.page.getByText('Flag International', { exact: true }).click();
    const popup = this.page.locator('div.fixed.inset-0').filter({ hasText: 'Flag as International Shipment' }).last();
    await expect(popup).toContainText(`Submittal: ${submittalNumber}`);
    const manufacturerName = popup.getByPlaceholder('e.g. Guangdong Steel Co.');
    await expect(manufacturerName).not.toHaveValue('');
    const name = await manufacturerName.inputValue();
    await popup.getByPlaceholder('e.g. China').fill(country);
    await popup.getByPlaceholder('e.g. Shenzhen').fill(city);
    await popup.getByRole('button', { name: 'Flag', exact: true }).click();
    await expect(popup).toBeHidden({ timeout: 30000 });
    return { submittalNumber, manufacturerName: name, country, city };
  }

  async setStatus(submittalNumber, status) {
    const rows = this.page.getByRole('row').filter({ hasText: submittalNumber });
    const row = rows.first();
    await expect(row).toBeVisible({ timeout: 30000 });
    const countBefore = await rows.count();
    const select = row.locator('select').first();
    await select.selectOption({ label: status });
    const value = status.toLowerCase().replace(/ /g, '_');
    await expect(select).toHaveValue(value, { timeout: 30000 });
    await expect(rows, 'Status update must not add another row').toHaveCount(countBefore);
    await this.page.reload();
    await expect(this.row(submittalNumber)).toBeVisible({ timeout: 30000 });
    await expect(this.row(submittalNumber).locator('select').first()).toHaveValue(value, { timeout: 30000 });
    await expect(rows).toHaveCount(countBefore);
  }

  async openShipmentsTab() {
    await expect(this.page.getByText('Loading international shipments...')).toBeHidden({ timeout: 45000 });
    await this.page.getByRole('button', { name: /^Shipments(?:\s*\d+\+?)?$/i }).click();
    await expect(this.page.getByText('Add Shipment Details', { exact: false })).toBeVisible({ timeout: 30000 });
  }

  shipmentRow(container) {
    return this.page.getByRole('row').filter({ hasText: container }).first();
  }

  async editShippingInfo(container, reference) {
    const row = this.shipmentRow(container);
    await expect(row).toBeVisible({ timeout: 30000 });
    await row.getByRole('button', { name: 'Edit', exact: true }).click();
    const modal = this.page.locator('div.fixed.inset-0').filter({ hasText: 'Edit shipping details' }).last();
    await expect(modal).toBeVisible();
    const fields = modal.locator('input[type="text"]');
    await expect(fields.first()).toHaveValue(container);
    await fields.nth(1).fill(reference);
    await fields.nth(2).fill('Updated Automation Shipping Line');
    await modal.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(modal).toBeHidden({ timeout: 30000 });
    await this.openShipmentsTab();
    await expect(row).toContainText(reference);
    await expect(row).toContainText('Updated Automation Shipping Line');
    return reference;
  }

  async logShipment(record, runId) {
    await this.page.getByRole('button', { name: '+ Log Shipment', exact: true }).click();
    const modal = this.page.locator('div.fixed.inset-0').filter({ hasText: 'Log new shipment' }).last();
    await expect(modal).toBeVisible();
    const submittal = modal.locator('select').first();
    await expect(submittal).toBeEnabled({ timeout: 30000 });
    const option = submittal.locator('option').filter({ hasText: record.submittalNumber }).first();
    await expect(option, `Shipment form must offer ${record.submittalNumber}`).toBeAttached({ timeout: 30000 });
    await submittal.selectOption(await option.getAttribute('value'));
    const fields = modal.locator('input[type="text"]');
    await fields.nth(0).fill(record.manufacturerName);
    await fields.nth(1).fill(record.country);
    const container = `SCP-${runId}`;
    await fields.nth(2).fill(container);
    await fields.nth(3).fill(`BL-${runId}`);
    await fields.nth(4).fill('Automation Shipping Line');
    await fields.nth(5).fill('Automation Vessel');
    await fields.nth(6).fill(record.loadingPort || record.city);
    await fields.nth(7).fill(record.dischargePort || 'Chennai');
    await modal.getByRole('button', { name: 'Log shipment', exact: true }).click();
    await expect(modal).toBeHidden({ timeout: 30000 });
    return container;
  }
}

module.exports = { InternationalShipmentsPage };
