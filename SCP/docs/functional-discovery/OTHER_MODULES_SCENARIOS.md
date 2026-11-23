# Remaining Modules – Smoke and Regression Scenarios (Draft for Review)

> **Step-by-step flows (Action → Expected, matching the automated steps):** [MODULES_SMOKE_STEPS.md](steps/MODULES_SMOKE_STEPS.md), [MODULES_REGRESSION_STEPS.md](steps/MODULES_REGRESSION_STEPS.md)

Source: [APP_MAP_SWEEP.md](APP_MAP_SWEEP.md) plus form probes on 2026-11-02 (NRVC_Hall, Project Admin). Order follows the automation priority: User Management → Supplier List → FDI → Document Management → Shipments → Dashboard → Enterprise → Analytics.
Impact: **R** read-only · **C** client-side (form opened and cancelled) · **M** mutates (approved: create new records, delete only run-owned records). Ev.: **O** observed · **I** inferred, confirm before automating · **APP-R1** Analytics tested as observed.

**Common rules:** navigate with menu clicks (groups collapse after each navigation, so re-expand the parent); allow 3–5 s for page data; never click date inputs (SCP-DEF-002 pattern); every created name carries `<RUN>`.

## 1. User Management (`/user-management`)
| ID | Title | Type | Impact | Expected | Ev. |
|---|---|---|---|---|---|
| UM-SMK-01 | Page loads | SMK | R | Search users…, `Filter`, `Invite Users`; columns Status, Name, Email Address, Associated Organization, Platform Role; User Profile panel (First/Last Name, Email, Phone, Company) and Roles (Project Role, Organization Role) with `Save`, `Remove From Project` | O |
| UM-SMK-02 | Invite dialog | SMK | C | "Invite Users": modes `Manual entry` / `From Procore directory`; `Email *`, `Organization`, `Role *`; `Add Another User`, `Cancel`, `Send Invites` | O |
| UM-REG-01 | Invite validation | NEG | C | Send Invites with Email/Role empty → required messages; nothing sent | I |
| UM-REG-02 | Invite a yopmail user | POS | M | `um.<RUN>@yopmail.com` + role → invite listed with a pending status | I |
| UM-REG-03 | Invalid / duplicate email | NEG | M | Rejected with a message | I |
| UM-REG-04 | Add Another User | POS | C | Second email row appears; both validated | I |
| UM-REG-05 | Search and Filter | POS | R | Search by name/email ignoring case; Filter narrows by status/role | I |
| UM-REG-06 | Edit profile and role | POS | M | Change the invited user's Project Role → Save → persisted after reload | I |
| UM-REG-07 | Remove From Project | POS | M | Only on the run-invited user → removed from the list | I |
| UM-REG-08 | Role access (config-based, PM R9/R40–R43) | ROLE | M | Supplier/Subcontractor role page access follows the Roles configuration; restore afterwards | I |

## 2. Supplier List (`/supplier-list`)
| ID | Title | Type | Impact | Expected | Ev. |
|---|---|---|---|---|---|
| SL-SMK-01 | Page loads | SMK | R | Search suppliers…, `Add Supplier`, `Bulk Map Material to Supplier`, `Upload`, `Export`; columns Supplier ID, Supplier Name, Type, Source, Contact Person, Contact Email, Contact Phone no, Map Material; ≥ 1 row | O |
| SL-SMK-02 | Add Supplier form | SMK | C | Supplier Name*, subcontractor checkbox, Line 1*, Line 2, Town/City*, State/Region*, Zipcode*, Country*, Contact Person*, Contact Email*, Contact Phone no.*, Default Lead Time (weeks) ("Leave blank to derive from history"); Cancel/Save | O |
| SL-SMK-03 | Upload menu | SMK | R | `Supplier List Upload`, `Supplier List Download Template`, `Supplier Map Upload`, `Supplier Map Download Template` | O |
| SL-REG-01 | Add Supplier validation | NEG | C | Save empty → required messages for the 9 starred fields | I |
| SL-REG-02 | Add Supplier | POS | M | `Supplier <RUN>` saved and searchable | I |
| SL-REG-03 | Duplicate supplier name (case/space ignored, PM R2/R15) | NEG | M | Rejected | I |
| SL-REG-04 | Invalid email / phone / lead time | NEG | C | Field-level messages; lead time integer ≥ 0 | I |
| SL-REG-05 | Add as subcontractor | POS | M | Type shows Subcontractor; selectable in Inventory's Subcontractor list | I |
| SL-REG-06 | Map material to supplier (row) | POS/INT | M | Mapped material appears in Procurement's Add Submittal material list for that supplier | O (filtering seen), I |
| SL-REG-07 | Bulk map | POS | M | Bulk page (`← Supplier List`, supplier filter, checkboxes, `Selected only (N)`, `Map Suppliers to Materials`) → mappings saved | O (page), I |
| SL-REG-08 | Supplier List upload | POS/NEG | M | Template from the same run; valid rows created; invalid rows rejected with reasons; Bulk Upload Status entry | I |
| SL-REG-09 | Supplier Map upload | POS | M | Mappings created from the template | I |
| SL-REG-10 | Export | POS | R | File matches the list (count and columns) | I |


### 2a. Supplier List observed end to end (2026-11-02, run supplier `Supplier SLD2611021715`)
- Empty Save → 9 inline messages: Supplier Name, Line 1, Town/City, State/Region, Zipcode, Country, Contact Person, Contact Email, Contact Phone "is required". (SL-REG-01 → **O**)
- Invalid email (`not-an-email`) → save blocked by the browser's own email check only; no app message (OBS-SL-1, low).
- Valid save → "Supplier added successfully"; listed with ID 0230, Type Supplier, Source `-`. (SL-REG-02 → **O**)
- Duplicate name in another case with surrounding spaces → "A supplier named 'Supplier SLD2611021715' already exists in this project. It appears in your supplier list, which includes sub-contractors." (SL-REG-03 → **O**, R2/R15)
- Row actions: `Map material` icon and menu `Edit`, `Delete`, `Map Material`, `Promote to SSO Organisation`.
- Map Material panel: Supplier ID/Name, `Add Item Mapping` → "Add Data": Material Name (`Choose Material`), Material ID (auto), Lead Time (Weeks), `SUBMIT`. Empty submit → "Select a material before saving."; saved row `0001 | 43 Inches | 2`. (SL-REG-06 → **O**)
- Cross-module: Procurement Add Submittal lists the new supplier, and its material list contains exactly the mapped material. (SL-REG-06 INT → **O**)

| ID | Title | Impact | Expected | Ev. |
|---|---|---|---|---|
| SL-REG-11 | Map Material validation | C | "Select a material before saving." | O |
| SL-REG-12 | Promote to SSO Organisation | M | Supplier becomes an SSO organisation (not executed: affects login/org setup) | I |
| SL-REG-13 | Edit / Delete supplier (run-owned) | M | Edit saves; Delete removes the run supplier | I |

## 3. First Delivery Inspections (`/first-delivery-inspections`)
| ID | Title | Type | Impact | Expected | Ev. |
|---|---|---|---|---|---|
| FDI-SMK-01 | Page loads | SMK | R | Filters Material, Supplier, Status, Assigned To (inspector email), Delivery Date From/To; columns #, Material, Supplier, Submittal, Delivery Date, Assigned To, Status, Procore, Actions; rows or "No inspections found." | O (NRVC_Hall shows "No inspections found.") |
| FDI-REG-01 | First delivery of a new material creates one inspection | INT | M | Create a new `<RUN>` material → submittal → delivery → GRN → FDI page lists one new inspection for that material (user has FDI access) | R (FDI-R1) |
| FDI-REG-01a | Only one inspection per material | NEG | M | A second delivery of the same material creates **no** new inspection | R (FDI-R1) |
| FDI-REG-01b | Existing material creates none | NEG | R | Delivery of an already-inspected material (e.g. `43 Inches` on 2 Nov) → no new row | O, R |
| FDI-REG-01c | Access needed | ROLE | R | A user whose role lacks FDI screen access does not see the FDI page or records; with access they do (role-based, same model for every screen, PM R9/R41) | R (FDI-R2) |
| FDI-REG-02 | Assign inspector | POS | M | Assign → `awaiting_inspection_completion`; Assigned To shows the email | O (audit trail) |
| FDI-REG-03 | Complete inspection form | POS | M | Questions per FDI settings (PM FDI-05a…d); photos validated (PM R54/R59/R66) → `inspection_completed` | I |
| FDI-REG-04 | Filters | POS | R | Each filter narrows rows; clearing restores | I |
| FDI-REG-05 | No FDI audit trail | INFO | R | No audit-trail view in FDI (PL-R10) | R |


### 3a. FDI end-to-end observed (2026-11-02, record PLD1102-SUB-08 / material "Pld1102 Fdi Material")
- New material → first delivery → GRN created FDI row `Auditor Not Yet Assigned` with **Self Assign** (FDI-R1 confirmed).
- Self Assign → toast "You have been assigned as the auditor for this inspection". The row stays stale until reload; after reload it shows `Awaiting Inspection Completion`, Assigned To = user, actions **Fill Inspection Report**, **Unassign Self**.
- Form `/first-delivery-inspection/<id>/form`: 24 questions (Type: text), each with Result PASS/FAIL/NA + optional Observation; Photos (`Add photo`), Submittal Spec Documents, Observation/Notes; **Save Progress**, **Submit Inspection**.
- Submit without a photo → "At least one photo is required before submitting this inspection." (photo mandatory on NRVC_Hall).
- Submit with 1 photo + all PASS → detail page "Inspection Detail": Status `inspection completed`, Inspected By/At, Provider Sync `Not synced` + `Sync to Provider`, Notes, Responses (24), Photos (1). Text responses can be left "Not answered" (Q-FDI-10: should text answers be required?).

| ID | Title | Impact | Expected | Ev. |
|---|---|---|---|---|
| FDI-REG-06 | Self Assign | M | Toast; after refresh status `Awaiting Inspection Completion`, Assigned To = user | O (row stale until reload) |
| FDI-REG-07 | Unassign Self | M | Back to `Auditor Not Yet Assigned` | I |
| FDI-REG-08 | Photo required | NEG | "At least one photo is required before submitting this inspection." | O |
| FDI-REG-09 | Save Progress keeps answers | M | Reopen the form and answers are kept | I |
| FDI-REG-10 | Submit inspection | M | `inspection completed`; detail page with responses and photos | O |
| FDI-REG-11 | FAIL answer path | M | FAIL accepted with an observation; detail shows FAIL | I |
| FDI-REG-12 | Sync to Provider | M | Provider Sync changes from `Not synced` (Procore) | I |

## 4. Document Management
| ID | Title | Type | Impact | Expected | Ev. |
|---|---|---|---|---|---|
| DOC-SMK-01 | All Documents loads | SMK | R | "N document(s) across this project"; Search; categories (Components, Delivery Photo, EPD, Inventory, Materials, Pdf, PO File, Sites, Submittals, Supplier Material Mapping); columns Filename, Category, Material, Submittal, Size, Uploaded By, Date, Actions (View, Download); pagination | O |
| DOC-REG-01 | Search and category filter | POS | R | Results match filename/material/category | I |
| DOC-REG-02 | Uploaded files appear | INT | M | The run's PO PDF (Procurement CMP-16) is listed under `PO File`; GRN/checklist PDFs listed for the delivery | I |
| DOC-REG-03 | View / Download | POS | R | File opens / downloads with the same name and size > 0 | I |
| DOC-SMK-02 | Spec Documents loads | SMK | R | File upload; columns Filename, Size, Status, Uploaded by, Uploaded, Spec Section No; actions Edit Spec Section No, Download, Send to TheLink, Delete | O |
| DOC-REG-04 | Upload spec document + edit Spec Section No | POS | M | Listed with Status; Spec Section No editable; Delete only on the run's file | I |
| DOC-SMK-03 | PO Validation loads | SMK | R | "Upload a Purchase Order file to validate against existing data."; drop zone "Supports .xlsx, .xls, .pdf — multiple files OK"; Back | O |
| DOC-REG-05 | PO validation result | POS | M | Upload a run PO file → validation result against Procurement data (Q-PL-13: line-item format still needed) | I |
| DOC-SMK-04 | BOM Validation loads | SMK | R | File upload + Back | O |
| DOC-SMK-05 | EPD Report loads | SMK | R | Upload EPD (submittal select + file), `Scan Procore for EPDs`; columns Submittal, Product, Manufacturer, GWP A1-A3, GWP Total, Status, Actions | O |
| DOC-REG-06 | Upload EPD for a run submittal | POS/INT | M | Record listed; Procurement "EPD Exists" for that submittal becomes Yes | I |

## 5. Shipments (International / Enterprise)
| ID | Title | Type | Impact | Expected | Ev. |
|---|---|---|---|---|---|
| SHP-SMK-01 | International Shipments loads | SMK | R | `+ Log Shipment`; tabs Risk Dashboard, Delay Alerts, Flag & Review, Shipments; KPI tiles (Total International, At Risk, Not Yet Ordered, In Transit, Delivered, Delay Alerts) | O |
| SHP-SMK-02 | Enterprise Shipments loads | SMK | R | Active Delay Alerts; search; destination filter; At-risk only; columns Project, Submittal, Manufacturer, Origin, Destination, Shipping Line, Status, ETA, Risk; Edit / Open | O |
| SHP-SMK-03 | Log Shipment form | SMK | C | Submittal * ("Pick a project first"), Manufacturer name *, Manufacturer country *, Container #, Bill of lading, Shipping line, Vessel, Port of origin, Port of destination; Cancel / Log shipment | O |
| SHP-REG-01 | Log shipment for a run submittal | POS | M | Listed in both shipment pages with the entered details | I |
| SHP-REG-02 | Log shipment validation | NEG | C | Required messages for Submittal / Manufacturer / Country | I |
| SHP-REG-03 | Status update in Risk Dashboard | POS | M | Status select (Pending Order … At Port) saved | O (options), I |
| SHP-REG-04 | Flag from Procurement appears once | INT | M | Matches PL-REG-EDT-05; required date and status match the component | O (today `-` / Pending Order) |
| SHP-REG-05 | Edit / Open shipment | POS | M | Edit saves; Open shows the detail | I |

## 6. Management Dashboard (`/management-dashboard`)
| ID | Title | Type | Impact | Expected | Ev. |
|---|---|---|---|---|---|
| DSH-SMK-01 | Dashboard loads | SMK | R | "Your watched materials" (categories), `View in Procurement Log →`, `Manage assignments`; tables by Material Category and Supplier | O |
| DSH-SMK-02 | Alerts / Notifications / Tasks tabs | SMK | R | Counters (e.g. Alerts 99+, Notifications 53, Tasks 99+); `Unread` toggle; "N alerts/notifications/tasks"; `Mark all as read on this page`; columns Description, (Date, Status, Action for tasks), Mark as read, Created At | O |
| DSH-REG-01 | Mark one as read | POS | M | Counter decreases by 1; item leaves Unread | I |
| DSH-REG-02 | Mark all as read on this page | POS | M | Only the visible page is marked | I |
| DSH-REG-03 | Trigger Alert reaches the dashboard | INT | M | Procurement Trigger Alert message appears in Notifications (PL-R14) | I |
| DSH-REG-04 | Daily alert batch (two-phase) | INT | M | Rule met on day 1 → alert on day 2 (PM rule) | I |
| DSH-REG-05 | View in Procurement Log | INT | R | Opens Procurement Log with "Only my watched" behaviour (PL-R8) | I |

## 7. Enterprise (cross-project)
| ID | Title | Type | Impact | Expected | Ev. |
|---|---|---|---|---|---|
| ENT-SMK-01 | Enterprise View | SMK | R | Date range, `Download CSV`, Supplier / Spend / % of total | O |
| ENT-SMK-02 | Supplier Inbox | SMK | R | "Access: 3 projects · 3 organizations"; filters Project, Submittal, Material, dates; sections Unconfirmed Lead Times, Overdue Items, Deliveries to Schedule, Pending Pre-Shipping Checklists | O |
| ENT-SMK-03 | Supplier Performance | SMK | R | 6/12-month toggle; project-wise and supplier-wise summaries | O |
| ENT-SMK-04 | Lead Time Benchmarks | SMK | R | Category comparison table | O |
| ENT-REG-01 | Enterprise counts match Procurement | INT | R | For NRVC_Hall and the same date range, submittal counts match Procurement Log | O (BUGS-325 oracle, existing memory) |
| ENT-REG-02 | Supplier Inbox shows the run's unconfirmed lead time | INT | M | A Not Confirmed run component is listed under Unconfirmed Lead Times | I |
| ENT-REG-03 | Download CSV | POS | R | File rows = table rows | I |

## 8. Analytics (APP-R1: test as observed)
| ID | Title | Type | Impact | Expected | Ev. |
|---|---|---|---|---|---|
| ANA-SMK-01…09 | Each report loads | SMK | R | Aggregate Stats, Lead Time Analysis, Supply Chain Intelligence, Emissions Report, Inventory Reports, Status Report, SubContractor Issues, Supplier Issues, TOV Analytics render their headings/tables (see APP_MAP_SWEEP) | O |
| ANA-REG-01 | Date range filters change the data | POS | R | Narrowing the range never increases totals | APP-R1 |
| ANA-REG-02 | Export works | POS | R | Aggregate Stats / Issues / Emissions export a file with the shown rows | APP-R1 |
| ANA-REG-03 | Status Report Generate | POS | R | Generate by Supplier renders the tables | APP-R1 |
| ANA-REG-04 | Internal consistency | POS | R | Totals equal the sum of their rows on the same page | APP-R1 |
| ANA-REG-05 | TOV Analytics route | Q | R | Opens its own page (today `/supplier-issues`, OBS-APP-1) | O |
| ANA-REG-06 | Supply Chain Intelligence dismiss | POS | M | Dismiss one disruption → count −1 | I |

## Totals
| Module | Smoke | Regression |
|---|---|---|
| User Management | 2 | 8 |
| Supplier List | 3 | 13 |
| First Delivery Inspections | 1 | 15 |
| Document Management | 5 | 6 |
| Shipments | 3 | 5 |
| Management Dashboard | 2 | 5 |
| Enterprise | 4 | 3 |
| Analytics | 9 | 6 |
| **Total** | **29** | **58** |

**Rule FDI-R1 (product owner, 2026-11-02, answers Q-FDI-9):** an FDI record is created only the first time a delivery is completed for a material (one FDI per product), and it is visible to users with FDI access. **FDI-R3:** any user whose role has the rights can self-assign as the inspector and complete the FDI. **FDI-R2:** visibility is role-based: a user whose role has FDI screen access sees the records (the same configuration-based model as every other screen). Today's 43 Inches deliveries created none because that material already had its first-delivery inspection, which is expected.
