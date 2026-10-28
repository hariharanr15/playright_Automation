const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { expect } = require('@playwright/test');

const HEADERS = ['Submittal No', 'Material', 'Item', 'Date Required On Site', 'PO Number', 'Action', 'From Location', 'To Location', 'Quantity', 'UoM', 'Supplier', 'Comments'];
const SHEET = 'Inventory Template';
const SUPPLIED_TEMPLATE = path.resolve(__dirname, '../../test-data/bulk-upload/inventory/templates/inventory_upload_template.xlsx');
const worker = path.join(__dirname, 'workbook.py');

// Python cannot open paths of 260+ characters on Windows without LongPathsEnabled; deep run folders exceed it.
// The extended-length prefix lifts that limit and is a no-op elsewhere.
function pythonPath(file) {
  const absolute = path.resolve(file);
  return process.platform === 'win32' && absolute.length >= 240 && !absolute.startsWith('\\\\?\\') ? `\\\\?\\${absolute}` : absolute;
}
function run(command, file) {
  return JSON.parse(execFileSync(process.env.SCP_PYTHON || 'python', [worker, command, pythonPath(file)], { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 }));
}
function readWorkbook(file) { return run('read', file); }
function headersOf(book) {
  const rows = book[SHEET];
  expect(rows, 'Inventory Template worksheet must exist').toBeTruthy();
  return Object.values(rows[0]);
}
function writeInventoryWorkbook(template, output, rows) {
  expect(headersOf(readWorkbook(SUPPLIED_TEMPLATE)), 'Supplied template contract').toEqual(HEADERS);
  expect(headersOf(readWorkbook(template)), 'Live template must match the supplied column contract').toEqual(HEADERS);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const payload = `${output}.json`;
  fs.writeFileSync(payload, JSON.stringify({ template: pythonPath(template), output: pythonPath(output), sheet: SHEET, headers: HEADERS, rows }, null, 2));
  return run('write', payload);
}
function inventoryUploadRows(owned, allocation, negative = false) {
  if (owned.deliveryCompleted !== true || !Number.isFinite(owned.baselineBalance)) throw new Error('Inventory upload requires completed delivery and a verified stock baseline');
  const iso = owned.schedule.date_required_on_site;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error(`Procurement schedule date is not ISO: ${iso}`);
  const date = iso.split('-').reverse().join('/');
  const seed = owned.data.quantity;
  const quantity = owned.data.movementQuantity;
  const actions = negative ? ['Internal Movement', 'Issue To Construction'] : ['Internal Movement', 'Issue To Construction', 'Loss', 'Return'];
  return actions.map((action, index) => ({
    'Submittal No': owned.data.submittalNumber,
    Material: `${owned.master.material_id} - ${owned.master.material_name}`,
    Item: owned.item.item_name,
    'Date Required On Site': date,
    'PO Number': owned.schedule.po_number || '',
    Action: action,
    'From Location': allocation.sourceLocation,
    'To Location': action === 'Internal Movement' ? allocation.destinationLocation : '',
    Quantity: negative && index === 1 ? owned.baselineBalance + seed + 1 : quantity,
    UoM: '', // The template explicitly allows blank: use this owned SKU's verified conversion.
    Supplier: index === 0 ? owned.data.supplier : '', // Subsequent rows exercise the same generated submittal's supplier default.
    Comments: `${owned.data.comments} / ${action}`
  }));
}
module.exports = { HEADERS, SHEET, SUPPLIED_TEMPLATE, readWorkbook, writeInventoryWorkbook, inventoryUploadRows };
