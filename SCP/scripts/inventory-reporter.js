const fs = require('fs');
const path = require('path');
class InventoryReporter extends require('./detailed-execution-reporter') {
  constructor(options) { super(options); this.file = options.outputFile; this.rows = []; }
  onTestEnd(test, result) {
    super.onTestEnd(test, result);
    const blocked = test.annotations.find(a => a.type === 'blocked') ||
      result.errors.map(e => e.message).filter(Boolean).find(message => message.includes('BLOCKED:'));
    this.rows.push({ title: test.title, file: test.location.file, status: this.scenarios.at(-1).status,
      reason: typeof blocked === 'string' ? blocked : blocked?.description, errors: result.errors.map(e => e.message), annotations: test.annotations });
  }
  async onEnd(result) { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file, JSON.stringify({ status: result.status, scenarios: this.rows }, null, 2)); await super.onEnd(result); }
}
module.exports = InventoryReporter;
