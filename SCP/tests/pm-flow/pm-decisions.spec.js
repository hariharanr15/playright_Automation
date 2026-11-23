// Project Management cases approved by the user on 22 Nov 2026 (were "decision needed"):
//   PM-REG-MM-11  Delete a material that is in use → blocked or warned (run-owned material only)
//   PM-REG-SITE-07 Delete a site that has deliveries → blocked or warned (run-owned site only)
//   PM-REG-PLC-06 Drag a row in Procurement Log Configuration → the Procurement Log column order follows; original order restored
// Only data created by earlier automation runs is used: "Auto Fdi <run>" materials (Procurement Log part 3, used by run
// submittals, components and deliveries) and "Site T2 Pmr2-…" sites (PM part 2 uploads, which received run deliveries
// when the header site reset, SCP-DEF-058). If the app wrongly allows a delete, only that run data is lost.
const { test, expect } = require('@playwright/test');
const { runPmSuite } = require('./support/pm-flow');
const { plKit } = require('./support/pl-flow');

const SUITE = 'PM decision cases';
const meta = (id, sub, title, kind = 'Negative') => ({ id, module: 'Project Management', submodule: sub, suite: SUITE, title, kind, navPath: ['Project Management', sub] });

test.describe.configure({ mode: 'serial' });
test.setTimeout(60 * 60 * 1000);

test('Project Management – decision cases', async ({ page, browserName }) => {
  await runPmSuite({ page, browserName, suite: SUITE, scenarios: async ({ run, config }) => {
    const k = plKit(page);
    const { main } = k;
    const layers = () => page.locator('div.fixed.inset-0').filter({ visible: true });
    const messages = async () => (await page.getByRole('status').allInnerTexts()).filter(t => !/^\s*(Project notice|Platform-wide)/i.test(t)).join(' | ');
    // Clicks a "Delete" entry, answers a confirmation if one appears, and returns what the page said.
    const deleteVia = async open => {
      await open();
      await page.getByText('Delete', { exact: true }).last().click(); await k.settle(1200);
      const dialog = layers().filter({ has: page.getByRole('button', { name: /^(Delete|Yes|Confirm)$/ }) }).last();
      let dialogText = '';
      if (await dialog.isVisible().catch(() => false)) {
        dialogText = (await dialog.innerText()).replace(/\s+/g, ' ').slice(0, 300);
        await dialog.getByRole('button', { name: /^(Delete|Yes|Confirm)$/ }).last().click(); await k.settle(2000);
      }
      return { dialogText, message: await messages() };
    };

    const login = await run.scenario({ ...meta('PMD-SETUP', 'Setup', 'Sign in', 'Setup'), always: true }, async s => { await k.signIn(s, config); });
    if (login.status !== 'Passed') { run.abort('Sign-in failed'); return; }

    // ================= MM-11 =================
    await run.scenario(meta('PM-REG-MM-11', 'Material Master', 'Delete a material that is in use is blocked or warned'), async s => {
      let name;
      await s.step('Material Master: search "Auto Fdi" → the newest run material (used by a Procurement Log part 3 submittal, component and delivery)', async () => {
        await page.goto('/material-master', { waitUntil: 'domcontentloaded' }); await k.settle(2500);
        const box = main.getByPlaceholder('Search materials…'); await box.fill('Auto Fdi'); await k.settle(2000);
        const names = (await main.locator('tbody tr td:nth-child(4)').allInnerTexts()).map(t => t.trim()).filter(t => /^Auto Fdi \d{10}$/i.test(t)).sort();
        name = names.pop();
        s.observe(`material: ${name}`);
        expect(name, 'a run material "Auto Fdi <run>"').toBeTruthy();
      }, { critical: true });
      await s.step('Row menu › "Delete", confirm if asked → refused or warned; after a reload the material is still listed', async () => {
        const row = () => main.locator('tbody tr').filter({ has: page.locator('td:nth-child(4)', { hasText: new RegExp(`^\\s*${name}\\s*$`, 'i') }) }).first();
        const r = await deleteVia(async () => { await row().locator('img[alt="Menu"]').click(); await k.settle(500); });
        s.observe(`dialog: ${r.dialogText || '(none)'} · message: ${r.message || '(none)'}`);
        await page.reload({ waitUntil: 'domcontentloaded' }); await k.settle(2500);
        const box = main.getByPlaceholder('Search materials…'); await box.fill(name); await k.settle(2000);
        await expect(row(), `"${name}" still listed (delete of a material in use must be refused)`).toBeVisible({ timeout: 15000 });
      });
    });

    // ================= PLC-06 =================
    await run.scenario(meta('PM-REG-PLC-06', 'Procurement Log Configuration', 'Drag a row → the Procurement Log column order follows (order restored)', 'Positive'), async s => {
      const rows = () => main.locator('tbody tr');
      const name = async i => (await rows().nth(i).locator('td').nth(1).innerText()).replace(/\((Custom|Locked)\)/g, '').trim();
      const order = async () => { const n = await rows().count(); const out = []; for (let i = 0; i < n; i++) out.push(await name(i)); return out; };
      const enabledRow = async i => rows().nth(i).locator('input[type=checkbox]').first().isChecked().catch(() => false);
      // Mouse drag in small steps (the list reorders on pointer moves).
      const drag = async (from, to) => {
        const a = await rows().nth(from).boundingBox(); const b = await rows().nth(to).boundingBox();
        await page.mouse.move(a.x + 30, a.y + a.height / 2); await page.mouse.down(); await page.waitForTimeout(300);
        const steps = 15; const ty = b.y + b.height / 2 + (to > from ? 5 : -5);
        for (let i = 1; i <= steps; i++) { await page.mouse.move(a.x + 30, a.y + a.height / 2 + ((ty - (a.y + a.height / 2)) * i) / steps); await page.waitForTimeout(40); }
        await page.mouse.up(); await page.waitForTimeout(800);
      };
      const save = async () => { await main.getByRole('button', { name: 'Save Changes', exact: true }).click(); await k.settle(2000); await page.reload({ waitUntil: 'domcontentloaded' }); await k.settle(3000); };
      const gridOrder = async () => { await page.goto('/procurement-log', { waitUntil: 'domcontentloaded' }); await expect.poll(k.count, { timeout: 30000 }).toBeGreaterThan(0); return (await main.getByRole('columnheader').allInnerTexts()).map(t => t.trim()); };
      let original; let pair;
      await s.step('Procurement Log Configuration → record the field order; pick two neighbouring enabled, non-locked fields', async () => {
        await page.goto('/procurement-log-configuration', { waitUntil: 'domcontentloaded' }); await k.settle(3000);
        original = await order();
        for (let i = 0; i < original.length - 1 && !pair; i++) {
          const locked = async j => /Locked/.test(await rows().nth(j).innerText());
          if (await enabledRow(i) && await enabledRow(i + 1) && !(await locked(i)) && !(await locked(i + 1))) pair = [i, i + 1];
        }
        s.observe(`fields: ${original.length}; pair: ${pair ? `${original[pair[0]]} / ${original[pair[1]]}` : 'none'}`);
        expect(pair, 'two neighbouring enabled fields').toBeTruthy();
      }, { critical: true });
      try {
        await s.step('Drag the lower field above the upper one, "Save Changes", reload → the configuration shows the new order', async () => {
          await drag(pair[1], pair[0]); await save();
          const now = await order();
          s.observe(`after: ${now[pair[0]]} / ${now[pair[1]]}`);
          expect([now[pair[0]], now[pair[1]]]).toEqual([original[pair[1]], original[pair[0]]]);
        });
        await s.step('Procurement Log grid → the two columns appear in the new order', async () => {
          const grid = await gridOrder();
          const [first, second] = [original[pair[1]], original[pair[0]]].map(n => grid.findIndex(h => h.toLowerCase() === n.toLowerCase()));
          s.observe(`grid positions: ${original[pair[1]]} ${first}, ${original[pair[0]]} ${second}`);
          expect(first, 'moved field shown').toBeGreaterThanOrEqual(0);
          expect(first < second, 'grid follows the configuration order').toBe(true);
        });
      } finally {
        await s.step('Restore: drag back, "Save Changes", reload → original field order', async () => {
          await page.goto('/procurement-log-configuration', { waitUntil: 'domcontentloaded' }); await k.settle(3000);
          if (JSON.stringify(await order()) !== JSON.stringify(original)) { await drag(pair[0], pair[1]); await save(); }
          expect(await order()).toEqual(original);
        });
      }
    });

    // ================= INT-02 =================
    await run.scenario(meta('PM-REG-INT-02', 'Integrations › Booking Integration', 'Booking: submit with an empty Booking System Project ID is refused'), async s => {
      let before;
      await s.step('Project Management › Integrations › Booking Integration → "SCP Project ID" pre-filled; record the "Booking System Project ID" field', async () => {
        await page.goto('/booking-integration', { waitUntil: 'domcontentloaded' }); await k.settle(3000);
        await expect(main.locator('input').first()).toHaveValue(/^PRJ[A-Z0-9]+$/, { timeout: 20000 });
        const inputs = main.locator('input');
        before = await inputs.nth(1).inputValue().catch(() => '');
        s.observe(`Booking System Project ID before: "${before}"`);
      }, { critical: true });
      await s.step('Clear "Booking System Project ID", click "Submit" → a validation message, nothing linked; after a reload the field shows its earlier value', async () => {
        const field = main.locator('input').nth(1);
        await field.fill('');
        await main.getByRole('button', { name: /^(Submit|Save|Link)$/ }).first().click(); await k.settle(2500);
        const text = `${await messages()} ${(await main.innerText()).replace(/\s+/g, ' ').match(/[^.]*(required|enter|empty|invalid|valid)[^.]*\./i)?.[0] || ''}`.trim();
        s.observe(`message: ${text || '(none)'}`);
        await page.reload({ waitUntil: 'domcontentloaded' }); await k.settle(3000);
        const after = await main.locator('input').nth(1).inputValue().catch(() => '');
        s.observe(`Booking System Project ID after reload: "${after}"`);
        expect(text, 'a validation message for the empty Booking ID').toMatch(/required|enter|empty|invalid|valid/i);
        expect(after, 'the earlier link is unchanged').toBe(before);
      });
    });

    // ================= SITE-07 =================
    await run.scenario(meta('PM-REG-SITE-07', 'Site Details', 'Delete a site that has deliveries is blocked or warned'), async s => {
      let site;
      await s.step('Site Details: a run site "Site T2 Pmr2-…" (received run deliveries) is listed', async () => {
        await page.goto('/site-details', { waitUntil: 'domcontentloaded' }); await k.settle(3000);
        const names = (await main.locator('tbody tr').allInnerTexts()).map(t => (t.match(/Site T2 Pmr2-\d{10}/i) || [])[0]).filter(Boolean);
        // 2611211745 was deleted on 22 Nov 2026 (SCP-DEF-081); 2611220013 received the E2E deliveries after the header reset.
        site = process.env.SCP_SITE07_SITE || names.find(n => /2611220013/.test(n)) || names.sort().pop();
        s.observe(`site: ${site}`);
        expect(site, 'a run site "Site T2 Pmr2-…"').toBeTruthy();
      }, { critical: true });
      await s.step('Its row action "Delete" (row menu or delete icon), confirm if asked → refused or warned; after a reload the site is still listed', async () => {
        const row = () => main.locator('tbody tr').filter({ hasText: site }).first();
        const r = await deleteVia(async () => {
          const menu = row().locator('img[alt="Menu"], button[aria-label*="menu" i]').first();
          if (await menu.isVisible().catch(() => false)) { await menu.click(); await k.settle(500); return; }
          const del = row().locator('img[alt="Delete"], [title="Delete"], button:has-text("Delete")').first();
          await del.click(); await k.settle(800);
          throw Object.assign(new Error('clicked'), { clicked: true });
        }).catch(async e => {
          if (!e.clicked) throw e;
          const dialog = layers().filter({ has: page.getByRole('button', { name: /^(Delete|Yes|Confirm)$/ }) }).last();
          let dialogText = '';
          if (await dialog.isVisible().catch(() => false)) { dialogText = (await dialog.innerText()).replace(/\s+/g, ' ').slice(0, 300); await dialog.getByRole('button', { name: /^(Delete|Yes|Confirm)$/ }).last().click(); await k.settle(2000); }
          return { dialogText, message: await messages() };
        });
        s.observe(`dialog: ${r.dialogText || '(none)'} · message: ${r.message || '(none)'}`);
        await page.reload({ waitUntil: 'domcontentloaded' }); await k.settle(3000);
        await expect(row(), `"${site}" still listed (delete of a site with deliveries must be refused)`).toBeVisible({ timeout: 15000 });
      }, { attempts: 1 }); // a retry would look for a site the first attempt may already have deleted
    });
  } });
});
