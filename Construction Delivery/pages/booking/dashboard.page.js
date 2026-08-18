const { clickHighlighted } = require('../../utils/highlight');
const { loginIfVisible } = require('../../utils/login');

class DashboardPage {
  constructor(page) {
    this.page = page;
    this.hasConfiguredProject = Boolean(
      process.env.PROJECT_ID ||
      process.env.BUCKINGHAM_PALACE_PROJECT_ID ||
      process.env.PROJECT_NAME ||
      process.env.BUCKINGHAM_PALACE_PROJECT_NAME
    );
    this.projectName = process.env.PROJECT_NAME || process.env.BUCKINGHAM_PALACE_PROJECT_NAME || 'Buckingham Palace';
    this.appUrl = (process.env.APP_URL || 'https://stg-app.voyagecontrol.com').replace(/\/$/, '');
    this.projectId = process.env.PROJECT_ID || process.env.BUCKINGHAM_PALACE_PROJECT_ID || '';

    this.projectLink = page.getByRole('link', { name: /Construction Delivery|V3 Construction deliveries/i });
    this.projectLinkFallback1 = page.getByText(/Construction Delivery|V3 Construction deliveries/i);
    this.projectLinkFallback2 = page.locator('a:has-text("Construction Delivery"), a:has-text("V3 Construction")');
    this.projectLinkFallback3 = page.locator('[href*="construction"], [href*="v3"]');

    this.location = page.getByRole('heading', { name: this.projectName });
    this.locationFallback1 = page.getByText(this.projectName).first();
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
    const email = process.env.VC_EMAIL || 'hariharan.r@neuralrays.ai';
    const password = process.env.VC_PASSWORD || 'Master@15';
    return loginIfVisible(this.page, {
      email,
      password,
      visibleTimeout: 1000,
      postLoginWaitMs: 0,
      missingCredentialsMessage: 'Login page is visible and VC_EMAIL/VC_PASSWORD are not configured.'
    });
  }

  async waitForAppToSettle(timeout = 30000) {
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    await this.page.locator('[role="progressbar"], .MuiCircularProgress-root').first()
      .waitFor({ state: 'hidden', timeout })
      .catch(() => null);
    await this.page.locator('.MuiBackdrop-root, [class*="loader" i], [class*="loading" i]').first()
      .waitFor({ state: 'hidden', timeout })
      .catch(() => null);
  }

  async findV3PlatformHref() {
    return this.page.evaluate((appUrl) => {
      const normalizedAppUrl = appUrl.replace(/\/$/, '');
      const links = Array.from(document.querySelectorAll('a[href]'));
      const normalize = (value = '') => value.replace(/\s+/g, ' ').trim();
      const appLinks = links.filter((anchor) => (anchor.href || '').startsWith(`${normalizedAppUrl}/login`));
      const v3Link = appLinks.find((anchor) => /V3\s+Construction\s+deliveries|Construction\s+Delivery/i.test(normalize(anchor.innerText || anchor.textContent)));
      return (v3Link || appLinks[0])?.href || null;
    }, this.appUrl).catch(() => null);
  }

  async isPlatformChooserVisible() {
    if (/\/api\/sso\/platforms\/choose\//i.test(this.page.url())) {
      return true;
    }

    return Boolean(await this.findV3PlatformHref());
  }

  async restoreAppTokensFromSsoUrl() {
    const url = new URL(this.page.url());
    const tokenPair = {
      access: url.searchParams.get('access') || '',
      refresh: url.searchParams.get('refresh') || ''
    };

    if (!tokenPair.access || !tokenPair.refresh) {
      return false;
    }

    await this.page.context().addInitScript(({ access, refresh }) => {
      localStorage.setItem('v3_access_token', access);
      localStorage.setItem('v3_refresh_token', refresh);
      localStorage.setItem('i18nextLng', localStorage.getItem('i18nextLng') || 'en');
    }, tokenPair);
    return true;
  }

  async openPlatformIfChooser() {
    const onPlatformChooser = await this.isPlatformChooserVisible();
    if (!onPlatformChooser && !(await this.projectLink.isVisible({ timeout: 1000 }).catch(() => false))) {
      return false;
    }

    if (onPlatformChooser) {
      if (await this.restoreAppTokensFromSsoUrl()) {
        return true;
      }

      await this.page.waitForFunction((appUrl) => (
        Array.from(document.querySelectorAll('a[href]'))
          .some((anchor) => {
            const href = anchor.href || '';
            const text = (anchor.innerText || anchor.textContent || '').replace(/\s+/g, ' ').trim();
            return href.startsWith(`${appUrl.replace(/\/$/, '')}/login`) ||
              /Construction Delivery|V3 Construction deliveries/i.test(text);
          })
      ), this.appUrl, { timeout: 10000 }).catch(() => null);

      const appHref = await this.findV3PlatformHref();

      if (appHref) {
        await this.page.goto(appHref, { waitUntil: 'domcontentloaded' }).catch(() => null);
        await this.waitForAppToSettle();
        return true;
      }
    }

    if (await this.projectLink.isVisible({ timeout: 1000 }).catch(() => false)) {
      await clickHighlighted(this.projectLink, 'V3 platform');
      await this.page.waitForLoadState('domcontentloaded').catch(() => null);
      return true;
    }

    return false;
  }

  async openConfiguredProjectHome() {
    if (!this.projectId) {
      await this.openPlatformIfChooser().catch(() => null);
      if (/\/project\/choose/i.test(this.page.url())) {
        await this.clickLocationProjectCard();
      }
      await this.waitForAppToSettle();
      return;
    }

    const targetUrl = `${this.appUrl}/${this.projectId}/home`;

    if (!this.page.url().startsWith(this.appUrl) || await this.isPlatformChooserVisible()) {
      await this.openPlatformIfChooser().catch(() => null);
    }

    if (/\/project\/choose/i.test(this.page.url())) {
      await this.clickLocationProjectCard(this.projectName).catch(() => false);
    }

    if (!new RegExp(`/${this.projectId}/`, 'i').test(this.page.url())) {
      await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch((error) => {
        if (!/ERR_ABORTED|Navigation interrupted|interrupted by another navigation|net::ERR_ABORTED/i.test(error.message)) {
          throw error;
        }
      });
    }

    await this.waitForAppToSettle();

    if (await this.isPlatformChooserVisible()) {
      await this.openPlatformIfChooser();
      await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch((error) => {
        if (!/ERR_ABORTED|Navigation interrupted|interrupted by another navigation|net::ERR_ABORTED/i.test(error.message)) {
          throw error;
        }
      });
      await this.waitForAppToSettle();
    }

    if (/\/project\/choose/i.test(this.page.url())) {
      await this.clickLocationProjectCard(this.projectName).catch(() => false);
      if (!new RegExp(`/${this.projectId}/`, 'i').test(this.page.url())) {
        await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch((error) => {
          if (!/ERR_ABORTED|Navigation interrupted|interrupted by another navigation|net::ERR_ABORTED/i.test(error.message)) {
            throw error;
          }
        });
      }
      await this.waitForAppToSettle();
    }

    if (/\/api\/sso\/users\/login/i.test(this.page.url())) {
      await this.loginIfRedirected();
      await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch(() => null);
      await this.waitForAppToSettle();
    }

    await this.waitForConfiguredProjectShell(targetUrl);
  }

  async waitForConfiguredProjectShell(targetUrl, timeout = 45000) {
    const deadline = Date.now() + timeout;
    let loginAttempts = 0;
    let lastState = { url: this.page.url(), text: '' };

    while (Date.now() < deadline) {
      await this.waitForAppToSettle(10000);

      lastState = await this.page.evaluate(() => ({
        url: window.location.href,
        text: (document.body?.innerText || document.body?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300)
      })).catch(() => ({ url: this.page.url(), text: '' }));

      if (/Account settings|Booking|Project Management|Analytics|Environment|User Management/i.test(lastState.text)) {
        return;
      }

      if (/\/api\/sso\/users\/login/i.test(lastState.url)) {
        loginAttempts += 1;
        await this.loginIfRedirected();
        await this.openPlatformIfChooser().catch(() => null);
        await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch((error) => {
          if (!/ERR_ABORTED|Navigation interrupted|interrupted by another navigation|net::ERR_ABORTED/i.test(error.message)) {
            throw error;
          }
        });
        continue;
      }

      if (await this.isPlatformChooserVisible()) {
        await this.openPlatformIfChooser();
        await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch((error) => {
          if (!/ERR_ABORTED|Navigation interrupted|interrupted by another navigation|net::ERR_ABORTED/i.test(error.message)) {
            throw error;
          }
        });
        continue;
      }

      await this.page.waitForTimeout(1000);
    }

    const loginHint = loginAttempts
      ? ` Login was retried ${loginAttempts} time(s); verify VC_EMAIL/VC_PASSWORD or refresh auth.json.`
      : '';
    throw new Error(
      `Configured project shell did not load after SSO handoff.${loginHint} ` +
      `Current URL: ${lastState.url}. Page text: ${lastState.text || '-'}`
    );
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
      if (!/ERR_ABORTED|Navigation interrupted|interrupted by another navigation|net::ERR_ABORTED/i.test(error.message)) {
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

  async clickLocationProjectCard(locationName = this.projectName) {
    if (!/\/project\/choose/i.test(this.page.url())) {
      return false;
    }

    const clicked = await this.page.evaluate((targetLocationName) => {
      const normalize = (value = '') => value.replace(/\s+/g, ' ').trim();
      const elements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, div, a, button'));
      const heading = targetLocationName
        ? elements.find((element) => normalize(element.textContent) === targetLocationName)
        : elements.find((element) => /Log Into/i.test(element.parentElement?.innerText || element.textContent || ''));

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

    return clicked && !/\/project\/choose/i.test(this.page.url());
  }

  async selectProject() {
    if (/\/project\/choose/i.test(this.page.url())) {
      return;
    }

    if ((this.projectId && new RegExp(`/${this.projectId}/`, 'i').test(this.page.url())) || await this.isPlatformChooserVisible()) {
      await this.openConfiguredProjectHome();
      return;
    }

    try {
      await this.clickFirstVisible([
        { locator: this.projectLink, label: 'Project', timeout: 10000 },
        { locator: this.projectLinkFallback1, label: 'Project fallback 1' },
        { locator: this.projectLinkFallback2, label: 'Project fallback 2' },
        { locator: this.projectLinkFallback3, label: 'Project fallback 3' }
      ], 'Could not click on any project link');
    } catch (error) {
      await this.openConfiguredProjectHome();
      return;
    }

    await this.waitForPageState(this.location, 'Location page');
  }

  async selectLocation() {
    if (this.projectId && new RegExp(`/${this.projectId}/`, 'i').test(this.page.url()) && !/\/project\/choose/i.test(this.page.url())) {
      await this.waitForPageState(this.bookingMenu, 'Booking menu');
      return;
    }

    if (await this.clickLocationProjectCard(this.projectName)) {
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
