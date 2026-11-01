// Procurement Log flow – same rules as the PM flow: one sign-in, one project and site, the page is opened once
// through the menu, each step tried twice and then the flow continues, banner on screen, report by scenario.
// Read-only: forms and panels are opened and closed; nothing is saved.
const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../../pages/login.page');
const { PlatformChooserPage } = require('../../pages/platform-chooser.page');
const { ProjectSelectorPage } = require('../../pages/project-selector.page');
const { SiteSelectorPage } = require('../../pages/site-selector.page');
const { ProcurementLogPage } = require('../../pages/procurement-log/procurement-log.page');
const { clearLeftovers } = require('../../utils/page-cleanup');
const { runPmSuite } = require('./support/pm-flow');
const { focus } = require('./support/pm-visuals');

const SUITE = 'Procurement Log Flow';
const MODULE = 'Procurement Log';
const SITE = process.env.SCP_DEMO_SITE || 'Warehoust _NR';
const NO_MATCH = `zzz-no-match-${Date.now().toString(36)}`;
const ERROR_TEXT = /required|invalid|please|must|enter a|cannot be empty/i;
let sequence = 0;
const meta = (title, kind) => ({
  id: `PL-FLOW-${String(++sequence).padStart(2, '0')}`, module: MODULE, submodule: kind, suite: SUITE,
  title: `[${kind}] ${title}`, navPath: [MODULE]
});

test.describe.configure({ mode: 'serial' });
test.setTimeout(30 * 60 * 1000);

test('Procurement Log – flow', async ({ page, browserName }) => {
  await runPmSuite({ page, browserName, suite: SUITE, scenarios: async ({ run, config }) => {
    const main = page.locator('main');
    const procurement = new ProcurementLogPage(page);
    const search = page.locator('input[placeholder^="Search submittals"]');
    // An empty result is shown as a single "no data" row, which is not a submittal.
    const rows = () => main.locator('table tbody tr').filter({ has: page.locator('td') }).filter({ hasNotText: /no (data|submittals?|records?|results?)|not found/i });
    const settle = async () => { await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null); await page.waitForTimeout(500); };
    const toolbar = name => main.getByRole('button', { name, exact: true }).first();
    const clean = async () => { await clearLeftovers(page); await settle(); };

    // ---------- Sign-in: the only login of the run ----------
    const login = await run.scenario({ ...meta(`Sign in, select ${config.projectName} and site ${SITE}`, 'Positive'), always: true }, async s => {
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
    });
    if (login.status !== 'Passed') { run.abort('Sign-in, project or site selection failed'); return; }

    // ---------- The page, opened once through the menu ----------
    const opened = await run.scenario(meta('Procurement Log opens from the menu with submittals and its toolbar', 'Positive'), async s => {
      await s.step('Open Procurement Log from the left menu', async () => {
        await focus(procurement.navigation.first());
        await procurement.open();
        await expect(page).toHaveURL(/\/procurement-log\/?$/);
      }, { critical: true });
      await s.step('Submittals are listed', async () => {
        await expect.poll(() => rows().count(), { message: 'Rows in the list', timeout: 20000 }).toBeGreaterThan(0);
        s.observe(`${await rows().count()} rows on the first page`);
      }, { critical: true });
      await s.step('Toolbar actions are available', async () => {
        for (const name of ['Add Submittal', 'Filters', 'Import', 'Export']) {
          await expect(toolbar(name), `${name} button`).toBeVisible({ timeout: 10000 });
        }
        await expect(search, 'Search box').toBeVisible();
      });
    });
    if (opened.status === 'Failed') { run.abort('Procurement Log did not open'); return; }

    // ---------- Exact search on an existing submittal ----------
    await run.scenario(meta('Exact search returns the one matching submittal; clearing restores the list', 'Positive'), async s => {
      let submittal = '';
      let before = 0;
      await s.step('Read a submittal number from the list', async () => {
        before = await rows().count();
        const cell = rows().locator('td').filter({ hasText: /^(INV-)?SUB-[\w-]+$/ }).first();
        await expect(cell, 'A submittal number in the list').toBeVisible({ timeout: 15000 });
        submittal = (await cell.innerText()).trim();
        s.observe(`Submittal ${submittal}`);
      }, { critical: true });
      await s.step('Search for that submittal', async () => {
        await focus(search);
        await procurement.searchExactSubmittal(submittal);
      }, { critical: true });
      await s.step('Clear the search and see the list again', async () => {
        await search.fill('');
        await search.press('Enter');
        await settle();
        await expect.poll(() => rows().count(), { message: 'Rows after clearing', timeout: 20000 }).toBeGreaterThanOrEqual(Math.min(before, 1));
      });
    });

    // ---------- No-match search ----------
    await run.scenario(meta('Search for a value that does not exist shows no submittals; clearing restores the list', 'Negative'), async s => {
      let before = 0;
      await s.step('Search for a value that does not exist', async () => {
        before = await rows().count();
        await focus(search);
        await search.fill(NO_MATCH);
        await search.press('Enter');
        await settle();
        await expect.poll(() => rows().count(), { message: 'No-match search shows no submittals', timeout: 15000 }).toBe(0);
      });
      await s.step('Clear the search and see the list again', async () => {
        await search.fill('');
        await search.press('Enter');
        await settle();
        await expect.poll(() => rows().count(), { message: 'Rows after clearing', timeout: 20000 }).toBeGreaterThanOrEqual(Math.min(before, 1));
      });
    });

    // ---------- Filters panel ----------
    await run.scenario(meta('Filters panel opens and closes without changing the list', 'Positive'), async s => {
      let before = 0;
      await s.step('Open Filters', async () => {
        before = await rows().count();
        await focus(toolbar('Filters'));
        await toolbar('Filters').click();
        await settle();
        await expect(page.getByText(/filter/i).filter({ visible: true }).filter({ hasNot: page.locator('nav') }).nth(1), 'Filter panel content').toBeVisible({ timeout: 10000 });
      }, { critical: true });
      await s.step('Close Filters; the list is unchanged', async () => {
        await page.keyboard.press('Escape');
        await clean();
        if (await page.locator('div.fixed.inset-0').filter({ visible: true }).count()) await toolbar('Filters').click().catch(() => null);
        await clean();
        await expect.poll(() => rows().count(), { timeout: 15000 }).toBe(before);
      });
    });

    // ---------- Only my watched ----------
    await run.scenario(meta('"Only my watched" narrows the list and unticking restores it', 'Positive'), async s => {
      const watched = main.getByText('Only my watched', { exact: true });
      let before = 0;
      await s.step('Tick "Only my watched"', async () => {
        before = await rows().count();
        await expect(watched, '"Only my watched"').toBeVisible({ timeout: 10000 });
        await focus(watched);
        await watched.click();
        await settle();
        await expect.poll(() => rows().count(), { timeout: 15000 }).toBeLessThanOrEqual(before);
        s.observe(`${await rows().count()} watched rows (of ${before})`);
      }, { critical: true });
      await s.step('Untick it and see the full list again', async () => {
        await watched.click();
        await settle();
        await expect.poll(() => rows().count(), { timeout: 15000 }).toBe(before);
      });
    });

    // ---------- Add Submittal: empty form ----------
    await run.scenario(meta('Add Submittal with empty required fields is rejected and closed without saving', 'Negative'), async s => {
      const title = page.locator('xpath=//*[normalize-space(text())="Add Submittal" and not(ancestor-or-self::button)]').filter({ visible: true }).last();
      const add = page.getByRole('button', { name: 'Add', exact: true }).filter({ visible: true }).last();
      await s.step('Open Add Submittal', async () => {
        await focus(toolbar('Add Submittal'));
        await toolbar('Add Submittal').click();
        await expect(title, 'Add Submittal form').toBeVisible({ timeout: 15000 });
      }, { critical: true });
      await s.step('Click Add with the required fields empty – a validation message, nothing saved', async () => {
        await focus(add);
        await add.click();
        await page.waitForTimeout(1000);
        await expect(title, 'The form stays open').toBeVisible();
        await expect.poll(async () => page.getByText(ERROR_TEXT).filter({ visible: true }).first().isVisible().catch(() => false),
          { message: 'A validation message is shown', timeout: 10000 }).toBe(true);
      });
      await s.step('Close the form with ×', async () => {
        await title.locator('xpath=following::button[1]').click({ timeout: 5000 }).catch(() => null);
        if (await title.isVisible().catch(() => false)) await page.keyboard.press('Escape');
        await expect(title, 'Form closed').toBeHidden({ timeout: 10000 });
      });
      await clean();
    });

    // ---------- Columns ----------
    await run.scenario(meta('Columns menu opens and closes; the table keeps its columns', 'Positive'), async s => {
      let headers = 0;
      await s.step('Open Columns', async () => {
        headers = await main.locator('table thead th').count();
        const columns = toolbar('Columns');
        await expect(columns, 'Columns button').toBeVisible({ timeout: 10000 });
        await focus(columns);
        await columns.click();
        await expect(page.locator('input[type="checkbox"]').filter({ visible: true }).filter({ hasNot: main.locator('table') }).first(), 'Column choices').toBeVisible({ timeout: 10000 });
      }, { critical: true });
      await s.step('Close Columns; the table is unchanged', async () => {
        await page.keyboard.press('Escape');
        await clean();
        await expect.poll(() => main.locator('table thead th').count(), { timeout: 10000 }).toBe(headers);
      });
    });
  } });
});
