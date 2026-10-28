# Inventory Management manual entry

Scope: SCP Inventory Management manual entry, the subsequently authorized Excel bulk upload, and Procurement Search/owned prerequisites only. Construction Delivery, red-highlighted tracker modules, and FDI (including SUB-2026-525) are excluded. Inventory's `Issue To Construction` action is in scope; it does not navigate to Construction Delivery.

## Running

Use the existing staging `.env` credentials. Copy `test-data/inventory-management.example.json` to a local allocation file and set exact existing project/site/location identities. `referenceMaterialId` supplies category/UOM for new owned materials. Each stock-changing case creates a new supplier and material, maps them, creates a related submittal/component and completes delivery before Inventory operations. Source and destination must belong to the selected site. See the [required prerequisite chain](INVENTORY_PREREQUISITE_FLOW.md); earlier execution results that omitted delivery are historical evidence.

```powershell
$env:SCP_INVENTORY_DATA = 'path/to/local-allocation.json'
$env:SCP_INVENTORY_RUN_DIR = 'reports/inventory-UNIQUE-RUN-NAME'
$env:HEADLESS = 'true'
node node_modules/@playwright/test/cli.js test --config=playwright.inventory.config.js --grep 'Inventory smoke'
```

For an approved stock-changing rehearsal, set `SCP_INVENTORY_MUTATIONS=true` and omit `--grep` or select a specific case. Missing allocations fail as **Blocked** in `coverage.json` (with a failing native Playwright result), never as passing/skipped tests. Do not run a stock-changing suite with automatic retries. Each run needs a new report directory. The configuration defaults to a timestamped directory, preserving existing reports.

Generated quantities are reproducible from the owned-record attachment and are not inferred from the saved result. Schedule IDs are generated numeric strings because the deployed form rejects nonnumeric IDs. Dates come from the UI/component metadata. No environment credentials are stored in allocation JSON.

## Confirmed form contract

| Control | Observed behavior |
|---|---|
| Activity date | Calendar, read-only text input; selection behavior requires a functioning picker |
| Item | Required; explicitly created owned SKU; conversion retrieved from the reference base-unit SKU and asserted after save |
| Action | Required; Incoming Load, Internal Movement, Issue To Construction, Loss, Return |
| From Location | Required; selected site's location |
| To Location | Required and visible only for Internal Movement |
| QTY | Required; positive numeric value; movement validates at most two decimal places and available stock |
| Comments | Required text |
| Supplier | Required; dynamically created supplier mapped to the same new material and submittal |
| Subcontractor | Required; existing project subcontractor |
| Submittal | Required; exact unique owned submittal |
| Schedule | Required; schedule options loaded from the selected submittal |

There are no optional business fields in the inspected Add Activity form. UI labels and validation messages were inspected live; deployed client source was also inspected as corroboration. Client implementation is not used as the independent expected balance oracle. Return reduces warehouse stock, explicitly confirmed by the user.

## Scenario mapping

| Scenario | Code | Verification / limitation |
|---|---|---|
| Context, identity, UOM, Search, no-match/reset | Smoke spec | Exact project/site, material/category/ID/UOM; UI stock compared with a read-only ledger lookup; name, ID, case-insensitive and partial search |
| Location, Submittals and UOM views | Smoke spec | Exact material metadata and view records compared to their loaded response |
| Excel upload | Separate bulk spec | One atomic-rejection negative file and one four-action positive file after the automatic delivery receipt; all generated files use the exact saved Procurement date/submittal/PO; see `test-data/bulk-upload/README.md` |
| Required fields, conditional destination, cancel/reopen | Smoke spec | Specific messages; no activity POST for rejected client-invalid submissions |
| Five activity types | Regression parameterization | Independent material/component per case; owned receipt prerequisite; saved comments/identity/linkage, signed quantities, opening/closing balance, exact UI history and subsequent Search in both modules |
| Individual required-field omissions | Regression | Each required field omitted; all available independent fields populated; hidden/empty dependent controls left unset with their missing parent; unchanged history |
| Quantity boundaries | Regression | Zero, negative, more than two decimals for movement, same-location movement, overdraft; exact-stock movement boundary |
| Location and site isolation | Regression | Source/destination balances, conserved total, zero balance on second site, restore exact primary context |
| Date filtering | Regression | Same-day inclusive range for owned records; blocked by calendar defects if present |
| Activity-date selection | Regression | Requires selected date to remain displayed; no stock submission |
| Refresh retaining context | Not claimed | Live refresh restored saved site rather than the current selected site. Persistence uses navigation plus explicit re-selection/assertion of exact context, not silent refresh recovery |
| Edit/update activity | Unavailable in inspected UI | History has no edit/update control. No fabricated edit scenario |
| Adjustment | Unavailable in inspected action list | Five action options inspected; no Adjustment option |
| Receipt against booking | Blocked pending dedicated fixture | Inventory landing exposes Receive booking. A dedicated receivable booking with known ordered/delivered quantities is needed; no Construction Delivery booking creation is performed |
| Text maximum, non-movement quantity maximum/overdraw | Rule gap | No explicit UI limits found. Do not invent limits or infer intended behavior from acceptance alone |
| Supplier/subcontractor persistence | Partial observable contract | Selections are asserted in UI; ledger response exposes item, locations, comments, submittal and schedule but not saved supplier/subcontractor fields. Additional read endpoint or detail UI is needed to verify these persisted fields independently |

## Evidence and isolation

The Inventory configuration extends the existing Playwright config, with HTML, JSON, screenshots and traces in a separate run directory. Playwright already instruments manually created SCP contexts; the Inventory suite does not start a second trace. Failure screenshots and context attachments use `scpProject.page`, with bounded capture for an unresponsive app. `coverage.json` distinguishes Passed, Failed, Skipped and Blocked. Native failures are not converted to skips or expected failures.

Owned-record manifests record created IDs as setup progresses. No automatic deletion, reversal, receipt retry or cleanup stock movement occurs. Failed setup records are retained for inspection. Existing FDI source changes present before this work are untouched.

## Application issues observed during discovery

- Refresh can restore the saved site instead of the selected session site. Exact site checks are mandatory after navigation.
- Opening the Add Activity date picker triggered repeated React `Maximum update depth exceeded` errors and an unresponsive page during a read-only date test. This is an application failure, not evidence of passed date coverage.
- The Add Activity client submission inspected during discovery does not include the selected date in its payload. Backdated persistence cannot be claimed even if the picker is repaired.

Execution results and any additional findings are recorded in the run-specific HTML/JSON artifacts; this document does not turn implementation into verified coverage.

The 24 October rehearsal verified all five manual action types, quantity rejection and exact-stock boundaries, location/site isolation, inclusive history date filtering, and the three read-only smoke cases. The separate bulk recheck verified both the five-action positive file and the single atomic-rejection negative file. Add Activity date selection remains a reproduced application failure; receipt against booking, unavailable edit/adjustment controls and unobservable supplier/subcontractor persistence remain the explicit coverage gaps above. See the final execution summary under `reports/inventory-final-summary.md` for case-by-case evidence and the required-field recheck result.

