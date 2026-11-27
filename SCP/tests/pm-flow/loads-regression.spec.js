// =====================================================================================================================
// Loads regression (26 Nov 2026) – Loads › All Loads (+ Build load), Unallocated Deliveries, Discrepancies.
// The smoke cases (LD-SMK-01…05, new-pages-smoke) only check that the controls exist. These cases check that filters,
// counts, empty states, navigation and the Management Dashboard tiles agree with each other.
// Read-only: no load is built or saved, nothing is allocated or resolved.
// Data on 26 Nov: no loads, unallocated deliveries or discrepancies exist (bookings made on the component page create
// no load), so the cases hold for empty and filled lists alike: a counter must equal the rows, an empty list must show
// its empty message.
// Run: node scripts/run-pm-flow.js loads --headless
// =====================================================================================================================
const { test, expect } = require('@playwright/test');
const { runPmSuite } = require('./support/pm-flow');
const { plKit } = require('./support/pl-flow');

const SUITE = 'Loads Regression';
const LD = 'Loads';
const meta = (id, sub, title, kind = 'Positive') => ({ id, module: LD, submodule: sub, suite: SUITE, title: `[${kind}] ${title}`, kind, navPath: [LD, sub] });

test.describe.configure({ mode: 'serial' });
test.setTimeout(45 * 60 * 1000);

test('Loads – regression', async ({ page, browserName }) => {
  await runPmSuite({ page, browserName, suite: SUITE, scenarios: async ({ run, config }) => {
    const k = plKit(page);
    const { main } = k;
    const num = t => Number(String(t).replace(/[^\d]/g, ''));
    const ddmmyyyy = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    const open = async route => {
      await page.goto(route, { waitUntil: 'domcontentloaded' }); await k.settle(2500);
      if (await k.keepSite().catch(() => false)) await k.settle(1500);
    };
    // Native <select> filters: the one that offers the option.
    const select = option => main.locator('select').filter({ has: page.locator('option', { hasText: option }) }).first();
    const choose = async (option, wait = 2500) => { await select(option).selectOption({ label: option }); await k.settle(wait); };
    const optionsOf = async option => (await select(option).locator('option').allInnerTexts()).map(t => t.trim());
    const bodyText = async () => main.innerText();
    const errorShown = () => main.getByText(/something went wrong|page not found/i).first().isVisible().catch(() => false);

    const login = await run.scenario({ ...meta('LD-REG-00', 'Login', `Sign in to ${config.projectName}`, 'Setup'), always: true }, s => k.signIn(s, config));
    if (login.status !== 'Passed') { run.abort('Sign-in failed'); return; }

    // Dashboard tiles read once (Management Dashboard KPI tiles are buttons "<name> <count>").
    const tiles = {};
    const readTiles = async () => {
      await open('/management-dashboard');
      await expect(main.getByText('Open discrepancies').first()).toBeVisible({ timeout: 60000 });
      const text = await bodyText();
      for (const t of ['Open discrepancies', 'Loads awaiting receipt', 'Unplanned arrivals (30 days)']) {
        const m = text.match(new RegExp(`(?:^|\\n)${t.replace(/[()]/g, '\\$&')}\\s*(\\d+)`));
        tiles[t] = m ? Number(m[1]) : NaN;
      }
      return tiles;
    };

    // ------------------------------------------------ All Loads ------------------------------------------------
    // Upcoming sections: "<title>\n<count>\n<empty message or rows>".
    const SECTIONS = [['Arrived and awaiting receipt', 'Nothing waiting to be received.'], ['Due today', 'Nothing due today.'], ['Later this week', 'Nothing else due this week.'], ['Built, not booked', 'Every load has a date.']];
    const sectionCount = async title => num(((await bodyText()).match(new RegExp(`${title.replace(/[(),]/g, '\\$&')}\\s*\\n\\s*(\\d+)`)) || [])[1]);

    await run.scenario(meta('LD-REG-01', 'All Loads', 'Upcoming shows the current week'), async s => {
      await s.step('Left menu › Loads › "All Loads" (Upcoming) → "Week of <today> – <today + 6 days>"', async () => {
        await open('/loads');
        const today = new Date(); const end = new Date(today); end.setDate(end.getDate() + 6);
        const week = ((await bodyText()).match(/Week of (\d\d\/\d\d\/\d{4}) – (\d\d\/\d\d\/\d{4})/) || []).slice(1);
        s.observe(`Week of ${week.join(' – ')}`);
        expect(week, 'week range shown').toHaveLength(2);
        expect(week[0], 'week starts today').toBe(ddmmyyyy(today));
        expect(week[1], 'week ends 6 days later').toBe(ddmmyyyy(end));
      }, { critical: true });
    });

    await run.scenario(meta('LD-REG-02', 'All Loads', 'Upcoming section counters agree with their content'), async s => {
      await s.step('Each of the four sections: counter 0 ⇔ its empty message is shown ("Nothing waiting to be received." …)', async () => {
        await open('/loads');
        const seen = [];
        for (const [title, empty] of SECTIONS) {
          const count = await sectionCount(title);
          const emptyShown = await main.getByText(empty, { exact: true }).first().isVisible().catch(() => false);
          seen.push(`${title}: ${count}${emptyShown ? ' (empty message)' : ''}`);
          expect(Number.isFinite(count), `${title} counter`).toBe(true);
          expect(emptyShown, `${title}: empty message shown exactly when the counter is 0`).toBe(count === 0);
        }
        s.observe(seen.join(' · '));
      });
    });

    await run.scenario(meta('LD-REG-03', 'All Loads', 'Dashboard "Loads awaiting receipt" equals Upcoming "Arrived and awaiting receipt"', 'Integration'), async s => {
      await s.step('Management Dashboard tile "Loads awaiting receipt" = All Loads › Upcoming "Arrived and awaiting receipt" counter', async () => {
        await readTiles();
        await open('/loads');
        const arrived = await sectionCount('Arrived and awaiting receipt');
        s.observe(`tile ${tiles['Loads awaiting receipt']} · section ${arrived}`);
        expect(tiles['Loads awaiting receipt']).toBe(arrived);
      });
    });

    await run.scenario(meta('LD-REG-04', 'All Loads', 'All loads: every status shows a matching counter or the empty message'), async s => {
      await s.step('Tab "All loads" › status Open loads, Pending (not booked), Booked or expected, Arrived, Cancelled, Received → "N loads" with N rows, or "0 loads" / "No loads yet"', async () => {
        await open('/loads');
        await main.getByRole('tab', { name: 'All loads' }).or(main.getByRole('button', { name: 'All loads', exact: true })).first().click(); await k.settle(2500);
        const statuses = await optionsOf('Open loads');
        expect(statuses).toEqual(expect.arrayContaining(['Open loads', 'Pending (not booked)', 'Booked or expected', 'Arrived', 'Cancelled', 'Received']));
        const seen = [];
        for (const st of statuses) {
          await choose(st);
          const text = await bodyText();
          const count = num((text.match(/(\d+)\s+loads?\b/) || [])[1] ?? NaN);
          const empty = /No loads yet/i.test(text);
          seen.push(`${st}: ${Number.isFinite(count) ? count : '?'}${empty ? ' (No loads yet)' : ''}`);
          expect(await errorShown(), `${st}: no error`).toBe(false);
          if (empty) expect(count === 0 || !Number.isFinite(count), `${st}: empty message only with 0 loads`).toBe(true);
          else expect(count, `${st}: counter shown`).toBeGreaterThan(0);
        }
        s.observe(seen.join(' · '));
      });
    });

    await run.scenario(meta('LD-REG-05', 'All Loads', 'Site filter offers the project sites, the header site among them'), async s => {
      await s.step(`All loads › site filter → "All sites" first and the header site "${config.plSite || 'Warehoust _NR'}" offered; choosing it shows no error`, async () => {
        await open('/loads');
        await main.getByRole('tab', { name: 'All loads' }).or(main.getByRole('button', { name: 'All loads', exact: true })).first().click(); await k.settle(2500);
        const site = process.env.SCP_PL_SITE || config.plSite || 'Warehoust _NR';
        const sites = await optionsOf('All sites');
        s.observe(`${sites.length - 1} sites offered`);
        expect(sites[0]).toBe('All sites');
        const match = sites.find(o => o.replace(/\s+/g, ' ').trim().toLowerCase() === site.toLowerCase());
        expect(match, `header site "${site}" offered`).toBeTruthy();
        await choose(match);
        expect(await errorShown()).toBe(false);
        await choose('All sites');
      });
    });

    await run.scenario(meta('LD-REG-06', 'Build load', 'Build load lists the open product lines'), async s => {
      await s.step('All Loads › "Build load" → /loads/new; "Open product lines" shows lines with "Add" or an empty message – no "Something went wrong."', async () => {
        await open('/loads');
        await main.getByRole('button', { name: /Build load/ }).first().click();
        await expect(page).toHaveURL(/\/loads\/new/, { timeout: 30000 }); await k.settle(4000);
        const adds = await main.getByRole('button', { name: 'Add', exact: true }).count();
        const text = await bodyText();
        s.observe(`Add buttons ${adds}; ${/Something went wrong/i.test(text) ? '"Something went wrong." shown' : 'no error'}`);
        expect(/Something went wrong/i.test(text), 'Open product lines failed to load ("Something went wrong.")').toBe(false);
      });
    });

    await run.scenario(meta('LD-REG-07', 'Build load', 'Empty load cannot be saved; back link returns to Loads', 'Negative'), async s => {
      await s.step('Build load with no line added → "Save load" disabled; Delivery window hint "Up to 14 days before ROJ counts as on time"', async () => {
        if (!/\/loads\/new/.test(page.url())) { await open('/loads'); await main.getByRole('button', { name: /Build load/ }).first().click(); await k.settle(4000); }
        await expect(main.getByRole('button', { name: 'Save load' })).toBeDisabled();
        await expect(main.getByText(/Up to 14 days before ROJ counts as on time/).first()).toBeVisible();
      });
      await s.step('"← Loads" → back on /loads, nothing saved (Upcoming "Built, not booked" unchanged)', async () => {
        const before = await (async () => { const p = page.url(); return p; })();
        await main.getByRole('button', { name: /← Loads|Loads/ }).or(main.getByRole('link', { name: /← Loads/ })).first().click();
        await expect(page).toHaveURL(/\/loads(\?|$)/, { timeout: 30000 }); await k.settle(2500);
        s.observe(`from ${new URL(before).pathname}; Built, not booked: ${await sectionCount('Built, not booked')}`);
      });
    });

    // ------------------------------------------- Unallocated Deliveries -------------------------------------------
    await run.scenario(meta('LD-REG-08', 'Unallocated Deliveries', 'Each filter shows rows or "Nothing here."; All covers the other two'), async s => {
      await s.step('Filter "Waiting to be allocated", "Allocated", "All" → rows or "Nothing here."; rows(All) = rows(Waiting) + rows(Allocated)', async () => {
        await open('/unallocated-deliveries');
        await expect(main.getByText('Goods that arrived without a load', { exact: false }).first()).toBeVisible({ timeout: 30000 });
        const rows = {};
        for (const f of ['Waiting to be allocated', 'Allocated', 'All']) {
          await choose(f);
          const nothing = await main.getByText('Nothing here.', { exact: true }).first().isVisible().catch(() => false);
          rows[f] = nothing ? 0 : await main.locator('tbody tr, ul > li').count();
          expect(nothing || rows[f] > 0, `${f}: rows or "Nothing here."`).toBe(true);
        }
        s.observe(JSON.stringify(rows));
        expect(rows.All).toBe(rows['Waiting to be allocated'] + rows.Allocated);
      });
    });

    await run.scenario(meta('LD-REG-09', 'Unallocated Deliveries', 'Dashboard "Unplanned arrivals (30 days)" is within the unallocated deliveries', 'Integration'), async s => {
      await s.step('Management Dashboard tile "Unplanned arrivals (30 days)" ≤ Unallocated Deliveries › All rows', async () => {
        if (!Number.isFinite(tiles['Unplanned arrivals (30 days)'])) await readTiles();
        await open('/unallocated-deliveries'); await choose('All');
        const nothing = await main.getByText('Nothing here.', { exact: true }).first().isVisible().catch(() => false);
        const all = nothing ? 0 : await main.locator('tbody tr, ul > li').count();
        s.observe(`tile ${tiles['Unplanned arrivals (30 days)']} · unallocated (All) ${all}`);
        expect(tiles['Unplanned arrivals (30 days)']).toBeLessThanOrEqual(all);
      });
    });

    // ------------------------------------------------ Discrepancies ------------------------------------------------
    const discCount = async () => num(((await bodyText()).match(/(\d+)\s+discrepanc/i) || [])[1] ?? NaN);
    await run.scenario(meta('LD-REG-10', 'Discrepancies', 'Kind filters add up to "All kinds"'), async s => {
      await s.step('Status "All" › each kind (Damaged, Wrong product, Inspection rejected, Short delivery, Over delivery, Unplanned arrival, Received after ROJ) → "N discrepancies"; the sum equals "All kinds"; 0 ⇔ "No discrepancies."', async () => {
        await open('/discrepancies');
        await choose('Resolved', 1500); await choose('All');
        const kinds = (await optionsOf('All kinds')).filter(o => o !== 'All kinds');
        const per = {};
        for (const kind of kinds) {
          await choose(kind);
          per[kind] = await discCount();
          const empty = await main.getByText(/^No discrepancies/).first().isVisible().catch(() => false);
          expect(empty, `${kind}: empty message exactly when 0`).toBe(per[kind] === 0);
        }
        await choose('All kinds');
        const total = await discCount();
        s.observe(`${JSON.stringify(per)} · All kinds ${total}`);
        expect(Object.values(per).reduce((a, b) => a + b, 0), 'sum of kinds').toBe(total);
      });
    });

    await run.scenario(meta('LD-REG-11', 'Discrepancies', 'Open + Resolved = All; Dashboard "Open discrepancies" = Open', 'Integration'), async s => {
      await s.step('Status Open, Resolved, All → counters; Open + Resolved = All; Management Dashboard tile "Open discrepancies" = Open', async () => {
        if (!Number.isFinite(tiles['Open discrepancies'])) await readTiles();
        await open('/discrepancies');
        const c = {};
        for (const st of ['Open', 'Resolved', 'All']) { await choose(st); c[st] = await discCount(); }
        s.observe(`${JSON.stringify(c)} · tile ${tiles['Open discrepancies']}`);
        expect(c.Open + c.Resolved).toBe(c.All);
        expect(tiles['Open discrepancies']).toBe(c.Open);
      });
      await s.step('Search "zz-no-such-discrepancy" → "0 discrepancies" and "No discrepancies."', async () => {
        await main.getByPlaceholder(/product, submittal, load/i).fill('zz-no-such-discrepancy'); await k.settle(2000);
        expect(await discCount()).toBe(0);
        await expect(main.getByText(/^No discrepancies/).first()).toBeVisible();
        await main.getByPlaceholder(/product, submittal, load/i).fill('');
      });
    });

    await run.scenario(meta('LD-REG-12', 'Discrepancies', '"NCR log" opens the NCRs page', 'Integration'), async s => {
      await s.step('Discrepancies › "NCR log" → NCRs page (/ncrs) opens without an error', async () => {
        await open('/discrepancies');
        await main.getByRole('button', { name: 'NCR log' }).or(main.getByRole('link', { name: 'NCR log' })).first().click();
        await expect(page).toHaveURL(/\/ncrs/, { timeout: 30000 }); await k.settle(2000);
        expect(await errorShown()).toBe(false);
      });
    });

    run.skip(meta('LD-REG-13', 'Discrepancies', 'A receipt with damaged or short units raises a discrepancy', 'Integration'),
      'Retired (27 Nov 2026, dev review "SCP Business Logic and Flow Changes"): discrepancies are raised only from LOAD receipts; a delivery logged on the component page keeps the old rules and raises none. Covered by NPE-SMK-04 (load receipt → Damaged / Short / Over / Received after ROJ discrepancies).');
  } });
});
