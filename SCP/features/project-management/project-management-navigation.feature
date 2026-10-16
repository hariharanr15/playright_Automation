@projectManagement
Feature: SCP Project Management Reference Data
  Each module runs independently so a failed module does not block later coverage.

  Background:
    Given the "admin" user is logged into SCP
    And the user opens the Supply Chain Planner platform
    And the active SCP project is "NRVC_Hall"
    When the user opens Project Management
    Then the Project Management navigation is available

  @TC_PM_REF_001 @smoke @regression @positive @referenceData
  Scenario: Admin manages Common Utilities
    When the user opens Common Utilities from Reference Data
    And the user adds a unique currency common utility
    Then the new common utility is displayed in search results
    When the user updates the common utility name
    Then the updated common utility is displayed in search results

  @regression @positive @referenceData
  Scenario: Admin manages Common UoM
    When the user opens Common UoM from Reference Data
    And the user creates and updates a unique common UoM
    Then the updated common UoM is displayed in search results

  @regression @positive @referenceData
  Scenario: Admin manages Material Category
    When the user opens Material Category from Reference Data
    And the user creates and updates a unique material category
    Then the updated material category is displayed in search results

  @regression @positive
  Scenario: Admin configures Project Management options
    When the user opens Configuration Options
    And the user alternates and saves the Project Management alert values
    Then the alternating Configuration Options values are persisted
    When the user switches and saves the Project Management currency
    Then the alternate Project Management currency is persisted

  @regression @positive
  Scenario: Admin validates First Delivery Inspection settings
    When the user opens First Delivery Inspection Config
    And the user changes and saves one FDI setting
    Then the FDI setting change is persisted
    When the user validates the enabled settings on the First Delivery Inspection page
    Then the corresponding enabled FDI controls are available

  @regression @positive
  Scenario: Admin invites and validates an FDI inspector
    When the user opens First Delivery Inspection Config
    When the user sends a unique FDI inspector invitation
    Then the invited FDI user is pending acceptance
    When the user ensures an existing eligible FDI inspector for all materials
    Then the existing inspector is displayed with the selected role and scope
    When the user opens the invited mailbox in a separate browser context
    And the user accepts the invitation with the required password
    And the user completes the invited profile and address details
    And the activated user logs in and verifies FDI page access
    Then the activated user can open operational First Delivery Inspections
    When the activated user logs out and the separate browser context closes
    Then the original Admin browser session remains active
    When the Admin reopens First Delivery Inspection Config
    Then the activated invited inspector is Active and Enabled
    When the Admin disables the activated invited inspector
    Then the invited inspector is Disabled in configuration
    When the disabled inspector access is checked in a separate browser context
    Then the disabled inspector cannot self assign a First Delivery Inspection

  @regression @positive
  Scenario: Admin adds an FDI question
    When the user opens First Delivery Inspection Config
    When the user adds a unique FDI question with an answer type
    Then the unique FDI question is displayed

  @regression @positive @referenceData
  Scenario: Admin creates a material
    When the user opens Material Master
    And the user verifies required Material Master fields and creates a material
    Then the new material is displayed in Material Master

  @regression @positive
  Scenario: Admin adds an inventory balance rule
    When the user opens Inventory Control
    And the user verifies required inventory fields and adds a balance rule
    Then the inventory balance rule is displayed

  @regression @positive
  Scenario: Admin configures the PreShipping Checklist
    When the user opens PreShipping Checklist
    And the current run PreShipping question is created
    And the user enables the new FDI question with Text answer type for Procurement Log
    Then the PreShipping question remains enabled with Text configuration after reload

  @regression @positive
  Scenario: Admin creates a System Message
    When the user opens System Messages
    And the user creates the Codegen system message
    Then the System Message is created successfully

  @regression @positive
  Scenario: Admin configures Procurement Log fields
    When the user opens Procurement Log Configuration
    And the user verifies required log fields and ensures the Codegen field
    Then the procurement log field is displayed

  @regression @positive @referenceData
  Scenario: Admin creates a site
    When the user opens Site Details
    And the user verifies required site fields and adds the Codegen site
    Then the new site is displayed

  @regression @positive
  Scenario: Admin creates a procurement submittal
    When the user opens Procurement Log
    And the user creates a unique procurement submittal
    Then the new procurement submittal is displayed

  @regression @positive
  Scenario: Admin watches a material category on the dashboard
    When the user opens Watched Materials
    And the user adds a category watch using current-run data
    Then the watched-material configuration is created for that category
    When the user opens Management Dashboard for watched-material validation
    Then the same watched category is displayed on Management Dashboard

  @regression @positive
  Scenario: Admin checks Analytics and remaining controls
    When the user expands Analytics
    Then the Analytics navigation group is displayed
    When the user verifies Setup Wizard and Integrations controls
    Then the remaining Project Management controls are available
