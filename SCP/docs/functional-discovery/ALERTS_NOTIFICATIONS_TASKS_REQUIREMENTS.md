# Alerts, Notifications and Tasks – Requirements Reference

| Item | Value |
|---|---|
| Source | `Alerts-Notifications-tasks_1 3 (1).xlsx`, supplied by the product owner on 2026-10-30 (sheets: *Notifications, Tasks, Alerts*; *Statuses*; *Sheet2*; *SupplierIssues*) |
| Status | Documented requirement **[D]**. Not yet verified in the application, except where marked **[O]** |
| Precedence | Where the spreadsheet and the in-app help text disagree, the **help text is the latest rule** (product owner, 2026-10-30) |
| Scope | Rows marked "In MVP = Yes". Rows marked "No" or "Not possible now" are listed only for completeness |
| Related | [PM_FUNCTIONAL_DISCOVERY.md](PM_FUNCTIONAL_DISCOVERY.md) R11, R12, R19, R21 |

## 1. Setup parameters (Project Management › Configuration Options)

| Spreadsheet name | UI label [O] | Counted back from (spreadsheet) | UI help text [O] |
|---|---|---|---|
| Confirmation of Lead time weeks before | Lead time confirmation (weeks) | **Date Required on Site (ROS)** | "…weeks before the required-on-site date we expect a confirmed lead time…" – matches |
| Not ordered status alert weeks before | Not ordered alert (weeks) | ~~Last Possible Ordering Date~~ → **Date Required on Site** (help text is the latest rule) | "…weeks before required-on-site after which an unordered item raises an alert" – **governs** |
| Item not booked on Site alert weeks before | Not booked alert (weeks) | **Date Required on Site** | "…weeks before required-on-site after which an unbooked delivery raises an alert…" – matches |

## 2. Derived dates (formulas)

| Name | Formula |
|---|---|
| Last Possible Ordering Date (LPOD) | `ROS − lead time (weeks × 7 days)` |
| Last date for lead-time confirmation | `ROS − (Lead time confirmation weeks × 7)` |
| Not-ordered alert point | `ROS − (Not ordered alert weeks × 7)` (help text, latest) |
| Subcontractor "create PO" task due date | `LPOD − (Not ordered alert weeks × 7)` (spreadsheet rule, confirmed 2026-10-30) |
| Not-booked check point | `ROS − (Not booked alert weeks × 7)` |
| Not-booked task completion date | `today + 2 days` |
| Expected delivery if ordered today | `today + lead time` |
| Expected delivery for an ordered item | `PO (order) date + lead time` |

**Worked example** (to be confirmed): ROS = 30 Nov, lead time = 4 weeks, all three settings = 1 week →
LPOD = 2 Nov; **create-PO task due 26 Oct** (confirmed); not-ordered alert from 23 Nov if still not ordered; last lead-time confirmation date = 23 Nov; not-booked check from 23 Nov.

Note: the same setting (*Not ordered alert weeks*) is used twice, from different dates: the **task due date** counts back from the LPOD, the **alert** counts back from ROS.

## 3. Visibility rules (Sheet2)

- Alerts and notifications belong to the **project**: everyone on the project can see them.
- Tasks belong to a **party**: the subcontractor or the construction company.
- **Who creates the PO:** the subcontractor, when their configured role grants that access (role access is configurable, PM rule R9; product owner, 2026-10-30). So the "create PO" tasks (ANT-01, 06, 07, 08, 11, 12) target the subcontractor, and the PO creator who receives the alert email is normally a subcontractor user. A role-based test should also check that a subcontractor **without** that access cannot create the PO.
- Email (product owner, 2026-10-30), three separate rules:
  1. The person who **created the PO** receives the alert email.
  2. When the lead-time confirmation cut-off passes (ANT-05), an email is also sent to the **subcontractor representative**.
  3. For overdue subcontractor tasks (ANT-14), an email "Delayed Tasks for Supplier __" is sent to the **construction company**.
- When the Configuration Options are **not configured**, no message or email is sent; only the in-app notification and alert appear (R12).
- Related role permissions (Update Role, 30 Oct): `Alerts: List/Edit`, `Notifications: List/Edit`, `Tasks: List/Edit`, `Notifications: Receive Admin Notifications` (✓ for Project Admin), `Notifications: Receive CC Copies of Alert Emails`, `Notifications: Receive Subcontractor Notifications`, `Notifications: Supplier Contact` (☐ for Project Admin), `Submittal: Schedule: Trigger alert`. Who receives which email may depend on these – confirm when alert tests are written.

## 4. Events (In MVP = Yes)

Legend: **CC** = construction company, **SC** = subcontractor. Trigger "Daily job" means a scheduled background check, not an immediate reaction.

| ID | Event | Condition | CC receives | SC receives | Message template (spreadsheet) | Trigger |
|---|---|---|---|---|---|---|
| ANT-01 | Lead time confirmed, item not yet ordered | Lead time confirmed; no PO | Notification | Task (created, or updated if one exists) | CC: "Lead Time for Item __ with date Required on Site __ connected with Submittal has been confirmed and task created on Sub contractor to place order by __ date." SC task: "Create Purchase Order for Item __ with date Required on Site __ connected with Submittal __ by __ date." Task date = LPOD − (Not ordered weeks × 7) | Daily job |
| ANT-02 | Item booked into jobsite | Booking system reports the item booked | Notification | – | "Item __ with Qty __ connected with submittal __ and date required on site __ has been booked for delivery on __ with booking Id __." | Booking system API (daily job). **Depends on the booking API** |
| ANT-03 | Item delivered to jobsite | Delivery recorded against the scheduled item | Notification | – | "Item __ with Qty __ connected with submittal __ and date required on site __ and booking id __ has been delivered on __." | On delivery record |
| ANT-04 | Confirm lead time (proactive) | Lead time not yet confirmed (weekly check) | Notification | Task "Confirm Lead Time … latest by <ROS − weeks×7>" (create if missing) | CC: "Lead Time has not yet been Confirmed for Item __ connected with submittal __ and date required on time __. The last date of confirmation for this is __." | Weekly / daily job. Note: once confirmed, the lead time cannot be edited |
| ANT-05 | Lead time not confirmed – cut-off passed | Today > ROS − (Lead time confirmation weeks × 7) and not confirmed | **Alert** | Task created or updated to **Delayed** (red, bold) + Notification/**Email to SC representative** | CC alert: "Last date for Lead Time Confirmation for Item __ connected with submittal __ and date required on time __ is now passed." | Daily job |
| ANT-06 | Item not ordered in time – schedule impacted | No PO date and today > LPOD | **Task** (no due date): review schedule | Ordering task updated to **Delayed** (red, bold) | CC: "Last date for PO has passed for Item __ … with Last Possible Ordering Date as __. Please relook at the overall Schedule…" | Daily job |
| ANT-07 | Lead time changed before ordering – LPOD moves, ROS still reachable | No PO date; lead time changed; today + lead time ≤ ROS | **Alert** | Ordering task updated with the new LPOD | CC: "Lead time changed for Item __ … This moves the Last Possible Ordering Date to __ which was earlier __." | On lead-time change (immediate) |
| ANT-08 | Lead time changed before ordering – ROS no longer reachable | No PO date; today + new lead time > ROS | **Task** (no due date) incl. expected delivery date | Ordering task **Delayed** (red, bold); schedule status → **Not Ordered – At Risk** | CC: "…This pushes the delivery to __ which is beyond Required Date on Site. Please review overall schedule." | On lead-time change |
| ANT-09 | Lead time changed after ordering – schedule impacted | PO date set; PO date + new lead time > ROS | **Task** (no due date) with new expected delivery date | Optional alert only; schedule status → **At Risk** (partial or not) | CC: "Lead time changed for ordered Item __ … modified to __ weeks. This pushes the delivery to __ which is beyond Required Date on Site…" | On lead-time change |
| ANT-10 | Lead time changed after ordering – no impact | PO date set; PO date + new lead time ≤ ROS | Notification | Notification | "…modified to __ weeks. This is not impacting the Schedule as the material is still expected to be delivered within the Required Date on Site __." Indicates whether the delivery moves earlier or later | On lead-time change |
| ANT-11 | Item returned – replacement still in time | Inventory "return to supplier" recorded; replacement can arrive by ROS | **Alert** | Task "raise PO for replacement by LPOD" (status Created, due = LPOD) | CC: "__ Qty of Item __ … has been returned to the supplier. Considering Lead time replacement can still be ordered in time." | On return action (Inventory) |
| ANT-12 | Item returned – replacement impacts schedule | Replacement cannot arrive by ROS | **Task** (no due date) with expected delivery | Task **Delayed** (red, bold); schedule status → **At Risk** | CC: "…Fresh order for replacement item pushes the delivery to __ which is beyond Required Date on Site…" | On return action |
| ANT-13 | Item not booked into jobsite | Not booked by ROS − (Not booked weeks × 7) | **Alert** | Task "follow up with supplier", due = **today + 2 days** | CC: "Ordered Item __ connected to Submittal __ and date required on site __ has not yet been booked for delivery. Please note that this may lead to delay." | Scheduled job. **Depends on the booking API** |
| ANT-14 | SC tasks overdue | SC tasks past their due date and not completed | **Alert** with link to the email + **Email** "Delayed Tasks for Supplier __" listing delayed tasks and due dates | Overdue tasks shown as Delayed/Overdue | – | Scheduled job |

Spreadsheet row "Item not being ordered in time – schedule not impacted" (Notification to CC, Task to SC) has no details or MVP flag → **Q-ANT-5**.

Not in MVP (In MVP = No / Not possible now): item shipped from manufacturer; item arrived at subcontractor; schedule change creating conflicts (two rows); upload of a new schedule.

## 5. Statuses (sheet *Statuses*)

| Status | Definition | Applies to | Rule |
|---|---|---|---|
| Not ordered | Item in system, no order yet | Submittal, Schedule | No PO raised |
| Ordered | Item ordered | Submittal, Schedule | All POs raised |
| Delivered | Item delivered | Submittal, Schedule | All delivered |
| Partial delivery | Part delivered, no anticipated delay | Submittal, Schedule | Partial delivery and ROS not passed |
| Partial delivery – delay risk | Part delivered, risk of delay | Schedule | Partial delivery and ROS passed |
| Ordered – delay risk | Ordered, nothing delivered, risk of delay | Schedule | – |
| Not ordered – delay risk | Not ordered by the lead-time date | Schedule | No PO and the required date has passed |

[O] The Management Dashboard on NRVC_Hall shows "Submittals by status": Not Ordered, Not Ordered At Risk, Ordered, Ordered At Risk, Partial Delivery, Delivered.

## 6. Supplier Issues report (sheet *SupplierIssues*)

Filters: Project, Supplier; Download option. Columns: Supplier Name, Project Name, Delays in Raising PO, Delays in Confirming Lead Time, PO Schedule Impacted, Delays in Booking, Delivery Impacted (counts), with a total per supplier. (Belongs to Analytics/Reports; known issue SCP-DEF-014 on its export.)

## 7. Testability notes

- Most checks run in a **daily batch job** on the UK server, once a day, at roughly **05:00–06:00 IST** (product owner, 2026-10-30; exact time not fixed). It cannot be run on demand, so these tests need **two phases**:
  1. **Seed (day 1, any time):** create the submittals/schedule lines with dates relative to today and save their IDs to a run file.
  2. **Verify (day 2, after ~07:00 IST):** read the run file, check the Alerts/Notifications/Tasks and emails for those IDs only, and allow for the batch not having run yet (report as Blocked, not Failed, if the latest alert timestamp is older than today's batch window).
  - [I] 05:00–06:00 IST is about 23:30–00:30 UK time (GMT, after 26 Oct), which fits a UK-midnight batch. Confirm it is **morning** IST.
- Daily-job events: ANT-01, 02, 04, 05, 06, 13, 14. Immediate events: ANT-03, 07–12.
- Lead-time-change events (ANT-07…10) and the return events (ANT-11/12) are **immediate**, so they are the best first candidates for automation.
- ANT-02, ANT-13 depend on the booking-system API, which is **enabled per project** (product owner, 2026-10-30). A project is linked when PM › Booking Integration has a *Booking System Project ID*. Tests must read that field first and branch:
  - **Linked:** run ANT-02 and ANT-13 as specified.
  - **Not linked:** ANT-02/ANT-13 are not applicable; report **Not Applicable (booking integration not configured)**, not Failed. Whether a not-linked project should raise the not-booked alert at all is open (Q-ANT-8).
  - [O] 30 Oct: NRVC_Hall, LLE - Test and SCP_Testing_Ram are all **not linked** (Booking System Project ID empty).
- All dates must be built relative to today, e.g. ROS = today + 6 weeks, so the test never depends on the calendar.

## 8. Open questions

| # | Question |
|---|---|
| ~~Q-ANT-1~~ | Answered 2026-10-30: the in-app help text is the latest rule, so the Not ordered alert counts back from the Required On Site date. |
| ~~Q-ANT-2~~ | Answered 2026-10-30: daily batch on the UK server, about 05:00–06:00 IST, no on-demand trigger. Remaining: confirm it is morning IST, and whether staging runs the same schedule as production. |
| ~~Q-ANT-3~~ | Answered 2026-10-30: separate rules; all three emails are sent (§3). |
| ~~Q-ANT-4~~ | Answered 2026-10-30: alerts, notifications and tasks all appear on the Management Dashboard (Alerts / Notifications / Tasks tabs). |
| ~~Q-ANT-5~~ | Product owner unsure of this requirement (30 Oct): **out of scope** until clarified; not automated. |
| ~~Q-ANT-6~~ | Answered: enabled per project. None of the three accessible projects is linked (30 Oct). |
| ~~Q-ANT-8~~ | Answered 2026-10-30: Booking System ID linking is not used for now; testing uses **manual booking entry** only. ANT-02 (booked via API) is deferred; ANT-13 is tested by leaving the manual booking empty (not booked) vs. entering one (booked). |
| ~~Q-ANT-7~~ | Answered 2026-10-30: task due date = `LPOD − (Not ordered weeks × 7)` (e.g. 26 Oct); the subcontractor receives it. |
