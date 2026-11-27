// Read-only discovery crawl of the whole application (Project Admin, NRVC_Hall).
// Signs in like the other suites, expands every left-menu group, opens each page through the menu and records what the
// page shows: route, headings, tabs, buttons, grid columns, fields, row count, error texts and a screenshot.
// Only menu entries are clicked (and Escape pressed to close a dialog a page opens by itself); nothing inside a page is
// clicked, so no data is changed. Output: reports/discovery-<timestamp>/app-map.json, app-map.md and shots/*.png.
// Used to map a new staging release against the test cases (scripts/discovery-impact.js).
const fs = require('fs');
const path = require('path');
const { test } = require('@playwright/test');
const { getScpConfig } = require('../../config/scp.config');
const { prepareContext } = require('./support/app-shell');
const { plKit } = require('./support/pl-flow');
const { e2eKit } = require('./support/e2e-kit');

// SCP_WALK_ROLE=supplier | subcontractor signs in with that account (config.accounts) instead of the Project Admin.
async function signInRole(page, k, config, outDir) {
  const role = process.env.SCP_WALK_ROLE;
  if (!role) return k.signIn({ step: async (_n, fn) => fn() }, config);
  const acc = config.accounts[role];
  if (!acc || !acc.username) throw new Error(`No account configured for SCP_WALK_ROLE=${role}`);
  const kit = e2eKit(page, { config, navigator: null, outDir });
  await kit.signInAs(acc);
  await kit.enterProject(k.SITE).catch(() => kit.enterProject());
}

const SKIP = /log ?out|sign ?out|switch (project|platform)|profile|help|support|collapse|expand (menu|sidebar)|^menu$/i;
const clean = t => String(t || '').replace(/\s+/g, ' ').trim();
const label = t => clean(t).replace(/\s+\d+\+?$/, ''); // drop counter badges ("International Shipments 38")
const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

test.setTimeout(60 * 60 * 1000);

test('Application discovery crawl (read-only)', async ({ page }) => {
  const config = getScpConfig();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = process.env.PM_FLOW_OUT ? path.resolve(process.env.PM_FLOW_OUT) : path.resolve(__dirname, '../../reports', `discovery-${stamp}`);
  fs.mkdirSync(path.join(outDir, 'shots'), { recursive: true });
  await prepareContext(page.context());
  const k = plKit(page);
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(clean(m.text()).slice(0, 200)); });
  page.context().on('page', p => { if (p !== page) p.close().catch(() => null); }); // never follow a new tab

  await signInRole(page, k, config, outDir);
  await k.settle(2000);

  const nav = page.locator('nav').first();
  const navButtons = () => nav.getByRole('button').filter({ visible: true });
  const labels = async () => (await navButtons().allInnerTexts()).map(label).filter(t => t && !SKIP.test(t));
  const pathname = () => { try { return new URL(page.url()).pathname.replace(/\/+$/, '') || '/'; } catch { return page.url(); } };
  const button = (name, last) => { const b = nav.getByRole('button', { name: new RegExp(`^\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s+\\d+\\+?)?\\s*$`) }); return last ? b.last() : b.first(); };

  const children = {}; // group key → ordered child labels
  const pages = [];
  const problems = [];
  const key = p => p.join(' › ');

  async function closeLayers() {
    for (let i = 0; i < 3; i += 1) {
      if (!(await page.locator('div.fixed.inset-0, [role="dialog"]').filter({ visible: true }).count().catch(() => 0))) return i > 0;
      await page.keyboard.press('Escape').catch(() => null);
      await page.waitForTimeout(400);
    }
    return true;
  }

  // Re-opens the groups of a menu path (groups collapse after each navigation).
  async function expandPath(groups) {
    for (let i = 0; i < groups.length; i += 1) {
      const kids = children[key(groups.slice(0, i + 1))];
      if (kids && kids.length && await button(kids[0], kids[0] === groups[i]).isVisible().catch(() => false)) continue;
      await button(groups[i], i > 0 && groups[i] === groups[i - 1]).click({ timeout: 8000 });
      await page.waitForTimeout(500);
    }
  }

  async function capture(menuPath) {
    await k.settle(2500);
    const autoDialog = await closeLayers();
    const main = page.locator('main').first();
    const hasMain = await main.count();
    const scope = hasMain ? main : page.locator('body');
    const texts = async loc => [...new Set((await loc.allInnerTexts().catch(() => [])).map(clean).filter(Boolean))];
    const attrs = async (loc, fn) => [...new Set((await loc.evaluateAll(fn).catch(() => [])).map(clean).filter(Boolean))];
    const body = clean(await scope.innerText().catch(() => ''));
    const entry = {
      menu: menuPath,
      route: pathname(),
      query: (() => { try { return new URL(page.url()).search; } catch { return ''; } })(),
      title: await page.title().catch(() => ''),
      headings: await texts(scope.locator('h1, h2, h3')),
      tabs: await texts(scope.getByRole('tab')),
      buttons: (await texts(scope.getByRole('button').filter({ visible: true }))).slice(0, 120),
      links: (await texts(scope.getByRole('link').filter({ visible: true }))).slice(0, 60),
      columns: await texts(scope.getByRole('columnheader')),
      fields: await attrs(scope.locator('input:not([type=hidden]), textarea, select, [role=combobox]'), els => els.filter(e => e.offsetParent).map(e => e.getAttribute('aria-label') || e.getAttribute('placeholder') || e.getAttribute('name') || (e.labels && e.labels[0] && e.labels[0].innerText) || e.type)),
      rows: await scope.locator('table tbody tr').count().catch(() => 0),
      errorTexts: [...new Set((body.match(/(couldn'?t load[^.]*|something went wrong[^.]*|failed to [^.]*|\berror\b[^.]{0,60}|not found|no access[^.]*|page not found)/gi) || []).map(clean))].slice(0, 10),
      autoDialog,
      consoleErrors: errors.splice(0),
      text: body.slice(0, 6000),
      shot: `shots/${slug(menuPath.join(' '))}.png`
    };
    await page.screenshot({ path: path.join(outDir, entry.shot), fullPage: false }).catch(() => null);
    pages.push(entry);
    console.log(`  ${key(menuPath)} → ${entry.route} (${entry.headings[0] || entry.title}; ${entry.columns.length} cols, ${entry.rows} rows${entry.errorTexts.length ? '; ' + entry.errorTexts[0] : ''})`);
  }

  // Visits one menu entry: a page (URL changes or nothing new appears) is captured; a group is expanded and its
  // children are visited.
  async function visit(groups, name, depth = 0) {
    if (depth > 5) return;
    try {
      await closeLayers();
      await expandPath(groups);
      const before = await labels();
      const url0 = pathname();
      const parent = groups[groups.length - 1];
      await button(name, name === parent).click({ timeout: 8000 });
      await page.waitForTimeout(900);
      let after = await labels();
      const navigated = pathname() !== url0;
      const count = list => list.reduce((m, t) => (m[t] = (m[t] || 0) + 1, m), {});
      const diff = (a, b) => { const cb = count(b); return a.filter(t => (cb[t] ? (cb[t]--, false) : true)); };
      let kids = diff(after, before);
      if (!navigated && !kids.length && after.length < before.length) {
        // The group was already open and has just collapsed: its children are the entries that disappeared.
        kids = diff(before, after);
        await button(name, name === parent).click({ timeout: 8000 });
        await page.waitForTimeout(700);
      }
      if (navigated || !kids.length) { await capture([...groups, name]); return; }
      children[key([...groups, name])] = kids;
      for (const kid of kids) await visit([...groups, name], kid, depth + 1);
    } catch (e) {
      problems.push({ menu: [...groups, name], error: clean(e.message).slice(0, 200) });
      console.log(`  ! ${key([...groups, name])}: ${clean(e.message).slice(0, 120)}`);
      await page.goto('/management-dashboard', { waitUntil: 'domcontentloaded' }).catch(() => null);
      await k.settle(1500);
    }
  }

  // Header (project / site selectors, user menu) as seen on the landing page.
  const header = { text: clean(await page.locator('header').first().innerText().catch(() => '')).slice(0, 500), buttons: (await page.locator('header').first().getByRole('button').allInnerTexts().catch(() => [])).map(clean).filter(Boolean) };

  // Top level: the entries visible at start. Children of groups that start expanded are removed once discovered.
  const top = await labels();
  children[''] = [...top];
  const done = new Set();
  for (const name of top) {
    const nested = Object.entries(children).filter(([kk]) => kk).some(([, v]) => v.includes(name));
    if (nested || done.has(name)) continue;
    done.add(name);
    await visit([], name);
  }
  children[''] = top.filter(name => !Object.entries(children).filter(([kk]) => kk).some(([, v]) => v.includes(name)));

  // Second pass: every route known before the release (application map of 2 Nov 2026 and the Project Management menu of the
  // automation) that the menu crawl did not reach is opened directly, to tell a moved entry from a removed page.
  const { MENU } = require('./support/pm-navigator');
  const oldMap = fs.readFileSync(path.resolve(__dirname, '../../docs/functional-discovery/APP_MAP_SWEEP.md'), 'utf8');
  const known = [...oldMap.matchAll(/^\| ([^|]+?) \| `?\*{0,2}`?(\/[a-z0-9-]+)`?\*{0,2} \|/gim)].map(m => ({ name: m[1].replace(/\*/g, '').trim(), route: m[2] }))
    .concat(process.env.SCP_WALK_ROLE && process.env.WALK_PA_MAP ? JSON.parse(fs.readFileSync(path.resolve(process.env.WALK_PA_MAP), 'utf8')).pages.map(p => ({ name: `Project Admin page ${p.menu.join(' > ')}`, route: p.route })) : [])
    .concat(Object.entries(MENU).map(([name, e]) => ({ name: `Project Management > ${name}`, route: `/${e.route}` })), [{ name: 'Inventory Management', route: '/inventory-management' }, { name: 'Supplier Inbox', route: '/supplier-inbox' }]);
  const directly = [];
  for (const r of known) {
    if (pages.some(p => p.route === r.route) || directly.some(d => d.route === r.route)) continue;
    await page.goto(r.route, { waitUntil: 'domcontentloaded' }).catch(() => null);
    const landed = pathname();
    const entry = { name: r.name, route: r.route, landed, redirected: landed !== r.route };
    directly.push(entry);
    if (!entry.redirected) await capture([`(route only) ${r.name.replace(/ > /g, ' › ')}`]);
    else console.log(`  ${r.name}: ${r.route} → redirected to ${landed}`);
  }

  const result = { crawled: new Date().toISOString(), role: process.env.SCP_WALK_ROLE || 'project admin', project: config.projectName, baseUrl: config.baseUrl, header, menu: children, pages, problems, directly };
  fs.writeFileSync(path.join(outDir, 'app-map.json'), JSON.stringify(result, null, 1));

  // Readable map.
  const md = ['# SCP application map – read-only crawl', '', `_${config.projectName} · ${result.role} · ${result.crawled.slice(0, 16).replace('T', ' ')} UTC_`, '', '## Menu', ''];
  const tree = (k0, indent) => { for (const c of children[k0] || []) { const kk = k0 ? `${k0} › ${c}` : c; md.push(`${'  '.repeat(indent)}- ${c}${children[kk] ? '' : ` → \`${(pages.find(p => key(p.menu) === kk) || {}).route || '?'}\``}`); if (children[kk]) tree(kk, indent + 1); } };
  tree('', 0);
  md.push('', '## Pages', '', '| Menu | Route | Headings | Tabs | Columns | Rows | Errors |', '|---|---|---|---|---|---|---|');
  const cell = a => (Array.isArray(a) ? a.join(', ') : String(a)).replace(/\|/g, '/').slice(0, 300);
  for (const p of pages) md.push(`| ${cell(p.menu.join(' › '))} | \`${p.route}\` | ${cell(p.headings.slice(0, 6))} | ${cell(p.tabs)} | ${cell(p.columns)} | ${p.rows} | ${cell(p.errorTexts)} |`);
  if (problems.length) { md.push('', '## Entries that could not be opened', ''); for (const p of problems) md.push(`- ${p.menu.join(' › ')}: ${p.error}`); }
  fs.writeFileSync(path.join(outDir, 'app-map.md'), md.join('\n') + '\n');
  console.log(`\nDiscovery: ${pages.length} pages, ${problems.length} problems → ${outDir}`);
});
