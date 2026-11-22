// Human-readable test case registers (user request, 22 Nov 2026): one row per test case with the columns
//   No | Module | Sub-module | Description | Steps | Expected result | Actual result | Status
// written in plain language, for the Known Defect cases and the Skipped cases (A4 landscape PDF via md-to-pdf.js).
//
// Usage (from SCP): node scripts/testcase-register.js <full-regression folder>
// Needs DEFECT_CASES.json and SKIPPED_CASES.json (written by scripts/non-pass-report.js).
// Output: TEST_CASES_KNOWN_DEFECTS.md and TEST_CASES_SKIPPED.md in the folder.
const fs = require('fs');
const path = require('path');
const { KNOWN_DEFECTS } = require('../config/scp-known-defects');
const { GROUPS, plan } = require('../config/scp-skip-plan');

const folder = path.resolve(process.argv[2] || '');
const read = f => JSON.parse(fs.readFileSync(path.join(folder, f), 'utf8'));
const defects = read('DEFECT_CASES.json').filter(c => c.status === 'Known Defect');
const skipped = read('SKIPPED_CASES.json');
const passed = fs.existsSync(path.join(folder, 'PASSED_CASES.json')) ? read('PASSED_CASES.json') : [];

// ---------- helpers ----------
const BR = ' ¶ '; // line break inside a table cell (md-to-pdf.js turns it into <br>)
const cell = t => String(t ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
const split = name => { const i = String(name).indexOf('→'); return i < 0 ? [String(name).trim(), ''] : [name.slice(0, i).trim(), name.slice(i + 1).trim()]; };
const description = t => cell(String(t).replace(/^\[[^\]]+\]\s*/, ''));
const moduleOf = c => /^BUGS-/.test(c.module) ? 'Tickets (BUGS)' : c.module;
const subOf = c => /^BUGS-/.test(c.module) ? c.module : (c.submodule && !/^(Positive|Negative|Boundary|Integration|Role|Info|Setup|Deferred|Bulk Edit|Dependent)$/i.test(c.submodule) ? c.submodule : '–');
// Plain-language actual result from a Playwright error: "Expected: X / Received: Y" → "Expected X, but the app showed Y".
const plainError = e => {
  const text = String(e || '').replace(/\s+/g, ' ').trim();
  const first = text.split(/ (?:Expected|expect\(|Received|Call log)/)[0].trim();
  const exp = (text.match(/Expected(?: value| pattern| string)?:\s*(.+?)(?= Received| Call log|$)/) || [])[1];
  const rec = (text.match(/Received(?: value| array| string)?:\s*(.+?)(?= Call log|$)/) || [])[1];
  const parts = [];
  if (first && !/^expect\(|^locator\./.test(first)) parts.push(first.replace(/[.:]$/, '') + '.');
  if (exp && rec) parts.push(`Expected ${exp.slice(0, 160)}, but the application showed ${rec.slice(0, 200)}.`);
  return parts.join(' ') || text.slice(0, 300);
};
const order = (a, b) => moduleOf(a).localeCompare(moduleOf(b)) || subOf(a).localeCompare(subOf(b)) || a.id.localeCompare(b.id, 'en', { numeric: true });

// ---------- Known Defect register ----------
const kdRows = defects.sort(order).map((c, i) => {
  const steps = c.steps.filter(s => s.status !== 'Blocked');
  const bad = steps.find(s => s.status === 'Known Defect') || steps.find(s => s.status === 'Failed') || {};
  const ids = c.defects.length ? c.defects : [bad.defect].filter(Boolean);
  const entry = KNOWN_DEFECTS.find(d => d.id === ids[0]) || {};
  const stepText = steps.map((s, n) => `${n + 1}. ${cell(split(s.name)[0])}`).join(BR) || cell(c.coveredBy ? `Checked by ${c.coveredBy}` : '–');
  const expected = cell(split(bad.name || '')[1]) || cell(entry.title) || '–';
  const actual = [bad.observed ? cell(bad.observed).slice(0, 400) : '', plainError(bad.error)].filter(Boolean).join(BR) || cell(String(entry.summary || '').replace(/^PENDING TEAM CONFIRMATION\.\s*/, '').slice(0, 400));
  const status = `**Known Defect** ${BR}${ids.join(', ')}${BR}${entry.confirmation === 'pending' ? 'Pending team confirmation' : 'Registered defect'}${entry.title ? `${BR}_${cell(entry.title)}_` : ''}`;
  return `| ${i + 1} | ${cell(moduleOf(c))} | ${cell(subOf(c))} | **${cell(c.id)}**${BR}${description(c.title)} | ${stepText} | ${expected} | ${actual} | ${status} |`;
});

// ---------- Skipped register (steps and expected result from the scenario documents) ----------
const cells = line => line.trim().replace(/^\||\|$/g, '').split('|').map(x => x.trim());
const docs = [];
(function walk(dir) { for (const n of fs.readdirSync(dir)) { const p = path.join(dir, n); if (fs.statSync(p).isDirectory()) walk(p); else if (n.endsWith('.md')) docs.push(p); } })(path.join(__dirname, '..', 'docs', 'functional-discovery'));
const rows = new Map();
for (const file of docs) {
  let header = null;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!/^\s*\|/.test(line)) { header = null; continue; }
    if (!header) { header = cells(line); continue; }
    if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) continue;
    const row = cells(line); const id = row[0].replace(/\*\*/g, '');
    if (/^[A-Z][A-Z0-9]+(-[A-Z0-9]+)+[a-z]?$/.test(id) && !rows.has(id)) rows.set(id, { header, row });
  }
}
const pick = (def, re) => { if (!def) return ''; const i = def.header.findIndex(h => re.test(h)); return i >= 0 ? def.row[i] || '' : ''; };
const SHORT = { A: 'Automation work pending', B: 'Waiting for a decision / approval', C: 'Needs an account or test data', D: 'Needs a requirement', E: 'Manual check only', X: 'Deferred (out of scope for now)' };
const skRows = skipped.sort(order).map((c, i) => {
  const def = rows.get(c.id); const p = plan[c.id] || {};
  let steps = pick(def, /Steps|Scenario|What/i) || (def && def.header.length > 3 ? def.row[def.header.length - 2] : '');
  let expected = pick(def, /^Expected/i);
  if (!expected && steps.includes('→')) { [steps, expected] = split(steps); }
  const numbered = cell(steps).split(/\s*(?:;|→ then| then )\s*/).filter(Boolean).map((s, n) => `${n + 1}. ${s}`).join(BR) || '–';
  const docTitle = pick(def, /^Title$/i);
  return `| ${i + 1} | ${cell(moduleOf(c))} | ${cell(subOf(c))} | **${cell(c.id)}**${BR}${cell(docTitle || description(c.title))} | ${numbered} | ${cell(expected) || '–'} | Not executed.${BR}${cell(c.reason)} | **Skipped**${BR}${SHORT[p.group] || 'Not classified'}${p.need ? `${BR}_Needed: ${cell(p.need)}_` : ''} |`;
});

// ---------- Passed register ----------
const psRows = passed.sort(order).map((c, i) => {
  const steps = c.steps.filter(s => !/^Open the Voyage Control SSO login page|^Enter the Project Admin email|^Platform chooser|^Header (project|site) selector/.test(s.name));
  const stepText = steps.map((s, n) => `${n + 1}. ${cell(split(s.name)[0])}`).join(BR) || (c.coveredBy ? `Checked by ${cell(c.coveredBy)}` : '–');
  const expected = steps.map((s, n) => split(s.name)[1] ? `${n + 1}. ${cell(split(s.name)[1])}` : '').filter(Boolean).join(BR) || '–';
  const notes = steps.map((s, n) => s.observed ? `${n + 1}. ${cell(s.observed).slice(0, 220)}` : '').filter(Boolean).join(BR);
  const retried = steps.some(s => s.retried);
  const actual = `As expected.${notes ? `${BR}${notes}` : ''}${c.coveredBy ? `${BR}Covered by: ${cell(c.coveredBy)}` : ''}`;
  return `| ${i + 1} | ${cell(moduleOf(c))} | ${cell(subOf(c))} | **${cell(c.id)}**${BR}${description(c.title)} | ${stepText} | ${expected} | ${actual} | **Passed**${retried ? `${BR}_passed on retry_` : ''} |`;
});

// ---------- write ----------
const head = (title, intro, count) => [
  `# ${title}`, '',
  `_Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC from the consolidated results in \`${path.basename(folder)}\` plus re-runs._`, '',
  intro, '', `**${count} test case(s).**`, '',
  '| No | Module | Sub-module | Description | Steps | Expected result | Actual result | Status |',
  '|---|---|---|---|---|---|---|---|'
];
const byModule = list => [...new Set(list.map(moduleOf))].map(m => `${m} ${list.filter(c => moduleOf(c) === m).length}`).join(' · ');
fs.writeFileSync(path.join(folder, 'TEST_CASES_KNOWN_DEFECTS.md'), [
  ...head('SCP – Known Defect test cases',
    `Each test case below ran, and the application did **not** behave as expected. The difference is recorded as a defect (ID in the Status column). "Pending team confirmation" means the expected behaviour still needs to be confirmed by the client/team. By module: ${byModule(defects)}.`, defects.length),
  ...kdRows, ''].join('\n'));
fs.writeFileSync(path.join(folder, 'TEST_CASES_SKIPPED.md'), [
  ...head('SCP – Skipped test cases',
    `Each test case below was **not executed** in this run. The Actual result column gives the reason; the Status column says what is needed before it can run. By module: ${byModule(skipped)}.`, skipped.length),
  ...skRows, ''].join('\n'));
if (passed.length) fs.writeFileSync(path.join(folder, 'TEST_CASES_PASSED.md'), [
  ...head('SCP – Passed test cases',
    `Each test case below ran and the application behaved as expected. Steps and expected results are numbered alike; the Actual result column shows what the run recorded. By module: ${byModule(passed)}.`, passed.length),
  ...psRows, ''].join('\n'));
console.log(`Passed register: ${passed.length} case(s)`);
console.log(`Known Defect register: ${defects.length} case(s); Skipped register: ${skipped.length} case(s) -> ${path.relative(process.cwd(), folder)}`);
