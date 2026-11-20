# User Management (incl. Supplier List) – Functional Discovery (SCP Staging)

| Item | Value |
|---|---|
| Discovery date | 2026-11-02 |
| Environment / project | Staging, `NRVC_Hall` |
| Account | Project Admin (user's SSO account) |
| Method | Playwright MCP, single session; run-tagged records (approved: create new records) |
| Run records | Supplier `Supplier SLD2611021715` (ID 0230, mapped to `43 Inches`); invited user `umd2611021719@yopmail.com` |

Evidence tags as in [PM_FUNCTIONAL_DISCOVERY.md §1](PM_FUNCTIONAL_DISCOVERY.md). Rules R1–R70 (PM) and PL-R* (Procurement) apply. Role access is configuration-based (R9, R40–R43).

## 1. User Management (`/user-management`) [O]
- List: `Search users…`, `Filter`, `Invite Users`; columns Status, Name, Email Address, Associated Organization, Platform Role. Clicking a row opens **User Profile** (First Name, Last Name, Email, Phone, Company) and **Roles** (Project Role, Organization Role) with `Save` and `Remove From Project`.
- **Invite Users** dialog: modes `Manual entry` / `From Procore directory`; `Email *`, `Organization` (`Choose Organization`, optional), `Role *` (`Choose Role`); `Add Another User`, `Cancel`, `Send Invites`.
- **Send Invites stays disabled** until a valid email and a role are given (no message for an invalid email; the button simply stays disabled).
- Project roles offered: All_Role_Access, Project Admin, Project Manager, Project Senior User, Project User, Subcontractor, Supplier.
- Valid invite → "Invite Sent Successfully"; row `Invited | – | <email> | – | Subcontractor`.
- **Re-inviting the same email (other case) is accepted** ("Invite Sent Successfully") and **replaces the role** with the newly chosen one (OBS-UM-1).
- Profile role change Subcontractor → saved with "User profile updated successfully", but **after reload the old role is shown** (OBS-UM-2).
- `Remove From Project` acts **immediately, with no confirmation**, toast "User Removed Successfully", but **the invited user is still listed after reload** (OBS-UM-3).

## 2. Supplier List (`/supplier-list`) [O]
- List: `Search suppliers…`, `Add Supplier`, `Bulk Map Material to Supplier`, `Upload` (Supplier List Upload / Supplier List Download Template / Supplier Map Upload / Supplier Map Download Template), `Export`; count `N suppliers` (92); columns Supplier ID, Supplier Name, Type, Source, Contact Person, Contact Email, Contact Phone no, Map Material.
- **Add Supplier**: Supplier Name*, subcontractor checkbox, Line 1*, Line 2, Town/City*, State/Region*, Zipcode*, Country*, Contact Person*, Contact Email*, Contact Phone no.*, Default Lead Time (weeks) ("Leave blank to derive from history"); Cancel / Save.
  - Empty save → 9 inline "… is required" messages.
  - Invalid email → blocked only by the browser's built-in email check; no app message (OBS-SL-1).
  - Valid → "Supplier added successfully"; listed with a new Supplier ID (0230), Type Supplier, Source `-`.
  - Duplicate name in another case with spaces → "A supplier named '…' already exists in this project. It appears in your supplier list, which includes sub-contractors." (R2/R15 ✓).
- Row: `Map material` icon; menu `Edit`, `Delete`, `Map Material`, `Promote to SSO Organisation`.
- **Map Material**: panel with Supplier ID/Name, `Add Item Mapping` → "Add Data": Material Name (`Choose Material`), Material ID (auto-filled), Lead Time (Weeks), `SUBMIT`. Empty submit → "Select a material before saving."; saved row `0001 | 43 Inches | 2`.
- **Cross-module**: Procurement Add Submittal lists the new supplier, and its Materials list contains exactly the mapped material.
- **Bulk Map** page: `← Supplier List`, filter by supplier names (comma-separated), material checkboxes, `Selected only (N)`, `Map Suppliers to Materials`.

## 3. Not executed
- `Promote to SSO Organisation` (changes organisations/login – needs explicit approval).
- Invite acceptance by the invited user (Yopmail mailbox; covered by the PM Cucumber flow FDI-18 pattern).
- Supplier Edit/Delete, uploads, Export file content.

## 4. Observations (defect candidates, none registered)
| # | Observation |
|---|---|
| OBS-UM-1 | Re-invite of an existing email (case differs) is accepted and silently overwrites the role |
| OBS-UM-2 | Project Role change on an invited user shows success but is not persisted |
| OBS-UM-3 | Remove From Project shows success but the invited user stays listed; no confirmation step |
| OBS-SL-1 | Invalid contact email gives no app message (browser validation only) |

## 5. Questions
- **Q-UM-1** Should a duplicate invite be rejected (R2 uniqueness) or update the existing invite?
- **Q-UM-2** Can an invited (not yet accepted) user's role be changed or removed? If not, should the controls be disabled?
- **Q-UM-3** Should Remove From Project ask for confirmation?
