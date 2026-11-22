// Closure plan for every open Skipped case (22 Nov 2026). Read by scripts/skipped-cases-report.js, which joins it with
// the scenario definition in docs/functional-discovery and the skip reason of the latest run.
//
// group: how the case can be closed
//   A  automation work only – no decision or data needed
//   B  decision / approval needed (changes that cannot be undone or that touch shared data)
//   C  accounts, test data or a mailbox needed from the team
//   D  requirement or expected result needed (product owner / client)
//   E  not safe or not possible to automate – manual check proposed
// owner: who has to act first. effort: rough automation effort once unblocked (S < 1 h, M 1–4 h, L > 4 h).
const GROUPS = {
  A: 'Automation work only (no decision or data needed)',
  B: 'Decision or approval needed (irreversible change or shared data)',
  C: 'Accounts, test data or a mailbox needed from the team',
  D: 'Requirement / expected result needed',
  E: 'Not safe or not possible to automate – manual check proposed'
};

const ROLE_BLOCKED = 'Role suite set-up (22 Nov 2026): the test-only role "SCP Automation Test Role" was created as a copy of Supplier, but changing the test Supplier account\'s Project Role on NRVC_Hall to it in Voyage Control Admin › Projects › NRVC_Hall › PROJECT USERS did not stick (the row still showed "Supplier" after the change). The account was left on Supplier.';
const roleNeed = 'Find out why the Project Role change does not stick (app defect, a confirm step, or a role that must first be enabled for the project). Once the account can be put on the test role, the suite runs these cases with an automatic restore.';
const plan = {
  // ---------------- User Management / Supplier List ----------------
  'UM-REG-09': { group: 'C', owner: 'Team', effort: 'S', need: 'A mailbox the automation may read without a "verify you are human" check (YOPmail shows Cloudflare to automation), or an API/link to activate an invited user.' },
  'UM-REG-10': { group: 'B', owner: 'Automation (after the role set-up works)', effort: 'S', need: 'Use the test-only role instead of the shared Roles configuration (same blocker as the PM-REG-ROLE cases).', blocker: ROLE_BLOCKED },
  'SL-REG-04': { group: 'D', owner: 'Product owner', effort: 'S', need: 'Confirm the case is obsolete (the app refuses a supplier with an invalid e-mail, which other cases already check) so it can be removed from the plan.' },
  'SL-REG-15': { group: 'B', owner: 'User / product owner', effort: 'M', need: 'Approval to change a supplier\'s organisation / login on staging, and which supplier may be used.' },
  // ---------------- FDI / Documents / Shipments / Dashboard / Enterprise ----------------
  'FDI-REG-01c': { group: 'B', owner: 'Automation (after the role set-up works)', effort: 'S', need: 'Run it on the test-only role with "FDI: View" unticked instead of changing a shared role.', blocker: ROLE_BLOCKED },
  'FDI-REG-12': { group: 'E', owner: 'Team', effort: '-', need: 'Sync to Procore writes to an external system. Manual check against a Procore sandbox, or a sandbox the automation may use.' },
  'DOC-REG-11': { group: 'C', owner: 'Client / team', effort: 'S', need: 'A sample PO document with line items (Q-DOC-3, Q-PL-13).' },
  'DOC-REG-12': { group: 'C', owner: 'Client / team', effort: 'S', need: 'A sample BOM file (Q-DOC-3).' },
  'DOC-REG-16': { group: 'E', owner: 'Team', effort: '-', need: 'Procore link (external system). Manual check, or a Procore sandbox.' },
  'SHP-REG-03': { group: 'D', owner: 'Product owner', effort: 'S', need: 'International Shipments requirement document (skipped on user triage 13 Nov 2026).' },
  'SHP-REG-06': { group: 'D', owner: 'Product owner', effort: 'S', need: 'International Shipments requirement document (skipped on user triage 13 Nov 2026).' },
  'SHP-REG-08': { group: 'D', owner: 'Product owner', effort: 'S', need: 'International Shipments requirement document (skipped on user triage 13 Nov 2026).' },
  'SHP-REG-09': { group: 'D', owner: 'Product owner', effort: 'S', need: 'International Shipments requirement document (skipped on user triage 13 Nov 2026).' },
  'DSH-REG-10': { group: 'D', owner: 'Product owner', effort: 'M', need: 'Which alerts the 05:00–06:00 IST daily batch creates and where they appear. A met alert rule is already covered by PL-REG-ALR-05 (Passed).' },
  'ENT-REG-01': { group: 'A', owner: 'Automation', effort: 'S', need: 'Run the existing Enterprise suite (BUGS-325 oracle) in the full regression and link its result to this case.' },
  'ENT-REG-02': { group: 'D', owner: 'Product owner', effort: 'M', need: 'Enterprise requirement (skipped on user triage 13 Nov 2026).' },
  'ENT-REG-03': { group: 'D', owner: 'Product owner', effort: 'M', need: 'Enterprise requirement (skipped on user triage 13 Nov 2026).' },
  // ---------------- Ticket regression ----------------
  'T543-06': { group: 'A', owner: 'Automation', effort: 'S', need: 'Link to the PM regression part 2 FDI scenario that checks the inspector mapping and report its result here.' },
  'T508-14': { group: 'A', owner: 'Automation', effort: 'M', need: 'Automate (left out for time on 3 Nov; the manual result is in BUGS-508_Tracker.xlsx).' },
  'T508-17': { group: 'A', owner: 'Automation', effort: 'M', need: 'Automate (left out for time on 3 Nov; the manual result is in BUGS-508_Tracker.xlsx).' },
  'T508-18': { group: 'A', owner: 'Automation', effort: 'M', need: 'Automate (left out for time on 3 Nov; the manual result is in BUGS-508_Tracker.xlsx).' },
  'T508-19': { group: 'A', owner: 'Automation', effort: 'M', need: 'Automate (left out for time on 3 Nov; the manual result is in BUGS-508_Tracker.xlsx).' },
  'T548-04': { group: 'C', owner: 'Team', effort: 'S', need: 'Project ids for SCP_FDI_SECOND_PROJECT (second project in NRVC_Hall\'s organisation) and/or SCP_TKT548_OTHER_ORG_PROJECT.' },
  'T548-11': { group: 'E', owner: 'Developer', effort: 'S', need: 'An organisation set holding a bank-deleted question can only be prepared in the database (the app blocks it, AC 20). Developer to prepare it, or check manually.' },
  'T548-12': { group: 'E', owner: 'Team', effort: '-', need: 'Two tabs racing for one category: timing-dependent. Manual check proposed.' },
  'T548-16': { group: 'E', owner: 'Team', effort: '-', need: 'A failing guard would delete a real bank question. Manual check, or a disposable bank question created for the test.' },
  'T548-18': { group: 'C', owner: 'Team', effort: 'S', need: 'A working account that has only fdi:view (the SCP_SUPPLIER_* account did not qualify).' },
  'T155-03': { group: 'C', owner: 'Team', effort: 'S', need: 'A supplier in the subcontractor\'s own organisation (SCP_TKT155_SAME_ORG_SUPPLIER).' },
  // ---------------- Project Management ----------------
  'PM-REG-FDI-50': { group: 'D', owner: 'Developer', effort: 'S', need: 'Confirm the API endpoint to call.' },
  'PM-REG-SYS-11': { group: 'A', owner: 'Automation', effort: 'S', need: 'Create an active project notice inside the run (as SYS-08 does) before this check, then clean it up with SYS-00.' },
  'PM-REG-NAV-08': { group: 'B', owner: 'Product owner', effort: 'S', need: 'Approval to complete the Setup Wizard on SCP_Testing_Ram (cannot be undone; CFG-17 and PSC-05 need it unconfigured), or a fresh project for it.' },
  'PM-REG-NAV-09': { group: 'B', owner: 'Product owner', effort: 'S', need: 'Same as NAV-08.' },
  'PM-REG-INT-02': { group: 'B', owner: 'User / product owner', effort: 'S', need: 'Approval to submit the Booking integration form on NRVC_Hall (may change its booking link).' },
  'PM-REG-CFG-09': { group: 'A', owner: 'Automation', effort: 'M', need: 'Cross-module check: toggle Pre-Shipping off on a test project and check the delivery checklist step in Procurement Log (the "Regression part 3" suite it was planned for was never built).' },
  'PM-REG-CFG-10': { group: 'A', owner: 'Automation', effort: 'M', need: 'Cross-module check of the GRN option on a delivery (planned for the never-built "Regression part 3").' },
  'PM-REG-CFG-11': { group: 'A', owner: 'Automation', effort: 'M', need: 'Cross-module check: Management Dashboard read items older than the archive period (planned for "Regression part 3").' },
  'PM-REG-CFG-13': { group: 'A', owner: 'Automation', effort: 'M', need: 'Two-phase test: seed today, verify after the 05:00–06:00 IST batch next day (keep the seed in a file between runs).' },
  'PM-REG-CFG-14': { group: 'D', owner: 'Product owner', effort: 'M', need: 'NRVC_Hall booking link not confirmed (Q-ANT-6); then a two-phase batch check.' },
  'PM-REG-CFG-15': { group: 'A', owner: 'Automation', effort: 'M', need: 'Two-phase test: seed today, verify after the daily batch.' },
  'PM-REG-CFG-16': { group: 'A', owner: 'Automation', effort: 'M', need: 'Two-phase test: seed today, verify after the daily batch.' },
  'PM-REG-CFG-17': { group: 'B', owner: 'Product owner', effort: 'M', need: 'Two-phase batch check on SCP_Testing_Ram, which needs that project\'s Configuration Options (see CFG-18).' },
  'PM-REG-CFG-18': { group: 'B', owner: 'Product owner', effort: 'S', need: 'SCP_Testing_Ram\'s Configuration Options cannot be saved while its week fields are empty; filling them changes that project permanently. Approval, or a fresh project.' },
  'PM-REG-PSC-05': { group: 'B', owner: 'Product owner', effort: 'S', need: 'Same as CFG-18.' },
  'PM-REG-FDI-18': { group: 'C', owner: 'Team', effort: 'M', need: 'An inspector account that can sign in (YOPmail invite acceptance is blocked by Cloudflare for automation).' },
  'PM-REG-FDI-26a': { group: 'C', owner: 'Team', effort: 'S', need: 'Same mailbox / activation need as UM-REG-09 (invite from User Management).' },
  'PM-REG-FDI-28': { group: 'C', owner: 'Team', effort: 'M', need: 'The inspector login (see FDI-18) and an FDI record assigned to it.' },
  'PM-REG-FDI-28a': { group: 'A', owner: 'Automation', effort: 'S', need: 'An assigned FDI record exists after FDI-REG-06 (Self Assign) – run this check after it.' },
  'PM-REG-FDI-46': { group: 'C', owner: 'Team', effort: 'M', need: 'A second project in NRVC_Hall\'s organisation (R62, Q-FDI-8). Creating a project cannot be undone, so it needs approval or a team-provided project.' },
  'PM-REG-FDI-48': { group: 'C', owner: 'Team', effort: 'M', need: 'Same as FDI-46.' },
  'PM-REG-FDI-49': { group: 'C', owner: 'Team', effort: 'M', need: 'Same as FDI-46.' },
  'PM-REG-INV-06': { group: 'A', owner: 'Automation', effort: 'M', need: 'Cross-module: change stock in Inventory Management below the rule minimum and check the breach notification.' },
  'PM-REG-MM-11': { group: 'B', owner: 'User / product owner', effort: 'S', need: 'Approval: if the app allows it, a material used by submittals would be deleted (R14). A disposable run material with a run submittal would limit the impact.' },
  'PM-REG-PSC-03': { group: 'A', owner: 'Automation', effort: 'M', need: 'Cross-module: enable a run question in PreShipping Checklist and check it in a delivery checklist (Procurement Log).' },
  'PM-REG-PSC-04': { group: 'A', owner: 'Automation', effort: 'M', need: 'Cross-module: disable it and check it is hidden in the delivery checklist.' },
  'PM-REG-PLC-06': { group: 'A', owner: 'Automation', effort: 'M', need: 'Cross-module: reorder columns in Procurement Log Configuration and check the grid order.' },
  'PM-REG-PLC-07': { group: 'A', owner: 'Automation', effort: 'M', need: 'Cross-module: a custom field appears in Add Submittal.' },
  'PM-REG-SITE-07': { group: 'B', owner: 'User / product owner', effort: 'S', need: 'Approval: if the app allows it, a site with deliveries would be deleted (R14). A disposable run site with a run delivery would limit the impact.' },
  // ---------------- Role-based access ----------------
  'PM-REG-ROLE-08': { group: 'D', owner: 'Product owner', effort: 'L', need: 'A mapping of the Supplier/Subcontractor permissions (87 / 75) to the screens and buttons they control.' },
  'PM-REG-ROLE-09': { group: 'C', owner: 'Developer', effort: 'M', need: 'Where the session permission list can be read (keys such as sidebar:project_management:view) to compare with the Update Role keys.' },
  'PM-REG-ROLE-10': { group: 'C', owner: 'Team', effort: 'S', need: 'Covered by PM-REG-FDI-18, which needs the inspector login.' },
  'PM-REG-ROLE-11': { group: 'C', owner: 'Team', effort: 'S', need: 'An Organisation-Admin-only account (the available admin accounts are platform/global admins).' },
  'PM-REG-ROLE-12': { group: 'C', owner: 'Team', effort: 'M', need: 'Mailbox / activation need as UM-REG-09.' },
  'PM-REG-ROLE-13': { group: 'C', owner: 'Team', effort: 'M', need: 'Mailbox / activation need as UM-REG-09.' },
  'PM-REG-ROLE-16': { group: 'A', owner: 'Automation (after the role set-up works)', effort: 'S', need: 'Create a System Message as the Supplier account (with the create permission on the test role), then check Delete with and without the permission.', blocker: ROLE_BLOCKED },
  'PM-REG-ROLE-22': { group: 'B', owner: 'User / product owner', effort: 'S', need: 'Creates a project, which cannot be undone. Approval, or check only that the organisation list offers every organisation (without saving).' },
  'PM-REG-ROLE-23': { group: 'C', owner: 'Team', effort: 'S', need: 'A Project-Admin-only account (the available Project Admin account is a platform admin).' },
  'PM-REG-ROLE-24': { group: 'D', owner: 'Product owner', effort: 'S', need: 'The Supplier role has "Project: Create a new project" ticked (22 Nov 2026) and SCP has no project-creation entry. Is the permission intended, and where should creation be refused?' },
  // ---------------- Inventory ----------------
  'INV-REG-03': { group: 'A', owner: 'Automation', effort: 'S', need: 'Check the Loss balance after a reload in INV-REG-15 (its grid-refresh step is Known Defect OBS-INV-4), so this case can count on the saved balance.' },
  'INV-REG-21': { group: 'A', owner: 'Automation', effort: 'S', need: 'Add an "Incoming Load = delivered QTY incl. damaged" check after PL-REG-DLV-13 (no executed check reads it yet).' },
  'INV-REG-24': { group: 'E', owner: 'Team', effort: '-', need: 'SCP-DEF-002: the ledger date picker freezes the tab. Manual check until the defect is fixed.' },
  'INV-REG-25': { group: 'E', owner: 'Team', effort: '-', need: 'SCP-DEF-002 (same as INV-REG-24).' }
};
for (const id of ['PM-REG-FDI-05a', 'PM-REG-FDI-05b', 'PM-REG-FDI-05c', 'PM-REG-FDI-05d', 'PM-REG-FDI-05e', 'PM-REG-FDI-05f', 'PM-REG-FDI-05g', 'PM-REG-FDI-05h', 'PM-REG-FDI-05i', 'PM-REG-FDI-05j', 'PM-REG-FDI-05k', 'PM-REG-FDI-05l', 'PM-REG-FDI-05m', 'PM-REG-FDI-05n'])
  plan[id] = { group: 'A', owner: 'Automation', effort: 'L (all 14)', need: 'Cross-module: change the FDI setting, then open the inspection form of a run delivery (PL part 3 creates one: PL-REG-INT-01) and check its effect. Planned for the never-built "Regression part 3".' };
for (const id of ['PM-REG-ROLE-02', 'PM-REG-ROLE-03', 'PM-REG-ROLE-14', 'PM-REG-ROLE-04', 'PM-REG-ROLE-05', 'PM-REG-ROLE-06', 'PM-REG-ROLE-07', 'PM-REG-ROLE-15', 'PM-REG-ROLE-17', 'PM-REG-ROLE-18', 'PM-REG-ROLE-19', 'PM-REG-ROLE-21'])
  plan[id] = { group: 'C', owner: 'Automation + developer', effort: 'S (written, tests/pm-flow/role-regression.spec.js)', need: roleNeed, blocker: ROLE_BLOCKED };

module.exports = { GROUPS, plan };
