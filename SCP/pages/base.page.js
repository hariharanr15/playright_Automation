const { expect } = require('@playwright/test');
const { clickHighlighted, fillHighlighted, highlight } = require('../utils/highlight');
const { getActionDelayMs } = require('../utils/execution-mode');
const { redactUrl } = require('../utils/evidence');

class BasePage {
  constructor(page) {
    this.page = page;
    const wrappers = new Map();
    return new Proxy(this, { get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (typeof value !== 'function' || value.constructor.name !== 'AsyncFunction') return value;
      if (!wrappers.has(key) || wrappers.get(key).original !== value) {
        const wrapped = function (...args) {
          const { currentJournal, managedStep } = require('../utils/scp-step');
          const { activeStep } = require('../utils/execution-journal');
          if (!currentJournal() || activeStep.getStore()) return value.apply(receiver, args);
          const description = `${target.constructor.name}: ${String(key).replace(/([A-Z])/g, ' $1').toLowerCase()}`;
          return managedStep(require('@playwright/test').test, page, description, () => value.apply(receiver, args), {
            mutation: /^(create|add|save|update|assign|selfAssign|submit|generate|delete|invite)/.test(String(key)),
            group: key === 'completeOwnedDelivery',
            ...(typeof target.stepOptions === 'function' ? target.stepOptions(key, args) : {})
          });
        };
        wrappers.set(key, { original: value, wrapped });
      }
      return wrappers.get(key).wrapped;
    } });
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
    const response = await this.page.goto(url, { waitUntil: 'domcontentloaded', ...options });
    if (response?.status() >= 500) {
      const error = new Error(`Configured application page returned HTTP ${response.status()}`);
      error.failureCategory = 'Environment'; throw error;
    }
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
    // isVisible() returns immediately; its timeout option does not wait for a menu to render.
    const deadline = Date.now() + timeout;
    do {
      for (const candidate of candidates) {
        const locator = candidate.locator || candidate;
        if (await locator.first().isVisible().catch(() => false)) return candidate;
      }
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      await new Promise(resolve => setTimeout(resolve, Math.min(100, remaining)));
    } while (Date.now() <= deadline);
    return null;
  }

  async clickFirstVisible(candidates, label, timeout = 5000) {
    const match = await this.firstVisible(candidates, timeout);

    if (!match) {
      throw new Error(`${label} was not visible. Current URL: ${redactUrl(this.page.url())}`);
    }

    const locator = (match.locator || match).first();
    // clickHighlighted already applies the visual pause; wait for readiness before the next action.
    await clickHighlighted(locator, match.label || label);
    await this.waitForReady();
    return match;
  }

  async fillVisible(locator, value, label) {
    await fillHighlighted(locator.first(), value, label);
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
    await this.pauseAfterOperation();
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
