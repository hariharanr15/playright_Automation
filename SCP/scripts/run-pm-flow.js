#!/usr/bin/env node
// Runs the Project Management flow in Google Chrome and writes reports/pm-flow/<suite>-<timestamp>/report.html.
// Usage: node scripts/run-pm-flow.js smoke|regression|regression2 [--only=PM-SMK-006,PM-SMK-013] [--headless]
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const suite = (args.find(arg => !arg.startsWith('--')) || 'smoke').toLowerCase();
const spec = { smoke: 'pm-smoke.spec.js', regression: 'pm-regression.spec.js', regression2: 'pm-regression-part2.spec.js', flow: 'scp-demo-flow.spec.js', procurement: 'scp-procurement-flow.spec.js' }[suite];
if (!spec) {
  console.error(`Unknown suite "${suite}". Use smoke, regression or regression2.`);
  process.exit(2);
}
// The real folder spelling: a cwd typed in another case (scp vs SCP) makes Playwright load twice and refuse to start.
const root = fs.realpathSync.native(path.resolve(__dirname, '..'));
if (!fs.existsSync(path.join(root, 'tests/pm-flow', spec))) {
  console.error(`tests/pm-flow/${spec} does not exist yet.`);
  process.exit(2);
}
const only = (args.find(arg => arg.startsWith('--only=')) || '').slice('--only='.length);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(root, 'reports/pm-flow', `${suite}-${stamp}`);
const env = { ...process.env, PM_FLOW_OUT: out, PM_FLOW_ONLY: only, PM_FLOW_HEADLESS: args.includes('--headless') ? 'true' : '' };

const result = spawnSync('npx', ['playwright', 'test', '--config=playwright.pm-flow.config.js', spec], { cwd: root, env, stdio: 'inherit', shell: true });
const report = path.join(out, 'report.html');
console.log(fs.existsSync(report) ? `\nReport: ${report}` : '\nNo report was written – see the console output above.');
process.exit(result.status ?? 1);
