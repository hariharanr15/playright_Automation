# Entire Application Module-wise Cucumber Document

This document explains the complete Construction Delivery application in Cucumber/Bdd format, module by module. It is written so QA, business users, and automation engineers can clearly understand what each module flow does.

Each module contains:

- Feature purpose
- Preconditions
- Test data
- Smoke scenarios
- Regression scenarios
- Negative scenarios
- Expected results
- Related page objects and automation files

## Common Background

Use this background for all browser-executed module features unless a module requires a different user role.

```gherkin
Background:
  Given I open the selected environment
  And I log in to the Construction Delivery application with configured credentials
  And I select the configured Construction Delivery project
```

Environment data comes from:

```text
config/environments/staging.json
config/environments/uat.json
.env
.env.staging
.env.uat
```

## Mandatory Complete Application Execution Order

Full-application Smoke and Regression must always run in this order:

1. Log in and navigate to the selected project home page.
2. Configure and validate all Project Management, Global Settings, and Super Admin information.
3. Complete Environment Settings and Equipment Management configurations.
4. Navigate to User Management and automate all functional flows.
5. Navigate to Booking List and validate all related functions.
6. Create and validate all available booking types, including positive and negative flows.
7. Validate existing scheduling, analytics, and reporting modules that are already part of the framework: Calendar, Analytics, and Environment Reports.
8. Finally validate the top-right Profile menu: My Account, My Organisation, Notification Preferences, and Logout.

Module-wise execution may run independently only when a module is specifically selected.

## Module 1: Login and Project Selection

Feature purpose:
Validate that the user can access the correct environment, log in, select the Construction Delivery platform, and open the configured project/location.

Preconditions:
- User credentials exist for the selected environment.
- User has access to the configured project.
- Project ID and project name are configured.

Test data:
- `VC_EMAIL`
- `VC_PASSWORD`
- `BASE_URL`
- `APP_URL`
- `PROJECT_ID`
- `PROJECT_NAME`

Smoke scenarios:

```gherkin
@smoke @login @project_selection @positive @environment_based
Feature: Login and Project Selection

  Scenario: User logs in and opens configured project
    Given I open the selected environment
    When I enter valid login credentials
    And I submit the login form
    And I select the Construction Delivery platform if required
    And I select the configured project
    Then the project dashboard should be displayed
    And the Booking menu should be available
```

Regression scenarios:

```gherkin
@regression @login @project_selection @positive
Scenario: Protected route redirects unauthenticated user to login and returns after login
  Given I open a protected project URL without a valid session
  When I log in with valid credentials
  Then I should be redirected back to the requested project area

@regression @login @session @positive
Scenario: Existing auth state is reused only for the configured user
  Given a saved authentication state exists
  When the automation starts for the configured user
  Then the saved session should be reused only if it belongs to the configured email
```

Negative scenarios:

```gherkin
@negative @login @mandatory_field_validation
Scenario: Login fails when credentials are blank
  Given I open the login page
  When I submit the login form without email and password
  Then mandatory field validation should be displayed

@negative @login @invalid_input
Scenario Outline: Login fails for invalid credentials
  Given I open the login page
  When I enter "<email>" and "<password>"
  And I submit the login form
  Then a clear login error message should be displayed

  Examples:
    | email              | password       |
    | invalid-email      | validPassword  |
    | unknown@test.com   | wrongPassword  |
    | valid@test.com     | wrongPassword  |

@negative @login @session_expiry
Scenario: Expired session redirects user to login
  Given my session is expired
  When I open a protected project URL
  Then I should be redirected to the login page
  And I should be able to log in again
```

Expected results:
- User can log in with valid credentials.
- Invalid login attempts show clear errors.
- Expired sessions recover through login.

Related files:
- `features/smoke/application/application-navigation-smoke.feature`
- `tests/support/test-base.js`
- `pages/booking/dashboard.page.js`
- `pages/booking/user-management.page.js`

## Module 2: Booking Creation

Feature purpose:
Validate creation of Delivery, Recurring, Multi-Vehicle, and Resource-only bookings.

Preconditions:
- User has permission to create bookings.
- Project has access points, resources, vehicles, and available booking slots.
- Project Management setup is completed before full regression.

Test data:
- Booking type
- Access point
- Resource
- Vehicle
- Booking date
- Booking time
- Driver/vehicle/details fields
- Additional details where required

Smoke scenarios:

```gherkin
@smoke @booking_creation @positive
Feature: Booking Creation

  Background:
    Given I open the Booking List for the configured project

  Scenario: Delivery booking reaches time-slot selection
    When I click New Booking
    And I select Delivery booking type
    And I complete Scheduling Information
    And I select the first available booking date
    And I select the first available booking time
    Then the booking flow should move to the next valid state
```

Regression scenarios:

```gherkin
@regression @booking_creation @positive
Scenario Outline: User creates supported booking types
  Given Project Management setup data is available
  And I open the Booking List for the configured project
  When I create a "<booking type>" booking with valid data
  Then the booking should be submitted successfully
  And the booking reference should be captured when available

  Examples:
    | booking type   |
    | Delivery       |
    | Recurring      |
    | Multi-Vehicle  |
    | Resource-only  |
```

Negative scenarios:

```gherkin
@negative @booking_creation @mandatory_field_validation
Scenario: Booking cannot continue when mandatory scheduling fields are missing
  Given I start a new booking
  When I leave required scheduling fields blank
  And I click Next
  Then mandatory field validation should be displayed

@negative @booking_creation @invalid_input @boundary_value
Scenario Outline: Booking rejects invalid or boundary values
  Given I start a new booking
  When I enter invalid booking data for "<field>"
  Then the system should show a clear validation message

  Examples:
    | field             |
    | booking date      |
    | booking time      |
    | vehicle quantity  |
    | driver details    |
    | access point      |

@negative @booking_creation @role_based @unauthorized_access
Scenario: Restricted user cannot create booking
  Given I log in as a restricted project user
  When I open Booking List
  Then New Booking should be hidden or disabled

@negative @booking_creation @workflow_transition
Scenario: User cannot skip mandatory booking workflow steps
  Given I start a new booking
  When I try to move directly to Submit without completing required steps
  Then the workflow should prevent the incorrect transition

@negative @booking_creation @api_server_error @timeout @network_failure
Scenario: Booking creation recovers from submit failure
  Given I complete a booking form
  When the submit request fails or times out
  Then an error message should be displayed
  And the user should remain able to retry or recover
```

Expected results:
- Valid bookings can be created.
- Invalid booking data is blocked.
- Restricted users cannot create bookings.
- Errors do not leave the workflow in a broken state.

Related files:
- `tests/smoke/booking-smoke.spec.js`
- `tests/regression/booking-regression.spec.js`
- `run-full-application.js`
- `pages/booking/delivery.booking.page.js`
- `pages/booking/recurring.booking.page.js`
- `pages/booking/resource-only.booking.page.js`
- `pages/booking/multi-vehicle.booking.page.js`

## Module 3: Booking List and Lifecycle

Feature purpose:
Validate booking search, filters, sorting, status tabs, details view, and lifecycle actions.

Preconditions:
- Booking List contains records.
- At least one editable scheduled booking exists for lifecycle regression.
- User has permission for lifecycle actions.

Test data:
- Booking reference
- Booking status
- Date range
- Filter values
- Editable scheduled booking

Smoke scenarios:

```gherkin
@smoke @booking_list @positive
Feature: Booking List

  Scenario: User reviews Booking List records
    Given I open the Booking List for the configured project
    When I read status tab counts
    And I sort the list by Booking Ref
    And I visit each booking status tab
    And I apply Booking List filters
    Then filtered booking records should be displayed
```

Regression scenarios:

```gherkin
@regression @booking_lifecycle @positive
Scenario: User completes scheduled booking lifecycle
  Given I open Booking List with default filters
  And I select an editable Scheduled booking
  When I check in the booking
  And I check out the booking
  And I reopen the same booking
  And I undo checkout
  And I undo check-in
  And I cancel the booking
  Then the booking lifecycle actions should complete successfully
  And I should return to a stable Booking List
```

Negative scenarios:

```gherkin
@negative @booking_list @invalid_input
Scenario: Unknown booking search shows no-result state
  Given I open Booking List
  When I search for an unknown booking reference
  Then a clear no-result message should be displayed

@negative @booking_list @workflow_transition
Scenario: Invalid lifecycle action is not available for booking status
  Given I open a booking in a status that does not allow check-in
  Then the Check In action should be hidden or disabled

@negative @booking_list @role_based
Scenario: Restricted user cannot perform booking lifecycle actions
  Given I log in as a restricted project user
  When I open booking details
  Then restricted lifecycle actions should not be available

@negative @booking_list @api_server_error @timeout
Scenario: Booking List handles failed list loading
  Given I open Booking List
  When the list API fails or times out
  Then a recoverable error or retry state should be displayed
```

Expected results:
- Booking List records can be reviewed and filtered.
- Lifecycle actions work only when valid.
- Invalid states show clear messages.

Related files:
- `tests/smoke/booking-list-flow.spec.js`
- `tests/regression/booking-list-status.spec.js`
- `tests/regression/booking-regression.spec.js`
- `pages/booking/booking-list.page.js`
- `pages/booking/edit.booking.page.js`
- `pages/booking/filter.page.js`

## Module 4: Calendar

Feature purpose:
Validate Calendar, Resource, and Access Points views with navigation and filters.

Preconditions:
- Calendar module is enabled.
- Project has booking/resource/access point data.

Test data:
- Calendar view
- Resource view
- Access Points view
- Date navigation
- Filter values

Smoke scenarios:

```gherkin
@smoke @calendar @positive
Feature: Calendar

  Scenario: Calendar default state and views are available
    Given I open Calendar for the configured project
    When I verify the default calendar state
    Then All Project Bookings should be selected
    And Calendar view should be available
    And Resource view should be available
    And Access Points view should be available

  Scenario: Calendar navigation and filters work
    Given I open Calendar for the configured project
    When I select Calendar view
    And I navigate Day and Week views
    And I apply Calendar filters
    Then Calendar records should remain visible or show a valid empty state
```

Regression scenarios:

```gherkin
@regression @calendar @positive
Scenario Outline: User validates each Calendar view
  Given I open Calendar for the configured project
  When I open "<view name>" view
  And I navigate previous and next date ranges
  And I apply available filters
  Then the selected Calendar view should update correctly

  Examples:
    | view name     |
    | Calendar      |
    | Resource      |
    | Access Points |
```

Negative scenarios:

```gherkin
@negative @calendar @invalid_input
Scenario: Calendar handles invalid or unavailable date range
  Given I open Calendar
  When I navigate to an unavailable date range
  Then Calendar should show an empty or unavailable state clearly

@negative @calendar @disabled_feature
Scenario: Disabled Calendar view is not accessible
  Given a Calendar view is disabled by configuration
  When I open Calendar
  Then the disabled view should be hidden or unavailable

@negative @calendar @api_server_error @network_failure
Scenario: Calendar handles failed data loading
  Given I open Calendar
  When calendar data fails to load
  Then the page should show a recoverable error message
```

Expected results:
- Calendar views load correctly.
- Navigation and filters update visible data.
- Errors and unavailable states are clear.

Related files:
- `tests/smoke/calendar-smoke.spec.js`
- `tests/regression/calendar-regression.spec.js`
- `pages/booking/calendar.booking.page.js`

## Module 5: Equipment Management

Feature purpose:
Validate equipment list, equipment upload, equipment usage upload, filtering, and equipment master data.

Preconditions:
- User has Equipment Management permission.
- Equipment module is enabled.
- Valid Excel fixtures are available.

Test data:
- Equipment list Excel file
- Equipment usage Excel file
- Equipment name
- Category
- Brand
- Model
- Fuel type
- Emission factor

Smoke scenarios:

```gherkin
@smoke @equipment_management @positive
Feature: Equipment Management

  Scenario: User opens Equipment Management and filters Equipment List
    Given I open Booking List
    When I open Equipment Management
    And I open Equipment List tab
    And I apply recorded Equipment List filters
    Then the Equipment List page should remain visible
```

Regression scenarios:

```gherkin
@regression @equipment_management @positive
Scenario: User uploads and validates equipment data
  Given I open Equipment Management
  When I upload a valid equipment list file
  And I validate uploaded equipment records
  And I upload a valid equipment usage file
  Then equipment usage data should be processed successfully

@regression @equipment_management @positive
Scenario: User creates equipment master data
  Given I open Equipment Master
  When I add equipment with valid category, brand, model, fuel type, and emission factor
  Then the equipment record should be saved and visible
```

Negative scenarios:

```gherkin
@negative @equipment_management @file_upload_validation
Scenario Outline: Invalid equipment upload is rejected
  Given I open Equipment Management upload
  When I upload "<file condition>"
  Then a clear upload validation message should be displayed

  Examples:
    | file condition       |
    | no file              |
    | unsupported file     |
    | oversized file       |
    | invalid template     |
    | missing columns      |
    | duplicate rows       |

@negative @equipment_management @invalid_input @boundary_value
Scenario: Invalid equipment values are rejected
  Given I open Equipment Master
  When I enter invalid equipment data
  Then field-level validation should be displayed

@negative @equipment_management @role_based
Scenario: Restricted user cannot upload or delete equipment
  Given I log in as a restricted user
  When I open Equipment Management
  Then upload and delete actions should be hidden or disabled
```

Expected results:
- Valid equipment files and records are accepted.
- Invalid upload/input data is rejected.
- Restricted roles cannot perform protected actions.

Related files:
- `tests/smoke/equipment-management-smoke.spec.js`
- `tests/regression/equipment-management-functional.spec.js`
- `pages/booking/equipment-management.page.js`
- `fixtures/equipment-management/ListOfEquipment_sample.xlsx`
- `fixtures/equipment-management/Equipment_usage_sample.xlsx`

## Module 6: User Management

Feature purpose:
Validate invite user, user list, user status, filters, role assignment, resend invite, activation, and removal flows.

Preconditions:
- User has User Management permission.
- Organization and role values exist.
- Test emails are safe and isolated.

Test data:
- Generated email
- Organization
- Role
- User status
- User search value

Smoke scenarios:

```gherkin
@smoke @user_management @positive
Feature: User Management

  Scenario: Prepare invite without submitting
    Given I open User Management
    When I open Invite Users popup
    And I enter generated email, organization, and role
    Then the prepared email should be visible
    And Send Invites should not be clicked
```

Regression scenarios:

```gherkin
@regression @user_management @positive
Scenario: User invite and resend workflow is completed
  Given I open User Management
  When I invite a generated user
  And I verify the invited user appears in the list
  And I open row actions
  And I resend invite
  Then invite and resend workflow should complete successfully

@regression @user_management @role_based
Scenario Outline: User list is validated by role and status
  Given I open User Management
  When I filter users by "<role>" and "<status>"
  Then matching users should be displayed correctly

  Examples:
    | role            | status  |
    | Project Admin   | Invited |
    | Project Manager | Active  |
    | View Only User  | Active  |
```

Negative scenarios:

```gherkin
@negative @user_management @mandatory_field_validation
Scenario: Invite form rejects missing mandatory values
  Given I open Invite Users popup
  When I submit without email or role
  Then mandatory field validation should be displayed

@negative @user_management @invalid_input
Scenario: Invite form rejects invalid email
  Given I open Invite Users popup
  When I enter invalid email format
  Then invalid email validation should be displayed

@negative @user_management @duplicate_records
Scenario: Duplicate invite email is rejected
  Given I open Invite Users popup
  When I enter duplicate invite email rows
  Then duplicate email validation should be displayed

@negative @user_management @role_based
Scenario: Restricted user cannot invite or remove users
  Given I log in as restricted user
  When I open User Management
  Then Invite, Edit, Resend, and Remove actions should be restricted
```

Expected results:
- Invite workflow works for authorized users.
- Negative validations prevent bad user data.
- Restricted users cannot perform protected actions.

Related files:
- `features/smoke/user-management/user-management-smoke.feature`
- `tests/smoke/user-management-smoke.spec.js`
- `tests/regression/user-management-functional.spec.js`
- `pages/booking/user-management.page.js`

## Module 7: Project Management

Feature purpose:
Validate project configuration areas required for booking, emissions, equipment, analytics, availability, and global settings.

Preconditions:
- User has Project Admin or required configuration permission.
- Project is editable in the selected environment.
- Configuration changes are isolated or restorable.

Test data:
- Access point
- Resource
- Vehicle assignment
- Vehicle emission
- Equipment master data
- Fuel type
- Emission factor
- Availability values
- UOM configuration

Smoke scenarios:

```gherkin
@smoke @project_management @positive
Feature: Project Management

  Scenario: Review Project Management areas without changing data
    Given I open Project Management
    When I review Project Details
    And I review Environment Setting
    And I review Availability
    And I review Project Settings
    And I review Vehicle Emissions
    And I review Equipment Master
    And I review Global Settings
    And I review Country UOMs
    Then each Project Management area should be ready
    And no project data should be changed
```

Regression scenarios:

```gherkin
@regression @project_management @configuration_based @positive
Scenario: Project setup is completed before booking regression
  Given I open Project Details
  When I create or verify access point
  And I create or verify resource
  And I create or verify vehicle assignment
  And I add Vehicle Emission with valid values
  And I add Equipment Master with valid values
  Then setup data should be available for booking regression

@regression @project_management @configuration_based
Scenario: Project Settings switches are validated
  Given I open Project Settings
  When I review Automatic Approval and Emission Settings switches
  Then the switches should match expected project configuration
```

Negative scenarios:

```gherkin
@negative @project_management @mandatory_field_validation
Scenario: Project details cannot be saved with missing mandatory fields
  Given I open Project Details
  When I clear mandatory project values
  And I save the form
  Then mandatory field validation should be displayed

@negative @project_management @duplicate_records
Scenario Outline: Duplicate setup records are rejected
  Given I open Project Management
  When I create duplicate "<record type>"
  Then duplicate record validation should be displayed

  Examples:
    | record type      |
    | access point     |
    | resource         |
    | vehicle          |
    | vehicle emission |
    | equipment        |

@negative @project_management @invalid_configuration
Scenario: Invalid project configuration is rejected
  Given I open Project Settings
  When I apply invalid configuration values
  Then configuration validation should be displayed

@negative @project_management @role_based
Scenario: Restricted user cannot update project settings
  Given I log in as restricted user
  When I open Project Management
  Then settings save actions should be hidden or disabled
```

Expected results:
- Project setup supports downstream flows.
- Invalid configuration is blocked.
- Restricted users cannot change project settings.

Related files:
- `features/smoke/project-management/project-management-smoke.feature`
- `features/regression/project-management/project-management-regression.feature`
- `tests/smoke/project-management-smoke.spec.js`
- `tests/regression/Project management_EnvironmentSetting.spec.js`
- `tests/regression/project-settings-tab.spec.js`
- `pages/booking/project-settings.page.js`

## Module 8: Analytics

Feature purpose:
Validate analytics reports, emissions views, date filters, search, download, and UOM labels.

Preconditions:
- Analytics module is enabled.
- Emission settings are configured.
- Project has relevant booking/equipment/emission data or valid no-data state.

Test data:
- Date range
- Report section
- Search value
- Expected UOM labels
- Download/export option

Smoke scenarios:

```gherkin
@smoke @analytics @positive
Feature: Analytics

  Scenario: Analytics summary opens
    Given I open Analytics
    When I open Summary Emission
    Then Analytics report content should be visible
```

Regression scenarios:

```gherkin
@regression @analytics @positive
Scenario Outline: Analytics report sections are validated
  Given I open Analytics
  When I open "<analytics section>"
  And I apply a valid date range
  And I validate visible report data
  Then expected UOM labels and report values should be displayed

  Examples:
    | analytics section     |
    | Summary Emission      |
    | Vehicle Emissions     |
    | Equipment Emissions   |

@regression @analytics @download
Scenario: Analytics report can be downloaded
  Given I open Analytics report with valid data
  When I download the report
  Then the report download should complete successfully
```

Negative scenarios:

```gherkin
@negative @analytics @invalid_input
Scenario: Invalid Analytics date range is rejected
  Given I open Analytics
  When I select an invalid date range
  Then date validation should be displayed

@negative @analytics @api_server_error @timeout
Scenario: Analytics handles report loading failure
  Given I open Analytics
  When report data fails to load
  Then a recoverable error message should be displayed

@negative @analytics @disabled_feature
Scenario: Disabled Analytics section is unavailable
  Given an Analytics section is disabled
  When I open Analytics
  Then the disabled section should not be accessible
```

Expected results:
- Analytics reports show correct data and UOM labels.
- Downloads work when data exists.
- Invalid or failed states are handled clearly.

Related files:
- `tests/smoke/analytics-smoke.spec.js`
- `tests/regression/analytics-functional.spec.js`
- `pages/booking/analytics.page.js`

## Module 9: Environment Reports

Feature purpose:
Validate Environment Reports filters, date ranges, report results, no-data states, and downloads.

Preconditions:
- Environment Reports module is enabled.
- User has report access.

Test data:
- Report date range
- Filter values
- Download option

Smoke scenarios:

```gherkin
@smoke @environment_reports @positive
Feature: Environment Reports

  Scenario: Environment Reports page opens
    Given I open Environment Reports
    Then Environment Reports content should be visible
```

Regression scenarios:

```gherkin
@regression @environment_reports @positive
Scenario: User validates Environment Reports with valid date range
  Given I open Environment Reports
  When I apply a valid report date range
  And I generate or review the report
  Then report results or valid no-data state should be displayed

@regression @environment_reports @download
Scenario: User downloads Environment Report
  Given I open Environment Reports with available data
  When I download the report
  Then the report file should be downloaded successfully
```

Negative scenarios:

```gherkin
@negative @environment_reports @invalid_input
Scenario: Invalid report date range is rejected
  Given I open Environment Reports
  When I select an invalid date range
  Then date validation should be displayed

@negative @environment_reports @api_server_error
Scenario: Report service failure is handled
  Given I open Environment Reports
  When the report service fails
  Then an actionable error message should be displayed

@negative @environment_reports @role_based
Scenario: Restricted user cannot download reports
  Given I log in as restricted user
  When I open Environment Reports
  Then report download should be hidden, disabled, or blocked
```

Expected results:
- Valid reports load or show correct no-data state.
- Invalid dates and service failures show clear messages.

Related files:
- `tests/smoke/environment-reports-smoke.spec.js`
- `tests/regression/environment-reports-functional.spec.js`
- `pages/booking/analytics.page.js`

## Module 10: My Account

Feature purpose:
Validate account profile details, preferences, project access, editable fields, and read-only restrictions.

Preconditions:
- User is logged in.
- User account has profile and preference data.

Test data:
- Name
- Phone
- Preference values
- Project access values

Smoke scenarios:

```gherkin
@smoke @my_account @positive
Feature: My Account

  Scenario: My Account page opens
    Given I open My Account
    Then My Details or My Preferences should be visible
```

Regression scenarios:

```gherkin
@regression @my_account @positive
Scenario: User validates account details and preferences
  Given I open My Account
  When I review My Details
  And I review My Preferences
  And I review access information
  Then account information should be displayed correctly

@regression @my_account @positive
Scenario: User updates allowed preference values
  Given I open My Account preferences
  When I update allowed preference values
  Then the updated preferences should be saved or restored as expected
```

Negative scenarios:

```gherkin
@negative @my_account @mandatory_field_validation
Scenario: Account form rejects missing mandatory values
  Given I open My Account details
  When I clear mandatory editable fields
  And I save the form
  Then mandatory validation should be displayed

@negative @my_account @invalid_input @boundary_value
Scenario: Account form rejects invalid profile values
  Given I open My Account details
  When I enter invalid phone or overlong values
  Then field validation should be displayed

@negative @my_account @unauthorized_access
Scenario: Read-only account fields cannot be edited
  Given I open My Account
  When I try to edit read-only identity, organization, role, or access fields
  Then those fields should remain read-only
```

Expected results:
- Account details and preferences are visible.
- Allowed updates work.
- Invalid and read-only updates are blocked.

Related files:
- `tests/smoke/my-account-smoke.spec.js`
- `tests/regression/my-account-functional.spec.js`
- `pages/booking/my-account.page.js`

## Module 11: My Organization

Feature purpose:
Validate organization details, users, search, project-only filter, trade type, and organization role behavior.

Preconditions:
- User belongs to an organization.
- User has permission to view My Organization.

Test data:
- Organization details
- User search text
- Project-only filter value
- Role value
- Trade type value

Smoke scenarios:

```gherkin
@smoke @my_organization @positive
Feature: My Organization

  Scenario: My Organization page opens
    Given I open My Organization
    Then organization details should be visible
```

Regression scenarios:

```gherkin
@regression @my_organization @positive
Scenario: User validates organization details and users
  Given I open My Organization
  When I review organization details
  And I review organization users
  And I search users
  And I apply project-only filter
  Then organization data should be displayed correctly

@regression @my_organization @role_based
Scenario: Organization role behavior is validated
  Given I open My Organization users
  When I review user role values
  Then allowed and restricted role actions should match permissions
```

Negative scenarios:

```gherkin
@negative @my_organization @unauthorized_access
Scenario: Restricted organization fields cannot be edited
  Given I open My Organization
  When I try to edit read-only organization fields
  Then the fields should remain read-only

@negative @my_organization @invalid_input
Scenario: Invalid organization values are rejected
  Given I open editable organization fields
  When I enter invalid address, country, or trade type data
  Then validation should be displayed

@negative @my_organization @role_based
Scenario: Restricted user cannot change organization user roles
  Given I log in as restricted organization user
  When I open My Organization users
  Then role change actions should be hidden or disabled
```

Expected results:
- Organization information is displayed correctly.
- Search and filters work.
- Restricted edits and role changes are blocked.

Related files:
- `tests/smoke/my-organization-smoke.spec.js`
- `tests/regression/my-organization-functional.spec.js`
- `pages/booking/my-organization.page.js`

## Module 12: Notification Preferences

Feature purpose:
Validate email, mobile, push, browser permission states, preference switches, and reload persistence.

Preconditions:
- User has access to Notification Preferences.
- Notification feature is enabled.
- Browser permission behavior can be controlled or observed.

Test data:
- Notification channel
- Switch state
- Browser permission state

Smoke scenarios:

```gherkin
@smoke @notification_preferences @positive
Feature: Notification Preferences

  Scenario: Notification Preferences page opens
    Given I open Notification Preferences
    Then notification preference content should be visible
```

Regression scenarios:

```gherkin
@regression @notification_preferences @positive
Scenario Outline: Notification preference channel is validated
  Given I open Notification Preferences
  When I review "<channel>" notification settings
  And I update allowed switches
  And I reload the page
  Then the preference state should persist correctly

  Examples:
    | channel |
    | Email   |
    | Mobile  |
    | Push    |

@regression @notification_preferences @permission
Scenario: Browser notification permission states are validated
  Given I open Notification Preferences
  When browser notification permission is allowed, blocked, or prompt
  Then the page should show the correct notification state
```

Negative scenarios:

```gherkin
@negative @notification_preferences @disabled_feature
Scenario: Disabled notification channel cannot be updated
  Given a notification channel is disabled
  When I open Notification Preferences
  Then the disabled channel should be unavailable or read-only

@negative @notification_preferences @permission
Scenario: Browser-denied notification permission is handled
  Given browser notifications are blocked
  When I open Notification Preferences
  Then the page should show a clear browser permission message

@negative @notification_preferences @api_server_error @timeout
Scenario: Preference save failure is recoverable
  Given I update a notification preference
  When the save request fails or times out
  Then a clear error message should be displayed
  And the previous preference state should be preserved or recoverable
```

Expected results:
- Notification preferences can be reviewed and updated where allowed.
- Disabled channels and denied permissions are handled clearly.
- Preference state persists after reload.

Related files:
- `tests/smoke/notification-preferences-smoke.spec.js`
- `tests/regression/notification-status-matrix.spec.js`
- `pages/booking/notification-preference.page.js`

## Module 13: Super Admin and Global Settings

Feature purpose:
Validate high-permission project creation and global configuration behavior.

Preconditions:
- Super Admin credentials are available.
- Environment allows configuration testing.
- Data changes are isolated or restorable.

Test data:
- Project name
- Project configuration
- Global settings values
- Role/permission users

Smoke scenarios:

```gherkin
@smoke @super_admin @documentation-only
Feature: Super Admin

  Scenario: Super Admin smoke is documented but not run by default
    Given Super Admin flows are high-permission and configuration-sensitive
    Then they should run only in approved environments with isolated data
```

Regression scenarios:

```gherkin
@regression @super_admin @configuration_based
Scenario: Super Admin validates project and global configuration
  Given I log in as Super Admin
  When I open Super Admin or Global Settings
  And I validate project creation or configuration switches
  Then Super Admin configuration should behave as expected
```

Negative scenarios:

```gherkin
@negative @super_admin @unauthorized_access
Scenario: Non-super-admin user cannot access Super Admin routes
  Given I log in as non-super-admin user
  When I open Super Admin route directly
  Then access should be denied or redirected

@negative @super_admin @invalid_configuration
Scenario: Invalid Super Admin configuration is rejected
  Given I log in as Super Admin
  When I submit invalid project or global setting values
  Then configuration validation should be displayed
```

Expected results:
- Super Admin flows run only for authorized users.
- Invalid configuration is rejected.
- Restricted users cannot access Super Admin routes.

Related files:
- `tests/regression/VC_Superadmin_Project Creation.spec.js`
- `tests/regression/Project management_EnvironmentSetting.spec.js`
- `pages/booking/project-settings.page.js`

## Complete Application Smoke Suite

Purpose:
Validate that all critical modules open successfully without changing data.

```gherkin
@smoke @complete_application @positive
Feature: Complete Application Smoke Suite

  Scenario: User verifies all main modules are accessible
    Given I log in to the Construction Delivery application
    And I navigate to the selected project home page
    When I validate Project Management information
    And I validate Environment Settings and Equipment Management configuration pages
    And I validate User Management functional entry points
    And I validate Booking List functions
    And I validate available booking type entry points
    And I validate Calendar, Analytics, and Environment Reports
    And I validate the top-right Profile menu
    Then My Account should be available
    And My Organisation should be available
    And Notification Preferences should be available
    And Logout should be available
    And no data-changing action should be performed
```

## Complete Application Regression Suite

Purpose:
Validate the complete functional application workflow in the correct order.

```gherkin
@regression @complete_application @positive @negative @end_to_end
Feature: Complete Application Regression Suite

  Scenario: User validates complete application workflow
    Given I load the selected environment configuration
    And I log in with configured credentials
    And I navigate to the selected project home page
    When I configure and validate all Project Management information
    And I complete Environment Settings and Equipment Management configurations
    And I automate all User Management functional flows
    And I validate Booking List functions
    And I create and validate all available booking types
    And I validate positive and negative booking functional flows
    And I validate Calendar, Analytics, and Environment Reports
    And I validate the top-right Profile menu
    Then My Account functional flow should be validated
    And My Organisation functional flow should be validated
    And Notification Preferences functional flow should be validated
    And Logout should be available for the user
    And all module results should be reported with pass, fail, or skip status
    And failed steps should include failure reason and screenshot
```

Detailed mandatory regression order:

```gherkin
@regression @complete_application @mandatory_order
Scenario Outline: Complete regression executes in mandatory module order
  Given the complete application regression suite is selected
  When execution reaches order "<order>"
  Then the framework should run "<module flow>" before moving to the next order

  Examples:
    | order | module flow                                                        |
    | 1     | Login and selected project home page                               |
    | 2     | Project Management information, Global Settings, and Super Admin configuration |
    | 3     | Environment Settings and Equipment Management configurations        |
    | 4     | User Management functional flows                                   |
    | 5     | Booking List functions                                             |
    | 6     | Available booking type positive and negative flows                 |
    | 7     | Existing Calendar, Analytics, and Environment Reports modules       |
    | 8     | Top-right Profile menu: My Account, My Organisation, Notifications, Logout |
```

Additional module-wise flows may be executed independently:

```gherkin
@regression @module_wise
Scenario Outline: User executes selected module independently
  Given the "<environment>" environment is selected
  And the "<module>" module is selected
  And the "<suite>" suite is selected
  When the automation starts
  Then only the selected module suite should run

  Examples:
    | environment | module             | suite      |
    | Staging     | Project Management | Smoke      |
    | UAT         | Booking List       | Regression |
```

Run examples:

```powershell
npm run test:suite -- --env staging --suite smoke
npm run test:suite -- --env staging --suite regression
npm run test:suite -- --env staging --suite smoke --module project-management
npm run cucumber:smoke -- --env staging --module project-management
```
