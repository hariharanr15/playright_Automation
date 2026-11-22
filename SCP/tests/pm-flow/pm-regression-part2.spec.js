// Project Management – Regression part 2 (docs/functional-discovery/PM_REGRESSION_SCENARIOS.md, Impact M).
// Data-creating scenarios on NRVC_Hall (approved, rule R1). Every created name carries the run token RUN, so runs never
// collide; created records are not deleted (R14) except where a scenario tests Delete on a record this run created.
// Settings (Configuration Options, FDI Settings, PreShipping, Procurement Log Configuration) are restored after each change.
// Expected results that are not confirmed yet (Ev. "I") are recorded with s.observe() instead of a guessed assertion.
// One sign-in and one tab; pages follow the menu order; the SCP_Testing_Ram checks run last.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
// FDI New Question Set category search: "Search categories" before 10 Nov 2026, now "Search or add a category".
const CATEGORY_SEARCH = /^Search (or add a )?categor/;
const { runPmSuite } = require('./support/pm-flow');
const { signIn } = require('./support/pm-session');
const { pmUi } = require('./support/pm-ui');
const { focus } = require('./support/pm-visuals');
const { PM, OVERLAY, MENU } = require('./support/pm-navigator');
const { writeUpload, writeText } = require('./support/pm-workbook');
const { readWorkbook } = require('../../utils/bulk-upload/inventory-workbook');
const { SiteSelectorPage } = require('../../pages/site-selector.page');

const MODULE = 'Project Management';
const SECOND_PROJECT = process.env.PM_FLOW_SECOND_PROJECT || 'SCP_Testing_Ram';
const XER_FILE = process.env.PM_XER_FILE || 'C:/Users/VC/Downloads/SPADE-OYM-1A-2A-BL-1-09-25-2026-1.xer';
const meta = (id, submodule, title) => ({ id, module: MODULE, submodule, title, suite: 'Regression part 2', navPath: [PM, ...submodule.split(' › ')] });
const pad = value => String(value).padStart(2, '0');
const now = new Date();
const RUN = `PMR2-${String(now.getFullYear()).slice(2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
const ddmmyyyy = date => `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
const localInput = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
const shift = (days, hours = 0) => new Date(Date.now() + days * 86400000 + hours * 3600000);
const esc = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exactI = value => new RegExp(`^\\s*${esc(String(value).trim())}\\s*$`, 'i');
// Uniqueness ignores case and spaces (R2, R15).
const norm = value => String(value || '').toLowerCase().replace(/\s+/g, '');

// Scenarios that need another module, a later day, outside help or an approval are recorded, not run.
const DEFERRED = [
  ['PM-REG-NAV-08', 'Navigation', 'Setup Wizard disappears after completion', 'Not run: completing the Setup Wizard on SCP_Testing_Ram cannot be undone and CFG-17 / PSC-05 need it unconfigured – needs product-owner go-ahead'],
  ['PM-REG-NAV-09', 'Navigation', 'Wizard data matches module pages', 'Not run: same as NAV-08 (completes the Setup Wizard on SCP_Testing_Ram)'],
  ['PM-REG-INT-02', 'Integrations › Booking Integration', 'Booking: submit with empty Booking ID', 'Not run: submitting the Booking form may change NRVC_Hall\'s booking link – needs approval'],
  ['PM-REG-CFG-09', 'Configuration Options', 'Pre-Shipping toggle gates checklist', 'Cross-module (Procurement Log delivery approval) – Regression part 3'],
  ['PM-REG-CFG-10', 'Configuration Options', 'GRN toggle effect', 'Cross-module (delivery GRN options) – Regression part 3'],
  ['PM-REG-CFG-11', 'Configuration Options', 'Archive period effect', 'Cross-module (Management Dashboard read items over 60 days) – Regression part 3'],
  ['PM-REG-CFG-13', 'Configuration Options', 'Not-ordered alert triggers', 'Two-phase: seed today, verify after the 05:00–06:00 IST batch – Regression part 3'],
  ['PM-REG-CFG-14', 'Configuration Options', 'Not-booked alert triggers', 'Two-phase batch check; NRVC_Hall booking link not confirmed (Q-ANT-6) – Regression part 3'],
  ['PM-REG-CFG-15', 'Configuration Options', 'Lead time not confirmed alert', 'Two-phase: seed today, verify after the 05:00–06:00 IST batch – Regression part 3'],
  ['PM-REG-CFG-16', 'Configuration Options', 'No alert before threshold', 'Two-phase batch check – Regression part 3'],
  ['PM-REG-CFG-17', 'Configuration Options', 'Unconfigured settings: in-app only', 'Two-phase batch check on SCP_Testing_Ram – Regression part 3'],
  ...['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n'].map(letter => [`PM-REG-FDI-05${letter}`, 'First Delivery Inspection Config', 'Setting effect on the inspection form', 'Cross-module (needs a delivery and its FDI inspection form) – Regression part 3']),
  ['PM-REG-FDI-18', 'First Delivery Inspection Config', 'Invite → accept → activate → disable', 'Needs Yopmail acceptance and the inspector login (existing Cucumber flow) – Regression part 3'],
  ['PM-REG-FDI-26a', 'First Delivery Inspection Config', 'Invite from User Management is unaffected', 'Cross-module (User Management invite) – Regression part 3'],
  ['PM-REG-FDI-28', 'First Delivery Inspection Config', 'Disabled and pending inspectors cannot self-assign', 'Needs the inspector login and an FDI record – Regression part 3'],
  ['PM-REG-FDI-28a', 'First Delivery Inspection Config', 'Already-assigned records keep a since-disabled inspector', 'Needs an assigned FDI record – Regression part 3'],
  ['PM-REG-FDI-46', 'First Delivery Inspection Config', 'New question offered to the organization\'s other projects', 'Blocked: no second project in NRVC_Hall\'s organization yet (R62, Q-FDI-8)'],
  ['PM-REG-FDI-48', 'First Delivery Inspection Config', 'Enable a shared question on another project', 'Blocked: no second project in NRVC_Hall\'s organization yet (R62, Q-FDI-8)'],
  ['PM-REG-FDI-49', 'First Delivery Inspection Config', 'Enabling on one project doesn\'t spread', 'Blocked: no second project in NRVC_Hall\'s organization yet (R62, Q-FDI-8)'],
  ['PM-REG-INV-06', 'Inventory Control', 'Breach notification', 'Cross-module (stock change in Inventory Management) – Regression part 3'],
  ['PM-REG-MM-11', 'Material Master', 'Delete material in use', 'Not run: if the app allows it, a material used by submittals would be deleted (R14) – needs approval'],
  ['PM-REG-PSC-04', 'PreShipping Checklist', 'Disabled question hidden downstream', 'Cross-module (Procurement Log delivery checklist) – Regression part 3'],
  ['PM-REG-PLC-06', 'Procurement Log Configuration', 'Drag reorder', 'Cross-module (Procurement Log column order) – Regression part 3'],
  ['PM-REG-SITE-07', 'Site Details', 'Delete site in use', 'Not run: if the app allows it, a site with deliveries would be deleted (R14) – needs approval'],
  ...Array.from({ length: 24 }, (_, i) => [`PM-REG-ROLE-${pad(i + 1)}`, 'Role-based access', 'Role-based access', 'Role suite (Regression part 3): needs the Org Admin portal session and separate role logins'])
];

test.setTimeout(3 * 60 * 60 * 1000);

test('Project Management – Regression (part 2: data-creating)', async ({ page }) => {
  const result = await runPmSuite({ page, suite: 'Regression2', scenarios: async ({ run, navigator, config, outDir }) => {
    const ui = pmUi(page, navigator, outDir);
    const { main, modal, visible, headers, rowTexts, countText, button, click, dropdownOptions, selectOptions, download, clean } = ui;
    const data = run.data;
    // Each scenario first makes sure its own page is open (no navigation when it already is), so a scenario does not depend
    // on the one before it: --only re-runs work and one failure does not strand the next scenario on the wrong page.
    const sc = (id, submodule, title, body, pageLabel) => run.scenario(meta(id, submodule, title), async s => {
      const label = pageLabel === undefined ? submodule.split(' › ').find(part => MENU[part]) : pageLabel;
      if (label) await s.step(`Sidebar › Project Management › "${label}" → page opens (skipped when it is already open)`, () => navigator.open(label), { critical: true });
      if (!s.blocked) return body(s);
    });
    const skip = (id, submodule, title, reason) => run.skip(meta(id, submodule, title), reason);
    const files = path.join(outDir, 'uploads');
    data.run = RUN;
    console.log(`Run token: ${RUN}`);

    if (!(await signIn({ run, page, config, ui, id: 'PM-REG-000', suite: 'Regression2' }))) return;

    // ---------- shared helpers ----------
    // Form text inputs often carry type="" (or no type), so input[type="text"] alone misses them.
    const textInputs = scope => scope.locator('input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="number"]):not([type="hidden"]):not([type="datetime-local"]):not([type="date"])');
    // Opens a form after closing any form left open by an earlier failed attempt.
    const openForm = async (name, title) => { await closeForm(); return ui.openForm(name, title); };
    const overlayOpen = () => page.locator(OVERLAY).filter({ visible: true }).count().then(count => count > 0);
    // Messages the app shows after an action: toasts, alerts and red field errors (not the project-notice banners).
    const feedback = async () => {
      const texts = await page.locator('[role="alert"], [class*="toast" i], [class*="Toastify"], .text-red-500, .text-red-600, .text-danger, [class*="error" i]')
        .filter({ visible: true }).evaluateAll(nodes => nodes.filter(node => !node.closest('nav, button, [role="button"], thead')).map(node => node.innerText)).catch(() => []);
      return [...new Set(texts.map(clean).filter(text => text && text !== '*' && text.length < 200 && !/^Project notice/i.test(text)))].join(' | ');
    };
    // Clicks a form button and reports whether the form closed and what the app said.
    const submit = async (name = 'Add', scope = modal()) => {
      // The form counts as closed when no visible layer shows its title any more (a toast can sit in its own layer).
      const title = clean(await scope.locator('h2').first().innerText({ timeout: 5000 }).catch(() => ''));
      await click(scope.getByRole('button', { name, exact: true }), name);
      await page.waitForTimeout(800);
      const message = await feedback();
      const open = title
        ? page.locator(OVERLAY).filter({ visible: true }).filter({ has: page.locator('h2', { hasText: exactI(title) }) })
        : page.locator(OVERLAY).filter({ visible: true }).filter({ has: page.locator('*') });
      const closed = await expect(open).toHaveCount(0, { timeout: 7000 }).then(() => true, () => false);
      return { closed, message: message || await feedback() };
    };
    const closeForm = async () => { if (await overlayOpen()) await navigator.closeOverlay(); };
    const choose = async (trigger, option, label = 'Dropdown') => {
      await click(trigger, label);
      const list = page.getByRole('listbox').last();
      await expect(list, `${label} options`).toBeVisible({ timeout: 10000 });
      const item = typeof option === 'number' ? list.getByRole('option').nth(option) : list.getByRole('option', { name: exactI(option) }).first();
      const text = clean(await item.innerText());
      await focus(item); await item.click();
      return text;
    };
    const firstNumber = text => Number((String(text).match(/\d+/) || [])[0]);
    const pageCount = async () => firstNumber(await countText(/(\d+)\s+(items|categories|sites)/));
    const withDialog = async fn => {
      const handler = dialogEvent => dialogEvent.accept().catch(() => null);
      page.on('dialog', handler);
      try { return await fn(); } finally { page.off('dialog', handler); }
    };
    // Confirms a delete prompt when the app shows one (in-page modal or a browser dialog).
    const confirmDelete = async () => {
      await page.waitForTimeout(600);
      if (await overlayOpen()) {
        const yes = modal().getByRole('button', { name: /^(Delete|Yes|Confirm|OK|Remove|Disable|Enable)$/i }).first();
        if (await yes.isVisible().catch(() => false)) { await focus(yes); await yes.click(); }
      }
      await navigator.ready();
    };
    const reload = async () => { await page.reload({ waitUntil: 'domcontentloaded' }); await navigator.ready(); await page.waitForTimeout(800); };

    for (const [id, submodule, title, reason] of DEFERRED) skip(id, submodule, title, reason);

    // ================= Integrations › XER Import =================
    const plans = () => main.getByRole('button', { name: /\d+\/\d+ visible/ });
    const visibleTaskIds = async () => (await main.locator('table').first().locator('tbody tr').evaluateAll(rows => rows.filter(r => r.offsetParent).map(r => r.cells[1]?.innerText.trim()))).filter(Boolean);
    const dialog = () => modal();
    const counter = async () => ((await dialog().innerText()).match(/(\d+) of (\d+) selected/) || []);
    const searchBox = () => dialog().getByPlaceholder('Search task name or ID…');
    const tickByRow = async id => {
      await searchBox().fill(id);
      const row = dialog().locator('tbody tr').filter({ hasText: id }).first();
      await expect(row).toBeVisible({ timeout: 15000 });
      await focus(row); await row.locator('td').nth(3).click();
    };
    const openManageTasks = async () => {
      await click(button('Manage tasks'), 'Manage tasks');
      await visible(dialog().getByText('Select tasks to display', { exact: true }), 'Select tasks to display');
      await expect.poll(async () => (await counter())[2] || '0', { timeout: 60000 }).not.toBe('0');
    };
    // Picks two task IDs from the dialog that are not in `exclude`.
    const pickTwo = async exclude => {
      // Dialog columns: checkbox, WBS, Task ID, Task Name, Type, Planned Start, Planned Finish.
      const ids = (await dialog().locator('tbody tr').evaluateAll(rows => rows.map(r => r.cells[2]?.innerText.trim()))).filter(Boolean);
      const picked = ids.filter(id => !exclude.includes(id)).slice(0, 2);
      expect(picked.length, 'Two tasks to select').toBe(2);
      return picked;
    };
    const saveSelection = async ids => {
      for (const id of ids) await tickByRow(id);
      await searchBox().fill('');
      expect(Number((await counter())[1]), 'Selected count').toBe(2);
      await click(dialog().getByRole('button', { name: 'Save (2 tasks)', exact: true }), 'Save (2 tasks)');
      // The confirmation toast is short-lived; the result that counts is the plan's visible task list (checked below).
      data.xerToast = await page.getByText(/tasks? set to visible/i).filter({ visible: true }).first().innerText({ timeout: 10000 }).catch(() => '(toast not captured)');
      await expect(page.locator(OVERLAY).filter({ visible: true })).toHaveCount(0, { timeout: 15000 });
      await expect.poll(async () => [...await visibleTaskIds()].sort(), { timeout: 20000 }).toEqual([...ids].sort());
    };
    await sc('PM-REG-INT-08', 'Integrations › XER Import', 'XER: reject unsupported file type', async s => {
      await s.step(`Sidebar › Project Management › Integrations › "XER Import" → XER Import page opens`, () => navigator.open('XER Import'), { critical: true });
      await s.step(`XER Import: click "Import", choose a .txt file ("Not a schedule file") → no plan is created, plan count unchanged (file-input accept and message recorded)`, async () => {
        await visible(plans(), 'Plans');
        data.planCount = await plans().count();
        const file = writeText(path.join(files, `xer-${RUN}.txt`), 'Not a schedule file');
        const accept = await page.locator('input[type="file"]').first().getAttribute('accept').catch(() => null);
        const chooser = page.waitForEvent('filechooser', { timeout: 15000 });
        await click(button('Import'), 'Import');
        await (await chooser).setFiles(file);
        await page.waitForTimeout(4000);
        s.observe(`file input accept="${accept || '(none)'}"; message: ${await feedback() || clean(await main.innerText()).match(/[^.]*(unsupported|invalid|only|xer|error)[^.]*\./i)?.[0] || '(none)'}`);
        await navigator.ready();
        await expect(plans(), 'No plan created from the .txt file').toHaveCount(data.planCount);
      });
    });
    if (fs.existsSync(XER_FILE)) {
      await sc('PM-REG-INT-09', 'Integrations › XER Import', 'XER: import → select two tasks → Save', async s => {
        await s.step(`XER Import: click "Import", choose the test .xer file; if "Open existing plan" appears click it → plan view with "Manage tasks" opens, visible task IDs noted`, async () => {
          const chooser = page.waitForEvent('filechooser', { timeout: 15000 });
          await click(button('Import'), 'Import');
          await (await chooser).setFiles(XER_FILE);
          const existing = button('Open existing plan');
          await expect(existing.or(button('Manage tasks'))).toBeVisible({ timeout: 240000 });
          if (await existing.isVisible().catch(() => false)) await click(existing, 'Open existing plan');
          await visible(button('Manage tasks'), 'Plan view');
          data.tasksBefore = await visibleTaskIds();
        }, { critical: true });
        await s.step(`Plan view › "Manage tasks": tick two tasks that are not visible, click "Save (2 tasks)" → dialog closes and only those two tasks are visible`, async () => {
          await openManageTasks();
          data.totalTasks = Number((await counter())[2]);
          data.setAB = await pickTwo(data.tasksBefore);
          await saveSelection(data.setAB);
        });
        await s.step(`Plan task list → both selected tasks show "Unmapped" and the header reads "2/<total> visible"`, async () => {
          for (const id of data.setAB) {
            await expect(main.locator('tbody tr').filter({ visible: true }).filter({ hasText: id }).first(), `${id} Unmapped`).toContainText('Unmapped');
          }
          await visible(main.getByText(new RegExp(`^2/${data.totalTasks} visible`)), `2/${data.totalTasks} visible`);
        });
      });
      await sc('PM-REG-INT-15', 'Integrations › XER Import', 'XER: Save sets the visible set to the selection', async s => {
        await s.step(`"Manage tasks": tick two different tasks, click "Save (2 tasks)" → only these two are visible, the earlier two are no longer visible`, async () => {
          await openManageTasks();
          const other = await pickTwo([...(data.setAB || []), ...(data.tasksBefore || [])]);
          await saveSelection(other);
          const visibleNow = await visibleTaskIds();
          expect(visibleNow.filter(id => (data.setAB || []).includes(id)), 'Earlier tasks no longer visible').toEqual([]);
        });
      });
    } else {
      skip('PM-REG-INT-09', 'Integrations › XER Import', 'XER: import → select two tasks → Save', `XER test file not found (${XER_FILE}); set PM_XER_FILE`);
      skip('PM-REG-INT-15', 'Integrations › XER Import', 'XER: Save sets the visible set to the selection', 'Depends on PM-REG-INT-09');
    }

    // ================= Reference Data =================
    const REF = {
      util: { label: 'Common Utilities', add: 'Add Common Util', title: 'Add Common Utils', search: 'Search utils…' },
      uom: { label: 'Common UoM', add: 'Add UOM', title: 'Add UOM', search: 'Search UOM…' },
      cat: { label: 'Material Category', add: 'Add Material Category', title: 'Add Material Category', search: 'Search categories…' }
    };
    const refSearch = async (kind, text) => {
      const box = main.getByPlaceholder(REF[kind].search);
      await focus(box); await box.fill(text);
      await page.waitForTimeout(1200);
    };
    // Names on the page that equal `name` ignoring case and spaces (searched by a distinctive part of it).
    const refMatches = async (kind, name, term = RUN) => {
      await refSearch(kind, term);
      const names = await main.locator('tbody tr').evaluateAll(rows => rows.map(r => r.cells[0]?.innerText.trim() || ''));
      return names.filter(item => norm(item) === norm(name));
    };
    const refRow = name => main.locator('tbody tr').filter({ has: page.locator('td:first-child', { hasText: exactI(name) }) }).first();
    const refCount = async kind => { await refSearch(kind, ''); return pageCount(); };
    const refAdd = async (kind, name, type) => {
      await openForm(REF[kind].add, REF[kind].title);
      if (name !== null) { const input = textInputs(modal()).first(); await focus(input); await input.fill(name); }
      if (type) await choose(modal().getByRole('button', { name: 'Choose CommonUtil Type' }), type, 'CommonUtil Type');
      const outcome = await submit('Add');
      if (!outcome.closed) await closeForm();
      return outcome;
    };
    const refRowAction = async (kind, row, action) => {
      await closeForm();
      await focus(row);
      if (kind === 'cat') {
        if (action === 'Edit') await row.locator('img[alt="Edit"]').click();
        else await row.locator('td').last().locator('svg').last().click();
      } else {
        await row.locator('td').last().locator('svg').first().click();
        await click(page.getByRole('menuitem', { name: action, exact: true }), action);
      }
    };
    const refEdit = async (kind, from, to) => {
      await refSearch(kind, RUN);
      await refRowAction(kind, refRow(from), 'Edit');
      await expect(modal(), 'Edit form').toBeVisible({ timeout: 10000 });
      const input = textInputs(modal()).first();
      await focus(input); await input.fill(to);
      const outcome = await submit('Update');
      if (!outcome.closed) await closeForm();
      return outcome;
    };
    // Tries to add an existing name as typed, with extra spaces and in another case; none may create a second row (R2, R15).
    // Each attempt records what the app did; the last step fails once, naming every accepted duplicate.
    const duplicateCheck = async (s, kind, name, type) => {
      const before = await refCount(kind);
      const accepted = [];
      for (const [label, value] of [['same name', name], ['extra spaces', `  ${name.replace(' ', '  ')}  `], ['other case', name.toUpperCase()]]) {
        await s.step(`${REF[kind].label} › "${REF[kind].add}": enter the existing name "${value}" (${label}), click "Add" → accepted or rejected is recorded, no second row expected`, async () => {
          const rows = (await refMatches(kind, name)).length;
          const outcome = await refAdd(kind, value, type);
          const after = (await refMatches(kind, name)).length;
          if (after > rows) accepted.push(label);
          s.observe(`${after > rows ? 'ACCEPTED as a duplicate' : 'rejected'}; form ${outcome.closed ? 'closed' : 'stayed open'}; message: ${outcome.message || '(none)'}`);
        });
      }
      await s.step(`${REF[kind].label}: search the name again → no duplicate row was created and the item count equals the count before the attempts`, async () => {
        if (accepted.length) throw new Error(`${REF[kind].label} accepted duplicate names (${accepted.join(', ')}): "${name}" is now listed ${(await refMatches(kind, name)).length} times`);
        expect(await refCount(kind)).toBe(before);
      });
    };

    // ----- Common Utilities -----
    await sc('PM-REG-REF-05', 'Reference Data › Common Utilities', 'Add utility – required fields', async s => {
      await s.step(`Sidebar › Project Management › Reference Data › "Common Utilities" → page opens, utility count noted`, () => navigator.open('Common Utilities'), { critical: true });
      data.utilCount = await refCount('util');
      for (const [label, name, type] of [['both empty', null, null], ['name only', `Req ${RUN}`, null], ['type only', null, 'file_category']]) {
        await s.step(`"Add Common Util" form: submit with ${label} → form stays open (not created), message recorded`, async () => {
          const outcome = await refAdd('util', name, type);
          s.observe(`form ${outcome.closed ? 'closed' : 'stayed open'}; message: ${outcome.message || '(none)'}`);
          expect(outcome.closed, 'Form stays open (not created)').toBe(false);
        });
      }
      await s.step(`Search "Req ${RUN}" and check the item count → no utility created, count equals the count before`, async () => {
        expect(await refMatches('util', `Req ${RUN}`)).toHaveLength(0);
        expect(await refCount('util')).toBe(data.utilCount);
      });
    });
    await sc('PM-REG-REF-06', 'Reference Data › Common Utilities', 'Add utility – happy path', async s => {
      data.currName = `Curr ${RUN}`;
      await s.step(`"Add Common Util": name "${data.currName}", type "currency_type", click "Add" → form closes`, async () => {
        data.utilCount = await refCount('util');
        const outcome = await refAdd('util', data.currName, 'currency_type');
        expect(outcome.closed, `Form closes (${outcome.message || 'no message'})`).toBe(true);
      });
      await s.step(`Search "${data.currName}" → one row with type "currency_type" and the item count up by 1`, async () => {
        expect(await refMatches('util', data.currName)).toHaveLength(1);
        await expect(refRow(data.currName).locator('td').nth(1)).toHaveText('currency_type');
        expect(await refCount('util')).toBe(data.utilCount + 1);
      });
    });
    await sc('PM-REG-REF-08', 'Reference Data › Common Utilities', 'Edit utility name', async s => {
      const edited = `Curr ${RUN} E`;
      await s.step(`Row actions › "Edit" on "${data.currName}": rename to "${edited}", click "Update" → edit form closes`, async () => {
        const outcome = await refEdit('util', data.currName, edited);
        expect(outcome.closed, `Edit form closes (${outcome.message || 'no message'})`).toBe(true);
      });
      await s.step(`Search the run token → "${edited}" listed once, old name "${data.currName}" no longer listed`, async () => {
        expect(await refMatches('util', edited)).toHaveLength(1);
        expect(await refMatches('util', data.currName)).toHaveLength(0);
        data.currName = edited;
      });
    });
    await sc('PM-REG-REF-09', 'Reference Data › Common Utilities', 'Duplicate utility name', s => duplicateCheck(s, 'util', data.currName, 'currency_type'));
    await sc('PM-REG-REF-10', 'Reference Data › Common Utilities', 'Utility name boundary', async s => {
      let dialogs = 0;
      const onDialog = dialogEvent => { dialogs += 1; dialogEvent.dismiss().catch(() => null); };
      page.on('dialog', onDialog);
      try {
        const long = `Long ${RUN} `.padEnd(255, 'x');
        for (const [label, value, expected] of [['255 characters', long, long], ['leading/trailing spaces', `  Sp ${RUN}  `, `Sp ${RUN}`], ['special characters', `Sp &<>"' ${RUN}`, `Sp &<>"' ${RUN}`]]) {
          await s.step(`"Add Common Util": name with ${label}, type "file_category", click "Add" → outcome and stored name recorded`, async () => {
            const outcome = await refAdd('util', value, 'file_category');
            const stored = (await refMatches('util', expected))[0];
            s.observe(`${outcome.closed ? 'accepted' : 'not accepted'}${stored ? `, listed as "${stored.length > 60 ? `${stored.slice(0, 57)}…(${stored.length})` : stored}"` : ', not listed'}; message: ${outcome.message || '(none)'}`);
          });
        }
        await s.step(`Check for browser alert dialogs → none was opened by the special-character name (no script execution)`, async () => expect(dialogs, 'Browser dialogs opened by the input').toBe(0));
        await s.step(`1-character name → not tried (it could not carry the run token and would collide with other runs), reason recorded`, async () => s.observe('not tried: a 1-character name cannot carry the run token and would collide with other runs (names are unique)'));
      } finally { page.off('dialog', onDialog); }
    });

    // ----- Common UoM -----
    await sc('PM-REG-REF-12', 'Reference Data › Common UoM', 'Add UoM – required', async s => {
      await s.step(`Sidebar › Project Management › Reference Data › "Common UoM" → page opens`, () => navigator.open('Common UoM'), { critical: true });
      await s.step(`"Add UOM" form: leave the name empty, click "Add" → form stays open, UOM count unchanged`, async () => {
        data.uomCount = await refCount('uom');
        const outcome = await refAdd('uom', null);
        s.observe(`message: ${outcome.message || '(none)'}`);
        expect(outcome.closed, 'Form stays open').toBe(false);
        expect(await refCount('uom')).toBe(data.uomCount);
      });
    });
    await sc('PM-REG-REF-13', 'Reference Data › Common UoM', 'Add + edit UoM', async s => {
      await s.step(`"Add UOM": name "UoM ${RUN}", click "Add" → form closes, row listed once`, async () => {
        const outcome = await refAdd('uom', `UoM ${RUN}`);
        expect(outcome.closed, `Form closes (${outcome.message || 'no message'})`).toBe(true);
        expect(await refMatches('uom', `UoM ${RUN}`)).toHaveLength(1);
      });
      await s.step(`Row actions › "Edit" on "UoM ${RUN}": rename to "UoM ${RUN} E", click "Update" → form closes, new name listed, old name gone`, async () => {
        const outcome = await refEdit('uom', `UoM ${RUN}`, `UoM ${RUN} E`);
        expect(outcome.closed, `Edit form closes (${outcome.message || 'no message'})`).toBe(true);
        expect(await refMatches('uom', `UoM ${RUN} E`)).toHaveLength(1);
        expect(await refMatches('uom', `UoM ${RUN}`)).toHaveLength(0);
        data.uomName = `UoM ${RUN} E`;
      });
    });
    await sc('PM-REG-REF-20', 'Reference Data › Common UoM', 'Duplicate UoM name', s => duplicateCheck(s, 'uom', data.uomName));
    await sc('PM-REG-REF-22', 'Reference Data › Common UoM', 'Edit to an existing name (UoM)', async s => {
      await s.step(`Create "UoM2 ${RUN}", then "Edit" it to the name of another existing UoM, click "Update" → original name kept, the other UoM not duplicated`, async () => {
        const second = `UoM2 ${RUN}`;
        const created = await refAdd('uom', second);
        expect(created.closed, `${second} created (${created.message || 'no message'})`).toBe(true);
        await refSearch('uom', '');
        const names = await main.locator('tbody tr').evaluateAll(rows => rows.map(r => r.cells[0]?.innerText.trim()));
        const other = names.find(name => name && !name.includes(RUN));
        expect(other, 'Another UoM exists').toBeTruthy();
        const otherBefore = (await refMatches('uom', other, other)).length;
        const outcome = await refEdit('uom', second, other);
        s.observe(`edit to "${other}": form ${outcome.closed ? 'closed' : 'stayed open'}; message: ${outcome.message || '(none)'}`);
        expect(await refMatches('uom', second), 'Original name kept').toHaveLength(1);
        expect((await refMatches('uom', other, other)).length, `"${other}" not duplicated`).toBe(otherBefore);
      });
    });

    // ----- Material Category -----
    await sc('PM-REG-REF-15', 'Reference Data › Material Category', 'Add Material Category – required', async s => {
      await s.step(`Sidebar › Project Management › Reference Data › "Material Category" → page opens`, () => navigator.open('Material Category'), { critical: true });
      await s.step(`"Add Material Category" form: leave the name empty, click "Add" → "Name is required" shown, category count unchanged`, async () => {
        data.catCount = await refCount('cat');
        await openForm(REF.cat.add, REF.cat.title);
        await click(modal().getByRole('button', { name: 'Add', exact: true }), 'Add');
        await visible(modal().getByText('Name is required', { exact: true }), '"Name is required"');
        await closeForm();
        expect(await refCount('cat')).toBe(data.catCount);
      });
    });
    await sc('PM-REG-REF-16', 'Reference Data › Material Category', 'Add + edit Material Category', async s => {
      await s.step(`"Add Material Category": add "Cat ${RUN}" and "Cat B ${RUN}" (click "Add" each time) → both forms close, each name listed once`, async () => {
        for (const name of [`Cat ${RUN}`, `Cat B ${RUN}`]) {
          const outcome = await refAdd('cat', name);
          expect(outcome.closed, `${name}: form closes (${outcome.message || 'no message'})`).toBe(true);
          expect(await refMatches('cat', name)).toHaveLength(1);
        }
      });
      await s.step(`Edit icon on "Cat ${RUN}": rename to "Cat ${RUN} E", click "Update" → form closes, new name listed`, async () => {
        const outcome = await refEdit('cat', `Cat ${RUN}`, `Cat ${RUN} E`);
        expect(outcome.closed, `Edit form closes (${outcome.message || 'no message'})`).toBe(true);
        expect(await refMatches('cat', `Cat ${RUN} E`)).toHaveLength(1);
        data.catName = `Cat ${RUN} E`;
        data.catB = `Cat B ${RUN}`;
      });
    });
    await sc('PM-REG-REF-21', 'Reference Data › Material Category', 'Duplicate Material Category name', s => duplicateCheck(s, 'cat', data.catName));
    await sc('PM-REG-REF-22b', 'Reference Data › Material Category', 'Edit to an existing name (category)', async s => {
      await s.step(`Edit "${data.catB}": change its name to the existing "${data.catName}", click "Update" → original name kept, only one "${data.catName}" listed`, async () => {
        const outcome = await refEdit('cat', data.catB, data.catName);
        s.observe(`form ${outcome.closed ? 'closed' : 'stayed open'}; message: ${outcome.message || '(none)'}`);
        expect(await refMatches('cat', data.catB), 'Original name kept').toHaveLength(1);
        expect(await refMatches('cat', data.catName), `Only one "${data.catName}"`).toHaveLength(1);
      });
    });
    await sc('PM-REG-REF-18', 'Reference Data › Material Category', 'Load Defaults', async s => {
      await s.step(`Click "Load Defaults", choose "Metric (m, L, kg)", confirm any prompt → category count before and after recorded`, async () => {
        const before = await refCount('cat');
        // Load Defaults opens a Measurement System menu: Imperial or Metric (the project works in metric).
        await click(button('Load Defaults'), 'Load Defaults');
        await withDialog(() => click(page.getByText(/^Metric/).filter({ visible: true }).first(), 'Metric (m, L, kg)'));
        await confirmDelete(); await closeForm();
        await page.waitForTimeout(2500);
        s.observe(`categories ${before} → ${await refCount('cat')}; message: ${await feedback() || '(none)'}`);
      });
      await s.step(`Clear the search and read all category names → no name appears twice (ignoring case and spaces)`, async () => {
        await refSearch('cat', '');
        const names = await main.locator('tbody tr').evaluateAll(rows => rows.map(r => r.cells[0]?.innerText.trim()));
        const seen = new Map();
        for (const name of names) seen.set(norm(name), (seen.get(norm(name)) || 0) + 1);
        expect([...seen].filter(([, count]) => count > 1).map(([name]) => name), 'Names listed more than once (ignoring case and spaces)').toEqual([]);
      });
    });
    await sc('PM-REG-REF-23', 'Reference Data › Material Category', 'Delete from the row actions (run-created records only)', async s => {
      for (const [kind, label] of [['cat', 'Material Category'], ['uom', 'Common UoM'], ['util', 'Common Utilities']]) {
        const name = `Del ${RUN}`;
        await s.step(`"${label}": add "${name}", then delete it via its row action and confirm → row listed after the add, gone after the delete`, async () => {
          await navigator.open(label);
          const created = await refAdd(kind, name, kind === 'util' ? 'file_category' : null);
          expect(created.closed, `Created (${created.message || 'no message'})`).toBe(true);
          expect(await refMatches(kind, name)).toHaveLength(1);
          await withDialog(async () => { await refRowAction(kind, refRow(name), 'Delete'); await confirmDelete(); });
          await expect.poll(async () => (await refMatches(kind, name)).length, { timeout: 15000, message: `${name} removed` }).toBe(0);
        });
      }
    });

    // ================= Configuration Options =================
    const weekInputs = () => main.locator('input[type="text"]');
    const weekValues = async () => weekInputs().evaluateAll(inputs => inputs.slice(0, 3).map(input => input.value));
    // Configuration toggles are plain divs (track div.w-16.rounded-full with a knob span); grey track (bg-switchGray) = Off.
    const configToggle = label => main.locator('div.justify-between', { has: page.locator('p', { hasText: new RegExp(`^${esc(label)}`) }) }).last().locator('div.w-16.rounded-full').first();
    const toggleState = locator => locator.evaluate(node => (/bg-switchGray/.test(node.className) ? 'false' : 'true'));
    const saveConfig = async () => { await click(button('Save'), 'Save'); await page.waitForTimeout(1200); const message = await feedback(); await navigator.ready(); return message; };
    const setWeeks = async values => { for (let i = 0; i < values.length; i += 1) { await focus(weekInputs().nth(i)); await weekInputs().nth(i).fill(String(values[i])); } };
    const currencyButton = () => main.locator('div.justify-between', { has: page.locator('p', { hasText: /^Currency Type/ }) }).last().getByRole('button').first();
    await sc('PM-REG-REF-07', 'Configuration Options', 'New currency utility appears in Configuration Options', async s => {
      await s.step(`Sidebar › Project Management › "Configuration Options" → page opens`, () => navigator.open('Configuration Options'), { critical: true });
      await s.step(`Click the "Currency Type" dropdown → its options include "${data.currName}" (original alert weeks and currency noted)`, async () => {
        data.weeksOriginal = await weekValues();
        data.currencyOriginal = clean(await currencyButton().innerText());
        const options = await dropdownOptions(currencyButton());
        data.currencyOptions = options;
        expect(options.map(norm), `Currency options contain ${data.currName}`).toContain(norm(data.currName));
      });
    });
    await sc('PM-REG-CFG-04', 'Configuration Options', 'Save and persist alert weeks', async s => {
      const changed = (data.weeksOriginal || ['1', '1', '1']).map(value => (Number(value) === 1 ? 2 : 1));
      try {
        await s.step(`Enter alert weeks ${changed.join('/')} in the three week fields, click "Save", reload → fields still show ${changed.join('/')}`, async () => {
          await setWeeks(changed);
          s.observe(`message: ${await saveConfig() || '(none)'}`);
          await reload();
          expect(await weekValues()).toEqual(changed.map(String));
        });
      } finally {
        await s.step(`Enter the original alert weeks ${data.weeksOriginal.join('/')}, click "Save", reload → original values shown`, async () => {
          await setWeeks(data.weeksOriginal); await saveConfig(); await reload();
          expect(await weekValues()).toEqual(data.weeksOriginal);
        });
      }
    });
    await sc('PM-REG-CFG-06', 'Configuration Options', 'Week field – non-numeric and negative', async s => {
      try {
        for (const value of ['abc', '-1']) {
          await s.step(`First week field: enter "${value}", click "Save", reload → value is not saved, original weeks remain`, async () => {
            await focus(weekInputs().first()); await weekInputs().first().fill(value);
            const shown = await weekInputs().first().inputValue();
            const message = await saveConfig();
            s.observe(`field shows "${shown}"; message: ${message || '(none)'}`);
            await reload();
            const saved = await weekValues();
            if (saved[0] === value) throw new Error(`Configuration Options saved a negative or non-numeric week value "${value}" (R69: negatives are rejected); message: ${message || '(none)'}`);
            expect(saved, `"${value}" not saved`).toEqual(data.weeksOriginal);
          });
        }
      } finally {
        await s.step(`If the weeks differ, re-enter the originals and "Save" → week fields show the original values`, async () => {
          if (JSON.stringify(await weekValues()) !== JSON.stringify(data.weeksOriginal)) { await setWeeks(data.weeksOriginal); await saveConfig(); await reload(); }
          expect(await weekValues()).toEqual(data.weeksOriginal);
        });
      }
    });
    await sc('PM-REG-CFG-07', 'Configuration Options', 'Week field – boundaries', async s => {
      try {
        for (const value of ['0', '1', '52']) {
          await s.step(`First week field: enter "${value}", click "Save", reload → "${value}" is saved (accepted)`, async () => {
            await focus(weekInputs().first()); await weekInputs().first().fill(value);
            s.observe(`message: ${await saveConfig() || '(none)'}`);
            await reload();
            expect((await weekValues())[0], `${value} saved`).toBe(value);
          });
        }
      } finally {
        await s.step(`Enter the original alert weeks, click "Save", reload → original values shown`, async () => {
          await setWeeks(data.weeksOriginal); await saveConfig(); await reload();
          expect(await weekValues()).toEqual(data.weeksOriginal);
        });
      }
    });
    await sc('PM-REG-CFG-05', 'Configuration Options', 'Save and persist currency', async s => {
      const other = (data.currencyOptions || []).find(option => norm(option) !== norm(data.currencyOriginal) && !option.includes(RUN));
      try {
        await s.step(`"Currency Type" dropdown: choose "${other}", click "Save", reload → button shows "${other}"`, async () => {
          expect(other, 'Another currency exists').toBeTruthy();
          await choose(currencyButton(), other, 'Currency Type');
          s.observe(`message: ${await saveConfig() || '(none)'}`);
          await reload();
          await expect(currencyButton()).toHaveText(exactI(other));
        });
      } finally {
        await s.step(`"Currency Type" dropdown: choose "${data.currencyOriginal}" again if needed, "Save", reload → original currency shown`, async () => {
          if (norm(await currencyButton().innerText()) !== norm(data.currencyOriginal)) {
            await choose(currencyButton(), data.currencyOriginal, 'Currency Type'); await saveConfig(); await reload();
          }
          await expect(currencyButton()).toHaveText(exactI(data.currencyOriginal));
        });
      }
    });
    await sc('PM-REG-CFG-08', 'Configuration Options', 'Toggle persistence', async s => {
      const toggle = () => configToggle('LLM Material Categorization');
      let original;
      try {
        await s.step(`Click the "LLM Material Categorization" toggle, click "Save", reload → toggle keeps the flipped state`, async () => {
          original = await toggleState(toggle());
          await focus(toggle()); await toggle().click();
          s.observe(`message: ${await saveConfig() || '(none)'}`);
          await reload();
          expect(await toggleState(toggle()), 'Flipped value kept').not.toBe(original);
        });
      } finally {
        await s.step(`Click the toggle back if needed, "Save", reload → original state restored`, async () => {
          if (original !== undefined && (await toggleState(toggle())) !== original) { await toggle().click(); await saveConfig(); await reload(); }
          expect(await toggleState(toggle())).toBe(original);
        });
      }
    });

    // ================= Material Master =================
    const mmSearch = async text => { const box = main.getByPlaceholder('Search materials…'); await focus(box); await box.fill(text); await page.waitForTimeout(1500); };
    const mmRows = async term => { await mmSearch(term); return main.locator('tbody tr').evaluateAll(rows => rows.map(r => [...r.cells].map(c => c.innerText.trim()))); };
    const mmByName = async name => (await mmRows(RUN)).filter(cells => norm(cells[3]) === norm(name));
    // Row text runs cells together without separators, so match one cell exactly (names are shown title-cased).
    // Columns: expand, Category, Material ID, Name, Parent, UOM, Items – match the Name column only (Parent holds names too).
    const mmRow = name => main.locator('tbody tr').filter({ has: page.locator('td:nth-child(4)', { hasText: exactI(name) }) }).first();
    const addMaterial = async ({ category, name, uom, parent, supplier }) => {
      await openForm('Add Material', 'Add Material');
      if (category) await choose(modal().getByRole('button', { name: 'Choose Category' }), category, 'Category');
      if (name) await modal().locator('label', { hasText: 'Material Name' }).locator('xpath=following::input[1]').fill(name);
      if (uom) await choose(modal().getByRole('button', { name: 'Choose Unit' }), uom, 'UOM');
      if (parent) await choose(modal().getByRole('button', { name: 'Choose Material' }), parent, 'Parent Material');
      if (supplier !== undefined) data.supplier = await choose(modal().getByRole('button', { name: 'Choose Supplier (optional)' }), supplier, 'Supplier');
      const outcome = await submit('Add');
      if (!outcome.closed) await closeForm();
      return outcome;
    };
    await sc('PM-REG-MM-05', 'Material Master', 'Add Material – required', async s => {
      await s.step(`Sidebar › Project Management › "Material Master" → page opens`, () => navigator.open('Material Master'), { critical: true });
      await s.step(`Click "Add Material", read the "Choose Category" and "Choose Unit" lists, close the form → lists recorded for later checks`, async () => {
        await openForm('Add Material', 'Add Material');
        data.addMaterialCategories = await dropdownOptions(modal().getByRole('button', { name: 'Choose Category' }));
        data.addMaterialUoms = await dropdownOptions(modal().getByRole('button', { name: 'Choose Unit' }));
        await closeForm();
      });
      for (const [label, values] of [['nothing', {}], ['no Category', { name: `Mat R1 ${RUN}`, uom: data.uomName }], ['no Material Name', { category: data.catName, uom: data.uomName }], ['no UOM', { category: data.catName, name: `Mat R2 ${RUN}` }]]) {
        await s.step(`"Add Material": submit with ${label} → form stays open, material not added (message recorded)`, async () => {
          const outcome = await addMaterial(values);
          s.observe(`message: ${outcome.message || '(none)'}`);
          expect(outcome.closed, 'Not added').toBe(false);
        });
      }
    });
    await sc('PM-REG-REF-14', 'Material Master', 'New UoM available in Add Material', async s => {
      await s.step(`Recorded "Choose Unit" list of "Add Material" → contains "${data.uomName}"`, async () => expect((data.addMaterialUoms || []).map(norm)).toContain(norm(data.uomName)));
    });
    await sc('PM-REG-MM-06', 'Material Master', 'Add Material – happy path', async s => {
      data.material = `Mat ${RUN}`;
      await s.step(`"Add Material": Category "${data.catName}", Material Name "${data.material}", UOM "${data.uomName}", click "Add" → form closes`, async () => {
        const outcome = await addMaterial({ category: data.catName, name: data.material, uom: data.uomName });
        expect(outcome.closed, `Added (${outcome.message || 'no message'})`).toBe(true);
      });
      await s.step(`"Add Material": Category "${data.catB}", name "Mat CB ${RUN}", UOM "${data.uomName}", click "Add" → form closes (gives that category a material for FDI sets)`, async () => {
        const outcome = await addMaterial({ category: data.catB, name: `Mat CB ${RUN}`, uom: data.uomName });
        expect(outcome.closed, `Added (${outcome.message || 'no message'})`).toBe(true);
      });
      await s.step(`Search the run token → "${data.material}" row shows its Category, UOM and a generated Material ID`, async () => {
        const [row] = await mmByName(data.material);
        expect(row, `${data.material} listed`).toBeTruthy();
        s.observe(`row: ${row.join(' | ')}`);
        expect(row.join(' '), 'Category and UOM shown').toMatch(new RegExp(`${esc(data.catName)}[\\s\\S]*${esc(data.uomName)}`, 'i'));
        expect(row.some(cell => /^[A-Z]{2,}[-_]?\d+|^MAT/i.test(cell)), 'Material ID').toBe(true);
      });
    });
    await sc('PM-REG-MM-07', 'Material Master', 'Add Material with Parent + Supplier', async s => {
      data.childMaterial = `Mat P ${RUN}`;
      await s.step(`Reload; "Add Material": Category "${data.catName}", name "${data.childMaterial}", UOM, Parent Material "${data.material}", first Supplier, "Add" → form closes`, async () => {
        await reload(); // the Parent Material list is loaded with the page; the new material appears after a reload
        const outcome = await addMaterial({ category: data.catName, name: data.childMaterial, uom: data.uomName, parent: data.material, supplier: 0 });
        expect(outcome.closed, `Added (${outcome.message || 'no message'})`).toBe(true);
      });
      await s.step(`Search the run token → "${data.childMaterial}" row shows parent "${data.material}"; chosen supplier recorded`, async () => {
        const [row] = await mmByName(data.childMaterial);
        expect(row, `${data.childMaterial} listed`).toBeTruthy();
        expect(row.join(' | ')).toMatch(new RegExp(esc(data.material), 'i'));
        s.observe(`supplier chosen: ${data.supplier}; row: ${row.join(' | ')}`);
      });
    });
    await sc('PM-REG-MM-16', 'Material Master', 'Duplicate material name', async s => {
      for (const [label, value] of [['same name', data.material], ['extra spaces', `  ${data.material.replace(' ', '  ')} `], ['other case', data.material.toLowerCase()]]) {
        await s.step(`"Add Material" with the existing name (${label}), click "Add" → outcome recorded, still only one "${data.material}" listed`, async () => {
          const outcome = await addMaterial({ category: data.catName, name: value, uom: data.uomName });
          s.observe(`form ${outcome.closed ? 'closed' : 'stayed open'}; message: ${outcome.message || '(none)'}`);
          expect(await mmByName(data.material), `Only one "${data.material}"`).toHaveLength(1);
        });
      }
    });
    const itemsOf = async name => firstNumber((((await mmByName(name))[0] || []).join(' ').match(/(\d+)\s+items?\b/i) || [])[1] || '0');
    const addItem = async (material, name, conversion) => {
      await closeForm();
      await mmSearch(RUN);
      await click(mmRow(material).getByRole('button', { name: 'ADD', exact: true }), 'ADD item');
      await expect(modal(), 'Add Item').toBeVisible({ timeout: 10000 });
      const inputs = textInputs(modal());
      if (name !== null) await inputs.nth(0).fill(name);
      if (conversion !== null) await inputs.nth(1).fill(String(conversion));
      const outcome = await submit('Add');
      if (!outcome.closed) await closeForm();
      await reload(); // the Items column is refreshed only on reload
      return outcome;
    };
    await sc('PM-REG-MM-08', 'Material Master', 'Add Item – required/boundary', async s => {
      for (const [label, name, conversion] of [['empty name and conversion', null, null], ['conversion 0', `Itm Z ${RUN}`, '0'], ['conversion -1', `Itm N ${RUN}`, '-1'], ['conversion abc', `Itm A ${RUN}`, 'abc'], ['conversion 1.5', `Itm D ${RUN}`, '1.5']]) {
        await s.step(`Row "ADD" button on "${data.material}": Add Item with ${label}, click "Add", reload → outcome and Items count before/after recorded`, async () => {
          const before = await itemsOf(data.material);
          const outcome = await addItem(data.material, name, conversion);
          s.observe(`${outcome.closed ? 'accepted' : 'not accepted'}; items ${before} → ${await itemsOf(data.material)}; message: ${outcome.message || '(none)'}`);
        });
      }
    });
    await sc('PM-REG-MM-09', 'Material Master', 'Add Item – happy path', async s => {
      data.item = `Pack ${RUN}`;
      await s.step(`Row "ADD" on "${data.childMaterial}": Item name "${data.item}", conversion 10, click "Add", reload → form closes, Items count up by 1`, async () => {
        data.itemsBefore = await itemsOf(data.childMaterial);
        const outcome = await addItem(data.childMaterial, data.item, 10);
        expect(outcome.closed, `Added (${outcome.message || 'no message'})`).toBe(true);
        await expect.poll(() => itemsOf(data.childMaterial), { timeout: 15000 }).toBe(data.itemsBefore + 1);
      });
    });
    await sc('PM-REG-MM-17', 'Material Master', 'Duplicate item name', async s => {
      await s.step(`Row "ADD" on "${data.childMaterial}": item name "${data.item.toUpperCase()}", conversion 10, click "Add" → outcome recorded, Items count unchanged`, async () => {
        const outcome = await addItem(data.childMaterial, data.item.toUpperCase(), 10);
        s.observe(`form ${outcome.closed ? 'closed' : 'stayed open'}; message: ${outcome.message || '(none)'}`);
        expect(await itemsOf(data.childMaterial), 'Items count unchanged').toBe(data.itemsBefore + 1);
      });
    });
    await sc('PM-REG-MM-10', 'Material Master', 'Edit material', async s => {
      const edited = `Mat P ${RUN} E`;
      await s.step(`Row menu › "Edit" on "${data.childMaterial}": Material Name "${edited}", click "Update"/"Save" → form closes`, async () => {
        await mmSearch(RUN);
        await click(mmRow(data.childMaterial).locator('img[alt="Menu"]'), 'Row menu');
        await click(page.getByText('Edit', { exact: true }).last(), 'Edit');
        await expect(modal(), 'Edit Material').toBeVisible({ timeout: 10000 });
        await modal().locator('label', { hasText: 'Material Name' }).locator('xpath=following::input[1]').fill(edited);
        const action = await modal().getByRole('button', { name: /^(Update|Save)$/ }).first().innerText();
        const outcome = await submit(action.trim());
        expect(outcome.closed, `Saved (${outcome.message || 'no message'})`).toBe(true);
      });
      await s.step(`Search the run token → "${edited}" listed once`, async () => {
        expect(await mmByName(edited)).toHaveLength(1);
        data.childMaterial = edited;
      });
    });
    await sc('PM-REG-MM-15', 'Material Master', 'Map Supplier / Statistics', async s => {
      const openFromMenu = async action => {
        await closeForm(); await mmSearch(RUN);
        await click(mmRow(data.material).locator('img[alt="Menu"]'), 'Row menu');
        await click(page.getByText(action, { exact: true }).last(), action);
        await page.waitForTimeout(1500);
      };
      await s.step(`Row menu › "Map Supplier" on "${data.material}" → "Add Supplier Mapping" drawer shows Supplier ID, Supplier Name, Lead Time in Weeks; close without saving`, async () => {
        await openFromMenu('Map Supplier');
        await visible(modal().getByText('Add Supplier Mapping'), 'Add Supplier Mapping');
        await expect(modal()).toContainText(/Supplier ID[\s\S]*Supplier Name[\s\S]*Lead Time in Weeks/);
        s.observe(clean(await modal().innerText()).slice(0, 160));
        await closeForm();
      });
      await s.step(`Row menu › "Statistics" on "${data.material}" → No. of Submittals, No. of Orders, Qty Pending Delivery, Qty Not Yet Ordered, Current Stock shown`, async () => {
        await openFromMenu('Statistics');
        for (const label of ['No. of Submittals', 'No. of Orders', 'Qty Pending Delivery', 'Qty Not Yet Ordered', 'Current Stock']) {
          await visible(page.getByText(label, { exact: true }).filter({ visible: true }), label);
        }
        await page.keyboard.press('Escape'); await page.mouse.click(5, 300);
      });
    });

    // ----- Material Master uploads -----
    const uploadFrom = async (menuItem, file) => {
      await closeForm();
      await click(button('Upload'), 'Upload');
      const chooser = page.waitForEvent('filechooser', { timeout: 15000 });
      await click(page.getByText(menuItem, { exact: true }).last(), menuItem);
      await (await chooser).setFiles(file);
      await page.waitForTimeout(3000);
      return feedback();
    };
    // Answers "Upload Confirmation … Are you sure?" with Upload so the server decides; returns what the app showed next.
    const confirmUpload = async () => {
      const { seen } = await handleUploadDialogs();
      return seen.join(' » ') || await feedback();
    };
    // Bulk upload dialogs: "Upload Confirmation" (Cancel / Upload), then a progress dialog ("Material bulk upload": Reading
    // file … Complete, with Total / Succeeded / Duplicates / Rejected / New categories) that may stop at "Waiting for your
    // input" (e.g. an unknown category). Returns the dialog texts and the result summary.
    const handleUploadDialogs = async ({ confirm = true } = {}) => {
      // Each dialog is found by its own text: the Upload menu can still be open behind it and has an "Upload" item too.
      const layers = () => page.locator(OVERLAY).filter({ visible: true });
      const confirmation = () => layers().filter({ hasText: 'Upload Confirmation' }).last();
      const progress = () => layers().filter({ hasText: /bulk upload/i }).last();
      const seen = [];
      let summary = '';
      await page.waitForTimeout(1000);
      if (await confirmation().isVisible().catch(() => false)) {
        seen.push('Upload Confirmation');
        await click(confirmation().getByRole('button', { name: 'Upload', exact: true }), 'Upload');
        await expect(confirmation(), 'Upload Confirmation closed').toBeHidden({ timeout: 15000 });
      }
      // Material uploads show a progress dialog; site uploads finish without one.
      if (!(await progress().isVisible({ timeout: 5000 }).catch(() => false))) {
        await page.waitForTimeout(4000);
        await closeForm();
        return { seen, summary };
      }
      const decision = () => progress().getByText(/Waiting for your input \(\d/);
      for (let round = 0; round < 4; round += 1) {
        await expect.poll(async () => {
          const now = await progress().innerText().catch(() => '');
          if (/Total rows/i.test(now) || /upload failed|no changes were saved/i.test(now)) return 'done';
          return (await decision().isVisible().catch(() => false)) ? 'decide' : 'running';
        }, { timeout: 180000, message: 'Upload finished or waiting for a decision' }).not.toBe('running');
        if (!(await decision().isVisible().catch(() => false)) || /Total rows/i.test(await progress().innerText())) break;
        // "Categories not found": Create all as new / Reject all; "UOMs not found": only Reject all (new UoMs cannot be added).
        seen.push(`decision: ${clean(await decision().innerText())}`);
        const links = progress().getByText(confirm ? /^(Create all as new|Reject all)$/ : /^Reject all$/);
        if (confirm) {
          const create = progress().getByText('Create all as new', { exact: true });
          if (await create.isVisible().catch(() => false)) await click(create, 'Create all as new');
          const rejectUom = progress().getByText('UOMs not found', { exact: false }).locator('xpath=..').getByText('Reject all', { exact: true });
          if (await rejectUom.isVisible().catch(() => false)) await click(rejectUom, 'Reject all (UOMs)');
        } else {
          for (const link of await links.all()) if (await link.isVisible().catch(() => false)) await click(link, 'Reject all');
        }
        await click(progress().getByRole('button', { name: 'Continue', exact: true }), 'Continue');
        await page.waitForTimeout(2000);
      }
      const text = clean(await progress().innerText());
      summary = (text.match(/Total rows[\s\S]*$/) || text.match(/Upload failed[\s\S]*$/) || [text.slice(-200)])[0].replace(/\s*(Download error file\s*)?Close$/, '');
      seen.push(`result: ${summary}`);
      await click(progress().getByRole('button', { name: 'Close', exact: true }).last(), 'Close');
      await expect(progress(), 'Upload dialog closed').toBeHidden({ timeout: 10000 });
      return { seen, summary };
    };
    const mmTemplate = () => data.mmTemplate;
    const mmFile = (id, rows) => writeUpload({ template: mmTemplate(), sheet: 'Materials', rows, output: path.join(files, `${id.toLowerCase()}-${RUN}.xlsx`) });
    const mmRowData = (material_name, extra = {}) => ({ category: data.catName, material_name, uom: data.uomName, ...extra });
    // Uploads a material file, answers a category prompt when asked, and records the file name for the Bulk Upload Status checks.
    const mmUpload = async (s, id, rows, { confirm = true } = {}) => {
      const file = mmFile(id, rows);
      data.uploads = data.uploads || {};
      data.uploads[id] = path.basename(file);
      const message = await uploadFrom('Upload File', file);
      const { seen } = await handleUploadDialogs({ confirm });
      const prompt = seen.join(' » ');
      s.observe(`${prompt ? `prompt: ${prompt}; ` : ''}message: ${message || await feedback() || '(none)'}`);
      await navigator.ready(); await page.waitForTimeout(2000);
    };
    const listed = async name => (await mmByName(name)).length;
    await sc('UPL-MM-03', 'Material Master › Upload', 'Valid upload creates materials', async s => {
      await s.step(`Click "Upload" › "Download Template" → template downloads and its UoM list includes "${data.uomName}"`, async () => {
        await click(button('Upload'), 'Upload');
        const file = await download(page.getByText('Download Template', { exact: true }).first(), 'Download Template');
        data.mmTemplate = file.path;
        await page.keyboard.press('Escape'); await page.mouse.click(5, 300);
        const lists = (readWorkbook(file.path)._Lists || []).map(row => Object.values(row)[0]);
        expect(lists.map(norm), `Template UoM list has ${data.uomName}`).toContain(norm(data.uomName));
      }, { critical: true });
      await s.step(`"Upload" › "Upload File": two valid rows (Mat A ${RUN}; Mat B ${RUN} with item Pack B ${RUN}, conversion 10), confirm the dialogs → result recorded`, () => mmUpload(s, 'UPL-MM-03', [mmRowData(`Mat A ${RUN}`), mmRowData(`Mat B ${RUN}`, { item_name: `Pack B ${RUN}`, item_conversion: 10 })]), { critical: true });
      await s.step(`Search the run token → "Mat A ${RUN}" and "Mat B ${RUN}" each listed once, "Mat B ${RUN}" shows 1 item`, async () => {
        await expect.poll(() => listed(`Mat A ${RUN}`), { timeout: 30000 }).toBe(1);
        expect(await listed(`Mat B ${RUN}`)).toBe(1);
        expect(await itemsOf(`Mat B ${RUN}`)).toBe(1);
      });
    });
    const notCreated = async (...names) => { for (const name of names) expect(await listed(name), `${name} not created`).toBe(0); };
    await sc('UPL-MM-04', 'Material Master › Upload', 'Fully invalid file', async s => {
      await s.step(`"Upload" › "Upload File": two rows with an empty material_name, confirm the dialogs → result recorded`, async () => {
        data.mmRunRows = (await mmRows(RUN)).length;
        await mmUpload(s, 'UPL-MM-04', [mmRowData(''), mmRowData('')]);
      });
      await s.step(`Search the run token → number of run materials unchanged, nothing created`, async () => expect((await mmRows(RUN)).length, 'Run materials unchanged').toBe(data.mmRunRows));
    });
    await sc('UPL-MM-05', 'Material Master › Upload', 'Partly valid file', async s => {
      await s.step(`"Upload File": valid "Mat C ${RUN}" plus "Mat D ${RUN}" with a blank uom, confirm the dialogs → result recorded`, () => mmUpload(s, 'UPL-MM-05', [mmRowData(`Mat C ${RUN}`), mmRowData(`Mat D ${RUN}`, { uom: '' })]));
      await s.step(`Search the run token → "Mat C ${RUN}" listed once, "Mat D ${RUN}" not created`, async () => {
        await expect.poll(() => listed(`Mat C ${RUN}`), { timeout: 30000 }).toBe(1);
        await notCreated(`Mat D ${RUN}`);
      });
    });
    await sc('UPL-MM-06', 'Material Master › Upload', 'Required cells', async s => {
      await s.step(`"Upload File": "Mat E ${RUN}" with a blank category and "Mat F ${RUN}" with a blank uom, confirm the dialogs → result recorded`, () => mmUpload(s, 'UPL-MM-06', [mmRowData(`Mat E ${RUN}`, { category: '' }), mmRowData(`Mat F ${RUN}`, { uom: '' })]));
      await s.step(`Search the run token → neither "Mat E ${RUN}" nor "Mat F ${RUN}" is created`, () => notCreated(`Mat E ${RUN}`, `Mat F ${RUN}`));
    });
    await sc('UPL-MM-07', 'Material Master › Upload', 'UoM not in the list', async s => {
      await s.step(`"Upload File": "Mat G ${RUN}" with uom "Bogus ${RUN}" (not in the list), confirm the dialogs → result recorded`, () => mmUpload(s, 'UPL-MM-07', [mmRowData(`Mat G ${RUN}`, { uom: `Bogus ${RUN}` })]));
      await s.step(`Search the run token → "Mat G ${RUN}" not created`, () => notCreated(`Mat G ${RUN}`));
    });
    await sc('UPL-MM-08', 'Material Master › Upload', 'Unknown category – confirm', async s => {
      await s.step(`"Upload File": "Mat H ${RUN}" with new category "Cat U ${RUN}"; in the progress dialog choose "Create all as new", "Continue" → result recorded`, () => mmUpload(s, 'UPL-MM-08', [mmRowData(`Mat H ${RUN}`, { category: `Cat U ${RUN}` })], { confirm: true }));
      await s.step(`Search the run token → "Mat H ${RUN}" listed once under category "Cat U ${RUN}"`, async () => {
        await expect.poll(() => listed(`Mat H ${RUN}`), { timeout: 30000 }).toBe(1);
        expect(((await mmByName(`Mat H ${RUN}`))[0] || []).join(' ')).toMatch(new RegExp(esc(`Cat U ${RUN}`), 'i'));
      });
    });
    await sc('UPL-MM-16', 'Material Master › Upload', 'Unknown category – decline', async s => {
      await s.step(`"Upload File": "Mat I ${RUN}" with new category "Cat2 U ${RUN}"; in the progress dialog choose "Reject all", "Continue" → result recorded`, () => mmUpload(s, 'UPL-MM-16', [mmRowData(`Mat I ${RUN}`, { category: `Cat2 U ${RUN}` })], { confirm: false }));
      await s.step(`Search the run token → "Mat I ${RUN}" not created`, () => notCreated(`Mat I ${RUN}`));
    });
    await sc('UPL-MM-09', 'Material Master › Upload', 'Duplicate of an existing material', async s => {
      await s.step(`"Upload File": three rows repeating "${data.material}" (same name, upper case, extra spaces), confirm the dialogs → result recorded`, () => mmUpload(s, 'UPL-MM-09', [mmRowData(data.material), mmRowData(data.material.toUpperCase()), mmRowData(`  ${data.material} `)]));
      await s.step(`Search the run token → "${data.material}" is still listed once`, async () => expect(await listed(data.material)).toBe(1));
    });
    await sc('UPL-MM-10', 'Material Master › Upload', 'Duplicate inside the same file', async s => {
      await s.step(`"Upload File": "Mat J ${RUN}" twice in the same file, confirm the dialogs → result recorded`, () => mmUpload(s, 'UPL-MM-10', [mmRowData(`Mat J ${RUN}`), mmRowData(`Mat J ${RUN}`)]));
      await s.step(`Search the run token → "Mat J ${RUN}" created at most once (count recorded)`, async () => {
        const count = await listed(`Mat J ${RUN}`);
        s.observe(`"Mat J" created ${count} time(s)`);
        expect(count).toBeLessThanOrEqual(1);
      });
    });
    await sc('UPL-MM-11', 'Material Master › Upload', 'Item conversion boundaries', async s => {
      const cases = [['0', 'K1'], ['-1', 'K2'], ['abc', 'K3'], ['1.5', 'K4'], ['2', 'K5']];
      await s.step(`"Upload File": five materials with item conversions 0, -1, abc, 1.5 and 2, confirm the dialogs → result recorded`, () => mmUpload(s, 'UPL-MM-11', cases.map(([value, key]) => mmRowData(`Mat ${key} ${RUN}`, { item_name: `Itm ${key} ${RUN}`, item_conversion: value }))));
      await s.step(`Search the run token → only "Mat K5 ${RUN}" (conversion 2) exists, with 1 item; Mat K1 to K4 not created`, async () => {
        await expect.poll(() => listed(`Mat K5 ${RUN}`), { timeout: 30000 }).toBe(1);
        expect(await itemsOf(`Mat K5 ${RUN}`)).toBe(1);
        await notCreated(`Mat K1 ${RUN}`, `Mat K2 ${RUN}`, `Mat K3 ${RUN}`, `Mat K4 ${RUN}`);
      });
    });
    await sc('UPL-MM-12', 'Material Master › Upload', 'Item fields must go together', async s => {
      await s.step(`"Upload File": "Mat L1 ${RUN}" with item_name only and "Mat L2 ${RUN}" with item_conversion only, confirm the dialogs → result recorded`, () => mmUpload(s, 'UPL-MM-12', [mmRowData(`Mat L1 ${RUN}`, { item_name: `Itm L1 ${RUN}` }), mmRowData(`Mat L2 ${RUN}`, { item_conversion: 5 })]));
      await s.step(`Search both materials → whether each was created is recorded (expected result not yet confirmed)`, async () => {
        for (const name of [`Mat L1 ${RUN}`, `Mat L2 ${RUN}`]) s.observe(`${name}: ${await listed(name) ? 'CREATED' : 'not created'}`);
      });
    });
    await sc('UPL-MM-13', 'Material Master › Upload', 'Wrong file / wrong layout', async s => {
      for (const [label, file] of [['.csv', writeText(path.join(files, `upl-mm-13-${RUN}.csv`), `category,material_name,uom\n${data.catName},Mat M1 ${RUN},${data.uomName}\n`)], ['.pdf', writeText(path.join(files, `upl-mm-13-${RUN}.pdf`), '%PDF-1.4\n%%EOF\n')]]) {
        await s.step(`"Upload" › "Upload File": choose a ${label} file instead of the template, then confirm → messages recorded`, async () => {
          const first = await uploadFrom('Upload File', file);
          s.observe(`message: ${first || '(none)'}; after confirming: ${await confirmUpload() || '(none)'}`);
        });
      }
      await s.step(`Search the run token → "Mat M1 ${RUN}" not created`, () => notCreated(`Mat M1 ${RUN}`));
    });
    await sc('UPL-MM-14', 'Material Master › Upload', 'Header-only file', async s => {
      await s.step(`"Upload File": template with one empty data row, confirm the dialogs → result recorded`, () => mmUpload(s, 'UPL-MM-14', [{}]));
      await s.step(`Search the run token → number of run materials recorded (nothing is expected to be created)`, async () => s.observe(`run materials listed: ${(await mmRows(RUN)).length}`));
    });

    // ================= First Delivery Inspection Config =================
    const SETTINGS = ['Need Overall Notes to be captured', 'Enable Uploading of Photos?', 'Photos are mandatory?', 'Provide Link to Submittal Spec Documents?'];
    const fdiSettings = () => page.locator('main').evaluate(m => {
      const heading = [...m.querySelectorAll('h1,h2,h3,h4')].find(h => h.innerText.trim() === 'FDI Settings');
      const box = heading ? heading.closest('div').parentElement : m;
      return [...box.querySelectorAll('input[type=checkbox]')].slice(0, 4).map(c => ({ checked: c.checked, disabled: c.disabled }));
    });
    const settingBox = label => main.locator('label', { hasText: label }).locator('input[type="checkbox"]').first();
    const setSetting = async (label, checked) => {
      const box = settingBox(label);
      if ((await box.isChecked()) !== checked) { await focus(box); await box.click(); }
    };
    const saveFdi = async () => { await click(main.getByRole('button', { name: 'Save', exact: true }).first(), 'Save'); await page.waitForTimeout(1200); const message = await feedback(); await navigator.ready(); return message; };
    const restoreFdi = async () => {
      // Uploads first: "Photos are mandatory?" can only be ticked while uploads is ticked.
      for (const index of [1, 0, 2, 3]) await setSetting(SETTINGS[index], data.fdiInitial[index].checked);
      await saveFdi(); await reload();
      expect((await fdiSettings()).map(item => item.checked), 'FDI Settings restored').toEqual(data.fdiInitial.map(item => item.checked));
    };
    await sc('PM-REG-FDI-02a', 'First Delivery Inspection Config', 'No contradictory state is saved', async s => {
      await s.step(`Sidebar › Project Management › "First Delivery Inspection Config" → page opens`, () => navigator.open('First Delivery Inspection Config'), { critical: true });
      try {
        await s.step(`FDI Settings: untick "Enable Uploading of Photos?", click "Save", reload → uploads No, "Photos are mandatory?" No and disabled`, async () => {
          data.fdiInitial = await fdiSettings();
          await setSetting(SETTINGS[1], false);
          s.observe(`message: ${await saveFdi() || '(none)'}`);
          await reload();
          const now = await fdiSettings();
          expect(now[1].checked, 'Uploads = No').toBe(false);
          expect(now[2].checked, 'Mandatory = No').toBe(false);
          expect(now[2].disabled, 'Mandatory disabled').toBe(true);
        });
      } finally {
        await s.step(`FDI Settings: set the four checkboxes back to their original values, "Save", reload → original settings shown`, restoreFdi);
      }
    });
    await sc('PM-REG-FDI-04', 'First Delivery Inspection Config', 'Save persists each setting (Yes and No)', async s => {
      try {
        for (const [index, label] of SETTINGS.entries()) {
          for (const pass of [0, 1]) {
            await s.step(`FDI Settings: ${pass ? 'set' : 'flip'} "${label}" ${pass ? 'back to the original value' : '(tick uploads first for "mandatory")'}, click "Save", reload → value kept`, async () => {
              if (index === 2) await setSetting(SETTINGS[1], true); // mandatory only while uploads is ticked
              const target = pass ? data.fdiInitial[index].checked : !data.fdiInitial[index].checked;
              await setSetting(label, target);
              await saveFdi(); await reload();
              expect((await fdiSettings())[index].checked, `${label} = ${target ? 'Yes' : 'No'} after reload`).toBe(target);
            });
          }
        }
      } finally {
        await s.step(`FDI Settings: set the four checkboxes back to their original values, "Save", reload → settings equal the original values`, restoreFdi);
      }
    });

    // ----- Inspectors -----
    const inspectorTable = () => main.locator('table').filter({ has: page.getByText('Materials Scope') }).first();
    const inspectorRow = text => inspectorTable().locator('tbody tr').filter({ hasText: text }).first();
    const inspectorCount = () => inspectorTable().locator('tbody tr').count();
    const memberSelect = () => modal().locator('select').nth(0);
    const roleSelect = () => modal().locator('select').nth(1);
    // The member and role lists load after the form opens: wait until real options are present.
    const realOptions = async select => {
      await expect.poll(async () => (await selectOptions(select)).filter(option => !/^—/.test(option)).length, { timeout: 15000, message: 'Select options loaded' }).toBeGreaterThan(0);
      return (await selectOptions(select)).filter(option => !/^—/.test(option));
    };
    // Members not yet in the Inspectors table (matched by the e-mail in the option label).
    const freeMembers = async () => {
      await expect.poll(() => inspectorTable().locator('tbody tr').count(), { timeout: 20000, message: 'Inspectors loaded' }).toBeGreaterThan(0);
      const table = (await inspectorTable().innerText()).toLowerCase();
      return (await realOptions(memberSelect())).filter(option => {
        const email = (option.match(/[\w.+-]+@[\w.-]+/) || [])[0];
        return email ? !table.includes(email.toLowerCase()) : !table.includes(option.split('(')[0].trim().toLowerCase());
      });
    };
    // The form keeps the previous attempt's choices after it is closed, so both selects are set explicitly every time.
    const addInspector = async ({ member, role, scope, pick }) => {
      await openForm('Add Inspector', 'Add Inspector');
      if (member) await memberSelect().selectOption({ label: member }); else await memberSelect().selectOption({ index: 0 });
      if (role) await roleSelect().selectOption({ label: role }); else await roleSelect().selectOption({ index: 0 });
      if (scope) await click(modal().getByText(scope, { exact: true }), scope);
      if (pick && scope === 'By Material Category') {
        // "+ Add Category" adds a row with a search box; matching categories are offered as buttons.
        await click(modal().getByRole('button', { name: '+ Add Category', exact: true }), '+ Add Category');
        await modal().getByPlaceholder('Search category...').last().fill(pick);
        await click(modal().getByRole('button', { name: exactI(pick) }).first(), pick);
      } else if (pick) {
        const search = modal().getByPlaceholder(/Search materials/);
        if (await search.isVisible().catch(() => false)) await search.fill(pick);
        await click(modal().locator('label', { hasText: exactI(pick) }).first(), pick);
      }
      return submit('Add');
    };
    await sc('PM-REG-FDI-21', 'First Delivery Inspection Config', 'Add Inspector – Person and Role required', async s => {
      await s.step(`Inspectors › "Add Inspector": choose a Project Role but no Project Member, click "Add" → form stays open, nothing added`, async () => {
        data.inspectorCount = await inspectorCount();
        await openForm('Add Inspector', 'Add Inspector');
        data.roles = await realOptions(roleSelect());
        data.freeMembers = await freeMembers();
        await closeForm();
        const outcome = await addInspector({ role: data.roles[0] });
        s.observe(`message: ${outcome.message || '(none)'}`);
        expect(outcome.closed, 'Not added').toBe(false);
        await closeForm();
      });
      await s.step(`"Add Inspector": choose a Project Member but no Project Role, click "Add" → form stays open, member not added to the table`, async () => {
        expect(data.freeMembers.length, 'A project member who is not an inspector yet').toBeGreaterThan(0);
        const outcome = await addInspector({ member: data.freeMembers[0] });
        s.observe(`message: ${outcome.message || '(none)'}`);
        expect(outcome.closed, 'Not added').toBe(false);
        await closeForm();
        const email = (data.freeMembers[0].match(/[\w.+-]+@[\w.-]+/) || [])[0];
        if (email) await expect(inspectorTable().locator('tbody tr').filter({ hasText: email }), `${email} not added`).toHaveCount(0);
      });
    });
    await sc('PM-REG-FDI-25', 'First Delivery Inspection Config', 'Several inspectors can be added', async s => {
      const plan = [
        { key: 'A', scope: 'All Materials' },
        { key: 'B', scope: 'Specific Materials' },
        { key: 'C', scope: 'By Material Category', pick: () => data.catName }
      ];
      for (const [index, item] of plan.entries()) {
        await s.step(`"Add Inspector" (member ${item.key}): next free project member, a role, scope "${item.scope}", click "Add" → row shows the member with that role`, async () => {
          data.memberCursor = data.memberCursor ?? 0;
          let pick = item.pick ? item.pick() : null;
          if (item.scope === 'Specific Materials') {
            await openForm('Add Inspector', 'Add Inspector');
            await click(modal().getByText('Specific Materials', { exact: true }), 'Specific Materials');
            data.materialChoices = (await modal().locator('label').filter({ has: page.locator('input[type="checkbox"]') }).allInnerTexts()).map(clean).slice(0, 3);
            await closeForm();
            pick = data.materialChoices[0];
          }
          const role = data.roles[index % data.roles.length];
          // Take the next free member; skip anyone the app reports as already listed.
          let member; let outcome;
          while (data.memberCursor < data.freeMembers.length) {
            member = data.freeMembers[data.memberCursor++];
            outcome = await addInspector({ member, role, scope: item.scope === 'All Materials' ? null : item.scope, pick });
            if (outcome.closed || !/already on the Inspectors list/i.test(outcome.message)) break;
            await closeForm();
          }
          if (!outcome || !outcome.closed) {
            // Inspectors cannot be deleted, so every run uses up project members. When none is free, an existing inspector
            // of an automation test account (user<digits>@yopmail.com) stands in, so the later checks still run.
            await closeForm();
            const used = Object.values(data).filter(value => value && value.name && value.role).map(value => value.name);
            const rows = await inspectorTable().locator('tbody tr').evaluateAll(list => list.map(r => [...r.cells].map(c => c.innerText.replace(/\s+/g, ' ').trim())));
            const stand = rows.find(cells => /user\d+@yopmail\.com/i.test(cells[0]) && cells[3] === 'Active' && !used.some(name => cells[0].includes(name)));
            expect(stand, `Free project member or an existing test inspector for ${item.key}`).toBeTruthy();
            const email = stand[0].match(/[\w.+-]+@[\w.-]+/)[0];
            s.observe(`no free project member left – reused existing test inspector ${email} (${stand[1]})`);
            data[`inspector${item.key}`] = { member: stand[0], name: email, role: stand[1], pick, reused: true };
            return;
          }
          // Several members share a display name (e.g. three "Hariharan Raja"), so rows are found by e-mail.
          const name = (member.match(/[\w.+-]+@[\w.-]+/) || [])[0] || member.split('(')[0].trim();
          await expect(inspectorRow(name)).toContainText(role);
          data[`inspector${item.key}`] = { member, name, role, pick };
        });
      }
    });
    await sc('PM-REG-FDI-22', 'First Delivery Inspection Config', 'Add Inspector – By Category scope', async s => {
      await s.step(`Inspectors table → inspector C's scope cell reads "${data.catName} · all"`, async () => {
        const c = data.inspectorC;
        expect(c, 'Inspector C added (FDI-25)').toBeTruthy();
        if (c.reused) { s.observe(`not checked: no free project member to add with a category scope (reused ${c.name})`); return; }
        await expect(inspectorRow(c.name).locator('td').nth(2)).toContainText(new RegExp(`${esc(data.catName)}\\s*·\\s*all`, 'i'));
      });
    });
    await sc('PM-REG-FDI-25a', 'First Delivery Inspection Config', 'Inspector list kept after navigating away', async s => {
      await s.step(`Open "Inventory Control", then "First Delivery Inspection Config" again → Inspectors page reloads`, async () => {
        await navigator.open('Inventory Control');
        await navigator.open('First Delivery Inspection Config');
      }, { critical: true });
      await s.step(`Inspectors table → inspectors A, B and C are still listed`, async () => {
        for (const key of ['A', 'B', 'C']) await visible(inspectorRow(data[`inspector${key}`].name), `Inspector ${key}`);
      });
    });
    await sc('PM-REG-FDI-23', 'First Delivery Inspection Config', 'Enable/Disable inspector', async s => {
      const row = () => inspectorRow(data.inspectorA.name);
      for (const [action, enabled] of [['Disable', 'Disabled'], ['Enable', 'Enabled']]) {
        await s.step(`Inspector A row: click "${action}", confirm, reload → Enabled column shows "${enabled}", role kept`, async () => {
          await click(row().getByRole('button', { name: action, exact: true }), action);
          await confirmDelete(); await reload();
          await expect(row().locator('td').nth(4)).toHaveText(enabled);
          await expect(row(), 'Row kept with its role').toContainText(data.inspectorA.role);
        });
      }
    });
    // Edit Material Mapping: an "All Materials" checkbox and a multi-select Materials dropdown (each option toggles).
    const editMaterials = async (name, { all = false, toggle = [] } = {}) => {
      await closeForm();
      await click(inspectorRow(name).getByTitle('Edit materials'), 'Edit materials');
      await expect(modal().getByText('Edit Material Mapping', { exact: true }), 'Edit Material Mapping').toBeVisible({ timeout: 10000 });
      const allBox = modal().locator('label', { hasText: /^All Materials$/ }).locator('input[type="checkbox"]').first();
      if ((await allBox.isChecked()) !== all) await click(modal().locator('label', { hasText: /^All Materials$/ }).first(), 'All Materials');
      if (toggle.length) {
        await click(modal().locator('label', { hasText: /^Materials$/ }).locator('xpath=following-sibling::*[@role="button"][1]'), 'Materials');
        // Long searchable list: type the name in its Search box, then click the match.
        for (const pick of toggle) {
          await page.getByPlaceholder(/^Search/).filter({ visible: true }).last().fill(pick);
          await click(page.getByText(exactI(pick)).filter({ visible: true }).last(), pick);
        }
        await page.keyboard.press('Escape');
      }
      const outcome = await submit('Save');
      if (!outcome.closed) await closeForm();
      await reload();
      return outcome;
    };
    const scopeChips = async name => (await inspectorRow(name).locator('td').nth(2).locator('span span, span').allInnerTexts()).map(clean).filter(text => text && !/^\+\d+ more$/.test(text));
    await sc('PM-REG-FDI-24', 'First Delivery Inspection Config', 'Edit materials scope', async s => {
      await s.step(`Inspector B row › "Edit materials": toggle the old material off and another on, click "Save", reload → scope shows the new material only`, async () => {
        const [from, to] = data.materialChoices;
        // Start from the inspector's current materials (a reused inspector may have none): toggle only what is needed
        // so that "to" is selected and "from" is not.
        const current = await inspectorRow(data.inspectorB.name).locator('td').nth(2).innerText();
        const toggle = [];
        if (new RegExp(esc(from), 'i').test(current)) toggle.push(from);
        if (!new RegExp(esc(to), 'i').test(current)) toggle.push(to);
        const outcome = await editMaterials(data.inspectorB.name, { toggle });
        s.observe(`message: ${outcome.message || '(none)'}`);
        const cell = inspectorRow(data.inspectorB.name).locator('td').nth(2);
        await expect(cell).toContainText(new RegExp(esc(to), 'i'));
        await expect(cell).not.toContainText(new RegExp(esc(from), 'i'));
      });
    });
    await sc('PM-REG-FDI-27', 'First Delivery Inspection Config', 'Material mapping: one, several, All Materials', async s => {
      await s.step(`Inspector B › "Edit materials": add a third material, "Save", reload → scope shows both chosen materials`, async () => {
        await editMaterials(data.inspectorB.name, { toggle: [data.materialChoices[2]] });
        const cell = inspectorRow(data.inspectorB.name).locator('td').nth(2);
        for (const pick of data.materialChoices.slice(1, 3)) await expect(cell).toContainText(new RegExp(esc(pick), 'i'));
      });
      await s.step(`Inspector B › "Edit materials": tick "All Materials", "Save", reload → scope reads "All Materials"`, async () => {
        await editMaterials(data.inspectorB.name, { all: true });
        await expect(inspectorRow(data.inspectorB.name).locator('td').nth(2)).toHaveText(/^\s*All Materials\s*$/);
        s.observe(`chips: ${(await scopeChips(data.inspectorB.name)).join(', ')}`);
      });
    });
    const inviteEmail = (index = 0) => modal().getByPlaceholder('Enter email address').nth(index);
    const inviteRole = async (index, role) => {
      await click(modal().getByRole('button', { name: 'Choose Role' }).first(), `Role ${index + 1}`);
      await click(page.getByRole('option', { name: role, exact: true }), role);
    };
    await sc('PM-REG-FDI-26', 'First Delivery Inspection Config', 'Invite several people at once', async s => {
      data.inviteA = `pm.a.${RUN.toLowerCase()}@yopmail.com`;
      data.inviteB = `pm.b.${RUN.toLowerCase()}@yopmail.com`;
      await s.step(`Inspectors › "Invite": ${data.inviteA} and ${data.inviteB} (via "Add Another User"), role "Project User" each, click "Send Invites" → form closes`, async () => {
        await openForm('Invite', 'Invite Users');
        await inviteEmail(0).fill(data.inviteA); await inviteRole(0, 'Project User');
        await click(button('Add Another User', modal()), 'Add Another User');
        await inviteEmail(1).fill(data.inviteB); await inviteRole(1, 'Project User');
        const outcome = await submit('Send Invites');
        expect(outcome.closed, `Invites sent (${outcome.message || 'no message'})`).toBe(true);
      });
      await s.step(`Inspectors table → both invited rows show "Invited - Pending Acceptance", Enabled "Disabled" and a disabled "Enable" button`, async () => {
        for (const email of [data.inviteA, data.inviteB]) {
          const row = inspectorRow(email);
          await expect(row, email).toBeVisible({ timeout: 20000 });
          await expect(row.locator('td').nth(3)).toHaveText('Invited - Pending Acceptance');
          await expect(row.locator('td').nth(4)).toHaveText('Disabled');
          await expect(row.getByRole('button', { name: 'Enable', exact: true })).toBeDisabled();
        }
      });
    });
    await sc('PM-REG-FDI-19', 'First Delivery Inspection Config', 'Invite duplicate / existing user email', async s => {
      await s.step(`"Invite": ${data.inviteA} again with role "Project User", "Send Invites"; close, reload → outcome recorded, still one row for it`, async () => {
        await openForm('Invite', 'Invite Users');
        await inviteEmail(0).fill(data.inviteA); await inviteRole(0, 'Project User');
        const outcome = await submit('Send Invites');
        s.observe(`form ${outcome.closed ? 'closed' : 'stayed open'}; message: ${outcome.message || '(none)'}`);
        await closeForm(); await reload();
        await expect(inspectorTable().locator('tbody tr').filter({ hasText: data.inviteA }), 'No second row').toHaveCount(1);
      });
    });

    // ----- Question sets, groups and questions -----
    // A set tab's accessible name is the set name followed by its categories; match the start, keeping case.
    const setTab = name => main.getByRole('button', { name: new RegExp(`^${esc(name)}`) }).first();
    const setTabsNamed = name => main.getByRole('button', { name: new RegExp(`^${esc(name)}`, 'i') });
    const questionTable = () => main.locator('table').filter({ has: page.getByText('Added On') }).first();
    const questionRow = text => questionTable().locator('tbody tr').filter({ hasText: text }).first();
    const newSet = async (name, categories = [], all = false) => {
      await openForm('New Question Set', 'New FDI Inspection Question Set');
      if (name !== null) await modal().getByPlaceholder('e.g. Steel Receiving Checks').fill(name);
      if (all) await click(modal().getByText('All Categories (catch-all)', { exact: true }), 'All Categories');
      for (const category of categories) {
        await modal().getByPlaceholder(CATEGORY_SEARCH).fill(category);
        await click(modal().locator('label', { hasText: new RegExp(esc(category), 'i') }).first(), category);
      }
      return submit('Create Question Set');
    };
    await sc('PM-REG-FDI-32', 'First Delivery Inspection Config', 'New Question Set – required', async s => {
      await s.step(`"New Question Set": read the category checkbox list, close the form → list recorded for later checks`, async () => {
        await openForm('New Question Set', 'New FDI Inspection Question Set');
        data.qsetCategories = (await modal().locator('label').filter({ has: page.locator('input[type="checkbox"]') }).allInnerTexts()).map(clean);
        await closeForm();
      });
      for (const [label, name, categories] of [['empty name', null, [data.catB]], ['no category', `Set X ${RUN}`, []]]) {
        await s.step(`"New Question Set": submit with ${label} → form stays open, set not created`, async () => {
          const outcome = await newSet(name, categories);
          s.observe(`message: ${outcome.message || '(none)'}`);
          expect(outcome.closed, 'Not created').toBe(false);
          await closeForm();
        });
      }
    });
    await sc('PM-REG-FDI-34', 'First Delivery Inspection Config', 'Create set for a free category', async s => {
      data.setName = `Set ${RUN}`;
      await s.step(`"New Question Set": name "${data.setName}", category "${data.catName}", click "Create Question Set" → form closes, new set tab appears`, async () => {
        const outcome = await newSet(data.setName, [data.catName]);
        expect(outcome.closed, `Created (${outcome.message || 'no message'})`).toBe(true);
        await visible(setTab(data.setName), 'New set tab');
      });
      await s.step(`"New Question Set": search category "${data.catName}" → label shows "(in: ${data.setName})"; close the form`, async () => {
        await openForm('New Question Set', 'New FDI Inspection Question Set');
        await modal().getByPlaceholder(CATEGORY_SEARCH).fill(data.catName);
        await visible(modal().getByText(new RegExp(`\\(in: ${esc(data.setName)}\\)`, 'i')), `(in: ${data.setName})`);
        await closeForm();
      });
    });
    await sc('PM-REG-FDI-42c', 'First Delivery Inspection Config', 'Empty Questions list', async s => {
      await s.step(`Click the "${data.setName}" tab → Questions list has no question rows (empty-state text recorded)`, async () => {
        await click(setTab(data.setName), data.setName);
        await navigator.ready();
        const rows = await questionTable().locator('tbody tr').count().catch(() => 0);
        s.observe(`rows: ${rows}; text: ${clean(await main.innerText()).match(/No questions[^.]*\.?/i)?.[0] || '(no empty-state text)'}`);
        expect(await questionTable().locator('tbody tr').filter({ hasText: /\d{2}\/\d{2}\/\d{4}/ }).count()).toBe(0);
      });
    });
    await sc('PM-REG-FDI-43', 'First Delivery Inspection Config', 'Duplicate question set name', async s => {
      await s.step(`"New Question Set": name "${data.setName.toUpperCase()}", category "${data.catB}", "Create Question Set"; close, reload → no second set tab with that name`, async () => {
        const before = await setTabsNamed(data.setName).count();
        const outcome = await newSet(data.setName.toUpperCase(), [data.catB]);
        s.observe(`form ${outcome.closed ? 'closed' : 'stayed open'}; message: ${outcome.message || '(none)'}`);
        await closeForm(); await reload();
        const after = await setTabsNamed(data.setName).count();
        if (after > before) throw new Error(`FDI question set names are not unique: "${data.setName.toUpperCase()}" was created next to "${data.setName}"`);
      });
    });
    const groupsTable = () => main.locator('table').filter({ has: page.getByText('Heading Display Text') }).first();
    const groupRow = name => groupsTable().locator('tbody tr').filter({ has: page.locator('td:nth-child(2)', { hasText: exactI(name) }) }).first();
    // A set with no groups shows no groups table, only the Add Group button.
    const openGroups = async () => {
      if (!(await main.getByRole('button', { name: 'Add Group', exact: true }).isVisible().catch(() => false))) await click(main.getByRole('button', { name: /^Manage Groups/ }), 'Manage Groups');
      await visible(main.getByRole('button', { name: 'Add Group', exact: true }), 'Add Group');
    };
    const addGroup = async name => {
      await closeForm();
      await click(main.getByRole('button', { name: 'Add Group', exact: true }), 'Add Group');
      await expect(modal(), 'Add Group form').toBeVisible({ timeout: 10000 });
      for (const input of await textInputs(modal()).all()) await input.fill(name);
      const action = await modal().getByRole('button', { name: /^(Add|Save|Create)$/ }).first().innerText();
      const outcome = await submit(action.trim());
      if (!outcome.closed) await closeForm();
      return outcome;
    };
    await sc('PM-REG-FDI-36', 'First Delivery Inspection Config', 'Add/edit/reorder/delete group', async s => {
      data.group = `Grp ${RUN}`;
      await s.step(`Set "${data.setName}" › "Manage Groups" › "Add Group": add "${data.group}" and "Grp2 ${RUN}" → both appear in the groups table`, async () => {
        await click(setTab(data.setName), data.setName);
        await openGroups();
        for (const name of [data.group, `Grp2 ${RUN}`]) {
          const outcome = await addGroup(name);
          expect(outcome.closed, `${name} added (${outcome.message || 'no message'})`).toBe(true);
          await visible(groupRow(name), name);
        }
      });
      await s.step(`Groups table: "Edit" on "Grp2 ${RUN}", Heading Display Text "Grp2 ${RUN} H", save → row shows the new heading`, async () => {
        await click(groupRow(`Grp2 ${RUN}`).getByRole('button', { name: 'Edit', exact: true }), 'Edit');
        await modal().locator('label', { hasText: 'Heading Display Text' }).locator('xpath=following::*[self::input or self::textarea][1]').fill(`Grp2 ${RUN} H`);
        const action = await modal().getByRole('button', { name: /^(Save|Update)$/ }).first().innerText();
        const outcome = await submit(action.trim());
        if (!outcome.closed) await closeForm();
        await expect(groupRow(`Grp2 ${RUN}`)).toContainText(`Grp2 ${RUN} H`);
      });
      await s.step(`Groups table: click "▲" on "Grp2 ${RUN}" → the group moves up one position`, async () => {
        const order = async () => (await groupsTable().locator('tbody tr td:nth-child(2)').allInnerTexts()).map(clean);
        const before = await order();
        await click(groupRow(`Grp2 ${RUN}`).getByRole('button', { name: '▲', exact: true }), '▲');
        await expect.poll(order, { timeout: 10000 }).not.toEqual(before);
        expect((await order()).indexOf(`Grp2 ${RUN}`)).toBe(before.indexOf(`Grp2 ${RUN}`) - 1);
      });
      await s.step(`Groups table: "Delete" on "Grp2 ${RUN}", confirm in the inline "Delete group" row → group removed`, async () => {
        await click(groupRow(`Grp2 ${RUN}`).getByRole('button', { name: 'Delete', exact: true }), 'Delete');
        // Confirmation is an inline row: "Delete group '<name>'? Its n question(s) will not be deleted…" Delete / Cancel.
        const confirmRow = groupsTable().locator('tbody tr').filter({ hasText: /^Delete group/ }).first();
        await expect(confirmRow).toContainText(`Grp2 ${RUN}`);
        s.observe(clean(await confirmRow.innerText()).replace(/ Delete Cancel$/, ''));
        await click(confirmRow.getByRole('button', { name: 'Delete', exact: true }), 'Confirm Delete');
        await expect(groupRow(`Grp2 ${RUN}`)).toHaveCount(0, { timeout: 15000 });
      });
    });
    await sc('PM-REG-FDI-45', 'First Delivery Inspection Config', 'Duplicate group name', async s => {
      await s.step(`"Add Group": "${data.group.toLowerCase()}" (existing name, lower case) → outcome recorded, only one group with that name; "Manage Groups" reopened`, async () => {
        const outcome = await addGroup(data.group.toLowerCase());
        s.observe(`form ${outcome.closed ? 'closed' : 'stayed open'}; message: ${outcome.message || '(none)'}`);
        await expect(groupsTable().locator('tbody tr td:nth-child(2)', { hasText: exactI(data.group) }), 'Only one group with this name').toHaveCount(1);
        await click(main.getByRole('button', { name: /^Manage Groups/ }), 'Manage Groups');
      });
    });
    // Questions must go into the run's own set: added elsewhere (e.g. "Unassigned questions") they would appear on
    // real inspection forms.
    const addQuestion = async (text, type) => {
      if (!data.setName) throw new Error("The run's question set was not created (FDI-34), so no question is added");
      await closeForm();
      await click(setTab(data.setName), data.setName);
      await expect(setTab(data.setName), 'Run set selected').toHaveClass(/border-primary|bg-primary|text-primary|active/, { timeout: 5000 }).catch(() => null);
      await openForm('Add Question', 'Add Question');
      if (text !== null) await modal().locator('label', { hasText: 'Question Text' }).locator('xpath=following::input[1]').fill(text);
      if (type) await choose(modal().getByRole('button', { name: 'Choose Answer Type' }), type, 'Answer Type');
      return submit('Add');
    };
    await sc('PM-REG-FDI-38', 'First Delivery Inspection Config', 'Add Question – text and Data Type required', async s => {
      for (const [label, text, type] of [['empty Question Text', null, 'Text'], ['no Answer Type', `FDI Q X ${RUN}`, null]]) {
        await s.step(`Set "${data.setName}" › "Add Question": submit with ${label} → form stays open, question not added`, async () => {
          const outcome = await addQuestion(text, type);
          s.observe(`message: ${outcome.message || '(none)'}`);
          expect(outcome.closed, 'Not added').toBe(false);
          await closeForm();
        });
      }
    });
    await sc('PM-REG-FDI-39', 'First Delivery Inspection Config', 'Add Question – enabled at once in the current project', async s => {
      data.question = `FDI Q ${RUN}`;
      await s.step(`"Add Question": Question Text "${data.question}", Answer Type "Text", click "Add" → form closes`, async () => {
        const outcome = await addQuestion(data.question, 'Text');
        expect(outcome.closed, `Added (${outcome.message || 'no message'})`).toBe(true);
      });
      await s.step(`Questions table → "${data.question}" row shows type "text", Added On today and Status "Enabled"`, async () => {
        const row = questionRow(data.question);
        await expect(row).toBeVisible({ timeout: 15000 });
        // Columns: #, Question, Group, Type, Added On, Status, Actions (row text runs cells together).
        await expect(row.locator('td').nth(3)).toHaveText(/^\s*text\s*$/i);
        await expect(row.locator('td').nth(4)).toHaveText(ddmmyyyy(new Date()));
        await expect(row.locator('td').nth(5)).toHaveText(/Enabled/);
      });
    });
    await sc('PM-REG-FDI-44', 'First Delivery Inspection Config', 'Duplicate question text', async s => {
      await s.step(`"Add Question": "${data.question.toUpperCase()}" with extra spaces, type "Text" → outcome recorded; reload → only one question with this text`, async () => {
        const outcome = await addQuestion(`  ${data.question.toUpperCase()} `, 'Text');
        s.observe(`form ${outcome.closed ? 'closed' : 'stayed open'}; message: ${outcome.message || '(none)'}`);
        await closeForm(); await reload();
        await click(setTab(data.setName), data.setName);
        await expect(questionRow(data.question), 'Questions loaded').toBeVisible({ timeout: 15000 });
        const texts = (await questionTable().locator('tbody tr td:nth-child(2)').allInnerTexts()).filter(text => norm(text) === norm(data.question));
        expect(texts, 'Only one question with this text').toHaveLength(1);
      });
    });
    await sc('PM-REG-FDI-41', 'First Delivery Inspection Config', 'Reorder and regroup questions', async s => {
      const order = async () => (await questionTable().locator('tbody tr td:nth-child(2)').allInnerTexts()).map(clean);
      await s.step(`"Add Question": "FDI Q2 ${RUN}" (Text), then click "▲" on its row → question added and moves up`, async () => {
        const outcome = await addQuestion(`FDI Q2 ${RUN}`, 'Text');
        expect(outcome.closed, `Added (${outcome.message || 'no message'})`).toBe(true);
        await visible(questionRow(`FDI Q2 ${RUN}`), `FDI Q2 ${RUN}`);
        const before = await order();
        await click(questionRow(`FDI Q2 ${RUN}`).getByRole('button', { name: '▲', exact: true }), '▲');
        await expect.poll(order, { timeout: 10000 }).not.toEqual(before);
      });
      await s.step(`Questions table: Group dropdown of "FDI Q2 ${RUN}" set to "${data.group}", reload → group kept`, async () => {
        await questionRow(`FDI Q2 ${RUN}`).locator('select').selectOption({ label: data.group });
        await navigator.ready(); await reload();
        await click(setTab(data.setName), data.setName);
        await expect(questionRow(`FDI Q2 ${RUN}`).locator('select')).toHaveValue(/.+/);
        expect(clean(await questionRow(`FDI Q2 ${RUN}`).locator('select option:checked').innerText())).toBe(data.group);
      });
    });
    await sc('PM-REG-FDI-40', 'First Delivery Inspection Config', 'Add from Organization Bank', async s => {
      const bankRows = () => modal().locator('div.p-2\\.5').filter({ has: page.locator('input[type="checkbox"]') });
      await s.step(`"Add Question" › "Add from Organization Bank": tick a bank question, Answer Type "Text", click "Add Selected" → question added (message recorded)`, async () => {
        await click(setTab(data.setName), data.setName);
        await openForm('Add Question', 'Add Question');
        await click(modal().getByRole('button', { name: 'Add from Organization Bank', exact: true }), 'Add from Organization Bank');
        await expect(bankRows().first(), 'A bank question').toBeVisible({ timeout: 15000 });
        const row = bankRows().filter({ hasText: 'Not currently enabled anywhere else' }).first().or(bankRows().first()).first();
        data.bankQuestion = clean(await row.locator('p').first().innerText());
        await row.locator('input[type="checkbox"]').check();
        await row.locator('select').nth(1).selectOption({ label: 'Text' });
        const outcome = await submit('Add Selected');
        s.observe(`added "${data.bankQuestion}"; message: ${outcome.message || '(none)'}`);
        await closeForm();
      });
      await s.step(`Questions table → the bank question is listed with "Enabled"`, async () => {
        const row = questionRow(data.bankQuestion);
        await expect(row).toBeVisible({ timeout: 15000 });
        await expect(row).toContainText('Enabled');
      });
      await s.step(`"Add Question" › "Add from Organization Bank" again → the added bank question is no longer offered`, async () => {
        await openForm('Add Question', 'Add Question');
        await click(modal().getByRole('button', { name: 'Add from Organization Bank', exact: true }), 'Add from Organization Bank');
        await page.waitForTimeout(1500);
        await expect(bankRows().filter({ has: page.locator('p', { hasText: exactI(data.bankQuestion) }) })).toHaveCount(0);
        await closeForm();
      });
    });
    await sc('PM-REG-FDI-42', 'First Delivery Inspection Config', 'Delete a question', async s => {
      await s.step(`Questions table: "Delete" on "${data.question}", confirm → row removed`, async () => {
        await withDialog(async () => { await click(questionRow(data.question).getByRole('button', { name: 'Delete', exact: true }), 'Delete'); await confirmDelete(); });
        await expect(questionTable().locator('tbody tr').filter({ hasText: data.question }).filter({ hasNotText: `Q2 ${RUN}` })).toHaveCount(0, { timeout: 15000 });
      });
    });
    await sc('PM-REG-FDI-42a', 'First Delivery Inspection Config', 'Show deleted questions lists deleted ones', async s => {
      await s.step(`Tick "Show deleted questions" → "${data.question}" is listed as deleted; untick it`, async () => {
        await click(main.getByText('Show deleted questions', { exact: true }), 'Show deleted questions');
        const row = questionTable().locator('tbody tr').filter({ has: page.locator('td:nth-child(2)', { hasText: exactI(data.question) }) }).first();
        await expect(row).toBeVisible({ timeout: 15000 });
        s.observe(`deleted row shows: ${clean(await row.innerText())}`);
        await expect(row).toContainText(/deleted/i);
        await click(main.getByText('Show deleted questions', { exact: true }), 'Show deleted questions');
      });
    });

    // ================= Inventory Control =================
    // Rules are listed as cards ("Inventory Item <name> Min Balance <n> Max Balance <n> …"), one rule per material
    // ("Alert settings for this material already exist."), so each case uses a material created by this run.
    const ruleList = async () => {
      const text = await main.innerText();
      return [...`${text}\n`.matchAll(/Inventory Item\s*\n\s*(.+?)\s*\n\s*Min Balance\s*\n\s*(.+?)\s*\n\s*Max Balance\s*\n\s*(.+?)\s*\n/g)]
        .map(([, item, min, max]) => ({ item: item.trim(), min: min.trim(), max: max.trim() }));
    };
    const ruleFor = async name => (await ruleList()).find(rule => norm(rule.item) === norm(name));
    const addRule = async ({ item, min, max, notifyMin, notifyMax }) => {
      await openForm('Add Rule', 'Add Rule');
      if (item !== undefined) data.ruleItem = await choose(modal().getByRole('button', { name: 'Choose Inventory Item' }), item, 'Inventory Item');
      const numbers = modal().locator('input[type="number"]');
      if (min !== undefined) { await numbers.nth(0).click(); await numbers.nth(0).fill(String(min)); }
      if (max !== undefined) { await numbers.nth(1).click(); await numbers.nth(1).fill(String(max)); }
      // The notify toggles are switch tracks next to their labels.
      if (notifyMin) await click(modal().locator('label', { hasText: 'Notify on min balance breach' }).locator('xpath=following-sibling::div[1]'), 'Notify on min');
      if (notifyMax) await click(modal().locator('label', { hasText: 'Notify on max balance breach' }).locator('xpath=following-sibling::div[1]'), 'Notify on max');
      const outcome = await submit('Add');
      if (!outcome.closed) await closeForm();
      await reload();
      return outcome;
    };
    await sc('PM-REG-INV-02', 'Inventory Control', 'Add Rule – required', async s => {
      data.rulesBefore = (await ruleList()).length;
      for (const [label, values] of [['nothing', {}], ['Min/Max without item', { min: 10, max: 100 }], ['item without Min/Max', { item: data.material }]]) {
        await s.step(`Inventory Control › "Add Rule": submit with ${label} → form stays open, no rule added`, async () => {
          const outcome = await addRule(values);
          s.observe(`message: ${outcome.message || '(none)'}`);
          expect(outcome.closed, 'Not added').toBe(false);
        });
      }
      await s.step(`Rules list → rule count unchanged`, async () => expect((await ruleList()).length).toBe(data.rulesBefore));
    });
    await sc('PM-REG-INV-03', 'Inventory Control', 'Add Rule – happy path', async s => {
      await s.step(`"Add Rule": Inventory Item "${data.material}", Min Balance 10, Max Balance 100, both notify toggles on, click "Add" → outcome recorded`, async () => {
        data.ruleSite = await new SiteSelectorPage(page).activeSiteName();
        const outcome = await addRule({ item: data.material, min: 10, max: 100, notifyMin: true, notifyMax: true });
        s.observe(`message: ${outcome.message || '(none)'}`);
      });
      await s.step(`Rules list (after reload) → rule for "${data.material}" shows Min 10 and Max 100`, async () => {
        const rule = await ruleFor(data.material);
        expect(rule, `Rule for ${data.material}`).toBeTruthy();
        expect([rule.min, rule.max]).toEqual(['10', '100']);
      });
    });
    await sc('PM-REG-INV-04', 'Inventory Control', 'Min greater than Max', async s => {
      await s.step(`"Add Rule": item "Mat CB ${RUN}", Min 100, Max 10, click "Add" → outcome recorded (accepted or rejected, Q-INV-1)`, async () => {
        const outcome = await addRule({ item: `Mat CB ${RUN}`, min: 100, max: 10 });
        const rule = await ruleFor(`Mat CB ${RUN}`);
        // Expected result is not confirmed (Ev. I): record what the app does; see open question Q-INV-1.
        s.observe(rule ? `ACCEPTED: rule saved with Min ${rule.min} / Max ${rule.max} (to confirm with the product owner, Q-INV-1)` : `rejected; message: ${outcome.message || '(none)'}`);
      });
    });
    await sc('PM-REG-INV-05', 'Inventory Control', 'Negative / zero / decimal', async s => {
      const item = data.childMaterial;
      for (const [label, values] of [['Min -1', { min: -1, max: 5 }], ['Min 0', { min: 0, max: 5 }], ['Max 0.5', { min: 0, max: 0.5 }]]) {
        await s.step(`"Add Rule" for "${item}" with ${label} (skipped when it already has a rule) → outcome recorded`, async () => {
          if (await ruleFor(item)) { s.observe(`not tried: "${item}" already has a rule (one rule per material)`); return; }
          const outcome = await addRule({ item, ...values });
          const rule = await ruleFor(item);
          s.observe(rule ? `ACCEPTED: Min ${rule.min} / Max ${rule.max}` : `rejected; message: ${outcome.message || '(none)'}`);
        });
      }
    });
    await sc('PM-REG-INV-07', 'Inventory Control', 'Rule is site-specific', async s => {
      const sites = new SiteSelectorPage(page);
      await s.step(`Header site selector: choose a different site → site switches`, async () => {
        await click(sites.siteSelector, 'Site selector');
        const options = (await page.getByRole('listbox').last().getByRole('option').allInnerTexts()).map(clean).filter(name => name && norm(name) !== norm(data.ruleSite));
        await page.keyboard.press('Escape');
        expect(options.length, 'Another site').toBeGreaterThan(0);
        data.otherSite = options[0];
        await sites.ensureSite(data.otherSite); await navigator.ready();
      }, { critical: true });
      await s.step(`Inventory Control rules → rule for "${data.material}" is not listed on the other site`, async () => {
        await page.waitForTimeout(1500);
        expect(await ruleFor(data.material)).toBeFalsy();
      });
      await s.step(`Header site selector: switch back to the original site → rule for "${data.material}" is listed again`, async () => {
        await sites.ensureSite(data.ruleSite); await navigator.ready(); await page.waitForTimeout(1500);
        expect(await ruleFor(data.material)).toBeTruthy();
      });
    });

    // ================= PreShipping Checklist =================
    // Precondition (as in part 1): the page is only listed while the project's Pre-Shipping option is on.
    if (!(await navigator.hasMenuEntry('PreShipping Checklist'))) {
      run.block(meta('PM-REG-PSC-02', 'PreShipping Checklist', 'Enabled tick saves automatically'),
        "Environment precondition not met: the project's Pre-Shipping option is switched off (Project Management › Configuration Options), so the \"PreShipping Checklist\" menu entry is hidden. Switch it on and re-run this case.");
    } else await sc('PM-REG-PSC-02', 'PreShipping Checklist', 'Enabled tick saves automatically', async s => {
      const box = () => main.locator('tbody tr').last().locator('input[type="checkbox"]');
      let original;
      await s.step(`Sidebar › Project Management › "PreShipping Checklist" → page opens`, () => navigator.open('PreShipping Checklist'), { critical: true });
      try {
        await s.step(`Last question's "Enabled" checkbox: click it (no Save button; choose Answer Type "Text" and "Add" if asked), reload → change kept`, async () => {
          original = await box().isChecked();
          await focus(box()); await box().click(); await page.waitForTimeout(1200);
          // Enabling a question asks for its answer type first ("Select Answer Type": Boolean / Text / Date → Add).
          const typeDialog = page.locator(OVERLAY).filter({ visible: true }).filter({ hasText: 'Select Answer Type' }).last();
          if (await typeDialog.isVisible().catch(() => false)) {
            await choose(typeDialog.getByRole('button', { name: 'Choose Answer Type' }), 'Text', 'Answer Type');
            await click(typeDialog.getByRole('button', { name: 'Add', exact: true }), 'Add');
            await expect(typeDialog).toBeHidden({ timeout: 10000 });
          }
          await page.waitForTimeout(1500);
          s.observe(`message: ${await feedback() || '(none)'}`);
          await reload();
          // The direction depends on the last question's current state. 21 Nov 2026: switching an enabled question OFF
          // shows no message and is not kept (SCP-DEF-063, pending confirmation: a question in use may be locked).
          const direction = original ? 'Switching "Enabled" OFF' : 'Switching "Enabled" ON';
          expect(await box().isChecked(), `${direction} on a PreShipping question was not kept after reload`).toBe(!original);
        });
      } finally {
        await s.step(`Click the last question's checkbox back if needed, reload → original value restored`, async () => {
          if (original !== undefined && (await box().isChecked()) !== original) { await box().click(); await page.waitForTimeout(1500); await reload(); }
          expect(await box().isChecked()).toBe(original);
        });
      }
    });

    // ================= Procurement Log Configuration =================
    // The app stores field names title-cased with "-" turned into a space ("Field PMR2-…" → "Field Pmr2 …"), so letters
    // and digits are matched in order, ignoring case and punctuation.
    const looseName = name => new RegExp(String(name).split(/[^A-Za-z0-9]+/).filter(Boolean).map(esc).join('[^A-Za-z0-9]*'), 'i');
    const logRow = name => main.locator('tbody tr').filter({ hasText: looseName(name) }).first();
    const addLogField = async (name, type) => {
      await openForm('Add Log Fields', 'Add Procurement Log Fields');
      if (name !== null) await textInputs(modal()).first().fill(name);
      if (type) await choose(modal().getByRole('button', { name: 'Choose Field Type' }), type, 'Field Type');
      const outcome = await submit('Add');
      if (!outcome.closed) await closeForm();
      return outcome;
    };
    const logFieldCount = () => main.locator('tbody tr').count();
    await sc('PM-REG-PLC-03', 'Procurement Log Configuration', 'Add field – required', async s => {
      await s.step(`Sidebar › Project Management › "Procurement Log Configuration" → page opens`, () => navigator.open('Procurement Log Configuration'), { critical: true });
      data.logFields = await logFieldCount();
      for (const [label, name, type] of [['empty name and type', null, null], ['name only', `Field X ${RUN}`, null], ['type only', null, 'String']]) {
        await s.step(`"Add Log Fields": submit with ${label} → form stays open, no field added`, async () => {
          const outcome = await addLogField(name, type);
          s.observe(`message: ${outcome.message || '(none)'}`);
          expect(outcome.closed, 'Not added').toBe(false);
        });
      }
      await s.step(`Fields table → row count unchanged`, async () => expect(await logFieldCount()).toBe(data.logFields));
    });
    await sc('PM-REG-PLC-04', 'Procurement Log Configuration', 'Add custom field', async s => {
      data.logField = `Field ${RUN}`;
      await s.step(`"Add Log Fields": name "${data.logField}", Field Type "String", click "Add" → form closes`, async () => {
        const outcome = await addLogField(data.logField, 'String');
        expect(outcome.closed, `Added (${outcome.message || 'no message'})`).toBe(true);
      });
      await s.step(`Fields table → row "${data.logField}(Custom)" listed and row count up by 1`, async () => {
        await expect(logRow(`${data.logField}(Custom)`)).toBeVisible({ timeout: 15000 });
        expect(await logFieldCount()).toBe(data.logFields + 1);
      });
    });
    // Rows that a duplicate attempt adds appear at the end of the list; they are disabled again so the Procurement Log
    // never shows a test column.
    const disableRowsAfter = async count => {
      const rows = main.locator('tbody tr');
      const total = await rows.count();
      let changed = 0;
      for (let index = count; index < total; index += 1) {
        const box = rows.nth(index).locator('input[type="checkbox"]').first();
        if (await box.isChecked() && !(await box.isDisabled())) { await box.click(); changed += 1; }
      }
      if (changed) { await click(button('Save Changes'), 'Save Changes'); await page.waitForTimeout(1500); await reload(); }
      return changed;
    };
    await sc('PM-REG-PLC-08', 'Procurement Log Configuration', 'Duplicate field name', async s => {
      await s.step(`"Add Log Fields": "${data.logField}" again, type "String", "Add"; reload → no duplicate added (any added rows are disabled again via "Save Changes")`, async () => {
        const before = await logFieldCount();
        const outcome = await addLogField(data.logField, 'String');
        s.observe(`form ${outcome.closed ? 'closed' : 'stayed open'}; message: ${outcome.message || '(none)'}`);
        await reload();
        const after = await logFieldCount();
        if (after > before) {
          const disabled = await disableRowsAfter(before);
          throw new Error(`Procurement Log Configuration accepted a duplicate field name "${data.logField}" (${after - before} field(s) added; ${disabled} disabled again)`);
        }
      });
      // A standard field name ("Spec Section No") is accepted and stored as another standard field (SCP-DEF-041); disabling
      // that copy hides the real field from Add Submittal, so this attempt is not repeated on the shared project.
      await s.step(`Standard field name "Spec Section No" → not repeated (known defect SCP-DEF-041), reason recorded`, async () => s.observe('not repeated: accepted on 31 Oct 2026 and stored as another standard field (SCP-DEF-041); a further copy would change the Add Submittal form'));
    });
    await sc('PM-REG-PLC-05', 'Procurement Log Configuration', 'Enable/disable + Save Changes', async s => {
      const box = () => logRow(`${data.logField}(Custom)`).locator('input[type="checkbox"]').first();
      let original;
      try {
        await s.step(`Click the "${data.logField}(Custom)" checkbox, click "Save Changes", reload → change kept`, async () => {
          original = await box().isChecked();
          await focus(box()); await box().click();
          await click(button('Save Changes'), 'Save Changes'); await page.waitForTimeout(1200);
          s.observe(`message: ${await feedback() || '(none)'}`);
          await reload();
          expect(await box().isChecked(), 'Change kept').toBe(!original);
        });
      } finally {
        await s.step(`Click the checkbox back if needed, "Save Changes", reload → original value restored`, async () => {
          if (original !== undefined && (await box().isChecked()) !== original) { await box().click(); await click(button('Save Changes'), 'Save Changes'); await reload(); }
          expect(await box().isChecked()).toBe(original);
        });
        await s.step(`Untick the run field, "Save Changes", reload → field disabled so the Procurement Log shows no test column`, async () => {
          if (await box().isChecked()) { await box().click(); await click(button('Save Changes'), 'Save Changes'); await reload(); }
          expect(await box().isChecked()).toBe(false);
        });
      }
    });

    // Cross-module (22 Nov 2026): every enabled custom field of the configuration is offered in Add Submittal.
    await sc('PM-REG-PLC-07', 'Procurement Log Configuration', 'Custom field in Add Submittal', async s => {
      const enabled = [];
      await s.step('Procurement Log Configuration → read the enabled custom fields ("<name>(Custom)" rows with a ticked box)', async () => {
        await navigator.open('Procurement Log Configuration'); await reload();
        const rows = await main.locator('tbody tr').evaluateAll(trs => trs.map(tr => ({ text: tr.innerText, on: !!tr.querySelector('input[type=checkbox]')?.checked })));
        for (const row of rows) { const m = row.text.match(/([^\n\t]+?)\s*\(Custom\)/); if (m && row.on) enabled.push(m[1].trim()); }
        s.observe(`Enabled custom fields: ${enabled.join(', ') || 'none'}`);
        expect(enabled.length, 'at least one enabled custom field').toBeGreaterThan(0);
      }, { critical: true });
      await s.step('Left menu › "Procurement Log" › "Add Submittal" → every enabled custom field is a field of the form; close without saving', async () => {
        await page.locator('nav').getByRole('button', { name: /^\s*Procurement Log\s*$/ }).first().click();
        await expect(page).toHaveURL(/\/procurement-log/, { timeout: 20000 });
        await main.getByRole('button', { name: 'Add Submittal', exact: true }).click();
        const form = page.getByRole('heading', { name: 'Add Submittal' }).locator('xpath=../..');
        await expect(form).toBeVisible({ timeout: 15000 });
        const text = await form.innerText();
        const missing = enabled.filter(name => !text.includes(name));
        s.observe(missing.length ? `Not in the form: ${missing.join(', ')}` : `All ${enabled.length} shown`);
        await page.keyboard.press('Escape');
        if (await form.isVisible().catch(() => false)) await form.getByRole('button').first().click().catch(() => null);
        expect(missing, `custom fields missing from Add Submittal: ${missing.join(', ')}`).toEqual([]);
      });
    });

    // ================= Site Details =================
    const siteRows = () => main.locator('tbody tr').evaluateAll(rows => rows.map(r => [...r.cells].map(c => c.innerText.trim())));
    const siteByName = async name => (await siteRows()).filter(cells => norm(cells[2]) === norm(name));
    const siteRow = name => main.locator('tbody tr').filter({ has: page.locator('td:nth-child(3)', { hasText: exactI(name) }) }).first();
    const addSite = async ({ type, name, city, country }) => {
      await openForm('Add Site', 'Add Site');
      if (type) await choose(modal().getByRole('button', { name: 'Choose Site' }), type, 'Site Type');
      if (name) await modal().locator('label', { hasText: /^Name/ }).locator('xpath=following::input[1]').fill(name);
      if (city) await modal().locator('label', { hasText: 'City' }).locator('xpath=following::input[1]').fill(city);
      if (country !== undefined) {
        const trigger = modal().getByRole('button', { name: 'Choose Country' });
        const offered = await dropdownOptions(trigger);
        data.country = await choose(trigger, offered.find(option => norm(option) === norm(country)) || offered[0], 'Country');
      }
      const outcome = await submit('Add');
      if (!outcome.closed) await closeForm();
      return outcome;
    };
    const addLocation = async (site, type, name) => {
      await closeForm();
      await click(siteRow(site).getByRole('button', { name: 'ADD', exact: true }), 'ADD location');
      await expect(modal(), 'Add Location').toBeVisible({ timeout: 10000 });
      if (type) await choose(modal().getByRole('button', { name: 'Choose Location' }), type, 'Location Type');
      if (name) await textInputs(modal()).first().fill(name);
      const outcome = await submit('Add');
      if (!outcome.closed) await closeForm();
      return outcome;
    };
    const locationsOf = async name => firstNumber(((await siteByName(name))[0] || [])[5] || '0');
    await sc('PM-REG-SITE-03', 'Site Details', 'Add Site – required', async s => {
      await s.step(`Sidebar › Project Management › "Site Details" → page opens`, () => navigator.open('Site Details'), { critical: true });
      data.siteCount = await pageCount();
      for (const [label, values] of [['nothing', {}], ['no Site Type', { name: `Gate R ${RUN}` }], ['no Name', { type: 'Site' }]]) {
        await s.step(`"Add Site": submit with ${label} → form stays open, nothing added`, async () => {
          const outcome = await addSite(values);
          s.observe(`message: ${outcome.message || '(none)'}`);
          expect(outcome.closed, 'Not added').toBe(false);
        });
      }
    });
    await sc('PM-REG-SITE-04', 'Site Details', 'Add Site – happy path', async s => {
      data.site = `Gate ${RUN}`;
      await s.step(`"Add Site": Site Type "Site", Name "${data.site}", City "Chennai", Country India (or first listed), click "Add" → form closes`, async () => {
        const outcome = await addSite({ type: 'Site', name: data.site, city: 'Chennai', country: 'India' });
        expect(outcome.closed, `Added (${outcome.message || 'no message'})`).toBe(true);
      });
      await s.step(`Sites table → "${data.site}" listed once; after reload the header site selector offers "${data.site}"`, async () => {
        await expect.poll(async () => (await siteByName(data.site)).length, { timeout: 15000 }).toBe(1);
        const sites = new SiteSelectorPage(page);
        await reload();
        await click(sites.siteSelector, 'Site selector');
        await visible(page.getByRole('option', { name: exactI(data.site) }), `${data.site} in the site selector`);
        await page.keyboard.press('Escape'); await page.mouse.click(5, 300);
      });
    });
    await sc('PM-REG-SITE-05', 'Site Details', 'Add Location', async s => {
      await s.step(`Row "ADD" (location) on "${data.site}": Location Type "Construction Area", name "Loc ${RUN}", click "Add" → form closes, Locations count up by 1`, async () => {
        const before = await locationsOf(data.site);
        const outcome = await addLocation(data.site, 'Construction Area', `Loc ${RUN}`);
        expect(outcome.closed, `Added (${outcome.message || 'no message'})`).toBe(true);
        await expect.poll(() => locationsOf(data.site), { timeout: 15000 }).toBe(before + 1);
      });
    });
    await sc('PM-REG-SITE-09', 'Site Details', 'Duplicate site name', async s => {
      await s.step(`"Add Site": "${data.site.toLowerCase()}" (other case), type "Site", City "Chennai", click "Add" → outcome recorded, still one site with this name`, async () => {
        const outcome = await addSite({ type: 'Site', name: data.site.toLowerCase(), city: 'Chennai' });
        s.observe(`form ${outcome.closed ? 'closed' : 'stayed open'}; message: ${outcome.message || '(none)'}`);
        expect(await siteByName(data.site), 'Only one site with this name').toHaveLength(1);
      });
    });
    await sc('PM-REG-SITE-10', 'Site Details', 'Duplicate location name', async s => {
      await s.step(`Row "ADD" on "${data.site}": "Loc ${RUN}" again, Construction Area, click "Add" → outcome recorded, Locations count unchanged`, async () => {
        const before = await locationsOf(data.site);
        const outcome = await addLocation(data.site, 'Construction Area', `Loc ${RUN}`);
        s.observe(`form ${outcome.closed ? 'closed' : 'stayed open'}; message: ${outcome.message || '(none)'}`);
        expect(await locationsOf(data.site), 'Locations count unchanged').toBe(before);
      });
    });

    // ----- Site Details uploads -----
    const siteFile = (id, rows) => writeUpload({ template: data.siteTemplate, sheet: 'Sheet1', rows, output: path.join(files, `${id.toLowerCase()}-${RUN}.xlsx`) });
    const siteRowData = (site_name, location_name, extra = {}) => ({ site_name, site_type: 'Site', location_name, location_type: 'Construction Area', ...extra });
    const siteUpload = async (s, id, rows) => {
      const file = siteFile(id, rows);
      data.uploads = data.uploads || {};
      data.uploads[id] = path.basename(file);
      const message = await uploadFrom('Upload', file);
      const { seen } = await handleUploadDialogs();
      if (seen.length) s.observe(seen.join(' » '));
      s.observe(`message: ${message || await feedback() || '(none)'}`);
      await navigator.ready(); await page.waitForTimeout(2000); await reload();
    };
    const siteListed = async name => (await siteByName(name)).length;
    const sitesNotCreated = async (...names) => { for (const name of names) expect(await siteListed(name), `${name} not created`).toBe(0); };
    await sc('UPL-SITE-02', 'Site Details › Upload', 'Valid upload creates a site with locations', async s => {
      await s.step(`Click "Upload" › "Download Template" → site template downloads`, async () => {
        await click(button('Upload'), 'Upload');
        const file = await download(page.getByText('Download Template', { exact: true }).first(), 'Download Template');
        data.siteTemplate = file.path;
        await page.keyboard.press('Escape'); await page.mouse.click(5, 300);
      }, { critical: true });
      await s.step(`"Upload": site "Site U ${RUN}" with locations "Loc A ${RUN}" and "Loc B ${RUN}", confirm the dialogs, reload → result recorded`, () => siteUpload(s, 'UPL-SITE-02', [siteRowData(`Site U ${RUN}`, `Loc A ${RUN}`), siteRowData(`Site U ${RUN}`, `Loc B ${RUN}`)]), { critical: true });
      await s.step(`Sites table → "Site U ${RUN}" listed once with 2 locations`, async () => {
        await expect.poll(() => siteListed(`Site U ${RUN}`), { timeout: 30000 }).toBe(1);
        expect(await locationsOf(`Site U ${RUN}`)).toBe(2);
      });
    });
    await sc('UPL-SITE-03', 'Site Details › Upload', 'Fully invalid file', async s => {
      const before = await pageCount();
      await s.step(`"Upload": two rows with a blank site_name, confirm the dialogs, reload → result recorded`, () => siteUpload(s, 'UPL-SITE-03', [siteRowData('', `Loc C ${RUN}`), siteRowData('', `Loc C2 ${RUN}`)]));
      await s.step(`Sites count → unchanged, nothing created`, async () => expect(await pageCount()).toBe(before));
    });
    await sc('UPL-SITE-04', 'Site Details › Upload', 'Partly valid file', async s => {
      await s.step(`"Upload": valid "Site V ${RUN}" plus "Site W ${RUN}" with invalid site_type "xyz ${RUN}", confirm, reload → result recorded`, () => siteUpload(s, 'UPL-SITE-04', [siteRowData(`Site V ${RUN}`, `Loc V ${RUN}`), siteRowData(`Site W ${RUN}`, `Loc W ${RUN}`, { site_type: `xyz ${RUN}` })]));
      await s.step(`Sites table → "Site V ${RUN}" listed once, "Site W ${RUN}" not created`, async () => {
        await expect.poll(() => siteListed(`Site V ${RUN}`), { timeout: 30000 }).toBe(1);
        await sitesNotCreated(`Site W ${RUN}`);
      });
    });
    await sc('UPL-SITE-05', 'Site Details › Upload', 'Required cells', async s => {
      await s.step(`"Upload": X1 with a blank site_type, X2 with a blank location_name, X3 with a blank location_type, confirm, reload → result recorded`, () => siteUpload(s, 'UPL-SITE-05', [
        siteRowData(`Site X1 ${RUN}`, `Loc X1 ${RUN}`, { site_type: '' }), siteRowData(`Site X2 ${RUN}`, ''), siteRowData(`Site X3 ${RUN}`, `Loc X3 ${RUN}`, { location_type: '' })]));
      await s.step(`Sites table → none of "Site X1 ${RUN}", "Site X2 ${RUN}", "Site X3 ${RUN}" is created`, () => sitesNotCreated(`Site X1 ${RUN}`, `Site X2 ${RUN}`, `Site X3 ${RUN}`));
    });
    await sc('UPL-SITE-06', 'Site Details › Upload', 'Invalid type values', async s => {
      await s.step(`"Upload": Y1 with site_type "xyz ${RUN}" and Y2 with location_type "xyz ${RUN}", confirm, reload → result recorded`, () => siteUpload(s, 'UPL-SITE-06', [
        siteRowData(`Site Y1 ${RUN}`, `Loc Y1 ${RUN}`, { site_type: `xyz ${RUN}` }), siteRowData(`Site Y2 ${RUN}`, `Loc Y2 ${RUN}`, { location_type: `xyz ${RUN}` })]));
      await s.step(`Sites table → neither "Site Y1 ${RUN}" nor "Site Y2 ${RUN}" is created`, () => sitesNotCreated(`Site Y1 ${RUN}`, `Site Y2 ${RUN}`));
    });
    await sc('UPL-SITE-07', 'Site Details › Upload', 'Template sample types are not valid by default', async s => {
      await s.step(`"Upload": Z1 with the template sample types "local"/"CONSTRUCTION" and Z2 with "Site"/"Construction Area", confirm, reload → result recorded`, () => siteUpload(s, 'UPL-SITE-07', [
        siteRowData(`Site Z1 ${RUN}`, `Loc Z1 ${RUN}`, { site_type: 'local', location_type: 'CONSTRUCTION' }), siteRowData(`Site Z2 ${RUN}`, `Loc Z2 ${RUN}`)]));
      await s.step(`Sites table → "Site Z2 ${RUN}" created, "Site Z1 ${RUN}" not created`, async () => {
        await expect.poll(() => siteListed(`Site Z2 ${RUN}`), { timeout: 30000 }).toBe(1);
        await sitesNotCreated(`Site Z1 ${RUN}`);
      });
    });
    await sc('UPL-SITE-08', 'Site Details › Upload', 'Existing site name', async s => {
      await s.step(`"Upload": existing site "${data.site.toUpperCase()}" (other case) with location "Loc E ${RUN}", confirm, reload → result recorded`, async () => {
        data.siteLocations = await locationsOf(data.site);
        await siteUpload(s, 'UPL-SITE-08', [siteRowData(data.site.toUpperCase(), `Loc E ${RUN}`)]);
      });
      await s.step(`Sites table → still one "${data.site}" and its Locations count unchanged (rule R46)`, async () => {
        expect(await siteListed(data.site)).toBe(1);
        const now = await locationsOf(data.site);
        if (now !== data.siteLocations) throw new Error(`Site upload with an existing site name (other case) added a location to that site (${data.siteLocations} → ${now}) instead of rejecting the row (R46)`);
      });
    });
    await sc('UPL-SITE-09', 'Site Details › Upload', 'Duplicate location in one site', async s => {
      await s.step(`"Upload": "Site S9 ${RUN}" with location "Loc D ${RUN}" listed twice, confirm, reload → result recorded`, () => siteUpload(s, 'UPL-SITE-09', [siteRowData(`Site S9 ${RUN}`, `Loc D ${RUN}`), siteRowData(`Site S9 ${RUN}`, `Loc D ${RUN}`)]));
      await s.step(`Sites table → "Site S9 ${RUN}" has exactly 1 location (or is not created: recorded)`, async () => {
        const count = await siteListed(`Site S9 ${RUN}`);
        s.observe(count ? `site created with ${await locationsOf(`Site S9 ${RUN}`)} location(s)` : 'site not created');
        if (count) expect(await locationsOf(`Site S9 ${RUN}`)).toBe(1);
      });
    });
    await sc('UPL-SITE-10', 'Site Details › Upload', 'Same location name, different sites', async s => {
      await s.step(`"Upload": location "Loc X ${RUN}" under two new sites "Site T1 ${RUN}" and "Site T2 ${RUN}", confirm, reload → result recorded`, () => siteUpload(s, 'UPL-SITE-10', [siteRowData(`Site T1 ${RUN}`, `Loc X ${RUN}`), siteRowData(`Site T2 ${RUN}`, `Loc X ${RUN}`)]));
      await s.step(`Sites table → both "Site T1 ${RUN}" and "Site T2 ${RUN}" are listed once`, async () => {
        await expect.poll(() => siteListed(`Site T1 ${RUN}`), { timeout: 30000 }).toBe(1);
        expect(await siteListed(`Site T2 ${RUN}`)).toBe(1);
      });
    });
    await sc('UPL-SITE-11', 'Site Details › Upload', 'Wrong file type accepted by picker', async s => {
      const before = await pageCount();
      for (const [label, file] of [['.pdf', writeText(path.join(files, `upl-site-11-${RUN}.pdf`), '%PDF-1.4\n%%EOF\n')], ['.csv', writeText(path.join(files, `upl-site-11-${RUN}.csv`), `site_name,site_type,location_name,location_type\nSite Q ${RUN},Site,Loc Q ${RUN},Construction Area\n`)]]) {
        await s.step(`"Upload": choose a ${label} file instead of the template, then confirm → messages recorded, reload`, async () => {
          const first = await uploadFrom('Upload', file);
          s.observe(`message: ${first || '(none)'}; after confirming: ${await confirmUpload() || '(none)'}`);
          await reload();
        });
      }
      await s.step(`Sites table → site count unchanged and "Site Q ${RUN}" not created`, async () => { expect(await pageCount()).toBe(before); await sitesNotCreated(`Site Q ${RUN}`); });
    });
    await sc('UPL-SITE-12', 'Site Details › Upload', 'Header-only file', async s => {
      const before = await pageCount();
      await s.step(`"Upload": template with one empty data row, confirm, reload → result recorded`, () => siteUpload(s, 'UPL-SITE-12', [{}]));
      await s.step(`Sites count → unchanged, nothing created`, async () => expect(await pageCount()).toBe(before));
    });

    // ================= Bulk Upload Status (uploads made above) =================
    const uploads = () => main.locator('tbody tr').evaluateAll(rows => rows.map(r => [...r.cells].map(c => c.innerText.trim())).filter(c => c.length >= 7));
    const uploadRow = async id => (await uploads()).find(r => r[4] === (data.uploads || {})[id]);
    const today = ddmmyyyy(new Date());
    await sc('PM-REG-BUS-08', 'Bulk Upload Status', 'Every upload screen is tracked', async s => {
      await s.step(`Sidebar › Project Management › "Bulk Upload Status" → page opens`, () => navigator.open('Bulk Upload Status'), { critical: true });
      for (const [id, type] of [['UPL-MM-03', 'Materials'], ['UPL-SITE-02', 'Sites']]) {
        await s.step(`Uploads table → ${id} row: dated today, uploader = signed-in account, type "${type}", Status "Success" and a success report link`, async () => {
          await expect.poll(async () => Boolean(await uploadRow(id)), { timeout: 30000 }).toBe(true);
          const row = await uploadRow(id);
          s.observe(row.join(' | '));
          expect(row[0]).toBe(today);
          expect(row[1]).toBe(config.username);
          expect(row[2]).toBe(type);
          if (type === 'Sites' && row[3] === '-' && row[5] !== '-') throw new Error(`Site upload status not recorded: ${row[4]} has a success report but no status`);
          expect(row[3]).toBe('Success');
          expect(row[5], 'Success report').not.toBe('-');
        });
      }
    });
    await sc('PM-REG-BUS-09', 'Bulk Upload Status', 'Failed upload is tracked', async s => {
      await s.step(`Uploads table → UPL-MM-04 row: Status "Failed", a failure report, no success report`, async () => {
        const row = await uploadRow('UPL-MM-04');
        expect(row, 'UPL-MM-04 tracked').toBeTruthy();
        s.observe(row.join(' | '));
        if (row[3] === '-' && row[5] === '-' && row[6] !== '-') throw new Error(`Application defect: 1 upload record(s) have no status (failure file only: ${row[0]} ${row[4]})`);
        expect(row[3]).toBe('Failed');
        expect(row[6], 'Failure report').not.toBe('-');
        expect(row[5]).toBe('-');
      });
    });
    await sc('PM-REG-BUS-11', 'Bulk Upload Status', 'Uploader is captured', async s => {
      await s.step(`"Search by uploader…": enter the account e-mail → every row shows that uploader and the UPL-MM-03 upload is listed; clear the box`, async () => {
        await main.getByPlaceholder('Search by uploader…').fill(config.username);
        await expect.poll(async () => (await uploads()).every(row => row[1] === config.username), { timeout: 15000 }).toBe(true);
        expect(Boolean(await uploadRow('UPL-MM-03')), 'Run upload listed').toBe(true);
        await main.getByPlaceholder('Search by uploader…').fill('');
      });
    });
    await sc('PM-REG-BUS-12', 'Bulk Upload Status', 'Partial-success upload', async s => {
      await s.step(`Uploads table → UPL-MM-05 row: status "-" or "Partly successful", success report and failure report both present`, async () => {
        const row = await uploadRow('UPL-MM-05');
        expect(row, 'UPL-MM-05 tracked').toBeTruthy();
        s.observe(row.join(' | '));
        // R17 said "no status"; the 31 Oct build shows "Partly successful" – both mean a partial success.
        expect(['-', 'Partly successful'], 'Partial-success status').toContain(row[3]);
        expect(row[5], 'Success report').not.toBe('-');
        expect(row[6], 'Failure report').not.toBe('-');
      });
    });
    for (const [id, source] of [['UPL-MM-15', 'UPL-MM-05'], ['UPL-SITE-13', 'UPL-SITE-04']]) {
      await sc(id, source.startsWith('UPL-MM') ? 'Material Master › Upload' : 'Site Details › Upload', 'Reports can be downloaded', async s => {
        for (const [label, column] of [['success', 5], ['failure', 6]]) {
          await s.step(`Uploads table → ${source} row: click the ${label} report link → a workbook file downloads`, async () => {
            const rows = await uploads();
            const index = rows.findIndex(r => r[4] === (data.uploads || {})[source]);
            expect(index, `${source} tracked`).toBeGreaterThanOrEqual(0);
            expect(rows[index][column], `${label} report link`).not.toBe('-');
            const cell = main.locator('tbody tr').nth(index).locator('td').nth(column);
            const file = await download(cell.locator('a, button, span').filter({ hasText: rows[index][column] }).first(), `${label} report`);
            expect(Object.keys(readWorkbook(file.path)).length, `${label} report is a workbook`).toBeGreaterThan(0);
          });
        }
      }, 'Bulk Upload Status');
    }

    // ================= System Messages =================
    const title = () => main.locator('input[maxlength="120"]').first();
    const body = () => main.locator('textarea').first();
    // Title / Body is the third column; match the title at its start ("Active RUN" must not match "Inactive RUN").
    const messageRow = text => main.locator('tbody tr').filter({ has: page.locator('td:nth-child(3)', { hasText: new RegExp(`^\\s*${esc(text)}`) }) }).first();
    const banner = text => page.getByRole('status').filter({ hasText: /^Project notice/i }).filter({ hasText: text });
    const newMessage = async ({ heading, text, severity = 'Info', starts, ends, active = true }) => {
      await click(button('New message'), 'New message');
      await visible(button('Create'), 'Create');
      // Scope must be chosen: since 10 Nov 2026 the first (default) option is "Platform (all projects)", which
      // broadcasts the test message to every project and shows a "Platform-wide" banner instead of "Project notice".
      await main.locator('select').nth(0).selectOption({ label: 'Project (this project only)' });
      await main.locator('select').nth(1).selectOption({ label: severity });
      if (heading) await title().fill(heading);
      if (text) await body().fill(text);
      const dates = main.locator('input[type="datetime-local"]');
      if (starts) await dates.nth(0).fill(localInput(starts));
      if (ends) await dates.nth(1).fill(localInput(ends));
      const box = main.getByLabel('Active', { exact: true });
      if ((await box.isChecked().catch(() => true)) !== active) await box.click();
      const create = button('Create');
      if (await create.isDisabled()) return { created: false, disabled: true, message: '' };
      await create.click(); await page.waitForTimeout(1500);
      const message = await feedback();
      const created = !(await create.isVisible().catch(() => false));
      if (!created) await click(button('Cancel'), 'Cancel');
      return { created, message };
    };
    // Deactivates a run message through Edit (untick Active → Save), so no test banner stays on the project.
    const deactivate = async heading => {
      if (!(await messageRow(heading).count())) return;
      await click(messageRow(heading).getByRole('button', { name: 'Edit', exact: true }), 'Edit');
      const active = main.getByLabel('Active', { exact: true });
      if (await active.isChecked()) await active.click();
      await click(button('Save'), 'Save');
      await expect(button('Save'), 'Edit form closed').toBeHidden({ timeout: 15000 });
      await page.waitForTimeout(800);
    };
    // Messages from earlier automation runs cannot be deleted (SCP-DEF-032); make sure none of them is still active.
    await sc('PM-REG-SYS-00', 'System Messages', 'No active banner left by earlier automation runs', async s => {
      await s.step(`System Messages: for every active message titled "PMR2-…" click "Edit", untick "Active", "Save"; reload → no "PMR2-" banner shown`, async () => {
        const rows = await main.locator('tbody tr').filter({ hasText: /PMR2-/ }).evaluateAll(list => list
          .map(r => ({ title: (r.cells[2]?.innerText || '').split('\n')[0].trim(), status: r.cells[4]?.innerText.trim() }))
          .filter(r => r.title && r.status === 'Active'));
        for (const row of rows) await deactivate(row.title);
        s.observe(`deactivated ${rows.length} message(s)${rows.length ? `: ${rows.map(r => r.title).join(', ')}` : ''}`);
        await reload();
        await expect(page.getByRole('status').filter({ hasText: /PMR2-/ })).toHaveCount(0);
      });
    });
    await sc('PM-REG-SYS-03', 'System Messages', 'Body required', async s => {
      await s.step(`Sidebar › Project Management › "System Messages" → page opens`, () => navigator.open('System Messages'), { critical: true });
      await s.step(`"New message": title "Empty ${RUN}", no body → "Create" stays disabled; click "Cancel"`, async () => {
        const outcome = await newMessage({ heading: `Empty ${RUN}` });
        expect(outcome.disabled, 'Create disabled').toBe(true);
        await click(button('Cancel'), 'Cancel');
      });
    });
    await sc('PM-REG-SYS-05', 'System Messages', 'Ends before Starts', async s => {
      await s.step(`"New message": title "Order ${RUN}", a body, Ends earlier than Starts, click "Create" → message not created and an error/warning is shown (R27)`, async () => {
        const outcome = await newMessage({ heading: `Order ${RUN}`, text: `Ends before starts ${RUN}`, starts: shift(2), ends: shift(1) });
        s.observe(`${outcome.created ? 'created' : 'not created'}; message: ${outcome.message || '(none)'}`);
        await expect(messageRow(`Order ${RUN}`), 'Message not created').toHaveCount(0);
        // Confirmed rule R27 / REQ-PM-091 (product owner, 30 Oct 2026): the user must see an error or warning.
        // Until 21 Nov this step passed without checking it; today no message is shown (SCP-DEF-059).
        expect(outcome.message, 'Ends before Starts: no error or warning shown (R27)').toBeTruthy();
      });
    });
    await sc('PM-REG-SYS-07', 'System Messages', 'Create scheduled message', async s => {
      await s.step(`"New message": title "Sched ${RUN}", Info, Starts in 7 days, Ends in 8 days, "Create" → message created and its row shows "Scheduled"`, async () => {
        const outcome = await newMessage({ heading: `Sched ${RUN}`, text: `Scheduled message ${RUN}`, starts: shift(7), ends: shift(8) });
        expect(outcome.created, `Created (${outcome.message || 'no message'})`).toBe(true);
        await expect(messageRow(`Sched ${RUN}`)).toContainText('Scheduled', { timeout: 15000 });
      });
    });
    await sc('PM-REG-SYS-08', 'System Messages', 'Active message shows banner', async s => {
      await s.step(`"New message": title "Active ${RUN}", Info, window from 1 hour ago to tomorrow, "Create" → message created`, async () => {
        const outcome = await newMessage({ heading: `Active ${RUN}`, text: `Active message ${RUN}`, starts: shift(0, -1), ends: shift(1) });
        expect(outcome.created, `Created (${outcome.message || 'no message'})`).toBe(true);
      });
      await s.step(`Reload → "Project notice" banner shows the title "Active ${RUN}" and its body`, async () => {
        await reload();
        await visible(banner(`Active ${RUN}`), 'Project notice banner');
        await expect(banner(`Active ${RUN}`)).toContainText(`Active message ${RUN}`);
      });
    });
    await sc('PM-REG-SYS-12', 'System Messages', 'Warning vs Info styling', async s => {
      await s.step(`"New message": title "Warn ${RUN}", severity "Warning", window covering now, "Create" → message created; reload`, async () => {
        const outcome = await newMessage({ heading: `Warn ${RUN}`, text: `Warning message ${RUN}`, severity: 'Warning', starts: shift(0, -1), ends: shift(1) });
        expect(outcome.created, `Created (${outcome.message || 'no message'})`).toBe(true);
        await reload();
      });
      await s.step(`Compare the banners → the Warning banner background differs from the Info banner background`, async () => {
        const colour = locator => locator.first().evaluate(node => getComputedStyle(node).backgroundColor);
        await visible(banner(`Warn ${RUN}`), 'Warning banner');
        const info = await colour(banner(`Active ${RUN}`));
        const warning = await colour(banner(`Warn ${RUN}`));
        s.observe(`Info ${info}, Warning ${warning}`);
        expect(warning).not.toBe(info);
      });
    });
    // Also run in part 1 when a notice happens to be active; here the run's own banners guarantee one (22 Nov 2026).
    await sc('PM-REG-SYS-11', 'System Messages', 'Banner dismiss', async s => {
      await s.step(`"Project notice" banner "Active ${RUN}": click "Dismiss ×" → that banner disappears`, async () => {
        await visible(banner(`Active ${RUN}`), 'Project notice banner');
        await click(banner(`Active ${RUN}`).getByRole('button', { name: 'Dismiss' }), 'Dismiss ×');
        await expect(banner(`Active ${RUN}`)).toHaveCount(0, { timeout: 10000 });
      });
      await s.step('Reload → whether the dismissed banner stays hidden is recorded (persistence not specified)', async () => {
        await reload();
        const back = await banner(`Active ${RUN}`).first().isVisible().catch(() => false);
        s.observe(back ? 'Banner shown again after reload (dismiss is not kept)' : 'Banner stays hidden after reload (dismiss is kept)');
      });
    });
    await sc('PM-REG-SYS-09', 'System Messages', 'Inactive / expired not shown', async s => {
      await s.step(`"New message": "Inactive ${RUN}" with "Active" unticked, then "Past ${RUN}" with a window in the past; reload → outcomes recorded`, async () => {
        const inactive = await newMessage({ heading: `Inactive ${RUN}`, text: `Inactive message ${RUN}`, starts: shift(0, -1), ends: shift(1), active: false });
        const past = await newMessage({ heading: `Past ${RUN}`, text: `Past message ${RUN}`, starts: shift(-3), ends: shift(-1) });
        s.observe(`inactive ${inactive.created ? 'created' : `not created (${inactive.message})`}; past window ${past.created ? 'created' : `not created (${past.message})`}`);
        await reload();
      });
      await s.step(`Page banners → no "Project notice" banner for "Inactive ${RUN}" or "Past ${RUN}"`, async () => {
        await expect(banner(`Inactive ${RUN}`)).toHaveCount(0);
        await expect(banner(`Past ${RUN}`)).toHaveCount(0);
      });
    });
    await sc('PM-REG-SYS-10', 'System Messages', 'Delete message', async s => {
      const headings = ['Active', 'Warn', 'Sched', 'Inactive', 'Past'].map(name => `${name} ${RUN}`);
      const failed = [];
      for (const heading of headings) {
        await s.step(`Message "${heading}": click "Delete" (dialogs accepted), reload → result recorded (skipped if not listed)`, async () => {
          if (!(await messageRow(heading).count())) { s.observe('not listed – nothing to delete'); return; }
          await withDialog(async () => { await click(messageRow(heading).getByRole('button', { name: 'Delete', exact: true }), 'Delete'); await page.waitForTimeout(2500); });
          await reload();
          if (await messageRow(heading).count()) failed.push(heading);
        });
      }
      await s.step(`Deactivate any message that failed to delete (Edit, untick "Active", Save), reload → no banner from this run left; fails if a delete failed (SCP-DEF-032)`, async () => {
        // Delete currently fails on the server (SCP-DEF-032): deactivate whatever is left so the project shows no test banner.
        for (const heading of failed) await deactivate(heading);
        await reload();
        await expect(banner(RUN), 'No banner from this run').toHaveCount(0);
        if (failed.length) throw new Error(`System message delete failed (HTTP 500): ${failed.length} message(s) still listed – ${failed.join(', ')} (deactivated instead)`);
      });
    });

    // ================= Watched Materials =================
    const userSelect = () => main.locator('select').first();
    const watchRows = () => main.locator('tbody tr').evaluateAll(rows => rows.map(r => [...r.cells].map(c => c.innerText.trim())));
    const watchRow = value => main.locator('tbody tr').filter({ has: page.locator('td:nth-child(2)', { hasText: exactI(value) }) }).first();
    // The signed-in user is chosen by its full profile name (first + last, e.g. "Hariharan R Raja"); a shorter shared name
    // such as "Hariharan Raja" belongs to another user.
    const selectSelf = async () => {
      const name = await page.evaluate(() => {
        const info = JSON.parse(localStorage.getItem('userInfo') || '{}');
        const full = info.fullName || info.name || [info.first_name || info.firstName, info.last_name || info.lastName].filter(Boolean).join(' ');
        return String(full || '').trim();
      });
      await expect.poll(async () => (await selectOptions(userSelect())).map(clean), { timeout: 20000, message: `Signed-in user "${name}" in the list` }).toContain(name);
      await userSelect().selectOption({ label: name }); await navigator.ready(); await page.waitForTimeout(800);
    };
    const addWatch = async (type, value) => {
      await main.locator('select').nth(1).selectOption({ label: type });
      await page.waitForTimeout(500);
      const values = main.locator('select').nth(2);
      // The value list loads after the type is chosen.
      if (typeof value !== 'number') await expect.poll(async () => (await selectOptions(values)).map(norm), { timeout: 20000, message: `${type} "${value}" offered` }).toContain(norm(value));
      const chosen = typeof value === 'number' ? (await selectOptions(values)).filter(v => !/^Select/.test(v))[value] : (await selectOptions(values)).find(v => norm(v) === norm(value));
      expect(chosen, `${type} "${value}" offered`).toBeTruthy();
      await values.selectOption({ label: chosen });
      await click(button('Add watch'), 'Add watch'); await page.waitForTimeout(1500);
      return { chosen, message: await feedback() };
    };
    await sc('PM-REG-WM-04', 'Watched Materials', 'Add category watch', async s => {
      await s.step(`Sidebar › Project Management › "Watched Materials" → page opens; select the signed-in user in the first dropdown → that user's watches show`, async () => { await navigator.open('Watched Materials'); await selectSelf(); }, { critical: true });
      await s.step(`Second dropdown "Category", third dropdown "${data.catName}", click "Add watch" → row of type "Category" appears (skipped if already present)`, async () => {
        if (await watchRow(data.catName).count()) { s.observe('watch already present (added by an earlier attempt)'); return; }
        await main.locator('select').nth(1).selectOption({ label: 'Category' });
        await expect.poll(async () => (await selectOptions(main.locator('select').nth(2))).map(norm), { timeout: 20000, message: `${data.catName} offered` }).toContain(norm(data.catName));
        data.categoryWatchOptions = (await selectOptions(main.locator('select').nth(2))).filter(v => !/^Select/.test(v));
        const outcome = await addWatch('Category', data.catName);
        s.observe(`message: ${outcome.message || '(none)'}`);
        await expect(watchRow(data.catName)).toBeVisible({ timeout: 15000 });
        await expect(watchRow(data.catName).locator('td').first()).toHaveText(/^\s*category\s*$/i); // stored lower case, shown capitalised
      });
    });
    await sc('PM-REG-REF-17', 'Watched Materials', 'New category flows downstream', async s => {
      for (const [label, list] of [['Add Material → Category', () => data.addMaterialCategories], ['New Question Set → categories', () => data.qsetCategories], ['Watched Materials → Category', () => data.categoryWatchOptions]]) {
        await s.step(`${label} → category list includes "${data.catName}"`, async () => {
          const values = list() || [];
          expect(values.some(value => norm(value).includes(norm(data.catName))), `${data.catName} offered`).toBe(true);
        });
      }
    });
    await sc('PM-REG-WM-06', 'Watched Materials', 'Duplicate watch', async s => {
      await s.step(`"Add watch": Category "${data.catName}" again (if still offered) → outcome recorded, only one row for it`, async () => {
        const offered = (await selectOptions(main.locator('select').nth(2))).some(v => norm(v) === norm(data.catName));
        if (offered) { const outcome = await addWatch('Category', data.catName); s.observe(`message: ${outcome.message || '(none)'}`); } else s.observe('the category is no longer offered once watched');
        expect((await watchRows()).filter(row => norm(row[1]) === norm(data.catName)), 'Not duplicated').toHaveLength(1);
      });
    });
    await sc('PM-REG-WM-07', 'Watched Materials', 'Notifications toggle', async s => {
      const toggle = () => watchRow(data.catName).getByRole('button', { name: /^(On|Off|Muted)$/ });
      try {
        await s.step(`Notification button on the "${data.catName}" row: click it from "On" to Muted/Off, reload, reselect the user → shows "Off" or "Muted"`, async () => {
          if ((await toggle().innerText()).trim() !== 'On') { await toggle().click(); await page.waitForTimeout(1200); await reload(); await selectSelf(); }
          await click(toggle(), 'Notifications'); await page.waitForTimeout(1200);
          await reload(); await selectSelf();
          await expect(toggle()).toHaveText(/^(Off|Muted)$/);
        });
      } finally {
        await s.step(`Click the notification button until it shows "On", reload → shows "On"`, async () => {
          if ((await toggle().innerText()).trim() !== 'On') { await toggle().click(); await page.waitForTimeout(1200); await reload(); await selectSelf(); }
          await expect(toggle()).toHaveText('On');
        });
      }
    });
    await sc('PM-REG-WM-09', 'Watched Materials', 'Trade watch', async s => {
      await s.step(`Second dropdown "Trade": first trade, click "Add watch" → row of type "Trade" appears (skipped when no trades exist)`, async () => {
        await main.locator('select').nth(1).selectOption({ label: 'Trade' }); await page.waitForTimeout(500);
        const trades = (await selectOptions(main.locator('select').nth(2))).filter(v => !/^Select/.test(v));
        if (!trades.length) { s.observe('no trades are configured on NRVC_Hall – nothing to watch'); return; }
        const outcome = await addWatch('Trade', 0);
        data.tradeWatch = outcome.chosen;
        await expect(watchRow(outcome.chosen).locator('td').first()).toHaveText(/^\s*trade\s*$/i, { timeout: 15000 });
      });
    });
    await sc('PM-REG-WM-10', 'Watched Materials', 'One user can watch every category', async s => {
      await s.step(`Dropdown "Category": add a watch for every category not yet watched → number added recorded`, async () => {
        await main.locator('select').nth(1).selectOption({ label: 'Category' }); await page.waitForTimeout(500);
        const watched = new Set((await watchRows()).filter(row => row[0] === 'Category').map(row => norm(row[1])));
        const pending = (await selectOptions(main.locator('select').nth(2))).filter(v => !/^Select/.test(v) && !watched.has(norm(v)));
        for (const value of pending) await addWatch('Category', value);
        s.observe(`added ${pending.length} category watch(es)`);
      });
      await s.step(`Watch rows of type "Category" → each category listed once and every run category watched`, async () => {
        const rows = (await watchRows()).filter(row => row[0] === 'Category').map(row => norm(row[1]));
        expect(rows.length, 'No category listed twice').toBe(new Set(rows).size);
        for (const value of data.categoryWatchOptions) expect(rows, `${value} watched`).toContain(norm(value));
      });
    });
    const dashboardWatches = async () => {
      await click(navigator.nav.getByRole('button', { name: /^Management Dashboard/ }).first(), 'Management Dashboard');
      await navigator.ready(); navigator.navigations += 1;
      const section = main.getByText(/Your watched materials/i).first();
      await visible(section, 'Your watched materials');
      return clean(await section.locator('xpath=ancestor::div[2]').innerText());
    };
    await sc('PM-REG-WM-05', 'Watched Materials', 'Watch appears on Dashboard', async s => {
      await s.step(`Sidebar › "Management Dashboard" → "Your watched materials" lists "${data.catName}"`, async () => {
        const text = await dashboardWatches();
        expect(text.toLowerCase()).toContain(data.catName.toLowerCase());
      });
    });
    await sc('PM-REG-WM-08', 'Watched Materials', 'Remove watch', async s => {
      await s.step(`Watched Materials, signed-in user: click "Remove" on the "${data.catName}" row, confirm → row removed`, async () => {
        await navigator.open('Watched Materials'); await selectSelf();
        await withDialog(async () => { await click(watchRow(data.catName).getByRole('button', { name: 'Remove', exact: true }), 'Remove'); await confirmDelete(); });
        await expect(watchRow(data.catName)).toHaveCount(0, { timeout: 15000 });
      });
      await s.step(`Sidebar › "Management Dashboard" → "Your watched materials" no longer lists "${data.catName}"`, async () => {
        const text = await dashboardWatches();
        expect(text.toLowerCase()).not.toContain(data.catName.toLowerCase());
      });
      // Test categories (from this and earlier runs) must not crowd the account's "Your watched materials".
      await s.step(`Watched Materials: click "Remove" and confirm for every row containing "PMR2-" → none left`, async () => {
        await navigator.open('Watched Materials'); await selectSelf();
        let removed = 0;
        for (let guard = 0; guard < 60; guard += 1) {
          const row = main.locator('tbody tr').filter({ has: page.locator('td:nth-child(2)', { hasText: /PMR2-/ }) }).first();
          if (!(await row.count())) break;
          await withDialog(async () => { await row.getByRole('button', { name: 'Remove', exact: true }).click(); await confirmDelete(); });
          await page.waitForTimeout(800); removed += 1;
        }
        s.observe(`removed ${removed} test-category watch(es)`);
        await expect(main.locator('tbody tr').filter({ has: page.locator('td:nth-child(2)', { hasText: /PMR2-/ }) })).toHaveCount(0);
      });
    });

    // ================= Other project (SCP_Testing_Ram) =================
    const OTHER = `Other project › ${SECOND_PROJECT}`;
    await sc('PM-REG-REF-24', OTHER, 'Common UoM belongs to the project', async s => {
      await s.step(`Project selector: switch to ${SECOND_PROJECT} → project loads`, () => navigator.switchProject(SECOND_PROJECT), { critical: true });
      await s.step(`Sidebar › Project Management › Reference Data › "Common UoM" → page opens`, () => navigator.open('Common UoM'), { critical: true });
      await s.step(`Search "${data.uomName}" → not listed on this project (UoM belongs to the project, R64)`, async () => {
        const found = (await refMatches('uom', data.uomName)).length;
        if (found) throw new Error(`Common UoM is shared across projects: "${data.uomName}" created on ${config.projectName} is listed ${found} time(s) on ${SECOND_PROJECT} (R64)`);
      });
    });
    await sc('PM-REG-REF-25', OTHER, 'Material Category belongs to the project', async s => {
      await s.step(`Sidebar › Project Management › Reference Data › "Material Category" → page opens`, () => navigator.open('Material Category'), { critical: true });
      await s.step(`Search "${data.catName}" → not listed on this project`, async () => expect(await refMatches('cat', data.catName)).toHaveLength(0));
      await s.step(`"Material Master" › "Add Material" › "Choose Category" → "${data.catName}" is not offered`, async () => {
        await navigator.open('Material Master');
        await openForm('Add Material', 'Add Material');
        // A project without categories offers none (the list stays empty).
        const categories = await dropdownOptions(modal().getByRole('button', { name: 'Choose Category' })).catch(() => []);
        await closeForm();
        expect(categories.map(norm)).not.toContain(norm(data.catName));
      });
    });
    await sc('PM-REG-FDI-47', OTHER, 'New question hidden from other organizations', async s => {
      await s.step(`Sidebar › Project Management › "First Delivery Inspection Config" → page opens`, () => navigator.open('First Delivery Inspection Config'), { critical: true });
      await s.step(`Questions list → "FDI Q2 ${RUN}" is not present`, async () => {
        await expect(main.getByText(`FDI Q2 ${RUN}`)).toHaveCount(0);
      });
      await s.step(`"Add Question" › "Add from Organization Bank": search the run token → no result; close the form`, async () => {
        await openForm('Add Question', 'Add Question');
        await click(modal().getByRole('button', { name: 'Add from Organization Bank', exact: true }), 'Add from Organization Bank');
        await modal().getByPlaceholder("Search the organization's questions…").fill(RUN);
        await page.waitForTimeout(1500);
        await expect(modal().getByText(new RegExp(esc(RUN)))).toHaveCount(0);
        await closeForm();
        s.observe('LLE - Test not checked in this run (one more project switch)');
      });
    });
    // FDI-06 / CFG-18 / PSC-05: change SCP_Testing_Ram, check NRVC_Hall is unchanged, then restore SCP_Testing_Ram.
    await sc('PM-REG-FDI-06', OTHER, 'Settings are per project', async s => {
      await s.step(`FDI Settings on ${SECOND_PROJECT}: flip "${SETTINGS[0]}", click "Save", reload → flipped value kept`, async () => {
        data.ramFdi = await fdiSettings();
        await setSetting(SETTINGS[0], !data.ramFdi[0].checked);
        await saveFdi(); await reload();
        expect((await fdiSettings())[0].checked).toBe(!data.ramFdi[0].checked);
        data.ramFdiChanged = true;
      }, { critical: true });
    });
    const RAM_UNCONFIGURED = `Not run: ${SECOND_PROJECT}'s Configuration Options cannot be saved while its week fields are empty ("… is required"), and filling them would permanently configure that project (CFG-17 and the Setup Wizard checks need it unconfigured) – needs go-ahead`;
    skip('PM-REG-CFG-18', OTHER, 'Currency is set per project', RAM_UNCONFIGURED);
    await sc('PM-REG-FDI-06b', 'First Delivery Inspection Config', `NRVC_Hall unchanged while ${SECOND_PROJECT} differs`, async s => {
      await s.step(`Project selector: switch back to ${config.projectName} → project loads`, () => navigator.switchProject(config.projectName), { critical: true });
      await s.step(`Sidebar › "Configuration Options" → "Currency Type" still shows the original currency`, async () => {
        await navigator.open('Configuration Options');
        await expect(currencyButton()).toHaveText(exactI(data.currencyOriginal));
      });
      await s.step(`Sidebar › "First Delivery Inspection Config" → FDI Settings equal their original values`, async () => {
        await navigator.open('First Delivery Inspection Config');
        expect((await fdiSettings()).map(item => item.checked)).toEqual(data.fdiInitial.map(item => item.checked));
      });
    }, null); // switches project first: no automatic page open
    skip('PM-REG-PSC-05', OTHER, 'Menu item follows the Pre-Shipping toggle', RAM_UNCONFIGURED);
    await sc('PM-REG-FDI-06c', OTHER, `Restore ${SECOND_PROJECT}`, async s => {
      await s.step(`Project selector: switch to ${SECOND_PROJECT} → project loads`, () => navigator.switchProject(SECOND_PROJECT), { critical: true });
      await s.step(`FDI Settings on ${SECOND_PROJECT}: set "${SETTINGS[0]}" back to its original value, "Save", reload → restored (nothing to do if unchanged)`, async () => {
        if (!data.ramFdiChanged) { s.observe('nothing to restore'); return; }
        await navigator.open('First Delivery Inspection Config');
        await setSetting(SETTINGS[0], data.ramFdi[0].checked); await saveFdi(); await reload();
        expect((await fdiSettings())[0].checked).toBe(data.ramFdi[0].checked);
      });
      await s.step(`Project selector: switch back to ${config.projectName} → project loads`, () => navigator.switchProject(config.projectName));
    }, null);

    console.log(`\nRun token for this run's records: ${RUN}`);
  } });

  const s = result.summary;
  expect(s.failed + s.blocked, `PM Regression part 2: ${s.failed} failed and ${s.blocked} blocked – see the report`).toBe(0);
});
