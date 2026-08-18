const { After, Before, Status } = require('@cucumber/cucumber');

function hasTag(scenario, tagName) {
  return scenario.pickle?.tags?.some((tag) => tag.name === tagName);
}

Before(async function (scenario) {
  if (hasTag(scenario, '@catalog') || hasTag(scenario, '@documentation-only')) {
    return;
  }

  await this.openBrowser();
});

After(async function (scenario) {
  const video = this.page?.video?.();

  if (scenario.result?.status === Status.FAILED && this.page) {
    const screenshot = await this.page.screenshot({ fullPage: true }).catch(() => null);
    if (screenshot) {
      await this.attach(screenshot, 'image/png');
    }

    await this.attach(`Failed URL: ${this.page.url()}`, 'text/plain');

    if (this.consoleErrors?.length) {
      await this.attach(`Console errors:\n${this.consoleErrors.slice(-20).join('\n')}`, 'text/plain');
    }

    if (this.networkFailures?.length) {
      await this.attach(`Network failures:\n${this.networkFailures.slice(-20).join('\n')}`, 'text/plain');
    }
  }

  await this.closeBrowser();

  if (scenario.result?.status === Status.FAILED && video) {
    const videoPath = await video.path().catch(() => '');
    if (videoPath) {
      await this.attach(`Video: ${videoPath}`, 'text/plain');
    }
  }
});
