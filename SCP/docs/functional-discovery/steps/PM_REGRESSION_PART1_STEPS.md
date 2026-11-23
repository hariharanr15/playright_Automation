# Project Management Regression (part 1: read-only and form-only) – step-by-step flows

- Spec: `tests/pm-flow/pm-regression.spec.js`
- Command: `npm run pm:regression` (runs `node scripts/run-pm-flow.js regression`)
- Run tag: none. Part 1 creates no data, so there is no run tag; forms are closed with Cancel / X and nothing is saved.
- Scenario catalogue: `docs/functional-discovery/PM_REGRESSION_SCENARIOS.md`

**Common precondition (PM-REG-000, Sign in as Project Admin and select NRVC_Hall)**

| # | Action | Expected |
|---|---|---|
| 1 | Open the login page | Heading "Welcome To Voyage Control" shown |
| 2 | Sign in with the Project Admin user | The signed-in user name is shown in the header |
| 3 | Choose "Supply Chain Planner" on the platform chooser | URL ends with /management-dashboard |
| 4 | Select project NRVC_Hall (header project selector) | Project selected |

If sign-in fails the whole run is aborted.

**Shared data and rules**
- One sign-in and one browser tab for the whole suite; pages follow the left-menu order.
- The SCP_Testing_Ram (second project) checks run last, after one project switch; the run switches back to NRVC_Hall at the end.
- XER scenarios need the file in `PM_XER_FILE` (default `C:/Users/VC/Downloads/SPADE-OYM-1A-2A-BL-1-09-25-2026-1.xer`), which must already be imported in NRVC_Hall.
- Many scenarios rely on values recorded by earlier scenarios (plan count, task list, utility totals, Common UoM and Material Category names, FDI settings, first system message, first uploads).
- Invite scenarios use pm.reg.nosend@yopmail.com but never click "Send Invites".

## Navigation

### PM-REG-NAV-02 – Group buttons expand without navigating (read-only)
Repeated for the groups "Project Management" (child "Configuration Options"), "Integrations" (child "XER Import") and "Reference Data" (child "Common UoM").

| # | Action | Expected |
|---|---|---|
| 1 | In the left menu click the group; if it was already open, click again to reopen | Group expands and shows its first child; the page URL does not change |

### PM-REG-NAV-04 – Setup Wizard hidden once setup is complete (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Look at the left menu under "Project Management" for "Setup Wizard" | Not present |
| 2 | Browse directly to /setup-wizard | Wizard page opens |
| 3 | Read the "Project Setup" step list | Nine steps in order (Integration, Directory, Project Config, Sites, Material Category, Materials, Suppliers, Suppliers->Materials, First Submittal), at least nine "✓", and "Setup complete" shown |

## Integrations

### PM-REG-INT-01 – Booking: SCP Project ID pre-filled (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Left menu › Project Management › Integrations › "Booking Integration" | Page opens |
| 2 | Read the first input "SCP Project ID" | Value is PRJ followed by letters/digits |

### PM-REG-INT-07 – XER: existing plan listed (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Left menu › Project Management › Integrations › "XER Import" | Page opens |
| 2 | Read the plan buttons | Each reads "n/m visible · n mapped" with a dd/mm/yyyy date; plan count and name are recorded |

### PM-REG-INT-10 – XER: duplicate file detected by content (form-only)
Precondition: the XER test file exists on disk; otherwise this scenario is skipped (see below).

| # | Action | Expected |
|---|---|---|
| 1 | XER Import: click "Import" and choose the already imported .xer file | File is submitted |
| 2 | Wait for the duplicate check (up to 4 minutes) | "Plan already imported" and text "This file was already imported as "…"" shown, with buttons "Open existing plan" and "Import anyway" ("Import anyway" is not clicked) |

If the XER file is not found: Not automated – XER test file not found; set PM_XER_FILE.

### PM-REG-INT-11 – XER: Open existing plan creates no copy (read-only)
Precondition: PM-REG-INT-10 ran (dialog still showing). If the XER file is not found: Not automated – Depends on PM-REG-INT-10.

| # | Action | Expected |
|---|---|---|
| 1 | Click "Open existing plan" | Existing plan opens |
| 2 | Look at the plan view and the plan list | "Manage tasks" shown; number of "n/m visible" plans equals the count recorded in PM-REG-INT-07 |

### PM-REG-INT-21 – XER: Manage tasks opens with nothing ticked (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Open the plan (click its "n/m visible" button if the plan view is not already open); record visible task IDs and plan header | Plan view with "Manage tasks" shown |
| 2 | Click "Manage tasks" | "Select tasks to display" dialog opens and its task total loads (not 0) |
| 3 | Read the "x of y selected" counter and the Save button | 0 selected although tasks are visible; button reads "Save (0 tasks)" |

### PM-REG-INT-19 – XER: Task Selection columns (read-only)
Precondition: Manage tasks dialog open (from PM-REG-INT-21).

| # | Action | Expected |
|---|---|---|
| 1 | Read the table headers | WBS, Task ID, Task Name, Type, Planned Start, Planned Finish |

### PM-REG-INT-25 – XER: available filters (read-only)
Precondition: Manage tasks dialog open.

| # | Action | Expected |
|---|---|---|
| 1 | Check the filter controls | "Search task name or ID…" box; WBS dropdown whose first option is "All WBS"; Type dropdown with All types, TT_FinMile, TT_Task, TT_Mile, TT_LOE; no date filter |

### PM-REG-INT-12 – XER: Manage tasks filters (read-only)
Precondition: Manage tasks dialog open.

| # | Action | Expected |
|---|---|---|
| 1 | Search "CMDA1-MS-110", then clear the search | Rows are listed and every row contains that Task ID |
| 2 | Set WBS filter to "CMDA"; then back to "All WBS" | Fewer rows than total; "Select all matching" count equals rows listed; selected counter stays 0 |
| 3 | Set Type filter to "TT_FinMile"; then back to "All types" | Fewer rows; every row has Type TT_FinMile; "Select all matching" count equals rows listed |

### PM-REG-INT-14 – XER: selection persists across search (read-only)
Precondition: Manage tasks dialog open.

| # | Action | Expected |
|---|---|---|
| 1 | Search DC1-CS-BUE-1170 and tick it; search DC1-CS-BUE-1180 and tick it | Counter shows 2 selected |
| 2 | Clear the search; check both tasks; click "Deselect all" | Both are still ticked; after "Deselect all" the counter shows 0 |

### PM-REG-INT-16 – XER: row click selects a task (read-only)
Precondition: Manage tasks dialog open.

| # | Action | Expected |
|---|---|---|
| 1 | Search DC1-CS-BUE-1170 and click its row | Task ticked; counter shows 1 |
| 2 | Search DC1-CS-BUE-1180 and click its row checkbox directly | Checkbox becomes ticked |
| 3 | Clear the search and click "Deselect all" | Counter shows 0 (nothing saved) |

### PM-REG-INT-13 – XER: Save with 0 selected (not clicked) (read-only)
Precondition: Manage tasks dialog open with nothing ticked.

| # | Action | Expected |
|---|---|---|
| 1 | Look at the Save button | Reads "Save (0 tasks)" (not clicked) |
| 2 | Click "Cancel" | Dialog closes; the visible task list is unchanged |

### PM-REG-INT-20 – XER: visibility survives refresh (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Reload the page and click the plan button | Plan view with "Manage tasks" opens |
| 2 | Compare visible task IDs and plan header with the values recorded before | Identical |

## Reference Data

### PM-REG-REF-01 – Utilities search by name (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Left menu › Project Management › Reference Data › "Common Utilities" | Page opens |
| 2 | Note the item count; type "INR" in "Search utils…" | Item count changes; every row's name or type contains "INR" |

### PM-REG-REF-02 – Utilities search by type (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Search "currency" | Rows listed; every row has type "currency_type"; currency names recorded |

### PM-REG-REF-03 – Utilities no-match search (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Search "zzqq-no-match" | Message 'No results for "zzqq-no-match"', count "0 items" and "No data found" |
| 2 | Clear the search | Item count returns to the original total |

### PM-REG-REF-04 – Utility Type dropdown options (form-only)

| # | Action | Expected |
|---|---|---|
| 1 | Click "Add Common Util" | "Add Common Utils" form opens |
| 2 | Open the "Choose CommonUtil Type" dropdown | Includes the 14 types: fdi_status, file_category, currency_type, inv_action_type, notification_type, shipping_mode, task_status, location_type, schedule_status, notification_category, bs_status, site_type, completion_status, preshipping_checklist_status (extra types are only logged) |

### PM-REG-REF-11 – Modal close behavior (form-only)
Precondition: the Add Common Utils form from PM-REG-REF-04 is open.

| # | Action | Expected |
|---|---|---|
| 1 | Press Escape | Form stays open |
| 2 | Close the form with the X | Form closes; item count unchanged (nothing created) |

### PM-REG-REF-19 – Search on UoM and Category lists (read-only)
Steps 1–2 are done for "Common UoM" (search box "Search UOM…") and then "Material Category" (search box "Search categories…").

| # | Action | Expected |
|---|---|---|
| 1 | Left menu › Project Management › Reference Data › the page | Page opens |
| 2 | Record the names in the first column; search the first name; search "zzqq-no-match"; clear the search | Only matching rows for the first name; the empty state ("No data found/available") for the no-match term |

## Configuration Options

### PM-REG-CFG-01 – Current values render (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Left menu › Project Management › "Configuration Options" | Page opens |
| 2 | Read the three week fields and the Archive, Currency and Integration dropdown values | Week values are not negative; at least three dropdown values shown; values recorded |

### PM-REG-CFG-02 – Dropdown option sets (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Open the "Archive Read Items After" dropdown | 30, 60, 90, 120, 150, 180, 360 days |
| 2 | Open the "Integration Provider" dropdown | None, Procore, Autodesk ACC |
| 3 | Open the "Currency Type" dropdown | Options equal the currency_type utilities from PM-REG-REF-02 (checked only if that scenario recorded them) |

### PM-REG-CFG-12 – Help icons (read-only)
Steps repeat for three labels.

| # | Action | Expected |
|---|---|---|
| 1 | Click the "?" (More info) icon of "Lead time confirmation (weeks)" | Tooltip contains "weeks before the required-on-site date we expect a confirmed lead time" |
| 2 | Click the "?" icon of "Not ordered alert (weeks)" | Tooltip contains "weeks before required-on-site after which an unordered item raises an alert" |
| 3 | Click the "?" icon of "Not booked alert (weeks)" | Tooltip contains "weeks before required-on-site after which an unbooked delivery raises an alert" |

### PM-REG-CFG-03 – Cancel discards changes (form-only)

| # | Action | Expected |
|---|---|---|
| 1 | Add 1 to the first week field; click the "GRN" toggle if present (do not Save) | Values changed on screen |
| 2 | Click "Cancel" | First week field returns to the saved value |

Note: when Cancel does not restore the value the step fails with DEF-C7 (the page is reloaded so nothing is saved).

## First Delivery Inspection Config

### PM-REG-FDI-01 – Section title and labels (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Left menu › Project Management › "First Delivery Inspection Config" | Page opens |
| 2 | Check the page | "FDI Settings" title; no "Notification Settings"; labels "Need Overall Notes to be captured", "Enable Uploading of Photos?", "Photos are mandatory?", "Provide Link to Submittal Spec Documents?"; "Save" button shown (not clicked); initial checkbox states recorded |

### PM-REG-FDI-02 – Mandatory photo depends on uploads (form-only)

| # | Action | Expected |
|---|---|---|
| 1 | Make sure "Enable Uploading of Photos?" is ticked, then click it to untick | Unticked; "Photos are mandatory?" is unticked and disabled (no Save) |

### PM-REG-FDI-02b – Re-enabling uploads re-enables the mandatory box (form-only)
Precondition: PM-REG-FDI-02 ran.

| # | Action | Expected |
|---|---|---|
| 1 | Click "Enable Uploading of Photos?" again to tick it | Ticked; "Photos are mandatory?" is enabled again |

### PM-REG-FDI-03 – Unsaved change discarded on reload (read-only)
Precondition: unsaved changes from PM-REG-FDI-02 / 02b.

| # | Action | Expected |
|---|---|---|
| 1 | Reload the page without saving | "FDI Settings" shown again |
| 2 | Read the four checkboxes | Same states as recorded in PM-REG-FDI-01 |

### PM-REG-FDI-10 – Inspector table content (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Read the inspector table headers | Name / Email, Role, Materials Scope, Status, Enabled, Actions |
| 2 | Read Status, Enabled and the action button of each row | At least one row; each row is "Active / Enabled / Disable", "Active / Disabled / Enable" or "Invited - Pending Acceptance / Disabled / Enable (disabled)"; scope summary not empty |

### PM-REG-FDI-29a – Pending invite stays disabled (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Look at rows with Status "Invited - Pending Acceptance" | At least one such row; Enabled "Disabled"; action button disabled with tooltip "Activates automatically once the invite is accepted" |

### PM-REG-FDI-11 – Invite opens the invite screen; Send disabled when empty (form-only)

| # | Action | Expected |
|---|---|---|
| 1 | Click "Invite" | "Invite Users" form opens |
| 2 | Check the tabs and the Send button | Tabs "Manual entry" and "From Procore directory"; "Send Invites" disabled |

### PM-REG-FDI-16 – Invite – role options (form-only)

| # | Action | Expected |
|---|---|---|
| 1 | Enter pm.reg.nosend@yopmail.com; open the "Choose Role" dropdown | All_Role_Access, Project Admin, Project Manager, Project Senior User, Project User, Subcontractor, Supplier |

### PM-REG-FDI-16a – Invite – Organization list is unique (form-only)

| # | Action | Expected |
|---|---|---|
| 1 | Open the "Choose Organization" dropdown | Each organization name appears once (fails and lists duplicates otherwise) |

### PM-REG-FDI-14 – Invite – valid email + role enables Send (form-only)

| # | Action | Expected |
|---|---|---|
| 1 | With the email entered, choose role "Project User" | "Send Invites" enabled (not clicked) |

### PM-REG-FDI-12 – Invite – malformed email (form-only)

| # | Action | Expected |
|---|---|---|
| 1 | Replace the email with "not-an-email" | "Send Invites" disabled |

### PM-REG-FDI-15 – Invite – additional empty row blocks Send (form-only)

| # | Action | Expected |
|---|---|---|
| 1 | Enter pm.reg.nosend@yopmail.com (Send enabled); click "Add Another User" | Second email row appears; "Send Invites" disabled again |
| 2 | Close the form (Cancel/X) | Form closes; nothing sent |

### PM-REG-FDI-13 – Invite – role required (form-only)

| # | Action | Expected |
|---|---|---|
| 1 | Click "Invite" ("Invite Users" opens); enter pm.reg.nosend@yopmail.com without a role | "Send Invites" disabled |

### PM-REG-FDI-17 – Invite – Procore tab (form-only)

| # | Action | Expected |
|---|---|---|
| 1 | Click "From Procore directory" | Note "Subcontractor role by default", "Search" button, "No users returned" and "Add to invite list" shown |
| 2 | Close the form (Cancel/X) | Form closes; nothing sent |

### PM-REG-FDI-20 – Add Inspector – scope options (form-only)

| # | Action | Expected |
|---|---|---|
| 1 | Click "Add Inspector" | "Add Inspector" form opens |
| 2 | Check the fields | "Project Member *", "Project Role *", "Materials Scope *"; radios "All Materials", "By Material Category", "Specific Materials"; only the first radio selected |
| 3 | Close the form without adding | Form closes |

### PM-REG-FDI-30 – Catch-all warning (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Look at the question-set area | Warning "No "All Categories" set …" shown while no catch-all set exists |

### PM-REG-FDI-31 – New Question Set – form (form-only)

| # | Action | Expected |
|---|---|---|
| 1 | Click "New Question Set" | "New FDI Inspection Question Set" form opens |
| 2 | Check the fields | "Set Name *" (max length 200, placeholder "e.g. Steel Receiving Checks"); "Material Categories *" with "Specific categories" and "All Categories (catch-all)"; "Search categories"; categories used by another set show "(in: …)" and are disabled |

### PM-REG-FDI-33 – Set Name boundary (form-only)

| # | Action | Expected |
|---|---|---|
| 1 | Type 201 characters in "Set Name" | Field keeps only 200 |
| 2 | Close the form (Cancel/X) | Form closes; nothing created |

### PM-REG-FDI-35 – Manage Groups expand/collapse (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Click "Manage Groups (n)" | Groups table with "Heading Display Text" shows n rows |
| 2 | Click "Manage Groups" again | Groups table is hidden |

### PM-REG-FDI-37 – Add Question – answer types (form-only)

| # | Action | Expected |
|---|---|---|
| 1 | Click "Add Question" | "Add Question" form opens |
| 2 | Open the "Choose Answer Type" dropdown | Boolean, Text, Date, Pass/Fail/NA, Numeric, Drop Down, Single Photo, Multiple Photo, Document |
| 3 | Close the form (Cancel/X) | Form closes; nothing added |

### PM-REG-FDI-42b – Show and hide deleted questions (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Note the row count of the questions table; tick "Show deleted questions" | Row count is at least the number of active questions |
| 2 | Untick "Show deleted questions" | Row count returns to the number of active questions |

### PM-REG-FDI-25a – Inspector list kept after navigating away
Not automated – Runs with Regression part 2 (needs data created in the run).

### PM-REG-FDI-42c – Empty Questions list
Not automated – Runs with Regression part 2 (needs data created in the run) – an empty question set.

### PM-REG-FDI-50 – Question list requests are organization-scoped
Not automated – API endpoint not confirmed yet.

## Inventory Control

### PM-REG-INV-01 – Empty state (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Left menu › Project Management › "Inventory Control" | Page opens |
| 2 | Check the empty state | "No rules configured" and "Add a rule to set inventory thresholds" shown |

## Material Master

### PM-REG-MM-01 – Paging (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Left menu › Project Management › "Material Master" | Page opens |
| 2 | Wait for the list to load | Page 1 has 25 rows and a "Page 2" link; first row recorded |
| 3 | Click "Next page", "Previous page", "Page 2", then "Page 1" | First row changes on page 2 and returns to the original on page 1 |

### PM-REG-MM-02 – Search (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Type the first row's material name in "Search materials…" | Only rows containing that name remain |
| 2 | Search "zzqq-no-match"; then clear the search | Empty state shown; original first row returns |

### PM-REG-MM-03 – Row menu actions (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Click the row menu icon of the first row | Menu shows Edit, Delete, Map Supplier, Statistics (menu then closed) |

### PM-REG-MM-04 – Expand row shows items (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Expand the first material that shows "n items"; then collapse it | Item rows with a "SKU ID" column are shown |

### PM-REG-MM-14 – Export (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Note the item count; click "Export" | .xlsx file downloads; its "Filtered Data" sheet has as many "Material" Row Type rows as materials listed |

### UPL-MM-01 – Template download and layout (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Click "Upload" › "Download Template" | File material_bulk_upload_template.xlsx; sheet "Materials" headers: category, material_name, uom, item_name, item_conversion |

### UPL-MM-02 – UoM dropdown matches Common UoM (read-only)
Precondition: UPL-MM-01 template downloaded; Common UoM names recorded in PM-REG-REF-19.

| # | Action | Expected |
|---|---|---|
| 1 | Read the UoM list sheet of the downloaded template | Names equal the Common UoM names (unique, ignoring case and spaces) |

Note: Common UoM can hold case/space duplicates (SCP-DEF-029), hence the case-insensitive comparison.

### UPL-MM-15 – Reports can be downloaded
Not automated – Runs with Regression part 2 (needs data created in the run) – the UPL-MM-05 upload.

## PreShipping Checklist

### PM-REG-PSC-01 – List renders (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Left menu › Project Management › "PreShipping Checklist" | Page opens |
| 2 | Read the table (nothing toggled) | Headers #, Question, Enabled; at least one question row |

## Bulk Upload Status

### PM-REG-BUS-01 – Default date range (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Left menu › Project Management › "Bulk Upload Status" | Page opens |
| 2 | Read the two date fields | From = today minus one calendar month, To = today (dd/mm/yyyy); upload rows recorded |

### PM-REG-BUS-02 – Type filter (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Reload; open the "All Upload Types" filter and select "Inventory" | Every row has Upload Type "Inventory" |
| 2 | Reload; open the filter and select "Materials" | Every row has Upload Type "Materials" |
| 3 | Reload to the default filter | Row count equals the original unfiltered count |

### PM-REG-BUS-03 – Uploader search (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Type the signed-in user's email in "Search by uploader…" | Every row shows that uploader |
| 2 | Search "zzqq-no-match"; then clear | No rows |

### PM-REG-BUS-04 – Date range filtering (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Set From and To to the date of the first upload | Only rows dated that day remain |
| 2 | Set From = today and To = 5 days ago | Page still renders and shows no rows |
| 3 | Reload | To date is today again (default range) |

### PM-REG-BUS-05 – Status matches outcome (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Compare each row's Status with its success/failure file columns | No "Success" without a success file; no "Failed" without a failure file; no row with an empty status |

Note: a row without status fails the step as an application defect ("Application defect: … have no status"), see config/scp-known-defects.js.

### PM-REG-BUS-06 – Success/Failure file links (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Check the file columns of every row | Success rows have a success file (they may also have an error file); Failed rows have a failure file and no success file |

### PM-REG-BUS-07 – Download result reports (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Click the success report link of the first row that has one | File downloads, is not empty and opens as a workbook |
| 2 | Click the failure report link of the first row that has one | File downloads, is not empty and opens as a workbook |

## Procurement Log Configuration

### PM-REG-PLC-01 – Locked fields cannot be disabled (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Left menu › Project Management › "Procurement Log Configuration" | Page opens |
| 2 | Check the rows Material Name(Locked), Submittal No(Locked), Supplier Name(Locked) | Checkbox ticked and disabled in each |

### PM-REG-PLC-02 – Field Type options (form-only)

| # | Action | Expected |
|---|---|---|
| 1 | Click "Add Log Fields" | "Add Procurement Log Fields" form opens |
| 2 | Open the "Choose Field Type" dropdown | Number, String, Date |
| 3 | Close the form (Cancel/X) | Form closes; nothing added |

### PM-REG-PLC-09 – Unsaved changes on navigation (form-only)

| # | Action | Expected |
|---|---|---|
| 1 | Record the "Spec Section No" checkbox state, toggle it without saving, then open "Site Details" from the menu (a leave prompt is accepted if one appears) | Site Details opens |
| 2 | Open "Procurement Log Configuration" again and read "Spec Section No" | Original value is shown. If not, the toggle is saved back with "Save Changes" to restore it and the step fails ("The unsaved toggle was persisted…") |

## Site Details

### PM-REG-SITE-01 – Dropdown options (form-only)

| # | Action | Expected |
|---|---|---|
| 1 | Left menu › Project Management › "Site Details" | Page opens |
| 2 | Click "Add Site"; open the "Choose Site" dropdown; close the form | Warehouse, Site_type3, Site |
| 3 | Click "ADD" on the first site row; open the "Choose Location" dropdown; close the form | Construction Area, Substore |

### PM-REG-SITE-02 – Row menu (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Click the row menu icon of the first site | Menu shows Edit and Delete (menu then closed) |

### PM-REG-SITE-06 – Address entry on Add Site (form-only)

| # | Action | Expected |
|---|---|---|
| 1 | Click "Add Site"; type "Anna Salai Chennai" in "Start typing an address…" | No suggestion list appears; the typed text stays |
| 2 | Close the form (Cancel/X) | Form closes; nothing added |

### PM-REG-SITE-11 – Export sites (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Note the site count; click "Export" | .xlsx file downloads listing as many distinct site names as the page shows (otherwise fails naming both counts) |

### UPL-SITE-01 – Template download and layout (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Click "Upload" › "Download Template" | File site_bulk_upload_template.xlsx; sheet "Sheet1" headers: site_name, site_type, location_name, location_type |

### UPL-SITE-13 – Reports can be downloaded
Not automated – Runs with Regression part 2 (needs data created in the run) – the UPL-SITE-04 upload.

## Submittal Manager

### PM-REG-SUB-01 – Repurposed notice only (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Left menu › Project Management › "Submittal Manager" | Page opens |
| 2 | Read the page | Notice starting "This page is being repurposed." only; no table and no buttons |

## System Messages

### PM-REG-SYS-01 – Form fields and limits (form-only)

| # | Action | Expected |
|---|---|---|
| 1 | Left menu › Project Management › "System Messages" | Page opens |
| 2 | Note the first message in the list; click "New message" | Form opens with a "Create" button (not clicked) |
| 3 | Check Scope, Severity, limits and dates | Scope "Project (this project only)"; Severity Info, Warning; Title max 120; Body required, max 2000, counter "0/2000"; two date-time fields; "Active" shown |

### PM-REG-SYS-02 – Markdown preview (form-only)
Precondition: New message form open.

| # | Action | Expected |
|---|---|---|
| 1 | Type `**bold** *it* [l](https://x.y)` in the body | Preview shows bold "bold", italic "it" and a link "l" to https://x.y |
| 2 | Type a script tag and "# Heading" in the body | Preview contains no script and no heading; the script does not run |

### PM-REG-SYS-04 – Body 2000 / Title 120 boundary (form-only)
Precondition: New message form open.

| # | Action | Expected |
|---|---|---|
| 1 | Type 2001 characters in the body and 121 in the title | Body stops at 2000 (counter "2000/2000"); title stops at 120 |
| 2 | Click "Cancel" | Form closes ("Create" hidden); nothing created |

### PM-REG-SYS-06 – Edit pre-fills (form-only)

| # | Action | Expected |
|---|---|---|
| 1 | Click "Edit" on the first message | Edit form opens with "Save" (not clicked) |
| 2 | Compare fields with the list | Title and body pre-filled; counter shows "n/2000" for the body length; Preview shows the start of the body |
| 3 | Click "Cancel" | Form closes ("Save" hidden); nothing saved |

### PM-REG-SYS-11 – Banner dismiss (read-only)
Only runs when a "Project notice" banner is visible at run time; otherwise: Not automated – No active project notice at run time.

| # | Action | Expected |
|---|---|---|
| 1 | Click "Dismiss ×" on the "Project notice" banner | Banner disappears |

## Watched Materials

### PM-REG-WM-01 – No user selected (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Left menu › Project Management › "Watched Materials" | Page opens |
| 2 | Read the page before choosing a user | Prompt "Pick a user to view or assign watches." |

### PM-REG-WM-02 – View own watches (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Pick the signed-in user (or the first real user) in the user dropdown | Watches load |
| 2 | Read the watch rows | At least one row; each has type Category or Trade, status On/Off and a "Remove" action |

### PM-REG-WM-03 – Add watch – type/value lists (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Open the add-watch dropdowns | Type options Category, Trade; value list holds material categories (each must exist in Material Category when that list was captured in full) |

## Navigation (whole menu)

### PM-REG-NAV-01 – Every PM leaf opens its route (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | For each of the 17 Project Management pages not yet opened in this run, open it from the left menu | Page opens |
| 2 | Review all pages opened so far | All 17 entries reached their route and were highlighted as active in the menu |

### PM-REG-NAV-03 – Direct URL access with an active session (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | For each of the 17 pages browse directly to its route (e.g. /booking-integration, /material-master, /system-messages) | Stays on the SCP site without re-login; page content is not empty |

### PM-REG-NAV-06 – Unauthenticated access is redirected (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | In a new signed-out browser, open /material-master | Redirected to login, or no data rows shown |

## Other project – SCP_Testing_Ram

Project name comes from `PM_FLOW_SECOND_PROJECT` (default SCP_Testing_Ram).

### PM-REG-NAV-07 – Setup Wizard shown while setup is incomplete (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Header project selector: switch to SCP_Testing_Ram | Project switched |
| 2 | Left menu › Project Management: look at the first child; click it | First child is "Setup Wizard"; /setup-wizard opens with "Project Setup" and a numbered open step |

### PM-REG-FDI-07 – Defaults on an unconfigured project (read-only)

| # | Action | Expected |
|---|---|---|
| 1 | Left menu › Project Management › "First Delivery Inspection Config" | Page opens |
| 2 | Read the four FDI checkboxes | All unticked; "Photos are mandatory?" disabled |

### PM-REG-FDI-25c – One and many inspectors display (read-only)
Precondition: inspector count of NRVC_Hall recorded in PM-REG-FDI-10.

| # | Action | Expected |
|---|---|---|
| 1 | Read the inspector table | Exactly one row here, while NRVC_Hall had more than one |

### PM-REG-NAV-05 – PM data is project-scoped (read-only)
Precondition: first message recorded in PM-REG-SYS-01.

| # | Action | Expected |
|---|---|---|
| 1 | Left menu › Project Management › "System Messages" | Page opens |
| 2 | Read the message list | The NRVC_Hall message noted earlier is not listed |

### PM-REG-BUS-10 – History is project-specific (read-only)
Precondition: NRVC_Hall uploads recorded in PM-REG-BUS-01.

| # | Action | Expected |
|---|---|---|
| 1 | Left menu › Project Management › "Bulk Upload Status" | Page opens |
| 2 | Compare the first five NRVC_Hall uploads with the rows here | None of them is listed |
| 3 | Header project selector: switch back to NRVC_Hall | Project switched back |
