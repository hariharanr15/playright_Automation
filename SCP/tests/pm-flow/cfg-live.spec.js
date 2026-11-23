// Configuration Options effects on NRVC_Hall (approved by the user, 22 Nov 2026) – PM-REG-CFG-09, CFG-10, CFG-13/15/16.
//   CFG-09: Pre-Shipping Checklist off → the delivery checklist ("Pre Shipping Info") is no longer available in a delivery
//           that awaits it; switched on again → available again in the same delivery.
//   CFG-10: same rule for GRN ("Generate GRN" on a delivery at the GRN step).
//   CFG-13/15/16: the alert-week thresholds (1 week on NRVC_Hall) raise alerts in the 05:00–06:00 IST batch. Each run SEEDS
//           run submittals (Date Required on Site = today + 6 days: one not ordered, one ordered with an unconfirmed lead
//           time; control: today + 21 days) and writes them to reports/cfg-alert-seed.json; the NEXT run (a later day, after
//           the batch) VERIFIES the Management Dashboard alerts for the seeds of the earlier day.
// Toggles are always switched back to their original state (finally).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { runPmSuite } = require('./support/pm-flow');
const { plKit, poToday, MATERIAL } = require('./support/pl-flow');

const SUITE = 'Configuration Options live effects';
const MODULE = 'Project Management';
const SUB = 'Configuration Options';
const stamp = new Date();
const RUN = `CFL${stamp.toISOString().replace(/\D/g, '').slice(2, 12)}`;
const num = n => `${stamp.toISOString().replace(/\D/g, '').slice(0, 12)}${String(n).padStart(2, '0')}`;
const today = new Date(stamp.getFullYear(), stamp.getMonth(), stamp.getDate());
const plusDays = d => new Date(today.getFullYear(), today.getMonth(), today.getDate() + d);
const gb = d => d.toLocaleDateString('en-GB');
const SEED_FILE = path.join(__dirname, '..', '..', 'reports', 'cfg-alert-seed.json');
const esc = v => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const meta = (id, title, kind = 'Integration') => ({ id, module: MODULE, submodule: SUB, suite: SUITE, title, kind, navPath: [MODULE, SUB] });

test.describe.configure({ mode: 'serial' });
test.setTimeout(2 * 60 * 60 * 1000);

test('Configuration Options – live effects', async ({ page, browserName }) => {
  await runPmSuite({ page, browserName, suite: SUITE, scenarios: async ({ run, config }) => {
    const k = plKit(page);
    const { main, listbox } = k;
    const state = {};

    // ---------------- Configuration Options ----------------
    const openConfig = async () => { await page.goto('/configuration-options', { waitUntil: 'domcontentloaded' }); await k.settle(2500); await main.getByText('GRN', { exact: true }).first().waitFor({ timeout: 30000 }); };
    // Toggles are divs: track div.w-16.rounded-full; grey track (bg-switchGray) = Off.
    const toggle = label => main.locator('div.justify-between', { has: page.locator('p', { hasText: new RegExp(`^${esc(label)}`) }) }).last().locator('div.w-16.rounded-full').first();
    const isOn = async label => !/bg-switchGray/.test(await toggle(label).getAttribute('class'));
    const setToggle = async (label, on) => {
      await openConfig();
      if ((await isOn(label)) !== on) {
        await toggle(label).click();
        await main.getByRole('button', { name: 'Save', exact: true }).first().click(); await k.settle(2000);
        await openConfig();
      }
      expect(await isOn(label), `${label} ${on ? 'On' : 'Off'} after Save`).toBe(on);
    };

    // ---------------- Run data ----------------
    const fresh = async () => { await page.goto('/procurement-log', { waitUntil: 'domcontentloaded' }); await expect.poll(k.count, { timeout: 30000 }).toBeGreaterThan(0); };
    const newSubmittal = async (key, extra = {}) => {
      const d = { spec: `${RUN}-SPEC-${key}`, description: `${RUN} ${key}`, scheduleId: num(key.charCodeAt(0) - 64), number: `${RUN}-SUB-${key}`, ...extra };
      await fresh(); await k.addSubmittal(d); await k.toast('Submittal added successfully');
      await fresh(); await k.search(d.number); await k.openSubmittal(d.description);
      return d;
    };
    const icon = name => page.locator(`img[title="${name}"], img[alt="${name}"]`).filter({ visible: true });
    const reopen = async url => { await page.goto(url, { waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: '+ Log Delivery' }).last().waitFor({ timeout: 30000 }); await k.settle(2500); };

    const login = await run.scenario({ ...meta('CFL-SETUP', 'Sign in; record the Configuration Options toggles', 'Setup'), always: true }, async s => {
      await k.signIn(s, config);
      await s.step('Configuration Options → record "Pre-Shipping Checklist" and "GRN" (restored at the end)', async () => {
        await openConfig();
        state.pre = await isOn('Pre-Shipping Checklist'); state.grn = await isOn('GRN');
        s.observe(`Pre-Shipping Checklist ${state.pre ? 'On' : 'Off'}, GRN ${state.grn ? 'On' : 'Off'}`);
        expect(state.pre && state.grn, 'both toggles On to start').toBe(true);
      }, { critical: true });
    });
    if (login.status !== 'Passed') { run.abort('Set-up failed'); return; }

    try {
      // ================= CFG-09 =================
      await run.scenario(meta('PM-REG-CFG-09', 'Pre-Shipping off removes the delivery checklist; on brings it back (same delivery)'), async s => {
        await s.step(`Run submittal ${RUN}-SUB-P (${MATERIAL}): component, "+ Log Delivery" QTY 1 → the delivery offers "Pre Shipping Info"`, async () => {
          const d = await newSubmittal('P');
          await k.addComponent({ rojDate: plusDays(45), qty: 2 });
          await k.componentRow().getByRole('cell', { name: MATERIAL }).click();
          await k.keepSite(); await page.getByRole('button', { name: '+ Log Delivery' }).last().click();
          const dl = k.dialog('Add Delivery', 'Add');
          await k.day(dl.getByRole('textbox').first(), today);
          await dl.getByRole('button', { name: /^(All Locations|Choose Location)$/ }).click(); await listbox().getByRole('option').filter({ hasNotText: /^(All Locations|Choose Location)$/ }).first().click();
          await dl.getByRole('button', { name: 'Choose Item Name' }).click(); await listbox().getByRole('option', { name: MATERIAL, exact: true }).first().click();
          await dl.getByRole('spinbutton').first().fill('1');
          await dl.getByRole('button', { name: 'Add', exact: true }).click();
          await expect(page.getByRole('heading', { name: 'Add Delivery', exact: true })).toBeHidden({ timeout: 20000 });
          await expect(icon('Pre Shipping Info').last()).toBeVisible({ timeout: 15000 });
          state.preUrl = page.url(); state.preSub = d.number;
        }, { critical: true });
        await s.step('Configuration Options: "Pre-Shipping Checklist" Off, Save → reopen the same delivery → "Pre Shipping Info" no longer offered', async () => {
          await setToggle('Pre-Shipping Checklist', false);
          await reopen(state.preUrl);
          const count = await icon('Pre Shipping Info').count();
          s.observe(`"Pre Shipping Info" icons with Pre-Shipping Off: ${count}`);
          expect(count, 'checklist not available while Pre-Shipping is Off').toBe(0);
        });
        await s.step('"Pre-Shipping Checklist" On again, Save → reopen the same delivery → "Pre Shipping Info" offered again', async () => {
          await setToggle('Pre-Shipping Checklist', true);
          await reopen(state.preUrl);
          await expect(icon('Pre Shipping Info').last(), 'checklist available again').toBeVisible({ timeout: 15000 });
        });
      });

      // ================= CFG-10 =================
      await run.scenario(meta('PM-REG-CFG-10', 'GRN off removes "Generate GRN"; on brings it back (same delivery)'), async s => {
        await s.step(`Run submittal ${RUN}-SUB-G (${MATERIAL}): component with PO, delivery QTY 2 → checklist, approve, actual date, shipping, conditions → stopped at the GRN step ("Generate GRN" offered)`, async () => {
          await newSubmittal('G');
          await k.addComponent({ rojDate: plusDays(45), qty: 2, po: `${RUN}-PO-G`, poDate: poToday() });
          await k.deliverToGrn({ qty: 2, tag: RUN, stopBeforeGrn: true });
          await expect(icon('Generate GRN').last()).toBeVisible({ timeout: 15000 });
          state.grnUrl = page.url();
        }, { critical: true });
        await s.step('Configuration Options: "GRN" Off, Save → reopen the same delivery → "Generate GRN" no longer offered', async () => {
          await setToggle('GRN', false);
          await reopen(state.grnUrl);
          const count = await icon('Generate GRN').count();
          s.observe(`"Generate GRN" icons with GRN Off: ${count}`);
          expect(count, 'GRN not available while GRN is Off').toBe(0);
        });
        await s.step('"GRN" On again, Save → reopen the same delivery → "Generate GRN" offered again', async () => {
          await setToggle('GRN', true);
          await reopen(state.grnUrl);
          await expect(icon('Generate GRN').last(), 'GRN available again').toBeVisible({ timeout: 15000 });
        });
      });
    } finally {
      await run.scenario({ ...meta('CFL-RESTORE', 'Restore Pre-Shipping Checklist and GRN', 'Setup'), always: true }, async s => {
        await s.step('Configuration Options: "Pre-Shipping Checklist" and "GRN" back to their recorded state, Save → shown as recorded', async () => {
          await setToggle('Pre-Shipping Checklist', state.pre !== false);
          await setToggle('GRN', state.grn !== false);
          s.observe(`Pre-Shipping Checklist ${await isOn('Pre-Shipping Checklist') ? 'On' : 'Off'}, GRN ${await isOn('GRN') ? 'On' : 'Off'}`);
        });
      });
    }

    // ================= CFG-13/15/16: verify the earlier seed, then seed again =================
    const seed = fs.existsSync(SEED_FILE) ? JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')) : null;
    const batchDone = seed && new Date(seed.seededAt).toDateString() !== stamp.toDateString() && (stamp.getHours() > 6 || (stamp.getHours() === 6 && stamp.getMinutes() >= 0));
    if (batchDone) {
      // The Alerts tab holds 1000+ unread alerts: search for the seed (submittal number) instead of paging.
      const alertRows = async term => {
        await page.goto('/management-dashboard', { waitUntil: 'domcontentloaded' }); await k.settle(3000);
        await main.getByRole('button', { name: /^Alerts(\s+\d+\+?)?$/ }).first().click(); await k.settle(2500);
        const box = main.getByRole('textbox').filter({ hasNot: page.locator('[readonly]') }).locator('visible=true').last();
        const search = main.locator('input[type=search], input[placeholder*="earch" i]').first();
        const field = (await search.isVisible().catch(() => false)) ? search : box;
        await field.fill(term); await field.press('Enter').catch(() => {}); await k.settle(3500);
        const rows = [];
        for (let p = 1; p <= 4; p++) {
          if (p > 1) { const next = main.getByRole('button', { name: String(p), exact: true }).last(); if (!(await next.isVisible().catch(() => false))) break; await next.click(); await k.settle(1500); }
          rows.push(...(await main.locator('tbody tr').allInnerTexts()).map(t => t.replace(/\s+/g, ' ')));
        }
        return rows;
      };
      // Creation notices ("New submittal '…' was added") are not batch alerts.
      const mentions = (rows, d) => rows.filter(r => !/was added/i.test(r) && (r.includes(d.number) || r.includes(d.material || '') && r.includes(d.roj)));
      const verify = (id, title, key, expected) => run.scenario(meta(id, title), async s => {
        await s.step(`Management Dashboard › Alerts (after the ${new Date(seed.seededAt).toLocaleDateString('en-GB')} batch) → seed ${seed[key].number} (Date Required on Site ${seed[key].roj}) ${expected ? 'has an alert' : 'has no alert'}`, async () => {
          let all = await alertRows(seed[key].number); let hits = mentions(all, seed[key]);
          if (!hits.length && seed[key].material) { const more = await alertRows(seed[key].material); s.observe(`search ${seed[key].material}: ${more.length} row(s) – ${more.slice(0, 6).map(r => r.slice(0, 140)).join(' ¦ ')}`); all = all.concat(more); hits = mentions(all, seed[key]); }
          s.observe(`search ${seed[key].number}: ${all.length} row(s) – ${all.slice(0, 4).map(r => r.slice(0, 120)).join(' ¦ ') || 'none'}`);
          s.observe(hits.length ? hits[0].slice(0, 200) : `no alert mentions ${seed[key].number}`);
          expect(hits.length > 0, expected ? `No daily-batch alert for ${seed[key].number}` : `Alert outside the 1-week window for ${seed[key].number}`).toBe(expected);
        });
      });
      await verify('PM-REG-CFG-13', 'Not-ordered alert raised by the daily batch (1 week)', 'notOrdered', true);
      await verify('PM-REG-CFG-15', 'Lead-time-not-confirmed alert raised by the daily batch (1 week)', 'notConfirmed', true);
      await verify('PM-REG-CFG-16', 'No alert outside the 1-week window (Required on Site in 3 weeks)', 'control', false);
    } else {
      for (const [id, title] of [['PM-REG-CFG-13', 'Not-ordered alert raised by the daily batch (1 week)'], ['PM-REG-CFG-15', 'Lead-time-not-confirmed alert raised by the daily batch (1 week)'], ['PM-REG-CFG-16', 'No alert outside the 1-week window']])
        run.skip(meta(id, title), seed ? `Seeded on ${new Date(seed.seededAt).toLocaleString('en-GB')}; verify after the next 05:00–06:00 IST batch (run this suite again after 06:00 tomorrow)` : 'Seeded by this run; verify after the next 05:00–06:00 IST batch');
    }
    await run.scenario(meta('CFL-SEED', 'Seed submittals for the next alert batch (CFG-13/15/16)', 'Setup'), async s => {
      await s.step(`Run submittals: N (not ordered, Required on Site ${gb(plusDays(6))}), L (ordered with PO, lead time not confirmed, ${gb(plusDays(6))}), C (control, not ordered, ${gb(plusDays(21))}) → saved to reports/cfg-alert-seed.json`, async () => {
        const out = { seededAt: stamp.toISOString(), run: RUN };
        await newSubmittal('N'); await k.addComponent({ rojDate: plusDays(6), qty: 1 });
        out.notOrdered = { number: `${RUN}-SUB-N`, roj: gb(plusDays(6)), material: MATERIAL };
        await newSubmittal('L'); await k.addComponent({ rojDate: plusDays(6), qty: 1, po: `${RUN}-PO-L`, poDate: poToday() });
        out.notConfirmed = { number: `${RUN}-SUB-L`, roj: gb(plusDays(6)), material: MATERIAL };
        await newSubmittal('C'); await k.addComponent({ rojDate: plusDays(21), qty: 1 });
        out.control = { number: `${RUN}-SUB-C`, roj: gb(plusDays(21)), material: MATERIAL };
        // Keep the earlier seed until it has been verified on a later day.
        if (!seed || batchDone) fs.writeFileSync(SEED_FILE, JSON.stringify(out, null, 1));
        s.observe(`seed ${batchDone || !seed ? 'stored' : 'kept the earlier, unverified seed'}: ${out.notOrdered.number}, ${out.notConfirmed.number}, ${out.control.number}`);
      });
    });
  } });
});
