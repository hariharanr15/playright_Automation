# Management Dashboard, Enterprise and Analytics – Discovery and Scenarios (SCP Staging)

> **Step-by-step flows (Action → Expected, matching the automated steps):** [MODULES_SMOKE_STEPS.md](steps/MODULES_SMOKE_STEPS.md), [MODULES_REGRESSION_STEPS.md](steps/MODULES_REGRESSION_STEPS.md)

Date 2026-11-02 · `NRVC_Hall` · Project Admin · Playwright MCP. Analytics follows **APP-R1** (test as observed; no business oracle). Page map: [APP_MAP_SWEEP.md](APP_MAP_SWEEP.md).

## 1. Management Dashboard – discovery [O]
- "Your watched materials" (categories, e.g. Motorola, Oneplus, Paint, TV), `View in Procurement Log →`, `Manage assignments`; Material Category and Supplier tables.
- Tabs with counters: **Alerts** (279), **Notifications** (58), **Tasks** (136); `Unread` toggle; `Mark all as read on this page`; charts ("Project Aggregate Stats", "Notification Charts", "Task Charts").
- Rows come from Procurement events, e.g. Notifications "Delivery of 6 units of 43 Inches has been received at site for submittal …", "Lead time changed. New expected delivery …"; Alerts "New submittal '…' was added."; Tasks "Create PO. Last Possible Ordering Date …" (status Created), "Notification has been triggered for Pre-Shipping Checklist." (Not Started).
- Row envelope icon "Mark as read" → "Marked as read!", counter −1 (58 → 57).
- **The manual Trigger Alert message ("Delivery for Item …") was not found in the user's notifications** (OBS-DSH-1; PL-R14 says the user receives it).

## 2. Enterprise – discovery [O]
Enterprise View (Supplier / Spend / % of total, Download CSV); Supplier Inbox ("Access: 3 projects · 3 organizations", filters, sections Unconfirmed Lead Times / Overdue Items / Deliveries to Schedule / Pending Pre-Shipping Checklists); Supplier Performance (6/12 months, project- and supplier-wise); Lead Time Benchmarks. Oracle for counts: **BUGS-325** (existing rule, scp-enterprise-bugs325).

## 3. Analytics – discovery [O]
Aggregate Stats, Lead Time Analysis (same content as Lead Time Benchmarks, OBS-APP-2), Supply Chain Intelligence, Emissions Report, Inventory Reports, Status Report, SubContractor Issues, Supplier Issues, TOV Analytics (opens `/supplier-issues`, OBS-APP-1). Details in APP_MAP_SWEEP.

## 4. Smoke (read-only)
| ID | Title | Expected | Ev. |
|---|---|---|---|
| DSH-SMK-01 | Dashboard loads | Watched materials, two tables, 3 tabs with counters | O |
| DSH-SMK-02 | Each tab lists rows | Alerts / Notifications / Tasks tables with Description, Mark as read, Created At (Tasks also Date, Status, Action) | O |
| ENT-SMK-01…04 | Enterprise pages load | Enterprise View, Supplier Inbox, Supplier Performance, Lead Time Benchmarks render their sections | O |
| ANA-SMK-01…09 | Analytics pages load | Each report renders its headings/tables | O |

## 5. Regression
| ID | Title | Type | Impact | Steps → Expected | Ev. |
|---|---|---|---|---|---|
| DSH-REG-01 | Mark as read | POS | M | Envelope icon → "Marked as read!"; counter −1 | O |
| DSH-REG-02 | Mark all as read on this page | POS | M | Only visible rows marked; counter decreases by the page size | I |
| DSH-REG-03 | Unread toggle | POS | R | Shows only unread | I |
| DSH-REG-04 | Delivery notification | INT | M | After a run GRN → "Delivery of N units of <material> has been received at site for submittal <no>" | O |
| DSH-REG-05 | Lead time notification | INT | M | After a lead-time change → "Lead time changed. New expected delivery <date>" | O |
| DSH-REG-06 | New submittal alert | INT | M | After Add Submittal → "New submittal '<no>' was added." | O |
| DSH-REG-07 | Create PO task | INT | M | After a Not Ordered component → task "Create PO. Last Possible Ordering Date …" | O |
| DSH-REG-08 | Pre-shipping task | INT | M | After a delivery → "Notification has been triggered for Pre-Shipping Checklist." | O |
| DSH-REG-09 | Trigger Alert reaches the user | INT | M | Procurement Trigger Alert message listed for the user (PL-R14) | O – not found (OBS-DSH-1) |
| DSH-REG-10 | Daily alert batch | INT | M | Two-phase (seed day 1, verify day 2) | I |
| DSH-REG-11 | View in Procurement Log | INT | R | Opens Procurement Log with the watched filter (PL-R8) | I |
| ENT-REG-01 | Enterprise counts match Procurement | INT | R | BUGS-325 oracle for NRVC_Hall | O (existing) |
| ENT-REG-02 | Supplier Inbox lists run items | INT | M | Not Confirmed run component under Unconfirmed Lead Times; pending checklist under Pending Pre-Shipping | I |
| ENT-REG-03 | Download CSV | POS | R | Rows = table rows | I |
| ANA-REG-01 | Date range never increases totals | POS | R | Narrow range → totals ≤ before | APP-R1 |
| ANA-REG-02 | Export works | POS | R | File with the shown rows | APP-R1 |
| ANA-REG-03 | Status Report Generate | POS | R | Tables render | APP-R1 |
| ANA-REG-04 | Totals equal sum of rows | POS | R | Same page consistency | APP-R1 |
| ANA-REG-05 | TOV Analytics route | Q | R | Own page (today `/supplier-issues`) | O |

Totals: 15 smoke · 19 regression.
