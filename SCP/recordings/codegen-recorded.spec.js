import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://stg-login.voyagecontrol.com/api/sso/users/login/');
});
