# New modules – test cases (24 Nov 2026 redesign)

_Written by QA on 27 Nov 2026 because no client document exists for these modules. The expected results come from the app as observed on staging between 24 and 27 Nov (APP_WALKTHROUGH_2026-11-24, NEW_PAGES_FLOWS_2026-11-26). The client or dev team confirms them; anything they correct is changed afterwards. Status as of 27 Nov 07:45 IST (np-e2e and tov-epd re-run that morning)._

**Data rules (user decisions):**
- One record chain per run, named with `YYMMDD-HHMM`.
- Writes go to NRVC_Hall. Excel Import and Inventory Rebuild run only on NeuralRays_Demo.
- Shared settings a case changes (Payment Terms, EPD categories) are restored and verified in the same run.

**Status legend:**
- ✅ automated and passing
- 🐞 automated; fails on a **defect candidate** (sent to the dev team)
- ❓ automated; fails on a **question to the dev team** (it is not skipped)
- ⏳ not automated yet

**Suites:**

| Suite | npm key | What it covers |
|---|---|---|
| `new-pages-smoke.spec.js` | `new-pages` | Smoke (`*-SMK`) |
| `loads-regression.spec.js` | `loads` | Loads, read-only (`LD-REG`) |
| `new-pages-e2e.spec.js` | `np-e2e` | Load chain: E2E smoke `NPE-SMK` + regression `NPE-REG` |
| `my-work-regression.spec.js` | `my-work` | My Work (`MW-REG`) |
| `tov-epd-regression.spec.js` | `tov-epd` | TOV Analytics (`TV-REG`) + EPD Tracker (`ET-REG`) |
| `import-rebuild-regression.spec.js` | `import-rebuild` | Excel Import (`XI-REG`), Inventory Rebuild (`IR-REG`), Messages (`MS-REG`) |

All of these run in `npm run full:regression`.

## 1. Loads › All Loads

| ID | Level | Test case | Expected result | Automated case | Status |
|---|---|---|---|---|---|
| LD-TC-01 | S | Open All Loads | Tabs, Build load, search, filters | LD-SMK-01 | ✅ |
| LD-TC-02 | S | Upcoming sections and week | 4 sections; week range | LD-SMK-01 | ✅ |
| LD-TC-03 | R | Week range | Week of today – today+6 | LD-REG-01 | ✅ |
| LD-TC-04 | R | Section counter vs content | 0 ⇔ empty message | LD-REG-02 | ✅ |
| LD-TC-05 | R | Dashboard "Loads awaiting receipt" | = Upcoming "Arrived and awaiting receipt" | LD-REG-03 | ✅ |
| LD-TC-06 | R | Status filter | Each status shows "N loads" or "No loads yet" | LD-REG-04 | ✅ |
| LD-TC-07 | R | Site filter | Project sites offered | LD-REG-05 | ✅ |
| LD-TC-08 | E2E | Run load moves Pending → Booked/expected → Received lists | Listed under each status in turn | NPE-SMK-01/02 | ✅ |
| LD-TC-09 | R | Search by load number and material | Load found | NPE-REG-10 | ✅ |
| LD-TC-10 | E2E | Upcoming "Built, not booked" | Pending load listed; gone once expected | NPE-SMK-01/02 | ✅ |
| LD-TC-11 | R | ROJ check column | "1 late" when the expected date is after the ROJ | NPE-SMK-02 | ✅ |

## 2. Build load and the load lifecycle

| ID | Level | Test case | Expected result | Automated case | Status |
|---|---|---|---|---|---|
| BL-TC-01 | S | Open Build load | Open lines, This load, Save disabled | LD-SMK-03 | ✅ |
| BL-TC-02 | R | Open lines load | No error | LD-REG-06 | ✅ |
| BL-TC-03 | R | Empty load | Save load disabled | LD-REG-07, NPE-REG-05 | ✅ |
| BL-TC-04 | E2E | Save load | "LD-N saved.", Pending, actions | NPE-SMK-01 | ✅ |
| BL-TC-05 | R | One CSI division per load | Message, and the open lines are filtered | NPE-REG-05 | ✅ |
| BL-TC-06 | R | Quantity above what is left | Refused | NPE-REG-05 | 🐞 intermittent: on 27 Nov 07:40 the first try kept Save enabled with 19999 typed against 19994 left; the retry showed Save disabled (the check may lag) |
| BL-TC-07 | R | Quantity 0 | Not saved | NPE-REG-15 | ✅ |
| BL-TC-08 | R | Edit a pending load (quantity, notes) | Save changes; kept after reload | NPE-REG-13 | ✅ |
| BL-TC-09 | R | Add a line with another ROJ | Warning "Early/Late" + "Reason for adding this line anyway (required)"; Save disabled until a reason is given; Remove clears it | NPE-REG-14 | ✅ |
| BL-TC-10 | R | Expected date after the ROJ | "Give a reason …"; a Reason field; Save disabled until filled | NPE-REG-11, NPE-SMK-02 | ✅ |
| BL-TC-11 | E2E | Mark as expected | Status Expected; Receive / Change date / Back to pending / Cancel | NPE-SMK-02 | ✅ |
| BL-TC-12 | R | Change date | New date shown | NPE-REG-16 | ✅ |
| BL-TC-13 | R | Back to pending | Pending; listed under "Built, not booked" | NPE-REG-16 | ✅ |
| BL-TC-14 | R | Cancel load (browser confirm "Cancel LD-N? Its quantities become free to load again.") | Cancelled, no actions left; listed under Cancelled; quantity freed | NPE-REG-18 | ✅ (leaves one cancelled 1-piece load per run) |
| BL-TC-15 | R | Delete a pending load (browser confirm) | Gone from every status; quantity freed (a pending load reserves its quantity) | NPE-REG-17 | ✅ |
| BL-TC-18 | R | Load numbers stay unique | A deleted number is not reused | NPE-REG-19 | 🐞 the deleted number is given to the next load (LD-0008 twice) |
| BL-TC-16 | R | Open line falls by the good units received | received − damaged | NPE-REG-04 | ✅ |
| BL-TC-17 | R | Checked-in load is locked | No actions; lines read-only | NPE-REG-03 | ✅ |

## 3. Receive

| ID | Level | Test case | Expected result | Automated case | Status |
|---|---|---|---|---|---|
| RC-TC-01 | E2E | Receive form | Expected, Received, Damaged, Stored at, Note, photos | NPE-SMK-03 | ✅ |
| RC-TC-02 | E2E | Confirm receipt | "LD-N received as RCV-N"; read-only; history; Checked in | NPE-SMK-03 | ✅ |
| RC-TC-03 | E2E | Over delivery (second line received 2 of 1) | "Over delivery" discrepancy | NPE-SMK-04 | ✅ |
| RC-TC-04 | R | Stored at required | "<product>: choose where it is stored.", not received | NPE-REG-20 | ✅ |
| RC-TC-05 | R | Damage photo before confirming | Photo kept, receipt still possible | NPE-REG-21 | 🐞 the form turns view-only ("You can view this load but not receive it.") |
| RC-TC-06 | R | Receipt reaches TOV Submittal Invoiced Orders | "Qty Orders Received" rises by the units received (damaged included) | NPE-REG-22 | ✅ (Inventory on NRVC_Hall: "Couldn't load inventory." known issue) |

## 4. Discrepancies

| ID | Level | Test case | Expected result | Automated case | Status |
|---|---|---|---|---|---|
| DS-TC-01 | S | Open page | Filters, counter, NCR log | LD-SMK-05 | ✅ |
| DS-TC-02 | R | Kinds add up | Sum = All kinds | LD-REG-10, NPE-REG-02 | ✅ |
| DS-TC-03 | R | Open + Resolved = All; Dashboard = Open | Equal | LD-REG-11 | ✅ |
| DS-TC-04 | R | NCR log | Opens NCRs | LD-REG-12 | ✅ |
| DS-TC-05 | E2E | Receipt raises Damaged, Short delivery, Received after ROJ | 3 rows, Open | NPE-SMK-04 | ✅ |
| DS-TC-06 | E2E | Dashboard tile, chip and My Work follow | +3 | NPE-SMK-04 | ✅ |
| DS-TC-07 | R | Resolve needs a reason; resolve | Status shows "Replacement booked"; counters drop | NPE-REG-01 | ✅ |
| DS-TC-08 | R | "Received after ROJ" date | Date of the receipt in IST | NPE-REG-12 | 🐞 UTC date: a receipt between 00:00 and 05:30 IST shows the previous day (passes for receipts after 05:30 IST, e.g. 27 Nov 07:32) |
| DS-TC-09 | R | Other kinds (Wrong product, Inspection rejected, Over delivery, Unplanned arrival) | Raised from the matching event | – | ❓ how they are raised |

## 5. NCRs

| ID | Level | Test case | Expected result | Automated case | Status |
|---|---|---|---|---|---|
| NC-TC-01 | S | Open page | Filters, counter, Export, GC PMs | NCR-SMK-01 | ✅ |
| NC-TC-02 | E2E | Raise NCR from a discrepancy | NCR-N Open, quantity on hold; discrepancy shows "NCR raised" | NPE-SMK-05 | ✅ |
| NC-TC-03 | E2E | Rework → Approve (GC QA/QC) → Work done → Awaiting re-inspection | Statuses and history | NPE-SMK-06 | ✅ |
| NC-TC-04 | R | Save needs a corrective action | Disabled before | NPE-SMK-06 | ✅ |
| NC-TC-05 | R | PDF and Export to Excel | Files downloaded | NPE-REG-06 | ✅ |
| NC-TC-06 | R | Filters find the run NCR | Rework yes, Use as is no | NPE-REG-07 | ✅ |
| NC-TC-07 | R | Dashboard "Open NCRs" | +1 | NPE-SMK-06 | ✅ |
| NC-TC-08 | R | Re-inspection closes the NCR | Closed; quantity released | NPE-REG-08 | ❓ no action offered to the Project Admin |
| NC-TC-09 | R | "Use as is" path | Awaiting approval → Approve (GC QA/QC) → Record design approval → In progress → Close NCR → Closed | NPE-REG-23 | ✅ (NCR-007, NCR-010 Closed) |
| NC-TC-10 | R | "Reject and return" path | Awaiting approval → Approve (GC QA/QC) → In progress → Close NCR → Closed | NPE-REG-24 | ✅ (NCR-008, NCR-011 Closed) |
| NC-TC-11 | R | "Repair" path (on the second "Received after ROJ" discrepancy) | Awaiting approval → Approve (GC QA/QC) → Record design approval → In progress → Work done: request re-inspection → Awaiting re-inspection | NPE-REG-25 | ✅ (NCR-012 Awaiting re-inspection; closing it is Q1) |

## 6. Unallocated Deliveries

| ID | Level | Test case | Expected result | Automated case | Status |
|---|---|---|---|---|---|
| UA-TC-01 | S | Open page | Filter and text | LD-SMK-04 | ✅ |
| UA-TC-02 | R | Filters add up | All = Waiting + Allocated | LD-REG-08 | ✅ |
| UA-TC-03 | R | Dashboard "Unplanned arrivals (30 days)" | ≤ All | LD-REG-09 | ✅ |
| UA-TC-04 | E2E | Unplanned arrival → allocate | Received after allocation | NPE-REG-09 | ❓ how an unplanned arrival is created |

## 7. My Work

| ID | Level | Test case | Expected result | Automated case | Status |
|---|---|---|---|---|---|
| MW-TC-01 | S | Open page | Glance, cards, tasks | MYW-SMK-01 | ✅ |
| MW-TC-02 | R | Summary line = cards | Overdue, late and issues agree | MW-REG-01 | ✅ |
| MW-TC-03 | R | Project row = its task list | Tasks to do, Overdue, Open issues | MW-REG-02 | ✅ |
| MW-TC-04 | R | Glance search and "something to do" | Narrowed correctly | MW-REG-03 | ✅ |
| MW-TC-05 | R | Status toggles, search, due range, type, Clear | Counts follow | MW-REG-04 | ✅ |
| MW-TC-06 | R | Task link | Opens the Procurement Log line | MW-REG-05 | ✅ |
| MW-TC-07 | R | Mark done (one run task) | Done +1, open −1 | MW-REG-06 | ✅ |
| MW-TC-08 | R | Submittals section | Filters; Project filter lists the projects | MW-REG-07 | 🐞 "All my projects (0)" |
| MW-TC-09 | R | Materials section | Loads without "Could not load your work." | MW-REG-08 | ✅ (failed once on 27 Nov, intermittent) |
| MW-TC-10 | R | Loads section | Counter = rows; columns | MW-REG-09 | ✅ |
| MW-TC-11 | R | Discrepancies & NCRs section | Kinds add up; NCRs = NCR page | MW-REG-10 | ✅ |
| MW-TC-12 | R | Pre-shipping checklists | Columns; Waiting on filter; Open | MW-REG-11 | ✅ |
| MW-TC-13 | R | Supplier view | Only the supplier's project | MW-REG-12 | ✅ |

## 8. Messages

| ID | Level | Test case | Expected result | Automated case | Status |
|---|---|---|---|---|---|
| MS-TC-01 | S | Not-connected notice | Notice + Check again | MSG-SMK-01 | ✅ |
| MS-TC-02 | R | Check again | Notice stays, no error | MS-REG-02 | ✅ |
| MS-TC-03 | E2E | Send a message | Sent and listed | MS-REG-03 | ❓ Booking Integration not connected on staging |

## 9. EPD Tracker

| ID | Level | Test case | Expected result | Automated case | Status |
|---|---|---|---|---|---|
| ET-TC-01 | S | Open page | Chips, views, Settings | EPD-SMK | ✅ |
| ET-TC-02 | R | Category line counts = all lines | 703 = 703 | ET-REG-02 | ✅ |
| ET-TC-03 | R | Due-date rules; Save only after a change | As described | ET-REG-03 | ✅ |
| ET-TC-04 | R | Views agree with chips | Each status | ET-REG-04 | ✅ |
| ET-TC-05 | E2E | Tick a category → its lines become "Required (missing)"; untick restores (saves immediately) | +N / −N, restored | ET-REG-05 + ET-RESTORE | ✅ |
| ET-TC-06 | E2E | Chase a "Required (missing)" line (sends the trade an "Upload EPD" task) | Status Requested, "Last chased" today; Required (missing) −1, Requested +1 | ET-REG-06 | ✅ |
| ET-TC-07 | E2E | Line › EPDs → EPD Report of the submittal › upload a PDF | Listed under EPD Records (a blank test PDF parses as "Failed"); line Received with the file under "EPD on file"; Received +1 | ET-REG-06 | ✅ |
| ET-TC-08 | E2E | Verify, then Unverify | Verified (+1), action becomes Unverify; Unverify → back to Received | ET-REG-06 | ✅ |
| ET-TC-09 | R | Expiring / Expired | EPD with a validity date inside "Show as expiring within" → Expiring; after it → Expired | ET-REG-07 | ❓ Q8 |

_EPD records have no edit or delete (only "Parse"). Each run therefore uses a category whose line has no EPD on file yet, and leaves one EPD file named "EPD YYMMDD-HHMM.pdf" plus one chase task on that line; the category itself is always unticked again (ET-RESTORE)._

## 10. TOV Analytics

| ID | Level | Test case | Expected result | Automated case | Status |
|---|---|---|---|---|---|
| TV-TC-01 | R | Total Forecast = sum of the 3 forecasts; ≤ TCV | Equal | TV-REG-01 | ✅ |
| TV-TC-02 | R | Monthly totals and running cumulative | Last cumulative = Total Forecast | TV-REG-02 | ✅ |
| TV-TC-03 | R | Per-line split by the terms; table total = TCV; KPI ≤ column (KPIs count only dated payments) | Equal | TV-REG-03 | ✅ |
| TV-TC-04 | R | Terms must total 100 % | "Total: 110% (must equal 100%)", not saved | TV-REG-04 | ✅ |
| TV-TC-05 | R | Terms change recalculates; restore | KPIs scale with the % | TV-REG-05 + TV-RESTORE | ✅ |
| TV-TC-06 | R | Invoiced Orders: pending = placed − received | Every row | TV-REG-06 | ✅ (question: 9 rows ordered more than the component quantity) |
| TV-TC-07 | R | Outflow agrees with Invoiced Orders | Every submittal | TV-REG-07 | ✅ |
| TV-TC-08 | R | Search and date range | Rows filtered | TV-REG-08 | 🐞 search does not filter (both pages) |

## 11. Excel Import and Inventory Rebuild (NeuralRays_Demo)

| ID | Level | Test case | Expected result | Automated case | Status |
|---|---|---|---|---|---|
| XI-TC-01 | R | Upload; columns matched by name; key rule | As shown | XI-REG-01 | ✅ |
| XI-TC-02 | R | Missing required mapping | Refused or explained | XI-REG-02 | ✅ |
| XI-TC-03 | R | Submittal not in Procore | Rejected, nothing created | XI-REG-03 | ✅ |
| XI-TC-04 | E2E | Import adds detail to an existing Procore submittal; re-upload updates, no duplicate | "0 created, 1 updated" | XI-REG-04 | ✅ (❓ Bulk Upload Status does not list Excel Imports) |
| XI-TC-05 | R | Invalid quantity / date | Row rejected with a reason | XI-REG-05 | ✅ |
| IR-TC-01 | R | Page content | Description, buttons, nightly run, history | IR-REG-01 | 🐞 dates shown as MM/DD/YYYY and 12-hour time |
| IR-TC-02 | R | Dry run | New result and history row; CSV; Rebuild only when there are differences | IR-REG-02 | ✅ |

## 12. Redesigned pages (already covered)

| Module | Cases |
|---|---|
| Procurement Log views (List, By submittal, By material, Inventory tab) | PL-SMK-002…018, PL-REG-TAB-01…05, INV-SMK/INV-REG (36) |
| Management Dashboard | DSH-REG-12…17 |
| Aggregate Stats | ANV-AGG-04…11 |
| EPD Report | EPD-REG-02…05 |
| Enterprise / International Shipments | SHP-REG-12…22 |
| User Management, Supplier List | UM-REG-12/13, SL-REG-16…18 |

## 13. Defect candidates and questions from the new modules (for the dev team)

| # | Case | Finding |
|---|---|---|
| 1 | NPE-REG-05 | Build load accepts a quantity above "of N left" (Save stays enabled). Intermittent on 27 Nov morning: the retry showed Save disabled. |
| 2 | NPE-REG-12 | "Received after ROJ" shows the UTC date; a receipt after midnight IST shows the previous day. |
| 3 | MW-REG-07 | My Work › Submittals: the Project filter shows "All my projects (0)". |
| 4 | TV-REG-08 | Submittal Invoiced Orders / Outflow Projection: the search box does not filter. |
| 6 | NPE-REG-19 | Load numbers are reused after a load is deleted (LD-0008 given twice). |
| 7 | NPE-REG-21 | Adding a damage photo on the receipt form turns the form view-only; the receipt has to be redone without photos. |
| 5 | IR-REG-01 | Inventory Rebuild (and Bulk Upload Status) show dates as MM/DD/YYYY and 12-hour time. |
| Q1 | NPE-REG-08, NPE-REG-25 | Rework and Repair NCRs stop at "Awaiting re-inspection" with no action for the Project Admin (Use as is and Reject and return can be closed by the Project Admin). Who performs the re-inspection and closes them? |
| Q2 | NPE-REG-09 | How is an unplanned arrival created? |
| Q3 | DS-TC-09 | How are Wrong product, Inspection rejected and Over delivery discrepancies raised? |
| Q4 | MS-REG-03 | Will Booking Integration be connected on staging so Messages can be tested? |
| Q5 | XI-REG-04 | Should Excel Imports appear in Bulk Upload Status? |
| Q6 | TV-REG-06 | 9 PLS submittals show more quantity ordered than the component quantity (e.g. 20 > 10). Is that allowed? |
| Q7 | – | Damaged units received on the component page (Log delivery / GRN) raise no discrepancy, unlike a load receipt. Intended? |
| Q8 | ET-REG-07 | How does an EPD get an expiry date on staging? There is no expiry field on the EPD Report or the tracker, and the EPD records have only "Parse" (no edit or delete). Please share a sample EPD PDF that parses with a validity date, or another way to set it, so Expiring and Expired can be tested. |
