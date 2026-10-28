const fs = require('fs');
const path = require('path');
const { MODULES, moduleById } = require('../../config/scp-module-registry');

const STATUS = { accessible: 'Accessible', notAccessible: 'Not Accessible', failed: 'Access Validation Failed', unknown: 'Unknown' };

// Expectations must come from the Organization Admin's configuration, never from what the application reports.
function loadExpectations(file = process.env.SCP_ACCESS_EXPECTATIONS) {
  if (!file) return null;
  const source = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  if (!Array.isArray(source.accounts) || !source.accounts.length) throw new Error('SCP_ACCESS_EXPECTATIONS must contain a non-empty accounts array');
  for (const account of source.accounts) {
    if (!account.label || !account.usernameEnv || !account.passwordEnv) throw new Error('Each expectation account needs label, usernameEnv and passwordEnv');
    if (!Array.isArray(account.projects) || !account.projects.length) throw new Error(`${account.label}: projects must be a non-empty array`);
    for (const project of account.projects) {
      if (!project.project) throw new Error(`${account.label}: every project entry needs a project name`);
      if (project.modules || project.actions || project.expectedRole) {
        if (!String(project.source || '').trim() || /REPLACE/i.test(project.source)) throw new Error(`${account.label} / ${project.project}: state the authoritative source of these expectations`);
        for (const [id, value] of Object.entries(project.modules || {})) {
          moduleById(id);
          if (typeof value !== 'boolean') throw new Error(`${account.label} / ${project.project} / ${id}: module expectation must be true or false`);
        }
        for (const [id, actions] of Object.entries(project.actions || {})) {
          moduleById(id);
          for (const [name, value] of Object.entries(actions)) if (typeof value !== 'boolean') throw new Error(`${account.label} / ${project.project} / ${id} / ${name}: action expectation must be true or false`);
        }
      }
    }
  }
  return source;
}

// Without an expectations file, the configured account is checked on SCP_ACCESS_PROJECTS (CSV, or "all") or the configured project.
function accountsToValidate(config, expectations = loadExpectations()) {
  if (expectations) return expectations.accounts.map((account, index) => ({ ...account, index }));
  const listed = String(process.env.SCP_ACCESS_PROJECTS || '').trim();
  const projects = /^all$/i.test(listed) ? 'all' : (listed ? listed.split(',').map(name => name.trim()).filter(Boolean) : [config.projectName]);
  const prefix = `SCP_${String(config.defaultRole || 'admin').toUpperCase()}`;
  const accounts = [{ label: config.defaultRole === 'admin' ? 'Organization Admin' : 'Configured account', usernameEnv: process.env[`${prefix}_USERNAME`] ? `${prefix}_USERNAME` : process.env.SCP_USERNAME ? 'SCP_USERNAME' : 'SCP_EMAIL',
    passwordEnv: process.env[`${prefix}_USERNAME`] && (config.defaultRole !== 'admin' || process.env[`${prefix}_PASSWORD`]) ? `${prefix}_PASSWORD` : 'SCP_PASSWORD', projects: projects === 'all' ? 'all' : projects.map(project => ({ project })) }];
  // Supplier and Subcontractor access is discovered on every project the account can open (observed, not validated).
  for (const [role, label] of [['supplier', 'Supplier'], ['subcontractor', 'Subcontractor']]) {
    const roleUsername = `SCP_${role.toUpperCase()}_USERNAME`;
    if (role !== config.defaultRole && process.env[roleUsername]) {
      accounts.push({ label, usernameEnv: roleUsername, passwordEnv: `SCP_${role.toUpperCase()}_PASSWORD`, projects: 'all' });
    }
  }
  return accounts.map((account, index) => ({ ...account, index }));
}

function observedStatus(observation) {
  if (observation.page.failureCategory || observation.page.probed === false || observation.page.reachable == null) return STATUS.unknown;
  return observation.navVisible && observation.page.reachable ? STATUS.accessible : STATUS.notAccessible;
}

// Compares one module observation with its expectation; unexpected access is a failure in either direction.
function evaluateModule(observation, expected, expectedActions = {}) {
  const observed = observedStatus(observation);
  const findings = [];
  if (observed === STATUS.unknown) return { status: STATUS.unknown, observed, expected: typeof expected === 'boolean' ? expected : null,
    validated: false, findings: [observation.page.reason || 'Page-level access was not established'], actionResults: [],
    reason: observation.page.reason || 'Access observation is incomplete', note: 'Unavailable/incomplete observation is not evidence of denied permission' };
  if (observation.navVisible && !observation.page.reachable) findings.push(`Shown in navigation but the page was not reachable (${observation.page.reason})`);
  if (!observation.navVisible && observation.page.reachable) findings.push('Hidden in navigation but its route opened by direct URL');
  if (observation.page.reachable && observation.page.deniedResponses?.length) findings.push(`Page opened but ${observation.page.deniedResponses.length} API request(s) returned 401/403`);
  if (observation.page.projectContext && observation.page.projectContext !== 'retained') findings.push(`Selected project ${observation.page.projectContext} after opening the module`);
  if (observation.sessionIndicates !== null && observation.sessionIndicates !== (observed === STATUS.accessible)) {
    findings.push(`Session permissions ${observation.sessionIndicates ? 'include' : 'omit'} indicative codes but the module is ${observed.toLowerCase()} (informational)`);
  }
  const actionResults = Object.entries(expectedActions).map(([name, allowed]) => {
    const seen = observation.actions.find(action => action.name === name);
    const visible = typeof seen?.visible === 'boolean' ? seen.visible : null;
    return { name, expected: allowed, visible, status: visible === null ? 'Not observed' : visible === allowed ? 'Matched' : STATUS.failed };
  });
  if (typeof expected !== 'boolean') {
    return { status: actionResults.some(result => result.status === STATUS.failed) ? STATUS.failed : observed, validated: false, expected: null, observed, findings, actionResults,
      note: 'No authoritative expectation; recorded as observed' };
  }
  const reachableAnyWay = observation.navVisible || observation.page.reachable;
  let status;
  if (expected) status = observed === STATUS.accessible ? STATUS.accessible : STATUS.failed;
  else status = reachableAnyWay ? STATUS.failed : STATUS.notAccessible;
  if (actionResults.some(result => result.status === STATUS.failed)) status = STATUS.failed;
  return { status, validated: actionResults.every(result => result.status === 'Matched'), expected, observed, findings, actionResults,
    note: status === STATUS.failed ? (expected ? 'Configured access was not granted' : 'Access was available although the configuration denies it') : 'Matches the authoritative configuration' };
}

function sessionIndicates(module, role) {
  if (!role || !module.sessionPermissions?.length) return null;
  return module.sessionPermissions.some(code => role.permissions.includes(code));
}

// Navigation items present right after a project switch but absent after a clean reload are carried over from the previous project.
function carriedOver(afterSwitch, afterReload) {
  const reloaded = new Set(afterReload.map(item => item.label.toLowerCase()));
  return afterSwitch.filter(item => !reloaded.has(item.label.toLowerCase())).map(item => item.label);
}

function maskEmail(value) {
  const [user, domain] = String(value || '').split('@');
  return domain ? `${user.slice(0, 2)}***@${domain}` : (value ? `${String(value).slice(0, 2)}***` : 'not configured');
}

// Matrix lookups used by the orchestrator to gate module execution for the account and project the suites run as.
function moduleAccess(matrix, projectName, moduleId) {
  const combination = (matrix?.combinations || []).find(item => item.primary && item.project.toLowerCase() === String(projectName).toLowerCase());
  if (!combination) return { status: 'Unknown', reason: matrix ? `Access discovery has no result for the primary account on ${projectName}` : 'Access discovery did not produce a matrix' };
  if (combination.error) return { status: 'Unknown', reason: `Access discovery failed for ${projectName}: ${combination.error}` };
  const module = combination.modules.find(item => item.id === moduleId);
  return module ? { ...module.evaluation, combination } : { status: 'Unknown', reason: `Module ${moduleId} was not evaluated` };
}

module.exports = { STATUS, MODULES, loadExpectations, accountsToValidate, observedStatus, evaluateModule, sessionIndicates, carriedOver, maskEmail, moduleAccess };
