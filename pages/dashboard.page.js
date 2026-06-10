const { clickHighlighted } = require('../utils/highlight');

class DashboardPage {
  constructor(page) {
    this.page = page;

    this.projectLink = page.getByRole('link', { name: 'V3 Construction deliveries' });
    this.projectLinkFallback1 = page.getByText('V3 Construction deliveries');
    this.projectLinkFallback2 = page.locator('a:has-text("V3 Construction")');
    this.projectLinkFallback3 = page.locator('[href*="construction"], [href*="v3"]');

    this.location = page.getByRole('heading', { name: 'Buckingham Palace' });
    this.locationFallback1 = page.getByText('Buckingham Palace').first();
    this.locationFallback2 = page.locator('[title*="Buckingham"], [alt*="Buckingham"]');

    this.bookingMenu = page.getByRole('link', { name: /Booking/i });
    this.bookingMenuFallback1 = page.getByText('Booking');
    this.bookingMenuFallback2 = page.locator('a:has-text("Booking")');

    this.newBookingButton = page.getByRole('button', { name: /New Booking/i });
  }

  async isLoaded() {
    await this.page.waitForLoadState('domcontentloaded');
  }

  async loginIfRedirected() {
    const emailField = this.page.locator([
      'input[type="email"]',
      'input[name*="email" i]',
      'input[id*="email" i]',
      'input[placeholder*="email" i]',
      'input[type="text"]'
    ].join(', ')).first();
    const passwordField = this.page.locator([
      'input[type="password"]',
      'input[name*="password" i]',
      'input[id*="password" i]',
      'input[placeholder*="password" i]'
    ].join(', ')).first();

    if (!(await emailField.isVisible({ timeout: 1000 }).catch(() => false))) {
      return false;
    }

    const email = process.env.VC_EMAIL || 'priyanka.dl@neuralrays.ai';
    const password = process.env.VC_PASSWORD || '2C@53WsTQ#&ffSQ&';
    if (!email || !password) {
      throw new Error('Login page is visible and VC_EMAIL/VC_PASSWORD are not configured.');
    }

    await emailField.fill(email);
    await passwordField.fill(password);
    await this.page.getByRole('button', { name: 'Login', exact: true }).click()
      .catch(async () => this.page.locator('button:has-text("Login"), input[type="submit"]').first().click());
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    return true;
  }

  async openPlatformIfChooser() {
    const onPlatformChooser = /\/api\/sso\/platforms\/choose\//i.test(this.page.url());
    if (!onPlatformChooser && !(await this.projectLink.isVisible({ timeout: 1000 }).catch(() => false))) {
      return false;
    }

    if (await this.projectLink.isVisible({ timeout: 1000 }).catch(() => false)) {
      await clickHighlighted(this.projectLink, 'V3 platform');
      await this.page.waitForLoadState('domcontentloaded').catch(() => null);
      return true;
    }

    return false;
  }

  async reselectLocationIfNeeded(label) {
    if (label !== 'Booking menu') {
      return false;
    }

    if (await this.location.isVisible({ timeout: 1000 }).catch(() => false)) {
      await clickHighlighted(this.location, 'Location');
      await this.page.waitForLoadState('domcontentloaded').catch(() => null);
      return true;
    }

    return false;
  }

  async openBookingsDirectlyFromProjectHome() {
    const match = this.page.url().match(/^(https?:\/\/[^/]+)\/([A-Z0-9]+)\/home/i);
    if (!match) {
      return false;
    }

    await this.page.goto(`${match[1]}/${match[2]}/booking`, { waitUntil: 'domcontentloaded' }).catch((error) => {
      if (!/ERR_ABORTED|Navigation interrupted|net::ERR_ABORTED/i.test(error.message)) {
        throw error;
      }
    });
    await this.page.waitForTimeout(1500);
    return true;
  }

  async waitForPageState(locator, label, timeout = 30000) {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      await Promise.race([
        this.page.waitForLoadState('domcontentloaded').catch(() => null),
        this.page.waitForTimeout(1000)
      ]);

      if (await locator.isVisible({ timeout: 1000 }).catch(() => false)) {
        return;
      }

      if (label === 'Booking menu' &&
          await this.newBookingButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        return;
      }

      if (await this.loginIfRedirected()) {
        await this.page.waitForTimeout(1500);
      } else if (await this.openPlatformIfChooser()) {
        await this.page.waitForTimeout(1500);
      } else if (await this.reselectLocationIfNeeded(label)) {
        await this.page.waitForTimeout(1500);
      } else if (label === 'Booking menu' && await this.openBookingsDirectlyFromProjectHome()) {
        await this.page.waitForTimeout(1500);
      }
    }

    throw new Error(`${label} did not load. Current URL: ${this.page.url()}`);
  }

  async clickFirstVisible(candidates, errorMessage) {
    for (const candidate of candidates) {
      try {
        if (await candidate.locator.isVisible({ timeout: candidate.timeout ?? 5000 }).catch(() => false)) {
          await clickHighlighted(candidate.locator, candidate.label);
          return candidate.label;
        }
      } catch (error) {
        console.log(`${candidate.label} failed: ${error.message}`);
      }
    }

    throw new Error(errorMessage);
  }

  async clickLocationProjectCard(locationName = 'Buckingham Palace') {
    if (!/\/project\/choose/i.test(this.page.url())) {
      return false;
    }

    const clicked = await this.page.evaluate((targetLocationName) => {
      const normalize = (value = '') => value.replace(/\s+/g, ' ').trim();
      const elements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, div, a, button'));
      const heading = elements.find((element) => normalize(element.textContent) === targetLocationName);

      if (!heading) {
        return false;
      }

      let card = heading;
      while (card.parentElement && card.parentElement !== document.body) {
        if (/Log Into/i.test(card.innerText || card.textContent || '')) {
          break;
        }
        card = card.parentElement;
      }

      const clickTarget = Array.from(card.querySelectorAll('p, a, button, img'))
        .find((element) => /Log Into/i.test(element.innerText || element.textContent || '') || element.tagName.toLowerCase() === 'a') ||
        card;

      clickTarget.click();
      return true;
    }, locationName);

    if (clicked) {
      await this.page.waitForLoadState('domcontentloaded').catch(() => null);
      await this.page.waitForTimeout(1500);
    }

    return clicked;
  }

  async selectProject() {
    await this.clickFirstVisible([
      { locator: this.projectLink, label: 'Project', timeout: 10000 },
      { locator: this.projectLinkFallback1, label: 'Project fallback 1' },
      { locator: this.projectLinkFallback2, label: 'Project fallback 2' },
      { locator: this.projectLinkFallback3, label: 'Project fallback 3' }
    ], 'Could not click on any project link');

    await this.waitForPageState(this.location, 'Location page');
  }

  async selectLocation() {
    if (await this.clickLocationProjectCard('Buckingham Palace')) {
      await this.waitForPageState(this.bookingMenu, 'Booking menu');
      return;
    }

    await this.clickFirstVisible([
      { locator: this.location, label: 'Location', timeout: 10000 },
      { locator: this.locationFallback1, label: 'Location fallback 1' },
      { locator: this.locationFallback2, label: 'Location fallback 2' }
    ], 'Could not click on any location');

    await this.waitForPageState(this.bookingMenu, 'Booking menu');
  }

  async goToBookings() {
    if (/\/booking\b/i.test(this.page.url()) &&
        await this.newBookingButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      return;
    }

    await this.clickFirstVisible([
      { locator: this.bookingMenu, label: 'Booking menu', timeout: 10000 },
      { locator: this.bookingMenuFallback1, label: 'Booking menu fallback 1' },
      { locator: this.bookingMenuFallback2, label: 'Booking menu fallback 2' }
    ], 'Could not click on any booking menu');

    await this.page.waitForLoadState('domcontentloaded');
    await this.newBookingButton.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {
      console.log('New Booking button not found, continuing...');
    });
  }
}

module.exports = { DashboardPage };
