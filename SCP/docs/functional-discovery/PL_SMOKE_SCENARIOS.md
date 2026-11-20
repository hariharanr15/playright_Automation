# Procurement Log – Smoke Scenarios (Draft for Review)

> **Step-by-step flows (Action → Expected, matching the automated steps):** [PL_SMOKE_STEPS.md](steps/PL_SMOKE_STEPS.md)

Source of truth: [PROCUREMENT_LOG_FUNCTIONAL_DISCOVERY.md](PROCUREMENT_LOG_FUNCTIONAL_DISCOVERY.md). Evidence tags: **[O]** observed 2026-11-02, **[R]** product-owner rule, **[I]** inferred/unverified.

## Scope and rules

- **Purpose:** prove that the Procurement Log page, its toolbar, grid, forms and drill-downs load and render for the Project Admin on NRVC_Hall. Target runtime is a few minutes.
- **Data impact:** **read-only.** Forms are opened and closed with ✕ or Cancel. An empty submit is allowed only where validation blocks the save. Template downloads and Export are allowed because they don't change data. Nothing is saved, imported or deleted.
- **Session:** one login, one browser context, project selected once, navigation in menu order.
- **Assertions:** labels, headings, buttons, columns and toasts. Never assert absolute record counts; assert "`N items` with N ≥ 1" or the empty-state text instead.
- **Waits:** after a reload the grid briefly shows `0 items` until the site loads; wait for the site name and a non-zero count. The component table first shows "No data found" and fills about 1 s later.

## Common prerequisites

| # | Prerequisite |
|---|---|
| P1 | Staging only (`stg-login` → `stg-supplychain-app`) |
| P2 | Project Admin account in `SCP/.env`; password typed by the user or read from `.env`, never logged |
| P3 | Project `NRVC_Hall` with ≥ 1 submittal that has ≥ 1 component (e.g. run record `PLD1102-SUB-01`) |
| P4 | The app may open on another project after SSO (seen: `LLE - Test`); always select `NRVC_Hall` explicitly |

---

### PL-SMK-001 – Open Procurement Log on NRVC_Hall
- **Steps:** 1) Log in, open `Supply Chain Planner`. 2) Select project `NRVC_Hall`. 3) Click `Procurement Log`.
- **Expected [O]:** URL `/procurement-log`; heading `Procurement Log`; header shows `NRVC_Hall` and a site; `N items` with N ≥ 1; the menu item is highlighted.

### PL-SMK-002 – Toolbar controls render
- **Expected [O]:** `Start date` and `End date` (default today − 1 month → today, dd/mm/yyyy), `Search submittals…`, `Status`, `Add Submittal`, `Filters`, checkbox `Only my watched`, `Assign Responsible`, `Bulk Delete`, `Import`, `Export`, `N items`, `Columns`, column-scroll arrows.

### PL-SMK-003 – Grid columns and pagination render
- **Expected [O]:** column headers start with `Spec Description, Schedule Id, Material Name, Submittal No, Supplier Name, EPD Exists, Date Required On Site, Status, Source, Actual Delivery Date`, then the project's custom fields, then `Responsible`. Each row has a checkbox and a ⋮ button. `Rows per page` offers 10 / 25 / 50 / 100 (default 25), with Previous / page numbers / Next.

### PL-SMK-004 – Status filter options
- **Steps:** open `Status`, then close it.
- **Expected [O]:** options `Delivered, Not Ordered, Partial Delivery, Ordered, Not Ordered At Risk, Partial Delivery At Risk, Ordered At Risk`.

### PL-SMK-005 – Advanced Filter panel opens
- **Steps:** click `Filters` → `Add Condition` → `Clear Filter`.
- **Expected [O]:** heading `Advanced Filter`; the condition row has `(`, a column list (all grid columns), operators `= != < > <= >= Contains`, `Value`, `)`, `Remove`; `Clear Filter` closes the panel.

### PL-SMK-006 – Columns panel opens and closes
- **Steps:** click `Columns`, then click `Columns` again (Escape does not close it).
- **Expected [O]:** "Show / hide columns" with one ticked checkbox per column and `Show all`.

### PL-SMK-007 – Add Submittal form and validation
- **Steps:** `Add Submittal` → click `Add` with the form empty → close with ✕.
- **Expected [O]:** fields `Spec selection no.*`, `Spec description*`, `Schedule Id*`, `Submittal no.*` (each with `Skip for Now`), `Suppliers*` (`Choose Suppliers`), `Materials*` (`Choose Materials` + `New material`), custom number fields. Messages: "Spec selection no. is required", "Spec description is required", "Schedule Id is required", "Submittal no. is required", "Suppliers is required", "At least one material is required". The count is unchanged.

### PL-SMK-008 – Bulk actions need a selection
- **Steps:** with nothing selected click `Assign Responsible`, then `Bulk Delete`.
- **Expected [O]:** toasts "Select one or more rows before assigning a Responsible user." and "Select one or more rows before deleting."

### PL-SMK-009 – Row ⋮ menu
- **Expected [O]:** `Edit`, `Assign Responsible`, `Delete`, `Alert`, `Flag International` (close with Escape).

### PL-SMK-010 – Submittal detail drawer
- **Steps:** click the run submittal row.
- **Expected [O]:** URL gains `?submittal=<uuid>`; `Materials:` chips with `(primary)`; `Details` (Spec section no., Spec Description, Material, Submittal no., Total Value of Ordered Items, Value of items Pending to be delivered, Supplier, Date Req. on site, Required QTY, Received QTY); `Add Component`; the `Bulk upload Components` icon; the component table with columns `Date Req. on site, Material, QTY, Status, Lead time in weeks, Lead time status, Expected Delivery, UOM, Actions` and buttons `Lead Time`, `Order`, `Other Actions ▾`.

### PL-SMK-011 – Component Other Actions and Audit Trail
- **Steps:** `Other Actions ▾` → `Audit Trail` → close.
- **Expected [O]:** menu `Trigger Alert, Update Status, Audit Trail, Delete`; the Audit Trail panel has a date range, `Search`, `All Fields`, and columns `Date | Edited By | Action | Field | Old Value | New Value` with ≥ 1 row.

### PL-SMK-012 – Component view (deliveries)
- **Steps:** click the component's Material cell.
- **Expected [O]:** URL gains `&schedule=<uuid>`; buttons `+ Log Delivery`, `Edit Component`, `Delete Component`, `QR Label`; tabs `Details` / `Files`; delivery columns `Location, Item name, Quantity, Conversion Factor, Good QTY, Damage QTY, Shortage QTY, Over QTY, Returned QTY, Base UOM QTY, Expected Date of Delivery, Actual Date of Delivery`.

### PL-SMK-013 – Add Delivery form opens
- **Steps:** `+ Log Delivery` → close with ✕.
- **Expected [O]:** fields `Expected Date Of Delivery*`, `Actual Date Of Delivery`, `Location*`, `Item Name*`, `Required Remaining Qty` (read-only), `QTY*`, button `Add`.

### PL-SMK-014 – QR Label dialog
- **Steps:** `QR Label` → close.
- **Expected [O]:** "SUBMITTAL QR"; QR image; link `…/s/<submittal id>`; `PNG sticker`, copies box (30), `PDF sheet`, note "Avery 5160".

### PL-SMK-015 – Import menu and template downloads
- **Steps:** `Import` → `Download Template`; `Import` → `Download Component Template`.
- **Expected [O]:** menu `Import Submittal, Download Template, Import Component, Download Component Template`. `submittal_upload_template.xlsx` has sheet `Template` with header row `Spec Description, Schedule Id, Material Name, Submittal No, Supplier Name, Source, Actual Delivery Date, <custom fields>…`. `component_upload_template.xlsx` has `DateReqOnSite, Material, QTY, Status, Purchase Order No, PO Date, Submittal No`.

### PL-SMK-016 – Export
- **Steps:** click `Export`.
- **Expected [O]:** `Submittal_Report_<yyyymmdd>.xlsx` downloads; sheet `Filtered Submittals`; data rows = `N items` for the current filters.

### PL-SMK-017 – Row Alert panel opens
- **Steps:** row ⋮ → `Alert` → close.
- **Expected [O]:** panel with Submittal No., Material, Spec Description, `Add Alert`, table `Field Type | Condition | Value | Message | Users | Status` (rows or "No alerts configured yet for this Submittal").

### PL-SMK-018 – Flag International dialog opens
- **Steps:** row ⋮ → `Flag International` → close with ✕.
- **Expected [O]:** "Flag as International Shipment", `Submittal: <no> — <description>`, `Manufacturer Name` (pre-filled with the supplier), `Manufacturer Country *`, `Manufacturer City`, `Flag`.

---

## Coverage
18 smoke scenarios, all read-only. Write flows are in [PL_REGRESSION_SCENARIOS.md](PL_REGRESSION_SCENARIOS.md).
