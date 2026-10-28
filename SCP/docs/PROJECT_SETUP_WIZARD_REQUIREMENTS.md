# SCP - Enhance Project Setup Wizard

## Purpose

Create the initial categories, materials, suppliers and mappings inside the wizard so users can log their first submittal without leaving setup for separate admin menus.

## Step order

1. Integration
2. Directory
3. Project Config
4. Sites
5. Material Category — Add Material Categories
6. Materials — Add Materials
7. Suppliers — Add Suppliers
8. Suppliers->Materials — Map Suppliers to Materials
9. First Submittal

Steps 1–4 retain existing behavior. First Submittal retains existing behavior and moves from step 5 to step 9.

## Acceptance Criteria

1. The wizard contains the nine steps in the order listed above.
2. Step 5 captures only a free-text Category Name in an Add popup, saves a Material Category record, and lists up to five categories with Edit actions.
3. If five or more categories already exist, display the first five and disable or hide Add.
4. Step 5 displays: "Add only important categories at this stage. You can manage many categories easily using the menu option Project Management->Reference data ->Material Category."
5. Step 6 captures Category (from Step 5 categories), Material Name, Unit of Measure (from master UOM), Packaging Unit, and integer Conversion Multiplier via a popup. Display up to five materials with Edit actions.
6. Existing materials populate the table, limited to the first five, with Edit actions.
7. Step 6 displays: "Add only important materials (max up to 5) at this stage. You can manage any number of materials easily using the menu option Project Management->Material Master."
8. Step 7 captures Supplier Name, Contact Person, Contact Email, and Contact Phone No via a popup, and lists up to five suppliers with Edit actions.
9. Supplier creation and editing reject invalid email or phone formats with a validation error.
10. Existing suppliers populate the table, limited to the first five, with Edit actions.
11. Users cannot add more than five suppliers through the wizard.
12. Step 7 displays: "Add only major suppliers of the important materials (max up to 5) at this stage. You can manage any number of suppliers using the menu option User Management->Supplier List."
13. Step 8 captures Supplier (limited to Step 7 suppliers), Material (limited to Step 6 materials), and Lead Time in Weeks (zero or positive). Negative lead time is rejected.
14. Each new supplier-material mapping appears immediately in the Step 8 list.
15. Users can create up to five mappings through Step 8.
16. Step 8 displays: "Add only major supplier to material mappings (max up to 5) at this stage. You can manage any number of supplier to material mappings using the menu option User Management->Supplier List. - From a supplier record you can click on the icon Map supplier to map materials for the supplier."
17. First Submittal follows mappings as Step 9 with no functional change.
18. New steps follow the existing step tabs, completion checkmarks, Back/Skip/Next (Finish on the last step), popup and Save conventions.
19. Skip on each new step proceeds without requiring a record to be added.
20. Categories, materials, suppliers and mappings persist and appear in their corresponding existing admin screens after wizard completion.

## Clarifications

- The supplied description swaps the Suppliers and Suppliers->Materials footer notes. The acceptance criteria above use the explicit acceptance-criteria versions.
- Confirm the category/material limits during additions when fewer than five records already exist, and what determines the "first five" existing records.
- Define valid phone formats, permitted conversion-multiplier range, duplicate-mapping rules and completion-checkmark behavior when a step is skipped.
- Reference screenshots mentioned by the story were not attached to this request.
