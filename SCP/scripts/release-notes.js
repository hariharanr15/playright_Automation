// Automation release notes (Markdown → A4 PDF with scripts/md-to-pdf.js), built from the consolidated run data so the
// numbers always match the reports.
//
// Usage (from SCP): node scripts/release-notes.js <full-regression folder> [--version=1.1] [--evidence=<videos folder>]
// Needs NON_PASSED_TEST_CASES.md and SKIPPED_CASES.json in the folder (scripts/non-pass-report.js writes them).
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { KNOWN_DEFECTS } = require('../config/scp-known-defects');
const { GROUPS, plan } = require('../config/scp-skip-plan');

const args = process.argv.slice(2);
const folder = path.resolve(args.find(a => !a.startsWith('--')) || '');
const version = (args.find(a => a.startsWith('--version=')) || '--version=1.1').slice(10);
const evidence = (args.find(a => a.startsWith('--evidence=')) || '').slice(11);
const root = path.resolve(__dirname, '..');
const rel = p => path.relative(root, p).replace(/\\/g, '/');
const nonPassed = fs.readFileSync(path.join(folder, 'NON_PASSED_TEST_CASES.md'), 'utf8');
const skipped = JSON.parse(fs.readFileSync(path.join(folder, 'SKIPPED_CASES.json'), 'utf8'));
const total = label => Number((nonPassed.match(new RegExp(`\\| ${label} \\| \\**(\\d+)`)) || [])[1] || 0);
const totals = { passed: total('Passed'), kd: total('Known Defect'), failed: total('Failed'), blocked: total('Blocked'), skipped: total('Skipped'), all: total('\\*\\*Total\\*\\*') };
const runsTable = (nonPassed.match(/## Suite runs used[\s\S]*?(?=\n## )/) || [''])[0].split('\n').filter(l => l.startsWith('| ') && !/^\| Suite \|/.test(l));
const latest = new Map();
for (const line of runsTable) { const m = line.match(/^\| (.+?) \| `(.+?)` \|$/); if (m) latest.set(m[1].replace(/-\d{4}-.*$/, ''), m[2]); }
const suiteRows = [...latest.entries()].map(([title, dir]) => {
  let s = {}; try { s = JSON.parse(fs.readFileSync(path.join(root, dir, 'results.json'), 'utf8')).summary || {}; } catch (e) { /* no summary */ }
  return `| ${title} | ${s.total ?? '-'} | ${s.passed ?? '-'} | ${s.knownDefects ?? '-'} | ${s.failed ?? '-'} | ${s.blocked ?? '-'} | ${s.skipped ?? '-'} | \`${dir.replace(/\\/g, '/')}\` |`;
});
const pending = KNOWN_DEFECTS.filter(d => d.confirmation === 'pending');
const today = KNOWN_DEFECTS.filter(d => d.recordedOn === '2026-11-22');
const byGroup = Object.keys(GROUPS).map(g => ({ g, n: skipped.filter(x => (plan[x.id] || {}).group === g).length }));
let commits = '';
try { commits = execSync('git log --since="2026-11-21" --pretty=format:"%h|%ad|%s" --date=short', { cwd: root }).toString().trim().split('\n').map(l => { const [h, d, ...m] = l.split('|'); return `| ${h} | ${d} | ${m.join('|').replace(/\|/g, '/')} |`; }).join('\n'); } catch (e) { commits = '| – | – | git log not available |'; }
const cell = t => String(t || '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();

const md = `# SCP Test Automation – Release Notes ${version}

_Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC by \`scripts/release-notes.js\` from \`${rel(folder)}\` plus re-runs._

| Item | Value |
|---|---|
| Release | ${version} (demo build) |
| Date | ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} |
| Application | Supply Chain Planner (SCP), staging – \`stg-supplychain-app.voyagecontrol.com\` |
| Main project / site | NRVC_Hall / Warehoust _NR |
| Framework | Playwright (Node.js), page objects + PM-flow runner (\`scripts/run-pm-flow.js\`), Google Chrome |
| Branch | \`scp/automation-gap-report\` (local commits, not pushed) |

## 1. Summary

| Result | Test cases |
|---|---|
| Passed | **${totals.passed}** |
| Known Defect (app behaviour recorded as a defect) | ${totals.kd} |
| Failed | **${totals.failed}** |
| Blocked | **${totals.blocked}** |
| Skipped (each with a written reason) | ${totals.skipped} |
| **Total** | **${totals.all}** |

- **Known Defect**: the application did not behave as expected and the behaviour matches a registered defect (${KNOWN_DEFECTS.length} registered; ${pending.length} pending team confirmation).
- **Skipped**: not executed on purpose – the reason and what is needed to close each case are in \`OPEN_SKIPPED_TEST_CASES_BY_MODULE.pdf\`.

## 2. Suites and latest results

| Suite | Cases | Passed | Known Defect | Failed | Blocked | Skipped | Report folder |
|---|---|---|---|---|---|---|---|
${suiteRows.join('\n')}

## 3. What is new in this release (21–22 Nov 2026)

| Area | Change |
|---|---|
| Role-based access | New read-only suite \`roles\`: reads each role's enabled access in Voyage Control Admin › Roles and verifies the Supplier and Subcontractor menus, pages and buttons against it (ROLE-01/03/04/05/07/08/11/14/15/16/17/18/19/20/21/24, FDI-REG-01c). |
| Role administration | New suite \`roles-write\` (run on demand): ROLE-02/06 on the test-only role "SCP Automation Test Role", ROLE-22 creates a test project; always restores the account's role (verified from its own session). |
| FDI settings | New suite \`fdi-settings\`: the four FDI settings and their effect on the inspection form (notes, photos, mandatory photos, file types, thumbnails, spec documents, submitted report). Settings always restored. |
| Configuration Options | New suite \`cfg-live\`: Pre-Shipping and GRN switched off/on on the same delivery (CFG-09/10, restored); seeds and next-day verification of the 1-week alert batch (CFG-13/15/16). |
| PM decision cases | New suite \`pm-decisions\`: delete material / site in use (run data), Procurement Log column drag (restored), Booking form with empty Booking ID. |
| Fresh project | New suite \`fresh-project\`: PreShipping menu follows the toggle; currency is per project (uses the project created by ROLE-22, not SCP_Testing_Ram). |
| Tickets | BUGS-155 follows the new rule (Subcontractor can fill the checklist); BUGS-508 resume at the decision step; BUGS-517 Bulk Edit (one batch notice, locked row skipped, roll back); BUGS-543 inspector scope. |
| Procurement Log | PreShipping checklist questions in a real delivery (PSC-03/04); delivery row handling; sort and slow-page waits. |
| Overnight runs | PO date and inbox date checks follow the server's UTC date between 00:00 and 05:30 IST (SCP-DEF-074). |
| Invitations | mail.tm mailbox helper (\`utils/mailtm.js\`); invitations did not reach mail.tm on 22 Nov, so the E2E uses the existing Subcontractor account by default and falls back to it automatically. YOPmail's human check is never bypassed. |
| Reports | Failed/Blocked/Skipped list, Known Defect cases with full flows, open Skipped cases by closure group and by module (A4 PDFs); duplicate skips counted once; covered cases counted by their covering result. |
| Evidence | Every suite recorded as MP4 (H.264) and a screenshot after every step, collected per suite${evidence ? ` in \`${evidence}\`` : ''}. |

## 4. Defects found and pending confirmation (registered 22 Nov 2026)

| ID | Title | Status |
|---|---|---|
${today.map(d => `| ${d.id} | ${cell(d.title)} | ${d.confirmation === 'pending' ? 'Pending confirmation' : 'Registered'} |`).join('\n')}

All defects, including the earlier ones, are listed with steps in \`docs/automation-gap-analysis/KNOWN_DEFECTS.md\`; open questions in \`PENDING_CONFIRMATIONS.md\`. Nothing was written to Jira.

## 5. Decisions and confirmed rules applied (22 Nov 2026)

| Topic | Rule / decision |
|---|---|
| Roles | No fixed access per role: the organisation admin enables access in Voyage Control Admin › Roles; tests read it and verify the user. Shared Supplier / Subcontractor roles are never changed. |
| Voyage Control Admin | Only the Org Admin sees it; projects are created only there (New Project); the Org Admin can create users and projects. |
| System Messages delete | Follows "System Messages: Delete" of the role. |
| BUGS-155 | A Subcontractor can fill the pre-shipping checklist and approve one the supplier filled. |
| BUGS-548 | A bank question used in an organisation set of any project of the organisation cannot be deleted or edited. |
| Pre-Shipping / GRN | Switched off → no longer available in the delivery; switched on → available again in the same delivery. |
| Deferred scope | Procore, International Shipments and Document Management scenarios are out of scope for now. |
| Invitations | No manual step; YOPmail's human check is never bypassed. |

## 6. Open skipped cases by closure group

| Group | Meaning | Cases |
|---|---|---|
${byGroup.map(({ g, n }) => `| ${g} | ${cell(GROUPS[g])} | ${n} |`).join('\n')}
| | **Total** | **${skipped.length}** |

## 7. How to run

| Purpose | Command (from the \`SCP\` folder) | Duration |
|---|---|---|
| Full regression + E2E smoke, videos and step screenshots | \`npm run full:regression -- --headless\` | about 3.5 h |
| E2E smoke only (demo flow) | \`npm run e2e:smoke\` | about 30 min |
| One suite | \`node scripts/run-pm-flow.js <suite> --headless\` (suites: app-regression, tickets, regression, regression2, pl-regression, pl-regression2, pl-regression3, inv-regression, fdi-settings, cfg-live, roles, roles-write, pm-decisions, fresh-project, e2e-smoke) | 5–60 min |
| Smoke suites | \`npm run pm:smoke\`, \`npm run procurement:smoke\`, \`npm run modules:smoke\` | 2–5 min each |
| Reports for a run | \`node scripts/non-pass-report.js <full-regression folder> [re-run folders …]\`, then \`node scripts/skipped-cases-report.js <folder>\` and \`node scripts/md-to-pdf.js <file.md>\` (A4) | seconds |
| Videos and screenshots in one folder | \`node scripts/collect-videos.js <output folder> <full-regression folder> [run folders …]\` | seconds |
| Release notes | \`node scripts/release-notes.js <full-regression folder> --version=<n>\` | seconds |

Before a run: no other automation run active (two runs on the same project interfere); \`.env\` holds the staging accounts (Project Admin, Supplier, Subcontractor) – credentials are never printed in reports.

## 8. Deliverables

| Deliverable | Location |
|---|---|
| Failed, Blocked and Skipped test cases (A4 PDF) | \`${rel(folder)}/NON_PASSED_TEST_CASES.pdf\` |
| Known Defect test cases with full flows (A4 PDF) | \`${rel(folder)}/KNOWN_DEFECT_TEST_CASES.pdf\` |
| Open Skipped cases by closure group / by module (A4 PDF) | \`${rel(folder)}/OPEN_SKIPPED_TEST_CASES.pdf\`, \`…_BY_MODULE.pdf\` |
| Consolidated run report (A4 PDF) | \`${rel(folder)}/SCP_Full_Regression_Report.pdf\` |
| Per-suite HTML report with failure screenshots | \`reports/pm-flow/<suite>-<timestamp>/report.html\` |
| Videos (MP4) and step screenshots per suite | ${evidence ? `\`${evidence}\` (open \`index.html\`)` : '`reports/demo-videos-<date>/`'} |
| Known defects / pending confirmations / run guide | \`docs/automation-gap-analysis/KNOWN_DEFECTS.md\`, \`PENDING_CONFIRMATIONS.md\`, \`DEMO_RUN_GUIDE.md\` |

## 9. Known limitations and risks

| Item | Effect | Handling |
|---|---|---|
| Header site resets after a reload (SCP-DEF-058) | Deliveries can land on another site | Tests restore the site; INV-REG-21 skipped until delivery to a fixed site |
| International Shipments loads slowly (up to ~160 s) | Long waits | Tests wait up to 3 min |
| Runs between 00:00 and 05:30 IST | Server "today" is the previous day (SCP-DEF-074) | Tests use the server date in that window |
| Invitation e-mail | YOPmail shows a human check; mail.tm did not receive SCP invitations | E2E uses the existing Subcontractor account; activation cases stay skipped |
| Shared staging data | Lists grow, leftover test banners | System Messages cleanup (PM-REG-SYS-00); runs are tagged and use their own data |
| Daily alert batch (05:00–06:00 IST) | CFG-13/15/16 results only the next day | Seeded by one run, verified by the next run after 06:00 |
| "SCP Automation Test Role" | Stays listed in Voyage Control Admin (cannot be deactivated) | Holds a copy of the Supplier permissions; used only during role-change tests |

## 10. Changes (local commits)

| Commit | Date | Description |
|---|---|---|
${commits}
`;
const outFile = path.join(folder, 'AUTOMATION_RELEASE_NOTES.md');
fs.writeFileSync(outFile, md);
console.log(`Release notes ${version} → ${rel(outFile)}`);
