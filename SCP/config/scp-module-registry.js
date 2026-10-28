// Mandatory full-regression hierarchy. The order is fixed; accessibility is resolved per user and project at run time.
// nav: labels that identify the module in the left navigation (`under` narrows the match to a group).
// route/heading: page-level probe. actions: action controls observed on the module page (visibility only).
// sessionPermissions: indicative application permission codes, recorded for comparison only and never used as the oracle.
// stages: reviewed suites run by default; `qualified: false` suites need --include-unqualified and their stated inputs.
// requiresAccess: modules whose access the stage's business chain needs; a missing one blocks the stage.
const MODULES = [
  { id: 'project-management', name: 'Project Management', order: 1,
    nav: [{ label: 'Project Management' }], route: 'material-master', heading: 'Material Master',
    sessionPermissions: ['sidebar:project_management:view', 'screen:project:management'],
    stages: [
      { name: 'project-management-readonly', config: 'playwright.pending.config.js', files: ['tests/regression/pending/scp-project-management-readonly.spec.js',
        'tests/regression/pending/scp-project-management-pages.spec.js'] },
      { name: 'project-management-cucumber', kind: 'cucumber', profile: 'projectManagement', qualified: false,
        reason: 'Unfiltered Cucumber workflows create reference/configuration records; exclusive allocations are required' }
    ] },
  { id: 'user-management', name: 'User Management', order: 2,
    nav: [{ label: 'User Management' }], route: 'user-management', actions: [{ name: 'Invite Users' }],
    sessionPermissions: ['screen:user:management', 'user:list'],
    stages: [
      { name: 'access-model-contracts', config: 'playwright.stage.config.js', files: ['tests/regression/user-management/scp-access-model-contract.spec.js'], mode: 'non-browser contract checks', requiresModuleAccess: false },
      { name: 'user-management-smoke', config: 'playwright.chrome-smoke.config.js', files: ['tests/smoke/user-management'] },
      { name: 'user-management-regression', config: 'playwright.stage.config.js', files: ['tests/regression/user-management/scp-user-management.spec.js'], qualified: false,
        reason: 'User invitation and organisation changes need a controlled mailbox and deterministic identities' }
    ] },
  { id: 'supplier-list', name: 'Supplier List', order: 3,
    nav: [{ label: 'Supplier List', under: 'User Management' }], route: 'supplier-list', actions: [{ name: 'Add Supplier' }],
    sessionPermissions: ['supplier:list'],
    coveredBy: 'With --with-inventory-mutations, a new supplier is created and validated by the Inventory prerequisite chain',
    stages: [
      { name: 'supplier-list-readonly', config: 'playwright.stage.config.js', files: ['tests/regression/user-management/supplier-list/scp-supplier-readonly.spec.js'], mode: 'guarded form validation without saving' },
      { name: 'supplier-list-regression', config: 'playwright.stage.config.js', files: ['tests/regression/user-management/supplier-list/scp-supplier-list.spec.js'], qualified: false,
        reason: 'Legacy supplier/material mapping needs owned supplier and material records' }
    ] },
  { id: 'procurement-log', name: 'Procurement Log', order: 4,
    nav: [{ label: 'Procurement Log' }], route: 'procurement-log', actions: [{ name: 'Add Submittal' }],
    sessionPermissions: ['submittal:list'],
    stages: [
      { name: 'procurement-readonly', config: 'playwright.application-readonly.config.js', files: ['tests/smoke/procurement-log'], mode: 'qualified-record read-only' },
      { name: 'procurement-regression', config: 'playwright.stage.config.js', files: ['tests/regression/procurement-log'], qualified: false,
        reason: 'Standalone delivery/checklist/shipping/GRN needs qualified dynamic inputs and confirmed checklist rules',
        requiresAccess: ['project-management', 'supplier-list'] }
    ] },
  { id: 'inventory-management', name: 'Inventory Management', order: 5,
    nav: [{ label: 'Inventory Management' }], route: 'inventory-management', heading: 'Inventory Management',
    sessionPermissions: ['inventory:view'],
    stages: [
      { name: 'inventory-smoke', config: 'playwright.chrome-smoke.config.js', files: ['tests/smoke/inventory-management'], mode: 'pre-auth guarded read-only', exceptWithMutations: true },
      { name: 'inventory-mutations', config: 'playwright.inventory.config.js', mutation: true, mode: 'owned-record mutations',
        files: ['tests/regression/inventory-management/scp-inventory-management.spec.js', 'tests/regression/inventory-management/scp-inventory-bulk-upload.spec.js', 'tests/smoke/inventory-management'],
        requiresAccess: ['project-management', 'supplier-list', 'procurement-log'] },
      { name: 'inventory-calendar', config: 'playwright.inventory.config.js', mode: 'guarded read-only plus calendar arithmetic and prerequisite contracts', files: [
        'tests/regression/inventory-management/scp-inventory-activity-calendar.spec.js',
        'tests/regression/inventory-management/scp-inventory-calendar-dates.spec.js',
        'tests/regression/inventory-management/scp-inventory-prerequisites-contract.spec.js'] }
    ] },
  { id: 'first-delivery-inspection', name: 'First Delivery Inspection', order: 6,
    nav: [{ label: 'First Delivery Inspections' }], route: 'first-delivery-inspections', heading: 'First Delivery Inspections',
    sessionPermissions: ['fdi:view'],
    stages: [
      { name: 'fdi-readonly', config: 'playwright.stage.config.js', mode: 'qualified completed-delivery read-only (Blocked without SCP_FDI_READONLY_DATA)',
        files: ['tests/regression/first-delivery-inspections/scp-fdi-readonly.spec.js', 'tests/regression/first-delivery-inspections/scp-fdi-access.spec.js'] },
      { name: 'fdi-owned-delivery', config: 'playwright.stage.config.js', mode: 'dedicated owned inspection; shared configuration is blocked',
        enabledBy: 'SCP_FDI_OWNED_MUTATIONS', files: ['tests/regression/first-delivery-inspections/scp-fdi-owned-flow.spec.js'], requiresAccess: ['procurement-log', 'inventory-management'] },
      { name: 'fdi-regression', config: 'playwright.stage.config.js', qualified: false,
        reason: 'Shared settings/question changes and reassignment need an exclusive configuration allocation and role accounts; owned submission is covered by fdi-owned-delivery',
        files: ['tests/regression/first-delivery-inspections/scp-first-delivery-inspection.spec.js', 'tests/regression/first-delivery-inspections/scp-first-delivery-inspection-filters.spec.js',
          'tests/regression/first-delivery-inspections/scp-first-delivery-inspection-config.spec.js', 'tests/regression/first-delivery-inspections/scp-fdi-photo-viewer.spec.js'],
        requiresAccess: ['procurement-log', 'inventory-management'] }
    ] },
  { id: 'international-shipment', name: 'International Shipment', order: 7,
    nav: [{ label: 'International Shipments' }], route: 'international-shipments', actions: [{ name: '+ Log Shipment' }],
    stages: [
      { name: 'international-shipments-smoke', config: 'playwright.chrome-smoke.config.js', files: ['tests/smoke/international-shipments'], mode: 'pre-auth guarded read-only' },
      { name: 'international-shipments-source', config: 'playwright.stage.config.js', files: ['tests/regression/international-shipments/scp-shipment-source.spec.js'], mode: 'guarded project-scoped route qualification' },
      { name: 'international-shipments-owned', config: 'playwright.stage.config.js', files: ['tests/regression/international-shipments/scp-shipment-owned-flow.spec.js'],
        enabledBy: 'SCP_SHIPMENT_OWNED_MUTATIONS', mode: 'fresh owned submittal and shipment; existing reference shipments are read-only', requiresAccess: ['procurement-log', 'supplier-list', 'project-management'] },
      { name: 'international-shipments-regression', config: 'playwright.stage.config.js', files: ['tests/regression/international-shipments/scp-international-shipments.spec.js'], qualified: false,
        reason: 'Legacy flow uses shared reference defaults; the qualified positive path is covered by international-shipments-owned', requiresAccess: ['procurement-log'] }
    ] },
  { id: 'management-dashboard', name: 'Management Dashboard', order: 8,
    nav: [{ label: 'Management Dashboard' }, { label: 'Dashboard' }], route: 'management-dashboard', heading: 'Management Dashboard',
    sessionPermissions: ['dashboard:view'],
    stages: [
      { name: 'dashboard-smoke', config: 'playwright.chrome-smoke.config.js', files: ['tests/smoke/management-dashboard', 'tests/smoke/scp-tabs-smoke.spec.js'], mode: 'pre-auth guarded read-only' },
      { name: 'dashboard-regression', config: 'playwright.pending.config.js', files: ['tests/regression/management-dashboard'] }
    ] },
  { id: 'analytics', name: 'Analytics', order: 9,
    nav: [{ label: 'Analytics' }], route: 'aggregate-stats',
    sessionPermissions: ['sidebar:analytics:view'],
    stages: [
      { name: 'analytics', config: 'playwright.pending.config.js', files: ['tests/regression/pending/scp-analytics.spec.js', 'tests/regression/pending/scp-lead-time-analysis.spec.js',
        'tests/regression/pending/scp-subcontractor-issues.spec.js', 'tests/regression/pending/scp-issue-records-contract.spec.js',
        'tests/regression/pending/scp-issue-table-rows-contract.spec.js', 'tests/regression/pending/scp-historical-date-search-contract.spec.js'] },
      { name: 'independent-source-contracts', config: 'playwright.pending.config.js', files: ['tests/regression/pending/scp-independent-business-contracts.spec.js'] }
    ] },
  { id: 'enterprise', name: 'Enterprise', order: 10,
    nav: [{ label: 'Enterprise' }, { label: 'Enterprise View' }], route: 'enterprise-view',
    sessionPermissions: ['sidebar:enterprise:view', 'enterprise:view'],
    stages: [{ name: 'enterprise', config: 'playwright.pending.config.js', files: ['tests/smoke/enterprise', 'tests/regression/enterprise'] }] },
  { id: 'document-management', name: 'Document Management', order: 11,
    nav: [{ label: 'Document Management' }, { label: 'Documents' }, { label: 'All Documents' }], route: 'all-documents',
    stages: [{ name: 'documents', config: 'playwright.pending.config.js', files: ['tests/regression/pending/scp-document-management.spec.js'] }] }
];

// Left-navigation toggles expanded during discovery, in addition to any control reporting aria-expanded="false".
const NAV_GROUPS = ['Project Management', 'User Management', 'Analytics', 'Enterprise', 'Reference Data', 'Document Management', 'Reports'];

for (const [index, module] of MODULES.entries()) {
  if (module.order !== index + 1) throw new Error(`Module registry order is broken at ${module.id}`);
  for (const id of module.stages.flatMap(stage => stage.requiresAccess || [])) {
    if (!MODULES.some(item => item.id === id)) throw new Error(`${module.id} requires unknown module ${id}`);
  }
}
const moduleById = id => {
  const module = MODULES.find(item => item.id === id);
  if (!module) throw new Error(`Unknown SCP module ${id}. Known modules: ${MODULES.map(item => item.id).join(', ')}`);
  return module;
};

module.exports = { MODULES, NAV_GROUPS, moduleById };
