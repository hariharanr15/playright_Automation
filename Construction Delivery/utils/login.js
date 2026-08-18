const LOGIN_EMAIL_SELECTOR = [
  'input[type="email"]',
  'input[name*="email" i]',
  'input[id*="email" i]',
  'input[placeholder*="email" i]'
].join(', ');

const LOGIN_PASSWORD_SELECTOR = [
  'input[type="password"]',
  'input[name*="password" i]',
  'input[id*="password" i]',
  'input[placeholder*="password" i]'
].join(', ');

function getLoginFields(page) {
  return {
    emailField: page.locator(LOGIN_EMAIL_SELECTOR).first(),
    passwordField: page.locator(LOGIN_PASSWORD_SELECTOR).first()
  };
}

async function loginIfVisible(page, options = {}) {
  const {
    email,
    password,
    visibleTimeout = 5000,
    postLoginWaitMs = 1500,
    errorMessage = 'Login did not complete; check VC_EMAIL/VC_PASSWORD.',
    missingCredentialsMessage = 'Login page is visible and VC_EMAIL/VC_PASSWORD are not configured.',
    storageStatePath,
    fill = async (locator, value) => locator.fill(value),
    click = async (locator) => locator.click()
  } = options;
  const { emailField, passwordField } = getLoginFields(page);

  if (!(await emailField.isVisible({ timeout: visibleTimeout }).catch(() => false))) {
    return false;
  }

  if (!email || !password) {
    throw new Error(missingCredentialsMessage);
  }

  await fill(emailField, email, 'Email');
  await fill(passwordField, password, 'Password');

  const loginButton = page.getByRole('button', { name: /^Login$/i }).first();
  await Promise.all([
    page.waitForLoadState('domcontentloaded').catch(() => null),
    click(loginButton, 'Login')
      .catch(async () => page.locator('button:has-text("Login"), input[type="submit"]').first().click())
  ]);

  if (postLoginWaitMs > 0) {
    await page.waitForTimeout(postLoginWaitMs);
  }

  await Promise.race([
    emailField.waitFor({ state: 'hidden', timeout: 8000 }).catch(() => null),
    page.waitForURL((url) => !/\/api\/sso\/users\/login/i.test(url.href), { timeout: 8000 }).catch(() => null)
  ]);

  if (await emailField.isVisible({ timeout: 1000 }).catch(() => false)) {
    const pageText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '');
    const visibleMessage = pageText
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 240);
    throw new Error(`${errorMessage} Login page is still visible. Page text: ${visibleMessage || '-'}`);
  }

  if (storageStatePath) {
    await page.context().storageState({ path: storageStatePath }).catch(() => null);
  }

  return true;
}

module.exports = {
  getLoginFields,
  loginIfVisible
};
