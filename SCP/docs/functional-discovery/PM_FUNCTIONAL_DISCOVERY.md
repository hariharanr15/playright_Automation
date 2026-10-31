# Project Management – Functional Discovery (SCP Staging)

| Item | Value |
|---|---|
| Discovery date | 2026-10-30 |
| Environment | Staging only: `stg-login.voyagecontrol.com` → `stg-supplychain-app.voyagecontrol.com` |
| Account | Admin account from `SCP/.env` (`SCP_USERNAME`); password entered by the user in the MCP browser, never written to tools or logs |
| Project / site | `NRVC_Hall` / default site `Gate 6. 87` |
| Method | Playwright MCP, single Chromium session, read-only exploration |
| Status | Draft for review. No automation code written. |

## 1. Evidence levels

Every statement in this folder carries one of these tags.

| Tag | Meaning |
|---|---|
| **[O]** | Observed in the staging UI during this session |
| **[D]** | Documented requirement in `SCP/docs/*_REQUIREMENTS.md` (not necessarily verified today) |
| **[A]** | Asserted by existing automation (`features/project-management/*.feature`, page objects); passed in earlier runs, not re-executed today |
| **[I]** | Inferred from labels or UI conventions. **Unverified – needs confirmation** |

## 1a. Product-owner clarifications (2026-10-30)

These answers from review are treated as **confirmed rules [R]** from here on.

| # | Topic | Confirmed rule | Effect on scenarios |
|---|---|---|---|
| R1 | Test data | Any data may be created on **NRVC_Hall** during automation | M scenarios are approved for automation runs on NRVC_Hall |
| R2 | Uniqueness | No name duplication is allowed; every name field must be unique | Every "duplicate name" scenario expects **rejection** |
| R3 | FDI photos | When "Enable Uploading of Photos?" is unticked, photos are not mandatory | FDI-02 confirmed |
| R4 | FDI Invite | An invite can be sent only with a valid email **and** a role | FDI-11…15 confirmed; missing inline error text is acceptable |
| R5 | System Messages | Title 120 / Body 2000 limits are correct | SYS-01/04 confirmed |
| R6 | FDI Invite › Organization | The list must contain unique organizations; today's duplicates are **an issue** | New NEG scenario FDI-16a; defect candidate DEF-C1 |
| R7 | TheLink Integration | No access to TheLink; **out of scope for now** | INT-04…06 deferred; OBS-4 dropped |
| R8 | Add Site › Address | ~~The address must be suggested from what the user types~~ **Superseded by R34** | SITE-06 expects suggestions; today's "Google Maps key" message is **an issue** (DEF-C2) |
| R9 | Roles | Role access is **configuration-based**. Super Admin (Org Admin) can change what each role can access and assign roles to users; Manager and view-only roles can be set up the same way | Role scenarios are rewritten around configured permissions (§15 of regression) |
| R10 | Setup Wizard | Extra option, visible until configuration is complete, then hidden. Later changes are made on each module's own page. The wizard just brings those pages' functions together on one page | NAV-04/07/08; wizard data must match the module pages |
| R11 | Configuration Options | Notifications, emails and alerts are triggered from these settings | New CFG INT scenarios (trigger details still I) |
| R12 | Configuration Options (not configured) | If the settings are not configured, no message or email is sent to anyone; users still get the in-app notification and alert | CFG-17 |
| R13 | Bulk Upload Status | The project's upload history: every Excel upload is tracked with pass/fail status and uploader, and the success and failure reports can be downloaded. The status is what tells the user whether an upload worked, so a row without a status can't be judged (confirms SCP-DEF-001) | BUS-05…11 |
| R14 | Test data lifecycle | Records created by automation are **not deleted** | No cleanup steps; unique `<RUN>` names are mandatory |
| R15 | Uniqueness | Uniqueness ignores leading/trailing spaces **and letter case** (`"Cement "` = `"cement"` = `"Cement"`) | Duplicate scenarios include space and case variants |
| R19 | Configuration Options week settings | All three count **back from the Required On Site (ROS) date** (on-screen help, 30 Oct): **Lead time confirmation** = weeks before ROS by which the supplier's lead time must be confirmed, otherwise a 'lead time not confirmed' alert on the Management Dashboard; **Not ordered alert** = weeks before ROS after which an unordered item raises an alert ("set to the longest lead time you'd accept without escalation"); **Not booked alert** = weeks before ROS after which an unbooked delivery raises an alert (booking = a transport/booking reference attached to the schedule line) | CFG-13…16 have concrete dates |
| R21 | Alerts, notifications, tasks | Detailed rules come from the product owner's spreadsheet, captured in [ALERTS_NOTIFICATIONS_TASKS_REQUIREMENTS.md](ALERTS_NOTIFICATIONS_TASKS_REQUIREMENTS.md). Where it conflicts with in-app help text, **the help text is the latest rule**. The email goes to the person who **created the PO** | CFG-13…17 link to the ANT-xx events |
| R20 | Bulk Upload Status | A fully failed upload must show `Failed`; showing no status is a defect | SCP-DEF-001 narrowed to the 4 failure-only rows |
| R17 | Bulk Upload Status | A **partial-success** upload (some rows succeed, some fail) shows **no status** by design. **31 Oct build: material uploads now show `Partly successful`, and fully failed ones show `Failed` (SCP-DEF-001 no longer reproduced)** | Rows with both a success and a failure file and `-` or `Partly successful` status are expected, not a defect |
| R18 | Setup Wizard project | **SCP_Testing_Ram** has an unfinished setup: the wizard is in its PM menu (observed 30 Oct; steps 1–2 ✓, current step 3 Project Config) | NAV-07/08/09 and CFG-17 can use SCP_Testing_Ram (writes there need approval, R1 covers NRVC_Hall only) |
| R22 | Role configuration | Organization Admin assigns roles in a **separate Super Admin application**, not in SCP. The product owner will walk us through it | ROLE scenarios wait for the walkthrough |
| R23 | SCP_Testing_Ram | A fresh project; automation **may create data** there, including finishing its Setup Wizard | NAV-08/09, CFG-17 approved |
| R24 | Booking | Booking System ID linking is **not used** for now; only **manual booking entry** is used for testing | INT-03 and ANT-02 deferred; not-booked tests attach a manual booking instead |
| R25 | Alerts / Notifications / Tasks | All three appear on the **Management Dashboard** (Alerts, Notifications, Tasks tabs). Staging batch timing is the same as production (about 05:00-06:00 IST) | Alert scenarios verify on the dashboard |
| R26 | Configuration Options week fields | ~~Only whole numbers 1 or greater~~ **Superseded by R69** | – |
| R27 | System Messages | **Ends at** before **Starts at** -> the system shows an error/warning message | SYS-05 expected result set |
| R28 | Editing records | Existing records are edited from the **three-dot (⋮) icon** on the row | REF/PLC edit scenarios use ⋮ |
| R29 | PreShipping Checklist | **Save** is enabled only after **all fields are filled** | PSC scenarios updated |
| R30 | Load Defaults (Material Category) | Adds all available default categories; automation **may run it** | REF-18 approved |
| R31 | Inventory Control | No rules exist by default; rules are created **per project and site (venue)** | INV scenarios create their own rule per site |
| R32 | Setup Wizard after completion | Once all setup is complete and submitted, it must **not show in the left-hand menu** | NAV-04 |
| R33 | Watched Materials | One user can watch all available materials; repeated display names are acceptable | WM scenarios |
| R34 | Add Site address | **No typing suggestions is the expected behavior**; the user types the address. Supersedes R8 | DEF-C2 withdrawn; SITE-06 expects no suggestions |
| R35 | PreShipping Checklist (PM page) | Ticking **Enabled** saves automatically; there is no Save button. Supersedes R29 for this page | PSC-02 expects autosave |
| R36 | Delete | Delete is on the row's ⋮ menu for every record type | REF-23 |
| R37 | System Messages severity | Warning and Info banners have **different background colours** | SYS-12 |
| R38 | Spreadsheet row "Item not being ordered in time – schedule not impacted" | Requirement unclear to the product owner; **out of scope** until clarified | Not automated |
| R39 | PreShipping Checklist menu item | Shown in the PM menu only when the **Pre-Shipping Checklist** toggle in Configuration Options is **On** (NRVC_Hall On; LLE - Test and SCP_Testing_Ram not shown) | PSC-05 |
| R40 | Voyage Control Admin access | Only the Organization Admin has the `Voyage Control Admin` tile; role access is edited there (Roles → Edit) | ROLE-02, ROLE-11 |
| R41 | Permission model | Access is set **per page as View or Edit**: a role can view a page while editing is restricted | ROLE scenarios check view-only vs edit per page |
| R42 | Roles for testing | The **Subcontractor** and **Supplier** roles may be changed for testing (accounts in `.env`); restore their original access afterwards | ROLE-03…08 use these roles |
| R43 | Role assignment | A role is assigned **when the user is created**, in SCP **User Management** (invite). The Org Admin can also create users in the Voyage Control Admin portal | ROLE-12, ROLE-13 |
| R44 | Site upload type values | Valid `site_type` / `location_type` values are the **on-screen types of the project** (they vary per project; NRVC_Hall: `Warehouse/Site_type3/Site`, `Construction Area/Substore`). The template's sample values are not a reference | UPL-SITE-02, 06, 07 |
| R45 | Material upload – unknown category | A category that doesn't exist is **created after the user confirms it during the upload** | UPL-MM-08, UPL-MM-16 |
| R46 | Site upload – existing site name | Rejected as a duplicate | UPL-SITE-08 |
| R47 | Upload test files | Each run downloads the template and **replaces its sample rows** with new unique `<RUN>` data before uploading | §16 test data rules |
| R48 | Role permissions | Edited in **Update Role**: one checkbox per `<Area>: <Action>` (List/View/Create/Edit/Delete; Project vs Platform), then `Save` | ROLE-02…07 use exact permission names |
| R49 | XER Import – Manage tasks Save | ~~New records are added~~ **Superseded by R50** | – |
| R50 | XER Import | The XER requirement is **not confirmed** (needs more clarity). Automation follows the **existing flow**: Import → Open existing plan → Manage tasks → select two new tasks (row click) → Save → "2 tasks set to visible." → those tasks shown; Save sets the visible set to the selection. The draft requirement is kept for reference only | INT-15/21/25 follow current behavior; requirement-only scenarios deferred |
| R51 | PM permissions | Mapping of PM pages to Update Role permissions taken from the Project Admin role list (§5.19). Role tests use these names | ROLE-03…07, 15…19 |
| R52 | PM tab access | All Project Management pages come with the **Project Management tab access** (`Menu: Project Management section` + `Screen: Project Management: View project management screen`). Pages without their own permission (Common Utilities, Common UoM, Material Category, Configuration Options, PreShipping Checklist, Bulk Upload Status, Procurement Log Configuration, Submittal Manager) are fully controlled by it; pages with their own permissions (Material, Site, Inventory Control rules, FDI, System Messages, Material Watch) also need those | ROLE-05, ROLE-21 |
| R53 | FDI Settings → Inspection form | The **four FDI Settings checkboxes** (Need Overall Notes to be captured; Enable Uploading of Photos?; Photos are mandatory?; Provide Link to Submittal Spec Documents?) decide what the **FDI inspection form** asks for: each ticked setting is shown in the form, an unticked one is not (product owner, 30 Oct, with screenshot) | FDI-05a…05d |
| R54 | FDI photo settings | The photo settings are **validation**, not show/hide: the inspection form asks for a photo according to the mandatory setting. `Photos are mandatory?` ticked → submitting without a photo gives a validation message; not mandatory → the form can be submitted without a photo | FDI-05b, FDI-05c |
| R55 | FDI Inspectors – sub-stories | Implementation acceptance criteria (table, invite integration, material mapping, enable/disable, self-assign) traced in regression §5b. Observed 30 Oct: pending-invite `Enable` is disabled with the tooltip "Activates automatically once the invite is accepted" (matches) | FDI-10, 25b, 25c, 26a, 28, 28a, 29a |
| R56 | FDI questions – organization scope | A new question is enabled for the project it was added from (Data Type chosen in the same flow), offered to the organization's other projects as available-but-not-enabled, and never visible to another organization. | Regression §5d (FDI-46…50) |
| R57 | Project organizations | NRVC_Hall, SCP_Testing_Ram and LLE - Test belong to **three different organizations** | FDI-47 runnable; FDI-46/48/49 need a second project in NRVC_Hall's organization |
| R58 | Currency | The currency list (Common Utilities `currency_type`) is a shared list; **each project's currency comes from its own Configuration Options › Currency Type**. Seeing the same currency entries on projects of other organizations is expected | CFG-05, CFG-18 |
| R59 | FDI photos section | When `Enable Uploading of Photos?` is **off**, the Photos section is **not shown** on new FDI inspection forms (product owner, 30 Oct). When on, `Photos are mandatory?` decides the Submit validation (R54) | FDI-05g, FDI-05b, FDI-05c |
| R60 | Inspector Status vs Enabled | `Status` is the **user account** state (Active / Invited - Pending Acceptance); `Enabled` is the **inspector mode** for this project. "Active + Disabled" = active user whose inspector mode is off – expected | FDI-10 |
| R61 | Inspector Materials Scope `—` | `—` means no material mapping has been made for that inspector yet – expected display | FDI-10, FDI-26 |
| R62 | Projects per organization | Any number of projects can be added to the same organization. The same-organization question checks need a **second project in NRVC_Hall's organization** to be created first (Voyage Control Admin › New Project, by the Org Admin) | FDI-46, 48, 49 (prerequisite) |
| R63 | XER task checkbox | Clicking the checkbox not selecting the task is **accepted for now but is an issue** (defect candidate DEF-C5); automation clicks the row | INT-16 |
| R64 | Common UoM and Material Category | Belong to the **project** (not shared across projects); the currency list is shared and the project picks its currency (R58) | REF-24, REF-25 |
| R65 | Who can create a project | **Organization Admin** can create a project for **any existing organization**; **Project Admin** can create a project only for **their associated organization** (permission `Project: Create a new project`) | ROLE-22…24; one-time setup of the second NRVC_Hall-organization project (FDI-46/48/49) |
| R66 | FDI photo upload formats | The photo upload accepts **all common formats**, e.g. JPEG, PNG, PDF, XLSX, CSV (product owner, 30 Oct). This replaces the Inspection Report requirement's "reject non-image files" (IR-AC-5) | FDI-05h |
| R67 | Inspector audit trail | **Out of scope for now** (product owner, 30 Oct): no audit trail / history / log checks for inspectors | INS-AC-11 and FDI-29 removed |
| R68 | FDI questions – deleted and migration | `Show deleted questions` shows **previously deleted questions, including old ones**. The one-time question migration checks are **removed from this document** | FDI-42, 42a, 42b; §5e removed |
| R69 | Configuration Options values | Any value **except a negative (minus) value** is accepted, so `0` is allowed; only negative values are rejected (product owner, 30 Oct) | CFG-01, CFG-06, CFG-07 |
| R70 | Project IDs | NRVC_Hall's project ID is **PRJSUPCHAPLA0000000063** (product owner, 30 Oct). Note: the Booking Integration page and the Material Master export show `PRJSUPCHAPLA0000000095` for NRVC_Hall; the Site Details export shows `…0063` (Q-ID-1) | SITE-11 |
| R16 | Accounts | One login URL for every user. Accounts: Project Admin (`SCP_USERNAME`), Supplier (`SCP_SUPPLIER_USERNAME`), Subcontractor (`SCP_SUBCONTRACTOR_USERNAME`), Org Admin / Super Admin (supplied 2026-10-30; not yet in `.env`) | ROLE scenarios can start; Manager and view-only accounts still needed |

## 2. What was and was not done

**Done [O]:** login, platform selection, project switch to NRVC_Hall, visit of all 17 PM pages, opening every Add/Invite/New form and closing it without saving, dropdown option capture, search/paging/filter checks, row-menu inspection, one client-side rule check (FDI photo settings) that was discarded by reload.

**Not done (requires approval or extra setup):**
- No Save / Add / Submit / Send / Delete / Load Defaults / Upload / Export was clicked. Server-side validation messages, duplicate-name handling and persistence were therefore **not observed**.
- No second role was logged in (session was kept single, per instruction). All role-based behavior is **[I]** or **[D]**.
- No other project was inspected beyond the project list.

## 3. Login and project context [O]

1. Login page: `Welcome To Voyage Control`, fields `Email`, `Password`, buttons `Login`, `Login with SSO`, link `Forgotten password?`. `document.title` is empty on this page.
2. After login: `Choose Platform` page (title `Choose Platform`) listing `Supply Chain Planner` and `V3 Construction deliveries`.
3. Opening Supply Chain Planner lands on `/management-dashboard` with the last-used project (`LLE - Test` on this occasion).
4. Projects available to this account: `LLE - Test`, `NRVC_Hall`, `SCP_Testing_Ram`.
5. Switching to NRVC_Hall changes the site selector to `Gate 6. 87` and adds `International Shipments` to the left navigation (not shown for LLE - Test).
6. A project-scoped `PROJECT NOTICE` banner (from System Messages) is shown above every page.
7. Session tokens are passed as `access`/`refresh` URL query parameters during SSO hand-off. Do not log full URLs in reports.

## 4. Project Management menu tree [O]

```
Project Management
├── Integrations                 (group)
│   ├── Booking Integration      /booking-integration
│   ├── TheLink Integration      /thelink-integration
│   └── XER Import               /xer-import
├── Reference Data               (group)
│   ├── Common Utilities         /common-utilities
│   ├── Common UoM               /common-uom
│   └── Material Category        /material-category
├── Configuration Options        /configuration-options
├── First Delivery Inspection Config  /first-delivery-inspection-config
├── Inventory Control            /inventory-control
├── Material Master              /material-master
├── PreShipping Checklist        /preshipping-checklist
├── Bulk Upload Status           /bulk-upload-status
├── Procurement Log Configuration /procurement-log-configuration
├── Site Details                 /site-details
├── Submittal Manager            /submittal-manager
├── System Messages              /system-messages
└── Watched Materials            /watched-materials

Setup Wizard  /setup-wizard  – shown in the menu only until project setup is complete
                               (hidden on NRVC_Hall because setup is complete; URL still opens)
```

Clicking the `Project Management`, `Integrations` or `Reference Data` button expands the group; the URL does not change [O].

## 5. Page-by-page functionality

Record counts are a snapshot from 2026-10-30 and change with every automation run. Never assert exact counts.

### 5.1 Booking Integration [O]
- Text: "Link this Supply Chain project to a Booking System project".
- `SCP Project ID` (pre-filled, e.g. `PRJSUPCHAPLA0000000095`), `Booking System Project ID` (empty), `Submit`.
- [I] Submit with empty / invalid Booking ID behavior unknown. Whether the SCP ID is editable was not checked.

### 5.2 TheLink Integration [O] – out of scope for now (R7)
- Sections: `Platform default` ("Voyage Control staff only … not yet configured"), `This project's override` (`API Key` password field, `Base URL` text, `Save project override`), `Project mapping & file upload` (`Link this project to TheLink`).
- Status line: "In effect for this project: No credentials configured — TheLink calls will fail."
- **Observation:** helper text says "Set the API key + team ID above before linking", but no Team ID field is visible. **[Question Q5]**

### 5.3 XER Import [O]
- Heading `XER Plan Import`; left list `Plans` with `Import`; each plan shows name, "`<visible>/<total>` visible · `<n>` mapped" and import date. Prompt "Select a plan or import a new .xer / .xml file"; `Import Plan`.
- **Test file (product owner, 30 Oct):** `SPADE-OYM-1A-2A-BL-1-09-25-2026-1.xer` (14 MB, Primavera P6 export: 15,860 tasks, 28,074 task links, 1,120 WBS nodes). It contains a client's real project and personal names, so keep it out of the repo; store it outside source control and pass its path in via configuration.

**Flow observed on NRVC_Hall (30 Oct):**
1. `Import` opens the operating system file picker directly (no dialog). Select the `.xer` file.
2. **Duplicate detection:** the file was recognised as already imported, although its name differs (`…09-25…` vs the existing `…09-11…`), so detection is by content, not by file name. Dialog: **"Plan already imported** – This file was already imported as "SPADE-OYM-1A-2A-BL-1-09-11-2026-1". "Import anyway" creates a second, separate copy of the plan. Are you sure you want to proceed?" with buttons `Open existing plan` / `Import anyway`. The product owner chose **Open existing plan** for the run (no duplicate plan).
3. Plan view: plan name · `<n> tasks`; filter `All tasks` / `Mapped only` / `Unmapped only`; `Search tasks…`; buttons `Manage tasks`, `Recalculate`, `Update Plan Dates`, `Auto-sync`, `Reload`. Table `WBS | Task ID | Task Name | Duration | Planned Finish | Revised Finish | Component (Expected Completion Date) | Conflict`, with `+ Map component` and `Unmapped` per row.
4. `Manage tasks` → dialog **"Select tasks to display"** – "Choose which programme tasks appear in the SCP plan view. `<n>` of 15860 selected." Filters: `Search task name or ID…`, WBS (`All WBS`, `CMDA`, `DH-A - UG Utilities (East)`, …), type (`All types`, `TT_FinMile`, `TT_Task`, `TT_Mile`, `TT_LOE`). Buttons `Select all matching (n)`, `Deselect all`, `Cancel`, `Save (<n> tasks)`. Columns `WBS | Task ID | Task Name | Type | Planned Start | Planned Finish`. All 15,860 rows load within about 5 s.
5. Select two tasks **not already visible** (product owner: if a record is already there, pick two new ones). Used: `DC1-CS-BUE-1170` and `DC1-CS-BUE-1180`. Counter → "2 of 15860 selected", button → `Save (2 tasks)`. Selection survives search changes.
6. `Save (2 tasks)` → dialog closes, message **"2 tasks set to visible."**, plan view lists the two tasks (6d, Planned Finish 2026-12-11 / 2026-12-17, `Unmapped`), header still "2/15860 visible · 0 mapped".

**Observations:**
- **OBS-12:** clicking a task's **checkbox** does not select it; clicking elsewhere on the **row** does. The checkbox probably toggles twice (checkbox and row handlers). Automation must click the row.
- **OBS-13:** Save **replaces** the visible set: the two tasks visible before (`CMDA1-MS-110`, `CMDA2-MS-120`) were no longer shown after saving the two new ones. The dialog also opened with "0 of 15860 selected" although two tasks were visible, so the current selection is not pre-ticked. A user can unknowingly hide tasks. Question Q-XER-1.
- Not explored: `Import anyway`, `+ Map component`, `Recalculate`, `Update Plan Dates`, `Auto-sync`, `Reload`, `.xml` import.
- **Requirement (30 Oct):** plan reload + Task Visibility Control – compared point by point in [XER_TASK_VISIBILITY_REQUIREMENTS.md](XER_TASK_VISIBILITY_REQUIREMENTS.md). Reference only (R50). Visibility survives page refresh; Manage tasks doesn't tick visible tasks and Save replaces them; no date-range filter – all treated as current expected behavior.

### 5.4 Common Utilities [O]
- List columns: `NAME`, `Type`, `Created At`, plus an unlabelled icon column (svg, purpose unknown **[Q7]**). ~97 items. Search `Search utils…`.
- Search matches name **and** type: `currency` → 13, `INR` → 2. No match → "0 items", "No data found", `No results for "<term>"`.
- `Add Common Util` modal `Add Common Utils`: `CommonUtil Name*` (text), `CommonUtil Type*` (dropdown), `Add`, close X. Escape does **not** close the modal.
- Type options: `fdi_status, file_category, currency_type, inv_action_type, notification_type, shipping_mode, task_status, location_type, schedule_status, notification_category, bs_status, site_type, completion_status, preshipping_checklist_status`.
- Downstream [O]: `currency_type` entries feed the Configuration Options `Currency Type` dropdown.

### 5.5 Common UoM [O]
- Columns `UOM Name`, `Created At` (+ icon column). ~36 items. Search `Search UOM…`.
- `Add UOM` modal: `UOM Name*`, `Add`.
- [A] Existing automation creates then edits a UoM, so an edit path exists (entry point not identified **[Q7]**).

### 5.6 Material Category [O]
- Columns `Material Category Name`, `Created At`. ~81 categories. Search `Search categories…`.
- `Add Material Category` modal: `Name*`, `Add`. `Load Defaults` button (not clicked: **[I]** bulk-creates default categories).
- Downstream [O]: categories feed Add Material, New Question Set, Watched Materials and Inventory/FDI scoping.

### 5.7 Configuration Options [O]
| Control | Type | Current value (NRVC_Hall) |
|---|---|---|
| Lead time confirmation (weeks) ? | text input (no min/max/pattern) | 1 |
| Not ordered alert (weeks) ? | text input | 1 |
| Not booked alert (weeks) ? | text input | 1 |
| Archive Read Items After ? | dropdown: 30/60/90/120/150/180/360 days | 30 days |
| Currency Type | dropdown (from `currency_type` utilities) | INR - Indian Rupees |
| GRN | toggle | On |
| Integration Provider ? | dropdown: None / Procore / Autodesk ACC | None |
| Estimate Subcontractor Freight Emissions ? | toggle | Off |
| LLM Material Categorization ? | toggle | Off |
| Pre-Shipping Checklist | toggle | On |
- Buttons `Cancel`, `Save`. The `?` help icons did not show a tooltip on hover (they may need a click) **[Q8]**.
- **Purpose (R11):** notifications, emails and alerts are triggered from these settings (e.g. lead-time confirmation, not-ordered and not-booked alerts after N weeks; archive period for read items on the dashboard).
- [I] Validation for non-numeric, zero, negative or decimal week values is unknown. Inputs have no client-side constraints. [I] Exact trigger timing (calendar vs working weeks, reference date) and email recipients are unknown.

### 5.8 First Delivery Inspection Config [O]
**FDI Settings**: 4 checkboxes + `Save`. Current: Overall Notes = No, Enable Uploading of Photos = Yes, Photos mandatory = Yes, Spec Documents link = Yes.
- Rule verified [O]/[D AC-6]: unchecking `Enable Uploading of Photos?` unchecks **and disables** `Photos are mandatory?`. Reload without Save restores saved values.
- **Effect on the inspection form (R53):** the four ticked settings decide what the FDI inspection form asks for (First Delivery Inspections module). Questions in the question sets are separate (FDI-05e/05f, existing automation).

**Inspectors**: table `Name / Email | Role | Materials Scope | Status | Enabled | Actions` (~74 rows). Statuses seen: `Active`, `Invited - Pending Acceptance`. Enabled: `Enabled`/`Disabled` with `Disable`/`Enable` action. Scope shows `All Materials`, category chips (`Cement · all`), material chips, `+N more`, edit pencil (`Edit materials`).
- `Invite` → modal `Invite Users`, tabs `Manual entry` / `From Procore directory`.
  - Manual: `Email *`, `Organization` (optional), `Role *`, `Add Another User`, `Cancel`, `Send Invites`.
  - `Send Invites` disabled until email is a valid format **and** a role is chosen. Malformed email + role → still disabled, **no inline error text**. Valid email + role → enabled. Adding a second empty row disables it again.
  - Organization options: `Amazon, Amazon, Meta, Meta, Neuralrays, Rubicon Tiles, Voyage Control` (**duplicates – Q3**).
  - Role options: `All_Role_Access, Project Admin, Project Manager, Project Senior User, Project User, Subcontractor, Supplier`.
  - Procore tab: "Selected users are added to the invite list with the Subcontractor role by default"; `Search`, "No users returned. Click Search to load.", `Add to invite list`.
- `Add Inspector` → modal: `Project Member *` (select), `Project Role *` (same 7 roles), `Materials Scope *` radios `All Materials` (default) / `By Material Category` / `Specific Materials`, `Add`.

**Question Sets**: tabs `Unassigned questions`, `Laptop`, `Phone`, `TV`; `New Question Set`; warning "No 'All Categories' set — deliveries in uncovered categories will have no questions".
- `New Question Set` modal: `Set Name *` (max 200, placeholder "e.g. Steel Receiving Checks"), `Material Categories *` radio `Specific categories` / `All Categories (catch-all)`, category search, checkbox list (categories already used by another set are disabled and labelled `(in: <set>)`), `0 selected`, `Cancel`, `Create Question Set`.
- `Manage Groups(3)` expands inline: groups table `# | Group Name | Heading Display Text | No. of Questions | Actions` (Edit, Delete, ▲▼), `Add Group`. Note: "Ungrouped questions always render last. Changing this order affects new inspection records only".
- Questions table `# | Question | Group | Type | Added On | Status | Actions` with ▲▼ reorder, inline group select (incl. `+ New group…`), `Delete`, `Show deleted questions` checkbox. Ticking `Show deleted questions` lists previously deleted questions, including old ones (R68). Empty list message [S]: "No questions found. Click \"Add Question\" to create one."
- `Add Question` modal: `+ Create New Question` (`Question Text*`, `Answer Type*`) or `Add from Organization Bank` (bank questions not yet in this set, each with group + answer type selectors, "Already in: …" hint). Answer types: `Boolean, Text, Date, Pass/Fail/NA, Numeric, Drop Down, Single Photo, Multiple Photo, Document`.

### 5.9 Inventory Control [O]
- "Inventory control rules – Min/max balance thresholds with notification triggers per material". NRVC_Hall currently: "No rules configured".
- `Add Rule` modal: `Inventory Item*` (dropdown), `Min balance at location*` (number), `Max balance at location*` (number), toggles `Notify on min balance breach`, `Notify on max balance breach`, `Add`.
- [I] Min > Max, negative and zero handling unknown. [A] Existing automation adds a balance rule, yet none exist now, so rules may have been deleted or the automation may have targeted another project **[Q9]**.

### 5.10 Material Master [O]
- `Add Material`, `Upload` (reveals `Upload File`, `Download Template` inline), `Export`. ~134 items, 25 per page, numbered pages + Previous/Next.
- Columns: expand toggle, `Category`, `Material ID`, `Name`, `Parent Material`, `UOM`, `Items`, `ADD`, row menu.
- Row menu: `Edit`, `Delete`, `Map Supplier`, `Statistics`. Expand shows items (e.g. `SKU ID`).
- `Add Material` modal: `Category *`, `Material Name*`, `UOM *`, `Parent Material` (optional), `Supplier` (optional), `Add`.
- Row `ADD` → `Add Item` modal: `Name*`, `Conversion*`, `Add`.
- **Bulk upload [O]:** `Upload` shows `Upload File` and `Download Template`; `Upload File` opens the file picker directly. Template `material_bulk_upload_template.xlsx`: sheet `Materials`, columns `category | material_name | uom | item_name | item_conversion`, three sample rows (e.g. `Concrete | Ready-Mix Concrete 4000 PSI | Cubic Yards`; `Drywall | Gypsum Board 5/8 in | sheets | Pallet of 50 sheets | 50`). `uom` has a dropdown fed from a hidden `_Lists` sheet holding the project's UoMs (36 on NRVC_Hall, matching Common UoM). `category` has no dropdown. No Parent Material or Supplier columns. Results appear on Bulk Upload Status as type `Materials`.

### 5.11 PreShipping Checklist [O]
- Table `# | Question | Enabled` (~49 questions, mix of enabled/disabled checkboxes). **No Save button**, so [I] toggling probably autosaves. Not tested.
- Depends on Configuration Options `Pre-Shipping Checklist` = On [I].

### 5.12 Bulk Upload Status [O]
- Filters: date range (default last 30 days, `30/09/2026 → 30/10/2026`), `All Upload Types` (`Submittals, Suppliers, Materials, Sites, Supplier Map, Components, Inventory`), `Search by uploader…`.
- Columns `Date | Added By | Bulk Upload Type | Status | Uploaded File | Success File | Failure File`. Statuses seen: `Success`, `Failed`, **`-` (no status)** → known defect **SCP-DEF-001**.
- Exact rows with no status (re-checked 2026-10-30, default range 30/09–30/10/2026, 6 of 25 rows): all are type **Materials**, uploaded **26/10/2026** by the admin, file `material_bulk_upload_template (1).xlsx`. Four have only an error file (`UploadErrors_20261026_120251…`, `…115341…`, `…114851…`, `…114216…`). Two have **both** a success and an error file (`…114148…`, `…114000…`): partial successes, where no status is expected (R17). The four with only an error file and no status are fully failed uploads that must show `Failed` → **SCP-DEF-001** (R20).
- **Purpose (R13):** the project's upload history. Every Excel upload from any upload screen (Material Master, Site Details, Inventory, Suppliers, Submittals, …) is tracked here with status (pass/fail), uploader and date, and the success and failure reports can be downloaded. The status is how the user knows whether an upload worked.

### 5.13 Procurement Log Configuration [O]
- "Drag rows to reorder — the top row is the first column in the procurement log." "Material Name, Submittal No and Supplier Name are always required and can't be disabled."
- Table `# | Field Name | Enabled | Actions` (43 rows). Locked rows 4–6 show `(Locked)` with disabled checked checkbox. Custom fields show `(Custom)` and two icon actions (**[I]** edit/delete **[Q7]**).
- `Add Log Fields` modal: `Field Name*`, `Field Type*` (`Number`, `String`, `Date`), `Add`. `Save Changes` for enable/order changes.
- Console: React `defaultProps` deprecation warning (non-functional).

### 5.14 Site Details [O]
- `Add Site`, `Upload` (inline `Upload`, `Download Template`), `Export`. 13 sites. Columns `Site Type | Name | City | Country | Locations`, `ADD`, row menu (`Edit`, `Delete`).
- `Add Site` modal: `Site Type*` (`Warehouse`, `Site_type3`, `Site`), `Name*`, `Address`, `City`, `Country` (dropdown), `Add`.
- **Address (R34):** no typing suggestions; the user types the address (expected). The modal shows "Address autocomplete disabled — add a Google Maps key in Django admin…"; this is an informational message, not a defect.
- Row `ADD` → `Add Location`: `Location Type*` (`Construction Area`, `Substore`), `Name*`, `Add`.
- **Bulk upload [O]:** `Upload` shows `Upload` and `Download Template`; `Upload` opens the file picker directly. The file input accepts **any file type**, one file. Template `site_bulk_upload_template.xlsx`: sheet `Sheet1`, columns `site_name | site_type | location_name | location_type`, sample rows `Location 1 | local | CNTR_AREA_ONE | CONSTRUCTION`, `Location 2 | rural | GATE_1 | GATE`, `Location 3 | urban | GODOWN_1 | GODOWN`. **No dropdowns**, and the sample types (`local/rural/urban`, `CONSTRUCTION/GATE/GODOWN`) differ from the types offered in the UI (`Warehouse/Site_type3/Site`, `Construction Area/Substore`) – OBS-14. No City/Country/Address columns. Results appear on Bulk Upload Status as type `Sites`.
- Downstream [O]: sites populate the global site selector.

### 5.15 Submittal Manager [O]
- Notice only: "This page is being repurposed. For Procore- or Autodesk-synced submittals, use the Submittal Manager entry inside the corresponding integration group in the sidebar." (Agreed scope: validate load + notice only.)

### 5.16 System Messages [O]
- "Author and schedule banners that appear at the top of the app. Messages you create are scoped to the current project."
- Table `Scope | Severity | Title / Body | Window | Status | Actions` (6 rows, all `Project` / `Info` / `Scheduled`), `Edit`, `Delete`.
- `New message` / `Edit` open an inline form: `Scope` (only "Project (this project only)"), `Severity` (`Info`, `Warning`), `Title (optional)` max 120, `Body (markdown)` required, max 2000 with counter `n/2000`, live `Preview`, `Starts at` / `Ends at` (datetime-local), `Active` checkbox, `Cancel`, `Create`/`Save`. Edit pre-fills all fields.
- Helper: "Supports **bold**, *italic*, [link](url), `code`, and bullet/numbered lists. Raw HTML, images, and headings are stripped."
- [I] Ends-before-starts validation, banner dismissal (×) persistence and Warning styling are not verified.

### 5.17 Watched Materials [O]
- "Site managers and admins can be assigned categories or trades to monitor…"
- `User` select (long list with repeated display names, see Q4). Selecting a user shows table `Type | Value | Notifications | Assigned by | Created` with `On` toggle and `Remove` per row, plus `Add watch` (`Category`/`Trade` + value select).
- Downstream [O]: the current user's watched categories appear on Management Dashboard ("Your watched materials").
- Console: React duplicate-`key` warning on this page.

### 5.18 Setup Wizard
- **Business rule (R10):** the `Setup Wizard` menu item appears under Project Management only while the project's configuration is incomplete. Once setup is complete, it is no longer shown in the menu. The wizard adds no separate functionality: it brings the individual pages' functions (Integration, Directory, Project Config, Sites, Material Category, Materials, Suppliers, mapping, first submittal) together on one page. After completion, changes are made on each module's own page.
- [O] SCP_Testing_Ram (setup not finished): `Setup Wizard` is the first PM menu item; it opens `/setup-wizard` with Integration ✓, Directory ✓ and step 3 "Core project settings" (Currency + alert thresholds, "You can fine-tune all of this later on the Configuration Options page"). LLE - Test: no menu item.
- [O] NRVC_Hall (setup complete): no menu item; `/setup-wizard` still opens `Project Setup` with all nine steps ✓ (Integration, Directory, Project Config, Sites, Material Category, Materials, Suppliers, Suppliers->Materials, First Submittal), "Setup complete" and `Go to Management Dashboard`.
- [I] Not yet observed: the menu item on an unconfigured project, which conditions count as "configuration done", and whether the item disappears straight after the last step or only after a reload. Detailed step rules are in `PROJECT_SETUP_WIZARD_REQUIREMENTS.md` [D].

### 5.19 Role and user configuration – Voyage Control Admin (walkthrough in progress)

Source: product owner walkthrough with screenshots, 2026-10-30 (evidence tag **[S]** = seen in the product owner's screenshots, not yet explored by us). Rule R22: roles are configured here, not in SCP.

**Navigation path [S]:**
1. Log in at the common SSO URL as the **Organization Admin / Super Admin** (credentials to be stored in `.env` as `SCP_ORG_ADMIN_*`).
2. The platform chooser shows more tiles than the Project Admin sees: `V4 Admin`, `Voyage Control Admin` ("Admin portal for all voyage control platforms"), `Analytics` (v2, v3), `Supply Chain Planner`, `V3 Construction deliveries`, `V4 Construction & Events`. The Project Admin sees only Supply Chain Planner and V3 Construction deliveries [O].
3. Open **Voyage Control Admin**.
4. In the platform dropdown at the top (default `V3 Construction deliveries`; options `V3 Construction deliveries`, `Supply Chain Planner`, `Payment Service`, `Analytics`, `Geofence Service`), select **Supply Chain Planner**. A region selector next to it shows `us-west-2`.
5. Open **Roles** in the left menu (corrected by the product owner: Roles, not Users).
6. **Edit** a role and change its access to match the requirement (screen details not yet seen).

**Access rule (R40):** only the **Organization Admin** has the `Voyage Control Admin` tile. Other users, e.g. the Project Admin, don't see it [O: the Project Admin chooser lists only Supply Chain Planner and V3 Construction deliveries].

**Admin portal layout [S]:** left menu `New Project`, `Projects`, `Organizations`, `Roles`, `Users`, `Platforms`, `Webhooks`, `Global Masters`, `Global Variables`, `Collapse`. The Projects list (V3 platform shown) has a project-name search, `Filter`, columns status (`ACTIVE` / `PRE-LIVE` / `FINISHED`), project name, `Project Organization`, `Address`, `Account Manager`, `HubSpot`, page size 10, "Showing 10 entries of 74 entries".

**Update Role dialog [S] (screenshot, 30 Oct):** Roles → Edit opens **"Update Role"**: a scrollable list of permissions, each `<Area>: <Action>` with a checkbox, a `Save` button at the bottom and a close (X) icon. Examples seen (one role; which role was not stated):
- `Supplier: Edit` ✓, `Supplier: Invoice View` ☐, `Supplier: Issues: View` ✓, `Supplier: List` ✓
- `System Messages: Create (Platform)` ☐, `System Messages: Create (Project)` ☐, `System Messages: Delete (Platform)` ☐, `System Messages: Delete (Project)` ☐
- `Tasks: Edit` ✓, `Tasks: List` ✓
- `Users: Create or Add new users`, `Edit any user details`, `Edit own user details`, `Invite project user`, `List system users`, `Search & Filter users`, `View all user details`, `View own user details` ✓; `Users: Material Watch` ☐, `Users: Material Watch Assign` ☐
- `VehicleTypes: …` (create, change, delete, list) ✓

So permissions are **per action** (List / View / Create / Edit / Delete, and Project vs Platform scope), not a single View/Edit switch per page. The PM-related ones visible so far: **System Messages** (Create/Delete, Project/Platform) and **Users: Material Watch / Material Watch Assign** (Watched Materials). The names for the other PM pages (Material Master, Material Category, Site Details, …) are further up the list – Q-ROLE-1.

**Permission model (R41):** per page, **View** or **Edit**, implemented as the per-action checkboxes above.

**Full Update Role list – Project Admin role, Supply Chain Planner [S] (screenshots, 30 Oct).** Header banner: "Select new permissions for **Project Admin** role that will apply for **Supply Chain Planner**"; `SELECT ALL` checkbox; one checkbox per permission; hovering a label shows its internal key (e.g. `booking:can_update_any_status`, `permissions:list`); `Save` at the bottom. Note: in this list System Messages and Users: Material Watch are **ticked**, so the earlier screenshot (where they were unticked) was a different role.

**Project Management pages → permissions** (✓ = ticked for Project Admin):

| PM page | Permissions | Project Admin |
|---|---|---|
| PM menu / screen | `Menu: Project Management section`; `Screen: Project Management: View project management screen` | ✓ ✓ |
| Integrations (Booking, TheLink, XER) | `Project: Integrations: View available integrations` / `User is able to setup a new integration` / `Make updates to existing integrations` | ✓ |
| Configuration Options | Comes with **Project Management tab access** (R52) | ✓ |
| FDI Config | `FDI: View`, `Create`, `Edit`, `View Inspectors`, `Manage Inspectors`, `Manage Questions`, `Self-Assign Inspector`, `Sync to Procore`; **`FDI: Assign Inspector`** | all ✓ except **Assign Inspector ☐** |
| Inventory Control | `Inventory: Control rules: List` / `Add` / `Edit` / `Delete` | ✓ |
| Material Master | `Material: List` / `Add` / `Edit` / `Delete` | ✓ |
| Site Details | `Project: Site: View or list site information` / `Create a new project site` / `Edit site details` / `Delete or remove a project site`; site contacts: `Add` / `Update/Edit` / `Remove` / `View site contact information` | ✓ |
| System Messages | `System Messages: Create (Project)` / `Delete (Project)` / `Create (Platform)` / `Delete (Platform)`; also `Banner: Create` / `Update` / `Delete system banners` | ✓ |
| Watched Materials | `Users: Material Watch`; `Users: Material Watch Assign` | ✓ |
| PreShipping Checklist | No PM-config permission seen; delivery side: `Delivery: View precheckList` / `Add` / `Edit` / `Approve reject checklist` | ✓ |
| Procurement Log Configuration | Comes with **Project Management tab access** (R52) | ✓ |
| Common Utilities / Common UoM / Material Category | Comes with **Project Management tab access** (R52) | ✓ |
| Bulk Upload Status | Comes with **Project Management tab access** (R52) | ✓ |
| Submittal Manager, PreShipping Checklist (PM page) | Come with **Project Management tab access** (R52) | ✓ |

**Unticked for Project Admin:** `Currency: Rate Management`, `External Import: Invite Contacts`, `External Import: Run Sync`, `FDI: Assign Inspector`, `Files: List`, `Notifications: Receive CC Copies of Alert Emails`, `Notifications: Receive Subcontractor Notifications`, `Notifications: Supplier Contact`, `PO: Apply`, `PO: Validate`, `Procurement Log: Bulk Edit`, `Project: Delete`, `Submittal: View All Organisations`.

**Possible link to known defects:** `FDI: Assign Inspector` is unticked for Project Admin. SCP-DEF-012/022 record that no "Assign/Reassign" action is offered; this permission may be why (Q-ROLE-2). Roles that may be changed for testing: Subcontractor, Supplier (R42). Roles are assigned at user creation in SCP User Management; the Org Admin can also create users in this portal (R43).

**Still to see:** the exact layout of the role Edit screen (how the View/Edit choice is shown per page).

**Testing notes:**
- This portal manages **all** Voyage Control platforms and projects, including non-test ones (e.g. ACTIVE customer-looking projects). Automation must limit itself to the SCP platform and the test users/roles agreed with the product owner.
- Logging in as the Org Admin needs its own browser context, so it doesn't replace the Project Admin session.

## 6. Module dependencies

```
Common Utilities (currency_type) ──► Configuration Options › Currency Type
Common UoM ───────────────────────► Material Master › UOM
Material Category ────────────────► Material Master › Category
                                   ├► FDI Question Sets (category scope)
                                   ├► FDI Inspectors (By Material Category)
                                   └► Watched Materials ──► Management Dashboard widget
Material Master (+ items) ────────► Inventory Control › Inventory Item [I]
                                   └► Procurement Log / Supplier mapping [I]
Site Details (+ locations) ───────► global Site selector; Inventory locations [I]
Configuration Options ────────────► GRN, Pre-Shipping gating, alerts on Dashboard [I]
PreShipping Checklist ────────────► Procurement Log deliveries [A]
Procurement Log Configuration ────► Procurement Log columns / Add Submittal [A]
FDI Config ───────────────────────► First Delivery Inspections module [A][D]
System Messages ──────────────────► Project Notice banner on all pages [O]
Uploads (Material/Site/Inventory) ► Bulk Upload Status [O]
```

## 7. Observations and defect candidates

Defect candidates (DEF-C*) are not yet in `config/scp-known-defects.js`; registering them needs approval because that file is configuration.

| # | Page | Observation | Status after review |
|---|---|---|---|
| OBS-1 | Bulk Upload Status | 6 Materials upload rows from 26/10/2026 with status `-` (details in §5.12) | 2 partial successes are expected (R17); 4 fully failed rows are **SCP-DEF-001** (narrowed 30 Oct, R20). The existing test `scp-project-management-readonly.spec.js` still counts partial successes; update it when automation changes are approved |
| OBS-2 → **SCP-DEF-023** | FDI Config › Invite | Organization list has duplicate `Amazon` and `Meta`; must be unique (R6) | **Registered as known defect, 2026-10-30** |
| OBS-11 | PM menu | `PreShipping Checklist` is in the menu on NRVC_Hall but not on LLE - Test or SCP_Testing_Ram | **Expected (R39)**: follows the Config Options toggle |
| OBS-12 → **SCP-DEF-024** | XER Import › Manage tasks | Clicking the checkbox does not select a task; clicking the row does | Accepted for now, but an issue (R63); **registered as known defect 30 Oct** |
| OBS-13 | XER Import › Manage tasks | Dialog opens with nothing ticked even when tasks are visible; Save sets the visible set to the new selection (previous tasks hidden) | **Current behavior = expected for now (R50)**; differs from the draft requirement |
| OBS-14 | Site Details › upload template | Sample `site_type`/`location_type` values (`local/rural/urban`, `CONSTRUCTION/GATE/GODOWN`) don't match the UI types; no dropdowns in the template | Answered (R44): on-screen project types are valid; samples are placeholders |
| OBS-15 | Site Details › upload | File input accepts any file type (no `.xlsx` filter) | Wrong type must be rejected by the server (UPL-SITE-11) |
| OBS-16 → **DEF-C6** | Site Details › Export | 30 Oct: the page lists 13 sites, the export (`Site_Details_Report_<date>.xlsx`, sheet `Site_Location_Data`) has **1 row** (`Location 1`, `Site`, `Cntr_Area_One` – the upload template's sample data) and its `Location Type` column holds an ID instead of a type | Defect candidate (SITE-11) |
| OBS-17 → **DEF-C7** | Configuration Options › Cancel | 30 Oct: `Cancel` sets the three week fields to `0` on screen (also without any edit) instead of restoring the saved values (`1`/`1`/`1`). Nothing is saved; a reload shows the saved values | Defect candidate (CFG-03) |
| OBS-18 → **DEF-C8** | Left menu › XER Import, Watched Materials | 30 Oct: opening **XER Import** or **Watched Materials** does not highlight its menu entry; the other 15 entries are highlighted when opened | Defect candidate (NAV-01) |
| OBS-19 | Configuration Options › `?` help icons | 30 Oct: the tooltip opens on **click**, not on hover; the texts match R19 | Observation (CFG-12) |
| OBS-20 → **SCP-DEF-028** | Common Utilities › Add | 30 Oct (Regression part 2): an existing utility name in another case is accepted (`CURR PMR2-2610302339 E` next to `Curr PMR2-2610302339 E`); the same name with extra spaces is rejected | Known defect (REF-09, R2/R15) |
| OBS-21 → **SCP-DEF-029** | Common UoM › Add UOM | 30 Oct: an existing UoM name with extra spaces (saved trimmed, so it shows twice identically) and in another case is accepted. Renaming a UoM to an existing name is silently refused (correct) | Known defect (REF-20, R2/R15) |
| OBS-22 → **SCP-DEF-030** | Configuration Options › Save | 31 Oct: a week field set to `-1` is saved ("Project configuration updated successfully", kept after reload); `abc` is not saved | Known defect (CFG-06, R69) |
| OBS-23 | Material Category › Load Defaults | 31 Oct: opens a *Measurement System* menu (Imperial / Metric); choosing Metric added 1 category (83 → 84) with no duplicate names | Observation (REF-18) |
| OBS-24 | Material Master › Upload | 31 Oct: `Upload File` → *Upload Confirmation* (Cancel / Upload) → *Material bulk upload* progress dialog (Reading file … Complete) with Total rows / Succeeded / Duplicates / Rejected / New categories and rejection reasons. Unknown category or UoM stops at *Waiting for your input*: categories can be created or rejected; UoMs can only be mapped to an existing UoM or rejected. A pending upload waits 24 h and is listed as *Waiting for your input* in Bulk Upload Status | Observation (UPL-MM-*) |
| OBS-25 → **SCP-DEF-038** | Bulk Upload Status › Sites | 31 Oct: every site upload has status `-`, also when fully successful (success report only) | Known defect (BUS-08) |
| OBS-26 → **SCP-DEF-039** | Site Details › Upload | 31 Oct: `site_name` = an existing site in another case adds the location to that site instead of rejecting the row (R46) | Known defect (UPL-SITE-08) |
| OBS-27 → **SCP-DEF-037** | Header site selector | 31 Oct: the selected site is not kept on reload; the app picks the first site in the list, i.e. the newest one (sites created by tests become the default) | Known defect (Enterprise refresh check) |
| OBS-3 | FDI Config › Invite | Malformed email gives no inline message; the disabled Send button is the only signal | Accepted behavior (R4) |
| OBS-4 | TheLink Integration | Text refers to a "team ID" field that is not shown | Out of scope (R7) |
| OBS-5 | Site Details › Add Site | No address suggestions; Google Maps key message shown | **Expected (R34)**: DEF-C2 withdrawn |
| OBS-6 | Add modals | Escape does not close modals; only X/Cancel do | [O] (UX) |
| OBS-7 | Watched Materials | React duplicate-key warning; user list has many identical display names | [O] |
| OBS-8 | Setup Wizard | Hidden from the PM menu on NRVC_Hall. **Expected:** the item is hidden once setup is complete (product owner, 2026-10-30), so this is not a defect. Note: existing automation step `verifySetupWizard` clicks that menu button, which can't succeed on a configured project; review it when automation work is approved | [O], rule confirmed |
| OBS-9 | Login page | Empty `<title>`; favicon 404 | [O] |
| OBS-10 | Config Options | `?` help text appears on real mouse hover after a delay (text in R19); automation needs a real hover and must wait for the text | Resolved: works |

## 8. Outstanding questions

Answered so far (R1-R70, see §1a).

Still open:

1. **Roles:**
   - ~~Q-ROLE-1~~ Answered (R52): they come with the Project Management tab access.
   - Q-ROLE-2: `FDI: Assign Inspector` is unticked for Project Admin. Is that why SCP-DEF-012/022 (no Assign action) happen, and should it be ticked?
     Evidence (30 Oct): [Update Role – Project Admin, `FDI: Assign Inspector` unticked](evidence/fdi-assign-inspector-permission-project-admin.png) and [NRVC_Hall First Delivery Inspections – unassigned records offer only `Self Assign`](evidence/fdi-unassigned-record-self-assign-only.png) (18 records "Auditor Not Yet Assigned", Project Admin account). Product owner is checking.
2. **XER Import:** the requirement needs clarity from the product owner (R50); until then the current flow is tested. OBS-12 is accepted for now but is an issue (R63) – registered as SCP-DEF-024.
3. **FDI (from the FDI Settings and Inspection Report requirements):**
   - ~~Q-FDI-1~~ Answered (R59): uploads off → no Photos section on new FDI forms.
   - Q-FDI-2: formats answered (R66: all common formats). Still open: do setting changes affect saved (not yet submitted) drafts, and is there a file size / count limit?
   - ~~Q-FDI-4~~ Answered by observation (R55): on pending rows the `Enable` button is disabled ("Activates automatically once the invite is accepted").
   - ~~Q-FDI-5~~ Answered (R60): Status = user account, Enabled = inspector mode.
   - ~~Q-FDI-6~~ Answered (R61): `—` = no material mapping made yet.
   - ~~Q-FDI-7~~ Skipped for now (product owner): FDI-25b deferred; FDI-25c checks one and many rows only.
   - Q-FDI-8: the second project in NRVC_Hall's organization can be created by the Org Admin (any organization) or a Project Admin of that organization (R65). Proposed one-time setup: the Org Admin creates `SCP_PM_SameOrg_Test` in NRVC_Hall's organization and adds the test accounts. Approve the name and the one-time creation? (Also: which organization is NRVC_Hall in?)
4. ~~Reference data across organizations (Q-REF-1)~~ Answered: currency list shared, project picks its currency (R58); Common UoM and Material Category are per project (R64).
5. **Q-ID-1:** NRVC_Hall's project ID is `…0063` (R70), but the Booking Integration page and the Material Master export show `…0095`. Which ID should each screen show?
6. **Q-UPL-1:** A material upload row with `item_conversion` but no `item_name` is accepted (the material is created without an item; UPL-MM-12, 31 Oct). Should it be rejected?
7. **Q-INV-1:** Inventory Control accepts Min greater than Max (100 / 10) and a negative Min (-1) (INV-04, INV-05, 31 Oct). Should these be rejected?
