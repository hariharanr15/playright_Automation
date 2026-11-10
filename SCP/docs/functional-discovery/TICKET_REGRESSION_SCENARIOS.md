# Ticket Regression Scenarios – tested 3 Nov 2026

Tickets tested manually on staging (NRVC_Hall, Project Admin) on 2026-11-03, to be added to the SCP automation suite. Legend as in PM regression: Type POS / NEG / BND / INT; Impact C / M / R; Ev. O = observed on 3 Nov, I = from the ticket's acceptance criteria, not yet observed.

Per the project rule (R16), run data is created with unique run names and never deleted. Out of scope for automation (per user, 3 Nov): UI presentation issues that do not change the rule outcome (Materials field order, dialog shown before the supplier check, Cancel clearing the Materials field).

## BUGS-517 – Rules for editing the supplier and primary material of a submittal

Setup per run: one submittal with 2 materials and one component, one PO-committed submittal, one delivery-only submittal, two suppliers mapped to the material with different lead times, one supplier not mapped.

| ID | Title | Type | Impact | Steps → Expected | Ev. |
|---|---|---|---|---|---|
| T517-01 | No components: supplier change | POS | M | Change supplier → saved, no confirmation dialog | O |
| T517-02 | No components: primary material change | POS | M | Change primary material → saved | O |
| T517-03 | New supplier doesn't supply a component material | NEG | C | Change supplier → message 3 "<X> does not supply … <material>"; supplier unchanged | O |
| T517-04 | Locked by PO | NEG | C | Edit form shows message 4; Supplier read-only | O |
| T517-05 | Locked by delivery only (no PO) | NEG | C | Same lock and message 4 | O |
| T517-06 | Confirmation dialog wording | POS | M | "all N component(s) … <supplier>'s lead times …" with Confirm / Cancel | O |
| T517-07 | Cancel saves nothing | NEG | M | Cancel → supplier and component lead times unchanged (API check) | O |
| T517-08 | Confirm resets lead times | POS | C | Lead time = new supplier's value (different value, e.g. 2 → 1); Lead Time Confirmed true → false | O |
| T517-09 | Lead-time audit entry | POS | M | Lead-time history has "Supplier changed from X to Y", was_confirmed true → false; also written when the value is unchanged | O |
| T517-10 | Rejected change is all-or-nothing | NEG | C | After a rejected change, submittal and components unchanged | O |
| T517-11 | Primary material in use by a component | NEG | C | Make the other material primary → "Primary material cannot be changed as components are associated with this material." | O |
| T517-12 | Primary material not used by any component | POS | M | Uncommitted submittal, component only on the non-primary material → primary change saved | I |
| T517-13 | Bulk Edit: one batch confirmation | POS | M | Select 2 submittals → one dialog "N component(s) on M submittal(s)" | O |
| T517-14 | Bulk Edit: locked row skipped | NEG | C | Locked row skipped with message 4; other row applied | O |
| T517-15 | Bulk Edit Roll Back | POS | M | Roll Back restores supplier, component lead times and Confirmed flags (needs suppliers with different lead times) | I – supplier restore O |
| T517-16 | Bulk Edit: primary material change | NEG | M | Bulk primary-material change on a submittal whose component uses it → message 9 | I |
| T517-17 | Backend enforces the rules | NEG | C | API supplier change bypassing the form → 400 with message 3 / 4 | O |
| T517-18 | Other fields stay editable when locked | POS | M | Spec description saved on a PO-locked submittal | O |

## BUGS-543 – FDI question sets list categories from the Material Category master

Setup per run: a run-named Material Category with no materials; an existing category linked to another question set.

| ID | Title | Type | Impact | Steps → Expected | Ev. |
|---|---|---|---|---|---|
| T543-01 | Category list = Material Category master | POS | C | Create / Edit question set → list includes the run category with no materials | I |
| T543-02 | Sorted and searchable | POS | R | List is alphabetical; search filters it | I |
| T543-03 | Category owned by another set | NEG | M | Visible, not selectable, shows the owning set's name | I |
| T543-04 | Edit shows linked categories selected | POS | R | Open Edit → linked categories ticked | I |
| T543-05 | Save set with a category that has no materials | POS | C | Saved without error | I |
| T543-06 | Inspector mapping uses the master list | POS | M | Add Inspector / Edit Material Mapping → run category listed; "specific materials" disabled with "No materials in this category yet"; "All materials" selectable | I |
| T543-07 | Add new category from the dialog | POS | M | Type a new run name → "+ Add '<name>' as a new Material Category" → created and selected | I |
| T543-08 | Name rules | BND | M | Blank / spaces rejected; 200 chars accepted, 201 rejected; commas removed | I |
| T543-09 | Duplicate name ignoring case | NEG | M | Type an existing name in other case → no duplicate; "'<name>' already exists and has been selected" | I |
| T543-10 | New category appears elsewhere | INT | M | Material Category screen and Material Master list it | I |
| T543-11 | Category added on Material Category screen | INT | R | Appears in the question set dialog after reload | I |
| T543-12 | Category API scoped to the project | NEG | C | `/api/project_material_category/` without project_id must not return other projects' categories (security note in ticket; raised separately) | O – returns all projects |

## BUGS-508 – Material bulk upload: UOMs, category matching, decision step and summary

Run files are generated from the template downloaded in the same run (R47); category names carry the run tag. Detailed 3 Nov results and the 7 open issues are in `BUGS-508_Tracker.xlsx` (user's Downloads).

| ID | Title | Type | Impact | Steps → Expected | Ev. |
|---|---|---|---|---|---|
| T508-01 | Template UOM dropdown | POS | M | Downloaded template `uom` column has a dropdown incl. Each, Sheets, Sets, Units, Openings, Pairs, Flights, Tubes | I |
| T508-02 | UOM matched ignoring case | POS | M | `pounds` accepted as `Pounds` | I |
| T508-03 | Category matched ignoring case / punctuation / spaces | POS | C | `DIVISION-03_CONCRETE` → existing category, no prompt, no new category | I |
| T508-04 | Upload window phases, not closable | POS | M | Reading → pre-scan categories → pre-scan UOMs → waiting / importing → finishing → complete | I |
| T508-05 | Decision screen lists each unmatched value once | POS | C | Value + row count, before any import | I |
| T508-06 | Category: create new | POS | M | Created once and reused by all its rows | I |
| T508-07 | Category: use existing | POS | M | Rows get the chosen category; mapping shown in summary | I |
| T508-08 | Category / UOM: reject rows | NEG | M | Rows not imported; error file reason "rejected at your request" | I |
| T508-09 | UOM: must choose before Continue | NEG | M | Continue disabled until each UOM has a choice | I |
| T508-10 | SKU both blank | POS | M | Default SKU = material name, conversion 1 | I |
| T508-11 | SKU conversion missing | NEG | M | Rejected "SKU conversion missing" | I |
| T508-12 | Invalid SKU conversion (text / 0 / negative) | BND | M | Rejected "Invalid SKU conversion" | I |
| T508-13 | Item name blank, valid conversion | POS | R | Default SKU with the given conversion | I |
| T508-14 | Cancel upload rolls back | NEG | C | Cancel at decision step → "Upload cancelled. No changes were saved."; nothing created | I |
| T508-15 | Summary reconciles | POS | C | succeeded + duplicates + rejected = total; reasons add up to rejected | I |
| T508-16 | Error file link | POS | M | Downloads with a reason per row | I |
| T508-17 | Bulk Upload Status matches the outcome | POS | M | Fully failed upload shows Failed; error-only upload not "Success" (BUG-7, R20) | I |
| T508-18 | Non-Project-Admin has no upload | NEG | M | Supplier role: material bulk upload not available | I |
| T508-19 | Resume at decision step | INT | R | Reload at the decision step → same step, nothing imported | I |

Not automated: AC 19 (browser closed mid-import) and AC 20 after 24 hours.

## BUGS-507 – Material bulk upload keeps commas in names

| ID | Title | Type | Impact | Steps → Expected | Ev. |
|---|---|---|---|---|---|
| T507-01 | Comma kept | POS | M | `Mat507 <RUN>, Type L` saved as written, or rejected with a reason naming the comma | O |
| T507-02 | Other characters ( ) # / - | POS | R | Saved name recorded (open question on the ticket) | O |

## BUGS-548 – Organisation question sets: reuse a whole question set across projects

Added 10 Nov 2026 from the ticket's ACs and the QA test notes (29 Oct comment); screens and API (`/api/org_fdi_question_set/`) seen in a read-only staging discovery on 10 Nov. Setup per run: an existing project set (`SCP_TKT548_SOURCE_SET`, default `CLD548 Source`) is saved as a run-named organisation set; a second existing set (`SCP_TKT548_ALT_SOURCE_SET`, default `Phone`) is used for "Update from project set". Only the run's own organisation set is deleted; nothing in the project is changed to All Categories.

| ID | Title | Type | Impact | Steps → Expected | Ev. |
|---|---|---|---|---|---|
| T548-01 | Save a set to the organisation | POS | C | Select set › "Save to Organisation": name defaults to the set name; saved copy has the same question count, All-Categories flag and the set's categories as suggestions; list row shows them with Created By | O (screens) |
| T548-02 | Name rules | NEG | M | Same name in other case → "An organisation question set with this name already exists."; empty name not saved | I |
| T548-03 | View is read-only | POS | R | View dialog: "N groups · M questions", questions in order, no inputs | O |
| T548-04 | Shared within the organisation only | INT | C | Project in same org lists the set; project in another org doesn't (needs `SCP_FDI_SECOND_PROJECT` / `SCP_TKT548_OTHER_ORG_PROJECT` project ids) | I |
| T548-05 | Rename | POS | M | Existing name (other case) refused; new name listed; copy's "Created from" shows the new name | I |
| T548-06 | Update from project set | POS | M | "Replace Contents" → question count and suggested categories match the chosen set; name kept; earlier copies unchanged | O (dialog) |
| T548-07 | Create from organisation set (copy) | POS | C | Name defaults to org set name; suggested categories linked elsewhere show "(in: <set>)" disabled; "+ Add" a run category; Create → same question count, `created_from` = org set, `copied_by` = user | O (dialog) |
| T548-10 | All Categories rule | BND | C | Choosing the All Categories org set picks "All Categories (catch-all)" when the project has none, else "…this project already has one…" and the radio is disabled. Dialog only, nothing created | O (dialog) |
| T548-11 | Deleted bank question skipped | NEG | M | Deferred – needs developer-prepared data | – |
| T548-12 | All-or-nothing create | NEG | C | Deferred – manual two-tab race | – |
| T548-13 | "Created from" line | POS | M | Copy shows "Created from: <org set> on <date> by <user>"; a hand-built set doesn't | O |
| T548-14 | Delete | POS | M | Removed from list; copy shows "(deleted)" and keeps its questions | O ("(deleted)" seen on an older copy) |
| T548-15 | "Edited in this project since" | POS | M | Move a question (▼) in the copy → `modified_after_copy` true and the line shows it; org set order unchanged | I |
| T548-16 | Bank question protection | NEG | C | Deferred – a failing guard would delete a real bank question | – |
| T548-17 | Audit log | INT | M | `schedule-audit-logs/list/?change_type=OrgFDIQuestionSet` / `FDIQuestionSet` mention the run | I |
| T548-18 | Permissions | NEG | M | Deferred – needs a working view-only account | – |

## BUGS-155 – Subcontractor and the pre-shipping checklist

Rule (ticket description): a subcontractor whose organisation differs from the submittal supplier's may only approve the checklist; when the organisations match, the subcontractor may also fill it. Setup per run: run submittal F (supplier `SCP_PL_SUPPLIER`, default LG) and, if `SCP_TKT155_SAME_ORG_SUPPLIER` is set, run submittal G with a supplier in the subcontractor's organisation; each gets a component and a delivery awaiting the checklist. The subcontractor signs in with `SCP_SUBCONTRACTOR_*` in a second browser context. The admin fills the checklist as the supplier's stand-in.

| ID | Title | Type | Impact | Steps → Expected | Ev. |
|---|---|---|---|---|---|
| T155-01 | Other-org subcontractor cannot fill | NEG | C | Delivery on F: "Pre Shipping Info" not offered, or "Confirm Checklist" not usable | I |
| T155-02 | Subcontractor can approve | POS | C | Admin fills on F → subcontractor "Approve Pre-Shipping Checklist" › Approve → "Checklist Generated Successfully!" | I |
| T155-03 | Same-org subcontractor can fill | POS | M | Subcontractor fills on G → "Approve Pre-Shipping Checklist" appears (needs `SCP_TKT155_SAME_ORG_SUPPLIER`) | I |

10 Nov: the `SCP_SUBCONTRACTOR_*` account in `.env` is rejected by the login page ("Please enter a correct email and password"), so T155-01…03 are skipped until it is updated.

## Added to existing tickets (10 Nov)
- T517-17 (backend lock) is now automated: the Edit form's own PUT for the PO-locked submittal is replayed with another supplier and `confirm_lead_time_reset: true`; expects HTTP ≥ 400 with message 4 and nothing changed.
- T543-04 (Edit shows linked categories), T543-10 (new category on the Material Category screen) and T543-11 (category created outside the dialog is listed and selectable) are now automated. T543-06 stays deferred.

Totals: BUGS-517 18 · BUGS-543 12 · BUGS-508 19 · BUGS-507 2 · BUGS-548 16 · BUGS-155 3 = 70 regression scenarios.

## Automation
`npm run tickets:regression` runs `tests/pm-flow/tickets-regression.spec.js` (one sign-in; BUGS-508/507 share one upload). Run one ticket with e.g. `npm run tickets:regression -- --only=T548-01,T548-02,…` (dependent scenarios need their setup/source scenario in the list).
First full run 3 Nov: 27 passed, 1 failed (T543-12: the category API returns 668 categories from 13 projects – real defect), 10 skipped (Bulk Edit T517-13…16 and deferred rows).

Optional environment for the new blocks: `SCP_TKT548_SOURCE_SET`, `SCP_TKT548_ALT_SOURCE_SET`, `SCP_TKT548_ALL_CATEGORIES_ORG_SET`, `SCP_FDI_SECOND_PROJECT`, `SCP_TKT548_OTHER_ORG_PROJECT`, `SCP_TKT155_SAME_ORG_SUPPLIER`.

## Open questions
- Q-TKT-1: Should the 3 tickets' "I" rows be marked from the BUGS-543 session and the BUGS-508 tracker before automating, or automated as written from the ACs?
- Q-TKT-2: One new spec per ticket (`tests/pm-flow/tkt-bugs-517.spec.js` etc.) with an `npm run tickets:regression` entry, or added to the existing Procurement / PM regression files?
