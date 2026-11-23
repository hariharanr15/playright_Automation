const { expect } = require('@playwright/test');
const { BasePage } = require('./base.page');

class SiteSelectorPage extends BasePage {
  constructor(page) {
    super(page);
    this.headerSelectors = page.locator('div[role="button"].bg-inputBg:visible');
    this.siteSelector = this.headerSelectors.nth(1);
  }

  async activeSiteName() {
    await this.siteSelector.waitFor({ state: 'visible', timeout: 30000 });
    return (await this.siteSelector.innerText()).replace(/\s+/g, ' ').trim();
  }

  async ensureSite(siteName) {
    if (!siteName) {
      throw new Error('An SCP site/location name is required.');
    }

    if ((await this.activeSiteName()).includes(siteName)) {
      await this.expectActiveSite(siteName);
      return false;
    }

    await this.clickFirstVisible([
      { locator: this.siteSelector, label: 'Site selector' }
    ], 'Site selector', 20000);

    // The application sometimes keeps the project name in the header but loses the project context: the site list
    // shows "No options available" and the dashboard shows the setup banner (31 Oct 2026). A reload restores it.
    const empty = this.page.getByText('No options available', { exact: true });
    if (await empty.waitFor({ state: 'visible', timeout: 3000 }).then(() => true, () => false)) {
      await this.page.keyboard.press('Escape');
      await this.page.reload({ waitUntil: 'domcontentloaded' });
      await this.waitForReady();
      if ((await this.activeSiteName()).includes(siteName)) return this.expectActiveSite(siteName).then(() => true);
      await this.clickFirstVisible([{ locator: this.siteSelector, label: 'Site selector' }], 'Site selector', 20000);
    }

    const sitePattern = new RegExp(`^${this.escapeForRegex(siteName)}$`, 'i');
    await this.clickFirstVisible([
      { locator: this.page.getByRole('option', { name: sitePattern }), label: siteName },
      { locator: this.page.getByRole('menuitem', { name: sitePattern }), label: siteName },
      { locator: this.page.getByText(siteName, { exact: true }), label: siteName }
    ], `Site ${siteName}`, 20000);

    await this.expectActiveSite(siteName);
    return true;
  }

  // The header venue is not remembered: after a page reload the app selects the first site of the list (the newest one,
  // often a run-created site without locations), so Add Delivery offers no location (OBS-INV-12, 19 Nov 2026).
  // Re-select the site without reloading: collapse the submittal/component drawers that cover the header, pick the site,
  // then reopen the same view in-app (pushState) so the selection is kept.
  async keepSite(siteName) {
    if ((await this.activeSiteName().catch(() => '')).includes(siteName)) return false;
    const url = this.page.url();
    // Each open drawer has its own collapse arrow; click whichever one is visible (the topmost drawer's).
    const arrows = this.page.locator('button:has(img[src*="arrow_circle_ic"])');
    for (let i = 0; i < 4; i++) {
      let clicked = false;
      for (let j = (await arrows.count()) - 1; j >= 0 && !clicked; j--) {
        if (await arrows.nth(j).isVisible().catch(() => false)) { await arrows.nth(j).click().catch(() => null); clicked = true; }
      }
      if (!clicked) break;
      await this.page.waitForTimeout(800);
    }
    await this.ensureSite(siteName);
    if (/[?&](submittal|schedule)=/.test(url)) {
      await this.page.evaluate(u => { history.pushState({}, '', u); dispatchEvent(new PopStateEvent('popstate')); }, url);
      await this.page.waitForTimeout(2500);
    }
    return true;
  }

  async expectActiveSite(siteName) {
    await expect(this.siteSelector, `Active SCP site should be ${siteName}`).toContainText(
      new RegExp(this.escapeForRegex(siteName), 'i'),
      { timeout: 30000 }
    );
  }

  escapeForRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = { SiteSelectorPage };
