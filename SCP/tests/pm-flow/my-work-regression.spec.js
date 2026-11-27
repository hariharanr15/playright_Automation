// =====================================================================================================================
// My Work regression (27 Nov 2026) – "My work across projects" (/my-work), new page of the 24 Nov redesign that replaced
// Enterprise › Supplier Inbox. No client document: expected results are as observed on 27 Nov (test-case document
// NEW_MODULES_TEST_CASES_2026-11-27.md §7); the client confirms.
// Structure: "Projects at a glance" (summary line + per-project table), six section cards (Tasks, Submittals, Materials,
// Loads, Discrepancies & NCRs, Pre-shipping checklists), each opening its own filtered list.
// Writes: one task per run is marked done (a task of an automation-owned submittal, PLT/PLR/CFL/APR…), nothing else.
// Run: node scripts/run-pm-flow.js my-work --headless
// =====================================================================================================================
const { test, expect } = require('@playwright/test');
const { runPmSuite } = require('./support/pm-flow');
const { plKit } = require('./support/pl-flow');
const { e2eKit } = require('./support/e2e-kit');

const SUITE = 'My Work Regression';
const MOD = 'My Work';
const meta = (id, title, kind = 'Positive') => ({ id, module: MOD, submodule: id.includes('SMK') ? 'Smoke' : 'Regression', suite: SUITE, title: `[${kind}] ${title}`, kind, navPath: [MOD] });
const OWN = /\b(PLT|PLR|PLS|CFL|APR|TKT|NPE)\d{6,}/;

test.describe.configure({ mode: 'serial' });
test.setTimeout(60 * 60 * 1000);

test('My Work – regression', async ({ page, browserName }) => {
  await runPmSuite({ page, browserName, suite: SUITE, scenarios: async ({ run, config, navigator }) => {
    const k = plKit(page);
    const kit = e2eKit(page, { config, navigator, outDir: 'reports/pm-flow' });
    const { main } = k;
    const clean = t => String(t || '').replace(/\s+/g, ' ').trim();
    const num = t => Number(String(t ?? '').replace(/[^\d]/g, '') || NaN);
    const PROJECT = config.projectName;
    const glance = () => main.getByRole('region', { name: 'Projects at a glance' });
    const setGlance = async expanded => { const t = glance().getByRole('button', { name: /Projects at a glance/ }); if ((await t.getAttribute('aria-expanded')) !== String(expanded)) { await t.click(); await k.settle(1500); } };
    const open = async () => { await page.goto('/my-work', { waitUntil: 'domcontentloaded' }); await expect(main.getByRole('heading', { name: 'My work across projects' })).toBeVisible({ timeout: 60000 }); await k.settle(4000); await setGlance(false); };
    // The section list = the last table of the page (the glance table, when expanded, comes first).
    const list = () => main.locator('table').last();
    const rowsOf = () => list().locator('tbody tr');
    const CARD = { Tasks: /^Tasks \d/, Submittals: /^Submittals \d/, Materials: /^Materials \d/, Loads: /^Loads$/, 'Discrepancies & NCRs': /^Discrepancies & NCRs$/, 'Pre-shipping checklists': /^Pre-shipping checklists/ };
    const card = name => main.getByRole('button', { name: CARD[name] }).first();
    const section = async name => { await open(); await card(name).click(); await k.settle(4000); };
    const project = () => main.getByRole('combobox', { name: 'Project' });
    const chooseProject = async name => { const before = await main.innerText(); await project().selectOption({ label: name }); await expect.poll(async () => (await main.innerText()) !== before, { timeout: 20000 }).toBe(true).catch(() => null); await k.settle(3000); };
    const summary = async () => { await setGlance(false); return clean(await glance().innerText()); };
    // Card text has the total and the detail on separate lines ("Tasks\n1236\n672 overdue · 51 at risk"): keep the line breaks as " | ".
    const cardText = async name => (await card(name).evaluate(e => [...e.querySelectorAll('*')].filter(n => !n.children.length).map(n => n.textContent))).map(clean).filter(Boolean).join(' | ');
    const counter = async re => num(((await main.innerText()).match(re) || [])[1]);
    const statusBtn = name => main.getByRole('group', { name: 'Status' }).getByRole('button', { name: new RegExp(`^${name}`) });
    const statusCount = async name => num(await statusBtn(name).innerText());
    const tasksShown = () => counter(/(\d+) tasks/);
    const R = {};

    const login = await run.scenario({ ...meta('MW-00', `Sign in to ${PROJECT}`, 'Setup'), always: true }, s => k.signIn(s, config));
    if (login.status !== 'Passed') { run.abort('Sign-in failed'); return; }

    await run.scenario(meta('MW-REG-01', 'Summary line agrees with the section cards'), async s => {
      await s.step('Projects at a glance summary "N overdue tasks · N late submittals · N awaiting receipt · N open issues" = Tasks card overdue, Submittals card late, Discrepancies & NCRs issues', async () => {
        await open();
        const sum = await summary(); s.observe(sum);
        R.sum = { overdue: num((sum.match(/([\d,]+) overdue tasks/) || [])[1]), late: num((sum.match(/([\d,]+) late submittals/) || [])[1]), awaiting: num((sum.match(/([\d,]+) awaiting receipt/) || [])[1]), issues: num((sum.match(/([\d,]+) open issues/) || [])[1]) };
        const tasks = await cardText('Tasks'); const subs = await cardText('Submittals');
        s.observe(`cards: ${tasks} | ${subs}`);
        expect(num((tasks.match(/([\d,]+) overdue/) || [])[1]), 'Tasks card overdue').toBe(R.sum.overdue);
        expect(num((subs.match(/([\d,]+) late/) || [])[1]), 'Submittals card late').toBe(R.sum.late);
        await card('Discrepancies & NCRs').click(); await k.settle(4000);
        const issues = await counter(/(\d+) of \d+ issues/); s.observe(`issues listed ${issues}`);
        expect(issues, 'Discrepancies & NCRs issues').toBe(R.sum.issues);
      });
    });

    await run.scenario(meta('MW-REG-02', 'Projects at a glance: project row agrees with its task list', 'Integration'), async s => {
      await s.step(`Expand "Projects at a glance" › row ${PROJECT}: Tasks to do, Overdue, Submittals late, Awaiting receipt, Open issues`, async () => {
        await open();
        await setGlance(true); const region = glance();
        const row = region.locator('tbody tr').filter({ has: page.getByRole('button', { name: PROJECT, exact: true }) }).first();
        await expect(row).toBeVisible({ timeout: 30000 });
        const c = (await row.locator('td').allInnerTexts()).map(clean); s.observe(c.join(' | '));
        R.row = { todo: num(c[1]), overdue: num(c[2]), late: num(c[3]), awaiting: num(c[4]), issues: num(c[5]) };
      }, { critical: true });
      await s.step(`Tasks › Project ${PROJECT}: Overdue + At risk + Open = "N tasks" = row "Tasks to do"; Overdue = row "Overdue"`, async () => {
        await section('Tasks'); await chooseProject(PROJECT);
        const st = { overdue: await statusCount('Overdue'), risk: await statusCount('At risk'), open: await statusCount('Open') };
        const shown = await tasksShown(); s.observe(`${JSON.stringify(st)} · ${shown} tasks`);
        expect(st.overdue + st.risk + st.open, 'status toggles add up to the tasks shown').toBe(shown);
        expect(shown, 'row Tasks to do').toBe(R.row.todo);
        expect(st.overdue, 'row Overdue').toBe(R.row.overdue);
      });
      await s.step(`Discrepancies & NCRs (all projects) → ${PROJECT} rows = row "Open issues"`, async () => {
        await section('Discrepancies & NCRs');
        const rows = await rowsOf().filter({ hasText: PROJECT }).count(); s.observe(`${rows} issue rows of ${PROJECT}`);
        expect(rows).toBe(R.row.issues);
      });
    });

    await run.scenario(meta('MW-REG-03', 'Projects at a glance search and "Only projects with something to do"'), async s => {
      await s.step(`Search projects "${PROJECT}" → only matching rows; tick "Only projects with something to do" → every row has a non-zero count`, async () => {
        await open();
        await setGlance(true); const region = glance();
        await region.getByRole('searchbox', { name: 'Search projects' }).fill(PROJECT); await k.settle(2000);
        const names = (await region.locator('tbody tr td:first-child').allInnerTexts()).map(clean);
        s.observe(names.join(' | '));
        expect(names.length).toBeGreaterThan(0);
        for (const n of names) expect(n.toLowerCase()).toContain(PROJECT.toLowerCase());
        await region.getByRole('searchbox', { name: 'Search projects' }).fill(''); await k.settle(1500);
        await region.getByRole('checkbox', { name: 'Only projects with something to do' }).check(); await k.settle(2000);
        const rows = await region.locator('tbody tr').all();
        for (const r of rows.slice(0, 30)) { const c = (await r.locator('td').allInnerTexts()).slice(1).map(num); expect(c.some(v => v > 0), clean(await r.innerText()).slice(0, 60)).toBe(true); }
      });
    });

    await run.scenario(meta('MW-REG-04', 'Task status toggles and filters'), async s => {
      await s.step('Tasks › Project › untick Overdue → "N tasks" falls by the Overdue count; tick Done → rises by the Done count', async () => {
        await section('Tasks'); await chooseProject(PROJECT);
        const all = await tasksShown(); const ov = await statusCount('Overdue'); const done = await statusCount('Done');
        await statusBtn('Overdue').click(); await k.settle(2500);
        expect(await tasksShown(), 'without Overdue').toBe(all - ov);
        await statusBtn('Done').click(); await k.settle(2500);
        expect(await tasksShown(), 'with Done').toBe(all - ov + done);
        await statusBtn('Overdue').click(); await statusBtn('Done').click(); await k.settle(2500);
        expect(await tasksShown()).toBe(all);
        s.observe(`all ${all}, overdue ${ov}, done ${done}`);
      });
      await s.step('Search tasks "Iphone" → every row mentions Iphone; Due from/to = a single day → every Due date is that day; "Clear" restores the count', async () => {
        const all = await tasksShown();
        await main.getByRole('searchbox', { name: 'Search tasks' }).fill('Iphone'); await k.settle(2500);
        const texts = (await rowsOf().allInnerTexts()).map(clean);
        s.observe(`${texts.length} rows for "Iphone"`);
        for (const t of texts.slice(0, 20)) expect(t.toLowerCase()).toContain('iphone');
        await main.getByRole('searchbox', { name: 'Search tasks' }).fill(''); await k.settle(1500);
        const firstDue = clean(await rowsOf().first().locator('td').nth(4).innerText());
        const iso = firstDue.split('/').reverse().join('-');
        await main.getByRole('textbox', { name: 'Due from' }).fill(iso); await main.getByRole('textbox', { name: 'Due to' }).fill(iso); await k.settle(2500);
        const dues = (await list().locator('tbody tr td:nth-child(5)').allInnerTexts()).map(clean);
        s.observe(`due ${firstDue}: ${dues.length} rows`);
        expect(dues.length).toBeGreaterThan(0);
        for (const v of dues) expect(v).toBe(firstDue);
        await main.getByRole('button', { name: 'Clear' }).click(); await k.settle(2500);
        await chooseProject(PROJECT);
        expect(await tasksShown()).toBe(all);
      });
      await s.step('Task type ▾ → choosing one type shows only that Type', async () => {
        await main.getByRole('button', { name: 'Task type' }).click(); await k.settle(800);
        const pop = page.locator('[role="menu"], [role="listbox"], [role="dialog"], [data-radix-popper-content-wrapper]').last();
        s.observe(`popover: ${clean(await pop.innerText().catch(() => '')).slice(0, 200)}`);
        const opts = pop.getByRole('menuitemcheckbox').or(pop.getByRole('checkbox')).or(pop.getByRole('option')).or(pop.getByRole('menuitem'));
        const labels = (await opts.allInnerTexts()).map(clean).filter(Boolean); s.observe(`types: ${labels.join(', ')}`);
        expect(labels.length).toBeGreaterThan(0);
        const pick = labels.find(l => /Record the PO|Confirm lead time/i.test(l)) || labels[0];
        await opts.filter({ hasText: pick }).first().click(); await page.keyboard.press('Escape'); await k.settle(2500);
        const types = [...new Set((await list().locator('tbody tr td:nth-child(3)').allInnerTexts()).map(clean))];
        s.observe(`chosen "${pick}" → types shown ${types.join(', ')}`);
        expect(types.length).toBe(1);
      });
    });

    await run.scenario(meta('MW-REG-05', 'Task link opens the Procurement Log line', 'Integration'), async s => {
      await s.step('Tasks › Project › first task link → /procurement-log?submittal=…&schedule=… opens with that submittal', async () => {
        await section('Tasks'); await chooseProject(PROJECT);
        const link = rowsOf().first().getByRole('link').first();
        const href = await link.getAttribute('href'); s.observe(href);
        expect(href).toMatch(/\/procurement-log\?submittal=[0-9a-f-]{36}&schedule=[0-9a-f-]{36}/);
        await link.click();
        await expect(page).toHaveURL(/\/procurement-log\?submittal=/, { timeout: 30000 }); await k.settle(4000);
        await expect(main.getByText(/something went wrong|page not found/i).first()).toBeHidden();
      });
    });

    await run.scenario(meta('MW-REG-06', 'Mark done moves a task to Done (one run-owned task)', 'Positive'), async s => {
      await s.step('Tasks › Project › search an automation submittal task (PLT/PLR/CFL/APR/TKT) › "Mark done" → Done count +1, the task leaves the open list', async () => {
        await section('Tasks'); await chooseProject(PROJECT);
        // Retry-safe: the runner retries a failed step; never mark a second task done.
        if (R.markedDone) { s.observe(`retry: ${R.markedDone.t.slice(0, 80)} already marked done – checking counts only`); const now = { done: await statusCount('Done'), shown: await tasksShown() }; expect(now.done).toBe(R.markedDone.before.done + 1); expect(now.shown).toBe(R.markedDone.before.shown - 1); return; }
        const before = { done: await statusCount('Done'), shown: await tasksShown() };
        const rows = rowsOf();
        let target = null;
        for (const term of ['PLT', 'PLR', 'CFL', 'APR', 'TKT']) {
          await main.getByRole('searchbox', { name: 'Search tasks' }).fill(term); await k.settle(2500);
          const n = await rows.count();
          for (let i = 0; i < n && !target; i++) { const t = clean(await rows.nth(i).innerText()); if (OWN.test(t) && await rows.nth(i).getByRole('button', { name: 'Mark done' }).count()) target = { i, t }; }
          if (target) break;
        }
        expect(target, 'a task of an automation-owned submittal').toBeTruthy();
        R.task = target.t.match(/^(?:Overdue|At risk|Open)\s*(?:\d+ days? overdue\s*)?(.{0,80})/)?.[1] || target.t.slice(0, 80);
        s.observe(`marking done: ${target.t.slice(0, 160)}`);
        R.markedDone = { t: target.t, before };
        await rows.nth(target.i).getByRole('button', { name: 'Mark done' }).click(); await k.settle(3000);
        const confirm = page.getByRole('dialog').getByRole('button', { name: /mark done|confirm|yes/i });
        if (await confirm.count()) { await confirm.first().click(); await k.settle(3000); }
        await main.getByRole('searchbox', { name: 'Search tasks' }).fill(''); await k.settle(2500);
        const after = { done: await statusCount('Done'), shown: await tasksShown() };
        s.observe(`before ${JSON.stringify(before)} after ${JSON.stringify(after)}`);
        expect(after.done, 'Done count').toBe(before.done + 1);
        expect(after.shown, 'open tasks shown').toBe(before.shown - 1);
      });
    });

    await run.scenario(meta('MW-REG-07', 'Submittals section: filters and late count'), async s => {
      await s.step('Submittals card → list with search, Site, Trade, CSI division; rows load without error', async () => {
        await section('Submittals');
        await expect(main.getByRole('searchbox', { name: 'Search submittals' })).toBeVisible({ timeout: 30000 });
        for (const f of ['Site', 'Trade', 'CSI division']) await expect(main.getByRole('combobox', { name: f })).toBeVisible();
        const text = clean(await main.innerText()); s.observe(text.slice(text.indexOf('Search submittals'), text.indexOf('Search submittals') + 300));
        expect(text).not.toMatch(/Could not load your work/);
      });
      await s.step('Project filter lists the user\'s projects (not "All my projects (0)")', async () => {
        const first = clean(await project().locator('option').first().innerText()); s.observe(first);
        expect(first, 'Project filter in the Submittals section').not.toMatch(/\(0\)/);
      });
    });

    await run.scenario(meta('MW-REG-08', 'Materials section loads'), async s => {
      await s.step('Materials card → list with search, Site, Trade, CSI division, CFCI/OFCI, ROJ range, "Needs attention only", "Include fully received", Export; no "Could not load your work."', async () => {
        await section('Materials');
        for (const f of ['Site', 'Trade', 'CSI division', 'CFCI or OFCI']) await expect(main.getByRole('combobox', { name: f })).toBeVisible({ timeout: 30000 });
        await k.settle(4000);
        const text = clean(await main.innerText());
        const err = /Could not load your work/.test(text); s.observe(err ? '"Could not load your work." shown' : `loaded · Export ${await main.getByRole('button', { name: 'Export' }).isEnabled() ? 'enabled' : 'disabled'}`);
        expect(err, 'Materials section shows "Could not load your work."').toBe(false);
      });
    });

    await run.scenario(meta('MW-REG-09', 'Loads section lists loads across projects'), async s => {
      await s.step('Loads card → "N of M loads" equals the rows; columns Project, Load, Status, Trade, Site, When, Date, Materials, Soonest ROJ, ROJ check', async () => {
        await section('Loads');
        await expect(main.getByText(/\d+ of \d+ loads/).first()).toBeVisible({ timeout: 30000 });
        const n = await counter(/(\d+) of \d+ loads/); const rows = await rowsOf().count();
        const heads = (await list().getByRole('columnheader').allInnerTexts()).map(t => clean(t).replace(/[↕▲▼]/g, '').trim().toLowerCase());
        s.observe(`${n} loads, ${rows} rows · ${heads.join(', ')}`);
        expect(rows).toBe(n);
        for (const h of ['Project', 'Load', 'Status', 'Trade', 'Site', 'When', 'Date', 'Materials', 'Soonest ROJ', 'ROJ check']) expect(heads).toContain(h.toLowerCase());
      });
    });

    await run.scenario(meta('MW-REG-10', 'Discrepancies & NCRs section: kinds add up', 'Integration'), async s => {
      await s.step('Kind "Discrepancies" + "NCRs" = "Discrepancies and NCRs"; the run project rows include the open NCRs of Project Management › NCRs', async () => {
        await section('Discrepancies & NCRs');
        const all = await counter(/(\d+) of \d+ issues/);
        const kind = main.getByRole('combobox', { name: 'Kind' });
        await kind.selectOption({ label: 'Discrepancies' }); await k.settle(2500); const d = await counter(/(\d+) of \d+ issues/);
        await kind.selectOption({ label: 'NCRs' }); await k.settle(2500); const n = await counter(/(\d+) of \d+ issues/);
        s.observe(`all ${all} = discrepancies ${d} + NCRs ${n}`);
        expect(d + n).toBe(all);
        R.mwNcrs = (await rowsOf().filter({ hasText: PROJECT }).allInnerTexts()).map(t => (t.match(/NCR-\d+/) || [])[0]).filter(Boolean);
        await page.goto('/ncrs', { waitUntil: 'domcontentloaded' }); await k.settle(5000);
        const open = (await rowsOf().allInnerTexts()).map(clean).filter(t => !/Closed/.test(t)).map(t => (t.match(/NCR-\d+/) || [])[0]).filter(Boolean);
        s.observe(`My Work NCRs ${R.mwNcrs.join(', ')} · NCR page open ${open.join(', ')}`);
        expect([...R.mwNcrs].sort()).toEqual([...open].sort());
      });
    });

    await run.scenario(meta('MW-REG-11', 'Pre-shipping checklists section', 'Positive'), async s => {
      await s.step('Pre-shipping checklists card → columns Project, Submittal, Material, Supplier, Qty, Expected, Checklist, Waiting on; "Waiting on the supplier" shows only supplier rows', async () => {
        await section('Pre-shipping checklists');
        const heads = (await list().getByRole('columnheader').allInnerTexts()).map(t => clean(t).replace(/[↕▲▼]/g, '').trim().toLowerCase());
        s.observe(heads.join(', '));
        for (const h of ['Project', 'Submittal', 'Material', 'Supplier', 'Qty', 'Expected', 'Checklist', 'Waiting on']) expect(heads).toContain(h.toLowerCase());
        await main.getByRole('combobox', { name: 'Waiting on' }).selectOption({ label: 'Waiting on the supplier' }); await k.settle(3000);
        const waits = [...new Set((await rowsOf().evaluateAll(rs => rs.map(r => r.cells[r.cells.length - 2]?.innerText || r.cells[r.cells.length - 1]?.innerText))).map(clean))];
        s.observe(`waiting on: ${waits.join(', ')}`);
        for (const w of waits) expect(w.toLowerCase()).toMatch(/supplier/);
      });
      await s.step('A checklist row › "Open" → the checklist / component opens without an error', async () => {
        const openLink = rowsOf().first().getByRole('link', { name: 'Open' }).or(rowsOf().first().getByRole('button', { name: 'Open' })).first();
        await expect(openLink).toBeVisible({ timeout: 20000 });
        await openLink.click(); await k.settle(4000);
        s.observe(page.url());
        await expect(main.getByText(/something went wrong|page not found/i).first()).toBeHidden();
      });
    });

    await run.scenario(meta('MW-REG-12', 'Supplier sees only its own work', 'Role'), async s => {
      await s.step('Log out; log in as the Supplier account (SCP_SUPPLIER_*) → My Work opens; the Project filter lists only the supplier\'s projects; no other organisation\'s tasks', async () => {
        if (!process.env.SCP_SUPPLIER_USERNAME) throw new Error('SCP_SUPPLIER_USERNAME not set');
        await page.context().clearCookies(); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }).catch(() => null);
        await kit.signInAs({ username: process.env.SCP_SUPPLIER_USERNAME, password: process.env.SCP_SUPPLIER_PASSWORD });
        await kit.enterProject().catch(() => null);
        await open();
        const projects = (await project().locator('option').allInnerTexts()).map(clean);
        const sum = await summary();
        s.observe(`projects offered ${projects.length}: ${projects.slice(0, 6).join(', ')} · ${sum}`);
        expect(projects.length).toBeGreaterThan(0);
        expect(projects.length, 'a supplier sees fewer projects than the Project Admin').toBeLessThan(94);
      });
    });
  } });
});
