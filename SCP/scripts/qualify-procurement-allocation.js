const fs = require('fs');
const path = require('path');
const [report, caseTitle, environment, destination] = process.argv.slice(2);
if (!destination) throw new Error('Usage: node scripts/qualify-procurement-allocation.js results.json exact-case-title inventory-environment.json destination.json');
const results = JSON.parse(fs.readFileSync(report, 'utf8'));
const matches = [];
function visit(suites) {
  for (const suite of suites || []) {
    for (const spec of suite.specs || []) if (spec.title === caseTitle) {
      for (const test of spec.tests || []) for (const result of test.results || []) {
        if (result.status === 'passed') matches.push(result);
      }
    }
    visit(suite.suites);
  }
}
visit(results.suites);
if (matches.length !== 1) throw new Error('Select exactly one passed owned-record creation case; ambiguous/historical attempts are not a fixture');
const attachments = matches[0].attachments.filter(a => a.name === 'inventory-owned-records');
if (attachments.length !== 1) throw new Error('The passed case must supply exactly one owned-record manifest');
const attachment = attachments[0];
const owned = JSON.parse(attachment.body ? Buffer.from(attachment.body, 'base64').toString('utf8') : fs.readFileSync(attachment.path, 'utf8'));
const allocation = JSON.parse(fs.readFileSync(environment, 'utf8'));
if (!/^Inventory QA /i.test(owned.data.material) || owned.data.material !== owned.master.material_name ||
    owned.schedule.material_id !== owned.master.material_master_id ||
    owned.data.submittalNumber === 'SUB-2026-525') throw new Error('Owned manifest identity/relationship qualification failed');
const fixture = { project: allocation.project, site: allocation.site, sourceReport: path.resolve(report),
  sourceCase: caseTitle, qualifiedAt: new Date().toISOString(), data: owned.data, master: owned.master,
  submittal: owned.submittal, schedule: owned.schedule };
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, JSON.stringify(fixture, null, 2));
console.log('Qualified one passed, dedicated Procurement allocation. No application data changed.');
