// =====================================================================================================================
// P1 redesign regression – redesigned P1 features of the 24 Nov 2026 build that the existing suites do not check
// (Phase 3 of ROADMAP_V2_2026-12-04): Management Dashboard (KPI tiles, Urgent issues chips / filter / paging /
// day counts), Procurement Log views (List count, By submittal group totals, By material, header names),
// User Management (count and paging, inline Platform Role dropdown), Supplier List (count and paging, new
// Add Supplier fields, required fields).
// Source: docs/functional-discovery/APP_WALKTHROUGH_2026-11-24.md and the read-only probe of 26 Nov 2026.
// Read-only: no role is changed, no supplier is saved, nothing is bulk-edited; forms are cancelled.
// Run: node scripts/run-pm-flow.js p1 --headless
// =====================================================================================================================
const { test, expect } = require('@playwright/test');
const { runPmSuite } = require('./support/pm-flow');
const { plKit } = require('./support/pl-flow');

const SUITE = 'P1 Redesign Regression';
const meta = (id, module, title, type, extra = {}) => ({ id, module, submodule: 'Regression', suite: SUITE, title: `[${type}] ${title}`, navPath: [module], ...extra });
const num = t => { const m = String(t ?? '').replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : NaN; };
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const dmy = t => { const m = String(t).match(/(\d{1,2}) ([A-Za-z]{3}) (\d{4})/); return m ? new Date(+m[3], MONTHS[m[2].toLowerCase()], +m[1]) : null; };
const slash = t => { const m = String(t).match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null; };
const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };

test.describe.configure({ mode: 'serial' });
test.setTimeout(60 * 60 * 1000);

test('P1 redesign – regression', async ({ page, browserName }) => {
  await runPmSuite({ page, browserName, suite: SUITE, scenarios: async ({ run, config }) => {
    const k = plKit(page);
    const { main } = k;
    const flat = async (scope = main) => (await scope.innerText()).replace(/\s+/g, ' ');
    const open = async (route, name, group, wait = 1500) => {
      await page.keyboard.press('Escape').catch(() => null);
      await k.menu(name, group).catch(() => null);
      if (!new RegExp(`${route}(\\?|$)`).test(new URL(page.url()).pathname)) await page.goto(route, { waitUntil: 'domcontentloaded' });
      await k.settle(wait);
      if (await k.keepSite().catch(() => false)) await k.settle(1500);
    };
    const cellsOf = table => table.locator('tbody tr').evaluateAll(list => list.map(r => [...r.cells].map(c => c.innerText.replace(/\s+/g, ' ').trim())));

    const login = await run.scenario(meta('P1R-00', 'Login', `Sign in to ${config.projectName}`, 'Setup', { always: true }), s => k.signIn(s, config));
    if (login.status !== 'Passed') { run.abort('Sign-in failed'); return; }

    // =============================== Management Dashboard ===============================
    const DSH = 'Management Dashboard';
    // Chips and tiles carry no accessible name with their count (26 Nov probe): counts are read from the page text
    // ("All 69", "Open NCRs 0") and chips are clicked by their label.
    const dash = async () => { await open('/management-dashboard', DSH, null, 3000); await expect(main.getByText(/^Urgent issues \(\d+\)/).first()).toBeVisible({ timeout: 60000 }); await k.settle(1500); };
    const countOf = async name => num(((await main.innerText()).match(new RegExp(`(?:^|\\n)${name.replace(/[()]/g, '\\$&')}\\s*(\\d+)`)) || [])[1]);
    // Accessibility tree (26 Nov): the chips are tabs of the tablist "Urgent issue types" ("All 69", "Lead time later
    // than ROJ 51" …); each urgent issue is a link in a list: "<material> · <submittal> · Expected … (N days late).
    // <category tag><supplier>".
    const chip = name => main.getByRole('tablist', { name: 'Urgent issue types' }).getByRole('tab', { name: new RegExp(`^${name.replace(/[()]/g, '\\$&')}\\s*\\d+$`) });
    const chipCount = async name => num((await chip(name).innerText()).replace(name, ''));
    const CATS = ['Delivery discrepancies', 'Lead time later than ROJ', 'Order not confirmed in time', 'NCRs', 'Alerts'];
    const pager = async () => { const m = (await flat()).match(/Showing (\d+)[–-](\d+) of (\d+) ‹ (\d+) \/ (\d+) ›/); return m ? { from: +m[1], to: +m[2], of: +m[3], page: +m[4], pages: +m[5] } : null; };
    const urgentLinks = () => main.getByRole('tablist', { name: 'Urgent issue types' }).locator('xpath=following-sibling::*[1]').getByRole('link');
    const urgentRows = async () => (await urgentLinks().allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());

    await run.scenario(meta('DSH-REG-12', DSH, 'Urgent issues: the chips add up to the total', 'Positive'), async s => {
      await s.step('Urgent issues (N) = chip "All N" = sum of Delivery discrepancies + Lead time later than ROJ + Order not confirmed in time + NCRs + Alerts = "Showing … of N"', async () => {
        await dash();
        const head = num((await main.getByText(/^Urgent issues \(\d+\)/).first().innerText()).match(/\((\d+)\)/)[1]);
        const all = await chipCount('All'); const parts = {}; for (const c of CATS) parts[c] = await chipCount(c);
        const sum = Object.values(parts).reduce((a, b) => a + b, 0); const p = await pager();
        s.observe(`header ${head}, All ${all}, chips ${JSON.stringify(parts)} = ${sum}, pager of ${p?.of}`);
        expect(all).toBe(head); expect(sum).toBe(head);
        if (head > 0) expect(p?.of).toBe(head);
      }, { critical: true });
    });
    await run.scenario(meta('DSH-REG-13', DSH, 'Urgent issues: a chip filters to its category', 'Positive'), async s => {
      await s.step('Click the largest category chip ("<category> M") → "Showing … of M"; every row on the page carries that category tag; "All" → back to the total', async () => {
        await dash();
        const counts = []; for (const c of CATS) counts.push([c, await chipCount(c)]);
        const [cat, m] = counts.sort((a, b) => b[1] - a[1])[0];
        await chip(cat).click(); await k.settle(2000);
        const p = await pager(); const rows = await urgentRows();
        const untagged = rows.filter(r => !r.includes(cat));
        s.observe(`${cat} ${m}: pager ${JSON.stringify(p)}, ${rows.length} row(s), ${untagged.length} without the tag`);
        expect(p.of).toBe(m);
        expect(rows.length).toBeGreaterThan(0);
        expect(untagged, 'rows without the category tag').toEqual([]);
        await chip('All').click(); await k.settle(1500);
        expect((await pager()).of).toBe(await chipCount('All'));
      });
    });
    await run.scenario(meta('DSH-REG-14', DSH, 'Urgent issues: paging 6 per page', 'Positive'), async s => {
      await s.step('"‹ 1 / P ›": P = ceil(N ÷ 6); "›" → "Showing 7–12 of N", page 2; "‹" → back to 1–6', async () => {
        await dash(); const p = await pager();
        s.observe(JSON.stringify(p));
        expect(p.pages).toBe(Math.ceil(p.of / 6));
        if (p.pages < 2) return;
        await main.getByRole('button', { name: 'Next page' }).first().click(); await k.settle(1500);
        const p2 = await pager(); s.observe(JSON.stringify(p2));
        expect([p2.from, p2.to, p2.page]).toEqual([7, Math.min(12, p.of), 2]);
        await main.getByRole('button', { name: 'Previous page' }).first().click(); await k.settle(1500);
        expect((await pager()).from).toBe(1);
      });
    });
    await run.scenario(meta('DSH-REG-15', DSH, 'Urgent issues: "N days late" equals Expected − ROJ', 'Positive'), async s => {
      await s.step('Chip "Lead time later than ROJ": on the first two pages every "Expected <d1> on lead time, ROJ <d2> (N days late)" has N = d1 − d2 in days, N > 0', async () => {
        await dash(); await chip('Lead time later than ROJ').click(); await k.settle(1500);
        const bad = []; let checked = 0;
        for (let pg = 0; pg < 2; pg++) {
          for (const r of await urgentRows()) {
            const m = r.match(/Expected (\d{1,2} \w{3} \d{4}) on lead time, ROJ (\d{1,2} \w{3} \d{4}) \((\d+) days? late\)/);
            if (!m) continue; checked++;
            const diff = Math.round((dmy(m[1]) - dmy(m[2])) / 86400000);
            if (diff !== +m[3] || diff <= 0) bad.push(`${r.slice(0, 90)} (computed ${diff})`);
          }
          const next = main.getByRole('button', { name: 'Next page' }).first();
          if (await next.isDisabled().catch(() => true)) break;
          await next.click(); await k.settle(1500);
        }
        s.observe(`${checked} row(s) checked`);
        expect(checked).toBeGreaterThan(0);
        expect(bad).toEqual([]);
      });
    });
    await run.scenario(meta('DSH-REG-16', DSH, 'Urgent issues: "Order not confirmed in time" dates are in the past', 'Positive'), async s => {
      await s.step('Chip "Order not confirmed in time": every row "Last order date <d> passed without a confirmed order" has d before today', async () => {
        await dash();
        if (!(await chipCount('Order not confirmed in time'))) { s.observe('no row in this category'); return; }
        await chip('Order not confirmed in time').click(); await k.settle(1500);
        const rows = await urgentRows(); const bad = []; let checked = 0;
        for (const r of rows) { const m = r.match(/Last order date (\d{1,2} \w{3} \d{4}) passed/); if (!m) continue; checked++; if (!(dmy(m[1]) < today())) bad.push(r.slice(0, 100)); }
        s.observe(`${checked} row(s) checked: ${rows[0]?.slice(0, 120) || '–'}`);
        expect(checked).toBeGreaterThan(0);
        expect(bad, 'last order dates not in the past').toEqual([]);
      });
    });
    await run.scenario(meta('DSH-REG-17', DSH, 'KPI tiles show a count each', 'Positive'), async s => {
      await s.step('Tiles "Open discrepancies", "Open NCRs", "Loads awaiting receipt", "Unplanned arrivals (30 days)" each show a whole number ≥ 0; Open discrepancies ≥ the "Delivery discrepancies" urgent chip', async () => {
        await dash();
        const tiles = {};
        for (const t of ['Open discrepancies', 'Open NCRs', 'Loads awaiting receipt', 'Unplanned arrivals (30 days)']) tiles[t] = await countOf(t);
        s.observe(JSON.stringify(tiles));
        for (const [t, v] of Object.entries(tiles)) { expect(Number.isInteger(v), t).toBe(true); expect(v, t).toBeGreaterThanOrEqual(0); }
        expect(tiles['Open discrepancies']).toBeGreaterThanOrEqual(await chipCount('Delivery discrepancies'));
      });
    });

    // =============================== Procurement Log views ===============================
    const PL = 'Procurement Log';
    // Page links are <a role="button" aria-label="Page N"> (26 Nov probe) – the highest one is the last page.
    const pagerLast = async () => Math.max(...(await main.getByRole('button', { name: /^Page \d+$/ }).allInnerTexts()).map(t => num(t)).filter(Number.isFinite));
    const plTab = async name => {
      await open('/procurement-log', PL, null, 3000);
      await main.getByRole('tab', { name }).click(); await k.settle(4000);
    };
    const viewTable = () => main.locator('table').filter({ has: page.getByRole('columnheader', { name: 'Next ROJ' }) }).first();
    const heads = async () => (await viewTable().locator('th').allInnerTexts()).map(t => t.replace(/[↕↑↓▲▼]/g, '').trim());
    const COLS = ['Required', 'Ordered', 'Booked', 'Received', 'Damaged', 'Accepted'];
    // Walks the view's pages ("« ‹ › »") and returns every row's cells.
    const allViewRows = async () => {
      const out = [];
      for (let p = 0; p < 40; p++) {
        out.push(...await cellsOf(viewTable()));
        const next = main.getByRole('button', { name: /^(›|Next page)$/ }).first();
        if (!(await next.count()) || await next.isDisabled().catch(() => true)) break;
        const first = await viewTable().locator('tbody tr').first().innerText();
        await next.click();
        const moved = await expect.poll(async () => (await viewTable().locator('tbody tr').first().innerText()) !== first, { timeout: 8000 }).toBe(true).then(() => true, () => false);
        if (!moved) break;
        await k.settle(800);
      }
      return out;
    };

    await run.scenario(meta('PL-REG-TAB-01', PL, 'List: "N items" matches the pages', 'Positive'), async s => {
      await s.step('List tab → "N items"; last page number P of the pager = ceil(N ÷ rows per page)', async () => {
        await open('/procurement-log', PL, null, 3000);
        const n = num(((await flat()).match(/([\d,]+) items/) || [])[1]);
        const perPage = await k.rows().count();
        const pages = await pagerLast();
        s.observe(`${n} items, ${perPage} rows on page 1, last page ${pages}`);
        expect(pages).toBe(Math.ceil(n / perPage));
      });
    });
    await run.scenario(meta('PL-REG-TAB-02', PL, 'By submittal: each CSI division total equals its submittals', 'Integration'), async s => {
      await s.step('By submittal (grouped by CSI division) → for every division fully on page 1: "(n)" = its submittal rows, and Required, Ordered, Booked, Received, Damaged, Accepted = the sums of those rows', async () => {
        await plTab('By submittal');
        const rows = await cellsOf(viewTable());
        const groups = []; let cur = null;
        for (const r of rows) {
          const g = r[0].match(/^(.*) \((\d+)\)$/);
          if (g && r.length < 12) { cur = { name: g[1], n: +g[2], totals: r.slice(1, 7).map(num), rows: [] }; groups.push(cur); continue; }
          if (cur && r.length >= 9) cur.rows.push(r.slice(3, 9).map(num));
        }
        const complete = groups.slice(0, -1); // the last group may continue on the next page
        const bad = [];
        for (const g of complete) {
          if (g.rows.length !== g.n) bad.push(`${g.name}: (${g.n}) but ${g.rows.length} rows`);
          COLS.forEach((c, i) => { const sum = g.rows.reduce((a, r) => a + r[i], 0); if (sum !== g.totals[i]) bad.push(`${g.name} ${c}: total ${g.totals[i]} vs rows ${sum}`); });
        }
        s.observe(`${groups.length} division(s) on page 1, ${complete.length} checked: ${complete.slice(0, 4).map(g => `${g.name} (${g.n}) Required ${g.totals[0]}`).join('; ')}`);
        expect(complete.length).toBeGreaterThan(0);
        expect(bad).toEqual([]);
      });
    });
    // The two views page and filter differently (By material counts every component of the material), so the views are
    // compared on a material that has exactly one submittal.
    await run.scenario(meta('PL-REG-TAB-03', PL, 'By material and By submittal agree for a one-submittal material', 'Integration'), async s => {
      await s.step('By material: first row "1 submittal · <no>" → Required, Ordered, Booked, Received; By submittal, search <no> → the same four numbers', async () => {
        await plTab('By material');
        const row = (await cellsOf(viewTable())).find(r => /1 submittal · \S+/.test(r[0]));
        expect(row, 'a material with exactly one submittal').toBeTruthy();
        const no = row[0].match(/1 submittal · (\S+)/)[1];
        const mat = row.slice(3, 7).map(num);
        await plTab('By submittal');
        await main.locator('input[type="search"], input[placeholder*="earch" i]').first().fill(no); await k.settle(3000);
        const sub = (await allViewRows()).filter(r => r.length >= 12 && r[0].includes(no));
        s.observe(`${no}: By material ${JSON.stringify(mat)}; By submittal ${sub.map(r => JSON.stringify(r.slice(3, 7).map(num))).join(' ')} (Required, Ordered, Booked, Received)`);
        expect(sub.length, `${no} listed once in By submittal`).toBe(1);
        expect(sub[0].slice(3, 7).map(num)).toEqual(mat);
      });
    });
    await run.scenario(meta('PL-REG-TAB-04', PL, 'By material: "Late" materials have a passed ROJ', 'Positive'), async s => {
      await s.step('By material, first page: every row with Status "Late" has Next ROJ before today', async () => {
        await plTab('By material');
        const h = await heads(); const rows = await cellsOf(viewTable());
        const [st, roj] = [h.indexOf('Status'), h.indexOf('Next ROJ')];
        const late = rows.filter(r => r[st] === 'Late');
        const bad = late.filter(r => !(slash(r[roj]) < today())).map(r => `${r[0].slice(0, 40)}: Next ROJ ${r[roj]}`);
        s.observe(`${late.length} Late row(s) of ${rows.length}`);
        expect(bad, 'Late rows with a future or missing Next ROJ').toEqual([]);
      });
    });
    // Issue justification of 27 Nov 2026: the two "Issues" columns are intended (same name, different use) – they are
    // accepted; every other column name must still be unique.
    const ALLOWED_TWICE = ['Issues'];
    await run.scenario(meta('PL-REG-TAB-05', PL, 'By submittal / By material column names are unique (the two "Issues" columns are intended)', 'Negative'), async s => {
      await s.step('By submittal and By material headers → no column name appears twice, except "Issues" (two columns with different uses, confirmed 27 Nov)', async () => {
        const dup = {};
        for (const t of ['By submittal', 'By material']) { await plTab(t); const h = await heads(); dup[t] = h.filter((x, i) => x && h.indexOf(x) !== i); }
        s.observe(`repeated: ${JSON.stringify(dup)} (allowed: ${ALLOWED_TWICE.join(', ')})`);
        expect(Object.values(dup).flat().filter(x => !ALLOWED_TWICE.includes(x)), 'repeated column names').toEqual([]);
      });
    });

    // =============================== User Management ===============================
    const UM = 'User Management';
    await run.scenario(meta('UM-REG-12', UM, '"N users" matches the pages', 'Positive', { navPath: [UM, UM] }), async s => {
      await s.step('User Management → "N users"; last page P = ceil(N ÷ 10 rows per page); page P holds N − 10 × (P − 1) rows', async () => {
        await open('/user-management', UM, UM, 2500);
        await expect(main.getByText(/^\d+ users$/).first()).toBeVisible({ timeout: 30000 });
        const n = num(await main.getByText(/^\d+ users$/).first().innerText());
        const per = await main.locator('tbody tr').count(); const last = await pagerLast();
        await main.getByRole('button', { name: `Page ${last}`, exact: true }).first().click(); await k.settle(2500);
        const lastRows = await main.locator('tbody tr').count();
        s.observe(`${n} users, ${per} per page, last page ${last} with ${lastRows} row(s)`);
        expect(last).toBe(Math.ceil(n / per));
        expect(lastRows).toBe(n - per * (last - 1));
      });
    });
    await run.scenario(meta('UM-REG-13', UM, 'Platform Role dropdown in the row', 'Positive', { navPath: [UM, UM] }), async s => {
      await s.step('First row Platform Role dropdown → lists Project Admin, Supplier and Subcontractor; Escape → the row keeps its role (nothing changed)', async () => {
        await open('/user-management', UM, UM, 2500);
        const row = main.locator('tbody tr').first();
        const roleBtn = row.locator('td').nth(4).locator('[aria-haspopup="listbox"]').first();
        const before = (await row.locator('td').nth(4).innerText()).trim();
        await roleBtn.click(); await k.settle(1200);
        const opts = (await page.getByRole('option').allInnerTexts()).map(t => t.trim()).filter(Boolean);
        s.observe(`role "${before}"; options: ${[...new Set(opts)].slice(0, 12).join(', ')}`);
        await page.keyboard.press('Escape'); await k.settle(1000);
        for (const r of ['Project Admin', 'Supplier', 'Subcontractor']) expect(opts, r).toContain(r);
        expect((await row.locator('td').nth(4).innerText()).trim()).toBe(before);
      });
    });

    // =============================== Supplier List ===============================
    const SL = 'Supplier List';
    // Fresh page load each time: an Add Supplier form left open by a failed attempt hides the list and its buttons.
    const sl = async () => { await page.goto('/supplier-list', { waitUntil: 'domcontentloaded' }); await k.settle(2500); await expect(main.getByText(/^\d+ suppliers$/).first()).toBeVisible({ timeout: 30000 }); };
    await run.scenario(meta('SL-REG-16', UM, '"N suppliers" matches the pages', 'Positive', { navPath: [UM, SL] }), async s => {
      await s.step('Supplier List → "N suppliers"; last page P = ceil(N ÷ 25); page P holds N − 25 × (P − 1) rows', async () => {
        await sl();
        await expect(main.getByText(/^\d+ suppliers$/).first()).toBeVisible({ timeout: 30000 });
        const n = num(await main.getByText(/^\d+ suppliers$/).first().innerText());
        const per = await main.locator('tbody tr').count(); const last = await pagerLast();
        await main.getByRole('button', { name: `Page ${last}`, exact: true }).first().click(); await k.settle(2500);
        const lastRows = await main.locator('tbody tr').count();
        s.observe(`${n} suppliers, ${per} per page, last page ${last} with ${lastRows} row(s)`);
        expect(last).toBe(Math.ceil(n / per));
        expect(lastRows).toBe(n - per * (last - 1));
      });
    });
    await run.scenario(meta('SL-REG-17', UM, 'Add Supplier: new fields Email domains, Invite to Platform, Is Sub-Contractor', 'Positive', { navPath: [UM, SL] }), async s => {
      await s.step('"Add Supplier" → "Is Sub-Contractor" and "Invite to Platform" switches, "Email domains" with its hint ("…leave blank to use the contact email\'s domain"), Default Lead Time hint "Leave blank to derive from history"; Cancel', async () => {
        await sl();
        await main.getByRole('button', { name: /Add Supplier/ }).first().click(); await k.settle(1500);
        for (const t of [/Is Sub-?Contractor/i, /Email domains/i, /Invite to Platform/i, /contact email.s domain/i]) await expect(page.getByText(t).first(), String(t)).toBeVisible({ timeout: 10000 });
        await expect(page.getByPlaceholder(/derive from history/i), 'Default Lead Time placeholder').toBeVisible();
        await expect(page.getByPlaceholder(/acme-mech\.com/i), 'Email domains placeholder').toBeVisible();
        s.observe((await flat(page.locator('body'))).match(/Email domains.{0,160}/i)?.[0] || '');
        await page.getByRole('button', { name: 'Cancel', exact: true }).last().click(); await k.settle(1000);
      });
    });
    await run.scenario(meta('SL-REG-18', UM, 'Add Supplier: Save with empty required fields is refused', 'Negative', { navPath: [UM, SL] }), async s => {
      await s.step('"Add Supplier", click "Save" with every field empty → form stays open with required-field messages; Cancel; "N suppliers" unchanged', async () => {
        await sl();
        const n = num(await main.getByText(/^\d+ suppliers$/).first().innerText());
        await main.getByRole('button', { name: /Add Supplier/ }).first().click(); await k.settle(1500);
        await page.getByRole('button', { name: 'Save', exact: true }).last().click(); await k.settle(1500);
        const msgs = (await page.locator('body').innerText()).split('\n').filter(l => /required|enter|invalid/i.test(l)).map(l => l.trim());
        s.observe(`${msgs.length} message(s): ${[...new Set(msgs)].slice(0, 9).join(' | ')}`);
        await expect(page.getByRole('button', { name: 'Save', exact: true }).last(), 'form still open').toBeVisible();
        expect(msgs.length).toBeGreaterThan(0);
        await page.getByRole('button', { name: 'Cancel', exact: true }).last().click(); await k.settle(1500);
        await sl();
        expect(num(await main.getByText(/^\d+ suppliers$/).first().innerText())).toBe(n);
      });
    });
  } });
});
