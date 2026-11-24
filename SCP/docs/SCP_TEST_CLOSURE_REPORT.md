# SCP – Test Closure Report and AI Automation Reference

_Supply Chain Planner (Voyage Control) · Staging · Version 1.2 · 24 Nov 2026_

| Item | Detail |
|---|---|
| Application | Supply Chain Planner (SCP), Voyage Control platform |
| Environment | Staging – `stg-supplychain-app.voyagecontrol.com` (sign-in through `stg-login.voyagecontrol.com`). UAT was out of scope by decision. |
| Test data scope | Project **NRVC_Hall**, site/venue **"Warehoust _NR"**; run-tagged records created by the automation |
| Test cycle closed | Consolidated regression of 22–23 Nov 2026 plus the re-runs of 23 Nov 2026; updated on 24 Nov 2026 after the staging release of 23 Nov (evening) |
| Automation framework | Playwright (Node.js) "PM-flow" framework in `SCP/`, branch history on GitHub `hariharanr15/playright_Automation` (merged to `main`, PR 1) |
| Prepared by | QA Automation, NeuralRays AI – with Claude Code (AI agent) |
| Status of this document | **For review.** Sign-off on the closure decision, open defects and residual risk stays with the people listed in section 12. |

## 1. Executive summary

The SCP regression cycle was completed on staging on 23 Nov 2026 (620 cases: 510 Passed, 69 Known Defect, 41 Skipped, 0 Failed). On the evening of 23 Nov a staging release redesigned the Procurement Log submittal and delivery pages, regrouped the menu and removed Inventory Management. The automation was adapted on 24 Nov and the affected suites were re-run. **Consolidated result (24 Nov 2026): 620 test cases – 508 Passed, 62 Known Defect, 41 Skipped, 8 Failed, 1 Blocked.** The 9 failed/blocked cases are explained in section 1a; none is an unexplained automation failure.

| Measure | Result |
|---|---|
| Test cases | 620 |
| Passed | 508 (81.9 %) |
| Known Defect (ran; difference registered) | 62 (10.0 %) |
| Skipped (not run; reason recorded) | 41 (6.6 %) |
| Failed / Blocked | 8 / 1 (1.5 %) – see section 1a |
| Executed steps (Passed + Known Defect cases) | about 1,370 |
| Registered defects | 93 (SCP-DEF-001 … 094; SCP-DEF-042 withdrawn on 24 Nov 2026 – the dev team confirmed it is not an issue), of which 37 await team confirmation of the expected behaviour |
| Evidence | 44 MP4 run videos, 2,615 step screenshots, A4 PDF registers |
| Smoke suites | PM smoke 19/20 (1 skipped) · Procurement Log smoke 18/18 · All-modules smoke 40/40 |
| E2E smoke (TC-01 … TC-26 with TC-14B/14C/24B) | 33 cases (24 Nov): 25 passed, 1 known defect (TC-24), 6 failed, 1 blocked – see section 1a |

**Closure recommendation:** close the regression cycle **conditionally**. Since the release of 23 Nov evening, 9 cases are failed or blocked: they come from removed or redesigned pages and need a scope decision or a re-run (section 1a). In addition, 37 defects and the decision items in `PENDING_CONFIRMATIONS.md` need the team's confirmation before the defect list is final.

### 1a. Update of 24 Nov 2026 – staging release of 23 Nov (evening)

**What the release changed:** Procurement Log submittal page and component view redesigned ("Add component", component "⋯" menu, "Open component", deliveries listed as Expected / Received with a "Delivery actions" menu, "Receive" for the actual delivery date, GRN file in the submittal's Files); component status labels ("Not ordered", "Ordered", "Delivery booked", "Received"); new Responsible dialog and bulk-assign page; Procurement Log view tabs (List / By submittal / By material / Inventory); menu regrouped; Inventory Management removed (its route opens the new "Inventory" tab); Supplier Inbox replaced by My Work; new dashboard "Urgent issues" strip; new required "Inspection outcome" section on the inspection form; analytics cookie banner.

**Automation adapted and re-run on 24 Nov:** Procurement Log parts 1–3, tickets, Configuration Options live effects, Inventory and E2E smoke (211 cases). Results of all other suites are those of 22–23 Nov.

| Suite (24 Nov) | Passed | Known Defect | Failed | Blocked | Skipped |
|---|---|---|---|---|---|
| Procurement Log part 1 | 16 | 2 | 0 | 0 | 0 |
| Procurement Log part 2 | 30 | 1 | 0 | 0 | 0 |
| Procurement Log part 3 | 52 | 5 | 1 | 0 | 0 |
| Tickets | 51 | 3 | 0 | 0 | 8 |
| Configuration Options live effects | 6 | 2 | 0 | 0 | 0 |
| E2E smoke | 25 | 1 | 6 | 1 | 0 |
| Inventory | 0 | 0 | 1 | 0 | 0 |

**Changes against 23 Nov (14 cases):**

| Case | 23 Nov | 24 Nov | Reason |
|---|---|---|---|
| PL-REG-EDT-02 | Known Defect | Passed | Dev team: Edit Submittal may give a submittal the same Submittal No and material as another – not an issue; SCP-DEF-042 withdrawn |
| PL-REG-CMP-19, PL-REG-DLV-16, PL-REG-DLV-18, PL-REG-EDT-07 | Known Defect | Passed | Pass on the redesigned pages (SCP-DEF-061, 073, 066, 067) – to be confirmed by the team before these defects are closed |
| INV-REG-SETUP, PL-REG-INT-03 | Passed | Failed | Inventory Management removed; the new Procurement Log "Inventory" tab shows "Couldn't load inventory." – possible new defect, decision needed |
| TC-14B, TC-24B | Passed | Failed | Supplier Inbox now opens My Work – scope decision needed |
| TC-21, TC-22 | Passed | Failed / Blocked | New required "Inspection outcome" fields on the inspection form; the automation now fills them – re-run pending |
| TC-23B | Passed | Failed | No "First delivery … received" task in the dashboard Tasks tab after the flow – to investigate |
| TC-23 | Known Defect | Failed | SCP-DEF-049 still seen (spend in $); in addition the submittal count rose by 5 instead of 1 during the run (other activity on the shared project) |
| TC-25 | Known Defect | Failed | SCP-DEF-058 still seen (header location reset); the final validation also misses the FDI inspection because TC-21 did not complete |

**Wording.** 55 cases whose screens or expectations changed were rewritten in plain language (e.g. the component row no longer shows an Expected Delivery date; Partial Delivery / Delivered are read from the Procurement Log list's Status column). Details: `reports/pl-redesign-2026-11-24/PL_REDESIGN_RESULTS.pdf`.

**How to read the registers.** Every test case is written for business readers: a short title, one sentence on what it checks, numbered steps with the expected result of each step, what actually happened, and the status. Internal codes, test-record tags and raw error text are not shown. The wording is kept in `config/scp-plain-language.json` (cases) and `config/scp-plain-defects.json` (defects) and is checked against the run results each time the reports are built.

| Term | Meaning |
|---|---|
| Submittal | A procurement package of materials for one supplier |
| Component | One material line of a submittal (quantity, value, dates) |
| PO | Purchase order |
| GRN | Goods received note – confirms the delivered quantity |
| FDI | First delivery inspection – quality check of the first delivery of a material |
| Pre-shipping checklist | Questions the supplier (and subcontractor) answer before a delivery is shipped |
| Required on site | Date the material is needed on site |
| Venue / site | The location chosen in the page header |
| Test record / run tag | Data the automation created for one run; its name starts with a run tag so runs never mix |
| Known Defect | The test ran and the application did something different; the difference is registered as SCP-DEF-xxx |
| Pending team confirmation | The expected behaviour is our reading of the requirement and still has to be confirmed |

## 2. Scope

| In scope (staging) | Notes |
|---|---|
| Project Management (all configuration pages) | Submittal Manager, Material Master, Material Category, Site Details, Common UoM / Utilities, Configuration Options, Procurement Log Configuration, Pre-Shipping Checklist, FDI Configuration, Inventory Control, System Messages, Bulk Upload Status, Project Setup Wizard |
| Procurement Log | Submittals, components, PO, lead time, deliveries, GRN, alerts, export, bulk edit |
| Inventory Management | Ledger, activities, uploads, stock checks, reports |
| First Delivery Inspections | Assignment, inspection form, settings, question bank/sets (BUGS-548) |
| User Management and Supplier List | Invites, roles, supplier records, SSO promotion |
| Management Dashboard | Alerts, notifications, tasks, watched materials, spend |
| Enterprise | Enterprise View, Supplier Inbox, Supplier Performance, Lead Time Benchmarks, Enterprise Shipments |
| International Shipments | Back in scope from 23 Nov 2026 (user decision) |
| Analytics | Aggregate Stats, Lead Time Analysis, Supply Chain Intelligence, Emissions, Inventory Reports, Status Report, SubContractor Issues, Supplier Issues, TOV Analytics |
| Role-based access | Project Admin, Supplier, Subcontractor and a test-only role |
| Ticket regression (BUGS-155, 325, 508, 517, 543, 548, …) | Re-checks of the reported tickets |

| Out of scope / deferred | Reason |
|---|---|
| UAT environment | Staging only (user decision, 28 Oct 2026) |
| Procore integration, part of Document Management (PO/BOM validation, EPD scan) | Deferred by the user on 22 Nov 2026 (skip group X) |
| Writing to Jira | Never – findings are kept in repository files only (user rule, 21 Nov 2026) |
| Security, performance and load testing | Not part of this functional cycle |

## 3. Test approach

1. **Functional discovery** – each module was explored in a real browser (Playwright MCP / built-in browser) and recorded in `docs/functional-discovery/*.md`: routes, controls, API calls, business rules, open questions.
2. **Scenario design** – smoke, regression, integration, negative/boundary and role scenarios per module, with expected results; user decisions recorded where the requirement was unclear.
3. **Automation** – one Playwright spec per suite on the PM-flow framework (section 11). Every step is named "action → expected result"; writes are run-tagged and restored.
4. **Execution** – overnight full regression (22 Nov 17:27 → 23 Nov 03:01 IST), smoke suites, decision suites and targeted re-runs on 23 Nov, all recorded on video with a screenshot per step.
5. **Triage** – each failure is classified as automation issue (fixed and re-run), known defect (registered with a signature), or skipped with a reason and the need to unblock it.
6. **Reporting** – consolidation of all runs (newer result replaces older), A4 PDF registers, release notes and this closure report.

| Test type | Suites |
|---|---|
| Smoke | `smoke`, `pl-smoke`, `app-smoke` |
| Regression | `regression`, `regression2`, `pl-regression`, `pl-regression2`, `pl-regression3`, `inv-regression`, `app-regression`, `tickets` |
| End-to-end | `e2e-smoke` (TC-01 … TC-26: invite users, submittal → PO → delivery → Supplier Inbox → international shipment → checklist → FDI → GRN → inventory → Enterprise → analytics) |
| Live configuration effects | `cfg-live`, `fdi-settings`, `pm-decisions` |
| Role-based access | `roles` (read-only), `roles-write`, `fresh-project` |
| Validation | `ana-ent` (Analytics and Enterprise, 17 cases, 23 Nov 2026) |

## 4. Execution results by module

| Module | Passed | Known Defect | Skipped | Failed / Blocked | Total |
|---|---|---|---|---|---|
| Project Management | 224 | 21 | 19 | 0 | 264 |
| Procurement Log | 106 | 8 | 0 | 1 | 115 |
| Tickets (BUGS) | 51 | 3 | 7 | 0 | 61 |
| Role-based access | 20 | 2 | 5 | 0 | 27 |
| Inventory Management | 16 | 6 | 3 | 1 | 26 |
| User Management | 20 | 5 | 2 | 0 | 27 |
| Analytics | 8 | 11 | 0 | 0 | 19 |
| First Delivery Inspections | 15 | 0 | 1 | 2 | 18 |
| Document Management | 12 | 1 | 3 | 0 | 16 |
| Management Dashboard | 9 | 1 | 1 | 1 | 12 |
| International Shipments | 8 | 4 | 0 | 0 | 12 |
| Enterprise | 7 | 0 | 0 | 2 | 9 |
| Other (Setup, Authentication, Homepage, FDI Configuration, Supplier / Subcontractor, Alerts, Reporting) | 12 | 0 | 0 | 2 | 14 |
| **Total** | **508** | **62** | **41** | **9** | **620** |

The per-case detail (No, Module, Sub-module, Description, Steps, Expected, Actual, Status) is in the registers listed in section 10.

## 5. Defect summary

93 defects are registered in `config/scp-known-defects.js` (human-readable list: `docs/automation-gap-analysis/KNOWN_DEFECTS.md`). 62 test cases end as Known Defect after the 24 Nov update (SCP-DEF-042 was withdrawn on 24 Nov 2026: the dev team confirmed it is not an issue); the other registered defects belong to earlier cycles or were not reproduced.

| Module (cases with a known defect) | Cases | Main themes |
|---|---|---|
| Project Management | 21 | Validation messages, configuration effects, bulk upload status, setup data, alert batch (SCP-DEF-086) |
| Procurement Log | 8 | Export columns, delivery totals and shortage, Update Status not shown on the component, Delete component, alert validation, numeric filter |
| Analytics | 11 | Exports give the template or no rows; IDs instead of names; duplicated subcontractor values inflate Supplier Issues; Supply Chain Intelligence ignores the venue (SCP-DEF-087 … 094) |
| Inventory Management | 6 | Decimal rules, stock hints, schedule/submittal checks, export type |
| User Management | 5 | Duplicate invite accepted, SSO promotion does nothing (SCP-DEF-085) |
| International Shipments | 4 | Initial status and Required Date not taken from procurement, no confirmation, Open goes to the list |
| Tickets (BUGS) | 3 | Residual behaviour of re-checked tickets |
| Role-based access, Management Dashboard, Document Management | 4 | Menu/permission gaps, dashboard currency, Uploaded By shows "Unknown" |

"Pending team confirmation" (37 defects) means the expected behaviour is the automation's reading of the requirement or a user decision; the 34 decision items are listed in `docs/automation-gap-analysis/PENDING_CONFIRMATIONS.md`.

## 6. Skipped test cases

| Reason group | Cases | What unblocks them |
|---|---|---|
| C – needs an account or test data | 17 | Invite mailbox that receives SCP mail (mail.tm receives none; YOPmail shows a human check that is never bypassed), view-only account, second organisation project |
| A – automation work still to do | 9 | Setup Wizard (9 steps), FDI settings edge cases, damaged-units ledger on a fixed site |
| B – waiting for a decision | 3 | Product owner decisions listed in PENDING_CONFIRMATIONS |
| D – needs a requirement | 4 | Expected result not defined (e.g. which alerts the daily batch creates) |
| E – manual check only | 4 | Date picker freezes the tab (SCP-DEF-002), two-tab race conditions |
| X – deferred (out of scope) | 4 | Procore / Document Management scope reopened |
| **Total** | **41** | |

## 7. Exit criteria evaluation

| Criterion | Target | Result | Met |
|---|---|---|---|
| All in-scope cases executed or skipped with a recorded reason | 100 % | 578 executed, 1 blocked, 41 skipped with reason | Yes |
| No unexplained failure | 0 Failed / 0 Blocked | 8 / 1 after the release of 23 Nov evening – each explained in section 1a (scope decisions, a re-run, one item to investigate) | **No** |
| Every failure linked to a registered defect | 100 % | 62 / 62 known-defect cases; the 9 failed/blocked cases are not yet registered (section 1a) | **No** |
| Evidence for every executed case | Video + step screenshots | 44 videos, 2,615 screenshots | Yes |
| Expected behaviour confirmed for all defects | 100 % | 56 of 93 confirmed; 37 pending | **No** |
| Live settings and roles restored after the run | Always | Restored and verified (Supplier role, Configuration Options, test role) | Yes |

## 8. Risks and open items

- **Unconfirmed defects (37)** – the defect list may change once the team confirms the expected behaviour; severities are proposals.
- **Daily alert batch (SCP-DEF-086)** – seeded submittals got no alert after the 05:00–06:00 IST batch; a new seed is stored (`reports/cfg-alert-seed.json`) for a re-check on the next morning.
- **Slow pages** – International Shipments needs about 200 s to list its data; the tests wait up to 6 minutes and report "SLOW PAGE".
- **Shared staging data** – other teams change NRVC_Hall; the tests create their own run-tagged records and restore every setting they touch.
- **Mailbox-dependent cases** – invite acceptance cannot be automated until a mailbox without a human check receives SCP mail.
- **Header venue resets after reload** (OBS-INV-12) – handled by the framework (`keepSite`), but any new test must use it.

**Passed cases to review.** While the cases were rewritten in plain language, a few Passed results turned out not to exercise the full check, or to show behaviour that may need a decision. They stay Passed in this cycle, but a reviewer should look at them:

| Case | Observation |
|---|---|
| PM-REG-ROLE-04 | "View-only access blocks changes": both accounts had "Material: Add" enabled, so the view-only situation was not exercised. |
| PM-REG-ROLE-15 / 18 | No role may create System Messages and neither account could open them, so the permission itself was not tried. |
| ANA-REG-04 | No total columns were found to compare, so the check had nothing to verify. |
| T507-02 | The saved material name lost the brackets of "(A)" while the case expects ( ) # / - to be kept. |
| T155-03 | Covered by T155-01; a supplier in the subcontractor's own organisation was not available. |
| PM-REG-INV-04 / 05 | Inventory Control accepted Min 100 with Max 10, and Min -1 – to confirm with the product owner. |
| Material Master / reference data (MM-08, MM-16, MM-17, REF-21, REF-22b, SITE-09) | Duplicates are refused without a message; conversion 0 and -1 accepted when adding an item. |
| UPL-MM-12 / 13, UPL-SITE-11 | The expected result of these upload cases is not yet confirmed; the observed outcome is recorded. |

## 9. Recommendations

1. Review the "Passed cases to review" above, and confirm the 34 items of `PENDING_CONFIRMATIONS.md`; update `config/scp-known-defects.js` (confirmation `pending` → confirmed) or the tests accordingly.
2. Re-run `cfg-live` on the next morning after 06:00 IST to re-check the alert batch with the stored seed.
3. Provide a test mailbox and a view-only account to unblock 17 skipped cases (group C).
4. Run `npm run full:regression` before each release; consolidate with `scripts/non-pass-report.js` and the register scripts (section 11.9).
5. Keep functional discovery documents current when a module changes; they are the oracle for the tests.

## 10. Deliverables and evidence

| Deliverable | Location (under `SCP/`) |
|---|---|
| All test cases register (620) – A4 portrait / landscape | `reports/full-regression-2026-11-22T17-27-26-683Z/A4-portrait/TEST_CASES_ALL.pdf` · `…/TEST_CASES_ALL.pdf` |
| Passed / Known Defect / Skipped registers | `…/A4-portrait/TEST_CASES_PASSED.pdf`, `TEST_CASES_KNOWN_DEFECTS.pdf`, `TEST_CASES_SKIPPED.pdf` |
| Known defects and skipped cases by module (narrative) | `…/KNOWN_DEFECTS_BY_MODULE.pdf`, `…/SKIPPED_BY_MODULE.pdf` |
| Failed / Blocked / Skipped report, known-defect flows | `…/NON_PASSED_TEST_CASES.pdf`, `…/KNOWN_DEFECT_TEST_CASES.pdf` |
| Automation release notes | `…/AUTOMATION_RELEASE_NOTES.pdf` |
| Run videos (MP4) and step screenshots | `reports/demo-videos-2026-11-23/` (index.html, one folder per suite) |
| Defect register and decisions | `docs/automation-gap-analysis/KNOWN_DEFECTS.md`, `PENDING_CONFIRMATIONS.md`, `00_SUMMARY.md` |
| Scenario and discovery documents | `docs/functional-discovery/` |

## 11. AI automation – framework reference

### 11.1 Architecture overview

| Layer | What it is | Where |
|---|---|---|
| AI agent | Claude Code (Anthropic) – discovery, scenario design, test code, triage, reports; works through the tools below under the user's decisions | Claude desktop app / CLI |
| Browser control for discovery | Playwright MCP server and the built-in browser – read pages, controls and network calls of staging | `SCP/.mcp.json` (`@playwright/mcp`) |
| Test framework | Playwright Test (Node.js) running the PM-flow specs in Google Chrome, one worker | `playwright.pm-flow.config.js`, `tests/pm-flow/` |
| Runner and evidence | Scenario/step runner with retries, known-defect matching, screenshots, video, HTML report | `tests/pm-flow/support/pm-runner.js`, `scripts/run-pm-flow.js` |
| Application under test | SCP web front end + REST API on staging, Voyage Control SSO | staging hosts above |
| Reporting | Node scripts that consolidate runs and print A4 PDFs through Chromium | `scripts/*.js` |
| Source control | Git, GitHub (`hariharanr15/playright_Automation`), PR-based merge to `main` | repository root |

Flow of a run: `npm run …` → `scripts/run-pm-flow.js <suite>` → Playwright starts Chrome → `runPmSuite` signs in once (SSO → Supply Chain Planner → project → venue) → scenarios run step by step → `results.json`, `report.html`, step screenshots, `run.mp4` in `reports/pm-flow/<suite>-<timestamp>/` → consolidation scripts → registers and PDFs.

### 11.2 Application under test – front end, back end and sign-in

| Part | Observed details |
|---|---|
| Front end | Single-page web application built with **React** (React runtime errors such as "Maximum update depth exceeded" observed, SCP-DEF-002); left menu with module groups, header project and venue selectors, drawers for submittal/component detail, toasts with role `status`, react-select style pickers. The application source code is not in this repository – everything is tested through the UI. |
| Back end | **REST JSON API** under `/api/…` on the same host, resource-style endpoints, e.g. `project_master`, `submittal_master`, `submittal_schedule`, `schedule_delivery`, `material_master`, `project_material_category`, `supplier_master`, `shipping_details`, `fdi_question_set`, `org_fdi_question_set`, `notification_system`, `user_preferences`, `enterprise/lead-time-benchmarks`, `emissions/export-csv`, `salesflow/supply_chain`. The tests read API responses only to confirm what a page sends or shows (e.g. ANV-SCI-01 records the request parameters). |
| Background jobs | Daily alert batch 05:00–06:00 IST (Configuration Options alert-week thresholds) – checked by the two-phase `cfg-live` suite. |
| Sign-in | Voyage Control SSO (`stg-login…`) → platform chooser → "Supply Chain Planner" tile → header project and venue. Admin portal (Voyage Control Admin) for roles and projects. |
| Accounts | Project Admin (main account), Supplier, Subcontractor, invited run users (YOPmail addresses), a test-only role "SCP Automation Test Role". Passwords live only in `SCP/.env` (git-ignored). |

### 11.3 Technology stack

| Component | Version / detail | Purpose |
|---|---|---|
| Node.js | 22.16 | Runtime for tests and report scripts |
| @playwright/test | 1.61 (package range ^1.59.1) | Browser automation and test runner |
| Google Chrome (channel `chrome`) | Installed Chrome | Browser under test; headed or headless |
| @cucumber/cucumber | 13.2 | BDD feature files for Project Management navigation (`features/`, `cucumber.js`) |
| ffmpeg-static | 5.2 | Converts the Playwright WebM recording to H.264 MP4 (`run.mp4`) |
| Python 3 (standard library) | 3.13 | Workbook writer for bulk-upload files (`utils/bulk-upload/workbook.py`), PDF text check, coverage summaries |
| Chromium print (Playwright) | – | All A4 PDFs (`scripts/md-to-pdf.js`, `full-regression-pdf.js`) |
| Git / GitHub CLI | – | Version control, pull request and merge |

### 11.4 Framework structure

| Path (under `SCP/`) | Purpose |
|---|---|
| `tests/pm-flow/*.spec.js` | The 21 suites of the PM-flow framework (one test per suite, scenarios inside) |
| `tests/pm-flow/support/` | Framework core: `pm-runner.js` (scenarios, steps, retries, known defects), `pm-flow.js` (suite harness), `pm-session.js` and `pm-navigator.js` (single sign-in, menu navigation), `pl-flow.js` (Procurement Log kit), `e2e-kit.js` / `e2e-kit-v2.js` (E2E building blocks), `pm-visuals.js` (on-screen banner and outlines for videos), `pm-report.js` / `e2e-report.js` (HTML/PDF reports), `pl-files.js` and `pm-workbook.js` (xlsx/pdf inputs) |
| `pages/` | Page Object Model – 47 page objects by module (project-management, procurement-log, inventory-management, enterprise, reports, user-management, …) plus shared login, platform chooser, project and site selectors |
| `tests/regression/`, `tests/smoke/` | Earlier POM suites (55 specs) – Enterprise BUGS-325 oracle, FDI, Inventory, Procurement Log, Setup Wizard |
| `features/` | Cucumber feature files and step definitions (Project Management navigation) |
| `config/` | `scp.config.js` (environment), `scp-known-defects.js` (94 defects with signatures), `scp-skip-plan.js` (skip groups and needs), `scp-covered-by.js`, `scp-module-registry.js` |
| `fixtures/`, `utils/`, `test-data/` | Playwright fixtures, helpers (env loader, date pickers, evidence, highlight, bulk upload), example data files |
| `scripts/` | Launchers (`run-pm-flow.js`, `run-full-regression.js`, `overnight-demo.sh`) and report builders (section 11.9) |
| `docs/` | Requirements, functional discovery, scenario documents, gap analysis, defect register, this report |
| `reports/` | Run output (git-ignored): `pm-flow/<suite>-<time>/`, consolidated `full-regression-…/`, `demo-videos-<date>/` |
| `playwright.*.config.js` | One config per mode; `playwright.pm-flow.config.js` is the main one |

### 11.5 Framework behaviour (PM-flow)

- **One sign-in per suite** – SSO, platform tile, project and venue are chosen once; the navigator opens a page only when it is not already open.
- **Scenario and step model** – `run.scenario(meta, s => s.step('action → expected', fn))`. Each step gets **two attempts**; a `critical` step failure blocks only the rest of its scenario; `always` scenarios (setup/restore) run even with `--only`.
- **Known-defect matching** – a failed step whose error matches a registered defect signature, for the same scenario or module, is reported as **Known Defect**, not Failed.
- **Skip plan** – cases that cannot run are recorded as Skipped with the reason and a group (A–E, X) from `config/scp-skip-plan.js`.
- **Observations** – `s.observe(...)` records what the application showed (counts, toasts, values); it appears in the registers as the actual result.
- **Run-tagged data** – every record the tests create carries a run tag (e.g. `APR2611231115`, `CFL…`), so runs never collide and only run-owned data is deleted.
- **Restore in `finally`** – settings and roles changed by a test are put back and verified (Configuration Options, Supplier role, header venue).
- **Evidence** – screenshot after every step (`PM_FLOW_STEP_SHOTS=on`), whole-run video 1920×1080 (`PM_FLOW_VIDEO=on`) converted to MP4, Playwright trace on failure, an on-screen banner naming the scenario and step.

### 11.6 Suite catalogue

| Suite key | npm script | Content |
|---|---|---|
| smoke / regression / regression2 | `pm:smoke`, `pm:regression`, `pm:regression2` | Project Management configuration pages |
| pl-smoke / pl-regression / pl-regression2 / pl-regression3 | `procurement:*` | Procurement Log end to end (submittals, PO, deliveries, GRN, export, alerts) |
| inv-regression | `inventory:regression` | Inventory Management |
| app-smoke / app-regression | `modules:smoke`, `modules:regression` | User Management, Supplier List, FDI, Documents, Dashboard, Enterprise, Shipments, Analytics |
| tickets | `tickets:regression` | Ticket re-checks (BUGS-…) |
| roles / roles-write / fresh-project | `roles`, `roles-write`, `fresh-project` | Role-based access, admin portal changes, new project |
| fdi-settings / cfg-live / pm-decisions | same names | Live setting effects (restored afterwards), two-phase alert batch |
| e2e-smoke | `e2e:smoke` | TC-01 … TC-26 end to end |
| ana-ent | `ana-ent` (also in `full:regression`) | Analytics and Enterprise validation |
| full regression | `full:regression` | All regression suites in order, ana-ent and the E2E smoke, one MP4 per suite |

### 11.7 Configuration

| Setting | Value / meaning |
|---|---|
| Playwright (`playwright.pm-flow.config.js`) | 1 worker, no Playwright retries (the runner retries steps), test timeout 60 min, expect 10 s, action 20 s, navigation 45 s, trace on failure, downloads accepted, maximised Chrome |
| Run switches | `--headless`, `--only=ID1,ID2`, `PM_FLOW_VIDEO=on`, `PM_FLOW_STEP_SHOTS=on`, `PM_FLOW_SLOW_MO`, `SCP_FORCE_SCALE_1` (100 % zoom for E2E), `E2E_ACTION_PAUSE_MS` |
| Environment file `SCP/.env` (names only; values never committed) | `SCP_BASE_URL`, `SCP_LOGIN_URL`, `SCP_USERNAME` / `SCP_PASSWORD`, role accounts (`SCP_ADMIN_*`, `SCP_SUPPLIER_*`, `SCP_SUBCONTRACTOR_*`), `SCP_PROJECT_NAME`, `SCP_PLATFORM_*`, FDI and wizard fixtures, timing (`SCP_SLOW_MO`, `STEP_WAIT_MS`, `HIGHLIGHT_MS`); template in `.env.example` |

### 11.8 Plugins and integrations

| Plugin / integration | Used for | Rule |
|---|---|---|
| Playwright MCP (`@playwright/mcp`, `SCP/.mcp.json`) | AI-driven functional discovery and validation in a real browser (pages, controls, network) | Read-only exploration unless a write was approved |
| Claude built-in browser | Validation sessions (e.g. 18 Nov Analytics validation) with network inspection | Passwords are never typed by the AI |
| Claude Code (Anthropic) | AI agent that writes and runs the tests, triages results and builds reports | Works on the user's decisions; asks before destructive or outward actions |
| Atlassian (Jira / Confluence) MCP | Reading ticket descriptions (BUGS-…) | **No writes to Jira** (user rule) |
| ffmpeg-static | WebM → MP4 conversion | – |
| Cucumber | BDD scenarios for Project Management navigation | – |
| GitHub / gh CLI | Push, pull request, merge | Commits only on request; secrets never committed |
| YOPmail (web mailbox) | Invite acceptance in E2E smoke | The "verify you are human" check is never bypassed; blocked cases are Skipped |

### 11.9 Reporting pipeline

| Script | Output |
|---|---|
| `scripts/non-pass-report.js <full> <re-runs…>` | Consolidates runs (newer replaces older), re-checks known defects: `NON_PASSED_TEST_CASES.md`, `PASSED/DEFECT/SKIPPED_CASES.json` |
| `scripts/testcase-register.js <full>` | `TEST_CASES_ALL / PASSED / KNOWN_DEFECTS / SKIPPED.md` (No, Module, Sub-module, Description, Steps, Expected, Actual, Status) |
| `scripts/narrative-register.js <full>` | `KNOWN_DEFECTS_BY_MODULE.md`, `SKIPPED_BY_MODULE.md` (plain-language, per module) |
| `scripts/plain-language-merge.js <dir> <full>` | Merges and checks the plain wording: every case covered, steps and expected results match, status matches the run, no internal codes left; hand-written entries in `config/scp-plain-language-manual.json` win |
| `scripts/skipped-cases-report.js`, `known-defects-report.js` | Open skipped cases by group/module; `docs/automation-gap-analysis/KNOWN_DEFECTS.md` |
| `scripts/md-to-pdf.js <file.md> [--landscape]` | A4 PDF (portrait or landscape) through Chromium print |
| `scripts/collect-videos.js`, `release-notes.js` | Video/screenshot folder with index; release notes |
| `reports/reruns-2026-11-23/final-reports.sh` | Runs the whole chain for this cycle |

### 11.10 How AI was used, and its guardrails

| Activity | AI role | Human role |
|---|---|---|
| Functional discovery | Explored each module through MCP and wrote the discovery documents | Reviewed; answered open questions |
| Scenario design | Proposed scenarios with expected results | Approved scope and expected behaviour (decisions dated in the docs and memory) |
| Test code | Wrote and maintained all PM-flow specs, kits and report scripts | Approved live-setting writes and role edits |
| Execution and triage | Ran suites, separated automation issues from application defects, fixed test issues, re-ran | Decided what counts as a defect; confirms pending items |
| Reporting | Built registers, PDFs, release notes, this report; rewrote every case and defect in plain language (parallel AI helpers with one style guide, checked by script against the run data) | Signs off (section 12); reviews the plain wording |

Guardrails applied throughout: no writes to Jira; credentials only in `.env`, never echoed (emails masked in reports); no CAPTCHA or human-check bypass; shared Supplier/Subcontractor roles never changed (only the test role), and the Supplier account is restored and verified from its own session; every live setting restored in `finally`; deletions only of run-owned data and only after confirmation; commits and pushes only on request; architecture, security and compliance decisions stay with people.

### 11.11 How to run

| Task | Command (from `SCP/`) |
|---|---|
| Install | `npm run setup` |
| One suite, headless, with evidence | `PM_FLOW_VIDEO=on PM_FLOW_STEP_SHOTS=on node scripts/run-pm-flow.js app-regression --headless` |
| Selected cases | `node scripts/run-pm-flow.js app-regression --only=ENT-REG-02,ENT-REG-03 --headless` (add the setup/predecessor cases a case depends on) |
| Full regression + E2E | `npm run full:regression` |
| Overnight run with all deliverables | `bash scripts/overnight-demo.sh` |
| Rebuild the reports of this cycle | `bash reports/reruns-2026-11-23/final-reports.sh` |
| Stop a run | Stop the task and also end the Playwright `node` processes (they keep running otherwise) |

### 11.12 Lessons learned

- The header venue resets after a page reload; tests must re-select it (`keepSite`) before using location lists.
- Some pages load slowly on staging (International Shipments about 200 s); waits are page-specific and slow loads are reported, not hidden.
- Check oracles before calling a failure a defect: several "failures" were weak checks (row counts vs. a long-format CSV, collapsed sections, chart axis numbers) and were rewritten.
- Run dependent cases together with the case that opens their page (e.g. FDI-16 with FDI-01/11).
- Avoid apostrophes in defect summaries – the defect file is JavaScript and is read by every report.
- Two-phase checks (daily batch) need a stored seed and a run after the batch window.

## 12. Sign-off

| Role | Name | Decision (Approve / Approve with conditions / Reject) | Date | Signature |
|---|---|---|---|---|
| QA Lead | | | | |
| Product Owner | | | | |
| Development Lead | | | | |
| Project Manager | | | | |
