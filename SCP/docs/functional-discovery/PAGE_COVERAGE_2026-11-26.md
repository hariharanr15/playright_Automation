# SCP page coverage – 26 Nov 2026

_Staging, build of 24 Nov 2026. Covers the 51 pages of the app walkthrough (APP_WALKTHROUGH_2026-11-24) and the latest result of every case since the overnight run of 26 Nov (786 cases). A case counts for a page when the page is its module, sub-module, menu path or title. The 33 E2E cases cross many pages and are counted separately._

**Summary:** automation opens **all 51 pages**. TheLink Integration is skipped on purpose because it is an external system. The depth differs:

- **Deep (10 or more cases): 17 pages.** All P1 pages and most Project Management pages.
- **Medium (4–9 cases): 10 pages.**
- **Thin (1–3 cases, mostly "page loads and shows its controls"): 23 pages.** Most are P2 or read-only report pages. **My Work, the three Loads pages and NCRs carry workflows and need more depth.**

## 1. Pages and cases

| # | Page | Route | Cases | Result | Depth |
|---|---|---|---|---|---|
| 1 | Management Dashboard | /management-dashboard | 26 | 21 passed, 3 KD, 1 failed, 1 skipped | Deep |
| 2 | Enterprise View | /enterprise-view | 3 | 3 passed | Thin |
| 3 | Supplier Performance | /supplier-performance | 2 | 2 passed | Thin |
| 4 | Enterprise Shipments | /enterprise-shipments | 17 | 14 passed, 1 KD, 2 failed | Deep |
| 5 | Procurement Log (List, By submittal, By material, Inventory) | /procurement-log | 188 + 36 Inventory tab | 163 passed, 6 KD, 2 failed, 17 skipped | Deep |
| 6 | My Work | /my-work | 1 (+ ENT-REG-05) | passed | **Thin – workflow page** |
| 7 | All Loads (+ Build load) | /loads | 3 | 3 passed | **Thin – workflow page** |
| 8 | Unallocated Deliveries | /unallocated-deliveries | 1 | passed | **Thin – workflow page** |
| 9 | Discrepancies | /discrepancies | 1 | passed | **Thin – workflow page** |
| 10 | First Delivery Inspections (+ question sets) | /first-delivery-inspections | 20 | 13 passed, 7 skipped | Deep |
| 11 | Messages | /messages | 1 | passed | Thin – blocked (Delivery Management not connected) |
| 12 | International Shipments | /international-shipments | 27 | 20 passed, 1 KD, 3 failed, 3 skipped | Deep |
| 13 | User Management | /user-management | 42 | 32 passed, 4 KD, 6 skipped | Deep |
| 14 | Supplier List | /supplier-list | 24 | 22 passed, 1 KD, 1 skipped | Deep |
| 15 | All Documents | /all-documents | 9 | 8 passed, 1 KD | Medium |
| 16 | Spec Documents | /spec-documents | 7 | 6 passed, 1 skipped | Medium |
| 17 | PO Validation / BOM Validation | /po-validation, /bom-validation | 3 | 2 passed, 1 skipped | Thin |
| 18 | EPD Report | /epd-report | 10 | 9 passed, 1 skipped | Deep |
| 19 | EPD Tracker (new) | /epd-tracker | 6 | 6 passed | Medium |
| 20 | Aggregate Stats (redesigned) | /aggregate-stats | 12 | 10 passed, 1 KD, 1 failed | Deep |
| 21 | Lead Time Analysis | /lead-time-analysis | 3 | 3 passed | Thin |
| 22 | Supply Chain Intelligence | /supply-chain-intelligence | 2 | 1 passed, 1 KD | Thin |
| 23 | Emissions Report | /emissions-report | 2 | 2 passed | Thin |
| 24 | Inventory Reports | /inventory-reports | 2 | 2 passed | Thin |
| 25 | Status Report | /status-report | 3 | 3 passed | Thin |
| 26 | SubContractor Issues | /subcontractor-issues | 6 | 3 passed, 3 KD | Medium |
| 27 | Supplier Issues | /supplier-issues | 3 | 1 passed, 2 KD | Thin |
| 28 | TOV › Financial Forecast (new) | /financial-forecast | 2 | 2 passed | Thin |
| 29 | TOV › Submittal Invoiced Orders (new) | /submittal-invoiced-orders | 1 | passed | Thin |
| 30 | TOV › Submittal Level Outflow Projection (new) | /submittal-level-outflow-projection | 1 | passed | Thin |
| 31 | Configuration Options | /configuration-options | 29 | 17 passed, 4 KD, 8 skipped | Deep |
| 32 | Procurement Log Configuration | /procurement-log-configuration | 11 | 10 passed, 1 skipped | Deep |
| 33 | First Delivery Inspection Config | /first-delivery-inspection-config | 76 | 58 passed, 3 KD, 15 skipped | Deep |
| 34 | PreShipping Checklist | /preshipping-checklist | 7 | 5 passed, 1 KD, 1 skipped | Medium |
| 35 | System Messages | /system-messages | 16 | 15 passed, 1 KD | Deep |
| 36 | Sites & Storage | /site-details | 24 | 19 passed, 2 KD, 1 failed, 2 skipped | Deep |
| 37 | NCRs | /ncrs | 1 | passed | **Thin – workflow page** |
| 38 | Material Master | /material-master | 38 | 36 passed, 2 skipped | Deep |
| 39 | Material Category | /material-category | 13 | 13 passed | Deep |
| 40 | Common UoM | /common-uom | 8 | 7 passed, 1 KD | Medium |
| 41 | Common Utilities | /common-utilities | 11 | 10 passed, 1 KD | Deep |
| 42 | Watched Materials | /watched-materials | 13 | 13 passed | Deep |
| 43 | Inventory Control | /inventory-control | 9 | 8 passed, 1 skipped | Medium |
| 44 | Inventory Rebuild | /inventory-rebuild | 1 | passed | Thin – the rebuild action changes stock (not run) |
| 45 | Excel Import | (route unknown) | 1 | passed | Thin |
| 46 | Bulk Upload Status | /bulk-upload-status | 13 | 10 passed, 2 KD, 1 skipped | Deep |
| 47 | Submittal Manager | /submittal-manager | 2 | 2 passed | Thin – notice-only by decision (27 Oct) |
| 48 | Booking Integration | /booking-integration | 3 | 2 passed, 1 KD | Thin |
| 49 | TheLink Integration | /thelink-integration | 1 | skipped (external system) | Not run |
| 50 | XER Import | /xer-import | 15 | 14 passed, 1 KD | Deep |
| 51 | Supplier / Subcontractor views (Part D) | menus per role | 26 (Roles) + E2E TC-15/16 | 16 passed, 2 failed, 8 skipped | Deep |

The E2E smoke run (33 cases, TC-01…TC-25) runs the full flow across Procurement Log, Supplier List, User Management, Material Master, FDI, Enterprise Shipments, Dashboard and Analytics.

## 2. Gaps to close before Monday 30 Nov

| Page | What is missing | Proposed cases (read-only unless noted) | Effort |
|---|---|---|---|
| My Work | Only "page loads". The redesign made My Work the supplier and subcontractor work queue (it replaced Supplier Inbox) | Tabs and counters; project search; each queue item opens its submittal; counters match the list; Supplier and Subcontractor view of their own items | ~2 h |
| All Loads + Build load | Smoke only | List columns, filters and search; load detail; "Build load" form and validation (closed without saving) | ~2 h |
| Unallocated Deliveries | Smoke only | The run delivery is listed until allocated; filters; counts match | ~1 h |
| Discrepancies | Smoke only | List, filters, detail; an empty state when nothing matches | ~1 h |
| NCRs | Smoke only | List, filters, NCR detail; the Dashboard "Open NCRs" tile equals the NCR list count | ~1 h |
| Analytics thin pages (Lead Time, SCI, Emissions, Inventory Reports, Status, Supplier Issues, TOV ×3) | 1–3 cases each | Per page: filters change the data, totals equal the sum of rows, Export matches the table | ~3 h |
| Enterprise View, Supplier Performance | 2–3 cases | Project / supplier counts match the lists; filters; drill-down | ~1 h |

**Total: about 1½ days, read-only, no new records.** It fits the Monday plan when started on Fri 27 Nov.

**Out of reach by Monday:** Messages (blocked until Delivery Management is connected) and TheLink (external system).
