# SCP – Items pending client / team confirmation

**Created:** 21 Nov 2026 · **Modules:** Inventory Management (items 1–8), Project Management (9, 17), Procurement Log (10–14, 18, 19), Document Management (15), Management Dashboard (16)
**Environment:** staging, project NRVC_Hall, site "Warehoust _NR", material "43 Inches"

## Why this list exists

The client cannot answer our questions at the moment. So the automation flow runs on what the application does today, and every item that looks logically wrong is recorded here and registered as a Known Defect in `config/scp-known-defects.js`. Nothing has been raised in Jira.

- An item tagged **Pending confirmation** is today's behaviour, not an agreed defect. When the team answers, each entry is either kept (confirmed defect), changed (new expected behaviour), or removed (the application is right; the test is then changed to expect today's behaviour).
- A registered item that suddenly passes is flagged in the report as "not reproduced", so a silent fix is noticed.

## Shared steps

Sign in → Supply Chain Planner → header project **NRVC_Hall** → header site **Warehoust _NR** → sidebar **Inventory Management** → search **43 Inches**.

## Items

| # | Defect ID | Test | Status | What we see today | Question for the team |
|---|---|---|---|---|---|
| 1 | SCP-DEF-053 | INV-REG-12 | Pending confirmation | Add Activity hint "Available at Gate 5: **68**"; ⋮ › Location view shows Gate 5 = **94**. Both were read 7 s apart with no activity in between. The save check uses 68. The Location view rows add up to more than the site total (589). | Which figure is the correct stock at a location? Should the two screens always agree? |
| 2 | SCP-DEF-054 | INV-REG-09 | Pending confirmation | QTY 1.555 is rejected and the stock is unchanged, but the message is only "Invalid data provided. Invalid data provided." | How many decimal places are allowed, and what should the message say? |
| 3 | SCP-DEF-055 | INV-REG-15 | Pending confirmation | After a Loss of 1 the list still shows 587, not 586, until a full page reload. | Must the list refresh right after an activity is saved? |
| 4 | SCP-DEF-056 | INV-REG-20 | Pending confirmation | The ledger column "Submittal" shows `PLD1102-SPEC-07` (Spec Section No), not `PLD1102-SUB-07`. | Is the column name wrong, or is it showing the wrong value? |
| 5 | SCP-DEF-058 | INV-REG-23 | Pending confirmation | After switching the header site and reloading, a different site is shown (chose `Site T2 Pmr2-2611011614`, after reload `Site T2 Pmr2-2611201108`). | Must the chosen site survive a page reload? |
| 6 | SCP-DEF-057 | INV-REG-22 | **Confirmed rule (INV-R2)** | "Export" downloads the activity log, not the stock balance list (Material ID, Material Name, Inventory). | None. The rule is confirmed; only the fix is pending. |
| 7 | SCP-DEF-045 | INV-REG-14 | Registered 2 Nov | Activity can be saved with a schedule from a different submittal. **21 Nov 08:37 run: not reproduced** (no mismatched row was saved). Watch the next runs before removing it. | Has this been fixed? |
| 8 | — | INV-REG-18 | Observed behaviour, pending confirmation | The upload checks rows top to bottom and deducts earlier valid rows before checking the next one. For "Loss 1" then "Loss 99999" at Gate 5 with 52 in stock, the error file says 51 available. The test now expects this. | Is it intended that the "available" figure in the error file already deducts earlier rows of the same file? |
| 9 | SCP-DEF-063 | PM-REG-PSC-02 | Pending confirmation | PreShipping Checklist: unticking "Enabled" on a question already in use (Count 1) shows no message and is ticked again after a reload. Ticking a question ON is saved. | May a question that is already in use be disabled? If not, should the user see a message? |

## Steps per item

**1. INV-REG-12 – stock hint vs Location view**
1. On the 43 Inches row, click ⋮ › **Actions** › **Add Activity**. Choose action **Issue To Construction**.
2. Note the hint "Available at Gate 5: N". Close the form without saving.
3. Click ⋮ › **Location** and read the QTY of Gate 5.
- Expected (not confirmed): the same value as N.

**2. INV-REG-09 – three-decimal quantity**
1. Open ⋮ › **Actions** › **Add Activity**. Choose action **Loss**, QTY **1.555**, then click **ADD**.
- Confirmed behaviour: the form stays open and the Closing Balance is unchanged (the test checks this).
- Unconfirmed: the message wording.

**3. INV-REG-15 – list refresh**
1. Note the list Inventory value.
2. Add a **Loss** of 1 from the ledger.
3. Press Escape and click sidebar **Inventory Management** without reloading.
- Expected (not confirmed): the value is 1 lower.

**4. INV-REG-20 – Submittal column**
1. Open ⋮ › **Actions**.
2. Read the **Submittal** cell of a row created by a test run.

**5. INV-REG-23 – site after reload**
1. Switch the header site to another site.
2. Press F5 and read the header site.

**6. INV-REG-22 – Export**
1. On the Inventory Management list, click **Export** and open the xlsx.
2. Check the header row.

## Other modules (added 21 Nov 2026 after the full regression)

These failed in **every** full regression run from 17 to 21 Nov 2026 with the same behaviour, so they are app behaviour, not test timing. Shared steps: sign in → project **NRVC_Hall**. For Procurement Log items, use any submittal created by a run (e.g. `PLT2611211408-SUB-P`, material 43 Inches, supplier LG).

| # | Defect ID | Test | Status | What we see today | Question for the team |
|---|---|---|---|---|---|
| 10 | SCP-DEF-064 | PL-REG-LST-09 | Pending confirmation | Filters › Add Condition on the custom number field "Total Count …" with ">=" 7 returns no rows, although the submittal holds 7. There are four "Total Count …" custom fields in the log configuration. | Is ">=" supported on custom number fields? Which "Total Count" field is the real one? |
| 11 | SCP-DEF-065 | PL-REG-CMP-09 | Pending confirmation | Update Status "Ordered At Risk" with a comment, ADD: after reopening, the component is still "Ordered". | May an Ordered component move to Ordered At Risk? If not, should a message say so? |
| 12 | SCP-DEF-066 | PL-REG-DLV-18 | Pending confirmation | In the component view, clicking the "Files" tab leaves the delivery table on screen (OBS-PL-30). | Should the Files tab show the PO file, GRN and checklist PDFs? |
| 13 | SCP-DEF-067 | PL-REG-EDT-07 | Pending confirmation | After Flag International, International Shipments shows Required Date "-" and status "Pending Order" for a component that has a Required Date and is Ordered (OBS-PL-19). | Should International Shipments show the component's Required Date and procurement status? |
| 14 | SCP-DEF-068 | PL-REG-ALR-02 | Pending confirmation | Add Alert › Submit with empty fields shows "Failed to create alert. Please try again." (OBS-PL-28). | Should the form show required-field messages instead of a server error? |
| 15 | SCP-DEF-069 | DOC-REG-04 | Pending confirmation | All Documents, Category "PO File": Uploaded By is "Unknown"; Category "Pdf": "test" (OBS-DOC-1/2). | Should Uploaded By show the user who uploaded the PO file? |
| 16 | SCP-DEF-070 | DSH-REG-09 | Pending confirmation | The "Delivery for Item …" trigger alert created by the run never appears in Management Dashboard › Notifications (PL-R14, OBS-DSH-1). | Is a trigger alert delivered as a notification, and how soon? |
| 17 | SCP-DEF-071 | PM-REG-SITE-11 | Pending confirmation | Site Details › Export: 79 distinct sites in the file vs 92 on the page, one row from another project, and Location Type shown as an internal ID. | Should the export match the page, for this project only, with readable Location Types? (Possible cross-project data; for the team to assess.) |
| 18 | SCP-DEF-072 | PL-REG-CMP-18 | Pending confirmation | Component row › Other Actions › Delete › confirm: no message, and the component is still listed after a reload (lead time Confirmed, not ordered). Failed in 4 of the last 5 runs. | May a component with a confirmed lead time be deleted? If not, should a message say so? |
| 19 | SCP-DEF-073 | PL-REG-DLV-16 | Pending confirmation (intermittent) | After reloading the component view the header sometimes shows "Required QTY: 12 undefined" instead of "12 Pieces". | Is the unit loaded after the header is drawn? It should always show the unit. |

**10. PL-REG-LST-09** – Procurement Log › **Filters** › **Add Condition** › field "Total Count …", operator **>=**, value **7** › **Apply Filter**. Expected (not confirmed): the submittal with 7 is listed.

**11. PL-REG-CMP-09** – Open the submittal › component row **Other Actions ▾** › **Update Status** › "Ordered At Risk", comment, **ADD**. Reopen the submittal and read the component status.

**12. PL-REG-DLV-18** – Open a delivered component › click the **Files** tab. Expected (not confirmed): the files list replaces the delivery table.

**13. PL-REG-EDT-07** – Procurement Log › row menu › **Flag International** (country South Korea) › sidebar **International Shipments** › read the row's Required Date and status.

**14. PL-REG-ALR-02** – Procurement Log › row menu › **Alert** › **Add Alert** › **Submit** without filling anything.

**15. DOC-REG-04** – Document Management › **All Documents** › Category **PO File** › read **Uploaded By** of the first row.

**16. DSH-REG-09** – Create a trigger alert on a submittal ("Delivery for Item …"), then Management Dashboard › **Notifications** › filter **All**, search "Delivery for Item".

**17. PM-REG-SITE-11** – Project Management › **Site Details** › **Export**. Compare the distinct site names with the page, and read the Location Type column.

**18. PL-REG-CMP-18** – Open a run submittal (e.g. `PLS…-SUB-N`) › component row **Other Actions ▾** › **Delete** › confirm **Delete**. Reload and check the component list.

**19. PL-REG-DLV-16** – Open a component view (click the material cell), press F5 and read **Required QTY** in the header. Repeat a few times.

**20. SCP-DEF-074 (found by the overnight run, 22 Nov 2026)** – Between 00:00 and 05:30 IST, open any submittal › **Add Component** › choose PO Date = today in the date picker › **ADD**. The dialog shows "Invalid data provided." and the server replies "PO date cannot be in the future. Use today's date or an earlier date.", because it compares with its UTC date, which is still the day before. In the same window, the Procurement Log **Start date** = today filter hides records created that day, and Alerts/Notifications show the previous day's date on items created that night. Question: should "today" follow the user's or project's time zone? The tests now use the server's date so night runs keep working. Daytime runs and the demo are not affected.

**21. SCP-DEF-075 / T517-15 (22 Nov 2026)** – Open a submittal with one component on its primary material and confirm its lead time (component row › **Lead Time** › tick confirm › **Submit**). Then in Procurement Log tick that submittal › **Select Columns for Bulk Edit** › **Supplier Name** › another mapped supplier › **Preview Changes** › **Confirm & Apply**. In the review banner click **Roll Back**. The supplier and the lead time come back, but **Lead Time Confirmed stays False**. BUGS-517 expects Roll Back to restore the Confirmed flag too.

**22. DSH-REG-10 (question, not a defect)** – Which alerts does the 05:00–06:00 IST daily batch create, and where do they show? Without that, the case has no expected result and stays Skipped. A met alert rule raising an alert is now checked by PL-REG-ALR-05: the rule turns "Sent" at once.

**23. SCP-DEF-076 / T508-18** – Sign in as the Supplier account, open `/material-master` by URL. The Upload button is offered, although BUGS-508 limits material bulk upload to the Project Admin. The Supplier role does have Material: List/Add/Edit/Delete enabled. Should the upload follow those permissions?

**24. SCP-DEF-077 / PM-REG-ROLE-05** – The Supplier and Subcontractor roles do not enable the Project Management tab, and the menu is hidden. Even so, `/material-master` and `/site-details` open by URL for both accounts. The Subcontractor can also open `/inventory-control` and `/watched-materials`. Should every PM page be refused without PM tab access (R52)?

**25. SCP-DEF-078 / PM-REG-ROLE-08** – The Subcontractor role does not enable "Menu: Enterprise", but the Subcontractor account's left menu shows Enterprise.

**26. SCP-DEF-079 / PM-REG-FDI-05n** – Submit an inspection with Overall Notes, then switch "Need Overall Notes to be captured" to No. The submitted report no longer shows its notes. Should a submitted report stay as it was submitted?

**27. SCP-DEF-080 / PM-REG-FDI-05h** – On the inspection form, use "Add photo" to add a .pdf, .xlsx and .csv file. No error is shown, but only images appear on the form. Are only images meant to be accepted? If so, the picker should refuse the other types with a message.

**28. SCP-DEF-081 / PM-REG-SITE-07** – Site Details: a run site that had received deliveries (and showed stock in Inventory) › Delete › "Are you sure you want to proceed?" › Delete → "Site deleted successfully!". Material Master refuses to delete a material with stock history. Should a site with deliveries or stock also be refused (or at least warned)?

**29. SCP-DEF-082 / PM-REG-INT-02** – Project Management › Integrations › Booking Integration: with "Booking System Project ID" empty, Submit shows no message at all. The expected result (validation message) was confirmed on 22 Nov 2026; please confirm this is a defect.

**30. SCP-DEF-083 / SHP-REG-06** – International Shipments: changing a row's status (e.g. to "Shipped") gives no confirmation message. Is a confirmation expected? (International Shipments back in scope from 23 Nov 2026.)

**31. SCP-DEF-084 / SHP-REG-09** – Enterprise Shipments › "Open" on a shipment opens the shipments list instead of that shipment. Which page should "Open" show?

**32. SCP-DEF-067 (now also SHP-REG-03 / SHP-REG-08)** – A newly logged shipment starts at "Pending Order" and shows Required Date "-" although its submittal is already ordered/delivering and the component has a Required Date. Should the shipment take its status and Required Date from the Procurement Log?

**33. SCP-DEF-086 (PM-REG-CFG-13 / CFG-15)** – Submittals seeded on 22 Nov 2026 with Date Required on Site 28/11/2026 (one component not ordered, one ordered with an unconfirmed lead time) got no not-ordered or lead-time alert from the 23 Nov 05:00–06:00 IST batch (Management Dashboard › Alerts, searched by submittal number: only the "New submittal … was added" notice). The control submittal three weeks out correctly has none (CFG-16 passed). Did the batch run on staging, and is the alert week threshold of 1 in effect for NRVC_Hall?

**34. Analytics, re-checked automatically on 23 Nov 2026 (new suite `ana-ent`, findings of the 18 Nov validation)** – please confirm the expected behaviour for each:
- SCP-DEF-087 (ANV-AGG-02): Aggregate Stats project table shows the project ID, not the name.
- SCP-DEF-088 (ANV-AGG-03): Aggregate Stats Export gives the blank upload template, not the data.
- SCP-DEF-089 (ANV-SUB-02): SubContractor Issues Project Name shows project IDs for 55 of 214 rows.
- SCP-DEF-090 (ANV-SUB-03): SubContractor Issues repeats the project totals (1/1/13/0/14) on every NRVC_Hall subcontractor.
- SCP-DEF-091 (ANV-SUP-01): Supplier Issues KPI cards 41/41/533/574 are the sum of those duplicated rows; one value per project gives 2/14/13/14.
- SCP-DEF-092 (ANV-SUP-02): Supplier Issues Delivery Performance says "No delivery data" while 574 deliveries are impacted.
- SCP-DEF-093 (ANV-SCI-01): Supply Chain Intelligence requests carry no venue (user decision 18 Nov: the page must follow project and venue).
- SCP-DEF-094 (ANV-EMI-01): Emissions Report Export CSV has only a header while 76 shipments are listed.
- ANV-SUB-01 matches the registered SCP-DEF-034 (Over-Deliveries value not rendered).

**Note – International Shipments load time.** On 23 Nov 2026 the International Shipments list took about 200 seconds to appear (the "list-by-project" request). The tests now wait up to 6 minutes and record each slow load in the report as "SLOW PAGE". Is this load time expected on staging?

## Corrected test (not an application issue)

**INV-REG-18** compared the upload error file's "available" figure (stock at the row's From Location, e.g. Gate 5 = 59) with the ledger Closing Balance (whole site, 582). These can never be equal. Since 21 Nov it compares with the Add Activity hint for the same location, which is the figure the save check uses (INV-R3), minus the valid rows above the invalid row in the file (item 8).

## Not covered yet (gaps, not failures)

- **INV-REG-21** (damaged units counted as received): left to PL-REG-DLV-13; no executed check seen yet.
- **INV-REG-24 / 25** (date filter, activity date picker): not run because of SCP-DEF-002 (the date picker freezes the tab).
