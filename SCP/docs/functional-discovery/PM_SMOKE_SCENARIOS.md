# Project Management – Smoke Scenarios (Draft for Review)

Source of truth: [PM_FUNCTIONAL_DISCOVERY.md](PM_FUNCTIONAL_DISCOVERY.md). Evidence tags: **[O]** observed 2026-10-30, **[D]** documented requirement, **[A]** existing automation, **[I]** inferred/unverified.

## Scope and rules

- **Purpose:** prove that every PM page loads and its primary controls render for the Admin on NRVC_Hall. Target runtime is a few minutes.
- **Data impact:** **read-only.** Forms are opened and closed with X/Cancel. Nothing is saved, uploaded, exported or deleted.
- **Session:** one login, one browser context, pages visited in order.
- **Assertions:** labels, headings, buttons and columns only. Never assert record counts; assert "≥ 1 row" or "empty-state text" instead.

## Common prerequisites (all scenarios)

| # | Prerequisite |
|---|---|
| P1 | Staging reachable; `SCP_BASE_URL`/`SCP_LOGIN_URL` point to `stg-*` |
| P2 | Admin credentials in `SCP/.env` (`SCP_USERNAME`, `SCP_PASSWORD`) |
| P3 | Admin has access to project `NRVC_Hall` |
| P4 | NRVC_Hall has existing reference data (categories, UoMs, materials, sites, FDI inspectors/questions, ≥ 1 system message) |

---

### PM-SMK-001 – Login and open Supply Chain Planner on NRVC_Hall
- **Steps:** 1) Open login URL. 2) Enter Admin email/password, click `Login`. 3) On `Choose Platform`, open `Supply Chain Planner`. 4) Open the project selector, choose `NRVC_Hall`.
- **Expected [O]:** platform page shows the user email and `Logout`; app opens `/management-dashboard`; the project list contains `NRVC_Hall`; after selection the header shows `NRVC_Hall` and a site value.

### PM-SMK-002 – Project Management menu structure
- **Steps:** 1) Click `Project Management`. 2) Expand `Integrations`. 3) Expand `Reference Data`.
- **Expected [O]:** 13 direct children in this order: Integrations, Reference Data, Configuration Options, First Delivery Inspection Config, Inventory Control, Material Master, PreShipping Checklist, Bulk Upload Status, Procurement Log Configuration, Site Details, Submittal Manager, System Messages, Watched Materials. Integrations → Booking Integration, TheLink Integration, XER Import. Reference Data → Common Utilities, Common UoM, Material Category. `Setup Wizard` is **not** listed, because NRVC_Hall's setup is complete and the item shows only until configuration is done (confirmed 2026-10-30).

### PM-SMK-003 – Booking Integration page loads
- **Steps:** open `Booking Integration`.
- **Expected [O]:** URL `/booking-integration`; heading `Booking Integration`; `SCP Project ID` is pre-filled and non-empty; `Booking System Project ID` field and `Submit` are visible.

### ~~PM-SMK-004 – TheLink Integration page loads~~ – deferred: no TheLink access, out of scope for now (R7)
- **Steps:** open `TheLink Integration`.
- **Expected [O]:** headings `TheLink.ai Integration`, `Platform default`, `This project's override`, `Project mapping & file upload`; fields `API Key` (masked) and `Base URL`; buttons `Save project override`, `Link this project to TheLink`; an "In effect for this project" status line.

### PM-SMK-005 – XER Import page loads
- **Steps:** open `XER Import`.
- **Expected [O]:** heading `XER Plan Import`; `Plans` list; `Import Plan` button; text "Select a plan or import a new .xer / .xml file".

### PM-SMK-006 – Common Utilities list, search and Add form
- **Steps:** 1) Open `Common Utilities`. 2) Search `currency`. 3) Clear the search. 4) Click `Add Common Util`, open the Type dropdown, close the dropdown, close with X.
- **Expected [O]:** columns `NAME`, `Type`, `Created At`; item count text `<n> items`; search returns ≥ 1 row with type `currency_type`; the modal `Add Common Utils` shows `CommonUtil Name*` and `CommonUtil Type*`; the Type list includes `currency_type` and `fdi_status`; the modal closes and the item count is unchanged.

### PM-SMK-007 – Common UoM list and Add form
- **Steps:** open `Common UoM`; click `Add UOM`; close with X.
- **Expected [O]:** columns `UOM Name`, `Created At`; search `Search UOM…`; modal `Add UOM` with `UOM Name*` and `Add`; closes without change.

### PM-SMK-008 – Material Category list and Add form
- **Steps:** open `Material Category`; click `Add Material Category`; close with X.
- **Expected [O]:** column `Material Category Name`; buttons `Add Material Category` and `Load Defaults`; modal with `Name*`; closes without change. **Do not click `Load Defaults`.**

### PM-SMK-009 – Configuration Options renders current settings
- **Steps:** open `Configuration Options`; scroll to the bottom.
- **Expected [O]:** three week fields (Lead time confirmation, Not ordered alert, Not booked alert), each with a value; `Archive Read Items After`, `Currency Type`, `Integration Provider` dropdowns showing a value; toggles `GRN`, `Estimate Subcontractor Freight Emissions`, `LLM Material Categorization`, `Pre-Shipping Checklist`; `Cancel` and `Save`. No values are changed.

### PM-SMK-010 – FDI Config sections render
- **Steps:** open `First Delivery Inspection Config`.
- **Expected [O]:** sections `FDI Settings` (4 checkboxes with exact labels per [D] AC-2, plus `Save`), `Inspectors` (columns `Name / Email`, `Role`, `Materials Scope`, `Status`, `Enabled`, `Actions`; `Invite`, `Add Inspector`), Question Sets (`Unassigned questions` tab, `New Question Set`, `Manage Groups(n)`, `Add Question`, questions table).

### PM-SMK-011 – FDI Invite form gating (no send)
- **Steps:** 1) Click `Invite`. 2) Observe `Send Invites`. 3) Close with `Cancel`.
- **Expected [O]:** tabs `Manual entry` and `From Procore directory`; fields `Email *`, `Organization`, `Role *`; `Send Invites` disabled on an empty form; the modal closes.

### PM-SMK-012 – Inventory Control page loads
- **Steps:** open `Inventory Control`; click `Add Rule`; close with X.
- **Expected [O]:** text "Inventory control rules"; either a rules list or the empty state "No rules configured"; modal `Add Rule` with `Inventory Item*`, `Min balance at location*`, `Max balance at location*` and two notify toggles.

### PM-SMK-013 – Material Master list, paging and Add form
- **Steps:** 1) Open `Material Master`. 2) Click `Next page`, then `Previous page`. 3) Click `Add Material`; close with X.
- **Expected [O]:** buttons `Add Material`, `Upload`, `Export`; columns `Category`, `Material ID`, `Name`, `Parent Material`, `UOM`, `Items`; at most 25 rows per page; paging changes the first row and returns to it; the modal shows `Category *`, `Material Name*`, `UOM *`, `Parent Material`, `Supplier`.

### PM-SMK-014 – PreShipping Checklist page loads
- **Steps:** open `PreShipping Checklist`.
- **Expected [O]:** table columns `#`, `Question`, `Enabled`; ≥ 1 row with an Enabled checkbox. **Do not toggle.**

### PM-SMK-015 – Bulk Upload Status filters render
- **Steps:** open `Bulk Upload Status`; open `All Upload Types`; close it.
- **Expected [O]:** two date inputs (default range ending today); upload-type options `Submittals, Suppliers, Materials, Sites, Supplier Map, Components, Inventory`; `Search by uploader…`; columns `Date`, `Added By`, `Bulk Upload Type`, `Status`, `Uploaded File`, `Success File`, `Failure File`.
- **Note:** rows with no status are expected for partial-success uploads (R17); failure-only rows with no status are SCP-DEF-001 pending confirmation. Smoke checks layout only.

### PM-SMK-016 – Procurement Log Configuration page loads
- **Steps:** open `Procurement Log Configuration`; click `Add Log Fields`; close with X.
- **Expected [O]:** helper texts about drag-reorder and locked fields; `Material Name(Locked)`, `Submittal No(Locked)`, `Supplier Name(Locked)` with checked, disabled checkboxes; `Save Changes`; the modal shows `Field Name*` and `Field Type*`.

### PM-SMK-017 – Site Details list and Add form
- **Steps:** open `Site Details`; click `Add Site`; close with X.
- **Expected [O]:** buttons `Add Site`, `Upload`, `Export`; columns `Site Type`, `Name`, `City`, `Country`, `Locations`; the modal shows `Site Type*`, `Name*`, `Address`, `City`, `Country`. (No address suggestions is expected, R34.)

### PM-SMK-018 – Submittal Manager notice
- **Steps:** open `Submittal Manager`.
- **Expected [O]:** heading `Submittal Manager` and text starting "This page is being repurposed." (agreed scope, 2026-10-27).

### PM-SMK-019 – System Messages list and New form (no create)
- **Steps:** open `System Messages`; click `New message`; click `Cancel`.
- **Expected [O]:** columns `Scope`, `Severity`, `Title / Body`, `Window`, `Status`, `Actions`; the form shows Scope, Severity (`Info`/`Warning`), Title, Body with `0/2000`, Preview, Starts at, Ends at, Active, `Cancel`, `Create`; Cancel hides the form.

### PM-SMK-020 – Watched Materials user view
- **Steps:** open `Watched Materials`; select the logged-in Admin in `User`.
- **Expected [O]:** before selection, "Pick a user to view or assign watches."; after selection, columns `Type`, `Value`, `Notifications`, `Assigned by`, `Created` and an `Add watch` control. **Do not click Remove, Add watch or the notification toggle.**

---

## Smoke coverage summary

| Page | Scenario |
|---|---|
| Login / project | 001 |
| Menu | 002 |
| Integrations (3) | 003–005 |
| Reference Data (3) | 006–008 |
| Configuration Options | 009 |
| FDI Config | 010–011 |
| Inventory Control | 012 |
| Material Master | 013 |
| PreShipping Checklist | 014 |
| Bulk Upload Status | 015 |
| Procurement Log Configuration | 016 |
| Site Details | 017 |
| Submittal Manager | 018 |
| System Messages | 019 |
| Watched Materials | 020 |
