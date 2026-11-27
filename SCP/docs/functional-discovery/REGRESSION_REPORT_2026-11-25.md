# SCP regression test report – 25 Nov 2026

_Staging · project NRVC_Hall · site Warehoust _NR · redesigned build of 24 Nov 2026 · headless, one suite at a time_
_Main run 10:50–14:37 (smoke first, then the full P1 regression); fixed cases re-run 14:50–16:09. Raw results: `reports/pm-flow/<suite>-2026-11-25T…/results.json`._

## 1. Summary

| | Cases | Passed | Known Defect | Failed | Blocked | Skipped |
|---|---|---|---|---|---|---|
| Main run (before fixes) | 700 | 504 | 34 | 26 | 11 | 125 |
| **After fixes and re-runs** | **700** | **515** | **33** | **16** | **8** | **128** |
| Night run of 24 Nov (for comparison, regression only) | 437 | 257 | 21 | 55 | – | 104 |

**Reading:** 548 of 572 cases that ran (96 %) pass or reproduce a registered Known Defect. The 16 failures are made up of:
- 3 new application-defect candidates;
- 9 First Delivery Inspection form cases that need a rewrite for the new FDI page;
- 4 cases still under investigation.

Every skipped case has a recorded reason.

## 2. Results by suite (after re-runs)

| Priority | Suite | Cases | Passed | KD | Failed | Blocked | Skipped |
|---|---|---|---|---|---|---|---|
| Smoke | Procurement Log smoke | 18 | 18 | 0 | 0 | 0 | 0 |
| Smoke | Project Management smoke | 20 | 19 | 0 | 0 | 0 | 1 |
| Smoke | Other modules smoke | 40 | 31 | 0 | 0 | 0 | 9 |
| Smoke | E2E smoke (invite → delivery → inspection) | 33 | 21 | 0 | 3 | 8 | 1 |
| P1 | Procurement Log regression parts 1–3 | 107 | 98 | 8 | 0 | 0 | 1 |
| P1 | Project Management regression parts 1–2 | 282 | 201 | 13 | 1 | 0 | 67 |
| P1 | PM decisions / fresh project | 8 | 6 | 1 | 0 | 0 | 1 |
| P1 | FDI settings | 16 | 2 | 0 | 9 | 0 | 5 |
| P1 / P2 | Other modules regression (UM, Supplier List, FDI, Dashboard, Documents, Shipments, Enterprise, Analytics) | 88 | 53 | 8 | 1 | 0 | 26 |
| P1 | Roles (read-only) | 26 | 16 | 0 | 2 | 0 | 8 |
| P1 | BUGS ticket cases | 62 | 51 | 3 | 0 | 0 | 8 |
| | **Total** | **700** | **515** | **33** | **16** | **8** | **128** |

_PM regression part 1: CFG-01 passed in the re-run. The other-modules suite: FDI-REG-04 passed and ENT-REG-02 was skipped in the re-run. The Procurement Log suites: PL-REG-ALR-01 passed in the re-run and PL-REG-INT-03 is now skipped (Inventory)._

## 3. Fixed today (test adapted to the new build)

| Area | Cases | Change in the app → change in the test |
|---|---|---|
| Procurement Log smoke | PL-SMK-002, 008, 011–014 | "Assign Responsible" is now "Bulk assign Responsible" and opens its own page (/procurement-log/bulk-responsible). The newest submittal had no components, so the smoke now opens the first submittal that has components. |
| Header site | DOC-SMK-01 and all other-modules pages | After a page load the app selects the newest run site in the header (known OBS-INV-12), so All Documents showed 0 rows. The run site is now selected again after every page load. |
| International Shipments | SHP-SMK-01 | Column names now carry sort arrows. The arrows are ignored when matching names. |
| First Delivery Inspections | FDI-REG-04 | The list fills in two steps. The row count is now taken only after three equal reads. |
| Configuration Options | PM-REG-CFG-01 | The -1 week value (saved through Known Defect CFG-06) is now restored to 1 at the end of part 2. Passes. |
| Earlier today | 28 cases | Sites & Storage cards and inline Add Location, navigation groups, Material Category, SubContractor Issues and others – see `TRIAGE_2026-11-25.md` |

## 4. Remaining failures (16)

| Case(s) | Module | Priority | Cause | Next step |
|---|---|---|---|---|
| PM-REG-SITE-10 | Sites & Storage | P1 | **Defect candidate:** the same location name is accepted twice in one site (it was refused on 20 Nov). | Confirm with the client |
| PM-REG-ROLE-05, ROLE-08 | Roles | P1 | **Defect candidate:** the Subcontractor menu shows Project Management and Enterprise although the role does not enable them (client question 7). | Confirm with the client |
| PM-REG-FDI-05a/b/c/g/h/i/j/l/n | FDI settings | P1 | The new FDI list has no "Fill Inspection Report" row action, and there is no free run inspection to use. The form-opening steps must be rewritten for the new page. | Test rework – Thu 26 Nov |
| DSH-REG-08 | Management Dashboard | P1 | The Pre-Shipping Checklist task triggered by the Procurement Log flow is not found in the Dashboard Tasks tab. It may have moved to My Work. | Investigate – Thu 26 Nov |
| E2E TC-17 | E2E smoke | Smoke | After logging back in as Project Admin, the Procurement Log search for "submittal 2 20261125" returns no rows. | Investigate |
| E2E TC-18 | E2E smoke | Smoke | FDI Config › Add Inspector › Specific Materials: the run material "Material 2 20261125" is not offered ("No material matches that search"). | Investigate (app or test) |
| E2E TC-25 | E2E smoke | Smoke | The final check fails because TC-17 did not generate GRNs. It also records again the known header-location reset. | Follows TC-17 |

**The 8 blocked E2E cases** (TC-17B, 20–24B) depend on TC-17. In the main run, a network drop on the test laptop stopped the E2E at logout, so the whole E2E was re-run. That re-run got further: Supplier and Subcontractor login and approvals passed.

## 5. Known Defects (33) – still reproduce, already registered

- **User Management / Supplier List:**
  - duplicate invite accepted
  - Filter tabs offer no values
  - removed user still listed
  - Promote to SSO does nothing
- **Procurement Log:**
  - Update status (Delivered / Ordered At Risk) not applied
  - Shortage quantity calculated from the component quantity
  - Required Remaining Qty wrong
  - component Delete leaves the row
  - Advanced filter on a custom number field
  - export columns differ from the grid
  - empty Alert gives client-side messages only
- **Project Management:**
  - negative week saved (CFG-06) and Cancel shows 0/0/0
  - duplicate organisations in Invite
  - Bulk Upload records without status (×2)
  - Sites report includes other projects
  - site upload with an existing name adds a location
  - menu highlight missing
  - Common Utilities accepts duplicates
  - Common UoM shared across projects
  - PreShipping "Enabled" not kept
  - System Messages dates not validated
  - XER task cannot be selected
  - Booking ID empty accepted
- **Other modules:**
  - PO File / Pdf "Uploaded By" not an email
  - Enterprise Shipments "Open"
  - Trigger Alert notification missing
  - Analytics Export template only
- **BUGS tickets:**
  - T517-15 lead time confirmation not restored
  - T543-12 categories leak across projects
  - T508-18 material upload offered to Supplier

## 6. Skipped and waiting on a decision

| Cases | Reason | Status |
|---|---|---|
| Inventory: INV-SMK-01, PL-REG-INT-03, Inventory regression (25) | **Client question 2 answered (25 Nov):** the Inventory tab fails on projects with large data such as NRVC_Hall; small projects load. This is an application issue. | User, 25 Nov: on another (smaller) project the Inventory tab works, so run the Inventory cases there. Waiting for the project name and write approval |
| ENT-REG-02, ENT-SMK-02, E2E TC-14B | Supplier Inbox removed (/supplier-inbox opens My Work) | Client question 3 |
| SHP-REG-05/06 | Manual shipment status removed (status comes from ShipsGo) | Client question 9 |
| PM-REG-SITE-07 | Needs a site with deliveries that may be deleted | User decision, 25 Nov |
| 96 planned skips | Carried over from v1.2: covered by another suite, external system, second login or mailbox, two-phase checks | Unchanged |

## 7. New on the build, not yet covered

Seen during today's run; to be added as smoke cases (roadmap phase 5):
- Procurement Log: "Bulk assign Responsible" page, "Select Columns for Bulk Edit", "View Bulk Edit Log", tabs By submittal / By material / Inventory
- FDI page: grouped view by material category, KPI cards (Inspections, Pending, Overdue, Passed, Rejected, Pending review, Pass rate), "Most failed questions", "Highest supplier rejection rates"
- FDI Config › Add Inspector: Materials scope (All / By Material Category / Specific Materials)

## 8. Next steps

1. **Thu 26 Nov:**
   - Rewrite the FDI-settings form steps for the new FDI page.
   - Investigate DSH-REG-08 and E2E TC-17/TC-18.
   - Get a clean E2E run.
2. **Send client questions 1 and 3–9** (question 2 is answered).
3. **Continue the P1 adaptation:**
   - User Management role dropdown
   - Supplier List inline Add Supplier
   - Dashboard tiles
4. **Then P2 and the new-page smoke tests,** per the roadmap to 4 Dec.

_Nothing was committed and nothing was written to Jira._
