# XER Import – Plan Reload and Task Visibility: Requirements vs Observed

| Item | Value |
|---|---|
| Source | Product owner, 2026-10-30: original requirement (plan reload) + "Task Visibility Control (added 22 Mar 2026)" |
| Page | Project Management › Integrations › XER Import (`/xer-import`) |
| Observed on | NRVC_Hall, 30 Oct 2026, plan `SPADE-OYM-1A-2A-BL-1-09-11-2026-1` (15,860 tasks) |
| Related | [PM_FUNCTIONAL_DISCOVERY.md §5.3](PM_FUNCTIONAL_DISCOVERY.md), regression INT-07…INT-25 |
| **Status** | **Reference only – not confirmed (product owner, 30 Oct: "not sure about the XER requirement, need more clarity; go with the existing flow").** Automation tests the current application behavior. Rows marked ❌ below are *differences from this draft requirement*, not defects |

Status legend: ✅ matches · ❌ does not match (defect candidate) · ⚠ partly matches · ⬜ not yet checked.

## 1. Requirements and current status

| # | Requirement | Observed (30 Oct) | Status | Scenario |
|---|---|---|---|---|
| XR-01 | Reloading an XER plan for a project is possible; on reload all **mappings are lost** and must be redone | `Reload` button present in the plan view; not clicked | ⬜ | INT-22 |
| XR-02 | On **first import** (or reload) the **Task Selection screen** appears before the plan view | Not seen: the file matched an existing plan and "Open existing plan" was used | ⬜ | INT-18 |
| XR-03 | Task Selection shows all tasks in a filterable, searchable table with a checkbox per row | 15,860 rows, search + filters, checkbox per row | ✅ | INT-12 |
| XR-04 | Columns: WBS Code, Task ID, Task Name, Planned Start, Planned Finish, Activity Type | `WBS`, `Task ID`, `Task Name`, `Type`, `Planned Start`, `Planned Finish` – same data; labels `WBS`/`Type` and the order differ | ⚠ (labels/order) | INT-19 |
| XR-05 | **All tasks unselected by default** (first import) | "0 of 15860 selected" | ✅ for first import (see XR-10) | INT-18 |
| XR-06 | "Select all matching" bulk-selects the rows matching the current search/filter | Button present: `Select all matching (n)` | ⬜ (not clicked) | INT-12 |
| XR-07 | The user saves the selection; **only selected tasks** are shown in the plan view | After Save the plan showed only the two selected tasks; message "2 tasks set to visible." | ✅ | INT-09 |
| XR-08 | Visibility is stored (`visible` on XerTask) and **survives page refresh** | After a full page reload the same 2 tasks were visible ("2/15860 visible") | ✅ | INT-20 |
| XR-09 | Toolbar has **Manage tasks**, reopening the Task Selection screen at any time | Present; opens "Select tasks to display" | ✅ | INT-09 |
| XR-10 | In Manage tasks the user can **add or remove** tasks from the visible set without reloading | Dialog opens with **nothing ticked** ("0 of 15860 selected") although 2 tasks are visible; saving two new tasks **removed** the two previously visible ones | ❌ differs (DIFF-1) | INT-15, INT-21 |
| XR-11 | Removing a task from the visible set does **not delete its mapping**; making it visible again restores the mapping | Not checked (no mapped tasks: "0 mapped") | ⬜ | INT-23 |
| XR-12 | On reload, task IDs and mappings from the previous import are cleared | Not checked | ⬜ | INT-22 |
| XR-13 | On reload, the Task Selection screen is shown again for the new plan | Not checked | ⬜ | INT-22 |
| XR-14 | Previous visibility selections are not kept across reloads | Not checked | ⬜ | INT-22 |
| XR-15 | A **clear warning** before reload says mappings and visibility selections will be reset | Not checked | ⬜ | INT-24 |
| XR-16 | Filter by **WBS level** | WBS dropdown lists WBS **names** (`All WBS`, `CMDA`, `DH-A - UG Utilities (East)`, …), not levels | ⚠ (to confirm Q-XER-2) | INT-12 |
| XR-17 | Filter by **Activity Type** | Type dropdown: `All types`, `TT_FinMile`, `TT_Task`, `TT_Mile`, `TT_LOE` | ✅ | INT-12 |
| XR-18 | Filter by **date range** (tasks starting/finishing within a range) | **No date-range filter** on the screen (only search, WBS, type) | ❌ differs (DIFF-2) | INT-25 |
| XR-19 | **Text search** by task name or task ID | `Search task name or ID…`; search by Task ID worked | ✅ (ID) / ⬜ (name) | INT-12, INT-14 |

Additional observations not covered by the requirement:
- **Duplicate file detection:** a file whose content matches an existing plan shows "Plan already imported" with `Open existing plan` / `Import anyway` (INT-10, INT-11, INT-17).
- **OBS-12:** clicking the row checkbox does not select a task; clicking the row does (INT-16).
- Selection survives changing the search text (INT-14).

## 2. Differences from the draft requirement (not defects until the requirement is confirmed)

| ID | Summary | Evidence |
|---|---|---|
| DIFF-1 (was DEF-C3) | Manage tasks does not show the currently visible tasks as ticked, and Save replaces the visible set instead of adding/removing (XR-10) | 30 Oct: CMDA1-MS-110 and CMDA2-MS-120 were visible; Manage tasks showed 0 selected; after selecting DC1-CS-BUE-1170/1180 and saving, only the two new tasks were visible. Re-checked after refresh: still 0 ticked while 2 visible |
| DIFF-2 (was DEF-C4) | No date-range filter on the Task Selection screen (XR-18) | 30 Oct: controls are search, WBS, type only |
| (OBS-12) | Checkbox click doesn't toggle selection; row click does | 30 Oct |

## 3. Open questions

| # | Question |
|---|---|
| Q-XER-2 | "Filter by WBS level": is the current WBS-name dropdown acceptable, or is a level filter (e.g. level 1/2/3) required? |
| Q-XER-3 | Reload scenarios (INT-22, INT-24) clear all mappings and visibility of the plan. May automation reload the NRVC_Hall plan, or should it use its own plan (e.g. created by "Import anyway" or a separate test XER file)? |
| Q-XER-4 | First-import scenario (INT-18) needs a file that is not already imported. Is there a second test XER file, or may automation use "Import anyway"? |
| Q-XER-5 | ~~Register as known defects?~~ No: the requirement is unclear; the current flow is the expected behavior for now. |
