// SCP full regression (PM-flow framework) + E2E smoke, one suite after another, each recorded on video (MP4), then one
// consolidated A4 PDF.  npm run full:regression   [--only=pm-smoke,e2e-smoke]  [--headless]
// Order = the last complete rerun (10 Nov 2026); Procurement Log part 1 runs right before Inventory (its full delivery
// stocks the material Inventory needs). Each suite keeps its own report folder under reports/pm-flow/.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const SUITES = [
  { suite: 'app-regression', npm: 'modules:regression', title: 'Other modules regression' },
  { suite: 'tickets', npm: 'tickets:regression', title: 'Ticket regression (BUGS)' },
  { suite: 'regression', npm: 'pm:regression', title: 'Project Management regression part 1' },
  { suite: 'pl-regression2', npm: 'procurement:regression2', title: 'Procurement Log regression part 2' },
  { suite: 'regression2', npm: 'pm:regression2', title: 'Project Management regression part 2' },
  { suite: 'pl-regression', npm: 'procurement:regression', title: 'Procurement Log regression part 1' },
  { suite: 'inv-regression', npm: 'inventory:regression', title: 'Inventory regression' },
  { suite: 'pl-regression3', npm: 'procurement:regression3', title: 'Procurement Log regression part 3' },
  // FDI-REG-06…10 need an "Auditor Not Yet Assigned" inspection that Procurement Log part 3 creates (new material →
  // delivery → GRN → FDI row). Other modules runs first, before that record exists, so these cases always skipped there;
  // they run again here, right after part 3. Select with --only=fdi-followup.
  { suite: 'app-regression', key: 'fdi-followup', npm: 'modules:regression', title: 'FDI follow-up (after Procurement Log part 3)',
    only: 'FDI-REG-06,FDI-REG-07,FDI-REG-08,FDI-REG-09,FDI-REG-10' },
  // Added 22 Nov 2026. FDI settings needs the free run inspections that Procurement Log part 3 creates; the Configuration
  // Options suite switches Pre-Shipping / GRN (restored) and seeds the next alert batch; the role suite only reads.
  // Not part of the regular run (they create a project/user or delete run data each time): roles-write, fresh-project,
  // pm-decisions – run them on their own when needed.
  { suite: 'fdi-settings', npm: 'fdi-settings', title: 'FDI settings → inspection form' },
  { suite: 'cfg-live', npm: 'cfg-live', title: 'Configuration Options live effects (Pre-Shipping, GRN, alert batch)' },
  { suite: 'roles', npm: 'roles', title: 'Role-based access (read-only)' },
  { suite: 'ana-ent', npm: 'ana-ent', title: 'Analytics and Enterprise validation' },
  { suite: 'e2e-smoke', npm: 'e2e:smoke', title: 'E2E smoke (TC-01 … TC-26, incl. Enterprise and International Shipments)' }
];
const args = process.argv.slice(2);
const only = ((args.find(a => a.startsWith('--only=')) || '').slice(7)).split(',').filter(Boolean);
const chosen = SUITES.filter(s => !only.length || only.includes(s.key || s.suite));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(root, 'reports', `full-regression-${stamp}`);
fs.mkdirSync(out, { recursive: true });
const pmDir = path.join(root, 'reports', 'pm-flow');
const plan = { startedAt: new Date().toISOString(), suites: [] };
const save = () => fs.writeFileSync(path.join(out, 'suites.json'), JSON.stringify(plan, null, 2));
console.log(`SCP full regression → ${out}\nSuites: ${chosen.map(s => s.suite).join(' → ')}`);

for (const s of chosen) {
  const before = new Set(fs.existsSync(pmDir) ? fs.readdirSync(pmDir) : []);
  const entry = { ...s, startedAt: new Date().toISOString() };
  plan.suites.push(entry); save();
  console.log(`\n==================== ${s.title} (${s.suite}) – ${new Date().toLocaleTimeString('en-GB')} ====================`);
  const res = spawnSync('node', [path.join('scripts', 'run-pm-flow.js'), s.suite, ...(s.only ? [`--only=${s.only}`] : []),
    ...(args.includes('--headless') ? ['--headless'] : [])],
    { cwd: root, stdio: 'inherit', shell: false, env: { ...process.env, PM_FLOW_VIDEO: process.env.PM_FLOW_VIDEO || 'on', PM_FLOW_STEP_SHOTS: process.env.PM_FLOW_STEP_SHOTS || 'on' } });
  const fresh = fs.readdirSync(pmDir).filter(d => !before.has(d) && d.startsWith(`${s.suite}-`)).sort();
  entry.reportDir = fresh.length ? path.join(pmDir, fresh[fresh.length - 1]) : null;
  entry.exitCode = res.status; entry.finishedAt = new Date().toISOString();
  if (!entry.reportDir) entry.note = 'no report folder was created';
  save();
}
plan.finishedAt = new Date().toISOString(); save();
const pdf = spawnSync('node', [path.join('scripts', 'full-regression-pdf.js'), out], { cwd: root, stdio: 'inherit' });
// Human-readable list of every Failed, Blocked and Skipped test case, module by module (NON_PASSED_TEST_CASES.md).
spawnSync('node', [path.join('scripts', 'non-pass-report.js'), out], { cwd: root, stdio: 'inherit' });
// Both readable lists as A4 PDFs as well (Failed/Blocked/Skipped, and Known Defect cases with their flows).
for (const [file, title] of [['NON_PASSED_TEST_CASES', 'SCP Failed / Blocked / Skipped test cases'], ['KNOWN_DEFECT_TEST_CASES', 'SCP Known Defect test cases']]) {
  const md = path.join(out, `${file}.md`);
  if (fs.existsSync(md)) spawnSync('node', [path.join('scripts', 'md-to-pdf.js'), md, `--title=${title}`], { cwd: root, stdio: 'inherit' });
}
console.log(`\nFull regression finished. Folder: ${out}${pdf.status === 0 ? '' : ' (PDF generation failed – rerun: node scripts/full-regression-pdf.js <folder>)'}`);
for (const e of plan.suites) {
  const v = e.reportDir && ['run.mp4', 'e2e-run.mp4'].map(x => path.join(e.reportDir, x)).find(x => fs.existsSync(x));
  console.log(`  ${e.suite.padEnd(15)} exit ${e.exitCode}  ${v ? `video ${v}` : 'no video'}`);
}
