// Read-only deep walkthrough of the application (Project Admin, NRVC_Hall), page by page from a discovery crawl
// (reports/discovery-<date>/app-map.json, written by app-discovery.spec.js).
// On every page: each tab is opened; buttons that open a form or panel ("Add …", "New …", "Filters", "Columns", "Edit …")
// are opened and closed again with Cancel / Close / Escape – never saved; the first row's action menu is opened and its
// items are listed (none is clicked); the first record's detail page is opened and captured.
// Buttons that act at once (delete, rebuild, send, sync, approve, export, save, …) are never clicked. If a click
// unexpectedly shows a success message, it is logged as a "write warning" so it can be reviewed.
// Usage: WALK_MAP=reports/discovery-2026-11-24/app-map.json PM_FLOW_OUT=reports/walkthrough-<date> npx playwright test
//        --config=playwright.pm-flow.config.js app-walkthrough.spec.js   (WALK_ONLY=<route,route> to limit pages)
const fs = require('fs');
const path = require('path');
const { test } = require('@playwright/test');
const { getScpConfig } = require('../../config/scp.config');
const { prepareContext } = require('./support/app-shell');
const { plKit } = require('./support/pl-flow');
const { e2eKit } = require('./support/e2e-kit');

const clean = t => String(t || '').replace(/\s+/g, ' ').trim();
const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
// Opens a form or panel (closed again without saving).
const OPENER = /^(\+\s*)?(add|new|create|build|log|invite|upload|import|filters?|advanced filter|columns|show \/ hide columns|edit payment terms|settings|bulk upload|bulk map|map|raise|record|choose|select columns|manage|view bulk edit log|bulk assign|edit spec|scan)\b/i;
// Never clicked: acts at once, leaves the app, or changes data.
const NEVER = /delete|remove|rebuild|dry run|send|sync|generate|approve|reject|dismiss|confirm|save|apply|export|download|refresh|check again|archive|promote|roll ?back|mark|unassign|self assign|submit|logout|sign out|run\b|reset|restore|clear|duplicate|copy|close|cancel|print|csv|pdf|excel|auto-generate|notify|resend|revoke|deactivate|activate|disable|enable|watch|scan|toggle|follow|pin|star|flag|assign/i;
const WROTE = /(created|saved|updated|deleted|sent|added|assigned|removed) successfully|success/i;

test.setTimeout(3 * 60 * 60 * 1000);

test('Application walkthrough (read-only)', async ({ page }) => {
  const config = getScpConfig();
  const map = JSON.parse(fs.readFileSync(path.resolve(process.env.WALK_MAP), 'utf8'));
  const outDir = path.resolve(process.env.PM_FLOW_OUT || `reports/walkthrough-${new Date().toISOString().slice(0, 10)}`);
  fs.mkdirSync(path.join(outDir, 'shots'), { recursive: true });
  await prepareContext(page.context());
  const k = plKit(page);
  page.context().on('page', p => { if (p !== page) p.close().catch(() => null); });
  page.on('dialog', d => d.dismiss().catch(() => null)); // browser confirm() → Cancel
  page.on('download', d => d.cancel().catch(() => null));
  // SCP_WALK_ROLE=supplier | subcontractor walks that account's view (config.accounts) instead of the Project Admin's.
  const role = process.env.SCP_WALK_ROLE;
  if (role) {
    const kit = e2eKit(page, { config, navigator: null, outDir });
    await kit.signInAs(config.accounts[role]);
    await kit.enterProject(k.SITE).catch(() => kit.enterProject());
  } else await k.signIn({ step: async (_n, fn) => fn() }, config);

  const only = (process.env.WALK_ONLY || '').split(',').filter(Boolean);
  const targets = map.pages.filter(p => !p.menu[0].startsWith('(route only)')).filter(p => !only.length || only.includes(p.route));
  const out = [];
  const warnings = [];
  let shotNo = 0;
  const shot = async (name, fullPage = false) => { const f = `shots/${String(++shotNo).padStart(3, '0')}-${slug(name)}.png`; await page.screenshot({ path: path.join(outDir, f), fullPage }).catch(() => null); return f; };
  const main = () => page.locator('main').first();
  const layer = () => page.locator('[role="dialog"], div.fixed.inset-0').filter({ visible: true }).filter({ has: page.locator('input, button, h1, h2, h3, table, [role=menuitem]') }).last();
  const pathname = () => { try { return new URL(page.url()).pathname; } catch { return page.url(); } };
  const texts = async loc => [...new Set((await loc.allInnerTexts().catch(() => [])).map(clean).filter(Boolean))];
  const fieldsOf = scope => scope.locator('input:not([type=hidden]), textarea, select, [role=combobox]').evaluateAll(els => els.filter(e => e.offsetParent).map(e => {
    const lab = e.getAttribute('aria-label') || (e.labels && e.labels[0] && e.labels[0].innerText) || e.getAttribute('placeholder') || e.getAttribute('name') || e.type;
    return `${String(lab).replace(/\s+/g, ' ').trim()}${e.required || e.getAttribute('aria-required') === 'true' ? ' *' : ''} [${e.tagName.toLowerCase()}${e.type ? ':' + e.type : ''}]`;
  })).catch(() => []);
  const snap = async (scope, extra = {}) => ({
    headings: await texts(scope.locator('h1, h2, h3, h4')),
    tabs: await texts(scope.getByRole('tab')),
    buttons: (await texts(scope.getByRole('button').filter({ visible: true }))).slice(0, 80),
    columns: await texts(scope.getByRole('columnheader')),
    fields: [...new Set(await fieldsOf(scope))],
    text: clean(await scope.innerText().catch(() => '')).slice(0, 3000),
    ...extra
  });
  const settle = (ms = 1500) => k.settle(ms);
  const toastText = async () => clean(await page.getByRole('status').allInnerTexts().then(a => a.join(' | ')).catch(() => ''));

  async function closeLayer() {
    for (let i = 0; i < 4; i += 1) {
      const l = layer();
      if (!(await l.isVisible().catch(() => false))) return;
      const btn = l.getByRole('button', { name: /^(cancel|close|×|✕|x|back|discard)$/i }).last();
      if (await btn.isVisible().catch(() => false)) await btn.click({ timeout: 3000 }).catch(() => null);
      else await page.keyboard.press('Escape').catch(() => null);
      await page.waitForTimeout(500);
      // "Discard changes?" style confirmation
      const discard = page.getByRole('button', { name: /^(discard|leave|yes,? discard|close without saving)$/i }).last();
      if (await discard.isVisible().catch(() => false)) await discard.click().catch(() => null);
    }
  }

  async function reopen(route) {
    if (pathname() !== route) { await page.goto(route, { waitUntil: 'domcontentloaded' }).catch(() => null); await settle(2000); await k.keepSite().catch(() => null); await settle(1000); }
    await closeLayer();
  }

  // Clicks a control; returns what appeared (layer, new page, menu) and goes back to the page.
  async function probe(route, locator, name, kind) {
    const before = pathname();
    const toastBefore = await toastText();
    try { await locator.click({ timeout: 5000 }); } catch (e) { return { kind, name, error: clean(e.message).slice(0, 120) }; }
    await settle(1500);
    const toast = await toastText();
    if (toast && toast !== toastBefore && WROTE.test(toast)) warnings.push({ route, name, toast });
    const result = { kind, name };
    if (pathname() !== before) {
      result.opened = 'page';
      result.route = pathname();
      result.snap = await snap(main());
      result.shot = await shot(`${route} ${name} page`, true);
      await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => null);
      await settle(1500);
      if (pathname() !== before) await reopen(route);
      return result;
    }
    const menu = page.getByRole('menu').filter({ visible: true }).last();
    if (await menu.isVisible().catch(() => false)) {
      result.opened = 'menu';
      result.items = await texts(menu.getByRole('menuitem'));
      result.shot = await shot(`${route} ${name} menu`);
      await page.keyboard.press('Escape').catch(() => null);
      await settle(500);
      return result;
    }
    const l = layer();
    if (await l.isVisible().catch(() => false)) {
      result.opened = 'layer';
      result.snap = await snap(l);
      result.shot = await shot(`${route} ${name} form`);
      await closeLayer();
      return result;
    }
    result.opened = 'inline';
    result.snap = { text: clean(await main().innerText().catch(() => '')).slice(0, 1500) };
    result.shot = await shot(`${route} ${name}`);
    return result;
  }

  for (const target of targets) {
    const route = target.route;
    const label = target.menu.join(' › ');
    console.log(`\n== ${label} (${route})`);
    const entry = { menu: target.menu, route, probes: [] };
    try {
      await reopen(route);
      await settle(1500);
      entry.landing = await snap(main());
      entry.shot = await shot(`${route} landing`, true);

      // Tabs (role=tab), clicked in order; the landing tab is restored afterwards.
      const tabs = await texts(main().getByRole('tab'));
      for (const t of tabs.slice(0, 10)) {
        const r = await probe(route, main().getByRole('tab', { name: t, exact: true }).first(), t, 'tab');
        if (r.opened === 'inline') { r.snap = await snap(main()); }
        entry.probes.push(r);
        console.log(`   tab "${t}" → ${r.opened || r.error}`);
      }
      if (tabs.length) { await main().getByRole('tab', { name: tabs[0], exact: true }).first().click().catch(() => null); await settle(1000); }

      // Form / panel openers.
      const buttons = (await texts(main().getByRole('button').filter({ visible: true }))).filter(b => OPENER.test(b) && !NEVER.test(b) && b.length < 50);
      for (const b of [...new Set(buttons)].slice(0, 8)) {
        await reopen(route);
        const r = await probe(route, main().getByRole('button', { name: b, exact: true }).first(), b, 'button');
        entry.probes.push(r);
        console.log(`   button "${b}" → ${r.opened || r.error}${r.snap && r.snap.headings ? ' ' + (r.snap.headings[0] || '') : ''}`);
      }

      // First row: action menu and detail page.
      await reopen(route);
      const row = main().locator('table tbody tr').filter({ has: page.locator('td') }).first();
      if (await row.isVisible().catch(() => false)) {
        const menuBtn = row.locator('button[aria-label*="action" i], button[aria-label*="menu" i], button:has-text("⋯"), button:has-text("…"), img[alt="Menu"]').first();
        if (await menuBtn.isVisible().catch(() => false)) {
          const r = await probe(route, menuBtn, 'row actions', 'row-menu');
          entry.probes.push(r);
          console.log(`   row menu → ${r.opened || r.error} ${(r.items || []).join(', ')}`);
          await reopen(route);
        }
        const link = row.locator('a').filter({ hasText: /\w{2,}/ }).filter({ hasNotText: NEVER }).first();
        if (await link.isVisible().catch(() => false)) {
          const name = clean(await link.innerText().catch(() => '')) || 'first row link';
          const r = await probe(route, link, `row: ${name.slice(0, 40)}`, 'row-detail');
          entry.probes.push(r);
          console.log(`   row "${name.slice(0, 30)}" → ${r.opened || r.error}${r.route ? ' ' + r.route : ''}`);
        }
      }
    } catch (e) {
      entry.error = clean(e.message).slice(0, 200);
      console.log(`   ! ${entry.error}`);
    }
    out.push(entry);
    fs.writeFileSync(path.join(outDir, 'walkthrough.json'), JSON.stringify({ walked: new Date().toISOString(), pages: out, warnings }, null, 1));
  }
  console.log(`\nWalkthrough: ${out.length} pages, ${out.reduce((n, e) => n + e.probes.length, 0)} probes, ${warnings.length} write warning(s) → ${outDir}`);
});
