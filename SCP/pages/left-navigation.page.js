const { BasePage } = require('./base.page');
const { NAV_GROUPS } = require('../config/scp-module-registry');

const ITEMS = 'button, a, [role="button"], [role="menuitem"], [role="treeitem"]';
const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();

class LeftNavigationPage extends BasePage {
  constructor(page) {
    super(page);
    this.navigation = page.locator('nav').first();
  }

  async visibleItems() {
    return this.navigation.locator(ITEMS).evaluateAll(nodes => nodes
      .filter(node => node.offsetParent !== null || node.getClientRects().length)
      // Trailing notification badges ("International Shipments 1") are not part of the label.
      .map(node => ({ label: (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim().replace(/\s+\d{1,4}\+?$/, ''),
        expanded: node.getAttribute('aria-expanded'), href: node.getAttribute('href') }))
      .filter(item => item.label && item.label.length <= 80)).catch(() => []);
  }

  // Read-only discovery: toggles are clicked to reveal children; any navigation they cause is undone.
  async captureTree({ maxDepth = 3 } = {}) {
    await this.navigation.waitFor({ state: 'visible', timeout: 30000 });
    await this.navigation.locator(ITEMS).first().waitFor({ state: 'visible', timeout: 30000 });
    const startUrl = this.page.url();
    const tree = new Map();
    const labels = items => new Set(items.map(item => item.label));
    for (const item of await this.visibleItems()) if (!tree.has(item.label)) tree.set(item.label, { label: item.label, path: [], href: item.href });
    const expanded = new Set();
    const expand = async (group, parents, depth) => {
      if (depth > maxDepth || expanded.has(group)) return;
      expanded.add(group);
      const control = this.navigation.locator(ITEMS).filter({ hasText: new RegExp(`^\\s*${this.escape(group)}\\s*$`, 'i') }).first();
      if (!await control.isVisible().catch(() => false)) return;
      const before = labels(await this.visibleItems());
      await control.click();
      await this.page.waitForTimeout(400);
      let after = labels(await this.visibleItems());
      let children = [...after].filter(label => !before.has(label));
      if (!children.length && after.size < before.size) {
        // The group was already open and the click collapsed it; reopen and use the collapsed difference.
        children = [...before].filter(label => !after.has(label));
        await control.click();
        await this.page.waitForTimeout(400);
        after = labels(await this.visibleItems());
      }
      if (this.page.url() !== startUrl) await this.goto(startUrl);
      for (const label of children) {
        const existing = tree.get(label);
        if (!existing || existing.path.length < parents.length + 1) tree.set(label, { label, path: [...parents, group], href: existing?.href });
      }
      for (const label of children) if (this.isGroup(label, await this.visibleItems())) await expand(label, [...parents, group], depth + 1);
    };
    for (const item of await this.visibleItems()) if (this.isGroup(item.label, [item])) await expand(item.label, [], 1);
    // Root labels can hydrate after the first snapshot; retain them alongside discovered children.
    for (const item of await this.visibleItems()) if (!tree.has(item.label)) tree.set(item.label, { label: item.label, path: [], href: item.href });
    return [...tree.values()];
  }

  isGroup(label, items) {
    return NAV_GROUPS.some(group => group.toLowerCase() === label.toLowerCase()) ||
      items.some(item => item.label === label && item.expanded === 'false');
  }

  static matches(tree, navDefinitions) {
    return tree.filter(item => navDefinitions.some(definition => normalize(item.label).toLowerCase() === definition.label.toLowerCase() &&
      (!definition.under || item.path.some(parent => parent.toLowerCase() === definition.under.toLowerCase()))));
  }

  escape(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
}

module.exports = { LeftNavigationPage, normalize };
