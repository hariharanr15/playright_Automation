@smoke @smoke-user-management
Feature: Construction Delivery - User Management Smoke
  Purpose:
  This smoke suite validates the critical User Management entry path and invite form readiness.
  It is a dry run and does not send invitations.

  Background:
    Given I log in to the Construction Delivery application
    And I select the configured Construction Delivery project
    And I open the User Management page from the left navigation

  @smoke-user-invite @dry-run
  Scenario: Prepare a Project Admin invite without submitting it
    When I open the Invite Users popup
    And I enter the following invite details:
      | email     | organization | role          |
      | generated | Neuralrays   | Project Admin |
    Then the Invite Users popup should show the prepared user email
    And the automation must stop before clicking Send Invites
