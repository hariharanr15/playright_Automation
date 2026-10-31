// HTML report for a PM flow run (Smoke or Regression), grouped by module and submodule.
const fs = require('fs');
const path = require('path');

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const seconds = ms => `${((ms || 0) / 1000).toFixed(1)} s`;
const COLORS = { Passed: '#15803d', Failed: '#b91c1c', Blocked: '#b45309', 'Known Defect': '#7c3aed', Skipped: '#6b7280' };
const badge = status => `<span class="badge" style="background:${COLORS[status] || '#374151'}">${esc(status)}</span>`;

function groupBySubmodule(scenarios) {
  const groups = new Map();
  for (const scenario of scenarios) {
    const key = `${scenario.module} › ${scenario.submodule}`;
    if (!groups.has(key)) groups.set(key, { module: scenario.module, submodule: scenario.submodule, scenarios: [] });
    groups.get(key).scenarios.push(scenario);
  }
  return [...groups.values()];
}

function stepRows(scenario) {
  if (!scenario.steps.length) return `<tr><td colspan="4" class="muted">${esc(scenario.reason || 'No steps executed')}</td></tr>`;
  return scenario.steps.map((step, index) => {
    const failures = (step.attempts || []).filter(attempt => attempt.status === 'Failed').map(attempt => `
      <div class="attempt"><b>Attempt ${attempt.number}:</b> <pre>${esc(attempt.error)}</pre>
      ${attempt.screenshot ? `<a href="${esc(attempt.screenshot)}" target="_blank"><img src="${esc(attempt.screenshot)}" alt="Screenshot of attempt ${attempt.number}"></a>` : ''}</div>`).join('');
    const attempts = (step.attempts || []).length;
    const note = step.reason ? `<div class="muted">${esc(step.reason)}</div>` : '';
    const retried = step.status === 'Passed' && attempts > 1 ? ' <span class="muted">(passed on retry)</span>' : '';
    const defect = step.defect ? ` <span class="muted">(${esc(step.defect)})</span>` : '';
    return `<tr><td>${index + 1}</td><td>${esc(step.name)}${retried}${note}${failures}</td><td>${badge(step.status)}${defect}</td><td>${seconds(step.durationMs)}</td></tr>`;
  }).join('');
}

function writeReport(result, outDir) {
  const groups = groupBySubmodule(result.scenarios);
  const s = result.summary;
  const durationMs = new Date(result.finishedAt) - new Date(result.startedAt);
  const groupRows = groups.map(group => {
    const count = status => group.scenarios.filter(item => item.status === status).length;
    return `<tr><td>${esc(group.module)}</td><td><a href="#${esc(group.submodule.replace(/\W+/g, '-'))}">${esc(group.submodule)}</a></td>
      <td>${group.scenarios.length}</td><td class="ok">${count('Passed')}</td><td class="bad">${count('Failed')}</td><td class="warn">${count('Blocked')}</td><td class="kd">${count('Known Defect')}</td><td class="muted">${count('Skipped')}</td></tr>`;
  }).join('');
  const details = groups.map(group => `
    <h2 id="${esc(group.submodule.replace(/\W+/g, '-'))}">${esc(group.module)} › ${esc(group.submodule)}</h2>
    ${group.scenarios.map(scenario => `
      <details ${scenario.status === 'Passed' || scenario.status === 'Skipped' ? '' : 'open'}>
        <summary>${badge(scenario.status)} <b>${esc(scenario.id)}</b> – ${esc(scenario.title)} <span class="muted">${seconds(scenario.durationMs)}${scenario.reason && !scenario.steps.length ? ' · ' + esc(scenario.reason) : ''}</span></summary>
        <table class="steps"><thead><tr><th>#</th><th>Step</th><th>Status</th><th>Time</th></tr></thead><tbody>${stepRows(scenario)}</tbody></table>
      </details>`).join('')}`).join('');
  const rerun = result.rerun.length
    ? `<p>Re-run only these scenarios later:</p><pre>npm run pm:${result.suite.toLowerCase()} -- --only=${esc(result.rerun.join(','))}</pre>`
    : '<p class="ok">Nothing to re-run.</p>';
  const env = result.environment;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>SCP PM ${esc(result.suite)} Report</title>
<style>
  body { font: 14px/1.45 'Segoe UI', Arial, sans-serif; color: #1f2937; margin: 0; background: #f8fafc; }
  header { background: #0f766e; color: #fff; padding: 18px 28px; } header h1 { margin: 0 0 4px; font-size: 22px; }
  main { padding: 20px 28px; max-width: 1400px; } h2 { color: #0f766e; margin-top: 28px; font-size: 17px; }
  .tiles { display: flex; gap: 12px; flex-wrap: wrap; margin: 6px 0 18px; }
  .tile { background: #fff; border: 1px solid #d1d5db; border-radius: 8px; padding: 10px 16px; min-width: 110px; }
  .tile b { display: block; font-size: 22px; } table { border-collapse: collapse; width: 100%; background: #fff; }
  th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; vertical-align: top; } th { background: #e6f2f0; }
  details { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; margin: 8px 0; padding: 6px 10px; }
  summary { cursor: pointer; padding: 4px 0; } .steps { margin: 8px 0; }
  .badge { color: #fff; border-radius: 4px; padding: 1px 7px; font-size: 12px; font-weight: 600; }
  .ok { color: #15803d; } .bad { color: #b91c1c; } .warn { color: #b45309; } .kd { color: #7c3aed; } .muted { color: #6b7280; }
  pre { white-space: pre-wrap; background: #f3f4f6; padding: 6px 8px; border-radius: 4px; margin: 4px 0; font-size: 12px; }
  .attempt img { max-width: 520px; border: 1px solid #d1d5db; margin-top: 4px; }
</style></head><body>
<header><h1>SCP – Project Management · ${esc(result.suite)} report</h1>
<div>${esc(env.project || '')} · ${esc(env.account || '')} · ${esc(env.browser || '')} · ${esc(new Date(result.startedAt).toLocaleString())} · ${seconds(durationMs)}</div></header>
<main>
<div class="tiles">
  <div class="tile">Scenarios<b>${s.total}</b></div><div class="tile ok">Passed<b>${s.passed}</b></div>
  <div class="tile bad">Failed<b>${s.failed}</b></div><div class="tile warn">Blocked<b>${s.blocked}</b></div>
  <div class="tile kd">Known Defect<b>${s.knownDefects ?? 0}</b></div><div class="tile muted">Skipped<b>${s.skipped}</b></div><div class="tile">Logins<b>${env.logins ?? 1}</b></div>
  <div class="tile">Page navigations<b>${env.navigations ?? '-'}</b></div>
</div>
<h2>By module and submodule</h2>
<table><thead><tr><th>Module</th><th>Submodule</th><th>Scenarios</th><th>Passed</th><th>Failed</th><th>Blocked</th><th>Known Defect</th><th>Skipped</th></tr></thead><tbody>${groupRows}</tbody></table>
<h2>Re-run</h2>${rerun}
${details}
</main></body></html>`;
  const file = path.join(outDir, 'report.html');
  fs.writeFileSync(file, html);
  return file;
}

module.exports = { writeReport };
