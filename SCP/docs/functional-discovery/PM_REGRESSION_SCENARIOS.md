# Project Management – Regression Scenarios (Draft for Review)

Source of truth: [PM_FUNCTIONAL_DISCOVERY.md](PM_FUNCTIONAL_DISCOVERY.md). Smoke scenarios ([PM_SMOKE_SCENARIOS.md](PM_SMOKE_SCENARIOS.md)) are assumed to pass first.

## Legend

| Column | Values |
|---|---|
| **Type** | POS positive · NEG negative · BND boundary · ROLE role-based · INT cross-module integration |
| **Impact** | **R** read-only · **C** client-side only (changes discarded by Cancel/reload) · **M** mutates staging data (**needs approval before execution**) |
| **Ev.** | Evidence for the *expected result*: **O** observed 2026-10-30 · **D** documented requirement · **A** existing automation expectation · **I** inferred, **unverified – confirm before automating** |

## Common prerequisites

- PR-1 Admin login on NRVC_Hall (Smoke 001).
- PR-2 Run-unique suffix `<RUN>` for every created name (e.g. `PM-REG-<yyyyMMddHHmm>`), so data never collides with other runs.
- PR-3 **M** scenarios are approved for automation on **NRVC_Hall** (product owner, 2026-10-30, rule R1). Settings changes (Config Options, FDI Settings, PreShipping, Log Config) must still restore their original values, because other modules depend on them. Created records are **never deleted** (R14), so every created name must carry the `<RUN>` suffix.
- PR-4 For **ROLE** scenarios: role access is configuration-based (R9), set per page as View/Edit (R41). All users log in at the same URL (R16). Accounts in `SCP/.env`: Project Admin, Supplier, Subcontractor and Org Admin (`SCP_ORG_ADMIN_USERNAME` / `SCP_ORG_ADMIN_PASSWORD`, added 30 Oct). Only the Supplier and Subcontractor roles may be changed, and must be restored (R42). Use a separate browser context per role.

Rule references **R1–R52** point to the product-owner clarifications in [PM_FUNCTIONAL_DISCOVERY.md §1a](PM_FUNCTIONAL_DISCOVERY.md#1a-product-owner-clarifications-2026-10-30). Where a rule exists, the expected result is confirmed even if the exact message text is not yet known.

## Test data needed

| Data | Source | Used by |
|---|---|---|
| Unique utility/UoM/category/material/site/field/question names | generated `<RUN>` | Reference data, Master data |
| Existing `currency_type` utility | NRVC_Hall (e.g. `INR - Indian Rupees`) | Config Options |
| Existing material with items | Material Master | Inventory Control |
| Yopmail address `pm.<RUN>@yopmail.com` | generated | FDI Invite |
| Upload templates (.xlsx) | `Download Template` on Material Master / Site Details | Upload scenarios |
| Role accounts | `.env` | ROLE scenarios |

---

## 1. Navigation and project context

| ID | Title | Type | Impact | Steps | Expected | Ev. |
|---|---|---|---|---|---|---|
| PM-REG-NAV-01 | Every PM leaf opens its route | POS | R | Click each of the 17 leaves | URLs: `/booking-integration`, `/thelink-integration`, `/xer-import`, `/common-utilities`, `/common-uom`, `/material-category`, `/configuration-options`, `/first-delivery-inspection-config`, `/inventory-control`, `/material-master`, `/preshipping-checklist`, `/bulk-upload-status`, `/procurement-log-configuration`, `/site-details`, `/submittal-manager`, `/system-messages`, `/watched-materials`; active item is highlighted. **30 Oct: XER Import and Watched Materials open but are not highlighted (the other 15 are) → DEF-C8** | O |
| PM-REG-NAV-02 | Group buttons expand without navigating | POS | R | Click `Project Management`, `Integrations`, `Reference Data` | Children appear; URL unchanged | O |
| PM-REG-NAV-03 | Direct URL access with an active session | POS | R | `goto` each route above | The same page renders without re-login | I |
| PM-REG-NAV-04 | Setup Wizard hidden once setup is complete | POS | R | On NRVC_Hall (setup complete): check the PM menu; `goto /setup-wizard` | `Setup Wizard` is not in the menu; the URL opens `Project Setup` with 9 steps in [D] order, all ✓, "Setup complete" | O, business rule confirmed 2026-10-30 |
| PM-REG-NAV-07 | Setup Wizard shown while setup is incomplete | POS | R | Switch to **SCP_Testing_Ram** → open the PM menu → click `Setup Wizard` | `Setup Wizard` is the first PM item; opens `/setup-wizard` with completed steps ✓ and the first open step active (on 30 Oct: step 3 "Core project settings") | O, R10, R18 |
| PM-REG-NAV-08 | Setup Wizard disappears after completion | POS/INT | M | Complete the remaining wizard steps on an unconfigured project → return to the menu | `Setup Wizard` no longer listed (check with and without reload) | R10, R18, R23 – SCP_Testing_Ram approved |
| PM-REG-NAV-09 | Wizard data matches module pages | INT | M | In the wizard, add a site, category and material (unique `<RUN>` names) → open Site Details, Material Category, Material Master | The same records are listed on each module page (the wizard uses the same functions) | R10, R18, R23 – SCP_Testing_Ram approved |
| PM-REG-NAV-05 | PM data is project-scoped | INT | R | Note one System Message title on NRVC_Hall; switch to `SCP_Testing_Ram`; open System Messages | The NRVC_Hall message is not listed ("scoped to the current project") | O (text), I (behavior) |
| PM-REG-NAV-06 | Unauthenticated access is redirected | NEG | R | New context without login → `goto /material-master` | Redirect to login / no PM data shown | I |

## 2. Integrations

| ID | Title | Type | Impact | Steps | Expected | Ev. |
|---|---|---|---|---|---|---|
| PM-REG-INT-01 | Booking: SCP Project ID pre-filled | POS | R | Open Booking Integration | `SCP Project ID` matches `PRJ…` format, non-empty | O |
| PM-REG-INT-02 | Booking: submit with empty Booking ID | NEG | M? | Leave `Booking System Project ID` empty → `Submit` | Validation prevents linking (message text unknown) | I |
| ~~PM-REG-INT-03~~ | Booking: link valid Booking ID | – | – | **Deferred: Booking System ID not used for now; manual booking entry only (R24)** | – | – |
| ~~PM-REG-INT-04~~ | TheLink: no credentials status | – | – | **Deferred: out of scope (R7)** | – | – |
| ~~PM-REG-INT-05~~ | TheLink: API key is masked | – | – | **Deferred: out of scope (R7)** | – | – |
| ~~PM-REG-INT-06~~ | TheLink: link without credentials | – | – | **Deferred: out of scope (R7)** | – | – |
| PM-REG-INT-07 | XER: existing plan listed | POS | R | Open XER Import | ≥ 1 plan with "`<visible>/<total>` visible · `<n>` mapped" and a date | O |
| PM-REG-INT-08 | XER: reject unsupported file type | NEG | M? | `Import` → choose a `.txt` file | Rejected; only `.xer`/`.xml` accepted | I |
| PM-REG-INT-09 | XER: import → select two tasks → Save | POS | M | `Import` → choose the test `.xer` → if "Plan already imported" appears, click `Open existing plan` → `Manage tasks` → pick **two tasks not currently visible** (search by Task ID, click the **row**) → check "2 of `<total>` selected" and `Save (2 tasks)` → Save | Message "2 tasks set to visible."; dialog closes; plan view lists exactly those two Task IDs with Duration and Planned Finish, status `Unmapped`; header "2/`<total>` visible" | O (30 Oct), R50 |
| PM-REG-INT-10 | XER: duplicate file detected by content | NEG | R/C | Import a file whose content matches an existing plan (different file name) | "Plan already imported" dialog naming the existing plan, with `Open existing plan` / `Import anyway`; no plan created until a button is chosen | O |
| PM-REG-INT-11 | XER: Open existing plan creates no copy | POS | R | In the INT-10 dialog click `Open existing plan` | Existing plan opens; plan list count unchanged | O |
| PM-REG-INT-12 | XER: Manage tasks filters | POS | R | In `Manage tasks`: search a Task ID; filter WBS = `CMDA`; type = `TT_FinMile` | Only matching rows; counter shows the selection, not the filter count; `Select all matching (n)` reflects the filter | O (options), I (filter results) |
| PM-REG-INT-13 | XER: Save disabled/no-op with 0 selected | NEG | C | Open `Manage tasks` with nothing ticked | Button reads `Save (0 tasks)`; saving zero tasks is blocked or leaves the plan unchanged | O (label), I (behavior) |
| PM-REG-INT-14 | XER: selection persists across search | POS | C | Tick task A, change the search, tick task B, clear search | Both A and B still ticked; counter 2 | O |
| PM-REG-INT-15 | XER: Save sets the visible set to the selection | INT | M | Note the visible tasks (A, B) → Manage tasks → select two other tasks (C, D) → Save | Only C and D visible (current behavior, R50) | O |
| PM-REG-INT-16 | XER: row click selects a task | POS | C | In `Manage tasks` click a task row; then click another row's checkbox | Row click: task ticked, counter +1. Checkbox click: does not tick (accepted for now, **SCP-DEF-024** – failure message must match `XER task checkbox click did not select the task`) | O, R63 |
| ~~PM-REG-INT-17~~ | XER: Import anyway creates a separate copy | – | – | **Deferred: creates a 15,860-task copy; existing flow uses Open existing plan (R50)** | – | – |
| ~~PM-REG-INT-18~~ | XER: first import shows Task Selection first | – | – | **Deferred: XER requirement unclear (R50)** | – | – |
| PM-REG-INT-19 | XER: Task Selection columns | POS | R | Open Manage tasks | Columns `WBS`, `Task ID`, `Task Name`, `Type`, `Planned Start`, `Planned Finish` | O, R50 |
| PM-REG-INT-20 | XER: visibility survives refresh | POS | R | After INT-09, reload the browser page and reopen the plan | Same tasks visible; "`<n>`/`<total>` visible" unchanged | D XR-08, O ✅ |
| PM-REG-INT-21 | XER: Manage tasks opens with nothing ticked | POS | C | With tasks visible, open Manage tasks → Cancel | "0 of `<total>` selected" (current behavior); Cancel leaves the plan unchanged | O, R50 |
| ~~PM-REG-INT-22~~ | XER: Reload clears mappings and visibility | – | – | **Deferred: XER requirement unclear (R50)** | – | – |
| ~~PM-REG-INT-23~~ | XER: hiding a task keeps its mapping | – | – | **Deferred: XER requirement unclear (R50)** | – | – |
| ~~PM-REG-INT-24~~ | XER: warning before reload | – | – | **Deferred: XER requirement unclear (R50)** | – | – |
| PM-REG-INT-25 | XER: available filters | POS | R | Open Manage tasks; list the filter controls | Search `Search task name or ID…`, WBS (`All WBS` + WBS names), Type (`All types`, `TT_FinMile`, `TT_Task`, `TT_Mile`, `TT_LOE`); no date filter (current behavior) | O, R50 |

## 3. Reference Data

| ID | Title | Type | Impact | Steps | Expected | Ev. |
|---|---|---|---|---|---|---|
| PM-REG-REF-01 | Utilities search by name | POS | R | Search `INR` | Only rows containing "INR" in Name or Type; count text updates | O |
| PM-REG-REF-02 | Utilities search by type | POS | R | Search `currency` | All rows have type `currency_type` | O |
| PM-REG-REF-03 | Utilities no-match search | NEG | R | Search `zzqq-no-match` | `0 items`, `No data found`, `No results for "zzqq-no-match"` | O |
| PM-REG-REF-04 | Utility Type dropdown options | POS | R | Open Add → Type | Contains the 14 types listed in discovery §5.4; any additional types are recorded | O |
| PM-REG-REF-05 | Add utility – required fields | NEG | C/M | Open Add; click `Add` with (a) both empty, (b) name only, (c) type only | Not created; required-field feedback (text unknown) | I |
| PM-REG-REF-06 | Add utility – happy path | POS | M | Name `Curr <RUN>`, type `currency_type` → `Add`; search name | Row shown with type `currency_type`; count +1 | A |
| PM-REG-REF-07 | New currency utility appears in Configuration Options | INT | M | After REF-06, open Config Options → Currency Type | `Curr <RUN>` is in the list | O (source), I (timing) |
| PM-REG-REF-08 | Edit utility name | POS | M | Row **⋮** → Edit → new name → save; search | Updated name shown, old name gone | A, R28 |
| PM-REG-REF-09 | Duplicate utility name | NEG | M | Add an existing utility name again (also with extra spaces / different case) | Rejected; no second row; count unchanged | R2, R15 (message text I) |
| PM-REG-REF-10 | Utility name boundary | BND | M | Name with 1 char; 255 chars; leading/trailing spaces; special chars `&<>"'` | Accepted/trimmed/rejected per rule; no script execution | I |
| PM-REG-REF-11 | Modal close behavior | POS | C | Open Add; press Escape; then click X | Escape does **not** close (OBS-6); X closes; nothing created | O |
| PM-REG-REF-12 | Add UoM – required | NEG | C/M | `Add UOM` → `Add` with empty name | Not created | I |
| PM-REG-REF-13 | Add + edit UoM | POS | M | Create `UoM <RUN>`; edit to `UoM <RUN> E`; search | Edited name listed | A |
| PM-REG-REF-14 | New UoM available in Add Material | INT | M | After REF-13, Material Master → Add → UOM | `UoM <RUN> E` is selectable | I |
| PM-REG-REF-15 | Add Material Category – required | NEG | C/M | Add with empty Name | Not created | I |
| PM-REG-REF-16 | Add + edit Material Category | POS | M | Create `Cat <RUN>`; edit; search | Edited name listed | A |
| PM-REG-REF-17 | New category flows downstream | INT | M | After REF-16: Add Material → Category; New Question Set → categories; Watched Materials → Add watch → Category | `Cat <RUN>` is present in all three | O (sources), I (each) |
| PM-REG-REF-18 | Load Defaults | POS | M | Click `Load Defaults` on NRVC_Hall | All available default categories added; existing names not duplicated | R30, R2 |
| PM-REG-REF-19 | Search on UoM and Category lists | POS/NEG | R | Search an existing name, then a no-match term | Filtered rows; empty-state message | O (Utilities), I (others) |
| PM-REG-REF-20 | Duplicate UoM name | NEG | M | Add an existing UoM name; then with leading/trailing spaces; then in different case | All rejected; count unchanged | R2, R15 |
| PM-REG-REF-21 | Duplicate Material Category name | NEG | M | Add an existing category name | Rejected (also with extra spaces / different case); count unchanged | R2, R15 |
| PM-REG-REF-22 | Edit to an existing name | NEG | M | Edit an owned UoM/category to another existing name | Rejected; original name kept | R2 |
| PM-REG-REF-23 | Delete from the ⋮ menu | POS | M | Create `Del <RUN>` (utility, UoM, category) → row ⋮ → Delete → confirm | Row removed; search finds nothing. Only records created for this test are deleted | R36, R14 |
| PM-REG-REF-24 | Common UoM belongs to the project | INT | M | Create `UoM <RUN>` on NRVC_Hall → switch to SCP_Testing_Ram → Common UoM → search | Not listed on SCP_Testing_Ram; still listed on NRVC_Hall | R64 |
| PM-REG-REF-25 | Material Category belongs to the project | INT | M | Create `Cat <RUN>` on NRVC_Hall → switch to SCP_Testing_Ram → Material Category → search; also its Add Material category list | Not listed on SCP_Testing_Ram; still listed on NRVC_Hall | R64 |

## 4. Configuration Options

| ID | Title | Type | Impact | Steps | Expected | Ev. |
|---|---|---|---|---|---|---|
| PM-REG-CFG-01 | Current values render | POS | R | Open page | Week values shown and not negative; Archive, Currency and Integration values shown (read and record, not hard-coded) | O, R69 |
| PM-REG-CFG-02 | Dropdown option sets | POS | R | Open each dropdown | Archive: 30/60/90/120/150/180/360 days; Integration: None/Procore/Autodesk ACC; Currency: all `currency_type` utilities | O |
| PM-REG-CFG-03 | Cancel discards changes | POS | C | Change one week value and one toggle → `Cancel` (or reload) | Original values shown. **30 Oct: Cancel shows 0/0/0 instead of the saved 1/1/1 (even with no edit); nothing is saved, reload shows 1/1/1 → DEF-C7** | I |
| PM-REG-CFG-04 | Save and persist alert weeks | POS | M | Alternate the three week values (e.g. 1↔2) → `Save` → reload | New values persist; restore originals afterwards | A |
| PM-REG-CFG-05 | Save and persist currency | POS | M | Switch currency → Save → reload; restore | Persisted | A |
| PM-REG-CFG-06 | Week field – non-numeric and negative | NEG | M? | Enter `abc`, then `-1` → Save | Rejected; value not saved | R69 (message text I) |
| PM-REG-CFG-07 | Week field – boundaries | BND | M? | Enter `-1` → Save (rejected); then `0`, `1` and a large value (e.g. `52`) → Save | `-1` rejected; `0`, `1` and `52` saved; restore the original | R69 (empty value I) |
| PM-REG-CFG-08 | Toggle persistence | POS | M | Flip `LLM Material Categorization` → Save → reload; restore | Persisted | I |
| PM-REG-CFG-09 | Pre-Shipping toggle gates checklist | INT | M | Turn Pre-Shipping Off → Save; check Procurement Log delivery approval; restore | Delivery approval no longer requires the checklist | I – **high risk on shared data** |
| PM-REG-CFG-10 | GRN toggle effect | INT | M | Turn GRN Off → check delivery GRN options; restore | GRN not offered | I |
| PM-REG-CFG-11 | Archive period effect | INT | M | Change Archive to 60 days | Dashboard hides read items older than 60 days | I |
| PM-REG-CFG-12 | Help icons | POS | R | Click each `?` (30 Oct: the tooltip opens on click; hovering shows nothing) | Help text shown; week-setting texts as in R19 | O, R19 |
| PM-REG-CFG-13 | Not-ordered alert triggers | INT | M | Set `Not ordered alert (weeks)` = 1; create a submittal with ROS = today + 6 days, leave it Not Ordered; verify the next day after the batch (~05:00–06:00 IST) | Alert on Management Dashboard; email to the PO creator | R19, R21 (ANT-06); two-phase test: seed day 1, verify after the ~05:00–06:00 IST batch |
| PM-REG-CFG-14 | Not-booked alert triggers (only on a booking-linked project; otherwise Not Applicable) | INT | M | Set `Not booked alert (weeks)` = 1; ordered schedule line with ROS = today + 6 days and no booking reference; verify the next day after the batch (~05:00–06:00 IST) | Alert on CC; SC task due today + 2 days | R19, R21 (ANT-13); booking API Q-ANT-6 |
| PM-REG-CFG-15 | Lead time not confirmed alert | INT | M | Set `Lead time confirmation (weeks)` = 1; submittal with ROS = today + 6 days and no confirmed lead time; verify the next day after the batch (~05:00–06:00 IST) | 'Lead time not confirmed' alert on Management Dashboard; SC task set to Delayed (red, bold) | R19, R21 (ANT-05) |
| PM-REG-CFG-16 | No alert before threshold | NEG | M | Same as CFG-13…15 but ROS = today + 3 weeks (outside the 1-week window); also an ordered / booked / confirmed control item | No alert raised | R11, R19 |
| PM-REG-CFG-17 | Unconfigured settings: in-app only | NEG/INT | M | On a project with these settings not configured, create the triggering condition | No message or email sent to anyone; the user still gets the in-app notification and alert | R12, R23 – SCP_Testing_Ram (Project Config step not done) |
| PM-REG-CFG-18 | Currency is set per project | INT | M | Record NRVC_Hall's Currency Type → on SCP_Testing_Ram choose a different currency in Configuration Options → Save → back on NRVC_Hall open Configuration Options and the Management Dashboard spend figures; restore SCP_Testing_Ram | NRVC_Hall keeps its own currency and its amounts are unchanged; SCP_Testing_Ram uses the new one. Both projects offer the same shared currency list | R58 |

## 5. First Delivery Inspection Config

### 5a. FDI Settings

Requirements: **FDI Config – FDI Settings** (AC-1…7, `docs/FDI_SETTINGS_REQUIREMENTS.md`, re-supplied by the product owner 30 Oct) and the companion **FDI Inspection Report** story (IR-AC-1…16, `docs/FDI_INSPECTION_REPORT_REQUIREMENTS.md`). The inspection-report checks run in the First Delivery Inspections module on the run's delivery, but are driven by these PM settings.

| Requirement | Scenarios |
|---|---|
| AC-1 heading "FDI Settings" | FDI-01 |
| AC-2 four exact labels | FDI-01 |
| AC-3 checked = Yes / unchecked = No, persisted via Save | FDI-04 |
| AC-4 reload shows the saved state | FDI-03, FDI-04 |
| AC-5 defaults all No on an unconfigured project | FDI-07 |
| AC-6 mandatory photos only with uploads on | FDI-02, FDI-02a, FDI-02b |
| AC-7 per project | FDI-06 |
| IR-AC-1/2 Observation/Notes shown / hidden | FDI-05a |
| IR-AC-3/4 Photos section shown / hidden | FDI-05b, FDI-05g |
| IR-AC-5 file types (now: all common formats, R66) | FDI-05h |
| IR-AC-6 thumbnails in edit and view | FDI-05i |
| IR-AC-7 full-size viewer with Previous/Next | FDI-05j |
| IR-AC-8/9/10 mandatory photo: Submit blocked, Save allowed / Submit with photo / not mandatory | FDI-05c, FDI-05b |
| IR-AC-11/15 spec documents shown / hidden | FDI-05d |
| IR-AC-12 spec document opens in a viewer | FDI-05k |
| IR-AC-13 Spec Section No with no documents → empty state | FDI-05l |
| IR-AC-14 no Spec Section No → exact message | FDI-05m |
| IR-AC-16 changes apply to new reports; completed reports unchanged | FDI-05n |

| ID | Title | Type | Impact | Steps | Expected | Ev. |
|---|---|---|---|---|---|---|
| PM-REG-FDI-01 | Section title and labels | POS | R | Open FDI Config | Heading `FDI Settings`; no `Notification Settings` heading; four checkboxes with exactly: `Need Overall Notes to be captured`, `Enable Uploading of Photos?`, `Photos are mandatory?`, `Provide Link to Submittal Spec Documents?`; `Save` button | O (NRVC_Hall, SCP_Testing_Ram), D AC-1/2 |
| PM-REG-FDI-02 | Mandatory photo depends on uploads | NEG | C | Untick `Enable Uploading of Photos?` | `Photos are mandatory?` becomes unchecked **and disabled**; photos not mandatory | O, D AC-6, R3 |
| PM-REG-FDI-02a | No contradictory state is saved | NEG | M | Untick `Enable Uploading of Photos?` → Save → reload | Uploads = No, Mandatory = No (disabled); restore the original values | D AC-6 |
| PM-REG-FDI-02b | Re-enabling uploads re-enables the mandatory box | POS | C | After FDI-02, tick `Enable Uploading of Photos?` again | `Photos are mandatory?` enabled again (left unticked until the user ticks it) | D AC-6, I (auto-tick behavior) |
| PM-REG-FDI-03 | Unsaved change discarded on reload | POS | C | FDI-02 then reload | Saved values restored | O |
| PM-REG-FDI-04 | Save persists each setting (Yes and No) | POS | M | For each of the four checkboxes: tick → Save → reload → check; untick → Save → reload → check (mandatory only while uploads is ticked); restore the original values | Each checkbox shows exactly the saved state after reload: ticked = Yes, unticked = No | D AC-3/4, A |
| PM-REG-FDI-05a | Overall Notes setting controls the Observation/Notes field | INT | M | Tick `Need Overall Notes to be captured` → Save → open the run's FDI inspection form; then untick → Save → reopen; restore | Yes: an `Observation/Notes` free-text field at the **end** of the form. No: the section does not appear anywhere | R53, D IR-AC-1/2 |
| PM-REG-FDI-05b | Photo not mandatory: submit without a photo | INT | M | Tick `Enable Uploading of Photos?`, untick `Photos are mandatory?` → Save → open the form → Photos section present → fill without a photo → Submit; restore | Photos section available; Submit succeeds without a photo, no photo validation message | R54, D IR-AC-3/10 |
| PM-REG-FDI-05c | Photo mandatory: Submit blocked, Save allowed | INT/NEG | M | Tick uploads + `Photos are mandatory?` → Save → fill the form without a photo → **Save** (draft) → **Submit**; then add a photo → Submit | Save succeeds without a photo. Submit without a photo: validation message, not submitted. With a photo: submitted | R54, D IR-AC-8/9, AC-6, A |
| PM-REG-FDI-05d | Spec document link setting | INT | M | Delivery whose submittal has a Spec Section No with linked documents → tick / untick `Provide Link to Submittal Spec Documents?` → Save → open the form | Yes: the linked documents shown as thumbnails with file names. No: the spec document section does not appear | R53, D IR-AC-11/15 |
| PM-REG-FDI-05e | Enabled questions appear in the form | INT | M | Add question `FDI Q <RUN>` (Text) to the question set that covers the delivery's material → open the form | `FDI Q <RUN>` shown with a text answer field, in the set's order (grouped questions first, ungrouped last) | A (existing automation), O (order note) |
| PM-REG-FDI-05f | Deleted / other-set questions don't appear | INT/NEG | M | Delete `FDI Q <RUN>` (FDI-42); also check a question that belongs only to another category's set → open a new inspection form | Neither question shown | I (existing reports keep their questions – order note in FDI Config) |
| PM-REG-FDI-05g | Uploads off: no Photos section | INT | M | Untick `Enable Uploading of Photos?` → Save → open a **new** FDI inspection form; restore | No Photos section on the form | R59, D IR-AC-4 |
| PM-REG-FDI-05h | Photo upload formats | INT | M | Uploads on → in the form upload one file each: `.jpg`, `.png`, `.pdf`, `.xlsx`, `.csv` | All accepted and listed on the report | R66 (replaces IR-AC-5 "non-images rejected"); size/count limits unknown (Q-FDI-2) |
| PM-REG-FDI-05i | Photo thumbnails in edit and view | INT | M | Upload two photos → Save → reopen in edit; then view the submitted report | Thumbnails shown in both edit and view modes | D IR-AC-6 |
| PM-REG-FDI-05j | Photo viewer with Previous/Next | INT | M | Click a thumbnail → use Next / Previous | Full-size popup; arrows move through all the report's photos without closing | D IR-AC-7, A (`scp-fdi-photo-viewer.spec.js`) |
| PM-REG-FDI-05k | Spec document viewer | INT | M | With spec link on, click a spec document thumbnail | Document opens in a popup viewer | D IR-AC-12 |
| PM-REG-FDI-05l | Spec Section No without documents | INT/NEG | M | Spec link on; delivery whose submittal has a Spec Section No but no linked documents → open the form | Clear "no documents" state; no error | D IR-AC-13 (exact text I) |
| PM-REG-FDI-05m | Submittal without Spec Section No | INT/NEG | M | Spec link on; delivery whose submittal has an empty Spec Section No → open the form | Exactly `No Spec Section No provided in submittal.`; no error | D IR-AC-14 |
| PM-REG-FDI-05n | Setting changes apply going forward only | INT | M | Submit a report with Overall Notes on → turn Overall Notes off → Save → open the submitted report and a new one | Submitted report unchanged; new report follows the new setting | D IR-AC-16 (effect on saved drafts – Q-FDI-2) |
| PM-REG-FDI-06 | Settings are per project | INT | M | Record both projects' settings → change one setting on SCP_Testing_Ram → Save → switch to NRVC_Hall → FDI Config; restore | NRVC_Hall unchanged (on 30 Oct: Hall = No/Yes/Yes/Yes, Ram = No/No/No/No) | O, D AC-7, R23 |
| PM-REG-FDI-07 | Defaults on an unconfigured project | POS | R | Switch to SCP_Testing_Ram → FDI Config (run before any FDI-settings change there) | All four unticked; `Photos are mandatory?` disabled | O (30 Oct), D AC-5 |

### 5b. Inspectors

Requirement: **FDI Config – Inspectors section** (product owner, 30 Oct): multiple inspectors, invite integration, material mapping, enable/disable, pending-invite handling. Acceptance criteria INS-AC-1…10 (INS-AC-11, audit trail, is out of scope – R67):

| Requirement | Scenarios |
|---|---|
| INS-AC-1 add person + role → new row, existing rows untouched | FDI-25 |
| INS-AC-2 repeat any number of times, one row each | FDI-25 |
| INS-AC-3 row shows name, role, material mapping, enabled status, invite status | FDI-10 |
| INS-AC-4 Invite opens the standard project invite screen | FDI-11…17 |
| INS-AC-5 every invited person appears as a new row automatically | FDI-18, FDI-26 |
| INS-AC-6 invited rows "Invited - Pending Acceptance" and disabled until accepted | FDI-18, FDI-26, FDI-29a |
| INS-AC-7 accepting the invite makes the row active/enabled | FDI-18 |
| INS-AC-8 map one or more materials or "All Materials"; saved and editable | FDI-20, FDI-22, FDI-24, FDI-27 |
| INS-AC-9 enable/disable at any time without deleting the record or history | FDI-23 |
| INS-AC-10 a disabled inspector is not offered for self-assign on FDI records | FDI-18, FDI-28 |

Test cases **BUGS-198 (FDI-Setup-InspectorsDefinition)**, supplied by the product owner on 30 Oct (`BUGS-198_TestCases_FDI-Setup-InspectorsDefinition.xlsx`, 17 cases), are all covered. The spreadsheet's "Save" / "toggle" steps map to the UI's `Add` button and the row's `Disable` / `Enable` action.

| BUGS-198 test case | Scenario |
|---|---|
| TC-198-01 Add a single inspector | FDI-25 (first add) |
| TC-198-02 Add three inspectors one after another | FDI-25 |
| TC-198-03 Row shows name, role, materials, enabled, invite status | FDI-10 |
| TC-198-04 Invite opens the project invite screen | FDI-11 |
| TC-198-05 Invited person is added automatically as Pending | FDI-18, FDI-26 |
| TC-198-06 Invite several people in one action | FDI-26 |
| TC-198-07 New invite defaults to Disabled | FDI-26, FDI-29a |
| TC-198-08 Inspector enables automatically after acceptance | FDI-18 |
| TC-198-09 Map one material | FDI-27 |
| TC-198-10 Map several materials | FDI-27 |
| TC-198-11 "All Materials" | FDI-27, FDI-25 |
| TC-198-12 Edit the material mapping | FDI-24 |
| TC-198-13 Disable (record kept) | FDI-23 |
| TC-198-14 Re-enable (record intact) | FDI-23 |
| TC-198-15 Disabled inspector not offered for self-assign | FDI-28 |
| TC-198-16 Person and Role required | FDI-21 |
| TC-198-17 List kept after navigating away | FDI-25a |

Implementation sub-stories for the Inspectors section (product owner, 30 Oct) – acceptance criteria and scenarios:

| Sub-story | Acceptance criterion | Scenario | Observed 30 Oct |
|---|---|---|---|
| ST-1 Inspectors table | One row per inspector: name, role, material summary, enabled status, invite status | FDI-10 | Matches |
| ST-1 | Add Inspector adds a row without removing others | FDI-25 | – |
| ST-1 | Saved through the new multi-inspector API, not the old `saveFDIConfig` upsert | FDI-25b | Not checked |
| ST-1 | Zero, one and many rows display correctly | FDI-25c | One (SCP_Testing_Ram) and 74 (NRVC_Hall) display; zero not available |
| ST-2 Invite integration | Invite modal adds a disabled "Invited - Pending Acceptance" row per person | FDI-26 | – |
| ST-2 | Row becomes active/enabled on next fetch/reload after acceptance | FDI-18 | – |
| ST-2 | Invite elsewhere (User Management) unaffected | FDI-26a | – |
| ST-3 Material mapping | Each row has a control to open a multi-select of project materials | FDI-24, FDI-27 | `Edit materials` pencil on each row |
| ST-3 | "All Materials" disables/clears the specific-material selection | FDI-27 | – |
| ST-3 | Saved mapping shown as a readable summary | FDI-10, FDI-27 | Chips: `All Materials`, `Cement · all`, material names with `+2 more`; `—` on some pending invites (Q-FDI-6) |
| ST-3 | Mapping editable after save | FDI-24 | – |
| ST-4 Enable/disable | Toggle reflects and controls active state | FDI-23 | `Disable` / `Enable` button + Enabled column |
| ST-4 | Disabling keeps the row and history | FDI-23 | – |
| ST-4 | Status clearly distinguishes Active, Disabled, Invited - Pending Acceptance | FDI-10 | Disabled inspectors show Status `Active` + Enabled `Disabled` (Q-FDI-5) |
| ST-4 | Toggle disabled/hidden on pending-invite rows | FDI-29a | **Matches:** `Enable` disabled, tooltip "Activates automatically once the invite is accepted" |
| ST-5 Self-assign | Self-assign excludes disabled and pending-invite inspectors | FDI-28 | – |
| ST-5 | Updates on next fetch/reload after enable/disable | FDI-28 | – |
| ST-5 | Records already assigned to a since-disabled inspector keep their display | FDI-28a | – |

| ID | Title | Type | Impact | Steps | Expected | Ev. |
|---|---|---|---|---|---|---|
| PM-REG-FDI-10 | Inspector table content | POS | R | Inspect rows | Columns `Name / Email`, `Role`, `Materials Scope`, `Status`, `Enabled`, `Actions`. `Status` = user account (Active / Invited - Pending Acceptance); `Enabled` = inspector mode. Combinations: Active + Enabled + `Disable`; Active + Disabled + `Enable`; Invited - Pending Acceptance + Disabled + `Enable` (disabled). Materials Scope: `All Materials`, `<Category> · all`, material names with `+N more`, or `—` when no mapping is made | O (30 Oct: 28 / 28 / 18 rows), D INS-AC-3, ST-1, ST-4, R60, R61 |
| PM-REG-FDI-11 | Invite opens the invite screen; Send disabled when empty | NEG | C | From the Inspectors section click `Invite` | The project invite screen `Invite Users` opens (Manual entry / From Procore directory); `Send Invites` disabled while empty | O, D TC-198-04 |
| PM-REG-FDI-12 | Invite – malformed email | NEG | C | Email `not-an-email` + Role → check Send | Disabled; no inline error (accepted) | O, R4 |
| PM-REG-FDI-13 | Invite – role required | NEG | C | Valid email, no role | Disabled | O, R4 |
| PM-REG-FDI-14 | Invite – valid email + role enables Send | POS | C | Valid email + `Project User` | Enabled; Cancel without sending | O, R4 |
| PM-REG-FDI-15 | Invite – additional empty row blocks Send | NEG | C | Valid row → `Add Another User` | Second email row; Send disabled | O |
| PM-REG-FDI-16 | Invite – role options | POS | R | Open Role | Roles: 7 values in discovery §5.8 | O |
| PM-REG-FDI-16a | Invite – Organization list is unique | NEG | R | Valid email → open Organization; compare names | Each organization appears once. **Currently fails: `Amazon` and `Meta` duplicated → SCP-DEF-023.** Failure message must match `Duplicate organization(s) in Invite list` | O, R6 |
| PM-REG-FDI-17 | Invite – Procore tab | POS | R | Switch to `From Procore directory` | Default-role note, `Search`, empty-state, `Add to invite list` | O |
| PM-REG-FDI-18 | Invite → accept → activate → disable | POS/INT | M | Existing Cucumber flow (Yopmail invite, accept, profile, login, disable); after acceptance reload FDI Config | Pending/Disabled → after acceptance and reload Active/Enabled without admin action → Disabled; disabled user cannot self-assign | A, D INS-AC-7, ST-2, TC-198-08 |
| PM-REG-FDI-19 | Invite duplicate / existing user email | NEG | M | Invite an email already in the Inspectors table | Rejected; no second row | R2 (message I) |
| PM-REG-FDI-20 | Add Inspector – scope options | POS | C | Open Add Inspector | Project Member*, Project Role*, scope radios All (default) / By Category / Specific | O |
| PM-REG-FDI-21 | Add Inspector – Person and Role required | NEG | C/M | Open Add Inspector → `Add` with no Project Member (role chosen); then with a member but no Project Role | Not added in either case; the user is prompted to select both Person and Role; row count unchanged | O (both fields marked `*`), D TC-198-16 (prompt text I) |
| PM-REG-FDI-22 | Add Inspector – By Category scope | POS | M | Member + role + category → Add | Row shows `<Category> · all` chip | O (chip format), I |
| PM-REG-FDI-23 | Enable/Disable inspector | POS | M | Disable an owned (run-created) inspector → reload; re-enable → reload | Enabled column and action toggle and persist; the row (name, role, materials) stays in the list – nothing deleted | A, D INS-AC-9 |
| PM-REG-FDI-24 | Edit materials scope | POS | M | Pencil (`Edit materials`) on an owned inspector → change materials → save → reload | Chips updated and kept after reload | D INS-AC-8, I (dialog layout) |
| PM-REG-FDI-25 | Several inspectors can be added | POS | M | Note the row count → Add Inspector for member A (role, All Materials) → Add; then member B (another role, Specific Materials) → Add; then member C (another role, By Material Category) → Add | After the first Add: count +1, row shows A's name and role. After all three: count +3; A, B, C are separate rows with their own role and scope; every earlier row unchanged | D INS-AC-1/2, TC-198-01/02/11, O (74 rows today) |
| PM-REG-FDI-25a | Inspector list kept after navigating away | POS | R | After FDI-25, open another PM page (e.g. Material Master) → back to FDI Config | A, B, C still listed with the same role, scope and status | D TC-198-17 |
| ~~PM-REG-FDI-25b~~ | Inspectors saved through the multi-inspector API | – | – | **Deferred (product owner: no clear idea yet)** | – | – |
| PM-REG-FDI-25c | One and many inspectors display | POS | R | View FDI Config on SCP_Testing_Ram (1 inspector) and NRVC_Hall (many) | One: single row. Many: all rows, no layout break. (Zero-inspector case deferred) | O (1 and 74 rows), D ST-1 |
| PM-REG-FDI-26 | Invite several people at once | POS/INT | M | Invite → `pm.a.<RUN>@yopmail.com` + role → `Add Another User` → `pm.b.<RUN>@yopmail.com` + role → `Send Invites` | Both appear as new rows without re-entry: status `Invited - Pending Acceptance`, Enabled = `Disabled`, `Enable` disabled | D INS-AC-5/6, ST-2, TC-198-05/06/07 |
| PM-REG-FDI-26a | Invite from User Management is unaffected | NEG/INT | M | User Management → Invite `pm.c.<RUN>@yopmail.com` with a role | Invite sent as before; the person is **not** added to the FDI Inspectors list | D ST-2 |
| PM-REG-FDI-27 | Material mapping: one, several, All Materials | POS | M | Owned inspector → edit materials → `Specific Materials` → pick **one** material → save; then a **second** → save; then choose `All Materials` → save; reload after each step | One chip; then two chips; choosing `All Materials` disables/clears the specific-material selection and the row shows `All Materials`. Each state kept after reload | D INS-AC-8, ST-3, TC-198-09/10/11, O (chip formats) |
| PM-REG-FDI-28 | Disabled and pending inspectors cannot self-assign | NEG/INT | M | Disable an owned inspector eligible for the run's material → reload → log in as that inspector → First Delivery Inspections → unassigned record; also check a pending-invite inspector is not offered; re-enable → reload | Disabled and pending inspectors are not offered for self-assign; after re-enable and reload the inspector is offered again | D INS-AC-10, ST-5, TC-198-15, A (FDI-18 tail) |
| PM-REG-FDI-28a | Already-assigned records keep a since-disabled inspector | INT | M | FDI record assigned to an owned inspector → disable that inspector → open the record | Record still shows that inspector as auditor (display unchanged); only new selection is restricted | D ST-5 |
| PM-REG-FDI-29a | Pending invite stays disabled | NEG | R | Find a row with Status `Invited - Pending Acceptance` | Enabled = `Disabled`; the `Enable` button is disabled with the tooltip "Activates automatically once the invite is accepted" | O (30 Oct, 18 pending rows), D INS-AC-6, ST-4 |

### 5c. Question Sets, Groups, Questions

| ID | Title | Type | Impact | Steps | Expected | Ev. |
|---|---|---|---|---|---|---|
| PM-REG-FDI-30 | Catch-all warning | POS | R | Open page | "No 'All Categories' set…" warning while none exists | O |
| PM-REG-FDI-31 | New Question Set – form | POS | C | Open; Cancel | Set Name* (max 200), category mode radios, search, categories used elsewhere disabled with `(in: <set>)` | O |
| PM-REG-FDI-32 | New Question Set – required | NEG | C/M | Create with empty name / 0 categories | Blocked | I |
| PM-REG-FDI-33 | Set Name boundary | BND | C | Type 201 characters | Field stops at 200 | O (maxlength) |
| PM-REG-FDI-34 | Create set for a free category | POS | M | Name `Set <RUN>` + an unused category → Create | New tab appears; category then shows `(in: Set <RUN>)` | I |
| PM-REG-FDI-35 | Manage Groups expand/collapse | POS | R | Click `Manage Groups(n)` twice | Groups table shows then hides; n = row count | O |
| PM-REG-FDI-36 | Add/edit/reorder/delete group | POS | M | Add `Grp <RUN>`; edit heading; ▲▼; delete | Each change reflected; order note shown | O (UI), I (result) |
| PM-REG-FDI-37 | Add Question – answer types | POS | R | Open Add Question → Answer Type | Boolean, Text, Date, Pass/Fail/NA, Numeric, Drop Down, Single Photo, Multiple Photo, Document | O |
| PM-REG-FDI-38 | Add Question – text and Data Type required | NEG | C/M | Add Question → `+ Create New Question` → `Add` with empty Question Text; then with text but no Answer Type | Blocked in both cases; the Data Type (Answer Type) must be chosen in the same Add Question flow | O (both fields marked `*`), D QORG-AC-1 |
| PM-REG-FDI-39 | Add Question – enabled at once in the current project | POS | M | On NRVC_Hall: `FDI Q <RUN>`, Answer Type `Text` → Add | Row in the Questions list straight away: Status `Enabled`, Type `text`, today's date – no separate enable step | A, D QORG-AC-1/2 |
| PM-REG-FDI-40 | Add from Organization Bank | POS | M | Bank tab → pick a question + group + Answer Type → Add | Added to the set as enabled with that Answer Type; removed from the bank list | O (UI), D QORG-AC-5, I |
| PM-REG-FDI-41 | Reorder and regroup questions | POS | M | ▲/▼ and group select on an owned question | Order/group persists; only new inspections affected | O (note), I |
| PM-REG-FDI-42 | Delete a question | POS | M | Delete owned question `FDI Q <RUN>` (row `Delete`) → confirm | Removed from the Questions list (with `Show deleted questions` unticked); not offered on new inspection forms (FDI-05f) | O (Delete action), I (confirm dialog) |
| PM-REG-FDI-42a | Show deleted questions lists deleted ones | POS | M | After FDI-42 tick `Show deleted questions` | Previously deleted questions are listed again – including older deleted questions, not only this run's – and are marked as deleted (status/label) | R68 (product owner, 30 Oct), I (exact marking) |
| PM-REG-FDI-42b | Hide deleted questions again | POS | C | Untick `Show deleted questions` | Deleted questions hidden; only active questions listed | R68 |
| PM-REG-FDI-42c | Empty Questions list | POS | R | Open FDI Config on a project/question set with no questions (e.g. a new question set) | Message `No questions found. Click "Add Question" to create one.` and `Add Question` available | S (VC SCP 001 screenshot, 30 Oct) |
| PM-REG-FDI-43 | Duplicate question set name | NEG | M | Create a set with an existing set name | Rejected | R2 |
| PM-REG-FDI-44 | Duplicate question text | NEG | M | Add a question with existing text | Rejected | R2 |
| PM-REG-FDI-45 | Duplicate group name | NEG | M | Add a group named like an existing one | Rejected | R2 |

### 5d. FDI questions scoped to the organization

Requirement (product owner, 30 Oct): a question added in FDI Config is enabled for the project it was added from (with its Data Type), is offered to every other project of the **same organization** as available-but-not-enabled, and is **never** visible to another organization. Every question carries an Organization Id. Acceptance criteria QORG-AC-1…7 (the one-off data migration, QORG-AC-8…11, is out of scope for this document – R68).

**Test setup (product owner, 30 Oct – R57):** NRVC_Hall, SCP_Testing_Ram and LLE - Test are in **three different organizations**. So the cross-organization check (FDI-47) uses SCP_Testing_Ram and LLE - Test. The same-organization checks (FDI-46, FDI-48, FDI-49) need a **second project in NRVC_Hall's organization**; any number can be added (R62), so it must be created before these run (Q-FDI-8).

| Requirement | Scenarios |
|---|---|
| QORG-AC-1 Data Type chosen in the same Add Question flow | FDI-38, FDI-39 |
| QORG-AC-2 enabled at once in the originating project, with its Data Type | FDI-39 |
| QORG-AC-3 available but not enabled in the organization's other projects | FDI-46 |
| QORG-AC-4 not visible to other organizations | FDI-47 |
| QORG-AC-5 another project can enable it and set the Data Type | FDI-40, FDI-48 |
| QORG-AC-6 enabling on one project doesn't enable it on others | FDI-49 |
| QORG-AC-7 Organization Id on every question; lists/searches scoped by it | FDI-50 |

| ID | Title | Type | Impact | Steps | Expected | Ev. |
|---|---|---|---|---|---|---|
| PM-REG-FDI-46 | New question offered to the organization's other projects | INT | M | After FDI-39 (`FDI Q <RUN>` added on NRVC_Hall) → switch to a **second project in NRVC_Hall's organization** → FDI Config → Add Question → `Add from Organization Bank` | `FDI Q <RUN>` listed as available; **not** enabled in that project's Questions list | D QORG-AC-3 – **prerequisite: create a second project in NRVC_Hall's organization (R62, Q-FDI-8)** |
| PM-REG-FDI-47 | New question hidden from other organizations | NEG/INT | M | After FDI-39 on NRVC_Hall → switch to SCP_Testing_Ram → FDI Config → Questions list and `Add from Organization Bank`; search `FDI Q <RUN>`; repeat on LLE - Test | Question not found on either project | D QORG-AC-4, R57 |
| PM-REG-FDI-48 | Enable a shared question on another project | POS/INT | M | On the second project of NRVC_Hall's organization: Organization Bank → `FDI Q <RUN>` → choose group and Answer Type `Numeric` → Add | Enabled on that project with type `Numeric` | D QORG-AC-5 – **prerequisite: second project in the same organization (R62)** |
| PM-REG-FDI-49 | Enabling on one project doesn't spread | NEG/INT | M | After FDI-48 → check NRVC_Hall (still `Text`, enabled) and any third project of the same organization | NRVC_Hall unchanged; on a third project the question is still only available, not enabled | D QORG-AC-6 – **prerequisite: second project in the same organization (R62)** |
| PM-REG-FDI-50 | Question list requests are organization-scoped | POS | R | Open FDI Config and the Organization Bank; record the questions list/search requests and responses | Every question returned carries the organization's Id; none from another organization | D QORG-AC-7 (API shape I) |

## 6. Inventory Control

| ID | Title | Type | Impact | Steps | Expected | Ev. |
|---|---|---|---|---|---|---|
| PM-REG-INV-01 | Empty state | POS | R | Open on a project/site with no rules | "No rules configured" / "Add a rule to set inventory thresholds" | O, R31 |
| PM-REG-INV-02 | Add Rule – required | NEG | C/M | Add with missing item/min/max | Blocked | I |
| PM-REG-INV-03 | Add Rule – happy path | POS | M | On NRVC_Hall + selected site: Item + Min 10 + Max 100 + notify toggles → Add | Rule listed with values for that project and site only | A, R31 |
| PM-REG-INV-04 | Min greater than Max | NEG | M? | Min 100, Max 10 | Rejected | I |
| PM-REG-INV-05 | Negative / zero / decimal | BND | M? | Min -1; Min 0; Max 0.5 | Per rule (number inputs) | I |
| PM-REG-INV-07 | Rule is site-specific | INT | M | Create a rule on site A; switch the header site to B | Rule not shown on B | R31 |
| PM-REG-INV-06 | Breach notification | INT | M | Rule with notify-on-min; reduce stock below min (Inventory module) | Notification raised | I |

## 7. Material Master

| ID | Title | Type | Impact | Steps | Expected | Ev. |
|---|---|---|---|---|---|---|
| PM-REG-MM-01 | Paging | POS | R | Next/Previous/page numbers | 25 rows per page; numbered pages; first row changes | O |
| PM-REG-MM-02 | Search | POS/NEG | R | Search an existing name; a no-match term | Filtered; empty state | I |
| PM-REG-MM-03 | Row menu actions | POS | R | Open the row menu; close | `Edit`, `Delete`, `Map Supplier`, `Statistics` | O |
| PM-REG-MM-04 | Expand row shows items | POS | R | Expand a row with items | Item rows (e.g. SKU ID) | O |
| PM-REG-MM-05 | Add Material – required | NEG | C/M | Add with each required field missing | Blocked | I |
| PM-REG-MM-06 | Add Material – happy path | POS | M | Category + `Mat <RUN>` + UOM → Add | New row with generated Material ID | A |
| PM-REG-MM-07 | Add Material with Parent + Supplier | POS | M | Include optional fields | Parent shown in column; supplier mapped | I |
| PM-REG-MM-08 | Add Item – required/boundary | NEG/BND | M? | Empty name/conversion; conversion `0`, `-1`, `abc`, `1.5` | Rules unknown ([D] wizard says integer multiplier) | I, D |
| PM-REG-MM-09 | Add Item – happy path | POS | M | Name + Conversion 10 → Add | Items count +1 | I |
| PM-REG-MM-10 | Edit material | POS | M | Edit owned material name | Updated | I |
| PM-REG-MM-11 | Delete material in use | NEG | M | Delete a material used by a submittal | Blocked or warned | I |
| ~~PM-REG-MM-12~~ | Template download | – | – | **Moved to §16 (UPL-MM-01)** | – | – |
| ~~PM-REG-MM-13~~ | Upload valid / invalid file | – | – | **Moved to §16 (UPL-MM-03…05)** | – | – |
| PM-REG-MM-14 | Export | POS | R | `Export` | File downloaded with current rows | I |
| PM-REG-MM-15 | Map Supplier / Statistics | POS | R/M | Open each from the row menu | Mapping dialog / statistics view | I |
| PM-REG-MM-16 | Duplicate material name | NEG | M | Add a material with an existing name | Rejected (also with extra spaces / different case); count unchanged | R2, R15 |
| PM-REG-MM-17 | Duplicate item name | NEG | M | Add Item with an existing item name on the same material | Rejected | R2 |

## 8. PreShipping Checklist

| ID | Title | Type | Impact | Steps | Expected | Ev. |
|---|---|---|---|---|---|---|
| PM-REG-PSC-01 | List renders | POS | R | Open | `#`, `Question`, `Enabled` | O |
| PM-REG-PSC-02 | Enabled tick saves automatically | POS | M | Tick `Enabled` on an owned question (no Save button) → reload | Still ticked after reload | O (no Save), R35 |
| PM-REG-PSC-03 | Enabled question appears in delivery checklist | INT | M | Procurement Log delivery checklist | Question shown with configured answer type | A |
| PM-REG-PSC-04 | Disabled question hidden downstream | INT | M | Untick → check checklist | Not shown | I |
| PM-REG-PSC-05 | Menu item follows the Pre-Shipping toggle | INT | M | On SCP_Testing_Ram: check the PM menu (toggle Off) → Configuration Options → Pre-Shipping Checklist On → Save → reload menu → turn Off again → Save | Item hidden while Off, shown while On, hidden again after restore | O, R39, R23 |

## 9. Bulk Upload Status

| ID | Title | Type | Impact | Steps | Expected | Ev. |
|---|---|---|---|---|---|---|
| PM-REG-BUS-01 | Default date range | POS | R | Open | From = today − 30 days, To = today | O |
| PM-REG-BUS-02 | Type filter | POS | R | Select `Inventory`, then `Materials` | Only rows of that type | O (options), I |
| PM-REG-BUS-03 | Uploader search | POS/NEG | R | Search own email; a no-match term | Filtered; empty state | I |
| PM-REG-BUS-04 | Date range filtering | POS/BND | R | Narrow range to one day; From > To | Only that day; invalid range handled | I |
| PM-REG-BUS-05 | Status matches outcome | NEG | R | PM → Bulk Upload Status, default range; check Status against the report files | Success file only → `Success`; failure file only → `Failed`; **both files (partial success) → no status, by design (R17)**. Today: 2 partial rows OK; **4 fully failed `Materials` rows from 26/10/2026 show `-` instead of `Failed` → SCP-DEF-001 (R20)** | O, R13, R17 |
| PM-REG-BUS-12 | Partial-success upload | POS/INT | M | Upload a file with some valid and some invalid rows | Row with no status, plus both a success and a failure report; the valid rows are created | R17; created-records part I |
| PM-REG-BUS-06 | Success/Failure file links | POS | R | Success row has a success file and `-` failure; Failed row the reverse | Matches status | O, R13 |
| PM-REG-BUS-07 | Download result reports | POS | R | Click a success file and a failure file | Both download; the failure report lists the rejected rows/reasons [I] | R13 |
| PM-REG-BUS-08 | Every upload screen is tracked | INT | M | Upload a valid file from Material Master and Site Details (and Inventory via its module) | New row per upload: today's date, uploader = logged-in user, correct type, file name, `Success` + success report | R13 |
| PM-REG-BUS-09 | Failed upload is tracked | NEG/INT | M | Upload an invalid template (missing required column/values) | Row with `Failed` and a downloadable failure report; no success report | R13; O (existing Inventory rows) |
| PM-REG-BUS-10 | History is project-specific | INT | R | Note the latest rows on NRVC_Hall; switch to another project | NRVC_Hall uploads are not listed | R13 |
| PM-REG-BUS-11 | Uploader is captured | POS | M | Upload as Project Admin; filter `Search by uploader…` by that email | Row shows that email in `Added By` | R13 |

## 10. Procurement Log Configuration

| ID | Title | Type | Impact | Steps | Expected | Ev. |
|---|---|---|---|---|---|---|
| PM-REG-PLC-01 | Locked fields cannot be disabled | NEG | R | Inspect rows 4–6 | Checked and disabled | O |
| PM-REG-PLC-02 | Field Type options | POS | R | Add Log Fields → Field Type | `Number`, `String`, `Date` | O |
| PM-REG-PLC-03 | Add field – required | NEG | C/M | Add with empty name/type | Blocked | I |
| PM-REG-PLC-04 | Add custom field | POS | M | `Field <RUN>`, String → Add | Row `Field <RUN>(Custom)` with actions | A |
| PM-REG-PLC-05 | Enable/disable + Save Changes | POS | M | Toggle a non-locked field → Save → reload; restore | Persisted | I |
| PM-REG-PLC-06 | Drag reorder | POS | M | Drag a row → Save → check Procurement Log column order | Column order matches | O (text), I |
| PM-REG-PLC-07 | Custom field in Add Submittal | INT | M (open only) | Procurement Log → Add Submittal → close without saving | Custom field visible | A |
| PM-REG-PLC-08 | Duplicate field name | NEG | M | Add an existing field name (standard or custom) | Rejected | R2 |
| PM-REG-PLC-09 | Unsaved changes on navigation | NEG | C | Toggle a field, navigate away, return | Change not persisted (or prompt) | I |

## 11. Site Details

| ID | Title | Type | Impact | Steps | Expected | Ev. |
|---|---|---|---|---|---|---|
| PM-REG-SITE-01 | Dropdown options | POS | R | Add Site → Site Type; Add Location → Location Type | `Warehouse`, `Site_type3`, `Site`; `Construction Area`, `Substore` | O |
| PM-REG-SITE-02 | Row menu | POS | R | Open the row menu | `Edit`, `Delete` | O |
| PM-REG-SITE-03 | Add Site – required | NEG | C/M | Missing Site Type or Name | Blocked | I |
| PM-REG-SITE-04 | Add Site – happy path | POS | M | Site + `Gate <RUN>` + City + Country → Add | Row listed; appears in global Site selector | A, O (selector) |
| PM-REG-SITE-05 | Add Location | POS | M | Row `ADD` → type + name → Add | Locations count +1 | I |
| PM-REG-SITE-06 | Address entry on Add Site | POS | C | Open Add Site → type an address in `Address` | No suggestions appear (expected); the typed address is kept in the field | O, R34 |
| PM-REG-SITE-07 | Delete site in use | NEG | M | Delete a site with deliveries | Blocked or warned | I |
| ~~PM-REG-SITE-08~~ | Upload / template / export | – | – | **Moved to §16 (UPL-SITE-*)**; export stays as MM-14 pattern | – | – |
| PM-REG-SITE-11 | Export sites | POS | R | `Export` | The file lists the same sites as the page (distinct Site Name = site count). **30 Oct: 1 row vs 13 sites → DEF-C6** | O, R70 |
| PM-REG-SITE-09 | Duplicate site name | NEG | M | Add a site with an existing name | Rejected | R2 |
| PM-REG-SITE-10 | Duplicate location name | NEG | M | Add a location with an existing name to the same site | Rejected | R2 |

## 12. Submittal Manager

| ID | Title | Type | Impact | Steps | Expected | Ev. |
|---|---|---|---|---|---|---|
| PM-REG-SUB-01 | Repurposed notice only | POS | R | Open | Notice text; no table/actions (agreed scope) | O |

## 13. System Messages

| ID | Title | Type | Impact | Steps | Expected | Ev. |
|---|---|---|---|---|---|---|
| PM-REG-SYS-01 | Form fields and limits | POS/BND | C | `New message` | Scope = Project only; Severity Info/Warning; Title maxlength 120; Body required, maxlength 2000, counter `n/2000`; datetime inputs; Active | O, R5 |
| PM-REG-SYS-02 | Markdown preview | POS | C | Body `**bold** *it* [l](https://x.y)`; also `<script>` and `# H` | Preview renders bold/italic/link; HTML and headings stripped | O (helper text), I (render) |
| PM-REG-SYS-03 | Body required | NEG | C/M | Create with empty body | Blocked | O (required attr), I (message) |
| PM-REG-SYS-04 | Body 2000 / Title 120 boundary | BND | C | Type 2001 body characters and 121 title characters | Body stops at 2000 (counter `2000/2000`); title stops at 120 | O (maxlength), R5 |
| PM-REG-SYS-05 | Ends before Starts | NEG | M? | Ends < Starts → Create | Error/warning message; message not created | R27 (message text I) |
| PM-REG-SYS-06 | Edit pre-fills | POS | C | Edit first row; Cancel | All fields pre-filled, counter = body length, preview shown | O |
| PM-REG-SYS-07 | Create scheduled message | POS | M | Future window, Info → Create | Row Status `Scheduled` | A, O (status values) |
| PM-REG-SYS-08 | Active message shows banner | INT | M | Window covering now → Create; open any page | `PROJECT NOTICE` banner with title/body | O (banner exists), I |
| PM-REG-SYS-09 | Inactive / expired not shown | NEG | M | Untick Active or past window | No banner | I |
| PM-REG-SYS-10 | Delete message | POS | M | Delete an owned message | Removed; banner gone | I |
| PM-REG-SYS-11 | Banner dismiss | POS | R | Click × on banner; reload | Hidden (persistence unknown) | I |
| PM-REG-SYS-12 | Warning vs Info styling | POS | M | Create one Info and one Warning message (active now) → view the banners | The two banners have different background colours | R37 |

## 14. Watched Materials

| ID | Title | Type | Impact | Steps | Expected | Ev. |
|---|---|---|---|---|---|---|
| PM-REG-WM-01 | No user selected | POS | R | Open | "Pick a user to view or assign watches." | O |
| PM-REG-WM-02 | View own watches | POS | R | Select self | Rows `Category`, value, `On`, assigner, date, `Remove` | O |
| PM-REG-WM-03 | Add watch – type/value lists | POS | R | Open Add watch selectors | Type `Category`/`Trade`; values = categories | O |
| PM-REG-WM-04 | Add category watch | POS | M | Add `Cat <RUN>` for self | Row added | A, R33 |
| PM-REG-WM-10 | One user can watch every category | POS | M | For one user, add a watch for each category not yet watched | All accepted; list shows every category once | R33 |
| PM-REG-WM-05 | Watch appears on Dashboard | INT | M | Management Dashboard → "Your watched materials" | `Cat <RUN>` listed | A, O |
| PM-REG-WM-06 | Duplicate watch | NEG | M | Add the same category again for the same user | Rejected; not duplicated | R2 |
| PM-REG-WM-07 | Notifications toggle | POS | M | Toggle `On` → Off → reload; restore | Persisted | I |
| PM-REG-WM-08 | Remove watch | POS | M | Remove the WM-04 row | Row gone; Dashboard updated | I |
| PM-REG-WM-09 | Trade watch | POS | M | Add a `Trade` watch | Row with Type `Trade` | I |

## 15. Role-based access (configuration-based – R9, R40–R43)

**Rules:** the Org Admin edits role access in **Voyage Control Admin → Supply Chain Planner → Roles → Edit** (R22, R40). Access is set per page as **View** or **Edit** (R41). Roles are given to users when they are created in SCP User Management, or by the Org Admin in the portal (R43). Tests never hard-code "role X sees Y": they set the access first, then check the UI. Access is changed in **Update Role** by ticking/unticking `<Area>: <Action>` permissions and clicking `Save` (R48).

**Prerequisites:** Org Admin account (add to `.env` as `SCP_ORG_ADMIN_*`); Supplier and Subcontractor accounts (in `.env`); a separate browser context per user. **Only the Subcontractor and Supplier roles may be changed (R42)**. Every test records their original access first and restores it at the end, even when the test fails.

| ID | Title | Role | Steps | Expected | Ev. |
|---|---|---|---|---|---|
| PM-REG-ROLE-01 | Admin full access | Project Admin (current account) | Smoke 002 | All PM items visible and actionable | O |
| PM-REG-ROLE-02 | Org Admin can edit role access | Org Admin | Voyage Control Admin → Supply Chain Planner → Roles → Edit `Supplier` → **Update Role** → tick `System Messages: Create (Project)` → `Save` → reopen; restore | Permission still ticked when reopened | R22, R40, R48 |
| PM-REG-ROLE-03 | Edit access allows changes | Supplier | Org Admin ticks `Material: List` + `Material: Add` + `Material: Edit` for `Supplier` → Save → Supplier logs in → Material Master → Add `Mat <RUN>` | `Add Material` available; material created | R41, R42, R51 |
| PM-REG-ROLE-04 | View-only access blocks changes | Supplier | Tick only `Material: List` (untick Add/Edit/Delete) for `Supplier` → Supplier opens Material Master | List visible; `Add Material`, `Upload`, row ⋮ Edit/Delete hidden or disabled | R41, R42, R51 |
| PM-REG-ROLE-05 | No PM tab access hides all PM pages | Subcontractor | Untick `Menu: Project Management section` and `Screen: Project Management: View project management screen` for `Subcontractor` → log in → check menu; `goto` each PM route (e.g. `/material-master`, `/common-uom`, `/configuration-options`) | PM menu hidden; every PM route blocked or shows no data | R51, R52 (block behavior I) |
| PM-REG-ROLE-06 | Change applies on next login/reload | Supplier | Change `Supplier` access while the Supplier is logged in → reload; then log out/in | New access applied (record after which step) | R41; timing I |
| PM-REG-ROLE-07 | Access is per action and per page | Subcontractor | Tick `Project: Site: View…` + `Create a new project site` but only `Material: List` → log in | Can add a site; cannot add a material | R41, R42, R51 |
| PM-REG-ROLE-08 | Current Supplier / Subcontractor access matches the UI | Supplier, Subcontractor | Read their current role access in the portal → log in as each → compare the menu and controls | UI matches the configured access | R41 |
| PM-REG-ROLE-09 | Nav matches permission keys | any | Hover the Update Role labels to read the keys for `Menu: Project Management section` / `Screen: Project Management…`; compare with the session permissions `sidebar:project_management:view`, `screen:project:management` | Same keys; PM menu shown only when they are granted | A (registry), R51 |
| PM-REG-ROLE-10 | Disabled FDI inspector | invited inspector | Covered by FDI-18 | Cannot self-assign | A |
| PM-REG-ROLE-11 | Only Org Admin sees Voyage Control Admin | Org Admin vs Project Admin, Supplier, Subcontractor | Log in as each → check the platform chooser | Tile shown only for the Org Admin; Project Admin sees only Supply Chain Planner and V3 Construction deliveries | O (Project Admin), R40 |
| PM-REG-ROLE-12 | Role assigned at user creation (SCP) | Project Admin creates; new user | SCP User Management → invite `pm.<RUN>@yopmail.com` with role `Supplier` → accept invite (Yopmail) → log in | New user has the Supplier role and exactly the Supplier role's access | R43 (invite flow A from FDI-18) |
| PM-REG-ROLE-13 | Org Admin creates a user in the portal | Org Admin | Voyage Control Admin → Supply Chain Planner → create user `pm.<RUN>@yopmail.com` with role `Subcontractor` | User created with that role; can log in to SCP with Subcontractor access | R43 (portal screen I) |
| PM-REG-ROLE-14 | Non-admin cannot change role access | Supplier, Subcontractor | Log in → look for Voyage Control Admin; try its URL | Not available | R40 |
| PM-REG-ROLE-15 | System Messages create permission | Supplier | Untick `System Messages: Create (Project)` for `Supplier` → Supplier opens PM › System Messages; then tick it → reload | Unticked: `New message` hidden or blocked. Ticked: `New message` available and a message can be created | R48 |
| PM-REG-ROLE-16 | System Messages delete permission | Supplier | Same with `System Messages: Delete (Project)` | Unticked: `Delete` hidden/blocked. Ticked: Delete works on an owned message | R48 |
| PM-REG-ROLE-17 | Material Watch permissions | Subcontractor | Untick / tick `Users: Material Watch` and `Users: Material Watch Assign` → Subcontractor opens PM › Watched Materials | Without them: page hidden or watches can't be assigned; with them: can view and assign watches | R48 (exact effect of each I) |
| PM-REG-ROLE-18 | Platform vs Project scope | Supplier | Tick only `System Messages: Create (Project)` (not Platform) → open New message | Scope offers only `Project` | R48 |
| PM-REG-ROLE-19 | Inventory Control rule permissions | Subcontractor | Tick only `Inventory: Control rules: List` → open Inventory Control; then tick `Add` | List only: `Add Rule` hidden/disabled. With Add: rule can be created | R51 |
| PM-REG-ROLE-20 | FDI Assign Inspector permission | Org Admin + Project Admin | Read whether `FDI: Assign Inspector` is ticked for the user's role → open an unassigned FDI record | `Assign` action shown only when the permission is ticked | R51, Q-ROLE-2 (links SCP-DEF-012/022) |
| PM-REG-ROLE-21 | PM tab access opens the pages without their own permission | Subcontractor | Tick the two PM tab permissions for `Subcontractor` → log in → open Common Utilities, Common UoM, Material Category, Configuration Options, Bulk Upload Status, Procurement Log Configuration, Submittal Manager | All open and work as for the Project Admin (add/save where the page allows) | R52 |
| PM-REG-ROLE-22 | Org Admin can create a project in any organization | Org Admin | Voyage Control Admin › `New Project` → open the organization list | Every existing organization can be chosen; the project is created in the chosen one | R65 – **creates a permanent project: run only for the agreed one-time setup project (Q-FDI-8)** |
| PM-REG-ROLE-23 | Project Admin limited to their associated organization | Project Admin | Open project creation as the Project Admin → organization list | Only the Project Admin's associated organization is offered; another organization cannot be chosen | R65 (screen location I) – read-only up to the organization list; do not create |
| PM-REG-ROLE-24 | Users without the permission cannot create projects | Supplier, Subcontractor | Look for project creation (menu / URL) | Not available | R65, R51 (`Project: Create a new project`) |

---

## 16. Bulk uploads in Project Management

Upload screens in PM (30 Oct): **Material Master** (Excel, type `Materials`), **Site Details** (Excel, type `Sites`) and **XER Import** (`.xer`/`.xml`, scenarios INT-09…17). Every Excel upload is also checked on **Bulk Upload Status** (R13, R17, R20).

**Test data rules**
- Build each file at run time from the **template downloaded in the same run** (the UoM list changes as UoMs are added), the same way the Inventory upload works today.
- Download the template in the run and **replace its sample rows** with new `<RUN>` rows before uploading (R47). Records are never deleted (R14).
- Site and location types must be read from the project's on-screen dropdowns (Add Site / Add Location) at run time, because they vary per project (R44).
- Keep generated files in the run's output folder, not in the repo.

**Common checks after every upload** (referred to as *BUS-check*): Bulk Upload Status, default date range → newest row has today's date, `Added By` = logged-in user, the right type, the uploaded file name, and status/report files as below.

| Result | Status | Success file | Failure file |
|---|---|---|---|
| All rows valid | `Success` | yes | `-` |
| All rows invalid | `Failed` (today `-` → SCP-DEF-001) | `-` | yes |
| Some valid, some invalid | no status (R17) | yes | yes |

### 16a. Material Master upload

| ID | Title | Type | Impact | Steps | Expected | Ev. |
|---|---|---|---|---|---|---|
| UPL-MM-01 | Template download and layout | POS | R | Material Master → `Upload` → `Download Template` | File `material_bulk_upload_template.xlsx`; sheet `Materials`; columns `category, material_name, uom, item_name, item_conversion` in that order | O |
| UPL-MM-02 | UoM dropdown matches Common UoM | INT | R | Read the template's `uom` list (hidden `_Lists`) and compare with Common UoM | Same UoM names; a UoM created in the run (REF-13) appears in a template downloaded afterwards | O (36 = 36), I (refresh) |
| UPL-MM-03 | Valid upload creates materials | POS | M | Two rows: (1) existing category + `Mat A <RUN>` + valid UoM; (2) same + `item_name` `Pack <RUN>` + `item_conversion` 10 → `Upload File` | Both materials in Material Master with the right category and UOM; row 2 has 1 item (conversion 10); *BUS-check* = Success | R13, I (exact listing) |
| UPL-MM-04 | Fully invalid file | NEG | M | Two rows, both missing `material_name` | No material created; *BUS-check* = Failed + failure report naming each row and reason | R20 (currently `-`, SCP-DEF-001) |
| UPL-MM-05 | Partly valid file | NEG/POS | M | One valid row + one row with a blank `uom` | Valid material created; invalid row not; *BUS-check* = no status, both reports | R17 |
| UPL-MM-06 | Required cells | NEG | M | Rows with blank `category`; blank `uom` | Each row rejected with a reason in the failure report | I |
| UPL-MM-07 | UoM not in the list | NEG | M | Type a UoM that isn't in `_Lists` (bypassing the dropdown) | Row rejected | I |
| UPL-MM-08 | Unknown category – confirm | POS/INT | M | Row with `category` = `Cat <RUN>` (doesn't exist) → `Upload File` → confirm creating the new category when asked | Confirmation prompt names the new category; after confirming, the category appears in Material Category and the material is created under it; *BUS-check* = Success | R45 (prompt text I) |
| UPL-MM-09 | Duplicate of an existing material | NEG | M | `material_name` = an existing name; also with different case and extra spaces | Rows rejected; no duplicate created | R2, R15 |
| UPL-MM-10 | Duplicate inside the same file | NEG | M | Same `material_name` twice in one file | Second row rejected (or whole file, if atomic) | R2, I |
| UPL-MM-11 | Item conversion boundaries | BND | M | `item_conversion` = `0`, `-1`, `abc`, `1.5` with an `item_name` | Rows rejected; a whole number ≥ 1 accepted | D (wizard: integer multiplier), I |
| UPL-MM-12 | Item fields must go together | NEG | M | `item_name` without `item_conversion`, and the reverse | Rows rejected | I |
| UPL-MM-13 | Wrong file / wrong layout | NEG | M? | Upload a `.csv`/`.pdf`; then an `.xlsx` with a renamed or missing column | Rejected with a message; nothing created; Bulk Upload Status shows Failed or no row (record which) | I |
| UPL-MM-14 | Header-only file | NEG | M? | Template with sample rows removed | Rejected or "no rows" message; nothing created | I |
| UPL-MM-15 | Reports can be downloaded | POS | R | From the UPL-MM-05 row on Bulk Upload Status download both reports | Success report lists the created row; failure report lists the rejected row and reason | R13 |
| UPL-MM-16 | Unknown category – decline | NEG | M | Same as UPL-MM-08 with `Cat2 <RUN>` → decline the confirmation | Category not created; that material not created (record whether the rest of the file is processed or the upload is cancelled) | R45, I |

### 16b. Site Details upload

| ID | Title | Type | Impact | Steps | Expected | Ev. |
|---|---|---|---|---|---|---|
| UPL-SITE-01 | Template download and layout | POS | R | Site Details → `Upload` → `Download Template` | File `site_bulk_upload_template.xlsx`; sheet `Sheet1`; columns `site_name, site_type, location_name, location_type` | O |
| UPL-SITE-02 | Valid upload creates a site with locations | POS | M | Rows: `Site <RUN>` + a site type from the project's Add Site list + `Loc A <RUN>` + a location type from the Add Location list; same site + `Loc B <RUN>` → `Upload` | Site listed with 2 locations; appears in the header site selector; *BUS-check* = Success | R13, R44 |
| UPL-SITE-03 | Fully invalid file | NEG | M | Rows with blank `site_name` | Nothing created; *BUS-check* = Failed + failure report | R20 (currently `-`) |
| UPL-SITE-04 | Partly valid file | NEG/POS | M | One valid row + one with an invalid `site_type` | Valid site created; *BUS-check* = no status, both reports | R17 |
| UPL-SITE-05 | Required cells | NEG | M | Blank `site_type`; blank `location_name`; blank `location_type` | Rows rejected | I |
| UPL-SITE-06 | Invalid type values | NEG | M | `site_type` = `xyz <RUN>`; `location_type` = `xyz <RUN>` (not in the project's lists) | Rows rejected | R44 |
| UPL-SITE-07 | Template sample types are not valid by default | NEG | M | Rows using the template samples `local` / `CONSTRUCTION` on NRVC_Hall (not in its lists) | Rows rejected; the same rows with on-screen types (`Site` / `Construction Area`) accepted | R44 |
| UPL-SITE-08 | Existing site name | NEG | M | `site_name` = an existing site (also different case/spaces) | Row rejected as duplicate; existing site unchanged | R2, R15, R46 |
| UPL-SITE-09 | Duplicate location in one site | NEG | M | Same `site_name` + same `location_name` twice | Second row rejected | R2 |
| UPL-SITE-10 | Same location name, different sites | POS | M | `Loc X <RUN>` under two different new sites | Both accepted (uniqueness is per site) | I |
| UPL-SITE-11 | Wrong file type accepted by picker | NEG | M? | Upload a `.pdf` and a `.csv` (picker allows any type, OBS-15) | Server rejects with a message; nothing created | O (no filter), I (message) |
| UPL-SITE-12 | Header-only file | NEG | M? | Template with sample rows removed | Rejected or "no rows" message; nothing created | I |
| UPL-SITE-13 | Reports can be downloaded | POS | R | From the UPL-SITE-04 row download both reports | Reports list the created and rejected rows | R13 |

### 16c. XER Import

Covered in §2 (Integrations): **INT-07…INT-25** (requirements traceability in [XER_TASK_VISIBILITY_REQUIREMENTS.md](XER_TASK_VISIBILITY_REQUIREMENTS.md)) – plan listed, unsupported type, import → select two new tasks → Save, duplicate detection by content, Open existing plan, filters, zero selection, selection kept across search, Save replaces visible set, checkbox-click defect, Import anyway.

## Coverage summary

| Area | Scenarios | Read-only / client-only | Touch data (M, M?, C/M, R/M) |
|---|---|---|---|
| Navigation | 9 | 7 | 2 |
| Integrations (deferred: TheLink 3, Booking link 1, XER 5 – R7, R24, R50) | 16 | 12 | 4 |
| Reference Data | 25 | 6 | 19 |
| Configuration Options | 18 | 4 | 14 |
| FDI Config (incl. §5d org scoping; 1 deferred) | 72 | 27 | 45 |
| Inventory Control | 7 | 1 | 6 |
| Material Master (2 moved to §16) | 15 | 5 | 10 |
| PreShipping Checklist | 5 | 1 | 4 |
| Bulk Upload Status | 12 | 8 | 4 |
| Procurement Log Configuration | 9 | 3 | 6 |
| Site Details (1 moved to §16, + export) | 10 | 4 | 6 |
| Submittal Manager | 1 | 1 | 0 |
| System Messages | 12 | 5 | 7 |
| Watched Materials | 10 | 3 | 7 |
| Bulk uploads §16 (Material 16, Site 13) | 29 | 5 | 24 |
| Role-based (R9, R40–R43, R48, R51, R52, R65) | 24 | needs role accounts | role config changes |
| **Total** | **273** (+10 deferred, 3 moved to §16) | **91** | **158** |

Data-touching scenarios are approved on NRVC_Hall (R1). C/M rows can run client-only (open the form, attempt Add, observe) but may create a record if the app accepts the input, so they are counted as touching data.

## Automation split (30 Oct 2026)

| Run | Spec / command | Scope |
|---|---|---|
| Regression part 1 | `tests/pm-flow/pm-regression.spec.js` · `npm run pm:regression` | 92 read-only / client-only scenarios (R, C) |
| Regression part 2 | `tests/pm-flow/pm-regression-part2.spec.js` · `npm run pm:regression2` | Data-creating scenarios inside Project Management on NRVC_Hall (M), plus the SCP_Testing_Ram scoping checks. Every created name carries the run token `PMR2-<yyMMddHHmm>`; settings are restored after each change |
| Regression part 3 (planned) | – | Cross-module (FDI inspection form, Procurement Log, Management Dashboard archive, User Management invite, Inventory stock), next-day alert batch checks, Yopmail acceptance, and the 24 role scenarios |

Part 2 records these as **Skipped** with the reason, instead of running them:

- **Need a go-ahead (they cannot be undone, or could delete real data):** NAV-08 and NAV-09 (complete the Setup Wizard on SCP_Testing_Ram), INT-02 (Booking form submit), MM-11 and SITE-07 (delete a record in use).
- **Blocked:** FDI-46, FDI-48 and FDI-49 (no second project in NRVC_Hall's organization, Q-FDI-8).
- **Part 3:** CFG-09…17, FDI-05a…n, FDI-18, FDI-26a, FDI-28, FDI-28a, INV-06, PSC-03, PSC-04, PLC-06, PLC-07, ROLE-01…24.

Part 2 adds two automation-only IDs: **PM-REG-REF-22b** (REF-22 for Material Category; REF-22 covers UoM) and **PM-REG-FDI-06b** (the NRVC_Hall check shared by FDI-06 and CFG-18). Scenarios marked Ev. **I** record what the app did ("Observed: …" in the report) instead of asserting a guessed result.

## Suggested execution order and dependencies

1. Smoke (read-only) → Navigation → read/client-only regression rows (safe on shared staging at any time).
2. Reference Data creations (Utility, UoM, Category) → Material Master (uses UoM + Category) → Inventory Control (uses material/items) → Watched Materials and FDI question sets (use Category).
3. Site Details → Inventory locations.
4. Configuration Options / FDI Settings / PreShipping / Procurement Log Config changes **last**, each restoring original values, because they alter behavior for every other module and run on the shared project.
5. Cross-module INT rows after the module-level rows they depend on.
