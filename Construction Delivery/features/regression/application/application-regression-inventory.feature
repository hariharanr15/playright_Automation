@regression @catalog @documentation-only
Feature: Construction Delivery - Regression Inventory
  Purpose:
  This regression inventory keeps tab-wise traceability between the Cucumber BDD suite,
  existing Playwright automation, standalone Chrome automation flows, and documented
  negative scenarios. It does not change application data.

  Full regression requirement:
  Full regression must always start from the Project Details setup flow before any
  booking creation is attempted. The setup must create or verify a new access point,
  resource, and vehicle assignment, then use those newly created setup records when
  creating new bookings. After Project Details setup is complete, the flow must open
  the Vehicle Emissions tab, click Add Vehicle Emission, create a record for the newly
  added vehicle/name, select a fuel type, enter a miles/Km value between 5 and 15,
  enter an emission factor between 0.1 and 5, and submit the record. The flow must
  then open Add Equipment, create an equipment master record with any equipment name,
  one category from the dropdown, any brand and model, a fuel type, and an emission
  factor between 0.1 and 5. Only after these setup records are saved should the full
  regression create the new booking.

  Background:
    Given the Construction Delivery automation catalog is loaded

  @positive @booking-regression
  Scenario Outline: Positive regression coverage is traceable to an implemented automation source
    Then the "<id>" "<scenario>" use case for "<area>" should be documented with "<coverage>" coverage from "<source>"
    And the catalog command "<command>" should be available when provided

    Examples:
      | id     | area                     | scenario                                      | coverage       | source                                                | command                                  |
      | REG-01 | Booking Creation         | Delivery, recurring, multi-vehicle, and resource bookings | automated-flow | run-full-application.js                              | npm run automate:full-application       |
      | REG-02 | Booking List             | Status counts, sorting, lifecycle actions, and filters    | automated      | tests/regression/booking-list-status.spec.js         | npm run test:regression                 |
      | REG-03 | Equipment Management     | Equipment list upload and usage workflow                  | automated      | tests/regression/equipment-management-functional.spec.js | npm run test:regression              |
      | REG-04 | User Management          | Invite, status, filters, organization change, activation  | automated      | tests/regression/user-management-functional.spec.js   | npm run test:regression                 |
      | REG-05 | Project Management       | Project settings, resources, access points, emissions     | automated      | tests/regression/Project management_EnvironmentSetting.spec.js | npm run test:regression        |
      | REG-06 | Analytics                | Date ranges, UOM labels, search, and download             | automated      | tests/regression/analytics-functional.spec.js         | npm run test:regression                 |
      | REG-07 | Environment Reports      | Report date range and no-data validation                  | automated      | tests/regression/environment-reports-functional.spec.js | npm run test:regression               |
      | REG-08 | My Account               | Details, preferences, access, and read-only fields        | automated      | tests/regression/my-account-functional.spec.js        | npm run test:regression                 |
      | REG-09 | My Organization          | Details, trade type, users, search, and project-only filter | automated    | tests/regression/my-organization-functional.spec.js   | npm run test:regression                 |
      | REG-10 | Notification Preferences | Email, mobile, push switches, and browser notification states | automated   | tests/regression/notification-status-matrix.spec.js   | npm run test:regression                 |
      | REG-11 | Full Regression Setup    | Project setup, vehicle emission, equipment master, then new booking | requirement | Scenario.md                                          | npm run test:regression                 |

  @negative
  Scenario Outline: Negative regression coverage is cataloged for safe implementation
    Then the "<id>" "<scenario>" use case for "<area>" should be documented with "<coverage>" coverage from "<source>"
    And the catalog command "<command>" should be available when provided

    Examples:
      | id      | area                         | scenario                                      | coverage           | source      | command |
      | NEG-01  | Login                        | Invalid email, invalid password, and empty credentials | instruction-matrix | Scenario.md | -       |
      | NEG-02  | Booking Creation             | Missing mandatory booking fields and invalid date/time combinations | instruction-matrix | Scenario.md | - |
      | NEG-03  | Booking List                 | Unknown search, empty result sorting, unavailable actions, and empty export | instruction-matrix | Scenario.md | - |
      | NEG-04  | User Management              | Empty invite, invalid email, duplicate role, missing organization, and restricted row actions | instruction-matrix | Scenario.md | - |
      | NEG-05  | Equipment Management         | Missing upload, unsupported file, invalid columns, duplicate usage, and invalid attachments | instruction-matrix | Scenario.md | - |
      | NEG-06  | Analytics                    | Invalid date ranges, no-record downloads, unknown search, and unit mismatch detection | instruction-matrix | Scenario.md | - |
      | NEG-07  | Environment Reports          | Date ranges beyond limits, invalid date order, empty downloads, and no-result filters | instruction-matrix | Scenario.md | - |
      | NEG-08  | My Account                   | Blank names, invalid phone, overlong values, missing preference values, and read-only access | instruction-matrix | Scenario.md | - |
      | NEG-09  | My Organization              | Read-only organization name, blank address fields, invalid country, and invalid role change | instruction-matrix | Scenario.md | - |
      | NEG-10  | Notification Preferences     | Permission denied, disabled push/email/mobile switches, notification timeout, and reload persistence | instruction-matrix | Scenario.md | - |
      | NEG-11  | Project Management           | Invalid project settings, unavailable resources, capacity limits, and configuration restoration | instruction-matrix | Scenario.md | - |
      | NEG-12  | Super Admin                  | Configuration switch validation and role-based access restrictions | instruction-matrix | Scenario.md | - |
