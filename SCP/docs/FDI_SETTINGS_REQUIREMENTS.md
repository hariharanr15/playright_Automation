# FDI Config: Add "FDI Settings" Section

**Application:** SCP

**Area:** FDI Config

**Companion story:** [FDI Inspection Report: Conditional Notes, Photo Upload & Spec Document Links driven by FDI Settings](FDI_INSPECTION_REPORT_REQUIREMENTS.md).

## Current behavior

The FDI Config page has a "Notification Settings" section at the top, followed by the Inspectors section and Questions list. Notification Settings contains descriptive text with no working controls. There are no controls for Overall Notes, photo uploads, mandatory photos, or links to Submittal Spec Documents.

## Required behavior

1. Replace the "Notification Settings" heading with "FDI Settings".
2. Under "FDI Settings", add four Yes/No checkbox controls, where checked = Yes and unchecked = No, with these exact labels:
   - Need Overall Notes to be captured
   - Enable Uploading of Photos?
   - Photos are mandatory?
   - Provide Link to Submittal Spec Documents?
3. Settings are per-project, using the same scope as the rest of FDI Config, and are persisted via Save.
4. These settings drive the companion Inspection Report behavior.
5. All four settings default to No when the project has no prior configuration.
6. Mandatory photos cannot be effectively enabled while photo uploads are disabled. The UI must disable/uncheck the mandatory-photo control or clearly flag and prevent saving the contradictory configuration.

## Acceptance Criteria

1. The FDI Config page section previously titled "Notification Settings" now reads "FDI Settings".
2. Under FDI Settings, four checkboxes are displayed with the exact labels: "Need Overall Notes to be captured", "Enable Uploading of Photos?", "Photos are mandatory?", and "Provide Link to Submittal Spec Documents?".
3. Checking a checkbox and saving persists that setting as Yes (true) for the project; leaving it unchecked and saving persists it as No (false).
4. Reloading the FDI Config page after save shows the previously saved state of each checkbox correctly.
5. On a project with no prior configuration, all four checkboxes default to unchecked (No).
6. "Photos are mandatory?" cannot be effectively enabled unless "Enable Uploading of Photos?" is also Yes. The UI either disables/unchecks "Photos are mandatory?" when photo upload is off, or clearly flags the inconsistency and prevents saving the contradictory configuration.
7. Changes to FDI Settings only affect the project they were changed on; other projects' FDI Settings are unaffected.
