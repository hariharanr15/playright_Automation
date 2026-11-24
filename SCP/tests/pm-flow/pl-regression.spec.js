// Procurement Log regression, part 1 – the lifecycle core of docs/functional-discovery/PL_REGRESSION_SCENARIOS.md.
// Creates run-tagged records on the configured project (approved: create; delete only records created by this run).
// Known defects are reported through their registered signatures (config/scp-known-defects.js).
const { test, expect } = require('@playwright/test');
const { runPmSuite } = require('./support/pm-flow');
const { plKit, poToday, MATERIAL } = require('./support/pl-flow');

const SUITE = 'Procurement Log Regression';
const MODULE = 'Procurement Log';
const meta = (id, title, kind, extra = {}) => ({ id, module: MODULE, submodule: kind, suite: SUITE, title: `[${kind}] ${title}`, navPath: [MODULE], ...extra });
const stamp = new Date();
const RUN = `PLR${stamp.toISOString().replace(/\D/g, '').slice(2, 12)}`;
const num = n => `${stamp.toISOString().replace(/\D/g, '').slice(0, 12)}${String(n).padStart(2, '0')}`; // Schedule Id: digits only
const today = new Date(stamp.getFullYear(), stamp.getMonth(), stamp.getDate());
const plusDays = d => new Date(today.getFullYear(), today.getMonth(), today.getDate() + d);
// PO date accepted by the server (see poToday, SCP-DEF-074); Expected Delivery is counted from it.
const PO_DAY = poToday();
const poPlus = d => new Date(PO_DAY.getFullYear(), PO_DAY.getMonth(), PO_DAY.getDate() + d);

test.describe.configure({ mode: 'serial' });
test.setTimeout(60 * 60 * 1000);

test('Procurement Log – regression part 1', async ({ page, browserName }) => {
  await runPmSuite({ page, browserName, suite: SUITE, scenarios: async ({ run, config }) => {
    const k = plKit(page);
    const { main } = k;
    const A = { spec: `${RUN}-SPEC-A`, description: `${RUN} submittal A`, scheduleId: num(1), number: `${RUN}-SUB-A` };
    const C = { spec: `${RUN}-SPEC-C`, description: `${RUN} same number other material`, scheduleId: num(3), number: `${RUN.toLowerCase()}-sub-a` };
    const D1 = { spec: `${RUN}-SPEC-D1`, description: `${RUN} delete 1`, scheduleId: num(4), number: `${RUN}-SUB-D1` };
    const D2 = { spec: `${RUN}-SPEC-D2`, description: `${RUN} delete 2`, scheduleId: num(5), number: `${RUN}-SUB-D2` };

    const login = await run.scenario(meta('PL-REG-SETUP', `Sign in on ${config.projectName}`, 'Setup', { always: true }), async s => {
      await k.signIn(s, config);
      await s.step(`Menu › "Procurement Log": click it → list opens with more than 0 items`, () => k.openLog(), { critical: true });
      s.observe(`Run tag ${RUN}`);
    });
    if (login.status !== 'Passed') { run.abort('Sign-in failed'); return; }

    // ---------- 1. List ----------
    await run.scenario(meta('PL-REG-LST-01', 'Default date range is today − 1 month → today (PL-R11)', 'Positive'), async s => {
      await s.step(`Look at the date boxes → "End date" is today and "Start date" is one month earlier (dd/mm/yyyy)`, async () => {
        const fmt = d => d.toLocaleDateString('en-GB');
        const from = new Date(today); from.setMonth(from.getMonth() - 1);
        await expect(page.getByRole('textbox', { name: 'End date' })).toHaveValue(fmt(today));
        await expect(page.getByRole('textbox', { name: 'Start date' })).toHaveValue(fmt(from));
      });
    });
    let sortClicked = false;
    await run.scenario(meta('PL-REG-LST-13', 'Sorting by Submittal No is ascending on first click', 'Positive'), async s => {
      await s.step(`Click the "Submittal No" column header once → rows are sorted ascending by Submittal No`, async () => {
        // The sorted page arrives after the click (22 Nov 2026 the rows were read too early), so wait for it. A retry of
        // this step does not click again: a second click sorts descending.
        const col = (await main.getByRole('columnheader').allInnerTexts()).map(t => t.trim()).indexOf('Submittal No');
        const values = () => k.rows().evaluateAll((rs, i) => rs.map(r => r.querySelectorAll('td')[i]?.innerText.trim() || ''), col);
        const ascending = vals => JSON.stringify(vals) === JSON.stringify([...vals].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base', numeric: false })));
        if (!sortClicked) { sortClicked = true; await main.getByRole('columnheader', { name: 'Submittal No' }).click(); }
        await expect.poll(async () => ascending(await values()), { timeout: 20000, message: 'Rows sorted ascending by Submittal No' }).toBe(true);
      });
    });

    // ---------- 2. Add Submittal ----------
    await run.scenario(meta('PL-REG-ADD-03', 'Schedule Id accepts digits only', 'Negative'), async s => {
      await s.step(`Click "Add Submittal", fill spec ${RUN}-SPEC-A, description, Schedule Id "ABC-1", number, supplier, material, click "Add" → message "Only numbers are allowed"; close the dialog`, async () => {
        await k.addSubmittal({ ...A, scheduleId: 'ABC-1' });
        await expect(page.getByText('Only numbers are allowed')).toBeVisible();
        await k.closeDialog('Add Submittal');
      });
    });
    const created = await run.scenario(meta('PL-REG-ADD-01', 'Create a submittal (supplier + material)', 'Positive'), async s => {
      const before = await k.count();
      await s.step(`Click "Add Submittal", fill submittal A (${RUN}-SPEC-A, Schedule Id digits, ${RUN}-SUB-A, supplier LG, material), click "Add" → toast "Submittal added successfully"`, async () => { await k.addSubmittal(A); await k.toast('Submittal added successfully'); }, { critical: true });
      await s.step(`Item count rises by 1; search ${RUN}-SUB-A → the row is listed with Source "Manual"`, async () => {
        await expect.poll(k.count).toBe(before + 1);
        await k.search(A.number);
        await expect(k.rows().filter({ hasText: A.number })).toContainText('Manual');
      });
    });
    await run.scenario(meta('PL-REG-ADD-08', 'Duplicate Submittal No + Material rejected (case and spaces ignored)', 'Negative'), async s => {
      await s.step(`Add Submittal with the same number in lower case with surrounding spaces and the same material, click "Add" → toast "A submittal already exists for Submittal No…"; close the dialog`, async () => {
        await k.addSubmittal({ ...A, spec: `${RUN}-SPEC-B`, scheduleId: num(2), number: ` ${A.number.toLowerCase()} ` });
        await k.toast(/A submittal already exists for Submittal No/);
        await k.closeDialog('Add Submittal');
      });
    });
    await run.scenario(meta('PL-REG-ADD-09', 'Same Submittal No with a different material is allowed (PL-R3)', 'Positive'), async s => {
      await s.step(`Add Submittal ${RUN}-SUB-A (lower case) with a different material (SCP_PL_MATERIAL_2 or "1.2L Kappa Engine"), click "Add" → toast "Submittal added successfully"`, async () => {
        const other = process.env.SCP_PL_MATERIAL_2 || '1.2L Kappa Engine';
        await k.addSubmittal({ ...C, materials: [other] });
        await k.toast('Submittal added successfully');
      });
    });
    // Dev team, 24 Nov 2026: Edit Submittal may give a submittal the same Submittal No + Material as another one – not an
    // issue (SCP-DEF-042 withdrawn). Add Submittal still refuses the pair (PL-REG-ADD-08).
    await run.scenario(meta('PL-REG-EDT-02', 'Edit Submittal saves a material that another submittal with the same number already has', 'Positive'), async s => {
      await s.step(`Search submittal C, row actions › "Edit": replace its material with A's material, click "Update" → toast "Submittal updated successfully"; close the dialog if it is still open`, async () => {
        await k.search(C.description);
        await k.rows().filter({ hasText: C.description }).getByRole('cell').last().click();
        await page.getByRole('menuitem', { name: 'Edit' }).click();
        const m = page.getByRole('heading', { name: 'Edit Submittal' }).locator('xpath=../..');
        await m.getByRole('button', { name: /Kappa|Inches|,/ }).first().click();
        for (const o of await k.listbox().getByRole('option', { selected: true }).all()) await o.click();
        await k.listbox().getByRole('option', { name: MATERIAL, exact: true }).click();
        await page.getByRole('heading', { name: 'Edit Submittal' }).click();
        await m.getByRole('button', { name: 'Update', exact: true }).click();
        await k.toast('Submittal updated successfully');
        await k.closeDialog('Edit Submittal').catch(() => null);
      });
    });

    if (created.status !== 'Passed') { run.abort(`Submittal ${A.number} was not created`); return; }

    // ---------- 4. Components ----------
    await run.scenario(meta('PL-REG-CMP-01', 'Add Component requires date and quantity', 'Negative'), async s => {
      await s.step(`Search ${RUN}-SUB-A and click its Spec Description cell → submittal drawer opens (URL has ?submittal=)`, async () => { await k.search(A.number); await k.openSubmittal(A.description); }, { critical: true });
      await s.step(`Click "Add component", then "ADD" with empty fields → messages "Date Req. on Site is required" and "Quantity is required"; close the dialog`, async () => {
        await k.addComponentButton().click();
        await page.getByRole('button', { name: 'ADD', exact: true }).click();
        for (const m of ['Date Req. on Site is required', 'Quantity is required']) await expect(page.getByText(m)).toBeVisible();
        await k.closeDialog('Add Component');
      });
    });
    const ordered = await run.scenario(meta('PL-REG-CMP-02', 'Component with PO is Ordered with the supplier lead time', 'Positive'), async s => {
      await s.step(`Submittal › "Add component": Date Req. on Site today + 28 days, QTY 10, Value 1000, PO no. ${RUN}-PO-A, PO Date today, click "ADD" → toast "Schedule added successfully!"`, () => k.addComponent({ rojDate: plusDays(28), qty: 10, value: 1000, po: `${RUN}-PO-A`, poDate: PO_DAY }), { critical: true });
      // Since the staging release of 23 Nov 2026 the component row no longer shows an Expected Delivery date
      // (PO date + lead time); the row shows the lead time in weeks, the PO and the ROJ date.
      await s.step(`Component row → Status is "Ordered", lead time "1 week", PO ${RUN}-PO-A and ROJ today + 28 days are shown`, async () => {
        expect(await k.componentStatus()).toBe('Ordered');
        const row = k.componentRow();
        await expect(row).toContainText('1 week');
        await expect(row).toContainText(`${RUN}-PO-A`);
        await expect(row).toContainText(plusDays(28).toLocaleDateString('en-GB'));
      });
    });
    await run.scenario(meta('PL-REG-CMP-06', 'Lead Time update is saved and confirmed', 'Positive'), async s => {
      await s.step(`Component row "⋯" › "Lead time": enter 3, tick the confirm checkbox, click "Submit" → row shows lead time "3 weeks" and "Confirmed"`, async () => {
        await k.componentAction(MATERIAL, 'Lead time');
        const m = k.dialog('Update Lead Time', 'Submit');
        await m.getByRole('spinbutton').fill('3'); await m.getByRole('checkbox').check();
        await m.getByRole('button', { name: 'Submit', exact: true }).click();
        await expect.poll(async () => (await k.componentRow().innerText())).toMatch(/3 weeks/);
        await expect.poll(async () => (await k.componentRow().locator('xpath=./*[5]').innerText()).split('\n').map(t => t.trim())).toContain('Confirmed');
      });
    });
    await run.scenario(meta('PL-REG-CMP-08', 'Update Status to Delivered shows on component and submittal (PL-R13)', 'Positive'), async s => {
      await s.step(`Component row "⋯" › "Update status": choose status "Delivered", note ${RUN} status, click "ADD" → component Status becomes "Delivered"`, async () => {
        await k.componentAction(MATERIAL, 'Update status');
        const m = k.dialog('Update Status', 'ADD');
        await k.pick('Choose Status', 'Delivered', m);
        await m.locator('textarea').fill(`${RUN} status`);
        await m.getByRole('button', { name: 'ADD', exact: true }).click();
        await k.settle(2500);
        const status = await k.componentStatus();
        if (status !== 'Delivered') throw new Error(`Update Status to Delivered did not change the component status (shows "${status}")`);
      });
    });
    await run.scenario(meta('PL-REG-CMP-10', 'Trigger Alert sends the notification (PL-R1/PL-R14)', 'Positive'), async s => {
      await s.step(`Component row "⋯" › "Trigger alert": "Send Notification" opens, click "Send" → toast "Notification sent successfully"`, async () => {
        await k.componentAction(MATERIAL, 'Trigger alert');
        await expect(page.getByRole('heading', { name: 'Send Notification' })).toBeVisible();
        await page.getByRole('button', { name: 'Send', exact: true }).click();
        await k.toast('Notification sent successfully');
      });
    });

    // ---------- 5. Delivery → GRN ----------
    // Since the staging release of 23 Nov 2026 (evening) the component row shows a delivery-state pill ("Ordered",
    // "Received" …) instead of the Procurement Log status; the status of the submittal is read from the list's "Status"
    // column, and the component pill is recorded with it.
    const listStatus = async d => {
      await k.openLog(); await k.search(d.number);
      const heads = (await main.getByRole('columnheader').allInnerTexts()).map(t => t.trim());
      const cells = (await k.rows().filter({ hasText: d.description }).first().getByRole('cell').allInnerTexts()).map(t => t.trim());
      return cells[heads.indexOf('Status')];
    };
    if (ordered.status !== 'Passed') { run.abort('Component was not ordered'); return; }
    const partial = await run.scenario(meta('PL-REG-DLV-13', 'Partial delivery 4 of 10 → Partial Delivery', 'Positive'), async s => {
      let shortage;
      await s.step(`Component "⋯" › "Open component" › "Log delivery": QTY 4 (today, first location, item name); delivery actions: pre-shipping info, approve checklist; "Receive" with today's actual date; shipping info, delivery condition Good 3 / Damage 1, "Generate GRN" → toast "GRN Generated Successfully!"`, async () => { ({ shortage } = await k.deliverToGrn({ qty: 4, good: 3, damage: 1, tag: `${RUN}-D1` })); }, { critical: true, attempts: 1 });
      await s.step(`Back to the submittal (component status recorded), then Procurement Log › search ${RUN}-SUB-A → "Status" is "Partial Delivery"`, async () => {
        s.observe(`Component row status after 4 of 10: "${await k.componentStatus()}"`);
        await expect.poll(() => listStatus(A), { timeout: 30000 }).toBe('Partial Delivery');
      });
      s.observe(`Shortage shown in conditions: ${shortage}`);
      await s.step(`Check the Shortage QTY shown in Delivery Conditions → expected 0 (calculated from the delivered quantity); error if it is not 0`, async () => {
        if (shortage !== 0) throw new Error(`Shortage QTY was calculated from the component quantity (${shortage} instead of 0)`);
      });
    });
    const dlv11 = meta('PL-REG-DLV-11', 'Remaining 6 delivered → Delivered', 'Positive');
    const dlv12 = meta('PL-REG-DLV-12', 'Delivered row shows its Actual Delivery Date (PL-R6)', 'Positive');
    if (partial.status !== 'Passed' && partial.status !== 'Known Defect') { run.skip(dlv11, 'Partial delivery did not complete'); run.skip(dlv12, 'No delivered submittal'); }
    else {
    const full = await run.scenario(dlv11, async s => {
      await s.step(`Open submittal A, component "⋯" › "Open component" › "Log delivery": QTY 6, run the same checklist → approve → Receive → shipping → conditions → "Generate GRN" chain → GRN generated`, async () => {
        await k.openLog(); await k.search(A.number); await k.openSubmittal(A.description);
        await k.deliverToGrn({ qty: 6, tag: `${RUN}-D2` });
      }, { critical: true, attempts: 1 });
      await s.step(`Back to the submittal (component status recorded), then Procurement Log › search ${RUN}-SUB-A → "Status" is "Delivered"`, async () => {
        s.observe(`Component row status after 10 of 10: "${await k.componentStatus()}"`);
        await expect.poll(() => listStatus(A), { timeout: 30000 }).toBe('Delivered');
      });
    });
    if (full.status !== 'Passed') run.skip(dlv12, 'Submittal was not fully delivered');
    else await run.scenario(dlv12, async s => {
      await s.step(`Menu › "Procurement Log", search ${RUN}-SUB-A → the submittal row has a value in "Actual Delivery Date" (not empty or "-")`, async () => {
        await k.openLog(); await k.search(A.number);
        const heads = (await main.getByRole('columnheader').allInnerTexts()).map(t => t.trim());
        const cells = (await k.rows().filter({ hasText: A.description }).first().getByRole('cell').allInnerTexts()).map(t => t.trim());
        const value = cells[heads.indexOf('Actual Delivery Date')];
        if (!value || value === '-') throw new Error('Delivered submittal has no Actual Delivery Date in the Procurement Log');
      });
    });
    }

    // ---------- 3. Responsible / delete (run-owned records only) ----------
    await run.scenario(meta('PL-REG-EDT-03', 'Assign Responsible on a row', 'Positive'), async s => {
      await s.step(`Row actions of submittal A › "Assign Responsible" → dialog "Responsible — ${A.number}"; "Add a Responsible person": pick the signed-in user, "Add" → listed as Responsible; "Done"`, async () => {
        // Open the list and search A here: the scenario must not depend on PL-REG-DLV-12 (skipped when A is not fully delivered).
        await k.openLog(); await k.search(A.number);
        await k.rows().filter({ hasText: A.description }).getByRole('cell').last().click();
        await page.getByRole('menuitem', { name: 'Assign Responsible' }).click();
        const { listed } = await k.addResponsible(config.username);
        s.observe(`Responsible dialog: ${listed.replace(config.username, '(signed-in user)').slice(0, 200)}`);
      });
    });
    await run.scenario(meta('PL-REG-EDT-10', 'Bulk Delete removes two run-created submittals', 'Positive'), async s => {
      await s.step(`Click "Add Submittal" twice to create D1 (${RUN}-SUB-D1) and D2 (${RUN}-SUB-D2) → each shows toast "Submittal added successfully"`, async () => {
        for (const d of [D1, D2]) { await k.addSubmittal(d); await k.toast('Submittal added successfully'); }
      }, { critical: true });
      await s.step(`Search "${RUN} delete" → 2 items; tick both rows, click "Bulk Delete" → "2 submittal(s) will be deleted…"; click "Delete" → toast "2 record(s) deleted." and 0 items remain`, async () => {
        await k.search(`${RUN} delete`);
        await expect.poll(k.count).toBe(2);
        for (const d of [D1, D2]) await k.rows().filter({ hasText: d.description }).getByRole('checkbox').check();
        await main.getByRole('button', { name: 'Bulk Delete', exact: true }).click();
        await expect(page.getByText('2 submittal(s) will be deleted. Are you sure you want to proceed?')).toBeVisible();
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        await k.toast('2 record(s) deleted.');
        await expect.poll(k.count).toBe(0);
      });
    });
  } });
});
