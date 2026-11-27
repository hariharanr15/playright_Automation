// Additional building blocks for the E2E smoke v2 ("SCP – Updated End-to-End Smoke Automation Requirements", 12 Nov 2026):
// sequential record names, homepage capture, the drawer "+ Add material", Procurement Log status filter / export /
// Assign Responsible / Bulk Edit / row Alert, FDI configuration (question set, group, questions, inspector), FDI inspection,
// and the Analytics / reference-data reads. Extends e2e-kit.js; Project Management specs are not changed.
// Behaviour observed on staging 12 Nov 2026 with read-only probes (nothing was saved):
// - Bulk Edit: tick rows › "Select Columns for Bulk Edit" (column checkboxes) › "Next" › "Bulk Edit — Enter Values" ›
//   "Preview Changes" › "Confirm Bulk Edit" (lists the affected records) › "Back" | "Confirm & Apply". "View Bulk Edit Log"
//   lists committed batches ("Bulk Update #N — <field>").
// - Drawer materials bar: chips with ×, "+ Add material" (the supplier's other mapped materials) and a "+" button
//   titled "New material" (creates a material – not used: Add Material is never opened by this suite).
// - FDI Config: set tabs, "Manage Groups(n)" › "Add Group", "Add Question" (Question Text, Answer Type: Boolean, Text,
//   Date, Pass/Fail/NA, Numeric, Drop Down, Single/Multiple Photo, Document); the questions table has a Group select.
// - FDI list: selects Material / Supplier / Status, rows with Self Assign / Assign / Fill Inspection Report / View.
const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');
const { OVERLAY } = require('./pm-navigator');
const { readWorkbook } = require('../../../utils/bulk-upload/inventory-workbook');
const { FirstDeliveryInspectionsPage } = require('../../../pages/first-delivery-inspections/first-delivery-inspections.page');

const esc = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = value => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
const exactI = text => new RegExp(`^\\s*${esc(text)}\\s*$`, 'i');

// Next free sequence number for "<prefix> <N> <date>" among the names already present (1 when none).
function nextSeq(names, prefix, date) {
  const re = new RegExp(`^\\s*${esc(prefix)}\\s*(\\d+)\\s+${esc(date)}(?!\\d)`, 'i');
  return names.reduce((max, name) => { const m = String(name).match(re); return m ? Math.max(max, Number(m[1])) : max; }, 0) + 1;
}

function e2eKitV2(page, { kit, navigator, outDir, config, site }) {
  const { k } = kit;
  const { main, listbox, settle, toast } = k;
  const layers = () => page.locator(OVERLAY).filter({ visible: true });
  const layer = text => layers().filter({ hasText: text }).last();
  const fdi = new FirstDeliveryInspectionsPage(page, config);
  const headerCells = async () => (await main.getByRole('columnheader').allInnerTexts()).map(clean);
  // Opens the Procurement Log WITHOUT a page reload: a reload makes the app reset the header site ("Refresh resets the
  // selected site"), which would force a new site selection every time. The left menu keeps the session's site; on the
  // page itself only the search box is cleared. The site is re-selected only if it has actually changed.
  const fresh = async () => {
    await navigator.clearLayers();
    const path = new URL(page.url()).pathname.replace(/\/+$/, '');
    if (path !== '/procurement-log' || page.url().includes('submittal=')) {
      await k.menu('Procurement Log').catch(() => page.goto('/procurement-log', { waitUntil: 'domcontentloaded' }));
      await expect(page).toHaveURL(/\/procurement-log/);
    }
    await v2.keepSite('Procurement Log listing');
    const box = page.getByRole('textbox', { name: 'Search submittals…' });
    if (await box.inputValue().catch(() => '')) { await box.fill(''); await box.press('Enter'); }
    await expect.poll(k.count, { timeout: 30000, message: 'Procurement Log item count' }).toBeGreaterThan(0); await settle(800);
  };
  const plRow = number => k.rows().filter({ has: page.getByRole('cell', { name: number, exact: true }) }).first();
  const rowMenu = async (number, item) => { await expect(plRow(number), `${number} listed`).toBeVisible({ timeout: 20000 }); await plRow(number).getByRole('cell').last().click(); await page.getByRole('menuitem', { name: item }).click(); await settle(800); };
  const columnOf = async name => (await headerCells()).indexOf(name);
  const cellValue = async (number, column) => { const i = await columnOf(column); return clean(await plRow(number).getByRole('cell').nth(i).innerText()); };

  const v2 = {
    nextSeq, fdi, siteReselections: 0, siteChecks: [], siteContext: { project: null, location: site || null },
    // TC-25 ensureLocationSelected: read the header location first; open the Location dropdown ONLY when the app has
    // really cleared/changed it. Right after a page change the header can briefly show the project's first site while the
    // stored one is restored, so the value is polled for a few seconds before it is judged wrong. Every check is logged
    // (outcome PASS-skipped / PASS-selected / FAIL) for the execution report. Returns true when the dropdown was used.
    async ensureLocationSelected(target = site, where = '') {
      if (!target) return false;
      const { SiteSelectorPage } = require('../../../pages/site-selector.page');
      const selector = new SiteSelectorPage(page);
      const read = () => selector.activeSiteName().catch(() => '');
      const matches = v => !!v && norm(v).includes(norm(target));
      let now = await read();
      const deadline = Date.now() + 8000;
      while (!matches(now) && Date.now() < deadline) { await page.waitForTimeout(500); now = await read(); }
      const at = where || new URL(page.url()).pathname;
      if (matches(now)) {
        v2.siteChecks.push({ at, time: new Date().toISOString(), found: now, outcome: 'PASS – Existing location verified; selection skipped' });
        return false;
      }
      try {
        await navigator.clearLayers();
        await selector.ensureSite(target);
        if (!matches(await read())) throw new Error(`header shows "${await read()}"`);
      } catch (e) {
        v2.siteChecks.push({ at, time: new Date().toISOString(), found: now, outcome: 'FAIL – Required location could not be selected', error: String(e.message || e).split('\n')[0] });
        throw e;
      }
      v2.siteReselections += 1;
      v2.siteChecks.push({ at, time: new Date().toISOString(), found: now || '(empty)', outcome: 'PASS – Location selected successfully' });
      console.log(`      location was "${now || '(empty)'}" (cleared/changed by the app) – ${target} selected once and verified`);
      await settle(1000);
      return true;
    },
    keepSite(where) { return v2.ensureLocationSelected(site, where); },

    // ---------------- Names already used today (uniqueness check before creating) ----------------
    async categoryNames(term) {
      await navigator.open('Material Category');
      const box = main.getByPlaceholder('Search categories…');
      await box.fill(term); await page.waitForTimeout(1500); await settle(500);
      const names = (await main.locator('tbody tr').evaluateAll(rs => rs.map(r => (r.cells[0]?.innerText || '').trim()))).filter(Boolean);
      await box.fill(''); await page.waitForTimeout(800);
      return names;
    },
    async materialNames(term) { return (await kit.materialRows(term)).map(c => c[3]).filter(Boolean); },
    async supplierNames(term) {
      await navigator.clearLayers();
      await kit.openSuppliers();
      await expect.poll(async () => /\d+ suppliers?/.test(await main.innerText().catch(() => '')), { timeout: 30000, message: 'Supplier List loaded' }).toBe(true);
      await settle(800);
      await page.getByRole('textbox', { name: /Search suppliers/ }).fill(term); await page.waitForTimeout(2000); await settle(500);
      const i = (await headerCells()).indexOf('Supplier Name');
      return (await k.rows().evaluateAll((rs, idx) => rs.map(r => (r.cells[idx]?.innerText || '').trim()), i)).filter(Boolean);
    },
    async submittalNumbers(term) {
      await fresh(); await k.search(term); await page.waitForTimeout(1500);
      const i = await columnOf('Submittal No');
      return (await k.rows().evaluateAll((rs, idx) => rs.map(r => (r.cells[idx]?.innerText || '').trim()), i)).filter(Boolean);
    },
    async userEmails(term) {
      await navigator.clearLayers();
      await kit.openUsers();
      await expect.poll(async () => /\d+ users?/.test(await main.innerText().catch(() => '')), { timeout: 30000, message: 'User list loaded' }).toBe(true);
      await page.getByRole('textbox', { name: /Search users/ }).fill(term); await page.waitForTimeout(2000); await settle(500);
      return ((await main.locator('tbody').innerText().catch(() => '')).match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) || []).map(e => e.toLowerCase());
    },

    // ---------------- Homepage ----------------
    async homepage() {
      if (!/\/management-dashboard\/?$/.test(new URL(page.url()).pathname)) await k.menu('Management Dashboard').catch(() => page.goto('/management-dashboard', { waitUntil: 'domcontentloaded' }));
      await expect.poll(async () => /OPEN SUBMITTALS/i.test(await main.innerText()), { timeout: 30000, message: 'Homepage widgets load' }).toBe(true);
      await settle(1500);
      const nav = page.locator('nav').first();
      const tabs = [];
      for (const b of await nav.getByRole('button').all()) {
        const name = clean(await b.innerText().catch(() => '')).replace(/\s+\d+\+?$/, '');
        if (name && !tabs.some(t => t.name === name)) tabs.push({ name, visible: await b.isVisible().catch(() => false) });
      }
      const text = await main.innerText();
      const kpi = label => clean((text.match(new RegExp(`${label}\\s*\\n([^\\n]+)(?:\\n([^\\n]+))?`, 'i')) || []).slice(1).join(' '));
      const views = [];
      for (const name of ['Dashboard', 'Alerts', 'Notifications', 'Tasks']) {
        const b = main.getByRole('button', { name: new RegExp(`^${name}(\\s+\\d+\\+?)?$`) }).first();
        if (await b.isVisible().catch(() => false)) views.push(clean(await b.innerText()));
      }
      const urgent = (text.match(/Urgent Issues \((\d+)\)/i) || [])[1];
      return {
        tabs, views, urgent: urgent == null ? null : Number(urgent),
        widgets: { 'Material categories in scope': kpi('MATERIAL CATEGORIES IN SCOPE'), 'Open submittals': kpi('OPEN SUBMITTALS'), 'On-time delivery': kpi('ON-TIME DELIVERY'),
          'Active alerts': kpi('ACTIVE ALERTS'), 'Lead-time variance': kpi('LEAD-TIME VARIANCE') },
        watched: /Your watched materials/i.test(text)
      };
    },

    // ---------------- Drawer: "+ Add material" ----------------
    materialsBar() { return page.getByText('Materials:', { exact: true }).first().locator('xpath=ancestor::div[2]'); },
    async drawerMaterials() {
      const lines = (await v2.materialsBar().innerText()).split('\n').map(clean).filter(Boolean);
      return lines.filter(l => !/^(Materials:|\(primary\)|×|\+ ?Add material\s*\d*|Add|No other materials.*)$/i.test(l));
    },
    // Adds `material` to the open submittal from the drawer's "+ Add material" list (the supplier's mapped materials).
    async addMaterialInDrawer(material) {
      const before = await v2.drawerMaterials();
      if (before.map(norm).includes(norm(material))) return { added: false, before, after: before };
      const add = v2.materialsBar().getByText(/\+ ?Add material/i).first();
      await expect(add, '"+ Add material" offered in the materials bar (needs another material mapped to the supplier)').toBeVisible({ timeout: 15000 });
      await add.click();
      const option = page.getByRole('option', { name: material, exact: true }).filter({ visible: true }).first();
      await expect(option, `${material} offered by "+ Add material"`).toBeVisible({ timeout: 10000 });
      await option.click();
      // Ticking only stages the material ("+ Add material 1"); the bar's "Add" button saves it to the submittal.
      await page.keyboard.press('Escape').catch(() => null);
      const save = v2.materialsBar().getByRole('button', { name: 'Add', exact: true });
      await expect(save, '"Add" button next to "+ Add material"').toBeVisible({ timeout: 10000 });
      await save.click();
      await expect(save, 'Staged material saved').toBeHidden({ timeout: 20000 });
      await settle(1500);
      const message = await kit.anyToast();
      await expect.poll(async () => (await v2.drawerMaterials()).map(norm).includes(norm(material)), { timeout: 20000, message: `${material} chip on the submittal` }).toBe(true);
      return { added: true, before, after: await v2.drawerMaterials(), toast: message };
    },

    // ---------------- Procurement Log: status filter and export ----------------
    async statusFilter(status) {
      await fresh();
      await main.getByRole('button', { name: 'Status', exact: true }).click();
      await listbox().getByRole('option', { name: status, exact: true }).click();
      await page.keyboard.press('Escape'); await settle(1500);
      await expect(main.getByRole('button', { name: /^Status1/ }), 'Status filter applied').toBeVisible({ timeout: 10000 });
      const i = await columnOf('Status');
      const values = await k.rows().evaluateAll((rs, idx) => rs.map(r => (r.cells[idx]?.innerText || '').trim()), i);
      return { count: await k.count(), values };
    },
    async clearStatusFilter(status) {
      const b = main.getByRole('button', { name: /^Status1/ });
      if (!(await b.isVisible().catch(() => false))) return;
      await b.click(); await listbox().getByRole('option', { name: status, exact: true }).click(); await page.keyboard.press('Escape'); await settle(1000);
    },
    async exportLog() {
      const [file] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), main.getByRole('button', { name: 'Export', exact: true }).click()]);
      const target = path.join(outDir, 'downloads', `${Date.now()}-${file.suggestedFilename()}`);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      await file.saveAs(target);
      const book = readWorkbook(target);
      const sheet = Object.keys(book).find(name => !name.startsWith('_')) || Object.keys(book)[0];
      // Rows come keyed by cell reference ("Z2"); empty cells are absent, so columns are matched by letter.
      const raw = book[sheet] || [];
      const letters = Object.keys(raw[0] || {}).map(key => key.replace(/\d+$/, ''));
      const header = letters.map(l => clean(raw[0][`${l}1`]));
      const data = raw.slice(1).map(row => { const n = (Object.keys(row)[0] || '').replace(/^[A-Z]+/, ''); return Object.fromEntries(letters.map((l, i) => [header[i], clean(row[`${l}${n}`] ?? '')])); });
      return { name: file.suggestedFilename(), path: target, sheet, header, data };
    },

    // ---------------- Procurement Log: Assign Responsible (row) ----------------
    // Returns the chosen option label; fails with the actual reason when the user is not offered (never another user).
    async assignResponsible(number, email) {
      await fresh(); await k.search(number);
      await rowMenu(number, 'Assign Responsible');
      // Since the staging release of 23 Nov 2026 (evening): dialog "Responsible — <number>" › "Add a Responsible person" ›
      // "Add" › "Done" (k.addResponsible).
      const d = k.responsibleDialog();
      await expect(d, 'Responsible dialog').toBeVisible({ timeout: 10000 });
      let label = '';
      await k.addResponsible(email, async () => {
      await d.getByRole('button', { name: 'Choose user' }).click();
      // The list loads its users gradually; the user is found through the list's own Search box.
      const search = page.locator('input[placeholder^="Search"]:visible').filter({ hasNot: page.locator('[placeholder^="Search submittals"]') }).last();
      await search.fill(email); await page.waitForTimeout(1200);
      const options = listbox().getByRole('option').filter({ hasText: new RegExp(esc(email), 'i') });
      await expect.poll(() => options.count(), { timeout: 10000, message: `${email} offered` }).toBeGreaterThan(0).catch(() => null);
      const n = await options.count();
      if (n !== 1) { const all = (await listbox().getByRole('option').allInnerTexts()).length; throw new Error(`Assign Responsible: ${n} option(s) for ${email} among ${all} project users`); }
      label = clean(await options.first().innerText());
      await options.first().click();
      });
      return { label, name: clean(label.replace(/\(.*\)\s*$/, '')) };
    },
    async rowValue(number, column) { await fresh(); await k.search(number); return cellValue(number, column); },

    // ---------------- Procurement Log: Bulk Edit ----------------
    async tickRows(term, numbers) {
      await fresh(); await k.search(term);
      // Rows ticked by an earlier step stay ticked without a reload: untick everything first.
      for (const box of await k.rows().getByRole('checkbox').all()) if (await box.isChecked().catch(() => false)) await box.uncheck();
      for (const n of numbers) await plRow(n).getByRole('checkbox').first().check();
    },
    // Columns → Spec Description → Next → value → Preview Changes. Returns the preview text; the dialog stays open.
    async bulkPreview(term, numbers, value) {
      await v2.tickRows(term, numbers);
      await main.getByRole('button', { name: 'Select Columns for Bulk Edit' }).click();
      const cols = layer('Select Columns for Bulk Edit');
      await expect(cols).toBeVisible({ timeout: 10000 });
      await cols.getByText('Spec Description', { exact: true }).first().click();
      await cols.getByRole('button', { name: 'Next', exact: true }).click();
      const values = layer('Bulk Edit — Enter Values');
      await expect(values, '"Bulk Edit — Enter Values" step').toBeVisible({ timeout: 10000 });
      const input = values.locator('input:visible, textarea:visible').first();
      await input.fill(value);
      await values.getByRole('button', { name: 'Preview Changes', exact: true }).click();
      const preview = layer('Confirm Bulk Edit');
      await expect(preview, '"Confirm Bulk Edit" preview').toBeVisible({ timeout: 15000 });
      return { dialog: preview, text: clean(await preview.innerText()) };
    },
    // Review banner of an applied bulk update ("Bulk Update #N — reviewing changes. …"), or null.
    reviewBar() { return page.getByText(/Bulk Update #\d+ — reviewing changes/).first().locator('xpath=ancestor::div[.//button[normalize-space()="Confirm"]][1]'); },
    async pendingBulk() {
      if (!/\/procurement-log/.test(page.url())) await fresh();
      await settle(800);
      const bar = v2.reviewBar();
      return (await bar.isVisible().catch(() => false)) ? clean(await bar.innerText()) : null;
    },
    // Preview › "Confirm & Apply": the values are applied and the batch waits for review (banner).
    async confirmAndApply() {
      const dialog = layer('Confirm Bulk Edit');
      await expect(dialog, 'Preview open').toBeVisible({ timeout: 5000 });
      await dialog.getByRole('button', { name: 'Confirm & Apply', exact: true }).click();
      await expect(dialog).toBeHidden({ timeout: 30000 });
      await expect(v2.reviewBar(), 'Review banner after Confirm & Apply').toBeVisible({ timeout: 30000 });
      await settle(1000);
    },
    // Banner › "Confirm" or "Roll Back" (a confirmation dialog, if any, is accepted). Returns the toast text.
    async resolveBulk(action) {
      const bar = v2.reviewBar();
      await expect(bar, 'Review banner').toBeVisible({ timeout: 15000 });
      await bar.getByRole('button', { name: action, exact: true }).click();
      await page.waitForTimeout(1500);
      const dialog = layers().filter({ has: page.getByRole('button', { name: new RegExp(`^(${action}|Yes|Confirm)`, 'i') }) }).last();
      if (await dialog.isVisible().catch(() => false)) await dialog.getByRole('button', { name: new RegExp(`^(${action}|Yes|Confirm)`, 'i') }).last().click();
      await expect(bar, 'Review banner gone').toBeHidden({ timeout: 30000 });
      const message = await kit.anyToast();
      await settle(1500);
      return message;
    },
    async bulkLog() {
      await fresh();
      await main.getByRole('button', { name: 'View Bulk Edit Log' }).click();
      const log = layer('Bulk Edit Log');
      await expect(log).toBeVisible({ timeout: 10000 });
      await expect.poll(async () => /Loading/.test(await log.innerText().catch(() => 'Loading')), { timeout: 60000, message: 'Bulk Edit Log loaded' }).toBe(false);
      const entries = (await log.getByRole('button', { name: /^Bulk Update #\d+/ }).allInnerTexts()).map(clean);
      return { log, entries };
    },

    // ---------------- Procurement Log: row Alert ----------------
    // Alert panel rows (Field Type | Condition | Value | Message | Users | Status); the run's rule is found by its message.
    async alertRow(message) { return page.getByRole('row').filter({ hasText: message }).first(); },
    // Issue justification of 27 Nov 2026: alerts are built on a numeric custom field, which the user creates in Project
    // Management › Procurement Log Configuration › "+ Add Log Fields". One "Alert Count <stamp>" field is created the first
    // time and reused by later runs (any existing "Alert Count …(Custom)" row), so the Procurement Log gains one column only.
    async ensureAlertField(stamp) {
      await navigator.open('Procurement Log Configuration');
      const rows = main.locator('tbody tr');
      await expect(rows.first(), 'Procurement Log Configuration fields listed').toBeVisible({ timeout: 30000 });
      const fieldName = async row => clean((await row.innerText()).split(/\(Custom\)/i)[0]).replace(/^\d+\s+/, '');
      const existing = rows.filter({ hasText: /Alert Count[\s\S]*\(Custom\)/i }).first();
      if (await existing.count()) return { name: await fieldName(existing), created: false };
      await main.getByRole('button', { name: /Add Log Fields/ }).click();
      const form = layer('Add Procurement Log Fields');
      await expect(form, '"Add Procurement Log Fields" form').toBeVisible({ timeout: 10000 });
      const name = `Alert Count ${stamp}`;
      await form.getByRole('textbox').first().fill(name);
      await form.getByRole('button', { name: 'Choose Field Type' }).click();
      const types = (await listbox().getByRole('option').allInnerTexts()).map(clean);
      const numeric = types.find(t => /^(number|numeric|integer|decimal)/i.test(t)) || types.find(t => /num|int|decimal/i.test(t));
      expect(numeric, `A numeric Field Type is offered (offered: ${types.join(', ')})`).toBeTruthy();
      await listbox().getByRole('option', { name: numeric, exact: true }).first().click();
      await form.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(form, 'Form closes after "Add"').toBeHidden({ timeout: 15000 });
      const row = rows.filter({ hasText: /Alert Count[\s\S]*\(Custom\)/i }).first();
      await expect(row, `"${name}(Custom)" listed`).toBeVisible({ timeout: 15000 });
      return { name: await fieldName(row), created: true, type: numeric, types };
    },
    async createAlert({ number, field, condition, value, message, user }) {
      await fresh(); await k.search(number);
      await rowMenu(number, 'Alert');
      await expect(page.getByRole('button', { name: 'Add Alert' })).toBeVisible({ timeout: 15000 });
      if (await (await v2.alertRow(message)).count()) return { created: false };
      await page.getByRole('button', { name: 'Add Alert' }).click();
      await page.getByRole('button', { name: 'Choose Field' }).click();
      const fields = (await listbox().getByRole('option').allInnerTexts()).map(clean);
      const loose = f => norm(f).replace(/[^a-z0-9]/g, '');
      const chosenField = field ? fields.find(f => loose(f) === loose(field)) : fields[0];
      expect(chosenField, `Alert Field "${field || '(first)'}" offered (offered: ${fields.join(', ') || 'none'})`).toBeTruthy();
      await listbox().getByRole('option', { name: chosenField, exact: true }).first().click();
      await k.pick('Choose Condition', condition);
      await page.getByRole('textbox', { name: 'Enter value' }).fill(String(value));
      await page.getByRole('textbox', { name: 'Enter alert message' }).fill(message);
      // Users: a multi-select of names only; the intended recipient is picked by name.
      const users = page.getByRole('button', { name: /^Choose Users?$|Select Users?/i }).filter({ visible: true }).first();
      let pickedUser = null;
      if (user && await users.isVisible().catch(() => false)) {
        await users.click();
        const option = listbox().getByRole('option', { name: user, exact: true }).first();
        await expect(option, `Recipient "${user}" offered`).toBeVisible({ timeout: 10000 });
        await option.click(); pickedUser = user;
        // The multi-select stays open after a pick and covers "Submit" (Escape does not close it): click outside the list,
        // on the dialog title, and wait for the list to close.
        await page.getByText('Create Alert', { exact: true }).filter({ visible: true }).last().click();
        await expect(listbox(), 'User list closed').toBeHidden({ timeout: 10000 });
      }
      await page.getByRole('button', { name: 'Submit', exact: true }).click();
      await toast('Alert created successfully!');
      return { created: true, field: chosenField, fields, user: pickedUser };
    },

    // ---------------- FDI configuration ----------------
    async openFdiConfig() { await navigator.open('First Delivery Inspection Config'); await expect(main.getByRole('button', { name: 'New Question Set', exact: true })).toBeVisible({ timeout: 30000 }); },
    setTab(name) { return main.getByRole('button', { name: new RegExp(`^${esc(name)}`) }).first(); },
    async fdiSetNames() {
      await v2.openFdiConfig();
      const before = main.getByRole('button', { name: 'New Question Set', exact: true });
      return (await before.locator('xpath=preceding::button').allInnerTexts()).map(clean);
    },
    // New Question Set: name, "Specific categories" ticked by search; `addCategory` is typed into "Search or add a
    // category" and added through the offered "add" control when there is one (returned as categoryAdded).
    async createFdiSet({ name, categories, addCategory }) {
      await v2.openFdiConfig();
      if (await v2.setTab(name).isVisible().catch(() => false)) return { created: false };
      await main.getByRole('button', { name: 'New Question Set', exact: true }).click();
      const form = layer('New FDI Inspection Question Set');
      await expect(form).toBeVisible({ timeout: 10000 });
      await form.getByPlaceholder('e.g. Steel Receiving Checks').fill(name);
      const search = form.getByPlaceholder(/^Search (or add a )?categor/);
      let categoryAdded = null;
      if (addCategory) {
        await search.fill(addCategory); await page.waitForTimeout(800);
        const add = form.getByRole('button', { name: new RegExp(`add.*${esc(addCategory)}|${esc(addCategory)}.*add`, 'i') }).or(form.getByText(new RegExp(`^\\+?\\s*Add\\b.*${esc(addCategory)}`, 'i'))).first();
        if (await add.isVisible().catch(() => false)) {
          await add.click(); await settle(1000);
          const label = form.locator('label', { hasText: exactI(addCategory) }).first();
          if (await label.isVisible().catch(() => false) && !(await label.locator('input[type="checkbox"]').isChecked().catch(() => true))) await label.click();
          categoryAdded = addCategory;
        }
      }
      for (const category of categories) {
        await search.fill(category); await page.waitForTimeout(800);
        const label = form.locator('label', { hasText: new RegExp(`^\\s*${esc(category)}`, 'i') }).first();
        await expect(label, `Category ${category} offered`).toBeVisible({ timeout: 10000 });
        if (!(await label.locator('input[type="checkbox"]').isChecked().catch(() => false))) await label.click();
      }
      await form.getByRole('button', { name: 'Create Question Set', exact: true }).click();
      await expect(form, 'New Question Set form closes').toBeHidden({ timeout: 15000 });
      await expect(v2.setTab(name), 'New set tab').toBeVisible({ timeout: 15000 });
      return { created: true, categoryAdded };
    },
    async selectSet(name) { await v2.openFdiConfig(); await v2.setTab(name).click(); await settle(1200); },
    groupsTable() { return main.locator('table').filter({ has: page.getByText('Heading Display Text') }).first(); },
    async addFdiGroup(set, group) {
      await v2.selectSet(set);
      if (!(await main.getByRole('button', { name: 'Add Group', exact: true }).isVisible().catch(() => false))) await main.getByRole('button', { name: /^Manage Groups/ }).click();
      if (await v2.groupsTable().locator('tbody tr').filter({ hasText: group }).count()) return { created: false };
      await main.getByRole('button', { name: 'Add Group', exact: true }).click();
      const form = layers().filter({ has: page.locator('input') }).last();
      await expect(form, 'Add Group form').toBeVisible({ timeout: 10000 });
      for (const input of await form.locator('input:not([type="checkbox"]):not([type="hidden"])').all()) await input.fill(group);
      await form.getByRole('button', { name: /^(Add|Save|Create)$/ }).first().click();
      await expect(v2.groupsTable().locator('tbody tr').filter({ hasText: group }).first(), `Group ${group} listed`).toBeVisible({ timeout: 15000 });
      return { created: true };
    },
    questionTable() { return main.locator('table').filter({ has: page.getByText('Added On') }).first(); },
    questionRow(text) { return v2.questionTable().locator('tbody tr').filter({ hasText: text }).first(); },
    async addFdiQuestion(set, text, type) {
      await v2.selectSet(set);
      if (await v2.questionRow(text).count()) return { created: false };
      await main.getByRole('button', { name: 'Add Question', exact: true }).click();
      const form = layer('Add Question');
      await expect(form).toBeVisible({ timeout: 10000 });
      await expect(form.getByText(`Adding to Question Set: ${set}`), 'Question goes to the run set').toBeVisible();
      await form.locator('label', { hasText: 'Question Text' }).locator('xpath=following::input[1]').fill(text);
      await form.getByRole('button', { name: 'Choose Answer Type' }).click();
      await listbox().getByRole('option', { name: type, exact: true }).click();
      await form.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(form).toBeHidden({ timeout: 15000 });
      await expect(v2.questionRow(text), `${text} listed`).toBeVisible({ timeout: 15000 });
      return { created: true };
    },
    async setQuestionGroup(set, text, group) {
      await v2.selectSet(set);
      const select = v2.questionRow(text).locator('select');
      if (clean(await select.locator('option:checked').innerText().catch(() => '')) !== group) { await select.selectOption({ label: group }); await settle(1500); }
    },
    // Questions of the set: [{ text, group, type, status }] (columns #, Question, Group, Type, Added On, Status, Actions).
    async setQuestions(set) {
      await v2.selectSet(set);
      return v2.questionTable().locator('tbody tr').evaluateAll(rs => rs.map(r => {
        const c = [...r.cells];
        return { text: (c[1]?.innerText || '').trim(), group: c[2]?.querySelector('select')?.selectedOptions[0]?.text?.trim() || (c[2]?.innerText || '').trim(), type: (c[3]?.innerText || '').trim(), status: (c[5]?.innerText || '').trim() };
      }));
    },
    inspectorRow(text) { return main.locator('table').filter({ has: page.getByText('Materials Scope') }).first().locator('tbody tr').filter({ hasText: text }).first(); },
    // Add Inspector: member by e-mail, a project role (preferred, else the first), "Specific Materials" → the material.
    async addInspector({ email, role, material }) {
      await v2.openFdiConfig();
      // The inspectors table fills after the page: wait for its rows before deciding the member is not listed yet.
      const table = main.locator('table').filter({ has: page.getByText('Materials Scope') }).first();
      await table.locator('tbody tr').first().waitFor({ timeout: 30000 }).catch(() => null);
      await v2.inspectorRow(email).waitFor({ timeout: 5000 }).catch(() => null);
      if (await v2.inspectorRow(email).count()) return { created: false, row: clean(await v2.inspectorRow(email).innerText()) };
      await main.getByRole('button', { name: 'Add Inspector', exact: true }).click();
      const form = layer('Add Inspector');
      await expect(form).toBeVisible({ timeout: 10000 });
      const member = form.locator('select').nth(0); const roleSelect = form.locator('select').nth(1);
      await expect.poll(async () => (await member.locator('option').allInnerTexts()).some(o => o.toLowerCase().includes(email.toLowerCase())), { timeout: 20000, message: `${email} listed as a project member` }).toBe(true);
      const memberLabel = clean((await member.locator('option').allInnerTexts()).find(o => o.toLowerCase().includes(email.toLowerCase())));
      await member.selectOption({ label: memberLabel });
      const roles = (await roleSelect.locator('option').allInnerTexts()).map(clean).filter(o => o && !/^—/.test(o));
      const chosenRole = roles.find(r => norm(r) === norm(role)) || roles[0];
      await roleSelect.selectOption({ label: chosenRole });
      await form.getByText('Specific Materials', { exact: true }).click();
      // 25 Nov 2026: the material list fills after a delay and the full name once found nothing ("No material matches
      // that search") – wait for it, then retry with the last word of the name, before reporting what is offered.
      const search = form.getByPlaceholder(/Search materials/);
      const option = form.locator('label', { hasText: exactI(material) }).first();
      const offered = () => option.waitFor({ timeout: 15000 }).then(() => true, () => false);
      let found = false;
      for (const query of [material, String(material).split(/\s+/).pop(), '']) {
        if (await search.isVisible().catch(() => false)) { await search.fill(''); await search.pressSequentially(query, { delay: 40 }); }
        if ((found = await offered())) break;
      }
      if (!found) throw new Error(`Add Inspector › Specific Materials does not offer "${material}". Offered: ${clean(await form.innerText()).split('Materials').pop().slice(0, 300)}`);
      await option.click();
      await form.getByRole('button', { name: 'Add', exact: true }).click();
      // The app refuses a member who is already an inspector ("This person is already on the Inspectors list for this
      // project."): close the form and report the existing row.
      const already = form.getByText(/already on the Inspectors list/i);
      await expect.poll(async () => (await already.isVisible().catch(() => false)) || !(await form.isVisible().catch(() => false)), { timeout: 15000, message: 'Add Inspector form closes' }).toBe(true);
      if (await already.isVisible().catch(() => false)) {
        await form.getByRole('button', { name: /^(Close|×|✕)$/ }).first().click().catch(() => page.keyboard.press('Escape'));
        await expect(form).toBeHidden({ timeout: 10000 }).catch(() => page.keyboard.press('Escape'));
        await expect(v2.inspectorRow(email), 'Existing inspector listed').toBeVisible({ timeout: 15000 });
        return { created: false, row: clean(await v2.inspectorRow(email).innerText()) };
      }
      await expect(v2.inspectorRow(email), 'Inspector listed').toBeVisible({ timeout: 15000 });
      return { created: true, member: memberLabel, role: chosenRole, row: clean(await v2.inspectorRow(email).innerText()) };
    },

    // ---------------- FDI inspection ----------------
    async openFdiList() {
      await navigator.clearLayers();
      await k.menu('First Delivery Inspections').catch(() => page.goto('/first-delivery-inspections', { waitUntil: 'domcontentloaded' }));
      await v2.keepSite('First Delivery Inspections list');
      await expect(main.getByRole('combobox').first(), 'FDI filters').toBeVisible({ timeout: 30000 });
      // Since 24 Nov 2026 the list opens grouped by material category, which hides the Supplier and Status filters and
      // the inspection rows: untick the grouping (the filters are then Material, Supplier, Status in that order).
      const group = main.getByRole('checkbox', { name: 'Group by material category' });
      if (await group.isChecked().catch(() => false)) { await group.uncheck(); await settle(2500); }
      await settle(1500);
    },
    async fdiFilter({ material, supplier, status }) {
      const f = main.getByRole('combobox');
      if (material) await f.nth(0).selectOption({ label: material });
      if (supplier) await f.nth(1).selectOption({ label: supplier });
      if (status) await f.nth(2).selectOption({ label: status });
      await settle(1500);
    },
    fdiRow(submittal) { return fdi.rows().filter({ has: page.getByRole('cell', { name: submittal, exact: true }) }).first(); },

    // ---------------- Reference data and Analytics ----------------
    async configuredCurrency() {
      await navigator.open('Configuration Options');
      const block = main.locator('div.justify-between', { has: page.locator('p', { hasText: /^Currency Type/ }) }).last();
      await expect(block, 'Currency Type setting').toBeVisible({ timeout: 20000 });
      return clean(await block.getByRole('button').first().innerText());
    },
    async listText(label) { await navigator.open(label); await settle(1500); return main.innerText(); },
    async statusReportRow(number) {
      await k.menu('Status Report', 'Analytics').catch(() => page.goto('/status-report', { waitUntil: 'domcontentloaded' })); await settle(2500);
      const generate = main.getByRole('button', { name: 'Generate', exact: true });
      if (await generate.isVisible().catch(() => false)) { await generate.click(); await settle(2500); }
      const table = main.locator('table').filter({ hasText: 'QTY Delivered On Time' }).first();
      await expect(table, 'Status Report "Status by Submittal" table').toBeVisible({ timeout: 30000 });
      const heads = (await table.locator('thead th').allInnerTexts()).map(clean);
      const row = table.locator('tbody tr').filter({ has: page.locator('td:first-child', { hasText: exactI(number) }) }).first();
      if (!(await row.count())) return { heads, cells: null, values: null };
      const cells = (await row.locator('td').allInnerTexts()).map(clean);
      // The header holds an extra title cell ("STATUS BY SUBMITTAL"): the column names are the last cells.length headers.
      const names = heads.slice(-cells.length);
      return { heads: names, cells, values: Object.fromEntries(names.map((h, i) => [h, cells[i]])) };
    },
    // ---------------- Analytics sweep (before / after) ----------------
    // Every Analytics page of the menu (APP_MAP_SWEEP): opened through the menu, the selected location verified, sub-tabs
    // (role=tab or "By …" / period toggles) visited, the page scrolled to the bottom with a screenshot per screen, then:
    // filters (comboboxes / date inputs / pressed toggles), KPI values (label → number outside tables) and every table
    // (headers + rows keyed by the first cell). Read-only: nothing is generated, exported or dismissed.
    ANALYTICS_PAGES: ['Aggregate Stats', 'Lead Time Analysis', 'Supply Chain Intelligence', 'Emissions Report', 'Inventory Reports',
      'Status Report', 'SubContractor Issues', 'Supplier Issues', 'TOV Analytics'],
    async analyticsPage(name, phase) {
      await navigator.clearLayers();
      await k.menu(name, 'Analytics');
      await settle(2500);
      await v2.keepSite(`Analytics › ${name}`);
      await expect.poll(async () => (await main.innerText().catch(() => '')).trim().length, { timeout: 30000, message: `${name} content` }).toBeGreaterThan(20);
      // Status Report shows data after "Generate" (a read-only report run with the default filters).
      const generate = main.getByRole('button', { name: 'Generate', exact: true });
      if (await generate.isVisible().catch(() => false)) { await generate.click(); await settle(3000); }
      const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
      const shots = [];
      const scrollAndShoot = async label => {
        const box = await page.evaluate(() => {
          const els = [document.scrollingElement, ...document.querySelectorAll('main, main *')].filter(e => e && e.scrollHeight > e.clientHeight + 40 && getComputedStyle(e).overflowY !== 'visible');
          els.sort((a, b) => b.scrollHeight - a.scrollHeight);
          const el = els[0] || document.scrollingElement; el.setAttribute('data-e2e-scroll', '1');
          return { h: el.scrollHeight, c: el.clientHeight };
        });
        const screens = Math.min(8, Math.max(1, Math.ceil(box.h / Math.max(1, box.c))));
        for (let i = 0; i < screens; i += 1) {
          await page.evaluate(i2 => { const el = document.querySelector('[data-e2e-scroll]'); if (el) el.scrollTop = i2 * el.clientHeight; }, i);
          await settle(700);
          const file = `screenshots/analytics-${phase}-${slug(name)}${label ? `-${slug(label)}` : ''}-${i + 1}.png`;
          await page.screenshot({ path: path.join(outDir, file) }).catch(() => null);
          shots.push(file);
        }
        await page.evaluate(() => { const el = document.querySelector('[data-e2e-scroll]'); if (el) { el.scrollTop = 0; el.removeAttribute('data-e2e-scroll'); } });
      };
      const read = () => page.evaluate(() => {
        const c = t => String(t || '').replace(/\s+/g, ' ').trim();
        const root = document.querySelector('main') || document.body;
        const filters = [...root.querySelectorAll('[role="combobox"], select, input[type="date"], input[placeholder*="date" i], button[aria-pressed="true"], [data-state="active"]')]
          .map(e => c(e.value || e.innerText || e.getAttribute('aria-label') || e.placeholder)).filter(Boolean).slice(0, 20);
        const tables = [...root.querySelectorAll('table')].map(t => {
          const heads = [...t.querySelectorAll('thead th')].map(h => c(h.innerText));
          const rows = [...t.querySelectorAll('tbody tr')].map(r => [...r.cells].map(x => c(x.innerText))).filter(r => r.some(Boolean)).slice(0, 200);
          return { heads, rows };
        }).filter(t => t.rows.length || t.heads.length);
        const clone = root.cloneNode(true);
        clone.querySelectorAll('table, svg, script, style').forEach(e => e.remove());
        document.body.appendChild(clone); clone.style.position = 'absolute'; clone.style.left = '-99999px';
        const lines = clone.innerText.split('\n').map(c).filter(Boolean);
        clone.remove();
        const metrics = {};
        const numeric = l => /\d/.test(l) && /^[\s\d.,%$₹€£+\-−()/:×xkKmMbB]*(of\s*[\d.,]+)?[\s\w%]{0,12}$/.test(l) && l.length <= 40;
        for (let i = 1; i < lines.length; i += 1) {
          if (!numeric(lines[i]) || numeric(lines[i - 1])) continue;
          let key = lines[i - 1].slice(0, 80); let n = 2;
          while (metrics[key] !== undefined) key = `${lines[i - 1].slice(0, 80)} (${n++})`;
          metrics[key] = lines[i];
        }
        const headings = [...root.querySelectorAll('h1,h2,h3,h4')].map(h => c(h.innerText)).filter(Boolean).slice(0, 40);
        return { filters, tables, metrics, headings };
      });
      // Sub-tabs: role=tab, else "By …" toggles (Emissions Report). Period toggles are recorded as filters, not clicked.
      let tabs = await main.getByRole('tab').filter({ visible: true }).allInnerTexts().then(x => x.map(clean).filter(Boolean)).catch(() => []);
      let tabKind = 'tab';
      if (!tabs.length) { tabs = (await main.getByRole('button').filter({ visible: true }).allInnerTexts().catch(() => [])).map(clean).filter(t => /^By [A-Z]/.test(t)); tabKind = 'button'; }
      const sections = [];
      if (!tabs.length) {
        await scrollAndShoot('');
        sections.push({ tab: '(page)', ...(await read()) });
      } else {
        for (const t of [...new Set(tabs)].slice(0, 8)) {
          await main.getByRole(tabKind, { name: t, exact: true }).first().click().catch(() => null);
          await settle(2000);
          await scrollAndShoot(t);
          sections.push({ tab: t, ...(await read()) });
        }
        await main.getByRole(tabKind, { name: tabs[0], exact: true }).first().click().catch(() => null);
      }
      return { page: name, phase, url: new URL(page.url()).pathname, at: new Date().toISOString(), tabs, sections, shots };
    },
    // Configuration Options: every "label → value" setting (Currency Type, …).
    async configurationOptions() {
      await navigator.open('Configuration Options'); await settle(1500);
      // 23 Nov 2026: read too early, a dropdown still shows its placeholder "Choose" (Currency Type "Choose" → "INR" was
      // reported as a change). Re-read for up to ~16 s until no dropdown shows the placeholder.
      const read = () => page.evaluate(() => {
        const c = t => String(t || '').replace(/\s+/g, ' ').trim();
        const out = {};
        // Each setting is a "justify-between" row: first <p> = label (its "?" More-info button removed), then either a
        // dropdown (div[role=button] showing the value) or a toggle (rounded track, "bg-primaryColor" when on).
        for (const row of document.querySelectorAll('main div.justify-between')) {
          const p = row.querySelector('p');
          if (!p) continue;
          const label = c([...p.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ')) || c(p.innerText).replace(/\s*\?$/, '');
          if (!label || label.length > 80 || out[label] !== undefined) continue;
          const drop = row.querySelector('[role="button"][aria-haspopup], [role="combobox"], select, input:not([type="checkbox"])');
          const toggle = row.querySelector('div.rounded-full:not(button)');
          const sw = row.querySelector('[role="switch"], input[type="checkbox"]');
          if (drop) out[label] = c(drop.value || drop.innerText);
          else if (sw) out[label] = (sw.getAttribute('aria-checked') === 'true' || sw.checked) ? 'On' : 'Off';
          else if (toggle && toggle.querySelector('span')) out[label] = /bg-primaryColor/.test(toggle.className) ? 'On' : 'Off';
        }
        return out;
      });
      let out = {};
      for (let n = 0; n < 8; n++) {
        out = await read();
        if (!Object.values(out).some(v => /^Choose$/i.test(v))) break;
        await page.waitForTimeout(2000);
      }
      return out;
    },

    async leadTimeAnalysisRow(category) {
      await k.menu('Lead Time Analysis', 'Analytics').catch(() => page.goto('/lead-time-analysis', { waitUntil: 'domcontentloaded' })); await settle(2500);
      await expect.poll(async () => /LEAD TIME COMPARISON BY CATEGORY/i.test(await main.innerText()), { timeout: 30000, message: 'Lead Time Analysis loads' }).toBe(true);
      const table = main.locator('table').filter({ hasText: /CATEGORY/i }).first();
      const heads = (await table.locator('thead th').allInnerTexts()).map(clean);
      const row = table.locator('tbody tr').filter({ has: page.locator('td:first-child', { hasText: exactI(category) }) }).first();
      return { heads, cells: (await row.count()) ? (await row.locator('td').allInnerTexts()).map(clean) : null };
    }
  };
  return v2;
}

module.exports = { e2eKitV2, nextSeq };
