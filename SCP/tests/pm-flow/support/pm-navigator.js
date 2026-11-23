// Single sign-in and Project Management navigation for the PM flow.
// The navigator opens a page only when the browser is not already on it, and expands a menu group only
// when its entries are hidden (clicking an open group would collapse it).
const { expect } = require('@playwright/test');
const { focus, setNavPath } = require('./pm-visuals');

const PM = 'Project Management';
// Menu label → route and the groups that contain it (outermost first).
const MENU = {
  'Booking Integration': { route: 'booking-integration', groups: [PM, 'Integrations'] },
  'TheLink Integration': { route: 'thelink-integration', groups: [PM, 'Integrations'] },
  'XER Import': { route: 'xer-import', groups: [PM, 'Integrations'] },
  'Common Utilities': { route: 'common-utilities', groups: [PM, 'Reference Data'] },
  'Common UoM': { route: 'common-uom', groups: [PM, 'Reference Data'] },
  'Material Category': { route: 'material-category', groups: [PM, 'Reference Data'] },
  'Configuration Options': { route: 'configuration-options', groups: [PM] },
  'First Delivery Inspection Config': { route: 'first-delivery-inspection-config', groups: [PM] },
  'Inventory Control': { route: 'inventory-control', groups: [PM] },
  'Material Master': { route: 'material-master', groups: [PM] },
  'PreShipping Checklist': { route: 'preshipping-checklist', groups: [PM] },
  'Bulk Upload Status': { route: 'bulk-upload-status', groups: [PM] },
  'Procurement Log Configuration': { route: 'procurement-log-configuration', groups: [PM] },
  'Site Details': { route: 'site-details', groups: [PM] },
  'Submittal Manager': { route: 'submittal-manager', groups: [PM] },
  'System Messages': { route: 'system-messages', groups: [PM] },
  'Watched Materials': { route: 'watched-materials', groups: [PM] }
};
const OVERLAY = 'div.fixed.inset-0';

class PmNavigator {
  constructor(page, config) {
    this.page = page;
    this.config = config;
    this.nav = page.locator('nav').first();
    this.navigations = 0;
    this.visited = [];
  }

  menuItem(label) {
    return this.nav.getByRole('button', { name: label, exact: true }).first();
  }

  navPath(label) {
    return [...(MENU[label]?.groups || [PM]), label];
  }

  onRoute(route) {
    try { return new URL(this.page.url()).pathname.replace(/\/+$/, '') === `/${route}`; } catch { return false; }
  }

  // Opens a PM page through the left menu; does nothing when it is already the current page.
  async open(label) {
    const entry = MENU[label];
    if (!entry) throw new Error(`Unknown Project Management page: ${label}`);
    await setNavPath(this.page, this.navPath(label));
    await this.clearLayers();
    if (this.onRoute(entry.route)) return false;
    const chain = [...entry.groups, label];
    for (let index = 1; index < chain.length; index += 1) {
      const next = this.menuItem(chain[index]);
      if (await next.isVisible().catch(() => false)) continue;
      const group = this.menuItem(chain[index - 1]);
      await expect(group, `${chain[index - 1]} menu`).toBeVisible({ timeout: 20000 });
      await focus(group, 250);
      await group.click();
      await expect(next, `${chain[index]} menu entry`).toBeVisible({ timeout: 10000 });
    }
    const item = this.menuItem(label);
    await focus(item, 300);
    await item.click();
    await this.page.waitForURL(url => url.pathname.replace(/\/+$/, '') === `/${entry.route}`, { timeout: 30000 });
    await this.ready();
    // A page can open a dialog by itself (e.g. Material Master reopens a bulk upload that waits for input): close it so
    // it never blocks the scenario.
    await this.page.waitForTimeout(800);
    await this.clearLayers();
    this.navigations += 1;
    // Evidence for PM-REG-NAV-01: the route reached and whether the app marks the entry as active.
    await this.page.waitForTimeout(300); // let the menu apply its active style
    const appActive = await item.evaluate(node => /font-semibold|bg-primary/.test(node.className) || node.getAttribute('aria-current') === 'page').catch(() => false);
    this.visited.push({ label, route: entry.route, reached: this.onRoute(entry.route), appActive });
    return true;
  }

  /**
   * Is a Project Management menu entry offered? Expands its groups when needed and does not open the page.
   * Used for environment preconditions: e.g. "PreShipping Checklist" is only listed while the project's
   * Pre-Shipping option is switched on (Configuration Options).
   */
  async hasMenuEntry(label) {
    const entry = MENU[label];
    if (!entry) throw new Error(`Unknown Project Management page: ${label}`);
    await this.clearLayers();
    const chain = [...entry.groups, label];
    for (let index = 1; index < chain.length; index += 1) {
      const next = this.menuItem(chain[index]);
      if (await next.isVisible().catch(() => false)) continue;
      const group = this.menuItem(chain[index - 1]);
      await expect(group, `${chain[index - 1]} menu`).toBeVisible({ timeout: 20000 });
      await group.click();
      if (!(await next.waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false))) return false;
    }
    return true;
  }

  // Opens a route directly (used only by scenarios that test direct URL access).
  async gotoRoute(route) {
    await this.page.goto(new URL(`/${route}`, this.config.baseUrl).href, { waitUntil: 'domcontentloaded' });
    await this.ready();
    this.navigations += 1;
  }

  // Switches the header project in the same session (no new sign-in).
  async switchProject(name) {
    const { ProjectSelectorPage } = require('../../../pages/project-selector.page');
    const changed = await new ProjectSelectorPage(this.page, this.config).ensureProject(name);
    if (changed) { await this.ready(); this.navigations += 1; }
    return changed;
  }

  async ready() {
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  }

  // The open modal or drawer: the last visible full-screen layer that has content. Drawers come with a separate empty
  // backdrop layer and menus with an empty click-catcher, so empty layers are skipped here.
  overlay() {
    return this.page.locator(OVERLAY).filter({ visible: true }).filter({ has: this.page.locator('*') }).last();
  }

  emptyLayer() {
    return this.page.locator(OVERLAY).filter({ visible: true }).filter({ hasNot: this.page.locator('*') }).last();
  }

  // Closes an open modal with its own Cancel / Close / X control.
  async closeOverlay() {
    const overlay = this.overlay();
    if (!(await overlay.isVisible().catch(() => false))) {
      // Only an empty layer left: the click-catcher behind an open menu (e.g. Load Defaults) – click it away.
      const layer = this.emptyLayer();
      if (!(await layer.isVisible().catch(() => false))) return false;
      const box = await layer.boundingBox();
      if (box) await this.page.mouse.click(box.x + box.width / 2, box.y + box.height - 15); // the header covers the top edge
      return this.overlayGone();
    }
    for (const name of ['Cancel', 'Close']) {
      const button = overlay.getByRole('button', { name, exact: true }).last(); // "×" may share the name
      if (await button.isVisible().catch(() => false)) { await focus(button, 250); await button.click(); return this.overlayGone(); }
    }
    const close = overlay.locator('button:has(img), button:has(svg)').first();
    if (await close.isVisible().catch(() => false)) { await focus(close, 250); await close.click(); return this.overlayGone(); }
    await this.page.keyboard.press('Escape');
    return this.overlayGone();
  }

  async overlayGone() {
    await expect(this.page.locator(OVERLAY).filter({ visible: true }), 'Modal should close').toHaveCount(0, { timeout: 10000 });
    return true;
  }

  // Closes anything layered over the page (modal, drawer, menu); reloads the page when a layer cannot be closed,
  // so one stuck dialog never blocks the rest of the flow.
  async clearLayers() {
    if (!(await this.page.locator(OVERLAY).filter({ visible: true }).count().catch(() => 0))) return;
    await this.recover().catch(() => null);
    if (await this.page.locator(OVERLAY).filter({ visible: true }).count().catch(() => 0)) {
      await this.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
      await this.ready();
    }
  }

  // Recovery between attempts: close open lists and modals so the next attempt starts clean.
  async recover() {
    await this.page.keyboard.press('Escape').catch(() => null);
    for (let i = 0; i < 2; i += 1) {
      if (!(await this.page.locator(OVERLAY).filter({ visible: true }).count().catch(() => 0))) break;
      await this.closeOverlay().catch(() => this.page.keyboard.press('Escape').catch(() => null));
    }
  }
}

module.exports = { PmNavigator, MENU, PM, OVERLAY };
