const fs = require('fs');
const path = require('path');

const DEFAULT_STATE_PATH = path.resolve(__dirname, '..', 'test-results', 'project-management-setup-latest.json');

function statePath() {
  return process.env.PROJECT_MANAGEMENT_SETUP_STATE_FILE || DEFAULT_STATE_PATH;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function loadProjectManagementSetupState() {
  const filePath = statePath();
  if (!fs.existsSync(filePath)) return null;

  const state = readJson(filePath);
  if (!state || typeof state !== 'object') return null;

  const projectId = process.env.PROJECT_ID || process.env.BUCKINGHAM_PALACE_PROJECT_ID || '5ET10000010';
  if (state.projectId && String(state.projectId) !== String(projectId)) return null;

  return state;
}

function saveProjectManagementSetupState(partialState) {
  const filePath = statePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const existing = loadProjectManagementSetupState() || {};
  const nextState = {
    ...existing,
    ...partialState,
    projectId: partialState.projectId || existing.projectId || process.env.PROJECT_ID || process.env.BUCKINGHAM_PALACE_PROJECT_ID || '5ET10000010',
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(filePath, JSON.stringify(nextState, null, 2), 'utf8');
  return nextState;
}

function clearProjectManagementSetupState() {
  fs.rmSync(statePath(), { force: true });
}

function projectManagementPreferredValue(label) {
  const state = loadProjectManagementSetupState();
  if (!state) return '';

  if (/access\s*point/i.test(label)) return state.accessPointName || '';
  if (/resource/i.test(label)) return state.resourceName || '';
  if (/vehicle/i.test(label)) return state.vehicleName || '';
  if (/fuel/i.test(label)) return state.vehicleFuelType || '';
  return '';
}

function projectManagementBookingPreferences() {
  const state = loadProjectManagementSetupState() || {};
  return {
    accessPointName: state.accessPointName || '',
    resourceName: state.resourceName || '',
    vehicleName: state.vehicleName || '',
    vehicleFuelType: state.vehicleFuelType || ''
  };
}

module.exports = {
  clearProjectManagementSetupState,
  loadProjectManagementSetupState,
  projectManagementBookingPreferences,
  projectManagementPreferredValue,
  saveProjectManagementSetupState
};
