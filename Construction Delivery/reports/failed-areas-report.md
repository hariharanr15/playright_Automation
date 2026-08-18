# Construction Delivery Automation - Failed Areas Report

Run: Full Application Automation
Status: Failed
Project: Buckingham Palace
Project ID: 5ET10000010
Result: 110 passed / 116 total
Failed: 6 test cases
Report generated from: `test-results/full-application-report-2026-07-13T13-13-03-612Z.json`
HTML dashboard: `reports/automation-dashboard-latest.html`

## Failed Areas Summary

| Area | Passed / Total | Failed Test Cases |
|---|---:|---|
| Calendar | 0 / 1 | TC-85 |
| Equipment Management | 1 / 2 | TC-88 |
| User Management | 20 / 21 | TC-89 |
| My Account | 1 / 3 | TC-111, TC-112 |
| My Organization | 1 / 2 | TC-116 |

## Failure Details

| Test Case | Area | Test Name | Failure Reason |
|---|---|---|---|
| TC-85 | Calendar | Validate calendar scope, filters, dates, and navigation | Could not find Calendar previous navigation arrow. |
| TC-88 | Equipment Management | Run Equipment List and Usage automation | Search field fill timed out while searching Equipment Management data. |
| TC-89 | User Management | Open authenticated User Management page | Navigation to User Management was interrupted by navigation to Monthly Usage. |
| TC-111 | My Account | Validate and persist account preferences | My Account language preference did not persist. |
| TC-112 | My Account | Validate company, roles, and password dialog | Automation function `myAccount.verifyUpdatePassword` is missing. |
| TC-116 | My Organization | Validate organization users and role controls | Automation function `organization.validateOrAssignUserRole` is missing. |

## Passed Areas

| Area | Passed / Total |
|---|---:|
| Booking Creation | 71 / 71 |
| Booking List | 13 / 13 |
| Analytics | 1 / 1 |
| Notification Preferences | 2 / 2 |
