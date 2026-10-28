// Reclassifies a non-passing scenario as "Known Defect" only when it failed with the registered defect's own signature.
// Any other failure in the same scenario stays Failed/Blocked, so a registered defect never hides a new problem.
const { KNOWN_DEFECTS } = require('../config/scp-known-defects');

const KNOWN_DEFECT = 'Known Defect';

function failureText(scenario) {
  const steps = (scenario.steps || []).filter(step => ['Failed', 'Blocked'].includes(step.status));
  return [scenario.actual, ...(scenario.errors || []), ...steps.map(step => step.actual),
    ...steps.flatMap(step => (step.attempts || []).map(attempt => attempt.error))].filter(Boolean).join('\n');
}

const matches = (pattern, value) => pattern instanceof RegExp ? pattern.test(value) : String(value || '').includes(pattern);

function defectFor(scenario) {
  return KNOWN_DEFECTS.filter(defect => (!defect.modules || defect.modules.includes(scenario.module)) && matches(defect.title, scenario.title));
}

function classifyScenario(scenario) {
  const candidates = defectFor(scenario);
  if (!candidates.length) return scenario;
  if (scenario.status === 'Passed') {
    // The registered defect did not reproduce: flag it so the registry entry can be retired.
    const notReproduced = candidates.filter(defect => defect.reportNotReproduced !== false).map(defect => defect.id);
    return notReproduced.length ? { ...scenario, knownDefectNotReproduced: notReproduced } : scenario;
  }
  if (!['Failed', 'Blocked'].includes(scenario.status)) return scenario;
  const text = failureText(scenario);
  const defect = candidates.find(item => (item.statuses || ['Failed']).includes(scenario.status) && matches(item.signature, text));
  if (!defect) return scenario;
  return { ...scenario, status: KNOWN_DEFECT, originalStatus: scenario.status,
    knownDefect: { id: defect.id, summary: defect.summary, recordedOn: defect.recordedOn } };
}

function classifyScenarios(scenarios = []) {
  return scenarios.map(classifyScenario);
}

module.exports = { KNOWN_DEFECT, classifyScenario, classifyScenarios };
