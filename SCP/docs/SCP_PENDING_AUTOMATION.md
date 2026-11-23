# SCP pending automation

The user authorised implementation of the in-scope pending items and instructed use of existing credentials. New code uses the existing SCP authentication/project fixtures and preserves existing tests/reports. Enterprise remains read-only. Construction Delivery, Enterprise Shipments, Setup Wizard, Integrations, System Messages and reuse of completed FDI SUB-2026-525 are excluded. Common-shell background reads are not module automation.

## Implemented additions

- Dedicated Enterprise parent/submodule page objects, smoke cases and regression tests for cards, exact tables, supplier percentages, CSV values/dates, Inbox qualification/filtering/completeness, performance trends and benchmark values/sorts.
- Independent Procurement source collection with bounded concurrency, complete pagination checks, component/delivery identity relationships and open-submittal reconciliation. A documented empty-delivery HTTP 201 is handled explicitly.
- Separate calculation functions for completed-only OTD with component deadline fallback, actual weeks, component-weighted variance, forecast fallback, active/overdue/confirmation figures and exact benchmark status thresholds. Calculator tests are not counted as application coverage.
- Dashboard personal Unread, Read/Unread/All sets, aggregate display, independent notification grouping, task count reconciliation, chart/date scope, calendar boundaries, archive configuration options and personal archival source checks.
- All/Spec Documents record fields and downloads; PO/BOM unsupported-format rejection before upload; aggregate/TOV/financial/issues tables and arithmetic; EPD/emission totals; Bulk Upload Status filenames and outcomes.
- A source-contract executor for additional independent report/document/notification rules. It validates account, source provenance, as-of date, project scope, approved formula, API output and UI value. Missing contracts are **Blocked**, not passed. This infrastructure does not establish complete business coverage by itself.

## Execution

From `SCP`, use existing `.env` credentials:

```powershell
$env:HEADLESS = 'true'
# Optional approved existing allocation, not the example with placeholder paths:
$env:SCP_READONLY_DATA = 'path/to/qualified-allocation.json'
$env:SCP_INVENTORY_DATA = 'path/to/existing-inventory-allocation.json'
$env:SCP_PENDING_RUN_DIR = 'reports/scp-pending-UNIQUE-NAME'
node node_modules/@playwright/test/cli.js test --config=playwright.pending.config.js
```

The dedicated config never selects old mutable regression/Cucumber suites. Retries are zero. Results, HTML, screenshots and traces use a separate run directory. `coverage.json` distinguishes Passed/Failed/Skipped/Blocked; Blocked remains a native non-passing result. The tests do not skip known application failures.

`readonlyTest` blocks mutations. The only allowlisted POSTs are the deployed read-only Status Report query endpoints; no upload/parse/approve/mark-read/stock/configuration writes are allowed. It captures evidence from `scpProject.page`, not the unrelated default Playwright page. Existing Inventory mutations are not run by this configuration.

## Independent fixture schemas

An Enterprise `sourceFile` contains `accountRef`, `provenance`, `asOf`, `projects`, `submittals`, `components`, and `deliveries`. Each project has `ref` and `organizationRef`; submittals have `id/status`; components have `id/submittalId/projectId/quantity/receivedQuantity/expectedDate/leadTimeConfirmed/confirmedWeeks/defaultWeeks`; deliveries have `id/componentId/projectId/category/actualDate/componentExpectedDate/requiredOnSite/poDate`. Client/platform/industry checks additionally need a versioned authorised `benchmarkReference`. Do not obtain denied projects' raw records.

Dashboard archive source contains `accountRef`, `asOf`, and raw `records` including archived IDs, each with `id/type/projectId/triggeredAt/readBy`. A visible list already stripped of archived records cannot prove correct archival. Existing current credentials cannot prove another user's isolation without another account/source allocation.

`businessSources.<moduleKey>` declares `sourceFile`, read-only `endpoint`, `route`, optional `params`, and nonempty `rules`. Source data contains `accountRef`, `projectRefs`, `asOf`, `provenance` and the named raw arrays. Rules specify `recordsPath`, `operation` (count/distinct/sum/mean/min/max), optional `field/decimals`, `actualPath` and exact `uiLabel`. Expected totals are calculated, not stored as invented business counts. A qualified domain-specific formula should be used instead where the rules are more complex; this generic executor does not substitute for missing product requirements.

## Explicit limits and application blockers

- The Inventory activity calendar failure remains in its original suite; fixing the deployed SCP application is outside this automation repository.
- Enterprise zero values hidden as dashes, Inbox missing component summary and 100-record cap remain strict failures where applicable. Correction to the earlier analysis: Pending With exists as an All/Supplier/Sub-contractor button group; the test now validates its filtering rather than expecting a dropdown.
- Dashboard task rendering/count and ageing date scope, and missing required Alert charts remain application checks. Do not replace them with visibility assertions.
- A full reload resets the selected site to the application's default in the observed staging environment. The separate refresh-capability case stops as Blocked before persisted-value comparisons when context is lost. Client navigation/site-invariance and exact Inbox-to-Procurement component drill-down/Search are separate cases.
- Dashboard list HTTP 201 with `status_code: 201` and the exact message `No data found.` is the observed empty-list contract. It maps to an empty array; all unexpected response schemas still fail, and independent Read/Unread/All identity assertions are retained.
- No extra account, fresh project, old read/unread seeded events, independent platform/industry baseline, emission-factor story, PO/BOM positive files, or report classification rules were supplied by “use existing credentials”. Those prerequisites remain Blocked.
- Current Submittal Manager reports that it is repurposed. Its replacement lives in excluded integration groups; the old tracker item cannot be completed by testing those excluded workflows.
- Existing FDI/User Management/Supplier/Project Management mutable workflows are preserved. Their broader role/notification/negative cases still need dedicated records and confirmed acceptance rules; adding a generic navigation test would not close them.

See run-specific evidence and the generated coverage matrix for current execution results. No module is declared complete from a previous green test or tracker Done label.
