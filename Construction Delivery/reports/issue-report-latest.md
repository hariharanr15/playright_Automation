# Construction Delivery Automation Issue Report

Run timestamp: 2026-08-31T11:51:32.944Z to 2026-08-31T12:18:29.062Z
Environment: Staging
Project ID: 5ET10000010
Browser: Chrome, headed
Workflow: single-session-full-application

## Report Files

- HTML dashboard: reports/automation-dashboard-latest.html
- JSON result: test-results/full-application-report-2026-08-31T12-18-29-062Z.json
- Issue report: reports/issue-report-2026-08-31T12-18-29-062Z.md

## Overall Result

- Final status: failed
- Totals: 123 total, 117 passed, 3 failed, 3 skipped
- Duration: 1616s

## Page Summary

| Page | Status | Total | Passed | Failed | Skipped |
| --- | --- | --- | --- | --- | --- |
| Booking Creation | passed | 71 | 71 | 0 | 0 |
| Booking List | passed | 13 | 13 | 0 | 0 |
| Calendar | passed | 1 | 1 | 0 | 0 |
| Analytics | passed | 1 | 1 | 0 | 0 |
| Equipment Management | passed | 2 | 2 | 0 | 0 |
| User Management | failed | 24 | 20 | 1 | 0 |
| My Account | passed | 3 | 3 | 0 | 0 |
| Notification Preferences | passed | 2 | 2 | 0 | 0 |
| My Organization | failed | 2 | 0 | 2 | 0 |

## Generated Project Management Data

| Data Type | Value |
| --- | --- |
| Access Point | - |
| Access Point ID | - |
| Resource | - |
| Resource Availability Enabled Name | - |
| Vehicle | - |
| Vehicle Fuel Type | - |
| Vehicle Emission Name | - |
| Equipment | - |
| Updated At | - |

## Generated Role Users

| Role | Email | Password |
| --- | --- | --- |
| Project Admin | User18420321071@yopmail.com | Master@15 |
| Project User | User18520321071@yopmail.com | Master@15 |
| View Only | User18620321071@yopmail.com | Master@15 |

## Booking Flow Results

All booking flows should use the Access Point, Resource, and Vehicle generated for the same automation execution.

| User Role | Booking Type | Status | Booking Reference | Reason |
| --- | --- | --- | --- | --- |
| - | Delivery | passed | BK5ET10000005192 | - |
| - | Recurring | passed | BK5ET10000005202 | - |
| - | Multi-Vehicle | passed | BK5ET10000005203 | - |
| - | Resource-Only | passed | BK5ET10000005204 | - |

## Failed Test Cases

| ID | Page | Flow | Name | Error | Screenshot |
| --- | --- | --- | --- | --- | --- |
| TC-112 | User Management | User Management | Change organization for one completed user account | Change Organization popup did not open for User18420321071@yopmail.com. Visible actions: Invite Sent at 05:44 Mon, 31st August 2026 \| Re-send Invite \| Cancel Invite \| Change Associated Organization | screenshots\full_app_TC-112_2026-08-31T12-15-48-305Z.png |
| TC-118 | My Organization | My Organization | Open and validate My Organization details | locator.waitFor: Timeout 30000ms exceeded.<br>Call log:<br>[2m  - waiting for locator('body') to be visible[22m<br>[2m    63 × locator resolved to hidden <body>…</body>[22m<br> | screenshots\full_app_TC-118_2026-08-31T12-17-28-796Z.png |
| TC-119 | My Organization | My Organization | Validate organization users and role controls | locator.waitFor: Timeout 60000ms exceeded.<br>Call log:<br>[2m  - waiting for getByRole('tab', { name: /Users/i }).first().or(getByRole('button', { name: /^Users$/i }).first()).or(getByText(/^Users$/i).first()) to be visible[22m<br> | screenshots\full_app_TC-119_2026-08-31T12-18-28-948Z.png |

## Failed Matrix Rows

- None


## Skipped Or Blocked Scenarios

| ID | Page | Name | Reason |
| --- | --- | --- | --- |
| TC-107 | User Management | Activate account for User18420321071@yopmail.com | Invitation email was not received in Yopmail for User18420321071@yopmail.com. Account activation skipped so downstream role validation will not use this unactivated credential. |
| TC-109 | User Management | Activate account for User18520321071@yopmail.com | Invitation email was not received in Yopmail for User18520321071@yopmail.com. Account activation skipped so downstream role validation will not use this unactivated credential. |
| TC-111 | User Management | Activate account for User18620321071@yopmail.com | Invitation email was not received in Yopmail for User18620321071@yopmail.com. Account activation skipped so downstream role validation will not use this unactivated credential. |
| TC-107 | User Management | Activate account for User18420321071@yopmail.com | Invitation email was not received in Yopmail for User18420321071@yopmail.com. Account activation skipped so downstream role validation will not use this unactivated credential. |
| TC-109 | User Management | Activate account for User18520321071@yopmail.com | Invitation email was not received in Yopmail for User18520321071@yopmail.com. Account activation skipped so downstream role validation will not use this unactivated credential. |
| TC-111 | User Management | Activate account for User18620321071@yopmail.com | Invitation email was not received in Yopmail for User18620321071@yopmail.com. Account activation skipped so downstream role validation will not use this unactivated credential. |

## Recent HTTP Errors

| Status | Method | URL |
| --- | --- | --- |
| 500 | GET | https://stg-app.voyagecontrol.com/api/v1/bookings/list/?bookings=project&start_date=NaN-NaN-NaN&end_date=2026-10-01&project=5ET10000010&site_id=10&page=1&pageSize=25 |
| 500 | GET | https://stg-app.voyagecontrol.com/api/v1/bookings/list/?bookings=project&start_date=NaN-NaN-NaN&end_date=NaN-NaN-NaN&project=5ET10000010&site_id=10&page=1&pageSize=25 |
| 500 | GET | https://stg-app.voyagecontrol.com/api/v1/bookings/list/?bookings=project&start_date=NaN-NaN-NaN&end_date=NaN-NaN-NaN&project=5ET10000010&site_id=10&page=1&pageSize=25 |
| 500 | GET | https://stg-app.voyagecontrol.com/api/v1/bookings/list/?bookings=project&start_date=NaN-NaN-NaN&end_date=NaN-NaN-NaN&project=5ET10000010&site_id=10&page=1&pageSize=25 |
| 500 | GET | https://stg-app.voyagecontrol.com/api/v1/equipments/equipment-registry/?page=1&pageSize=5000&order_by=id&startDate=NaN-NaN-NaN&endDate=2026-08-31&region=1&project=5ET10000010&site=10&project=5ET10000010 |
| 500 | GET | https://stg-app.voyagecontrol.com/api/v1/equipments/equipment-registry/?page=1&pageSize=5000&order_by=id&startDate=NaN-NaN-NaN&endDate=NaN-NaN-NaN&region=1&project=5ET10000010&site=10&project=5ET10000010 |
| 500 | GET | https://stg-app.voyagecontrol.com/api/v1/equipments/equipment-registry/?page=1&pageSize=5000&order_by=id&search=VC+Auto+Make+50439229-01&startDate=NaN-NaN-NaN&endDate=NaN-NaN-NaN&region=1&project=5ET10000010&site=10&project=5ET10000010 |
| 500 | GET | https://stg-app.voyagecontrol.com/api/v1/equipments/equipment-registry/?page=1&pageSize=5000&order_by=id&startDate=NaN-NaN-NaN&endDate=NaN-NaN-NaN&region=1&project=5ET10000010&site=10&project=5ET10000010 |
| 400 | POST | https://stg-app.voyagecontrol.com/api/v1/equipments/monthly-usage/?region=1&project=5ET10000010&project=5ET10000010 |
| 400 | GET | https://stg-app.voyagecontrol.com/api/v1/users/minimal/?email=user18420321071%40yopmail.com&region=1&project=5ET10000010 |
| 400 | GET | https://stg-app.voyagecontrol.com/api/v1/users/minimal/?email=user18520321071%40yopmail.com&region=1&project=5ET10000010 |
| 400 | GET | https://stg-app.voyagecontrol.com/api/v1/users/minimal/?email=user18620321071%40yopmail.com&region=1&project=5ET10000010 |

## Notes

- External analytics, survey script, favicon, and Chrome notification limitations may appear in the browser console and are not counted as application failures unless a test assertion failed.
