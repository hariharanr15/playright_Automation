# Inventory Management Regression – step-by-step flows

- Spec: `tests/pm-flow/inv-regression.spec.js` (suite "Inventory Management Regression")
- Command: `npm run inventory:regression`
- Run tag: `INR` + yymmddHHMM from the start time (e.g. `INR2611061030`); used in activity comments and the extra location name `Loc <RUN>`
- Catalogue: INV_SCENARIOS.md
- Preconditions: Project Admin on NRVC_Hall; the standard test material ("M" below, 43 Inches) has stock delivered by the Procurement regression runs (first location of the site).
- Shared data: run submittals from the Procurement regression (names like `PLD…-SUB-01`, `PLT…`, `PLR…`, `PLS…`; `PLD1102-SUB-01`/`-07` are preferred). Imported ones (-SUB-I1/I2) have no schedule lines, so the Add Activity step tries up to 12 submittals until one offers a Schedule.
- Writes approved on NRVC_Hall: manual activities, uploads and one extra location for Internal Movement (INV-R4).
- The Add Activity date input is never clicked (SCP-DEF-002 freezes the tab).

Common flows used below:

- **Ledger**: reopen /inventory-management, search M, row "⋮" › "Actions".
- **Add Activity**: on the ledger click "Add Activity"; fill Item = M, Action, From Location (first real location unless stated), To Location (only Internal Movement), QTY, Comments (`<RUN> <action>`), first Supplier, first Subcontractor, a run Submittal, then its Schedule (waits 2 s after the Submittal change); then "ADD" (wait 2 s).
- **Closing Balance**: the "Closing Balance" text on the ledger.

## Setup

### INV-REG-SETUP – Sign in on NRVC_Hall (setup)

| # | Action | Expected |
|---|---|---|
| 1 | Sign in: login page, user/password, Supply Chain Planner, project NRVC_Hall, test site | Management dashboard with project and site selected |
| 2 | Menu "Inventory Management" | List shows items (critical) |
| 3 | Search M; read the Inventory column | Inventory is above 3 (critical); run tag and quantity noted. Failure aborts the run |

## Integration and Positive

### INV-REG-01 – GRN creates Incoming Load (Integration)

| # | Action | Expected |
|---|---|---|
| 1 | Open the ledger of M | At least one "Incoming Load" row (from the Procurement runs) |
| 2 | Read "Closing Balance" | Equals the grid Inventory read at setup |

### INV-REG-21 – Damaged units counted as received (Integration)

Not automated – checked in the Procurement regression (PL-REG-DLV-13: Incoming Load = delivered QTY incl. damaged).

### INV-REG-13 – Pickers filtered by material (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Ledger › "Add Activity": Action "Issue To Construction", QTY 1; do not save | Supplier list contains the run supplier; Submittal list has run submittals; Schedule list not empty |
| 2 | Read the stock hint | "Available at <location>: <qty>" shown; value kept for INV-REG-12 |
| 3 | Press Escape | Form closes without saving |

### INV-REG-12 – Available stock hint = location balance (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Reopen the list; row "⋮" › "Location"; read QTY of the From Location row | Equals the hint from INV-REG-13 |

### INV-REG-02 – Issue To Construction (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Ledger; note Closing Balance; Add Activity "Issue To Construction", QTY 2, "ADD" | Form closes (saved); critical step |
| 2 | Reopen the ledger | Closing Balance is 2 lower; an "Issue To Construction" row is listed |
| 3 | (observation only) | Landing grid refresh is checked in INV-REG-15 |

### INV-REG-15 – Grid refreshes after an activity (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Ledger; note Closing Balance; Add Activity "Loss", QTY 1, "ADD"; Escape; menu "Inventory Management" without a page reload; search M | Grid Inventory is 1 lower than the earlier balance |

Note: OBS-INV-4 (stale grid after a manual activity).

### INV-REG-03 – Loss (Positive)

Not automated – Loss 1 is executed and its balance checked in INV-REG-15.

### INV-REG-04 – Return reduces stock and writes back to Procurement (Integration)

| # | Action | Expected |
|---|---|---|
| 1 | Ledger; note Closing Balance; Add Activity "Return", QTY 1, "ADD" | Activity submitted; its submittal is remembered (critical) |
| 2 | Reopen the ledger | Closing Balance is 1 lower |
| 3 | Menu "Procurement Log"; search the Return submittal; open it; click component M | A "Return" row is listed |

### INV-REG-05 – Manual Incoming on a partial schedule (Integration)

| # | Action | Expected |
|---|---|---|
| 1 | Ledger; open Add Activity "Incoming Load" QTY 1 (no save) to read the Submittal list; close it. For up to 8 run submittals (preferred first): ledger, Add Activity "Incoming Load", QTY 1, that Submittal, "ADD"; stop when one is accepted and one rejected | Accepted = form closes; rejected = form stays open with "scheduled_quantity" / "Cannot add this activity". At least one accepted |
| 2 | Procurement Log; search the accepted submittal; open it; click component M | Delivery shows "Via Inventory" |

### INV-REG-06 – Incoming beyond the scheduled quantity rejected (Negative)

| # | Action | Expected |
|---|---|---|
| 1 | If a rejection was seen in INV-REG-05 use it; otherwise ledger, note Closing Balance, Add Activity "Incoming Load" QTY 99999 on the accepted submittal, "ADD" | Form stays open (not saved); message matches "Cannot add this activity" or "exceeds"; Closing Balance unchanged |

### INV-REG-07 – Overdraw rejected (Negative)

| # | Action | Expected |
|---|---|---|
| 1 | Ledger; note Closing Balance; Add Activity "Loss", QTY 99999, "ADD"; read message; close the form; reopen ledger | Form stays open with "Not enough stock at <location>: only N available, 99999 requested"; Closing Balance unchanged |

### INV-REG-08 – QTY 0 rejected (Negative)

| # | Action | Expected |
|---|---|---|
| 1 | Same flow with Add Activity "Loss", QTY 0 | Form stays open with "Quantity cannot be empty or zero or less"; Closing Balance unchanged |

### INV-REG-09 – QTY with 3 decimals (Negative)

| # | Action | Expected |
|---|---|---|
| 1 | Same flow with Add Activity "Loss", QTY 1.555 | Form stays open with a message about 2 decimal places; Closing Balance unchanged |

Note: OBS-INV-10 (the app shows only the generic "Invalid data provided.").

### INV-REG-10 – Internal Movement to the same location (Negative)

| # | Action | Expected |
|---|---|---|
| 1 | Ledger; Add Activity "Internal Movement", QTY 1 (no save); set To Location = the From Location; "ADD" (wait 1.5 s); close the form | "From Location and To Location must be different." |

### INV-REG-11 – Internal Movement between two locations (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Reopen the list; read the Location dropdown. If fewer than 2 locations: open /site-details, site row "ADD", "Choose Location" = "Construction Area", enter name `Loc <RUN>`, "Add" | A second location exists (existing or created) (critical) |
| 2 | Row "⋮" › "Location": note QTY of the source (first location) and the destination. Ledger; Add Activity "Internal Movement", From = source, To = second location, QTY 1, "ADD" | Form closes (saved) (critical) |
| 3 | Row "⋮" › "Location" for both locations | Source QTY is 1 lower, destination QTY is 1 higher |

### INV-REG-14 – Schedule must match the submittal (Negative)

| # | Action | Expected |
|---|---|---|
| 1 | Ledger; Add Activity "Loss", QTY 1 (no save); pick Submittal A and its Schedule (note its PO); change Submittal to B without re-picking Schedule; close; reopen the ledger and note existing rows; Add Activity again with Submittal A, change Submittal to B, "ADD" | The app rejects the save (form stays open), or no new row combines A's schedule with B's submittal. Fails if such a row was saved |

## Upload

### INV-REG-19 – Upload with optional columns blank (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Reopen the list; "Upload"; "Download template" | Sheet "Inventory Template" header is Submittal No, Material, Item, Date Required On Site, PO Number, Action, From Location, To Location, Quantity, UoM, Supplier, Comments (critical) |
| 2 | Click "Cancel"; ledger; Add Activity "Loss" QTY 1 (no save) with a run submittal other than PLD1102-SUB-01 (the upload rejects it as ambiguous, OBS-INV-13); read Submittal, Schedule date and PO number; close the form | Values kept for the upload rows (critical) |
| 3 | Ledger; note Closing Balance; create a file with one row (that submittal, M, Item M, date, PO, Loss, From Location, QTY 1, UoM/Supplier/Comments blank); "Upload"; choose the file; "Upload" | Message "uploaded successfully" |
| 4 | Press Escape; reopen the ledger | Closing Balance is 1 lower |

Note: OBS-INV-13 (duplicate submittal is rejected as ambiguous by the upload).

### INV-REG-17 – Upload valid file applies rows top to bottom (Positive)

Runs only if INV-REG-19 passed; otherwise skipped ("INV-REG-19 failed").

| # | Action | Expected |
|---|---|---|
| 1 | Ledger; note Closing Balance; create a file with two rows (Issue To Construction 1, Loss 1; comments `<RUN> upload <action>`); "Upload"; choose the file; "Upload" | "uploaded successfully" |
| 2 | Escape; reopen the list; read the grid Inventory of M; open the ledger | Grid Inventory and Closing Balance are both 2 lower than before |

### INV-REG-16 – Upload is all-or-nothing (Negative)

Runs only if INV-REG-19 passed; otherwise skipped.

| # | Action | Expected |
|---|---|---|
| 1 | Ledger; note Closing Balance; create a file with Loss 1 and Loss 99999 (comment `<RUN> atomic`); "Upload"; choose the file; "Upload" | "The upload failed. Nothing was saved." |
| 2 | Click "Download error file" and open it | A row "Valid (not saved)" and a row with "Not enough stock … N available"; N is kept for INV-REG-18 |
| 3 | Click "Close"; reopen the ledger | Closing Balance unchanged |

### INV-REG-18 – Upload available stock matches the ledger (Positive)

Runs only if INV-REG-19 passed; otherwise skipped.

| # | Action | Expected |
|---|---|---|
| 1 | Compare the "available" figure from the error file with the ledger Closing Balance | Equal |

## Read-only checks

### INV-REG-20 – Ledger columns (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Open the ledger; read the "Submittal" column of a row whose submittal looks like PL…- | Value contains "-SUB-" (Submittal No, not Spec Section No) |

Note: OBS-INV-1.

### INV-REG-22 – Export is the balance list (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Reopen the list; click "Export"; open the xlsx | Header contains Material ID, Material Name, Inventory |

Note: OBS-INV-8 (export is the activity log, not the balance list).

### INV-REG-23 – Site isolation (Positive)

| # | Action | Expected |
|---|---|---|
| 1 | Open the list; note the active site in the header and the Location dropdown options | Locations of the first site recorded |
| 2 | Header site selector: switch to the second site (`SCP_INV_SITE2`, else a default pair) | Location dropdown lists none of the first site's locations |
| 3 | Reload the page | Header still shows the second site |
| 4 | Header site selector: switch back to the starting site if different | Starting site active again |

Note: OBS-INV-12 (header site reverts after reload).

### INV-REG-24 – History date filter inclusive (Positive)

Not automated – covered by the 24 Oct Inventory automation; the ledger date pickers are not driven here (SCP-DEF-002 risk).

### INV-REG-25 – Activity date picker (Known Defect)

Not automated – SCP-DEF-002: clicking the input freezes the tab, so it is never clicked.

Note: SCP-DEF-002.
