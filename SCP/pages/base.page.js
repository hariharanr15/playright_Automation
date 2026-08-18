const { expect } = require('@playwright/test');
const { clickHighlighted, fillHighlighted, highlight } = require('../utils/highlight');

class BasePage {
  constructor(page) {
    this.page = page;
  }

  getActionIntervalMs() {
    return Number(process.env.SCP_ACTION_INTERVAL_MS || process.env.ACTION_PAUSE_MS || 1000);
  }

  async pauseAfterOperation() {
    const intervalMs = this.getActionIntervalMs();
    if (intervalMs > 0) {
      await this.page.waitForTimeout(intervalMs);
    }
  }

  async goto(url, options = {}) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', ...options });
    await this.waitForReady();
    await this.pauseAfterOperation();
  }

  async waitForReady() {
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    await this.page.locator('[role="progressbar"], .loader, .spinner, [aria-busy="true"]').first()
      .waitFor({ state: 'hidden', timeout: 10000 })
      .catch(() => null);
  }

  async firstVisible(candidates, timeout = 5000) {
    for (const candidate of candidates) {
      const locator = candidate.locator || candidate;
      if (await locator.first().isVisible({ timeout }).catch(() => false)) {
        return candidate;
      }
    }

    return null;
  }

  async clickFirstVisible(candidates, label, timeout = 5000) {
    const match = await this.firstVisible(candidates, timeout);

    if (!match) {
      throw new Error(`${label} was not visible. Current URL: ${this.page.url()}`);
    }

    const locator = (match.locator || match).first();
    await clickHighlighted(locator, match.label || label);
    await this.waitForReady();
    await this.pauseAfterOperation();
    return match;
  }

  async fillVisible(locator, value, label) {
    await fillHighlighted(locator.first(), value, label);
    await this.pauseAfterOperation();
  }

  async expectVisible(locator, label, timeout = 20000) {
    await locator.first().waitFor({ state: 'visible', timeout });
    await highlight(locator.first(), label).catch(() => null);
    await expect(locator.first(), `${label} should be visible`).toBeVisible();
  }
}

module.exports = { BasePage };
