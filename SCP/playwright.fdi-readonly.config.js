const base = require('./playwright.pending.config');
module.exports = { ...base, testMatch: ['regression/first-delivery-inspections/scp-fdi-readonly.spec.js'] };
