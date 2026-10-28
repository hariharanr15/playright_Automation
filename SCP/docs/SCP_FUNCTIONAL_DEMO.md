# SCP read-only functional rehearsal

Latest [automation runner verification and browser results](../reports/automation-flow-20261026-summary/README.md): 30 distinct browser scenarios, with the final headless Inventory and interrupted-pagination rechecks applied. Older reports below remain preserved.

The dedicated demo profile reuses the reviewed runner, existing Page Objects, authentication and reporters. It includes both supported workflows and known defects. It does not turn incomplete features into passes or run stock mutations.

```powershell
$env:SCP_INVENTORY_DATA = 'reports/inventory-discovery/environment.json'
$env:SCP_PROCUREMENT_DATA = 'reports/application-expansion-20261025/procurement-allocation.json'
npm run test:application:reviewed:demo:plan
npm run test:application:reviewed:demo
```

For a focused rerun, append one or more `--stage=NAME` flags. Use `--headless`
when a visible browser is unnecessary. Omit `--execute` to check registration
without opening the application. The runner loads `.env` before launching stages;
explicit shell environment values take precedence.

```powershell
# Verify only the qualified Procurement read-only flow.
node scripts/run-scp-reviewed-application.js --execute --headless --stage=procurement
# Rehearse Inventory and Procurement with visible Chrome.
node scripts/run-scp-reviewed-application.js --demo --execute --stage=inventory --stage=procurement
```

Stage names: `inventory`, `inventory-calendar`, `procurement`, `enterprise`,
`dashboard`, `documents`, `analytics`, `independent-source-contracts`,
`project-management`, `other-reviewed-smoke`. Demo mode supports Inventory,
Inventory Calendar, Procurement, Enterprise, Dashboard and Analytics only.
Unknown stage names fail before any browser scenarios are dispatched. Each run
records its selected stages and browser mode in `manifest.json`.

The profile contains **30 browser scenarios**, with no arithmetic/record-contract tests included in that number. Registration is not execution evidence. Each execution produces a separate `reports/application-reviewed-*` folder with a manifest, native module HTML/JSON, screenshots, traces and console output. Failure in one module does not prevent the next module from executing. The process exits nonzero for failures or Blocked checks.

Latest [verified functional rehearsal and remaining gates](../reports/functional-demo-fix-20261026-summary/README.md): **12 Passed, 11 Failed, 7 Blocked**, with the project-search recheck applied to the latest distinct results. The report preserves the original failed attempt.

| Order | Module | Demonstrated flow and validations |
|---|---|---|
| 1 | Inventory | Confirm project/site; search the allocated material; verify identity, UOM and source balance; no-match and clear; Location/Submittals/UOM detail views; required-field validation without submitting stock changes |
| 2 | Activity Calendar | Check dynamic defaults; verify source activities; change date bounds and verify refreshed records (the screen has no Reset button) |
| 3 | Procurement | Search the exact dedicated submittal; verify its project/site/material relationship; no-match and restore; inspect the exact saved component, quantity/UOM and required-on-site date |
| 4 | Enterprise View | Apply dynamic historical bounds; collect project-value mismatches and continue to CSV scope/content checks; any mismatch still fails the scenario |
| 5 | Dashboard | Search dated Alerts/Notifications/Tasks; expand Task Chart; apply fixed October 1, 2025 through dynamically calculated today; independently reconcile totals and known statuses |
| 6 | Subcontractor Issues | Preserve all issue occurrences, including repeated names; supported selected-project Search and clear; name-search requirement; all seven associated fields; grouped sorting; pagination/export where supported |

The current Subcontractor client searches **project IDs**, not subcontractor names. The new supported project-search case is separate from the unchanged name-search requirement, which remains a defect check. Its shared AnalyticsTable sorts records **within each exact subcontractor-name group**, preserving group order; the corrected Project Name assertion tests this contract. All-equal values within groups are insufficient to prove both sort directions and remain Blocked.

The deployed Subcontractor Export menu uses `onClick:()=>{}` for Download Template, and its grouped row renderer omits Over-Deliveries. These application implementations cannot be repaired by changing assertions. Client inspection evidence is retained in `reports/issue-client-diagnostic-20261026-a2`; the diagnostic is excluded from this demo and the reviewed application allowlist.

The strict Inventory smoke pre-authentication error guard remains enabled. A successful business step followed by a shared SSO error is still a failed case. Native reports retain both the executed steps and the error; this profile makes no blanket green or complete-coverage claim.

Construction Delivery, red tracker functionality, Enterprise Shipment and completed FDI SUB-2026-525 remain excluded. `--demo` cannot be combined with Inventory mutation mode. All executed business operations are read-only.
