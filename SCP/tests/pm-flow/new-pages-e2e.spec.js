// =====================================================================================================================
// New pages E2E (26 Nov 2026) – full functional chain over the pages added by the 24 Nov 2026 redesign:
// Loads › Build load → Mark as expected → Receive (short + damaged) → Discrepancies (auto-raised) → Resolve one /
// Raise NCR on the other → NCRs lifecycle (Rework → Approve → Work done) → Management Dashboard tiles, urgent chip and
// My Work "Projects at a glance" follow every step.
// Flows and expected results: docs/functional-discovery/NEW_PAGES_FLOWS_2026-11-26.md (observed 26 Nov, pending client
// confirmation – user decision 26 Nov: automate as observed, client confirms).
// Data rule (user, 26 Nov): ONE load chain per run on NRVC_Hall. The load takes 3 pieces of a large automation-owned open
// line (default PLT2611130841-SUB-P, 20,000 pieces), so the line stays open for later runs. Notes carry "NPE YYMMDD-HHMM".
// Smoke = NPE-SMK-*, regression (variants and negatives on the same chain) = NPE-REG-*.
// Run: node scripts/run-pm-flow.js np-e2e --headless
// =====================================================================================================================
const { test, expect } = require('@playwright/test');
const { runPmSuite } = require('./support/pm-flow');
const { plKit } = require('./support/pl-flow');
const { LoginPage } = require('../../pages/login.page');
const { PlatformChooserPage } = require('../../pages/platform-chooser.page');
const { ProjectSelectorPage } = require('../../pages/project-selector.page');
const { SiteSelectorPage } = require('../../pages/site-selector.page');

const SUITE = 'New Pages E2E';
const d = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString(); // IST
const TAG = `NPE ${d.slice(2, 4)}${d.slice(5, 7)}${d.slice(8, 10)}-${d.slice(11, 13)}${d.slice(14, 16)}`;
const LINE = process.env.SCP_NPE_LINE || 'PLT2611130841-SUB-P';
const SITE = process.env.SCP_NPE_SITE || 'Warehoust _NR';
const QTY = 3, RECEIVED = 2, DAMAGED = 1; // expected 3, received 2 (1 short), of which 1 damaged
const meta = (id, module, title, kind = 'Integration') => ({ id, module, submodule: id.startsWith('NPE-SMK') ? 'E2E smoke' : 'E2E regression', suite: SUITE, title: `[${kind}] ${title}`, kind, navPath: [module] });

test.describe.configure({ mode: 'serial' });
test.setTimeout(90 * 60 * 1000);

test('New pages – E2E chain', async ({ page, browserName }) => {
  await runPmSuite({ page, browserName, suite: SUITE, scenarios: async ({ run, config }) => {
    const k = plKit(page);
    const { main } = k;
    const R = { tag: TAG };
    const clean = t => String(t || '').replace(/\s+/g, ' ').trim();
    const go = async route => { await page.goto(route, { waitUntil: 'domcontentloaded' }); await main.getByText('Loading…').first().waitFor({ state: 'hidden', timeout: 60000 }).catch(() => null); await k.settle(3000); };
    const status = async () => clean((await main.innerText()).split('\n').slice(0, 5).join(' '));
    const select = option => main.locator('select').filter({ has: page.locator('option', { hasText: option }) }).first();

    // ---- counters on other pages ----
    const counters = async () => {
      await go('/management-dashboard');
      await expect(main.getByText('Open discrepancies').first()).toBeVisible({ timeout: 60000 });
      const text = await main.innerText();
      const tile = name => Number((text.match(new RegExp(`(?:^|\\n)${name.replace(/[()]/g, '\\$&')}\\s*(\\d+)`)) || [])[1]);
      const chip = Number(((await main.getByRole('tab', { name: /^Delivery discrepancies/ }).first().innerText().catch(() => '')).match(/(\d+)/) || [])[1] ?? 0);
      const out = { openDisc: tile('Open discrepancies'), openNcr: tile('Open NCRs'), awaiting: tile('Loads awaiting receipt'), chipDisc: chip };
      await go('/my-work');
      const row = main.locator('tbody tr').filter({ has: page.getByRole('button', { name: config.projectName, exact: true }) }).first();
      await expect(row).toBeVisible({ timeout: 60000 });
      const cells = (await row.locator('td').allInnerTexts()).map(clean);
      out.myWorkOpenIssues = Number(cells[cells.length - 1]);
      out.myWorkAwaiting = Number(cells[cells.length - 2]);
      return out;
    };
    const discRow = () => main.locator('tbody tr').filter({ hasText: R.load });
    const openDiscPanel = async kind => {
      await go('/discrepancies'); await select('Resolved').selectOption({ label: 'All' }); await k.settle(2500);
      await main.getByRole('searchbox').first().fill(R.load); await k.settle(2500);
      const rows = discRow().filter({ hasText: kind }), open = rows.filter({ hasText: /\d+ d\s*Open\s*$/ });
      await ((await open.count()) ? open.first() : rows.first()).click(); await k.settle(2500);
    };
    const ncrPanel = () => main.getByRole('button', { name: 'Close ✕' }).locator('xpath=ancestor::*[3]');

    const login = await run.scenario({ ...meta('NPE-00', 'Login', `Sign in to ${config.projectName}; record Dashboard and My Work counters`, 'Setup'), always: true }, async s => {
      await k.signIn(s, config);
      await s.step('Management Dashboard tiles, "Delivery discrepancies" chip and My Work row of the project → baseline', async () => { R.base = await counters(); s.observe(JSON.stringify(R.base)); }, { critical: true });
      await s.step(`Submittal Invoiced Orders › ${LINE} "Qty Orders Received" → baseline`, async () => {
        await go('/submittal-invoiced-orders'); await k.settle(7000);
        const rows = await main.locator('table').first().locator('tbody tr').evaluateAll((rs, sub) => rs.map(r => [...r.cells].map(c => c.innerText.trim())).filter(c => c[0] === sub), LINE);
        R.invBefore = rows.reduce((a, c) => a + Number(String(c[5]).replace(/[^\d.]/g, '') || 0), 0); s.observe(`${LINE} received ${R.invBefore} (${rows.length} rows)`);
      });
    });
    if (login.status !== 'Passed') { run.abort('Sign-in failed'); return; }

    // ============================================ SMOKE CHAIN ============================================
    // Debug / re-run aid: SCP_NPE_LOAD=LD-000N continues with that run load instead of building a new one (one-record rule).
    const REUSE = process.env.SCP_NPE_LOAD;
    const build = REUSE ? await run.scenario(meta('NPE-SMK-01', 'Loads', `Continue with the run load ${REUSE} (SCP_NPE_LOAD)`, 'Setup'), async s => {
      await s.step(`All Loads › "All loads" › search ${REUSE} → open it`, async () => {
        await go('/loads'); await main.getByRole('tab', { name: 'All loads' }).click(); await k.settle(2000);
        for (const st of ['Open loads', 'Pending (not booked)', 'Booked or expected', 'Arrived', 'Received']) {
          await select('Open loads').selectOption({ label: st }); await k.settle(2000);
          // The list search does not find a load by its number (27 Nov, NPE-REG-10): find the row by its text.
          const hit = main.getByText(new RegExp(`^${REUSE}`)).first();
          if (await hit.isVisible().catch(() => false)) { await page.keyboard.press('Escape').catch(() => null); await hit.click({ force: true }); break; }
        }
        await expect(page).toHaveURL(/\/loads\/[0-9a-f-]{36}$/, { timeout: 30000 }); await k.settle(2500);
        R.load = REUSE; R.loadUrl = new URL(page.url()).pathname; s.observe(`${R.load} · ${await status()}`);
        R.rcv = (clean(await main.innerText()).match(/RCV-\d+/) || [])[0]; // a received load shows "Receipt RCV-N"
        R.line2 = (await main.getByRole('heading', { name: 'This load' }).locator('xpath=ancestor::*[2]').locator('tbody tr').filter({ hasText: LINE }).count()) > 1;
      }, { critical: true });
    }) : await run.scenario(meta('NPE-SMK-01', 'Loads', `Build load: ${QTY} pieces of ${LINE} on ${SITE}, Save → LD-N Pending`, 'Positive'), async s => {
      await s.step(`Loads › All Loads › "Build load" › search "${LINE}" › "Add"; quantity ${QTY}; Site "${SITE}"; Notes "${TAG}"`, async () => {
        await go('/loads'); await main.getByRole('button', { name: 'Build load' }).click();
        await expect(page).toHaveURL(/\/loads\/new/, { timeout: 30000 }); await k.settle(4000);
        await main.getByRole('textbox', { name: 'Search…' }).fill(LINE); await k.settle(3000);
        const lines = main.locator('table').first().locator('tbody tr').filter({ hasText: LINE });
        await expect(lines.first(), `open line ${LINE}`).toBeVisible({ timeout: 30000 });
        // A submittal can have several open lines (26 Nov: 20,000 and 2 pieces) – take the one with the most left.
        const toLoad = t => Number(((t.match(/([\d,]+)\s+Pieces/) || [])[1] || '0').replace(/,/g, ''));
        const texts = (await lines.allInnerTexts()).map(clean);
        const best = texts.reduce((b, t, i) => toLoad(t) > toLoad(texts[b]) ? i : b, 0);
        expect(toLoad(texts[best]), `an open line of ${LINE} with at least ${QTY} pieces`).toBeGreaterThanOrEqual(QTY);
        R.lineIndex = best;
        const line = lines.nth(best);
        R.lineBefore = clean(await line.innerText()); s.observe(R.lineBefore);
        await line.getByRole('button', { name: 'Add' }).click(); await k.settle(1500);
        const loadRow = main.getByRole('heading', { name: 'This load' }).locator('xpath=ancestor::*[2]').locator('tbody tr').filter({ hasText: LINE }).first();
        await loadRow.getByRole('spinbutton').fill(String(QTY));
        // Second line (27 Nov): 1 piece of another open line of the same submittal – received as 2 to cover "Over delivery".
        const rest = main.locator('table').first().locator('tbody tr').filter({ hasText: LINE }).filter({ has: page.getByRole('button', { name: 'Add' }) });
        if (await rest.count()) {
          R.line2Before = clean(await rest.first().innerText());
          await rest.first().getByRole('button', { name: 'Add' }).click(); await k.settle(1500);
          const second = main.getByRole('heading', { name: 'This load' }).locator('xpath=ancestor::*[2]').locator('tbody tr').filter({ hasText: LINE }).filter({ has: page.getByRole('spinbutton') }).nth(1);
          await second.getByRole('spinbutton').fill('1'); R.line2 = true;
          s.observe(`second line: ${R.line2Before.slice(0, 80)} (1 piece)`);
        }
        await main.getByRole('combobox', { name: 'Site' }).selectOption({ label: SITE });
        await main.getByRole('heading', { name: 'This load' }).locator('xpath=ancestor::*[2]').getByRole('textbox').last().fill(TAG);
        await expect(main.getByText(/Delivery window/).first()).toBeVisible();
      }, { critical: true });
      await s.step('"Save load" → "LD-N saved.", heading LD-N, status Pending; actions Mark as expected / Cancel load / Delete', async () => {
        await main.getByRole('button', { name: 'Save load' }).click();
        await expect(page).toHaveURL(/\/loads\/[0-9a-f-]{36}$/, { timeout: 30000 }); await k.settle(2500);
        R.load = clean(await main.getByRole('heading', { level: 2 }).first().innerText());
        R.loadUrl = new URL(page.url()).pathname;
        s.observe(`${R.load} · ${await status()}`);
        expect(R.load).toMatch(/^LD-\d+$/);
        await expect(main.getByText(`${R.load} saved.`).first()).toBeVisible();
        for (const b of ['Mark as expected', 'Cancel load', 'Delete']) await expect(main.getByRole('button', { name: b })).toBeVisible();
        expect(await status()).toMatch(/Pending/);
      }, { critical: true });
      await s.step(`All Loads › "All loads" › status "Pending (not booked)" → the load is listed (site ${SITE}, "43 Inches × ${QTY} Pieces"); Upcoming "Built, not booked" lists it too`, async () => {
        await go('/loads'); await main.getByRole('tab', { name: 'All loads' }).click(); await k.settle(2000);
        await select('Open loads').selectOption({ label: 'Pending (not booked)' }); await k.settle(2500);
        const row = main.getByText(new RegExp(`^${R.load}`)).first().locator('xpath=ancestor::tr[1]');
        await expect(row).toBeVisible({ timeout: 20000 });
        const text = clean(await row.innerText()); s.observe(text);
        expect(text).toContain(SITE); expect(text).toMatch(/× \d+ Pieces/);
        await main.getByRole('tab', { name: 'Upcoming' }).click(); await k.settle(2500);
        await expect(main.getByText(new RegExp(`^${R.load}`)).first()).toBeVisible();
      });
    });
    if (build.status !== 'Passed') { run.abort('Load not built'); return; }

    // The Mark-as-expected panel (27 Nov): a date input defaulting to the latest ROJ, "Suggested window: ROJ − 14 days – ROJ".
    const markPanel = () => main.getByRole('heading', { name: /^Mark LD-\d+ as expected$/ }).locator('xpath=..');
    const openMark = async () => { await go(R.loadUrl); await main.getByRole('button', { name: 'Mark as expected' }).click(); await k.settle(1500); await expect(markPanel()).toBeVisible({ timeout: 15000 }); };

    // ---- Regression on the run load while it is Pending (27 Nov) ----
    const thisLoad = () => main.getByRole('heading', { name: 'This load' }).locator('xpath=ancestor::*[2]');
    await run.scenario(meta('NPE-REG-13', 'Loads', 'Edit a pending load: quantity and notes kept after Save changes', 'Positive'), async s => {
      await s.step(`Load page (Pending) › quantity ${QTY} → ${QTY - 1}, notes + " edited" → "Save changes" enabled › Save → reload shows ${QTY - 1} and the new note`, async () => {
        await go(R.loadUrl);
        if (!/Pending/.test(await status())) throw new Error(`${R.load} is not Pending`);
        const save = main.getByRole('button', { name: 'Save changes' });
        await expect(save).toBeDisabled();
        await thisLoad().locator('tbody tr').filter({ hasText: LINE }).first().getByRole('spinbutton').fill(String(QTY - 1));
        await thisLoad().getByRole('textbox').last().fill(`${TAG} edited`);
        await expect(save).toBeEnabled();
        await save.click(); await k.settle(3000);
        await go(R.loadUrl);
        const q = await thisLoad().locator('tbody tr').filter({ hasText: LINE }).first().getByRole('spinbutton').inputValue();
        const note = await thisLoad().getByRole('textbox').last().inputValue();
        s.observe(`quantity ${q}; notes "${note}"`);
        expect(Number(q)).toBe(QTY - 1); expect(note).toBe(`${TAG} edited`);
      });
      await s.step(`Set the quantity back to ${QTY} › Save changes → kept`, async () => {
        await thisLoad().locator('tbody tr').filter({ hasText: LINE }).first().getByRole('spinbutton').fill(String(QTY));
        await main.getByRole('button', { name: 'Save changes' }).click(); await k.settle(3000);
        await go(R.loadUrl);
        expect(Number(await thisLoad().locator('tbody tr').filter({ hasText: LINE }).first().getByRole('spinbutton').inputValue())).toBe(QTY);
      }, { critical: true });
    });

    await run.scenario(meta('NPE-REG-14', 'Loads', 'Add a line with an earlier ROJ: window warning needs a reason; Remove clears it (not saved)', 'Negative'), async s => {
      await s.step('Load page › "Add" the open line with the earliest ROJ → it appears in This load; the delivery window moves and the run line is flagged ("Early") with "Reason for adding this line anyway (required)"; "Lines with a warning need a reason." and Save changes stays disabled', async () => {
        await go(R.loadUrl);
        const lines = () => thisLoad().locator('tbody tr').filter({ has: page.getByRole('button', { name: 'Remove' }) });
        R.linesBefore = await lines().count();
        const other = main.locator('table').first().locator('tbody tr').filter({ hasNotText: LINE }).first(); // the list is sorted by ROJ, earliest first
        s.observe(`adding: ${clean(await other.innerText()).slice(0, 70)}`);
        await other.getByRole('button', { name: 'Add' }).click(); await k.settle(1500);
        expect(await lines().count()).toBe(R.linesBefore + 1);
        const text = clean(await thisLoad().innerText()); s.observe(text.slice(0, 260));
        expect(text).toMatch(/Early|Late/);
        await expect(thisLoad().getByPlaceholder(/Reason for adding this line anyway/)).toBeVisible();
        await expect(main.getByText('Lines with a warning need a reason.').first()).toBeVisible();
        await expect(main.getByRole('button', { name: 'Save changes' })).toBeDisabled();
      });
      await s.step('Type a reason → Save changes enabled (not clicked); "Remove" the added line → warning and reason field gone, Save changes disabled again', async () => {
        await thisLoad().getByPlaceholder(/Reason for adding this line anyway/).first().fill(`${TAG} reason`); await k.settle(800);
        await expect(main.getByRole('button', { name: 'Save changes' })).toBeEnabled();
        const lines = () => thisLoad().locator('tbody tr').filter({ has: page.getByRole('button', { name: 'Remove' }) });
        await lines().filter({ hasNotText: LINE }).first().getByRole('button', { name: 'Remove' }).click(); await k.settle(1500);
        expect(await lines().count()).toBe(R.linesBefore);
        await expect(thisLoad().getByPlaceholder(/Reason for adding this line anyway/)).toHaveCount(0);
        await go(R.loadUrl); // drop any unsaved edit
        await expect(main.getByRole('button', { name: 'Save changes' })).toBeDisabled();
      });
    });

    await run.scenario(meta('NPE-REG-15', 'Loads', 'Quantity 0 is not accepted on a load line', 'Negative'), async s => {
      await s.step('Load page › line quantity 0 → Save changes disabled or refused with a message; reload → quantity unchanged', async () => {
        await go(R.loadUrl);
        const spin = thisLoad().locator('tbody tr').filter({ hasText: LINE }).first().getByRole('spinbutton');
        await spin.fill('0'); await k.settle(800);
        const save = main.getByRole('button', { name: 'Save changes' });
        const enabled = await save.isEnabled();
        if (enabled) { await save.click(); await k.settle(2500); }
        await go(R.loadUrl);
        const q = Number(await thisLoad().locator('tbody tr').filter({ hasText: LINE }).first().getByRole('spinbutton').inputValue());
        s.observe(`Save ${enabled ? 'enabled (clicked)' : 'disabled'}; quantity after reload ${q}`);
        expect(q, 'quantity 0 not saved').toBe(QTY);
      });
    });

    // Regression, while the load is still Pending: a date outside the suggested window.
    await run.scenario(meta('NPE-REG-11', 'Loads', 'Expected date outside the suggested window', 'Negative'), async s => {
      await s.step('Mark as expected › Expected date = today (after the ROJ, outside "Suggested window") › Save date → either saved, or refused WITH a message', async () => {
        if (!/Pending/.test(await (async () => { await go(R.loadUrl); return status(); })())) throw new Error(`${R.load} is no longer Pending – this case needs the run's new load (not SCP_NPE_LOAD)`);
        await openMark();
        const win = clean(await markPanel().innerText()).match(/Suggested window: (\S+) – (\S+)/) || [];
        await markPanel().locator('input').first().fill(d.slice(0, 10));
        await markPanel().getByRole('button', { name: 'Save date' }).click(); await k.settle(3000);
        const msg = clean(((await page.getByRole('status').allInnerTexts()).join(' ') + ' ' + (await markPanel().innerText().catch(() => ''))).match(/[^.]*(window|before|after|invalid|must|cannot)[^.]*\./i)?.[0] || '');
        await go(R.loadUrl);
        const saved = /Expected/.test(await status());
        s.observe(`window ${win.slice(1).join(' – ')}; today ${d.slice(0, 10)}; ${saved ? 'saved' : 'not saved'}; message: ${msg || '(none)'}`);
        if (saved) { await main.getByRole('button', { name: 'Back to pending' }).click(); await k.settle(2500); await go(R.loadUrl); }
        expect(saved || !!msg, 'A date outside the suggested window is neither saved nor explained (no message)').toBe(true);
      });
    });

    await run.scenario(meta('NPE-SMK-02', 'Loads', 'Mark as expected (suggested date) → Expected; listed under "Booked or expected"', 'Positive'), async s => {
      await s.step('Load page › "Mark as expected" › Expected date = today; the line arrives after its ROJ → "Give a reason" per line › reason filled › "Save date" → status Expected; actions Receive / Change date / Back to pending / Cancel load', async () => {
        if (/Expected/.test(await (async () => { await go(R.loadUrl); return status(); })())) { s.observe('already Expected'); return; }
        await openMark();
        R.expectedDate = d.slice(0, 10);
        await markPanel().locator('input').first().fill(R.expectedDate); await k.settle(1000);
        // 27 Nov: a date after a line's ROJ asks "<product>: Give a reason: on that date this line arrives after its ROJ date."
        // The reason field appears after the first "Save date".
        await markPanel().getByRole('button', { name: 'Save date' }).click(); await k.settle(2000);
        const ask = main.getByText(/Give a reason/).first();
        await expect(ask, '"Give a reason" asked for the late line').toBeVisible({ timeout: 10000 });
        const area = ask.locator('xpath=ancestor::*[3]');
        s.observe(`reason area: ${(await area.ariaSnapshot()).replace(/\n/g, ' ').slice(0, 600)}`);
        const reasons = area.locator('input:not([type="date"]), textarea, select');
        const n = await reasons.count();
        for (let i = 0; i < n; i++) {
          const el = reasons.nth(i);
          if ((await el.evaluate(e => e.tagName)) === 'SELECT') { const o = (await el.locator('option').allInnerTexts()).map(clean).filter(x => x && !/choose|select/i.test(x)); if (o.length) await el.selectOption({ label: o[0] }); }
          else await el.fill(`${TAG} supplier delay`);
        }
        s.observe(`reason fields ${n}; ${clean(await markPanel().innerText()).slice(0, 220)}`);
        await markPanel().getByRole('button', { name: 'Save date' }).click(); await k.settle(3000);
        await go(R.loadUrl);
        s.observe(`${await status()} (date ${R.expectedDate})`);
        expect(await status()).toMatch(/Expected/);
        for (const b of ['Receive', 'Change date', 'Back to pending', 'Cancel load']) await expect(main.getByRole('button', { name: b })).toBeVisible();
      }, { critical: true });
      await s.step('All Loads › "All loads" › status "Booked or expected" → the load is listed with its expected date', async () => {
        await go('/loads'); await main.getByRole('tab', { name: 'All loads' }).click(); await k.settle(2000);
        await select('Open loads').selectOption({ label: 'Booked or expected' }); await k.settle(2500);
        const row = main.getByText(new RegExp(`^${R.load}`)).first().locator('xpath=ancestor::tr[1]');
        await expect(row).toBeVisible({ timeout: 20000 });
        const text = clean(await row.innerText()); s.observe(text);
        R.expectedDate = R.expectedDate || d.slice(0, 10); const [y, m, dd] = R.expectedDate.split('-'); expect(text).toContain(`${dd}/${m}/${y}`);
      });
      await s.step('Upcoming → the load is no longer under "Built, not booked"', async () => {
        await go('/loads'); await k.settle(2000);
        const text = await main.innerText();
        const built = text.split('Built, not booked')[1] || '';
        s.observe(`Built, not booked section: ${clean(built).slice(0, 120)}`);
        expect(built.includes(R.load)).toBe(false);
      });
    });

    // ---- Regression on the run load while it is Expected (27 Nov) ----
    const markWithReason = async (iso) => {
      await expect(markPanel()).toBeVisible({ timeout: 15000 });
      await markPanel().locator('input').first().fill(iso); await k.settle(800);
      await markPanel().getByRole('button', { name: 'Save date' }).click(); await k.settle(1500);
      const reason = markPanel().getByRole('textbox', { name: 'Reason' });
      if (await reason.count()) { await reason.fill(`${TAG} supplier delay`); await markPanel().getByRole('button', { name: 'Save date' }).click(); await k.settle(2500); }
    };
    await run.scenario(meta('NPE-REG-16', 'Loads', 'Change date, then Back to pending and Mark as expected again', 'Positive'), async s => {
      const plus = n => { const t = new Date(Date.now() + 5.5 * 3600e3 + n * 864e5); return t.toISOString().slice(0, 10); };
      await s.step('Expected load › "Change date" → tomorrow (+ reason) → status Expected with the new date', async () => {
        await go(R.loadUrl);
        if (!/Expected/.test(await status())) throw new Error(`${R.load} is not Expected`);
        await main.getByRole('button', { name: 'Change date' }).click(); await k.settle(1500);
        await markWithReason(plus(1));
        await go(R.loadUrl);
        const st = await status(); s.observe(st);
        const [y, m, dd] = plus(1).split('-'); expect(st).toContain(`${dd}/${m}/${y}`);
      }, { critical: true });
      await s.step('"Back to pending" → status Pending; Mark as expected offered; the load is under Upcoming "Built, not booked"', async () => {
        await main.getByRole('button', { name: 'Back to pending' }).click(); await k.settle(3000);
        await go(R.loadUrl);
        expect(await status()).toMatch(/Pending/);
        await expect(main.getByRole('button', { name: 'Mark as expected' })).toBeVisible();
        await go('/loads'); const built = (await main.innerText()).split('Built, not booked')[1] || '';
        expect(built.includes(R.load)).toBe(true);
      }, { critical: true });
      await s.step('Mark as expected again for today (+ reason) → Expected; the chain continues with the receipt', async () => {
        await go(R.loadUrl); await main.getByRole('button', { name: 'Mark as expected' }).click(); await k.settle(1500);
        await markWithReason(plus(0));
        await go(R.loadUrl);
        expect(await status()).toMatch(/Expected/);
      }, { critical: true });
    });

    await run.scenario(meta('NPE-REG-20', 'Loads', '"Stored at" is required to confirm a receipt', 'Negative'), async s => {
      await s.step('Load › Receive › leave "Stored at" on "Choose…" › Confirm receipt → not received (no RCV number), a message asks for the location; leave the form', async () => {
        await go(R.loadUrl); await main.getByRole('button', { name: 'Receive' }).click();
        await expect(page).toHaveURL(/\/receive$/, { timeout: 30000 }); await k.settle(3000);
        await main.getByRole('button', { name: 'Confirm receipt' }).click(); await k.settle(2500);
        const text = clean(await main.innerText());
        const msg = (text.match(/[^.]*(stored|location|where)[^.]*\./i) || [])[0] || '';
        s.observe(`message: ${msg || '(none)'}`);
        expect(text, 'receipt confirmed without a location').not.toMatch(new RegExp(`${R.load} received as RCV-`));
        expect(msg, 'no message about the missing location').not.toBe('');
        await go(R.loadUrl);
        expect(await status()).toMatch(/Expected/);
      });
    });

    // ---- Dev review gaps (section 6 of ISSUES_CONSOLIDATED_2026-11-27): figures of the run line in the Procurement Log ----
    // Submittal page header: "<N> Pieces required … Received <n> Damaged <n>"; component page of the large line: receipts
    // table RECEIPT / RECEIVED QTY / GOOD / DAMAGED / STORED IN.
    const openLineSubmittal = async () => {
      await k.openLog(); await k.search(LINE); await k.settle(3000);
      await main.getByRole('cell', { name: LINE, exact: true }).first().click();
      await page.waitForURL(/[?&]submittal=/, { timeout: 30000 }); await k.settle(5000);
    };
    const lineFigures = async () => {
      await openLineSubmittal();
      const t = clean(await main.innerText());
      const num = re => Number(((t.match(re) || [])[1] || '').replace(/,/g, ''));
      const comps = (t.match(/43 Inches [\d,]+ Pieces/g) || []);
      return { required: num(/([\d,]+) Pieces required/), received: num(/Received ([\d,]+) Damaged/), damaged: num(/Damaged ([\d,]+)/), components: comps.length, list: comps.join(' | ') };
    };
    const openLineComponent = async () => {
      await openLineSubmittal();
      const btns = page.getByRole('button', { name: 'More actions for 43 Inches', exact: true });
      const idx = await btns.evaluateAll(bs => bs.findIndex(b => { let e = b; for (let i = 0; i < 6 && e; i++) { e = e.parentElement; if (e && /Pieces/.test(e.innerText)) return /20,000 Pieces/.test(e.innerText); } return false; }));
      expect(idx, 'the 20,000-piece component of the run line').toBeGreaterThanOrEqual(0);
      await btns.nth(idx).scrollIntoViewIfNeeded();
      await btns.nth(idx).click({ timeout: 8000 }).catch(() => btns.nth(idx).dispatchEvent('click'));
      await page.getByRole('menuitem', { name: 'Open component', exact: true }).click();
      await page.waitForURL(/[?&]schedule=/, { timeout: 30000 }); await k.settle(5000);
    };
    // Delivery rows of the component page, by the text of each VISIBLE "Delivery actions" button's own row (27 Nov: the
    // component page can be stacked twice – breadcrumb L3 and L4 – and the hidden copy's buttons shifted the index).
    const actionButtons = () => page.getByRole('button', { name: 'Delivery actions', exact: true }).filter({ visible: true });
    const rowTexts = () => actionButtons().evaluateAll(bs => bs.map(b => { let e = b; while (e && !(e.parentElement && e.parentElement.children.length > 1 && /\d/.test(e.innerText) && e.innerText.length > 20)) e = e.parentElement; return (e ? e.innerText : '').replace(/\s+/g, ' ').trim(); }));
    const rowIndexes = async re => (await rowTexts()).map((r, i) => re.test(r) ? i : -1).filter(i => i >= 0);
    const rowAction = async (i, item) => {
      const b = actionButtons().nth(i); await b.scrollIntoViewIfNeeded().catch(() => null);
      await b.click({ timeout: 8000 }).catch(() => b.dispatchEvent('click'));
      await page.getByRole('menuitem', { name: item, exact: true }).first().click();
    };
    // Gap 4 (High): "The old delivery screen still receives the same components under older rules, without checking open
    // loads". While the run load is open (Expected), "Log delivery" on the same component should be refused or warned. A
    // delivery the app accepts is deleted again at once, so the chain is not changed.
    await run.scenario(meta('NPE-GAP-04', 'Loads', '"Log delivery" on a component that is on an open load is refused or warned (dev review gap 4)', 'Negative'), async s => {
      if (!R.load) throw new Error('No run load (NPE-SMK-01)');
      await s.step(`Procurement Log › ${LINE} › component 43 Inches (20,000 Pieces) › Open component → "On a load" shows the run load's ${QTY} pieces`, async () => {
        await openLineComponent();
        const t = clean(await main.innerText()); s.observe((t.match(/On a load [\d,]+/) || ['On a load ?'])[0]);
        expect(Number(((t.match(/On a load ([\d,]+)/) || [])[1] || '0').replace(/,/g, ''))).toBeGreaterThan(0);
      }, { critical: true });
      await s.step(`"Log delivery" › today, first location, item 43 Inches, QTY 1 › Add → refused or a warning that the component is on open load ${R.load}; a delivery the app accepts is deleted again`, async () => {
        // Counted from the "Expected · N deliveries" heading (row locators also match nested grids: 1 delivery read as 3 on
        // 27 Nov) and only the run's own new delivery – "Not on a load", 1 piece – is ever deleted (the 27 Nov clean-up took
        // the last row and removed the load's own delivery).
        const expectedCount = async () => Number((clean(await main.innerText()).match(/Expected · (\d+) deliver/) || [])[1] || 0);
        // The run's delivery is the row "<today> 1 Not on a load …" (never a row of a load).
        const looseIdx = () => rowIndexes(/^\d\d\/\d\d\/\d{4} 1 Not on a load /);
        const before = await expectedCount(), looseBefore = (await looseIdx()).length;
        await k.logDeliveryButton().click();
        const d = k.dialog('Add Delivery', 'Add');
        await expect(d).toBeVisible({ timeout: 15000 });
        await k.day(d.getByRole('textbox').first(), new Date());
        await d.getByRole('button', { name: /^(All Locations|Choose Location)$/ }).click();
        await k.listbox().getByRole('option').filter({ hasNotText: /^(All Locations|Choose Location)$/ }).first().click();
        await d.getByRole('button', { name: 'Choose Item Name' }).click(); await k.listbox().getByRole('option', { name: '43 Inches', exact: true }).first().click();
        const dialogText = clean(await d.innerText());
        await d.getByRole('spinbutton').first().fill('1');
        await d.getByRole('button', { name: 'Add', exact: true }).click(); await k.settle(3000);
        const stillOpen = await page.getByRole('heading', { name: 'Add Delivery', exact: true }).isVisible().catch(() => false);
        const msg = clean(await page.locator('[role="alert"], .Toastify__toast, [class*="toast"]').allInnerTexts().then(a => a.join(' ')).catch(() => ''));
        const warned = /load|LD-\d+|already/i.test(msg + ' ' + dialogText);
        const after = await expectedCount();
        s.observe(`dialog ${stillOpen ? 'stayed open' : 'closed'}; message "${msg || '(none)'}"; expected deliveries ${before} → ${after}`);
        if (stillOpen) await k.closeDialog('Add Delivery').catch(() => page.keyboard.press('Escape'));
        // Re-read after a reload: right after "Add" the stacked page showed the one new delivery twice (27 Nov 18:1x).
        if (after > before) { await page.reload(); await k.settle(5000); }
        const looseAfter = after > before ? await looseIdx() : [];
        s.observe(`loose 1-piece rows before ${looseBefore}, after ${looseAfter.length}`);
        // Deleted only when it is certainly the run's own delivery: the total rose by exactly 1 and there was no loose
        // 1-piece delivery before.
        if (after === before + 1 && looseBefore === 0 && looseAfter.length >= 1) {
          await rowAction(looseAfter[0], 'Delete delivery'); await k.settle(1000);
          const ok = page.getByRole('button', { name: /^(Delete|Yes|Confirm)/ }).last();
          if (await ok.isVisible().catch(() => false)) await ok.click();
          await k.settle(2500); await page.reload(); await k.settle(5000);
          const back = await expectedCount();
          s.observe(`accepted delivery deleted again; expected deliveries now ${back}`);
          if (back !== before) s.observe(`WARNING: expected deliveries ${back}, not back to ${before} – check the component by hand`);
        } else if (after > before) s.observe('accepted delivery NOT deleted: it could not be told apart from the load delivery – delete it by hand');
        expect(after === before || warned, `"Log delivery" accepted 1 piece on the component while ${R.load} is open, without a warning (gap 4)`).toBe(true);
      }, { attempts: 1 }); // a write: never repeated
    });
    const receive = await run.scenario(meta('NPE-SMK-03', 'Loads', `Receive: ${RECEIVED} of ${QTY} received, ${DAMAGED} damaged → RCV, load Checked in`, 'Positive'), async s => {
      await s.step(`Load › "Receive" → form with Expected ${QTY}; set Received ${RECEIVED}, Damaged ${DAMAGED}, Stored at = first location of ${SITE}, note; "Confirm receipt"`, async () => {
        await go(R.loadUrl); await main.getByRole('button', { name: 'Receive' }).click();
        await expect(page).toHaveURL(/\/receive$/, { timeout: 30000 }); await k.settle(3000);
        const fillForm = async () => {
          const row = main.locator('tbody tr').filter({ hasText: LINE }).filter({ has: page.getByRole('spinbutton') }).first();
          await expect(row).toContainText(`${QTY} `);
          await row.getByRole('spinbutton').nth(0).fill(String(RECEIVED));
          await row.getByRole('spinbutton').nth(1).fill(String(DAMAGED));
          const loc = row.getByRole('combobox');
          const opts = (await loc.locator('option').allInnerTexts()).map(clean).filter(o => o && o !== 'Choose…');
          expect(opts.length, `storage locations of ${SITE}`).toBeGreaterThan(0);
          R.location = opts[0]; await loc.selectOption({ label: opts[0] });
          await row.getByRole('textbox', { name: 'Note' }).fill(`${TAG} 1 damaged`);
          if (R.line2) {
            const row2 = main.locator('tbody tr').filter({ hasText: LINE }).filter({ has: page.getByRole('spinbutton') }).nth(1);
            await row2.getByRole('spinbutton').nth(0).fill('2');
            await row2.getByRole('combobox').selectOption({ label: opts[0] });
            await row2.getByRole('textbox', { name: 'Note' }).fill(`${TAG} 1 extra`);
          }
          return { row, opts };
        };
        let { row, opts } = await fillForm();
        // Damage photo on the damaged line and a delivery-note photo (27 Nov: "+ Damage photo", "Delivery note photo").
        const png = require('path').join(require('os').tmpdir(), `npe-${Date.now()}.png`);
        require('fs').writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
        const ch1 = page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null);
        await row.getByText('+ Damage photo').first().click().catch(() => null); const f1 = await ch1; if (f1) await f1.setFiles(png); await k.settle(1500);
        const ch2 = page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null);
        await main.getByText('Delivery note photo').first().click().catch(() => null); const f2 = await ch2; if (f2) await f2.setFiles(png); await k.settle(1500);
        R.photos = { damage: !!f1, note: !!f2 };
        R.viewOnly = await main.getByText('You can view this load but not receive it.').first().isVisible().catch(() => false);
        s.observe(`photo pickers: damage ${!!f1}, delivery note ${!!f2}; after the photo: ${R.viewOnly ? 'form became view-only' : 'still editable'}`);
        if (R.viewOnly) { await go(R.loadUrl + '/receive'); await k.settle(2000); ({ row, opts } = await fillForm()); s.observe('form refilled without photos (see NPE-REG-21)'); }
        await main.getByRole('textbox', { name: /Anything else/ }).fill(`${TAG} receipt`);
        R.receivedAt = Date.now(); // NPE-REG-12 compares the shown date with the IST date of this moment
        await main.getByRole('button', { name: 'Confirm receipt' }).click(); await k.settle(4000);
      }, { critical: true });
      await s.step('→ "LD-N received as RCV-…"; fields read-only; history "Received 2.00 into <location>"; load page status Checked in with the Receipt button', async () => {
        const msg = main.getByText(new RegExp(`${R.load} received as RCV-\\d+`)).first();
        await expect(msg).toBeVisible({ timeout: 30000 });
        R.rcv = ((await msg.innerText()).match(/RCV-\d+/) || [])[0];
        await expect(main.locator('tbody tr').first().getByRole('spinbutton').first()).toBeDisabled();
        R.receiptUrl = new URL(page.url()).pathname;
        await expect(main.getByText(new RegExp(`Received ${RECEIVED}\\.00 into`)).first()).toBeVisible();
        await go(R.loadUrl);
        s.observe(`${R.rcv} · ${await status()}`);
        expect(await status()).toMatch(/Checked in/);
        await expect(main.getByRole('button', { name: `Receipt ${R.rcv}` })).toBeVisible();
        await expect(main.getByText('This load has checked in, so its lines can no longer change.')).toBeVisible();
      });
    });
    if (receive?.status === 'Failed' || receive?.status === 'Blocked') { run.abort('Load not received'); return; }

    await run.scenario(meta('NPE-SMK-04', 'Discrepancies', 'Receipt raises the discrepancies automatically; Dashboard and My Work follow', 'Integration'), async s => {
      await s.step(`Loads › Discrepancies › status All › search ${'LD-N'} → a "Damaged" row (Qty ${DAMAGED}, "… damaged at receipt.", Open) and a "Short delivery" row (Qty ${QTY - RECEIVED})`, async () => {
        await go('/discrepancies'); await select('Resolved').selectOption({ label: 'All' }); await k.settle(2500);
        await main.getByRole('searchbox').first().fill(R.load); await k.settle(3000);
        const rows = (await discRow().allInnerTexts()).map(clean);
        R.discRows = rows; s.observe(rows.join(' ¦ '));
        const damaged = rows.find(r => /^Damaged/.test(r));
        expect(damaged, 'Damaged discrepancy').toBeTruthy();
        expect(damaged).toMatch(new RegExp(`${R.load} ${DAMAGED} ${DAMAGED} of .* damaged at receipt\\.`));
        expect(damaged).toMatch(/Open$/);
        const short = rows.find(r => /^Short delivery/.test(r));
        expect(short, 'Short delivery discrepancy (2 of 3 received)').toBeTruthy();
        expect(short).toMatch(new RegExp(`${R.load} ${QTY - RECEIVED} .*${RECEIVED} received of ${QTY} on the load\.`));
        // The line's ROJ has passed, so the receipt also raises "Received after ROJ" (27 Nov 2026).
        const late = rows.find(r => /^Received after ROJ/.test(r));
        expect(late, 'Received after ROJ discrepancy').toBeTruthy();
        expect(late).toMatch(/received (\d+ \w+ \d{4}), ROJ was/);
        R.lateText = late;
        if (R.line2) {
          const over = rows.find(r => /^Over delivery/.test(r));
          expect(over, 'Over delivery discrepancy (2 received of 1 on the load)').toBeTruthy();
          expect(over).toMatch(new RegExp(`${R.load} 1 `));
        }
      });
      await s.step('Management Dashboard "Open discrepancies" and the "Delivery discrepancies" chip, My Work "Open issues" → each up by the new open discrepancies', async () => {
        R.after = await counters(); s.observe(JSON.stringify(R.after));
        const added = R.discRows.filter(r => /Open$/.test(r)).length;
        expect(R.after.openDisc - R.base.openDisc, 'Open discrepancies tile').toBe(added);
        expect(R.after.chipDisc - R.base.chipDisc, '"Delivery discrepancies" chip').toBe(added);
        expect(R.after.myWorkOpenIssues - R.base.myWorkOpenIssues, 'My Work Open issues').toBe(added);
      });
    });

    // ---- Dev review gap 8 (27 Nov 2026): a trade can receive its own load and resolve its own discrepancies. Read-only:
    // the Subcontractor account opens the run load's discrepancies and the test records which actions are offered; nothing
    // is clicked. Then the Project Admin signs in again and the chain continues. ----
    const switchTo = async (s, who, user, pass) => {
      await page.context().clearCookies(); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }).catch(() => null);
      await page.goto(config.loginUrl, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Welcome To Voyage Control' })).toBeVisible({ timeout: 30000 });
      await new LoginPage(page).login(user, pass);
      const appOrigin = new URL(config.baseUrl).origin;
      await page.waitForURL(u => /platforms\/choose/i.test(u.pathname) || u.origin === appOrigin, { timeout: 45000 });
      if (/platforms\/choose/i.test(page.url())) await new PlatformChooserPage(page, config).openSupplyChainPlanner();
      await expect(page).toHaveURL(new RegExp(appOrigin.replace(/[.]/g, '\\.')), { timeout: 45000 });
      await new ProjectSelectorPage(page, config).ensureProject(config.projectName);
      await new SiteSelectorPage(page).ensureSite(SITE).catch(e => s.observe(`${who}: site "${SITE}" not chosen (${String(e.message).split('\n')[0]})`));
    };
    await run.scenario(meta('NPE-GAP-08', 'Discrepancies', 'A Subcontractor cannot resolve or raise an NCR on the discrepancies of a load (GC only) (dev review gap 8)', 'Role'), async s => {
      const SUB_USER = process.env.SCP_SUBCONTRACTOR_USERNAME, SUB_PASS = process.env.SCP_SUBCONTRACTOR_PASSWORD;
      try {
        await s.step(`Log out; sign in as the Subcontractor account (SCP_SUBCONTRACTOR_*) › ${config.projectName}`, async () => {
          if (!SUB_USER || !SUB_PASS) throw new Error('Blocked: SCP_SUBCONTRACTOR_USERNAME / _PASSWORD not set in SCP/.env');
          await switchTo(s, 'Subcontractor', SUB_USER, SUB_PASS);
        }, { attempts: 1 }); // not critical: a critical failure would also block the sign-in back below
        await s.step(`Loads › Discrepancies › status All › search ${'LD-N'} → the run discrepancies, if listed for the Subcontractor, offer no "Resolve" and no "Raise NCR" (read-only, nothing clicked)`, async () => {
          await go('/discrepancies');
          await select('Resolved').selectOption({ label: 'All' }).catch(() => null); await k.settle(2500);
          await main.getByRole('searchbox').first().fill(R.load); await k.settle(3000);
          const rows = (await discRow().allInnerTexts()).map(clean); s.observe(`listed for the Subcontractor: ${rows.length ? rows.join(' ¦ ') : 'none'}`);
          if (!rows.length) throw new Error(`Blocked: the Subcontractor account does not see the discrepancies of ${R.load} (its trade is not the run line's company), so gap 8 cannot be shown with this account – a load of the Subcontractor's own trade is needed`);
          const offered = [];
          for (const kind of ['Short delivery', 'Damaged']) {
            const row = discRow().filter({ hasText: new RegExp(`^${kind}`) }).first();
            if (!(await row.count())) continue;
            await row.click(); await k.settle(2500);
            for (const b of ['Resolve', 'Raise NCR']) {
              const btn = main.getByRole('button', { name: b, exact: true });
              if (await btn.count() && await btn.first().isEnabled().catch(() => false)) offered.push(`${kind}: ${b}`);
            }
            await page.keyboard.press('Escape').catch(() => null); await k.settle(800);
          }
          s.observe(`actions offered to the Subcontractor: ${offered.join(', ') || 'none'}`);
          expect(offered, `The Subcontractor can act on the discrepancies of ${R.load} (gap 8: should be GC only)`).toEqual([]);
        }, { attempts: 1 });
      } finally {
        await s.step('Log out; sign in again as the Project Admin › project and site → the chain continues', async () => {
          await switchTo(s, 'Project Admin', config.username, config.password);
        }, { critical: true });
      }
    });

    const ncr = await run.scenario(meta('NPE-SMK-05', 'NCRs', 'Raise NCR on the Damaged discrepancy → NCR Open, quantity on hold', 'Positive'), async s => {
      await s.step('Discrepancy panel (Damaged) shows "Raised … from receipt", the load link, Resolve (disabled) and "Raise NCR"', async () => {
        await openDiscPanel('Damaged');
        await expect(main.getByText(/from receipt/).first()).toBeVisible({ timeout: 20000 });
        await expect(main.getByRole('button', { name: R.load })).toBeVisible();
        await expect(main.getByRole('button', { name: 'Resolve' })).toBeDisabled();
      }, { critical: true });
      await s.step('"Raise NCR" → NCR page: NCR-N "Open", "1 Pieces on hold", link to the load, history "raised · 1 on hold"', async () => {
        await main.getByRole('button', { name: 'Raise NCR' }).click();
        await expect(page).toHaveURL(/\/ncrs\/[0-9a-f-]{36}/, { timeout: 30000 });
        R.ncrUrl = new URL(page.url()).pathname;
        await go(R.ncrUrl);
        const head = clean(await ncrPanel().innerText());
        R.ncr = (head.match(/NCR-\d+/) || [])[0]; s.observe(head.slice(0, 220));
        expect(R.ncr).toBeTruthy();
        expect(head).toMatch(new RegExp(`${R.ncr} Open ${DAMAGED} \\w+ on hold`));
        await expect(ncrPanel().getByRole('button', { name: R.load })).toBeVisible();
        expect(head).toMatch(/raised · 1 on hold/);
      }, { critical: true });
      await s.step('Discrepancies (status Open) → the Damaged row of the load is no longer open', async () => {
        await go('/discrepancies'); await main.getByRole('searchbox').first().fill(R.load); await k.settle(2500);
        expect((await discRow().allInnerTexts()).map(clean).filter(r => /^Damaged/.test(r))).toEqual([]);
      });
    });

    // ---- First Delivery Inspections of the run product (27 Nov 2026: the NCR re-inspection is raised there as a new
    // inspection; the list does not name the NCR, so NPE-REG-08 takes the inspection that appeared after the request) ----
    const todayIst = () => { const t = new Date(Date.now() + 5.5 * 3600e3).toISOString(); return `${t.slice(8, 10)}/${t.slice(5, 7)}/${t.slice(0, 4)}`; };
    const fdiTable = () => main.locator('table').filter({ has: page.getByRole('columnheader', { name: 'Material', exact: true }) }).first();
    const fdiOpen = async () => {
      await go('/first-delivery-inspections');
      const grp = main.getByRole('checkbox', { name: /Group by material category/i }).first();
      if (await grp.isChecked().catch(() => false)) { await grp.click(); await k.settle(2500); }
      const box = main.locator('input[type="search"]').first();
      await box.fill(LINE); await box.press('Enter'); await k.settle(4000);
    };
    const fdiTodayRows = () => fdiTable().locator('tbody tr').filter({ hasText: LINE }).filter({ hasText: todayIst() });
    const fdiToday = async () => { await fdiOpen(); return (await fdiTodayRows().allInnerTexts()).map(clean); };
    await run.scenario(meta('NPE-SMK-06', 'NCRs', 'NCR workflow: Rework → Approve (GC QA/QC) → Work done → Awaiting re-inspection', 'Positive'), async s => {
      if (ncr && ncr.status !== 'Passed') throw new Error('NCR not raised (NPE-SMK-05)');
      const step = async (label, action, expected) => s.step(label, async () => {
        await go(R.ncrUrl); await action(); await k.settle(3000); await go(R.ncrUrl);
        const head = clean(await ncrPanel().innerText()); s.observe(head.slice(0, 160));
        expect(head).toMatch(new RegExp(`${R.ncr} ${expected}`));
      }, { critical: true });
      await step('Corrective action "Rework" + note › Save → "Awaiting approval"; approvals "GC QA/QC approval: waiting", "Re-inspection: after the work"', async () => {
        await expect(ncrPanel().getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
        await select('Choose a corrective action…').selectOption({ label: 'Rework' });
        await ncrPanel().getByRole('textbox', { name: 'Note' }).first().fill(`${TAG} rework`);
        await ncrPanel().getByRole('button', { name: 'Save', exact: true }).click();
      }, 'Awaiting approval');
      await step('"Approve (GC QA/QC)" → "In progress"; history "approved gc"', () => ncrPanel().getByRole('button', { name: 'Approve (GC QA/QC)' }).click(), 'In progress');
      await s.step(`First Delivery Inspections (ungrouped) › search ${LINE} → count of inspections dated today, before the re-inspection request (baseline for NPE-REG-08)`, async () => {
        R.fdiBefore = await fdiToday(); s.observe(`${R.fdiBefore.length} inspection(s) of ${LINE} dated today`);
      });
      await step('"Work done: request re-inspection" → "Awaiting re-inspection"; history "reinspection requested"', () => ncrPanel().getByRole('button', { name: 'Work done: request re-inspection' }).click(), 'Awaiting re-inspection');
      await s.step('NCR list › status "Awaiting re-inspection", search NCR-N → listed with Corrective action "Rework"; Dashboard "Open NCRs" up by 1', async () => {
        await go('/ncrs'); await select('All statuses').selectOption({ label: 'Awaiting re-inspection' }); await k.settle(2000);
        await main.getByRole('searchbox').first().fill(R.ncr); await k.settle(2500);
        const row = clean(await main.locator('tbody tr').filter({ hasText: R.ncr }).first().innerText());
        s.observe(row); expect(row).toMatch(/Awaiting re-inspection/); expect(row).toMatch(/Rework/);
        const c = await counters(); s.observe(JSON.stringify(c));
        expect(c.openNcr - R.base.openNcr, 'Open NCRs tile').toBe(1);
      });
    });

    // ============================================ REGRESSION ============================================
    await run.scenario(meta('NPE-REG-21', 'Loads', 'Receipt keeps the damage and delivery-note photos', 'Positive'), async s => {
      await s.step('Receipt page of the run load → the uploaded photos are shown (thumbnails / file names)', async () => {
        await go(R.receiptUrl || R.loadUrl + '/receive');
        const imgs = await main.locator('img').count(); const text = clean(await main.innerText());
        s.observe(`images ${imgs}; photo pickers used ${JSON.stringify(R.photos)}; ${text.match(/[^.]*photo[^.]*/i)?.[0] || ''}`);
        expect(R.photos?.damage, 'the "+ Damage photo" control opened a file picker').toBe(true);
        expect(R.viewOnly, 'Adding a damage photo before confirming turned the receipt view-only ("You can view this load but not receive it.")').toBeFalsy();
        expect(imgs, 'photos shown on the receipt').toBeGreaterThan(0);
      });
    });
    await run.scenario(meta('NPE-REG-22', 'Loads', 'Receipt reaches TOV Submittal Invoiced Orders', 'Integration'), async s => {
      await s.step(`Submittal Invoiced Orders › ${LINE} → "Qty Orders Received" rose by the units received on the load`, async () => {
        await go('/submittal-invoiced-orders', 10000);
        const rows = await main.locator('table').first().locator('tbody tr').evaluateAll((rs, sub) => rs.map(r => [...r.cells].map(c => c.innerText.trim())).filter(c => c[0] === sub), LINE);
        const qRec = rows.reduce((a, c) => a + Number(String(c[5]).replace(/[^\d.]/g, '') || 0), 0);
        const units = RECEIVED + (R.line2 ? 2 : 0), good = units - DAMAGED;
        s.observe(`${LINE}: received now ${qRec}, before ${R.invBefore}; this load ${units} received (${good} good)`);
        expect(R.invBefore, 'baseline read in NPE-00').not.toBeUndefined();
        expect([units, good], 'increase = units received (or good units)').toContain(qRec - R.invBefore);
      });
    });

    await run.scenario(meta('NPE-REG-01', 'Discrepancies', 'Resolve the Short delivery discrepancy ("Replacement booked")', 'Positive'), async s => {
      await s.step('Short delivery panel › "Resolve" disabled until a reason is chosen; "Replacement booked" + note › Resolve', async () => {
        await openDiscPanel('Short delivery');
        await expect(main.getByRole('button', { name: 'Resolve' })).toBeDisabled();
        await select('How was it resolved?').selectOption({ label: 'Replacement booked' });
        await main.getByRole('textbox', { name: 'Note' }).first().fill(`${TAG} replacement booked`);
        await expect(main.getByRole('button', { name: 'Resolve' })).toBeEnabled();
        await main.getByRole('button', { name: 'Resolve' }).click(); await k.settle(3000);
      }, { critical: true });
      await s.step('Discrepancies › status "Resolved" › search LD-N → the Short delivery row shows its resolution "Replacement booked" as status; status "Open" no longer lists it', async () => {
        await go('/discrepancies'); await select('Resolved').selectOption({ label: 'Resolved' }); await k.settle(2000);
        await main.getByRole('searchbox').first().fill(R.load); await k.settle(2500);
        const rows = (await discRow().allInnerTexts()).map(clean); s.observe(rows.join(' ¦ '));
        expect(rows.some(r => /^Short delivery/.test(r) && /Replacement booked$/.test(r)), 'resolved Short delivery shows "Replacement booked"').toBe(true);
        expect(rows.some(r => /^Damaged/.test(r) && /NCR raised$/.test(r)), 'Damaged shows "NCR raised"').toBe(true);
        await select('Resolved').selectOption({ label: 'Open' }); await k.settle(2000);
        expect((await discRow().allInnerTexts()).map(clean).filter(r => /^Short delivery/.test(r))).toEqual([]);
      });
      await s.step('Management Dashboard "Open discrepancies" = baseline + the run discrepancies still open (Received after ROJ); My Work "Open issues" follows', async () => {
        const c = await counters(); s.observe(JSON.stringify(c));
        await go('/discrepancies'); await main.getByRole('searchbox').first().fill(R.load); await k.settle(2500);
        const stillOpen = await discRow().count(); s.observe(`run discrepancies still open: ${stillOpen}`);
        expect(c.openDisc - R.base.openDisc, 'Open discrepancies tile').toBe(stillOpen);
        expect(c.myWorkOpenIssues, 'My Work Open issues = open discrepancies + open NCRs').toBe(c.openDisc + c.openNcr);
      });
    });

    await run.scenario(meta('NPE-REG-02', 'Discrepancies', 'Kind filters and counters include the run discrepancies', 'Positive'), async s => {
      await s.step('Status All › kind "Damaged" and "Short delivery" each list the load once; "Unplanned arrival" does not', async () => {
        await go('/discrepancies'); await select('Resolved').selectOption({ label: 'All' }); await k.settle(2000);
        await main.getByRole('searchbox').first().fill(R.load); await k.settle(2000);
        for (const [kind, n] of [['Damaged', 1], ['Short delivery', 1], ['Unplanned arrival', 0]]) {
          await select('All kinds').selectOption({ label: kind }); await k.settle(2000);
          expect(await discRow().count(), kind).toBe(n);
        }
        await select('All kinds').selectOption({ label: 'All kinds' });
      });
    });

    await run.scenario(meta('NPE-REG-03', 'Loads', 'A checked-in load cannot be changed', 'Negative'), async s => {
      await s.step('Load page (Checked in) → no "Mark as expected", "Cancel load", "Delete" or "Receive"; line quantity not editable', async () => {
        await go(R.loadUrl);
        for (const b of ['Mark as expected', 'Cancel load', 'Delete', 'Receive']) await expect(main.getByRole('button', { name: b, exact: true }), b).toHaveCount(0);
        const spin = main.getByRole('spinbutton').first();
        if (await spin.count()) await expect(spin).toBeDisabled();
      });
    });

    await run.scenario(meta('NPE-REG-04', 'Loads', 'Open line quantity falls by the good units received', 'Integration'), async s => {
      await s.step(`Build load › search ${LINE} → "To load" is ${RECEIVED - DAMAGED} less than before the run (good units received); leave without saving`, async () => {
        await go('/loads/new'); await main.getByRole('textbox', { name: 'Search…' }).fill(LINE); await k.settle(3000);
        const q = t => Number(((t.match(/([\d,]+)\s+Pieces/) || [])[1] || '').replace(/,/g, ''));
        const all = (await main.locator('table').first().locator('tbody tr').filter({ hasText: LINE }).allInnerTexts()).map(clean);
        const now = all.reduce((b, t) => q(t) > q(b) ? t : b, all[0] || ''); // the line the load took from (the largest)
        if (!R.lineBefore) throw new Error('The line quantity before the run is known only when this run built the load (not with SCP_NPE_LOAD)');
        s.observe(`before ${q(R.lineBefore)} · now ${q(now)}`);
        expect(q(R.lineBefore) - q(now), 'open line falls by the good units received (received − damaged); short and damaged units stay open').toBe(RECEIVED - DAMAGED);
      });
    });

    await run.scenario(meta('NPE-REG-05', 'Loads', 'Build load guards: empty load, quantity above what is left, one CSI division', 'Negative'), async s => {
      await s.step('Build load with no line → "Save load" disabled', async () => {
        await go('/loads/new'); await expect(main.getByRole('button', { name: 'Save load' })).toBeDisabled();
      });
      await s.step(`Add ${LINE}, quantity above "of N left" → the load cannot be saved with it (Save disabled or quantity capped); leave without saving`, async () => {
        await main.getByRole('textbox', { name: 'Search…' }).fill(LINE); await k.settle(3000);
        await main.locator('table').first().locator('tbody tr').filter({ hasText: LINE }).first().getByRole('button', { name: 'Add' }).click(); await k.settle(1500);
        const row = main.getByRole('heading', { name: 'This load' }).locator('xpath=ancestor::*[2]').locator('tbody tr').filter({ hasText: LINE }).first();
        const left = Number(((clean(await row.innerText())).match(/of ([\d,]+) left/) || [])[1].replace(/,/g, ''));
        await row.getByRole('spinbutton').fill(String(left + 5));
        const save = main.getByRole('button', { name: 'Save load' });
        const first = await save.isEnabled();
        await row.getByRole('spinbutton').press('Tab'); // leave the field, as a user does before saving
        // The guard is judged after it settles: Save is polled for up to 8 s; the first read is reported too, because on
        // 26–27 Nov Save stayed enabled for a few seconds (once for good).
        const t0 = Date.now(); let saveEnabled = await save.isEnabled();
        while (saveEnabled && Date.now() - t0 < 8000) { await page.waitForTimeout(500); saveEnabled = await save.isEnabled(); }
        const value = Number(await row.getByRole('spinbutton').inputValue());
        s.observe(`left ${left}; typed ${left + 5}; field now ${value}; Save right after typing ${first ? 'enabled' : 'disabled'}, after leaving the field ${saveEnabled ? 'still enabled after 8 s' : `disabled after ${((Date.now() - t0) / 1000).toFixed(1)} s`}`);
        expect(value <= left || !saveEnabled, 'quantity above what is left is not accepted (Save still enabled 8 s after leaving the field)').toBe(true);
      }, { attempts: 1 }); // one attempt: a retry re-reads a settled form and hid the defect on 27 Nov
      await s.step('With a line in the load the open list shows "Showing Division N only: a load carries one CSI division."', async () => {
        await expect(main.getByText(/a load carries one CSI division/).first()).toBeVisible();
      });
    });

    await run.scenario(meta('NPE-REG-06', 'NCRs', 'NCR outputs: PDF and Export to Excel', 'Positive'), async s => {
      await s.step('NCR panel › "PDF" → a PDF file is downloaded', async () => {
        await go(R.ncrUrl);
        const dl = page.waitForEvent('download', { timeout: 30000 });
        await ncrPanel().getByRole('button', { name: 'PDF' }).click();
        const f = await dl; s.observe(f.suggestedFilename());
        expect(f.suggestedFilename()).toMatch(/\.pdf$/i);
      });
      await s.step('NCR list › "Export to Excel" → an .xlsx/.csv file is downloaded', async () => {
        await go('/ncrs');
        const dl = page.waitForEvent('download', { timeout: 30000 });
        await main.getByRole('button', { name: 'Export to Excel' }).click();
        const f = await dl; s.observe(f.suggestedFilename());
        expect(f.suggestedFilename()).toMatch(/\.(xlsx|xls|csv)$/i);
      });
    });

    await run.scenario(meta('NPE-REG-07', 'NCRs', 'NCR without a corrective action cannot be saved; filters find the run NCR', 'Negative'), async s => {
      await s.step('NCR list › filters: division of the line, trade, corrective action "Rework" → NCR-N listed; "Use as is" → not listed', async () => {
        await go('/ncrs'); await main.getByRole('searchbox').first().fill(R.ncr); await k.settle(2000);
        await select('All corrective actions').selectOption({ label: 'Rework' }); await k.settle(2000);
        expect(await main.locator('tbody tr').filter({ hasText: R.ncr }).count()).toBe(1);
        await select('All corrective actions').selectOption({ label: 'Use as is' }); await k.settle(2000);
        expect(await main.locator('tbody tr').filter({ hasText: R.ncr }).count()).toBe(0);
      });
    });

    // No skips (user, 27 Nov): cases waiting for a dev answer still run and report what the app offers.
    // ---- Other NCR corrective actions on the run's remaining discrepancies (27 Nov) ----
    // Over delivery → NCR "Use as is"; Received after ROJ → NCR "Reject and return". Each NCR follows the actions the
    // app offers (up to 4) and the path is recorded; the case expects it to end in Closed or Awaiting re-inspection.
    const ncrPath = async (s, kind, action) => {
      await openDiscPanel(kind);
      await expect(main.getByRole('button', { name: 'Raise NCR' })).toBeVisible({ timeout: 20000 });
      await main.getByRole('button', { name: 'Raise NCR' }).click();
      await expect(page).toHaveURL(/\/ncrs\/[0-9a-f-]{36}/, { timeout: 30000 });
      const url = new URL(page.url()).pathname; await go(url);
      const head = () => ncrPanel().innerText().then(clean);
      const ncr = ((await head()).match(/NCR-\d+/) || [])[0];
      const held = Number(((await head()).match(/(\d+) \w+ on hold/) || [])[1] || 0);
      await select('Choose a corrective action…').selectOption({ label: action });
      await ncrPanel().getByRole('textbox', { name: 'Note' }).first().fill(`${TAG} ${action}`);
      await ncrPanel().getByRole('button', { name: 'Save', exact: true }).click(); await k.settle(3000); await go(url);
      const path = [`${ncr} ${action}: ${((await head()).match(/NCR-\d+ (Open|Awaiting approval|In progress|Awaiting re-inspection|Closed)\b/) || [])[1]}`];
      for (let i = 0; i < 4; i++) {
        const btns = (await ncrPanel().getByRole('button').allInnerTexts()).map(clean).filter(b => b && !/^(PDF|Close ✕|Save|\+ Photo|LD-\d+)$/.test(b));
        if (!btns.length) break;
        const notes = ncrPanel().getByRole('textbox'); for (let j = 0; j < await notes.count(); j++) if (!(await notes.nth(j).inputValue())) await notes.nth(j).fill(`${TAG} step ${i + 1}`).catch(() => null);
        await ncrPanel().getByRole('button', { name: btns[0], exact: true }).click(); await k.settle(3000); await go(url);
        path.push(`${btns[0]} → ${((await head()).match(/NCR-\d+ (Open|Awaiting approval|In progress|Awaiting re-inspection|Closed)\b/) || [])[1]}`);
      }
      const final = ((await head()).match(/NCR-\d+ (Open|Awaiting approval|In progress|Awaiting re-inspection|Closed)\b/) || [])[1] || '';
      s.observe(path.join(' · '));
      return { ncr, final, path, held };
    };
    await run.scenario(meta('NPE-REG-08', 'NCRs', 'Re-inspection (First Delivery Inspection) closes the Rework NCR', 'Positive'), async s => {
      // Dev review "SCP Business Logic and Flow Changes" (27 Nov 2026): a re-inspection for repair or rework is raised as a
      // First Delivery Inspection; recording it (pass) closes the NCR and releases the quantity on hold.
      if (!R.fdiBefore) throw new Error('No inspection baseline from NPE-SMK-06 (the NCR did not reach "Awaiting re-inspection")');
      let row;
      await s.step(`First Delivery Inspections (ungrouped) › search ${LINE} → one more inspection dated today than before "Work done: request re-inspection" ("Auditor Not Yet Assigned")`, async () => {
        const now = await fdiToday();
        s.observe(`before the request ${R.fdiBefore.length}, now ${now.length} inspection(s) of ${LINE} dated today`);
        expect(now.length, 'A re-inspection inspection is raised when the NCR asks for re-inspection').toBeGreaterThan(R.fdiBefore.length);
        row = fdiTodayRows().filter({ hasText: /Auditor Not Yet Assigned/i }).first();
        await expect(row).toBeVisible({ timeout: 15000 });
      }, { critical: true });
      await s.step('That inspection › "Self Assign" → "Fill Inspection Report" › answer every question "Pass", add a photo, outcome "Yes" / accepted › "Submit Inspection" → "Inspection Detail" shows "inspection completed"', async () => {
        await row.getByRole('button', { name: 'Self Assign' }).click(); await k.settle(3000);
        await fdiOpen();
        const mine = fdiTodayRows().filter({ hasText: config.username }).filter({ has: page.getByRole('button', { name: /Fill Inspection Report/i }) }).first();
        await mine.getByRole('button', { name: /Fill Inspection Report/i }).click();
        await page.getByRole('button', { name: 'Submit Inspection' }).waitFor({ timeout: 30000 }); await k.settle(1500);
        const pass = page.getByRole('button', { name: /^pass$/i }).or(page.getByRole('radio', { name: /^pass$/i }));
        for (let i = 0, n = await pass.count(); i < n; i++) await pass.nth(i).click().catch(() => null);
        const png = require('path').join(require('os').tmpdir(), `npe-${Date.now()}.png`);
        require('fs').writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
        const ch = page.waitForEvent('filechooser'); await page.getByRole('button', { name: /Add photo/i }).click(); await (await ch).setFiles(png); await k.settle(2000);
        const outcome = main.getByText('Inspection outcome', { exact: true }).locator('xpath=..');
        const chosen = [];
        if (await outcome.isVisible().catch(() => false)) for (const wanted of [/^Yes\b/i, /^(Accepted|Passed?|Complete)/i]) {
          const sel = outcome.locator('select').filter({ has: page.locator('option', { hasText: wanted }) }).first();
          if (!(await sel.count())) continue;
          const opt = (await sel.locator('option').allInnerTexts()).find(o => wanted.test(o.trim()));
          if (opt) { await sel.selectOption({ label: opt.trim() }); chosen.push(opt.trim()); }
        }
        await page.getByRole('button', { name: 'Submit Inspection' }).click();
        await expect(page.getByText('Inspection Detail').first()).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(/inspection completed/i).first()).toBeVisible();
        s.observe(`outcome: ${chosen.join(' / ') || '(no outcome section)'}`);
      }, { critical: true });
      await s.step(`NCR ${R.ncr || '(run NCR)'} → status "Closed" and no quantity on hold`, async () => {
        await go(R.ncrUrl);
        const head = clean(await ncrPanel().innerText());
        s.observe(head.slice(0, 200));
        expect(head, `Question to the dev team: the inspection raised after "Work done: request re-inspection" was completed (pass, outcome Yes / Accepted) but ${R.ncr} stays "Awaiting re-inspection" – how is the re-inspection linked to the NCR, and what closes it?`).toMatch(new RegExp(`${R.ncr} Closed`));
        expect(head).not.toMatch(/\d+ \w+ on hold/);
      });
    });
    await run.scenario(meta('NPE-REG-23', 'NCRs', 'NCR "Use as is" path (from the Over delivery discrepancy)', 'Positive'), async s => {
      await s.step('Over delivery discrepancy › Raise NCR › corrective action "Use as is" + note › Save › follow the offered actions → ends Closed or Awaiting re-inspection; path recorded', async () => {
        if (!R.line2) throw new Error('No Over delivery discrepancy in this run (the load has one line)');
        const r = await ncrPath(s, 'Over delivery', 'Use as is');
        expect(r.final).toMatch(/Closed|Awaiting re-inspection/);
      });
    });
    await run.scenario(meta('NPE-GAP-02a', 'NCRs', 'Run line figures before "Reject and return" (baseline for gap 2)', 'Setup'), async s => {
      await s.step(`Procurement Log › ${LINE} → submittal "Pieces required", "Received", and the 43 Inches component lines`, async () => {
        R.gap2 = await lineFigures(); s.observe(JSON.stringify(R.gap2));
        expect(R.gap2.required).toBeGreaterThan(0);
      });
    });
    await run.scenario(meta('NPE-REG-24', 'NCRs', 'NCR "Reject and return" path (from the Received after ROJ discrepancy)', 'Positive'), async s => {
      await s.step('Received after ROJ discrepancy › Raise NCR › corrective action "Reject and return" + note › Save › follow the offered actions → ends Closed or Awaiting re-inspection; path recorded', async () => {
        const r = R.rr = await ncrPath(s, 'Received after ROJ', 'Reject and return');
        expect(r.final).toMatch(/Closed|Awaiting re-inspection/);
      });
    });

    // Gap 2 (High): "Reject and return leaves goods in stock and in Received QTY; the replacement adds Required again".
    await run.scenario(meta('NPE-GAP-02', 'NCRs', '"Reject and return" takes the goods out of Received and does not add to Required (dev review gap 2)', 'Negative'), async s => {
      if (!R.gap2 || !R.rr?.held) throw new Error('No baseline (NPE-GAP-02a) or no returned quantity (NPE-REG-24)');
      const after = await (async () => { let a; await s.step(`Procurement Log › ${LINE} after NPE-REG-24 (${R.rr.ncr}, ${R.rr.held} returned) → read the figures again`, async () => { a = await lineFigures(); s.observe(`before ${JSON.stringify(R.gap2)} · after ${JSON.stringify(a)}`); }, { critical: true }); return a; })();
      await s.step(`Submittal "Pieces required" unchanged (${R.gap2.required}): a replacement line, if any, replaces the returned quantity instead of adding to it`, async () => {
        expect(after.required, `Required went from ${R.gap2.required} to ${after.required} after returning ${R.rr.held} – the replacement line is counted on top (gap 2)`).toBe(R.gap2.required);
      });
      await s.step(`Submittal "Received" down by the returned ${R.rr.held} (${R.gap2.received} → ${R.gap2.received - R.rr.held})`, async () => {
        expect(after.received, `Received stays ${after.received} after returning ${R.rr.held} – returned goods are still counted as received (gap 2)`).toBe(R.gap2.received - R.rr.held);
      });
    });
    await run.scenario(meta('NPE-REG-25', 'NCRs', 'NCR "Repair" path (from the second Received after ROJ discrepancy)', 'Positive'), async s => {
      await s.step('Second "Received after ROJ" discrepancy (the load\'s second line) › Raise NCR › corrective action "Repair" + note › Save › follow the offered actions → ends Closed or Awaiting re-inspection; path recorded', async () => {
        if (!R.line2) throw new Error('No second Received after ROJ discrepancy in this run (the load has one line)');
        const r = await ncrPath(s, 'Received after ROJ', 'Repair');
        expect(r.final).toMatch(/Closed|Awaiting re-inspection/);
      }, { attempts: 1 }); // raises an NCR: a retry finds no open discrepancy left and hides the first error (27 Nov)
    });
    await run.scenario(meta('NPE-REG-09', 'Unallocated Deliveries', 'Unplanned arrival allocated to its component (needs Delivery Management)', 'Positive'), async s => {
      await s.step('Unallocated Deliveries → a way to record or receive an unplanned arrival is offered', async () => {
        await go('/unallocated-deliveries');
        const actions = (await main.getByRole('button').allInnerTexts()).map(clean).filter(Boolean);
        s.observe(`buttons: ${actions.join(', ') || 'none'} · ${clean(await main.innerText()).slice(0, 160)}`);
        expect(actions.length > 0 || await main.locator('tbody tr').count() > 0, 'Blocked on staging: unplanned arrivals come only from Delivery Management (gate check-in / DM flex form, dev review 27 Nov), and Delivery Management is not connected on staging – the page offers no action and lists nothing').toBe(true);
      });
    });
    await run.scenario(meta('NPE-REG-12', 'Discrepancies', '"Received after ROJ" shows the receipt date in project time (IST)', 'Negative'), async s => {
      await s.step('Discrepancy "Received after ROJ" of the run load → "received <date>" equals the IST date of the receipt', async () => {
        if (!R.lateText) throw new Error('No "Received after ROJ" discrepancy recorded by NPE-SMK-04');
        const shown = R.lateText.match(/received (\d+ \w+ \d{4})/)[1];
        const at = R.receivedAt || Date.now();
        const day = ms => new Date(ms).toUTCString().slice(5, 16).replace(/^0/, '');
        const ist = day(at + 5.5 * 3600e3), utc = day(at);
        const conclusive = ist !== utc; // only receipts between 00:00 and 05:30 IST fall on different IST and UTC dates
        s.observe(`shown "${shown}", IST date of the receipt "${ist}", UTC date "${utc}"${conclusive ? '' : ' – same date in IST and UTC at this time of day, so a UTC display cannot be told apart (seen at 02:58 IST on 27 Nov)'}`);
        expect(shown, 'The receipt date is shown in UTC, not in IST (receipt after midnight IST shows the previous day)').toBe(ist);
      });
    });
    // Gap 13 (Medium): "No ConditionAtDelivery (GRN) record for load receipts; two shortage formulas".
    await run.scenario(meta('NPE-GAP-13', 'Loads', 'The load receipt shows on the component with its received, good and damaged quantities and a GRN (dev review gap 13)', 'Integration'), async s => {
      if (!R.rcv) throw new Error('No receipt in this run (NPE-SMK-03)');
      let row;
      await s.step(`Procurement Log › ${LINE} › component 43 Inches (20,000 Pieces) › Open component → Received table lists ${R.rcv}`, async () => {
        await openLineComponent();
        row = k.deliveryRows().filter({ hasText: R.rcv }).first();
        await expect(row, `${R.rcv} on the component page`).toBeVisible({ timeout: 20000 });
        s.observe(clean(await row.innerText()));
      }, { critical: true });
      await s.step(`${R.rcv} → RECEIVED QTY ${RECEIVED}, GOOD ${RECEIVED - DAMAGED}, DAMAGED ${DAMAGED} (load: expected ${QTY}, received ${RECEIVED}, damaged ${DAMAGED})`, async () => {
        const n = (clean(await row.innerText()).match(/RCV-\d+ \d{2}\/\d{2}\/\d{4} (\d+) (\d+) (\d+)/) || []).slice(1).map(Number);
        s.observe(`received ${n[0]}, good ${n[1]}, damaged ${n[2]}`);
        expect(n, `Component page shows received ${n[0]} / good ${n[1]} / damaged ${n[2]} for a receipt of ${RECEIVED} (${DAMAGED} damaged) out of ${QTY} expected – the receipt and the GRN use different quantities (gap 13)`).toEqual([RECEIVED, RECEIVED - DAMAGED, DAMAGED]);
      });
      await s.step(`${R.rcv} "Delivery actions" → "Generate GRN" and "View delivery details" are offered (a GRN record exists or can be made)`, async () => {
        const items = await k.deliveryMenu(row); s.observe(items.join(', '));
        expect(items).toEqual(expect.arrayContaining(['Generate GRN', 'View delivery details']));
      });
      // Preparation for gap 3 (correcting a received delivery): read the "Correct delivery" form and close it unsaved.
      await s.step(`${R.rcv} "Delivery actions" › "Correct delivery" → "Edit Delivery" form; record its fields and values; close without saving`, async () => {
        await k.deliveryAction(row, 'Correct delivery');
        const form = page.getByRole('heading', { name: 'Edit Delivery', exact: true }).locator('xpath=ancestor::div[.//button[normalize-space()="Update"]][1]');
        await expect(form).toBeVisible({ timeout: 15000 });
        const fields = await form.locator('input, select, button').evaluateAll(es => es.map(e => `${e.getAttribute('aria-label') || e.placeholder || e.name || e.innerText || e.tagName}=${e.value ?? ''}`.replace(/\s+/g, ' ').slice(0, 60)));
        s.observe(`${clean(await form.innerText()).slice(0, 300)} · fields: ${fields.join(' | ')}`);
        await k.closeDialog('Edit Delivery').catch(() => page.keyboard.press('Escape'));
      });
    });
    await run.scenario(meta('NPE-REG-10', 'Loads', 'All loads search finds a load by its number', 'Positive'), async s => {
      await s.step(`All loads › status "Open loads" / "Received" (as fits the load) › search "${'LD-N'}" → the load is listed (placeholder "Search load, company, material, booking…")`, async () => {
        await go('/loads'); await main.getByRole('tab', { name: 'All loads' }).click(); await k.settle(2000);
        await select('Open loads').selectOption({ label: 'Received' }); await k.settle(2500);
        await main.getByRole('searchbox').first().fill(R.load); await k.settle(3000);
        const found = await main.getByText(new RegExp(`^${R.load}`)).first().isVisible().catch(() => false);
        s.observe(`${found ? 'listed' : 'not listed'} · ${clean(await main.innerText()).match(/\d+ loads?|No loads match these filters\./)?.[0]}`);
        expect(found, `Searching the load number ${R.load} finds no load`).toBe(true);
      });
      await s.step('Search by material "43 Inches" → the load is listed', async () => {
        await main.getByRole('searchbox').first().fill('43 Inches'); await k.settle(3000);
        await expect(main.getByText(new RegExp(`^${R.load}`)).first()).toBeVisible({ timeout: 15000 });
      });
    });
    // ---- Delete and Cancel on temporary 1-piece loads (27 Nov) ----
    // Delete is offered only on a Pending load; a Cancelled load offers no action at all (so it stays as a record).
    const q = t => Number(((t.match(/([\d,]+)\s+Pieces/) || [])[1] || '0').replace(/,/g, ''));
    const toLoadOf = async () => { await go('/loads/new'); await main.getByRole('textbox', { name: 'Search…' }).fill(LINE); await k.settle(3000); const all = (await main.locator('table').first().locator('tbody tr').filter({ hasText: LINE }).allInnerTexts()).map(clean); return Math.max(...all.map(q)); };
    const tempLoad = async (s, note) => {
      const before = await toLoadOf();
      const lines = main.locator('table').first().locator('tbody tr').filter({ hasText: LINE });
      const texts = (await lines.allInnerTexts()).map(clean);
      await lines.nth(texts.reduce((b, t, i) => q(t) > q(texts[b]) ? i : b, 0)).getByRole('button', { name: 'Add' }).click(); await k.settle(1500);
      await thisLoad().locator('tbody tr').filter({ hasText: LINE }).first().getByRole('spinbutton').fill('1');
      await main.getByRole('combobox', { name: 'Site' }).selectOption({ label: SITE });
      await thisLoad().getByRole('textbox').last().fill(`${TAG} ${note}`);
      await main.getByRole('button', { name: 'Save load' }).click();
      await expect(page).toHaveURL(/\/loads\/[0-9a-f-]{36}$/, { timeout: 30000 }); await k.settle(2500);
      const t = { load: clean(await main.getByRole('heading', { level: 2 }).first().innerText()), url: new URL(page.url()).pathname, before };
      s.observe(`${t.load} · ${await status()} · To load before ${before}`);
      return t;
    };
    const listedUnder = async (load, st) => { await go('/loads'); await main.getByRole('tab', { name: 'All loads' }).click(); await k.settle(2000); await select('Open loads').selectOption({ label: st }); await k.settle(2500); return main.getByText(new RegExp(`^${load}`)).count(); };

    await run.scenario(meta('NPE-REG-17', 'Loads', 'Delete a pending load (browser confirm) → gone everywhere; its quantity opens again; no record left', 'Positive'), async s => {
      await s.step(`Build load › 1 piece of ${LINE} › Save → temporary pending load; "To load" falls by 1 (a pending load reserves its quantity)`, async () => {
        R.del = await tempLoad(s, 'temporary – delete');
        const now = await toLoadOf(); s.observe(`To load now ${now}`);
        expect(now).toBe(R.del.before - 1);
      }, { critical: true });
      await s.step('Load page › "Delete" → browser confirm accepted → the load is gone from Open, Pending, Cancelled and Received; "To load" back to the value before', async () => {
        await go(R.del.url);
        page.once('dialog', dlg => { R.delPrompt = dlg.message(); dlg.accept().catch(() => null); });
        await main.getByRole('button', { name: 'Delete', exact: true }).click(); await k.settle(3000);
        s.observe(`confirm: "${R.delPrompt || '(none)'}"`);
        for (const st of ['Open loads', 'Pending (not booked)', 'Cancelled', 'Received']) expect(await listedUnder(R.del.load, st), `${R.del.load} under ${st}`).toBe(0);
        expect(await toLoadOf()).toBe(R.del.before);
      });
    });

    await run.scenario(meta('NPE-REG-18', 'Loads', 'Cancel load (browser confirm) → Cancelled, locked; its quantity opens again', 'Positive'), async s => {
      await s.step(`Build load › 1 piece of ${LINE} › Save → temporary pending load (stays as a Cancelled record – one per run)`, async () => {
        R.can = await tempLoad(s, 'temporary – cancel');
      }, { critical: true });
      await s.step('"Cancel load" → confirm "Cancel LD-N? Its quantities become free to load again." accepted → status Cancelled; no action offered; listed under Cancelled; "To load" back to the value before', async () => {
        await go(R.can.url);
        page.once('dialog', dlg => { R.canPrompt = dlg.message(); dlg.accept().catch(() => null); });
        await main.getByRole('button', { name: 'Cancel load' }).click(); await k.settle(3000);
        s.observe(`confirm: "${R.canPrompt || '(none)'}"`);
        expect(R.canPrompt || '').toMatch(/Its quantities become free to load again/);
        await go(R.can.url);
        expect(await status()).toMatch(/Cancelled/);
        for (const b of ['Mark as expected', 'Cancel load', 'Delete', 'Receive']) await expect(main.getByRole('button', { name: b, exact: true }), b).toHaveCount(0);
        expect(await listedUnder(R.can.load, 'Cancelled')).toBeGreaterThan(0);
        expect(await toLoadOf()).toBe(R.can.before);
      });
    });

    await run.scenario(meta('NPE-REG-19', 'Loads', 'Load numbers stay unique after a delete', 'Negative'), async s => {
      await s.step('The number of the load deleted in NPE-REG-17 is not given to a later load (NPE-REG-18)', async () => {
        s.observe(`deleted ${R.del?.load}; next load ${R.can?.load}`);
        expect(R.can?.load, 'A deleted load number was reused for the next load').not.toBe(R.del?.load);
      });
    });

    // Gap 3 (High): "Correcting a received delivery does not update the load line, discrepancies or accepted quantity".
    // Last case of the chain because it changes the run receipt: "Correct delivery" (form "Edit Delivery": Expected / Actual
    // date, Location, Item Name, Required Remaining Qty, QTY, Update – seen 27 Nov) adds 1 piece to the run receipt, as if
    // one more piece had been found. The load page and the load's discrepancies are compared before and after.
    await run.scenario(meta('NPE-GAP-03', 'Loads', 'Correcting a received load delivery updates the load and its discrepancies (dev review gap 3)', 'Integration'), async s => {
      if (!R.rcv || !R.loadUrl) throw new Error('No receipt in this run (NPE-SMK-03)');
      const loadView = async () => { await go(R.loadUrl); return clean(await main.innerText()).replace(/\d{1,2}:\d{2}/g, ''); };
      const discView = async () => { await go('/discrepancies'); await select('Resolved').selectOption({ label: 'All' }); await k.settle(2500); await main.getByRole('searchbox').first().fill(R.load); await k.settle(3000); return (await discRow().allInnerTexts()).map(clean).map(r => r.replace(/ · \d+ d/, '')).sort(); };
      const B = {}, A = {};
      let oldQty;
      await s.step(`Record ${R.load} (load page) and its discrepancies before the correction`, async () => {
        B.load = await loadView(); B.disc = await discView();
        s.observe(`load: ${B.load.slice(0, 300)} ¦ discrepancies: ${B.disc.join(' | ')}`);
      }, { critical: true });
      await s.step(`Procurement Log › ${LINE} › component 43 Inches › ${R.rcv} › "Correct delivery" › QTY +1 › Update → the correction is saved (row shows the new quantity)`, async () => {
        await openLineComponent();
        const rcvRow = async () => { const t = await rowTexts(); const i = t.findIndex(r => r.startsWith(R.rcv)); return { i, text: t[i] || '' }; };
        const { i, text: before } = await rcvRow();
        expect(i, `${R.rcv} on the component page`).toBeGreaterThanOrEqual(0);
        s.observe(`row before: ${before}`);
        await rowAction(i, 'Correct delivery');
        const form = page.getByRole('heading', { name: 'Edit Delivery', exact: true }).locator('xpath=ancestor::div[.//button[normalize-space()="Update"]][1]');
        await expect(form).toBeVisible({ timeout: 15000 });
        const item = form.getByRole('button', { name: 'Choose Item Name' });
        if (await item.count()) { await item.click(); await k.listbox().getByRole('option', { name: '43 Inches', exact: true }).first().click(); }
        const qty = form.locator('input').last();
        oldQty = Number(await qty.inputValue());
        await qty.fill(String(oldQty + 1));
        // "Note*" (required) appears once the item is chosen (27 Nov).
        const note = form.locator('textarea').first();
        if (await note.count()) await note.fill(`${TAG} gap 3: one more piece found at receipt`);
        await form.getByRole('button', { name: 'Update', exact: true }).click(); await k.settle(2000);
        // Confirmation "Save the correction?" lists what the correction does not change (27 Nov: "A First Delivery
        // Inspection exists for this delivery; editing the delivery doesn't change it.") › Save.
        const confirm = page.getByRole('heading', { name: 'Save the correction?', exact: true });
        if (await confirm.isVisible().catch(() => false)) {
          const box = confirm.locator('xpath=ancestor::div[.//button[normalize-space()="Save"]][1]');
          R.gap3Warn = clean(await box.innerText()).replace(/^Save the correction\? ?/, '').replace(/ ?Save$/, '');
          s.observe(`confirmation: "${R.gap3Warn}"`);
          await box.getByRole('button', { name: 'Save', exact: true }).click(); await k.settle(3000);
        }
        const msg = clean(await page.locator('[role="alert"], .Toastify__toast, [class*="toast"]').allInnerTexts().then(a => a.join(' ')).catch(() => ''));
        const open = await page.getByRole('heading', { name: 'Edit Delivery', exact: true }).isVisible().catch(() => false);
        if (open) {
          const vals = await form.locator('input').evaluateAll(es => es.map(e => e.value).join(' | '));
          s.observe(`form after Update: ${clean(await form.innerText()).slice(0, 400)} · values: ${vals}`);
          await page.screenshot({ path: require('path').join(process.env.PM_FLOW_OUT || require('os').tmpdir(), `npe-gap-03-form-${Date.now()}.png`) }).catch(() => null);
          await k.closeDialog('Edit Delivery').catch(() => page.keyboard.press('Escape'));
        }
        await page.reload(); await k.settle(5000);
        const after = (await rcvRow()).text;
        s.observe(`QTY ${oldQty} → ${oldQty + 1}; form ${open ? 'stayed open' : 'closed'}; message "${msg || '(none)'}"; row after: ${after}`);
        expect(after, 'the corrected quantity is not shown on the receipt row').not.toBe(before);
      }, { critical: true, attempts: 1 }); // a write: never repeated
      await s.step(`${R.load} load page and discrepancies → follow the correction (received +1; the Short delivery discrepancy shrinks or closes)`, async () => {
        A.load = await loadView(); A.disc = await discView();
        s.observe(`load: ${A.load.slice(0, 300)} ¦ discrepancies: ${A.disc.join(' | ')}`);
        const loadChanged = A.load !== B.load, discChanged = JSON.stringify(A.disc) !== JSON.stringify(B.disc);
        s.observe(`load page changed: ${loadChanged}; discrepancies changed: ${discChanged}`);
        expect(loadChanged || discChanged, `Correcting ${R.rcv} (QTY ${oldQty} → ${oldQty + 1}) changed neither ${R.load} nor its discrepancies (gap 3)`).toBe(true);
      });
    });

  } });
});
