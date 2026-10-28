// Preserve the original run and publish a separate review using explicitly selected rerun results.
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { MODULES } = require('../config/scp-module-registry');
const { renderReport } = require('./generate-scp-full-regression-report');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const counts = scenarios => scenarios.reduce((result, scenario) => ({ ...result, [scenario.status]: (result[scenario.status] || 0) + 1 }), {});
const identity = scenario => [scenario.id, scenario.file, scenario.project, scenario.context?.account, scenario.context?.project].join('|');
function moduleFor(scenario) {
  const file = scenario.file || '';
  if (file.includes('supplier-list/')) return MODULES.find(module => module.id === 'supplier-list');
  if (file.includes('/international-shipments/')) return MODULES.find(module => module.id === 'international-shipment');
  return MODULES.find(module => module.name === scenario.module || file.includes(`/${module.id}/`) ||
    (module.id === 'first-delivery-inspection' && file.includes('/first-delivery-inspections/')));
}
async function main(args) {
  if (!args.length) throw new Error('Usage: node scripts/summarize-scp-recovery.js FULL_RUN_DIR [RERUN_execution.json ...]');
  const original = path.resolve(args[0]);
  const manifest = read(path.join(original, 'manifest.json'));
  if (!manifest.finishedAt) throw new Error('Wait for the original full run to finish before publishing its recovery review');
  const source = read(path.join(original, 'execution.json'));
  const effective = new Map(source.scenarios.map(scenario => [identity(scenario), scenario]));
  const history = [];
  let matrix = path.join(original, 'access-matrix.json');
  for (const input of args.slice(1)) {
    const file = path.resolve(input);
    for (const scenario of read(file).scenarios || []) {
      let key = identity(scenario);
      if (!effective.has(key)) {
        // An original that failed before its journal recorded context has a different identity; accept one unique ID/file/browser match.
        const matches = [...effective.entries()].filter(([, item]) => item.id === scenario.id && item.file === scenario.file && item.project === scenario.project);
        if (matches.length === 1) { effective.delete(matches[0][0]); effective.set(key, matches[0][1]); }
      }
      const previous = effective.get(key);
      if (previous && new Date(scenario.startedAt) < new Date(previous.startedAt)) throw new Error(`Recovery ${scenario.id} predates its selected result`);
      // A rerun keeps the module the original run placed it in; pending-folder files carry no module path of their own.
      const module = (previous && MODULES.find(item => item.name === previous.module)) || moduleFor(scenario);
      if (!module) throw new Error(`Cannot place ${scenario.id} in the mandatory module hierarchy`);
      history.push({ id: scenario.id, previousStatus: previous?.status || null, status: scenario.status, report: file });
      effective.set(key, { ...scenario, module: module.name, moduleOrder: module.order,
        stage: previous?.stage || 'supplemental-recovery', recoveryReport: file,
        originalStatus: previous?.originalStatus || previous?.status || null,
        originalActual: previous?.originalActual || previous?.actual || null,
        originalErrors: previous?.originalErrors || previous?.errors || [] });
      const candidate = path.join(path.dirname(file), 'access-matrix.json');
      if (scenario.id === 'SCP-UM-001' && scenario.status === 'Passed' && fs.existsSync(candidate)) matrix = candidate;
    }
  }
  const scenarios = [...effective.values()].sort((a, b) => a.moduleOrder - b.moduleOrder);
  const run = path.resolve('reports', `scp-recovery-review-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`);
  fs.mkdirSync(run, { recursive: true });
  manifest.sourceRun = original;
  manifest.originalCounts = source.counts;
  manifest.recoveryHistory = history;
  manifest.counts = counts(scenarios);
  manifest.finishedAt = new Date().toISOString();
  for (const module of manifest.modules) {
    if (scenarios.some(scenario => scenario.module === module.name && scenario.stage === 'supplemental-recovery')) {
      module.stages.push({ name: 'supplemental-recovery', mode: 'Targeted verification; original evidence retained' });
    }
    for (const stage of module.stages) {
      const rows = scenarios.filter(scenario => scenario.module === module.name && scenario.stage === stage.name);
      if (!rows.length) continue;
      stage.originalStatus = stage.status;
      stage.status = ['Failed', 'Access Validation Failed', 'Blocked'].find(status => rows.some(row => row.status === status)) ||
        (rows.some(row => row.status === 'Passed') ? 'Passed' : rows.every(row => row.status === 'Not Accessible') ? 'Not Accessible' : 'Skipped');
    }
  }
  const accessStage = manifest.modules.find(module => module.id === 'user-management')?.stages.find(stage => stage.name === 'access-validation');
  if (accessStage && manifest.access) manifest.access.status = accessStage.status;
  fs.writeFileSync(path.join(run, 'manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(run, 'execution.json'), JSON.stringify({ ...source, generatedAt: manifest.finishedAt, counts: manifest.counts, scenarios }, null, 2));
  for (const status of ['Failed', 'Blocked', 'Access Validation Failed']) fs.writeFileSync(path.join(run, `${status.toLowerCase().replace(/ /g, '-')}-scenarios.json`),
    JSON.stringify({ status, scenarios: scenarios.filter(scenario => scenario.status === status) }, null, 2));
  if (fs.existsSync(matrix)) fs.copyFileSync(matrix, path.join(run, 'access-matrix.json'));
  const report = await renderReport(run);
  console.log(JSON.stringify({ run, counts: manifest.counts, ...report }, null, 2));
  return run;
}
if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { main, identity, moduleFor };
