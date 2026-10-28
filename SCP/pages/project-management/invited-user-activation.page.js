const { expect } = require('@playwright/test');
const { BasePage } = require('../base.page');
const { LoginPage } = require('../login.page');
const { ManagementDashboardPage } = require('../management-dashboard/management-dashboard.page');
const { PlatformChooserPage } = require('../platform-chooser.page');
const { ProjectSelectorPage } = require('../project-selector.page');
const { FirstDeliveryInspectionsPage } = require('../first-delivery-inspections/first-delivery-inspections.page');

class InvitedUserActivationPage extends BasePage {
  constructor(page, config) {
    super(page);
    this.config = config;
    this.invitationEmail = null;
  }

  async openInvitationFromYopmail(email) {
    this.invitationEmail = email;
    const mailboxUrl = new URL(this.config.yopmailUrl);
    mailboxUrl.searchParams.set('login', email.split('@')[0]);
    const context = this.page.context();
    let activationUrl = null;

    // The mailbox is reopened until the invitation arrives (about 3 minutes); the newest message is shown first.
    let latestSubject = null;
    const deadline = Date.now() + Number(process.env.SCP_INVITE_DELIVERY_MS || 180000);
    while (!activationUrl && Date.now() < deadline) {
      if (this.page.isClosed()) this.page = await context.newPage();
      await this.goto(mailboxUrl.toString());
      const mailboxReady = await this.page.locator('iframe#ifmail')
        .waitFor({ state: 'attached', timeout: 15000 }).then(() => true).catch(() => false);
      if (!mailboxReady) throw new Error('Invitation mailbox frame was unavailable within 15 seconds.');
      const mail = this.page.frameLocator('iframe#ifmail');
      const acceptInvite = mail.getByRole('link', { name: 'Accept Invite', exact: true });
      if (await acceptInvite.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false)) {
        activationUrl = await acceptInvite.getAttribute('href');
        break;
      }
      latestSubject = await mail.locator('body').innerText({ timeout: 5000 }).then(text => text.match(/PROJECT ROLE ASSIGNED|You have been invited[^\n]*/i)?.[0] || null).catch(() => null);
      if (/PROJECT ROLE ASSIGNED/i.test(latestSubject || '')) {
        throw new Error(`${email} is already a registered user: the newest email is "Project Role Assigned", not an invitation. Use an address that has not been invited before.`);
      }
      await this.page.waitForTimeout(15000);
    }

    if (!activationUrl) {
      throw new Error(`YOPmail did not receive an invitation for ${email} within the delivery window${latestSubject ? ` (newest message: ${latestSubject})` : ''}.`);
    }

    if (this.page.isClosed()) this.page = await context.newPage();
    const targetUrl = new URL(activationUrl, this.config.loginUrl).toString();
    if (this.page.url() !== targetUrl) await this.goto(targetUrl);
    await expect(this.page.getByRole('heading', { name: 'Welcome To Voyage Control', exact: true })).toBeVisible();
    await expect.poll(async () => (
      await this.page.locator('input[name="username"]').inputValue()
    ).toLowerCase()).toBe(email.toLowerCase());
    return this.page;
  }

  async setInvitationPassword(password) {
    // The invited user's password comes only from SCP_INVITED_USER_PASSWORD in the local .env; it is never hardcoded.
    if (!password) {
      const { ScpBlocked } = require('../../utils/scp-readonly');
      throw new ScpBlocked('Set SCP_INVITED_USER_PASSWORD in SCP/.env for users invited by the tests');
    }
    await this.fillVisible(
      this.page.locator('input[name="password"]'),
      password,
      'Create invited user password'
    );
    await this.clickFirstVisible([{
      locator: this.page.getByRole('button', { name: 'Next', exact: true }),
      label: 'Continue account activation'
    }], 'Continue account activation', 10000);
    await expect(this.page.getByRole('heading', { name: 'Set Up Your Profile', exact: true })).toBeVisible();
  }

  async loginForProfileCompletion(user) {
    await this.goto(this.config.loginUrl);
    const login = new LoginPage(this.page);
    await login.login(user.email, user.password);
    await this.page.waitForURL((url) => (
      /\/api\/sso\/users\/set-profile\//i.test(url.pathname) ||
      /\/api\/sso\/platforms\/choose\//i.test(url.pathname) ||
      url.origin === new URL(this.config.baseUrl).origin
    ), { timeout: 45000 });
  }

  async completeProfileAndAddress(user) {
    if (!/^\d{10}$/.test(user.phoneNumber)) {
      throw new Error(`Invited-user mobile number must contain exactly 10 digits. Received: ${user.phoneNumber}`);
    }

    await this.fillVisible(this.page.locator('input[name="first_name"]'), user.firstName, 'First Name');
    await this.fillVisible(this.page.locator('input[name="last_name"]'), user.lastName, 'Last Name');
    const countryCode = this.page.locator('select[name="phone_number_0"]');
    await countryCode.selectOption({ label: 'IN +91' });
    await expect(countryCode).toHaveValue(/IN|91/i);
    await this.pauseAfterOperation();
    await this.fillVisible(
      this.page.locator('input[name="phone_number_1"]'),
      user.phoneNumber,
      '10-digit mobile number'
    );
    await expect(this.page.locator('input[name="phone_number_1"]')).toHaveValue(user.phoneNumber);
    await this.clickFirstVisible([{
      locator: this.page.getByRole('button', { name: 'Submit', exact: true }),
      label: 'Submit invited user profile'
    }], 'Submit invited user profile', 10000);

    const addressPresented = await expect.poll(async () => (
      (await this.addressLineOne().isVisible().catch(() => false)) || this.isActivationComplete()
    ), {
      message: 'Activation should continue to an address form or the SCP application',
      timeout: 45000
    }).toBeTruthy().then(() => this.addressLineOne().isVisible().catch(() => false));

    if (addressPresented) {
      await this.completeAddress(user);
    }
    await this.waitForApplicationLanding();
    return { addressPresented };
  }

  addressLineOne() {
    return this.page.getByLabel(/Address(?: Line)? 1/i).or(
      this.page.locator('input[name*="address_1" i], input[name*="address1" i]')
    ).first();
  }

  async firstVisibleField(candidates, label) {
    const match = await this.firstVisible(candidates.map((locator) => ({ locator, label })), 3000);
    if (!match) {
      throw new Error(`${label} was required by the activation address form but was not available.`);
    }
    return match.locator.first();
  }

  async completeAddress(user) {
    const addressOne = await this.firstVisibleField([
      this.addressLineOne()
    ], 'Address Line 1');
    const addressTwo = await this.firstVisibleField([
      this.page.getByLabel(/Address(?: Line)? 2/i),
      this.page.locator('input[name*="address_2" i], input[name*="address2" i]')
    ], 'Address Line 2');
    const city = await this.firstVisibleField([
      this.page.getByLabel(/^City/i),
      this.page.locator('input[name*="city" i]')
    ], 'City');
    const postalCode = await this.firstVisibleField([
      this.page.getByLabel(/PIN|ZIP|Postal/i),
      this.page.locator('input[name*="zip" i], input[name*="postal" i]')
    ], 'PIN/ZIP Code');

    await this.fillVisible(addressOne, user.addressLine1, 'Address Line 1');
    await this.fillVisible(addressTwo, user.addressLine2, 'Address Line 2');
    await this.selectAddressValue('State', user.state);
    await this.fillVisible(city, user.city, 'City');
    await this.selectAddressValue('Country', user.country);
    await this.fillVisible(postalCode, user.postalCode, 'PIN/ZIP Code');

    const completeButton = this.page.getByRole('button', {
      name: /^(?:Save|Submit|Next|Complete)$/i
    }).last();
    await this.clickFirstVisible([{
      locator: completeButton,
      label: 'Complete activation address'
    }], 'Complete activation address', 10000);
  }

  async selectAddressValue(labelText, value) {
    const label = this.page.locator('label').filter({
      hasText: new RegExp(`^\\s*${labelText}`, 'i')
    }).first();
    const container = label.locator('..');
    const nativeSelect = container.locator('select').first();
    if (await nativeSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nativeSelect.selectOption({ label: value });
      await this.pauseAfterOperation();
      return;
    }

    const input = container.locator('input').first();
    if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
      await this.fillVisible(input, value, labelText);
      return;
    }

    const trigger = container.getByRole('button').first();
    await this.selectDropdownOption(trigger, value, labelText);
  }

  isActivationComplete() {
    const current = new URL(this.page.url());
    const app = new URL(this.config.baseUrl);
    return (
      current.origin === app.origin && !/^\/auth\/?$/i.test(current.pathname)
    ) || /\/api\/sso\/platforms\/choose\//i.test(current.pathname);
  }

  async waitForApplicationLanding() {
    const appOrigin = new URL(this.config.baseUrl).origin;
    await this.page.waitForURL((url) => (
      (url.origin === appOrigin && !/^\/auth\/?$/i.test(url.pathname)) ||
      /\/api\/sso\/platforms\/choose\//i.test(url.pathname)
    ), { timeout: 60000 });
    await this.waitForReady();
  }

  async logout(firstName = 'FDI') {
    const chooserLogout = this.page.getByRole('link', { name: /Logout/i }).first();
    if (await chooserLogout.isVisible({ timeout: 2000 }).catch(() => false)) {
      await chooserLogout.click();
      await this.page.waitForURL(/stg-login\.voyagecontrol\.com|\/api\/sso\/platforms\/choose\//i, {
        timeout: 30000
      });
      return;
    }

    const initials = firstName.trim().split(/\s+/).map((part) => part.charAt(0)).join('').toUpperCase();
    const initial = initials.charAt(0);
    const avatar = this.page.getByRole('button', { name: initials, exact: true }).last();
    const fallbackAvatar = this.page.getByRole('button', { name: initial, exact: true }).last();
    const genericAvatar = this.page.getByRole('button', { name: /^[A-Z]{1,2}$/ }).last();
    const userMenu = await avatar.isVisible({ timeout: 3000 }).catch(() => false)
      ? avatar
      : await fallbackAvatar.isVisible({ timeout: 1000 }).catch(() => false)
        ? fallbackAvatar
        : genericAvatar;
    await this.clickFirstVisible([{
      locator: userMenu,
      label: 'Invited user menu'
    }], 'Invited user menu', 10000);
    await this.clickFirstVisible([
      { locator: this.page.getByRole('menuitem', { name: 'Logout', exact: true }), label: 'Logout invited user' },
      { locator: this.page.getByRole('button', { name: /^Log ?out$/i }), label: 'Logout invited user' },
      { locator: this.page.getByRole('link', { name: /^Log ?out$/i }), label: 'Logout invited user' }
    ], 'Logout invited user', 10000);
    await this.page.waitForURL(/stg-login\.voyagecontrol\.com|\/api\/sso\/platforms\/choose\//i, {
      timeout: 30000
    });
  }

  async loginAndVerifyInspectorAccess(user, expectedAvailable) {
    await this.goto(this.config.loginUrl);
    const login = new LoginPage(this.page);
    await login.login(user.email, user.password);

    const appOrigin = new URL(this.config.baseUrl).origin;
    await this.page.waitForURL((url) => (
      (url.origin === appOrigin && !/^\/auth\/?$/i.test(url.pathname)) ||
      /\/api\/sso\/platforms\/choose\//i.test(url.pathname)
    ), { timeout: 45000 });

    const platformChooser = new PlatformChooserPage(this.page, this.config);
    const dashboard = new ManagementDashboardPage(this.page, this.config);
    if (/\/api\/sso\/platforms\/choose\//i.test(new URL(this.page.url()).pathname)) {
      const platformLink = this.page.getByRole('link', {
        name: this.config.platformName,
        exact: true
      });
      if (!(await platformLink.isVisible({ timeout: 5000 }).catch(() => false))) {
        return {
          platformAvailable: false,
          reason: `${user.email} authenticated but has no ${this.config.platformName} platform assignment.`
        };
      }
      await platformChooser.openSupplyChainPlanner();
      await dashboard.expectLoaded();
    } else {
      await dashboard.open();
    }
    const projectSelector = new ProjectSelectorPage(this.page, this.config);
    await projectSelector.ensureProject(this.config.projectName);

    const inspections = new FirstDeliveryInspectionsPage(this.page, this.config);
    await inspections.open(dashboard);
    if (expectedAvailable === true) {
      await inspections.expectInspectorCanSelfAssign();
    } else if (expectedAvailable === false) {
      await inspections.expectInspectorCannotSelfAssign();
    } else {
      await inspections.expectInspectorCanOpenPage();
    }
    return { platformAvailable: true };
  }
}

module.exports = { InvitedUserActivationPage };
