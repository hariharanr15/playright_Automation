// Summarise only explicitly supplied execution folders; historical reports are untouched.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const [output, ...runs] = process.argv.slice(2);
if (!output || !runs.length) throw new Error('Usage: node scripts/summarize-approved-regression.js output-folder run-folder [...]');
const rows = [];
function moduleName(file, title) {
  const normal = file.replace(/\\/g, '/');
  if (normal.includes('/pending/')) {
    if (/document-management/.test(normal)) return 'Document Management';
    if (/project-management/.test(normal)) return 'Project Management';
    if (/analytics|lead-time-analysis/.test(normal)) return 'Analytics';
    if (/fdiNotification/.test(title)) return 'First Delivery Inspection';
    if (/epdCarbon|poDocument|bomDocument/.test(title)) return 'Document Management';
    return 'Analytics';
  }
  return normal.split('/').find((part, i, parts) => ['smoke', 'regression'].includes(parts[i - 1])) || 'Unknown';
}
for (const run of runs) {
  const native = JSON.parse(fs.readFileSync(path.join(run, 'results.json'), 'utf8'));
  const coveragePath = path.join(run, 'coverage.json');
  const coverage = fs.existsSync(coveragePath) ? JSON.parse(fs.readFileSync(coveragePath, 'utf8')).scenarios : [];
  function visit(suites, inheritedFile = '') {
    for (const suite of suites || []) {
      const file = suite.file || inheritedFile;
      for (const spec of suite.specs || []) for (const test of spec.tests || []) {
        const match = coverage.find(item => item.title === spec.title && (!item.file || item.file.replace(/\\/g, '/').endsWith(file.replace(/\\/g, '/'))));
        for (const result of test.results || []) {
          rows.push({ id: `SCP-${crypto.createHash('sha256').update(`${file}:${spec.title}`).digest('hex').slice(0, 10)}`,
            module: moduleName(file, spec.title),
            scenario: spec.title, file, line: spec.line, browser: test.projectName,
            type: /(^|[\\/])smoke[\\/]/.test(file) ? 'Smoke' : 'Regression',
            startTime: result.startTime, durationMs: result.duration, retry: result.retry,
            nativeStatus: result.status, status: match?.status || ({ passed: 'Passed', skipped: 'Skipped' }[result.status] || 'Failed'),
            expectedStatus: test.expectedStatus, errors: (result.errors || []).map(error => error.message),
            attachments: (result.attachments || []).map(a => ({ name: a.name, contentType: a.contentType, path: a.path })),
            run, nativeReport: path.join(run, 'html', 'index.html') });
        }
      }
      visit(suite.suites, file);
    }
  }
  visit(native.suites);
}
fs.mkdirSync(output, { recursive: true });
const counts = rows.reduce((a, row) => { a[row.status] = (a[row.status] || 0) + 1; return a; }, {});
const latestScenarios = [...new Map(rows.map(row => [row.id, row])).values()];
const latestCounts = latestScenarios.reduce((a, row) => { a[row.status] = (a[row.status] || 0) + 1; return a; }, {});
const modules = {};
for (const row of latestScenarios) {
  const key = `${row.module} / ${row.type}`;
  modules[key] ||= { attempts: 0, Passed: 0, Failed: 0, Blocked: 0, Skipped: 0 };
  modules[key].attempts++;
  modules[key][row.status]++;
}
fs.writeFileSync(path.join(output, 'execution-summary.json'), JSON.stringify({ generated: new Date().toISOString(), counts, latestCounts, uniqueScenarios: latestScenarios.length, modules, attempts: rows.length, latestScenarios, rows }, null, 2));
const csv = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
fs.writeFileSync(path.join(output, 'module-wise-status.csv'), ['Module / type,Attempts,Passed,Failed,Blocked,Skipped', ...Object.entries(modules).map(([key, value]) => [key, value.attempts, value.Passed, value.Failed, value.Blocked, value.Skipped].map(csv).join(','))].join('\n'));
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const link = target => path.relative(path.resolve(output), path.resolve(target)).replace(/\\/g, '/');
fs.writeFileSync(path.join(output, 'index.html'), `<!doctype html><meta charset="utf-8"><title>SCP approved regression</title><style>body{font:15px Arial;margin:2rem}td,th{border:1px solid #bbb;padding:.6rem;text-align:left;vertical-align:top}table{border-collapse:collapse}pre{white-space:pre-wrap;max-width:55rem}</style><h1>SCP approved regression execution</h1><p>${escape(JSON.stringify(counts))}; ${rows.length} execution attempts. Only the supplied runs are included. A pass covers the executed assertions, not a complete module.</p><p>Known shared SSO defect APP-SSO-001 remains open. These existing workflow fixtures do not install the pre-authentication smoke runtime gate. Native reports and traces retain the executed evidence.</p><table><tr><th>Case / module</th><th>Scenario</th><th>Actual result</th><th>Evidence</th></tr>${rows.map(r => `<tr><td>${escape(r.id)}<br>${escape(r.module)}<br>${escape(r.type)}</td><td>${escape(r.scenario)}<br>${escape(r.startTime)}<br>${(r.durationMs / 1000).toFixed(1)} seconds</td><td>${escape(r.status)} (native ${escape(r.nativeStatus)})<pre>${escape(r.errors.join('\n'))}</pre></td><td><a href="${escape(link(r.nativeReport))}">Native HTML: assertions, steps and evidence</a>${r.attachments.filter(a => a.path).map(a => `<br><a href="${escape(link(a.path))}">${escape(a.name)}</a>`).join('')}</td></tr>`).join('')}</table>`);
console.log(JSON.stringify({ output, attempts: rows.length, counts }));
