# Project Management flow (Smoke / Regression)

Scenarios: `docs/functional-discovery/PM_SMOKE_SCENARIOS.md` and `PM_REGRESSION_SCENARIOS.md`.

## Run

```bash
npm run pm:smoke                                   # all smoke scenarios
npm run pm:smoke -- --only=PM-SMK-009,PM-SMK-019   # re-run selected scenarios (sign-in always runs first)
npm run pm:smoke -- --headless                     # without a visible window
```

Each run writes `reports/pm-flow/<suite>-<timestamp>/`:

- `report.html` – totals, results by module › submodule, every step with attempts, errors and screenshots, and the re-run command
- `results.json` – the same data for tooling
- `screenshots/` – one image per failed attempt

## How a run behaves

- Google Chrome, maximised to the screen (`viewport: null`, `--start-maximized`).
- One sign-in (Project Admin from `SCP/.env`) and one project selection (`SCP_PROJECT_NAME`, default NRVC_Hall) per run; every scenario runs in the same tab.
- Scenarios follow the left-menu order. `PmNavigator.open()` clicks a menu entry only when the browser is not already on that page, and expands a group only when it is closed.
- Every step gets at most **two attempts** (open lists and modals are closed in between). After a second failure the step is recorded as Failed with a screenshot and the flow continues. A failed `critical` step (such as opening the page) blocks only the rest of its own scenario. If sign-in fails, the remaining scenarios are recorded as Blocked.
- Visual cues: a banner in the page header shows suite, scenario and step; the active Project Management menu path is outlined; the element being used is briefly outlined.
- Pause between steps: `PM_FLOW_STEP_INTERVAL_MS` (default 800).

## End-to-end smoke (`npm run e2e:smoke`)

`e2e-smoke.spec.js` (support: `support/e2e-kit.js`, `support/e2e-kit-v2.js`, `support/e2e-report.js`,
`support/e2e-pdf-text.py`) runs "SCP – Updated End-to-End Smoke Automation Requirements" (TC-01 … TC-24, 12 Nov 2026)
in one Chrome tab at 100 % zoom, in the execution order of §15. Accounts change by logout → pause → login:
Project Admin → existing Supplier (`SCP_SUPPLIER_*`) → new Subcontractor user → Project Admin.

| ID | Test case (run order) |
|---|---|
| TC-01 | Login as Project Admin; project and location selected **once**; 100 % zoom |
| TC-02 | Homepage: main tabs and visibility, widgets/KPIs, dashboard baseline (all category rows), Alerts/Notifications/Tasks, screenshot |
| TC-02B | Analytics baseline before any setup: all 9 Analytics pages (Aggregate Stats … TOV Analytics), every sub-tab, scrolled screenshots, filters / KPI values / table rows; Configuration Options snapshot |
| TC-03 | `Material Category <N> <YYYYMMDD>` (next free N of the day) |
| TC-04 | `Material <N> <YYYYMMDD>` by **upload only** in the new category; secondary material `SCP_E2E_MATERIAL_2` looked up |
| TC-05 | Exactly one normal Supplier `Supplier <N> <date>`: "Add Supplier" once, "Is Sub-Contractor" verified OFF on open and before the single Save; Type "Supplier"; exactly one new supplier of today; ID stored. No Supplier List subcontractor record |
| TC-06 | Normal organisation user (Subcontractor, used for the TC-16 approvals) invited as `subcontractor<N><DDMMYYYY>@yopmail.com` (next free N of today) into `SCP_E2E_USER_ORG` (Voyage Control); no SSO organisation; 2 s pause |
| TC-07 | Both materials mapped to the supplier in one Map Material popup |
| TC-19 | `FDI Question Set <N> <date>` for the new material category (+ `FDI Category` when the form offers add), `FDI Group`, 2 Text questions |
| TC-18 | New user added as inspector scoped to the new material; Project Admin confirmed as enabled inspector |
| TC-08 | `submittal <N> <date>` with **only** the primary material |
| TC-09 | Secondary material added in the drawer with **"+ Add material"**; same submittal, no new one |
| TC-10 / 10B | Components, lead time confirmed (status exactly "Confirmed"), one booking per component |
| TC-11 | Status filter (`SCP_E2E_FILTER_STATUS`, Ordered) + Export: every row and exported row has that status, export rows = item count |
| TC-12 | Assign Responsible to `SCP_E2E_RESPONSIBLE` (default the Project Admin login); fails if that user is not offered |
| TC-13 | Bulk Edit Spec Description on two **earlier** run submittals, Preview, Confirm & Apply; second edit cancelled at Preview ("Back") and verified not committed |
| TC-14 | Row Alert rule (first Total Count field, `SCP_E2E_ALERT_CONDITION`/`_VALUE`, recipient = responsible user); "Sent" status is optional |
| TC-15 / 16 | Supplier checklist; new Subcontractor activates (Yopmail), logs in, approves |
| TC-17 / 17B | Project Admin: approvals, Actual Delivery Date, shipping, conditions; GRN PDF checked; submittal Delivered |
| TC-20 / 21 / 22 | FDI record generated; Self Assign, fill, Save Progress, Submit; filter Material + "Inspection Completed" and View |
| TC-23 / 23B | Dashboard previous vs current; Alerts, Notifications, Tasks of the run |
| TC-24 | Configuration Options unchanged; Currency Type, Common Utilities, Common UoM; PL Value Delivered currency; all 9 Analytics pages again and compared with TC-02B (report section "Analytics – before vs after"); Status Report and Lead Time Analysis rows |
| TC-25 / 26 | Final record check, HTML + PDF report; logout |

- Needs `SCP_SUPPLIER_USERNAME/PASSWORD`, `SCP_INVITED_USER_PASSWORD` in `.env`, and Python with `pypdf` (GRN text).
- Every step runs once (no automatic retry); a failure is recorded with its screenshot and the flow continues.
  Project and location are selected once per login and the run never reloads a page afterwards (a reload resets the
  header site), so the report expects 0 site re-selections. Creation steps look for their record first. A test case whose prerequisite failed is Blocked; the smoke is PASS only when every mandatory step passed.
- Pauses: `E2E_ACTION_PAUSE_MS` before every browser action (default 300, via `PM_FLOW_SLOW_MO`), `E2E_STEP_PAUSE_MS`
  between steps (2000), `E2E_LOGIN_PAUSE_MS` before each login (3000), `E2E_USER_PAUSE_MS` after the invite (2000).
  `E2E_STEP_TIMEOUT_MS` (300000) stops a step with no progress for 5 minutes (not retried). Other options:
  `SCP_E2E_MATERIAL_2` (43 Inches), `SCP_E2E_UOM`, `SCP_E2E_SITE`, `SCP_E2E_USER_ORG`, `SCP_E2E_INSPECTOR_ROLE`,
  `SCP_E2E_BULK_SEARCH` (E2E26), `SCP_E2E_ALERT_FIELD`.
- Evidence: a screenshot after every executed step (`E2E_SCREENSHOT_EVERY_STEP=false` limits it to key steps and
  failures) and a video of the whole run, converted after the run to `e2e-run.mp4` (H.264, 1920×1080) with the
  `ffmpeg-static` devDependency (`E2E_VIDEO=off` disables recording). Other pm-flow suites record no video.
- Output in `reports/pm-flow/e2e-smoke-<time>/`: `e2e-report.html` (rewritten after every step), `e2e-report.pdf`,
  `e2e-progress.json`, `run-records.json`, `grn/*.pdf`, `downloads/` (export), `screenshots/`, `e2e-run.mp4`, plus `report.html`.
- The flow runs end to end; `--only` is not meaningful.

## Files

| File | Purpose |
|---|---|
| `pm-smoke.spec.js` | Smoke scenarios PM-SMK-001…020 |
| `support/pm-flow.js` | Run harness: output folder, visuals, navigator, runner, report |
| `support/pm-runner.js` | Scenario / step execution, two attempts, continue on failure, results |
| `support/pm-navigator.js` | Project Management menu map, navigate-only-when-needed, modal clean-up |
| `support/pm-visuals.js` | Header banner, menu highlight, element outline |
| `support/pm-report.js` | HTML report |
| `../../playwright.pm-flow.config.js` | Chrome, headed, one worker, no Playwright retries |
| `../../scripts/run-pm-flow.js` | `npm run pm:smoke` / `pm:regression` launcher |

### 12 Nov 2026 updates
- Location (TC-25 rule): `ensureLocationSelected` reads the header first; the dropdown is used only when the app cleared/changed it; every check is listed in the report.
- Alert rule: condition `>=` 100 on the custom "Total Count" field (no value on the run submittal) → expected "Created", not sent, and not in Alerts.
- Delivered rule: the component is not "Delivered" before the booking's Actual Delivery Date is entered and is "Delivered" afterwards; the grid column "Actual Delivery Date" is recorded only (not SCP-DEF-043).
- FDI fill step waits for the questionnaire to load; alert recipient accepted by name or e-mail.
