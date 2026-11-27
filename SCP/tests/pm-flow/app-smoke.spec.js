// Smoke for the remaining modules – INV_SCENARIOS, UM_SCENARIOS, OTHER_MODULES_SCENARIOS (FDI), DOC_SCENARIOS,
// SHP_DISCOVERY_AND_SCENARIOS, DSH_ENT_ANA_DISCOVERY_AND_SCENARIOS (docs/functional-discovery). Read-only: forms are opened
// and closed, empty submits only show validation, downloads don't change data. The Inventory activity date input is never
// clicked (SCP-DEF-002 freezes the tab).
const { test, expect } = require('@playwright/test');
const { runPmSuite } = require('./support/pm-flow');
const { plKit } = require('./support/pl-flow');

const SUITE = 'All Modules Smoke';
const meta = (id, module, title, extra = {}) => ({ id, module, submodule: 'Smoke', suite: SUITE, title, navPath: [module], ...extra });

test.describe.configure({ mode: 'serial' });
test.setTimeout(45 * 60 * 1000);

test('Remaining modules – smoke', async ({ page, browserName }) => {
  await runPmSuite({ page, browserName, suite: SUITE, scenarios: async ({ run, config }) => {
    const k = plKit(page);
    const { main } = k;
    const btn = (name, scope = main) => scope.getByRole('button', { name, exact: true }).first();
    const heads = async () => (await main.getByRole('columnheader').allInnerTexts()).map(t => t.trim().replace(/\s+/g, ' '));
    const hasCols = async cols => { await main.getByRole('columnheader').first().waitFor({ timeout: 60000 }); const h = (await heads()).map(x => x.replace(/[↕↑↓▲▼]/g, '').trim().toLowerCase()); /* sort arrows (24 Nov 2026) are not part of the name */ for (const c of cols) expect(h, c).toContain(c.toLowerCase()); };
    const rowMenu = row => row.locator('img[alt="Menu"]').first().click();
    const tabBtn = name => main.getByRole('button', { name: new RegExp(`^${name}(\\s|\\d|$)`) }).first(); // labels carry a count: "Delay Alerts406", "Alerts 99+"
    const text = (t, scope = main) => expect(scope.getByText(t, { exact: typeof t === 'string' }).first()).toBeVisible({ timeout: 30000 });
    // Menu first (as a user would); the route is the fallback when a leftover panel covers the menu.
    const open = async (route, name, group) => {
      await page.keyboard.press('Escape').catch(() => null);
      await k.menu(name, group).catch(() => page.goto(route, { waitUntil: 'domcontentloaded' }));
      if (!new RegExp(`${route}(\\?|$)`).test(new URL(page.url()).pathname)) await page.goto(route, { waitUntil: 'domcontentloaded' });
      await k.settle(1000);
      // a page load lets the app pick the newest (run-created) site in the header (OBS-INV-12): put the run site back
      if (await k.keepSite().catch(() => false)) await k.settle(1500);
    };
    const download = async (trigger, pattern) => {
      const dl = page.waitForEvent('download', { timeout: 60000 });
      dl.catch(() => null); // a failed trigger must not leave an unhandled wait that closes the browser
      await trigger();
      const name = (await dl).suggestedFilename();
      expect(name).toMatch(pattern);
      return name;
    };

    const login = await run.scenario(meta('APP-SMK-00', 'Login', `Sign in to ${config.projectName}`, { always: true }), s => k.signIn(s, config));
    if (login.status !== 'Passed') { run.abort('Sign-in failed'); return; }

    // ---------------- Inventory Management ----------------
    const INV = 'Inventory Management';
    const invCount = async () => Number(((await main.innerText()).match(/(\d+) items?/) || [])[1] || NaN);
    const invSearch = page.getByRole('textbox', { name: 'Search inventory…' });
    // 24 Nov 2026: Inventory Management was removed from the menu; /inventory-management opens the Procurement Log
    // "Inventory" tab, which shows "Couldn't load inventory." – skipped until the client answers question 2.
    const INV_BLOCKED = 'Skipped (25 Nov 2026): Inventory Management removed; its Procurement Log "Inventory" tab shows "Couldn\'t load inventory." – awaiting client question 2';
    const invOk = process.env.SCP_INV_TAB_READY ? await run.scenario(meta('INV-SMK-01', INV, 'Page loads'), async s => {
      await s.step(`Sidebar › "Inventory Management" → page opens (route /inventory-management is the fallback)`, () => open('/inventory-management', INV), { critical: true });
      await s.step(`Inventory Management → search box "Search inventory…" and buttons "Receive booking", "Upload", "Export" visible; grid lists items with columns Category, Material ID, Material Name, Inventory, UOM`, async () => {
        await expect(invSearch).toBeVisible({ timeout: 30000 });
        for (const b of ['Receive booking', 'Upload', 'Export']) await expect(btn(b)).toBeVisible();
        await expect.poll(invCount, { timeout: 30000 }).toBeGreaterThan(0);
        await hasCols(['Category', 'Material ID', 'Material Name', 'Inventory', 'UOM']);
      });
    }) : (run.skip(meta('INV-SMK-01', INV, 'Page loads'), INV_BLOCKED), { status: 'Skipped' });
    if (invOk.status === 'Passed') {
      await run.scenario(meta('INV-SMK-02', INV, 'Search by name, ID, category; no match'), async s => {
        const all = await invCount();
        await s.step(`"Search inventory…": type the material name in lower case → the row with the exact material name is listed`, async () => { await invSearch.fill(k.MATERIAL.toLowerCase()); await expect.poll(invCount).toBeGreaterThan(0); await expect(main.getByRole('cell', { name: k.MATERIAL }).first()).toBeVisible(); });
        await s.step(`"Search inventory…": enter "0001" (Material ID) → at least one item is listed`, async () => { await invSearch.fill('0001'); await expect.poll(invCount).toBeGreaterThan(0); });
        await s.step(`"Search inventory…": enter "tv" (Category) → at least one item is listed`, async () => { await invSearch.fill('tv'); await expect.poll(invCount).toBeGreaterThan(0); });
        await s.step(`"Search inventory…": enter "zz-no-such-material-zz" → item count shows 0`, async () => { await invSearch.fill('zz-no-such-material-zz'); await expect.poll(invCount).toBe(0); });
        await s.step(`"Search inventory…": clear the text → item count returns to the original total`, async () => { await invSearch.fill(''); await expect.poll(invCount).toBe(all); });
      });
      await run.scenario(meta('INV-SMK-03', INV, 'Location filter'), async s => {
        await s.step(`Location dropdown: choose the first location (not "All locations") → count line reads "N items · <location>"; then reselect "All locations"`, async () => {
          const sel = main.locator('select').first();
          const opts = (await sel.locator('option').allInnerTexts()).map(t => t.trim()).filter(t => t && t !== 'All locations');
          if (!opts.length) { s.observe('Site has no locations'); return; }
          await sel.selectOption({ label: opts[0] });
          await expect(main.getByText(new RegExp(`\\d+ items? · ${opts[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))).toBeVisible({ timeout: 15000 });
          await sel.selectOption({ label: 'All locations' });
        });
      });
      await run.scenario(meta('INV-SMK-04', INV, 'Row menu views'), async s => {
        await invSearch.fill(k.MATERIAL);
        const menuItem = async name => { await rowMenu(k.rows().filter({ hasText: k.MATERIAL }).first()); await page.getByRole('menuitem', { name, exact: true }).click(); await k.settle(1500); };
        const cols = { Actions: ['Action', 'Submittal', 'Schedule', 'Item', 'Location', 'Date', 'QTY', 'Total QTY'], Location: ['Name', 'Location Type', 'QTY'], Submittals: ['Spec section no.', 'Submittal No.', 'Spec description', 'QTY', 'Received QTY'], UOM: ['Stock Keeping Unit', 'QTY'] };
        for (const [view, c] of Object.entries(cols)) {
          await s.step(`Search the material, row "⋮" menu › "${view}" → table shows columns ${c.join(', ')}${view === 'Actions' ? ', plus "Opening Balance" and "Closing Balance"' : ''}; Escape and reopen the list`, async () => {
            await menuItem(view);
            const h = (await page.getByRole('columnheader').allInnerTexts()).map(t => t.trim().toLowerCase());
            for (const x of c) expect(h, `${view}: ${x}`).toContain(x.toLowerCase());
            if (view === 'Actions') for (const l of ['Opening Balance', 'Closing Balance']) await text(l, page);
            await page.keyboard.press('Escape'); await open('/inventory-management', INV); await invSearch.fill(k.MATERIAL);
          });
        }
      });
      await run.scenario(meta('INV-SMK-05', INV, 'Add Activity validation'), async s => {
        await s.step(`Row "⋮" › "Actions" › "Add Activity": click "ADD" with nothing filled → "is required" under Item, Action, From Location, QTY, Comments, Supplier, Subcontractor, Submittal, Schedule`, async () => {
          await rowMenu(k.rows().filter({ hasText: k.MATERIAL }).first());
          await page.getByRole('menuitem', { name: 'Actions', exact: true }).click(); await k.settle(2000);
          await page.getByRole('button', { name: 'Add Activity' }).last().click();
          await page.getByRole('button', { name: 'ADD', exact: true }).last().click();
          for (const f of ['Item', 'Action', 'From Location', 'QTY', 'Comments', 'Supplier', 'Subcontractor', 'Submittal', 'Schedule']) await expect(page.getByText(`${f} is required`).first(), f).toBeVisible();
        });
        await s.step(`Add Activity form: "To Location*" is hidden; "Choose Action" › "Internal Movement" → "To Location" field appears`, async () => {
          await expect(page.getByText('To Location*', { exact: true })).toBeHidden();
          await page.getByRole('button', { name: 'Choose Action' }).last().click();
          await k.listbox().getByRole('option', { name: 'Internal Movement', exact: true }).click();
          await expect(page.getByText(/^To Location\*?$/).last()).toBeVisible();
        });
        await s.step(`Press Escape to close the form, open /inventory-management → list shows items again`, async () => { await page.keyboard.press('Escape'); await page.goto('/inventory-management', { waitUntil: 'domcontentloaded' }); await expect.poll(invCount, { timeout: 30000 }).toBeGreaterThan(0); });
      });
      await run.scenario(meta('INV-SMK-06', INV, 'Upload dialog and template'), async s => {
        await s.step(`Inventory Management › "Upload" → dialog "Upload inventory activities" says "Nothing is saved unless all rows are valid"; the dialog "Upload" button is disabled`, async () => {
          await btn('Upload').click();
          await text('Upload inventory activities', page);
          await text(/Nothing is saved unless all rows are valid/, page);
          await expect(page.getByRole('button', { name: 'Upload', exact: true }).last()).toBeDisabled();
        });
        await s.step(`Upload dialog › "Download template" → file inventory_upload_template….xlsx downloads`, () => download(() => page.getByRole('button', { name: 'Download template' }).click(), /inventory_upload_template.*\.xlsx$/));
        await s.step(`Upload dialog › "Cancel" → dialog closes`, async () => { await page.getByRole('button', { name: 'Cancel', exact: true }).last().click(); });
      });
      await run.scenario(meta('INV-SMK-07', INV, 'Export'), async s => {
        await s.step(`Inventory Management › "Export" → file Inventory_Report_<yyyymmdd>.xlsx downloads`, () => download(() => btn('Export').click(), /^Inventory_Report_\d{8}\.xlsx$/));
      });
      await run.scenario(meta('INV-SMK-08', INV, 'Receive booking dialog'), async s => {
        await s.step(`Inventory Management › "Receive booking" → dialog says "No bookings ready to receive for this project." and "Receive" is disabled`, async () => {
          await btn('Receive booking').click();
          await text('No bookings ready to receive for this project.', page);
          await expect(page.getByRole('button', { name: 'Receive', exact: true }).last()).toBeDisabled();
        });
        await s.step(`Receive booking dialog: wait 1.5 s, click "Cancel" → no "Invalid project_id, not found in ProjectMap" message appeared (OBS-INV-6)`, async () => {
          await k.settle(1500);
          const err = await page.getByText('Invalid project_id').first().isVisible().catch(() => false);
          await page.getByRole('button', { name: 'Cancel', exact: true }).last().click({ timeout: 5000 }).catch(() => page.keyboard.press('Escape'));
          expect(err, 'Receive booking showed "Invalid project_id, not found in ProjectMap"').toBe(false);
        });
      });
    } else for (const id of ['02', '03', '04', '05', '06', '07', '08']) run.skip(meta(`INV-SMK-${id}`, INV, 'Inventory page did not load'), 'INV-SMK-01 failed');

    // ---------------- User Management + Supplier List ----------------
    const UM = 'User Management';
    await run.scenario(meta('UM-SMK-01', UM, 'User Management loads'), async s => {
      await s.step(`Sidebar › "User Management" › "User Management" → page opens`, () => open('/user-management', UM, UM), { critical: true });
      await s.step(`User Management → search box "Search users", buttons "Filter" and "Invite Users"; columns Status, Name, Email Address, Associated Organization, Platform Role; at least one user row`, async () => {
        await expect(page.getByRole('textbox', { name: /Search users/ })).toBeVisible({ timeout: 30000 });
        for (const b of ['Filter', 'Invite Users']) await expect(btn(b)).toBeVisible();
        await hasCols(['Status', 'Name', 'Email Address', 'Associated Organization', 'Platform Role']);
        await expect.poll(() => k.rows().count(), { timeout: 30000, message: 'User rows' }).toBeGreaterThan(0);
      });
    });
    await run.scenario(meta('UM-SMK-02', UM, 'User profile panel'), async s => {
      await s.step(`Click the Name cell of the first user row → "User Profile" panel with Roles, First Name, Last Name, Email, Project Role, Organization Role, buttons "Save", "Remove From Project"; Escape closes it`, async () => {
        await k.rows().first().getByRole('cell').nth(1).click();
        for (const l of ['User Profile', 'Roles', 'First Name', 'Last Name', 'Email', 'Project Role', 'Organization Role']) await text(l, page);
        for (const b of ['Save', 'Remove From Project']) await expect(page.getByRole('button', { name: b }).last()).toBeVisible();
        await page.keyboard.press('Escape');
      });
    });
    await run.scenario(meta('UM-SMK-03', UM, 'Invite dialog'), async s => {
      await s.step(`User Management › "Invite Users" → tabs "Manual entry" / "From Procore directory", "Choose Role", "Add Another User", "Cancel" visible, "Send Invites" disabled; click "Cancel"`, async () => {
        await open('/user-management', UM, UM);
        await btn('Invite Users').click();
        for (const l of ['Manual entry', 'From Procore directory']) await text(l, page);
        for (const b of ['Choose Role', 'Add Another User', 'Cancel']) await expect(page.getByRole('button', { name: b }).last()).toBeVisible();
        await expect(page.getByRole('button', { name: 'Send Invites' })).toBeDisabled();
        await page.getByRole('button', { name: 'Cancel', exact: true }).last().click();
      });
    });

    const SL = 'Supplier List';
    await run.scenario(meta('SL-SMK-01', UM, 'Supplier List loads', { navPath: [UM, SL] }), async s => {
      await s.step(`Sidebar › "User Management" › "Supplier List" → page opens`, () => open('/supplier-list', SL, UM), { critical: true });
      await s.step(`Supplier List → buttons "Add Supplier", "Bulk Map Material to Supplier", "Upload", "Export"; "N suppliers" count; columns Supplier ID, Supplier Name, Type, Source, Contact Person/Email/Phone no, Map Material`, async () => {
        for (const b of ['Add Supplier', 'Bulk Map Material to Supplier', 'Upload', 'Export']) await expect(btn(b)).toBeVisible({ timeout: 30000 });
        await text(/\d+ suppliers?/);
        await hasCols(['Supplier ID', 'Supplier Name', 'Type', 'Source', 'Contact Person', 'Contact Email', 'Contact Phone no', 'Map Material']);
      });
    });
    await run.scenario(meta('SL-SMK-02', UM, 'Add Supplier form', { navPath: [UM, SL] }), async s => {
      await s.step(`Supplier List › "Add Supplier" → form shows Supplier Name, Line 1, Line 2, Town/City, State/Region, Zipcode, Country, Contact Person, Contact Email, Default Lead Time; click "Cancel"`, async () => {
        await btn('Add Supplier').click();
        for (const l of ['Supplier Name', 'Line 1', 'Line 2', 'Town/City', 'State/Region', 'Zipcode', 'Country', 'Contact Person', 'Contact Email', 'Default Lead Time']) await text(new RegExp(`^${l.replace('/', '\\/')}`), page);
        await page.getByRole('button', { name: 'Cancel', exact: true }).last().click();
      });
    });
    await run.scenario(meta('SL-SMK-03', UM, 'Upload menu', { navPath: [UM, SL] }), async s => {
      await s.step(`Supplier List › "Upload" → menu lists "Supplier List Upload", "Supplier List Download Template", "Supplier Map Upload", "Supplier Map Download Template"; Escape closes it`, async () => {
        await btn('Upload').click();
        for (const i of ['Supplier List Upload', 'Supplier List Download Template', 'Supplier Map Upload', 'Supplier Map Download Template']) await text(i, page);
        await page.keyboard.press('Escape');
      });
    });
    await run.scenario(meta('SL-SMK-04', UM, 'Row menu', { navPath: [UM, SL] }), async s => {
      await s.step(`Supplier List: open the first row "⋮" menu → items "Edit", "Delete", "Map Material", "Promote to SSO Organisation" are visible; Escape closes it`, async () => {
        await open('/supplier-list', SL, UM);
        await rowMenu(k.rows().first());
        for (const i of ['Edit', 'Delete', 'Map Material', 'Promote to SSO Organisation']) await expect(page.getByRole('menuitem', { name: i }).or(page.getByText(i, { exact: true })).last()).toBeVisible();
        await page.keyboard.press('Escape');
      });
    });

    // ---------------- First Delivery Inspections ----------------
    await run.scenario(meta('FDI-SMK-01', 'First Delivery Inspections', 'Page loads'), async s => {
      await s.step(`Sidebar › "First Delivery Inspections" → page opens`, () => open('/first-delivery-inspections', 'First Delivery Inspections'), { critical: true });
      await s.step(`First Delivery Inspections → KPI cards Inspections, Pending, Overdue; untick "Group by material category" → columns Material, Supplier, Submittal, Delivery Date, Assigned To, Status, Procore, Actions; at least 4 filter inputs/selects; grouping ticked again`, async () => {
        for (const t of ['INSPECTIONS', 'PENDING', 'OVERDUE']) await text(new RegExp(`^${t}$`, 'i'));
        const group = main.getByRole('checkbox', { name: 'Group by material category' });
        if (await group.isChecked().catch(() => false)) { await group.uncheck(); await k.settle(2000); }
        await hasCols(['Material', 'Supplier', 'Submittal', 'Delivery Date', 'Assigned To', 'Status', 'Procore', 'Actions']);
        expect(await main.locator('select, input').count()).toBeGreaterThanOrEqual(4);
        await group.check().catch(() => null);
      });
    });

    // ---------------- Document Management ----------------
    const DOC = 'Document Management';
    const docPages = [
      ['DOC-SMK-01', '/all-documents', 'All Documents', ['Filename', 'Category', 'Material', 'Submittal', 'Size', 'Uploaded By', 'Date', 'Actions'], [/document\(s\) across this project/]],
      ['DOC-SMK-02', '/spec-documents', 'Spec Documents', ['Filename', 'Size', 'Status', 'Uploaded by', 'Uploaded', 'Spec Section No'], [/up to 60 MB/]],
      ['DOC-SMK-03', '/po-validation', 'PO Validation', [], [/Upload a Purchase Order file/, /Supports \.xlsx, \.xls, \.pdf/]],
      ['DOC-SMK-04', '/bom-validation', 'BOM Validation', [], []],
      ['DOC-SMK-05', '/epd-report', 'EPD Report', ['Submittal', 'Product', 'Manufacturer', 'GWP A1-A3', 'GWP Total', 'Status', 'Actions'], ['Scan Procore for EPDs']]
    ];
    for (const [id, route, name, cols, texts] of docPages) {
      await run.scenario(meta(id, DOC, `${name} loads`, { navPath: [DOC, name] }), async s => {
        await s.step(`Sidebar › "${DOC}" › "${name}" → page opens`, () => open(route, name, DOC), { critical: true });
        await s.step(`${name} page → texts visible: ${texts.map(t => String(t).replace(/^\/|\/i?$/g, '').replace(/\\/g, '')).join(' · ') || '-'}${cols.length ? '; columns ' + cols.join(', ') : ''}${['/po-validation', '/bom-validation'].includes(route) ? '; file input present and "Back" button visible' : ''}`, async () => {
          for (const t of texts) await text(t);
          if (cols.length) await hasCols(cols);
          if (['/po-validation', '/bom-validation'].includes(route)) { await expect(main.locator('input[type="file"]').first()).toBeAttached(); await expect(btn('Back')).toBeVisible(); }
        });
        if (route === '/all-documents') await s.step(`All Documents grid → a "View" action is visible on the rows`, async () => { await expect(main.getByRole('button', { name: 'View' }).or(main.getByText('View', { exact: true })).first()).toBeVisible(); });
      });
    }

    // ---------------- Shipments ----------------
    const SHP = 'International Shipments';
    await run.scenario(meta('SHP-SMK-01', SHP, 'International Shipments loads'), async s => {
      await s.step(`Sidebar › "International Shipments" → page opens`, () => open('/international-shipments', SHP), { critical: true });
      await s.step(`International Shipments → wait for the "Total International" tile (data loaded); tabs Risk Dashboard, Delay Alerts, Flag & Review, Shipments; tiles Total International, At Risk, Not Yet Ordered, In Transit, Delivered; columns Submittal, Material, Manufacturer, Container / AWB, ROJ, Status, Risk`, async () => {
        // A "Loading international shipments..." text can stay on screen after the data is shown, so wait for the data itself.
        await expect(page.getByText('Total International').first()).toBeVisible({ timeout: 300000 }); // 24 Nov 2026: takes 2–5 minutes
        const loaders = await page.getByText('Loading international shipments...').locator('visible=true').count();
        if (loaders) s.observe(`"Loading international shipments..." still shown ${loaders}× after the data loaded`);
        // The page can drop back to its full-page loader after showing data, so each check waits for the content to return.
        for (const t of ['Risk Dashboard', 'Delay Alerts', 'Flag & Review', 'Shipments']) await expect(tabBtn(t), t).toBeVisible({ timeout: 90000 });
        for (const t of ['Total International', 'At Risk', 'Not Yet Ordered', 'In Transit', 'Delivered']) await text(t);
        await hasCols(['Submittal', 'Material', 'Manufacturer', 'Container / AWB', 'ROJ', 'Status', 'Risk']); // since 24 Nov 2026
      });
    });
    const ESH = 'Enterprise Shipments';
    await run.scenario(meta('SHP-SMK-02', SHP, 'Enterprise Shipments loads', { navPath: ['Enterprise', ESH] }), async s => {
      await s.step(`Sidebar › "Enterprise" › "Enterprise Shipments" → page opens`, () => open('/enterprise-shipments', ESH, 'Enterprise'), { critical: true });
      await s.step(`Enterprise Shipments → "Active Delay Alerts" section; columns Project, Submittal, Manufacturer, Origin, Destination, Shipping Line, Status, ETA, Risk; "At-risk only" filter visible`, async () => {
        await text('Active Delay Alerts');
        await hasCols(['Project', 'Submittal', 'Manufacturer', 'Origin', 'Destination', 'Shipping Line', 'Status', 'ETA', 'Risk']);
        await text(/At-risk only/);
      });
    });
    await run.scenario(meta('SHP-SMK-03', SHP, 'Log shipment form', { navPath: ['Enterprise', ESH] }), async s => {
      await s.step(`Enterprise Shipments › "Log Shipment" → form shows Project, Submittal, Manufacturer name/country, Container #, Bill of lading, Shipping line, Vessel, Port of origin/destination and a "Log shipment" button; click "Cancel"`, async () => {
        await main.getByRole('button', { name: /Log Shipment/i }).first().click();
        for (const l of ['Project', 'Submittal', 'Manufacturer name', 'Manufacturer country', 'Container #', 'Bill of lading', 'Shipping line', 'Vessel', 'Port of origin', 'Port of destination']) await text(new RegExp(`^${l.replace('#', '\\#')}`, 'i'), page);
        await expect(page.getByRole('button', { name: 'Log shipment', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Cancel', exact: true }).last().click();
      });
    });

    // ---------------- Management Dashboard ----------------
    const DSH = 'Management Dashboard';
    await run.scenario(meta('DSH-SMK-01', DSH, 'Dashboard loads'), async s => {
      await s.step(`Sidebar › "Management Dashboard" → page opens`, () => open('/management-dashboard', DSH), { critical: true });
      await s.step(`Management Dashboard → "Your watched materials", "View in Procurement Log →", "Manage assignments"; tabs Alerts, Notifications, Tasks each show a count (e.g. "Alerts 99+")`, async () => {
        await text('Your watched materials');
        for (const b of ['View in Procurement Log →', 'Manage assignments']) await text(b);
        for (const t of ['Alerts', 'Notifications', 'Tasks']) await expect(tabBtn(t), t).toHaveText(new RegExp(`^${t}\\s*\\d+\\+?$`));
      });
    });
    await run.scenario(meta('DSH-SMK-02', DSH, 'Each tab lists rows'), async s => {
      for (const tab of ['Alerts', 'Notifications', 'Tasks']) {
        await s.step(`Management Dashboard › tab "${tab}" → ${tab === 'Tasks' ? 'chips Overdue / At risk / Open / Done, "Open in My Work", columns STATUS, TASK, TYPE, DUE, RAISED, ACTIONS' : 'table with columns Description, Created At'} and at least one row`, async () => {
          await tabBtn(tab).click(); await k.settle(1500);
          s.observe(`${tab} columns: ${(await main.getByRole('columnheader').allInnerTexts()).map(t => t.trim()).filter(Boolean).join(', ')}`);
          if (tab === 'Tasks') {
            // 24 Nov 2026: Tasks is a task list – chips Overdue / At risk / Open / Done, "Open in My Work",
            // columns STATUS, TASK, TYPE, DUE, RAISED, ACTIONS (only STATUS is exposed as a column header).
            for (const chip of [/^Overdue\s*\d+$/, /^At risk\s*\d+$/, /^Open\s*\d+$/, /^Done\s*\d+$/]) await expect(main.getByRole('button', { name: chip }).first(), String(chip)).toBeVisible();
            await text(/^Open in My Work/); // link text ends with an arrow
            const head = (await main.locator('table thead').last().innerText()).replace(/\s+/g, ' ');
            for (const c of ['STATUS', 'TASK', 'TYPE', 'DUE', 'RAISED', 'ACTIONS']) expect(head.toUpperCase(), `column ${c}`).toContain(c);
          } else await hasCols(['Description', 'Created At']);
          expect(await k.rows().count(), `${tab} rows`).toBeGreaterThan(0);
        });
      }
    });

    // ---------------- Enterprise ----------------
    const ENT = 'Enterprise';
    const entPages = [
      ['ENT-SMK-01', '/enterprise-view', 'Enterprise View', ['Download CSV', 'Supplier', 'Spend']],
      ['ENT-SMK-03', '/supplier-performance', 'Supplier Performance', [/Deliveries by month/i, /Project/i, /Supplier/i]],
      ['ENT-SMK-04', '/lead-time-benchmarks', 'Lead Time Benchmarks', [/Your Delivery Performance/i, /Lead Time Comparison by Category/i]]
    ];
    run.skip(meta('ENT-SMK-02', ENT, 'Supplier Inbox loads', { navPath: [ENT, 'Supplier Inbox'] }), 'Skipped (25 Nov 2026): Supplier Inbox was removed – /supplier-inbox opens My Work; awaiting client question 3 (retire or move to My Work)');
    for (const [id, route, name, texts] of entPages) {
      await run.scenario(meta(id, ENT, `${name} loads`, { navPath: [ENT, name] }), async s => {
        await s.step(`Sidebar › "${ENT}" › "${name}" → page opens`, () => open(route, name, ENT), { critical: true });
        await s.step(`${name} page → sections visible: ${texts.map(t => String(t).replace(/^\/|\/i?$/g, '')).join(' · ')}`, async () => { for (const t of texts) await text(t); });
      });
    }

    // ---------------- Analytics (APP-R1: as observed) ----------------
    const ANA = 'Analytics';
    const anaPages = [
      ['ANA-SMK-01', '/aggregate-stats', 'Aggregate Stats', [/Changes per week/i, /Top editors/i]],
      ['ANA-SMK-02', '/lead-time-analysis', 'Lead Time Analysis', [/Lead Time Comparison by Category/i]],
      ['ANA-SMK-03', '/supply-chain-intelligence', 'Supply Chain Intelligence', [/Supply chain tracker/i, /Active disruptions/i, /categories tracked/i]], // "Risk heatmap" no longer shown (24 Nov 2026)
      ['ANA-SMK-04', '/emissions-report', 'Emissions Report', [/Emissions Summary/i, /Export CSV/i]],
      ['ANA-SMK-05', '/inventory-reports', 'Inventory Reports', [/30d/]],
      ['ANA-SMK-06', '/status-report', 'Status Report', ['Generate']],
      ['ANA-SMK-07', '/subcontractor-issues', 'SubContractor Issues', [/Delivery Impacted/i]],
      ['ANA-SMK-08', '/supplier-issues', 'Supplier Issues', [/Supplier Delay Summary/i]],
      ['ANA-SMK-09', '/supplier-issues', 'TOV Analytics', [/Supplier Delay Summary/i]]
    ];
    for (const [id, route, name, texts] of anaPages) {
      await run.scenario(meta(id, ANA, `${name} loads`, { navPath: [ANA, name] }), async s => {
        await s.step(`Sidebar › "${ANA}" › "${name}" → page opens${name === 'TOV Analytics' ? ' (path only recorded)' : ' at ' + route}`, async () => {
          await page.keyboard.press('Escape').catch(() => null);
          await k.menu(name, ANA).catch(() => page.goto(route, { waitUntil: 'domcontentloaded' }));
          await k.settle(1500);
          s.observe(`${name} → ${new URL(page.url()).pathname}`);
          if (name !== 'TOV Analytics') await expect(page).toHaveURL(new RegExp(route));
        }, { critical: true });
        await s.step(`${name} page → content visible: ${texts.map(t => String(t).replace(/^\/|\/i?$/g, '')).join(' · ')}`, async () => { for (const t of texts) await text(t); });
      });
    }
  } });
});
