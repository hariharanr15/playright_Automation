// Merges and validates the plain-language wording of the test cases and defects (23 Nov 2026).
// Usage (from SCP): node scripts/plain-language-merge.js <dir with in/ and out/> <full-regression folder>
//   in/*.json  – the cases as exported from the run (id, status, defects …)
//   out/*.json – the plain wording keyed by case ID (out/defects.json keyed by defect ID)
// Writes config/scp-plain-language.json and config/scp-plain-defects.json and prints every problem found.
const fs = require('fs');
const path = require('path');

const dir = path.resolve(process.argv[2] || '');
const folder = process.argv[3] ? path.resolve(process.argv[3]) : '';
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const problems = [];
const cases = {};
// Only the finished batch files (one per input file); temporary part files of the writers are ignored.
for (const f of fs.readdirSync(path.join(dir, 'in')).filter(f => f.endsWith('.json') && f !== 'defects.json')) if (fs.existsSync(path.join(dir, 'out', f))) Object.assign(cases, read(path.join(dir, 'out', f)));
// Hand-written entries (new cases, corrections) win over the batch files: config/scp-plain-language-manual.json.
const manualFile = path.join(__dirname, '..', 'config', 'scp-plain-language-manual.json');
if (fs.existsSync(manualFile)) Object.assign(cases, read(manualFile));
const input = new Map();
for (const f of fs.readdirSync(path.join(dir, 'in')).filter(f => f.endsWith('.json') && f !== 'defects.json')) for (const c of read(path.join(dir, 'in', f))) input.set(c.id, c);

// Words that must not reach a business reader.
const BAD = [/\bOBS-[A-Z]+-?\d+/, /\b(?:PL|INV|APP|PM)-R\d+\b/, /\bQ-[A-Z]+-\d+\b/, /\bANA-(?:F|DEF-)\d+/, /\b(?:APR|PLT|PLR|PLS|PLD|CFL|PMR2?|TKT|E2E)\d{8,}/i, /expect\(|toBe\(|locator\.|Received:|Call log/, /[|¶]/];
for (const [id, c] of input) {
  const P = cases[id];
  if (!P) { problems.push(`${id}: no plain entry`); continue; }
  for (const k of ['title', 'description', 'steps', 'expected', 'actual']) if (!P[k] || (Array.isArray(P[k]) && !P[k].length)) problems.push(`${id}: missing ${k}`);
  if (Array.isArray(P.steps) && Array.isArray(P.expected) && P.steps.length !== P.expected.length) problems.push(`${id}: ${P.steps.length} steps vs ${P.expected.length} expected`);
  if (c.status === 'Passed' && !/^As expected/.test(P.actual || '')) problems.push(`${id}: Passed but actual does not start "As expected"`);
  if (c.status === 'Skipped' && !/^Not run/.test(P.actual || '')) problems.push(`${id}: Skipped but actual does not start "Not run"`);
  if (c.status === 'Known Defect') for (const d of c.defects.map(x => x.id)) if (!(P.actual || '').includes(d)) problems.push(`${id}: actual does not name ${d}`);
  const text = [P.title, P.description, ...(P.steps || []), ...(P.expected || []), P.actual, P.needed].join(' ');
  for (const re of BAD) if (re.test(text)) problems.push(`${id}: contains ${text.match(re)[0]}`);
}
const extra = Object.keys(cases).filter(id => !input.has(id));
const defects = fs.existsSync(path.join(dir, 'out', 'defects.json')) ? read(path.join(dir, 'out', 'defects.json')) : {};
const { KNOWN_DEFECTS } = require('../config/scp-known-defects');
for (const d of KNOWN_DEFECTS) if (!defects[d.id]) problems.push(`${d.id}: no plain defect entry`);
const ordered = Object.fromEntries(Object.keys(cases).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).map(id => [id, cases[id]]));
fs.writeFileSync(path.join(__dirname, '..', 'config', 'scp-plain-language.json'), JSON.stringify(ordered, null, 1) + '\n');
fs.writeFileSync(path.join(__dirname, '..', 'config', 'scp-plain-defects.json'), JSON.stringify(defects, null, 1) + '\n');
console.log(`${Object.keys(ordered).length} plain case(s) (${extra.length} not in this run's input), ${Object.keys(defects).length} plain defect(s); ${problems.length} problem(s)`);
for (const p of problems) console.log(`  - ${p}`);
if (folder && fs.existsSync(folder)) {
  const ids = ['PASSED_CASES.json', 'DEFECT_CASES.json', 'SKIPPED_CASES.json'].flatMap(f => read(path.join(folder, f)).filter(c => f !== 'DEFECT_CASES.json' || c.status === 'Known Defect').map(c => c.id));
  const missing = ids.filter(id => !ordered[id]);
  console.log(`Current results: ${ids.length} case(s), ${missing.length} without plain wording${missing.length ? `: ${missing.join(', ')}` : ''}`);
}
