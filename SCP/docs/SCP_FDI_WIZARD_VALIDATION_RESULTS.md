# SCP FDI and Wizard Validation Results

**Date:** 9 October 2026

## Passed

- Playwright discovery loaded 20 tests across the FDI and Project Setup Wizard regression modules.
- The live FDI Settings regression passed: heading/labels, saving/reloading Yes and No, mandatory-photo dependency, and original-setting restoration.
- The live inclusive delivery-date and combined-filter regression passed after adapting the automation to the deployed read-only calendar controls.

## Findings and incomplete validation

- The live listing action regression found **Reassign** on already-assigned records. The companion assignment requirement specifies the same **Assign** action for initial assignment and reassignment. The exact-label assertion remains to expose that mismatch; the assignment helper accepts both labels to test workflow behavior separately.
- The lifecycle run reached report photo upload after exercising procurement prerequisites, self-assignment/unassignment, Admin Assign, saved-answer reopening, conditional settings, no-linked-documents display, invalid-file rejection and mandatory-photo validation. It failed at the photo locator. Diagnosis found the dynamic **Photos (count)** label, asynchronous photo loading, and a lightbox without a dialog role. Those locators and upload waits were corrected.
- The final photo retest failed in the existing SCP platform authentication fixture after three SSO attempts, before executing report checks. Completed photo viewing and the final lifecycle are therefore not confirmed passing with the final code.
- Earlier photo runs also encountered trace-file streaming/corruption errors. The final diagnostic retry used `--trace=off`; default trace settings were not changed.
- Project Setup Wizard regression code was discovered successfully but has not been executed against a dedicated accessible wizard project. Set its documented environment variables before running it.
- Organisation/Responsible access, alternate inspector reassignment, project defaults/isolation, and spec-document viewers require seeded accounts/projects/records. Notification recipients and successful PDF delivery to Procore require integration evidence beyond UI feedback.

## Requirement conflicts retained for review

- Pending FDI View is prohibited by the base listing story but granted for every linked FDI by the Responsible-user story. This needs a product decision before assigning definitive pending Responsible-user expectations.
- The wizard description swaps the supplier and mapping footer notes. The requirement document and automation follow the explicit acceptance criteria.

See [FDI automation coverage](FDI_AUTOMATION_COVERAGE.md) and [wizard automation setup](PROJECT_SETUP_WIZARD_AUTOMATION.md) for fixture prerequisites and remaining checks.
