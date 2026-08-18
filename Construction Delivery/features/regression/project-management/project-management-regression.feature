@regression @project-management @module_project_management @positive @negative @validation @permission @configuration @environment_based @documentation-only
Feature: Construction Delivery - Project Management Regression
  Description:
  This module-wise regression document maps Project Management functional coverage
  to the existing Playwright automation and reusable page objects.

  Preconditions:
  - The selected environment must contain an editable Construction Delivery project.
  - The automation user must have permission for Project Details, Project Settings,
    Vehicle Emissions, Equipment Master, Global Settings, and Country UOM areas.
  - Data-changing regression runs must restore or isolate configuration changes.

  Test data requirements:
  - New access point, resource, and vehicle assignment values.
  - Vehicle emission fuel type, miles/Km value between 5 and 15, and emission factor between 0.1 and 5.
  - Equipment name, category, brand, model, fuel type, and emission factor between 0.1 and 5.
  - Permission matrix users for allowed and restricted project roles.

  Expected result:
  Project Management configuration can be created, edited, validated, restricted by role,
  and restored without blocking downstream booking and analytics flows.

  Background:
    Given the Construction Delivery automation catalog is loaded

  @positive @configuration_based @role_based
  Scenario Outline: Project Management regression scenario is mapped to reusable automation
    Then the "<id>" "<scenario>" use case for "<area>" should be documented with "<coverage>" coverage from "<source>"
    And the catalog command "<command>" should be available when provided

    Examples:
      | id      | area               | scenario                                                            | coverage  | source                                                         | command                 |
      | PM-REG-01 | Project Details  | Create or verify access point, resource, and vehicle assignment       | automated | tests/regression/Project management_EnvironmentSetting.spec.js | npm run test:regression |
      | PM-REG-02 | Vehicle Emissions | Add Vehicle Emission for the newly added vehicle with valid values   | automated | tests/regression/Project management_EnvironmentSetting.spec.js | npm run test:regression |
      | PM-REG-03 | Equipment Master | Add Equipment with category, brand, model, fuel, and emission factor | automated | tests/regression/Project management_EnvironmentSetting.spec.js | npm run test:regression |
      | PM-REG-04 | Project Settings | Validate Automatic Approval and Emission Settings switches           | automated | tests/regression/project-settings-tab.spec.js                  | npm run test:regression |
      | PM-REG-05 | Global Settings  | Validate global configuration visibility and restricted access        | automated | tests/regression/VC_Superadmin_Project Creation.spec.js        | npm run test:regression |

  @negative @validation @permission
  Scenario Outline: Project Management negative and permission scenario is documented
    Then the "<id>" "<scenario>" use case for "<area>" should be documented with "<coverage>" coverage from "<source>"

    Examples:
      | id         | area               | scenario                                                           | coverage           | source      |
      | PM-NEG-01 | Project Details    | Mandatory project fields reject blank or invalid values             | instruction-matrix | Scenario.md |
      | PM-NEG-02 | Availability       | Capacity and unavailable time ranges prevent invalid configuration  | instruction-matrix | Scenario.md |
      | PM-NEG-03 | Vehicle Emissions  | Invalid miles/Km and emission factor values are rejected            | instruction-matrix | Scenario.md |
      | PM-NEG-04 | Equipment Master   | Duplicate, incomplete, or invalid equipment records are rejected    | instruction-matrix | Scenario.md |
      | PM-NEG-05 | Project Settings   | Restricted roles cannot change project configuration switches       | instruction-matrix | Scenario.md |
