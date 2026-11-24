// Shared Procurement Log steps for pl-smoke / pl-regression (behaviour observed in MCP discovery, 2 Nov 2026:
// docs/functional-discovery/PROCUREMENT_LOG_FUNCTIONAL_DISCOVERY.md). One sign-in per run, menu navigation only.
const { expect } = require('@playwright/test');
const { LoginPage } = require('../../../pages/login.page');
const { PlatformChooserPage } = require('../../../pages/platform-chooser.page');
const { ProjectSelectorPage } = require('../../../pages/project-selector.page');
const { SiteSelectorPage } = require('../../../pages/site-selector.page');

const SITE = process.env.SCP_PL_SITE || process.env.SCP_DEMO_SITE || 'Warehoust _NR';
const SUPPLIER = process.env.SCP_PL_SUPPLIER || 'LG';
const MATERIAL = process.env.SCP_PL_MATERIAL || '43 Inches';
// Menu layout of the staging release of 23 Nov 2026 (evening): the label shown in the menu, and the Project Management
// sub-group that holds the entry.
const MENU_LABEL = { 'Site Details': 'Sites & Storage' };
const MENU_GROUP = {
  'Configuration Options': 'Project Settings', 'Procurement Log Configuration': 'Project Settings', 'First Delivery Inspection Config': 'Project Settings', 'System Messages': 'Project Settings',
  'Material Master': 'Materials', 'Material Category': 'Materials', 'Common UoM': 'Materials', 'Common Utilities': 'Materials', 'Watched Materials': 'Materials',
  'Inventory Control': 'Inventory Settings', 'Inventory Rebuild': 'Inventory Settings',
  'Excel Import': 'Imports', 'Bulk Upload Status': 'Imports', 'Submittal Manager': 'Imports',
  'Booking Integration': 'Integrations', 'TheLink Integration': 'Integrations', 'XER Import': 'Integrations'
};
// The server checks "PO date cannot be in the future" against its own UTC date, so from 00:00 to 05:30 IST the browser's
// "today" is rejected (SCP-DEF-074, confirmed by a probe on 22 Nov 2026 at 02:15 IST). PO dates therefore use the earlier
// of the browser date and the server date; outside that window both are the same day.
function poToday() {
  const now = new Date();
  const local = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const utc = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return utc < local ? utc : local;
}

function plKit(page) {
  const main = page.locator('main');
  const listbox = () => page.getByRole('listbox').last();
  const settle = async (ms = 500) => { await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null); await page.waitForTimeout(ms); };
  const toast = async (text, timeout = 15000) => expect(page.getByRole('status').filter({ hasText: text }).first()).toBeVisible({ timeout });
  const count = async () => Number(((await main.innerText()).match(/(\d+) items?/) || [])[1] || NaN);
  const rows = () => main.locator('table tbody tr').filter({ has: page.locator('td') }).filter({ hasNotText: /no (data|submittals?|records?)|not found/i });

  const kit = {
    main, listbox, settle, toast, count, rows, SITE, SUPPLIER, MATERIAL,
    async signIn(s, config) {
      await s.step('Open the Voyage Control SSO login page → heading "Welcome To Voyage Control" is shown', async () => {
        await page.goto(config.loginUrl, { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('heading', { name: 'Welcome To Voyage Control' })).toBeVisible({ timeout: 30000 });
      }, { critical: true });
      await s.step('Enter the Project Admin email and password, click Sign in → the signed-in email heading is shown (platform chooser)', async () => {
        await new LoginPage(page).login(config.username, config.password);
        await expect(page.getByRole('heading', { name: config.username, exact: true })).toBeVisible({ timeout: 30000 });
      }, { critical: true });
      await s.step('Platform chooser › "Supply Chain Planner" tile → app opens on /management-dashboard', async () => {
        await new PlatformChooserPage(page, config).openSupplyChainPlanner();
        await expect(page).toHaveURL(/\/management-dashboard\/?$/, { timeout: 30000 });
      }, { critical: true });
      await s.step(`Header project selector › choose "${config.projectName}" → project name shown in the header`, () => new ProjectSelectorPage(page, config).ensureProject(config.projectName), { critical: true });
      await s.step(`Header site selector › choose "${SITE}" → site name shown in the header`, () => new SiteSelectorPage(page).ensureSite(SITE), { critical: true });
    },
    // "Choose user" lists only the first 25 users; find the user through the list's own Search box. Searching the full
    // e-mail returns nothing (the search ignores text with "@", 19 Nov 2026), so the part before "@" is typed.
    async chooseUser(email) {
      await page.getByRole('button', { name: 'Choose user' }).click();
      const search = listbox().locator('input[placeholder^="Search"]');
      if (await search.isVisible().catch(() => false)) { await search.fill(email.split('@')[0]); await settle(1000); }
      await listbox().getByRole('option', { name: new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first().click();
    },
    // Row "Assign Responsible" opens, since the staging release of 23 Nov 2026 (evening), the dialog "Responsible — <number>":
    // a list of the people already responsible, "Add a Responsible person" (user chooser) with "Add", and "Done".
    responsibleDialog() {
      return page.getByRole('heading', { name: /^Responsible — / }).last().locator('xpath=ancestor::div[.//button[normalize-space()="Done"]][1]');
    },
    async addResponsible(email, choose = () => kit.chooseUser(email)) {
      const d = kit.responsibleDialog();
      await expect(d, '"Responsible" dialog').toBeVisible({ timeout: 10000 });
      const label = await choose();
      await d.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(d, 'person listed as Responsible').not.toContainText('Nobody is Responsible', { timeout: 10000 });
      await settle(800);
      const listed = (await d.innerText()).replace(/\s+/g, ' ');
      await d.getByRole('button', { name: 'Done', exact: true }).click();
      await expect(page.getByRole('heading', { name: /^Responsible — / })).toHaveCount(0, { timeout: 10000 });
      return { label, listed };
    },
    // Location lists follow the header venue, which resets after every reload (OBS-INV-12): put it back before using them.
    keepSite: () => new SiteSelectorPage(page).keepSite(SITE),
    // Menu groups collapse after each navigation, so the parent is re-expanded when the child is hidden.
    async menu(name, group) {
      const nav = page.locator('nav');
      // Menu items can carry a counter badge (e.g. "International Shipments 38", 19 Nov 2026): allow a trailing number.
      const label = n => new RegExp(`^\\s*${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s+\\d+\\+?)?\\s*$`);
      // Staging release of 23 Nov 2026 (evening): "Site Details" is listed as "Sites & Storage", Project Management is
      // grouped one level deeper, and some pages (PreShipping Checklist, International Shipments) are no longer in the
      // menu. When the entry cannot be clicked, the page is opened by its route (page name in lower case with dashes,
      // e.g. "Site Details" → /site-details); a removed page then shows up as a redirect in the scenario.
      const shown = MENU_LABEL[name] || name;
      try {
        let item = nav.getByRole('button', { name: label(shown) }).last();
        if (group && !(await item.isVisible().catch(() => false))) { await nav.getByRole('button', { name: label(group) }).first().click(); item = nav.getByRole('button', { name: label(shown) }).last(); }
        if (!(await item.isVisible().catch(() => false)) && MENU_GROUP[name]) {
          const sub = nav.getByRole('button', { name: label(MENU_GROUP[name]) }).first();
          if (await sub.isVisible().catch(() => false)) await sub.click();
          item = nav.getByRole('button', { name: label(shown) }).last();
        }
        await item.click({ timeout: 8000 });
      } catch {
        const route = '/' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        await page.goto(route, { waitUntil: 'domcontentloaded' });
      }
      await settle(1500);
    },
    async openLog() {
      // A leftover drawer or dialog can cover the menu; fall back to the route.
      await kit.menu('Procurement Log').catch(() => page.goto('/procurement-log', { waitUntil: 'domcontentloaded' }));
      await expect(page).toHaveURL(/\/procurement-log/);
      // Since the 23 Nov 2026 (evening) release the page has view tabs (List / By submittal / By material / Inventory) and
      // keeps the last one; the old Inventory Management route opens the "Inventory" tab. Switch back to "List".
      const list = page.getByRole('tab', { name: 'List', exact: true });
      if (await list.isVisible().catch(() => false) && (await list.getAttribute('aria-selected')) !== 'true') { await list.click(); await settle(1000); }
      // After a load the grid briefly shows "0 items" until the site resolves.
      await expect.poll(count, { message: 'Procurement Log item count', timeout: 30000 }).toBeGreaterThan(0);
    },
    async search(text) {
      // On the list page no drawer covers the header: restore the venue here, before any component is opened.
      if (/\/procurement-log/.test(page.url()) && !/[?&](submittal|schedule)=/.test(page.url())) await kit.keepSite();
      const box = page.getByRole('textbox', { name: 'Search submittals…' });
      await box.fill(text); await box.press('Enter'); await settle(1000);
    },
    async pick(trigger, option, scope = page) {
      await scope.getByRole('button', { name: trigger }).first().click();
      await listbox().getByRole('option', { name: option, exact: true }).first().click();
    },
    // Calendar inputs are read-only: open the picker (retry if it does not open) and click the day button.
    async day(field, date) {
      const label = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const cell = page.getByRole('button', { name: label });
      for (let i = 0; i < 3 && !(await cell.isVisible().catch(() => false)); i++) { await field.click(); await page.waitForTimeout(600); }
      // The picker has month and year dropdowns; a date in another year (e.g. 1 Jan 2027 while on 2026) needs both.
      const year = page.getByRole('combobox').filter({ has: page.locator('option', { hasText: String(date.getFullYear()) }) }).filter({ hasNot: page.locator('option', { hasText: 'January' }) }).last();
      if (!(await cell.isVisible().catch(() => false)) && await year.isVisible().catch(() => false)) await year.selectOption(String(date.getFullYear()));
      const month = page.getByRole('combobox').filter({ has: page.locator('option', { hasText: 'January' }) }).last();
      if (!(await cell.isVisible().catch(() => false)) && await month.isVisible().catch(() => false)) await month.selectOption(date.toLocaleDateString('en-US', { month: 'long' }));
      await cell.click();
      await expect(cell).toBeHidden({ timeout: 5000 }).catch(() => page.keyboard.press('Escape'));
    },
    dialog(heading, button) {
      return page.getByRole('heading', { name: heading, exact: true }).locator(`xpath=ancestor::div[.//button[normalize-space()="${button}"]][1]`);
    },
    async closeDialog(heading) {
      const h = page.getByRole('heading', { name: heading, exact: true });
      // The dialog may close by itself between the check and the click (seen 21 Nov 2026 on Add Delivery), so the click is
      // short and optional; Escape is the fallback.
      if (await h.isVisible().catch(() => false)) await h.locator('xpath=..').getByRole('button').first().click({ timeout: 5000 }).catch(() => null);
      if (await h.isVisible().catch(() => false)) await page.keyboard.press('Escape');
      await expect(h).toBeHidden({ timeout: 10000 });
    },
    async addSubmittal({ spec, description, scheduleId, number, supplier = SUPPLIER, materials = [MATERIAL] }) {
      await main.getByRole('button', { name: 'Add Submittal', exact: true }).click();
      const m = page.getByRole('heading', { name: 'Add Submittal' }).locator('xpath=../..');
      const tb = m.getByRole('textbox');
      await tb.nth(0).fill(spec); await tb.nth(1).fill(description); await tb.nth(2).fill(String(scheduleId)); await tb.nth(3).fill(number);
      await kit.pick('Choose Suppliers', supplier, m);
      await m.getByRole('button', { name: 'Choose Materials' }).click();
      for (const mat of materials) await listbox().getByRole('option', { name: mat, exact: true }).click();
      await page.getByRole('heading', { name: 'Add Submittal' }).click();
      await m.getByRole('button', { name: 'Add', exact: true }).click();
    },
    async openSubmittal(description) {
      await main.getByRole('cell', { name: description, exact: true }).click();
      await expect(page).toHaveURL(/[?&]submittal=/);
      await kit.addComponentButton().waitFor({ timeout: 30000 });
    },
    // Staging release of 23 Nov 2026 (evening): the submittal page is redesigned and the button reads "Add component";
    // the dialog it opens is still headed "Add Component".
    addComponentButton() { return page.getByRole('button', { name: /^Add component$/i }).last(); },
    async addComponent({ rojDate, qty, value, po, poDate, material }) {
      await kit.addComponentButton().click();
      const m = kit.dialog('Add Component', 'ADD');
      if (material) { await m.getByRole('button', { name: /\(primary\)/ }).click(); await listbox().getByRole('option', { name: material }).click(); }
      // Fields are located by their labels: the number of read-only textboxes varies with the material.
      const field = label => m.getByText(label, { exact: true }).locator('xpath=following::input[1]');
      await kit.day(field('Date Req. on Site*'), rojDate);
      await field('QTY*').fill(String(qty));
      // The value label now carries the project currency ("Value INR").
      if (value) await m.getByText(/^Value( [A-Z]{3})?$/).first().locator('xpath=following::input[1]').fill(String(value));
      // Some forms ask for a required Sub Material (the item) instead of pre-filling it (seen 2 Nov on the regression run).
      const sub = m.getByRole('button', { name: 'Choose Sub Material' });
      if (await sub.isVisible().catch(() => false)) {
        await sub.click();
        const exact = listbox().getByRole('option', { name: material || MATERIAL, exact: true });
        await ((await exact.count()) ? exact.first() : listbox().getByRole('option').first()).click();
      }
      if (po) { await field('PO no.').fill(po); await kit.day(field('PO Date'), poDate && poDate > poToday() ? poToday() : poDate); }
      await m.getByRole('button', { name: 'ADD', exact: true }).click();
      try {
        await toast('Schedule added successfully!');
      } catch (error) {
        // Show the form's own message and close the dialog, so a retry is not blocked by the open dialog.
        const message = ((await m.innerText().catch(() => '')).match(/Invalid data provided\.?|[^\n]*\b(?:required|cannot|must)\b[^\n]*/i) || [])[0];
        await kit.closeDialog('Add Component').catch(() => null);
        if (message) throw new Error(`Add Component was not saved; the form shows "${message.trim()}"`);
        throw error;
      }
    },
    // ---------- Submittal and component pages as redesigned by the staging release of 23 Nov 2026 (evening) ----------
    // The component list is a grid (no table roles): one row per component with a "Select <material>" checkbox, the
    // status pill in the 4th column, a "Next step" button and a "More actions for <material>" (⋯) menu with Lead time,
    // Record order (PO), Log delivery, Open component, Edit component, Trigger alert, Update status, Audit trail, Delete.
    componentRow(material = MATERIAL) {
      return page.getByRole('checkbox', { name: `Select ${material}`, exact: true }).last().locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " grid ")][1]');
    },
    componentRows() {
      return page.getByRole('checkbox', { name: /^Select (?!all components$)/ }).locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " grid ")][1]');
    },
    async componentsLoaded() { await page.getByRole('checkbox', { name: 'Select all components' }).last().waitFor({ timeout: 30000 }); await settle(1000); },
    // From the component view back to its submittal with the panel's back arrow (the unlabeled button before the
    // "<submittal> › Component" breadcrumb), or browser Back. No reload: a reload resets the header site (OBS-INV-12).
    async backToSubmittal() {
      if (!/[?&]schedule=/.test(page.url())) return;
      const back = page.getByText(/› Component$/).filter({ visible: true }).last().locator('xpath=preceding::button[1]');
      if (await back.isVisible().catch(() => false)) await back.click(); else await page.goBack();
      if (/[?&]schedule=/.test(page.url())) await expect(page).not.toHaveURL(/[?&]schedule=/, { timeout: 10000 }).catch(() => page.goBack());
      await kit.componentsLoaded();
    },
    async componentStatus(material = MATERIAL) {
      await kit.backToSubmittal();
      const row = kit.componentRow(material);
      await row.waitFor({ timeout: 30000 });
      // The pill shows "—" for a moment after the component is added or the page opens.
      const read = async () => (await row.locator('xpath=./*[4]').innerText()).split('\n')[0].trim();
      let status = await read();
      for (let i = 0; i < 20 && (!status || status === '—' || status === '-'); i++) { await page.waitForTimeout(500); status = await read(); }
      return status;
    },
    async componentAction(material, item) {
      await kit.backToSubmittal();
      await page.getByRole('button', { name: `More actions for ${material}`, exact: true }).last().click();
      await page.getByRole('menuitem', { name: item, exact: true }).click();
    },
    logDeliveryButton() { return page.getByRole('button', { name: 'Log delivery', exact: true }).last(); },
    // Component view (URL has schedule=): heading = material, "Log delivery", tabs Deliveries / Files / All files / Stock.
    async openComponent(material = MATERIAL) {
      await kit.componentAction(material, 'Open component');
      await expect(page).toHaveURL(/[?&]schedule=/, { timeout: 20000 });
      await kit.logDeliveryButton().waitFor({ timeout: 30000 }); await settle(1000);
    },
    // Delivery rows of the component view: "Expected" rows offer "Receive"; "Received" rows start with the receipt
    // number (RCV-…). Each row has a "Delivery actions" (⋯) menu: Pre-shipping info, Approve pre-shipping checklist,
    // Edit delivery details, Delete delivery, Files; after receipt also Update shipping info, Update delivery
    // condition, Generate GRN, Correct delivery, View delivery details, Raise NCR….
    deliveryRows() {
      return page.getByRole('button', { name: 'Delivery actions', exact: true }).filter({ visible: true }).locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " grid ")][1]');
    },
    expectedRows() { return kit.deliveryRows().filter({ has: page.getByRole('button', { name: 'Receive', exact: true }) }); },
    // Located from the receipt number itself: its nearest grid ancestor is the delivery row.
    receivedRow(receipt) { return page.getByText(receipt).filter({ visible: true }).last().locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " grid ")][1]'); },
    async receipts() { return (await kit.deliveryRows().allInnerTexts()).map(t => (t.match(/RCV-\d+/) || [])[0]).filter(Boolean); },
    async deliveryMenu(row) {
      await row.getByRole('button', { name: 'Delivery actions', exact: true }).click();
      const items = (await page.getByRole('menuitem').allInnerTexts()).map(t => t.trim());
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      return items;
    },
    async deliveryAction(row, item) {
      await row.getByRole('button', { name: 'Delivery actions', exact: true }).click();
      await page.getByRole('menuitem', typeof item === 'string' ? { name: item, exact: true } : { name: item }).first().click();
    },
    async addDelivery({ material = MATERIAL, qty, date = new Date() }) {
      await kit.logDeliveryButton().click();
      const d = kit.dialog('Add Delivery', 'Add');
      await kit.day(d.getByRole('textbox').first(), date);
      await d.getByRole('button', { name: /^(All Locations|Choose Location)$/ }).click();
      const location = listbox().getByRole('option').filter({ hasNotText: /^(All Locations|Choose Location)$/ }).first();
      const locationName = (await location.innerText()).trim();
      await location.click();
      await d.getByRole('button', { name: 'Choose Item Name' }).click(); await listbox().getByRole('option', { name: material, exact: true }).first().click();
      await d.getByRole('spinbutton').first().fill(String(qty));
      await d.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Add Delivery', exact: true })).toBeHidden({ timeout: 20000 });
      await settle(1500);
      return { location: locationName, row: kit.expectedRows().last() };
    },
    // Supplier side: every question YES with a comment, supplier note, Confirm Checklist (PL-R16, BUGS-155).
    async preShipping(row, tag) {
      await kit.deliveryAction(row, 'Pre-shipping info');
      const c = kit.dialog('Add Pre-Shipping Details', 'Confirm Checklist');
      await c.getByRole('button', { name: 'Y/N', exact: true }).first().waitFor({ timeout: 20000 }); // questions load after the dialog opens
      const inputs = c.locator('input:visible:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])');
      const count = await inputs.count();
      for (let i = 0; i < count; i++) await inputs.nth(i).fill(`${tag} answer ${i + 1}`);
      const yn = page.getByRole('button', { name: 'Y/N', exact: true });
      let answered = 0;
      for (; (await yn.count()) > 0 && answered < 60; answered++) { await yn.first().click(); await page.getByRole('option', { name: 'YES', exact: true }).click(); }
      await c.locator('textarea:visible').first().fill(`${tag} supplier note`);
      await c.getByRole('button', { name: 'Confirm Checklist', exact: true }).click();
      await toast('Shipping Details updated successfully!');
      return { comments: count, answered };
    },
    async approveChecklist(row, note) {
      await kit.deliveryAction(row, 'Approve pre-shipping checklist');
      const a = kit.dialog('Approve Pre-Shipping Checklist', 'Approve');
      await a.locator('textarea').last().fill(note);
      await a.getByRole('button', { name: 'Approve', exact: true }).click();
      await toast('Checklist Generated Successfully!');
    },
    // "Receive" opens "Edit Delivery": the actual date is set and the delivery moves to "Received" with a new RCV number.
    async receive(row, date = new Date()) {
      const before = await kit.receipts();
      await row.getByRole('button', { name: 'Receive', exact: true }).click();
      const e = kit.dialog('Edit Delivery', 'Update');
      await kit.day(e.getByRole('textbox').nth(1), date);
      await e.getByRole('button', { name: 'Update', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Edit Delivery' })).toBeHidden({ timeout: 15000 });
      let receipt = null;
      await expect.poll(async () => (receipt = (await kit.receipts()).find(r => !before.includes(r)) || null), { timeout: 20000, message: 'New receipt (RCV-…) listed under "Received"' }).not.toBeNull();
      await settle(1000);
      return { receipt, row: kit.receivedRow(receipt) };
    },
    async shippingInfo(row, tag) {
      await kit.deliveryAction(row, 'Update shipping info');
      const sh = kit.dialog('Add Shipping Info', 'Add');
      await kit.pick('Choose Shipping Mode', 'Other', sh);
      await sh.getByRole('textbox').nth(0).fill(`${tag}-SHIP`); await sh.getByRole('textbox').nth(1).fill('Origin'); await sh.locator('textarea').fill(tag);
      await sh.getByRole('button', { name: 'Add', exact: true }).click();
      await toast('Shipping Details updated successfully!');
    },
    async deliveryConditions(row, { good, damage = 0 }) {
      await kit.deliveryAction(row, 'Update delivery condition');
      const dc = kit.dialog('Add Delivery Conditions', 'Add');
      await dc.getByRole('spinbutton').nth(0).fill(String(good));
      await dc.getByRole('spinbutton').nth(1).fill(String(damage));
      const shortage = Number(await dc.getByRole('spinbutton').nth(2).inputValue());
      await dc.getByRole('button', { name: 'Add', exact: true }).click();
      await toast('Delivery Conditions updated successfully!');
      return { shortage };
    },
    async generateGrn(row) {
      await kit.deliveryAction(row, 'Generate GRN');
      await toast('GRN Generated Successfully!', 30000);
    },
    // Full receipt chain: open component → log delivery → checklist (all YES, PL-R16) → approve → Receive (actual date)
    // → shipping → conditions → GRN.
    async deliverToGrn({ material = MATERIAL, qty, good = qty, damage = 0, today = new Date(), tag, stopBeforeGrn = false }) {
      // Restore the header site BEFORE opening the component: restoring it collapses open drawers (OBS-INV-12).
      const onComponent = /[?&]schedule=/.test(page.url()) && await page.getByRole('heading', { name: material, level: 1, exact: true }).isVisible().catch(() => false);
      if (!onComponent) { await kit.backToSubmittal(); await kit.keepSite(); await kit.openComponent(material); }
      const { row } = await kit.addDelivery({ material, qty, date: today });
      await kit.preShipping(row, tag);
      await kit.approveChecklist(row, `${tag} approved`);
      const { receipt, row: received } = await kit.receive(row, today);
      await kit.shippingInfo(received, tag);
      const { shortage } = await kit.deliveryConditions(received, { good, damage });
      if (stopBeforeGrn) return { shortage, receipt, stoppedBeforeGrn: true };
      await kit.generateGrn(received);
      return { shortage, receipt };
    }
  };
  return kit;
}

module.exports = { plKit, poToday, SITE, SUPPLIER, MATERIAL };
