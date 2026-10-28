const path = require('path');
// Project Management scenarios for the full Chrome run; System Messages and Analytics/remaining controls are excluded scope.
if (!process.env.SCP_EXECUTION_DIR) throw new Error('Set SCP_EXECUTION_DIR to a new evidence directory; existing reports must be preserved.');
// Relative forward-slash paths: a Windows drive colon breaks Cucumber's "format:path" parsing.
const run = path.relative(process.cwd(), path.resolve(process.env.SCP_EXECUTION_DIR, 'cucumber')).replace(/\\/g, '/');
module.exports = {
  default: {
    require: ['features/support/**/*.js', 'features/step-definitions/**/*.js'],
    paths: ['features/project-management/**/*.feature'],
    tags: '@projectManagement',
    name: ['^(?!Admin creates a System Message$|Admin checks Analytics and remaining controls$)'],
    format: ['progress', `html:${run}/cucumber-report.html`, `json:${run}/cucumber-report.json`],
    formatOptions: { snippetInterface: 'async-await' },
    parallel: 0
  }
};
