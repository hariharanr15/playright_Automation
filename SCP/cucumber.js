const common = {
  require: [
    'features/support/**/*.js',
    'features/step-definitions/**/*.js'
  ],
  format: [
    'progress',
    'html:reports/html/SCP_Project_Management_Report.html',
    'json:reports/cucumber-report.json'
  ],
  formatOptions: {
    snippetInterface: 'async-await'
  },
  parallel: 0,
  publishQuiet: true
};

module.exports = {
  default: {
    ...common,
    paths: ['features/**/*.feature']
  },
  projectManagement: {
    ...common,
    paths: ['features/project-management/**/*.feature'],
    tags: '@projectManagement'
  },
  projectManagementSmoke: {
    ...common,
    paths: ['features/project-management/**/*.feature'],
    tags: '@projectManagement and @smoke'
  },
  projectManagementNegative: {
    ...common,
    paths: ['features/project-management/**/*.feature'],
    tags: '@projectManagement and @negative'
  }
};
