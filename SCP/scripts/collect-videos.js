// Collects the run videos (MP4, H.264 / yuv420p / fast-start – plays in every common player, browser and on phones) and the
// step screenshots of a full regression and any extra run folders into one folder with readable names:
//   <out>/NN - <suite>.mp4, <out>/screenshots/NN - <suite>/<test case>/<nn>-<result>-<step>.png, <out>/index.html
//
// Usage (from SCP): node scripts/collect-videos.js <output folder> <full-regression folder | pm-flow run folder> [...]
const fs = require('fs');
const path = require('path');

const [outArg, ...inputs] = process.argv.slice(2);
if (!outArg || !inputs.length) { console.error('Usage: node scripts/collect-videos.js <output folder> <full-regression folder | run folder> …'); process.exit(1); }
const out = path.resolve(outArg);
fs.mkdirSync(out, { recursive: true });

const runs = [];
for (const input of inputs) {
  const dir = path.resolve(input);
  const suitesFile = path.join(dir, 'suites.json');
  if (fs.existsSync(suitesFile)) for (const s of JSON.parse(fs.readFileSync(suitesFile, 'utf8')).suites || []) runs.push({ title: s.title || s.suite, dir: s.reportDir });
  else runs.push({ title: path.basename(dir).replace(/-\d{4}-\d\d-\d\dT.*$/, ''), dir });
}
const items = [];
const countPng = dir => fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? countPng(path.join(dir, e.name)) : /\.png$/i.test(e.name) ? 1 : 0), 0);
runs.forEach((r, i) => {
  if (!r.dir) return;
  // Step screenshots: steps/ (PM_FLOW_STEP_SHOTS=on) or, for the E2E smoke, its own per-step screenshots/.
  const label = `${String(i + 1).padStart(2, '0')} - ${r.title.replace(/[\/:*?"<>|]/g, '-')}`;
  const shotsSrc = [path.join(r.dir, 'steps'), path.join(r.dir, 'screenshots')].find(d => fs.existsSync(d) && fs.readdirSync(d).length);
  let shots = 0;
  if (shotsSrc) { const dest = path.join(out, 'screenshots', label); fs.cpSync(shotsSrc, dest, { recursive: true }); shots = countPng(dest); }
  const mp4 = ['e2e-run.mp4', 'run.mp4'].map(f => path.join(r.dir, f)).find(f => fs.existsSync(f));
  if (!mp4) { if (shots) items.push({ name: null, title: r.title, size: 0, summary: '', shots, label }); return; }
  let summary = '';
  try { const res = JSON.parse(fs.readFileSync(path.join(r.dir, 'results.json'), 'utf8')).summary || {}; summary = `${res.passed || 0} passed, ${res.knownDefects || 0} known defect, ${res.failed || 0} failed, ${res.blocked || 0} blocked, ${res.skipped || 0} skipped`; } catch (e) { /* no summary */ }
  const name = `${String(i + 1).padStart(2, '0')} - ${r.title.replace(/[\\/:*?"<>|]/g, '-')}.mp4`;
  fs.copyFileSync(mp4, path.join(out, name));
  items.push({ name, title: r.title, size: fs.statSync(mp4).size, summary, shots, label });
});
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><title>SCP test run videos</title>
<style>body{font-family:Segoe UI,Arial,sans-serif;margin:24px;color:#1d2430}h1{color:#0f5e4f}li{margin:14px 0}video{display:block;margin-top:6px;max-width:960px;width:100%;border:1px solid #ccc}small{color:#666}</style></head><body>
<h1>SCP test run videos</h1><p>MP4 (H.264). Open a file directly, or play it below.</p><ol>
${items.map(v => `<li><b>${esc(v.title)}</b> <small>${esc(v.summary)}${v.name ? ` · ${(v.size / 1048576).toFixed(1)} MB · <a href="${encodeURI(v.name)}">${esc(v.name)}</a>` : ''}${v.shots ? ` · <a href="${encodeURI(`screenshots/${v.label}/`)}">${v.shots} step screenshots</a>` : ''}</small>${v.name ? `<video controls preload="metadata" src="${encodeURI(v.name)}"></video>` : ''}</li>`).join('\n')}
</ol></body></html>`);
console.log(`${items.filter(v => v.name).length} video(s), ${items.reduce((n, v) => n + (v.shots || 0), 0)} step screenshot(s) → ${out}`);
