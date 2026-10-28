// Plain step/status PDF for a full-regression or recovery-review run: no code, errors, data or paths.
// Usage: node scripts/generate-scp-step-status-report.js RUN_DIR
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const css = status => String(status || '').replace(/[^A-Za-z]/g, '');
const STATUSES = ['Passed', 'Failed', 'Blocked', 'Skipped', 'Not Accessible', 'Access Validation Failed'];

const MATCHERS = { toBeVisible: 'is visible', toBeHidden: 'is hidden', toHaveValue: 'has the expected value', toHaveCount: 'has the expected count',
  toContainText: 'contains the expected text', toHaveText: 'has the expected text', toHaveURL: 'URL matches', toHaveAttribute: 'has the expected state',
  toBeEnabled: 'is enabled', toBeDisabled: 'is disabled', toBeAttached: 'is present' };

// Assertion steps carry raw locators; describe them as a plain check on the element's visible label.
function plainAssertion(name) {
  const locatorAt = name.search(/\s(getBy|locator\(|internal:)/);
  if (locatorAt < 0 && !/^Expect "/.test(name)) return name;
  const head = (locatorAt < 0 ? name : name.slice(0, locatorAt)).trim();
  const target = /name: '([^']+)'/.exec(name)?.[1] || /getBy(?:Text|Placeholder|Label|Title)\('([^']+)'/.exec(name)?.[1];
  const matcher = /^Expect "(?:soft |poll )?(\w+)"/.exec(head)?.[1];
  if (matcher) return `Check${target ? ` "${target}"` : ' page element'} ${MATCHERS[matcher] || 'meets its expectation'}`;
  return head;
}

// "ProjectSelectorPage: expect active project" -> "Project selector: expect active project"
function stepName(name) {
  name = plainAssertion(String(name || ''));
  const match = /^([A-Z][A-Za-z]+?)(?:Page)?: (.+)$/.exec(name);
  if (!match) return String(name || '');
  const subject = match[1].replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return `${subject.charAt(0).toUpperCase()}${subject.slice(1)}: ${match[2]}`;
}

// Only plain-language reasons are shown; anything that reads as code is omitted.
function plainReason(scenario) {
  const text = String((scenario.errors || [])[0] || scenario.actual || '').replace(/\u001b\[[0-9;]*m/g, '').split('\n')[0]
    .replace(/^(Error|ScpBlocked|InventoryBlocked|DependencyBlocked):\s*/, '').replace(/^BLOCKED:\s*/, 'Blocked: ').trim();
  if (!text || /expect\(|locator|getBy|=>|[{}[\]`]|\.js\b|\/api\/|Timeout \d+ms|toBe|toHave|Call log/.test(text)) return '';
  return text.length > 220 ? `${text.slice(0, 217)}...` : text;
}

function render(run) {
  const read = file => JSON.parse(fs.readFileSync(path.join(run, file), 'utf8'));
  const manifest = read('manifest.json');
  const { scenarios } = read('execution.json');
  const count = list => list.reduce((total, item) => ({ ...total, [item.status]: (total[item.status] || 0) + 1 }), {});
  const time = value => value ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Calcutta', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '';
  const totals = count(scenarios);
  const modules = manifest.modules.map(module => ({ module, list: scenarios.filter(item => item.module === module.name) }));
  return `<!doctype html><html><head><meta charset="utf-8"><title>SCP step status report</title><style>
    body{font:12px Arial,sans-serif;margin:20px;color:#172033}h1{font-size:20px;margin:0 0 6px}h2{font-size:16px;margin:22px 0 6px;break-after:avoid}
    h3{font-size:13px;margin:14px 0 4px;break-after:avoid}table{width:100%;border-collapse:collapse;margin:4px 0 8px}
    th,td{border:1px solid #cbd5e1;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f1f5f9}td.s{width:150px;font-weight:bold}
    .Passed{color:#166534}.Failed,.AccessValidationFailed{color:#b91c1c}.Blocked{color:#92400e}.Skipped,.NotAccessible{color:#475569}
    .reason{color:#475569;font-style:italic;margin:2px 0 6px}.module{break-before:page}tr{break-inside:avoid}</style></head><body>
    <h1>SCP regression: step status report</h1>
    <p>Project ${escape(manifest.project)} · Google Chrome · ${escape(time(manifest.startedAt))} to ${escape(time(manifest.finishedAt))}
    ${manifest.sourceRun ? ' · Includes rerun results for tests affected by the environment' : ''}</p>
    <p><b>${scenarios.length} scenarios:</b> ${STATUSES.filter(status => totals[status]).map(status => `${status} ${totals[status]}`).join(' · ')}</p>
    <h2>Module summary</h2><table><tr><th>#</th><th>Module</th><th>Scenarios</th>${STATUSES.slice(0, 4).map(status => `<th>${status}</th>`).join('')}</tr>
    ${modules.map(({ module, list }) => { const c = count(list); return `<tr><td>${module.order}</td><td>${escape(module.name)}</td><td>${list.length}</td>${STATUSES.slice(0, 4).map(status => `<td class="${css(status)}">${c[status] || 0}</td>`).join('')}</tr>`; }).join('')}</table>
    ${modules.map(({ module, list }) => `<section class="module"><h2>${module.order}. ${escape(module.name)}</h2>
      ${list.length ? `<table><tr><th>#</th><th>Scenario</th><th>Steps passed</th><th>Status</th></tr>${list.map((scenario, index) => `<tr><td>${index + 1}</td><td>${escape(scenario.title)}</td>
        <td>${(scenario.steps || []).filter(step => step.status === 'Passed').length} / ${(scenario.steps || []).length}</td><td class="s ${css(scenario.status)}">${escape(scenario.status)}</td></tr>`).join('')}</table>
      ${list.map((scenario, index) => `<h3>${module.order}.${index + 1} ${escape(scenario.title)} — <span class="${css(scenario.status)}">${escape(scenario.status)}</span>${scenario.recoveryReport ? ` <small>(rerun; first run ${escape(scenario.originalStatus)})</small>` : ''}</h3>
        ${scenario.status !== 'Passed' && plainReason(scenario) ? `<p class="reason">${escape(plainReason(scenario))}</p>` : ''}
        ${(scenario.steps || []).length ? `<table><tr><th>#</th><th>Step</th><th>Status</th></tr>${scenario.steps.map((step, number) => `<tr><td>${number + 1}</td><td>${escape(stepName(step.name))}</td>
          <td class="s ${css(step.status)}">${escape(step.status)}</td></tr>`).join('')}</table>` : '<p class="reason">No steps were recorded for this scenario.</p>'}`).join('')}`
      : `<p class="reason">No scenarios were executed in this module.</p>`}</section>`).join('')}
    </body></html>`;
}

async function main(run) {
  const html = path.join(run, 'SCP_Step_Status_Report.html');
  fs.writeFileSync(html, render(run));
  const browser = await require('@playwright/test').chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(html).href, { waitUntil: 'load' });
    const pdf = path.join(run, 'SCP_Step_Status_Report.pdf');
    await page.pdf({ path: pdf, format: 'A4', printBackground: true, margin: { top: '12mm', right: '10mm', bottom: '14mm', left: '10mm' }, displayHeaderFooter: true,
      headerTemplate: '<span></span>', footerTemplate: '<div style="font:9px Arial;width:100%;text-align:center;color:#64748b">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>' });
    return pdf;
  } finally { await browser.close(); }
}

if (require.main === module) {
  if (!process.argv[2]) { console.error('Usage: node scripts/generate-scp-step-status-report.js RUN_DIR'); process.exitCode = 1; }
  else main(path.resolve(process.argv[2])).then(pdf => console.log(pdf)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { render, stepName, plainReason };
