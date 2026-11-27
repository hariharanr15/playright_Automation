# SCP application walkthrough after the client redesign

_Staging · NRVC_Hall / Warehoust _NR · Project Admin · 24 Nov 2026_

## How this walkthrough was done

- **Read-only.** Every page was opened from the menu. Every tab was opened. Forms that add, create or edit something were opened and closed with Cancel, never saved. Each first row's action menu was opened to read its items. First-record detail pages were opened. Buttons that act at once (delete, rebuild, send, sync, approve, export, save) were never clicked. No success message appeared during the run, so no data was changed.
- **Coverage.** 53 pages and 53 forms, tabs or menus were captured, with screenshots and page text. A second pass captured International Shipments (it takes over a minute to load), the Procurement Log "Inventory" tab and the new Excel Import page.
- **Tools.**
  - `tests/pm-flow/app-discovery.spec.js` crawls the menu (about 6 min).
  - `tests/pm-flow/app-walkthrough.spec.js` is the deep walkthrough (about 35 min).
  - `scripts/discovery-impact.js` compares the result with the earlier map.

  Raw output and screenshots are in `reports/discovery-2026-11-24/` and `reports/walkthrough-2026-11-24/`. Re-run these after each client deploy.
- **Limits.**
  - The app scrolls inside its own panel, so screenshots show only the first screen. The text capture covers the rest of each page.
  - Five dialogs did not open in time: Invite Users and both role pickers on User Management, and Bulk Map and Upload on Supplier List.
  - Pages with no data on NRVC_Hall show their layout but not their behaviour: Loads, Unallocated Deliveries, Discrepancies, NCRs, EPD Tracker and Messages.
  - The Supplier and Subcontractor views were walked separately (Part D); their access depends on the current role settings, which were not opened.

## Menu now

- Management Dashboard
- Enterprise › Enterprise View · Supplier Performance · Enterprise Shipments
  - Supplier Inbox and Lead Time Benchmarks were removed.
- Procurement Log — tabs List / By submittal / By material / Inventory
- **My Work** (new; replaces Supplier Inbox)
- **Loads** › All Loads · Unallocated Deliveries · Discrepancies (new)
- First Delivery Inspections
- **Messages** (new; needs Delivery Management connected)
- International Shipments
- User Management › User Management · Supplier List
- Document Management › All Documents · Spec Documents · PO Validation · BOM Validation · EPD Report · **EPD Tracker** (new)
- Project Management
  - Project Settings › Configuration Options · Procurement Log Configuration · First Delivery Inspection Config · PreShipping Checklist · System Messages
  - Sites & Storage
  - **NCRs** (new)
  - Materials › Material Master · Material Category · Common UoM · Common Utilities · Watched Materials
  - Inventory Settings › Inventory Control · Inventory Rebuild
  - Imports › **Excel Import** (new) · Bulk Upload Status · Submittal Manager
  - Integrations › Booking Integration · TheLink Integration · XER Import
  - The "Reference Data" group is gone.
- Analytics › Aggregate Stats · Lead Time Analysis · Supply Chain Intelligence · Emissions Report · Inventory Reports · Status Report · SubContractor Issues · Supplier Issues · **TOV Analytics** › Financial Forecast · Submittal Invoiced Orders · Submittal Level Outflow Projection (new group)
- Removed: Inventory Management (its route opens the Procurement Log "Inventory" tab)

## Change level by module

| Module | Change | Main points | Automation affected |
|---|---|---|---|
| Procurement Log | **High** (already adapted for submittal/component/delivery) | Four tabs; new List columns (Component Materials, EPD Status); Bulk Edit controls; EPD Status links to EPD Tracker | PL parts 1–3 pass; column-position checks to review |
| Inventory | **Removed / broken** | Inventory Management removed; Procurement Log "Inventory" tab shows "Couldn't load inventory." (Receive booking / Upload / Export buttons present) | inv-regression (25), INV smoke, PL-REG-INT-03 blocked |
| Management Dashboard | **High** | KPI tiles (discrepancies, NCRs, loads awaiting receipt, unplanned arrivals); "Urgent issues" tabs above Alerts / Notifications / Tasks | DSH-*, E2E TC-23/23B/24 |
| My Work / Supplier Inbox | **Replaced** | Projects at a glance, tasks and checklists across projects; HTTP 500 logged on load | TC-14B/24B, ENT-REG-02/04/05/07 – scope decision |
| Loads, Discrepancies, Unallocated, Messages | **New** | Delivery management: build loads, receive, allocate, discrepancies and NCR log; Messages not connected | No coverage; empty on NRVC_Hall |
| First Delivery Inspections | **High** | KPI cards, most-failed questions, question sets by category, Outcome column; required inspection outcome | FDI-SMK/REG, E2E TC-19…22 |
| International Shipments | **Medium** | Risk Dashboard / Delay Alerts / Flag & Review / Shipments, ShipsGo tracking, new columns (Container / AWB, Port arrival, On site est., vs ROJ) | SHP-SMK/REG, TC-14C/26 |
| Enterprise | **Medium** | Supplier Inbox and Lead Time Benchmarks removed; Enterprise Shipments form adds Ocean/Air and Port-to-site days; View and Supplier Performance unchanged | ENT-REG, ana-ent |
| User Management / Supplier List | **Medium** | Role dropdown per user row and ⋮ menu; Add Supplier is an inline form with Email domains and Invite to Platform | UM-REG, SL-REG, E2E supplier steps |
| Document Management | **Medium** | EPD Tracker new; EPD Report KPI cards and Parse; All Documents "View Data" and PO Validation category; Spec section chosen from a list | DOC-REG |
| Analytics | **Medium** | TOV Analytics split into three new pages; Aggregate Stats redesigned (12 KPI cards); some 18 Nov differences look fixed | ANA-SMK-09, ANV-AGG-01/02, ana-ent |
| Project Management – menu | **High** | Reference Data gone; new groups; PreShipping Checklist back in the menu | PM-SMK-002, PM-REG-NAV-*, navigator |
| Sites & Storage | **High** | Cards instead of a table; inline ADD LOCATION with Building / Area / Laydown / Bay types and parent locations; Bulk upload, Sites report | PM-REG-SITE-*, UPL-SITE-*, PLC-07 (~25 cases) |
| Configuration Options | **Medium** | New "Loads, receipt, P6 and NCRs" section, Date Format, Port-to-site buffer | PM-REG-CFG-*, cfg-live |
| Material Category | **Medium** | Grouped by CSI division; Division column and field | PM-REG-REF-15…23 |
| FDI Config | **Medium** | Question sets shown as chips; organisation question-set entry points on the page | PM-REG-FDI-*, T543, T548 |
| NCRs, Excel Import | **New** | Non-conformance reports; spreadsheet import with saved column mapping | No coverage |
| Other PM pages | Low | Common UoM, Common Utilities, Watched Materials, Submittal Manager, Integrations, Inventory Control, Bulk Upload Status: same pages, new menu place | Navigation only |

## Questions for the client / developer

1. Which new areas are finished and should be covered now: My Work, Loads, Unallocated Deliveries, Discrepancies, NCRs, EPD Tracker, Excel Import, TOV Analytics pages, Messages?
2. Inventory: is the Procurement Log "Inventory" tab the replacement for Inventory Management, and is "Couldn't load inventory." a defect or unfinished?
3. Supplier Inbox and Lead Time Benchmarks were removed: retire their cases or move them to My Work / Lead Time Analysis?
4. My Work logs a server error (HTTP 500) on load – known?
5. Messages needs Delivery Management connected by a platform admin – can this be done on staging?
6. May the automation write on the new pages on NRVC_Hall (build loads, raise NCRs, EPD Tracker settings, Excel Import), and may Inventory Rebuild run "Rebuild" or only "Dry Run"?
7. Supplier and Subcontractor access (Part D): the Supplier menu now includes Project Management settings, and both roles open Analytics, User Management, Supplier List and most settings pages by address. Is this the intended role configuration?

---

# Page by page

## Part A – Core operations


_Source: read-only walkthrough `reports/walkthrough-2026-11-24/walkthrough.json` and screenshots `shots/001…033`, cross-checked with the landing crawl `reports/discovery-2026-11-24/app-map.json`. Project NRVC_Hall / site Warehoust _NR, Project Admin, currency selector "INR - Indian Rupees"._

_Notes on the evidence: the screenshots are only 1920×1080 viewport captures. The page scrolls inside an inner panel, so anything below the first screen (for example the lower half of the Dashboard and the category table on Enterprise View) comes from the text dump only. The walkthrough text is cut off at about 3,000 characters per snapshot and the crawl at 6,000. Anything marked **[I]** is an inference, not an observation._

New top-level menu order: Management Dashboard · Enterprise (Enterprise View, Supplier Performance, Enterprise Shipments) · Procurement Log · **My Work** · **Loads** (All Loads, Unallocated Deliveries, Discrepancies) · First Delivery Inspections · **Messages** · International Shipments · User Management · Document Management · Project Management · Analytics.

---

## 1. Management Dashboard — `Management Dashboard` · `/management-dashboard`

**Purpose:** the project's landing page. It shows urgent procurement problems and watched materials, with the Alerts, Notifications and Tasks feeds further down.

**Layout and controls**
- Four KPI tiles: *Open discrepancies*, *Open NCRs*, *Loads awaiting receipt*, *Unplanned arrivals (30 days)*. All showed 0.
- A collapsible red **"Urgent issues (69)"** panel with filter chips: *All 69*, *Delivery discrepancies 0*, *Lead time later than ROJ 51*, *Order not confirmed in time 17*, *NCRs 0*, *Alerts 1*. The chips add up to 69 (51 + 17 + 1).
- Each issue row reads, for example, "Matchboxes · EW98723894 · Expected 12 Oct 2026 on lead time, ROJ 16 Sep 2026 (26 days late)", with a red tag (e.g. "Lead time later than ROJ") and the supplier. Each row ends in a chevron (›), which was not clicked. Rows are paged 6 at a time ("Showing 1–6 of 69", ‹ 1/12 ›).
- The "Order not confirmed in time" row text reads "Last order date 22 Nov 2026 passed without a confirmed order".
- The "Alerts" chip lists an alert-style text ("Lead time confirmed but last possible order date … has passed … Booking Delay Risk Impacting Plan").
- *Your watched materials*: category chips, `View in Procurement Log →`, `Manage assignments`, and tables by Material Category and Supplier (Open, On-time, LT Var, Avg Lead Time, Delta vs Platform, Confirmed %, Spend, Alerts).
- Buttons `Dashboard`, `Alerts 99+`, `Notifications 52`, `Tasks 99+` are still recorded on this page, below the fold.

**Forms / row actions / detail pages:** none opened. The urgent-row chevrons and the KPI tiles were not clicked.

**Empty data:** the *Delivery discrepancies* and *NCRs* chips show "Nothing here.", and all four KPI tiles are 0, so their behaviour could not be seen. The crawl logged one console 404 on load.

**What changed vs. before**
- New: the four KPI tiles and the "Urgent issues" panel with 6 chips and paging. Before, the page had only the watched materials, the two tables and the Alerts / Notifications / Tasks tabs with charts (DSH_ENT_ANA_DISCOVERY_AND_SCENARIOS.md §1; APP_MAP_SWEEP.md; PL_REDESIGN_RESULTS.md §1).
- New urgent-issue categories (lead time later than ROJ, order not confirmed in time) that did not appear in the earlier docs.
- The watched-materials block and its tables keep the same columns as before.

**Likely affected automation:** `app-smoke.spec.js` (DSH-SMK-01/02), `app-regression.spec.js` (DSH-REG-01…11), `e2e-smoke.spec.js` (TC-23, TC-23B, TC-26), `support/e2e-kit.js` and `support/e2e-kit-v2.js` (dashboard tab helpers), `support/pm-session.js` (landing page), plus `cfg-live.spec.js`, `tickets-regression.spec.js` and `roles-write.spec.js`, which open the dashboard.

**Open questions**
- What does a chevron on an urgent row open?
- The "Alerts 1" urgent chip and the "Alerts 99+" tab disagree. Which alerts count as urgent?
- Are the KPI tiles links to Discrepancies, NCRs or Loads?
- What causes the 404 on load?

---

## 2. Enterprise View — `Enterprise › Enterprise View` · `/enterprise-view`

**Purpose:** a roll-up across every project the user can access ("Access: 13 projects · 3 organizations").

**Layout and controls**
- Header: From/To dates (26/08/2026 → 24/11/2026) and `Download CSV`.
- KPI cards: *Projects in scope 13*, *Open submittals 557 of 666*, *On-time delivery 89.9%* (239 of 266), *Active alerts 2369* ("open, unread, across 7 projects"), *Lead-time variance −82.6%* (n=190).
- *Submittals by status* bar chart with 6 bars: Not Ordered 386, Not Ordered At Risk 1, Ordered 98, Ordered At Risk 1, Partial Delivery 71, Delivered 109.
- *Spend by supplier*: Supplier, Spend, % of total. The total is $3,031,407,501,142, and CKW10000020 holds 99.9%.
- *Projects summary*: Organization / Project, Open, On-time, LT Var, Spend, Alerts, sorted by alert volume.
- A per-category table, from the column list only and below the fold: Category, Your avg (wks), Platform avg (wks), Industry avg (wks), Δ vs platform, Contributing orgs.

**Forms / row actions / detail pages:** none opened.

**What changed vs. before**
- The layout matches the BUGS-325 sections (ENTERPRISE_REQUIREMENTS_BUGS-325.md §A). No structural change was seen.
- The Enterprise menu now has 3 entries. Supplier Inbox and Lead Time Benchmarks are gone (BUGS-325 says "five sub-menus"; RELEASE_IMPACT_2026-11-24.md §1).
- Scope grew to 13 projects. The 28 Oct reconciliation had 9 projects (BUGS-325 doc), which is a data change, not a UI change.

**Likely affected automation:** `app-smoke.spec.js` (ENT-SMK-01…04), `app-regression.spec.js` (ENT-REG-01…07; ENT-REG-04/05/07 target removed pages), `ana-ent-validation.spec.js` (BUGS-325 oracle), `e2e-smoke.spec.js` (TC-24B).

**Open questions**
- Money is shown in **$** although the header selector says INR. This was already raised for the dashboard (PL_REDESIGN_RESULTS.md, TC-23).
- One test supplier dominates spend, so the percentages are meaningless for checks.
- Were the Lead Time Benchmarks KPI cards (Total Delivered, Late, Avg Delay) dropped on purpose, now that only `/lead-time-analysis` remains?

---

## 3. Supplier Performance — `Enterprise › Supplier Performance` · `/supplier-performance`

**Purpose:** on-time delivery, lead times and volume per project and per supplier, across accessible projects.

**Layout and controls**
- Six KPI cards: On-time delivery 88%, Active components 510, Overdue 142, Lead times confirmed 21%, Avg lead time 3.4 wks, Deliveries (90d) 267.
- *Deliveries by month* chart with `6 months` / `12 months` toggle. For Jun–Nov it showed 0, 9, 14, 42, 51, 166.
- *Project wise summary* and *Supplier wise summary* tables: Project/Supplier, On-time, Active, Overdue, LT confirmed, Avg LT (wks), Deliveries (90d).

**Forms / row actions / detail pages:** none.

**What changed vs. before:** no structural change. The cards, chart and two summaries match BUGS-325 §C and APP_MAP_SWEEP.md.

**Likely affected automation:** `ana-ent-validation.spec.js`, `app-smoke.spec.js` (ENT-SMK).

**Open questions**
- Two projects show only their code (PRJSUPCHAPLA0000000087 / …088) and no name. Enterprise View names them "SCP Test Satish" and "SCP - Test -1 - Satish".
- On-time is 88% here but 89.9% on Enterprise View. This may be a different date window **[I]**; confirm against BUGS-325's shared rule.

---

## 4. Enterprise Shipments — `Enterprise › Enterprise Shipments` · `/enterprise-shipments`

**Purpose:** international shipments across all accessible projects, with the external delay alerts that affect them.

**Layout and controls**
- Search ("Search submittal, manufacturer, port, carrier…"), *Destination* select (Any / Chennai / Japan), *At-risk only* checkbox, counter "90 shown · 61 at risk", and `+ Log Shipment`.
- *Active Delay Alerts* cards. Clicking a card filters the table to the affected rows, per the subtitle; this was not tried.
- Grid: Project, Submittal, Manufacturer, Origin, Destination, Shipping Line, Status, ETA, Risk, with row buttons `Edit` and `Open`. The grid is below the fold and not visible in the screenshot.

**Form – "Log new shipment"** (opened and cancelled):
- *Ocean / Air* toggle.
- Required (*): Project (7 projects listed), Submittal ("Pick a project first"), Manufacturer name, Manufacturer country.
- Optional: Container #, Bill of lading, Shipping line, Vessel, Port of origin, Port of destination, Port-to-site days ("Blank = project buffer").
- Buttons: Cancel, Log shipment.

**What changed vs. before** (SHP_DISCOVERY_AND_SCENARIOS.md §1)
- New in the form: the *Ocean / Air* toggle and the *Port-to-site days* field. Inference **[I]**: this field is linked to the new "Port-to-site buffer (days)" setting in Configuration Options (RELEASE_IMPACT §1).
- New: the "N shown · N at risk" counter.
- The delay-alert content changed. Before there was one "Port congestion at Shanghai" HIGH card with 17 affected. Now at least 15 **identical** CRITICAL cards read "Red Sea route disruptions — carriers diverting via Cape of Good Hope", each with 90 affected.

**Likely affected automation:** `app-smoke.spec.js` (SHP-SMK-02/03), `app-regression.spec.js` (SHP-REG-01…11), `e2e-smoke.spec.js` (TC-14C).

**Open questions**
- Is the repeated Red Sea alert card a duplication defect? Because the cards push the grid below the fold, automation must scroll to reach the grid.
- Is Air mode meant to change the fields (container and vessel for air)? This was not checked.

---

## 5. Procurement Log — `Procurement Log` · `/procurement-log`

**Purpose:** the project's submittal and component register. It now has four views.

**Tabs:** `List` · `By submittal` · `By material` · `Inventory`.

**List tab (default)**
- Toolbar: start/end date (24/10/2026 → 24/11/2026), "Search submittals…", *Status* dropdown, *Component Materials* dropdown, `+ Add Submittal`, `Filters`, *Only my watched*, `Select Columns for Bulk Edit`, `Bulk assign Responsible`, `Bulk Delete`, `Import`, `Export`, "585 items", `View Bulk Edit Log`, `Columns`, and ‹ › scroll arrows. Pages 1…24.
- Grid columns: Spec Description, Schedule Id, Material Name (with a "+1" chip), **Component Materials**, Submittal No, Supplier Name, EPD Exists, **EPD Status** (badge, e.g. "Not required"), Date Required On Site, Status (coloured pill), Source, Actual Delivery Date, Total Count ×4 (custom), Spec Section No ×3, Responsible (`Assign`), and a row menu ⋮.
- *Filters* opens the "Advanced Filter" panel inline (`Add Condition`, `Apply Filter`, `Clear Filter`).
- *Columns* opens "Show / hide columns".
- *Import* menu: Import Submittal, Download Template, Import Component, Download Component Template.
- *Select Columns for Bulk Edit* with no rows ticked shows the toast "Select one or more rows before choosing columns to bulk edit."
- *View Bulk Edit Log* opens a modal listing "Bulk Update #N — Spec Description · <email> · date", newest first (#120 on 24/11). Entries were not opened.

**Row detail reached:** clicking the *EPD Status* badge "Not required" opens **Document Management › EPD Tracker**, filtered to that one line (chip "One line ×"). It shows:
- Status chips: Required (missing), Requested, Expiring, Expired, Received, Verified, Not required 614.
- An expanded "EPD requirement" row: "Its category does not need an EPD", a *Follow category* select, Reason (optional), Due date, and `Save`.
- History: "Nothing yet."

**By submittal tab**
- Filters: search, All sites, All trades, All CSI divisions, "CFCI and OFCI", ROJ date range, *Include fully received*, *Show void*, *Group by CSI division* (ticked), and `Export`.
- Columns: Submittal, Owning contractor (with `Change`), Procore status, Required, Ordered, Booked, Received, Damaged, Accepted, Issues, Next ROJ, Issues (e.g. "1 late").
- Per-row buttons: `Manage components`, `Files`.
- Rows are grouped by CSI division with totals.
- Pager ‹‹ ‹ › ›› and Per page 25/50/100.

**By material tab**
- Same filters, without the grouping option.
- Columns: Material, Unit, Status (Late / Ordered / Booked / Part received), Required … Next ROJ, Issues.
- Per-row items: "N submittals ▸" or "1 submittal · <no>", a "Lead time not confirmed" tag, `Manage`, `Files`.

**Inventory tab**
- Controls: Site select, search, chips *All materials* / *In stock · 0* / *Short · 0*, "0 of 0", `Receive booking`, `Upload`, `Export`. Upload and Export look disabled.
- The body showed **"Loading inventory…"** and never loaded. The morning crawl showed "Couldn't load inventory."

**What changed vs. before**
- The tabs are new. The By submittal, By material and Inventory views are new pages. The submittal and component pages were redesigned (PL_REDESIGN_RESULTS.md §1).
- New List columns: *Component Materials* and *EPD Status*. The EPD Status badge links to the new EPD Tracker. Before, the columns were Spec Description … EPD Exists, Date Required, Status … (PROCUREMENT_LOG_FUNCTIONAL_DISCOVERY.md §2).
- New toolbar items: *Component Materials* filter, *Select Columns for Bulk Edit*, *View Bulk Edit Log*. "Assign Responsible" is now labelled *Bulk assign Responsible*. The Import menu items are unchanged (same doc §2.1).
- Filters now opens inline, between the toolbar and the grid.
- Inventory Management (`/inventory-management`) was removed. The Inventory tab keeps its *Receive booking / Upload / Export* buttons but not the old grid (Category, Material ID, Material Name, Inventory, UOM) or the row menu (INVENTORY_FUNCTIONAL_DISCOVERY.md §1).

**Likely affected automation:** `pl-smoke.spec.js`, `pl-regression-2.spec.js`, `pl-regression-3.spec.js` (PL-REG-*; PL-REG-INT-03), `tickets-regression.spec.js` (bulk edit, T517-*), `e2e-smoke.spec.js` (bulk edit log), `pm-decisions.spec.js`, `pm-regression-part2.spec.js`, `cfg-live.spec.js`, `support/pl-flow.js`, `support/pm-navigator.js`, and `inv-regression.spec.js` plus INV-SMK-01…08 in `app-smoke.spec.js`, because the Inventory page was replaced.

**Open questions**
- The Inventory tab never finished loading. Is it a defect, or unfinished work?
- The "Issues" column header appears twice in both grouped views.
- The By submittal view has a "Division 20 No CSI division" group.
- Is the row ⋮ menu unchanged? It was not opened in this walkthrough.

---

## 6. My Work — `My Work` · `/my-work`

**Purpose:** a cross-project to-do overview for the logged-in user ("My work across projects"). It replaces Enterprise › Supplier Inbox (RELEASE_IMPACT §1).

**Layout and controls**
- *Projects at a glance (94 projects)*: search, *Only projects with something to do*, sortable columns Project (with site count), Tasks to do, Overdue (default sort), Submittals late, Awaiting receipt, Open issues. For NRVC_Hall these were 495 / 144 / 37 / 0 / 0.
- Section cards, seen only in the crawl text, so the exact values are an **[I]** reading of run-together text: *Tasks* 1178 (657 overdue · 51 at risk), *Submittals* 720 (170 late), *Materials* 88 (86 late), *Loads*, *Discrepancies & NCRs*, *Pre-shipping checklists* 115.
- A task list with filters: Project, Due from/to, *Assigned to me*, Search tasks, Per page 25/50/100/200. Columns: Status, Task, Type, Due, Raised, Actions.
- The crawl of `?section=checklists` showed a table with Project, Submittal, Material, Supplier, Qty, Expected, Checklist, Waiting on (filter: anyone / supplier / subcontractor) and an `Open` link, with the note "Showing the first rows only — filter by project to see the rest."

**Forms / row actions / detail pages:** none opened. The walkthrough made no probes on this page.

**What changed vs. before:** new page. The old Supplier Inbox had Unconfirmed Lead Times, Overdue Items, Deliveries to Schedule and Pending Pre-Shipping Checklists (BUGS-325 §B; APP_MAP_SWEEP.md). The pre-shipping section is the closest equivalent **[I]**.

**Likely affected automation:** `e2e-smoke.spec.js` TC-14B and TC-24B (they open Supplier Inbox, which now lands here), `app-regression.spec.js` ENT-REG-02/04/05/07, `ana-ent-validation.spec.js` (Supplier Inbox oracle).

**Open questions**
- Both crawl loads logged an **HTTP 500** API error in the console.
- The project list shows test projects with "0 sites".
- Should the BUGS-325 Supplier Inbox rules carry over to My Work?

---

## 7. All Loads — `Loads › All Loads` · `/loads`, and "Build load"

**Purpose:** plan and track inbound loads (deliveries) per site for the week.

**Layout and controls**
- Tabs *Upcoming* / *All loads*, and `Build load`.
- *Upcoming*: All sites, All trades, search ("load, company, material, booking"), *ROJ check* (Any / Early, late or needs aligning / On time), and "Week of 24/11/2026 – 30/11/2026". Four sections, all showing 0 with empty messages: *Arrived and awaiting receipt*, *Due today*, *Later this week*, *Built, not booked*.
- *All loads*: the same filters plus a status select (Open loads, Pending (not booked), Booked or expected, Arrived, Cancelled, Received) and a long site list. It showed "0 loads" and "No loads yet. Build one from your open product lines."

**"Build load" page** (← Loads › Build load):
- Left panel, *Open product lines*: search; columns Product (with submittal · supplier), To load, ROJ; an `Add` button per line. Example: "Samsung S25 Battery, Pending · Samsung India (Electrical), 40 Pieces, 07/09/2026".
- Right panel, *This load*: Site select; Soonest ROJ, Latest ROJ, Delivery window ("Add lines to see it · Up to 14 days before ROJ counts as on time"); Notes; `Save load`, which was disabled while empty.

**What changed vs. before:** new page and new menu group. There was no load concept in the earlier docs (RELEASE_IMPACT §1).

**Likely affected automation:** no existing coverage. Inference **[I]**: the booking and Receive steps in `support/pl-flow.js` and the E2E delivery chain may later need to go through loads.

**Empty data:** no loads exist, so the list, receipt and booking behaviour could not be seen. No write was made.

**Open questions**
- How does a load relate to the existing "Log delivery" / booking flow on the component page?
- Who books a load (supplier or subcontractor)?
- Some open lines show "Pending" where a submittal number would be expected.

---

## 8. Unallocated Deliveries — `Loads › Unallocated Deliveries` · `/unallocated-deliveries`

**Purpose:** per the page text, goods "that arrived without a load and couldn't be matched at receipt. They count as received once they're allocated to their components."

**Layout:** one select (Waiting to be allocated / Allocated / All). The page showed "Nothing here." No grid, buttons or forms were visible.

**What changed vs. before:** new page.

**Likely affected automation:** none yet.

**Empty data / open questions:** the page is empty, so the allocation flow, its columns and its actions are unknown. How does an unplanned arrival get created? The dashboard tile "Unplanned arrivals (30 days)" is probably linked **[I]**.

---

## 9. Discrepancies — `Loads › Discrepancies` · `/discrepancies`

**Purpose:** a register of delivery discrepancies.

**Layout and controls**
- Title "Delivery discrepancies".
- Status select: Open / Resolved / All.
- Kind select: All kinds, Damaged, Wrong product, Inspection rejected, Short delivery, Over delivery, Unplanned arrival, Received after ROJ.
- All trades select, search ("product, submittal, load, what happened"), counter "0 discrepancies", and an `NCR log` button. "NCR log" leads to the NCRs page by its name **[I]**; it was not clicked.
- The page showed "No discrepancies."

**What changed vs. before:** new page. Earlier, damaged and short quantities were only visible in Delivery Conditions on the component (PL docs).

**Likely affected automation:** none yet. Inference **[I]**: PL-REG-DLV cases on damage and shortage (e.g. PL-REG-DLV-13) may in future need a check here.

**Empty data / open questions:** the page is empty. Is a discrepancy raised automatically when a receipt has damaged or short quantities, or only by hand? The dashboard tile "Open discrepancies" depends on it.

---

## 10. First Delivery Inspections — `First Delivery Inspections` · `/first-delivery-inspections`, and "Manage question sets"

**Purpose:** list and monitor first-delivery inspections, and their question sets per material category.

**Layout and controls**
- *Group by material category* (ticked) and `Collapse all`.
- Filters: Search, Material, Supplier, Status, Assigned To (Inspector email), Delivery Date From/To.
- KPI cards:
  - Inspections 119
  - Pending 63 (47 unassigned)
  - Overdue 48 (pending > 7 days)
  - Passed 0
  - Rejected 0
  - Pending review 0 ("56 completed without an outcome")
  - Pass rate — ("0 decided · avg 2.4 days to inspect")
- *Most failed questions* (e.g. "FDI Question 527 – 6 fails · 66.7%") and *Highest supplier rejection rates* ("No supplier with rejections and enough decided inspections").
- *Question sets & results by material category*, with a red badge "200 without a question set" and `Manage question sets`. A yellow warning lists every category whose new inspections "will have no questions". The table has Category, Question set (chip with question count plus `Edit`, or "No question set" plus `Set up`), Inspections, Pending, Passed, Rejected, In review, Pass rate, Avg days.
- Inspection grid: #, Material, Supplier, Submittal, Delivery Date, Assigned To, Status, **Outcome**, Procore, Actions. It is below the fold and was not seen in the screenshot.

**Detail page reached – "Manage question sets"** opens *First Delivery Inspection Config* (Project Management › Project Settings):
- *FDI Settings*: four checkboxes (Need Overall Notes, Enable Uploading of Photos?, Photos are mandatory?, Provide Link to Submittal Spec Documents?), all ticked, and `Save`.
- *Inspectors*: `Invite`, `Add Inspector`; columns Name / Email, Role, Materials Scope (chips plus ✎), Status (Active / Invited - Pending Acceptance), Enabled, Actions (Disable / Enable).
- A questions area: question-set buttons, "Unassigned questions", *Show deleted questions*; columns #, Question, Group, Type, Added On.

**What changed vs. before**
- Landing page: new KPI cards, failure and rejection analytics, the per-category question-set panel with its warning, *Group by material category*, and the new **Outcome** column. Before there were only filters and the grid (APP_MAP_SWEEP.md; FDI_LISTING_REQUIREMENTS.md AC14). The filters are unchanged.
- PL_REDESIGN_RESULTS.md reports that the Material cell now also shows the question set, and that the inspection form has a required "Inspection outcome" section.
- The Config page matches FDI_SETTINGS_REQUIREMENTS.md, with "FDI Settings" in place of "Notification Settings". It is now also reachable from the list.

**Likely affected automation:** `app-smoke.spec.js` (FDI-SMK-01), `app-regression.spec.js` (FDI-REG-01…12), `fdi-settings.spec.js`, `e2e-smoke.spec.js` (TC-19…TC-22), `role-regression.spec.js`, `tickets-regression.spec.js`, `pl-regression-3.spec.js` (GRN → FDI row), `support/e2e-kit-v2.js`, `support/pm-navigator.js`.

**Open questions**
- 56 inspections are "completed without an outcome" while Passed and Rejected are 0. Do inspections completed before the outcome field existed need migration?
- Is the overdue threshold of 7 days configurable?
- The crawl recorded an automatic dialog on landing; its content was not captured.
- The warning lists about 200 categories. Is that expected for test data, or does the client want All-Categories sets?

---

## 11. Messages — `Messages` · `/messages`

**Purpose:** "Email or text the suppliers, subcontractors and people on this project."

**Layout:** a single notice, "Delivery Management isn't connected – Supply Chain is not connected to Delivery Management yet. A platform admin sets this up… (Booking Integration)", with a `Check again` button. No other controls.

**What changed vs. before:** new page.

**Likely affected automation:** none.

**Open questions:** the page cannot be tested until a platform admin connects Booking Integration. Does the client want that done on staging, and who does it?

---

## 12. International Shipments — `International Shipments` · `/international-shipments`

**Purpose (from earlier docs):** per-project international shipment risk tracking. It had tabs Risk Dashboard / Delay Alerts / Flag & Review / Shipments and six tiles (SHP_DISCOVERY_AND_SCENARIOS.md §1).

**Observed:** only the spinner "Loading international shipments..." in both the walkthrough and the crawl. The menu item carries a red badge "61"; the "61 at risk" on Enterprise Shipments may be the same count **[I]**.

**What changed vs. before:** unknown, because the content never rendered. Earlier the page took up to about 60 s to load. The walkthrough did not wait that long.

**Likely affected automation:** `app-smoke.spec.js` (SHP-SMK-01 waits 90 s for "Total International"), `app-regression.spec.js` (SHP-REG-05…), `e2e-smoke.spec.js` (TC-14C), `pl-regression-3.spec.js` (PL-REG-INT-02, PL-REG-EDT-07).

**Open questions:** capture this page again with a longer wait. Is the slow load accepted behaviour?

---

## Summary – most important changes for test automation in this group

1. **Supplier Inbox is gone and My Work replaces it.** TC-14B, TC-24B, ENT-REG-02/04/05/07 and the Supplier Inbox part of `ana-ent-validation` need a scope decision. My Work's task and checklist sections are the nearest equivalent. My Work logs an HTTP 500 on load.
2. **Inventory Management was removed.** The Procurement Log "Inventory" tab never loads ("Loading inventory…" / "Couldn't load inventory."). `inv-regression`, INV-SMK-01…08 and PL-REG-INT-03 are blocked until this is fixed or re-scoped.
3. **The Procurement Log is now four tabs.** The List tab adds the *Component Materials* and *EPD Status* columns (column-index-based checks will shift), *Select Columns for Bulk Edit* and *View Bulk Edit Log*, and an inline Advanced Filter. Navigation must make sure the *List* tab is active.
4. **Management Dashboard** has new KPI tiles and an "Urgent issues" panel above the old watched-materials block and the Alerts / Notifications / Tasks tabs. These push the tabs further down, so DSH-* and TC-23/23B locators and scrolling need checking.
5. **A new delivery-management area** (Loads, Build load, Unallocated Deliveries, Discrepancies, Messages) has no coverage. It was empty or unconnected on NRVC_Hall, so its behaviour is unknown. The client needs to say which parts are finished.
6. **The First Delivery Inspections list** gains KPI cards, a question-set panel and an **Outcome** column, and links to FDI Config through "Manage question sets". FDI-SMK/REG and E2E TC-19…22 need to be checked against the new layout and the required outcome.
7. **Enterprise Shipments**: the Log shipment form adds *Ocean/Air* and *Port-to-site days*. Duplicated "Red Sea" delay-alert cards push the grid below the fold, which affects SHP-SMK/REG and TC-14C.
8. **Enterprise View and Supplier Performance** are structurally unchanged, so the BUGS-325 checks still apply. Spend is still shown in $ under an INR project.
9. **International Shipments** did not render within the walkthrough's wait, so it needs a separate capture before its SHP cases are judged.

## Part B – Users, documents and analytics


Source: `reports/walkthrough-2026-11-24/walkthrough.json` + screenshots `shots/034–045`, `shots/085–096` (staging, NRVC_Hall / Warehoust _NR, Project Admin, read-only). Earlier baseline: `APP_MAP_SWEEP.md` (2 Nov), `UM_FUNCTIONAL_DISCOVERY.md` (2 Nov), `DOC_FUNCTIONAL_DISCOVERY.md` (2 Nov), `DSH_ENT_ANA_DISCOVERY_AND_SCENARIOS.md` (2 Nov), `ANALYTICS_VALIDATION_2026-11-18.md` (18 Nov). "(inferred)" marks conclusions the captures do not prove directly. Emails are shown as `<email>`.

Probe gaps: on User Management, `Invite Users`, `Choose Project Role` and `Choose Organization Role` timed out (the locator was scoped to `main`). On Supplier List, `Bulk Map Material to Supplier` and `Upload` also timed out. Those dialogs were **not captured** in this walkthrough.

---

## User Management › User Management — `/user-management`
**Purpose:** list project users, invite new users, and change a user's roles.

**Layout:** page title "User Management", with `Search users…`, `Filter`, `Invite Users` and the count "100 users". Grid columns: Status (green "Active" pill), Name, Email Address, Associated Organization, Platform Role. Each row has a **role dropdown** inside the Platform Role cell (e.g. "Project Admin", "Subcontractor") and a ⋮ menu. Paging is Rows per page (10) with pages 1…10. A hidden **User Profile / Roles** drawer exists in the DOM (First/Last Name, Email, Phone, Company, Project Role, Organization Role, `Save`, `Remove From Project`). It is the row-click drawer that already existed.

**Forms seen:** **Filter** dialog (shot 035) with left-hand tabs `status`, `project_role`, `organization` (raw snake_case labels), an empty right pane and `Apply Filter`. Invite Users was not captured.

**Row actions:** an inline Platform Role dropdown and a ⋮ menu (its items were not captured).

**What changed vs. before**
- The Platform Role column is now an **inline dropdown per row**. UM_FUNCTIONAL_DISCOVERY §1 described it as a plain column, with role changes only in the profile drawer. (inferred: roles can now be changed directly in the grid.)
- The row now has a ⋮ menu, which UM_FUNCTIONAL_DISCOVERY does not mention.
- The Filter dialog tab names are the same as those used by UM-REG-11 (`status` …). Its values pane was empty before a tab was clicked.
- The count shows "100 users" with exactly 10 pages of 10.

**Likely affected automation:** `app-regression.spec.js` UM-REG-* (role change, Remove From Project, Filter UM-REG-11), `app-smoke.spec.js` UM-SMK-*. Invite flows in `pm-smoke`, `pm-regression`, `pm-regression-part2`, `e2e-smoke` and `scp-demo-flow` should only be affected if the Invite dialog changed. That dialog was not captured, so it needs a check.

**Open questions:** Is "100 users" a real total or a cap? Does a role change in the grid save immediately, and does it ask for confirmation (compare OBS-UM-2)? What is on the ⋮ menu? Should the filter tabs show snake_case labels?

---

## User Management › Supplier List — `/supplier-list`
**Purpose:** maintain the project's suppliers and subcontractors and map materials to them.

**Layout:** `Search suppliers…`, `Add Supplier`, `Bulk Map Material to Supplier`, the count "193 suppliers", `Upload`, `Export`. Columns: Supplier ID, Supplier Name, Type, Source, Contact Person, Contact Email, Contact Phone no, Map Material (an open-in icon plus a ⋮ menu). Paging runs 1…8.

**Form seen — Add Supplier** (shot 037). It opens **inline as a full-page form** ("Fill in the supplier details below"), not as a dialog. Fields marked required (*): Supplier Name, Line 1, Town/City, State/Region, Zipcode, Country, Contact Person, Contact Email, Contact Phone no. Optional fields: **Is Sub-Contractor** (toggle), **Email domains** ("Users with these email domains belong to this company. Leave blank to use the contact email's domain."), Line 2, Default Lead Time (weeks) ("Leave blank to derive from history"), **Invite to Platform** (toggle). Buttons: `Cancel`, `Save`.

**Row actions:** a Map Material icon and a ⋮ menu (items not captured; earlier they were Edit / Delete / Map Material / Promote to SSO Organisation).

**What changed vs. before** (UM_FUNCTIONAL_DISCOVERY §2)
- **New fields:** "Email domains" and the "Invite to Platform" toggle.
- The sub-contractor checkbox is now an "Is Sub-Contractor" toggle switch.
- The form is laid out in two columns, inline on the page.
- The supplier count grew from 92 to 193 (accumulated run data).

**Likely affected automation:** `app-regression.spec.js` SL-REG-* (Add Supplier form helpers around the "Is Sub-Contractor" switch, upload SL-REG-10/11, Promote SL-REG-15), `app-smoke.spec.js` SL-SMK-*. Also the Add Supplier steps in `e2e-smoke`, `pm-regression-part2` and `scp-demo-flow`.

**Open questions:** Does "Invite to Platform" send an invite from the supplier form? Does it replace or duplicate the User Management invite? Are Email domains validated or required to be unique? The Bulk Map and Upload menus were not captured and need a re-check.

---

## Document Management › All Documents — `/all-documents`
**Purpose:** a single read-only register of every file uploaded in the project, from any module.

**Layout:** a card titled "All Documents" with "416 document(s) across this project". There is a search box ("Search by filename, material, or category...") with `Search`, and a category select. The categories are All, Components, Delivery Photo, EPD, Inventory, Invoice, Materials, Pdf, PO File, **PO Validation**, Sites, Submittals, Supplier Material Mapping and Suppliers. Columns: Filename, Category (coloured chip), Material, Submittal, Size, Uploaded By, Date, Actions. Paging is Previous / Next.

**Row actions:** `View` and `Download`. EPD rows also have **`View Data`**.

**What changed vs. before** (DOC_FUNCTIONAL_DISCOVERY §1)
- New category **PO Validation**. "Invoice" and "Suppliers" are also listed now; they were not in the 2 Nov list.
- New row action **View Data** on EPD files.
- Uploaded By now shows the uploader's email on most rows. Pre-shipping checklist PDFs still show `test` (OBS-DOC-2 persists).
- Spreadsheet uploads (Materials, Components, Submittals) show Size "-".

**Likely affected automation:** `app-regression.spec.js` DOC-REG-* (category filter list, actions), `app-smoke.spec.js` DOC-SMK-*.

**Open questions:** What does View Data show? Is a missing size for xlsx uploads expected? Is `test` as uploader (OBS-DOC-2) still a defect?

---

## Document Management › Spec Documents — `/spec-documents`
**Purpose:** upload spec/submittal documents and, optionally, push them to TheLink to generate submittals.

**Layout:** an explanatory text and a drop zone ("Max 60 MB · PDF, DOC, ZIP, and most other formats"). Columns: Filename, Size, Status (`uploaded`), Uploaded by, Uploaded, Spec Section No. The data had 2 rows.

**Form seen — Spec Section No** (shot 040). It is a dialog with a dropdown "— None —". The note says "Pulled from this project's submittals. Select '— None —' and save to remove the association." The only button is `Save`.

**Row actions:** `Add` (when no section is set) or the value plus an edit pencil, then `Download`, `Send to TheLink` and `Delete`.

**What changed vs. before:** The Spec Section No is now **picked from the project's submittals** in a dropdown, and can be cleared with "— None —". The earlier docs (DOC_FUNCTIONAL_DISCOVERY §2, APP_MAP_SWEEP) did not describe the input type (inferred: earlier it was free entry). `Send to TheLink` is **greyed out** on both rows (shot 039).

**Likely affected automation:** DOC-REG-* (spec upload, section number, delete) in `app-regression.spec.js`, and DOC-SMK-*.

**Open questions:** Why is Send to TheLink disabled: is TheLink not configured, or is the feature not yet available? Does Delete ask for confirmation?

---

## Document Management › PO Validation — `/po-validation` and › BOM Validation — `/bom-validation`
**Purpose:** upload a PO file (multiple .xlsx/.xls/.pdf files allowed) or a BOM file (.xlsx/.xls/.pdf) and validate it against existing data.

**Layout:** each page is a card with a subtitle, a `Back` button and a drop zone. There is no table and no history.

**What changed vs. before:** No visible change from DOC_FUNCTIONAL_DISCOVERY §3–4. All Documents now has a "PO Validation" category (inferred: uploaded PO-validation files are stored).

**Likely affected automation:** DOC-REG / DOC-SMK (PO Validation upload). BOM Validation has smoke only.

**Open questions:** Q-DOC-3 is still open (sample PO/BOM files). Where can the user see earlier validation results?

---

## Document Management › EPD Report — `/epd-report`
**Purpose:** Environmental Product Declarations, i.e. embodied carbon taken from EPD PDFs attached to submittals.

**Layout:**
- `Scan Procore for EPDs`.
- **KPI cards:** 16 Total EPDs, 15 Parsed, 0 A1-A3 (kg CO2e), 0 A4 Transport (kg CO2e), 0 Total GWP (kg CO2e).
- **Upload EPD:** a Submittal select (`<material> - <submittal> - <spec> - <description>`) and a drop zone ("Select a submittal first · PDF files only").
- **EPD Records:** columns SUBMITTAL (with description), PRODUCT (shows the filename in italics), MANUFACTURER, GWP A1-A3, GWP TOTAL, STATUS, ACTIONS.

**Row actions:** a **`Parse`** button on rows with status **Failed**. Completed rows have no action.

**What changed vs. before** (DOC_FUNCTIONAL_DISCOVERY §5)
- **New KPI summary cards.**
- **New "Failed" status with a `Parse` (retry) action.**
- The upload drop zone is now disabled until a submittal is chosen.

**Likely affected automation:** DOC-REG-* EPD cases in `app-regression.spec.js`, and DOC-SMK-*.

**Open questions:** 15 records are "Parsed", yet every GWP value is "--" and all GWP totals are 0. Is that expected for the test PDFs (OBS-DOC-5)? Should Product show the filename? Which file types does Scan Procore pick up?

---

## Document Management › EPD Tracker — `/epd-tracker` — **new page**
**Purpose:** track which procurement lines need an EPD, whether it was requested or received, and its expiry.

**Layout:**
- Status chips: Required (missing) 0, Requested 0, Expiring 0, Expired 0, Received 0, Verified 0, Not required 615.
- `EPD Report` link and `Settings ▸`.
- Filters: view (Needs action / All lines / each status), category, trades/suppliers, due date, and search ("Search submittal, material, trade…").
- **Data empty:** "No line needs an EPD yet. Open Settings and tick the material categories that need one."

**Form seen — Settings panel** (shot 045, inline):
- "Material categories that need an EPD": a category finder, `Tick all shown` / `Clear all shown`, and a checkbox per category with its line count.
- "Due dates, reminders and escalation" (defaults shown):
  - Due before date required on site: 4 weeks
  - Due at the PO date when that is earlier: on
  - No ROJ or PO date, due after: 14 days
  - Send Upload EPD tasks to trades automatically: on
  - Remind the trade before the due date: 7 days
  - Escalate after the due date: 7 days
  - Show as expiring within: 60 days
- `Save settings` is disabled until something changes.

**What changed vs. before:** New page, not in any earlier doc (RELEASE_IMPACT_2026-11-24 lists it as new).

**Likely affected automation:** none yet. New coverage is needed (proposed prefix EPD-SMK / EPD-REG).

**Open questions:** Ticking a category is a project-setting write. Is that allowed on NRVC_Hall? Where do "Upload EPD tasks" appear (My Work, Messages)? Who counts as the "GC and environment managers" for escalation? Every category shows "0 lines" while "Not required" is 615 lines; is that consistent?

---

## Analytics (APP-R1: test as observed)

### Analytics › Aggregate Stats — `/aggregate-stats` — **redesigned**
**Purpose:** a project performance overview for a chosen period.

**Layout:**
- Controls: From/To dates with presets 30 days / **90 days (default, 27/08–24/11)** / 6 months / 12 months, `Group by` (Auto/Week/Month), and `Export`.
- **12 KPI cards:** On time vs ROJ 87.6% (205 of 234), Deliveries received 234, Avg days late 12.2 d, POs raised 268, Lines created 462, FDI rejection rate "—" (0 of 0), Discrepancies 0, NCRs raised 0, Lines at risk 16 of 465, Overdue lines 43, Open NCRs 0, Value delivered **$3,218,795** (67.3% of $4,779,589). Several cards show a "vs prev." delta.
- A warning reads "5 line(s) are priced in a currency other than INR…".
- Sections: **Activity over time** chart, **Pipeline** (Not ordered / Ordered / Partially delivered / Delivered with committed value and at-risk counts), **Needs attention** (top 10 of 43, "78 d overdue" etc.), **Lead-time accuracy** chart, **Supplier performance** table (Supplier, Lines, At risk/Overdue, Deliveries, On time, Avg days late, Short/Damaged, Discrepancies, FDI rejected, Open NCRs) and **By material category** table (Category, Lines, Deliveries, Lead time Q/A, Delivered/Committed).
- Kept from before: **Lead-time change activity**, Changes per week, Most-changed schedules, Top editors.

**What changed vs. before:** The earlier page (APP_MAP_SWEEP; ANALYTICS_VALIDATION §A) had Submittals/Materials/Suppliers/Locations counters and a Project table. Those were **not captured** and appear to be **removed**. Everything listed above is new. Internal sums look consistent: pipeline counts add up to 465, at-risk counts to 16, committed values to $4,779,589.

**Likely affected automation:** `ana-ent-validation.spec.js` ANV-AGG-01 (counters), **ANV-AGG-02 (project table, likely obsolete)** and ANV-AGG-03 (export). `app-smoke.spec.js` ANA-SMK-01 (its texts "Changes per week" and "Top editors" are still present). ANA-REG-01/04 in `app-regression.spec.js`.

**Open questions:**
- Value cards use **$** while the project currency is INR.
- The "vs prev." deltas (+4580%, +15300%) are extreme.
- Does Export still download the static template (ANA-F export finding)?
- Is the page still project-only and not venue-based (by design, §J)?

### Analytics › Lead Time Analysis — `/lead-time-analysis`
**What is on the page:** Your Delivery Performance (283 delivered, 87.6% on time, 248 on time, 35 late, 14.1 days average delay) and the Lead Time Comparison by Category table (Category, Your/Client/Platform/Industry Avg, Δ vs Platform, Status, Platform Range, Industry Range, Projects, Active Alerts). **The layout is unchanged** from ANALYTICS_VALIDATION §B.

**What changed:** Enterprise › Lead Time Benchmarks was removed and its route redirects here (RELEASE_IMPACT), so this is now the **only** lead-time benchmark page. Totals are up from 195/160 on 18 Nov. Many categories still show "—" with "On par".

**Affected:** ANA-SMK-02, ANV-LTA-01, and ENT-REG-07 / ENT-SMK-04 (they compare with or open `/lead-time-benchmarks`).

**Open question:** Is ANA-DEF-32 (Your = Platform) still reproducible?

### Analytics › Supply Chain Intelligence — `/supply-chain-intelligence`
**What is on the page:** Supply chain tracker ("across 8 key categories"; "Last collected 21d ago"), 7d/30d/90d, a region select, `Check reports`, `Refresh`. Chips read "13 categories tracked · 11 with alerts · 356 active disruptions · Overall: stable". Tabs: Materials & Equipment / Logistics & Shipping / Compliance & Regulatory. Then "Active disruptions (200)" with a dismiss ✕ per item, **Project risk profiles** (8 sector cards, e.g. Hospital & Healthcare 61/100), Risk heatmap, "Supply status across categories" chart, and "All active disruptions (356)" with Dismiss all / Dismiss group and pages 1…69.

**What changed:** The content matches ANALYTICS_VALIDATION §C. "Project risk profiles" was listed before too. The data is **still stale**: collected 21 days ago, the last collection was around 2–3 Nov. Label inconsistencies remain: 8 vs 13 categories, and 200 vs 356 disruptions (ANA-F11, F14).

**Affected:** ANA-SMK-03, ANV-SCI-01.

**Open question:** When does data collection run again on staging?

### Analytics › Emissions Report — `/emissions-report`
**What is on the page:** Emissions Summary with `Export CSV`, `Export PDF`, `Auto-Generate Emissions`. Totals: 15.77 t CO2, 15,768.52 kg, 1,061,369.4 km. Mode cards: Diesel Truck 48.8%, Ocean 51.2%, Rail 0, Air 0. Tabs By Submittal / By Subcontractor / By Trade. Grid: Submittal, Material, Route, CO2 (kg), Legs, with an expand chevron per row.

**What changed:** The layout is unchanged (APP_MAP_SWEEP). Rows now show **3 legs** each, where 18 Nov had 0 legs (inferred: the CSV export may now contain rows).

**Affected:** ANA-SMK-04, ANV-EMI-01.

### Analytics › Inventory Reports — `/inventory-reports`
**What is on the page:** Filter materials, Period 7d/**30d**/60d/90d, "84 materials · 2 alerts". **Stock by Location** stacked chart (Gate 4, Gate 5, Loc INR…), **Threshold Alerts**, and **Material Consumption** cards (on hand plus a weekly consumption sparkline).

**What changed:** On 2 Nov there were "no headings rendered". The sections now render. The Inventory Management module itself was removed from the menu in this release, but this report stays.

**Affected:** ANA-SMK-05, ANV-INR-01.

**Open questions:**
- Alerts read "Stock 426 **undefined** has reached maximum (100 **undefined**)", so the unit is missing.
- Weekly consumption values are negative (e.g. W44 −23/−19).
- Should the report stay now that the Inventory page is gone?

### Analytics › Status Report — `/status-report`
**What is on the page:** Start/End dates (default 24/10–24/11), a `Supplier` select, `Generate`. Two charts: Submittal Count by Status, and Count of Submittal Components. Three tables: STATUS BY SUBMITTAL, STATUS BY SUPPLIER and STATUS BY MATERIAL. The material table includes Initial Lead Time, No of Time Changed and % Change in Lead Time.

**What changed:** Unchanged vs. APP_MAP_SWEEP. The STATUS BY SUBMITTAL header still shows "QTY Ordered On At Risk" **twice**. This was triaged as "not an issue" (ANA-DEF-30, §K).

**Affected:** ANA-SMK-06, ANA-REG-03.

### Analytics › SubContractor Issues — `/subcontractor-issues`
**What is on the page:** dates (default 24/10–24/11), "Search subcontractor or project…", `Export`. Columns: Subcontractor, Project Name, Delays in Raising PO, Delays in Confirming PO, PO Schedule Impact, Delays in Booking, Delivery Impacted, **Over-Deliveries**.

**What changed vs. 18 Nov (§D):**
- The first group is labelled "No responsible subcontractor", and its project rows show **project names** (e.g. "Burj Khalifa"), not IDs.
- **All six metrics render, all 0.**
- The 41 duplicated NRVC_Hall rows were not seen in the captured part.
- (inferred) ANA-DEF-18/19/20 appear changed or fixed. A re-run is needed.

**Affected:** ANA-SMK-07, ANV-SUB-01/02/03, ANA-REG-02 (export).

**Open question:** Every captured value is 0, while Supplier Issues shows 13 schedule impacts. Are issues now attributed only to suppliers?

### Analytics › Supplier Issues — `/supplier-issues`
**What is on the page:** dates, search, `Export`. KPI cards: Raising PO delays **1**, Confirming PO delays **1**, Schedule impact **13**, Booking delays 0, Deliveries impacted **14**, Over-deliveries 0. Then Supplier Delay Summary and Project-Wise Issue Distribution charts, Delivery Performance (**"No delivery data available."**), Top 5 Projects with Most Issues, the Issue Heatmap (Suppliers × issue types; a few non-zero rows such as Moto India 1/1/0/0/1), and a lower Subcontractor/Project table.

**What changed vs. 18 Nov (§E):** The KPI cards now show the true cumulative totals 1/1/13/14 instead of 41/41/533/574 (inferred: ANA-DEF-21 fixed). The heatmap now has some non-zero supplier rows (ANA-DEF-23 partly changed). Delivery Performance is **still empty** (ANA-DEF-22). TOV Analytics no longer opens this page.

**Affected:** ANA-SMK-08, **ANA-SMK-09 (still expects TOV → `/supplier-issues`)**, ANV-SUP-01/02, ANA-REG-02.

### Analytics › TOV Analytics › Financial Forecast — `/financial-forecast` — **new page**
**Purpose:** projected cash outflow from payment terms and schedule dates.

**Layout:**
- `Edit Payment Terms`. Active terms: "30% at order, 50% on delivery, 20% on installation (4 weeks after delivery)".
- KPI cards (INR): Total Contract Value 1,168,309,942; Forecast at Order 152,482,122.6; Forecast on Delivery 504,171,871; Forecast on Install 201,668,748.4; Total Forecast 858,322,742 (= the sum of the three forecasts).
- Cash Outflow Forecast chart (stacked monthly bars from 2026-08 to 2027-01, plus a cumulative line).
- Monthly Detail table (Month, At Order, On Delivery, On Install, Month Total, Cumulative).
- Forecast by Submittal table (Submittal, Material, Supplier, Value, At Order, On Delivery, On Install, PO Date, Delivery).

**Form seen — Payment Terms** (shot 094, inline): % at Order, % on Delivery, % on Installation, Install Lag (weeks), "Total: 100%", `Save`, `Cancel`.

**What changed:** New. It replaces TOV → `/supplier-issues` (OBS-APP-1 resolved).

**Affected:** ANA-REG-05 in `app-regression.spec.js` (already expects this page). ANA-SMK-09 needs to be rewritten.

**Open questions:**
- Are payment terms project-level, and is editing them allowed on NRVC_Hall?
- Total Forecast (858M) is less than Total Contract Value (1,168M), and Forecast at Order is not 30% of contract value. Are lines without dates excluded?
- The currency label "INR - Indian Rupees" is repeated in every cell and on the axis labels.

### Analytics › TOV Analytics › Submittal Invoiced Orders — `/submittal-invoiced-orders` — **new page**
**What is on the page:** dates (24/10–24/11) and Search; there is no Export. Table "SUBMITTAL INVOICED ORDERS": Submittal No, Material, Total Component Qty, Qty/Value Orders Placed, Qty/Value Orders Received, Qty/Value Pending to be Received, Approx Value Of Orders Not Yet Ordered. Most rows are 0; a few run submittals have values (e.g. 15 / 1,500).

**Affected:** none yet (new).

**Open questions:** Values carry no currency. What does "invoiced" mean when there is no invoice data in the columns? Does the date range filter by PO date or by delivery date? The menu label is truncated ("Submittal Invoiced O…").

### Analytics › TOV Analytics › Submittal Level Outflow Projection — `/submittal-level-outflow-projection` — **new page**
**What is on the page:** dates and Search. Table: Submittal No, Material, Value Orders Received, Value Of Orders Not Yet Received, Delivery Next Week / in 2 Weeks / in 3 Weeks / in One or More Months Count, Approx Value Of Orders Not Yet Ordered. Mostly zeros. The values match Submittal Invoiced Orders for the same submittals (e.g. 1,500 received / 1,500 not yet received).

**Affected:** none yet (new).

**Open questions:** Are the "Count" columns deliveries or quantities? There is no currency on values. "Approx Value Of Orders Not Yet Ordered" is 0 everywhere captured.

---

## Summary — most important changes for test automation in this group
1. **TOV Analytics is now a menu group** with three new pages: Financial Forecast, Submittal Invoiced Orders and Submittal Level Outflow Projection. `app-smoke` **ANA-SMK-09** (expects `/supplier-issues`) must be rewritten. ANA-REG-05 already targets `/financial-forecast`. The two other pages have no coverage.
2. **Aggregate Stats was redesigned.** It now has 12 KPI cards, Pipeline, Needs attention, supplier and category tables, and a 90-day default. The project table and counters seem gone, so **ANV-AGG-01/02** need new assertions or retirement. ANA-SMK-01 texts still exist.
3. **EPD Tracker is a new page** with a settings panel that writes project configuration. It needs smoke coverage plus a decision on whether writes are allowed. The tracker is empty until categories are ticked.
4. **EPD Report** gained KPI cards and a Failed + `Parse` state. GWP is still 0 / "--" for every parsed record.
5. **Supplier List › Add Supplier** is an inline page form with a new **Email domains** field and an **Invite to Platform** toggle. "Is Sub-Contractor" is a switch. The SL-REG form helpers and the e2e/demo Add Supplier steps need a check.
6. **User Management** has an inline **Platform Role dropdown** per row and a ⋮ menu. UM-REG role-change and remove cases may now go through the grid. The Invite dialog was not captured and must be re-checked before the invite-based flows run.
7. **Lead Time Benchmarks is gone**, so Lead Time Analysis is the only benchmark page. ENT-REG-07 and ENT-SMK-04 must be retired or redirected.
8. Several 18 Nov Analytics defects look **changed or fixed** (Supplier Issues KPIs 1/1/13/14; SubContractor Issues shows names and the Over-Deliveries column). Others **persist**: Delivery Performance is empty, SCI data is 21 days stale with 8/13 and 200/356 label mismatches, and Inventory alerts show "undefined" units. Re-run `ana-ent-validation.spec.js` before updating the register.
9. All Documents has a new **PO Validation** category and a **View Data** action. Spec Documents now picks the section number from a dropdown, and Send to TheLink is disabled. DOC-REG filter and action lists need updating.

## Part C – Project Management


_Source: read-only walkthrough of 24 Nov 2026 (`walkthrough.json`, `shots/046`–`084`), crawl `reports/discovery-2026-11-24/app-map.json`. Staging, NRVC_Hall, Project Admin. "Before" = `docs/functional-discovery/PM_FUNCTIONAL_DISCOVERY.md` (30 Oct 2026, "PMFD") unless another file is named. Inferences are marked **[I]**._

**Limits of the capture.** (1) The "landing" screenshots are 1920×1080 viewport shots, not full-page: anything below the fold is known only from captured text. (2) Each snapshot's `text` stops at about 3,000 characters, so long pages (FDI Config, Site list, Material Category) are cut off. For example, "Heading Display Text" and "Add Group" are visible in shot 054 but not in the text. (3) Only the forms listed under each page were opened. Labels inside other dialogs, menus, expanded rows, or states that need a selection or input could not be judged and are marked "not judged".

## Menu structure (Project Management)

```
Project Management
├── Project Settings   › Configuration Options · Procurement Log Configuration · First Delivery Inspection Config · PreShipping Checklist · System Messages
├── Sites & Storage    (/site-details)
├── NCRs               (/ncrs)                                    NEW
├── Materials          › Material Master · Material Category · Common UoM · Common Utilities · Watched Materials
├── Inventory Settings › Inventory Control · Inventory Rebuild
├── Imports            › Excel Import (crawl click timed out) · Bulk Upload Status · Submittal Manager
└── Integrations       › Booking Integration · TheLink Integration · XER Import
```

**Before** (PMFD §4): two groups, `Integrations` and `Reference Data` (Common Utilities, Common UoM, Material Category), plus 11 flat entries, with `Site Details` as a plain entry. PM-SMK-002 also expected `Inventory Rebuild` as a flat entry. The redesign replaces `Reference Data` with `Materials`, which also takes in Material Master and Watched Materials. It adds the `Project Settings`, `Inventory Settings` and `Imports` groups, renames the menu entry `Site Details` to `Sites & Storage`, and adds `NCRs` and `Excel Import`. `PreShipping Checklist` is back in the menu. The navigator had treated it as route-only since 23 Nov.

**Navigator (`tests/pm-flow/support/pm-navigator.js`, `MENU`).** The group paths for Project Settings, Materials, Inventory Settings, Imports and Integrations already match. Still out of date:
- `PreShipping Checklist` has `groups: null`. It should be `[PM, 'Project Settings']`.
- `NCRs`, `Inventory Rebuild` and `Excel Import` have no entries.

`Excel Import` is visible in the expanded Imports menu (shot 078, with an integration-style icon). The crawl's `nav … getByRole('button', {name: 'Excel Import'})` timed out, so **[I]** the entry may not be a `<button>`, or it may open something other than a route.

---

### Project Management › Project Settings › Configuration Options — `/configuration-options`
**Purpose:** project-wide settings that drive alerts, currency, date format, integrations and (new) delivery/NCR timing.
**Layout and controls (shot 046 + text):**
- Top block of week/day fields: `Lead time confirmation (weeks)`, `Not ordered alert (weeks)`, `Not booked alert (weeks)`, `Port-to-site buffer (days)` (number input). Each has a `?` help icon.
- Rows: `Archive Read Items After` (30 days), `Currency Type` (INR), **`Date Format` (DD/MM/YYYY)**, `GRN` toggle (On), `Integration Provider` (None), `Estimate Subcontractor Freight Emissions` (Off), `LLM Material Categorization` (Off), `Pre-Shipping Checklist`, then `Cancel` / `Save`.
- New second section **"Loads, receipt, P6 and NCRs"** with its own `Save`:
  - "Days before ROJ a delivery may arrive without counting as early"
  - "Hours after arrival before an unreceived load reminds the trade (the GC at twice this)"
  - "Hours unallocated goods wait for their lines before going to the GC"
  - "ROJ from P6: days before the activity" plus a start/finish select
  - "Procurement Log shows by default": CFCI and OFCI / CFCI only / OFCI only
  - "Working days an open NCR waits before escalating to the GC project manager"
  - "NCR corrective actions that also need design-team approval": checkboxes Use as is / Repair / Rework / Reject and return
- The freight-emissions note now reads "Suppressed automatically — booking integration is connected for this project."
- **Lead time confirmation currently shows `-1`** (see SCP-DEF-030).

**Forms:** none (inline page).
**What changed vs. before:** PMFD §5.7 already listed `Not ordered alert` and `Not booked alert`, so RELEASE_IMPACT_2026-11-24 is wrong to call those new. The new items are `Port-to-site buffer (days)`, `Date Format` and the whole "Loads, receipt, P6 and NCRs" section.
**Likely affected automation:**
- PM-REG-CFG-01 asserts that week values are not negative, so it will fail on `-1` until the value is restored.
- PM-REG-CFG-02/05/08 and PM-SMK-009 use dropdown value detection; Date Format adds another value button.
- PM-REG-CFG-12 uses `getByRole('button', {name: 'More info'})`, but the captured button name is `?`. This needs a check.
- cfg-live (PM-REG-CFG-09…16) and pm-decisions may be affected by the new delivery/NCR settings **[I]**.

**Open questions:** Is `-1` leftover test data or an unrestored value? Which of the two Save buttons saves what? The emissions note says booking is connected, while Booking Integration shows an empty Booking ID.

### Project Management › Project Settings › Procurement Log Configuration — `/procurement-log-configuration`
**Purpose:** choose and order the columns of the Procurement Log, and add custom log fields.
**Layout:**
- `Add Log Fields` and `Save Changes` buttons, with the hint "Drag rows to reorder…" and a yellow note that Material Name, Submittal No and Supplier Name are always required.
- Table `# | Field Name | Enabled | Actions` with **64 rows**. Rows 1–2 are now `Spec Description` and `Schedule Id`; the locked rows are **3, 5 and 6** (Material Name, Submittal No, Supplier Name).
- New built-in fields include `Component Materials`, `EPD Exists`, `EPD Status`, `Ball In Court`, `Thelink Submittal Id` and the Procore fields.
- Many `(Custom)` run-created fields. `Spec Section No` appears three times (rows 48–50).

**Forms:** `Add Procurement Log Fields` (`Field Name*`, `Field Type*` "Choose Field Type", `Add`).
**What changed:** PMFD §5.13 had 43 rows, with locked rows at 4–6. The page layout is unchanged. The field list has grown and been reordered.
**Likely affected:**
- PM-REG-PLC-01 is OK, because it finds rows by name.
- PLC-02…09 and PLC-07 (custom field in Add Submittal) are likely OK.
- Any code that relies on row positions is affected.
- Actions for custom rows were not captured.

**Open questions:** Is the triple `Spec Section No` a defect or three distinct fields? What actions does a custom row offer now?

### Project Management › Project Settings › First Delivery Inspection Config — `/first-delivery-inspection-config`
**Purpose:** FDI settings (what the inspection form asks for), inspectors and their material scope, and inspection question sets.
**Layout (shots 049, 054):**
- `FDI Settings`: 4 checkboxes (all ticked) and `Save`.
- `Inspectors` table: `Name / Email | Role | Materials Scope | Status | Enabled | Actions`, with `Invite` and `Add Inspector` buttons.
- Question sets are shown as a wrap of **chips** (set name + categories), followed by `+ New Question Set` and `+ Create from Organisation Set`, and the warning "No 'All Categories' set…".
- `Manage Groups (3)` expands a groups table (`# | Group Name | Heading Display Text | No. of Questions | Actions`, with `Add Group`).
- New link **`Organisation Question Sets (5)`**.
- `Add Question` and `Show deleted questions`, then the questions table `# | Question | Group | Type | Added On | Status | Actions`.

**Forms seen:**
- `Invite Users`: Manual entry / From Procore directory; Email*, Organization, Role*; Add Another User; Send Invites.
- `Add Inspector`: Project Member*, Project Role*, Materials Scope* (All / By Material Category / Specific Materials).
- `New FDI Inspection Question Set` and `Create from Organisation Question Set`: Organisation Question Set select, name "e.g. Steel Receiving Checks", Specific / All Categories, "Search or add a category", category checkboxes.
- `Add Question`: + Create New Question / Add from Organization Bank; Question Text*; Answer Type*.

**What changed:** The settings and inspector parts match PMFD §5.8 and FDI_SETTINGS_REQUIREMENTS.md. Question sets were tabs before and are now chips. The organisation-set entry points (T548) are now on the page. The category search placeholder is now "Search or add a category", which was "Search category..." before.
**Likely affected:**
- PM-REG-FDI-04 and T543-06 use "Search category..." / "+ Add Category"; neither label was found in the new-set form.
- Anything that selects question sets as tabs (`getByRole('tab')`) **[I]**.
- PM-REG-FDI-01 ("Notification Settings" absent) still passes.
- T548-05/06 ("Rename", "Update from project set", "Replace Contents"): not judged.

**Open questions:** Do question-set chips select a set the same way tabs did? Has "+ Add Category" moved into "Search or add a category"?

### Project Management › Project Settings › PreShipping Checklist — `/preshipping-checklist`
**Purpose:** the project's pre-shipping questions that suppliers answer before a delivery is approved.
**Layout (shot 056):** `+ Add Question`; table `# | Question | Enabled | Count | Actions` (49 questions). Actions shows an edit pencil on some rows and "—" on the rest. `Count` is 0–5 per row.
**Forms:** `Add Question` (`Question Text*`, `Add`). No answer-type field was seen.
**What changed:** PMFD §5.11 had `# | Question | Enabled`, no Add, and no Count or Actions. The page is back in the menu under Project Settings (RELEASE_IMPACT). The spec already expects the 5 columns (PM-REG-PSC-01).
**Likely affected:**
- Navigator entry (`groups: null`).
- PM-REG-PSC-01/02 and PM-SMK-014.
- PL-REG-DLV-03/07 and T548-18 / T155-01 ("Y/N", "Confirm Checklist" belong to the supplier checklist dialog: not judged).

**Open questions:** What does `Count` count (answers given?) **[I]**? Why does only some rows have the edit pencil? Is the answer type chosen when a question is enabled, as PSC-02 handles?

### Project Management › Project Settings › System Messages — `/system-messages`
**Purpose:** author and schedule banners shown at the top of the app.
**Layout (shot 059):** heading, the subtitle "Platform messages broadcast to every project; project messages stay scoped to the current one", `New message`, and "All messages · 34 total" in a table `Scope | Severity | Title / Body | Window | Status | Actions` (Edit / Delete). **Every captured row shows Status "Disabled"**.
**Form (inline):**
- `Scope`: Platform (all projects) is the default; Project (this project only) is the other option.
- `Severity`: Info / Warning.
- `Title (optional)`, `Body (markdown)` with a `0/2000` counter and the markdown help, and a live `Preview`.
- `Starts at` / `Ends at`, pre-filled now → +7 days.
- `Active` (ticked), `Cancel`, `Create`.

**What changed:** PMFD §5.16 had Project scope only and statuses such as "Scheduled". Platform scope was already noted on 10 Nov. The Status vocabulary now looks different **[I]**.
**Likely affected:**
- PM-REG-SYS-01 (expects both scopes): OK.
- SYS-07/09 (scheduled, inactive and expired states) are likely to need new status texts.
- SYS-00 (no active banner).
- PM-SMK-019.

**Open questions:** Does "Disabled" replace Scheduled / Expired / Inactive? Why are scheduled and active test rows also "Disabled"?

### Project Management › Sites & Storage — `/site-details`
**Purpose:** sites and their storage locations, where material is kept after unloading.
**Layout (shot 060):**
- Page title is now **"Sites & Storage"**.
- `Search sites…`, "126 sites", `Bulk upload`, `Sites report`, `+ Add site`.
- Helper text: "Each site's storage locations are where material is kept after unloading, separate from where the vehicle arrived."
- **Expandable site cards:** name, type chip, "N storage location(s)", address or "No address set", and a `⋯` menu.
- An expanded card shows an inline **ADD LOCATION** row with:
  - a type select (Building / Area / Laydown / Bay)
  - "Name, e.g. Laydown 2"
  - a parent select ("Top level" / "under <location>")
  - an `Add` button
- Locations are listed underneath, each with `⋯`.

**Forms:** `Add Site`: Site Type* (Choose Site), Name*, Address (autocomplete-disabled note), City, Country (Choose Country), Add. The `Bulk upload` probe and the inline `Add` probe both timed out; the `⋯` menus were not opened.
**What changed:**
- PMFD §5.14 had a table (`Site Type | Name | City | Country | Locations`) with `Upload` / `Export` and a row `ADD` button that opened an `Add Location` modal with Construction Area / Substore.
- Locations can now be nested (parent location), and the location types are different.
- `Export` is gone. `Sites report` may replace it **[I]**.
- The button is now `Add site`, with a lower-case "s".

**Likely affected:**
- PM-REG-SITE-01/02/03/04/05/09/10/11, UPL-SITE-01…12 (button `Upload` → `Bulk upload`), PM-SMK-017 (heading, buttons, table headers).
- PM-REG-PLC-07 ("Choose Location").
- Inventory and delivery prerequisites that pick site/location **[I]**.
- PM-REG-SITE-06 (address placeholder): still present.

**Open questions:** Does `Sites report` replace Export with the same columns? Do the bulk-upload template and location types match the new types (OBS-14)? What does `⋯` offer?

### Project Management › NCRs — `/ncrs`
**Purpose:** the list of non-conformance reports raised on deliveries.
**Layout (shot 062):**
- Title "Non-conformance reports".
- Filters:
  - status: All statuses, Open, Awaiting approval, In progress, Awaiting re-inspection, Closed
  - corrective action: Use as is, Repair, Rework, Reject and return
  - divisions
  - trades
- Search "Search NCR, product, submittal, supplier…" and a count "0 NCRs".
- `Discrepancies` button (likely links to Loads › Discrepancies **[I]**) and `Export to Excel`.
- Collapsible "GC project managers by CSI division (0) ▸".
- Empty state: "No NCRs."

**Forms / row actions:** none captured (no data).
**What changed:** New page; no earlier doc.
**Likely affected:** no coverage. Relates to the Configuration Options NCR settings and the Dashboard NCR tiles.
**Open questions:** How is an NCR raised ("Raise NCR" on a delivery)? What does the GC-PM-by-division panel configure? May the automation create NCRs on NRVC_Hall?

### Project Management › Materials › Material Master — `/material-master`
**Purpose:** the project's materials and their items/SKUs.
**Layout (shot 063):**
- `Search materials…`, `+ Add Material`, `Upload` (menu: Upload File, Download Template), `Export`, "937 items".
- Table: expand `+`, `Category`, `Material ID`, `Name`, `Parent Material`, `UOM`, `Items` ("1 item" chip), `ADD`, `⋮`.
- Paging: numbered pages 1…38 with "Rows per page 25".
- Categories now appear as CSI names, for example "Division 03 - Concrete".

**Forms:** `Add Material` (Category*, Material Name*, UOM*, Parent Material, Supplier optional), `Add Item` (Name*, Conversion*). The row menu has Edit, Delete, Map Supplier, Statistics.
**What changed:** Close to PMFD §5.10 (row menu and forms unchanged). `Upload` now opens a dropdown menu instead of showing its options inline. The count grew from 134 to 937 (run data).
**Likely affected:**
- PM-REG-MM-01 / PM-SMK-013: `Next page` / `Previous page` and `a[aria-label="Page 2"]` were not captured, so check them.
- PM-REG-MM-04 ("SKU ID" in the expanded row): not judged.
- UPL-MM-* and T508 ("Create all as new", "UOMs not found", "Reject all" are in upload dialogs): not judged.

**Open questions:** Do the paging controls keep their aria labels?

### Project Management › Materials › Material Category — `/material-category`
**Purpose:** material categories, now classified by CSI division.
**Layout (shot 068):** `Search categories…`, `+ Add Material Category`, `Load Defaults`, "359 categories". The list is **grouped by CSI division** (for example "Division 05 · Metals 3"), and each group has its own header row `Material Category Name | Division | Created At`. Each row has edit and delete icons.
**Forms:** `Add Material Category`: `Name*` and a new **`CSI division`** select. It defaults to "No division" and appears optional; options run from 00 to 48.
**What changed:** PMFD §5.6 had a flat table `Material Category Name | Created At` (~81 rows) and a Name-only form. The Division column, the grouping and the division field are all new.
**Likely affected:**
- PM-REG-REF-15/16/19/21/22b/23: table selectors such as `tbody tr`.first() now find several tables.
- PM-REG-REF-18 (Load Defaults → Metric/Imperial menu): not judged.
- PM-SMK-008.
- Downstream category pickers (FDI, Watched Materials).

**Open questions:** Should the automation set a division? Is the division required for NCR / GC-PM routing **[I]**?

### Project Management › Materials › Common UoM — `/common-uom`
**Purpose:** the project's units of measure.
**Layout:** `Search UOM…`, `+ Add UOM`, "128 items", columns `UOM Name | Created At`. Row actions were not captured.
**Form:** `Add UOM` (`UOM Name*`, `Add`).
**What changed:** Same as PMFD §5.5, apart from data growth (36 → 128) and the menu move (Reference Data → Materials).
**Likely affected:**
- PM-REG-REF-12/13/19/20/22 and PM-SMK-007 should work.
- PM-REG-NAV-02 and PM-SMK-002 use the group "Reference Data", which no longer exists.

**Open questions:** none new.

### Project Management › Materials › Common Utilities — `/common-utilities`
**Purpose:** typed lookup values such as currency_type, file_category, fdi_status and more.
**Layout (shot 072):** `Search utils…`, `+ Add Common Util`, "202 items", columns `NAME | Type | Created At`, and a **`⋮` row menu**.
**Form:** `Add Common Utils` (CommonUtil Name*, CommonUtil Type* "Choose CommonUtil Type", Add).
**What changed:** PMFD §5.4 described an "unlabelled icon column"; it is now a visible kebab menu. The count grew from 97 to 202. The page moved menus.
**Likely affected:**
- PM-REG-REF-01…11 and PM-SMK-006: labels found.
- REF-08 (edit) depends on the kebab menu, which was not opened.
- REF-03 no-match texts: not judged.

**Open questions:** What does the row menu offer (Edit / Delete)?

### Project Management › Materials › Watched Materials — `/watched-materials`
**Purpose:** assign categories or trades for site managers or admins to monitor.
**Layout (shot 074):** heading with a `?` icon, the explanation text, a `User` select, and a table `Type | Value | Notifications | Assigned by | Created` with "Pick a user to view or assign watches."
**Forms:** none opened (needs a user to be selected).
**What changed:** Same as PMFD §5.17. Only the menu location changed, and possibly the `?` icon.
**Likely affected:** PM-REG-WM-* and PM-SMK-020 ("Add watch" appears after a user is selected: not judged).
**Open questions:** none new.

### Project Management › Inventory Settings › Inventory Control — `/inventory-control`
**Purpose:** min/max stock thresholds per material, with notifications.
**Layout (shot 075):** "Inventory control rules" and `+ Add Rule`. Four rule **cards**, each showing Inventory Item, Min Balance, Max Balance, a `Notify on Min` toggle, a `Notify on Max` toggle and a `⋮` menu.
**Form:** `Add Rule`: Inventory Item* (Choose Inventory Item), Min balance at location*, Max balance at location*, the two notify toggles, Add.
**What changed:** PMFD §5.9 showed the empty state "No rules configured". Rules now exist (data). Their card layout was not documented before.
**Likely affected:**
- PM-REG-INV-01 and PM-SMK-012 expect "No rules configured", which fails while rules exist.
- PM-REG-INV-02…07: form labels found.
- `⋮` not opened.

**Open questions:** Were these rules created by the automation (Q9)? Should they be cleaned up so the empty-state case can run?

### Project Management › Inventory Settings › Inventory Rebuild — `/inventory-rebuild`
**Purpose:** recalculates the project's daily stock balances from the full activity history. Activities themselves are not changed.
**Layout (shot 077):**
- `Run Dry Run`; `Rebuild` (appears disabled).
- "Last nightly run: 23/11/2026, Success".
- "Dry run results" from 17/11/2026 by the admin user: 97 of 60,879 balances differ, "The dry run has expired. Run a new dry run."
- `Download CSV`.
- Results table `Category | Material ID | Material | Site | Location | UOM | Current Stock | Rebuilt Stock | Difference`.
- `History` table `Date | Run by | Kind | Outcome | Reason | Total difference`.

**Forms:** none opened.
**What changed:** RELEASE_IMPACT calls this a new page, but the menu item was already seen on 28 Oct and 10 Nov (PM-SMK-002, REQ-INV-049) and a dry run is dated 17 Nov. It now sits under Inventory Settings. Its content has never been documented before.
**Likely affected:** PM-SMK-002 (menu order). There is no functional coverage.
**Open questions:** REQ-INV-049: who may run it? May the automation run only Dry Run on NRVC_Hall? Is a stock difference of −5,456 expected?

### Project Management › Imports › Excel Import — route unknown
Visible in the menu (shot 078) but not opened by the crawl. Nothing about it can be described. **Open question:** what it imports, and whether it replaces the Procurement Log "Import" or the Material/Site uploads **[I]**.

### Project Management › Imports › Bulk Upload Status — `/bulk-upload-status`
**Purpose:** the history of every Excel upload, with downloadable success and failure reports.
**Layout (shot 078):** date range (24/10/2026 → 24/11/2026), `Search by uploader…`, `All Upload Types`, "25 logs". Table `Date | Added By | Bulk Upload Type | Status | Uploaded File | Success File | Failure File`, with download chips.
**What changed:**
- PMFD §5.12 / SCP-DEF-001 showed Materials uploads with "-" status. Materials rows now show `Failed`, **`Partly successful`** (new) and `Success`.
- **Components and Submittals rows still show "-"**, including rows that have only a failure file. The SCP-DEF-001 pattern remains for those types.

**Likely affected:** PM-REG-BUS-05/12 (partial success used to expect no status, R17), BUS-08/09, PM-SMK-015.
**Open questions:** Is "Partly successful" the new rule for every type? Is "-" for Components and Submittals still a defect?

### Project Management › Imports › Submittal Manager — `/submittal-manager`
**Purpose / layout:** notice only: "This page is being repurposed…" It directs users to the Submittal Manager entry inside the integration group in the sidebar.
**What changed:** Text unchanged (PMFD §5.15). The page moved to Imports.
**Likely affected:** PM-REG-SUB-01 and PM-SMK-018 should work.
**Open question:** No Submittal Manager entry is visible under Integrations. Does it appear only when Procore or Autodesk is the provider **[I]**?

### Project Management › Integrations › Booking Integration — `/booking-integration`
**Purpose:** link the SCP project to a Booking System project.
**Layout (shot 080):** `SCP Project ID` (pre-filled), `Booking System Project ID` (empty), `Submit`.
**What changed:** None (PMFD §5.1).
**Likely affected:** PM-REG-INT-01 and PM-SMK-003 should work.
**Open question:** This page shows no Booking ID, but Configuration Options says "booking integration is connected". Which one is right?

### Project Management › Integrations › TheLink Integration — `/thelink-integration`
**Layout:** sections `Platform default` (not configured), `This project's override` (API Key password field, Base URL, `Save project override`), `Project mapping & file upload` (`Link this project to TheLink`). Status: "No credentials configured — TheLink calls will fail."
**What changed:** None (PMFD §5.2). The helper still mentions a team ID that has no field (Q5).
**Likely affected:** PM-SMK-004 is deferred. None.

### Project Management › Integrations › XER Import — `/xer-import`
**Purpose:** import Primavera P6 (.xer / .xml) plans and map tasks to components.
**Layout (shot 082):** title "XER Plan Import" (in the page header, not captured as a heading). `Plans` list with `+ Import`: one plan, "2/15860 visible · 1 mapped", 26/10/2026. Prompt "Select a plan or import a new .xer / .xml file" and `Import Plan`.
**Probes:** `Import` and `Import Plan` changed nothing visible. **[I]** They open the OS file picker, as described in PMFD.
**What changed:** None on the landing page (PMFD §5.3). The plan view and "Select tasks to display" were not opened.
**Likely affected:** PM-REG-INT-07…21 and PM-SMK-005 are probably fine. "XER Plan Import" is visible in the screenshot even though the label check missed it.

---

## Summary: most important changes for test automation (this group)

1. **Menu restructure.** `Reference Data` is gone. PM-SMK-002 (expects 14 flat entries plus Reference Data) and PM-REG-NAV-01/02 will fail. The navigator `MENU` needs `PreShipping Checklist` → `[PM, 'Project Settings']`, plus new entries for `NCRs`, `Inventory Rebuild` and `Excel Import`.
2. **Sites & Storage is a new UI:**
   - the table became expandable cards
   - the `ADD` → `Add Location` modal is now an inline ADD LOCATION row with new types and parent locations
   - `Upload` → `Bulk upload`, `Export` → `Sites report` **[I]**, `Add Site` → `Add site`

   About 25 cases are affected: PM-REG-SITE-*, UPL-SITE-*, PM-SMK-017 and PLC-07. Delivery and inventory prerequisites that pick locations may also be affected.
3. **Configuration Options** has a new "Loads, receipt, P6 and NCRs" section, plus `Date Format` and `Port-to-site buffer`. It currently holds `-1` in Lead time confirmation, so PM-REG-CFG-01 will fail. Check the `More info` help-icon locator used by CFG-12.
4. **Material Category** is grouped by CSI division, with a new Division column and form field, so list selectors need rework (PM-REG-REF-15…23, PM-SMK-008).
5. **NCRs** is a new page with no coverage. It links to the new Configuration Options NCR settings. A scope decision is needed before any NCR is created.
6. **Bulk Upload Status** now shows `Partly successful` for Materials, but Components and Submittals still show "-". Update BUS-05/12 and re-check SCP-DEF-001.
7. **FDI Config:** question sets are chips, not tabs, and the organisation question-set entry points are on the page. The category search label changed, which affects PM-REG-FDI-04 and T543-06.
8. **State-dependent cases** now fail on data, not on the redesign: Inventory Control has 4 rules (INV-01 / SMK-012 empty state), and System Messages shows every row as "Disabled" (SYS-07/09).
9. **Not documented yet:** Excel Import (crawl could not open it) and Inventory Rebuild (existed since October; needs a decision on Dry Run versus Rebuild).
10. **Pages that look unchanged apart from their menu location:** Common UoM, Common Utilities (now with a visible `⋮`), Watched Materials, Submittal Manager, Booking, TheLink, XER Import.

---

## Part D – Supplier and Subcontractor views

_Walked the same day (24 Nov 2026, afternoon) with the Supplier and the Subcontractor accounts of the automation (`.env`), project NRVC_Hall. Same read-only method: every menu page opened, tabs clicked, forms opened and closed with Cancel, first-row menus read; then every Project Admin page opened directly by its address to see whether the role can reach it. No write warning in either run. Raw output: `reports/discovery-2026-11-24-supplier|subcontractor/` and `reports/walkthrough-2026-11-24-supplier|subcontractor/`._

**Important:** the access seen here is the result of the release **and** of the current Supplier / Subcontractor role settings (configuration-based, R40–R43). On 22 Nov the Supplier menu had no Project Management (SCP-DEF-076) and the Subcontractor menu showed the full Enterprise group (SCP-DEF-078). The role settings in VC Admin were not opened in this walkthrough. The read-only roles suite of the same night read them: Project Management is **not** enabled for the Supplier or the Subcontractor role, yet both see it – the menu does not follow the role settings (PM-REG-ROLE-08, client question 7).

### D.1 Menu per role

| Menu entry | Project Admin | Supplier | Subcontractor |
|---|---|---|---|
| Management Dashboard | ✔ | ✔ | – (opens by address) |
| Enterprise › Enterprise View | ✔ | ✔ | – ("You don't have access to the Enterprise View") |
| Enterprise › Supplier Performance | ✔ | ✔ | – (opens by address) |
| Enterprise › Enterprise Shipments | ✔ | ✔ | ✔ |
| Procurement Log | ✔ | ✔ | ✔ |
| My Work (new) | ✔ | ✔ | ✔ |
| Loads › All Loads / Unallocated / Discrepancies (new) | ✔ | ✔ | ✔ |
| First Delivery Inspections | ✔ | ✔ | ✔ |
| Messages (new) | ✔ | – ("Could not check messaging") | – ("Could not check messaging") |
| International Shipments | ✔ | ✔ | ✔ |
| User Management › User Management / Supplier List | ✔ | – (both open by address) | – (both open by address) |
| Document Management › All / Spec / PO / BOM / EPD Report | ✔ | ✔ | ✔ |
| Document Management › EPD Tracker (new) | ✔ | – (asks for epd:view permission) | – (asks for epd:view permission) |
| Project Management › Project Settings (4 pages) | ✔ (+ System Messages) | ✔ (System Messages blocked) | – (4 pages open by address; System Messages blocked) |
| Project Management › Sites & Storage, NCRs | ✔ | ✔ | ✔ |
| Project Management › Materials | ✔ | ✔ except Watched Materials (blocked) | – (all open by address, incl. Watched Materials) |
| Project Management › Inventory Settings | ✔ | Inventory Control only (Rebuild blocked) | – (Control opens by address; Rebuild blocked) |
| Project Management › Imports / Integrations | ✔ | ✔ (Bulk Upload Status, Submittal Manager, 3 integrations) | – (all open by address) |
| Analytics (all reports, TOV Analytics) | ✔ | – (all open by address) | – (all open by address) |

Pages that refuse a role (by any route): **System Messages, Inventory Rebuild, EPD Tracker** (both roles), **Watched Materials** (Supplier), **Enterprise View** (Subcontractor). Every other Project Admin page opens for both roles when its address is typed, with its action buttons shown (e.g. Material Master "Add Material" / "Upload" / row Edit-Delete-Map Supplier, Supplier List "Add Supplier" / "Upload", Configuration Options "Save", Booking Integration "Submit"). Whether those actions succeed was not tested (read-only).

### D.2 What each role sees on the shared pages

- **Management Dashboard (Supplier):** same layout as Project Admin – KPI tiles, Urgent issues (70), Alerts 38 / Notifications 99+ / Tasks 99+.
- **Procurement Log:**
  - Supplier: Add Submittal, Filters, Bulk Delete, Import (Import Submittal / Component, templates), Export, Columns. No bulk-edit or "Bulk assign Responsible".
  - Subcontractor: the same plus Select Columns for Bulk Edit, Bulk assign Responsible, View Bulk Edit Log – i.e. the Subcontractor has **more** Procurement Log actions than the Supplier.
  - Both see the four tabs; the Inventory tab shows "Loading inventory…" / no stock, as for Project Admin.
- **My Work:** "Projects at a glance" for NRVC_Hall with Tasks, Submittals, Materials, Loads, Discrepancies & NCRs, Pre-shipping checklist. Supplier: 138 tasks (126 overdue); Subcontractor: 509 tasks (153 overdue). This is where the earlier Supplier Inbox work now lives.
- **Loads:** both roles can open "Build load" (site picker with all NRVC_Hall sites); Discrepancies offers "NCR log".
- **First Delivery Inspections:** grouped by material category with "Question config" and question-set chips, for both roles.
- **Enterprise Shipments:** both roles can open "+ Log Shipment" (Project, Submittal, Manufacturer name/country, Container #, Bill of lading…).
- **Document Management:** Spec Documents "Add" (Spec Section No), Download, Send to TheLink, Delete; EPD Report "Scan Procore for EPDs", "Parse" – for both roles.
- **Project Management (Supplier):** Configuration Options with Save; Procurement Log Configuration "Add Log Fields" / "Save Changes"; FDI Config "Save"; Sites & Storage "Bulk upload" / "Sites report"; Material Category "Add" with the CSI division list; Common UoM / Utilities "Add"; Inventory Control "Add Rule"; TheLink "Save project override"; XER "Import Plan".

### D.3 Impact on the automation

| Area | Cases | Impact |
|---|---|---|
| Roles (role-regression, 28) | PM-REG-ROLE-* | Expected menus differ from 22 Nov; needs the intended access confirmed (question 7) before expectations are changed |
| E2E smoke supplier / subcontractor steps | TC-14B, TC-24B, checklist steps | Supplier Inbox → My Work; checklist reached through My Work "Pre-shipping checklist" |
| Known defects | SCP-DEF-076, SCP-DEF-078 | 076 now wider (Supplier has Project Management in the menu); 078 changed (Subcontractor Enterprise shows Shipments only) – re-check after question 7 |
| T508-18 | Supplier has no material bulk upload | Still offered (Material Master "Upload" for Supplier) |
| New | – | Direct-address access to Analytics, User Management, Supplier List and settings pages for both roles – candidate access defect if not intended |
