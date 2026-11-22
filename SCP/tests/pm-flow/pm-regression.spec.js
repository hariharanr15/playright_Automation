// Project Management – Regression (docs/functional-discovery/PM_REGRESSION_SCENARIOS.md).
// Part 1: read-only and form-only scenarios (Impact R / C). Forms are closed with their own Cancel / X and
// nothing is saved. Scenarios that need data created by part 2 are recorded as Skipped with the reason.
// One sign-in and one tab; pages follow the left-menu order; the SCP_Testing_Ram checks run last after a
// single project switch, and the run switches back to NRVC_Hall at the end.
const fs = require('fs');
const { test, expect } = require('@playwright/test');
// FDI New Question Set category search: "Search categories" before 10 Nov 2026, now "Search or add a category".
const CATEGORY_SEARCH = /^Search (or add a )?categor/;
const { runPmSuite } = require('./support/pm-flow');
const { signIn } = require('./support/pm-session');
const { pmUi } = require('./support/pm-ui');
const { focus } = require('./support/pm-visuals');
const { PM, MENU } = require('./support/pm-navigator');
const { readWorkbook } = require('../../utils/bulk-upload/inventory-workbook');

const MODULE = 'Project Management';
const SECOND_PROJECT = process.env.PM_FLOW_SECOND_PROJECT || 'SCP_Testing_Ram';
const XER_FILE = process.env.PM_XER_FILE || 'C:/Users/VC/Downloads/SPADE-OYM-1A-2A-BL-1-09-25-2026-1.xer';
const PART2 = 'Runs with Regression part 2 (needs data created in the run)';
const meta = (id, submodule, title) => ({ id, module: MODULE, submodule, title, suite: 'Regression', navPath: [PM, ...submodule.split(' › ')] });
const pad = value => String(value).padStart(2, '0');
const ddmmyyyy = date => `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
const daysAgo = days => { const d = new Date(); d.setDate(d.getDate() - days); return d; };
const sameMembers = (actual, expected, label) => expect([...actual].sort(), label).toEqual([...expected].sort());

test.setTimeout(2 * 60 * 60 * 1000);

test('Project Management – Regression (part 1: read-only and form-only)', async ({ page }) => {
  const result = await runPmSuite({ page, suite: 'Regression', scenarios: async ({ run, navigator, config, outDir }) => {
    const ui = pmUi(page, navigator, outDir);
    const { main, modal, visible, headers, rowTexts, countText, button, click, openForm, inModal, dropdownOptions, selectOptions, download, clean, pickDate } = ui;
    const EMPTY = /No data (found|available)/;
    const data = run.data;
    const sc = (id, submodule, title, body) => run.scenario(meta(id, submodule, title), body);
    const skip = (id, submodule, title, reason) => run.skip(meta(id, submodule, title), reason);
    const PRE_SHIPPING_OFF = 'Environment precondition not met: the project\'s Pre-Shipping option is switched off (Project Management › Configuration Options), so the "PreShipping Checklist" menu entry is hidden. Switch it on and re-run this case.';

    if (!(await signIn({ run, page, config, ui, id: 'PM-REG-000', suite: 'Regression' }))) return;

    // ================= Navigation =================
    await sc('PM-REG-NAV-02', 'Navigation', 'Group buttons expand without navigating', async s => {
      const start = page.url();
      for (const [group, child] of [[PM, 'Configuration Options'], ['Integrations', 'XER Import'], ['Reference Data', 'Common UoM']]) {
        await s.step(`Left menu: click "${group}" → group expands showing "${child}" and the page URL does not change`, async () => {
          const control = navigator.menuItem(group);
          await visible(control, group);
          await control.click();
          if (!(await navigator.menuItem(child).isVisible().catch(() => false))) await control.click(); // it was open: reopen
          await visible(navigator.menuItem(child), `${group} entries`);
          expect(page.url(), 'URL unchanged').toBe(start);
        });
      }
    });
    await sc('PM-REG-NAV-04', 'Navigation', 'Setup Wizard hidden once setup is complete', async s => {
      await s.step(`Left menu › "Project Management": look for "Setup Wizard" → entry is not in the menu`, async () => {
        await expect(navigator.menuItem('Setup Wizard')).toHaveCount(0);
      });
      await s.step(`Browse directly to /setup-wizard (URL) → wizard page opens`, () => navigator.gotoRoute('setup-wizard'), { critical: true });
      await s.step(`Setup Wizard page: read the "Project Setup" step list → nine steps in order (Integration … First Submittal), all ticked "✓", and "Setup complete" is shown`, async () => {
        await visible(main.getByText('Project Setup', { exact: true }), 'Project Setup');
        const text = await main.innerText();
        let at = -1;
        for (const name of ['Integration', 'Directory', 'Project Config', 'Sites', 'Material Category', 'Materials', 'Suppliers', 'Suppliers->Materials', 'First Submittal']) {
          const next = text.indexOf(name, at + 1);
          expect(next, `Step "${name}" in order`).toBeGreaterThan(at);
          at = next;
        }
        expect((text.match(/✓/g) || []).length, 'Completed steps').toBeGreaterThanOrEqual(9);
        await visible(main.getByText('Setup complete', { exact: true }), 'Setup complete');
      });
    });

    // ================= Integrations =================
    await sc('PM-REG-INT-01', 'Integrations › Booking Integration', 'Booking: SCP Project ID pre-filled', async s => {
      await s.step(`Left menu › Project Management › Integrations › "Booking Integration": open the page → page opens`, () => navigator.open('Booking Integration'), { critical: true });
      await s.step(`Booking Integration: read the first input "SCP Project ID" → value matches PRJ followed by letters/digits`, async () => {
        await expect(main.locator('input').first()).toHaveValue(/^PRJ[A-Z0-9]+$/);
      });
    });
    await sc('PM-REG-INT-07', 'Integrations › XER Import', 'XER: existing plan listed', async s => {
      await s.step(`Project Management › Integrations › "XER Import": open the page → page opens`, () => navigator.open('XER Import'), { critical: true });
      await s.step(`XER Import: read the plan buttons → each shows "n/m visible · n mapped" and a dd/mm/yyyy date; plan count and name recorded`, async () => {
        const plans = main.getByRole('button', { name: /\d+\/\d+ visible/ });
        await visible(plans, 'Plan');
        const label = clean(await plans.first().innerText());
        expect(label).toMatch(/\d+\/\d+ visible · \d+ mapped/);
        expect(label).toMatch(/\d{2}\/\d{2}\/\d{4}/);
        data.planCount = await plans.count();
        data.planName = label.split(' ')[0];
      });
    });
    const planHeader = () => main.getByText(/^\d+\/\d+ visible · \d+ mapped$/).first();
    const visibleTaskIds = async () => (await main.locator('tbody tr').evaluateAll(rows => rows.map(r => r.cells[1]?.innerText.trim()))).filter(Boolean);
    if (fs.existsSync(XER_FILE)) {
      await sc('PM-REG-INT-10', 'Integrations › XER Import', 'XER: duplicate file detected by content', async s => {
        await s.step(`XER Import: click "Import" and choose the already imported .xer file in the file dialog → file is submitted`, async () => {
          const chooser = page.waitForEvent('filechooser', { timeout: 15000 });
          await click(button('Import'), 'Import');
          await (await chooser).setFiles(XER_FILE);
        }, { critical: true });
        await s.step(`XER Import: wait for the duplicate check → "Plan already imported" names the existing plan, with "Open existing plan" and "Import anyway" shown ("Import anyway" not clicked)`, async () => {
          await visible(main.getByText('Plan already imported', { exact: true }), 'Plan already imported', 240000);
          await visible(main.getByText(/This file was already imported as "/), 'Existing plan name');
          await visible(button('Open existing plan'), 'Open existing plan');
          await visible(button('Import anyway'), 'Import anyway (not clicked)');
        });
      });
      await sc('PM-REG-INT-11', 'Integrations › XER Import', 'XER: Open existing plan creates no copy', async s => {
        await s.step(`XER Import: click "Open existing plan" → the existing plan opens`, () => click(button('Open existing plan'), 'Open existing plan'), { critical: true });
        await s.step(`XER plan view: "Manage tasks" button is shown → no copy created, number of "n/m visible" plans equals the count noted earlier`, async () => {
          await visible(button('Manage tasks'), 'Plan view');
          await expect(main.getByRole('button', { name: /\d+\/\d+ visible/ })).toHaveCount(data.planCount);
        });
      });
    } else {
      skip('PM-REG-INT-10', 'Integrations › XER Import', 'XER: duplicate file detected by content', `XER test file not found (${XER_FILE}); set PM_XER_FILE`);
      skip('PM-REG-INT-11', 'Integrations › XER Import', 'XER: Open existing plan creates no copy', 'Depends on PM-REG-INT-10');
    }
    const dialog = () => modal();
    const counter = async () => ((await dialog().innerText()).match(/(\d+) of (\d+) selected/) || []);
    const dialogRows = () => dialog().locator('tbody tr');
    const rowByTask = id => dialogRows().filter({ hasText: id }).first();
    await sc('PM-REG-INT-21', 'Integrations › XER Import', 'XER: Manage tasks opens with nothing ticked', async s => {
      await s.step(`XER Import: open the plan (click its "n/m visible" button if the plan view is not open) → plan view with "Manage tasks" shows; visible task IDs and plan header recorded`, async () => {
        if (!(await button('Manage tasks').isVisible().catch(() => false))) await click(main.getByRole('button', { name: /\d+\/\d+ visible/ }), 'Plan');
        await visible(button('Manage tasks'), 'Plan view');
        data.visibleTasks = await visibleTaskIds();
        data.planHeader = clean(await planHeader().innerText());
      }, { critical: true });
      await s.step(`Plan view: click "Manage tasks" → "Select tasks to display" dialog opens and its task total loads (not 0)`, async () => {
        await click(button('Manage tasks'), 'Manage tasks');
        await visible(dialog().getByText('Select tasks to display', { exact: true }), 'Select tasks to display');
        await expect.poll(async () => (await counter())[2] || '0', { timeout: 60000 }).not.toBe('0');
      }, { critical: true });
      await s.step(`Manage tasks dialog: read the "x of y selected" counter → 0 selected although tasks are visible, and the button reads "Save (0 tasks)"`, async () => {
        const [, selected, total] = await counter();
        expect(Number(selected), 'Selected when opened').toBe(0);
        data.totalTasks = Number(total);
        await expect(dialog().getByRole('button', { name: /^Save \(0 tasks\)$/ })).toBeVisible();
      });
    });
    // Run alone (re-runs) the dialog is not open yet: open XER Import › plan › "Manage tasks" here (as PM-REG-INT-21 does).
    const managing = async () => {
      if (!(await dialog().getByText('Select tasks to display', { exact: true }).isVisible().catch(() => false))) {
        if (!(await button('Manage tasks').isVisible().catch(() => false))) {
          await navigator.open('XER Import');
          if (!(await button('Manage tasks').isVisible().catch(() => false))) await click(main.getByRole('button', { name: /\d+\/\d+ visible/ }), 'Plan');
        }
        await click(button('Manage tasks'), 'Manage tasks');
      }
      await expect(dialog().getByText('Select tasks to display', { exact: true }), 'Manage tasks open').toBeVisible({ timeout: 15000 });
    };
    await sc('PM-REG-INT-19', 'Integrations › XER Import', 'XER: Task Selection columns', async s => {
      await s.step(`Manage tasks dialog: read the table headers → WBS, Task ID, Task Name, Type, Planned Start, Planned Finish`, async () => {
        await managing();
        expect(await headers(dialog().locator('table').first())).toEqual(['WBS', 'Task ID', 'Task Name', 'Type', 'Planned Start', 'Planned Finish']);
      });
    });
    const searchBox = () => dialog().getByPlaceholder('Search task name or ID…');
    const wbs = () => dialog().locator('select').nth(0);
    const types = () => dialog().locator('select').nth(1);
    const matching = async () => Number(((await dialog().getByRole('button', { name: /^Select all matching/ }).innerText()).match(/\((\d+)\)/) || [])[1]);
    await sc('PM-REG-INT-25', 'Integrations › XER Import', 'XER: available filters', async s => {
      await s.step(`Manage tasks dialog: check the filters → "Search task name or ID…", WBS dropdown (first "All WBS"), Type dropdown (All types, TT_FinMile, TT_Task, TT_Mile, TT_LOE), no date filter`, async () => {
        await managing();
        await visible(searchBox(), 'Search task name or ID');
        expect((await selectOptions(wbs()))[0]).toBe('All WBS');
        expect(await selectOptions(types())).toEqual(['All types', 'TT_FinMile', 'TT_Task', 'TT_Mile', 'TT_LOE']);
        await expect(dialog().locator('input[type="date"]'), 'No date filter (current behavior)').toHaveCount(0);
      });
    });
    await sc('PM-REG-INT-12', 'Integrations › XER Import', 'XER: Manage tasks filters', async s => {
      await s.step(`Manage tasks dialog: search "CMDA1-MS-110" → every listed row contains that Task ID; then clear the search`, async () => {
        await managing();
        await searchBox().fill('CMDA1-MS-110');
        await expect.poll(() => dialogRows().count(), { timeout: 15000 }).toBeGreaterThan(0);
        for (const text of await rowTexts(dialog())) expect(text).toContain('CMDA1-MS-110');
        await searchBox().fill('');
      });
      await s.step(`Manage tasks dialog: set WBS filter to "CMDA" → fewer rows, "Select all matching" count equals rows listed, selected counter stays 0; reset to "All WBS"`, async () => {
        await focus(wbs()); await wbs().selectOption({ label: 'CMDA' });
        await expect.poll(() => dialogRows().count(), { timeout: 15000 }).toBeLessThan(data.totalTasks);
        expect(await matching(), 'Select all matching reflects the filter').toBe(await dialogRows().count());
        expect(Number((await counter())[1]), 'Counter shows the selection, not the filter').toBe(0);
        await wbs().selectOption({ label: 'All WBS' });
      });
      await s.step(`Manage tasks dialog: set Type filter to "TT_FinMile" → fewer rows, all rows have Type TT_FinMile, "Select all matching" count equals rows; reset to "All types"`, async () => {
        await focus(types()); await types().selectOption({ label: 'TT_FinMile' });
        await expect.poll(() => dialogRows().count(), { timeout: 15000 }).toBeLessThan(data.totalTasks);
        const typeCells = await dialogRows().evaluateAll(rows => rows.map(r => r.cells[4]?.innerText.trim()));
        expect([...new Set(typeCells)]).toEqual(['TT_FinMile']);
        expect(await matching()).toBe(typeCells.length);
        await types().selectOption({ label: 'All types' });
      });
    });
    const tickByRow = async id => {
      await searchBox().fill(id);
      const row = rowByTask(id);
      await expect(row).toBeVisible({ timeout: 15000 });
      await focus(row); await row.locator('td').nth(3).click();
    };
    await sc('PM-REG-INT-14', 'Integrations › XER Import', 'XER: selection persists across search', async s => {
      await s.step(`Manage tasks dialog: search DC1-CS-BUE-1170 and tick it, then search DC1-CS-BUE-1180 and tick it → counter shows "2 of … selected"`, async () => {
        await managing();
        await tickByRow('DC1-CS-BUE-1170');
        await tickByRow('DC1-CS-BUE-1180');
        expect(Number((await counter())[1])).toBe(2);
      });
      await s.step(`Manage tasks dialog: clear the search → both tasks still ticked; click "Deselect all" → counter shows 0 selected`, async () => {
        await searchBox().fill('');
        await expect(rowByTask('DC1-CS-BUE-1170').locator('input[type="checkbox"]')).toBeChecked();
        await expect(rowByTask('DC1-CS-BUE-1180').locator('input[type="checkbox"]')).toBeChecked();
        await click(dialog().getByRole('button', { name: 'Deselect all', exact: true }), 'Deselect all');
        expect(Number((await counter())[1])).toBe(0);
      });
    });
    await sc('PM-REG-INT-16', 'Integrations › XER Import', 'XER: row click selects a task', async s => {
      await s.step(`Manage tasks dialog: search DC1-CS-BUE-1170 and click its row → task is ticked, counter shows 1 selected`, async () => {
        await managing();
        await tickByRow('DC1-CS-BUE-1170');
        expect(Number((await counter())[1])).toBe(1);
      });
      await s.step(`Manage tasks dialog: search DC1-CS-BUE-1180 and click its row checkbox → checkbox becomes ticked`, async () => {
        await searchBox().fill('DC1-CS-BUE-1180');
        const box = rowByTask('DC1-CS-BUE-1180').locator('input[type="checkbox"]');
        await focus(box); await box.click();
        await page.waitForTimeout(1500);
        if (!(await box.isChecked())) throw new Error('XER task checkbox click did not select the task');
      });
      await s.step(`Manage tasks dialog: clear the search and click "Deselect all" → counter shows 0 selected (nothing saved)`, async () => {
        await searchBox().fill('');
        await click(dialog().getByRole('button', { name: 'Deselect all', exact: true }), 'Deselect all');
        expect(Number((await counter())[1])).toBe(0);
      });
    });
    await sc('PM-REG-INT-13', 'Integrations › XER Import', 'XER: Save with 0 selected (not clicked)', async s => {
      await s.step(`Manage tasks dialog: look at the Save button with nothing ticked → it reads "Save (0 tasks)" (not clicked)`, async () => {
        await managing();
        await visible(dialog().getByRole('button', { name: 'Save (0 tasks)', exact: true }), 'Save (0 tasks)');
      });
      await s.step(`Manage tasks dialog: click "Cancel" → dialog closes and the visible task list is unchanged`, async () => {
        await click(dialog().getByRole('button', { name: 'Cancel', exact: true }), 'Cancel');
        await expect(page.locator('div.fixed.inset-0').filter({ visible: true })).toHaveCount(0, { timeout: 10000 });
        expect(await visibleTaskIds()).toEqual(data.visibleTasks);
      });
    });
    await sc('PM-REG-INT-20', 'Integrations › XER Import', 'XER: visibility survives refresh', async s => {
      await s.step(`XER Import: reload the page and click the plan button → plan view with "Manage tasks" opens`, async () => {
        await page.reload({ waitUntil: 'domcontentloaded' }); await navigator.ready();
        await click(main.getByRole('button', { name: /\d+\/\d+ visible/ }), 'Plan');
        await visible(button('Manage tasks'), 'Plan view');
      }, { critical: true });
      await s.step(`XER plan view: compare visible task IDs and plan header with the values before the reload → identical`, async () => {
        expect(await visibleTaskIds()).toEqual(data.visibleTasks);
        expect(clean(await planHeader().innerText())).toBe(data.planHeader);
      });
    });

    // ================= Reference Data =================
    const utilSearch = () => main.getByPlaceholder('Search utils…');
    const utilRows = async () => main.locator('tbody tr').evaluateAll(rows => rows.map(r => [...r.cells].map(c => c.innerText.trim())));
    await sc('PM-REG-REF-01', 'Reference Data › Common Utilities', 'Utilities search by name', async s => {
      await s.step(`Project Management › Reference Data › "Common Utilities": open the page → page opens`, () => navigator.open('Common Utilities'), { critical: true });
      await s.step(`Common Utilities: type "INR" in "Search utils…" → item count changes and every row name/type contains "INR"`, async () => {
        data.utilTotal = await countText();
        await focus(utilSearch()); await utilSearch().fill('INR');
        await expect.poll(countText, { timeout: 15000 }).not.toBe(data.utilTotal);
        for (const [name, type] of await utilRows()) expect(`${name} ${type}`).toMatch(/INR/i);
      });
    });
    await sc('PM-REG-REF-02', 'Reference Data › Common Utilities', 'Utilities search by type', async s => {
      await s.step(`Common Utilities: search "currency" → every row has type "currency_type"; currency names recorded`, async () => {
        await utilSearch().fill('currency');
        await expect.poll(async () => (await utilRows()).length, { timeout: 15000 }).toBeGreaterThan(0);
        const rows = await utilRows();
        for (const [, type] of rows) expect(type).toBe('currency_type');
        data.currencies = rows.map(([name]) => name);
      });
    });
    await sc('PM-REG-REF-03', 'Reference Data › Common Utilities', 'Utilities no-match search', async s => {
      await s.step(`Common Utilities: search "zzqq-no-match" → message No results for "zzqq-no-match", count "0 items" and "No data found" shown`, async () => {
        await utilSearch().fill('zzqq-no-match');
        await visible(main.getByText('No results for "zzqq-no-match"'), 'No results message');
        expect(await countText()).toBe('0 items');
        await visible(main.getByText('No data found'), 'No data found');
      });
      await s.step(`Common Utilities: clear the search → item count returns to the original total`, async () => {
        await utilSearch().fill('');
        await expect.poll(countText, { timeout: 15000 }).toBe(data.utilTotal);
      });
    });
    await sc('PM-REG-REF-04', 'Reference Data › Common Utilities', 'Utility Type dropdown options', async s => {
      await s.step(`Common Utilities: click "Add Common Util" → "Add Common Utils" form opens`, () => openForm('Add Common Util', 'Add Common Utils'), { critical: true });
      await s.step(`Add Common Utils form: open the "Choose CommonUtil Type" dropdown → it lists the 14 known types (fdi_status … preshipping_checklist_status); extra types are only logged`, async () => {
        const options = await dropdownOptions(modal().getByRole('button', { name: 'Choose CommonUtil Type' }));
        const known = ['fdi_status', 'file_category', 'currency_type', 'inv_action_type', 'notification_type', 'shipping_mode', 'task_status',
          'location_type', 'schedule_status', 'notification_category', 'bs_status', 'site_type', 'completion_status', 'preshipping_checklist_status'];
        expect(options).toEqual(expect.arrayContaining(known));
        data.extraUtilTypes = options.filter(option => !known.includes(option));
        if (data.extraUtilTypes.length) console.log(`    (additional utility types: ${data.extraUtilTypes.join(', ')})`);
      });
    });
    await sc('PM-REG-REF-11', 'Reference Data › Common Utilities', 'Modal close behavior', async s => {
      await s.step(`Add Common Utils form: press Escape → form stays open`, async () => {
        await expect(modal()).toBeVisible();
        await page.keyboard.press('Escape'); await page.waitForTimeout(500);
        await expect(modal(), 'Form still open after Escape').toBeVisible();
      });
      await s.step(`Add Common Utils form: close it with the X → form closes and the item count is unchanged (nothing created)`, async () => {
        await navigator.closeOverlay();
        expect(await countText()).toBe(data.utilTotal);
      });
    });
    await sc('PM-REG-REF-19', 'Reference Data › Common UoM / Material Category', 'Search on UoM and Category lists', async s => {
      for (const [label, placeholder, key] of [['Common UoM', 'Search UOM…', 'uoms'], ['Material Category', 'Search categories…', 'categories']]) {
        await s.step(`Project Management › Reference Data › "${label}": open the page → page opens`, () => navigator.open(label), { critical: true });
        await s.step(`${label}: search an existing name in "${placeholder}", then "zzqq-no-match" → matching rows only, then the empty state ("No data found/available"); clear the search`, async () => {
          const names = (await main.locator('tbody tr').evaluateAll(rows => rows.map(r => r.cells[0]?.innerText.trim()))).filter(Boolean);
          data[key] = names;
          const search = main.getByPlaceholder(placeholder);
          await focus(search); await search.fill(names[0]);
          await expect.poll(async () => (await rowTexts()).every(text => text.toLowerCase().includes(names[0].toLowerCase())), { timeout: 15000 }).toBe(true);
          await search.fill('zzqq-no-match');
          try { await visible(main.getByText(EMPTY), 'Empty state'); } finally { await search.fill(''); }
        });
      }
    });

    // ================= Configuration Options =================
    const weekInputs = () => main.locator('input[type="text"]');
    const valueButton = text => main.getByRole('button', { name: text, exact: true }).first();
    await sc('PM-REG-CFG-01', 'Configuration Options', 'Current values render', async s => {
      await s.step(`Project Management › "Configuration Options": open the page → page opens`, () => navigator.open('Configuration Options'), { critical: true });
      await s.step(`Configuration Options: read the three week fields and the Archive, Currency and Integration dropdown values → weeks are not negative and at least three dropdown values shown`, async () => {
        data.weeks = [];
        for (let i = 0; i < 3; i += 1) data.weeks.push(await weekInputs().nth(i).inputValue());
        for (const value of data.weeks) expect(Number(value), 'Week values are not negative (R69)').toBeGreaterThanOrEqual(0);
        // The dropdowns are div[role=button]: read them by role.
        const values = (await main.getByRole('button').allInnerTexts()).map(t => t.trim()).filter(t => /days$|Rupee|dollar|Pound|^None$|^Procore$|^Autodesk ACC$|Sri|^Choose$/.test(t));
        expect(values.length, 'Archive, Currency and Integration values shown').toBeGreaterThanOrEqual(3);
        data.configValues = values;
      });
    });
    await sc('PM-REG-CFG-02', 'Configuration Options', 'Dropdown option sets', async s => {
      await s.step(`Configuration Options: open the "Archive Read Items After" dropdown → 30, 60, 90, 120, 150, 180, 360 days`, async () => {
        const archive = data.configValues.find(v => /days$/.test(v));
        expect(await dropdownOptions(valueButton(archive))).toEqual(['30 days', '60 days', '90 days', '120 days', '150 days', '180 days', '360 days']);
      });
      await s.step(`Configuration Options: open the "Integration Provider" dropdown → None, Procore, Autodesk ACC`, async () => {
        const provider = data.configValues.find(v => /^(None|Procore|Autodesk ACC)$/.test(v));
        expect(await dropdownOptions(valueButton(provider))).toEqual(['None', 'Procore', 'Autodesk ACC']);
      });
      await s.step(`Configuration Options: open the "Currency Type" dropdown → options equal the currency_type utilities seen in Common Utilities`, async () => {
        const currency = data.configValues.find(v => !/days$|^(None|Procore|Autodesk ACC)$/.test(v));
        const options = await dropdownOptions(valueButton(currency));
        if (data.currencies) sameMembers(options, data.currencies, 'Currency options = currency_type utilities');
      });
    });
    await sc('PM-REG-CFG-12', 'Configuration Options', 'Help icons', async s => {
      const texts = {
        'Lead time confirmation (weeks)': 'weeks before the required-on-site date we expect a confirmed lead time',
        'Not ordered alert (weeks)': 'weeks before required-on-site after which an unordered item raises an alert',
        'Not booked alert (weeks)': 'weeks before required-on-site after which an unbooked delivery raises an alert'
      };
      for (const [label, expected] of Object.entries(texts)) {
        // The tooltip opens on click (span[role=tooltip] next to the icon); hovering alone shows nothing (30 Oct).
        await s.step(`Configuration Options: click the "?" (More info) icon of "${label}" → tooltip contains "${expected}"`, async () => {
          const icon = main.locator('label', { hasText: label }).getByRole('button', { name: 'More info' }).first();
          await focus(icon);
          await icon.click();
          const tip = icon.locator('xpath=..').getByRole('tooltip');
          try {
            await expect(tip, `${label} tooltip`).toContainText(expected, { timeout: 6000 });
          } finally {
            if (await tip.isVisible().catch(() => false)) await icon.click();
          }
        });
      }
    });
    await sc('PM-REG-CFG-03', 'Configuration Options', 'Cancel discards changes', async s => {
      await s.step(`Configuration Options: add 1 to the first week field and click the "GRN" toggle if present (no Save) → values changed on screen`, async () => {
        await focus(weekInputs().first()); await weekInputs().first().fill(String(Number(data.weeks[0]) + 1));
        const grn = main.locator('div.justify-between', { has: page.getByText('GRN', { exact: true }) }).last().locator('button, [role="switch"], input[type="checkbox"]').last();
        if (await grn.isVisible().catch(() => false)) { await focus(grn); await grn.click(); data.grnToggled = true; }
      });
      await s.step(`Configuration Options: click "Cancel" → first week field returns to the saved value`, async () => {
        await click(button('Cancel'), 'Cancel');
        try {
          await expect(weekInputs().first()).toHaveValue(data.weeks[0], { timeout: 10000 });
        } catch {
          const shown = await weekInputs().evaluateAll(inputs => inputs.map(input => input.value));
          await page.reload({ waitUntil: 'domcontentloaded' }); // never leave an unsaved change behind
          await navigator.ready();
          const saved = await weekInputs().evaluateAll(inputs => inputs.map(input => input.value));
          throw new Error(`Cancel shows week values ${shown.join('/')} instead of the saved ${data.weeks.join('/')} (after reload: ${saved.join('/')}, nothing saved) – DEF-C7`);
        }
      });
    });

    // ================= First Delivery Inspection Config =================
    const fdiSettings = () => page.locator('main').evaluate(m => {
      const heading = [...m.querySelectorAll('h1,h2,h3,h4')].find(h => h.innerText.trim() === 'FDI Settings');
      const box = heading ? heading.closest('div').parentElement : m;
      return [...box.querySelectorAll('input[type=checkbox]')].slice(0, 4).map(c => ({ checked: c.checked, disabled: c.disabled }));
    });
    const settingLabel = text => main.getByText(text, { exact: true });
    await sc('PM-REG-FDI-01', 'First Delivery Inspection Config', 'Section title and labels', async s => {
      await s.step(`Project Management › "First Delivery Inspection Config": open the page → page opens`, () => navigator.open('First Delivery Inspection Config'), { critical: true });
      await s.step(`First Delivery Inspection Config: check the page → "FDI Settings" title, no "Notification Settings", four checkbox labels and a "Save" button (not clicked); initial states recorded`, async () => {
        await visible(main.getByText('FDI Settings', { exact: true }), 'FDI Settings');
        await expect(main.getByText('Notification Settings')).toHaveCount(0);
        for (const label of ['Need Overall Notes to be captured', 'Enable Uploading of Photos?', 'Photos are mandatory?', 'Provide Link to Submittal Spec Documents?']) {
          await visible(settingLabel(label), label);
        }
        await visible(button('Save'), 'Save (not clicked)');
        data.fdiInitial = await fdiSettings();
      });
    });
    await sc('PM-REG-FDI-02', 'First Delivery Inspection Config', 'Mandatory photo depends on uploads', async s => {
      await s.step(`FDI Settings: ensure "Enable Uploading of Photos?" is ticked, then click it to untick → unticked, and "Photos are mandatory?" is unticked and disabled`, async () => {
        if (!(await fdiSettings())[1].checked) { await settingLabel('Enable Uploading of Photos?').click(); }
        await focus(settingLabel('Enable Uploading of Photos?')); await settingLabel('Enable Uploading of Photos?').click();
        const now = await fdiSettings();
        expect(now[1].checked, 'Uploads off').toBe(false);
        expect(now[2], 'Photos are mandatory? unticked and disabled').toEqual({ checked: false, disabled: true });
      });
    });
    await sc('PM-REG-FDI-02b', 'First Delivery Inspection Config', 'Re-enabling uploads re-enables the mandatory box', async s => {
      await s.step(`FDI Settings: click "Enable Uploading of Photos?" again to tick it → ticked, and "Photos are mandatory?" is enabled again`, async () => {
        await focus(settingLabel('Enable Uploading of Photos?')); await settingLabel('Enable Uploading of Photos?').click();
        const now = await fdiSettings();
        expect(now[1].checked).toBe(true);
        expect(now[2].disabled, 'Photos are mandatory? enabled again').toBe(false);
      });
    });
    await sc('PM-REG-FDI-03', 'First Delivery Inspection Config', 'Unsaved change discarded on reload', async s => {
      await s.step(`First Delivery Inspection Config: reload the page without saving → "FDI Settings" shown again`, async () => {
        await page.reload({ waitUntil: 'domcontentloaded' }); await navigator.ready();
        await visible(main.getByText('FDI Settings', { exact: true }), 'FDI Settings');
      }, { critical: true });
      await s.step(`FDI Settings: read the four checkboxes → same states as before any change`, async () => {
        await expect.poll(fdiSettings, { timeout: 15000 }).toEqual(data.fdiInitial);
      });
    });
    const inspectorTable = () => main.locator('table').filter({ has: page.getByText('Materials Scope') }).first();
    const inspectorRows = () => inspectorTable().locator('tbody tr').evaluateAll(rows => rows.map(r => {
      const cells = [...r.cells];
      const action = cells[cells.length - 1]?.querySelector('button');
      return { scope: cells[2]?.innerText.replace(/\s+/g, ' ').trim(), status: cells[3]?.innerText.trim(), enabled: cells[4]?.innerText.trim(),
        action: action?.innerText.trim(), actionDisabled: action ? action.disabled : null, title: action?.title || '' };
    }));
    await sc('PM-REG-FDI-10', 'First Delivery Inspection Config', 'Inspector table content', async s => {
      await s.step(`First Delivery Inspection Config: read the inspector table headers → Name / Email, Role, Materials Scope, Status, Enabled, Actions`, async () => {
        expect(await headers(inspectorTable())).toEqual(['Name / Email', 'Role', 'Materials Scope', 'Status', 'Enabled', 'Actions']);
      });
      await s.step(`Inspector table: read Status, Enabled and action button of each row → only "Active / Enabled / Disable", "Active / Disabled / Enable" or "Invited - Pending Acceptance / Disabled / Enable (disabled)"`, async () => {
        const rows = await inspectorRows();
        data.hallInspectors = rows.length;
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows) {
          const combo = `${row.status} / ${row.enabled} / ${row.action}${row.actionDisabled ? ' (disabled)' : ''}`;
          expect(['Active / Enabled / Disable', 'Active / Disabled / Enable', 'Invited - Pending Acceptance / Disabled / Enable (disabled)'], `Combination "${combo}"`).toContain(combo);
          expect(row.scope, 'Materials Scope summary').toMatch(/All Materials|· all|\S/);
        }
      });
    });
    await sc('PM-REG-FDI-29a', 'First Delivery Inspection Config', 'Pending invite stays disabled', async s => {
      await s.step(`Inspector table: check rows with Status "Invited - Pending Acceptance" → Enabled "Disabled", action button disabled with tooltip "Activates automatically once the invite is accepted"`, async () => {
        const pending = (await inspectorRows()).filter(row => row.status === 'Invited - Pending Acceptance');
        expect(pending.length, 'Pending invites present').toBeGreaterThan(0);
        for (const row of pending) {
          expect(row.enabled).toBe('Disabled');
          expect(row.actionDisabled).toBe(true);
          expect(row.title).toBe('Activates automatically once the invite is accepted');
        }
      });
    });
    const inviteEmail = (index = 0) => modal().getByPlaceholder('Enter email address').nth(index);
    const sendInvites = () => modal().getByRole('button', { name: 'Send Invites', exact: true });
    await sc('PM-REG-FDI-11', 'First Delivery Inspection Config', 'Invite opens the invite screen; Send disabled when empty', async s => {
      await s.step(`First Delivery Inspection Config: click "Invite" → "Invite Users" form opens`, () => openForm('Invite', 'Invite Users'), { critical: true });
      await s.step(`Invite Users form: check the tabs and the Send button → "Manual entry" and "From Procore directory" tabs shown, "Send Invites" disabled`, async () => {
        await visible(button('Manual entry', modal()), 'Manual entry');
        await visible(button('From Procore directory', modal()), 'From Procore directory');
        await expect(sendInvites()).toBeDisabled();
      });
    });
    await sc('PM-REG-FDI-16', 'First Delivery Inspection Config', 'Invite – role options', async s => {
      await s.step(`Invite Users form: enter pm.reg.nosend@yopmail.com and open the "Choose Role" dropdown → All_Role_Access, Project Admin, Project Manager, Project Senior User, Project User, Subcontractor, Supplier`, async () => {
        await inviteEmail().fill('pm.reg.nosend@yopmail.com');
        expect(await dropdownOptions(modal().getByRole('button', { name: 'Choose Role' }))).toEqual(
          ['All_Role_Access', 'Project Admin', 'Project Manager', 'Project Senior User', 'Project User', 'Subcontractor', 'Supplier']);
      });
    });
    await sc('PM-REG-FDI-16a', 'First Delivery Inspection Config', 'Invite – Organization list is unique', async s => {
      await s.step(`Invite Users form: open the "Choose Organization" dropdown → each organization name appears only once`, async () => {
        // Run alone (re-runs) the Invite form is not open yet: open the page and the form here.
        if (!(await modal().getByRole('button', { name: 'Choose Organization' }).isVisible().catch(() => false))) {
          await navigator.open('First Delivery Inspection Config'); await openForm('Invite', 'Invite Users');
        }
        // The Organization dropdown stays disabled until an e-mail is entered (PM-REG-FDI-16 fills it in a full run).
        if (!(await inviteEmail().inputValue().catch(() => ''))) await inviteEmail().fill('pm.reg.nosend@yopmail.com');
        const options = await dropdownOptions(modal().getByRole('button', { name: 'Choose Organization' }));
        const duplicates = [...new Set(options.filter((name, i) => options.indexOf(name) !== i))];
        if (duplicates.length) throw new Error(`Duplicate organization(s) in Invite list: ${duplicates.join(', ')}`);
      });
    });
    const chooseRole = async role => {
      await click(modal().getByRole('button', { name: 'Choose Role' }).first(), 'Choose Role');
      await click(page.getByRole('option', { name: role, exact: true }), role);
    };
    await sc('PM-REG-FDI-14', 'First Delivery Inspection Config', 'Invite – valid email + role enables Send', async s => {
      await s.step(`Invite Users form: with the email entered, choose role "Project User" → "Send Invites" enabled (not clicked)`, async () => {
        await chooseRole('Project User');
        await expect(sendInvites()).toBeEnabled();
      });
    });
    await sc('PM-REG-FDI-12', 'First Delivery Inspection Config', 'Invite – malformed email', async s => {
      await s.step(`Invite Users form: replace the email with "not-an-email" → "Send Invites" disabled`, async () => {
        await inviteEmail().fill('not-an-email');
        await expect(sendInvites()).toBeDisabled();
      });
    });
    await sc('PM-REG-FDI-15', 'First Delivery Inspection Config', 'Invite – additional empty row blocks Send', async s => {
      await s.step(`Invite Users form: enter pm.reg.nosend@yopmail.com, click "Add Another User" → second email row appears and "Send Invites" is disabled again`, async () => {
        await inviteEmail().fill('pm.reg.nosend@yopmail.com');
        await expect(sendInvites()).toBeEnabled();
        await click(button('Add Another User', modal()), 'Add Another User');
        await expect(modal().getByPlaceholder('Enter email address')).toHaveCount(2);
        await expect(sendInvites()).toBeDisabled();
      });
      await s.step(`Invite Users form: close it (Cancel/X) → form closes, nothing sent`, () => navigator.closeOverlay());
    });
    await sc('PM-REG-FDI-13', 'First Delivery Inspection Config', 'Invite – role required', async s => {
      await s.step(`First Delivery Inspection Config: click "Invite" and enter pm.reg.nosend@yopmail.com without a role → "Send Invites" disabled`, async () => {
        await openForm('Invite', 'Invite Users');
        await inviteEmail().fill('pm.reg.nosend@yopmail.com');
        await expect(sendInvites()).toBeDisabled();
      });
    });
    await sc('PM-REG-FDI-17', 'First Delivery Inspection Config', 'Invite – Procore tab', async s => {
      await s.step(`Invite Users form: click "From Procore directory" → note "Subcontractor role by default", "Search" button, "No users returned" and "Add to invite list" shown`, async () => {
        await click(button('From Procore directory', modal()), 'From Procore directory');
        await visible(modal().getByText(/Subcontractor role by default/), 'Default role note');
        await visible(button('Search', modal()), 'Search');
        await visible(modal().getByText(/No users returned/), 'Empty state');
        await visible(modal().getByText('Add to invite list', { exact: true }), 'Add to invite list');
      });
      await s.step(`Invite Users form: close it (Cancel/X) → form closes, nothing sent`, () => navigator.closeOverlay());
    });
    await sc('PM-REG-FDI-20', 'First Delivery Inspection Config', 'Add Inspector – scope options', async s => {
      await s.step(`First Delivery Inspection Config: click "Add Inspector" → "Add Inspector" form opens`, () => openForm('Add Inspector', 'Add Inspector'), { critical: true });
      await s.step(`Add Inspector form: check the fields → "Project Member *", "Project Role *", "Materials Scope *" with radios "All Materials", "By Material Category", "Specific Materials"; first radio selected`, async () => {
        await inModal([/^Project Member\s*\*$/, /^Project Role\s*\*$/, /^Materials Scope\s*\*$/, 'All Materials', 'By Material Category', 'Specific Materials']);
        const radios = await modal().locator('input[type="radio"]').evaluateAll(list => list.map(r => r.checked));
        expect(radios).toEqual([true, false, false]);
      });
      await s.step(`Add Inspector form: close it without adding → form closes`, () => navigator.closeOverlay());
    });
    await sc('PM-REG-FDI-30', 'First Delivery Inspection Config', 'Catch-all warning', async s => {
      await s.step(`First Delivery Inspection Config: look at the question-set area → warning "No All Categories set …" is shown`, async () => {
        await visible(main.getByText(/No .All Categories. set/), 'Catch-all warning');
      });
    });
    await sc('PM-REG-FDI-31', 'First Delivery Inspection Config', 'New Question Set – form', async s => {
      await s.step(`First Delivery Inspection Config: click "New Question Set" → "New FDI Inspection Question Set" form opens`, () => openForm('New Question Set', 'New FDI Inspection Question Set'), { critical: true });
      await s.step(`New Question Set form: check the fields → "Set Name *" (max 200), "Material Categories *" with "Specific categories" and "All Categories (catch-all)", "Search or add a category", categories used by another set disabled`, async () => {
        await inModal([/^Set Name\s*\*$/, /^Material Categories\s*\*$/, 'Specific categories', 'All Categories (catch-all)']);
        await expect(modal().getByPlaceholder('e.g. Steel Receiving Checks')).toHaveAttribute('maxlength', '200');
        await visible(modal().getByPlaceholder(CATEGORY_SEARCH), 'Search categories');
        await visible(modal().getByText(/\(in: .+\)/), 'Category used by another set');
        expect(await modal().locator('input[type="checkbox"][disabled]').count(), 'Used categories disabled').toBeGreaterThan(0);
      });
    });
    await sc('PM-REG-FDI-33', 'First Delivery Inspection Config', 'Set Name boundary', async s => {
      await s.step(`New Question Set form: type 201 characters in "Set Name" → field keeps only 200`, async () => {
        const name = modal().getByPlaceholder('e.g. Steel Receiving Checks');
        await name.fill('S'.repeat(201));
        expect((await name.inputValue()).length).toBe(200);
      });
      await s.step(`New Question Set form: close it (Cancel/X) → form closes, nothing created`, () => navigator.closeOverlay());
    });
    await sc('PM-REG-FDI-35', 'First Delivery Inspection Config', 'Manage Groups expand/collapse', async s => {
      await s.step(`First Delivery Inspection Config: click "Manage Groups (n)" → groups table with "Heading Display Text" shows n rows`, async () => {
        const toggle = main.getByRole('button', { name: /^Manage Groups/ });
        const n = Number(((await toggle.innerText()).match(/\((\d+)\)/) || [])[1]);
        await click(toggle, 'Manage Groups');
        const groups = main.locator('table').filter({ has: page.getByText('Heading Display Text') }).first();
        await visible(groups, 'Groups table');
        await expect(groups.locator('tbody tr')).toHaveCount(n);
      });
      await s.step(`First Delivery Inspection Config: click "Manage Groups" again → groups table is hidden`, async () => {
        await click(main.getByRole('button', { name: /^Manage Groups/ }), 'Manage Groups');
        await expect(main.getByText('Heading Display Text')).toBeHidden();
      });
    });
    await sc('PM-REG-FDI-37', 'First Delivery Inspection Config', 'Add Question – answer types', async s => {
      await s.step(`First Delivery Inspection Config: click "Add Question" → "Add Question" form opens`, () => openForm('Add Question', 'Add Question'), { critical: true });
      await s.step(`Add Question form: open the "Choose Answer Type" dropdown → Boolean, Text, Date, Pass/Fail/NA, Numeric, Drop Down, Single Photo, Multiple Photo, Document`, async () => {
        expect(await dropdownOptions(modal().getByRole('button', { name: 'Choose Answer Type' }))).toEqual(
          ['Boolean', 'Text', 'Date', 'Pass/Fail/NA', 'Numeric', 'Drop Down', 'Single Photo', 'Multiple Photo', 'Document']);
      });
      await s.step(`Add Question form: close it (Cancel/X) → form closes, nothing added`, () => navigator.closeOverlay());
    });
    const questionRows = () => main.locator('table').filter({ has: page.getByText('Added On') }).first().locator('tbody tr');
    await sc('PM-REG-FDI-42b', 'First Delivery Inspection Config', 'Show and hide deleted questions', async s => {
      const toggle = () => main.getByText('Show deleted questions', { exact: true });
      await s.step(`Questions table: note the row count, tick "Show deleted questions" → row count is at least the number of active questions`, async () => {
        data.activeQuestions = await questionRows().count();
        await click(toggle(), 'Show deleted questions');
        await expect.poll(() => questionRows().count(), { timeout: 15000 }).toBeGreaterThanOrEqual(data.activeQuestions);
      });
      await s.step(`Questions table: untick "Show deleted questions" → row count returns to the number of active questions`, async () => {
        await click(toggle(), 'Show deleted questions');
        await expect.poll(() => questionRows().count(), { timeout: 15000 }).toBe(data.activeQuestions);
      });
    });
    skip('PM-REG-FDI-25a', 'First Delivery Inspection Config', 'Inspector list kept after navigating away', PART2);
    skip('PM-REG-FDI-42c', 'First Delivery Inspection Config', 'Empty Questions list', `${PART2} – an empty question set`);
    skip('PM-REG-FDI-50', 'First Delivery Inspection Config', 'Question list requests are organization-scoped', 'API endpoint not confirmed yet');

    // ================= Inventory Control =================
    await sc('PM-REG-INV-01', 'Inventory Control', 'Empty state', async s => {
      await s.step(`Project Management › "Inventory Control": open the page → page opens`, () => navigator.open('Inventory Control'), { critical: true });
      await s.step(`Inventory Control: check the empty state → "No rules configured" and "Add a rule to set inventory thresholds" shown`, async () => {
        await visible(main.getByText('No rules configured'), 'No rules configured');
        await visible(main.getByText('Add a rule to set inventory thresholds'), 'Empty-state hint');
      });
    });

    // ================= Material Master =================
    const firstRow = async () => clean(await main.locator('tbody tr').first().innerText());
    await sc('PM-REG-MM-01', 'Material Master', 'Paging', async s => {
      await s.step(`Project Management › "Material Master": open the page → page opens`, () => navigator.open('Material Master'), { critical: true });
      await s.step(`Material Master: wait for the list → page 1 has 25 rows and a "Page 2" link; first row recorded`, async () => {
        // The list loads after the page opens ("0 items" with a spinner first).
        await expect.poll(() => main.locator('tbody tr').count(), { message: 'Rows on page 1', timeout: 30000 }).toBe(25);
        await visible(main.locator('a[aria-label="Page 2"]'), 'Page 2');
        data.mmFirst = await firstRow();
      });
      await s.step(`Material Master: click "Next page", "Previous page", "Page 2", then "Page 1" → first row changes on page 2 and returns to the original on page 1`, async () => {
        await click(page.getByRole('button', { name: 'Next page' }), 'Next page');
        await expect.poll(firstRow, { timeout: 15000 }).not.toBe(data.mmFirst);
        const page2 = await firstRow();
        await click(page.getByRole('button', { name: 'Previous page' }), 'Previous page');
        await expect.poll(firstRow, { timeout: 15000 }).toBe(data.mmFirst);
        await click(main.locator('a[aria-label="Page 2"]'), 'Page 2');
        await expect.poll(firstRow, { timeout: 15000 }).toBe(page2);
        await click(main.locator('a[aria-label^="Page 1"]'), 'Page 1');
        await expect.poll(firstRow, { timeout: 15000 }).toBe(data.mmFirst);
      });
    });
    await sc('PM-REG-MM-02', 'Material Master', 'Search', async s => {
      const search = () => main.getByPlaceholder('Search materials…');
      await s.step(`Material Master: type the first row material name in "Search materials…" → only rows containing that name remain`, async () => {
        const name = await main.locator('tbody tr').first().evaluate(r => r.cells[3]?.innerText.trim());
        await focus(search()); await search().fill(name);
        await expect.poll(async () => (await rowTexts()).every(t => t.includes(name)), { timeout: 15000 }).toBe(true);
      });
      await s.step(`Material Master: search "zzqq-no-match" → empty state shown; clear the search → original first row returns`, async () => {
        await search().fill('zzqq-no-match');
        try { await visible(main.getByText(EMPTY), 'Empty state'); } finally { await search().fill(''); }
        await expect.poll(firstRow, { timeout: 15000 }).toBe(data.mmFirst);
      });
    });
    await sc('PM-REG-MM-03', 'Material Master', 'Row menu actions', async s => {
      await s.step(`Material Master: click the row menu icon of the first row → menu shows Edit, Delete, Map Supplier, Statistics (then closed)`, async () => {
        await click(main.locator('tbody tr').first().locator('img[alt="Menu"]'), 'Row menu');
        for (const item of ['Edit', 'Delete', 'Map Supplier', 'Statistics']) await visible(page.getByText(item, { exact: true }).last(), item);
        await page.keyboard.press('Escape'); await page.mouse.click(5, 300);
      });
    });
    await sc('PM-REG-MM-04', 'Material Master', 'Expand row shows items', async s => {
      await s.step(`Material Master: expand a material that has "n items" with its expand button → item rows with "SKU ID" column shown; collapse it`, async () => {
        const row = main.locator('tbody tr').filter({ hasText: /\d+ items?/ }).first();
        await click(row.locator('button').first(), 'Expand');
        await visible(main.getByText('SKU ID', { exact: true }), 'Item rows');
        await row.locator('button').first().click();
      });
    });
    await sc('PM-REG-MM-14', 'Material Master', 'Export', async s => {
      await s.step(`Material Master: click "Export" → .xlsx downloaded, sheet "Filtered Data" has as many "Material" Row Type rows as materials listed`, async () => {
        const total = Number(((await countText()).match(/\d+/) || [])[0]);
        const file = await download(button('Export'), 'Export');
        expect(file.name).toMatch(/\.xlsx$/i);
        const book = readWorkbook(file.path);
        const rows = (book['Filtered Data'] || Object.values(book)[0]).map(row => Object.values(row));
        const type = rows[0].indexOf('Row Type');
        expect(type, 'Row Type column').toBeGreaterThanOrEqual(0);
        expect(rows.slice(1).filter(row => row[type] === 'Material').length, 'Exported Material rows = materials listed').toBe(total);
      });
    });
    await sc('UPL-MM-01', 'Material Master › Upload', 'Template download and layout', async s => {
      await s.step(`Material Master: click "Upload" › "Download Template" → file material_bulk_upload_template.xlsx, sheet "Materials" headers category, material_name, uom, item_name, item_conversion`, async () => {
        await click(button('Upload'), 'Upload');
        const file = await download(page.getByText('Download Template', { exact: true }).first(), 'Download Template');
        expect(file.name).toBe('material_bulk_upload_template.xlsx');
        const book = readWorkbook(file.path);
        expect(Object.values(book.Materials[0])).toEqual(['category', 'material_name', 'uom', 'item_name', 'item_conversion']);
        data.materialTemplate = book;
        await page.keyboard.press('Escape'); await page.mouse.click(5, 300);
      });
    });
    await sc('UPL-MM-02', 'Material Master › Upload', 'UoM dropdown matches Common UoM', async s => {
      await s.step(`Downloaded Material template: read the UoM list sheet → names equal the Common UoM names (unique, ignoring case and spaces)`, async () => {
        const list = (data.materialTemplate?._Lists || []).map(row => Object.values(row)[0]).filter(Boolean);
        expect(list.length).toBeGreaterThan(0);
        // Compare unique names ignoring case and spaces: Common UoM can hold case/space duplicates (SCP-DEF-029).
        const key = value => String(value).toLowerCase().replace(/\s+/g, '');
        const template = new Set(list.map(key));
        const page = new Set((data.uoms || []).map(key));
        const missing = [...page].filter(name => !template.has(name));
        const extra = [...template].filter(name => !page.has(name));
        expect({ missing, extra }, 'Template UoM list = Common UoM names (unique, ignoring case and spaces)').toEqual({ missing: [], extra: [] });
      });
    });
    skip('UPL-MM-15', 'Material Master › Upload', 'Reports can be downloaded', `${PART2} – the UPL-MM-05 upload`);

    // ================= PreShipping Checklist =================
    // Precondition: the page is only listed while the project's Pre-Shipping option is on. On 20 Nov it was found off
    // (switched by hand; no test changes it), so PSC-01 and NAV-01 failed for an environment reason. Report that as
    // Blocked instead of a failure; the setting is not changed by the test because the project is shared.
    const preShippingOn = await navigator.hasMenuEntry('PreShipping Checklist');
    if (!preShippingOn) run.block(meta('PM-REG-PSC-01', 'PreShipping Checklist', 'List renders'), PRE_SHIPPING_OFF);
    else await sc('PM-REG-PSC-01', 'PreShipping Checklist', 'List renders', async s => {
      await s.step(`Project Management › "PreShipping Checklist": open the page → page opens`, () => navigator.open('PreShipping Checklist'), { critical: true });
      await s.step(`PreShipping Checklist: read the table → headers #, Question, Enabled, Count, Actions and at least one question row (nothing toggled)`, async () => {
        expect(await headers(main.locator('table').first())).toEqual(['#', 'Question', 'Enabled', 'Count', 'Actions']);
        expect(await main.locator('tbody tr').count()).toBeGreaterThan(0);
      });
    });

    // ================= Bulk Upload Status =================
    const dates = () => main.locator('input[type="text"]');
    const uploads = () => main.locator('tbody tr').evaluateAll(rows => rows.map(r => [...r.cells].map(c => c.innerText.trim())).filter(c => c.length >= 7));
    await sc('PM-REG-BUS-01', 'Bulk Upload Status', 'Default date range', async s => {
      await s.step(`Project Management › "Bulk Upload Status": open the page → page opens`, () => navigator.open('Bulk Upload Status'), { critical: true });
      await s.step(`Bulk Upload Status: read the two date fields → From = today minus one calendar month, To = today (dd/mm/yyyy); upload rows recorded`, async () => {
        // The default range starts one calendar month back (31 Oct → 30 Sep), not 30 days back.
        const today = new Date();
        const lastDayPrev = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
        const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, Math.min(today.getDate(), lastDayPrev));
        await expect(dates().nth(0)).toHaveValue(ddmmyyyy(monthAgo));
        await expect(dates().nth(1)).toHaveValue(ddmmyyyy(new Date()));
        data.uploads = await uploads();
      });
    });
    // The upload-type filter is multi-select: each option toggles; the button shows "All Upload Types <count>".
    const toggleTypes = async (...types) => {
      await click(main.getByRole('button', { name: /^All Upload Types/ }), 'Upload type');
      for (const type of types) await click(page.getByRole('option', { name: type, exact: true }), type);
      await page.keyboard.press('Escape'); await navigator.ready();
    };
    // Each step starts from the default filter (reload), so a retry never inherits a half-toggled multi-select.
    const resetFilters = async () => { await page.reload({ waitUntil: 'domcontentloaded' }); await navigator.ready(); await page.waitForTimeout(800); };
    await sc('PM-REG-BUS-02', 'Bulk Upload Status', 'Type filter', async s => {
      await s.step(`Bulk Upload Status: reload, open the "All Upload Types" filter and select "Inventory" → every row has Upload Type "Inventory"`, async () => {
        await resetFilters();
        data.uploads = data.uploads || await uploads();
        await toggleTypes('Inventory');
        await expect.poll(async () => (await uploads()).every(row => row[2] === 'Inventory'), { timeout: 15000 }).toBe(true);
      });
      await s.step(`Bulk Upload Status: reload, open the "All Upload Types" filter and select "Materials" → every row has Upload Type "Materials"`, async () => {
        await resetFilters();
        await toggleTypes('Materials');
        await expect.poll(async () => (await uploads()).every(row => row[2] === 'Materials'), { timeout: 15000 }).toBe(true);
      });
      await s.step(`Bulk Upload Status: reload to the default filter → row count equals the original unfiltered count`, async () => {
        await resetFilters();
        await expect.poll(async () => (await uploads()).length, { timeout: 15000 }).toBe(data.uploads.length);
      });
    });
    await sc('PM-REG-BUS-03', 'Bulk Upload Status', 'Uploader search', async s => {
      const search = () => main.getByPlaceholder('Search by uploader…');
      await s.step(`Bulk Upload Status: type the signed-in user email in "Search by uploader…" → every row shows that uploader`, async () => {
        await focus(search()); await search().fill(config.username);
        await expect.poll(async () => (await uploads()).every(row => row[1] === config.username), { timeout: 15000 }).toBe(true);
      });
      await s.step(`Bulk Upload Status: search "zzqq-no-match" → no rows; clear the search`, async () => {
        await search().fill('zzqq-no-match');
        await expect.poll(async () => (await uploads()).length, { timeout: 15000 }).toBe(0);
        await search().fill('');
      });
    });
    await sc('PM-REG-BUS-04', 'Bulk Upload Status', 'Date range filtering', async s => {
      const asDate = text => { const [d, m, y] = text.split('/').map(Number); return new Date(y, m - 1, d); };
      const setDates = async (from, to) => {
        await pickDate(dates().nth(0), from); await pickDate(dates().nth(1), to); await navigator.ready();
      };
      await s.step(`Bulk Upload Status: set From and To to the date of the first upload → only rows dated that day remain`, async () => {
        data.uploads = data.uploads || await uploads();
        const day = data.uploads[0]?.[0];
        expect(day, 'An upload date exists').toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
        await setDates(asDate(day), asDate(day));
        await expect(dates().nth(0)).toHaveValue(day);
        await expect.poll(async () => (await uploads()).every(row => row[0] === day), { timeout: 15000 }).toBe(true);
      });
      await s.step(`Bulk Upload Status: set From = today and To = 5 days ago → page still renders and shows no rows`, async () => {
        await setDates(new Date(), daysAgo(5));
        await expect(main.locator('table').first(), 'Page still renders').toBeVisible();
        expect((await uploads()).length, 'No rows for an inverted range').toBe(0);
      });
      await s.step(`Bulk Upload Status: reload → To date is today again (default range)`, async () => {
        await page.reload({ waitUntil: 'domcontentloaded' }); await navigator.ready();
        await expect(dates().nth(1)).toHaveValue(ddmmyyyy(new Date()));
      });
    });
    await sc('PM-REG-BUS-05', 'Bulk Upload Status', 'Status matches outcome', async s => {
      await s.step(`Bulk Upload Status: compare Status with the success/failure file columns → no Success without a success file, no Failed without a failure file, no row without a status`, async () => {
        const rows = await uploads();
        const failedWithoutStatus = rows.filter(r => r[3] === '-' && r[5] === '-' && r[6] !== '-');
        const wrong = rows.filter(r => (r[3] === 'Success' && r[5] === '-') || (r[3] === 'Failed' && r[6] === '-'));
        expect(wrong.map(r => `${r[0]} ${r[4]}: ${r[3]}`), 'Status contradicts the files').toEqual([]);
        if (failedWithoutStatus.length) throw new Error(`Application defect: ${failedWithoutStatus.length} upload record(s) have no status (failure file only: ${failedWithoutStatus.map(r => `${r[0]} ${r[4]}`).join('; ')})`);
      });
    });
    await sc('PM-REG-BUS-06', 'Bulk Upload Status', 'Success/Failure file links', async s => {
      await s.step(`Bulk Upload Status: check file columns → Success rows have a success file; Failed rows have a failure file and no success file`, async () => {
        for (const r of await uploads()) {
          // A Success upload can also carry an error file for its duplicate rows (31 Oct build).
          if (r[3] === 'Success') expect(r[5], `${r[4]} success file`).not.toBe('-');
          if (r[3] === 'Failed') { expect(r[6], `${r[4]} failure file`).not.toBe('-'); expect(r[5]).toBe('-'); }
        }
      });
    });
    await sc('PM-REG-BUS-07', 'Bulk Upload Status', 'Download result reports', async s => {
      for (const [label, column] of [['success', 5], ['failure', 6]]) {
        await s.step(`Bulk Upload Status: click the ${label} report link of the first row that has one → file downloads, is not empty and opens as a workbook`, async () => {
          const rows = await uploads();
          const index = rows.findIndex(r => r[column] && r[column] !== '-');
          expect(index, `A row with a ${label} report`).toBeGreaterThanOrEqual(0);
          const cell = main.locator('tbody tr').nth(index).locator('td').nth(column);
          const file = await download(cell.locator('a, button, span').filter({ hasText: rows[index][column] }).first(), `${label} report`);
          expect(file.size, `${label} report has content`).toBeGreaterThan(0);
          expect(Object.keys(readWorkbook(file.path)).length, `${label} report is a workbook`).toBeGreaterThan(0);
        });
      }
    });

    // ================= Procurement Log Configuration =================
    const logRow = name => main.locator('tbody tr').filter({ hasText: name }).first();
    await sc('PM-REG-PLC-01', 'Procurement Log Configuration', 'Locked fields cannot be disabled', async s => {
      await s.step(`Project Management › "Procurement Log Configuration": open the page → page opens`, () => navigator.open('Procurement Log Configuration'), { critical: true });
      await s.step(`Procurement Log Configuration: check the Material Name(Locked), Submittal No(Locked) and Supplier Name(Locked) rows → checkbox ticked and disabled`, async () => {
        for (const name of ['Material Name(Locked)', 'Submittal No(Locked)', 'Supplier Name(Locked)']) {
          const box = logRow(name).locator('input[type="checkbox"]');
          await focus(box);
          await expect(box).toBeChecked();
          await expect(box).toBeDisabled();
        }
      });
    });
    await sc('PM-REG-PLC-02', 'Procurement Log Configuration', 'Field Type options', async s => {
      await s.step(`Procurement Log Configuration: click "Add Log Fields" → "Add Procurement Log Fields" form opens`, () => openForm('Add Log Fields', 'Add Procurement Log Fields'), { critical: true });
      await s.step(`Add Procurement Log Fields form: open the "Choose Field Type" dropdown → Number, String, Date`, async () => {
        expect(await dropdownOptions(modal().getByRole('button', { name: 'Choose Field Type' }))).toEqual(['Number', 'String', 'Date']);
      });
      await s.step(`Add Procurement Log Fields form: close it (Cancel/X) → form closes, nothing added`, () => navigator.closeOverlay());
    });
    await sc('PM-REG-PLC-09', 'Procurement Log Configuration', 'Unsaved changes on navigation', async s => {
      const target = () => logRow('Spec Section No').locator('input[type="checkbox"]');
      let prompted = false;
      await s.step(`Procurement Log Configuration: toggle the "Spec Section No" checkbox without saving, then open "Site Details" from the menu → page opens (a leave prompt is accepted if shown)`, async () => {
        data.specSection = await target().isChecked();
        await focus(target()); await target().click();
        page.once('dialog', dialogEvent => { prompted = true; dialogEvent.accept().catch(() => null); });
        await navigator.open('Site Details');
      }, { critical: true });
      await s.step(`Project Management › "Procurement Log Configuration": come back and read "Spec Section No" → checkbox has its original value (if not, it is restored with "Save Changes" and the step fails)`, async () => {
        await navigator.open('Procurement Log Configuration');
        const now = await target().isChecked();
        if (now !== data.specSection) {
          await target().click(); await click(button('Save Changes'), 'Save Changes (restore)');
          throw new Error('The unsaved toggle was persisted after leaving the page (restored to the original value)');
        }
        if (prompted) console.log('    (the app asked before leaving the page)');
      });
    });

    // ================= Site Details =================
    await sc('PM-REG-SITE-01', 'Site Details', 'Dropdown options', async s => {
      await s.step(`Project Management › "Site Details": open the page → page opens`, () => navigator.open('Site Details'), { critical: true });
      await s.step(`Site Details: click "Add Site", open the "Choose Site" dropdown → Warehouse, Site_type3, Site; close the form`, async () => {
        await openForm('Add Site', 'Add Site');
        data.siteTypes = await dropdownOptions(modal().getByRole('button', { name: 'Choose Site' }));
        expect(data.siteTypes).toEqual(['Warehouse', 'Site_type3', 'Site']);
        await navigator.closeOverlay();
      });
      await s.step(`Site Details: click "ADD" on the first site row, open the "Choose Location" dropdown → Construction Area, Substore; close the form`, async () => {
        await click(main.locator('tbody tr').first().getByRole('button', { name: 'ADD', exact: true }), 'ADD location');
        await expect(modal()).toBeVisible();
        data.locationTypes = await dropdownOptions(modal().getByRole('button', { name: 'Choose Location' }));
        expect(data.locationTypes).toEqual(['Construction Area', 'Substore']);
        await navigator.closeOverlay();
      });
    });
    await sc('PM-REG-SITE-02', 'Site Details', 'Row menu', async s => {
      await s.step(`Site Details: click the row menu icon of the first site → menu shows Edit and Delete (then closed)`, async () => {
        await click(main.locator('tbody tr').first().locator('img[alt="Menu"]'), 'Row menu');
        for (const item of ['Edit', 'Delete']) await visible(page.getByText(item, { exact: true }).last(), item);
        await page.keyboard.press('Escape'); await page.mouse.click(5, 300);
      });
    });
    await sc('PM-REG-SITE-06', 'Site Details', 'Address entry on Add Site', async s => {
      await s.step(`Site Details: click "Add Site", type "Anna Salai Chennai" in "Start typing an address…" → no suggestion list appears and the typed text stays`, async () => {
        await openForm('Add Site', 'Add Site');
        const address = modal().getByPlaceholder('Start typing an address…');
        await focus(address); await address.pressSequentially('Anna Salai Chennai', { delay: 40 });
        await page.waitForTimeout(1500);
        await expect(page.locator('.pac-container:visible, [role="listbox"]:visible')).toHaveCount(0);
        await expect(address).toHaveValue('Anna Salai Chennai');
      });
      await s.step(`Add Site form: close it (Cancel/X) → form closes, nothing added`, () => navigator.closeOverlay());
    });
    await sc('PM-REG-SITE-11', 'Site Details', 'Export sites', async s => {
      await s.step(`Site Details: click "Export" → .xlsx downloaded listing as many distinct site names as the page shows`, async () => {
        if (!(await button('Export').isVisible().catch(() => false))) await navigator.open('Site Details'); // run alone in re-runs
        const total = Number(((await countText()).match(/\d+/) || [])[0]);
        const file = await download(button('Export'), 'Export');
        expect(file.name).toMatch(/\.xlsx$/i);
        // One row per location (Site Name, Site Type, Location Name, Location Type, Client ID, Project ID, Created At).
        // 19 Nov 2026: the old message listed every site name and was cut off; it now states each cause in short.
        const [head, ...rows] = Object.values(readWorkbook(file.path))[0].map(row => Object.values(row));
        const at = name => Math.max(0, head.findIndex(h => String(h).trim().toLowerCase() === name.toLowerCase()));
        const [iSite, iType, iProject] = [at('Site Name'), at('Location Type'), at('Project ID')];
        const projectId = await page.evaluate(() => localStorage.getItem('selectedProjectId'));
        const names = new Set(rows.map(r => r[iSite]).filter(Boolean));
        const foreign = [...new Set(rows.filter(r => projectId && r[iProject] && r[iProject] !== projectId).map(r => `${r[iSite]} (${r[iProject]})`))];
        const idTypes = rows.filter(r => /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(String(r[iType] || ''))).length;
        s.observe(`page ${total} site(s); export ${rows.length} row(s), ${names.size} distinct site(s); other projects: ${foreign.join(', ') || 'none'}; Location Type shown as an ID in ${idTypes} row(s)`);
        const problems = [];
        if (names.size !== total) problems.push(`export has ${names.size} distinct sites, the page lists ${total}`);
        if (foreign.length) problems.push(`rows from other projects: ${foreign.slice(0, 3).join(', ')}`);
        if (idTypes) problems.push(`Location Type shows an internal ID in ${idTypes} of ${rows.length} rows`);
        if (problems.length) throw new Error(`Site Details export: ${problems.join('; ')}`);
      });
    });
    await sc('UPL-SITE-01', 'Site Details › Upload', 'Template download and layout', async s => {
      await s.step(`Site Details: click "Upload" › "Download Template" → file site_bulk_upload_template.xlsx, sheet "Sheet1" headers site_name, site_type, location_name, location_type`, async () => {
        await click(button('Upload'), 'Upload');
        const file = await download(page.getByText('Download Template', { exact: true }).first(), 'Download Template');
        expect(file.name).toBe('site_bulk_upload_template.xlsx');
        const book = readWorkbook(file.path);
        expect(Object.values(book.Sheet1[0]).filter(Boolean)).toEqual(['site_name', 'site_type', 'location_name', 'location_type']);
        await page.keyboard.press('Escape'); await page.mouse.click(5, 300);
      });
    });
    skip('UPL-SITE-13', 'Site Details › Upload', 'Reports can be downloaded', `${PART2} – the UPL-SITE-04 upload`);

    // ================= Submittal Manager =================
    await sc('PM-REG-SUB-01', 'Submittal Manager', 'Repurposed notice only', async s => {
      await s.step(`Project Management › "Submittal Manager": open the page → page opens`, () => navigator.open('Submittal Manager'), { critical: true });
      await s.step(`Submittal Manager: read the page → notice "This page is being repurposed." only, no table and no buttons`, async () => {
        await visible(main.getByText(/^This page is being repurposed\./), 'Notice');
        await expect(main.locator('table')).toHaveCount(0);
        await expect(main.getByRole('button')).toHaveCount(0);
      });
    });

    // ================= System Messages =================
    const title = () => main.locator('input[maxlength="120"]').first();
    const body = () => main.locator('textarea').first();
    const preview = () => main.getByText('Preview', { exact: true }).locator('xpath=..');
    await sc('PM-REG-SYS-01', 'System Messages', 'Form fields and limits', async s => {
      await s.step(`Project Management › "System Messages": open the page → page opens`, () => navigator.open('System Messages'), { critical: true });
      await s.step(`System Messages: note the first message, click "New message" → form opens with a "Create" button (not clicked)`, async () => {
        data.firstMessage = clean(await main.locator('tbody tr').first().locator('td').nth(2).innerText());
        await click(button('New message'), 'New message');
        await visible(button('Create'), 'Create (not clicked)');
      }, { critical: true });
      await s.step(`New message form: check Scope, Severity, limits and dates → Scope "Platform (all projects)" and "Project (this project only)", Severity Info/Warning, Title max 120, Body required max 2000 with "0/2000", two date-time fields, "Active"`, async () => {
        const selects = main.locator('select');
        expect(await selectOptions(selects.nth(0))).toEqual(['Platform (all projects)', 'Project (this project only)']);
        expect(await selectOptions(selects.nth(1))).toEqual(['Info', 'Warning']);
        await expect(title()).toHaveAttribute('maxlength', '120');
        await expect(body()).toHaveAttribute('maxlength', '2000');
        expect(await body().evaluate(t => t.required), 'Body required').toBe(true);
        await visible(main.getByText('0/2000', { exact: true }), 'Counter');
        await expect(main.locator('input[type="datetime-local"]')).toHaveCount(2);
        await visible(main.getByText('Active', { exact: true }), 'Active');
      });
    });
    await sc('PM-REG-SYS-02', 'System Messages', 'Markdown preview', async s => {
      await s.step(`New message form: type "**bold** *it* [l](https://x.y)" in the body → Preview shows bold text, italic text and a link "l" to https://x.y`, async () => {
        await body().fill('**bold** *it* [l](https://x.y)');
        await expect(preview().locator('strong')).toHaveText('bold');
        await expect(preview().locator('em')).toHaveText('it');
        await expect(preview().locator('a[href="https://x.y"]')).toHaveText('l');
      });
      await s.step(`New message form: type a script tag and "# Heading" in the body → Preview contains no script or heading and the script does not run`, async () => {
        await body().fill('<script>window.__pmXss = 1</script>\n# Heading');
        await page.waitForTimeout(500);
        const html = await preview().innerHTML();
        expect(html).not.toMatch(/<script|<h1/i);
        expect(await page.evaluate(() => window.__pmXss)).toBeUndefined();
      });
    });
    await sc('PM-REG-SYS-04', 'System Messages', 'Body 2000 / Title 120 boundary', async s => {
      await s.step(`New message form: type 2001 characters in the body and 121 in the title → body stops at 2000 ("2000/2000"), title at 120`, async () => {
        await body().fill('b'.repeat(2001));
        expect((await body().inputValue()).length).toBe(2000);
        await visible(main.getByText('2000/2000', { exact: true }), 'Counter 2000/2000');
        await title().fill('t'.repeat(121));
        expect((await title().inputValue()).length).toBe(120);
      });
      await s.step(`New message form: click "Cancel" → form closes ("Create" hidden), nothing created`, async () => {
        await click(button('Cancel'), 'Cancel');
        await expect(button('Create')).toBeHidden();
      });
    });
    await sc('PM-REG-SYS-06', 'System Messages', 'Edit pre-fills', async s => {
      await s.step(`System Messages: click "Edit" on the first message → edit form opens with "Save" (not clicked)`, async () => {
        await click(main.locator('tbody tr').first().getByRole('button', { name: 'Edit', exact: true }), 'Edit');
        await visible(button('Save'), 'Save (not clicked)');
      }, { critical: true });
      await s.step(`Edit form: compare fields with the list → title and body pre-filled, counter shows the body length "n/2000", Preview shows the start of the body`, async () => {
        expect(data.firstMessage).toContain(await title().inputValue());
        const value = await body().inputValue();
        expect(value.length).toBeGreaterThan(0);
        expect(data.firstMessage).toContain(value.slice(0, 30));
        await visible(main.getByText(`${value.length}/2000`, { exact: true }), 'Counter');
        await expect(preview()).toContainText(value.slice(0, 20));
      });
      await s.step(`Edit form: click "Cancel" → form closes ("Save" hidden), nothing saved`, async () => {
        await click(button('Cancel'), 'Cancel');
        await expect(button('Save')).toBeHidden();
      });
    });
    // PM-REG-SYS-11 (banner dismiss) moved to part 2 on 22 Nov 2026, where the run's own active banner guarantees a notice.

    // ================= Watched Materials =================
    const userSelect = () => main.locator('select').first();
    await sc('PM-REG-WM-01', 'Watched Materials', 'No user selected', async s => {
      await s.step(`Project Management › "Watched Materials": open the page → page opens`, () => navigator.open('Watched Materials'), { critical: true });
      await s.step(`Watched Materials: read the page before choosing a user → prompt "Pick a user to view or assign watches." shown`, () => visible(main.getByText('Pick a user to view or assign watches.'), 'Prompt'));
    });
    await sc('PM-REG-WM-02', 'Watched Materials', 'View own watches', async s => {
      await s.step(`Watched Materials: pick the signed-in user (or the first real user) in the user dropdown → watches load`, async () => {
        const name = await page.evaluate(() => {
          const info = JSON.parse(localStorage.getItem('userInfo') || '{}');
          return [info.first_name || info.firstName, info.last_name || info.lastName].filter(Boolean).join(' ') || info.name || '';
        });
        const labels = await selectOptions(userSelect());
        const match = labels.find(label => name && label.toLowerCase() === name.toLowerCase()) || labels.find(label => !/^Select a user/i.test(label));
        await focus(userSelect()); await userSelect().selectOption({ label: match });
      }, { critical: true });
      await s.step(`Watched Materials: read the watch rows → each row has type Category or Trade, status On/Off and a "Remove" action`, async () => {
        const rows = await main.locator('tbody tr').evaluateAll(list => list.map(r => [...r.cells].map(c => c.innerText.trim())));
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows) {
          expect(['Category', 'Trade']).toContain(row[0]);
          expect(row.join(' ')).toMatch(/On|Off/);
          expect(row.join(' ')).toContain('Remove');
        }
      });
    });
    await sc('PM-REG-WM-03', 'Watched Materials', 'Add watch – type/value lists', async s => {
      await s.step(`Watched Materials: open the add-watch dropdowns → Type options Category and Trade; value list holds material categories (matching Material Category when captured in full)`, async () => {
        const selects = main.locator('select');
        expect(await selectOptions(selects.nth(1))).toEqual(['Category', 'Trade']);
        const values = (await selectOptions(selects.nth(2))).filter(v => !/^Select/.test(v));
        expect(values.length).toBeGreaterThan(0);
        // Compare only when the category list was captured in full (not paged).
        if (data.categories && data.categories.length >= values.length) for (const value of values) expect(data.categories, `"${value}" is a Material Category`).toContain(value);
      });
    });

    // ================= Navigation (whole menu) =================
    await sc('PM-REG-NAV-01', 'Navigation', 'Every PM leaf opens its route', async s => {
      // An entry hidden by a switched-off project option is not a navigation fault (see the PSC precondition above).
      const expectedEntries = Object.keys(MENU).filter(label => preShippingOn || label !== 'PreShipping Checklist');
      if (!preShippingOn) s.observe('PreShipping Checklist not checked: the Pre-Shipping option is switched off');
      for (const label of expectedEntries.filter(item => !navigator.visited.some(v => v.label === item))) {
        await s.step(`Left menu: open "${label}" → page opens`, () => navigator.open(label));
      }
      await s.step(`Left menu: review all pages opened so far → all ${expectedEntries.length} expected entries reached their route and were highlighted as active in the menu`, async () => {
        const seen = new Map(navigator.visited.map(v => [v.label, v]));
        const notReached = expectedEntries.filter(label => !seen.get(label)?.reached).map(label => `${label} → /${MENU[label].route}`);
        const notActive = expectedEntries.filter(label => seen.get(label)?.reached && !seen.get(label)?.appActive);
        const problems = [];
        if (notReached.length) problems.push(`Route not reached: ${notReached.join(', ')}`);
        if (notActive.length) problems.push(`Opened but not highlighted as active in the menu: ${notActive.join(', ')}`);
        if (problems.length) throw new Error(problems.join('; '));
      });
    });
    await sc('PM-REG-NAV-03', 'Navigation', 'Direct URL access with an active session', async s => {
      for (const [label, entry] of Object.entries(MENU)) {
        await s.step(`Browse directly to /${entry.route} (${label}) → stays on the SCP site without re-login and content is not empty`, async () => {
          await navigator.gotoRoute(entry.route);
          expect(new URL(page.url()).origin, `${label} without re-login`).toBe(new URL(config.baseUrl).origin);
          await expect(main, `${label} content`).not.toBeEmpty({ timeout: 15000 });
        });
      }
    });
    await sc('PM-REG-NAV-06', 'Navigation', 'Unauthenticated access is redirected', async s => {
      await s.step(`New signed-out browser context: open /material-master → redirected to login or no data rows shown`, async () => {
        const context = await page.context().browser().newContext();
        try {
          const other = await context.newPage();
          await other.goto(new URL('/material-master', config.baseUrl).href, { waitUntil: 'domcontentloaded' });
          await other.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
          const onLogin = !new URL(other.url()).origin.includes('supplychain');
          const showsData = await other.locator('tbody tr').count().catch(() => 0);
          expect(onLogin || showsData === 0, 'Redirected to login or no PM data shown').toBe(true);
        } finally { await context.close(); }
      });
    });

    // ================= Second project (one switch, same session) =================
    await sc('PM-REG-NAV-07', `Other project › ${SECOND_PROJECT}`, 'Setup Wizard shown while setup is incomplete', async s => {
      await s.step(`Header project selector: switch to ${SECOND_PROJECT} → project switched`, () => navigator.switchProject(SECOND_PROJECT), { critical: true });
      await s.step(`Left menu › Project Management: look at the first child → "Setup Wizard"; click it → /setup-wizard opens with "Project Setup" and a numbered open step`, async () => {
        if (!(await navigator.menuItem('Setup Wizard').isVisible().catch(() => false))) {
          if (!(await navigator.menuItem('Configuration Options').isVisible().catch(() => false))) await navigator.menuItem(PM).click();
        }
        const firstChild = await page.locator('nav').evaluate((nav, pm) => {
          const btn = [...nav.querySelectorAll('button')].find(b => b.innerText.trim() === pm);
          return btn?.closest('li')?.querySelector(':scope > ul > li button')?.innerText.trim();
        }, PM);
        expect(firstChild).toBe('Setup Wizard');
        await click(navigator.menuItem('Setup Wizard'), 'Setup Wizard');
        await page.waitForURL(/\/setup-wizard\/?$/);
        await visible(main.getByText('Project Setup', { exact: true }), 'Project Setup');
        await visible(main.getByText(/^\d+\.\s/).first(), 'Current open step');
      });
    });
    await sc('PM-REG-FDI-07', `Other project › ${SECOND_PROJECT}`, 'Defaults on an unconfigured project', async s => {
      await s.step(`Project Management › "First Delivery Inspection Config" (${SECOND_PROJECT}): open the page → page opens`, () => navigator.open('First Delivery Inspection Config'), { critical: true });
      await s.step(`FDI Settings: read the four checkboxes → all unticked, "Photos are mandatory?" disabled`, async () => {
        await expect.poll(fdiSettings, { timeout: 15000 }).toEqual([
          { checked: false, disabled: false }, { checked: false, disabled: false }, { checked: false, disabled: true }, { checked: false, disabled: false }]);
      });
    });
    await sc('PM-REG-FDI-25c', `Other project › ${SECOND_PROJECT}`, 'One and many inspectors display', async s => {
      await s.step(`First Delivery Inspection Config: read the inspector table → exactly one row here, while NRVC_Hall had more than one`, async () => {
        const rows = await inspectorRows();
        expect(rows.length, `${SECOND_PROJECT} inspectors`).toBe(1);
        expect(data.hallInspectors, 'NRVC_Hall inspectors').toBeGreaterThan(1);
      });
    });
    await sc('PM-REG-NAV-05', `Other project › ${SECOND_PROJECT}`, 'PM data is project-scoped', async s => {
      await s.step(`Project Management › "System Messages" (${SECOND_PROJECT}): open the page → page opens`, () => navigator.open('System Messages'), { critical: true });
      await s.step(`System Messages: read the message list → the NRVC_Hall message noted earlier is not listed`, async () => {
        const messages = await rowTexts();
        expect(data.firstMessage, 'NRVC_Hall message recorded').toBeTruthy();
        expect(messages.some(m => m.includes(data.firstMessage.slice(0, 40)))).toBe(false);
      });
    });
    await sc('PM-REG-BUS-10', `Other project › ${SECOND_PROJECT}`, 'History is project-specific', async s => {
      await s.step(`Project Management › "Bulk Upload Status" (${SECOND_PROJECT}): open the page → page opens`, () => navigator.open('Bulk Upload Status'), { critical: true });
      await s.step(`Bulk Upload Status: compare the first five NRVC_Hall uploads with the rows here → none of them is listed`, async () => {
        const hall = (data.uploads || []).slice(0, 5).map(r => `${r[0]}|${r[1]}|${r[4]}|${r[5]}|${r[6]}`);
        const here = (await uploads()).map(r => `${r[0]}|${r[1]}|${r[4]}|${r[5]}|${r[6]}`);
        expect(hall.filter(item => here.includes(item))).toEqual([]);
      });
      await s.step(`Header project selector: switch back to ${config.projectName} → project switched back`, () => navigator.switchProject(config.projectName));
    });
  } });

  const s = result.summary;
  expect(s.failed + s.blocked, `PM Regression: ${s.failed} failed and ${s.blocked} blocked – see the report`).toBe(0);
});
