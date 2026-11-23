// Builds upload files for the PM flow from a template downloaded in the same run (Material Master / Site Details).
// The existing stdlib writer (utils/bulk-upload/workbook.py) replaces the data rows and keeps the template's other sheets
// (for example the _Lists sheet that feeds the UoM dropdown).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { readWorkbook } = require('../../../utils/bulk-upload/inventory-workbook');

const worker = path.resolve(__dirname, '../../../utils/bulk-upload/workbook.py');

// Header row of a sheet exactly as the writer reads it (empty trailing headers included).
function templateHeaders(template, sheet) {
  const book = readWorkbook(template);
  if (!book[sheet]) throw new Error(`Template ${path.basename(template)} has no sheet "${sheet}" (sheets: ${Object.keys(book).join(', ')})`);
  return Object.values(book[sheet][0]);
}

// rows: objects keyed by header; missing headers are written as empty cells.
function writeUpload({ template, sheet, rows, output }) {
  const headers = templateHeaders(template, sheet);
  const full = rows.map(row => Object.fromEntries(headers.map(header => [header, row[header] ?? ''])));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const payload = `${output}.json`;
  fs.writeFileSync(payload, JSON.stringify({ template: path.resolve(template), output: path.resolve(output), sheet, headers, rows: full }, null, 2));
  execFileSync(process.env.SCP_PYTHON || 'python', [worker, 'write', payload], { encoding: 'utf8', windowsHide: true });
  return output;
}

// A plain non-workbook file (wrong type checks).
function writeText(output, text) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, text);
  return output;
}

module.exports = { templateHeaders, writeUpload, writeText };
