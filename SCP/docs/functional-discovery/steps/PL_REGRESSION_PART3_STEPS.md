# Procurement Log Regression 3 – step-by-step flows

- Spec file: `tests/pm-flow/pl-regression-3.spec.js`
- Command: `npm run procurement:regression3`
- Scenario catalogue: `docs/functional-discovery/PL_REGRESSION_SCENARIOS.md`
- Run tag: `PLT<yymmddHHMM>` (taken from the run's start time, for example `PLT2611061140`). Every record created by the run carries this tag.
- Unique values per run: new material `Auto Fdi <yymmddHHMM>`; schedule ids are derived from the timestamp.
- Run records: submittal P (spec `<RUN>-SPEC-P`, description `<RUN> delivery chain`, Submittal no. `<RUN>-SUB-P`) and submittal Q (`<RUN>-SUB-Q`, description `<RUN> second`).
- Defaults used: supplier `LG`, material `43 Inches`, site `Warehoust _NR`, project NRVC_Hall, signed in as Project Admin.
- Shared data: submittal P with the new material and its component (QTY 12 after the edit) is reused by every scenario after it. One delivery of 4 units is logged and received (GRN) so that FDI, Inventory and International Shipments can be checked. The scenarios run in order; a failure in an early one aborts or skips the ones that depend on it.
- Dates: "today+28" means today plus 28 days, shown as dd/mm/yyyy.

### PL-REG3-SETUP – Sign in on the project (Setup)

| # | Action | Expected |
|---|---|---|
| 1 | Open the login page | Heading "Welcome To Voyage Control" is shown |
| 2 | Sign in with the Project Admin user | The user name heading is shown |
| 3 | Open Supply Chain Planner from the platform chooser | URL ends with /management-dashboard |
| 4 | Select the project (NRVC_Hall) | Project selected |
| 5 | Select the site (Warehoust _NR) | Site selected |
| 6 | Left menu › "Procurement Log" | Grid opens with at least one item listed |

## 1. List

### PL-REG-LST-20 – bulk_edit_log is accessible to Project Admin (PL-R7) (Role)

| # | Action | Expected |
|---|---|---|
| 1 | On Procurement Log page load, check the "bulk_edit_log" network responses captured since sign-in | At least one request was made and none returned 403 |

### PL-REG-LST-03 – Date inputs are read-only (Negative)

| # | Action | Expected |
|---|---|---|
| 1 | Inspect the "Start date" and "End date" boxes | Both have the read-only attribute |

### PL-REG-ADD-02 – Add Submittal required fields (Negative)

| # | Action | Expected |
|---|---|---|
| 1 | Click "Add Submittal", then click "Add" with every field empty; close the dialog | Messages shown: Spec selection no. is required, Spec description is required, Schedule Id is required, Submittal no. is required, Suppliers is required, At least one material is required |

### PL-REG-ADD-10 – Custom number field is saved (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Click "Add Submittal"; fill spec, description, Schedule Id and Submittal no. of P; choose supplier LG and material 43 Inches; if the form has a custom number field, enter 7; click "Add" | Toast "Submittal added successfully" |
| 2 | Search the Submittal no. of P | The custom number column of the new row shows 7 (if the project has no custom number field this is only noted) |

### PL-REG-ADD-11 – Spec value fills every Spec Section No column (Positive)

Precondition: submittal P created (PL-REG-ADD-10).

| # | Action | Expected |
|---|---|---|
| 1 | Read the row of P in the grid | Every "Spec Section No" column shows the spec value of P |

### PL-REG-LST-02 – Date range filters on Created At (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Clear the search and note the item count; set "Start date" to today; note the count; search the Submittal no. of P | Count with today as start is not larger than before; search finds exactly 1 row |
| 2 | Reload the page | Grid loads with items again (filter reset) |

### PL-REG-LST-14 – Second click sorts descending (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Reload; search "PLT"; click the "Submittal No" column header, read the column; click it again, read again | The order after the second click is the exact reverse of the first |

### PL-REG-LST-09 – Advanced Filter numeric operator (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Reload; "Filters" › "Add Condition"; choose the custom number field, operator ">=", value 7; "Apply Filter"; read the column | At least one row, and every value is 7 or more. Skipped (noted) if the project has no custom number field |

### PL-REG-LST-10 – Two conditions combine (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Reload; "Filters"; "Add Condition" twice: "Supplier Name" Contains LG, then "Submittal No" Contains the run tag; "Apply Filter" | Exactly 1 row is listed. The number of selects in the filter dialog is noted |

### PL-REG-LST-11 – Only my watched sends the watch filter (PL-R8) (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Reload; tick "Only my watched"; then untick it | The list request is sent with watched_only=1 (the request text is noted) |

## 3. Edit / responsible / cancel

### PL-REG-EDT-09 – Delete → Cancel keeps the record (Negative)

| # | Action | Expected |
|---|---|---|
| 1 | Reload; search the Submittal no. of P; open the row actions menu (last cell) › "Delete"; click "Cancel" | The record is still listed (1 row) |

### PL-REG-EDT-04 – Bulk Assign Responsible on two run rows (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | "Add Submittal" for run submittal Q (spec, description, Schedule Id, Submittal no., supplier LG, material 43 Inches) | Toast "Submittal added successfully" |
| 2 | Reload; search the run tag (2 rows); tick the checkbox of P and of Q; click "Assign Responsible"; check the text "selected submittals, replacing anyone assigned before"; "Choose user" › the signed-in user; click "Assign" | Toast "Responsible user assigned to 2 submittal(s)." |

### PL-REG-EDT-11 – Submittal No can be updated (PL-R12) (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Reload; search Q's Submittal no.; row menu › "Edit"; wait until the Submittal no. field is filled; append "-R"; click "Update"; open Procurement Log from the menu; search the new number | Exactly 1 row is found with the new Submittal no. |

## 6. Materials

### PL-REG-MAT-02 – New material form validation (Negative)

| # | Action | Expected |
|---|---|---|
| 1 | Reload; search P's Submittal no.; click the P description to open the submittal | Submittal detail opens |
| 2 | Click "New material"; click "Add" without choosing anything | Toast "Please choose a category" |

### PL-REG-ADD-12 – Create a new material and attach it (Positive)

Precondition: the "New material" form is still open from PL-REG-MAT-02 (it is reopened if not).

| # | Action | Expected |
|---|---|---|
| 1 | In the "New material" form: "Choose Category" › first category; name `Auto Fdi <stamp>`; "Choose Unit" › "Pieces"; Lead Time (Weeks) 1; click "Add" | Toast "Material added to submittal."; the "Materials:" line lists the new material |

### PL-REG-MAT-03 – Add an existing material from the list (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Click "+ Add material"; pick the first material in the list other than 43 Inches and the new material | The "Materials:" line lists the chosen material (name noted) |

## 4. Component on the new material

### PL-REG-CMP-04 – Add Component defaults: primary material, UoM read-only (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | In the submittal detail click "Add Component" | The dialog shows a material button marked "(primary)"; close the dialog |
| 2 | "Add Component": click the "(primary)" material button and choose the new material; Date Req. on Site today+28; QTY 10; Value 1000; (choose a Sub Material if asked); PO no. `<RUN>-PO-P`; PO Date today; click "ADD" | Toast "Schedule added successfully!" |

### PL-REG-CMP-05 – Currency defaults to the project currency (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Click "Add Component"; read the selected option of the last select; close the dialog | Selected option reads "Project default (XXX)" with a 3-letter currency code |

## Rolled-up values and deep links

Run only if the component was created (CMP-04); otherwise the run aborts here.

### PL-REG-LST-19 – Grid rolls up the component date and status (Integration)

| # | Action | Expected |
|---|---|---|
| 1 | Open Procurement Log from the menu; search P's Submittal no. | "Date Required On Site" is today+28 (dd/mm/yyyy) and "Status" is "Ordered" |

### PL-REG-LST-17 – Deep link opens the submittal (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Click the submittal description of P | Detail opens (URL has submittal=); the URL is remembered |
| 2 | Open Procurement Log from the menu, then go to the remembered URL | "Add Component" button visible and P's Submittal no. shown |

### PL-REG-CMP-07 – Order (Edit Component) changes the quantity (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | On the new material's component row click "Order"; in "Edit Component" set "QTY*" to 12; click "Update" | The component row shows 12 |

### PL-REG-CMP-11 – Audit Trail records the change (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Component row › "Other Actions ▾" › "Audit Trail"; check the entries; close the panel | Entries for "actual quantity" and for the signed-in user are listed |

### PL-REG-CMP-09 – Update Status to Ordered At Risk (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Component row › "Other Actions ▾" › "Update Status"; "Choose Status" › "Ordered At Risk"; comment `<RUN> at risk`; click "ADD"; reopen the submittal | Component status is "Ordered At Risk" |

Note: fails with the message "Update Status to Ordered At Risk left the status at …" when the app does not apply the status.

### PL-REG-CMP-14 – Shift ROJ skips committed (ordered) lines (Boundary)

| # | Action | Expected |
|---|---|---|
| 1 | Reopen the submittal; tick "Select this component" on the line; click "Shift ROJ Dates"; offset (days) 7; click "Preview"; then "Cancel" and "Clear" | Preview text "0 will move · 1 skipped" |

### PL-REG-CMP-19 – Values use the project currency symbol (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Reopen the submittal; expand the component row (button in its second cell); read "Value" | Value starts with ₹ (project currency INR) |

## 5. Delivery chain step by step

### PL-REG-DLV-01 – Log a full delivery (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Reopen submittal P; click the new material's component | Component view opens (URL has schedule=); the URL is remembered |
| 2 | Click "+ Log Delivery"; in "Add Delivery" open "Choose Item Name" and read the list (PL-R5, PL-REG-DLV-15); pick the new material; date today; "All Locations" › first location; quantity 4; click "Add" | Item names are listed; dialog closes; the delivery row shows 4 |

### PL-REG-DLV-19 – Required Remaining Qty subtracts logged deliveries (PL-R15) (Boundary)

| # | Action | Expected |
|---|---|---|
| 1 | Click "+ Log Delivery"; read "Required Remaining Qty"; close the dialog | Value starts with 8 (12 ordered − 4 logged) |

### PL-REG-DLV-03 – Checklist needs every answer and comment (Negative)

| # | Action | Expected |
|---|---|---|
| 1 | Reload the component view; click the "Pre Shipping Info" icon; click "Confirm Checklist" without answering | Toast "Answer every Questions" |
| 2 | Set every "Y/N" answer to "YES"; click "Confirm Checklist" with no comments | Toast "Please complete all fields before submitting." |

### PL-REG-DLV-04 – A NO answer blocks Confirm Checklist (PL-R16) (Negative)

| # | Action | Expected |
|---|---|---|
| 1 | Fill every comment input with `<RUN> answer n` and the supplier note textarea; set the first answer to "NO"; check "Confirm Checklist"; set that answer back to "YES"; check again | With "NO" the button is disabled; with "YES" it is enabled |

### PL-REG-DLV-05 – Confirm the checklist (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Click "Confirm Checklist" | Toast "Shipping Details updated successfully!"; the "Approve Pre-Shipping Checklist" icon appears |

### PL-REG-DLV-07 – Reject and resubmit the checklist (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Click the "Approve Pre-Shipping Checklist" icon; click "Reject" | The "Rejected" icon appears |
| 2 | Click the "Rejected" icon (opens "Update Pre-Shipping Details"); click "Confirm Checklist" | Toast "Shipping Details updated successfully!" |

### PL-REG-DLV-06 – Approve the checklist (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Click the "Approve Pre-Shipping Checklist" icon; enter comment `<RUN> approved`; click "Approve" | Toast "Checklist Generated Successfully!" |

### PL-REG-DLV-08 – Set the actual delivery date (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Reload the component view; click the delivery "Edit" icon; in "Edit Delivery" set the second date box (actual delivery date) to today; click "Update" | Dialog closes; the "Generate GRN" icon appears |

### PL-REG-DLV-09 – Shipping info (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Click the "Update Shipping Info" icon; in "Add Shipping Info" choose mode "Other"; first box `<RUN>-SHIP`; second box "Origin"; note `<RUN>`; click "Add" | Toast "Shipping Details updated successfully!" |

### PL-REG-DLV-10 – Delivery conditions (all good) (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Click the "Update Delivery Condition" icon; in "Add Delivery Conditions" enter 4 in the first number box (good quantity); click "Add" | Toast "Delivery Conditions updated successfully!" |

### PL-REG-DLV-11b – Generate GRN → Partial Delivery (4 of 12) (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Click the "Generate GRN" icon | Toast "GRN Generated Successfully!" (waits up to 30 s) |

### PL-REG-DLV-16 – Component header shows the unit of measure (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Reload the component view; read the value next to "Required QTY" in the header | Value is shown and does not contain "undefined" |

### PL-REG-DLV-17 – QR label downloads (PNG and PDF) (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Click "QR Label"; click "PNG sticker" and then "PDF sheet", each time waiting for the download; close the QR dialog | File names match `submittal-<8 hex>-qr.png` and `submittal-<8 hex>-qr.pdf` |

### PL-REG-DLV-18 – Files tab lists the component files (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Click the "Files" tab | The delivery table (Location column) is replaced by the files list |

## Integration checks (FDI, Inventory, International Shipments)

### PL-REG-INT-01 – First delivery of a new material creates one FDI record (FDI-R1) (Integration)

Precondition: GRN generated (PL-REG-DLV-11b). Otherwise: Not automated in this run – skipped with reason "GRN not generated".

| # | Action | Expected |
|---|---|---|
| 1 | Left menu › "First Delivery Inspections" (wait for the list) | Exactly one row for the new material |

### PL-REG-INT-03 – Received quantity reaches Inventory (Integration)

Precondition: GRN generated (PL-REG-DLV-11b). Otherwise skipped with reason "GRN not generated".

| # | Action | Expected |
|---|---|---|
| 1 | Left menu › "Inventory Management"; search the new material in "Search inventory…" | The row for the new material shows received quantity 4 |

### PL-REG-EDT-07 – International Shipments shows the procurement date and status (Integration)

| # | Action | Expected |
|---|---|---|
| 1 | Open Procurement Log; search P's Submittal no.; row menu › "Flag International"; country "South Korea"; click "Flag"; repeat once more | Toast "Submittal flagged as international shipment." both times |
| 2 | Left menu › "International Shipments" (wait for loading to finish) | Exactly one row for P (PL-REG-INT-02); the row text is noted |
| 3 | Check the row text | It contains the component Required Date (today+28, dd/mm/yyyy) |

### PL-REG-INT-04 – Log Configuration fields appear as grid columns (Integration)

| # | Action | Expected |
|---|---|---|
| 1 | Left menu › "Project Management" › "Procurement Log Configuration"; collect the fields whose checkbox is ticked; open Procurement Log; read the grid column headers | At most 20% of the enabled fields are missing as grid columns (missing names are noted) |

## 7. Alert rules

### PL-REG-ALR-02 – Create Alert validates required fields (Negative)

| # | Action | Expected |
|---|---|---|
| 1 | Search P's Submittal no.; row menu › "Alert"; click "Add Alert"; click "Submit" with nothing filled | No "Failed to create alert" status message (client-side required messages expected) |

Note: OBS-PL-28.

### PL-REG-ALR-03 – Edit an alert rule (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Reload; search P's Submittal no.; row menu › "Alert" › "Add Alert"; "Choose Field" › first field; "Choose Condition" › ">="; value 999 (never met, so the rule stays editable); message `<RUN> alert`; click "Submit" | Toast "Alert created successfully!" |
| 2 | Click the "Edit" icon of the new alert row; set value 998; click Submit/Update/Save | The alert row shows 998 |

### PL-REG-ALR-04 – Delete an alert rule (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Click the last icon (trash) of the `<RUN> alert` row; confirm if a Delete/Yes/Confirm button appears | The row disappears |

### PL-REG-ALR-05 – Alert fires (daily batch, two-phase) (Integration)

Not automated – alerts are produced by the daily batch (about 05:00–06:00 IST); verify on the next day.

## 8. Import / export

Each import: reload Procurement Log, click "Import", click the import kind (opens a file chooser), choose the generated xlsx, click "Upload", wait 3 s and read the status messages.

### PL-REG-IMP-07 – Template columns follow the log configuration (Integration)

| # | Action | Expected |
|---|---|---|
| 1 | Open Procurement Log › "Import" › "Download Template"; read the header row of the file | Contains Spec Description, Schedule Id, Material Name, Submittal No, Supplier Name, and the custom number field if there is one |

### PL-REG-IMP-04 – Import two rows (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | "Import" › "Import Submittal"; upload an xlsx with two rows (`<RUN> import 1` / `<RUN>-SUB-I1` and `<RUN> import 2` / `<RUN>-SUB-I2`, material 43 Inches, supplier LG, source "Manual"); "Upload"; search `<RUN> import` | The status messages are noted; 2 rows are found |

### PL-REG-IMP-03 – Import a duplicate Submittal No + Material is rejected (Negative)

| # | Action | Expected |
|---|---|---|
| 1 | "Import" › "Import Submittal"; upload one row `<RUN> import dup` reusing `<RUN>-SUB-I1` and material 43 Inches; "Upload"; search `<RUN> import dup` | Messages noted; 0 rows found |

### PL-REG-IMP-05 – Import a component (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | "Import" › "Import Component"; upload one row (date today+40, material 43 Inches, QTY 5, status "Not Ordered", Submittal No `<RUN>-SUB-I1`); "Upload"; search `<RUN>-SUB-I1` | The row `<RUN> import 1` shows Status "Not Ordered" |

### PL-REG-IMP-06 – Import a component for an unknown submittal fails (Negative)

| # | Action | Expected |
|---|---|---|
| 1 | "Import" › "Import Component"; upload one row for Submittal No `<RUN>-NO-SUCH`; "Upload" | Messages do not contain "All 1 components uploaded successfully" |

### PL-REG-IMP-09 – Export has the grid columns (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Reload; search the run tag; click "Export"; open the downloaded xlsx and compare its header row with the grid column headers | Every grid column is present in the export (fails with "Procurement Log export columns differ from the grid: …") |

### PL-REG-IMP-10 – Upload history lists the run uploads (Integration)

| # | Action | Expected |
|---|---|---|
| 1 | Left menu › "Project Management" › "Bulk Upload Status"; look for rows dated today and by the signed-in user | At least one such row is of type "Submittals" or "Components" |

## Deep link to a component

### PL-REG-LST-18 – Deep link opens the component view (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Go to the component URL remembered in PL-REG-DLV-01 | "+ Log Delivery" button visible (fails with "No component URL…" if none was captured) |
