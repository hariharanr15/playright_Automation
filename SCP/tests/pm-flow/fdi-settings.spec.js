// FDI settings → inspection form (PM-REG-FDI-05a…n, docs/functional-discovery/PM_REGRESSION_SCENARIOS.md), 22 Nov 2026.
// Project Management › First Delivery Inspection Config › "FDI Settings" has four project settings; each case sets them,
// opens a real inspection form (First Delivery Inspections › a run inspection "Auditor Not Yet Assigned" › Self Assign ›
// "Fill Inspection Report") and checks the effect. The four settings are recorded first and ALWAYS restored at the end.
// Run inspections come from Procurement Log part 3 (new material → first delivery → FDI record).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runPmSuite } = require('./support/pm-flow');
const { plKit } = require('./support/pl-flow');

const SUITE = 'FDI settings regression';
const MODULE = 'Project Management';
const SUB = 'First Delivery Inspection Config';
const RUN = `FDS${new Date().toISOString().replace(/\D/g, '').slice(2, 12)}`;
const SETTINGS = ['Need Overall Notes to be captured', 'Enable Uploading of Photos?', 'Photos are mandatory?', 'Provide Link to Submittal Spec Documents?'];
const [NOTES, UPLOADS, MANDATORY, SPEC] = SETTINGS;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fdi-settings-'));
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const file = (name, content) => { const p = path.join(tmp, name); fs.writeFileSync(p, content); return p; };

const meta = (id, title, kind = 'Integration') => ({ id, module: MODULE, submodule: SUB, suite: SUITE, title, kind, navPath: [MODULE, SUB] });

test.describe.configure({ mode: 'serial' });
test.setTimeout(2 * 60 * 60 * 1000);

test('FDI settings – effect on the inspection form', async ({ page, browserName }) => {
  await runPmSuite({ page, browserName, suite: SUITE, scenarios: async ({ run, config }) => {
    const k = plKit(page);
    const { main } = k;
    const state = { initial: null, used: [] };

    // ---------------- FDI Settings ----------------
    const openConfig = async () => { await page.goto('/first-delivery-inspection-config', { waitUntil: 'domcontentloaded' }); await k.settle(2500); await main.getByText('FDI Settings', { exact: true }).first().waitFor({ timeout: 30000 }); };
    const box = label => main.locator('label', { hasText: label }).locator('input[type="checkbox"]').first();
    const readSettings = async () => { const out = {}; for (const l of SETTINGS) out[l] = await box(l).isChecked(); return out; };
    // Uploads before "mandatory" (mandatory can only be ticked while uploads is ticked); Save; reload; verify.
    const applySettings = async wanted => {
      await openConfig();
      for (const l of [UPLOADS, NOTES, MANDATORY, SPEC]) if (l in wanted && (await box(l).isChecked()) !== wanted[l]) await box(l).click();
      await main.getByRole('button', { name: 'Save', exact: true }).first().click(); await k.settle(2000);
      await openConfig();
      // The saved values load after the page: poll so an unticked default is not read too early.
      const same = o => Object.keys(wanted).every(l => o[l] === wanted[l]);
      await expect.poll(async () => same(await readSettings()), { timeout: 15000 }).toBe(true).catch(() => null);
      const now = await readSettings();
      for (const l of Object.keys(wanted)) expect(now[l], `${l} saved`).toBe(wanted[l]);
      return now;
    };
    const describe = w => Object.entries(w).map(([l, v]) => `"${l}" ${v ? 'Yes' : 'No'}`).join(', ');

    // ---------------- Inspection forms ----------------
    // 25 Nov 2026: with the grouping unticked the page shows two tables – the category summary first, then the
    // inspections (the one with the "Outcome" column). Only the inspection rows are used.
    const fdiRows = () => main.locator('table').filter({ has: page.getByRole('columnheader', { name: 'Outcome' }) }).first().locator('tbody tr').filter({ has: page.locator('td') });
    // Since 24 Nov 2026 the page opens grouped by material category; the inspection rows show only with the grouping unticked.
    const openList = async () => {
      await page.goto('/first-delivery-inspections', { waitUntil: 'domcontentloaded' }); await k.settle(2500);
      // a page load lets the app pick the newest (run-created) site in the header (OBS-INV-12): put the run site back
      if (await k.keepSite().catch(() => false)) await k.settle(1500);
      const group = k.main.getByRole('checkbox', { name: 'Group by material category' });
      if (await group.isChecked().catch(() => false)) { await group.uncheck(); await k.settle(2000); }
      await fdiRows().first().waitFor({ timeout: 30000 });
    };
    const freeRow = () => fdiRows().filter({ hasText: /Auditor Not Yet Assigned/i }).filter({ hasText: /Auto Fdi|Pld|Pl[tr]/i }).first();
    // Self-assigns the next free run inspection and opens its form; returns the material name.
    // Since 24 Nov 2026 unassigned rows show no "Self Assign" button for this account; run inspections already assigned
    // to it and still "Awaiting Inspection Completion" offer "Fill Inspection Report" – one of those is used instead.
    const mineRow = () => fdiRows().filter({ hasText: /Awaiting Inspection/i }).filter({ hasText: /Auto Fdi|Pld|Pl[tr]/i })
      .filter({ has: page.getByRole('button', { name: 'Fill Inspection Report' }) });
    // 26 Nov 2026 (user decision): a full run submits more inspections than it creates (one per run, pl-regression-3).
    // When no run inspection is left, Self Assign one of the older unassigned inspections of the project instead.
    const olderFreeRow = () => fdiRows().filter({ hasText: /Auditor Not Yet Assigned/i }).filter({ has: page.getByRole('button', { name: 'Self Assign' }) });
    const selfAssign = async pick => {
      await pick.row.getByRole('button', { name: 'Self Assign' }).click();
      await k.toast('You have been assigned as the auditor for this inspection');
    };
    const newForm = async () => {
      await openList();
      await fdiRows().first().waitFor({ timeout: 30000 }).catch(() => null);
      const pickFrom = async (rows, runOnly = true) => {
        for (let i = 0, n = await rows.count(); i < n; i++) {
          // the Material cell (2nd column) shows the material and, on a second line, its question set (since 24 Nov): keep line 1 only
          const cells = await rows.nth(i).getByRole('cell').allInnerTexts();
          const material = ((runOnly ? cells.find(c => /Auto Fdi|Pld|Pl[tr]/i.test(c)) : cells[1]) || '').split(/\n/)[0].trim();
          if (material && !state.used.includes(material)) return { row: rows.nth(i), material };
        }
        return null;
      };
      let pick = await pickFrom(freeRow());
      if (pick && await pick.row.getByRole('button', { name: 'Self Assign' }).isVisible().catch(() => false)) await selfAssign(pick);
      else if ((pick = await pickFrom(mineRow()))) { /* run inspection already assigned to this account */ }
      else {
        pick = await pickFrom(olderFreeRow(), false);
        expect(pick, 'a run inspection, or an older unassigned inspection that offers Self Assign').toBeTruthy();
        s_log(`no run inspection left – older inspection ${pick.material} self-assigned`);
        await selfAssign(pick);
      }
      state.used.push(pick.material);
      await openForm(pick.material);
      return pick.material;
    };
    const s_log = text => console.log(`      note: ${text}`);
    const openForm = async material => {
      await openList();
      // After "Save Progress" the row action can read differently from "Fill Inspection Report" – accept any form-opening action.
      const action = page.getByRole('button', { name: /Fill Inspection Report|Continue|Resume|Edit (Inspection|Report)/i });
      const row = fdiRows().filter({ hasText: material }).filter({ has: action }).first();
      await expect(row, `inspection row for ${material} with a form action`).toBeVisible({ timeout: 30000 });
      s_log(`Row actions for ${material}: ${(await row.getByRole('button').allInnerTexts()).join(' / ')}`);
      await row.getByRole('button', { name: /Fill Inspection Report|Continue|Resume|Edit (Inspection|Report)/i }).first().click();
      await expect(page).toHaveURL(/\/form/, { timeout: 30000 });
      await page.getByRole('button', { name: 'Submit Inspection' }).waitFor({ timeout: 30000 }); await k.settle(1500);
    };
    const formText = async () => (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    const answerAllPass = async () => {
      const pass = page.getByRole('button', { name: /^pass$/i }).or(page.getByRole('radio', { name: /^pass$/i }));
      for (let i = 0, n = await pass.count(); i < n; i++) await pass.nth(i).click();
      const texts = page.locator('main textarea:visible, main input[type="text"]:visible');
      for (let i = 0, n = await texts.count(); i < n; i++) if (!(await texts.nth(i).inputValue())) await texts.nth(i).fill(`${RUN} answer`);
      // Since 24 Nov 2026 the form ends with a required "Inspection outcome": "Does the product match the approved
      // submittal? *" and "Inspection status *" (Accepted / Rejected / Pending Review) – without them Submit is refused.
      const outcome = page.locator('main').getByText('Inspection outcome', { exact: true }).locator('xpath=..');
      const pickIn = async (label, wanted) => {
        const sel = outcome.locator('select').filter({ has: page.locator('option', { hasText: wanted }) }).first();
        if (!(await sel.count())) return;
        const opt = (await sel.locator('option').allInnerTexts()).find(o => wanted.test(o.trim()));
        if (opt) await sel.selectOption({ label: opt.trim() });
      };
      if (await outcome.isVisible().catch(() => false)) {
        await pickIn('match', /^Yes\b/i);
        await pickIn('status', /^Accepted$/i);
      }
    };
    const addPhoto = async files => {
      const ch = page.waitForEvent('filechooser', { timeout: 15000 });
      await page.getByRole('button', { name: /Add photo/i }).first().click();
      await (await ch).setFiles(files); await k.settle(2000);
    };
    const photoSection = () => page.getByRole('button', { name: /Add photo/i }).first().isVisible().catch(() => false);
    const notesField = () => page.getByText(/Overall Notes|Observation\s*\/\s*Notes/i).first().isVisible().catch(() => false);
    // The outcome can be empty again after "Save Progress", a photo upload or a reopen: fill it right before every submit.
    const fillOutcome = async () => {
      const outcome = page.locator('main').getByText('Inspection outcome', { exact: true }).locator('xpath=..');
      if (!(await outcome.isVisible().catch(() => false))) return;
      for (const wanted of [/^Yes\b/i, /^Accepted$/i]) {
        const sel = outcome.locator('select').filter({ has: page.locator('option', { hasText: wanted }) }).first();
        if (!(await sel.count())) continue;
        const opt = (await sel.locator('option').allInnerTexts()).find(o => wanted.test(o.trim()));
        if (opt) await sel.selectOption({ label: opt.trim() });
      }
    };
    const submit = async () => { await fillOutcome(); await page.getByRole('button', { name: 'Submit Inspection' }).click(); await k.settle(2500); };
    const submitted = () => page.getByText('Inspection Detail').first().isVisible({ timeout: 30000 }).catch(() => false);

    const login = await run.scenario({ ...meta('FDS-SETUP', 'Sign in and record the FDI Settings', 'Setup'), always: true }, async s => {
      await k.signIn(s, config);
      await s.step('Project Management › First Delivery Inspection Config → record the four FDI Settings (restored at the end)', async () => {
        await openConfig(); state.initial = await readSettings();
        s.observe(describe(state.initial));
      }, { critical: true });
    });
    if (login.status !== 'Passed') { run.abort('Sign-in failed'); return; }

    try {
      await run.scenario(meta('PM-REG-FDI-05a', '"Need Overall Notes" shows / hides the notes field'), async s => {
        await s.step(`FDI Settings: ${NOTES} Yes, Save → a new inspection form has an Overall Notes / Observation-Notes field`, async () => {
          await applySettings({ [NOTES]: true });
          state.viewForm = await newForm();
          const shown = await notesField(); s.observe(`notes field ${shown ? 'shown' : 'not shown'} · ${(await formText()).slice(-300)}`);
          expect(shown, 'notes field shown').toBe(true);
        }, { critical: true });
        await s.step(`${NOTES} No, Save → reopen the same form → no notes field`, async () => {
          await applySettings({ [NOTES]: false });
          await openForm(state.viewForm);
          expect(await notesField(), 'notes field hidden').toBe(false);
        });
      });
      await run.scenario(meta('PM-REG-FDI-05g', 'Uploads off hides the Photos section'), async s => {
        await s.step(`${UPLOADS} No (mandatory No), Save → reopen the form → no "Add photo"`, async () => {
          await applySettings({ [UPLOADS]: false });
          await openForm(state.viewForm);
          expect(await photoSection(), 'Photos section hidden').toBe(false);
        });
      });
      // Run submittals have a Spec Section No without linked documents (seen 22 Nov 2026), which is case 05l.
      await run.scenario(meta('PM-REG-FDI-05l', 'Spec link on, Spec Section No without documents → clear "no documents" state'), async s => {
        await s.step(`${SPEC} Yes, Save → form of a run inspection shows "No documents linked for this Spec Section No." and no error`, async () => {
          await applySettings({ [SPEC]: true });
          await openForm(state.viewForm);
          const text = await formText(); s.observe(text.slice(-300));
          expect(text).toContain('No documents linked for this Spec Section No.');
          expect(text).not.toMatch(/something went wrong|error occurred/i);
        });
        await s.step(`${SPEC} No, Save → reopen the form → no "Submittal Spec Documents" section`, async () => {
          await applySettings({ [SPEC]: false });
          await openForm(state.viewForm);
          expect(await formText()).not.toContain('Submittal Spec Documents');
        });
      });
      await run.scenario(meta('PM-REG-FDI-05h', 'Upload accepts jpg, png, pdf, xlsx, csv'), async s => {
        await s.step(`${UPLOADS} Yes, Save → in the form add one file each: .jpg, .png, .pdf, .xlsx, .csv → every file listed`, async () => {
          await applySettings({ [UPLOADS]: true, [MANDATORY]: false });
          await openForm(state.viewForm);
          const names = ['jpg', 'png', 'pdf', 'xlsx', 'csv'].map(ext => `${RUN}-file.${ext}`);
          const files = names.map(n => file(n, n.endsWith('png') || n.endsWith('jpg') ? PNG : n.endsWith('csv') ? 'a,b\n1,2\n' : 'x'));
          const rejected = [];
          for (const f of files) { await addPhoto(f).catch(() => null); const msg = (await page.getByRole('status').allInnerTexts()).join(' '); if (/not (allowed|supported)|invalid/i.test(msg)) rejected.push(`${path.basename(f)}: ${msg.slice(0, 80)}`); }
          const text = await formText();
          const listed = names.filter(n => text.includes(n));
          const images = await page.locator('main img').count();
          s.observe(`listed by name: ${listed.join(', ') || 'none'}; images on the form: ${images}; rejected: ${rejected.join(' | ') || 'none'}`);
          expect(rejected, 'all five types accepted').toEqual([]);
          // Each attachment must appear on the form: images as thumbnails, other files by name.
          expect(images + listed.filter(n => !/\.(png|jpg)$/.test(n)).length, 'jpg, png, pdf, xlsx and csv all listed on the form').toBeGreaterThanOrEqual(5);
        });
      });
      await run.scenario(meta('PM-REG-FDI-05b', 'Uploads on, photos not mandatory → submit without a photo'), async s => {
        await s.step(`${UPLOADS} Yes, ${MANDATORY} No → new form: Photos section present; answer every question, no photo, "Submit Inspection" → submitted, no photo message`, async () => {
          await applySettings({ [UPLOADS]: true, [MANDATORY]: false });
          await newForm();
          expect(await photoSection(), 'Photos section present').toBe(true);
          await answerAllPass(); await submit();
          const photoMsg = await page.getByText('At least one photo is required before submitting this inspection.').first().isVisible().catch(() => false);
          expect(photoMsg, 'no photo validation').toBe(false);
          expect(await submitted(), 'Inspection Detail shown').toBe(true);
        });
      });
      await run.scenario(meta('PM-REG-FDI-05c', 'Photos mandatory: save allowed, submit needs a photo'), async s => {
        await s.step(`${UPLOADS} Yes, ${MANDATORY} Yes → new form, answer every question without a photo → "Save Progress" succeeds; "Submit Inspection" → photo message, not submitted`, async () => {
          await applySettings({ [UPLOADS]: true, [MANDATORY]: true });
          state.photoForm = await newForm();
          // Assigned run inspections are reused across runs: one can already hold photos from an earlier "Save Progress",
          // which makes the mandatory-photo check meaningless (26 Nov: Auto Fdi 2611221134 had 4). Take a form without photos.
          const photos = () => page.locator('main img').filter({ hasNot: page.locator('[alt*="logo" i]') }).count();
          for (let i = 0; i < 4 && await photos() > 0; i++) {
            s.observe(`${state.photoForm} already holds ${await photos()} saved photo(s) – next run inspection`);
            state.photoForm = await newForm();
          }
          expect(await photos(), 'a form without saved photos').toBe(0);
          await answerAllPass();
          await page.getByRole('button', { name: 'Save Progress' }).click(); await k.settle(2000);
          s.observe(`after Save Progress: ${(await page.getByRole('status').allInnerTexts()).join(' | ') || '(no message)'}`);
          await submit();
          await expect(page.getByText('At least one photo is required before submitting this inspection.').first()).toBeVisible();
          expect(await submitted()).toBe(false);
        }, { critical: true });
        await s.step('Add two photos, "Save Progress", reopen the form in edit mode → both thumbnails shown (PM-REG-FDI-05i, edit mode)', async () => {
          await addPhoto(file(`${RUN}-a.png`, PNG)); await addPhoto(file(`${RUN}-b.png`, PNG)); // the picker takes one file at a time
          await page.getByRole('button', { name: 'Save Progress' }).click(); await k.settle(2000);
          await openForm(state.photoForm);
          state.thumbsEdit = await page.locator('main img').filter({ hasNot: page.locator('[alt*="logo" i]') }).count();
          s.observe(`images in edit mode: ${state.thumbsEdit}`);
          expect(state.thumbsEdit).toBeGreaterThanOrEqual(2);
        });
        await s.step('"Submit Inspection" → submitted (Inspection Detail)', async () => { await submit(); expect(await submitted()).toBe(true); });
      });
      await run.scenario(meta('PM-REG-FDI-05i', 'Photo thumbnails in edit and view mode'), async s => {
        await s.step('Submitted report of PM-REG-FDI-05c (Inspection Detail) → the photo thumbnails are shown in view mode; edit mode had them too', async () => {
          if (!(await submitted())) throw new Error('PM-REG-FDI-05c did not submit the report');
          const view = await page.locator('main img').count();
          s.observe(`edit mode ${state.thumbsEdit}, view mode ${view} images`);
          expect(state.thumbsEdit || 0).toBeGreaterThanOrEqual(2);
          expect(view).toBeGreaterThanOrEqual(2);
        });
      });
      await run.scenario(meta('PM-REG-FDI-05j', 'Photo popup with Next / Previous'), async s => {
        await s.step('Inspection Detail: click the first photo thumbnail → full-size popup; Next / Previous move between the photos without closing', async () => {
          await page.locator('main img').last().click(); await k.settle(1000);
          const next = page.getByRole('button', { name: /next|›|→/i }).last();
          const prev = page.getByRole('button', { name: /prev|‹|←/i }).last();
          const popup = await page.locator('[role="dialog"], .fixed.inset-0').filter({ visible: true }).count();
          s.observe(`popup layers ${popup}; next ${await next.isVisible().catch(() => false)}; previous ${await prev.isVisible().catch(() => false)}`);
          expect(popup, 'popup open').toBeGreaterThan(0);
          await next.click(); await k.settle(500); await prev.click(); await k.settle(500);
          expect(await page.locator('[role="dialog"], .fixed.inset-0').filter({ visible: true }).count(), 'popup still open').toBeGreaterThan(0);
          await page.keyboard.press('Escape');
        });
      });
      await run.scenario(meta('PM-REG-FDI-05n', 'A submitted report keeps the settings it was made with'), async s => {
        await s.step(`${NOTES} Yes, uploads Yes, mandatory No → new form: fill the notes field with "${RUN} notes", answer all, submit → Inspection Detail shows "${RUN} notes"`, async () => {
          await applySettings({ [NOTES]: true, [UPLOADS]: true, [MANDATORY]: false });
          state.notesForm = await newForm();
          await answerAllPass();
          const notes = page.getByText(/Overall Notes|Observation\s*\/\s*Notes/i).first().locator('xpath=following::textarea[1]');
          await notes.fill(`${RUN} notes`);
          await submit();
          expect(await submitted()).toBe(true);
          await expect(page.getByText(`${RUN} notes`).first()).toBeVisible();
          state.reportUrl = page.url();
        }, { critical: true });
        await s.step(`${NOTES} No, Save → the submitted report still shows "${RUN} notes"; a new form has no notes field`, async () => {
          await applySettings({ [NOTES]: false });
          await page.goto(state.reportUrl, { waitUntil: 'domcontentloaded' }); await k.settle(3000);
          await expect(page.getByText(`${RUN} notes`).first(), 'submitted report unchanged').toBeVisible({ timeout: 20000 });
          await openForm(state.viewForm);
          expect(await notesField(), 'new form follows the new setting').toBe(false);
        });
      });
    } finally {
      await run.scenario({ ...meta('FDS-RESTORE', 'Restore the four FDI Settings', 'Setup'), always: true }, async s => {
        await s.step('FDI Settings back to the values recorded at the start, Save, reload → equal', async () => {
          if (!state.initial) return;
          const now = await applySettings(state.initial);
          s.observe(`${describe(now)} · run inspections self-assigned: ${state.used.join(', ')}`);
        });
      });
    }
    for (const [id, title, reason] of [
      ['PM-REG-FDI-05d', 'Spec documents shown as thumbnails', 'Needs a run delivery whose submittal has a Spec Section No with linked documents (test data to prepare in Document Management)'],
      ['PM-REG-FDI-05k', 'Spec document opens in a viewer', 'Same data need as PM-REG-FDI-05d'],
      ['PM-REG-FDI-05m', 'Empty Spec Section No → exact message', 'Needs a delivery whose submittal has an EMPTY Spec Section No (run submittals have one)'],
      ['PM-REG-FDI-05e', 'New question appears on the form', 'Needs the question set that covers the run material to be identified and a question added to it (shared FDI question sets) – next step'],
      ['PM-REG-FDI-05f', 'Deleted / other-category question not shown', 'Depends on PM-REG-FDI-05e']
    ]) run.skip(meta(id, title), reason);
  } });
});
