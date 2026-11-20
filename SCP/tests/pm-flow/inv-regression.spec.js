// Inventory Management regression – INV-REG-01…25 (docs/functional-discovery/INV_SCENARIOS.md). Stock comes from the
// Procurement regression runs (43 Inches delivered to the first location of the site). Writes approved on NRVC_Hall:
// activities, uploads and one extra location for Internal Movement (INV-R4). The activity date input is never clicked
// (SCP-DEF-002 freezes the tab); after a Submittal change the Schedule list is given time to reload (OBS-INV-3).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { runPmSuite } = require('./support/pm-flow');
const { plKit } = require('./support/pl-flow');
const { writeXlsx, readXlsxRows } = require('./support/pl-files');
const { SiteSelectorPage } = require('../../pages/site-selector.page');

const SUITE = 'Inventory Management Regression';
const MODULE = 'Inventory Management';
const meta = (id, title, kind, extra = {}) => ({ id, module: MODULE, submodule: kind, suite: SUITE, title: `[${kind}] ${title}`, navPath: [MODULE], ...extra });
const digits = new Date().toISOString().replace(/\D/g, '');
const RUN = `INR${digits.slice(2, 12)}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inv-reg-'));
const SITE2 = process.env.SCP_INV_SITE2;
// Run submittals of the Procurement runs; imported ones (-SUB-I1/I2) have no schedule lines, so the form tries several.
const RUN_SUBMITTAL = /^PL[DTRS]\d+-SUB-\w+$/;
const PREFERRED = /^PLD1102-SUB-0[17]$/;
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test.describe.configure({ mode: 'serial' });
test.setTimeout(90 * 60 * 1000);

test('Inventory Management – regression', async ({ page, browserName }) => {
  await runPmSuite({ page, browserName, suite: SUITE, scenarios: async ({ run, config }) => {
    const k = plKit(page);
    const { main, listbox } = k;
    const M = k.MATERIAL;
    const btn = (name, scope = main) => scope.getByRole('button', { name, exact: true }).first();
    const anyToast = async () => (await page.getByRole('status').allInnerTexts()).join(' | ');
    const invCount = async () => Number(((await main.innerText()).match(/(\d+) items?/) || [])[1] || NaN);
    const search = page.getByRole('textbox', { name: 'Search inventory…' });
    const home = async () => {
      await page.keyboard.press('Escape').catch(() => null);
      await page.goto('/inventory-management', { waitUntil: 'domcontentloaded' });
      await k.keepSite(); // the reload resets the header venue to the newest site (OBS-INV-12); locations follow the venue
      await expect.poll(invCount, { timeout: 30000 }).toBeGreaterThan(0);
    };
    const gridQty = async () => { await search.fill(M); await k.settle(800); const r = k.rows().filter({ has: page.getByRole('cell', { name: M, exact: true }) }).first(); return Number((await r.getByRole('cell').nth(3).innerText()).replace(/,/g, '')); };
    const view = async name => {
      await search.fill(M); await k.settle(800);
      await k.rows().filter({ has: page.getByRole('cell', { name: M, exact: true }) }).first().locator('img[alt="Menu"]').click();
      await page.getByRole('menuitem', { name, exact: true }).click();
      await k.settle(1500);
    };
    const ledger = async () => { await home(); await view('Actions'); };
    const closing = async () => { await k.settle(1500); return Number(((await page.locator('body').innerText()).match(/Closing Balance\s*:?\s*(-?[\d,.]+)/) || [])[1]?.replace(/,/g, '')); };
    const ledgerRows = () => page.getByRole('row').filter({ has: page.locator('td') });
    // Picker by label: button → listbox option, select → label, input → fill. Returns the options offered.
    const pick = async (label, choose) => {
      const el = page.getByText(new RegExp(`^${esc(label)}\\s*\\*?$`)).last().locator('xpath=following::*[self::input[not(@type="checkbox") and not(@readonly)] or self::textarea or self::select or self::button or @role="button"][1]');
      const tag = await el.evaluate(e => e.tagName);
      if (tag === 'INPUT' || tag === 'TEXTAREA') { await el.fill(String(choose)); return []; }
      if (tag === 'SELECT') {
        const opts = (await el.locator('option').allInnerTexts()).map(t => t.trim()).filter(Boolean);
        const want = typeof choose === 'function' ? opts.find(choose) : choose;
        if (want !== undefined) await el.selectOption({ label: want });
        return opts;
      }
      await el.click(); await k.settle(400);
      const opts = (await listbox().getByRole('option').allInnerTexts()).map(t => t.trim()).filter(Boolean);
      const want = typeof choose === 'function' ? opts.find(choose) : choose;
      if (want === undefined) { await page.keyboard.press('Escape'); return opts; }
      await listbox().getByRole('option', { name: want, exact: true }).first().click();
      return opts;
    };
    const firstNot = bad => o => !bad.test(o);
    const ctx = {};
    // Add Activity on the ledger of M. `submittal`/`schedule` are matchers on the option text.
    const activity = async ({ action, from, to, qty, comments = `${RUN} ${action}`, submittal = o => RUN_SUBMITTAL.test(o), schedule = () => true, waitSchedule = true, submit = true }) => {
      await page.getByRole('button', { name: 'Add Activity' }).last().click();
      await page.getByRole('button', { name: 'ADD', exact: true }).last().waitFor();
      await pick('Item', M);
      await pick('Action', action);
      ctx.locations = await pick('From Location', from || firstNot(/^(All Locations|Choose|Select|Loc INR)/i));
      if (to) await pick('To Location', to);
      await pick('QTY', qty);
      await pick('Comments', comments);
      ctx.suppliers = await pick('Supplier', firstNot(/^(Choose|Select)/));
      ctx.subcontractors = await pick('Subcontractor', firstNot(/^(Choose|Select)/));
      ctx.submittals = await pick('Submittal', () => undefined);
      const cands = typeof submittal === 'string' ? [submittal] : [...ctx.submittals.filter(o => submittal(o) && PREFERRED.test(o)), ...ctx.submittals.filter(o => submittal(o) && !PREFERRED.test(o)).reverse()].slice(0, 12);
      ctx.schedules = []; ctx.sub = undefined;
      for (const c of cands) {
        await pick('Submittal', c);
        if (waitSchedule) await page.waitForTimeout(2000); // the schedule list reloads ~1 s after the submittal changes
        ctx.schedules = await pick('Schedule', schedule);
        if (ctx.schedules.length) { ctx.sub = c; break; }
      }
      if (submit) { await page.getByRole('button', { name: 'ADD', exact: true }).last().click(); await k.settle(2000); }
    };
    const dialogOpen = () => page.getByRole('button', { name: 'ADD', exact: true }).last().isVisible().catch(() => false);
    const closeActivity = async () => { if (await dialogOpen()) { await page.keyboard.press('Escape'); await k.settle(500); } };
    const msg = async () => `${await anyToast()} ${await page.getByText(/required|cannot|not enough|must be|invalid/i).allInnerTexts().catch(() => [])}`.trim();
    const fromLoc = () => (ctx.locations || []).find(firstNot(/^(All Locations|Choose|Select|Loc INR)/i));

    const login = await run.scenario(meta('INV-REG-SETUP', `Sign in on ${config.projectName}`, 'Setup', { always: true }), async s => {
      await k.signIn(s, config);
      await s.step(`Sidebar › "Inventory Management" → list shows items`, () => k.menu(MODULE).catch(() => null).then(home), { critical: true });
      await s.step(`Inventory Management › search "${M}" → grid Inventory (4th column) is above 3, stock delivered by the Procurement regression`, async () => { ctx.grid = await gridQty(); s.observe(`Run ${RUN}; ${M} inventory ${ctx.grid}`); expect(ctx.grid).toBeGreaterThan(3); }, { critical: true });
    });
    if (login.status !== 'Passed') { run.abort('Setup failed (needs stock from the Procurement regression)'); return; }

    await run.scenario(meta('INV-REG-01', 'GRN creates Incoming Load', 'Integration'), async s => {
      await s.step(`Search "${M}", row "⋮" › "Actions" → ledger has at least one "Incoming Load" row (GRNs of the Procurement runs)`, async () => {
        await ledger();
        const rows = await ledgerRows().filter({ hasText: 'Incoming Load' }).allInnerTexts();
        s.observe(`${rows.length} Incoming Load rows`);
        expect(rows.length).toBeGreaterThan(0);
      });
      await s.step(`Ledger → "Closing Balance" equals the grid Inventory quantity read at setup`, async () => { ctx.closing = await closing(); expect(ctx.closing).toBe(ctx.grid); });
    });
    run.skip(meta('INV-REG-21', 'Damaged units counted as received (PL-R16)', 'Integration'), 'Checked in the Procurement regression (PL-REG-DLV-13: Incoming Load = delivered QTY incl. damaged)');

    await run.scenario(meta('INV-REG-13', 'Pickers filtered by material', 'Positive'), async s => {
      await s.step(`Ledger › "Add Activity": action "Issue To Construction", QTY 1, no save → Supplier list has the run supplier, Submittal list has run submittals (PL…-SUB-…), Schedule list is not empty`, async () => {
        await ledger();
        await activity({ action: 'Issue To Construction', qty: 1, submit: false });
        s.observe(`Suppliers: ${ctx.suppliers.join(', ')} · Subcontractors: ${ctx.subcontractors.length} · Submittals: ${ctx.submittals.length} · Schedules: ${ctx.schedules.join(', ')}`);
        expect(ctx.submittals.some(o => RUN_SUBMITTAL.test(o))).toBe(true);
        expect(ctx.suppliers).toContain(k.SUPPLIER);
        expect(ctx.schedules.length).toBeGreaterThan(0);
      });
      await s.step(`Add Activity form → hint "Available at <location>: <qty>" is shown and its value is recorded`, async () => {
        const hint = await page.getByText(/Available at .+: [\d.]+/).first().innerText();
        s.observe(hint); ctx.hint = Number(hint.match(/: ([\d.]+)/)[1]);
      });
      await s.step(`Press Escape → Add Activity form closes without saving`, closeActivity);
    });
    await run.scenario(meta('INV-REG-12', 'Available stock hint = location balance', 'Positive'), async s => {
      await s.step(`Row "⋮" › "Location" → QTY of the From Location row equals the "Available at" hint`, async () => {
        await home(); await view('Location');
        const row = page.getByRole('row').filter({ hasText: fromLoc() || '' }).first();
        const q = Number((await row.getByRole('cell').last().innerText()).replace(/,/g, ''));
        expect(ctx.hint).toBe(q);
      });
    });

    const stockCase = (id, title, action, qty, delta) => run.scenario(meta(id, title, 'Positive'), async s => {
      let before;
      await s.step(`Ledger › "Add Activity": action "${action}", From Location (first real one), QTY ${qty}, first Supplier/Subcontractor, run Submittal + Schedule, "ADD" → form closes (saved)`, async () => { await ledger(); before = await closing(); await activity({ action, qty }); expect(await dialogOpen(), `Form still open: ${await msg()}`).toBe(false); }, { critical: true });
      await s.step(`Ledger → "Closing Balance" changes by ${delta > 0 ? '+' : ''}${delta} and a "${action}" row is listed`, async () => {
        await ledger(); expect(await closing()).toBe(before + delta);
        await expect(ledgerRows().filter({ hasText: action }).first()).toBeVisible();
      });
      if (id === 'INV-REG-02') await s.step(`Landing grid refresh after the activity → verified separately in INV-REG-15`, async () => s.observe('checked in INV-REG-15'));
    });
    await stockCase('INV-REG-02', 'Issue To Construction', 'Issue To Construction', 2, -2);
    await run.scenario(meta('INV-REG-15', 'Grid refreshes after an activity', 'Positive'), async s => {
      await s.step(`Ledger › "Add Activity": action "Loss", QTY 1, "ADD"; Escape, sidebar › "Inventory Management" (no reload) → grid Inventory of ${M} is 1 lower (OBS-INV-4 if stale)`, async () => {
        await ledger(); const before = await closing();
        await activity({ action: 'Loss', qty: 1 });
        await page.keyboard.press('Escape'); await k.settle(500);
        await k.menu(MODULE).catch(() => null); await k.settle(1000);
        const q = await gridQty(); s.observe(`Grid ${q}, expected ${before - 1}`);
        expect(q, 'Grid inventory is stale after a manual activity (OBS-INV-4)').toBe(before - 1);
      });
    });
    run.skip(meta('INV-REG-03', 'Loss', 'Positive'), 'Loss 1 is executed and its balance checked in INV-REG-15');
    await run.scenario(meta('INV-REG-04', 'Return reduces stock and writes back to Procurement', 'Integration'), async s => {
      let before;
      await s.step(`Ledger › "Add Activity": action "Return", QTY 1, run Submittal + Schedule, "ADD" → activity submitted`, async () => { await ledger(); before = await closing(); await activity({ action: 'Return', qty: 1 }); ctx.returnSub = ctx.sub; }, { critical: true });
      await s.step(`Ledger → "Closing Balance" is 1 lower than before the Return`, async () => { await ledger(); expect(await closing()).toBe(before - 1); });
      await s.step(`Procurement Log › search ${ctx.returnSub}, open the submittal, click component "${M}" → a "Return" row is listed`, async () => {
        await k.openLog(); await k.search(ctx.returnSub);
        await k.rows().first().getByRole('cell').nth(1).click(); await page.getByText('Other Actions').first().waitFor({ timeout: 30000 });
        await k.componentRow(M).getByRole('cell', { name: M }).click(); await k.settle(1500);
        await expect(page.getByRole('row').filter({ hasText: 'Return' }).first()).toBeVisible({ timeout: 15000 });
      });
    });

    // Incoming Load on each run submittal until a partial (accepted) and a fully delivered (rejected) one are seen.
    let accepted = null, rejected = null;
    await run.scenario(meta('INV-REG-05', 'Manual Incoming on a partial schedule', 'Integration'), async s => {
      await s.step(`Ledger › "Add Activity": "Incoming Load", QTY 1 on up to 8 run submittals until one is accepted (form closes) and one rejected ("scheduled_quantity" / "Cannot add this activity")`, async () => {
        await ledger(); await activity({ action: 'Incoming Load', qty: 1, submit: false });
        const subs = [...ctx.submittals.filter(o => PREFERRED.test(o)), ...ctx.submittals.filter(o => RUN_SUBMITTAL.test(o) && !PREFERRED.test(o)).reverse()].slice(0, 8);
        await closeActivity();
        for (const sub of subs) {
          if (accepted && rejected) break;
          await ledger(); await activity({ action: 'Incoming Load', qty: 1, submittal: sub });
          const m = await msg();
          if (!ctx.sub) { await closeActivity(); continue; }
          if (await dialogOpen()) { if (/scheduled_quantity|Cannot add this activity/.test(m)) rejected = rejected || { sub, m }; await closeActivity(); }
          else accepted = accepted || { sub };
        }
        s.observe(`Accepted: ${accepted?.sub || '-'} · Rejected: ${rejected?.sub || '-'}`);
        expect(accepted, 'No partial run schedule accepted a manual Incoming Load').toBeTruthy();
      });
      if (accepted) await s.step(`Procurement Log › search the accepted submittal, open it, click component "${M}" → delivery shows "Via Inventory"`, async () => {
        await k.openLog(); await k.search(accepted.sub);
        await k.rows().first().getByRole('cell').nth(1).click(); await page.getByText('Other Actions').first().waitFor({ timeout: 30000 });
        await k.componentRow(M).getByRole('cell', { name: M }).click(); await k.settle(1500);
        await expect(page.getByText(/Via Inventory/).first()).toBeVisible({ timeout: 15000 });
      });
    });
    await run.scenario(meta('INV-REG-06', 'Incoming beyond the scheduled quantity rejected', 'Negative'), async s => {
      await s.step(`Ledger › "Add Activity": "Incoming Load" QTY 99999 on the accepted submittal (only if none was rejected before), "ADD" → form stays open with "Cannot add this activity" / "exceeds"; balance unchanged`, async () => {
        if (!rejected) {
          // Returns reopen fully delivered schedules, so over-receive the accepted schedule instead (same rule).
          expect(accepted, 'No run schedule to test').toBeTruthy();
          await ledger(); const before = await closing();
          await activity({ action: 'Incoming Load', qty: 99999, submittal: accepted.sub });
          rejected = { sub: accepted.sub, m: await msg() }; const open = await dialogOpen(); await closeActivity();
          expect(open, 'Over-receipt of 99999 was saved').toBe(true);
          await ledger(); expect(await closing()).toBe(before);
        }
        s.observe(`${rejected.sub}: ${rejected.m.slice(0, 160)}`);
        expect(rejected.m).toMatch(/Cannot add this activity|exceeds/);
      });
    });

    const negative = (id, title, args, re, extra = '', flow = title) => run.scenario(meta(id, title, 'Negative'), async s => {
      await s.step(flow, async () => {
        await ledger(); const before = await closing();
        await activity(args); const m = await msg(); s.observe(m.slice(0, 160));
        const open = await dialogOpen(); await closeActivity();
        expect(open, `Activity was saved${extra}`).toBe(true);
        expect(m).toMatch(re);
        await ledger(); expect(await closing()).toBe(before);
      });
    });
    await negative('INV-REG-07', 'Overdraw rejected', { action: 'Loss', qty: 99999 }, /Not enough stock at .+: only [\d.]+ .+ available, 99999 requested/, '', `Ledger › "Add Activity": action "Loss", QTY 99999, "ADD" → form stays open: "Not enough stock at <location>: only N available, 99999 requested"; balance unchanged`);
    await negative('INV-REG-08', 'QTY 0 rejected', { action: 'Loss', qty: 0 }, /Quantity cannot be empty or zero or less/, '', `Ledger › "Add Activity": action "Loss", QTY 0, "ADD" → form stays open: "Quantity cannot be empty or zero or less"; balance unchanged`);
    await negative('INV-REG-09', 'QTY with 3 decimals', { action: 'Loss', qty: '1.555' }, /2 decimal|two decimal|decimal places/i, ' (OBS-INV-10: only the generic "Invalid data provided.")', `Ledger › "Add Activity": action "Loss", QTY 1.555, "ADD" → form stays open with a "2 decimal places" message; balance unchanged`);
    await run.scenario(meta('INV-REG-10', 'Internal Movement to the same location', 'Negative'), async s => {
      await s.step(`Ledger › "Add Activity": "Internal Movement", QTY 1, To Location = the From Location, "ADD" → "From Location and To Location must be different."`, async () => {
        await ledger(); await activity({ action: 'Internal Movement', qty: 1, submit: false });
        await pick('To Location', fromLoc());
        await page.getByRole('button', { name: 'ADD', exact: true }).last().click(); await k.settle(1500);
        await expect(page.getByText('From Location and To Location must be different.').first()).toBeVisible();
        await closeActivity();
      });
    });

    const LOC2 = `Loc ${RUN}`;
    const loc2 = await run.scenario(meta('INV-REG-11', 'Internal Movement between two locations', 'Positive'), async s => {
      await s.step(`Inventory Management Location dropdown has 2+ locations, else Site Details › site row "ADD" › "Choose Location" "Construction Area", name "${LOC2}", "Add" → second location exists`, async () => {
        await home(); const opts = (await main.locator('select').first().locator('option').allInnerTexts()).map(t => t.trim()).filter(t => t && t !== 'All locations');
        if (opts.length >= 2) { ctx.to = opts.find(o => o !== fromLoc()) || opts[1]; s.observe(`Using existing ${ctx.to}`); return; }
        const site = await new SiteSelectorPage(page).activeSiteName();
        await page.goto('/site-details', { waitUntil: 'domcontentloaded' }); await k.settle(1500);
        await main.locator('tbody tr').filter({ has: page.getByRole('cell', { name: site, exact: true }) }).first().getByRole('button', { name: 'ADD', exact: true }).click();
        await k.pick('Choose Location', 'Construction Area');
        await page.getByRole('heading', { name: /Add Location/ }).locator('xpath=../..').locator('input[type="text"], input:not([type])').first().fill(LOC2);
        await page.getByRole('button', { name: 'Add', exact: true }).last().click(); await k.settle(1500);
        ctx.to = LOC2; s.observe(`Created ${LOC2} on ${site}`);
      }, { critical: true });
      let src, dst;
      const atLoc = async name => { await home(); await view('Location'); const r = page.getByRole('row').filter({ hasText: new RegExp(esc(name), 'i') }).first(); return (await r.count()) ? Number((await r.getByRole('cell').last().innerText()).replace(/,/g, '')) : 0; };
      await s.step(`Row "⋮" › "Location": note QTY at source and destination; Ledger › "Add Activity": "Internal Movement", From = source, To = second location, QTY 1, "ADD" → form closes`, async () => {
        ctx.from = (ctx.locations || []).find(o => !/^(All Locations|Choose|Select)/.test(o) && o.toLowerCase() !== ctx.to.toLowerCase());
        src = await atLoc(ctx.from || ''); dst = await atLoc(ctx.to);
        await ledger(); await activity({ action: 'Internal Movement', qty: 1, from: ctx.from, to: o => o.toLowerCase() === ctx.to.toLowerCase() }); // the new location can sort first // names are title-cased (OBS-PL-32)
        expect(await dialogOpen(), `Not saved: ${await msg()}`).toBe(false);
      }, { critical: true });
      await s.step(`Row "⋮" › "Location" → source location QTY is 1 lower and destination QTY is 1 higher`, async () => {
        expect(await atLoc(ctx.from)).toBe(src - 1);
        expect(await atLoc(ctx.to)).toBe(dst + 1);
      });
    });

    await run.scenario(meta('INV-REG-14', 'Schedule must match the submittal', 'Negative'), async s => {
      await s.step(`Ledger › "Add Activity": "Loss" QTY 1, pick Submittal A + its Schedule, change Submittal to B without re-picking Schedule, "ADD" → rejected, or no row saved with A's schedule under B`, async () => {
        await ledger(); await activity({ action: 'Loss', qty: 1, submit: false });
        const subs = ctx.submittals.filter(o => RUN_SUBMITTAL.test(o));
        const a = ctx.sub; const b = subs.find(o => o !== a);
        await pick('Submittal', a); await page.waitForTimeout(2000); await pick('Schedule', () => true);
        const schedA = (await page.getByText(/^Schedule\s*\*?$/).last().locator('xpath=following::*[@role="button"][1]').innerText()).trim();
        const poA = schedA.slice(schedA.indexOf(`${M}-`) + M.length + 1);
        await pick('Submittal', b);
        const table = () => page.locator('table').filter({ has: page.getByRole('columnheader', { name: /Total QTY/i }) }).last();
        await closeActivity(); await ledger(); const before = new Set(await table().locator('tbody tr').allInnerTexts());
        await activity({ action: 'Loss', qty: 1, submit: false, submittal: a });
        await pick('Submittal', b);
        await page.getByRole('button', { name: 'ADD', exact: true }).last().click(); await k.settle(2000);
        if (await dialogOpen()) { s.observe(`Rejected: ${await msg()}`); await closeActivity(); return; }
        await ledger();
        const added = (await table().locator('tbody tr').allInnerTexts()).filter(t => !before.has(t)).map(t => t.replace(/\s+/g, ' '));
        s.observe(`A ${a} (${poA}) → B ${b}; new row: ${added.join(' / ').slice(0, 200)}`);
        if (added.some(t => t.includes(poA) && t.includes(b.replace('-SUB-', '-SPEC-')))) throw new Error(`Inventory activity saved with a schedule from another submittal (${a} schedule ${poA} on ${b})`);
      });
    });

    // ---------- Upload ----------
    const openUpload = async () => { await home(); await btn('Upload').click(); await expect(page.getByText('Upload inventory activities').first()).toBeVisible(); };
    const uploadFile = async file => {
      await page.locator('input[type="file"]').last().setInputFiles(file);
      await page.getByRole('button', { name: 'Upload', exact: true }).last().click();
      // The dialog text itself mentions "the error file"; wait for the Uploading… state to end instead.
      await expect(page.getByRole('button', { name: /Uploading/ })).toHaveCount(0, { timeout: 120000 }).catch(() => null);
      await page.getByText(/uploaded successfully|upload failed|nothing was saved/i).first().waitFor({ timeout: 15000 }).catch(() => null);
      const m = (await page.locator('body').innerText()).match(/[^\n]*(uploaded successfully|upload failed|Nothing was saved)[^\n]*/i)?.[0] || '';
      if (/failed/i.test(m)) { // keep the app's per-row reason with the result
        const link = page.getByRole('button', { name: /error/i }).or(page.getByRole('link', { name: /error/i })).first();
        if (await link.isVisible().catch(() => false)) {
          const dl = page.waitForEvent('download', { timeout: 20000 }); dl.catch(() => null); await link.click();
          const d = await dl.catch(() => null);
          if (d) { const p = path.join(tmp, `err-${Date.now()}.xlsx`); await d.saveAs(p); return `${m} | ${readXlsxRows(p).slice(1).map(r => r.filter(Boolean).slice(-2).join(': ')).join(' / ').slice(0, 300)}`; }
        }
      }
      return m;
    };
    let tpl;
    const tplOk = await run.scenario(meta('INV-REG-19', 'Upload with optional columns blank', 'Positive'), async s => {
      await s.step(`Inventory Management › "Upload" › "Download template" → sheet "Inventory Template" header is Submittal No, Material, Item, Date Required On Site, PO Number, Action, From Location, To Location, Quantity, UoM, Supplier, Comments`, async () => {
        await openUpload();
        const dl = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download template' }).click();
        tpl = path.join(tmp, 'tpl.xlsx'); await (await dl).saveAs(tpl);
        ctx.head = readXlsxRows(tpl, 'Inventory Template')[0]; s.observe(ctx.head.join(' | '));
        expect(ctx.head).toEqual(['Submittal No', 'Material', 'Item', 'Date Required On Site', 'PO Number', 'Action', 'From Location', 'To Location', 'Quantity', 'UoM', 'Supplier', 'Comments']);
      }, { critical: true });
      await s.step(`Upload dialog › "Cancel"; Ledger › "Add Activity" (Loss, QTY 1, no save) → read Submittal, Schedule date and PO number for the upload rows; close the form`, async () => {
        await page.getByRole('button', { name: 'Cancel', exact: true }).last().click();
        await ledger(); // PLD1102-SUB-01 exists twice on the project; the upload rejects it as ambiguous (OBS-INV-13), the form does not.
        await activity({ action: 'Loss', qty: 1, submit: false, submittal: o => RUN_SUBMITTAL.test(o) && o !== 'PLD1102-SUB-01' });
        ctx.upSub = (await page.getByText(/^Submittal\s*\*?$/).last().locator('xpath=following::*[@role="button"][1]').innerText()).trim();
        const sched = ctx.schedules.find(firstNot(/^(Choose|Select)/)) || '';
        const d = sched.match(/(\d{4})-(\d{2})-(\d{2})|(\d{2})\/(\d{2})\/(\d{4})/) || [];
        ctx.upDate = d[1] ? `${d[3]}/${d[2]}/${d[1]}` : d[0]; ctx.upPo = sched.slice(sched.indexOf(`${M}-`) + M.length + 1); // <ROJ>-<item>-<PO>
        s.observe(`${ctx.upSub} · ${sched} → ${ctx.upDate} / ${ctx.upPo}`);
        await closeActivity();
      }, { critical: true });
      let before;
      await s.step(`Build file row (Loss, From Location, QTY 1, UoM/Supplier/Comments blank); "Upload" › choose file › "Upload" → message "uploaded successfully"`, async () => {
        await ledger(); before = await closing();
        const f = path.join(tmp, `${RUN}-ok.xlsx`);
        writeXlsx(f, [ctx.head, [ctx.upSub, M, M, ctx.upDate, ctx.upPo, 'Loss', fromLoc(), '', '1', '', '', '']], 'Inventory Template');
        await openUpload(); const t = await uploadFile(f); s.observe(t || '(no message)');
        expect(t).toMatch(/uploaded successfully/i);
      });
      await s.step(`Close the dialog; Ledger → "Closing Balance" is 1 lower than before the upload`, async () => { await page.keyboard.press('Escape'); await ledger(); expect(await closing()).toBe(before - 1); });
    });
    if (tplOk?.status === 'Passed') {
      await run.scenario(meta('INV-REG-17', 'Upload valid file applies rows top to bottom', 'Positive'), async s => {
        let before;
        await s.step(`Build file with 2 rows (Issue To Construction 1, Loss 1, comments "${RUN} upload …"); "Upload" › choose file › "Upload" → "uploaded successfully"`, async () => {
          await ledger(); before = await closing();
          const f = path.join(tmp, `${RUN}-two.xlsx`);
          const r = a => [ctx.upSub, M, M, ctx.upDate, ctx.upPo, a, fromLoc(), '', '1', '', '', `${RUN} upload ${a}`];
          writeXlsx(f, [ctx.head, r('Issue To Construction'), r('Loss')], 'Inventory Template');
          await openUpload(); expect(await uploadFile(f)).toMatch(/uploaded successfully/i);
        });
        await s.step(`Close the dialog, reopen Inventory Management → grid Inventory and ledger "Closing Balance" are both 2 lower than before`, async () => {
          await page.keyboard.press('Escape'); await home(); const g = await gridQty();
          await view('Actions'); expect(await closing()).toBe(before - 2); expect(g).toBe(before - 2);
          expect(await ledgerRows().filter({ hasText: `${RUN} upload` }).count()).toBeGreaterThanOrEqual(0);
        });
      });
      await run.scenario(meta('INV-REG-16', 'Upload is all-or-nothing', 'Negative'), async s => {
        let before;
        await s.step(`Build file with Loss 1 and Loss 99999; "Upload" › choose file › "Upload" → "The upload failed. Nothing was saved."`, async () => {
          await ledger(); before = await closing();
          const f = path.join(tmp, `${RUN}-bad.xlsx`);
          const r = q => [ctx.upSub, M, M, ctx.upDate, ctx.upPo, 'Loss', fromLoc(), '', String(q), '', '', `${RUN} atomic`];
          writeXlsx(f, [ctx.head, r(1), r(99999)], 'Inventory Template');
          await openUpload(); await uploadFile(f);
          await expect(page.getByText('The upload failed. Nothing was saved.').first()).toBeVisible({ timeout: 20000 });
        });
        await s.step(`Click "Download error file" → sheet has a "Valid (not saved)" row and a "Not enough stock" row; its "available" figure is kept for INV-REG-18`, async () => {
          const dl = page.waitForEvent('download'); await page.getByRole('button', { name: /Download error file/ }).click();
          const f = path.join(tmp, 'err.xlsx'); await (await dl).saveAs(f);
          const rows = readXlsxRows(f).map(r => r.join(' | '));
          s.observe(rows.slice(0, 3).join(' // ').slice(0, 300));
          expect(rows.some(r => /Valid \(not saved\)/.test(r))).toBe(true);
          const err = rows.find(r => /Not enough stock/.test(r)); expect(err).toBeTruthy();
          ctx.uploadAvail = Number((err.match(/([\d.]+) available/) || [])[1]);
        });
        await s.step(`Click "Close"; Ledger → "Closing Balance" is unchanged`, async () => { await page.getByRole('button', { name: 'Close', exact: true }).last().click().catch(() => page.keyboard.press('Escape')); await ledger(); expect(await closing()).toBe(before); ctx.ledgerNow = before; });
      });
      await run.scenario(meta('INV-REG-18', 'Upload available stock matches the ledger', 'Positive'), async s => {
        await s.step(`Compare the "available" figure from the upload error file with the ledger "Closing Balance" → equal`, async () => {
          s.observe(`Upload says ${ctx.uploadAvail}, ledger ${ctx.ledgerNow} (INV-R3: watch item)`);
          expect(ctx.uploadAvail).toBe(ctx.ledgerNow);
        });
      });
    } else for (const id of ['17', '16', '18']) run.skip(meta(`INV-REG-${id}`, 'Needs the upload template and a run schedule', 'Dependent'), 'INV-REG-19 failed');

    // ---------- Read-only checks ----------
    await run.scenario(meta('INV-REG-20', 'Ledger columns', 'Positive'), async s => {
      await s.step(`Ledger → "Submittal" column of a run row (PL…-) → value contains "-SUB-", the Submittal No (OBS-INV-1)`, async () => {
        await ledger();
        const table = page.locator('table').filter({ has: page.getByRole('columnheader', { name: /Total QTY/i }) }).last();
        const h = (await table.getByRole('columnheader').allInnerTexts()).map(t => t.trim().toLowerCase());
        const i = h.indexOf('submittal');
        const v = (await table.getByRole('row').filter({ hasText: /PL[DTRS]\d+-/ }).first().getByRole('cell').nth(i).innerText()).trim();
        s.observe(`Submittal cell: ${v}`);
        expect(v, 'Ledger Submittal column shows the Spec Section No (OBS-INV-1)').toMatch(/-SUB-/);
      });
    });
    await run.scenario(meta('INV-REG-22', 'Export is the balance list (INV-R2)', 'Positive'), async s => {
      await s.step(`Inventory Management › "Export" → xlsx header contains Material ID, Material Name, Inventory, the balance list (OBS-INV-8)`, async () => {
        await home(); const dl = page.waitForEvent('download'); await btn('Export').click();
        const f = path.join(tmp, 'export.xlsx'); await (await dl).saveAs(f);
        const head = readXlsxRows(f)[0] || []; s.observe(head.join(' | '));
        expect(head, 'Export is the activity log, not the balance list (OBS-INV-8)').toEqual(expect.arrayContaining(['Material ID', 'Material Name', 'Inventory']));
      });
    });
    await run.scenario(meta('INV-REG-23', 'Site isolation', 'Positive'), async s => {
      const sites = new SiteSelectorPage(page);
      const locs = async () => { await k.settle(2500); return (await main.locator('select').first().locator('option').allInnerTexts()).filter(t => t !== 'All locations'); };
      let a, here, other;
      await s.step(`Inventory Management → note the header site and the options of the Location dropdown`, async () => { await home(); here = await sites.activeSiteName(); a = await locs(); });
      await s.step(`Header site selector: switch to the second site (SCP_INV_SITE2 or default) → Location dropdown lists none of the first site's locations`, async () => {
        other = SITE2 || (here === 'Warehoust _NR' ? 'Site T2 Pmr2-2611011614' : 'Warehoust _NR');
        await sites.ensureSite(other);
        const b = await locs();
        s.observe(`${here}: ${a.join(', ')} · ${other}: ${b.join(', ')}`);
        expect(b.filter(x => a.includes(x))).toEqual([]);
      });
      await s.step(`Reload the page → header still shows the second site (OBS-INV-12 if it reverts)`, async () => {
        await page.reload({ waitUntil: 'domcontentloaded' }); await k.settle(3000);
        const now = await sites.activeSiteName(); s.observe(`After reload: ${now}`);
        expect(now, 'Header site reverts after a reload (OBS-INV-12)').toBe(other);
      });
      await s.step(`Header site selector: switch back to the starting site if different`, async () => { if ((await sites.activeSiteName()) !== here) await sites.ensureSite(here); });
    });
    run.skip(meta('INV-REG-24', 'History date filter inclusive', 'Positive'), 'Covered by the 24 Oct Inventory automation; the ledger date pickers are not driven here (SCP-DEF-002 risk)');
    run.skip(meta('INV-REG-25', 'Activity date picker', 'Known Defect'), 'SCP-DEF-002: clicking the input freezes the tab, so it is never clicked');
  } });
});
