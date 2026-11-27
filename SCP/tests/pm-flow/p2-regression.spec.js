// =====================================================================================================================
// P2 modules regression – redesigned features of the 24 Nov 2026 build (Phase 4 of ROADMAP_V2_2026-12-04).
// Document Management (All Documents "View Data", EPD Report KPI cards / Parse / upload gate, Spec Section No dialog),
// EPD Tracker, International Shipments (tabs and their counts), Enterprise Shipments (counter, filters, alert cards,
// Log Shipment form) and Analytics › Aggregate Stats (12 KPI cards, pipeline, value, presets, needs attention).
// Source: docs/functional-discovery/APP_WALKTHROUGH_2026-11-24.md and the read-only probe of 26 Nov 2026.
// Read-only: forms and dialogs are opened and closed without saving; no setting is saved, nothing is flagged or parsed.
// Most checks compare two numbers the page shows for the same thing (a counter against the rows, a card against a sum).
// Run: node scripts/run-pm-flow.js p2 --headless
// =====================================================================================================================
const { test, expect } = require('@playwright/test');
const { runPmSuite } = require('./support/pm-flow');
const { plKit } = require('./support/pl-flow');

const SUITE = 'P2 Regression';
const meta = (id, module, title, type, extra = {}) => ({ id, module, submodule: 'Regression', suite: SUITE, title: `[${type}] ${title}`, navPath: [module], ...extra });
const num = t => { const m = String(t ?? '').replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : NaN; };
const pad = n => String(n).padStart(2, '0');

test.describe.configure({ mode: 'serial' });
test.setTimeout(90 * 60 * 1000);

test('P2 modules – regression', async ({ page, browserName }) => {
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
    // Rows of a table as arrays of cell texts, plus its header names (lower case, sort arrows removed).
    const grid = async table => ({
      head: (await table.locator('th').allInnerTexts()).map(t => t.replace(/[↕↑↓▲▼]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()),
      rows: await table.locator('tbody tr').evaluateAll(list => list.map(r => [...r.cells].map(c => c.innerText.replace(/\s+/g, ' ').trim())).filter(c => c.length > 1)),
    });
    const colOf = (head, re) => head.findIndex(h => re.test(h));
    const tableWith = header => main.locator('table').filter({ has: page.getByRole('columnheader', { name: header }) }).first();

    const login = await run.scenario(meta('P2-REG-00', 'Login', `Sign in to ${config.projectName}`, 'Setup', { always: true }), s => k.signIn(s, config));
    if (login.status !== 'Passed') { run.abort('Sign-in failed'); return; }

    // =============================== Document Management ===============================
    const DOC = 'Document Management';
    const docs = async () => { await open('/all-documents', 'All Documents', DOC, 2500); await expect(main.getByText(/document\(s\) across this project/).first()).toBeVisible({ timeout: 30000 }); };
    const category = async label => { await main.locator('select').first().selectOption({ label }); await k.settle(2500); };
    const docCount = async () => num(((await flat()).match(/([\d,]+) document\(s\) across this project/) || [])[1]);
    const shared = {};

    await run.scenario(meta('DOC-REG-17', DOC, 'Category filter lists the new categories', 'Positive', { navPath: [DOC, 'All Documents'] }), async s => {
      await s.step('All Documents › category select → All Categories and Components, Delivery Photo, EPD, Inventory, Invoice, Materials, Pdf, PO File, PO Validation, Sites, Submittals, Supplier Material Mapping, Suppliers', async () => {
        await docs();
        const options = (await main.locator('select').first().locator('option').allInnerTexts()).map(t => t.trim());
        s.observe(options.join(', '));
        for (const o of ['All Categories', 'Components', 'Delivery Photo', 'EPD', 'Inventory', 'Invoice', 'Materials', 'Pdf', 'PO File', 'PO Validation', 'Sites', 'Submittals', 'Supplier Material Mapping', 'Suppliers']) expect(options, `category "${o}"`).toContain(o);
      }, { critical: true });
    });

    await run.scenario(meta('DOC-REG-18', DOC, '"View Data" shows the parsed EPD data', 'Positive', { navPath: [DOC, 'All Documents'] }), async s => {
      await s.step('Category "EPD" → every row is category EPD and offers View, Download and View Data; the counter equals the rows', async () => {
        await docs(); await category('EPD');
        const g = await grid(tableWith('Filename'));
        const cat = colOf(g.head, /^category/);
        shared.epdDocs = await docCount(); shared.epdFiles = g.rows.map(r => r[0]);
        s.observe(`${shared.epdDocs} document(s), ${g.rows.length} row(s)`);
        expect(g.rows.length).toBeGreaterThan(0);
        expect(g.rows.filter(r => r[cat] !== 'EPD'), 'rows of another category').toEqual([]);
        expect(g.rows.length, 'rows = counter (one page)').toBe(shared.epdDocs);
        const actions = await tableWith('Filename').locator('tbody tr').first().getByRole('button').allInnerTexts();
        for (const a of ['View', 'Download', 'View Data']) expect(actions.map(t => t.trim()), a).toContain(a);
      }, { critical: true });
      await s.step('First row "View Data" → "EPD Parsed Data" with Product, Manufacturer, GWP A1-A3, GWP Total, Declared Unit, EPD Type, Parse Status; the button reads "Hide Data"; "Hide Data" closes it', async () => {
        const row = tableWith('Filename').locator('tbody tr').first();
        await row.getByRole('button', { name: 'View Data', exact: true }).click(); await k.settle(2000);
        await expect(main.getByText('EPD Parsed Data').first()).toBeVisible({ timeout: 20000 });
        const t = await flat();
        for (const f of ['PRODUCT', 'MANUFACTURER', 'GWP A1-A3', 'GWP TOTAL', 'DECLARED UNIT', 'EPD TYPE', 'PARSE STATUS']) expect(t.toUpperCase(), f).toContain(f);
        shared.viewDataStatus = ((t.match(/PARSE STATUS (\w+)/i) || [])[1] || '').toLowerCase();
        s.observe(`${shared.epdFiles[0]}: parse status ${shared.viewDataStatus}`);
        await row.getByRole('button', { name: 'Hide Data', exact: true }).click(); await k.settle(1500);
        await expect(main.getByText('EPD Parsed Data')).toHaveCount(0);
      });
    });

    const EPDR = 'EPD Report';
    const epdReport = async () => { await open('/epd-report', EPDR, DOC, 2500); await expect(main.getByText('Total EPDs').first()).toBeVisible({ timeout: 30000 }); await k.settle(1500); };
    const kpi = async label => num(((await flat()).match(new RegExp(`([\\d,.]+) ${label}`)) || [])[1]);
    const records = async () => grid(tableWith('STATUS'));
    await run.scenario(meta('DOC-REG-19', DOC, 'EPD Report "Total EPDs" equals the EPD records and the EPD documents', 'Integration', { navPath: [DOC, EPDR] }), async s => {
      await s.step('EPD Report → "Total EPDs" = rows of EPD Records = All Documents › EPD "N document(s)"', async () => {
        await epdReport();
        const total = await kpi('Total EPDs'); const g = await records();
        s.observe(`Total EPDs ${total}, records ${g.rows.length}, All Documents EPD ${shared.epdDocs ?? '–'}`);
        expect(g.rows.length, 'records = Total EPDs').toBe(total);
        if (shared.epdDocs !== undefined) expect(shared.epdDocs, 'All Documents EPD = Total EPDs').toBe(total);
      }, { critical: true });
    });
    await run.scenario(meta('DOC-REG-20', DOC, 'EPD Report "Parsed" and the Parse action follow the record status', 'Positive', { navPath: [DOC, EPDR] }), async s => {
      await s.step('"Parsed" = records with status Completed; every Failed record offers "Parse", no Completed record does', async () => {
        await epdReport();
        const parsed = await kpi('Parsed'); const g = await records(); const st = colOf(g.head, /^status/i);
        const statuses = g.rows.map(r => r[st]);
        const by = statuses.reduce((a, v) => (a[v] = (a[v] || 0) + 1, a), {});
        s.observe(`Parsed ${parsed}; statuses ${JSON.stringify(by)}`);
        expect(statuses.filter(v => /^completed$/i.test(v)).length, 'Completed = Parsed').toBe(parsed);
        const rows = tableWith('STATUS').locator('tbody tr');
        for (let i = 0; i < g.rows.length; i++) {
          const hasParse = await rows.nth(i).getByRole('button', { name: 'Parse', exact: true }).count();
          if (/^failed$/i.test(statuses[i])) expect(hasParse, `${g.rows[i][1]} (Failed) offers Parse`).toBeGreaterThan(0);
          if (/^completed$/i.test(statuses[i])) expect(hasParse, `${g.rows[i][1]} (Completed) has no Parse`).toBe(0);
        }
      });
    });
    await run.scenario(meta('DOC-REG-21', DOC, 'EPD Report GWP cards equal the sum of the records', 'Integration', { navPath: [DOC, EPDR] }), async s => {
      await s.step('"A1-A3 (kg CO2e)" = sum of GWP A1-A3; "Total GWP (kg CO2e)" = sum of GWP TOTAL ("--" counts as 0)', async () => {
        await epdReport();
        const g = await records();
        const sum = re => g.rows.reduce((a, r) => a + (Number.isFinite(num(r[colOf(g.head, re)])) ? num(r[colOf(g.head, re)]) : 0), 0);
        const [a13, tot] = [await kpi('A1-A3 \\(kg CO2e\\)'), await kpi('Total GWP \\(kg CO2e\\)')];
        s.observe(`cards A1-A3 ${a13}, Total ${tot}; sums ${sum(/a1-a3/i)}, ${sum(/gwp total/i)}`);
        expect(Math.abs(sum(/a1-a3/i) - a13), 'A1-A3').toBeLessThan(1);
        expect(Math.abs(sum(/gwp total/i) - tot), 'Total GWP').toBeLessThan(1);
      });
    });
    await run.scenario(meta('DOC-REG-22', DOC, 'EPD upload is closed until a submittal is chosen', 'Negative', { navPath: [DOC, EPDR] }), async s => {
      const sel = () => main.locator('select').filter({ has: page.locator('option', { hasText: 'Select a submittal...' }) }).first();
      const fileInput = () => main.locator('input[type="file"]');
      // The drop zone keeps its (hidden) file input enabled; the gate is the hint "Select a submittal first" in the zone.
      await s.step('Upload EPD with "Select a submittal..." → the drop zone reads "Select a submittal first"', async () => {
        await epdReport();
        await expect(sel()).toBeVisible();
        expect(await sel().locator('option:checked').innerText()).toMatch(/Select a submittal/);
        await expect(main.getByText(/Select a submittal first/i).first()).toBeVisible();
        s.observe(`file inputs ${await fileInput().count()}, enabled ${await fileInput().evaluateAll(list => list.filter(i => !i.disabled).length)}`);
      });
      await s.step('Choose the first submittal → the drop zone opens (enabled file input, no "Select a submittal first"); choose "Select a submittal..." again (nothing uploaded)', async () => {
        await sel().selectOption({ index: 1 }); await k.settle(1500);
        s.observe(`submittal: ${(await sel().locator('option:checked').innerText()).slice(0, 80)}`);
        await expect(main.getByText(/Select a submittal first/i)).toHaveCount(0, { timeout: 10000 });
        s.observe(`drop zone: ${(await flat()).match(/Upload EPD.{0,200}/)?.[0]?.slice(0, 200)}`);
        await sel().selectOption({ index: 0 }); await k.settle(1000);
      });
    });
    await run.scenario(meta('DOC-REG-23', DOC, 'All Documents "View Data" status matches the EPD Report status', 'Integration', { navPath: [DOC, EPDR] }), async s => {
      await s.step('EPD Report record of the first EPD document → same status as its "View Data" Parse Status', async () => {
        expect(shared.viewDataStatus, 'View Data status from DOC-REG-18').toBeTruthy();
        await epdReport();
        const g = await records(); const st = colOf(g.head, /^status/i);
        const row = g.rows.find(r => r.join(' ').includes(shared.epdFiles[0]));
        s.observe(`${shared.epdFiles[0]}: View Data "${shared.viewDataStatus}", EPD Report "${row?.[st]}"`);
        expect(row, `${shared.epdFiles[0]} in EPD Records`).toBeTruthy();
        expect(row[st].toLowerCase()).toBe(shared.viewDataStatus);
      });
    });
    await run.scenario(meta('DOC-REG-24', DOC, 'Spec Section No is picked from the project submittals', 'Positive', { navPath: [DOC, 'Spec Documents'] }), async s => {
      await s.step('Spec Documents › a row with a Spec Section No › "Edit Spec Section No" → dialog "Spec Section No" with the note "Pulled from this project\'s submittals…" and "Save"; Escape closes it; reload → value unchanged', async () => {
        await open('/spec-documents', 'Spec Documents', DOC, 2500);
        const edit = main.getByRole('button', { name: 'Edit Spec Section No' }).first();
        await expect(edit, 'a row with a Spec Section No').toBeVisible({ timeout: 30000 });
        const row = main.locator('tbody tr').filter({ has: page.getByRole('button', { name: 'Edit Spec Section No' }) }).first();
        const before = (await row.innerText()).replace(/\s+/g, ' ');
        await edit.click(); await k.settle(1500);
        await expect(page.getByText(/Pulled from this project.s submittals/).first()).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole('button', { name: 'Save', exact: true }).first()).toBeVisible();
        s.observe((await page.getByText(/Pulled from this project.s submittals/).first().innerText()).slice(0, 160));
        await page.keyboard.press('Escape'); await k.settle(1000);
        await page.reload({ waitUntil: 'domcontentloaded' }); await k.settle(3000);
        await expect(main.getByRole('button', { name: 'Edit Spec Section No' }).first()).toBeVisible({ timeout: 30000 });
        const after = (await main.locator('tbody tr').filter({ has: page.getByRole('button', { name: 'Edit Spec Section No' }) }).first().innerText()).replace(/\s+/g, ' ');
        expect(after).toBe(before);
      });
    });

    // =============================== EPD Tracker ===============================
    const EPDT = 'EPD Tracker';
    const tracker = async () => { await open('/epd-tracker', EPDT, DOC, 3000); await expect(main.getByRole('button', { name: /^Not required \d/ })).toBeVisible({ timeout: 30000 }); };
    const chips = async () => {
      const out = {};
      for (const t of await main.getByRole('button', { name: /^(Required \(missing\)|Requested|Expiring|Expired|Received|Verified|Not required) [\d,]+$/ }).allInnerTexts()) {
        const m = t.trim().match(/^(.*) ([\d,]+)$/); out[m[1]] = num(m[2]);
      }
      return out;
    };
    const view = label => main.locator('select').first().selectOption({ label });
    const lineTable = () => tableWith('EPD status');
    // The list pages 50 lines at a time ("‹" / "›"): walk forward and count every row.
    const allLines = async () => {
      const rows = [];
      for (let p = 0; p < 60; p++) {
        rows.push(...(await grid(lineTable())).rows);
        const next = main.getByRole('button', { name: 'Next page' }).first(); // "Lines 1–50 of N … « ‹ 1 / 14 › »"
        if (!(await next.count()) || await next.isDisabled().catch(() => true)) break;
        const firstRow = (await lineTable().locator('tbody tr').first().innerText()).trim();
        await next.scrollIntoViewIfNeeded(); await next.click();
        // stop when the page did not change (the last page keeps "›" clickable on some builds)
        const moved = await expect.poll(async () => (await lineTable().locator('tbody tr').first().innerText()).trim() !== firstRow, { timeout: 8000 }).toBe(true).then(() => true, () => false);
        if (!moved) break;
        await k.settle(800);
      }
      return rows;
    };
    await run.scenario(meta('EPD-REG-01', EPDT, 'Status chips add up to "All lines"', 'Integration', { navPath: [DOC, EPDT] }), async s => {
      await s.step('View "All lines" → number of lines (all pages) = Required + Requested + Expiring + Expired + Received + Verified + Not required', async () => {
        await tracker(); const c = await chips();
        await view('All lines'); await k.settle(3000);
        const pager = num(((await flat()).match(/Lines [\d,]+[–-][\d,]+ of ([\d,]+)/) || [])[1]);
        const rows = await allLines();
        const sum = Object.values(c).reduce((a, b) => a + b, 0);
        s.observe(`chips ${JSON.stringify(c)} = ${sum}; pager "of ${pager}"; lines counted on all pages ${rows.length}`);
        expect(pager, 'pager total').toBe(sum);
        expect(rows.length, 'lines on all pages').toBe(sum);
        shared.trackerRows = rows;
      });
    });
    await run.scenario(meta('EPD-REG-02', EPDT, 'View filter shows only lines of that status', 'Positive', { navPath: [DOC, EPDT] }), async s => {
      await s.step('View "Not required" → every line has EPD status "Not required" and their number equals the chip', async () => {
        await tracker(); const c = await chips();
        await view('Not required'); await k.settle(3000);
        const rows = await allLines(); const head = (await grid(lineTable())).head; const st = colOf(head, /^epd status/);
        s.observe(`chip ${c['Not required']}, lines ${rows.length}`);
        expect(rows.filter(r => r[st] !== 'Not required'), 'lines of another status').toEqual([]);
        expect(rows.length).toBe(c['Not required']);
      });
    });
    await run.scenario(meta('EPD-REG-03', EPDT, '"Needs action" is empty when no line needs an EPD', 'Positive', { navPath: [DOC, EPDT] }), async s => {
      await s.step('View "Needs action" → when Required, Requested, Expiring and Expired are all 0: the message "No line needs an EPD yet…"; otherwise only lines of those statuses', async () => {
        await tracker(); const c = await chips();
        await view('Needs action'); await k.settle(3000);
        const need = ['Required (missing)', 'Requested', 'Expiring', 'Expired'].reduce((a, key) => a + (c[key] || 0), 0);
        s.observe(`needing action by the chips: ${need}`);
        if (!need) { await expect(main.getByText(/No line needs an EPD yet/i).first()).toBeVisible({ timeout: 15000 }); return; }
        const rows = await allLines(); const st = colOf((await grid(lineTable())).head, /^epd status/);
        expect(rows.filter(r => /^(Not required|Received|Verified)$/.test(r[st])), 'lines that need no action').toEqual([]);
      });
    });
    await run.scenario(meta('EPD-REG-04', EPDT, 'Search narrows the lines', 'Positive', { navPath: [DOC, EPDT] }), async s => {
      await s.step('View "All lines", search the material of the first line → every line shown contains it, fewer or equal lines than before', async () => {
        await tracker(); await view('All lines'); await k.settle(3000);
        const first = (await grid(lineTable())).rows[0];
        const term = (first[1].split('·').pop() || '').trim();
        await main.getByPlaceholder(/Search submittal, material, trade/).fill(term); await k.settle(3000);
        const rows = await allLines();
        s.observe(`"${term}" → ${rows.length} line(s)`);
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.filter(r => !r.join(' ').toLowerCase().includes(term.toLowerCase())), 'lines without the term').toEqual([]);
        if (shared.trackerRows) expect(rows.length).toBeLessThanOrEqual(shared.trackerRows.length);
      });
    });
    await run.scenario(meta('EPD-REG-05', EPDT, 'Settings: "Save settings" only after a change', 'Negative', { navPath: [DOC, EPDT] }), async s => {
      await s.step('"Settings ▸" → panel with "Material categories that need an EPD", "Find a category" and the due-date numbers; "Save settings" disabled', async () => {
        await tracker();
        await main.getByRole('button', { name: /^Settings/ }).click(); await k.settle(1500);
        await expect(main.getByText(/Material categories that need an EPD/i).first()).toBeVisible({ timeout: 10000 });
        await expect(main.getByPlaceholder(/Find a category/i)).toBeVisible();
        await expect(main.getByRole('button', { name: 'Save settings' })).toBeDisabled();
      });
      await s.step('Change the first number field by +1 → "Save settings" enabled; set it back → disabled again; reload (nothing saved)', async () => {
        const field = main.locator('input[type="number"]').first();
        const was = await field.inputValue();
        await field.fill(String(num(was) + 1)); await k.settle(800);
        const enabled = await main.getByRole('button', { name: 'Save settings' }).isEnabled();
        await field.fill(was); await k.settle(800);
        const back = await main.getByRole('button', { name: 'Save settings' }).isEnabled();
        s.observe(`value ${was}: after change enabled=${enabled}, after restoring enabled=${back}`);
        await page.reload({ waitUntil: 'domcontentloaded' }); await k.settle(2500);
        expect(enabled, 'enabled after a change').toBe(true);
        expect(back, 'disabled again when the value is back').toBe(false);
      });
    });

    // =============================== Enterprise Shipments ===============================
    const SHP = 'International Shipments';
    const ESH = 'Enterprise Shipments';
    const eShip = async () => {
      await open('/enterprise-shipments', ESH, 'Enterprise', 3000);
      await expect(main.getByText(/\d+ shown · \d+ at risk/).first()).toBeVisible({ timeout: 120000 });
      await expect(tableWith('Shipping Line').locator('tbody tr').first()).toBeVisible({ timeout: 60000 }); await k.settle(1500);
    };
    const counter = async () => { const m = (await flat()).match(/(\d+) shown · (\d+) at risk/); return { shown: num(m[1]), risk: num(m[2]) }; };
    const eRows = async () => grid(tableWith('Shipping Line'));
    const atRisk = (g, re = /^at risk$/i) => g.rows.filter(r => re.test(r[colOf(g.head, /^risk/)]));
    await run.scenario(meta('SHP-REG-16', SHP, 'Enterprise Shipments counter equals the rows', 'Positive', { navPath: ['Enterprise', ESH] }), async s => {
      await s.step('"N shown · M at risk" → N = rows of the table, M = rows with Risk "At risk"', async () => {
        await eShip(); const c = await counter(); const g = await eRows();
        shared.eShip = { ...c, rows: g.rows.length, project: g.rows.filter(r => r[0] === config.projectName).length, projectRisk: atRisk(g).filter(r => r[0] === config.projectName).length };
        s.observe(`counter ${c.shown} shown · ${c.risk} at risk; rows ${g.rows.length}, at risk ${atRisk(g).length}; ${config.projectName}: ${shared.eShip.project} rows, ${shared.eShip.projectRisk} at risk`);
        expect(g.rows.length).toBe(c.shown);
        expect(atRisk(g).length).toBe(c.risk);
      }, { critical: true });
    });
    await run.scenario(meta('SHP-REG-17', SHP, '"At-risk only" keeps only rows at risk', 'Positive', { navPath: ['Enterprise', ESH] }), async s => {
      await s.step('Tick "At-risk only" → every row has Risk "At risk"; rows = the earlier "M at risk"; untick → all rows again', async () => {
        await eShip(); const before = await counter();
        const box = main.locator('label', { hasText: 'At-risk only' }).locator('input').or(main.getByRole('checkbox', { name: /At-risk only/ })).first();
        await box.check(); await k.settle(2500);
        const g = await eRows();
        s.observe(`at-risk only: ${g.rows.length} row(s), counter ${JSON.stringify(await counter())}`);
        expect(g.rows.length - atRisk(g).length, 'rows not at risk').toBe(0);
        expect(g.rows.length).toBe(before.risk);
        await box.uncheck(); await k.settle(2500);
        expect((await eRows()).rows.length).toBe(before.shown);
      });
    });
    await run.scenario(meta('SHP-REG-18', SHP, 'Destination filter narrows the rows and the counter', 'Positive', { navPath: ['Enterprise', ESH] }), async s => {
      await s.step('Destination: the first destination after "Any" → every row has that Destination; "N shown" = rows; "M at risk" = rows at risk among them', async () => {
        await eShip();
        const dest = main.locator('select').filter({ has: page.locator('option', { hasText: /^Any$/ }) }).first();
        const label = (await dest.locator('option').allInnerTexts()).map(t => t.trim()).find(t => t !== 'Any');
        await dest.selectOption({ label }); await k.settle(2500);
        const g = await eRows(); const c = await counter(); const d = colOf(g.head, /^destination/);
        s.observe(`${label}: ${g.rows.length} row(s), ${atRisk(g).length} at risk; counter ${c.shown} shown · ${c.risk} at risk`);
        await dest.selectOption({ label: 'Any' }); await k.settle(1500);
        expect(g.rows.filter(r => r[d] !== label), 'rows of another destination').toEqual([]);
        expect(c.shown).toBe(g.rows.length);
        expect(c.risk, '"at risk" counts only the rows shown').toBe(atRisk(g).length);
      });
    });
    await run.scenario(meta('SHP-REG-19', SHP, 'Clicking a delay alert filters the table to its affected rows', 'Positive', { navPath: ['Enterprise', ESH] }), async s => {
      await s.step('Click the first alert card ("N affected") → "Clear alert filter" shown, rows = N; "Clear alert filter" → all rows again', async () => {
        await eShip(); const before = await counter();
        const card = main.getByText(/^\d+ affected$/).first();
        const affected = num(await card.innerText());
        await card.click(); await k.settle(2500);
        await expect(main.getByRole('button', { name: 'Clear alert filter' })).toBeVisible({ timeout: 10000 });
        const rows = (await eRows()).rows.length;
        s.observe(`card "${affected} affected" → ${rows} row(s)`);
        expect(rows).toBe(affected);
        await main.getByRole('button', { name: 'Clear alert filter' }).click(); await k.settle(2000);
        expect((await eRows()).rows.length).toBe(before.shown);
      });
    });
    await run.scenario(meta('SHP-REG-20', SHP, 'Active Delay Alerts are listed once each', 'Negative', { navPath: ['Enterprise', ESH] }), async s => {
      await s.step('Active Delay Alerts → no two cards with the same severity, title and description', async () => {
        await eShip();
        const cards = await main.getByText(/^\d+ affected$/).evaluateAll(list => list.map(e => { let c = e; for (let i = 0; i < 6 && c.parentElement && !/CRITICAL|HIGH|MEDIUM|LOW/.test(c.innerText.split('\n')[0]); i++) c = c.parentElement; return c.innerText.replace(/\s+/g, ' ').trim(); }));
        const seen = {}; cards.forEach(c => seen[c] = (seen[c] || 0) + 1);
        const dup = Object.entries(seen).filter(([, n]) => n > 1).map(([c, n]) => `${n}× ${c.slice(0, 80)}`);
        s.observe(`${cards.length} card(s), ${Object.keys(seen).length} distinct`);
        expect(dup, 'alert cards shown more than once').toEqual([]);
      });
    });
    await run.scenario(meta('SHP-REG-21', SHP, 'Log new shipment form (Ocean / Air, project first, port-to-site days)', 'Positive', { navPath: ['Enterprise', ESH] }), async s => {
      await s.step('"+ Log Shipment" → Ocean / Air toggle; Project list contains the project; Submittal "Pick a project first" until a project is chosen; "Port-to-site days" placeholder "Blank = project buffer"; Cancel (nothing logged)', async () => {
        await eShip();
        await main.getByRole('button', { name: /Log Shipment/ }).click(); await k.settle(1500);
        await expect(page.getByText('Log new shipment', { exact: true }).first()).toBeVisible({ timeout: 10000 });
        for (const b of ['Ocean', 'Air']) await expect(page.getByText(b, { exact: true }).first(), `${b} toggle`).toBeVisible();
        for (const b of ['Cancel', 'Log shipment']) await expect(page.getByRole('button', { name: b, exact: true }).first(), b).toBeVisible();
        const project = page.locator('select').filter({ has: page.locator('option', { hasText: 'Choose a project' }) }).first();
        const submittal = page.locator('select').filter({ has: page.locator('option', { hasText: /Pick a project first/ }) }).first();
        expect(await project.locator('option').allInnerTexts()).toContain(config.projectName);
        await expect(submittal).toBeVisible();
        await expect(page.getByPlaceholder('Blank = project buffer')).toBeVisible();
        await project.selectOption({ label: config.projectName }); await k.settle(2500);
        const subs = (await page.locator('select').nth(await page.locator('select').count() - 1).locator('option').allInnerTexts()).length;
        s.observe(`after choosing ${config.projectName}: submittal options ${subs}; "Pick a project first" still listed: ${await page.locator('option', { hasText: /Pick a project first/ }).count()}`);
        expect(await page.locator('option', { hasText: /Pick a project first/ }).count(), 'submittal list replaced').toBe(0);
        await page.getByRole('button', { name: 'Cancel', exact: true }).first().click(); await k.settle(1000);
        await expect(page.getByRole('button', { name: 'Log shipment', exact: true })).toHaveCount(0);
      });
    });

    // =============================== International Shipments ===============================
    const tabBtn = name => main.getByRole('button', { name: new RegExp(`^${name.replace(/[&]/g, '\\$&')}\\s*\\d*$`) }).first();
    const badge = async name => num((await tabBtn(name).innerText()).replace(name, ''));
    const intl = async () => {
      await open('/international-shipments', SHP, null, 3000);
      await expect(tabBtn('Shipments')).toBeVisible({ timeout: 360000 }); // 24–26 Nov 2026: 2–5 minutes
      await k.settle(3000);
    };
    const intlOk = await run.scenario(meta('SHP-REG-12', SHP, 'Shipments tab: count equals the rows', 'Positive'), async s => {
      await s.step('International Shipments › "Shipments" → "N international shipment(s)" = rows; columns Material, Manufacturer, Container / AWB, BOL, Carrier, Vessel / Flight, Est. Arrival, Required Date, Status, Risk', async () => {
        await intl();
        await tabBtn('Shipments').click(); await k.settle(2500);
        const n = num(((await flat()).match(/([\d,]+) international shipment\(s\)/) || [])[1]);
        const g = await grid(tableWith('Vessel / Flight'));
        shared.intl = { total: n, rows: g.rows.length, risk: atRisk(g, /^at risk$/i).length };
        s.observe(`${n} international shipment(s); rows ${g.rows.length}; Risk "At Risk" ${shared.intl.risk}; badge Shipments ${await badge('Shipments')}`);
        for (const c of ['material', 'manufacturer', 'container / awb', 'bol', 'carrier', 'vessel / flight', 'est. arrival', 'required date', 'status', 'risk']) expect(g.head, c).toContain(c);
        expect(g.rows.length).toBe(n);
      }, { critical: true });
    });
    if (intlOk.status === 'Passed') {
      await run.scenario(meta('SHP-REG-13', SHP, 'At-risk count is the same on the Risk Dashboard tab, the Shipments rows and Enterprise Shipments', 'Integration'), async s => {
        await s.step(`"Risk Dashboard" badge = Shipments rows with Risk "At Risk" = Enterprise Shipments rows of ${config.projectName} at risk`, async () => {
          const b = await badge('Risk Dashboard');
          s.observe(`Risk Dashboard badge ${b}; Shipments at risk ${shared.intl.risk}; Enterprise ${config.projectName} at risk ${shared.eShip?.projectRisk ?? '–'}`);
          expect(shared.intl.risk).toBe(b);
          if (shared.eShip) expect(shared.eShip.projectRisk).toBe(b);
        });
      });
      await run.scenario(meta('SHP-REG-22', SHP, 'Enterprise Shipments lists every shipment of the project', 'Integration', { navPath: ['Enterprise', ESH] }), async s => {
        await s.step(`Enterprise Shipments rows of ${config.projectName} = International Shipments "N international shipment(s)"`, async () => {
          expect(shared.eShip, 'SHP-REG-16 counts').toBeTruthy();
          s.observe(`Enterprise ${shared.eShip.project}, International ${shared.intl.total}`);
          expect(shared.eShip.project).toBe(shared.intl.total);
        });
      });
      await run.scenario(meta('SHP-REG-14', SHP, 'Flag & Review: count, rows and selection', 'Positive'), async s => {
        await s.step('"Flag & Review" → badge = "N unflagged submittal schedule(s)" = rows; "Flag as International (0)" disabled', async () => {
          await tabBtn('Flag & Review').click(); await k.settle(3000);
          const b = await badge('Flag & Review');
          const n = num(((await flat()).match(/([\d,]+) unflagged submittal schedule\(s\)/) || [])[1]);
          const rows = (await grid(tableWith('Required On Site'))).rows.length;
          s.observe(`badge ${b}, text ${n}, rows ${rows}`);
          expect(n).toBe(b); expect(rows).toBe(n);
          await expect(main.getByRole('button', { name: /Flag as International \(0\)/ })).toBeDisabled();
        });
        await s.step('Tick the first row → "Flag as International (1)" enabled; untick → "(0)" again (nothing flagged)', async () => {
          const box = tableWith('Required On Site').locator('tbody tr').first().locator('input[type="checkbox"]');
          await box.check(); await k.settle(800);
          await expect(main.getByRole('button', { name: /Flag as International \(1\)/ })).toBeEnabled();
          await box.uncheck(); await k.settle(800);
          await expect(main.getByRole('button', { name: /Flag as International \(0\)/ })).toBeVisible();
        });
      });
      await run.scenario(meta('SHP-REG-15', SHP, 'Delay Alerts: affected shipments and their alerts', 'Positive'), async s => {
        await s.step('"Delay Alerts" → "AFFECTED SHIPMENTS (N)" = rows, N ≤ the shipments of the project', async () => {
          await tabBtn('Delay Alerts').click(); await k.settle(3000);
          const n = num(((await flat()).match(/AFFECTED SHIPMENTS \(([\d,]+)\)/i) || [])[1]);
          const g = await grid(tableWith('Matching Alerts'));
          shared.alertRows = g;
          s.observe(`affected ${n}, rows ${g.rows.length}, shipments ${shared.intl.total}`);
          expect(g.rows.length).toBe(n);
          expect(n).toBeLessThanOrEqual(shared.intl.total);
        });
        await s.step('Each affected shipment lists a matching alert once (no repeated alert title in one row)', async () => {
          const cells = await tableWith('Matching Alerts').locator('tbody tr').evaluateAll(list => list.map(r => { const c = r.cells[4]; return c ? [...c.querySelectorAll('*')].filter(e => !e.children.length).map(e => e.innerText.trim()).filter(Boolean) : []; }));
          const repeated = cells.map((alerts, i) => ({ i, n: alerts.length, distinct: new Set(alerts).size })).filter(x => x.n > x.distinct);
          s.observe(`${repeated.length} of ${cells.length} rows repeat an alert (first: ${repeated[0] ? `${cells[repeated[0].i].length} entries, ${repeated[0].distinct} distinct` : '–'})`);
          expect(repeated.length, 'rows that list the same alert more than once').toBe(0);
        });
      });
    } else for (const id of ['SHP-REG-13', 'SHP-REG-22', 'SHP-REG-14', 'SHP-REG-15']) run.skip(meta(id, SHP, 'Needs the International Shipments page', 'Positive'), 'SHP-REG-12 (page load) did not pass');

    // =============================== Analytics › Aggregate Stats ===============================
    const ANA = 'Analytics';
    const AGG = 'Aggregate Stats';
    const agg = async () => { await open('/aggregate-stats', AGG, ANA, 3000); await expect(main.getByText('ON TIME VS ROJ', { exact: false }).first()).toBeVisible({ timeout: 60000 }); await k.settle(2500); };
    const cardsText = async () => (await main.innerText()).replace(/\r/g, '');
    const card = (t, title) => { const m = t.match(new RegExp(`${title}\\s*\\n\\s*([^\\n]+)\\s*\\n([\\s\\S]*?)(?=\\n[A-Z][A-Z /]{3,}\\n|$)`, 'i')); return m ? { value: m[1].trim(), rest: m[2] } : null; };
    const money = t => num(String(t).replace(/[^\d.,-]/g, ''));
    const pipeline = async () => {
      const t = await cardsText();
      const out = {};
      for (const stage of ['Not ordered', 'Ordered', 'Partially delivered', 'Delivered']) {
        const m = t.match(new RegExp(`\\n${stage}\\n([\\d,]+) · (\\d+)%(?:(\\d+) at risk)?\\n\\D*([\\d,]+) committed`));
        if (m) out[stage] = { lines: num(m[1]), pct: num(m[2]), risk: m[3] ? num(m[3]) : 0, committed: num(m[4]) };
      }
      return out;
    };
    const KPIS = ['ON TIME VS ROJ', 'DELIVERIES RECEIVED', 'AVG DAYS LATE', 'POS RAISED', 'LINES CREATED', 'FDI REJECTION RATE', 'DISCREPANCIES', 'NCRS RAISED', 'LINES AT RISK', 'OVERDUE LINES', 'OPEN NCRS', 'VALUE DELIVERED'];
    await run.scenario(meta('ANV-AGG-04', ANA, 'Aggregate Stats shows the 12 KPI cards', 'Positive', { navPath: [ANA, AGG] }), async s => {
      await s.step(`Aggregate Stats → cards ${KPIS.join(', ')}, each with a value`, async () => {
        await agg(); const t = await cardsText();
        const missing = KPIS.filter(k2 => !card(t, k2));
        s.observe(KPIS.map(k2 => `${k2}: ${card(t, k2)?.value ?? '–'}`).join(' · '));
        expect(missing, 'cards missing').toEqual([]);
      }, { critical: true });
    });
    await run.scenario(meta('ANV-AGG-05', ANA, '"On time vs ROJ" equals its own "X of Y deliveries"', 'Positive', { navPath: [ANA, AGG] }), async s => {
      await s.step('ON TIME VS ROJ % = X ÷ Y × 100 (one decimal) from "X of Y deliveries"; Y = DELIVERIES RECEIVED', async () => {
        await agg(); const t = await cardsText(); const c = card(t, 'ON TIME VS ROJ');
        const [x, y] = ((c.rest.match(/([\d,]+) of ([\d,]+) deliveries/) || []).slice(1)).map(num);
        s.observe(`${c.value}; ${x} of ${y}; deliveries received ${card(t, 'DELIVERIES RECEIVED').value}`);
        expect(Math.abs(num(c.value) - Math.round((x / y) * 1000) / 10)).toBeLessThanOrEqual(0.1);
        expect(y).toBe(num(card(t, 'DELIVERIES RECEIVED').value));
      });
    });
    await run.scenario(meta('ANV-AGG-06', ANA, 'Pipeline adds up to all lines and to the lines at risk', 'Integration', { navPath: [ANA, AGG] }), async s => {
      await s.step('Pipeline Not ordered + Ordered + Partially delivered + Delivered = "of N lines" of LINES AT RISK; their "at risk" = LINES AT RISK; each % = lines ÷ N (±1)', async () => {
        await agg(); const t = await cardsText(); const p = await pipeline(); const lr = card(t, 'LINES AT RISK');
        const total = num((lr.rest.match(/of ([\d,]+) lines/) || [])[1]);
        const sum = Object.values(p).reduce((a, v) => a + v.lines, 0); const risk = Object.values(p).reduce((a, v) => a + v.risk, 0);
        s.observe(`pipeline ${JSON.stringify(p)}; lines ${sum} vs ${total}; at risk ${risk} vs ${lr.value}`);
        expect(Object.keys(p).length, 'four pipeline stages read').toBe(4);
        expect(sum).toBe(total);
        expect(risk).toBe(num(lr.value));
        for (const [stage, v] of Object.entries(p)) expect(Math.abs(v.pct - (v.lines / total) * 100), `${stage} %`).toBeLessThanOrEqual(1);
      });
    });
    await run.scenario(meta('ANV-AGG-07', ANA, 'Value delivered, committed and remaining agree', 'Integration', { navPath: [ANA, AGG] }), async s => {
      await s.step('VALUE DELIVERED = "Delivered" of Spend delivered vs remaining; % = delivered ÷ committed; committed = sum of the pipeline committed values; delivered + remaining = committed (±1)', async () => {
        await agg(); const t = await cardsText(); const p = await pipeline(); const v = card(t, 'VALUE DELIVERED');
        const delivered = money(v.value);
        const [pct, committed] = [num((v.rest.match(/([\d.]+)% of/) || [])[1]), money((v.rest.match(/of ([^\s]+) committed/) || [])[1])];
        const spendD = money((t.match(/Delivered ([^\n]+)\nRemaining/) || [])[1]); const remaining = money((t.match(/Remaining ([^\n]+)/) || [])[1]);
        const pipe = Object.values(p).reduce((a, x) => a + x.committed, 0);
        s.observe(`delivered ${delivered} (${pct}% of ${committed}); spend delivered ${spendD}, remaining ${remaining}; pipeline committed ${pipe}`);
        expect(spendD).toBe(delivered);
        expect(Math.abs(pct - Math.round((delivered / committed) * 1000) / 10)).toBeLessThanOrEqual(0.1);
        expect(Math.abs(pipe - committed)).toBeLessThanOrEqual(1);
        expect(Math.abs(delivered + remaining - committed)).toBeLessThanOrEqual(1);
      });
    });
    await run.scenario(meta('ANV-AGG-08', ANA, 'Period presets set the dates and narrow the counts', 'Positive', { navPath: [ANA, AGG] }), async s => {
      const dates = async () => Promise.all([main.getByPlaceholder('From date').inputValue(), main.getByPlaceholder('To date').inputValue()]);
      const parse = v => { const m = v.match(/(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})/); if (!m) return null; const [a, b, c] = m.slice(1).map(Number); return a > 31 ? new Date(a, b - 1, c) : new Date(c, b - 1, a); };
      await s.step('Default "90 days" → From about 90 days before To, To = today', async () => {
        await agg(); const [f, t] = await dates(); const [df, dt] = [parse(f), parse(t)]; const now = new Date();
        shared.agg90 = num(card(await cardsText(), 'DELIVERIES RECEIVED').value);
        s.observe(`From ${f}, To ${t}; deliveries ${shared.agg90}`);
        expect(dt.toDateString()).toBe(new Date(now.getFullYear(), now.getMonth(), now.getDate()).toDateString());
        expect(Math.abs((dt - df) / 86400000 - 90)).toBeLessThanOrEqual(1);
      });
      await s.step('"30 days" → From about 30 days before To; DELIVERIES RECEIVED ≤ the 90-day value; "12 months" → ≥ the 90-day value', async () => {
        await main.getByRole('button', { name: '30 days', exact: true }).click(); await k.settle(3500);
        const [f, t] = await dates(); const d30 = num(card(await cardsText(), 'DELIVERIES RECEIVED').value);
        await main.getByRole('button', { name: '12 months', exact: true }).click(); await k.settle(3500);
        const d12 = num(card(await cardsText(), 'DELIVERIES RECEIVED').value);
        await main.getByRole('button', { name: '90 days', exact: true }).click(); await k.settle(2000);
        s.observe(`30 days: ${f} – ${t}, deliveries ${d30}; 90 days ${shared.agg90}; 12 months ${d12}`);
        expect(Math.abs((parse(t) - parse(f)) / 86400000 - 30)).toBeLessThanOrEqual(1);
        expect(d30).toBeLessThanOrEqual(shared.agg90);
        expect(d12).toBeGreaterThanOrEqual(shared.agg90);
      });
    });
    await run.scenario(meta('ANV-AGG-09', ANA, 'Needs attention lists at most 10 lines, soonest ROJ first', 'Positive', { navPath: [ANA, AGG] }), async s => {
      await s.step('Needs attention → at most 10 entries, ROJ dates ascending; "Showing the 10 … of N lines" with N ≥ OVERDUE LINES', async () => {
        await agg(); const t = await cardsText();
        const part = t.slice(t.indexOf('Needs attention'), t.indexOf('Lead-time accuracy'));
        const roj = [...part.matchAll(/ROJ (\d{2})\/(\d{2})\/(\d{4})/g)].map(m => new Date(+m[3], +m[2] - 1, +m[1]).getTime());
        const n = num((part.match(/of ([\d,]+) lines that need attention/) || [])[1]);
        s.observe(`${roj.length} entries; of ${n} lines; overdue ${card(t, 'OVERDUE LINES').value}`);
        expect(roj.length).toBeGreaterThan(0); expect(roj.length).toBeLessThanOrEqual(10);
        expect(roj).toEqual([...roj].sort((a, b) => a - b));
        expect(n).toBeGreaterThanOrEqual(num(card(t, 'OVERDUE LINES').value));
      });
    });
    await run.scenario(meta('ANV-AGG-10', ANA, 'Values are shown in the project currency', 'Positive', { navPath: [ANA, AGG] }), async s => {
      await s.step('Header currency (e.g. "INR - Indian Rupees") → VALUE DELIVERED and the pipeline committed values use its symbol (rule R58)', async () => {
        await agg(); const t = await cardsText();
        const cur = (await page.getByText(/^[A-Z]{3} - /).first().innerText().catch(() => '')).trim();
        const sym = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }[cur.slice(0, 3)] || cur.slice(0, 3);
        const v = card(t, 'VALUE DELIVERED').value;
        s.observe(`project currency "${cur}"; VALUE DELIVERED "${v}"`);
        expect(v.startsWith(sym) || v.includes(cur.slice(0, 3)), `Project currency is ${cur.slice(0, 3)} but VALUE DELIVERED shows "${v}"`).toBe(true);
      });
    });
    await run.scenario(meta('ANV-AGG-11', ANA, 'By material category: lines add up to all lines', 'Integration', { navPath: [ANA, AGG] }), async s => {
      await s.step('By material category table: sum of LINES = "of N lines" of LINES AT RISK; sum of AT RISK = LINES AT RISK', async () => {
        await agg(); const t = await cardsText();
        const g = await grid(tableWith('LEAD TIME Q / A'));
        const lines = g.rows.reduce((a, r) => a + num(r[colOf(g.head, /^lines/)]), 0);
        const risk = g.rows.reduce((a, r) => a + num(String(r[colOf(g.head, /^at risk/)]).split('/')[0]), 0);
        const lr = card(t, 'LINES AT RISK'); const total = num((lr.rest.match(/of ([\d,]+) lines/) || [])[1]);
        s.observe(`${g.rows.length} categories; lines ${lines} vs ${total}; at risk ${risk} vs ${lr.value}`);
        expect(lines).toBe(total);
        expect(risk).toBe(num(lr.value));
      });
    });
  } });
});
