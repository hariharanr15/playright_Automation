const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath = path.resolve(__dirname, '..', '.env')) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const loaded = [];
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) {
      process.env[key] = value;
      loaded.push(key);
    }
  }

  return loaded;
}

function setEnvIfPresent(key, value, override = false) {
  const normalizedValue = String(value ?? '').trim();
  if (!normalizedValue) return false;
  if (!override && process.env[key]) return false;
  process.env[key] = normalizedValue;
  return true;
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeEnvironmentName(value) {
  return String(value || 'staging')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
}

function applyEnvironmentProfile(profile, override = false) {
  if (!profile) return [];

  const applied = [];
  const mappings = [
    ['BASE_URL', profile.baseUrl || profile.loginUrl],
    ['APP_URL', profile.appUrl],
    ['PROJECT_ID', profile.projectId],
    ['PROJECT_NAME', profile.projectName],
    ['VC_EMAIL', profile.email || profile.credentials?.email],
    ['VC_PASSWORD', profile.password || profile.credentials?.password],
    ['USER_INVITE_ORGANIZATION', profile.organization || profile.userInviteOrganization],
    ['USER_INVITE_ROLE', profile.role || profile.userInviteRole]
  ];

  for (const [key, value] of mappings) {
    if (setEnvIfPresent(key, value, override)) {
      applied.push(key);
    }
  }

  if (profile.variables && typeof profile.variables === 'object') {
    for (const [key, value] of Object.entries(profile.variables)) {
      if (setEnvIfPresent(key, value, override)) {
        applied.push(key);
      }
    }
  }

  return applied;
}

function loadAutomationEnvironment(options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, '..');
  loadEnvFile(path.join(rootDir, '.env'));

  const environmentName = normalizeEnvironmentName(
    options.environmentName ||
    process.env.TEST_ENV ||
    process.env.AUTOMATION_ENV ||
    process.env.ENV ||
    'staging'
  );

  process.env.TEST_ENV = environmentName;

  const jsonProfilePath = path.join(rootDir, 'config', 'environments', `${environmentName}.json`);
  const dotenvProfilePath = path.join(rootDir, `.env.${environmentName}`);
  const profile = readJsonFile(jsonProfilePath);
  const appliedFromProfile = applyEnvironmentProfile(profile, Boolean(options.override));
  const appliedFromDotenv = loadEnvFile(dotenvProfilePath);

  return {
    environmentName,
    displayName: profile?.name || environmentName,
    profilePath: fs.existsSync(jsonProfilePath) ? jsonProfilePath : '',
    dotenvPath: fs.existsSync(dotenvProfilePath) ? dotenvProfilePath : '',
    appliedKeys: [...appliedFromProfile, ...appliedFromDotenv]
  };
}

module.exports = {
  applyEnvironmentProfile,
  loadAutomationEnvironment,
  loadEnvFile,
  normalizeEnvironmentName
};
