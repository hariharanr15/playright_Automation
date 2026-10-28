// Diagnostic only. The .diagnostic.js suffix excludes it from business test discovery.
const { test } = require('../../../fixtures/readonlyTest');
const { SubcontractorIssuesPage } = require('../../../pages/reports/subcontractor-issues.page');
test('Diagnostic: inspect deployed issue sorting search and export contracts', async ({ readonly: ctx }, info) => {
  const view = new SubcontractorIssuesPage(ctx.page);
  await view.load(ctx.config, ctx);
  const evidence = await ctx.page.evaluate(async () => {
    const urls = [...new Set([...document.scripts].map(s => s.src).concat(performance.getEntriesByType('resource').map(r => r.name)))]
      .filter(value => { try { const url = new URL(value); return url.origin === location.origin && /\.js$/.test(url.pathname); } catch { return false; } });
    const results = [];
    for (const value of urls) {
      const response = await fetch(value);
      if (!response.ok) throw new Error(`Client asset read failed: ${response.status}`);
      const source = await response.text();
      for (const term of ['get_supplier_issues', 'Delays in Raising PO', 'function dg', 'dg=']) {
        let offset = source.indexOf(term);
        for (let match = 0; offset >= 0 && match < 8; match++) {
          results.push({ asset: new URL(value).pathname, term, excerpt: source.slice(Math.max(0, offset - 12000), offset + 12000) });
          offset = source.indexOf(term, offset + term.length);
        }
      }
    }
    return results;
  });
  await info.attach('deployed-issue-client-contract', { body: Buffer.from(JSON.stringify(evidence)), contentType: 'application/json' });
  await ctx.assertContext();
});
