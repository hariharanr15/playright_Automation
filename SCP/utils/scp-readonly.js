const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');

class ScpBlocked extends Error {
  constructor(message) { super(`BLOCKED: ${message}`); this.name = 'ScpBlocked'; }
}
const excluded = /enterprise[-_]shipments?|construction[-_ ]?delivery|setup-wizard|system[-_]messages|(?:^|[/_-])integrations?(?:[/_-]|$)|booking-integration|thelink-integration|xer-import/i;
function requireValue(value, description) {
  if (value === undefined || value === null || typeof value === 'string' && !value.trim()) throw new ScpBlocked(description);
  return value;
}
function loadAllocation() {
  if (!process.env.SCP_READONLY_DATA) return {};
  return JSON.parse(fs.readFileSync(path.resolve(process.env.SCP_READONLY_DATA), 'utf8'));
}
async function read(page, endpoint, params = {}) {
  if (excluded.test(endpoint) || /delete|mark.*read|seed|sync\/|create|update/i.test(endpoint)) throw new Error(`Disallowed source endpoint: ${endpoint}`);
  const result = await page.evaluate(async ({ endpoint, params }) => {
    const url = new URL(`/api/${endpoint.replace(/^\//, '')}`, location.origin);
    for (const [key, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(key, String(value));
    if (url.origin !== location.origin) throw new Error('Source queries must use the authenticated SCP origin');
    const response = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('_sso_access')}` } });
    return { status: response.status, body: await response.json(), date: response.headers.get('date') };
  }, { endpoint, params });
  expect(result.status, `Read source ${endpoint}`).toBeGreaterThanOrEqual(200);
  expect(result.status, `Read source ${endpoint}`).toBeLessThan(300);
  return result.body;
}
function number(text) {
  const match = String(text).replace(/,/g, '').match(/[-+]?\d+(?:\.\d+)?/);
  if (!match) throw new Error(`Expected a number, received ${JSON.stringify(text)}`);
  return Number(match[0]);
}
function unique(records, key) { return new Set(records.map(record => record[key]).filter(value => value !== null && value !== undefined)).size; }
function sum(records, key) { return records.reduce((total, record) => total + Number(record[key] ?? 0), 0); }
function one(records, predicate, label) {
  const matches = records.filter(predicate);
  expect(matches, `${label}: exact source identity`).toHaveLength(1);
  return matches[0];
}
function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); if (row.some(value => value !== '')) rows.push(row); row = []; cell = '';
    } else cell += char;
  }
  if (quoted) throw new Error('Unterminated CSV quoted field');
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
module.exports = { ScpBlocked, requireValue, loadAllocation, read, number, unique, sum, one, parseCsv, excluded };
