# Module-wise Functional Flows

This document explains, in plain business language, what the automation does in each module. Use this file when you want to understand the functional flow before reading the Cucumber feature files or Playwright specs.

## Login and Project Selection

Purpose:
Validate that the automation user can log in, select the Construction Delivery application, and open the configured project/location.

Smoke flow:
1. Open the selected environment login URL.
2. Enter the configured email and password.
3. Submit the login form.
4. Select the Construction Delivery platform if the platform chooser appears.
5. Select the configured project/location.
6. Confirm the dashboard or Booking menu is visible.

Regression flow:
1. Validate login works with reusable auth/session handling.
2. Validate redirected login is handled when a protected page is opened directly.
3. Reuse saved auth state only when it matches the configured user.
4. Confirm each test can start independently from a valid authenticated state.

Negative flow:
1. Try blank email and password.
2. Try invalid email format.
3. Try wrong password.
4. Try expired session while opening a protected page.
5. Try direct URL access without authentication.
6. Validate clear login or access error messages and recovery.

Related files:
`features/smoke/application/application-navigation-smoke.feature`
`tests/support/test-base.js`
`pages/booking/dashboard.page.js`
`pages/booking/user-management.page.js`

## Booking Creation

Purpose:
Validate that supported booking types can be started, filled, scheduled, and submitted using configured project data.

Smoke flow:
1. Open the Booking List.
2. Click New Booking.
3. Select Delivery booking type.
4. Complete Scheduling Information.
5. Select the first available booking date.
6. Select an available booking time.
7. Confirm the booking flow reaches the expected booking details or time-slot state.

Regression flow:
1. Create or verify Project Management setup data first: access point, resource, and vehicle.
2. Create a Delivery booking.
3. Create a Recurring booking.
4. Create a Multi-Vehicle booking.
5. Create a Resource-only booking.
6. Complete mandatory booking details and additional details where required.
7. Submit the booking.
8. Capture the created booking reference when available.
9. Validate the booking appears in the list or reaches the expected submitted state.

Negative flow:
1. Submit booking without mandatory scheduling fields.
2. Use invalid or unavailable booking date/time.
3. Use invalid quantity, vehicle, resource, or access point values.
4. Try unavailable booking types when disabled by configuration.
5. Try booking creation with a restricted role.
6. Simulate session expiry before submit.
7. Validate API/server error, timeout, and recovery messages.
8. Validate incorrect workflow transitions, such as skipping required steps.

Related files:
`tests/smoke/booking-smoke.spec.js`
`tests/regression/booking-regression.spec.js`
`run-full-application.js`
`pages/booking/delivery.booking.page.js`
`pages/booking/recurring.booking.page.js`
`pages/booking/resource-only.booking.page.js`
`pages/booking/multi-vehicle.booking.page.js`

## Booking List and Booking Lifecycle

Purpose:
Validate that users can review, sort, filter, search, open, and perform allowed lifecycle actions on bookings.

Smoke flow:
1. Open Booking List.
2. Confirm the New Booking button is visible.
3. Read Booking List status tab counts.
4. Sort Booking List by Booking Ref.
5. Visit each Booking List status tab.
6. Apply recorded Booking List filters.
7. Confirm records are still visible after filtering.

Regression flow:
1. Open Booking List.
2. Apply default filters and date range.
3. Find an editable Scheduled booking.
4. Open booking details.
5. Check in the booking.
6. Check out the booking.
7. Return to the list and reopen the same booking.
8. Undo checkout.
9. Undo check-in.
10. Cancel the booking.
11. Return to Booking List and confirm the list is stable.

Negative flow:
1. Search with unknown booking reference.
2. Apply filters that return no results.
3. Use invalid date range or boundary dates.
4. Try unavailable lifecycle actions for the current status.
5. Try restricted actions with unauthorized roles.
6. Validate stale booking action handling.
7. Validate failed list API, failed details API, timeout, and retry/recovery messages.

Related files:
`tests/smoke/booking-list-flow.spec.js`
`tests/regression/booking-list-status.spec.js`
`tests/regression/booking-regression.spec.js`
`pages/booking/booking-list.page.js`
`pages/booking/edit.booking.page.js`
`pages/booking/filter.page.js`

## Calendar

Purpose:
Validate Calendar module visibility, default state, available views, navigation, and filters.

Smoke flow:
1. Open Calendar.
2. Verify default calendar state.
3. Confirm All Project Bookings is selected by default.
4. Confirm Calendar, Resource, and Access Points views are available.
5. Open Calendar view.
6. Validate day/week navigation.
7. Apply Calendar filters.

Regression flow:
1. Validate Calendar view.
2. Validate Resource view.
3. Validate Access Points view.
4. Validate previous and next navigation.
5. Validate filters preserve expected records.
6. Validate generated calendar report evidence.

Negative flow:
1. Try invalid date navigation.
2. Select unavailable resources or access points.
3. Validate no-booking or no-resource state.
4. Validate restricted role access.
5. Validate Calendar API/server errors.
6. Validate timeout, network failure, and recovery messages.

Related files:
`tests/smoke/calendar-smoke.spec.js`
`tests/regression/calendar-regression.spec.js`
`pages/booking/calendar.booking.page.js`

## Equipment Management

Purpose:
Validate Equipment Management list, filters, upload, usage, and equipment data workflows.

Smoke flow:
1. Open Booking List.
2. Open Equipment Management.
3. Open Equipment List child tab.
4. Apply recorded Equipment List filters.
5. Confirm the Equipment List page remains usable.

Regression flow:
1. Open Equipment Management.
2. Upload valid equipment list file.
3. Validate equipment records appear in the list.
4. Upload valid equipment usage file.
5. Validate usage workflow and generated evidence.
6. Create or validate equipment master data used by analytics/emissions checks.
7. Delete or clean up automation-created data when supported.

Negative flow:
1. Upload no file.
2. Upload unsupported file type.
3. Upload invalid template or missing columns.
4. Upload duplicate equipment rows.
5. Enter invalid category, brand, model, fuel type, or emission factor.
6. Try upload or delete with restricted role.
7. Validate upload API/server errors, timeout, and recovery.

Related files:
`tests/smoke/equipment-management-smoke.spec.js`
`tests/regression/equipment-management-functional.spec.js`
`pages/booking/equipment-management.page.js`
`fixtures/equipment-management/ListOfEquipment_sample.xlsx`
`fixtures/equipment-management/Equipment_usage_sample.xlsx`

## User Management

Purpose:
Validate Invite Users, user status, search/filter, role assignment, resend invite, activation, and removal flows.

Smoke flow:
1. Log in and select the configured project.
2. Open User Management.
3. Open Invite Users popup.
4. Enter generated email, organization, and role.
5. Confirm the prepared email is visible.
6. Stop before clicking Send Invites.

Regression flow:
1. Open User Management.
2. Invite one or more generated users.
3. Validate invited user appears in the list.
4. Validate user status.
5. Search and filter users.
6. Resend invite for invited users.
7. Activate prepared users when configured.
8. Validate role and organization values.
9. Remove automation-created users from the project when supported.

Negative flow:
1. Submit empty Invite Users form.
2. Enter invalid email.
3. Enter duplicate invite email.
4. Omit role or organization.
5. Try restricted Invite/Edit/Remove actions with unauthorized role.
6. Validate invite API/server errors.
7. Validate timeout, session expiry, and recovery messages.

Related files:
`features/smoke/user-management/user-management-smoke.feature`
`tests/smoke/user-management-smoke.spec.js`
`tests/regression/user-management-functional.spec.js`
`pages/booking/user-management.page.js`
`config/user-management-sequence.json`

## Project Management

Purpose:
Validate project configuration areas that support downstream booking, analytics, emissions, equipment, availability, and global settings flows.

Smoke flow:
1. Log in and select the configured project.
2. Open Project Management.
3. Review Project Details.
4. Review Environment Setting.
5. Review Availability.
6. Review Project Settings.
7. Review Vehicle Emissions.
8. Review Equipment Master.
9. Review Global Settings.
10. Review Country UOMs.
11. Stop without changing project data.

Regression flow:
1. Open Project Details setup.
2. Create or verify a new access point.
3. Create or verify a new resource.
4. Create or verify vehicle assignment.
5. Open Vehicle Emissions.
6. Add Vehicle Emission for the newly added vehicle/name.
7. Select fuel type.
8. Enter miles/Km between 5 and 15.
9. Enter emission factor between 0.1 and 5.
10. Submit Vehicle Emission.
11. Open Equipment Master.
12. Add Equipment with name, category, brand, model, fuel type, and emission factor.
13. Save setup data.
14. Run booking regression only after setup is ready.
15. Validate project settings switches such as Automatic Approval and Emission Settings.

Negative flow:
1. Save project details with missing mandatory fields.
2. Enter invalid address, UOM, availability, or configuration values.
3. Create duplicate access point, resource, vehicle, equipment, or emission record.
4. Try restricted settings with unauthorized roles.
5. Validate disabled feature behavior.
6. Validate invalid emission factor and miles/Km boundaries.
7. Validate save API/server errors, timeout, session expiry, and recovery.

Related files:
`features/smoke/project-management/project-management-smoke.feature`
`features/regression/project-management/project-management-regression.feature`
`tests/smoke/project-management-smoke.spec.js`
`tests/regression/Project management_EnvironmentSetting.spec.js`
`tests/regression/project-settings-tab.spec.js`
`pages/booking/project-settings.page.js`

## Analytics

Purpose:
Validate analytics reports, date ranges, searches, downloads, and UOM/emission labels.

Smoke flow:
1. Log in and select the configured project.
2. Open Analytics.
3. Open Summary Emission.
4. Confirm Analytics content is visible.

Regression flow:
1. Open Analytics.
2. Validate Summary Emission.
3. Validate Vehicle Emissions.
4. Validate Equipment Emissions.
5. Apply date ranges.
6. Search or filter report data.
7. Validate UOM labels from project country/UOM configuration.
8. Validate report download behavior.
9. Capture analytics evidence.

Negative flow:
1. Apply invalid date range.
2. Search unknown value.
3. Validate no-data report state.
4. Validate unit mismatch detection.
5. Try restricted analytics routes.
6. Validate failed report API, failed download, timeout, and recovery messages.

Related files:
`tests/smoke/analytics-smoke.spec.js`
`tests/regression/analytics-functional.spec.js`
`pages/booking/analytics.page.js`

## Environment Reports

Purpose:
Validate Environment Reports date filters, report generation, download/no-data states, and restricted access.

Smoke flow:
1. Log in and select the configured project.
2. Open Environment Reports.
3. Confirm Environment Reports content is visible.

Regression flow:
1. Open Environment Reports.
2. Apply valid report date range.
3. Validate report results or expected no-data state.
4. Validate downloads or export behavior.
5. Confirm report page remains stable after filtering.

Negative flow:
1. Apply invalid date order.
2. Apply date range beyond supported limit.
3. Download with no report records.
4. Try restricted report access.
5. Validate report API/server errors, timeout, network failure, and recovery messages.

Related files:
`tests/smoke/environment-reports-smoke.spec.js`
`tests/regression/environment-reports-functional.spec.js`
`pages/booking/analytics.page.js`

## My Account

Purpose:
Validate account details, preferences, user access, editable fields, and read-only account restrictions.

Smoke flow:
1. Log in.
2. Open My Account.
3. Confirm My Details or My Preferences is visible.

Regression flow:
1. Open My Account.
2. Validate My Details fields.
3. Validate editable preferences.
4. Validate access/project information.
5. Update allowed fields when safe.
6. Confirm updates persist or expected read-only fields remain unchanged.

Negative flow:
1. Submit blank mandatory profile fields.
2. Enter invalid phone or overlong values.
3. Try editing read-only identity, organization, role, or access fields.
4. Validate save API/server errors.
5. Validate timeout, session expiry, and recovery messages.

Related files:
`tests/smoke/my-account-smoke.spec.js`
`tests/regression/my-account-functional.spec.js`
`pages/booking/my-account.page.js`

## My Organization

Purpose:
Validate organization details, users, search, project-only filter, trade type, and role-based organization permissions.

Smoke flow:
1. Log in.
2. Open My Organization.
3. Confirm Organization content is visible.

Regression flow:
1. Open My Organization.
2. Validate organization details.
3. Validate organization user list.
4. Search users.
5. Apply project-only filter.
6. Validate trade type or organization settings when available.
7. Validate role values and allowed organization actions.

Negative flow:
1. Try editing read-only organization name.
2. Submit blank or invalid address fields.
3. Select invalid country or organization values.
4. Try changing roles without permission.
5. Validate duplicate organization/user behavior.
6. Validate API/server errors, timeout, session expiry, and recovery messages.

Related files:
`tests/smoke/my-organization-smoke.spec.js`
`tests/regression/my-organization-functional.spec.js`
`pages/booking/my-organization.page.js`

## Notification Preferences

Purpose:
Validate notification preference switches, browser notification permission states, reload persistence, and channel restrictions.

Smoke flow:
1. Log in.
2. Open Notification Preferences.
3. Confirm Notification Preferences or My Bookings content is visible.

Regression flow:
1. Open Notification Preferences.
2. Validate email notification switches.
3. Validate mobile notification switches.
4. Validate push/browser notification switches.
5. Validate browser permission states.
6. Toggle allowed preferences.
7. Reload and confirm persistence.

Negative flow:
1. Validate browser permission denied state.
2. Validate disabled notification channels.
3. Try unavailable preferences.
4. Validate restricted role access.
5. Validate notification API/server errors.
6. Validate timeout, reload failure, and recovery messages.

Related files:
`tests/smoke/notification-preferences-smoke.spec.js`
`tests/regression/notification-status-matrix.spec.js`
`pages/booking/notification-preference.page.js`

## Super Admin and Global Settings

Purpose:
Validate Super Admin project creation/configuration flows and confirm they are restricted to authorized users.

Smoke flow:
No broad smoke flow is registered for Super Admin because it is high-permission and configuration-sensitive.

Regression flow:
1. Log in as Super Admin user.
2. Open Super Admin or Global Settings route.
3. Validate project creation/configuration screens.
4. Validate configuration switches.
5. Confirm allowed roles can access the flow.
6. Confirm restricted roles cannot access the flow.

Negative flow:
1. Try direct route access as non-super-admin user.
2. Submit invalid project setup values.
3. Create duplicate project/configuration values.
4. Validate disabled configuration behavior.
5. Validate API/server errors, timeout, session expiry, and recovery messages.

Related files:
`tests/regression/VC_Superadmin_Project Creation.spec.js`
`tests/regression/Project management_EnvironmentSetting.spec.js`
`pages/booking/project-settings.page.js`

## Complete Application Flow

Purpose:
Run all major modules in a controlled order and produce a full report.

Flow:
1. Load selected environment profile.
2. Log in with configured credentials.
3. Navigate to the selected project home page.
4. Configure and validate all Project Management, Global Settings, and Super Admin information.
5. Complete Environment Settings and Equipment Management configurations.
6. Navigate to User Management and automate all functional flows.
7. Navigate to Booking List and validate all related functions.
8. Create and validate all available booking types, including positive and negative flows.
9. Validate existing Calendar, Analytics, and Environment Reports modules.
10. Finally validate the top-right Profile menu: My Account, My Organisation, Notification Preferences, and Logout.
11. Continue after individual failures when configured.
12. Generate HTML report with pass, fail, skip, step details, screenshots, and failure reasons.

Related files:
`run-full-application.js`
`scripts/run-complete-automation-flow.js`
`scripts/run-test-suites.js`
`docs/CUCUMBER_FUNCTIONAL_DOCUMENT.md`
