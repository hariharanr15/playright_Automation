#!/usr/bin/env node
// Runs the Project Management flow in Google Chrome and writes reports/pm-flow/<suite>-<timestamp>/report.html.
// Usage: node scripts/run-pm-flow.js smoke|regression|regression2 [--only=PM-SMK-006,PM-SMK-013] [--headless]
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const suite = (args.find(arg => !arg.startsWith('--')) || 'smoke').toLowerCase();
const spec = { smoke: 'pm-smoke.spec.js', regression: 'pm-regression.spec.js', regression2: 'pm-regression-part2.spec.js', flow: 'scp-demo-flow.spec.js', procurement: 'scp-procurement-flow.spec.js', 'pl-smoke': 'pl-smoke.spec.js', 'pl-regression': 'pl-regression.spec.js', 'pl-regression2': 'pl-regression-2.spec.js', 'pl-regression3': 'pl-regression-3.spec.js', 'app-smoke': 'app-smoke.spec.js', 'app-regression': 'app-regression.spec.js', 'inv-regression': 'inv-regression.spec.js', tickets: 'tickets-regression.spec.js', roles: 'role-regression.spec.js', 'e2e-smoke': 'e2e-smoke.spec.js' }[suite];
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
// The E2E smoke must run at 100 % zoom: Chrome is started with device scale factor 1.
if (suite === 'e2e-smoke' && !process.env.SCP_FORCE_SCALE_1) env.SCP_FORCE_SCALE_1 = 'true';
// ...and with a configurable gap before every browser action (click, typing, navigation): E2E_ACTION_PAUSE_MS, default 300.
if (suite === 'e2e-smoke' && !process.env.PM_FLOW_SLOW_MO) env.PM_FLOW_SLOW_MO = process.env.E2E_ACTION_PAUSE_MS || '300';
// ...and recorded on video (E2E_VIDEO=off disables it); the WebM is converted to MP4 after the run, below.
if (suite === 'e2e-smoke' && !process.env.PM_FLOW_VIDEO) env.PM_FLOW_VIDEO = /^off$/i.test(process.env.E2E_VIDEO || '') ? 'off' : 'on';

const result = spawnSync('npx', ['playwright', 'test', '--config=playwright.pm-flow.config.js', spec], { cwd: root, env, stdio: 'inherit', shell: true });
// The run video (E2E smoke always; any suite with PM_FLOW_VIDEO=on) is final only after the browser closed, so it is
// converted here: WebM → e2e-run.mp4 (E2E smoke) / run.mp4 (other suites), H.264.
if (env.PM_FLOW_VIDEO === 'on') {
  const find = dir => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? find(path.join(dir, e.name)) : /\.webm$/i.test(e.name) ? [path.join(dir, e.name)] : []) : []);
  const webm = find(path.join(out, 'playwright-artifacts')).sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
  if (!webm) console.log('\nNo run video was recorded.');
  else {
    const mp4 = path.join(out, suite === 'e2e-smoke' ? 'e2e-run.mp4' : 'run.mp4');
    const ff = spawnSync(require('ffmpeg-static'), ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4], { stdio: 'inherit' });
    console.log(ff.status === 0 && fs.existsSync(mp4) ? `\nRun video (MP4): ${mp4} (${(fs.statSync(mp4).size / 1048576).toFixed(1)} MB)` : `\nMP4 conversion failed; WebM kept at ${webm}`);
  }
}
const report = path.join(out, 'report.html');
console.log(fs.existsSync(report) ? `\nReport: ${report}` : '\nNo report was written – see the console output above.');
process.exit(result.status ?? 1);
