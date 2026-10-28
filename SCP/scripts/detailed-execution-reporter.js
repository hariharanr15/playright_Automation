const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { scenarioId } = require('../utils/execution-journal');
const { moduleName } = require('../utils/scp-step');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = text => String(text || '').replace(/\u001b\[[0-9;]*m/g, '');
const STATUSES = ['Passed', 'Failed', 'Skipped', 'Blocked', 'Not Accessible', 'Access Validation Failed'];
const zero = () => Object.fromEntries(STATUSES.map(status => [status, 0]));
// Structured JSON evidence shown in the HTML/PDF reports (applied date ranges, record counts, cross-project comparisons).
const REPORTED_EVIDENCE = ['date-search-evidence', 'inventory-calendar-default-expectation', 'enterprise-cross-project-comparison'];
function recordedEvidence(attachments = []) {
  return attachments.filter(item => REPORTED_EVIDENCE.includes(item.name) && item.body).map(item => {
    try { return { name: item.name, value: JSON.parse(item.body.toString('utf8')) }; } catch { return null; }
  }).filter(Boolean);
}
class DetailedExecutionReporter {
  constructor(options = {}) {
    this.directory = path.resolve(options.outputDirectory || (options.outputFile && path.dirname(options.outputFile)) || process.env.SCP_DETAILED_RUN_DIR || path.join('reports', `detailed-${new Date().toISOString().replace(/[:.]/g, '-')}`));
    this.scenarios = []; this.nativeSteps = new Map();
  }
  onBegin(config) { this.configFile = config.configFile; this.startedAt = new Date().toISOString(); }
  onStepEnd(test, result, step) {
    if (!['test.step', 'expect'].includes(step.category)) return;
    const list = this.nativeSteps.get(test.id) || [];
    list.push({ name: step.title, status: step.error ? 'Failed' : 'Passed', startedAt: step.startTime?.toISOString(), durationMs: step.duration,
      actual: step.error ? clean(step.error.message) : 'Declared action/assertion completed', native: true });
    this.nativeSteps.set(test.id, list);
  }
  onTestEnd(test, result) {
    const attachment = result.attachments.find(item => item.name === 'scp-execution-journal');
    let journal;
    if (attachment) journal = JSON.parse(attachment.body ? attachment.body.toString('utf8') : fs.readFileSync(attachment.path, 'utf8'));
    const file = path.relative(path.resolve('tests'), test.location.file).replace(/\\/g, '/');
    const failedBusinessStep = journal?.steps.some(step => step.status === 'Failed');
    const blocked = !failedBusinessStep && (test.annotations.some(item => item.type === 'blocked') || result.errors.some(error => /BLOCKED:/.test(error.message || '')));
    const annotations = [...new Map([...test.annotations, ...(result.annotations || [])].map(item => [`${item.type}\u0000${item.description}`, item])).values()];
    const access = annotations.find(item => ['not-accessible', 'access-validation-failed'].includes(item.type));
    const native = blocked ? 'Blocked' : result.status === 'passed' ? 'Passed' : result.status === 'skipped' ? 'Skipped' : 'Failed';
    const status = access ? (access.type === 'not-accessible' ? 'Not Accessible' : 'Access Validation Failed') : native;
    const scenario = journal?.scenario || { id: scenarioId(file, test.title), file, title: test.title, module: moduleName(file),
      objective: `Validate ${test.title}`, prerequisites: ['Scenario-specific fixture data'], expected: 'Declared scenario assertions pass' };
    const steps = journal?.steps || [];
    if (status === 'Failed' && !steps.some(step => step.status === 'Failed')) {
      const last = (this.nativeSteps.get(test.id) || []).filter(step => step.status === 'Failed').at(-1);
      steps.push({ id: `${scenario.id}-native-failure`, name: last?.name || 'Scenario setup or postcondition', expected: scenario.expected,
        actual: result.errors.map(error => clean(error.message)).join('\n'), status: 'Failed', attemptCount: 1, attempts: [],
        note: 'Native setup/postcondition; no whole-workflow restart was performed' });
    }
    this.scenarios.push({ ...scenario, line: test.location.line, project: test.parent.project()?.name, configFile: this.configFile,
      status, nativeStatus: result.status, expectedStatus: test.expectedStatus, startedAt: result.startTime.toISOString(), durationMs: result.duration,
      actual: result.errors.length ? result.errors.map(error => clean(error.message)).join('\n') : status === 'Passed' ? 'All executed scenario assertions passed' : annotations.map(item => item.description).filter(Boolean).join('; ') || status,
      errors: result.errors.map(error => clean(error.message)), annotations,
      prerequisites: scenario.prerequisites, checkpoint: journal?.checkpoint, context: journal?.context,
      data: journal?.data || {}, steps, history: journal?.history || [], observedWrites: journal?.observedWrites || [],
      nativeSteps: this.nativeSteps.get(test.id) || [], attachments: result.attachments.filter(item => item.path).map(item => ({ name: item.name, path: item.path, contentType: item.contentType })),
      recordedEvidence: recordedEvidence(result.attachments) });
  }
  async onEnd(result) {
    fs.mkdirSync(this.directory, { recursive: true });
    const counts = this.scenarios.reduce((total, item) => { total[item.status] = (total[item.status] || 0) + 1; return total; }, zero());
    const modules = {};
    for (const scenario of this.scenarios) {
      modules[scenario.module] ||= zero();
      modules[scenario.module][scenario.status]++;
    }
    const report = { generatedAt: new Date().toISOString(), startedAt: this.startedAt, timezone: 'Asia/Calcutta', nativeStatus: result.status,
      policy: { maximumAttemptsPerStep: 2, wholeTestRetries: 0, unsafeCreationRetries: 'Blocked until existence can be verified' }, counts, modules, scenarios: this.scenarios };
    fs.writeFileSync(path.join(this.directory, 'execution.json'), JSON.stringify(report, null, 2));
    for (const status of ['Failed', 'Blocked', 'Access Validation Failed']) fs.writeFileSync(path.join(this.directory, `${status.toLowerCase().replace(/ /g, '-')}-scenarios.json`), JSON.stringify({ status, scenarios: this.scenarios.filter(item => item.status === status) }, null, 2));
    const link = target => path.relative(this.directory, path.resolve(target)).replace(/\\/g, '/');
    const image = filename => filename && fs.existsSync(filename) ? `<img src="data:image/png;base64,${fs.readFileSync(filename).toString('base64')}" alt="Failure screenshot">` : '';
    const time = value => value ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Calcutta', dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value)) : 'Not executed';
    const evidence = scenario => scenario.attachments.filter(item => /trace|image/.test(item.name + item.contentType)).map(item => `<a href="${escape(link(item.path))}">${escape(item.name)}: ${escape(path.basename(item.path))}</a>`).join('<br>');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>SCP detailed execution</title><style>
      body{font:13px Arial;margin:24px;color:#172033}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;vertical-align:top}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px}img{max-width:100%;max-height:260px;object-fit:contain}section{margin-top:28px}h2{break-after:avoid}.Failed,.Access{color:#b91c1c}.Blocked{color:#92400e}.Passed{color:#166534}@media print{body{margin:0}tr{break-inside:avoid}details{display:block}summary{display:none}a{color:inherit}section{break-before:page}}
      </style></head><body><h1>SCP scenario and step execution</h1><p>${escape(time(this.startedAt))} · Asia/Calcutta · ${this.scenarios.length} scenarios.</p>
      <p>${STATUSES.map(status => `${status}: ${counts[status]}`).join('; ')}. Maximum two attempts per managed action; no whole-test retry. Reused records are validated before another creation action.</p>
      <h2>Module-wise results</h2><table><tr><th>Module</th>${STATUSES.map(status => `<th>${status}</th>`).join('')}</tr>${Object.entries(modules).map(([name, value]) => `<tr><td>${escape(name)}</td>${STATUSES.map(status => `<td>${value[status]}</td>`).join('')}</tr>`).join('')}</table>
      <h2>Rerun summary</h2><p>${counts.Failed} failed and ${counts.Blocked} blocked scenarios have separate JSON lists. Use <code>node scripts/rerun-scp-scenarios.js PATH_TO_execution.json --id=SCENARIO_ID</code> to inspect a targeted rerun; append <code>--execute</code> after fixing the cause. Valid recovery checkpoints are preserved. A missing existence verifier prevents unsafe recreation.</p>
      ${this.scenarios.map(scenario => `<section><h2 class="${scenario.status.split(' ')[0]}">${escape(scenario.id)} — ${escape(scenario.title)} — ${scenario.status}</h2>
      <p><b>Module:</b> ${escape(scenario.module)} · <b>Browser:</b> ${escape(scenario.project)} · <b>Duration:</b> ${(scenario.durationMs / 1000).toFixed(2)} seconds · <b>Started:</b> ${escape(time(scenario.startedAt))}</p>
      <p><b>Objective:</b> ${escape(scenario.objective)}</p><p><b>Prerequisites:</b> ${escape(scenario.prerequisites.join('; '))}</p>
      <p><b>Expected:</b> ${escape(scenario.expected)}</p><p><b>Actual:</b></p><pre>${escape(scenario.actual)}</pre>
      <p><b>Data and record identifiers:</b></p><pre>${escape(JSON.stringify(scenario.data, null, 2))}</pre>
      <table><tr><th>Step / dependencies</th><th>Expected / actual</th><th>Status / attempts / timestamps</th></tr>${scenario.steps.map(step => `<tr><td>${escape(step.name)}<br>${escape(step.id)}<br>Depends on: ${escape((step.dependsOn || []).join(', ') || 'None')}<br>${step.blockedBy ? `Blocked by: ${escape(step.blockedBy)}` : ''}</td><td>${escape(step.expected)}<pre>${escape(step.actual)}</pre>${step.note ? escape(step.note) : ''}</td><td class="${step.status}">${escape(step.status)} · ${step.attemptCount ?? 0} attempt(s)<br>${escape(time(step.startedAt))}${(step.attempts || []).map(attempt => `<hr><b>Attempt ${attempt.number}: ${escape(attempt.status)}</b> · ${attempt.reused ? 'Validated reuse; action not repeated' : attempt.actionExecuted ? 'Action executed' : 'Action not executed'}<br>${escape(time(attempt.startedAt))}<pre>${escape(attempt.error || attempt.actual || '')}</pre>${escape(attempt.reason || '')}${attempt.retrySuppressed ? '<p>Unsafe repeat suppressed.</p>' : ''}${image(attempt.evidence?.screenshot)}${attempt.evidence?.screenshotUnavailable ? `<p>Screenshot unavailable: ${escape(attempt.evidence.screenshotUnavailable)}</p>` : ''}`).join('')}</td></tr>`).join('')}</table>
      <h3>Impacted dependencies</h3><p>${escape(scenario.steps.filter(step => step.status === 'Blocked').map(step => `${step.name} (blocked by ${step.blockedBy || 'missing prerequisite'})`).join('; ') || 'No declared dependent steps blocked')}</p>
      <h3>Evidence and traces</h3><p>${evidence(scenario) || 'No file attachments recorded'}</p>${scenario.status === 'Failed' ? image(scenario.attachments.find(item => item.contentType === 'image/png')?.path) : ''}
      <details><summary>Native action/assertion log and previous recovery history</summary><pre>${escape(JSON.stringify({ managedStepEvidence: scenario.steps.map(step => ({ id: step.id, records: step.records, responses: step.responses, failureReason: step.failureReason })), nativeSteps: scenario.nativeSteps, previousRuns: scenario.history }, null, 2))}</pre></details></section>`).join('')}
      </body></html>`;
    const htmlFile = path.join(this.directory, 'execution.html'); fs.writeFileSync(htmlFile, html);
    let browser;
    try {
      browser = await require('@playwright/test').chromium.launch({ channel: 'chrome', headless: true });
      const page = await browser.newPage();
      await page.goto(pathToFileURL(htmlFile).href, { waitUntil: 'load' });
      await page.locator('details').evaluateAll(elements => elements.forEach(element => { element.open = true; }));
      await page.pdf({ path: path.join(this.directory, 'execution.pdf'), format: 'A4', printBackground: true, margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' } });
    } catch (error) {
      fs.writeFileSync(path.join(this.directory, 'pdf-generation-error.txt'), error.stack || error.message);
      process.exitCode = 1;
    } finally { await browser?.close(); }
  }
}
module.exports = DetailedExecutionReporter;


