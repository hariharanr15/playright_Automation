// Writes docs/automation-gap-analysis/KNOWN_DEFECTS.md from config/scp-known-defects.js, so the readable list always
// matches what the test runner uses. Run from SCP:  node scripts/known-defects-report.js
const fs = require('fs');
const path = require('path');
const { KNOWN_DEFECTS } = require('../config/scp-known-defects');

const OUTPUT = path.join(__dirname, '..', 'docs', 'automation-gap-analysis', 'KNOWN_DEFECTS.md');

const cell = value => String(value ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
const statusOf = defect => (defect.confirmation === 'pending' ? 'Pending confirmation' : 'Registered');
const scopeOf = defect => [
  ...(defect.scenarioIds || []),
  ...(defect.scenarioIds ? [] : defect.modules || [])
].join(', ') || 'Any module';
const titleOf = defect => (defect.title instanceof RegExp ? defect.title.source.replace(/\\/g, '') : defect.title);

const pending = KNOWN_DEFECTS.filter(defect => defect.confirmation === 'pending');
const byModule = new Map();
for (const defect of KNOWN_DEFECTS) {
  const module = (defect.modules && defect.modules[0]) || 'Other';
  if (!byModule.has(module)) byModule.set(module, []);
  byModule.get(module).push(defect);
}

const lines = [
  '# SCP – Known defects',
  '',
  `_Generated ${new Date().toISOString().slice(0, 10)} from \`config/scp-known-defects.js\` by \`scripts/known-defects-report.js\`. Do not edit by hand._`,
  '',
  'A test that fails exactly as described here is reported as **Known Defect** instead of Failed. Any other failure of the same test is still reported as Failed.',
  '',
  '- **Registered**: agreed with the user/team, or a confirmed rule that the application breaks.',
  '- **Pending confirmation**: today\'s behaviour looks logically wrong, but the expected behaviour has not been confirmed by the client/team yet. See `PENDING_CONFIRMATIONS.md`. These entries are reviewed (kept, changed or removed) once the team answers.',
  '',
  `**Total:** ${KNOWN_DEFECTS.length} entries · ${KNOWN_DEFECTS.length - pending.length} registered · ${pending.length} pending confirmation. Nothing here is raised in Jira.`,
  ''
];
// Plain-language wording for business readers (config/scp-plain-defects.json, 23 Nov 2026); the technical summary is the fallback.
const plainFile = path.join(__dirname, '..', 'config', 'scp-plain-defects.json');
const PLAIN = fs.existsSync(plainFile) ? JSON.parse(fs.readFileSync(plainFile, 'utf8')) : {};
for (const [module, defects] of byModule) {
  lines.push(`## ${module}`, '', '| ID | Status | Where | Problem | What happens today | What should happen | Why it matters | Test cases |', '|---|---|---|---|---|---|---|---|');
  for (const defect of defects) {
    const P = PLAIN[defect.id];
    if (P) lines.push(`| ${defect.id} | ${statusOf(defect)} (${cell(defect.recordedOn)}) | ${cell(P.where)} | **${cell(P.title)}** | ${cell(P.what_happens)} | ${cell(P.expected)} | ${cell(P.impact)} | ${cell(scopeOf(defect))} |`);
    else lines.push(`| ${defect.id} | ${statusOf(defect)} (${cell(defect.recordedOn)}) | ${cell(module)} | **${cell(titleOf(defect))}** | ${cell(defect.summary)} | – | – | ${cell(scopeOf(defect))} |`);
  }
  lines.push('');
}
fs.writeFileSync(OUTPUT, lines.join('\n'));
console.log(`${KNOWN_DEFECTS.length} known defects (${pending.length} pending confirmation) -> ${path.relative(process.cwd(), OUTPUT)}`);
