const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { MODULES } = require('../../../config/scp-module-registry');
const { LeftNavigationPage } = require('../../../pages/left-navigation.page');
const { credentialsFor } = require('../../../config/scp.config');
const { STATUS, evaluateModule, loadExpectations, carriedOver, moduleAccess, sessionIndicates } = require('../../../utils/access/access-model');

const observation = (navVisible, reachable, extra = {}) => ({ navVisible, page: { probed: true, reachable, reason: reachable ? 'Opened' : 'Redirected to /management-dashboard' },
  actions: [], sessionIndicates: null, ...extra });
const write = value => { const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'scp-access-')), 'expectations.json'); fs.writeFileSync(file, JSON.stringify(value)); return file; };

test('Access contract: unavailable pages cannot establish permission denial', () => {
  for (const page of [{ probed: true, reachable: null, failureCategory: 'Environment', reason: 'HTTP 503' }, { probed: false, reachable: false }]) {
    for (const expected of [true, false, undefined]) expect(evaluateModule(observation(false, false, { page }), expected)).toMatchObject({ status: STATUS.unknown, validated: false });
  }
});
test('Access contract: action-only mismatch fails and contextual actions remain unvalidated', () => {
  const seen = observation(true, true, { actions: [{ name: 'Create', visible: true }, { name: 'Edit', visible: null }] });
  expect(evaluateModule(seen, undefined, { Create: false }).status).toBe(STATUS.failed);
  expect(evaluateModule(seen, true, { Edit: true }).validated).toBe(false);
});
test('Access contract: credential profile chooses the actual login pair', () => {
  expect(credentialsFor({ SCP_USERNAME: 'base', SCP_PASSWORD: 'base-secret', SCP_DEFAULT_ROLE: 'supplier', SCP_SUPPLIER_USERNAME: 'supplier', SCP_SUPPLIER_PASSWORD: 'supplier-secret' })).toMatchObject({ username: 'supplier', password: 'supplier-secret' });
  expect(credentialsFor({ SCP_USERNAME: 'base', SCP_PASSWORD: 'base-secret', SCP_DEFAULT_ROLE: 'supplier', SCP_SUPPLIER_USERNAME: 'supplier' })).toMatchObject({ username: 'supplier', password: '' });
});

test('Access contract: registry keeps the mandatory 11-module regression order', () => {
  expect(MODULES.map(module => module.name)).toEqual(['Project Management', 'User Management', 'Supplier List', 'Procurement Log', 'Inventory Management',
    'First Delivery Inspection', 'International Shipment', 'Management Dashboard', 'Analytics', 'Enterprise', 'Document Management']);
});
test('Access contract: without expectations the observed access is reported and never validated', () => {
  expect(evaluateModule(observation(true, true))).toMatchObject({ status: STATUS.accessible, validated: false });
  expect(evaluateModule(observation(false, false))).toMatchObject({ status: STATUS.notAccessible, validated: false });
});
test('Access contract: configured access that is not granted is an access validation failure', () => {
  expect(evaluateModule(observation(false, false), true).status).toBe(STATUS.failed);
  expect(evaluateModule(observation(true, false), true).status).toBe(STATUS.failed);
});
test('Access contract: intentionally inaccessible module is Not Accessible, not a defect', () => {
  expect(evaluateModule(observation(false, false), false)).toMatchObject({ status: STATUS.notAccessible, validated: true });
});
test('Access contract: a denied module reachable by direct URL is an access validation failure', () => {
  const result = evaluateModule(observation(false, true), false);
  expect(result.status).toBe(STATUS.failed);
  expect(result.findings).toContain('Hidden in navigation but its route opened by direct URL');
});
test('Access contract: action expectations are compared only with observed controls', () => {
  const seen = observation(true, true, { actions: [{ name: 'Add Supplier', visible: true }, { name: 'Invite Users', visible: null }] });
  expect(evaluateModule(seen, true, { 'Add Supplier': false }).status).toBe(STATUS.failed);
  expect(evaluateModule(seen, true, { 'Add Supplier': true }).status).toBe(STATUS.accessible);
  expect(evaluateModule(seen, true, { 'Invite Users': true }).actionResults[0].status).toBe('Not observed');
});
test('Access contract: session permissions are informational only', () => {
  const role = { code: 'project:admin', name: 'Project Admin', permissions: ['sidebar:enterprise:view'] };
  const enterprise = MODULES.find(module => module.id === 'enterprise');
  expect(sessionIndicates(enterprise, role)).toBe(true);
  const result = evaluateModule(observation(false, false, { sessionIndicates: true }), false);
  expect(result.status).toBe(STATUS.notAccessible);
  expect(result.findings.join(' ')).toMatch(/informational/);
});
test('Access contract: navigation carried over from a previous project is detected', () => {
  expect(carriedOver([{ label: 'Enterprise' }, { label: 'Procurement Log' }], [{ label: 'Procurement Log' }])).toEqual(['Enterprise']);
  expect(carriedOver([{ label: 'Procurement Log' }], [{ label: 'procurement log' }])).toEqual([]);
});
test('Access contract: navigation matching honours the parent group', () => {
  const tree = [{ label: 'Supplier List', path: ['User Management'] }, { label: 'Analytics', path: ['Project Management'] }];
  expect(LeftNavigationPage.matches(tree, [{ label: 'Supplier List', under: 'User Management' }])).toHaveLength(1);
  expect(LeftNavigationPage.matches(tree, [{ label: 'Supplier List', under: 'Enterprise' }])).toHaveLength(0);
  expect(LeftNavigationPage.matches(tree, [{ label: 'analytics' }])).toHaveLength(1);
});
test('Access contract: expectations require a stated source and boolean values', () => {
  const account = { label: 'A', usernameEnv: 'U', passwordEnv: 'P' };
  expect(() => loadExpectations(write({ accounts: [{ ...account, projects: [{ project: 'X', modules: { enterprise: true } }] }] }))).toThrow(/authoritative source/);
  expect(() => loadExpectations(write({ accounts: [{ ...account, projects: [{ project: 'X', source: 'Org Admin export', modules: { enterprise: 'yes' } }] }] }))).toThrow(/true or false/);
  expect(() => loadExpectations(write({ accounts: [{ ...account, projects: [{ project: 'X', source: 'Org Admin export', modules: { reports: true } }] }] }))).toThrow(/Unknown SCP module/);
  expect(loadExpectations(write({ accounts: [{ ...account, projects: [{ project: 'X', source: 'Org Admin export', modules: { enterprise: false } }] }] })).accounts).toHaveLength(1);
});
test('Access contract: example expectations are rejected until a real source is supplied', () => {
  expect(() => loadExpectations(path.resolve(__dirname, '../../../test-data/scp-access.example.json'))).toThrow(/authoritative source/);
});
test('Access contract: module gating uses the primary account on the target project only', () => {
  const evaluation = { status: STATUS.notAccessible, observed: STATUS.notAccessible };
  const matrix = { combinations: [
    { account: 'Other', primary: false, project: 'P', modules: [{ id: 'enterprise', evaluation: { status: STATUS.accessible } }] },
    { account: 'Main', primary: true, project: 'P', modules: [{ id: 'enterprise', evaluation }] }] };
  expect(moduleAccess(matrix, 'P', 'enterprise').status).toBe(STATUS.notAccessible);
  expect(moduleAccess(matrix, 'Q', 'enterprise').status).toBe('Unknown');
  expect(moduleAccess(null, 'P', 'enterprise').reason).toMatch(/did not produce/);
});
