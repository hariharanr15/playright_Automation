// Building blocks for the end-to-end smoke (tests/pm-flow/e2e-smoke.spec.js). Reuses the Procurement Log kit (pl-flow.js),
// the PM navigator / workbook writer and the invited-user page object; Project Management specs are not changed.
// Behaviour observed on staging 11 Nov 2026 (read-only probes):
// - Add Supplier creates an organisation record without a login; a subcontractor is Add Supplier with isSubcontractor ticked.
// - Invite Users › Organization lists existing organisations only; a new supplier is not among them, and the row action
//   "Promote to SSO Organisation" sends no request (SCP-DEF-048). A user invited WITHOUT an organisation must create a
//   new SSO organisation on first sign-in; the smoke therefore invites into an existing organisation (normal user).
// - A Supplier/Subcontractor user of organisation "Voyage Control" sees every submittal of the project.
// - Map Material › Add Data › Choose Material lists every material newest first, without a search box.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { expect } = require('@playwright/test');
const { plKit } = require('./pl-flow');
const { OVERLAY } = require('./pm-navigator');
const { writeUpload } = require('./pm-workbook');
const { readWorkbook } = require('../../../utils/bulk-upload/inventory-workbook');
const { LoginPage } = require('../../../pages/login.page');
const { PlatformChooserPage } = require('../../../pages/platform-chooser.page');
const { ProjectSelectorPage } = require('../../../pages/project-selector.page');
const { SiteSelectorPage } = require('../../../pages/site-selector.page');
const { InvitedUserActivationPage } = require('../../../pages/project-management/invited-user-activation.page');

const esc = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = value => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
const ddmmyyyy = date => date.toLocaleDateString('en-GB');

function e2eKit(page, { config, navigator, outDir }) {
  const k = plKit(page);
  const { main, listbox, settle, toast } = k;
  const layers = () => page.locator(OVERLAY).filter({ visible: true });
  // System Message banners ("Project notice" / "Platform-wide") also have role status; they are not toasts.
  const anyToast = async () => clean((await page.getByRole('status').allInnerTexts().catch(() => [])).filter(text => !/^\s*(Project notice|Platform-wide)/i.test(text)).join(' | '));
  const button = (name, scope = main) => scope.getByRole('button', { name, exact: true }).first();
  // Searches a list only after it has loaded (a late load replaced an early search result on 11 Nov), then waits for the row.
  // Returns false when the row does not appear within 8 s (used to check whether a record already exists).
  const searchList = async (box, countPattern, term, row) => {
    await expect.poll(async () => countPattern.test(await main.innerText().catch(() => '')), { timeout: 30000, message: 'List loaded' }).toBe(true);
    await settle(800);
    await box.fill(term); await box.press('Enter').catch(() => null);
    return expect.poll(() => row.count(), { timeout: 8000 }).toBeGreaterThan(0).then(() => true, () => false);
  };

  // Opens a top-level page through the left menu; falls back to its route only when the menu entry cannot be used.
  const openPage = async (route, name, group) => {
    await page.keyboard.press('Escape').catch(() => null);
    if (new URL(page.url()).pathname.replace(/\/+$/, '') === route) return;
    await k.menu(name, group).catch(() => null);
    if (new URL(page.url()).pathname.replace(/\/+$/, '') !== route) await page.goto(route, { waitUntil: 'domcontentloaded' });
    await settle(1500);
  };

  const kit = {
    k, esc, norm, clean, ddmmyyyy, anyToast,
    // Waits until a form has finished re-rendering: network idle, then the input keeps the same DOM node and value
    // for 1.5 s (up to 10 s).
    async formQuiet(input) {
      await settle(500);
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        const handle = await input.elementHandle({ timeout: 5000 }).catch(() => null);
        const before = handle ? await handle.evaluate(e => e.value).catch(() => null) : null;
        await page.waitForTimeout(1500);
        const same = handle ? await handle.evaluate(e => e.isConnected).catch(() => false) : false;
        if (same && before === await handle.evaluate(e => e.value).catch(() => null)) return;
      }
    },

    // ---------------- Landing / session ----------------
    async availableProjects() { return new ProjectSelectorPage(page, config).availableProjects(); },
    async header() {
      const project = await new ProjectSelectorPage(page, config).activeProjectName();
      const site = await new SiteSelectorPage(page).activeSiteName();
      return { project, site };
    },
    // Role the signed-in account holds on the configured project (from the session the app stores).
    async projectRole() {
      const projects = await new ProjectSelectorPage(page, config).sessionProjects();
      return projects.find(p => norm(p.name) === norm(config.projectName))?.role?.name || null;
    },

    // ---------------- Management Dashboard ----------------
    async readDashboard(categories = []) {
      await openPage('/management-dashboard', 'Management Dashboard');
      const tab = main.getByRole('button', { name: /^Dashboard$/ }).first();
      if (await tab.isVisible().catch(() => false)) await tab.click();
      await expect.poll(async () => /OPEN SUBMITTALS/i.test(await main.innerText()), { timeout: 30000, message: 'Dashboard tiles load' }).toBe(true);
      await settle(1500);
      const text = await main.innerText();
      const open = text.match(/OPEN SUBMITTALS\s*(\d+)\s*of\s*(\d+)/i);
      const onTime = text.match(/(\d+)\s+of\s+(\d+)\s+deliveries/i);
      const inScope = text.match(/MATERIAL CATEGORIES IN SCOPE\s*(\d+)/i);
      const statusBlock = (text.match(/Submittals by status[\s\S]*?\n\s*Delivered\s*\n([\s\S]*?)\n\s*MATERIALS/i) || [])[1] || '';
      const statusNumbers = (statusBlock.match(/^\s*\d+\s*$/gm) || []).map(Number);
      const statusNames = ['Not Ordered', 'Not Ordered At Risk', 'Ordered', 'Ordered At Risk', 'Partial Delivery', 'Delivered'];
      const byStatus = statusNumbers.length === statusNames.length ? Object.fromEntries(statusNames.map((n, i) => [n, statusNumbers[i]])) : null;
      const categoryRows = {};
      // '*' reads every category row of the Materials table (the baseline does not know the categories yet).
      if (categories === '*') {
        const all = await main.locator('tr').filter({ has: page.locator('td') }).evaluateAll(rs => rs.map(r => [...r.cells].map(c => c.innerText.replace(/\s+/g, ' ').trim())));
        for (const cells of all.filter(c => c.length >= 9 && /\d+\s*\/\s*\d+/.test(c[1] || ''))) {
          const [openCount, total] = cells[1].split('/').map(v => Number(v.trim()));
          categoryRows[cells[0]] = { cells, open: openCount, total, spend: Number((cells[7] || '').replace(/[^\d.-]/g, '')), currency: (cells[7] || '').replace(/[\d.,\s-]/g, ''), alerts: cells[8] };
        }
        categories = [];
      }
      for (const category of [].concat(categories).filter(Boolean)) {
        const row = main.locator('tr').filter({ has: page.locator('td:first-child', { hasText: new RegExp(`^\\s*${esc(category)}\\s*$`, 'i') }) }).first();
        if (await row.count()) {
          const cells = (await row.locator('td').allInnerTexts()).map(clean);
          const [openCount, total] = (cells[1] || '').split('/').map(v => Number(v.trim()));
          categoryRows[category] = { cells, open: openCount, total, spend: Number((cells[7] || '').replace(/[^\d.-]/g, '')), currency: (cells[7] || '').replace(/[\d.,\s-]/g, ''), alerts: cells[8] };
        } else categoryRows[category] = { cells: [], open: 0, total: 0, spend: 0, currency: '', absent: true };
      }
      return { categoriesInScope: inScope ? Number(inScope[1]) : null, open: open ? Number(open[1]) : null, total: open ? Number(open[2]) : null, deliveriesOnTime: onTime ? Number(onTime[1]) : null,
        deliveriesWithDate: onTime ? Number(onTime[2]) : null, byStatus, statusRaw: statusNumbers, categories: categoryRows };
    },
    // Unread count shown inside the Alerts / Notifications / Tasks tab ("336 alerts").
    async inboxCount(tab) {
      await openPage('/management-dashboard', 'Management Dashboard');
      const control = main.getByRole('button', { name: new RegExp(`^${tab}(\\s+\\d+\\+?)?$`) }).or(main.getByRole('tab', { name: new RegExp(`^${tab}`) })).last(); // the dashboard's "Urgent issues" strip also has an "Alerts <n>" pill above the tabs (23 Nov 2026 release)
      await control.click(); await settle(2500);
      const label = main.getByText(new RegExp(`^\\s*\\d+\\s+${tab}\\s*$`, 'i')).first();
      await expect(label, `${tab} count`).toBeVisible({ timeout: 20000 });
      return Number((await label.innerText()).match(/\d+/)[0]);
    },
    // Rows of the Alerts / Notifications / Tasks tab (first pages, newest first) that match `pattern`.
    async inboxRows(tab, pattern, { pages = 3 } = {}) {
      await openPage('/management-dashboard', 'Management Dashboard');
      const control = main.getByRole('button', { name: new RegExp(`^${tab}(\\s+\\d+\\+?)?$`) }).or(main.getByRole('tab', { name: new RegExp(`^${tab}`) })).last(); // the dashboard's "Urgent issues" strip also has an "Alerts <n>" pill above the tabs (23 Nov 2026 release)
      await control.click(); await settle(2500);
      await expect(main.getByText(new RegExp(`\\d+\\s+${tab}`, 'i')).first(), `${tab} list`).toBeVisible({ timeout: 20000 });
      const found = [];
      for (let p = 1; p <= pages; p += 1) {
        if (p > 1) {
          const next = main.getByRole('button', { name: String(p), exact: true }).last();
          if (!(await next.isVisible().catch(() => false))) break;
          await next.click(); await settle(1500);
        }
        const rows = (await main.locator('tbody tr').allInnerTexts()).map(clean);
        found.push(...rows.filter(r => pattern.test(r)).map(text => ({ text, page: p })));
      }
      if (pages > 1) { const first = main.getByRole('button', { name: '1', exact: true }).last(); if (await first.isVisible().catch(() => false)) { await first.click(); await settle(800); } }
      return found;
    },

    // ---------------- Material Master ----------------
    // Project Management › Reference Data › Material Category › "Add Material Category" (Name*, Add). Returns the created
    // row and the id the API returned when it exposes one. Not created again when the name already exists.
    async createCategory(name) {
      if (await kit.categoryExists(name)) return { created: false };
      await navigator.open('Material Category');
      await button('Add Material Category').click();
      const form = navigator.overlay();
      await expect(form, 'Add Material Category form').toBeVisible({ timeout: 10000 });
      const response = page.waitForResponse(r => r.request().method() === 'POST' && /categor/i.test(r.url()), { timeout: 20000 }).catch(() => null);
      await form.locator('input:not([type="checkbox"]):not([type="hidden"])').first().fill(name);
      await form.getByRole('button', { name: 'Add', exact: true }).click();
      const res = await response;
      let id = null;
      if (res) { const body = await res.json().catch(() => null); id = body && (body.id || body.data?.id || body.result?.id || null); }
      await expect(navigator.overlay(), 'Add Material Category form closed').toBeHidden({ timeout: 15000 }).catch(() => null);
      await settle(1000);
      return { created: true, id, status: res ? res.status() : null };
    },
    // Category row "Material Category Name | Created At" for the name (null when absent).
    async categoryRow(name) {
      await navigator.open('Material Category');
      const box = main.getByPlaceholder('Search categories…');
      await box.fill(name); await page.waitForTimeout(1500); await settle(500);
      const rows = (await main.locator('tbody tr').evaluateAll(rs => rs.map(r => [...r.cells].map(c => c.innerText.trim())))).filter(r => r.length > 1 && norm(r[0]) === norm(name));
      await box.fill(''); await page.waitForTimeout(800);
      return { count: rows.length, cells: rows[0] || null };
    },
    // Project Management › Reference Data › Material Category: search the category (the Add Material form is never opened).
    async categoryExists(category) {
      await navigator.open('Material Category');
      const box = main.getByPlaceholder('Search categories…');
      await expect(box, 'Material Category search').toBeVisible({ timeout: 20000 });
      await box.fill(category); await page.waitForTimeout(1500); await settle(500);
      const rows = (await main.locator('tbody tr').evaluateAll(rs => rs.map(r => [...r.cells].map(c => c.innerText.trim())))).filter(r => r.length > 1);
      const hit = rows.find(cells => cells.some(c => norm(c) === norm(category)));
      await box.fill(''); await page.waitForTimeout(800);
      return hit ? hit.find(c => norm(c) === norm(category)) : null;
    },
    async downloadMaterialTemplate() {
      await navigator.open('Material Master');
      await button('Upload').click();
      const [file] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.getByText('Download Template', { exact: true }).first().click()]);
      const target = path.join(outDir, 'downloads', `${Date.now()}-${file.suggestedFilename()}`);
      await file.saveAs(target);
      await page.keyboard.press('Escape'); await page.mouse.click(5, 300);
      const book = readWorkbook(target);
      const uoms = (book._Lists || []).map(row => clean(Object.values(row)[0])).filter(Boolean);
      return { path: target, name: file.suggestedFilename(), sheets: Object.keys(book), uoms };
    },
    async materialRows(term) {
      await navigator.open('Material Master');
      const box = main.getByPlaceholder('Search materials…');
      await box.fill(term); await page.waitForTimeout(1500); await settle(500);
      // Columns: expand, Category, Material ID, Name, Parent, UOM, Items.
      return main.locator('tbody tr').evaluateAll(rows => rows.map(r => [...r.cells].map(c => c.innerText.trim())));
    },
    async findMaterial(name) {
      const rows = await kit.materialRows(name);
      const row = rows.find(cells => norm(cells[3]) === norm(name));
      return row ? { category: row[1], id: row[2], name: row[3], uom: row[5], cells: row } : null;
    },
    // Upload File → Upload Confirmation → progress dialog → result. An unknown-category prompt is answered with "Reject all"
    // (the smoke uses an existing category, so a prompt means the category was not recognised).
    async uploadMaterials({ template, rows, tag }) {
      const file = writeUpload({ template, sheet: 'Materials', rows, output: path.join(outDir, 'uploads', `e2e-material-${tag}.xlsx`) });
      await navigator.open('Material Master');
      await button('Upload').click();
      const chooser = page.waitForEvent('filechooser', { timeout: 15000 });
      await page.getByText('Upload File', { exact: true }).last().click();
      await (await chooser).setFiles(file);
      await page.waitForTimeout(2500);
      const seen = [];
      const confirmation = () => layers().filter({ hasText: 'Upload Confirmation' }).last();
      const progress = () => layers().filter({ hasText: /bulk upload/i }).last();
      if (await confirmation().isVisible().catch(() => false)) {
        seen.push('Upload Confirmation');
        await confirmation().getByRole('button', { name: 'Upload', exact: true }).click();
        await expect(confirmation()).toBeHidden({ timeout: 15000 });
      }
      await expect(progress(), 'Material bulk upload progress').toBeVisible({ timeout: 30000 });
      for (let round = 0; round < 3; round += 1) {
        await expect.poll(async () => {
          const now = await progress().innerText().catch(() => '');
          if (/Total rows/i.test(now) || /upload failed|no changes were saved/i.test(now)) return 'done';
          // "Waiting for your input (nothing to decide)" is a finished stage, not a prompt (same pattern as pm-regression-part2).
          return /Waiting for your input \(\d/i.test(now) ? 'decide' : 'running';
        }, { timeout: 180000, message: 'Upload finished or waiting for a decision' }).not.toBe('running');
        const now = await progress().innerText();
        if (/Total rows/i.test(now) || !/Waiting for your input \(\d/i.test(now)) break;
        seen.push(`prompt: ${clean((now.match(/Waiting for your input[\s\S]{0,200}/) || [''])[0])}`);
        for (const link of await progress().getByText('Reject all', { exact: true }).all()) if (await link.isVisible().catch(() => false)) await link.click();
        await progress().getByRole('button', { name: 'Continue', exact: true }).click();
        await page.waitForTimeout(2000);
      }
      const text = clean(await progress().innerText());
      const summary = (text.match(/Total rows.*$/) || text.match(/Upload failed.*$/) || [text.slice(-200)])[0].replace(/\s*(Download error file\s*)?Close$/, '');
      await progress().getByRole('button', { name: 'Close', exact: true }).last().click();
      await expect(progress()).toBeHidden({ timeout: 10000 });
      return { file: path.basename(file), seen, summary };
    },

    // ---------------- Supplier List ----------------
    openSuppliers: () => openPage('/supplier-list', 'Supplier List', 'User Management'),
    async supplierRow(name) {
      await navigator.clearLayers(); // the Map Material panel stays open on the same route
      await kit.openSuppliers();
      // Add Supplier is an inline form on the page (not a dialog) and hides the list while open: cancel it first.
      const form = page.locator('form').filter({ has: page.locator('input[name="supplierName"]') });
      if (await form.first().isVisible().catch(() => false)) { await form.last().getByRole('button', { name: 'Cancel', exact: true }).click(); await settle(800); }
      // Match the Supplier Name cell exactly (hasText regexes run on textContent, which has no separators between cells).
      const row = k.rows().filter({ has: page.getByRole('cell', { name, exact: true }) }).first();
      if (!(await searchList(page.getByRole('textbox', { name: /Search suppliers/ }), /\d+ suppliers?/, name, row))) return null;
      const heads = (await main.getByRole('columnheader').allInnerTexts()).map(clean);
      const cells = (await row.getByRole('cell').allInnerTexts()).map(clean);
      return { row, values: Object.fromEntries(heads.map((h, i) => [h, cells[i]])) };
    },
    // Creates the supplier unless it already exists (a retry after a missed toast must not create a second one).
    async ensureSupplier({ name, email, subcontractor = false, tag }) {
      const existing = await kit.supplierRow(name);
      if (existing) return { created: false, ...existing.values };
      await button('Add Supplier').click();
      const f = page.locator('form').filter({ has: page.locator('input[name="supplierName"]') }).last();
      await expect(f).toBeVisible({ timeout: 10000 });
      // The form re-renders (and clears typed values) shortly after it opens and again when "Is Sub-Contractor" is switched
      // (seen 11 Nov): settle first, switch the subcontractor box first, then fill and confirm every value stuck.
      await settle(1500);
      // Normal supplier (12 Nov 2026 rule): "Is Sub-Contractor" must be OFF when the form opens; it is never touched.
      if (!subcontractor) await expect(f.locator('input[name="isSubcontractor"]'), '"Is Sub-Contractor" OFF on the new form').not.toBeChecked();
      if (subcontractor) {
        // The checkbox input is hidden behind a switch: click the switch (input's parent), then its label as a fallback.
        const box = f.locator('input[name="isSubcontractor"]');
        for (const target of [box.locator('xpath=..'), f.getByText(/Is Sub-?Contractor/i).first()]) {
          if (await box.isChecked()) break;
          await target.click().catch(() => null);
          await page.waitForTimeout(800);
        }
        await expect(box, '"Is Sub-Contractor" switched on').toBeChecked();
        await settle(1000);
      }
      const values = [['supplierName', name], ['line1', '1 Test Street'], ['townCity', 'Chennai'], ['stateRegion', 'Tamil Nadu'],
        ['zipcode', '600001'], ['country', 'India'], ['contactPerson', `Contact ${tag}`], ['contactEmail', email], ['contactPhone', '9876543210']];
      const lost = async () => { const out = []; for (const [field, value] of values) if ((await f.locator(`input[name="${field}"]`).inputValue()) !== value) out.push(field); return out; };
      // Each value is typed exactly once (12 Nov 2026 requirement: the form data was entered twice before). The form is
      // first given time to finish its own re-render: network idle and the name input unchanged for 1.5 s.
      await kit.formQuiet(f.locator('input[name="supplierName"]'));
      for (const [field, value] of values) await f.locator(`input[name="${field}"]`).fill(value);
      await page.waitForTimeout(1200);
      const cleared = await lost();
      // A late re-render that clears values fails this attempt; it is not typed again in the same form.
      if (cleared.length) throw new Error(`Add Supplier form cleared ${cleared.join(', ')} after entry; not re-entered (the retry reopens the form after checking the supplier does not exist)`);
      let trade = null;
      if (subcontractor) {
        await expect(f.locator('input[name="isSubcontractor"]')).toBeChecked();
        // A subcontractor also needs "Trade / Discipline" (a select shown once the switch is on).
        const select = f.getByText(/Trade \/ Discipline/i).first().locator('xpath=following::select[1]');
        const options = (await select.locator('option').allInnerTexts()).map(clean).filter(o => o && !/^--/.test(o));
        trade = options.find(o => norm(o) === norm(process.env.SCP_E2E_TRADE || 'Electrical')) || options[0];
        expect(trade, 'A Trade / Discipline option exists').toBeTruthy();
        await select.selectOption({ label: trade });
      }
      // Verified again immediately before the single Save click: a normal supplier is never saved as a subcontractor.
      if (!subcontractor) await expect(f.locator('input[name="isSubcontractor"]'), '"Is Sub-Contractor" still OFF before Save').not.toBeChecked();
      await f.getByRole('button', { name: 'Save', exact: true }).click();
      await toast(/added successfully/i);
      let row = null;
      await expect.poll(async () => (row = await kit.supplierRow(name)) !== null, { timeout: 20000, message: `${name} listed after saving` }).toBe(true);
      if (trade) row.values.Trade = trade;
      return { created: true, ...row.values };
    },
    async openSupplierMenu(name, item) {
      const found = await kit.supplierRow(name);
      expect(found, `${name} in Supplier List`).toBeTruthy();
      await found.row.locator('img[alt="Menu"]').click();
      await page.getByRole('menuitem', { name: item }).click();
      await settle(1000);
    },
    // Map Material panel rows of the supplier (Material ID, Material Name, Lead Time in Weeks).
    async mappedMaterials(name) {
      await kit.openSupplierMenu(name, 'Map Material');
      await expect(page.getByRole('button', { name: 'Add Item Mapping' })).toBeVisible({ timeout: 15000 });
      const panel = page.getByRole('button', { name: 'Add Item Mapping' }).locator('xpath=ancestor::div[.//table][1]');
      return (await panel.locator('tbody tr').allInnerTexts()).map(clean).filter(t => t && !/No data available/i.test(t));
    },
    // Maps several materials with ONE opening of the supplier's Map Material panel: each missing material is added through
    // "Add Item Mapping", the rows are read from the same panel and the panel is closed once at the end.
    async ensureMappings({ supplier, items }) {
      const rows = await kit.mappedMaterials(supplier);
      const panel = page.getByRole('button', { name: 'Add Item Mapping' }).locator('xpath=ancestor::div[.//table][1]');
      const read = async () => (await panel.locator('tbody tr').allInnerTexts()).map(clean).filter(t => t && !/No data available/i.test(t));
      const added = [];
      for (const { material, weeks } of items) {
        if (rows.some(r => norm(r).includes(norm(material)))) continue;
        await page.getByRole('button', { name: 'Add Item Mapping' }).click();
        const form = layers().filter({ hasText: 'Add Data' }).last();
        await expect(form).toBeVisible({ timeout: 10000 });
        await form.getByRole('button', { name: 'Choose Material' }).click();
        await listbox().getByRole('option', { name: material, exact: true }).first().click();
        await form.getByText('Lead Time (Weeks)', { exact: false }).locator('xpath=following::input[1]').fill(String(weeks));
        await form.getByRole('button', { name: 'SUBMIT', exact: true }).click();
        await expect(form, 'Add Data form closes after SUBMIT').toBeHidden({ timeout: 15000 });
        await expect.poll(async () => (await read()).some(r => norm(r).includes(norm(material))), { timeout: 20000, message: `${material} mapped` }).toBe(true);
        added.push(material);
      }
      const final = await read();
      await page.keyboard.press('Escape');
      return { added, rows: final };
    },
    async ensureMapping({ supplier, material, leadTimeWeeks = 1 }) {
      const before = await kit.mappedMaterials(supplier);
      if (before.some(r => norm(r).includes(norm(material)))) return { created: false, rows: before };
      await page.getByRole('button', { name: 'Add Item Mapping' }).click();
      const form = layers().filter({ hasText: 'Add Data' }).last();
      await expect(form).toBeVisible({ timeout: 10000 });
      await form.getByRole('button', { name: 'Choose Material' }).click();
      await listbox().getByRole('option', { name: material, exact: true }).first().click();
      await form.getByText('Lead Time (Weeks)', { exact: false }).locator('xpath=following::input[1]').fill(String(leadTimeWeeks));
      await form.getByRole('button', { name: 'SUBMIT', exact: true }).click();
      await settle(1500);
      const rows = await kit.mappedMaterials(supplier);
      return { created: true, rows };
    },

    // ---------------- User Management (invites) ----------------
    openUsers: () => openPage('/user-management', 'User Management', 'User Management'),
    async userRow(email) {
      await navigator.clearLayers();
      // The list is fetched when the page opens: leave it through the menu and open it again (no page reload, which would
      // reset the header site) so an invite sent from this page is included.
      if (new URL(page.url()).pathname.replace(/\/+$/, '') === '/user-management') await k.menu('Management Dashboard').catch(() => null);
      await kit.openUsers(); await settle(1500);
      const row = k.rows().filter({ hasText: new RegExp(esc(email), 'i') }).first();
      return (await searchList(page.getByRole('textbox', { name: /Search users/ }), /\d+ users?/, email, row)) ? clean(await row.innerText()) : null;
    },
    // An invited user appears in the user list only some minutes after "Invite Sent Successfully" (11 Nov), so the toast is
    // the creation check and the listing is verified later (invitedListed). A sent invite is remembered for the run so a
    // retry never re-sends it.
    invited: new Set(),
    // `preferred` (the run's new Subcontractor organisation) is chosen when the Organization list offers it, otherwise
    // `organization`; the form is opened once and the offered list is returned for the report.
    async ensureInvite({ email, role, organization, preferred }) {
      if (kit.invited.has(email)) return { sent: false, organization: kit.invitedOrg };
      await navigator.clearLayers();
      await kit.openUsers();
      await button('Invite Users').click();
      await page.getByPlaceholder('Enter email address').filter({ visible: true }).last().fill(email);
      await page.getByRole('button', { name: 'Choose Role' }).filter({ visible: true }).last().click();
      await listbox().getByRole('option', { name: role, exact: true }).click();
      let chosen = null; let offered = [];
      if (organization || preferred) {
        // Normal organisation user: an existing organisation is chosen, so no SSO organisation is created at sign-in.
        const picker = () => page.locator('[role="button"][aria-haspopup="listbox"]').filter({ visible: true });
        await picker().filter({ hasText: /Choose Organi/ }).first().click();
        await expect(listbox().getByRole('option').first(), 'Organization options').toBeVisible({ timeout: 10000 });
        offered = (await listbox().getByRole('option').allInnerTexts()).map(clean);
        chosen = preferred && offered.some(o => norm(o) === norm(preferred)) ? preferred : organization;
        await listbox().getByRole('option', { name: chosen, exact: true }).first().click();
        await expect(picker().filter({ hasText: chosen }).first(), `Organization "${chosen}" chosen`).toBeVisible();
      }
      await page.getByRole('button', { name: 'Send Invites' }).click();
      await toast('Invite Sent Successfully');
      kit.invited.add(email); kit.invitedOrg = chosen;
      return { sent: true, organization: chosen, preferredOffered: !!preferred && offered.some(o => norm(o) === norm(preferred)), offeredCount: offered.length };
    },
    async invitedListed(email, timeout = 300000) {
      let row = null;
      await expect.poll(async () => (row = await kit.userRow(email)) !== null, { timeout, intervals: [5000, 15000, 30000], message: `${email} listed in User Management` }).toBe(true);
      return row;
    },

    // ---------------- Role switching (one tab) ----------------
    // The avatar shows the account's initials; with no name given the page object falls back to any 1–2 letter avatar button.
    // Avatars show 1–3 characters ("HR", "ES2" for a run user), so the header avatar is matched here before falling back to
    // the page object's logout (which knows the platform-chooser link).
    async signOut(firstName = 'Zz') {
      await page.keyboard.press('Escape').catch(() => null);
      const avatar = page.getByRole('button', { name: /^[A-Z0-9]{1,3}$/ }).filter({ visible: true }).last();
      if (page.url().startsWith(new URL(config.baseUrl).origin) && await avatar.isVisible().catch(() => false)) {
        // An open submittal drawer covers the header: close it, else sign out from the dashboard.
        await navigator.clearLayers();
        if (!(await avatar.click({ timeout: 5000 }).then(() => true, () => false))) {
          await page.goto('/management-dashboard', { waitUntil: 'domcontentloaded' }); await settle(1500);
          await avatar.click();
        }
        const logout = page.getByRole('menuitem', { name: /^Log ?out$/i }).or(page.getByRole('button', { name: /^Log ?out$/i })).or(page.getByRole('link', { name: /^Log ?out$/i })).first();
        await expect(logout, 'Logout in the avatar menu').toBeVisible({ timeout: 10000 });
        await logout.click();
      } else {
        await new InvitedUserActivationPage(page, config).logout(firstName);
      }
      await expect(page).toHaveURL(/login|platforms\/choose/i, { timeout: 30000 });
    },
    // Invitation mail → set password → sign in → complete profile/address when asked → application.
    async activateInvite(user, observe = () => {}) {
      // After "Next" on the password page the user is already signed in and on "Set Up Your Profile"; a second sign-in
      // through the login page only redirects back there (11 Nov). The steps below therefore follow the page state, which
      // also lets the runner's second attempt resume where the first one stopped.
      const activation = new InvitedUserActivationPage(page, config);
      const onProfile = () => page.getByRole('heading', { name: 'Set Up Your Profile' }).isVisible().catch(() => false);
      if (!(await onProfile()) && !activation.isActivationComplete()) {
        await activation.openInvitationFromYopmail(user.email);
        await activation.setInvitationPassword(user.password);
        observe('Invitation accepted and password set');
      }
      if (!(await onProfile()) && !activation.isActivationComplete()) await activation.loginForProfileCompletion(user);
      if (await onProfile()) {
        // The page object's own address step does not fit the organisation form that follows; it is handled below.
        await activation.completeProfileAndAddress(user).catch(error => {
          if (!/organizations\/setup/i.test(page.url())) throw error;
        });
        observe('Profile completed');
      }
      // Revised spec (11 Nov): only normal organisation users. The organisation setup page would create a new SSO
      // organisation, so it is never filled; reaching it means the invite did not carry the organisation.
      if (/organizations\/setup/i.test(page.url())) throw new Error(`Activation asks ${user.email} to create an SSO organisation although the invite named "${user.organization}"; not filled`);
      await activation.waitForApplicationLanding().catch(() => null);
      expect(activation.isActivationComplete(), 'Activation reached the platform chooser or the application').toBe(true);
    },
    async signInAs({ username, password }) {
      await page.goto(config.loginUrl, { waitUntil: 'domcontentloaded' });
      const loginHeading = page.getByRole('heading', { name: 'Welcome To Voyage Control' });
      if (await loginHeading.isVisible({ timeout: 20000 }).catch(() => false)) await new LoginPage(page).login(username, password);
      // A multi-platform account lands on the platform chooser (heading = email); a single-platform account goes straight
      // into SCP (seen 11 Nov for the Supplier account). Either way the active user is checked before continuing.
      await page.waitForURL(url => /platforms\/choose/i.test(url.pathname) || url.origin === new URL(config.baseUrl).origin, { timeout: 45000 });
      expect(await kit.activeUser(), `Signed in as ${username} (no leftover session of another account)`).toBe(username.toLowerCase());
    },
    // The signed-in account: the chooser heading, or the userInfo the SCP app stores.
    async activeUser() {
      if (/platforms\/choose/i.test(page.url())) {
        const h = (await page.getByRole('heading').allInnerTexts()).map(clean).find(t => /@/.test(t));
        return h ? h.toLowerCase() : null;
      }
      await page.waitForFunction(() => !!localStorage.getItem('userInfo'), null, { timeout: 30000 }).catch(() => null);
      const info = await page.evaluate(() => localStorage.getItem('userInfo') || '');
      const email = (info.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/) || [])[0];
      return email ? email.toLowerCase() : null;
    },
    async activeOrganization() { return new ProjectSelectorPage(page, config).activeOrganizationName().catch(() => null); },
    async enterProject(site) {
      if (/platforms\/choose/i.test(page.url()) || !page.url().startsWith(config.baseUrl)) await new PlatformChooserPage(page, config).openSupplyChainPlanner();
      await expect(page).toHaveURL(new RegExp(esc(new URL(config.baseUrl).origin)), { timeout: 45000 });
      await new ProjectSelectorPage(page, config).ensureProject(config.projectName);
      if (site) await new SiteSelectorPage(page).ensureSite(site);
    },

    // ---------------- Procurement Log delivery chain ----------------
    // Opens the run submittal's component (delivery list) through the Procurement Log menu, search and drawer.
    // Opens the Procurement Log through the menu and searches the submittal; true when its row is listed. Works for role
    // users whose list may legitimately be empty (k.openLog() waits for more than 0 items).
    async findSubmittal(number) {
      await k.menu('Procurement Log').catch(() => page.goto('/procurement-log', { waitUntil: 'domcontentloaded' }));
      await expect(page).toHaveURL(/\/procurement-log/);
      await expect.poll(async () => /\d+ items?/.test(await main.innerText().catch(() => '')), { timeout: 30000, message: 'Procurement Log loaded' }).toBe(true);
      await settle(2000);
      await k.search(number);
      const listed = await expect.poll(() => k.rows().filter({ hasText: number }).count(), { timeout: 15000 }).toBeGreaterThan(0).then(() => true, () => false);
      return { listed, count: ((await main.innerText()).match(/\d+ items?/) || ['?'])[0] };
    },
    // Submittal and component pages as redesigned by the staging release of 23 Nov 2026 (evening): the component opens
    // through its "⋯" menu › "Open component"; deliveries are listed as "Expected" (with "Receive") and "Received"
    // (RCV-…) rows with a "Delivery actions" (⋯) menu. Every E2E component has exactly one delivery.
    async openComponent({ number, description, material }) {
      const { listed, count } = await kit.findSubmittal(number);
      expect(listed, `${number} listed (${count})`).toBe(true);
      await k.openSubmittal(description);
      await k.openComponent(material);
    },
    // Component row (grid) columns: Component, Qty, Status, Lead time (weeks + confirmation), Order (PO + state),
    // Next delivery, ROJ (date + check), Next step.
    async componentInfo(material) {
      const row = k.componentRow(material);
      await expect(row).toBeVisible({ timeout: 20000 });
      const heads = ['', 'Component', 'Qty', 'Status', 'Lead time', 'Order', 'Next delivery', 'ROJ', 'Next step'];
      const cols = await row.locator('xpath=./*').allInnerTexts();
      const parts = cols.map(c => c.split('\n').map(clean).filter(Boolean));
      return { heads, cells: cols.map(clean), parts, values: Object.fromEntries(heads.map((h, i) => [h, clean(cols[i])]).filter(([h]) => h)), text: clean(await row.innerText()) };
    },
    // The redesigned row shows the lead time in weeks and "Confirmed" / "Not confirmed"; it no longer shows an
    // "Expected Delivery" date (PO date + lead time) – `expected` is the booked "Next delivery" date when one exists.
    async leadTime(material) {
      const { parts, values } = await kit.componentInfo(material);
      const [weeks = '', confirmation = ''] = parts[4] || [];
      const [next = ''] = parts[6] || [];
      const [roj = '', rojCheck = ''] = parts[7] || [];
      return { weeks: (weeks.match(/\d+/) || [''])[0], status: confirmation, expected: (next.match(/\d{2}\/\d{2}\/\d{4}/) || [''])[0],
        required: roj, rojCheck, componentStatus: (parts[3] || [''])[0], values };
    },
    // Component "⋯" › "Lead time": enter the weeks, tick the confirmation, Submit (PL-REG-CMP-06 pattern).
    async confirmLeadTime(material, weeks) {
      await k.componentAction(material, 'Lead time');
      const m = k.dialog('Update Lead Time', 'Submit');
      await m.getByRole('spinbutton').fill(String(weeks));
      await m.getByRole('checkbox').check();
      await m.getByRole('button', { name: 'Submit', exact: true }).click();
      await expect.poll(async () => (await kit.leadTime(material)).status, { timeout: 20000, message: 'Lead time status "Confirmed"' }).toBe('Confirmed');
    },
    // Component view summary: "<n> <UoM> required", the bar "Received in good order g, Damaged d, On a load l, Planned
    // deliveries p, Not planned yet r" and "Value delivered" / "Remaining value". Returned under the former labels.
    async componentSummary() {
      const bar = (await page.getByRole('img', { name: /^Received in good order/ }).filter({ visible: true }).last().getAttribute('aria-label').catch(() => '')) || '';
      const num = label => Number((bar.match(new RegExp(`${label} (\\d+(?:\\.\\d+)?)`)) || [])[1] || NaN);
      const text = clean(await page.getByText(/ required ·/).filter({ visible: true }).last().locator('xpath=ancestor::div[1]').innerText().catch(() => ''));
      const summary = clean(await page.getByText('Value delivered').filter({ visible: true }).last().locator('xpath=..').innerText().catch(() => ''));
      const money = label => (summary.match(new RegExp(`${label}\\s*([^\\d\\s]*\\s?[\\d.,]+)`, 'i')) || [])[1] || '';
      const received = num('Received in good order');
      const remaining = num('Planned deliveries') + num('Not planned yet') + num('On a load');
      return { 'Required QTY': (text.match(/^([\d.,]+ \S+) required/) || [])[1] || '', 'QTY Received': String(received), 'QTY Rejected': String(num('Damaged')),
        'Remaining QTY To Be Delivered': String(remaining), 'Value Delivered': money('Value delivered'), 'Remaining Value To Be Delivered': money('Remaining value'), bar };
    },
    visibleDeliveries() { return k.deliveryRows(); },
    deliveryRow() { return k.deliveryRows().last(); },
    // Actions offered on the delivery: the items of its "Delivery actions" menu (e.g. "Pre-shipping info",
    // "Approve pre-shipping checklist", "Pre-shipping checklist (approved)", "Generate GRN").
    async deliveryIcons() {
      await expect(kit.deliveryRow(), 'Delivery listed on the component').toBeVisible({ timeout: 15000 });
      return k.deliveryMenu(kit.deliveryRow());
    },
    async logDelivery({ material, qty, date, tag }) {
      await k.keepSite();
      const { location } = await k.addDelivery({ material, qty, date });
      expect(await kit.deliveryIcons(), `Delivery ${tag} awaits the pre-shipping checklist`).toContain('Pre-shipping info');
      return { location };
    },
    async fillChecklist(tag) {
      expect(await kit.deliveryIcons(), '"Pre-shipping info" offered on the delivery').toContain('Pre-shipping info');
      return k.preShipping(kit.deliveryRow(), tag);
    },
    async approveChecklist(tag) {
      expect(await kit.deliveryIcons(), '"Approve pre-shipping checklist" offered on the delivery').toContain('Approve pre-shipping checklist');
      await k.approveChecklist(kit.deliveryRow(), `${tag} approved by subcontractor`);
    },
    // "Receive" › "Edit Delivery" › Actual Date Of Delivery, "Update": the delivery moves to "Received" (RCV-…).
    async setActualDate(date) {
      const { receipt } = await k.receive(kit.deliveryRow(), date);
      return { receipt };
    },
    shippingInfo(tag) { return k.shippingInfo(kit.deliveryRow(), tag); },
    deliveryConditions({ good, damage }) { return k.deliveryConditions(kit.deliveryRow(), { good, damage }); },
    // Generate GRN (POST /api/shipping_details/generate_grn_pdf/ answers JSON, 201). The PDF is listed in the submittal's
    // "Files" section; it is read back with downloadGrn. Never throws after the click succeeded (a retry would create a
    // second GRN); the spec requests a GRN at most once per booking.
    async generateGrn(tag) {
      const receipt = ((await kit.deliveryRow().innerText()).match(/RCV-\d+/) || [])[0] || null;
      const response = page.waitForResponse(r => /generate_grn_pdf/i.test(r.url()), { timeout: 45000 }).catch(() => null);
      await k.deliveryAction(kit.deliveryRow(), 'Generate GRN');
      await toast('GRN Generated Successfully!', 30000);
      await settle(1500);
      const res = await response;
      const note = res ? `generate_grn_pdf HTTP ${res.status()}` : 'no generate_grn_pdf response seen';
      let grn = { file: null, text: '', receipt: null };
      try { grn = await kit.downloadGrn(tag, receipt); } catch (e) { return { ...grn, note: `${note}; download failed: ${e.message.split('\n')[0]}` }; }
      return { ...grn, note };
    },
    // Submittal page › "Files" › the GRN_<delivery>.pdf entry linked to the receipt › "Download": saves the PDF in the run
    // folder and returns its text (pypdf) and Receipt No. Read-only.
    async downloadGrn(tag, receipt = null) {
      if (!receipt && /[?&]schedule=/.test(page.url())) receipt = ((await kit.deliveryRow().innerText().catch(() => '')).match(/RCV-\d+/) || [])[0] || null;
      await k.backToSubmittal();
      const refresh = page.getByRole('button', { name: 'Refresh', exact: true }).last();
      let index = -1;
      for (let i = 0; i < 4 && index < 0; i++) {
        if (i) { await refresh.click().catch(() => null); await settle(2000); }
        // Each file entry is the largest ancestor of its "Download" button that holds no other "Download" button.
        index = await page.getByRole('button', { name: 'Download', exact: true }).evaluateAll((buttons, rc) => buttons.findIndex(b => {
          let n = b;
          while (n.parentElement && n.parentElement.querySelectorAll('button').length && [...n.parentElement.querySelectorAll('button')].filter(x => x.textContent.trim() === 'Download').length === 1) n = n.parentElement;
          const t = n.innerText || '';
          return /GRN_[^\s]*\.pdf/.test(t) && (!rc || t.includes(rc));
        }), receipt);
      }
      if (index < 0) throw new Error(`GRN file${receipt ? ` for ${receipt}` : ''} not listed in the submittal's Files`);
      const download = page.waitForEvent('download', { timeout: 30000 });
      await page.getByRole('button', { name: 'Download', exact: true }).nth(index).click();
      const d = await download;
      const file = path.join(outDir, 'grn', `${tag}-${d.suggestedFilename()}`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      await d.saveAs(file);
      let text = '';
      try { text = execFileSync(process.env.SCP_PYTHON || 'python', [path.join(__dirname, 'e2e-pdf-text.py'), file], { encoding: 'utf8', windowsHide: true }); } catch (e) { text = ''; }
      const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
      const after = label => { const i = lines.findIndex(l => norm(l) === norm(label)); return i >= 0 ? lines[i + 1] : null; };
      return { file, name: d.suggestedFilename(), text: clean(text), lines, receipt: after('Receipt No.'), po: after('PO Number'), shipping: after('Shipping Number'),
        supplier: after('Supplier Vendor'), received: after('Date Received at location'), title: lines.find(l => /GOODS RECEIVED NOTE/i.test(l)) || null };
    },
    // Procurement Log › search › row "⋮" › "Edit" → "Edit Submittal" form (PL-REG-EDT pattern). Returns the form.
    async openEditSubmittal(number, description) {
      await k.openLog(); await k.search(number);
      await k.rows().filter({ hasText: description }).first().getByRole('cell').last().click();
      await page.getByRole('menuitem', { name: 'Edit' }).click();
      const heading = page.getByRole('heading', { name: 'Edit Submittal' });
      await expect(heading, 'Edit Submittal form').toBeVisible({ timeout: 15000 });
      await settle(800);
      return heading.locator('xpath=../..');
    },
    // Materials selected in the open Edit Submittal form: the options marked selected in its materials chooser.
    async editFormMaterials(form, primary) {
      await form.getByRole('button', { name: new RegExp(esc(primary)) }).first().click();
      await expect(listbox()).toBeVisible({ timeout: 10000 });
      const selected = (await listbox().getByRole('option', { selected: true }).allInnerTexts()).map(clean).filter(Boolean);
      await page.getByRole('heading', { name: 'Edit Submittal' }).click();
      return selected;
    },
    // Edit Mode: keeps the primary material selected and selects one more, then "Update".
    async addMaterialByEdit({ number, description, primary, material }) {
      const form = await kit.openEditSubmittal(number, description);
      const before = await kit.editFormMaterials(form, primary);
      await form.getByRole('button', { name: new RegExp(esc(primary)) }).first().click();
      const option = listbox().getByRole('option', { name: material, exact: true }).first();
      if ((await option.getAttribute('aria-selected')) !== 'true') await option.click();
      await page.getByRole('heading', { name: 'Edit Submittal' }).click();
      const after = await kit.editFormMaterials(form, primary);
      await form.getByRole('button', { name: 'Update', exact: true }).click();
      await toast('Submittal updated successfully');
      await settle(1500);
      return { before, after };
    },
    async submittalRowValues(number, description) {
      await k.openLog(); await k.search(number);
      const heads = (await main.getByRole('columnheader').allInnerTexts()).map(clean);
      const cells = (await k.rows().filter({ hasText: description }).first().getByRole('cell').allInnerTexts()).map(clean);
      return Object.fromEntries(heads.map((h, i) => [h, cells[i]]).filter(([h]) => h));
    }
  };
  return kit;
}

module.exports = { e2eKit, esc, norm, clean, ddmmyyyy };
