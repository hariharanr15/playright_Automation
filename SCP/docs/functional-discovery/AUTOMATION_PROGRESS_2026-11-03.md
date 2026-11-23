# SCP Automation – Progress Record (as of 2026-11-03)

Staging only, project **NRVC_Hall**, signed in as Project Admin. Test cases were designed from Playwright MCP exploration of the live app. They are automated as Playwright specs in `tests/pm-flow/`, following the same procedure as Project Management: run-tagged records, a known-defect regex in `config/scp-known-defects.js`, and an HTML report per run in `reports/pm-flow/`.

Per-scenario latest status (all suites): [AUTOMATION_RESULTS_2026-11-03.csv](AUTOMATION_RESULTS_2026-11-03.csv)

## 1. How to run

| Command | Spec | Scope |
|---|---|---|
| `npm run pm:smoke` / `pm:regression` | PM flow specs | Project Management |
| `npm run procurement:smoke` | pl-smoke.spec.js | Procurement Log smoke (18) |
| `npm run procurement:regression` / `2` / `3` | pl-regression*.spec.js | Procurement Log regression, parts 1–3 |
| `npm run modules:smoke` | app-smoke.spec.js | All other modules, smoke (40) |
| `npm run modules:regression` | app-regression.spec.js | UM, Supplier List, FDI, Documents, Shipments, Dashboard, Enterprise, Analytics |
| `npm run inventory:regression` | inv-regression.spec.js | Inventory regression (26) |

To re-run selected cases, add `-- --only=ID1,ID2`. A dependent scenario needs its parent in the same list, e.g. SHP-REG-02 before SHP-REG-03…10.

## 2. Coverage

### Smoke: 78 cases, 76 passed
| Area | Cases | Passed | Notes |
|---|---|---|---|
| Project Management | 20 | 19 | 1 skipped (TheLink) |
| Procurement Log | 18 | 18 | |
| Other modules | 40 | 39 | INV-SMK-08 = app issue OBS-INV-6 |

### Regression: 497 cases
| Area | Cases | Passed | Failed | Known defect / blocked | Skipped |
|---|---|---|---|---|---|
| Project Management (2 parts) | 283 | 198 | 1 | 14 | 70 |
| Procurement Log (3 parts) | 102 | 89 | 7 | 5 | 1 |
| Inventory | 25 | 13 | 8 | 0 | 4 |
| Other modules | 87 | 45 | 23 | 1 | 18 |
| **Total** | **497** | **345** | **39** | **20** | **93** |

End-to-end flows: demo flow 37/37 passed, Procurement pilot 8/8 passed.

Skipped cases fall into three groups:
- The case needs an outside system: mailbox, Procore, TheLink, or the next-day alert batch.
- The case is unsafe or not approved: Promote to SSO, Scan Procore, the Inventory date picker (SCP-DEF-002), or role changes on the shared project.
- The case is covered by another suite or is waiting for data (FDI-06…10).

### Page coverage
Every menu page has smoke coverage. These pages are **smoke only**, with no regression tests yet:
- Enterprise: Supplier Performance, Lead Time Benchmarks.
- Document Management: BOM Validation.
- Analytics: Supplier Issues, Aggregate Stats, Lead Time Analysis, Supply Chain Intelligence, Emissions Report, Inventory Reports.

A set of 18 regression cases is proposed for these pages (see §6). It would raise the regression total to 515 and the overall total to 593.

Not covered at all:
- Supplier, Subcontractor and view-only roles (needs approval).
- The Super Admin / Org Admin roles app.
- TheLink and Procore.
- Two-day alert batch checks.
- Sub-Contractors PDF upload.

## 3. Open deviations (not yet registered as known defects)

Confidence: **C** = confirmed by repeated runs. **V** = needs a manual check, because the test itself could be at fault.

| # | Test | Deviation | Conf. |
|---|---|---|---|
| 1 | PL-REG-LST-09 | Advanced Filter "Total Count ≥ 7" returns no rows (PLT2611021802-SUB-P has 7) | C |
| 2 | PL-REG-CMP-09 | Update Status to "Ordered At Risk" leaves Ordered | C |
| 3 | PL-REG-CMP-19 | Amounts in $ although the project currency is INR | C |
| 4 | PL-REG-DLV-19 | Remaining quantity wrong (12 ordered − 4 logged) | C |
| 5 | PL-REG-DLV-18 | Files tab replaces the delivery table | C |
| 6 | PL-REG-EDT-07 | Edited Required Date not reflected | C |
| 7 | PL-REG-ALR-02 | Alert rule form has no validation | V |
| 8 | PM-REG-SYS-12 | System Message warning banner not shown | V |
| 9 | INV-SMK-08 | Receive booking: "Invalid project_id, not found in ProjectMap" (OBS-INV-6) | C |
| 10 | INV-REG-15 | Grid stock stale after an activity until reload (OBS-INV-4) | C |
| 11 | INV-REG-09 | 3-decimal QTY gives only "Invalid data provided." (OBS-INV-10) | C |
| 12 | INV-REG-20 | Ledger "Submittal" column shows the Spec Section No (OBS-INV-1) | C |
| 13 | INV-REG-22 | Export is the activity log, not the balance list (OBS-INV-8) | C |
| 14 | INV-REG-23 | Header site reverts to Site T2 after reload or navigation (OBS-INV-12) | C |
| 15 | INV-REG-19 | Upload rejects PLD1102-SUB-01 ("matches more than one record"); the form accepts it (OBS-INV-13) | C |
| 16 | INV-REG-18 | Upload says 8 available, ledger shows 5 (INV-R3) | V |
| 17 | UM-REG-03 | Duplicate invite (other case) accepted, role overwritten (OBS-UM-1) | C |
| 18 | UM-REG-07 | Project Role change not kept after reload (OBS-UM-2) | C |
| 19 | UM-REG-08 | Removed user still listed (OBS-UM-3) | C |
| 20 | UM-REG-11 | Filter tabs offer no values (OBS-UM-4) | C |
| 21 | SL-REG-05 | Saving as subcontractor: no message, no record (blocks SL-09/13) | V |
| 22 | DOC-REG-04 | PO File "Uploaded By" = Unknown (OBS-DOC-1/2) | C |
| 23 | DOC-REG-13 | EPD Exists shows No after an EPD upload (OBS-DOC-3) | C |
| 24 | DOC-REG-14 | Non-EPD PDF accepted as Completed (OBS-DOC-5) | C |
| 25 | DOC-REG-15 | QR label / checklist files listed as EPD documents (OBS-DOC-4) | C |
| 26 | SHP-REG-03 | New shipment starts at Pending Order though already delivering (OBS-SHP-1) | C |
| 27 | SHP-REG-06 | Status change gives no confirmation (OBS-SHP-2) | C |
| 28 | SHP-REG-08 | Required Date shows "-" (OBS-PL-19) | C |
| 29 | SHP-REG-09 | Open goes to the shipments list, not the shipment (OBS-SHP-3) | C |
| 30 | DSH-REG-05 | No "Lead time changed" notification (may need the daily batch) | V |
| 31 | DSH-REG-07 | No "Create PO" task (may need the daily batch) | V |
| 32 | DSH-REG-09 | Trigger Alert does not reach the user's notifications (OBS-DSH-1) | C |
| 33 | ENT-REG-03 | Download CSV 142 rows vs Supplier table 61 | V |
| 34 | ENT-REG-02 | Supplier Inbox shows no run items | V |
| 35 | ANA-REG-05 | TOV Analytics menu item does nothing (OBS-ANA-1) | C |

For each item the decision is one of three: register it as a known defect (SCP-DEF-0xx), treat it as expected behaviour and update the test, or fix the test. 20 known defects are already registered (PM and Procurement) and are not listed here.

## 4. Blockers and environment notes
- **Procurement Log is locked by a pending "Bulk Update #38 – reviewing changes"** (not created by these runs). Search and filters stay disabled until someone confirms or rolls it back. It blocks INV-REG-04/05, which passed before, and any Procurement Log test. It has not been touched; this needs an owner decision.
- **FDI-REG-06…10** need an "Auditor Not Yet Assigned" run inspection. Run `npm run procurement:regression3` to create a fresh delivery.
- **The header site does not persist across reloads** (OBS-INV-12). The tests sign in to Warehoust _NR, but after any page load Inventory shows Site T2 Pmr2-2611011614. Test locations "Loc INR…" were created on both sites.
- Never click the Inventory Add Activity date input (SCP-DEF-002: freezes the tab).

## 5. Lessons for the test code
- Row menus open from `img[alt="Menu"]`. Form pickers are `div[role=button]` with options in a `listbox`.
- Supplier form inputs have `name` attributes (supplierName, line1, …). "Is Sub-Contractor" is a switch over a hidden checkbox.
- The Inventory upload dialog text contains "error file", so wait for the "Uploading…" state to end instead of matching that text.
- Shipments: "Pick a project first" is the disabled Submittal placeholder. A shipment needs a container number or a bill of lading.
- Spec Section No is picked from the project's submittals; it is not free text.
- Enterprise View has three tables; the CSV corresponds to the Supplier table.
- With `--only`, a filtered-out scenario returns `undefined`, so dependent checks use `?.status`.
- DOM probing: use a temporary spec that signs in through `k.signIn`, so passwords never appear in chat.

## 6. Next steps
1. Go through §3 one by one: register, accept, or fix each.
2. Resolve Bulk Update #38 (owner decision), then re-run INV-REG-04/05.
3. Run `procurement:regression3`, then FDI-REG-06…10.
4. Write the 18 regression cases for the smoke-only pages:
   - Supplier Performance 2, Lead Time Benchmarks 2, Lead Time Analysis 1.
   - BOM Validation 2, Supplier Issues 3, Aggregate Stats 2.
   - Supply Chain Intelligence 2, Emissions Report 2, Inventory Reports 2.
   - Excluded without approval: Dismiss, Auto-Generate Emissions, Scan Procore.
5. Role-based checks (Supplier / Subcontractor), after approval.
6. Commit the new spec files and docs when asked. **Nothing is committed yet.**

## 7. Files added in this phase (uncommitted)
- `tests/pm-flow/app-smoke.spec.js`, `app-regression.spec.js`, `inv-regression.spec.js`, plus `pl-smoke`, `pl-regression`, `-2` and `-3`, and `support/pl-flow.js` and `support/pl-files.js`.
- `scripts/run-pm-flow.js` and `package.json`: suite entries `app-smoke`, `app-regression`, `inv-regression`.
- Scenario and discovery docs in `docs/functional-discovery/`: UM, DOC, SHP, DSH/ENT/ANA, INV, PL and APP_MAP.
- Reports: `reports/pm-flow/` keeps the latest run per suite. 81 older runs (≈7 GB) were deleted on 2026-11-03.
