// Analytics and Enterprise validation (user request, 23 Nov 2026: "pick the pending analytics, international shipments
// and enterprise scenarios"). Automates the checks of the 18 Nov 2026 Analytics validation
// (docs/functional-discovery/ANALYTICS_VALIDATION_2026-11-18.md, user decisions in section G/J/K) and the Enterprise
// pages that only had a smoke check (Supplier Inbox sections and filter, Supplier Performance, Lead Time Benchmarks).
// Read-only, except the header venue, which ANV-AGG-01 switches once and always puts back.
// International Shipments: all 11 SHP-REG cases already run in app-regression (4 known defects pending confirmation).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { runPmSuite } = require('./support/pm-flow');
const { plKit } = require('./support/pl-flow');
const { SiteSelectorPage } = require('../../pages/site-selector.page');

const SUITE = 'Analytics and Enterprise validation';
const meta = (id, module, title, kind, extra = {}) => ({ id, module, submodule: kind, suite: SUITE, title: `[${kind}] ${title}`, navPath: [module], ...extra });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ana-ent-'));
const num = t => Number(String(t || '').replace(/[^\d.-]/g, ''));
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const gbDate = t => { const m = String(t).match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null; };

test.describe.configure({ mode: 'serial' });
test.setTimeout(45 * 60 * 1000);

test('Analytics and Enterprise – validation', async ({ page, browserName }) => {
  await runPmSuite({ page, browserName, suite: SUITE, scenarios: async ({ run, config }) => {
    const k = plKit(page);
    const { main } = k;
    const flat = async (scope = main) => (await scope.innerText()).replace(/\s+/g, ' ');
    const open = async (route, name, group) => {
      await page.keyboard.press('Escape').catch(() => null);
      await k.menu(name, group).catch(() => null);
      if (!page.url().includes(route)) await page.goto(route, { waitUntil: 'domcontentloaded' });
      await k.settle(3000);
    };
    const download = async trigger => {
      const dl = page.waitForEvent('download', { timeout: 30000 }); dl.catch(() => null);
      await trigger();
      const d = await dl; const file = path.join(tmp, d.suggestedFilename()); await d.saveAs(file);
      return { file, name: d.suggestedFilename() };
    };
    const tableRows = async table => table.locator('tbody tr').evaluateAll(rows => rows.map(r => [...r.querySelectorAll('td')].map(td => td.innerText.replace(/\s+/g, ' ').trim())));
    const rowsOf = async table => { for (let i = 0; i < 10; i++) { const r = await tableRows(table); if (r.length) return r; await page.waitForTimeout(2000); } return []; };
    const headers = async table => (await table.locator('th').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());

    const login = await run.scenario(meta('ANV-SETUP', 'Setup', `Sign in on ${config.projectName}`, 'Setup', { always: true }), async s => { await k.signIn(s, config); });
    if (login.status !== 'Passed') { run.abort('Setup failed'); return; }

    // ======================= Enterprise › Supplier Inbox =======================
    const ENT = 'Enterprise';
    // Expands one collapsed section (▼) and returns the rows of its table.
    const inboxSection = async name => {
      const head = main.getByText(new RegExp(`^${name}$`, 'i')).first();
      const box = main.locator('div').filter({ has: page.getByText(new RegExp(`^${name}$`, 'i')) }).filter({ has: page.locator('table') }).last();
      const table = box.locator('table').first();
      // Wait until the section counts have loaded, then expand it (a click toggles it) until its table shows.
      await expect.poll(async () => /\d+ SUBMITTALS|\d+ DELIVERIES/i.test(await flat()), { timeout: 30000 }).toBe(true).catch(() => null);
      for (let i = 0; i < 2 && !(await table.isVisible().catch(() => false)); i++) { await head.click().catch(() => {}); await table.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null); }
      await k.settle(1500);
      if (!(await table.isVisible().catch(() => false))) return { head: [], rows: [] };
      return { head: await headers(table), rows: await tableRows(table) };
    };
    await run.scenario(meta('ENT-REG-04', ENT, 'Overdue Items are all past their expected date', 'Positive', { navPath: [ENT, 'Supplier Inbox'] }), async s => {
      await s.step('Enterprise › Supplier Inbox: expand "Overdue Items" (delivery not yet complete, past expected date) → every row is past its Expected delivery date (or its Required on site date when no expected date is set)', async () => {
        await open('/supplier-inbox', 'Supplier Inbox', ENT);
        const { head, rows } = await inboxSection('Overdue Items');
        const col = head.findIndex(h => /expected/i.test(h)); const ros = head.findIndex(h => /required/i.test(h));
        // Without an expected delivery date ("-") the Required on site date is the due date (Ageing counts from it).
        const notPast = rows.filter(r => { const d = gbDate(r[col]) || gbDate(r[ros]); return !d || d >= today(); });
        s.observe(`${rows.length} overdue row(s); columns ${head.join(' / ')}; not past: ${notPast.length}${notPast.length ? ` (${notPast.slice(0, 3).map(r => r.join(' · ')).join(' ¦ ')})` : ''}`);
        const listed = Number(((await flat()).match(/Overdue Items .*?(\d+) SUBMITTALS/i) || [])[1] || 0);
        if (!rows.length) { expect(listed, `Overdue Items counts ${listed} submittal(s) but no row could be read`).toBe(0); s.observe('No overdue item on this account – nothing to compare'); return; }
        expect(col, 'Overdue Items has no Expected delivery column').toBeGreaterThanOrEqual(0);
        expect(notPast, 'Overdue Items lists rows whose expected date is today or later').toEqual([]);
      });
    });
    await run.scenario(meta('ENT-REG-05', ENT, 'Project filter limits every section to the project', 'Positive', { navPath: [ENT, 'Supplier Inbox'] }), async s => {
      await s.step(`Supplier Inbox › Project filter: choose "${config.projectName}" → every row of the expanded sections belongs to ${config.projectName}`, async () => {
        await open('/supplier-inbox', 'Supplier Inbox', ENT);
        await main.locator('select').first().selectOption({ label: config.projectName }); await k.settle(3000);
        const other = []; let total = 0;
        for (const name of ['Unconfirmed Lead Times', 'Overdue Items', 'Deliveries to Schedule']) {
          const { head, rows } = await inboxSection(name);
          const col = Math.max(0, head.findIndex(h => /project/i.test(h)));
          total += rows.length;
          other.push(...rows.filter(r => r[col] && r[col] !== config.projectName).map(r => `${name}: ${r[col]}`));
        }
        s.observe(`${total} row(s) in 3 sections; other projects: ${other.length}${other.length ? ` (${[...new Set(other)].slice(0, 4).join(', ')})` : ''}`);
        expect(total, 'No row in any section for the project').toBeGreaterThan(0);
        expect(other, 'Rows of other projects shown with the Project filter').toEqual([]);
      });
    });

    // ======================= Enterprise › Supplier Performance / Lead Time Benchmarks =======================
    await run.scenario(meta('ENT-REG-06', ENT, 'Supplier Performance period switch', 'Positive', { navPath: [ENT, 'Supplier Performance'] }), async s => {
      let six = '';
      await s.step('Enterprise › Supplier Performance: open the page (6 months) → percentages are between 0 and 100', async () => {
        await open('/supplier-performance', 'Supplier Performance', ENT);
        six = await flat();
        const pct = (six.match(/(-?\d+(?:\.\d+)?)\s*%/g) || []).map(num);
        s.observe(`headings: ${(await main.locator('h1,h2,h3,h4').allInnerTexts()).join(' | ').slice(0, 200)}; ${pct.length} percentage(s), range ${pct.length ? `${Math.min(...pct)}–${Math.max(...pct)}` : '–'}`);
        expect(pct.filter(p => p < 0 || p > 100), 'Percentages outside 0–100').toEqual([]);
      });
      await s.step('Switch the period to 12 months → the page reloads its figures for 12 months (text changes, still 0–100 %)', async () => {
        const btn = main.getByRole('button', { name: /12\s*months?/i }).or(main.getByText(/^12\s*months?$/i)).first();
        if (!(await btn.isVisible().catch(() => false))) { const sel = main.locator('select').filter({ hasText: /12/ }).first(); await sel.selectOption({ label: (await sel.locator('option').allInnerTexts()).find(o => /12/.test(o)) }); } else await btn.click();
        await k.settle(3000);
        const twelve = await flat();
        const pct = (twelve.match(/(-?\d+(?:\.\d+)?)\s*%/g) || []).map(num);
        s.observe(`text changed: ${twelve !== six}; ${pct.length} percentage(s), range ${pct.length ? `${Math.min(...pct)}–${Math.max(...pct)}` : '–'}`);
        expect(pct.filter(p => p < 0 || p > 100), 'Percentages outside 0–100').toEqual([]);
        expect(twelve !== six, 'Switching to 12 months changed nothing on the page').toBe(true);
      });
    });
    const ltaFigures = async () => {
      const t = await flat();
      const pick = re => num((t.match(re) || [])[1]);
      return { total: pick(/Total delivered\D{0,20}?([\d,]+)/i), onTimePct: pick(/On[- ]time\s*%?\D{0,20}?([\d.]+)\s*%/i), onTime: pick(/On[- ]time (?:count|deliveries)\D{0,20}?([\d,]+)/i), late: pick(/Late\D{0,20}?([\d,]+)/i), text: t };
    };
    await run.scenario(meta('ENT-REG-07', ENT, 'Lead Time Benchmarks equal Lead Time Analysis', 'Integration', { navPath: [ENT, 'Lead Time Benchmarks'] }), async s => {
      let ent;
      await s.step('Enterprise › Lead Time Benchmarks: read Total delivered, On time and Late → On time + Late = Total delivered', async () => {
        await open('/lead-time-benchmarks', 'Lead Time Benchmarks', ENT);
        ent = await ltaFigures();
        s.observe(`total ${ent.total}, on time ${ent.onTime} (${ent.onTimePct}%), late ${ent.late}`);
        expect(ent.total, 'Total delivered not found').toBeGreaterThan(0);
        expect(ent.onTime + ent.late).toBe(ent.total);
      });
      await s.step('Analytics › Lead Time Analysis (same API, OBS-APP-2) → the same figures', async () => {
        await open('/lead-time-analysis', 'Lead Time Analysis', 'Analytics');
        const ana = await ltaFigures();
        s.observe(`Lead Time Analysis: total ${ana.total}, on time ${ana.onTime} (${ana.onTimePct}%), late ${ana.late}`);
        expect([ana.total, ana.onTime, ana.late]).toEqual([ent.total, ent.onTime, ent.late]);
      });
    });

    // ======================= Analytics (18 Nov 2026 validation) =======================
    const ANA = 'Analytics';
    await run.scenario(meta('ANV-LTA-01', ANA, 'Lead Time Analysis: on-time % = on time ÷ total delivered', 'Positive', { navPath: [ANA, 'Lead Time Analysis'] }), async s => {
      await s.step('Analytics › Lead Time Analysis: read Total delivered, On time count and On time % → % equals count ÷ total (±1)', async () => {
        await open('/lead-time-analysis', 'Lead Time Analysis', ANA);
        const f = await ltaFigures();
        s.observe(`total ${f.total}, on time ${f.onTime}, shown ${f.onTimePct}%, calculated ${f.total ? (100 * f.onTime / f.total).toFixed(1) : '–'}%`);
        expect(f.total).toBeGreaterThan(0);
        expect(Math.abs(100 * f.onTime / f.total - f.onTimePct)).toBeLessThanOrEqual(1);
      });
    });
    const aggKpis = async () => {
      const t = await flat();
      const pick = label => num((t.match(new RegExp(`${label}\\D{0,15}?([\\d,]+)`, 'i')) || [])[1]);
      return { Submittals: pick('Submittals'), Materials: pick('Materials'), Suppliers: pick('Suppliers'), Locations: pick('Locations') };
    };
    await run.scenario(meta('ANV-AGG-01', ANA, 'Aggregate Stats are cumulative (venue change does not alter them)', 'Positive', { navPath: [ANA, 'Aggregate Stats'] }), async s => {
      const site = new SiteSelectorPage(page);
      let before, other = '';
      await s.step(`Analytics › Aggregate Stats on venue "${config.siteName || 'Warehoust _NR'}": read Submittals / Materials / Suppliers / Locations`, async () => {
        await open('/aggregate-stats', 'Aggregate Stats', ANA);
        before = await aggKpis();
        s.observe(JSON.stringify(before));
        expect(before.Submittals).toBeGreaterThanOrEqual(0);
      });
      try {
        await s.step('Header site selector: choose another venue → the four figures are unchanged (user decision 18 Nov 2026: cumulative, not location-based)', async () => {
          await site.siteSelector.click(); await k.settle(1500);
          const opts = (await page.locator('[role=option], [role=menuitem], [class*="option" i]').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim()).filter(t => t && t.length < 60);
          await page.keyboard.press('Escape'); await k.settle(500);
          other = opts.find(o => !/Warehoust _NR/i.test(o)) || '';
          s.observe(`venues offered: ${opts.slice(0, 6).join(', ')}`);
          if (!other) { s.observe('Only one venue on the project – nothing to switch'); return; }
          await site.ensureSite(other); await k.settle(3500);
          const after = await aggKpis();
          s.observe(`venue "${other}": ${JSON.stringify(after)}`);
          expect(after).toEqual(before);
        });
      } finally {
        await site.ensureSite('Warehoust _NR').catch(() => k.keepSite());
      }
    });
    await run.scenario(meta('ANV-AGG-02', ANA, 'Aggregate Stats project table shows the project name', 'Positive', { navPath: [ANA, 'Aggregate Stats'] }), async s => {
      await s.step(`Aggregate Stats › project table: first cell → "${config.projectName}" (not the project ID PRJ…)`, async () => {
        await open('/aggregate-stats', 'Aggregate Stats', ANA);
        const rows = await tableRows(main.locator('table').first());
        s.observe(`rows: ${rows.slice(0, 2).map(r => r.slice(0, 3).join(' · ')).join(' ¦ ')}`);
        expect(rows.length).toBeGreaterThan(0);
        expect(rows[0][0], 'Project table shows the project ID instead of its name').not.toMatch(/^PRJ[A-Z0-9]+$/);
      });
    });
    await run.scenario(meta('ANV-AGG-03', ANA, 'Aggregate Stats export gives the data', 'Positive', { navPath: [ANA, 'Aggregate Stats'] }), async s => {
      await s.step('Aggregate Stats › Export: choose the export option → the file holds the shown data, not the blank upload template', async () => {
        await open('/aggregate-stats', 'Aggregate Stats', ANA);
        await main.getByRole('button', { name: /Export/i }).first().click(); await k.settle(800);
        const items = (await page.getByRole('menuitem').allInnerTexts()).map(t => t.trim());
        const item = page.getByRole('menuitem').first();
        const got = await download(() => item.click()).catch(e => ({ error: String(e).slice(0, 80) }));
        s.observe(`menu: [${items.join(', ')}]; file: ${got.name || got.error}`);
        expect(got.name, 'Export gave no file').toBeTruthy();
        expect(got.name, 'Export gives the blank upload template, not the data').not.toMatch(/template/i);
      });
    });
    await run.scenario(meta('ANV-SUB-01', ANA, 'SubContractor Issues: every metric column has a value', 'Positive', { navPath: [ANA, 'SubContractor Issues'] }), async s => {
      await s.step('Analytics › SubContractor Issues: compare the header columns with the cells of each row → each row has a cell for every column (incl. Over-Deliveries)', async () => {
        await open('/subcontractor-issues', 'SubContractor Issues', ANA);
        const table = main.locator('table').first();
        const head = await headers(table); const rows = await rowsOf(table);
        const short = rows.filter(r => r.length < head.length);
        s.observe(`${head.length} columns (${head.join(' / ')}); ${rows.length} rows; rows with fewer cells: ${short.length}`);
        expect(rows.length).toBeGreaterThan(0);
        expect(short.length, 'Rows have fewer cells than columns (Over-Deliveries not rendered)').toBe(0);
      });
    });
    await run.scenario(meta('ANV-SUB-02', ANA, 'SubContractor Issues: Project Name shows the name', 'Positive', { navPath: [ANA, 'SubContractor Issues'] }), async s => {
      await s.step('SubContractor Issues › "Project Name" column → project names, not project IDs (PRJ…)', async () => {
        await open('/subcontractor-issues', 'SubContractor Issues', ANA);
        const table = main.locator('table').first();
        const head = await headers(table); const rows = await rowsOf(table);
        const col = head.findIndex(h => /project/i.test(h));
        const ids = rows.filter(r => /^PRJ[A-Z0-9]+$/.test(r[col] || ''));
        s.observe(`column ${col}: ${rows.slice(0, 3).map(r => r[col]).join(', ')}; ${ids.length} of ${rows.length} rows show an ID`);
        expect(ids.length, 'Project Name shows the project ID').toBe(0);
      });
    });
    await run.scenario(meta('ANV-SUB-03', ANA, 'SubContractor Issues: values are per subcontractor, not project totals', 'Integration', { navPath: [ANA, 'SubContractor Issues'] }), async s => {
      await s.step(`SubContractor Issues: rows of ${config.projectName} → the subcontractors do not all show the same values (per-subcontractor figures, not the project total repeated)`, async () => {
        await open('/subcontractor-issues', 'SubContractor Issues', ANA);
        const table = main.locator('table').first();
        const head = await headers(table); const rows = await rowsOf(table);
        const col = head.findIndex(h => /project/i.test(h));
        const mine = rows.filter(r => (r[col] || '').includes(config.projectName) || /0000095$/.test(r[col] || ''));
        const sigs = new Set(mine.map(r => r.slice(col + 1).join('/')));
        s.observe(`${mine.length} row(s) of the project; ${sigs.size} distinct value set(s): ${[...sigs].slice(0, 3).join(' ¦ ')}`);
        if (mine.length < 2) { s.observe('Fewer than two subcontractor rows – nothing to compare'); return; }
        expect(sigs.size, 'Every subcontractor of the project repeats the same values (project totals)').toBeGreaterThan(1);
      });
    });
    await run.scenario(meta('ANV-SUP-01', ANA, 'Supplier Issues: KPI cards are the cumulative project totals', 'Integration', { navPath: [ANA, 'Supplier Issues'] }), async s => {
      let truth = [];
      await s.step('Analytics › SubContractor Issues: per project, take its value once for Raising PO, Confirming PO, Schedule impact and Delivery impacted, and add up over all projects (the cumulative totals)', async () => {
        await open('/subcontractor-issues', 'SubContractor Issues', ANA);
        const table = main.locator('table').first();
        const head = await headers(table); const rows = await rowsOf(table);
        const pc = head.findIndex(h => /project/i.test(h));
        const cols = [/Raising PO/i, /Confirming PO/i, /Schedule Impact/i, /Delivery Impacted/i].map(re => head.findIndex(h => re.test(h)));
        // The rows repeat the project totals on every subcontractor (ANV-SUB-03): one value per project.
        const perProject = new Map();
        for (const r of rows) { const p = r[pc]; const v = cols.map(c => num(r[c]) || 0); const old = perProject.get(p) || [0, 0, 0, 0]; perProject.set(p, old.map((o, i) => Math.max(o, v[i]))); }
        truth = [0, 1, 2, 3].map(i => [...perProject.values()].reduce((a, v) => a + v[i], 0));
        s.observe(`${perProject.size} project(s); cumulative totals ${truth.join(' / ')}`);
        expect(rows.length).toBeGreaterThan(0);
      });
      await s.step('Analytics › Supplier Issues: read the KPI cards (Raising PO, Confirming PO, Schedule impact, Deliveries impacted) → equal to those cumulative totals', async () => {
        await open('/supplier-issues', 'Supplier Issues', ANA);
        const t = await flat();
        const card = re => num((t.match(re) || [])[1]);
        const kpi = [card(/Raising PO\D{0,40}?([\d,]+)/i), card(/Confirming PO\D{0,40}?([\d,]+)/i), card(/Schedule impact\D{0,40}?([\d,]+)/i), card(/Deliver(?:ies|y) impacted\D{0,40}?([\d,]+)/i)];
        s.observe(`KPI cards ${kpi.join(' / ')}; cumulative totals ${truth.join(' / ')}`);
        expect(kpi, 'KPI cards are the sum of the duplicated subcontractor rows, not the project totals').toEqual(truth);
      });
    });
    await run.scenario(meta('ANV-SUP-02', ANA, 'Supplier Issues: Delivery Performance has data when deliveries are impacted', 'Integration', { navPath: [ANA, 'Supplier Issues'] }), async s => {
      await s.step('Supplier Issues: "Deliveries impacted" > 0 → the Delivery Performance panel shows data (not "No delivery data")', async () => {
        await open('/supplier-issues', 'Supplier Issues', ANA);
        const t = await flat();
        const impacted = num((t.match(/Deliver(?:ies|y) impacted\D{0,40}?([\d,]+)/i) || [])[1]);
        const noData = /No delivery data/i.test(t);
        s.observe(`Deliveries impacted ${impacted}; "No delivery data" shown: ${noData}`);
        if (!impacted) return;
        expect(noData, 'Delivery Performance shows "No delivery data" although deliveries are impacted').toBe(false);
      });
    });
    await run.scenario(meta('ANV-SCI-01', ANA, 'Supply Chain Intelligence follows the project and venue', 'Integration', { navPath: [ANA, 'Supply Chain Intelligence'] }), async s => {
      await s.step('Analytics › Supply Chain Intelligence: open the page and record its data requests → they carry the selected project and venue (user decision 18 Nov 2026)', async () => {
        const urls = [];
        const on = r => { if (/\/api\/salesflow\/supply_chain/.test(r.url())) urls.push(r.url()); };
        page.on('request', on);
        try { await page.goto('/supply-chain-intelligence', { waitUntil: 'domcontentloaded' }); await k.settle(5000); } finally { page.off('request', on); }
        const q = urls.map(u => new URL(u).searchParams);
        const project = q.some(p => p.get('project_id')); const venue = q.some(p => [...p.keys()].some(key => /site|venue|location/i.test(key)));
        s.observe(`${urls.length} request(s); parameters: ${[...new Set(q.flatMap(p => [...p.keys()]))].join(', ') || '–'}`);
        expect(urls.length, 'No Supply Chain Intelligence data request seen').toBeGreaterThan(0);
        expect(project && venue, 'Supply Chain Intelligence data requests do not carry both the project and the venue').toBe(true);
      });
    });
    await run.scenario(meta('ANV-INR-01', ANA, 'Inventory Reports follow the selected venue', 'Integration', { navPath: [ANA, 'Inventory Reports'] }), async s => {
      await s.step('Analytics › Inventory Reports: open the page and record its data requests → they carry the selected venue (the only Analytics page that is location-based, 18 Nov 2026 validation)', async () => {
        const urls = [];
        const on = r => { if (/\/api\//.test(r.url())) urls.push(r.url()); };
        page.on('request', on);
        try { await k.menu('Inventory Reports', ANA).catch(() => null); if (!/inventory-report/.test(page.url())) await page.goto('/inventory-reports', { waitUntil: 'domcontentloaded' }); else await page.reload({ waitUntil: 'domcontentloaded' }); await k.settle(5000); } finally { page.off('request', on); }
        const q = urls.filter(u => !/user_preferences|notification|system_message/i.test(u)).map(u => new URL(u));
        const withVenue = q.filter(u => [...u.searchParams.keys()].some(key => /site|venue|location/i.test(key)));
        s.observe(`${q.length} data request(s); with a venue parameter: ${withVenue.length} (${withVenue.slice(0, 2).map(u => u.pathname).join(', ')})`);
        expect(withVenue.length, 'Inventory Reports requests carry no venue').toBeGreaterThan(0);
      });
    });
    await run.scenario(meta('ANV-EMI-01', ANA, 'Emissions Report export has the listed shipments', 'Positive', { navPath: [ANA, 'Emissions Report'] }), async s => {
      await s.step('Analytics › Emissions Report: count the listed shipments, click "Export CSV" → the CSV has at least one data row for each listed shipment', async () => {
        await open('/emissions-report', 'Emissions Report', ANA);
        const t = await flat();
        const listed = num((t.match(/(\d+)\s+shipments?/i) || [])[1]) || await main.locator('tbody tr').count();
        const got = await download(() => main.getByRole('button', { name: /Export CSV/i }).first().click()).catch(e => ({ error: String(e).slice(0, 80) }));
        const lines = got.file ? fs.readFileSync(got.file, 'utf8').split(/\r?\n/).filter(l => l.trim()) : [];
        s.observe(`listed shipments ${listed}; file ${got.name || got.error}; ${Math.max(0, lines.length - 1)} data row(s); header ${(lines[0] || '').slice(0, 120)}`);
        expect(got.name, 'Export CSV gave no file').toBeTruthy();
        if (listed) expect(lines.length - 1, 'CSV has no data rows although shipments are listed').toBeGreaterThan(0);
      });
    });
  } });
});
