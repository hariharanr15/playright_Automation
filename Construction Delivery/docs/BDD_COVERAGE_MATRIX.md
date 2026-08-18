# BDD Coverage Matrix

This matrix describes the current Construction Delivery automation coverage.

Status meanings:

- `Automated` - implemented in existing Playwright/Cucumber code and executable.
- `Smoke` - covered by safe Cucumber smoke flow.
- `Cataloged` - documented and traceable, but not claimed as browser-executed Cucumber automation.
- `Needs isolated data` - should be automated only with dedicated data and cleanup.

| Module | Smoke | Regression | Negative | Primary Source |
|---|---|---|---|---|
| Login / Project Context | Smoke | Automated | Cataloged | `features/smoke/application/application-navigation-smoke.feature` |
| Dashboard | Smoke | Automated | Cataloged | `pages/booking/dashboard.page.js` |
| Booking Creation | Smoke | Automated | Needs isolated data | `run-full-application.js`, `tests/regression/booking-regression.spec.js` |
| Booking List | Smoke | Automated | Cataloged | `tests/regression/booking-list-status.spec.js` |
| Calendar | Smoke | Automated | Cataloged | `pages/booking/calendar.booking.page.js` |
| Equipment Management | Smoke | Automated | Needs isolated data | `tests/regression/equipment-management-functional.spec.js` |
| User Management | Smoke | Automated | Needs isolated data | `tests/regression/user-management-functional.spec.js` |
| Project Management | Smoke | Automated | Needs configuration restoration | `tests/regression/Project management_EnvironmentSetting.spec.js` |
| Analytics | Smoke | Automated | Cataloged | `tests/regression/analytics-functional.spec.js` |
| Environment Reports | Smoke | Automated | Cataloged | `tests/regression/environment-reports-functional.spec.js` |
| My Account | Smoke | Automated | Cataloged | `tests/regression/my-account-functional.spec.js` |
| My Organization | Smoke | Automated | Cataloged | `tests/regression/my-organization-functional.spec.js` |
| Notification Preferences | Smoke | Automated | Cataloged | `tests/regression/notification-status-matrix.spec.js` |
| Super Admin | Cataloged | Automated | Needs configuration restoration | `tests/regression/VC_Superadmin_Project Creation.spec.js` |
| Global Settings | Cataloged | Automated | Needs configuration restoration | `tests/regression/Project management_EnvironmentSetting.spec.js` |

## Current Implementation Notes

- Cucumber smoke is available under `features/smoke`.
- Cucumber regression inventory is available under `features/regression`.
- Full existing UI automation remains available through Playwright and Chrome automation scripts.
- Negative scenarios from `Scenario.md` are traceable in Cucumber but should be implemented gradually with isolated data and cleanup.

## Known Automation Gaps From Latest Buckingham Palace Run

The latest full-application Chrome run completed with `110/116` passing.
Current failed areas are tracked in `reports/failed-areas-report.md`.
