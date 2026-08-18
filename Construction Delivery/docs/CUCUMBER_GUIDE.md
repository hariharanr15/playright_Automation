# Cucumber Framework for Construction Delivery

This project now supports Cucumber feature files on top of the existing Playwright page-object framework.

The goal is to make each automation flow readable as clear business instructions before anyone looks at JavaScript. A feature file should explain:

1. What business area the flow covers.
2. What the automation will do.
3. What the automation will not do.
4. What screen or result confirms success.
5. Which steps are safe dry-runs and which steps can change data.

## Suite Layout

New Cucumber suites are separated by execution purpose:

```text
features/smoke/
features/regression/
```

Smoke features contain safe browser-driving checks for critical paths. Regression inventory features
provide traceability to the existing automated Playwright specs, Chrome automation scripts, page objects,
and documented negative scenarios.

Additional framework docs:

- `docs/BDD_FRAMEWORK_README.md`
- `docs/BDD_COVERAGE_MATRIX.md`
- `docs/CUCUMBER_FUNCTIONAL_DOCUMENT.md`
- `docs/CUCUMBER_COVERAGE_DOCUMENT.md`
- `docs/MODULE_WISE_FUNCTIONAL_FLOWS.md`
- `docs/ENTIRE_APPLICATION_MODULE_WISE_CUCUMBER_DOCUMENT.md`
- `docs/PROJECT_MANAGEMENT_CUCUMBER_DOCUMENT.md`
- `docs/FRAMEWORK_CLEANUP_REQUIREMENT.md`

## Current Features

Feature files:

`features/application-scenario-catalog.feature`

`features/user-management.feature`

`features/construction-delivery.feature`

### Full Application Scenario Catalog

What it does:

1. Documents the full application scenario matrix in Cucumber format.
2. Covers Chrome automation flows, positive page-wise use cases, and negative validation use cases.
3. Links every use case to an existing Playwright spec, automation script, page object, or `Scenario.md`.
4. Validates that referenced source files exist.
5. Validates that referenced `npm run ...` commands are present in `package.json`.

Why it is safe:

- It is tagged `@catalog` and `@documentation-only`.
- It does not open Chrome.
- It does not log in.
- It does not create bookings, upload files, send invites, update settings, or delete records.
- It exists so the Cucumber report shows the complete application instruction coverage.

Coverage groups:

- Dashboard, login, and project context
- Booking List
- Booking creation and booking details
- User Management
- Equipment Management
- Analytics
- Environment Reports
- My Account
- My Organization
- Notification Preferences and browser push
- Project Management
- Dedicated utility flows
- Negative and validation scenarios

### User Management

What it does:

1. Logs in to Construction Delivery.
2. Selects the configured Construction Delivery project/location.
3. Opens User Management from the left navigation.
4. Opens the Invite Users popup.
5. Enters email, organization, and role.
6. Verifies the prepared email is visible.
7. Stops before clicking `Send Invites`.

Why it is safe:

- It does not submit the invite.
- It does not create or activate a user.
- It does not change project access.
- It only confirms that the invite form can be prepared.

### Main Construction Delivery Modules

What it does:

1. Logs in to Construction Delivery.
2. Selects the configured Construction Delivery project/location.
3. Opens each main module in a safe review mode.
4. Verifies a stable screen marker for each module.
5. Confirms no data-changing action was performed.

Why it is safe:

- It does not create bookings.
- It does not upload equipment files.
- It does not edit project settings.
- It does not submit forms.
- It only opens modules and validates stable screen text.

Covered modules:

- Booking List
- Calendar
- Project Management
- User Management
- Equipment Management
- Analytics
- Environment Reports
- My Account
- My Organization
- Notification Preferences

## Run Main Construction Delivery Feature

Headed Chrome:

```bash
npm run cucumber:construction
```

Headless Chrome:

```bash
npm run cucumber:construction:headless
```

## Run Safe Project Management Chrome Automation

Headed Chrome:

```bash
npm run automate:project-management-safe-chrome
```

Headless Chrome:

```bash
npm run automate:project-management-safe-chrome:headless
```

This opens only Project Management, verifies the Project Details screen, and
reviews the main Project Management areas without changing project information,
settings, access points, resources, availability, emissions, or UOM data.

## Run Smoke Suite

Headed Chrome with timestamped HTML report:

```bash
npm run cucumber:smoke
```

Headless:

```bash
npm run cucumber:smoke:headless
```

Run one smoke module:

```bash
npm run cucumber:smoke -- --module user-management
npm run cucumber:smoke -- --env staging --module project-management
```

Run by tag:

```bash
npm run cucumber:smoke -- --tags "@smoke-user-management"
```

## Run Regression Inventory

```bash
npm run cucumber:regression
```

Run only positive inventory:

```bash
npm run cucumber:positive
```

Run only negative inventory:

```bash
npm run cucumber:negative
```

Negative coverage is mandatory for every module and functional flow. The
baseline catalog lives at:

```text
features/regression/application/application-negative-coverage.feature
```

Required negative categories include mandatory-field validation, invalid and
boundary inputs, duplicate records, unauthorized access, role restrictions,
invalid configuration, API/server errors, timeout and network failures, file
upload validation, session expiry, incorrect workflow transitions, disabled or
unavailable features, and error-message recovery validation.

Run failed Cucumber scenarios from the latest rerun file:

```bash
npm run cucumber:failed
```

Use `--no-open` to generate the HTML report without opening Chrome:

```bash
npm run cucumber:regression -- --no-open
```

Run Cucumber with an environment profile:

```bash
npm run cucumber:smoke -- --env staging --module project-management
npm run cucumber:regression -- --env uat --module project-management --no-open
```

The selected profile is loaded from `config/environments/<env>.json`. Credentials
can be kept in `.env.<env>` or supplied as process variables such as `VC_EMAIL`
and `VC_PASSWORD`.

## Run Full Application Scenario Catalog

Documentation-only catalog:

```bash
npm run cucumber:catalog
```

## Run User Management Feature

Headed Chrome:

```bash
npm run cucumber:user-management
```

Headless Chrome:

```bash
npm run cucumber:user-management:headless
```

## Reports

- HTML report: `reports/cucumber-report.html`
- JSON report: `reports/cucumber-report.json`

The suite runner also writes timestamped reports:

- `reports/smoke/<timestamp>/cucumber-report.html`
- `reports/regression/<timestamp>/cucumber-report.html`
- `reports/<suite>/<timestamp>/summary.json`

The timestamped HTML report opens in Chrome by default.

## Safety Default

The included User Management scenario is a dry run. It fills the invite details but does not send an invite.

To intentionally enable invite submission in a scenario that uses `When I send the invite`, set:

```bash
CUCUMBER_SEND_INVITES=1
```

## Folder Layout

- `features/*.feature` - Gherkin business-readable flows
- `features/step-definitions/*.steps.js` - step implementations
- `features/support/world.js` - Playwright browser/page object setup
- `features/support/hooks.js` - scenario setup, teardown, failure screenshots
