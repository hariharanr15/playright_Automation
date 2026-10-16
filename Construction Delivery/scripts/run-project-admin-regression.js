#!/usr/bin/env node

const path = require('path');
const { spawnSync } = require('child_process');
const { loadAutomationEnvironment } = require('../utils/env');
const { clearProjectManagementSetupState } = require('../utils/project-management-setup-state');

const ROOT_DIR = path.resolve(__dirname, '..');
const TARGET_ROLE = 'Project Admin';

function parseArguments() {
  const args = process.argv.slice(2);
  const consumed = new Set();

  const getValue = (name, fallback = '') => {
    const inlineIndex = args.findIndex((arg) => arg.startsWith(`--${name}=`));
    if (inlineIndex !== -1) {
      consumed.add(inlineIndex);
      return args[inlineIndex].slice(name.length + 3);
    }

    const index = args.indexOf(`--${name}`);
    if (index !== -1) {
      consumed.add(index);
      consumed.add(index + 1);
      return args[index + 1] || fallback;
    }

    return fallback;
  };

  const environmentName = getValue('env', process.env.TEST_ENV || process.env.AUTOMATION_ENV || 'staging');
  const dryRun = args.includes('--dry-run');
  const headless = args.includes('--headless');
  const noOpen = args.includes('--no-open') || headless;
  const reuseSetupState = args.includes('--reuse-setup-state');

  const knownFlags = new Set([
    '--dry-run',
    '--headless',
    '--headed',
    '--no-open',
    '--reuse-setup-state'
  ]);
  const passthrough = args.filter((arg, index) =>
    !consumed.has(index) &&
    !knownFlags.has(arg) &&
    !arg.startsWith('--env=')
  );

  return {
    dryRun,
    environmentName,
    headless,
    noOpen,
    reuseSetupState,
    passthrough
  };
}

function setIfMissing(key, value) {
  if (!process.env[key] && String(value || '').trim()) {
    process.env[key] = String(value).trim();
  }
}

function configureProjectAdminEnvironment(environmentName) {
  const environment = loadAutomationEnvironment({
    environmentName,
    rootDir: ROOT_DIR
  });

  process.env.TEST_ENV = environment.environmentName;
  process.env.AUTOMATION_ENV = environment.environmentName;
  process.env.ENVIRONMENT_NAME = environment.displayName || 'Staging';
  process.env.ROLE_FUNCTIONAL_TARGET_ROLES = TARGET_ROLE;
  process.env.USER_INVITE_ROLES = TARGET_ROLE;
  process.env.GENERATED_USER_COUNT = process.env.GENERATED_USER_COUNT || '1';
  process.env.DISABLE_AUTOMATION_VISUALS = process.env.DISABLE_AUTOMATION_VISUALS || 'true';
  process.env.HIGHLIGHT_MS = process.env.HIGHLIGHT_MS || '0';
  process.env.STEP_WAIT_MS = process.env.STEP_WAIT_MS || '0';

  setIfMissing('ROLE_PROJECT_ADMIN_EMAIL', process.env.PROJECT_ADMIN_EMAIL || process.env.VC_EMAIL);
  setIfMissing('ROLE_PROJECT_ADMIN_PASSWORD', process.env.PROJECT_ADMIN_PASSWORD || process.env.VC_PASSWORD);
  setIfMissing('VC_EMAIL', process.env.ROLE_PROJECT_ADMIN_EMAIL || process.env.PROJECT_ADMIN_EMAIL);
  setIfMissing('VC_PASSWORD', process.env.ROLE_PROJECT_ADMIN_PASSWORD || process.env.PROJECT_ADMIN_PASSWORD);

  return environment;
}

function runNodeScript(scriptPath, args, options) {
  const command = ['node', scriptPath, ...args];
  console.log(`\n${command.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg)).join(' ')}`);

  if (options.dryRun) {
    return { status: 0 };
  }

  return spawnSync('node', [scriptPath, ...args], {
    cwd: ROOT_DIR,
    env: process.env,
    shell: process.platform === 'win32',
    stdio: 'inherit'
  });
}

function exitCode(result) {
  return result.status ?? 1;
}

function main() {
  const options = parseArguments();
  const environment = configureProjectAdminEnvironment(options.environmentName);
  const commonArgs = [
    ...(options.headless ? ['--headless'] : []),
    ...(options.noOpen ? ['--no-open'] : [])
  ];

  console.log(`Project Admin full regression environment: ${environment.displayName}`);
  console.log(`Project: ${process.env.PROJECT_NAME || '-'} (${process.env.PROJECT_ID || '-'})`);
  console.log(`Role target: ${process.env.ROLE_FUNCTIONAL_TARGET_ROLES}`);

  if (!options.reuseSetupState && !options.dryRun) {
    clearProjectManagementSetupState();
  }

  if (!options.reuseSetupState) {
    const setupResult = runNodeScript('scripts/run-project-management-flow.js', commonArgs, options);
    if (exitCode(setupResult) !== 0) {
      console.error('Project Management setup failed; Project Admin regression was not started.');
      process.exit(exitCode(setupResult));
    }
  } else {
    console.log('Reusing existing Project Management setup state.');
  }

  const regressionArgs = [
    '--single-browser',
    '--turbo',
    '--role-functional-flows',
    '--continue-on-failure',
    ...commonArgs,
    ...options.passthrough
  ];
  const regressionResult = runNodeScript('run-full-application.js', regressionArgs, options);
  process.exit(exitCode(regressionResult));
}

main();
