const { clickHighlighted } = require('../../utils/highlight');

class EquipmentManagementPage {
  constructor(page) {
    this.page = page;
    this.equipmentManagementLink = page.getByRole('link', { name: /equipment_management|Equipment Management/i });
    this.equipmentListLink = page.getByRole('link', { name: /Equipment List/i });
    this.dateInputs = page.locator('input[placeholder="d, ddd mmm yyyy"], input[placeholder*="yyyy" i]');
    this.companyDropdown = page.getByRole('combobox').filter({ hasText: /Company/i });
    this.equipmentTypeDropdown = page.getByRole('combobox').filter({ hasText: /Equipment Type/i });
  }

  async waitForPageReady() {
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    await this.page
      .locator('[role="progressbar"], .MuiCircularProgress-root')
      .first()
      .waitFor({ state: 'hidden', timeout: 30000 })
      .catch(() => null);
    await this.page.waitForTimeout(1000);
  }

  async clickFirstVisible(candidates, label) {
    for (const locator of candidates) {
      if (await locator.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await clickHighlighted(locator.first(), label);
        return;
      }
    }

    throw new Error(`Could not find ${label}.`);
  }

  async openEquipmentManagement() {
    await clickHighlighted(this.equipmentManagementLink.first(), 'Equipment Management');
    await this.waitForPageReady();
  }

  async openEquipmentList() {
    await clickHighlighted(this.equipmentListLink.first(), 'Equipment List');
    await this.waitForPageReady();
  }

  async selectJanuary2026Day(inputIndex, day, label) {
    await clickHighlighted(this.dateInputs.nth(inputIndex), label);
    await this.clickFirstVisible([
      this.page.locator('.MuiPickersCalendarHeader-label'),
      this.page.getByText('April')
    ], 'Calendar Month');
    await clickHighlighted(this.page.getByRole('button', { name: 'Jan' }).first(), 'January');
    const yearButton = this.page.getByRole('button', { name: '2026', exact: true }).first();
    if (await yearButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await clickHighlighted(yearButton, '2026');
    }
    await clickHighlighted(this.page.getByRole('gridcell', { name: String(day), exact: true }).first(), `Jan ${day}`);
  }

  async selectJanuary2026DateRange() {
    await this.selectJanuary2026Day(0, 1, 'From Date');
    await this.selectJanuary2026Day(1, 31, 'To Date');
    await this.waitForPageReady();
  }

  async selectCompany(companyName = 'Voyage Control') {
    await clickHighlighted(this.companyDropdown.first(), 'Company');
    const preferredCompany = this.page.getByRole('option', { name: companyName }).first();

    if (await preferredCompany.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clickHighlighted(preferredCompany, companyName);
    } else {
      await clickHighlighted(
        this.page.locator('[role="option"]:not([aria-disabled="true"])').filter({ hasNotText: /^Company$/i }).first(),
        'First available company'
      );
    }

    await this.waitForPageReady();
  }

  async openEquipmentTypeDropdown() {
    await clickHighlighted(this.equipmentTypeDropdown.first(), 'Equipment Type');
    if (!(await this.page.locator('[role="listbox"]').isVisible({ timeout: 3000 }).catch(() => false))) {
      await clickHighlighted(this.equipmentTypeDropdown.first(), 'Equipment Type');
    }
    await this.page.locator('.MuiBackdrop-root').click({ timeout: 5000 }).catch(() => null);
    await this.waitForPageReady();
  }

  async applyRecordedEquipmentListFilters() {
    await this.openEquipmentList();
    await this.selectJanuary2026DateRange();
    await this.selectCompany();
    await this.openEquipmentTypeDropdown();
  }
}

module.exports = { EquipmentManagementPage };
