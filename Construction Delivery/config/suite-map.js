const path = require('path');

const moduleSuites = {
  application: {
    name: 'Application',
    smoke: [
      'tests/smoke/application-shell-smoke.spec.js',
      'tests/smoke/project-management-smoke.spec.js',
      'tests/smoke/equipment-management-smoke.spec.js',
      'tests/smoke/user-management-smoke.spec.js',
      'tests/smoke/booking-list-flow.spec.js',
      'tests/smoke/booking-smoke.spec.js',
      'tests/smoke/calendar-smoke.spec.js',
      'tests/smoke/analytics-smoke.spec.js',
      'tests/smoke/environment-reports-smoke.spec.js',
      'tests/smoke/profile-menu-smoke.spec.js'
    ],
    regression: []
  },
  booking: {
    name: 'Booking',
    smoke: ['tests/smoke/booking-smoke.spec.js'],
    regression: ['tests/regression/booking-regression.spec.js']
  },
  'booking-list': {
    name: 'Booking List',
    smoke: ['tests/smoke/booking-list-flow.spec.js'],
    regression: [
      'tests/smoke/booking-list-flow.spec.js',
      'tests/regression/booking-list-status.spec.js'
    ]
  },
  calendar: {
    name: 'Calendar',
    smoke: ['tests/smoke/calendar-smoke.spec.js'],
    regression: ['tests/regression/calendar-regression.spec.js']
  },
  'equipment-management': {
    name: 'Equipment Management',
    smoke: ['tests/smoke/equipment-management-smoke.spec.js'],
    regression: ['tests/regression/equipment-management-functional.spec.js']
  },
  'user-management': {
    name: 'User Management',
    smoke: ['tests/smoke/user-management-smoke.spec.js'],
    regression: ['tests/regression/user-management-functional.spec.js']
  },
  'project-management': {
    name: 'Project Management',
    smoke: ['tests/smoke/project-management-smoke.spec.js'],
    regression: [
      'tests/regression/Project management_EnvironmentSetting.spec.js',
      'tests/regression/project-settings-tab.spec.js'
    ]
  },
  analytics: {
    name: 'Analytics',
    smoke: ['tests/smoke/analytics-smoke.spec.js'],
    regression: ['tests/regression/analytics-functional.spec.js']
  },
  'environment-reports': {
    name: 'Environment Reports',
    smoke: ['tests/smoke/environment-reports-smoke.spec.js'],
    regression: ['tests/regression/environment-reports-functional.spec.js']
  },
  'my-account': {
    name: 'My Account',
    smoke: ['tests/smoke/my-account-smoke.spec.js'],
    regression: ['tests/regression/my-account-functional.spec.js']
  },
  'my-organization': {
    name: 'My Organization',
    smoke: ['tests/smoke/my-organization-smoke.spec.js'],
    regression: ['tests/regression/my-organization-functional.spec.js']
  },
  'notification-preferences': {
    name: 'Notification Preferences',
    smoke: ['tests/smoke/notification-preferences-smoke.spec.js'],
    regression: ['tests/regression/notification-status-matrix.spec.js']
  },
  'profile-menu': {
    name: 'Profile Menu',
    smoke: ['tests/smoke/profile-menu-smoke.spec.js'],
    regression: [
      'tests/regression/my-account-functional.spec.js',
      'tests/regression/my-organization-functional.spec.js',
      'tests/regression/notification-status-matrix.spec.js'
    ]
  },
  'super-admin': {
    name: 'Super Admin',
    smoke: [],
    regression: ['tests/regression/VC_Superadmin_Project Creation.spec.js']
  }
};

const mandatoryCompleteApplicationOrder = [
  {
    step: 1,
    name: 'Log in and navigate to selected project home page',
    modules: ['application'],
    smoke: ['tests/smoke/application-shell-smoke.spec.js'],
    regression: []
  },
  {
    step: 2,
    name: 'Configure and validate Project Management information',
    modules: ['project-management'],
    smoke: ['tests/smoke/project-management-smoke.spec.js'],
    regression: [
      'tests/regression/Project management_EnvironmentSetting.spec.js',
      'tests/regression/project-settings-tab.spec.js'
    ]
  },
  {
    step: 3,
    name: 'Complete Environment Settings and Equipment Management configurations',
    modules: ['project-management', 'equipment-management'],
    smoke: ['tests/smoke/equipment-management-smoke.spec.js'],
    regression: ['tests/regression/equipment-management-functional.spec.js']
  },
  {
    step: 4,
    name: 'Automate User Management functional flows',
    modules: ['user-management'],
    smoke: ['tests/smoke/user-management-smoke.spec.js'],
    regression: ['tests/regression/user-management-functional.spec.js']
  },
  {
    step: 5,
    name: 'Validate Booking List related functions',
    modules: ['booking-list'],
    smoke: ['tests/smoke/booking-list-flow.spec.js'],
    regression: [
      'tests/smoke/booking-list-flow.spec.js',
      'tests/regression/booking-list-status.spec.js'
    ]
  },
  {
    step: 6,
    name: 'Create and validate available booking types',
    modules: ['booking'],
    smoke: ['tests/smoke/booking-smoke.spec.js'],
    regression: ['tests/regression/booking-regression.spec.js']
  },
  {
    step: 7,
    name: 'Validate existing scheduling, analytics, and reporting modules',
    modules: ['calendar', 'analytics', 'environment-reports'],
    smoke: [
      'tests/smoke/calendar-smoke.spec.js',
      'tests/smoke/analytics-smoke.spec.js',
      'tests/smoke/environment-reports-smoke.spec.js'
    ],
    regression: [
      'tests/regression/calendar-regression.spec.js',
      'tests/regression/analytics-functional.spec.js',
      'tests/regression/environment-reports-functional.spec.js'
    ]
  },
  {
    step: 8,
    name: 'Validate top-right Profile menu',
    modules: ['profile-menu', 'my-account', 'my-organization', 'notification-preferences'],
    smoke: ['tests/smoke/profile-menu-smoke.spec.js'],
    regression: [
      'tests/regression/my-account-functional.spec.js',
      'tests/regression/my-organization-functional.spec.js',
      'tests/regression/notification-status-matrix.spec.js'
    ]
  }
];

function normalizeModuleKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
}

function listModules() {
  return Object.entries(moduleSuites).map(([key, value]) => ({
    key,
    name: value.name,
    smoke: value.smoke.length,
    regression: value.regression.length
  }));
}

function resolveSpecPaths(moduleKey, suite, rootDir = process.cwd()) {
  const normalizedModule = normalizeModuleKey(moduleKey);
  const moduleConfig = moduleSuites[normalizedModule];
  if (!moduleConfig) {
    throw new Error(`Unknown module "${moduleKey}". Available modules: ${Object.keys(moduleSuites).join(', ')}.`);
  }

  const normalizedSuite = String(suite || '').toLowerCase();
  const specs = moduleConfig[normalizedSuite] || [];
  if (!specs.length) {
    throw new Error(`${moduleConfig.name} does not have ${normalizedSuite} Playwright specs registered yet.`);
  }

  // Playwright's CLI fails to resolve a test-file pattern when a directory
  // prefix is combined with a space in the filename (e.g. "regression/Project
  // management_EnvironmentSetting.spec.js" matches 0 tests even though the
  // file exists). Bare filenames resolve correctly and stay unique because
  // tests/smoke and tests/regression are each flat, single-level directories.
  return specs.map((filePath) => path.basename(filePath));
}

module.exports = {
  listModules,
  mandatoryCompleteApplicationOrder,
  moduleSuites,
  normalizeModuleKey,
  resolveSpecPaths
};
