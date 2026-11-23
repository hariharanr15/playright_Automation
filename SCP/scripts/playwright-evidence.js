// Turns a Playwright JSON report of an existing (non pm-flow) suite into a pm-flow style results.json, so that
// scripts/non-pass-report.js --evidence=<folder> can use it for config/scp-covered-by.js (e.g. ENT-REG-01 is checked by
// the Enterprise suite's open-submittal reconciliation). Test titles are mapped to evidence IDs by the --map argument.
//
// Usage: node scripts/playwright-evidence.js <playwright-json> <out-folder> --map="<title regex>=<ID>" [--map=…]
const fs = require('fs');
const path = require('path');
const [input, outDir] = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const maps = process.argv.slice(2).filter(arg => arg.startsWith('--map=')).map(arg => { const [re, id] = arg.slice(6).split(/=(?=[^=]+$)/); return { re: new RegExp(re, 'i'), id }; });
const report = JSON.parse(fs.readFileSync(input, 'utf8'));
const scenarios = [];
const walk = suite => {
  for (const spec of suite.specs || []) for (const t of spec.tests) {
    const map = maps.find(m => m.re.test(spec.title));
    if (!map) continue;
    const last = t.results[t.results.length - 1] || {};
    const status = last.status === 'passed' ? 'Passed' : last.status === 'skipped' ? 'Skipped' : 'Failed';
    const error = (last.errors || []).map(e => e.message).join(' ').replace(/\x1b\[[0-9;]*m/g, '').slice(0, 1000);
    scenarios.push({ id: map.id, title: spec.title, status, steps: [{ name: spec.title, status, attempts: error ? [{ number: 1, error }] : [] }], startedAt: last.startTime });
  }
  for (const child of suite.suites || []) walk(child);
};
for (const suite of report.suites || []) walk(suite);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify({ suite: path.basename(outDir), source: path.resolve(input), scenarios }, null, 1));
console.log(scenarios.map(s => `${s.id} ${s.status}`).join('\n'), `\n-> ${path.join(outDir, 'results.json')}`);
