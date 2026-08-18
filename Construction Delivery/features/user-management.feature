Feature: Construction Delivery - User Management
  Purpose:
  This feature documents the User Management workflow for the Construction Delivery application.
  It is written as a clear business instruction so project administrators can understand the
  automation flow without reading JavaScript or Playwright selectors.

  Scope:
  The scenario logs in, opens the configured Construction Delivery project, navigates to
  User Management, opens the Invite Users popup, enters one user invitation row, and verifies
  that the prepared email remains visible in the form.

  Safety:
  The default scenario is intentionally a dry run. It does not click Send Invites, does not
  create a real user invitation, and does not change project access. Use this scenario to
  confirm that the page, popup, organization dropdown, and role dropdown are working.

  Background:
    Given I log in to the Construction Delivery application
    And I select the configured Construction Delivery project
    And I open the User Management page from the left navigation

  @user-management @dry-run
  Scenario: Prepare one Project Admin invite without sending it
    This scenario is the safe User Management baseline.
    It confirms that an administrator can reach the Invite Users popup and prepare
    a Project Admin invite for the configured organization. The automation stops
    before submission so no email is sent and no user is added.

    When I open the Invite Users popup
    And I enter the following invite details:
      | email        | organization | role          |
      | generated    | Neuralrays   | Project Admin |
    Then the Invite Users popup should show the prepared user email
    And the automation must stop before clicking Send Invites
