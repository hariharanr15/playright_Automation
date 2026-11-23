# Project Management – Regression part 2 (data-creating) – step-by-step flows

- Spec file: `tests/pm-flow/pm-regression-part2.spec.js`
- npm command: `npm run pm:regression2` (runs `node scripts/run-pm-flow.js regression2`)
- Catalogue: `docs/functional-discovery/PM_REGRESSION_SCENARIOS.md`
- Run tag: `PMR2-<yymmddHHMM>` (for example `PMR2-2611061530`). Every record the suite creates carries this tag in its name, so runs never collide. In this document `<RUN>` stands for the tag.
- Project: NRVC_Hall, signed in as Project Admin. One sign-in and one browser tab for the whole suite; pages follow the sidebar order and the SCP_Testing_Ram checks run last.

## Common preconditions and setup

PM-REG-000 – Sign in as Project Admin and select the project (runs first; the suite stops if it fails):

| # | Action | Expected |
|---|---|---|
| 1 | Open the login page | Heading "Welcome To Voyage Control" |
| 2 | Sign in with the Project Admin account | The account e-mail is shown as the signed-in user |
| 3 | Open Supply Chain Planner from the platform chooser | URL ends with `/management-dashboard` |
| 4 | Select project NRVC_Hall | Project is active |

- Each scenario first opens its own sidebar page (nothing happens if it is already open), so a scenario does not depend on the one before it, except where a Precondition says so.
- Data created and reused later in the run: Common Utility `Curr <RUN>` (renamed `... E`), UoM `UoM <RUN> E`, Material Categories `Cat <RUN> E` and `Cat B <RUN>`, materials `Mat <RUN>`, `Mat CB <RUN>`, `Mat P <RUN> E` (child, with item `Pack <RUN>`), FDI question set `Set <RUN>` with group `Grp <RUN>`, three inspectors A/B/C, site `Gate <RUN>` with location `Loc <RUN>`, custom log field `Field <RUN>`, upload files `UPL-*` (read again by Bulk Upload Status).
- Created records are not deleted except where a scenario tests Delete on a record created in this run. Settings (Configuration Options, FDI Settings, PreShipping Checklist, Procurement Log Configuration) are put back after each change.
- Many steps record an outcome that is not yet confirmed (what the app says, whether a record was accepted). Those are shown as "outcome recorded" and do not fail the step.
- "Reload" means reload the browser page and wait for the app to be ready.

---

## Navigation

### PM-REG-NAV-08 – Setup Wizard disappears after completion (skipped)
Not automated – completing the Setup Wizard on SCP_Testing_Ram cannot be undone and CFG-17 / PSC-05 need it unconfigured; needs product-owner go-ahead.

### PM-REG-NAV-09 – Wizard data matches module pages (skipped)
Not automated – same as NAV-08 (completes the Setup Wizard on SCP_Testing_Ram).

---

## Integrations

### PM-REG-INT-02 – Booking: submit with empty Booking ID (skipped)
Not automated – submitting the Booking form may change NRVC_Hall's booking link; needs approval.

### PM-REG-INT-08 – XER: reject unsupported file type (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Sidebar › Project Management › Integrations › "XER Import" | XER Import page opens |
| 2 | Note the plan count. Click "Import" and choose a `.txt` file containing "Not a schedule file". Wait 4 seconds | The file input's accept attribute and the app message are recorded; no plan is created, plan count unchanged |

### PM-REG-INT-09 – XER: import → select two tasks → Save (positive)
Only runs when the test `.xer` file exists (env `PM_XER_FILE`, default `C:/Users/VC/Downloads/SPADE-OYM-1A-2A-BL-1-09-25-2026-1.xer`); otherwise skipped with "XER test file not found".

| # | Action | Expected |
|---|---|---|
| 1 | XER Import: click "Import", choose the test `.xer` file. If "Open existing plan" appears (already imported) click it | Plan view with "Manage tasks" opens; the currently visible task IDs are noted |
| 2 | Click "Manage tasks"; in the "Select tasks to display" dialog tick two tasks that are not currently visible; click "Save (2 tasks)" | Dialog closes, the toast "tasks set to visible" is recorded, only those two tasks are visible |
| 3 | Check the plan's task list and header | Both tasks show "Unmapped"; header reads "2/<total> visible" |

### PM-REG-INT-15 – XER: Save sets the visible set to the selection (positive)
Precondition: PM-REG-INT-09 ran (skipped together with it when the file is missing).

| # | Action | Expected |
|---|---|---|
| 1 | "Manage tasks": tick two different tasks (not the earlier two, not the originally visible ones); click "Save (2 tasks)" | Only these two tasks are visible; the earlier two are no longer visible |

---

## Reference Data

### Common Utilities

#### PM-REG-REF-05 – Add utility – required fields (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Sidebar › Project Management › Reference Data › "Common Utilities"; note the item count | Page opens |
| 2 | "Add Common Util" form: submit with both name and type empty | Form stays open (not created), message recorded |
| 3 | Submit with name "Req <RUN>" only | Form stays open, message recorded |
| 4 | Submit with type "file_category" only | Form stays open, message recorded |
| 5 | Search "Req <RUN>" and check the item count | No utility created; count equals the count before |

#### PM-REG-REF-06 – Add utility – happy path (positive)
| # | Action | Expected |
|---|---|---|
| 1 | "Add Common Util": name "Curr <RUN>", type "currency_type", click "Add" | Form closes |
| 2 | Search "Curr <RUN>" | One row with type "currency_type"; item count up by 1 |

#### PM-REG-REF-08 – Edit utility name (positive)
Precondition: PM-REG-REF-06.

| # | Action | Expected |
|---|---|---|
| 1 | Row actions › "Edit" on "Curr <RUN>": rename to "Curr <RUN> E", click "Update" | Edit form closes |
| 2 | Search the run token | "Curr <RUN> E" listed once; old name no longer listed |

#### PM-REG-REF-09 – Duplicate utility name (negative)
Precondition: PM-REG-REF-08 (uses the edited name, type "currency_type").

| # | Action | Expected |
|---|---|---|
| 1 | "Add Common Util": enter the existing name as typed, click "Add" | Accepted or rejected is recorded (no assertion) |
| 2 | Same with extra spaces inside and around the name | Outcome recorded |
| 3 | Same in upper case | Outcome recorded |
| 4 | Search the name again | No duplicate row; item count equals the count before the attempts. Fails if any attempt created a second row |

#### PM-REG-REF-10 – Utility name boundary (negative)
| # | Action | Expected |
|---|---|---|
| 1 | "Add Common Util": a 255-character name, type "file_category", "Add" | Outcome and stored name recorded |
| 2 | Name with leading/trailing spaces ("  Sp <RUN>  ") | Outcome and stored name recorded |
| 3 | Name with special characters (`Sp &<>"' <RUN>`) | Outcome and stored name recorded |
| 4 | Check for browser alert dialogs | None opened (no script execution) |
| 5 | 1-character name | Not tried (cannot carry the run token, would collide with other runs); reason recorded |

### Common UoM

#### PM-REG-REF-12 – Add UoM – required (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Sidebar › Project Management › Reference Data › "Common UoM" | Page opens |
| 2 | "Add UOM": leave the name empty, click "Add" | Form stays open, message recorded, UOM count unchanged |

#### PM-REG-REF-13 – Add + edit UoM (positive)
| # | Action | Expected |
|---|---|---|
| 1 | "Add UOM": name "UoM <RUN>", click "Add" | Form closes; row listed once |
| 2 | Row actions › "Edit" on "UoM <RUN>": rename to "UoM <RUN> E", click "Update" | Form closes; new name listed once, old name gone |

#### PM-REG-REF-20 – Duplicate UoM name (negative)
Precondition: PM-REG-REF-13. Steps 1 to 4 are the same as REF-09, for UoM "UoM <RUN> E" (no type).

| # | Action | Expected |
|---|---|---|
| 1-3 | "Add UOM": the existing name as typed, with extra spaces, in upper case; click "Add" each time | Outcome recorded each time |
| 4 | Search the name again | No duplicate row; count unchanged |

#### PM-REG-REF-22 – Edit to an existing name (UoM) (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Add "UoM2 <RUN>"; clear the search and pick another existing UoM name (not from this run); "Edit" "UoM2 <RUN>" to that name, click "Update" | Outcome recorded; "UoM2 <RUN>" still listed once; the other UoM is not duplicated |

### Material Category

#### PM-REG-REF-15 – Add Material Category – required (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Sidebar › Project Management › Reference Data › "Material Category" | Page opens |
| 2 | "Add Material Category" form: leave the name empty, click "Add" | "Name is required" shown; after closing, category count unchanged |

#### PM-REG-REF-16 – Add + edit Material Category (positive)
| # | Action | Expected |
|---|---|---|
| 1 | "Add Material Category": add "Cat <RUN>" and "Cat B <RUN>" (click "Add" each time) | Both forms close; each name listed once |
| 2 | Edit icon on "Cat <RUN>": rename to "Cat <RUN> E", click "Update" | Form closes; new name listed |

#### PM-REG-REF-21 – Duplicate Material Category name (negative)
Precondition: PM-REG-REF-16. Same three attempts and final check as REF-09, for "Cat <RUN> E".

| # | Action | Expected |
|---|---|---|
| 1-3 | "Add Material Category": the existing name as typed, with extra spaces, in upper case | Outcome recorded each time |
| 4 | Search the name again | No duplicate row; count unchanged |

#### PM-REG-REF-22b – Edit to an existing name (category) (negative)
Precondition: PM-REG-REF-16.

| # | Action | Expected |
|---|---|---|
| 1 | Edit "Cat B <RUN>": change its name to the existing "Cat <RUN> E", click "Update" | Outcome recorded; original name kept; only one "Cat <RUN> E" listed |

#### PM-REG-REF-18 – Load Defaults (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Click "Load Defaults", choose "Metric (m, L, kg)", confirm any prompt | Category count before and after, and the message, are recorded |
| 2 | Clear the search and read all category names | No name appears twice (ignoring case and spaces) |

#### PM-REG-REF-23 – Delete from the row actions (run-created records only) (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Material Category: add "Del <RUN>", then delete it via its row action and confirm | Row listed after the add, gone after the delete |
| 2 | Common UoM: same with "Del <RUN>" | Same |
| 3 | Common Utilities: same with "Del <RUN>" (type "file_category") | Same |

---

## Configuration Options

### PM-REG-REF-07 – New currency utility appears in Configuration Options (positive)
Precondition: PM-REG-REF-06 (currency utility created).

| # | Action | Expected |
|---|---|---|
| 1 | Sidebar › Project Management › "Configuration Options" | Page opens |
| 2 | Note the three alert-week values and the current currency; click the "Currency Type" dropdown | Options include "Curr <RUN> E" |

### PM-REG-CFG-04 – Save and persist alert weeks (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Enter new alert weeks in the three week fields (each original value flipped between 1 and 2), click "Save", reload | Fields show the new values |
| 2 | Always runs: enter the original weeks, "Save", reload | Original values shown |

### PM-REG-CFG-06 – Week field – non-numeric and negative (negative)
| # | Action | Expected |
|---|---|---|
| 1 | First week field: enter "abc", click "Save", reload | Message recorded; value not saved, original weeks remain |
| 2 | First week field: enter "-1", click "Save", reload | Same. Fails with a clear message if the app saves it (rule R69) |
| 3 | Always runs: if the weeks differ from the originals, re-enter them and "Save" | Week fields show the original values |

### PM-REG-CFG-07 – Week field – boundaries (positive)
| # | Action | Expected |
|---|---|---|
| 1-3 | First week field: enter "0", then "1", then "52"; click "Save" and reload each time | Each value is saved (accepted, R69); message recorded |
| 4 | Always runs: enter the original weeks, "Save", reload | Original values shown |

### PM-REG-CFG-05 – Save and persist currency (positive)
| # | Action | Expected |
|---|---|---|
| 1 | "Currency Type" dropdown: choose another currency (not the original, not a run one), click "Save", reload | Button shows the chosen currency; message recorded |
| 2 | Always runs: choose the original currency again if needed, "Save", reload | Original currency shown |

### PM-REG-CFG-08 – Toggle persistence (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Click the "LLM Material Categorization" toggle, click "Save", reload | Toggle keeps the flipped state; message recorded |
| 2 | Always runs: click the toggle back if needed, "Save", reload | Original state restored |

### Skipped (cross-module or two-phase, Regression part 3)
Not automated – PM-REG-CFG-09 (Pre-Shipping toggle gates checklist), PM-REG-CFG-10 (GRN toggle effect), PM-REG-CFG-11 (Archive period effect): cross-module checks, planned for Regression part 3.
Not automated – PM-REG-CFG-13 (Not-ordered alert triggers), CFG-15 (Lead time not confirmed alert), CFG-16 (No alert before threshold): two-phase checks (seed today, verify after the 05:00-06:00 IST batch), Regression part 3.
Not automated – PM-REG-CFG-14 (Not-booked alert triggers): two-phase batch check; NRVC_Hall booking link not confirmed (Q-ANT-6).
Not automated – PM-REG-CFG-17 (Unconfigured settings: in-app only): two-phase batch check on SCP_Testing_Ram.
Not automated – PM-REG-CFG-18 (Currency is set per project): see "Other project" below.

---

## Material Master

### PM-REG-MM-05 – Add Material – required (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Sidebar › Project Management › "Material Master" | Page opens |
| 2 | Click "Add Material", read the "Choose Category" and "Choose Unit" lists, close the form | Lists recorded for later checks (REF-14, REF-17) |
| 3 | "Add Material": submit with nothing filled | Form stays open, material not added (message recorded) |
| 4 | Fill Material Name "Mat R1 <RUN>" and the UOM, no Category; submit | Form stays open |
| 5 | Fill Category "Cat <RUN> E" and UOM, no Material Name; submit | Form stays open |
| 6 | Fill Category and Material Name "Mat R2 <RUN>", no UOM; submit | Form stays open |

### PM-REG-REF-14 – New UoM available in Add Material (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Check the "Choose Unit" list recorded in MM-05 | Contains "UoM <RUN> E" |

### PM-REG-MM-06 – Add Material – happy path (positive)
| # | Action | Expected |
|---|---|---|
| 1 | "Add Material": Category "Cat <RUN> E", Material Name "Mat <RUN>", UOM "UoM <RUN> E", click "Add" | Form closes |
| 2 | "Add Material": Category "Cat B <RUN>", name "Mat CB <RUN>", UOM "UoM <RUN> E", click "Add" | Form closes (gives that category a material, needed for FDI question sets) |
| 3 | Search the run token | "Mat <RUN>" row shows its Category, UOM and a generated Material ID |

### PM-REG-MM-07 – Add Material with Parent + Supplier (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Reload (the Parent list loads with the page); "Add Material": Category "Cat <RUN> E", name "Mat P <RUN>", UOM, Parent Material "Mat <RUN>", the first Supplier; click "Add" | Form closes |
| 2 | Search the run token | "Mat P <RUN>" row shows parent "Mat <RUN>"; the chosen supplier is recorded |

### PM-REG-MM-16 – Duplicate material name (negative)
| # | Action | Expected |
|---|---|---|
| 1-3 | "Add Material" with the existing name "Mat <RUN>": as typed, with extra spaces, in lower case; Category and UOM as before; click "Add" | Outcome recorded; still only one "Mat <RUN>" listed after each attempt |

### PM-REG-MM-08 – Add Item – required/boundary (negative)
| # | Action | Expected |
|---|---|---|
| 1-5 | Row "ADD" button on "Mat <RUN>": add an item with (1) empty name and conversion, (2) name "Itm Z <RUN>" conversion 0, (3) "Itm N <RUN>" conversion -1, (4) "Itm A <RUN>" conversion abc, (5) "Itm D <RUN>" conversion 1.5; click "Add"; reload after each | For each: accepted or not, Items count before/after and message recorded (no assertion) |

### PM-REG-MM-09 – Add Item – happy path (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Row "ADD" on "Mat P <RUN>": item name "Pack <RUN>", conversion 10, click "Add", reload | Form closes; Items count up by 1 |

### PM-REG-MM-17 – Duplicate item name (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Row "ADD" on "Mat P <RUN>": item name "PACK <RUN>" (upper case), conversion 10, click "Add", reload | Outcome recorded; Items count unchanged |

### PM-REG-MM-10 – Edit material (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Row menu › "Edit" on "Mat P <RUN>": Material Name "Mat P <RUN> E", click "Update"/"Save" | Form closes |
| 2 | Search the run token | "Mat P <RUN> E" listed once |

### PM-REG-MM-15 – Map Supplier / Statistics (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Row menu › "Map Supplier" on "Mat <RUN>" | "Add Supplier Mapping" drawer shows Supplier ID, Supplier Name, Lead Time in Weeks; close without saving |
| 2 | Row menu › "Statistics" on "Mat <RUN>" | No. of Submittals, No. of Orders, Qty Pending Delivery, Qty Not Yet Ordered and Current Stock are shown |

### Skipped
### PM-REG-MM-11 – Delete material in use (skipped)
Not automated – if the app allows it, a material used by submittals would be deleted (R14); needs approval.

---

## Material Master › Upload

All upload scenarios work on the Material Master page. Each uses the downloaded template (from UPL-MM-03), writes a workbook with the listed rows, clicks "Upload" › "Upload File", answers the "Upload Confirmation" dialog with "Upload" and follows the progress dialog to its result summary (click "Close"). The prompt and message are recorded. "Search" below means the Material Master search box with the run token.

### UPL-MM-03 – Valid upload creates materials (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Click "Upload" › "Download Template" | Template downloads; its UoM list includes "UoM <RUN> E" |
| 2 | "Upload" › "Upload File": two valid rows (Mat A <RUN>; Mat B <RUN> with item Pack B <RUN>, conversion 10); confirm the dialogs | Result recorded |
| 3 | Search the run token | "Mat A <RUN>" and "Mat B <RUN>" each listed once; "Mat B <RUN>" shows 1 item |

### UPL-MM-04 – Fully invalid file (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Upload two rows with an empty material_name; confirm | Result recorded |
| 2 | Search the run token | Number of run materials unchanged, nothing created |

### UPL-MM-05 – Partly valid file (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Upload valid "Mat C <RUN>" plus "Mat D <RUN>" with a blank uom; confirm | Result recorded |
| 2 | Search the run token | "Mat C <RUN>" listed once; "Mat D <RUN>" not created |

### UPL-MM-06 – Required cells (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Upload "Mat E <RUN>" with a blank category and "Mat F <RUN>" with a blank uom; confirm | Result recorded |
| 2 | Search the run token | Neither is created |

### UPL-MM-07 – UoM not in the list (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Upload "Mat G <RUN>" with uom "Bogus <RUN>"; confirm | Result recorded |
| 2 | Search the run token | "Mat G <RUN>" not created |

### UPL-MM-08 – Unknown category – confirm (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Upload "Mat H <RUN>" with new category "Cat U <RUN>"; in the progress dialog choose "Create all as new" and "Continue" | Result recorded |
| 2 | Search the run token | "Mat H <RUN>" listed once under category "Cat U <RUN>" |

### UPL-MM-16 – Unknown category – decline (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Upload "Mat I <RUN>" with new category "Cat2 U <RUN>"; in the progress dialog choose "Reject all" and "Continue" | Result recorded |
| 2 | Search the run token | "Mat I <RUN>" not created |

### UPL-MM-09 – Duplicate of an existing material (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Upload three rows repeating "Mat <RUN>" (same name, upper case, extra spaces); confirm | Result recorded |
| 2 | Search the run token | "Mat <RUN>" is still listed once |

### UPL-MM-10 – Duplicate inside the same file (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Upload "Mat J <RUN>" twice in one file; confirm | Result recorded |
| 2 | Search the run token | "Mat J <RUN>" created at most once (count recorded) |

### UPL-MM-11 – Item conversion boundaries (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Upload five materials (Mat K1 to K5 <RUN>) with item conversions 0, -1, abc, 1.5 and 2; confirm | Result recorded |
| 2 | Search the run token | Only "Mat K5 <RUN>" (conversion 2) exists, with 1 item; K1 to K4 not created |

### UPL-MM-12 – Item fields must go together (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Upload "Mat L1 <RUN>" with item_name only and "Mat L2 <RUN>" with item_conversion only; confirm | Result recorded |
| 2 | Search both | Whether each was created is recorded (expected result not yet confirmed; no assertion) |

### UPL-MM-13 – Wrong file / wrong layout (negative)
| # | Action | Expected |
|---|---|---|
| 1 | "Upload" › "Upload File": choose a `.csv` file instead of the template; then confirm | Messages recorded |
| 2 | Same with a `.pdf` file | Messages recorded |
| 3 | Search the run token | "Mat M1 <RUN>" not created |

### UPL-MM-14 – Header-only file (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Upload the template with one empty data row; confirm | Result recorded |
| 2 | Search the run token | Number of run materials recorded (nothing is expected to be created) |

### UPL-MM-15 – Reports can be downloaded (positive)
Listed under Bulk Upload Status below (it runs there).

---

## First Delivery Inspection Config

### FDI Settings

#### PM-REG-FDI-02a – No contradictory state is saved (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Sidebar › Project Management › "First Delivery Inspection Config" | Page opens |
| 2 | FDI Settings: note the four checkboxes; untick "Enable Uploading of Photos?", click "Save", reload | Uploads No, "Photos are mandatory?" No and disabled |
| 3 | Always runs: set the four checkboxes back to their original values, "Save", reload | Original settings shown |

#### PM-REG-FDI-04 – Save persists each setting (Yes and No) (positive)
For each of the four settings ("Need Overall Notes to be captured", "Enable Uploading of Photos?", "Photos are mandatory?", "Provide Link to Submittal Spec Documents?"):

| # | Action | Expected |
|---|---|---|
| 1 | Flip the checkbox (for "Photos are mandatory?" tick uploads first), click "Save", reload | New value kept after reload |
| 2 | Set it back to the original value, "Save", reload | Original value kept |
| 9 | Always runs: set all four checkboxes back to the original values, "Save", reload | Settings equal the original values |

(Steps 1 and 2 repeat once per setting, so eight steps, then the restore step.)

### Inspectors

#### PM-REG-FDI-21 – Add Inspector – Person and Role required (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Inspectors › "Add Inspector": read the role list and the project members not yet inspectors; then choose a Project Role but no Project Member, click "Add" | Form stays open, nothing added |
| 2 | "Add Inspector": choose a Project Member but no Project Role, click "Add" | Form stays open; the member is not added to the table |

#### PM-REG-FDI-25 – Several inspectors can be added (positive)
| # | Action | Expected |
|---|---|---|
| 1 | "Add Inspector" (member A): next free project member, a role, scope "All Materials", click "Add" | Row shows the member with that role |
| 2 | Member B: scope "Specific Materials" with the first listed material | Row shows the member with that role |
| 3 | Member C: scope "By Material Category" ("+ Add Category", search and pick "Cat <RUN> E") | Row shows the member with that role |

Note: inspectors cannot be deleted, so every run uses up project members. When none is free, an existing automation test inspector (`user<digits>@yopmail.com`, Active) is reused and the step records that.

#### PM-REG-FDI-22 – Add Inspector – By Category scope (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Inspectors table, inspector C | Scope cell reads "Cat <RUN> E · all" (not checked when inspector C was a reused inspector; recorded) |

#### PM-REG-FDI-25a – Inspector list kept after navigating away (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Open "Inventory Control", then "First Delivery Inspection Config" again | Inspectors page reloads |
| 2 | Inspectors table | Inspectors A, B and C are still listed |

#### PM-REG-FDI-23 – Enable/Disable inspector (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Inspector A row: click "Disable", confirm, reload | Enabled column shows "Disabled"; role kept |
| 2 | Inspector A row: click "Enable", confirm, reload | Enabled column shows "Enabled"; role kept |

#### PM-REG-FDI-24 – Edit materials scope (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Inspector B row › "Edit materials": toggle the old material off and another on, click "Save", reload | Scope shows the new material and no longer the old one; message recorded |

#### PM-REG-FDI-27 – Material mapping: one, several, All Materials (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Inspector B › "Edit materials": add a third material, "Save", reload | Scope shows both chosen materials |
| 2 | Inspector B › "Edit materials": tick "All Materials", "Save", reload | Scope reads "All Materials"; chips recorded |

#### PM-REG-FDI-26 – Invite several people at once (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Inspectors › "Invite": enter `pm.a.<run>@yopmail.com`, role "Project User"; "Add Another User"; enter `pm.b.<run>@yopmail.com`, role "Project User"; click "Send Invites" | Form closes |
| 2 | Inspectors table, both rows | Status "Invited - Pending Acceptance", Enabled "Disabled", the "Enable" button is disabled |

#### PM-REG-FDI-19 – Invite duplicate / existing user email (negative)
Precondition: PM-REG-FDI-26.

| # | Action | Expected |
|---|---|---|
| 1 | "Invite": the first invited e-mail again, role "Project User", "Send Invites"; close the form, reload | Outcome recorded; still exactly one row for that e-mail |

### Question sets, groups and questions

#### PM-REG-FDI-32 – New Question Set – required (negative)
| # | Action | Expected |
|---|---|---|
| 1 | "New Question Set": read the category checkbox list, close the form | List recorded (REF-17) |
| 2 | Submit with an empty name (category "Cat B <RUN>") via "Create Question Set" | Form stays open, set not created |
| 3 | Submit with name "Set X <RUN>" and no category | Form stays open, set not created |

#### PM-REG-FDI-34 – Create set for a free category (positive)
| # | Action | Expected |
|---|---|---|
| 1 | "New Question Set": name "Set <RUN>", category "Cat <RUN> E", click "Create Question Set" | Form closes; new set tab "Set <RUN>" appears |
| 2 | Open "New Question Set" again and search category "Cat <RUN> E"; close the form | Label shows "(in: Set <RUN>)" |

#### PM-REG-FDI-42c – Empty Questions list (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Click the "Set <RUN>" tab | Questions list has no question rows (empty-state text recorded) |

#### PM-REG-FDI-43 – Duplicate question set name (negative)
| # | Action | Expected |
|---|---|---|
| 1 | "New Question Set": name "SET <RUN>" (upper case), category "Cat B <RUN>", "Create Question Set"; close, reload | Outcome recorded. Fails with "FDI question set names are not unique" if a second tab with that name appears |

Note: if the app accepts it, the run leaves a second set (data left behind).

#### PM-REG-FDI-36 – Add/edit/reorder/delete group (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Click the "Set <RUN>" tab › "Manage Groups" › "Add Group": add "Grp <RUN>" and "Grp2 <RUN>" | Both appear in the groups table |
| 2 | Groups table: "Edit" on "Grp2 <RUN>", Heading Display Text "Grp2 <RUN> H", save | Row shows the new heading |
| 3 | Click "▲" on "Grp2 <RUN>" | The group moves up one position |
| 4 | "Delete" on "Grp2 <RUN>", confirm in the inline "Delete group" row | Group removed (confirmation text recorded) |

#### PM-REG-FDI-45 – Duplicate group name (negative)
| # | Action | Expected |
|---|---|---|
| 1 | "Add Group": "grp <run>" (existing name, lower case) | Outcome recorded; only one group with that name; "Manage Groups" reopened |

#### PM-REG-FDI-38 – Add Question – text and Data Type required (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Set "Set <RUN>" › "Add Question": empty Question Text, Answer Type "Text"; click "Add" | Form stays open, question not added |
| 2 | Question Text "FDI Q X <RUN>", no Answer Type; click "Add" | Form stays open, question not added |

#### PM-REG-FDI-39 – Add Question – enabled at once in the current project (positive)
| # | Action | Expected |
|---|---|---|
| 1 | "Add Question": Question Text "FDI Q <RUN>", Answer Type "Text", click "Add" | Form closes |
| 2 | Questions table, row "FDI Q <RUN>" | Type "text", Added On today (dd/mm/yyyy), Status "Enabled" |

#### PM-REG-FDI-44 – Duplicate question text (negative)
| # | Action | Expected |
|---|---|---|
| 1 | "Add Question": "FDI Q <RUN>" in upper case with extra spaces, type "Text"; close the form, reload, open the set tab | Outcome recorded; only one question with this text |

#### PM-REG-FDI-41 – Reorder and regroup questions (positive)
| # | Action | Expected |
|---|---|---|
| 1 | "Add Question": "FDI Q2 <RUN>" (Text), then click "▲" on its row | Question added and moves up |
| 2 | Questions table: Group dropdown of "FDI Q2 <RUN>" set to "Grp <RUN>"; reload; open the set tab | Group kept |

#### PM-REG-FDI-40 – Add from Organization Bank (positive)
| # | Action | Expected |
|---|---|---|
| 1 | "Add Question" › "Add from Organization Bank": tick a bank question (preferring one "Not currently enabled anywhere else"), Answer Type "Text", click "Add Selected" | Question added; its text and the message are recorded |
| 2 | Questions table | The bank question is listed with "Enabled" |
| 3 | "Add Question" › "Add from Organization Bank" again | The added question is no longer offered |

#### PM-REG-FDI-42 – Delete a question (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Questions table: "Delete" on "FDI Q <RUN>", confirm | Row removed |

#### PM-REG-FDI-42a – Show deleted questions lists deleted ones (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Tick "Show deleted questions" | "FDI Q <RUN>" is listed and marked deleted; untick the box |

### Skipped
- PM-REG-FDI-05a to 05n (setting effect on the inspection form, 14 scenarios): Not automated – cross-module (needs a delivery and its FDI inspection form), Regression part 3.
- PM-REG-FDI-18 (Invite → accept → activate → disable): Not automated – needs Yopmail acceptance and the inspector login (existing Cucumber flow), Regression part 3.
- PM-REG-FDI-26a (Invite from User Management is unaffected): Not automated – cross-module (User Management invite), Regression part 3.
- PM-REG-FDI-28 (Disabled and pending inspectors cannot self-assign): Not automated – needs the inspector login and an FDI record, Regression part 3.
- PM-REG-FDI-28a (Already-assigned records keep a since-disabled inspector): Not automated – needs an assigned FDI record, Regression part 3.
- PM-REG-FDI-46 (New question offered to the organization's other projects), PM-REG-FDI-48 (Enable a shared question on another project), PM-REG-FDI-49 (Enabling on one project doesn't spread): Not automated – blocked: no second project in NRVC_Hall's organization yet (R62, Q-FDI-8).

---

## Inventory Control

### PM-REG-INV-02 – Add Rule – required (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Sidebar › Project Management › "Inventory Control"; "Add Rule": submit with nothing filled | Form stays open, no rule added (message recorded) |
| 2 | Min 10 and Max 100 without an Inventory Item; click "Add" | Form stays open |
| 3 | Inventory Item "Mat <RUN>" without Min/Max; click "Add" | Form stays open |
| 4 | Rules list | Rule count unchanged |

### PM-REG-INV-03 – Add Rule – happy path (positive)
| # | Action | Expected |
|---|---|---|
| 1 | "Add Rule": Inventory Item "Mat <RUN>", Min Balance 10, Max Balance 100, both notify toggles on, click "Add"; reload | Outcome recorded (the active site name is noted) |
| 2 | Rules list | Rule for "Mat <RUN>" shows Min 10 and Max 100 |

### PM-REG-INV-04 – Min greater than Max (negative)
| # | Action | Expected |
|---|---|---|
| 1 | "Add Rule": item "Mat CB <RUN>", Min 100, Max 10, click "Add" | Outcome recorded (accepted or rejected; expected result unconfirmed, Q-INV-1) |

### PM-REG-INV-05 – Negative / zero / decimal (negative)
Uses "Mat P <RUN> E" (one rule per material; skipped when it already has a rule).

| # | Action | Expected |
|---|---|---|
| 1 | "Add Rule" with Min -1, Max 5 | Outcome recorded |
| 2 | "Add Rule" with Min 0, Max 5 | Outcome recorded |
| 3 | "Add Rule" with Min 0, Max 0.5 | Outcome recorded |

### PM-REG-INV-07 – Rule is site-specific (positive)
Precondition: PM-REG-INV-03.

| # | Action | Expected |
|---|---|---|
| 1 | Header site selector: choose a different site | Site switches |
| 2 | Inventory Control rules | Rule for "Mat <RUN>" is not listed on the other site |
| 3 | Header site selector: switch back to the original site | Rule for "Mat <RUN>" is listed again |

### Skipped
### PM-REG-INV-06 – Breach notification (skipped)
Not automated – cross-module (stock change in Inventory Management), Regression part 3.

---

## PreShipping Checklist

### PM-REG-PSC-02 – Enabled tick saves automatically (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Sidebar › Project Management › "PreShipping Checklist" | Page opens |
| 2 | Click the "Enabled" checkbox of the last question (no Save button; if "Select Answer Type" appears, choose "Text" and click "Add"); reload | Change kept after reload; message recorded |
| 3 | Always runs: click the checkbox back if needed, reload | Original value restored |

### Skipped
- PM-REG-PSC-03 (Enabled question appears in delivery checklist), PM-REG-PSC-04 (Disabled question hidden downstream): Not automated – cross-module (Procurement Log delivery checklist), Regression part 3.
- PM-REG-PSC-05 (Menu item follows the Pre-Shipping toggle): see "Other project" below.

---

## Procurement Log Configuration

### PM-REG-PLC-03 – Add field – required (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Sidebar › Project Management › "Procurement Log Configuration"; note the row count | Page opens |
| 2 | "Add Log Fields": submit with an empty name and no type | Form stays open, no field added |
| 3 | Name "Field X <RUN>" only | Form stays open |
| 4 | Field Type "String" only | Form stays open |
| 5 | Fields table | Row count unchanged |

### PM-REG-PLC-04 – Add custom field (positive)
| # | Action | Expected |
|---|---|---|
| 1 | "Add Log Fields": name "Field <RUN>", Field Type "String", click "Add" | Form closes |
| 2 | Fields table | Row "Field <RUN>(Custom)" listed (the app title-cases the name; matched ignoring case and punctuation); row count up by 1 |

### PM-REG-PLC-08 – Duplicate field name (negative)
| # | Action | Expected |
|---|---|---|
| 1 | "Add Log Fields": "Field <RUN>" again, type "String", "Add"; reload | Outcome recorded. If a row was added the step fails ("accepted a duplicate field name") after disabling the added rows again via "Save Changes" |
| 2 | Standard field name "Spec Section No" | Not repeated; reason recorded |

Note: SCP-DEF-041 – the standard name was accepted on 31 Oct 2026 and stored as another standard field; a further copy would change the Add Submittal form.

### PM-REG-PLC-05 – Enable/disable + Save Changes (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Click the "Field <RUN>(Custom)" checkbox, click "Save Changes", reload | Change kept; message recorded |
| 2 | Always runs: click the checkbox back if needed, "Save Changes", reload | Original value restored |
| 3 | Always runs: untick the run field, "Save Changes", reload | Field disabled, so the Procurement Log shows no test column |

### Skipped
- PM-REG-PLC-06 (Drag reorder), PM-REG-PLC-07 (Custom field in Add Submittal): Not automated – cross-module (Procurement Log), Regression part 3.

---

## Site Details

### PM-REG-SITE-03 – Add Site – required (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Sidebar › Project Management › "Site Details"; note the site count | Page opens |
| 2 | "Add Site": submit with nothing filled | Form stays open, nothing added |
| 3 | Name "Gate R <RUN>" but no Site Type | Form stays open |
| 4 | Site Type "Site" but no Name | Form stays open |

### PM-REG-SITE-04 – Add Site – happy path (positive)
| # | Action | Expected |
|---|---|---|
| 1 | "Add Site": Site Type "Site", Name "Gate <RUN>", City "Chennai", Country India (or the first listed), click "Add" | Form closes |
| 2 | Sites table; reload; open the header site selector | "Gate <RUN>" listed once and offered in the site selector |

### PM-REG-SITE-05 – Add Location (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Row "ADD" (location) on "Gate <RUN>": Location Type "Construction Area", name "Loc <RUN>", click "Add" | Form closes; Locations count up by 1 |

### PM-REG-SITE-09 – Duplicate site name (negative)
| # | Action | Expected |
|---|---|---|
| 1 | "Add Site": "gate <run>" (other case), type "Site", City "Chennai", click "Add" | Outcome recorded; still one site with this name |

### PM-REG-SITE-10 – Duplicate location name (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Row "ADD" on "Gate <RUN>": "Loc <RUN>" again, Construction Area, click "Add" | Outcome recorded; Locations count unchanged |

### Skipped
### PM-REG-SITE-07 – Delete site in use (skipped)
Not automated – if the app allows it, a site with deliveries would be deleted (R14); needs approval.

---

## Site Details › Upload

Each scenario writes a workbook from the downloaded site template (columns site_name, site_type, location_name, location_type; defaults "Site" and "Construction Area"), clicks "Upload", confirms any dialog, reloads, and records the result.

### UPL-SITE-02 – Valid upload creates a site with locations (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Click "Upload" › "Download Template" | Site template downloads |
| 2 | "Upload": site "Site U <RUN>" with locations "Loc A <RUN>" and "Loc B <RUN>"; confirm; reload | Result recorded |
| 3 | Sites table | "Site U <RUN>" listed once with 2 locations |

### UPL-SITE-03 – Fully invalid file (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Upload two rows with a blank site_name | Result recorded |
| 2 | Sites count | Unchanged, nothing created |

### UPL-SITE-04 – Partly valid file (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Upload valid "Site V <RUN>" plus "Site W <RUN>" with invalid site_type "xyz <RUN>" | Result recorded |
| 2 | Sites table | "Site V <RUN>" listed once; "Site W <RUN>" not created |

### UPL-SITE-05 – Required cells (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Upload X1 with a blank site_type, X2 with a blank location_name, X3 with a blank location_type | Result recorded |
| 2 | Sites table | None of "Site X1/X2/X3 <RUN>" is created |

### UPL-SITE-06 – Invalid type values (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Upload Y1 with site_type "xyz <RUN>" and Y2 with location_type "xyz <RUN>" | Result recorded |
| 2 | Sites table | Neither "Site Y1 <RUN>" nor "Site Y2 <RUN>" is created |

### UPL-SITE-07 – Template sample types are not valid by default (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Upload Z1 with the template sample types "local"/"CONSTRUCTION" and Z2 with "Site"/"Construction Area" | Result recorded |
| 2 | Sites table | "Site Z2 <RUN>" created; "Site Z1 <RUN>" not created |

### UPL-SITE-08 – Existing site name (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Note the Locations count of "Gate <RUN>"; upload "GATE <RUN>" (other case) with location "Loc E <RUN>" | Result recorded |
| 2 | Sites table | Still one "Gate <RUN>" and its Locations count unchanged. Fails if a location was added to the existing site (rule R46) |

### UPL-SITE-09 – Duplicate location in one site (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Upload "Site S9 <RUN>" with location "Loc D <RUN>" listed twice | Result recorded |
| 2 | Sites table | "Site S9 <RUN>" has exactly 1 location, or is not created (recorded) |

### UPL-SITE-10 – Same location name, different sites (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Upload location "Loc X <RUN>" under two new sites "Site T1 <RUN>" and "Site T2 <RUN>" | Result recorded |
| 2 | Sites table | Both sites listed once |

### UPL-SITE-11 – Wrong file type accepted by picker (negative)
| # | Action | Expected |
|---|---|---|
| 1 | "Upload": choose a `.pdf` file instead of the template; confirm | Messages recorded; reload |
| 2 | Same with a `.csv` file (one site row) | Messages recorded; reload |
| 3 | Sites table | Site count unchanged; "Site Q <RUN>" not created |

### UPL-SITE-12 – Header-only file (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Upload the template with one empty data row | Result recorded |
| 2 | Sites count | Unchanged, nothing created |

### UPL-SITE-13 – Reports can be downloaded (positive)
Listed under Bulk Upload Status below (it runs there).

---

## Bulk Upload Status

Precondition for all: the uploads made above (file names are kept in the run data).

### PM-REG-BUS-08 – Every upload screen is tracked (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Sidebar › Project Management › "Bulk Upload Status" | Page opens |
| 2 | Uploads table, UPL-MM-03 row | Dated today, uploader = signed-in account, type "Materials", Status "Success", a success report link |
| 3 | Uploads table, UPL-SITE-02 row | Same with type "Sites". Fails with "Site upload status not recorded" if the Status is "-" while a success report exists |

### PM-REG-BUS-09 – Failed upload is tracked (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Uploads table, UPL-MM-04 row | Status "Failed", a failure report, no success report. Fails with "Application defect: ... upload record(s) have no status" if the Status is "-" with only a failure file |

### PM-REG-BUS-11 – Uploader is captured (positive)
| # | Action | Expected |
|---|---|---|
| 1 | "Search by uploader…": enter the account e-mail | Every row shows that uploader and the UPL-MM-03 upload is listed; clear the box |

### PM-REG-BUS-12 – Partial-success upload (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Uploads table, UPL-MM-05 row | Status "-" or "Partly successful"; success report and failure report both present |

### UPL-MM-15 – Reports can be downloaded (Material Master upload, positive)
| # | Action | Expected |
|---|---|---|
| 1 | Uploads table, UPL-MM-05 row: click the success report link | A workbook file downloads |
| 2 | Same with the failure report link | A workbook file downloads |

### UPL-SITE-13 – Reports can be downloaded (Site Details upload, positive)
| # | Action | Expected |
|---|---|---|
| 1 | Uploads table, UPL-SITE-04 row: click the success report link | A workbook file downloads |
| 2 | Same with the failure report link | A workbook file downloads |

---

## System Messages

Messages from earlier runs cannot be deleted (SCP-DEF-032), so the suite deactivates what it creates.

### PM-REG-SYS-00 – No active banner left by earlier automation runs (positive)
Runs on the System Messages page as the first scenario of this section.

| # | Action | Expected |
|---|---|---|
| 1 | For every active message titled "PMR2-…": click "Edit", untick "Active", "Save"; reload | No "PMR2-" banner is shown; the number deactivated is recorded |

### PM-REG-SYS-03 – Body required (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Sidebar › Project Management › "System Messages" | Page opens |
| 2 | "New message": title "Empty <RUN>", no body | "Create" stays disabled; click "Cancel" |

### PM-REG-SYS-05 – Ends before Starts (negative)
| # | Action | Expected |
|---|---|---|
| 1 | "New message": title "Order <RUN>", a body, Starts in 2 days, Ends in 1 day, click "Create" | Outcome recorded; message not created |

### PM-REG-SYS-07 – Create scheduled message (positive)
| # | Action | Expected |
|---|---|---|
| 1 | "New message": title "Sched <RUN>", Info, Starts in 7 days, Ends in 8 days, "Create" | Message created and its row shows "Scheduled" |

### PM-REG-SYS-08 – Active message shows banner (positive)
| # | Action | Expected |
|---|---|---|
| 1 | "New message": title "Active <RUN>", Info, window from 1 hour ago to tomorrow, "Create" | Message created |
| 2 | Reload | "Project notice" banner shows the title "Active <RUN>" and its body |

### PM-REG-SYS-12 – Warning vs Info styling (positive)
| # | Action | Expected |
|---|---|---|
| 1 | "New message": title "Warn <RUN>", severity "Warning", window covering now, "Create"; reload | Message created |
| 2 | Compare the banners | The Warning banner background colour differs from the Info banner's (both colours recorded) |

### PM-REG-SYS-09 – Inactive / expired not shown (positive)
| # | Action | Expected |
|---|---|---|
| 1 | "New message": "Inactive <RUN>" with "Active" unticked; then "Past <RUN>" with a window in the past; reload | Outcomes recorded |
| 2 | Page banners | No "Project notice" banner for "Inactive <RUN>" or "Past <RUN>" |

### PM-REG-SYS-10 – Delete message (positive)
| # | Action | Expected |
|---|---|---|
| 1-5 | For each of "Active <RUN>", "Warn <RUN>", "Sched <RUN>", "Inactive <RUN>", "Past <RUN>": click "Delete" (dialogs accepted), reload | Result recorded (skipped when not listed) |
| 6 | Deactivate any message that failed to delete (Edit, untick "Active", Save), reload | No banner from this run left. The step fails if a delete failed (HTTP 500, SCP-DEF-032) |

Note: SCP-DEF-032 – Delete currently fails on the server.

### Skipped
No skipped scenarios in this section.

---

## Watched Materials

### PM-REG-WM-04 – Add category watch (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Sidebar › Project Management › "Watched Materials"; select the signed-in user (by full profile name) in the first dropdown | That user's watches show |
| 2 | Second dropdown "Category", third dropdown "Cat <RUN> E", click "Add watch" (skipped if already present) | Row of type "Category" for "Cat <RUN> E" appears |

### PM-REG-REF-17 – New category flows downstream (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Recorded "Add Material › Category" list | Includes "Cat <RUN> E" |
| 2 | Recorded "New Question Set › categories" list | Includes "Cat <RUN> E" |
| 3 | Watched Materials › Category list | Includes "Cat <RUN> E" |

### PM-REG-WM-06 – Duplicate watch (negative)
| # | Action | Expected |
|---|---|---|
| 1 | "Add watch": Category "Cat <RUN> E" again, if the app still offers it | Outcome recorded (or noted that it is no longer offered); only one row for it |

### PM-REG-WM-07 – Notifications toggle (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Notification button on the "Cat <RUN> E" row: set to "On" first if needed, click it, reload, reselect the user | Shows "Off" or "Muted" |
| 2 | Always runs: click until it shows "On", reload | Shows "On" |

### PM-REG-WM-09 – Trade watch (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Second dropdown "Trade": first trade, click "Add watch" | Row of type "Trade" appears (skipped with a note when NRVC_Hall has no trades) |

### PM-REG-WM-10 – One user can watch every category (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Dropdown "Category": add a watch for every category not yet watched | Number added recorded |
| 2 | Watch rows of type "Category" | Each category listed once; every category from the Category list is watched |

### PM-REG-WM-05 – Watch appears on Dashboard (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Sidebar › "Management Dashboard" | "Your watched materials" lists "Cat <RUN> E" |

### PM-REG-WM-08 – Remove watch (positive)
| # | Action | Expected |
|---|---|---|
| 1 | Watched Materials (signed-in user): click "Remove" on the "Cat <RUN> E" row, confirm | Row removed |
| 2 | Sidebar › "Management Dashboard" | "Your watched materials" no longer lists "Cat <RUN> E" |
| 3 | Watched Materials: "Remove" and confirm for every row containing "PMR2-" (test categories of this and earlier runs) | None left; number removed recorded |

---

## Other project › SCP_Testing_Ram

Env `PM_FLOW_SECOND_PROJECT` can change the second project. These scenarios run last; project switching uses the project selector.

### PM-REG-REF-24 – Common UoM belongs to the project (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Project selector: switch to SCP_Testing_Ram | Project loads |
| 2 | Sidebar › Project Management › Reference Data › "Common UoM" | Page opens |
| 3 | Search "UoM <RUN> E" | Not listed on this project. Fails with "Common UoM is shared across projects" if it is (R64) |

### PM-REG-REF-25 – Material Category belongs to the project (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Sidebar › Project Management › Reference Data › "Material Category" | Page opens |
| 2 | Search "Cat <RUN> E" | Not listed on this project |
| 3 | "Material Master" › "Add Material" › "Choose Category" | "Cat <RUN> E" is not offered |

### PM-REG-FDI-47 – New question hidden from other organizations (negative)
| # | Action | Expected |
|---|---|---|
| 1 | Sidebar › Project Management › "First Delivery Inspection Config" | Page opens |
| 2 | Questions list | "FDI Q2 <RUN>" is not present |
| 3 | "Add Question" › "Add from Organization Bank": search the run token; close the form | No result. The note "LLE - Test not checked in this run (one more project switch)" is recorded |

### PM-REG-FDI-06 – Settings are per project (positive)
| # | Action | Expected |
|---|---|---|
| 1 | FDI Settings on SCP_Testing_Ram: flip "Need Overall Notes to be captured", click "Save", reload | Flipped value kept |

### PM-REG-FDI-06b – NRVC_Hall unchanged while SCP_Testing_Ram differs (positive)
Combines the CFG-18 and FDI-06 checks. Runs without opening a page first.

| # | Action | Expected |
|---|---|---|
| 1 | Project selector: switch back to NRVC_Hall | Project loads |
| 2 | Sidebar › "Configuration Options" | "Currency Type" still shows the original currency |
| 3 | Sidebar › "First Delivery Inspection Config" | FDI Settings equal their original values |

### PM-REG-FDI-06c – Restore SCP_Testing_Ram (positive)
Runs without opening a page first.

| # | Action | Expected |
|---|---|---|
| 1 | Project selector: switch to SCP_Testing_Ram | Project loads |
| 2 | First Delivery Inspection Config: set "Need Overall Notes to be captured" back to its original value, "Save", reload | Restored (nothing to do if FDI-06 changed nothing) |
| 3 | Project selector: switch back to NRVC_Hall | Project loads |

### PM-REG-CFG-18 – Currency is set per project (skipped)
Not automated – SCP_Testing_Ram's Configuration Options cannot be saved while its week fields are empty ("... is required"), and filling them would permanently configure that project (CFG-17 and the Setup Wizard checks need it unconfigured); needs go-ahead. Partly covered by FDI-06b step 2.

### PM-REG-PSC-05 – Menu item follows the Pre-Shipping toggle (skipped)
Not automated – same reason as CFG-18.

---

## Role-based access

### PM-REG-ROLE-01 to PM-REG-ROLE-24 – Role-based access (skipped)
Not automated – role suite (Regression part 3): needs the Org Admin portal session and separate role logins.
