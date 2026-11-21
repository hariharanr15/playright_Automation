# Automation Gap Review – Procurement Log (PL) and Inventory Management (INV)

| Item | Value |
|---|---|
| Project | `C:\Users\VC\20-04-2026\SCP` (SCP – Supply Chain Planner), Playwright POM + `tests/pm-flow` runner |
| Review type | Read-only. No code, data or config changed, no tests run |
| Execution evidence | `status.tsv` (latest status per ID; PL regressions last run 2026-11-20, PL/INV smoke last run 2026-11-10) plus per-attempt errors read from `reports/pm-flow/*/results.json` |
| Requirement source | `docs/requirements/requirements-register.json`: 92 `REQ-PL-*` and 51 `REQ-INV-*` (A confirmed · B observed · C AI-suggested · D pending client · E blocked) |
| Discovery sources | `PL-FD` = `docs/functional-discovery/PROCUREMENT_LOG_FUNCTIONAL_DISCOVERY.md`; `INV-FD` = `INVENTORY_FUNCTIONAL_DISCOVERY.md`; `PL_REG` = `PL_REGRESSION_SCENARIOS.md`; `INV_SCN` = `INV_SCENARIOS.md`; `TICKET_REG` = `TICKET_REGRESSION_SCENARIOS.md`; E2E = `E2E_SMOKE_SCENARIOS_STEPS.md` |

**Status rules used in this report**

- A feature is **Passing** only when at least one linked test is `Passed` in `status.tsv` and no linked test is `Failed` or `Known Defect`. "Never run" and `Skipped` don't count as complete.
- **Failing** means at least one linked test is `Failed` (this takes precedence). **Known Defect (KD)** means at least one linked test is `Known Defect` and none is `Failed`.
- **None (weak)** means the linked test passes but its code doesn't assert the requirement. These are demoted on code evidence, with the reason in the row.
- Every Passing row on a B, C or D requirement is marked "unconfirmed exp.", because it passes against an expectation the client hasn't confirmed.
- Rows prefixed `DISC-` are features proven by the discovery docs that have no register entry.

**Uncertain items are marked _(uncertain)_.**

---

# PART 1 – PROCUREMENT LOG

## A. Feature inventory (PL)

Screens covered: Procurement Log list (`/procurement-log`) with its toolbar, Advanced Filter, grid, Columns panel and row ⋮ menu · Add/Edit Submittal modal · Submittal detail drawer (`?submittal=`) with materials bar, details header, components table, bulk component actions and Audit Trail · Component view (`&schedule=`) with deliveries, the pre-shipping checklist and its approval, Edit Delivery, Shipping Info, Delivery Conditions, GRN, QR Label and the Files tab · Row Alert panel · Import (submittal/component) and Export · cross-module links to FDI, Inventory and International Shipments.

| Screen › Feature/action | Requirement (category) | Evidence source | Existing test IDs (latest status) | Latest status (effective) |
|---|---|---|---|---|
| Listing › Date range | REQ-PL-001 [A] The list opens with a default date range of the last month | PL-FD §2.1, §6.10 PL-R11 | PL-REG-LST-01 (Passed), PL-REG-LST-03 (Passed), PL-SMK-002 (Passed) | Passing |
| Listing › Date range | REQ-PL-002 [D] The date range filters submittals by their Created At date | PL-FD §2.1, OBS-PL-11 | PL-REG-LST-02 (Passed) | Passing – unconfirmed exp. (D) |
| Listing › Search | REQ-PL-003 [B] User searches submittals by text and clears the search | PL-FD §2.1 | PL-REG-LST-04 (Passed), PL-REG-LST-05 (Passed), PL-FLOW-03 (Passed), PL-FLOW-04 (Passed) | Passing – unconfirmed exp. (B) |
| Listing › Status filter | REQ-PL-004 [B] User filters submittals by one or more statuses | PL-FD §2.1, §4 | PL-REG-LST-06 (Passed), PL-SMK-004 (Passed), TC-11 (Passed) | Passing – unconfirmed exp. (B) |
| Listing › Advanced Filter | REQ-PL-005 [B] User builds an Advanced Filter with Contains and clears it | PL-FD §2.2 | PL-REG-LST-07 (Passed), PL-REG-LST-08 (Passed), PL-SMK-005 (Passed), PL-FLOW-05 (Passed) | Passing – unconfirmed exp. (B) |
| Listing › Advanced Filter | REQ-PL-006 [D] User filters on a custom number field with >= | PL-FD §2.2; PL_REG LST-09 | PL-REG-LST-09 (Failed) | Failing |
| Listing › Advanced Filter | REQ-PL-007 [C] User combines two conditions with brackets and AND/OR | PL-FD §2.2 | PL-REG-LST-10 (Passed) | Passing – unconfirmed exp. (C) |
| Listing › Only my watched | REQ-PL-008 [A] User ticks "Only my watched" to see only watched records | PL-FD §2.1, PL-R8 | PL-REG-LST-11 (Passed), PL-FLOW-06 (Passed) | Passing |
| Listing › Columns, sorting, paging | REQ-PL-009 [B] User hides/shows columns, sorts and pages through the grid | PL-FD §2.3 | PL-REG-LST-12 (Passed), PL-REG-LST-13 (Passed), PL-REG-LST-14 (Passed), PL-REG-LST-15 (Passed), PL-SMK-003 (Passed), PL-SMK-006 (Passed), PL-FLOW-08 (Passed) | Passing – unconfirmed exp. (B) |
| Listing › Page state | REQ-PL-010 [B] Filters reset after a reload and the project stays selected | PL-FD §1 | PL-REG-LST-16 (Passed), PL-SMK-001 (Passed) | Passing – unconfirmed exp. (B) |
| Listing › Deep links | REQ-PL-011 [B] A link opens a specific submittal or component directly | PL-FD §2.5, §6.7(1) | PL-REG-LST-17 (Passed), PL-REG-LST-18 (Passed), PL-SMK-010 (Passed), PL-SMK-012 (Passed) | Passing – unconfirmed exp. (B) |
| Listing › Access | REQ-PL-012 [A] Procurement Log loads without calling endpoints the role cannot use | PL-FD §7 OBS-PL-2, PL-R7 | PL-REG-LST-20 (Passed) | Passing |
| Listing › Site selection | REQ-PL-013 [D] The selected site stays selected while the user works in Procurement Log | PL-FD §1; INV-FD OBS-INV-12 (code note) | TC-25 (Failed) | Failing; Mapped test TC-25 is a Reporting test (mapping error?) |
| Listing › Grid roll-up | REQ-PL-014 [B] The grid row shows the date required and status rolled up from components | PL-FD §6.4 | PL-REG-LST-19 (Passed), PL-REG-ADD-01 (Passed) | Passing – unconfirmed exp. (B) |
| Listing › Grid columns | REQ-PL-015 [B] Grid columns, templates and export follow the Procurement Log Configuration | PL-FD §2.3, §5.1 | PL-REG-INT-04 (Passed), PL-REG-ADD-11 (Passed), PL-REG-IMP-07 (Passed), PL-SMK-015 (Passed) | Passing – unconfirmed exp. (B) |
| Add Submittal › Validation | REQ-PL-016 [B] User tries to add a submittal with empty required fields | PL-FD §3 | PL-REG-ADD-02 (Passed), PL-SMK-007 (Passed), PL-FLOW-07 (Passed) | Passing – unconfirmed exp. (B) |
| Add Submittal › Skip for Now | REQ-PL-017 [D] User skips a required field with "Skip for Now" | PL-FD §3, §6.1 OBS-PL-12 | PL-REG-ADD-03 (Passed), PL-REG-ADD-07 (Passed) | Passing – unconfirmed exp. (D) |
| Add Submittal › Supplier and materials | REQ-PL-018 [B] User picks a supplier and its materials; the first material picked is primary | PL-FD §6.1 | PL-REG-ADD-04 (Passed), PL-REG-ADD-05 (Passed), PL-REG-ADD-06 (Passed), TC-08 (Passed) | Passing – unconfirmed exp. (B) |
| Add Submittal › Duplicates | REQ-PL-019 [A] A submittal with the same Submittal No and Material is rejected; a different material is allowe | PL-FD §6.1, PL-R3 | PL-REG-ADD-08 (Passed), PL-REG-ADD-09 (Passed), PL-REG-IMP-03 (Passed) | Passing |
| Edit Submittal › Duplicates | REQ-PL-020 [A] Editing a submittal cannot create a Submittal No + Material pair that already exists | PL-FD §6.2 OBS-PL-13 | PL-REG-EDT-02 (Known Defect) | Known Defect |
| Edit Submittal | REQ-PL-021 [A] User edits a submittal, including its Submittal No | PL-FD §6.2, PL-R12 | PL-REG-EDT-01 (Passed), PL-REG-EDT-11 (Passed) | Passing |
| Add Submittal › Stored case | REQ-PL-022 [D] The Submittal No keeps the letter case it was typed in | PL-FD §6.1, Q-PL-8 | – | None |
| Add Submittal › Custom fields | REQ-PL-023 [B] Custom number fields entered on Add are saved | PL-FD §6.1 | PL-REG-ADD-10 (Passed) | Passing – unconfirmed exp. (B) |
| Materials on a submittal | REQ-PL-024 [D] User creates a new material from the Add modal or the drawer | PL-FD §6.8 OBS-PL-32 | PL-REG-ADD-12 (Passed), PL-REG-MAT-01 (Passed), PL-REG-MAT-02 (Passed) | Passing – unconfirmed exp. (D) |
| Materials on a submittal | REQ-PL-025 [B] User adds an existing material or removes a non-primary material chip | PL-FD §6.3, §6.8 | PL-REG-MAT-03 (Passed), PL-REG-MAT-04 (Passed), TC-09 (Passed) | Passing – unconfirmed exp. (B) |
| Row actions › Assign Responsible | REQ-PL-026 [B] User assigns a Responsible user to one or several submittals | PL-FD §6.5 | PL-REG-EDT-03 (Passed), PL-REG-EDT-04 (Passed), PL-SMK-008 (Passed), TC-12 (Passed) | Passing – unconfirmed exp. (B) |
| Row actions › Flag International | REQ-PL-027 [D] User flags a submittal as an international shipment | PL-FD §6.5 OBS-PL-18 | PL-REG-EDT-05 (Passed), PL-REG-EDT-06 (Passed), PL-SMK-018 (Passed), PL-REG-INT-02 (never run) | Passing – unconfirmed exp. (D) |
| Row actions › Flag International | REQ-PL-028 [D] International Shipments shows the component Required Date and the procurement status | PL-FD §6.5 OBS-PL-19 | PL-REG-EDT-07 (Failed) | Failing |
| Row actions › Delete | REQ-PL-029 [B] User deletes one or several submittals after confirmation | PL-FD §6.7 Deletes, PL-R2 | PL-REG-EDT-08 (Passed), PL-REG-EDT-09 (Passed), PL-REG-EDT-10 (Passed), PL-SMK-008 (Passed) | Passing – unconfirmed exp. (B) |
| Components › Add | REQ-PL-030 [B] User adds a component with a PO and it becomes Ordered | PL-FD §6.4 | PL-REG-CMP-01 (Passed), PL-REG-CMP-02 (Passed), PL-REG-CMP-04 (Passed), PL-REG-CMP-05 (Passed), TC-10 (Passed), SMK-09 (Passed) | Passing – unconfirmed exp. (B) |
| Components › Add | REQ-PL-031 [B] User adds a component without a PO and it stays Not Ordered | PL-FD §6.8 | PL-REG-CMP-03 (Passed) | Passing – unconfirmed exp. (B) |
| Submittal header › Values | REQ-PL-032 [D] The submittal header shows the value of ordered items and the value pending delivery | PL-FD §2.5, §6.4 OBS-PL-14 | – | None |
| Components › Lead time | REQ-PL-033 [B] User updates and confirms the lead time of a component | PL-FD §6.4 | PL-REG-CMP-06 (Passed), TC-10 (Passed), SMK-10 (Passed) | Passing – unconfirmed exp. (B) |
| Components › Order (edit) | REQ-PL-034 [D] User edits a component through Order and sees a correct message | PL-FD §6.4 OBS-PL-15 | PL-REG-CMP-07 (Passed) | Passing – unconfirmed exp. (D) |
| Components › Update Status | REQ-PL-035 [D] User sets a component to Delivered through Update Status | PL-FD §6.4 OBS-PL-16, PL-R4/R13 | PL-REG-CMP-08 (Known Defect) | Known Defect |
| Components › Update Status | REQ-PL-036 [D] User changes a component status to another value such as Ordered At Risk | PL-FD §6.4 (7 statuses) | PL-REG-CMP-09 (Failed) | Failing |
| Components › Trigger Alert | REQ-PL-037 [A] User sends a delivery alert for a component | PL-FD §6.4, §6.7, PL-R14 | PL-REG-CMP-10 (Passed) | Passing |
| Components › Audit Trail | REQ-PL-038 [B] The component audit trail records each change with the user | PL-FD §2.6, §6.4 | PL-REG-CMP-11 (Passed), PL-SMK-011 (Passed) | Passing – unconfirmed exp. (B) |
| Components › Audit Trail | REQ-PL-039 [A] FDI changes have their own audit trail | PL-FD §2.6, PL-R10 | – | None |
| Components › Bulk actions | REQ-PL-040 [B] User sets the lead time on all not-confirmed components at once | PL-FD §6.8 | PL-REG-CMP-12 (Passed) | Passing – unconfirmed exp. (B) |
| Components › Shift ROJ Dates | REQ-PL-041 [B] User shifts required-on-site dates with a preview | PL-FD §6.8 | PL-REG-CMP-13 (Passed), PL-REG-CMP-14 (Passed), PL-REG-CMP-15 (Passed) | Passing – unconfirmed exp. (B) |
| Components › PO file | REQ-PL-042 [D] User uploads a PO PDF for a component | PL-FD §6.8, Q-PL-13 | PL-REG-CMP-16 (Passed), PL-REG-CMP-17 (Passed) | Passing – unconfirmed exp. (D) |
| Components › Delete | REQ-PL-043 [D] User deletes a component and the submittal header refreshes | PL-FD §6.7 Deletes OBS-PL-24 | PL-REG-CMP-18 (Failed) | Failing |
| Components › Currency | REQ-PL-044 [A] All values on a submittal use the project currency symbol | PL-FD §6.7(10) OBS-PL-23 | PL-REG-CMP-19 (Failed) | Failing |
| Delivery › Log Delivery | REQ-PL-045 [B] User logs a delivery and cannot exceed the available quantity | PL-FD §6.7(2), §6.8 | PL-REG-DLV-01 (Passed), PL-REG-DLV-02 (Passed), PL-SMK-013 (Passed), TC-10B (Passed), SMK-11 (Passed) | Passing – unconfirmed exp. (B) |
| Delivery › Remaining quantity | REQ-PL-046 [A] Required Remaining Qty subtracts quantities already logged | PL-FD §6.8, PL-R15 | PL-REG-DLV-19 (Failed) | Failing |
| Delivery › Item Name | REQ-PL-047 [A] A delivery Item Name may list other materials | PL-FD §6.7(2), PL-R5 | PL-REG-DLV-15 (never run), PL-REG-DLV-01 (Passed) | None (weak); Weak (DLV-01 asserts only >0 items) |
| Delivery › Pre-shipping checklist | REQ-PL-048 [B] The supplier must answer every question and comment before confirming | PL-FD §6.7(3) | PL-REG-DLV-03 (Passed) | Passing – unconfirmed exp. (B) |
| Delivery › Pre-shipping checklist | REQ-PL-049 [A] Any NO answer blocks confirming the checklist | PL-FD §6.8, PL-R16 | PL-REG-DLV-04 (Passed) | Passing |
| Delivery › Pre-shipping checklist | REQ-PL-050 [D] An NA answer and the missing reason when Confirm is disabled | PL-FD §6.8 OBS-PL-25 | PL-REG-DLV-04 (Passed) | None (weak) – unconfirmed exp. (D); Not covered (DLV-04 never selects NA) |
| Delivery › Pre-shipping approval | REQ-PL-051 [B] The checklist is confirmed and then approved | PL-FD §6.7(3-4) | PL-REG-DLV-05 (Passed), PL-REG-DLV-06 (Passed) | Passing – unconfirmed exp. (B) |
| Delivery › Pre-shipping approval | REQ-PL-052 [D] The approver rejects a checklist and the supplier resubmits | PL-FD §6.8 Reject path | PL-REG-DLV-07 (Passed) | Passing – unconfirmed exp. (D) |
| Delivery › Pre-shipping setting | REQ-PL-053 [D] The pre-shipping checklist is required on NRVC_Hall | PL-FD §6.4 (pre_shipping_required) | PL-REG-DLV-03 (Passed), PL-REG-DLV-04 (Passed), PL-REG-DLV-05 (Passed), PL-REG-DLV-06 (Passed), PL-REG-DLV-07 (Passed) | Passing – unconfirmed exp. (D) |
| Supplier/subcontractor approval | REQ-PL-054 [A] Supplier completes the pre-shipping checklist and the subcontractor approves it | E2E_SMOKE_SCENARIOS_STEPS TC-15/16 | TC-15 (Passed), TC-16 (Passed), SMK-13 (Passed), SMK-15 (Passed), TC08 (Passed), TC09 (Passed), E2E-SMK-07 (Passed) | Passing |
| Supplier/subcontractor approval | REQ-PL-055 [A] A newly created supplier's user sees its submittal and completes the checklist | E2E_SMOKE_SCENARIOS_STEPS E2E-SMK-06 | E2E-SMK-06 (Known Defect), E2E-SMK-06B (Passed) | Known Defect |
| Supplier/subcontractor approval | REQ-PL-056 [E] A newly invited subcontractor activates from the invite e-mail and approves | E2E_SMOKE_SCENARIOS_STEPS TC09/TC-16 | TC09 (Passed), E2E-SMK-07 (Passed), TC-16 (Passed) | Passing |
| Supplier/subcontractor approval (BUGS-155) | REQ-PL-057 [A] A subcontractor from another organisation may only approve the checklist | TICKET_REG §BUGS-155 | T155-01 (Skipped), T155-02 (Skipped), T155-SETUP (Failed), T155-SIGNIN (Skipped) | Failing |
| Supplier/subcontractor approval (BUGS-155) | REQ-PL-058 [E] A subcontractor in the supplier's organisation may fill the checklist | TICKET_REG §BUGS-155 | T155-03 (Skipped) | Skipped/Blocked |
| Delivery › Actual date | REQ-PL-059 [D] User sets the actual delivery date after approval | PL-FD §6.7(5), §6.8 OBS-PL-26 | PL-REG-DLV-08 (Passed) | Passing – unconfirmed exp. (D) |
| Delivery › Status | REQ-PL-060 [B] The submittal becomes Delivered only after every booking has an actual date and GRN | PL-FD §6.7(9); E2E TC-17B | TC-17B (Passed), TC-17 (Passed), SMK-17 (Passed), SMK-18 (Passed) | Passing – unconfirmed exp. (B) |
| Delivery › Shipping info | REQ-PL-061 [B] User records shipping details for a delivery | PL-FD §6.7(6) | PL-REG-DLV-09 (Passed), TC-17 (Passed) | Passing – unconfirmed exp. (B) |
| Delivery › Delivery conditions | REQ-PL-062 [D] User records Good/Damage quantities for a full delivery | PL-FD §6.7(7) OBS-PL-21 | PL-REG-DLV-10 (Passed), TC-17 (Passed) | Passing – unconfirmed exp. (D) |
| Delivery › Damaged quantity | REQ-PL-063 [A] Damaged quantity counts towards Value Delivered and QTY Received | PL-FD §6.8, PL-R16 | PL-REG-DLV-13 (Failed) | Failing |
| Delivery › Shortage | REQ-PL-064 [D] Shortage on a partial delivery is calculated from the delivered quantity | PL-FD §6.8 OBS-PL-27 | PL-REG-DLV-14 (never run), PL-REG-DLV-13 (Failed) | Failing |
| Delivery › GRN | REQ-PL-065 [A] Generating the GRN completes the delivery and produces a correct GRN PDF | PL-FD §6.7(8-9) | PL-REG-DLV-11 (Skipped), PL-REG-DLV-11b (Passed), TC-17B (Passed) | Passing |
| Delivery › Actual Delivery Date in grid | REQ-PL-066 [A] A Delivered submittal shows its Actual Delivery Date in the grid | PL-FD §6.7(9), PL-R6 | PL-REG-DLV-12 (Skipped), TC-17B (Passed), SMK-19 (Known Defect), TC10 (Known Defect), E2E-SMK-08 (Known Defect) | Known Defect |
| Component view › Header | REQ-PL-067 [D] The component header shows quantities with the unit of measure | PL-FD §6.8 OBS-PL-31 | PL-REG-DLV-16 (Failed) | Failing |
| Component view › QR label | REQ-PL-068 [D] User prints a QR label from the component view | PL-FD §6.8 QR Label | PL-REG-DLV-17 (Passed), PL-SMK-014 (Passed) | Passing – unconfirmed exp. (D) |
| Component view › Files | REQ-PL-069 [D] User opens the Files tab of a component | PL-FD §6.8 OBS-PL-30 | PL-REG-DLV-18 (Failed) | Failing |
| Component view › Deliveries | REQ-PL-070 [C] Over and Returned quantities on a delivery | PL-FD §6.9; INV-FD §3.3 | – | None |
| Row actions › Alert rules | REQ-PL-071 [B] User creates, edits and deletes an alert rule on a submittal | PL-FD §6.8 Row Alert | PL-REG-ALR-01 (Passed), PL-REG-ALR-03 (Passed), PL-REG-ALR-04 (Passed), PL-SMK-017 (Passed), TC-14 (Passed) | Passing – unconfirmed exp. (B) |
| Row actions › Alert rules | REQ-PL-072 [D] Create Alert checks required fields before sending | PL-FD §6.8 OBS-PL-28 | PL-REG-ALR-02 (Failed) | Failing |
| Row actions › Alert rules | REQ-PL-073 [E] A met alert rule raises an alert on the Management Dashboard the next day | PL-FD §6.9 | PL-REG-ALR-05 (Skipped) | Skipped/Blocked |
| Import › Submittals | REQ-PL-074 [B] User imports submittals from the downloaded template | PL-FD §5.1, §6.6 | PL-REG-IMP-01 (Passed), PL-REG-IMP-04 (Passed) | Passing – unconfirmed exp. (B) |
| Import › Submittals | REQ-PL-075 [D] An import with Source empty tells the user which field is missing | PL-FD §6.6 OBS-PL-20 | PL-REG-IMP-02 (Passed) | Passing – unconfirmed exp. (D) |
| Import › Upload history | REQ-PL-076 [A] Every upload is listed in Bulk Upload Status with its outcome | PL-FD §6.6 | PL-REG-IMP-10 (Passed), PL-REG-IMP-02 (Passed) | Passing |
| Import › Unknown references | REQ-PL-077 [C] A component import row with an unknown Submittal No is rejected | PL_REG IMP-06 (I) | PL-REG-IMP-06 (Passed) | Passing – unconfirmed exp. (C) |
| Import › Components | REQ-PL-078 [B] User imports components from the component template | PL-FD §5.2, §6.6 | PL-REG-IMP-05 (Passed), PL-SMK-015 (Passed) | Passing – unconfirmed exp. (B) |
| Components › Bulk upload | REQ-PL-079 [C] User bulk-uploads components from the submittal drawer | PL-FD §2.5, §6.9 | – | None |
| Export | REQ-PL-080 [B] Export downloads the filtered list | PL-FD §2.1, §5.3 | PL-REG-IMP-08 (Passed), PL-SMK-016 (Passed), TC-11 (Passed) | Passing – unconfirmed exp. (B) |
| Export | REQ-PL-081 [A] Export has the same columns as the grid, including custom fields | PL-FD §5.3, PL-R9 | PL-REG-IMP-09 (Known Defect) | Known Defect |
| Bulk Edit | REQ-PL-082 [B] User bulk-edits Spec Description on several submittals, confirms, then rolls back a second edit | E2E_SMOKE_SCENARIOS_STEPS TC-13 | TC-13 (Passed) | Passing – unconfirmed exp. (B) |
| Cross-module › FDI | REQ-PL-083 [A] The first delivery of a new material creates one FDI record | PL-FD §2.6; FDI-R1 | PL-REG-INT-01 (Passed), TC-20 (Passed) | Passing |
| Cross-module › Inventory | REQ-PL-084 [C] Received quantity reaches Inventory at the delivery location | INV-FD §2, §3.2 | PL-REG-INT-03 (Passed) | None (weak) – unconfirmed exp. (C); Weak (INT-03 asserts row contains "4") |
| Edit Submittal › Supplier/primary material (BUGS-517) | REQ-PL-085 [A] Supplier and primary material can change while the submittal has no components | TICKET_REG §BUGS-517 | T517-01 (Passed), T517-02 (Passed), T517-SETUP (Passed) | Passing |
| Edit Submittal › Supplier/primary material (BUGS-517) | REQ-PL-086 [A] A new supplier that does not supply a component material is rejected and nothing changes | TICKET_REG §BUGS-517 | T517-03 (Passed), T517-10 (never run) | Passing |
| Edit Submittal › Supplier/primary material (BUGS-517) | REQ-PL-087 [A] Supplier is locked once a PO or delivery exists, also at the API | TICKET_REG §BUGS-517 | T517-04 (Passed), T517-05 (Passed), T517-17 (Passed) | Passing |
| Edit Submittal › Supplier/primary material (BUGS-517) | REQ-PL-088 [A] Changing the supplier asks for confirmation and Cancel saves nothing | TICKET_REG §BUGS-517 | T517-06 (Passed), T517-07 (never run) | Passing |
| Edit Submittal › Supplier/primary material (BUGS-517) | REQ-PL-089 [A] Confirming a supplier change resets component lead times and logs it | TICKET_REG §BUGS-517 | T517-08 (Passed), T517-09 (never run) | Passing |
| Edit Submittal › Supplier/primary material (BUGS-517) | REQ-PL-090 [A] The primary material cannot change while a component uses it | TICKET_REG §BUGS-517 | T517-11 (Passed), T517-12 (Passed) | Passing |
| Edit Submittal › Supplier/primary material (BUGS-517) | REQ-PL-091 [A] Other fields stay editable on a locked submittal | TICKET_REG §BUGS-517 T517-18 | T517-18 (never run) | None |
| Bulk Edit › Supplier (BUGS-517) | REQ-PL-092 [A] Bulk Edit of supplier/primary material follows the same rules with one confirmation and Roll Ba | TICKET_REG §BUGS-517 T517-13..16 | T517-13 (Skipped), T517-14 (Skipped), T517-15 (Skipped), T517-16 (Skipped) | Skipped/Blocked |
| List › Help link | DISC-PL-01 Help link → voyagecontrol.com/support-procurementlog | PL-FD §1 | – | None |
| Grid › column scroll arrows | DISC-PL-02 Left/right arrows scroll columns | PL-FD §2.3 | – | None |
| Grid › pagination | DISC-PL-03 Rows per page 10/25/50, Previous/Next/page numbers | PL-FD §2.3 | PL-REG-LST-15 covers only 100 (Passed) | None (10/25/50 and Next not asserted) |
| Drawer › Audit Trail filters | DISC-PL-04 Audit Trail date range, Search, "All Fields" | PL-FD §2.6 | – | None |
| List › Advanced Filter | DISC-PL-05 Operators = != < > <=, Remove condition | PL-FD §2.2 | – | None |
| Import › confirmation | DISC-PL-06 "Upload Confirmation" → Cancel | PL-FD §6.6 | – | None |
| Component view › Edit Delivery | DISC-PL-07 Edit a delivery (QTY/expected date) before approval | PL-FD §6.7(2) | – (DLV-08 edits only the actual date) | None |
| Component view › delivery row | DISC-PL-08 Per-delivery "files" and "Print / download QR label" actions | PL-FD §6.7(2) | – | None |
| Drawer › Shift ROJ Dates | DISC-PL-09 Working-days basis, negative offset, "Also move committed lines" ticked | PL-FD §6.8 | – | None |
| Drawer › Set Lead Time | DISC-PL-10 Apply disabled until a value is entered | PL-FD §6.8 | – | None |
| Row › Assign Responsible | DISC-PL-11 "Assign" disabled until a user is chosen; Cancel | PL-FD §6.5 | PL-REG-EDT-03 (Passed) _(uncertain: the disabled state isn't asserted in code)_ | None |
| Add Component › Currency | DISC-PL-12 Override currency (20 currencies) | PL-FD §6.4 | – | None |
| Shipping Info › mode | DISC-PL-13 Shipping Mode "Vc Booking System" | PL-FD §6.7(6) | – (blocked: no booking link, R24) | Blocked |
| Toolbar › bulk without selection | DISC-PL-14 Red toasts for Assign/Bulk Delete with no rows selected | PL-FD §2.1 | PL-SMK-008 (Passed) | Passing – unconfirmed exp. (B) |
| Drawer › open/close | DISC-PL-15 Row click opens the drawer; the chevron closes it and removes `?submittal=` | PL-FD §2.5 | PL-SMK-010 (Passed) | Passing – unconfirmed exp. (B) |

Register-mapping issues found while building the table:
- `REQ-PL-013` (site selection persists) is mapped to `TC-25`, which is the E2E "Detailed execution report generated" test (module Reporting). The mapping looks wrong _(uncertain)_.
- `REQ-PL-050` (NA answer) is mapped to `PL-REG-DLV-04`, but that test only switches YES→NO→YES (`pl-regression-3.spec.js:385-388`) and never selects NA.
- `PL-REG-DLV-15` and `PL-REG-INT-02` have no result rows of their own. They run only as steps inside DLV-01 (`:338`) and EDT-07 (`:531`).
- `PL-REG-DLV-14` exists only in `PL_REG`, with no code. Its check is folded into DLV-13.
- `T517-07`, `T517-09` and `T517-10` have no result rows (they are probably folded into T517-06, T517-08 and T517-03). `T517-18` isn't automated.

## B. Coverage summary (PL) – counted

| Measure | Count |
|---|---|
| Features evidenced | **107**: 92 register requirements + 15 DISC features |
| Register requirements by category | A 29 · B 30 · C 5 · D 25 · E 3 |
| **Passing** (effective) | **64**: 62 REQ + 2 DISC. Of the 62 REQ: A 17 · B 30 · C 2 · D 12 · E 1 (REQ-PL-056, passes only when YOPmail isn't blocked). **45 of the 62 pass against an unconfirmed expectation (B/C/D/E)** |
| With ≥1 passing linked test (raw, any status mix) | 67 REQ |
| **Failing** | **13** REQ: A 4 (REQ-PL-044, 046, 057, 063) · D 9 (006, 013, 028, 036, 043, 064, 067, 069, 072) |
| **Known Defect** | **5** REQ: A 4 (020, 055, 066, 081) · D 1 (035) |
| **Skipped / Blocked** | **3** REQ (058 E, 073 E, 092 A) + 1 DISC (DISC-PL-13) = **4** |
| **None** (no test, or weak test) | **21**: 9 REQ (6 with no test: 022, 032, 039, 070, 079, 091; 3 weak: 047, 050, 084) + 12 DISC |
| Confirmed (A) requirements fully passing | **17 of 29 (59%)** |
| PL test IDs in `status.tsv` | 158. Never run but referenced: PL-REG-DLV-14, DLV-15, INT-02 (step only), T517-07/09/10/18 |

## C. Gap test cases (PL) – prioritised

Priority: **H** confirmed rule (A) not proven, or a core receipt chain broken · **M** observed behaviour, data integrity, negatives · **L** UX or cosmetic.

### C.1 Existing tests that are failing, known-defect or skipped (original IDs kept)

#### PL-REG-DLV-19 – Required Remaining Qty subtracts logged deliveries · H
- **Module & functionality:** Procurement Log › Component view › + Log Delivery.
- **Business purpose:** Stop over-booking a component. A user must see what is still open after earlier bookings.
- **Preconditions:** Project Admin on NRVC_Hall. Run submittal with an Ordered component of QTY 12. One delivery of 4 already logged, not yet received.
- **Test data:** Run tag `PLT<stamp>`, new material `Auto Fdi <stamp>`.
- **Steps:**
  1. Open the component view.
  2. Click "+ Log Delivery".
  3. Read "Required Remaining Qty".
  4. Close the dialog.
- **Expected:** 8 (12 − 4) (PL-R15).
- **Existing automation:** `pl-regression-3.spec.js:353-362`. Failed 14 of 14 runs (observed "12 Pieces").
- **Missing automation work:** None in the script. The behaviour is a deterministic product failure against a confirmed rule, but it isn't in `config/scp-known-defects.js`. Raise or register a defect so the result shows as KD, not Failed.
- **Clarity:** **A** (REQ-PL-046).

#### PL-REG-DLV-13 (+ PL-REG-DLV-14) – Partial delivery with damage · H
- **Module & functionality:** Delivery → checklist → GRN, and Delivery Conditions.
- **Business purpose:** Receipt quantities and values must be right for partial and damaged deliveries.
- **Preconditions:** Run submittal A with a 43 Inches component of QTY 10 and a PO. Pre-shipping and GRN required.
- **Test data:** Good 3, Damage 1, delivery QTY 4.
- **Steps:**
  1. Log a delivery of 4.
  2. Answer the checklist all YES and approve it.
  3. Reload, then set the actual date.
  4. Add shipping info.
  5. Set conditions Good 3 / Damage 1.
  6. Generate the GRN.
  7. Reload the drawer.
- **Expected:**
  - The component is "Partial Delivery".
  - QTY Received is 4 and Value Delivered includes the damaged unit (PL-R16, **A**).
  - Shortage: **Not confirmed – needs client answer.** Observed: 6, computed from the component quantity. SCP-DEF-044 proposes 0.
- **Existing automation:** `pl-regression.spec.js:157-168` via `pl-flow.js:142-194`. Latest result Failed: a script failure at `pl-flow.js:155-156`, where the row with "Pre Shipping Info" wasn't found. The earlier result was KD (SCP-DEF-044). The A-rule (damage counts as received) is never asserted.
- **Missing automation work:**
  - Split the A assertion (QTY Received / Value Delivered) from the Shortage KD.
  - Give DLV-14 its own result ID.
  - Make the chain step single-attempt (see D-F2).
- **Clarity:** A (REQ-PL-063) and D (REQ-PL-064).

#### PL-REG-DLV-11 / PL-REG-DLV-12 – Second delivery completes the component; the grid shows the Actual Delivery Date · H
- **Module & functionality:** Delivery → GRN → Delivered → grid.
- **Business purpose:** The delivered status and date must reach the log that management reads.
- **Preconditions:** DLV-13 done (4 of 10 received).
- **Test data:** Delivery QTY 6.
- **Steps:**
  1. Run the delivery chain for 6.
  2. Reload and read the component status.
  3. Open the Procurement Log, search the submittal and read "Actual Delivery Date".
- **Expected:** The status is Delivered (PL-R4) and the grid shows the actual date (PL-R6).
- **Existing automation:** `pl-regression.spec.js:169-189`. Both Skipped in the latest run because DLV-13 failed. DLV-12 is KD SCP-DEF-043 when it runs.
- **Missing automation work:** Make them independent of DLV-13: create their own fully delivered component so the A-rule is evaluated every run.
- **Clarity:** A (REQ-PL-065, REQ-PL-066).

#### PL-REG-CMP-19 – Values use the project currency symbol · H
- **Module & functionality:** Submittal drawer › expanded component row.
- **Business purpose:** Correct currency on commercial values.
- **Preconditions:** INR project (NRVC_Hall). Component worth 1000.
- **Test data:** –
- **Steps:**
  1. Open the submittal.
  2. Expand the component row.
  3. Read "Value".
- **Expected:** "₹1,000.00" (the project currency, R58).
- **Existing automation:** `pl-regression-3.spec.js:320-328`. Failed 14 of 14 (observed "$1,000.00").
- **Missing automation work:**
  - Register the defect, since OBS-PL-23 isn't registered yet.
  - Also assert the header values after a reload (OBS-PL-23 shows `$` there).
  - Add a second project with a non-INR currency to prove the rule is per project.
- **Clarity:** A (REQ-PL-044).

#### PL-REG-EDT-02 (KD SCP-DEF-042) · PL-REG-IMP-09 (KD SCP-DEF-047) · PL-REG-CMP-08 (KD SCP-DEF-046) · H/M
- **Module & functionality:**
  - EDT-02: Edit Submittal must reject a duplicate Submittal No + Material.
  - IMP-09: Export must match the grid columns.
  - CMP-08: Update Status → Delivered.
- **Expected:**
  - EDT-02 and IMP-09: as written (A, PL-R3/R15 and PL-R9).
  - CMP-08: **Not confirmed – needs client answer.** PL-R4 says Delivered is reached only through GRN; PL-R13 says Delivered must show on both pages. Observed: 200 OK but the status doesn't change.
- **Existing automation:** All three exist and return KD.
- **Missing automation work:**
  - Keep them as KD.
  - For IMP-09, add separate asserts for the raw status, Excel-serial dates and the empty `Supplier` column (OBS-PL-9) so a partial fix is visible.
- **Clarity:** A (REQ-PL-020, REQ-PL-081). D (REQ-PL-035): the two rules conflict.

#### T155-SETUP / T155-SIGNIN / T155-01 / T155-02 / T155-03 – BUGS-155 subcontractor checklist rules · H
- **Module & functionality:** Pre-shipping checklist access by organisation.
- **Business purpose:** A subcontractor from another organisation may only approve.
- **Preconditions:**
  - A subcontractor account (other organisation) for T155-01/02.
  - A subcontractor in the supplier's organisation for T155-03.
- **Test data:** Run submittal with a delivery awaiting the checklist.
- **Steps:** Follow TICKET_REG §BUGS-155.
- **Expected:**
  - Other organisation: can't fill the checklist, can approve it.
  - Same organisation: can fill it.
- **Existing automation:** `tickets-regression.spec.js:855-890`. T155-SETUP Failed (5 of 12). T155-01/02 Skipped as a result. T155-03 Skipped (blocked by data).
- **Missing automation work:**
  - Stabilise setup: it reuses the delivery chain, see D-F1/F2.
  - Provide the same-organisation supplier.
- **Clarity:** A (REQ-PL-057). E (REQ-PL-058).

#### T517-13 / 14 / 15 / 16 – Bulk Edit of supplier / primary material · H
- **Expected:** One batch confirmation; locked rows are skipped; Roll Back restores the supplier, lead times and Confirmed state (BUGS-517).
- **Existing automation:** Skipped. The Bulk Edit column picker and pending-update log need a discovery pass.
- **Missing automation work:** Do the discovery, then automate the four cases and T517-18 below. The Bulk Edit framework already exists in E2E TC-13.
- **Clarity:** A (REQ-PL-092).

#### T517-18 – Other fields stay editable on a supplier-locked submittal · H
- **Preconditions:** A submittal with a PO (supplier locked).
- **Steps:**
  1. Open Edit.
  2. Change Spec description.
  3. Click Update.
  4. Reload.
- **Expected:** Saved; the supplier is still locked (BUGS-517).
- **Existing automation:** None.
- **Missing automation work:** Add it to `tickets-regression.spec.js` alongside T517-04.
- **Clarity:** A (REQ-PL-091).

#### PL-REG-CMP-09 – Update Status to another status (Ordered At Risk) · M
- **Steps:**
  1. Open Other Actions › Update Status.
  2. Choose "Ordered At Risk" and enter a comment.
  3. Click ADD.
  4. Reopen the submittal.
- **Expected:** **Not confirmed – needs client answer.** Observed: the status doesn't change (same silent no-op as OBS-PL-16).
- **Existing automation:** `pl-regression-3.spec.js:296-307`. Failed 14 of 14.
- **Missing automation work:** Reclassify as pending client (D), not Failed, until the rule is answered.
- **Clarity:** D (REQ-PL-036).

#### PL-REG-CMP-18 – Delete component · M
- **Steps:**
  1. Open Other Actions › Delete.
  2. Confirm.
- **Expected:** **Not confirmed – needs client answer** on whether the header refreshes without a reload. Observed: the component is removed, but the header stays stale until a reload (OBS-PL-24).
- **Existing automation:** `pl-regression-2.spec.js:331-341`. Failed 5 of 7 ("expected 0 component rows, received 1").
- **Missing automation work:**
  - Assert that the specific deleted component disappears, not "0 rows". _(uncertain: the remaining row may be a second component on the same submittal.)_
  - Add a header check.
- **Clarity:** D (REQ-PL-043).

#### PL-REG-DLV-16 · PL-REG-DLV-18 · PL-REG-ALR-02 · PL-REG-LST-09 · PL-REG-EDT-07 – Failing against pending-client expectations · M
- **DLV-16:** the header UoM shows "12 undefined" (OBS-PL-31).
- **DLV-18:** the Files tab doesn't switch (OBS-PL-30).
- **ALR-02:** an empty Create Alert submit gives a server error (OBS-PL-28).
- **LST-09:** `>= 7` on a custom number field returns 0 rows although the run row holds 7.
- **EDT-07:** International Shipments shows Required Date "-" and "Pending Order" (OBS-PL-19).
- **Expected:** **Not confirmed – needs client answer** for all five. The observed behaviour is listed above.
- **Existing automation:** All exist and fail on every run. DLV-16 also flips 7 times (see D).
- **Missing automation work:** After the client answers, register each as KD or fix the expectation. For LST-09, confirm the custom-field selection isn't picking the wrong one of the 4 "Total Count" columns (`:141`) _(uncertain)_.
- **Clarity:** D (REQ-PL-067, 069, 072, 006, 028).

#### PL-REG-ALR-05 – Alert fires after the daily batch · M
- **Expected:** An alert appears on the Management Dashboard the next day (R25).
- **Existing automation:** Skipped (two-phase test needed).
- **Missing automation work:** A phase-2 spec that looks for the rule created on the previous day by its run tag.
- **Clarity:** E (REQ-PL-073).

#### E2E-SMK-06 (KD SCP-DEF-048) / TC-16 (YOPmail) – New supplier and subcontractor sign-in · M
- **Existing automation:**
  - E2E-SMK-06 is KD.
  - TC-16, TC-17 and TC-17B flip because YOPmail shows a Cloudflare check (REQ-PL-056 E).
- **Missing automation work:** Use a test mailbox or an activation-link API (client question).
- **Clarity:** A (REQ-PL-055). E (REQ-PL-056).

### C.2 New gap test cases (PL)

#### GAP-PL-001 – Delivery Item Name lists materials other than the component's · H
- **Module & functionality:** Add Delivery › Item Name.
- **Business purpose:** PL-R5 allows a delivery item to be another material.
- **Preconditions:** A component of 43 Inches. The supplier also supplies 50 Inches.
- **Test data:** 43 Inches, 50 Inches.
- **Steps:**
  1. Open the component view.
  2. Click "+ Log Delivery".
  3. Open "Choose Item Name".
- **Expected:** The list contains 43 Inches and at least one other material, for example 50 Inches (PL-R5).
- **Existing automation:** Only `pl-regression-3.spec.js:341-343` (asserts that the list has more than 0 items).
- **Missing automation work:** Assert that another material is present. Give DLV-15 its own result.
- **Clarity:** A (REQ-PL-047).

#### GAP-PL-002 – Trigger Alert reaches subcontractor, supplier and user · H
- **Module & functionality:** Component › Trigger Alert.
- **Business purpose:** Delivery chasers must reach external parties.
- **Preconditions:**
  - An Ordered component.
  - A supplier user and a subcontractor user who can sign in.
- **Test data:** Run component.
- **Steps:**
  1. Send Trigger Alert.
  2. Sign in as the supplier and check Alerts/Notifications.
  3. Repeat as the subcontractor.
  4. Repeat as the sender.
- **Expected:** All three receive the notification (PL-R14). **How to verify receipt is not confirmed**: REQ-PL-037 question. Observed: `to_whom: "subcontractor"` with `subcontractor_ids: null`.
- **Existing automation:** PL-REG-CMP-10 checks only the "Notification sent successfully" toast.
- **Missing automation work:** Add a recipient check once the client says how to verify it.
- **Clarity:** A (rule) / D (verification method) – REQ-PL-037.

#### GAP-PL-003 – "Only my watched" returns only watched records · H
- **Preconditions:** In PM > Watched Materials, the signed-in user watches material X and not material Y. Run submittals exist for X and Y.
- **Steps:**
  1. Tick "Only my watched".
  2. Search for the run tag.
- **Expected:** The X submittal is listed and the Y submittal isn't (PL-R8).
- **Existing automation:** PL-REG-LST-11 only checks that `watched_only=1` is sent (`pl-regression-3.spec.js:170-176`).
- **Missing automation work:** Watch-assignment setup and a result assertion.
- **Clarity:** A (REQ-PL-008).

#### GAP-PL-004 – Role and permission matrix for Procurement Log actions · H
- **Module & functionality:** Add/Edit/Delete/Import/Export/Bulk Edit/Assign/Flag/PO upload by role.
- **Business purpose:** Stop unauthorised changes to procurement data.
- **Preconditions:** An account for each role (Project Admin with and without "Procurement Log: Bulk Edit", supplier, subcontractor, any read-only role).
- **Steps:** For each role, open the Procurement Log and attempt each toolbar, row and component action.
- **Expected:** **Not confirmed – needs client answer.** Observed:
  - A Project Admin without Bulk Edit gets a 403 on `bulk_edit_log` (PL-R7 says that 403 is a defect).
  - TC-13 runs Bulk Edit as Project Admin.
  - PO: Apply/Validate permissions are missing (Q-PL-13).
- **Existing automation:** None, except PL-REG-LST-20 (the 403 check).
- **Missing automation work:** A role matrix spec and accounts.
- **Clarity:** D (REQ-PL-082 question, Q-PL-13).

#### GAP-PL-005 – Pre-shipping checklist with an NA answer · M
- **Steps:**
  1. Answer all questions YES except one NA.
  2. Fill every comment.
  3. Try Confirm.
- **Expected:** **Not confirmed – needs client answer.** PL-R16 says every answer must be YES. Observed: NA allows Confirm (PL-FD §6.8).
- **Existing automation:** None. REQ-PL-050 is mis-mapped to DLV-04.
- **Missing automation work:** Add an NA branch to DLV-04.
- **Clarity:** D (REQ-PL-050).

#### GAP-PL-006 – Delete guards on submittals and components with deliveries or a GRN · M
- **Preconditions:** A run submittal with a received GRN. A component with a logged delivery.
- **Steps:**
  1. Row ⋮ › Delete on the delivered submittal.
  2. Other Actions › Delete on a component with a delivery.
  3. Check "Delete Component" in the component view.
- **Expected:** **Not confirmed – needs client answer.** Observed: "Delete Component" is disabled in the component view (PL-FD §6.7(1)). Deleting from the drawer hasn't been tried with deliveries.
- **Existing automation:** None. EDT-08/10 and CMP-18 delete records with no receipts.
- **Missing automation work:** A negative spec. Only run-owned records may be deleted (PL-R2).
- **Clarity:** D (new question).

#### GAP-PL-007 – Submittal import negative matrix · M
- **Preconditions:** The template downloaded in the same run.
- **Test data, one file each:**
  - (a) One valid row and one row with Source empty.
  - (b) Non-numeric Schedule Id.
  - (c) Unknown Supplier Name.
  - (d) Material not supplied by that supplier.
  - (e) Duplicate rows inside the same file.
  - (f) Header column removed.
- **Steps:** Import each file, confirm, then read the toast, the failure file and Bulk Upload Status.
- **Expected:** **Not confirmed – needs client answer**, including whether a mixed file is all-or-nothing. Observed: Source empty → "All rows failed validation…" with reason "Validation error" (OBS-PL-20).
- **Existing automation:** IMP-02 (Source empty) and IMP-03 (duplicate against an existing record) only.
- **Missing automation work:** Generate the data files and assert per row.
- **Clarity:** D (REQ-PL-075 + new).

#### GAP-PL-008 – Component import negatives · M
- **Test data:**
  - DateReqOnSite in dd/mm/yyyy and as text.
  - Status not in the list.
  - QTY 0, −1 and 1.555.
  - PO Date without a PO No.
  - Material that isn't on the submittal.
- **Steps:** Import each file and read the result.
- **Expected:** **Not confirmed – needs client answer.** Observed: an ISO date was accepted, and `failed_file` is returned even with 0 failures (PL-FD §6.6).
- **Existing automation:** IMP-06 (unknown submittal) only.
- **Missing automation work:** Data-driven cases.
- **Clarity:** D/C (REQ-PL-077 + new).

#### GAP-PL-009 – Add Component field boundaries · M
- **Test data:** QTY 0, −1, 1.555 and 9,999,999. Date Req. on Site in the past. PO Date after the ROJ date. Value negative.
- **Steps:**
  1. Add Component with each value.
  2. Click ADD.
- **Expected:** **Not confirmed – needs client answer.** Only the empty-field messages are observed ("Date Req. on Site is required", "Quantity is required").
- **Existing automation:** CMP-01 (empty) only.
- **Missing automation work:** Add the boundary cases.
- **Clarity:** D.

#### GAP-PL-010 – Log Delivery validation and boundaries · M
- **Test data:** QTY 0 and −1; QTY exactly equal to the remaining quantity; Location empty; Item Name empty; expected date in the past.
- **Steps:**
  1. Open "+ Log Delivery".
  2. Enter each value.
  3. Click Add.
- **Expected:**
  - QTY greater than remaining: "Quantity exceeds available quantity (n UoM)" (observed, B).
  - All other cases: **Not confirmed – needs client answer.**
- **Existing automation:** DLV-02 (over-delivery) only.
- **Missing automation work:** Add the cases.
- **Clarity:** B/D (REQ-PL-045).

#### GAP-PL-011 – Delivery Conditions: Good + Damage above the delivered quantity · M
- **Steps:** On a 4-unit delivery, set Good 4 and Damage 1, then click Add.
- **Expected:** **Not confirmed – needs client answer.** Observed: Shortage is read-only and computed from the component quantity (OBS-PL-27).
- **Existing automation:** None.
- **Clarity:** D (REQ-PL-062/064).

#### GAP-PL-012 – GRN PDF content in regression · M
- **Steps:**
  1. After Generate GRN, fetch `GRN_<delivery id>.pdf`.
  2. Read it as text.
- **Expected:** The PDF shows the submittal, material, delivered quantity and actual date. **Field list not confirmed – needs client answer.** Observed: a 4,129-byte PDF.
- **Existing automation:** DLV-11b asserts only the toast. The E2E `e2e-pdf-text.py` reader exists (TC-17B).
- **Missing automation work:** Reuse the E2E PDF reader in regression.
- **Clarity:** A (REQ-PL-065: "correct GRN PDF") / D (contents).

#### GAP-PL-013 – Lead Time dialog boundaries · L
- **Test data:** 0, −1, 1.5, blank and text.
- **Expected:** **Not confirmed – needs client answer.**
- **Existing automation:** CMP-06 (value 3) only.
- **Clarity:** D.

#### GAP-PL-014 – Shift ROJ Dates variants · M
- **Steps:**
  - (a) Working days +5.
  - (b) Calendar −7.
  - (c) "Also move committed lines" ticked with an Ordered line.
- **Expected:**
  - The preview counts and new dates follow the chosen basis, and with the box ticked the Ordered line moves. Observed: the UI text "Offsets the ROJ date on every selected row", "negative pulls in" and "Also move committed lines (PO placed / delivered / in transit)". The working-day calendar is **not confirmed – needs client answer** (holidays and weekends).
- **Existing automation:** CMP-13 (Calendar +7), CMP-14 (box unticked), CMP-15.
- **Clarity:** B (REQ-PL-041).

#### GAP-PL-015 – Set Lead Time: Apply disabled until a value is entered · L
- **Expected:** Apply is disabled while the field is empty (observed, PL-FD §6.8).
- **Existing automation:** CMP-12 (positive) only.
- **Clarity:** B (REQ-PL-040).

#### GAP-PL-016 – Advanced Filter: the other operators and Remove · M
- **Steps:**
  1. Run Submittal No `=` the run number, `!=`, then `<` / `>` / `<=` on a custom number field.
  2. Remove one condition.
- **Expected:** **Not confirmed – needs client answer** (same open question as REQ-PL-006).
- **Existing automation:** LST-07 (Contains) and LST-09 (>=, failing).
- **Clarity:** D.

#### GAP-PL-017 – Pagination · L
- **Steps:**
  1. Set rows per page to 10, then Next and Previous.
  2. Set 50.
- **Expected:**
  - 10 rows on page 2.
  - Next is disabled on the last page.
  - The count is unchanged. (Observed for 100 only.)
- **Existing automation:** LST-15 (100) only.
- **Clarity:** B (REQ-PL-009).

#### GAP-PL-018 – Audit Trail filters, and an audit entry for Update Status · M
- **Steps:**
  1. Open the component Audit Trail.
  2. Filter the date range to today.
  3. Search for "lead".
  4. Set "All Fields" to one field.
  5. Run Update Status, then reopen the Audit Trail.
- **Expected:**
  - The filters narrow the list (observed controls, B).
  - An Update Status entry: **Not confirmed – needs client answer.** Observed: no entry (OBS-PL-17).
- **Existing automation:** CMP-11 (entries exist).
- **Clarity:** B / D (REQ-PL-038).

#### GAP-PL-019 – Import Upload Confirmation → Cancel uploads nothing · L
- **Expected:** No row is added and no new entry appears in Bulk Upload Status (observed dialog, PL-FD §6.6). The outcome is **not confirmed**.
- **Existing automation:** None.
- **Clarity:** B.

#### GAP-PL-020 – Submittal header value fields · M
- **Steps:** Read "Total Value of Ordered Items" and "Value of items Pending" after:
  - adding an Ordered component;
  - a partial GRN;
  - a full GRN.
- **Expected:** **Not confirmed – needs client answer.** Observed: Ordered shows ₹0 until delivery and then equals the delivered value (OBS-PL-14).
- **Existing automation:** None.
- **Clarity:** D (REQ-PL-032).

#### GAP-PL-021 – Submittal No keeps its typed case · L
- **Expected:** **Not confirmed – needs client answer.** Observed: stored trimmed, case kept.
- **Existing automation:** None (ADD-09 creates the record but doesn't assert the case).
- **Clarity:** D (REQ-PL-022).

#### GAP-PL-022 – Drawer "Bulk upload Components" icon · M
- **Steps:** Upload a component file from the drawer icon, with rows for the open submittal and for another submittal.
- **Expected:** **Not confirmed – needs client answer.** Suggested (C): imports only into the open submittal.
- **Existing automation:** None.
- **Clarity:** C (REQ-PL-079).

#### GAP-PL-023 – Over / Returned QTY on a delivery (cross-module with Inventory Return) · M
- **Steps:**
  1. Record an Inventory Return of 1 on the run schedule.
  2. Open the Procurement component view.
- **Expected:** **Not confirmed – needs client answer.** Observed: a "Return" delivery row with Returned QTY 1 (INV-FD §3.3).
- **Existing automation:** INV-REG-04 asserts only that a "Return" row is visible.
- **Missing automation work:** Assert the Returned QTY value. See GAP-INV-002.
- **Clarity:** C (REQ-PL-070).

#### GAP-PL-024 – Flag International: listed once, re-flag, marker · L
- **Expected:**
  - Listed once on International Shipments (observed, PL-FD §6.5).
  - Marker or Unflag: **Not confirmed – needs client answer** (OBS-PL-18).
- **Existing automation:** Step inside EDT-07. EDT-07 fails on the later date check, so INT-02 has no result of its own.
- **Missing automation work:** Give INT-02 its own scenario.
- **Clarity:** D (REQ-PL-027).

#### GAP-PL-025 – Edit Delivery before approval · M
- **Steps:**
  1. After "+ Log Delivery", click Edit.
  2. Change QTY (including above the remaining quantity) and the expected date.
  3. Click Update.
- **Expected:** **Not confirmed – needs client answer.** Observed: an Edit action exists on the delivery row.
- **Existing automation:** None.
- **Clarity:** B/D.

#### GAP-PL-026 – Component currency override · L
- **Steps:** Add a component with Currency USD and Value 100.
- **Expected:** **Not confirmed – needs client answer** (display and conversion).
- **Existing automation:** CMP-05 checks only the default.
- **Clarity:** D.

#### GAP-PL-027 – Low-value UI items (grouped) · L
- **Items:**
  - Help link URL.
  - Column scroll arrows.
  - Per-delivery "files" and QR actions.
  - The date picker month list stops at the current month (extends LST-03).
  - Alert rule conditions `=` / `<=`.
  - The duplicate user names in the alert picker (OBS-PL-29).
- **Expected:** Observed behaviour only (B). Anything beyond it is **not confirmed**.
- **Existing automation:** None.
- **Clarity:** B.

#### GAP-PL-028 – Shipping Mode "Vc Booking System" · L
- **Status:** Blocked. NRVC_Hall has no booking link (R24).
- **Clarity:** E.

#### GAP-PL-029 – FDI audit trail (PL-R10) · L
- **Expected:** The rule only says "there is no FDI audit trail". **Whether one must be built and tested is not confirmed – needs client answer.**
- **Existing automation:** None. It's untestable as written.
- **Clarity:** A (wording) / clarification (REQ-PL-039).

## D. Flaky scripts (PL) – root cause and fix

Selection: IDs with flips ≥ 2, retrysteps > 0, or a mix of passes and fails in `status.tsv`. Across PL, INV, T155 and T517 that is **98 IDs**. The worst are analysed below; the rest are single-run cascades (D-F12).

| # | Test IDs (history) | Root cause (evidence) | file:line | Suggested fix (no code change made) |
|---|---|---|---|---|
| D-F1 | PL-REG-DLV-01, 03, 04, 05, 06, 07, 08, 09, 10, 11b, INT-01, INT-03, DLV-17 (14 runs each; DLV-06 7 pass / 7 fail, flips 6; DLV-07 retrysteps 9) | **Order dependency and shared UI state.** Each delivery scenario continues the previous scenario's open dialog or page: DLV-04 reuses DLV-03's checklist (`:381`) and DLV-05 confirms it (`:393`). DLV-07 runs before DLV-06 (`:398` vs `:428`), so a failed reject leaves DLV-06 with no "Approve" icon ("locator.click timeout" in the 19 Nov and 20 Nov reports). The delivery scenarios have no guard; only INT-01/03 are guarded (`:505`). **Over-broad locator:** `icon()` takes `.last()` of `img[title=…]` with no visibility filter, while the code itself says a hidden copy exists. **App changes absorbed in the script:** answers cleared after a reject (`:407`); the dialog stays open after a resubmit (`:420-425`) | `tests/pm-flow/pl-regression-3.spec.js:332-470`, `:335`, `:398`, `:428`, `:505` | Guard each delivery scenario on its predecessor's status (as at `:505`). Filter `icon()` with `{ visible: true }` as `drow()` does (`:332`). Make DLV-06 and DLV-07 each start from a fresh component view (`componentView()`). Wait for the icon state with `expect.poll` |
| D-F2 | PL-REG-DLV-13, DLV-11, CMP-18, EDT-03, T155-SETUP, T517-SETUP | **The runner retries non-idempotent steps.** Every step gets 2 attempts and recovery only closes dropdowns. A whole delivery chain (`deliverToGrn`) is one step, so attempt 2 starts on the component view with a dialog or delivery already created ("waiting for componentRow" / "Add Delivery" in the attempt-2 errors) | `tests/pm-flow/support/pm-runner.js:104-120`; `support/pl-flow.js:142-194`; `pl-regression.spec.js:159`, `:176` | Pass `{ attempts: 1 }` for mutating steps, or split the chain into idempotent steps that check state before acting |
| D-F3 | PL-REG-LST-02 (15/15 runs needed a retry), ADD-10 (5), LST-06 (5/5), LST-14, LST-19, LST-10 | **Race on grid reload with fixed waits.** `settle()` = networkidle + `waitForTimeout`; `search()` = Enter + fixed 1000 ms. LST-02 reads `before` while the grid still shows the earlier 1-row search, so the first attempt always fails "after ≤ before". ADD-10 reads the cell before the refreshed row renders | `support/pl-flow.js:16`, `:70`; `pl-regression-3.spec.js:106-112`, `:90-93`; `pl-regression-2.spec.js` (LST-06 status click) | Wait for the `list_submittals_by_project_id` response, or poll until the count changes, instead of using fixed sleeps |
| D-F4 | PL-REG-DLV-01/11 (location option timeout), INV-REG-* (see Part 2), TC-25 | **Header site resets after a reload to the newest site** (OBS-INV-12). Location lists follow the header venue. Other suites create sites (`Site T2 Pmr2-…`), so the "newest site" changes between runs. This is a cross-suite shared-data dependency. `keepSite()` is called only in `search()` on the list page and at the start of `deliverToGrn` | `support/pl-flow.js:9`, `:47-48`, `:68`, `:144`; `pl-regression-3.spec.js:339` | Assert the header site before every location-dependent dialog. Pin the site by ID. Fail fast with a clear message when the Location list is empty |
| D-F5 | PL-REG-EDT-03 (5/9), EDT-04 (11/15), TC-12 | **User picker:** "Choose user" shows the first 25 users and its search ignored "@" (fixed 19 Nov). The retry fails because the Assign dialog from attempt 1 is still covering the grid | `support/pl-flow.js:41-46` | Poll until the filtered option appears. Close the Assign dialog in retry recovery |
| D-F6 | PL-REG-DLV-16 (7 pass / 7 fail, flips 7) | The product shows "undefined" deterministically (OBS-PL-31). The passes probably read the header before the data loaded (a fixed 1.5 s `settle`), so they are likely **false passes** _(uncertain)_ | `pl-regression-3.spec.js:479-482` | Wait for a numeric "Required QTY" before asserting |
| D-F7 | PL-REG-INT-03 (8 pass, flips 4) | **Vacuous assertion:** `toContainText('4')` on a row whose material name holds timestamp digits (`NEW_MATERIAL = Auto Fdi <digits>`) can pass whatever the quantity. Flips come from being skipped when the GRN fails | `pl-regression-3.spec.js:22`, `:517` | Read the Inventory column (4th cell) and compare numerically |
| D-F8 | TC-16, TC-17, TC-17B (flips 8), E2E-SMK-07, TC09 | YOPmail Cloudflare human verification blocks reading the invitation e-mail. TC-17 and TC-17B are Blocked whenever TC-16 fails (reports from 17, 18, 19 and 20 Nov) | `tests/pm-flow/support/e2e-kit-v2.js` (mailbox step); fixed `waitForTimeout` at `:73,99,101,110,115,123,223,282` | Use a non-Cloudflare test mailbox or an activation-link API (REQ-PL-056). Replace fixed waits with polling |
| D-F9 | PL-REG-CMP-18 (2/7) | The assertion counts **all** component rows of the submittal, not the deleted one. "Expected 0, received 1" may be a second component or a real non-delete _(uncertain)_ | `pl-regression-2.spec.js:337-340` | Assert that the specific component (date + QTY) is gone; read the header separately |
| D-F10 | PL-REG-LST-14 (12/15) | Earlier failures came from cross-run data sharing the "PLT" prefix across pages (fixed with an order-direction check). The residual risk is server-side paging | `pl-regression-3.spec.js:118-132` | Sort within a run-unique search with at least 2 rows |
| D-F11 | T517-01…17 (flips 2, never failed) | Skipped in one run because T517-SETUP failed (4/12). It's a setup dependency, not a flaky assertion | `tests/pm-flow/tickets-regression.spec.js` (T517 setup) | Make setup single-attempt and idempotent; report skip reasons |
| D-F12 | PL-REG-ADD-03/04/05/12, CMP-01/02/04/05/06/10/12/13/15/16/17, DLV-02, MAT-03 (all 1 fail, flips ≤ 2) | Single-run cascades: one bad run (site reset or setup) failed the whole suite. They aren't intrinsically flaky | – | Covered by the D-F4 and D-F2 fixes |

Deterministic failures that aren't flaky (fail on every run; product behaviour or unconfirmed expectation): PL-REG-ALR-02, CMP-09, CMP-19, DLV-18, DLV-19, EDT-07 (retrysteps 20 because of a mutating double flag), LST-09.

## E. Missing test data and preconditions (PL)

1. **Accounts and roles:**
   - Only Project Admin is used in regression.
   - Needed:
     - A Project Admin *without* "Procurement Log: Bulk Edit" (PL-R7, REQ-PL-082).
     - Supplier users: an existing one plus a newly created one (SCP-DEF-048).
     - A subcontractor in a **different** organisation and one in the **same** organisation as the supplier (T155-03 blocked).
     - Any read-only or other role for GAP-PL-004.
   - A mailbox without Cloudflare (REQ-PL-056).
2. **Projects and settings:**
   - NRVC_Hall (`grn_required` / `pre_shipping_required` true, INR).
   - A second project with another currency (REQ-PL-044, R58).
   - A project with pre-shipping **off**, to cover REQ-PL-053.
   - A project with a Booking System link (GAP-PL-028).
3. **Site and location:**
   - `pl-flow.js:9` defaults to `Warehoust _NR`, while discovery used `Site T2 Pmr2-2611011614`.
   - The header site resets after a reload (OBS-INV-12). A stable, pinned site with known locations is required.
   - `test-data/procurement-log.json` uses `deliveryLocation: "Gate 4"` and `shippingMode: "Vc Booking System"`, which contradicts PR-6 ("use Other").
4. **Supplier and material master:** LG with 43 Inches, 1.2L Kappa Engine and 50 Inches (for PL-R5). Read at run start, not hard-coded (PR-4).
5. **Log configuration:** At least one custom number field (LST-09, ADD-10). Today there are four "Total Count …" fields plus three duplicate "Spec Section No" fields (SCP-DEF-041). Tests pass vacuously when the field is missing (`pl-regression-3.spec.js:92`, `:137`).
6. **Watched materials:** A watch on material X and none on material Y for the test user (GAP-PL-003).
7. **Files:**
   - A PO PDF with extractable line items (Q-PL-13; today "Could not extract any line items").
   - Generated import files for the negative matrix (GAP-PL-007/008).
8. **Time:** The alert two-phase run is next-day (ALR-05).
9. **Data hygiene:** Run records (PLD/PLR/PLT/PLS prefixes) accumulate on NRVC_Hall and affect search, sort and Inventory submittal pickers (`inv-regression.spec.js:22`). A cleanup or archiving policy is needed. Only run-owned records may be deleted (PL-R2).

## F. Clarification questions (PL)

Reused register IDs:

| ID | Question (short) |
|---|---|
| REQ-PL-002 / Q-PL-6 | Should the date range filter on Created At rather than Date Required On Site? |
| REQ-PL-006 | Should numeric operators (>=) on custom fields return every matching row? Today they return 0 rows |
| REQ-PL-007 | Default AND/OR, and do brackets change the evaluation order? |
| REQ-PL-013 | Should the header site stay selected? Also: is the TC-25 mapping correct? |
| REQ-PL-017 | Should Skip for Now be allowed on the digits-only Schedule Id ("Pending")? |
| REQ-PL-022 / Q-PL-8 | Should the Submittal No keep the case it was typed in? |
| REQ-PL-024 | Should a new material keep its exact name (no title case)? |
| REQ-PL-025 | Should removing a material ask for confirmation? May the primary material be removed? |
| REQ-PL-027/028 | Flag marker/Unflag; International Shipments Required Date and status sync |
| REQ-PL-032 | Meaning of "Total Value of Ordered Items" and "Pending" |
| REQ-PL-034 | Should the update message say "updated" rather than "Schedule added"? |
| REQ-PL-035 / Q-PL-9 | Update Status → Delivered: hide it, show a message, or set Delivered (PL-R4 vs PL-R13)? |
| REQ-PL-036 | Should Update Status change to other statuses and write an audit entry? |
| REQ-PL-037 / Q-PL-10 | How can receipt of Trigger Alert by the supplier and subcontractor be verified? |
| REQ-PL-042 / Q-PL-13 | Accepted PO PDF format; PO: Apply/Validate permissions for Project Admin |
| REQ-PL-043 | Should component delete refresh the header immediately? |
| REQ-PL-050 / Q-PL-15 | Should an NA answer block Confirm? Should a disabled Confirm explain why? |
| REQ-PL-052 | Should a reject require a reason? |
| REQ-PL-053 | Who may change the Pre-Shipping setting, and should it stay On? |
| REQ-PL-056 | A test mailbox or activation link without human verification |
| REQ-PL-058 | Which supplier is in the subcontractor's organisation? |
| REQ-PL-059 | Should the actual date be editable straight after approval, without a reload? |
| REQ-PL-062 | Should Delivery Conditions open pre-filled with Good? |
| REQ-PL-064 | Shortage = delivery QTY − Good − Damage? |
| REQ-PL-066 | Do legacy Delivered rows also need their date backfilled? |
| REQ-PL-067/068/069 | UoM in the header; QR label per component; Files tab contents |
| REQ-PL-070 | Source of Over/Returned QTY |
| REQ-PL-072 | Client-side validation in Create Alert |
| REQ-PL-073 | Approval for a two-phase alert test |
| REQ-PL-075/077 | Is Source required, and should failure reasons name the field and the unknown Submittal No? |
| REQ-PL-079 | Does the drawer bulk upload import only into the open submittal? |
| REQ-PL-082 | May a Project Admin without "Bulk Edit" run Bulk Edit? |
| REQ-PL-084 | Should Inventory receive Good only, or Good plus Damage? |

New questions (no register ID yet):

| ID | Question (short) |
|---|---|
| NEW-PL-Q1 | Is a mixed valid/invalid submittal or component import all-or-nothing, or applied per row? |
| NEW-PL-Q2 | May submittals or components with deliveries or a GRN be deleted? |
| NEW-PL-Q3 | What are the validation limits for QTY, Value, Lead Time and dates (zero, negative, decimals, past dates, PO Date after ROJ)? |
| NEW-PL-Q4 | Can Good + Damage exceed the delivered quantity? |
| NEW-PL-Q5 | What is the role and permission matrix for every Procurement Log action? |
| NEW-PL-Q6 | Which fields must the GRN PDF contain? |
| NEW-PL-Q7 | Does "Working days" use a project calendar (holidays)? |
| NEW-PL-Q8 | What should a component with a currency override display? |
| NEW-PL-Q9 | Is an FDI audit trail in scope (PL-R10 wording)? |

## G. Suggested completion order (PL)

1. **Stabilise the shared infrastructure first (D-F2, D-F4, D-F3).** Single-attempt mutating steps, a pinned header site, and response-based waits. This removes most PL and INV flakiness and the cascades (D-F12), so the later results can be trusted.
2. **Fix the delivery-chain structure (D-F1).** Guards, visible locators and independent DLV-06/07. Then re-run DLV-13/11/12, which carry 3 confirmed rules (REQ-PL-063, 065, 066) and feed Inventory (INV-REG-21).
3. **Register or triage the deterministic failures.** DLV-19 and CMP-19 are A-rules failing on every run with no KD entry: raise them as defects. Move the D-category failures (CMP-09, CMP-18, DLV-16, DLV-18, ALR-02, LST-09, EDT-07) to "pending client" so the suite's red is meaningful.
4. **Close the unproven A-rules:** GAP-PL-001 (PL-R5), GAP-PL-002 (PL-R14), GAP-PL-003 (PL-R8), T517-13…18 (BUGS-517 bulk edit and lock), and T155 (data). These are the highest business value per effort.
5. **Fix the vacuous asserts (D-F6, D-F7) and the register mappings** (REQ-PL-013 → TC-25, REQ-PL-050 → DLV-04). Low effort, and they stop false greens.
6. **Negative and boundary packs** (GAP-PL-006…011, 007/008 imports) once NEW-PL-Q1…Q4 are answered. Don't automate them before the answers come back, or they encode guesses.
7. **Permission matrix (GAP-PL-004)** after accounts are provided.
8. **Low-priority UI items** (GAP-PL-013…029), and re-run PL smoke: last executed 10 Nov, only 2 runs.

---

# PART 2 – INVENTORY MANAGEMENT

## A. Feature inventory (INV)

Screens covered: Inventory Management landing grid (`/inventory-management`) with the location filter, Search, Receive booking, Upload and Export · row menu views: Actions (ledger: Opening/Closing Balance, site and location filter, history date range, Add Activity), Location, Submittals, UOM · Add Activity dialog (Incoming Load, Internal Movement, Issue To Construction, Loss, Return) · Upload dialog and template · Receive against booking dialog · Inventory Activity Calendar (REQ-INV-005) · cross-module write-back to the Procurement component view.

| Screen › Feature/action | Requirement (category) | Evidence source | Existing test IDs (latest status) | Latest status (effective) |
|---|---|---|---|---|
| Add Activity › Incoming Load › Procurement write-back | REQ-INV-001 [A] A manual Incoming Load entered in Inventory counts toward the Procurement component Received QT | INV-FD §3.3, §10 INV-R1 | INV-REG-05 (Passed) | None (weak); Not covered (INV-REG-05 checks only the Via Inventory row) |
| Export | REQ-INV-002 [A] Export downloads the material balance list as shown on screen | INV-FD §5, INV-R2 | INV-REG-22 (Failed), INV-SMK-07 (Known Defect) | Failing |
| Add Activity › Return | REQ-INV-003 [A] Return sends received stock back to the supplier: stock goes down and Procurement records the r | INV-FD §3.2-3.3 | INV-REG-04 (Passed) | Passing |
| Receipt from Procurement › Damaged units | REQ-INV-004 [A] Units delivered in damaged condition still enter stock as Incoming Load | INV-FD §2, Q-INV-1; PL-R16 | INV-REG-21 (Skipped), PL-REG-DLV-13 (Failed) | Failing |
| Activity Calendar › Default date range | REQ-INV-005 [A] The Inventory Activity Calendar opens with a default range from today minus two calendar months | Register (confirmed 28 Oct); SCP-DEF-009 | – | None |
| Bulk upload › Upload history | REQ-INV-006 [A] Every Inventory Excel upload (successful or failed) is listed in Bulk Upload Status with upload | Register; PM Bulk Upload Status (R13) | PM-REG-BUS-08 (Known Defect) | Known Defect |
| Stock grid › Landing page | REQ-INV-007 [B] The Inventory page lists every project material with its current stock and offers Receive booki | INV-FD §1 | INV-SMK-01 (Passed) | Passing – unconfirmed exp. (B) |
| Stock grid › Search | REQ-INV-008 [B] User finds a material by name, Material ID or category | INV-FD §1 | INV-SMK-02 (Passed) | Passing – unconfirmed exp. (B) |
| Stock grid › Location filter | REQ-INV-009 [B] User filters the stock list by a site location | INV-FD §1 | INV-SMK-03 (Passed) | Passing – unconfirmed exp. (B) |
| Stock grid › Row views | REQ-INV-010 [B] User opens the ledger, location split, submittals and SKU split of a material | INV-FD §2 | INV-SMK-04 (Passed) | Passing – unconfirmed exp. (B) |
| Receipt from Procurement › Incoming Load | REQ-INV-011 [B] A completed Procurement delivery (GRN) automatically adds the delivered quantity to stock as In | INV-FD §2 | INV-REG-01 (Passed), PL-REG-INT-03 (Passed) | Passing – unconfirmed exp. (B) |
| Add Activity › Required fields | REQ-INV-012 [B] User cannot save an activity without the mandatory fields | INV-FD §3 | INV-SMK-05 (Passed) | Passing – unconfirmed exp. (B) |
| Add Activity › Pickers | REQ-INV-013 [B] Supplier, Submittal and Schedule lists only offer values linked to the chosen material | INV-FD §3 | INV-REG-13 (Passed) | Passing – unconfirmed exp. (B) |
| Add Activity › Issue To Construction and Loss | REQ-INV-014 [B] Issuing stock to construction or recording a loss reduces the location stock | INV-FD §3.2 | INV-REG-02 (Passed), INV-REG-03 (Skipped), INV-REG-15 (Failed) | Failing |
| Add Activity › Incoming Load on a partial schedule | REQ-INV-015 [B] A manual Incoming Load is accepted while the schedule still has open quantity, and Procurement  | INV-FD §3.1 | INV-REG-05 (Passed) | Passing – unconfirmed exp. (B) |
| Add Activity › Over-receipt | REQ-INV-016 [B] A manual Incoming Load larger than the open scheduled quantity is rejected | INV-FD §3.1 | INV-REG-06 (Passed) | Passing – unconfirmed exp. (B) |
| Add Activity › Overdraw | REQ-INV-017 [B] User cannot issue, lose, return or move more stock than is available at the location | INV-FD §3.1 | INV-REG-07 (Passed) | Passing – unconfirmed exp. (B) |
| Add Activity › Zero or negative quantity | REQ-INV-018 [B] Quantity 0 or negative is rejected | INV-FD §3.1 | INV-REG-08 (Passed) | Passing – unconfirmed exp. (B) |
| Add Activity › Internal Movement same location | REQ-INV-019 [B] An Internal Movement with the same From and To Location is rejected | INV-FD §3.1 | INV-REG-10 (Passed) | Passing – unconfirmed exp. (B) |
| Bulk upload › Dialog and template | REQ-INV-020 [B] User downloads a project-specific template and uploads inventory activities | INV-FD §4 | INV-SMK-06 (Passed), INV-REG-19 (Passed) | Passing – unconfirmed exp. (B) |
| Bulk upload › All-or-nothing | REQ-INV-021 [B] If any row in an upload file is invalid, nothing from the file is saved | INV-FD §4 | INV-REG-16 (Passed) | Passing – unconfirmed exp. (B) |
| Bulk upload › Row order and optional columns | REQ-INV-022 [B] A valid upload applies rows top to bottom; blank UoM, Supplier and Comments are accepted | INV-FD §4 | INV-REG-17 (Passed), INV-REG-19 (Passed) | Passing – unconfirmed exp. (B) |
| Ledger › History date filter | REQ-INV-023 [B] The ledger history date range includes activities on the selected start and end days | INV-FD §2, §8 | INV-REG-24 (Skipped) | Skipped/Blocked |
| Site switching › Site isolation | REQ-INV-024 [B] Switching the header site shows only that site's locations and stock | INV_SCENARIOS INV-REG-23 (A) | INV-REG-23 (Failed) | Failing |
| Add Activity › Multi-SKU items | REQ-INV-025 [B] Activities on a non-base SKU are converted to base units for stock | INV-FD §2 UOM view, §3 Item | – | None |
| Add Activity › Save feedback | REQ-INV-026 [C] User gets confirmation after saving a manual activity | INV-FD §3 OBS-INV-9 | – | None |
| Add Activity › Text and quantity limits | REQ-INV-027 [C] Comments length and maximum quantity are limited | INV-FD §3 (Comments*) | – | None |
| Access control › Inventory actions | REQ-INV-028 [C] Only users with the Inventory permissions can add activities, upload or export | INV-FD §1 buttons (role not explored) | – | None |
| Add Activity › Internal Movement between locations | REQ-INV-029 [C] Moving stock between two locations of the same site lowers the source and raises the destinatio | INV-FD §8, INV-R4 | INV-REG-11 (Failed) | Failing |
| Add Activity › Schedule belongs to submittal | REQ-INV-030 [D] An activity can only be saved with a schedule line of the selected submittal | INV-FD §3 OBS-INV-3 | INV-REG-14 (Known Defect) | Known Defect |
| Add Activity › Available stock hint | REQ-INV-031 [D] The "Available at <location>" hint equals the stock shown in the Location view | INV-FD §3 | INV-REG-12 (Failed) | Failing |
| Bulk upload › Available stock | REQ-INV-032 [D] The available quantity used by the upload check equals the ledger balance | INV-FD §4 OBS-INV-7, INV-R3 | INV-REG-18 (Failed), INV-REG-16 (Passed) | Failing |
| Stock grid › Refresh after activity | REQ-INV-033 [D] The grid Inventory value updates after a manual activity without a page reload | INV-FD §1 OBS-INV-4 | INV-REG-15 (Failed) | Failing |
| Ledger › Submittal column | REQ-INV-034 [D] The ledger Submittal column shows the Submittal No | INV-FD §2 OBS-INV-1 | INV-REG-20 (Failed) | Failing |
| Ledger › Total QTY column | REQ-INV-035 [D] The ledger Total QTY column shows a running balance | INV-FD §2 OBS-INV-2 | INV-REG-20 (Failed) | None (weak); Not covered (INV-REG-20 asserts Submittal column only) |
| Add Activity › Decimal quantity | REQ-INV-036 [D] A quantity with more than two decimals is rejected with a clear message | INV-FD §3.1 OBS-INV-10 | INV-REG-09 (Failed) | Failing |
| Add Activity › Over-receipt message wording | REQ-INV-037 [D] The over-receipt message is readable for users | INV-FD §3.1 OBS-INV-5 | INV-REG-06 (Passed) | None (weak) – unconfirmed exp. (D); Not covered (wording not asserted) |
| Add Activity › Activity date | REQ-INV-038 [D] User picks a past activity date and the activity is saved with that date | INV-FD §7 SCP-DEF-002 | INV-REG-25 (Skipped) | Skipped/Blocked |
| Add Activity › Issue To Construction and Loss in Procurement | REQ-INV-039 [D] Issue To Construction and Loss stay inside Inventory and are not written back to Procurement | INV-FD §3.3 | INV-REG-02 (Passed), INV-REG-04 (Passed) | None (weak) – unconfirmed exp. (D); Not covered (no Procurement check) |
| Add Activity › Edit, delete and adjustment | REQ-INV-040 [D] User corrects a wrongly entered activity | INV-FD §8 | – | None |
| Add Activity › Subcontractor picker | REQ-INV-041 [D] The Subcontractor list shows recognisable subcontractors | INV-FD §3 | – | None |
| Bulk upload › Subcontractor column | REQ-INV-042 [D] The upload captures the subcontractor like the manual form | INV-FD §4 OBS-INV-11 | – | None |
| Bulk upload › Comments optional | REQ-INV-043 [D] Comments rules are the same for manual and uploaded activities | INV-FD §4 | INV-REG-19 (Passed) | None (weak) – unconfirmed exp. (D); Not covered (blank comment not asserted as rule) |
| Bulk upload › UoM dropdown | REQ-INV-044 [D] The template UoM column offers the units of the material | INV-FD §4 OBS-INV-11 | – | None |
| Bulk upload › Duplicate submittal numbers | REQ-INV-045 [D] Upload and manual form treat the same submittal the same way | inv-regression.spec.js:320 (OBS-INV-13) | INV-REG-19 (Passed) | None (weak) – unconfirmed exp. (D); Not covered |
| Site switching › Header site persistence | REQ-INV-046 [D] The selected header site stays selected after a page reload | inv-regression.spec.js:41 (OBS-INV-12) | INV-REG-23 (Failed) | Failing |
| Row views › Location and UOM for legacy stock | REQ-INV-047 [D] Location and UOM views return data for every material that shows stock | SCP-DEF-019 | – | None |
| Receive booking › Project without booking link | REQ-INV-048 [D] Receive booking on a project with no Booking System link shows an empty list without errors | INV-FD §6 OBS-INV-6 | INV-SMK-08 (Failed) | Failing |
| Inventory Rebuild | REQ-INV-049 [D] Admin uses the Inventory Rebuild menu item | APP_MAP / PM menu (PM-SMK-002) | PM-SMK-002 (Passed) | None (weak) – unconfirmed exp. (D); Not covered (menu item only) |
| Receive booking › Real booking | REQ-INV-050 [E] Stock is received against a delivery booking from the Booking System | INV-FD §6, §8 | – | None |
| Add Activity › Supplier and Subcontractor saved | REQ-INV-051 [E] The supplier and subcontractor chosen on an activity are stored with it | INV-FD §3 | – | None |
| Ledger › filters | DISC-INV-01 Site select and "All Locations" filter inside the Actions panel | INV-FD §2, §8 | – (an "[A] 24 Oct" automation is claimed; no record in `status.tsv`) | None |
| Ledger › Opening Balance | DISC-INV-02 Opening Balance shown in the ledger header | INV-FD §2 | – (only Closing is read, INV-REG-01) | None |
| Row view › Submittals | DISC-INV-03 QTY / Received QTY values per submittal | INV-FD §2, §3.3 | INV-SMK-04 (Passed: renders only) | None (values not asserted) |
| Row view › UOM | DISC-INV-04 Only SKUs with stock are listed (50 Inches absent) | INV-FD §2 | – | None |
| Add Activity › To Location | DISC-INV-05 To Location appears only for Internal Movement | INV-FD §3; INV_SCN INV-SMK-05 | INV-SMK-05 (Passed) | Passing – unconfirmed exp. (B) |
| Upload › dialog | DISC-INV-06 Upload disabled until a file is chosen; Cancel | INV-FD §4 | INV-SMK-06 (Passed) _(uncertain: disabled state may not be asserted)_ | Passing – unconfirmed exp. (B) |
| Upload › error flow | DISC-INV-07 "Upload another file" after a failed upload | INV-FD §4 | – | None |
| Upload › file rules | DISC-INV-08 One site per file; PO Number disambiguation; DD/MM/YYYY date | INV-FD §4 (in-app Instructions sheet) | – | None |
| Upload › other actions | DISC-INV-09 Internal Movement / Return / Incoming Load rows via upload | INV-FD §4 | – (only Loss and Issue To Construction uploaded) | None |
| Upload › ambiguous submittal | DISC-INV-10 Upload rejects a Submittal No that exists twice (OBS-INV-13) | `inv-regression.spec.js:320` comment | – | None |

Untracked automation: these specs exist but have **no execution record in `status.tsv`**, so they don't count as complete:
- `tests/regression/inventory-management/scp-inventory-management.spec.js`: receipt, per-field validation, exact-available move, filters, date.
- `scp-inventory-bulk-upload.spec.js`
- `scp-inventory-activity-calendar.spec.js` (REQ-INV-005, SCP-DEF-009)
- `scp-inventory-calendar-dates.spec.js`
- `scp-inventory-prerequisites-contract.spec.js`
- `tests/smoke/inventory-management/scp-inventory-management.spec.js`

They depend on `test-data/inventory-management.example.json`, which still holds `REPLACE_WITH_…` placeholders.

## B. Coverage summary (INV) – counted

| Measure | Count |
|---|---|
| Features evidenced | **61**: 51 register requirements + 10 DISC features |
| Register requirements by category | A 6 · B 19 · C 4 · D 20 · E 2 |
| **Passing** (effective) | **18**: 16 REQ (A 1 = REQ-INV-003; B 15) + 2 DISC. **15 of the 16 REQ pass against an unconfirmed expectation (B)** |
| With ≥1 passing linked test (raw) | 24 REQ |
| **Failing** | **12** REQ: A 2 (002, 004) · B 2 (014, 024) · C 1 (029) · D 7 (031, 032, 033, 034, 036, 046, 048) |
| **Known Defect** | **2** REQ: 006 (A, PM-REG-BUS-08) and 030 (D, SCP-DEF-045) |
| **Skipped / Blocked** | **2** REQ: 023 (B), 038 (D, SCP-DEF-002) |
| **None** (no test, or weak test) | **27**: 19 REQ (12 with no test: 005, 025, 026, 027, 028, 040, 041, 042, 044, 047, 050, 051; 7 weak: 001, 035, 037, 039, 043, 045, 049) + 8 DISC |
| Confirmed (A) requirements fully passing | **1 of 6 (17%)** |
| INV test IDs in `status.tsv` | 36 (INV-REG-01…25 + SETUP, INV-SMK-01…08, SCP-DEMO-019/020). INV-SMK last run 10 Nov (2 runs) |

## C. Gap test cases (INV) – prioritised

### C.1 Existing tests that are failing, known-defect or skipped (original IDs kept)

#### INV-REG-21 – Damaged units enter stock as Incoming Load · H
- **Module & functionality:** Receipt from Procurement → ledger.
- **Business purpose:** Stock must equal what was received, including damaged units (PL-R16).
- **Preconditions:** A PL partial delivery of 4 with Good 3 / Damage 1 and a GRN (PL-REG-DLV-13).
- **Test data:** Run material and location.
- **Steps:**
  1. Open the ledger of the material.
  2. Find the Incoming Load for that schedule.
- **Expected:** Incoming Load = 4 (PL-R16, Q-INV-1 answered).
- **Existing automation:** Skipped. Delegated to PL-REG-DLV-13, which is Failed. The rule is unproven.
- **Missing automation work:** Add an Inventory-side assertion after DLV-13 (or in INV-REG-01), keyed on the run schedule.
- **Clarity:** A (REQ-INV-004).

#### INV-REG-22 / INV-SMK-07 – Export is the balance list · H
- **Steps:**
  1. Click Export.
  2. Open `Inventory_Report_<yyyymmdd>.xlsx`.
- **Expected:** The sheet holds the material balance list as on screen: Material ID, Material Name, Inventory, UOM (INV-R2).
- **Existing automation:** INV-REG-22 Failed 7 of 7 (the file holds the activity columns). INV-SMK-07 is KD.
- **Missing automation work:** Register a defect for OBS-INV-8 (not registered). Then assert that the row count equals the grid count and the values match.
- **Clarity:** A (REQ-INV-002).

#### PM-REG-BUS-08 (KD) – Inventory uploads appear in Bulk Upload Status · H
- **Expected:** Every Inventory upload, successful or failed, is listed with its status and uploader, and the reports can be downloaded (R13).
- **Existing automation:** KD in the PM suite. INV-REG-16/17/19 never check Bulk Upload Status.
- **Missing automation work:** After INV-REG-16 (failed upload) and INV-REG-19 (successful upload), open PM › Bulk Upload Status and assert both rows.
- **Clarity:** A (REQ-INV-006).

#### Activity Calendar default range (no ID in `status.tsv`) · H
- **Steps:** Open the Inventory Activity Calendar and read the start and end dates.
- **Expected:** Today −2 calendar months to today +1 calendar month (confirmed 28 Oct).
- **Existing automation:** `tests/regression/inventory-management/scp-inventory-activity-calendar.spec.js:5`. KD SCP-DEF-009 in the known-defects file. Not executed in any tracked run.
- **Missing automation work:** Bring it into the tracked runner with an ID (for example INV-REG-26) and filled test data.
- **Clarity:** A (REQ-INV-005).

#### INV-REG-11 – Internal Movement between two locations · M
- **Preconditions:** Two locations on the same site (INV-R4 allows creating one). Stock above 0 at the source.
- **Steps:**
  1. Note the Location-view QTY at the source and the destination.
  2. Add Activity: Internal Movement of 1 from source to destination.
  3. Re-read the Location view.
- **Expected:** Source −1, destination +1, site total unchanged. This is **C (suggested)**, not confirmed. Observed in the passing runs.
- **Existing automation:** `inv-regression.spec.js:242-266`. Latest Failed: the script picked a source location with 0 stock (see D-F6).
- **Missing automation work:** Fix source selection, then re-run.
- **Clarity:** C (REQ-INV-029).

#### INV-REG-14 (KD SCP-DEF-045) – The schedule must belong to the selected submittal · M
- **Existing automation:** KD (flips 4: the race doesn't always reproduce).
- **Expected:** **Not confirmed – needs client answer.** Observed: a mismatched pair is saved.
- **Missing automation work:** Add an API-level negative, posting a mismatched pair, so the result is deterministic.
- **Clarity:** D (REQ-INV-030).

#### INV-REG-12 / 15 / 18 / 20 / 09 / 23 / INV-SMK-08 – Failing against pending-client expectations · M
| ID | Observed |
|---|---|
| INV-REG-12 | Hint 124 vs Location view 98 |
| INV-REG-15 | The grid stays stale after an activity (OBS-INV-4) |
| INV-REG-18 | The upload "available" figure is 89 while the ledger shows 599 (INV-R3 says watch item, not defect) |
| INV-REG-20 | The Submittal column shows the Spec No (OBS-INV-1) |
| INV-REG-09 | "Invalid data provided." for a 3-decimal quantity (OBS-INV-10) |
| INV-REG-23 | The header site reverts after a reload (OBS-INV-12) |
| INV-SMK-08 | Receive booking returns a 500 toast (OBS-INV-6) |

- **Expected:** **Not confirmed – needs client answer** for all seven. INV-REG-18 should be reclassified as a watch item per INV-R3.
- **Missing automation work:**
  - Move these to "pending client / KD" so they don't read as script failures.
  - INV-REG-12: read the hint and the Location view in the same scenario, and match the location row exactly _(uncertain whether the product or the script is at fault)_.
  - INV-REG-23: split site isolation (B: the location lists differ) from header persistence (D, REQ-INV-046). Isolation itself passes in the logs; only the persistence step fails.
- **Clarity:** D (REQ-INV-031, 033, 032, 034, 036, 024/046, 048).

#### INV-REG-03 (Skipped) – Loss reduces stock · M
- **Steps:**
  1. Ledger › Add Activity: Loss, QTY 1, with a run submittal and schedule.
  2. Click ADD.
  3. Re-open the ledger.
- **Expected:** Closing Balance −1 and a Loss row listed (observed, B).
- **Existing automation:** Skipped, "covered by INV-REG-15". But INV-REG-15 asserts only the grid refresh and fails on it, so the Loss stock effect is never asserted by a manual-entry test. Upload Loss is covered by INV-REG-19.
- **Missing automation work:** Run it through `stockCase` like INV-REG-02.
- **Clarity:** B (REQ-INV-014).

#### INV-REG-24 (Skipped) / INV-REG-25 (Skipped, SCP-DEF-002) – Ledger history date filter; backdated activity · M
- **Expected:**
  - Same-day range lists that day's activities (B).
  - Backdating: **Not confirmed – needs client answer.**
- **Existing automation:** Skipped. The date pickers freeze the tab (SCP-DEF-002).
- **Missing automation work:** For INV-REG-24, drive the date range through the same `pickDate` helper used in PL (`pm-ui.js:57-68`) if the ledger range picker isn't affected by SCP-DEF-002 _(uncertain; only the Add Activity input is proven to freeze)_. INV-REG-25 stays blocked.
- **Clarity:** B (REQ-INV-023), D (REQ-INV-038).

### C.2 New gap test cases (INV)

#### GAP-INV-001 – Manual Incoming Load counts toward Procurement Received / Remaining QTY · H
- **Module & functionality:** Add Activity › Incoming Load → Procurement component.
- **Business purpose:** Receipts entered in Inventory must close the procurement line (INV-R1).
- **Preconditions:** A partially delivered run schedule (for example 4 of 10 received).
- **Test data:** QTY 1.
- **Steps:**
  1. Read the component header QTY Received and Remaining in the Procurement Log.
  2. Add an Incoming Load of 1 on that schedule.
  3. Re-open the component view.
- **Expected:** Received +1 and Remaining −1 (INV-R1). A "Via Inventory" delivery row exists.
- **Existing automation:** INV-REG-05 only checks the "Via Inventory" row (`inv-regression.spec.js:195-199`).
- **Missing automation work:** Add the header read before and after.
- **Clarity:** A (REQ-INV-001).

#### GAP-INV-002 – Return writes Returned QTY back to Procurement · H
- **Steps:**
  1. Add a Return of 1 on the run schedule.
  2. Open the Procurement component view.
- **Expected:**
  - Closing Balance −1 (A, confirmed 24 Oct).
  - A "Return" row with Returned QTY 1 (observed, INV-FD §3.3).
  - Effect on Received/Remaining: **Not confirmed – needs client answer.**
- **Existing automation:** INV-REG-04 asserts that the closing balance drops and a "Return" row is visible, but not the Returned QTY value.
- **Clarity:** A (REQ-INV-003) / C (REQ-PL-070).

#### GAP-INV-003 – Issue To Construction and Loss are not written back to Procurement · M
- **Steps:**
  1. Add Issue To Construction 1.
  2. Add Loss 1.
  3. Open the Procurement component.
- **Expected:** **Not confirmed – needs client answer.** Observed: no delivery row is created (INV-FD §3.3).
- **Existing automation:** None.
- **Clarity:** D (REQ-INV-039).

#### GAP-INV-004 – Overdraw rejected for Issue To Construction, Return and Internal Movement · M
- **Test data:** QTY = available + 1 for each action.
- **Steps:**
  1. Add Activity with each action.
  2. Click ADD.
- **Expected:**
  - Loss (observed): "Not enough stock at <loc>: only N … available, M requested."
  - Other actions: **Not confirmed – needs client answer.** REQ-INV-017 states the rule for all of them as B.
- **Existing automation:** INV-REG-07 (Loss only).
- **Clarity:** B (REQ-INV-017).

#### GAP-INV-005 – Quantity boundaries · M
- **Test data:**
  - −1
  - 1.55 (two decimals)
  - exactly the available quantity
  - available + 0.01
- **Expected:**
  - −1: "Quantity cannot be empty or zero or less" (observed, B).
  - Two decimals and exact-available: **Not confirmed – needs client answer.**
- **Existing automation:**
  - INV-REG-08 tests 0 only.
  - INV-REG-09 tests 3 decimals.
  - The exact-available case exists only in the untracked `scp-inventory-management.spec.js:96`.
- **Clarity:** B/D (REQ-INV-018, 036).

#### GAP-INV-006 – Each mandatory Add Activity field omitted on its own · M
- **Steps:** Nine runs. Each run fills every field except one, then clicks ADD.
- **Expected:** Only the missing field's "… is required" message, and nothing is saved (observed messages, INV-FD §3).
- **Existing automation:** INV-SMK-05 (empty form). The untracked `scp-inventory-management.spec.js:56`.
- **Clarity:** B (REQ-INV-012).

#### GAP-INV-007 – Multi-SKU item converted to base units · M
- **Preconditions:** A material with a non-base SKU and a conversion factor (for example 50 Inches under 43 Inches) with stock.
- **Steps:**
  1. Issue 1 unit of the non-base SKU.
  2. Read the ledger and the UOM view.
- **Expected:** **Not confirmed – needs client answer.**
- **Existing automation:** None.
- **Clarity:** B with an open question (REQ-INV-025).

#### GAP-INV-008 – Upload negative matrix · M
- **Test data, one file each:**
  - Two sites in one file.
  - A missing required column.
  - An invalid Action.
  - An unknown Submittal No.
  - A Submittal No that exists twice (OBS-INV-13).
  - A wrong date format.
  - Two schedule lines on the same date with no PO Number.
  - A negative Quantity.
- **Steps:**
  1. Upload each file.
  2. Download the error file.
- **Expected:**
  - Every case: "The upload failed. Nothing was saved." with a per-row reason. This comes from the in-app instructions (observed, B); the exact wording per case is **not confirmed**.
  - Negative Quantity: "Quantity is always positive" per the template instructions; the outcome is **not confirmed**.
- **Existing automation:** INV-REG-16 (overdraw only).
- **Clarity:** B/D (REQ-INV-021, 045).

#### GAP-INV-009 – Upload of Internal Movement, Return and Incoming Load rows · M
- **Expected:** Each row is applied with the action's sign. Internal Movement needs a To Location. Stock changes as with the manual form (observed instructions, B). The cross-module effects are **not confirmed**.
- **Existing automation:** None (only Loss and Issue To Construction).
- **Clarity:** B (REQ-INV-020/022).

#### GAP-INV-010 – Upload error-file flow · L
- **Steps:**
  1. After a failed upload, check the error file columns (`Row … Status, Errors`).
  2. Click "Upload another file".
  3. Upload a valid file.
- **Expected:** The dialog resets and the valid upload succeeds (observed buttons, B).
- **Existing automation:** INV-REG-16 checks the file contents only.
- **Clarity:** B.

#### GAP-INV-011 – Upload template UoM dropdown and Subcontractor column · L
- **Expected:** **Not confirmed – needs client answer.** Observed: the UoM list points at an empty `BlankItem`, and there is no Subcontractor column (OBS-INV-11).
- **Existing automation:** INV-REG-19 asserts only the header.
- **Clarity:** D (REQ-INV-042, 044; Q-INV-4).

#### GAP-INV-012 – Role-based access to Add Activity, Upload, Export and Receive · H
- **Preconditions:** Accounts for each role.
- **Steps:** Open Inventory Management as each role and attempt each action.
- **Expected:** **Not confirmed – needs client answer.** Suggested (C): only users with the Inventory permissions.
- **Existing automation:** None.
- **Clarity:** C (REQ-INV-028).

#### GAP-INV-013 – Ledger arithmetic and filters · M
- **Steps:**
  1. Set the ledger date range.
  2. Read Opening Balance, the signed rows and Closing Balance.
  3. Change the in-panel site and "All Locations" filter.
- **Expected:** **Not confirmed – needs client answer** (Closing = Opening + Σ rows? Do the filters scope the rows?). Observed: "Total QTY" is the signed row movement (OBS-INV-2).
- **Existing automation:** None (INV-REG-01 compares Closing with the grid only).
- **Clarity:** D (REQ-INV-035) / B.

#### GAP-INV-014 – Submittals view reconciles with Procurement · M
- **Steps:** For the run material, compare Submittals-view Received QTY with the Procurement component QTY Received.
- **Expected:** Equal, including manual Incoming Loads, per INV-R1 (A). Observed: they differ today (Q-INV-2).
- **Existing automation:** None.
- **Clarity:** A (INV-R1, REQ-INV-001).

#### GAP-INV-015 – UOM view and Location filter content · L
- **Expected:**
  - The UOM view lists only SKUs with stock, and the location filter shows only materials with stock there (observed, B).
  - Whether the landing grid should list zero-stock materials: **Not confirmed – needs client answer.**
- **Existing automation:** INV-SMK-03/04 (render).
- **Clarity:** B / D (REQ-INV-007, 009, 010).

#### GAP-INV-016 – Low-priority UX (grouped) · L
- **Items:**
  - Success toast after save (C, REQ-INV-026; OBS-INV-9).
  - Comments length and maximum quantity limits (C, REQ-INV-027).
  - Subcontractor picker shows e-mails (D, REQ-INV-041).
  - Over-receipt wording (D, REQ-INV-037).
- **Expected:** **Not confirmed – needs client answer** for all.
- **Existing automation:** None.
- **Clarity:** C/D.

#### GAP-INV-017 – Clarification-only items (not automatable yet) · L
- **Items:**
  - Correcting a wrong activity: no edit or delete control exists (D, REQ-INV-040).
  - Inventory Rebuild (D, REQ-INV-049).
  - Legacy stock views (D, REQ-INV-047 / SCP-DEF-019).
  - Real booking receipt (E, REQ-INV-050).
  - Saved supplier and subcontractor visibility (E, REQ-INV-051).
- **Existing automation:** None or blocked.
- **Missing automation work:** Wait for the answers.

## D. Flaky scripts (INV) – root cause and fix

| # | Test IDs (history) | Root cause (evidence) | file:line | Suggested fix |
|---|---|---|---|---|
| D-F1 | INV-REG-02 (3 pass / 4 fail, flips 3), 07, 08, 10, 13, 19 (run 2026-11-10T11-18) | **The header site/venue resets after a reload** (OBS-INV-12), so the From Location list shows the newest site's locations. `pick('From Location', firstNot(/…Loc INR/))` then finds no match and leaves the field empty ("From Location is required" in the reports) | `tests/pm-flow/inv-regression.spec.js:41`, `:80`, `:100`; `support/pl-flow.js:48` | Assert the header site before opening Add Activity. Fail fast if the expected location is missing. Pin the site |
| D-F2 | INV-REG-02 ("Expected −2, Received 8"), 04 ("Expected 9, Received 10"), 19 | **Ledger read race:** `closing()` parses page text after a fixed 1.5 s `settle`. If the ledger header hasn't loaded, `before` is read wrong (0) or stale | `inv-regression.spec.js:52`; `pl-flow.js:16` | Wait until the Closing Balance element shows a number and the ledger table has rows; poll for a changed value after save |
| D-F3 | INV-REG-SETUP (8/10), INV-REG-17 (3/6), 16 (3/6), 18 (1/8) | **Shared stock dependency.** Setup needs at least 4 units of 43 Inches from **PL regression runs** (`:105`). Each INV run consumes about 7 units (02: −2, 15: −1, 04: −1, 19: −1, 17: −2) with no replenishment. Uploads target `fromLoc()` = the first listed location, not the one holding stock ("0 available" at `Loc X Pmr2-2611101101`) | `inv-regression.spec.js:105`, `:100`, `:333`, `:345`, `:360` | Seed stock in suite setup (manual Incoming on a partial run schedule, or a PL chain). Choose the source location by maximum Location-view QTY |
| D-F4 | INV-REG-11 (latest Failed) | The source location is picked excluding only "Choose/Select", not the run-created `Loc INR…` locations, and with no stock check, so it picked an empty `Loc INR2611030238` ("only 0 Pieces available"). Each run that finds fewer than 2 locations also creates another location | `inv-regression.spec.js:257`, `:243-252` | Reuse the `Loc INR` exclusion from `:80`, require source QTY > 0, and reuse one fixed second location |
| D-F5 | INV-REG-12 (3/5), 13, 06, 16 → 18 | **Cross-scenario state:** INV-REG-12 compares `ctx.hint` captured in INV-REG-13 (`:131`, `:140`) and matches the location row by substring (`:138`). INV-REG-06 depends on INV-REG-05's `accepted` (`:206`). INV-REG-18 depends on INV-REG-16's `ctx.uploadAvail` (`:372`, `:379`). INV-REG-16/17/18 are skipped if INV-REG-19 fails (`:382`) | listed lines | Make each scenario self-contained; use an exact location-cell match |
| D-F6 | INV-REG-14 (KD, flips 4), 05, 13 | **Fixed wait for the dependent Schedule list** (`waitForTimeout(2000)`) around a known UI race (OBS-INV-3). Whether the mismatch reproduces depends on timing | `inv-regression.spec.js:91`, `:273` | For the positive flows, wait for the Schedule options to belong to the chosen submittal. For the KD, use an API-level negative |
| D-F7 | INV-REG-17 (passes) | **Vacuous assertion:** `count >= 0` always holds, so the upload's ledger rows are never really asserted | `inv-regression.spec.js:352` | Assert 2 new rows tagged with the run comment |
| D-F8 | INV-REG-17/16/19 | The upload completion wait swallows timeouts (`.catch(() => null)`) and then scrapes body text, so a slow upload produces an empty message and a misleading failure | `inv-regression.spec.js:296-298` | Wait for the result state explicitly; fail with "upload did not finish" |
| D-F9 | INV-SMK-08 (2/2 fail, retrysteps 2) | A fixed "wait 1.5 s, click Cancel" step catches the 500 toast (OBS-INV-6). It's a product behaviour, not flakiness | `tests/pm-flow/app-smoke.spec.js` (INV-SMK-08 step) _(exact line not checked)_ | Reclassify as pending client (REQ-INV-048) |

Deterministic failures that aren't flaky: INV-REG-09, 15, 20, 22, 23 (7 of 7 failed each), and INV-SMK-08.

## E. Missing test data and preconditions (INV)

1. **Stock baseline:** A dedicated material and location with a known starting quantity of at least 20 units for each run. Today the suite depends on 43 Inches stock left by PL regression runs and silently depletes it (D-F3).
2. **Locations:**
   - A fixed second location on the same site (INV-R4 allows one), instead of creating `Loc INR<run>` each time.
   - Cleanup of the accumulated `Loc INR…` locations, which break source selection.
3. **Sites:** `SCP_INV_SITE2` isn't set, so the fallback site names are hard-coded (`inv-regression.spec.js:410`). A pinned primary site is also needed against OBS-INV-12.
4. **Schedules:** A partially delivered schedule (for Incoming Load) and a fully delivered one (for over-receipt), both created by the run. Today the suite searches up to 8 historical `PL…-SUB-…` submittals (`:182`).
5. **Multi-SKU material** with a conversion factor and stock (GAP-INV-007). **Legacy record** Steel Bar 255 for REQ-INV-047.
6. **Roles:** Accounts for non-admin roles (GAP-INV-012).
7. **Booking System:** A project linked to the Booking System with a receivable booking (REQ-INV-050, blocked).
8. **Config files:** `test-data/inventory-management.example.json` placeholders (project, site, referenceMaterialId, subcontractor, source and destination locations, secondSite). The untracked Inventory specs can't run until a real copy exists.
9. **Damaged-receipt fixture** from PL-REG-DLV-13 (Good 3 / Damage 1) for INV-REG-21.

## F. Clarification questions (INV)

Reused register IDs:

| ID | Question (short) |
|---|---|
| REQ-INV-007 | Should the grid list zero-stock materials? |
| REQ-INV-025 | Is stock always held in the base unit, with SKUs converted? |
| REQ-INV-026 / 027 | Success toast; Comments and quantity limits |
| REQ-INV-028 | Which roles may add activities, upload, export and receive? |
| REQ-INV-030 | Should the server reject a schedule that doesn't belong to the submittal? |
| REQ-INV-031 | Should the "Available at" hint equal the Location view? |
| REQ-INV-032 / INV-R3 | Should the upload's available quantity equal the ledger balance? INV-R3 says watch item. Confirm whether INV-REG-18 should stay a test or become a watch |
| REQ-INV-033 | Should the grid refresh immediately after a manual activity? |
| REQ-INV-034 / 035 | Ledger Submittal column = Submittal No? Is "Total QTY" a running balance? |
| REQ-INV-036 / 037 | Decimal and over-receipt message wording |
| REQ-INV-038 | Must backdating be supported? |
| REQ-INV-039 | Do Issue To Construction and Loss stay out of Procurement? |
| REQ-INV-040 | How is a wrong activity corrected? |
| REQ-INV-041 / 042 / 043 / 044 / 045 / Q-INV-4 | Subcontractor names; Subcontractor column in the upload; Comments optional; UoM dropdown; unique Submittal Nos |
| REQ-INV-046 | Should the header site persist after a reload? |
| REQ-INV-047 | Steel Bar 255 legacy data? |
| REQ-INV-048 | Receive booking on an unlinked project: empty message only? |
| REQ-INV-049 | What does Inventory Rebuild do? |
| REQ-INV-050 / 051 | Booking link for a test project; a view of the saved supplier and subcontractor |

New questions (no register ID yet):

| ID | Question (short) |
|---|---|
| NEW-INV-Q1 | Is an activity of exactly the available quantity allowed? Is 2-decimal input accepted? |
| NEW-INV-Q2 | Should Overdraw apply the same way to Issue To Construction, Return and Internal Movement? |
| NEW-INV-Q3 | What is the ledger formula (Closing = Opening + Σ rows), and how do the in-panel filters scope it? |
| NEW-INV-Q4 | How does a Return affect Procurement Received/Remaining QTY (not only Returned QTY)? |
| NEW-INV-Q5 | What should happen for a multi-site upload file or a negative Quantity in the upload? |

## G. Suggested completion order (INV)

1. **Fix the data foundation (D-F3, D-F4, E1–E4).** Seed stock, pin a site and a second location. Most INV flips (SETUP, 02, 11, 16, 17, 18) trace back to depleted or misplaced stock and the site reset, so nothing else is reliable until this is done.
2. **Remove cross-scenario state and timing waits (D-F2, D-F5, D-F6, D-F8).** Each scenario reads its own "before" value and waits for real UI state.
3. **Prove the 6 confirmed rules.**
   - Only REQ-INV-003 passes today.
   - Add GAP-INV-001 (INV-R1) and GAP-INV-014.
   - Un-skip INV-REG-21 (PL-R16).
   - Register the INV-R2 export defect (INV-REG-22).
   - Add the Bulk Upload Status check (REQ-INV-006).
   - Bring the Activity Calendar spec (REQ-INV-005) into the tracked runner.
4. **Re-enable skipped positives:** INV-REG-03 (Loss), and INV-REG-24 if the ledger picker is safe. Fix the vacuous assertion (D-F7).
5. **Triage the deterministic D-category failures** (INV-REG-09/12/15/18/20/23, INV-SMK-08) to pending client or KD after the answers.
6. **Negative and boundary packs** (GAP-INV-004…009) once NEW-INV-Q1/Q2/Q5 are answered.
7. **Permissions (GAP-INV-012)**, then the low-priority UX items. Re-run INV smoke: last executed 10 Nov.

---

# Cross-module risk summary (both modules)

1. **Confirmed rules not proven:**
   - Procurement Log: 12 of 29 A-requirements aren't passing.
   - Inventory: 5 of 6 A-requirements aren't passing.
   - The worst are Required Remaining Qty (PL-R15), currency (R58), damaged units received (PL-R16 in both modules), the manual Incoming write-back (INV-R1) and Export as the balance list (INV-R2).
2. **The delivery → GRN chain is order-dependent and retried non-idempotently.** It is the backbone for PL, FDI, Inventory and T155, so its flakiness (DLV-06 fails 50% of runs) cascades into skipped and false results across three modules.
3. **Shared environment state:** the header-site reset (OBS-INV-12), sites created by other suites, stock depleted by Inventory runs, and accumulated run records all make results depend on whatever ran before.
4. **False greens:** vacuous or weak assertions (PL-REG-INT-03, INV-REG-17, DLV-15 inside DLV-01, LST-11, the DLV-16 race) and two register mapping errors (REQ-PL-013 → TC-25, REQ-PL-050 → DLV-04).
5. **Unconfirmed expectations:**
   - Most passing coverage asserts unconfirmed behaviour: 45 of 62 passing PL requirements and 15 of 16 passing INV requirements.
   - 16 of the 25 failing requirements (9 PL, 7 INV) fail against D-category (pending client) expectations.
   - No role or permission tests exist in either module.
