const fs = require('fs');
const path = require('path');
const { test: base, expect } = require('@playwright/test');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

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
