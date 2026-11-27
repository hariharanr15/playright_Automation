# Release impact on the automation – day 1 (24 Nov 2026)

_Staging · NRVC_Hall · Project Admin · read-only crawl of 24 Nov 2026, 11:27 UTC (53 pages)._
_Sources: `tests/pm-flow/app-discovery.spec.js` (crawl), `scripts/discovery-impact.js` (comparison). Raw output, including screenshots: `reports/discovery-2026-11-24/`._

The client is still developing; more changes are expected within a month. This map describes the staging build of 24 Nov and will be refreshed by re-running the crawl after each deploy (about 6 minutes, read-only).

## 1. What changed in the menu and pages

**Top-level menu now (11 entries):** Management Dashboard · Enterprise · Procurement Log · **My Work** · **Loads** · First Delivery Inspections · **Messages** · International Shipments · Document Management · Project Management · Analytics.

| Change | Pages | Automation impact |
|---|---|---|
| **Removed** – route now redirects | Enterprise › Supplier Inbox → `/my-work`; Enterprise › Lead Time Benchmarks → `/lead-time-analysis`; Inventory Management → Procurement Log "Inventory" tab ("Couldn't load inventory.") | ENT-REG-04/05/07, E2E TC-14B/24B/26, Inventory regression (25 cases), INV smoke: need a scope decision (retire, or move to the new page) |
| **New page** | My Work (tasks across projects) | Replaces Supplier Inbox; no coverage yet |
| **New group** | Loads › All Loads ("Build load", Upcoming / All loads), Unallocated Deliveries, Discrepancies (damaged, wrong product, short/over delivery, unplanned arrival…) | New delivery-management flow; no coverage yet |
| **New page** | Messages – shows "Delivery Management isn't connected" | Not testable until a platform admin connects it |
| **New page** | Project Management › NCRs (non-conformance reports; statuses, corrective actions, Export to Excel) | Linked to "Raise NCR" on deliveries; no coverage yet |
| **New page** | Document Management › EPD Tracker (Required/Requested/Expiring/Expired/Received/Verified) | No coverage yet |
| Existing page, now under Inventory Settings | Project Management › Inventory Settings › Inventory Rebuild (Dry Run / Rebuild; in the menu since October) | Not covered; Rebuild changes stock balances – needs a decision before any write test |
| **New page** | Project Management › Imports › Excel Import (`/excel-import`): "Import your spreadsheet" (.xlsx/.csv), column mapping saved per project | No coverage yet |
| **Split** | Analytics › TOV Analytics is now a group: Financial Forecast, Submittal Invoiced Orders, Submittal Level Outflow Projection (earlier it opened Supplier Issues, OBS-APP-1) | New Analytics pages; no coverage yet |
| **Back in the menu** | Project Management › Project Settings › PreShipping Checklist (was route-only on 23 Nov) | Navigator entry to update |
| **Redesigned** | Management Dashboard: KPI tiles (open discrepancies, open NCRs, loads awaiting receipt, unplanned arrivals) and "Urgent issues" tabs (Delivery discrepancies, Lead time later than ROJ, Order not confirmed in time, NCRs, Alerts) | DSH cases and E2E TC-23/23B/24 |
| **Redesigned** | Procurement Log list (tabs List / By submittal / By material / Inventory; Filters, Columns, Bulk assign Responsible, Import); submittal and component pages (adapted on 24 Nov) | Adapted; PL parts 1–3 pass |
| **Redesigned** | Sites & Storage: site cards with storage locations, "Bulk upload", "Sites report", "Add site" | PM-REG-SITE-* and UPL-SITE-* |
| **Changed fields** | Configuration Options: new "Loads, receipt, P6 and NCRs" section, "Date Format" and "Port-to-site buffer (days)" (the Not ordered / Not booked alert fields already existed) | PM-REG-CFG-* and cfg-live expectations |
| Unchanged route and name (content to confirm by run) | Enterprise View, Supplier Performance, Enterprise Shipments, First Delivery Inspections, User Management, Supplier List, All/Spec Documents, PO/BOM Validation, EPD Report, Project Settings pages, Materials pages, Inventory Control, Integrations, Bulk Upload Status, Submittal Manager, Analytics reports | Run the suites to find out |

International Shipments takes over a minute to load; once loaded it shows a Risk Dashboard (91 shipments, 61 at risk), Delay Alerts, Flag & Review and Shipments, with status updates from ShipsGo tracking.

**Corrected after the full walkthrough (same day):** Inventory Rebuild and the Not ordered / Not booked alert fields are not new; Excel Import is a new page. Details per page: `APP_WALKTHROUGH_2026-11-24.md`.

## 2. Test cases against the new build

| | Cases | Suites |
|---|---|---|
| Already re-run on the new build (24 Nov) | 203 | Procurement Log parts 1–3, tickets, Configuration Options live effects, E2E smoke, Inventory set-up |
| **Not yet run on the new build** | **417** | PM regression parts 1–2 (228), other modules regression (82: User Management, Supplier List, FDI, Documents, Shipments, Dashboard, Enterprise, Analytics), Inventory regression (25, page removed), roles (28), FDI settings (16), Analytics/Enterprise validation (17), PM decisions (5), fresh project (3), FDI follow-up (5), BUGS ticket cases (8) |

The label check in `reports/discovery-2026-11-24/IMPACT.md` lists 292 screen texts used by the specs that are not on any landing page. Most are dialog or drawer texts the crawl does not open: Procurement Log part 2 has 34 such texts and still passed 30 of 31 cases on this build. The check is a lead, not a verdict. **The per-case impact comes from running the 417 cases on the new build.**

## 3. Plan for the week (updated)

| Day | Work |
|---|---|
| 1 (24 Nov) | Crawl and this map ✔. Tonight: run the suites not yet run on the new build (headless, one at a time) |
| 2 | Triage the night's failures into: navigation only / changed behaviour / removed / application defect. Update the navigator for the new menu (PreShipping Checklist, Imports, TOV Analytics group, removed pages) |
| 3–4 | Fix the failing cases module by module, largest first (PM regression, other modules, roles) |
| 5 | New coverage for finished new pages: My Work, Loads, Discrepancies, NCRs, EPD Tracker, TOV Analytics pages (smoke level first) |
| 6 | Full regression overnight; known-defect re-check |
| 7 | Fixes, re-run of failures, v2.0 reports for the build tested |

## 4. Decisions needed from the client / developer

1. Which of the new areas are finished and should be covered this week: My Work, Loads, Discrepancies, NCRs, EPD Tracker, Messages, Inventory Rebuild, TOV Analytics pages, Excel Import.
2. Inventory: is the Procurement Log "Inventory" tab the replacement for Inventory Management, and is "Couldn't load inventory." a defect or unfinished work?
3. Supplier Inbox and Lead Time Benchmarks were removed: retire their cases (ENT-REG-04/05/07, TC-14B/24B) or move them to My Work / Lead Time Analysis?
4. Messages needs Delivery Management connected by a platform admin before it can be tested.
5. Inventory Rebuild recalculates stock balances: may the automation run "Rebuild" on NRVC_Hall, or only "Dry Run"?
