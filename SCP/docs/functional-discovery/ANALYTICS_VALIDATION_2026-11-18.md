# SCP Analytics – UI, business logic and data validation (staging, 18 Nov 2026)

Environment: staging `stg-supplychain-app.voyagecontrol.com` · project **NRVC_Hall** (`PRJSUPCHAPLA0000000095`) · venue **Warehoust _NR** · signed-in user is a global admin (SSO) · built-in browser (MCP) with network inspection.
Method: UI text → API response (same request, read with the page's own session) → source records (raw audit log / source module APIs). Read-only; nothing was created or changed.
Application source code is not in this repository, so calculation logic is inferred from API responses and on-page descriptions.

## Header filters
- Project selector (header) and **Venue** selector (header) = the location filter. Selection is stored per user (`/api/user_preferences/me/`).

## A. Aggregate Stats (`/aggregate-stats`)

| Element | Value (10/18–11/18/2026) | API | Logic (observed) |
|---|---|---|---|
| Submittals / Materials / Suppliers / Locations | 187 / 675 / 142 / 96 | `GET /api/project_master/get_project_aggregation/?from_date&to_date&project_id` | Records **created** in the date range (17–18 Nov → 41/22/4/10; 2020 range → all 0) |
| Lead-time changes | 22 | `GET /api/schedule-audit-logs/lead_time_aggregate/?project_id&from_date&to_date` | Audit entries whose `changed_fields` contain `lead_time_in_weeks` |
| Schedules affected | 21 | same | Distinct `schedule_id` of those entries |
| Distinct editors | 2 | same | Distinct `user` |
| Changes per week | W45 10, W46 8, W47 4 | same (`weekly`) | ISO week of `timestamp`; only weeks with changes are listed |
| Most-changed schedules | top 5 (PLS2611021534-SUB-N 2×, others 1×) | same (`top_schedules`) | Count per schedule, desc |
| Top editors | hariharan.r 16×, system 6× | same (`top_changers`) | Count per user **e-mail / "system"** (not user id) |
| Project table + Export | 1 row (project **ID** shown, not name) | aggregation API | — |

Source cross-check (raw `GET /api/schedule-audit-logs/?project_id=…`, filtered to 18 Oct–18 Nov, `lead_time_in_weeks` changed): **22 changes, 21 schedules, 16 + 6 by user, one schedule twice, no zero-value changes → UI = API = source. PASS.**

Findings:
- **ANA-F01 (location):** changing the Venue sends no new request and the APIs take no site parameter → Aggregate Stats is project-level only. FAIL against the project + location rule (confirm whether location filtering is required here).
- **ANA-F02 (data segregation, API):** `GET /api/schedule-audit-logs/?project_id=<any>` ignores `project_id` – it returned the same 15,323 records (all projects, since Apr 2025, incl. other organisations' users) for NRVC_Hall and Apple-India. Not used by the Analytics UI, but exposes other projects' audit history.
- **ANA-F03 (UI):** Project table shows the project ID (`PRJSUPCHAPLA0000000095`) instead of the project name.

## B. Lead Time Analysis (`/lead-time-analysis`)

API: `GET /api/enterprise/lead-time-benchmarks/?project_id` (same as Enterprise › Lead Time Benchmarks; no site or date parameter).
On-page definition: lead time = (Actual Delivery Date − PO Date) ÷ 7 weeks; "Your" = every project you can access combined; "Client" = projects sharing your client (5); "Platform" = anonymised all organisations; "Industry" = industry master table.

| Element | UI | API | Check |
|---|---|---|---|
| Total delivered / On time / On-time count / Late / Avg delay | 195 / 82% / 160 / 35 / 14.1 days | same | 160 + 35 = 195; 160/195 = 82.05% → consistent |
| Category table | 44 rows | 44 `comparisons` | see findings |

Findings:
- **ANA-F04:** Your Avg / Client Avg show "—" when the API value is **0** (14 categories, e.g. material_2 n=42, Tiles n=6, Cement n=2); Platform Avg shows the same 0 correctly.
- **ANA-F05:** Status shows "On par" for 18 categories whose API `status` is null (no data at all).
- **ANA-F06:** Your = Client = Platform in all 26 categories with data (platform_project_count 1–2) → every status "On par"; the comparison cannot show a difference on staging. Confirm whether Platform is meant to include other organisations.
- **ANA-F07:** "Client (n)" is always 5 (= client.total_projects) although the description says n = number of contributing projects.
- **ANA-F08:** Negative lead time included (Tiles platform range −1.7 to 1.7 wks) → deliveries dated before the PO are not excluded.
- **ANA-F09 (scope):** No project, venue or date filter – by design ("every project you have access to"); conflicts with the project + location rule → needs product decision.

## C. Supply Chain Intelligence (`/supply-chain-intelligence`)

APIs on load: `GET /api/salesflow/supply_chain/?project_id&range=30d` (13 categories, 351 disruptions, lastCollected), `/trends/`, `/compliance/`, `/shipping/`, `/actuals/` (0 actuals), `/notes/`; plus `GET /api/submittal_schedule/list_submittal_schedule_by_project_id/?project_id` → **500 Server Error**.
Data is global market intelligence (org `voyagecontrol`), not project data: another project returns the same 351 disruptions. Filters: range 7d/30d/90d, region list (Global … Africa).

| Element | UI | API / source | Check |
|---|---|---|---|
| Last collected | 15d ago | lastCollected 2026-11-02 19:32 UTC | consistent; collection is 15 days old |
| Categories tracked | "13 categories tracked"; subtitle "8 key categories"; heatmap 12 columns; 10 category cards | 13 categories (incl. `compliance` with all values null) | inconsistent labels/counts |
| With alerts | 11 | 11 categories have ≥1 disruption | PASS |
| Active disruptions | 351 (header), "Active disruptions (200)" panel, "All active disruptions (351)" | 351 unresolved | panel capped at 200 |
| Heatmap "Active alerts" per category | Cement 50, Copper 58, Steel 70 … | = disruptions per `affected_categories` | PASS (heatmap = API) |
| Category card "N alerts" | Cement 1, Copper 6, Steel 4 … | not equal to disruptions; source not identifiable from the APIs | inconsistent with heatmap |
| Cement disruption | heatmap "None", card "low" | disruption_level "low" | heatmap wrong |
| Range 7d/30d/90d | — | only `history` changes; disruption list is always 351 (246 detected > 30 days ago) | range not applied to disruptions |

Findings:
- **ANA-F10:** `list_submittal_schedule_by_project_id` returns HTTP 500 on page load (NRVC_Hall).
- **ANA-F11:** Category counts disagree (8 / 13 / 12 / 10).
- **ANA-F12:** Per-category alert counts differ between heatmap (50/58/70…) and cards (1/6/4…).
- **ANA-F13:** Heatmap shows Cement disruption "None" while API and card say "low".
- **ANA-F14:** Time range does not filter the disruptions list (351 for 7d, 30d and 90d).
- **ANA-F15 (scope):** Not filtered by project or venue (global data) – by design?; data last collected 15 days ago.

## D. SubContractor Issues (`/subcontractor-issues`) – incl. export investigation

API: `GET /api/project_master/get_supplier_issues/?from_date&to_date&project_id` (no site parameter). Columns: Subcontractor, Project Name, Delays in Raising PO, Delays in Confirming PO, PO Schedule Impact, Delays in Booking, Delivery Impacted, Over-Deliveries.

| Check | Result |
|---|---|
| Records shown | 158 rows from **93 projects** (incl. V3/V4 platform projects, e.g. "Burj Khalifa") although `project_id=…095` is sent |
| NRVC_Hall rows | 41 subcontractors, every one with identical 1 / 1 / 13 / 0 / 14 / 0 (project totals repeated per subcontractor) |
| Columns | 6 metric headers, 5 values per row – **Over-Deliveries never rendered** |
| Project Name | shows project ID; API returns `project_name` |
| Export | menu has only "Download Template"; its `onClick` is `()=>{}` → no API call, no file, no console error (evidence: `reports/analytics-validation-20261118/subcontractor-export-evidence.txt`, screenshots) |

Root cause of the export issue: **frontend – the menu item is wired to an empty handler and no export endpoint is integrated.** Not a backend failure, permissions or filter problem.

Findings: **ANA-F16** export no-op (SCP-DEF-014 confirmed, root cause added) · **ANA-F17** other projects' data returned (data segregation) · **ANA-F18** per-subcontractor values = project totals · **ANA-F19** Over-Deliveries column empty · **ANA-F20** project ID shown as Project Name.

## E. Supplier Issues (`/supplier-issues`) – also opened by TOV Analytics

APIs: `get_supplier_issues`, `submittal_status/by_supplier_issue`, `submittal_schedule/delivery_impact_stats`, `submittal_status/issue_heatmap`, `project_master/top_five_projects` (all `from_date,to_date,project_id`; no site).

| KPI | UI | Derivation | Correct project value |
|---|---|---|---|
| Raising PO delays | 41 | 1 × 41 duplicated subcontractor rows | 1 |
| Confirming PO delays | 41 | 1 × 41 | 1 |
| Schedule impact | 533 | 13 × 41 | 13 |
| Deliveries impacted | 574 | 14 × 41 | 14 |
| Top 5 projects – NRVC_Hall total | 29 | 1+1+13+0+14 | 29 |

Findings: **ANA-F21** KPI cards inflated 41× (sum of duplicated rows) and contradict Top 5 (29) · **ANA-F22** Delivery Performance "No delivery data" (0/0) while KPI says 574 impacted · **ANA-F23** supplier heatmap/summary all 0 although the project has issues (no supplier attribution) · **ANA-F24** Top 5 lists other platforms' projects · **ANA-F25** Export = same no-op "Download Template" (`()=>{}`).

## F. Export behaviour across Analytics

| Page | Control | Behaviour | Result |
|---|---|---|---|
| Aggregate Stats | Export › Download Template | downloads static `/assets/files/download_template.xlsx` (not the data) | FAIL |
| SubContractor Issues | Export › Download Template | `()=>{}` – nothing | FAIL |
| Supplier Issues | Export › Download Template | `()=>{}` – nothing | FAIL |
| Emissions Report | Export CSV | `GET /api/emissions/export-csv/?project_id` → `Emissions_Report_20261118.csv` | file OK, but header only: the 37 listed shipments have 0 legs and the export is per leg (FAIL vs "file has the shown rows") |

## G. Product decisions (user, 18 Nov 2026) and reclassification

1. **SubContractor Issues and Supplier Issues are cumulative across all projects available to the user** – not project- or location-based.
   - ANA-SUB-01 and ANA-SUP-04 → PASS; ANA-DEF-17 and ANA-DEF-24 → *Closed – by design*.
   - Note: for this global-admin account the list includes V3/V4 platform projects (93 projects); confirm that is the intended "available" set.
   - Still defects: ANA-DEF-18 (NRVC_Hall – the only project with values – repeats 1/1/13/0/14/0 on all 41 subcontractors), ANA-DEF-21 (KPI cards 41/41/533/574 = sum of those duplicates; the true cumulative totals are 1/1/13/14), ANA-DEF-19, -20, -22, -23, -25 and SCP-DEF-014.
2. **Lead Time Analysis and Supply Chain Intelligence must follow the selected project and venue.**
   - ANA-LTA-07 and ANA-SCI-08 BLOCKED → FAIL; ANA-DEF-09 (High) and ANA-DEF-15 (Medium) are confirmed defects.

Updated totals: 53 scenarios · executed 50 · PASS 22 · FAIL 28 · BLOCKED 2 (ANA-LTA-04, ANA-SUB-06) · NOT EXECUTED 1 · open defects 29.

## H. Lead Time "Your" vs "Platform" – both possibilities checked (18 Nov 2026)

Source recalculation: for every submittal of 8 SCP projects (the user's 6 + other organisations' …087 and …088) → components (`submittal_schedule/list_submittal_schedules/?submittal_id`, PO date) → delivery lines (`schedule_delivery/list_schedule_delivery/?submittal_schedule_id`, actual date). Lead time = (actual delivery − PO date) ÷ 7, grouped by submittal material category. 279 delivery lines, 169 usable (22 without actual date, 58 without PO date; returns excluded).

| Hypothesis | Platform avg | Your avg |
|---|---|---|
| A – all organisations | **26/26 categories and 26/26 ranges match** | 26/26 averages match (TV sample 32 vs 47 lines) |
| B – user's 6 accessible projects only | — | 21/26 match; Floorings, Scaffolding, Thermal Insulation, Tiles exist only in other organisations' projects |

Answer: **Platform should include all organisations – and it does (matches the page definition).** Platform equals Your because **Your is also computed over all organisations** (ANA-DEF-32, High). With the confirmed rule that Lead Time Analysis follows the selected project + venue, Your must be NRVC_Hall / Warehoust _NR only; Platform keeps its all-organisations scope. ANA-LTA-04 → PASS, ANA-LTA-08 executed → FAIL, ANA-DEF-06 closed (root cause ANA-DEF-32).

## I. Proposed cases executed
The 12 proposed cases of the master workbook (PROP-LTA/SI/AS/SCI/ER/IR) were executed through MCP via the linked validation cases (table in the Analytics Coverage sheet). Final: 53 cases · executed 52 · PASS 23 · FAIL 29 · BLOCKED 1 (ANA-SUB-06: no export file) · open defects 29 (registration file: `reports/analytics-validation-20261118/ANALYTICS_DEFECTS_FOR_REGISTRATION_20261118.csv`).

## J. Aggregate Stats scope (user, 18 Nov 2026)
Aggregate Stats shows **cumulative values and is not location-based**. ANA-AGG-09 → PASS; ANA-DEF-01 → *Closed – by design*. Observed today: the values follow the selected project and date range (one project row).
Final: 53 cases · executed 52 · PASS 24 · FAIL 28 · BLOCKED 1 · open defects 28.

## K. User triage (18 Nov 2026)
- Not issues → *Closed – not an issue*: ANA-DEF-04 (zero shown as "—"), ANA-DEF-05 ("On par" without data), ANA-DEF-07 (value is average weeks per the header), ANA-DEF-09 (Lead Time Analysis shows cumulative values), ANA-DEF-30 (Status Report header). Cases ANA-LTA-02/03/05/07 and ANA-STR-01 → PASS.
- Lead Time Analysis is **cumulative** (replaces the earlier "must follow project + venue" for this page; Supply Chain Intelligence keeps that rule).
- ANA-DEF-32 stays open, reworded: cumulative "Your" should cover the user's accessible projects, but it includes other organisations' projects (…087/…088), which is why Your = Platform.
Final: 53 cases · executed 52 · PASS 29 · FAIL 23 · BLOCKED 1 · open defects 23 (6 High, 12 Medium, 5 Low).
