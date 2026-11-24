// Module-wise narrative of the Known Defect and Skipped test cases (user request, 23 Nov 2026): for readers who are not
// testers. One section per module; one block per test case with: what the test checks, the steps, the expected result,
// what actually happened (or why it was not run) and the status.
//
// Usage (from SCP): node scripts/narrative-register.js <full-regression folder>
// Needs DEFECT_CASES.json and SKIPPED_CASES.json (written by scripts/non-pass-report.js).
// Output: KNOWN_DEFECTS_BY_MODULE.md and SKIPPED_BY_MODULE.md in the folder (A4 PDF via md-to-pdf.js).
const fs = require('fs');
const path = require('path');
const { KNOWN_DEFECTS } = require('../config/scp-known-defects');
const { plan } = require('../config/scp-skip-plan');

const folder = path.resolve(process.argv[2] || '');
const read = f => JSON.parse(fs.readFileSync(path.join(folder, f), 'utf8'));
const defects = read('DEFECT_CASES.json').filter(c => c.status === 'Known Defect');
const skipped = read('SKIPPED_CASES.json');
// Plain-language wording (config/scp-plain-language.json, scp-plain-defects.json); cases without an entry keep the generated text.
const loadJson = f => { const file = path.join(__dirname, '..', 'config', f); return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}; };
const PLAIN = loadJson('scp-plain-language.json');
const PLAIN_DEFECTS = loadJson('scp-plain-defects.json');
const GLOSSARY = '**Words used in this document:** PO = purchase order · GRN = goods received note (confirms the delivered quantity) · FDI = first delivery inspection · UoM = unit of measure · Required on site = date the material is needed on site · Submittal = a procurement package of materials for one supplier · Component = one material line of a submittal · Venue / site = the location chosen in the page header · Test record = data the automation created for this run.';

// ---------- helpers ----------
const maskEmail = t => String(t).replace(/\b([a-z0-9])[a-z0-9._%+-]*@(neuralrays\.ai)\b/gi, '$1***@$2');
const clean = t => maskEmail(String(t ?? '').replace(/\s+/g, ' ').trim());
const sentence = t => { const s = clean(t); return !s ? '' : /[.!?)"]$/.test(s) ? s : `${s}.`; };
const split = name => { const s = String(name); const i = s.indexOf('→'); return i < 0 ? [s.trim(), ''] : [s.slice(0, i).trim(), s.slice(i + 1).trim()]; };
const title = t => clean(String(t).replace(/^\[[^\]]+\]\s*/, ''));
const moduleOf = c => /^BUGS-/.test(c.module) ? 'Tickets (BUGS)' : c.module;
const GENERIC = /^(Positive|Negative|Boundary|Integration|Role|Info|Setup|Deferred|Bulk Edit|Dependent|Known Defect|Skipped)$/i;
const subOf = c => /^BUGS-/.test(c.module) ? c.module : (c.submodule && !GENERIC.test(c.submodule) ? c.submodule : '');
const kind = c => { const m = String(c.title).match(/^\[([^\]]+)\]/); return m ? m[1] : (GENERIC.test(c.submodule || '') ? c.submodule : ''); };
const LOGIN = /^Open the Voyage Control SSO login page|^Enter the Project Admin email|^Platform chooser|^Header (project|site) selector/;
// Playwright error → plain words ("Expected X, but the application showed Y").
const plainError = e => {
  const text = clean(e);
  if (!text) return '';
  const first = text.split(/ (?:Expected|expect\(|Received|Call log)/)[0].trim();
  const exp = (text.match(/Expected(?: value| pattern| string)?:\s*(.+?)(?= Received| Call log|$)/) || [])[1];
  const rec = (text.match(/Received(?: value| array| string)?:\s*(.+?)(?= Call log|$)/) || [])[1];
  const parts = [];
  if (first && !/^expect\(|^locator\.|^Error:?$/.test(first)) parts.push(sentence(first.replace(/[:]$/, '')));
  if (exp && rec && !/^(true|false)$/.test(exp) && !/^\//.test(exp)) parts.push(`Expected ${exp.slice(0, 160)}, but the application showed ${rec.slice(0, 200)}.`);
  return parts.join(' ') || sentence(text.slice(0, 300));
};
const byModule = list => {
  const map = new Map();
  for (const c of list) { const m = moduleOf(c); if (!map.has(m)) map.set(m, []); map.get(m).push(c); }
  for (const l of map.values()) l.sort((a, b) => (subOf(a) || '').localeCompare(subOf(b) || '') || a.id.localeCompare(b.id, 'en', { numeric: true }));
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
};
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
const meta = (c, extra) => [subOf(c) && `**Area:** ${clean(subOf(c))}`, kind(c) && `**Type of check:** ${clean(kind(c))}`, ...extra].filter(Boolean).join(' · ');

// ---------- Known Defects ----------
const kdOut = [
  '# SCP – Known Defects by module', '',
  `_Generated ${stamp} UTC from the consolidated regression of 22–23 Nov 2026 (staging, project NRVC_Hall, site "Warehoust _NR")._`, '',
  `Each test case below was run and the application did **not** behave as expected. The difference is recorded as a defect (SCP-DEF-…). "Pending team confirmation" means the expected behaviour is our reading of the requirement and still has to be confirmed by the team; "Registered defect" means it is agreed.`, '',
  GLOSSARY, '',
  `**${defects.length} test cases in ${byModule(defects).length} modules.**`, '',
  '| Module | Test cases | Defects |', '|---|---|---|',
  ...byModule(defects).map(([m, l]) => `| ${m} | ${l.length} | ${[...new Set(l.flatMap(c => c.defects))].join(', ')} |`), ''
];
let n = 0;
for (const [mod, list] of byModule(defects)) {
  kdOut.push(`## ${mod} (${list.length})`, '');
  for (const c of list) {
    n++;
    const steps = c.steps.filter(s => s.status !== 'Blocked' && !LOGIN.test(s.name));
    const bad = steps.find(s => s.status === 'Known Defect') || steps.find(s => s.status === 'Failed') || {};
    const ids = c.defects.length ? c.defects : [bad.defect].filter(Boolean);
    const entries = ids.map(id => KNOWN_DEFECTS.find(d => d.id === id)).filter(Boolean);
    const badIndex = steps.indexOf(bad) + 1;
    const expected = clean(split(bad.name || '')[1]) || clean(entries[0] && entries[0].title);
    const happened = [bad.observed && sentence(`The run recorded: ${clean(bad.observed).slice(0, 400)}`), plainError(bad.error)].filter(Boolean).join(' ')
      || sentence(String((entries[0] || {}).summary || '').replace(/^PENDING TEAM CONFIRMATION\.\s*/, '').slice(0, 400));
    const P = PLAIN[c.id];
    if (P) {
      kdOut.push(`### ${n}. ${c.id} – ${clean(P.title)}`, '');
      kdOut.push(meta(c, ['**Status:** Known Defect']), '');
      kdOut.push(`**What this test checks:** ${sentence(P.description)}`, '');
      kdOut.push('**Steps and expected results:**', '');
      P.steps.forEach((st, i) => kdOut.push(`${i + 1}. ${sentence(st)}`, `   _Expected:_ ${sentence(P.expected[i]) || '–'}`));
      kdOut.push('');
      kdOut.push(`**What actually happened:** ${sentence(P.actual)}`, '');
      for (const d of entries) { const PD = PLAIN_DEFECTS[d.id]; kdOut.push(`**Defect ${d.id}** (${d.confirmation === 'pending' ? 'pending team confirmation' : 'registered defect'}): ${PD ? `${sentence(PD.title)} ${sentence(PD.what_happens)} Expected: ${sentence(PD.expected)}` : sentence(d.title)}`, ''); }
      continue;
    }
    kdOut.push(`### ${n}. ${c.id} – ${title(c.title)}`, '');
    kdOut.push(meta(c, [`**Status:** Known Defect`]), '');
    kdOut.push('**Steps followed:**', '');
    if (steps.length) steps.forEach((s, i) => kdOut.push(`${i + 1}. ${clean(split(s.name)[0])}${s === bad ? ' **← the difference was found here**' : ''}`));
    else kdOut.push(`1. ${c.coveredBy ? `Checked as part of ${clean(c.coveredBy)}` : 'See the defect description'}`);
    kdOut.push('');
    kdOut.push(`**Expected result${badIndex ? ` (step ${badIndex})` : ''}:** ${sentence(expected) || '–'}`, '');
    kdOut.push(`**What actually happened:** ${happened || '–'}`, '');
    for (const d of entries) kdOut.push(`**Defect ${d.id}** (${d.confirmation === 'pending' ? 'pending team confirmation' : 'registered defect'}): ${sentence(d.title)}`, '');
  }
}
fs.writeFileSync(path.join(folder, 'KNOWN_DEFECTS_BY_MODULE.md'), kdOut.join('\n'));

// ---------- Skipped (steps and expected result from the scenario documents) ----------
const cells = line => line.trim().replace(/^\||\|$/g, '').split('|').map(x => x.trim());
const docs = [];
(function walk(dir) { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.md')) docs.push(p); } })(path.join(__dirname, '..', 'docs', 'functional-discovery'));
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
// Plain steps and expected results for skipped cases whose scenario document only holds a note (written 23 Nov 2026).
const OVERRIDE = {
  'DOC-REG-11': { steps: ['Document Management: upload a purchase order (PDF) that matches a run submittal', 'Run "PO validation" on it', 'Compare each PO line item with the Procurement Log components of that submittal'], expected: 'Every line item is matched to its Procurement Log component and the PO is shown as valid.' },
  'DOC-REG-12': { steps: ['Document Management: upload a bill of materials (BOM) for a run submittal', 'Run "BOM validation" on it', 'Compare the BOM items and quantities with the Procurement Log'], expected: 'Items and quantities that match are shown as valid; any difference is listed.' },
  'DOC-REG-16': { steps: ['Document Management: open "Scan Procore for EPDs" on a project linked to Procore', 'Start the scan and wait for it to finish'], expected: 'The Environmental Product Declarations found in Procore are listed against their materials.' },
  'ENT-REG-02': { steps: ['Create a run component with a lead time that the supplier has not confirmed', 'Create a delivery whose pre-shipping checklist is still pending', 'Open Enterprise › Supplier Inbox'], expected: 'The component is listed under "Unconfirmed Lead Times" and the delivery under "Pending Pre-Shipping".' },
  'ENT-REG-03': { steps: ['Open the Enterprise page with its table of rows', 'Click "Download CSV"', 'Compare the downloaded file with the table on screen'], expected: 'The CSV has the same rows and values as the table.' },
  'FDI-REG-12': { steps: ['First Delivery Inspections: open a completed inspection on a project linked to Procore', 'Click "Sync to Provider"'], expected: 'Provider Sync changes from "Not synced" to synced, and the inspection appears in Procore.' },
  'INV-REG-21': { steps: ['Log a delivery in which some units are marked as damaged', 'Open Inventory Management for the delivery site', 'Read the Incoming Load of the material'], expected: 'Incoming Load equals the delivered quantity including the damaged units (rule PL-R16).' },
  'INV-REG-24': { steps: ['Inventory Management › History: set the date filter From and To to the same day', 'Apply the filter'], expected: 'All activities of that day are listed (the range includes both ends).' },
  'INV-REG-25': { steps: ['Inventory Management: open an activity date picker', 'Select a date'], expected: 'The date is selected and the page keeps working (today the picker freezes the browser tab – SCP-DEF-002).' },
  'DSH-REG-10': { steps: ['Day 1: create run submittals that fall inside the alert window', 'Day 2, after the 05:00–06:00 IST batch: open Management Dashboard › Alerts'], expected: 'The daily batch has raised the alerts for the day-1 submittals.' },
  'T508-17': { steps: ['Bulk upload a file in which every row fails', 'Bulk upload a file that has only errors and no valid rows', 'Open Bulk Upload Status for both uploads'], expected: 'The fully failed upload shows "Failed", and the error-only upload is not shown as "Success" (BUG-7, R20).' },
  'T548-04': { steps: ['Create a question set in an organisation', 'Open a project of the same organisation', 'Open a project of another organisation'], expected: 'The set is listed in the project of the same organisation and not in the project of the other organisation.' },
  'T548-11': { steps: ['Use a question set that contains a bank question that has since been deleted (prepared by the developers)', 'Create or open the inspection form from that set'], expected: 'The deleted bank question is skipped and the rest of the set works.' },
  'T548-12': { steps: ['Open the same question set create flow in two browser tabs', 'Make one save fail while the other succeeds (manual race)'], expected: 'The set is created completely or not at all – no half-created set is left.' },
  'T548-16': { steps: ['Use a bank question in an organisation question set of any project of the organisation', 'Try to edit the bank question', 'Try to delete the bank question'], expected: 'The question can be neither edited nor deleted (confirmed by the user, 22 Nov 2026).' },
  'T548-18': { steps: ['Sign in with a view-only account', 'Open the question bank and the question sets'], expected: 'The account can view but cannot create, edit or delete questions or sets.' }
};
const GROUP = {
  A: 'Automation work still to be done',
  B: 'Waiting for a decision or approval',
  C: 'Needs an account or test data that is not available',
  D: 'Needs a requirement to know the expected result',
  E: 'Can only be checked by hand',
  X: 'Deferred – out of scope for now (user decision)'
};
const skOut = [
  '# SCP – Skipped test cases by module', '',
  `_Generated ${stamp} UTC from the consolidated regression of 22–23 Nov 2026 (staging, project NRVC_Hall, site "Warehoust _NR")._`, '',
  'Each test case below was **not run** in this regression. For every case the document gives what the test would check, its steps, the expected result, why it was not run and what is needed before it can run.', '',
  GLOSSARY, '',
  `**${skipped.length} test cases in ${byModule(skipped).length} modules.**`, '',
  '| Reason group | Test cases |', '|---|---|',
  ...Object.entries(GROUP).map(([g, t]) => [t, skipped.filter(c => (plan[c.id] || {}).group === g).length]).filter(([, k]) => k).map(([t, k]) => `| ${t} | ${k} |`),
  ...(skipped.some(c => !GROUP[(plan[c.id] || {}).group]) ? [`| Not classified | ${skipped.filter(c => !GROUP[(plan[c.id] || {}).group]).length} |`] : []), '',
  '| Module | Test cases |', '|---|---|',
  ...byModule(skipped).map(([m, l]) => `| ${m} | ${l.length} |`), ''
];
n = 0;
for (const [mod, list] of byModule(skipped)) {
  skOut.push(`## ${mod} (${list.length})`, '');
  for (const c of list) {
    n++;
    const def = rows.get(c.id); const p = plan[c.id] || {};
    let steps = pick(def, /Steps|Scenario|What/i) || (def && def.header.length > 3 ? def.row[def.header.length - 2] : '');
    let expected = pick(def, /^Expected/i);
    if (!expected && steps.includes('→')) [steps, expected] = split(steps);
    const list2 = clean(steps.replace(/\*\*/g, '')).split(/\s*(?:;|→ then| then )\s*/).filter(Boolean);
    const docTitle = clean(pick(def, /^Title$/i).replace(/\*\*/g, ''));
    const o = OVERRIDE[c.id]; if (o) { list2.splice(0, list2.length, ...o.steps); expected = o.expected; }
    const P = PLAIN[c.id];
    if (P) {
      skOut.push(`### ${n}. ${c.id} – ${clean(P.title)}`, '');
      skOut.push(meta(c, ['**Status:** Skipped (not run)']), '');
      skOut.push(`**What this test would check:** ${sentence(P.description)}`, '');
      skOut.push('**Planned steps and expected results:**', '');
      P.steps.forEach((st, i) => skOut.push(`${i + 1}. ${sentence(st)}`, `   _Expected:_ ${sentence(P.expected[i]) || '–'}`));
      skOut.push('');
      skOut.push(`**Why it was not run:** ${sentence(String(P.actual).replace(/^Not run:\s*/i, ''))}`, '');
      skOut.push(`**What is needed:** ${GROUP[p.group] || 'Not classified'}${P.needed ? ` – ${sentence(P.needed)}` : p.need ? ` – ${sentence(p.need)}` : '.'}${p.owner ? ` _Owner: ${clean(p.owner)}._` : ''}`, '');
      continue;
    }
    skOut.push(`### ${n}. ${c.id} – ${docTitle || title(c.title)}`, '');
    skOut.push(meta(c, ['**Status:** Skipped (not run)']), '');
    skOut.push('**Steps (planned):**', '');
    if (list2.length) list2.forEach((s, i) => skOut.push(`${i + 1}. ${s}`));
    else skOut.push(`1. ${title(c.title)}`);
    skOut.push('');
    skOut.push(`**Expected result:** ${sentence(expected.replace(/\*\*/g, '')) || 'To be confirmed.'}`, '');
    skOut.push(`**Why it was not run:** ${sentence(c.reason) || '–'}`, '');
    skOut.push(`**What is needed:** ${GROUP[p.group] || 'Not classified'}${p.need ? ` – ${sentence(p.need)}` : '.'}${p.owner ? ` _Owner: ${clean(p.owner)}._` : ''}`, '');
  }
}
fs.writeFileSync(path.join(folder, 'SKIPPED_BY_MODULE.md'), skOut.join('\n'));
console.log(`Narrative by module: ${defects.length} known-defect and ${skipped.length} skipped case(s) -> ${path.relative(process.cwd(), folder)}`);
