// =====================================================================================================================
// TOV Analytics + EPD Tracker regression (27 Nov 2026) – new pages of the 24 Nov redesign.
// TOV: Financial Forecast (/financial-forecast), Submittal Invoiced Orders, Submittal Level Outflow Projection.
// EPD: EPD Tracker (/epd-tracker) status chips, views and Settings.
// No client document: expected results as observed on 27 Nov (NEW_MODULES_TEST_CASES_2026-11-27.md §9–§10).
// Writes: Payment Terms are changed once and ALWAYS restored (TV-RESTORE). EPD: one category is ticked and ALWAYS unticked
// (ET-RESTORE). ET-REG-06 chases its line (an "Upload EPD" task for the trade) and uploads one EPD PDF named with the run
// tag. EPD records can't be deleted, so each run picks a category whose lines have no EPD on file yet (27 Nov).
// Run: node scripts/run-pm-flow.js tov-epd --headless
// =====================================================================================================================
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { runPmSuite } = require('./support/pm-flow');
const { plKit } = require('./support/pl-flow');

const SUITE = 'TOV and EPD Regression';
const meta = (id, module, title, kind = 'Positive') => ({ id, module, submodule: 'Regression', suite: SUITE, title: `[${kind}] ${title}`, kind, navPath: [module] });

test.describe.configure({ mode: 'serial' });
test.setTimeout(60 * 60 * 1000);

test('TOV and EPD – regression', async ({ page, browserName }) => {
  await runPmSuite({ page, browserName, suite: SUITE, scenarios: async ({ run, config }) => {
    const k = plKit(page);
    const { main } = k;
    const clean = t => String(t || '').replace(/\s+/g, ' ').trim();
    const money = t => { const v = String(t || '').replace(/INR\s*-\s*Indian Rupees/i, '').replace(/[^\d.\-]/g, ''); return v === '' || v === '-' ? 0 : Number(v); };
    const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
    const go = async (route, wait = 8000) => { await page.goto(route, { waitUntil: 'domcontentloaded' }); await k.settle(wait); };
    const table = heading => main.getByRole('heading', { name: heading }).locator('xpath=following::table[1]');
    const rows = async tbl => (await tbl.locator('tbody tr').evaluateAll(rs => rs.map(r => [...r.cells].map(c => c.innerText))));
    const kpi = async label => money(await main.getByText(label, { exact: true }).locator('xpath=preceding-sibling::*[1]').innerText());
    const kpis = async () => ({ tcv: await kpi('Total Contract Value'), order: await kpi('Forecast at Order'), delivery: await kpi('Forecast on Delivery'), install: await kpi('Forecast on Install'), total: await kpi('Total Forecast') });
    const terms = async () => { const t = clean(await main.getByText(/^Payment terms:/).first().innerText()); const m = t.match(/(\d+)% at order, (\d+)% on delivery, (\d+)% on installation \((\d+) weeks/); return m ? { order: +m[1], delivery: +m[2], install: +m[3], lag: +m[4], text: t } : { text: t }; };
    const R = {};

    const login = await run.scenario({ ...meta('TV-00', 'TOV Analytics', `Sign in to ${config.projectName}`, 'Setup'), always: true }, s => k.signIn(s, config));
    if (login.status !== 'Passed') { run.abort('Sign-in failed'); return; }

    // ================================================ Financial Forecast ================================================
    await run.scenario(meta('TV-REG-01', 'TOV Analytics', 'Financial Forecast: Total Forecast = At Order + On Delivery + On Install'), async s => {
      await s.step('Analytics › TOV Analytics › Financial Forecast → KPI cards; Total Forecast = the sum of the three forecasts; Total Forecast ≤ Total Contract Value', async () => {
        await go('/financial-forecast', 10000);
        R.k = await kpis(); R.t = await terms(); s.observe(`${JSON.stringify(R.k)} · ${R.t.text}`);
        expect(near(R.k.order + R.k.delivery + R.k.install, R.k.total, 1)).toBe(true);
        expect(R.k.total).toBeLessThanOrEqual(R.k.tcv);
      }, { critical: true });
    });

    await run.scenario(meta('TV-REG-02', 'TOV Analytics', 'Monthly Detail: month totals and running cumulative'), async s => {
      await s.step('Monthly Detail: each Month Total = At Order + On Delivery + On Install; Cumulative = running sum; last Cumulative = Total Forecast', async () => {
        const r = await rows(table('Monthly Detail'));
        let cum = 0; const bad = [];
        for (const c of r) {
          const [m, o, d, i, tot, cu] = [c[0], ...c.slice(1).map(money)];
          cum += tot;
          if (!near(o + d + i, tot)) bad.push(`${m}: ${o}+${d}+${i}≠${tot}`);
          if (!near(cum, cu, 2)) bad.push(`${m}: cumulative ${cu}≠${cum}`);
        }
        s.observe(`${r.length} months · last cumulative ${money(r[r.length - 1][5])} · total forecast ${R.k.total}${bad.length ? ' · ' + bad.join('; ') : ''}`);
        expect(bad).toEqual([]);
        expect(near(money(r[r.length - 1][5]), R.k.total, 2)).toBe(true);
      });
    });

    await run.scenario(meta('TV-REG-03', 'TOV Analytics', 'Forecast by Submittal: each line split by the payment terms; table total = Total Contract Value'), async s => {
      await s.step('Each row: At Order = Value × 30 %, On Delivery = Value × 50 %, On Install = Value × 20 %; column sums = Total Contract Value × terms; each KPI ≤ its column (KPIs count only payments that have a date)', async () => {
        const r = await rows(table('Forecast by Submittal'));
        const bad = []; const sum = { order: 0, delivery: 0, install: 0 };
        for (const c of r) {
          const [v, o, d, i] = c.slice(3, 7).map(money); sum.order += o; sum.delivery += d; sum.install += i;
          if (!near(o, v * R.t.order / 100, 1) || !near(d, v * R.t.delivery / 100, 1) || !near(i, v * R.t.install / 100, 1)) bad.push(`${c[0]} ${c[1]}: ${v} → ${o}/${d}/${i}`);
        }
        s.observe(`${r.length} rows · sums ${JSON.stringify(sum)}${bad.length ? ' · ' + bad.slice(0, 5).join('; ') : ''}`);
        expect(bad).toEqual([]);
        expect(near(sum.order + sum.delivery + sum.install, R.k.tcv, 5), 'table total = Total Contract Value').toBe(true);
        for (const [key, pct] of [['order', R.t.order], ['delivery', R.t.delivery], ['install', R.t.install]]) {
          expect(near(sum[key], R.k.tcv * pct / 100, 5), `${key} column = TCV × ${pct} %`).toBe(true);
          expect(R.k[key], `${key} KPI ≤ column`).toBeLessThanOrEqual(sum[key] + 1);
        }
      });
    });

    await run.scenario(meta('TV-REG-04', 'TOV Analytics', 'Payment Terms must total 100 %', 'Negative'), async s => {
      await s.step('Edit Payment Terms › % at Order 40 (total 110 %) → "Total: 110%" and Save refused (disabled or error); Cancel → terms unchanged', async () => {
        await go('/financial-forecast', 8000);
        await main.getByRole('button', { name: 'Edit Payment Terms' }).click(); await k.settle(1500);
        const spins = main.getByRole('heading', { name: 'Payment Terms' }).locator('xpath=..').getByRole('spinbutton');
        await spins.nth(0).fill('40'); await k.settle(800);
        const total = clean(await main.getByText(/^Total: \d+%/).first().innerText());
        const save = main.getByRole('heading', { name: 'Payment Terms' }).locator('xpath=..').getByRole('button', { name: 'Save' });
        const enabled = await save.isEnabled();
        if (enabled) { await save.click(); await k.settle(2500); }
        const after = await terms();
        s.observe(`${total}; Save ${enabled ? 'enabled (clicked)' : 'disabled'}; terms now "${after.text}"`);
        expect(total).toMatch(/^Total: 110%.*must equal 100%/);
        expect(after.order, 'terms not saved with 110 %').toBe(R.t.order);
        if (await main.getByRole('button', { name: 'Cancel' }).isVisible().catch(() => false)) { await main.getByRole('button', { name: 'Cancel' }).click(); await k.settle(1000); }
      });
    });

    const edit = await run.scenario(meta('TV-REG-05', 'TOV Analytics', 'Payment Terms change recalculates the forecast', 'Integration'), async s => {
      await s.step('Edit Payment Terms › 40 / 40 / 20, lag unchanged › Save → terms text updated; Forecast at Order × 40/30, on Delivery × 40/50, on Install unchanged', async () => {
        await go('/financial-forecast', 8000);
        R.saved = true;
        await main.getByRole('button', { name: 'Edit Payment Terms' }).click(); await k.settle(1500);
        const box = main.getByRole('heading', { name: 'Payment Terms' }).locator('xpath=..');
        await box.getByRole('spinbutton').nth(0).fill('40'); await box.getByRole('spinbutton').nth(1).fill('40'); await box.getByRole('spinbutton').nth(2).fill('20');
        await expect(main.getByText('Total: 100%').first()).toBeVisible();
        await box.getByRole('button', { name: 'Save' }).click(); await k.settle(5000);
        await go('/financial-forecast', 8000);
        const t = await terms(); const kp = await kpis(); s.observe(`${t.text} · ${JSON.stringify(kp)}`);
        expect([t.order, t.delivery, t.install]).toEqual([40, 40, 20]);
        expect(near(kp.order, R.k.order * 40 / R.t.order, 2), 'Forecast at Order scales with % at Order').toBe(true);
        expect(near(kp.delivery, R.k.delivery * 40 / R.t.delivery, 2), 'Forecast on Delivery scales with % on Delivery').toBe(true);
        expect(near(kp.install, R.k.install, 2), 'Forecast on Install unchanged').toBe(true);
        expect(near(kp.total, kp.order + kp.delivery + kp.install, 1)).toBe(true);
      });
    });

    await run.scenario({ ...meta('TV-RESTORE', 'TOV Analytics', 'Restore the Payment Terms', 'Setup'), always: true }, async s => {
      await s.step(`Edit Payment Terms › back to ${R.t?.order}/${R.t?.delivery}/${R.t?.install}, lag ${R.t?.lag} › Save → terms text and KPIs equal the start of the run`, async () => {
        if (!R.saved || !R.t?.order) { s.observe('nothing changed'); return; }
        await go('/financial-forecast', 8000);
        await main.getByRole('button', { name: 'Edit Payment Terms' }).click(); await k.settle(1500);
        const box = main.getByRole('heading', { name: 'Payment Terms' }).locator('xpath=..');
        const sp = box.getByRole('spinbutton');
        await sp.nth(0).fill(String(R.t.order)); await sp.nth(1).fill(String(R.t.delivery)); await sp.nth(2).fill(String(R.t.install)); await sp.nth(3).fill(String(R.t.lag));
        await box.getByRole('button', { name: 'Save' }).click(); await k.settle(5000);
        await go('/financial-forecast', 8000);
        const t = await terms(); const kp = await kpis(); s.observe(`${t.text} · ${JSON.stringify(kp)}`);
        expect(t.text).toBe(R.t.text);
        expect(near(kp.order, R.k.order, 2)).toBe(true);
      });
    });

    // ====================================== Invoiced Orders / Outflow Projection ======================================
    const readInvoiced = async () => {
      await go('/submittal-invoiced-orders', 10000);
      const t = main.locator('table').first();
      return (await rows(t)).filter(c => c.length >= 10).map(c => ({ sub: clean(c[0]), mat: clean(c[1]), total: money(c[2]), qPlaced: money(c[3]), vPlaced: money(c[4]), qRec: money(c[5]), vRec: money(c[6]), qPend: money(c[7]), vPend: money(c[8]), notOrdered: money(c[9]) }));
    };
    await run.scenario(meta('TV-REG-06', 'TOV Analytics', 'Submittal Invoiced Orders: pending = placed − received'), async s => {
      await s.step('Each row: Qty Pending = Qty Placed − Qty Received and Value Pending = Value Placed − Value Received; Qty Placed ≤ Total Component Qty', async () => {
        R.inv = await readInvoiced();
        const bad = R.inv.filter(r => !near(r.qPend, r.qPlaced - r.qRec, 0.01) || !near(r.vPend, r.vPlaced - r.vRec, 1) ).map(r => `${r.sub}: placed ${r.qPlaced}/${r.vPlaced} rec ${r.qRec}/${r.vRec} pend ${r.qPend}/${r.vPend} total ${r.total}`);
        const over = R.inv.filter(r => r.qPlaced > r.total + 0.01).map(r => `${r.sub} placed ${r.qPlaced} > component ${r.total}`);
        s.observe(`${R.inv.length} rows${bad.length ? ' · ' + bad.slice(0, 5).join('; ') : ''}${over.length ? ` · question: ${over.length} rows ordered more than the component quantity, e.g. ${over.slice(0, 3).join('; ')}` : ''}`);
        expect(R.inv.length).toBeGreaterThan(0);
        expect(bad).toEqual([]);
      });
    });

    await run.scenario(meta('TV-REG-07', 'TOV Analytics', 'Outflow Projection agrees with Invoiced Orders', 'Integration'), async s => {
      await s.step('Submittal Level Outflow Projection (same date range): for every submittal + material in both pages, Value Orders Received and Value Not Yet Received = Invoiced Orders received / pending', async () => {
        await go('/submittal-level-outflow-projection', 10000);
        const out = (await rows(main.locator('table').first())).filter(c => c.length >= 9).map(c => ({ key: `${clean(c[0])}|${clean(c[1])}`, vRec: money(c[2]), vNot: money(c[3]) }));
        const inv = new Map(R.inv.map(r => [`${r.sub}|${r.mat}`, r]));
        const bad = []; let both = 0;
        for (const o of out) { const i = inv.get(o.key); if (!i) continue; both++; if (!near(o.vRec, i.vRec, 1) || !near(o.vNot, i.vPend, 1)) bad.push(`${o.key}: outflow ${o.vRec}/${o.vNot} vs invoiced ${i.vRec}/${i.vPend}`); }
        s.observe(`${out.length} outflow rows, ${both} in both${bad.length ? ' · ' + bad.slice(0, 5).join('; ') : ''}`);
        expect(both).toBeGreaterThan(0);
        expect(bad).toEqual([]);
      });
    });

    await run.scenario(meta('TV-REG-08', 'TOV Analytics', 'Invoiced Orders and Outflow: search and date range filter the rows'), async s => {
      for (const route of ['/submittal-invoiced-orders', '/submittal-level-outflow-projection']) {
        await s.step(`${route}: Search "PLR" → every row's submittal contains PLR; Start date = End date = 01/01/2020 → no rows`, async () => {
          await go(route, 10000);
          const t = main.locator('table').first();
          const box = main.getByRole('textbox', { name: 'Search…' }); await box.click(); await box.pressSequentially('PLR', { delay: 80 }); await page.keyboard.press('Enter'); await k.settle(4000);
          const subs = (await rows(t)).filter(c => c.length >= 9).map(c => clean(c[0]));
          s.observe(`${subs.length} rows for PLR`);
          expect(subs.length).toBeGreaterThan(0);
          for (const x of subs) expect(x.toUpperCase()).toContain('PLR');
          await main.getByRole('textbox', { name: 'Search…' }).fill(''); await k.settle(1500);
          for (const name of ['Start date', 'End date']) { const f = main.getByRole('textbox', { name }); await f.fill('01/01/2020', { force: true }); await page.keyboard.press('Enter'); await k.settle(1500); }
          await page.keyboard.press('Escape'); await k.settle(3000);
          const left = (await rows(t)).filter(c => c.length >= 9).length;
          s.observe(`rows for 01/01/2020: ${left}`);
          expect(left).toBe(0);
        });
      }
    });

    // ===================================================== EPD Tracker =====================================================
    const chip = name => main.getByRole('button', { name: new RegExp(`^${name.replace(/[()]/g, '\\$&')} \\d+$`) });
    const chipCount = async name => Number((await chip(name).innerText()).match(/(\d+)\s*$/)[1]);
    const CHIPS = ['Required (missing)', 'Requested', 'Expiring', 'Expired', 'Received', 'Verified', 'Not required'];
    const TAG = (() => { const d = new Date(), z = n => String(n).padStart(2, '0'); return `${String(d.getFullYear()).slice(2)}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`; })();
    const mask = t => String(t || '').replace(/[\w.+-]+@neuralrays\.ai/gi, '<user>');
    const viewSel = () => main.locator('select').filter({ has: page.locator('option', { hasText: 'Needs action' }) }).first();
    const catSel = () => main.locator('select').filter({ has: page.locator('option', { hasText: 'All categories' }) }).first();
    // Rows of the tracker table: [select, line, category, trade, EPD status, due, EPD on file, last chased, actions]
    const epdRows = async () => main.locator('tbody tr').evaluateAll(rs => rs.map(r => [...r.cells].map(c => c.innerText.replace(/\s+/g, ' ').trim())).filter(c => c.length >= 8));
    const openSettings = async () => { const b = main.getByRole('button', { name: /^Settings/ }).first(); if (/▸/.test(await b.innerText())) { await b.click(); await k.settle(2500); } };

    await run.scenario(meta('ET-REG-02', 'EPD Tracker', 'Settings: category line counts cover the project lines', 'Integration'), async s => {
      await s.step('EPD Tracker › Settings ▸ → "Material categories that need an EPD" with a line count per category; the counts add up to all lines (sum of the status chips)', async () => {
        await go('/epd-tracker', 8000);
        let all = 0; for (const c of CHIPS) all += await chipCount(c);
        await openSettings();
        const text = await main.innerText();
        const seg = text.slice(text.indexOf('Material categories that need an EPD'));
        const counts = [...seg.matchAll(/\n(\d+) lines?\n/g)].map(m => Number(m[1]));
        const sum = counts.reduce((a, b) => a + b, 0);
        R.catWithLines = counts.filter(n => n > 0).length;
        s.observe(`${counts.length} categories, ${R.catWithLines} with lines, sum ${sum}; all lines (chips) ${all}`);
        expect(counts.length).toBeGreaterThan(0);
        expect(sum, 'Every category shows "0 lines" although the project has EPD lines').toBe(all);
      });
    });

    await run.scenario(meta('ET-REG-03', 'EPD Tracker', 'Settings: due-date rules shown; Save only after a change (not saved)', 'Negative'), async s => {
      await s.step('Settings › "Due dates, reminders and escalation" shows the defaults; "Save settings" disabled; change "Remind the trade before the due date" → Save enabled; change back → disabled again (nothing saved)', async () => {
        await go('/epd-tracker', 8000); await openSettings();
        const text = clean(await main.innerText());
        const seg = text.slice(text.indexOf('Due dates, reminders and escalation'), text.indexOf('Due dates, reminders and escalation') + 700);
        s.observe(seg);
        for (const label of [/Due before (the )?date required on site/i, /Remind the trade before the due date/i, /Escalate after the due date/i, /Show as expiring within/i]) expect(seg).toMatch(label);
        const save = main.getByRole('button', { name: 'Save settings' });
        await expect(save).toBeDisabled();
        const remind = main.getByText(/Remind the trade before the due date/i).first().locator('xpath=following::input[1]');
        const was = await remind.inputValue();
        await remind.fill(String(Number(was) + 1)); await k.settle(800);
        await expect(save).toBeEnabled();
        await remind.fill(was); await k.settle(800);
        s.observe(`remind ${was} → ${Number(was) + 1} → ${was}; Save ${await save.isEnabled() ? 'enabled' : 'disabled'}`);
        await expect(save).toBeDisabled();
      });
    });

    await run.scenario(meta('ET-REG-04', 'EPD Tracker', 'Views and chips agree'), async s => {
      await s.step('View select "All lines" → shows all lines; each status view → the lines of that status; the counts match the chips', async () => {
        await go('/epd-tracker', 8000);
        const view = main.locator('select').filter({ has: page.locator('option', { hasText: 'Needs action' }) }).first();
        const opts = (await view.locator('option').allInnerTexts()).map(clean);
        s.observe(`views: ${opts.join(', ')}`);
        const seen = [];
        for (const name of CHIPS.filter(c => opts.includes(c))) {
          await view.selectOption({ label: name }); await k.settle(2500);
          const n = await chipCount(name);
          const text = clean(await main.innerText());
          const shown = Number((text.match(/(\d+)\s+lines?\b/) || text.match(/of (\d+)/) || [])[1] ?? (n === 0 ? 0 : NaN));
          seen.push(`${name}: chip ${n}, view ${shown}`);
          if (n === 0) expect(/No line|Nothing|No lines/i.test(text) || shown === 0, `${name}: empty view`).toBe(true);
          else expect(shown, name).toBe(n);
        }
        s.observe(seen.join(' · '));
      });
    });

    await run.scenario(meta('ET-REG-05', 'EPD Tracker', 'Tick a category → its lines become EPD required; untick restores', 'Integration'), async s => {
      const panelCats = async () => { const text = await main.innerText(); const seg = text.slice(text.indexOf('Tick all shown')); return [...seg.matchAll(/\n([^\n]+)\n(?:Div \d+\n)?(\d+) lines?\n/g)].map(m => ({ name: m[1].trim(), lines: Number(m[2]) })); };
      const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // The category rows are styled checkboxes named "<category> [Div NN] N lines": filter with "Find a category", click the label.
      const catBox = name => main.getByRole('checkbox', { name: new RegExp('^' + esc(name) + '( Div \\d+)? \\d+ lines?$') }).first();
      const toggleCat = async (name, want) => {
        await main.getByRole('searchbox', { name: 'Find a category' }).fill(name); await k.settle(1200);
        const box = catBox(name);
        if ((await box.isChecked()) !== want) { await box.click({ force: true }); await k.settle(800); }
        if ((await box.isChecked()) !== want) { await box.dispatchEvent('click'); await k.settle(800); }
        await expect(box).toBeChecked({ checked: want });
      };
      await s.step('Settings › tick the category with the fewest lines (> 0) › Save settings → "Required (missing)" rises and "Not required" falls by its line count', async () => {
        await go('/epd-tracker', 8000);
        // Retry-safe: keep the counts from the first attempt.
        R.before = R.before || { req: await chipCount('Required (missing)'), not: await chipCount('Not required') };
        await openSettings();
        // Read the categories from the checkboxes themselves (accessible name "<category> [Div NN] N lines").
        const names = await main.getByRole('checkbox').evaluateAll(bs => bs.map(b => (b.closest('label') || b.parentElement).innerText.replace(/\s+/g, ' ').trim()));
        const cats = names.map(n => { const m = n.match(/^(.*?)(?: Div \d+)? (\d+) lines?$/); return m ? { name: m[1], label: n, lines: Number(m[2]) } : null; })
          .filter(c => c && c.lines > 0).sort((a, b) => a.lines - b.lines);
        s.observe(`${cats.length} categories with lines; smallest: ${cats.slice(0, 3).map(c => c.label).join(' | ')}`);
        expect(cats.length, 'a category with lines').toBeGreaterThan(0);
        // EPD records can't be deleted: a category whose line already got an EPD in an earlier run goes to Received/Verified
        // when ticked, not to Required (missing). Tick the candidates in order and keep the first whose lines all become
        // Required (missing); untick the others again.
        if (!R.cat) {
          for (const c of cats.slice(0, 12)) {
            await toggleCat(c.name, true); R.epdSaved = true; R.cat = c;
            const sv = main.getByRole('button', { name: 'Save settings' }); if (await sv.isEnabled().catch(() => false)) await sv.click(); await k.settle(4000);
            await go('/epd-tracker', 6000);
            const d = await chipCount('Required (missing)') - R.before.req;
            await openSettings();
            if (d === c.lines) break;
            s.observe(`skip ${c.name}: Required (missing) +${d} of ${c.lines} (EPD already on file)`);
            await toggleCat(c.name, false); R.cat = undefined; R.epdSaved = false;
            { const sv2 = main.getByRole('button', { name: 'Save settings' }); if (await sv2.isEnabled().catch(() => false)) await sv2.click(); await k.settle(4000); }
            await go('/epd-tracker', 6000); await openSettings();
          }
          expect(R.cat, 'a category with lines and no EPD on file').toBeTruthy();
        }
        s.observe(`category: ${R.cat.label}`); R.epdSaved = true;
        await toggleCat(R.cat.name, true);
        { const save = main.getByRole('button', { name: 'Save settings' }); if (await save.isEnabled().catch(() => false)) await save.click(); await k.settle(5000); }
        await go('/epd-tracker', 8000);
        const after = { req: await chipCount('Required (missing)'), not: await chipCount('Not required') };
        s.observe(`${R.cat.name} (${R.cat.lines} lines): before ${JSON.stringify(R.before)} after ${JSON.stringify(after)}`);
        expect(after.req - R.before.req).toBe(R.cat.lines);
        expect(R.before.not - after.not).toBe(R.cat.lines);
      });
      await s.step('View "Required (missing)" lists the lines of that category with a due date', async () => {
        const view = main.locator('select').filter({ has: page.locator('option', { hasText: 'Needs action' }) }).first();
        await view.selectOption({ label: 'Required (missing)' }); await k.settle(3000);
        const t = clean(await main.innerText()); s.observe(t.slice(t.indexOf('Search submittal'), t.indexOf('Search submittal') + 400));
        expect(t).not.toMatch(/No line needs an EPD yet/);
      });
    });
    await run.scenario(meta('ET-REG-06', 'EPD Tracker', 'EPD lifecycle on a line: Chase → Requested → upload → Received → Verify → Verified → Unverify', 'Integration'), async s => {
      // The run's line: found once in "Required (missing)" by its category, then by its submittal number in "All lines".
      const lineRow = async () => {
        await go('/epd-tracker', 6000);
        if (!R.epdLine) {
          await viewSel().selectOption({ label: 'Required (missing)' }); await k.settle(3000);
          const hit = (await epdRows()).find(r => r[2].startsWith(R.cat.name));
          expect(hit, `a Required (missing) line of ${R.cat.name}`).toBeTruthy();
          R.epdLine = hit[1].split(' ')[0];
        }
        await viewSel().selectOption({ label: 'All lines' }); await k.settle(2000);
        await main.getByRole('searchbox').first().fill(R.epdLine); await k.settle(3000);
        const row = main.locator('tbody tr').filter({ hasText: R.cat.name }).first();
        await expect(row).toBeVisible({ timeout: 15000 });
        return row;
      };
      const lineCells = async () => (await epdRows()).find(r => r[2].startsWith(R.cat.name)) || [];
      const status = async () => (await lineCells())[4] || '';
      const counts = async () => { const o = {}; for (const c of CHIPS) o[c] = await chipCount(c); return o; };
      await s.step('Line of the ticked category (Required (missing)) › Chase → status "Requested", "Last chased" shows today; chips: Required (missing) −1, Requested +1', async () => {
        if (!R.cat || !R.epdSaved) throw new Error('ET-REG-05 did not tick a category');
        const row = await lineRow();
        if (!R.chased) {
          R.c0 = await counts(); expect(await status()).toBe('Required (missing)');
          await expect(row.getByRole('button', { name: 'Chase' })).toHaveAttribute('title', /Upload EPD task/);
          await row.getByRole('button', { name: 'Chase' }).click(); await k.settle(3000); R.chased = true;
        }
        await lineRow();
        const r = await lineCells(), c1 = await counts();
        s.observe(mask(`${R.epdLine}: ${r.slice(4, 8).join(' | ')}; chips ${JSON.stringify(R.c0)} → ${JSON.stringify(c1)}`));
        expect(r[4]).toBe('Requested');
        const today = new Date().toLocaleDateString('en-GB');
        expect(r[7]).toContain(today);
        expect(c1['Required (missing)']).toBe(R.c0['Required (missing)'] - 1);
        expect(c1.Requested).toBe(R.c0.Requested + 1);
      });
      await s.step('Line › EPDs → EPD Report of the submittal › upload a PDF (named with the run tag) → it is listed under EPD Records; the line becomes "Received" with the file under "EPD on file"', async () => {
        const row = await lineRow();
        await row.getByRole('button', { name: 'EPDs' }).click(); await k.settle(4000);
        await expect(page).toHaveURL(/\/epd-report\?submittal_id=/);
        await expect(page.getByText('Drop an EPD PDF here').first()).toBeVisible();
        R.epdFile = R.epdFile || `EPD ${TAG}.pdf`;
        if (!R.uploaded) {
          const pdf = require('path').join(require('os').tmpdir(), R.epdFile);
          fs.writeFileSync(pdf, '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
          await page.locator('input[type=file]').first().setInputFiles(pdf); await k.settle(6000); R.uploaded = true;
        }
        const rec = page.locator('tr').filter({ hasText: R.epdFile });
        await expect(rec.first()).toBeVisible({ timeout: 20000 });
        s.observe(`EPD record: ${clean(await rec.first().innerText())} (a blank test PDF: parse status "Failed" is expected)`);
        await lineRow();
        const r = await lineCells();
        s.observe(mask(r.slice(4, 8).join(' | ')));
        expect(r[4]).toBe('Received');
        expect(r[6]).toContain(R.epdFile);
        expect(await chipCount('Received')).toBe(R.c0.Received + 1);
      });
      await s.step('Line › Verify → status "Verified", Verified chip +1, the action becomes "Unverify"; Unverify → back to "Received"', async () => {
        let row = await lineRow();
        if (await row.getByRole('button', { name: 'Verify', exact: true }).count()) { await row.getByRole('button', { name: 'Verify', exact: true }).click(); await k.settle(3000); }
        row = await lineRow();
        expect(await status()).toBe('Verified');
        expect(await chipCount('Verified')).toBe(R.c0.Verified + 1);
        await expect(row.getByRole('button', { name: 'Unverify' })).toBeVisible();
        await row.getByRole('button', { name: 'Unverify' }).click(); await k.settle(3000);
        await lineRow();
        s.observe(`after Unverify: ${await status()}`);
        expect(await status()).toBe('Received');
      });
    });
    await run.scenario(meta('ET-REG-07', 'EPD Tracker', 'Expiring / Expired: an EPD with an expiry date inside the window', 'Question'), async s => {
      await s.step('Uploaded EPD › expiry date → line "Expiring" when the date is within "Show as expiring within"; "Expired" after it', async () => {
        // The expiry date comes only from parsing a real EPD document; the EPD Report has no field to enter it, and the
        // records have only a "Parse" action (no edit / delete). A blank test PDF parses as "Failed".
        throw new Error('Question to the dev team (Q8): how does an EPD get an expiry date on staging? There is no expiry field on the EPD Report or the tracker, and a test PDF cannot be parsed. Please provide a sample EPD PDF that parses with a validity date, or a way to set it, so Expiring/Expired can be tested.');
      });
    });
    await run.scenario({ ...meta('ET-RESTORE', 'EPD Tracker', 'Restore the EPD category settings', 'Setup'), always: true }, async s => {
      await s.step('Settings › untick the category ticked by ET-REG-05 › Save settings → chips equal the start of the run', async () => {
        if (!R.epdSaved || !R.cat) { s.observe('nothing changed'); return; }
        await go('/epd-tracker', 8000); await openSettings();
        const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        await main.getByRole('searchbox', { name: 'Find a category' }).fill(R.cat.name); await k.settle(1200);
        const box = main.getByRole('checkbox', { name: new RegExp('^' + esc(R.cat.name) + '( Div \\d+)? \\d+ lines?$') }).first();
        if (await box.isChecked().catch(() => false)) {
          await box.click({ force: true }); await k.settle(800);
          if (await box.isChecked()) { await box.dispatchEvent('click'); await k.settle(800); }
          { const save = main.getByRole('button', { name: 'Save settings' }); if (await save.isEnabled().catch(() => false)) await save.click(); await k.settle(5000); }
        }
        await go('/epd-tracker', 8000);
        const now = { req: await chipCount('Required (missing)'), not: await chipCount('Not required') };
        s.observe(`now ${JSON.stringify(now)}; start ${JSON.stringify(R.before)}`);
        expect(now).toEqual(R.before);
      });
    });
  } });
});
