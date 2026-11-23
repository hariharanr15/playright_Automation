const { After, AfterAll, AfterStep, Before, Status } = require('@cucumber/cucumber');
const { captureEvidence, redactUrl, safeName } = require('../../utils/evidence');
const { closeBrowserSession } = require('./browser-session');

Before(async function (scenario) {
  this.scenarioName = scenario.pickle.name;
  this.testCaseId = scenario.pickle.tags
    .map((tag) => tag.name.replace(/^@/, ''))
    .find((tag) => /^TC_/i.test(tag)) || scenario.pickle.name;
  this.stepNumber = 0;
  await this.openBrowser();
});

AfterStep(async function ({ pickleStep, result }) {
  this.stepNumber += 1;
  const stepName = `${this.testCaseId}_Step_${String(this.stepNumber).padStart(2, '0')}_${pickleStep.text}`;
  await captureEvidence(this.page, this.attach, stepName).catch(() => null);
  if (result?.status === Status.FAILED) {
    await captureEvidence(this.page, this.attach, `${stepName}_FAILED`).catch(() => null);
  }
});

After(async function (scenario) {
  if (scenario.result?.status === Status.FAILED && this.page) {
    await captureEvidence(this.page, this.attach, `FAILED_${safeName(scenario.pickle.name)}`).catch(() => null);
    await this.attach(`Failed URL: ${redactUrl(this.page.url())}`, 'text/plain');

    if (this.consoleErrors.length) {
      await this.attach(`Console errors:\n${this.consoleErrors.slice(-20).join('\n')}`, 'text/plain');
    }
    if (this.networkFailures.length) {
      await this.attach(`Network failures:\n${this.networkFailures.slice(-20).join('\n')}`, 'text/plain');
    }
  }

  if (this.runData?.dataUsage?.length) {
    await this.attach(JSON.stringify({
      runId: this.runData.runId,
      dataUsage: this.runData.dataUsage
    }, null, 2), 'application/json');
  }

  const businessDefects = this.runData?.businessDefects || [];
  if (this.runData) this.runData.businessDefects = [];
  if (businessDefects.length && this.page) {
    await captureEvidence(this.page, this.attach, 'DEFERRED_BUSINESS_DEFECTS').catch(() => null);
    await this.attach(`Business defects:\n${businessDefects.join('\n')}`, 'text/plain');
  }

  await this.closeBrowser();

  if (businessDefects.length) {
    throw new Error(`Deferred SCP business validation failed:\n${businessDefects.join('\n')}`);
  }
});

AfterAll(async function () {
  await closeBrowserSession();
});
