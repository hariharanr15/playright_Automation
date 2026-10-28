const base = require('./playwright.pending.config');
// Explicit read-only scope; qualified mutation suites keep their dedicated configs.
module.exports = { ...base, testMatch: [...base.testMatch,
  'smoke/procurement-log/scp-procurement-readonly.spec.js'] };
