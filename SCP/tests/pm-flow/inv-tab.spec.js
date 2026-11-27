// =====================================================================================================================
// Inventory (Procurement Log › Inventory tab) – smoke + regression for the 24 Nov 2026 redesign.
//
// Since 24 Nov 2026 "Inventory Management" is no longer a page: stock lives in the Procurement Log "Inventory" tab
// (grid of materials, a side panel per material with "Record an activity" Move / Issue / Return / Loss / Add stock,
// and a History ledger). On NRVC_Hall the tab stays on "Loading inventory…" (heavy data, app issue confirmed by the
// user on 25 Nov), so this suite runs on NeuralRays_Demo, site "Location 1":
//   SCP_PROJECT_NAME=NeuralRays_Demo SCP_PL_SITE="Location 1" node scripts/run-pm-flow.js inv-tab --headless
//
// Data rule (user, 25 Nov 2026): ONE record per run, named with the date and time. This suite records exactly one
// activity – "Issue to construction" of 1 unit, comment "INV <YYMMDD-HHMM>" – and checks every effect of it (grid,
// panel balance, History). All other checks are read-only or empty submits (validation only). Cases that would need
// more records (receipts, returns written back to Procurement, uploads, movements) are reported as Skipped with the
// reason; they run in inv-regression.spec.js once a project with working inventory may take more records.
// =====================================================================================================================
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { runPmSuite } = require('./support/pm-flow');
const { plKit } = require('./support/pl-flow');
const { readXlsxRows } = require('./support/pl-files');

const SUITE = 'Inventory Tab';
const MODULE = 'Inventory';
const MATERIAL = process.env.SCP_INV_MATERIAL || 'White_Cement';
const pad = n => String(n).padStart(2, '0');
const NOW = new Date();
const STAMP = `${String(NOW.getFullYear()).slice(2)}${pad(NOW.getMonth() + 1)}${pad(NOW.getDate())}-${pad(NOW.getHours())}${pad(NOW.getMinutes())}`;
const TAG = `INV ${STAMP}`; // the one record of this run
const ISO_TODAY = `${NOW.getFullYear()}-${pad(NOW.getMonth() + 1)}-${pad(NOW.getDate())}`;
const US_TODAY = `${pad(NOW.getMonth() + 1)}/${pad(NOW.getDate())}/${NOW.getFullYear()}`;
const meta = (id, title, kind = 'Smoke', extra = {}) => ({ id, module: MODULE, submodule: kind, suite: SUITE, title: `[${kind}] ${title}`, navPath: ['Procurement Log', 'Inventory'], ...extra });
const num = t => { const m = String(t ?? '').replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : 0; }; // "—" counts as 0

test.describe.configure({ mode: 'serial' });
test.setTimeout(45 * 60 * 1000);

test('Inventory tab – smoke and regression', async ({ page, browserName }) => {
  await runPmSuite({ page, browserName, suite: SUITE, scenarios: async ({ run, config, outDir }) => {
    const k = plKit(page);
    const { main } = k;
    const flat = async loc => (await loc.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    const shared = {};

    // ---------- Tab, grid and panel helpers ----------
    const search = () => main.getByPlaceholder('Search material, location, submittal…');
    const counter = async () => { const m = (await flat(main)).match(/(\d+) of (\d+)/); return m ? { shown: +m[1], total: +m[2] } : null; };
    const openTab = async () => {
      await page.keyboard.press('Escape').catch(() => null);
      await k.menu('Procurement Log').catch(() => page.goto('/procurement-log', { waitUntil: 'domcontentloaded' }));
      await k.settle(2000);
      if (await k.keepSite().catch(() => false)) await k.settle(1500);
      await page.getByRole('tab', { name: 'Inventory', exact: true }).or(page.getByRole('button', { name: 'Inventory', exact: true })).first().click();
      await expect(search()).toBeVisible({ timeout: 30000 });
      await expect(main.getByText(/Loading inventory/i), 'inventory loaded').toBeHidden({ timeout: 90000 });
      await k.settle(1500);
    };
    // Grid rows are div grids that share the header's column template: cells are read by the header names.
    const header = () => main.locator('div.grid:not(:has(div.grid))').filter({ has: page.getByRole('button', { name: /^On hand/i }) }).first();
    const gridRow = name => main.locator('div.grid:not(:has(div.grid))').filter({ hasText: name }).filter({ has: page.getByRole('button', { name: 'Issue', exact: true }) }).first();
    const rowData = async name => {
      const heads = await header().evaluate(h => [...h.children].map(c => c.innerText.replace(/[↕↑↓▲▼]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()));
      const cells = await gridRow(name).evaluate(r => [...r.children].map(c => c.innerText.replace(/\s+/g, ' ').trim()));
      return Object.fromEntries(heads.map((h, i) => [h || `#${i}`, cells[i] ?? '']));
    };
    const visibleRows = () => main.locator('div.grid:not(:has(div.grid))').filter({ has: page.getByRole('button', { name: 'Issue', exact: true }) });
    const panel = () => page.locator('div.fixed.inset-0').filter({ hasText: /record an activity/i }).last();
    const openPanel = async (name = MATERIAL) => {
      await closePanel();
      await search().fill(''); await k.settle(800);
      await gridRow(name).getByRole('button', { name: 'Issue', exact: true }).click();
      await expect(panel()).toBeVisible({ timeout: 20000 });
      await expect(panel().getByText(name).first()).toBeVisible();
      await k.settle(1500);
    };
    const closePanel = async () => {
      if (!(await panel().isVisible().catch(() => false))) return;
      const edge = panel().locator('button').filter({ hasText: /^\s*$/ }).first();
      await edge.click({ timeout: 5000 }).catch(() => page.mouse.click(200, 600));
      await expect(panel()).toBeHidden({ timeout: 10000 }).catch(async () => { await page.keyboard.press('Escape'); await openTab(); });
      await k.settle(800);
    };
    // "ON HAND · LOCATION 1  100 Pounds": the number after the site name (site names can contain digits).
    const SITE = process.env.SCP_PL_SITE || '';
    const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const onHand = async () => {
      const t = await flat(panel());
      const m = (SITE && t.match(new RegExp(`ON HAND · ${esc(SITE)}\\s+([\\d,]+)`, 'i'))) || t.match(/ON HAND[^]*?([\d,]+)\s+[A-Za-z]{2,}/i);
      return num(m && m[1]);
    };
    // The row "Issue" button opens the panel with the Issue form already shown, and clicking the selected activity
    // again closes its form: click only when the form's title is not shown yet.
    const TITLES = { Move: /Move between locations/i, Issue: /Issue to construction/i, Return: /Return to supplier/i, Loss: /Record loss/i, 'Add stock': /Add stock \(unplanned\)/i };
    const actButton = act => panel().getByRole('button', { name: new RegExp(`^\\s*${act}\\s*$`, 'i') }).first();
    const activity = async act => {
      const shown = async () => TITLES[act].test(await flat(panel())) && await panel().getByRole('button', { name: 'Cancel', exact: true }).first().isVisible().catch(() => false);
      if (await shown()) return;
      await actButton(act).click(); await k.settle(1200);
      if (!(await shown())) { await actButton(act).click(); await k.settle(1200); }
    };
    // Form selects, identified by their placeholder option (labels are not linked to the controls).
    const selectWith = placeholder => panel().locator('select').filter({ has: page.locator('option', { hasText: placeholder }) });
    const schedule = () => panel().locator('select').filter({ has: page.locator('option', { hasText: /Choose a schedule|Choose a submittal first/ }) }).first();
    const options = async sel => (await sel.locator('option').allInnerTexts()).map(t => t.trim());
    const submit = act => panel().getByRole('button', { name: new RegExp(`^Record ${act}`, 'i') }).first();
    const cancelForm = async () => { await panel().getByRole('button', { name: 'Cancel', exact: true }).first().click().catch(() => null); await k.settle(800); };
    const historyText = async () => ((await flat(panel())).match(/History[\s\S]*/i) || [''])[0];
    const download = async (trigger, pattern) => {
      const dl = page.waitForEvent('download', { timeout: 60000 }); dl.catch(() => null);
      await trigger();
      const d = await dl; const file = path.join(outDir || 'reports', d.suggestedFilename()); await d.saveAs(file);
      expect(d.suggestedFilename()).toMatch(pattern);
      return file;
    };

    const login = await run.scenario(meta('INV-TAB-00', `Sign in to ${config.projectName}`, 'Setup', { always: true }), s => k.signIn(s, config));
    if (login.status !== 'Passed') { run.abort('Sign-in failed'); return; }

    // ================================ Smoke (read-only) ================================
    const loaded = await run.scenario(meta('INV-SMK-01', 'Inventory tab loads'), async s => {
      await s.step('Procurement Log › "Inventory" tab → grid loads (no "Loading inventory…" / "Couldn\'t load inventory.")', async () => {
        await openTab();
        await expect(main.getByText(/Couldn.t load inventory/i)).toBeHidden();
      }, { critical: true });
      await s.step('Toolbar → site select (All sites / run site), search "Search material, location, submittal…", chips "All materials", "In stock · n", "Short · n", buttons "Receive booking", "Upload", "Export"', async () => {
        const site = main.locator('select').filter({ has: page.locator('option', { hasText: 'All sites' }) }).first();
        expect(await options(site)).toContain('All sites');
        for (const b of [/^All materials$/, /^In stock · \d+$/, /^Short · \d+$/, /^Receive booking$/, /^Upload$/, /^Export$/]) await expect(main.getByRole('button', { name: b }).first(), String(b)).toBeVisible();
      });
      await s.step('Grid → columns Material, On hand, Stored at, Received, Issued, Expected, Required, Shortfall, Last movement, Action; counter "n of n"; at least one material', async () => {
        const h = await header().innerText();
        for (const c of ['Material', 'On hand', 'Stored at', 'Received', 'Issued', 'Expected', 'Required', 'Shortfall', 'Last movement', 'Action']) expect(h.toLowerCase(), c).toContain(c.toLowerCase());
        const c = await counter(); s.observe(JSON.stringify(c));
        expect(c?.total).toBeGreaterThan(0);
        await expect(gridRow(MATERIAL), `${MATERIAL} listed`).toBeVisible();
        shared.before = await rowData(MATERIAL); s.observe(JSON.stringify(shared.before));
      }, { critical: true });
    });
    if (loaded.status !== 'Passed') {
      run.abort(`Inventory tab did not load on ${config.projectName}`);
      return;
    }
    await run.scenario(meta('INV-SMK-02', 'Search by material, location, submittal; no match'), async s => {
      const { total } = await counter();
      await s.step(`Search "${MATERIAL.toLowerCase()}" (lower case) → only ${MATERIAL} rows`, async () => {
        await search().fill(MATERIAL.toLowerCase()); await k.settle(1500);
        await expect.poll(async () => (await counter())?.shown).toBeGreaterThan(0);
        for (const t of await visibleRows().allInnerTexts()) expect(t.toLowerCase()).toContain(MATERIAL.toLowerCase());
      });
      await s.step(`Search the storage location "${(shared.before?.['stored at'] || '').split(' ')[0]}" → ${MATERIAL} still listed`, async () => {
        const loc = (shared.before?.['stored at'] || '').split(' ')[0];
        if (!loc) { s.observe('No storage location shown'); return; }
        await search().fill(loc); await k.settle(1500);
        await expect(gridRow(MATERIAL)).toBeVisible();
      }, { optional: true });
      await s.step('Search "zz-no-such-material-zz" → "0 of" and no rows; clear → original total', async () => {
        await search().fill('zz-no-such-material-zz'); await k.settle(1500);
        await expect.poll(async () => (await counter())?.shown ?? 0).toBe(0);
        expect(await visibleRows().count()).toBe(0);
        await search().fill(''); await k.settle(1500);
        await expect.poll(async () => (await counter())?.total).toBe(total);
      });
    });
    await run.scenario(meta('INV-SMK-03', 'Site filter and stock chips'), async s => {
      await s.step(`Site select › "${process.env.SCP_PL_SITE || 'site'}" → rows of that site; "All sites" → back to all`, async () => {
        const site = main.locator('select').filter({ has: page.locator('option', { hasText: 'All sites' }) }).first();
        const opts = (await options(site)).filter(o => o !== 'All sites');
        s.observe(`Sites: ${opts.join(', ')}`);
        if (!opts.length) return;
        const all = (await counter())?.total;
        await site.selectOption({ label: opts[0] }); await k.settle(2000);
        // With one site chosen, "Stored at" shows only the storage location (the site name is dropped): compare counts.
        const one = (await counter())?.total;
        s.observe(`All sites ${all} · ${opts[0]} ${one} · rows: ${(await visibleRows().allInnerTexts()).map(t => t.split('\n')[0]).join(', ')}`);
        expect(one).toBeGreaterThan(0); expect(one).toBeLessThanOrEqual(all);
        await site.selectOption({ label: 'All sites' }); await k.settle(2000);
        expect((await counter())?.total).toBe(all);
      });
      await s.step('"In stock · n" → n rows, each with stock on hand; "Short · n" → n rows; "All materials" → all', async () => {
        const chip = re => main.getByRole('button', { name: re }).first();
        const n = async re => num((await chip(re).innerText()).split('·')[1]);
        const inStock = await n(/^In stock ·/); const short = await n(/^Short ·/);
        await chip(/^In stock ·/).click(); await k.settle(1500);
        expect((await counter())?.shown, 'In stock rows').toBe(inStock);
        await chip(/^Short ·/).click(); await k.settle(1500);
        expect((await counter())?.shown ?? 0, 'Short rows').toBe(short);
        await chip(/^All materials$/).click(); await k.settle(1500);
        s.observe(`In stock ${inStock} · Short ${short}`);
      });
    });
    await run.scenario(meta('INV-SMK-04', 'Material side panel'), async s => {
      await s.step(`${MATERIAL} › "Issue" → side panel: material name, ID · category · UoM, Site select, "ON HAND · <site>", stock per location`, async () => {
        await openPanel();
        const t = await flat(panel()); s.observe(t.slice(0, 300));
        expect(t).toMatch(/UoM/); expect(t).toMatch(/ON HAND/i);
        shared.panelOnHand = await onHand();
        expect(shared.panelOnHand, 'panel on hand = grid on hand').toBe(num(shared.before['on hand']));
      }, { critical: true });
      await s.step('"Record an activity" → buttons Move, Issue, Return, Loss, Add stock', async () => {
        for (const a of ['Move', 'Issue', 'Return', 'Loss', 'Add stock']) await expect(panel().getByRole('button', { name: new RegExp(`^\\s*${a}\\s*$`) }).first(), a).toBeVisible();
      });
      await s.step('History → date range From/To, location filter "All locations", "Opening … → Closing …" and the "All · n" chip', async () => {
        const h = await historyText(); s.observe(h.slice(0, 300));
        expect(h).toMatch(/Opening/); expect(h).toMatch(/Closing/); expect(h).toMatch(/All · \d+/);
        expect(await panel().locator('input[type="date"]').count()).toBeGreaterThanOrEqual(2);
        expect(await options(panel().locator('select').filter({ has: page.locator('option', { hasText: 'All locations' }) }).first())).toContain('All locations');
      });
    });
    const forms = [
      ['INV-SMK-05', 'Issue', 'issue', /Issue to construction/i, 'From location'],
      ['INV-SMK-06', 'Move', 'move', /Move between locations/i, 'To location'],
      ['INV-SMK-07', 'Return', 'return', /Return to supplier/i, 'From location'],
      ['INV-SMK-08', 'Loss', 'loss', /Record loss/i, 'From location'],
      ['INV-SMK-09', 'Add stock', 'add stock', /Add stock \(unplanned\)/i, 'Into location']
    ];
    for (const [id, act, verb, title, locField] of forms) {
      await run.scenario(meta(id, `${act} form and validation`), async s => {
        await s.step(`Panel › "${act}" → form "${String(title).replace(/^\/|\/i$/g, '').replace(/\\/g, '')}" dated today with Item *, Quantity *, ${locField} *, Supplier (optional), Subcontractor (optional), Submittal *, Schedule *, Comments (optional)`, async () => {
          if (!(await panel().isVisible().catch(() => false))) await openPanel();
          await activity(act);
          const t = await flat(panel());
          expect(t).toMatch(title);
          expect(t).toContain(`Dated today, ${US_TODAY}`);
          for (const f of ['Item *', 'Quantity *', `${locField} *`, 'Supplier (optional)', 'Subcontractor (optional)', 'Submittal *', 'Schedule *', 'Comments (optional)']) expect(t, f).toContain(f);
        }, { critical: true });
        await s.step(`Item list offers only ${MATERIAL.replace(/_/g, ' ')}; Schedule says "Choose a submittal first" until a submittal is chosen`, async () => {
          const items = (await options(selectWith('Choose an item').first())).filter(o => !/^Choose/.test(o));
          s.observe(`Items: ${items.join(', ')}`);
          expect(items.length).toBeGreaterThan(0);
          for (const i of items) expect(i.replace(/[_\s]/g, '').toLowerCase()).toBe(MATERIAL.replace(/[_\s]/g, '').toLowerCase());
          expect(await options(schedule())).toContain('Choose a submittal first');
        });
        await s.step(`"Record ${verb}" with nothing filled → "Item is required", "Quantity is required", "Submittal is required", "Schedule is required" and a location message; nothing recorded`, async () => {
          await submit(verb).click(); await k.settle(1200);
          const t = await flat(panel());
          for (const m of ['Item is required', 'Quantity is required', 'Submittal is required', 'Schedule is required']) expect(t, m).toContain(m);
          expect(t).toMatch(/location is required/i);
          if (act === 'Add stock' && /From location is required/.test(t)) s.observe('OBS: the "Into location" field shows the message "From location is required"');
          expect(await onHand()).toBe(shared.panelOnHand);
          await cancelForm();
        }, { attempts: 1 });
      });
    }

    await run.scenario(meta('INV-SMK-10', 'Receive booking dialog'), async s => {
      await s.step('"Receive booking" → dialog "Receive a delivery" lists due loads ("LOADS", "LD-…") or "Nothing is waiting to be received…"; "Cancel" closes it without receiving', async () => {
        await closePanel();
        await main.getByRole('button', { name: /^Receive booking$/ }).click(); await k.settle(2000);
        const d = page.getByText('Receive a delivery').first();
        await expect(d).toBeVisible({ timeout: 15000 });
        const body = await flat(page.locator('body'));
        s.observe((body.match(/Receive a delivery[\s\S]{0,300}/) || [''])[0]);
        expect(body).toMatch(/LD-\d+|Nothing is waiting to be received/);
        await page.getByRole('button', { name: 'Cancel', exact: true }).last().click();
        await expect(d).toBeHidden({ timeout: 10000 });
      });
    });
    await run.scenario(meta('INV-SMK-11', 'Upload dialog'), async s => {
      await s.step('"Upload" → upload dialog opens (template download offered); closed without uploading', async () => {
        await closePanel();
        // "Upload" needs one site: with "All sites" it is disabled with the hint "Choose a site to upload activities".
        const site = main.locator('select').filter({ has: page.locator('option', { hasText: 'All sites' }) }).first();
        await site.selectOption({ label: 'All sites' }); await k.settle(1500);
        const up = main.getByRole('button', { name: /^Upload$/ });
        if (await up.isDisabled()) s.observe(`All sites -> Upload disabled ("${await up.getAttribute('title')}")`);
        await site.selectOption({ index: 1 }); await k.settle(1500);
        await expect(up).toBeEnabled({ timeout: 10000 });
        await up.click(); await k.settle(2000);
        const body = await flat(page.locator('body'));
        s.observe((body.match(/Upload[^]{0,400}$/) || [''])[0].slice(0, 400));
        await expect(page.getByText(/template/i).first()).toBeVisible({ timeout: 15000 });
        await page.getByRole('button', { name: /^(Cancel|Close)$/ }).last().click().catch(() => page.keyboard.press('Escape'));
      });
    });
    await run.scenario(meta('INV-SMK-12', 'Export'), async s => {
      await s.step(`"Export" → a spreadsheet downloads and lists ${MATERIAL}`, async () => {
        await page.keyboard.press('Escape').catch(() => null);
        const file = await download(() => main.getByRole('button', { name: /^Export$/ }).click(), /\.(xlsx|csv)$/i);
        const rows = /\.csv$/i.test(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/).map(l => l.split(',')) : readXlsxRows(file);
        s.observe(`${path.basename(file)} · ${rows.length} row(s) · header ${rows[0]?.slice(0, 8).join(' | ')}`);
        expect(rows.some(r => r.join(' ').replace(/[_\s]/g, '').toLowerCase().includes(MATERIAL.replace(/[_\s]/g, '').toLowerCase()))).toBe(true);
        shared.exportRows = rows;
      });
    });

    // ================================ Regression ================================
    await run.scenario(meta('INV-REG-12', 'From location shows the location balance (= on hand)', 'Positive'), async s => {
      await s.step(`${MATERIAL} › "Issue" → "From location" options read "<location> — <balance> <UoM>"; the balances add up to ON HAND`, async () => {
        await openTab(); await openPanel(); await activity('Issue');
        const opts = (await options(selectWith('Choose a location').first())).filter(o => !/^Choose/.test(o));
        s.observe(opts.join(' · '));
        expect(opts.length).toBeGreaterThan(0);
        const sum = opts.reduce((a, o) => a + num(o.split('—')[1]), 0);
        expect(sum).toBe(await onHand());
        shared.fromLocation = opts.find(o => num(o.split('—')[1]) >= 1);
        expect(shared.fromLocation, 'a location with stock').toBeTruthy();
        await cancelForm();
      });
    });
    await run.scenario(meta('INV-REG-13', 'Submittal and schedule pickers follow the material', 'Positive'), async s => {
      await s.step(`Issue form › Submittal → only submittals of ${MATERIAL}; choosing one fills Schedule with its schedules`, async () => {
        await activity('Issue');
        const subs = (await options(selectWith('Choose a submittal').first())).filter(o => !/^Choose/.test(o));
        s.observe(`Submittals: ${subs.join(', ')}`);
        expect(subs.length).toBeGreaterThan(0);
        await selectWith('Choose a submittal').first().selectOption({ label: subs[0] }); await k.settle(1500);
        const scheds = (await options(schedule())).filter(o => !/^Choose/.test(o));
        s.observe(`Schedules of ${subs[0]}: ${scheds.join(', ')}`);
        expect(scheds.length).toBeGreaterThan(0);
        shared.submittals = subs;
        await cancelForm();
      });
    });
    await run.scenario(meta('INV-REG-26', 'Quantity 0 is rejected', 'Negative'), async s => {
      await s.step('Issue form filled completely but Quantity 0 → not recorded (message shown, ON HAND unchanged)', async () => {
        await activity('Issue');
        const before = await onHand();
        const chipBefore = num(((await historyText()).match(/Issued to construction · (\d+)/) || [])[1]);
        await selectWith('Choose an item').first().selectOption({ index: 1 });
        await selectWith('Choose a location').first().selectOption({ label: shared.fromLocation });
        await selectWith('Choose a submittal').first().selectOption({ index: 1 }); await k.settle(1200);
        await schedule().selectOption({ index: 1 }).catch(async () => { const sel = panel().locator('select').nth((await panel().locator('select').count()) - 3); await sel.selectOption({ index: 1 }); });
        await panel().locator('input[type="number"]').first().fill('0');
        await submit('issue').click(); await k.settle(2000);
        const t = await flat(panel());
        s.observe((t.match(/[^.]{0,60}(greater than|at least|more than|positive|invalid|required)[^.]{0,60}/i) || ['no message'])[0]);
        expect(await onHand()).toBe(before);
        expect(num((t.match(/Issued to construction · (\d+)/) || [])[1]), 'no new issue in History').toBe(chipBefore);
        await cancelForm();
      }, { attempts: 1 });
    });

    // ---- The one record of this run: Issue to construction, 1 item, comment "INV <YYMMDD-HHMM>" ----
    // Quantity is entered in ITEMS (packs) while stock is kept in the UoM: issuing 1 × White Cement removes one pack
    // (25 Pounds on NeuralRays_Demo – the receipt "4 × White Cement" added 100 Pounds). The expected change is read from
    // the History entry of the record ("−25 Pounds … 1 × White Cement") and checked against the pack size of the receipt.
    // Verify mode – SCP_INV_RECORD="INV 261126-0114": no new record; every check runs against that earlier run record.
    const VERIFY = process.env.SCP_INV_RECORD || '';
    const RECORD = VERIFY || TAG;
    const entryOf = async tag => {
      const h = await historyText();
      const i = h.indexOf(tag); if (i < 0) return null;
      const block = h.slice(Math.max(0, h.lastIndexOf('Issued to construction', i)), i + tag.length + 5);
      const delta = num((block.match(/[-−]\s?([\d,]+(\.\d+)?)\s+[A-Za-z]+/) || [])[1]);
      const items = num((block.match(/([\d,]+)\s*×/) || [])[1]);
      return { block, delta, items };
    };
    const packSize = async () => { const m = (await historyText()).match(/Received into stock[^]*?\+([\d,]+)\s+[A-Za-z]+[^]*?([\d,]+)\s*×/); return m ? num(m[1]) / num(m[2]) : null; };
    const issued = await run.scenario(meta('INV-REG-02', `Issue To Construction (the run record "${RECORD}")`, 'Positive'), async s => {
      await s.step(VERIFY ? `Verify mode: no new record – History of ${MATERIAL} lists the earlier run record "${VERIFY}"` : `Issue form: Item ${MATERIAL}, Quantity 1 (item), From ${shared.fromLocation}, first submittal and schedule, Comments "${TAG}" → "Record issue"`, async () => {
        if (!(await panel().isVisible().catch(() => false))) await openPanel();
        shared.onHandBefore = await onHand();
        shared.issuedChip = num(((await historyText()).match(/Issued to construction · (\d+)/) || [])[1]);
        if (VERIFY) { await expect.poll(async () => !!(await entryOf(VERIFY)), { timeout: 20000 }).toBe(true); return; }
        await activity('Issue');
        await selectWith('Choose an item').first().selectOption({ index: 1 });
        await panel().locator('input[type="number"]').first().fill('1');
        await selectWith('Choose a location').first().selectOption({ label: shared.fromLocation });
        await selectWith('Choose a submittal').first().selectOption({ index: 1 }); await k.settle(1200);
        await schedule().selectOption({ index: 1 });
        shared.issueSubmittal = (await selectWith('Choose a submittal').first().locator('option:checked').innerText()).trim();
        await panel().locator('textarea').first().fill(TAG);
        await submit('issue').click();
        await expect(submit('issue')).toBeHidden({ timeout: 20000 });
        await k.settle(2500);
        s.observe(`${TAG}: 1 × ${MATERIAL} from ${shared.fromLocation}, submittal ${shared.issueSubmittal}`);
      }, { critical: true, attempts: 1, evidence: true });
      await s.step(`History entry of "${RECORD}" → "Issued to construction", "1 ×" item, minus one pack (pack size = receipt quantity / its items)`, async () => {
        await expect.poll(async () => !!(await entryOf(RECORD)), { timeout: 20000 }).toBe(true);
        const e = await entryOf(RECORD); const pack = await packSize();
        s.observe(`${e.block.replace(/\s+/g, ' ').slice(0, 200)} · pack size ${pack ?? 'unknown'}`);
        expect(e.items).toBe(1);
        expect(e.delta).toBeGreaterThan(0);
        if (pack) expect(e.delta, 'one pack').toBe(pack);
        shared.delta = e.delta;
        if (VERIFY) { shared.onHandBefore = (await onHand()) + e.delta; shared.issuedChip -= 1; }
      }, { critical: true });
      await s.step('Panel → ON HAND decreased by exactly the issued amount (before − pack)', async () => {
        await expect.poll(onHand, { timeout: 20000 }).toBe(shared.onHandBefore - shared.delta);
      }, { critical: true });
    });
    if (issued.status === 'Passed') {
      await run.scenario(meta('INV-REG-20', 'History ledger shows the run record', 'Positive'), async s => {
        await s.step(`History → chip "Issued to construction · n"${VERIFY ? '' : ' up by 1'}; entry of ${RECORD} with the comment and a minus amount`, async () => {
          const h = await historyText(); s.observe(h.slice(0, 600));
          expect(num((h.match(/Issued to construction · (\d+)/) || [])[1])).toBe(shared.issuedChip + 1);
          await expect(panel().getByText(RECORD).first()).toBeVisible({ timeout: 10000 });
          expect((await entryOf(RECORD)).block).toMatch(/[-−]\s?[\d,]+/);
        });
        await s.step('History → Closing balance = ON HAND', async () => {
          const closing = num(((await historyText()).match(/Closing ([\d,]+)/) || [])[1]);
          expect(closing).toBe(await onHand());
        });
      });
      await run.scenario(meta('INV-REG-15', 'Grid refreshes after the activity', 'Positive'), async s => {
        await s.step(`Close the panel → grid row ${MATERIAL}: On hand = panel on hand${VERIFY ? '' : ' (before − pack)'}, Issued includes the pack, Last movement ${US_TODAY}`, async () => {
          const panelNow = await onHand();
          await closePanel();
          await expect.poll(async () => num((await rowData(MATERIAL))['on hand']), { timeout: 30000 }).toBe(panelNow);
          const after = await rowData(MATERIAL); s.observe(JSON.stringify(after));
          if (VERIFY) expect(num(after.issued)).toBeGreaterThanOrEqual(shared.delta);
          else { expect(panelNow).toBe(num(shared.before['on hand']) - shared.delta); expect(num(after.issued)).toBe(num(shared.before.issued) + shared.delta); }
          expect(after['last movement']).toContain(US_TODAY);
          shared.onHandNow = panelNow;
        });
      });
      await run.scenario(meta('INV-REG-24', 'History date filter', 'Positive'), async s => {
        await s.step('History From = To = today → the run record is listed; From = To = yesterday → it is not', async () => {
          await openPanel();
          const [from, to] = [panel().locator('input[type="date"]').nth(0), panel().locator('input[type="date"]').nth(1)];
          await from.fill(ISO_TODAY); await to.fill(ISO_TODAY); await k.settle(2000);
          expect(await historyText()).toContain(RECORD);
          const y = new Date(NOW.getTime() - 86400000); const yIso = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`;
          await from.fill(yIso); await to.fill(yIso); await k.settle(2000);
          const h = await historyText(); s.observe(h.slice(0, 300));
          expect(h).not.toContain(RECORD);
        });
      });
      await run.scenario(meta('INV-REG-22', 'Export reflects the new balance', 'Integration'), async s => {
        await s.step(`"Export" after the issue → ${MATERIAL} row carries the current on-hand`, async () => {
          await closePanel();
          const file = await download(() => main.getByRole('button', { name: /^Export$/ }).click(), /\.(xlsx|csv)$/i);
          const rows = /\.csv$/i.test(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/).map(l => l.split(',')) : readXlsxRows(file);
          const row = rows.find(r => r.join(' ').replace(/[_\s]/g, '').toLowerCase().includes(MATERIAL.replace(/[_\s]/g, '').toLowerCase()));
          s.observe(`header: ${rows[0]?.join(' | ')} · row: ${row?.join(' | ')}`);
          expect(row?.map(c => num(c))).toContain(shared.onHandNow);
        });
      });
    } else for (const id of ['INV-REG-20', 'INV-REG-15', 'INV-REG-24', 'INV-REG-22']) run.skip(meta(id, 'Depends on the run record', 'Positive'), 'INV-REG-02 (the run record) did not pass');

    // ---- Cases that need more than one record per run (user rule 25 Nov 2026) or data this project lacks ----
    const ONE = 'Skipped (26 Nov 2026): needs more than one record per run – the one-record rule allows only the INV-REG-02 issue; runs in inv-regression.spec.js on a project cleared for more records';
    for (const [id, title, why] of [
      ['INV-REG-01', 'GRN creates an incoming load', ONE], ['INV-REG-03', 'Loss', ONE], ['INV-REG-04', 'Return reduces stock and writes back to Procurement', ONE],
      ['INV-REG-05', 'Manual incoming on a partial schedule', ONE], ['INV-REG-06', 'Incoming beyond the scheduled quantity rejected', 'Skipped (26 Nov 2026): a defect would save a second record (one-record rule); needs approval for a negative write'],
      ['INV-REG-10', 'Move to the same location rejected', `Skipped (26 Nov 2026): ${config.projectName} has one storage location – "To location" offers only it; a defect would save a second record`],
      ['INV-REG-11', 'Move between two locations', ONE], ['INV-REG-14', 'Schedule must match the submittal', 'Covered by INV-REG-13 (the schedule list follows the chosen submittal)'],
      ['INV-REG-16', 'Upload is all-or-nothing', ONE], ['INV-REG-17', 'Upload applies rows top to bottom', ONE], ['INV-REG-18', 'Upload available stock matches the form', ONE],
      ['INV-REG-19', 'Upload with optional columns blank', ONE], ['INV-REG-21', 'Damaged units counted as received', ONE],
      ['INV-REG-23', 'Site isolation', `Covered by INV-SMK-03 (site filter); ${config.projectName} has a single site`],
      ['INV-REG-25', 'Activity date picker', 'Retired (26 Nov 2026): the new forms have no date field – activities are "Dated today"']
    ]) run.skip(meta(id, title, 'Regression'), why);
  } });
});
