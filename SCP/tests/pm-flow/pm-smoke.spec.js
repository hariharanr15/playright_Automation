// Project Management – Smoke (docs/functional-discovery/PM_SMOKE_SCENARIOS.md).
// Read-only: forms are opened and closed with their own Cancel / X controls; nothing is saved.
// One sign-in, one tab; scenarios follow the left-menu order so each page is opened once.
const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../../pages/login.page');
const { PlatformChooserPage } = require('../../pages/platform-chooser.page');
const { ProjectSelectorPage } = require('../../pages/project-selector.page');
const { runPmSuite } = require('./support/pm-flow');
const { focus } = require('./support/pm-visuals');
const { PM } = require('./support/pm-navigator');

const MODULE = 'Project Management';
const meta = (id, submodule, title, page = submodule.split(' › ').pop()) => ({
  id, module: MODULE, submodule, title, suite: 'Smoke',
  navPath: page ? [PM, ...submodule.split(' › ')] : [PM]
});
const headers = table => table.locator('thead th').allInnerTexts().then(list => list.map(item => item.replace(/\s+/g, ' ').trim()).filter(Boolean));
const pad = value => String(value).padStart(2, '0');
const today = () => { const d = new Date(); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };

test.describe.configure({ mode: 'serial' });
test.setTimeout(60 * 60 * 1000);

test('Project Management – Smoke', async ({ page, browserName }) => {
  const result = await runPmSuite({ page, browserName, suite: 'Smoke', scenarios: async ({ run, navigator, config }) => {
    const main = page.locator('main');
    const modal = () => navigator.overlay();
    const visible = async (locator, label) => { await expect(locator.first(), `${label} should be visible`).toBeVisible({ timeout: 15000 }); await focus(locator); };
    const inModal = async texts => { for (const text of texts) await visible(modal().getByText(text, { exact: typeof text === 'string' }), `"${text}" in the form`); };
    const openForm = async (name, title) => {
      const button = main.getByRole('button', { name, exact: true }).first();
      await visible(button, name);
      await button.click();
      await expect(modal(), `${title} form should open`).toBeVisible({ timeout: 15000 });
      if (title) await visible(modal().getByText(title, { exact: true }), `${title} title`);
    };
    const countText = async () => ((await main.innerText()).match(/(\d+)\s+(items|categories|sites|logs)/) || [])[0] || '';

    // ---------- PM-SMK-001 Login (the only sign-in of the run) ----------
    const login = await run.scenario({ ...meta('PM-SMK-001', 'Login and project', 'Login and open Supply Chain Planner on NRVC_Hall', null), always: true }, async s => {
      const loginPage = new LoginPage(page);
      await s.step(`Browser: open the login URL → heading "Welcome To Voyage Control" is shown`, async () => {
        await page.goto(config.loginUrl, { waitUntil: 'domcontentloaded' });
        await visible(page.getByRole('heading', { name: 'Welcome To Voyage Control' }), 'Login heading');
      }, { critical: true });
      await s.step(`Login page: enter the Project Admin username and password, sign in → platform page shows the user name heading and a "Logout" link`, async () => {
        await loginPage.login(config.username, config.password);
        await visible(page.getByRole('heading', { name: config.username, exact: true }), 'Signed-in user on the platform page');
        await visible(page.getByRole('link', { name: 'Logout' }), 'Logout link');
      }, { critical: true });
      await s.step(`Platform page: choose "Supply Chain Planner" → URL ends with /management-dashboard`, async () => {
        await new PlatformChooserPage(page, config).openSupplyChainPlanner();
        await expect(page).toHaveURL(/\/management-dashboard\/?$/);
      }, { critical: true });
      await s.step(`Header project selector: choose ${config.projectName} → project is in the list and selected; the site selector shows a site name`, async () => {
        const selector = new ProjectSelectorPage(page, config);
        const projects = await selector.availableProjects();
        expect(projects, 'Project list').toContain(config.projectName);
        await selector.ensureProject(config.projectName);
        await expect(selector.headerSelectors.nth(1), 'Site selector shows a site').toHaveText(/\S/, { timeout: 15000 });
      }, { critical: true });
    });
    if (login.status !== 'Passed') { run.abort('Sign-in or project selection failed (PM-SMK-001)'); return; }

    // ---------- PM-SMK-002 Menu structure ----------
    await run.scenario(meta('PM-SMK-002', 'Menu', 'Project Management menu structure', null), async s => {
      const item = label => navigator.menuItem(label);
      // Menu of the staging release of 24 Nov 2026: Project Management opens into groups (Reference Data removed).
      const GROUPS = {
        'Project Settings': ['Configuration Options', 'Procurement Log Configuration', 'First Delivery Inspection Config', 'PreShipping Checklist', 'System Messages'],
        Materials: ['Material Master', 'Material Category', 'Common UoM', 'Common Utilities', 'Watched Materials'],
        'Inventory Settings': ['Inventory Control', 'Inventory Rebuild'],
        Imports: ['Excel Import', 'Bulk Upload Status', 'Submittal Manager'],
        Integrations: ['Booking Integration', 'TheLink Integration', 'XER Import']
      };
      await s.step(`Left menu: click "Project Management" if collapsed → "Project Settings", "Sites & Storage", "NCRs", "Materials", "Inventory Settings", "Imports", "Integrations" are visible`, async () => {
        if (!(await item('Project Settings').isVisible().catch(() => false))) { await focus(item(PM)); await item(PM).click(); }
        await visible(item('Project Settings'), 'Project Management entries');
      }, { critical: true });
      await s.step(`Left menu › Project Management: expand each group → Project Settings, Materials, Inventory Settings, Imports and Integrations show their entries`, async () => {
        for (const [group, kids] of Object.entries(GROUPS)) {
          if (!(await item(kids[0]).isVisible().catch(() => false))) { await focus(item(group)); await item(group).click(); }
          await visible(item(kids[0]), `${group} entries`);
        }
      }, { critical: true });
      await s.step(`Left menu › Project Management: read the entry list → 7 entries in the expected order, each group lists its pages, no "Setup Wizard" and no "Reference Data"`, async () => {
        const tree = await page.locator('nav').evaluate((nav, { pm, groups }) => {
          const btn = [...nav.querySelectorAll('button')].find(b => b.innerText.trim() === pm);
          const list = btn.closest('li').querySelector('ul');
          const direct = [...list.children].map(li => li.querySelector('button')?.innerText.trim()).filter(Boolean);
          const kids = name => { const b = [...list.querySelectorAll('button')].find(x => x.innerText.trim() === name); const ul = b?.closest('li')?.querySelector('ul'); return ul ? [...ul.querySelectorAll('button')].map(x => x.innerText.trim()) : []; };
          return { direct, groups: Object.fromEntries(groups.map(g => [g, kids(g)])) };
        }, { pm: PM, groups: Object.keys(GROUPS) });
        s.observe(`Project Management: ${tree.direct.join(', ')}`);
        expect(tree.direct).toEqual(['Project Settings', 'Sites & Storage', 'NCRs', 'Materials', 'Inventory Settings', 'Imports', 'Integrations']);
        for (const [group, kids] of Object.entries(GROUPS)) expect(tree.groups[group], `${group} entries`).toEqual(kids);
        expect(tree.direct, 'Setup Wizard is hidden once setup is complete').not.toContain('Setup Wizard');
      });
    });

    // ---------- Integrations ----------
    await run.scenario(meta('PM-SMK-003', 'Integrations › Booking Integration', 'Booking Integration page loads'), async s => {
      await s.step(`Left menu › Project Management › Integrations › "Booking Integration" → page opens`, () => navigator.open('Booking Integration'), { critical: true });
      await s.step(`Booking Integration page: look at heading, first input, "Booking System Project ID" and "Submit" / "Update" → heading shown, SCP Project ID pre-filled, label and button visible`, async () => {
        await visible(main.getByRole('heading', { name: 'Booking Integration' }), 'Booking Integration heading');
        const fields = main.locator('input');
        await expect(fields.first(), 'SCP Project ID is pre-filled').toHaveValue(/\S/);
        await visible(main.getByText('Booking System Project ID', { exact: true }), 'Booking System Project ID');
        // The button reads "Submit" until the project is linked to a booking project, then "Update".
        await visible(main.getByRole('button', { name: /^(Submit|Update)$/ }), 'Submit / Update button');
      });
    });
    run.skip(meta('PM-SMK-004', 'Integrations › TheLink Integration', 'TheLink Integration page loads'), 'Deferred: no TheLink access, out of scope for now (R7)');
    await run.scenario(meta('PM-SMK-005', 'Integrations › XER Import', 'XER Import page loads'), async s => {
      await s.step(`Left menu › Project Management › Integrations › "XER Import" → page opens`, () => navigator.open('XER Import'), { critical: true });
      await s.step(`XER Import page: look at heading, plan list, button and prompt → "XER Plan Import" heading, "Plans" list, "Import Plan" button and "Select a plan or import a new .xer / .xml file" prompt visible`, async () => {
        await visible(page.getByRole('heading', { name: 'XER Plan Import' }), 'XER Plan Import heading');
        await visible(main.getByText('Plans', { exact: true }), 'Plans list');
        await visible(main.getByRole('button', { name: 'Import Plan', exact: true }), 'Import Plan');
        await visible(main.getByText('Select a plan or import a new .xer / .xml file'), 'Import prompt');
      });
    });

    // ---------- Reference Data ----------
    await run.scenario(meta('PM-SMK-006', 'Reference Data › Common Utilities', 'Common Utilities list, search and Add form'), async s => {
      let before = '';
      await s.step(`Left menu › Project Management › Reference Data › "Common Utilities" → page opens`, () => navigator.open('Common Utilities'), { critical: true });
      await s.step(`Common Utilities: read table headers and item count → columns NAME, Type, Created At present; count text like "N items" (remembered)`, async () => {
        expect(await headers(main.locator('table').first())).toEqual(expect.arrayContaining(['NAME', 'Type', 'Created At']));
        before = await countText();
        expect(before, 'Item count').toMatch(/\d+ items/);
      });
      const search = main.getByPlaceholder('Search utils…');
      await s.step(`Common Utilities: type "currency" in "Search utils…" → a row containing "currency_type" is shown`, async () => {
        await focus(search); await search.fill('currency');
        await expect(main.locator('tbody tr').filter({ hasText: 'currency_type' }).first()).toBeVisible({ timeout: 15000 });
      });
      await s.step(`Common Utilities: clear the search box → item count returns to the original count`, async () => {
        await search.fill('');
        await expect.poll(countText, { timeout: 15000 }).toBe(before);
      });
      await s.step(`Common Utilities: click "Add Common Util", open the "Choose CommonUtil Type" list → form "Add Common Utils" has Name and Type fields; options include "currency_type" and "fdi_status"; list closed with Escape`, async () => {
        await openForm('Add Common Util', 'Add Common Utils');
        await inModal([/CommonUtil Name\s*\*/, /CommonUtil Type\s*\*/]);
        await modal().getByText('Choose CommonUtil Type', { exact: true }).click();
        const options = page.getByRole('option');
        await expect(options.filter({ hasText: /^currency_type$/ })).toHaveCount(1, { timeout: 10000 });
        await expect(options.filter({ hasText: /^fdi_status$/ })).toHaveCount(1);
        await page.keyboard.press('Escape');
      });
      await s.step(`Add Common Utils form: close with its Cancel/X control without saving → form closes and item count is unchanged`, async () => {
        await navigator.closeOverlay();
        expect(await countText(), 'Item count unchanged').toBe(before);
      });
    });
    await run.scenario(meta('PM-SMK-007', 'Reference Data › Common UoM', 'Common UoM list and Add form'), async s => {
      await s.step(`Left menu › Project Management › Reference Data › "Common UoM" → page opens`, () => navigator.open('Common UoM'), { critical: true });
      await s.step(`Common UoM: read table headers and search box → columns "UOM Name", "Created At" present; "Search UOM…" visible`, async () => {
        expect(await headers(main.locator('table').first())).toEqual(expect.arrayContaining(['UOM Name', 'Created At']));
        await visible(main.getByPlaceholder('Search UOM…'), 'Search UOM');
      });
      await s.step(`Common UoM: click "Add UOM", then close with Cancel/X → form "Add UOM" shows "UOM Name *" and an "Add" button; nothing saved`, async () => {
        await openForm('Add UOM', 'Add UOM');
        await inModal([/UOM Name\s*\*/]);
        await visible(modal().getByRole('button', { name: 'Add', exact: true }), 'Add button');
        await navigator.closeOverlay();
      });
    });
    await run.scenario(meta('PM-SMK-008', 'Reference Data › Material Category', 'Material Category list and Add form'), async s => {
      await s.step(`Left menu › Project Management › Reference Data › "Material Category" → page opens`, () => navigator.open('Material Category'), { critical: true });
      await s.step(`Material Category: read table headers and buttons → column "Material Category Name" and "Load Defaults" button visible (not clicked)`, async () => {
        expect(await headers(main.locator('table').first())).toEqual(expect.arrayContaining(['Material Category Name']));
        await visible(main.getByRole('button', { name: 'Load Defaults', exact: true }), 'Load Defaults (not clicked)');
      });
      await s.step(`Material Category: click "Add Material Category", then close with Cancel/X → form shows "Name *"; nothing saved`, async () => {
        await openForm('Add Material Category', 'Add Material Category');
        await inModal([/^Name\s*\*$/]);
        await navigator.closeOverlay();
      });
    });

    // ---------- Configuration Options ----------
    await run.scenario(meta('PM-SMK-009', 'Configuration Options', 'Configuration Options renders current settings'), async s => {
      await s.step(`Left menu › Project Management › "Configuration Options" → page opens`, () => navigator.open('Configuration Options'), { critical: true });
      await s.step(`Configuration Options: look at the week settings → "Lead time confirmation (weeks)", "Not ordered alert (weeks)", "Not booked alert (weeks)" shown with 3 non-empty values`, async () => {
        // Labels carry a trailing "?" help icon, so match the label text at the start.
        for (const label of ['Lead time confirmation (weeks)', 'Not ordered alert (weeks)', 'Not booked alert (weeks)']) await visible(main.getByText(label), label);
        const weeks = main.locator('input[type="text"]');
        await expect(weeks).toHaveCount(3);
        for (let i = 0; i < 3; i += 1) await expect(weeks.nth(i), 'Week value').toHaveValue(/\S/);
      });
      await s.step(`Configuration Options: look at the other settings → labels "Archive Read Items After", "Currency Type", "GRN", "Integration Provider", "Estimate Subcontractor Freight Emissions", "LLM Material Categorization", "Pre-Shipping Checklist" and an "N days" button visible`, async () => {
        for (const label of ['Archive Read Items After', 'Currency Type', 'GRN', 'Integration Provider', 'Estimate Subcontractor Freight Emissions', 'LLM Material Categorization', 'Pre-Shipping Checklist']) {
          // Some labels carry a trailing "?" help icon, so match on the label text rather than the exact element text.
          await visible(main.getByText(label), label);
        }
        await visible(main.getByRole('button', { name: /^\d+ days$/ }), 'Archive period value');
      });
      await s.step(`Configuration Options: look at the footer buttons → "Cancel" and "Save" visible (Save not clicked)`, async () => {
        await visible(main.getByRole('button', { name: 'Cancel', exact: true }), 'Cancel');
        await visible(main.getByRole('button', { name: 'Save', exact: true }), 'Save (not clicked)');
      });
    });

    // ---------- FDI Config ----------
    await run.scenario(meta('PM-SMK-010', 'First Delivery Inspection Config', 'FDI Config sections render'), async s => {
      await s.step(`Left menu › Project Management › "First Delivery Inspection Config" → page opens`, () => navigator.open('First Delivery Inspection Config'), { critical: true });
      await s.step(`FDI Config › "FDI Settings": look at the options → "Need Overall Notes to be captured", "Enable Uploading of Photos?", "Photos are mandatory?", "Provide Link to Submittal Spec Documents?" visible`, async () => {
        await visible(main.getByText('FDI Settings', { exact: true }), 'FDI Settings');
        for (const label of ['Need Overall Notes to be captured', 'Enable Uploading of Photos?', 'Photos are mandatory?', 'Provide Link to Submittal Spec Documents?']) {
          await visible(main.getByText(label, { exact: true }), label);
        }
      });
      await s.step(`FDI Config › Inspectors: read table headers and buttons → Name / Email, Role, Materials Scope, Status, Enabled, Actions; "Invite" and "Add Inspector" visible`, async () => {
        const table = main.locator('table').filter({ has: page.getByText('Materials Scope') }).first();
        expect(await headers(table)).toEqual(['Name / Email', 'Role', 'Materials Scope', 'Status', 'Enabled', 'Actions']);
        await visible(main.getByRole('button', { name: 'Invite', exact: true }), 'Invite');
        await visible(main.getByRole('button', { name: 'Add Inspector', exact: true }), 'Add Inspector');
      });
      await s.step(`FDI Config › Question Sets: look at the buttons → "Unassigned questions", "New Question Set", "Manage Groups", "Add Question" visible`, async () => {
        await visible(main.getByRole('button', { name: 'Unassigned questions', exact: true }), 'Unassigned questions');
        await visible(main.getByRole('button', { name: 'New Question Set', exact: true }), 'New Question Set');
        await visible(main.getByRole('button', { name: /^Manage Groups/ }), 'Manage Groups');
        await visible(main.getByRole('button', { name: 'Add Question', exact: true }), 'Add Question');
      });
    });
    await run.scenario(meta('PM-SMK-011', 'First Delivery Inspection Config', 'FDI Invite form gating (no send)'), async s => {
      await s.step(`First Delivery Inspection Config: click "Invite" → "Invite Users" form opens`, () => openForm('Invite', 'Invite Users'), { critical: true });
      await s.step(`Invite Users form: look at the options and fields → "Manual entry", "From Procore directory", "Email *", "Organization", "Role *" visible`, async () => {
        await visible(modal().getByRole('button', { name: 'Manual entry', exact: true }), 'Manual entry');
        await visible(modal().getByRole('button', { name: 'From Procore directory', exact: true }), 'From Procore directory');
        await inModal([/^Email\s*\*$/, 'Organization', /^Role\s*\*$/]);
      });
      await s.step(`Invite Users form (all fields empty): look at "Send Invites" → button is disabled`, async () => {
        await expect(modal().getByRole('button', { name: 'Send Invites', exact: true })).toBeDisabled();
      });
      await s.step(`Invite Users form: close with Cancel → form closes, nothing sent`, () => navigator.closeOverlay());
    });

    // ---------- Inventory Control ----------
    await run.scenario(meta('PM-SMK-012', 'Inventory Control', 'Inventory Control page loads'), async s => {
      await s.step(`Left menu › Project Management › "Inventory Control" → page opens`, () => navigator.open('Inventory Control'), { critical: true });
      await s.step(`Inventory Control: look at the rules area → "Inventory control rules" shown, with a rules table or the "No rules configured" message`, async () => {
        await visible(main.getByText('Inventory control rules', { exact: true }), 'Inventory control rules');
        const empty = await main.getByText('No rules configured').isVisible().catch(() => false);
        if (!empty) await expect(main.locator('table').first(), 'Rules list').toBeVisible();
      });
      await s.step(`Inventory Control: click "Add Rule", then close with Cancel/X → form shows Inventory Item *, Min/Max balance at location *, "Notify on min/max balance breach"; nothing saved`, async () => {
        await openForm('Add Rule', 'Add Rule');
        await inModal([/Inventory Item\s*\*/, /Min balance at location\s*\*/, /Max balance at location\s*\*/, 'Notify on min balance breach', 'Notify on max balance breach']);
        await navigator.closeOverlay();
      });
    });

    // ---------- Material Master ----------
    await run.scenario(meta('PM-SMK-013', 'Material Master', 'Material Master list, paging and Add form'), async s => {
      await s.step(`Left menu › Project Management › "Material Master" → page opens`, () => navigator.open('Material Master'), { critical: true });
      await s.step(`Material Master: look at buttons, headers and rows → "Add Material", "Upload", "Export" visible; columns Category, Material ID, Name, Parent Material, UOM, Items; at most 25 rows`, async () => {
        for (const name of ['Add Material', 'Upload', 'Export']) await visible(main.getByRole('button', { name, exact: true }), name);
        expect(await headers(main.locator('table').first())).toEqual(expect.arrayContaining(['Category', 'Material ID', 'Name', 'Parent Material', 'UOM', 'Items']));
        expect(await main.locator('tbody tr').count(), 'At most 25 rows per page').toBeLessThanOrEqual(25);
      });
      await s.step(`Material Master: click "Next page", then "Previous page" → first row changes after Next and returns to the original after Previous`, async () => {
        const first = async () => (await main.locator('tbody tr').first().innerText()).replace(/\s+/g, ' ');
        const start = await first();
        const next = page.getByRole('button', { name: 'Next page' });
        await focus(next); await next.click();
        await expect.poll(first, { timeout: 15000 }).not.toBe(start);
        const previous = page.getByRole('button', { name: 'Previous page' });
        await focus(previous); await previous.click();
        await expect.poll(first, { timeout: 15000 }).toBe(start);
      });
      await s.step(`Material Master: click "Add Material", then close with Cancel/X → form shows Category *, Material Name *, UOM *, Parent Material, Supplier; nothing saved`, async () => {
        await openForm('Add Material', 'Add Material');
        await inModal([/^Category\s*\*$/, /^Material Name\s*\*$/, /^UOM\s*\*$/, 'Parent Material', 'Supplier']);
        await navigator.closeOverlay();
      });
    });

    // ---------- PreShipping Checklist ----------
    await run.scenario(meta('PM-SMK-014', 'PreShipping Checklist', 'PreShipping Checklist page loads'), async s => {
      await s.step(`Left menu › Project Management › "PreShipping Checklist" → page opens`, () => navigator.open('PreShipping Checklist'), { critical: true });
      await s.step(`PreShipping Checklist: read table headers and first row → columns #, Question, Enabled, Count, Actions; an "Enabled" checkbox is visible (not toggled)`, async () => {
        expect(await headers(main.locator('table').first())).toEqual(['#', 'Question', 'Enabled', 'Count', 'Actions']);
        await expect(main.locator('tbody tr input[type="checkbox"]').first(), 'Enabled checkbox').toBeVisible();
      });
    });

    // ---------- Bulk Upload Status ----------
    await run.scenario(meta('PM-SMK-015', 'Bulk Upload Status', 'Bulk Upload Status filters render'), async s => {
      await s.step(`Left menu › Project Management › "Bulk Upload Status" → page opens`, () => navigator.open('Bulk Upload Status'), { critical: true });
      await s.step(`Bulk Upload Status: read the two date fields → start date is dd/mm/yyyy and end date equals today`, async () => {
        const dates = main.locator('input[type="text"]');
        await expect(dates.nth(0)).toHaveValue(/^\d{2}\/\d{2}\/\d{4}$/);
        await expect(dates.nth(1), 'Range ends today').toHaveValue(today());
      });
      await s.step(`Bulk Upload Status: open the "All Upload Types" dropdown → options include Submittals, Suppliers, Materials, Sites, Supplier Map, Components, Inventory; closed with Escape`, async () => {
        const types = main.getByRole('button', { name: 'All Upload Types', exact: true });
        await focus(types); await types.click();
        const options = await page.getByRole('option').allInnerTexts();
        await page.keyboard.press('Escape');
        expect(options.map(o => o.trim())).toEqual(expect.arrayContaining(['Submittals', 'Suppliers', 'Materials', 'Sites', 'Supplier Map', 'Components', 'Inventory']));
      });
      await s.step(`Bulk Upload Status: look at search and table headers → "Search by uploader…" visible; columns Date, Added By, Bulk Upload Type, Status, Uploaded File, Success File, Failure File`, async () => {
        await visible(main.getByPlaceholder('Search by uploader…'), 'Search by uploader');
        expect(await headers(main.locator('table').first())).toEqual(['Date', 'Added By', 'Bulk Upload Type', 'Status', 'Uploaded File', 'Success File', 'Failure File']);
      });
    });

    // ---------- Procurement Log Configuration ----------
    await run.scenario(meta('PM-SMK-016', 'Procurement Log Configuration', 'Procurement Log Configuration page loads'), async s => {
      await s.step(`Left menu › Project Management › "Procurement Log Configuration" → page opens`, () => navigator.open('Procurement Log Configuration'), { critical: true });
      await s.step(`Procurement Log Configuration: look at help texts and locked rows → "Drag rows to reorder" and "always required and can't be disabled" texts; "Material Name(Locked)", "Submittal No(Locked)", "Supplier Name(Locked)" ticked and disabled; "Save Changes" visible`, async () => {
        await visible(main.getByText(/Drag rows to reorder/), 'Drag-reorder help');
        await visible(main.getByText(/always required and can't be disabled/), 'Locked-fields help');
        for (const name of ['Material Name(Locked)', 'Submittal No(Locked)', 'Supplier Name(Locked)']) {
          const box = main.locator('tbody tr').filter({ hasText: name }).locator('input[type="checkbox"]');
          await expect(box, `${name} ticked`).toBeChecked();
          await expect(box, `${name} cannot be changed`).toBeDisabled();
        }
        await visible(main.getByRole('button', { name: 'Save Changes', exact: true }), 'Save Changes (not clicked)');
      });
      await s.step(`Procurement Log Configuration: click "Add Log Fields", then close with Cancel/X → "Add Procurement Log Fields" form shows Field Name *, Field Type *; nothing saved`, async () => {
        await openForm('Add Log Fields', 'Add Procurement Log Fields');
        await inModal([/^Field Name\s*\*$/, /^Field Type\s*\*$/]);
        await navigator.closeOverlay();
      });
    });

    // ---------- Site Details ----------
    await run.scenario(meta('PM-SMK-017', 'Site Details', 'Site Details list and Add form'), async s => {
      await s.step(`Left menu › Project Management › "Sites & Storage" → page opens`, () => navigator.open('Site Details'), { critical: true });
      // Sites & Storage since 24 Nov 2026: site cards instead of a table; "Bulk upload" and "Sites report" replace Upload / Export.
      await s.step(`Sites & Storage: look at the toolbar and the list → "Search sites…", "<n> sites", buttons "Bulk upload", "Sites report", "Add site"; each site card has a "⋯" menu`, async () => {
        await visible(main.getByPlaceholder('Search sites…'), 'Search sites');
        await visible(main.getByText(/^\d+ sites?$/), 'Site count');
        for (const name of [/^Bulk upload/, /^Sites report$/, /^Add site$/]) await visible(main.getByRole('button', { name }), String(name));
        await visible(main.getByRole('button', { name: /^Actions for site / }), 'Site card menu');
      });
      await s.step(`Sites & Storage: click "Add site", then close with Cancel/X → form "Add Site" shows Site Type *, Name *, Address, City, Country; nothing saved`, async () => {
        await openForm('Add site', 'Add Site');
        await inModal([/^Site Type\s*\*$/, /^Name\s*\*$/, 'Address', 'City', 'Country']);
        await navigator.closeOverlay();
      });
    });

    // ---------- Submittal Manager ----------
    await run.scenario(meta('PM-SMK-018', 'Submittal Manager', 'Submittal Manager notice'), async s => {
      await s.step(`Left menu › Project Management › "Submittal Manager" → page opens`, () => navigator.open('Submittal Manager'), { critical: true });
      await s.step(`Submittal Manager: look at heading and notice → "Submittal Manager" heading and "This page is being repurposed." notice visible`, async () => {
        await visible(page.getByRole('heading', { name: 'Submittal Manager' }), 'Submittal Manager heading');
        await visible(main.getByText(/^This page is being repurposed\./), 'Repurposed notice');
      });
    });

    // ---------- System Messages ----------
    await run.scenario(meta('PM-SMK-019', 'System Messages', 'System Messages list and New form (no create)'), async s => {
      await s.step(`Left menu › Project Management › "System Messages" → page opens`, () => navigator.open('System Messages'), { critical: true });
      await s.step(`System Messages: read table headers → Scope, Severity, Title / Body, Window, Status, Actions`, async () => {
        expect(await headers(main.locator('table').first())).toEqual(['Scope', 'Severity', 'Title / Body', 'Window', 'Status', 'Actions']);
      });
      await s.step(`System Messages: click "New message" → form shows Scope, Severity, Title (optional), Body (markdown), 0/2000, Preview, Starts at, Ends at, Active, "Create"; Severity has Info/Warning, Scope has "Project (this project only)"`, async () => {
        const create = main.getByRole('button', { name: 'Create', exact: true });
        const button = main.getByRole('button', { name: 'New message', exact: true }).first();
        await focus(button); await button.click();
        await visible(create, 'Create (not clicked)');
        for (const text of ['Scope', 'Severity', 'Title (optional)', 'Body (markdown)', '0/2000', 'Preview', 'Starts at', 'Ends at', 'Active']) {
          await visible(main.getByText(text, { exact: true }), text);
        }
        // Scope and Severity are dropdowns: their values are options, not visible text.
        const options = (await main.locator('select option').allInnerTexts()).map(o => o.trim());
        expect(options, 'Severity options').toEqual(expect.arrayContaining(['Info', 'Warning']));
        expect(options, 'Scope option').toEqual(expect.arrayContaining(['Project (this project only)']));
      });
      await s.step(`System Messages new-message form: click "Cancel" → form closes ("Create" hidden), nothing created`, async () => {
        const cancel = main.getByRole('button', { name: 'Cancel', exact: true }).first();
        await focus(cancel); await cancel.click();
        await expect(main.getByRole('button', { name: 'Create', exact: true })).toBeHidden({ timeout: 10000 });
      });
    });

    // ---------- Watched Materials ----------
    await run.scenario(meta('PM-SMK-020', 'Watched Materials', 'Watched Materials user view'), async s => {
      await s.step(`Left menu › Project Management › "Watched Materials" → page opens`, () => navigator.open('Watched Materials'), { critical: true });
      await s.step(`Watched Materials: look at the page before choosing a user → "Pick a user to view or assign watches." shown`, async () => {
        await visible(main.getByText('Pick a user to view or assign watches.'), 'Pick a user prompt');
      });
      await s.step(`Watched Materials: pick the signed-in user in the user dropdown (else first real option) → table headers Type, Value, Notifications, Assigned by, Created; "Add watch" visible (not clicked)`, async () => {
        const name = await page.evaluate(() => {
          const info = JSON.parse(localStorage.getItem('userInfo') || '{}');
          return [info.first_name || info.firstName, info.last_name || info.lastName].filter(Boolean).join(' ') || info.name || '';
        });
        const select = main.locator('select').first();
        await focus(select);
        const labels = await select.locator('option').allInnerTexts();
        const match = labels.find(label => name && label.trim().toLowerCase() === name.toLowerCase()) || labels.find(label => !/^Select a user/i.test(label));
        await select.selectOption({ label: match });
        expect(await headers(main.locator('table').first())).toEqual(expect.arrayContaining(['Type', 'Value', 'Notifications', 'Assigned by', 'Created']));
        await visible(main.getByRole('button', { name: 'Add watch', exact: true }), 'Add watch (not clicked)');
      });
    });
  } });

  const s = result.summary;
  expect(s.failed + s.blocked, `PM Smoke: ${s.failed} failed and ${s.blocked} blocked – see the report`).toBe(0);
});
