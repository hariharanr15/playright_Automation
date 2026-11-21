// Step-level report for the end-to-end smoke: e2e-report.html (rewritten after every step, so a run that stops early still
// leaves a current report) and e2e-report.pdf at the end. Statuses are PASS / FAIL / SKIPPED / BLOCKED; a step that hit a
// registered known defect is a FAIL with the defect ID. The smoke is PASS only when every mandatory step passed.
const fs = require('fs');
const path = require('path');
const { defectLabel } = require('../../../config/scp-known-defects');

const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const secs = ms => (ms == null ? '' : `${(ms / 1000).toFixed(1)} s`);
const time = iso => (iso ? new Date(iso).toLocaleTimeString('en-GB') : '');
const STEP = { Passed: 'PASS', Failed: 'FAIL', 'Known Defect': 'FAIL', Blocked: 'BLOCKED', Skipped: 'SKIPPED', Running: 'RUNNING' };

// "Action → expected" step names carry their expected result after the arrow.
const split = name => { const i = name.indexOf('→'); return i < 0 ? [name, ''] : [name.slice(0, i).trim(), name.slice(i + 1).trim()]; };
const actual = step => {
  const last = step.attempts?.[step.attempts.length - 1];
  const observed = (step.reason || '').replace(/^Observed: /, '').replace(/ · Observed: /g, ' · ');
  if (step.status === 'Passed') return observed || 'As expected';
  if (step.status === 'Known Defect') return `Known defect ${defectLabel(step.defect)}: ${last?.error || ''}`;
  if (step.status === 'Blocked') return step.reason || 'Not executed';
  return last?.error || step.reason || '';
};

// Analytics before vs after: per page and section, every KPI value and every table row keyed by its first cell.
// Returns rows { page, tab, kind, key, before, after, change } with change = 'changed' | 'added' | 'removed' | 'same'.
function compareAnalytics(before = {}, after = {}) {
  const rows = [];
  const num = v => { const m = String(v ?? '').replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : null; };
  const delta = (b, a) => { const x = num(b); const y = num(a); return x != null && y != null && x !== y ? +(y - x).toFixed(2) : ''; };
  for (const pageName of [...new Set([...Object.keys(before), ...Object.keys(after)])]) {
    const B = before[pageName] || { sections: [] }; const A = after[pageName] || { sections: [] };
    const tabs = [...new Set([...B.sections.map(x => x.tab), ...A.sections.map(x => x.tab)])];
    for (const tab of tabs) {
      const b = B.sections.find(x => x.tab === tab) || { metrics: {}, tables: [], filters: [] };
      const a = A.sections.find(x => x.tab === tab) || { metrics: {}, tables: [], filters: [] };
      const add = (kind, key, bv, av) => rows.push({ page: pageName, tab, kind, key, before: bv ?? '', after: av ?? '', delta: delta(bv, av),
        change: bv === undefined ? 'added' : av === undefined ? 'removed' : bv === av ? 'same' : 'changed' });
      add('filters', 'Filters / toggles', (b.filters || []).join(' · '), (a.filters || []).join(' · '));
      for (const key of [...new Set([...Object.keys(b.metrics || {}), ...Object.keys(a.metrics || {})])]) add('KPI', key, (b.metrics || {})[key], (a.metrics || {})[key]);
      const n = Math.max((b.tables || []).length, (a.tables || []).length);
      for (let i = 0; i < n; i += 1) {
        const tb = (b.tables || [])[i] || { heads: [], rows: [] }; const ta = (a.tables || [])[i] || { heads: [], rows: [] };
        const label = `Table ${i + 1}${(ta.heads[0] || tb.heads[0]) ? ` (${(ta.heads.length ? ta.heads : tb.heads).slice(0, 3).join(' | ')})` : ''}`;
        add('table', `${label}: row count`, String(tb.rows.length), String(ta.rows.length));
        const key = r => r[0] || r.join(' | ');
        const mb = new Map(tb.rows.map(r => [key(r), r.slice(1).join(' | ')])); const ma = new Map(ta.rows.map(r => [key(r), r.slice(1).join(' | ')]));
        for (const k of [...new Set([...mb.keys(), ...ma.keys()])]) add('row', `${label} › ${k}`, mb.get(k), ma.get(k));
      }
    }
  }
  return rows;
}

function summarise(result) {
  const steps = result.scenarios.flatMap(s => s.steps.map(st => ({ ...st, scenario: s })));
  const count = status => steps.filter(st => STEP[st.status] === status).length;
  const cases = status => result.scenarios.filter(s => (s.status === 'Known Defect' ? 'FAIL' : STEP[s.status]) === status).length;
  const mandatoryBad = steps.filter(st => st.mandatory !== false && STEP[st.status] !== 'PASS');
  const blockedCases = result.scenarios.filter(s => ['Blocked'].includes(s.status));
  const done = !!result.finishedAt;
  const overall = !done ? 'RUNNING' : (mandatoryBad.length || blockedCases.length ? 'FAIL' : 'PASS');
  return { steps, total: steps.length, pass: count('PASS'), fail: count('FAIL'), skipped: count('SKIPPED'), blocked: count('BLOCKED'),
    cases: { total: result.scenarios.length, pass: cases('PASS'), fail: cases('FAIL'), skipped: cases('SKIPPED'), blocked: cases('BLOCKED') }, overall,
    durationMs: (done ? new Date(result.finishedAt) : new Date()) - new Date(result.startedAt) };
}

function html({ result, records, sessions, dashboard, title, video, home, analytics }) {
  const s = summarise(result);
  const badge = st => `<span class="b ${esc(st)}">${esc(st)}</span>`;
  const img = file => (file ? `<a href="${esc(file)}"><img src="${esc(file)}" loading="lazy"></a>` : '');
  const modules = [...new Set(result.scenarios.map(x => x.module))].map(m => {
    const sc = result.scenarios.filter(x => x.module === m); const st = sc.flatMap(x => x.steps);
    const n = k => st.filter(x => STEP[x.status] === k).length;
    return `<tr><td>${esc(m)}</td><td>${sc.length}</td><td>${st.length}</td><td>${n('PASS')}</td><td>${n('FAIL')}</td><td>${n('SKIPPED')}</td><td>${n('BLOCKED')}</td><td>${secs(sc.reduce((a, x) => a + (x.durationMs || 0), 0))}</td></tr>`;
  }).join('');
  const sessionRows = sessions.map(x => `<tr><td>${x.seq}</td><td>${esc(x.action)}</td><td>${esc(x.account)}</td><td>${esc(x.role)}</td><td>${esc(x.organization || '')}</td><td>${time(x.startedAt)}</td><td>${time(x.finishedAt)}</td><td>${badge(x.status)}</td><td>${img(x.screenshot)}</td></tr>`).join('');
  // Changed values are highlighted; the difference is current − previous when both are numbers.
  const diff = r => (typeof r.before === 'number' && typeof r.after === 'number' ? r.after - r.before : (r.difference ?? ''));
  const dashRows = (dashboard.rows || []).map(r => {
    const d = diff(r); const changed = d !== '' && d !== 0;
    return `<tr${changed ? ' class="chg"' : ''}><td>${esc(r.area)}</td><td>${esc(r.metric)}</td><td>${esc(r.before)}</td><td>${esc(r.after)}</td><td><b>${typeof d === 'number' && d > 0 ? '+' : ''}${esc(d)}</b></td><td>${esc(r.expected)}</td><td>${r.status ? badge(r.status) : ''}</td><td>${esc(r.note || '')}</td></tr>`;
  }).join('');
  // TC-25: every location check (verified + skipped, selected because the app cleared/changed it, or failed).
  const checks = (result.environment && result.environment.siteChecks) || [];
  const cnt = re => checks.filter(c => re.test(c.outcome)).length;
  const siteBlock = checks.length ? `<h2>Project / location selection (TC-25)</h2><p class="meta">${cnt(/skipped/)} verified and skipped · ${cnt(/selected successfully/)} selected (login or cleared/changed by the app) · ${cnt(/^FAIL/)} failed. The Location dropdown is opened only when the header does not show the selected location.</p><table><tr><th>#</th><th>Time</th><th>Where</th><th>Header showed</th><th>Outcome</th></tr>${checks.map((c, i) => `<tr${/^FAIL/.test(c.outcome) ? ' class="chg"' : ''}><td>${i + 1}</td><td>${time(c.time)}</td><td>${esc(c.at)}</td><td>${esc(c.found || '')}</td><td>${esc(c.outcome)}${c.error ? ` – ${esc(c.error)}` : ''}</td></tr>`).join('')}</table>` : '';
  // Analytics before vs after (TC-02B / TC-24): per-page summary, then every changed / added / removed value highlighted.
  const an = analytics && (analytics.before || analytics.after) ? analytics : null;
  const anRows = an ? compareAnalytics(an.before || {}, an.after || {}) : [];
  const anBlock = an ? (() => {
    const pages = [...new Set(anRows.map(r => r.page))];
    const summary = pages.map(pg => { const rs = anRows.filter(r => r.page === pg); const ch = rs.filter(r => r.change !== 'same');
      const b = (an.before || {})[pg]; const a = (an.after || {})[pg];
      return `<tr${ch.length ? ' class="chg"' : ''}><td>${esc(pg)}</td><td>${esc([...new Set(rs.map(r => r.tab))].join(', '))}</td><td>${rs.filter(r => r.kind === 'KPI').length}</td><td>${rs.filter(r => r.kind === 'row').length}</td><td><b>${ch.length}</b></td><td>${b ? time(b.at) : 'not captured'}</td><td>${a ? time(a.at) : 'not captured'}</td></tr>`; }).join('');
    const changed = anRows.filter(r => r.change !== 'same');
    const shots = pg => [...(((an.before || {})[pg] || {}).shots || []).slice(0, 1), ...(((an.after || {})[pg] || {}).shots || []).slice(0, 1)].map(img).join(' ');
    return `<h2>Analytics – before vs after (every page and section)</h2><p class="meta">Baseline captured before any master-data or procurement activity (TC-02B); current values after Procurement Log, delivery, GRN and FDI (TC-24). Same project, location and default filters. Highlighted = changed, added or removed. Values are compared as shown; a change is not by itself a failure (business-rule checks are in TC-24).</p>
  <table><tr><th>Page</th><th>Sections / sub-tabs</th><th>KPIs</th><th>Table rows</th><th>Differences</th><th>Before</th><th>After</th></tr>${summary}</table>
  <table><tr><th>Page</th><th>Section</th><th>Item</th><th>Previous</th><th>Current</th><th>Difference</th><th>Change</th></tr>${changed.slice(0, 600).map(r => `<tr class="chg"><td>${esc(r.page)}</td><td>${esc(r.tab)}</td><td>${esc(r.key)}</td><td>${esc(r.before)}</td><td>${esc(r.after)}</td><td><b>${typeof r.delta === 'number' && r.delta > 0 ? '+' : ''}${esc(r.delta)}</b></td><td>${esc(r.change)}</td></tr>`).join('') || '<tr><td colspan="7">No differences</td></tr>'}</table>
  ${changed.length > 600 ? `<p class="meta">${changed.length - 600} further differences in e2e-progress.json (analytics).</p>` : ''}
  ${pages.map(pg => `<p><b>${esc(pg)}</b> before / after: ${shots(pg)}</p>`).join('')}`;
  })() : '';
  // Homepage (TC-02): main navigation tabs with visibility, dashboard views and summary widgets at the start of the run.
  const homeBlock = home ? `<h2>Homepage at the start of the run</h2><table><tr><th>Main navigation tab</th><th>Visible</th></tr>${(home.tabs || []).map(t => `<tr><td>${esc(t.name)}</td><td>${t.visible ? 'Yes' : 'No'}</td></tr>`).join('')}</table>
  <table><tr><th>Widget / view</th><th>Value</th></tr>${Object.entries(home.widgets || {}).map(([k2, v]) => `<tr><td>${esc(k2)}</td><td>${esc(v)}</td></tr>`).join('')}<tr><td>Dashboard views</td><td>${esc((home.views || []).join(' · '))}</td></tr><tr><td>Urgent issues</td><td>${esc(home.urgent ?? '')}</td></tr><tr><td>Alerts / Notifications / Tasks (unread)</td><td>${esc(JSON.stringify(home.inbox || {}))}</td></tr></table><p>${home.shot ? `<a href="${esc(home.shot)}"><img src="${esc(home.shot)}" loading="lazy"></a>` : ''}</p>` : '';
  const recordRows = (records || []).map(r => `<tr><td>${esc(r.module)}</td><td>${esc(r.record)}</td><td>${esc(r.id)}</td><td>${esc(r.name)}</td><td>${esc(r.role || '')}</td><td>${esc(r.note || '')}</td></tr>`).join('');
  const caseBlocks = result.scenarios.map(sc => {
    const scStatus = sc.status === 'Known Defect' ? 'FAIL' : (STEP[sc.status] || sc.status);
    const rows = sc.steps.map(st => {
      const [act, exp] = split(st.name);
      const retries = (st.attempts || []).length > 1 ? `<div class="retry">${st.attempts.map(a => `Attempt ${a.number}: ${esc(a.status)}${a.error ? ` – ${esc(a.error.split('\n')[0])}` : ''}`).join('<br>')}</div>` : '';
      const shots = [st.evidence, ...(st.attempts || []).map(a => a.screenshot)].filter(Boolean);
      const retryCount = Math.max(0, (st.attempts || []).length - 1);
      return `<tr><td class="id">${esc(st.id || '')}<div class="opt">${esc(sc.id)} · ${esc(sc.module)}</div></td><td>${esc(act)}</td><td>${esc(exp)}</td><td>${esc(actual(st))}${retries}${st.recordId ? `<div class="rec">Record: ${esc(st.recordId)}</div>` : ''}</td><td>${badge(STEP[st.status] || st.status)}${st.mandatory === false ? '<div class="opt">optional</div>' : ''}<div class="opt">retries ${retryCount}</div></td><td>${esc(st.role || '')}<div class="opt">${esc(st.org || '')}</div></td><td>${time(st.startedAt)}–${time(st.finishedAt)}<div class="opt">${secs(st.durationMs)}</div></td><td>${shots.map(img).join('')}</td></tr>`;
    }).join('') || `<tr><td colspan="8">${esc(sc.reason || 'No steps executed')}</td></tr>`;
    return `<section><h3>${esc(sc.id)} · ${esc(sc.title)} ${badge(scStatus)}${sc.defects ? ` <span class="kd">${esc(sc.defects.map(defectLabel).join(', '))}</span>` : ''}</h3>
      <p class="meta">${esc(sc.module)} · ${secs(sc.durationMs)}${sc.reason && sc.steps.length ? ` · ${esc(sc.reason)}` : ''}</p>
      <table><tr><th>Step</th><th>Action</th><th>Expected</th><th>Actual</th><th>Status</th><th>Role / organisation</th><th>Time</th><th>Screenshot</th></tr>${rows}</table></section>`;
  }).join('');
  const failures = s.steps.filter(st => ['FAIL', 'BLOCKED'].includes(STEP[st.status])).map(st => `<li><b>${esc(st.id)}</b> ${esc(split(st.name)[0])}: ${esc(actual(st).split('\n')[0])}</li>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
  body{font:13px/1.45 system-ui,Segoe UI,Arial,sans-serif;margin:24px;color:#1f2933;background:#fff}h1{margin:0 0 4px}h2{margin:28px 0 8px;border-bottom:2px solid #0f766e;padding-bottom:4px}
  table{border-collapse:collapse;width:100%;margin:6px 0 14px}td,th{border:1px solid #d5dbe1;padding:5px 7px;vertical-align:top;text-align:left}th{background:#f1f5f4}
  .b{display:inline-block;padding:1px 8px;border-radius:10px;font-weight:600;font-size:11px;color:#fff}.PASS{background:#15803d}.FAIL{background:#b91c1c}.BLOCKED{background:#7c3aed}.SKIPPED{background:#64748b}.RUNNING{background:#b45309}
  .kpi{display:flex;gap:12px;flex-wrap:wrap}.kpi div{border:1px solid #d5dbe1;border-radius:8px;padding:8px 14px;min-width:110px}.kpi b{display:block;font-size:20px}
  img{max-width:150px;max-height:90px;border:1px solid #ccd;margin:2px}.id{white-space:nowrap;font-weight:600}.opt,.meta{color:#64748b;font-size:11px}.retry{color:#92400e;font-size:11px;margin-top:4px}.kd{color:#b91c1c;font-weight:600}
  section{page-break-inside:avoid}tr.chg td{background:#fff7d6}.rec{color:#0f766e;font-size:11px;margin-top:4px}</style></head><body>
  <h1>${esc(title)}</h1><p class="meta">${esc(result.environment?.baseUrl || '')} · project ${esc(result.environment?.project || '')} · ${esc(result.environment?.browser || '')} · started ${esc(new Date(result.startedAt).toLocaleString('en-GB'))}${result.finishedAt ? ` · finished ${esc(new Date(result.finishedAt).toLocaleString('en-GB'))}` : ' · in progress'}</p>
  ${video ? `<p>Full-run video: <a href="${esc(video)}">${esc(video)}</a> (MP4, written when the run ends)</p>` : ''}
  <div class="kpi"><div>Smoke result<b>${badge(s.overall)}</b></div><div>Test cases<b>${s.cases.total}</b>${s.cases.pass} pass · ${s.cases.fail} fail · ${s.cases.blocked} blocked · ${s.cases.skipped} skipped</div>
  <div>Test steps<b>${s.total}</b></div><div>Passed<b>${s.pass}</b></div><div>Failed<b>${s.fail}</b></div><div>Skipped<b>${s.skipped}</b></div><div>Blocked<b>${s.blocked}</b></div><div>Duration<b>${secs(s.durationMs)}</b></div></div>
  <h2>Module summary</h2><table><tr><th>Module</th><th>Test cases</th><th>Steps</th><th>Pass</th><th>Fail</th><th>Skipped</th><th>Blocked</th><th>Duration</th></tr>${modules}</table>
  <h2>Login / logout transitions</h2><table><tr><th>#</th><th>Action</th><th>Account</th><th>Role</th><th>Organisation</th><th>Start</th><th>End</th><th>Status</th><th>Screenshot</th></tr>${sessionRows}</table>
  ${homeBlock}
  ${siteBlock}
  <h2>Created records</h2><table><tr><th>Module</th><th>Record</th><th>ID</th><th>Name</th><th>Role</th><th>Note</th></tr>${recordRows}</table>
  <h2>Management Dashboard – previous vs current</h2><p class="meta">Highlighted rows changed during the run. Difference = current − previous.</p><table><tr><th>Area</th><th>Metric</th><th>Previous</th><th>Current</th><th>Difference</th><th>Expected</th><th>Status</th><th>Note</th></tr>${dashRows}</table>
  <p>${img(dashboard.beforeShot)} ${img(dashboard.afterShot)}</p> ${anBlock}
  ${failures ? `<h2>Failures and blocked steps</h2><ul>${failures}</ul>` : ''}
  <h2>Step-by-step results</h2>${caseBlocks}</body></html>`;
}

function writeE2eReport(state, outDir) {
  const file = path.join(outDir, 'e2e-report.html');
  fs.writeFileSync(file, html(state));
  fs.writeFileSync(path.join(outDir, 'e2e-progress.json'), JSON.stringify({ ...state, summary: summarise(state.result) }, null, 2));
  return file;
}

// PDF from the written HTML in a separate headless Chromium (the run's own Chrome window is not touched).
async function writeE2ePdf(outDir) {
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`file:///${path.join(outDir, 'e2e-report.html').replace(/\\/g, '/')}`, { waitUntil: 'load' });
    const pdf = path.join(outDir, 'e2e-report.pdf');
    await page.pdf({ path: pdf, format: 'A4', landscape: true, printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' } });
    return pdf;
  } finally { await browser.close(); }
}

module.exports = { writeE2eReport, writeE2ePdf, summarise, compareAnalytics };
