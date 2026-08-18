# Automation Guide

This project contains Playwright automation for Voyage Control in Google Chrome.
The full-application command reuses one authenticated Chrome session across booking
creation and lifecycle actions, Booking List, Calendar, Analytics, Equipment
Management, User Management, My Account, Notification Preferences, and My
Organization.

## Main Commands

```powershell
npm run test:modules
npm run test:suite -- --env staging --suite smoke
npm run test:suite -- --env staging --suite smoke --module project-management
npm run test:suite -- --env staging --suite regression --module booking
npm run test:suite -- --env uat --suite regression --headless --no-open
npm run test:smoke
npm run test:regression
npm run test:complete
npm run test:complete:safe
npm run automate:full-application
npm run automate:booking-creations
npm run automate:analytics
npm run automate:environment-reports
npm run automate:project-management-chrome
npm run automate:equipment-management
npm run automate:user-management
npm run automate:notification-chrome
npm run automate:booking-list-exports
```

Use the `:headless` variants for unattended runs where available.
The module-aware runner accepts `--env`, `--suite`, `--module`, `--grep`,
`--headless`, and `--no-open`.

Examples:

```powershell
# Staging -> Project Management -> Smoke
npm run test:suite -- --env staging --suite smoke --module project-management

# UAT -> Booking -> Regression
npm run test:suite -- --env uat --suite regression --module booking

# Selected tests by title or tag
npm run test:suite -- --suite smoke --module calendar --grep "@calendar-view"
```

Environment defaults are loaded from `config/environments/staging.json` or
`config/environments/uat.json`, then credentials can be supplied from `.env`,
`.env.staging`, `.env.uat`, or direct process variables. Direct process variables
take precedence for one-off overrides.

`test:complete:safe` runs the catalog, safe Cucumber navigation, and role-based
navigation checks without booking creation or data-changing functional flows.
`test:complete` runs the safe checks first, then the dynamic booking approval
matrix, full application flow, and Playwright smoke/regression suites. It
continues after failures and writes `reports/complete-automation-flow-latest.html`
with the execution order and failed blocks.

`automate:booking-creations` creates Delivery, Recurring, Multi-Vehicle, and
Resource-Only bookings in one Chrome session, then stops before lifecycle,
filter, Analytics, Equipment, and administration flows.
`automate:dynamic-booking-approval` discovers the visible booking types, creates
each available booking type, and validates Automatic Approvals using Project
Admin and Project Owner logins. Configure Project Owner with
`PROJECT_OWNER_EMAIL`/`PROJECT_OWNER_PASSWORD` or
`ROLE_PROJECT_OWNER_EMAIL`/`ROLE_PROJECT_OWNER_PASSWORD`; Super Admin is not used
for this switch because the application exposes it only to project-level admin
or owner roles.
`automate:full-application` continues after an individual failure so that later
application areas are still exercised, then returns a failing exit code when any
recorded step failed. A JSON report is written under `test-results/`, and the HTML
automation dashboard is regenerated at the end of the run.

## Full Regression Requirement

Full regression must always start from Project Details setup. The required order is:

1. Create or verify the new access point, resource, and vehicle assignment in Project Details.
2. Use the newly created access point, resource, and vehicle for any new bookings.
3. After Project Details setup, open Vehicle Emissions and create an Add Vehicle Emission record for the newly added vehicle/name. Select a fuel type, enter miles/Km between 5 and 15, enter emission factor between 0.1 and 5, and submit.
4. Create an Add Equipment record with any equipment name, one category from the dropdown, any brand and model, a fuel type, and emission factor between 0.1 and 5.
5. Create the new booking only after those setup records are saved.

The Analytics flow validates Vehicle Emission and Equipment Emission labels
against the Project Details Country UOM configuration, using US units when
Country UOM is blank.
The full-application runner accepts `--skip-analytics` when you want to omit
the Analytics validation from a broad run.
The full-application runner also accepts `--skip-equipment-management` when you
want to omit the Equipment Management upload/create/delete flow from a broad run.
Other optional area switches are:

```text
--skip-booking-flows
--skip-filter
--skip-booking-list-validation
--skip-calendar
--skip-user-management
--skip-my-account
--skip-notification-preferences
--skip-my-organization
```

For example:

```powershell
node run-full-application.js --fast --continue-on-failure --skip-user-management
```

The full runner changes staging data: it creates bookings and equipment usage,
invites users, updates account preferences, enables notification preferences, and
updates an editable organization user role. Use the skip switches when those
mutations are not appropriate for the selected environment or login role.

## Active Areas

```text
playwright.config.js
run-full-application.js
fixtures/baseTest.js
pages/
scripts/
tests/smoke/
tests/regression/
utils/
```

## Cleanup Requirement

Framework cleanup must be audit-first and must not break existing automation
flows. Before removing files, folders, duplicate reports, obsolete utilities,
redundant test data, or duplicate code, confirm that the item is not required by
Smoke, Regression, module-wise execution, Cucumber documentation, environment
configuration, HTML reporting, POM classes, reusable components, fixtures, or
helpers.

Detailed cleanup rules are maintained in:

```text
docs/FRAMEWORK_CLEANUP_REQUIREMENT.md
```

## Generated Output

Automation output is generated under these folders and can be cleaned when no
longer needed:

```text
reports/
screenshots/
test-results/
PDF download/
```

Keep `auth.json` only when you want to reuse the current logged-in browser
session.
