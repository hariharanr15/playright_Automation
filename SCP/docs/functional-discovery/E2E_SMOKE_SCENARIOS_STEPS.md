# SCP E2E Smoke – Test Scenarios and Steps (TC-01 … TC-26)

Source: `SCP/tests/pm-flow/e2e-smoke.spec.js` (run with `npm run e2e:smoke`), requirements "SCP – Updated End-to-End
Smoke Automation Requirements" (12 Nov 2026). Staging, project NRVC_Hall, location Warehoust _NR.
Steps are listed as executed in **Run 4** (the first run that executed every test case); the result columns show Run 4
and Run 5 (latest, with the single-execution and no-reload changes). "—" = the step did not run in that run.

## Evidence (videos and reports)

| Run | Started (UTC) | Result | Video (MP4, 1920×1080) | Step report (screenshots per step) |
|---|---|---|---|---|
| Run 4 | 07:26 | 29 test cases · 166 steps: 157 pass, 4 fail, 3 known defect, 2 blocked | `SCP/reports/pm-flow/e2e-smoke-2026-11-12T07-26-30-134Z/e2e-run.mp4` | `SCP/reports/pm-flow/e2e-smoke-2026-11-12T07-26-30-134Z/e2e-report.html` (+ `e2e-report.pdf`) |
| Run 5 | 08:11 | 29 test cases · 130 steps: 117 pass, 5 fail, 0 known defect, 8 blocked | `SCP/reports/pm-flow/e2e-smoke-2026-11-12T08-11-36-927Z/e2e-run.mp4` | `SCP/reports/pm-flow/e2e-smoke-2026-11-12T08-11-36-927Z/e2e-report.html` (+ `e2e-report.pdf`) |

Screenshots of every executed step are in each run's `screenshots/` folder and are embedded in its `e2e-report.html`.

## Scenario summary

| # | Test case | Module | Title | Run 4 | Run 5 |
|---|---|---|---|---|---|
| 1 | TC-01 | Authentication | Login, project and location selected once | PASS | PASS |
| 2 | TC-02 | Homepage | Homepage tabs, widgets, KPIs, Alerts / Notifications / Tasks baseline | PASS | PASS |
| 3 | TC-03 | Project Management | Create Material Category | PASS | PASS |
| 4 | TC-04 | Project Management | Upload new material (Material Master upload only) | PASS | PASS |
| 5 | TC-05 | Supplier Management | Create Supplier and Subcontractor records | PASS | PASS |
| 6 | TC-06 | User Management | Create one normal organisation user | FAIL | FAIL |
| 7 | TC-07 | Supplier Management | Material-to-Supplier mapping (one popup) | PASS | PASS |
| 8 | TC-19 | FDI Configuration | FDI question set, category, group and questions | PASS | PASS |
| 9 | TC-08 | Procurement Log | Create one submittal with the primary material | PASS | PASS |
| 10 | TC-09 | Procurement Log | Add the secondary material with "+ Add material" | PASS | PASS |
| 11 | TC-10 | Procurement Log | Components and lead-time confirmation | PASS | PASS |
| 12 | TC-10B | Procurement Log | Delivery booking for each component | PASS | PASS |
| 13 | TC-11 | Procurement Log | Status filter and Export | PASS | PASS |
| 14 | TC-12 | Procurement Log | Assign Responsible user | PASS | PASS |
| 15 | TC-13 | Procurement Log | Bulk Edit Spec Description: Confirm, then Roll Back validation | PASS | PASS |
| 16 | TC-14 | Procurement Log | Create Procurement alert | FAIL | FAIL |
| 17 | TC-15 | Supplier | Logout Project Admin, login Supplier, Supplier approval | PASS | PASS |
| 18 | TC-16 | Subcontractor | Logout Supplier, login Subcontractor, Subcontractor approval | PASS | PASS |
| 19 | TC-17 | Procurement Log | Logout Subcontractor, login Project Admin, complete deliveries | PASS | PASS |
| 20 | TC-17B | Procurement Log | Generate and verify GRN; submittal delivered | KNOWN DEFECT | FAIL |
| 21 | TC-18 | FDI Configuration | Assign the new user as inspector of the new material | PASS | PASS |
| 22 | TC-20 | First Delivery Inspections | FDI record generated for the run delivery | PASS | BLOCKED |
| 23 | TC-21 | First Delivery Inspections | Self Assign, fill, save and submit the inspection | PASS | BLOCKED |
| 24 | TC-22 | First Delivery Inspections | Filter and view the submitted inspection | PASS | BLOCKED |
| 25 | TC-23 | Management Dashboard | Previous vs current KPI values | KNOWN DEFECT | BLOCKED |
| 26 | TC-23B | Alerts / Notifications / Tasks | Alerts, Notifications and Tasks of the run | FAIL | BLOCKED |
| 27 | TC-24 | Analytics | Analytics against reference data and currency configuration | FAIL | BLOCKED |
| 28 | TC-25 | Reporting | Detailed execution report generated | PASS | FAIL |
| 29 | TC-26 | Authentication | Logout the active account | PASS | PASS |

## Test steps

### TC-01 · Login, project and location selected once
_Module: Authentication_ · Run 4: **PASS** · Run 5: **PASS**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-01.01 | Open the SCP login page and log in as Project Admin (ha***@neuralrays.ai) | that account is the active user | PASS | PASS |
| TC-01.02 | Supply Chain Planner; select project NRVC_Hall and location Warehoust _NR exactly once | header shows both; role Project Admin | PASS | PASS |
| TC-01.03 | Browser zoom | 100 % (device scale factor 1) | PASS | PASS |

### TC-02 · Homepage tabs, widgets, KPIs, Alerts / Notifications / Tasks baseline
_Module: Homepage_ · Run 4: **PASS** · Run 5: **PASS**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-02.01 | Homepage (Management Dashboard) shown | main navigation tabs captured with their visibility | PASS | PASS |
| TC-02.02 | Homepage widgets and modules | summary KPIs, dashboard views and urgent issues captured | PASS | PASS |
| TC-02.03 | Management Dashboard baseline (project, no date filter on the KPIs) | KPIs, submittals by status and every category row captured | PASS | PASS |
| TC-02.04 | Alerts, Notifications and Tasks | unread counts captured (baseline) | PASS | PASS |
| TC-02.05 | Homepage screenshot | saved for the report | PASS | PASS |

### TC-03 · Create Material Category
_Module: Project Management_ · Run 4: **PASS** · Run 5: **PASS**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-03.01 | Material Category: search "20261112" | next free name "Material Category <N> 20261112" (not used yet) | PASS | PASS |
| TC-03.02 | Project Management › Reference Data › Material Category › "Add Material Category": Name "<new name>", "Add" (once) | form closes | PASS | PASS |
| TC-03.03 | Material Category: search the new name | listed exactly once (name and created date recorded) | PASS | PASS |

### TC-04 · Upload new material (Material Master upload only)
_Module: Project Management_ · Run 4: **PASS** · Run 5: **PASS**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-04.01 | Material Master: search "20261112" | next free name "Material <N> 20261112" | PASS | PASS |
| TC-04.02 | Material Master › "Upload" › "Download Template" (Manual Entry / Add Material is not opened) | template with sheet "Materials" and UoM list | PASS | PASS |
| TC-04.03 | Material Master › "Upload" › "Upload File" (once): one row "<new material>" in the new category | Total rows 1, Succeeded 1, Duplicates 0, Rejected 0, New categories 0 | PASS | PASS |
| TC-04.04 | Material Master: search the new material | exactly one material in the new category, UoM recorded; Material ID stored | PASS | PASS |
| TC-04.05 | Material Master: existing secondary material "43 Inches" | listed; its ID and category recorded | PASS | PASS |

### TC-05 · Create Supplier and Subcontractor records
_Module: Supplier Management_ · Run 4: **PASS** · Run 5: **PASS**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-05.01 | Supplier List: search "20261112" | next free names "Supplier <N> 20261112" and "Subcontractor <N> 20261112" | PASS | PASS |
| TC-05.02 | Supplier List › "Add Supplier": supplier name, address and contact entered once, "Save" once | toast "added successfully" | PASS | PASS |
| TC-05.03 | Supplier List: search the new supplier | exactly one row, Type "Supplier"; ID stored | PASS | PASS |
| TC-05.04 | Supplier List › "Add Supplier" with "Is Sub-Contractor" on: subcontractor name, address and contact entered once, "Save" once | toast "added successfully" | PASS | PASS |
| TC-05.05 | Supplier List: search the new subcontractor | exactly one row, Type "Subcontractor"; ID stored | PASS | PASS |

### TC-06 · Create one normal organisation user
_Module: User Management_ · Run 4: **FAIL** · Run 5: **FAIL**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-06.01 | User Management: search "testuser" | next free user "testuser<N> 20261112" (login e-mail with a run suffix) | PASS | PASS |
| TC-06.02 | User Management › "Invite Users" (normal, non-SSO user): e-mail, Role "Subcontractor", Organization = the new subcontractor "Subcontractor 4 20261112" if offered, else "Voyage Control"; "Send Invites" once | toast "Invite Sent Successfully"; pause 2 s | PASS | PASS |
| TC-06.03 | Invite Users › Organization offers the new subcontractor organisation "Subcontractor 4 20261112" |  | FAIL · optional | FAIL · optional |

### TC-07 · Material-to-Supplier mapping (one popup)
_Module: Supplier Management_ · Run 4: **PASS** · Run 5: **PASS**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-07.01 | Supplier Supplier 4 20261112 › "Map Material" (panel opened once): Material 4 20261112 – 1 week(s), 43 Inches – 2 week(s), "SUBMIT" per missing material; panel closed once |  | PASS | — |
| TC-07.02 | Mapping rows | each material listed once with its Material ID and lead time | PASS | PASS |

### TC-19 · FDI question set, category, group and questions
_Module: FDI Configuration_ · Run 4: **PASS** · Run 5: **PASS**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-19.01 | First Delivery Inspection Config: existing question sets | next free "FDI Question Set <N> 20261112", "FDI Category <N> 20261112", "FDI Group <N> 20261112" | PASS | PASS |
| TC-19.02 | "New Question Set": name, Specific categories = the run material category "Material Category 4 20261112" (links Material 4 20261112) and new category "<FDI Category>", "Create Question Set" | set tab appears | PASS | PASS |
| TC-19.03 | FDI category "<FDI Category>" created with the set |  | PASS · optional | PASS · optional |
| TC-19.04 | Set › "Manage Groups" › "Add Group": "<FDI Group>" | listed in the groups table | PASS | PASS |
| TC-19.05 | Set › "Add Question": "Delivered quantity matches the PO (FDI 3 20261112)", Answer Type "Text" | listed in the set | PASS | PASS |
| TC-19.06 | Question "Delivered quantity matches the PO (FDI 3 20261112)" › Group = "<FDI Group>" | kept | PASS | PASS |
| TC-19.07 | Set › "Add Question": "Packaging and labels are intact (FDI 3 20261112)", Answer Type "Text" | listed in the set | PASS | PASS |
| TC-19.08 | Question "Packaging and labels are intact (FDI 3 20261112)" › Group = "<FDI Group>" | kept | PASS | PASS |
| TC-19.09 | Question set | both questions in the group, type text, Enabled; set covers the run material category | PASS | PASS |
| TC-19.10 | Supplier association | the question set has no supplier field (sets are chosen by material category); Supplier 4 20261112 recorded | PASS · optional | PASS · optional |

### TC-08 · Create one submittal with the primary material
_Module: Procurement Log_ · Run 4: **PASS** · Run 5: **PASS**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-08.01 | Procurement Log: search "20261112" | next free submittal number "submittal <N> 20261112" | PASS | PASS |
| TC-08.02 | Procurement Log › "Add Submittal" (once): number, spec, description, Schedule Id 20261112072601, supplier Supplier 4 20261112, ONLY material Material 4 20261112 | toast "Submittal added successfully" | PASS | PASS |
| TC-08.03 | Search the submittal | exactly one, Supplier Supplier 4 20261112, Source "Manual", Material Name exactly Material 4 20261112 (one material) | PASS | PASS |
| TC-08.04 | Open the submittal | Submittal ID stored | PASS | PASS |

### TC-09 · Add the secondary material with "+ Add material"
_Module: Procurement Log_ · Run 4: **PASS** · Run 5: **PASS**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-09.01 | Open the submittal (component creation drawer) | Materials bar shows Material 4 20261112 (primary) | PASS | PASS |
| TC-09.02 | Materials bar › "+ Add material" › 43 Inches | chip added to the same submittal | PASS | PASS |
| TC-09.03 | Reload the submittal | same Submittal ID 163e2ebf-f635-472f-bb87-6e2bbb89befc; materials exactly Material 4 20261112 and 43 Inches; "(primary)" still Material 4 20261112 | PASS | — |
| TC-09.04 | Procurement Log: search the submittal | still exactly one submittal (no new one); Material Name "Material 4 20261112 +1" | PASS | PASS |

### TC-10 · Components and lead-time confirmation
_Module: Procurement Log_ · Run 4: **PASS** · Run 5: **PASS**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-10.01 | Drawer › "Add Component": material Material 4 20261112, Date Req. on Site 10/12/2026, QTY 10, Value 1000, PO E2E2611120726-PO-NEW, PO Date 12/11/2026 | toast "Schedule added successfully!", status "Ordered" | PASS | — |
| TC-10.02 | Drawer › "Add Component": material 43 Inches, Date Req. on Site 17/12/2026, QTY 5, Value 500, PO E2E2611120726-PO-EXISTING, PO Date 12/11/2026 | toast "Schedule added successfully!", status "Ordered" | PASS | PASS |
| TC-10.03 | Submittal | exactly 2 components, one per material | PASS | PASS |
| TC-10.04 | Material 4 20261112: lead time shown by the application | 1 week(s) (supplier mapping); Expected Delivery = PO Date + 1 week(s) = 19/11/2026 | PASS | — |
| TC-10.05 | Material 4 20261112: "Lead Time" › 1 week(s), tick confirm, "Submit" | "Lead time status" exactly "Confirmed"; Expected Delivery (delivery schedule) still 19/11/2026 | PASS | — |
| TC-10.06 | Material 4 20261112: business rule | Expected Delivery 19/11/2026 on or before Date Required on Site 10/12/2026; not "At Risk" | PASS | — |
| TC-10.07 | 43 Inches: lead time shown by the application | 2 week(s) (supplier mapping); Expected Delivery = PO Date + 2 week(s) = 26/11/2026 | PASS | PASS |
| TC-10.08 | 43 Inches: "Lead Time" › 2 week(s), tick confirm, "Submit" | "Lead time status" exactly "Confirmed"; Expected Delivery (delivery schedule) still 26/11/2026 | PASS | PASS |
| TC-10.09 | 43 Inches: business rule | Expected Delivery 26/11/2026 on or before Date Required on Site 17/12/2026; not "At Risk" | PASS | PASS |

### TC-10B · Delivery booking for each component
_Module: Procurement Log_ · Run 4: **PASS** · Run 5: **PASS**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-10B.01 | Material 4 20261112 › "+ Log Delivery": delivery date 19/11/2026 (confirmed expected date), first location of Warehoust _NR, item Material 4 20261112, QTY 10, "Add" | booking awaits "Pre Shipping Info" | PASS | — |
| TC-10B.02 | Material 4 20261112: reload the component | exactly one booking, dated 19/11/2026, on the run submittal | PASS | — |
| TC-10B.03 | 43 Inches › "+ Log Delivery": delivery date 26/11/2026 (confirmed expected date), first location of Warehoust _NR, item 43 Inches, QTY 5, "Add" | booking awaits "Pre Shipping Info" | PASS | PASS |
| TC-10B.04 | 43 Inches: reload the component | exactly one booking, dated 26/11/2026, on the run submittal | PASS | PASS |

### TC-11 · Status filter and Export
_Module: Procurement Log_ · Run 4: **PASS** · Run 5: **PASS**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-11.01 | Procurement Log › "Status" › "Ordered" | every listed row has Status "Ordered"; item count recorded | PASS | PASS |
| TC-11.02 | "Export" with the "Ordered" filter | Submittal_Report_<yyyymmdd>.xlsx downloaded | PASS | PASS |
| TC-11.03 | Export content | one data row per filtered submittal (Procurement Log item count, all pages), every row status "Ordered" | PASS | PASS |
| TC-11.04 | Filtered list › search the run submittal | listed (it is "Ordered") and in the export; clear the filter | PASS | PASS |

### TC-12 · Assign Responsible user
_Module: Procurement Log_ · Run 4: **PASS** · Run 5: **PASS**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-12.01 | Run submittal › row "⋮" › "Assign Responsible" › "Choose user": ha***@neuralrays.ai, "Assign" once | toast "Responsible user assigned." | PASS | PASS |
| TC-12.02 | Procurement Log: the run submittal | "Responsible" shows the assigned user | PASS | PASS |

### TC-13 · Bulk Edit Spec Description: Confirm, then Roll Back validation
_Module: Procurement Log_ · Run 4: **PASS** · Run 5: **PASS**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-13.01 | Procurement Log | no bulk update is waiting for review (a pending review blocks search and filters) | PASS | PASS |
| TC-13.02 | Procurement Log: search "E2E26" | two earlier run submittals chosen (not this run's) | PASS | PASS |
| TC-13.03 | Bulk Edit Log | batches counted (baseline) | PASS | PASS |
| TC-13.04 | Tick both rows › "Select Columns for Bulk Edit" › "Spec Description" › "Next" › value "Spec description Update at <date time>" › "Preview Changes" | preview lists both records and the new value | PASS | PASS |
| TC-13.05 | Preview › "Confirm & Apply" (once) | banner "Bulk Update #N — reviewing changes", 2 applied | PASS | PASS |
| TC-13.06 | Banner › "Confirm" (once) | toast "Bulk update confirmed."; banner gone | PASS | PASS |
| TC-13.07 | Both submittals | Spec Description equals the confirmed value | PASS | PASS |
| TC-13.08 | Bulk Edit Log | the confirmed "Spec Description" batch is listed | PASS | PASS |
| TC-13.09 | Second bulk edit: same rows › Spec Description › another timestamped value › "Preview Changes" | preview shows the new value | PASS | PASS |
| TC-13.10 | Preview › "Confirm & Apply" (once) | second batch waiting for review; rows show the pending value | PASS | PASS |
| TC-13.11 | Banner › "Roll Back" (once) | banner gone; the pending update is discarded | PASS | PASS |
| TC-13.12 | Both submittals | Spec Description back to the confirmed value (second update not committed) | PASS | PASS |

### TC-14 · Create Procurement alert
_Module: Procurement Log_ · Run 4: **FAIL** · Run 5: **FAIL**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-14.01 | Run submittal › row "⋮" › "Alert" › "Add Alert": field (first "Total Count" field), condition "<=", value 999999, message, recipient Hariharan R Raja, "Submit" once | toast "Alert created successfully!" | FAIL | PASS |
| TC-14.02 | Alert list of the submittal | the rule shows its field, condition, value, message, user and status | BLOCKED | FAIL |
| TC-14.03 | Alert condition met | status "Sent" (a met rule is sent at once; otherwise it waits for the daily alert batch) | BLOCKED · optional | BLOCKED · optional |

### TC-15 · Logout Project Admin, login Supplier, Supplier approval
_Module: Supplier_ · Run 4: **PASS** · Run 5: **PASS**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-15.01 | Log out Project Admin (avatar menu › Logout) | login page shown | PASS | PASS |
| TC-15.02 | Wait for the login page, pause 3 s, log in as Supplier (existing account) (te***@yopmail.com) | that account is the active user | PASS | PASS |
| TC-15.03 | Open Supply Chain Planner, select NRVC_Hall and Warehoust _NR (once for this login) | role "Supplier" | PASS | PASS |
| TC-15.04 | Supplier: Procurement Log › submittal 4 20261112 › Material 4 20261112 | its booking is listed | PASS | — |
| TC-15.05 | Supplier: Material 4 20261112 booking › "Pre Shipping Info": comment and YES for every question, supplier note, "Confirm Checklist" | toast "Shipping Details updated successfully!" | PASS | — |
| TC-15.06 | Supplier: Material 4 20261112 booking status | waiting for subcontractor approval | PASS | — |
| TC-15.07 | Supplier: Procurement Log › submittal 4 20261112 › 43 Inches | its booking is listed | PASS | — |
| TC-15.08 | Supplier: 43 Inches booking › "Pre Shipping Info": comment and YES for every question, supplier note, "Confirm Checklist" | toast "Shipping Details updated successfully!" | PASS | PASS |
| TC-15.09 | Supplier: 43 Inches booking status | waiting for subcontractor approval | PASS | PASS |

### TC-16 · Logout Supplier, login Subcontractor, Subcontractor approval
_Module: Subcontractor_ · Run 4: **PASS** · Run 5: **PASS**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-16.01 | Log out Supplier (existing account) (avatar menu › Logout) | login page shown | PASS | PASS |
| TC-16.02 | Pause 3 s; Yopmail te***@yopmail.com › "Accept Invite" | set password → profile "testuser4 20261112" → signed in (no organisation setup) | PASS | PASS |
| TC-16.03 | Log out after activation | login page (the account then uses the standard login) | PASS | PASS |
| TC-16.04 | Wait for the login page, pause 3 s, log in as Subcontractor (new user) (te***@yopmail.com) | that account is the active user | PASS | PASS |
| TC-16.05 | Open Supply Chain Planner, select NRVC_Hall and Warehoust _NR (once for this login) | role "Subcontractor", organisation Voyage Control | PASS | PASS |
| TC-16.06 | Subcontractor: Procurement Log › submittal 4 20261112 › Material 4 20261112 | its booking awaits approval | PASS | — |
| TC-16.07 | Subcontractor: Material 4 20261112 booking › "Approve Pre-Shipping Checklist": comment, "Approve" | toast "Checklist Generated Successfully!" | PASS | — |
| TC-16.08 | Subcontractor: Material 4 20261112 booking status | "Approved" | PASS | — |
| TC-16.09 | Subcontractor: Procurement Log › submittal 4 20261112 › 43 Inches | its booking awaits approval | PASS | — |
| TC-16.10 | Subcontractor: 43 Inches booking › "Approve Pre-Shipping Checklist": comment, "Approve" | toast "Checklist Generated Successfully!" | PASS | PASS |
| TC-16.11 | Subcontractor: 43 Inches booking status | "Approved" | PASS | PASS |

### TC-17 · Logout Subcontractor, login Project Admin, complete deliveries
_Module: Procurement Log_ · Run 4: **PASS** · Run 5: **PASS**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-17.01 | Log out Subcontractor (new user) (avatar menu › Logout) | login page shown | PASS | PASS |
| TC-17.02 | Wait for the login page, pause 3 s, log in as Project Admin (ha***@neuralrays.ai) | that account is the active user | PASS | PASS |
| TC-17.03 | Open Supply Chain Planner, select NRVC_Hall and Warehoust _NR (once for this login) | role "Admin" | PASS | PASS |
| TC-17.04 | Material 4 20261112: lead time reconfirmed | status "Confirmed", Expected Delivery 19/11/2026 | PASS | — |
| TC-17.05 | Material 4 20261112: booking › supplier and subcontractor approvals done ("Approved", no pending checklist action) |  | PASS | — |
| TC-17.06 | Material 4 20261112: booking › "Edit" › Actual Delivery Date 12/11/2026, "Update" | form closes | PASS | — |
| TC-17.07 | Material 4 20261112: booking › "Update Shipping Info": mode "Other", reference, origin, note | toast "Shipping Details updated successfully!" | PASS | — |
| TC-17.08 | Material 4 20261112: booking › "Update Delivery Condition": Goods 10, Damage 0 | toast "Delivery Conditions updated successfully!" | PASS | — |
| TC-17.09 | Material 4 20261112: Shortage for the complete delivery | 0 | PASS | — |
| TC-17.10 | 43 Inches: lead time reconfirmed | status "Confirmed", Expected Delivery 26/11/2026 | PASS | PASS |
| TC-17.11 | 43 Inches: booking › supplier and subcontractor approvals done ("Approved", no pending checklist action) |  | PASS | PASS |
| TC-17.12 | 43 Inches: booking › "Edit" › Actual Delivery Date 12/11/2026, "Update" | form closes | PASS | PASS |
| TC-17.13 | 43 Inches: booking › "Update Shipping Info": mode "Other", reference, origin, note | toast "Shipping Details updated successfully!" | PASS | PASS |
| TC-17.14 | 43 Inches: booking › "Update Delivery Condition": Goods 5, Damage 0 | toast "Delivery Conditions updated successfully!" | PASS | PASS |
| TC-17.15 | 43 Inches: Shortage for the complete delivery | 0 | PASS | PASS |

### TC-17B · Generate and verify GRN; submittal delivered
_Module: Procurement Log_ · Run 4: **KNOWN DEFECT** · Run 5: **FAIL**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-17B.01 | Material 4 20261112: booking › "Generate GRN" | toast "GRN Generated Successfully!"; GRN PDF captured | PASS | — |
| TC-17B.02 | Material 4 20261112: GRN PDF (booking › files › ⋮ › Download) | "GOODS RECEIVED NOTE" with a Receipt No., PO E2E2611120726-PO-NEW, shipping E2E2611120726-new-SHIP, supplier ID, received 12/11/2026, item Material 4 20261112 × 10 | PASS | — |
| TC-17B.03 | Material 4 20261112: component view | QTY Received 10, Remaining QTY 0, Value Delivered recorded; status "Delivered" | PASS | — |
| TC-17B.04 | 43 Inches: booking › "Generate GRN" | toast "GRN Generated Successfully!"; GRN PDF captured | PASS | BLOCKED |
| TC-17B.05 | 43 Inches: GRN PDF (booking › files › ⋮ › Download) | "GOODS RECEIVED NOTE" with a Receipt No., PO E2E2611120726-PO-EXISTING, shipping E2E2611120726-existing-SHIP, supplier ID, received 12/11/2026, item 43 Inches × 5 | PASS | BLOCKED |
| TC-17B.06 | 43 Inches: component view | QTY Received 5, Remaining QTY 0, Value Delivered recorded; status "Delivered" | PASS | BLOCKED |
| TC-17B.07 | Procurement Log: the run submittal | Status "Delivered" (all components) and Actual Delivery Date 12/11/2026 | KNOWN DEFECT (SCP-DEF-043) | BLOCKED |
| TC-17B.08 | User Management: te***@yopmail.com | "Active", role Subcontractor, organisation Voyage Control | PASS | BLOCKED |

### TC-18 · Assign the new user as inspector of the new material
_Module: FDI Configuration_ · Run 4: **PASS** · Run 5: **PASS**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-18.01 | FDI Config › "Add Inspector": project member te***@yopmail.com (the new user, organisation Voyage Control), role "Subcontractor" if offered, scope "Specific Materials" = Material 4 20261112 | inspector row listed | PASS | PASS |
| TC-18.02 | Inspectors table | the new user is scoped to Material 4 20261112; status recorded (invite accepted in TC-16) | PASS | PASS |
| TC-18.03 | Project Admin ha***@neuralrays.ai | an enabled inspector covering Material 4 20261112 (performs the inspection in TC-21) | PASS | PASS |

### TC-20 · FDI record generated for the run delivery
_Module: First Delivery Inspections_ · Run 4: **PASS** · Run 5: **BLOCKED**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-20.01 | First Delivery Inspections | a record for Material 4 20261112 / Supplier 4 20261112 / submittal 4 20261112 is generated (first delivery of the new material) | PASS | — |
| TC-20.02 | FDI record | material, supplier, submittal and delivery date 12/11/2026 match the run; status "Auditor Not Yet Assigned" (or already assigned/completed by the first attempt) | PASS | — |
| TC-20.03 | Second material 43 Inches (not its first delivery) | no FDI record for the run submittal | PASS · optional | — |

### TC-21 · Self Assign, fill, save and submit the inspection
_Module: First Delivery Inspections_ · Run 4: **PASS** · Run 5: **BLOCKED**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-21.01 | FDI record › "Self Assign" (Project Admin, enabled inspector for all materials) | status "Awaiting Inspection Completion", assigned to ha***@neuralrays.ai | PASS | — |
| TC-21.02 | "Fill Inspection Report" | questionnaire shows the run questions (2) of FDI Question Set 3 20261112; every response filled; photo added when uploads are enabled; "Save Progress" | PASS | — |
| TC-21.03 | Saved values | every response field keeps the entered value | PASS | — |
| TC-21.04 | "Submit Inspection" (once) | status "inspection completed" | PASS | — |
| TC-21.05 | FDI list | the run record shows "Inspection Completed", inspector ha***@neuralrays.ai | PASS | — |

### TC-22 · Filter and view the submitted inspection
_Module: First Delivery Inspections_ · Run 4: **PASS** · Run 5: **BLOCKED**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-22.01 | First Delivery Inspections › filters Material "Material 4 20261112" and Status "Inspection Completed" | the run record is listed and every row matches the filter | PASS | — |
| TC-22.02 | "View" | Inspection Detail: material, submittal, status "inspection completed", inspector, the run questions and their answers | PASS | — |

### TC-23 · Previous vs current KPI values
_Module: Management Dashboard_ · Run 4: **KNOWN DEFECT** · Run 5: **BLOCKED**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-23.01 | Management Dashboard (same project, same filters as the baseline) | current values captured | PASS | — |
| TC-23.02 | Submittal count | +1 (one submittal, however many components) | PASS | — |
| TC-23.03 | Submittals by status | counts add up to the total; "Delivered" +1; open submittals unchanged | PASS | — |
| TC-23.04 | Material categories in scope | +1 (the new category, the primary material's, now has a submittal) | PASS | — |
| TC-23.05 | Delivery count | deliveries with an actual date +2 and on-time deliveries +2 (one per component) | PASS | — |
| TC-23.06 | Materials row of the new category (primary material) | row appears with submittals 1, open 0 | PASS | — |
| TC-23.07 | Procurement value of the new category | Spend rises by the submittal's total Procurement Log "Value Delivered" (₹1,000.00 + ₹500.00), in the same currency | KNOWN DEFECT (SCP-DEF-049) | — |
| TC-23.08 | Materials row "TV" (43 Inches, not the primary material) | unchanged: submittals, open and spend | PASS | — |
| TC-23.09 | Delivered quantity | no quantity KPI on the Management Dashboard; delivered quantities verified per component (TC-17B) and in Analytics (TC-24): Material 4 20261112 10, 43 Inches 5 | PASS · optional | — |
| TC-23.10 | Alerts, Notifications, Tasks | unread counts compared with the baseline (shared project: other users also change them) | PASS · optional | — |

### TC-23B · Alerts, Notifications and Tasks of the run
_Module: Alerts / Notifications / Tasks_ · Run 4: **FAIL** · Run 5: **BLOCKED**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-23B.01 | Alerts | "Pre-Shipping Checklist has been pending." at least 2 times today (one per booking) | PASS | — |
| TC-23B.02 | Alerts | "Delivery of 10 units of Material 4 20261112 logged for submittal submittal 4 20261112", dated today | PASS | — |
| TC-23B.03 | Notifications | "Delivery of 10 units of Material 4 20261112 has been received at site for submittal submittal 4 20261112", dated today | PASS | — |
| TC-23B.04 | Alerts | "Delivery of 5 units of 43 Inches logged for submittal submittal 4 20261112", dated today | PASS | — |
| TC-23B.05 | Notifications | "Delivery of 5 units of 43 Inches has been received at site for submittal submittal 4 20261112", dated today | PASS | — |
| TC-23B.06 | Alerts | "Pre-Shipping Checklist has been approved." at least 2 times today (one per booking) | PASS | — |
| TC-23B.07 | Tasks | "First delivery of Material 4 20261112 received … submittal submittal 4 20261112" (new material), dated today, with a status | PASS | — |
| TC-23B.08 | Alerts | the TC-14 alert rule "Alert for submittal 4 20261112: total count within limit" when it was sent | FAIL · optional | — |
| TC-23B.09 | Tasks | no first-delivery task expected for 43 Inches (not its first delivery) → recorded | PASS · optional | — |

### TC-24 · Analytics against reference data and currency configuration
_Module: Analytics_ · Run 4: **FAIL** · Run 5: **BLOCKED**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-24.01 | Project Management › Configuration Options | configured "Currency Type" captured | PASS | — |
| TC-24.02 | Reference Data › Common Utilities | the configured currency is a "currency_type" utility | PASS · optional | — |
| TC-24.03 | Reference Data › Common UoM | the materials' units (Board Feet, Pieces) are listed | PASS · optional | — |
| TC-24.04 | Procurement Log "Value Delivered" of the run components | in the configured currency | PASS | — |
| TC-24.05 | Analytics › Status Report › "Generate" | row for submittal 4 20261112: material Material 4 20261112, supplier Supplier 4 20261112, QTY Delivered On Time 15 (both components) | FAIL | — |
| TC-24.06 | Analytics › Lead Time Analysis | category "Material Category 4 20261112" (primary material) is listed | PASS | — |
| TC-24.07 | Management Dashboard spend of "Material Category 4 20261112" | shown in the configured currency (₹) | KNOWN DEFECT (SCP-DEF-049) | — |

### TC-25 · Detailed execution report generated
_Module: Reporting_ · Run 4: **PASS** · Run 5: **FAIL**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-25.01 | Final validation | category, material, supplier, subcontractor, user, FDI set, one submittal with two materials, components, bookings, GRNs, FDI inspection recorded | PASS | FAIL |
| TC-25.02 | Project and location selected once per login (4 selection(s) for 5 login(s)) |  | PASS | FAIL |
| TC-25.03 | Execution report | e2e-report.html exists; every executed step has an ID, status, duration and a screenshot | PASS | PASS |
| TC-25.04 | Execution report | e2e-report.pdf generated | PASS | PASS |

### TC-26 · Logout the active account
_Module: Authentication_ · Run 4: **PASS** · Run 5: **PASS**

| Step | Action | Expected result | Run 4 | Run 5 |
|---|---|---|---|---|
| TC-26.01 | Management Dashboard | final screenshot | PASS | PASS |
| TC-26.02 | Log out Project Admin (avatar menu › Logout) | login page shown | PASS | PASS |
