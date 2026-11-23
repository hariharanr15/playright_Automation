# Procurement Log – Regression Scenarios (Draft for Review)

> **Step-by-step flows (Action → Expected, matching the automated steps):** [PL_REGRESSION_PART1_STEPS.md](steps/PL_REGRESSION_PART1_STEPS.md), [PL_REGRESSION_PART2_STEPS.md](steps/PL_REGRESSION_PART2_STEPS.md), [PL_REGRESSION_PART3_STEPS.md](steps/PL_REGRESSION_PART3_STEPS.md)

Source of truth: [PROCUREMENT_LOG_FUNCTIONAL_DISCOVERY.md](PROCUREMENT_LOG_FUNCTIONAL_DISCOVERY.md). Smoke scenarios ([PL_SMOKE_SCENARIOS.md](PL_SMOKE_SCENARIOS.md)) are assumed to pass first.

## Legend

| Column | Values |
|---|---|
| **Type** | POS positive · NEG negative · BND boundary · INT cross-module integration |
| **Impact** | **R** read-only · **C** client-side only · **M** mutates staging data (approved on NRVC_Hall, see PR-3) |
| **Ev.** | **O** observed 2026-11-02 · **R** product-owner rule · **I** inferred, **unverified – confirm before automating** · **KD** expected failure registered as a known defect |

## Common prerequisites

- PR-1 Project Admin login on NRVC_Hall (PL-SMK-001). Role confirmed by the user, 2026-11-02.
- PR-2 Run-unique tag `<RUN>` (e.g. `PLR<yyyyMMddHHmm>`) in every Spec / Submittal No / PO / reference. **Schedule Id is digits only**, so use a numeric run stamp (e.g. `yyyyMMddHHmmss` + 2-digit index).
- PR-3 Creating records on NRVC_Hall is approved (PM R1, user 2026-11-02). **Delete / Bulk Delete only on records created by the same run** (PL-R2). Trigger Alert may be sent (PL-R1).
- PR-4 Supplier `LG` with materials `43 Inches` and `1.2L Kappa Engine`; site location `Loc X …` on the selected site. Read them at run start; don't hard-code IDs.
- PR-5 Project settings in effect on NRVC_Hall: `grn_required: true`, `pre_shipping_required: true`, project currency INR. **Delivered is reached only through delivery → GRN** (PL-R4).
- PR-6 Shipping Mode: use `Other` (manual entry only, PM booking rule).

Rules referenced: PM **R1–R70** ([PM discovery §1a](PM_FUNCTIONAL_DISCOVERY.md)), Procurement **PL-R1–PL-R6** ([discovery §6.7](PROCUREMENT_LOG_FUNCTIONAL_DISCOVERY.md)).

## Test data generated per run

| Data | How |
|---|---|
| Submittal import file | built from `Download Template` of the same run (header row kept, unique rows appended; `Source = Manual`) |
| Component import file | built from `Download Component Template` (ISO date `yyyy-mm-dd`, Status text, Submittal No of a run submittal) |
| PO PDF | small generated PDF (any valid PDF) |

---

## 1. List, search and filters

| ID | Title | Type | Impact | Steps | Expected | Ev. |
|---|---|---|---|---|---|---|
| PL-REG-LST-01 | Default date range | POS | R | Open the page | Start = today − 1 month, End = today | O |
| PL-REG-LST-02 | Date range filters on Created At | POS | R | Pick Start = today (calendar; the inputs are read-only) | Only submittals created today are listed; a record with a later Date Required but created earlier is excluded | O, PL-R11 |
| PL-REG-LST-03 | Date inputs are read-only | NEG | C | Try typing into Start date | Not editable; the calendar month list stops at the current month | O |
| PL-REG-LST-04 | Search on Enter, ignoring case | POS | R | Type `<run material>` in lower case → Enter | Rows matching Material Name / Spec Description / Submittal No; count updates | O |
| PL-REG-LST-05 | Clear search restores the list | POS | R | Empty search → Enter | Original count | O |
| PL-REG-LST-06 | Status filter single and multiple | POS | R | Tick `Delivered`; then also `Partial Delivery` | Button shows the count (`Status1`, `Status2`); every row has one of the ticked statuses | O |
| PL-REG-LST-07 | Advanced Filter Contains ignores case | POS | R | Supplier Name Contains `lg` → Apply | Same rows as `LG` | O |
| PL-REG-LST-08 | Advanced Filter Clear | POS | R | Clear Filter | Panel closes; count back to the unfiltered value | O |
| PL-REG-LST-09 | Advanced Filter numeric operators | POS | R | `Total Count …` `>=` 5 → Apply | Only rows with value ≥ 5 | I |
| PL-REG-LST-10 | Multiple conditions with brackets | POS | R | Two conditions with `(`…`)` | Combined result; AND/OR selector present | I |
| PL-REG-LST-11 | Only my watched sends watch filters | INT | R | Tick `Only my watched` | Only records of the materials or users assigned to the logged-in user in PM > Watched Materials | O, PL-R8 |
| PL-REG-LST-12 | Hide / show columns | POS | C | Untick `Source` → `Show all` | Column disappears, then returns | O |
| PL-REG-LST-13 | Sort ascending on first click | POS | R | Click `Submittal No` | Rows sorted ascending | O |
| PL-REG-LST-14 | Sort descending on second click | POS | R | Click again | Descending | I |
| PL-REG-LST-15 | Rows per page and pagination | POS | R | 10 → Next → 100 | 10 rows, page 2; at 100 all rows, Next disabled when N ≤ 100 | O |
| PL-REG-LST-16 | Filters reset on reload | POS | R | Set search + status → reload | Defaults restored, project kept | O |
| PL-REG-LST-17 | Deep link to a submittal | POS | R | `goto /procurement-log?submittal=<id>` | Drawer opens on that submittal | O |
| PL-REG-LST-18 | Deep link to a component | POS | R | `goto …&schedule=<id>` | Component view opens | O |
| PL-REG-LST-20 | bulk_edit_log access | ROLE | R | Load page as Project Admin | No 403 on `bulk_edit_log` (PL-R7) | O – 403 today |
| PL-REG-LST-19 | Grid rolls up component data | INT | M | After PL-REG-CMP-02 | Grid Date Required On Site and Status come from the component | O |

## 2. Add Submittal

| ID | Title | Type | Impact | Steps | Expected | Ev. |
|---|---|---|---|---|---|---|
| PL-REG-ADD-01 | Create a submittal with one material | POS | M | Fill the 4 text fields (numeric Schedule Id), supplier `LG`, material `43 Inches` → Add | "Submittal added successfully"; count +1; row shows Source `Manual`, Status `-`, Date Required `-` | O |
| PL-REG-ADD-02 | Required fields | NEG | C | Add with the form empty | 6 required messages (smoke PL-SMK-007); nothing created | O |
| PL-REG-ADD-03 | Schedule Id digits only | NEG | C | Schedule Id `PLR-SCH` → Add | "Only numbers are allowed"; not saved | O |
| PL-REG-ADD-04 | Materials need a supplier | NEG | C | Open `Choose Materials` before choosing a supplier | "No options." | O |
| PL-REG-ADD-05 | Supplier filters materials | POS | C | Choose `LG` | Only LG-mapped materials; `Search…` box | O |
| PL-REG-ADD-06 | Multiple materials, first is primary | POS | M | Pick `43 Inches`, then `1.2L Kappa Engine` → Add | Grid `43 Inches +1`; drawer chip `43 Inches (primary)` | O |
| PL-REG-ADD-07 | Skip for Now stores "Pending" | POS | M | Skip for Now on Spec selection no. | Field shows `Pending`; saved value `Pending` in the Spec Section No column | O |
| PL-REG-ADD-08 | Duplicate Submittal No + Material rejected (case and spaces ignored) | NEG | M | Add again with the Submittal No in lower case + trailing space and the same material | 409 toast "A submittal already exists for Submittal No '…' and Material '…', added on …"; count unchanged | O, R2/R15 |
| PL-REG-ADD-09 | Same Submittal No with a different material allowed | POS | M | Same number, different material | Created | O, PL-R3 |
| PL-REG-ADD-10 | Custom number fields saved | POS | M | Enter `Total Count …` = 7 | Grid shows 7 | O |
| PL-REG-ADD-11 | Spec value fills all Spec Section No columns | POS | M | — | All three `Spec Section No` columns show the Spec value | O (duplicate columns = SCP-DEF-041) |
| PL-REG-ADD-12 | New material from the Add modal | POS | M | `New material` in the modal | Inline material form; material created and selectable | I |

## 3. Edit, Responsible, Flag International, Delete

| ID | Title | Type | Impact | Steps | Expected | Ev. |
|---|---|---|---|---|---|---|
| PL-REG-EDT-01 | Edit submittal | POS | M | ⋮ → Edit → change Spec description → Update | "Submittal updated successfully"; grid updated | O |
| PL-REG-EDT-11 | Update Submittal No | POS | M | Edit → new unique Submittal No → Update | Saved; grid shows the new number (PL-R12) | R |
| PL-REG-EDT-02 | Edit cannot create a duplicate | NEG | M | Edit a run submittal so its Submittal No + Material equals another run submittal | Rejected like Add (409) | **KD SCP-DEF-042** |
| PL-REG-EDT-03 | Assign Responsible (row) | POS | M | ⋮ → Assign Responsible → choose user → Assign | "Responsible user assigned."; Responsible column shows the user; Assign disabled until a user is chosen | O |
| PL-REG-EDT-04 | Bulk Assign Responsible | POS | M | Tick 2 run rows → Assign Responsible | Text "…for the **2** selected submittals, replacing anyone assigned before."; toast "Responsible user assigned to 2 submittal(s)."; selection cleared | O |
| PL-REG-EDT-05 | Flag International | POS/INT | M | ⋮ → Flag International → Country `South Korea`, City → Flag | "Submittal flagged as international shipment."; listed on International Shipments (Risk Dashboard) with Manufacturer / Country | O |
| PL-REG-EDT-06 | Flag International: country required | NEG | C | Flag with Country empty | "Manufacturer country is required." | O |
| PL-REG-EDT-07 | International Shipments shows procurement data | INT | M | After EDT-05 + component ordered | Required Date and status match the component | O – today `-` / `Pending Order` (OBS-PL-19) |
| PL-REG-EDT-08 | Delete submittal (row) | POS | M | ⋮ → Delete → confirm on a run record | "1 submittal(s) will be deleted. Are you sure you want to proceed?" → "1 record(s) deleted."; count −1 | O, PL-R2 |
| PL-REG-EDT-09 | Delete: Cancel keeps the record | NEG | C | ⋮ → Delete → Cancel | Record still listed | I |
| PL-REG-EDT-10 | Bulk Delete | POS | M | Tick 2 run rows (one by one, never select-all) → Bulk Delete → confirm | "2 submittal(s) will be deleted…" → "2 record(s) deleted." | O, PL-R2 |

## 4. Components

| ID | Title | Type | Impact | Steps | Expected | Ev. |
|---|---|---|---|---|---|---|
| PL-REG-CMP-01 | Add Component validation | NEG | C | Add Component → ADD empty | "Date Req. on Site is required", "Quantity is required" | O |
| PL-REG-CMP-02 | Add component with PO → Ordered | POS | M | Date Req, QTY 10, PO no., PO Date, Value → ADD | "Schedule added successfully!"; status `Ordered`; lead time 1; Expected = PO date + 1 week; header Date Req / Required QTY filled | O |
| PL-REG-CMP-03 | Add component without PO → Not Ordered | POS | M | No PO | Status `Not Ordered`; Expected `-`; Pending value includes it | O |
| PL-REG-CMP-04 | Material defaults to primary; UoM from master | POS | C | Open Add Component | Material `<primary> (primary)`; UOM pre-filled read-only | O |
| PL-REG-CMP-05 | Currency default | POS | C | Open Add Component | Currency `Project default (INR)` + 20 currencies | O |
| PL-REG-CMP-06 | Lead Time update | POS | M | Lead Time → 3 + Confirmed → Submit | Lead time 3, `Confirmed`, Expected = PO date + 3 weeks | O |
| PL-REG-CMP-07 | Order (edit component) | POS | M | Order → change QTY → Update | QTY and header Required QTY updated | O (toast says "added", OBS-PL-15) |
| PL-REG-CMP-08 | Update Status cannot set Delivered | NEG | M | Other Actions → Update Status → Delivered + comment → ADD | Delivered shows on both the component and the submittal (PL-R13) | **KD SCP-DEF-046** |
| PL-REG-CMP-09 | Update Status to another status | POS | M | Update Status → `Ordered At Risk` | Status changes; audit entry | I |
| PL-REG-CMP-10 | Trigger Alert | POS | M | Other Actions → Trigger Alert → Send | Pre-filled message "Delivery for Item <m> of Qty (<q>) is expected by <dd-mm-yyyy> ReqOnSiteDate <dd-mm-yyyy>."; "Notification sent successfully"; delivered to subcontractor, supplier and user (PL-R14) | O, PL-R1 |
| PL-REG-CMP-11 | Audit Trail records changes | POS | M | After CMP-02/06/07 | Entries: Created, actual quantity, lead time, confirmed flag, expected delivery, with the user email | O |
| PL-REG-CMP-12 | Select not-confirmed + Set Lead Time (bulk) | POS | M | Select not-confirmed → Set Lead Time 2 + confirmed → Apply | "Lead time updated on N component."; selection cleared | O |
| PL-REG-CMP-13 | Shift ROJ Dates with preview | POS | M | Select not-confirmed → Shift ROJ +7 Calendar days → Preview → Apply | Preview "1 will move · 0 skipped … old → new (+7d)"; "Required-on-site date updated on 1 component."; component date moved | O |
| PL-REG-CMP-14 | Shift ROJ skips committed lines unless ticked | BND | M | Shift with an Ordered line, box unticked | Ordered line "skipped" in preview | I |
| PL-REG-CMP-15 | Shift ROJ Apply disabled before Preview | NEG | C | Enter offset | `Apply` disabled until Preview | O |
| PL-REG-CMP-16 | Upload PO File | POS | M | Expanded row → Upload PO File → PDF → Upload | "File uploaded successfully!"; file name shown under `po File` | O (also "Could not extract any line items…", Q-PL-13) |
| PL-REG-CMP-17 | Upload PO File without a file | NEG | C | Upload with no file | "Missing file." | O |
| PL-REG-CMP-18 | Delete component | POS | M | Other Actions → Delete → confirm | "No data found" in the component table; header refreshes | O (header stale until reload, OBS-PL-24) |
| PL-REG-CMP-19 | Values and currency symbols | POS | M | After CMP-02 | Header and expanded row show the project currency symbol (₹) consistently | O – `$` shown (OBS-PL-23) |

## 5. Delivery → pre-shipping → GRN

| ID | Title | Type | Impact | Steps | Expected | Ev. |
|---|---|---|---|---|---|---|
| PL-REG-DLV-01 | Log full delivery | POS | M | Component view → + Log Delivery → Expected date, Location, Item, QTY = remaining → Add | Delivery row (Conversion Factor, Base UOM QTY, Expected date, Actual `-`); actions Pre Shipping Info / files / QR / Edit | O |
| PL-REG-DLV-19 | Remaining Qty subtracts logged deliveries | BND | C | Log 4 of 10 → open Log Delivery again | Required Remaining Qty = 6 (PL-R15) | O – shows 10 |
| PL-REG-DLV-02 | Over-delivery blocked | NEG | C | QTY > remaining | "Quantity exceeds available quantity (<n> <uom>)"; dialog stays open | O |
| PL-REG-DLV-03 | Checklist: every answer and comment required | NEG | C | Confirm with answers missing; then with comments missing | "Answer every Questions"; "Please complete all fields before submitting." | O |
| PL-REG-DLV-04 | Checklist: NO blocks Confirm | NEG | C | Answer one question `NO` | Confirm Checklist disabled; `NA` re-enables | O, PL-R16 (all answers must be YES) |
| PL-REG-DLV-05 | Confirm checklist | POS | M | All YES + comments + supplier comment → Confirm | "Shipping Details updated successfully!" (+ notifications); `Approve Pre-Shipping Checklist` available | O |
| PL-REG-DLV-06 | Approve checklist | POS | M | Approve dialog → note → Approve | "Checklist Generated Successfully!"; icon `Approved`; answers shown read-only | O |
| PL-REG-DLV-07 | Reject and resubmit | POS | M | Approve dialog → Reject → click `Rejected` → Confirm → Approve | Icon `Rejected`; "Update Pre-Shipping Details" pre-filled; resubmit + approve works | O (reject needs no note) |
| PL-REG-DLV-08 | Set actual delivery date | POS | M | Edit → Actual Date → Update | Actual date shown; Good QTY = delivered; actions `Update Shipping Info`, `Update Delivery Condition`, `Generate GRN` appear | O (needs reload after approval, OBS-PL-26) |
| PL-REG-DLV-09 | Shipping info | POS | M | Mode `Other`, reference, from, comments → Add | "Shipping Details updated successfully!" | O |
| PL-REG-DLV-10 | Delivery conditions (full) | POS | M | Good = QTY → Add | "Delivery Conditions updated successfully!"; QTY Received = QTY; Value Delivered = value | O |
| PL-REG-DLV-11 | Generate GRN → Delivered | POS/INT | M | Generate GRN | "GRN Generated Successfully!"; `GRN_<delivery id>.pdf`, size > 0; component `Delivered`; header Received = Required, Pending ₹0 | O |
| PL-REG-DLV-12 | Delivered row shows Actual Delivery Date | INT | M | After DLV-11 | Grid Actual Delivery Date = delivery actual date | **KD SCP-DEF-043**, PL-R6 |
| PL-REG-DLV-13 | Partial delivery → Partial Delivery | POS | M | Deliver 4 of 10 → checklist → approve → actual date → shipping → Good 3 / Damage 1 → GRN | Component `Partial Delivery`; Received 4 (damage counted, PL-R16), Rejected 1, Remaining 6 | O |
| PL-REG-DLV-14 | Shortage calculated per delivery | BND | M | In DLV-13 conditions | Shortage = delivery QTY − Good − Damage (= 0) | **KD SCP-DEF-044** |
| PL-REG-DLV-15 | Item Name may list other materials | POS | C | Add Delivery → Item Name | List includes other materials (e.g. `50 Inches`) | O, PL-R5 |
| PL-REG-DLV-16 | Component header UoM | POS | M | After DLV-13, reload | Required / Received QTY show the UoM | O – `undefined` (OBS-PL-31) |
| PL-REG-DLV-17 | QR label downloads | POS | R | QR Label → PNG sticker; PDF sheet (copies 30) | `submittal-<id8>-qr.png` / `.pdf` downloaded | O |
| PL-REG-DLV-18 | Files tab | POS | R | Component view → Files | Files list (PO file, GRN, checklist PDF) | O – tab does not switch (OBS-PL-30) |

## 6. Materials on a submittal

| ID | Title | Type | Impact | Steps | Expected | Ev. |
|---|---|---|---|---|---|---|
| PL-REG-MAT-01 | Create new material from the drawer | POS | M | `+` → Category, Material Name `<RUN> Material`, UOM, Lead Time → Add | "Material added successfully." + "Material added to submittal."; chip shown | O (name title-cased, OBS-PL-32) |
| PL-REG-MAT-02 | New material validation | NEG | C | Add empty | Required messages for Category, Material Name, UOM, Lead Time | I |
| PL-REG-MAT-03 | Add existing material | POS | M | `+ Add material` → pick | Chip added | I |
| PL-REG-MAT-04 | Remove material | POS | M | × on a non-primary chip | "Material removed from submittal" (no confirmation) | O |

## 7. Row alerts (alert rules)

| ID | Title | Type | Impact | Steps | Expected | Ev. |
|---|---|---|---|---|---|---|
| PL-REG-ALR-01 | Create alert rule | POS | M | ⋮ → Alert → Add Alert → Field `Total Count …`, `>=` 5, message, user → Submit | "Alert created successfully!"; row with condition, value, message, user, Status `Created` | O |
| PL-REG-ALR-02 | Create alert validation | NEG | C | Submit empty | Client-side required messages | O – server error "Failed to create alert…" (OBS-PL-28) |
| PL-REG-ALR-03 | Edit alert rule | POS | M | Edit → change value | Updated | I |
| PL-REG-ALR-04 | Delete alert rule | POS | M | Delete Alert | Removed | I |
| PL-REG-ALR-05 | Alert fires | INT | M | Rule met → next day | Alert on Management Dashboard (two-phase: daily batch, PM rule) | I |

## 8. Import / Export

| ID | Title | Type | Impact | Steps | Expected | Ev. |
|---|---|---|---|---|---|---|
| PL-REG-IMP-01 | Import submittal | POS | M | File from the run's template, 1 unique row, `Source = Manual` → Upload → confirm | "Upload Confirmation… <file>"; "File Uploaded Successfully"; row listed | O |
| PL-REG-IMP-02 | Import: Source required | NEG | M | Row with Source empty | "All rows failed validation…"; failure file with `reason`; Bulk Upload Status shows the upload as `Failed` | O – status `-` (**KD SCP-DEF-001**); reason only "Validation error" (OBS-PL-20) |
| PL-REG-IMP-03 | Import: duplicate Submittal No + Material | NEG | M | Row duplicating a run submittal | Row fails as a duplicate | I (R2) |
| PL-REG-IMP-04 | Import: multiple rows | POS | M | 2 rows | "All 2 submittals uploaded successfully." | O |
| PL-REG-IMP-05 | Import component | POS | M | Component file (ISO date, Status `Not Ordered`, run Submittal No) | "All 1 components uploaded successfully."; component listed | O |
| PL-REG-IMP-06 | Import component: unknown Submittal No | NEG | M | Non-existent Submittal No | Row fails | I |
| PL-REG-IMP-07 | Templates follow the log configuration | INT | R | Download Template | Custom fields present as columns | O |
| PL-REG-IMP-08 | Export follows filters | POS | R | Filter → Export | Row count = `N items` | O |
| PL-REG-IMP-09 | Export columns match the grid | POS | R | Export | Same columns as the grid incl. custom fields | **KD SCP-DEF-047** |
| PL-REG-IMP-10 | Upload history | INT | R | After IMP-01/02 | Bulk Upload Status lists both uploads with uploader and files | O |

## 9. Cross-module

| ID | Title | Type | Impact | Steps | Expected | Ev. |
|---|---|---|---|---|---|---|
| PL-REG-INT-01 | Delivered component in FDI | INT | M | After DLV-11 | Component appears in First Delivery Inspections (audit trail shows FDI events) | O (audit trail), I (listing) |
| PL-REG-INT-02 | International Shipments listing | INT | M | EDT-05 | Listed once even if flagged twice | O |
| PL-REG-INT-03 | Received quantity in Inventory | INT | M | After DLV-11 | Good QTY reaches Inventory at the delivery location | I – verify in Inventory discovery |
| PL-REG-INT-04 | Procurement Log Configuration drives columns | INT | R | Compare Log Configuration enabled fields with grid columns | Same set and order | O (PM §5.13) |

---

## Coverage summary

| Area | Scenarios |
|---|---|
| 1 List / filters | 20 |
| 2 Add Submittal | 12 |
| 3 Edit / Responsible / Flag / Delete | 11 |
| 4 Components | 19 |
| 5 Delivery → GRN | 19 |
| 6 Materials | 4 |
| 7 Alert rules | 5 |
| 8 Import / Export | 10 |
| 9 Cross-module | 4 |
| **Total** | **104** (+ 18 smoke) |

Known defects expected to fail: SCP-DEF-042 (EDT-02), SCP-DEF-043 (DLV-12), SCP-DEF-044 (DLV-14), SCP-DEF-046 (CMP-08), SCP-DEF-047 (IMP-09), SCP-DEF-001 (IMP-02 status), SCP-DEF-041 (duplicate columns). Scenarios marked **I** need confirmation before automation.

## Suggested execution order
1. Smoke 001–018.
2. LST (read-only).
3. ADD-01 → ADD-06/09 create the run submittals (A: single material, B: multi-material, C: same number + other material).
4. CMP on A (with PO) and on a Not Ordered component (CMP-03, 12, 13).
5. DLV full flow on A → DLV-11/12; partial flow on a second component → DLV-13/14.
6. EDT (Responsible, Flag, Edit duplicate), MAT, ALR.
7. IMP (create two extra run submittals for Bulk Delete).
8. EDT-08/10 deletes on records created in step 7 only.
