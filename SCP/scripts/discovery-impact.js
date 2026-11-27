// Impact of a new staging release on the automation, from a read-only discovery crawl (tests/pm-flow/app-discovery.spec.js).
//  1. Menu and routes: compares the crawled menu with the previous application map (docs/functional-discovery/APP_MAP_SWEEP.md)
//     and with the routes the specs open.
//  2. Screen texts: collects the labels the specs rely on (button / tab / heading / column names, menu names, getByText
//     strings, routes) and checks each one against everything the crawl saw on the landing pages. A label that is not found
//     is a candidate change: it may also sit inside a dialog or detail page the crawl does not open, so it is a lead, not
//     proof. Each miss is attributed to the nearest preceding case ID in the spec (a hint where IDs are declared in lists).
// Usage (from SCP): node scripts/discovery-impact.js reports/discovery-<ts>
// Output: <folder>/IMPACT.md and impact.json.
const fs = require('fs');
const path = require('path');

const folder = path.resolve(process.argv[2] || '');
const map = JSON.parse(fs.readFileSync(path.join(folder, 'app-map.json'), 'utf8'));
const root = path.resolve(__dirname, '..');
const SPECS = path.join(root, 'tests/pm-flow');
const norm = t => String(t).toLowerCase().replace(/\s+/g, ' ').trim();

// Everything the crawl saw.
const seen = new Set();
const corpus = [];
const routes = new Set(map.pages.map(p => p.route));
for (const p of map.pages) {
  for (const t of [...p.headings, ...p.tabs, ...p.buttons, ...p.links, ...p.columns, ...p.fields, ...p.menu]) seen.add(norm(t));
  corpus.push(norm(p.text));
}
for (const kids of Object.values(map.menu)) for (const t of kids) seen.add(norm(t));
for (const t of map.header.buttons || []) seen.add(norm(t));
corpus.push(norm(map.header.text || ''));
const big = corpus.join(' \n ');
const found = s => seen.has(norm(s)) || big.includes(norm(s));

// 1. Menu / routes against the map of 2 Nov 2026.
const old = fs.readFileSync(path.join(root, 'docs/functional-discovery/APP_MAP_SWEEP.md'), 'utf8');
const oldRows = [...old.matchAll(/^\| ([^|]+?) \| `?\*{0,2}`?(\/[a-z0-9-]+)`?\*{0,2} \|/gim)].map(m => ({ menu: m[1].replace(/\*/g, '').trim(), route: m[2] }));
const { MENU } = require(path.join(SPECS, 'support/pm-navigator'));
const pmRoutes = Object.entries(MENU).map(([label, e]) => ({ menu: `Project Management › ${label}`, route: `/${e.route}` }));
const before = [...oldRows, ...pmRoutes, { menu: 'Procurement Log', route: '/procurement-log' }, { menu: 'Inventory Management', route: '/inventory-management' }, { menu: 'Enterprise > Supplier Inbox', route: '/supplier-inbox' }];
const redirected = (map.directly || []).filter(d => { const p = map.pages.find(x => x.menu[0].startsWith('(route only)') && x.menu[0].endsWith(d.name.replace(/ > /g, ' › '))); return d.redirected || (p && p.route !== d.route); }).map(d => ({ ...d, landed: (map.pages.find(x => x.menu[0].startsWith('(route only)') && x.menu[0].endsWith(d.name.replace(/ > /g, ' › '))) || {}).route || d.landed }));
const menuPages = map.pages.filter(p => !p.menu[0].startsWith('(route only)'));
const removed = before.filter(r => !menuPages.some(p => p.route === r.route)).map(r => ({ ...r, now: (redirected.find(d => d.route === r.route) || {}).landed || null }));
const knownRoutes = new Set(before.map(r => r.route));
const added = menuPages.filter(p => !knownRoutes.has(p.route));
const moved = [];
for (const r of oldRows) {
  const now = map.pages.find(p => p.route === r.route);
  if (now && norm(now.menu[now.menu.length - 1]) !== norm(r.menu.split('>').pop())) moved.push({ route: r.route, was: r.menu, now: now.menu.join(' › ') });
}

// 2. Labels the specs rely on.
const ID = /['"`]((?:PM|INV|ROLE|UM|PL|APP|SHP|DOC|DSH|ANA|ENT|FDI|SL|TC|T\d{3})(?:-[A-Z0-9]+)+|TC-\d+[A-Z]?)['"`]/g;
const PATTERNS = [
  /getByRole\(\s*'(?:button|tab|heading|columnheader|link|menuitem|textbox|combobox|cell|option)'\s*,\s*\{\s*name:\s*'([^'\\]{3,60})'/g,
  /getByText\(\s*'([^'\\]{3,60})'/g,
  /getByPlaceholder\(\s*'([^'\\]{3,60})'/g,
  /getByLabel\(\s*'([^'\\]{3,60})'/g,
  /\b(?:btn|tabBtn|text|menu|open)\(\s*'([^'\\/]{3,60})'/g,
  /\bopen\(\s*'(\/[a-z0-9-]+)'/g,
  /goto(?:Route)?\(\s*'\/?([a-z][a-z0-9-]+)'/g
];
const IGNORE = /^(cancel|close|save|ok|yes|no|done|add|edit|delete|search|submit|next|back|confirm|apply|clear|remove|upload|export|download)$/i;
const specs = fs.readdirSync(SPECS).filter(f => f.endsWith('.spec.js') && f !== 'app-discovery.spec.js');
const support = fs.readdirSync(path.join(SPECS, 'support')).filter(f => f.endsWith('.js')).map(f => `support/${f}`);
const perFile = [];
for (const f of [...specs, ...support]) {
  const src = fs.readFileSync(path.join(SPECS, f), 'utf8');
  const ids = [...src.matchAll(ID)].map(m => ({ at: m.index, id: m[1] }));
  const near = at => { let id = null; for (const x of ids) { if (x.at > at) break; id = x.id; } return id; };
  const misses = new Map();
  let checked = 0;
  for (const re of PATTERNS) {
    for (const m of src.matchAll(re)) {
      let value = m[1];
      if (IGNORE.test(value)) continue;
      const isRoute = value.startsWith('/') || /^[a-z][a-z0-9-]+$/.test(value);
      if (isRoute && !value.startsWith('/')) value = `/${value}`;
      checked += 1;
      const ok = isRoute ? routes.has(value) || !knownRoutes.has(value) && found(value.slice(1).replace(/-/g, ' ')) : found(value);
      if (ok) continue;
      const line = src.slice(0, m.index).split('\n').length;
      const e = misses.get(value) || { value, kind: isRoute ? 'route' : 'label', lines: [], cases: new Set() };
      e.lines.push(line);
      const id = near(m.index); if (id) e.cases.add(id);
      misses.set(value, e);
    }
  }
  perFile.push({ file: f, checked, misses: [...misses.values()].map(e => ({ ...e, cases: [...e.cases] })) });
}

// Report.
const md = ['# Impact of the staging release on the automation', '', `_Crawl of ${map.crawled.slice(0, 16).replace('T', ' ')} UTC · ${map.project} · Project Admin · ${map.pages.length} pages_`, ''];
md.push('## 1. Menu and pages', '', `Pages reached through the menu: **${map.pages.length}**. Compared with the application map of 2 Nov 2026 and the Project Management routes the automation uses:`, '');
md.push(`- **Pages no longer in the menu (${removed.length}):** ${removed.map(r => `${r.menu} \`${r.route}\`${r.now ? ` (route now opens \`${r.now}\`)` : ' (route opens itself, not listed in the menu)'}`).join('; ') || 'none'}`);
md.push(`- **New pages (${added.length}):** ${added.map(p => `${p.menu.join(' › ')} \`${p.route}\``).join('; ') || 'none'}`);
md.push(`- **Same route, different menu place or name (${moved.length}):** ${moved.map(m => `\`${m.route}\` ${m.was} → ${m.now}`).join('; ') || 'none'}`);
const broken = map.pages.filter(p => p.errorTexts.some(t => !/^errors?_/i.test(t)));
md.push(`- **Pages showing an error text (${broken.length}):** ${broken.map(p => `${p.menu.join(' › ')} ("${p.errorTexts[0]}")`).join('; ') || 'none'}`);
if (map.problems.length) md.push(`- **Menu entries that could not be opened (${map.problems.length}):** ${map.problems.map(p => p.menu.join(' › ')).join('; ')}`);
md.push('', '## 2. Screen texts the automation relies on that the crawl did not find', '', 'Only landing pages are crawled; a label inside a dialog, drawer or detail page shows up here too. Treat each row as a lead to check, not as a confirmed change.', '');
md.push('| File | Labels checked | Not found | Not-found labels (nearest case) |', '|---|---|---|---|');
for (const p of perFile.filter(x => x.checked)) {
  const list = p.misses.slice(0, 25).map(m => `"${m.value}"${m.cases.length ? ` (${m.cases.slice(0, 3).join(', ')})` : ''}`).join('; ') + (p.misses.length > 25 ? ` … +${p.misses.length - 25}` : '');
  md.push(`| ${p.file} | ${p.checked} | ${p.misses.length} | ${list.replace(/\|/g, '/')} |`);
}
fs.writeFileSync(path.join(folder, 'IMPACT.md'), md.join('\n') + '\n');
fs.writeFileSync(path.join(folder, 'impact.json'), JSON.stringify({ removed, added: added.map(p => ({ menu: p.menu, route: p.route })), moved, broken: broken.map(p => ({ menu: p.menu, route: p.route, errors: p.errorTexts })), files: perFile }, null, 1));
console.log(`removed ${removed.length}, added ${added.length}, moved ${moved.length}, error pages ${broken.length}; misses: ${perFile.reduce((n, p) => n + p.misses.length, 0)} → ${path.join(folder, 'IMPACT.md')}`);
