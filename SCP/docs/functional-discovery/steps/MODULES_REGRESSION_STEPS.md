# All Modules Regression – step-by-step flows

- Spec: `tests/pm-flow/app-regression.spec.js` (suite "All Modules Regression")
- Command: `npm run modules:regression`
- Modules: User Management, Supplier List, First Delivery Inspections, Document Management, International / Enterprise Shipments, Management Dashboard, Enterprise, Analytics
- Run tag: `APR` + 10 digits from the current time (`APRyyMMddHHmm`), e.g. `APR2611061030`. Data created by the run uses it:
  - invited user `um.<run tag lower case>@yopmail.com`
  - suppliers `Supplier <run tag>` and `Subcon <run tag>`
  - files `<run tag>-spec.pdf`, `-po.pdf`, `-epd.pdf`, `-big.pdf`
- Preconditions (APP-REG-SETUP): sign in to SCP staging as Project Admin and open project NRVC_Hall. If this fails the whole suite is aborted.
- Shared data the suite relies on:
  - Run submittals created by the Procurement regression (`PLT/PLR/PLS<10 digits>-SUB`), used by DOC-REG-13 and SHP-REG-02.
  - A first-delivery inspection with status "Auditor Not Yet Assigned" for a run material (created by pl-regression-3, `npm run procurement:regression3`), used by FDI-REG-06 to 10.
  - The standard test material (shown as `<material>` below, "43 Inches" in the Supplier List scenarios) and existing notifications, alerts and tasks on the Management Dashboard.
- Writes are run-tagged; only run-owned records are deleted.

## Setup

### APP-REG-SETUP – Sign in (Setup)
| # | Action | Expected |
|---|---|---|
| 1 | Sign in to SCP staging as Project Admin and select project NRVC_Hall; the run tag is noted | Signed in on NRVC_Hall |

## User Management

### UM-REG-01 – Send Invites needs email + role (Negative)
| # | Action | Expected |
|---|---|---|
| 1 | User Management (/user-management) › "Invite Users" | Dialog opens with email field, "Choose Role" and "Send Invites" |
| 2 | Leave email empty and role unchosen | "Send Invites" is disabled |
| 3 | Enter email "not-an-email" and choose role "Subcontractor" | "Send Invites" stays disabled |
| 4 | Enter a valid email (the run user), leave organization empty | "Send Invites" is enabled (organization is optional, UM-REG-04) |
| 5 | Click "Add Another User" | A second email row appears; "Send Invites" is disabled again (UM-REG-05) |
| 6 | Click "Cancel" | Dialog closes, nothing sent |

### UM-REG-04 – Organization optional (Positive)
Not automated – covered as step 4 of UM-REG-01.

### UM-REG-05 – Add Another User (Positive)
Not automated – covered as step 5 of UM-REG-01.

### UM-REG-02 – Invite a user (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | User Management › "Invite Users"; enter the run email; "Choose Role" "Subcontractor"; "Send Invites" | Toast "Invite Sent Successfully" |
| 2 | Reopen User Management; search the run email in "Search users" | Row shows Status "Invited" and role "Subcontractor" |

### UM-REG-03 – Duplicate invite rejected (Negative)
Precondition: UM-REG-02 passed (else skipped: "UM-REG-02 failed").
Note: OBS-UM-1 (duplicate invite accepted) is raised if the success toast appears.

| # | Action | Expected |
|---|---|---|
| 1 | "Invite Users"; enter the run email in upper case; role "Project User"; "Send Invites"; note the toast; "Cancel" if the dialog is open | No "Invite Sent Successfully" toast (duplicate rejected) |
| 2 | Reopen User Management; search the run email | Role is still "Subcontractor" |

### UM-REG-06 – Search users (fragment, case ignored) (Positive)
Precondition: UM-REG-02 passed.

| # | Action | Expected |
|---|---|---|
| 1 | User Management; type the run tag in upper case in "Search users" and press Enter | Exactly one row, the run user |

### UM-REG-07 – Change Project Role persists (Positive)
Precondition: UM-REG-02 passed.
Note: OBS-UM-2 (role change not persisted) is raised if the role is lost after reload.

| # | Action | Expected |
|---|---|---|
| 1 | Click the run user row to open the profile; set "Project Role" to the other role (Supplier if currently Subcontractor, else Subcontractor); "Save" | Toast "User profile updated successfully" |
| 2 | Reload; search the run email | Row shows the new role |

### UM-REG-11 – Filter narrows rows (Positive)
Precondition: UM-REG-02 passed.
Note: OBS-UM-4 (filter tabs offer no values).

| # | Action | Expected |
|---|---|---|
| 1 | User Management; note the row count; "Filter" › tab "status" › "Invited" › "Apply Filter" | Filter tab lists values; every remaining row has Status "Invited" (counts before/after noted) |

### UM-REG-08 – Remove From Project (run user) (Positive)
Precondition: UM-REG-02 passed.
Note: OBS-UM-3 / Q-UM-3 (removed with no confirmation step, or user still listed).

| # | Action | Expected |
|---|---|---|
| 1 | Search the run email; open its profile; "Remove From Project"; confirm if a confirmation appears | Toast "User Removed Successfully" (a missing confirmation is only noted) |
| 2 | Reload; search the run email | User is no longer listed |

### UM-REG-09 – Invite → accept → active (Integration)
Not automated – Needs the invited user to accept from the mailbox; covered by the PM Cucumber invite flow (FDI-18 pattern).

### UM-REG-10 – Role access applies to screens (Role)
Not automated – Changes the shared Roles configuration; covered by PM role scenarios (R40–R43).

## Supplier List

Supplier List is under User Management in the menu (User Management › Supplier List, /supplier-list).

### SL-REG-01 – Required fields (Negative)
| # | Action | Expected |
|---|---|---|
| 1 | Supplier List › "Add Supplier"; click "Save" with the form empty; then "Cancel" | "… is required" shown for Supplier Name, Line 1, Town/City, State/Region, Zipcode, Country, Contact Person, Contact Email, Contact Phone (9 messages) |

### SL-REG-04 – Invalid email gets an app message (Negative)
Note: OBS-SL-1 (invalid email blocked only by the browser check, no app message).

| # | Action | Expected |
|---|---|---|
| 1 | Note the supplier count; "Add Supplier"; fill "Supplier <run tag> bad" with Contact Email "not-an-email" and valid other fields; "Save"; cancel; reopen the list | An app message about an invalid email is shown; supplier count unchanged |

### SL-REG-02 – Add supplier (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | "Add Supplier"; Supplier Name "Supplier <run tag>"; Line 1 "1 Test Street", Town/City "Chennai", State/Region "Tamil Nadu", Zipcode "600001", Country "India"; Contact Person, Contact Email (run-tag yopmail address), Contact Phone no. "9876543210"; "Save" | Toast "Supplier added successfully" |
| 2 | Reopen Supplier List; search the run tag | Row has Type "Supplier" and a numeric Supplier ID |

### SL-REG-03 – Duplicate name (case/space) rejected (Negative)
| # | Action | Expected |
|---|---|---|
| 1 | "Add Supplier" with the supplier name in lower case with leading/trailing spaces, other fields valid; "Save"; then "Cancel" | Message "… already exists in this project" |

### SL-REG-05 – Add as subcontractor (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | "Add Supplier"; Supplier Name "Subcon <run tag>"; switch on "Is Sub-Contractor"; other fields valid; "Save" | Toast containing "added successfully" (toast and any form errors are noted) |
| 2 | Reopen Supplier List; search the run tag | "Subcon <run tag>" row has Type "Subcontractor" |

### SL-REG-07 – Map material validation (Negative)
Precondition: SL-REG-02 passed (else skipped).

| # | Action | Expected |
|---|---|---|
| 1 | Search the run tag; "Supplier <run tag>" row "⋮" › "Map Material"; "Add Item Mapping"; "SUBMIT" with no material | Message "Select a material before saving." |

### SL-REG-06 – Map material <material> (Positive)
Precondition: SL-REG-02 passed. Normally continues in the dialog left open by SL-REG-07.

| # | Action | Expected |
|---|---|---|
| 1 | In Map Material for the run supplier (reopen via row "⋮" › "Map Material" › "Add Item Mapping" if closed): "Choose Material" the test material; Lead Time (Weeks) 2; "SUBMIT" | A mapping row for the material shows lead time 2 |

### SL-REG-08 – Mapping drives Procurement material list (Integration)
Precondition: SL-REG-02 passed (and the mapping from SL-REG-06).

| # | Action | Expected |
|---|---|---|
| 1 | Procurement Log › "Add Submittal"; "Choose Suppliers" the run supplier; open "Choose Materials"; close the dialog | The only material offered is the mapped test material |

### SL-REG-12 – Edit supplier (Positive)
Precondition: SL-REG-02 passed.

| # | Action | Expected |
|---|---|---|
| 1 | Search the run tag; run supplier row "⋮" › "Edit"; Contact Person "Edited <run tag>"; "Save"/"Update" (toast noted); reopen and search | Row shows Contact Person "Edited <run tag>" |

### SL-REG-09 – Bulk map page (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Supplier List › "Bulk Map Material to Supplier"; check "← Supplier List" link; filter by supplier name "Subcon <run tag>"; tick the test material in its row (column checkbox, else the row checkbox); "Map Suppliers to Materials" | Button becomes enabled and mapping is submitted (toast noted) |
| 2 | Reopen Supplier List; search the run tag; "Subcon" row "⋮" › "Map Material" | A row for the test material is listed |

### SL-REG-10 – Supplier List Upload – template round trip (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Supplier List › "Upload" › "Supplier List Download Template" | Template .xlsx downloads (header row noted) |
| 2 | Note the supplier count; "Upload" › "Supplier List Upload"; choose the downloaded empty template; reopen the list | Rejected with a message (noted); supplier count unchanged |

### SL-REG-11 – Supplier Map Upload – template round trip (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Supplier List › "Upload" › "Supplier Map Download Template" | Template .xlsx downloads (header row noted) |
| 2 | Note the supplier count; "Upload" › "Supplier Map Upload"; choose the downloaded empty template; reopen the list | Rejected with a message (noted); supplier count unchanged |

### SL-REG-14 – Export rows = list count (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Supplier List: note the "<n> suppliers" count; click "Export" | Downloaded .xlsx has n data rows (excluding header) |

### SL-REG-13 – Delete supplier (run-owned) (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Search the run tag; "Subcon <run tag>" row "⋮" › "Delete"; confirm (Delete/Confirm/Yes) if asked (toast noted); reopen and search | "Subcon" supplier is no longer listed |

### SL-REG-15 – Promote to SSO Organisation (Positive)
Not automated – Changes organisations/login; not executed without explicit approval.

## First Delivery Inspections

### FDI-REG-04 – Filters narrow rows (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | First Delivery Inspections (/first-delivery-inspections): note the row count; status dropdown "All Statuses" › "Inspection Completed"; then back to the first option | Only "Inspection Completed" rows while filtered; original row count after reset |
| 2 | Type "zz-nobody@example.com" in "Inspector email"; then clear it | "No inspections found." |

### FDI-REG-05 – No FDI audit trail (PL-R10) (Info)
| # | Action | Expected |
|---|---|---|
| 1 | Open First Delivery Inspections | No "Audit Trail" control on the page |

### FDI-REG-01b – One inspection per material (FDI-R1) (Negative)
| # | Action | Expected |
|---|---|---|
| 1 | Open First Delivery Inspections; read the Material column of every row | No material appears in more than one row |

### FDI-REG-01 – First delivery creates one inspection (Integration)
Not automated – Runs in pl-regression-3 (new material → GRN → FDI row).

### FDI-REG-01a – Second delivery creates none (Negative)
Not automated – Runs in pl-regression-3.

### FDI-REG-01c – Access needed (Role)
Not automated – Needs a role without FDI access; changing shared roles is out of scope (PM role scenarios cover the model).

The next scenarios (FDI-REG-06, 07, 08, 09, 10 and the skipped 02, 11, 03) run only if the list holds a run inspection ("Auto Fdi…", "Pld…" or "PLT/PLR…" material) with "Auditor Not Yet Assigned". Otherwise all are skipped: no such inspection; run `npm run procurement:regression3` first.

### FDI-REG-06 – Self Assign (Positive)
Precondition: an "Auditor Not Yet Assigned" run inspection exists.

| # | Action | Expected |
|---|---|---|
| 1 | On that row click "Self Assign" (material noted) | Toast "You have been assigned as the auditor for this inspection" |
| 2 | Reload | The row shows "Awaiting Inspection Completion" and the signed-in user as assignee (FDI-REG-02) |

### FDI-REG-07 – Unassign Self and reassign (Positive)
Precondition: FDI-REG-06.

| # | Action | Expected |
|---|---|---|
| 1 | On the row click "Unassign Self"; reload | Row shows "Auditor Not Yet Assigned" |
| 2 | Click "Self Assign" again; reload | Toast "You have been assigned" |

### FDI-REG-02 – Assign inspector (Positive)
Not automated – Covered by FDI-REG-06 (self assignment is the assignment path for this role).

### FDI-REG-08 – Photo required (Negative)
Precondition: FDI-REG-07 (inspection assigned to the user).

| # | Action | Expected |
|---|---|---|
| 1 | On the row click "Fill Inspection Report" (opens the /form page); click "Submit Inspection" without a photo | Message "At least one photo is required before submitting this inspection." |

### FDI-REG-09 – Save Progress keeps answers (Positive)
Precondition: the form from FDI-REG-08 is still open.

| # | Action | Expected |
|---|---|---|
| 1 | Answer the first question "Fail"; type "<run tag> fail note" in its Observation box; click "Save Progress" | Progress saved (toast noted) |
| 2 | Reload the form | First Observation box still holds "<run tag> fail note" |

### FDI-REG-10 – Submit inspection (FAIL path, FDI-REG-11) (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Answer all other questions "Pass"; click "Add photo" and attach a small PNG; click "Submit Inspection" | "Inspection Detail" page opens |
| 2 | Check the detail page | Shows inspection completed, the "Fail" answer with "<run tag> fail note", "Not synced" and a "Sync to Provider" button |

### FDI-REG-11 – FAIL answer path (Positive)
Not automated – Covered by FDI-REG-10 (first answer Fail with observation) (skip reason is "FDI-REG-10 failed" if that scenario failed).

### FDI-REG-03 – Complete inspection form (Positive)
Not automated – Covered by FDI-REG-08…10.

### FDI-REG-12 – Sync to Provider (Integration)
Not automated – Pushes to Procore (external system); not executed.

## Document Management

### DOC-REG-01 – Search by filename/material (Positive) – All Documents
| # | Action | Expected |
|---|---|---|
| 1 | Document Management › All Documents; note the document count; type the test material in "Search by filename"; "Search" | Count is lower; every row mentions the material |
| 2 | Search "zz-no-such-file-zz"; then clear the search | "No documents found." and count 0 |

### DOC-REG-02 – Category filter (Positive) – All Documents
| # | Action | Expected |
|---|---|---|
| 1 | Set the Category dropdown to "PO File" | At least one row; every row has Category "PO File" |

### DOC-REG-03 – Module files appear (Integration) – All Documents
Four steps, one per category.

| # | Action | Expected |
|---|---|---|
| 1 | Category "Pdf" | First row listed with a Material |
| 2 | Category "PO File" | First row listed with a Material |
| 3 | Category "Delivery Photo" | First row listed with a Material |
| 4 | Category "Inventory" | First row listed (Material not checked) |

### DOC-REG-04 – Uploaded By is the real user (Positive) – All Documents
Note: OBS-DOC-1/2 (Uploaded By is not a user email).

| # | Action | Expected |
|---|---|---|
| 1 | Category "PO File"; read "Uploaded By" of the first row | Contains "@" (value noted) |
| 2 | Category "Pdf"; read "Uploaded By" of the first row | Contains "@" (value noted) |

### DOC-REG-05 – View / Download (Positive) – All Documents
| # | Action | Expected |
|---|---|---|
| 1 | Click "Download" on the first row | File downloads and is not empty |
| 2 | Click "View" on the first row | File opens in a new tab or in the page (noted); closed again |

### DOC-REG-06 – Spec document upload (Positive) – Spec Documents
| # | Action | Expected |
|---|---|---|
| 1 | Document Management › Spec Documents; upload a generated PDF "<run tag>-spec.pdf" through the file input | Upload is processed |
| 2 | Find the file's row | Status contains "uploaded"; "Uploaded by" is filled |

### DOC-REG-07 – Spec Section No add (Positive) – Spec Documents
Precondition: DOC-REG-06 passed (else skipped: "DOC-REG-06 failed").

| # | Action | Expected |
|---|---|---|
| 1 | On the spec file row click "Add"; in the "Spec Section No" picker choose the first section (not "None"); "Save"; reopen Spec Documents | Row's Spec Section No contains the chosen section |

### DOC-REG-08 – Spec document delete (run file) (Positive) – Spec Documents
Precondition: DOC-REG-06 passed.

| # | Action | Expected |
|---|---|---|
| 1 | On the spec file row click "Delete"; confirm if asked; reopen Spec Documents | Row is gone |

### DOC-REG-09 – Spec upload over 60 MB rejected (Boundary) – Spec Documents
| # | Action | Expected |
|---|---|---|
| 1 | Spec Documents: upload a 61 MB PDF through the file input | A size message (60 MB limit) is shown; the file is not listed |

### DOC-REG-10 – PO validation without line items (Negative) – PO Validation
| # | Action | Expected |
|---|---|---|
| 1 | Document Management › PO Validation; upload a generated PDF with no line items | Message "The uploaded file contains no line items." |

### DOC-REG-11 – PO validation with a valid PO (Positive)
Not automated – Needs a sample PO with line items (Q-DOC-3, Q-PL-13).

### DOC-REG-12 – BOM validation (Positive)
Not automated – Needs a sample BOM (Q-DOC-3).

### DOC-REG-13 – EPD upload sets Procurement "EPD Exists" = Yes (Integration) – EPD Report
Precondition: a run submittal from the Procurement regression exists in the EPD list.
Note: OBS-DOC-3 (EPD Exists not "Yes").

| # | Action | Expected |
|---|---|---|
| 1 | Document Management › EPD Report; choose the latest run submittal in the dropdown; attach a generated PDF; click "Upload" if enabled | Upload sent (submittal and toast noted); fails if no run submittal is listed |
| 2 | Procurement Log; search that submittal | "EPD Exists" column shows "Yes" |

### DOC-REG-14 – Non-EPD file not marked Completed (Negative) – EPD Report
Precondition: DOC-REG-13 upload.
Note: OBS-DOC-5 (non-EPD PDF accepted as Completed).

| # | Action | Expected |
|---|---|---|
| 1 | EPD Report; find the row of the run submittal | Status is not "Completed" (value noted) |

### DOC-REG-15 – EPD records list only EPDs (Positive) – EPD Report
Note: OBS-DOC-4 (non-EPD files listed).

| # | Action | Expected |
|---|---|---|
| 1 | EPD Report; read all listed rows | No row mentions QR, checklist or .png files |

### DOC-REG-16 – Scan Procore for EPDs (Integration)
Not automated – Procore link (external system); not executed.

## International / Enterprise Shipments

Shipments are logged in Enterprise › Enterprise Shipments and tracked in International Shipments.

### SHP-REG-01 – Log shipment validation (Negative)
| # | Action | Expected |
|---|---|---|
| 1 | Enterprise › Enterprise Shipments › "+ Log Shipment"; check the Submittal select; click "Log shipment" with nothing filled | Submittal is disabled until a Project is chosen; dialog stays open and no "Shipment logged" toast appears (message noted) |

### SHP-REG-02 – Log shipment for a run submittal (Positive)
Precondition: a run submittal from the Procurement regression is offered.

| # | Action | Expected |
|---|---|---|
| 1 | Enterprise Shipments › "+ Log Shipment"; Project NRVC_Hall; the latest run Submittal; Manufacturer name "Mfr <run tag>"; Manufacturer country "South Korea"; Container # "C<run tag>"; Port of origin "Busan"; Port of destination "Chennai"; "Log shipment" | Toast "Shipment logged." |
| 2 | Reopen Enterprise Shipments | A row for the submittal is listed |

### SHP-REG-03 – Initial status follows procurement (Q-SHP-1) (Integration)
Precondition: SHP-REG-02 passed (also for 04, 09, 05, 06, 08, 10; otherwise skipped: "SHP-REG-02 failed").
Note: OBS-SHP-1 (new shipment starts at "Pending Order").

| # | Action | Expected |
|---|---|---|
| 1 | Read Status of the logged shipment's row | Not "Pending Order" (value noted) |

### SHP-REG-04 – Edit shipping details (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | On the row click "Edit"; in "Edit shipping details" set Shipping line "Line <run tag>"; "Save"/"Update" | Toast "Shipping details updated."; reopened list shows "Line <run tag>" in the "Shipping Line" column |

### SHP-REG-09 – Open shows the shipment (Positive)
Note: OBS-SHP-3 (Open goes to the list, not the shipment).

| # | Action | Expected |
|---|---|---|
| 1 | Enterprise Shipments; search the submittal in "Search submittal…"; click "Open" on its row | The URL contains the submittal number |

### SHP-REG-05 – Status change persists (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | International Shipments (/international-shipments), wait for loading; note the "In Transit" tile; set the row's status select to "In Transit" | Status changes |
| 2 | Note the confirmation message (SHP-REG-06) | Toast text noted |
| 3 | Reopen International Shipments | Row status still "In Transit"; tile is one higher |
| 4 | Reopen Enterprise Shipments | The row's Status shows "In Transit" |

### SHP-REG-06 – Status change confirmation (Positive)
Note: OBS-SHP-2 (no confirmation on status change).

| # | Action | Expected |
|---|---|---|
| 1 | International Shipments; set the row's status select to "Shipped" | A confirmation toast appears (text noted) |

### SHP-REG-08 – Required Date from procurement (Integration)
Note: OBS-PL-19 (Required Date shows "-").

| # | Action | Expected |
|---|---|---|
| 1 | International Shipments; read "Required Date" of the row | Not "-" (value noted) |

### SHP-REG-10 – Search / filters (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Enterprise Shipments; type the submittal in "Search submittal…"; clear it | Every row contains the submittal |
| 2 | Tick "At-risk only"; untick it | No listed row shows "On Track" |

### SHP-REG-07 – Flag from Procurement listed once (Integration)
Not automated – Runs in Procurement regression (PL-REG-INT-02).

### SHP-REG-11 – Tabs render (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | International Shipments › tab "Delay Alerts" | No "error" / "something went wrong" text |
| 2 | Tab "Flag & Review" | No error text |
| 3 | Tab "Shipments" | No error text |
| 4 | Tab "Risk Dashboard" | No error text |

## Management Dashboard

### DSH-REG-01 – Mark as read (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Management Dashboard (/management-dashboard) › "Notifications" tab; if an "Unread" toggle/checkbox exists, use it; note the tab counter; click the envelope icon "Mark as read" on the first row | Toast "Marked as read!"; counter drops by 1 |

### DSH-REG-03 – Unread toggle (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Read the "Notifications" counter and count the listed rows | Rows are not more than the counter |

### DSH-REG-02 – Mark all as read on this page (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | "Notifications" tab; note counter and page rows; click "Mark all as read on this page" | Counter decreases |

### DSH-REG-04 – Delivery notification (Integration)
| # | Action | Expected |
|---|---|---|
| 1 | Management Dashboard › "Notifications" tab; look on the first page (then under "Unread") | An entry "Delivery of <n> units of <material> has been received at site for submittal …" is listed |

### DSH-REG-05 – Lead time notification (Integration)
| # | Action | Expected |
|---|---|---|
| 1 | "Notifications" tab; look on the first page (then under "Unread") | An entry "Lead time changed. New expected delivery …" is listed |

### DSH-REG-06 – New submittal alert (Integration)
| # | Action | Expected |
|---|---|---|
| 1 | "Alerts" tab; look on the first page (then under "Unread") | An entry "New submittal '<name>' was added." is listed |

### DSH-REG-07 – Create PO task (Integration)
| # | Action | Expected |
|---|---|---|
| 1 | "Tasks" tab; look on the first page (then under "Unread") | An entry "Create PO. Last Possible Ordering Date …" is listed |

### DSH-REG-08 – Pre-shipping task (Integration)
| # | Action | Expected |
|---|---|---|
| 1 | "Tasks" tab; look on the first page (then under "Unread") | An entry "Notification has been triggered for Pre-Shipping Checklist." is listed |

### DSH-REG-09 – Trigger Alert reaches the user (PL-R14, OBS-DSH-1) (Integration)
Note: OBS-DSH-1.

| # | Action | Expected |
|---|---|---|
| 1 | "Notifications" tab; look on the first page (then under "Unread") | An entry "Delivery for Item …" is listed |

### DSH-REG-10 – Daily alert batch (Integration)
Not automated – Two-phase (seed day 1, verify day 2).

### DSH-REG-11 – View in Procurement Log (Integration)
| # | Action | Expected |
|---|---|---|
| 1 | Management Dashboard: click "View in Procurement Log →" | Opens /procurement-log with "Only my watched" checked |

## Enterprise

### ENT-REG-01 – Enterprise counts match Procurement (Integration)
Not automated – Covered by the existing Enterprise suite (BUGS-325 oracle).

### ENT-REG-02 – Supplier Inbox lists run items (Integration)
| # | Action | Expected |
|---|---|---|
| 1 | Enterprise › Supplier Inbox; read the page and find run materials (Auto Fdi…, Pld…) that appear more than once (once in the filter list, once in a section) | At least one run material is listed under a section (counts noted) |

### ENT-REG-03 – Download CSV rows = table rows (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Enterprise › Enterprise View; count Supplier table rows (the table with "% of total"); click "Download CSV" | CSV data rows (excluding header) equal the table rows |
| 2 | Add up the "% of total" values in the Supplier table | Sum is about 100 (within 1.5) |

## Analytics

Analytics scenarios record the observed baseline (APP-R1).

### ANA-REG-01 – Search narrows SubContractor Issues (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Analytics › SubContractor Issues; note the row count; type the first 6 characters of the first row's first cell in "Search…" | Row count is not higher than before and is at least 1 |

### ANA-REG-02 – Export works (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | SubContractor Issues: clear "Search…"; click "Export" | Downloaded file is not empty |

### ANA-REG-03 – Status Report Generate (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | Analytics › Status Report; click "Generate" | At least one table is shown |

### ANA-REG-04 – Totals equal the sum of rows (Positive)
| # | Action | Expected |
|---|---|---|
| 1 | On the generated Status Report, for each table with a "Total" row add up every numeric column of the other rows | Each sum equals the Total value (number of columns checked noted) |

### ANA-REG-05 – TOV Analytics has its own page (Question)
Note: OBS-APP-1 (opens Supplier Issues), OBS-ANA-1 (menu does not navigate).

| # | Action | Expected |
|---|---|---|
| 1 | Open Management Dashboard; click menu Analytics › "TOV Analytics" (waits up to 20 s) | URL changes and is not /supplier-issues |
