# New pages – functional flows as observed (draft for client / dev confirmation)

_Staging, NRVC_Hall, build of 24 Nov 2026. These flows were discovered through the UI on 26 Nov 2026, 23:15–23:40 IST, with one discovery load (approved rule: one load chain per run). There is no client document; every expected result below is what the app did. **Please confirm or correct.**_

Discovery records: load **LD-0002** on open line *43 Inches PLR2611181018-SUB-A* (automation-owned, 6 pieces), receipt **RCV-000312**, one Damaged discrepancy, **NCR-001** (left at *Awaiting re-inspection*).

## F1. Build a load (Loads › All Loads › Build load, `/loads/new`)
1. "Open product lines" lists booked, not-yet-received schedule lines: Product, submittal · supplier, *To load* quantity, ROJ, and an `Add` button. There were 311 lines on 26 Nov. Search filters the list.
2. `Add` moves the line into "This load". The quantity is editable ("6 Pieces of 6 left") and `Remove` takes the line out again. The panel shows Soonest ROJ, Latest ROJ, and the delivery window (ROJ − 14 days … ROJ; "Up to 14 days before ROJ counts as on time"). It also has Site and Notes.
3. `Save load` (disabled while the load is empty) → the load gets a number LD-000N, status **Pending**, and the message "LD-000N saved."
4. Rule shown after the first line: **"a load carries one CSI division"**. The open lines are then filtered to that division.
5. The Site defaults to the header site. After a page reload the header can switch to the newest run site (OBS-INV-12), so the automation must set the site explicitly. **Question:** should the default be the project's main site?

## F2. Load status lifecycle (load page `/loads/<id>`)
| Status | Actions offered |
|---|---|
| Pending | Mark as expected · Cancel load · Delete · Save changes (lines/notes) |
| Expected (after "Mark as expected" › Expected date [default ROJ] › Save date) | Receive · Change date · Back to pending · Cancel load |
| Checked in (after receipt) | Receipt RCV-… (read-only). "This load has checked in, so its lines can no longer change." |

"Mark as expected" says: *"For projects that don't book through Delivery Management. The lines become expected deliveries on this date."* **Question:** when Delivery Management is connected, is the booking done there instead?

## F3. Receive a load (`/loads/<id>/receive`)
- Each line has Expected, Received (default = expected), Damaged, Stored at (location of the load site), Note and "+ Damage photo". The form also has "Anything else about this delivery (optional)", "Delivery note photo" and `Confirm receipt`.
- Result: "LD-000N received as RCV-000NNN.", the load becomes **Checked in**, and a history row "Arrived … Received 6.00 into <location>" is added.

## F4. Discrepancy raised from the receipt (Loads › Discrepancies)
- Receiving 1 damaged of 6 **automatically raised** a *Damaged* discrepancy: Load LD-0002, Qty 1, "1 of 43 Inches damaged at receipt.", Raised 26/11/2026 · 0 d, status Open.
- The same discrepancy showed up straight away in the Management Dashboard tile "Open discrepancies" = 1, the urgent chip "Delivery discrepancies" = 1, and My Work › Projects at a glance › NRVC_Hall "Open issues" = 1.
- Damaged units received through the component page (Log delivery / GRN) raised **no** discrepancy. **Question:** is that intended?
- The detail panel offers two paths:
  - **Resolve**: "How was it resolved?" (Replacement booked, Credit agreed, Accepted as is, Returned to supplier, No action needed, Other) plus Note. `Resolve` stays disabled until a reason is chosen.
  - **Raise NCR**: with a quantity. This opens the new NCR, and the discrepancy leaves the Open list.

## F5. NCR lifecycle (Project Management › NCRs, `/ncrs/<id>`)
| Status | Action seen | History entry |
|---|---|---|
| Open (raised from the discrepancy; "1 Pieces on hold") | Choose a corrective action (Use as is / Repair / Rework / Reject and return) + Note › Save | raised · 1 on hold |
| Awaiting approval (after Rework) | Approve (GC QA/QC) | corrective action · Rework: <note> |
| In progress | Work done: request re-inspection | approved gc |
| Awaiting re-inspection | *(no action offered to the Project Admin)* | reinspection requested |
| Closed | not reached | – |

The NCR page also has a PDF button, + Photo, a link to the load, filters (status, corrective action, division, trade), "Export to Excel", and "GC project managers by CSI division".

**Question:** who performs the re-inspection that closes the NCR? Is it the FDI inspector, another role, or the Delivery Management integration? We have not yet discovered how an NCR is closed.

## Added 27 Nov 00:00–00:40 IST (E2E runs on LD-0003)
- **Mark as expected with a date after a line's ROJ:** the first "Save date" shows "<product>: Give a reason: on that date this line arrives after its ROJ date." and a **Reason** field. Save date stays disabled until a reason is entered. With the reason, the load becomes Expected, and the list shows the ROJ check "1 late".
- **One receipt can raise several discrepancies.** Receiving 2 of 3 (1 damaged) on a load past its ROJ raised:
  - *Received after ROJ*: qty 2, "43 Inches received 26 Nov 2026, ROJ was 17 Nov 2026." **The date is the UTC date:** the receipt was at 00:1x IST on 27 Nov. This is a defect candidate, the same pattern as INV-REG-24.
  - *Short delivery*: qty 1, "43 Inches: 2 received of 3 on the load."
  - *Damaged*: qty 1, "1 of 43 Inches damaged at receipt."

  The Open discrepancies tile, the "Delivery discrepancies" chip and My Work "Open issues" all rose by 3.
- **The Status column of a handled discrepancy shows how it was handled**, for example "Replacement booked" (resolved) or "NCR raised". It does not show "Resolved".
- **Defect candidate:** Build load accepts a quantity above "of N left". 20,004 typed against 19,999 left keeps Save load enabled. It was not saved, to avoid a bad record.
- The All loads search finds a load by its number (LD-0003) once a status that contains the load is chosen.
- My Work "Open issues" counts open discrepancies plus open NCRs.

## Still to discover
- Unallocated Deliveries: how an unplanned arrival is created (probably through check-in at the gate / Delivery Management).
- Discrepancy kinds: Short, Over, Wrong product, Inspection rejected, Received after ROJ.
- Resolve path, and the NCR corrective actions Use as is, Repair and Reject and return.
- Cancel load / Delete / Back to pending.
- My Work actions per role (Project Admin, Supplier, Subcontractor).
