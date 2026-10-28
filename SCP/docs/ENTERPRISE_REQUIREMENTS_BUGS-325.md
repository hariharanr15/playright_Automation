# Enterprise calculation requirements (BUGS-325)

Provided by the project team on 28 Oct 2026 as the oracle for the Enterprise regression checks. In scope: Enterprise View, Supplier Inbox, Supplier Performance and Lead Time Benchmarks. Enterprise Shipments is out of scope.

## Cross-cutting rules

- The Enterprise menu and its in-scope sub-menus are available to any user with access to at least one SCP project.
- Unless a section says otherwise, every metric, chart and list rolls up every project the user can access, across Organizations. Project-wise views show each project with its owning Organization.
- Every in-scope view is read-only (no add, edit or delete).
- **On-Time Delivery** (everywhere): a Delivery counts in the numerator or denominator only once its Actual Delivery Date is entered. On time = Actual Delivery Date on or before the Component's Expected Delivery Date, falling back to the Component's Date Required On Site when no Expected Delivery Date is set.
- Two lead-time concepts:
  1. **Planned/Forecast Lead Time**: the confirmed Lead Time on the Component, or, when not confirmed, the default from the Supplier-to-Material lead-time mapping.
  2. **Actual Lead Time** per delivery: (Actual Delivery Date − PO Date) / 7, in weeks.

## A. Enterprise View

| Metric | Rule |
|---|---|
| Projects in Scope | Count of accessible projects |
| Open Submittals | "X of Y": Y = all Submittals; X = status not "Delivered" **or** no Components created |
| On-Time Delivery | Shared rule; shows the denominator (deliveries with an Actual Delivery Date) |
| Active Alerts | Count of active alerts, plus the count of distinct accessible projects with at least one |
| Lead-Time Variance | Per Component: Actual = average over its deliveries of (Actual Delivery Date − PO Date)/7; % = (Actual − Planned)/Planned × 100. Plain average over Components with at least one delivered Delivery; shows n |
| Submittals by status | Current-status headcount; each Submittal once; six bars sum to Y |
| Spend by supplier | One row per Supplier; Total Spend = Σ Component-level PO Value; % of Total = supplier spend ÷ all spend |
| Projects Summary | Per project: Organization name/ID, Project name/ID, Open, On-time, LT Var (project's Components only), Spend, Alerts (open/unread Alerts/Notifications/Tasks) |
| Lead time vs platform | Per Material Category: Your avg = average Planned/Forecast Lead Time; Platform avg; Industry avg (master table, blank if absent); Delta = Platform − Your; Contributing Orgs |

## B. Supplier Inbox

Sections: Unconfirmed Lead Times; Overdue Items (+ Qty overdue, Ageing days); Deliveries to Schedule (+ Qty yet to be scheduled); Pending Pre-Shipping Checklists (+ Pending With Supplier / Sub-contractor; only for projects with the checklist enabled).

Each section opens as a collapsed summary (No of Projects, Materials, Submittals, Components; plus No of Deliveries for Pre-Shipping) that expands to the list. Filters: Project, Submittal, Material, Supplier, and where relevant Required-on-site and Expected delivery dates; Pending With only on Pre-Shipping.

## C. Supplier Performance

Cards: On-Time Delivery % (shared rule); Active Components (not fully delivered); Overdue (not fully delivered and Expected Delivery date passed); Lead Times Confirmed % (confirmed ÷ all Components); Avg Lead Time (average Planned/Forecast weeks); Deliveries (Last 90 Days) (Actual Delivery Date within 90 days).
Deliveries by month: last 6 months by default, toggle to 12.
Project Wise Summary and Supplier Wise Summary: the same six metrics per project / per supplier.

## D. Lead Time Benchmarks

Cards: Total Delivered; On Time (%); On Time Count; Late = Total Delivered − On Time Count; Avg Delay (days) = mean of (Actual − applicable deadline) over Late deliveries.
Lead Time Comparison by Category: Your avg = mean Actual Lead Time over deliveries in accessible projects; Client avg = same over all projects of the user's Organization; Platform avg = same platform-wide; Industry avg (master table); Delta = Your − Platform (reverse of Enterprise View); Status: < −1 Below Avg, −1..1 On Par, > 1 Above Avg; Platform range = rounded min–max; Industry range = master min–max; Projects = accessible projects using the category; Active Alerts blank.

The full acceptance criteria are in BUGS-325.

## Observed on staging, 28 Oct 2026 (read-only reconciliation)

Range From 30/07/2026 to 28/10/2026, Organization Admin account, 9 projects in Enterprise scope. Each Enterprise value was recalculated from the Procurement source records (submittals, components, deliveries) of every project in scope.

| Metric | Enterprise | Calculated | How Enterprise matches | Against BUGS-325 |
|---|---|---|---|---|
| Open Submittals | 126 of 161 | 126 of 161 | Submittals in the date range; open = not Delivered OR no components | Matches |
| Spend | 2,529,182,348 | 2,529,182,348 | Σ component price × quantity, submittals in range | Matches |
| On-Time Delivery | 85 of 122 (69.7%) | 85 of 122, all 4 projects exact | Deliveries whose Actual Delivery Date is inside From–To, **excluding deliveries received via Inventory**; deadline = Component Expected Date, else Date Required On Site | Spec counts every delivery with an Actual Delivery Date (181 deliveries, 143 on time); the Inventory exclusion and the date basis are not in the spec |
| Lead-Time Variance | −27.2%, n=57 | −27.2%, n=57, all 4 projects exact | Components of submittals in range; deliveries **excluding Inventory receipts**; Planned = component `lead_time_in_weeks`; components without PO date or lead time skipped | Spec: unconfirmed components use the Supplier-to-Material default; 8 delivered components have no lead time and are skipped |
| Submittals by status | 28 / 0 / 37 / 3 / 58 / 35 | Same, 6 of 6 | Each submittal takes its least-advanced component's status (no components = Not Ordered) | The submittal's own status differs (16 blank, 16 "partial_delivery_at_risk") |
| Projects in Scope | 9 | 6 in the session's project list | Includes James test SCP, NR PRJ 001 and SCP-Setup-Test1, which are not in the account's project list | Spec: projects the user has access to |
| Active Alerts | 711 across 6 projects | Equals Σ project-row alerts | Not yet recalculated from alert records | Spec: active (open/unread) alerts |

## Additional requirement (28 Oct 2026)

The Enterprise menu has five sub-menus: Enterprise View, Supplier Inbox, Supplier Performance, Lead Time Benchmarks and Enterprise Shipments (Shipments stays out of the BUGS-325 calculations). The menu is available to anyone with access to at least one SCP project. Data is always rolled up, or shown project-wise with Organization information, across every project the user can access: one project, several in one Organization, or several across Organizations. All Enterprise views are read-only.

## Decisions (28 Oct 2026)

- An Organization Admin sees every project in the Organization. The test account was then limited to three projects: NRVC_Hall, SCP_Testing_Ram and VC SCP 001 TEST.
- Active Alerts = unread alerts.
- Everything else is tested exactly as BUGS-325 is written.
- BUGS-325 does not say which date From–To filters, and Enterprise and the Procurement list filter on different dates. The calculation tests therefore set From–To to 01/01/2020–today and compare against every submittal of every accessible project.

## Automated checks (tests/regression/enterprise/scp-enterprise-view.spec.js)

| Test | First result, 28 Oct 2026 (3-project account, all records) | Known Defect |
|---|---|---|
| Projects in Scope, Open Submittals, status chart, Spend | Projects in Scope 3 = 3. VC SCP 001 TEST: Enterprise 296 submittals vs 10 in Procurement Log (screen and API); totals 401 vs 115; Spend 636,204,696,194 vs 32,431,523,848 | SCP-DEF-015 |
| On-Time Delivery | 116 of 163 vs 119 of 150; NRVC_Hall 71.76% vs 80.82% | SCP-DEF-016 |
| Lead-Time Variance | −10.9%, n=90 vs −30.1%, n=53; NRVC_Hall −36.0%/49 vs −34.6%/50 | SCP-DEF-017 |
| Active Alerts | 18,190 vs 1,013 unread (NRVC_Hall 365 vs 5) | SCP-DEF-018 |

Each test attaches `enterprise-cross-project-comparison` (Enterprise values, the recalculated values per project, excluded components and every difference).

### Same From–To on both sides (28 Oct 2026, evening)

As agreed, the tests now apply Enterprise's selected From–To unchanged to the Procurement and alert reads. Account scope: NRVC_Hall only; range 30/07/2026–28/10/2026.

| Check | Enterprise | BUGS-325 | Result |
|---|---|---|---|
| Projects in Scope, Open Submittals, status chart, Spend | — | — | **Pass** |
| On-Time Delivery | 48 of 67 (71.64%) | 53 of 74 (71.62%) | SCP-DEF-016: the 7 deliveries received via Inventory are left out |
| Lead-Time Variance | −32.2% (n=37) | −33.9% (n=37) | SCP-DEF-017: Inventory deliveries are left out of Actual Lead Time |
| Active Alerts | 236 | 1 unread | SCP-DEF-018 |

### Range 28/09/2026–28/10/2026 (NRVC_Hall)

The same From–To was set in Enterprise and used for the Procurement reads. Each Enterprise metric filters on a different date. These rules reproduce Enterprise exactly from the full NRVC_Hall records:

| Metric | Enterprise | Date Enterprise filters on | Procurement-filtered (BUGS-325 check) |
|---|---|---|---|
| Open Submittals, status chart | match | same as the Procurement Log list | match |
| Spend | 793,391,048 | Component created date | 289,891,048 |
| On-Time Delivery | 23 of 42 | Delivery Actual Date, excluding Inventory receipts (48 → 42) | 19 of 22 |
| Lead-Time Variance | −63.0%, n=22 | Component created date | −61.2%, n=21 |
| Active Alerts | 236 | — | 1 unread |

BUGS-325 does not say which date From–To applies to, so the expected population for Spend, On-Time and Lead-Time Variance needs a decision.

Project team, 28 Oct 2026: the On-Time Delivery and Active Alerts differences come from old values that were not reset; new records are expected to be counted correctly. SCP-DEF-016 and SCP-DEF-018 stay registered so the checks show when new data reconciles. The date basis for Spend and Lead-Time Variance is still to be decided.
