// Procurement Log smoke – PL-SMK-001…018 (docs/functional-discovery/PL_SMOKE_SCENARIOS.md). Read-only: forms and panels
// are opened and closed, the empty Add is used only to show validation, downloads don't change data.
const { test, expect } = require('@playwright/test');
const { runPmSuite } = require('./support/pm-flow');
const { plKit } = require('./support/pl-flow');

const SUITE = 'Procurement Log Smoke';
const MODULE = 'Procurement Log';
const meta = (id, title, extra = {}) => ({ id, module: MODULE, submodule: 'Smoke', suite: SUITE, title, navPath: [MODULE], ...extra });

test.describe.configure({ mode: 'serial' });
test.setTimeout(30 * 60 * 1000);

test('Procurement Log – smoke', async ({ page, browserName }) => {
  await runPmSuite({ page, browserName, suite: SUITE, scenarios: async ({ run, config }) => {
    const k = plKit(page);
    const { main } = k;
    const btn = name => main.getByRole('button', { name, exact: true }).first();

    const login = await run.scenario(meta('PL-SMK-001', `Open Procurement Log on ${config.projectName}`, { always: true }), async s => {
      await k.signIn(s, config);
      await s.step(`Menu › "Procurement Log": click it → URL contains /procurement-log and the grid shows more than 0 items`, () => k.openLog(), { critical: true });
    });
    if (login.status !== 'Passed') { run.abort('Sign-in or Procurement Log failed'); return; }

    await run.scenario(meta('PL-SMK-002', 'Toolbar controls render'), async s => {
      await s.step(`Procurement Log toolbar → buttons "Add Submittal", "Filters", "Status", "Assign Responsible", "Bulk Delete", "Import", "Export", "Columns", date boxes "Start date"/"End date" (dd/mm/yyyy) and checkbox "Only my watched" are visible`, async () => {
        for (const name of ['Add Submittal', 'Filters', 'Status', 'Assign Responsible', 'Bulk Delete', 'Import', 'Export', 'Columns']) await expect(btn(name), name).toBeVisible();
        await expect(page.getByRole('textbox', { name: 'Start date' })).toHaveValue(/^\d{2}\/\d{2}\/\d{4}$/);
        await expect(page.getByRole('textbox', { name: 'End date' })).toHaveValue(/^\d{2}\/\d{2}\/\d{4}$/);
        await expect(page.getByRole('checkbox', { name: 'Only my watched' })).toBeVisible();
      });
    });

    await run.scenario(meta('PL-SMK-003', 'Grid columns and pagination render'), async s => {
      await s.step(`Grid header row → columns Spec Description, Schedule Id, Material Name, Submittal No, Supplier Name, EPD Exists, Date Required On Site, Status, Source, Actual Delivery Date, Responsible are present`, async () => {
        const heads = (await main.getByRole('columnheader').allInnerTexts()).map(t => t.trim());
        for (const c of ['Spec Description', 'Schedule Id', 'Material Name', 'Submittal No', 'Supplier Name', 'EPD Exists', 'Date Required On Site', 'Status', 'Source', 'Actual Delivery Date', 'Responsible']) expect(heads, c).toContain(c);
      });
      await s.step(`Below the grid → "Rows per page" text and the "Pagination" navigation are visible`, async () => {
        await expect(main.getByText('Rows per page')).toBeVisible();
        await expect(page.getByRole('navigation', { name: 'Pagination' })).toBeVisible();
      });
    });

    await run.scenario(meta('PL-SMK-004', 'Status filter options'), async s => {
      await s.step(`Click "Status" filter → options include Delivered, Not Ordered, Partial Delivery, Ordered and the three "At Risk" variants; press Escape`, async () => {
        await btn('Status').click();
        const opts = (await k.listbox().getByRole('option').allInnerTexts()).map(t => t.trim());
        expect(opts).toEqual(expect.arrayContaining(['Delivered', 'Not Ordered', 'Partial Delivery', 'Ordered', 'Not Ordered At Risk', 'Partial Delivery At Risk', 'Ordered At Risk']));
        await page.keyboard.press('Escape');
      });
    });

    await run.scenario(meta('PL-SMK-005', 'Advanced Filter panel opens and clears'), async s => {
      await s.step(`Click "Filters" → "Advanced Filter" panel opens; click "Add Condition" → a "Value" box and a "Remove" button appear`, async () => {
        await btn('Filters').click();
        await expect(page.getByRole('heading', { name: 'Advanced Filter' })).toBeVisible();
        await btn('Add Condition').click();
        await expect(page.getByRole('textbox', { name: 'Value' })).toBeVisible();
        await expect(btn('Remove')).toBeVisible();
      });
      await s.step(`Advanced Filter: click "Clear Filter" → the "Advanced Filter" panel closes`, async () => {
        await btn('Clear Filter').click();
        await expect(page.getByRole('heading', { name: 'Advanced Filter' })).toBeHidden();
      });
    });

    await run.scenario(meta('PL-SMK-006', 'Columns panel opens and closes'), async s => {
      await s.step(`Click "Columns" → "Show / hide columns" panel with "Show all" button opens; click "Columns" again → panel closes`, async () => {
        await btn('Columns').click();
        await expect(main.getByText('Show / hide columns')).toBeVisible();
        await expect(btn('Show all')).toBeVisible();
        await btn('Columns').click(); // Escape doesn't close this panel
        await expect(main.getByText('Show / hide columns')).toBeHidden();
      });
    });

    await run.scenario(meta('PL-SMK-007', 'Add Submittal form and validation'), async s => {
      const before = await k.count();
      await s.step(`Click "Add Submittal", then "Add" with all fields empty → six required messages (spec selection no., spec description, Schedule Id, submittal no., suppliers, at least one material) are shown`, async () => {
        await btn('Add Submittal').click();
        await page.getByRole('button', { name: 'Add', exact: true }).click();
        for (const m of ['Spec selection no. is required', 'Spec description is required', 'Schedule Id is required', 'Submittal no. is required', 'Suppliers is required', 'At least one material is required']) await expect(page.getByText(m)).toBeVisible();
      });
      await s.step(`Close the "Add Submittal" dialog → item count is unchanged (nothing created)`, async () => { await k.closeDialog('Add Submittal'); await expect.poll(k.count).toBe(before); });
    });

    await run.scenario(meta('PL-SMK-008', 'Bulk actions need a selection'), async s => {
      await s.step(`Click "Assign Responsible" with no row selected → toast "Select one or more rows before assigning a Responsible user."`, async () => { await btn('Assign Responsible').click(); await k.toast('Select one or more rows before assigning a Responsible user.'); });
      await s.step(`Click "Bulk Delete" with no row selected → toast "Select one or more rows before deleting."`, async () => { await btn('Bulk Delete').click(); await k.toast('Select one or more rows before deleting.'); });
    });

    await run.scenario(meta('PL-SMK-009', 'Row menu actions'), async s => {
      await s.step(`Click the last (actions) cell of the first row → menu lists Edit, Assign Responsible, Delete, Alert, Flag International; press Escape`, async () => {
        await k.rows().first().getByRole('cell').last().click();
        const items = (await page.getByRole('menuitem').allInnerTexts()).map(t => t.trim());
        expect(items).toEqual(['Edit', 'Assign Responsible', 'Delete', 'Alert', 'Flag International']);
        await page.keyboard.press('Escape');
      });
    });

    let description = '';
    await run.scenario(meta('PL-SMK-010', 'Submittal detail drawer'), async s => {
      await s.step(`Click the Spec Description cell of the first row → URL contains ?submittal= (drawer opens)`, async () => {
        description = (await k.rows().first().getByRole('cell').nth(1).innerText()).trim();
        await k.rows().first().getByRole('cell').nth(1).click();
        await expect(page).toHaveURL(/[?&]submittal=/);
      }, { critical: true });
      await s.step(`Submittal drawer → labels Spec section no., Spec Description, Material, Submittal no., Required QTY, Received QTY and button "Add Component" are visible; component table loads ("Other Actions" appears)`, async () => {
        for (const l of ['Spec section no.', 'Spec Description', 'Material', 'Submittal no.', 'Required QTY', 'Received QTY']) await expect(page.getByText(l, { exact: true }).last()).toBeVisible();
        await expect(page.getByRole('button', { name: 'Add Component' }).last()).toBeVisible();
        await page.getByText('Other Actions').first().waitFor({ timeout: 20000 }); // table fills ~1 s after "No data found"
        s.observe(`Drawer opened for "${description}"`);
      });
    });

    await run.scenario(meta('PL-SMK-011', 'Component actions and Audit Trail'), async s => {
      await s.step(`Drawer: click "Other Actions ▾" on the first component → menu lists Trigger Alert, Update Status, Audit Trail, Delete`, async () => {
        await page.getByRole('button', { name: 'Other Actions ▾' }).first().click();
        expect((await page.getByRole('menuitem').allInnerTexts()).map(t => t.trim())).toEqual(['Trigger Alert', 'Update Status', 'Audit Trail', 'Delete']);
      });
      await s.step(`Choose "Audit Trail" → panel with columns Date, Edited By, Action, Field, Old Value, New Value opens; close it with its close button`, async () => {
        await page.getByRole('menuitem', { name: 'Audit Trail' }).click();
        await expect(page.getByRole('heading', { name: 'Audit Trail' })).toBeVisible();
        for (const c of ['Date', 'Edited By', 'Action', 'Field', 'Old Value', 'New Value']) await expect(page.getByRole('columnheader', { name: c }).last()).toBeVisible();
        await page.getByRole('heading', { name: 'Audit Trail' }).locator('xpath=../../button').click();
      });
    });

    await run.scenario(meta('PL-SMK-012', 'Component view (deliveries)'), async s => {
      await s.step(`Click the item cell of the first component row → URL contains ?schedule=; buttons "+ Log Delivery", "QR Label" and delivery columns (Location, Item name, Good/Damage/Shortage QTY, Base UOM QTY, Actual Date of Delivery) are visible`, async () => {
        await page.getByRole('row').filter({ has: page.getByRole('checkbox', { name: 'Select this component' }) }).first().getByRole('cell').nth(3).click();
        await expect(page).toHaveURL(/[?&]schedule=/);
        for (const b of ['+ Log Delivery', 'QR Label']) await expect(page.getByRole('button', { name: b }).last()).toBeVisible();
        for (const c of ['Location', 'Item name', 'Good QTY', 'Damage QTY', 'Shortage QTY', 'Base UOM QTY', 'Actual Date of Delivery']) await expect(page.getByRole('columnheader', { name: c }).last()).toBeVisible();
      });
    });

    await run.scenario(meta('PL-SMK-013', 'Add Delivery form opens'), async s => {
      await s.step(`Click "+ Log Delivery" → "Add Delivery" form shows Expected Date Of Delivery*, Actual Date Of Delivery, Location*, Item Name*, Required Remaining Qty, QTY*; close the dialog`, async () => {
        await page.getByRole('button', { name: '+ Log Delivery' }).last().click();
        for (const l of ['Expected Date Of Delivery*', 'Actual Date Of Delivery', 'Location*', 'Item Name*', 'Required Remaining Qty', 'QTY*']) await expect(page.getByText(l, { exact: true }).last()).toBeVisible();
        await k.closeDialog('Add Delivery');
      });
    });

    await run.scenario(meta('PL-SMK-014', 'QR Label dialog'), async s => {
      await s.step(`Click "QR Label" → "Submittal QR" dialog with "PNG sticker", "PDF sheet" buttons and a /s/<uuid> link is visible; close it`, async () => {
        await page.getByRole('button', { name: 'QR Label', exact: true }).last().click();
        await expect(page.getByText(/^submittal qr$/i)).toBeVisible();
        for (const b of ['PNG sticker', 'PDF sheet']) await expect(page.getByRole('button', { name: b })).toBeVisible();
        await expect(page.getByText(/\/s\/[0-9a-f-]{36}/)).toBeVisible();
        await page.getByText(/^submittal qr$/i).locator('xpath=ancestor::div[.//button][1]').getByRole('button').first().click().catch(() => page.keyboard.press('Escape'));
      });
    });

    await run.scenario(meta('PL-SMK-015', 'Import menu and template downloads'), async s => {
      await s.step(`Menu › "Procurement Log" → back on the list with items shown`, () => k.openLog(), { critical: true });
      for (const [item, header] of [['Download Template', 'submittal_upload_template'], ['Download Component Template', 'component_upload_template']]) {
        await s.step(`Click "Import" › "${item}" → a file whose name contains "${header}" is downloaded`, async () => {
          await btn('Import').click();
          const dl = page.waitForEvent('download');
          await page.getByText(item, { exact: true }).click();
          expect((await dl).suggestedFilename()).toContain(header);
        });
      }
    });

    await run.scenario(meta('PL-SMK-016', 'Export downloads the report'), async s => {
      await s.step(`Click "Export" → file Submittal_Report_<yyyymmdd>.xlsx is downloaded`, async () => {
        const dl = page.waitForEvent('download');
        await btn('Export').click();
        expect((await dl).suggestedFilename()).toMatch(/^Submittal_Report_\d{8}\.xlsx$/);
      });
    });

    await run.scenario(meta('PL-SMK-017', 'Row Alert panel opens'), async s => {
      await s.step(`Press Escape, open /procurement-log, click the actions cell of the first row › "Alert" → "Add Alert" button and columns Field Type, Condition, Value, Message, Users, Status are visible; then Menu › "Procurement Log"`, async () => {
        await page.keyboard.press('Escape');
        await page.goto('/procurement-log', { waitUntil: 'domcontentloaded' });
        await expect.poll(k.count, { timeout: 30000 }).toBeGreaterThan(0);
        await k.rows().first().getByRole('cell').last().click();
        await page.getByRole('menuitem', { name: 'Alert' }).click();
        await expect(page.getByRole('button', { name: 'Add Alert' })).toBeVisible();
        for (const c of ['Field Type', 'Condition', 'Value', 'Message', 'Users', 'Status']) await expect(page.getByRole('columnheader', { name: c }).last()).toBeVisible();
        await k.openLog();
      });
    });

    await run.scenario(meta('PL-SMK-018', 'Flag International dialog opens'), async s => {
      await s.step(`Click the actions cell of the first row › "Flag International" → dialog "Flag as International Shipment" shows Manufacturer Name, Manufacturer Country *, Manufacturer City; close it`, async () => {
        await k.rows().first().getByRole('cell').last().click();
        await page.getByRole('menuitem', { name: 'Flag International' }).click();
        await expect(page.getByRole('heading', { name: 'Flag as International Shipment' })).toBeVisible();
        for (const l of ['Manufacturer Name', 'Manufacturer Country *', 'Manufacturer City']) await expect(page.getByText(l, { exact: true })).toBeVisible();
        await k.closeDialog('Flag as International Shipment');
      });
    });
  } });
});
