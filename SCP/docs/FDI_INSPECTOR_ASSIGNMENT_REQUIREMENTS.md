# FDI Listing: Allow Project Admin to Assign a Specific Inspector (in addition to Self-Assign)

**Application:** SCP

**Area:** Main menu > First Delivery Inspection > FDI Listing

**Related requirements:** [FDI access acceptance criteria](FDI_ACCEPTANCE_CRITERIA.md), [Inspection Report requirements](FDI_INSPECTION_REPORT_REQUIREMENTS.md), and the existing FDI Listing story. Material eligibility follows the FDI Config Inspectors section, including BUGS-198 / BUGS-416.

## Current behavior

On a record with status "Auditor Not Yet Assigned", an eligible inspector can Self Assign. The record moves to "Awaiting Inspection Completion". The assigned inspector can Unassign Self, reverting the record to unassigned. A Project Admin cannot directly assign a specific inspector or change an existing assignment.

## Required behavior

1. Add an "Assign" action for users with the Project Admin role on records with status "Auditor Not Yet Assigned", alongside the existing Self Assign action where the user is eligible for it.
2. Clicking Assign opens a dropdown containing only enabled inspectors eligible for the record's Material through direct material mapping, "All Materials", or the material's Material Category. Ineligible or disabled inspectors are not selectable.
3. Selecting an inspector and confirming assigns that inspector as auditor and moves the record to "Awaiting Inspection Completion", with the same effect as Self Assign.
4. Other inspectors cannot Self Assign over an existing assignment. Only the current assignee can Unassign Self to make the record available for Self Assign again.
5. A Project Admin can use Assign to reassign an already-assigned record in "Awaiting Inspection Completion" directly to a different eligible inspector without the current assignee first unassigning. Reassignment replaces the assignee, preserves the status and all saved but unsubmitted answers, and does not create a new FDI record. The new inspector continues the existing report.
6. On reassignment, the previous assignee immediately loses Fill Inspection Report and Unassign Self for that record, and the new assignee gains those actions.
7. All subsequent behavior follows the existing FDI Listing lifecycle and permissions, regardless of whether assignment was performed by Self Assign or Admin Assign.

## Acceptance Criteria

1. On a record with status "Auditor Not Yet Assigned", a user with the Project Admin role sees an "Assign" action alongside "Self Assign".
2. Clicking "Assign" opens a dropdown of inspectors eligible for that record's material: inspectors enabled and mapped to that material directly, via "All Materials", or via the material's Category.
3. Inspectors who are not mapped/eligible for that material, or who are disabled, do not appear in the Assign dropdown.
4. Selecting an inspector and confirming assigns that inspector to the record and changes its status to "Awaiting Inspection Completion", identical in effect to Self Assign.
5. Once a record is assigned (by Self Assign or Admin Assign), other inspectors cannot Self Assign over it. The record is locked against self-assignment while it has an assignee.
6. A Project Admin can reassign an already-assigned record to a different eligible inspector at any time via the Assign action, without requiring the current assignee to unassign first.
7. Reassigning a record replaces the current assignee with the newly selected inspector, leaves the record's status unchanged (still "Awaiting Inspection Completion"), and preserves any answers already saved (but not submitted) on the report for the new assignee to continue.
8. Once a record is reassigned, the previous assignee immediately loses "Fill Inspection Report" and "Unassign Self" on that record; the newly assigned inspector gains them.
9. Only the currently assigned inspector can Unassign Self, which reverts the record to "Auditor Not Yet Assigned". At that point Self Assign becomes available again to eligible inspectors, and Admin Assign becomes available again to Project Admins.
10. The "Assign" action (including reassignment) is available only to users holding the Project Admin role. Other roles continue to see only the actions already defined for them in the FDI Listing story; for example, an eligible inspector sees Self Assign only when the record is unassigned.
11. Records assigned or reassigned via Admin Assign behave identically to self-assigned records for every subsequent step: Fill Inspection Report, Save, Submit, View visibility by role, and Sync, with no special-casing based on how the assignment was made.

## Scope and interpretation

- Admin Assign is restricted to Project Admins. Self Assign retains its existing inspector-eligibility checks; AC1 does not independently make every Project Admin eligible to Self Assign.
- Reassignment applies to assigned records awaiting inspection completion. The phrase "at any time" in AC6 does not introduce reassignment of submitted/completed records or change their existing lifecycle.
- Assigning an FDI inspector is separate from assigning a Submittal's Responsible user. Responsible status alone continues to grant FDI View access, without granting Fill or Notify access.
- The existing status lifecycle, Fill/Save/Submit behavior, View and role-based visibility, and Sync behavior remain governed by the FDI Listing story.
