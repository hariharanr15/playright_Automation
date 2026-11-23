// Open Skipped test cases, one block per case, for the team to decide how to close each one.
// Joins: SKIPPED_CASES.json (written by scripts/non-pass-report.js from the consolidated results), the scenario row of
// each case in docs/functional-discovery/*.md (description, steps, expected result) and config/scp-skip-plan.js
// (group, what is needed, owner, effort).
//
// Usage (from SCP): node scripts/skipped-cases-report.js <full-regression folder>
// Output: OPEN_SKIPPED_TEST_CASES.md in that folder (turn it into a PDF with scripts/md-to-pdf.js).
const fs = require('fs');
const path = require('path');
const { GROUPS, plan } = require('../config/scp-skip-plan');

const folder = path.resolve(process.argv[2] || '');
const dataFile = path.join(folder, 'SKIPPED_CASES.json');
if (!fs.existsSync(dataFile)) { console.error('Run scripts/non-pass-report.js first: SKIPPED_CASES.json not found in', folder); process.exit(1); }
const skipped = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

// ---------- Scenario rows from the discovery documents (first definition of an ID wins) ----------
const cells = line => line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
const docs = [];
(function walk(dir) { for (const name of fs.readdirSync(dir)) { const p = path.join(dir, name); if (fs.statSync(p).isDirectory()) walk(p); else if (name.endsWith('.md')) docs.push(p); } })(path.join(__dirname, '..', 'docs', 'functional-discovery'));
const rows = new Map();
for (const file of docs) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  let header = null; let section = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^#{1,4}\s/.test(line)) section = line.replace(/^#+\s*/, '');
    if (!/^\s*\|/.test(line)) { header = null; continue; }
    if (!header) { header = cells(line); continue; }
    if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) continue;
    const row = cells(line);
    const id = row[0].replace(/\*\*/g, '');
    if (/^[A-Z][A-Z0-9]+(-[A-Z0-9]+)+[a-z]?$/.test(id) && !rows.has(id)) rows.set(id, { header, row, file: path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/'), section });
  }
}

// ---------- Helpers ----------
const cell = value => String(value ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
const pick = (def, names) => { if (!def) return ''; const i = def.header.findIndex(h => names.test(h)); return i >= 0 ? def.row[i] || '' : ''; };
const LEGEND_TYPE = { POS: 'Positive', NEG: 'Negative', BND: 'Boundary', INT: 'Integration', ROLE: 'Role', INFO: 'Info' };
const LEGEND_IMPACT = { C: 'Critical', M: 'Major', R: 'Minor' };

// ---------- Build ----------
const items = skipped.map(item => {
  const def = rows.get(item.id);
  const p = plan[item.id] || { group: '?', owner: '?', effort: '?', need: 'Not classified yet.' };
  // Tables without a Steps column (e.g. "| ID | Title | Type | Impact | Rule | Ev. |") keep the check in the column before Ev.
  const steps = pick(def, /Steps|Scenario|What/i) || (def && def.header.length > 3 ? def.row[def.header.length - 2] || '' : '');
  const expected = pick(def, /^Expected/i);
  const type = pick(def, /^Type$/i); const impact = pick(def, /^Impact$/i); const evidence = pick(def, /^Ev/i);
  const docTitle = pick(def, /^Title$/i);
  return { ...item, title: docTitle && !/^\[/.test(docTitle) && /^(Role-based access|.{0,3})$/.test(item.title.replace(/^\[[^\]]+\]\s*/, '')) ? docTitle : item.title, def, p, steps, expected, type: LEGEND_TYPE[type] || type, impact: LEGEND_IMPACT[impact] || impact, evidence };
});
const order = Object.keys(GROUPS);
items.sort((a, b) => order.indexOf(a.p.group) - order.indexOf(b.p.group) || a.module.localeCompare(b.module) || a.id.localeCompare(b.id, 'en', { numeric: true }));

const lines = [
  '# SCP – Open Skipped test cases',
  '',
  `_Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC by \`scripts/skipped-cases-report.js\` from the consolidated full-regression results (\`${path.basename(folder)}\` plus re-runs)._`,
  '',
  `**${items.length} test cases are still Skipped.** Each one below shows what the case checks (from the scenario documents), why it is not executed today, and what is needed to close it. Cases are grouped by what unblocks them.`,
  '',
  '## Summary by what closes them',
  '',
  '| Group | Meaning | Cases | Who acts first |',
  '|---|---|---|---|',
  ...order.map(g => {
    const inGroup = items.filter(item => item.p.group === g);
    const owners = [...new Set(inGroup.map(item => item.p.owner))].join(', ');
    return `| **${g}** | ${GROUPS[g]} | ${inGroup.length} | ${cell(owners)} |`;
  }),
  `| | **Total** | **${items.length}** | |`,
  '',
  '## Summary by module',
  '',
  '| Module | A | B | C | D | E | Total |',
  '|---|---|---|---|---|---|---|',
  ...[...new Set(items.map(item => item.module))].sort().map(module => {
    const inModule = items.filter(item => item.module === module);
    return `| ${cell(module)} | ${order.map(g => inModule.filter(item => item.p.group === g).length || '').join(' | ')} | ${inModule.length} |`;
  }),
  '',
  '## Index',
  '',
  '| # | Group | Module | Test case | What is needed to close it | Owner |',
  '|---|---|---|---|---|---|',
  ...items.map((item, i) => `| ${i + 1} | ${item.p.group} | ${cell(item.module)} | ${cell(item.id)} – ${cell(item.title)} | ${cell(item.p.need)} | ${cell(item.p.owner)} |`),
  ''
];

// One block per case (used by both documents).
const caseBlock = (item, { withGroup = false } = {}) => {
  const out = [`### ${item.id} – ${item.title.replace(/^\[[^\]]+\]\s*/, '')}`, '', '| Field | Value |', '|---|---|'];
  out.push(`| Module | ${cell(item.module)}${item.submodule ? ` › ${cell(item.submodule)}` : ''} |`);
  out.push(`| Suite | ${cell(item.suite)} |`);
  if (item.navPath.length) out.push(`| Where in the app | ${cell(item.navPath.join(' › '))} |`);
  if (item.type || item.impact) out.push(`| Type / impact | ${cell([item.type, item.impact].filter(Boolean).join(' · '))} |`);
  out.push(`| Test description | ${cell(item.title.replace(/^\[[^\]]+\]\s*/, ''))} |`);
  if (item.steps) out.push(`| Steps${item.expected ? '' : ' → expected result'} | ${cell(item.steps)} |`);
  if (item.expected) out.push(`| Expected result | ${cell(item.expected)} |`);
  if (item.def) out.push(`| Defined in | \`${cell(item.def.file)}\`${item.def.section ? ` – ${cell(item.def.section)}` : ''} |`);
  out.push(`| Why it is skipped today | ${cell(item.reason)} |`);
  if (item.p.blocker) out.push(`| Current blocker | ${cell(item.p.blocker)} |`);
  if (withGroup) out.push(`| Closure group | **${item.p.group}** – ${cell(GROUPS[item.p.group] || '')} |`);
  out.push(`| What is needed to close it | **${cell(item.p.need)}** |`);
  out.push(`| Who acts first | ${cell(item.p.owner)} |`, `| Automation effort once unblocked | ${cell(item.p.effort)} |`, '');
  return out;
};

for (const g of order) {
  const inGroup = items.filter(item => item.p.group === g);
  if (!inGroup.length) continue;
  lines.push(`## Group ${g} – ${GROUPS[g]} (${inGroup.length})`, '');
  for (const item of inGroup) lines.push(...caseBlock(item));
}

// ---------- Second document: the same cases, module by module ----------
const moduleName = item => /^BUGS-/.test(item.module) ? `Tickets (BUGS) › ${item.module}` : item.module;
const modules = [...new Set(items.map(moduleName))].sort((a, b) => (/^Tickets/.test(a) - /^Tickets/.test(b)) || a.localeCompare(b));
const byModule = [
  '# SCP – Open Skipped test cases by module',
  '',
  `_Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC by \`scripts/skipped-cases-report.js\` from the consolidated full-regression results (\`${path.basename(folder)}\` plus re-runs)._`,
  '',
  `**${items.length} test cases are still Skipped.** Each module lists its cases with the test description, the steps and expected result (from the scenario documents), why the case is skipped today and what is needed to close it. Closure groups: ${order.map(g => `**${g}** ${GROUPS[g].toLowerCase()}`).join(' · ')}.`,
  '',
  '## Summary by module',
  '',
  `| Module | Skipped | ${order.join(' | ')} |`,
  `|---|---|${order.map(() => '---').join('|')}|`,
  ...modules.map(m => { const inM = items.filter(item => moduleName(item) === m); return `| ${cell(m)} | ${inM.length} | ${order.map(g => inM.filter(item => item.p.group === g).length || '').join(' | ')} |`; }),
  `| **Total** | **${items.length}** | ${order.map(g => items.filter(item => item.p.group === g).length).join(' | ')} |`,
  ''
];
for (const m of modules) {
  const inM = items.filter(item => moduleName(item) === m).sort((a, b) => (a.submodule || '').localeCompare(b.submodule || '') || a.id.localeCompare(b.id, 'en', { numeric: true }));
  byModule.push(`## ${m} (${inM.length})`, '', '| # | Test case | Test description | Group | What is needed to close it |', '|---|---|---|---|---|',
    ...inM.map((item, i) => `| ${i + 1} | ${cell(item.id)} | ${cell(item.title.replace(/^\[[^\]]+\]\s*/, ''))} | ${item.p.group} | ${cell(item.p.need)} |`), '');
  for (const item of inM) byModule.push(...caseBlock(item, { withGroup: true }));
}
fs.writeFileSync(path.join(folder, 'OPEN_SKIPPED_TEST_CASES_BY_MODULE.md'), byModule.join('\n'));

const missing = items.filter(item => item.p.group === '?').map(item => item.id);
if (missing.length) lines.push('## Not classified yet', '', missing.join(', '), '');
const output = path.join(folder, 'OPEN_SKIPPED_TEST_CASES.md');
fs.writeFileSync(output, lines.join('\n'));
console.log(`${items.length} open Skipped cases (${order.map(g => `${g} ${items.filter(item => item.p.group === g).length}`).join(', ')}${missing.length ? `, unclassified ${missing.length}` : ''}) -> ${path.relative(process.cwd(), output)}`);
