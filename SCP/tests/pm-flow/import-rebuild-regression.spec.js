// =====================================================================================================================
// Excel Import + Inventory Rebuild + Messages regression (27 Nov 2026) – new pages of the 24 Nov redesign.
// User decision (26 Nov): Excel Import and Inventory Rebuild run ONLY on NeuralRays_Demo (the runner sets the project).
// Excel Import: one fixed row key "XI-AUTO-1 / White_Cement" is imported every run – the page says "Re-uploading updates
// the rows it finds instead of adding duplicates", so each run updates that one record (one-record rule) and the second
// upload in the run proves the update rule. Inventory Rebuild: one dry run per run (a history entry); Rebuild only if
// the dry run finds differences (never on NRVC_Hall). Messages: read-only (Delivery Management not connected).
// Run: node scripts/run-pm-flow.js import-rebuild --headless   (SCP_PROJECT_NAME=NeuralRays_Demo, SCP_PL_SITE=Location 1)
// =====================================================================================================================
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runPmSuite } = require('./support/pm-flow');
const { plKit } = require('./support/pl-flow');

const SUITE = 'Import and Rebuild Regression';
const meta = (id, module, title, kind = 'Positive') => ({ id, module, submodule: 'Regression', suite: SUITE, title: `[${kind}] ${title}`, kind, navPath: [module] });
const d = new Date(Date.now() + 5.5 * 3600e3);
const QTY1 = 10 + d.getUTCMinutes(), QTY2 = QTY1 + 1; // first upload, then the update
const KEY = { sub: 'XI-AUTO-1', mat: 'White_Cement' };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xi-'));
const csv = (name, rows, head = 'Submittal No,Material Name,Quantity,ROJ') => { const f = path.join(tmp, name); fs.writeFileSync(f, head + '\n' + rows.map(r => r.map(v => /[,"]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v).join(',')).join('\n') + '\n'); return f; };
const TAG = `XI ${d.toISOString().slice(2, 10).replace(/-/g, '')}-${d.toISOString().slice(11, 16).replace(':', '')}`;

test.describe.configure({ mode: 'serial' });
test.setTimeout(45 * 60 * 1000);

test('Import, Rebuild and Messages – regression', async ({ page, browserName }) => {
  await runPmSuite({ page, browserName, suite: SUITE, scenarios: async ({ run, config }) => {
    const k = plKit(page);
    const { main } = k;
    const clean = t => String(t || '').replace(/\s+/g, ' ').trim();
    const go = async (route, wait = 5000) => { await page.goto(route, { waitUntil: 'domcontentloaded' }); await k.settle(wait); };
    const R = {};

    const login = await run.scenario({ ...meta('XI-00', 'Excel Import', `Sign in to ${config.projectName}`, 'Setup'), always: true }, async s => {
      await k.signIn(s, config);
      await s.step('Project is NeuralRays_Demo (Excel Import and Inventory Rebuild never run on NRVC_Hall)', async () => expect(config.projectName).toBe('NeuralRays_Demo'), { critical: true });
    });
    if (login.status !== 'Passed') { run.abort('Sign-in failed or wrong project'); return; }

    const upload = async (s, file, rows) => {
      await go('/excel-import');
      await page.locator('input[type="file"]').first().setInputFiles(file); await k.settle(4000);
      await expect(main.getByText(new RegExp(`${rows} rows? read`)).first()).toBeVisible({ timeout: 20000 });
    };
    const previewAndImport = async s => {
      await main.getByRole('button', { name: 'Preview' }).click(); await k.settle(4000);
      const text = clean(await main.innerText());
      s.observe(`preview: ${text.slice(text.indexOf('Preview'), text.indexOf('Preview') + 400)}`);
      const go2 = main.getByRole('button', { name: /^(Import|Apply|Confirm|Save)/ }).first();
      await expect(go2, 'an Import / Apply button after Preview').toBeVisible({ timeout: 20000 });
      R.importLabel = clean(await go2.innerText());
      await go2.click(); await k.settle(5000);
      const done = clean(await main.innerText());
      s.observe(`after ${R.importLabel}: ${done.slice(0, 400)}`);
      return done;
    };

    await run.scenario(meta('XI-REG-01', 'Excel Import', 'Upload: columns matched by name, required fields marked, row preview', 'Positive'), async s => {
      await s.step(`Excel Import › choose a CSV (Submittal No, Material Name, Quantity, ROJ; 1 row ${KEY.sub}) → "1 rows read. Columns were matched by name"; Submittal number*, Material / product*, Required quantity* mapped`, async () => {
        await upload(s, csv('xi-1.csv', [[KEY.sub, KEY.mat, QTY1, '15/12/2026']]), 1);
        for (const [field, col] of [['Submittal number *', 'Submittal No'], ['Material / product *', 'Material Name'], ['Required quantity *', 'Quantity'], ['ROJ date', 'ROJ']]) {
          const sel = main.getByRole('combobox', { name: field });
          const v = clean(await sel.locator('option:checked').innerText()); s.observe(`${field} ← ${v}`);
          expect(v).toBe(col);
        }
        await expect(main.getByText('Re-uploading updates the rows it finds instead of adding duplicates.').first()).toBeVisible();
        await expect(main.getByRole('checkbox', { name: 'Submittal number' })).toBeDisabled();
        await expect(main.getByRole('checkbox', { name: 'Material / product' })).toBeChecked();
      }, { critical: true });
    });

    await run.scenario(meta('XI-REG-02', 'Excel Import', 'Required mapping missing → no Preview', 'Negative'), async s => {
      await s.step('Set "Required quantity *" to "—" → Preview disabled or refused with a message; set it back', async () => {
        const sel = main.getByRole('combobox', { name: 'Required quantity *' });
        await sel.selectOption({ label: '—' }); await k.settle(800);
        const btn = main.getByRole('button', { name: 'Preview' });
        const enabled = await btn.isEnabled();
        let msg = '';
        if (enabled) { await btn.click(); await k.settle(2500); msg = clean(await main.innerText()).match(/[^.]*(required|map|choose)[^.]*\./i)?.[0] || ''; }
        s.observe(`Preview ${enabled ? 'enabled' : 'disabled'}${msg ? ` · ${msg}` : ''}`);
        expect(!enabled || !!msg, 'Preview without a required column is neither blocked nor explained').toBe(true);
        await go('/excel-import');
      });
    });

    // 27 Nov: on a Procore-connected project the import only ADDS DETAIL to existing Procore submittals ("Submittal X is not
    // in Procore. The import adds detail to Procore submittals and does not create them."). The run therefore takes an
    // existing submittal + material + its quantity from Submittal Invoiced Orders and imports the same quantity with
    // "Model / part no." = the run tag – one existing record updated per run, nothing created.
    const target = await run.scenario(meta('XI-REG-03', 'Excel Import', 'A row for a submittal that is not in Procore is rejected, nothing created', 'Negative'), async s => {
      await s.step(`Upload ${KEY.sub} (not a Procore submittal) › Preview → "0 to create · 0 to update · 1 rejected" and "Submittal ${KEY.sub} is not in Procore"`, async () => {
        await upload(s, csv('xi-1.csv', [[KEY.sub, KEY.mat, QTY1, '15/12/2026']]), 1);
        await main.getByRole('button', { name: 'Preview' }).click(); await k.settle(4000);
        const text = clean(await main.innerText()); s.observe(text.slice(text.indexOf('Preview —'), text.indexOf('Preview —') + 260));
        expect(text).toMatch(/0 to create · 0 to update · 1 rejected/);
        expect(text).toContain(`Submittal ${KEY.sub} is not in Procore`);
        await go('/excel-import');
      });
      await s.step('Submittal Invoiced Orders (default date range) → pick an existing submittal + material with a component quantity', async () => {
        await go('/submittal-invoiced-orders', 8000);
        const rows = await main.locator('table').first().locator('tbody tr').evaluateAll(rs => rs.map(r => [...r.cells].map(c => c.innerText.trim())));
        const pick = rows.find(c => c.length >= 10 && Number(String(c[2]).replace(/[^\d.]/g, '')) > 0 && c[0] && c[1]);
        expect(pick, 'an existing submittal with a component quantity').toBeTruthy();
        R.t = { sub: pick[0], mat: pick[1], qty: Number(String(pick[2]).replace(/[^\d.]/g, '')) };
        s.observe(JSON.stringify(R.t));
      }, { critical: true });
    });
    const importTarget = async (s, file) => {
      await upload(s, file, 1);
      const model = main.getByRole('combobox', { name: 'Model / part no.' });
      if (clean(await model.locator('option:checked').innerText()) !== 'Model') await model.selectOption({ label: 'Model' });
      await main.getByRole('button', { name: 'Preview' }).click(); await k.settle(4000);
      const pv = clean(await main.innerText()); const summary = (pv.match(/\d+ to create · \d+ to update · \d+ rejected/) || [])[0];
      s.observe(`preview: ${summary} · ${pv.slice(pv.indexOf('Rows that need attention'), pv.indexOf('Rows that need attention') + 200)}`);
      return summary;
    };
    await run.scenario(meta('XI-REG-04', 'Excel Import', 'Import adds detail to an existing Procore submittal (update, never create)', 'Positive'), async s => {
      if (!R.t) throw new Error('No target row (XI-REG-03)');
      await s.step(`Upload Submittal No / Material Name / Quantity / Model = ${'{'}target{'}'}, same quantity, Model "${TAG}" › Preview → "0 to create · 1 to update · 0 rejected" › Import → "0 created, 1 updated"`, async () => {
        const summary = await importTarget(s, csv('xi-t.csv', [[R.t.sub, R.t.mat, R.t.qty, TAG]], 'Submittal No,Material Name,Quantity,Model'));
        expect(summary).toBe('0 to create · 1 to update · 0 rejected');
        const go2 = main.getByRole('button', { name: /^Import/ }).first(); await go2.click(); await k.settle(5000);
        const done = clean(await main.innerText()); s.observe(done.match(/\d+ created, \d+ updated[^.]*\./)?.[0] || done.slice(0, 200));
        expect(done).toMatch(/0 created, 1 updated/);
      }, { critical: true });
      await s.step('Upload the same row again › Preview → still "0 to create · 1 to update" (re-uploading updates the row it finds, no duplicate)', async () => {
        const summary = await importTarget(s, csv('xi-t2.csv', [[R.t.sub, R.t.mat, R.t.qty, TAG]], 'Submittal No,Material Name,Quantity,Model'));
        expect(summary).toBe('0 to create · 1 to update · 0 rejected');
        await go('/excel-import'); // second upload is not imported
      });
      await s.step('Bulk Upload Status (Project Management › Imports) lists the import of this run', async () => {
        await go('/bulk-upload-status', 6000);
        const first = clean(await main.locator('tbody tr').first().innerText()); s.observe(first.slice(0, 200));
        expect(first, 'Question to the dev team: Excel Import runs are not listed in Bulk Upload Status – should they be?').toMatch(/xi-t\.csv|Excel/i);
      });
    });

    await run.scenario(meta('XI-REG-05', 'Excel Import', 'Bad values are reported per row', 'Negative'), async s => {
      await s.step(`Upload 1 row with quantity "abc" and ROJ "31/02/2026" › Preview → the row is flagged (invalid quantity / date) and is not imported`, async () => {
        await upload(s, csv('xi-bad.csv', [['XI-AUTO-BAD', KEY.mat, 'abc', '31/02/2026']]), 1);
        await main.getByRole('button', { name: 'Preview' }).click(); await k.settle(4000);
        const text = clean(await main.innerText());
        const flagged = /invalid|not a number|error|skip|cannot|must/i.test(text);
        s.observe(text.slice(text.indexOf('Preview'), text.indexOf('Preview') + 400));
        expect(flagged, 'invalid quantity / date flagged in the preview').toBe(true);
        await go('/excel-import'); // leave without importing
      });
    });

    // Gap 5 of the dev review "SCP Business Logic and Flow Changes" (27 Nov 2026): the import writes required quantity, unit,
    // ROJ, PO and lead time without the component edit validation. Each invalid value is uploaded alone for the EXISTING
    // Procore submittal + material found by XI-REG-03 and only previewed – nothing is imported (Preview only, then leave).
    await run.scenario(meta('XI-GAP-05', 'Excel Import', 'Invalid quantity, unit, ROJ and lead time are rejected for an existing submittal (dev review gap 5)', 'Negative'), async s => {
      if (!R.t) throw new Error('No target row (XI-REG-03)');
      const cases = [
        ['Quantity -5', 'Submittal No,Material Name,Quantity', [R.t.sub, R.t.mat, -5]],
        ['Quantity 0', 'Submittal No,Material Name,Quantity', [R.t.sub, R.t.mat, 0]],
        ['Unit "ZZZ" (not a unit of the project)', 'Submittal No,Material Name,Quantity,Unit', [R.t.sub, R.t.mat, R.t.qty, 'ZZZ']],
        ['ROJ "31/02/2026" (no such date)', 'Submittal No,Material Name,Quantity,ROJ', [R.t.sub, R.t.mat, R.t.qty, '31/02/2026']],
        ['Lead time -2 weeks', 'Submittal No,Material Name,Quantity,Lead Time', [R.t.sub, R.t.mat, R.t.qty, -2]],
      ];
      for (const [label, head, row] of cases) {
        await s.step(`Upload ${R.t.sub} / ${R.t.mat} with ${label} › Preview → the row is rejected or flagged ("1 rejected" or a message in "Rows that need attention"), not "1 to update"; leave without importing`, async () => {
          await upload(s, csv(`xi-gap-${cases.findIndex(c => c[0] === label)}.csv`, [row], head), 1);
          await main.getByRole('button', { name: 'Preview' }).click(); await k.settle(4000);
          const pv = clean(await main.innerText());
          const summary = (pv.match(/\d+ to create · \d+ to update · \d+ rejected/) || [])[0] || '(no summary)';
          const attention = pv.includes('Rows that need attention') ? pv.slice(pv.indexOf('Rows that need attention'), pv.indexOf('Rows that need attention') + 220) : '';
          s.observe(`${label}: ${summary}${attention ? ` · ${attention}` : ''}`);
          await go('/excel-import'); // never imported
          expect(/1 rejected/.test(summary) || /invalid|must|negative|not a valid|unknown|greater than/i.test(attention),
            `${label} would be imported without validation ("${summary}") – dev review gap 5`).toBe(true);
        });
      }
    });

    // ================================================= Inventory Rebuild =================================================
    await run.scenario(meta('IR-REG-01', 'Inventory Rebuild', 'Page shows the last nightly run, dry-run results and history', 'Positive'), async s => {
      await s.step('Project Management › Inventory Settings › Inventory Rebuild → description, Run Dry Run, Rebuild, "Last nightly run" with date and status, History columns Date, Run by, Kind, Outcome, Reason, Total difference', async () => {
        await go('/inventory-rebuild', 6000);
        const text = clean(await main.innerText()); s.observe(text.slice(0, 300));
        await expect(main.getByRole('button', { name: 'Run Dry Run' })).toBeVisible();
        await expect(main.getByRole('button', { name: 'Rebuild' })).toBeVisible();
        expect(text).toMatch(/Last nightly run Date: \S+ Status: \w+/);
        const heads = (await main.getByRole('columnheader').allInnerTexts()).map(clean);
        for (const h of ['Date', 'Run by', 'Kind', 'Outcome', 'Reason', 'Total difference']) expect(heads).toContain(h);
        R.history = await main.locator('table').last().locator('tbody tr').count();
      });
      await s.step('Dates use the app\'s DD/MM/YYYY format (the rest of the app shows 27/11/2026)', async () => {
        const date = (clean(await main.innerText()).match(/Last nightly run Date: (\S+)/) || [])[1];
        s.observe(`last nightly run date "${date}"`);
        const [a, b] = date.split('/').map(Number);
        expect(a > 12 || b <= 12, `"${date}" is MM/DD/YYYY – the rest of the app uses DD/MM/YYYY`).toBe(true);
        expect(!(a <= 12 && b > 12), `"${date}" is MM/DD/YYYY – the rest of the app uses DD/MM/YYYY`).toBe(true);
      });
    });

    await run.scenario(meta('IR-REG-02', 'Inventory Rebuild', 'Run Dry Run → new result and history entry', 'Positive'), async s => {
      await s.step('Run Dry Run → "Dry run results (<now>, by <user>)" with "Balances are correct" or a difference table; History gains a "Dry run" row; Download CSV works', async () => {
        await main.getByRole('button', { name: 'Run Dry Run' }).click();
        const confirm = page.getByRole('dialog').getByRole('button', { name: /run|confirm|yes/i });
        if (await confirm.count()) await confirm.first().click();
        await expect.poll(async () => main.locator('table').last().locator('tbody tr').count(), { timeout: 120000, message: 'History gains a row' }).toBeGreaterThan(R.history);
        const text = clean(await main.innerText()); s.observe(text.slice(text.indexOf('Dry run results'), text.indexOf('Dry run results') + 200));
        expect(text).toMatch(/Dry run results \(/);
        R.differs = !/Balances are correct/.test(text);
        const first = clean(await main.locator('table').last().locator('tbody tr').first().innerText()); s.observe(`history: ${first}`);
        expect(first).toMatch(/Dry run/);
        R.differs = !/Balances are correct/.test(text);
        const dl = page.waitForEvent('download', { timeout: 30000 });
        await main.getByRole('button', { name: 'Download CSV' }).click();
        s.observe(`download ${(await dl).suggestedFilename()}`);
      });
      await s.step('Rebuild is enabled only when the fresh dry run found differences', async () => {
        const enabled = await main.getByRole('button', { name: 'Rebuild' }).isEnabled();
        s.observe(`differences ${R.differs}; Rebuild ${enabled ? 'enabled' : 'disabled'}`);
        expect(enabled).toBe(!!R.differs);
      });
    });

    // ===================================================== Messages =====================================================
    await run.scenario(meta('MS-REG-02', 'Messages', 'Not connected: notice and Check again', 'Negative'), async s => {
      await s.step('Messages → "Delivery Management isn\'t connected" with how to connect (Booking Integration); "Check again" → notice stays, no error', async () => {
        await go('/messages', 4000);
        await expect(main.getByRole('heading', { name: "Delivery Management isn't connected" })).toBeVisible();
        await expect(main.getByText(/Booking Integration/).first()).toBeVisible();
        await main.getByRole('button', { name: 'Check again' }).click(); await k.settle(3000);
        await expect(main.getByRole('heading', { name: "Delivery Management isn't connected" })).toBeVisible();
        await expect(main.getByText(/something went wrong/i).first()).toBeHidden();
      });
    });
    await run.scenario(meta('MS-REG-03', 'Messages', 'Email or text suppliers, subcontractors and people', 'Positive'), async s => {
      await s.step('Messages → compose and send a message to a project supplier → listed as sent', async () => {
        const blocked = await main.getByRole('heading', { name: "Delivery Management isn't connected" }).isVisible().catch(() => false);
        s.observe(blocked ? 'Delivery Management not connected on staging' : 'connected');
        expect(blocked, 'Question to the dev / platform team: Messages needs Booking Integration connected on staging (a platform admin task)').toBe(false);
      });
    });
  } });
});
