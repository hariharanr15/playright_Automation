Feature: Construction Delivery - Main Application Modules
  Purpose:
  This feature is the high-level navigation checklist for the Construction Delivery application.
  It confirms that the automation user can open each main module from the configured project
  and see the expected screen content.

  Scope:
  The scenario covers the primary modules used by operations and project administrators:
  Booking List, Calendar, Project Management, User Management, Equipment Management,
  Analytics, Environment Reports, My Account, My Organization, and Notification Preferences.

  Safety:
  This feature is read-only by design. It validates navigation and page readiness only.
  It must not create bookings, upload files, send user invitations, edit project settings,
  update notification preferences, change account details, or delete records.

  Expected outcome:
  Every listed module should open successfully and show a stable screen marker that proves
  the page is ready for review.

  Background:
    Given I log in to the Construction Delivery application
    And I select the configured Construction Delivery project

  @construction-delivery @navigation @safe
  Scenario: Review every main Construction Delivery module without changing data
    This scenario acts as an executable table of contents for Construction Delivery.
    Each row names the module to open and the text that should be visible when the
    module is ready. If a module fails to open or the expected marker is missing,
    the scenario fails with the module name and current URL.

    When I open the following Construction Delivery modules:
      | module                   | expected screen marker                                      |
      | Booking List             | Booking List                                                |
      | Calendar                 | Calendar                                                    |
      | Project Management       | Project Details                                             |
      | User Management          | Invite Users                                                |
      | Equipment Management     | List Of Equipment                                           |
      | Analytics                | Summary Emission, Vehicle Emissions, Equipment Emissions    |
      | Environment Reports      | Environment Reports                                         |
      | My Account               | My Details, My Preferences                                  |
      | My Organization          | Organization                                                |
      | Notification Preferences | Notification Preferences, My Bookings                       |
    Then each requested Construction Delivery module should be ready for review
    And no data-changing action should be performed

  @construction-delivery @project-management @chrome @safe
  Scenario: Review Project Management in Chrome without changing data
    This scenario opens the Project Management area for the configured
    Construction Delivery project. It verifies the main Project Management
    screens are ready for review and stops before editing project information,
    settings, access points, resources, availability, emissions, or UOM data.

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
