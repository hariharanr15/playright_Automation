const common = {
  require: [
    'features/support/**/*.js',
    'features/step-definitions/**/*.js'
  ],
  format: [
    'progress',
    'html:reports/cucumber-report.html',
    'json:reports/cucumber-report.json'
  ],
  publishQuiet: true,
  parallel: 0
};

module.exports = {
  default: {
    ...common,
    paths: ['features/**/*.feature']
  },
  smoke: {
    ...common,
    paths: ['features/smoke/**/*.feature'],
    tags: '@smoke'
  },
  regression: {
    ...common,
    paths: ['features/regression/**/*.feature'],
    tags: '@regression'
  },
  negative: {
    ...common,
    paths: ['features/regression/**/*.feature'],
    tags: '@negative'
  },
  positive: {
    ...common,
    paths: ['features/regression/**/*.feature'],
    tags: '@positive'
  },
  userManagement: {
    ...common,
    paths: ['features/user-management.feature']
  },
  applicationCatalog: {
    ...common,
    paths: ['features/application-scenario-catalog.feature']
  },
  constructionDelivery: {
    ...common,
    paths: ['features/construction-delivery.feature']
  },
  projectManagement: {
    ...common,
    paths: ['features/construction-delivery.feature'],
    tags: '@project-management and @safe'
  }
};
