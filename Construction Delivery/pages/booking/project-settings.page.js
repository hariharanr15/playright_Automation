const { clickHighlighted } = require('../../utils/highlight');

function optionPattern(value, fallback) {
  if (value instanceof RegExp) {
    return value;
  }
  return new RegExp(value || fallback, 'i');
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class ProjectSettingsPage {
  constructor(page, options = {}) {
    this.page = page;
    this.options = {
      appUrl: process.env.APP_URL || 'https://stg-app.voyagecontrol.com',
      projectId: process.env.PROJECT_ID || process.env.BUCKINGHAM_PALACE_PROJECT_ID || '5ET10000010',
      platformNamePattern: optionPattern(
        process.env.CONSTRUCTION_PLATFORM_NAME_PATTERN,
        'V3 Construction deliveries|Construction Delivery|Construction FM'
      ),
      settleMs: Number(process.env.PROJECT_SETTINGS_SETTLE_MS || 1000),
      ...options
    };
  }

  async waitForAppToSettle(timeout = Number(process.env.PROJECT_SETTINGS_WAIT_TIMEOUT_MS || 90000)) {
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    await this.page.locator('[role="progressbar"], .MuiCircularProgress-root')
      .first()
      .waitFor({ state: 'hidden', timeout })
      .catch(() => null);
    await this.page.locator('.MuiBackdrop-root, [class*="loader" i], [class*="loading" i]')
      .first()
      .waitFor({ state: 'hidden', timeout })
      .catch(() => null);
    if (this.options.settleMs > 0) {
      await this.page.waitForTimeout(this.options.settleMs);
    }
  }

  async openSettings() {
    const targetUrl = `${this.options.appUrl.replace(/\/$/, '')}/${this.options.projectId}/settings`;
    const settingsText = this.page.getByText(/Project Settings|Core Features|Automatic Approval|Automatic Approvals/i).first();

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch(() => null);
      await this.waitForAppToSettle();
      await this.openConstructionAppIfPlatformChooser();
      if (!/\/settings(?:[/?#]|$)/i.test(this.page.url())) {
        await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch(() => null);
      }
      if (await this.waitForSettingsContent(30000)) {
        break;
      }
    }

    const settingsTab = this.page.getByRole('tab', { name: /^Settings$/i }).first();
    if (await settingsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await clickHighlighted(settingsTab, 'Settings tab');
      await this.waitForAppToSettle();
    }

    const coreFeatures = this.page.getByText(/Core Features/i).first();
    if (await coreFeatures.isVisible({ timeout: 3000 }).catch(() => false)) {
      await coreFeatures.scrollIntoViewIfNeeded().catch(() => null);
    }
  }

  async waitForSettingsContent(timeout = 30000) {
    await this.waitForAppToSettle();

    return this.page.waitForFunction(() => {
      if (!/\/settings\/?$/i.test(window.location.pathname)) return false;
      const text = (document.body.innerText || '').replace(/\s+/g, ' ');
      return /Project Settings/i.test(text) &&
        (/Core Features/i.test(text) || /Automatic Approvals?/i.test(text));
    }, null, { timeout, polling: 500 }).then(() => true).catch(() => false);
  }

  async openConstructionAppIfPlatformChooser() {
    if (!/\/api\/sso\/platforms\/choose/i.test(this.page.url())) {
      return false;
    }

    const appHost = new URL(this.options.appUrl).host;
    const platformNameSource = this.options.platformNamePattern.source;

    await this.page.waitForFunction(({ host, platformSource }) => {
      const platformPattern = new RegExp(platformSource, 'i');
      return Array.from(document.querySelectorAll('a[href]'))
        .some((anchor) => {
          const label = (anchor.innerText || anchor.textContent || '').replace(/\s+/g, ' ').trim();
          let hrefHostMatches = false;
          try {
            hrefHostMatches = new URL(anchor.href).host === host && /\/login/i.test(new URL(anchor.href).pathname);
          } catch {
            hrefHostMatches = false;
          }
          return hrefHostMatches || platformPattern.test(label);
        });
    }, {
      host: appHost,
      platformSource: platformNameSource
    }, { timeout: Number(process.env.PROJECT_SETTINGS_WAIT_TIMEOUT_MS || 90000) }).catch(() => null);

    const appHref = await this.page.evaluate(({ host, platformSource }) => {
      const platformPattern = new RegExp(platformSource, 'i');
      return Array.from(document.querySelectorAll('a[href]'))
        .find((anchor) => {
          const label = (anchor.innerText || anchor.textContent || '').replace(/\s+/g, ' ').trim();
          let hrefHostMatches = false;
          try {
            const hrefUrl = new URL(anchor.href);
            hrefHostMatches = hrefUrl.host === host && /\/login/i.test(hrefUrl.pathname);
          } catch {
            hrefHostMatches = false;
          }
          return hrefHostMatches || platformPattern.test(label);
        })?.href || null;
    }, {
      host: appHost,
      platformSource: platformNameSource
    }).catch(() => null);

    if (!appHref) {
      return false;
    }

    await this.page.goto(appHref, { waitUntil: 'domcontentloaded' }).catch(() => null);
    await this.waitForAppToSettle();
    return true;
  }

  async openV3AppIfPlatformChooser() {
    return this.openConstructionAppIfPlatformChooser();
  }

  async openProjectSettingTab(tabName = 'Settings') {
    await this.openSettings();
    const tabPattern = tabName instanceof RegExp ? tabName : new RegExp(`^${escapeRegex(tabName)}$`, 'i');
    const tab = this.page.getByRole('tab', { name: tabPattern }).first();
    if (await tab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await clickHighlighted(tab, `${tabName} tab`);
      await this.waitForAppToSettle();
    }
  }

  async findSwitch(labelPattern, indexFallback = 0) {
    const byLabel = this.page.getByLabel(labelPattern).first();
    if (await byLabel.isVisible({ timeout: 2500 }).catch(() => false)) {
      return byLabel;
    }

    const marked = await this.page.evaluate(({ labelSource, index }) => {
      document.querySelectorAll('[data-vc-setting-switch="true"]').forEach((element) => {
        element.removeAttribute('data-vc-setting-switch');
      });

      const labelRegex = new RegExp(labelSource, 'i');
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden';
      };
      const textOf = (element) => (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
      const switchFor = (labelElement) => {
        let current = labelElement;
        for (let depth = 0; current && depth < 8; depth += 1) {
          const switches = Array.from(current.querySelectorAll(
            'input[type="checkbox"], [role="switch"], .MuiSwitch-input'
          ));
          if (switches.length) return switches[0];
          current = current.parentElement;
        }
        return null;
      };

      const labels = Array.from(document.querySelectorAll('label, span, p, div, h1, h2, h3, h4'))
        .filter(isVisible)
        .filter((element) => labelRegex.test(textOf(element)));

      for (const label of labels) {
        const match = switchFor(label);
        if (match) {
          match.setAttribute('data-vc-setting-switch', 'true');
          return true;
        }
      }

      const allSwitches = Array.from(document.querySelectorAll('input[type="checkbox"], [role="switch"], .MuiSwitch-input'));
      const fallback = allSwitches[index];
      if (!fallback) return false;
      fallback.setAttribute('data-vc-setting-switch', 'true');
      return true;
    }, { labelSource: labelPattern.source, index: indexFallback });

    if (!marked) {
      throw new Error(`${labelPattern} switch was not available in Project Settings.`);
    }

    return this.page.locator('[data-vc-setting-switch="true"]').first();
  }

  async isSwitchChecked(switchLocator) {
    const direct = await switchLocator.isChecked().catch(() => null);
    if (direct !== null) {
      return direct;
    }

    return switchLocator.evaluate((element) => (
      element.checked ||
      element.getAttribute('aria-checked') === 'true' ||
      /\bchecked\b|\bactive\b|\bMui-checked\b/i.test(String(element.className || element.parentElement?.className || ''))
    ));
  }

  async setSwitch(labelPattern, enabled, indexFallback = 0) {
    const toggle = await this.findSwitch(labelPattern, indexFallback);
    const current = await this.isSwitchChecked(toggle);
    if (current !== enabled) {
      await toggle.setChecked(enabled, { force: true }).catch(async () => {
        await toggle.evaluate((input, value) => {
          const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');
          if (descriptor?.set) {
            descriptor.set.call(input, value);
          } else {
            input.checked = value;
          }
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }, enabled);
      });
    }
    await this.waitForAppToSettle();
    return this.isSwitchChecked(toggle);
  }

  async saveIfAvailable() {
    const candidates = [
      this.page.getByRole('button', { name: /^Save$/i }).first(),
      this.page.locator('button:has-text("Save")').first()
    ];

    for (const candidate of candidates) {
      if (await candidate.isVisible({ timeout: 3000 }).catch(() => false)) {
        await clickHighlighted(candidate, 'Save Project Settings');
        await this.waitForAppToSettle();
        return true;
      }
    }

    return false;
  }

  async setAutomaticApprovals(enabled) {
    await this.openSettings();
    const actualValue = await this.setSwitch(/Automatic Approval|Automatic Approvals/i, enabled, 0);
    await this.saveIfAvailable();
    return {
      requested: enabled,
      actual: actualValue
    };
  }

  async setEmissionSettings(enabled) {
    await this.openSettings();
    const actualValue = await this.setSwitch(/Emission Settings|Emissions/i, enabled, 1);
    await this.saveIfAvailable();
    return {
      requested: enabled,
      actual: actualValue
    };
  }
}

module.exports = { ProjectSettingsPage };
