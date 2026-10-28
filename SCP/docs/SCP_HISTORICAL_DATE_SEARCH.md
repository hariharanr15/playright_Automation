# Shared historical date search

`utils/historical-date-search.js` owns the search policy. It reuses `calendar-date.js` for timezone-aware current dates and month clamping, and `date-picker.js` for the deployed custom calendar. Native HTML date inputs are also supported by the common input adapter. No form-entry or stock-transaction dates were changed.

For data-dependent scenarios, From is independently calculated from today minus 2, 4, 6, 8, 10 and 12 calendar months. To stays at today plus one calendar month. Calculating every attempt from today avoids cumulative month-end drift. The first validated nonempty source population stops the search. Six confirmed empty populations throw `ScpBlocked` with `No Test Data Available`. API/permission errors, missing arrays, render failures, incorrect filter bounds and business assertion failures stop immediately without fallback.

Each attempt is attached as `date-search-evidence`, with module, submodule, scenario, current date, policy, applied range, record count and outcome. Existing screenshot, trace, HTML and Blocked reporting remain in use. Adapters must validate the request bounds, UI fields, load completion and actual records; headings and controls cannot supply record counts. Pagination must preserve source record identity and multiplicity, including repeated subcontractor names.

The Task Chart uses the explicit `task-chart` policy: **2025-10-01 through dynamically calculated today, one attempt only**. This exception does not change Dashboard list searches or other charts. Tests of application defaults remain separate and do not use fallback.

| Module / page | Integration | Limits |
|---|---|---|
| Inventory Activity Calendar | Existing positive activity validation uses `findExistingActivities`; exact material, project/site, date bounds and complete rendered activity values are checked | The −2/+1 month default check reports SCP-DEF-009 while the application differs; there is no Reset button, so none is tested |
| Management Dashboard Alerts / Notifications / Tasks lists | New source-aware historical scenarios; exact list request, dates, source record dates, selected project and displayed count | These checks do not establish chart/KPI correctness |
| Management Dashboard Task Chart | Expanded chart, fixed start/current end, all chart request bounds, totals and independent known-status counts | Missing ageing bounds and count mismatches remain failures; null-status classification requires a confirmed rule |
| Enterprise View | Dedicated historical adapter checks summary/project request bounds, project table values and CSV scope/content | Does not establish independent enterprise KPI business formulas; existing rendering failures stop fallback |
| Other Enterprise reports | Pending adapter qualification | Confirm actual supported filters, source populations, calculation/date rules and export consistency first |
| Procurement Log | Pending date-filter adapter qualification | Existing transaction/form dates must not be repurposed as search filters |
| FDI / International Shipment | Pending date-filter adapter qualification | Preserve read-only execution; completed SUB-2026-525 remains excluded |
| Analytics including Supplier/Subcontractor Issues | Pending date-filter adapter qualification | Current issue source contains no per-record issue date; do not invent date-filter semantics or use unique-name counts |

Excluded modules remain excluded. No application records are generated to fill empty results. A reusable helper and a successful module adapter are not complete application-wide date coverage.
