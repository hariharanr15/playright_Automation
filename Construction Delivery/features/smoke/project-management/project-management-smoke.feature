@smoke @project-management @module_project_management @positive @environment_based
Feature: Construction Delivery - Project Management Smoke
  Description:
  This module-wise smoke feature verifies that the configured project can open
  Project Management areas in a read-only review flow.

  Preconditions:
  - The selected environment profile must provide the application URL and project ID.
  - The automation login must have access to the configured Construction Delivery project.

  Test data requirements:
  - Existing project, location, access point, resource, settings, and UOM configuration.
  - No data-changing test data is required for smoke execution.

  Expected result:
  Each Project Management area opens successfully and no create, update, save, or delete
  action is performed.

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
