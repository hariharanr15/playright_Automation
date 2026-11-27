# SCP – consolidated issues, bugs, blockers and skipped cases (27 Nov 2026)

_Staging https://stg-supplychain-app.voyagecontrol.com · build of 24 Nov 2026 · latest result of every case from the 26 Nov full regression, its re-runs and the new-module suites (Loads, NCRs, My Work, TOV, EPD, Excel Import, Inventory Rebuild, Messages) up to 27 Nov 03:00 IST · 879 cases, 710 passed._

## 1. Summary

| Category | Cases | Meaning | Who acts |
|---|---|---|---|
| Bug – Known Defect | 44 | Registered application defect that still reproduces | Dev team |
| Bug – new defect candidate | 21 | Application behaviour that looks wrong; dev team to confirm | Dev team |
| Blocker / question | 8 | Test cannot complete until the environment changes or the dev team answers | Dev / platform team |
| Withdrawn after feedback | 1 | Not an issue per the 27 Nov issue justification; the test will be updated | QA |
| Answered – test update | 0 | The dev review answers the question; the test will follow the described flow | QA |
| Automation re-check | 0 | Test-side issue, already fixed; re-verified in the next run | QA |
| Skipped | 96 | Not run, with the reason and what is needed (section 4) | See owner |

**Module-wise**

| # | Module | Known Defects | New defect candidates | Blockers / questions | Skipped |
|---|---|---|---|---|---|
| 1 | Procurement Log | 7 | 0 | 0 | 2 |
| 2 | Loads, Discrepancies & NCRs | 0 | 9 | 2 | 1 |
| 3 | My Work | 0 | 1 | 0 | 0 |
| 4 | Management Dashboard | 4 | 0 | 1 | 0 |
| 5 | Alerts, Notifications & Tasks | 0 | 1 | 0 | 0 |
| 6 | First Delivery Inspections | 1 | 0 | 0 | 12 |
| 7 | Project Management | 19 | 1 | 1 | 36 |
| 8 | User Management | 4 | 0 | 0 | 5 |
| 9 | Roles & Access | 0 | 2 | 1 | 7 |
| 10 | Inventory | 0 | 0 | 0 | 23 |
| 11 | Inventory Rebuild | 0 | 1 | 0 | 0 |
| 12 | Excel Import | 0 | 1 | 1 | 0 |
| 13 | International Shipments | 1 | 3 | 0 | 3 |
| 14 | Enterprise | 0 | 0 | 0 | 4 |
| 15 | Analytics | 7 | 1 | 0 | 0 |
| 16 | TOV Analytics | 0 | 1 | 0 | 0 |
| 17 | EPD Tracker | 0 | 0 | 1 | 0 |
| 18 | Document Management | 1 | 0 | 0 | 3 |
| 19 | Messages | 0 | 0 | 1 | 0 |

**How to read an entry:** _Preconditions_ is the state to start from; _Steps_ are done in order (a step marked "(OK)" behaves correctly and only sets up the failing one); the last step is where the problem shows. _Evidence_ is the run folder under SCP/reports/pm-flow/ with report.html and screenshots.

## 2. New defect candidates, blockers and questions (index)

| Ref | Test case | Module | Type | Issue |
|---|---|---|---|---|
| N-01 | TC-14 | Procurement Log | ~~Withdrawn~~ (not an issue) | Procurement alert cannot be created – custom fields gone from Procurement Log Configuration |
| N-02 | NPE-REG-05 | Loads, Discrepancies & NCRs | Defect candidate | Build load accepts a quantity above what is left on the line |
| N-03 | NPE-REG-08 | Loads, Discrepancies & NCRs | Question | Re-inspection completed but the Rework NCR stays "Awaiting re-inspection" |
| N-04 | NPE-REG-09 | Loads, Discrepancies & NCRs | Blocker | Unallocated Deliveries: no way to create or record an unplanned arrival |
| N-05 | NPE-REG-19 | Loads, Discrepancies & NCRs | Defect candidate | A deleted load number is given to the next load |
| N-06 | NPE-REG-21 | Loads, Discrepancies & NCRs | Defect candidate | Adding a damage photo makes the receipt form view-only |
| N-07 | NPE-GAP-04 | Loads, Discrepancies & NCRs | Defect candidate | Gap 4: "Log delivery" accepts a delivery for a component that is on an open load, without a warning |
| N-08 | NPE-GAP-02 | Loads, Discrepancies & NCRs | Defect candidate | Gap 2: "Reject and return" leaves the goods in Received and adds a replacement on top of Required |
| N-09 | NPE-GAP-13 | Loads, Discrepancies & NCRs | Defect candidate | Gap 13: the component page shows a load receipt of 2 as received 3 |
| N-10 | NPE-GAP-08 | Loads, Discrepancies & NCRs | Defect candidate | Gap 8: a Subcontractor can raise an NCR on the discrepancies of a load |
| N-11 | NPE-GAP-03 | Loads, Discrepancies & NCRs | Defect candidate | Gap 3: correcting a received load delivery does not update the load or its discrepancies |
| N-12 | NPE-REG-12 | Loads, Discrepancies & NCRs | Defect candidate | "Received after ROJ" discrepancy shows the UTC date, not the project date (IST) |
| N-13 | MW-REG-07 | My Work | Defect candidate | My Work › Submittals: Project filter shows "All my projects (0)" |
| N-14 | DSH-REG-10 | Management Dashboard | Question | Daily alert batch – which alerts it creates is not defined |
| N-15 | TC-23B | Alerts, Notifications & Tasks | Defect candidate | No "First delivery of <material> received" task after the first delivery of a new material |
| N-16 | PM-REG-FDI-50 | Project Management | Question | FDI question list – API endpoint and organisation scope not confirmed |
| N-17 | PM-REG-SITE-10 | Project Management | Defect candidate | ADD LOCATION accepts a duplicate location name in the same site |
| N-18 | PM-REG-ROLE-08 | Roles & Access | Defect candidate | Supplier menu shows Project Management although the role does not enable it |
| N-19 | PM-REG-ROLE-05 | Roles & Access | Defect candidate | Supplier / Subcontractor without Project Management access can open Material Master by URL |
| N-20 | PM-REG-ROLE-09 | Roles & Access | Question | Menu vs permission keys – session permission list not available to the tests |
| N-21 | IR-REG-01 | Inventory Rebuild | Defect candidate | Inventory Rebuild shows dates as MM/DD/YYYY with 12-hour time |
| N-22 | XI-REG-04 | Excel Import | Question | Excel Import is not listed in Bulk Upload Status |
| N-23 | XI-GAP-05 | Excel Import | Defect candidate | Gap 5: Excel import accepts quantity 0 and a negative lead time |
| N-24 | SHP-REG-18 | International Shipments | Defect candidate | "N at risk" counter ignores the Destination filter |
| N-25 | SHP-REG-20 | International Shipments | Defect candidate | Active Delay Alerts: 272 cards but only 2 distinct alerts |
| N-26 | SHP-REG-15 | International Shipments | Defect candidate | Delay Alerts: every affected shipment lists the same alert 136 times |
| N-27 | ANV-AGG-10 | Analytics | Defect candidate | Aggregate Stats values in $ on an INR project |
| N-28 | TV-REG-08 | TOV Analytics | Defect candidate | TOV Invoiced Orders / Outflow Projection: search does not filter |
| N-29 | ET-REG-07 | EPD Tracker | Question | EPD Tracker: no way to give an EPD an expiry date, so Expiring / Expired cannot be tested |
| N-30 | MS-REG-03 | Messages | Blocker | Messages cannot be tested – Delivery Management / Booking Integration not connected on staging |

## 3. Details by module

### 3.1 Procurement Log

#### K-01 · PL-REG-ALR-02 – Create Alert validates required fields

**Type:** Known Defect · **Registered as:** SCP-DEF-068 · **Evidence:** pl-regression3-2026-11-26T10-33-55-745Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. A submittal with one component created earlier in the same run (names PLT<YYMMDDHHMM>).

**Steps to reproduce:**

1. Search PLT2611261033-SUB-P, row menu › "Alert", "Add Alert", click "Submit" empty

**Expected:** no "Failed to create alert" message (client-side validation, OBS-PL-28)

**Actual:** Row menu › Alert › Add Alert › Submit with empty fields shows the server message "Failed to create alert. Please try again." instead of required-field messages (OBS-PL-28). Failed in every Procurement Log part 3 run (17–21 Nov 2026).

**Test message:** Client-side required messages instead of a server failure (OBS-PL-28)

**Status:** registered, pending dev-team confirmation.

#### K-02 · PL-REG-CMP-08 – Update Status to Delivered shows on component and submittal (PL-R13)

**Type:** Known Defect · **Registered as:** SCP-DEF-046 · **Evidence:** pl-regression-2026-11-26T10-27-44-938Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. A submittal with one component created earlier in the same run (Procurement Log › Add submittal; names PLT/PLR<YYMMDDHHMM>).

**Steps to reproduce:**

1. Component row "⋯" › "Update status": choose status "Delivered", note PLR2611261027 status, click "ADD"

**Expected:** component Status becomes "Delivered"

**Actual:** Component Other Actions > Update Status > Delivered returns 200 "SubmittalSchedule updated successfully" but the status stays Ordered and the UI shows no message (PLD1102-SUB-01, NRVC_Hall, 2 Nov 2026). Product owner: Delivered must show on both the submittal and the component page (PL-R13). Discovery OBS-PL-16.

**Test message:** Update Status to Delivered did not change the component status (shows "Ordered")

**Feedback 27 Nov:** Business Logic and Flow Changes (dev review 12→23 Nov), row 12 (BUGS-597): an explicit status is now kept as chosen – "Delivered" no longer comes back as "Ordered". Still reproduced on staging on 26 Nov: please confirm the fix is deployed; re-test after deploy.

#### K-03 · PL-REG-CMP-09 – Update Status to Ordered At Risk

**Type:** Known Defect · **Registered as:** SCP-DEF-065 · **Evidence:** pl-regression3-2026-11-26T10-33-55-745Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. A submittal with one component created earlier in the same run (names PLT<YYMMDDHHMM>).

**Steps to reproduce:**

1. Component row "⋯" › "Update status": status "Ordered At Risk", comment "PLT2611261033 at risk", "ADD"; reopen submittal

**Expected:** component status is "Ordered At Risk"

**Actual:** Component › Other Actions › Update Status "Ordered At Risk" with a comment, ADD: after reopening the submittal the component status is still "Ordered". Failed in every Procurement Log part 3 run (17–21 Nov 2026). Question: may an Ordered component move to Ordered At Risk?

**Test message:** Update Status to Ordered At Risk left the status at Ordered at risk

**Status:** registered, pending dev-team confirmation.

**Feedback 27 Nov:** Business Logic and Flow Changes (dev review 12→23 Nov), row 12 (BUGS-597): same fix as SCP-DEF-046 – re-test after deploy.

#### K-04 · PL-REG-CMP-18 – Delete component

**Type:** Known Defect · **Registered as:** SCP-DEF-072 · **Evidence:** pl-regression2-2026-11-26T08-53-16-883Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. A submittal with one component created earlier in the same run (names PLR<YYMMDDHHMM>).

**Steps to reproduce:**

1. Back to the submittal, component row "⋯" › "Delete component…", confirm "Delete"

**Expected:** no component rows remain

**Actual:** Submittal page › component row "Other Actions ▾" › Delete › confirm "Delete": no message is shown and the component row is still listed after a reload (component with lead time Confirmed, not ordered). Failed in 4 of the last 5 Procurement Log part 2 runs (17–21 Nov 2026), passed on 18 Nov. Question: may a component with a confirmed lead time be deleted? If not, should a message say so?

**Test message:** Message after Delete: 1 component not ordered

**Status:** registered, pending dev-team confirmation.

**Feedback 27 Nov:** Business Logic and Flow Changes (dev review 12→23 Nov), row 11: deleting a component is now blocked once it has a PO number. The run component has no PO, so delete should still work; a block should show a message.

#### K-05 · PL-REG-DLV-19 – Required Remaining Qty subtracts logged deliveries (PL-R15)

**Type:** Known Defect · **Registered as:** SCP-DEF-060 · **Evidence:** pl-regression3-2026-11-26T10-33-55-745Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. A submittal with one component created earlier in the same run (names PLT<YYMMDDHHMM>).

**Steps to reproduce:**

1. Click "Log delivery", read "Required Remaining Qty", close

**Expected:** value starts with 8 (12 ordered − 4 logged)

**Actual:** "+ Log Delivery" shows Required Remaining Qty "12 Pieces" after 4 of 12 were logged; confirmed rule PL-R15 expects 8. Failed in every Procurement Log part 3 run (14/14 up to 21 Nov 2026), NRVC_Hall.

**Test message:** Required Remaining Qty: 12 Pieces

**Feedback 27 Nov:** Business Logic and Flow Changes (dev review 12→23 Nov), row 22 (BUGS-600): the GRN shortage formula changed to this delivery's quantity × conversion − good − damaged; please confirm whether "Required Remaining Qty" follows it.

#### K-06 · PL-REG-IMP-09 – Export has the grid columns

**Type:** Known Defect · **Registered as:** SCP-DEF-047 · **Evidence:** pl-regression3-2026-11-26T10-33-55-745Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. A submittal with one component created earlier in the same run (names PLT<YYMMDDHHMM>).

**Steps to reproduce:**

1. Reload, search PLT2611261033, click "Export" and open the xlsx

**Expected:** every grid column header is present in the export

**Actual:** Procurement Log Export (Submittal_Report_<date>.xlsx) has 47 Procore-style columns instead of the grid columns: custom fields missing, "Supplier" empty while "Supplier Name" is filled, literal "None", raw status values and unformatted dates (NRVC_Hall, 2 Nov 2026). Product owner: export must match the grid incl. custom fields (PL-R9). Discovery OBS-PL-9.

**Test message:** Missing in export: Schedule Id, EPD Status, Source, Total Count 1386, Total Count 1574, Total Count 15, Total Count 87, Responsible

#### K-07 · T517-15 – Bulk Edit Roll Back restores lead times

**Type:** Known Defect · **Registered as:** SCP-DEF-075 · **Evidence:** tickets-2026-11-26T08-16-24-782Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. Data created by the ticket suite (names TKT<YYMMDDHHMM>).

**Steps to reproduce:**

1. Review banner of the T517-13 batch › "Roll Back" → banner gone (OK)
2. A and B are back on Supplier SLD2611021715; B's lead time is 2 weeks and Confirmed again

**Actual:** Bulk Edit of Supplier Name on a submittal whose component lead time was Confirmed (2 weeks), "Confirm & Apply", then "Roll Back" in the review banner: the supplier and the 2-week lead time come back, but Lead Time Confirmed stays False (it was True before the batch). BUGS-517 expects Roll Back to restore supplier, lead times and Confirmed flags (T517-15). First automated run 22 Nov 2026 (Bulk Update #79).

**Test message:** B: lead time 2 week(s), confirmed false

**Status:** registered, pending dev-team confirmation.

#### N-01 · TC-14 – Procurement alert cannot be created – custom fields gone from Procurement Log Configuration

**Type:** Withdrawn · **Evidence:** e2e-smoke-2026-11-26T13-09-12-885Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. A submittal of the run in the Procurement Log.

**Steps to reproduce:**

1. Project Management › Procurement Log Configuration → note the field list.
2. Procurement Log › any submittal row › "⋮" › Alert › Add Alert.
3. Open the Field (Field Type) dropdown.

**Expected:** Numeric custom fields (e.g. "Total Count") are offered; Field ">=" 100 + message + recipient › Submit → toast "Alert created successfully!".

**Actual:** Since 26 Nov only the 43 standard fields remain in Procurement Log Configuration; the Field dropdown shows "No options available", so no alert can be created (Submit never becomes possible).

**Feedback 27 Nov:** Issue justification (27 Nov): not an issue – a custom field can be created with Project Management › Procurement Log Configuration › "+ Add Log Fields" (Field Name, Field Type) and then used in a new alert. The custom fields used by the test were removed from NRVC_Hall; the test will create its own numeric custom field (one per run, named with date and time) and build the alert on it.

### 3.2 Loads, Discrepancies & NCRs

#### N-08 · NPE-GAP-02 – Gap 2: "Reject and return" leaves the goods in Received and adds a replacement on top of Required

**Type:** Defect candidate · **Evidence:** np-e2e-2026-11-27T13-19-07-057Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. A received load of PLT2611130841-SUB-P with a "Received after ROJ" discrepancy of 2 pieces.

**Steps to reproduce:**

1. Procurement Log › PLT2611130841-SUB-P › note "Pieces required", Received and the component list.
2. Loads › Discrepancies › "Received after ROJ" of the load › Raise NCR › corrective action "Reject and return" › Save › Approve (GC QA/QC) › Close NCR → Closed (NCR-020).
3. Procurement Log › PLT2611130841-SUB-P › read the figures again.

**Expected:** Received goes down by the 2 returned pieces (16 → 14). "Pieces required" stays 20,020: a replacement line, if any, replaces the returned quantity.

**Actual:** Received stays 16. "Pieces required" goes from 20,020 to 20,022 and a new "43 Inches 2 Pieces" component is added (5 → 6 components) (27 Nov, 15:5x IST).

#### N-11 · NPE-GAP-03 – Gap 3: correcting a received load delivery does not update the load or its discrepancies

**Type:** Defect candidate · **Evidence:** np-e2e-2026-11-27T13-19-07-057Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. A received load (LD-0017, receipt RCV-000322: Received 2, Damaged 1 of 3) with its discrepancies (Short delivery, Damaged, Over delivery, Received after ROJ).

**Steps to reproduce:**

1. Loads › LD-0017 › note the receipt; Loads › Discrepancies › search LD-0017 › note the rows.
2. Procurement Log › PLT2611130841-SUB-P › component 43 Inches (20,000 Pieces) › Open component.
3. Received table › RCV-000322 › Delivery actions (⋯) › "Correct delivery".
4. "Edit Delivery": Item Name 43 Inches, QTY 3 → 4, Note (required) › Update.
5. Dialog "Save the correction?" › Save.
6. Open LD-0017 and its discrepancies again.

**Expected:** The load receipt and its discrepancies follow the correction (one more piece received: the Short delivery discrepancy shrinks or closes), or the correction is refused for a load receipt.

**Actual:** The dialog warns only "A First Delivery Inspection exists for this delivery; editing the delivery doesn’t change it." After Save the component row shows 4 / 2 / 1 (was 3 / 1 / 1), but LD-0017 and all its discrepancies are unchanged (still "2 received of 3 on the load") (27 Nov, 16:3x IST).

#### N-07 · NPE-GAP-04 – Gap 4: "Log delivery" accepts a delivery for a component that is on an open load, without a warning

**Type:** Defect candidate · **Evidence:** np-e2e-2026-11-27T13-19-07-057Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. A load in "Expected" with 3 pieces of PLT2611130841-SUB-P (component 43 Inches, 20,000 pieces).

**Steps to reproduce:**

1. Procurement Log › search PLT2611130841-SUB-P › open the submittal.
2. Component 43 Inches (20,000 Pieces) › More actions › Open component → "On a load" shows the load's pieces.
3. "Log delivery" › date today, first location, Item Name 43 Inches, QTY 1 › Add.

**Expected:** The delivery is refused, or a warning says the component is already on open load LD-N.

**Actual:** The dialog closes without a message and a new expected delivery "today · 1 · Not on a load" is added (LD-0014 and LD-0015, 27 Nov). It also lowers "To load" of the line by 1. The test deletes the delivery again.

#### N-10 · NPE-GAP-08 – Gap 8: a Subcontractor can raise an NCR on the discrepancies of a load

**Type:** Defect candidate · **Evidence:** np-e2e-2026-11-27T13-19-07-057Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. A received load with open "Short delivery" and "Damaged" discrepancies (LD-0017). The Subcontractor test account (SCP_SUBCONTRACTOR_*).

**Steps to reproduce:**

1. Log out; sign in as the Subcontractor › Supply Chain Planner › NRVC_Hall.
2. Loads › Discrepancies › status All › search LD-0017.
3. Open the "Short delivery" row, then the "Damaged" row; look at the buttons (nothing clicked).

**Expected:** Only the general contractor can resolve a discrepancy or raise an NCR: the Subcontractor sees the rows read-only.

**Actual:** The Subcontractor sees all 5 discrepancies of LD-0017 and "Raise NCR" is enabled on both the Short delivery and the Damaged row ("Resolve" is not enabled) (27 Nov, 16:0x IST). Nothing was clicked.

#### N-09 · NPE-GAP-13 – Gap 13: the component page shows a load receipt of 2 as received 3

**Type:** Defect candidate · **Evidence:** np-e2e-2026-11-27T13-19-07-057Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. A load of 3 pieces of PLT2611130841-SUB-P, received with Received 2 and Damaged 1 (RCV-N).

**Steps to reproduce:**

1. Procurement Log › PLT2611130841-SUB-P › component 43 Inches (20,000 Pieces) › Open component.
2. Received table › row RCV-N › read RECEIVED QTY, GOOD, DAMAGED.
3. Delivery actions (⋯) › "Correct delivery" → read the "Edit Delivery" form; close it.

**Expected:** RECEIVED QTY 2, GOOD 1, DAMAGED 1 – the same as the load receipt.

**Actual:** RECEIVED QTY 3, GOOD 1, DAMAGED 1 (RCV-000321; every load receipt since 26 Nov shows 3 / 1 / 1). The "Edit Delivery" form of the receipt shows QTY 3 and Required Remaining Qty 3, and Item Name is empty ("Choose Item Name"). "Generate GRN" and "View delivery details" are offered.

#### N-02 · NPE-REG-05 – Build load accepts a quantity above what is left on the line

**Type:** Defect candidate · **Evidence:** np-e2e-2026-11-27T13-19-07-057Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. An open product line, e.g. PLT2611130841-SUB-P (20,000 pieces).

**Steps to reproduce:**

1. Loads › Build load (https://stg-supplychain-app.voyagecontrol.com/loads/new).
2. Open product lines › PLT2611130841-SUB-P shows "of 19996 left" › Add.
3. In "This load" type quantity 20001 (above what is left).
4. Look at the quantity field and the "Save load" button.

**Expected:** The quantity is refused or capped at 19996 and "Save load" stays disabled.

**Actual:** The field keeps 20001 and "Save load" is enabled (the test left without saving).

**Feedback 27 Nov:** Business Logic and Flow Changes (dev review 12→23 Nov), §2 and row 15: load lines are checked against the outstanding quantity (required − received − on other open loads − deliveries not yet arrived). This confirms the expected result.

#### N-12 · NPE-REG-12 – "Received after ROJ" discrepancy shows the UTC date, not the project date (IST)

**Type:** Defect candidate · **Evidence:** np-e2e-2026-11-27T13-19-07-057Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. A load in "Expected" whose line has a ROJ date before today.

**Steps to reproduce:**

1. Between 00:00 and 05:30 IST: Loads › the load › Receive › fill Received / Stored at › Confirm receipt → "LD-N received as RCV-N".
2. Loads › Discrepancies (https://stg-supplychain-app.voyagecontrol.com/discrepancies) › row "Received after ROJ" of that load.

**Expected:** "received 27 Nov 2026" – the IST date of the receipt.

**Actual:** "received 26 Nov 2026" – the UTC date (receipt at 02:58 IST on 27 Nov). Time-dependent: shows only for receipts between 00:00 and 05:30 IST (UTC date still the previous day). Reproduced on 27 Nov 02:58 IST (run np-e2e-2026-11-26T21-26-20-554Z); the 07:24 IST run passed because both dates were the same.

**Feedback 27 Nov:** Business Logic and Flow Changes (dev review 12→23 Nov): not covered by the review.

#### N-05 · NPE-REG-19 – A deleted load number is given to the next load

**Type:** Defect candidate · **Evidence:** np-e2e-2026-11-27T13-19-07-057Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header.

**Steps to reproduce:**

1. Loads › Build load › add 1 piece of any open line › Site › Save load → e.g. "LD-0008" (Pending).
2. Open LD-0008 › Delete › accept "Delete LD-0008?".
3. Build another load and save it.

**Expected:** The new load gets the next unused number (LD-0009); a deleted number is never reused.

**Actual:** The new load is numbered LD-0008 again (26 Nov, 21:03 run).

#### N-06 · NPE-REG-21 – Adding a damage photo makes the receipt form view-only

**Type:** Defect candidate · **Evidence:** np-e2e-2026-11-27T13-19-07-057Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. A load in "Expected".

**Steps to reproduce:**

1. Loads › the load › Receive.
2. Fill Received 2, Damaged 1, Stored at (any location), Note.
3. On the damaged line click "+ Damage photo" and choose an image (PNG/JPG).

**Expected:** The photo is attached, the form stays editable, Confirm receipt saves the receipt and the photo is shown on it.

**Actual:** Right after the photo is added the page shows "You can view this load but not receive it." and the form turns view-only; the receipt can only be confirmed without the photo (0 photos on the receipt).

#### N-03 · NPE-REG-08 – Re-inspection completed but the Rework NCR stays "Awaiting re-inspection"

**Type:** Question · **Evidence:** np-e2e-2026-11-27T13-19-07-057Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. A received load with a "Damaged" discrepancy.

**Steps to reproduce:**

1. Loads › Discrepancies › the Damaged row › Raise NCR.
2. Corrective action "Rework" + Note › Save → Awaiting approval; Approve (GC QA/QC) → In progress.
3. First Delivery Inspections (untick "Group by material category") › search the product submittal → note the number of inspections dated today.
4. NCR › "Work done: request re-inspection" → Awaiting re-inspection.
5. First Delivery Inspections › same search → one more inspection dated today ("Auditor Not Yet Assigned") (OK).
6. That inspection › Self Assign › Fill Inspection Report › answers Pass, a photo, outcome "Yes" / "Accepted" › Submit Inspection → "inspection completed" (OK).
7. Open the NCR again.

**Expected:** The NCR is Closed and the quantity on hold is released.

**Actual:** NCR-014 stays "Awaiting re-inspection · 1 Pieces on hold" (27 Nov 12:36 IST). The inspection list does not show which NCR an inspection belongs to.

**Question to the dev team:** How is the re-inspection linked to the NCR, and what closes a Rework / Repair NCR?

#### N-04 · NPE-REG-09 – Unallocated Deliveries: no way to create or record an unplanned arrival

**Type:** Blocker · **Evidence:** np-e2e-2026-11-27T13-19-07-057Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header.

**Steps to reproduce:**

1. Loads › Unallocated Deliveries (https://stg-supplychain-app.voyagecontrol.com/unallocated-deliveries).
2. Check the tabs Waiting to be allocated / Allocated / All and the page buttons.

**Expected:** A way to record or receive an unplanned arrival, then allocate it to its component.

**Actual:** No buttons; the lists are empty ("Goods that arrived without a load and couldn't be matched at receipt…").

**Question to the dev team:** How is an unplanned arrival created (gate check-in / Delivery Management)?

**Feedback 27 Nov:** Business Logic and Flow Changes (dev review 12→23 Nov), §2 and row 35: unplanned arrivals come only from Delivery Management (gate check-in / DM flex form). Delivery Management is not connected on staging (same cause as Messages, MS-REG-03), so they cannot be created there.

### 3.3 My Work

#### N-13 · MW-REG-07 – My Work › Submittals: Project filter shows "All my projects (0)"

**Type:** Defect candidate · **Evidence:** my-work-2026-11-26T19-30-58-391Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header.

**Steps to reproduce:**

1. My Work › Submittals card.
2. Open the Project filter.

**Expected:** The filter lists the user's projects (NRVC_Hall and the others shown in "Projects at a glance").

**Actual:** The filter shows "All my projects (0)" although submittal rows of NRVC_Hall are listed.

### 3.4 Management Dashboard

#### K-08 · DSH-REG-09 – Trigger Alert reaches the user (PL-R14, OBS-DSH-1)

**Type:** Known Defect · **Registered as:** SCP-DEF-070 · **Evidence:** app-regression-2026-11-26T07-18-20-708Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header.

**Steps to reproduce:**

1. Management Dashboard › "Notifications" tab: look on the first page; if absent set the read filter to "All" and search "Delivery for Item"

**Expected:** matching Trigger Alert reaches the user (PL-R14, OBS-DSH-1) entry is listed

**Actual:** The "Delivery for Item …" trigger alert set up by the run is not listed in Management Dashboard › Notifications, neither on the first page nor with filter All + search (PL-R14, OBS-DSH-1). Failed in every All Modules regression run (17–21 Nov 2026). Question: is the alert delivered as a notification, and when?

**Test message:** Not found (filter "All" + search "Delivery for Item")

**Status:** registered, pending dev-team confirmation.

#### K-09 · TC-23 – Previous vs current KPI values

**Type:** Known Defect · **Registered as:** SCP-DEF-049 · **Evidence:** e2e-smoke-2026-11-26T13-09-12-885Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. The own E2E run submittal, material, bookings and deliveries (TC-01…TC-13 of the same run, names E2E<YYMMDDHHMM>).

**Steps to reproduce:**

1. Management Dashboard (same project, same filters as the baseline) → current values captured (OK)
2. Submittal count → +1 (one submittal, however many components) (OK)
3. Submittals by status → counts add up to the total; "Delivered" +1; open submittals unchanged (OK)
4. Material categories in scope → +1 (the new category, the primary material's, now has a submittal) (OK)
5. Delivery count → deliveries with an actual date +2 and on-time deliveries +2 (one per component) (OK)
6. Materials row of the new category (primary material) → row appears with submittals 1, open 0 (OK)
7. Procurement value of the new category

**Expected:** Spend rises by the submittal's total Procurement Log "Value Delivered" (₹1,000.00 + ₹500.00), in the same currency

**Actual:** The Materials table "Spend" of a category rises by the sum of QTY × component Value and is shown in $, while the Procurement Log shows the component Value as the total in ₹ ("Value Delivered" ₹1,000.00 for QTY 10, Value 1000). E2E2611111224-SUB (10 × ₹1,000 and 5 × ₹500 components) raised the spend of its category by $12,500 against ₹1,500 delivered (NRVC_Hall, 11 Nov 2026).

**Test message:** Dashboard change 1500 $; Procurement Log 1500 ₹

**Feedback 27 Nov:** Business Logic and Flow Changes (dev review 12→23 Nov), row 38 (BUGS-596): Dashboard spend is now received quantity × (price ÷ ordered quantity). The expected value of TC-23 / TC-24 will be recalculated with this formula; the $ vs ₹ part stays.

#### K-10 · TC-24 – Analytics after the flow (every page, compared with TC-02B) and reference data / configuration

**Type:** Known Defect · **Registered as:** SCP-DEF-049 · **Evidence:** e2e-smoke-2026-11-26T13-09-12-885Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. The own E2E run submittal, material, bookings and deliveries (TC-01…TC-13 of the same run, names E2E<YYMMDDHHMM>).

**Steps to reproduce:**

1. Configuration Options → every setting unchanged since the baseline (TC-02B) (OK)
2. Project Management › Configuration Options → configured "Currency Type" captured (OK)
3. Reference Data › Common Utilities → the configured currency is a "currency_type" utility (OK)
4. Reference Data › Common UoM → the materials' units (Board Feet, Pieces) are listed (OK)
5. Procurement Log "Value Delivered" of the run components → in the configured currency (OK)
6. Analytics › Status Report › "Generate" → row for submittal 3 20261126: material Material 3 20261126, supplier Supplier 3 20261126, 15 units across its quantity columns (both components) (OK)
7. Status Report → the 15 delivered units are under "QTY Delivered On Time" (OK)
8. Analytics › Lead Time Analysis → category "Material Category 3 20261126" (primary material) is listed (OK)
9. Analytics › Aggregate Stats (after the flow) → same project, location and filters as the baseline; every sub-tab visited; scrolled with screenshots; values captured (OK)
10. Analytics › Lead Time Analysis (after the flow) → same project, location and filters as the baseline; every sub-tab visited; scrolled with screenshots; values captured (OK)
11. Analytics › Supply Chain Intelligence (after the flow) → same project, location and filters as the baseline; every sub-tab visited; scrolled with screenshots; values captured (OK)
12. Analytics › Emissions Report (after the flow) → same project, location and filters as the baseline; every sub-tab visited; scrolled with screenshots; values captured (OK)
13. Analytics › Inventory Reports (after the flow) → same project, location and filters as the baseline; every sub-tab visited; scrolled with screenshots; values captured (OK)
14. Analytics › Status Report (after the flow) → same project, location and filters as the baseline; every sub-tab visited; scrolled with screenshots; values captured (OK)
15. Analytics › SubContractor Issues (after the flow) → same project, location and filters as the baseline; every sub-tab visited; scrolled with screenshots; values captured (OK)
16. Analytics › Supplier Issues (after the flow) → same project, location and filters as the baseline; every sub-tab visited; scrolled with screenshots; values captured (OK)
17. Analytics › TOV Analytics (after the flow) → same project, location and filters as the baseline; every sub-tab visited; scrolled with screenshots; values captured (OK)
18. Analytics before vs after → every page compared; differences listed and highlighted in the report (OK)
19. Management Dashboard spend of "Material Category 3 20261126"

**Expected:** shown in the configured currency (₹)

**Actual:** The Materials table "Spend" of a category rises by the sum of QTY × component Value and is shown in $, while the Procurement Log shows the component Value as the total in ₹ ("Value Delivered" ₹1,000.00 for QTY 10, Value 1000). E2E2611111224-SUB (10 × ₹1,000 and 5 × ₹500 components) raised the spend of its category by $12,500 against ₹1,500 delivered (NRVC_Hall, 11 Nov 2026).

**Test message:** Dashboard spend "$1,500" (currency $); configured INR - Indian Rupees

**Feedback 27 Nov:** Business Logic and Flow Changes (dev review 12→23 Nov), row 38 (BUGS-596): Dashboard spend is now received quantity × (price ÷ ordered quantity). The expected value of TC-23 / TC-24 will be recalculated with this formula; the $ vs ₹ part stays.

#### K-11 · TC-25 – Detailed execution report generated

**Type:** Known Defect · **Registered as:** SCP-DEF-058 · **Evidence:** e2e-smoke-2026-11-26T13-09-12-885Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. The own E2E run submittal, material, bookings and deliveries (TC-01…TC-13 of the same run, names E2E<YYMMDDHHMM>).

**Steps to reproduce:**

1. Final validation → category, material, supplier, subcontractor, user, FDI set, one submittal with two materials, components, bookings, GRNs, FDI inspection recorded (OK)
2. Project and location selected once per login (4 selection(s) for 4 login(s))
3. Location reuse in the Procurement Log → location verified before each action; dropdown opened only when the app had cleared/changed it; no FAIL (OK)
4. Location never cleared/changed by the application after selection (0 re-selections needed)

**Actual:** After choosing another site in the header and reloading, the header shows a different site (chose Site T2 Pmr2-2611011614, after reload Site T2 Pmr2-2611201108). Site isolation of locations itself works. OBS-INV-12.

**Test message:** Procurement Log listing: header showed "Site T2 Pmr2-2611261430" · First Delivery Inspections list: header showed "Site T2 Pmr2-2611261430"

**Status:** registered, pending dev-team confirmation.

#### N-14 · DSH-REG-10 – Daily alert batch – which alerts it creates is not defined

**Type:** Question · **Evidence:** app-regression-2026-11-27T07-04-25-704Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header.

**Steps to reproduce:**

1. Next morning after 05:00–06:00 IST: Management Dashboard › Alerts.

**Expected:** The alerts the daily batch is meant to create are listed.

**Actual:** Not testable: no defined list of alerts the batch creates (runs and fails with the question since 27 Nov).

**Question to the dev team:** Which alerts does the 05:00–06:00 IST batch create, and for which conditions?

### 3.5 Alerts, Notifications & Tasks

#### N-15 · TC-23B – No "First delivery of <material> received" task after the first delivery of a new material

**Type:** Defect candidate · **Evidence:** e2e-smoke-2026-11-26T13-09-12-885Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. A submittal with a material that has never been delivered on the project.

**Steps to reproduce:**

1. Procurement Log › the submittal › record the first delivery (GRN) of the new material, e.g. 10 units.
2. Alerts → "Delivery of 10 units of <material> logged for submittal <submittal>" is shown (OK).
3. Notifications → "Delivery of 10 units of <material> has been received at site…" is shown (OK).
4. Open Tasks (Management Dashboard › Tasks, and My Work › Tasks) and look for the material.

**Expected:** A task "First delivery of <material> received … submittal <submittal>", dated today, with a status.

**Actual:** No such task (0 matches), two runs in a row (26 Nov: submittal 3 20261126 / Material 3 20261126). Alerts and notifications are created.

**Question to the dev team:** Is the first-delivery task still created, and where should it appear (Tasks or My Work)?

**Feedback 27 Nov:** Business Logic and Flow Changes (dev review 12→23 Nov), row 24 / gap 10: an FDI is now raised for every received LOAD line (and each NCR re-inspection) instead of the first delivery of a material; the notification text still says "First delivery". Please confirm whether the "First delivery" task is still created for a delivery logged on the old delivery screen.

### 3.6 First Delivery Inspections

#### K-12 · T543-12 – Category API without project_id returns only this project

**Type:** Known Defect · **Registered as:** SCP-DEF-062 · **Evidence:** tickets-2026-11-26T08-16-24-782Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. Data created by the ticket suite (names TKT<YYMMDDHHMM>).

**Steps to reproduce:**

1. GET /api/project_material_category/

**Actual:** GET /api/project_material_category/ without project_id returns 757 categories from 15 projects instead of only the current project (BUGS-543 ticket suite, 20 Nov 2026). Possible cross-project data exposure; to be assessed by the team.

**Test message:** 942 categories from 15 project(s)

### 3.7 Project Management

#### N-17 · PM-REG-SITE-10 – ADD LOCATION accepts a duplicate location name in the same site

**Type:** Defect candidate · **Area:** Site Details · **Evidence:** regression2-2026-11-26T08-59-57-300Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header.

**Steps to reproduce:**

1. Project Management › Site Details.
2. On a site card (e.g. "Gate PMR2-2611261430") › ADD LOCATION › name "Loc A", type Building › Add → location saved (2 locations).
3. ADD LOCATION again with the same name "Loc A", Building › Add.

**Expected:** Refused with a "name already exists" message; the location count stays 2.

**Actual:** The form closes without any message and the duplicate is saved (3 locations). On 20 Nov the duplicate was refused.

#### K-13 · PM-REG-BUS-05 – Status matches outcome

**Type:** Known Defect · **Area:** Bulk Upload Status · **Registered as:** SCP-DEF-001 · **Evidence:** regression-2026-11-26T08-34-30-230Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. Project Management run data created earlier in the suite (names PMR<YYMMDDHHMM>).

**Steps to reproduce:**

1. Bulk Upload Status: compare Status with the success/failure file columns

**Expected:** no Success without a success file, no Failed without a failure file, no row without a status

**Actual:** Bulk Upload Status shows no status for fully failed uploads (failure file only); they must show "Failed". NRVC_Hall: 4 Materials uploads on 26/10/2026 (material_bulk_upload_template (1).xlsx). Partial successes without a status are expected (agreed 27 Oct, scope narrowed 30 Oct 2026).

**Test message:** Application defect: 3 upload record(s) have no status (failure file only: 26/11/2026 upl-site-06-PMR2-2611260322.xlsx; 26/11/2026 upl-site-05-PMR2-2611260322.xlsx; 26/11/2026 upl-site-03-PMR2-2611260322.xlsx)

#### K-14 · PM-REG-BUS-08 – Every upload screen is tracked

**Type:** Known Defect · **Area:** Bulk Upload Status · **Registered as:** SCP-DEF-038 · **Evidence:** regression2-2026-11-26T08-59-57-300Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. Project Management run data created earlier in the suite (names PMR2-<YYMMDDHHMM>).

**Steps to reproduce:**

1. Sidebar › Project Management › "Bulk Upload Status" → page opens (OK)
2. Uploads table → UPL-MM-03 row: dated today, uploader = signed-in account, type "Materials", Status "Success" and a success report link (OK)
3. Uploads table

**Expected:** UPL-SITE-02 row: dated today, uploader = signed-in account, type "Sites", Status "Success" and a success report link

**Actual:** Bulk Upload Status lists every Site Details upload with status "-", also when it fully succeeded (success report only) or partly succeeded; Material uploads show Success / Failed / Partly successful (NRVC_Hall, 31 Oct 2026). Scenario PM-REG-BUS-08.

**Test message:** 26/11/2026 / h***@neuralrays.ai / Sites / - / upl-site-02-PMR2-2611261430.xlsx / U***@neuralrays.ai.xlsx / -

#### K-15 · PM-REG-CFG-03 – Cancel discards changes

**Type:** Known Defect · **Area:** Configuration Options · **Registered as:** SCP-DEF-026 · **Evidence:** regression-2026-11-26T08-34-30-230Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. Project Management run data created earlier in the suite (names PMR<YYMMDDHHMM>).

**Steps to reproduce:**

1. Configuration Options: add 1 to the first week field and click the "GRN" toggle if present (no Save) → values changed on screen (OK)
2. Configuration Options: click "Cancel"

**Expected:** first week field returns to the saved value

**Actual:** Configuration Options > Cancel sets the three week fields to 0 on screen (also without any edit) instead of restoring the saved values 1/1/1; nothing is saved and a reload shows the saved values (scenario PM-REG-CFG-03, discovery DEF-C7).

**Test message:** Cancel shows week values 0/0/0 instead of the saved 1/1/1 (after reload: 1/1/1, nothing saved) – DEF-C7

#### K-16 · PM-REG-CFG-06 – Week field – non-numeric and negative

**Type:** Known Defect · **Area:** Configuration Options · **Registered as:** SCP-DEF-030 · **Evidence:** regression2-2026-11-26T08-59-57-300Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. Project Management run data created earlier in the suite (names PMR2-<YYMMDDHHMM>).

**Steps to reproduce:**

1. First week field: enter "abc", click "Save", reload → value is not saved, original weeks remain (OK)
2. First week field: enter "-1", click "Save", reload

**Expected:** value is not saved, original weeks remain

**Actual:** Configuration Options > a week field set to -1 > Save shows "Project configuration updated successfully" and -1 is kept after reload (NRVC_Hall, restored to 1 afterwards). Product owner: any value except a negative value is accepted (R69). Scenario PM-REG-CFG-06.

**Test message:** field shows "-1"; message: (none)

#### K-17 · PM-REG-CFG-13 – Not-ordered alert raised by the daily batch (1 week)

**Type:** Known Defect · **Area:** Configuration Options · **Registered as:** SCP-DEF-086 · **Evidence:** cfg-live-2026-11-26T11-07-35-076Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. Configuration Options › alert threshold 1 week. A submittal created the day before whose Date Required on Site is within one week (one not ordered, one ordered with lead time not confirmed).

**Steps to reproduce:**

1. Management Dashboard › Alerts (after the 24/11/2026 batch)

**Expected:** seed CFL2611240429-SUB-N (Date Required on Site 30/11/2026) has an alert

**Actual:** NRVC_Hall, alert week threshold 1. Seeded 22 Nov 2026: CFL2611221709-SUB-N (component not ordered) and CFL2611221709-SUB-L (ordered with PO, lead time not confirmed), both with Date Required on Site 28/11/2026. On 23 Nov 2026 after the 05:00-06:00 IST batch, Management Dashboard > Alerts searched by submittal number shows only the creation notice for each, no not-ordered or lead-time alert. Control CFL2611221709-SUB-C (13/12/2026) correctly has no alert. Team to confirm the batch ran and the threshold in effect.

**Test message:** search 43 Inches: 10 row(s) – Delivery of 2 units of 43 Inches logged for submittal CFL2611261107-SUB-G at site. Please verify delivery status. 26/11/2026 ¦ Delivery of 6 units of 43 Inches logged for submittal PLR2611261027-SUB-A at site. Please verify delivery status. 26/11/2026 ¦ Delivery of 4 units of 43 Inches logged for submittal PLR2611261027-SUB-A at site. Please verify delivery status. 26/11/2026 ¦ Delivery for Item 43 Inches of Qty (10) is expected by 17-12-2026 ReqOnSiteDate 24-12-202

**Status:** registered, pending dev-team confirmation.

#### K-18 · PM-REG-CFG-15 – Lead-time-not-confirmed alert raised by the daily batch (1 week)

**Type:** Known Defect · **Area:** Configuration Options · **Registered as:** SCP-DEF-086 · **Evidence:** cfg-live-2026-11-26T11-07-35-076Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. Configuration Options › alert threshold 1 week. A submittal created the day before whose Date Required on Site is within one week (one not ordered, one ordered with lead time not confirmed).

**Steps to reproduce:**

1. Management Dashboard › Alerts (after the 24/11/2026 batch)

**Expected:** seed CFL2611240429-SUB-L (Date Required on Site 30/11/2026) has an alert

**Actual:** NRVC_Hall, alert week threshold 1. Seeded 22 Nov 2026: CFL2611221709-SUB-N (component not ordered) and CFL2611221709-SUB-L (ordered with PO, lead time not confirmed), both with Date Required on Site 28/11/2026. On 23 Nov 2026 after the 05:00-06:00 IST batch, Management Dashboard > Alerts searched by submittal number shows only the creation notice for each, no not-ordered or lead-time alert. Control CFL2611221709-SUB-C (13/12/2026) correctly has no alert. Team to confirm the batch ran and the threshold in effect.

**Test message:** search 43 Inches: 10 row(s) – Delivery of 2 units of 43 Inches logged for submittal CFL2611261107-SUB-G at site. Please verify delivery status. 26/11/2026 ¦ Delivery of 6 units of 43 Inches logged for submittal PLR2611261027-SUB-A at site. Please verify delivery status. 26/11/2026 ¦ Delivery of 4 units of 43 Inches logged for submittal PLR2611261027-SUB-A at site. Please verify delivery status. 26/11/2026 ¦ Delivery for Item 43 Inches of Qty (10) is expected by 17-12-2026 ReqOnSiteDate 24-12-202

**Status:** registered, pending dev-team confirmation.

#### K-19 · PM-REG-FDI-05n – A submitted report keeps the settings it was made with

**Type:** Known Defect · **Area:** FDI settings · **Registered as:** SCP-DEF-079 · **Evidence:** fdi-settings-2026-11-26T10-54-50-309Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header.

**Steps to reproduce:**

1. Need Overall Notes to be captured Yes, uploads Yes, mandatory No → new form: fill the notes field with "FDS2611261054 notes", answer all, submit → Inspection Detail shows "FDS2611261054 notes" (OK)
2. Need Overall Notes to be captured No, Save

**Expected:** the submitted report still shows "FDS2611261054 notes"; a new form has no notes field

**Actual:** With "Need Overall Notes to be captured" = Yes an inspection was submitted with Observation/Notes text, and Inspection Detail showed it. After the setting was switched to No, the same submitted report (Inspection Detail) no longer shows the notes. PM-REG-FDI-05n expects a submitted report to stay as it was submitted; only new reports should follow the new setting. FDI settings suite, 22 Nov 2026.

**Test message:** submitted report unchanged

**Status:** registered, pending dev-team confirmation.

#### K-20 · PM-REG-FDI-16a – Invite – Organization list is unique

**Type:** Known Defect · **Area:** FDI settings · **Registered as:** SCP-DEF-023 · **Evidence:** regression-2026-11-26T08-34-30-230Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. Project Management run data created earlier in the suite (names PMR<YYMMDDHHMM>).

**Steps to reproduce:**

1. Invite Users form: open the "Choose Organization" dropdown

**Expected:** each organization name appears only once

**Actual:** FDI Config > Invite Users > Organization lists Amazon and Meta twice each (Amazon, Amazon, Meta, Meta, Neuralrays, Rubicon Tiles, Voyage Control) on NRVC_Hall (30 Oct 2026). Product owner: the list must be unique.

**Test message:** Duplicate organization(s) in Invite list: Amazon, Bulldozer, Meta, Neuralrays, NR, NR-test

#### K-21 · PM-REG-FDI-43 – Duplicate question set name

**Type:** Known Defect · **Area:** FDI settings · **Registered as:** SCP-DEF-031 · **Evidence:** regression2-2026-11-26T08-59-57-300Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. Project Management run data created earlier in the suite (names PMR2-<YYMMDDHHMM>).

**Steps to reproduce:**

1. "New Question Set": name "SET PMR2-2611261430", category "Cat B PMR2-2611261430", "Create Question Set"; close, reload

**Expected:** no second set tab with that name

**Actual:** FDI Config > New Question Set accepts a set name that exists in another case: "SET PMR2-2610310023" was created next to "Set PMR2-2610310023" (NRVC_Hall, 31 Oct). Product owner: names are unique ignoring case and spaces (R2, R15). Scenario PM-REG-FDI-43.

**Test message:** form closed; message: (none)

#### K-22 · PM-REG-INT-02 – Booking: submit with an empty Booking System Project ID is refused

**Type:** Known Defect · **Area:** Integrations · **Registered as:** SCP-DEF-082 · **Evidence:** pm-decisions-2026-11-25T22-49-25-060Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header.

**Steps to reproduce:**

1. Project Management › Integrations › Booking Integration → "SCP Project ID" pre-filled; record the "Booking System Project ID" field (OK)
2. Clear "Booking System Project ID", click "Submit"

**Expected:** a validation message, nothing linked; after a reload the field shows its earlier value

**Actual:** Project Management › Integrations › Booking Integration (NRVC_Hall): "Booking System Project ID" empty › Submit → no validation or error message is shown (after a reload the field is still empty, nothing linked). PM-REG-INT-02 expects a validation message for the required field (expectation confirmed by the user on 22 Nov 2026). PM decision cases, overnight run 22-23 Nov 2026.

**Test message:** message: (none) · Observed: Booking System Project ID after reload: ""

**Status:** registered, pending dev-team confirmation.

#### K-23 · PM-REG-INT-16 – XER: row click selects a task

**Type:** Known Defect · **Area:** Integrations · **Registered as:** SCP-DEF-024 · **Evidence:** regression-2026-11-26T08-34-30-230Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. Project Management run data created earlier in the suite (names PMR<YYMMDDHHMM>).

**Steps to reproduce:**

1. Manage tasks dialog: search DC1-CS-BUE-1170 and click its row → task is ticked, counter shows 1 selected (OK)
2. Manage tasks dialog: search DC1-CS-BUE-1180 and click its row checkbox

**Expected:** checkbox becomes ticked

**Actual:** XER Import > Manage tasks ("Select tasks to display"): clicking a task row's checkbox does not tick it; clicking elsewhere on the row does (NRVC_Hall, plan SPADE-OYM-1A-2A-BL-1-09-11-2026-1, 30 Oct 2026). Product owner: accepted for now, but an issue.

**Test message:** XER task checkbox click did not select the task

#### K-24 · PM-REG-NAV-01 – Every PM leaf opens its route

**Type:** Known Defect · **Area:** Setup Wizard · **Registered as:** SCP-DEF-027 · **Evidence:** regression-2026-11-26T08-34-30-230Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. Project Management run data created earlier in the suite (names PMR<YYMMDDHHMM>).

**Steps to reproduce:**

1. Left menu: open "TheLink Integration" → page opens (OK)
2. Left menu: open "NCRs" → page opens (OK)
3. Left menu: open "Inventory Rebuild" → page opens (OK)
4. Left menu: open "Excel Import" → page opens (OK)
5. Left menu: review all pages opened so far

**Expected:** all 20 expected entries reached their route and were highlighted as active in the menu

**Actual:** Opening Project Management > Integrations > XER Import or Project Management > Watched Materials does not highlight the menu entry; the other 15 PM entries are highlighted (scenario PM-REG-NAV-01, discovery DEF-C8).

**Test message:** Opened but not highlighted as active in the menu: XER Import, Watched Materials

#### K-25 · PM-REG-PSC-02 – Enabled tick saves automatically

**Type:** Known Defect · **Area:** Pre-Shipping Checklist · **Registered as:** SCP-DEF-063 · **Evidence:** regression2-2026-11-26T08-59-57-300Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. Project Management run data created earlier in the suite (names PMR2-<YYMMDDHHMM>).

**Steps to reproduce:**

1. Sidebar › Project Management › "PreShipping Checklist" → page opens (OK)
2. Last question's "Enabled" checkbox: click it (no Save button; choose Answer Type "Text" and "Add" if asked), reload

**Expected:** change kept

**Actual:** PreShipping Checklist: unticking "Enabled" on the last question (Count 1) shows no message and the box is ticked again after a reload (both attempts, 21 Nov 2026, NRVC_Hall). Switching a question ON was saved on 13 and 17 Nov. Question: may a question that is already in use be disabled?

**Test message:** message: (none)

**Status:** registered, pending dev-team confirmation.

#### K-26 · PM-REG-REF-09 – Duplicate utility name

**Type:** Known Defect · **Area:** Reference data · **Registered as:** SCP-DEF-028 · **Evidence:** regression2-2026-11-26T08-59-57-300Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. Project Management run data created earlier in the suite (names PMR2-<YYMMDDHHMM>).

**Steps to reproduce:**

1. Common Utilities › "Add Common Util": enter the existing name "Curr PMR2-2611261430 E" (same name), click "Add" → accepted or rejected is recorded, no second row expected (OK)
2. Common Utilities › "Add Common Util": enter the existing name " Curr PMR2-2611261430 E " (extra spaces), click "Add" → accepted or rejected is recorded, no second row expected (OK)
3. Common Utilities › "Add Common Util": enter the existing name "CURR PMR2-2611261430 E" (other case), click "Add" → accepted or rejected is recorded, no second row expected (OK)
4. Common Utilities: search the name again

**Expected:** no duplicate row was created and the item count equals the count before the attempts

**Actual:** Reference Data > Common Utilities > Add accepts an existing utility name in another case (e.g. "CURR PMR2-2610302339 E" next to "Curr PMR2-2610302339 E", both currency_type, NRVC_Hall). Product owner: names are unique ignoring case and spaces (R2, R15). Scenario PM-REG-REF-09.

**Test message:** Common Utilities accepted duplicate names (extra spaces, other case): "Curr PMR2-2611261430 E" is now listed 3 times

#### K-27 · PM-REG-REF-24 – Common UoM belongs to the project

**Type:** Known Defect · **Area:** Reference data · **Registered as:** SCP-DEF-040 · **Evidence:** regression2-2026-11-26T08-59-57-300Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. Project Management run data created earlier in the suite (names PMR2-<YYMMDDHHMM>).

**Steps to reproduce:**

1. Sidebar › Project Management › Reference Data › "Common UoM" → page opens (OK)
2. Search "UoM PMR2-2611261430 E"

**Expected:** not listed on this project (UoM belongs to the project, R64)

**Actual:** Reference Data > Common UoM is shared across projects: UoMs created on NRVC_Hall are listed on SCP_Testing_Ram (62 items there, 31 Oct 2026). Material Category is correctly per project. Product owner: Common UoM belongs to the project (R64). Scenario PM-REG-REF-24.

**Test message:** Common UoM is shared across projects: "UoM PMR2-2611261430 E" created on NRVC_Hall is listed 1 time(s) on SCP_Testing_Ram (R64)

#### K-28 · PM-REG-SITE-11 – Export sites

**Type:** Known Defect · **Area:** Site Details · **Registered as:** SCP-DEF-071 · **Evidence:** regression-2026-11-26T08-34-30-230Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. Project Management run data created earlier in the suite (names PMR<YYMMDDHHMM>).

**Steps to reproduce:**

1. Sites & Storage: click "Sites report"

**Expected:** .xlsx downloaded listing as many distinct site names as the page shows

**Actual:** Site Details › Export: the .xlsx has fewer distinct sites than the page (79 vs 92 on 21 Nov 2026), includes a row from another project and shows an internal ID in the Location Type column. Failed in every PM regression run (17–21 Nov 2026). Possible cross-project data in the export; to be assessed by the team.

**Test message:** page 148 site(s); export 182 row(s), 134 distinct site(s); other projects: Location 1 (PRJSUPCHAPLA0000000063); Location Type shown as an ID in 173 row(s)

**Status:** registered, pending dev-team confirmation.

#### K-29 · PM-REG-SYS-05 – Ends before Starts

**Type:** Known Defect · **Area:** System Messages · **Registered as:** SCP-DEF-059 · **Evidence:** regression2-2026-11-26T08-59-57-300Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. Project Management run data created earlier in the suite (names PMR2-<YYMMDDHHMM>).

**Steps to reproduce:**

1. "New message": title "Order PMR2-2611261430", a body, Ends earlier than Starts, click "Create"

**Expected:** message not created and an error/warning is shown (R27)

**Actual:** System Messages › New message with Ends earlier than Starts: the message is not created, but no error or warning is shown. Rule R27 / REQ-PM-091 is confirmed (product owner, 30 Oct 2026). Observed 20 Nov 2026, NRVC_Hall.

**Test message:** not created; message: (none)

#### K-30 · T508-18 – Non-Project-Admin has no upload

**Type:** Known Defect · **Registered as:** SCP-DEF-076 · **Evidence:** tickets-2026-11-26T08-16-24-782Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. Data created by the ticket suite (names TKT<YYMMDDHHMM>).

**Steps to reproduce:**

1. Supplier: left menu has no "Project Management" › Material Master; opening /material-master directly offers no "Upload" / "Upload File"

**Actual:** Signed in as the Supplier account, the left menu has no Project Management, but opening /material-master directly shows Material Master with "Upload". BUGS-508 (T508-18) expects the material bulk upload to be unavailable to non-Project-Admin roles. Note: the Supplier role (Voyage Control Admin) has Material: List/Add/Edit/Delete ticked. Question: should the upload follow those permissions, or be Project-Admin only, and should the page open by URL without the PM menu?

**Test message:** PM menu shown; /material-master → /material-master; Upload offered

**Status:** registered, pending dev-team confirmation.

**Feedback 27 Nov:** Business Logic and Flow Changes (dev review 12→23 Nov), row 6 / gap 7: role-name check – the Supplier role name contains "admin".

#### K-31 · UPL-SITE-08 – Existing site name

**Type:** Known Defect · **Area:** Site Details · **Registered as:** SCP-DEF-039 · **Evidence:** regression2-2026-11-26T08-59-57-300Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. Project Management run data created earlier in the suite (names PMR2-<YYMMDDHHMM>).

**Steps to reproduce:**

1. "Upload": existing site "GATE PMR2-2611261430" (other case) with location "Loc E PMR2-2611261430", confirm, reload → result recorded (OK)
2. Sites table

**Expected:** still one "Gate PMR2-2611261430" and its Locations count unchanged (rule R46)

**Actual:** Site Details > Upload with site_name = an existing site in another case (e.g. GATE PMR2-… for "Gate PMR2-…") adds the location of the row to the existing site instead of rejecting the row as a duplicate (product owner R46). Scenario UPL-SITE-08.

**Test message:** Site upload with an existing site name (other case) added a location to that site (3 → 4) instead of rejecting the row (R46)

#### N-16 · PM-REG-FDI-50 – FDI question list – API endpoint and organisation scope not confirmed

**Type:** Question · **Area:** FDI settings · **Evidence:** regression-2026-11-27T07-05-29-212Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header.

**Steps to reproduce:**

1. Project Management › First Delivery Inspection Config › open the question list.

**Expected:** The question-list request carries the organisation and returns only its questions.

**Actual:** Not testable: the endpoint is not confirmed (runs and fails with the question since 27 Nov).

**Question to the dev team:** Which API endpoint returns the FDI question list, and which parameter scopes it to the organisation?

### 3.8 User Management

#### K-32 · SL-REG-15 – Promote to SSO Organisation

**Type:** Known Defect · **Registered as:** SCP-DEF-085 · **Evidence:** app-regression-2026-11-26T07-18-20-708Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header.

**Steps to reproduce:**

1. Supplier List › search APR2611260718 › row "Supplier APR2611260718" › menu "Promote to SSO Organisation"

**Expected:** a confirmation dialog opens or the promotion is sent

**Actual:** Supplier List › run supplier row menu › "Promote to SSO Organisation" → no dialog, no message and no request to the server; the row (Type "Supplier", Source "-") is unchanged. Expected (user decision 22 Nov 2026: the system allows it): the supplier is promoted, with a confirmation. Checked twice on 23 Nov 2026 (supplier of run APR2611221727).

**Test message:** dialog: (none) · message: (none) · requests: (none)

**Status:** registered, pending dev-team confirmation.

#### K-33 · UM-REG-03 – Duplicate invite rejected (R2)

**Type:** Known Defect · **Registered as:** SCP-DEF-050 · **Evidence:** app-regression-2026-11-26T07-18-20-708Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header.

**Steps to reproduce:**

1. User Management › "Invite Users": enter um.apr2611260718@yopmail.com in upper case, role "Project User", "Send Invites"

**Expected:** no "Invite Sent Successfully" toast (duplicate rejected), then "Cancel"

**Actual:** Inviting an email that is already invited (same address in upper case, another role) shows "Invite Sent Successfully" instead of rejecting the duplicate (UM-REG-03, NRVC_Hall, 13 Nov 2026).

**Test message:** Toast: Invite Sent Successfully

#### K-34 · UM-REG-08 – Remove From Project (run user)

**Type:** Known Defect · **Registered as:** SCP-DEF-051 · **Evidence:** app-regression-2026-11-26T07-18-20-708Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header.

**Steps to reproduce:**

1. User Management: search um.apr2611260718@yopmail.com, open its profile, click "Remove From Project", confirm if asked → toast "User Removed Successfully" (OK)
2. Reload User Management, search um.apr2611260718@yopmail.com

**Expected:** the user is no longer listed

**Actual:** After "Remove From Project" shows "User Removed Successfully", the user is still listed in User Management after a reload (UM-REG-08, NRVC_Hall, 13 Nov 2026).

**Test message:** Removed user is still listed (OBS-UM-3)

#### K-35 · UM-REG-11 – Filter narrows rows

**Type:** Known Defect · **Registered as:** SCP-DEF-052 · **Evidence:** app-regression-2026-11-26T07-18-20-708Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header.

**Steps to reproduce:**

1. User Management: "Filter" › tab "status" › "Invited" › "Apply Filter"

**Expected:** every listed row has Status "Invited" (row counts before/after noted)

**Actual:** User Management "Filter" dialog: the "status" tab offers no values (no "Invited" option), so the list cannot be filtered by status (UM-REG-11, NRVC_Hall, 13 Nov 2026).

**Test message:** Filter tabs offer no values (OBS-UM-4)

### 3.9 Roles & Access

#### N-19 · PM-REG-ROLE-05 – Supplier / Subcontractor without Project Management access can open Material Master by URL

**Type:** Defect candidate · **Evidence:** roles-2026-11-26T11-15-43-811Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. Supplier and Subcontractor test accounts; Project Management tab not enabled for either role.

**Steps to reproduce:**

1. Log in as the Supplier and choose NRVC_Hall.
2. Open https://stg-supplychain-app.voyagecontrol.com/material-master directly in the address bar.
3. Repeat as the Subcontractor.

**Expected:** No Project Management menu, and Material Master / Site Details / System Messages are not usable by URL.

**Actual:** The Project Management menu is shown and Material Master opens and is usable for both roles (same cause as PM-REG-ROLE-08).

**Feedback 27 Nov:** Business Logic and Flow Changes (dev review 12→23 Nov), row 6 / gap 7: role-name check (see PM-REG-ROLE-08).

#### N-18 · PM-REG-ROLE-08 – Supplier menu shows Project Management although the role does not enable it

**Type:** Defect candidate · **Evidence:** roles-2026-11-26T11-15-43-811Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. Supplier test account. User Management › Roles › Supplier: "Menu: Project Management" NOT enabled.

**Steps to reproduce:**

1. As Project Admin open User Management › Roles › Supplier → confirm "Menu: Project Management" is off.
2. Log out; log in as the Supplier and choose NRVC_Hall.
3. Look at the left menu.

**Expected:** Only the menu entries enabled for the role are shown – no "Project Management".

**Actual:** Left menu shows Management Dashboard, Enterprise, Procurement Log, My Work, Loads, First Delivery Inspections, International Shipments, Document Management and Project Management. The Subcontractor shows the same (also Enterprise, not enabled) – that half is already a registered Known Defect.

**Feedback 27 Nov:** Business Logic and Flow Changes (dev review 12→23 Nov), row 6 / gap 7: the new actions check the ROLE NAME (contains "admin" / "subcontractor"), not the SSO permission codes. The Supplier test role is named "Voyage Control Admin", which contains "admin" – a likely cause. Same for T508-18 (SCP-DEF-076).

#### N-20 · PM-REG-ROLE-09 – Menu vs permission keys – session permission list not available to the tests

**Type:** Question · **Evidence:** roles-2026-11-27T07-28-34-223Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. Supplier and Subcontractor test accounts.

**Steps to reproduce:**

1. Sign in as each account; compare the left menu with the permission keys of the role.

**Expected:** Every menu entry matches a permission key the role holds.

**Actual:** Not testable: the session permission list (SSO codes) is not exposed (runs and fails with the question since 27 Nov).

**Question to the dev team:** Where can the tests read the session permission list of a signed-in user?

### 3.11 Inventory Rebuild

#### N-21 · IR-REG-01 – Inventory Rebuild shows dates as MM/DD/YYYY with 12-hour time

**Type:** Defect candidate · **Evidence:** import-rebuild-2026-11-26T20-24-53-520Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NeuralRays_Demo · site "Location 1".

**Steps to reproduce:**

1. Project Management › Inventory Settings › Inventory Rebuild (https://stg-supplychain-app.voyagecontrol.com/inventory-rebuild).
2. Read "Last nightly run › Date", the dry-run heading and the History dates.

**Expected:** DD/MM/YYYY like the rest of the app (e.g. 25/11/2026).

**Actual:** "Date: 11/25/2026"; "Dry run results (11/27/2026 1:53 AM …)". Bulk Upload Status shows the same format.

### 3.12 Excel Import

#### N-23 · XI-GAP-05 – Gap 5: Excel import accepts quantity 0 and a negative lead time

**Type:** Defect candidate · **Evidence:** import-rebuild-2026-11-27T07-32-35-958Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NeuralRays_Demo · site "Location 1". An existing material row (e.g. 768687 / River Sand) in the import template.

**Steps to reproduce:**

1. Procurement Log › Import from Excel › upload a file with that row and Quantity 0 › Preview.
2. Repeat with Lead time −2 weeks.
3. For comparison: Quantity −5, Unit "ZZZ", ROJ 31/02/2026.

**Expected:** Each invalid value is rejected or listed under "Rows that need attention".

**Actual:** Quantity 0 and Lead time −2 weeks: "0 to create · 1 to update · 0 rejected" – the row would be imported. Quantity −5, Unit "ZZZ" and ROJ 31/02/2026 are rejected correctly (27 Nov, Preview only, nothing imported).

#### N-22 · XI-REG-04 – Excel Import is not listed in Bulk Upload Status

**Type:** Question · **Evidence:** import-rebuild-2026-11-26T20-28-10-971Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NeuralRays_Demo · site "Location 1". A Procore submittal, e.g. 768687 / River Sand / 100.

**Steps to reproduce:**

1. Excel Import (https://stg-supplychain-app.voyagecontrol.com/excel-import) › upload a sheet with Submittal No 768687, Material River Sand, Quantity 100, Model / part no. <any> › Preview → "0 to create · 1 to update · 0 rejected" › Import → "0 created, 1 updated" (OK).
2. Project Management › Bulk Upload Status (https://stg-supplychain-app.voyagecontrol.com/bulk-upload-status).

**Expected:** The import of the sheet is listed with date, user and outcome.

**Actual:** Not listed; the newest entry is a Sites upload of 30/10/2026 (shown as "10/30/2026").

**Question to the dev team:** Should Excel Imports appear in Bulk Upload Status?

### 3.13 International Shipments

#### N-26 · SHP-REG-15 – Delay Alerts: every affected shipment lists the same alert 136 times

**Type:** Defect candidate · **Evidence:** p2-2026-11-26T11-36-53-566Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header.

**Steps to reproduce:**

1. International Shipments › Delay Alerts.
2. Look at the alerts column of the "AFFECTED SHIPMENTS (109)" rows.

**Expected:** Each affected shipment lists each matching alert once.

**Actual:** 109 of 109 rows repeat an alert – e.g. 136 entries, 1 distinct ("Red Sea route disruptions") in one row.

#### N-24 · SHP-REG-18 – "N at risk" counter ignores the Destination filter

**Type:** Defect candidate · **Evidence:** p2-2026-11-26T11-36-53-566Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header.

**Steps to reproduce:**

1. Enterprise › Shipments.
2. Destination filter › "Chennai".
3. Read the counter above the table and count the at-risk rows shown.

**Expected:** "36 shown · 24 at risk" (at risk counted among the rows shown).

**Actual:** "36 shown · 75 at risk" – the at-risk count stays at the unfiltered total.

**Feedback 27 Nov:** Business Logic and Flow Changes (dev review 12→23 Nov), rows 36 / 41: shipment risk now adds a 7-day port-to-site buffer, so more shipments are at risk; the counter should still follow the Destination filter.

#### N-25 · SHP-REG-20 – Active Delay Alerts: 272 cards but only 2 distinct alerts

**Type:** Defect candidate · **Evidence:** p2-2026-11-26T11-36-53-566Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header.

**Steps to reproduce:**

1. Enterprise › Shipments › "Active Delay Alerts".
2. Compare the cards (severity, title, description).

**Expected:** Each alert is listed once.

**Actual:** 272 cards, 2 distinct: "CRITICAL Red Sea route disruptions — carriers diverting via Cape of Good Hope" ×136 and "HIGH Port congestion at Shanghai causing 7-14 day delays" ×136. Probably the same cause as SHP-REG-15.

#### K-36 · SHP-REG-09 – Open shows the shipment

**Type:** Known Defect · **Registered as:** SCP-DEF-084 · **Evidence:** app-regression-2026-11-26T07-18-20-708Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header.

**Steps to reproduce:**

1. Enterprise Shipments: search the submittal in "Search submittal…", click "Open" on its row

**Expected:** the URL contains the submittal number (opens the shipment)

**Actual:** Enterprise Shipments › search the run submittal › "Open" → the shipments list opens instead of that shipment (the URL does not name the submittal) (OBS-SHP-3). Run again on 23 Nov 2026 at the user request.

**Test message:** Opened /international-shipments

**Status:** registered, pending dev-team confirmation.

### 3.15 Analytics

#### N-27 · ANV-AGG-10 – Aggregate Stats values in $ on an INR project

**Type:** Defect candidate · **Evidence:** p2-2026-11-26T11-36-53-566Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. Header currency "INR - Indian Rupees".

**Steps to reproduce:**

1. Analytics › Aggregate Stats.
2. Read VALUE DELIVERED and the pipeline committed values.

**Expected:** Values shown with the project currency symbol (₹), rule R58.

**Actual:** VALUE DELIVERED shows "$3,730,128" (same family as SCP-DEF-049 / SCP-DEF-061).

#### K-37 · ANA-REG-02 – Export works

**Type:** Known Defect · **Registered as:** SCP-DEF-014 · **Evidence:** app-regression-2026-11-26T07-18-20-708Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header.

**Steps to reproduce:**

1. Analytics › SubContractor Issues: open the page, clear "Search…" → table rows are listed (OK)
2. Click "Export", choose the export option (today only "Download Template")

**Expected:** an API request is sent and a non-template file with the shown rows is downloaded

**Actual:** Subcontractor Issues Export offers only "Download Template", which sends no request and produces no file (empty click handler, no export API).

**Test message:** Export menu: [Download Template]; clicked "Download Template"; API calls: none; file: none

#### K-38 · ANV-AGG-03 – Aggregate Stats export gives the data

**Type:** Known Defect · **Registered as:** SCP-DEF-088 · **Evidence:** ana-ent-2026-11-26T11-23-55-496Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header.

**Steps to reproduce:**

1. Aggregate Stats › Export: choose the export option

**Expected:** the file holds the shown data, not the blank upload template

**Actual:** Analytics > Aggregate Stats > Export: the only menu entry is "Download Template", which downloads the static download_template.xlsx instead of the figures shown on the page. Expected: a file with the shown data. Re-checked 23 Nov 2026.

**Test message:** menu: [Download Template]; file: download_template.xlsx

**Status:** registered, pending dev-team confirmation.

#### K-39 · ANV-SCI-01 – Supply Chain Intelligence follows the project and venue

**Type:** Known Defect · **Registered as:** SCP-DEF-093 · **Evidence:** ana-ent-2026-11-26T11-23-55-496Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header.

**Steps to reproduce:**

1. Analytics › Supply Chain Intelligence: open the page and record its data requests

**Expected:** they carry the selected project and venue (user decision 18 Nov 2026)

**Actual:** Analytics > Supply Chain Intelligence: the data requests (/api/salesflow/supply_chain/...) carry only project_id and range, no venue or site, so the page cannot follow the selected venue. User decision 18 Nov 2026: the page must follow the selected project and venue (ANA-DEF-15). Re-checked 23 Nov 2026.

**Test message:** 7 request(s); parameters: project_id, range

**Status:** registered, pending dev-team confirmation.

#### K-40 · ANV-SUB-01 – SubContractor Issues: every metric column has a value

**Type:** Known Defect · **Registered as:** SCP-DEF-034 · **Evidence:** ana-ent-2026-11-26T11-23-55-496Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header.

**Steps to reproduce:**

1. Analytics › SubContractor Issues: compare the header columns with the cells of each row

**Expected:** each row has a cell for every column (incl. Over-Deliveries)

**Actual:** Analytics > Subcontractor Issues shows 8 column headers (Subcontractor, Project Name, Delays in Raising PO, Delays in Confirming PO, PO Schedule Impact, Delays in Booking, Delivery Impacted, Over-Deliveries) but each data row has 7 cells: the Over-Deliveries value is missing. Project Name also shows the project ID (e.g. PRJSUPCHAPLA0000000099).

**Test message:** 8 columns (Subcontractor / Project Name / Delays in Raising PO / Delays in Confirming PO / PO Schedule Impact / Delays in Booking / Delivery Impacted / Over-Deliveries); 242 rows; rows with fewer cells: 187

#### K-41 · ANV-SUB-03 – SubContractor Issues: values are per subcontractor, not project totals

**Type:** Known Defect · **Registered as:** SCP-DEF-090 · **Evidence:** ana-ent-2026-11-26T11-23-55-496Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header.

**Steps to reproduce:**

1. SubContractor Issues: rows of NRVC_Hall

**Expected:** the subcontractors do not all show the same values (per-subcontractor figures, not the project total repeated)

**Actual:** Analytics > SubContractor Issues: all 36 NRVC_Hall subcontractor rows show the same values 1/1/13/0/14, which are the project totals repeated on each subcontractor, not per-subcontractor figures (ANA-DEF-18). Re-checked 23 Nov 2026.

**Test message:** 35 row(s) of the project; 1 distinct value set(s): 0/0/0/0/0/0

**Status:** registered, pending dev-team confirmation.

**Feedback 27 Nov:** Business Logic and Flow Changes (dev review 12→23 Nov), row 39 (BUGS-593): Supplier / Subcontractor Issues now count only the submittals each person is Responsible for – this is the fix for the repeated project totals. Still reproduced on 26 Nov: re-test after deploy.

#### K-42 · ANV-SUP-01 – Supplier Issues: KPI cards are the cumulative project totals

**Type:** Known Defect · **Registered as:** SCP-DEF-091 · **Evidence:** ana-ent-2026-11-26T11-23-55-496Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header.

**Steps to reproduce:**

1. Analytics › SubContractor Issues: per project, take its value once for Raising PO, Confirming PO, Schedule impact and Delivery impacted, and add up over all projects (the cumulative totals)
2. Analytics › Supplier Issues: read the KPI cards (Raising PO, Confirming PO, Schedule impact, Deliveries impacted)

**Expected:** equal to those cumulative totals

**Actual:** Analytics > Supplier Issues: KPI cards Raising PO / Confirming PO / Schedule impact / Deliveries impacted show 41 / 41 / 533 / 574, the sum of the duplicated subcontractor rows. Taking each project once, the cumulative totals are 2 / 14 / 13 / 14 (ANA-DEF-21). Re-checked 23 Nov 2026.

**Test message:** KPI cards 1 / 1 / 14 / 15; cumulative totals 1 / 14 / 0 / 0

**Status:** registered, pending dev-team confirmation.

**Feedback 27 Nov:** Business Logic and Flow Changes (dev review 12→23 Nov), row 39 (BUGS-593): see SCP-DEF-090 – re-test after deploy.

#### K-43 · ANV-SUP-02 – Supplier Issues: Delivery Performance has data when deliveries are impacted

**Type:** Known Defect · **Registered as:** SCP-DEF-092 · **Evidence:** ana-ent-2026-11-26T11-23-55-496Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header.

**Steps to reproduce:**

1. Supplier Issues: "Deliveries impacted" > 0

**Expected:** the Delivery Performance panel shows data (not "No delivery data")

**Actual:** Analytics > Supplier Issues: the Delivery Performance panel says "No delivery data" while the KPI card shows 574 deliveries impacted (ANA-F22). Re-checked 23 Nov 2026.

**Test message:** Deliveries impacted 15; "No delivery data" shown: true

**Status:** registered, pending dev-team confirmation.

### 3.16 TOV Analytics

#### N-28 · TV-REG-08 – TOV Invoiced Orders / Outflow Projection: search does not filter

**Type:** Defect candidate · **Evidence:** tov-epd-2026-11-26T19-58-56-213Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header.

**Steps to reproduce:**

1. Analytics › TOV Analytics › Submittal Invoiced Orders (https://stg-supplychain-app.voyagecontrol.com/submittal-invoiced-orders).
2. Type "PLR" in the search box.
3. Repeat on Submittal Level Outflow Projection.

**Expected:** Only rows whose submittal contains "PLR".

**Actual:** All 674 rows stay; the first row is CFL2611241545-SUB-P. Same on Outflow Projection.

### 3.17 EPD Tracker

#### N-29 · ET-REG-07 – EPD Tracker: no way to give an EPD an expiry date, so Expiring / Expired cannot be tested

**Type:** Question · **Evidence:** tov-epd-2026-11-27T01-49-23-150Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header. A category ticked in EPD Tracker › Settings so its lines need an EPD.

**Steps to reproduce:**

1. EPD Tracker (https://stg-supplychain-app.voyagecontrol.com/epd-tracker) › view "Required (missing)" › a line › EPDs › upload an EPD (PDF) → the line moves to Received (OK).
2. Look for an expiry date on the EPD (EPD Report and EPD Tracker).
3. Check the chips "Expiring" and "Expired" against Settings › "Show as expiring within".

**Expected:** An EPD expiring within the window shows as "Expiring", and one past its expiry as "Expired".

**Actual:** There is no expiry-date field on the EPD Report or the tracker, and the test PDF is not parsed for one, so no line can reach Expiring / Expired.

**Question to the dev team:** Q8: how does an EPD get an expiry date on staging? Please provide a sample EPD PDF the app can read.

### 3.18 Document Management

#### K-44 · DOC-REG-04 – Uploaded By is the real user

**Type:** Known Defect · **Registered as:** SCP-DEF-069 · **Evidence:** app-regression-2026-11-26T07-18-20-708Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header.

**Steps to reproduce:**

1. All Documents: set Category "PO File"

**Expected:** first row's "Uploaded By" is a user email (contains "@")

**Actual:** All Documents, Category "PO File": the Uploaded By column shows "Unknown" (Category "Pdf": "test") instead of the uploading user (OBS-DOC-1/2). Failed in every All Modules regression run (17–21 Nov 2026).

**Test message:** PO File: Unknown

**Status:** registered, pending dev-team confirmation.

### 3.19 Messages

#### N-30 · MS-REG-03 – Messages cannot be tested – Delivery Management / Booking Integration not connected on staging

**Type:** Blocker · **Evidence:** import-rebuild-2026-11-26T20-20-24-012Z

**Preconditions:** Staging https://stg-supplychain-app.voyagecontrol.com · Project Admin account · project NRVC_Hall · site "Warehoust _NR" selected in the header.

**Steps to reproduce:**

1. Messages (https://stg-supplychain-app.voyagecontrol.com/messages).

**Expected:** Compose and send a message to a project supplier; it is listed as sent.

**Actual:** Notice "Delivery Management isn't connected" with "Check again"; no compose.

**Question to the dev team:** Can the platform team connect Booking Integration on staging?

## 4. Skipped (96) – module-wise, with what is needed to run

| Reason | Cases | Owner | Needed to run |
|---|---|---|---|
| Runs in another case / suite | 33 | None | Nothing – the check runs elsewhere (counted there). |
| One record per run (user rule) | 11 | User | More than one write per run, or a project cleared for it. |
| Needs approval (changes shared data) | 11 | User / Client | An explicit go-ahead for a write that cannot be undone or changes shared settings. |
| Inventory on NRVC_Hall does not load | 9 | Dev team | Fix of "Couldn't load inventory." on heavy-data projects (tested on NeuralRays_Demo meanwhile). |
| Test data / locator – QA | 6 | QA | Test data or a locator QA still has to prepare. |
| Test data – second project | 4 | Dev team | A second project in the NRVC_Hall organisation (Q-FDI-8). |
| External system | 3 | None | Access to the external system (Procore / TheLink). |
| Client decision – Supplier Inbox removed | 3 | Client | Decision: retire these cases or move them to My Work (question 3). |
| Manual / dropped by decision | 3 | None | Kept manual or dropped on an earlier decision. |
| Account / data from Dev | 3 | Dev team | An account or data only the dev team can prepare. |
| Mailbox (YOPmail Cloudflare) | 2 | None | A real invite acceptance; the Cloudflare check is not bypassed. |
| Test data – sample PO / BOM | 2 | Dev team / Client | A sample PO with line items and a sample BOM (Q-DOC-3). |
| Client decision – manual shipment status removed | 2 | Client | Confirmation that status now comes only from ShipsGo (question 9). |
| Test data – second location | 1 | User / Client | A second storage location on NeuralRays_Demo. |
| Retired – feature removed | 1 | None | Nothing – the control no longer exists. |
| Test data – a deletable site with deliveries | 1 | User | A site with deliveries that may be deleted if the app wrongly allows it. |
| Answered – retire | 1 | QA | Business Logic and Flow Changes (dev review 12→23 Nov), §1 / gap 4: discrepancies are raised only from LOAD receipts; a delivery on the old delivery screen keeps the old rules and raises none. Covered by NPE-SMK-04; this case will be retired. |

**Procurement Log (2)**

| Test case | What it checks | Reason recorded | Needed to run | Owner |
|---|---|---|---|---|
| PL-REG-INT-03 | Received quantity reaches Inventory | Skipped (25 Nov 2026): Inventory Management removed; the Procurement Log "Inventory" tab shows "Couldn't load inventory." – awaiting client question 2 | Fix of "Couldn't load inventory." on heavy-data projects (tested on NeuralRays_Demo meanwhile). | Dev team |
| T155-03 | Subcontractor in the supplier organisation can fill the checklist | Covered by T155-01: since 22 Nov 2026 a subcontractor can fill the checklist whatever the supplier organisation | Nothing – the check runs elsewhere (counted there). | None |

**Loads, Discrepancies & NCRs (1)**

| Test case | What it checks | Reason recorded | Needed to run | Owner |
|---|---|---|---|---|
| LD-REG-13 | A receipt with damaged or short units raises a discrepancy | Retired (27 Nov 2026, dev review "SCP Business Logic and Flow Changes"): discrepancies are raised only from LOAD receipts; a delivery logged on the component page keeps the old rules and raises none.  | Business Logic and Flow Changes (dev review 12→23 Nov), §1 / gap 4: discrepancies are raised only from LOAD receipts; a delivery on the old delivery screen keeps the old rules and raises none. Covered by NPE-SMK-04; this case will be retired. | QA |

**First Delivery Inspections (12)**

| Test case | What it checks | Reason recorded | Needed to run | Owner |
|---|---|---|---|---|
| T548-11 | Deleted bank question is skipped on create | Needs an organisation set holding a bank-deleted question, which the app blocks (AC 20); prepared by a developer | An account or data only the dev team can prepare. | Dev team |
| T548-18 | View-only user has no organisation actions | Needs a working fdi:view-only account (SCP_SUPPLIER_* sign-in) | An account or data only the dev team can prepare. | Dev team |
| FDI-REG-12 | Sync to Provider | Pushes to Procore (external system); not executed | Access to the external system (Procore / TheLink). | None |
| T548-12 | Create is all-or-nothing (two-tab race) | Manual: needs two tabs racing for one category | Kept manual or dropped on an earlier decision. | None |
| T548-16 | Bank question used in an organisation set cannot be deleted | Not automated: a failing guard would delete a real bank question | Kept manual or dropped on an earlier decision. | None |
| FDI-REG-01c | Access needed | Needs a role without FDI access; changing shared roles is out of scope (PM role scenarios cover the model) | A role without FDI access. | User / Client |
| FDI-REG-01 | First delivery creates one inspection | Runs in pl-regression-3 (new material → GRN → FDI row) | Nothing – the check runs elsewhere (counted there). | None |
| FDI-REG-01a | Second delivery creates none | Runs in pl-regression-3 | Nothing – the check runs elsewhere (counted there). | None |
| FDI-REG-02 | Assign inspector | Covered by FDI-REG-06 (self assignment is the assignment path for this role) | Nothing – the check runs elsewhere (counted there). | None |
| FDI-REG-03 | Complete inspection form | Covered by FDI-REG-08…10 | Nothing – the check runs elsewhere (counted there). | None |
| FDI-REG-11 | FAIL answer path | Covered by FDI-REG-10 (first answer FAIL with observation) | Nothing – the check runs elsewhere (counted there). | None |
| T548-04 | Organisation sets are shared within the organisation only | Set SCP_FDI_SECOND_PROJECT and/or SCP_TKT548_OTHER_ORG_PROJECT (project ids) to run | A second project in the NRVC_Hall organisation (Q-FDI-8). | Dev team |

**Project Management (36)**

| Test case | What it checks | Reason recorded | Needed to run | Owner |
|---|---|---|---|---|
| PM-SMK-004 | TheLink Integration page loads | Deferred: no TheLink access, out of scope for now (R7) | Access to the external system (Procore / TheLink). | None |
| PM-REG-CFG-18 | Currency is set per project | Not run: SCP_Testing_Ram's Configuration Options cannot be saved while its week fields are empty ("… is required"), and filling them would permanently configure that project (CFG-17 and the Setup Wiza | An explicit go-ahead for a write that cannot be undone or changes shared settings. | User / Client |
| PM-REG-MM-11 | Delete material in use | Not run: if the app allows it, a material used by submittals would be deleted (R14) – needs approval | An explicit go-ahead for a write that cannot be undone or changes shared settings. | User / Client |
| PM-REG-NAV-08 | Setup Wizard disappears after completion | Not run: completing the Setup Wizard on SCP_Testing_Ram cannot be undone and CFG-17 / PSC-05 need it unconfigured – needs product-owner go-ahead | An explicit go-ahead for a write that cannot be undone or changes shared settings. | User / Client |
| PM-REG-NAV-09 | Wizard data matches module pages | Not run: same as NAV-08 (completes the Setup Wizard on SCP_Testing_Ram) | An explicit go-ahead for a write that cannot be undone or changes shared settings. | User / Client |
| PM-REG-PSC-05 | Menu item follows the Pre-Shipping toggle | Not run: SCP_Testing_Ram's Configuration Options cannot be saved while its week fields are empty ("… is required"), and filling them would permanently configure that project (CFG-17 and the Setup Wiza | An explicit go-ahead for a write that cannot be undone or changes shared settings. | User / Client |
| PM-REG-CFG-09 | Pre-Shipping toggle gates checklist | Cross-module (Procurement Log delivery approval) – Regression part 3 | Nothing – the check runs elsewhere (counted there). | None |
| PM-REG-CFG-10 | GRN toggle effect | Cross-module (delivery GRN options) – Regression part 3 | Nothing – the check runs elsewhere (counted there). | None |
| PM-REG-CFG-11 | Archive period effect | Cross-module (Management Dashboard read items over 60 days) – Regression part 3 | Nothing – the check runs elsewhere (counted there). | None |
| PM-REG-CFG-13 | Not-ordered alert triggers | Two-phase: seed today, verify after the 05:00–06:00 IST batch – Regression part 3 | Nothing – the check runs elsewhere (counted there). | None |
| PM-REG-CFG-14 | Not-booked alert triggers | Two-phase batch check; NRVC_Hall booking link not confirmed (Q-ANT-6) – Regression part 3 | Nothing – the check runs elsewhere (counted there). | None |
| PM-REG-CFG-15 | Lead time not confirmed alert | Two-phase: seed today, verify after the 05:00–06:00 IST batch – Regression part 3 | Nothing – the check runs elsewhere (counted there). | None |
| PM-REG-CFG-16 | No alert before threshold | Two-phase batch check – Regression part 3 | Nothing – the check runs elsewhere (counted there). | None |
| PM-REG-CFG-17 | Unconfigured settings: in-app only | Two-phase batch check on SCP_Testing_Ram – Regression part 3 | Nothing – the check runs elsewhere (counted there). | None |
| PM-REG-FDI-05k | Spec document opens in a viewer | Same data need as PM-REG-FDI-05d | Nothing – the check runs elsewhere (counted there). | None |
| PM-REG-FDI-18 | Invite → accept → activate → disable | Needs Yopmail acceptance and the inspector login (existing Cucumber flow) – Regression part 3 | Nothing – the check runs elsewhere (counted there). | None |
| PM-REG-FDI-25a | Inspector list kept after navigating away | Runs with Regression part 2 (needs data created in the run) | Nothing – the check runs elsewhere (counted there). | None |
| PM-REG-FDI-26a | Invite from User Management is unaffected | Cross-module (User Management invite) – Regression part 3 | Nothing – the check runs elsewhere (counted there). | None |
| PM-REG-FDI-28 | Disabled and pending inspectors cannot self-assign | Needs the inspector login and an FDI record – Regression part 3 | Nothing – the check runs elsewhere (counted there). | None |
| PM-REG-FDI-28a | Already-assigned records keep a since-disabled inspector | Needs an assigned FDI record – Regression part 3 | Nothing – the check runs elsewhere (counted there). | None |
| PM-REG-FDI-42c | Empty Questions list | Runs with Regression part 2 (needs data created in the run) – an empty question set | Nothing – the check runs elsewhere (counted there). | None |
| PM-REG-INV-06 | Breach notification | Cross-module (stock change in Inventory Management) – Regression part 3 | Nothing – the check runs elsewhere (counted there). | None |
| PM-REG-PLC-06 | Drag reorder | Cross-module (Procurement Log column order) – Regression part 3 | Nothing – the check runs elsewhere (counted there). | None |
| PM-REG-PSC-04 | Disabled question hidden downstream | Cross-module (Procurement Log delivery checklist) – Regression part 3 | Nothing – the check runs elsewhere (counted there). | None |
| UPL-MM-15 | Reports can be downloaded | Runs with Regression part 2 (needs data created in the run) – the UPL-MM-05 upload | Nothing – the check runs elsewhere (counted there). | None |
| UPL-SITE-13 | Reports can be downloaded | Runs with Regression part 2 (needs data created in the run) – the UPL-SITE-04 upload | Nothing – the check runs elsewhere (counted there). | None |
| PM-REG-SITE-07 | Delete a site that has deliveries is blocked or warned | Skipped (user, 25 Nov 2026): no run site with deliveries is listed any more; set SCP_SITE07_SITE to a site with deliveries that may be deleted if the app wrongly allows it | A site with deliveries that may be deleted if the app wrongly allows it. | User |
| PM-REG-FDI-46 | New question offered to the organization's other projects | Blocked: no second project in NRVC_Hall's organization yet (R62, Q-FDI-8) | A second project in the NRVC_Hall organisation (Q-FDI-8). | Dev team |
| PM-REG-FDI-48 | Enable a shared question on another project | Blocked: no second project in NRVC_Hall's organization yet (R62, Q-FDI-8) | A second project in the NRVC_Hall organisation (Q-FDI-8). | Dev team |
| PM-REG-FDI-49 | Enabling on one project doesn't spread | Blocked: no second project in NRVC_Hall's organization yet (R62, Q-FDI-8) | A second project in the NRVC_Hall organisation (Q-FDI-8). | Dev team |
| PM-REG-FDI-05d | Spec documents shown as thumbnails | Needs a run delivery whose submittal has a Spec Section No with linked documents (test data to prepare in Document Management) | Test data or a locator QA still has to prepare. | QA |
| PM-REG-FDI-05e | New question appears on the form | Needs the question set that covers the run material to be identified and a question added to it (shared FDI question sets) – next step | Test data or a locator QA still has to prepare. | QA |
| PM-REG-FDI-05f | Deleted / other-category question not shown | Depends on PM-REG-FDI-05e | Test data or a locator QA still has to prepare. | QA |
| PM-REG-FDI-05m | Empty Spec Section No → exact message | Needs a delivery whose submittal has an EMPTY Spec Section No (run submittals have one) | Test data or a locator QA still has to prepare. | QA |
| T508-14 | Cancel upload rolls back | The "Cancel upload" control at the decision step is not exposed as a button to the tests (22 Nov 2026); needs a locator for it | Test data or a locator QA still has to prepare. | QA |
| T508-17 | Bulk Upload Status matches the outcome | Needs a fully failed upload file (every row rejected without a decision step); next step | Test data or a locator QA still has to prepare. | QA |

**User Management (5)**

| Test case | What it checks | Reason recorded | Needed to run | Owner |
|---|---|---|---|---|
| UM-REG-09 | Invite → accept → active | Needs the invited user to accept from the mailbox; covered by the PM Cucumber invite flow (FDI-18 pattern) | A real invite acceptance; the Cloudflare check is not bypassed. | None |
| SL-REG-04 | Invalid email gets an app message | Skipped on user triage 13 Nov 2026: the system does not allow a supplier to be created with an invalid email | Kept manual or dropped on an earlier decision. | None |
| UM-REG-10 | Role access applies to screens | Changes the shared Roles configuration; covered by PM role scenarios (R40–R43) | An explicit go-ahead for a write that cannot be undone or changes shared settings. | User / Client |
| UM-REG-04 | Organization optional | Covered as a step of UM-REG-01 | Nothing – the check runs elsewhere (counted there). | None |
| UM-REG-05 | Add Another User | Covered as a step of UM-REG-01 | Nothing – the check runs elsewhere (counted there). | None |

**Roles & Access (7)**

| Test case | What it checks | Reason recorded | Needed to run | Owner |
|---|---|---|---|---|
| PM-REG-ROLE-23 | Project Admin limited to their associated organization | No Project-Admin-only account (the Project Admin account is a platform admin) | An account or data only the dev team can prepare. | Dev team |
| PM-REG-ROLE-12 | Role assigned at user creation (SCP) | Needs YOPmail invite acceptance (Cloudflare check, not bypassed) | A real invite acceptance; the Cloudflare check is not bypassed. | None |
| PM-REG-ROLE-02 | Admin can edit role access | Needs a role change; this suite only reads the configured access (user decision 22 Nov 2026) | An explicit go-ahead for a write that cannot be undone or changes shared settings. | User / Client |
| PM-REG-ROLE-06 | A role change applies to a signed-in user | Needs a role change; this suite only reads the configured access | An explicit go-ahead for a write that cannot be undone or changes shared settings. | User / Client |
| PM-REG-ROLE-13 | Org Admin creates a user in the portal | Expected (user, 22 Nov 2026): the Org Admin can create a user in the organisation admin portal. Creating a platform user is a write in the shared portal: awaiting approval (the new user could then be  | An explicit go-ahead for a write that cannot be undone or changes shared settings. | User / Client |
| PM-REG-ROLE-22 | Org Admin can create a project in any organization | Expected (user, 22 Nov 2026): the Org Admin can create projects in any organisation in the admin portal. The New Project form has no organisation field (Project Name, Region, Address, Project Owner e- | An explicit go-ahead for a write that cannot be undone or changes shared settings. | User / Client |
| PM-REG-ROLE-10 | Disabled FDI inspector | Covered by PM-REG-FDI-18 (needs an inspector login) | Nothing – the check runs elsewhere (counted there). | None |

**Inventory (23)**

| Test case | What it checks | Reason recorded | Needed to run | Owner |
|---|---|---|---|---|
| INV-SMK-01 | Page loads | Skipped (25 Nov 2026): Inventory Management removed; its Procurement Log "Inventory" tab shows "Couldn't load inventory." – awaiting client question 2 | Fix of "Couldn't load inventory." on heavy-data projects (tested on NeuralRays_Demo meanwhile). | Dev team |
| INV-SMK-02 | Inventory page did not load | INV-SMK-01 failed | Fix of "Couldn't load inventory." on heavy-data projects (tested on NeuralRays_Demo meanwhile). | Dev team |
| INV-SMK-03 | Inventory page did not load | INV-SMK-01 failed | Fix of "Couldn't load inventory." on heavy-data projects (tested on NeuralRays_Demo meanwhile). | Dev team |
| INV-SMK-04 | Inventory page did not load | INV-SMK-01 failed | Fix of "Couldn't load inventory." on heavy-data projects (tested on NeuralRays_Demo meanwhile). | Dev team |
| INV-SMK-05 | Inventory page did not load | INV-SMK-01 failed | Fix of "Couldn't load inventory." on heavy-data projects (tested on NeuralRays_Demo meanwhile). | Dev team |
| INV-SMK-06 | Inventory page did not load | INV-SMK-01 failed | Fix of "Couldn't load inventory." on heavy-data projects (tested on NeuralRays_Demo meanwhile). | Dev team |
| INV-SMK-07 | Inventory page did not load | INV-SMK-01 failed | Fix of "Couldn't load inventory." on heavy-data projects (tested on NeuralRays_Demo meanwhile). | Dev team |
| INV-SMK-08 | Inventory page did not load | INV-SMK-01 failed | Fix of "Couldn't load inventory." on heavy-data projects (tested on NeuralRays_Demo meanwhile). | Dev team |
| INV-REG-01 | GRN creates an incoming load | Skipped (26 Nov 2026): needs more than one record per run – the one-record rule allows only the INV-REG-02 issue; runs in inv-regression.spec.js on a project cleared for more records | More than one write per run, or a project cleared for it. | User |
| INV-REG-03 | Loss | Skipped (26 Nov 2026): needs more than one record per run – the one-record rule allows only the INV-REG-02 issue; runs in inv-regression.spec.js on a project cleared for more records | More than one write per run, or a project cleared for it. | User |
| INV-REG-04 | Return reduces stock and writes back to Procurement | Skipped (26 Nov 2026): needs more than one record per run – the one-record rule allows only the INV-REG-02 issue; runs in inv-regression.spec.js on a project cleared for more records | More than one write per run, or a project cleared for it. | User |
| INV-REG-05 | Manual incoming on a partial schedule | Skipped (26 Nov 2026): needs more than one record per run – the one-record rule allows only the INV-REG-02 issue; runs in inv-regression.spec.js on a project cleared for more records | More than one write per run, or a project cleared for it. | User |
| INV-REG-06 | Incoming beyond the scheduled quantity rejected | Skipped (26 Nov 2026): a defect would save a second record (one-record rule); needs approval for a negative write | More than one write per run, or a project cleared for it. | User |
| INV-REG-11 | Move between two locations | Skipped (26 Nov 2026): needs more than one record per run – the one-record rule allows only the INV-REG-02 issue; runs in inv-regression.spec.js on a project cleared for more records | More than one write per run, or a project cleared for it. | User |
| INV-REG-16 | Upload is all-or-nothing | Skipped (26 Nov 2026): needs more than one record per run – the one-record rule allows only the INV-REG-02 issue; runs in inv-regression.spec.js on a project cleared for more records | More than one write per run, or a project cleared for it. | User |
| INV-REG-17 | Upload applies rows top to bottom | Skipped (26 Nov 2026): needs more than one record per run – the one-record rule allows only the INV-REG-02 issue; runs in inv-regression.spec.js on a project cleared for more records | More than one write per run, or a project cleared for it. | User |
| INV-REG-18 | Upload available stock matches the form | Skipped (26 Nov 2026): needs more than one record per run – the one-record rule allows only the INV-REG-02 issue; runs in inv-regression.spec.js on a project cleared for more records | More than one write per run, or a project cleared for it. | User |
| INV-REG-19 | Upload with optional columns blank | Skipped (26 Nov 2026): needs more than one record per run – the one-record rule allows only the INV-REG-02 issue; runs in inv-regression.spec.js on a project cleared for more records | More than one write per run, or a project cleared for it. | User |
| INV-REG-21 | Damaged units counted as received | Skipped (26 Nov 2026): needs more than one record per run – the one-record rule allows only the INV-REG-02 issue; runs in inv-regression.spec.js on a project cleared for more records | More than one write per run, or a project cleared for it. | User |
| INV-REG-25 | Activity date picker | Retired (26 Nov 2026): the new forms have no date field – activities are "Dated today" | Nothing – the control no longer exists. | None |
| INV-REG-14 | Schedule must match the submittal | Covered by INV-REG-13 (the schedule list follows the chosen submittal) | Nothing – the check runs elsewhere (counted there). | None |
| INV-REG-23 | Site isolation | Covered by INV-SMK-03 (site filter); NeuralRays_Demo has a single site | Nothing – the check runs elsewhere (counted there). | None |
| INV-REG-10 | Move to the same location rejected | Skipped (26 Nov 2026): NeuralRays_Demo has one storage location – "To location" offers only it; a defect would save a second record | A second storage location on NeuralRays_Demo. | User / Client |

**International Shipments (3)**

| Test case | What it checks | Reason recorded | Needed to run | Owner |
|---|---|---|---|---|
| SHP-REG-05 | Status change persists | Skipped (25 Nov 2026): no manual status control since the redesign – status updates come from ShipsGo tracking; awaiting client confirmation (question 9) | Confirmation that status now comes only from ShipsGo (question 9). | Client |
| SHP-REG-06 | Status change confirmation | Skipped (25 Nov 2026): no manual status control since the redesign – status updates come from ShipsGo tracking; awaiting client confirmation (question 9) | Confirmation that status now comes only from ShipsGo (question 9). | Client |
| SHP-REG-07 | Flag from Procurement listed once | Runs in Procurement regression (PL-REG-INT-02) | Nothing – the check runs elsewhere (counted there). | None |

**Enterprise (4)**

| Test case | What it checks | Reason recorded | Needed to run | Owner |
|---|---|---|---|---|
| ENT-REG-02 | Supplier Inbox lists run items | Skipped (25 Nov 2026): Supplier Inbox removed – /supplier-inbox opens My Work; awaiting client question 3 | Decision: retire these cases or move them to My Work (question 3). | Client |
| ENT-SMK-02 | Supplier Inbox loads | Skipped (25 Nov 2026): Supplier Inbox was removed – /supplier-inbox opens My Work; awaiting client question 3 (retire or move to My Work) | Decision: retire these cases or move them to My Work (question 3). | Client |
| TC-14B | Supplier Inbox lists the run delivery under Pending Pre-Shipping Checklists | Skipped (25 Nov 2026): Supplier Inbox removed – /supplier-inbox opens My Work; awaiting client question 3 | Decision: retire these cases or move them to My Work (question 3). | Client |
| ENT-REG-01 | Enterprise counts match Procurement | Covered by the existing Enterprise suite (BUGS-325 oracle) | Nothing – the check runs elsewhere (counted there). | None |

**Document Management (3)**

| Test case | What it checks | Reason recorded | Needed to run | Owner |
|---|---|---|---|---|
| DOC-REG-16 | Scan Procore for EPDs | Procore link (external system); not executed | Access to the external system (Procore / TheLink). | None |
| DOC-REG-11 | PO validation with a valid PO | Needs a sample PO with line items (Q-DOC-3, Q-PL-13) | A sample PO with line items and a sample BOM (Q-DOC-3). | Dev team / Client |
| DOC-REG-12 | BOM validation | Needs a sample BOM (Q-DOC-3) | A sample PO with line items and a sample BOM (Q-DOC-3). | Dev team / Client |

## 6. Gaps from the dev review and how the tests cover them

_Source: "SCP Business Logic and Flow Changes" (develop 12 Nov → 23 Nov, read-only review of 26 Nov). 18 gaps: 6 high, 7 medium, 5 low. "Planned" = test case written into the plan, not automated yet._

| # | Severity | Gap | Covered by our tests | Next step |
|---|---|---|---|---|
| 1 | High | An NCR hold does not touch stock; held material can still be issued or moved | No | Planned: raise an NCR on a received line, then try Issue / Move of the held quantity (needs Inventory to load for the load project – NRVC_Hall fails with "Couldn't load inventory.") |
| 2 | High | Reject and return leaves goods in stock and in Received QTY; the replacement adds Required again | Yes – NPE-GAP-02a / NPE-GAP-02 (27 Nov) | Confirmed: Received stays 16, Required 20,020 → 20,022 (defect candidate) |
| 3 | High | Correcting a received delivery does not update the load line, discrepancies or accepted quantity | Yes – NPE-GAP-03 (27 Nov, last case of the chain) | Confirmed: "Correct delivery" (QTY 3 → 4) is saved on the component (3/1/1 → 4/2/1) but the load and its discrepancies do not change; the only warning is about the First Delivery Inspection (defect candidate) |
| 4 | High | The old delivery screen still receives the same components under older rules, without checking open loads | Yes – NPE-GAP-04 (27 Nov) | Confirmed: "Log delivery" accepted while LD-0014 / LD-0015 were open, no warning (defect candidate) |
| 5 | High | Excel import writes required quantity, unit, ROJ, PO and lead time without validation or status update | Yes – XI-GAP-05 (27 Nov, NeuralRays_Demo, Preview only) | Confirmed for quantity 0 and lead time −2 weeks; −5, unknown unit and 31/02 are rejected (defect candidate) |
| 6 | High | FDIs and discrepancies after a receipt are best effort; failures only logged | Yes – every run checks the discrepancies (NPE-SMK-04) and inspections of its own receipt | Keep |
| 7 | Medium | Spade actions check role names, not SSO permission codes | Yes – PM-REG-ROLE-05/08, T508-18 fail | Dev decision |
| 8 | Medium | A trade can receive its own load and resolve its own discrepancies | Yes – NPE-GAP-08 (27 Nov, read-only) | Confirmed: the Subcontractor sees the load’s discrepancies and "Raise NCR" is enabled on Short delivery and Damaged; "Resolve" is not (defect candidate) |
| 9 | Medium | Oldest item used on loads; item units and base units mix | No | Planned: load a material whose item conversion is not 1; compare booked, received and damaged units |
| 10 | Medium | FDI on every received line; message still says "First delivery" | Yes – TC-23B, FDI-REG-01a | Dev decision; update expected results |
| 11 | Medium | Inspection result read from the question text | No | Not automated – renaming shared FDI questions changes shared data |
| 12 | Medium | Email-domain match falls back to the contact-email domain | No | Needs two accounts of different companies sharing a domain (dev team) |
| 13 | Medium | No GRN (ConditionAtDelivery) record for load receipts; two shortage formulas | Yes – NPE-GAP-13 (27 Nov) | Confirmed: a load receipt of 2 (1 damaged) shows as 3 / 1 / 1 on the component page; GRN actions are offered (defect candidate) |
| 14 | Low | CSI division from spec section (routing) vs category (FDI grouping) | No | Planned: submittal whose spec section differs from its category division |
| 15 | Low | Ordered = full required quantity once any PO number exists | Related – question 6 (9 over-ordered PLS submittals) | Dev decision |
| 16 | Low | Unallocated goods not in stock until assigned | Blocked – needs Delivery Management on staging | After DM is connected |
| 17 | Low | Line history finds moves by component and date, not by delivery | No | Planned with gap 1 |
| 18 | Low | Void submittals hidden only in the new views | No | Needs a voided Procore submittal (NeuralRays_Demo) |

**Report numbers that change with the new build (expected results to update):** Management Dashboard spend = received quantity × (price ÷ ordered quantity) (BUGS-596, TC-23/24); Supplier / Subcontractor Issues per Responsible person (BUGS-593, ANV-SUB / ANV-SUP); Lead-time analysis drops negative durations (BUGS-613, ANV-LTA); shipment risk adds a 7-day port-to-site buffer (SHP risk counters); GRN shortage = delivery quantity × conversion − good − damaged, historical values rewritten (BUGS-600, PL-REG-DLV).

## 7. Test updates from the 27 Nov feedback (status)

| Test case | Change | Status |
|---|---|---|
| TC-14 (E2E smoke) | Create or reuse one numeric "Alert Count" custom field ("+ Add Log Fields"), then create the alert on it | Done – runs with the full E2E smoke (Sunday) |
| PL-REG-TAB-05 (P1) | Accept the two "Issues" columns; every other column name unique | Done – passed 27 Nov 12:33 |
| NPE-REG-08 (np-e2e) | Complete the inspection raised by "Work done: request re-inspection" (pass), then check the NCR closes | Done – ran 27 Nov 12:36: inspection raised (6 → 7) and completed, but NCR-014 stayed "Awaiting re-inspection" → new question to the dev team |
| LD-REG-13 (loads) | Retired – covered by NPE-SMK-04 | Done – 27 Nov 12:36 |
| NPE-REG-09 (np-e2e) | Fails as blocked: Delivery Management not connected on staging | Done – 27 Nov 12:36 |
| NPE-REG-05 (np-e2e) | Save load judged after leaving the field (8 s), one attempt only | Done – 27 Nov: Save stayed enabled 8 s after leaving the field (defect reproduced); single attempt from the next run |
| NPE-REG-12 (np-e2e) | Compare with the IST date of the receipt; say when IST and UTC dates are equal | Done – passed 27 Nov (not conclusive at 12:36 IST) |
| TC-23 / TC-24 (E2E smoke) | Expected Dashboard spend = received quantity × (price ÷ ordered quantity) (BUGS-596) | Done – runs with the full E2E smoke (Sunday) |
| DSH-REG-10, PM-REG-FDI-50, PM-REG-ROLE-09 | Run and fail with the question to the dev team instead of skipping | Done – each fails with its question (27 Nov) |
| Gaps 2, 3, 4, 5, 8, 13 (section 6) | New test cases NPE-GAP-02a/02, NPE-GAP-03, NPE-GAP-04, XI-GAP-05, NPE-GAP-08, NPE-GAP-13 | Done – 27 Nov; results in section 6 |
| Gaps 1, 9, 14, 17 (section 6) | Not automated yet | Gaps 1 and 17 need the Inventory tab, which does not load on NRVC_Hall ("Couldn't load inventory."); gaps 9 and 14 need new material / submittal data (a unit conversion other than 1; a spec section that differs from its category) – waiting for your go-ahead to create it |

_All feedback, answers and decisions are kept in this document only – nothing is written to Jira._

_Prepared from the test results of the runs listed under Evidence. Defect candidates and questions are for the dev team to confirm; nothing was written to Jira and nothing was committed._