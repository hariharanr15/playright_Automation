const { expect } = require('@playwright/test');
const { clickHighlighted, fillHighlighted, highlight } = require('../utils/highlight');
const { getActionDelayMs } = require('../utils/execution-mode');
const { redactUrl } = require('../utils/evidence');

class BasePage {
  constructor(page) {
    this.page = page;
  }

  getActionIntervalMs() {
    return getActionDelayMs();
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
      throw new Error(`${label} was not visible. Current URL: ${redactUrl(this.page.url())}`);
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

  async clearSearchAndPause(locator, label = 'Search') {
    const field = locator.first();
    await field.waitFor({ state: 'visible', timeout: 20000 });
    await highlight(field, label).catch(() => null);
    await field.fill('');
    await expect(field, `${label} should be cleared`).toHaveValue('');
    // Visual-only pause so observers can see the cleared state.
    await this.page.waitForTimeout(1000);
  }

  fieldBesideLabel(labelText, selector = 'input, textarea') {
    return this.page.locator('label')
      .filter({ hasText: labelText })
      .first()
      .locator('..')
      .locator(selector)
      .first();
  }

  async selectDropdownOption(trigger, optionName, label) {
    await this.clickFirstVisible([{ locator: trigger, label }], label, 10000);
    const escapedOptionName = String(optionName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const option = this.page.getByRole('option', { name: new RegExp(`^${escapedOptionName}$`, 'i') });
    await option.first().waitFor({ state: 'visible', timeout: 10000 });
    await this.clickFirstVisible([{ locator: option, label: optionName }], `${label} option ${optionName}`, 10000);
  }

  async selectFirstDropdownOption(trigger, label) {
    await this.clickFirstVisible([{ locator: trigger, label }], label, 10000);
    const options = this.page.locator('[role="option"]:visible');
    await options.first().waitFor({ state: 'visible', timeout: 10000 });
    const count = await options.count();

    for (let index = 0; index < count; index += 1) {
      const option = options.nth(index);
      const text = (await option.innerText()).replace(/\s+/g, ' ').trim();
      if (!text || /^(choose|select)\b/i.test(text)) continue;
      await this.clickFirstVisible([{ locator: option, label: text }], `${label} option`, 5000);
      return text;
    }

    throw new Error(`${label} did not contain an available option. Current URL: ${redactUrl(this.page.url())}`);
  }
}

module.exports = { BasePage };
