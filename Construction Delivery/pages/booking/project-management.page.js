const { loginIfVisible } = require('../../utils/login');
const { DashboardPage } = require('./dashboard.page');
const { ProjectSettingsPage } = require('./project-settings.page');

const DEFAULT_EMAIL = process.env.VC_EMAIL || 'hariharan.r@neuralrays.ai';
const DEFAULT_PASSWORD = process.env.VC_PASSWORD || 'Master@15';

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function markerPattern(value) {
  return new RegExp(
    String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => escapeRegex(item).replace(/\s+/g, '\\s+'))
      .join('|'),
    'i'
  );
}

class ProjectManagementPage {
  constructor(page, options = {}) {
    this.page = page;
    this.options = {
      appUrl: process.env.APP_URL || 'https://stg-app.voyagecontrol.com',
      projectId: process.env.PROJECT_ID || process.env.BUCKINGHAM_PALACE_PROJECT_ID || '5ET10000010',
      email: DEFAULT_EMAIL,
      password: DEFAULT_PASSWORD,
      settleMs: Number(process.env.PROJECT_MANAGEMENT_SMOKE_SETTLE_MS || 500),
      ...options
    };

    this.projectSettings = new ProjectSettingsPage(page, this.options);
    this.areas = [
      {
        name: 'Project Details',
        route: 'site-details',
        marker: 'Project Details, Project Information',
        tabName: 'Project Information',
        readySelector: '#siteName',
        routePattern: /\/site-details(?:[/?#]|$)/i
      },
      {
        name: 'Environment Setting',
        route: 'site-details',
        marker: 'Access Point, Resources, Vehicles Details',
        tabName: 'Access Point',
        requiresProjectDetailsShell: true,
        routePattern: /\/site-details(?:[/?#]|$)/i
      },
      {
        name: 'Availability',
        route: 'availability',
        marker: 'Availability, Hours of Operation',
        requiresProjectDetailsShell: true,
        routePattern: /\/availability(?:[/?#]|$)/i
      },
      {
        name: 'Project Settings',
        route: 'settings',
        marker: 'Project Settings, Core Features, Automatic Approval',
        routePattern: /\/settings(?:[/?#]|$)/i
      },
      {
        name: 'Vehicle Emissions',
        route: 'vehicle-emission',
        marker: 'Vehicle Emissions, Search',
        routePattern: /\/vehicle-emission(?:[/?#]|$)/i
      },
      {
        name: 'Equipment Master',
        route: 'equipment',
        marker: 'Equipment Master, Equipment, Search',
        routePattern: /\/equipment(?:[/?#]|$)/i
      },
      {
        name: 'Global Settings',
        route: 'settings/common-settings',
        marker: 'Global Settings, Common',
        routePattern: /\/settings\/common-settings(?:[/?#]|$)/i
      },
      {
        name: 'Country UOMs',
        route: 'country',
        marker: 'Country UOMs, Country UOM, Distance, Volume, Weight, Tons',
        routePattern: /\/country(?:[/?#]|$)/i
      }
    ];
  }

  projectUrl(route) {
    return `${this.options.appUrl.replace(/\/$/, '')}/${this.options.projectId}/${route.replace(/^\//, '')}`;
  }

  async loginIfNeeded() {
    return loginIfVisible(this.page, {
      email: this.options.email,
      password: this.options.password,
      visibleTimeout: 5000,
      postLoginWaitMs: 1500,
      missingCredentialsMessage: 'Login page is visible and VC_EMAIL/VC_PASSWORD are not configured.',
      errorMessage: 'Project Management smoke could not log in; check VC_EMAIL/VC_PASSWORD.'
    });
  }

  async waitForQuietPage(timeout = 45000) {
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    await this.page.locator('[role="progressbar"], .MuiCircularProgress-root')
      .first()
      .waitFor({ state: 'hidden', timeout })
      .catch(() => null);
    await this.page.locator('.MuiBackdrop-root, [class*="loader" i], [class*="loading" i]')
      .first()
      .waitFor({ state: 'hidden', timeout })
      .catch(() => null);

    if (this.options.settleMs > 0) {
      await this.page.waitForTimeout(this.options.settleMs);
    }
  }

  async grantNotificationPermissions() {
    const origins = [
      this.options.appUrl,
      process.env.BASE_URL || 'https://stg-login.voyagecontrol.com'
    ].map((value) => {
      try {
        return new URL(value).origin;
      } catch {
        return null;
      }
    }).filter(Boolean);

    for (const origin of origins) {
      await this.page.context().grantPermissions(['notifications'], { origin }).catch(() => null);
    }
  }

  async visibleBodyText(timeout = 10000) {
    return this.page.locator('body').innerText({ timeout }).catch(() => '');
  }

  async isTargetProjectUrl() {
    return new RegExp(`/${escapeRegex(this.options.projectId)}(?:/|$)`, 'i').test(this.page.url());
  }

  async isProjectChooserPage() {
    const bodyText = await this.visibleBodyText(3000);
    return /\/project\/choose/i.test(this.page.url()) ||
      /Choose Project|Log Into|Buckingham Palace/i.test(bodyText);
  }

  async forceTargetProjectStorage() {
    return this.page.evaluate((projectId) => {
      const values = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        values.push(localStorage.getItem(localStorage.key(index)));
      }

      for (const value of values) {
        try {
          const parsed = JSON.parse(value);
          const projects = Array.isArray(parsed?.projects) ? parsed.projects : [];
          const project = projects.find((candidate) => candidate?.ref === projectId);
          if (project) {
            localStorage.setItem('v3_project_data', JSON.stringify(project));
            localStorage.setItem('v3_project_ref', project.ref);
            localStorage.setItem('v3_project_site_id', String(project.id));
            return project.name || project.ref;
          }
        } catch {
          // Ignore non-JSON localStorage values.
        }
      }

      return null;
    }, this.options.projectId).catch(() => null);
  }

  async selectedProjectRef() {
    return this.page.evaluate(() => localStorage.getItem('v3_project_ref') || '').catch(() => '');
  }

  async selectedProjectMatchesTarget() {
    const selectedRef = await this.selectedProjectRef();
    return selectedRef === this.options.projectId;
  }

  async chooseConfiguredProject() {
    const dashboard = new DashboardPage(this.page);
    const projectNames = Array.from(new Set([
      process.env.PROJECT_NAME,
      'Buckingham Palace IND',
      'Buckingham Palace'
    ].filter(Boolean)));

    for (const projectName of projectNames) {
      if (await dashboard.clickLocationProjectCard(projectName).catch(() => false)) {
        await this.waitForQuietPage();
        return true;
      }
    }

    for (const projectName of projectNames) {
      const clicked = await this.page.evaluate((targetProjectName) => {
        const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim();
        const visible = (element) => {
          const box = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return box.width > 0 && box.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none';
        };
        const match = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, div, span'))
          .find((element) => visible(element) && normalize(element.innerText || element.textContent) === targetProjectName);
        if (!match) return false;

        let card = match;
        for (let depth = 0; card.parentElement && card.parentElement !== document.body && depth < 8; depth += 1) {
          if (/Log Into|Open|Select/i.test(card.innerText || card.textContent || '')) break;
          card = card.parentElement;
        }

        const control = Array.from(card.querySelectorAll('a, button, [role="button"], img, svg'))
          .filter(visible)
          .find((element) => /Log Into|Open|Select/i.test(element.innerText || element.textContent || element.getAttribute('aria-label') || '')) ||
          Array.from(card.querySelectorAll('a, button, [role="button"], img, svg')).filter(visible).pop() ||
          card;
        control.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return true;
      }, projectName).catch(() => false);

      if (clicked) {
        await this.waitForQuietPage();
        if (!(await this.isProjectChooserPage())) {
          return true;
        }
      }
    }

    return false;
  }

  async ensureConfiguredProjectSelected() {
    await this.forceTargetProjectStorage();
    if (await this.selectedProjectMatchesTarget()) {
      return true;
    }

    await this.page.goto(`${this.options.appUrl.replace(/\/$/, '')}/project/choose`, {
      waitUntil: 'domcontentloaded'
    }).catch(() => null);
    await this.waitForQuietPage();

    if (await this.chooseConfiguredProject()) {
      await this.forceTargetProjectStorage();
      return this.selectedProjectMatchesTarget();
    }

    return false;
  }

  async ensureProjectContext() {
    const homeUrl = this.projectUrl('home');

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await this.grantNotificationPermissions();
      await this.loginIfNeeded();
      await this.projectSettings.openConstructionAppIfPlatformChooser();
      await this.ensureConfiguredProjectSelected();
      await this.waitForQuietPage();

      if (await this.isProjectChooserPage()) {
        await this.chooseConfiguredProject();
        await this.ensureConfiguredProjectSelected();
        await this.waitForQuietPage();
      }

      if (await this.isTargetProjectUrl() &&
          await this.selectedProjectMatchesTarget() &&
          !(await this.isProjectChooserPage())) {
        return;
      }

      await this.page.goto(homeUrl, { waitUntil: 'domcontentloaded' }).catch(() => null);
      await this.waitForQuietPage();
    }

    throw new Error(`Could not enter configured project ${this.options.projectId}. Current URL: ${this.page.url()}`);
  }

  async clickVisibleProjectManagementLink(linkName, routePath = '') {
    const linkPattern = new RegExp(`^${escapeRegex(linkName)}$`, 'i');
    let link = this.page.getByRole('link', { name: linkPattern }).first();

    if (!(await link.isVisible({ timeout: 3000 }).catch(() => false))) {
      const menu = this.page.getByRole('link', { name: /project_management\s*Project|Project Management/i }).first()
        .or(this.page.getByText(/Project Management/i).first());
      if (await menu.isVisible({ timeout: 3000 }).catch(() => false)) {
        await menu.click({ force: true }).catch(() => null);
        await this.waitForQuietPage();
      }
    }

    const clickedRouteLink = await this.page.evaluate(({ name, route }) => {
      const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim();
      const visible = (element) => {
        const box = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return box.width > 0 && box.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.pointerEvents !== 'none';
      };
      const normalizedRoute = String(route || '').replace(/^\/+/, '').replace(/\/+$/, '');
      const candidates = Array.from(document.querySelectorAll('a[href]'))
        .filter(visible)
        .filter((anchor) => normalize(anchor.innerText || anchor.textContent) === name);
      const target = candidates.find((anchor) =>
        normalizedRoute && (anchor.getAttribute('href') || '').replace(/^\//, '').includes(normalizedRoute)
      ) || candidates[0];
      if (!target) return false;
      target.click();
      return true;
    }, { name: linkName, route: routePath }).catch(() => false);

    if (clickedRouteLink) {
      await this.waitForQuietPage();
      return true;
    }

    const exactLabelBox = await this.page.evaluate((name) => {
      const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim();
      const visible = (element) => {
        const box = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return box.width > 0 && box.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.pointerEvents !== 'none';
      };
      const labels = Array.from(document.querySelectorAll('*'))
        .filter(visible)
        .filter((element) => normalize(element.innerText || element.textContent) === name)
        .filter((element) => !Array.from(element.children).some((child) =>
          normalize(child.innerText || child.textContent) === name
        ));
      const label = labels[0];
      if (!label) return null;
      const box = label.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    }, linkName).catch(() => false);

    if (exactLabelBox) {
      await this.page.mouse.click(exactLabelBox.x, exactLabelBox.y).catch(() => null);
      await this.waitForQuietPage();
      return true;
    }

    link = this.page.getByRole('link', { name: linkPattern }).first();
    if (await link.isVisible({ timeout: 5000 }).catch(() => false)) {
      await link.click({ force: true });
      await this.waitForQuietPage();
      return true;
    }

    const clickedByText = await this.page.evaluate((name) => {
      const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim();
      const visible = (element) => {
        const box = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return box.width > 0 && box.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.pointerEvents !== 'none';
      };
      const candidates = Array.from(document.querySelectorAll('a, button, [role="link"], [role="button"]'))
        .filter(visible)
        .filter((element) => normalize(element.innerText || element.textContent) === name);
      const target = candidates[0];
      if (!target) return false;
      target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    }, linkName).catch(() => false);

    if (clickedByText) {
      await this.waitForQuietPage();
      return true;
    }

    return false;
  }

  async clickTabIfConfigured(areaConfig) {
    if (!areaConfig.tabName) {
      return false;
    }

    const tabPattern = new RegExp(`^${escapeRegex(areaConfig.tabName)}$`, 'i');
    const tab = this.page.getByRole('tab', { name: tabPattern }).first()
      .or(this.page.locator('[role="tab"]').filter({ hasText: tabPattern }).first())
      .or(this.page.getByText(tabPattern).first());

    if (await tab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await tab.click({ force: true }).catch(() => null);
      await this.waitForQuietPage();
      return true;
    }

    return false;
  }

  async warmProjectManagementShell() {
    await this.projectSettings.openSettings().catch(() => null);
    await this.loginIfNeeded();
    await this.projectSettings.openConstructionAppIfPlatformChooser();
    await this.ensureConfiguredProjectSelected();
    await this.waitForQuietPage();
  }

  async openProjectDetailsShell({ allowProjectManagementShell = false } = {}) {
    const projectDetails = this.areas.find((area) => area.name === 'Project Details');
    const targetUrl = this.projectUrl('site-details');

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const clickedProjectDetails = await this.clickVisibleProjectManagementLink('Project Details', 'site-details');
      if (!clickedProjectDetails || !projectDetails.routePattern.test(this.page.url())) {
        await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch(() => null);
      }
      await this.waitForQuietPage();
      await this.clickTabIfConfigured(projectDetails);
      const result = await this.getAreaReadiness(projectDetails);
      if (result.ready) {
        return result;
      }

      await this.ensureConfiguredProjectSelected();
      await this.projectSettings.openSettings().catch(() => null);
      await this.waitForQuietPage();

      const shellText = await this.page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
      if (allowProjectManagementShell &&
          /Project Management/i.test(shellText) &&
          /Project Details/i.test(shellText) &&
          /Environment Setting|Availability|Project Settings/i.test(shellText)) {
        return {
          area: projectDetails.name,
          marker: projectDetails.marker,
          routeMatched: false,
          markerMatched: true,
          selectorMatched: true,
          onLoginPage: false,
          onPlatformChooser: false,
          ready: true,
          url: this.page.url(),
          pageTextSample: shellText.replace(/\s+/g, ' ').trim().slice(0, 500)
        };
      }
    }

    const result = await this.getAreaReadiness(projectDetails);
    throw new Error(
      `Project Details shell did not load before Project Management navigation. ` +
      `URL: ${result.url}. Visible text: ${result.pageTextSample || '<blank page>'}`
    );
  }

  async openArea(area) {
    const areaConfig = typeof area === 'string'
      ? this.areas.find((item) => item.name.toLowerCase() === area.toLowerCase())
      : area;

    if (!areaConfig) {
      throw new Error(`Unsupported Project Management area: ${area}`);
    }

    const targetUrl = this.projectUrl(areaConfig.route);

    await this.ensureProjectContext();
    if (areaConfig.name !== 'Project Settings') {
      await this.warmProjectManagementShell();
    }
    if (areaConfig.name === 'Project Details') {
      await this.openProjectDetailsShell();
      return this.getAreaReadiness(areaConfig);
    }
    if (areaConfig.requiresProjectDetailsShell) {
      await this.openProjectDetailsShell({ allowProjectManagementShell: true });
    }

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if (areaConfig.name === 'Project Settings') {
        await this.projectSettings.openSettings();
      } else if (areaConfig.useDirectRoute && areaConfig.routePattern.test(this.page.url())) {
        await this.waitForQuietPage();
      } else if (areaConfig.useDirectRoute || !(await this.clickVisibleProjectManagementLink(areaConfig.name, areaConfig.route))) {
        await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch(() => null);
      }

      await this.waitForQuietPage();
      await this.loginIfNeeded();
      await this.projectSettings.openConstructionAppIfPlatformChooser();
      await this.forceTargetProjectStorage();

      if (!areaConfig.routePattern.test(this.page.url())) {
        await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch(() => null);
        await this.waitForQuietPage();
      }

      await this.clickTabIfConfigured(areaConfig);

      const result = await this.getAreaReadiness(areaConfig);
      if (result.ready) {
        return result;
      }

      if (areaConfig.requiresProjectDetailsShell) {
        await this.openProjectDetailsShell().catch(() => null);
        continue;
      }

      if (!result.pageTextSample) {
        await this.forceTargetProjectStorage();
        await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch(() => null);
        await this.waitForQuietPage();
        await this.clickTabIfConfigured(areaConfig);
      }
    }

    const result = await this.getAreaReadiness(areaConfig);
    throw new Error(
      `${areaConfig.name} did not open. URL: ${result.url}. ` +
      `Expected route ${areaConfig.routePattern} and marker "${areaConfig.marker}". ` +
      `Visible text: ${result.pageTextSample || '<blank page>'}`
    );
  }

  async getAreaReadiness(areaConfig) {
    await this.waitForQuietPage();
    const bodyText = await this.page.locator('body').innerText({ timeout: 30000 }).catch(() => '');
    const url = this.page.url();
    const onLoginPage = /\/api\/sso\/users\/login/i.test(url) ||
      /Welcome To Voyage Control|Please log In|Login with SSO/i.test(bodyText);
    const onPlatformChooser = /\/api\/sso\/platforms\/choose/i.test(url) ||
      /V3 Construction deliveries|Voyage Control Admin|Supply Chain Planner/i.test(bodyText);
    const routeMatched = areaConfig.routePattern.test(url);
    const markerMatched = markerPattern(areaConfig.marker).test(bodyText);
    const selectorMatched = areaConfig.readySelector
      ? await this.page.locator(areaConfig.readySelector).first().isVisible({ timeout: 2000 }).catch(() => false)
      : true;
    const ready = !onLoginPage && !onPlatformChooser && routeMatched && markerMatched && selectorMatched;

    return {
      area: areaConfig.name,
      marker: areaConfig.marker,
      routeMatched,
      markerMatched,
      selectorMatched,
      onLoginPage,
      onPlatformChooser,
      ready,
      url,
      pageTextSample: bodyText.replace(/\s+/g, ' ').trim().slice(0, 500)
    };
  }
}

module.exports = { ProjectManagementPage };
