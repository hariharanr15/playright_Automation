// Procurement Log regression, part 3 – the remaining scenarios of docs/functional-discovery/PL_REGRESSION_SCENARIOS.md.
// One run submittal with a brand-new material drives the step-by-step delivery chain, so the same receipt also checks
// FDI (first delivery of a material, FDI-R1), Inventory and International Shipments. Run-tagged records only.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { runPmSuite } = require('./support/pm-flow');
const { plKit, poToday, MATERIAL, SUPPLIER } = require('./support/pl-flow');
const { writePdf, writeXlsx, readXlsxRows } = require('./support/pl-files');
const { InventoryManagementPage } = require('../../pages/inventory-management/inventory-management.page');
const { SiteSelectorPage } = require('../../pages/site-selector.page');

const SUITE = 'Procurement Log Regression 3';
const MODULE = 'Procurement Log';
const meta = (id, title, kind, extra = {}) => ({ id, module: MODULE, submodule: kind, suite: SUITE, title: `[${kind}] ${title}`, navPath: [MODULE], ...extra });
const stamp = new Date();
const digits = stamp.toISOString().replace(/\D/g, '');
const RUN = `PLT${digits.slice(2, 12)}`;
const num = n => `${digits.slice(0, 12)}${String(n).padStart(2, '0')}`;
const today = new Date(stamp.getFullYear(), stamp.getMonth(), stamp.getDate());
const plusDays = d => new Date(today.getFullYear(), today.getMonth(), today.getDate() + d);
const gb = d => d.toLocaleDateString('en-GB');
const NEW_MATERIAL = `Auto Fdi ${digits.slice(2, 12)}`; // already title case: the app title-cases material names (OBS-PL-32)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-reg3-'));
const HEAD = (process.env.SCP_PL_IMPORT_HEADER || 'Spec Description|Schedule Id|Material Name|Submittal No|Supplier Name|Source|Actual Delivery Date|Total Count 1386|Total Count 1574|Total Count 15|Total Count 87|Spec Section No|Spec Section No|Spec Section No').split('|');
const COMP_HEAD = ['DateReqOnSite', 'Material', 'QTY', 'Status', 'Purchase Order No', 'PO Date', 'Submittal No'];
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

test.describe.configure({ mode: 'serial' });
test.setTimeout(90 * 60 * 1000);

test('Procurement Log – regression part 3', async ({ page, browserName }) => {
  await runPmSuite({ page, browserName, suite: SUITE, scenarios: async ({ run, config }) => {
    const k = plKit(page);
    const { main, listbox } = k;
    const btn = name => main.getByRole('button', { name, exact: true }).first();
    const header = async () => (await main.getByRole('columnheader').allInnerTexts()).map(t => t.trim());
    const cell = async (row, col) => (await row.getByRole('cell').allInnerTexts())[(await header()).indexOf(col)]?.trim();
    const P = { spec: `${RUN}-SPEC-P`, description: `${RUN} delivery chain`, scheduleId: num(1), number: `${RUN}-SUB-P` };
    const Q = { spec: `${RUN}-SPEC-Q`, description: `${RUN} second`, scheduleId: num(2), number: `${RUN}-SUB-Q` };
    const row = d => k.rows().filter({ hasText: d.description }).first();
    const rowMenu = async (d, item) => { await row(d).getByRole('cell').last().click(); await page.getByRole('menuitem', { name: item }).click(); };
    const bulkEditStatuses = [];
    page.on('response', r => { if (r.url().includes('/bulk_edit_log/')) bulkEditStatuses.push(r.status()); });
    const ids = {};
    // Every list scenario starts from a freshly loaded list so a failed filter can't leak into the next one.
    const fresh = async () => { await page.goto('/procurement-log', { waitUntil: 'domcontentloaded' }); await expect.poll(k.count, { timeout: 30000 }).toBeGreaterThan(0); };
    // Reopen run submittal P with no dialog left over from a failed scenario.
    const openP = async () => { await fresh(); await k.search(P.number); await k.openSubmittal(P.description); await page.getByText('Other Actions').first().waitFor({ timeout: 30000 }); };

    const login = await run.scenario(meta('PL-REG3-SETUP', `Sign in on ${config.projectName}`, 'Setup', { always: true }), async s => {
      await k.signIn(s, config);
      await s.step(`Left menu › "Procurement Log" → grid opens with at least one item listed`, () => k.openLog(), { critical: true });
      s.observe(`Run tag ${RUN}; new material ${NEW_MATERIAL}`);
    });
    if (login.status !== 'Passed') { run.abort('Setup failed'); return; }

    // ---------- 1. List ----------
    await run.scenario(meta('PL-REG-LST-20', 'bulk_edit_log is accessible to Project Admin (PL-R7)', 'Role'), async s => {
      await s.step(`Procurement Log page load: check captured "bulk_edit_log" responses → at least one request was made and none returned 403`, async () => {
        expect(bulkEditStatuses.length, 'bulk_edit_log was requested').toBeGreaterThan(0);
        expect(bulkEditStatuses, 'bulk_edit_log statuses (403 = access issue to be fixed)').not.toContain(403);
      });
    });
    await run.scenario(meta('PL-REG-LST-03', 'Date inputs are read-only', 'Negative'), async s => {
      await s.step(`Procurement Log: inspect the "Start date" and "End date" boxes → both have the read-only attribute`, async () => {
        for (const n of ['Start date', 'End date']) expect(await page.getByRole('textbox', { name: n }).getAttribute('readonly')).not.toBeNull();
      });
    });
    await run.scenario(meta('PL-REG-ADD-02', 'Add Submittal required fields', 'Negative'), async s => {
      await s.step(`Click "Add Submittal", then "Add" with every field empty → six required-field messages shown (spec no., description, Schedule Id, Submittal no., Suppliers, material); dialog closed`, async () => {
        await btn('Add Submittal').click(); await page.getByRole('button', { name: 'Add', exact: true }).click();
        for (const m of ['Spec selection no. is required', 'Spec description is required', 'Schedule Id is required', 'Submittal no. is required', 'Suppliers is required', 'At least one material is required']) await expect(page.getByText(m)).toBeVisible();
        await k.closeDialog('Add Submittal');
      });
    });
    const created = await run.scenario(meta('PL-REG-ADD-10', 'Custom number field is saved', 'Positive'), async s => {
      await s.step(`"Add Submittal": fill spec, description, Schedule Id, Submittal no. ${P.number}, supplier ${SUPPLIER}, material ${MATERIAL}, custom number field 7 (if any), click "Add" → toast "Submittal added successfully"`, async () => {
        await btn('Add Submittal').click();
        const m = page.getByRole('heading', { name: 'Add Submittal' }).locator('xpath=../..'); const tb = m.getByRole('textbox');
        await tb.nth(0).fill(P.spec); await tb.nth(1).fill(P.description); await tb.nth(2).fill(P.scheduleId); await tb.nth(3).fill(P.number);
        await k.pick('Choose Suppliers', SUPPLIER, m);
        await m.getByRole('button', { name: 'Choose Materials' }).click(); await listbox().getByRole('option', { name: MATERIAL, exact: true }).click();
        await page.getByRole('heading', { name: 'Add Submittal' }).click();
        const spin = m.getByRole('spinbutton');
        ids.customField = (await spin.count()) ? (await spin.first().locator('xpath=preceding::*[1]').innerText()).trim() : null;
        if (ids.customField) await spin.first().fill('7');
        await m.getByRole('button', { name: 'Add', exact: true }).click();
        await k.toast('Submittal added successfully');
      }, { critical: true });
      await s.step(`Search ${P.number} in Procurement Log → custom number column of the new row shows 7 (only noted if the project has no such field)`, async () => {
        await k.search(P.number);
        if (!ids.customField) { s.observe('Project has no custom number field'); return; }
        expect(await cell(row(P), ids.customField)).toBe('7');
      });
    });
    if (created.status !== 'Passed') { run.abort('Run submittal P was not created'); return; }
    await run.scenario(meta('PL-REG-ADD-11', 'Spec value fills every Spec Section No column', 'Positive'), async s => {
      await s.step(`Read the row of ${P.number} → every "Spec Section No" column shows ${P.spec}`, async () => {
        const h = await header(); const cells = (await row(P).getByRole('cell').allInnerTexts()).map(t => t.trim());
        const idx = h.map((c, i) => c === 'Spec Section No' ? i : -1).filter(i => i >= 0);
        expect(idx.length).toBeGreaterThan(0);
        for (const i of idx) expect(cells[i]).toBe(P.spec);
      });
    });
    await run.scenario(meta('PL-REG-LST-02', 'Date range filters on Created At', 'Positive'), async s => {
      await s.step(`Clear search, set "Start date" to today → item count is not larger than before; searching ${P.number} finds exactly 1 row`, async () => {
        await k.search('');
        const before = await k.count();
        // Created At is filtered on the server's UTC date: from 00:00 to 05:30 IST a record created "today" in the browser
        // is dated yesterday (SCP-DEF-074), so the server's date is used and noted when it differs.
        const start = poToday();
        if (start < today) s.observe(`Start date set to ${start.toLocaleDateString('en-GB')} (server date; browser date is ${today.toLocaleDateString('en-GB')}, SCP-DEF-074)`);
        await k.day(page.getByRole('textbox', { name: 'Start date' }), start); await k.settle(1500);
        const after = await k.count();
        expect(after).toBeLessThanOrEqual(before);
        await k.search(P.number); await expect.poll(k.count).toBe(1);
        s.observe(`${before} items for the default range, ${after} created today`);
      });
      await s.step(`Reload the page → grid loads with items again (date filter reset)`, async () => { await page.reload({ waitUntil: 'domcontentloaded' }); await expect.poll(k.count, { timeout: 30000 }).toBeGreaterThan(0); });
    });
    await run.scenario(meta('PL-REG-LST-14', 'Second click sorts descending', 'Positive'), async s => {
      // "PLT" matches every earlier run, so the result is longer than one page and the server-side sort shows a
      // different page each way: compare the direction of each order, not page 1 against its mirror.
      await s.step(`Reload, search "PLT", click the "Submittal No" column header twice → first order ascending, second descending, and the second starts at or above the end of the first`, async () => {
        await fresh(); await k.search(RUN.slice(0, 3));
        const h = main.getByRole('columnheader', { name: 'Submittal No' });
        const read = async () => k.rows().evaluateAll((rs, c) => rs.map(r => r.querySelectorAll('td')[c]?.innerText.trim() || ''), (await header()).indexOf('Submittal No'));
        await h.click(); await k.settle(1200); const asc = await read();
        await h.click(); await k.settle(1200); const desc = await read();
        const cmp = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        const ordered = (list, sign) => list.every((v, i) => i === 0 || sign * cmp(list[i - 1], v) <= 0);
        s.observe(`${asc.length} rows per page; ascending ${asc[0]} … ${asc[asc.length - 1]}; descending ${desc[0]} … ${desc[desc.length - 1]}`);
        expect(asc.length, 'Rows to sort').toBeGreaterThan(1);
        expect(ordered(asc, 1), `First click sorts ascending: ${asc.join(', ')}`).toBe(true);
        expect(ordered(desc, -1), `Second click sorts descending: ${desc.join(', ')}`).toBe(true);
        expect(cmp(desc[0], asc[asc.length - 1]), 'Descending starts with the highest Submittal No').toBeGreaterThanOrEqual(0);
      });
    });
    await run.scenario(meta('PL-REG-LST-09', 'Advanced Filter numeric operator', 'Positive'), async s => {
      await s.step(`Reload, "Filters" › "Add Condition": custom number field, operator ">=", value 7, "Apply Filter" → at least one row, all values >= 7 (skipped if no such field)`, async () => {
        if (!ids.customField) { s.observe('No custom number field'); return; }
        await fresh();
        await btn('Filters').click(); await btn('Add Condition').click();
        const r = page.getByRole('textbox', { name: 'Value' }).locator('xpath=..');
        await r.locator('select').nth(1).selectOption(ids.customField); await r.locator('select').nth(2).selectOption('>=');
        await page.getByRole('textbox', { name: 'Value' }).fill('7'); await btn('Apply Filter').click(); await k.settle(1500);
        const i = (await header()).indexOf(ids.customField);
        const vals = await k.rows().evaluateAll((rs, c) => rs.map(r => Number(r.querySelectorAll('td')[c]?.innerText.trim())), i);
        s.observe(`${vals.length} rows with ${ids.customField} >= 7`);
        await fresh();
        expect(vals.length, `Advanced Filter "${ids.customField} >= 7" returned no rows although ${P.number} has 7`).toBeGreaterThan(0);
        for (const v of vals) expect(v).toBeGreaterThanOrEqual(7);
      });
    });
    await run.scenario(meta('PL-REG-LST-10', 'Two conditions combine', 'Positive'), async s => {
      await s.step(`Reload, "Filters": two "Add Condition" rows, "Supplier Name" Contains ${SUPPLIER} and "Submittal No" Contains ${RUN}, "Apply Filter" → exactly 1 row`, async () => {
        await fresh();
        await btn('Filters').click();
        for (const [colName, val] of [['Supplier Name', SUPPLIER], ['Submittal No', RUN]]) {
          await btn('Add Condition').click();
          const r = page.getByRole('textbox', { name: 'Value' }).last().locator('xpath=..');
          // Rows after the first carry an extra AND/OR select, so selects are found by their options.
          await r.locator('select').filter({ has: page.locator('option', { hasText: 'Supplier Name' }) }).selectOption(colName);
          await r.locator('select').filter({ has: page.locator('option', { hasText: 'Contains' }) }).selectOption('Contains');
          await page.getByRole('textbox', { name: 'Value' }).last().fill(val);
        }
        s.observe(`Combinator controls: ${(await page.getByRole('heading', { name: 'Advanced Filter' }).locator('xpath=..').locator('select').count())} selects`);
        await btn('Apply Filter').click(); await k.settle(1500);
        const n = await k.count(); await fresh();
        expect(n, 'Rows matching both conditions').toBe(1);
      });
    });
    await run.scenario(meta('PL-REG-LST-11', 'Only my watched sends the watch filter (PL-R8)', 'Positive'), async s => {
      await s.step(`Reload, tick "Only my watched" → list request is sent with watched_only=1; untick the box`, async () => {
        await fresh();
        const req = page.waitForRequest(r => r.url().includes('list_submittals_by_project_id') && r.url().includes('watched_only=1'), { timeout: 15000 });
        await page.getByRole('checkbox', { name: 'Only my watched' }).check();
        const url = (await req).url(); s.observe(`Watched request: ${decodeURIComponent(url).slice(url.indexOf('watched_only'), url.indexOf('watched_only') + 140)}`);
        await page.getByRole('checkbox', { name: 'Only my watched' }).uncheck(); await k.settle(1000);
      });
    });

    // ---------- 3. Edit / responsible / cancel ----------
    await run.scenario(meta('PL-REG-EDT-09', 'Delete → Cancel keeps the record', 'Negative'), async s => {
      await s.step(`Search ${P.number}, row actions menu › "Delete", click "Cancel" → record still listed (1 row)`, async () => {
        await fresh(); await k.search(P.number); await rowMenu(P, 'Delete');
        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        await expect.poll(k.count).toBe(1);
      });
    });
    await run.scenario(meta('PL-REG-EDT-04', 'Bulk Assign Responsible on two run rows', 'Positive'), async s => {
      await s.step(`"Add Submittal": second run submittal ${Q.number} (spec, description, Schedule Id, supplier ${SUPPLIER}, material ${MATERIAL}) → toast "Submittal added successfully"`, async () => { await k.addSubmittal(Q); await k.toast('Submittal added successfully'); });
      await s.step(`Reload, search ${RUN}, tick both run rows, "Assign Responsible" › "Choose user" ${config.username} › "Assign" → toast "Responsible user assigned to 2 submittal(s)."`, async () => {
        await fresh(); await k.search(RUN); await expect.poll(k.count).toBe(2);
        for (const d of [P, Q]) await row(d).getByRole('checkbox').check();
        await btn('Assign Responsible').click();
        await expect(page.getByText(/selected submittals, replacing anyone assigned before/)).toBeVisible();
        await k.chooseUser(config.username);
        await page.getByRole('button', { name: 'Assign', exact: true }).click();
        await k.toast('Responsible user assigned to 2 submittal(s).');
      });
    });
    await run.scenario(meta('PL-REG-EDT-11', 'Submittal No can be updated (PL-R12)', 'Positive'), async s => {
      await s.step(`Search ${Q.number}, row menu › "Edit": change Submittal no. to ${Q.number}-R, "Update"; reopen Procurement Log and search the new number → 1 row`, async () => {
        await fresh(); await k.search(Q.number); await rowMenu(Q, 'Edit');
        const m = page.getByRole('heading', { name: 'Edit Submittal' }).locator('xpath=../..');
        await expect(m.getByRole('textbox').nth(3)).not.toHaveValue('', { timeout: 15000 });
        Q.number = `${Q.number}-R`; await m.getByRole('textbox').nth(3).fill(Q.number);
        await m.getByRole('button', { name: 'Update', exact: true }).click(); await k.settle(2000);
        await k.openLog(); await k.search(Q.number); await expect.poll(k.count).toBe(1);
      });
    });

    // ---------- 6. Materials (new material for the delivery chain) ----------
    await run.scenario(meta('PL-REG-MAT-02', 'New material form validation', 'Negative'), async s => {
      await s.step(`Reload, search ${P.number}, click its description → submittal detail opens`, async () => { await fresh(); await k.search(P.number); await k.openSubmittal(P.description); }, { critical: true });
      await s.step(`Click "New material", then "Add" with nothing chosen → toast "Please choose a category"`, async () => {
        await page.getByRole('button', { name: 'New material' }).last().click();
        const f = page.getByText('Lead Time (Weeks)').locator('xpath=ancestor::div[.//button[normalize-space()="Add"]][1]');
        await f.getByRole('button', { name: 'Add', exact: true }).click();
        await k.toast('Please choose a category');
      });
    });
    await run.scenario(meta('PL-REG-ADD-12', 'Create a new material and attach it', 'Positive'), async s => {
      await s.step(`"New material" form: first category, name ${NEW_MATERIAL}, unit "Pieces", lead time 1 week, "Add" → toast "Material added to submittal." and "Materials:" lists ${NEW_MATERIAL}`, async () => {
        if (!(await page.getByText('Lead Time (Weeks)').isVisible().catch(() => false))) await page.getByRole('button', { name: 'New material' }).last().click();
        const f = page.getByText('Lead Time (Weeks)').locator('xpath=ancestor::div[.//button[normalize-space()="Add"]][1]');
        await f.getByRole('button', { name: 'Choose Category' }).click(); await listbox().getByRole('option').first().click();
        await f.locator('input[type=text]').first().fill(NEW_MATERIAL);
        await f.getByRole('button', { name: 'Choose Unit' }).click(); await listbox().getByRole('option', { name: 'Pieces', exact: true }).click();
        await f.locator('input[name="lead_time_in_weeks"]').fill('1');
        await f.getByRole('button', { name: 'Add', exact: true }).click();
        await k.toast('Material added to submittal.');
        await expect(page.getByText('Materials:').locator('xpath=..')).toContainText(NEW_MATERIAL);
      });
    });
    await run.scenario(meta('PL-REG-MAT-03', 'Add an existing material from the list', 'Positive'), async s => {
      await s.step(`Click "+ Add material", pick the first existing material other than ${MATERIAL} and ${NEW_MATERIAL} → "Materials:" line lists it`, async () => {
        await page.getByRole('button', { name: '+ Add material' }).click();
        const opt = listbox().getByRole('option').filter({ hasNotText: new RegExp(`^(${MATERIAL}|${NEW_MATERIAL})$`) }).first();
        const name = (await opt.innerText()).trim(); await opt.click(); await k.settle(1500);
        await expect(page.getByText('Materials:').locator('xpath=..')).toContainText(name);
        s.observe(`Added ${name}`);
      });
    });

    // ---------- 4. Component on the new material ----------
    const comp = await run.scenario(meta('PL-REG-CMP-04', 'Add Component defaults: primary material, UoM read-only', 'Positive'), async s => {
      await s.step(`Submittal detail: click "Add Component" → dialog shows a "(primary)" material button; close the dialog`, async () => {
        await page.getByRole('button', { name: 'Add Component', exact: true }).last().click();
        const m = k.dialog('Add Component', 'ADD');
        await expect(m.getByRole('button', { name: /\(primary\)/ })).toBeVisible();
        await k.closeDialog('Add Component');
      });
      await s.step(`"Add Component": material ${NEW_MATERIAL}, Date Req. on Site today+28 days, QTY 10, Value 1000, PO no. ${RUN}-PO-P, PO Date today, "ADD" → toast "Schedule added successfully!"`, () => k.addComponent({ material: NEW_MATERIAL, rojDate: plusDays(28), qty: 10, value: 1000, po: `${RUN}-PO-P`, poDate: today }), { critical: true });
    });
    await run.scenario(meta('PL-REG-CMP-05', 'Currency defaults to the project currency', 'Positive'), async s => {
      await s.step(`Click "Add Component", read the currency select → "Project default (XXX)" is selected; close the dialog`, async () => {
        await page.getByRole('button', { name: 'Add Component', exact: true }).last().click();
        const sel = k.dialog('Add Component', 'ADD').locator('select').last();
        expect(await sel.locator('option:checked').innerText()).toMatch(/^Project default \(\w{3}\)$/);
        await k.closeDialog('Add Component');
      });
    });
    if (comp.status !== 'Passed') { run.abort('Component on the new material was not created'); return; }
    await run.scenario(meta('PL-REG-LST-19', 'Grid rolls up the component date and status', 'Integration'), async s => {
      await s.step(`Open Procurement Log, search ${P.number} → "Date Required On Site" is today+28 days (dd/mm/yyyy) and "Status" is "Ordered"`, async () => {
        await k.openLog(); await k.search(P.number);
        expect(await cell(row(P), 'Date Required On Site')).toBe(gb(plusDays(28)));
        expect(await cell(row(P), 'Status')).toBe('Ordered');
      });
    });
    await run.scenario(meta('PL-REG-LST-17', 'Deep link opens the submittal', 'Positive'), async s => {
      await s.step(`Click submittal ${P.description} → detail opens (URL has submittal=); URL is remembered`, async () => { await k.openSubmittal(P.description); ids.submittalUrl = page.url(); });
      await s.step(`Open Procurement Log, then go to the remembered URL → "Add Component" button visible and ${P.number} shown`, async () => {
        await k.openLog(); await page.goto(ids.submittalUrl, { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('button', { name: 'Add Component' }).last()).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(P.number).first()).toBeVisible();
      });
    });
    await run.scenario(meta('PL-REG-CMP-07', 'Order (Edit Component) changes the quantity', 'Positive'), async s => {
      await s.step(`Component ${NEW_MATERIAL}: click "Order", set "QTY*" to 12, "Update" → component row shows 12`, async () => {
        await k.componentRow(NEW_MATERIAL).getByRole('button', { name: 'Order', exact: true }).click();
        const m = k.dialog('Edit Component', 'Update');
        await m.getByText('QTY*', { exact: true }).locator('xpath=following::input[1]').fill('12');
        await m.getByRole('button', { name: 'Update', exact: true }).click(); await k.settle(2000);
        await expect(k.componentRow(NEW_MATERIAL)).toContainText('12');
      });
    });
    await run.scenario(meta('PL-REG-CMP-11', 'Audit Trail records the change', 'Positive'), async s => {
      await s.step(`Component row › "Other Actions ▾" › "Audit Trail" → entries for "actual quantity" and the signed-in user are listed; close the panel`, async () => {
        await k.componentRow(NEW_MATERIAL).getByRole('button', { name: 'Other Actions ▾' }).click();
        await page.getByRole('menuitem', { name: 'Audit Trail' }).click();
        const panel = page.getByRole('heading', { name: 'Audit Trail' }).locator('xpath=../..');
        await expect(panel.getByRole('cell', { name: 'actual quantity' }).first()).toBeVisible({ timeout: 15000 });
        await expect(panel.getByRole('cell', { name: config.username }).first()).toBeVisible();
        await page.getByRole('heading', { name: 'Audit Trail' }).locator('xpath=../../button').click();
      });
    });
    await run.scenario(meta('PL-REG-CMP-09', 'Update Status to Ordered At Risk', 'Positive'), async s => {
      await s.step(`Component row › "Other Actions ▾" › "Update Status": status "Ordered At Risk", comment "${RUN} at risk", "ADD"; reopen submittal → component status is "Ordered At Risk"`, async () => {
        await k.componentRow(NEW_MATERIAL).getByRole('button', { name: 'Other Actions ▾' }).click();
        await page.getByRole('menuitem', { name: 'Update Status' }).click();
        const m = k.dialog('Update Status', 'ADD');
        await k.pick('Choose Status', 'Ordered At Risk', m); await m.locator('textarea').fill(`${RUN} at risk`);
        await m.getByRole('button', { name: 'ADD', exact: true }).click(); await k.settle(2500);
        await openP();
        const status = await k.componentStatus(NEW_MATERIAL);
        expect(status, `Update Status to Ordered At Risk left the status at ${status}`).toBe('Ordered At Risk');
      });
    });
    await run.scenario(meta('PL-REG-CMP-14', 'Shift ROJ skips committed (ordered) lines', 'Boundary'), async s => {
      await s.step(`Reopen submittal, tick the component, "Shift ROJ Dates", offset 7 days, "Preview" → "0 will move · 1 skipped"; "Cancel", then "Clear"`, async () => {
        await openP();
        await k.componentRow(NEW_MATERIAL).getByRole('checkbox', { name: 'Select this component' }).check();
        await page.getByRole('button', { name: 'Shift ROJ Dates' }).click();
        await page.getByRole('spinbutton', { name: /Offset \(days\)/ }).fill('7');
        await page.getByRole('button', { name: 'Preview' }).click();
        await expect(page.getByText(/0 will move · 1 skipped/)).toBeVisible();
        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        await page.getByRole('button', { name: 'Clear', exact: true }).click().catch(() => null);
      });
    });
    await run.scenario(meta('PL-REG-CMP-19', 'Values use the project currency symbol', 'Positive'), async s => {
      await s.step(`Reopen submittal, expand the component row → "Value" starts with ₹ (project currency INR)`, async () => {
        await openP();
        await k.componentRow(NEW_MATERIAL).getByRole('cell').nth(1).getByRole('button').click();
        const value = (await page.getByText('Value', { exact: true }).last().locator('xpath=following-sibling::*[1]').innerText()).trim();
        s.observe(`Expanded value: ${value}`);
        expect(value, 'Project currency is INR').toMatch(/^₹/);
      });
    });

    // ---------- 5. Delivery chain step by step ----------
    // The delivery row is the one carrying the delivery action icons (the view also renders a hidden copy and other Edit icons).
    const drow = () => page.getByRole('row').filter({ has: page.locator('img[title="Pre Shipping Info"], img[title="Approve Pre-Shipping Checklist"], img[title="Approved"], img[title="Rejected"], img[alt="Rejected"], img[title="Generate GRN"], img[title="Update Shipping Info"]') }).filter({ visible: true }).last();
    const checklist = () => k.dialog('Add Pre-Shipping Details', 'Confirm Checklist');
    // Delivery action icons are addressed directly (the component view also renders a hidden copy earlier in the DOM).
    const icon = name => page.locator(`img[title="${name}"], img[alt="${name}"]`).last();
    await run.scenario(meta('PL-REG-DLV-01', 'Log a full delivery', 'Positive'), async s => {
      await s.step(`Reopen submittal ${P.number}, click the ${NEW_MATERIAL} component → component view opens (URL has schedule=); URL is remembered`, async () => { await openP(); await k.componentRow(NEW_MATERIAL).getByRole('cell', { name: NEW_MATERIAL }).click(); await expect(page).toHaveURL(/[?&]schedule=/); ids.componentUrl = page.url(); });
      await s.step(`"+ Log Delivery" › "Add Delivery": "Choose Item Name" lists the material items (PL-R5, PL-REG-DLV-15); pick ${NEW_MATERIAL}, date today, first location, quantity 4, "Add" → dialog closes, delivery row shows 4`, async () => {
        await k.keepSite(); await page.getByRole('button', { name: '+ Log Delivery' }).last().click();
        const d = k.dialog('Add Delivery', 'Add');
        await d.getByRole('button', { name: 'Choose Item Name' }).click();
        ids.items = await listbox().getByRole('option').allInnerTexts(); s.observe(`Item names: ${ids.items.join(', ')}`);
        expect(ids.items.length).toBeGreaterThan(0);
        await listbox().getByRole('option', { name: NEW_MATERIAL, exact: true }).first().click();
        await k.day(d.getByRole('textbox').first(), today);
        await d.getByRole('button', { name: /^(All Locations|Choose Location)$/ }).click(); await listbox().getByRole('option').filter({ hasNotText: /^(All Locations|Choose Location)$/ }).first().click();
        await d.getByRole('spinbutton').first().fill('4');
        await d.getByRole('button', { name: 'Add', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Add Delivery', exact: true })).toBeHidden({ timeout: 20000 });
        await expect(drow()).toContainText('4');
      }, { attempts: 1 }); // creates a delivery: a retry could log a second one
    });
    await run.scenario(meta('PL-REG-DLV-19', 'Required Remaining Qty subtracts logged deliveries (PL-R15)', 'Boundary'), async s => {
      await s.step(`Click "+ Log Delivery", read "Required Remaining Qty", close → value starts with 8 (12 ordered − 4 logged)`, async () => {
        await k.keepSite(); await page.getByRole('button', { name: '+ Log Delivery' }).last().click();
        const d = k.dialog('Add Delivery', 'Add');
        const remaining = await d.getByText('Required Remaining Qty', { exact: true }).locator('xpath=following::input[1]').inputValue();
        await k.closeDialog('Add Delivery');
        s.observe(`Required Remaining Qty: ${remaining}`);
        expect(remaining, '12 ordered − 4 logged').toMatch(/^8\b/);
      });
    });
    await run.scenario(meta('PL-REG-DLV-03', 'Checklist needs every answer and comment', 'Negative'), async s => {
      await s.step(`Reload component view, click "Pre Shipping Info" icon, click "Confirm Checklist" with no answers → toast "Answer every Questions"`, async () => {
        await page.goto(ids.componentUrl, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: '+ Log Delivery' }).last().waitFor({ timeout: 30000 }); await k.settle(1500);
        await icon('Pre Shipping Info').click();
        await checklist().getByRole('button', { name: 'Y/N', exact: true }).first().waitFor({ timeout: 20000 });
        await checklist().getByRole('button', { name: 'Confirm Checklist', exact: true }).click();
        await k.toast('Answer every Questions');
      });
      await s.step(`Set every "Y/N" answer to "YES", click "Confirm Checklist" without comments → toast "Please complete all fields before submitting."`, async () => {
        const yn = page.getByRole('button', { name: 'Y/N', exact: true });
        for (let i = 0; (await yn.count()) > 0 && i < 60; i++) { await yn.first().click(); await page.getByRole('option', { name: 'YES', exact: true }).click(); }
        await checklist().getByRole('button', { name: 'Confirm Checklist', exact: true }).click();
        await k.toast('Please complete all fields before submitting.');
      });
    });
    await run.scenario(meta('PL-REG-DLV-04', 'A NO answer blocks Confirm Checklist (PL-R16)', 'Negative'), async s => {
      await s.step(`Fill all comment inputs and the supplier note; set first answer to "NO" → "Confirm Checklist" disabled; set it back to "YES" → enabled`, async () => {
        const inputs = checklist().locator('input:visible:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])');
        for (let i = 0, n = await inputs.count(); i < n; i++) await inputs.nth(i).fill(`${RUN} answer ${i + 1}`);
        await checklist().locator('textarea:visible').first().fill(`${RUN} supplier note`);
        const confirm = checklist().getByRole('button', { name: 'Confirm Checklist', exact: true });
        await checklist().getByRole('button', { name: 'YES', exact: true }).first().click(); await page.getByRole('option', { name: 'NO', exact: true }).click();
        await expect(confirm).toBeDisabled();
        await checklist().getByRole('button', { name: 'NO', exact: true }).first().click(); await page.getByRole('option', { name: 'YES', exact: true }).click();
        await expect(confirm).toBeEnabled();
      });
    });
    await run.scenario(meta('PL-REG-DLV-05', 'Confirm the checklist', 'Positive'), async s => {
      await s.step(`Click "Confirm Checklist" → toast "Shipping Details updated successfully!" and "Approve Pre-Shipping Checklist" icon appears`, async () => {
        await checklist().getByRole('button', { name: 'Confirm Checklist', exact: true }).click();
        await k.toast('Shipping Details updated successfully!');
        await expect(icon('Approve Pre-Shipping Checklist')).toBeVisible();
      });
    });
    await run.scenario(meta('PL-REG-DLV-07', 'Reject and resubmit the checklist', 'Positive'), async s => {
      await s.step(`Click "Approve Pre-Shipping Checklist" icon, click "Reject" → "Rejected" icon appears`, async () => {
        await icon('Approve Pre-Shipping Checklist').click();
        await k.dialog('Approve Pre-Shipping Checklist', 'Reject').getByRole('button', { name: 'Reject', exact: true }).click();
        await expect(icon('Rejected')).toBeVisible({ timeout: 15000 });
      });
      await s.step(`Click "Rejected" icon › "Update Pre-Shipping Details": "Confirm Checklist" → toast "Shipping Details updated successfully!"`, async () => {
        await icon('Rejected').click();
        const u = k.dialog('Update Pre-Shipping Details', 'Confirm Checklist');
        // 19 Nov 2026: after a rejection the dialog opens with every answer cleared (all required), so the checklist is
        // filled again (all YES, PL-R16) before resubmitting.
        await u.getByRole('button', { name: /^(Y\/N|YES|NO)$/ }).first().waitFor({ timeout: 20000 });
        const inputs = u.locator('input:visible:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])');
        let blank = 0;
        for (let i = 0, n = await inputs.count(); i < n; i++) if (!(await inputs.nth(i).inputValue())) { blank++; await inputs.nth(i).fill(`${RUN} resubmit ${i + 1}`); }
        const yn = u.getByRole('button', { name: 'Y/N', exact: true });
        for (let j = 0; (await yn.count()) > 0 && j < 60; j++) { await yn.first().click(); await page.getByRole('option', { name: 'YES', exact: true }).click(); }
        const note = u.locator('textarea:visible').first();
        if (await note.isVisible().catch(() => false) && !(await note.inputValue())) await note.fill(`${RUN} resubmit note`);
        s.observe(`Update Pre-Shipping Details opened with ${blank} empty comment(s); answers re-entered`);
        await u.getByRole('button', { name: 'Confirm Checklist', exact: true }).click();
        await k.toast('Shipping Details updated successfully!');
        // Since 10 Nov 2026 the dialog stays open after a resubmit; close it so it does not cover the delivery icons.
        const heading = page.getByRole('heading', { name: 'Update Pre-Shipping Details', exact: true });
        if (await heading.isVisible().catch(() => false)) {
          s.observe('"Update Pre-Shipping Details" stayed open after the success toast; closed with X');
          await k.closeDialog('Update Pre-Shipping Details');
        }
      });
    });
    await run.scenario(meta('PL-REG-DLV-06', 'Approve the checklist', 'Positive'), async s => {
      await s.step(`Click "Approve Pre-Shipping Checklist" icon, comment "${RUN} approved", "Approve" → toast "Checklist Generated Successfully!"`, async () => {
        await icon('Approve Pre-Shipping Checklist').click();
        const a = k.dialog('Approve Pre-Shipping Checklist', 'Approve');
        await a.locator('textarea').last().fill(`${RUN} approved`);
        await a.getByRole('button', { name: 'Approve', exact: true }).click();
        await k.toast('Checklist Generated Successfully!');
      });
    });
    await run.scenario(meta('PL-REG-DLV-08', 'Set the actual delivery date', 'Positive'), async s => {
      await s.step(`Reload component view, click delivery "Edit" icon › "Edit Delivery": set actual delivery date (second date box) to today, "Update" → dialog closes, "Generate GRN" icon appears`, async () => {
        await page.goto(ids.componentUrl, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: '+ Log Delivery' }).last().waitFor({ timeout: 30000 }); await k.settle(1500);
        await icon('Edit').click();
        const e = k.dialog('Edit Delivery', 'Update');
        await k.day(e.getByRole('textbox').nth(1), today);
        await e.getByRole('button', { name: 'Update', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Edit Delivery' })).toBeHidden({ timeout: 15000 }); await k.settle(1500);
        await expect(icon('Generate GRN')).toBeVisible();
      });
    });
    await run.scenario(meta('PL-REG-DLV-09', 'Shipping info', 'Positive'), async s => {
      await s.step(`Click "Update Shipping Info" icon › "Add Shipping Info": mode "Other", ${RUN}-SHIP, "Origin", note ${RUN}, "Add" → toast "Shipping Details updated successfully!"`, async () => {
        await icon('Update Shipping Info').click();
        const sh = k.dialog('Add Shipping Info', 'Add');
        await k.pick('Choose Shipping Mode', 'Other', sh);
        await sh.getByRole('textbox').nth(0).fill(`${RUN}-SHIP`); await sh.getByRole('textbox').nth(1).fill('Origin'); await sh.locator('textarea').fill(RUN);
        await sh.getByRole('button', { name: 'Add', exact: true }).click();
        await k.toast('Shipping Details updated successfully!');
      });
    });
    await run.scenario(meta('PL-REG-DLV-10', 'Delivery conditions (all good)', 'Positive'), async s => {
      await s.step(`Click "Update Delivery Condition" icon › "Add Delivery Conditions": first number (good quantity) 4, "Add" → toast "Delivery Conditions updated successfully!"`, async () => {
        await icon('Update Delivery Condition').click();
        const dc = k.dialog('Add Delivery Conditions', 'Add');
        await dc.getByRole('spinbutton').nth(0).fill('4');
        await dc.getByRole('button', { name: 'Add', exact: true }).click();
        await k.toast('Delivery Conditions updated successfully!');
      });
    });
    const grn = await run.scenario(meta('PL-REG-DLV-11b', 'Generate GRN → Partial Delivery (4 of 12)', 'Positive'), async s => {
      await s.step(`Click "Generate GRN" icon → toast "GRN Generated Successfully!" (partial delivery, 4 of 12)`, async () => { await icon('Generate GRN').click(); await k.toast('GRN Generated Successfully!', 30000); }, { attempts: 1 });
    });
    // Open the remembered component view unless it is already shown (scenarios must not rely on the previous one's page).
    const componentView = async () => {
      if (/[?&]schedule=/.test(page.url()) && await page.getByRole('button', { name: '+ Log Delivery' }).last().isVisible().catch(() => false)) return;
      await page.goto(ids.componentUrl, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: '+ Log Delivery' }).last().waitFor({ timeout: 30000 }); await k.settle(1500);
    };
    await run.scenario(meta('PL-REG-DLV-16', 'Component header shows the unit of measure', 'Positive'), async s => {
      await s.step(`Reload component view, read "Required QTY" in the header → value shown with its unit (no "undefined")`, async () => {
        await page.goto(ids.componentUrl, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: '+ Log Delivery' }).last().waitFor({ timeout: 30000 }); await k.settle(1500);
        const v = (await page.getByText('Required QTY', { exact: true }).last().locator('xpath=following-sibling::*[1]').innerText()).trim();
        s.observe(`Required QTY: ${v}`); expect(v, 'Required QTY shows "undefined" instead of the unit').not.toContain('undefined');
      });
    });
    await run.scenario(meta('PL-REG-DLV-17', 'QR label downloads (PNG and PDF)', 'Positive'), async s => {
      await s.step(`Click "QR Label", download "PNG sticker" and "PDF sheet" → file names match submittal-<8 hex>-qr.png and .pdf; close the QR dialog`, async () => {
        await componentView(); // do not depend on PL-REG-DLV-16 leaving the component open
        await page.getByRole('button', { name: 'QR Label', exact: true }).last().click();
        for (const [b, ext] of [['PNG sticker', '.png'], ['PDF sheet', '.pdf']]) {
          const dl = page.waitForEvent('download'); await page.getByRole('button', { name: b }).click();
          expect((await dl).suggestedFilename()).toMatch(new RegExp(`^submittal-[0-9a-f]{8}-qr\\${ext}$`));
        }
        await page.getByText(/^submittal qr$/i).locator('xpath=ancestor::div[.//button][1]').getByRole('button').first().click().catch(() => page.keyboard.press('Escape'));
      });
    });
    await run.scenario(meta('PL-REG-DLV-18', 'Files tab lists the component files', 'Positive'), async s => {
      await s.step(`Click the "Files" tab → delivery table (Location column) is replaced by the files list`, async () => {
        await componentView();
        await page.getByText('Files', { exact: true }).last().click(); await k.settle(1500);
        await expect(page.getByRole('columnheader', { name: 'Location' }).last(), 'Delivery table replaced by the files list').toBeHidden({ timeout: 5000 });
      });
    });
    const int01 = meta('PL-REG-INT-01', 'First delivery of a new material creates one FDI record (FDI-R1)', 'Integration');
    const int03 = meta('PL-REG-INT-03', 'Received quantity reaches Inventory', 'Integration');
    if (grn.status !== 'Passed') { run.skip(int01, 'GRN not generated'); run.skip(int03, 'GRN not generated'); } else {
    await run.scenario(int01, async s => {
      await s.step(`Left menu › "First Delivery Inspections" → exactly one row for ${NEW_MATERIAL}`, async () => {
        // The component drawer from the delivery steps can still cover the left menu: close it with the runner's overlay
        // recovery and try again. No page reload here: after a reload the new material read 0 in Inventory (INT-03).
        await k.menu('First Delivery Inspections').catch(async () => { await run.recover(); await k.menu('First Delivery Inspections'); });
        await expect(page).toHaveURL(/\/first-delivery-inspections/); await k.settle(4000);
        await expect(page.locator('main tbody tr').filter({ hasText: NEW_MATERIAL })).toHaveCount(1, { timeout: 30000 });
      });
    });
    await run.scenario(int03, async s => {
      // Purpose: goods received through the GRN must reach Inventory with the exact quantity.
      // Expected: the "Inventory" column of the new material equals the 4 units delivered in good condition
      // (PL-REG-DLV-10/11b). The material is created by this run, so it has no other stock.
      // Until 21 Nov this only checked that the row text contained "4", which any date or ID can satisfy.
      await s.step(`Left menu › "Inventory Management", search ${NEW_MATERIAL} → "Inventory" column equals the received quantity 4`, async () => {
        const receivedQuantity = 4;
        await k.menu('Inventory Management');
        // Stock is per header site, and a reload can reset the header site (SCP-DEF-058). Read the site the delivery
        // was logged on (the current one) first; if the quantity is not there, read again on the run site.
        const inventory = new InventoryManagementPage(page);
        const sites = new SiteSelectorPage(page);
        await k.settle(2000);
        const readings = [];
        const readOn = async timeout => {
          const site = await sites.activeSiteName().catch(() => '?');
          let stock;
          await expect.poll(async () => (stock = await inventory.readListInventory(NEW_MATERIAL)), { timeout, intervals: [3000] })
            .toBe(receivedQuantity).catch(() => null);
          readings.push(`${site}: ${stock}`);
          return stock;
        };
        let stock = await readOn(12000);
        if (stock !== receivedQuantity) { await k.keepSite().catch(() => null); await k.settle(1500); stock = await readOn(20000); }
        s.observe(`${NEW_MATERIAL} inventory · ${readings.join(' · ')}`);
        expect(stock, 'Inventory of the new material differs from the received quantity').toBe(receivedQuantity);
      });
    });
    }
    await run.scenario(meta('PL-REG-EDT-07', 'International Shipments shows the procurement date and status', 'Integration'), async s => {
      await s.step(`Open Procurement Log, search ${P.number}, row menu › "Flag International": country "South Korea", "Flag" (done twice) → toast "Submittal flagged as international shipment." each time`, async () => {
        await k.openLog(); await k.search(P.number);
        for (let i = 0; i < 2; i++) {
          await rowMenu(P, 'Flag International');
          await page.getByRole('textbox', { name: 'e.g. China' }).fill('South Korea');
          await page.getByRole('button', { name: 'Flag', exact: true }).click();
          await k.toast('Submittal flagged as international shipment.');
        }
      });
      await s.step(`Left menu › "International Shipments" → exactly one row for ${P.number} (PL-REG-INT-02); row text recorded`, async () => {
        await k.menu('International Shipments'); await page.getByText('Loading international shipments').waitFor({ state: 'hidden', timeout: 60000 }).catch(() => null);
        const r = page.locator('main tbody tr').filter({ hasText: P.number });
        await expect(r).toHaveCount(1, { timeout: 30000 });
        ids.shipRow = (await r.innerText()).replace(/\s+/g, ' '); s.observe(ids.shipRow);
      });
      await s.step(`Check the International Shipments row → it contains the component Required Date (today+28 days, dd/mm/yyyy)`, async () => expect(ids.shipRow, 'International Shipments row shows the component Required Date').toContain(gb(plusDays(28))));
    });
    await run.scenario(meta('PL-REG-INT-04', 'Log Configuration fields appear as grid columns', 'Integration'), async s => {
      await s.step(`Left menu › "Project Management" › "Procurement Log Configuration": read enabled fields; open Procurement Log → at most 20% of enabled fields are missing as grid columns`, async () => {
        await k.menu('Procurement Log Configuration', 'Project Management');
        const enabled = await page.locator('main tbody tr').evaluateAll(rs => rs.filter(r => r.querySelector('input[type=checkbox]')?.checked).map(r => r.querySelectorAll('td')[1]?.innerText.replace(/\((Custom|Locked)\)/g, '').trim()).filter(Boolean));
        await k.openLog(); const grid = await header();
        const missing = enabled.filter(f => !grid.some(g => g.toLowerCase() === f.toLowerCase()));
        s.observe(`${enabled.length} enabled fields; missing in grid: ${missing.join(', ') || 'none'}`);
        expect(missing.length, `Fields missing in the grid: ${missing.join(', ')}`).toBeLessThanOrEqual(Math.ceil(enabled.length * 0.2));
      });
    });

    // ---------- 7. Alert rules ----------
    await run.scenario(meta('PL-REG-ALR-02', 'Create Alert validates required fields', 'Negative'), async s => {
      await s.step(`Search ${P.number}, row menu › "Alert", "Add Alert", click "Submit" empty → no "Failed to create alert" message (client-side validation, OBS-PL-28)`, async () => {
        await fresh(); await k.search(P.number); await rowMenu(P, 'Alert'); // fresh list: an open drawer would cover the search box
        await page.getByRole('button', { name: 'Add Alert' }).click();
        await page.getByRole('button', { name: 'Submit', exact: true }).click(); await k.settle(1500);
        const msgs = await page.getByRole('status').allTextContents();
        expect(msgs.join(' '), 'Client-side required messages instead of a server failure (OBS-PL-28)').not.toMatch(/Failed to create alert/);
      });
    });
    await run.scenario(meta('PL-REG-ALR-03', 'Edit an alert rule', 'Positive'), async s => {
      await s.step(`Reload, search ${P.number}, row menu › "Alert" › "Add Alert": first field, condition ">=", value 999, message "${RUN} alert", "Submit" → toast "Alert created successfully!"; edit icon, value 998, submit → row shows 998`, async () => {
        await fresh(); await k.search(P.number); await rowMenu(P, 'Alert');
        await page.getByRole('button', { name: 'Add Alert' }).click();
        await page.getByRole('button', { name: 'Choose Field' }).click(); await listbox().getByRole('option').first().click();
        await k.pick('Choose Condition', '>=');
        await page.getByRole('textbox', { name: 'Enter value' }).fill('999'); // not met, so the rule stays editable (a met rule turns "Sent" at once)
        await page.getByRole('textbox', { name: 'Enter alert message' }).fill(`${RUN} alert`);
        await page.getByRole('button', { name: 'Submit', exact: true }).click();
        await k.toast('Alert created successfully!');
        const r = page.getByRole('row').filter({ hasText: `${RUN} alert` });
        await r.locator('[title="Edit"], [alt="Edit"]').first().click();
        await page.getByRole('textbox', { name: 'Enter value' }).fill('998');
        await page.getByRole('button', { name: /Submit|Update|Save/ }).last().click(); await k.settle(1500);
        await expect(page.getByRole('row').filter({ hasText: `${RUN} alert` })).toContainText('998');
      });
    });
    await run.scenario(meta('PL-REG-ALR-04', 'Delete an alert rule', 'Positive'), async s => {
      await s.step(`Click the trash icon of the "${RUN} alert" row, confirm if asked → the row disappears`, async () => {
        await page.getByRole('row').filter({ hasText: `${RUN} alert` }).locator('td').last().locator('img, svg, button').last().click(); // trash icon, last in the row
        const confirm = page.getByRole('button', { name: /^(Delete|Yes|Confirm)$/ });
        if (await confirm.count()) await confirm.last().click();
        await expect(page.getByRole('row').filter({ hasText: `${RUN} alert` })).toHaveCount(0, { timeout: 15000 });
      });
    });
    // A rule whose condition is already met is sent at once (status "Sent", seen while automating ALR-03), so the alert is
    // checked in the same run instead of after the daily batch (22 Nov 2026).
    await run.scenario(meta('PL-REG-ALR-05', 'A met alert rule raises an alert on the Management Dashboard', 'Integration'), async s => {
      const message = `${RUN} met alert`;
      await s.step(`Reload, search ${P.number}, row menu › "Alert" › "Add Alert": first field, condition ">=", value 0 (always met), message "${message}", "Submit" → toast "Alert created successfully!"; the rule's status becomes "Sent"`, async () => {
        await fresh(); await k.search(P.number); await rowMenu(P, 'Alert');
        await page.getByRole('button', { name: 'Add Alert' }).click();
        await page.getByRole('button', { name: 'Choose Field' }).click(); await listbox().getByRole('option').first().click();
        await k.pick('Choose Condition', '>=');
        await page.getByRole('textbox', { name: 'Enter value' }).fill('0');
        await page.getByRole('textbox', { name: 'Enter alert message' }).fill(message);
        await page.getByRole('button', { name: 'Submit', exact: true }).click();
        await k.toast('Alert created successfully!');
        const rule = page.getByRole('row').filter({ hasText: message }).first();
        await expect(rule).toBeVisible({ timeout: 15000 });
        s.observe(`Rule row: ${(await rule.innerText()).replace(/\s+/g, ' ')}`);
        await expect(rule, 'rule status "Sent"').toContainText('Sent', { timeout: 30000 });
      }, { critical: true });
      await s.step(`Left menu › "Management Dashboard" › "Alerts" (first 3 pages) → an alert with "${message}"`, async () => {
        // The alert drawer can still cover the left menu: fall back to the route.
        await page.keyboard.press('Escape');
        await k.menu('Management Dashboard').catch(() => page.goto('/management-dashboard', { waitUntil: 'domcontentloaded' })); await k.settle(3000);
        await k.main.getByRole('button', { name: /^Alerts(\s+\d+\+?)?$/ }).first().click(); await k.settle(2500);
        const found = [];
        for (let p = 1; p <= 3 && !found.length; p++) {
          if (p > 1) { const next = k.main.getByRole('button', { name: String(p), exact: true }).last(); if (!(await next.isVisible().catch(() => false))) break; await next.click(); await k.settle(1500); }
          found.push(...(await k.main.locator('tbody tr').allInnerTexts()).map(t => t.replace(/\s+/g, ' ')).filter(t => t.includes(message)));
        }
        s.observe(found.length ? found[0].slice(0, 200) : 'not on the first 3 pages of Alerts');
        expect(found.length, 'Met alert rule listed in Management Dashboard › Alerts').toBeGreaterThan(0);
      });
    });

    // ---------- 8. Import / export ----------
    const importFile = async (kind, rows, name) => {
      await fresh();
      const file = path.join(tmp, `${RUN}-${name}.xlsx`); writeXlsx(file, rows);
      await btn('Import').click();
      const chooser = page.waitForEvent('filechooser');
      await page.getByText(kind, { exact: true }).click();
      await (await chooser).setFiles(file);
      await page.getByRole('button', { name: 'Upload', exact: true }).click(); await k.settle(3000);
      return page.getByRole('status').allTextContents();
    };
    const pad = r => [...r, ...Array(HEAD.length - r.length).fill('')].map((v, i) => HEAD[i] === 'Spec Section No' && v === '' ? `${RUN}-SPEC-I` : v);
    await run.scenario(meta('PL-REG-IMP-07', 'Template columns follow the log configuration', 'Integration'), async s => {
      await s.step(`Open Procurement Log › "Import" › "Download Template" → template has Spec Description, Schedule Id, Material Name, Submittal No, Supplier Name (+ custom number field if any)`, async () => {
        await k.openLog(); await btn('Import').click();
        const dl = page.waitForEvent('download'); await page.getByText('Download Template', { exact: true }).click();
        const file = path.join(tmp, 'template.xlsx'); await (await dl).saveAs(file);
        const head = readXlsxRows(file)[0].map(String); s.observe(`Template: ${head.join(', ')}`);
        for (const c of ['Spec Description', 'Schedule Id', 'Material Name', 'Submittal No', 'Supplier Name']) expect(head).toContain(c);
        if (ids.customField) expect(head).toContain(ids.customField);
      });
    });
    await run.scenario(meta('PL-REG-IMP-04', 'Import two rows', 'Positive'), async s => {
      await s.step(`"Import" › "Import Submittal": upload xlsx with 2 rows (${RUN}-SUB-I1, ${RUN}-SUB-I2, ${MATERIAL}, ${SUPPLIER}), "Upload" → search "${RUN} import" finds 2 rows`, async () => {
        const msgs = await importFile('Import Submittal', [HEAD, pad([`${RUN} import 1`, Number(num(11)), MATERIAL, `${RUN}-SUB-I1`, SUPPLIER, 'Manual']), pad([`${RUN} import 2`, Number(num(12)), MATERIAL, `${RUN}-SUB-I2`, SUPPLIER, 'Manual'])], 'two');
        s.observe(msgs.join(' | '));
        await k.search(`${RUN} import`); await expect.poll(k.count, { timeout: 20000 }).toBe(2);
      });
    });
    await run.scenario(meta('PL-REG-IMP-03', 'Import a duplicate Submittal No + Material is rejected', 'Negative'), async s => {
      await s.step(`"Import" › "Import Submittal": upload 1 row reusing ${RUN}-SUB-I1 + ${MATERIAL}, "Upload" → search "${RUN} import dup" finds 0 rows`, async () => {
        const msgs = await importFile('Import Submittal', [HEAD, pad([`${RUN} import dup`, Number(num(13)), MATERIAL, `${RUN}-SUB-I1`, SUPPLIER, 'Manual'])], 'dup');
        s.observe(msgs.join(' | '));
        await k.search(`${RUN} import dup`); await expect.poll(k.count).toBe(0);
      });
    });
    await run.scenario(meta('PL-REG-IMP-05', 'Import a component', 'Positive'), async s => {
      await s.step(`"Import" › "Import Component": upload row for ${RUN}-SUB-I1 (${MATERIAL}, QTY 5, "Not Ordered", +40 days), "Upload" → "${RUN} import 1" shows Status "Not Ordered"`, async () => {
        const msgs = await importFile('Import Component', [COMP_HEAD, [iso(plusDays(40)), MATERIAL, 5, 'Not Ordered', '', '', `${RUN}-SUB-I1`]], 'comp');
        s.observe(msgs.join(' | '));
        await k.search(`${RUN}-SUB-I1`);
        await expect.poll(async () => cell(row({ description: `${RUN} import 1` }), 'Status'), { timeout: 20000 }).toBe('Not Ordered');
      });
    });
    await run.scenario(meta('PL-REG-IMP-06', 'Import a component for an unknown submittal fails', 'Negative'), async s => {
      await s.step(`"Import" › "Import Component": upload row for unknown submittal ${RUN}-NO-SUCH, "Upload" → no "All 1 components uploaded successfully" message`, async () => {
        const msgs = await importFile('Import Component', [COMP_HEAD, [iso(plusDays(40)), MATERIAL, 5, 'Not Ordered', '', '', `${RUN}-NO-SUCH`]], 'comp-bad');
        s.observe(msgs.join(' | '));
        expect(msgs.join(' ')).not.toMatch(/All 1 components uploaded successfully/);
      });
    });
    await run.scenario(meta('PL-REG-IMP-09', 'Export has the grid columns', 'Positive'), async s => {
      await s.step(`Reload, search ${RUN}, click "Export" and open the xlsx → every grid column header is present in the export`, async () => {
        await fresh(); await k.search(RUN);
        const dl = page.waitForEvent('download'); await btn('Export').click();
        const file = path.join(tmp, 'export.xlsx'); await (await dl).saveAs(file);
        const exp = readXlsxRows(file)[0].map(String); const grid = (await header()).filter(Boolean);
        const missing = grid.filter(g => !exp.includes(g));
        s.observe(`Missing in export: ${missing.join(', ') || 'none'}`);
        if (missing.length) throw new Error(`Procurement Log export columns differ from the grid: ${missing.join(', ')}`);
      });
    });
    await run.scenario(meta('PL-REG-IMP-10', 'Upload history lists the run uploads', 'Integration'), async s => {
      await s.step(`Left menu › "Project Management" › "Bulk Upload Status" → today's uploads by the signed-in user are listed with type "Submittals" or "Components"`, async () => {
        await k.menu('Bulk Upload Status', 'Project Management'); await k.settle(3000);
        const rows = page.locator('main tbody tr').filter({ hasText: gb(today) }).filter({ hasText: config.username });
        expect(await rows.filter({ hasText: /Submittals|Components/ }).count()).toBeGreaterThan(0);
      });
    });

    // ---------- 1. Deep link to a component ----------
    await run.scenario(meta('PL-REG-LST-18', 'Deep link opens the component view', 'Positive'), async s => {
      await s.step(`Open the remembered component URL → "+ Log Delivery" button visible (fails if no component URL was captured)`, async () => {
        if (!ids.componentUrl) throw new Error('No component URL: the delivery chain did not open the component view');
        await page.goto(ids.componentUrl, { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('button', { name: '+ Log Delivery' }).last()).toBeVisible({ timeout: 30000 });
      });
    });
  } });
});
