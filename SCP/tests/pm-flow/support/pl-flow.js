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
    // Location lists follow the header venue, which resets after every reload (OBS-INV-12): put it back before using them.
    keepSite: () => new SiteSelectorPage(page).keepSite(SITE),
    // Menu groups collapse after each navigation, so the parent is re-expanded when the child is hidden.
    async menu(name, group) {
      const nav = page.locator('nav');
      // Menu items can carry a counter badge (e.g. "International Shipments 38", 19 Nov 2026): allow a trailing number.
      const label = n => new RegExp(`^\\s*${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s+\\d+\\+?)?\\s*$`);
      let item = nav.getByRole('button', { name: label(name) }).last();
      if (group && !(await item.isVisible().catch(() => false))) { await nav.getByRole('button', { name: label(group) }).first().click(); item = nav.getByRole('button', { name: label(name) }).last(); }
      await item.click({ timeout: 8000 });
      await settle(1500);
    },
    async openLog() {
      // A leftover drawer or dialog can cover the menu; fall back to the route.
      await kit.menu('Procurement Log').catch(() => page.goto('/procurement-log', { waitUntil: 'domcontentloaded' }));
      await expect(page).toHaveURL(/\/procurement-log/);
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
      await page.getByRole('button', { name: 'Add Component', exact: true }).last().waitFor({ timeout: 30000 });
    },
    async addComponent({ rojDate, qty, value, po, poDate, material }) {
      await page.getByRole('button', { name: 'Add Component', exact: true }).last().click();
      const m = kit.dialog('Add Component', 'ADD');
      if (material) { await m.getByRole('button', { name: /\(primary\)/ }).click(); await listbox().getByRole('option', { name: material }).click(); }
      // Fields are located by their labels: the number of read-only textboxes varies with the material.
      const field = label => m.getByText(label, { exact: true }).locator('xpath=following::input[1]');
      await kit.day(field('Date Req. on Site*'), rojDate);
      await field('QTY*').fill(String(qty));
      if (value) await field('Value').fill(String(value));
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
    componentRow(material = MATERIAL) {
      return page.getByRole('row').filter({ has: page.getByRole('checkbox', { name: 'Select this component' }) }).filter({ hasText: material }).first();
    },
    async componentStatus(material = MATERIAL) {
      await page.getByText('Other Actions').first().waitFor({ timeout: 30000 });
      return (await kit.componentRow(material).getByRole('cell').nth(5).innerText()).trim();
    },
    deliveryRow() { return page.getByRole('row').filter({ has: page.locator('img[title="View Delivery Details"], img[alt="Edit"]') }).last(); },
    // Full receipt chain: delivery → checklist (all YES, PL-R16) → approve → reload → actual date → shipping → conditions → GRN.
    async deliverToGrn({ material = MATERIAL, qty, good = qty, damage = 0, today = new Date(), tag, stopBeforeGrn = false }) {
      // Restore the header site BEFORE opening the component: when the site has reverted (after a reload, OBS-INV-12),
      // restoring it collapses the open drawers, which would close the component view again.
      await kit.keepSite();
      await kit.componentRow(material).getByRole('cell', { name: material }).click();
      await page.getByRole('button', { name: '+ Log Delivery' }).last().click();
      const d = kit.dialog('Add Delivery', 'Add');
      await kit.day(d.getByRole('textbox').first(), today);
      await d.getByRole('button', { name: /^(All Locations|Choose Location)$/ }).click();
      await listbox().getByRole('option').filter({ hasNotText: /^(All Locations|Choose Location)$/ }).first().click();
      await d.getByRole('button', { name: 'Choose Item Name' }).click(); await listbox().getByRole('option', { name: material, exact: true }).first().click();
      await d.getByRole('spinbutton').first().fill(String(qty));
      await d.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Add Delivery', exact: true })).toBeHidden({ timeout: 20000 });
      await settle(1500);
      // The pending delivery is the row that offers the next action's icon. Completed deliveries never show these icons,
      // and the new delivery is not always the last row (22 Nov 2026 it was listed above an earlier, completed one).
      const action = selector => page.getByRole('row').filter({ has: page.locator(selector) }).last().locator(selector);
      // Position of the new delivery among the delivery rows (rows with any delivery action icon); the order is kept
      // after a reload.
      const deliveryRows = () => page.getByRole('row').filter({ has: page.locator('img[alt="Edit"], img[title="Pre Shipping Info"], img[title="Approved"], img[title="View Delivery Details"]') });
      const pendingIndex = await deliveryRows().evaluateAll(rows => rows.findIndex(r => r.querySelector('img[title="Pre Shipping Info"]')));
      if (pendingIndex < 0) throw new Error('New delivery row (with "Pre Shipping Info") not found');
      await action('img[title="Pre Shipping Info"]').click();
      const c = kit.dialog('Add Pre-Shipping Details', 'Confirm Checklist');
      await c.getByRole('button', { name: 'Y/N', exact: true }).first().waitFor({ timeout: 20000 }); // questions load after the dialog opens
      const inputs = c.locator('input:visible:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])');
      for (let i = 0, n = await inputs.count(); i < n; i++) await inputs.nth(i).fill(`${tag} answer ${i + 1}`);
      const yn = page.getByRole('button', { name: 'Y/N', exact: true });
      for (let k = 0; (await yn.count()) > 0 && k < 60; k++) { await yn.first().click(); await page.getByRole('option', { name: 'YES', exact: true }).click(); }
      await c.locator('textarea:visible').first().fill(`${tag} supplier note`);
      await c.getByRole('button', { name: 'Confirm Checklist', exact: true }).click();
      await toast('Shipping Details updated successfully!');
      await action('img[title="Approve Pre-Shipping Checklist"]').click();
      const a = kit.dialog('Approve Pre-Shipping Checklist', 'Approve');
      await a.locator('textarea').last().fill(`${tag} approved`);
      await a.getByRole('button', { name: 'Approve', exact: true }).click();
      await toast('Checklist Generated Successfully!');
      // The edit form keeps the pre-approval state until the page reloads (OBS-PL-26).
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: '+ Log Delivery' }).last().waitFor({ timeout: 30000 }); await settle(1500);
      // Edit THE NEW delivery, found by its position among the delivery rows (recorded when it offered "Pre Shipping
      // Info"); a completed delivery can also carry an Edit icon, whose dialog has no actual-date box.
      await deliveryRows().nth(pendingIndex).locator('img[alt="Edit"]').last().click();
      const e = kit.dialog('Edit Delivery', 'Update');
      await kit.day(e.getByRole('textbox').nth(1), today);
      await e.getByRole('button', { name: 'Update', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Edit Delivery' })).toBeHidden({ timeout: 15000 }); await settle(1500);
      await action('img[title="Update Shipping Info"]').click();
      const sh = kit.dialog('Add Shipping Info', 'Add');
      await kit.pick('Choose Shipping Mode', 'Other', sh);
      await sh.getByRole('textbox').nth(0).fill(`${tag}-SHIP`); await sh.getByRole('textbox').nth(1).fill('Origin'); await sh.locator('textarea').fill(tag);
      await sh.getByRole('button', { name: 'Add', exact: true }).click();
      await toast('Shipping Details updated successfully!');
      await action('img[title="Update Delivery Condition"]').click();
      const dc = kit.dialog('Add Delivery Conditions', 'Add');
      await dc.getByRole('spinbutton').nth(0).fill(String(good));
      await dc.getByRole('spinbutton').nth(1).fill(String(damage));
      const shortage = Number(await dc.getByRole('spinbutton').nth(2).inputValue());
      await dc.getByRole('button', { name: 'Add', exact: true }).click();
      await toast('Delivery Conditions updated successfully!');
      // Optionally stop at the GRN step (Configuration Options › GRN check, PM-REG-CFG-10).
      if (stopBeforeGrn) return { shortage, stoppedBeforeGrn: true };
      await action('img[title="Generate GRN"]').click();
      await toast('GRN Generated Successfully!', 30000);
      return { shortage };
    }
  };
  return kit;
}

module.exports = { plKit, poToday, SITE, SUPPLIER, MATERIAL };
