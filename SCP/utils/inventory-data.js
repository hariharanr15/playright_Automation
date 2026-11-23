const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');

class InventoryBlocked extends Error {
  constructor(message) { super(`BLOCKED: ${message}`); this.name = 'InventoryBlocked'; }
}

function loadInventoryEnvironment() {
  const file = process.env.SCP_INVENTORY_DATA;
  if (!file || !fs.existsSync(path.resolve(file))) throw new InventoryBlocked('Set SCP_INVENTORY_DATA to an approved staging allocation; see test-data/inventory-management.example.json');
  const data = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  for (const key of ['project', 'site', 'referenceMaterialId', 'subcontractor', 'sourceLocation', 'destinationLocation']) {
    if (!data[key] || /REPLACE/.test(data[key])) throw new InventoryBlocked(`Missing Inventory allocation: ${key}`);
  }
  if (data.sourceLocation === data.destinationLocation) throw new InventoryBlocked('The allocation requires distinct source and destination locations');
  return data;
}

// Read-only API lookups use the current authenticated UI session. Mutations stay in the UI.
async function readInventoryApi(page, endpoint, params = {}) {
  const result = await page.evaluate(async ({ endpoint, params }) => {
    const url = new URL(`/api/${endpoint.replace(/^\//, '')}`, location.origin);
    const projectId = localStorage.getItem('selectedProjectId');
    for (const [key, value] of Object.entries({ project_id: projectId, ...params })) url.searchParams.set(key, String(value ?? ''));
    const response = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('_sso_access')}` } });
    return { status: response.status, body: await response.json() };
  }, { endpoint, params });
  expect(result.status, `GET ${endpoint} must succeed`).toBeGreaterThanOrEqual(200);
  expect(result.status, `GET ${endpoint} must succeed`).toBeLessThan(300);
  return result.body;
}

function exactOne(values, predicate, label, prerequisite = false) {
  const matches = values.filter(predicate);
  if (matches.length !== 1) {
    const ErrorType = prerequisite ? InventoryBlocked : Error;
    throw new ErrorType(`${label}: expected one unambiguous match; found ${matches.length}`);
  }
  return matches[0];
}

function numeric(text) {
  const value = Number(String(text).replace(/,/g, '').match(/^-?\d+(?:\.\d+)?/)?.[0]);
  if (!Number.isFinite(value)) throw new Error(`Not a stock quantity: ${text}`);
  return value;
}

module.exports = { InventoryBlocked, loadInventoryEnvironment, readInventoryApi, exactOne, numeric };
