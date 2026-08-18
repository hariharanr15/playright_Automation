const path = require('path');
const { test: base, expect } = require('@playwright/test');
const { loadEnvFile } = require('../utils/env');

loadEnvFile(path.resolve(__dirname, '..', '.env'));

const test = base.extend({
  app: async ({ page }, use) => {
    const baseUrl = process.env.BASE_URL;

    if (!baseUrl) {
      throw new Error('BASE_URL is not configured. Add it to .env or the environment.');
    }

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await use(page);
  }
});

module.exports = { test, expect };
