# SCP - FDI Listing: Auditor Self-Assignment, Supplier Visibility, Status Lifecycle and Procore Sync

**Area:** Main menu > First Delivery Inspection (listing and inspection report form)

## Current behavior described by this story

Opening Fill Form without submitting can permanently replace the action with View, preventing completion. The story also introduces supplier display, a status lifecycle, auditor self-assignment and combined list filters.

## Required behavior and acceptance criteria

1. Display FDI records newest-first, ordered by creation/added date descending. Delivery date is not the ordering key.
2. Each row displays the supplier associated with its delivery.
3. New records start with "Auditor Not Yet Assigned".
4. Only enabled inspectors eligible for the record's Material can Self-Assign as Auditor. Eligibility includes direct mapping and All Materials; the companion Admin Assign story also defines Material Category mapping under BUGS-198 / BUGS-416.
5. Self-assignment moves the record to "Awaiting Inspection Completion" and gives only the assigned auditor Fill Inspection Report and Unassign Self.
6. Unassign Self removes the assignee and returns the record to "Auditor Not Yet Assigned", allowing another eligible inspector to self-assign.
7. Fill Inspection Report opens a form with separate Save and Submit controls. Existing deployed labels Save Progress and Submit Inspection represent these actions.
8. Save persists answers, leaves the status as "Awaiting Inspection Completion", and preserves Fill Inspection Report so the auditor can resume later. Opening or saving alone must never complete a report.
9. No user, including the assigned auditor, is offered View before "Inspection Completed", subject to the unresolved Responsible-user exception noted below.
10. Submit moves the record to "Inspection Completed" and makes the submitted answers read-only.
11. Users with Subcontractor or Admin roles can see and open completed records, within the applicable access permissions.
12. Supplier-role users see only records for deliveries tied to their own supplier, subject to the explicit exceptions in the organisation/Responsible access story.
13. Every authorised viewer of a completed record gets View. Only Admin gets Sync, which sends the report as a PDF to Procore.
14. Provide filters for Material, Supplier, Status, Delivery Date From/To, and Inspector Assigned To.
15. Filters work independently and in combination and return only matching records.
16. Delivery date bounds are inclusive: dates equal to From or To are included.
17. Filters only narrow the user's permitted records and never expose another supplier's restricted records.
18. Clearing all filters restores the full permitted list in reverse creation/added-date order.

## Companion requirements

- [Organisation and Responsible-user access](FDI_ACCEPTANCE_CRITERIA.md) defines Project Admin/Project-Owning Organisation exceptions, supplier-organisation intersection with role permissions, and the Responsible-user grant.
- [Admin inspector assignment](FDI_INSPECTOR_ASSIGNMENT_REQUIREMENTS.md) adds Assign and direct reassignment without losing saved answers.
- [Report requirements](FDI_INSPECTION_REPORT_REQUIREMENTS.md) and [FDI Settings](FDI_SETTINGS_REQUIREMENTS.md) control report notes, photos and linked documents.

## Clarifications and integration validation

- Listing AC9 prohibits View before completion, while Responsible-access AC10 grants View of every linked FDI. Confirm whether Responsible users can view pending reports, or whether their View action starts only after completion. Preserve both requirements until this conflict is resolved.
- The earlier access story explicitly grants organisation/Responsible exceptions. Supplier filtering must be assessed together with those exceptions rather than treated as a replacement for them.
- Procore Sync verification must check successful PDF transfer through an integration fixture. A success/failure toast alone verifies feedback, not delivery of a PDF to Procore.
