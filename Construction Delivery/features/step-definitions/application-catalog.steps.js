const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { Given, Then } = require('@cucumber/cucumber');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

function normalizeOptional(value) {
  const text = String(value || '').trim();
  return text && text !== '-' ? text : '';
}

function resolveSourcePath(sourcePath) {
  return path.resolve(PROJECT_ROOT, sourcePath.replace(/\//g, path.sep));
}

Given('the Construction Delivery automation catalog is loaded', function () {
  const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
  assert(fs.existsSync(packageJsonPath), 'package.json must exist for catalog validation.');

  this.automationCatalog = {
    packageJson: JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  };
});

Then(
  'the {string} {string} use case for {string} should be documented with {string} coverage from {string}',
  function (scenarioId, scenarioName, area, coverage, sourcePath) {
    assert(scenarioId.trim(), 'Scenario ID is required.');
    assert(scenarioName.trim(), `Scenario name is required for ${scenarioId}.`);
    assert(area.trim(), `Page or area is required for ${scenarioId}.`);
    assert(coverage.trim(), `Coverage type is required for ${scenarioId}.`);

    const source = normalizeOptional(sourcePath);
    assert(source, `A source file is required for ${scenarioId} - ${scenarioName}.`);
    assert(
      fs.existsSync(resolveSourcePath(source)),
      `${scenarioId} references a missing source file: ${source}`
    );
  }
);

Then('the catalog command {string} should be available when provided', function (command) {
  const commandText = normalizeOptional(command);
  if (!commandText) {
    return;
  }

  const scriptMatch = commandText.match(/^npm run ([^\s]+)/);
  if (!scriptMatch) {
    return;
  }

  const scriptName = scriptMatch[1];
  assert(this.automationCatalog?.packageJson, 'Automation catalog must be loaded before command validation.');
  assert(
    Object.prototype.hasOwnProperty.call(this.automationCatalog.packageJson.scripts || {}, scriptName),
    `package.json is missing script "${scriptName}" for command "${commandText}".`
  );
});
