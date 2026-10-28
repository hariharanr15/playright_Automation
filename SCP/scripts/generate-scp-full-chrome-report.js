#!/usr/bin/env node

// Consolidates one full Chrome run (Playwright results.json + Cucumber JSON) into
// index.html, execution-summary.json, module-wise-status.csv and FAILED_CASES.md.
const fs = require('fs');
const path = require('path');

const dir = path.resolve(process.argv[2] || process.env.SCP_EXECUTION_DIR || '');
const readJson = file => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);
const run = readJson(path.join(dir, 'logs', 'run.json')) || {};

const MODULES = {
  'pending/scp-analytics': 'Analytics', 'pending/scp-lead-time-analysis': 'Analytics',
  'pending/scp-document-management': 'Document Management',
  'pending/scp-independent-business-contracts': 'Independent source contracts',
  'pending/scp-project-management-readonly': 'Project Management',
  'user-management/supplier-list': 'Supplier List', 'scp-tabs': 'SCP navigation'
};
const title = value => value.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
function moduleOf(file) {
  const rel = file.replace(/\\/g, '/');
  const key = Object.keys(MODULES).find(k => rel.includes(k));
  if (key) return MODULES[key];
  const match = rel.match(/(?:smoke|regression)\/([^/]+)\//);
  return match ? title(match[1]).replace('Fdi', 'FDI') : 'Other';
}

const cases = [];
function walk(suite, parents) {
  for (const spec of suite.specs || []) {
    for (const t of spec.tests) {
      const result = t.results[t.results.length - 1] || { status: 'skipped', errors: [], duration: 0 };
      const errors = (result.errors || []).map(e => (e.message || '').replace(/\u001b\[[0-9;]*m/g, ''));
      const blocked = (t.annotations || []).some(a => a.type === 'blocked') || errors.some(e => /BLOCKED:/.test(e));
      const status = blocked ? 'Blocked' : result.status === 'passed' ? 'Passed' : result.status === 'skipped' ? 'Skipped' : 'Failed';
      const file = spec.file.replace(/\\/g, '/');
      cases.push({ suite: 'Playwright', type: file.startsWith('smoke/') ? 'Smoke' : 'Regression', module: moduleOf(file),
        name: [...parents, spec.title].filter(Boolean).join(' › '), location: `tests/${file}:${spec.line}`, status,
        durationMs: result.duration || 0, error: errors[0] || '' });
    }
  }
  for (const child of suite.suites || []) walk(child, child.title && !/\.spec\.js$/.test(child.title) ? [...parents, child.title] : parents);
}
// Original attempt first, then targeted reruns (playwright-rerun-*); the latest result per case wins.
const attempts = ['playwright', ...fs.readdirSync(dir).filter(d => /^playwright-rerun-/.test(d)).sort()];
for (const attempt of attempts) {
  const pw = readJson(path.join(dir, attempt, 'results.json'));
  const before = cases.length;
  (pw?.suites || []).forEach(s => walk(s, []));
  for (const c of cases.splice(before)) {
    const prior = cases.findIndex(p => p.location === c.location && p.name === c.name);
    if (prior === -1) { cases.push({ ...c, attempts: 1, report: attempt }); continue; }
    cases[prior] = { ...c, attempts: cases[prior].attempts + 1, previousStatus: cases[prior].status, report: attempt };
  }
}

const cucumber = readJson(path.join(dir, 'cucumber', 'cucumber-report.json')) || [];
for (const feature of cucumber) {
  for (const scenario of feature.elements || []) {
    const steps = scenario.steps || [];
    const failed = steps.find(s => s.result.status === 'failed');
    const allPassed = steps.every(s => s.result.status === 'passed');
    cases.push({ suite: 'Cucumber', type: 'Regression (BDD)', module: 'Project Management', name: scenario.name,
      location: `${feature.uri}:${scenario.line}`, attempts: 1, report: 'cucumber', status: failed ? 'Failed' : allPassed ? 'Passed' : 'Skipped',
      durationMs: Math.round(steps.reduce((sum, s) => sum + (s.result.duration || 0), 0) / 1e6),
      error: failed ? `${failed.keyword.trim()} ${failed.name}: ${(failed.result.error_message || '').split('\n')[0]}` : '' });
  }
}

const excluded = [
  { module: 'Project Setup Wizard', reason: '2 Playwright cases; excluded scope (not held)' },
  { module: 'Project Management', reason: 'Cucumber "Admin creates a System Message"; System Messages excluded scope' },
  { module: 'Project Management', reason: 'Cucumber "Admin checks Analytics and remaining controls"; mixed excluded controls' },
  { module: 'Construction Delivery, Enterprise Shipment, Integrations, System Messages', reason: 'Excluded scope; no tests selected' }
];

const STATUSES = ['Passed', 'Failed', 'Blocked', 'Skipped'];
const count = list => Object.fromEntries(STATUSES.map(s => [s, list.filter(c => c.status === s).length]));
const modules = [...new Set(cases.map(c => c.module))].sort()
  .map(module => ({ module, total: cases.filter(c => c.module === module).length, ...count(cases.filter(c => c.module === module)) }));
const totals = { total: cases.length, ...count(cases) };
const summary = { ...run, generatedAt: new Date().toISOString(), totals, modules, excluded, cases };
fs.writeFileSync(path.join(dir, 'execution-summary.json'), JSON.stringify(summary, null, 2));

const csv = value => `"${String(value).replace(/"/g, '""')}"`;
fs.writeFileSync(path.join(dir, 'module-wise-status.csv'), [['Module', 'Total', ...STATUSES].join(','),
  ...modules.map(m => [csv(m.module), m.total, ...STATUSES.map(s => m[s])].join(','))].join('\n'));
const failed = cases.filter(c => c.status === 'Failed');
fs.writeFileSync(path.join(dir, 'FAILED_CASES.md'), [`# Failed cases (${failed.length})`, '',
  '| Module | Case | Location | First error |', '|---|---|---|---|',
  ...failed.map(c => `| ${c.module} | ${c.name} | ${c.location} | ${c.error.split('\n')[0].replace(/\|/g, '\\|').slice(0, 300)} |`)].join('\n'));

const esc = value => String(value).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const mins = ms => `${(ms / 60000).toFixed(1)} min`;
const passRate = totals.total ? Math.round((totals.Passed / totals.total) * 100) : 0;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SCP Chrome Execution</title><style>
:root{--bg:#f6f7f9;--card:#fff;--ink:#1d2330;--muted:#5d6675;--line:#e1e4ea;--pass:#1f7a3f;--fail:#b42318;--block:#9a6700;--skip:#5d6675}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 system-ui,Segoe UI,sans-serif}main{max-width:1200px;margin:0 auto;padding:24px 16px}
h1{margin:0 0 4px;font-size:24px}h2{margin:32px 0 12px;font-size:18px}.muted{color:var(--muted)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-top:20px}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:14px}.card b{display:block;font-size:26px}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line)}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{background:#eef0f4;font-weight:600}td.n{text-align:right;font-variant-numeric:tabular-nums}.wrap{overflow-x:auto}
.Passed{color:var(--pass);font-weight:600}.Failed{color:var(--fail);font-weight:600}.Blocked{color:var(--block);font-weight:600}.Skipped{color:var(--skip);font-weight:600}
code,pre{font:12px/1.4 Consolas,monospace}pre{white-space:pre-wrap;margin:0;max-height:120px;overflow:auto}a{color:#1a56db}
</style></head><body><main>
<h1>SCP entire application: Google Chrome execution</h1>
<div class="muted">${esc(run.application || 'SCP')} · ${esc(run.mode || '')} Chrome · one worker · zero retries · started ${esc(run.startedAt || '')} · finished ${esc(run.finishedAt || '')}</div>
<div class="cards"><div class="card">Total cases<b>${totals.total}</b></div><div class="card">Passed<b class="Passed">${totals.Passed}</b></div>
<div class="card">Failed<b class="Failed">${totals.Failed}</b></div><div class="card">Blocked<b class="Blocked">${totals.Blocked}</b></div>
<div class="card">Skipped<b class="Skipped">${totals.Skipped}</b></div><div class="card">Pass rate<b>${passRate}%</b></div></div>
<h2>Suites</h2><div class="wrap"><table><tr><th>Suite</th><th>Exit code</th><th>Duration</th></tr>
${(run.suites || []).map(s => `<tr><td>${esc(s.name)}</td><td class="n">${s.exitCode}</td><td class="n">${mins(s.durationMs)}</td></tr>`).join('')}</table></div>
<p>Native reports: ${attempts.map(a => `<a href="${a}/html/index.html">${a === 'playwright' ? 'Playwright HTML (traces, screenshots, video)' : `Rerun: ${a.replace('playwright-rerun-', '')}`}</a>`).join(' · ')} · <a href="cucumber/cucumber-report.html">Cucumber HTML</a> · <a href="execution-summary.json">execution-summary.json</a> · <a href="module-wise-status.csv">module-wise-status.csv</a> · <a href="FAILED_CASES.md">FAILED_CASES.md</a></p>
<h2>Module-wise status</h2><div class="wrap"><table><tr><th>Module</th><th>Total</th>${STATUSES.map(s => `<th>${s}</th>`).join('')}</tr>
${modules.map(m => `<tr><td>${esc(m.module)}</td><td class="n">${m.total}</td>${STATUSES.map(s => `<td class="n ${m[s] ? s : ''}">${m[s]}</td>`).join('')}</tr>`).join('')}</table></div>
<h2>Excluded scope (not executed)</h2><div class="wrap"><table><tr><th>Module</th><th>Reason</th></tr>
${excluded.map(e => `<tr><td>${esc(e.module)}</td><td>${esc(e.reason)}</td></tr>`).join('')}</table></div>
<h2>All cases</h2><div class="wrap"><table><tr><th>Status</th><th>Module</th><th>Type</th><th>Case</th><th>Attempts</th><th>Duration</th><th>First error</th></tr>
${cases.map(c => `<tr><td class="${c.status}">${c.status}</td><td>${esc(c.module)}</td><td>${esc(c.type)}</td><td>${esc(c.name)}<div class="muted"><code>${esc(c.location)}</code></div></td><td class="n">${c.attempts}${c.previousStatus ? `<div class="muted">earlier: ${c.previousStatus}</div>` : ''}<div class="muted"><a href="${c.report === 'cucumber' ? 'cucumber/cucumber-report.html' : `${c.report}/html/index.html`}">report</a></div></td><td class="n">${(c.durationMs / 1000).toFixed(1)}s</td><td><pre>${esc(c.error.slice(0, 600))}</pre></td></tr>`).join('')}</table></div>
</main></body></html>`;
fs.writeFileSync(path.join(dir, 'index.html'), html);
console.log(`SCP full Chrome report: ${path.join(dir, 'index.html')} (${totals.Passed}/${totals.total} passed, ${totals.Failed} failed, ${totals.Blocked} blocked, ${totals.Skipped} skipped)`);
