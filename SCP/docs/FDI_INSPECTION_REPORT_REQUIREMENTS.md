# FDI Inspection Report Requirements

**Application:** SCP

**Area:** Main menu > First Delivery Inspection > Inspection Report (fill / view / edit)

**Dependencies:** [FDI Config: Add "FDI Settings" section](FDI_SETTINGS_REQUIREMENTS.md), which introduces the four project-level toggles, and the companion Spec Documents story, which defines document linkage through Spec Section No.

## Current behavior

The Inspection Report form presents the configured inspection questions. An Observation/Notes section exists but is not configurable. The report does not support photo attachments or a minimum photo count, and does not display Submittal Spec Documents linked to the delivery's Component/PO.

## Required behavior

1. **Overall Notes:** When "Need Overall Notes to be captured" is Yes, show an "Observation/Notes" free-text section at the end of the Inspection Report form. When No, hide the section entirely.
2. **Photo upload:** When "Enable Uploading of Photos?" is Yes, show a Photos section allowing the inspector to upload one or more photos while filling or editing an authorised report. Accept JPG, PNG, and other supported common image formats; reject non-image files with a clear error. Display uploaded photos as thumbnails in both view and edit modes. Clicking a thumbnail opens a full-size popup/lightbox with Previous/Next navigation through that report's photos.
3. **Mandatory photos:** When "Photos are mandatory?" is Yes, block Submit if there are no uploaded photos and show a clear validation message. Save remains allowed without a photo. When No, photo count does not block submission.
4. **Spec document link:** When "Provide Link to Submittal Spec Documents?" is Yes, display documents linked through Spec Section No to the submittal associated with the inspected delivery's Component/PO. Show thumbnails and file names; clicking a thumbnail opens a popup document viewer. If the submittal has a Spec Section No but no linked documents, show a clear no-documents state. If its Spec Section No is empty, show exactly: "No Spec Section No provided in submittal." When the setting is No, hide the section.

Use **Spec Section No** consistently for the submittal field referred to as "Spec No" in the supplied description.

The FDI Settings story requires all four settings to default to No for projects with no prior configuration. It also prevents contradictory settings: "Photos are mandatory?" cannot be effectively enabled unless "Enable Uploading of Photos?" is Yes. Changes take effect through Save and apply only to the selected project.

## Acceptance Criteria

1. With "Need Overall Notes to be captured" = Yes on the project, the Inspection Report form shows an "Observation/Notes" free-text field at the end of the form.
2. With "Need Overall Notes to be captured" = No, the Observation/Notes section does not appear anywhere on the form.
3. With "Enable Uploading of Photos?" = Yes, a Photos section is available on the report allowing the inspector to add one or more photos.
4. With "Enable Uploading of Photos?" = No, no photo upload section appears on the report.
5. Attempting to upload a non-image file (for example, .pdf or .docx) is rejected with an error message; JPG, PNG, and other supported common image formats upload successfully.
6. Uploaded photos display as thumbnails on the report in both edit and view modes.
7. Clicking any photo thumbnail opens a popup viewer showing that photo full-size, with Previous/Next arrows that navigate through all photos on the report without closing the popup.
8. With "Photos are mandatory?" = Yes and zero photos uploaded, clicking Submit is blocked with a validation message; Save still succeeds.
9. With "Photos are mandatory?" = Yes and at least one photo uploaded, Submit succeeds, provided all other submission requirements are satisfied.
10. With "Photos are mandatory?" = No, Submit succeeds regardless of photo count, provided all other submission requirements are satisfied.
11. With "Provide Link to Submittal Spec Documents?" = Yes, the report shows the documents linked to the Spec Section No of the submittal tied to the delivery's Component/PO, displayed as thumbnails with file names.
12. Clicking a linked spec document thumbnail opens that document in a popup viewer.
13. With "Provide Link to Submittal Spec Documents?" = Yes and a Spec Section No present but no documents linked to it, the section displays a clear empty/no-documents state instead of an error.
14. With "Provide Link to Submittal Spec Documents?" = Yes but no Spec Section No on the submittal, the section displays "No Spec Section No provided in submittal." instead of an error.
15. With "Provide Link to Submittal Spec Documents?" = No, the spec document section does not appear on the report.
16. All four behaviors are evaluated per project using that project's current FDI Settings and update immediately for reports going forward when settings change. Already-completed reports do not need to be altered.

## Access rules

The [FDI access acceptance criteria](FDI_ACCEPTANCE_CRITERIA.md) also apply. Responsible-user status alone grants FDI View access; it does not grant Fill or Notify access. These settings do not independently grant report editing or submission permissions.

## Clarifications required before implementation

- Specify the full supported image-format list and upload size/count limits.
- Confirm whether "reports going forward" includes existing saved drafts, and how changed settings affect an already-completed report that is later opened for editing.
