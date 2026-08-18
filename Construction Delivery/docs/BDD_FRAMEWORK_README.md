# Construction Delivery BDD Automation Framework

This framework layers Cucumber BDD execution on top of the existing Playwright Page Object Model.
It is designed to extend coverage without changing working application flows, existing tests, or shared test data.

## Current Structure

```text
features/
  smoke/
    application/
    user-management/
  regression/
    application/
  step-definitions/
  support/
components/
test-data/
  smoke/
  regression/
  negative/
  roles/
  configuration/
reports/
  smoke/<timestamp>/
  regression/<timestamp>/
```

Existing Playwright specs remain under `tests/smoke` and `tests/regression`.
Existing page objects remain under `pages/booking`.

## Commands

Run Cucumber smoke:

```bash
npm run cucumber:smoke
```

Run Cucumber smoke headless:

```bash
npm run cucumber:smoke:headless
```

Run a smoke module:

```bash
npm run cucumber:smoke -- --module user-management
```

Run smoke by tag:

```bash
npm run cucumber:smoke -- --tags "@smoke-user-management"
```

Run Cucumber regression inventory:

```bash
npm run cucumber:regression
```

Run negative catalog only:

```bash
npm run cucumber:negative
```

Run positive catalog only:

```bash
npm run cucumber:positive
```

Run last failed Cucumber scenarios:

```bash
npm run cucumber:failed
```

Use `--no-open` when you want to generate the report without opening Chrome.

## Reports

Every `scripts/run-cucumber-suite.js` execution writes timestamped reports:

```text
reports/<suite>/<yyyy-mm-dd_hh-mm-ss>/
  cucumber-report.html
  cucumber-report.json
  rerun.txt
  summary.json
```

The HTML report opens in Chrome by default.

## Execution Model

- Smoke features are browser-driving Cucumber tests for safe critical paths.
- Regression inventory features validate traceability to existing Playwright specs, scripts, page objects, and `Scenario.md`.
- Destructive negative scenarios are cataloged first and should be promoted to browser-driving automation only when isolated data and cleanup are implemented.

## Evidence

On Cucumber scenario failure, hooks attach:

- Screenshot
- Current URL
- Browser console errors
- Network request failures
- Video path when `CUCUMBER_RECORD_VIDEO=true`

## Project Safety

The active project is configured in `.env`:

```text
PROJECT_ID=5ET10000010
PROJECT_NAME=Buckingham Palace
```

Do not switch this back to another project when running Buckingham Palace-only automation.
