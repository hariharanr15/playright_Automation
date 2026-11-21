# SCP automation – demo run guide

**Updated:** 22 Nov 2026 · **Environment:** staging, project **NRVC_Hall**, site **Warehoust _NR** · **Run from:** the `SCP` folder

## 1. Before you run

| Check | Why | How |
|---|---|---|
| No other automation run is active | Two runs on the same project and account corrupt each other's data | PowerShell: `Get-CimInstance Win32_Process -Filter "Name='node.exe'" \| Where-Object { $_.CommandLine -match 'pm-flow\|playwright' }` must return nothing |
| Pre-Shipping option is **on** (Project Management › Configuration Options) | Without it the "PreShipping Checklist" page is hidden. PM-REG-PSC-01/02 are then reported **Blocked** (not Failed) | Open Project Management in the app and check that "PreShipping Checklist" is in the menu |
| Stock of "43 Inches" on Warehoust _NR | Inventory needs at least 12 units at one real location. The suite picks the best-stocked location by itself | The full regression runs Procurement Log part 1 right before Inventory, which delivers new stock |
| `.env` has the staging accounts | Sign-in for every suite | Unchanged since the last run |

## 2. Commands

| Purpose | Command | Duration (approx.) |
|---|---|---|
| **Full regression + E2E smoke** (one command, all suites in the right order) | `npm run full:regression -- --headless` | 2.5–3 h |
| Smoke suites (page-load health, not part of the full regression) | `npm run procurement:smoke`, `npm run modules:smoke`, `npm run pm:smoke` | 2–5 min each |
| E2E smoke only (the demo flow) | `npm run e2e:smoke` | about 20 min |
| One suite | e.g. `npm run inventory:regression` (needs `npm run procurement:regression` just before it) | 10–25 min |
| Selected cases of a suite | `node scripts/run-pm-flow.js <suite> --only=ID1,ID2 --headless` | minutes |
| Known-defect list | `npm run defects:report` → `docs/automation-gap-analysis/KNOWN_DEFECTS.md` | seconds |
| Failed / Blocked / Skipped list and Known Defect cases for any run (add re-run folders after the first to replace earlier results) | `node scripts/non-pass-report.js <run folder> [re-run folder …]` | seconds |
| Any of these lists as an A4 PDF | `node scripts/md-to-pdf.js <file.md>` | seconds |

**Order inside the full regression:** Other modules → Tickets → PM part 1 → PL part 2 → PM part 2 → PL part 1 → Inventory → PL part 3 → FDI follow-up → E2E smoke.

## 3. What you get

| Output | Where |
|---|---|
| One HTML report per suite, with a screenshot of every failure | `reports/pm-flow/<suite>-<timestamp>/report.html` |
| Video of each suite (MP4) | same folder, `run.mp4` (E2E: `e2e-run.mp4`) |
| Consolidated A4 report (all suites) | `reports/full-regression-<timestamp>/SCP_Full_Regression_Report.pdf` |
| **Failed, Blocked and Skipped test cases, module by module, with steps** | `reports/full-regression-<timestamp>/NON_PASSED_TEST_CASES.md` and `.pdf` |
| **Known Defect test cases, each with its defect, expected vs actual and the full flow** | `reports/full-regression-<timestamp>/KNOWN_DEFECT_TEST_CASES.md` and `.pdf` |

## 4. How to read a result

| Result | Meaning | Action |
|---|---|---|
| **Passed** | Behaved as expected | None |
| **Known Defect** | Failed exactly as a registered defect describes. The defect ID is shown | None for the demo. Explain with `KNOWN_DEFECTS.md` |
| Known Defect **(pending confirmation)** | Today's behaviour looks wrong, but the client/team has not yet confirmed the expected behaviour | Listed in `PENDING_CONFIRMATIONS.md` for the team review |
| **Blocked** | Did not run: an earlier required step failed, or an environment precondition is not met (the reason says which) | Fix the precondition and re-run the case |
| **Skipped** | Not executed on purpose (covered elsewhere, out of scope, or waiting for data/accounts) | None |
| **Failed** | Unexpected behaviour with no known defect | Investigate before the demo |
| "passed on retry" | A step needed a second attempt | Timing issue to watch; the step did pass |

## 5. Known risks for the demo

| Risk | Effect | Mitigation |
|---|---|---|
| YOPmail shows a "verify you are human" check to automation (E2E invite acceptance) | Would block TC-16 and the cases after it | **Covered.** By default (`SCP_E2E_SUBCON_LOGIN` unset or `existing`) TC-16 to TC-18 use the pre-created Subcontractor account `SCP_SUBCONTRACTOR_USERNAME` / `_PASSWORD` (organisation Voyage Control), so YOPmail is not needed. With `SCP_E2E_SUBCON_LOGIN=invite` the run tries YOPmail first and **falls back** to that account when activation fails; TC-16 then shows "FALLBACK: …". TC-06 still creates and checks the invitation. The check is never bypassed |
| The app resets the header site after a reload or when changing module (SCP-DEF-058) | Location lists may be empty | The tests restore the site themselves (`keepSite`). E2E TC-25 reports the count as a known defect |
| Shared staging data grows (sites, run submittals, system messages) | Slower pages; leftover banners on screen | Check System Messages for active test messages before presenting |
| **International Shipments is very slow** ("Loading international shipments…") | On 21 Nov 2026 the page needed **148–158 s** to show its data (it was under 90 s earlier the same day) | The tests wait up to 3 min and print "SLOW PAGE: …" in the report. For a live demo, open the page in advance or show the recorded run |
| A partial re-run (`--only=` with System Messages cases) leaves its test banners active | "Project notice" banners from the run on every page until the next day; they can cover buttons | Run `node scripts/run-pm-flow.js regression2 --only=PM-REG-SYS-00 --headless` afterwards; it deactivates every active "PMR2-…" test message |
| A run between 00:00 and 05:30 IST | The server's date is still the previous day (UTC): "PO date cannot be in the future" for today's PO Date, and that night's alerts are dated the day before (SCP-DEF-074) | The tests use the server's date in that window and note it. Prefer daytime runs; the demo is not affected |
| A suite stopped with Ctrl+C or TaskStop leaves browser processes running | Next run collides with it | Use the process check in section 1 and stop the leftovers |

## 6. Related documents

- `00_SUMMARY.md` – gap analysis, phases and run history
- `KNOWN_DEFECTS.md` – every known defect, registered or pending confirmation (generated)
- `PENDING_CONFIRMATIONS.md` – questions for the client/team, with steps
- `../functional-discovery/steps/INV_REGRESSION_STEPS.md` – Inventory test cases in the human-readable standard
