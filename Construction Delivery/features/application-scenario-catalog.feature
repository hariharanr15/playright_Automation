@catalog @documentation-only
Feature: Construction Delivery - Full Application Scenario Catalog
  Purpose:
  This feature is the complete Cucumber instruction catalog for the Construction Delivery application.
  It converts the existing Playwright specs, Chrome automation scripts, page objects, and Scenario.md
  matrix into business-readable use cases that appear in the Cucumber report.

  Scope:
  The catalog covers login, project context, Booking List, booking creation, User Management,
  Equipment Management, Analytics, Environment Reports, My Account, My Organization,
  Notification Preferences, Project Management, full regression setup dependencies,
  utility flows, and known negative cases.

  Safety:
  These catalog scenarios are documentation-only checks. They do not open the browser, log in,
  create bookings, upload files, send invites, change settings, or delete records. They verify that
  every documented use case points to an existing automation source or the maintained Scenario.md
  instruction matrix.

  Background:
    Given the Construction Delivery automation catalog is loaded

  Scenario Outline: Executable Chrome and Playwright automation flows are documented
    Then the "<id>" "<scenario>" use case for "<area>" should be documented with "<coverage>" coverage from "<source>"
    And the catalog command "<command>" should be available when provided

    Examples:
      | id             | area                                  | scenario                                      | coverage        | source                                                   | command                                      |
      | CHROME-ALL-01 | Full smoke suite                      | Full smoke suite                              | automated-suite | tests/smoke/booking-smoke.spec.js                       | npm run test:smoke                          |
      | CHROME-ALL-02 | Full regression suite                 | Full regression suite starts from project setup | automated-suite | tests/regression/booking-regression.spec.js             | npm run test:regression                     |
      | CHROME-BK-01  | Booking creation functional flow      | Booking creation functional flow              | automated-flow  | run-full-application.js                                  | npm run automate:booking-creations          |
      | CHROME-BK-02  | Dynamic booking and automatic approvals | Dynamic booking type and automatic approval matrix | automated-flow  | run-full-application.js                                  | npm run automate:dynamic-booking-approval   |
      | CHROME-RBAC-01| Role-based left navigation             | Role-based left navigation and direct URL validation | automated-flow  | scripts/run-role-navigation-flow.js                      | npm run automate:role-navigation            |
      | CHROME-BL-01  | Booking List export functional flow   | Booking List export functional flow           | automated-flow  | scripts/download-booking-list-exports.js                | npm run automate:booking-list-exports       |
      | CHROME-UM-01  | User Management functional flow       | User Management functional flow               | automated-flow  | scripts/run-user-management-functional-flow.js           | npm run automate:user-management            |
      | CHROME-EM-01  | Equipment Management functional flow  | Equipment Management functional flow          | automated-flow  | scripts/run-equipment-management-flow.js                 | npm run automate:equipment-management       |
      | CHROME-EM-02  | Updated Equipment List upload flow    | Updated Equipment List upload flow            | automated-flow  | scripts/Updated- Equi. LIst -Equipment management.js    | npm run automate:updated-equipment-list     |
      | CHROME-AN-01  | Analytics functional flow             | Analytics functional flow                     | automated-flow  | scripts/run-analytics-flow.js                            | npm run automate:analytics                  |
      | CHROME-ER-01  | Environment Reports functional flow   | Environment Reports functional flow           | automated-flow  | scripts/run-environment-reports-flow.js                  | npm run automate:environment-reports        |
      | CHROME-MA-01  | My Account functional flow            | My Account functional flow                    | automated-flow  | scripts/run-my-account-flow.js                           | npm run automate:my-account                 |
      | CHROME-MO-01  | My Organization functional flow       | My Organization functional flow               | automated-flow  | scripts/run-my-organization-flow.js                      | npm run automate:my-organization            |
      | CHROME-NP-01  | Notification Preferences flow         | Notification Preferences functional flow       | automated-flow  | scripts/run-notification-status-matrix-flow.js           | npm run automate:notification-functional    |
      | CHROME-NP-02  | Delivery Booking Push Notification    | Delivery Booking Push Notification flow       | automated-flow  | scripts/run-notification-chrome-automation.js            | npm run automate:notification-chrome        |
      | CHROME-NP-03  | Resource Booking Push Notification    | Resource Booking Push Notification flow       | automated-flow  | scripts/run-notification-status-matrix-flow.js           | npm run automate:notification-status-matrix |
      | CHROME-NP-04  | Push Notification Toggle              | Push Notification Toggle flow                 | automated-flow  | tests/regression/notification-status-matrix.spec.js      | npm run test:regression                     |
      | CHROME-FULL-01| Full application functional flow       | Full application functional flow              | automated-flow  | run-full-application.js                                  | npm run automate:full-application           |
      | CHROME-CAL-01 | Calendar functional flow              | Calendar functional flow                      | automated-flow  | pages/booking/calendar.booking.page.js                   | npm run automate:calendar                   |

  Scenario Outline: Positive application use cases are documented
    Then the "<id>" "<scenario>" use case for "<area>" should be documented with "<coverage>" coverage from "<source>"
    And the catalog command "<command>" should be available when provided

    Examples: Dashboard and project context
      | id      | area            | scenario                              | coverage       | source                             | command             |
      | DASH-01 | Login           | Login from SSO page                   | page-supported | utils/login.js                     | -                   |
      | DASH-02 | Dashboard       | Select Buckingham Palace project      | page-supported | pages/booking/dashboard.page.js    | -                   |
      | DASH-03 | Dashboard       | Open authenticated dashboard          | automated      | tests/smoke/booking-smoke.spec.js  | npm run test:smoke  |
      | DASH-04 | Dashboard       | Select project and location           | page-supported | pages/booking/user-management.page.js | -                 |

    Examples: Booking List
      | id    | area         | scenario                                                 | coverage       | source                                      | command             |
      | BL-01 | Booking List | Open Booking List                                        | automated      | tests/smoke/booking-list-flow.spec.js       | npm run test:smoke  |
      | BL-02 | Booking List | Booking List status counts                               | automated      | tests/regression/booking-list-status.spec.js| npm run test:regression |
      | BL-03 | Booking List | Scheduled booking check-in/check-out hover actions       | automated      | tests/regression/booking-list-status.spec.js| npm run test:regression |
      | BL-04 | Booking List | Refused row cannot be modified                           | automated      | tests/regression/booking-list-status.spec.js| npm run test:regression |
      | BL-05 | Booking List | Sort by Booking Ref                                      | automated      | tests/regression/booking-list-status.spec.js| npm run test:regression |
      | BL-06 | Booking List | Apply default filters                                    | automated      | tests/smoke/booking-smoke.spec.js           | npm run test:smoke  |
      | BL-07 | Booking List | Complete non-mutating Booking List flow                  | automated      | tests/smoke/booking-list-flow.spec.js       | npm run test:smoke  |

    Examples: Booking creation and details
      | id    | area            | scenario                                                        | coverage       | source                                  | command             |
      | BK-01 | New Booking     | Create resource-only booking                                    | automated      | tests/regression/booking-regression.spec.js | npm run test:regression |
      | BK-02 | New Booking     | Create recurring booking                                        | automated      | tests/regression/booking-regression.spec.js | npm run test:regression |
      | BK-03 | New Booking     | Multi-vehicle booking reaches details                           | automated      | tests/regression/booking-regression.spec.js | npm run test:regression |
      | BK-04 | Booking Details | Scheduled booking lifecycle actions                             | automated      | tests/regression/booking-regression.spec.js | npm run test:regression |
      | BK-05 | New Booking     | Delivery booking smoke                                          | automated      | tests/smoke/booking-smoke.spec.js       | npm run test:smoke  |

    Examples: User Management
      | id    | area              | scenario                                      | coverage       | source                                      | command                       |
      | UM-01 | User Management   | Open User Management page                     | automated      | features/user-management.feature             | npm run cucumber:user-management |
      | UM-02 | Invite Users      | Mandatory field and invalid email validation  | page-supported | pages/booking/user-management.page.js         | -                             |
      | UM-03 | Invite Users      | Duplicate role validation                     | page-supported | pages/booking/user-management.page.js         | -                             |
      | UM-04 | Invite Users      | Send configured user invite                   | automated      | tests/regression/user-management-functional.spec.js | npm run test:regression |
      | UM-05 | User List         | Verify invited user status                    | automated      | tests/regression/user-management-functional.spec.js | npm run test:regression |
      | UM-06 | User List         | Re-send invite                                | automated      | tests/regression/booking-regression.spec.js   | npm run test:regression       |
      | UM-07 | Account Activation| Activate invited account through Yopmail      | page-supported | scripts/run-user-management-flow.js           | -                             |
      | UM-08 | User List         | Verify activated status                       | page-supported | pages/booking/user-management.page.js         | -                             |
      | UM-09 | User List Filters | Filter by Project Admin and Neuralrays        | automated      | tests/regression/user-management-functional.spec.js | npm run test:regression |
      | UM-10 | User Organization | Change associated organization                | automated      | tests/regression/user-management-functional.spec.js | npm run test:regression |
      | UM-11 | User Login        | Verify own login for changed user             | page-supported | pages/booking/user-management.page.js         | -                             |
      | UM-12 | User Cleanup      | Remove created users from project             | page-supported | pages/booking/user-management.page.js         | -                             |

    Examples: Equipment Management
      | id    | area                         | scenario                                 | coverage       | source                                      | command                            |
      | EM-01 | Equipment Management          | Open Equipment Management and Equipment List | automated  | tests/smoke/equipment-management-smoke.spec.js | npm run test:smoke             |
      | EM-02 | Equipment List                | Upload Equipment List workbook           | automated      | tests/regression/equipment-management-functional.spec.js | npm run test:regression |
      | EM-03 | Equipment List                | Apply one-year date range                | automated      | tests/regression/equipment-management-functional.spec.js | npm run test:regression |
      | EM-04 | Equipment List                | Select dropdown filters                  | automated      | scripts/run-equipment-management-flow.js      | npm run automate:equipment-management |
      | EM-05 | Equipment List                | Download export and PDF action           | automated      | scripts/run-equipment-management-flow.js      | npm run automate:equipment-management |
      | EM-06 | Equipment Usage               | Validate fuel efficiency unit            | automated      | tests/regression/equipment-management-functional.spec.js | npm run test:regression |
      | EM-07 | Equipment Usage               | Create Equipment Usage record            | automated      | scripts/run-equipment-management-flow.js      | npm run automate:equipment-management |
      | EM-08 | Equipment Usage               | Search and filter created usage          | automated      | scripts/run-equipment-management-flow.js      | npm run automate:equipment-management |
      | EM-09 | Equipment Usage               | Edit created usage year                  | automated      | scripts/run-equipment-management-flow.js      | npm run automate:equipment-management |
      | EM-10 | Equipment Usage Attachments   | Upload usage attachment workbook         | page-supported | pages/booking/equipment-management.page.js    | -                                  |
      | EM-11 | Equipment Usage Cleanup       | Delete automation-created usage          | automated      | scripts/run-equipment-management-flow.js      | npm run automate:equipment-management |

    Examples: Reports, account, organization, and notifications
      | id    | area                              | scenario                                      | coverage       | source                                      | command                                  |
      | AN-01 | Analytics                         | Verify project details and Country UOM        | automated      | tests/regression/analytics-functional.spec.js | npm run test:regression                |
      | AN-02 | Summary Emission                  | Validate date range and download              | automated      | scripts/run-analytics-flow.js               | npm run automate:analytics               |
      | AN-03 | Vehicle Emissions                 | Validate units, records, search, and download | automated      | tests/regression/analytics-functional.spec.js | npm run test:regression                |
      | AN-04 | Equipment Emissions               | Validate units, records, search, and download | automated      | tests/regression/analytics-functional.spec.js | npm run test:regression                |
      | AN-05 | Environment Reports Analytics     | Validate date range                           | automated      | scripts/run-analytics-flow.js               | npm run automate:analytics               |
      | ER-01 | Environment Reports               | Open and apply recorded date range            | automated      | tests/regression/environment-reports-functional.spec.js | npm run test:regression        |
      | ER-02 | Environment Reports               | Validate no-data after three-year limit       | automated      | tests/regression/environment-reports-functional.spec.js | npm run test:regression        |
      | MA-01 | My Account                        | Open My Account from Account Settings         | automated      | tests/regression/my-account-functional.spec.js | npm run test:regression                |
      | MA-02 | My Details                        | Update editable details                       | automated      | tests/regression/my-account-functional.spec.js | npm run test:regression                |
      | MA-03 | My Preferences                    | Validate dropdown values and persistence      | automated      | tests/regression/my-account-functional.spec.js | npm run test:regression                |
      | MA-04 | Application Preferences           | Verify preferences in Booking List            | automated      | pages/booking/my-account.page.js            | npm run automate:my-account              |
      | MA-05 | Account Access                    | Verify company and read-only roles            | automated      | tests/regression/my-account-functional.spec.js | npm run test:regression                |
      | MO-01 | My Organization                   | Open My Organization from Account Settings    | automated      | tests/regression/my-organization-functional.spec.js | npm run test:regression           |
      | MO-02 | Organization Details              | Validate detail fields                        | automated      | tests/regression/my-organization-functional.spec.js | npm run test:regression           |
      | MO-03 | Organization Details              | Update trade type                             | automated      | tests/regression/my-organization-functional.spec.js | npm run test:regression           |
      | MO-04 | Users Tab                         | Validate users list                           | automated      | pages/booking/my-organization.page.js       | npm run automate:my-organization         |
      | MO-05 | Users Tab                         | Search users and This project only            | automated      | tests/regression/my-organization-functional.spec.js | npm run test:regression           |
      | NP-01 | Notification Preferences          | Open preferences from Account Settings        | automated      | tests/regression/notification-status-matrix.spec.js | npm run test:regression          |
      | NP-02 | Notification Preferences          | Enable browser push permission                | automated      | scripts/run-notification-chrome-automation.js | npm run automate:notification-chrome    |
      | NP-03 | My Bookings Notifications         | Enable email, mobile, and push switches       | automated      | tests/regression/notification-status-matrix.spec.js | npm run test:regression          |
      | NP-04 | Delivery Booking Push             | Delivery booking triggers browser push        | automated      | scripts/run-notification-chrome-automation.js | npm run automate:notification-chrome    |
      | NP-05 | Resource Booking Push             | Resource booking triggers browser push        | automated      | scripts/run-notification-status-matrix-flow.js | npm run automate:notification-status-matrix |
      | NP-06 | Push Toggle Disabled              | Disabled push suppresses notification         | automated      | tests/regression/notification-status-matrix.spec.js | npm run test:regression          |
      | NP-07 | Push Toggle Enabled               | Enabled push shows notification               | automated      | tests/regression/notification-status-matrix.spec.js | npm run test:regression          |

    Examples: Dedicated utility flows
      | id    | area                  | scenario                            | coverage       | source                                                | command                                  |
      | UF-01 | Equipment List Upload | Updated Equipment List upload workbook | automated   | scripts/Updated- Equi. LIst -Equipment management.js | npm run automate:updated-equipment-list |
      | UF-02 | Booking List Exports  | Download Booking List exports       | automated      | scripts/download-booking-list-exports.js             | npm run automate:booking-list-exports   |
      | UF-03 | Full Application      | Full application automation         | automated      | run-full-application.js                               | npm run automate:full-application       |
      | UF-04 | Full Regression       | Project setup, vehicle emission, equipment master, then new booking | requirement | Scenario.md                                          | npm run test:regression                 |

    Examples: Project Management
      | id    | area                             | scenario                                             | coverage       | source                                                        | command                                      |
      | PM-01 | Project Information              | Update project name, address, and home screen message | automated-flow | scripts/run-project-management-chrome-automation.js           | npm run automate:project-management-chrome   |
      | PM-02 | Access Points                    | Create access points and configure vehicle restrictions | automated-flow | tests/regression/Project management_EnvironmentSetting.spec.js | npm run test:regression                      |
      | PM-03 | Resources                        | Create resources and assign vehicles                 | automated-flow | tests/regression/Project management_EnvironmentSetting.spec.js | npm run test:regression                      |
      | PM-04 | Availability and Booking Limits  | Configure availability and validate booking limits    | automated-flow | tests/regression/Project management_EnvironmentSetting.spec.js | npm run test:regression                      |
      | PM-05 | Project Settings                 | Validate automatic approval and emission menus        | automated-flow | tests/regression/Project management_EnvironmentSetting.spec.js | npm run test:regression                      |
      | PM-06 | Emissions and Equipment          | Manage emission factors and equipment master records  | automated-flow | tests/regression/Project management_EnvironmentSetting.spec.js | npm run test:regression                      |
      | PM-07 | Full Regression Project Setup    | Create access point, resource, vehicle emission, and equipment before booking | requirement | Scenario.md                                          | npm run test:regression                      |

  Scenario Outline: Negative and validation use cases are documented
    Then the "<id>" "<scenario>" use case for "<area>" should be documented with "<coverage>" coverage from "<source>"
    And the catalog command "<command>" should be available when provided

    Examples: Login, project context, Booking List, and booking validation
      | id      | area                  | scenario                                      | coverage           | source      | command |
      | DASH-N01| Login                 | Invalid email format                          | instruction-matrix | Scenario.md | -       |
      | DASH-N02| Login                 | Invalid password                              | instruction-matrix | Scenario.md | -       |
      | DASH-N03| Login                 | Empty credentials                             | instruction-matrix | Scenario.md | -       |
      | DASH-N04| Login                 | Expired session redirect                      | instruction-matrix | Scenario.md | -       |
      | DASH-N05| Project Context       | Direct module access without selected project | instruction-matrix | Scenario.md | -       |
      | DASH-N06| Project Context       | Unavailable project card                      | instruction-matrix | Scenario.md | -       |
      | BL-N01  | Booking List Filters  | Invalid date range                            | instruction-matrix | Scenario.md | -       |
      | BL-N02  | Booking List Filters  | Future-only range with no records             | instruction-matrix | Scenario.md | -       |
      | BL-N03  | Booking List Search   | Search with unknown booking reference         | instruction-matrix | Scenario.md | -       |
      | BL-N04  | Booking List Search   | Search with special characters                | instruction-matrix | Scenario.md | -       |
      | BL-N05  | Booking List Pagination| Navigate next page when disabled              | instruction-matrix | Scenario.md | -       |
      | BL-N06  | Booking List Status   | Check-in unavailable status                   | instruction-matrix | Scenario.md | -       |
      | BL-N07  | Booking List Status   | Check-out unavailable status                  | instruction-matrix | Scenario.md | -       |
      | BL-N08  | Booking List Status   | Refuse unavailable status                     | instruction-matrix | Scenario.md | -       |
      | BL-N09  | Booking List Sorting  | Sort empty result set                         | instruction-matrix | Scenario.md | -       |
      | BL-N10  | Booking List Export   | Export empty result set                       | instruction-matrix | Scenario.md | -       |
      | BK-N01  | New Booking           | Submit without booking type                   | instruction-matrix | Scenario.md | -       |
      | BK-N02  | Scheduling            | Missing access point                          | instruction-matrix | Scenario.md | -       |
      | BK-N03  | Scheduling            | Missing supplier/company                      | instruction-matrix | Scenario.md | -       |
      | BK-N04  | Booking Date          | No date selected                              | instruction-matrix | Scenario.md | -       |
      | BK-N05  | Booking Time          | No slot selected                              | instruction-matrix | Scenario.md | -       |
      | BK-N06  | Resource Booking      | Missing resource                              | instruction-matrix | Scenario.md | -       |
      | BK-N07  | Recurring Booking     | Missing end date                              | instruction-matrix | Scenario.md | -       |
      | BK-N08  | Recurring Booking     | End date before start date                    | instruction-matrix | Scenario.md | -       |
      | BK-N09  | Recurring Booking     | No repeat day selected                        | instruction-matrix | Scenario.md | -       |
      | BK-N10  | Multi-Vehicle Booking | Missing vehicle count/details                 | instruction-matrix | Scenario.md | -       |
      | BK-N11  | Booking Details       | Missing required contact detail               | instruction-matrix | Scenario.md | -       |
      | BK-N12  | Booking Details       | Invalid phone number                          | instruction-matrix | Scenario.md | -       |
      | BK-N13  | Booking Details       | Invalid email address                         | instruction-matrix | Scenario.md | -       |
      | BK-N14  | Booking Details       | Cancel submit confirmation                    | instruction-matrix | Scenario.md | -       |
      | BK-N15  | Booking Details       | Duplicate submission protection               | instruction-matrix | Scenario.md | -       |

    Examples: User, equipment, analytics, reports, account, organization, and notification validation
      | id     | area                         | scenario                                      | coverage           | source      | command |
      | UM-N01 | Invite Users                 | Empty invite form                             | page-supported     | pages/booking/user-management.page.js | - |
      | UM-N02 | Invite Users                 | Invalid email format                          | page-supported     | pages/booking/user-management.page.js | - |
      | UM-N03 | Invite Users                 | Duplicate role selection                      | page-supported     | pages/booking/user-management.page.js | - |
      | UM-N04 | Invite Users                 | Missing organization                          | instruction-matrix | Scenario.md | - |
      | UM-N05 | Invite Users                 | Missing role                                  | instruction-matrix | Scenario.md | - |
      | UM-N06 | Invite Users                 | Existing active user invite                   | page-supported     | pages/booking/user-management.page.js | - |
      | UM-N07 | User List Search             | Search non-existing user                      | instruction-matrix | Scenario.md | - |
      | UM-N08 | User List Filters            | Filter combination with no users              | instruction-matrix | Scenario.md | - |
      | UM-N09 | Row Actions                  | Resend invite for activated user              | instruction-matrix | Scenario.md | - |
      | UM-N10 | Row Actions                  | Cancel invite for activated user              | instruction-matrix | Scenario.md | - |
      | UM-N11 | Change Organization          | Submit without selecting new organization     | instruction-matrix | Scenario.md | - |
      | UM-N12 | Change Organization          | Select same organization                      | instruction-matrix | Scenario.md | - |
      | UM-N13 | Own Login                    | Login before activation                       | instruction-matrix | Scenario.md | - |
      | UM-N14 | Cleanup                      | Remove user already removed from project      | instruction-matrix | Scenario.md | - |
      | EM-N01 | Equipment List Upload        | Missing upload file                           | instruction-matrix | Scenario.md | - |
      | EM-N02 | Equipment List Upload        | Unsupported file type                         | instruction-matrix | Scenario.md | - |
      | EM-N03 | Equipment List Upload        | Missing scheduled_arrival column              | instruction-matrix | Scenario.md | - |
      | EM-N04 | Equipment List Upload        | Invalid scheduled_arrival value               | instruction-matrix | Scenario.md | - |
      | EM-N05 | Equipment List Upload        | Duplicate date-only workbook                  | instruction-matrix | Scenario.md | - |
      | EM-N06 | Equipment List Filters       | Company with no records                       | instruction-matrix | Scenario.md | - |
      | EM-N07 | Equipment List Filters       | Equipment Type with no records                | instruction-matrix | Scenario.md | - |
      | EM-N08 | Equipment List Filters       | Contact Name with no records                  | instruction-matrix | Scenario.md | - |
      | EM-N09 | Equipment List Search        | Unknown equipment search                      | instruction-matrix | Scenario.md | - |
      | EM-N10 | Equipment List Export        | Export with no rows                           | instruction-matrix | Scenario.md | - |
      | EM-N11 | Equipment Usage              | Submit Add Usage empty                        | instruction-matrix | Scenario.md | - |
      | EM-N12 | Equipment Usage              | Missing registered equipment                  | instruction-matrix | Scenario.md | - |
      | EM-N13 | Equipment Usage              | Invalid hours                                 | instruction-matrix | Scenario.md | - |
      | EM-N14 | Equipment Usage              | Invalid litres/gallons                        | instruction-matrix | Scenario.md | - |
      | EM-N15 | Equipment Usage              | Duplicate usage month/year                    | instruction-matrix | Scenario.md | - |
      | EM-N16 | Equipment Usage Attachment   | Missing attachment file                       | instruction-matrix | Scenario.md | - |
      | EM-N17 | Equipment Usage Attachment   | Unsupported attachment file type              | instruction-matrix | Scenario.md | - |
      | EM-N18 | Equipment Usage Cleanup      | Delete already deleted usage                  | instruction-matrix | Scenario.md | - |
      | AN-N01 | Summary Emission             | Invalid date range                            | instruction-matrix | Scenario.md | - |
      | AN-N02 | Summary Emission             | Date range with no records                    | instruction-matrix | Scenario.md | - |
      | AN-N03 | Summary Emission             | Download with no records                      | instruction-matrix | Scenario.md | - |
      | AN-N04 | Vehicle Emissions            | Search unknown text                           | instruction-matrix | Scenario.md | - |
      | AN-N05 | Vehicle Emissions            | Unit mismatch detection                       | instruction-matrix | Scenario.md | - |
      | AN-N06 | Equipment Emissions          | No records within lookback                    | instruction-matrix | Scenario.md | - |
      | AN-N07 | Equipment Emissions          | Search special characters                     | instruction-matrix | Scenario.md | - |
      | AN-N08 | Analytics Navigation         | Direct analytics URL without auth             | instruction-matrix | Scenario.md | - |
      | ER-N01 | Environment Reports          | Date range beyond three-year limit            | instruction-matrix | Scenario.md | - |
      | ER-N02 | Environment Reports          | Invalid date order                            | instruction-matrix | Scenario.md | - |
      | ER-N03 | Environment Reports          | Empty report download                         | instruction-matrix | Scenario.md | - |
      | ER-N04 | Environment Reports          | Search/filter unknown value                   | instruction-matrix | Scenario.md | - |
      | ER-N05 | Environment Reports          | Scroll empty report                           | instruction-matrix | Scenario.md | - |
      | MA-N01 | My Details                   | Blank first name                              | instruction-matrix | Scenario.md | - |
      | MA-N02 | My Details                   | Blank last name                               | instruction-matrix | Scenario.md | - |
      | MA-N03 | My Details                   | Invalid phone                                 | instruction-matrix | Scenario.md | - |
      | MA-N04 | My Details                   | Overlong name                                 | instruction-matrix | Scenario.md | - |
      | MA-N05 | My Preferences               | Save without language                         | instruction-matrix | Scenario.md | - |
      | MA-N06 | My Preferences               | Invalid persisted preference recovery         | instruction-matrix | Scenario.md | - |
      | MA-N07 | Account Access               | Attempt to edit read-only role                | instruction-matrix | Scenario.md | - |
      | MA-N08 | Password Redirect            | Password screen blocks account page           | instruction-matrix | Scenario.md | - |
      | MO-N01 | Organization Details         | Attempt to edit organization name             | instruction-matrix | Scenario.md | - |
      | MO-N02 | Organization Details         | Blank address line 1                          | instruction-matrix | Scenario.md | - |
      | MO-N03 | Organization Details         | Blank city                                    | instruction-matrix | Scenario.md | - |
      | MO-N04 | Organization Details         | Invalid country value                         | instruction-matrix | Scenario.md | - |
      | MO-N05 | Organization Details         | Save without trade type                       | instruction-matrix | Scenario.md | - |
      | MO-N06 | Users Tab                    | Search unknown user                           | instruction-matrix | Scenario.md | - |
      | MO-N07 | Users Tab                    | This project only returns no users            | instruction-matrix | Scenario.md | - |
      | MO-N08 | Users Tab                    | Invalid role change                           | instruction-matrix | Scenario.md | - |
      | NP-N01 | Notification Preferences     | Browser permission denied                     | instruction-matrix | Scenario.md | - |
      | NP-N02 | Notification Preferences     | Disable Push suppresses browser notification  | instruction-matrix | Scenario.md | - |
      | NP-N03 | Notification Preferences     | My Bookings push disabled                     | instruction-matrix | Scenario.md | - |
      | NP-N04 | Notification Preferences     | Email toggle disabled                         | instruction-matrix | Scenario.md | - |
      | NP-N05 | Notification Preferences     | Mobile toggle disabled                        | instruction-matrix | Scenario.md | - |
      | NP-N06 | Notification Center          | No new notification for disabled push         | instruction-matrix | Scenario.md | - |
      | NP-N07 | Notification Observer        | Notification timeout                          | instruction-matrix | Scenario.md | - |
      | NP-N08 | Notification Preferences     | Reload after toggle change                    | instruction-matrix | Scenario.md | - |
