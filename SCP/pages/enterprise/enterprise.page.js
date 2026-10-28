const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');
const { number } = require('../../utils/scp-readonly');
const modules = {
  'Enterprise View': { route: 'enterprise-view', api: '/enterprise/summary/' },
  'Supplier Inbox': { route: 'supplier-inbox', api: '/supplier_inbox/' },
  'Supplier Performance': { route: 'supplier-performance', api: '/supplier_analytics/' },
  'Lead Time Benchmarks': { route: 'lead-time-benchmarks', api: '/enterprise/lead-time-benchmarks/' }
};
class EnterprisePage extends BasePage {
  constructor(page) { super(page); this.main = page.getByRole('main'); this.nav = page.locator('nav'); }
  async expand() {
    const control = this.nav.getByRole('button', { name: 'Enterprise View', exact: true });
    if (!await control.isVisible()) await this.nav.getByRole('button', { name: 'Enterprise', exact: true }).click();
    for (const name of Object.keys(modules)) await expect(this.nav.getByRole('button', { name, exact: true })).toBeVisible();
  }
  async open(name) {
    const definition = modules[name];
    if (!definition) throw new Error(`Out-of-scope Enterprise destination: ${name}`);
    await this.expand();
    const loaded = this.page.waitForResponse(r => r.request().method() === 'GET' && new URL(r.url()).pathname.endsWith(definition.api));
    await this.nav.getByRole('button', { name, exact: true }).click();
    const response = await loaded;
    expect(response.status(), name).toBe(200);
    const body = await response.json(); expect(body.status_code).toBe(200);
    await expect(this.page).toHaveURL(new RegExp(`/${definition.route}/?$`));
    await expect(this.main.getByText(/^(Loading analytics…|Loading benchmarks\.\.\.|Loading inbox\.\.\.)$/)).toHaveCount(0);
    return body.data;
  }
  card(label) { return this.main.getByText(new RegExp(`^${label}$`, 'i')).locator('..')
    .filter({ has: this.page.locator('p.text-2xl, div.text-2xl') }); }
  async expectCard(label, value, decimals = null) {
    const card = this.card(label); await expect(card).toHaveCount(1);
    await expect.poll(async () => {
      const paragraphs = await card.locator('p, div.text-2xl').allTextContents();
      const text = paragraphs.find(t => /^\s*[-+]?\d/.test(t));
      if (!text) return null;
      return number(text);
    }, { message: `${label}: exact displayed business value` }).toBe(decimals === null ? value : Number(value.toFixed(decimals)));
  }
  table(header) { return this.main.locator('table').filter({ has: this.page.getByRole('columnheader', { name: header, exact: true }) }); }
  row(table, identity) { return table.getByRole('row').filter({ has: this.page.getByRole('cell', { name: identity, exact: true }) }); }
  async expectReadOnly() {
    await expect(this.main.getByRole('button', { name: /^(add|create|edit|delete|save|approve|receive|adjust|transfer)(\s|$)/i })).toHaveCount(0);
  }
  async tableRecords(table, expected) {
    await expect(table).toHaveCount(1);
    await expect(table.locator('tbody tr')).toHaveCount(expected);
  }
}
module.exports = { EnterprisePage, modules };
