# User Management (incl. Supplier List) – Smoke and Regression Scenarios (Draft for Review)

> **Step-by-step flows (Action → Expected, matching the automated steps):** [MODULES_SMOKE_STEPS.md](steps/MODULES_SMOKE_STEPS.md), [MODULES_REGRESSION_STEPS.md](steps/MODULES_REGRESSION_STEPS.md)

Source: [UM_FUNCTIONAL_DISCOVERY.md](UM_FUNCTIONAL_DISCOVERY.md). Legend as in [PM_REGRESSION_SCENARIOS.md](PM_REGRESSION_SCENARIOS.md): Type POS/NEG/BND/ROLE/INT · Impact **R** read-only, **C** client-side, **M** mutates (approved: create; remove only run-owned users/suppliers) · Ev. **O** observed 2026-11-02, **R** rule, **I** inferred.

**Prerequisites:** Project Admin on NRVC_Hall (PM-SMK-001). Run tag `<RUN>`; invite emails `um.<RUN>@yopmail.com`; supplier names `Supplier <RUN>`. Navigate through the menu (re-expand `User Management` group).

## Smoke (read-only)
| ID | Title | Expected | Ev. |
|---|---|---|---|
| UM-SMK-01 | User Management loads | Search, Filter, Invite Users; columns Status, Name, Email Address, Associated Organization, Platform Role; ≥ 1 row | O |
| UM-SMK-02 | User profile panel | Row click → User Profile (First/Last Name, Email, Phone, Company) and Roles (Project Role, Organization Role), Save, Remove From Project | O |
| UM-SMK-03 | Invite dialog | Manual entry / From Procore directory; Email *, Organization, Role *; Add Another User, Cancel; Send Invites disabled when empty | O |
| SL-SMK-01 | Supplier List loads | Search, Add Supplier, Bulk Map Material to Supplier, Upload, Export, `N suppliers`; 8 columns | O |
| SL-SMK-02 | Add Supplier form | 12 fields as in discovery §2; Cancel / Save | O |
| SL-SMK-03 | Upload menu | 4 items (list/map upload + templates) | O |
| SL-SMK-04 | Row menu | Edit, Delete, Map Material, Promote to SSO Organisation | O |

## Regression – User Management
| ID | Title | Type | Impact | Steps → Expected | Ev. |
|---|---|---|---|---|---|
| UM-REG-01 | Send Invites needs email + role | NEG | C | Empty / bad email / no role → Send Invites stays disabled | O |
| UM-REG-02 | Invite a user | POS | M | Email + role Subcontractor → "Invite Sent Successfully"; row Invited, role Subcontractor | O |
| UM-REG-03 | Duplicate invite rejected | NEG | M | Same email other case → rejected (R2) | O – accepted and role overwritten (OBS-UM-1) |
| UM-REG-04 | Organization optional | POS | C | Invite without organization is enabled | O |
| UM-REG-05 | Add Another User | POS | C | Second email/role row appears; both required | I |
| UM-REG-06 | Search users | POS | R | Search by email fragment, case ignored | O |
| UM-REG-07 | Change Project Role | POS | M | Profile → role → Save → kept after reload | O – not kept (OBS-UM-2) |
| UM-REG-08 | Remove From Project | POS | M | Run user → confirm → no longer listed | O – no confirmation; still listed (OBS-UM-3) |
| UM-REG-09 | Invite → accept → active | INT | M | Yopmail accept → status Active, role kept (PM FDI-18 pattern) | I |
| UM-REG-10 | Role access applies to screens | ROLE | M | Subcontractor/Supplier role page access follows the Roles config (R40–R43; restore afterwards) | R |
| UM-REG-11 | Filter | POS | R | Filter by status/role narrows rows | I |

## Regression – Supplier List
| ID | Title | Type | Impact | Steps → Expected | Ev. |
|---|---|---|---|---|---|
| SL-REG-01 | Required fields | NEG | C | Empty Save → 9 "… is required" | O |
| SL-REG-02 | Add supplier | POS | M | Valid → "Supplier added successfully"; listed with new ID, Type Supplier | O |
| SL-REG-03 | Duplicate name (case/space) | NEG | M | "A supplier named '…' already exists in this project…" | O |
| SL-REG-04 | Invalid email | NEG | C | Clear app message | O – browser check only (OBS-SL-1) |
| SL-REG-05 | Add as subcontractor | POS | M | Type Subcontractor; appears in Inventory Subcontractor list | I |
| SL-REG-06 | Map material | POS | M | Add Item Mapping → material + lead time → SUBMIT → row listed | O |
| SL-REG-07 | Map material validation | NEG | C | "Select a material before saving." | O |
| SL-REG-08 | Mapping drives Procurement | INT | M | Add Submittal → supplier offers exactly its mapped materials | O |
| SL-REG-09 | Bulk map | POS | M | Bulk page → select → Map Suppliers to Materials → mappings saved | I |
| SL-REG-10 | Supplier List upload | POS/NEG | M | Template from same run; valid rows created; invalid rows reported; Bulk Upload Status entry | I |
| SL-REG-11 | Supplier Map upload | POS | M | Mappings created | I |
| SL-REG-12 | Edit supplier | POS | M | Edit contact → saved | I |
| SL-REG-13 | Delete supplier (run-owned) | POS | M | Removed; not offered in Procurement | I |
| SL-REG-14 | Export | POS | R | File rows = list count | I |
| SL-REG-15 | Promote to SSO Organisation | POS | M | Not executed without approval | I |

Totals: 7 smoke · 26 regression.
