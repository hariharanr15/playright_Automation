const path = require('path');
const { test: base, expect } = require('@playwright/test');
const { loadEnvFile } = require('../utils/env');
const { getScpConfig } = require('../config/scp.config');
const { AppShellPage } = require('../pages/app-shell.page');

loadEnvFile(path.resolve(__dirname, '..', '.env'));

const test = base.extend({
  scpApp: async ({ page }, use) => {
    const config = getScpConfig();

    if (!config.baseUrl && !config.loginUrl) {
      throw new Error('SCP_BASE_URL is not configured. Add it to SCP/.env or the environment.');
    }

    const appShell = new AppShellPage(page, config);
    await appShell.open();

    await use({
      page,
      appShell,
      config
    });
  }
});

module.exports = { test, expect };
