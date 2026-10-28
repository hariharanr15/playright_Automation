const { expect } = require('@playwright/test');
const { read } = require('../../../utils/scp-readonly');

const key = value => String(value || '').trim().toLowerCase();

class SupplierListPage {
  constructor(page) {
    this.page = page;
  }

  async open() {
    // The list request carries the current project; existing suppliers are read for that same project.
    const listed = this.page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/supplier_master/list_suppliers_by_project_id/'), { timeout: 30000 }).catch(() => null);
    // Start from a canonical route so a previous module's expanded menus cannot toggle this one closed.
    await this.page.goto(new URL('/supplier-list', this.page.url()).href, { waitUntil: 'domcontentloaded' });
    await expect(this.page).toHaveURL(/\/supplier-list\/?$/);
    await expect(this.page.getByRole('button', { name: /Add Supplier/i })).toBeVisible();
    const response = await listed;
    this.projectId = response ? new URL(response.url()).searchParams.get('project_id') : this.projectId;
  }

  // Every supplier (and sub-contractor) already saved in the current project.
  async existingSuppliers() {
    expect(this.projectId, 'Supplier List project must be known before reading existing suppliers').toBeTruthy();
    const body = await read(this.page, 'supplier_master/', { project_id: this.projectId });
    expect(Array.isArray(body.data), 'Existing supplier list').toBe(true);
    return body.data;
  }

  // Draws sequence numbers until neither the supplier name nor the contact email already exists in the project.
  async uniqueSupplier(nextNumber, attempts = 100) {
    const existing = await this.existingSuppliers();
    const names = new Set(existing.map(item => key(item.supplier_name)));
    const emails = new Set(existing.map(item => key(item.contact_email)));
    const skipped = [];
    for (let i = 0; i < attempts; i++) {
      const n = nextNumber();
      const supplier = {
        name: `supplier${n}`,
        contact: `test user${n}`,
        email: `supplier${n}@yopmail.com`,
        phone: `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`
      };
      if (!names.has(key(supplier.name)) && !emails.has(key(supplier.email))) return { supplier, skipped, existingCount: existing.length };
      skipped.push(supplier.name);
    }
    throw new Error(`No unused supplier name after ${attempts} numbers; last skipped ${skipped.slice(-3).join(', ')}`);
  }

  // Existence verifier for the create step: complete only when the exact name and email are saved together.
  async verifySupplier(supplier) {
    const match = (await this.existingSuppliers()).find(item => key(item.supplier_name) === key(supplier.name));
    if (!match) return { status: 'missing' };
    if (key(match.contact_email) !== key(supplier.email)) return { status: 'unknown', reason: `Supplier ${supplier.name} exists with a different contact email` };
    return { status: 'complete', value: { supplierMasterId: match.supplier_master_id, supplierId: match.supplier_id, name: match.supplier_name } };
  }

  async openCreate() {
    const initialized = this.page.waitForResponse(response => new URL(response.url()).pathname === '/api/project_user/supplier_users/' && response.request().method() === 'GET');
    await this.page.getByRole('button', { name: /Add Supplier/i }).click();
    const response = await initialized;
    expect(response.ok(), 'Supplier user choices must load before form input').toBe(true);
    await response.finished();
    await expect(this.page.getByRole('heading', { name: 'Add Supplier', exact: true })).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
  }

  async fillForm(supplier) {
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
      for (const [name, value] of Object.entries(fields)) {
        const input = this.page.locator(`input[name="${name}"]`);
        // Fill even a displayed default: the application's form state may still be empty.
        await input.fill(value);
        await input.blur();
      }
      for (const [name, value] of Object.entries(fields)) {
        await expect(this.page.locator(`input[name="${name}"]`), `Supplier field ${name} must retain its value before saving`).toHaveValue(value);
      }
  }

  async create(supplier) {
      await this.openCreate();
      await this.fillForm(supplier);
      const saved = this.page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/supplier_master/', { timeout: 30000 });
      await this.page.getByRole('button', { name: 'Save', exact: true }).click();
      const response = await saved;
      if (!response.ok()) {
        const body = await response.json().catch(() => ({}));
        throw new Error(`Supplier ${supplier.name} was not saved (HTTP ${response.status()}): ${body.message || body.error?.error || 'no message'}`);
      }
      await expect(this.page.getByRole('button', { name: /Add Supplier/i })).toBeVisible({ timeout: 30000 });
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
