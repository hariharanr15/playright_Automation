// Role-based access (PM-REG-ROLE-01…24, docs/functional-discovery/PM_REGRESSION_SCENARIOS.md §15) – READ-ONLY.
//
// Rule (user, 22 Nov 2026): a role has no fixed access. The organisation admin enables what each role may use in
// Voyage Control Admin › Roles (platform "Supply Chain Planner") › edit role, and a user sees only what their role has
// enabled. So the suite never changes a role: for the Supplier and Subcontractor accounts it
//   1. reads the account's Project Role on NRVC_Hall (SCP session),
//   2. reads that role's enabled permissions from the Roles tab (the editor is closed without Save),
//   3. signs in as the account and checks menus, pages and buttons against those permissions.
// Cases that need a role change (ROLE-02, ROLE-06), a creation in the portal (ROLE-13, ROLE-22) or other accounts stay
// Skipped with the reason.
const { test, expect } = require('@playwright/test');
const { runPmSuite } = require('./support/pm-flow');
const { plKit } = require('./support/pl-flow');
const { LoginPage } = require('../../pages/login.page');
const { PlatformChooserPage } = require('../../pages/platform-chooser.page');
const { ProjectSelectorPage } = require('../../pages/project-selector.page');
const { maskEmail } = require('../../utils/access/access-model');

const SUITE = 'Role-based access regression';
const MODULE = 'Role-based access';
const PM_TAB = ['Menu: Project Management section', 'Screen: Project Management: View project management screen'];
const P = {
  matList: 'Material: List', matAdd: 'Material: Add',
  siteView: 'Project: Site: View or list site information', siteCreate: 'Project: Site: Create a new project site',
  smProject: 'System Messages: Create (Project)', smPlatform: 'System Messages: Create (Platform)',
  watch: 'Users: Material Watch', watchAssign: 'Users: Material Watch Assign',
  rulesList: 'Inventory: Control rules: List', rulesAdd: 'Inventory: Control rules: Add'
};
const ROUTE = { 'Material Master': 'material-master', 'Site Details': 'site-details', 'System Messages': 'system-messages', 'Watched Materials': 'watched-materials', 'Inventory Control': 'inventory-control', 'Common Utilities': 'common-utilities', 'Common UoM': 'common-uom', 'Material Category': 'material-category', 'Configuration Options': 'configuration-options', 'Bulk Upload Status': 'bulk-upload-status' };
const OWN_PERMISSION_FREE = ['Common Utilities', 'Common UoM', 'Material Category', 'Configuration Options', 'Bulk Upload Status']; // R52

const meta = (id, title, kind, extra = {}) => ({ id, module: MODULE, submodule: kind, suite: SUITE, title: `[${kind}] ${title}`, navPath: ['Voyage Control Admin', 'Roles'], ...extra });
const clean = t => String(t || '').replace(/\s+/g, ' ').trim();
const norm = t => clean(t).toLowerCase();

test.describe.configure({ mode: 'serial' });
test.setTimeout(90 * 60 * 1000);

test('Role-based access – regression (read-only)', async ({ page, browserName }) => {
  await runPmSuite({ page, browserName, suite: SUITE, scenarios: async ({ run, config }) => {
    const browser = page.context().browser();
    const k = plKit(page);
    const ACCOUNTS = [
      { key: 'Supplier', email: process.env.SCP_SUPPLIER_USERNAME, password: process.env.SCP_SUPPLIER_PASSWORD },
      { key: 'Subcontractor', email: process.env.SCP_SUBCONTRACTOR_USERNAME, password: process.env.SCP_SUBCONTRACTOR_PASSWORD }
    ].filter(a => a.email && a.password);
    const state = { adm: null, adminNav: [] };

    // ---------------- Voyage Control Admin › Roles (read-only) ----------------
    const admSettle = async (ms = 2500) => { await state.adm.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null); await state.adm.waitForTimeout(ms); };
    const openPortal = async () => {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const p = await ctx.newPage();
      await p.goto(config.loginUrl, { waitUntil: 'domcontentloaded' });
      await new LoginPage(p).login(config.username, config.password);
      const title = p.getByRole('link', { name: 'Voyage Control Admin', exact: true });
      await expect(title, 'Voyage Control Admin tile for the admin account').toBeVisible({ timeout: 30000 });
      const popup = ctx.waitForEvent('page', { timeout: 20000 });
      await title.locator('xpath=following::a[normalize-space()="Open"][1]').click();
      state.adm = await popup; await admSettle();
      const current = state.adm.getByText(/^(V3 Construction deliveries|Supply Chain Planner|Payment Service|Analytics|Geofence Service)$/).first();
      if (!/Supply Chain Planner/.test(await current.innerText())) {
        await current.click(); await state.adm.waitForTimeout(800);
        await state.adm.getByText('Supply Chain Planner', { exact: true }).last().click(); await admSettle();
      }
    };
    const editor = () => state.adm.getByText(/Select new permissions for/).first().locator('xpath=ancestor::div[.//button[normalize-space()="Save"]][1]');
    const readRole = async name => {
      await state.adm.getByText('Roles', { exact: true }).first().click(); await admSettle();
      const row = state.adm.getByRole('row').filter({ has: state.adm.getByRole('cell', { name, exact: true }) }).first();
      await expect(row, `role "${name}" listed in Roles`).toBeVisible({ timeout: 20000 });
      await row.locator('button').first().click();
      await expect(editor(), 'role editor').toBeVisible({ timeout: 20000 }); await state.adm.waitForTimeout(800);
      const boxes = await editor().locator('input[type=checkbox]:not([name="select_all"])').evaluateAll(es => es.map(e => ({ key: e.name, label: (e.previousElementSibling?.innerText || '').trim(), checked: e.checked })));
      // Close WITHOUT Save.
      await state.adm.keyboard.press('Escape'); await state.adm.waitForTimeout(800);
      if (await editor().isVisible().catch(() => false)) { await state.adm.getByText('Roles', { exact: true }).first().click(); await admSettle(); }
      return { all: boxes, on: new Set(boxes.filter(b => b.checked).map(b => b.label)) };
    };

    // ---------------- SCP as an account ----------------
    const signInAs = async acct => {
      const ctx = await browser.newContext({ baseURL: config.baseUrl, viewport: { width: 1440, height: 900 } });
      const p = await ctx.newPage();
      await p.goto(config.loginUrl, { waitUntil: 'domcontentloaded' });
      await new LoginPage(p).login(acct.email, acct.password);
      await p.waitForURL(u => /platforms\/choose/i.test(u.pathname) || u.origin === new URL(config.baseUrl).origin, { timeout: 45000 });
      acct.chooser = /platforms\/choose/i.test(p.url()) ? (await p.getByRole('link').allInnerTexts()).map(clean).filter(Boolean) : null;
      if (acct.chooser) await new PlatformChooserPage(p, config).openSupplyChainPlanner();
      await expect(p).toHaveURL(/\/management-dashboard\/?$/, { timeout: 30000 });
      const selector = new ProjectSelectorPage(p, config);
      await selector.ensureProject(config.projectName);
      acct.role = ((await selector.sessionProjects()).find(x => norm(x.name) === norm(config.projectName)) || {}).role?.name || null;
      acct.page = p;
      return p;
    };
    const settle = async (p, ms = 2000) => { await p.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => null); await p.waitForTimeout(ms); };
    const navItems = async p => (await p.locator('nav').getByRole('button').allInnerTexts()).map(t => clean(t).replace(/\s+\d+\+?$/, '')).filter(Boolean);
    const openPage = async (p, label) => {
      await p.goto(`/${ROUTE[label]}`, { waitUntil: 'domcontentloaded' }); await settle(p, 2500);
      const onRoute = new URL(p.url()).pathname.replace(/\/+$/, '') === `/${ROUTE[label]}`;
      const heading = await p.getByRole('heading', { name: label }).first().isVisible().catch(() => false)
        || await p.locator('main').getByText(label, { exact: true }).first().isVisible().catch(() => false);
      const denied = await p.getByText(/not authori[sz]ed|access denied|forbidden|don't have (the )?(access|permission)/i).first().isVisible().catch(() => false);
      return { open: onRoute && heading && !denied, path: new URL(p.url()).pathname };
    };
    const hasButton = async (p, name) => { const b = p.locator('main').getByRole('button', { name, exact: true }).first(); return (await b.isVisible().catch(() => false)) && (await b.isEnabled().catch(() => false)); };
    const yes = b => (b ? 'yes' : 'no');

    // ================= Setup =================
    const setup = await run.scenario(meta('ROLE-SETUP', 'Read the enabled access of each account\'s role (no changes)', 'Setup'), async s => {
      await k.signIn(s, config);
      await s.step('Project Admin (all access): read the left menu → reference list of menu entries', async () => {
        state.adminNav = await navItems(page);
        s.observe(state.adminNav.join(' | '));
        expect(state.adminNav.length).toBeGreaterThan(3);
      }, { critical: true });
      for (const acct of ACCOUNTS) {
        await s.step(`Sign in as the ${acct.key} account (${maskEmail(acct.email)}, separate browser) → SCP opens on ${config.projectName}; its Project Role is read`, async () => {
          await signInAs(acct);
          s.observe(`${acct.key} account: Project Role "${acct.role}"; platform chooser ${acct.chooser ? `shown (${acct.chooser.join(', ')})` : 'not shown (single-platform account)'}`);
          expect(acct.role, 'Project Role read').toBeTruthy();
        }, { critical: true });
      }
      await s.step('Voyage Control Admin › platform "Supply Chain Planner" › Roles: open each account\'s role and read the ticked permissions (closed without Save)', async () => {
        await openPortal();
        for (const acct of ACCOUNTS) {
          acct.perms = await readRole(acct.role);
          acct.pmTab = PM_TAB.every(l => acct.perms.on.has(l));
          s.observe(`${acct.role}: ${acct.perms.on.size} of ${acct.perms.all.length} permissions enabled; Project Management tab ${acct.pmTab ? 'enabled' : 'not enabled'}`);
        }
      }, { critical: true });
    });

    try {
      if (setup.status === 'Passed') {
        await run.scenario(meta('PM-REG-ROLE-08', 'Each account sees exactly the menu entries its role enables', 'Role'), async s => {
          for (const acct of ACCOUNTS) {
            await s.step(`${acct.key} (${acct.role}): for every enabled/disabled "Menu: …" permission that names a left-menu entry → the entry is shown only when it is enabled`, async () => {
              const shown = await navItems(acct.page);
              const menus = acct.perms.all.filter(b => /^Menu:\s*/.test(b.label));
              const checked = []; const wrong = [];
              for (const m of menus) {
                const name = norm(m.label.replace(/^Menu:\s*/, '').replace(/\s*section$/i, ''));
                const entry = state.adminNav.find(n => norm(n) === name || norm(n).startsWith(name) || name.startsWith(norm(n)));
                if (!entry) continue; // permission without a matching menu entry: not judged
                const visible = shown.some(n => norm(n) === norm(entry));
                checked.push(`${entry}: enabled ${yes(m.checked)} / shown ${yes(visible)}`);
                if (visible !== m.checked) wrong.push(`${entry} (${m.checked ? 'enabled but hidden' : 'not enabled but shown'})`);
              }
              s.observe(`Menu entries: ${shown.join(', ')} · checked: ${checked.join('; ')}`);
              expect(checked.length, 'menu permissions matched to entries').toBeGreaterThan(0);
              expect(wrong, `menu entries that do not follow the role: ${wrong.join(', ')}`).toEqual([]);
            });
          }
        });
        // FDI-REG-01c (Other modules plan, run here 22 Nov 2026): FDI access follows the role's "FDI: View".
        await run.scenario({ ...meta('FDI-REG-01c', 'First Delivery Inspections follows the role\'s "FDI: View"', 'Role'), module: 'First Delivery Inspections', navPath: ['First Delivery Inspections'] }, async s => {
          for (const acct of ACCOUNTS) {
            await s.step(`${acct.key} (${acct.role}): "First Delivery Inspections" menu and page are available only when "FDI: View" is enabled`, async () => {
              const enabled = acct.perms.on.has('FDI: View');
              const menu = (await navItems(acct.page)).some(n => norm(n) === 'first delivery inspections');
              await acct.page.goto('/first-delivery-inspections', { waitUntil: 'domcontentloaded' }); await settle(acct.page, 3000);
              const onRoute = /\/first-delivery-inspections/.test(new URL(acct.page.url()).pathname);
              const heading = await acct.page.getByText('First Delivery Inspections', { exact: true }).first().isVisible().catch(() => false);
              s.observe(`FDI: View ${enabled ? 'enabled' : 'not enabled'}; menu ${yes(menu)}; page ${yes(onRoute && heading)}`);
              expect(menu, 'menu follows FDI: View').toBe(enabled);
              expect(onRoute && heading, 'page follows FDI: View').toBe(enabled);
            });
          }
        });
        await run.scenario(meta('PM-REG-ROLE-05', 'Without Project Management tab access no PM page is usable', 'Role'), async s => {
          const without = ACCOUNTS.filter(a => !a.pmTab);
          if (!without.length) { await s.step('No account role lacks the PM tab access → nothing to check', async () => s.observe('every account role has PM tab access')); return; }
          for (const acct of without) {
            await s.step(`${acct.key} (${acct.role}, PM tab not enabled): no "Project Management" menu; Material Master, Site Details and System Messages opened by URL are not usable`, async () => {
              const menu = (await navItems(acct.page)).some(n => norm(n) === 'project management');
              const open = [];
              for (const label of ['Material Master', 'Site Details', 'System Messages']) { const r = await openPage(acct.page, label); if (r.open) open.push(label); }
              s.observe(`PM menu ${menu ? 'shown' : 'hidden'}; opened by URL: ${open.join(', ') || 'none'}`);
              expect(menu, 'Project Management menu hidden').toBe(false);
              expect(open, `PM pages usable by URL without PM tab access: ${open.join(', ')}`).toEqual([]);
            });
          }
        });
        await run.scenario(meta('PM-REG-ROLE-21', 'PM tab access opens the pages that have no permission of their own (R52)', 'Role'), async s => {
          const withTab = ACCOUNTS.filter(a => a.pmTab);
          if (!withTab.length) { await s.step('No account role has PM tab access → nothing to check', async () => s.observe('no account role has PM tab access')); return; }
          for (const acct of withTab) {
            await s.step(`${acct.key} (${acct.role}): ${OWN_PERMISSION_FREE.join(', ')} open`, async () => {
              const closed = []; for (const label of OWN_PERMISSION_FREE) if (!(await openPage(acct.page, label)).open) closed.push(label);
              expect(closed).toEqual([]);
            });
          }
        });
        // Page and button checks: the expected state is computed from the role's own permissions.
        const pageCase = (id, title, label, rules) => run.scenario(meta(id, title, 'Role'), async s => {
          for (const acct of ACCOUNTS) {
            await s.step(`${acct.key} (${acct.role}): open ${label} by URL → ${rules.map(r => `${r.what} ${r.expectFrom}`).join('; ')}`, async () => {
              const r = await openPage(acct.page, label);
              const lines = []; const wrong = [];
              for (const rule of rules) {
                const expected = rule.expected(acct.perms.on, acct.pmTab);
                const actual = await rule.actual(acct.page, r);
                if (expected === null) { lines.push(`${rule.what}: ${yes(actual)} (not judged here – see ROLE-05)`); continue; }
                if (!r.open && rule.what !== 'page usable') { lines.push(`${rule.what}: page not open, not judged`); continue; }
                lines.push(`${rule.what}: expected ${yes(expected)}, got ${yes(actual)}`);
                if (expected !== actual) wrong.push(`${rule.what} ${expected ? 'missing' : 'shown without the permission'}`);
              }
              s.observe(`${label} ${r.open ? 'opens' : `not usable (${r.path})`} · ${lines.join('; ')}`);
              expect(wrong, `${acct.key}: ${wrong.join(', ')}`).toEqual([]);
            });
          }
        });
        // These cases judge the page's OWN permissions only. Whether a PM page can be reached at all without the Project
        // Management tab access is one rule, checked once in ROLE-05 (so one root cause is not reported in every case).
        // Without PM tab access the page is expected to be unreachable (ROLE-05), so "page usable" is only judged for a
        // role WITH PM tab access; buttons are judged whenever the page did open.
        const pageOpen = perm => ({ what: 'page usable', expectFrom: perm ? `= "${perm}" (roles with PM tab access)` : '= PM tab access', expected: (on, tab) => tab ? (!perm || on.has(perm)) : null, actual: async (p, r) => r.open });
        const button = (name, perm) => ({ what: `"${name}"`, expectFrom: `= "${perm}"`, expected: on => on.has(perm), actual: async (p, r) => r.open && hasButton(p, name) });
        await pageCase('PM-REG-ROLE-03', 'Edit access allows changes (Material Master "Add Material")', 'Material Master', [pageOpen(P.matList), button('Add Material', P.matAdd)]);
        await pageCase('PM-REG-ROLE-04', 'View-only access blocks changes (Material Master list without "Add Material")', 'Material Master', [pageOpen(P.matList), button('Add Material', P.matAdd)]);
        await pageCase('PM-REG-ROLE-07', 'Access is per action and per page (Site Details "Add Site")', 'Site Details', [pageOpen(P.siteView), button('Add Site', P.siteCreate)]);
        await pageCase('PM-REG-ROLE-15', 'System Messages create permission ("New message")', 'System Messages', [pageOpen(null), { what: '"New message"', expectFrom: '= a System Messages create permission', expected: on => on.has(P.smProject) || on.has(P.smPlatform), actual: async (p, r) => r.open && hasButton(p, 'New message') }]);
        // "Add watch" only appears after a user is picked on the page, so only page access is judged here.
        await pageCase('PM-REG-ROLE-17', 'Material Watch permissions (Watched Materials)', 'Watched Materials', [pageOpen(P.watch)]);
        await pageCase('PM-REG-ROLE-19', 'Inventory Control rule permissions ("Add Rule")', 'Inventory Control', [pageOpen(P.rulesList), button('Add Rule', P.rulesAdd)]);
        await run.scenario(meta('PM-REG-ROLE-18', 'Platform vs Project scope of a new System Message', 'Role'), async s => {
          const able = ACCOUNTS.filter(a => a.perms.on.has(P.smProject) || a.perms.on.has(P.smPlatform));
          if (!able.length) { await s.step('No account role may create System Messages → scope not checked', async () => s.observe('no account role has a System Messages create permission')); return; }
          for (const acct of able) {
            await s.step(`${acct.key}: "New message" → "Platform" offered only with "${P.smPlatform}", "Project" only with "${P.smProject}"; Cancel`, async () => {
              await openPage(acct.page, 'System Messages');
              await acct.page.locator('main').getByRole('button', { name: 'New message', exact: true }).click(); await settle(acct.page, 1000);
              const options = await acct.page.locator('main select').first().locator('option').allInnerTexts();
              await acct.page.locator('main').getByRole('button', { name: 'Cancel', exact: true }).click().catch(() => acct.page.keyboard.press('Escape'));
              s.observe(`Scope options: ${options.join(' | ')}`);
              expect(options.some(o => /Platform/.test(o))).toBe(acct.perms.on.has(P.smPlatform));
              expect(options.some(o => /Project \(this project only\)/.test(o))).toBe(acct.perms.on.has(P.smProject));
            });
          }
        });
        // Rules confirmed by the user on 22 Nov 2026 (ROLE-11, ROLE-16).
        await run.scenario(meta('PM-REG-ROLE-11', 'Only the Org Admin sees Voyage Control Admin', 'Role'), async s => {
          await s.step('Admin account: the platform chooser shows "Voyage Control Admin" (opened in set-up); Supplier and Subcontractor: no "Voyage Control Admin" tile', async () => {
            expect(state.adm, 'admin portal opened from the admin account tile').toBeTruthy();
            for (const acct of ACCOUNTS) {
              const tile = (acct.chooser || []).includes('Voyage Control Admin');
              s.observe(`${acct.key}: ${acct.chooser ? `chooser ${acct.chooser.join(', ')}` : 'no platform chooser (single-platform account)'}`);
              expect(tile, `${acct.key} sees Voyage Control Admin`).toBe(false);
            }
          });
        });
        await run.scenario(meta('PM-REG-ROLE-16', 'Deleting a System Message follows "System Messages: Delete"', 'Role'), async s => {
          await s.step('Project Admin role: read "System Messages: Delete (Project)" (no Save); System Messages as Project Admin → a "Delete" action is offered only when it is enabled', async () => {
            const on = (await readRole('Project Admin')).on.has('System Messages: Delete (Project)');
            await page.goto('/system-messages', { waitUntil: 'domcontentloaded' }); await k.settle(3000);
            const del = await page.locator('main').getByRole('button', { name: /^Delete$/ }).first().isVisible().catch(() => false)
              || await page.locator('main [title="Delete"], main img[alt="Delete"]').first().isVisible().catch(() => false);
            s.observe(`Delete (Project) ${on ? 'enabled' : 'not enabled'}; "Delete" ${del ? 'offered' : 'not offered'} (deleting an owned message is PM-REG-SYS-10)`);
            expect(del).toBe(on);
          });
          for (const acct of ACCOUNTS) {
            await s.step(`${acct.key} (${acct.role}): "System Messages: Delete" not enabled → no way to delete a message (page not usable or no "Delete")`, async () => {
              const on = acct.perms.on.has('System Messages: Delete (Project)') || acct.perms.on.has('System Messages: Delete (Platform)');
              const r = await openPage(acct.page, 'System Messages');
              const del = r.open && await acct.page.locator('main').getByRole('button', { name: /^Delete$/ }).first().isVisible().catch(() => false);
              s.observe(`Delete permission ${on ? 'enabled' : 'not enabled'}; page ${r.open ? 'usable' : 'not usable'}; "Delete" ${del ? 'offered' : 'not offered'}`);
              if (!on) expect(del, 'Delete offered without the permission').toBe(false);
            });
          }
        });
        // Rule (user, 22 Nov 2026): projects are created only in the organisation admin portal (Voyage Control Admin › New
        // Project); SCP has no create-project control for anyone.
        await run.scenario(meta('PM-REG-ROLE-24', 'Project creation only in the admin portal; non-admin users cannot create projects', 'Role'), async s => {
          const createText = /create (a )?(new )?project|new project|add project/i;
          await s.step('Org Admin: Voyage Control Admin shows "New Project"', async () => {
            await expect(state.adm.getByText('New Project', { exact: true }).first()).toBeVisible({ timeout: 20000 });
          });
          await s.step('Project Admin in SCP: no create-project control on the dashboard, the menu or the project selector', async () => {
            await page.goto('/management-dashboard', { waitUntil: 'domcontentloaded' }); await k.settle(3000);
            const found = await page.getByText(createText).count();
            s.observe(`create-project controls in SCP: ${found}`);
            expect(found).toBe(0);
          });
          for (const acct of ACCOUNTS) {
            await s.step(`${acct.key} (${acct.role}): no create-project control in SCP, and the admin portal's projects page is not available`, async () => {
              await acct.page.goto('/management-dashboard', { waitUntil: 'domcontentloaded' }); await settle(acct.page, 3000);
              const inScp = await acct.page.getByText(createText).count();
              await acct.page.goto(new URL('/dashboard/projects', state.adm.url()).toString(), { waitUntil: 'domcontentloaded' }); await settle(acct.page, 5000);
              const portal = await acct.page.getByText('New Project', { exact: true }).first().isVisible().catch(() => false);
              const perm = acct.perms.on.has('Project: Create a new project');
              s.observe(`"Project: Create a new project" ${perm ? 'enabled' : 'not enabled'} in the role; create-project controls in SCP ${inScp}; admin portal New Project ${portal ? 'available' : 'not available'}${perm && !portal ? ' – the permission is enabled but there is no place where this user could create a project (question for the team)' : ''}`);
              expect(inScp, 'create-project control in SCP').toBe(0);
              expect(portal, 'admin portal New Project available to a non-admin account').toBe(false);
            });
          }
        });
        await run.scenario(meta('PM-REG-ROLE-14', 'Non-admin accounts cannot reach the role administration', 'Role'), async s => {
          for (const acct of ACCOUNTS) {
            await s.step(`${acct.key}: no "Voyage Control Admin" tile; the admin portal's Roles page is not available`, async () => {
              const tile = (acct.chooser || []).includes('Voyage Control Admin');
              await acct.page.goto(new URL('/dashboard/roles', state.adm.url()).toString(), { waitUntil: 'domcontentloaded' }); await settle(acct.page, 5000);
              const roles = await acct.page.getByText('Create New Role', { exact: true }).first().isVisible().catch(() => false);
              s.observe(`tile ${tile ? 'shown' : 'not shown'}; admin URL → ${new URL(acct.page.url()).host}${new URL(acct.page.url()).pathname}`);
              expect(tile).toBe(false);
              expect(roles, 'Roles administration available').toBe(false);
            });
          }
        });
      }
      await run.scenario(meta('PM-REG-ROLE-01', 'Project Admin has the Project Management pages', 'Role'), async s => {
        await s.step('Project Admin: every Project Management page opens', async () => {
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
        await s.step('Read "FDI: Assign Inspector" on the Project Admin role (no Save); First Delivery Inspections as Project Admin → "Assign" shown only when it is enabled', async () => {
          if (!state.adm) await openPortal();
          const ticked = (await readRole('Project Admin')).on.has('FDI: Assign Inspector');
          await k.menu('First Delivery Inspections'); await k.settle(3000);
          await page.locator('main tbody tr').first().waitFor({ timeout: 30000 }).catch(() => null); await k.settle(2000);
          const assign = await page.locator('main').getByRole('button', { name: /^Assign( Inspector)?$/ }).first().isVisible().catch(() => false);
          s.observe(`FDI: Assign Inspector ${ticked ? 'enabled' : 'not enabled'}; "Assign" ${assign ? 'shown' : 'not shown'}`);
          expect(assign).toBe(ticked);
        });
      });
    } finally {
      for (const acct of ACCOUNTS) if (acct.page) await acct.page.context().close().catch(() => null);
      if (state.adm) await state.adm.context().close().catch(() => null);
    }

    for (const [id, title, reason] of [
      ['PM-REG-ROLE-02', 'Admin can edit role access', 'Needs a role change; this suite only reads the configured access (user decision 22 Nov 2026)'],
      ['PM-REG-ROLE-06', 'A role change applies to a signed-in user', 'Needs a role change; this suite only reads the configured access'],
      ['PM-REG-ROLE-09', 'Nav matches permission keys', 'The session permission list to compare with is not exposed to the tests yet'],
      ['PM-REG-ROLE-10', 'Disabled FDI inspector', 'Covered by PM-REG-FDI-18 (needs an inspector login)'],
      ['PM-REG-ROLE-12', 'Role assigned at user creation (SCP)', 'Needs YOPmail invite acceptance (Cloudflare check, not bypassed)'],
      ['PM-REG-ROLE-13', 'Org Admin creates a user in the portal', 'Expected (user, 22 Nov 2026): the Org Admin can create a user in the organisation admin portal. Creating a platform user is a write in the shared portal: awaiting approval (the new user could then be activated automatically through mail.tm)'],
      ['PM-REG-ROLE-22', 'Org Admin can create a project in any organization', 'Expected (user, 22 Nov 2026): the Org Admin can create projects in any organisation in the admin portal. The New Project form has no organisation field (Project Name, Region, Address, Project Owner e-mail, HubSpot link); creating a project cannot be undone: awaiting approval'],
      ['PM-REG-ROLE-23', 'Project Admin limited to their associated organization', 'No Project-Admin-only account (the Project Admin account is a platform admin)'],
    ]) run.skip(meta(id, title, 'Role'), reason);
  } });
});
