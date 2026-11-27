// =====================================================================================================================
// New pages smoke (25 Nov 2026 redesign) – pages added by the client release of 24 Nov 2026 that had no coverage:
// My Work, Loads (All Loads, Build load, Unallocated Deliveries, Discrepancies), Messages, NCRs, EPD Tracker,
// TOV Analytics (Financial Forecast, Submittal Invoiced Orders, Submittal Level Outflow Projection), Excel Import,
// Inventory Rebuild.
// Source of the expected texts: docs/functional-discovery/APP_WALKTHROUGH_2026-11-24.md (pages 6–11, Part B and C).
// Read-only: forms and panels are opened and closed; nothing is saved, no dry run is started, no file is imported.
// Run: node scripts/run-pm-flow.js new-pages --headless
// =====================================================================================================================
const { test, expect } = require('@playwright/test');
const { runPmSuite } = require('./support/pm-flow');
const { plKit } = require('./support/pl-flow');

const SUITE = 'New Pages Smoke';
const meta = (id, module, title, extra = {}) => ({ id, module, submodule: 'Smoke', suite: SUITE, title, navPath: [module], ...extra });

test.describe.configure({ mode: 'serial' });
test.setTimeout(45 * 60 * 1000);

test('New pages – smoke', async ({ page, browserName }) => {
  await runPmSuite({ page, browserName, suite: SUITE, scenarios: async ({ run, config }) => {
    const k = plKit(page);
    const { main } = k;
    const btn = (name, scope = main) => scope.getByRole('button', { name, exact: typeof name === 'string' }).first();
    const text = (t, scope = main) => expect(scope.getByText(t, { exact: typeof t === 'string' }).first()).toBeVisible({ timeout: 30000 });
    const heads = async () => (await main.getByRole('columnheader').allInnerTexts()).map(t => t.replace(/[↕↑↓▲▼]/g, '').replace(/\s+/g, ' ').trim().toLowerCase());
    // Option texts of every native select on the page (the new pages use plain <select> filters).
    const options = async () => (await main.locator('select option').allInnerTexts()).map(t => t.trim());
    const hasOptions = async list => {
      await expect.poll(async () => (await options()).length, { timeout: 30000, message: 'select filters loaded' }).toBeGreaterThan(0);
      const all = await options();
      for (const o of list) expect(all, `option "${o}"`).toContain(o);
    };
    const open = async (route, name, group) => {
      await page.keyboard.press('Escape').catch(() => null);
      await k.menu(name, group).catch(() => page.goto(route, { waitUntil: 'domcontentloaded' }));
      if (route && !new RegExp(`${route}(\\?|$)`).test(new URL(page.url()).pathname)) await page.goto(route, { waitUntil: 'domcontentloaded' });
      await k.settle(1500);
      if (await k.keepSite().catch(() => false)) await k.settle(1500);
    };
    const page404 = async () => expect(main.getByText(/page not found|404|something went wrong/i).first(), 'error page').toBeHidden();

    const login = await run.scenario(meta('NEW-SMK-00', 'Login', `Sign in to ${config.projectName}`, { always: true }), s => k.signIn(s, config));
    if (login.status !== 'Passed') { run.abort('Sign-in failed'); return; }

    // ---------------- My Work ----------------
    const MYW = 'My Work';
    await run.scenario(meta('MYW-SMK-01', MYW, 'My Work loads with projects and task list'), async s => {
      await s.step('Sidebar › "My Work" → /my-work opens', async () => { await open('/my-work', MYW); await expect(page).toHaveURL(/\/my-work/); await page404(); }, { critical: true });
      await s.step('My Work → "Projects at a glance" with the "Only projects with something to do" option, project columns Project / Tasks to do / Overdue', async () => {
        await text(/Projects at a glance/i);
        await text(/Only projects with something to do/i);
        for (const t of [/Tasks to do/i, /Overdue/i]) await text(t);
      });
      await s.step('My Work → task list with search "Search tasks", "Assigned to me" and columns Status, Task, Type, Due', async () => {
        await expect(main.getByPlaceholder(/Search tasks/i).first()).toBeVisible({ timeout: 30000 });
        await text(/Assigned to me/i);
        const h = await heads(); s.observe(h.join(' | '));
        for (const c of ['status', 'task', 'type', 'due']) expect(h.some(x => x.startsWith(c)), `column ${c}`).toBe(true);
      });
      await s.step('My Work › search tasks "zz-no-such-task-zz" → task counter "0 tasks"; clear → the counter returns to the original total', async () => {
        // The page also lists every project (a table of its own), so the task count is read from the "N tasks" counter.
        const box = main.getByPlaceholder(/Search tasks/i).first();
        const count = async () => { const m = [...(await main.innerText()).matchAll(/(\d[\d,]*) tasks?\b(?! to do)/gi)].pop(); return m ? Number(m[1].replace(/,/g, '')) : NaN; };
        await expect.poll(count, { timeout: 30000 }).toBeGreaterThanOrEqual(0);
        const all = await count();
        await box.fill('zz-no-such-task-zz'); await k.settle(2500);
        await expect.poll(count, { timeout: 20000 }).toBe(0);
        await box.fill(''); await k.settle(2500);
        await expect.poll(count, { timeout: 20000 }).toBe(all);
        s.observe(`${all} task(s) before and after the search`);
      }, { optional: true });
    });

    // ---------------- Loads ----------------
    const LD = 'Loads';
    await run.scenario(meta('LD-SMK-01', LD, 'All Loads – Upcoming tab', { navPath: [LD, 'All Loads'] }), async s => {
      await s.step('Sidebar › "Loads" › "All Loads" → /loads opens', async () => { await open('/loads', 'All Loads', LD); await expect(page).toHaveURL(/\/loads/); await page404(); }, { critical: true });
      await s.step('All Loads → tabs "Upcoming" / "All loads", "Build load" button, search "load, company, material, booking"', async () => {
        for (const t of [/^Upcoming/, /^All loads/]) await expect(main.getByRole('button', { name: t }).or(main.getByRole('tab', { name: t })).first()).toBeVisible({ timeout: 30000 });
        await expect(main.getByRole('button', { name: /Build load/i }).or(main.getByRole('link', { name: /Build load/i })).first()).toBeVisible();
        await expect(main.getByPlaceholder(/load, company, material/i).first()).toBeVisible();
      });
      await s.step('Upcoming → sections "Arrived and awaiting receipt", "Due today", "Later this week", "Built, not booked" and the week range', async () => {
        for (const t of [/Arrived and awaiting receipt/i, /Due today/i, /Later this week/i, /Built, not booked/i, /Week of/i]) await text(t);
      });
      await s.step('Filters → All sites, All trades and ROJ check options "Any ROJ check", "Early, late or needs aligning", "On time"', () => hasOptions(['All sites', 'All trades', 'Any ROJ check', 'Early, late or needs aligning', 'On time']));
    });
    await run.scenario(meta('LD-SMK-02', LD, 'All Loads – All loads tab status filter', { navPath: [LD, 'All Loads'] }), async s => {
      await s.step('All Loads › "All loads" tab → status filter offers Open loads, Pending (not booked), Booked or expected, Arrived, Cancelled, Received', async () => {
        await main.getByRole('button', { name: /^All loads/ }).or(main.getByRole('tab', { name: /^All loads/ })).first().click(); await k.settle(2500);
        await hasOptions(['Open loads', 'Pending (not booked)', 'Booked or expected', 'Arrived', 'Cancelled', 'Received']);
      });
      await s.step('All loads → a load count ("N loads") or the empty message "No loads yet" is shown', async () => {
        await text(/\d+ loads?|No loads yet/i);
        s.observe((await main.innerText()).match(/\d+ loads?|No loads yet[^.]*/i)?.[0] || '');
      });
    });
    await run.scenario(meta('LD-SMK-03', LD, 'Build load page', { navPath: [LD, 'All Loads', 'Build load'] }), async s => {
      await s.step('All Loads › "Build load" → page with "Open product lines" and "This load"', async () => {
        await open('/loads', 'All Loads', LD);
        await main.getByRole('button', { name: /Build load/i }).or(main.getByRole('link', { name: /Build load/i })).first().click(); await k.settle(3000);
        await text(/Open product lines/i); await text(/This load/i);
      }, { critical: true });
      await s.step('Build load → "Save load" is disabled while the load is empty; Soonest ROJ / Latest ROJ / Delivery window shown', async () => {
        await expect(main.getByRole('button', { name: /Save load/i }).first()).toBeDisabled();
        for (const t of [/Soonest ROJ/i, /Latest ROJ/i, /Delivery window/i]) await text(t);
      });
      await s.step('Build load → open product lines list "Add" buttons or an empty message (nothing is added)', async () => {
        const adds = await main.getByRole('button', { name: 'Add', exact: true }).count();
        s.observe(`${adds} open product line(s) offer "Add"`);
      });
    });
    await run.scenario(meta('LD-SMK-04', LD, 'Unallocated Deliveries', { navPath: [LD, 'Unallocated Deliveries'] }), async s => {
      await s.step('Sidebar › "Loads" › "Unallocated Deliveries" → /unallocated-deliveries opens', async () => { await open('/unallocated-deliveries', 'Unallocated Deliveries', LD); await expect(page).toHaveURL(/unallocated-deliveries/); await page404(); }, { critical: true });
      await s.step('Unallocated Deliveries → filter "Waiting to be allocated / Allocated / All"', () => hasOptions(['Waiting to be allocated', 'Allocated', 'All']));
      await s.step('Unallocated Deliveries → rows or the empty state "Nothing here."', async () => { await text(/Nothing here|Allocate|allocated/i); });
    });
    await run.scenario(meta('LD-SMK-05', LD, 'Discrepancies', { navPath: [LD, 'Discrepancies'] }), async s => {
      await s.step('Sidebar › "Loads" › "Discrepancies" → /discrepancies opens with title "Delivery discrepancies"', async () => { await open('/discrepancies', 'Discrepancies', LD); await expect(page).toHaveURL(/discrepancies/); await text(/Delivery discrepancies/i); }, { critical: true });
      await s.step('Discrepancies → status filter Open / Resolved / All; kind filter Damaged, Wrong product, Inspection rejected, Short delivery, Over delivery, Unplanned arrival, Received after ROJ', () =>
        hasOptions(['Open', 'Resolved', 'All', 'Damaged', 'Wrong product', 'Inspection rejected', 'Short delivery', 'Over delivery', 'Unplanned arrival', 'Received after ROJ']));
      await s.step('Discrepancies → counter "N discrepancies" and "NCR log" button', async () => {
        await text(/\d+ discrepanc(y|ies)|No discrepancies/i);
        await expect(main.getByRole('button', { name: /NCR log/i }).or(main.getByRole('link', { name: /NCR log/i })).first()).toBeVisible();
      });
    });

    // ---------------- Messages ----------------
    await run.scenario(meta('MSG-SMK-01', 'Messages', 'Messages page'), async s => {
      await s.step('Sidebar › "Messages" → /messages opens', async () => { await open('/messages', 'Messages'); await expect(page).toHaveURL(/\/messages/); await page404(); }, { critical: true });
      await s.step('Messages → either the "Delivery Management isn\'t connected" notice with "Check again", or the messaging page', async () => {
        const notice = await main.getByText(/isn.t connected/i).first().isVisible().catch(() => false);
        s.observe(notice ? 'Delivery Management not connected (platform admin must set up Booking Integration)' : 'Messaging page shown');
        if (notice) await expect(main.getByRole('button', { name: /Check again/i }).first()).toBeVisible();
        else await text(/suppliers|subcontractors|message/i);
      });
    });

    // ---------------- NCRs ----------------
    await run.scenario(meta('NCR-SMK-01', 'Project Management', 'NCRs list', { navPath: ['Project Management', 'NCRs'] }), async s => {
      await s.step('Sidebar › "Project Management" › "NCRs" → /ncrs opens with title "Non-conformance reports"', async () => { await open('/ncrs', 'NCRs', 'Project Management'); await expect(page).toHaveURL(/\/ncrs/); await text(/Non-conformance reports/i); }, { critical: true });
      await s.step('NCRs → status filter All statuses, Open, Awaiting approval, In progress, Awaiting re-inspection, Closed; corrective action Use as is, Repair, Rework, Reject and return', () =>
        hasOptions(['All statuses', 'Open', 'Awaiting approval', 'In progress', 'Awaiting re-inspection', 'Closed', 'Use as is', 'Repair', 'Rework', 'Reject and return']));
      await s.step('NCRs → search "Search NCR, product, submittal, supplier…", counter "N NCRs", "Export to Excel" and "Discrepancies" buttons', async () => {
        await expect(main.getByPlaceholder(/Search NCR/i).first()).toBeVisible();
        await text(/\d+ NCRs?|No NCRs/i);
        await expect(main.getByRole('button', { name: /Export to Excel/i }).first()).toBeVisible();
        await expect(main.getByRole('button', { name: /^Discrepancies/i }).or(main.getByRole('link', { name: /^Discrepancies/i })).first()).toBeVisible();
      });
    });

    // ---------------- EPD Tracker ----------------
    await run.scenario(meta('EPD-SMK-01', 'Document Management', 'EPD Tracker', { navPath: ['Document Management', 'EPD Tracker'] }), async s => {
      await s.step('Sidebar › "Document Management" › "EPD Tracker" → /epd-tracker opens', async () => { await open('/epd-tracker', 'EPD Tracker', 'Document Management'); await expect(page).toHaveURL(/epd-tracker/); await page404(); }, { critical: true });
      await s.step('EPD Tracker → status chips Required, Requested, Expiring, Expired, Received, Verified, Not required; "EPD Report" link; search "Search submittal, material, trade…"', async () => {
        for (const t of [/Required/, /Requested/, /Expiring/, /Expired/, /Received/, /Verified/, /Not required/]) await text(t);
        await expect(main.getByText(/EPD Report/).first()).toBeVisible();
        await expect(main.getByPlaceholder(/Search submittal, material/i).first()).toBeVisible();
      });
      await s.step('EPD Tracker › "Settings" → panel "Material categories that need an EPD" and "Due dates, reminders and escalation"; "Save settings" disabled while unchanged; panel closed without saving', async () => {
        await main.getByRole('button', { name: /^Settings/ }).first().click(); await k.settle(2000);
        await text(/Material categories that need an EPD/i, page); await text(/Due dates, reminders and escalation/i, page);
        await expect(page.getByRole('button', { name: /Save settings/i }).first()).toBeDisabled();
        await main.getByRole('button', { name: /^Settings/ }).first().click().catch(() => page.keyboard.press('Escape'));
      });
    });

    // ---------------- TOV Analytics ----------------
    const ANA = 'Analytics';
    await run.scenario(meta('TOV-SMK-01', ANA, 'Financial Forecast', { navPath: [ANA, 'TOV Analytics', 'Financial Forecast'] }), async s => {
      await s.step('Sidebar › "Analytics" › "TOV Analytics" › "Financial Forecast" → /financial-forecast opens', async () => { await open('/financial-forecast', 'Financial Forecast', ANA); await expect(page).toHaveURL(/financial-forecast/); }, { critical: true });
      await s.step('Financial Forecast → "Edit Payment Terms", KPI cards Total Contract Value / Forecast at Order / Forecast on Delivery / Forecast on Install / Total Forecast, "Monthly Detail" and "Forecast by Submittal"', async () => {
        await expect(main.getByRole('button', { name: /Edit Payment Terms/i }).first()).toBeVisible({ timeout: 30000 });
        for (const t of [/Total Contract Value/i, /Forecast at Order/i, /Forecast on Delivery/i, /Forecast on Install/i, /Total Forecast/i, /Monthly Detail/i, /Forecast by Submittal/i]) await text(t);
      });
      await s.step('"Edit Payment Terms" → form % at Order, % on Delivery, % on Installation, Install Lag (weeks), "Total: 100%"; Cancel (nothing saved)', async () => {
        await main.getByRole('button', { name: /Edit Payment Terms/i }).first().click(); await k.settle(1500);
        for (const t of [/at Order/i, /on Delivery/i, /on Installation/i, /Install Lag/i, /Total:\s*100%/i]) await text(t, page);
        await page.getByRole('button', { name: 'Cancel', exact: true }).last().click();
      });
    });
    for (const [id, route, name, cols] of [
      ['TOV-SMK-02', '/submittal-invoiced-orders', 'Submittal Invoiced Orders', ['Submittal No', 'Material', 'Total Component Qty']],
      ['TOV-SMK-03', '/submittal-level-outflow-projection', 'Submittal Level Outflow Projection', ['Submittal No', 'Material', 'Value Orders Received']]
    ]) {
      await run.scenario(meta(id, ANA, name, { navPath: [ANA, 'TOV Analytics', name] }), async s => {
        await s.step(`Analytics › TOV Analytics › "${name}" → ${route} opens`, async () => { await open(route, name, ANA); await expect(page).toHaveURL(new RegExp(route)); }, { critical: true });
        await s.step(`${name} → search box and columns ${cols.join(', ')}`, async () => {
          await main.getByRole('columnheader').first().waitFor({ timeout: 60000 });
          const h = await heads(); s.observe(h.slice(0, 12).join(' | '));
          for (const c of cols) expect(h.some(x => x.includes(c.toLowerCase())), `column ${c}`).toBe(true);
          await expect(main.getByPlaceholder(/Search/i).first()).toBeVisible();
        });
      });
    }

    // ---------------- Project Management › Imports / Inventory Settings ----------------
    const PM = 'Project Management';
    await run.scenario(meta('XLI-SMK-01', PM, 'Excel Import', { navPath: [PM, 'Imports', 'Excel Import'] }), async s => {
      await s.step('Sidebar › "Project Management" › "Imports" › "Excel Import" → page opens', async () => {
        await page.keyboard.press('Escape').catch(() => null);
        await k.menu('Excel Import', PM).catch(() => page.goto('/excel-import', { waitUntil: 'domcontentloaded' }));
        await k.settle(2500); s.observe(new URL(page.url()).pathname); await page404();
      }, { critical: true });
      await s.step('Excel Import → "Import your spreadsheet" and the accepted formats .xlsx / .csv (no file is chosen)', async () => {
        await text(/Import your spreadsheet/i);
        await text(/xlsx/i);
      });
    });
    await run.scenario(meta('IRB-SMK-01', PM, 'Inventory Rebuild', { navPath: [PM, 'Inventory Settings', 'Inventory Rebuild'] }), async s => {
      await s.step('Sidebar › "Project Management" › "Inventory Settings" › "Inventory Rebuild" → /inventory-rebuild opens', async () => { await open('/inventory-rebuild', 'Inventory Rebuild', PM); await expect(page).toHaveURL(/inventory-rebuild/); }, { critical: true });
      await s.step('Inventory Rebuild → "Run Dry Run" and "Rebuild" buttons, "Last nightly run" and "History" (no run is started)', async () => {
        await expect(main.getByRole('button', { name: /Run Dry Run/i }).first()).toBeVisible({ timeout: 30000 });
        await expect(main.getByRole('button', { name: /^Rebuild/i }).first()).toBeVisible();
        await text(/Last nightly run/i); await text(/History/i);
        s.observe((await main.innerText()).match(/Last nightly run[^\n]*/i)?.[0] || '');
      });
    });
  } });
});
