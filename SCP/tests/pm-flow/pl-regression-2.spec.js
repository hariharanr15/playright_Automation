// Procurement Log regression, part 2 – observed (O) scenarios of docs/functional-discovery/PL_REGRESSION_SCENARIOS.md
// not covered by part 1. Creates run-tagged records (approved); deletes only records created by this run.
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { test, expect } = require('@playwright/test');
const { runPmSuite } = require('./support/pm-flow');
const { plKit, MATERIAL, SUPPLIER } = require('./support/pl-flow');

const SUITE = 'Procurement Log Regression 2';
const MODULE = 'Procurement Log';
const meta = (id, title, kind, extra = {}) => ({ id, module: MODULE, submodule: kind, suite: SUITE, title: `[${kind}] ${title}`, navPath: [MODULE], ...extra });
const stamp = new Date();
const RUN = `PLS${stamp.toISOString().replace(/\D/g, '').slice(2, 12)}`;
const num = n => `${stamp.toISOString().replace(/\D/g, '').slice(0, 12)}${String(n).padStart(2, '0')}`;
const today = new Date(stamp.getFullYear(), stamp.getMonth(), stamp.getDate());
const plusDays = d => new Date(today.getFullYear(), today.getMonth(), today.getDate() + d);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-reg2-'));

// Minimal valid PDF for the PO upload.
function writePdf(file) {
  const stream = 'BT /F1 12 Tf 20 60 Td (Automation PO) Tj ET';
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 120] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let out = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  fs.writeFileSync(file, out);
}

// Minimal one-sheet xlsx with inline strings (zip with stored entries; no dependency needed).
function writeXlsx(file, rows) {
  const esc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const col = i => { let s = ''; i += 1; while (i) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; };
  const sheet = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => v === '' || v == null ? '' : typeof v === 'number'
    ? `<c r="${col(ci)}${ri + 1}"><v>${v}</v></c>` : `<c r="${col(ci)}${ri + 1}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`).join('')}</row>`).join('');
  const files = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Template" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheet}</sheetData></worksheet>`
  };
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const local = []; const central = []; let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text); const comp = zlib.deflateRawSync(data); const nm = Buffer.from(name);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(8, 8); h.writeUInt32LE(crc(data), 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(nm.length, 26);
    local.push(h, nm, comp);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(8, 10); c.writeUInt32LE(crc(data), 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(offset, 42);
    central.push(c, nm); offset += h.length + nm.length + comp.length;
  }
  const cd = Buffer.concat(central); const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  fs.writeFileSync(file, Buffer.concat([...local, cd, end]));
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(60 * 60 * 1000);

test('Procurement Log – regression part 2', async ({ page, browserName }) => {
  await runPmSuite({ page, browserName, suite: SUITE, scenarios: async ({ run, config }) => {
    const k = plKit(page);
    const { main } = k;
    const btn = name => main.getByRole('button', { name, exact: true }).first();
    // A status list left open (Escape does not always close it) covers the "Filters" button; close it before the next click.
    const closeOpenList = async () => {
      for (let i = 0; i < 3 && await k.listbox().isVisible().catch(() => false); i++) {
        await page.keyboard.press('Escape'); await k.settle(300);
        if (await k.listbox().isVisible().catch(() => false)) await page.getByRole('heading', { name: 'Procurement Log' }).first().click();
      }
    };
    const E = { spec: `${RUN}-SPEC-E`, description: `${RUN} edit flag alert`, scheduleId: num(1), number: `${RUN}-SUB-E` };
    const N = { spec: `${RUN}-SPEC-N`, description: `${RUN} not ordered`, scheduleId: num(2), number: `${RUN}-SUB-N` };
    const X = { spec: `${RUN}-SPEC-X`, description: `${RUN} row delete`, scheduleId: num(3), number: `${RUN}-SUB-X` };
    const IMP = { spec: `${RUN}-SPEC-I`, description: `${RUN} import`, scheduleId: num(4), number: `${RUN}-SUB-I` };
    const header = async () => (await main.getByRole('columnheader').allInnerTexts()).map(t => t.trim());
    const cellOf = async (row, col) => (await row.getByRole('cell').allInnerTexts())[(await header()).indexOf(col)]?.trim();

    const login = await run.scenario(meta('PL-REG2-SETUP', `Sign in on ${config.projectName}`, 'Setup', { always: true }), async s => {
      await k.signIn(s, config);
      await s.step(`Left menu › "Procurement Log" → Procurement Log page opens and the list shows items`, () => k.openLog(), { critical: true });
      await s.step(`Procurement Log › "Add Submittal": create three run submittals (${E.number}, ${N.number}, ${X.number}) with supplier "LG" and the default material → toast "Submittal added successfully" for each`, async () => {
        for (const d of [E, N, X]) { await k.addSubmittal(d); await k.toast('Submittal added successfully'); }
      }, { critical: true });
      s.observe(`Run tag ${RUN}`);
    });
    if (login.status !== 'Passed') { run.abort('Setup failed'); return; }

    // ---------- 1. Search and filters ----------
    await run.scenario(meta('PL-REG-LST-04', 'Search runs on Enter and ignores case', 'Positive'), async s => {
      await s.step(`Search box "Search submittals…": type the run tag in lower case, press Enter → exactly 3 items listed (search ignores case)`, async () => { await k.search(RUN.toLowerCase()); await expect.poll(k.count).toBe(3); });
    });
    await run.scenario(meta('PL-REG-LST-05', 'Clearing the search restores the list', 'Positive'), async s => {
      await s.step(`Search box "Search submittals…": clear the text, press Enter → list shows all items again (more than 3)`, async () => { await k.search(''); await expect.poll(k.count).toBeGreaterThan(3); });
    });
    await run.scenario(meta('PL-REG-LST-06', 'Status filter shows only the ticked status', 'Positive'), async s => {
      await s.step(`Click "Status" filter, tick "Delivered", close the list → every row shows Status "Delivered" and the button reads "Status1"`, async () => {
        await btn('Status').click(); await k.listbox().getByRole('option', { name: 'Delivered', exact: true }).click(); await page.keyboard.press('Escape'); await k.settle(1500);
        const col = (await header()).indexOf('Status');
        const vals = await k.rows().evaluateAll((rs, i) => rs.map(r => r.querySelectorAll('td')[i]?.innerText.trim()), col);
        expect(vals.length).toBeGreaterThan(0);
        expect(new Set(vals)).toEqual(new Set(['Delivered']));
        await expect(main.getByRole('button', { name: /^Status1/ })).toBeVisible();
      });
      await s.step(`Click "Status1" filter, untick "Delivered", close the list → filter removed`, async () => { await main.getByRole('button', { name: /^Status1/ }).click(); await k.listbox().getByRole('option', { name: 'Delivered', exact: true }).click(); await page.keyboard.press('Escape'); await k.settle(1000); await closeOpenList(); });
    });
    await run.scenario(meta('PL-REG-LST-07', 'Advanced Filter Contains ignores case', 'Positive'), async s => {
      let upper;
      const apply = async value => {
        await closeOpenList(); await btn('Filters').click(); await btn('Add Condition').click();
        const row = page.getByRole('textbox', { name: 'Value' }).locator('xpath=..');
        await row.locator('select').nth(1).selectOption('Supplier Name'); await row.locator('select').nth(2).selectOption('Contains');
        await page.getByRole('textbox', { name: 'Value' }).fill(value); await btn('Apply Filter').click(); await k.settle(1500);
        return k.count();
      };
      await s.step(`"Filters" › "Add Condition": field "Supplier Name", operator "Contains", value ${SUPPLIER.toUpperCase()}, "Apply Filter" → at least 1 item listed`, async () => { upper = await apply(SUPPLIER.toUpperCase()); expect(upper).toBeGreaterThan(0); });
      await s.step(`Click "Clear Filter", then repeat the same condition with the supplier in lower case, "Apply Filter" → same item count as with upper case`, async () => {
        await btn('Clear Filter').click(); await k.settle(1000);
        expect(await apply(SUPPLIER.toLowerCase())).toBe(upper);
      });
    });
    await run.scenario(meta('PL-REG-LST-08', 'Clear Filter closes the panel and restores the list', 'Positive'), async s => {
      await s.step(`Advanced Filter panel: click "Clear Filter" → panel closes and the list shows all items again (more than 3)`, async () => {
        await btn('Clear Filter').click();
        await expect(page.getByRole('heading', { name: 'Advanced Filter' })).toBeHidden();
        await expect.poll(k.count).toBeGreaterThan(3);
      });
    });
    await run.scenario(meta('PL-REG-LST-12', 'Hide and show a column', 'Positive'), async s => {
      await s.step(`Click "Columns", untick "Source" → column "Source" disappears; click "Show all" → column "Source" is back; close "Columns"`, async () => {
        await btn('Columns').click();
        await page.getByRole('checkbox', { name: 'Source', exact: true }).uncheck();
        await expect(main.getByRole('columnheader', { name: 'Source' })).toHaveCount(0);
        await btn('Show all').click();
        await expect(main.getByRole('columnheader', { name: 'Source' })).toHaveCount(1);
        await btn('Columns').click();
      });
    });
    await run.scenario(meta('PL-REG-LST-15', 'Rows per page 100 shows all rows on one page', 'Positive'), async s => {
      await s.step(`Rows-per-page selector at the bottom: choose "100" → number of rows shown equals the item count (max 100)`, async () => {
        await main.getByRole('combobox').filter({ hasText: /^\d+$/ }).last().click();
        await page.getByRole('option', { name: '100', exact: true }).click(); await k.settle(1500);
        const n = await k.count();
        expect(await k.rows().count()).toBe(Math.min(n, 100));
      });
    });
    await run.scenario(meta('PL-REG-LST-16', 'Filters reset on reload; project kept', 'Positive'), async s => {
      await s.step(`Search the run tag, then reload the browser page → search box is empty, list is unfiltered (more than 3 items) and the project button still shows the project name`, async () => {
        await k.search(RUN);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect.poll(k.count, { timeout: 30000 }).toBeGreaterThan(3);
        await expect(page.getByRole('textbox', { name: 'Search submittals…' })).toHaveValue('');
        await expect(page.getByRole('button', { name: new RegExp(config.projectName) }).first()).toBeVisible();
      });
    });

    // ---------- 2. Add Submittal ----------
    await run.scenario(meta('PL-REG-ADD-04', 'Materials need a supplier first', 'Negative'), async s => {
      await s.step(`"Add Submittal": click "Choose Materials" without choosing a supplier → dropdown shows "No options."; close it`, async () => {
        await btn('Add Submittal').click();
        await page.getByRole('button', { name: 'Choose Materials' }).click();
        await expect(page.getByText('No options.')).toBeVisible();
        await page.keyboard.press('Escape');
      });
    });
    await run.scenario(meta('PL-REG-ADD-05', 'Supplier filters materials (searchable)', 'Positive'), async s => {
      await s.step(`"Add Submittal": "Choose Suppliers" → select supplier, then "Choose Materials" → a "Search options" box and the supplier material are offered; close the dropdown and the dialog`, async () => {
        await k.pick('Choose Suppliers', SUPPLIER);
        await page.getByRole('button', { name: 'Choose Materials' }).click();
        await expect(page.getByRole('textbox', { name: 'Search options' })).toBeVisible();
        await expect(k.listbox().getByRole('option', { name: MATERIAL, exact: true })).toBeVisible();
        await page.keyboard.press('Escape');
        await k.closeDialog('Add Submittal');
      });
    });
    await run.scenario(meta('PL-REG-ADD-07', 'Skip for Now stores "Pending"', 'Positive'), async s => {
      await s.step(`"Add Submittal": click the first "Skip for Now" (Spec selection no.) → the field shows "Pending"; close the dialog`, async () => {
        await btn('Add Submittal').click();
        await page.getByRole('button', { name: 'Skip for Now' }).first().click();
        await expect(page.getByRole('heading', { name: 'Add Submittal' }).locator('xpath=../..').getByRole('textbox').first()).toHaveValue('Pending');
        await k.closeDialog('Add Submittal');
      });
    });
    await run.scenario(meta('PL-REG-ADD-06', 'Multiple materials, first picked is primary', 'Positive'), async s => {
      const other = process.env.SCP_PL_MATERIAL_2 || '1.2L Kappa Engine';
      const M = { spec: `${RUN}-SPEC-M`, description: `${RUN} multi material`, scheduleId: num(5), number: `${RUN}-SUB-M` };
      await s.step(`"Add Submittal": fill the run submittal ${M.number} with supplier "LG" and two materials (default plus second material), click "Add" → toast "Submittal added successfully"`, async () => { await k.addSubmittal({ ...M, materials: [MATERIAL, other] }); await k.toast('Submittal added successfully'); });
      await s.step(`Search ${M.number} → row shows the first material followed by "+1"; open the submittal → "(primary)" label sits next to the first material; return to Procurement Log`, async () => {
        await k.search(M.number);
        await expect(k.rows().first()).toContainText(new RegExp(`${MATERIAL}\\s*\\+1`));
        await k.openSubmittal(M.description);
        await expect(page.getByText('(primary)').first()).toBeVisible();
        await expect(page.getByText('(primary)').first().locator('xpath=..')).toContainText(MATERIAL);
        await k.openLog();
      });
    });

    // ---------- 3. Edit, flag, row delete ----------
    await run.scenario(meta('PL-REG-EDT-01', 'Edit submittal description', 'Positive'), async s => {
      await s.step(`Search ${E.number}, row action menu (last cell) › "Edit": change description to the existing text plus " edited", click "Update" → edited description shown in the list row`, async () => {
        await k.search(E.number);
        await k.rows().first().getByRole('cell').last().click();
        await page.getByRole('menuitem', { name: 'Edit' }).click();
        const m = page.getByRole('heading', { name: 'Edit Submittal' }).locator('xpath=../..');
        await expect(m.getByRole('textbox').nth(1)).not.toHaveValue('', { timeout: 15000 }); // wait for the record to load
        E.description = E.description.endsWith(' edited') ? E.description : `${E.description} edited`;
        await m.getByRole('textbox').nth(1).fill(E.description);
        await m.getByRole('button', { name: 'Update', exact: true }).click();
        await k.settle(2500);
        const msgs = await page.getByRole('status').allTextContents();
        s.observe(`Messages after Update: ${msgs.join(' | ') || 'none'}`);
        await k.openLog(); await k.search(E.number);
        await expect(k.rows().first(), `Edited description saved (messages: ${msgs.join(' | ')})`).toContainText(E.description);
      });
    });
    await run.scenario(meta('PL-REG-EDT-06', 'Flag International requires a country', 'Negative'), async s => {
      await s.step(`Row action menu › "Flag International": leave the country empty, click "Flag" → toast "Manufacturer country is required."`, async () => {
        await k.rows().first().getByRole('cell').last().click();
        await page.getByRole('menuitem', { name: 'Flag International' }).click();
        await page.getByRole('button', { name: 'Flag', exact: true }).click();
        await k.toast('Manufacturer country is required.');
      });
    });
    await run.scenario(meta('PL-REG-EDT-05', 'Flag International', 'Positive'), async s => {
      await s.step(`Flag International dialog: enter country "South Korea", city "Seoul", click "Flag" → toast "Submittal flagged as international shipment."`, async () => {
        await page.getByRole('textbox', { name: 'e.g. China' }).fill('South Korea');
        await page.getByRole('textbox', { name: 'e.g. Shenzhen' }).fill('Seoul');
        await page.getByRole('button', { name: 'Flag', exact: true }).click();
        await k.toast('Submittal flagged as international shipment.');
      });
    });
    await run.scenario(meta('PL-REG-EDT-08', 'Row Delete removes a run-created submittal', 'Positive'), async s => {
      await s.step(`Search ${X.number} (1 item), row action menu › "Delete" → confirmation "1 submittal(s) will be deleted…"; click "Delete" → toast "1 record(s) deleted." and 0 items listed`, async () => {
        await k.search(X.number); await expect.poll(k.count).toBe(1);
        await k.rows().first().getByRole('cell').last().click();
        await page.getByRole('menuitem', { name: 'Delete' }).click();
        await expect(page.getByText('1 submittal(s) will be deleted. Are you sure you want to proceed?')).toBeVisible();
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        await k.toast('1 record(s) deleted.');
        await expect.poll(k.count).toBe(0);
      });
    });

    // ---------- 7. Alert rule ----------
    await run.scenario(meta('PL-REG-ALR-01', 'Create an alert rule', 'Positive'), async s => {
      await s.step(`Search ${E.number}, row action menu › "Alert" › "Add Alert": first field, condition ">=", value 5, message "${RUN} alert", click "Submit" → toast "Alert created successfully!" and the alert appears in the table`, async () => {
        await k.search(E.number);
        await k.rows().first().getByRole('cell').last().click();
        await page.getByRole('menuitem', { name: 'Alert' }).click();
        await page.getByRole('button', { name: 'Add Alert' }).click();
        await page.getByRole('button', { name: 'Choose Field' }).click(); await k.listbox().getByRole('option').first().click();
        await k.pick('Choose Condition', '>=');
        await page.getByRole('textbox', { name: 'Enter value' }).fill('5');
        await page.getByRole('textbox', { name: 'Enter alert message' }).fill(`${RUN} alert`);
        await page.getByRole('button', { name: 'Submit', exact: true }).click();
        await k.toast('Alert created successfully!');
        await expect(page.getByRole('cell', { name: `${RUN} alert` })).toBeVisible();
      });
      await s.step(`Left menu › "Procurement Log" → back on the list`, () => k.openLog());
    });

    // ---------- 4. Not Ordered component, bulk actions, PO upload ----------
    const comp = await run.scenario(meta('PL-REG-CMP-03', 'Component without PO is Not Ordered', 'Positive'), async s => {
      await s.step(`Search ${N.number}, click its description cell → submittal drawer opens with "Add Component" button`, async () => { await k.search(N.number); await k.openSubmittal(N.description); }, { critical: true });
      await s.step(`Drawer › "Add Component": Date Req. on Site in 28 days, QTY 10, Value 500, no PO, click "ADD" → toast "Schedule added successfully!"`, () => k.addComponent({ rojDate: plusDays(28), qty: 10, value: 500 }), { critical: true });
      await s.step(`Component row, status cell → status shows "Not Ordered"`, async () => expect(await k.componentStatus()).toBe('Not Ordered'));
    });
    if (comp.status === 'Passed') {
      await run.scenario(meta('PL-REG-CMP-15', 'Shift ROJ: Apply disabled until Preview', 'Negative'), async s => {
        await s.step(`Drawer: click "Select not-confirmed" → text "1 component selected"`, async () => { await page.getByRole('button', { name: 'Select not-confirmed' }).click(); await expect(page.getByText('1 component selected')).toBeVisible(); });
        await s.step(`Click "Shift ROJ Dates", enter Offset (days) 7 without previewing → "Apply" button is disabled`, async () => {
          await page.getByRole('button', { name: 'Shift ROJ Dates' }).click();
          await page.getByRole('spinbutton', { name: /Offset \(days\)/ }).fill('7');
          await expect(page.getByRole('button', { name: /^Apply/ })).toBeDisabled();
        });
      });
      await run.scenario(meta('PL-REG-CMP-13', 'Shift ROJ +7 calendar days with preview', 'Positive'), async s => {
        await s.step(`Shift ROJ panel: Basis "Calendar days", click "Preview" → "1 will move · 0 skipped"; click "Apply (1)" → toast "Required-on-site date updated on 1 component." and row shows the date 35 days from today`, async () => {
          await page.getByRole('combobox', { name: 'Basis' }).selectOption('Calendar days');
          await page.getByRole('button', { name: 'Preview' }).click();
          await expect(page.getByText(/1 will move · 0 skipped/)).toBeVisible();
          await page.getByRole('button', { name: /^Apply \(1\)/ }).click();
          await k.toast('Required-on-site date updated on 1 component.');
          await expect(k.componentRow()).toContainText(plusDays(35).toLocaleDateString('en-GB'));
        });
      });
      await run.scenario(meta('PL-REG-CMP-12', 'Bulk Set Lead Time with confirmation', 'Positive'), async s => {
        await s.step(`Click "Select not-confirmed", "Set Lead Time": Lead time (weeks) 2, tick "Mark lead time as confirmed", click "Apply" → toast "Lead time updated on 1 component." and row shows "Confirmed"`, async () => {
          await page.getByRole('button', { name: 'Select not-confirmed' }).click();
          await page.getByRole('button', { name: 'Set Lead Time' }).click();
          await page.getByRole('spinbutton', { name: 'Lead time (weeks)' }).fill('2');
          await page.getByRole('checkbox', { name: 'Mark lead time as confirmed' }).check();
          await page.getByRole('button', { name: /^Apply/ }).click();
          await k.toast('Lead time updated on 1 component.');
          await expect(k.componentRow()).toContainText('Confirmed');
        });
      });
      await run.scenario(meta('PL-REG-CMP-17', 'Upload PO File without a file', 'Negative'), async s => {
        await s.step(`Expand the component row, click "Upload PO File", click "Upload" without choosing a file → toast "Missing file."`, async () => {
          await k.componentRow().getByRole('cell').nth(1).getByRole('button').click();
          await page.getByRole('button', { name: 'Upload PO File' }).click();
          await page.getByRole('heading', { name: 'Upload PO File' }).locator('xpath=../..').getByRole('button', { name: 'Upload', exact: true }).click();
          await k.toast('Missing file.');
        });
      });
      await run.scenario(meta('PL-REG-CMP-16', 'Upload PO File (PDF)', 'Positive'), async s => {
        await s.step(`Click "Upload PO File", choose a generated PDF via "Click here to select the file", click "Upload" → toast "File uploaded successfully!" and the file name is listed`, async () => {
          const file = path.join(tmp, `${RUN}-po.pdf`); writePdf(file);
          await page.getByRole('button', { name: 'Upload PO File' }).click();
          const chooser = page.waitForEvent('filechooser');
          await page.getByText('Click here to select the file').last().click();
          await (await chooser).setFiles(file);
          await page.getByRole('heading', { name: 'Upload PO File' }).locator('xpath=../..').getByRole('button', { name: 'Upload', exact: true }).click();
          await k.toast('File uploaded successfully!');
          await expect(page.getByText(`${RUN}-po.pdf`)).toBeVisible();
        });
      });
      await run.scenario(meta('PL-REG-DLV-02', 'Over-delivery is blocked', 'Negative'), async s => {
        await s.step(`Click the component material cell, "+ Log Delivery": today, first location, item = material, QTY 20, click "Add" → error "Quantity exceeds available quantity"; close the dialog`, async () => {
          await k.componentRow().getByRole('cell', { name: MATERIAL }).click();
          await k.keepSite(); await page.getByRole('button', { name: '+ Log Delivery' }).last().click();
          const d = k.dialog('Add Delivery', 'Add');
          await k.day(d.getByRole('textbox').first(), today);
          await d.getByRole('button', { name: /^(All Locations|Choose Location)$/ }).click(); await k.listbox().getByRole('option').filter({ hasNotText: /^(All Locations|Choose Location)$/ }).first().click();
          await d.getByRole('button', { name: 'Choose Item Name' }).click(); await k.listbox().getByRole('option', { name: MATERIAL, exact: true }).first().click();
          await d.getByRole('spinbutton').first().fill('20');
          await d.getByRole('button', { name: 'Add', exact: true }).click();
          await expect(page.getByText(/Quantity exceeds available quantity/).first()).toBeVisible({ timeout: 15000 });
          await k.closeDialog('Add Delivery');
        });
      });
      await run.scenario(meta('PL-REG-CMP-18', 'Delete component', 'Positive'), async s => {
        await s.step(`Reload the submittal page, component row "Other Actions ▾" › "Delete", confirm "Delete" → no component rows remain`, async () => {
          await page.keyboard.press('Escape');
          await k.closeDialog('Add Delivery').catch(() => null);
          await page.goto(page.url().replace(/&schedule=[^&]+/, ''), { waitUntil: 'domcontentloaded' });
          await page.getByText('Other Actions').first().waitFor({ timeout: 30000 });
          await k.componentRow().getByRole('button', { name: 'Other Actions ▾' }).click();
          await page.getByRole('menuitem', { name: 'Delete' }).click();
          await page.getByRole('button', { name: 'Delete', exact: true }).click();
          await page.getByRole('status').first().waitFor({ timeout: 8000 }).catch(() => null);
          s.observe(`Message after Delete: ${(await page.getByRole('status').allInnerTexts().catch(() => [])).filter(text => !/^\s*(Project notice|Platform-wide)/i.test(text)).join(' | ').replace(/\s+/g, ' ') || '(none)'}`);
          await expect(page.getByRole('row').filter({ has: page.getByRole('checkbox', { name: 'Select this component' }) }), 'Component row still listed after Delete').toHaveCount(0, { timeout: 15000 });
        });
      });
    } else for (const id of ['PL-REG-CMP-15', 'PL-REG-CMP-13', 'PL-REG-CMP-12', 'PL-REG-CMP-17', 'PL-REG-CMP-16', 'PL-REG-DLV-02', 'PL-REG-CMP-18']) run.skip(meta(id, 'Component scenario', 'Positive'), 'No Not Ordered component');

    // ---------- 6. New material ----------
    await run.scenario(meta('PL-REG-MAT-01', 'Create a new material from the drawer', 'Positive'), async s => {
      await s.step(`Search ${N.number}, open it, click "New material": first Category, name "${RUN} Material", Unit "Pieces", Lead Time (Weeks) 1, click "Add" → toast "Material added to submittal."`, async () => {
        await k.openLog(); await k.search(N.number); await k.openSubmittal(N.description);
        await page.getByRole('button', { name: 'New material' }).last().click();
        const f = page.getByText('Lead Time (Weeks)').locator('xpath=ancestor::div[.//button[normalize-space()="Add"]][1]');
        await f.getByRole('button', { name: 'Choose Category' }).click(); await k.listbox().getByRole('option').first().click();
        await f.locator('input[type=text]').first().fill(`${RUN} Material`);
        await f.getByRole('button', { name: 'Choose Unit' }).click(); await k.listbox().getByRole('option', { name: 'Pieces', exact: true }).click();
        await f.locator('input[name="lead_time_in_weeks"]').fill('1');
        await f.getByRole('button', { name: 'Add', exact: true }).click();
        await k.toast('Material added to submittal.');
      });
    });
    await run.scenario(meta('PL-REG-MAT-04', 'Remove a non-primary material', 'Positive'), async s => {
      await s.step(`Drawer "Materials:" list: click "×" on the last material chip → toast "Material removed from submittal"`, async () => {
        await page.getByText('Materials:').locator('xpath=..').getByRole('button', { name: '×' }).last().click();
        await k.toast('Material removed from submittal');
      });
    });

    // ---------- 8. Import / export ----------
    // Full header of the project's submittal template (NRVC_Hall, 2 Nov): the import rejects files with only the core columns.
    const HEAD = (process.env.SCP_PL_IMPORT_HEADER || 'Spec Description|Schedule Id|Material Name|Submittal No|Supplier Name|Source|Actual Delivery Date|Total Count 1386|Total Count 1574|Total Count 15|Total Count 87|Spec Section No|Spec Section No|Spec Section No').split('|');
    const pad = row => [...row, ...Array(HEAD.length - row.length).fill('')].map((v, i) => HEAD[i] === 'Spec Section No' && v === '' ? `${RUN}-SPEC-I` : v);
    await run.scenario(meta('PL-REG-IMP-02', 'Import with Source empty fails as a whole', 'Negative'), async s => {
      await s.step(`"Import" › "Import Submittal": choose a generated xlsx whose Source column is empty, click "Upload" → toast "All rows failed validation, missing fields, or invalid data types."`, async () => {
        await k.openLog();
        const file = path.join(tmp, `${RUN}-bad.xlsx`);
        writeXlsx(file, [HEAD, pad([IMP.description, Number(num(6)), MATERIAL, `${RUN}-SUB-BAD`, SUPPLIER, ''])]);
        await btn('Import').click();
        const chooser = page.waitForEvent('filechooser');
        await page.getByText('Import Submittal', { exact: true }).click();
        await (await chooser).setFiles(file);
        await page.getByRole('button', { name: 'Upload', exact: true }).click();
        await k.toast('All rows failed validation, missing fields, or invalid data types.');
      });
    });
    await run.scenario(meta('PL-REG-IMP-01', 'Import a submittal (Source = Manual)', 'Positive'), async s => {
      await s.step(`"Import" › "Import Submittal": choose a generated xlsx with one row (${IMP.number}, Source "Manual"), click "Upload" → search ${IMP.number} lists exactly 1 imported item`, async () => {
        await k.openLog();
        const file = path.join(tmp, `${RUN}-ok.xlsx`);
        writeXlsx(file, [HEAD, pad([IMP.description, Number(IMP.scheduleId), MATERIAL, IMP.number, SUPPLIER, 'Manual'])]);
        await btn('Import').click();
        const chooser = page.waitForEvent('filechooser');
        await page.getByText('Import Submittal', { exact: true }).click();
        await (await chooser).setFiles(file);
        await page.getByRole('button', { name: 'Upload', exact: true }).click();
        await k.settle(3000);
        const msgs = await page.getByRole('status').allTextContents();
        s.observe(`Messages after upload: ${msgs.join(' | ') || 'none'}`);
        await k.search(IMP.number);
        await expect.poll(k.count, { message: `Imported row listed (messages: ${msgs.join(' | ')})`, timeout: 20000 }).toBe(1);
      });
    });
    await run.scenario(meta('PL-REG-IMP-08', 'Export follows the current filter', 'Positive'), async s => {
      await s.step(`Click "Export" → file downloads and is not empty`, async () => {
        const dl = page.waitForEvent('download'); await btn('Export').click();
        const file = path.join(tmp, (await dl).suggestedFilename()); await (await dl).saveAs(file);
        expect(fs.statSync(file).size).toBeGreaterThan(0);
        s.observe(`Export saved: ${path.basename(file)}`);
      });
    });
  } });
});
