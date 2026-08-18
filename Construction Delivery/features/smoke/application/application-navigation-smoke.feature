@smoke @smoke-login @smoke-dashboard @smoke-navigation
Feature: Construction Delivery - Smoke Navigation
  Purpose:
  This smoke suite confirms that the Buckingham Palace Construction Delivery project is accessible
  and that the critical application modules load without changing shared application data.

  Background:
    Given I log in to the Construction Delivery application
    And I select the configured Construction Delivery project

  @smoke-booking @smoke-equipment-management @smoke-analytics @smoke-user-management
  Scenario: Critical modules are available for the configured project
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
