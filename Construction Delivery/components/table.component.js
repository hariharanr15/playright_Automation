class TableComponent {
  constructor(page, rootLocator = page.locator('table').first()) {
    this.page = page;
    this.root = rootLocator;
  }

  async visibleRows() {
    await this.root.waitFor({ state: 'visible', timeout: 15000 });
    return this.root.locator('tbody tr, [role="row"]').filter({ hasNotText: /^$/ });
  }

  async rowTexts() {
    const rows = await this.visibleRows();
    return rows.evaluateAll((elements) =>
      elements.map((element) => (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim())
    );
  }

  async hasRowMatching(pattern) {
    const matcher = pattern instanceof RegExp ? pattern : new RegExp(String(pattern), 'i');
    return (await this.rowTexts()).some((text) => matcher.test(text));
  }
}

module.exports = { TableComponent };
