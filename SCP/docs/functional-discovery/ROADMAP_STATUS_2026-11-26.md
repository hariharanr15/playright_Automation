# SCP automation v2.0 – roadmap and status, Thu 26 Nov 2026

_Goal: the full SCP application covered by automation on the redesigned staging build (24 Nov 2026), with v2.0 reports, for the client demo on **Friday 4 December 2026**. Staging · NRVC_Hall / Warehoust _NR (Inventory: NeuralRays_Demo / Location 1). Status as of Thu 26 Nov, 10:35 IST._

## 1. Where we are

**Overall: on track for 4 Dec, ahead of plan.** _Updated 26 Nov 20:10 IST after the second full regression (freeze rehearsal, 12:07–17:55) and re-runs._ Phases 0–5 are done (Phase 5 except Messages, which is blocked). What remains before the demo is mainly **answers from the dev team and client**, then the freeze run and reports.

| | Cases | Share |
|---|---|---|
| **Run in total** (all smoke + all regression incl. E2E, new pages, Inventory tab, P1 and P2 redesign suites) | **786** | 100% |
| Passed | **634** | 80.7% |
| Known Defect – registered application defects, the test reports them correctly | 44 | 5.6% |
| Failed – 9 **defect candidates** waiting for dev confirmation + TC-14 (custom fields removed on staging 26 Nov); no open test problem | 10 | 1.3% |
| Skipped – not run, each with a recorded reason and owner (section 4) | 98 | 12.5% |

"E2E full regression" (agreed 26 Nov) = the 33 E2E smoke cases (all 29 documented E2E scenarios + B/C variants) together with every module smoke and regression suite – the 778 above, one command: `npm run full:regression`.

### Phase status

| Phase | Planned | Status |
|---|---|---|
| 0. Discovery of the redesigned build | Tue 24 Nov | ✅ Done – walkthrough of every page and role |
| 1. Night run of the cases not yet run on the new build | Tue 24 Nov | ✅ Done – 437 run |
| 2. Triage + shared layer (navigation, page changes) | Wed 25 Nov | ✅ Done – every failure has a cause |
| 3. Fix P1 modules (Procurement Log, Project Management, User Mgmt, Dashboard, FDI) | Wed 25 – Mon 30 Nov | ✅ Done early (26 Nov) – new `p1` suite for the redesigned P1 features, 16 of 17 pass, 1 defect candidate |
| 4. Fix P2 modules (Documents, Shipments, Analytics, Enterprise) | Mon 30 Nov – Tue 1 Dec | ✅ Done early (26 Nov) – new `p2` suite, 28 of 32 pass, 4 defect candidates |
| 5. New pages – smoke | Wed 2 Dec | ✅ Mostly done (26 Nov) – My Work, Loads, NCRs, EPD Tracker, TOV, Excel Import, Inventory Rebuild 15/15; Messages blocked |
| 6. Build freeze + full regression overnight | Thu 3 Dec | ⏳ Planned |
| 7. Re-run failures + v2.0 reports, demo ready | Fri 4 Dec | ⏳ Planned |

### Done in the last 24 hours
- Overnight full run of all 18 suites (01:25–05:52): 728 cases; 9 test-side failures fixed and re-run green (FDI list and settings, FDI Config inspectors, Enterprise Supplier Inbox → My Work).
- New suites: **New pages smoke** (15/15), **Inventory tab** on NeuralRays_Demo (one record per run, 20 of 21 run cases pass), **P2 regression** (32 cases, 28 pass), **P1 redesign regression** (17 cases, 16 pass: Dashboard urgent issues and tiles, Procurement Log views, User Management, Supplier List).
- Full regression runner updated: all smoke suites first, then all regression suites incl. the new ones.
- Register of every non-passed case with owner and action: `NON_PASSED_REGISTER_2026-11-26.md`.

## 2. What is going on now

Nothing is running on staging at this moment. Phase 3 finished at 10:30 today. Until the answers arrive the automation work is:

| Activity | Duration | Finishes |
|---|---|---|
| Make the FDI tests independent of leftover data (inspections reused across runs, no free project member left) | ~0.5 day | Thu 26 Nov evening |
| Optional: a full overnight run tonight with the new `p1` and `p2` suites included (dry run of the 3 Dec freeze run) | ~6.5 h, unattended | Fri 27 Nov morning |

## 3. Pending – who does what

### 3a. From your side (QA lead)

| # | Item | Why it matters | Needed by |
|---|---|---|---|
| U1 | Send the open questions to the dev team (section 3b) and collect the answers | 10 defect candidates and 8 FDI cases wait on them | Fri 27 Nov |
| U2 | Client questions still open: Q1 which new pages are finished · Q3 Supplier Inbox – retire or move to My Work · Q4 My Work HTTP 500 · Q5 connect Delivery Management for Messages · Q6 writes on new pages / Inventory Rebuild · Q8 site upload location types · Q9 Shipments manual status removed | Each decides whether cases run, are retired or stay "not run" in the v2.0 report | Mon 30 Nov |
| U3 | Decide after the dev answers: register the confirmed candidates as Known Defects | They then show as Known Defect instead of Failed | Tue 1 Dec |
| U4 | Inventory: allow more than one record per run on NeuralRays_Demo (11 cases: move, loss, return, upload…), or keep them "one per session" on later days · a second storage location on NeuralRays_Demo (1 case) | Otherwise 12 Inventory cases stay Skipped in the demo | Mon 30 Nov |
| U5 | Approvals that change shared data (11 cases: shared roles, wizard on SCP_Testing_Ram, deletions…) and 1 site-deletion case (SITE-07) | Stay Skipped without an explicit go-ahead | Mon 30 Nov |
| U6 | Confirm the 4 Dec date and the build freeze on Thu 3 Dec with the dev team (no deploy to staging during the overnight run) | A deploy during the run invalidates it | Wed 2 Dec |
| U7 | Approve the commit of the v2.0 work (nothing is committed yet; repo is public) | Hand-over | Fri 4 Dec |

### 3b. From the dev team

| # | Item | Cases | Needed by |
|---|---|---|---|
| D1 | Confirm or reject 10 defect candidates: **PL-REG-TAB-05** "Issues" column twice in the Procurement Log views · **TC-23B** no "First delivery … received" task · **INV-REG-24** Inventory History date filter uses UTC · **SITE-10** duplicate location name accepted · **ROLE-05/08** Supplier menu shows Project Management without the permission · **SHP-REG-15** one delay alert ×136 per shipment · **SHP-REG-18** "at risk" counter ignores the Destination filter · **SHP-REG-20** 272 alert cards, 2 distinct · **ANV-AGG-10** values in $ on an INR project | 10 | Mon 30 Nov |
| D2 | FDI: why "Self Assign" was hidden 24–25 Nov (visible again on 26 Nov) – is it stable? | 8 cases now run again | Fri 27 Nov |
| D3 | Inventory questions: quantity in items (1 × White Cement = 25 Pounds) intended? "Add stock" shows "From location is required" under Into location; Received column 0 with a site selected | Inventory | Mon 30 Nov |
| D4 | "Couldn't load inventory." on heavy-data NRVC_Hall – fix planned? (tested on NeuralRays_Demo meanwhile) | 9 skipped on NRVC_Hall | info only |
| D5 | Test data / access: a second project in the NRVC_Hall organisation, a sample PO with line items and a sample BOM, a view-only and a Project-Admin-only account, the question-list API endpoint, the session permission list, which alerts the 05:00–06:00 batch creates | 15 skipped | Tue 1 Dec |
| D6 | Connect Delivery Management on staging so Messages can be tested | Messages | after 4 Dec is fine |
| D7 | Fixes of the 44 registered Known Defects (not needed for the demo – the tests report them correctly) | 44 | after 4 Dec |

### 3c. From my side (automation)

| # | Item | Duration | Dates |
|---|---|---|---|
| A1 | Phase 3 – checks for the redesigned P1 features | ✅ done | Thu 26 Nov |
| A2 | Make FDI tests independent of leftover data – done 26 Nov: run inspections first, then older unassigned inspections (user decision); any project member as inspector | done | Thu 26 Nov |
| A3 | Apply the dev / client answers: candidates → Known Defect or test change; retire or move Supplier Inbox cases; open skipped cases where data or approval arrives | 1–2 days (depends on answers) | Mon 30 Nov – Tue 1 Dec |
| A4 | Smoke for any further pages the client confirms as finished; Messages if connected | 0.5 day | Wed 2 Dec |
| A5 | Build freeze: record the build, re-crawl (6 min), start the overnight full regression | 0.5 h + run ~6.5 h overnight | Thu 3 Dec |
| A6 | Re-run remaining failures, refresh registers, v2.0 reports (build tested, results per module and priority, retired/moved/new cases vs v1.2, Known Defects, "not run – in development"), demo walkthrough | 0.5 day | Fri 4 Dec (by 13:00) |

## 4. Skipped cases (103) – why and who unblocks them

| Reason | Cases | Unblocked by |
|---|---|---|
| Covered by another case or suite (placeholders, counted twice) | 22 | Nobody – no action |
| One record per run on NeuralRays_Demo (Inventory) | 11 | You (U4) |
| Needs approval – changes shared data | 11 | You (U5) |
| Inventory on NRVC_Hall – covered on NeuralRays_Demo | 9 | Dev (D4) – no action for the demo |
| FDI Self Assign – dev question | 8 | Dev (D2) |
| Test data / locator – QA next step | 6 | Me (A3) |
| Client decision (Supplier Inbox, Shipments status) | 5 | Client (U2) |
| Two-day check (overnight alert batch) | 5 | Me – seed one day, verify the next morning |
| Test data / accounts / information from dev | 12 | Dev (D5) |
| Mailbox (YOPmail Cloudflare) – not automated by rule | 3 | Nobody – stays manual |
| External system (Procore / TheLink) | 3 | Nobody – out of scope |
| Manual / dropped by earlier decision, retired, single location, others | 8 | Mixed – see the register |

## 5. Timeline

| Date | Me (automation) | You | Dev team / client |
|---|---|---|---|
| **Thu 26 Nov** (today) | ✅ overnight run triaged, ✅ P2 suite, ✅ P1 redesign suite; FDI data independence; optional overnight dry run | Send dev + client questions (U1, U2) | Receive questions |
| **Fri 27 Nov** | Triage the overnight dry run; start applying any answers received | Follow up answers | D1, D2 answers |
| Sat 28 – Sun 29 Nov | – (optional unattended re-run if asked) | – | – |
| **Mon 30 Nov** | Apply answers (A3) | Decisions U3–U5 | D3, D5 answers; client Q1–Q9 |
| **Tue 1 Dec** | Apply answers, re-run affected suites (A3) | Register confirmed defects (U3) | Remaining answers |
| **Wed 2 Dec** | New-page smoke for confirmed pages (A4); dry run of the full runner on a subset | Confirm freeze (U6) | No deploy after the evening |
| **Thu 3 Dec** | Freeze, re-crawl, **full regression overnight** (~7.3 h, 786 cases) (A5) | – | **No staging deploy** |
| **Fri 4 Dec** | Re-run failures, v2.0 reports and registers by 13:00 (A6) | Review, approve commit (U7); **client demo** | – |
| After 4 Dec | Full flows for the new delivery management: build load → receive → allocate → discrepancy → NCR (5–7 days, ~14–16 Dec); Excel Import, EPD Tracker, My Work task flows; Messages once connected | Prioritise | Known Defect fixes (D7) |

## 6. How long the runs take

| Run | Duration |
|---|---|
| All smoke suites (PL, PM, other modules, new pages, Inventory tab) | ~25 min |
| E2E smoke (33 cases, creates one supplier, subcontractor and submittal set per run) | ~47 min |
| All regression suites (PL 1–3, PM 1–2, other modules, FDI settings, roles, tickets, Analytics/Enterprise, P1, P2) | ~4 h 45 min |
| **Full regression (`npm run full:regression`, with video and step screenshots)** | **~6 h 45 min** – run overnight |
| International Shipments page load alone | 2–5 min each time (slow page, noted for the dev team) |

## 7. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| Dev answers arrive late | Candidates stay "Failed" in the demo report | Report them as "defect candidate – awaiting confirmation", not as test failures |
| Staging deploy during the 3 Dec run | Results invalid | Freeze agreed with dev (U6); re-crawl first to detect changes |
| FDI test data runs out (inspections, free members) | FDI cases skip or fail | Fixed (A2): fallback to the 49 older unassigned inspections; any member as inspector |
| Slow International Shipments page | Shipments cases time out | 6-minute wait built in; flagged to dev |
| Client changes more pages before 4 Dec | New failures | Re-crawl (6 min) shows what changed; fix by priority |

_Prepared from the test results only. Nothing committed, nothing written to Jira. Detailed lists: `NON_PASSED_REGISTER_2026-11-26.md` (every non-passed case), `ROADMAP_V2_2026-12-04.md` (working checklist)._
