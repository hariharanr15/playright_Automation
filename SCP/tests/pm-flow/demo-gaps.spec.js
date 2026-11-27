// =====================================================================================================================
// Dev review gaps 1, 9, 14 and 17 (ISSUES_CONSOLIDATED_2026-11-27, section 6) on NeuralRays_Demo.
// User decision (27 Nov 2026): run them on NeuralRays_Demo instead of NRVC_Hall (the Inventory tab does not load there).
//
// Data on NeuralRays_Demo (read 27 Nov): material White_Cement (category "Cements" = Division 34 · Transportation, UoM
// Pounds) has one item "White Cement" with conversion 25 (gap 9), and its submittals use Div 32 spec sections (gap 14).
// The project has no open line to load, so each run creates ONE submittal "DG <YYMMDD-HHMM>" (spec section 321216, Div 32)
// with one White_Cement component (10, PO), then one load chain: load 3 → expected → receive 2 (1 damaged) → NCR on
// the damaged piece. The gap checks after that are read-only (the Issue form is filled, never recorded).
// Re-run without new data: SCP_DG_LOAD=LD-000N SCP_DG_SUB=<submittal number>.
// Run: SCP_PROJECT_NAME=NeuralRays_Demo SCP_PL_SITE="Location 1" node scripts/run-pm-flow.js demo-gaps --headless
// =====================================================================================================================
const { test, expect } = require('@playwright/test');
const { runPmSuite } = require('./support/pm-flow');
const { plKit, poToday } = require('./support/pl-flow');

const SUITE = 'Dev Review Gaps (NeuralRays_Demo)';
const d = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString(); // IST
const STAMP = `${d.slice(2, 4)}${d.slice(5, 7)}${d.slice(8, 10)}-${d.slice(11, 13)}${d.slice(14, 16)}`;
const TAG = `DG ${STAMP}`;
const MATERIAL = 'White_Cement';
const SITE = process.env.SCP_PL_SITE || 'Location 1';
const SPEC = '321216';
const QTY = 3, RECEIVED = 2, DAMAGED = 1;
const meta = (id, module, title, kind = 'Integration') => ({ id, module, submodule: 'Dev review gaps', suite: SUITE, title: `[${kind}] ${title}`, kind, navPath: [module] });

test.describe.configure({ mode: 'serial' });
test.setTimeout(60 * 60 * 1000);

test('Dev review gaps on NeuralRays_Demo', async ({ page, browserName }) => {
  await runPmSuite({ page, browserName, suite: SUITE, scenarios: async ({ run, config }) => {
    const k = plKit(page);
    const { main } = k;
    const clean = t => String(t || '').replace(/\s+/g, ' ').trim();
    const num = t => Number(String(t ?? '').replace(/,/g, '').match(/-?\d+(\.\d+)?/)?.[0] ?? NaN);
    const go = async route => { await page.goto(route, { waitUntil: 'domcontentloaded' }); await main.getByText('Loading…').first().waitFor({ state: 'hidden', timeout: 60000 }).catch(() => null); await k.settle(3000); };
    const status = async () => clean((await main.innerText()).split('\n').slice(0, 5).join(' '));
    const select = option => main.locator('select').filter({ has: page.locator('option', { hasText: option }) }).first();
    const plus = n => { const t = new Date(Date.now() + 5.5 * 3600e3 + n * 864e5); return t.toISOString().slice(0, 10); };
    const R = { sub: process.env.SCP_DG_SUB, load: process.env.SCP_DG_LOAD };

    // Receipt and NCR of the run load (shared by a new chain and a resumed one).
    const editComponentQty = async (s, qty) => {
      await k.openLog(); await k.search(R.sub); await k.settle(2000);
      await main.getByRole('cell', { name: R.sub, exact: true }).first().click();
      await page.waitForURL(/[?&]submittal=/, { timeout: 30000 }); await k.componentsLoaded();
      await k.componentAction(MATERIAL, 'Edit component'); await k.settle(1500);
      const dlg = page.getByRole('heading', { name: /Edit Component/i }).last().locator('xpath=ancestor::div[.//button[normalize-space()="UPDATE" or normalize-space()="Update" or normalize-space()="SAVE" or normalize-space()="Save"]][1]');
      await expect(dlg).toBeVisible({ timeout: 15000 });
      await dlg.getByText('QTY*', { exact: true }).locator('xpath=following::input[1]').fill(String(qty));
      await dlg.getByRole('button', { name: /^(UPDATE|Update|SAVE|Save)$/ }).first().click(); await k.settle(3000);
      s.observe(`component QTY set to ${qty}: ${clean(await k.componentRow(MATERIAL).innerText()).slice(0, 160)}`);
    };
    const receiveAndNcr = async s => {
      // Gap 9 (27 Nov, first run): the load counts Pounds but the receipt multiplies by the item conversion (25), so a
      // receipt of 2 on a 10-Pound schedule was refused ("… this receipt of 25.00 exceeds the schedule by 15.00 units").
      // The message is kept for DG-GAP-09; the run's own component is then raised to 250 Pounds and the receipt retried.
      const fillReceipt = async () => {
        await go(R.loadUrl); await main.getByRole('button', { name: 'Receive' }).click();
        await expect(page).toHaveURL(/\/receive$/, { timeout: 30000 }); await k.settle(3000);
        const row = main.locator('tbody tr').filter({ hasText: R.sub }).filter({ has: page.getByRole('spinbutton') }).first();
        R.receiveRow = clean(await row.innerText());
        await row.getByRole('spinbutton').nth(0).fill(String(RECEIVED));
        await row.getByRole('spinbutton').nth(1).fill(String(DAMAGED));
        const loc = row.getByRole('combobox');
        const opts = (await loc.locator('option').allInnerTexts()).map(clean).filter(o => o && o !== 'Choose…');
        R.location = opts[0]; await loc.selectOption({ label: opts[0] });
        await row.getByRole('textbox', { name: 'Note' }).fill(`${TAG} 1 damaged`);
        await main.getByRole('textbox', { name: /Anything else/ }).fill(`${TAG} receipt`).catch(() => null);
        await main.getByRole('button', { name: 'Confirm receipt' }).click(); await k.settle(4000);
        const ok = main.getByText(new RegExp(`${R.load} received as RCV-\\d+`)).first();
        if (await ok.isVisible().catch(() => false)) return { rcv: ((await ok.innerText()).match(/RCV-\d+/) || [])[0] };
        return { error: ((clean(await main.innerText())).match(/Cannot receive:.*?(units\.|$)/) || [])[0] || '' };
      };
      await s.step(`"Receive" › Received ${RECEIVED}, Damaged ${DAMAGED}, Stored at = first location › Confirm receipt → "LD-N received as RCV-…"`, async () => {
        if (R.rcv) { s.observe(`already received as ${R.rcv}`); return; }
        let r = await fillReceipt(); s.observe(`receive form row: ${R.receiveRow}`);
        if (r.error) {
          R.gap9Block = r.error; s.observe(`refused: "${r.error}"`);
          await editComponentQty(s, 250);
          r = await fillReceipt();
        }
        expect(r.rcv, r.error ? `receipt refused: ${r.error}` : 'no "received as RCV-" message').toBeTruthy();
        R.rcv = r.rcv; s.observe(`${R.rcv} into ${R.location}`);
      }, { critical: true, attempts: 1 });
      await s.step('Discrepancies › the load\'s "Damaged" row › "Raise NCR" → NCR-N Open, quantity on hold', async () => {
          await go('/discrepancies'); await select('Resolved').selectOption({ label: 'All' }); await k.settle(2500);
          await main.getByRole('searchbox').first().fill(R.load); await k.settle(3000);
          const rows = main.locator('tbody tr').filter({ hasText: R.load });
          R.discRows = (await rows.allInnerTexts()).map(clean); s.observe(R.discRows.join(' ¦ '));
          await rows.filter({ hasText: /^Damaged/ }).first().click(); await k.settle(2500);
          await main.getByRole('button', { name: 'Raise NCR' }).click();
          await expect(page).toHaveURL(/\/ncrs\/[0-9a-f-]{36}/, { timeout: 30000 });
          R.ncrUrl = new URL(page.url()).pathname; await go(R.ncrUrl);
          R.ncrText = clean(await main.innerText()); R.ncr = (R.ncrText.match(/NCR-\d+/) || [])[0];
          s.observe(`${R.ncr}: ${R.ncrText.slice(0, 300)}`);
          expect(R.ncr).toBeTruthy();
        }, { critical: true, attempts: 1 });
    };

    const login = await run.scenario({ ...meta('DG-00', 'Login', `Sign in to ${config.projectName}, site ${SITE}`, 'Setup'), always: true }, async s => {
      await k.signIn(s, config);
      await s.step('Project is NeuralRays_Demo (user decision 27 Nov: these gaps run on NeuralRays_Demo)', async () => expect(config.projectName).toBe('NeuralRays_Demo'), { critical: true });
    });
    if (login.status !== 'Passed') { run.abort('Sign-in failed'); return; }

    // ================================ Run data (one submittal, one load chain) ================================
    if (!R.load) {
      const setup = await run.scenario(meta('DG-SET-01', 'Procurement Log', `Run submittal "${TAG}" (spec ${SPEC}, Div 32) with one ${MATERIAL} component (10, PO) → Ordered`, 'Setup'), async s => {
        const digits = STAMP.replace('-', '');
        const reuseSub = !!R.sub; // SCP_DG_SUB without SCP_DG_LOAD: the submittal exists, add the component only
        R.sub = R.sub || `DG${digits}`;
        R.desc = reuseSub ? `DG ${R.sub.slice(2, 8)}-${R.sub.slice(8, 12)}` : TAG;
        if (!reuseSub) await s.step(`Procurement Log › "Add Submittal": spec ${SPEC}, description "${TAG}", number ${R.sub}, supplier CKW10000020, material ${MATERIAL} → "Submittal added successfully"`, async () => {
          await k.openLog();
          await k.addSubmittal({ spec: SPEC, description: TAG, scheduleId: digits.slice(-6), number: R.sub, supplier: 'CKW10000020', materials: [MATERIAL] });
          await k.toast('Submittal added successfully');
        }, { critical: true, attempts: 1 });
        await s.step(`Open the submittal › "Add component": ${MATERIAL}, ROJ ${plus(7)}, QTY 10, PO ${R.sub}-PO → "Schedule added successfully!", status Ordered`, async () => {
          await k.openLog(); await k.search(R.sub); await k.openSubmittal(R.desc);
          // One material on the submittal: the form fills it in (no "(primary)" chooser).
          if (await k.componentRow(MATERIAL).count()) s.observe('component already there – not added again');
          else await k.addComponent({ rojDate: new Date(`${plus(7)}T12:00:00`), qty: 10, po: `${R.sub}-PO`, poDate: poToday() });
          const st = await k.componentStatus(MATERIAL); s.observe(`component status ${st}`);
          expect(st).toBe('Ordered');
          R.subText = clean(await main.innerText()); s.observe(R.subText.slice(0, 400));
        }, { critical: true, attempts: 1 });
      });
      if (setup.status !== 'Passed') { run.abort('Run submittal not created'); return; }

      const build = await run.scenario(meta('DG-SET-02', 'Loads', `Load ${QTY} of ${R.sub} on ${SITE} → Expected → receive ${RECEIVED} (${DAMAGED} damaged) → NCR on the damaged piece`, 'Setup'), async s => {
        await s.step(`Loads › "Build load" › search ${R.sub} › Add › quantity ${QTY}, site ${SITE}, notes "${TAG}" › Save load → LD-N Pending`, async () => {
          await go('/loads'); await main.getByRole('button', { name: 'Build load' }).click();
          await expect(page).toHaveURL(/\/loads\/new/, { timeout: 30000 }); await k.settle(4000);
          await main.getByRole('combobox', { name: 'Site' }).selectOption({ label: SITE }).catch(() => null); await k.settle(2000);
          await main.getByRole('textbox', { name: 'Search…' }).fill(R.sub); await k.settle(3000);
          const line = main.locator('table').first().locator('tbody tr').filter({ hasText: R.sub }).first();
          await expect(line, `open line ${R.sub}`).toBeVisible({ timeout: 30000 });
          R.openLine = clean(await line.innerText()); s.observe(`open line: ${R.openLine}`);
          await line.getByRole('button', { name: 'Add' }).click(); await k.settle(1500);
          const loadRow = main.getByRole('heading', { name: 'This load' }).locator('xpath=ancestor::*[2]').locator('tbody tr').filter({ hasText: R.sub }).first();
          await loadRow.getByRole('spinbutton').fill(String(QTY));
          await main.getByRole('combobox', { name: 'Site' }).selectOption({ label: SITE });
          await main.getByRole('heading', { name: 'This load' }).locator('xpath=ancestor::*[2]').getByRole('textbox').last().fill(TAG);
          R.loadLine = clean(await loadRow.innerText()); s.observe(`load line: ${R.loadLine}`);
          await main.getByRole('button', { name: 'Save load' }).click();
          await expect(page).toHaveURL(/\/loads\/[0-9a-f-]{36}$/, { timeout: 30000 }); await k.settle(2500);
          R.load = clean(await main.getByRole('heading', { level: 2 }).first().innerText()); R.loadUrl = new URL(page.url()).pathname;
          s.observe(`${R.load} · ${await status()}`);
          expect(R.load).toMatch(/^LD-\d+$/);
        }, { critical: true, attempts: 1 });
        await s.step('"Mark as expected" › today (+ reason if asked) › Save date → Expected', async () => {
          await go(R.loadUrl); await main.getByRole('button', { name: 'Mark as expected' }).click(); await k.settle(1500);
          const panel = main.getByRole('heading', { name: /^Mark LD-\d+ as expected$/ }).locator('xpath=..');
          await expect(panel).toBeVisible({ timeout: 15000 });
          await panel.locator('input').first().fill(plus(0)); await k.settle(800);
          await panel.getByRole('button', { name: 'Save date' }).click(); await k.settle(2000);
          const ask = main.getByText(/Give a reason/).first();
          if (await ask.isVisible().catch(() => false)) {
            const fields = ask.locator('xpath=ancestor::*[3]').locator('input:not([type="date"]), textarea, select');
            for (let i = 0; i < await fields.count(); i++) {
              const el = fields.nth(i);
              if ((await el.evaluate(e => e.tagName)) === 'SELECT') { const o = (await el.locator('option').allInnerTexts()).map(clean).filter(x => x && !/choose|select/i.test(x)); if (o.length) await el.selectOption({ label: o[0] }); }
              else await el.fill(`${TAG} reason`);
            }
            await panel.getByRole('button', { name: 'Save date' }).click(); await k.settle(2500);
          }
          await go(R.loadUrl); s.observe(await status());
          expect(await status()).toMatch(/Expected/);
        }, { critical: true, attempts: 1 });
        await receiveAndNcr(s);
      });
      if (build.status !== 'Passed') { run.abort('Load chain not completed'); return; }
    } else {
      await run.scenario(meta('DG-SET-02', 'Loads', `Continue with the run load ${R.load} (SCP_DG_LOAD) and submittal ${R.sub}`, 'Setup'), async s => {
        await s.step(`All Loads › find ${R.load} → status, receipt number; NCRs › the load's NCR`, async () => {
          await go('/loads'); await main.getByRole('tab', { name: 'All loads' }).click(); await k.settle(2000);
          for (const st of ['Open loads', 'Booked or expected', 'Arrived', 'Received', 'Pending (not booked)']) {
            await select('Open loads').selectOption({ label: st }).catch(() => null); await k.settle(2000);
            const hit = main.getByText(new RegExp(`^${R.load}`)).first();
            if (await hit.isVisible().catch(() => false)) { await page.keyboard.press('Escape').catch(() => null); await hit.click({ force: true }); break; }
          }
          await expect(page).toHaveURL(/\/loads\/[0-9a-f-]{36}$/, { timeout: 30000 }); await k.settle(2500);
          R.loadUrl = new URL(page.url()).pathname;
          const t = clean(await main.innerText()); R.rcv = (t.match(/RCV-\d+/) || [])[0];
          R.loadLine = (t.match(new RegExp(`White_Cement ${R.sub}[^]{0,120}`)) || [''])[0];
          s.observe(`${await status()} · receipt ${R.rcv || 'none'} · line ${R.loadLine}`);
          if (R.rcv) {
            await go('/ncrs'); await main.getByRole('searchbox').first().fill(R.load).catch(() => null); await k.settle(2500);
            const row = main.locator('tbody tr').filter({ hasText: R.load }).first();
            if (await row.isVisible().catch(() => false)) {
              await row.click(); await k.settle(2500);
              R.ncrUrl = new URL(page.url()).pathname; R.ncrText = clean(await main.innerText()); R.ncr = (R.ncrText.match(/NCR-\d+/) || [])[0];
            }
          }
          s.observe(`NCR ${R.ncr || 'none yet'}`);
        }, { critical: true });
        await receiveAndNcr(s);
      });
    }

    // ================================ Inventory panel of the material ================================
    const panel = () => page.locator('div.fixed.inset-0').filter({ hasText: /record an activity/i }).last();
    const openInventoryPanel = async () => {
      await page.keyboard.press('Escape').catch(() => null);
      await k.menu('Procurement Log').catch(() => page.goto('/procurement-log', { waitUntil: 'domcontentloaded' }));
      await k.settle(2000); await k.keepSite().catch(() => null); await k.settle(1500);
      await page.getByRole('tab', { name: 'Inventory', exact: true }).or(page.getByRole('button', { name: 'Inventory', exact: true })).first().click();
      await expect(main.getByPlaceholder('Search material, location, submittal…')).toBeVisible({ timeout: 30000 });
      await expect(main.getByText(/Loading inventory/i)).toBeHidden({ timeout: 90000 }); await k.settle(1500);
      const row = main.locator('div.grid:not(:has(div.grid))').filter({ hasText: MATERIAL }).filter({ has: page.getByRole('button', { name: 'Issue', exact: true }) }).first();
      R.gridRow = clean(await row.innerText());
      await row.getByRole('button', { name: 'Issue', exact: true }).click();
      await expect(panel()).toBeVisible({ timeout: 20000 }); await k.settle(2500);
      return clean(await panel().innerText());
    };
    // History entries: "<date> Received into stock <location> +100 Pounds 10:45 PM Receipt RCV-000002 Submittal 324732 …".
    const historyEntries = text => (((text.match(/History[\s\S]*/i) || [''])[0]).split(/(?=Received into stock|Issued to construction|Moved|Returned|Loss|Added|Put on hold|Hold)/)).map(clean).filter(e => /[+−-]\s?[\d,.]+ \w+/.test(e));

    // Gap 9 (Medium): "Oldest item used on loads; item units and base units mix". White_Cement: UoM Pounds, item
    // "White Cement" = 25 Pounds. The quantities of one receipt must be in one unit (or converted) everywhere.
    await run.scenario(meta('DG-GAP-09', 'Loads', 'Units of a material whose item conversion is 25: load, receipt, component and stock agree (dev review gap 9)', 'Integration'), async s => {
      await s.step(`Record the run quantities: open line, load line, receive form, submittal page and the stock entry of ${R.rcv || 'the receipt'}`, async () => {
        s.observe(`open line: ${R.openLine || '(reused)'}`); s.observe(`load line: ${R.loadLine}`); s.observe(`receive form: ${R.receiveRow || '(reused)'}`);
        await k.openLog(); await k.search(R.sub); await k.settle(2500);
        await main.getByRole('cell', { name: R.sub, exact: true }).first().click().catch(() => main.getByText(TAG).first().click());
        await page.waitForURL(/[?&]submittal=/, { timeout: 30000 }); await k.settle(5000);
        R.subPage = clean(await main.innerText()); s.observe(`submittal: ${(R.subPage.match(/[\d,]+ \w+ required[^]{0,200}/) || [R.subPage.slice(0, 300)])[0]}`);
        const t = await openInventoryPanel();
        R.panel = t;
        R.entry = historyEntries(t).find(e => R.rcv && e.includes(R.rcv));
        s.observe(`stock entry of ${R.rcv}: ${R.entry || '(none)'}`);
        expect(R.entry, `a "Received into stock" entry for ${R.rcv}`).toBeTruthy();
      }, { critical: true });
      await s.step(`Compare: stock added (base unit) = items × 25, and it matches what the load received (${RECEIVED}, ${DAMAGED} damaged) in the load's unit`, async () => {
        const base = num((R.entry.match(/\+\s?([\d,.]+)\s+\w+/) || [])[1]);
        const items = num((R.entry.match(/([\d,.]+)\s*×\s*White Cement/) || [])[1]);
        const loadUnit = (R.loadLine.match(/\b(Pounds|White Cement|Items?|Bags?)\b/i) || [])[1] || '(not shown)';
        s.observe(`load unit ${loadUnit}; stock +${base} Pounds as ${items} × White Cement (conversion 25)`);
        const consistent = items * 25 === base && (base === RECEIVED || base === RECEIVED - DAMAGED || items === RECEIVED || items === RECEIVED - DAMAGED);
        // A load counted in Pounds whose receipt only fits once the schedule is 25 times larger is the same mix.
        const block = R.gap9Block || process.env.SCP_DG_GAP9_BLOCK || '';
        s.observe(`first receipt on the 10-Pound schedule: ${block ? `refused – "${block}"` : 'accepted'}`);
        expect(!block && consistent, block
          ? `The load counts ${QTY} Pounds, but receiving ${RECEIVED} (${DAMAGED} damaged) on a 10-Pound schedule was refused: "${block}" – the receipt is multiplied by the item conversion (25) while the load is in Pounds (gap 9)`
          : `stock entry "${R.entry}" does not match ${RECEIVED} received (${DAMAGED} damaged) at 25 Pounds per item: item and base units are mixed (gap 9)`).toBe(true);
      });
    });

    // Gap 17 (Low): "Line history finds moves by component and date, not by delivery". The stock entry of the run receipt
    // must name that receipt (and its load), with the receipt's own quantity.
    await run.scenario(meta('DG-GAP-17', 'Inventory', 'Stock history names the delivery (receipt / load) of each movement (dev review gap 17)', 'Integration'), async s => {
      await s.step(`Inventory › ${MATERIAL} › History → the entry of ${R.rcv} names ${R.rcv}${R.load ? ` and ${R.load}` : ''}`, async () => {
        const t = R.panel || await openInventoryPanel();
        const entries = historyEntries(t); s.observe(`entries: ${entries.slice(0, 6).join(' ¦ ')}`);
        const entry = entries.find(e => e.includes(R.rcv));
        expect(entry, `no history entry names ${R.rcv}`).toBeTruthy();
        s.observe(`names the load: ${entry.includes(R.load)}; names the submittal: ${entry.includes(R.sub)}`);
        expect(entry.includes(R.load) || entry.includes(R.sub), `the entry of ${R.rcv} names neither ${R.load} nor ${R.sub}`).toBe(true);
      });
    });

    // Gap 1 (High): "An NCR hold does not touch stock; held material can still be issued or moved". Read-only: the Issue
    // form is filled with the run schedule's whole received quantity (the NCR holds 1) and checked, never recorded.
    await run.scenario(meta('DG-GAP-01', 'Inventory', 'Material on NCR hold cannot be issued: stock shows the hold and Issue refuses the held quantity (dev review gap 1)', 'Negative'), async s => {
      await s.step(`NCR ${R.ncr} → on hold`, async () => {
        await go(R.ncrUrl); R.ncrText = clean(await main.innerText());
        R.hold = (R.ncrText.match(/(\d+) (\w+(?: \w+)?) on hold/) || []); s.observe(`NCR: ${R.hold[0] || R.ncrText.slice(0, 200)}`);
        expect(R.hold[0], 'the NCR shows a quantity on hold').toBeTruthy();
      }, { critical: true });
      await s.step(`Inventory › ${MATERIAL} panel → the held quantity is shown (on hold / quarantined / not available)`, async () => {
        const t = await openInventoryPanel();
        const head = t.split(/RECORD AN ACTIVITY/i)[0];
        s.observe(`grid row: ${R.gridRow}`); s.observe(`panel head: ${head}`);
        R.holdShown = /hold|NCR|quarantin|not available|blocked/i.test(head + ' ' + R.gridRow);
        s.observe(`hold shown in stock: ${R.holdShown}`);
      });
      await s.step(`Issue form: item White Cement, from ${R.location || 'the receipt location'}, submittal ${R.sub}, its schedule, quantity = whole receipt incl. the held piece → refused or warned (NOT recorded: Cancel)`, async () => {
        const p = panel();
        const sel = ph => p.locator('select').filter({ has: page.locator('option', { hasText: ph }) }).first();
        const opts = async el => (await el.locator('option').allInnerTexts()).map(clean);
        await sel('Choose an item').selectOption({ label: 'White Cement' }).catch(() => null);
        const from = sel('Choose a location'); const fo = await opts(from);
        const want = fo.find(o => R.location && o.startsWith(R.location)) || fo.find(o => !/Choose/.test(o) && !/— 0 /.test(o));
        if (want) await from.selectOption({ label: want });
        const subSel = sel('Choose a submittal'); const so = await opts(subSel); s.observe(`submittals offered: ${so.join(', ')}`);
        const mine = so.find(o => o.includes(R.sub)); expect(mine, `${R.sub} offered on the Issue form`).toBeTruthy();
        await subSel.selectOption({ label: mine }); await k.settle(1500);
        const sch = p.locator('select').filter({ has: page.locator('option', { hasText: /Choose a schedule/ }) }).first();
        const sco = (await opts(sch)).filter(o => !/Choose/.test(o)); s.observe(`schedules: ${sco.join(', ')}`);
        if (sco.length) await sch.selectOption({ label: sco[0] });
        await k.settle(1000);
        // The whole receipt in the form's unit: base quantity of the stock entry, or items when the form counts items.
        const base = num(((R.entry || '').match(/\+\s?([\d,.]+)\s+\w+/) || [])[1]);
        const qty = Number.isFinite(base) && base > 0 ? base : RECEIVED;
        await p.getByRole('spinbutton').first().fill(String(qty)); await k.settle(1500);
        const formText = clean(await p.innerText());
        const msg = (formText.match(/[^.]*(hold|NCR|not available|exceed|more than|only \d+)[^.]*\./i) || [])[0] || '';
        const submit = p.getByRole('button', { name: /^Record issue/i }).first();
        const enabled = await submit.isEnabled().catch(() => false);
        s.observe(`quantity ${qty} (whole receipt; NCR holds ${R.hold[1] || '?'}); "Record issue" ${enabled ? 'enabled' : 'disabled'}; message: ${msg || '(none)'}`);
        await p.getByRole('button', { name: 'Cancel', exact: true }).first().click().catch(() => null);
        expect(R.holdShown || !enabled || !!msg, `${R.ncr} holds ${R.hold[0] || 'material'}, yet the stock shows no hold and "Record issue" accepts the whole receipt without a message (gap 1)`).toBe(true);
      });
    });

    // Gap 14 (Low): "CSI division from spec section (routing) vs category (FDI grouping)". The run submittal's spec section
    // is Div 32; White_Cement's category "Cements" is Division 34. Routing and grouping should use the same division.
    await run.scenario(meta('DG-GAP-14', 'NCRs', 'NCR routing and FDI grouping use the same CSI division when the spec section and the category differ (dev review gap 14)', 'Integration'), async s => {
      await s.step(`Material Category › "Cements" → its division`, async () => {
        await k.menu('Material Category', 'Materials'); await k.settle(4000);
        const t = clean(await main.innerText());
        R.catDiv = ((t.match(/Cements (\d{2}) · /) || [])[1]); s.observe(`Cements → Division ${R.catDiv}`);
        expect(R.catDiv).toBeTruthy();
      });
      await s.step(`NCR ${R.ncr} → CSI division it is routed by (spec section ${SPEC})`, async () => {
        await go(R.ncrUrl); const t = clean(await main.innerText());
        R.ncrDiv = ((t.match(/\bDiv(?:ision)?\.?\s*(\d{2})\b/i) || [])[1]);
        if (!R.ncrDiv) {
          await go('/ncrs'); const grp = main.getByText(/GC project managers by CSI division/).first();
          await grp.click().catch(() => null); await k.settle(2000);
          const g = clean(await main.innerText()); s.observe(`NCR list groups: ${(g.match(/GC project managers by CSI division[^]{0,600}/) || [''])[0]}`);
          R.ncrDiv = ((g.match(/GC project managers by CSI division[^]{0,600}?\b(?:Div(?:ision)?\.?\s*)(\d{2})\b/i) || [])[1]);
        }
        s.observe(`${R.ncr}: division ${R.ncrDiv || '(not shown)'}; NCR text: ${t.slice(0, 400)}`);
      });
      await s.step(`First Delivery Inspections › "Group by material category" › ${R.sub} → the run inspection is grouped under its category`, async () => {
        await go('/first-delivery-inspections');
        const grp = main.getByRole('checkbox', { name: /Group by material category/i }).first();
        if (!(await grp.isChecked().catch(() => true))) { await grp.click(); await k.settle(2500); }
        const box = main.locator('input[type="search"]').first();
        await box.fill(R.sub).catch(() => null); await box.press('Enter').catch(() => null); await k.settle(4000);
        const t = clean(await main.innerText()); R.fdiText = t;
        s.observe(`FDI (grouped, ${R.sub}): ${(t.match(/(?:INSPECTIONS|Collapse all)[^]{0,700}/) || [t.slice(0, 700)])[0]}`);
      });
      await s.step(`Same division for routing and grouping: NCR division (${'spec section'}) = category division (${'Cements'})`, async () => {
        s.observe(`NCR division ${R.ncrDiv || '(not shown)'} · spec section ${SPEC} (Div ${SPEC.slice(0, 2)}) · category Cements Division ${R.catDiv}`);
        expect(R.ncrDiv, 'the NCR shows no CSI division').toBeTruthy();
        expect(R.ncrDiv, `NCR routed by Division ${R.ncrDiv} (spec section) while the FDI groups the material under Cements, Division ${R.catDiv} (gap 14)`).toBe(R.catDiv);
      });
    });
  } });
});
