const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const dir = path.resolve(process.argv[2] || process.env.SCP_EXECUTION_DIR || '');
if (!fs.existsSync(path.join(dir, 'preflight.json'))) throw new Error('Execution directory with preflight.json is required');
function json(file) {
  const bytes = fs.readFileSync(file);
  return JSON.parse(bytes.toString(bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf16le' : 'utf8').replace(/^\uFEFF/, ''));
}
const preflight = json(path.join(dir, 'preflight.json'));
const safe = new Set(preflight.safeSmokeFiles);
function flatten(node, rows = []) {
  for (const spec of node.specs || []) rows.push(spec);
  for (const child of node.suites || []) flatten(child, rows);
  return rows;
}
const safeSpecs = flatten(json(path.join(dir, 'registered-safe-smoke.json')));
if (safeSpecs.length !== 11 || safeSpecs.some(s => !safe.has(s.file.replace(/\\/g, '/')))) throw new Error('Unexpected safe smoke selection; inspect before executing');
const fullFile = path.join(dir, 'registered-all-playwright.json');
const fullSpecs = fs.existsSync(fullFile) ? flatten(json(fullFile)) : [];
function moduleFor(spec) {
  const file = spec.file.replace(/\\/g, '/');
  if (file.includes('/enterprise/')) return 'Enterprise';
  if (file.includes('/inventory-management/')) return 'Inventory Management';
  if (file.includes('/first-delivery-inspections/')) return 'First Delivery Inspection';
  if (file.includes('/management-dashboard/')) return 'Management Dashboard';
  if (file.includes('/international-shipments/')) return 'International Shipment';
  if (file.includes('/procurement-log/')) return 'Procurement Log';
  if (file.includes('/user-management/')) return file.includes('/supplier-list/') ? 'Supplier List' : 'User Management';
  if (file.includes('document-management')) return 'Document Management';
  if (file.includes('project-management-readonly')) return 'Project Management';
  if (file.includes('/pending/')) return 'Analytics / independent source contracts';
  if (file.includes('project-setup-wizard')) return 'Excluded: Setup Wizard';
  return 'SCP navigation';
}
function impact(spec) {
  if (safe.has(spec.file.replace(/\\/g, '/'))) return 'Read-only smoke; client validation requests guarded';
  if (spec.file.includes('project-setup-wizard')) return 'Excluded by tracker';
  if (/regression\/(enterprise|management-dashboard|pending)\//.test(spec.file.replace(/\\/g, '/'))) return 'Read-only regression; Phase 3 approval; independent-source prerequisites may block';
  if (/Inventory date:/.test(spec.title)) return 'Read-only calendar check; regression approval; known application render failure';
  if (spec.file.includes('/inventory-management/')) return 'Creates dedicated materials/procurement prerequisites; stock movements or upload state; approval required';
  if (spec.file.includes('/first-delivery-inspections/')) return 'Per-case review required: settings, self-assignment, draft/photo/submission, or shared record selection; dedicated FDI data needed';
  if (spec.file.includes('/procurement-log/')) return 'Creates submittal/component/delivery; approval and dedicated records required';
  if (spec.file.includes('/user-management/')) return 'Invitation/account/supplier changes or existing-user data selection; approval and fixture review required';
  if (spec.file.includes('/international-shipments/')) return 'Creates procurement/shipment and changes flags/status; approval and dedicated records required';
  return 'Read-only regression navigation; Phase 3 approval required';
}
const catalogue = fullSpecs.map(s => ({ file: s.file, scenario: s.title, module: moduleFor(s), impact: impact(s), selectedNow: safe.has(s.file.replace(/\\/g, '/')) }));
const feature = fs.readFileSync(path.join(root, 'features/project-management/project-management-navigation.feature'), 'utf8');
const cucumber = [...feature.matchAll(/^\s*Scenario:\s*(.+)$/gm)].map(match => ({ scenario: match[1].trim(),
  disposition: /System Message|Analytics and remaining controls/.test(match[1]) ? 'Excluded: red functionality / mixed excluded controls' : 'Approval required: creates/updates reference data, configuration, invitations or dedicated records' }));
const excludedCount = fullSpecs.filter(s => s.file.includes('project-setup-wizard')).length;
const inventory = fullSpecs.filter(s => s.file.startsWith('regression/inventory-management/'));
const plan = { browser: 'Google Chrome headed', environment: preflight.environment, project: preflight.project, site: preflight.site,
  playwrightRegistered: fullSpecs.length, playwrightExcluded: excludedCount, cucumberRegistered: cucumber.length,
  cucumberInScope: cucumber.filter(s => !s.disposition.startsWith('Excluded')).length,
  safeSmokeRegistered: safeSpecs.length, approvalHeldSmoke: preflight.approvalHolds, inventoryRegressionCases: inventory.length,
  phase3ApprovalRequired: true, catalogue, cucumber };
plan.inScopeRegisteredCases = plan.playwrightRegistered - plan.playwrightExcluded + plan.cucumberInScope;
fs.writeFileSync(path.join(dir, 'execution-plan.json'), JSON.stringify(plan, null, 2));
const planText = [ '# SCP Chrome preflight and execution plan', '',
  `Environment: ${preflight.environment}. Existing configured account role: ${preflight.role}. Exact project: **${preflight.project}**; starting site: **${preflight.site}**. Credentials are present and are not included in this report.`, '',
  `Chrome: installed executable ${preflight.chromeExecutable}. Playwright ${preflight.playwrightVersion}; headed mode, one worker, zero retries.`, '',
  `Registration: ${fullSpecs.length} Playwright cases (${excludedCount} excluded Setup Wizard cases), plus ${plan.cucumberInScope} in-scope Cucumber scenarios out of ${cucumber.length}.`, '',
  '## Phase 2 authorised now', '',
  `${safeSpecs.length} existing read-only Playwright smoke cases in the six allowlisted files. SCP writes and excluded API endpoints are blocked before application authentication/navigation. SSO authentication is allowed on its own origin. Each test asserts the approved starting project/site; Inventory retains its existing per-validation context assertions.`, '',
  ...safeSpecs.map(s => `- ${moduleFor(s)}: ${s.title} (${s.file}:${s.line})`), '',
  '## Approval holds', '',
  ...preflight.approvalHolds.map(s => `- ${s.module}: ${s.scenario}. ${s.reason}.`), '',
  'These two registered smoke scenarios are Not Executed / Blocked for approval, not native skipped or passed cases. The Cucumber smoke scenario is also regression-tagged; it is counted once in the scenario inventory.', '',
  '## Phase 3 after approval', '',
  ...preflight.regression.order.map(s => `- ${s}.`), '',
  'Begin with Inventory, then Procurement. Use newly generated dedicated staging records. Existing shared configuration, role/account changes and existing FDI records need per-case dedicated allocation; broad regression approval cannot substitute for those fixtures. Completed SUB-2026-525 remains prohibited. Do not invoke the generic entire-application runner: it immediately starts regression and its Cucumber profile includes excluded/mixed scenarios.', '',
  '## Reporting and failure analysis', '',
  'Preserve native results.json, HTML, all traces, failure screenshots and original failure attempts in this unique directory. Distinguish application, automation, data and environment issues. Rerun only corrected cases and relevant checks. No Excel workbook/report is introduced. Module coverage remains partial even if every selected smoke case passes.', '',
  'A full reload was previously observed to reset the site. Navigation-only smoke does not prove site persistence. The context attachment records starting and ending sites; business assertions must retain their own exact-context checks.', '',
  'Regression results from earlier requests remain historical, with links in the existing pending summary; they are not counted as current execution.' ];
fs.writeFileSync(path.join(dir, 'EXECUTION_PLAN.md'), planText.join('\n') + '\n');
if (!fs.existsSync(path.join(dir, 'results.json'))) {
  console.log(JSON.stringify({ phase: 'Preflight', safeSmokeCases: safeSpecs.length, approvalHeldSmoke: 2, inventoryRegressionCases: inventory.length, directory: dir }));
  process.exit(0);
}
const native = json(path.join(dir, 'results.json'));
const resultSpecs = flatten(native);
function attachment(result, name) {
  const item = (result.attachments || []).find(a => a.name === name);
  if (!item) return null;
  try { return item.body ? JSON.parse(Buffer.from(item.body, 'base64').toString('utf8')) : item.path ? json(item.path) : null; } catch { return null; }
}
function evidenceFor(result, id) {
  return (result.attachments || []).map((item, index) => {
    const label = item.name === 'failure-screenshot' ? 'legacy default-page screenshot (use chrome-execution-failure for actual SCP page)' : item.name;
    if (item.path) {
      const source = path.resolve(item.path);
      if (!fs.existsSync(source)) throw new Error(`Missing recorded evidence: ${item.name}`);
      // Short aliases avoid Windows MAX_PATH limitations in downstream readers.
      if (item.contentType === 'image/png') {
        const folder = path.join(dir, 'evidence'); fs.mkdirSync(folder, { recursive: true });
        const file = `${id}-${index}-${item.name.replace(/[^a-z0-9_-]+/gi, '_').slice(0, 40)}.png`;
        fs.copyFileSync(source, path.join(folder, file));
        return { name: label, path: `evidence/${file}`, contentType: item.contentType };
      }
      return { name: label, path: path.relative(dir, source).replace(/\\/g, '/'), contentType: item.contentType };
    }
    if (!item.body || !/^(image\/png|application\/json|text\/plain)$/.test(item.contentType)) return null;
    const folder = path.join(dir, 'evidence'); fs.mkdirSync(folder, { recursive: true });
    const extension = item.contentType === 'image/png' ? '.png' : item.contentType === 'application/json' ? '.json' : '.txt';
    const file = `${id}-${index}-${item.name.replace(/[^a-z0-9_-]+/gi, '_').slice(0, 80)}${extension}`;
    fs.writeFileSync(path.join(folder, file), Buffer.from(item.body, 'base64'));
    return { name: label, path: `evidence/${file}`, contentType: item.contentType };
  }).filter(Boolean);
}
function kind(message) {
  if (/Unexpected identifier 'extend'/.test(message)) return 'Application defect: shared SSO chooser configuration (APP-SSO-001)';
  if (/BLOCKED:|allocation|fixture|No .*records/.test(message)) return 'Test data / prerequisite';
  if (/ERR_|net::|login|SSO|Authentication/i.test(message)) return 'Environment/authentication; investigate';
  if (/reading 'replace'|Maximum update depth|application render|uncaught application/i.test(message)) return 'Application defect';
  if (/strict mode violation|is not a function|ReferenceError/.test(message)) return 'Automation defect';
  return 'Unclassified failure: inspect trace before attributing';
}
const expected = title => /exact context, material identity/.test(title) ? 'Exact allocated material identity/UOM, live API stock balance, Search variants, no-match and reset' :
  /Location, Submittals/.test(title) ? 'Exact allocated material identity and returned Location/Submittal/UOM records with matching displayed totals' :
  /required fields/.test(title) ? 'Mandatory/action-dependent validation and dialog reset, without a stock write' :
  /Enterprise smoke/.test(title) ? 'Loaded in-scope business population, stated invariants and absence of mutation controls; not complete KPI reconciliation' :
  /blank invitation/.test(title) ? 'User page opens; blank invitation cannot be sent' :
  /Shipments opens/.test(title) ? 'International Shipment route opens and empty form cannot create a record' :
  /configured SCP tabs/.test(title) ? 'Only configured in-scope routes/headings open; navigation does not prove record functionality or site persistence' :
  'Configured account authenticates and Management Dashboard route/heading load in approved starting context';
const submoduleFor = spec => /Enterprise smoke: (.+) data and/.exec(spec.title)?.[1] ||
  (/exact context, material identity/.test(spec.title) ? 'Manual Entry / material Search' :
    /Location, Submittals/.test(spec.title) ? 'Location / Submittals / UOM views' :
    /required fields/.test(spec.title) ? 'Manual Entry / client validation' :
    /blank invitation/.test(spec.title) ? 'Invitation validation' :
    /Shipments opens/.test(spec.title) ? 'Shipment / empty-form validation' :
    /configured SCP tabs/.test(spec.title) ? 'Configured route navigation' : 'Authentication / dashboard landing');
const rows = resultSpecs.map(spec => {
  const result = spec.tests?.[0]?.results?.at(-1);
  if (!result) throw new Error(`Registered case has no execution result: ${spec.title}`);
  const messages = (result.errors || []).map(e => e.message).join('\n').replace(/\u001b\[[0-9;]*m/g, '');
  const status = /BLOCKED:/.test(messages) ? 'Blocked' : result.status === 'passed' ? 'Passed' : result.status === 'skipped' ? 'Skipped' : 'Failed';
  const guard = attachment(result, 'chrome-execution-guard'); const context = attachment(result, 'chrome-execution-context');
  const sharedSsoOnly = result.errors?.length === 1 && /No uncaught application errors/.test(messages) && /Unexpected identifier 'extend'/.test(messages);
  const id = `SCP-SMK-${crypto.createHash('sha1').update(spec.file + spec.title).digest('hex').slice(0, 10).toUpperCase()}`;
  return { id,
    module: moduleFor(spec), submodule: submoduleFor(spec), scenario: spec.title,
    file: spec.file, line: spec.line, testType: 'Smoke', executed: true, status, startedAt: result.startTime,
    executionTimeIndia: result.startTime ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'long', timeZone: 'Asia/Calcutta' }).format(new Date(result.startTime)) : null,
    durationMs: result.duration, environment: preflight.environment, browser: guard?.browser || null, channel: 'chrome', headed: true,
    expected: expected(spec.title), actual: status === 'Passed' ? 'All assertions in this exact existing scenario passed; inspect screenshots/trace for displayed values.' :
      sharedSsoOnly ? 'Existing scenario assertions completed, but the pre-authentication runtime gate failed on the shared SSO script syntax error. Overall result remains Failed.\n' + messages : messages,
    existingScenarioAssertionsCompletedBeforeSharedGateFailure: !!sharedSsoOnly,
    failureClassification: status === 'Failed' ? kind(messages) : null, errors: messages, context, guard,
    evidence: evidenceFor(result, id) };
});
if (rows.length !== safeSpecs.length) throw new Error('Executed results do not match the selected registration count');
const counts = rows.reduce((map, r) => (map[r.status] = (map[r.status] || 0) + 1, map), {});
const holds = preflight.approvalHolds.map((h, i) => ({ id: `SCP-HOLD-${i + 1}`, module: h.module, scenario: h.scenario, executed: false, status: 'Blocked', reason: h.reason }));
const defects = [];
if (rows.some(row => /Unexpected identifier 'extend'/.test(row.errors))) defects.push({ id: 'APP-SSO-001',
  classification: 'Application defect, shared SSO frontend', originPath: 'https://stg-login.voyagecontrol.com/api/sso/platforms/choose/',
  actual: "Inline Tailwind configuration contains `theme: {s` before `extend`, causing SyntaxError: Unexpected identifier 'extend'.",
  expected: 'SSO chooser scripts parse without an uncaught JavaScript error.',
  impact: 'The login flow can still reach SCP, but the runtime quality gate fails; this does not establish that each module business workflow failed.',
  suggestedApplicationFix: 'Remove the stray s after theme: { in the SSO template and validate the served script. Not applied: this workspace contains SCP automation, not the deployed SSO application.',
  automationAction: 'Retained the assertion; no error suppression, script injection, disabled JavaScript or modified application response.',
  affectedCaseIds: rows.filter(row => /Unexpected identifier 'extend'/.test(row.errors)).map(row => row.id) });
fs.writeFileSync(path.join(dir, 'application-defects.json'), JSON.stringify(defects, null, 2));
const automationNotes = [
  'Added an opt-in automatic read-only execution guard to baseTest; the default fixture path remains unchanged when SCP_READONLY_EXECUTION is not true.',
  'Allowed only six reviewed smoke files and excluded the mutable FDI smoke; Cucumber smoke remains approval-held.',
  'Added exact starting project/site and account identity checks, actual SCP-page screenshots and browser/version metadata without changing existing smoke assertions.',
  'Preserved legacy default-page failure screenshots but labelled them separately; actual SCP-page failure evidence is captured by chrome-execution-failure.',
  'Copied image aliases into short report paths to support Windows evidence readers with MAX_PATH limits; original attachments are preserved.',
  'Used a unique report directory so existing HTML/JSON/screenshots/traces are preserved.',
  'Earlier read-only fixtures installed error listeners after authentication; this pre-authentication guard exposes SSO runtime errors. Earlier green runs do not prove the SSO script was error-free.',
  'No assertion was weakened and no failing scenario was skipped to produce a green report.'
];
fs.writeFileSync(path.join(dir, 'automation-changes.json'), JSON.stringify(automationNotes, null, 2));
const previousMatrix = path.join(root, 'reports/scp-pending-summary/module-matrix.csv');
if (fs.existsSync(previousMatrix)) fs.copyFileSync(previousMatrix, path.join(dir, 'historical-scope-and-gaps.csv'));
const csv = values => values.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',');
const moduleScope = [];
if (fs.existsSync(previousMatrix)) {
  const lines = require('../utils/scp-readonly').parseCsv(fs.readFileSync(previousMatrix, 'utf8').replace(/^\uFEFF/, ''));
  const headers = lines.shift();
  for (const values of lines) {
    const old = Object.fromEntries(headers.map((header, i) => [header, values[i]]));
    const tracker = Number(old['Tracker Row']);
    const selected = rows.filter(row => tracker === 27 ? row.module === 'Inventory Management' :
      tracker === 24 ? row.module === 'User Management' : tracker === 21 ? row.module === 'International Shipment' :
      tracker >= 6 && tracker <= 9 ? row.module === 'Enterprise' && row.submodule.toLowerCase().replace(/\s+/g, '').includes(({
        6: 'enterpriseview', 7: 'supplierinbox', 8: 'supplierperformance', 9: 'leadtimebenchmarks' })[tracker]) : false);
    const held = tracker === 16 ? holds.filter(h => h.module === 'First Delivery Inspection') : tracker === 40 ? holds.filter(h => h.module === 'Project Management') : [];
    const landing = tracker >= 2 && tracker <= 4 ? rows.filter(r => r.module === 'Management Dashboard').map(r => r.id).join('; ') : '';
    moduleScope.push({ 'Tracker Row': tracker, Module: old.Module, Submodule: old.Submodule,
      'Critical Workflow': old['Critical Workflow'], 'Existing Test': old['Existing Test'],
      'Current Smoke Execution': selected.length ? selected.map(r => `${r.id}: ${r.status}`).join('; ') : held.length ? 'Not executed / Blocked: approval required' : 'No dedicated smoke executed for this workflow',
      'Current Regression Execution': 'Not executed: Phase 3 approval required',
      'Current Context': `${preflight.project} / ${preflight.site}`, 'Navigation-only Evidence': landing ? `${landing}: dashboard landing only; no tab/chart/KPI validation` :
        [12, 13, 14, 16, 18, 19, 20, 21].includes(tracker) ? 'See SCP navigation case; route access does not verify this business workflow' : '',
      'Verified Coverage': 'Partial: only exact assertions in executed cases; no complete-module claim',
      'Missing Steps': old['Missing Steps'], Priority: old.Priority });
  }
  const headersOut = Object.keys(moduleScope[0]);
  fs.writeFileSync(path.join(dir, 'module-wise-status.csv'), '\uFEFF' + [csv(headersOut), ...moduleScope.map(row => csv(headersOut.map(header => row[header])))].join('\n') + '\n');
}
const summary = { currentRequest: true, phase: 'Safe read-only smoke only', counts, executedCases: rows.length,
  approvalHeldSmoke: holds, regressionExecutedThisRequest: 0, fullApplicationCoverage: false,
  nativeStatistics: native.stats, rows, evidenceDirectory: dir, historicalRegressionSummary: '../scp-pending-summary/README.md',
  limitations: ['Smoke assertions are partial functionality, never module completion', 'All regression waits for Phase 3 approval', 'FDI and Cucumber data-changing smoke held for approval and dedicated allocation', 'Independent account/source/rule fixtures remain missing for several planned cases', 'Known site loss on refresh prevents safe persisted-value validation without preserved context'] };
summary.applicationDefects = defects; summary.automationChanges = automationNotes; summary.moduleScope = moduleScope;
fs.writeFileSync(path.join(dir, 'execution-summary.json'), JSON.stringify(summary, null, 2));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const modules = [...new Set([...rows.map(r => r.module), ...holds.map(r => r.module)])];
const moduleLines = modules.map(module => {
  const cases = rows.filter(r => r.module === module); const held = holds.filter(r => r.module === module);
  return `| ${module} | ${cases.length} | ${cases.filter(r => r.status === 'Passed').length} | ${cases.filter(r => r.status === 'Failed').length} | ${cases.filter(r => r.status === 'Skipped').length} | ${cases.filter(r => r.status === 'Blocked').length} | ${held.length} | Partial; only named smoke assertions |`;
});
const md = ['# SCP Chrome execution summary', '',
  `Current run: **${JSON.stringify(counts)}**, ${rows.length} executed read-only smoke cases; **${holds.length} additional smoke cases Not Executed / Blocked for approval**. Regression executed this request: **0**.`, '',
  `Environment: ${preflight.environment}; project ${preflight.project}; starting site ${preflight.site}; Google Chrome ${rows.find(r => r.browser)?.browser || 'see trace'}, headed, one worker, zero retries. Times are in Asia/Calcutta; raw result timestamps remain UTC.`, '',
  '[Native HTML report](html/index.html) · [Execution plan](EXECUTION_PLAN.md) · [Full scenario results](execution-summary.json) · [47-row current module matrix](module-wise-status.csv) · [Historical coverage gaps](../scp-pending-summary/README.md)', '',
  '[Application defect record](application-defects.json) · [Sanitised served-script evidence and local syntax-only fix candidate](sso-defect-evidence.json) · [Evidence integrity](evidence-integrity.json)', '',
  '| Module | Executed | Passed | Failed | Skipped | Blocked executed | Approval-held | Coverage |', '|---|---:|---:|---:|---:|---:|---:|---|', ...moduleLines, '',
  'Document Management, Analytics, Supplier List and most Project Management business flows have no dedicated existing read-only smoke in this selection. Procurement and FDI route navigation is not create/component/delivery/inspection workflow coverage. These gaps are not passed or native skipped tests.', '',
  '## Failure analysis', '', ...rows.filter(r => r.status !== 'Passed').map(r => `- ${r.id} / ${r.scenario}: ${r.failureClassification || r.status}. ${r.errors.split('\n')[0]}`), '',
  ...defects.map(d => `${d.id}: ${d.actual} ${d.impact} Suggested application fix: ${d.suggestedApplicationFix}`), '',
  '## Approval-held scenarios', '', ...holds.map(h => `- ${h.module}: ${h.scenario}. ${h.reason}.`), '',
  '## Regression and pending work', '',
  'Phase 3 has not run for this request. Proposed order: Inventory (12 existing regression cases; dedicated records for mutable cases), Procurement (one dedicated end-to-end flow), then the remaining reviewed in-scope suites. Shared configuration and existing-record FDI actions still need exclusive allocations. Earlier regression reports are historical evidence only, not current results.', '',
  'See execution-plan.json for every registered Playwright case and Cucumber scenario, its side-effect classification, and exclusions. Full functionality and independent KPI/formula/role validation remain incomplete. No application defect is attributed merely from a passing navigation test or an unexecuted scenario.' ];
fs.writeFileSync(path.join(dir, 'SUMMARY.md'), md.join('\n') + '\n');
const htmlRows = rows.map(r => `<tr><td>${esc(r.id)}<br>${esc(r.module)} / ${esc(r.submodule)}</td><td>${esc(r.scenario)}<br><code>${esc(r.file)}:${r.line}</code></td><td>${esc(r.status)}</td><td>${esc(r.executionTimeIndia)}<br>${(r.durationMs / 1000).toFixed(1)}s</td><td>${esc(r.expected)}</td><td><pre>${esc(r.actual)}</pre>${r.evidence.map(a => `<a href="${esc(a.path)}">${esc(a.name)}</a>`).join('<br>')}</td></tr>`).join('');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>SCP Chrome smoke execution</title><style>body{font:14px system-ui;margin:24px;color:#172033}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd2dc;padding:10px;text-align:left;vertical-align:top}pre{white-space:pre-wrap;max-width:600px}a{color:#1257a5}</style><h1>SCP Chrome smoke execution</h1><p>${esc(JSON.stringify(counts))}; ${holds.length} approval-held smoke cases; regression not executed.</p><p>${esc(preflight.environment)} · ${esc(preflight.project)} · ${esc(preflight.site)} · Headed Google Chrome. Coverage remains partial.</p><p><a href="html/index.html">Native Playwright HTML</a> · <a href="EXECUTION_PLAN.md">Plan</a> · <a href="execution-summary.json">Scenario metadata</a> · <a href="SUMMARY.md">Module summary</a> · <a href="application-defects.json">Application defects</a> · <a href="sso-defect-evidence.json">Sanitised SSO proof</a> · <a href="evidence-integrity.json">Evidence integrity</a></p><table><thead><tr><th>ID / module</th><th>Scenario</th><th>Status</th><th>Time / duration</th><th>Expected</th><th>Actual / evidence</th></tr></thead><tbody>${htmlRows}</tbody></table><h2>Not executed: approval required</h2><ul>${holds.map(h => `<li>${esc(h.module)}: ${esc(h.scenario)} — ${esc(h.reason)}</li>`).join('')}</ul><p>Missing modules and remaining independent validations are described in SUMMARY.md. Historical reports are not counted as current passes.</p></html>`;
fs.writeFileSync(path.join(dir, 'execution-report.html'), html);
console.log(JSON.stringify({ executed: rows.length, counts, approvalHeldSmoke: holds.length, regressionExecuted: 0, report: path.join(dir, 'execution-report.html') }));
