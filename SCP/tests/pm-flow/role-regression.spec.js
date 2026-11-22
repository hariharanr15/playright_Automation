// Role-based access (PM-REG-ROLE-01…24, docs/functional-discovery/PM_REGRESSION_SCENARIOS.md §15).
//
// SAFETY (user decision 22 Nov 2026): roles in Voyage Control Admin are platform-wide (every organisation on staging uses
// the same "Supplier" and "Subcontractor"), so the shared roles are NEVER edited. The suite works on its own role
// TEST_ROLE ("SCP Automation Test Role"): it is created once with a copy of the Supplier role's permissions, the test
// Supplier account's Project Role on NRVC_Hall is switched to it for the run, and permissions are changed on TEST_ROLE
// only. The last scenario ALWAYS runs: it puts the account back on its original Project Role, resets TEST_ROLE to the
// Supplier copy and checks both (the portal cannot deactivate a role; TEST_ROLE stays listed). Manual fallback: Voyage Control Admin › Projects ›
// NRVC_Hall › PROJECT USERS › the Supplier account › Project Role = Supplier.
//
// Three browser contexts: the admin portal (Project Admin account, which is a platform admin), SCP as Project Admin, and
// SCP as the test Supplier account.
const { test, expect } = require('@playwright/test');
const { runPmSuite } = require('./support/pm-flow');
const { plKit } = require('./support/pl-flow');
const { LoginPage } = require('../../pages/login.page');
const { maskEmail } = require('../../utils/access/access-model');

const SUITE = 'Role-based access regression';
const MODULE = 'Role-based access';
const TEST_ROLE = process.env.SCP_TEST_ROLE_NAME || 'SCP Automation Test Role';
const BASE_ROLE = 'Supplier';
const PM_TAB = ['Menu: Project Management section', 'Screen: Project Management: View project management screen'];
const MAT = { list: 'Material: List', add: 'Material: Add', edit: 'Material: Edit', del: 'Material: Delete' };
const SM = { createProject: 'System Messages: Create (Project)', createPlatform: 'System Messages: Create (Platform)', deleteProject: 'System Messages: Delete (Project)' };
const SITE = { view: 'Project: Site: View or list site information', create: 'Project: Site: Create a new project site' };
const WATCH = ['Users: Material Watch', 'Users: Material Watch Assign'];
const RULES = { list: 'Inventory: Control rules: List', add: 'Inventory: Control rules: Add', edit: 'Inventory: Control rules: Edit', del: 'Inventory: Control rules: Delete' };
const ROUTE = { 'Material Master': 'material-master', 'Site Details': 'site-details', 'System Messages': 'system-messages', 'Watched Materials': 'watched-materials', 'Inventory Control': 'inventory-control', 'Common Utilities': 'common-utilities', 'Common UoM': 'common-uom', 'Material Category': 'material-category', 'Configuration Options': 'configuration-options', 'Bulk Upload Status': 'bulk-upload-status' };

const meta = (id, title, kind, extra = {}) => ({ id, module: MODULE, submodule: kind, suite: SUITE, title: `[${kind}] ${title}`, navPath: ['Voyage Control Admin', 'Roles'], ...extra });
const clean = t => String(t || '').replace(/\s+/g, ' ').trim();

test.describe.configure({ mode: 'serial' });
test.setTimeout(90 * 60 * 1000);

test('Role-based access – regression', async ({ page, browserName }) => {
  await runPmSuite({ page, browserName, suite: SUITE, scenarios: async ({ run, config }) => {
    const browser = page.context().browser();
    const SUP = { email: process.env.SCP_SUPPLIER_USERNAME, password: process.env.SCP_SUPPLIER_PASSWORD };
    const k = plKit(page);
    const state = { adm: null, sup: null, supKit: null, baseline: null, original: null, assigned: false, roleCreated: false, applied: [] };

    // ---------------- Admin portal ----------------
    const admSettle = async (ms = 2500) => { await state.adm.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null); await state.adm.waitForTimeout(ms); };
    const openPortal = async () => {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const p = await ctx.newPage();
      await p.goto(config.loginUrl, { waitUntil: 'domcontentloaded' });
      await new LoginPage(p).login(config.username, config.password);
      const title = p.getByRole('link', { name: 'Voyage Control Admin', exact: true });
      await expect(title, 'Voyage Control Admin tile for this account').toBeVisible({ timeout: 30000 });
      const popup = ctx.waitForEvent('page', { timeout: 20000 });
      await title.locator('xpath=following::a[normalize-space()="Open"][1]').click();
      state.adm = await popup;
      await admSettle();
      // Platform selector (top bar) → Supply Chain Planner
      const current = state.adm.getByText(/^(V3 Construction deliveries|Supply Chain Planner|Payment Service|Analytics|Geofence Service)$/).first();
      if (!/Supply Chain Planner/.test(await current.innerText())) {
        await current.click(); await state.adm.waitForTimeout(800);
        await state.adm.getByText('Supply Chain Planner', { exact: true }).last().click(); await admSettle();
      }
    };
    const nav = async label => { await state.adm.getByText(label, { exact: true }).first().click(); await admSettle(); };
    const roleRow = name => state.adm.getByRole('row').filter({ has: state.adm.getByRole('cell', { name, exact: true }) }).first();
    const editor = () => state.adm.getByText(/Select new permissions for/).first().locator('xpath=ancestor::div[.//button[normalize-space()="Save"]][1]');
    const readEditor = async () => editor().locator('input[type=checkbox]:not([name="select_all"])').evaluateAll(es => es.map(e => ({ key: e.name, label: (e.previousElementSibling?.innerText || e.parentElement?.innerText || '').trim(), checked: e.checked })));
    const openEditor = async name => {
      await nav('Roles');
      const row = roleRow(name);
      await expect(row, `role "${name}" listed`).toBeVisible({ timeout: 20000 });
      await row.locator('button').first().click();
      await expect(editor(), 'Update Role editor').toBeVisible({ timeout: 20000 });
      await state.adm.waitForTimeout(800);
    };
    const closeEditor = async () => { await state.adm.keyboard.press('Escape'); await state.adm.waitForTimeout(800); if (await editor().isVisible().catch(() => false)) await nav('Roles'); };
    // Ticks exactly the permissions whose LABELS are in `wanted` (a Set) and saves. Returns the labels changed.
    const setPermissions = async wanted => {
      const boxes = await readEditor();
      const changed = [];
      for (const b of boxes) {
        const want = wanted.has(b.label);
        if (want !== b.checked) { await editor().locator(`input[type=checkbox][name="${b.key}"]`).click(); changed.push(`${want ? '+' : '−'}${b.label}`); }
      }
      await editor().getByRole('button', { name: 'Save', exact: true }).click();
      await expect(editor(), 'editor closes after Save').toBeHidden({ timeout: 20000 }).catch(async () => { await closeEditor(); });
      await admSettle(1500);
      return changed;
    };
    const permissionsOf = async name => { await openEditor(name); const boxes = await readEditor(); await closeEditor(); return boxes; };
    const ensureRole = async () => {
      await nav('Roles');
      if (await roleRow(TEST_ROLE).isVisible().catch(() => false)) return false;
      await state.adm.getByText('Create New Role', { exact: true }).first().click(); await admSettle(1000);
      const form = state.adm.getByText(/This Role will be automatically assigned to current platform/).first().locator('xpath=ancestor::div[.//button[normalize-space()="Save" or normalize-space()="Create"]][1]');
      await form.locator('input:not([type=checkbox])').first().fill(TEST_ROLE);
      const boxes = await form.locator('input[type=checkbox]:not([name="select_all"])').evaluateAll(es => es.map(e => ({ key: e.name, label: (e.previousElementSibling?.innerText || '').trim() })));
      for (const b of boxes) if (state.baseline.has(b.label)) await form.locator(`input[type=checkbox][name="${b.key}"]`).click();
      await form.getByRole('button', { name: /^(Save|Create)$/ }).last().click();
      await admSettle();
      await nav('Roles');
      await expect(roleRow(TEST_ROLE), `"${TEST_ROLE}" created`).toBeVisible({ timeout: 20000 });
      return true;
    };
    // The Active switch of the Roles list is read-only (disabled input, 22 Nov 2026): the state is only read.
    const roleActive = async () => { await nav('Roles'); return roleRow(TEST_ROLE).locator('input[name="isActive"]').first().isChecked(); };
    // NRVC_Hall › PROJECT USERS: the row of an e-mail (paged, 10 per page) and its Project Role select.
    const projectUsers = async () => {
      await nav('Projects');
      const search = state.adm.getByRole('textbox').first();
      await search.fill(config.projectName); await search.press('Enter'); await admSettle();
      await state.adm.getByRole('row').filter({ hasText: config.projectName }).first().getByRole('cell').nth(1).click(); await admSettle();
      await state.adm.getByRole('tab', { name: 'PROJECT USERS' }).click(); await admSettle();
    };
    const userRow = async email => {
      for (let p = 1; p <= 30; p++) {
        const row = state.adm.getByRole('row').filter({ hasText: email }).first();
        if (await row.isVisible().catch(() => false)) return row;
        // Pager links are named "Page N" / "Next page"; the last page disables "Next page".
        const next = state.adm.getByRole('button', { name: 'Next page', exact: true }).last();
        if (!(await next.isVisible().catch(() => false)) || (await next.getAttribute('aria-disabled')) === 'true') break;
        await next.click(); await admSettle(1200);
      }
      throw new Error(`${maskEmail(email)} not found in ${config.projectName} › PROJECT USERS`);
    };
    const projectRoleOf = async email => { await projectUsers(); return clean(await (await userRow(email)).locator('[role=combobox]').first().innerText()); };
    const setProjectRole = async (email, role) => {
      await projectUsers();
      const row = await userRow(email);
      await row.locator('[role=combobox]').first().click();
      await state.adm.getByRole('listbox').last().getByRole('option', { name: role, exact: true }).click();
      await state.adm.waitForTimeout(1200);
      const confirm = state.adm.getByRole('button', { name: /^(Yes|Confirm|OK|Update)$/ }).last();
      if (await confirm.isVisible().catch(() => false)) await confirm.click();
      await admSettle();
      return projectRoleOf(email);
    };

    // ---------------- SCP as the test Supplier account ----------------
    const supplierSignIn = async s => {
      if (state.sup) await state.sup.context().close().catch(() => null);
      const ctx = await browser.newContext({ baseURL: config.baseUrl, viewport: { width: 1440, height: 900 } });
      state.sup = await ctx.newPage();
      state.supKit = plKit(state.sup);
      await state.supKit.signIn(s, { ...config, username: SUP.email, password: SUP.password });
    };
    const sp = () => state.sup;
    const supSettle = async (ms = 2000) => { await sp().waitForLoadState('networkidle', { timeout: 20000 }).catch(() => null); await sp().waitForTimeout(ms); };
    const pmMenuVisible = () => sp().locator('nav').getByRole('button', { name: 'Project Management', exact: true }).first().isVisible().catch(() => false);
    // Opens a PM page by its route and reports whether it is usable: still on the route and its heading shown.
    const openPage = async label => {
      await sp().goto(`/${ROUTE[label]}`, { waitUntil: 'domcontentloaded' }); await supSettle(2500);
      const onRoute = new URL(sp().url()).pathname.replace(/\/+$/, '') === `/${ROUTE[label]}`;
      const heading = await sp().getByRole('heading', { name: label }).first().isVisible().catch(() => false)
        || await sp().locator('main').getByText(label, { exact: true }).first().isVisible().catch(() => false);
      const denied = await sp().getByText(/not authori[sz]ed|access denied|permission|forbidden|don't have access/i).first().isVisible().catch(() => false);
      return { open: onRoute && heading && !denied, onRoute, heading, denied, url: new URL(sp().url()).pathname };
    };
    const hasButton = async name => { const b = sp().locator('main').getByRole('button', { name, exact: true }).first(); return (await b.isVisible().catch(() => false)) && (await b.isEnabled().catch(() => false)); };
    // Applies a TEST_ROLE permission set and makes the Supplier session pick it up: reload first, sign in again if the
    // reload is not enough (ROLE-06 records which one was needed).
    const apply = async (s, label, wanted, probe) => {
      await openEditor(TEST_ROLE);
      const changed = await setPermissions(wanted);
      s.observe(`${TEST_ROLE}: ${changed.join(', ') || 'no change'}`);
      await sp().reload({ waitUntil: 'domcontentloaded' }); await supSettle(3000);
      if (!probe || await probe()) { state.applied.push(`${label}: reload`); return 'reload'; }
      await supplierSignIn(s);
      state.applied.push(`${label}: sign-in again`);
      return 'relogin';
    };
    const withBase = (add = [], remove = []) => { const set = new Set(state.baseline); for (const a of add) set.add(a); for (const r of remove) set.delete(r); return set; };

    // ================= Setup =================
    const setup = await run.scenario(meta('ROLE-SETUP', `Test role "${TEST_ROLE}" and the test Supplier account on it`, 'Setup'), async s => {
      await s.step('Voyage Control Admin (Project Admin account, platform admin) › platform "Supply Chain Planner" → Roles list shown', async () => {
        await openPortal(); await nav('Roles');
        await expect(roleRow(BASE_ROLE)).toBeVisible({ timeout: 20000 });
      }, { critical: true });
      await s.step(`Read the "${BASE_ROLE}" role's permissions (editor closed without Save) → baseline for the test role`, async () => {
        const boxes = await permissionsOf(BASE_ROLE);
        state.baseline = new Set(boxes.filter(b => b.checked).map(b => b.label));
        state.allLabels = new Set(boxes.map(b => b.label));
        s.observe(`${BASE_ROLE}: ${state.baseline.size} of ${boxes.length} permissions ticked`);
        expect(state.baseline.size).toBeGreaterThan(0);
        for (const label of [...PM_TAB, ...Object.values(MAT), ...Object.values(SM), ...Object.values(SITE), ...WATCH, ...Object.values(RULES)]) expect(state.allLabels.has(label), `permission "${label}" exists`).toBe(true);
      }, { critical: true });
      await s.step(`"${TEST_ROLE}": create it with the ${BASE_ROLE} permissions if missing, make it active, reset it to the ${BASE_ROLE} permissions`, async () => {
        state.roleCreated = await ensureRole();
        expect(await roleActive(), 'test role active').toBe(true);
        await openEditor(TEST_ROLE); const changed = await setPermissions(state.baseline);
        s.observe(`${state.roleCreated ? 'Created' : 'Existing role reused'}; reset: ${changed.length} change(s)`);
        const now = await permissionsOf(TEST_ROLE);
        expect(now.filter(b => b.checked).map(b => b.label).sort(), 'test role = Supplier copy').toEqual([...state.baseline].sort());
      }, { critical: true });
      await s.step(`${config.projectName} › PROJECT USERS › ${maskEmail(SUP.email)}: record the Project Role, set it to "${TEST_ROLE}"`, async () => {
        state.original = await projectRoleOf(SUP.email);
        s.observe(`Original Project Role: ${state.original}`);
        expect(state.original, 'original role recorded').toBeTruthy();
        expect(state.original, 'not already the test role (an earlier run was not restored)').not.toBe(TEST_ROLE);
        state.assigned = true; // from here on the restore step must run
        expect(await setProjectRole(SUP.email, TEST_ROLE)).toBe(TEST_ROLE);
      }, { critical: true });
      await s.step(`Sign in to SCP as the test Supplier account (separate browser) → ${config.projectName} opens`, () => supplierSignIn(s), { critical: true });
    });

    try {
      if (setup.status === 'Passed') {
        // ================= Permission cases on TEST_ROLE =================
        await run.scenario(meta('PM-REG-ROLE-02', 'Admin can edit role access (saved and shown again)', 'Role'), async s => {
          await s.step(`Update Role "${TEST_ROLE}": tick "${SM.createProject}", Save, reopen → still ticked`, async () => {
            await openEditor(TEST_ROLE); await setPermissions(withBase([SM.createProject]));
            const now = await permissionsOf(TEST_ROLE);
            expect(now.find(b => b.label === SM.createProject)?.checked).toBe(true);
          });
        });
        await run.scenario(meta('PM-REG-ROLE-03', 'Edit access allows changes (Material Master)', 'Role'), async s => {
          await s.step(`Test role: PM tab + "${MAT.list}", "${MAT.add}", "${MAT.edit}" → the Supplier account opens Material Master and "Add Material" is available`, async () => {
            await apply(s, 'ROLE-03', withBase([...PM_TAB, MAT.list, MAT.add, MAT.edit], [MAT.del]), async () => (await openPage('Material Master')).open && hasButton('Add Material'));
            const r = await openPage('Material Master'); s.observe(JSON.stringify(r));
            expect(r.open, 'Material Master opens').toBe(true);
            expect(await hasButton('Add Material'), '"Add Material" available').toBe(true);
          });
        });
        await run.scenario(meta('PM-REG-ROLE-04', 'View-only access blocks changes (Material Master)', 'Role'), async s => {
          await s.step(`Test role: PM tab + only "${MAT.list}" → Material Master list opens; "Add Material" hidden or disabled`, async () => {
            await apply(s, 'ROLE-04', withBase(PM_TAB, [MAT.add, MAT.edit, MAT.del]), async () => !(await hasButton('Add Material')));
            const r = await openPage('Material Master'); s.observe(JSON.stringify(r));
            expect(r.open, 'Material Master list visible').toBe(true);
            expect(await hasButton('Add Material'), '"Add Material" hidden or disabled').toBe(false);
          });
        });
        await run.scenario(meta('PM-REG-ROLE-05', 'No PM tab access hides all PM pages', 'Role'), async s => {
          await s.step('Test role without the two PM tab permissions → no "Project Management" menu; opening /material-master and /site-details directly does not show the page', async () => {
            await apply(s, 'ROLE-05', withBase([], PM_TAB), async () => !(await pmMenuVisible()));
            expect(await pmMenuVisible(), 'Project Management menu hidden').toBe(false);
            for (const label of ['Material Master', 'Site Details']) {
              const r = await openPage(label); s.observe(`${label}: ${JSON.stringify(r)}`);
              expect(r.open, `${label} not usable without PM tab access`).toBe(false);
            }
          });
        });
        await run.scenario(meta('PM-REG-ROLE-07', 'Access is per action and per page', 'Role'), async s => {
          await s.step(`Test role: PM tab + "${SITE.view}" + "${SITE.create}" + only "${MAT.list}" → Site Details offers "Add Site"; Material Master has no "Add Material"`, async () => {
            await apply(s, 'ROLE-07', withBase([...PM_TAB, SITE.view, SITE.create, MAT.list], [MAT.add, MAT.edit, MAT.del]), async () => { await openPage('Site Details'); return hasButton('Add Site'); });
            const site = await openPage('Site Details'); s.observe(`Site Details: ${JSON.stringify(site)}`);
            expect(site.open).toBe(true);
            expect(await hasButton('Add Site'), '"Add Site" available').toBe(true);
            await openPage('Material Master');
            expect(await hasButton('Add Material'), '"Add Material" not available').toBe(false);
          });
        });
        await run.scenario(meta('PM-REG-ROLE-15', 'System Messages create permission', 'Role'), async s => {
          await s.step(`Test role: PM tab without "${SM.createProject}" → System Messages has no "New message"`, async () => {
            await apply(s, 'ROLE-15a', withBase(PM_TAB, [SM.createProject, SM.createPlatform]), async () => { await openPage('System Messages'); return !(await hasButton('New message')); });
            const r = await openPage('System Messages'); s.observe(JSON.stringify(r));
            expect(await hasButton('New message'), '"New message" hidden').toBe(false);
          });
          await s.step(`Tick "${SM.createProject}" → "New message" available`, async () => {
            await apply(s, 'ROLE-15b', withBase([...PM_TAB, SM.createProject], [SM.createPlatform]), async () => { await openPage('System Messages'); return hasButton('New message'); });
            await openPage('System Messages');
            expect(await hasButton('New message'), '"New message" available').toBe(true);
          });
        });
        await run.scenario(meta('PM-REG-ROLE-18', 'Platform vs Project scope', 'Role'), async s => {
          await s.step(`Same role (only "${SM.createProject}") › "New message" → the scope list offers "Project (this project only)" and not "Platform (all projects)"; Cancel`, async () => {
            await openPage('System Messages');
            await sp().locator('main').getByRole('button', { name: 'New message', exact: true }).click(); await supSettle(1000);
            const options = await sp().locator('main select').first().locator('option').allInnerTexts();
            s.observe(`Scope options: ${options.join(' | ')}`);
            await sp().locator('main').getByRole('button', { name: 'Cancel', exact: true }).click().catch(() => sp().keyboard.press('Escape'));
            expect(options.some(o => /Project \(this project only\)/.test(o)), 'Project scope offered').toBe(true);
            expect(options.some(o => /Platform/.test(o)), 'Platform scope not offered').toBe(false);
          });
        });
        await run.scenario(meta('PM-REG-ROLE-17', 'Material Watch permissions', 'Role'), async s => {
          await s.step('Test role: PM tab without the two Material Watch permissions → Watched Materials not usable or no "Add watch"', async () => {
            await apply(s, 'ROLE-17a', withBase(PM_TAB, WATCH), async () => { const r = await openPage('Watched Materials'); return !r.open || !(await hasButton('Add watch')); });
            const r = await openPage('Watched Materials'); s.observe(JSON.stringify(r));
            expect(!r.open || !(await hasButton('Add watch')), 'watches cannot be assigned').toBe(true);
          });
          await s.step('Tick both → Watched Materials opens with "Add watch"', async () => {
            await apply(s, 'ROLE-17b', withBase([...PM_TAB, ...WATCH]), async () => { const r = await openPage('Watched Materials'); return r.open && hasButton('Add watch'); });
            const r = await openPage('Watched Materials'); s.observe(JSON.stringify(r));
            expect(r.open).toBe(true);
            expect(await hasButton('Add watch'), '"Add watch" available').toBe(true);
          });
        });
        await run.scenario(meta('PM-REG-ROLE-19', 'Inventory Control rule permissions', 'Role'), async s => {
          await s.step(`Test role: PM tab + only "${RULES.list}" → Inventory Control list without "Add Rule"`, async () => {
            await apply(s, 'ROLE-19a', withBase([...PM_TAB, RULES.list], [RULES.add, RULES.edit, RULES.del]), async () => { await openPage('Inventory Control'); return !(await hasButton('Add Rule')); });
            const r = await openPage('Inventory Control'); s.observe(JSON.stringify(r));
            expect(r.open).toBe(true);
            expect(await hasButton('Add Rule'), '"Add Rule" hidden or disabled').toBe(false);
          });
          await s.step(`Tick "${RULES.add}" → "Add Rule" available`, async () => {
            await apply(s, 'ROLE-19b', withBase([...PM_TAB, RULES.list, RULES.add], [RULES.edit, RULES.del]), async () => { await openPage('Inventory Control'); return hasButton('Add Rule'); });
            await openPage('Inventory Control');
            expect(await hasButton('Add Rule'), '"Add Rule" available').toBe(true);
          });
        });
        await run.scenario(meta('PM-REG-ROLE-21', 'PM tab access opens the pages that have no permission of their own (R52)', 'Role'), async s => {
          await s.step('Test role: the two PM tab permissions → Common Utilities, Common UoM, Material Category, Configuration Options and Bulk Upload Status open', async () => {
            await apply(s, 'ROLE-21', withBase(PM_TAB), async () => (await openPage('Configuration Options')).open);
            const closed = [];
            for (const label of ['Common Utilities', 'Common UoM', 'Material Category', 'Configuration Options', 'Bulk Upload Status']) {
              const r = await openPage(label); s.observe(`${label}: ${r.open ? 'opens' : JSON.stringify(r)}`);
              if (!r.open) closed.push(label);
            }
            expect(closed, `pages not opened: ${closed.join(', ')}`).toEqual([]);
          });
        });
        await run.scenario(meta('PM-REG-ROLE-06', 'A role change applies to a signed-in user', 'Role'), async s => {
          await s.step('From ROLE-03…21: each change made while the Supplier account was signed in → applied after a reload, or after signing in again (recorded)', async () => {
            s.observe(state.applied.join(' · '));
            expect(state.applied.length, 'changes applied').toBeGreaterThan(0);
          });
        });
        // ================= Read-only checks =================
        await run.scenario(meta('PM-REG-ROLE-14', 'Non-admin cannot reach the role administration', 'Role'), async s => {
          await s.step('Supplier account: open the login/platform chooser → no "Voyage Control Admin" tile; open the admin portal URL → no Roles page', async () => {
            await sp().goto(config.loginUrl, { waitUntil: 'domcontentloaded' }); await supSettle(4000);
            const tiles = (await sp().getByRole('link').allInnerTexts()).map(clean).filter(Boolean);
            s.observe(`Chooser/landing links: ${tiles.join(' | ').slice(0, 200)}`);
            expect(tiles.includes('Voyage Control Admin'), 'no Voyage Control Admin tile').toBe(false);
            await sp().goto(new URL('/dashboard/roles', state.adm.url()).toString(), { waitUntil: 'domcontentloaded' }); await supSettle(5000);
            const roles = await sp().getByText('Create New Role', { exact: true }).first().isVisible().catch(() => false);
            s.observe(`Admin URL as Supplier → ${new URL(sp().url()).host}${new URL(sp().url()).pathname}`);
            expect(roles, 'Roles administration not available').toBe(false);
          });
        });
      }
      await run.scenario(meta('PM-REG-ROLE-01', 'Project Admin has the Project Management pages', 'Role'), async s => {
        await k.signIn(s, config);
        await s.step('Project Admin: every Project Management page of the menu opens', async () => {
          const closed = [];
          for (const [label, route] of Object.entries(ROUTE)) {
            await page.goto(`/${route}`, { waitUntil: 'domcontentloaded' }); await k.settle(2000);
            if (new URL(page.url()).pathname.replace(/\/+$/, '') !== `/${route}`) closed.push(label);
          }
          s.observe(closed.length ? `Not opened: ${closed.join(', ')}` : `${Object.keys(ROUTE).length} pages opened`);
          expect(closed).toEqual([]);
        });
      });
      await run.scenario(meta('PM-REG-ROLE-20', 'FDI "Assign Inspector" follows the permission', 'Role'), async s => {
        await s.step('Read "FDI: Assign Inspector" on the Project Admin role (editor closed without Save); First Delivery Inspections as Project Admin → an "Assign" action is shown only when it is ticked', async () => {
          if (!state.adm) await openPortal();
          const boxes = await permissionsOf('Project Admin');
          const ticked = !!boxes.find(b => b.label === 'FDI: Assign Inspector')?.checked;
          await k.menu('First Delivery Inspections'); await k.settle(3000);
          await page.locator('main tbody tr').first().waitFor({ timeout: 30000 }).catch(() => null); await k.settle(2000);
          const assign = await page.locator('main').getByRole('button', { name: /^Assign( Inspector)?$/ }).first().isVisible().catch(() => false);
          s.observe(`FDI: Assign Inspector ${ticked ? 'ticked' : 'not ticked'}; "Assign" action ${assign ? 'shown' : 'not shown'}`);
          expect(assign).toBe(ticked);
        });
      });
    } finally {
      // ================= Restore (always) =================
      await run.scenario(meta('ROLE-RESTORE', 'Restore: original Project Role, test role reset', 'Setup', { always: true }), async s => {
        await s.step(`${maskEmail(SUP.email)} back on its original Project Role on ${config.projectName}`, async () => {
          if (!state.assigned) { s.observe('Project Role was not changed by this run'); return; }
          if (!state.adm) await openPortal();
          // An account found on the test role (an earlier run cut off) goes back to Supplier.
          const target = state.original && state.original !== TEST_ROLE ? state.original : BASE_ROLE;
          const now = await setProjectRole(SUP.email, target);
          s.observe(`Project Role now: ${now}`);
          expect(now).toBe(target);
        }, { critical: true });
        await s.step(`"${TEST_ROLE}" reset to the ${BASE_ROLE} copy`, async () => {
          if (!state.adm || !state.baseline) { s.observe('Test role not touched'); return; }
          await openEditor(TEST_ROLE); await setPermissions(state.baseline);
          const now = await permissionsOf(TEST_ROLE);
          expect(now.filter(b => b.checked).map(b => b.label).sort()).toEqual([...state.baseline].sort());
          s.observe(`Test role kept with the ${BASE_ROLE} copy (active: ${await roleActive()}; the portal offers no way to deactivate a role)`);
        });
        await s.step(`The shared "${BASE_ROLE}" role is unchanged (same ${state.baseline ? state.baseline.size : '?'} permissions as read at the start)`, async () => {
          if (!state.adm || !state.baseline) return;
          const now = await permissionsOf(BASE_ROLE);
          expect(now.filter(b => b.checked).map(b => b.label).sort()).toEqual([...state.baseline].sort());
        });
      });
      if (state.sup) await state.sup.context().close().catch(() => null);
      if (state.adm) await state.adm.context().close().catch(() => null);
    }

    for (const [id, title, reason] of [
      ['PM-REG-ROLE-08', 'Current Supplier / Subcontractor access matches the UI', 'No agreed mapping of the 87/75 role permissions to UI elements yet; ROLE-03…21 check the PM pages one permission at a time'],
      ['PM-REG-ROLE-09', 'Nav matches permission keys', 'The session permission list to compare with is not exposed to the tests yet'],
      ['PM-REG-ROLE-10', 'Disabled FDI inspector', 'Covered by PM-REG-FDI-18'],
      ['PM-REG-ROLE-11', 'Only Org Admin sees Voyage Control Admin', 'No Organisation-Admin-only account: the available admin accounts are platform (global) admins; the non-admin side is checked by ROLE-14'],
      ['PM-REG-ROLE-12', 'Role assigned at user creation (SCP)', 'Needs YOPmail invite acceptance (Cloudflare check, not bypassed)'],
      ['PM-REG-ROLE-13', 'Org Admin creates a user in the portal', 'Needs YOPmail activation (Cloudflare check, not bypassed)'],
      ['PM-REG-ROLE-16', 'System Messages delete permission', 'Needs a message owned by the Supplier account; not created yet'],
      ['PM-REG-ROLE-22', 'Org Admin can create a project in any organization', 'Creates a project, which cannot be undone – not approved'],
      ['PM-REG-ROLE-23', 'Project Admin limited to their associated organization', 'No Project-Admin-only account (the Project Admin account is a platform admin)'],
      ['PM-REG-ROLE-24', 'Users without the permission cannot create projects', 'The Supplier role includes "Project: Create a new project" (22 Nov 2026) and no project-creation entry exists in SCP to test – question for the team']
    ]) run.skip(meta(id, title, 'Role'), reason);
  } });
});
