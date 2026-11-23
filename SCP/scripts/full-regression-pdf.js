// Consolidated A4 PDF for an SCP full regression: node scripts/full-regression-pdf.js <full-regression folder>
// Reads the folder's suites.json (written by run-full-regression.js) and each suite's results.json; writes
// SCP_Full_Regression_Report.html / .pdf (A4 portrait) into the folder. Screenshots stay in each suite's own report.
const fs = require('fs');
const path = require('path');
const { defectLabel } = require('../config/scp-known-defects');

const dir = path.resolve(process.argv[2] || '');
const plan = JSON.parse(fs.readFileSync(path.join(dir, 'suites.json'), 'utf8'));
const mask = t => String(t ?? '').replace(/\u001b\[[0-9;]*m/g, '').replace(/([\w.+-])[\w.+-]*@([\w-]+(\.[\w-]+)+)/g, '$1***@$2');
const esc = t => mask(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ST = { Passed: 'PASS', Failed: 'FAIL', 'Known Defect': 'KNOWN DEFECT', Blocked: 'BLOCKED', Skipped: 'SKIPPED' };
const cls = s => (ST[s] || s || '').replace(/\s+/g, '-');
const badge = s => `<span class="b ${cls(s)}">${esc(ST[s] || s || '—')}</span>`;
const split = n => { const i = String(n).indexOf('→'); return i < 0 ? [n, ''] : [n.slice(0, i).trim(), n.slice(i + 1).trim()]; };
const mins = ms => (ms == null || Number.isNaN(ms) ? '' : ms >= 60000 ? `${Math.floor(ms / 60000)} m ${Math.round((ms % 60000) / 1000)} s` : `${(ms / 1000).toFixed(1)} s`);
const rel = f => path.relative(path.resolve(dir, '..', '..'), f).replace(/\\/g, '/');

const suites = plan.suites.map(x => {
  const file = x.reportDir && path.join(x.reportDir, 'results.json');
  const r = file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  const sc = r ? r.scenarios : [];
  const st = sc.flatMap(s => s.steps || []);
  const n = (arr, k) => arr.filter(y => y.status === k).length;
  const video = x.reportDir && ['run.mp4', 'e2e-run.mp4'].map(v => path.join(x.reportDir, v)).find(v => fs.existsSync(v));
  const pdfs = x.reportDir ? ['e2e-report.pdf'].map(v => path.join(x.reportDir, v)).filter(v => fs.existsSync(v)) : [];
  return { ...x, r, sc, st, video, pdfs, html: x.reportDir && ['e2e-report.html', 'report.html'].map(v => path.join(x.reportDir, v)).find(v => fs.existsSync(v)),
    cases: { total: sc.length, pass: n(sc, 'Passed'), fail: n(sc, 'Failed'), kd: n(sc, 'Known Defect'), blocked: n(sc, 'Blocked'), skipped: n(sc, 'Skipped') },
    steps: { total: st.length, pass: n(st, 'Passed'), fail: n(st, 'Failed'), kd: n(st, 'Known Defect'), blocked: n(st, 'Blocked'), skipped: n(st, 'Skipped') },
    ms: r ? new Date(r.finishedAt || x.finishedAt) - new Date(r.startedAt || x.startedAt) : null };
});
const sum = k => suites.reduce((a, s) => { for (const f of Object.keys(s[k])) a[f] = (a[f] || 0) + s[k][f]; return a; }, {});
const C = sum('cases'); const S = sum('steps');

let html = `<!doctype html><html><head><meta charset="utf-8"><title>SCP Full Regression</title><style>
body{font:9.5px/1.35 Segoe UI,Arial,sans-serif;color:#1d2433;margin:0}
h1{font-size:18px;margin:0 0 4px}h2{font-size:13px;margin:16px 0 6px;border-bottom:2px solid #2d5bd3;padding-bottom:2px;page-break-after:avoid}
h3{font-size:10.5px;margin:10px 0 4px;page-break-after:avoid}.meta{color:#555}
table{border-collapse:collapse;width:100%;margin-bottom:6px;table-layout:fixed}th,td{border:1px solid #cfd5e0;padding:2px 4px;vertical-align:top;text-align:left;overflow-wrap:anywhere}
th{background:#eef2fa}tr{page-break-inside:avoid}.num td{text-align:right}.num td:first-child{text-align:left}
.b{font-weight:600;padding:1px 3px;border-radius:3px;white-space:nowrap;font-size:8.5px}.PASS{background:#dff3e4;color:#14632b}.FAIL{background:#fbe0e0;color:#9b1c1c}
.KNOWN-DEFECT{background:#fff1d6;color:#8a5300}.BLOCKED,.SKIPPED{background:#eceef2;color:#4a5160}.obs{color:#555;font-size:8.5px}.pb{page-break-before:always}
</style></head><body>
<h1>SCP Full Regression – Test Report</h1>
<p class="meta">Staging · project ${esc(suites.find(s => s.r)?.r?.environment?.project || 'NRVC_Hall')} · started ${esc(new Date(plan.startedAt).toLocaleString('en-GB'))} · finished ${esc(plan.finishedAt ? new Date(plan.finishedAt).toLocaleString('en-GB') : '—')} · ${suites.length} suites run one after another in one headed Chrome tab per suite (PM-flow framework), including the E2E smoke.<br>
Evidence per suite (screenshots per step, HTML report, MP4 video) is listed in the suite table; this document lists every test case and step.</p>
${(plan.notes || []).length ? `<h2>Notes</h2><ul>${plan.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
<h2>Overall result</h2><table class="num"><tr><th>Level</th><th>Total</th><th>Pass</th><th>Fail</th><th>Known defect</th><th>Blocked</th><th>Skipped</th></tr>
<tr><td>Test cases</td><td>${C.total}</td><td>${C.pass}</td><td>${C.fail}</td><td>${C.kd}</td><td>${C.blocked}</td><td>${C.skipped}</td></tr>
<tr><td>Test steps</td><td>${S.total}</td><td>${S.pass}</td><td>${S.fail}</td><td>${S.kd}</td><td>${S.blocked}</td><td>${S.skipped}</td></tr></table>
<h2>Suites</h2><table><tr><th style="width:17%">Suite</th><th style="width:7%">Cases</th><th style="width:6%">Pass</th><th style="width:6%">Fail</th><th style="width:6%">KD</th><th style="width:7%">Blocked</th><th style="width:7%">Steps</th><th style="width:9%">Duration</th><th>Report folder / video</th></tr>
${suites.map(s => `<tr><td><b>${esc(s.title)}</b><br><span class="obs">npm run ${esc(s.npm)}${s.exitCode ? ` · exit ${s.exitCode}` : ''}${s.source ? `<br>${esc(s.source)}` : ''}</span></td><td>${s.cases.total}</td><td>${s.cases.pass}</td><td>${s.cases.fail}</td><td>${s.cases.kd}</td><td>${s.cases.blocked}</td><td>${s.steps.total}</td><td>${mins(s.ms)}</td><td class="obs">${s.reportDir ? esc(rel(s.reportDir)) : 'no report (suite did not start)'}<br>Video: ${s.video ? esc(path.basename(s.video)) : '—'}</td></tr>`).join('')}</table>
<h2>Modules</h2><table><tr><th>Suite</th><th>Module</th><th>Cases</th><th>Pass</th><th>Fail</th><th>Known defect</th><th>Blocked</th><th>Skipped</th></tr>`;
for (const s of suites) {
  for (const m of [...new Set(s.sc.map(x => x.module))]) {
    const xs = s.sc.filter(x => x.module === m); const n = k => xs.filter(x => x.status === k).length;
    html += `<tr><td>${esc(s.title)}</td><td>${esc(m)}</td><td>${xs.length}</td><td>${n('Passed')}</td><td>${n('Failed')}</td><td>${n('Known Defect')}</td><td>${n('Blocked')}</td><td>${n('Skipped')}</td></tr>`;
  }
}
html += `</table><h2>Failures, known defects and blocked test cases</h2>`;
const bad = suites.flatMap(s => s.sc.filter(x => x.status !== 'Passed').map(x => ({ s, x })));
html += bad.length ? `<table><tr><th style="width:13%">Suite</th><th style="width:9%">ID</th><th style="width:25%">Test case</th><th style="width:10%">Result</th><th>First failing step / reason</th></tr>${bad.map(({ s, x }) => {
  const f = (x.steps || []).find(y => y.status !== 'Passed'); const last = f && (f.attempts || []).slice(-1)[0];
  return `<tr><td>${esc(s.title)}</td><td>${esc(x.id)}</td><td>${esc(x.title)}</td><td>${badge(x.status)}</td><td class="obs">${esc(f ? `${f.name}${f.defect ? ` [${defectLabel(f.defect)}]` : ''} – ${(last && last.error ? last.error.split('\n')[0] : f.reason || '')}` : x.reason || '').slice(0, 500)}</td></tr>`;
}).join('')}</table>` : '<p>None.</p>';
for (const s of suites) {
  html += `<h2 class="pb">${esc(s.title)} – test steps and results</h2><p class="meta">${s.cases.total} test cases, ${s.steps.total} steps · ${s.cases.pass} passed, ${s.cases.fail} failed, ${s.cases.kd} known defect, ${s.cases.blocked} blocked · ${mins(s.ms)}${s.reportDir ? ` · ${esc(rel(s.reportDir))}` : ''}</p>`;
  if (!s.sc.length) { html += `<p>No results (${esc(s.note || 'suite did not produce results.json')}).</p>`; continue; }
  for (const x of s.sc) {
    html += `<h3>${esc(x.id)} · ${esc(x.title)} — ${badge(x.status)}</h3>`;
    if (!(x.steps || []).length) { html += `<p class="obs">${esc(x.reason || 'No steps executed')}</p>`; continue; }
    html += `<table><tr><th style="width:8%">Step</th><th style="width:34%">Action</th><th style="width:26%">Expected result</th><th style="width:22%">Actual / observation</th><th style="width:10%">Result</th></tr>`;
    x.steps.forEach((st, i) => {
      const [act, exp] = split(st.name); const last = (st.attempts || []).slice(-1)[0];
      const obs = [st.reason || '', last && last.error && st.status !== 'Passed' ? last.error.split('\n')[0] : ''].filter(Boolean).join(' · ');
      html += `<tr><td>${esc(st.id || `${x.id}.${i + 1}`)}</td><td>${esc(act)}</td><td>${esc(exp)}</td><td class="obs">${esc(obs).slice(0, 450)}</td><td>${badge(st.status)}${st.defect ? `<br><span class="obs">${esc(defectLabel(st.defect))}</span>` : ''}${st.mandatory === false ? '<br><span class="obs">optional</span>' : ''}${(st.attempts || []).length > 1 ? `<br><span class="obs">${st.attempts.length} attempts</span>` : ''}</td></tr>`;
    });
    html += `</table>`;
  }
}
html += `</body></html>`;
const htmlFile = path.join(dir, 'SCP_Full_Regression_Report.html');
fs.writeFileSync(htmlFile, html);
(async () => {
  const { chromium } = require('@playwright/test');
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto(`file:///${htmlFile.replace(/\\/g, '/')}`);
  const pdf = path.join(dir, 'SCP_Full_Regression_Report.pdf');
  await p.pdf({ path: pdf, format: 'A4', margin: { top: '12mm', bottom: '14mm', left: '10mm', right: '10mm' }, printBackground: true, displayHeaderFooter: true,
    headerTemplate: '<span></span>', footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#777">SCP Full Regression · page <span class="pageNumber"></span> / <span class="totalPages"></span></div>' });
  await b.close();
  console.log(`A4 PDF: ${pdf} (${(fs.statSync(pdf).size / 1048576).toFixed(1)} MB)`);
})();
