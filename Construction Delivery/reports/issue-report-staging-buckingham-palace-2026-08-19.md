# Construction Delivery Issue Report - Staging Buckingham Palace

Generated: 2026-08-19

## Execution Context

- Environment: Staging
- Project: Buckingham Palace
- Project ID: 5ET10000010
- Application URL: https://stg-app.voyagecontrol.com
- Browser: Google Chrome, headed
- Workflow: single-session full application automation
- Source JSON report: `test-results/full-application-report-2026-08-19T05-45-57-785Z.json`
- Dashboard report: `reports/automation-dashboard-latest.html`

## Summary

- Overall status: Passed
- Total validations: 120
- Passed: 120
- Failed: 0
- Skipped: 0
- Start time: 2026-08-19T05:24:35.874Z
- End time: 2026-08-19T05:45:57.785Z
- Duration: 21m 22s

## Functional Issues

No functional failures were reported by the automation run.

The generated JSON contains an empty `failedTestCases` list, and every page/module validation completed with status `passed`.

## Page-Wise Result

| Page / Module | Status | Passed | Failed |
|---|---:|---:|---:|
| Booking Creation | Passed | 71/71 | 0 |
| Booking List | Passed | 13/13 | 0 |
| Calendar | Passed | 1/1 | 0 |
| Analytics | Passed | 1/1 | 0 |
| Equipment Management | Passed | 2/2 | 0 |
| User Management | Passed | 21/21 | 0 |
| My Account | Passed | 3/3 | 0 |
| Notification Preferences | Passed | 2/2 | 0 |
| My Organization | Passed | 2/2 | 0 |

## Booking Creation Evidence

| Booking Type | Status | Booking Reference |
|---|---:|---|
| Delivery | Passed | BK5ET10000004939 |
| Recurring | Passed | BK5ET10000004943 |
| Multi-Vehicle | Passed | BK5ET10000004944 |
| Resource-Only | Passed | BK5ET10000004945 |

## Non-Blocking Browser / Network Observations

These messages appeared in the browser automation console output but did not fail any functional validation:

| Area | Observation | Impact |
|---|---|---|
| Login/app shell | Page error: `Unexpected identifier 'extend'` | Non-blocking in this run; login and project selection succeeded. |
| Static assets | `https://stg-login.voyagecontrol.com/images/favicon.svg` returned HTTP 404 | Cosmetic/static asset issue; no functional failure. |
| Survicate script | `https://survey.survicate.com/.../web_surveys.js` was refused because the response MIME type was `text/html`; request also failed | Third-party script issue; no functional failure. |
| Google Analytics | Multiple `https://www.google-analytics.com/g/collect` requests failed | Analytics/network telemetry issue; no functional failure. |
| Notification Preferences | Chrome reported Push API is unsupported in incognito context | Automation/browser-context limitation; notification preference checks still passed. |
| My Account | Preference persistence warning: selected language/date/time values reloaded as `Select...` | Warning only in this run; the My Account test case still passed. |

## Recommendation

No blocker defects need to be raised from this execution. If the non-blocking observations should be treated as product defects, review the console/network items above separately from the functional automation result.
