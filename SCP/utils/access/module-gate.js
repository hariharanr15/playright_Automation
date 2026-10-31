const fs = require('fs');
const { moduleById } = require('../../config/scp-module-registry');
const { PermissionResolver } = require('./permission-resolver');
const { loadExpectations, evaluateModule, maskEmail, STATUS } = require('./access-model');
const { ScpBlocked } = require('../scp-readonly');

function expectedProject(config, projectName, source = loadExpectations()) {
  const account = source?.accounts.find(entry => String(process.env[entry.usernameEnv] || '').trim().toLowerCase() === config.username.trim().toLowerCase());
  return account?.projects.find(project => project.project.toLowerCase() === projectName.toLowerCase());
}

// The run's access discovery already captured every module; re-capturing the left menu before each test
// cost minutes per stage and could hang. Reuse it, else resolve once per process.
const resolved = new Map();
function discoveredAccess(config, moduleId) {
  const file = process.env.SCP_ACCESS_MATRIX_FILE;
  if (!file || !fs.existsSync(file)) return null;
  const combination = JSON.parse(fs.readFileSync(file, 'utf8')).combinations?.find(entry => entry.primary &&
    entry.user === maskEmail(config.username) && entry.project.toLowerCase() === config.projectName.toLowerCase());
  const found = combination?.modules.find(item => item.id === moduleId);
  if (!found) return null;
  const { evaluation, ...observation } = found;
  return { role: null, navigation: null, modules: [observation], source: file };
}

async function requireModuleAccess({ page, config, projectSelector }, info, journal, moduleId) {
  const module = moduleById(moduleId);
  const expected = expectedProject(config, config.projectName);
  const key = [config.username, config.projectName, moduleId].join('|').toLowerCase();
  if (!resolved.has(key)) {
    resolved.set(key, discoveredAccess(config, moduleId) ||
      await new PermissionResolver(page, config, projectSelector).resolve(config.projectName, expected?.actions || {}, [moduleId]));
  }
  const access = resolved.get(key);
  const observation = access.modules[0];
  const evaluation = evaluateModule(observation, expected?.modules?.[moduleId], expected?.actions?.[moduleId]);
  const result = { moduleId, module: module.name, user: maskEmail(config.username), project: config.projectName,
    role: access.role, accessSource: access.source || 'live capture', expectedSource: expected?.source || null, navigation: access.navigation, observation, ...evaluation };
  journal.scenario.access = result;
  journal.setData('moduleAccess', result);
  await info.attach('module-project-access', { body: Buffer.from(JSON.stringify(result)), contentType: 'application/json' });
  if (evaluation.status === STATUS.unknown) throw new ScpBlocked(evaluation.reason);
  if (evaluation.status === STATUS.failed) {
    info.annotations.push({ type: 'access-validation-failed', description: evaluation.findings.join('; ') || evaluation.note });
    throw new Error(`Access validation failed for ${module.name}: ${evaluation.note}`);
  }
  if (evaluation.status === STATUS.notAccessible) {
    info.annotations.push({ type: 'not-accessible', description: `${module.name} is not accessible on ${config.projectName}` });
    info.skip(true, `${module.name} is not accessible on the selected project`);
  }
  await projectSelector.expectActiveProject(config.projectName);
  return result;
}
module.exports = { requireModuleAccess, expectedProject };
