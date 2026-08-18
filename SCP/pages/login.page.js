const { BasePage } = require('./base.page');

const EMAIL_SELECTOR = [
  'input[type="email"]',
  'input[name*="email" i]',
  'input[name*="user" i]',
  'input[id*="email" i]',
  'input[id*="user" i]',
  'input[placeholder*="email" i]',
  'input[placeholder*="user" i]'
].join(', ');

const PASSWORD_SELECTOR = [
  'input[type="password"]',
  'input[name*="password" i]',
  'input[id*="password" i]',
  'input[placeholder*="password" i]'
].join(', ');

class LoginPage extends BasePage {
  constructor(page) {
    super(page);
    this.emailField = page.locator(EMAIL_SELECTOR).first();
    this.passwordField = page.locator(PASSWORD_SELECTOR).first();
    this.loginButton = page.getByRole('button', { name: /login|sign in|submit/i }).first();
    this.submitFallback = page.locator('button[type="submit"], input[type="submit"]').first();
  }

  async isVisible(timeout = 5000) {
    return this.emailField.isVisible({ timeout }).catch(() => false);
  }

  async login(username, password) {
    if (!username || !password) {
      throw new Error('SCP login form is visible, but SCP_USERNAME/SCP_PASSWORD are not configured.');
    }

    await this.fillVisible(this.emailField, username, 'SCP username');
    await this.fillVisible(this.passwordField, password, 'SCP password');

    if (await this.loginButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.clickFirstVisible([{ locator: this.loginButton, label: 'Login' }], 'Login button');
    } else {
      await this.clickFirstVisible([{ locator: this.submitFallback, label: 'Submit login' }], 'Submit login');
    }

    await this.waitForReady();
    await this.pauseAfterOperation();
  }

  async loginIfVisible(config) {
    if (!(await this.isVisible())) {
      return false;
    }

    await this.login(config.username, config.password);
    return true;
  }
}

module.exports = { LoginPage };
