# Inventory Management – Regression Test Cases

| | |
|---|---|
| **Module** | Inventory Management |
| **Automated by** | `tests/pm-flow/inv-regression.spec.js` (suite "Inventory Management Regression") – same IDs and steps as below |
| **Page objects** | `pages/inventory-management/inventory-management.page.js`, `inventory-bulk-upload.page.js`, `pages/project-management/site-details.page.js` |
| **Test data** | `test-data/inventory-regression.json`; material, supplier and site from `tests/pm-flow/support/pl-flow.js` |
| **How to run** | `npm run inventory:regression` → report `reports/pm-flow/inv-regression-<time>/report.html` |
| **Scenario catalogue** | [INV_SCENARIOS.md](../INV_SCENARIOS.md) |
| **Last revised** | 21 Nov 2026 (readability pilot) |

## Why this suite exists

Site teams record every stock movement in Inventory Management: material issued to construction, losses, returns, goods received, moves between storage locations and bulk uploads. If any of these changes the stock by the wrong amount, or accepts an invalid entry, the site plans with stock it does not have. The suite also checks that Inventory and the Procurement Log tell the same story about deliveries and returns.

## Requirement status – read this first

Each test case states the status of the rule it checks, taken from the requirement register (`docs/requirements/requirements-register.json`):

- **A – Confirmed:** an approved business rule. Pass/fail is meaningful.
- **B – Observed:** what the application does today. There is no confirmed rule yet, so a pass only means "behaviour unchanged".
- **C – Suggested:** a plausible rule nobody has confirmed.
- **D – Pending client:** an open question to the client.

Only 4 of these test cases check a confirmed (A) rule: INV-REG-04, 05, 21 and 22. For the others, a failure means "the application differs from the expected result written here", which is not necessarily a defect until the client confirms the rule.

## Common preconditions (all test cases)

1. Signed in as **Project Admin** on project **NRVC_Hall**, with the test site **"Warehoust _NR"** selected in the header.
2. The test material **"43 Inches"** has **at least 4 units** in stock at the first location of the site. The Procurement regression delivers this stock (delivery → GRN), so run it first.
3. Run submittals from the Procurement regression exist (numbers like `PLD…-SUB-01`, `PLT…`, `PLR…`, `PLS…`).
4. Each run has a **run tag** (`INR` + date and time, for example `INR2611211030`). It goes into activity comments and into the name of any location the run creates, so the run's records can be found again.

## Safety rules

- The **date field** of the Add Activity form is **never clicked**: it freezes the browser tab (known defect SCP-DEF-002).
- Steps that **save** something run **once**. Repeating them could record the same activity twice.
- Writes approved on NRVC_Hall: manual activities, uploads, and one extra location for Internal Movement.

## Terms used below

- **List page:** Inventory Management, listing materials with their stock in the "Inventory" column.
- **Ledger:** a material's history of stock movements. Open it from the material's row menu "⋮" › "Actions". Its top shows the **Closing Balance** (current stock).
- **Location view:** the material's stock per storage location, opened from the row menu "⋮" › "Location".
- **Add Activity form:** opened from the ledger. Fields: Item, Action, From Location, (To Location), QTY, Comments, Supplier, Subcontractor, Submittal, Schedule. A saved activity closes the form without a success message (OBS-INV-9).

---

## Setup

### INV-REG-SETUP – Sign in and check there is stock to work with

| Field | Value |
|---|---|
| Feature | Access and starting stock |
| Scenario | The tester signs in and confirms the test material has enough stock for the run |
| Business purpose | The later scenarios remove about 8-9 units, all from one source location chosen at setup. Without enough stock there they would fail for the wrong reason. |
| Requirement status | Not a business rule (test setup) |
| Test data | Account and project from `.env`; site "Warehoust _NR"; material "43 Inches"; minimum site stock 4; minimum stock at the source location 12 (`minimumSourceLocationStock`), checked on up to 3 locations (`maximumSourceLocationCandidates`) |

| # | Action | Why | Expected result |
|---|---|---|---|
| 1 | Open the Voyage Control sign-in page | Start of every session | Heading "Welcome To Voyage Control" |
| 2 | Enter the Project Admin e-mail and password, click "Sign in" | Sign in | The signed-in e-mail is shown (platform chooser) |
| 3 | Click the "Supply Chain Planner" tile | Open SCP | Management Dashboard opens |
| 4 | Choose project "NRVC_Hall" in the header | Work on the test project | Project name shown in the header |
| 5 | Choose site "Warehoust _NR" in the header | Inventory is kept per site | Site name shown in the header |
| 6 | Open "Inventory Management" from the left menu | Every scenario starts here | The list shows at least one material |
| 7 | Search "43 Inches" and read its "Inventory" column | Check the starting stock | Stock is 4 or more |
| 8 | Open ⋮ › "Location", rank the real locations (not placeholders or run-created "Loc INR…") by QTY; for the top 3, open Add Activity (Loss, QTY 1, from that location, not saved) and read "Available at <location>: N" | Pick a source location that really has stock; the form figure is the one the save check uses | The first location with N ≥ 12 becomes the source for every activity in the run. If none qualifies, the run stops; deliver stock with `npm run procurement:regression` |

**Final expected outcome:** the tester is on Inventory Management with enough stock. If not, the run stops and every other scenario is reported as Blocked.

---

## Integration and positive scenarios

### INV-REG-01 – A GRN in the Procurement Log creates an "Incoming Load"

| Field | Value |
|---|---|
| Feature | Ledger – goods received from the Procurement Log |
| Scenario | Goods received through a GRN appear in the stock ledger automatically |
| Business purpose | Site stock must grow when goods are received, without anyone typing it in twice |
| Requirement status | B – Observed (REQ-INV-011) |
| Test data | Material "43 Inches"; GRNs created by earlier Procurement regression runs |

| # | Action | Why | Expected result |
|---|---|---|---|
| 1 | Open the ledger of "43 Inches" | See the stock history | At least one "Incoming Load" row |
| 2 | Read the ledger's Closing Balance | The list and the ledger must agree | Closing Balance = the stock read in setup step 7 |

**Final expected outcome:** received goods are in the ledger, and the ledger and the list show the same stock.

### INV-REG-21 – Damaged units are counted as received

| Field | Value |
|---|---|
| Requirement status | A – Confirmed (REQ-INV-004, rule PL-R16) |
| Automation | **Not automated in this suite.** Checked in the Procurement regression (PL-REG-DLV-13). That check is currently skipped, so this rule has **no executed check** (see `docs/automation-gap-analysis/02_ProcurementLog_Inventory.md`). |

### INV-REG-13 – The form offers only records of the chosen material

| Field | Value |
|---|---|
| Feature | Add Activity form – Supplier, Submittal and Schedule lists |
| Scenario | After the material is chosen, the lists contain only its suppliers, submittals and schedules |
| Business purpose | Users must not link a stock movement to a purchase of a different material |
| Requirement status | B – Observed (REQ-INV-013) |
| Test data | Action "Issue To Construction", QTY 1 (not saved); supplier "LG" |

| # | Action | Why | Expected result |
|---|---|---|---|
| 1 | In the ledger, open Add Activity and fill Item, Action "Issue To Construction", QTY 1, a run submittal and its schedule. **Do not save.** | See what the lists offer | Supplier list contains "LG"; Submittal list contains run submittals (PL…-SUB-…); Schedule list is not empty |
| 2 | Read the hint "Available at <location>: <qty>" | The hint tells the user how much can be used; INV-REG-12 checks it | The hint is shown with a quantity |
| 3 | Press Escape | Leave without saving | The form closes; nothing is recorded |

**Final expected outcome:** the form offers only this material's records, and nothing is saved.

### INV-REG-12 – The "Available at" hint equals the stock at that location

| Field | Value |
|---|---|
| Feature | Add Activity form – available stock hint |
| Scenario | The hint shows the same quantity as the Location view |
| Business purpose | If the hint is wrong, users issue stock that is not there, or think stock is missing |
| Requirement status | D – Pending client (REQ-INV-031) |
| Preconditions | INV-REG-13 ran and recorded the hint |

| # | Action | Why | Expected result |
|---|---|---|---|
| 1 | Open the material's Location view; read the quantity of the form's From Location | Compare the two figures | The quantity equals the hint from INV-REG-13. **Today:** they differ (21 Nov: hint 68, Location view 94 at Gate 5), reported as Known Defect **SCP-DEF-053**, pending team confirmation (OBS-INV-14) |

**Final expected outcome:** the hint and the location stock are equal.

### INV-REG-02 – "Issue To Construction" reduces the stock

| Field | Value |
|---|---|
| Feature | Add Activity – Issue To Construction |
| Scenario | Issuing 2 units lowers the stock by 2 |
| Business purpose | The most common movement on site; the stock must follow exactly |
| Requirement status | B – Observed (REQ-INV-014); D for the sign of the quantity (REQ-INV-039) |
| Test data | Action "Issue To Construction", QTY 2, the run's source location (setup step 8), first supplier and subcontractor, a run submittal and schedule, comment "<run tag> Issue To Construction" |

| # | Action | Why | Expected result |
|---|---|---|---|
| 1 | In the ledger, note the Closing Balance; record the activity and click "ADD" | Record the issue | The form closes (saved). **Runs once.** |
| 2 | Reopen the ledger | Check the effect | Closing Balance is 2 lower; an "Issue To Construction" row is listed |
| 3 | (note only) | The list page refresh is a separate rule | Checked in INV-REG-15 |

**Final expected outcome:** stock is exactly 2 lower and the movement is listed.

### INV-REG-15 – The list page shows the new stock without a reload

| Field | Value |
|---|---|
| Feature | List page refresh after an activity |
| Scenario | After a Loss, going back to the list (through the menu, no reload) shows the lower stock |
| Business purpose | Users read stock on the list page; a stale figure leads to wrong decisions |
| Requirement status | B – Observed (REQ-INV-014); D – Pending client (REQ-INV-033) |
| Test data | Action "Loss", QTY 1 |

| # | Action | Why | Expected result |
|---|---|---|---|
| 1 | In the ledger, note the Closing Balance; record a Loss of 1 and click "ADD" (**runs once**); press Escape; open Inventory Management from the menu; search the material | Check the list without reloading the page | The list shows 1 unit less than the Closing Balance before the loss |

**Final expected outcome:** the list is up to date. **Known behaviour today:** the list stays stale (OBS-INV-4), reported as Known Defect **SCP-DEF-055**, pending team confirmation.

### INV-REG-03 – Loss

Not a separate run: the Loss of 1 in INV-REG-15 is this case, and its balance is checked there.

### INV-REG-04 – A Return reduces stock and shows on the purchase

| Field | Value |
|---|---|
| Feature | Add Activity – Return; Procurement Log write-back |
| Scenario | Returning 1 unit lowers the stock by 1 and adds a "Return" row to the purchase in the Procurement Log |
| Business purpose | Returned goods must leave the site stock and be visible to the buyer |
| Requirement status | **A – Confirmed (REQ-INV-003)** |
| Test data | Action "Return", QTY 1, a run submittal with a schedule |

| # | Action | Why | Expected result |
|---|---|---|---|
| 1 | In the ledger, note the Closing Balance; record a Return of 1 and click "ADD" | Record the return | Saved; the submittal used is remembered. **Runs once.** |
| 2 | Reopen the ledger | Check the stock | Closing Balance is 1 lower |
| 3 | Open the Procurement Log, search that submittal, open it, click the "43 Inches" component | Check the write-back | A "Return" row is listed |

**Final expected outcome:** stock is 1 lower and the purchase shows the return.

### INV-REG-05 – A manual Incoming Load is accepted on a partly delivered schedule

| Field | Value |
|---|---|
| Feature | Add Activity – Incoming Load; Procurement Log write-back |
| Scenario | Receiving 1 unit directly in Inventory is accepted while the schedule is not fully delivered, and the Procurement Log shows it |
| Business purpose | Goods can arrive without a Procurement Log delivery; they must still count against the purchase |
| Requirement status | **A – Confirmed (REQ-INV-001, rule INV-R1)** for the write-back; B – Observed (REQ-INV-015) for acceptance |
| Test data | Action "Incoming Load", QTY 1; up to 8 run submittals, preferred `PLD1102-SUB-01` / `-07` first |

| # | Action | Why | Expected result |
|---|---|---|---|
| 1 | Read the offered submittals once (form not saved). Then, for each candidate in turn: open the ledger, record Incoming Load 1 on it, click "ADD". Stop after one is accepted and one rejected. **Runs once.** | Find a partly delivered schedule (accepts) and a fully delivered one (rejects) | At least one is accepted (the form closes). A rejected one shows "scheduled_quantity" / "Cannot add this activity". |
| 2 | Open the accepting submittal's component in the Procurement Log | Check the write-back | A delivery marked "Via Inventory" is shown |

**Final expected outcome:** the manual receipt is accepted and appears on the purchase. **Gap:** the confirmed rule also says it must count toward the component's Received and Remaining quantities. That part is not checked yet (GAP-INV-001).

### INV-REG-11 – Moving stock between two locations

| Field | Value |
|---|---|
| Feature | Add Activity – Internal Movement |
| Scenario | Moving 1 unit lowers the source location by 1 and raises the destination by 1 |
| Business purpose | Stock moved inside the site must stay counted, at the right place |
| Requirement status | **C – Suggested (REQ-INV-029)**. Under the register's rules a C rule should not be checked as pass/fail until it is approved; this case does so today and **needs approval** |
| Test data | Action "Internal Movement", QTY 1. Source: the first location that can hold stock (not a location created by an earlier run, which is empty). Destination: an existing second location, or a new "Loc <run tag>" of type "Construction Area". |

| # | Action | Why | Expected result |
|---|---|---|---|
| 1 | Read the list's location filter. If the site has fewer than 2 locations: Site Details › the site's row "ADD" › type "Construction Area", name "Loc <run tag>" › "Add". **Runs once.** | A movement needs two locations | A second location exists |
| 2 | Note the stock at the source and the destination (Location view). In the ledger, record Internal Movement 1 from source to destination, click "ADD". **Runs once.** | Make the movement | The form closes (saved) |
| 3 | Read both locations again | Check the effect | Source is 1 lower; destination is 1 higher |

**Final expected outcome:** the unit moved and the total is unchanged.

### INV-REG-19 – Upload with the optional columns left blank

| Field | Value |
|---|---|
| Feature | Bulk upload – template and optional columns |
| Scenario | The template has the agreed columns, and a row with UoM, Supplier and Comments blank is accepted |
| Business purpose | Sites record many movements at once by uploading a file; optional columns must really be optional |
| Requirement status | B – Observed (REQ-INV-020, REQ-INV-022); D – Pending client (REQ-INV-043, REQ-INV-045) |
| Test data | Template sheet "Inventory Template" with 12 columns (see the test data file). Upload row: a run submittal (not `PLD1102-SUB-01`, which exists twice and is rejected as ambiguous, OBS-INV-13), "43 Inches", item "43 Inches", the schedule's date (DD/MM/YYYY) and PO number, action "Loss", the source location, quantity 1; UoM, Supplier and Comments blank. |

| # | Action | Why | Expected result |
|---|---|---|---|
| 1 | Inventory Management › "Upload" › "Download template" | Get the file format | Sheet "Inventory Template" with columns Submittal No, Material, Item, Date Required On Site, PO Number, Action, From Location, To Location, Quantity, UoM, Supplier, Comments |
| 2 | Click "Cancel". In the ledger, open Add Activity (Loss, QTY 1, not saved) and read a submittal, its schedule date and PO number; close the form | The upload row must point to a real schedule | The three values are read |
| 3 | Note the Closing Balance; build the one-row file; "Upload" › choose the file › "Upload". **Runs once.** | Upload the row | Message "… uploaded successfully" |
| 4 | Close the dialog; reopen the ledger | Check the effect | Closing Balance is 1 lower |

**Final expected outcome:** the template is correct and a minimal row is applied.

### INV-REG-17 – A valid two-row upload applies both rows

| Field | Value |
|---|---|
| Feature | Bulk upload – several rows |
| Scenario | Two valid rows (Issue To Construction 1, Loss 1) are both applied |
| Business purpose | Every row of a correct file must reach the stock |
| Requirement status | B – Observed (REQ-INV-022) |
| Preconditions | INV-REG-19 passed (otherwise this case is reported Skipped) |
| Test data | Two rows like INV-REG-19, comments "<run tag> upload Issue To Construction" and "<run tag> upload Loss" |

| # | Action | Why | Expected result |
|---|---|---|---|
| 1 | Note the Closing Balance; upload the two-row file. **Runs once.** | Apply both rows | "… uploaded successfully" |
| 2 | Reopen the list and read the stock; open the ledger | Check the effect | List stock and Closing Balance are both 2 lower. If the ledger shows a Comments column, both uploaded rows are listed; otherwise this is noted in the report. |

**Final expected outcome:** both rows are applied. *(Changed 21 Nov 2026: step 2 used to contain a check that could never fail. See the change log.)*

### INV-REG-18 – The upload's "available" stock equals the form's stock at the same location

| Field | Value |
|---|---|
| Feature | Bulk upload – stock figure used in validation |
| Scenario | The "available" quantity quoted in the upload error file equals the Add Activity hint for the same From Location |
| Business purpose | The upload and the ledger must use the same stock, or valid files are rejected (or invalid ones accepted) |
| Requirement status | D – Pending client (REQ-INV-032) |
| Preconditions | INV-REG-16 ran and kept the "available" figure and its From Location |
| Test data | Action "Loss", QTY 1 (form not saved) |

| # | Action | Why | Expected result |
|---|---|---|---|
| 1 | Open Add Activity (Loss, QTY 1, not saved) on the same From Location; read "Available at <location>: N"; close the form | The upload's figure is per location, so compare it with the form's figure for that location | The hint names the upload row's location, and the error file's "available" figure = N minus the valid row above the invalid row (INV-R3). **Observed 21 Nov:** 52 − 1 = 51; the rule that earlier rows are deducted is pending team confirmation |

**Final expected outcome:** the error file's figure equals the form's figure for that location, less the valid row above the invalid one.

> Until 21 Nov this case compared the error file with the ledger Closing Balance. That balance covers the whole site, so the two could never match (59 at Gate 5 vs 582 for the site). That was a test error, not an application defect.

### INV-REG-20 – The ledger's "Submittal" column shows the Submittal No

| Field | Value |
|---|---|
| Feature | Ledger columns |
| Scenario | The "Submittal" column of a run row shows the Submittal No |
| Business purpose | Users trace each movement to its purchase by the Submittal No |
| Requirement status | D – Pending client (REQ-INV-034, REQ-INV-035) |

| # | Action | Why | Expected result |
|---|---|---|---|
| 1 | Open the ledger; read the "Submittal" cell of a row from a run submittal (PL…-) | Check what the column shows | The value contains "-SUB-". **Known behaviour today:** it shows the Spec Section No (OBS-INV-1), reported as Known Defect **SCP-DEF-056**, pending team confirmation |

### INV-REG-22 – "Export" downloads the stock balance list

| Field | Value |
|---|---|
| Feature | Export |
| Scenario | The exported file is the list of materials with their stock, as on screen |
| Business purpose | The export is the stock report users share |
| Requirement status | **A – Confirmed (REQ-INV-002, rule INV-R2)** |
| Test data | Expected columns include Material ID, Material Name, Inventory |

| # | Action | Why | Expected result |
|---|---|---|---|
| 1 | On the list page click "Export" and open the file | Check the report content | The header contains Material ID, Material Name and Inventory. **Today:** the file is the activity log (OBS-INV-8). This breaks a confirmed rule and is reported as Known Defect **SCP-DEF-057**. |

### INV-REG-23 – Each site shows only its own locations

| Field | Value |
|---|---|
| Feature | Site selection |
| Scenario | Switching the header site changes the locations offered; the chosen site survives a reload |
| Business purpose | One site's stock must never be offered on another site |
| Requirement status | B – Observed (REQ-INV-024); D – Pending client for the reload (REQ-INV-046) |
| Test data | Second site from `SCP_INV_SITE2`, otherwise "Site T2 Pmr2-2611011614" (or "Warehoust _NR" when starting elsewhere) |

| # | Action | Why | Expected result |
|---|---|---|---|
| 1 | Note the header site and the location filter options | Baseline | The first site's locations are recorded |
| 2 | Switch the header to the second site | Check isolation | None of the first site's locations is offered |
| 3 | Reload the page | Check the choice is kept | The header still shows the second site. **Today:** it reverts (OBS-INV-12), reported as Known Defect **SCP-DEF-058**, pending team confirmation. |
| 4 | Switch back to the starting site | Leave the environment as found | Starting site active again |

---

## Negative scenarios

All negative scenarios use the ledger of "43 Inches". Each one notes the Closing Balance first and checks that it is **unchanged** at the end.

### INV-REG-06 – Receiving more than scheduled is rejected

| Field | Value |
|---|---|
| Requirement status | B – Observed (REQ-INV-016); D – Pending client (REQ-INV-037) |
| Test data | Action "Incoming Load", QTY 99999, the submittal INV-REG-05 accepted |
| Business purpose | Stock must not be received beyond what was ordered and scheduled |

| # | Action | Why | Expected result |
|---|---|---|---|
| 1 | If INV-REG-05 already met a rejecting submittal, use its message. Otherwise record Incoming Load 99999 on the accepted submittal and click "ADD". | Try to over-receive | The form stays open with "Cannot add this activity" or "exceeds"; Closing Balance unchanged |

### INV-REG-07 – Taking more than the stock is rejected

| Field | Value |
|---|---|
| Requirement status | B – Observed (REQ-INV-017) |
| Test data | Action "Loss", QTY 99999 |
| Business purpose | Stock can never go below zero |

| # | Action | Why | Expected result |
|---|---|---|---|
| 1 | Record a Loss of 99999 and click "ADD" | Try to overdraw | The form stays open with "Not enough stock at <location>: only N … available, 99999 requested"; Closing Balance unchanged |

### INV-REG-08 – Quantity 0 is rejected

| Field | Value |
|---|---|
| Requirement status | B – Observed (REQ-INV-018) |
| Test data | Action "Loss", QTY 0 |
| Business purpose | A movement of nothing is a data-entry error |

| # | Action | Why | Expected result |
|---|---|---|---|
| 1 | Record a Loss of 0 and click "ADD" | Boundary: zero | The form stays open with "Quantity cannot be empty or zero or less"; Closing Balance unchanged |

### INV-REG-09 – Quantity with 3 decimals is rejected with a clear message

| Field | Value |
|---|---|
| Requirement status | D – Pending client (REQ-INV-036) |
| Test data | Action "Loss", QTY 1.555 |
| Business purpose | Quantities have at most 2 decimals; the user must be told why the entry is refused |

| # | Action | Why | Expected result |
|---|---|---|---|
| 1 | Record a Loss of 1.555 and click "ADD" | Boundary: decimal places | The form stays open and the Closing Balance is unchanged (checked first). Then the message mentions 2 decimal places. **Today:** only "Invalid data provided." shown twice, reported as Known Defect **SCP-DEF-054**, pending team confirmation (OBS-INV-10) |

### INV-REG-10 – Moving stock to the same location is rejected

| Field | Value |
|---|---|
| Requirement status | B – Observed (REQ-INV-019) |
| Test data | Action "Internal Movement", QTY 1, To Location = From Location |
| Business purpose | A movement must go to a different place |

| # | Action | Why | Expected result |
|---|---|---|---|
| 1 | Fill Internal Movement 1 (not saved), set To Location to the From Location, click "ADD"; close the form | Try an invalid movement | "From Location and To Location must be different." |

### INV-REG-14 – An activity must not keep another submittal's schedule

| Field | Value |
|---|---|
| Requirement status | D – Pending client (REQ-INV-030); known defect **SCP-DEF-045** |
| Test data | Action "Loss", QTY 1; two run submittals A and B |
| Business purpose | A stock movement must stay linked to the right purchase |

| # | Action | Why | Expected result |
|---|---|---|---|
| 1 | Fill a Loss with submittal A and its schedule (note A's PO number), switch to submittal B without choosing a new schedule, close. Note the ledger rows. Fill again with A, switch to B, click "ADD". | Reproduce the mismatch | The save is rejected, or no new row combines A's schedule with B. **Today:** the mismatched pair is saved (SCP-DEF-045), reported as Known Defect. |

### INV-REG-16 – An upload with one invalid row saves nothing

| Field | Value |
|---|---|
| Requirement status | B – Observed (REQ-INV-021) |
| Preconditions | INV-REG-19 passed |
| Test data | Two rows: Loss 1 and Loss 99999, comment "<run tag> atomic" |
| Business purpose | A partly wrong file must not leave half the rows applied |

| # | Action | Why | Expected result |
|---|---|---|---|
| 1 | Note the Closing Balance; upload the two-row file | Try a partly invalid file | "The upload failed. Nothing was saved." |
| 2 | Click "Download error file" and open it | See the reasons | One row "Valid (not saved)" and one "Not enough stock … N available" (N is used by INV-REG-18) |
| 3 | Close the dialog; reopen the ledger | Check nothing was applied | Closing Balance unchanged |

---

## Not automated in this suite

| ID | Title | Reason |
|---|---|---|
| INV-REG-21 | Damaged units counted as received | Checked in the Procurement regression (PL-REG-DLV-13), which is currently skipped |
| INV-REG-03 | Loss | Executed inside INV-REG-15 |
| INV-REG-24 | History date filter is inclusive | The ledger date pickers are not used here (SCP-DEF-002 risk); covered by the 24 Oct Inventory automation |
| INV-REG-25 | Activity date picker | Known defect SCP-DEF-002: clicking the field freezes the tab |

## Change log

| Date | Change |
|---|---|
| 21 Nov 2026 | Readability pilot. Each case now has business purpose, requirement status, test data and a reason for every step. The script now uses the page objects and `test-data/inventory-regression.json`. Behaviour changes: (1) INV-REG-17 no longer contains a check that always passed (`count ≥ 0`); it checks both uploaded rows when the ledger shows comments. (2) INV-REG-11 no longer picks a run-created (empty) location as the movement source. (3) The ledger is read only after its rows have appeared; the original 1.5 s settle is kept too, because the first pilot run read the ledger before it had loaded. (4) Steps that save run once. |
| 21 Nov 2026 | Client unavailable: open issues are captured as Known Defects so the flow runs on today's behaviour. SCP-DEF-053 (INV-REG-12), 054 (09), 055 (15), 056 (20) and 058 (23) are **pending team confirmation**; SCP-DEF-057 (22) breaks confirmed rule INV-R2. See `docs/automation-gap-analysis/PENDING_CONFIRMATIONS.md`. INV-REG-18 corrected to compare like with like (same location, minus the earlier valid row of the same file). INV-REG-01 now waits for the ledger rows instead of counting at once. INV-REG-07/08/09 now check the balance before the message wording. Setup step 8 added: the run stops early when the source location (e.g. Gate 5) has fewer than 12 units. Later the same day (Phase 2) step 8 was changed to choose the real location with the most stock instead of always the first one, so Gate 5 running down no longer stops the suite. |
