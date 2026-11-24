// Regression for the remaining modules – UM_SCENARIOS, OTHER_MODULES_SCENARIOS (FDI), DOC_SCENARIOS,
// SHP_DISCOVERY_AND_SCENARIOS, DSH_ENT_ANA_DISCOVERY_AND_SCENARIOS (docs/functional-discovery). Writes are run-tagged
// (approved on NRVC_Hall: create; delete only run-owned records). Steps that need an outside system (mailbox, Procore,
// TheLink), a role-config change on the shared project or a second day are reported as skipped with the reason.
// FDI-REG-01/01a (inspection created by the first delivery) run in pl-regression-3 (PL-REG-INT-*); here the record it
// created is completed.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { runPmSuite } = require('./support/pm-flow');
const { plKit } = require('./support/pl-flow');
const { writePdf, readXlsxRows } = require('./support/pl-files');

const SUITE = 'All Modules Regression';
const meta = (id, module, title, kind, extra = {}) => ({ id, module, submodule: kind, suite: SUITE, title: `[${kind}] ${title}`, navPath: [module], ...extra });
const digits = new Date().toISOString().replace(/\D/g, '');
const RUN = `APR${digits.slice(2, 12)}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'app-reg-'));
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Run submittals created by the Procurement regression (latest first in the option lists).
const RUN_SUBMITTAL = /PL[TRS]\d{10}-SUB-P|PL[TRS]\d{10}-SUB/;

test.describe.configure({ mode: 'serial' });
test.setTimeout(120 * 60 * 1000); // International Shipments alone needs ~3.5 min per page load (23 Nov 2026)

test('Remaining modules – regression', async ({ page, browserName }) => {
  await runPmSuite({ page, browserName, suite: SUITE, scenarios: async ({ run, config }) => {
    // 13 Nov 2026 user triage of the full regression: these cases are recorded as Skipped with the reason, not executed.
    const TRIAGE_SKIP = {
      // SHP-REG-03/06/08/09 run again from 23 Nov 2026 (user: International Shipments back in scope); failures are pending-confirmation defects.
      // ENT-REG-02/03 run again from 23 Nov 2026 (user: run the pending Enterprise cases).
    };
    const runScenario = run.scenario.bind(run);
    run.scenario = async (m, body) => (TRIAGE_SKIP[m.id] ? run.skip(m, TRIAGE_SKIP[m.id]) : runScenario(m, body));
    const k = plKit(page);
    const { main, listbox } = k;
    const btn = (name, scope = main) => scope.getByRole('button', { name, exact: true }).first();
    const header = async (scope = main) => (await scope.getByRole('columnheader').allInnerTexts()).map(t => t.trim().toLowerCase());
    const col = async (row, name, scope = main) => (await row.getByRole('cell').allInnerTexts())[(await header(scope)).indexOf(name.toLowerCase())]?.trim();
    const toast = (t, timeout) => k.toast(t, timeout);
    // System Message banners ("Project notice" / "Platform-wide") also have role status; they are not toasts.
    const anyToast = async () => (await page.getByRole('status').allInnerTexts()).filter(text => !/^\s*(Project notice|Platform-wide)/i.test(text)).join(' | ');
    const open = async (route, name, group) => {
      await page.keyboard.press('Escape').catch(() => null);
      await k.menu(name, group).catch(() => null);
      await page.goto(route, { waitUntil: 'domcontentloaded' }); // a same-route menu click keeps a leftover form open
      await k.settle(1500);
    };
    const download = async trigger => {
      const dl = page.waitForEvent('download', { timeout: 60000 });
      dl.catch(() => null); // a failed trigger must not leave an unhandled wait that closes the browser
      await trigger();
      const d = await dl; const file = path.join(tmp, d.suggestedFilename()); await d.saveAs(file);
      return file;
    };
    // Form fields by their label: input/textarea are filled, a picker button gets the option, a select the label.
    const field = async (scope, label, value) => {
      const el = scope.getByText(new RegExp(`^${esc(label)}\\s*\\*?$`)).first().locator('xpath=following::*[self::input[not(@type="checkbox")] or self::textarea or self::select or self::button or @role="button"][1]');
      const tag = await el.evaluate(e => e.tagName);
      if (tag === 'SELECT') return el.selectOption({ label: value });
      if (tag === 'BUTTON') { await el.click(); const o = listbox().getByRole('option', { name: value, exact: true }); return ((await o.count()) ? o.first() : listbox().getByRole('option').first()).click(); }
      return el.fill(String(value));
    };

    const login = await run.scenario(meta('APP-REG-SETUP', 'Setup', `Sign in on ${config.projectName}`, 'Setup', { always: true }), async s => {
      await k.signIn(s, config);
      s.observe(`Run tag ${RUN}`);
    });
    if (login.status !== 'Passed') { run.abort('Setup failed'); return; }

    // ======================= User Management =======================
    const UM = 'User Management';
    const EMAIL = `um.${RUN.toLowerCase()}@yopmail.com`;
    const umOpen = () => open('/user-management', UM, UM);
    const invite = async (email, role, { send = true } = {}) => {
      await btn('Invite Users').click();
      await page.getByRole('textbox', { name: /email/i }).last().fill(email);
      if (role) { await page.getByRole('button', { name: 'Choose Role' }).last().click(); await listbox().getByRole('option', { name: role, exact: true }).click(); }
      if (send) await page.getByRole('button', { name: 'Send Invites' }).click();
    };
    const userRow = () => k.rows().filter({ hasText: new RegExp(esc(EMAIL), 'i') }).first();
    const umSearch = async t => { const b = page.getByRole('textbox', { name: /Search users/ }); await b.fill(t); await b.press('Enter').catch(() => null); await k.settle(1000); };

    await run.scenario(meta('UM-REG-01', UM, 'Send Invites needs email + role', 'Negative'), async s => {
      await s.step(`User Management (/user-management) › "Invite Users": open the dialog without typing anything → dialog with email field, "Choose Role" and "Send Invites" opens`, async () => { await umOpen(); await invite('', null, { send: false }); }, { critical: true });
      const sendBtn = page.getByRole('button', { name: 'Send Invites' });
      await s.step(`Invite dialog with empty email and no role → "Send Invites" is disabled`, () => expect(sendBtn).toBeDisabled());
      await s.step(`Invite dialog: enter email "not-an-email", pick role "Subcontractor" → "Send Invites" stays disabled`, async () => {
        await page.getByRole('textbox', { name: /email/i }).last().fill('not-an-email');
        await page.getByRole('button', { name: 'Choose Role' }).last().click(); await listbox().getByRole('option', { name: 'Subcontractor', exact: true }).click();
        await expect(sendBtn).toBeDisabled();
      });
      await s.step(`Invite dialog: enter ${EMAIL} (role "Subcontractor" kept), leave organization empty → "Send Invites" becomes enabled`, async () => {
        await page.getByRole('textbox', { name: /email/i }).last().fill(EMAIL);
        await expect(sendBtn).toBeEnabled();
      });
      await s.step(`Invite dialog: click "Add Another User" → one more email field appears and "Send Invites" is disabled again (new row is empty)`, async () => {
        const before = await page.getByRole('textbox', { name: /email/i }).count();
        await page.getByRole('button', { name: 'Add Another User' }).click();
        await expect(page.getByRole('textbox', { name: /email/i })).toHaveCount(before + 1);
        await expect(sendBtn).toBeDisabled();
      });
      await s.step(`Invite dialog: click "Cancel" → dialog closes, nothing is sent`, () => page.getByRole('button', { name: 'Cancel', exact: true }).last().click());
    });
    run.skip(meta('UM-REG-04', UM, 'Organization optional', 'Positive'), 'Covered as a step of UM-REG-01');
    run.skip(meta('UM-REG-05', UM, 'Add Another User', 'Positive'), 'Covered as a step of UM-REG-01');

    const invited = await run.scenario(meta('UM-REG-02', UM, 'Invite a user', 'Positive'), async s => {
      await s.step(`User Management › "Invite Users": enter ${EMAIL}, "Choose Role" "Subcontractor", click "Send Invites" → toast "Invite Sent Successfully"`, async () => { await umOpen(); await invite(EMAIL, 'Subcontractor'); await toast('Invite Sent Successfully'); }, { critical: true });
      await s.step(`Reopen User Management, search ${EMAIL} in "Search users" → row shows Status "Invited" and role "Subcontractor"`, async () => {
        await umOpen(); await umSearch(EMAIL);
        await expect(userRow()).toContainText('Invited'); await expect(userRow()).toContainText('Subcontractor');
      });
    });
    if (invited?.status === 'Passed') {
      await run.scenario(meta('UM-REG-03', UM, 'Duplicate invite rejected (R2)', 'Negative'), async s => {
        await s.step(`User Management › "Invite Users": enter ${EMAIL} in upper case, role "Project User", "Send Invites" → no "Invite Sent Successfully" toast (duplicate rejected), then "Cancel"`, async () => {
          await umOpen(); await invite(EMAIL.toUpperCase(), 'Project User'); await k.settle(1500);
          const t = await anyToast();
          s.observe(`Toast: ${t || '(none)'}`);
          if (/Invite Sent Successfully/.test(t)) throw new Error('Duplicate invite was accepted (OBS-UM-1)');
          await page.getByRole('button', { name: 'Cancel', exact: true }).last().click().catch(() => null);
        });
        await s.step(`Reopen User Management, search ${EMAIL} → row still shows role "Subcontractor" (not overwritten by the re-invite)`, async () => { await umOpen(); await umSearch(EMAIL); await expect(userRow(), 'Role was overwritten by the re-invite').toContainText('Subcontractor'); });
      });
      await run.scenario(meta('UM-REG-06', UM, 'Search users (fragment, case ignored)', 'Positive'), async s => {
        await s.step(`User Management: search the run tag in upper case in "Search users" → exactly one row, the run user`, async () => { await umOpen(); await umSearch(RUN.toUpperCase()); await expect(userRow()).toBeVisible(); expect(await k.rows().count()).toBe(1); });
      });
      await run.scenario(meta('UM-REG-07', UM, 'Change Project Role persists', 'Positive'), async s => {
        const target = (await userRow().innerText()).includes('Subcontractor') ? 'Supplier' : 'Subcontractor';
        await s.step(`User Management: open the ${EMAIL} row profile, set "Project Role" to ${target}, click "Save" → toast "User profile updated successfully"`, async () => {
          await userRow().getByRole('cell').nth(2).click();
          await page.getByText('Project Role', { exact: true }).last().locator('xpath=following::*[@role="button"][1]').click();
          await listbox().getByRole('option', { name: target, exact: true }).click();
          await page.getByRole('button', { name: 'Save', exact: true }).last().click();
          await toast('User profile updated successfully');
        });
        await s.step(`Reload User Management, search ${EMAIL} → row shows the new Project Role (persisted)`, async () => { await page.reload(); await k.settle(1500); await umSearch(EMAIL); await expect(userRow(), 'Project Role change was not persisted (OBS-UM-2)').toContainText(target); });
      });
      await run.scenario(meta('UM-REG-11', UM, 'Filter narrows rows', 'Positive'), async s => {
        await s.step(`User Management: "Filter" › tab "status" › "Invited" › "Apply Filter" → every listed row has Status "Invited" (row counts before/after noted)`, async () => {
          await umOpen(); const all = await k.rows().count();
          await btn('Filter').click(); await k.settle(500);
          const f = page.locator('div.fixed.inset-0').filter({ hasText: 'Apply Filter' });
          await f.getByRole('tab', { name: 'status' }).click(); await k.settle(600);
          const opt = f.getByText('Invited', { exact: true }).or(f.getByRole('checkbox', { name: 'Invited' })).first();
          expect(await opt.count(), 'Filter tabs offer no values (OBS-UM-4)').toBeGreaterThan(0);
          await opt.click(); await f.getByRole('button', { name: 'Apply Filter' }).click(); await k.settle(1500);
          const texts = await k.rows().allInnerTexts();
          s.observe(`${all} → ${texts.length} rows`);
          for (const t of texts) expect(t).toContain('Invited');
        });
      });
      await run.scenario(meta('UM-REG-08', UM, 'Remove From Project (run user)', 'Positive'), async s => {
        await s.step(`User Management: search ${EMAIL}, open its profile, click "Remove From Project", confirm if asked → toast "User Removed Successfully"`, async () => {
          await umOpen(); await umSearch(EMAIL);
          await userRow().getByRole('cell').nth(2).click();
          await page.getByRole('button', { name: 'Remove From Project' }).last().click(); await k.settle(800);
          const confirm = page.getByRole('button', { name: /^(Confirm|Yes|Remove)$/ }).last();
          const asked = await confirm.isVisible().catch(() => false);
          if (asked) await confirm.click();
          await toast('User Removed Successfully');
          if (!asked) s.observe('Removed with no confirmation step (OBS-UM-3, Q-UM-3)');
        });
        await s.step(`Reload User Management, search ${EMAIL} → the user is no longer listed`, async () => { await page.reload(); await k.settle(1500); await umSearch(EMAIL); await expect(userRow(), 'Removed user is still listed (OBS-UM-3)').toBeHidden(); });
      });
    } else for (const id of ['03', '06', '07', '11', '08']) run.skip(meta(`UM-REG-${id}`, UM, 'Needs the invited run user', 'Dependent'), 'UM-REG-02 failed');
    run.skip(meta('UM-REG-09', UM, 'Invite → accept → active', 'Integration'), 'Needs the invited user to accept from the mailbox; covered by the PM Cucumber invite flow (FDI-18 pattern)');
    run.skip(meta('UM-REG-10', UM, 'Role access applies to screens', 'Role'), 'Changes the shared Roles configuration; covered by PM role scenarios (R40–R43)');

    // ======================= Supplier List =======================
    const SL = 'Supplier List';
    const slm = (id, title, kind) => meta(id, UM, title, kind, { navPath: [UM, SL] });
    const SUP = `Supplier ${RUN}`;
    const SUB = `Subcon ${RUN}`;
    const slOpen = () => open('/supplier-list', SL, UM);
    const slSearch = async t => { const b = page.getByRole('textbox', { name: /Search suppliers/ }); await b.fill(t); await b.press('Enter').catch(() => null); await k.settle(1000); };
    const slCount = async () => Number(((await main.innerText()).match(/(\d+) suppliers?/) || [])[1] || NaN);
    const supRow = name => k.rows().filter({ hasText: name }).first();
    // 13 Nov 2026: the Add Supplier form re-renders shortly after it opens (and when "Is Sub-Contractor" is switched) and
    // clears typed values, so Save sent an empty name ("Supplier Name is required") – SL-REG-02/03/05 failed although the
    // app works (user, 13 Nov). Same handling as the E2E kit: let the form settle, switch the box first, type each value
    // once, confirm none was cleared, then Save once. A subcontractor also needs "Trade / Discipline".
    const supplierForm = async (name, { sub = false, email = `${RUN.toLowerCase()}@yopmail.com` } = {}) => {
      await btn('Add Supplier').click();
      const f = page.locator('form').filter({ has: page.locator('input[name="supplierName"]') }).last();
      await expect(f).toBeVisible({ timeout: 10000 });
      await k.settle(1500);
      const box = f.locator('input[name="isSubcontractor"]');
      if (sub) {
        for (const target of [box.locator('xpath=..'), f.getByText(/Is Sub-?Contractor/i).first()]) { if (await box.isChecked()) break; await target.click().catch(() => null); await page.waitForTimeout(800); }
        await expect(box, '"Is Sub-Contractor" switched on').toBeChecked(); await k.settle(1000);
      } else await expect(box, '"Is Sub-Contractor" OFF').not.toBeChecked();
      const values = [['supplierName', name], ['line1', '1 Test Street'], ['townCity', 'Chennai'], ['stateRegion', 'Tamil Nadu'], ['zipcode', '600001'], ['country', 'India'], ['contactPerson', `Contact ${RUN}`], ['contactEmail', email], ['contactPhone', '9876543210']];
      // Wait until the name input stays in the DOM with an unchanged value for 1.5 s (the form's own re-render is over).
      const input = f.locator('input[name="supplierName"]');
      for (const end = Date.now() + 10000; Date.now() < end;) {
        const h = await input.elementHandle({ timeout: 5000 }).catch(() => null); const v = h ? await h.evaluate(e => e.value).catch(() => null) : null;
        await page.waitForTimeout(1500);
        if (h && await h.evaluate(e => e.isConnected).catch(() => false) && v === await h.evaluate(e => e.value).catch(() => null)) break;
      }
      for (const [n, v] of values) await f.locator(`input[name="${n}"]`).fill(v);
      await page.waitForTimeout(1200);
      const cleared = []; for (const [n, v] of values) if ((await f.locator(`input[name="${n}"]`).inputValue()).trim() !== v.trim()) cleared.push(n);
      if (cleared.length) throw new Error(`Add Supplier form cleared ${cleared.join(', ')} after entry (form re-render); not saved`);
      if (sub) {
        const select = f.getByText(/Trade \/ Discipline/i).first().locator('xpath=following::select[1]');
        if (await select.count()) { const opts = (await select.locator('option').allInnerTexts()).map(t => t.trim()).filter(o => o && !/^--/.test(o)); if (opts.length) await select.selectOption({ label: opts.find(o => /^Electrical$/i.test(o)) || opts[0] }); }
      }
      await f.getByRole('button', { name: 'Save', exact: true }).click();
    };

    await run.scenario(slm('SL-REG-01', 'Required fields', 'Negative'), async s => {
      await s.step(`Supplier List (/supplier-list) › "Add Supplier": click "Save" with the form empty → "is required" message for each of the 9 mandatory fields (Supplier Name, Line 1, Town/City, State/Region, Zipcode, Country, Contact Person, Contact Email, Contact Phone), then "Cancel"`, async () => {
        await slOpen(); await btn('Add Supplier').click();
        await page.getByRole('button', { name: 'Save', exact: true }).last().click();
        for (const f of ['Supplier Name', 'Line 1', 'Town/City', 'State/Region', 'Zipcode', 'Country', 'Contact Person', 'Contact Email', 'Contact Phone']) await expect(page.getByText(new RegExp(`${esc(f)}.* is required`)).first(), f).toBeVisible();
        await page.getByRole('button', { name: 'Cancel', exact: true }).last().click();
      });
    });
    // 13 Nov 2026 triage (user): skipped – the app does not let a supplier with an invalid email be created.
    run.skip(slm('SL-REG-04', 'Invalid email gets an app message', 'Negative'), 'Skipped on user triage 13 Nov 2026: the system does not allow a supplier to be created with an invalid email');
    const addedToast = async () => { await expect.poll(anyToast, { timeout: 15000, message: 'No "added successfully" toast after Save' }).toMatch(/added successfully/i); return anyToast(); };
    const added = await run.scenario(slm('SL-REG-02', 'Add supplier', 'Positive'), async s => {
      await s.step(`Supplier List › "Add Supplier": enter Supplier Name ${SUP}, address (1 Test Street, Chennai, Tamil Nadu, 600001, India), contact details, "Save" once → success toast "… added successfully"`, async () => { await slOpen(); await supplierForm(SUP); s.observe(`Toast: ${await addedToast()}`); }, { critical: true, attempts: 1 });
      // SL-REG-02.2 (row Type and numeric Supplier ID) skipped on user triage 13 Nov 2026: "system shows valid toaster while creating".
    });
    await run.scenario(slm('SL-REG-03', 'Duplicate name (case/space) rejected', 'Negative'), async s => {
      await s.step(`Supplier List › "Add Supplier": enter the supplier name in lower case with leading/trailing spaces, other fields valid, "Save" → duplicate message ("already exists…"), then "Cancel"`, async () => {
        await slOpen(); await supplierForm(`  ${SUP.toLowerCase()}  `);
        const msg = page.getByText(/already exists/i).first();
        await expect(msg, 'No duplicate-name message').toBeVisible({ timeout: 15000 });
        s.observe(`Message: ${(await msg.innerText()).trim()}`);
        await page.getByRole('button', { name: 'Cancel', exact: true }).last().click().catch(() => null);
      }, { attempts: 1 });
    });
    await run.scenario(slm('SL-REG-05', 'Add as subcontractor', 'Positive'), async s => {
      await s.step(`Supplier List › "Add Supplier": enter ${SUB}, switch on "Is Sub-Contractor", other fields valid, "Save" → success toast "added successfully"`, async () => { await slOpen(); await supplierForm(SUB, { sub: true, email: `sub.${RUN.toLowerCase()}@yopmail.com` });
        await page.getByRole('status').first().waitFor({ timeout: 15000 }).catch(() => null);
        const t = await anyToast(); const errs = (await main.innerText()).match(/[^\n]*(required|invalid|already exists)[^\n]*/gi) || [];
        s.observe(`Toast: ${t || '(none)'}${errs.length ? ` · form: ${errs.slice(0, 3).join(' / ')}` : ''}`);
        expect(t, 'Subcontractor save gave no success message').toMatch(/added successfully/i); }, { attempts: 1 });
      await s.step(`Reopen Supplier List, search the run tag → ${SUB} row has Type "Subcontractor"`, async () => { await slOpen(); await slSearch(RUN); expect(await col(supRow(SUB), 'Type')).toMatch(/^Sub-?Contractor\b/i); /* shown as "Sub-Contractor · <trade>" (13 Nov 2026) */ });
    });
    if (added?.status === 'Passed') {
      const rowMenu = async (name, item) => { await slOpen(); await slSearch(RUN); await supRow(name).locator('img[alt="Menu"]').click(); await page.getByRole('menuitem', { name: item }).or(page.getByText(item, { exact: true })).last().click(); await k.settle(800); };
      await run.scenario(slm('SL-REG-07', 'Map material validation', 'Negative'), async s => {
        await s.step(`Supplier List › ${SUP} row "⋮" › "Map Material": click "Add Item Mapping", then "SUBMIT" with no material → message "Select a material before saving."`, async () => {
          await rowMenu(SUP, 'Map Material');
          await page.getByRole('button', { name: 'Add Item Mapping' }).click();
          await page.getByRole('button', { name: 'SUBMIT', exact: true }).click();
          await expect(page.getByText('Select a material before saving.').first()).toBeVisible();
        });
      });
      await run.scenario(slm('SL-REG-06', `Map material ${k.MATERIAL}`, 'Positive'), async s => {
        await s.step(`Map Material for ${SUP} (dialog reused, else reopened via row "⋮" and "Add Item Mapping"): "Choose Material" ${k.MATERIAL}, Lead Time (Weeks) 2, "SUBMIT" → mapping row for the material shows 2`, async () => {
          if (!(await page.getByRole('button', { name: 'SUBMIT', exact: true }).isVisible().catch(() => false))) { await rowMenu(SUP, 'Map Material'); await page.getByRole('button', { name: 'Add Item Mapping' }).click(); }
          await page.getByRole('button', { name: 'Choose Material' }).click(); await listbox().getByRole('option', { name: k.MATERIAL, exact: true }).click();
          await field(page, 'Lead Time (Weeks)', 2);
          await page.getByRole('button', { name: 'SUBMIT', exact: true }).click(); await k.settle(1500);
          await expect(page.getByRole('row').filter({ hasText: k.MATERIAL }).last()).toContainText('2');
        });
      });
      await run.scenario(slm('SL-REG-08', 'Mapping drives Procurement material list', 'Integration'), async s => {
        await s.step(`Procurement Log › "Add Submittal": choose supplier ${SUP}, open "Choose Materials" → the only option is ${k.MATERIAL}; close the dialog`, async () => {
          await k.openLog(); await main.getByRole('button', { name: 'Add Submittal', exact: true }).click();
          const m = page.getByRole('heading', { name: 'Add Submittal' }).locator('xpath=../..');
          await k.pick('Choose Suppliers', SUP, m);
          await m.getByRole('button', { name: 'Choose Materials' }).click();
          // The material list loads after the supplier is chosen; wait for it before reading (empty list on 21 Nov 2026 run).
          await listbox().getByRole('option').first().waitFor({ timeout: 15000 }).catch(() => null);
          const opts = (await listbox().getByRole('option').allInnerTexts()).map(t => t.trim()).filter(Boolean);
          await page.keyboard.press('Escape'); await k.closeDialog('Add Submittal').catch(() => null);
          expect(opts).toEqual([k.MATERIAL]);
        });
      });
      await run.scenario(slm('SL-REG-12', 'Edit supplier', 'Positive'), async s => {
        await s.step(`Supplier List › ${SUP} row "⋮" › "Edit": set Contact Person to "Edited ${RUN}", "Save"/"Update" → reopened list shows that Contact Person for ${SUP}`, async () => {
          await rowMenu(SUP, 'Edit');
          await field(page, 'Contact Person', `Edited ${RUN}`);
          await page.getByRole('button', { name: /^(Save|Update)$/ }).last().click(); await k.settle(1500);
          s.observe(`Toast: ${await anyToast()}`);
          await slOpen(); await slSearch(RUN); expect(await col(supRow(SUP), 'Contact Person')).toBe(`Edited ${RUN}`);
        });
      });
    } else for (const id of ['07', '06', '08', '12']) run.skip(slm(`SL-REG-${id}`, 'Needs the run supplier', 'Dependent'), 'SL-REG-02 failed');

    await run.scenario(slm('SL-REG-09', 'Bulk map page', 'Positive'), async s => {
      await s.step(`Supplier List › "Bulk Map Material to Supplier": filter by supplier name ${SUB}, tick the ${k.MATERIAL} checkbox in its row, click "Map Suppliers to Materials" → mapping is submitted (toast noted)`, async () => {
        await slOpen(); await btn('Bulk Map Material to Supplier').click(); await k.settle(1500);
        await expect(page.getByText('← Supplier List').first()).toBeVisible();
        await page.getByPlaceholder(/Filter by supplier name/).fill(SUB); await k.settle(1000);
        // 13 Nov 2026: the page has two panes – Suppliers (left) and Materials (right); tick the supplier and the material.
        const r = page.getByRole('row').filter({ hasText: SUB }).first();
        await r.getByRole('checkbox').first().check();
        await page.getByPlaceholder(/Filter by material name/).fill(k.MATERIAL); await k.settle(1000);
        const m = page.getByRole('row').filter({ has: page.getByRole('cell', { name: k.MATERIAL, exact: true }) }).first();
        await m.getByRole('checkbox').first().check();
        s.observe(`Ticked supplier ${SUB} and material ${k.MATERIAL}`);
        await expect(page.getByRole('button', { name: 'Map Suppliers to Materials' })).toBeEnabled({ timeout: 10000 });
        await page.getByRole('button', { name: 'Map Suppliers to Materials' }).click(); await k.settle(1000);
        // 13 Nov 2026 (user): the mapping is saved only after the lead time is entered and submitted. The click opens the
        // "Default Lead Time" dialog: "Default Lead Time (weeks)*" (e.g. 2 or 0.5) and "Continue".
        const dlg = page.getByRole('dialog').filter({ hasText: 'Default Lead Time' }).or(page.locator('div').filter({ has: page.getByText('Default Lead Time', { exact: true }) }).filter({ has: page.getByRole('button', { name: 'Continue' }) })).last();
        await expect(dlg, '"Default Lead Time" dialog').toBeVisible({ timeout: 10000 });
        await dlg.getByPlaceholder(/e\.g\. 2/).or(dlg.locator('input')).first().fill('2');
        await dlg.getByRole('button', { name: 'Continue' }).click(); await k.settle(1500);
        // A confirmation/submit step may follow Continue; submit it once if shown.
        const submit = page.getByRole('button', { name: /^(Submit|SUBMIT|Confirm|Save|Map)$/ }).last();
        if (await submit.isVisible().catch(() => false)) { await submit.click(); await k.settle(1500); }
        s.observe(`Lead time 2 weeks entered; Toast: ${await anyToast() || '(none)'}`);
      }, { attempts: 1 });
      await s.step(`Supplier List: search the run tag, ${SUB} row "⋮" › "Map Material" → a row for ${k.MATERIAL} with Lead Time 2 weeks is listed`, async () => {
        await slOpen(); await slSearch(RUN); await supRow(SUB).locator('img[alt="Menu"]').click();
        await page.getByRole('menuitem', { name: 'Map Material' }).or(page.getByText('Map Material', { exact: true })).last().click(); await k.settle(1000);
        const row = page.getByRole('row').filter({ hasText: k.MATERIAL }).last();
        await expect(row, `${k.MATERIAL} mapping`).toBeVisible();
        s.observe(`Mapping row: ${(await row.innerText()).replace(/\s+/g, ' ').trim()}`);
        await expect(row, 'Lead Time in Weeks = 2').toContainText('2');
        await page.keyboard.press('Escape');
      });
    });
    for (const [id, item, tpl] of [['SL-REG-10', 'Supplier List Upload', 'Supplier List Download Template'], ['SL-REG-11', 'Supplier Map Upload', 'Supplier Map Download Template']]) {
      await run.scenario(slm(id, `${item} – template round trip`, 'Positive'), async s => {
        let file;
        await s.step(`Supplier List › "Upload": click "${tpl}" → template .xlsx downloads (header row noted)`, async () => { await slOpen(); await btn('Upload').click(); file = await download(() => page.getByText(tpl, { exact: true }).click()); s.observe(`Header: ${(readXlsxRows(file)[0] || []).join(' | ')}`); }, { critical: true });
        await s.step(`Supplier List › "Upload" › "${item}": choose the downloaded empty template file → rejected with a message (noted) and the supplier count is unchanged`, async () => {
          const before = await slCount();
          await btn('Upload').click();
          const ch = page.waitForEvent('filechooser'); await page.getByText(item, { exact: true }).click(); await (await ch).setFiles(file);
          await k.settle(3000); s.observe(`Result: ${await anyToast()}`);
          await slOpen(); expect(await slCount()).toBe(before);
        });
      });
    }
    await run.scenario(slm('SL-REG-14', 'Export rows = list count', 'Positive'), async s => {
      await s.step(`Supplier List: click "Export" → downloaded .xlsx has one data row per supplier in the list count`, async () => {
        await slOpen(); const n = await slCount();
        const file = await download(() => btn('Export').click());
        expect(readXlsxRows(file).filter(r => r.some(Boolean)).length - 1).toBe(n);
      });
    });
    await run.scenario(slm('SL-REG-13', 'Delete supplier (run-owned)', 'Positive'), async s => {
      await s.step(`Supplier List: search the run tag, ${SUB} row "⋮" › "Delete", confirm if asked → ${SUB} is no longer listed`, async () => {
        await slOpen(); await slSearch(RUN); await supRow(SUB).locator('img[alt="Menu"]').click();
        await page.getByRole('menuitem', { name: 'Delete' }).or(page.getByText('Delete', { exact: true })).last().click();
        const c = page.getByRole('button', { name: /^(Delete|Confirm|Yes)$/ }).last(); if (await c.isVisible().catch(() => false)) await c.click();
        await k.settle(1500); s.observe(`Toast: ${await anyToast()}`);
        await slOpen(); await slSearch(RUN); await expect(supRow(SUB)).toBeHidden();
      });
    });
    // SL-REG-15 (approved by the user on 22 Nov 2026: "can create – system will allow"): the run supplier is promoted.
    await run.scenario(slm('SL-REG-15', 'Promote to SSO Organisation', 'Positive'), async s => {
      // 23 Nov 2026: on staging the menu item opened no dialog, showed no message and sent no request (checked twice).
      let acted = false; let dlgText = '';
      await s.step(`Supplier List › search ${RUN} › row "${SUP}" › menu "Promote to SSO Organisation" → a confirmation dialog opens or the promotion is sent`, async () => {
        await slOpen(); await slSearch(RUN);
        await expect(supRow(SUP), `${SUP} listed`).toBeVisible({ timeout: 15000 });
        const sent = [];
        const onReq = r => { if (r.method() !== 'GET' && /\/api\//.test(r.url())) sent.push(`${r.method()} ${new URL(r.url()).pathname}`); };
        page.on('request', onReq);
        await supRow(SUP).locator('img[alt="Menu"]').click();
        await page.getByRole('menuitem', { name: 'Promote to SSO Organisation' }).first().click();
        await k.settle(3000);
        page.off('request', onReq);
        const dlg = page.locator('[role=dialog], div.fixed.inset-0').filter({ visible: true }).last();
        dlgText = (await dlg.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
        const toastText = await anyToast();
        s.observe(`dialog: ${dlgText.slice(0, 300) || '(none)'} · message: ${toastText || '(none)'} · requests: ${sent.join(', ') || '(none)'}`);
        acted = Boolean(dlgText || toastText || sent.length);
        expect(acted, 'Promote to SSO Organisation does nothing (no dialog, message or request)').toBe(true);
      }, { critical: true, attempts: 1 });
      await s.step('Confirm the promotion once → success message; the supplier is shown as an SSO organisation', async () => {
        // Nothing appeared in the first step (SCP-DEF-085): there is nothing to confirm, so this step only records that.
        if (!acted) { s.observe('nothing to confirm – the menu item did not act (SCP-DEF-085)'); return; }
        const dlg = page.locator('[role=dialog], div.fixed.inset-0').filter({ visible: true }).last();
        if (dlgText) { await dlg.getByRole('button', { name: /^(Promote|Confirm|Yes|Submit|Save)/ }).last().click(); await k.settle(2500); }
        const toastText = await anyToast();
        s.observe(`message: ${toastText || '(none)'}`);
        expect(toastText, 'promotion confirmed').toMatch(/success|promoted|created/i);
        await slOpen(); await slSearch(RUN);
        s.observe(`row after promotion: ${(await supRow(SUP).innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200)}`);
      }, { attempts: 1 });
    });

    // ======================= First Delivery Inspections =======================
    const FDI = 'First Delivery Inspections';
    const fdiOpen = () => open('/first-delivery-inspections', FDI);
    const fdiRows = () => k.rows();
    await run.scenario(meta('FDI-REG-04', FDI, 'Filters narrow rows', 'Positive'), async s => {
      await s.step(`First Delivery Inspections (/first-delivery-inspections): status dropdown "All Statuses" › "Inspection Completed" → only completed inspections listed; reset to "All Statuses" → original row count returns`, async () => {
        // 13 Nov 2026: the filter was chosen while the list was still loading, and the late load replaced the filtered rows
        // (user: the filter works). Wait until the list has loaded and its row count is stable before choosing the status.
        await fdiOpen(); await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => null);
        let all = -1; for (const end = Date.now() + 15000; Date.now() < end;) { const n = await fdiRows().count(); if (n > 0 && n === all) break; all = n; await page.waitForTimeout(1500); }
        s.observe(`${all} rows`);
        const sel = main.locator('select').filter({ has: page.locator('option', { hasText: 'All Statuses' }) }).first();
        const opt = (await sel.locator('option').allInnerTexts()).find(t => /^Inspection Completed$/i.test(t.trim()));
        await sel.selectOption({ label: opt }); await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => null); await k.settle(1500);
        await expect.poll(async () => (await fdiRows().allInnerTexts()).every(t => /Inspection\s+Completed/i.test(t)), { message: 'Status filter leaves other statuses listed', timeout: 15000 }).toBe(true);
        s.observe(`${await fdiRows().count()} rows with "Inspection Completed"`);
        await sel.selectOption({ index: 0 }); await k.settle(1500);
        await expect.poll(() => fdiRows().count(), { timeout: 15000 }).toBe(all);
      });
      await s.step(`First Delivery Inspections: type "zz-nobody@example.com" in "Inspector email" → "No inspections found."; clear the field`, async () => {
        await main.getByPlaceholder('Inspector email').fill('zz-nobody@example.com'); await k.settle(1500);
        await expect(main.getByText('No inspections found.')).toBeVisible();
        await main.getByPlaceholder('Inspector email').fill(''); await k.settle(1000);
      });
    });
    await run.scenario(meta('FDI-REG-05', FDI, 'No FDI audit trail (PL-R10)', 'Info'), async s => {
      await s.step(`Open First Delivery Inspections → no "Audit Trail" control on the page`, async () => { await fdiOpen(); await expect(page.getByText('Audit Trail', { exact: true })).toHaveCount(0); });
    });
    await run.scenario(meta('FDI-REG-01b', FDI, 'One inspection per material (FDI-R1)', 'Negative'), async s => {
      await s.step(`Open First Delivery Inspections, read the Material column of every row → no material appears more than once`, async () => {
        await fdiOpen(); const mats = [];
        for (const r of await fdiRows().all()) mats.push(await col(r, 'Material'));
        const dup = mats.filter((m, i) => m && mats.indexOf(m) !== i);
        s.observe(`${mats.length} inspections`);
        expect(dup, 'Materials with more than one inspection').toEqual([]);
      });
    });
    run.skip(meta('FDI-REG-01', FDI, 'First delivery creates one inspection', 'Integration'), 'Runs in pl-regression-3 (new material → GRN → FDI row)');
    run.skip(meta('FDI-REG-01a', FDI, 'Second delivery creates none', 'Negative'), 'Runs in pl-regression-3');
    run.skip(meta('FDI-REG-01c', FDI, 'Access needed', 'Role'), 'Needs a role without FDI access; changing shared roles is out of scope (PM role scenarios cover the model)');

    const target = () => fdiRows().filter({ hasText: /Auditor Not Yet Assigned/i }).filter({ hasText: /Auto Fdi|Pld|Pl[tr]/i }).first();
    // The FDI list loads slowly: count() right after opening saw an empty table, so these cases were skipped even when
    // unassigned run inspections existed (20 Nov 2026: 49 such rows). Wait for one to render before deciding.
    const hasTarget = await (async () => {
      await fdiOpen();
      return target().waitFor({ state: 'visible', timeout: 30000 }).then(() => true, () => false);
    })();
    if (hasTarget) {
      let mat = '';
      await run.scenario(meta('FDI-REG-06', FDI, 'Self Assign', 'Positive'), async s => {
        await s.step(`First Delivery Inspections: on a run row "Auditor Not Yet Assigned" click "Self Assign" → toast "You have been assigned as the auditor for this inspection"`, async () => {
          mat = await col(target(), 'Material'); s.observe(`Inspection for ${mat}`);
          await target().getByRole('button', { name: 'Self Assign' }).click();
          await toast('You have been assigned as the auditor for this inspection');
        }, { critical: true });
        await s.step(`Reload First Delivery Inspections → that material's row shows "Awaiting Inspection Completion" and the signed-in user as assignee`, async () => {
          await page.reload(); await k.settle(1500);
          const r = fdiRows().filter({ hasText: mat }).first();
          await expect(r).toContainText(/Awaiting Inspection Completion/i);
          await expect(r).toContainText(config.username);
        });
      });
      const mine = () => fdiRows().filter({ hasText: mat }).first();
      await run.scenario(meta('FDI-REG-07', FDI, 'Unassign Self and reassign', 'Positive'), async s => {
        await s.step(`First Delivery Inspections: on the row click "Unassign Self", reload → row shows "Auditor Not Yet Assigned"`, async () => {
          await mine().getByRole('button', { name: 'Unassign Self' }).click(); await k.settle(1500);
          await page.reload(); await k.settle(1500); await expect(mine()).toContainText(/Auditor Not Yet Assigned/i);
        });
        await s.step(`First Delivery Inspections: click "Self Assign" on the same row → toast "You have been assigned"; reload the page`, async () => { await mine().getByRole('button', { name: 'Self Assign' }).click(); await toast('You have been assigned'); await page.reload(); await k.settle(1500); });
      });
      run.skip(meta('FDI-REG-02', FDI, 'Assign inspector', 'Positive'), 'Covered by FDI-REG-06 (self assignment is the assignment path for this role)');
      const form = async () => { await mine().getByRole('button', { name: 'Fill Inspection Report' }).click(); await expect(page).toHaveURL(/\/form/); await page.getByRole('button', { name: 'Submit Inspection' }).waitFor({ timeout: 30000 }); };
      const answer = v => page.getByRole('button', { name: new RegExp(`^${v}$`, 'i') }).or(page.getByRole('radio', { name: new RegExp(`^${v}$`, 'i') })).or(page.getByText(new RegExp(`^${v}$`, 'i')));
      await run.scenario(meta('FDI-REG-08', FDI, 'Photo required', 'Negative'), async s => {
        await s.step(`First Delivery Inspections: row "Fill Inspection Report" (opens /form), click "Submit Inspection" without a photo → message "At least one photo is required before submitting this inspection."`, async () => {
          await form();
          await page.getByRole('button', { name: 'Submit Inspection' }).click();
          await expect(page.getByText('At least one photo is required before submitting this inspection.').first()).toBeVisible();
        });
      });
      await run.scenario(meta('FDI-REG-09', FDI, 'Save Progress keeps answers', 'Positive'), async s => {
        await s.step(`Inspection form: answer the first question "Fail", type "${RUN} fail note" in its Observation box, click "Save Progress" → progress saved (toast noted)`, async () => {
          await answer('fail').first().click();
          await page.getByRole('textbox', { name: /Observation/i }).first().fill(`${RUN} fail note`);
          await page.getByRole('button', { name: 'Save Progress' }).click(); await k.settle(1500);
          s.observe(`Toast: ${await anyToast()}`);
        });
        await s.step(`Reload the inspection form → the first Observation box still holds "${RUN} fail note"`, async () => {
          await page.reload(); await page.getByRole('button', { name: 'Submit Inspection' }).waitFor({ timeout: 30000 }); await k.settle(1000);
          await expect(page.getByRole('textbox', { name: /Observation/i }).first()).toHaveValue(`${RUN} fail note`);
        });
      });
      const done = await run.scenario(meta('FDI-REG-10', FDI, 'Submit inspection (FAIL path, FDI-REG-11)', 'Positive'), async s => {
        await s.step(`Inspection form: answer all remaining questions "Pass", click "Add photo" and attach a small PNG, click "Submit Inspection" → "Inspection Detail" page opens`, async () => {
          const pass = answer('pass');
          for (let i = 1, n = await pass.count(); i < n; i++) await pass.nth(i).click();
          const png = path.join(tmp, `${RUN}.png`); fs.writeFileSync(png, PNG);
          const ch = page.waitForEvent('filechooser'); await page.getByRole('button', { name: /Add photo/i }).click(); await (await ch).setFiles(png);
          await k.settle(1500);
          await page.getByRole('button', { name: 'Submit Inspection' }).click();
          await expect(page.getByText('Inspection Detail').first()).toBeVisible({ timeout: 30000 });
        }, { critical: true });
        await s.step(`Inspection Detail → shows "inspection completed", the "Fail" answer with "${RUN} fail note", sync state "Not synced" and a "Sync to Provider" button`, async () => {
          await expect(page.getByText(/inspection completed/i).first()).toBeVisible();
          await expect(page.getByText(/^fail$/i).first()).toBeVisible();
          await expect(page.getByText(`${RUN} fail note`).first()).toBeVisible();
          await expect(page.getByText(/Not synced/i).first()).toBeVisible();
          await expect(page.getByRole('button', { name: 'Sync to Provider' })).toBeVisible();
        });
      });
      run.skip(meta('FDI-REG-11', FDI, 'FAIL answer path', 'Positive'), done?.status === 'Passed' ? 'Covered by FDI-REG-10 (first answer FAIL with observation)' : 'FDI-REG-10 failed');
      run.skip(meta('FDI-REG-03', FDI, 'Complete inspection form', 'Positive'), 'Covered by FDI-REG-08…10');
    } else for (const id of ['06', '07', '02', '08', '09', '10', '11', '03']) run.skip(meta(`FDI-REG-${id}`, FDI, 'Needs an unassigned run inspection', 'Dependent'), 'No "Auditor Not Yet Assigned" run inspection; run npm run procurement:regression3 first');
    run.skip(meta('FDI-REG-12', FDI, 'Sync to Provider', 'Integration'), 'Pushes to Procore (external system); not executed');

    // ======================= Document Management =======================
    const DOC = 'Document Management';
    const dm = (id, title, kind, page_) => meta(id, DOC, title, kind, { navPath: [DOC, page_] });
    const allDocs = () => open('/all-documents', 'All Documents', DOC);
    const docSearch = async t => { const b = page.getByRole('textbox', { name: /Search by filename/ }); await b.fill(t); await btn('Search').click(); await k.settle(1500); };
    const category = async c => { await main.locator('select').filter({ has: page.locator('option', { hasText: 'PO File' }) }).first().selectOption({ label: c }); await k.settle(1500); };
    const docCount = async () => Number(((await main.innerText()).match(/(\d+) document/) || [])[1] || NaN);

    await run.scenario(dm('DOC-REG-01', 'Search by filename/material', 'Positive', 'All Documents'), async s => {
      await s.step(`Document Management › All Documents: type ${k.MATERIAL} in "Search by filename", click "Search" → fewer documents than before and every row mentions the material`, async () => {
        await allDocs(); const all = await docCount();
        await docSearch(k.MATERIAL);
        expect(await docCount()).toBeLessThan(all);
        for (const t of await k.rows().allInnerTexts()) expect(t.toLowerCase()).toContain(k.MATERIAL.toLowerCase());
      });
      await s.step(`All Documents: search "zz-no-such-file-zz" → "No documents found." and count 0; clear the search`, async () => { await docSearch('zz-no-such-file-zz'); await expect(main.getByText('No documents found.').first()).toBeVisible(); expect(await docCount()).toBe(0); await docSearch(''); });
    });
    await run.scenario(dm('DOC-REG-02', 'Category filter', 'Positive', 'All Documents'), async s => {
      await s.step(`Document Management › All Documents: set the Category dropdown to "PO File" → at least one row and every row has Category "PO File"`, async () => { await allDocs(); await category('PO File'); const rows = await k.rows().all(); expect(rows.length).toBeGreaterThan(0); for (const r of rows) expect(await col(r, 'Category')).toBe('PO File'); });
    });
    await run.scenario(dm('DOC-REG-03', 'Module files appear', 'Integration', 'All Documents'), async s => {
      for (const c of ['Pdf', 'PO File', 'Delivery Photo', 'Inventory']) {
        await s.step(`All Documents: set Category "${c}" → first row is listed (Material is filled, except for "Inventory")`, async () => {
          await allDocs(); await category(c);
          const r = k.rows().first(); await expect(r).toBeVisible();
          if (c !== 'Inventory') expect(await col(r, 'Material'), `${c} material`).toBeTruthy();
        });
      }
    });
    await run.scenario(dm('DOC-REG-04', 'Uploaded By is the real user', 'Positive', 'All Documents'), async s => {
      for (const c of ['PO File', 'Pdf']) {
        await s.step(`All Documents: set Category "${c}" → first row's "Uploaded By" is a user email (contains "@")`, async () => {
          await allDocs(); await category(c);
          const by = await col(k.rows().first(), 'Uploaded By'); s.observe(`${c}: ${by}`);
          expect(by, `${c} Uploaded By is "${by}" (OBS-DOC-1/2)`).toMatch(/@/);
        });
      }
    });
    await run.scenario(dm('DOC-REG-05', 'View / Download', 'Positive', 'All Documents'), async s => {
      await s.step(`All Documents: click "Download" on the first row → file downloads and is not empty`, async () => {
        await allDocs(); const name = await col(k.rows().first(), 'Filename');
        const file = await download(() => k.rows().first().getByText('Download', { exact: true }).or(k.rows().first().getByRole('button', { name: 'Download' })).first().click());
        expect(fs.statSync(file).size).toBeGreaterThan(0); s.observe(`${name} → ${path.basename(file)}`);
      });
      await s.step(`All Documents: click "View" on the first row → file opens in a new tab or in the page (noted), then close it`, async () => {
        const popup = page.waitForEvent('popup', { timeout: 15000 }).catch(() => null);
        await k.rows().first().getByText('View', { exact: true }).or(k.rows().first().getByRole('button', { name: 'View' })).first().click();
        const p = await popup; if (p) { s.observe(`View opened ${p.url().slice(0, 80)}`); await p.close(); } else { await k.settle(1000); s.observe('View opened in page'); await page.keyboard.press('Escape'); }
      });
    });

    const specOpen = () => open('/spec-documents', 'Spec Documents', DOC);
    const SPEC = `${RUN}-spec.pdf`;
    const specRow = () => k.rows().filter({ hasText: SPEC }).first();
    const spec = await run.scenario(dm('DOC-REG-06', 'Spec document upload', 'Positive', 'Spec Documents'), async s => {
      await s.step(`Document Management › Spec Documents: upload the generated PDF ${SPEC} through the file input → upload is processed`, async () => {
        const f = path.join(tmp, SPEC); writePdf(f, `${RUN} spec`);
        await specOpen(); await main.locator('input[type="file"]').first().setInputFiles(f); await k.settle(3000);
      }, { critical: true });
      await s.step(`Spec Documents → ${SPEC} row is listed with Status containing "uploaded" and an "Uploaded by" value`, async () => {
        await expect(specRow()).toBeVisible({ timeout: 30000 });
        expect(await col(specRow(), 'Status')).toMatch(/uploaded/i);
        expect(await col(specRow(), 'Uploaded by')).toBeTruthy();
      });
    });
    if (spec?.status === 'Passed') {
      await run.scenario(dm('DOC-REG-07', 'Spec Section No add', 'Positive', 'Spec Documents'), async s => {
        await s.step(`Spec Documents: on the ${SPEC} row click "Add", in the "Spec Section No" picker choose the first section (not "None"), click "Save" → reopened list shows that Spec Section No on the row`, async () => {
          await specRow().getByRole('button', { name: /^(Add|Edit)/ }).or(specRow().getByText('Add', { exact: true })).first().click({ force: true });
          const dlg = page.locator('div').filter({ has: page.getByText('Spec Section No', { exact: true }) }).filter({ has: page.getByRole('button', { name: 'Save', exact: true }) }).last();
          let chosen;
          const sel = dlg.locator('select');
          if (await sel.count()) { chosen = (await sel.first().locator('option').allInnerTexts()).map(t => t.trim()).find(t => !/None/.test(t)); await sel.first().selectOption({ label: chosen }); }
          else { await dlg.getByText('— None —').first().click(); await k.settle(500); const o = listbox().getByRole('option').filter({ hasNotText: /None/ }).first(); chosen = (await o.innerText()).trim(); await o.click(); }
          s.observe(`Chosen ${chosen}`);
          await dlg.getByRole('button', { name: 'Save', exact: true }).click(); await k.settle(1500);
          await specOpen(); expect(await col(specRow(), 'Spec Section No')).toContain(chosen);
        });
      });
      await run.scenario(dm('DOC-REG-08', 'Spec document delete (run file)', 'Positive', 'Spec Documents'), async s => {
        await s.step(`Spec Documents: on the ${SPEC} row click "Delete", confirm if asked → row is gone after reopening the page`, async () => {
          await specRow().getByRole('button', { name: 'Delete' }).or(specRow().getByText('Delete', { exact: true })).first().click();
          const c = page.getByRole('button', { name: /^(Delete|Confirm|Yes)$/ }).last(); if (await c.isVisible().catch(() => false)) await c.click();
          await k.settle(1500); await specOpen(); await expect(specRow()).toBeHidden();
        });
      });
    } else for (const id of ['07', '08']) run.skip(dm(`DOC-REG-${id}`, 'Needs the run spec file', 'Dependent', 'Spec Documents'), 'DOC-REG-06 failed');
    await run.scenario(dm('DOC-REG-09', 'Spec upload over 60 MB rejected', 'Boundary', 'Spec Documents'), async s => {
      await s.step(`Spec Documents: upload a 61 MB PDF through the file input → a size message (60 MB limit) is shown and the file is not listed`, async () => {
        const big = path.join(tmp, `${RUN}-big.pdf`); fs.writeFileSync(big, Buffer.alloc(61 * 1024 * 1024, 32));
        await specOpen(); await main.locator('input[type="file"]').first().setInputFiles(big); await k.settle(3000);
        const msg = await page.getByText(/60 ?MB|too large|exceeds/i).filter({ hasNotText: 'up to 60 MB' }).filter({ hasNotText: 'Max 60 MB' }).first().isVisible().catch(() => false);
        const listed = await k.rows().filter({ hasText: `${RUN}-big.pdf` }).count();
        if (listed) { s.observe('Oversize file was accepted'); }
        expect(listed, 'File over 60 MB was uploaded').toBe(0);
        expect(msg, 'No size message shown').toBe(true);
      });
    });
    await run.scenario(dm('DOC-REG-10', 'PO validation without line items', 'Negative', 'PO Validation'), async s => {
      await s.step(`Document Management › PO Validation: upload a generated PDF without line items → message "The uploaded file contains no line items."`, async () => {
        const f = path.join(tmp, `${RUN}-po.pdf`); writePdf(f, `${RUN} no items`);
        await open('/po-validation', 'PO Validation', DOC); await main.locator('input[type="file"]').first().setInputFiles(f);
        await expect(page.getByText('The uploaded file contains no line items.').first()).toBeVisible({ timeout: 60000 });
      });
    });
    run.skip(dm('DOC-REG-11', 'PO validation with a valid PO', 'Positive', 'PO Validation'), 'Needs a sample PO with line items (Q-DOC-3, Q-PL-13)');
    run.skip(dm('DOC-REG-12', 'BOM validation', 'Positive', 'BOM Validation'), 'Needs a sample BOM (Q-DOC-3)');

    const epdOpen = () => open('/epd-report', 'EPD Report', DOC);
    let epdSub = '';
    const epd = await run.scenario(dm('DOC-REG-13', 'EPD upload sets Procurement "EPD Exists" = Yes', 'Integration', 'EPD Report'), async s => {
      await s.step(`Document Management › EPD Report: choose the latest run submittal (PLT/PLR/PLS…-SUB) in the dropdown, attach a generated PDF, click "Upload" → upload sent (toast noted)`, async () => {
        await epdOpen();
        const sel = main.locator('select').first();
        const opts = (await sel.locator('option').allInnerTexts()).filter(t => RUN_SUBMITTAL.test(t));
        if (!opts.length) throw new Error('No run submittal in the EPD list; run the Procurement regression first');
        // Full submittal number incl. suffixes (e.g. PLT2611021638-SUB-Q-R); RUN_SUBMITTAL alone stops at "-SUB" and the
        // Procurement Log search then also lists -SUB-P, -SUB-I1 … (13 Nov 2026: the wrong row was read).
        const opt = opts[opts.length - 1]; epdSub = (opt.match(/PL[TRS]\d{10}-SUB(?:-[A-Z0-9]+)*/) || opt.match(RUN_SUBMITTAL) || [])[0]; await sel.selectOption({ label: opt });
        const f = path.join(tmp, `${RUN}-epd.pdf`); writePdf(f, `${RUN} not an EPD`);
        await main.locator('input[type="file"]').first().setInputFiles(f);
        const up = main.getByRole('button', { name: /^Upload/ }).first(); if (await up.isEnabled().catch(() => false)) await up.click();
        await k.settle(4000); s.observe(`Submittal ${epdSub}; ${await anyToast()}`);
      }, { critical: true });
      // 13 Nov 2026 triage (user): working fine. "EPD Exists" shows the upload date (a link) once an EPD is attached, "No" otherwise.
      await s.step(`Procurement Log: search that submittal, read its own row (exact Submittal No) → "EPD Exists" is no longer "No" (shows Yes or the upload date)`, async () => {
        await k.openLog(); await k.search(epdSub);
        const r = k.rows().filter({ has: page.getByRole('cell', { name: epdSub, exact: true }) }).first();
        const v = await col(r, 'EPD Exists'); s.observe(`${epdSub} EPD Exists: ${v}`);
        expect(v, `EPD Exists shows "${v}" (OBS-DOC-3)`).toMatch(/^(Yes|\d{2}\/\d{2}\/\d{4})$/);
      });
    });
    // 13 Nov 2026 triage (user): a parsed record shows "Completed" whatever the PDF content and the list shows every PDF
    // attached to a submittal (incl. delivery QR PDFs) – working as designed. Both cases now check the upload is listed.
    await run.scenario(dm('DOC-REG-14', 'Uploaded PDF listed with a status', 'Positive', 'EPD Report'), async s => {
      if (epd?.status === 'Failed' && !epdSub) { s.observe('No upload'); }
      await s.step(`EPD Report › EPD Records: find the run submittal row → it lists the uploaded ${RUN}-epd.pdf with a Status (Completed / Pending / …)`, async () => {
        await epdOpen(); const r = k.rows().filter({ hasText: `${RUN}-epd.pdf` }).first();
        await expect(r, `${RUN}-epd.pdf in EPD Records`).toBeVisible({ timeout: 15000 });
        const st = await col(r, 'Status'); s.observe(`${epdSub} Status: ${st}`);
        expect(st, 'Uploaded EPD record has no status').toMatch(/\w/);
      });
    });
    await run.scenario(dm('DOC-REG-15', 'EPD Records list and summary cards', 'Positive', 'EPD Report'), async s => {
      await s.step(`EPD Report: read the summary cards and the EPD Records rows → records are listed (QR/checklist PDFs included by design; "Total EPDs" card and row count noted)`, async () => {
        await epdOpen(); const rows = (await k.rows().allInnerTexts()).filter(t => t.trim());
        const total = ((await main.innerText()).match(/(\d+)\s*\n?\s*Total EPDs/) || [])[1];
        s.observe(`Total EPDs card ${total ?? '?'}, ${rows.length} rows listed`);
        expect(rows.length, 'EPD Records list is empty').toBeGreaterThan(0);
      });
    });
    run.skip(dm('DOC-REG-16', 'Scan Procore for EPDs', 'Integration', 'EPD Report'), 'Procore link (external system); not executed');

    // ======================= Shipments =======================
    const SHP = 'International Shipments';
    const ESH = 'Enterprise Shipments';
    const entShip = () => open('/enterprise-shipments', ESH, 'Enterprise');
    // The page shows "Loading international shipments…" until the data arrives; on 21 Nov 2026 this took more than 90 s after a
    // long run (shared staging data). Wait up to 3 min and record slow loads, so a slow page is visible in the report.
    const slowLoads = [];
    // 23 Nov 2026: the list took ~200 s to appear (list-by-project API), so wait up to 6 min. reuse=true keeps an already loaded page
    // (no reload) where the case does not need fresh data.
    const intlShip = async (reuse = false) => {
      if (reuse && /\/international-shipments/.test(page.url()) && await page.getByText('Total International').first().isVisible().catch(() => false)) return;
      const started = Date.now();
      await open('/international-shipments', SHP);
      await expect(page.getByText('Total International').first()).toBeVisible({ timeout: 360000 }); // a loading text can linger after the data shows
      const seconds = Math.round((Date.now() - started) / 1000);
      if (seconds > 30) slowLoads.push(seconds);
    };
    const noteSlowLoads = s => { if (slowLoads.length) s.observe(`SLOW PAGE: International Shipments needed ${slowLoads.splice(0).join(' s, ')} s to show its data`); };
    let shipSub = '';
    const shipRow = () => k.rows().filter({ hasText: shipSub }).first();
    await run.scenario(meta('SHP-REG-01', SHP, 'Log shipment validation', 'Negative', { navPath: ['Enterprise', ESH] }), async s => {
      await s.step(`Enterprise › Enterprise Shipments › "+ Log Shipment": Submittal select is disabled until a Project is chosen; click "Log shipment" empty → dialog stays open, no "Shipment logged" toast (message noted)`, async () => {
        await entShip(); await main.getByRole('button', { name: /Log Shipment/i }).first().click();
        const dlg = page.locator('div.shadow-xl').filter({ has: page.getByRole('button', { name: 'Log shipment', exact: true }) }).last();
        await expect(dlg.locator('select').nth(1), 'Submittal is locked until a project is chosen').toBeDisabled();
        await page.getByRole('button', { name: 'Log shipment', exact: true }).click(); await k.settle(1500);
        s.observe(`Message: ${(await dlg.innerText()).match(/[^\n]*(required|choose|select)[^\n]*/i)?.[0] || (await anyToast()) || '(none)'}`);
        await expect(dlg, 'Empty shipment was logged').toBeVisible();
        expect(await anyToast()).not.toMatch(/Shipment logged/);
      });
    });
    const logged = await run.scenario(meta('SHP-REG-02', SHP, 'Log shipment for a run submittal', 'Positive', { navPath: ['Enterprise', ESH] }), async s => {
      await s.step(`Enterprise Shipments › "+ Log Shipment": Project ${config.projectName}, latest run Submittal, Manufacturer name "Mfr ${RUN}", Manufacturer country "South Korea", Container # "C${RUN}", Port of origin "Busan", Port of destination "Chennai", "Log shipment" → toast "Shipment logged."`, async () => {
        await entShip(); await main.getByRole('button', { name: /Log Shipment/i }).first().click(); await k.settle(800);
        const dlg = page.locator('div.shadow-xl').filter({ has: page.getByRole('button', { name: 'Log shipment', exact: true }) }).last();
        const sels = dlg.locator('select');
        await sels.nth(0).selectOption({ label: (await sels.nth(0).locator('option').allInnerTexts()).find(t => t.includes(config.projectName)) });
        await expect.poll(async () => sels.nth(1).locator('option').count(), { timeout: 30000 }).toBeGreaterThan(1); // "Loading submittals…" first
        const opts = (await sels.nth(1).locator('option').allInnerTexts()).filter(t => /delivery chain/.test(t));
        const opt = opts[opts.length - 1] || (await sels.nth(1).locator('option').allInnerTexts()).filter(t => RUN_SUBMITTAL.test(t)).pop();
        if (!opt) throw new Error('No run submittal offered; run the Procurement regression first');
        shipSub = opt.split(' — ')[0].trim(); await sels.nth(1).selectOption({ label: opt });
        await field(dlg, 'Manufacturer name', `Mfr ${RUN}`);
        await field(dlg, 'Manufacturer country', 'South Korea');
        await field(dlg, 'Container #', `C${RUN}`);
        await field(dlg, 'Port of origin', 'Busan'); await field(dlg, 'Port of destination', 'Chennai');
        await page.getByRole('button', { name: 'Log shipment', exact: true }).click();
        await toast('Shipment logged.');
      }, { critical: true });
      await s.step(`Reopen Enterprise Shipments → a row for the logged submittal is listed`, async () => { await entShip(); await expect(shipRow()).toBeVisible({ timeout: 30000 }); s.observe(`Submittal ${shipSub}`); });
    });
    if (logged?.status === 'Passed') {
      await run.scenario(meta('SHP-REG-03', SHP, 'Initial status follows procurement (Q-SHP-1)', 'Integration', { navPath: ['Enterprise', ESH] }), async s => {
        await s.step(`Enterprise Shipments: read Status of the logged shipment's row → it is not "Pending Order" (submittal is already delivering)`, async () => {
          const st = await col(shipRow(), 'Status'); s.observe(`Status: ${st}`);
          expect(st, 'New shipment starts at Pending Order although the submittal is already delivering (OBS-SHP-1)').not.toBe('Pending Order');
        });
      });
      await run.scenario(meta('SHP-REG-04', SHP, 'Edit shipping details', 'Positive', { navPath: ['Enterprise', ESH] }), async s => {
        await s.step(`Enterprise Shipments: row "Edit" › "Edit shipping details": set Shipping line "Line ${RUN}", "Save" → toast "Shipping details updated."; reopened list shows it in the "Shipping Line" column`, async () => {
          await shipRow().getByRole('button', { name: 'Edit' }).click();
          const dlg = page.getByText('Edit shipping details').first().locator('xpath=ancestor::div[.//input][1]');
          await field(dlg, 'Shipping line', `Line ${RUN}`);
          await page.getByRole('button', { name: /^(Save|Update)/ }).last().click();
          await toast('Shipping details updated.');
          await entShip(); expect(await col(shipRow(), 'Shipping Line')).toBe(`Line ${RUN}`);
        });
      });
      await run.scenario(meta('SHP-REG-09', SHP, 'Open shows the shipment', 'Positive', { navPath: ['Enterprise', ESH] }), async s => {
        await s.step(`Enterprise Shipments: search the submittal in "Search submittal…", click "Open" on its row → the URL contains the submittal number (opens the shipment)`, async () => {
          await entShip(); await main.getByPlaceholder(/^Search submittal/).fill(shipSub); await k.settle(1500);
          await shipRow().getByRole('button', { name: 'Open' }).or(shipRow().getByRole('link', { name: 'Open' })).first().click(); await k.settle(2000);
          s.observe(`Opened ${new URL(page.url()).pathname}${new URL(page.url()).search}`);
          expect(page.url(), 'Open goes to the shipments list, not the shipment (OBS-SHP-3)').toMatch(new RegExp(esc(shipSub)));
        });
      });
      await run.scenario(meta('SHP-REG-05', SHP, 'Status change persists', 'Positive'), async s => {
        let tile = 0;
        const inTransit = async () => Number(((await main.innerText()).match(/In Transit\s*(\d+)|(\d+)\s*In Transit/) || []).slice(1).find(Boolean) || NaN);
        await s.step(`International Shipments (/international-shipments): note the "In Transit" tile count, set the logged row's status select to "In Transit"`, async () => {
          await intlShip(); tile = await inTransit();
          const sel = shipRow().locator('select').first(); await sel.selectOption({ label: 'In Transit' }); await k.settle(2000);
        }, { critical: true });
        await s.step(`After the status change, read the confirmation message → toast text noted (no assertion)`, async () => { s.observe(`Toast: ${(await anyToast()) || '(none)'}`); });
        await s.step(`Reopen International Shipments → row status select still "In Transit" and the "In Transit" tile is one higher`, async () => {
          await intlShip(); await expect(shipRow().locator('select').first()).toHaveValue(/in.?transit/i);
          if (!Number.isNaN(tile)) expect(await inTransit()).toBe(tile + 1);
        });
        await s.step(`Reopen Enterprise Shipments → the logged row's Status shows "In Transit"`, async () => { await entShip(); expect(await col(shipRow(), 'Status')).toMatch(/In Transit/i); });
        noteSlowLoads(s);
      });
      await run.scenario(meta('SHP-REG-06', SHP, 'Status change confirmation', 'Positive'), async s => {
        await s.step(`International Shipments: set the row's status select to "Shipped" → a confirmation toast appears`, async () => {
          await intlShip(true); await shipRow().locator('select').first().selectOption({ label: 'Shipped' }); await k.settle(1200);
          const t = await anyToast(); s.observe(`Toast: ${t || '(none)'}`);
          expect(t, 'Status change gives no confirmation (OBS-SHP-2)').toBeTruthy();
        });
        noteSlowLoads(s);
      });
      await run.scenario(meta('SHP-REG-08', SHP, 'Required Date from procurement', 'Integration'), async s => {
        await s.step(`International Shipments: read "Required Date" of the logged row → it is not "-"`, async () => { await intlShip(true); const v = await col(shipRow(), 'Required Date'); s.observe(`Required Date: ${v}`); expect(v, 'Required Date is "-" (OBS-PL-19)').not.toBe('-'); });
        noteSlowLoads(s);
      });
      await run.scenario(meta('SHP-REG-10', SHP, 'Search / filters', 'Positive', { navPath: ['Enterprise', ESH] }), async s => {
        await s.step(`Enterprise Shipments: type the submittal in "Search submittal…" → every row contains it; clear the field`, async () => {
          await entShip(); await main.getByPlaceholder(/^Search submittal/).fill(shipSub); await k.settle(1500);
          for (const t of await k.rows().allInnerTexts()) expect(t).toContain(shipSub);
          await main.getByPlaceholder(/^Search submittal/).fill(''); await k.settle(1000);
        });
        await s.step(`Enterprise Shipments: tick "At-risk only" → no listed row shows "On Track"; untick it`, async () => {
          await main.getByText(/At-risk only/).first().click(); await k.settle(1500);
          for (const t of await k.rows().allInnerTexts()) expect(t).not.toMatch(/On Track/);
          await main.getByText(/At-risk only/).first().click();
        });
      });
    } else for (const id of ['03', '04', '09', '05', '06', '08', '10']) run.skip(meta(`SHP-REG-${id}`, SHP, 'Needs the run shipment', 'Dependent'), 'SHP-REG-02 failed');
    run.skip(meta('SHP-REG-07', SHP, 'Flag from Procurement listed once', 'Integration'), 'Runs in Procurement regression (PL-REG-INT-02)');
    await run.scenario(meta('SHP-REG-11', SHP, 'Tabs render', 'Positive'), async s => {
      for (const t of ['Delay Alerts', 'Flag & Review', 'Shipments', 'Risk Dashboard']) {
        await s.step(`International Shipments${t === 'Delay Alerts' ? ' (opened first)' : ''}: click tab "${t}" → no "error" / "something went wrong" text on the page`, async () => {
          if (t === 'Delay Alerts') await intlShip(true);
          await main.getByRole('button', { name: new RegExp(`^${esc(t)}`) }).first().click(); await k.settle(1000);
          await expect(page.getByText(/error|something went wrong/i)).toHaveCount(0);
        });
      }
      noteSlowLoads(s);
    });

    // ======================= Management Dashboard =======================
    const DSH = 'Management Dashboard';
    const dash = () => open('/management-dashboard', DSH);
    const tab = name => main.getByRole('button', { name: new RegExp(`^${name}(\\s|\\d|$)`) }).first();
    const counter = async name => Number(((await tab(name).innerText()).match(/\d+/) || [])[0] || NaN);
    const tabTexts = async name => { await tab(name).click(); await k.settle(1000); return (await k.rows().allInnerTexts()).join('\n'); };
    await run.scenario(meta('DSH-REG-01', DSH, 'Mark as read', 'Positive'), async s => {
      await s.step(`Management Dashboard › "Notifications" tab (unread filter on if available): click the envelope icon "Mark as read" on the first row → toast "Marked as read!" and the tab counter drops by 1`, async () => {
        await dash(); await tab('Notifications').click(); await k.settle(1000);
        const unread = main.getByRole('checkbox').or(main.getByText('Unread', { exact: true })).first();
        if (await unread.isVisible().catch(() => false)) { await unread.click(); await k.settle(1000); }
        const before = await counter('Notifications');
        await k.rows().first().locator('img[alt="Mark as read"]').click();
        await toast('Marked as read!');
        await expect.poll(() => counter('Notifications')).toBe(before - 1);
      });
    });
    await run.scenario(meta('DSH-REG-03', DSH, 'Unread toggle', 'Positive'), async s => {
      await s.step(`Management Dashboard › "Notifications": number of listed rows is not greater than the tab counter`, async () => { const n = await counter('Notifications'); expect(await k.rows().count()).toBeLessThanOrEqual(Math.max(n, 0) || 1000); });
    });
    await run.scenario(meta('DSH-REG-02', DSH, 'Mark all as read on this page', 'Positive'), async s => {
      await s.step(`Management Dashboard › "Notifications": click "Mark all as read on this page" → tab counter decreases (before and page row count noted)`, async () => {
        await tab('Notifications').click(); await k.settle(1000);
        const before = await counter('Notifications'); const rows = await k.rows().count();
        await main.getByText('Mark all as read on this page').first().click(); await k.settle(2000);
        s.observe(`${before} − ${rows}`);
        await expect.poll(() => counter('Notifications')).toBeLessThan(before);
      });
    });
    const events = [
      ['DSH-REG-04', 'Notifications', /Delivery of \d+ units of .+ has been received at site for submittal/, 'Delivery notification', 'has been received at site'],
      ['DSH-REG-05', 'Notifications', /Lead time changed\.\s+New expected delivery/, 'Lead time notification', 'Lead time changed'],
      ['DSH-REG-06', 'Alerts', /New submittal '.+' was added\./, 'New submittal alert', 'New submittal'],
      ['DSH-REG-07', 'Tasks', /Create PO\.\s+Last Possible Ordering Date/, 'Create PO task', 'Create PO'],
      ['DSH-REG-08', 'Tasks', /Notification has been triggered for Pre-Shipping Checklist\./, 'Pre-shipping task', 'Pre-Shipping Checklist'],
      ['DSH-REG-09', 'Notifications', /Delivery for Item/, 'Trigger Alert reaches the user (PL-R14, OBS-DSH-1)', 'Delivery for Item']
    ];
    // 13 Nov 2026 (user: DSH-REG-05/06/07 work): each tab opens filtered to "Unread" and lists hundreds of entries, so an
    // event that is already read or older is not on the first page. Like a user: read/unread filter "All", then search.
    const searchTab = async (keyword) => {
      const state = main.getByRole('button', { name: /^(Unread|Read|All)$/ }).or(main.getByText(/^(Unread|Read)$/)).first();
      if (await state.isVisible().catch(() => false) && !/^All$/.test((await state.innerText()).trim())) {
        await state.click(); await k.settle(500);
        await page.getByRole('option', { name: 'All', exact: true }).or(page.getByText('All', { exact: true })).last().click(); await k.settle(1500);
      }
      const inputs = main.locator('input:visible:not([type="checkbox"]):not([type="radio"])');
      for (let i = 0; i < await inputs.count(); i += 1) {
        const box = inputs.nth(i);
        if (/\d{2}\/\d{2}\/\d{4}/.test(await box.inputValue().catch(() => ''))) continue;
        await box.fill(keyword); await box.press('Enter').catch(() => null); await k.settle(2000); break;
      }
      return (await k.rows().allInnerTexts()).join('\n');
    };
    for (const [id, t, re, title, keyword] of events) {
      await run.scenario(meta(id, DSH, title, 'Integration'), async s => {
        await s.step(`Management Dashboard › "${t}" tab: look on the first page; if absent set the read filter to "All" and search "${keyword}" → matching ${title} entry is listed`, async () => {
          await dash();
          let found = re.test(await tabTexts(t)); let how = 'first page';
          if (!found) { found = re.test(await searchTab(keyword)); how = `filter "All" + search "${keyword}"`; }
          s.observe(`${found ? 'Found' : 'Not found'} (${how})`);
          expect(found, `${title}: not found in ${t} (first page, then All + search "${keyword}")`).toBe(true);
        });
      });
    }
    run.skip(meta('DSH-REG-10', DSH, 'Daily alert batch', 'Integration'), 'No expected result yet: which alerts the 05:00–06:00 IST batch creates is not defined (question for the team, 22 Nov 2026). A met alert rule is checked by PL-REG-ALR-05');
    await run.scenario(meta('DSH-REG-11', DSH, 'View in Procurement Log', 'Integration'), async s => {
      await s.step(`Management Dashboard: click "View in Procurement Log →" → opens /procurement-log with "Only my watched" checked`, async () => {
        await dash(); await main.getByText('View in Procurement Log →').first().click(); await k.settle(2000);
        await expect(page).toHaveURL(/\/procurement-log/);
        await expect(page.getByRole('checkbox', { name: 'Only my watched' })).toBeChecked();
      });
    });

    // ======================= Enterprise =======================
    const ENT = 'Enterprise';
    run.skip(meta('ENT-REG-01', ENT, 'Enterprise counts match Procurement', 'Integration'), 'Covered by the existing Enterprise suite (BUGS-325 oracle)');
    // 23 Nov 2026 (user: run the pending Enterprise cases): ENT-REG-02 uses a run submittal whose lead time is not confirmed
    // (the Configuration Options seed: ordered with a PO, lead time not confirmed); ENT-REG-03 compares the CSV
    // (long format "Metric,Key,Value") with the on-screen Supplier table.
    await run.scenario(meta('ENT-REG-02', ENT, 'Supplier Inbox lists run items', 'Integration', { navPath: [ENT, 'Supplier Inbox'] }), async s => {
      const seedFile = path.join(__dirname, '..', '..', 'reports', 'cfg-alert-seed.json');
      const seed = fs.existsSync(seedFile) ? JSON.parse(fs.readFileSync(seedFile, 'utf8')).notConfirmed : null;
      const heads = async () => (await main.locator('h1,h2,h3,h4,h5,[role=tab]').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
      await s.step('Enterprise › Supplier Inbox: open the page → the inbox sections are shown', async () => {
        await open('/supplier-inbox', 'Supplier Inbox', ENT); await k.settle(3000);
        const h = await heads();
        s.observe(`sections: ${h.join(' | ').slice(0, 300)}`);
        expect(h.some(t => /unconfirmed/i.test(t)), 'No "Unconfirmed lead times" section').toBe(true);
      });
      await s.step(`Submittal filter: type the run submittal ${seed ? seed.number : '(seed missing)'} (ordered with a PO, lead time not confirmed) → it is listed under the Unconfirmed lead times section`, async () => {
        expect(seed, 'Seed submittal file reports/cfg-alert-seed.json is missing').toBeTruthy();
        const box = main.getByPlaceholder(/SUB-/i).first();
        await box.fill(seed.number); await box.press('Enter').catch(() => {}); await k.settle(3500);
        // Sections are collapsed (▼) and show counts: read the Unconfirmed Lead Times count, then expand it.
        const flat = async () => (await main.innerText()).replace(/\s+/g, ' ');
        const txt = await flat();
        const count = Number((txt.match(/Unconfirmed Lead Times .*?(\d+) SUBMITTALS/i) || [])[1] || 0);
        const head = main.getByText(/^Unconfirmed Lead Times$/i).first();
        await head.click().catch(() => {}); await k.settle(2000);
        let open1 = await flat();
        if (!open1.includes(seed.number)) { await main.getByText('▼').first().click().catch(() => {}); await k.settle(2000); open1 = await flat(); }
        const sec = open1.indexOf('Unconfirmed Lead Times'); const next = open1.indexOf('Overdue Items', sec);
        const part = open1.slice(sec, next > sec ? next : sec + 1500);
        s.observe(`Unconfirmed Lead Times after the filter: ${count} submittal(s); expanded: ${part.slice(0, 500)}`);
        expect(count, 'Unconfirmed Lead Times lists no submittal for the run submittal').toBeGreaterThan(0);
        expect(part.includes(seed.number), `Run submittal ${seed.number} is not inside the Unconfirmed Lead Times section`).toBe(true);
      });
    });
    await run.scenario(meta('ENT-REG-03', ENT, 'Download CSV matches the table', 'Positive', { navPath: [ENT, 'Enterprise View'] }), async s => {
      let csv = [];
      const supTable = () => main.locator('table').filter({ has: page.getByRole('columnheader', { name: '% of total' }) }).first();
      await s.step('Enterprise › Enterprise View: click "Download CSV" → a CSV file with the columns Metric, Key, Value is downloaded', async () => {
        await open('/enterprise-view', 'Enterprise View', ENT); await k.settle(3000);
        const file = await download(() => main.getByRole('button', { name: 'Download CSV' }).click());
        const keep = path.join(__dirname, '..', '..', 'reports', 'reruns-2026-11-23', `enterprise-view-${RUN}.csv`);
        fs.copyFileSync(file, keep);
        csv = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(l => l.trim()).map(l => (l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || []).map(c => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim())).map(r => (r.length > 3 && r[r.length - 1] === '' ? r.slice(0, -1) : r));
        const metrics = [...new Set(csv.slice(1).map(r => r[0]))];
        s.observe(`${csv.length - 1} rows; header "${csv[0].join(',')}"; metrics (${metrics.length}): ${metrics.join(' | ').slice(0, 300)}`);
        expect(csv[0].map(c => c.toLowerCase())).toEqual(['metric', 'key', 'value']);
      });
      await s.step('Compare with the Supplier table (with "% of total") → every supplier in the table is in the CSV', async () => {
        const names = (await supTable().locator('tbody tr').evaluateAll(rows => rows.map(r => (r.querySelector('td') || {}).innerText || ''))).map(t => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
        const keys = new Set(csv.slice(1).map(r => r[1].replace(/\s+/g, ' ').trim().toLowerCase()));
        const missing = names.filter(n => !keys.has(n.toLowerCase()));
        s.observe(`Supplier table ${names.length} row(s); missing from the CSV: ${missing.length}${missing.length ? ` (${missing.slice(0, 6).join(', ')})` : ''}`);
        expect(missing, 'Suppliers shown in the table but missing from the CSV').toEqual([]);
      });
      await s.step('Enterprise View Supplier table: add up the "% of total" values → sum is about 100 (within 1.5)', async () => {
        const pcts = (await supTable().locator('tbody tr').allInnerTexts()).map(t => Number((t.match(/([\d.]+)\s*%/) || [])[1])).filter(n => !Number.isNaN(n));
        s.observe(`${pcts.length} values, sum ${pcts.reduce((a, b) => a + b, 0).toFixed(2)}`);
        if (pcts.length) expect(Math.abs(pcts.reduce((a, b) => a + b, 0) - 100)).toBeLessThan(1.5);
      });
    });

    // ======================= Analytics (APP-R1: observed baseline) =======================
    const ANA = 'Analytics';
    await run.scenario(meta('ANA-REG-01', ANA, 'Search narrows SubContractor Issues', 'Positive', { navPath: [ANA, 'SubContractor Issues'] }), async s => {
      // 13 Nov 2026 triage (user): 0 rows is valid – a subcontractor with no issue values for the user is not listed after
      // the search (values are not accumulated across rows). The search must only narrow the list, and an unknown text lists nothing.
      await s.step(`Analytics › SubContractor Issues: type the first 6 characters of the first row into "Search…" → row count is not higher than before (0 is valid when that subcontractor has no values); then search "zz${RUN}" → no rows`, async () => {
        await open('/subcontractor-issues', 'SubContractor Issues', ANA); await k.settle(2000);
        const all = await k.rows().count();
        const first = all ? ((await k.rows().first().getByRole('cell').first().innerText()) || '').trim() : '';
        await main.getByPlaceholder('Search…').fill(first.slice(0, 6)); await k.settle(1500);
        const n = await k.rows().count();
        await main.getByPlaceholder('Search…').fill(`zz${RUN}`); await k.settle(1500);
        const none = await k.rows().count();
        s.observe(`${all} → ${n} for "${first.slice(0, 6)}"; ${none} for "zz${RUN}"`);
        expect(n, 'Search returned more rows than the full list').toBeLessThanOrEqual(all);
        expect(none, 'Search for an unknown text still lists rows').toBe(0);
      });
    });
    await run.scenario(meta('ANA-REG-02', ANA, 'Export works', 'Positive', { navPath: [ANA, 'SubContractor Issues'] }), async s => {
      // 18 Nov 2026 Analytics validation: Export opens a menu whose only item is "Download Template"; on this page that item's
      // onClick is a no-op (no request, no file) – SCP-DEF-014. The scenario opens its own page so it can run alone (--only).
      let shown = 0;
      await s.step(`Analytics › SubContractor Issues: open the page, clear "Search…" → table rows are listed`, async () => {
        await open('/subcontractor-issues', 'SubContractor Issues', ANA); await k.settle(2000);
        await main.getByPlaceholder('Search…').fill(''); await k.settle(1000);
        shown = await k.rows().count(); s.observe(`${shown} row(s) shown`);
        expect(shown, 'SubContractor Issues lists no rows to export').toBeGreaterThan(0);
      });
      await s.step(`Click "Export", choose the export option (today only "Download Template") → an API request is sent and a non-template file with the shown rows is downloaded`, async () => {
        await main.getByRole('button', { name: /Export/ }).first().click();
        const items = (await page.getByRole('menuitem').allInnerTexts()).map(t => t.trim()).filter(Boolean);
        const choice = items.find(t => !/template/i.test(t)) || items[0];
        expect(choice, 'Export opens no menu option').toBeTruthy();
        const calls = []; const onReq = r => { if (/\/api\//.test(r.url()) && !/system_messages/.test(r.url())) calls.push(`${r.method()} ${r.url().split('?')[0]}`); };
        page.on('request', onReq);
        const dl = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
        await page.getByRole('menuitem', { name: choice, exact: true }).first().click();
        const d = await dl; page.off('request', onReq); await page.keyboard.press('Escape').catch(() => null);
        s.observe(`Export menu: [${items.join(', ')}]; clicked "${choice}"; API calls: ${calls.join(', ') || 'none'}; file: ${d ? d.suggestedFilename() : 'none'}`);
        if (!d) throw new Error(`Export › "${choice}" sent no request and produced no file within 15 s (menu: ${items.join(', ')})`);
        const file = path.join(tmp, d.suggestedFilename()); await d.saveAs(file);
        expect(/template/i.test(d.suggestedFilename()), `Export downloads a static template (${d.suggestedFilename()}), not the shown records`).toBe(false);
        expect(fs.statSync(file).size, 'Exported file is empty').toBeGreaterThan(0);
      });
    });
    await run.scenario(meta('ANA-REG-03', ANA, 'Status Report Generate', 'Positive', { navPath: [ANA, 'Status Report'] }), async s => {
      await s.step(`Analytics › Status Report: click "Generate" → at least one table is shown`, async () => {
        await open('/status-report', 'Status Report', ANA);
        await main.getByRole('button', { name: 'Generate' }).click(); await k.settle(3000);
        expect(await main.locator('table').count()).toBeGreaterThan(0);
      });
    });
    await run.scenario(meta('ANA-REG-04', ANA, 'Totals equal the sum of rows', 'Positive', { navPath: [ANA, 'Status Report'] }), async s => {
      await s.step(`Status Report: for each table with a "Total" row, add up each numeric column of the other rows → equals the Total value`, async () => {
        let checked = 0;
        for (const t of await main.locator('table').all()) {
          const rows = (await t.locator('tbody tr').allInnerTexts()).map(r => r.split('\t').map(c => c.trim()));
          const total = rows.find(r => /^total$/i.test(r[0])); if (!total) continue;
          const body = rows.filter(r => r !== total);
          for (let c = 1; c < total.length; c++) {
            const v = Number(total[c].replace(/,/g, '')); if (Number.isNaN(v)) continue;
            expect(body.reduce((a, r) => a + (Number((r[c] || '0').replace(/,/g, '')) || 0), 0), `column ${c}`).toBeCloseTo(v, 1); checked++;
          }
        }
        s.observe(`${checked} total column(s) checked`);
      });
    });
    await run.scenario(meta('ANA-REG-05', ANA, 'TOV Analytics opens its own pages', 'Positive', { navPath: [ANA, 'TOV Analytics', 'Financial Forecast'] }), async s => {
      // Since 18 Nov 2026 "TOV Analytics" is a menu group (child: Financial Forecast), no longer a link to /supplier-issues.
      const nav = page.locator('nav');
      await s.step(`Management Dashboard: click menu Analytics › "TOV Analytics" → the group expands and lists its pages (e.g. "Financial Forecast")`, async () => {
        await page.goto('/management-dashboard', { waitUntil: 'domcontentloaded' }); await k.settle(1500);
        if (!(await nav.getByRole('button', { name: 'TOV Analytics', exact: true }).isVisible().catch(() => false))) await nav.getByRole('button', { name: ANA, exact: true }).first().click();
        await nav.getByRole('button', { name: 'TOV Analytics', exact: true }).last().click(); await k.settle(1000);
        await expect(nav.getByRole('button', { name: 'Financial Forecast', exact: true }), 'TOV Analytics lists no "Financial Forecast" page').toBeVisible({ timeout: 8000 });
        s.observe(`TOV Analytics stays on ${new URL(page.url()).pathname} and expands`);
      });
      await s.step(`Click "Financial Forecast" → /financial-forecast opens (not /supplier-issues) with heading "Financial Forecast" and the "Total Contract Value" card`, async () => {
        await nav.getByRole('button', { name: 'Financial Forecast', exact: true }).last().click(); await k.settle(2500);
        const p = new URL(page.url()).pathname; s.observe(`Financial Forecast → ${p}`);
        expect(p, 'TOV Analytics page opens Supplier Issues (OBS-APP-1)').not.toBe('/supplier-issues');
        await expect(page).toHaveURL(/\/financial-forecast/);
        await expect(main.getByRole('heading', { name: 'Financial Forecast' }).first()).toBeVisible({ timeout: 15000 });
        await expect(main.getByText('Total Contract Value').first()).toBeVisible({ timeout: 15000 });
      });
    });
  } });
});
