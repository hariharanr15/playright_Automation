# Project Management Cucumber Document

This document describes the Project Management flow for the Construction Delivery application in Cucumber/BDD format.

## Purpose

Validate that Project Management configuration areas are available, and that the full regression setup supports downstream Booking, Analytics, Equipment, and Environment Report flows.

## Preconditions

- User has valid Construction Delivery credentials.
- User has Project Admin or equivalent access for the configured project.
- Environment profile provides `APP_URL`, `BASE_URL`, `PROJECT_ID`, and `PROJECT_NAME`.
- Data-changing regression runs must use isolated or restorable project configuration data.

## Feature Files

- `features/smoke/project-management/project-management-smoke.feature`
- `features/regression/project-management/project-management-regression.feature`
- `features/construction-delivery.feature`

## Run Commands

Safe Project Management Cucumber flow:

```bash
npm run cucumber:project-management
```

Safe Project Management Cucumber flow in headless Chrome:

```bash
npm run cucumber:project-management:headless
```

Module-wise Cucumber smoke:

```bash
npm run cucumber:smoke -- --env staging --module project-management
```

Regression inventory document:

```bash
npm run cucumber:regression -- --env staging --module project-management --no-open
```

Full Playwright-backed Project Management regression in Chrome:

```bash
npm run test:project-management:regression
```

## Smoke Feature

```gherkin
@smoke @project-management @module_project_management @positive @environment_based
Feature: Construction Delivery - Project Management Smoke
  This module-wise smoke feature verifies that the configured project can open
  Project Management areas in a read-only review flow.

  Background:
    Given I log in to the Construction Delivery application
    And I select the configured Construction Delivery project

  @smoke_project_management_navigation @safe
  Scenario: Review Project Management configuration areas without changing data
    When I review the following Project Management areas:
      | area                | expected screen marker               |
      | Project Details     | Project Details                      |
      | Environment Setting | Environment Setting, Project Details |
      | Availability        | Availability                         |
      | Project Settings    | Project Settings, Core Features      |
      | Vehicle Emissions   | Vehicle Emissions                    |
      | Equipment Master    | Equipment Master                     |
      | Global Settings     | Global Settings, Common              |
      | Country UOMs        | Country UOMs, Country                |
    Then each requested Project Management area should be ready for review
    And no data-changing action should be performed
```

## Positive Regression Scenarios

```gherkin
@regression @project-management @configuration_based @positive
Feature: Construction Delivery - Project Management Regression

  Background:
    Given I log in to the Construction Delivery application
    And I select the configured Construction Delivery project

  Scenario: Project setup is completed before booking regression
    Given I open Project Details
    When I create or verify an access point
    And I create or verify a vehicle restriction
    And I create or verify a resource
    And I assign a booking-compatible vehicle to the resource
    And I validate availability and booking advance limit
    Then the setup data should be available for downstream booking regression

  Scenario: Project Settings switches are validated
    Given I open Project Settings
    When I set Automatic Approval to the configured value
    And I set Emission Settings to the configured value
    Then Project Settings should save and show the configured switch states

  Scenario: Vehicle Emission setup is validated
    Given I open Vehicle Emissions
    When I create or verify vehicle emission data with valid distance and emission factor
    Then the vehicle emission record should be available for analytics validation

  Scenario: Equipment Master setup is validated
    Given I open Equipment Master
    When I create or verify equipment master data with valid fuel and emission factor
    Then the equipment record should be available for equipment and analytics validation
```

## Negative Scenarios

```gherkin
@negative @project-management @mandatory_field_validation
Scenario: Project Details cannot be saved with missing mandatory fields
  Given I open Project Details
  When I clear mandatory project values
  And I save the form
  Then mandatory field validation should be displayed

@negative @project-management @duplicate_records
Scenario Outline: Duplicate setup records are rejected
  Given I open Project Management
  When I create duplicate "<record type>"
  Then duplicate record validation should be displayed

  Examples:
    | record type      |
    | access point     |
    | resource         |
    | vehicle emission |
    | equipment        |

@negative @project-management @invalid_configuration
Scenario: Invalid configuration values are rejected
  Given I open Project Management
  When I enter invalid availability, emission, or UOM values
  Then validation or recovery messaging should be displayed

@negative @project-management @permission
Scenario: Restricted user cannot update Project Management settings
  Given I log in as a restricted user
  When I open Project Management
  Then create, update, save, and delete actions should be hidden or disabled
```

## Expected Results

- Project Management areas open successfully in safe smoke mode.
- Data-changing regression creates or verifies access point, resource, vehicle assignment, emissions, equipment, settings, and availability data.
- Project Settings switch states match configured expectations.
- Generated setup data supports downstream booking regression.
- Negative scenarios document invalid input, duplicate records, permission restrictions, API failures, and recovery behavior.

## Reports

Cucumber reports:

```text
reports/cucumber-report.html
reports/cucumber-report.json
reports/<suite>/<timestamp>/cucumber-report.html
```

Playwright module regression report:

```text
reports/suite-execution-report.html
```

## Flow Stability Notes

If the browser flow is not working correctly, start with the safe Cucumber flow:

```bash
npm run cucumber:project-management
```

Use the full Playwright-backed regression only after login, project selection, and Project Management navigation are stable:

```bash
npm run test:project-management:regression
```

