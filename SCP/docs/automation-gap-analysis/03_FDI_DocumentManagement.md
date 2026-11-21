# SCP Automation Gap Review: First Delivery Inspection (FDI) and Document Management

Review type: read-only. Nothing under `C:\Users\VC\20-04-2026` was changed, and no tests were run.
Project root: `C:\Users\VC\20-04-2026\SCP` (all paths below are relative to it).
Review date: 21 Nov 2026.

## Evidence rules used in this review

- **Requirement source of truth:** `docs/requirements/requirements-register.json`. Category A means confirmed, B observed, C AI-suggested, D pending a client answer and E blocked.
- **"Passed"** is used only when execution evidence exists:
  - For the pm-flow suites, that is `status.tsv` (aggregated from `reports/pm-flow/*/results.json`), checked against the per-run `results.json` files.
  - For the standalone Playwright specs, I checked `reports/approved-regression-20261025/execution-summary.json`, `reports/scp-pending-summary/*` and `reports/modules/html/SCP_First_Delivery_Inspection_Regression_Report.html` (generated 07/10/2026). `test-results/` holds no result JSON, and `reports/html` is empty.
- **Standalone Playwright FDI specs (`tests/regression/first-delivery-inspections/**` and `tests/smoke/first-delivery-inspections/**`): no current execution evidence.**
  - The only report is the module HTML report of 07 Oct 2026. It shows 12 flows: 10 passed, 1 failed ("FDI draft") and 1 skipped ("FDI operational").
  - Every one of those spec files was edited afterwards: the filters and config specs on 09 Oct, readonly on 27 Oct, access, owned-flow and smoke on 28 Oct, and the main regression spec on 29 Oct. The page objects changed on 31 Oct.
  - The 07 Oct results are therefore **stale**, and these tests are treated as "no execution evidence found".
- **`tests/regression/pending/scp-document-management.spec.js`** has current evidence: the 25 Oct 2026 approved-regression run. The spec and its page object have not changed since 24 Oct.
- **"Not confirmed – needs client answer"** is written wherever no A-category rule exists. I have not invented any expected behaviour.

---

# MODULE 1: FIRST DELIVERY INSPECTION (FDI)

## A. Feature inventory

The Class column uses these codes:

| Code | Meaning |
|---|---|
| P | Passing, with execution evidence |
| P* | Passing, but against an unconfirmed expectation (B/C/D) |
| PR | Partial: one aspect passes, but a required aspect is untested |
| F | Failing or known defect |
| S | Only skipped or blocked tests |
| U | A test exists in code but has no current execution evidence |
| N | No test at all |

Source abbreviations:

| Abbreviation | Document |
|---|---|
| AC-ACC | `docs/FDI_ACCEPTANCE_CRITERIA.md` |
| LIST | `docs/FDI_LISTING_REQUIREMENTS.md` |
| ASG | `docs/FDI_INSPECTOR_ASSIGNMENT_REQUIREMENTS.md` |
| IR | `docs/FDI_INSPECTION_REPORT_REQUIREMENTS.md` |
| SET | `docs/FDI_SETTINGS_REQUIREMENTS.md` |
| OMS | `docs/functional-discovery/OTHER_MODULES_SCENARIOS.md` |
| TRS | `docs/functional-discovery/TICKET_REGRESSION_SCENARIOS.md` |
| PMFD | `docs/functional-discovery/PM_FUNCTIONAL_DISCOVERY.md` |

| # | Screen | Feature / action | Evidence source | Existing test IDs | Latest status | Class |
|---|---|---|---|---|---|---|
| 1 | FDI Listing | Page loads with its filters and columns | OMS §3 FDI-SMK-01; APP_MAP_SWEEP:13; REQ-FDI-004 (A) | FDI-SMK-01, SCP-DEMO-011, TC-20 | Passed (smoke and demo 10 Nov; TC-20 20 Nov 17:45) | P |
| 2 | Record creation | The first delivery of a material creates exactly one FDI; later deliveries create none (FDI-R1) | OMS §3a and "Rule FDI-R1"; REQ-FDI-001 (A); REQ-PL-083 | PL-REG-INT-01, TC-20 (incl. optional step "second material → no record"), FDI-REG-01b; FDI-REG-01 and 01a skipped (delegated to PL) | PL-REG-INT-01 Passed 20 Nov, but Skipped "GRN not generated" in 6 of 14 runs; FDI-REG-01b Passed | P |
| 3 | Record creation | Initial status is "Auditor Not Yet Assigned" | LIST AC3; REQ-FDI-002 (A) | TC-20 | Passed | P |
| 4 | FDI Listing | Each row shows the delivery's supplier | LIST AC2; REQ-FDI-004 (A) | TC-20 | Passed | P |
| 5 | FDI Listing | Newest first by creation date, also after the filters are cleared | LIST AC1/18; REQ-FDI-005 (A) | POM `scp-first-delivery-inspection.spec.js:54-55` (first row only) | No execution evidence found | U |
| 6 | FDI Listing | Status filter | LIST AC14; REQ-FDI-007 (A) | FDI-REG-04, TC-22; POM "FDI filter: status" | FDI-REG-04 and TC-22 Passed; POM no evidence | P |
| 7 | FDI Listing | Material filter | LIST AC14 | TC-22 (Material + Status); POM "FDI filter: material" | Passed (combined only); POM no evidence | PR |
| 8 | FDI Listing | Supplier filter | LIST AC14; REQ-FDI-007 ("Supplier … not exercised") | POM "FDI filter: supplier" | No execution evidence found (07 Oct result is stale) | U |
| 9 | FDI Listing | Assigned To (inspector e-mail) filter | LIST AC14 | FDI-REG-04 (no-match only); POM "FDI filter: assigned inspector" | Negative case Passed; positive case untested | PR |
| 10 | FDI Listing | Delivery Date From/To, inclusive bounds | LIST AC16; REQ-FDI-008 (A) | POM `filters.spec.js:147`, `scp-fdi-readonly.spec.js:56` | No execution evidence found | U |
| 11 | FDI Listing | Combined filters, no-match and clear | LIST AC15/18 | FDI-REG-04, TC-22 | Passed | P |
| 12 | FDI Listing | Filters never expose another supplier's records | LIST AC17; REQ-FDI-009 (E) | none | n/a | N |
| 13 | Access | Role-based FDI screen permission | REQ-FDI-003 (E); FDI-R2 | FDI-REG-01c | Skipped | S |
| 14 | Access | Project Admin sees all FDIs regardless of supplier organisation | AC-ACC AC1; REQ-FDI-010 (E) | FDI-SMK-01 (implicit, not asserted) | Passed, but the rule is not asserted | PR |
| 15 | Access | A Project-Owning-Organisation user (any role) sees all | AC-ACC AC2; REQ-FDI-010 (E) | none | n/a | N |
| 16 | Access | Supplier-organisation scoping; submittals with no supplier are hidden | AC-ACC AC3/4/8; LIST AC12; REQ-FDI-011 (E) | `scp-fdi-access.spec.js` (fixture-driven) | Skipped: `SCP_FDI_ACCESS_CASES` unset; no evidence | S |
| 17 | Access | The organisation scope intersects with role permissions | AC-ACC AC5 | none | n/a | N |
| 18 | Access | Responsible user: View allowed, Fill and Notify not | AC-ACC AC9–11; REQ-FDI-013 (E) | `test-data/fdi-access.example.json` (template only) | Skipped / never run | S |
| 19 | Access | Responsible user View before completion | REQ-FDI-012 (D); LIST "Clarifications" | none | n/a | N |
| 20 | Procurement Log → FDI | Responsible-user assignment rules: eligible roles, replacement, role change | AC-ACC AC12/13; REQ-FDI-014 (E) | TC-12 (PL "Assign Responsible user", happy path only) | TC-12 Passed; the rules are untested | PR |
| 21 | Notifications | FDI Notify recipients | AC-ACC AC6/7/11; REQ-FDI-015 (E) | Independent contract "fdiNotificationRecipients" | Blocked (25 Oct) | S |
| 22 | FDI Listing | Self Assign | LIST AC4/5; REQ-FDI-016 (A) | FDI-REG-06, TC-21 | Passed (20 Nov) | P |
| 23 | FDI Listing | Row refresh after Self Assign without a reload | REQ-FDI-017 (D) | FDI-REG-06 (reloads before checking) | Passed against an unconfirmed expectation | P* |
| 24 | Eligibility | Direct mapping and "All Materials" | LIST AC4; REQ-FDI-018 (A) | TC-18, TC-21, PM-REG-FDI-27 | Passed | P |
| 25 | Eligibility | Mapping by Material Category (BUGS-198/416) | ASG AC2; REQ-FDI-018 ("category path not covered"); REQ-FDI-903 | PM-REG-FDI-22 (config side only); T543-06 skipped | Config Passed; effect on the listing untested | PR |
| 26 | Eligibility | An ineligible (unmapped) inspector is not offered Self Assign | LIST AC4 | POM `filters.spec.js:27` (gated by `SCP_FDI_CURRENT_USER_ELIGIBLE`) | No evidence | N |
| 27 | FDI Listing | Unassign Self | LIST AC6; REQ-FDI-022 (A) | FDI-REG-07 | Passed | P |
| 28 | FDI Listing | An assigned record is locked against other inspectors | ASG AC5; REQ-FDI-023 (E) | none | n/a | N |
| 29 | Eligibility | Disabled or pending inspectors cannot Self Assign | REQ-FDI-020 (E); REQ-PM-054 | PM-REG-FDI-28, PM-REG-ROLE-10, PM-REG-FDI-18 | Skipped | S |
| 30 | Eligibility | A since-disabled assignee keeps the record | REQ-FDI-021 (E) | PM-REG-FDI-28a | Skipped | S |
| 31 | FDI Listing | Admin "Assign" action | ASG AC1/4; REQ-FDI-024 (A); SCP-DEF-022/012; REQ-PM-057 (D) | FDI-REG-02 (skipped as "covered by FDI-REG-06"); POM main spec soft assert `:67-78`; PM-REG-ROLE-20 | Skipped; known defects SCP-DEF-022/012 | F |
| 32 | FDI Listing | Assign dropdown lists only eligible, enabled inspectors | ASG AC2/3; REQ-FDI-025 (A) | none (POM helper `assignInspector` is unused) | n/a | N |
| 33 | FDI Listing | Admin reassignment keeps answers; previous assignee loses actions | ASG AC6–8; REQ-FDI-026 (A) | POM main spec `:121-136` (needs `SCP_FDI_REASSIGN_INSPECTOR`) | Not run: env unset; no evidence | S |
| 34 | FDI Listing | Reassigning a completed record | REQ-FDI-027 (D) | none | n/a | N |
| 35 | FDI Listing | Assign available only to Project Admin | ASG AC10 | POM "FDI list: record states" `:49-52` | No execution evidence found | U |
| 36 | Eligibility | Project Admin Self Assign without an inspector mapping | REQ-FDI-019 (D) | none (TC-21 uses a mapped Project Admin) | n/a | N |
| 37 | Inspection form | Fill opens the form with Save Progress and Submit Inspection | LIST AC7 | FDI-REG-08/09/10, TC-21 | Passed | P |
| 38 | Inspection form | Save keeps answers and status | LIST AC8; REQ-FDI-028 (A) | FDI-REG-09, TC-21 | Passed | P |
| 39 | Inspection form | Opening without saving never completes the report (the original bug) | LIST "Current behavior", AC8 | POM "FDI draft: open an assigned report without changing it" | No evidence (it failed on 07 Oct) | U |
| 40 | Inspection form | Submit → completed and read-only | LIST AC10; REQ-FDI-029 (A) | FDI-REG-10, TC-21, TC-22, SCP-DEMO-012 | Passed | P |
| 41 | FDI Listing | No View before "Inspection Completed" | LIST AC9 | POM "record states" `:24,31` | No execution evidence found | U |
| 42 | Inspection form | FAIL answer with an observation | REQ-FDI-030 (C) | FDI-REG-10 (FDI-REG-11 skipped as covered) | Passed against an unconfirmed expectation | P* |
| 43 | Inspection form | Unanswered text questions | REQ-FDI-031 (D) | none | n/a | N |
| 44 | Inspection form | Mandatory photo blocks Submit; Save still allowed | IR AC8/9; REQ-FDI-034 (A) | FDI-REG-08, 09, 10 | Passed | P |
| 45 | Inspection form | Optional photo: submit with zero photos | IR AC10; REQ-FDI-035 (A) | PM-REG-FDI-05b; access fixture `submitWithoutPhotos` | Skipped / never run | S |
| 46 | Inspection form | Photos section on or off | IR AC3/4; REQ-FDI-033 (A) | PM-REG-FDI-05e/05f/05g; POM main spec `:101-114` | Skipped; POM has no evidence | S |
| 47 | Inspection form | Overall Notes on or off | IR AC1/2; REQ-FDI-032 (A) | PM-REG-FDI-05a; POM main spec | Skipped | S |
| 48 | Inspection form | Photo file formats | REQ-FDI-036 (A: accept JPEG, PNG, PDF, XLSX, CSV) vs IR AC5 (reject non-image) | PM-REG-FDI-05h; POM `rejectNonImage` asserts rejection | Skipped; the POM step contradicts the register | S |
| 49 | Inspection form | Photo size and count limits | REQ-FDI-037 (D) | none | n/a | N |
| 50 | Inspection form / detail | Thumbnails in edit and view; popup Previous/Next | IR AC6/7; REQ-FDI-038 (A) | PM-REG-FDI-05i/05j; `scp-fdi-photo-viewer.spec.js` | Skipped (`SCP_FDI_PHOTO_SUBMITTAL` unset) | S |
| 51 | Inspection form | Spec document link: thumbnails, names, viewer | IR AC11/12; REQ-FDI-039 (A) | PM-REG-FDI-05d/05k | Skipped | S |
| 52 | Inspection form | Spec-document empty states | IR AC13/14; REQ-FDI-040 (A) | PM-REG-FDI-05l/05m; POM main spec `:85` | Skipped / no evidence | S |
| 53 | Inspection form | Changed settings vs saved drafts | IR AC16; REQ-FDI-041 (D); REQ-PM-049 | PM-REG-FDI-05n; POM main spec `:101-114` asserts that drafts follow the new settings | Skipped / no evidence | S |
| 54 | Inspection Detail | Subcontractor and Admin can View completed records | LIST AC11/13; REQ-FDI-042 (A) | TC-22, SCP-DEMO-012 (Project Admin only) | Passed (Project Admin only) | PR |
| 55 | Inspection Detail | Detail content: status, inspected by/at, sync, notes, responses, photos | OMS §3a; REQ-FDI-043 (B) | FDI-REG-10 | Passed against an unconfirmed expectation | P* |
| 56 | Inspection Detail | Sync to Procore as a PDF (Admin only) | LIST AC13; REQ-FDI-044 (E) | FDI-REG-12; POM main spec `:160-163` (toast only) | Skipped / no evidence | S |
| 57 | FDI Listing | No FDI audit trail | REQ-FDI-045 (A) | FDI-REG-05 | Passed | P |
| 58 | PM › FDI Config | FDI Config opens; heading and four exact labels | SET AC1/2; REQ-PM-046 (A) | PM-REG-FDI-01, PM-SMK-010 | Passed | P |
| 59 | PM › FDI Config | Save persists Yes/No; reload shows the saved state; unsaved changes are discarded | SET AC3/4; REQ-PM-046 | PM-REG-FDI-03, PM-REG-FDI-04 | Passed (FDI-04 needed a step retry in 2 runs) | P |
| 60 | PM › FDI Config | Mandatory photos depend on uploads | SET AC6; REQ-PM-047 (A) | PM-REG-FDI-02, 02a, 02b | Passed | P |
| 61 | PM › FDI Config | Default No on an unconfigured project | SET AC5 | PM-REG-FDI-07 | Passed | P |
| 62 | PM › FDI Config | Settings are per project | SET AC7 | PM-REG-FDI-06, 06b, 06c | Passed | P |
| 63 | PM › FDI Config | Inspectors table: add, scope, enable/disable, edit mapping | REQ-PM-052 (A) | PM-REG-FDI-10, 20–25c, 27, 29a, TC-18 | Passed | P |
| 64 | PM › FDI Config | Invite inspectors | REQ-PM-050 (A) | PM-REG-FDI-11–17, 19, 26, PM-SMK-011 | Passed | P |
| 65 | PM › FDI Config | Invite organisation list is unique | REQ-PM-051 (A) | PM-REG-FDI-16a | Known defect SCP-DEF-023 | F |
| 66 | PM › FDI Config | Invite acceptance activates the inspector | REQ-PM-053 (E) | PM-REG-FDI-18 | Skipped | S |
| 67 | PM › FDI Config | A User Management invite does not add an inspector | REQ-PM-055 (A); REQ-UM-009 | PM-REG-FDI-26a | Skipped | S |
| 68 | PM › FDI Config | Inspector audit trail | REQ-PM-056 (D) | none (PM-REG-FDI-29 is not in any run) | n/a | N |
| 69 | PM › Roles | "FDI: Assign Inspector" permission | REQ-PM-057 (D); PMFD:330/344; evidence png | PM-REG-ROLE-20 | Skipped | S |
| 70 | PM › FDI Config | Question sets and groups | REQ-PM-058 (B) | PM-REG-FDI-30, 31, 33–36, 41, 42c, TC-19 | Passed against an unconfirmed expectation | P* |
| 71 | PM › FDI Config | Duplicate set, question and group names | REQ-PM-059 (A) | PM-REG-FDI-43 (KD), 44, 45 | FDI-43 is known defect SCP-DEF-031; 44 and 45 Passed | F |
| 72 | PM › FDI Config | Add question and organisation bank | REQ-PM-060 (A) | PM-REG-FDI-37–40 | Passed | P |
| 73 | PM › FDI Config | Deleted questions: list, and removal from new forms | REQ-PM-061 (A) | PM-REG-FDI-42, 42a, 42b | List Passed; the effect on new forms is untested | PR |
| 74 | PM › FDI Config | Questions hidden from other organisations | REQ-PM-062 (A) | PM-REG-FDI-47 | Passed | P |
| 75 | PM › FDI Config | Questions shared inside the organisation | REQ-PM-063 (E) | PM-REG-FDI-46, 48, 49 | Skipped | S |
| 76 | PM › FDI Config | Organisation Id on the question API | REQ-PM-064 (E) | PM-REG-FDI-50 | Skipped | S |
| 77 | PM › FDI Config | Question-set categories from the master list (BUGS-543) | TRS BUGS-543; REQ-FDI-901/902 (A) | T543-02, 03, 04, 07–11 | Passed. **T543-01 and T543-05 are listed in REQ-FDI-901 but exist in no spec and no run** | PR |
| 78 | Material Category API | Category API scoped to the project | REQ-FDI-904 (A) | T543-12 | Failed in 11 of 11 runs (real defect) | F |
| 79 | PM › FDI Config | Inspector mapping uses the master category list | REQ-FDI-903 (A) | T543-06 | Skipped | S |
| 80 | PM › FDI Config | Organisation question sets (BUGS-548) | REQ-FDI-905/906 (A) | T548-01, 02, 03, 05, 06, 07, 10, 13, 14, 15, 17 | Passed | P |
| 81 | PM › FDI Config | Organisation sets shared within the organisation only | REQ-FDI-907 (E) | T548-04 | Skipped | S |
| 82 | PM › FDI Config | Bank-deleted question, all-or-nothing create, bank protection | REQ-FDI-908 (E) | T548-11, 12, 16 | Skipped | S |
| 83 | PM › FDI Config | A view-only user has no organisation-set actions | REQ-FDI-909 (E) | T548-18 | Skipped | S |
| 84 | PM › FDI Config | Other FDI permissions (Manage Inspectors, Manage Questions, Sync to Procore, View Inspectors) gate their actions | PMFD:330 (permission list), evidence png | none | n/a | N |

## B. FDI coverage summary (counted)

**Inventory classification (84 rows, counted by row number):**


| Class | Rows | Count |
|---|---|---|
| P | 1, 2, 3, 4, 6, 11, 22, 24, 27, 37, 38, 40, 44, 57, 58, 59, 60, 61, 62, 63, 64, 72, 74, 80 | **24** |
| P* | 23, 42, 55, 70 | **4** |
| PR | 7, 9, 14, 20, 25, 54, 73, 77 | **8** |
| F | 31, 65, 71, 78 | **4** |
| S | 13, 16, 18, 21, 29, 30, 33, 45, 46, 47, 48, 50, 51, 52, 53, 56, 66, 67, 69, 75, 76, 79, 81, 82, 83 | **25** |
| U | 5, 8, 10, 35, 39, 41 | **6** |
| N | 12, 15, 17, 19, 26, 28, 32, 34, 36, 43, 49, 68, 84 | **13** |
| **Total** | | **84** |


- **Fully complete with current evidence and a confirmed expectation (P): 24 of 84 (29%).** Adding P\* and PR gives 36 of 84 with at least some passing evidence.

**Test IDs with pm-flow execution evidence (`status.tsv`, counted):**

| Group | IDs | Passed | Skipped | Known defect | Failed |
|---|---|---|---|---|---|
| FDI functional (FDI-SMK-01, FDI-REG-01…12 incl. 01a/01b/01c, SCP-DEMO-011/012, TC-20/21/22, PL-REG-INT-01) | 22 | 15 | 7 | 0 | 0 |
| FDI configuration and tickets (PM-REG-FDI-*, PM-SMK-010/011, PM-REG-ROLE-10/20, TC-18/19, T543-*, T548-*) | 105 | 72 | 30 | 2 | 1 |

The Skipped column includes 14 PM-REG-FDI-05a…n cases. The two known defects are 16a and 43, and the failure is T543-12.

**Standalone Playwright FDI tests in code:**
- There are 24 statically defined tests:
  - access 1, owned-flow 1, photo-viewer 1, readonly 4, config 4, filters 11, main regression 1, smoke 1.
  - The access spec can add N dynamic tests; with no fixture it adds 0.
- **0 of the 24 have current execution evidence.** 12 have stale 07 Oct evidence.

**Register (module "First Delivery Inspections", 54 entries):**
- Categories: A 30, B 1, C 1, D 8, E 14.
- Register automation status: Passing 19, Skipped 10, Failing 1, Blocked 14, Not automated 10.
- The register also has 19 Project Management entries for FDI Config (REQ-PM-046…064):
  - Categories: A 11, B 1, D 3, E 4.
  - Status: Passing 8, Skipped 5, Known defect 2, Blocked 3, Not automated 1.

**Passing against an unconfirmed expectation:**
- REQ-FDI-017 (D), REQ-FDI-030 (C), REQ-FDI-043 (B) and REQ-PM-058 (B).
- Tests: FDI-REG-06, FDI-REG-10, PM-REG-FDI-30/31/33/34/35/36/41/42c and TC-19.

**Register over-claims found:**
- **REQ-FDI-901** cites T543-01 and T543-05 as "Automated – Passing". Neither ID exists in `tests/pm-flow/tickets-regression.spec.js` or in any run.
- **REQ-FDI-016** cites FDI-REG-02, and REQ-FDI-029 cites FDI-REG-03. Both are permanently `run.skip` ("covered by …").
- **REQ-FDI-030** cites FDI-REG-11, which is also a skip.
- **REQ-FDI-034** cites PM-REG-FDI-05c, which is skipped.
- **REQ-FDI-007** is marked "Automated – Passing", but the supplier, date and positive inspector filters were never executed.

## C. FDI gap test cases (prioritised)

Priority key:
- **P0:** permissions, data exposure or a confirmed rule that is entirely untested.
- **P1:** a confirmed rule that is partially tested or skipped.
- **P2:** unconfirmed rules, or low risk.

### P0 – Permission and visibility matrix

The access rows below are one matrix. I recommend implementing them as data-driven cases on `tests/regression/first-delivery-inspections/scp-fdi-access.spec.js`, which already supports per-account expectations.

**Proposed matrix**, where ✓ means the action is visible:

| Actor | Sees FDI? | View (completed) | Self Assign (unassigned) | Fill / Unassign (own) | Assign | Sync | Notify | Rule |
|---|---|---|---|---|---|---|---|---|
| Project Admin (any org) | All | ✓ | only if an eligible inspector (REQ-FDI-019 D) | if assignee | ✓ (ASG; app: SCP-DEF-022, REQ-PM-057 D) | ✓ | ✓ | AC1, AC7, LIST AC13 |
| Owning-org user, non-admin | All (within role) | ✓ | if eligible | if assignee | ✗ | ✗ | ✓ | AC2, AC7, ASG AC10 |
| Supplier-org match, non-admin | Own supplier only | ✓ | if eligible | if assignee | ✗ | ✗ | only if inspector | AC4, AC6 |
| Supplier-org mismatch | ✗ | – | – | – | – | – | ✗ | AC4 |
| Any non-admin, submittal without supplier | ✗ | – | – | – | – | – | – | AC8 |
| Responsible user (other org), not inspector | FDIs on own submittal | ✓ (pending: REQ-FDI-012 D) | ✗ | ✗ | ✗ | ✗ | ✗ | AC10, AC11 |
| Role without FDI View | ✗ | – | – | – | – | – | – | AC5, REQ-FDI-003 |
| Eligible inspector (not assignee) on an assigned record | ✓ | – | ✗ | ✗ | ✗ | – | – | ASG AC5 |
| Disabled or pending inspector | ✓ | – | ✗ | – | – | – | – | REQ-FDI-020 |

#### GAP-FDI-001 – Project Admin sees every FDI regardless of supplier organisation

| Field | Detail |
|---|---|
| Module & functionality | FDI › Listing › Access (AC1) |
| Business purpose | Admins must oversee all inspections |
| Preconditions | Project with FDIs for at least two different supplier organisations and one submittal without a supplier; Project Admin account outside those supplier organisations |
| Test data | Records R-S1 (supplier org S1), R-S2 (org S2), R-NOSUP |
| Existing automation status | FDI-SMK-01 opens the page as Project Admin, but no assertion covers this |
| Missing automation work | Add a fixture case to `SCP_FDI_ACCESS_CASES`; seed the records on the first page (the suite does not paginate) |
| Requirement clarity | A rule (AC-ACC AC1); register REQ-FDI-010 is **E** (blocked on accounts) |

Steps:
1. Sign in as the Project Admin and select the project.
2. Open First Delivery Inspections with the filters cleared.
3. Locate R-S1 and R-S2.
4. Open Procurement Log and search each submittal.

Expected result:
- R-S1 and R-S2 are both listed in FDI and in Procurement Log.
- How R-NOSUP appears to an admin is **not confirmed – needs a client answer**. AC8 restricts only non-admins.

#### GAP-FDI-002 – Project-Owning-Organisation user (non-admin role) sees all permitted FDIs

| Field | Detail |
|---|---|
| Module & functionality | FDI › Access (AC2, AC5) |
| Business purpose | Owning-organisation staff are not scoped by supplier |
| Preconditions | A non-admin account in the owning organisation of NRVC_Hall whose role has FDI View |
| Test data | R-S1, R-S2 |
| Existing automation status | None |
| Missing automation work | Account, fixture case, then automate |
| Requirement clarity | A (AC2); REQ-FDI-010 E; question REQ-FDI-010 |

Steps:
1. Sign in as the owning-organisation user.
2. Open the FDI list.
3. Check that R-S1 and R-S2 are listed.
4. Check that no Assign or Sync action is offered.

Expected result:
- Both records are visible.
- Assign is not offered (ASG AC10).
- Sync is not offered (LIST AC13: "Only Admin gets Sync").

#### GAP-FDI-003 – Supplier-organisation match and mismatch (FDI list and Procurement Log)

| Field | Detail |
|---|---|
| Module & functionality | FDI › Access (AC3, AC4; LIST AC12) |
| Business purpose | Suppliers must not see other suppliers' inspections |
| Preconditions | Supplier user in org S1 who is not admin, not in the owning organisation and not Responsible |
| Test data | R-S1, R-S2 |
| Existing automation status | Fixture-driven spec exists; skipped (`scp-fdi-access.spec.js:18`) |
| Missing automation work | A real fixture file and credentials. **SCP-DEF-048** blocks linking a new supplier to its user, so use a pre-existing seeded supplier user. |
| Requirement clarity | A (AC3/4); REQ-FDI-011 **E** |

Steps:
1. Sign in as the S1 user.
2. On the FDI list, check R-S1 and R-S2.
3. In Procurement Log, search the R-S1 and R-S2 submittals.

Expected result:
- R-S1 is visible in both places.
- R-S2 is absent from both.

#### GAP-FDI-004 – Submittal without a supplier is hidden from non-privileged users

| Field | Detail |
|---|---|
| Module & functionality | FDI › Access (AC8) |
| Business purpose | Prevent leakage before a supplier is set |
| Preconditions | FDI on a submittal with no supplier. Whether an FDI can exist with no supplier is unknown, because FDI records are generated by a delivery. |
| Test data | Supplier user S1 |
| Existing automation status | None |
| Missing automation work | Seed data. First confirm that such a record can exist. |
| Requirement clarity | A for Procurement Log (AC8); feasibility for FDI **not confirmed – needs a client answer** |

Steps:
1. Sign in as the S1 user.
2. Search the no-supplier submittal in Procurement Log.
3. Check the FDI list.

Expected result: not shown.

#### GAP-FDI-005 – Role-permission intersection, and a role without FDI access (includes existing FDI-REG-01c)

| Field | Detail |
|---|---|
| Module & functionality | FDI › Access (AC5; FDI-R2) |
| Business purpose | Organisation scoping never widens role permissions |
| Preconditions | Dedicated test role with no FDI: View, assigned to a user in the owning organisation, and also a user in org S1 |
| Test data | R-S1 |
| Existing automation status | FDI-REG-01c skipped (`tests/pm-flow/app-regression.spec.js:394`) |
| Missing automation work | A dedicated role. Changing shared roles is out of scope. |
| Requirement clarity | A (AC5) and REQ-FDI-003 **E** |

Steps:
1. Sign in as the restricted user.
2. Check the sidebar.
3. Open `/first-delivery-inspections` directly.

Expected result:
- No FDI page and no records.
- The exact denial behaviour (hidden menu, redirect or message) is **not confirmed – needs a client answer**.

#### GAP-FDI-006 – Responsible user outside the supplier organisation can View but not Fill

| Field | Detail |
|---|---|
| Module & functionality | FDI › Access (AC9–11) |
| Business purpose | Responsible users follow their submittals without performing inspections |
| Preconditions | User U-R in another organisation is Responsible for submittal SUB-R; the FDI on SUB-R is completed, and a second FDI is pending and assigned to someone else |
| Test data | Template `test-data/fdi-access.example.json` |
| Existing automation status | Template only |
| Missing automation work | Fixture, accounts and a Responsible assignment |
| Requirement clarity | A (AC10/11); REQ-FDI-013 **E** |

Steps:
1. Sign in as U-R.
2. In Procurement Log, check that SUB-R is visible and editable and that "Assign Responsible" is not shown.
3. On the FDI list, check the completed FDI: View is available; Fill, Self Assign, Unassign and Assign are not.

Expected result: as the steps describe.
- View on the **pending** FDI is **not confirmed – needs a client answer** (REQ-FDI-012 D).
- Self Assign for a Responsible user who is also an eligible inspector is **not confirmed**.

#### GAP-FDI-007 – Responsible user View on a pending FDI

| Field | Detail |
|---|---|
| Module & functionality | FDI › Access conflict between LIST AC9 and ACC AC10 |
| Business purpose | Resolve a contradiction between the two stories |
| Preconditions | As GAP-FDI-006 |
| Test data | As GAP-FDI-006 |
| Existing automation status | None |
| Missing automation work | Parameterise once answered |
| Requirement clarity | **D** (REQ-FDI-012) |

Steps:
1. As U-R, view an "Awaiting Inspection Completion" FDI on SUB-R.

Expected result: **Not confirmed – needs a client answer** (REQ-FDI-012). Observed behaviour is unknown.

#### GAP-FDI-008 – Filters never expose another supplier's records

| Field | Detail |
|---|---|
| Module & functionality | FDI › Filters (LIST AC17) |
| Business purpose | Filter option lists and results must respect scoping |
| Preconditions | S1 user; R-S2 exists |
| Test data | S2 supplier name, S2 material |
| Existing automation status | None |
| Missing automation work | Seeded accounts |
| Requirement clarity | A; REQ-FDI-009 **E** |

Steps:
1. As the S1 user, open the Material and Supplier dropdowns.
2. Set the Supplier filter to S2 if it is offered, or type the S2 inspector e-mail.
3. Set a date range covering the R-S2 delivery.

Expected result:
- No R-S2 row is returned for any filter combination.
- Whether S2 appears as an **option** in the dropdowns is **not confirmed – needs a client answer**.

#### GAP-FDI-009 – FDI notification recipients (covers the blocked "fdiNotificationRecipients" contract)

| Field | Detail |
|---|---|
| Module & functionality | FDI › Notify (AC6, AC7, AC11) |
| Business purpose | Inspection notifications reach only authorised people |
| Preconditions | Notification capture: test mailbox, notification API or event log; plus accounts for Project Admin, owning-org user, inspector, and a Responsible user who is not the inspector |
| Test data | A new first delivery |
| Existing automation status | `scp-independent-business-contracts.spec.js:8` Blocked (25 Oct) |
| Missing automation work | Capture mechanism, then an assertion per recipient |
| Requirement clarity | A (AC6/7/11); REQ-FDI-015 **E** |

Steps:
1. Complete a first delivery that triggers an FDI notification.
2. Collect the notifications for every account.

Expected result:
- The Project Admin, owning-organisation users and the material's inspector receive it.
- A Responsible user who is not the inspector does not.
- A non-matching user does not.
- The channel (in-app, e-mail or both) is **not confirmed**.
- Related: REQ-ANT-009 (D) "First delivery of <material> received" alert recipients.

#### GAP-FDI-010 – Responsible-user assignment rules (Procurement Log, FDI story AC12/13)

| Field | Detail |
|---|---|
| Module & functionality | Procurement Log › Assign Responsible (affects FDI visibility) |
| Business purpose | Correct Responsible grants drive FDI View |
| Preconditions | Mutable accounts: Sub Contractor, Project Admin, Supplier, and a role-change account |
| Test data | Submittal SUB-R |
| Existing automation status | TC-12 Passed (happy path only). The POM `assignResponsible` helper exists but is not executed. |
| Missing automation work | Dedicated mutable accounts |
| Requirement clarity | A (AC12/13); REQ-FDI-014 **E** |

Steps:
1. As Project Admin, open the Assign Responsible dropdown and check that only Sub Contractor and Project Admin users are listed.
2. Assign U1, then reassign to U2.
3. In a second browser context, check that U1 loses and U2 gains access immediately.
4. Change U2's role away from Sub Contractor.
5. As a non-admin, check that the Assign Responsible action is absent.

Expected result:
- Only those roles are offered.
- The new assignment replaces the old one and applies immediately.
- The role change does not remove the assignment.
- Non-admins cannot assign.

### P0/P1 – Assignment lifecycle and eligibility

#### GAP-FDI-011 – Assigned record is locked against other eligible inspectors

| Field | Detail |
|---|---|
| Module & functionality | FDI › Self Assign lock (ASG AC5, LIST AC5) |
| Business purpose | Prevents double inspection |
| Preconditions | Two enabled inspectors, I1 and I2, both mapped to material M; record R assigned to I1 |
| Test data | R on NRVC_Hall |
| Existing automation status | None (REQ-FDI-023) |
| Missing automation work | Second inspector login |
| Requirement clarity | A; REQ-FDI-023 **E** |

Steps:
1. I1 self-assigns R.
2. Sign in as I2 in a separate context.
3. Open the FDI list and inspect the R row.
4. Try the `/first-delivery-inspection/<id>/form` URL directly.

Expected result:
- I2 sees no Self Assign, no Fill Inspection Report and no Unassign Self.
- Behaviour on direct URL access is **not confirmed – needs a client answer**.

#### GAP-FDI-012 – Disabled and pending-invite inspectors cannot Self Assign; re-enabling restores it

Includes existing PM-REG-FDI-28, PM-REG-ROLE-10 and PM-REG-FDI-18.

| Field | Detail |
|---|---|
| Module & functionality | FDI Config › Inspectors → Listing |
| Business purpose | Only active inspectors inspect |
| Preconditions | Inspector I3 mapped to M, with a login; an unassigned record on M |
| Test data | I3 |
| Existing automation status | Skipped (`pm-regression-part2.spec.js:50,52`) |
| Missing automation work | An accepted inspector account. The YOPmail Cloudflare check blocks invite acceptance (REQ-PM-053). |
| Requirement clarity | A (INS-AC-10); REQ-FDI-020 / REQ-PM-054 **E** |

Steps:
1. As admin, disable I3 in FDI Config.
2. As I3, open the list: Self Assign is absent.
3. As admin, re-enable I3.
4. As I3, reload: Self Assign is present.
5. Repeat for a pending (invited, not accepted) inspector.

Expected result: as the steps describe.

#### GAP-FDI-013 – A record assigned to a since-disabled inspector keeps the assignee

Existing PM-REG-FDI-28a.

| Field | Detail |
|---|---|
| Module & functionality | FDI › Assignment after disable (ST-5) |
| Preconditions | Record assigned to I3 |
| Existing automation status | Skipped (`pm-regression-part2.spec.js:53`) |
| Missing automation work | Disposable assigned record |
| Requirement clarity | A; REQ-FDI-021 **E** |

Steps:
1. Assign R to I3.
2. Disable I3.
3. Reload the list as admin.

Expected result:
- Assigned To still shows I3.
- Whether I3 can still Fill the record is **not confirmed – needs a client answer**.

#### GAP-FDI-014 – Eligibility via Material Category mapping (includes T543-06)

| Field | Detail |
|---|---|
| Module & functionality | FDI Config › Inspector "By Material Category" → Listing Self Assign |
| Business purpose | Category mapping (BUGS-198/416) must grant eligibility |
| Preconditions | Inspector mapped only by category C; new material M-C in C with a completed first delivery |
| Test data | Run category and material |
| Existing automation status | PM-REG-FDI-22 Passed (config only); T543-06 skipped (`tickets-regression.spec.js:376`) |
| Missing automation work | Extend the E2E flow (TC-18 maps "Specific Materials" only) |
| Requirement clarity | A (ASG AC2, LIST AC4); REQ-FDI-018 |

Steps:
1. Map the inspector by category C.
2. Generate the FDI for M-C (Procurement → delivery → GRN).
3. As that inspector, open the list.

Expected result:
- Self Assign is offered on the M-C record.
- The inspector-mapping dialog lists category C, shows "specific materials" disabled with "No materials in this category yet" before materials exist, and "All materials" is selectable (REQ-FDI-903).

#### GAP-FDI-015 – An unmapped inspector is not offered Self Assign (negative)

| Field | Detail |
|---|---|
| Module & functionality | FDI › Eligibility (LIST AC4) |
| Business purpose | Only eligible inspectors can inspect |
| Preconditions | Enabled inspector mapped to material X only; record on material Y |
| Test data | Records on X and Y |
| Existing automation status | POM `filters.spec.js:27` checks only the positive case, gated by `SCP_FDI_CURRENT_USER_ELIGIBLE` |
| Missing automation work | Inspector login, plus an explicit negative assertion |
| Requirement clarity | A |

Steps:
1. Sign in as that inspector.
2. Open the list and find the Y record.

Expected result: no Self Assign on Y. Self Assign is present on X.

#### GAP-FDI-016 – Admin "Assign" on an unassigned record (existing FDI-REG-02, PM-REG-ROLE-20; known defects SCP-DEF-022/012)

| Field | Detail |
|---|---|
| Module & functionality | FDI › Admin Assign (ASG AC1, AC4) |
| Business purpose | Admin can delegate inspections |
| Preconditions | Project Admin role with "FDI: Assign Inspector". It is **unticked** today (PMFD:330/344; `docs/functional-discovery/evidence/fdi-assign-inspector-permission-project-admin.png`). |
| Test data | Run record "Auditor Not Yet Assigned" |
| Existing automation status | FDI-REG-02 is `run.skip` "Covered by FDI-REG-06" (`app-regression.spec.js:426`). That reason is wrong: Self Assign is a different action. POM main spec `:67-78` records a soft failure; PM-REG-ROLE-20 is skipped. |
| Missing automation work | Replace the skip with a real test. Assert the permission state first (PM-REG-ROLE-20). |
| Requirement clarity | A (REQ-FDI-024) but blocked by **D** REQ-PM-057 (permission) |

Steps:
1. As Project Admin, open the list.
2. On an unassigned run record, check that Assign appears next to Self Assign.
3. Click Assign, choose eligible inspector I1 and confirm.
4. Reload.

Expected result:
- Status is "Awaiting Inspection Completion" and Assigned To is I1.
- I1 has Fill and Unassign Self.
- Today's observed behaviour: only Self Assign is shown; assigned records show "Reassign" (SCP-DEF-012).

#### GAP-FDI-017 – Assign dropdown shows only enabled, eligible inspectors

| Field | Detail |
|---|---|
| Module & functionality | FDI › Admin Assign dropdown (ASG AC2/3) |
| Preconditions | Inspectors: direct-M, All Materials, category-of-M, mapped-to-other-material, disabled-but-mapped |
| Existing automation status | None. POM `assignInspector(row, inspector, {eligible, excluded})` exists but no test calls it with lists. |
| Missing automation work | Seeded configuration and GAP-FDI-016 first |
| Requirement clarity | A; REQ-FDI-025 |

Steps:
1. Open Assign on a record for M.
2. Read the dropdown options.

Expected result:
- The first three inspectors are listed.
- The other-material and disabled inspectors are absent.
- Whether pending-invite inspectors are listed is **not confirmed**.

#### GAP-FDI-018 – Admin reassignment preserves answers and moves the actions

| Field | Detail |
|---|---|
| Module & functionality | FDI › Reassign (ASG AC6–8, 11) |
| Preconditions | Draft assigned to I1 with saved answers; I2 eligible; logins for both |
| Existing automation status | POM main spec `:121-136`, gated by `SCP_FDI_REASSIGN_INSPECTOR` (unset). It checks only the admin's view, not I1's and I2's sessions. |
| Missing automation work | Set the env, and add separate-context checks for I1 and I2 |
| Requirement clarity | A; REQ-FDI-026 |

Steps:
1. Admin reassigns to I2.
2. As I1, open the list: no Fill and no Unassign.
3. As I2: Fill is available, and the saved answers are present.
4. I2 saves and submits.
5. Check that the record count is unchanged.

Expected result:
- Status stays "Awaiting Inspection Completion".
- No new FDI row is created.
- Submit completes the record normally.

#### GAP-FDI-019 – Reassigning a completed inspection

| Field | Detail |
|---|---|
| Requirement clarity | **D** REQ-FDI-027 |

Steps:
1. As admin, find a completed record and look for Assign or Reassign.

Expected result: **Not confirmed – needs a client answer.** The story's own interpretation excludes completed records.

#### GAP-FDI-020 – Assign hidden for non-admin roles

| Field | Detail |
|---|---|
| Requirement clarity | A (ASG AC10) |
| Existing automation status | POM "record states" `filters.spec.js:49-52`; no evidence |
| Missing automation work | Accounts per role, and a run |

Steps:
1. As a Sub Contractor and as a Supplier, open the list.

Expected result: no Assign or Reassign on any row.

#### GAP-FDI-021 – Project Admin Self Assign without an inspector mapping

| Field | Detail |
|---|---|
| Requirement clarity | **D** REQ-FDI-019. ASG "Scope" says no; FDI-R3 says yes. |

Steps:
1. Remove the Project Admin from the Inspectors list, or map them to another material.
2. Open an unassigned record.

Expected result: **Not confirmed – needs a client answer.**

#### GAP-FDI-022 – Row refreshes after Self Assign without a reload

| Field | Detail |
|---|---|
| Existing automation status | FDI-REG-06 Passed but reloads first (`app-regression.spec.js:411-415`) |
| Code conflict | POM `selfAssign` (`pages/first-delivery-inspections/first-delivery-inspections.page.js:343`) asserts the row updates **without** a reload. This is an unconfirmed expectation built into a shared helper. |
| Requirement clarity | **D** REQ-FDI-017 |

Steps:
1. Click Self Assign.
2. Do not reload.

Expected result: **Not confirmed – needs a client answer.** Observed: the row stays "Auditor Not Yet Assigned" until reload.

### P1 – Listing and filters

#### GAP-FDI-023 – Newest-first ordering by creation date, including after clearing filters

| Field | Detail |
|---|---|
| Preconditions | Two run records created in a known order, where the older-created one has a **later** delivery date |
| Existing automation status | Not automated in pm-flow (REQ-FDI-005); POM main spec `:54` checks only the first row; no evidence |
| Missing automation work | Read created-at timestamps from `/api/first_delivery_inspection/list_inspections/` and compare them with the UI order |
| Requirement clarity | A |

Steps:
1. Open the list and read the row order.
2. Apply a status filter, then Clear.
3. Read the order again.

Expected result: descending by creation date both times. Delivery date does not decide the order.

#### GAP-FDI-024 – Supplier filter and positive Inspector filter, alone

| Field | Detail |
|---|---|
| Existing automation status | POM `filters.spec.js:128,140` exist; no current evidence; pm-flow has none |
| Missing automation work | Port to the executed pm-flow suite, or run the POM suite and publish its report |
| Requirement clarity | A (LIST AC14/15) |

Steps:
1. Select supplier S.
2. Every row's Supplier must equal S.
3. Clear.
4. Type assignee e-mail E.
5. Every row's Assigned To must equal E.

Expected result: only matching rows; Clear restores the list.

#### GAP-FDI-025 – Inclusive Delivery Date From/To boundaries

| Field | Detail |
|---|---|
| Test data | Record delivered on date D |
| Existing automation status | POM `filters.spec.js:147`, `scp-fdi-readonly.spec.js:56` (needs `SCP_FDI_READONLY_DATA`, unset); no evidence. REQ-FDI-008 says the date picker was avoided because of SCP-DEF-002. |
| Missing automation work | Execute. Readonly data allocation is required. |
| Requirement clarity | A |

Steps:
1. Set From = D and To = D.
2. Set From = D+1 (record excluded).
3. Set To = D−1 (record excluded).

Expected result: D is included when equal to From or To, and excluded otherwise.

#### GAP-FDI-026 – Delivery date validation: From later than To, and invalid typed date

| Field | Detail |
|---|---|
| Evidence | Date inputs "DD/MM/YYYY" are present (screenshot `fdi-unassigned-record-self-assign-only.png`) |
| Requirement clarity | No rule. **Not confirmed – needs a client answer.** |

Steps:
1. Set From = 10/11/2026 and To = 01/11/2026.
2. Type 31/02/2026.

Expected result: **Not confirmed – needs a client answer.** Observed behaviour is unknown.

#### GAP-FDI-027 – FDI list load time

| Field | Detail |
|---|---|
| Requirement clarity | **D** REQ-FDI-006 |

Steps:
1. Time the period from navigation to the first rendered row, or to "No inspections found.".

Expected result: **Not confirmed – needs a client answer.** Observed: slow; the E2E waits up to 180 s (`e2e-smoke.spec.js:1042`).

#### GAP-FDI-028 – A second delivery of an inspected material creates no new FDI (existing FDI-REG-01/01a)

| Field | Detail |
|---|---|
| Existing automation status | FDI-REG-01/01a are `run.skip` (delegated, `app-regression.spec.js:392-393`). PL-REG-INT-01 was skipped "GRN not generated" in 6 of 14 runs. TC-20's second-material check is `optional: true` (`e2e-smoke.spec.js:1053-1057`), so it cannot fail the scenario. |
| Missing automation work | Make the negative check mandatory |
| Requirement clarity | A (REQ-FDI-001) |

Steps:
1. For material M (FDI already exists), complete a second delivery and its GRN.
2. Reload the list.

Expected result: still exactly one FDI for M.

### P1 – Inspection report (settings-driven; existing PM-REG-FDI-05a…n skipped)

All of these depend on a disposable FDI draft per settings combination. They are skipped as "Cross-module – Regression part 3" (`tests/pm-flow/pm-regression-part2.spec.js:49`). The POM main spec `tests/regression/first-delivery-inspections/scp-first-delivery-inspection.spec.js:82-158` already implements most of them but has no execution evidence.

#### GAP-FDI-029 – Overall Notes = Yes shows "Observation/Notes" at the end; No hides it

PM-REG-FDI-05a/05e. Requirement clarity: A (IR AC1/2, REQ-FDI-032).

Steps:
1. Set the project setting to Yes and Save.
2. Open a draft and confirm the section is last.
3. Set the setting to No, open a **new** draft, and confirm the section is absent.

Expected result: as IR AC1/2.
- Effect on an already-saved draft: see GAP-FDI-035 (D).
- Observed note: NRVC_Hall showed the notes section while the setting read No (REQ-FDI-032); not re-verified.

#### GAP-FDI-030 – Uploads = No hides the Photos section; Yes shows "Add photo"

PM-REG-FDI-05f/05g. Requirement clarity: A (IR AC3/4).

Steps:
1. Toggle the setting.
2. Open a new draft.

Expected result: as IR AC3/4.

#### GAP-FDI-031 – Mandatory = No: Submit with zero photos succeeds

PM-REG-FDI-05b; access fixture `submitWithoutPhotos`. Requirement clarity: A (IR AC10; REQ-FDI-035).

| Field | Detail |
|---|---|
| Preconditions | Disposable draft; uploads Yes, mandatory No |

Steps:
1. Fill in the answers.
2. Submit Inspection without a photo.

Expected result: completed; no photo message.

#### GAP-FDI-032 – Photo formats (conflict)

PM-REG-FDI-05h.

| Field | Detail |
|---|---|
| Requirement clarity | Register **A**: REQ-FDI-036 and REQ-PM-048 say the upload "accepts all common formats, e.g. JPEG, PNG, PDF, XLSX, CSV (replaces the story's 'reject non-image files')". |
| Code conflict | The POM regression step `rejectNonImage` (`pages/first-delivery-inspections/first-delivery-inspections.page.js:299-307`, called at `scp-first-delivery-inspection.spec.js:116-119`) asserts that a PDF is **rejected**. It contradicts the confirmed register rule and should be rewritten before that suite is executed. |

Steps: upload JPG, PNG, PDF, XLSX and CSV in turn.

Expected result: per REQ-FDI-036 (A), all are accepted. The exact "common formats" list beyond these examples is **not confirmed**.

#### GAP-FDI-033 – Thumbnails in edit and view mode; popup Previous/Next without closing

PM-REG-FDI-05i/05j; `scp-fdi-photo-viewer.spec.js` skipped at line 6. Requirement clarity: A (IR AC6/7).

Steps:
1. Upload 3 photos.
2. Click the 2nd thumbnail.
3. Click Next (shows the 3rd), then Previous twice (shows the 1st).
4. Save, submit, and repeat in the detail view.

Expected result: as IR AC6/7.

#### GAP-FDI-034 – Spec document link: documents, empty state, missing Spec Section No, hidden when No

PM-REG-FDI-05d/05k/05l/05m.

| Field | Detail |
|---|---|
| Preconditions | Three submittals: (a) Spec Section No with linked spec documents (uses Document Management › Spec Documents "Add Spec Section No", DOC-REG-07); (b) Spec Section No without documents; (c) no Spec Section No |
| Requirement clarity | A for (c) exact text and (d); (b) text **D** (REQ-FDI-040 question); linking mechanism **D** (REQ-DOC-009) |

Steps:
1. With the setting Yes, open the FDI for (a): check thumbnails and file names, then click one to open the popup viewer.
2. Open (b): check the no-documents state.
3. Open (c): check the text "No Spec Section No provided in submittal."
4. With the setting No, check that the section is absent.

Expected result: as IR AC11–15. The exact text for (b) is **not confirmed – needs a client answer**.

#### GAP-FDI-035 – Settings changed while a draft is saved

PM-REG-FDI-05n.

| Field | Detail |
|---|---|
| Code conflict | The POM main spec `:101-114` already asserts that a saved draft follows the new settings. This is an unconfirmed expectation embedded in a test. |
| Requirement clarity | **D** (REQ-FDI-041 / REQ-PM-049) |

Steps:
1. Save a draft.
2. Change the settings.
3. Reopen the draft.

Expected result: **Not confirmed – needs a client answer.**

#### GAP-FDI-036 – Photo size and count limits

Requirement clarity: **D** (REQ-FDI-037).

Steps:
1. Upload a very large image.
2. Upload many images.

Expected result: **Not confirmed – needs a client answer.**

#### GAP-FDI-037 – Submit with unanswered text questions

Requirement clarity: **D** (REQ-FDI-031, Q-FDI-10). Observed: submits, showing "Not answered".

Steps:
1. Leave text questions blank.
2. Submit.

Expected result: **Not confirmed – needs a client answer.**

#### GAP-FDI-038 – FAIL answer: is an observation required, and does it trigger follow-up?

| Field | Detail |
|---|---|
| Existing automation status | FDI-REG-10 Passed against an unconfirmed (C) expectation; FDI-REG-11 skipped as covered (`app-regression.spec.js:466`) |
| Requirement clarity | **C** (REQ-FDI-030) |

Steps:
1. Answer FAIL with no observation.
2. Submit.

Expected result: **Not confirmed – needs a client answer.** Observed: FAIL with an observation is accepted.

#### GAP-FDI-039 – Opening or Back without Save never completes the report, and Fill stays available

| Field | Detail |
|---|---|
| Existing automation status | POM "FDI draft …" (`filters.spec.js:57`); failed 07 Oct; no current evidence |
| Requirement clarity | A (LIST AC8 and "Current behavior") |

Steps:
1. Fill Inspection Report.
2. Click Back without saving.
3. Reload the list.

Expected result:
- Status is "Awaiting Inspection Completion".
- The action is still "Fill Inspection Report", not View.

#### GAP-FDI-040 – No View before completion, for the assignee and for other users

| Field | Detail |
|---|---|
| Existing automation status | POM "FDI list: record states"; no evidence |
| Requirement clarity | A (LIST AC9), except the Responsible user (D, GAP-FDI-007) |

Steps:
1. For an unassigned and for an assigned record, as the assignee and as admin, check the actions.

Expected result: no View on either record.

#### GAP-FDI-041 – Completed report is read-only, including direct form-URL access

| Field | Detail |
|---|---|
| Requirement clarity | A for read-only display (LIST AC10); **not confirmed** for URL behaviour |

Steps:
1. Open `/first-delivery-inspection/<completedId>/form` directly.

Expected result:
- No editable inputs and no Save or Submit.
- Redirect or message behaviour is **not confirmed – needs a client answer**.

#### GAP-FDI-042 – Subcontractor views a completed inspection; Sync is not shown to non-admins

| Field | Detail |
|---|---|
| Existing automation status | TC-22 is Project Admin only |
| Requirement clarity | A (LIST AC11/13); REQ-FDI-042 |

Steps:
1. As a Sub Contractor with access, open the list.
2. On a completed record, click View.

Expected result:
- The detail page opens read-only.
- No Sync or "Sync to Provider" action.

#### GAP-FDI-043 – Sync to Procore delivers a PDF (existing FDI-REG-12)

| Field | Detail |
|---|---|
| Existing automation status | `run.skip` at `app-regression.spec.js:469`. The POM main spec `:160-163` accepts any toast, including "sync failed", which is a false-positive risk. |
| Missing automation work | A Procore sandbox and an assertion that the PDF arrived |
| Requirement clarity | A (Admin-only Sync); REQ-FDI-044 **E** |

Steps:
1. Click Sync to Provider.
2. Verify the PDF in the Procore sandbox.
3. Check that Provider Sync changes from "Not synced".

Expected result: the PDF is present in Procore. The status label after sync is **not confirmed**.

#### GAP-FDI-044 – Inspection Detail content

Requirement clarity: **B** (REQ-FDI-043). Existing: FDI-REG-10 Passed (unconfirmed).

Steps:
1. Ask the client to confirm the expected fields.
2. Keep the current assertions until then.

Expected result: **Not confirmed – needs a client answer.**

### P1/P2 – FDI Config, question sets and tickets

#### GAP-FDI-045 – Invite → accept → active/enabled inspector (existing PM-REG-FDI-18)

| Field | Detail |
|---|---|
| Existing automation status | Skipped (`pm-regression-part2.spec.js:50`) |
| Missing automation work | A mailbox without Cloudflare |
| Requirement clarity | A (INS-AC-7); REQ-PM-053 **E** |

Steps:
1. Invite.
2. Accept via the mailbox.
3. Reload FDI Config.

Expected result: the row is Active and Enabled.

#### GAP-FDI-046 – A User Management invite does not add an FDI inspector (existing PM-REG-FDI-26a)

Requirement clarity: A (REQ-PM-055, REQ-UM-009). The skip is "cross-module". It needs no external system and can be automated now.

Steps:
1. Invite from User Management.
2. Open FDI Config › Inspectors.

Expected result: the person is not listed.

#### GAP-FDI-047 – Organisation sharing of questions and organisation sets (existing PM-REG-FDI-46/48/49, T548-04)

| Field | Detail |
|---|---|
| Missing automation work | A second project in NRVC_Hall's organisation (Q-FDI-8) |
| Requirement clarity | A rules (R56, BUGS-548); REQ-PM-063 / REQ-FDI-907 **E** |

Steps: as REQ-PM-063 / TRS T548-04.

Expected result: available but not enabled in same-organisation projects; absent in other organisations; enabling does not spread.

#### GAP-FDI-048 – Question API carries the organisation Id (existing PM-REG-FDI-50)

Requirement clarity: **E** (REQ-PM-064; endpoint unknown). Expected result: per QORG-AC-7.

#### GAP-FDI-049 – Duplicate question-set name ignoring case (existing PM-REG-FDI-43, SCP-DEF-031)

Requirement clarity: A (REQ-PM-059). Status: Known Defect in 5 runs; keep it as a defect check.

#### GAP-FDI-050 – Invite organisation list unique (existing PM-REG-FDI-16a, SCP-DEF-023)

Requirement clarity: A (REQ-PM-051). Status: Known Defect. It also has locator instability (section D).

#### GAP-FDI-051 – Material Category API leaks across projects (existing T543-12)

| Field | Detail |
|---|---|
| Requirement clarity | A (REQ-FDI-904) |
| Status | Failed 11 of 11. Observed: 757 categories from 15 projects. |

Missing work: register it as a known defect so the failure is triaged rather than repeated.

#### GAP-FDI-052 – Question-set categories: master list includes a category with no materials; save a set with such a category (T543-01, T543-05)

| Field | Detail |
|---|---|
| Existing automation status | **No test exists**, although REQ-FDI-901 cites both IDs as Passing |
| Requirement clarity | A |

Steps:
1. Create a category with no materials.
2. In New Question Set, check that it is listed.
3. Save a set with only that category.

Expected result: listed; saved without error (TRS T543-01/05).

#### GAP-FDI-053 – BUGS-548 deferred cases (existing T548-11, 12, 16, 18)

| Field | Detail |
|---|---|
| Requirement clarity | **E** (REQ-FDI-908/909) |
| Missing automation work | Developer-prepared data; manual race; a non-destructive guard; a view-only account |

Expected result: as the BUGS-548 ACs.

#### GAP-FDI-054 – A deleted question is absent from new inspection forms

| Field | Detail |
|---|---|
| Existing automation status | PM-REG-FDI-42/42a/42b cover the config list only |
| Requirement clarity | A (REQ-PM-061 "disappear … from new forms") |

Steps:
1. Delete question Q in the run set.
2. Generate or open a new FDI draft for a material in that set.

Expected result:
- Q is not listed on the new form.
- Effect on existing drafts is **not confirmed**.

#### GAP-FDI-055 – FDI permission flags gate their actions (Manage Inspectors, Manage Questions, View Inspectors, Sync to Procore, Self-Assign Inspector)

| Field | Detail |
|---|---|
| Evidence | PMFD:330 permission list |
| Preconditions | A test role with one flag removed at a time (not on shared roles) |
| Requirement clarity | Role model "configuration-based" (FDI-R2, R9/R41). Per-flag semantics **not confirmed – needs a client answer**. |

Steps:
1. With each flag off, check the corresponding control.

Expected result: **Not confirmed – needs a client answer.**

#### GAP-FDI-056 – Inspector audit trail

Requirement clarity: **D** (REQ-PM-056). Expected result: **Not confirmed – needs a client answer.**

#### GAP-FDI-057 – Execute and qualify the standalone POM FDI suite

| Field | Detail |
|---|---|
| Scope | Existing tests: `scp-first-delivery-inspection-filters.spec.js` (11), `scp-first-delivery-inspection.spec.js` (1), `scp-first-delivery-inspection-config.spec.js` (4), `scp-fdi-readonly.spec.js` (4), `scp-fdi-owned-flow.spec.js` "SCP-FDI-101", `scp-fdi-photo-viewer.spec.js`, `scp-fdi-access.spec.js`, and smoke `tests/smoke/first-delivery-inspections/scp-first-delivery-inspection.spec.js` |
| Status | No execution evidence found for the current code |
| Missing automation work | See below |

Missing work:
1. Remove the assertions that contradict the register before running:
   - `rejectNonImage`: GAP-FDI-032.
   - Assign expected for admin, `filters.spec.js:49-52`: currently SCP-DEF-022.
   - `selfAssign` without a reload: GAP-FDI-022.
   - Drafts following new settings: GAP-FDI-035.
2. Supply the environment data (section E).
3. Run the suite and publish the report.
4. Assign stable test IDs that map to the register.

---

# MODULE 2: DOCUMENT MANAGEMENT

## A. Feature inventory

Source abbreviations:

| Abbreviation | Document |
|---|---|
| DFD | `docs/functional-discovery/DOC_FUNCTIONAL_DISCOVERY.md` |
| DSC | `docs/functional-discovery/DOC_SCENARIOS.md` |
| AMS | `docs/functional-discovery/APP_MAP_SWEEP.md` |
| PEND | `tests/regression/pending/scp-document-management.spec.js` (evidence 25 Oct) |

| # | Screen | Feature / action | Evidence source | Existing test IDs | Latest status | Class |
|---|---|---|---|---|---|---|
| 1 | All Documents | Page loads: count, search, category filter, 8 columns, pagination | DFD §1; AMS:17; REQ-DOC-001 (B) | DOC-SMK-01, SCP-DEMO-021 | Passed (10 Nov) | P* |
| 2 | Spec Documents | Page loads: upload area, 6 columns, actions | DFD §2; REQ-DOC-001 | DOC-SMK-02, SCP-DEMO-022 | Passed | P* |
| 3 | PO Validation | Page loads | DFD §3 | DOC-SMK-03, SCP-DEMO-023 | Passed | P* |
| 4 | BOM Validation | Page loads | DFD §4 | DOC-SMK-04, SCP-DEMO-024 | Passed | P* |
| 5 | EPD Report | Page loads | DFD §5 | DOC-SMK-05, SCP-DEMO-025 | Passed | P* |
| 6 | All Documents | Search by material | REQ-DOC-003 (B) | DOC-REG-01 | Passed | P* |
| 7 | All Documents | Search by filename or by category text (placeholder "filename, material, or category") | DFD §1 | none | n/a | N |
| 8 | All Documents | No-match search returns 0 / "No documents found." | REQ-DOC-003 | DOC-REG-01 (step 2), PEND `:7` | Passed | P* |
| 9 | All Documents | Category filter "PO File" | REQ-DOC-003 | DOC-REG-02 | Passed | P* |
| 10 | All Documents | Files from other modules appear (Pdf, PO File, Delivery Photo, Inventory) | REQ-DOC-002 (B) | DOC-REG-03 | Passed | P* |
| 11 | All Documents | Other categories (Components, EPD, Materials, Sites, Submittals, Supplier Material Mapping) | DFD §1 | none | n/a | N |
| 12 | All Documents | Page records, project total, pagination metadata | DFD §1 | PEND `:4` | Passed (25 Oct) | P* |
| 13 | All Documents | Uploaded By shows the real uploader | REQ-DOC-004 (D); OBS-DOC-1/2 | DOC-REG-04 | Failed in all 6 runs ("Unknown") | F |
| 14 | All Documents | View and Download | REQ-DOC-005 (B) | DOC-REG-05 | Passed (size > 0 only) | P* |
| 15 | Spec Documents | Upload a spec document | REQ-DOC-007 (B) | DOC-REG-06 | Passed | P* |
| 16 | Spec Documents | Add Spec Section No | REQ-DOC-008 (B) | DOC-REG-07 | Passed | P* |
| 17 | Spec Documents | Edit or clear an existing Spec Section No ("Edit Spec Section No") | AMS:18; DSC DOC-REG-07 "add/edit" | none (Add only) | n/a | N |
| 18 | Spec Documents | Delete (run file) | REQ-DOC-010 (B) | DOC-REG-08 | Passed | P* |
| 19 | Spec Documents | 60 MB upload limit (61 MB rejected) | REQ-DOC-011 (D) | DOC-REG-09 | Passed | P* |
| 20 | Spec Documents | Accepted file formats ("PDF, DOC, ZIP, and most other formats") | DFD §2; REQ-DOC-011 (D) | none | n/a | N |
| 21 | Spec Documents | Saved filename, status, uploader, specification association | DFD §2 | PEND `:10` | Passed (25 Oct) | P* |
| 22 | Spec Documents | Download an existing spec document | REQ-DOC-006 (D); SCP-DEF-011 | PEND `:13` | Failed (HTTP 404, 25 Oct) | F |
| 23 | Spec Documents | Send to TheLink | REQ-DOC-012 (E, out of scope R7) | none | n/a | S |
| 24 | Spec Documents → FDI | Link to the FDI report via Spec Section No | REQ-DOC-009 (D) | PM-REG-FDI-05d | Skipped | S |
| 25 | PO Validation | PDF without line items → message | REQ-DOC-013 (B) | DOC-REG-10 | Passed | P* |
| 26 | PO / BOM Validation | Unsupported input file rejected before upload | PEND `:21` | PEND (po and bom) | Passed (25 Oct) | P* |
| 27 | PO Validation | Valid PO compared with Procurement | REQ-DOC-014 (E) | DOC-REG-11; contract "poDocumentValidation" | Skipped / Blocked | S |
| 28 | PO Validation | Multiple files at once ("multiple files OK") | DFD §3 | none | n/a | N |
| 29 | BOM Validation | BOM validated | REQ-DOC-015 (E) | DOC-REG-12; contract "bomDocumentValidation" | Skipped / Blocked | S |
| 30 | EPD Report | Upload → Procurement "EPD Exists" shows the date link | REQ-DOC-016 (A) | DOC-REG-13 | Passed (20 Nov) | P |
| 31 | EPD Report | Records listed with status; summary cards | REQ-DOC-017 (A) | DOC-REG-14, DOC-REG-15 | Passed | P |
| 32 | EPD Report | Extracted values (product, manufacturer, GWP) | REQ-DOC-018 (D) | contract "epdCarbonFactors" | Blocked | S |
| 33 | EPD Report | Upload validation: no submittal or no file selected | DFD §5 (upload control; `app-regression.spec.js:596` checks `isEnabled`) | none | n/a | N |
| 34 | EPD Report | Scan Procore for EPDs | REQ-DOC-019 (E) | DOC-REG-16 | Skipped | S |
| 35 | All modules | Document access by role and organisation ("Files: List" is unticked for Project Admin, PMFD:342) | PMFD:342 | none | n/a | N |

## B. Document Management coverage summary (counted)

**Inventory classification (35 rows):**

| Class | Rows | Count |
|---|---|---|
| P | 30, 31 | **2** |
| P* | 1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 14, 15, 16, 18, 19, 21, 25, 26 | **18** |
| F | 13, 22 | **2** |
| S | 23, 24, 27, 29, 32, 34 | **6** |
| N | 7, 11, 17, 20, 28, 33, 35 | **7** |
| **Total** | | **35** |

- **Complete against a confirmed (A) expectation: 2 of 35 (6%).** 20 of 35 have passing evidence, but 18 of those pass against B/D expectations.

**pm-flow test IDs (26):**
- DOC-SMK-01…05, DOC-REG-01…16 and SCP-DEMO-021…025.
- Passed 22, Failed 1 (DOC-REG-04), Skipped 3 (DOC-REG-11, 12, 16).

**Standalone PEND spec (6 tests):** Passed 5, Failed 1 (25 Oct).

**Independent contract specs:** 3 Blocked (poDocumentValidation, bomDocumentValidation, epdCarbonFactors).

**Register (module "Document Management", 19 entries):**
- Categories: A 2, B 8, D 5, E 4.
- Automation: Passing 11, Failing 1, Not automated 3, Blocked 4.

**Passing against an unconfirmed expectation:**
- REQ-DOC-001, 002, 003, 005, 007, 008, 010, 011 and 013.
- Tests: DOC-SMK-01…05, DOC-REG-01, 02, 03, 05, 06, 07, 08, 09, 10, SCP-DEMO-021…025 and PEND `:4`, `:7`, `:10`, `:21`.

## C. Document Management gap test cases

#### GAP-DOC-001 – "Uploaded By" shows the real uploader (existing DOC-REG-04, failing)

| Field | Detail |
|---|---|
| Module & functionality | All Documents › Uploaded By |
| Preconditions | PO file uploaded via Procurement; system-generated checklist PDF |
| Existing automation status | Failed in 6 of 6 runs (`app-regression.spec.js:500-507`). Observed "Unknown" for PO File and "test" for the checklist. |
| Missing automation work | Keep it as Known Defect or Pending client. The test currently fails every run against a **D** expectation. |
| Requirement clarity | **D** (REQ-DOC-004) |

Steps:
1. Category PO File.
2. Read Uploaded By.
3. Repeat for Pdf.

Expected result: **Not confirmed – needs a client answer**, including what system-generated files should show.

#### GAP-DOC-002 – Download an existing spec document (PEND `:13`, failing; SCP-DEF-011)

| Field | Detail |
|---|---|
| Existing automation status | Failed: HTTP 404 from `/api/spec_documents/<id>/download/` (`pages/document-management/documents.page.js:33`) |
| Missing automation work | Add it to the pm-flow suite; it currently downloads only from All Documents |
| Requirement clarity | **D** (REQ-DOC-006) |

Steps:
1. On Spec Documents, click Download on an existing row.

Expected result: **Not confirmed – needs a client answer.** Proposed: the original file with the same name and size. Observed: 404.

#### GAP-DOC-003 – Valid PO validated against Procurement (existing DOC-REG-11)

| Field | Detail |
|---|---|
| Status | Skipped (`app-regression.spec.js:576`) |
| Missing automation work | A sample PO with line items, and the expected result (Q-DOC-3, Q-PL-13) |
| Requirement clarity | **E** (REQ-DOC-014) |

Expected result: **Not confirmed – needs a client answer.**

#### GAP-DOC-004 – BOM validation (existing DOC-REG-12)

Skipped (`:577`). Requirement clarity: **E** (REQ-DOC-015). Expected result: **Not confirmed – needs a client answer.**

#### GAP-DOC-005 – Scan Procore for EPDs (existing DOC-REG-16)

Skipped (`:622`). Requirement clarity: **E** (REQ-DOC-019). Needs a Procore sandbox. Expected result: **Not confirmed – needs a client answer.**

#### GAP-DOC-006 – EPD extracted values (product, manufacturer, GWP A1–A3, GWP total)

Requirement clarity: **D** (REQ-DOC-018; Q-DOC-1). Needs a real sample EPD. Observed: "--" for a non-EPD PDF. Expected result: **Not confirmed – needs a client answer.**

#### GAP-DOC-007 – Send to TheLink

Requirement clarity: **E** (REQ-DOC-012). Out of scope (R7); revisit when TheLink access exists. Expected result: **Not confirmed – needs a client answer.**

#### GAP-DOC-008 – Spec document linked through Spec Section No appears on the FDI report

Cross-module; same as GAP-FDI-034(a). Requirement clarity: **D** (REQ-DOC-009). Expected result: **Not confirmed – needs a client answer** on the linking mechanism.

#### GAP-DOC-009 – Edit or clear an existing Spec Section No

| Field | Detail |
|---|---|
| Evidence | AMS:18 lists the "Edit Spec Section No" action; DSC DOC-REG-07 "add/edit" |
| Existing automation status | DOC-REG-07 tests Add only |
| Requirement clarity | **B** (REQ-DOC-008) |

Steps:
1. Upload a run spec and add section S1.
2. Edit it to S2, then Save.
3. Edit it to "— None —", then Save.

Expected result: **Not confirmed – needs a client answer.** Observed for Add: the value is shown.

#### GAP-DOC-010 – Spec Documents upload limit boundary and formats

| Field | Detail |
|---|---|
| Existing automation status | DOC-REG-09 covers 61 MB only |
| Requirement clarity | **D** (REQ-DOC-011) |

Steps:
1. Upload exactly 60 MB.
2. Upload 60 MB + 1 byte.
3. Upload DOC, ZIP, XLSX and an executable-type file.

Expected result: **Not confirmed – needs a client answer.** On-screen text says "up to 60 MB · PDF, DOC, ZIP, and most other formats".

#### GAP-DOC-011 – PO Validation with multiple files

Evidence: DFD §3, "multiple files OK". Requirement clarity: **B**.

Steps:
1. Upload two files at once.

Expected result: **Not confirmed – needs a client answer.**

#### GAP-DOC-012 – All Documents: search by filename and by category, and search combined with the category filter

| Field | Detail |
|---|---|
| Existing automation status | DOC-REG-01 covers material only |
| Requirement clarity | **B** (REQ-DOC-003) |

Steps:
1. Search the run spec filename.
2. Search "PO File".
3. Search the material with category Pdf.

Expected result: **Not confirmed – needs a client answer.** The placeholder implies matches on filename, material or category.

#### GAP-DOC-013 – Remaining categories list their files

| Field | Detail |
|---|---|
| Existing automation status | DOC-REG-03 covers Pdf, PO File, Delivery Photo and Inventory only |
| Requirement clarity | **B** (REQ-DOC-002) |

Steps:
1. For Components, EPD, Materials, Sites, Submittals and Supplier Material Mapping, select the category and read the rows.

Expected result: **Not confirmed – needs a client answer.** At minimum, rows match the selected category.

#### GAP-DOC-014 – Download returns the same filename and size as the source

| Field | Detail |
|---|---|
| Existing automation status | DOC-REG-05 checks size > 0 only. DSC proposed "same name and size". |
| Requirement clarity | **B** (REQ-DOC-005) |

Steps:
1. Upload a run file (spec or FDI photo).
2. Download it from All Documents.
3. Compare the name and byte size.

Expected result: **Not confirmed – needs a client answer.**

#### GAP-DOC-015 – Document access by role and organisation (permission)

| Field | Detail |
|---|---|
| Evidence | PMFD:342: "Files: List" is unticked for Project Admin, yet the Project Admin sees All Documents (402 docs, DFD §1) |
| Preconditions | Supplier and Sub Contractor accounts; a test role without Files permissions |
| Requirement clarity | No confirmed rule. **Not confirmed – needs a client answer.** |

Steps:
1. As a supplier user, open All Documents and Spec Documents.
2. Look for other suppliers' PO files.
3. Use a role without "Files: List".

Expected result: **Not confirmed – needs a client answer.** Supplier-organisation scoping of documents is not specified.

#### GAP-DOC-016 – EPD upload validation: no submittal or no file selected

Evidence: the Upload button state is conditional (`app-regression.spec.js:596`). Requirement clarity: **B**.

Steps:
1. Click Upload with nothing selected.
2. Click Upload with a submittal but no file.

Expected result: **Not confirmed – needs a client answer.**

#### GAP-DOC-017 – Procurement "EPD Exists" link opens the EPD

| Field | Detail |
|---|---|
| Existing automation status | DOC-REG-13 checks the text only |
| Requirement clarity | A that it is a link (REQ-DOC-016); the link target is **not confirmed** |

Steps:
1. Click the date link in Procurement Log.

Expected result: the link is present. The target is **not confirmed – needs a client answer**.

#### GAP-DOC-018 – Spec Documents delete: cancel keeps the file, and other users' files

Requirement clarity: **B** (REQ-DOC-010). The confirmation is "if asked" in the code, so even the existence of a confirm dialog is unconfirmed.

Steps:
1. Click Delete, then Cancel if offered.
2. As another role, try to delete the run file.

Expected result: **Not confirmed – needs a client answer.**

---

# D. Flaky scripts and skips (both modules)

Selection rules from `status.tsv`: flips ≥ 2, retrysteps > 0, or mixed results. I also checked the per-run `reports/pm-flow/*/results.json`.

## Flaky or mixed results

**FDI-REG-06, 07, 08, 09, 10** (flips = 3; 7 runs: 3 Passed, 4 Skipped)

- **Root cause:** these are data-dependent, not intrinsically flaky.
  - They run only if an "Auditor Not Yet Assigned" run inspection exists, found by a regex on material names: `tests/pm-flow/app-regression.spec.js:396`, `/Auto Fdi|Pld|Pl[tr]/i`, with a 30 s wait at `:399-402`. Otherwise all eight cases are `run.skip` (`:468`).
  - The record comes from pl-regression-3, which itself skipped PL-REG-INT-01 with "GRN not generated" in 6 runs. On 20 Nov the 13:38 follow-up skipped, and the 14:07 rerun passed.
  - Secondary risk: `:413` and `:418` re-find the row with `filter({ hasText: mat }).first()`, a substring match. A material whose name contains `mat` could be selected instead.
  - The regex can also pick another suite's record ("Auto Fdi") whose material the Project Admin may not be eligible for.
- **Suggested fix:**
  - Pass the exact run material and submittal from pl-regression-3 through run data, and select the row by exact cell.
  - Report "Blocked (prerequisite)" instead of Skipped, so the gap is visible.
  - Or create the record within the suite.

**FDI-REG-04** (6 runs: 4 Passed, 2 Failed; retrysteps 2)

- **Root cause:**
  - On 10 and 13 Nov, "Status filter leaves other statuses listed": the filter was applied while the list was still loading, and the late response overwrote the filtered rows. The code comment at `app-regression.spec.js:361-363` confirms this.
  - The fix at `:364` polls the row count with fixed sleeps (`waitForTimeout(1500)`, `k.settle(1500)`, `networkidle` with `.catch`), and has passed since 13 Nov.
  - The remaining risk is timing-based waiting.
- **Suggested fix:** await the `GET /api/first_delivery_inspection/list_inspections/` response for each filter change (the pattern used in the POM smoke spec `:96-100`).

**TC-18, 19, 20, 21, 22** (15 runs; flips 5–6)

- **Root cause:** mostly upstream.
  - Most non-passes are "Blocked – prerequisite TC-16 / TC-17B did not pass": the Subcontractor login/approval and GRN steps.
  - Intrinsic failures:
    - **TC-19 (12 Nov):** the new-category UI changed ("Search or add a category", BUGS-543).
    - **TC-18 (12 Nov):** the invited member was not yet listed (the invite was not accepted).
    - **TC-18 (20 Nov 16:36):** the inspector row read "TTF George … All Materials" where Material 3 scoping was expected.
      - The `inspectorRow(text)` helper (`tests/pm-flow/support/e2e-kit-v2.js:418`) uses a substring `hasText` and `.first()`, so it can return a different row with an overlapping e-mail.
      - The scoped/All-Materials branch at `e2e-smoke.spec.js:1027-1028` depends on `SUBCON_LOGIN`, so the expectation varies by run mode. Which of the two caused this failure is uncertain.
    - **TC-21 (12 Nov):** the run question was not yet rendered. The questionnaire loads after the page; there is now a wait at about `:1066-1075`.
- **Suggested fix:**
  - Match the inspector row by an exact e-mail cell.
  - Fix `SUBCON_LOGIN` per run and record it.
  - Make TC-20's second-material check non-optional (`:1053-1057`).

**PM-REG-FDI-04** (6 Passed; 2 runs needed a step retry)

- **Root cause:**
  - The step "Photos are mandatory? back to original → Save → reload" first read `false`.
  - `saveFdi` (`tests/pm-flow/pm-regression-part2.spec.js:925`) waits a fixed 1200 ms instead of the save response.
  - `reload` (`:139`) waits a fixed 800 ms.
  - `fdiSettings` (`:915-919`) reads the DOM checkboxes immediately.
  - The readonly spec documents that after a reload the page first requests `/api/fdi_config/` with `project_id=null`, which returns 404, before the project-scoped call (`scp-fdi-readonly.spec.js:197-211`). Reading before hydration gives defaults (false).
- **Suggested fix:** await the save response, then the project-scoped `GET /api/fdi_config/?project_id=<id>`, before reading the checkboxes. This is the pattern used in `scp-fdi-readonly.spec.js:205-213`.

**PM-REG-FDI-31, 32, 33, 34, 36, 38–42a, 44, 45** (flips 2; one failed run, 10 Nov)

- **Root cause:**
  - One run broke when the New Question Set modal changed with BUGS-543. The locator `div.fixed.inset-0 … getByPlaceholder('Search …')` timed out.
  - The failure cascaded: 36–45 depend on the set created in 34 ("Set PMR2-… should be visible").
  - There is no intrinsic flakiness since then.
- **Suggested fix:**
  - Use role/label locators for the modal search.
  - Give each dependent scenario its own fixture set, or mark dependents Blocked rather than Failed.

**PM-REG-FDI-25a, 42c** (flips = 11)

- **Root cause:** **duplicate ID reporting, not flakiness.**
  - `tests/pm-flow/pm-regression.spec.js:618-619` reports both IDs as Skipped ("PART2").
  - `pm-regression-part2.spec.js:1081` and `:1233` run and pass them.
  - The aggregate alternates Skipped and Passed across suites.
- **Suggested fix:** remove the placeholder skips from part 1, or give them distinct IDs.

**PM-REG-FDI-16a** (Known Defect; flips 2)

- **Root cause:**
  - It is a real defect (SCP-DEF-023, duplicate organisations).
  - On 18 and 19 Nov, reruns failed earlier with "Dropdown should be visible" or "Dropdown options … not found". The scenario depends on PM-REG-FDI-16 state (the form open, the e-mail filled). The fallback at `pm-regression.spec.js:498-503` opens the form, but the organisation dropdown loads asynchronously after the e-mail is entered.
- **Suggested fix:** wait for the dropdown to become enabled and for its options to load before reading. Do not rely on a prior scenario's state.

**PM-REG-FDI-43** (Known Defect in 5 runs; flips 4)

- **Root cause:** the defect is consistent (SCP-DEF-031). The flips come from the 10 Nov cascade above, plus older pass/fail runs.
- **Suggested fix:** none beyond the cascade fix.

**DOC-REG-13, 14, 15** (6 runs: 4 Passed, 2 Failed)

- **Root cause:** this was **an expectation change, not flakiness.**
  - On 10 and 13 Nov the tests asserted the original OBS-DOC expectations: EPD Exists = "Yes", non-EPD not "Completed", no QR/checklist rows.
  - The user triage on 13 Nov reclassified these as working as designed (REQ-DOC-016/017 A). The code was changed at `app-regression.spec.js:599-600` and `:603-620`.
  - They have passed since.
- **Suggested fix:** none. Keep the triage comments.

**DOC-REG-04** (6 of 6 Failed; retrysteps 6)

- **Root cause:** deterministic. The app shows "Unknown" (`:500-507`), and the expectation is **D**. Each run retries the step uselessly.
- **Suggested fix:** register it as known defect or pending client so the retry is skipped; or turn it into an observation until REQ-DOC-004 is answered.

**T543-12** (11 of 11 Failed)

- **Root cause:** a real data-scoping defect (`tickets-regression.spec.js:335`).
- **Suggested fix:** add an entry to `config/scp-known-defects.js` (there is none for this signature).

**T548-14** (8 runs: 7 Passed, 1 Failed on 10 Nov)

- **Root cause (probable):** after Delete, `orgSet(ORG_RENAMED)` still returned the set within the 15 s poll (`tickets-regression.spec.js:744`), and the copy's `created_from.deleted` was false. This is likely eventual consistency or soft-delete timing on the server. Certainty is low because there is a single occurrence.
- **Suggested fix:** poll the copy's `created_from.deleted` with a longer timeout. Capture the API response on failure.

**T543-11** (flips 1)

- Not flaky (no failures). The run count differs by one skip. No action.

## Skips and conditional skips (why)

**Standalone Playwright specs.** No `test.fixme` exists in the in-scope specs.

| Location | Why it skips |
|---|---|
| `tests/regression/first-delivery-inspections/scp-fdi-access.spec.js:17-19` | Skips when `SCP_FDI_ACCESS_CASES` is unset. Only `test-data/fdi-access.example.json` exists, with REPLACE_ placeholders. No real fixture means the whole organisation/Responsible matrix generates **zero** tests. |
| `scp-fdi-photo-viewer.spec.js:6` | `SCP_FDI_PHOTO_SUBMITTAL` is unset (not in `.env`). |
| `scp-first-delivery-inspection-config.spec.js:30` | `SCP_FDI_UNCONFIGURED_PROJECT` is unset. Covered elsewhere by PM-REG-FDI-07 on SCP_Testing_Ram. |
| `scp-first-delivery-inspection-config.spec.js:45` | `SCP_FDI_SECOND_PROJECT` is unset. Covered by PM-REG-FDI-06/06b/06c. |
| `scp-first-delivery-inspection-filters.spec.js:8, 83, 142, 196` | Data-dependent skips: no records in 6 months; no completed record; first row unassigned; no editable or self-assignable record. A test may silently skip on clean data. Also, `:142` depends on the **first** row, so the inspector filter is skipped whenever the newest record is unassigned, which is the normal case after a new delivery. |
| `scp-fdi-owned-flow.spec.js:13-16` and `scp-fdi-readonly.spec.js:10-12` | Throw `ScpBlocked`, not skip, when `SCP_FDI_OWNED_MUTATIONS`, `SCP_FDI_OWNED_DATA` or `SCP_FDI_READONLY_DATA` is missing. None is set in `.env`. |
| `tests/smoke/first-delivery-inspections/scp-first-delivery-inspection.spec.js:5-11` | `beforeAll` throws if `SCP_FDI_SMOKE_SITE` or `SCP_FDI_SMOKE_SUBMITTAL` is missing. Both are set, but each successful run completes the dedicated record, so the configured submittal is most likely already consumed. Unverified, because no run evidence exists. |

**pm-flow `run.skip`.**

| Location | Skipped IDs | Reason |
|---|---|---|
| `app-regression.spec.js:392-393` | FDI-REG-01, 01a | Delegated to pl-regression-3 |
| `app-regression.spec.js:394` | FDI-REG-01c | Needs a role without FDI access |
| `app-regression.spec.js:426` | FDI-REG-02 | "Covered by FDI-REG-06". **The justification is incorrect**: Admin Assign is not Self Assign. |
| `app-regression.spec.js:466-467` | FDI-REG-11, FDI-REG-03 | "Covered by" |
| `app-regression.spec.js:468` | Data-dependent block (above) | No unassigned run inspection |
| `app-regression.spec.js:469` | FDI-REG-12 | Procore |
| `app-regression.spec.js:557` | DOC-REG-07/08 | Skipped if DOC-REG-06 fails |
| `app-regression.spec.js:576-577` | DOC-REG-11, 12 | Need samples |
| `app-regression.spec.js:622` | DOC-REG-16 | Procore |
| `pm-regression-part2.spec.js:49` | PM-REG-FDI-05a…n (14) | "Cross-module – Regression part 3", which does not exist yet |
| `pm-regression-part2.spec.js:50-56` | PM-REG-FDI-18, 26a, 28, 28a, 46, 48, 49 | As listed at those lines |
| `pm-regression.spec.js:618-620` | 25a, 42c (duplicate), 50 | Endpoint unknown |
| `tickets-regression.spec.js:376` | T543-06 | Deferred to PM part 2, but **never linked there** |
| `tickets-regression.spec.js:675` | T548-04 | Project ids missing |
| `tickets-regression.spec.js:767-770` | T548-11, 12, 16, 18 | As listed at those lines |

# E. Missing test data, dependencies and preconditions

1. **Seeded access accounts** (none exist). Needed for GAP-FDI-001…008, 011, 015, 020 and 042, and GAP-DOC-015:
   - Owning-organisation non-admin.
   - Supplier org S1 and S2 users (pre-linked; SCP-DEF-048 blocks new ones).
   - Responsible user in another organisation.
   - Role without FDI View.
   - Second and third eligible inspectors (logins).
   - Sub Contractor with FDI View.
   - Dedicated test roles that can be toggled (not shared roles).
   - A real `SCP_FDI_ACCESS_CASES` JSON file and the credential env vars it names.
2. **Seeded records:**
   - FDIs for two supplier organisations on the first unfiltered page (the access suite does not paginate).
   - A no-supplier submittal (feasibility unconfirmed).
   - A disposable assigned draft per settings combination (PM-REG-FDI-05a…n, photo viewer, optional photo).
   - A completed record for the viewer and Sync tests.
3. **Environment variables not set in `.env`:**
   - `SCP_FDI_ACCESS_CASES`, `SCP_FDI_REASSIGN_INSPECTOR`, `SCP_FDI_CURRENT_USER_ELIGIBLE`
   - `SCP_FDI_PHOTO_SUBMITTAL`, `SCP_FDI_PHOTO_COMPLETE`
   - `SCP_FDI_UNCONFIGURED_PROJECT`, `SCP_FDI_SECOND_PROJECT`
   - `SCP_FDI_OWNED_MUTATIONS`, `SCP_FDI_OWNED_DATA`, `SCP_FDI_READONLY_DATA`
   - `SCP_TKT548_OTHER_ORG_PROJECT`
4. **Pipeline dependency:** FDI-REG-06…10 need pl-regression-3 to produce a GRN-backed FDI the same day. PL-REG-INT-01 skipped "GRN not generated" in 6 of 14 runs, so a stable GRN-generation precondition is needed.
5. **External systems:**
   - Notification capture: mailbox without Cloudflare, notification API or event log (GAP-FDI-009, 045).
   - Procore sandbox (GAP-FDI-043, GAP-DOC-005).
   - TheLink (GAP-DOC-007).
6. **Second project in NRVC_Hall's organisation** (Q-FDI-8), plus an other-organisation project id: PM-REG-FDI-46/48/49 and T548-04.
7. **Sample files:**
   - A PO with line items, a BOM and a real EPD, each with its expected result (Q-DOC-3, Q-PL-13, Q-DOC-1).
   - A spec document linked to a submittal's Spec Section No, for FDI linkage.
   - Image and non-image photo fixtures for each format in REQ-FDI-036.
8. **Permission precondition:** the "FDI: Assign Inspector" permission must be ticked for Project Admin before Admin Assign (GAP-FDI-016…018) can run. Today it is unticked (evidence png).
9. **Developer-prepared data for BUGS-548:** an organisation set containing a bank-deleted question (T548-11), and a view-only (`fdi:view`) account (T548-18).
10. **Fresh dedicated FDI** for `SCP_FDI_SMOKE_SUBMITTAL` before each smoke run, because the smoke completes it.

# F. Clarification questions (register question IDs reused)

**FDI:**
1. **REQ-FDI-012:** Can a Responsible user View an FDI before completion (LIST AC9 vs ACC AC10)?
2. **REQ-FDI-024 / REQ-PM-057 / Q-ROLE-2:** Is Admin Assign in this release? Should "FDI: Assign Inspector" be ticked for Project Admin? Are SCP-DEF-022/012 configuration rather than code?
3. **REQ-FDI-019:** Must a Project Admin be a mapped, enabled inspector to Self Assign?
4. **REQ-FDI-027:** Is reassignment limited to "Awaiting Inspection Completion"?
5. **REQ-FDI-017:** Should the row update after Self Assign without a reload?
6. **REQ-FDI-031 / Q-FDI-10:** Must text questions be answered before Submit?
7. **REQ-FDI-030:** Must a FAIL answer require an observation, or trigger a follow-up or notification?
8. **REQ-FDI-037:** What are the maximum photo size and photo count?
9. **REQ-FDI-036 vs IR AC5:** Confirm that the "accept all common formats incl. PDF/XLSX/CSV" replacement is final, and give the full list. The POM test currently asserts the opposite.
10. **REQ-FDI-040:** What exact text should show when a Spec Section No has no linked documents?
11. **REQ-FDI-041 / REQ-PM-049:** Do setting changes apply to saved drafts?
12. **REQ-FDI-006:** What is the acceptable FDI list load time?
13. **REQ-FDI-003, 009, 010, 011, 013, 014, 020, 023:** Provide the seeded and mutable accounts listed in E1.
14. **REQ-FDI-015:** How should notifications be captured?
15. **REQ-FDI-044:** Can we get a Procore sandbox?
16. **REQ-FDI-907, 908, 909, Q-FDI-8:** Second project, developer data and a view-only account.
17. **REQ-PM-056:** Is the inspector audit trail in scope?
18. **REQ-PM-064:** Which endpoint returns the FDI question list?
19. **Not in the register (new):**
    - How should a denied FDI screen behave (hidden menu, redirect or message)?
    - Should supplier dropdown options be scoped?
    - What happens on direct-URL access to another inspector's or a completed form?
    - Can an FDI exist for a submittal without a supplier?
    - How should date-range validation work?
    - What do the per-permission flags (Manage Inspectors, Manage Questions, Sync to Procore) do?
20. **Register hygiene (for the automation owner, not the client):**
    - REQ-FDI-901 cites the nonexistent T543-01 and T543-05.
    - REQ-FDI-016, 029 and 030 cite skipped IDs as evidence.
    - REQ-FDI-007 claims "Passing" for filters that were never executed.

**Document Management:**
1. **REQ-DOC-004 (OBS-DOC-1/2):** What should "Uploaded By" show for PO files and system-generated PDFs?
2. **REQ-DOC-006 (SCP-DEF-011):** Must Spec Documents Download return the original file?
3. **REQ-DOC-011:** Is 60 MB confirmed? Which formats?
4. **REQ-DOC-009:** Please share the Spec Documents story, which defines the Spec Section No linkage.
5. **REQ-DOC-014 / REQ-DOC-015 / Q-DOC-3 / Q-PL-13:** Please provide sample PO and BOM files with their expected results.
6. **REQ-DOC-018 / Q-DOC-1:** Which EPD values must be extracted? Please provide a sample EPD.
7. **REQ-DOC-019, REQ-DOC-012:** Procore sandbox and TheLink access.
8. **New:**
   - Are documents scoped by organisation or role? "Files: List" is unticked for Project Admin, yet they see All Documents.
   - What are the search semantics for filename and category?
   - How does Spec Section No edit/clear work?
   - Is there a delete confirmation?
   - What is the "EPD Exists" link target?

# G. Suggested completion order

1. **Fix the automation's own false signals.** This is cheap and has high value.
   - **(a)** Remove or rewrite the assertions that contradict the register before the POM suite is run:
     - `rejectNonImage`: REQ-FDI-036 A.
     - Admin Assign expected at `filters.spec.js:49-52`.
     - `selfAssign` without a reload: REQ-FDI-017 D.
     - Drafts following new settings: REQ-FDI-041 D.
   - **(b)** Correct the register over-claims: T543-01/05, and the FDI-REG-02/03/11 citations.
   - **(c)** Fix the PM-REG-FDI-25a/42c duplicate IDs.
   - **(d)** Register T543-12 as a known defect, and mark DOC-REG-04 pending client.
   - Reason: the coverage numbers are currently overstated.
2. **Stabilise FDI-REG-06…10 and PL-REG-INT-01 data flow.**
   - Pass the exact run material and submittal; report Blocked instead of Skipped; make TC-20's negative check mandatory.
   - Reason: these are the only executed lifecycle tests for the confirmed core (Self Assign, Save, Submit, mandatory photo), and they pass only when upstream GRN generation works.
3. **Implement the A-rule gaps that need no new accounts:**
   - Sort order (GAP-FDI-023).
   - Supplier, positive inspector and date-bound filters (024, 025), ported to pm-flow or run from the POM.
   - Open without saving (039).
   - No View before completion (040).
   - PM-REG-FDI-05a…n settings effects on the form (029–034): the POM main spec already has most of the logic.
   - Deleted question absent from new forms (054).
   - PM-REG-FDI-26a (046).
   - T543-01/05 (052).
   - Spec Section No edit (GAP-DOC-009) and download name/size (GAP-DOC-014).
   - Reason: confirmed requirements, existing data, and largely existing code.
4. **Fix the timing in PM-REG-FDI-04 and the TC-18 inspector-row matching** (section D). Reason: these hide real regressions in FDI Settings and inspector mapping.
5. **Obtain the seeded accounts and fixture file (E1/E2), then build the permission matrix:**
   - GAP-FDI-001…008, 011–015, 020, 042, then GAP-DOC-015.
   - Reason: this is the highest business risk (cross-supplier data exposure) with zero executed coverage. It is blocked only on data, and the harness (`scp-fdi-access.spec.js`) already exists.
6. **Resolve the Assign permission question (REQ-PM-057), then automate Admin Assign, the dropdown and reassignment** (GAP-FDI-016…018, with SCP_FDI_REASSIGN_INSPECTOR). Reason: A-category stories with known defects whose root cause may be configuration.
7. **Set up the integrations:** notification capture (GAP-FDI-009), Procore (GAP-FDI-043, GAP-DOC-005), and the PO/BOM/EPD samples (GAP-DOC-003/004/006). Reason: external dependencies with a long lead time; start requesting them now.
8. **Handle the D/C items as client answers arrive** (section F): parameterised tests whose expected values are filled in once confirmed. Reason: no expected behaviour can be asserted until then.
9. **Run and publish the standalone POM FDI suite and the pending DOC spec regularly** (GAP-FDI-057). Reason: 24 FDI tests have no current evidence, and the DOC pending evidence dates from 25 Oct.
