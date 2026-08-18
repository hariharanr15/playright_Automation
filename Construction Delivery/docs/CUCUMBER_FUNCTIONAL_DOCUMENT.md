# Cucumber Functional Document

This document is the business-readable functional map for the Construction Delivery automation framework. Existing page objects, components, utilities, fixtures, test data, and helper methods remain the source of executable behavior.

For a clear step-by-step explanation of what each module flow does, read:

```text
docs/MODULE_WISE_FUNCTIONAL_FLOWS.md
```

For a complete module-wise Cucumber document with Feature, Scenario,
Scenario Outline, smoke, regression, negative coverage, test data, expected
results, and related page objects for the entire application, read:

```text
docs/ENTIRE_APPLICATION_MODULE_WISE_CUCUMBER_DOCUMENT.md
```

For the coverage table with Module Name, Feature Name, Scenario ID,
Positive/Negative Type, Test Type, Priority, Preconditions, Test Data,
Expected Result, Automation Status, Page Object, and Environment, read:

```text
docs/CUCUMBER_COVERAGE_DOCUMENT.md
```

Framework cleanup must preserve all Cucumber, Smoke, Regression, module-wise,
environment, reporting, POM, component, fixture, helper, and active test-data
files. Cleanup rules are documented here:

```text
docs/FRAMEWORK_CLEANUP_REQUIREMENT.md
```

## Execution Tags

Use these tags consistently in feature files:

```gherkin
@smoke
@regression
@module_name
@positive
@negative
@role_based
@environment_based
@configuration_based
@validation
@documentation-only
```

## Mandatory Negative Coverage

Every module and functional flow must include negative coverage for these categories:

| Category | Required Coverage |
|---|---|
| Mandatory-field validation | Blank required fields, missing selections, unchecked required confirmations |
| Invalid and boundary-value inputs | Invalid format, min/max boundaries, length boundaries, date/time boundaries, unsupported characters |
| Duplicate records | Duplicate users, bookings, equipment, resources, access points, configuration values, or upload rows |
| Unauthorized access | Direct URL access, expired permissions, unauthenticated access, protected downloads |
| Role-based restrictions | Hidden actions, disabled actions, rejected submissions, restricted direct routes for each role |
| Invalid configuration | Disabled features, inconsistent settings, invalid UOM/emission/availability/project setup |
| API or server errors | 4xx/5xx responses, failed save, failed list load, failed export, failed invite/send operations |
| Timeout and network failures | Slow responses, interrupted navigation, offline/network-failed requests, retry and recovery behavior |
| File upload validation | Missing file, unsupported type, oversize file, invalid template, invalid columns, duplicate rows |
| Session expiry | Expired auth state during navigation, form submit, upload, download, and workflow continuation |
| Incorrect workflow transitions | Skipping required steps, invalid status changes, stale record actions, unavailable lifecycle transitions |
| Disabled or unavailable features | Feature toggle off, unavailable booking type, unavailable notification channel, disabled project setting |
| Error-message and recovery validation | Clear error text, no sensitive data leakage, retry/cancel/back behavior, state preservation after failure |

The documentation-only source of truth is:

```text
features/regression/application/application-negative-coverage.feature
```

When a documented negative scenario becomes executable, keep the same category tag and map it to the relevant page object and module runner entry.

## Module-wise Feature Organization

```text
features/smoke/application/
features/smoke/project-management/
features/smoke/user-management/
features/regression/application/
features/regression/project-management/
```

Add new module folders under `features/smoke/<module>/` and `features/regression/<module>/` as automation coverage grows. Reuse existing step definitions before adding new ones.

## Mandatory Complete-suite Order

Complete Application Smoke and Complete Application Regression must run in this order:

1. Login and selected project home page.
2. Project Management information, Global Settings, and Super Admin configuration.
3. Environment Settings and Equipment Management configurations.
4. User Management functional flows.
5. Booking List functions.
6. Available booking type positive and negative flows.
7. Existing Calendar, Analytics, and Environment Reports module coverage.
8. Top-right Profile menu: My Account, My Organisation, Notification Preferences, Logout.

Module-wise execution can run independently only when a module is selected.

## Functional Coverage Matrix

| Module Name | Feature Name | Scenario ID | Scenario Description | Test Type | Priority | Preconditions | Test Data | Expected Result | Automation Status | Related Page Object | Applicable Environment |
|---|---|---:|---|---|---|---|---|---|---|---|---|
| Login / Project Context | Smoke Navigation | SMK-APP-01 | Login and select configured project | Smoke, Positive | P0 | Valid user has project access | `VC_EMAIL`, `VC_PASSWORD`, `PROJECT_ID` | Dashboard and project context load | Automated | `UserManagementPage`, `DashboardPage` | Staging, UAT |
| Booking List | Booking List Smoke | SMK-BL-01 | Open Booking List, validate status tabs, sorting, and filters | Smoke, Positive | P0 | Existing project has bookings | Smoke date/filter data | Booking List remains usable and records are visible | Automated | `BookingListPage`, `Filter` | Staging, UAT |
| Booking Creation | Booking Regression | REG-BKG-01 | Create Delivery, Recurring, Multi-Vehicle, and Resource-only bookings | Regression, E2E, Positive | P0 | Project setup records exist | Access point, resource, vehicle, booking details | Supported bookings can be created | Automated | `DeliveryBookingPage`, `RecurringBookingPage`, `ResourceOnlyBookingPage` | Staging, UAT with isolated data |
| Booking Lifecycle | Booking Regression | REG-BKG-02 | Check in, check out, undo, cancel selected booking | Regression, E2E, Positive | P0 | Editable scheduled booking exists | Existing booking reference | Lifecycle actions complete and list returns to stable state | Automated | `EditBookingPage`, `BookingListPage` | Staging, UAT with isolated data |
| Calendar | Calendar Smoke / Regression | SMK-CAL-01 | Validate Calendar default view, day/week navigation, and filters | Smoke, Regression, Positive | P1 | Calendar feature enabled | Existing booking/resource data | Calendar views and filters render correctly | Automated | `CalendarBookingPage` | Staging, UAT |
| Equipment Management | Equipment Functional | REG-EQM-01 | Validate Equipment List upload and equipment usage workflow | Regression, Positive, Validation | P0 | Equipment module enabled | `fixtures/equipment-management/*.xlsx` | Upload, list, usage, and validation checks complete | Automated | `EquipmentManagementPage` | Staging, UAT with isolated data |
| User Management | User Management Smoke / Functional | SMK-UM-01 | Prepare invite without sending | Smoke, Positive | P0 | User has Invite Users access | Generated email, organization, role | Invite form is ready and no invite is submitted | Automated | `UserManagementPage` | Staging, UAT |
| User Management | User Management Functional | REG-UM-01 | Invite users, validate status, filters, role, resend, and remove flows | Regression, Positive, Negative, Role-based | P0 | Safe test users are available | `config/user-management-sequence.json`, generated emails | User management workflow behaves per role and validation rules | Automated | `UserManagementPage` | Staging, UAT with isolated data |
| Project Management | Project Management Smoke | SMK-PM-01 | Review project details, settings, availability, emissions, equipment, UOMs | Smoke, Positive, Configuration-based | P0 | User has project admin access | Existing configured project | All areas open without data changes | Automated | `ProjectSettingsPage` | Staging, UAT |
| Project Management | Project Management Regression | REG-PM-01 | Create or verify access point, resource, vehicle, emissions, and equipment setup | Regression, Positive, Configuration-based | P0 | Editable project and restoration rules exist | Access point/resource/vehicle/equipment/emissions values | Setup data is ready before booking regression | Automated | `ProjectSettingsPage` | Staging, UAT with isolated data |
| Analytics | Analytics Functional | REG-AN-01 | Validate date range, search, downloads, and UOM labels | Regression, Positive, Configuration-based | P1 | Analytics and emissions settings enabled | Date ranges, expected UOM configuration | Analytics tabs show correct labels, values, and downloads | Automated | `AnalyticsPage` | Staging, UAT |
| Environment Reports | Environment Reports Functional | REG-ER-01 | Validate report filters, date ranges, and no-data handling | Regression, Positive, Negative | P1 | Environment Reports module enabled | Date range data | Valid results or expected no-data message appears | Automated | `AnalyticsPage` | Staging, UAT |
| My Account | My Account Functional | REG-MA-01 | Validate details, preferences, access, and read-only fields | Regression, Positive, Negative | P2 | Logged-in user has account details | Account profile and preference values | Allowed fields update and restricted fields remain read-only | Automated | `MyAccountPage` | Staging, UAT |
| My Organization | My Organization Functional | REG-MO-01 | Validate organization details, users, search, and project-only filter | Regression, Positive, Negative, Role-based | P2 | Organization data exists | Search users, trade type, role data | Organization tabs and filters work by permission | Automated | `MyOrganizationPage` | Staging, UAT |
| Notification Preferences | Notification Matrix | REG-NP-01 | Validate email, mobile, push switches, browser permission states, and persistence | Regression, Positive, Negative, Permission-based | P1 | Notification module enabled | Browser permission matrix | Preferences behave as configured and persist after reload | Automated | `NotificationPreferencePage` | Staging, UAT |
| Super Admin / Global Settings | Super Admin Project Creation | REG-SA-01 | Validate project creation/configuration switches and role restrictions | Regression, Configuration-based, Role-based | P1 | Super Admin user available | Project/configuration values | Super Admin-only actions are available only to allowed roles | Automated | `ProjectSettingsPage` | Staging, UAT with isolated data |

## Scenario Outline Pattern

Use this outline for module documentation or executable expansion:

```gherkin
@regression @module_name @positive @negative @role_based @environment_based
Scenario Outline: <Module> functional flow is validated for the selected environment
  Given I log in to the Construction Delivery application
  And I select the configured Construction Delivery project
  When I complete the "<flow>" flow using "<test data>"
  Then the "<expected result>" should be visible

  Examples:
    | flow | test data | expected result |
    | positive create | valid module data | success confirmation |
    | mandatory validation | missing mandatory fields | validation message |
    | restricted permission | restricted role credentials | access denied or hidden action |
```

## Suite Mapping

| Suite | Command | Purpose |
|---|---|---|
| Module-wise Smoke | `npm run test:suite -- --env staging --suite smoke --module project-management` | Runs only registered smoke specs for one module |
| Complete Smoke | `npm run test:suite -- --env staging --suite smoke` | Runs all Playwright smoke specs |
| Module-wise Regression | `npm run test:suite -- --env staging --suite regression --module booking` | Runs registered regression specs for one module |
| Complete Regression | `npm run test:suite -- --env staging --suite regression` | Runs ordered complete regression starting with Project Management setup |
| Selected Test Cases | `npm run test:suite -- --suite smoke --module calendar --grep "@calendar-view"` | Runs tests matching a title or tag pattern |
| Cucumber Module Smoke | `npm run cucumber:smoke -- --env staging --module project-management` | Runs module-wise Gherkin smoke features |

## Environment Files

Environment profile defaults live in:

```text
config/environments/staging.json
config/environments/uat.json
```

Credentials can be provided through `.env`, `.env.staging`, `.env.uat`, or direct process variables. Direct process variables take precedence.

```text
TEST_ENV=staging
VC_EMAIL=automation.user@example.com
VC_PASSWORD=replace-me
BASE_URL=https://stg-login.voyagecontrol.com
APP_URL=https://stg-app.voyagecontrol.com
PROJECT_ID=5ET10000010
```
