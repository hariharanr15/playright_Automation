# SCP application automation entry point

The reviewed runner reuses the existing Playwright JavaScript framework, Page Objects, authentication and reports. It selects qualified suites explicitly. It does not replace the legacy runners or assume that a registered/passing test establishes complete module coverage.

## Commands

From `SCP`, keep the existing `.env` credentials. Configure the approved allocations before execution:

```powershell
$env:SCP_INVENTORY_DATA = 'reports/inventory-discovery/environment.json'
$env:SCP_PROCUREMENT_DATA = 'reports/application-expansion-20261025/procurement-allocation.json'

# Registration only: no browser or application operations.
npm run test:application:reviewed:plan

# Headed installed Chrome, reviewed read-only suites, write-blocking fixtures.
npm run test:application:reviewed

# Also run existing Inventory regression on new dedicated staging records.
# This creates materials, mappings, submittals/components and stock transactions.
npm run test:application:reviewed:inventory
```

With the Inventory prerequisite failure and upload-input checks, read-only mode selects **156 cases**; the dedicated Inventory mutation mode selects **168 cases**. These totals include **30 non-browser checks**: ten calendar-arithmetic, ten issue-record/row/sort-contract, six historical-search contract and four Inventory prerequisite checks. Registration does not establish execution or complete business coverage. Every invocation creates a unique `reports/application-reviewed-*` folder containing a manifest, module HTML/JSON reports, logs and traces. Failures do not stop evidence collection for subsequent reviewed modules. Any non-passing child run leaves the application runner with a nonzero exit code. Blocked custom results remain native non-passing results; none are skipped to obtain green.

Inventory mutation setup now follows the [new material, new supplier, submittal and completed delivery prerequisite chain](INVENTORY_PREREQUISITE_FLOW.md). Earlier Inventory passes from setup that stopped at component creation do not validate this updated chain.

These commands do not dispatch unqualified Procurement delivery/GRN, FDI submission/shared configuration, user invitation/organisation changes, legacy supplier mapping or unfiltered Cucumber workflows. They do not select Construction Delivery, Enterprise Shipment, Setup Wizard, Integrations or System Messages workflows. The common shell's active-message GET remains allowed. Never use SUB-2026-525.

## Scope and remaining work

| Module | Reviewed automation available | Remaining limits |
|---|---|---|
| Inventory Management | Existing 3 smoke and 12 regression cases, plus 3 read-only activity-calendar checks and 10 date-arithmetic checks: context/identity, transactions, balances/history, site isolation, bulk, defaults and range refresh | Activity date-picker React loop and incorrect default range remain application failures; the screen has no Reset button by design (confirmed 28 Oct 2026), so none is tested; no complete-coverage claim |
| Procurement Log | New 3-case read-only smoke, exact owned record/component/date/quantity/UOM and no-match/reset; Inventory-owned setup and integration | Standalone delivery/checklist/shipping/GRN needs qualified dynamic inputs and confirmed checklist rules |
| Enterprise | Four smoke cases; 37 regression checks covering navigation, context, filters, KPIs, source reconciliation, sorting and CSV where supported | Historical full-suite failures/blockers remain; the new historical flow verifies CSV content while retaining numeric display failures |
| Management Dashboard | Read sets, exact project, aggregates, charts, date boundaries and archive checks | Four regression failures; three independent archive-source blockers |
| FDI | Existing scenarios preserved; independent notification contract remains executable | Fresh exclusive records, safe config allocation and role/source fixtures needed before mutable execution |
| International Shipment | Existing read-only smoke retained with pre-auth runtime guard | Legacy mutation flow needs valid dynamic Procurement/origin/shipment allocation |
| User Management / Supplier List | Existing read-only smoke retained; existing regression preserved | Qualify deterministic user identity, controlled mailbox/organisation rules and owned supplier/material mapping before remaining execution |
| Document Management | All/Spec lists, identity/status, downloads, PO/BOM rejection and independent positive-document contracts | Existing download returns 404; positive document/rule fixtures absent |
| Project Management | Bulk Upload Status and Submittal Manager guarded checks; legacy reference/configuration scenarios preserved | Legacy mixed upload semantics and repurposed page are Blocked; mutable reference/configuration cases need exclusive allocations |
| Analytics | Aggregates, forecast/TOV, issues, inventory/status, EPD/emissions, lead-time reconciliation and independent source contracts | Numeric display/table discrepancies and missing independent sources; formulas are not invented |

The earlier strict pre-authentication smoke run still fails on APP-SSO-001. The reviewed runner intentionally retains that gate for Inventory read-only and the other legacy smoke stage. Workflow passes collected after authentication do not close the SSO defect. The dedicated Inventory mutation fixture remains separate and retains its existing behavior.

## Dedicated Procurement allocation

The new suite does not choose a first business record. Its fixture is extracted from exactly one passed owned-record creation case in an approved execution report. It verifies active project ID/site and the saved material, component, UOM, quantity, price and required-on-site date before UI assertions. The original generated business values remain the oracle; live values are not blindly accepted as new expected values.

To qualify a replacement owned allocation after a new approved Inventory run:

```powershell
node scripts/qualify-procurement-allocation.js path/to/results.json 'Exact passed owned-record case title' path/to/approved-inventory-allocation.json path/to/new-procurement-allocation.json
```

The qualifier requires exactly one passed case and one owned manifest. Missing/ambiguous relationships fail qualification. It writes a local fixture only. Date comparisons reuse the existing calendar-date parser; the component quantity assertion uses the exact quantity column and validates both its number and UOM.

## Evidence

- [Latest functional rehearsal and corrected test results](../reports/functional-demo-fix-20261026-summary/README.md).
- [Earlier application expansion and status](../reports/application-expansion-20261025/README.md).
- [Common date-filter integration and remaining adapters](SCP_HISTORICAL_DATE_SEARCH.md).
- [Historical-date execution results](../reports/historical-date-search-20261026-summary/README.md).
- [Earlier scenario-wise coverage matrix](../reports/scp-pending-summary/scenario-matrix.csv): historical evidence, not silently relabelled as the new run.
- [All 47 tracker scope rows](../reports/scp-pending-summary/module-matrix.csv): historical tracker mapping with explicit gaps.
- [Qualified-data and rule blockers](../reports/approved-regression-20261025/QUALIFICATION-GAPS.md).

Application defects require application changes. Missing calculation rules, independent sources and role allocations require real inputs. A general instruction to proceed does not supply those inputs; affected scenarios remain Blocked rather than inventing expected results.
