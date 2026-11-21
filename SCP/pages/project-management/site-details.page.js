const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');

class SiteDetailsPage extends BasePage {
  constructor(page) {
    super(page);
    this.addSiteButton = page.getByRole('button', { name: 'Add Site', exact: true });
    this.searchInput = page.getByRole('textbox', { name: /Search sites/i });
    this.modalHeading = page.getByRole('heading', { name: 'Add Site', exact: true });
  }

  async open(dashboard) {
    await dashboard.openProjectManagementModule('Site Details', 'site-details', 'Site Details');
    await expect(this.addSiteButton).toBeVisible();
  }

  async verifyBlankSiteIsRejected() {
    await this.clickFirstVisible([{ locator: this.addSiteButton, label: 'Add Site' }], 'Add Site', 10000);
    await expect(this.modalHeading).toBeVisible();
    await this.clickFirstVisible([
      { locator: this.page.getByRole('button', { name: 'Add', exact: true }), label: 'Add site' }
    ], 'Add site', 5000);
    await expect(this.modalHeading, 'Blank site must not be submitted').toBeVisible();
  }

  async addSite({ name, siteType = 'Site', address, city, country }) {
    await this.selectDropdownOption(
      this.page.getByRole('button', { name: 'Choose Site', exact: true }),
      siteType,
      'Site type'
    );
    await this.fillVisible(this.fieldBesideLabel('Name'), name, 'Site name');
    await this.fillVisible(this.fieldBesideLabel('Address'), address, 'Site address');
    await this.fillVisible(this.fieldBesideLabel('City'), city, 'Site city');
    await this.selectDropdownOption(
      this.page.getByRole('button', { name: 'Choose Country', exact: true }),
      country,
      'Site country'
    );
    await this.clickFirstVisible([
      { locator: this.page.getByRole('button', { name: 'Add', exact: true }), label: 'Add site' }
    ], 'Add site', 10000);
    await this.expectSite(name, city, country);
  }

  row(name) {
    return this.page.locator('tr').filter({ hasText: name }).first();
  }

  async expectSite(name, city, country) {
    await this.searchInput.fill(name);
    await expect(this.row(name)).toBeVisible({ timeout: 30000 });
    await expect(this.row(name)).toContainText(name);
    if (city) await expect(this.row(name)).toContainText(city);
    if (country) await expect(this.row(name)).toContainText(country);
  }

  /**
   * Adds a location (for example a second storage place) to an existing site:
   * Site Details › the site's row "ADD" › choose the location type › enter the name › "Add".
   * Used by the Inventory regression, which needs two locations on the test site for Internal Movement.
   */
  async addLocationToSite(siteName, { locationType, locationName }) {
    await this.page.goto('/site-details', { waitUntil: 'domcontentloaded' });
    const siteRow = this.page.locator('main tbody tr').filter({ has: this.page.getByRole('cell', { name: siteName, exact: true }) }).first();
    await siteRow.getByRole('button', { name: 'ADD', exact: true }).click();
    await this.page.getByRole('button', { name: 'Choose Location' }).first().click();
    await this.page.getByRole('listbox').last().getByRole('option', { name: locationType, exact: true }).first().click();
    const dialog = this.page.getByRole('heading', { name: /Add Location/ }).locator('xpath=../..');
    await dialog.locator('input[type="text"], input:not([type])').first().fill(locationName);
    await this.page.getByRole('button', { name: 'Add', exact: true }).last().click();
    await expect(this.page.getByRole('heading', { name: /Add Location/ })).toBeHidden({ timeout: 15000 });
  }

  async clearSearch() {
    await this.clearSearchAndPause(this.searchInput, 'Site Details search');
  }
}

module.exports = { SiteDetailsPage };
