# SCP Playwright Automation

This project is a reusable Playwright Page Object Model scaffold for the SCP application.

## Structure

```text
SCP/
  config/              Runtime configuration helpers
  fixtures/            Shared Playwright fixtures
  pages/               Shared page objects and components
  pages/management-dashboard/       Management Dashboard tab
  pages/procurement-log/            Procurement Log tab
  pages/first-delivery-inspections/ First Delivery Inspections tab
  pages/international-shipments/    International Shipments tab
  pages/user-management/            User Management tab
  pages/user-management/supplier-list/ Supplier List subtab
  pages/project-management/        Project Management subtabs
  pages/tabs/          Generic configured-tab helpers
  test-data/           Data for configured tabs and flows
  tests/smoke/         Fast checks grouped by tab
  tests/regression/    Functional checks grouped by tab and subtab
  tests/support/       Test wrappers, steps, and assertions
  utils/               Common utilities
```

## Setup

```bash
cd SCP
npm install
npx playwright install
```

Create `SCP/.env` from `.env.example`, then set:

```text
SCP_BASE_URL=
SCP_USERNAME=
SCP_PASSWORD=
SCP_PROJECT_NAME=NRVC_Hall
SCP_TAB_NAMES=Procurement Log,First Delivery Inspections,International Shipments
```

Admin credentials default to `SCP_USERNAME` and `SCP_PASSWORD`. Configure
`SCP_ADMIN_*`, `SCP_SUBCONTRACTOR_*`, and `SCP_SUPPLIER_*` when role-specific
scenarios are added.

## Run

```bash
npm run test:full:chrome
npm run test:full:chrome:headed
npm run test:scp:regression:chrome
npm run test:scp:regression:chrome:headed
npm run test:scp:regression:chrome:demo
npm run test:smoke
npm run test:regression
npm run test:headed
npm run test:management-dashboard:headed
npm run test:first-delivery-config:headed
npm run test:procurement-log
npm run test:procurement-log:headed
npm run test:procurement-log:demo
npm run test:fdi-tab:report
npm run test:fdi-flow:report
npm run test:application
npm run test:application:headed
npm run test:application:demo
npx playwright test tests/smoke/first-delivery-inspections/scp-first-delivery-inspection.spec.js --project="Google Chrome"
npx playwright test tests/regression/first-delivery-inspections --project="Google Chrome"
npm run cucumber:dry-run
npm run cucumber:project-management
npm run cucumber:project-management:demo
```

`cucumber:project-management` runs headlessly in normal mode. The demo command
uses headed Chrome, action highlighting, and a short visual delay. Both commands
execute Project Management scenarios sequentially.

`test:full:chrome` and `test:full:chrome:headed` run the Project Management and
Playwright suites even when one module fails. Standard test commands also write
the page-wise result to `reports/scp-page-report.html`, with links to failure evidence.

## Entire SCP Application Automation

Run the full application flow with one command:

```powershell
npm.cmd run test:application
```

Use `test:application:headed` to watch it in Chrome, or `test:application:demo`
for headed execution with demo highlighting. The full application runner executes
smoke navigation for every configured SCP tab, the Project Management Cucumber
regression, and the Playwright module regression. It continues through later
suites when one suite fails and archives suite-level evidence plus consolidated
HTML/PDF reports under:

```text
reports/execution-YYYY-MM-DD_HHMMSS-entire-scp/
```

## Complete SCP Regression

Run the client-visible sequential regression with one command:

```powershell
npm.cmd run test:scp:regression:chrome
```

The command runs headless in the installed Google Chrome channel, initializes SCP
and `NRVC_Hall` once per browser session, runs the full Project Management Cucumber
regression followed by every Playwright test under `tests/regression`, and generates
consolidated HTML/PDF reports. It continues to the next suite when one fails so the
run captures the complete regression result.

Use `test:scp:regression:chrome:headed` to watch the run or
`test:scp:regression:chrome:demo` for highlighted, slowed-down execution. Every run
is archived under a unique directory:

```text
reports/execution-YYYY-MM-DD_HHMMSS-full-scp-regression-chrome/
  suites/
  screenshots/
  html/
  pdf/
  logs/
  artifacts/
```

Smoke remains separate and reuses eligible existing records. Regression creates
fresh prerequisite records where downstream behavior depends on them.

## Procurement Log Module

Procurement Log is maintained as an independent SCP regression module under
`tests/regression/procurement-log/`. It uses the shared `scpProject` fixture for
login, Supply Chain Planner selection, Management Dashboard readiness, and
`NRVC_Hall` project selection. Procurement-specific interactions remain in
`pages/procurement-log/`; credentials and common navigation are not duplicated
inside the test.

The headed/demo command highlights each interaction, pauses for 600 ms after
each action, and leaves a 1-second visual gap between named test steps. Override
these values with `PROCUREMENT_ACTION_INTERVAL_MS` and
`PROCUREMENT_STEP_WAIT_MS` when a slower demonstration is needed.

## Cucumber Project Management Foundation

The Cucumber flow currently validates this prerequisite journey:

1. Login with the configured Admin account.
2. Open the Supply Chain Planner platform.
3. Select and verify `NRVC_Hall` in the first header dropdown.
4. Open Project Management and verify its navigation is available.

Generated Cucumber outputs are written to:

```text
reports/html/SCP_Project_Management_Report.html
reports/pdf/SCP_Project_Management_Report.pdf
reports/screenshots/
```

Scenario failure evidence includes a screenshot, a query-redacted URL, browser
console errors, and failed network requests. Authentication state files under
`auth/` and generated reports are excluded from source control.

## Current Automated Flow

The first SCP flow automates:

1. Open the Voyage Control SSO login page.
2. Login with `SCP_USERNAME` and `SCP_PASSWORD`.
3. Select `Supply Chain Planner`.
4. Open the SCP management dashboard.
5. Open `Project Management`.
6. Open `First Delivery Inspection Config`.

Set `SCP_ACTION_INTERVAL_MS` in `.env` to control the pause between page operations.

## Adding More Tabs

1. Add the tab name to `SCP_TAB_NAMES` or `test-data/scp-tabs.json`.
2. Create a page object under `pages/tabs/` when the tab has unique actions.
3. Add smoke or regression coverage under `tests/`.

The base classes already provide reusable navigation, login, visibility checks, and highlighted interactions.

## First Delivery Inspection Tests

The [FDI acceptance criteria](docs/FDI_ACCEPTANCE_CRITERIA.md) define organisation
scoping, Responsible-user access and assignment, and Inspector notification rules
for the Procurement Log and FDI Listing page.

The [Inspection Report requirements](docs/FDI_INSPECTION_REPORT_REQUIREMENTS.md)
define project-controlled notes, photo upload and validation, mandatory-photo
submission checks, and linked Spec Document viewing, with 16 acceptance criteria.

The [FDI Settings requirements](docs/FDI_SETTINGS_REQUIREMENTS.md) define the four
project-level checkboxes, Save persistence, default values, and the dependency
between photo uploads and mandatory photos, with seven acceptance criteria.

The [FDI inspector assignment requirements](docs/FDI_INSPECTOR_ASSIGNMENT_REQUIREMENTS.md)
define Project Admin assignment and reassignment, material eligibility, preservation
of saved answers, and transfer of inspector actions, with 11 acceptance criteria.

See [FDI automation coverage and fixtures](docs/FDI_AUTOMATION_COVERAGE.md) for
implemented checks, optional role/project scenarios, and remaining integration coverage.

The [FDI Listing requirements](docs/FDI_LISTING_REQUIREMENTS.md) cover the base
lifecycle, supplier visibility, inclusive delivery-date filtering and Procore Sync.
The [Project Setup Wizard requirements](docs/PROJECT_SETUP_WIZARD_REQUIREMENTS.md)
define the nine-step setup and its four new reference-data steps.
See [wizard automation setup](docs/PROJECT_SETUP_WIZARD_AUTOMATION.md) for the
dedicated-project prerequisites and current validation limits.
The [FDI and wizard validation results](docs/SCP_FDI_WIZARD_VALIDATION_RESULTS.md)
record passed checks, deployed-UI differences and tests awaiting integration fixtures.

The read-only list-filter regression can run against existing inspection records.
`test:fdi-tab:report` runs the First Delivery Inspection tab alone in Chrome,
covering list states, completed-report viewing, and individual/combined filters.
`test:fdi-flow:report` runs the fresh Material/Supplier/Procurement lifecycle and
then validates the generated FDI assignment and submission journey. Smoke can use
`SCP_FDI_SMOKE_SUBMITTAL`, but otherwise selects an eligible existing record and
skips cleanly when none is available.
The regression test enables its required FDI Settings and restores the original
configuration afterward. It creates its own photo files and triggers provider
sync once for its completed record.
