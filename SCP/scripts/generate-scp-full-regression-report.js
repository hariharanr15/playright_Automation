// Consolidated HTML/PDF for a run directory written by run-scp-full-regression.js. Usage: node scripts/generate-scp-full-regression-report.js RUN_DIR
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const css = status => String(status || '').replace(/[^A-Za-z]/g, '');
const seconds = ms => ms === undefined || ms === null ? '' : `${(Number(ms) / 1000).toFixed(1)} s`;
const time = value => value ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Calcutta', dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value)) : '';
const stepDuration = step => step.durationMs ?? (step.startedAt && step.finishedAt ? new Date(step.finishedAt) - new Date(step.startedAt) : null);
const image = file => file && fs.existsSync(file) ? `<img src="data:image/png;base64,${fs.readFileSync(file).toString('base64')}" alt="Step evidence">` : '';
const read = file => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
const dataJson = value => JSON.stringify(value, (key, item) => ['permissions', 'navigation'].includes(key) && Array.isArray(item)
  ? { count: item.length, evidence: 'Full values retained in execution.json and the access matrix' } : item, 2);

function accessSection(matrix) {
  if (!matrix?.combinations?.length) return '<p>No access matrix was produced. Module stages that need access were Blocked (or only registered in plan mode).</p>';
  return `<p>Expectations: ${matrix.expectationsSource ? escape(matrix.expectationsSource) : 'none configured; statuses are observed and not validated'}.
    Session role and permissions are recorded from the application and are never used as the expected result.</p>` +
  matrix.combinations.map(item => `<h3 class="${css(item.status)}">${escape(item.account)} (${escape(item.user)}) — ${escape(item.project)} — ${escape(item.status || 'Not evaluated')}</h3>
    <p><b>Effective role:</b> ${item.role ? `${escape(item.role.name)} (${escape(item.role.code)}), ${item.role.permissionCount} permission codes` : 'not exposed in session metadata'}
    ${item.expectedRole ? ` · <b>Expected role:</b> ${escape(item.expectedRole)} (${item.roleMatches === undefined ? 'not observed' : item.roleMatches ? 'matched' : 'mismatch'})` : ''}
    ${item.source ? ` · <b>Expectation source:</b> ${escape(item.source)}` : ''}${item.primary ? ' · <b>Account used for module suites</b>' : ''}</p>
    ${item.error ? `<p class="Failed">${escape(item.error)}</p>` : ''}
    ${item.carriedOver ? `<p><b>Carried over after project switch:</b> ${escape(item.carriedOver.join(', ') || 'none')}</p>` : ''}
    ${item.modules?.length ? `<table><tr><th>#</th><th>Module</th><th>Navigation</th><th>Page</th><th>Actions</th><th>Expected</th><th>Status</th><th>Findings</th></tr>
    ${item.modules.map(module => `<tr><td>${module.order}</td><td>${escape(module.name)}</td><td>${module.navVisible ? escape(module.navPaths.join('; ')) : 'Not shown'}</td>
      <td>${escape(module.page.reason)}${module.page.deniedResponses?.length ? `<br>${module.page.deniedResponses.length} × 401/403` : ''}</td>
      <td>${escape(module.actions.map(action => `${action.name}: ${action.visible === null ? 'not observed' : action.visible ? 'visible' : 'absent'}`).join('; ') || '—')}</td>
      <td>${module.evaluation.validated ? (module.evaluation.expected ? 'Accessible' : 'Not accessible') : 'Not configured'}</td>
      <td class="${css(module.evaluation.status)}">${escape(module.evaluation.status)}</td><td>${escape(module.evaluation.findings.join('; ') || '—')}</td></tr>`).join('')}</table>
    <details><summary>Captured navigation</summary><pre>${escape((item.navigation || []).join('\n'))}</pre></details>` : ''}`).join('');
}

function scenarioSection(scenario, manifest, context) {
  const steps = scenario.steps || [];
  const blocked = steps.filter(step => step.status === 'Blocked');
  const rerunnable = ['Failed', 'Blocked', 'Access Validation Failed'].includes(scenario.status);
  const rerun = scenario.rerun || (scenario.file && scenario.configFile ? `node scripts/rerun-scp-scenarios.js "${path.join(manifest.run, 'execution.json')}" --id=${scenario.id} --execute` : '');
  const title = scenario.title.startsWith(scenario.id) ? scenario.title.slice(scenario.id.length).trim() : scenario.title;
  return `<section><h3 class="${css(scenario.status)}">${escape(scenario.id)} — ${escape(title)} — ${escape(scenario.status)}</h3>
    <p><b>Module:</b> ${escape(scenario.module)} · <b>Stage:</b> ${escape(scenario.stage)} · <b>Duration:</b> ${seconds(scenario.durationMs)} · <b>Started:</b> ${escape(time(scenario.startedAt))}</p>
    <p><b>User / project / role:</b> ${escape(context)}</p>
    <p><b>Objective:</b> ${escape(scenario.objective)}</p><p><b>Prerequisites:</b> ${escape((scenario.prerequisites || []).join('; '))}</p>
    <p><b>Expected:</b> ${escape(scenario.expected)}</p><p><b>Actual:</b></p><pre>${escape(scenario.actual || '')}</pre>
    ${scenario.knownDefect ? `<p class="KnownDefect"><b>Known defect ${escape(scenario.knownDefect.id)}:</b> ${escape(scenario.knownDefect.summary)} (native status ${escape(scenario.originalStatus)}; failed with the registered signature)</p>` : ''}
    ${scenario.knownDefectNotReproduced ? `<p class="Passed"><b>Registered defect ${escape(scenario.knownDefectNotReproduced.join(', '))} did not reproduce.</b> Confirm the fix and remove the entry from config/scp-known-defects.js.</p>` : ''}
    ${scenario.recoveryReport ? `<p><b>Recovery review:</b> ${escape(scenario.originalStatus || 'Supplemental verification')} → ${escape(scenario.status)} · <a href="${escape(path.relative(manifest.run, path.join(path.dirname(scenario.recoveryReport), 'execution.html')).replace(/\\/g, '/'))}">Latest detailed HTML</a> · <a href="${escape(path.relative(manifest.run, path.join(path.dirname(scenario.recoveryReport), 'execution.pdf')).replace(/\\/g, '/'))}">Latest detailed PDF</a></p>
    ${scenario.originalActual ? `<details><summary>Original result and errors</summary><pre>${escape(scenario.originalActual)}\n${escape((scenario.originalErrors || []).join('\n'))}</pre></details>` : ''}` : ''}
    ${scenario.history?.length ? `<details><summary>Checkpointed failure and retry history</summary><pre>${escape(JSON.stringify(scenario.history.map(step => ({ name: step.name, status: step.status, startedAt: step.startedAt, attempts: (step.attempts || []).map(attempt => ({ number: attempt.number, status: attempt.status, error: attempt.error, reason: attempt.reason })) })), null, 2))}</pre></details>` : ''}
    ${(scenario.recordedEvidence || []).map(item => item.value?.attempts ? `<p><b>Applied date ranges (${escape(item.name)}):</b></p><table><tr><th>From</th><th>To</th><th>Records</th><th>Outcome</th></tr>${item.value.attempts.map(attempt => `<tr><td>${escape(attempt.from)}</td><td>${escape(attempt.to)}</td><td>${escape(attempt.count ?? '')}</td><td>${escape(attempt.outcome)}</td></tr>`).join('')}</table>`
      : `<details open><summary>Recorded evidence: ${escape(item.name)}</summary><pre>${escape(JSON.stringify(item.value, null, 2).slice(0, 6000))}</pre></details>`).join('')}
    ${scenario.data && Object.keys(scenario.data).length ? `<details><summary>Test data and record identifiers</summary><pre>${escape(dataJson(scenario.data))}</pre></details>` : ''}
    ${steps.length ? `<table><tr><th>Step</th><th>Expected / actual</th><th>Status</th><th>Attempts</th><th>Duration</th></tr>${steps.map(step => `<tr><td>${escape(step.name)}${step.dependsOn?.length ? `<br>Depends on: ${escape(step.dependsOn.join(', '))}` : ''}</td>
      <td>${escape(step.expected || '')}<pre>${escape(step.actual || '')}</pre>${(step.attempts || []).filter(attempt => attempt.status !== 'Passed').map(attempt => `<b>Attempt ${attempt.number}: ${escape(attempt.status)}</b> ${escape(attempt.reason || '')}${image(attempt.evidence?.screenshot)}`).join('')}</td>
      <td class="${css(step.status)}">${escape(step.status)}${step.blockedBy ? `<br>Blocked by ${escape(step.blockedBy)}` : ''}</td><td>${step.attemptCount ?? 0}</td><td>${seconds(stepDuration(step))}</td></tr>`).join('')}</table>` : '<p>No managed steps were recorded.</p>'}
    <p><b>Dependency impact:</b> ${escape(blocked.map(step => `${step.name} (blocked by ${step.blockedBy || 'missing prerequisite'})`).join('; ') || 'No dependent steps blocked')}</p>
    <p><b>Targeted rerun:</b> ${rerunnable ? (rerun ? `<code>${escape(rerun)}</code>${scenario.checkpoint ? ' — recovery checkpoint retained; validated records are reused' : ''}` : 'Not eligible (no registered test file)') : 'Not required'}</p>
    ${['Failed', 'Blocked', 'Access Validation Failed'].includes(scenario.status) ? image((scenario.attachments || []).filter(item => item.contentType === 'image/png').at(-1)?.path) : ''}
    <p>${(scenario.attachments || []).filter(item => /trace|image|png/.test(item.name + item.contentType)).map(item => `<a href="${escape(path.relative(manifest.run, path.resolve(item.path)).replace(/\\/g, '/'))}">${escape(item.name)}</a>`).join(' · ')}</p>
    ${scenario.attachments?.length ? `<p><b>Evidence:</b> ${scenario.attachments.filter(item => /trace|image|png/.test(item.name + item.contentType)).slice(0, 12).map(item => escape(path.basename(item.path))).join(', ')}</p>` : ''}</section>`;
}

const STYLE = `body{font:13px Arial,sans-serif;margin:24px;color:#172033}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #cbd5e1;padding:6px;text-align:left;vertical-align:top}
    th{background:#f1f5f9}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;margin:4px 0}img{max-width:100%;max-height:240px;object-fit:contain;display:block}
    .Passed,.Accessible,.Validated{color:#166534}.Failed,.AccessValidationFailed{color:#b91c1c}.Blocked{color:#92400e}.KnownDefect{color:#6d28d9}.Skipped,.NotAccessible,.Registered{color:#475569}
    @media print{body{margin:0}tr,section{break-inside:avoid}details{display:block}summary{display:none}}`;

async function printPdf(browser, htmlFile, pdf) {
  const page = await browser.newPage();
  try {
    await page.goto(pathToFileURL(htmlFile).href, { waitUntil: 'load' });
    await page.locator('details').evaluateAll(elements => elements.forEach(element => { element.open = true; }));
    await page.pdf({ path: pdf, format: 'A4', landscape: true, printBackground: true, margin: { top: '10mm', right: '8mm', bottom: '10mm', left: '8mm' },
      displayHeaderFooter: true, headerTemplate: '<span></span>',
      footerTemplate: '<div style="font:9px Arial;width:100%;text-align:center;color:#64748b">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>' });
  } finally { await page.close(); }
}

// One report per module: its access, stages, scenario summary and every scenario's steps and statuses.
function moduleHtml(module, scenarios, manifest, matrix, moduleContext) {
  const statuses = ['Passed', 'Known Defect', 'Failed', 'Skipped', 'Blocked', 'Not Accessible', 'Access Validation Failed'];
  const counts = scenarios.reduce((total, item) => ({ ...total, [item.status]: (total[item.status] || 0) + 1 }), {});
  const stepCounts = scenario => { const steps = scenario.steps || []; return `${steps.filter(step => step.status === 'Passed').length} / ${steps.length}`; };
  const status = module.stages.some(stage => ['Failed', 'Access Validation Failed'].includes(stage.status)) ? 'Failed'
    : module.stages.some(stage => stage.status === 'Blocked') ? 'Blocked' : module.stages.some(stage => stage.status === 'Known Defect') ? 'Known Defect'
    : module.stages.some(stage => stage.status === 'Passed') ? 'Passed' : 'Not executed';
  return `<!doctype html><html><head><meta charset="utf-8"><base href="../"><title>${module.order}. ${escape(module.name)}</title><style>${STYLE}</style></head><body>
    <h1>Module ${module.order}: ${escape(module.name)} — <span class="${css(status)}">${escape(status)}</span></h1>
    <p><b>Run:</b> ${escape(path.basename(manifest.run))} · <b>Browser:</b> Google Chrome ${manifest.headless ? 'headless' : 'headed'} · <b>Started:</b> ${escape(time(manifest.startedAt))} · <b>Finished:</b> ${escape(time(manifest.finishedAt))}</p>
    <p><b>User / project / role:</b> ${escape(moduleContext)} · <b>Access:</b> <span class="${css(module.access.status)}">${escape(module.access.status)}</span>${module.access.validated === false ? ' (observed)' : ''}
    ${(module.access.findings || []).filter(item => !/informational/.test(item)).map(item => ` · ${escape(item)}`).join('')}</p>
    ${module.coveredBy ? `<p><b>Coverage note:</b> ${escape(module.coveredBy)}</p>` : ''}
    <p>${scenarios.length} scenarios · ${statuses.map(item => `${item}: ${counts[item] || 0}`).join(' · ')}</p>
    <h2>Stages</h2><table><tr><th>Stage</th><th>Mode</th><th>Status</th><th>Detail</th></tr>${module.stages.map(stage => `<tr><td>${escape(stage.name)}</td><td>${escape(stage.mode || '')}</td>
      <td class="${css(stage.status)}">${escape(stage.status)}</td><td>${escape(stage.reason || `${(scenarios.filter(item => item.stage === stage.name)).length} scenario(s)`)}</td></tr>`).join('')}</table>
    ${scenarios.length ? `<h2>Scenario summary</h2><table><tr><th>#</th><th>Scenario ID</th><th>Scenario</th><th>Steps passed</th><th>Duration</th><th>Run history</th><th>Status</th></tr>
    ${scenarios.map((scenario, index) => `<tr><td>${index + 1}</td><td>${escape(scenario.id)}</td><td>${escape(scenario.title)}</td><td>${stepCounts(scenario)}</td><td>${seconds(scenario.durationMs)}</td>
      <td>${scenario.recoveryReport ? `Rerun: <span class="${css(scenario.originalStatus)}">${escape(scenario.originalStatus || 'Not run')}</span> → <span class="${css(scenario.status)}">${escape(scenario.status)}</span>` : 'Original run'}</td>
      <td class="${css(scenario.status)}">${escape(scenario.status)}</td></tr>`).join('')}</table>
    ${module.id === 'user-management' ? `<h2>Dynamic access by user and project</h2>${accessSection(matrix)}` : ''}
    <h2>Scenario steps</h2>${scenarios.map(scenario => scenarioSection(scenario, manifest,
      scenario.id.startsWith('SCP-UM-001') ? 'Per combination — see the access section' : moduleContext)).join('')}` : '<p>No scenarios were executed in this module; see the stage reasons above.</p>'}
    </body></html>`;
}

async function renderReport(run) {
  const manifest = { ...read(path.join(run, 'manifest.json')), run };
  const execution = read(path.join(run, 'execution.json')) || { scenarios: [] };
  const matrix = read(path.join(run, 'access-matrix.json'));
  const primary = (matrix?.combinations || []).find(item => item.primary && item.project.toLowerCase() === String(manifest.project).toLowerCase());
  const moduleContext = primary ? `${primary.user} / ${primary.project} / ${primary.role ? `${primary.role.name} (${primary.role.code})` : 'role not exposed'}` : `${manifest.user} / ${manifest.project} / access not discovered`;
  const statuses = ['Passed', 'Known Defect', 'Failed', 'Skipped', 'Blocked', 'Not Accessible', 'Access Validation Failed'];
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>SCP full regression</title><style>
    body{font:13px Arial,sans-serif;margin:24px;color:#172033}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #cbd5e1;padding:6px;text-align:left;vertical-align:top}
    th{background:#f1f5f9}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;margin:4px 0}img{max-width:100%;max-height:240px;object-fit:contain;display:block}
    .Passed,.Accessible,.Validated{color:#166534}.Failed,.AccessValidationFailed{color:#b91c1c}.Blocked{color:#92400e}.KnownDefect{color:#6d28d9}.Skipped,.NotAccessible,.Registered{color:#475569}
    @media print{body{margin:0}tr,section{break-inside:avoid}details{display:block}summary{display:none}}</style></head><body>
    <h1>SCP full regression</h1>
    ${manifest.sourceRun ? `<p><b>Recovery review of:</b> ${escape(manifest.sourceRun)}<br><b>Original counts:</b> ${escape(JSON.stringify(manifest.originalCounts))}<br><b>Selected verification results:</b> ${manifest.recoveryHistory?.length || 0}. Original evidence is retained; counts below use the latest selected result for each account/project/scenario.</p>` : ''}
    <p><b>Mode:</b> ${escape(manifest.mode)}${manifest.demo ? ' (demo)' : ''}${manifest.executionMode ? ` · <b>Speed:</b> ${escape(manifest.executionMode)}${manifest.policy?.actionIntervalMs ? ` (${manifest.policy.actionIntervalMs} ms between actions)` : ''}` : ''} · <b>Browser:</b> Google Chrome ${manifest.headless ? 'headless' : 'headed'}${manifest.browser?.mode === 'shared' ? ` · single shared instance, context and tab${manifest.browser.version ? ` (${escape(manifest.browser.version)})` : ''}${manifest.browser.interruptions?.length ? ` · <b>interrupted:</b> ${escape(manifest.browser.interruptions.map(item => `${item.phase} ${item.stage}: ${item.error}`).join('; '))}` : ''}` : ''} · <b>Project:</b> ${escape(manifest.project)} · <b>Account:</b> ${escape(manifest.user)}
    · <b>Started:</b> ${escape(time(manifest.startedAt))} · <b>Finished:</b> ${escape(time(manifest.finishedAt))}</p>
    <p><b>Options:</b> ${escape(JSON.stringify(manifest.options))} · <b>Allocations:</b> ${escape(JSON.stringify(manifest.allocations))}</p>
    <p>${statuses.map(status => `${status}: ${manifest.counts?.[status] || 0}`).join(' · ')}. Each managed action has at most two attempts; failed tests are not re-run as a whole; a module failure does not stop later modules.</p>
    ${manifest.knownDefects?.reproduced?.length || manifest.knownDefects?.notReproduced?.length ? `<h2>Known application defects</h2>
    <p>Registered in config/scp-known-defects.js. A scenario counts as Known Defect only when it failed with the defect's own signature; any other failure stays Failed.</p>
    ${manifest.knownDefects.reproduced.length ? `<table><tr><th>Defect</th><th>Summary</th><th>Scenario</th></tr>${manifest.knownDefects.reproduced.map(item => `<tr><td class="KnownDefect">${escape(item.defect)}</td><td>${escape(item.summary)}</td><td>${escape(item.scenario)} — ${escape(item.title)}</td></tr>`).join('')}</table>` : ''}
    ${manifest.knownDefects.notReproduced.length ? `<p class="Passed"><b>Not reproduced (possibly fixed — confirm and retire the entry):</b> ${escape(manifest.knownDefects.notReproduced.map(item => `${item.defects.join(', ')} in ${item.scenario}`).join('; '))}</p>` : ''}` : ''}
    <h2>Execution hierarchy</h2><table><tr><th>#</th><th>Module</th><th>Access (${escape(manifest.project)})</th><th>Stage</th><th>Mode</th><th>Status</th><th>Scenarios / reason</th></tr>
    ${manifest.modules.map(module => module.stages.map((stage, index) => `<tr>${index === 0 ? `<td rowspan="${module.stages.length}">${module.order}</td><td rowspan="${module.stages.length}">${escape(module.name)}${module.coveredBy ? `<br><small>${escape(module.coveredBy)}</small>` : ''}</td>
      <td rowspan="${module.stages.length}" class="${css(module.access.status)}">${escape(module.access.status)}${module.access.validated === false ? ' (observed)' : ''}${(module.access.findings || []).filter(item => !/informational/.test(item)).map(item => `<br><small>${escape(item)}</small>`).join('')}</td>` : ''}
      <td>${escape(stage.name)}</td><td>${escape(stage.mode || '')}</td><td class="${css(stage.status)}">${escape(stage.status)}</td>
      <td>${stage.registeredCases !== undefined ? `${escape(stage.registeredCases)} registered` : ''}${escape(stage.reason || '')}${stage.report ? `<br><small>${escape(path.relative(run, stage.report))}</small>` : ''}</td></tr>`).join('')).join('')}</table>
    <h2>Dynamic access by user and project</h2>${accessSection(matrix)}
    <h2>Scenario and step results</h2>
    ${execution.scenarios.length ? manifest.modules.map(module => {
      const list = execution.scenarios.filter(scenario => scenario.module === module.name);
      return list.length ? `<h2>${module.order}. ${escape(module.name)}</h2>${list.map(scenario => scenarioSection(scenario, manifest,
        scenario.id.startsWith('SCP-UM-001') ? 'Per combination — see the access section' : moduleContext)).join('')}` : '';
    }).join('') : '<p>No scenarios executed (registration-only run or every stage gated).</p>'}
    </body></html>`;
  const htmlFile = path.join(run, 'SCP_Full_Regression_Report.html');
  fs.writeFileSync(htmlFile, html);
  if (manifest.mode === 'registration-only') return { html: htmlFile, pdf: null };
  let browser; let pdf = null; const modulePdfs = [];
  try {
    browser = await require('@playwright/test').chromium.launch({ channel: 'chrome', headless: true });
    pdf = path.join(run, 'SCP_Full_Regression_Report.pdf');
    await printPdf(browser, htmlFile, pdf);
    const directory = path.join(run, 'modules');
    fs.mkdirSync(directory, { recursive: true });
    for (const module of manifest.modules) {
      const base = path.join(directory, `${String(module.order).padStart(2, '0')}_${module.name.replace(/[^A-Za-z0-9]+/g, '_')}`);
      fs.writeFileSync(`${base}.html`, moduleHtml(module, execution.scenarios.filter(scenario => scenario.module === module.name), manifest, matrix, moduleContext));
      await printPdf(browser, `${base}.html`, `${base}.pdf`);
      modulePdfs.push(`${base}.pdf`);
    }
  } catch (error) {
    fs.writeFileSync(path.join(run, 'pdf-generation-error.txt'), error.stack || error.message);
    throw error;
  } finally { await browser?.close(); }
  return { html: htmlFile, pdf, modulePdfs };
}

if (require.main === module) {
  if (!process.argv[2]) { console.error('Usage: node scripts/generate-scp-full-regression-report.js RUN_DIR'); process.exitCode = 1; }
  else renderReport(path.resolve(process.argv[2])).then(result => console.log(result.html, result.pdf || '(registration only)')).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { renderReport };
