// Human-readable list of every test case that did not pass in a full regression, grouped by module.
// Failed, Blocked and Skipped cases are listed with their steps (action → expected result), the step that stopped
// the case and the reason. Known Defect cases are summarised at the end for reference.
//
// Usage (from SCP):
//   node scripts/non-pass-report.js reports/full-regression-<timestamp>
//   node scripts/non-pass-report.js reports/pm-flow/<suite-run> [reports/pm-flow/<another-run> …]
//   node scripts/non-pass-report.js reports/full-regression-<timestamp> reports/pm-flow/<re-run> …
// Folders are read in the order given: a case that appears again in a later folder (a re-run) replaces the earlier result.
// A Failed case whose error matches a defect registered after the run is shown as Known Defect ("re-classified").
// Output: NON_PASSED_TEST_CASES.md in the first folder given.
const fs = require('fs');
const path = require('path');
const { KNOWN_DEFECTS, defectLabel } = require('../config/scp-known-defects');

const inputs = process.argv.slice(2);
if (!inputs.length) {
  console.error('Usage: node scripts/non-pass-report.js <full-regression folder | pm-flow run folder …>');
  process.exit(1);
}

// ---------- Collect the suite runs ----------
const runs = [];
for (const input of inputs) {
  const folder = path.resolve(input);
  const suitesFile = path.join(folder, 'suites.json');
  if (fs.existsSync(suitesFile)) {
    for (const suite of JSON.parse(fs.readFileSync(suitesFile, 'utf8')).suites || []) {
      if (suite.reportDir && fs.existsSync(path.join(suite.reportDir, 'results.json'))) runs.push({ title: suite.title || suite.suite, key: suite.suite || path.basename(suite.reportDir).replace(/-\d{4}-\d\d-\d\dT.*$/, ''), dir: suite.reportDir });
    }
  } else if (fs.existsSync(path.join(folder, 'results.json'))) {
    const key = path.basename(folder).replace(/-\d{4}-\d\d-\d\dT.*$/, '');
    runs.push({ title: key, key, dir: folder });
  }
}
if (!runs.length) {
  console.error('No results.json found in the folders given.');
  process.exit(1);
}

// ---------- Helpers ----------
const plain = value => String(value ?? '').replace(/\x1b\[[0-9;]*m/g, '').replace(/\s+/g, ' ').trim();
const cell = value => plain(value).replace(/\|/g, '/');
const split = name => {
  const index = String(name).indexOf('→');
  return index < 0 ? [String(name), ''] : [name.slice(0, index).trim(), name.slice(index + 1).trim()];
};
const lastError = step => plain(((step.attempts || []).slice(-1)[0] || {}).error || '').split(' Expected')[0].slice(0, 300);
const observed = step => plain(step.reason || '').replace(/^Observed: /, '').replace(/ · Observed: /g, ' · ').slice(0, 300);
const STATUS_ORDER = { Failed: 0, Blocked: 1, Skipped: 2 };

// ---------- Read the scenarios ----------
// Same rule as the runner: a defect applies when it lists the scenario, or (without a scenario list) the module.
const registeredDefect = item => {
  const step = (item.steps || []).find(entry => entry.status === 'Failed');
  const error = plain(((step && step.attempts) || []).slice(-1)[0]?.error || '');
  if (!error) return null;
  return KNOWN_DEFECTS.find(defect => defect.signature
    && (defect.scenarioIds ? defect.scenarioIds.includes(item.id) : (defect.modules || []).includes(item.module))
    && defect.signature.test(error)) || null;
};
const byId = new Map();
let replaced = 0;
let reclassified = 0;
for (const run of runs) {
  const result = JSON.parse(fs.readFileSync(path.join(run.dir, 'results.json'), 'utf8'));
  for (const scenario of result.scenarios || result) {
    // A partial re-run lists the cases it did not select as Skipped "not selected"; they must not hide the real result.
    const id = `${run.key}|${scenario.id}`;
    if (byId.has(id) && scenario.status === 'Skipped') continue;
    if (byId.has(id)) replaced++;
    const item = { ...scenario, suiteTitle: run.title, runDir: run.dir };
    if (item.status === 'Failed') {
      const defect = registeredDefect(item);
      if (defect) {
        item.status = 'Known Defect'; item.defects = [defect.id]; item.reclassified = true; reclassified++;
        const step = item.steps.find(entry => entry.status === 'Failed'); step.status = 'Known Defect'; step.defect = defect.id;
      }
    }
    byId.set(id, item);
  }
}
const cases = [...byId.values()];
const totals = {};
for (const item of cases) totals[item.status] = (totals[item.status] || 0) + 1;
const nonPassed = cases.filter(item => item.status in STATUS_ORDER);
const knownDefects = cases.filter(item => item.status === 'Known Defect');

// ---------- Write the document ----------
const lines = [
  '# SCP – Failed, Blocked and Skipped test cases',
  '',
  `_Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC by \`scripts/non-pass-report.js\` from ${runs.length} suite run(s)._`,
  '',
  ...(replaced ? [`_${replaced} result(s) come from a later re-run of the same case (the re-run replaces the first result)._`, ''] : []),
  ...(reclassified ? [`_${reclassified} case(s) failed before their defect was registered and are shown as Known Defect ("re-classified")._`, ''] : []),
  '## Summary',
  '',
  '| Result | Test cases |',
  '|---|---|',
  ...['Passed', 'Known Defect', 'Failed', 'Blocked', 'Skipped'].map(status => `| ${status} | ${totals[status] || 0} |`),
  `| **Total** | **${cases.length}** |`,
  '',
  '**How to read the results**',
  '',
  '- **Failed**: the application did not behave as expected and no known defect explains it. Needs investigation.',
  '- **Blocked**: the case could not run, because an earlier required step failed or an environment precondition was not met. The reason says which.',
  '- **Skipped**: the case is not executed in this suite on purpose (covered elsewhere, out of scope, or waiting for data or accounts). The reason says why.',
  '- **Known Defect**: the case failed exactly as a registered defect describes (see `docs/automation-gap-analysis/KNOWN_DEFECTS.md`). Entries marked "pending confirmation" still need the client/team to confirm the expected behaviour.',
  '',
  '## Suite runs used',
  '',
  '| Suite | Report folder |',
  '|---|---|',
  ...runs.map(run => `| ${cell(run.title)} | \`${cell(path.relative(process.cwd(), run.dir))}\` |`),
  ''
];

const modules = [...new Set(nonPassed.map(item => item.module || 'Other'))].sort();
if (!modules.length) lines.push('## Result', '', 'Every executed test case passed or failed only as a registered known defect. Nothing is Failed, Blocked or Skipped.', '');
for (const module of modules) {
  const inModule = nonPassed.filter(item => (item.module || 'Other') === module)
    .sort((first, second) => STATUS_ORDER[first.status] - STATUS_ORDER[second.status] || String(first.id).localeCompare(String(second.id)));
  const count = status => inModule.filter(item => item.status === status).length;
  lines.push(`## ${module}`, '', `Failed ${count('Failed')} · Blocked ${count('Blocked')} · Skipped ${count('Skipped')}`, '');
  for (const item of inModule) {
    lines.push(`### ${item.id} – ${plain(item.title)} (${item.status})`, '');
    lines.push('| Field | Value |', '|---|---|');
    lines.push(`| Suite | ${cell(item.suiteTitle)} |`);
    if (item.submodule) lines.push(`| Area | ${cell(item.submodule)} |`);
    if (item.navPath) lines.push(`| Where in the app | ${cell([].concat(item.navPath).join(' › '))} |`);
    const stopping = (item.steps || []).find(step => step.status === 'Failed') || (item.steps || []).find(step => step.status === 'Blocked');
    const reason = item.status === 'Failed' && stopping
      ? `Step "${split(stopping.name)[0]}" failed: ${lastError(stopping) || observed(stopping)}`
      : plain(item.reason || (stopping && (stopping.reason || lastError(stopping))) || 'No reason recorded');
    lines.push(`| Result | **${item.status}** |`, `| Reason | ${cell(reason)} |`, '');
    if ((item.steps || []).length) {
      lines.push('| # | Action | Expected result | Result | Observed / error |', '|---|---|---|---|---|');
      item.steps.forEach((step, index) => {
        const [action, expected] = split(step.name);
        const note = step.status === 'Passed' ? observed(step) : [lastError(step), observed(step)].filter(Boolean).join(' · ');
        const status = `${step.status}${step.defect ? ` (${defectLabel(step.defect)})` : ''}${step.retried ? ', passed on retry' : ''}`;
        lines.push(`| ${index + 1} | ${cell(action)} | ${cell(expected)} | ${cell(status)} | ${cell(note)} |`);
      });
      lines.push('');
    } else {
      lines.push('_No steps were executed for this case._', '');
    }
  }
}

if (knownDefects.length) {
  lines.push('## For reference: Known Defect results', '', '| Module | ID | Test case | Defect | What was observed |', '|---|---|---|---|---|');
  for (const item of knownDefects.sort((first, second) => String(first.module).localeCompare(String(second.module)) || String(first.id).localeCompare(String(second.id)))) {
    const step = (item.steps || []).find(entry => entry.status === 'Known Defect') || {};
    lines.push(`| ${cell(item.module)} | ${cell(item.id)} | ${cell(item.title)} | ${cell((item.defects || [step.defect]).filter(Boolean).map(defectLabel).join(', '))}${item.reclassified ? ' (re-classified)' : ''} | ${cell(lastError(step) || observed(step))} |`);
  }
  lines.push('');
}

const output = path.join(path.resolve(inputs[0]), 'NON_PASSED_TEST_CASES.md');
fs.writeFileSync(output, lines.join('\n'));
console.log(`${nonPassed.length} failed/blocked/skipped and ${knownDefects.length} known-defect cases of ${cases.length} -> ${path.relative(process.cwd(), output)}`);

// ---------- Second document: every Known Defect test case with its flow ----------
// Written next to NON_PASSED_TEST_CASES.md as KNOWN_DEFECT_TEST_CASES.md, for readers who need to follow each case by hand.
const defectOf = item => {
  const step = (item.steps || []).find(entry => entry.status === 'Known Defect') || {};
  const id = (item.defects || [step.defect]).filter(Boolean)[0];
  return { id, step, entry: KNOWN_DEFECTS.find(defect => defect.id === id) || {} };
};
const flowLine = (step, index) => {
  const [action, expected] = split(step.name);
  const lineStart = `${index + 1}. ${plain(action)}${expected ? `  \n   _Expected:_ ${plain(expected)}` : ''}`;
  if (step.status === 'Passed') {
    const note = observed(step);
    return `${lineStart}  \n   _Result:_ ✔ as expected${step.retried ? ' (passed on retry)' : ''}${note ? ` · _Noted:_ ${note}` : ''}`;
  }
  if (step.status === 'Known Defect') {
    const actual = [lastError(step), observed(step)].filter(Boolean).join(' · ');
    return `${lineStart}  \n   _Result:_ ✖ **defect ${defectLabel(step.defect)} reproduced** – ${actual || 'see the report'}`;
  }
  const why = [lastError(step), observed(step)].filter(Boolean).join(' · ');
  return `${lineStart}  \n   _Result:_ ${step.status}${why ? ` – ${why}` : ''}`;
};
const kdCases = [...knownDefects].sort((first, second) => String(first.module || 'Other').localeCompare(String(second.module || 'Other'))
  || String(defectOf(first).id).localeCompare(String(defectOf(second).id)) || String(first.id).localeCompare(String(second.id)));
const pendingCount = kdCases.filter(item => defectOf(item).entry.confirmation === 'pending').length;
const kd = [
  '# SCP – Known Defect test cases',
  '',
  `_Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC by \`scripts/non-pass-report.js\` from the same runs as \`NON_PASSED_TEST_CASES.md\`._`,
  '',
  `**${kdCases.length} test case(s)** ended as Known Defect: the application behaved exactly as a recorded defect describes. ${kdCases.length - pendingCount} match a registered defect; **${pendingCount}** match a defect that is **pending confirmation** (today's behaviour looks wrong, but the client/team has not confirmed the expected behaviour yet; see \`docs/automation-gap-analysis/PENDING_CONFIRMATIONS.md\`). Nothing is raised in Jira.`,
  '',
  '**How to read a case:** the flow lists every step the test performed, in order, with the expected result. Steps marked ✔ behaved as expected; the step marked ✖ is where the defect shows. Run tags such as `PLT2611211408` are the names the test gave to the data it created; use any equivalent record when repeating by hand.',
  '',
  '## Index',
  '',
  '| # | Module | Test case | Defect | Status | What goes wrong |',
  '|---|---|---|---|---|---|',
  ...kdCases.map((item, index) => {
    const { id, entry } = defectOf(item);
    return `| ${index + 1} | ${cell(item.module || 'Other')} | ${cell(item.id)} – ${cell(item.title)} | ${cell(id)} | ${entry.confirmation === 'pending' ? 'Pending confirmation' : 'Registered'}${item.reclassified ? ' (re-classified)' : ''} | ${cell(plain(entry.summary || '').replace(/^PENDING TEAM CONFIRMATION\. /, '').slice(0, 160))}${(entry.summary || '').length > 170 ? '…' : ''} |`;
  }),
  ''
];
let currentModule = null;
kdCases.forEach((item, index) => {
  const { id, step, entry } = defectOf(item);
  if ((item.module || 'Other') !== currentModule) { currentModule = item.module || 'Other'; kd.push(`## ${currentModule}`, ''); }
  const [, expectedAtDefect] = split(step.name || '');
  kd.push(`### ${index + 1}. ${item.id} – ${plain(item.title)}`, '');
  kd.push('| | |', '|---|---|');
  kd.push(`| **Defect** | ${cell(defectLabel(id))}${entry.recordedOn ? ` · recorded ${cell(entry.recordedOn)}` : ''}${item.reclassified ? ' · re-classified (registered after this run)' : ''} |`);
  kd.push(`| **Suite** | ${cell(item.suiteTitle)} |`);
  if (item.navPath) kd.push(`| **Where in the app** | ${cell([].concat(item.navPath).join(' › '))} |`);
  kd.push(`| **Should happen** | ${cell(expectedAtDefect || 'see the flow')} |`);
  kd.push(`| **Happens today** | ${cell([lastError(step), observed(step)].filter(Boolean).join(' · ') || 'see the flow')} |`);
  if (entry.summary) kd.push(`| **Defect description** | ${cell(plain(entry.summary).replace(/^PENDING TEAM CONFIRMATION\. /, ''))} |`);
  kd.push('', '**Flow**', '');
  if ((item.steps || []).length) item.steps.forEach((entry2, stepIndex) => kd.push(flowLine(entry2, stepIndex)));
  else kd.push('_No steps recorded._');
  kd.push('');
});
const kdOutput = path.join(path.resolve(inputs[0]), 'KNOWN_DEFECT_TEST_CASES.md');
fs.writeFileSync(kdOutput, kd.join('\n'));
console.log(`${kdCases.length} known-defect test cases with flows -> ${path.relative(process.cwd(), kdOutput)}`);
