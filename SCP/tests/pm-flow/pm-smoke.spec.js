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
      await s.step('Open the login page', async () => {
        await page.goto(config.loginUrl, { waitUntil: 'domcontentloaded' });
        await visible(page.getByRole('heading', { name: 'Welcome To Voyage Control' }), 'Login heading');
      }, { critical: true });
      await s.step('Sign in as Project Admin', async () => {
        await loginPage.login(config.username, config.password);
        await visible(page.getByRole('heading', { name: config.username, exact: true }), 'Signed-in user on the platform page');
        await visible(page.getByRole('link', { name: 'Logout' }), 'Logout link');
      }, { critical: true });
      await s.step('Open Supply Chain Planner', async () => {
        await new PlatformChooserPage(page, config).openSupplyChainPlanner();
        await expect(page).toHaveURL(/\/management-dashboard\/?$/);
      }, { critical: true });
      await s.step(`Select project ${config.projectName}`, async () => {
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
      await s.step('Expand Project Management', async () => {
        if (!(await item('Configuration Options').isVisible().catch(() => false))) { await focus(item(PM)); await item(PM).click(); }
        await visible(item('Configuration Options'), 'Project Management entries');
      }, { critical: true });
      await s.step('Expand Integrations and Reference Data', async () => {
        for (const [group, child] of [['Integrations', 'XER Import'], ['Reference Data', 'Common UoM']]) {
          if (!(await item(child).isVisible().catch(() => false))) { await focus(item(group)); await item(group).click(); }
          await visible(item(child), `${group} entries`);
        }
      }, { critical: true });
      await s.step('Check the menu entries and order', async () => {
        const tree = await page.locator('nav').evaluate((nav, pm) => {
          const btn = [...nav.querySelectorAll('button')].find(b => b.innerText.trim() === pm);
          const list = btn.closest('li').querySelector('ul');
          const direct = [...list.children].map(li => li.querySelector('button')?.innerText.trim()).filter(Boolean);
          const kids = name => { const b = [...list.querySelectorAll('button')].find(x => x.innerText.trim() === name); const ul = b?.closest('li')?.querySelector('ul'); return ul ? [...ul.querySelectorAll('button')].map(x => x.innerText.trim()) : []; };
          return { direct, integrations: kids('Integrations'), reference: kids('Reference Data') };
        }, PM);
        expect(tree.direct).toEqual(['Integrations', 'Reference Data', 'Configuration Options', 'First Delivery Inspection Config', 'Inventory Control',
          'Material Master', 'PreShipping Checklist', 'Bulk Upload Status', 'Procurement Log Configuration', 'Site Details', 'Submittal Manager',
          'System Messages', 'Watched Materials']);
        expect(tree.integrations).toEqual(['Booking Integration', 'TheLink Integration', 'XER Import']);
        expect(tree.reference).toEqual(['Common Utilities', 'Common UoM', 'Material Category']);
        expect(tree.direct, 'Setup Wizard is hidden once setup is complete').not.toContain('Setup Wizard');
      });
    });

    // ---------- Integrations ----------
    await run.scenario(meta('PM-SMK-003', 'Integrations › Booking Integration', 'Booking Integration page loads'), async s => {
      await s.step('Open Booking Integration', () => navigator.open('Booking Integration'), { critical: true });
      await s.step('Check the page', async () => {
        await visible(main.getByRole('heading', { name: 'Booking Integration' }), 'Booking Integration heading');
        const fields = main.locator('input');
        await expect(fields.first(), 'SCP Project ID is pre-filled').toHaveValue(/\S/);
        await visible(main.getByText('Booking System Project ID', { exact: true }), 'Booking System Project ID');
        await visible(main.getByRole('button', { name: 'Submit', exact: true }), 'Submit button');
      });
    });
    run.skip(meta('PM-SMK-004', 'Integrations › TheLink Integration', 'TheLink Integration page loads'), 'Deferred: no TheLink access, out of scope for now (R7)');
    await run.scenario(meta('PM-SMK-005', 'Integrations › XER Import', 'XER Import page loads'), async s => {
      await s.step('Open XER Import', () => navigator.open('XER Import'), { critical: true });
      await s.step('Check the page', async () => {
        await visible(page.getByRole('heading', { name: 'XER Plan Import' }), 'XER Plan Import heading');
        await visible(main.getByText('Plans', { exact: true }), 'Plans list');
        await visible(main.getByRole('button', { name: 'Import Plan', exact: true }), 'Import Plan');
        await visible(main.getByText('Select a plan or import a new .xer / .xml file'), 'Import prompt');
      });
    });

    // ---------- Reference Data ----------
    await run.scenario(meta('PM-SMK-006', 'Reference Data › Common Utilities', 'Common Utilities list, search and Add form'), async s => {
      let before = '';
      await s.step('Open Common Utilities', () => navigator.open('Common Utilities'), { critical: true });
      await s.step('Check columns and count', async () => {
        expect(await headers(main.locator('table').first())).toEqual(expect.arrayContaining(['NAME', 'Type', 'Created At']));
        before = await countText();
        expect(before, 'Item count').toMatch(/\d+ items/);
      });
      const search = main.getByPlaceholder('Search utils…');
      await s.step('Search "currency"', async () => {
        await focus(search); await search.fill('currency');
        await expect(main.locator('tbody tr').filter({ hasText: 'currency_type' }).first()).toBeVisible({ timeout: 15000 });
      });
      await s.step('Clear the search', async () => {
        await search.fill('');
        await expect.poll(countText, { timeout: 15000 }).toBe(before);
      });
      await s.step('Open Add Common Util and its Type list', async () => {
        await openForm('Add Common Util', 'Add Common Utils');
        await inModal([/CommonUtil Name\s*\*/, /CommonUtil Type\s*\*/]);
        await modal().getByText('Choose CommonUtil Type', { exact: true }).click();
        const options = page.getByRole('option');
        await expect(options.filter({ hasText: /^currency_type$/ })).toHaveCount(1, { timeout: 10000 });
        await expect(options.filter({ hasText: /^fdi_status$/ })).toHaveCount(1);
        await page.keyboard.press('Escape');
      });
      await s.step('Close the form without saving', async () => {
        await navigator.closeOverlay();
        expect(await countText(), 'Item count unchanged').toBe(before);
      });
    });
    await run.scenario(meta('PM-SMK-007', 'Reference Data › Common UoM', 'Common UoM list and Add form'), async s => {
      await s.step('Open Common UoM', () => navigator.open('Common UoM'), { critical: true });
      await s.step('Check columns and search', async () => {
        expect(await headers(main.locator('table').first())).toEqual(expect.arrayContaining(['UOM Name', 'Created At']));
        await visible(main.getByPlaceholder('Search UOM…'), 'Search UOM');
      });
      await s.step('Open and close Add UOM', async () => {
        await openForm('Add UOM', 'Add UOM');
        await inModal([/UOM Name\s*\*/]);
        await visible(modal().getByRole('button', { name: 'Add', exact: true }), 'Add button');
        await navigator.closeOverlay();
      });
    });
    await run.scenario(meta('PM-SMK-008', 'Reference Data › Material Category', 'Material Category list and Add form'), async s => {
      await s.step('Open Material Category', () => navigator.open('Material Category'), { critical: true });
      await s.step('Check column and buttons', async () => {
        expect(await headers(main.locator('table').first())).toEqual(expect.arrayContaining(['Material Category Name']));
        await visible(main.getByRole('button', { name: 'Load Defaults', exact: true }), 'Load Defaults (not clicked)');
      });
      await s.step('Open and close Add Material Category', async () => {
        await openForm('Add Material Category', 'Add Material Category');
        await inModal([/^Name\s*\*$/]);
        await navigator.closeOverlay();
      });
    });

    // ---------- Configuration Options ----------
    await run.scenario(meta('PM-SMK-009', 'Configuration Options', 'Configuration Options renders current settings'), async s => {
      await s.step('Open Configuration Options', () => navigator.open('Configuration Options'), { critical: true });
      await s.step('Check the week fields', async () => {
        // Labels carry a trailing "?" help icon, so match the label text at the start.
        for (const label of ['Lead time confirmation (weeks)', 'Not ordered alert (weeks)', 'Not booked alert (weeks)']) await visible(main.getByText(label), label);
        const weeks = main.locator('input[type="text"]');
        await expect(weeks).toHaveCount(3);
        for (let i = 0; i < 3; i += 1) await expect(weeks.nth(i), 'Week value').toHaveValue(/\S/);
      });
      await s.step('Check dropdowns and toggles', async () => {
        for (const label of ['Archive Read Items After', 'Currency Type', 'GRN', 'Integration Provider', 'Estimate Subcontractor Freight Emissions', 'LLM Material Categorization', 'Pre-Shipping Checklist']) {
          // Some labels carry a trailing "?" help icon, so match on the label text rather than the exact element text.
          await visible(main.getByText(label), label);
        }
        await visible(main.getByRole('button', { name: /^\d+ days$/ }), 'Archive period value');
      });
      await s.step('Check Cancel and Save', async () => {
        await visible(main.getByRole('button', { name: 'Cancel', exact: true }), 'Cancel');
        await visible(main.getByRole('button', { name: 'Save', exact: true }), 'Save (not clicked)');
      });
    });

    // ---------- FDI Config ----------
    await run.scenario(meta('PM-SMK-010', 'First Delivery Inspection Config', 'FDI Config sections render'), async s => {
      await s.step('Open First Delivery Inspection Config', () => navigator.open('First Delivery Inspection Config'), { critical: true });
      await s.step('Check FDI Settings', async () => {
        await visible(main.getByText('FDI Settings', { exact: true }), 'FDI Settings');
        for (const label of ['Need Overall Notes to be captured', 'Enable Uploading of Photos?', 'Photos are mandatory?', 'Provide Link to Submittal Spec Documents?']) {
          await visible(main.getByText(label, { exact: true }), label);
        }
      });
      await s.step('Check Inspectors', async () => {
        const table = main.locator('table').filter({ has: page.getByText('Materials Scope') }).first();
        expect(await headers(table)).toEqual(['Name / Email', 'Role', 'Materials Scope', 'Status', 'Enabled', 'Actions']);
        await visible(main.getByRole('button', { name: 'Invite', exact: true }), 'Invite');
        await visible(main.getByRole('button', { name: 'Add Inspector', exact: true }), 'Add Inspector');
      });
      await s.step('Check Question Sets', async () => {
        await visible(main.getByRole('button', { name: 'Unassigned questions', exact: true }), 'Unassigned questions');
        await visible(main.getByRole('button', { name: 'New Question Set', exact: true }), 'New Question Set');
        await visible(main.getByRole('button', { name: /^Manage Groups/ }), 'Manage Groups');
        await visible(main.getByRole('button', { name: 'Add Question', exact: true }), 'Add Question');
      });
    });
    await run.scenario(meta('PM-SMK-011', 'First Delivery Inspection Config', 'FDI Invite form gating (no send)'), async s => {
      await s.step('Open Invite', () => openForm('Invite', 'Invite Users'), { critical: true });
      await s.step('Check the form', async () => {
        await visible(modal().getByRole('button', { name: 'Manual entry', exact: true }), 'Manual entry');
        await visible(modal().getByRole('button', { name: 'From Procore directory', exact: true }), 'From Procore directory');
        await inModal([/^Email\s*\*$/, 'Organization', /^Role\s*\*$/]);
      });
      await s.step('Send Invites is disabled while empty', async () => {
        await expect(modal().getByRole('button', { name: 'Send Invites', exact: true })).toBeDisabled();
      });
      await s.step('Close with Cancel', () => navigator.closeOverlay());
    });

    // ---------- Inventory Control ----------
    await run.scenario(meta('PM-SMK-012', 'Inventory Control', 'Inventory Control page loads'), async s => {
      await s.step('Open Inventory Control', () => navigator.open('Inventory Control'), { critical: true });
      await s.step('Check rules list or empty state', async () => {
        await visible(main.getByText('Inventory control rules', { exact: true }), 'Inventory control rules');
        const empty = await main.getByText('No rules configured').isVisible().catch(() => false);
        if (!empty) await expect(main.locator('table').first(), 'Rules list').toBeVisible();
      });
      await s.step('Open and close Add Rule', async () => {
        await openForm('Add Rule', 'Add Rule');
        await inModal([/Inventory Item\s*\*/, /Min balance at location\s*\*/, /Max balance at location\s*\*/, 'Notify on min balance breach', 'Notify on max balance breach']);
        await navigator.closeOverlay();
      });
    });

    // ---------- Material Master ----------
    await run.scenario(meta('PM-SMK-013', 'Material Master', 'Material Master list, paging and Add form'), async s => {
      await s.step('Open Material Master', () => navigator.open('Material Master'), { critical: true });
      await s.step('Check buttons and columns', async () => {
        for (const name of ['Add Material', 'Upload', 'Export']) await visible(main.getByRole('button', { name, exact: true }), name);
        expect(await headers(main.locator('table').first())).toEqual(expect.arrayContaining(['Category', 'Material ID', 'Name', 'Parent Material', 'UOM', 'Items']));
        expect(await main.locator('tbody tr').count(), 'At most 25 rows per page').toBeLessThanOrEqual(25);
      });
      await s.step('Page forward and back', async () => {
        const first = async () => (await main.locator('tbody tr').first().innerText()).replace(/\s+/g, ' ');
        const start = await first();
        const next = page.getByRole('button', { name: 'Next page' });
        await focus(next); await next.click();
        await expect.poll(first, { timeout: 15000 }).not.toBe(start);
        const previous = page.getByRole('button', { name: 'Previous page' });
        await focus(previous); await previous.click();
        await expect.poll(first, { timeout: 15000 }).toBe(start);
      });
      await s.step('Open and close Add Material', async () => {
        await openForm('Add Material', 'Add Material');
        await inModal([/^Category\s*\*$/, /^Material Name\s*\*$/, /^UOM\s*\*$/, 'Parent Material', 'Supplier']);
        await navigator.closeOverlay();
      });
    });

    // ---------- PreShipping Checklist ----------
    await run.scenario(meta('PM-SMK-014', 'PreShipping Checklist', 'PreShipping Checklist page loads'), async s => {
      await s.step('Open PreShipping Checklist', () => navigator.open('PreShipping Checklist'), { critical: true });
      await s.step('Check the questions table (no toggling)', async () => {
        expect(await headers(main.locator('table').first())).toEqual(['#', 'Question', 'Enabled']);
        await expect(main.locator('tbody tr input[type="checkbox"]').first(), 'Enabled checkbox').toBeVisible();
      });
    });

    // ---------- Bulk Upload Status ----------
    await run.scenario(meta('PM-SMK-015', 'Bulk Upload Status', 'Bulk Upload Status filters render'), async s => {
      await s.step('Open Bulk Upload Status', () => navigator.open('Bulk Upload Status'), { critical: true });
      await s.step('Check the date range', async () => {
        const dates = main.locator('input[type="text"]');
        await expect(dates.nth(0)).toHaveValue(/^\d{2}\/\d{2}\/\d{4}$/);
        await expect(dates.nth(1), 'Range ends today').toHaveValue(today());
      });
      await s.step('Check the upload types', async () => {
        const types = main.getByRole('button', { name: 'All Upload Types', exact: true });
        await focus(types); await types.click();
        const options = await page.getByRole('option').allInnerTexts();
        await page.keyboard.press('Escape');
        expect(options.map(o => o.trim())).toEqual(expect.arrayContaining(['Submittals', 'Suppliers', 'Materials', 'Sites', 'Supplier Map', 'Components', 'Inventory']));
      });
      await s.step('Check search and columns', async () => {
        await visible(main.getByPlaceholder('Search by uploader…'), 'Search by uploader');
        expect(await headers(main.locator('table').first())).toEqual(['Date', 'Added By', 'Bulk Upload Type', 'Status', 'Uploaded File', 'Success File', 'Failure File']);
      });
    });

    // ---------- Procurement Log Configuration ----------
    await run.scenario(meta('PM-SMK-016', 'Procurement Log Configuration', 'Procurement Log Configuration page loads'), async s => {
      await s.step('Open Procurement Log Configuration', () => navigator.open('Procurement Log Configuration'), { critical: true });
      await s.step('Check helper texts and locked fields', async () => {
        await visible(main.getByText(/Drag rows to reorder/), 'Drag-reorder help');
        await visible(main.getByText(/always required and can't be disabled/), 'Locked-fields help');
        for (const name of ['Material Name(Locked)', 'Submittal No(Locked)', 'Supplier Name(Locked)']) {
          const box = main.locator('tbody tr').filter({ hasText: name }).locator('input[type="checkbox"]');
          await expect(box, `${name} ticked`).toBeChecked();
          await expect(box, `${name} cannot be changed`).toBeDisabled();
        }
        await visible(main.getByRole('button', { name: 'Save Changes', exact: true }), 'Save Changes (not clicked)');
      });
      await s.step('Open and close Add Log Fields', async () => {
        await openForm('Add Log Fields', 'Add Procurement Log Fields');
        await inModal([/^Field Name\s*\*$/, /^Field Type\s*\*$/]);
        await navigator.closeOverlay();
      });
    });

    // ---------- Site Details ----------
    await run.scenario(meta('PM-SMK-017', 'Site Details', 'Site Details list and Add form'), async s => {
      await s.step('Open Site Details', () => navigator.open('Site Details'), { critical: true });
      await s.step('Check buttons and columns', async () => {
        for (const name of ['Add Site', 'Upload', 'Export']) await visible(main.getByRole('button', { name, exact: true }), name);
        expect(await headers(main.locator('table').first())).toEqual(expect.arrayContaining(['Site Type', 'Name', 'City', 'Country', 'Locations']));
      });
      await s.step('Open and close Add Site', async () => {
        await openForm('Add Site', 'Add Site');
        await inModal([/^Site Type\s*\*$/, /^Name\s*\*$/, 'Address', 'City', 'Country']);
        await navigator.closeOverlay();
      });
    });

    // ---------- Submittal Manager ----------
    await run.scenario(meta('PM-SMK-018', 'Submittal Manager', 'Submittal Manager notice'), async s => {
      await s.step('Open Submittal Manager', () => navigator.open('Submittal Manager'), { critical: true });
      await s.step('Check the repurposed notice', async () => {
        await visible(page.getByRole('heading', { name: 'Submittal Manager' }), 'Submittal Manager heading');
        await visible(main.getByText(/^This page is being repurposed\./), 'Repurposed notice');
      });
    });

    // ---------- System Messages ----------
    await run.scenario(meta('PM-SMK-019', 'System Messages', 'System Messages list and New form (no create)'), async s => {
      await s.step('Open System Messages', () => navigator.open('System Messages'), { critical: true });
      await s.step('Check the messages table', async () => {
        expect(await headers(main.locator('table').first())).toEqual(['Scope', 'Severity', 'Title / Body', 'Window', 'Status', 'Actions']);
      });
      await s.step('Open New message and check the form', async () => {
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
      await s.step('Cancel hides the form', async () => {
        const cancel = main.getByRole('button', { name: 'Cancel', exact: true }).first();
        await focus(cancel); await cancel.click();
        await expect(main.getByRole('button', { name: 'Create', exact: true })).toBeHidden({ timeout: 10000 });
      });
    });

    // ---------- Watched Materials ----------
    await run.scenario(meta('PM-SMK-020', 'Watched Materials', 'Watched Materials user view'), async s => {
      await s.step('Open Watched Materials', () => navigator.open('Watched Materials'), { critical: true });
      await s.step('Check the empty prompt', async () => {
        await visible(main.getByText('Pick a user to view or assign watches.'), 'Pick a user prompt');
      });
      await s.step('Select the signed-in user', async () => {
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
