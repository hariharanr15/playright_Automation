const { expect } = require('@playwright/test');

class SupplierListPage {
  constructor(page) {
    this.page = page;
  }

  async open() {
    await this.page.getByRole('button', { name: 'User Management', exact: true }).first().click();
    await this.page.getByRole('button', { name: 'Supplier List', exact: true }).click();
    await expect(this.page).toHaveURL(/\/supplier-list\/?$/);
    await expect(this.page.getByRole('button', { name: /Add Supplier/i })).toBeVisible();
  }

  async create(supplier) {
    await this.page.getByRole('button', { name: /Add Supplier/i }).click();
    const fields = {
      supplierName: supplier.name,
      line1: 'First Main Road',
      line2: 'Grand Square',
      townCity: 'Chennai',
      stateRegion: 'Tamil Nadu',
      zipcode: '600001',
      country: 'India',
      contactPerson: supplier.contact,
      contactEmail: supplier.email,
      contactPhone: supplier.phone
    };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      for (const [name, value] of Object.entries(fields)) {
        const input = this.page.locator(`input[name="${name}"]`);
        if (await input.inputValue() !== value) await input.fill(value);
      }
      await this.page.getByRole('button', { name: 'Save', exact: true }).click();
      const returnedToList = await this.page.getByRole('button', { name: /Add Supplier/i })
        .waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
      if (returnedToList) break;
    }
    await expect(this.page.getByText(supplier.name, { exact: true }).first()).toBeVisible({ timeout: 30000 });
  }

  async openBulkMap() {
    await this.page.getByRole('button', { name: /Bulk Map Material to Supplier/i }).click();
    await expect(this.page.getByPlaceholder(/Filter by supplier name/)).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Map Suppliers to Materials' })).toBeVisible();
  }

  async mapMaterial(supplierName, materialName, leadTime = '1') {
    await this.openBulkMap();
    const supplierFilter = this.page.getByPlaceholder(/Filter by supplier name/);
    await supplierFilter.fill(supplierName);
    const supplierRow = this.page.getByRole('row').filter({ hasText: supplierName }).first();
    await expect(supplierRow, `Supplier ${supplierName} should be available for mapping`).toBeVisible({ timeout: 30000 });
    await supplierRow.locator('input[type=checkbox]').check();

    const materialFilter = this.page.getByPlaceholder(/Filter by material name/);
    if (await materialFilter.isVisible().catch(() => false)) await materialFilter.fill(materialName);
    const materialRow = this.page.getByRole('row').filter({ hasText: materialName }).first();
    await expect(materialRow, `Material ${materialName} should be available for mapping`).toBeVisible({ timeout: 30000 });
    await materialRow.locator('input[type=checkbox]').check();

    await this.page.getByRole('button', { name: 'Map Suppliers to Materials' }).click();
    await expect(this.page.getByRole('heading', { name: 'Default Lead Time' })).toBeVisible();
    await this.page.getByPlaceholder('e.g. 2 or 0.5').fill(leadTime);
    await this.page.getByRole('button', { name: 'Continue' }).click();
    await expect(this.page.getByRole('heading', { name: 'Default Lead Time' })).toBeHidden({ timeout: 30000 });

    const mapping = this.page.getByRole('row').filter({ hasText: supplierName }).filter({ hasText: materialName });
    await expect(mapping, `${materialName} should be staged for ${supplierName}`).toBeVisible({ timeout: 30000 });
    await this.page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(this.page.getByRole('button', { name: 'Save', exact: true })).toBeHidden({ timeout: 30000 });
    return { supplier: supplierName, material: materialName, leadTime };
  }
}

module.exports = { SupplierListPage };
