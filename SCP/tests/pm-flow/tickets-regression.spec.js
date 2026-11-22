// Ticket regression – docs/functional-discovery/TICKET_REGRESSION_SCENARIOS.md (BUGS-517, BUGS-543, BUGS-508, BUGS-507, BUGS-548, BUGS-155).
// Tickets tested by hand on staging on 3 Nov 2026 and added to the automation suite. Run-tagged records only (R14, R16).
// Rule outcomes are read back through the app's own API (bearer token of the signed-in tab), so a UI wording change does
// not hide a broken rule. UI presentation issues the user accepted on 3 Nov are not asserted.
const path = require('path');
const { test, expect } = require('@playwright/test');
const { runPmSuite } = require('./support/pm-flow');
const { pmUi } = require('./support/pm-ui');
const { OVERLAY } = require('./support/pm-navigator');
const { plKit, MATERIAL, SUPPLIER } = require('./support/pl-flow');
const { LoginPage } = require('../../pages/login.page');
const { PlatformChooserPage } = require('../../pages/platform-chooser.page');
const { ProjectSelectorPage } = require('../../pages/project-selector.page');
const { SiteSelectorPage } = require('../../pages/site-selector.page');
const { writeUpload } = require('./support/pm-workbook');
const { readWorkbook } = require('../../utils/bulk-upload/inventory-workbook');

const SUITE = 'Ticket Regression';
const meta = (id, module, title, kind) => ({ id, module, submodule: kind, suite: SUITE, title: `[${kind}] ${title}`, navPath: [module] });
const digits = new Date().toISOString().replace(/\D/g, '');
const RUN = `TKT${digits.slice(2, 12)}`;
const num = n => `${digits.slice(0, 12)}${String(n).padStart(2, '0')}`;
const day = d => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate() + d); };
const esc = v => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Staging data (3 Nov): SUPPLIER (LG) maps 43 Inches at 1 week, SECOND_SUPPLIER at 2 weeks; OTHER_SUPPLIER doesn't supply it.
const SECOND_SUPPLIER = process.env.SCP_TKT_SECOND_SUPPLIER || 'Supplier SLD2611021715';
const OTHER_SUPPLIER = process.env.SCP_TKT_OTHER_SUPPLIER || 'supplier19';
const NEW_UOMS = ['Each', 'Sheets', 'Sets', 'Units', 'Openings', 'Pairs', 'Flights', 'Tubes'];

test.describe.configure({ mode: 'serial' });
test.setTimeout(90 * 60 * 1000);

test('Ticket regression – BUGS-517, 543, 508, 507, 548, 155', async ({ page }) => {
  await runPmSuite({ page, suite: SUITE, scenarios: async ({ run, navigator, config, outDir }) => {
    const k = plKit(page);
    const ui = pmUi(page, navigator, outDir);
    const { listbox } = k;
    const data = run.data;
    let token = '';
    let project = '';
    const api = async url => {
      const r = await page.request.get(url, { headers: { Authorization: `Bearer ${token}` } });
      expect(r.status(), `GET ${url.split('?')[0]}`).toBeLessThan(400);
      const body = await r.json();
      return body.data ?? body;
    };
    const submittal = async number => (await api(`/api/submittal_master/list_submittals_by_project_id/?project_id=${project}&from_date=2020-01-01&to_date=2030-12-31&page=1&page_size=25&search=${encodeURIComponent(number)}`)).find(x => x.submittal_no === number);
    const schedules = async id => (await api(`/api/submittal_schedule/list_submittal_schedules/?submittal_id=${id}&project_id=${project}`)).schedules || [];
    const primary = sub => (sub.materials.find(m => m.is_primary) || {}).material_name;

    const login = await run.scenario({ ...meta('TKT-SETUP', 'Setup', `Sign in on ${config.projectName}`, 'Setup'), always: true }, async s => {
      await k.signIn(s, config);
      await s.step('Read the session token and project', async () => {
        token = await page.evaluate(() => localStorage.getItem('_sso_access'));
        project = await page.evaluate(() => localStorage.getItem('selectedProjectId'));
        expect(token && project, 'token and project').toBeTruthy();
      }, { critical: true });
      s.observe(`Run tag ${RUN}`);
    });
    if (login.status !== 'Passed') { run.abort('Setup failed'); return; }

    // =============== BUGS-517 – supplier and primary material edit rules ===============
    const M517 = 'BUGS-517 Submittal edit rules';
    const fresh = async () => { await page.goto('/procurement-log', { waitUntil: 'domcontentloaded' }); await expect.poll(k.count, { timeout: 30000 }).toBeGreaterThan(0); };
    const subs = { A: 'no components', B: 'uncommitted component', C: 'PO component', D: 'delivery-only component', E: 'component on second material' };
    for (const key of Object.keys(subs)) subs[key] = { spec: `${RUN}-SPEC-${key}`, description: `${RUN} ${subs[key]}`, number: `${RUN}-SUB-${key}`, scheduleId: num(key.charCodeAt(0) - 64) };
    const editForm = () => page.getByRole('heading', { name: 'Edit Submittal' }).locator('xpath=../..');
    const openEdit = async d => {
      await fresh(); await k.search(d.number);
      await k.rows().filter({ hasText: d.description }).first().getByRole('cell').last().click();
      await page.getByRole('menuitem', { name: 'Edit' }).click();
      await expect(editForm().getByRole('textbox').nth(3)).not.toHaveValue('', { timeout: 15000 });
    };
    // Unticking and re-ticking the current primary makes the other material first, i.e. primary ("First selected material is the primary").
    const swapPrimary = async current => {
      await editForm().getByRole('button', { name: new RegExp(esc(current)) }).click();
      await listbox().getByRole('option', { name: current, exact: true }).click();
      await listbox().getByRole('option', { name: current, exact: true }).click();
      await page.getByRole('heading', { name: 'Edit Submittal' }).click();
    };
    // Clicks Update and answers the Change Supplier dialog when it appears; returns the dialog text and the PUT outcome.
    const update = async ({ confirm = true } = {}) => {
      const put = page.waitForResponse(r => r.request().method() === 'PUT' && /\/api\/submittal_master\/[0-9a-f-]{36}\/?(\?|$)/.test(r.url()), { timeout: 20000 }).catch(() => null);
      await editForm().getByRole('button', { name: 'Update', exact: true }).click();
      const dlg = page.getByRole('heading', { name: 'Change Supplier', exact: true });
      let dialog = '';
      if (await dlg.isVisible({ timeout: 4000 }).catch(() => false)) {
        dialog = (await dlg.locator('xpath=../..').innerText()).replace(/\s+/g, ' ');
        await page.getByRole('button', { name: confirm ? 'Confirm' : 'Cancel', exact: true }).last().click();
        if (!confirm) return { dialog, status: null, body: '' };
      }
      const r = await put;
      // reqBody / url are kept so T517-17 can replay the form's own PUT against the API.
      return { dialog, status: r && r.status(), body: r ? (await r.text()).slice(0, 600) : '', reqBody: r && r.request().postData(), url: r && r.url() };
    };
    const changeSupplier = async (d, to, opts) => {
      await openEdit(d);
      await editForm().getByRole('button', { name: SUPPLIER, exact: true }).click();
      await listbox().getByRole('option', { name: to, exact: true }).click();
      await page.getByRole('heading', { name: 'Edit Submittal' }).click();
      return update(opts);
    };
    const close = () => k.closeDialog('Edit Submittal').catch(() => page.keyboard.press('Escape'));

    const setup = await run.scenario(meta('T517-SETUP', M517, 'Create run submittals A–E', 'Setup'), async s => {
      await s.step('Pick a second material', async () => {
        // Add Submittal offers only the materials the chosen supplier is mapped to.
        const sups = await api(`/api/supplier_master/list_suppliers_by_project_id/?project_id=${project}`);
        const lg = sups.find(x => x.supplier_name === SUPPLIER);
        const mapped = await api(`/api/supplier_material_mapping/list_material_by_supplier_id/?supplier_master_id=${lg.supplier_master_id}&project_id=${project}`);
        data.m2 = process.env.SCP_TKT_SECOND_MATERIAL || mapped.map(m => m.material_name).find(n => n !== MATERIAL);
        expect(data.m2, 'second material').toBeTruthy(); s.observe(`Second material: ${data.m2}`);
      }, { critical: true });
      for (const [key, d] of Object.entries(subs)) {
        await s.step(`Add submittal ${key}`, async () => {
          await fresh(); await k.addSubmittal({ ...d, materials: [MATERIAL, data.m2] });
          await k.toast('Submittal added successfully');
        }, { critical: true });
        if (key === 'A') continue;
        await s.step(`Add a component to ${key}`, async () => {
          await fresh(); await k.search(d.number); await k.openSubmittal(d.description);
          await k.addComponent({ rojDate: day(45), qty: 2, ...(key === 'C' ? { po: `${RUN}-PO`, poDate: day(0) } : {}), ...(key === 'E' ? { material: data.m2 } : {}) });
        }, { critical: true });
      }
      await s.step('Log a delivery on D (no PO)', async () => {
        await fresh(); await k.search(subs.D.number); await k.openSubmittal(subs.D.description);
        await k.componentRow().getByRole('cell', { name: MATERIAL }).click();
        await k.keepSite(); await page.getByRole('button', { name: '+ Log Delivery' }).last().click();
        const dl = k.dialog('Add Delivery', 'Add');
        await k.day(dl.getByRole('textbox').first(), day(0));
        await dl.getByRole('button', { name: /^(All Locations|Choose Location)$/ }).click();
        await listbox().getByRole('option').filter({ hasNotText: /^(All Locations|Choose Location)$/ }).first().click();
        await dl.getByRole('button', { name: 'Choose Item Name' }).click(); await listbox().getByRole('option', { name: MATERIAL, exact: true }).first().click();
        await dl.getByRole('spinbutton').first().fill('1');
        await dl.getByRole('button', { name: 'Add', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Add Delivery', exact: true })).toBeHidden({ timeout: 20000 });
      }, { critical: true });
      await s.step('Read back ids', async () => { for (const d of Object.values(subs)) d.id = (await submittal(d.number)).submittal_id; });
    });
    const ok517 = setup?.status === 'Passed';
    const sc517 = (id, title, kind, body) => ok517 ? run.scenario(meta(id, M517, title, kind), body) : run.skip(meta(id, M517, title, kind), 'T517-SETUP failed');

    await sc517('T517-01', 'No components: supplier change saves without a dialog', 'Positive', async s => {
      await s.step(`A: ${SUPPLIER} → ${SECOND_SUPPLIER}`, async () => {
        const r = await changeSupplier(subs.A, SECOND_SUPPLIER);
        expect(r.dialog, 'no Change Supplier dialog').toBe('');
        expect(r.status, r.body).toBeLessThan(300);
        expect((await submittal(subs.A.number)).supplier_name).toBe(SECOND_SUPPLIER);
      });
    });
    await sc517('T517-02', 'No components: primary material change saves', 'Positive', async s => {
      await s.step(`A: primary ${MATERIAL} → ${data.m2}`, async () => {
        await openEdit(subs.A); await swapPrimary(MATERIAL);
        const r = await update(); expect(r.status, r.body).toBeLessThan(300);
        expect(primary(await submittal(subs.A.number))).toBe(data.m2);
      });
    });
    await sc517('T517-03', 'New supplier does not supply a component material (message 3, server-side)', 'Negative', async s => {
      await s.step(`B: ${SUPPLIER} → ${OTHER_SUPPLIER}`, async () => {
        const r = await changeSupplier(subs.B, OTHER_SUPPLIER);
        s.observe(`PUT ${r.status}: ${r.body}`);
        expect(r.status, 'rejected by the server (AC 13)').toBeGreaterThanOrEqual(400);
        expect(r.body).toMatch(new RegExp(`Supplier cannot be changed.*${esc(OTHER_SUPPLIER)} does not supply.*${esc(MATERIAL)}`, 'is'));
        await close();
      });
      await s.step('Nothing changed (AC 8)', async () => {
        expect((await submittal(subs.B.number)).supplier_name).toBe(SUPPLIER);
        expect((await schedules(subs.B.id))[0].lead_time_in_weeks).toBe(1);
      });
    });
    await sc517('T517-06', 'Confirmation dialog wording, Cancel saves nothing', 'Negative', async s => {
      await s.step(`B: ${SUPPLIER} → ${SECOND_SUPPLIER}, Cancel`, async () => {
        const r = await changeSupplier(subs.B, SECOND_SUPPLIER, { confirm: false });
        expect(r.dialog).toMatch(new RegExp(`all 1 component\\(s\\).*${esc(SECOND_SUPPLIER)}'s lead times.*Lead Time Confirmed to False`, 'i'));
        await close();
        expect((await submittal(subs.B.number)).supplier_name).toBe(SUPPLIER);
      });
    });
    await sc517('T517-11', 'Primary material used by a component cannot change (message 9)', 'Negative', async s => {
      await s.step(`B: make ${data.m2} primary`, async () => {
        await openEdit(subs.B); await swapPrimary(MATERIAL);
        const r = await update(); s.observe(`PUT ${r.status}: ${r.body}`);
        expect(r.body).toMatch(/Primary material cannot be changed as components are associated with this material/i);
        await close();
        expect(primary(await submittal(subs.B.number))).toBe(MATERIAL);
      });
    });
    await sc517('T517-08', 'Confirm resets lead times and Lead Time Confirmed; audit entry written', 'Positive', async s => {
      await s.step(`B: ${SUPPLIER} → ${SECOND_SUPPLIER}, Confirm`, async () => {
        const r = await changeSupplier(subs.B, SECOND_SUPPLIER);
        expect(r.status, r.body).toBeLessThan(300);
      });
      await s.step('Lead time 1 → 2 weeks, not confirmed', async () => {
        const [c] = await schedules(subs.B.id);
        expect(c.lead_time_in_weeks).toBe(2); expect(c.lead_time_confirmed_flag).toBe(false);
        data.scheduleB = c.submittal_schedule_id;
      });
      await s.step('Lead-time history has the change (AC 7)', async () => {
        const h = await api(`/api/schedule-audit-logs/lead_time_history/?schedule_id=${data.scheduleB}&project_id=${project}`);
        s.observe(JSON.stringify(h).slice(0, 400));
        expect(h.change_count).toBeGreaterThan(0);
        // The history API returns value/time/user only; the "Supplier changed from X to Y" reason lives in LeadTimeChangeAudit (DB).
        expect(h.points.at(-1).value).toBe(2);
      });
    });
    for (const [id, key, label] of [['T517-04', 'C', 'PO'], ['T517-05', 'D', 'delivery only']]) {
      await sc517(id, `Locked by ${label}: message 4, supplier read-only`, 'Negative', async s => {
        await s.step(`Open ${key}`, async () => {
          await openEdit(subs[key]);
          await expect(editForm()).toContainText(/Submittal has components with POs or deliveries/i);
          // Read-only Supplier control: clicking it does not open the supplier list.
          await editForm().getByRole('button', { name: SUPPLIER, exact: true }).click({ force: true });
          await expect(listbox().getByRole('option', { name: SECOND_SUPPLIER, exact: true })).toBeHidden({ timeout: 2000 });
        });
        if (key === 'C') await s.step('Other fields stay editable (AC 14)', async () => {
          await editForm().getByRole('textbox').nth(1).fill(`${subs.C.description} edited`);
          const r = await update(); expect(r.status, r.body).toBeLessThan(300);
          subs.C.description = `${subs.C.description} edited`;
          data.putC = r.reqBody; data.putUrlC = r.url;
        });
        else await close();
      });
    }
    await sc517('T517-17', 'Backend enforces the lock: direct API supplier change on a PO-locked submittal', 'Negative', async s => {
      await s.step(`Replay the Edit form's PUT for C with ${SECOND_SUPPLIER} → rejected with message 4 (AC 13)`, async () => {
        expect(data.putC && data.putUrlC, 'PUT captured in T517-04').toBeTruthy();
        let body;
        try { body = JSON.parse(data.putC); } catch { throw new Error(`The Edit form PUT is not JSON: ${String(data.putC).slice(0, 200)}`); }
        const sups = await api(`/api/supplier_master/list_suppliers_by_project_id/?project_id=${project}`);
        const from = sups.find(x => x.supplier_name === SUPPLIER); const to = sups.find(x => x.supplier_name === SECOND_SUPPLIER);
        const key = Object.keys(body).find(f => body[f] === from.supplier_master_id) || Object.keys(body).find(f => body[f] === SUPPLIER);
        expect(key, 'supplier field in the PUT body').toBeTruthy();
        body[key] = body[key] === SUPPLIER ? SECOND_SUPPLIER : to.supplier_master_id;
        body.confirm_lead_time_reset = true; // so only the PO lock can reject it
        const r = await page.request.put(data.putUrlC, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, data: body });
        const text = (await r.text()).slice(0, 600); s.observe(`PUT ${r.status()}: ${text}`);
        expect(r.status(), 'rejected by the server').toBeGreaterThanOrEqual(400);
        expect(text).toMatch(/Submittal has components with POs or deliveries/i);
      });
      await s.step('Supplier and lead time unchanged (AC 8)', async () => {
        expect((await submittal(subs.C.number)).supplier_name).toBe(SUPPLIER);
        expect((await schedules(subs.C.id))[0].lead_time_in_weeks).toBe(1);
      });
    });
    await sc517('T517-12', 'Primary material not used by any component can change', 'Positive', async s => {
      await s.step(`E (component on ${data.m2}): make ${data.m2} primary`, async () => {
        await openEdit(subs.E); await swapPrimary(MATERIAL);
        const r = await update(); s.observe(`PUT ${r.status}: ${r.body.slice(0, 200)}`);
        expect(r.status, r.body).toBeLessThan(300);
        expect(primary(await submittal(subs.E.number))).toBe(data.m2);
      });
    });
    // ---- Bulk Edit (T517-13…16). Discovery 22 Nov 2026: "Select Columns for Bulk Edit" offers "Supplier Name" and
    // "Material Name"; the "Confirm Bulk Edit" preview lists every ticked record and marks a record the rules refuse as
    // "Skipped: <reason>" ("N record can't be updated and will be skipped"). "Confirm & Apply" applies the values and puts
    // the batch in review (banner "Bulk Update #N — reviewing changes"), where "Confirm" keeps and "Roll Back" restores.
    // T517-14 and T517-16 stop at the preview (nothing applied); T517-13/15 apply one batch and roll it back.
    const bulkLayer = text => page.locator('div.fixed.inset-0').filter({ visible: true }).filter({ hasText: text }).last();
    const reviewBar = () => page.getByText(/Bulk Update #\d+ — reviewing changes/).first().locator('xpath=ancestor::div[.//button[normalize-space()="Roll Back"]][1]');
    const bulk = { batch: null };
    const bulkPreview = async (keys, column, value) => {
      await fresh(); await k.search(RUN);
      // Ticks survive navigation (seen 22 Nov 2026): untick every run row first.
      await page.waitForTimeout(1000);
      for (const box of await k.rows().getByRole('checkbox').all()) if (await box.isChecked().catch(() => false)) await box.uncheck().catch(() => box.click({ force: true }));
      for (const key of keys) await k.rows().filter({ has: page.getByRole('cell', { name: subs[key].number, exact: true }) }).first().getByRole('checkbox').first().check();
      await k.main.getByRole('button', { name: 'Select Columns for Bulk Edit' }).click();
      const cols = bulkLayer('Select Columns for Bulk Edit');
      await cols.getByText(column, { exact: true }).first().click();
      await cols.getByRole('button', { name: 'Next', exact: true }).click();
      const values = bulkLayer('Bulk Edit — Enter Values');
      await values.getByRole('button', { name: new RegExp(`^Choose ${column}`) }).click();
      await listbox().getByRole('option', { name: value, exact: true }).first().click();
      await expect(values).toContainText(value);
      await values.getByRole('button', { name: 'Preview Changes', exact: true }).click();
      const preview = bulkLayer('Confirm Bulk Edit');
      await expect(preview).toBeVisible({ timeout: 15000 });
      return { preview, text: (await preview.innerText()).replace(/\s+/g, ' ') };
    };
    // Leaves the preview without applying anything.
    const closePreview = async () => {
      for (let i = 0; i < 3 && await bulkLayer('Confirm Bulk Edit').isVisible().catch(() => false); i++) await page.keyboard.press('Escape');
      if (await bulkLayer('Confirm Bulk Edit').isVisible().catch(() => false)) await page.reload({ waitUntil: 'domcontentloaded' });
    };
    await sc517('T517-14', 'Bulk Edit: locked row skipped', 'Bulk Edit', async s => {
      // C is on SUPPLIER already, so a different supplier is chosen (choosing its own supplier is no change and is not
      // refused). A has no components, so any supplier is accepted for it.
      await s.step(`Tick A (no components) and C (PO) › "Select Columns for Bulk Edit" › "Supplier Name" › ${OTHER_SUPPLIER} › "Preview Changes" → A will be updated; C "Skipped: … components with POs or deliveries …" (message 4); close without applying`, async () => {
        const { text } = await bulkPreview(['A', 'C'], 'Supplier Name', OTHER_SUPPLIER);
        s.observe(text.slice(0, 600));
        try {
          expect(text).toMatch(/This will update 1 record\b/);
          expect(text).toMatch(/1 record can't be updated and will be skipped/);
          expect(text).toMatch(new RegExp(`${esc(subs.C.number)}\\s*Skipped: Submittal has components with POs or deliveries\\. Supplier/Material cannot be modified while components with POs or deliveries are associated with the submittal\\.`));
          expect(text).not.toMatch(new RegExp(`${esc(subs.A.number)}\\s*Skipped`));
        } finally { await closePreview(); }
      });
      await s.step('Nothing applied: A and C keep their suppliers', async () => {
        expect((await submittal(subs.A.number)).supplier_name).toBe(SECOND_SUPPLIER);
        expect((await submittal(subs.C.number)).supplier_name).toBe(SUPPLIER);
      });
    });
    await sc517('T517-16', 'Bulk Edit: primary material change', 'Bulk Edit', async s => {
      await s.step(`Tick B (component on its primary ${MATERIAL}) and E › "Material Name" › ${data.m2} › "Preview Changes" → B "Skipped: Primary material cannot be changed as components are associated with this material." (message 9); close without applying`, async () => {
        const { text } = await bulkPreview(['B', 'E'], 'Material Name', data.m2);
        s.observe(text.slice(0, 600));
        try {
          expect(text).toMatch(/1 record can't be updated and will be skipped/);
          expect(text).toMatch(new RegExp(`${esc(subs.B.number)}\\s*Skipped: Primary material cannot be changed as components are associated with this material\\.`));
        } finally { await closePreview(); }
      });
      await s.step(`Nothing applied: B's primary material is still ${MATERIAL}`, async () => {
        expect(primary(await submittal(subs.B.number))).toBe(MATERIAL);
      });
    });
    await sc517('T517-13', 'Bulk Edit: one batch confirmation', 'Bulk Edit', async s => {
      await s.step(`Open B › component row › "Lead Time": 2, tick confirm, "Submit" → B's component lead time 2 weeks, Confirmed (so T517-15 can see the flag restored)`, async () => {
        await fresh(); await k.search(subs.B.number); await k.openSubmittal(subs.B.description);
        await k.componentRow().getByRole('button', { name: 'Lead Time' }).click();
        const m = k.dialog('Update Lead Time', 'Submit');
        await m.getByRole('spinbutton').fill('2'); await m.getByRole('checkbox').check();
        await m.getByRole('button', { name: 'Submit', exact: true }).click();
        await expect.poll(async () => (await schedules(subs.B.id))[0].lead_time_confirmed_flag, { timeout: 20000 }).toBe(true);
        expect((await schedules(subs.B.id))[0].lead_time_in_weeks).toBe(2);
      }, { critical: true });
      await s.step(`Tick A and B (both ${SECOND_SUPPLIER}) › "Supplier Name" › ${SUPPLIER} › "Preview Changes" → "This will update 2 records", nothing skipped, and ONE batch notice "Changing the supplier will update the lead times of all 1 component(s) on 1 submittal(s) … Lead Time Confirmed to False"`, async () => {
        const pending = await reviewBar().isVisible().catch(() => false);
        expect(pending, 'no bulk update already waiting for review').toBe(false);
        const { text } = await bulkPreview(['A', 'B'], 'Supplier Name', SUPPLIER);
        s.observe(text.slice(0, 500));
        const ok = /This will update 2 records/.test(text) && !/Skipped:/.test(text);
        if (!ok) await closePreview();
        expect(text).toMatch(/This will update 2 records/);
        expect(text).not.toMatch(/Skipped:/);
        expect(text.match(/Changing the supplier will update the lead times/g) || [], 'one batch notice').toHaveLength(1);
        expect(text).toMatch(/all 1 component\(s\) on 1 submittal\(s\) to the new supplier's lead times, and will set Lead Time Confirmed to False/);
      }, { critical: true });
      await s.step('"Confirm & Apply" (once) → at most one confirmation for the whole batch; banner "Bulk Update #N — reviewing changes"', async () => {
        await bulkLayer('Confirm Bulk Edit').getByRole('button', { name: 'Confirm & Apply', exact: true }).click();
        bulk.applied = true;
        const dialogs = [];
        // A supplier change with components asks once per batch (BUGS-517): answer each confirmation that appears.
        for (let i = 0; i < 3; i++) {
          const ask = page.locator('div.fixed.inset-0').filter({ visible: true }).filter({ has: page.getByRole('button', { name: /^(Confirm|Yes|OK)$/ }) }).filter({ hasNotText: /Bulk Update #\d+ — reviewing/ }).last();
          if (!(await ask.isVisible({ timeout: 4000 }).catch(() => false))) break;
          dialogs.push((await ask.innerText()).replace(/\s+/g, ' ').slice(0, 300));
          await ask.getByRole('button', { name: /^(Confirm|Yes|OK)$/ }).last().click();
          await page.waitForTimeout(1500);
        }
        s.observe(dialogs.length ? `Confirmation(s): ${dialogs.join(' || ')}` : 'No separate confirmation dialog after "Confirm & Apply"');
        await expect(reviewBar(), 'review banner').toBeVisible({ timeout: 30000 });
        const banner = (await reviewBar().innerText()).replace(/\s+/g, ' ');
        bulk.batch = (banner.match(/#(\d+)/) || [])[1];
        s.observe(banner.slice(0, 200));
        expect(dialogs.length, 'one confirmation for the whole batch, not one per submittal').toBeLessThanOrEqual(1);
        expect(banner).toMatch(/2 applied/);
      }, { critical: true });
      await s.step(`While in review: A and B show ${SUPPLIER}; B's lead time is ${SUPPLIER}'s (1 week) and not confirmed`, async () => {
        expect((await submittal(subs.A.number)).supplier_name).toBe(SUPPLIER);
        expect((await submittal(subs.B.number)).supplier_name).toBe(SUPPLIER);
        const [c] = await schedules(subs.B.id);
        s.observe(`B: lead time ${c.lead_time_in_weeks} week(s), confirmed ${c.lead_time_confirmed_flag}`);
        expect(c.lead_time_in_weeks).toBe(1); expect(c.lead_time_confirmed_flag).toBe(false);
      });
    });
    await sc517('T517-15', 'Bulk Edit Roll Back restores lead times', 'Bulk Edit', async s => {
      await s.step('Review banner of the T517-13 batch › "Roll Back" → banner gone', async () => {
        expect(bulk.batch, 'batch applied by T517-13').toBeTruthy();
        const bar = reviewBar();
        expect(await bar.innerText()).toContain(`#${bulk.batch}`);
        await bar.getByRole('button', { name: 'Roll Back', exact: true }).click();
        await page.waitForTimeout(1500);
        const ask = page.locator('div.fixed.inset-0').filter({ visible: true }).filter({ has: page.getByRole('button', { name: /^(Roll Back|Yes|Confirm)$/ }) }).last();
        if (await ask.isVisible().catch(() => false)) await ask.getByRole('button', { name: /^(Roll Back|Yes|Confirm)$/ }).last().click();
        await expect(bar).toBeHidden({ timeout: 30000 });
        bulk.rolledBack = true;
      }, { critical: true });
      await s.step(`A and B are back on ${SECOND_SUPPLIER}; B's lead time is 2 weeks and Confirmed again`, async () => {
        expect((await submittal(subs.A.number)).supplier_name).toBe(SECOND_SUPPLIER);
        expect((await submittal(subs.B.number)).supplier_name).toBe(SECOND_SUPPLIER);
        const [c] = await schedules(subs.B.id);
        s.observe(`B: lead time ${c.lead_time_in_weeks} week(s), confirmed ${c.lead_time_confirmed_flag}`);
        expect(c.lead_time_in_weeks, 'lead time restored').toBe(2);
        expect(c.lead_time_confirmed_flag, 'Lead Time Confirmed restored').toBe(true);
      });
    });
    // Safety net: a batch this run applied must not stay in review (it blocks Procurement Log search for later suites).
    if (bulk.applied && !bulk.rolledBack && bulk.batch) {
      await fresh().catch(() => null);
      const bar = reviewBar();
      if (await bar.isVisible().catch(() => false) && (await bar.innerText()).includes(`#${bulk.batch}`)) {
        console.log(`  ⚠ Bulk Update #${bulk.batch} left in review by T517-13 – rolled back`);
        await bar.getByRole('button', { name: 'Roll Back', exact: true }).click().catch(() => null);
      }
    }

    // =============== BUGS-543 – FDI question set categories from the Material Category master ===============
    const M543 = 'BUGS-543 FDI question set categories';
    const NEW_CAT = `Cat543 ${RUN}`;
    const SET = `Set543 ${RUN}`;
    const modal = () => page.locator(OVERLAY).filter({ visible: true }).filter({ hasText: 'New FDI Inspection Question Set' }).last();
    const openSetDialog = async () => {
      if (await modal().isVisible().catch(() => false)) await page.keyboard.press('Escape');
      await navigator.open('First Delivery Inspection Config');
      await ui.click(ui.button('New Question Set'), 'New Question Set');
      await expect(modal()).toBeVisible();
    };
    const searchCat = async text => { await modal().getByPlaceholder(/search/i).fill(text); await page.waitForTimeout(800); };
    const categories = async () => api(`/api/project_material_category/?project_id=${project}`);

    await run.scenario(meta('T543-07', M543, 'Add a new Material Category from the question set dialog', 'Positive'), async s => {
      await s.step('Open New Question Set', openSetDialog, { critical: true });
      await s.step(`Type "${NEW_CAT}" → "+ Add … as a new Material Category"`, async () => {
        await searchCat(NEW_CAT);
        await modal().getByText(new RegExp(`\\+ Add '${esc(NEW_CAT)}' as a new Material Category`)).click();
        await expect(modal().locator('label', { hasText: NEW_CAT }).locator('input[type="checkbox"]')).toBeChecked();
      }, { critical: true });
      await s.step('Created in the project Material Category master (AC 10, 13)', async () => {
        expect((await categories()).filter(c => c.name === NEW_CAT)).toHaveLength(1);
      });
      await s.step(`Create "${SET}" with the category that has no materials (AC 1, 6)`, async () => {
        await modal().getByPlaceholder('e.g. Steel Receiving Checks').fill(SET);
        await modal().getByRole('button', { name: 'Create Question Set', exact: true }).click();
        await expect(modal()).toBeHidden({ timeout: 10000 });
      });
    });
    await run.scenario(meta('T543-03', M543, 'Category owned by another set is visible but not selectable', 'Negative'), async s => {
      await s.step('Open New Question Set', openSetDialog, { critical: true });
      await s.step(`Search "${NEW_CAT}"`, async () => {
        await searchCat(NEW_CAT);
        await expect(modal().getByText(new RegExp(`\\(in: ${esc(SET)}\\)`, 'i'))).toBeVisible();
        await expect(modal().locator('label', { hasText: NEW_CAT }).locator('input[type="checkbox"]')).toBeDisabled();
      });
    });
    await run.scenario(meta('T543-09', M543, 'Existing name in another case is selected, not duplicated', 'Negative'), async s => {
      await s.step('Open New Question Set', openSetDialog, { critical: true });
      await s.step('Type an existing free category in upper case', async () => {
        const used = new Set();
        const cat = (await categories()).find(c => /^[A-Za-z ]{4,40}$/.test(c.name) && !used.has(c.name));
        expect(cat, 'an existing category').toBeTruthy();
        await searchCat(cat.name.toUpperCase());
        const add = modal().getByText(/\+ Add '.*' as a new Material Category/);
        s.observe(`Typed ${cat.name.toUpperCase()}; add option shown: ${await add.isVisible().catch(() => false)}`);
        if (await add.isVisible().catch(() => false)) {
          await add.click();
          await expect(page.getByText(/already exists and has been selected/i).first()).toBeVisible();
        }
        expect((await categories()).filter(c => c.name.toLowerCase() === cat.name.toLowerCase())).toHaveLength(1);
      });
    });
    await run.scenario(meta('T543-08', M543, 'Name rules: blank and over 200 characters', 'Boundary'), async s => {
      await s.step('Open New Question Set', openSetDialog, { critical: true });
      await s.step('Spaces only: no add option', async () => {
        await searchCat('   ');
        await expect(modal().getByText(/\+ Add '.*' as a new Material Category/)).toBeHidden();
      });
      await s.step('201 characters is not created', async () => {
        const long = `L${RUN}`.padEnd(201, 'x');
        await searchCat(long);
        const add = modal().getByText(/\+ Add '.*' as a new Material Category/);
        if (await add.isVisible().catch(() => false)) await add.click();
        await page.waitForTimeout(1500);
        expect((await categories()).filter(c => c.name.startsWith(`L${RUN}`) && c.name.length > 200)).toHaveLength(0);
      });
    });
    await run.scenario(meta('T543-02', M543, 'Category list is sorted alphabetically', 'Positive'), async s => {
      await s.step('Open New Question Set', openSetDialog, { critical: true });
      await s.step('Labels in order', async () => {
        await searchCat('');
        const names = (await modal().locator('label').filter({ has: page.locator('input[type="checkbox"]') }).allInnerTexts())
          .map(t => t.split('\n')[0].trim()).filter(t => t && !/All Categories|Specific categories/i.test(t));
        expect(names, 'alphabetical').toEqual([...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })));
        await page.keyboard.press('Escape');
      });
    });
    await run.scenario(meta('T543-12', M543, 'Category API without project_id returns only this project', 'Security'), async s => {
      await s.step('GET /api/project_material_category/', async () => {
        const all = await api('/api/project_material_category/');
        const projects = [...new Set(all.map(c => c.project_id))];
        s.observe(`${all.length} categories from ${projects.length} project(s)`);
        expect(projects.length, 'categories leak across projects (raise a separate ticket)').toBeLessThanOrEqual(1);
      });
    });
    await run.scenario(meta('T543-04', M543, 'Edit shows the linked categories selected', 'Positive'), async s => {
      await s.step(`Select set "${SET}", click ✎ → "${NEW_CAT}" is ticked (AC 4)`, async () => {
        if (await modal().isVisible().catch(() => false)) await page.keyboard.press('Escape');
        await navigator.open('First Delivery Inspection Config');
        await page.locator('main').getByRole('button', { name: new RegExp(`^${esc(SET)}`) }).first().click();
        await page.locator('main').getByRole('button', { name: '✎', exact: true }).first().click();
        const edit = page.locator(OVERLAY).filter({ visible: true }).filter({ hasText: /Question Set/ }).last();
        await expect(edit).toBeVisible();
        await edit.getByPlaceholder(/search/i).fill(NEW_CAT); await page.waitForTimeout(800);
        await expect(edit.locator('label', { hasText: NEW_CAT }).locator('input[type="checkbox"]')).toBeChecked();
        await page.keyboard.press('Escape');
      });
    });
    await run.scenario(meta('T543-10', M543, 'Category added from the dialog appears on the Material Category screen', 'Integration'), async s => {
      await s.step(`Reference Data › Material Category, search "${NEW_CAT}" → listed once (AC 13)`, async () => {
        if (await modal().isVisible().catch(() => false)) await page.keyboard.press('Escape');
        await navigator.open('Material Category');
        await page.getByPlaceholder('Search categories…').fill(NEW_CAT); await page.waitForTimeout(1200);
        await expect(page.locator('main').getByText(NEW_CAT, { exact: true })).toHaveCount(1);
      });
    });
    await run.scenario(meta('T543-11', M543, 'Category added outside the dialog (no materials) is listed and selectable', 'Integration'), async s => {
      const outside = `Cat543b ${RUN}`;
      await s.step(`Create "${outside}" through the Material Category API (the screen's own call)`, async () => {
        const r = await page.request.post('/api/project_material_category/', { headers: { Authorization: `Bearer ${token}` }, data: { name: outside, project_id: project, added_by: config.username } });
        expect(r.status(), (await r.text()).slice(0, 300)).toBeLessThan(300);
      }, { critical: true });
      await s.step(`New Question Set, search "${outside}" → listed and selectable (AC 1, 16)`, async () => {
        await openSetDialog(); await searchCat(outside);
        await expect(modal().locator('label', { hasText: outside }).locator('input[type="checkbox"]')).toBeEnabled();
        await page.keyboard.press('Escape');
      });
    });
    run.skip(meta('T543-06', M543, 'Inspector mapping uses the master list', 'Deferred'), 'Covered in the PM regression part 2 FDI scenarios; to be linked to BUGS-543 there');

    // =============== BUGS-508 + BUGS-507 – Material bulk upload ===============
    const M508 = 'BUGS-508/507 Material bulk upload';
    const layers = () => page.locator(OVERLAY).filter({ visible: true });
    const progress = () => layers().filter({ hasText: /bulk upload/i }).last();
    const materials = async () => api(`/api/material_master/list_material_master_by_project_id/?project_id=${project}`);
    const byName = async name => (await materials()).filter(m => m.material_name.toLowerCase() === name.toLowerCase());
    const CAT_NEW = `Cat508 ${RUN}`;
    const rows = {
      comma: `Mat507 ${RUN}, Type L`,
      chars: `Mat507b ${RUN} (A) #2 / x-y`,
      caseUom: `Mat508 Case ${RUN}`,
      skuBlank: `Mat508 Sku0 ${RUN}`,
      skuNoConv: `Mat508 Sku1 ${RUN}`,
      skuZero: `Mat508 Sku2 ${RUN}`,
      skuConvOnly: `Mat508 Sku3 ${RUN}`,
      newCat: `Mat508 Cat ${RUN}`,
      badUom: `Mat508 Uom ${RUN}`
    };
    const upload = await run.scenario(meta('T508-01', M508, 'Template UOM dropdown lists the new units', 'Positive'), async s => {
      await s.step('Open Material Master', () => navigator.open('Material Master'), { critical: true });
      await s.step('Download the template', async () => {
        await ui.click(ui.button('Upload'), 'Upload');
        data.template = (await ui.download(page.getByText('Download Template', { exact: true }).first(), 'Download Template')).path;
        await page.keyboard.press('Escape'); await page.mouse.click(5, 300);
      }, { critical: true });
      await s.step('_Lists sheet has Each, Sheets, Sets, Units, Openings, Pairs, Flights, Tubes', async () => {
        const list = (readWorkbook(data.template)._Lists || []).map(r => String(Object.values(r)[0]).trim().toLowerCase());
        for (const u of NEW_UOMS) expect(list, `UOM ${u}`).toContain(u.toLowerCase());
      });
    });
    const uploaded = upload?.status === 'Passed' && await run.scenario(meta('T508-05', M508, 'One upload: decision step, choices, summary', 'Integration'), async s => {
      const base = { category: 'DIVISION-03_CONCRETE', uom: 'pieces' };
      const file = writeUpload({ template: data.template, sheet: 'Materials', output: path.join(outDir, 'uploads', `tkt-508-${RUN}.xlsx`), rows: [
        { ...base, material_name: rows.comma }, { ...base, material_name: rows.chars }, { ...base, material_name: rows.caseUom },
        { ...base, material_name: rows.skuBlank }, { ...base, material_name: rows.skuNoConv, item_name: `Itm1 ${RUN}` },
        { ...base, material_name: rows.skuZero, item_name: `Itm2 ${RUN}`, item_conversion: 0 }, { ...base, material_name: rows.skuConvOnly, item_conversion: 5 },
        { ...base, category: CAT_NEW, material_name: rows.newCat }, { ...base, uom: `Bogus ${RUN}`, material_name: rows.badUom }
      ] });
      await s.step('Upload the file', async () => {
        await ui.click(ui.button('Upload'), 'Upload');
        const chooser = page.waitForEvent('filechooser', { timeout: 15000 });
        await page.getByText('Upload File', { exact: true }).last().click();
        await (await chooser).setFiles(file);
        const conf = layers().filter({ hasText: 'Upload Confirmation' }).last();
        if (await conf.isVisible({ timeout: 5000 }).catch(() => false)) await conf.getByRole('button', { name: 'Upload', exact: true }).click();
      }, { critical: true });
      await s.step('Decision screen lists each unmatched value once with its row count (AC 5)', async () => {
        const decision = progress().getByRole('status').filter({ hasText: /Waiting for your input/ });
        await expect(decision).toBeVisible({ timeout: 180000 });
        const text = (await progress().innerText()).replace(/\s+/g, ' ');
        s.observe(text.slice(0, 500));
        expect(text).toContain(CAT_NEW); expect(text).toContain(`Bogus ${RUN}`);
        expect(text, 'DIVISION-03_CONCRETE matched an existing category (AC 3)').not.toMatch(/DIVISION-03_CONCRETE/);
        await expect(progress().getByRole('button', { name: 'Continue', exact: true })).toBeDisabled(); // UOM needs a choice (AC 7)
      }, { critical: true });
      await s.step('Create the category as new, reject the UOM rows, Continue', async () => {
        await progress().getByText('Create all as new', { exact: true }).click();
        await progress().getByText('UOMs not found', { exact: false }).locator('xpath=..').getByText('Reject all', { exact: true }).click();
        await progress().getByRole('button', { name: 'Continue', exact: true }).click();
        await expect(progress()).toContainText(/Total rows/i, { timeout: 180000 });
      }, { critical: true });
      await s.step('Summary reconciles; error file link (AC 16, 18)', async () => {
        const text = (await progress().innerText()).replace(/\s+/g, ' ');
        data.summary = text.match(/Total rows[\s\S]*$/)?.[0] || text; s.observe(data.summary.slice(0, 600));
        const n = label => Number((text.match(new RegExp(`${label}\\D*(\\d+)`, 'i')) || [])[1]);
        expect(n('Succeeded') + n('Duplicates') + n('Rejected'), 'succeeded + duplicates + rejected = total').toBe(n('Total rows'));
        await expect(progress().getByText(/error file/i).first()).toBeVisible();
        await progress().getByRole('button', { name: 'Close', exact: true }).last().click();
      });
    });
    const up = uploaded && uploaded.status === 'Passed';
    const sc508 = (id, title, kind, body) => up ? run.scenario(meta(id, M508, title, kind), body) : run.skip(meta(id, M508, title, kind), 'T508-05 upload did not complete');
    await sc508('T507-01', 'Comma kept in the material name (BUGS-507)', 'Positive', async s => {
      await s.step(`"${rows.comma}" saved as written`, async () => {
        const kept = await byName(rows.comma); const stripped = await byName(rows.comma.replace(/,/g, ''));
        s.observe(`as written: ${kept.length}, comma removed: ${stripped.length}`);
        expect(stripped, 'saved without the comma').toHaveLength(0);
        expect(kept.length + (data.summary.match(/comma/i) ? 1 : 0), 'saved with the comma, or rejected with a comma reason').toBeGreaterThan(0);
      });
    });
    await sc508('T507-02', 'Other characters kept: ( ) # / -', 'Positive', async s => {
      // Open question on BUGS-507: whether ( ) # / - are allowed. Record what was saved; fail only if the row vanished silently.
      await s.step(`"${rows.chars}"`, async () => {
        const saved = (await materials()).filter(m => m.material_name.startsWith(`Mat507b ${RUN}`)).map(m => m.material_name);
        s.observe(`Saved as: ${saved.join(' | ') || '(not created)'}`);
        expect(saved.length || /rejected/i.test(data.summary), 'created or reported as rejected').toBeTruthy();
      });
    });
    await sc508('T508-02', 'UOM matched ignoring case; category matched ignoring case/punctuation', 'Positive', async s => {
      await s.step(`"${rows.caseUom}" created with Pieces under Division 03 - Concrete`, async () => {
        const [m] = await byName(rows.caseUom);
        expect(m, 'created').toBeTruthy(); expect(m.uom_name).toBe('Pieces'); expect(m.category).toBe('Division 03 - Concrete');
      });
    });
    await sc508('T508-06', 'New category created once and used', 'Positive', async s => {
      await s.step(CAT_NEW, async () => { const [m] = await byName(rows.newCat); expect(m && m.category).toBe(CAT_NEW); });
    });
    await sc508('T508-08', 'Rejected UOM rows are not imported', 'Negative', async s => {
      await s.step(rows.badUom, async () => { expect(await byName(rows.badUom)).toHaveLength(0); expect(data.summary).toMatch(/UOM rejected at your request/i); });
    });
    await sc508('T508-10', 'SKU both blank → default SKU', 'Positive', async s => {
      await s.step(rows.skuBlank, async () => { const [m] = await byName(rows.skuBlank); expect(m && m.item_count).toBe(1); });
    });
    await sc508('T508-11', 'item_name without conversion is rejected', 'Negative', async s => {
      await s.step(rows.skuNoConv, async () => { expect(await byName(rows.skuNoConv)).toHaveLength(0); expect(data.summary).toMatch(/SKU conversion missing/i); });
    });
    await sc508('T508-12', 'Conversion 0 is rejected', 'Boundary', async s => {
      await s.step(rows.skuZero, async () => { expect(await byName(rows.skuZero)).toHaveLength(0); expect(data.summary).toMatch(/Invalid SKU conversion/i); });
    });
    await sc508('T508-13', 'Conversion without item_name → default SKU', 'Positive', async s => {
      await s.step(rows.skuConvOnly, async () => { const [m] = await byName(rows.skuConvOnly); expect(m && m.item_count).toBe(1); });
    });
    for (const [id, title] of [['T508-14', 'Cancel upload rolls back'], ['T508-17', 'Bulk Upload Status matches the outcome'], ['T508-18', 'Non-Project-Admin has no upload'], ['T508-19', 'Resume at the decision step']])
      run.skip(meta(id, M508, title, 'Deferred'), 'Not in this pass (credit budget); see BUGS-508_Tracker.xlsx for the 3 Nov manual result');

    // =============== BUGS-548 – Organisation question sets ===============
    // Screens and API observed on staging 10 Nov (read-only discovery). The source set is an existing project set;
    // only run-named organisation sets / copies / categories are created, and only the run's own org set is deleted (R16).
    const M548 = 'BUGS-548 Organisation question sets';
    const SOURCE = process.env.SCP_TKT548_SOURCE_SET || 'CLD548 Source';
    const ALT_SOURCE = process.env.SCP_TKT548_ALT_SOURCE_SET || 'Phone';
    const ALL_CAT_ORG = process.env.SCP_TKT548_ALL_CATEGORIES_ORG_SET || 'Spade General Site Arrival';
    const SECOND_PROJECT = process.env.SCP_FDI_SECOND_PROJECT || ''; // project id in the same organisation
    const OTHER_ORG_PROJECT = process.env.SCP_TKT548_OTHER_ORG_PROJECT || ''; // project id in another organisation
    const ORG = `Org548 ${RUN}`;
    const ORG_RENAMED = `Org548 ${RUN} renamed`;
    const COPY = `Copy548 ${RUN}`;
    const CAT548 = `Cat548 ${RUN}`;
    const fdiMain = () => page.locator('main');
    const layer = heading => page.locator(OVERLAY).filter({ visible: true }).filter({ has: page.getByRole('heading', { name: heading, exact: true }) }).last();
    const closeLayer = async heading => { const l = layer(heading); if (await l.isVisible().catch(() => false)) await l.getByRole('button', { name: /^(close|Cancel)$/ }).first().click(); await expect(l).toBeHidden({ timeout: 10000 }); };
    const orgSets = async (pid = project) => api(`/api/org_fdi_question_set/?project_id=${pid}`);
    const orgSet = async name => (await orgSets()).find(x => x.name === name);
    const orgDetail = async id => api(`/api/org_fdi_question_set/${id}/?project_id=${project}`);
    const projectSet = async name => (await api(`/api/fdi_question_set/list_sets/?project_id=${project}`)).find(x => x.name === name);
    const fdiConfig = async () => { await navigator.open('First Delivery Inspection Config'); await k.settle(1500); };
    const chip = name => fdiMain().getByRole('button', { name: new RegExp(`^${esc(name)}`) }).first();
    const orgSection = async () => {
      const link = fdiMain().getByRole('button', { name: /^Organisation Question Sets/ });
      if ((await link.getAttribute('aria-expanded')) !== 'true') { await link.click(); await k.settle(800); }
      return link.locator('xpath=ancestor::*[.//table][1]');
    };
    const orgRow = async name => (await orgSection()).getByRole('row').filter({ has: page.getByRole('cell', { name, exact: true }) });
    const pickOption = async (select, prefix) => {
      const label = (await select.locator('option').allInnerTexts()).find(t => t.startsWith(`${prefix} (`));
      expect(label, `option "${prefix} (…)"`).toBeTruthy();
      await select.selectOption({ label });
    };
    const openSave = async setName => {
      await fdiConfig(); await chip(setName).click(); await k.settle(800);
      await fdiMain().getByRole('button', { name: 'Save to Organisation', exact: true }).click();
      const d = layer('Save as Organisation Question Set'); await expect(d).toBeVisible();
      return d;
    };
    const submitSave = async d => {
      const resp = page.waitForResponse(r => r.request().method() === 'POST' && /org_fdi_question_set/.test(r.url()), { timeout: 20000 }).catch(() => null);
      await d.getByRole('button', { name: 'Save', exact: true }).click();
      const r = await resp; await k.settle(800);
      return { status: r && r.status(), body: r ? (await r.text()).slice(0, 600) : '' };
    };

    const saved = await run.scenario(meta('T548-01', M548, `Save "${SOURCE}" to the organisation`, 'Positive'), async s => {
      await s.step(`Select "${SOURCE}", "Save to Organisation" → name starts as the set name (AC 2)`, async () => {
        const d = await openSave(SOURCE);
        await expect(d.getByRole('textbox').first()).toHaveValue(SOURCE);
        await d.getByRole('textbox').first().fill(ORG);
        const r = await submitSave(d); s.observe(`POST ${r.status}: ${r.body.slice(0, 200)}`);
        expect(r.status, r.body).toBeLessThan(300);
      }, { critical: true });
      await s.step('Organisation set copies the groups, questions and categories as suggestions (AC 1, 3)', async () => {
        const src = await projectSet(SOURCE); const org = await orgSet(ORG);
        expect(org, 'organisation set listed').toBeTruthy();
        data.org548 = org.org_question_set_id;
        expect(org.question_count).toBe(src.question_count);
        expect(org.is_all_categories).toBe(src.is_all_categories);
        expect([...org.suggested_category_names].sort()).toEqual(src.categories.map(c => c.name).sort());
        expect(org.added_by).toBe(config.username);
        const detail = await orgDetail(data.org548);
        data.org548Items = detail.items.map(i => i.question_text);
        s.observe(`${detail.groups.length} group(s), ${detail.items.length} question(s): ${detail.items.map(i => `${i.question_text} [${i.answer_type_expected}${i.required ? ', required' : ''}${i.choice_values ? `: ${i.choice_values.join('/')}` : ''}]`).join(' | ').slice(0, 400)}`);
      });
      await s.step('List row shows name, counts, suggested categories and Created By (AC 5)', async () => {
        const row = await orgRow(ORG);
        await expect(row).toBeVisible();
        await expect(row).toContainText(config.username);
        for (const c of (await orgSet(ORG)).suggested_category_names) await expect(row).toContainText(c);
      });
    });
    const ok548 = saved?.status === 'Passed';
    const sc548 = (id, title, kind, body) => ok548 ? run.scenario(meta(id, M548, title, kind), body) : run.skip(meta(id, M548, title, kind), 'T548-01 did not save the organisation set');

    await sc548('T548-02', 'Name rules: same name in other case and empty name are refused', 'Negative', async s => {
      await s.step(`Save "${SOURCE}" again as "${ORG.toUpperCase()}" → refused, still one set (AC 2)`, async () => {
        const d = await openSave(SOURCE);
        await d.getByRole('textbox').first().fill(ORG.toUpperCase());
        const r = await submitSave(d); s.observe(`POST ${r.status}: ${r.body.slice(0, 200)}`);
        const shown = (await page.locator('body').innerText()).includes('An organisation question set with this name already exists');
        expect(r.status >= 400 || shown, 'duplicate name refused').toBeTruthy();
        expect((await orgSets()).filter(x => x.name.toLowerCase() === ORG.toLowerCase())).toHaveLength(1);
        await closeLayer('Save as Organisation Question Set');
      });
      await s.step('Empty name → Save disabled or refused', async () => {
        const before = (await orgSets()).length;
        const d = await openSave(SOURCE);
        await d.getByRole('textbox').first().fill('');
        const save = d.getByRole('button', { name: 'Save', exact: true });
        if (await save.isEnabled()) await submitSave(d);
        expect((await orgSets()).length, 'no set saved with an empty name').toBe(before);
        await closeLayer('Save as Organisation Question Set');
      });
    });
    await sc548('T548-03', 'View is read-only and lists groups and questions in order', 'Positive', async s => {
      await s.step(`Organisation Question Sets › "${ORG}" › View`, async () => {
        await fdiConfig();
        await (await orgRow(ORG)).getByRole('button', { name: 'View', exact: true }).click();
        const v = layer(ORG); await expect(v).toBeVisible();
        const text = (await v.innerText()).replace(/\s+/g, ' ');
        expect(text).toMatch(new RegExp(`${data.org548Items.length} questions?`));
        let at = -1; for (const q of data.org548Items) { const i = text.indexOf(q.trim()); expect(i, `"${q}" after the previous question`).toBeGreaterThan(at); at = i; }
        await expect(v.getByRole('textbox')).toHaveCount(0);
        await expect(v.getByRole('checkbox')).toHaveCount(0);
        await v.getByRole('button', { name: 'close' }).click();
      });
    });
    const copied = await sc548('T548-07', 'Create a project set from the organisation set (copy)', 'Positive', async s => {
      const d = () => layer('Create from Organisation Question Set');
      await s.step(`"Create from Organisation Set", choose "${ORG}" → name starts as the organisation set's name (AC 9)`, async () => {
        await fdiConfig();
        await fdiMain().getByRole('button', { name: 'Create from Organisation Set' }).click();
        await expect(d()).toBeVisible();
        await pickOption(d().getByRole('combobox', { name: 'Organisation Question Set' }), ORG);
        await expect(d().getByPlaceholder('e.g. Steel Receiving Checks')).toHaveValue(ORG);
        await d().getByPlaceholder('e.g. Steel Receiving Checks').fill(COPY);
      }, { critical: true });
      await s.step(`Suggested categories already in "${SOURCE}" are shown "(in: ${SOURCE})" and can't be selected (AC 10)`, async () => {
        for (const c of (await projectSet(SOURCE)).categories) {
          const box = d().getByRole('checkbox', { name: `${c.name} (in: ${SOURCE})` });
          await expect(box).toBeDisabled();
        }
      });
      await s.step(`Search "${CAT548}" → "+ Add" creates and ticks it (AC 10, Story J)`, async () => {
        await d().getByPlaceholder('Search or add a category').fill(CAT548); await page.waitForTimeout(800);
        await d().getByText(new RegExp(`\\+ Add '${esc(CAT548)}' as a new Material Category`)).click();
        await expect(d().getByRole('checkbox', { name: CAT548 })).toBeChecked();
      }, { critical: true });
      await s.step('Create → new set has the same questions, linked to the organisation set (AC 11, 13, 17)', async () => {
        await d().getByRole('button', { name: /^Create( Question Set)?$/ }).click();
        await expect(d()).toBeHidden({ timeout: 20000 });
        const c = await projectSet(COPY); expect(c, 'copy listed').toBeTruthy();
        expect(c.question_count).toBe(data.org548Items.length);
        expect(c.categories.map(x => x.name)).toEqual([CAT548]);
        expect(c.created_from && c.created_from.name).toBe(ORG);
        expect(c.copied_by).toBe(config.username);
        expect(c.modified_after_copy).toBe(false);
      });
    });
    const okCopy = copied && copied.status === 'Passed';
    const scCopy = (id, title, kind, body) => okCopy ? run.scenario(meta(id, M548, title, kind), body) : run.skip(meta(id, M548, title, kind), 'T548-07 did not create the copy');
    const createdFrom = () => fdiMain().getByText(/^Created from:/);

    await scCopy('T548-13', '"Created from" line on the copy only', 'Positive', async s => {
      await s.step(`Select "${COPY}" → "Created from: ${ORG} on <date> by <user>" (AC 18)`, async () => {
        await fdiConfig(); await chip(COPY).click(); await k.settle(800);
        await expect(createdFrom()).toContainText(new RegExp(`Created from: ${esc(ORG)} on \\d{2}/\\d{2}/\\d{4} by ${esc(config.username)}`));
        await expect(createdFrom()).not.toContainText('Edited in this project since');
      });
      await s.step(`Select "${SOURCE}" (built by hand) → no "Created from" line`, async () => {
        await chip(SOURCE).click(); await k.settle(800);
        await expect(createdFrom()).toHaveCount(0);
      });
    });
    await scCopy('T548-15', 'Moving a question in the copy marks it "Edited in this project since"; the organisation set is unchanged', 'Positive', async s => {
      await s.step(`Select "${COPY}", move the first question down (▼)`, async () => {
        await fdiConfig(); await chip(COPY).click(); await k.settle(800);
        await fdiMain().getByRole('button', { name: '▼', exact: true }).first().click(); await k.settle(1500);
      });
      await s.step('Copy is flagged as edited (AC 19)', async () => {
        expect((await projectSet(COPY)).modified_after_copy).toBe(true);
        await page.reload({ waitUntil: 'domcontentloaded' }); await k.settle(1500);
        await chip(COPY).click(); await k.settle(800);
        await expect(createdFrom()).toContainText('Edited in this project since');
      });
      await s.step('Organisation set keeps its order (AC 12)', async () => {
        expect((await orgDetail(data.org548)).items.map(i => i.question_text)).toEqual(data.org548Items);
      });
    });
    if (SECOND_PROJECT || OTHER_ORG_PROJECT) await sc548('T548-04', 'Organisation sets are shared within the organisation only', 'Integration', async s => {
      if (SECOND_PROJECT) await s.step(`Project ${SECOND_PROJECT} (same organisation) lists "${ORG}" (AC 5)`, async () => {
        expect((await orgSets(SECOND_PROJECT)).map(x => x.name)).toContain(ORG);
      });
      if (OTHER_ORG_PROJECT) await s.step(`Project ${OTHER_ORG_PROJECT} (other organisation) does not list "${ORG}"`, async () => {
        const r = await page.request.get(`/api/org_fdi_question_set/?project_id=${OTHER_ORG_PROJECT}`, { headers: { Authorization: `Bearer ${token}` } });
        const names = r.ok() ? ((await r.json()).data || []).map(x => x.name) : [];
        s.observe(`HTTP ${r.status()}, ${names.length} set(s)`);
        expect(names).not.toContain(ORG);
      });
    });
    else run.skip(meta('T548-04', M548, 'Organisation sets are shared within the organisation only', 'Integration'), 'Set SCP_FDI_SECOND_PROJECT and/or SCP_TKT548_OTHER_ORG_PROJECT (project ids) to run');
    await sc548('T548-06', `Update from project set "${ALT_SOURCE}" replaces the contents; the name and existing copies stay`, 'Positive', async s => {
      await s.step(`Row "${ORG}" › "Update from project set", choose "${ALT_SOURCE}", "Replace Contents"`, async () => {
        await fdiConfig();
        await (await orgRow(ORG)).getByRole('button', { name: 'Update from project set', exact: true }).click();
        const u = layer('Update from Project Question Set'); await expect(u).toBeVisible();
        await expect(u).toContainText(/Question sets already created from it in any project are not changed/);
        await pickOption(u.getByRole('combobox'), ALT_SOURCE);
        await u.getByRole('button', { name: 'Replace Contents', exact: true }).click();
        await expect(u).toBeHidden({ timeout: 20000 });
      });
      await s.step('Contents and suggested categories now match the chosen set (AC 8)', async () => {
        const alt = await projectSet(ALT_SOURCE); const org = await orgSet(ORG);
        expect(org, 'name unchanged').toBeTruthy();
        expect(org.question_count).toBe(alt.question_count);
        expect([...org.suggested_category_names].sort()).toEqual(alt.categories.map(c => c.name).sort());
      });
      if (okCopy) await s.step(`Copy "${COPY}" keeps its ${data.org548Items.length} question(s) (AC 12)`, async () => {
        expect((await projectSet(COPY)).question_count).toBe(data.org548Items.length);
      });
    });
    await sc548('T548-05', 'Rename: same rule as saving; the copy shows the new name', 'Positive', async s => {
      const ren = () => layer('Rename Organisation Question Set');
      await s.step(`Rename to "${ALL_CAT_ORG.toUpperCase()}" (existing name, other case) → refused`, async () => {
        await fdiConfig();
        await (await orgRow(ORG)).getByRole('button', { name: 'Rename', exact: true }).click();
        await ren().getByRole('textbox').first().fill(ALL_CAT_ORG.toUpperCase());
        await ren().getByRole('button', { name: 'Rename', exact: true }).click(); await k.settle(1000);
        expect(await orgSet(ORG), 'still has its name').toBeTruthy();
        await closeLayer('Rename Organisation Question Set');
      });
      await s.step(`Rename to "${ORG_RENAMED}" → listed under the new name (AC 7)`, async () => {
        await (await orgRow(ORG)).getByRole('button', { name: 'Rename', exact: true }).click();
        await ren().getByRole('textbox').first().fill(ORG_RENAMED);
        await ren().getByRole('button', { name: 'Rename', exact: true }).click();
        await expect(ren()).toBeHidden({ timeout: 15000 });
        expect(await orgSet(ORG_RENAMED)).toBeTruthy();
      });
      if (okCopy) await s.step(`Copy "${COPY}" shows the current name (AC 18)`, async () => {
        expect((await projectSet(COPY)).created_from.name).toBe(ORG_RENAMED);
      });
    });
    await run.scenario(meta('T548-10', M548, 'All Categories organisation set follows the one-per-project rule (dialog only, nothing created)', 'Boundary'), async s => {
      await s.step(`"Create from Organisation Set", choose "${ALL_CAT_ORG}" → All Categories picked, or refused when the project already has one (AC 14)`, async () => {
        const all = (await api(`/api/fdi_question_set/list_sets/?project_id=${project}`)).find(x => x.is_all_categories);
        await fdiConfig();
        await fdiMain().getByRole('button', { name: 'Create from Organisation Set' }).click();
        const d = layer('Create from Organisation Question Set'); await expect(d).toBeVisible();
        await pickOption(d.getByRole('combobox', { name: 'Organisation Question Set' }), ALL_CAT_ORG);
        const radio = d.getByRole('radio', { name: 'All Categories (catch-all)' });
        if (all) {
          s.observe(`Project already has All Categories set "${all.name}"`);
          await expect(d).toContainText(new RegExp(`this project already has one: '?${esc(all.name)}`));
          await expect(radio).toBeDisabled();
        } else {
          s.observe('Project has no All Categories set');
          await expect(radio).toBeChecked();
        }
        await closeLayer('Create from Organisation Question Set');
      });
    });
    await sc548('T548-14', 'Delete: removed from the list; the copy keeps its questions and shows "(deleted)"', 'Positive', async s => {
      await s.step(`Row "${ORG_RENAMED}" › Delete, confirm`, async () => {
        await fdiConfig();
        await (await orgRow(ORG_RENAMED)).getByRole('button', { name: 'Delete', exact: true }).click();
        // Delete asks inline: a red row under the set ("…? Question sets already created from it in any project are not changed.").
        const ask = (await orgSection()).getByRole('row').filter({ hasText: /Question sets already created from it in any project are not changed/ }).last();
        await expect(ask).toBeVisible();
        s.observe((await ask.innerText()).replace(/\s+/g, ' ').slice(0, 200));
        await ask.getByRole('button', { name: /^(Delete|Yes|Confirm)/ }).first().click();
        await expect.poll(async () => !!(await orgSet(ORG_RENAMED)), { timeout: 15000 }).toBe(false);
      });
      if (okCopy) await s.step(`Copy "${COPY}": "(deleted)" with the name at copy time, questions unchanged (AC 7, 18)`, async () => {
        const c = await projectSet(COPY);
        expect(c.created_from.deleted).toBe(true);
        expect(c.question_count).toBe(data.org548Items.length);
        await page.reload({ waitUntil: 'domcontentloaded' }); await k.settle(1500);
        await chip(COPY).click(); await k.settle(800);
        await expect(createdFrom()).toContainText('(deleted)');
      });
    });
    await sc548('T548-17', 'Audit log records the organisation set and the copy', 'Integration', async s => {
      await s.step('GET schedule-audit-logs for OrgFDIQuestionSet and FDIQuestionSet (AC 21)', async () => {
        for (const [type, name] of [['OrgFDIQuestionSet', ORG], ['FDIQuestionSet', COPY]]) {
          const logs = await api(`/api/schedule-audit-logs/list/?change_type=${type}&project_id=${project}`);
          const text = JSON.stringify(logs);
          s.observe(`${type}: ${text.length} chars, mentions run: ${text.includes(RUN)}`);
          expect(text, `${type} entry for "${name}"`).toContain(RUN);
        }
      });
    });
    for (const [id, title, why] of [
      ['T548-11', 'Deleted bank question is skipped on create', 'Needs an organisation set holding a bank-deleted question, which the app blocks (AC 20); prepared by a developer'],
      ['T548-12', 'Create is all-or-nothing (two-tab race)', 'Manual: needs two tabs racing for one category'],
      ['T548-16', 'Bank question used in an organisation set cannot be deleted', 'Not automated: a failing guard would delete a real bank question'],
      ['T548-18', 'View-only user has no organisation actions', 'Needs a working fdi:view-only account (SCP_SUPPLIER_* sign-in)']
    ]) run.skip(meta(id, M548, title, 'Deferred'), why);

    // =============== BUGS-155 – Subcontractor and the pre-shipping checklist ===============
    // Rule: a subcontractor whose organisation differs from the submittal supplier's can approve the checklist but not fill it;
    // when the organisations match, the subcontractor may fill it too. Admin fills the checklist here as the supplier's stand-in.
    const M155 = 'BUGS-155 Subcontractor pre-shipping checklist';
    const SAME_ORG_SUPPLIER = process.env.SCP_TKT155_SAME_ORG_SUPPLIER || ''; // supplier in the subcontractor account's organisation
    const sub155 = { F: { supplier: SUPPLIER }, G: { supplier: SAME_ORG_SUPPLIER } };
    for (const key of Object.keys(sub155)) Object.assign(sub155[key], { spec: `${RUN}-SPEC-${key}`, description: `${RUN} checklist ${key}`, number: `${RUN}-SUB-${key}`, scheduleId: num(key.charCodeAt(0) - 64) });
    const dIcon = (p, name) => p.locator(`img[title="${name}"], img[alt="${name}"]`).filter({ visible: true }).last();
    const fillChecklist = async (p, kit, tag) => {
      await dIcon(p, 'Pre Shipping Info').click();
      const c = kit.dialog('Add Pre-Shipping Details', 'Confirm Checklist');
      await c.getByRole('button', { name: 'Y/N', exact: true }).first().waitFor({ timeout: 20000 });
      const inputs = c.locator('input:visible:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])');
      for (let i = 0, n = await inputs.count(); i < n; i++) await inputs.nth(i).fill(`${tag} answer ${i + 1}`);
      const yn = p.getByRole('button', { name: 'Y/N', exact: true });
      for (let i = 0; (await yn.count()) > 0 && i < 60; i++) { await yn.first().click(); await p.getByRole('option', { name: 'YES', exact: true }).click(); }
      await c.locator('textarea:visible').first().fill(`${tag} supplier note`);
      await c.getByRole('button', { name: 'Confirm Checklist', exact: true }).click();
      await kit.toast('Shipping Details updated successfully!');
    };
    const setup155 = await run.scenario(meta('T155-SETUP', M155, 'Run submittal(s) with a component and a delivery awaiting the checklist', 'Setup'), async s => {
      for (const [key, d] of Object.entries(sub155)) {
        if (!d.supplier) continue;
        await s.step(`Submittal ${key} (${d.supplier}): add, add a component, log a delivery`, async () => {
          await fresh(); await k.addSubmittal({ ...d, materials: [MATERIAL] }); await k.toast('Submittal added successfully');
          await fresh(); await k.search(d.number); await k.openSubmittal(d.description);
          await k.addComponent({ rojDate: day(45), qty: 2 });
          await k.componentRow().getByRole('cell', { name: MATERIAL }).click();
          await k.keepSite(); await page.getByRole('button', { name: '+ Log Delivery' }).last().click();
          const dl = k.dialog('Add Delivery', 'Add');
          await k.day(dl.getByRole('textbox').first(), day(0));
          await dl.getByRole('button', { name: /^(All Locations|Choose Location)$/ }).click(); await listbox().getByRole('option').filter({ hasNotText: /^(All Locations|Choose Location)$/ }).first().click();
          await dl.getByRole('button', { name: 'Choose Item Name' }).click(); await listbox().getByRole('option', { name: MATERIAL, exact: true }).first().click();
          await dl.getByRole('spinbutton').first().fill('1');
          await dl.getByRole('button', { name: 'Add', exact: true }).click();
          await expect(page.getByRole('heading', { name: 'Add Delivery', exact: true })).toBeHidden({ timeout: 20000 });
          await expect(dIcon(page, 'Pre Shipping Info')).toBeVisible({ timeout: 15000 });
          d.url = page.url();
        }, { critical: true });
      }
    });
    // Subcontractor in its own browser context; the admin tab stays signed in.
    let subPage = null; let subCtx = null;
    const acct = config.accounts.subcontractor;
    const subLogin = setup155?.status !== 'Passed'
      ? run.skip(meta('T155-SIGNIN', M155, 'Subcontractor sign-in', 'Setup'), 'T155-SETUP failed')
      : !acct.username
        ? run.skip(meta('T155-SIGNIN', M155, 'Subcontractor sign-in', 'Setup'), 'SCP_SUBCONTRACTOR_USERNAME / PASSWORD not set')
        : await run.scenario(meta('T155-SIGNIN', M155, 'Subcontractor sign-in', 'Setup'), async s => {
          subCtx = await page.context().browser().newContext({ viewport: null, baseURL: config.baseUrl });
          subPage = await subCtx.newPage();
          // 13 Nov 2026: the subcontractor account has one platform, so Sign in goes straight to SCP (no chooser with the
          // email heading, which the shared admin sign-in expects). The window is also brought to the front: behind the
          // admin window the email field was not found within 20 s. A probe signed in fine with the same account.
          const sk = plKit(subPage);
          await s.step('Subcontractor window: open the Voyage Control SSO login page → heading "Welcome To Voyage Control" and the Email field are shown', async () => {
            await subPage.bringToFront();
            await subPage.goto(config.loginUrl, { waitUntil: 'domcontentloaded' });
            await expect(subPage.getByRole('heading', { name: 'Welcome To Voyage Control' })).toBeVisible({ timeout: 30000 });
            await expect(subPage.locator('#id_username, input[name="username"]').first()).toBeVisible({ timeout: 30000 });
          }, { critical: true });
          await s.step('Enter the Subcontractor email and password, click Login → SCP opens (directly, or via the platform chooser "Supply Chain Planner" tile) on /management-dashboard', async () => {
            await subPage.bringToFront();
            await new LoginPage(subPage).login(acct.username, acct.password);
            await subPage.waitForURL(u => /platforms\/choose/i.test(u.pathname) || u.origin === new URL(config.baseUrl).origin, { timeout: 45000 });
            if (/platforms\/choose/i.test(subPage.url())) await new PlatformChooserPage(subPage, config).openSupplyChainPlanner();
            await expect(subPage).toHaveURL(/\/management-dashboard\/?$/, { timeout: 30000 });
            s.observe(/platforms\/choose/i.test(subPage.url()) ? 'via platform chooser' : 'opened SCP directly (single-platform account)');
          }, { critical: true });
          await s.step(`Header project selector › choose "${config.projectName}" → project name shown in the header`, () => new ProjectSelectorPage(subPage, config).ensureProject(config.projectName), { critical: true });
          await s.step(`Header site selector › choose "${sk.SITE}" → site name shown in the header`, () => new SiteSelectorPage(subPage).ensureSite(sk.SITE), { critical: true });
          await page.bringToFront();
        });
    const ok155 = subLogin && subLogin.status === 'Passed';
    const sc155 = (id, title, kind, body, need = true) => ok155 && need ? run.scenario(meta(id, M155, title, kind), body)
      : run.skip(meta(id, M155, title, kind), !ok155 ? 'Subcontractor sign-in failed (10 Nov: the SCP_SUBCONTRACTOR_* account in .env is rejected – update it)' : 'Set SCP_TKT155_SAME_ORG_SUPPLIER to a supplier in the subcontractor\'s organisation');
    const subOpen = async d => {
      await subPage.goto(d.url, { waitUntil: 'domcontentloaded' });
      await plKit(subPage).settle(3000);
      await expect(subPage).toHaveURL(/[?&]schedule=/);
    };
    try {
      await sc155('T155-01', 'Subcontractor from another organisation cannot fill the checklist', 'Negative', async s => {
        await s.step(`Subcontractor opens delivery on ${sub155.F.number} (supplier ${SUPPLIER}) → no way to confirm a checklist`, async () => {
          await subOpen(sub155.F);
          const fill = dIcon(subPage, 'Pre Shipping Info');
          if (await fill.isVisible().catch(() => false)) {
            await fill.click();
            const confirm = subPage.getByRole('button', { name: 'Confirm Checklist', exact: true });
            const can = await confirm.isVisible({ timeout: 5000 }).catch(() => false) && await confirm.isEnabled().catch(() => false);
            s.observe(`"Pre Shipping Info" shown; Confirm Checklist usable: ${can}`);
            expect(can, 'subcontractor of another organisation can confirm the checklist').toBe(false);
            await subPage.keyboard.press('Escape');
          } else s.observe('"Pre Shipping Info" not offered to the subcontractor');
        });
      });
      await sc155('T155-02', 'Subcontractor can approve a checklist the supplier filled', 'Positive', async s => {
        await s.step(`Admin (as supplier) fills the checklist on ${sub155.F.number}`, async () => {
          await page.goto(sub155.F.url, { waitUntil: 'domcontentloaded' }); await k.settle(2000);
          await fillChecklist(page, k, RUN);
        }, { critical: true });
        await s.step('Subcontractor: "Approve Pre-Shipping Checklist" → Approve → "Checklist Generated Successfully!"', async () => {
          await subOpen(sub155.F);
          const sk = plKit(subPage);
          await dIcon(subPage, 'Approve Pre-Shipping Checklist').click();
          const a = sk.dialog('Approve Pre-Shipping Checklist', 'Approve');
          await a.locator('textarea').last().fill(`${RUN} approved by subcontractor`);
          await a.getByRole('button', { name: 'Approve', exact: true }).click();
          await sk.toast('Checklist Generated Successfully!');
        });
      });
      await sc155('T155-03', 'Subcontractor in the supplier\'s organisation can fill the checklist', 'Positive', async s => {
        await s.step(`Subcontractor fills the checklist on ${sub155.G.number} (supplier ${SAME_ORG_SUPPLIER})`, async () => {
          await subOpen(sub155.G);
          await fillChecklist(subPage, plKit(subPage), RUN);
          await expect(dIcon(subPage, 'Approve Pre-Shipping Checklist')).toBeVisible({ timeout: 15000 });
        });
      }, !!SAME_ORG_SUPPLIER);
    } finally {
      if (subCtx) await subCtx.close().catch(() => null);
    }
  } });
});
