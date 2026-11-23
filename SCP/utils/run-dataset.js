// One shared record chain per run (29 Oct 2026 decision): material, supplier, submittal, component and completed
// delivery are created once by the Procurement Log module and reused by Inventory, FDI and International Shipment.
// A full run writes it to its own run folder; the latest one is also kept in .state for module-only reruns.
const fs = require('fs');
const path = require('path');

const LATEST = path.resolve(__dirname, '../.state/run-dataset.json');

function runDatasetFile() {
  return process.env.SCP_RUN_DATASET_FILE || LATEST;
}

// Returns the shared chain only when it belongs to the given project (and site, when given).
function loadRunDataset(project, site) {
  try {
    const dataset = JSON.parse(fs.readFileSync(runDatasetFile(), 'utf8'));
    if (!project || dataset.project !== project || (site && dataset.site !== site)) return null;
    return dataset;
  } catch { return null; }
}

function saveRunDataset(dataset) {
  const body = JSON.stringify({ ...dataset, savedAt: new Date().toISOString() }, null, 2);
  for (const file of new Set([runDatasetFile(), LATEST])) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  }
}

function requireRunDataset(project, ScpBlocked) {
  const dataset = loadRunDataset(project);
  if (!dataset) throw new ScpBlocked('Shared run submittal not available: the Procurement Log module creates it; run it first');
  return dataset;
}

module.exports = { runDatasetFile, loadRunDataset, saveRunDataset, requireRunDataset };
