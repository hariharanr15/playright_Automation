#!/usr/bin/env node
// One command for the client demo: runs the Project Management flow (Smoke, Regression part 1, Regression part 2) and the
// SCP full regression of the other modules, one after the other in Google Chrome, then writes one summary page that links
// every report. Usage: npm run demo  [--skip-pm] [--skip-full]
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(root, 'reports', `demo-${stamp}`);
fs.mkdirSync(outDir, { recursive: true });

const OTHER_MODULES = ['user-management', 'supplier-list', 'procurement-log', 'inventory-management', 'first-delivery-inspection',
  'international-shipment', 'management-dashboard', 'analytics', 'enterprise', 'document-management'];
const DATA_ENV = {
  SCP_INVENTORY_DATA: process.env.SCP_INVENTORY_DATA || 'reports/inventory-discovery/environment.json',
  SCP_PROCUREMENT_DATA: process.env.SCP_PROCUREMENT_DATA || 'reports/qualified-20261029/procurement-allocation.json'
};

const newest = prefix => {
  const dir = path.join(root, 'reports', prefix === 'scp-full-regression' ? '' : 'pm-flow');
  const names = fs.readdirSync(dir).filter(name => name.startsWith(`${prefix}-`)).map(name => path.join(dir, name));
  return names.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
};
const run = (label, command, commandArgs, env = {}) => {
  console.log(`\n=== ${label} ===`);
  const started = Date.now();
  const result = spawnSync(command, commandArgs, { cwd: root, stdio: 'inherit', shell: true, env: { ...process.env, ...env } });
  return { label, exitCode: result.status, minutes: ((Date.now() - started) / 60000).toFixed(1) };
};

const parts = [];
if (!args.includes('--skip-pm')) {
  for (const [label, suite, prefix] of [['PM Smoke', 'smoke', 'smoke'], ['PM Regression part 1', 'regression', 'regression'], ['PM Regression part 2', 'regression2', 'regression2']]) {
    const step = run(label, 'node', ['scripts/run-pm-flow.js', suite]);
    const dir = newest(prefix);
    const results = dir && fs.existsSync(path.join(dir, 'results.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'results.json'), 'utf8')) : null;
    parts.push({ ...step, report: dir && path.join(dir, 'report.html'), counts: results?.summary || null });
  }
}
if (!args.includes('--skip-full')) {
  const step = run('SCP full regression (10 modules)', 'node', ['scripts/run-scp-full-regression.js', '--execute', '--headed', '--fast',
    '--with-owned-mutations', '--include-unqualified', ...OTHER_MODULES.map(id => `--module=${id}`)], DATA_ENV);
  const dir = newest('scp-full-regression');
  const manifest = dir && fs.existsSync(path.join(dir, 'manifest.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')) : null;
  parts.push({ ...step, report: dir && path.join(dir, 'SCP_Full_Regression_Report.html'), counts: manifest?.counts || null });
}

const esc = value => String(value ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const countText = counts => counts ? Object.entries(counts).filter(([key]) => !/total/i.test(key)).map(([key, value]) => `${key}: ${value}`).join(' · ') : 'no result file';
const rows = parts.map(part => `<tr><td>${esc(part.label)}</td><td>${esc(countText(part.counts))}</td><td>${part.minutes} min</td>
  <td>${part.report && fs.existsSync(part.report) ? `<a href="${esc(path.relative(outDir, part.report).replace(/\\/g, '/'))}">Open report</a>` : 'not written'}</td></tr>`).join('');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>SCP Demo Run Summary</title><style>
body{font:15px/1.5 'Segoe UI',Arial,sans-serif;margin:0;background:#f8fafc;color:#1f2937}header{background:#0f766e;color:#fff;padding:18px 28px}
main{padding:20px 28px;max-width:1100px}table{border-collapse:collapse;width:100%;background:#fff}th,td{border:1px solid #e5e7eb;padding:8px 10px;text-align:left}
th{background:#f1f5f9}a{color:#0f766e;font-weight:600}</style></head><body>
<header><h1 style="margin:0">SCP automation – demo run</h1><div>${esc(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Calcutta' }))} IST · Google Chrome · staging (NRVC_Hall)</div></header>
<main><table><tr><th>Suite</th><th>Result</th><th>Duration</th><th>Report</th></tr>${rows}</table>
<p>"Known Defect" means the application behaved as a registered defect (config/scp-known-defects.js); "Skipped" scenarios carry their reason in the suite report.</p></main></body></html>`;
const summary = path.join(outDir, 'index.html');
fs.writeFileSync(summary, html);
fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(parts, null, 2));
console.log(`\nDemo summary: ${summary}`);
