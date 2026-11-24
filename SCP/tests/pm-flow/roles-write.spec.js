// Role cases that CHANGE something in Voyage Control Admin, approved by the user on 22 Nov 2026:
//   PM-REG-ROLE-02 Admin can edit a role's access – only on the test role "SCP Automation Test Role" (never Supplier /
//                  Subcontractor, which are shared by every organisation).
//   PM-REG-ROLE-06 A role change applies to a signed-in user – the test Supplier account is put on the test role on NRVC_Hall
//                  for the case and ALWAYS put back on its original role (verified from its own SCP session).
//   PM-REG-ROLE-22 Org Admin creates a project (Voyage Control Admin › New Project) – one "SCP Auto Test <run>" project.
const { test, expect } = require('@playwright/test');
const { runPmSuite } = require('./support/pm-flow');
const { prepareContext } = require('./support/app-shell');
const { LoginPage } = require('../../pages/login.page');
const { PlatformChooserPage } = require('../../pages/platform-chooser.page');
const { ProjectSelectorPage } = require('../../pages/project-selector.page');
const { maskEmail } = require('../../utils/access/access-model');

const SUITE = 'Role-based access – admin changes';
const TEST_ROLE = process.env.SCP_TEST_ROLE_NAME || 'SCP Automation Test Role';
const PM_TAB = ['Menu: Project Management section', 'Screen: Project Management: View project management screen'];
const RUN = `SCP Auto Test ${new Date().toISOString().replace(/\D/g, '').slice(2, 12)}`;
const meta = (id, title, kind = 'Role', extra = {}) => ({ id, module: 'Role-based access', submodule: kind, suite: SUITE, title: `[${kind}] ${title}`, navPath: ['Voyage Control Admin'], ...extra });

test.describe.configure({ mode: 'serial' });
test.setTimeout(60 * 60 * 1000);

test('Role-based access – admin changes', async ({ page, browserName }) => {
  await runPmSuite({ page, browserName, suite: SUITE, scenarios: async ({ run, config }) => {
    const browser = page.context().browser();
    const SUP = { email: process.env.SCP_SUPPLIER_USERNAME, password: process.env.SCP_SUPPLIER_PASSWORD };
    const st = { adm: null, sup: null, original: null, assigned: false, baseline: null };

    // ---------- portal ----------
    const settleA = async (ms = 2500) => { await st.adm.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null); await st.adm.waitForTimeout(ms); };
    const openPortal = async () => {
      await page.goto(config.loginUrl, { waitUntil: 'domcontentloaded' });
      await new LoginPage(page).login(config.username, config.password);
      const title = page.getByRole('link', { name: 'Voyage Control Admin', exact: true });
      await expect(title).toBeVisible({ timeout: 30000 });
      const popup = page.context().waitForEvent('page', { timeout: 20000 });
      await title.locator('xpath=following::a[normalize-space()="Open"][1]').click();
      st.adm = await popup; await settleA();
      const current = st.adm.getByText(/^(V3 Construction deliveries|Supply Chain Planner|Payment Service|Analytics|Geofence Service)$/).first();
      if (!/Supply Chain Planner/.test(await current.innerText())) { await current.click(); await st.adm.waitForTimeout(800); await st.adm.getByText('Supply Chain Planner', { exact: true }).last().click(); await settleA(); }
    };
    const nav = async label => { await st.adm.getByText(label, { exact: true }).first().click(); await settleA(); };
    const roleRow = name => st.adm.getByRole('row').filter({ has: st.adm.getByRole('cell', { name, exact: true }) }).first();
    const editor = () => st.adm.getByText(/Select new permissions for/).first().locator('xpath=ancestor::div[.//button[normalize-space()="Save"]][1]');
    const openEditor = async name => { await nav('Roles'); await roleRow(name).locator('button').first().click(); await expect(editor()).toBeVisible({ timeout: 20000 }); await st.adm.waitForTimeout(800); };
    const readEditor = () => editor().locator('input[type=checkbox]:not([name="select_all"])').evaluateAll(es => es.map(e => ({ key: e.name, label: (e.previousElementSibling?.innerText || '').trim(), checked: e.checked })));
    const closeEditor = async () => { await st.adm.keyboard.press('Escape'); await st.adm.waitForTimeout(800); if (await editor().isVisible().catch(() => false)) await nav('Roles'); };
    const permissions = async name => { await openEditor(name); const b = await readEditor(); await closeEditor(); return new Set(b.filter(x => x.checked).map(x => x.label)); };
    const setPermissions = async (name, wanted) => {
      await openEditor(name);
      for (const b of await readEditor()) if (wanted.has(b.label) !== b.checked) await editor().locator(`input[type=checkbox][name="${b.key}"]`).click();
      await editor().getByRole('button', { name: 'Save', exact: true }).click();
      await expect(editor()).toBeHidden({ timeout: 20000 }).catch(() => closeEditor());
      await settleA(1500);
    };
    const projectUsers = async () => {
      await nav('Projects');
      const box = st.adm.getByRole('textbox').first(); await box.fill(config.projectName); await box.press('Enter'); await settleA();
      await st.adm.getByRole('row').filter({ hasText: config.projectName }).first().getByRole('cell').nth(1).click(); await settleA();
      await st.adm.getByRole('tab', { name: 'PROJECT USERS' }).click(); await settleA(4000);
    };
    const setProjectRole = async role => {
      await projectUsers();
      let row = null;
      for (let i = 0; i < 30 && !row; i++) {
        const r = st.adm.locator('tbody tr').filter({ hasText: SUP.email });
        if (await r.count()) { row = r.first(); break; }
        const next = st.adm.getByRole('button', { name: 'Next page', exact: true }).last();
        if ((await next.getAttribute('aria-disabled')) === 'true') break;
        await next.click(); await settleA(2500);
      }
      expect(row, 'Supplier account row').toBeTruthy();
      await row.locator('[role=combobox]').first().click(); await st.adm.waitForTimeout(1200);
      await st.adm.getByRole('listbox').last().getByRole('option', { name: role, exact: true }).click(); await settleA(3000);
    };
    // The PROJECT USERS row can read back a stale role (22 Nov 2026): the role is verified from the account's own session.
    const sessionRole = async () => (((await new ProjectSelectorPage(st.sup, config).sessionProjects()).find(x => x.name.trim().toLowerCase() === config.projectName.toLowerCase()) || {}).role || {}).name;
    const supplierSignIn = async () => {
      if (st.sup) await st.sup.context().close().catch(() => null);
      const ctx = await browser.newContext({ baseURL: config.baseUrl, viewport: { width: 1440, height: 900 } }).then(prepareContext);
      st.sup = await ctx.newPage();
      await st.sup.goto(config.loginUrl, { waitUntil: 'domcontentloaded' });
      await new LoginPage(st.sup).login(SUP.email, SUP.password);
      await st.sup.waitForURL(u => /platforms\/choose/i.test(u.pathname) || u.origin === new URL(config.baseUrl).origin, { timeout: 45000 });
      if (/platforms\/choose/i.test(st.sup.url())) await new PlatformChooserPage(st.sup, config).openSupplyChainPlanner();
      await expect(st.sup).toHaveURL(/\/management-dashboard\/?$/, { timeout: 30000 });
      await new ProjectSelectorPage(st.sup, config).ensureProject(config.projectName);
    };
    const pmMenu = async () => { await st.sup.reload({ waitUntil: 'domcontentloaded' }); await st.sup.waitForTimeout(4000); return st.sup.locator('nav').getByRole('button', { name: 'Project Management', exact: true }).first().isVisible().catch(() => false); };

    const setup = await run.scenario({ ...meta('ROLEW-SETUP', 'Admin portal and test role', 'Setup'), always: true }, async s => {
      await s.step('Sign in, open Voyage Control Admin › Supply Chain Planner; read the test role (baseline)', async () => {
        await openPortal();
        st.baseline = await permissions(TEST_ROLE);
        s.observe(`${TEST_ROLE}: ${st.baseline.size} permissions`);
      }, { critical: true });
    });
    if (setup.status !== 'Passed') { run.abort('Set-up failed'); return; }

    try {
      await run.scenario(meta('PM-REG-ROLE-02', 'Admin can edit a role\'s access (test role)'), async s => {
        await s.step(`Update Role "${TEST_ROLE}": tick "System Messages: Create (Project)", Save; reopen → still ticked`, async () => {
          const wanted = new Set(st.baseline); wanted.add('System Messages: Create (Project)');
          await setPermissions(TEST_ROLE, wanted);
          expect((await permissions(TEST_ROLE)).has('System Messages: Create (Project)')).toBe(true);
        });
        await s.step('Untick it again, Save; reopen → the test role equals its baseline', async () => {
          await setPermissions(TEST_ROLE, st.baseline);
          expect([...(await permissions(TEST_ROLE))].sort()).toEqual([...st.baseline].sort());
        });
      });
      await run.scenario(meta('PM-REG-ROLE-06', 'A role change applies to a signed-in user'), async s => {
        await s.step(`Supplier account (${maskEmail(SUP.email)}): sign in; record its Project Role; put it on "${TEST_ROLE}" in NRVC_Hall › PROJECT USERS; sign in again → its session shows "${TEST_ROLE}"`, async () => {
          await supplierSignIn(); st.original = await sessionRole();
          s.observe(`original role: ${st.original}`);
          expect(st.original).toBe('Supplier');
          st.assigned = true;
          await setProjectRole(TEST_ROLE);
          await supplierSignIn();
          expect(await sessionRole()).toBe(TEST_ROLE);
          expect(await pmMenu(), 'no Project Management menu before the change').toBe(false);
        }, { critical: true });
        await s.step('While the Supplier is signed in: give the test role Project Management tab access, Save → after a reload the Supplier sees "Project Management"', async () => {
          const wanted = new Set(st.baseline); for (const p of PM_TAB) wanted.add(p);
          await setPermissions(TEST_ROLE, wanted);
          let shown = await pmMenu();
          if (!shown) { await supplierSignIn(); shown = await pmMenu(); s.observe('applied only after signing in again'); } else s.observe('applied after a reload');
          expect(shown, 'Project Management menu after the role change').toBe(true);
        });
        await s.step('Remove the access again, Save → after a reload the menu is gone', async () => {
          await setPermissions(TEST_ROLE, st.baseline);
          let shown = await pmMenu();
          if (shown) { await supplierSignIn(); shown = await pmMenu(); }
          expect(shown).toBe(false);
        });
      });
      await run.scenario(meta('PM-REG-ROLE-22', 'Org Admin creates a project in the admin portal'), async s => {
        await s.step(`Voyage Control Admin › "New Project": Project Name "${RUN}", first Region, address, Project Owner = the admin account, "Create Project" → listed under Projects`, async () => {
          await nav('New Project'); await settleA(1500);
          // Fields by their name attribute (siteName / siteAddress / email). Escape closes the whole New Project dialog (23 Nov 2026), so it is never pressed.
          const form = st.adm.locator('input[name=siteName]').locator('xpath=ancestor::div[.//button[normalize-space()="Create Project"]][1]');
          await form.locator('input[name=siteName]').fill(RUN);
          await form.getByText('Region*', { exact: true }).first().locator('xpath=following::input[1]').click(); await st.adm.waitForTimeout(1200);
          const region = (await st.adm.getByRole('option').allInnerTexts())[0];
          await st.adm.getByRole('option', { name: region, exact: true }).click(); await st.adm.waitForTimeout(800);
          s.observe(`region: ${region}`);
          await form.locator('input[name=siteAddress]').fill('32 London Bridge St. London, UK');
          await form.locator('input[name=email]').fill(config.username);
          // "Create Project" is enabled only after the email field loses focus (checked 23 Nov 2026); Tab, not Escape.
          await form.locator('input[name=email]').press('Tab'); await st.adm.waitForTimeout(800);
          await form.getByRole('button', { name: 'Create Project', exact: true }).last().click(); await settleA(4000);
          s.observe((await st.adm.getByRole('status').allInnerTexts().catch(() => [])).join(' | ') || '(no message)');
          await nav('Projects');
          const box = st.adm.getByRole('textbox').first(); await box.fill(RUN); await box.press('Enter'); await settleA();
          await expect(st.adm.getByRole('row').filter({ hasText: RUN }).first(), `"${RUN}" listed`).toBeVisible({ timeout: 20000 });
        }, { attempts: 1 }); // a retry would create a second project
      });
    } finally {
      await run.scenario({ ...meta('ROLEW-RESTORE', 'Restore the test role and the Supplier account', 'Setup'), always: true }, async s => {
        // A failed step can leave a portal dialog open (it blocks the Roles page): start from a reloaded portal page.
        if (st.adm) { await st.adm.reload({ waitUntil: 'domcontentloaded' }).catch(() => null); await settleA(); }
        await s.step('Test role back to its baseline permissions', async () => {
          if (!st.baseline) return;
          await setPermissions(TEST_ROLE, st.baseline);
          expect([...(await permissions(TEST_ROLE))].sort()).toEqual([...st.baseline].sort());
        });
        await s.step('Supplier account back on its original Project Role, verified from its own session', async () => {
          // Checked from the Supplier's own session even when this run did not change it (a stopped run may have).
          await supplierSignIn();
          let now = await sessionRole();
          if (now === 'Supplier') { s.observe('role already Supplier'); return; }
          // A failed earlier step (e.g. the New Project form) can leave a dialog open: start from a fresh portal page.
          await st.adm.reload({ waitUntil: 'domcontentloaded' }).catch(() => null); await settleA();
          await setProjectRole(st.original && st.original !== TEST_ROLE ? st.original : 'Supplier');
          await supplierSignIn();
          now = await sessionRole(); s.observe(`role now: ${now}`);
          expect(now).toBe('Supplier');
        }, { critical: true });
      });
      if (st.sup) await st.sup.context().close().catch(() => null);
    }
  } });
});
