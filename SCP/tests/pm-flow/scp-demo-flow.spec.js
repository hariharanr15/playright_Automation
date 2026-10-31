// SCP demo flow – every module except Project Management (which has its own PM suites), in left-menu order.
// Same rules as the PM flow: one sign-in, one project and site selection, menu navigation only when the page changes,
// each step tried twice and then the flow continues, banner on screen, module-wise report.
// Positive checks: the page opens through the menu and shows its data. Negative checks: a no-match search returns
// nothing and reset restores the list, an empty or invalid form is rejected. Nothing is saved; forms are closed.
const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../../pages/login.page');
const { PlatformChooserPage } = require('../../pages/platform-chooser.page');
const { ProjectSelectorPage } = require('../../pages/project-selector.page');
const { SiteSelectorPage } = require('../../pages/site-selector.page');
const { runPmSuite } = require('./support/pm-flow');
const { focus } = require('./support/pm-visuals');

const SUITE = 'SCP Demo Flow';
const SITE = process.env.SCP_DEMO_SITE || 'Warehoust _NR';
const NO_MATCH = `zzz-no-match-${Date.now().toString(36)}`;
const ERROR_TEXT = /required|invalid|please|must|enter a|cannot be empty|valid email/i;
const EMPTY_TEXT = /no (data|records?|results?|items?|matching|.*found)|nothing to show/i;
let sequence = 0;
const meta = (module, submodule, title, kind, navPath) => ({
  id: `SCP-DEMO-${String(++sequence).padStart(3, '0')}`, module, submodule, suite: SUITE,
  title: `${kind === 'Negative' ? '[Negative] ' : '[Positive] '}${title}`, navPath
});

test.describe.configure({ mode: 'serial' });
test.setTimeout(60 * 60 * 1000);

test('SCP – Demo flow (all modules)', async ({ page, browserName }) => {
  await runPmSuite({ page, browserName, suite: SUITE, scenarios: async ({ run, navigator, config }) => {
    const main = page.locator('main');
    const nav = page.locator('nav').first();
    const menuItem = label => nav.getByRole('button', { name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s+\\d+\\+?)?$`) }).first();
    const pageEntry = label => nav.getByRole('button', { name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s+\\d+\\+?)?$`) }).last();
    const rows = () => main.locator('table tbody tr').filter({ has: page.locator('td') });
    const settle = async () => { await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null); await page.waitForTimeout(600); };
    let current = '';

    // Opens a page through the left menu (expanding its group only when the entry is hidden); no-op when already open.
    // Closes any open dialog with its own Cancel / close control, then Escape; nothing is saved.
    const closeDialogs = async () => {
      const outside = loc => loc.filter({ visible: true }).filter({ hasNot: page.locator('nav') });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const cancel = outside(page.getByRole('button', { name: /^Cancel$/i })).last();
        const cross = outside(page.locator('button[aria-label*="close" i], button:has(svg.lucide-x), button:has-text("×")')).last();
        if (await cancel.isVisible().catch(() => false)) await cancel.click().catch(() => null);
        else if (await cross.isVisible().catch(() => false)) await cross.click().catch(() => null);
        else if (await page.locator('[role="dialog"], div.fixed.inset-0').filter({ visible: true }).count()) await page.keyboard.press('Escape');
        else return;
        await page.waitForTimeout(500);
      }
    };
    const open = async (path) => {
      const key = path.join(' > ');
      await closeDialogs();
      if (current === key) return;
      for (let index = 0; index < path.length - 1; index += 1) {
        const shown = path[index + 1] === path[index]
          ? (await pageEntry(path[index]).page().locator('nav').first().getByRole('button', { name: new RegExp(`^${path[index]}$`) }).count()) > 1
          : await menuItem(path[index + 1]).isVisible().catch(() => false);
        if (shown) continue;
        await focus(menuItem(path[index]), 250);
        await menuItem(path[index]).click();
        await expect(pageEntry(path[index + 1]), `${path[index + 1]} menu entry`).toBeVisible({ timeout: 10000 });
      }
      // A page can share its group's name (User Management › User Management): the page entry is the last match.
      const item = pageEntry(path[path.length - 1]);
      await expect(item, `${path[path.length - 1]} menu entry`).toBeVisible({ timeout: 15000 });
      const before = page.url();
      await focus(item, 300);
      await item.click();
      // The menu click must really change the page, so a check can never pass on the previous page.
      const label = path[path.length - 1].toLowerCase();
      await expect.poll(async () => page.url() !== before || (await main.innerText().catch(() => '')).toLowerCase().includes(label),
        { message: `${key} opens its page`, timeout: 20000 }).toBe(true);
      await settle();
      await navigator.clearLayers();
      navigator.navigations += 1;
      current = key;
    };
    const available = async path => {
      for (let index = 0; index < path.length; index += 1) {
        if (await menuItem(path[index]).isVisible().catch(() => false)) continue;
        if (index === 0) return false;
        await menuItem(path[index - 1]).click().catch(() => null);
        if (!(await menuItem(path[index]).isVisible({ timeout: 5000 }).catch(() => false))) return false;
      }
      return true;
    };
    const loaded = async label => {
      await expect(main, `${label} page content`).toBeVisible({ timeout: 20000 });
      await expect.poll(async () => (await main.innerText().catch(() => '')).trim().length, { message: `${label} shows content`, timeout: 20000 }).toBeGreaterThan(40);
      await expect(main.getByText(/something went wrong|error fetching|failed to load/i), `${label} shows no load error`).toHaveCount(0);
    };
    const searchBox = () => main.locator('input[placeholder*="earch" i], input[type="search"]').filter({ visible: true }).first();

    // Negative: a value that cannot exist returns no rows; clearing it restores the list.
    const noMatchSearch = async (s, label) => {
      let before = 0;
      await s.step('Search for a value that does not exist', async () => {
        await expect(searchBox(), `${label} search box`).toBeVisible({ timeout: 10000 });
        before = await rows().count();
        await focus(searchBox());
        await searchBox().fill(NO_MATCH);
        await searchBox().press('Enter');
        await settle();
        await expect.poll(async () => (await rows().count()) === 0 || await main.getByText(EMPTY_TEXT).first().isVisible().catch(() => false),
          { message: 'No-match search shows no records', timeout: 15000 }).toBe(true);
        await expect(main.getByText(NO_MATCH, { exact: false }).filter({ hasNot: page.locator('input') }), 'No row contains the no-match value').toHaveCount(0);
      }, { critical: true });
      await s.step('Clear the search and see the list again', async () => {
        await searchBox().fill('');
        await searchBox().press('Enter');
        await settle();
        await expect.poll(() => rows().count(), { message: 'Records are back after clearing the search', timeout: 15000 }).toBeGreaterThanOrEqual(before);
      });
    };

    // Negative: an empty (or invalid) form is not saved; the form stays open with a validation message, then is closed.
    const rejectedForm = async (s, { openName, title, saveName = /^(Save|Submit|Add|Create|Send Invites|Log shipment|Invite)$/i }) => {
      // The open form is identified by its own save button (forms differ: some have Cancel, some only ×).
      const save = () => page.getByRole('button', { name: saveName }).filter({ visible: true }).filter({ hasNot: page.locator('nav') }).last();
      // Closed = the form's own title is gone (a page can keep another button with the save button's name).
      // The page's own button carries the same text ("Add Submittal", "Invite Users"), so buttons are excluded.
      const shown = () => title ? page.locator(`xpath=//*[normalize-space(text())="${title}" and not(ancestor-or-self::button)]`).filter({ visible: true }).last() : save();
      await s.step(`Open the ${typeof openName === 'string' ? openName : 'form'} form`, async () => {
        const inMain = main.getByRole('button', { name: openName }).filter({ visible: true }).first();
        const button = (await inMain.isVisible().catch(() => false)) ? inMain
          : page.getByRole('button', { name: openName }).filter({ visible: true }).filter({ hasNot: page.locator('nav') }).first();
        await expect(button, 'Form button').toBeVisible({ timeout: 15000 });
        await focus(button);
        await button.click();
        await expect(save(), 'The form opens with its save button').toBeVisible({ timeout: 15000 });
      }, { critical: true });
      await s.step('Try to save with the required fields empty – the form is rejected', async () => {
        await focus(save());
        // A save button styled as disabled may lack the disabled attribute; a click that cannot land is a rejection too.
        let enabled = await save().isEnabled();
        if (enabled) enabled = await save().click({ timeout: 5000 }).then(() => true, () => false);
        await page.waitForTimeout(1000);
        await expect(shown(), 'The form stays open (nothing saved)').toBeVisible();
        if (enabled) {
          await expect.poll(async () => await page.getByText(ERROR_TEXT).filter({ visible: true }).first().isVisible().catch(() => false)
            || await page.locator('[aria-invalid="true"], .text-red-500, .text-error, .border-red-500').filter({ visible: true }).first().isVisible().catch(() => false),
          { message: 'A validation message is shown', timeout: 10000 }).toBe(true);
        } else {
          s.observe('The save button is disabled while required fields are empty, so nothing can be sent');
        }
      });
      await s.step('Close the form without saving', async () => {
        // The × of a titled form is the first button after its title (Add Submittal has × but no Cancel).
        if (title && await shown().isVisible().catch(() => false)) await shown().locator('xpath=following::button[1]').click({ timeout: 5000 }).catch(() => null);
        await closeDialogs();
        if (await shown().isVisible().catch(() => false)) await page.keyboard.press('Escape');
        await expect(shown(), 'Form closed').toBeHidden({ timeout: 10000 });
      });
      // Even when a step above failed, the form never stays open to block the next page.
      await closeDialogs();
      if (await shown().isVisible().catch(() => false)) await page.keyboard.press('Escape');
    };

    // Positive: list page with records.
    const listPage = async (module, path, title, { minRows = 1 } = {}) => {
      if (!(await available(path))) { run.skip(meta(module, path.join(' › '), title, 'Positive', path), `${path.join(' › ')} is not in this account's menu`); return false; }
      const record = await run.scenario(meta(module, path.slice(-1)[0], title, 'Positive', path), async s => {
        await s.step(`Open ${path.join(' › ')} from the menu`, () => open(path), { critical: true });
        await s.step('The page loads its data', () => loaded(path.slice(-1)[0]), { critical: true });
        if (minRows) await s.step('Records are listed', async () => {
          await expect.poll(() => rows().count(), { message: 'Rows in the list', timeout: 20000 }).toBeGreaterThanOrEqual(minRows);
          s.observe(`${await rows().count()} rows on the first page`);
        });
      });
      return record?.status !== 'Failed';
    };
    const negative = (module, path, title, body) => run.scenario(meta(module, path.slice(-1)[0], title, 'Negative', path), async s => {
      await s.step(`Open ${path.join(' › ')}`, () => open(path), { critical: true });
      await body(s);
    });

    // ---------- Sign-in: the only login of the run ----------
    const login = await run.scenario({ ...meta('Session', 'Login', `Sign in, select ${config.projectName} and site ${SITE}`, 'Positive', null), always: true }, async s => {
      await s.step('Open the login page', async () => {
        await page.goto(config.loginUrl, { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('heading', { name: 'Welcome To Voyage Control' })).toBeVisible({ timeout: 30000 });
      }, { critical: true });
      await s.step('Sign in', async () => {
        await new LoginPage(page).login(config.username, config.password);
        await expect(page.getByRole('heading', { name: config.username, exact: true })).toBeVisible({ timeout: 30000 });
      }, { critical: true });
      await s.step('Open Supply Chain Planner', async () => {
        await new PlatformChooserPage(page, config).openSupplyChainPlanner();
        await expect(page).toHaveURL(/\/management-dashboard\/?$/, { timeout: 30000 });
      }, { critical: true });
      await s.step(`Select project ${config.projectName}`, () => new ProjectSelectorPage(page, config).ensureProject(config.projectName), { critical: true });
      await s.step(`Select site ${SITE}`, () => new SiteSelectorPage(page).ensureSite(SITE), { critical: true });
      current = 'Management Dashboard';
    });
    if (login.status !== 'Passed') { run.abort('Sign-in, project or site selection failed'); return; }

    // ---------- Management Dashboard ----------
    await run.scenario(meta('Management Dashboard', 'Dashboard', 'Dashboard, Alerts, Notifications and Tasks tabs open', 'Positive', ['Management Dashboard']), async s => {
      await s.step('Open Management Dashboard', () => open(['Management Dashboard']), { critical: true });
      await s.step('Dashboard tiles load', () => loaded('Management Dashboard'), { critical: true });
      for (const tab of ['Alerts', 'Notifications', 'Tasks', 'Dashboard']) {
        await s.step(`Open the ${tab} tab`, async () => {
          const control = main.getByRole('button', { name: new RegExp(`^${tab}(\\s+\\d+\\+?)?$`) }).or(main.getByRole('tab', { name: new RegExp(`^${tab}`) })).first();
          await focus(control);
          await control.click();
          await settle();
          await loaded(tab);
        });
      }
    });

    // ---------- Enterprise ----------
    for (const child of ['Enterprise View', 'Supplier Inbox', 'Supplier Performance', 'Lead Time Benchmarks', 'Enterprise Shipments']) {
      await listPage('Enterprise', ['Enterprise', child], `${child} opens with data`, { minRows: 0 });
    }

    // ---------- Procurement Log ----------
    if (await listPage('Procurement Log', ['Procurement Log'], 'Submittals are listed')) {
      await negative('Procurement Log', ['Procurement Log'], 'No-match search returns nothing; reset restores the list', s => noMatchSearch(s, 'Procurement Log'));
      await negative('Procurement Log', ['Procurement Log'], 'Add Submittal with empty fields is rejected', s => rejectedForm(s, { openName: /^(\+\s*)?Add Submittal$/i, title: 'Add Submittal' }));
    }

    // ---------- First Delivery Inspections ----------
    if (await listPage('First Delivery Inspections', ['First Delivery Inspections'], 'Inspections are listed')) {
      // The FDI list has filters, not a search box: a completed inspection is shown read-only instead.
      await run.scenario(meta('First Delivery Inspections', 'First Delivery Inspections', 'A completed inspection opens read-only and Back returns to the list', 'Positive', ['First Delivery Inspections']), async s => {
        await s.step('Open First Delivery Inspections', () => open(['First Delivery Inspections']), { critical: true });
        await s.step('Open a completed inspection with View', async () => {
          const view = rows().filter({ hasText: /Inspection Completed/i }).first().getByRole('button', { name: 'View' });
          await expect(view, 'A completed inspection with View').toBeVisible({ timeout: 15000 });
          await focus(view);
          await view.click();
          await expect(main.getByText('Inspection Detail', { exact: true }), 'Inspection Detail').toBeVisible({ timeout: 20000 });
          await expect(main.getByText(/inspection completed/i).first(), 'Completed status').toBeVisible();
          await expect(page.getByRole('button', { name: 'Submit Inspection' }), 'No Submit on a completed report').toHaveCount(0);
        }, { critical: true });
        await s.step('Back returns to the list', async () => {
          await page.getByRole('button', { name: 'Back', exact: true }).click();
          await expect.poll(() => rows().count(), { timeout: 20000 }).toBeGreaterThan(0);
        });
      });
    }

    // ---------- International Shipments ----------
    // Shipments are logged from a Procurement Log component, not from this list.
    await listPage('International Shipments', ['International Shipments'], 'Shipments are listed', { minRows: 0 });

    // ---------- User Management ----------
    if (await listPage('User Management', ['User Management', 'User Management'], 'Users are listed')) {
      await negative('User Management', ['User Management', 'User Management'], 'Invite Users with empty required fields cannot be sent', s => rejectedForm(s, { openName: /^Invite Users$/i, title: 'Invite Users' }));
    }
    if (await listPage('User Management', ['User Management', 'Supplier List'], 'Suppliers are listed')) {
      await negative('User Management', ['User Management', 'Supplier List'], 'No-match search returns nothing; reset restores the list', s => noMatchSearch(s, 'Supplier List'));
      await negative('User Management', ['User Management', 'Supplier List'], 'Add Supplier with empty fields is rejected', s => rejectedForm(s, { openName: /Add Supplier/i }));
    }

    // ---------- Inventory Management ----------
    if (await listPage('Inventory Management', ['Inventory Management'], `Stock for site ${SITE} is listed`)) {
      await negative('Inventory Management', ['Inventory Management'], 'No-match search returns nothing; reset restores the list', s => noMatchSearch(s, 'Inventory Management'));
    }

    // ---------- Document Management ----------
    for (const child of ['All Documents', 'Spec Documents', 'PO Validation', 'BOM Validation', 'EPD Report']) {
      await listPage('Document Management', ['Document Management', child], `${child} opens`, { minRows: 0 });
    }

    // ---------- Analytics ----------
    for (const child of ['Aggregate Stats', 'Lead Time Analysis', 'Supply Chain Intelligence', 'Emissions Report', 'Inventory Reports',
      'Status Report', 'SubContractor Issues', 'Supplier Issues']) {
      await listPage('Analytics', ['Analytics', child], `${child} opens with data`, { minRows: 0 });
    }
    await negative('Analytics', ['Analytics', 'SubContractor Issues'], 'No-match search returns nothing; reset restores the list', s => noMatchSearch(s, 'SubContractor Issues'));
  } });
});
