@regression @negative @validation @role_based @environment_based @documentation-only
Feature: Construction Delivery - Comprehensive Negative Coverage
  Description:
  This feature defines mandatory negative coverage for every module and functional flow.
  It is documentation-only and traceable to existing automation sources until each
  scenario is promoted into executable browser automation with isolated data and cleanup.

  Coverage rule:
  Every module must include negative scenarios for mandatory fields, invalid inputs,
  boundary values, duplicate records, unauthorized access, role restrictions, invalid
  configuration, API/server errors, timeout and network failures, upload validation,
  session expiry, incorrect workflow transitions, disabled or unavailable features,
  and error-message recovery.

  Background:
    Given the Construction Delivery automation catalog is loaded

  @mandatory_field_validation @invalid_input @boundary_value @duplicate_record
  Scenario Outline: Data validation negative coverage is documented for each module
    Then the "<id>" "<scenario>" use case for "<module>" should be documented with "<coverage>" coverage from "<source>"

    Examples:
      | id             | module                   | scenario                                                                 | coverage           | source      |
      | NEG-DATA-001   | Login                    | Empty, malformed, locked, or boundary-length credentials are rejected      | instruction-matrix | Scenario.md |
      | NEG-DATA-002   | Booking Creation         | Mandatory booking fields, invalid quantities, dates, and boundary values are rejected | instruction-matrix | Scenario.md |
      | NEG-DATA-003   | Booking List             | Invalid search, empty filters, and boundary date ranges show recoverable messages | instruction-matrix | Scenario.md |
      | NEG-DATA-004   | Calendar                 | Invalid date navigation and unavailable resource/date combinations are handled | instruction-matrix | Scenario.md |
      | NEG-DATA-005   | Equipment Management     | Missing, invalid, duplicate, and boundary equipment values are rejected    | instruction-matrix | Scenario.md |
      | NEG-DATA-006   | User Management          | Empty invite, invalid email, duplicate user, and missing role validations are enforced | instruction-matrix | Scenario.md |
      | NEG-DATA-007   | Project Management       | Invalid project, availability, emission, equipment, and UOM configuration values are rejected | instruction-matrix | Scenario.md |
      | NEG-DATA-008   | Analytics                | Invalid date ranges, unsupported filters, and no-record downloads are handled | instruction-matrix | Scenario.md |
      | NEG-DATA-009   | Environment Reports      | Invalid report dates, empty reports, and boundary ranges show clear validation | instruction-matrix | Scenario.md |
      | NEG-DATA-010   | My Account               | Blank, malformed, overlong, and read-only account values are rejected      | instruction-matrix | Scenario.md |
      | NEG-DATA-011   | My Organization          | Invalid organization fields, duplicate users, and invalid role changes are rejected | instruction-matrix | Scenario.md |
      | NEG-DATA-012   | Notification Preferences | Invalid notification values and disabled preference combinations are handled | instruction-matrix | Scenario.md |
      | NEG-DATA-013   | Super Admin              | Invalid project setup and duplicate configuration records are rejected     | instruction-matrix | Scenario.md |

  @unauthorized_access @role_based @invalid_configuration @disabled_feature
  Scenario Outline: Permission and configuration negative coverage is documented for each module
    Then the "<id>" "<scenario>" use case for "<module>" should be documented with "<coverage>" coverage from "<source>"

    Examples:
      | id             | module                   | scenario                                                                | coverage           | source      |
      | NEG-PERM-001   | Login                    | Unauthorized users cannot access protected application routes            | instruction-matrix | Scenario.md |
      | NEG-PERM-002   | Booking Creation         | Restricted roles cannot create or submit unavailable booking types       | instruction-matrix | Scenario.md |
      | NEG-PERM-003   | Booking List             | Restricted roles cannot access hidden actions or direct action URLs      | instruction-matrix | Scenario.md |
      | NEG-PERM-004   | Calendar                 | Unavailable calendar features and restricted resources remain inaccessible | instruction-matrix | Scenario.md |
      | NEG-PERM-005   | Equipment Management     | Restricted roles cannot upload, create, edit, or delete equipment records | instruction-matrix | Scenario.md |
      | NEG-PERM-006   | User Management          | Restricted roles cannot invite, edit, remove, or resend user invitations | instruction-matrix | Scenario.md |
      | NEG-PERM-007   | Project Management       | Restricted roles cannot update settings, UOM, availability, or emissions | instruction-matrix | Scenario.md |
      | NEG-PERM-008   | Analytics                | Disabled analytics tabs and restricted report routes are inaccessible    | instruction-matrix | Scenario.md |
      | NEG-PERM-009   | Environment Reports      | Restricted users cannot access reports or download protected exports     | instruction-matrix | Scenario.md |
      | NEG-PERM-010   | My Account               | Users cannot edit read-only identity, organization, or role fields       | instruction-matrix | Scenario.md |
      | NEG-PERM-011   | My Organization          | Restricted users cannot change organization or project user roles        | instruction-matrix | Scenario.md |
      | NEG-PERM-012   | Notification Preferences | Browser-denied, disabled, or unavailable notification channels are handled | instruction-matrix | Scenario.md |
      | NEG-PERM-013   | Super Admin              | Non-super-admin roles cannot reach Super Admin configuration workflows    | instruction-matrix | Scenario.md |

  @api_server_error @timeout @network_failure @session_expiry @workflow_transition @upload_validation @recovery
  Scenario Outline: Resilience and workflow negative coverage is documented for each module
    Then the "<id>" "<scenario>" use case for "<module>" should be documented with "<coverage>" coverage from "<source>"

    Examples:
      | id             | module                   | scenario                                                                  | coverage           | source      |
      | NEG-RES-001    | Login                    | Session expiry, server errors, and network failures show recoverable login errors | instruction-matrix | Scenario.md |
      | NEG-RES-002    | Booking Creation         | API errors, timeout, session expiry, and incorrect step transitions recover safely | instruction-matrix | Scenario.md |
      | NEG-RES-003    | Booking List             | Failed list APIs, timeout, stale records, and invalid status transitions recover safely | instruction-matrix | Scenario.md |
      | NEG-RES-004    | Calendar                 | Calendar API failures, timeout, and unavailable resources show recovery paths | instruction-matrix | Scenario.md |
      | NEG-RES-005    | Equipment Management     | Upload file type, file size, missing template, network, and server failures are handled | instruction-matrix | Scenario.md |
      | NEG-RES-006    | User Management          | Invite API errors, timeout, session expiry, and resend failures show recovery | instruction-matrix | Scenario.md |
      | NEG-RES-007    | Project Management       | Save failures, stale configuration, timeout, and incorrect transition recovery are handled | instruction-matrix | Scenario.md |
      | NEG-RES-008    | Analytics                | Report API/server errors, timeout, and download failures show retry or recovery | instruction-matrix | Scenario.md |
      | NEG-RES-009    | Environment Reports      | Export errors, timeout, and report service failures display actionable recovery | instruction-matrix | Scenario.md |
      | NEG-RES-010    | My Account               | Save failures, session expiry, timeout, and recovery messages are validated | instruction-matrix | Scenario.md |
      | NEG-RES-011    | My Organization          | Organization API failures, timeout, and role update recovery are validated | instruction-matrix | Scenario.md |
      | NEG-RES-012    | Notification Preferences | Browser permission, API failure, timeout, and reload persistence recovery are validated | instruction-matrix | Scenario.md |
      | NEG-RES-013    | Super Admin              | Project creation server errors, timeout, unavailable features, and recovery are validated | instruction-matrix | Scenario.md |
