const ROLE_NAVIGATION_TABS = Object.freeze([
  {
    name: 'New Booking',
    patterns: [/^New Booking$/i, /\bNew Booking\b/i],
    routes: ['booking/new', 'booking/create'],
    contentPattern: /What kind of booking|Scheduling Information|New Booking/i,
    optional: false
  },
  {
    name: 'Booking List',
    patterns: [/\bBooking List\b/i, /^Booking$/i],
    routes: ['booking'],
    contentPattern: /Booking List|New Booking|Booking Ref/i,
    optional: false
  },
  {
    name: 'Calendar',
    patterns: [/\bCalendar\b/i],
    routes: ['calendar'],
    contentPattern: /\bCalendar\b|All Project Bookings|My Bookings/i,
    optional: false
  },
  {
    name: 'User Management',
    patterns: [/^User Management$/i, /Manage User/i],
    routes: ['dashboard/manage-user'],
    contentPattern: /User Management|Invite Users|Project Role/i,
    optional: false
  },
  {
    name: 'Project Management',
    patterns: [/^Project Management$/i, /^Project$/i, /Project Details/i],
    routes: ['site-details', 'settings'],
    contentPattern: /Project Details|Project Settings|Project Information/i,
    optional: false
  },
  {
    name: 'Equipment Management',
    patterns: [/^Equipment Management$/i, /List Of Equipment/i],
    routes: ['list-equipment'],
    contentPattern: /Equipment Management|List Of Equipment|Equipment Usage/i,
    optional: false
  },
  {
    name: 'Analytics',
    patterns: [/^Analytics$/i, /Summary Emission|Vehicle Emissions|Equipment Emissions/i],
    routes: ['summary-emissions-report'],
    contentPattern: /Analytics|Summary Emission|Vehicle Emissions|Equipment Emissions/i,
    optional: false
  },
  {
    name: 'Vehicle Tracking',
    patterns: [/^Vehicle Tracking$/i, /Vehicle\s+Tracking/i],
    routes: ['vehicle-tracking', 'tracking'],
    contentPattern: /Vehicle Tracking|Tracking/i,
    optional: true
  }
]);

class RoleNavigationPage {
  constructor(page, options = {}) {
    this.page = page;
    this.options = {
      appUrl: process.env.APP_URL || 'https://stg-app.voyagecontrol.com',
      projectId: process.env.PROJECT_ID || process.env.BUCKINGHAM_PALACE_PROJECT_ID || '5ET10000010',
      ...options
    };
  }

  async waitForNavigationReady() {
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    await this.page.locator('[role="progressbar"], .MuiCircularProgress-root')
      .first()
      .waitFor({ state: 'hidden', timeout: 30000 })
      .catch(() => null);
    await this.page.locator('nav, aside, [role="navigation"], body').first()
      .waitFor({ state: 'visible', timeout: 30000 });
    await this.page.waitForTimeout(Number(process.env.ROLE_NAVIGATION_SETTLE_MS || 1500));
  }

  projectUrl(routePath = 'booking') {
    return `${this.options.appUrl.replace(/\/$/, '')}/${this.options.projectId}/${routePath.replace(/^\//, '')}`;
  }

  normalizeTabName(text) {
    const compact = String(text || '').replace(/\s+/g, ' ').trim();
    const definition = ROLE_NAVIGATION_TABS.find((tab) =>
      tab.patterns.some((pattern) => pattern.test(compact))
    );
    return definition?.name || null;
  }

  async collectVisibleNavigationTabs() {
    await this.waitForNavigationReady();
    const rawTabs = await this.page.evaluate((definitions) => {
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0';
      };
      const isClickable = (element) => {
        const tag = element.tagName.toLowerCase();
        return tag === 'a' ||
          tag === 'button' ||
          element.getAttribute('role') === 'button' ||
          window.getComputedStyle(element).cursor === 'pointer' ||
          typeof element.onclick === 'function';
      };
      const normalize = (text) => String(text || '').replace(/\s+/g, ' ').trim();
      const classify = (text) => {
        const normalized = normalize(text);
        for (const definition of definitions) {
          if (definition.patterns.some((source) => new RegExp(source, 'i').test(normalized))) {
            return definition.name;
          }
        }
        return null;
      };
      const scopes = Array.from(document.querySelectorAll('nav, aside, [role="navigation"], .sidebar, [class*="side" i], body'));
      const controls = scopes.flatMap((scope) =>
        Array.from(scope.querySelectorAll('a, button, [role="button"], [role="link"], li, span, div'))
      );

      const controlTabs = controls
        .filter(isVisible)
        .map((element) => {
          const text = [
            element.innerText,
            element.textContent,
            element.getAttribute('aria-label'),
            element.getAttribute('title')
          ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
          if (!text || text.length > 80) return null;
          const name = classify(text);
          if (!name) return null;
          const rect = element.getBoundingClientRect();
          return {
            name,
            text,
            y: Math.round((rect.top + rect.bottom) / 2),
            enabled: !element.disabled &&
              element.getAttribute('aria-disabled') !== 'true' &&
              window.getComputedStyle(element).pointerEvents !== 'none',
            clickable: isClickable(element)
          };
        })
        .filter(Boolean);

      const textLineTabs = String(document.body?.innerText || '')
        .split(/\n|\s{2,}/)
        .map((line) => normalize(line))
        .filter((line) => line && line.length <= 80)
        .map((line) => {
          const name = classify(line);
          if (!name) return null;
          return {
            name,
            text: line,
            y: 0,
            enabled: true,
            clickable: true
          };
        })
        .filter(Boolean);

      return [...controlTabs, ...textLineTabs];
    }, ROLE_NAVIGATION_TABS.map((tab) => ({
      name: tab.name,
      patterns: tab.patterns.map((pattern) => pattern.source)
    })));

    const byName = new Map();
    for (const tab of rawTabs) {
      const existing = byName.get(tab.name);
      const sourceTexts = new Set(existing?.sourceTexts || []);
      const yBuckets = new Set(existing?.yBuckets || []);
      sourceTexts.add(tab.sourceText || tab.text || tab.name);
      yBuckets.add(Math.round((tab.y || 0) / 12));
      byName.set(tab.name, {
        name: tab.name,
        visibleCount: yBuckets.size,
        enabled: Boolean(existing?.enabled || tab.enabled),
        clickable: Boolean(existing?.clickable || tab.clickable),
        sourceText: existing?.sourceText || tab.text,
        sourceTexts: Array.from(sourceTexts),
        yBuckets: Array.from(yBuckets)
      });
    }

    return Array.from(byName.values())
      .map(({ sourceTexts, yBuckets, ...tab }) => tab)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  getTabDefinition(tabName) {
    return ROLE_NAVIGATION_TABS.find((tab) => tab.name === tabName);
  }

  async newBookingControlState() {
    await this.page.goto(this.projectUrl('booking'), { waitUntil: 'domcontentloaded' }).catch(() => null);
    await this.waitForNavigationReady();

    return this.page.evaluate(() => {
      const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          Number(style.opacity || '1') > 0.2;
      };

      const candidates = Array.from(document.querySelectorAll('button, a, [role="button"], [role="link"]'))
        .map((element) => {
          const text = normalize(element.innerText || element.textContent || element.getAttribute('aria-label') || element.getAttribute('title'));
          const rect = element.getBoundingClientRect();
          return { element, text, rect };
        })
        .filter(({ element, text }) => /^New Booking$/i.test(text) && isVisible(element))
        .sort((left, right) => left.rect.top - right.rect.top || left.rect.left - right.rect.left);

      const control = candidates[0];
      if (!control) {
        return {
          visible: false,
          enabled: false,
          text: '',
          url: window.location.href
        };
      }

      return {
        visible: true,
        enabled: !control.element.disabled &&
          control.element.getAttribute('aria-disabled') !== 'true' &&
          window.getComputedStyle(control.element).pointerEvents !== 'none',
        text: control.text,
        url: window.location.href
      };
    }).catch(() => ({
      visible: false,
      enabled: false,
      text: '',
      url: this.page.url()
    }));
  }

  async openNewBookingFromBookingList() {
    await this.page.goto(this.projectUrl('booking'), { waitUntil: 'domcontentloaded' }).catch(() => null);
    await this.waitForNavigationReady();

    const clicked = await this.page.evaluate(() => {
      const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.pointerEvents !== 'none' &&
          Number(style.opacity || '1') > 0.2;
      };

      const candidates = Array.from(document.querySelectorAll('button, a, [role="button"], [role="link"]'))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            element,
            rect,
            text: normalize(element.innerText || element.textContent || element.getAttribute('aria-label') || element.getAttribute('title'))
          };
        })
        .filter(({ element, text }) => /^New Booking$/i.test(text) &&
          isVisible(element) &&
          !element.disabled &&
          element.getAttribute('aria-disabled') !== 'true')
        .sort((left, right) => left.rect.top - right.rect.top || left.rect.left - right.rect.left);

      const target = candidates[0];
      if (!target) return null;
      target.element.scrollIntoView({ block: 'center', inline: 'center' });
      target.element.click();
      return target.text;
    }).catch(() => null);

    if (!clicked) {
      return {
        clicked: false,
        finalUrl: this.page.url(),
        bodyText: await this.page.locator('body').innerText({ timeout: 5000 }).catch(() => '')
      };
    }

    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    await this.page.waitForTimeout(1500);
    await this.waitForNavigationReady();

    return {
      clicked: true,
      finalUrl: this.page.url(),
      bodyText: await this.page.locator('body').innerText({ timeout: 5000 }).catch(() => '')
    };
  }

  async attemptDirectAccess(tabName) {
    const definition = this.getTabDefinition(tabName);
    if (!definition?.routes?.length) {
      return {
        tabName,
        status: 'skipped',
        reason: 'No direct route is defined for this tab.'
      };
    }

    if (tabName === 'New Booking') {
      const state = await this.newBookingControlState();
      return {
        tabName,
        status: state.visible && state.enabled ? 'failed' : 'passed',
        attempts: [state],
        reason: state.visible && state.enabled
          ? 'Restricted user can see an enabled New Booking control on Booking List.'
          : 'Restricted user cannot access New Booking from Booking List.'
      };
    }

    const attempts = [];
    for (const route of definition.routes) {
      const targetUrl = this.projectUrl(route);
      await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch(() => null);
      await this.waitForNavigationReady();
      const finalUrl = this.page.url();
      const bodyText = await this.page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
      const unauthorized = /unauthori[sz]ed|access denied|permission|not allowed|forbidden|not found|404/i.test(bodyText);
      const contentVisible = definition.contentPattern.test(bodyText);
      const routeChanged = !new RegExp(`/${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[/?#]|$)`, 'i').test(finalUrl);
      attempts.push({
        route,
        targetUrl,
        finalUrl,
        unauthorized,
        contentVisible,
        routeChanged
      });

      if (!contentVisible || unauthorized || routeChanged) {
        return {
          tabName,
          status: 'passed',
          attempts,
          reason: 'Restricted route did not expose protected page content.'
        };
      }
    }

    return {
      tabName,
      status: 'failed',
      attempts,
      reason: `Restricted user could access ${tabName} page content directly.`
    };
  }

  async attemptPermittedAccess(tabName) {
    const definition = this.getTabDefinition(tabName);
    if (!definition?.routes?.length) {
      return {
        tabName,
        status: 'skipped',
        reason: 'No direct route is defined for this permitted tab.'
      };
    }

    if (tabName === 'New Booking') {
      const attempt = await this.openNewBookingFromBookingList();
      const unauthorized = /unauthori[sz]ed|access denied|permission|not allowed|forbidden|not found|404/i.test(attempt.bodyText);
      const contentVisible = definition.contentPattern.test(attempt.bodyText);

      return {
        tabName,
        status: attempt.clicked && contentVisible && !unauthorized ? 'passed' : 'failed',
        attempts: [attempt],
        reason: attempt.clicked && contentVisible && !unauthorized
          ? 'Permitted user opened New Booking through the Booking List control.'
          : 'Permitted user could not open New Booking through the Booking List control.'
      };
    }

    const attempts = [];
    for (const route of definition.routes) {
      const targetUrl = this.projectUrl(route);
      await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch(() => null);
      await this.waitForNavigationReady();
      const finalUrl = this.page.url();
      const bodyText = await this.page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
      const unauthorized = /unauthori[sz]ed|access denied|permission|not allowed|forbidden|not found|404/i.test(bodyText);
      const contentVisible = definition.contentPattern.test(bodyText);
      attempts.push({
        route,
        targetUrl,
        finalUrl,
        unauthorized,
        contentVisible
      });

      if (contentVisible && !unauthorized) {
        return {
          tabName,
          status: 'passed',
          attempts,
          reason: 'Permitted route opened expected page content.'
        };
      }
    }

    return {
      tabName,
      status: 'failed',
      attempts,
      reason: `Permitted user could not open ${tabName} page content.`
    };
  }
}

module.exports = {
  ROLE_NAVIGATION_TABS,
  RoleNavigationPage
};
