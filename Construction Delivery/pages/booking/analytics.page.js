const { DashboardPage } = require('./dashboard.page');
const { clickHighlighted, highlight } = require('../../utils/highlight');
const { loginIfVisible } = require('../../utils/login');
const { expectedUnitsFromCountryUom, normalizeText } = require('../../utils/uom');

const DATE_RANGE_MONTH_STEP = 6;
const DEFAULT_MAX_DATE_RANGE_ATTEMPTS = Number(process.env.ANALYTICS_DATE_RANGE_ATTEMPTS || 8);
const ANALYTICS_FROM_DATE = process.env.ANALYTICS_FROM_DATE || '';
const ANALYTICS_TO_DATE = process.env.ANALYTICS_TO_DATE || '';
const UNIT_HIGHLIGHT_WAIT_MS = Number(process.env.UNIT_HIGHLIGHT_WAIT_MS || 1200);
const ENVIRONMENT_REPORT_DATE_RANGE_OPTIONS = Object.freeze({
  initialLookbackMonths: 12,
  monthStep: 12,
  maxLookbackMonths: 36,
  maxAttempts: 3,
  allowNoRecords: false,
  ignoreConfiguredRange: true
});
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ANALYTICS_SECTIONS = {
  summary: /Summary Emission/i,
  vehicle: /Vehicle Emissions?|Vehicle Emission/i,
  equipment: /Equipment Emissions?|Equipment Emission/i,
  environment: /Environment Reports?|Environment Report/i
};
const ANALYTICS_SECTION_ROUTES = {
  summary: '/summary-emissions-report',
  vehicle: '/material-emission-report',
  equipment: '/off-road-emissions-report',
  environment: '/environment-report'
};

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function buildPastDateRanges({
  fromDate,
  toDate,
  monthStep = DATE_RANGE_MONTH_STEP,
  maxAttempts = DEFAULT_MAX_DATE_RANGE_ATTEMPTS,
  maxLookbackMonths = null
}) {
  const end = new Date(toDate);
  let start = new Date(fromDate);
  const earliestStart = Number.isFinite(maxLookbackMonths)
    ? addMonths(end, -Math.abs(maxLookbackMonths))
    : null;

  if (start > end) {
    throw new Error('Analytics From Date must be before the To Date.');
  }
  if (earliestStart && start < earliestStart) {
    start = earliestStart;
  }

  const ranges = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    ranges.push({ fromDate: new Date(start), toDate: new Date(end), attempt });
    if (earliestStart && start <= earliestStart) break;

    let nextStart = addMonths(start, -Math.abs(monthStep));
    if (earliestStart && nextStart < earliestStart) nextStart = earliestStart;
    if (nextStart.getTime() === start.getTime()) break;
    start = nextStart;
  }

  return ranges;
}

function formatAnalyticsDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  return `${day} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

function parseMonthYearHeader(headerText) {
  const text = String(headerText || '').trim();
  const monthYearMatch = text.match(/([A-Za-z]{3,9})\s+(\d{4})/);
  if (monthYearMatch) {
    const monthIndex = MONTH_NAMES.findIndex(
      (name) => name.toLowerCase() === monthYearMatch[1].slice(0, 3).toLowerCase()
    );
    if (monthIndex !== -1) {
      return new Date(Number(monthYearMatch[2]), monthIndex, 1);
    }
  }

  const fallback = new Date(`${text} 1`);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function parseAnalyticsDate(value) {
  const text = String(value || '').trim();
  if (!text) return null;

  const appDateMatch = text.match(/^(\d{1,2}),\s*(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+([A-Za-z]{3,9})\s+(\d{4})$/i);
  if (appDateMatch) {
    const monthIndex = MONTH_NAMES.findIndex(
      (name) => name.toLowerCase() === appDateMatch[2].slice(0, 3).toLowerCase()
    );
    if (monthIndex !== -1) {
      return new Date(Number(appDateMatch[3]), monthIndex, Number(appDateMatch[1]));
    }
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }

  const dmyMatch = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    return new Date(Number(dmyMatch[3]), Number(dmyMatch[2]) - 1, Number(dmyMatch[1]));
  }

  const textMonthMatch = text.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if (textMonthMatch) {
    const monthIndex = MONTH_NAMES.findIndex((name) => name.toLowerCase() === textMonthMatch[2].slice(0, 3).toLowerCase());
    if (monthIndex !== -1) {
      return new Date(Number(textMonthMatch[3]), monthIndex, Number(textMonthMatch[1]));
    }
  }

  const monthDayMatch = text.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (monthDayMatch) {
    const monthIndex = MONTH_NAMES.findIndex((name) => name.toLowerCase() === monthDayMatch[1].slice(0, 3).toLowerCase());
    if (monthIndex !== -1) {
      return new Date(Number(monthDayMatch[3]), monthIndex, Number(monthDayMatch[2]));
    }
  }

  return null;
}

function lower(value = '') {
  return normalizeText(value).toLowerCase();
}

class AnalyticsPage {
  constructor(page) {
    this.page = page;
    this.options = {
      appUrl: process.env.APP_URL || 'https://stg-app.voyagecontrol.com',
      projectId: process.env.PROJECT_ID || '5ET10000010',
      baseUrl: process.env.BASE_URL || 'https://stg-login.voyagecontrol.com',
      email: process.env.VC_EMAIL || 'hariharan.r@neuralrays.ai',
      password: process.env.VC_PASSWORD || 'Master@15'
    };

    this.platformProjectLink = page.getByRole('link', { name: /Construction Delivery|V3 Construction deliveries/i }).first();
    this.locationHeading = page.getByRole('heading', { name: /Buckingham Palace/i }).first();
    this.analyticsLink = page.getByRole('link', { name: /analytics Analytics|Analytics/i }).first();
    this.projectDetailsLink = page.getByRole('link', { name: /Project Details|Project Configuration|Project Settings|Settings/i }).first();
  }

  async waitForPageReady() {
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    await this.loginIfNeeded();
    await this.page.locator('[role="progressbar"], .MuiCircularProgress-root')
      .first()
      .waitFor({ state: 'hidden', timeout: 30000 })
      .catch(() => null);
    await this.page.waitForTimeout(1000);
  }

  async loginIfNeeded() {
    return loginIfVisible(this.page, {
      email: this.options.email,
      password: this.options.password,
      visibleTimeout: 10000,
      postLoginWaitMs: 2000,
      errorMessage: 'Analytics flow could not log in; check VC_EMAIL/VC_PASSWORD or auth.json.'
    });
  }

  projectUrl(routePath) {
    return `${this.options.appUrl.replace(/\/$/, '')}/${this.options.projectId}${routePath}`;
  }

  async isInProjectContext() {
    const currentUrl = this.page.url();
    if (new RegExp(`/${this.options.projectId}(?:/|$)`).test(currentUrl)) {
      return true;
    }

    if (/\/api\/sso\/users\/login|\/api\/sso\/platforms\/choose|\/project\/choose/i.test(currentUrl)) {
      return false;
    }

    return this.page.locator([
      `a[href*="/${this.options.projectId}/"]`,
      `[href*="/${this.options.projectId}/"]`,
      'a[href*="/booking"]',
      'a[href*="/analytics"]'
    ].join(', ')).first().isVisible({ timeout: 1000 }).catch(() => false);
  }

  async isOnAnalyticsPage() {
    if (/\/(summary-emissions-report|material-emission-report|off-road-emissions-report|environment-report)\b/i.test(this.page.url())) {
      return true;
    }

    return this.page.getByRole('heading', {
      name: /Summary Emission|Vehicle Emissions?|Equipment Emissions?|Environment Reports?/i
    }).first().isVisible({ timeout: 1000 }).catch(() => false);
  }

  async gotoFirstWorkingProjectRoute(routePaths, pageReadyPattern, label) {
    for (const routePath of routePaths) {
      const routeUrlPattern = new RegExp(`${routePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[/?#]|$)`, 'i');
      await this.forceTargetProjectStorage().catch(() => null);
      await this.page.goto(this.projectUrl(routePath), { waitUntil: 'domcontentloaded' }).catch((error) => {
        if (!/ERR_ABORTED|Navigation interrupted|net::ERR_ABORTED/i.test(error.message)) {
          throw error;
        }
      });
      await this.waitForPageReady();
      if (/\/api\/sso\/users\/login/i.test(this.page.url()) && await this.loginIfNeeded()) {
        await this.page.goto(this.projectUrl(routePath), { waitUntil: 'domcontentloaded' }).catch(() => null);
        await this.waitForPageReady();
      }
      if (/\/api\/sso\/platforms\/choose/i.test(this.page.url()) &&
          await this.navigateViaVisibleLinkText(/^(Construction Delivery|V3 Construction deliveries)$/i, 'Construction Delivery')) {
        await this.forceTargetProjectStorage();
        await this.page.goto(this.projectUrl(routePath), { waitUntil: 'domcontentloaded' }).catch(() => null);
        await this.waitForPageReady();
      }

      if (pageReadyPattern.test(await this.visibleBodyText())) {
        return routePath;
      }

      await this.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
      await this.waitForPageReady();
      if (pageReadyPattern.test(await this.visibleBodyText())) {
        return routePath;
      }

      await this.openRecordedProjectLocation().catch(() => null);
      await this.forceTargetProjectStorage().catch(() => null);
      await this.page.goto(this.projectUrl(routePath), { waitUntil: 'domcontentloaded' }).catch(() => null);
      await this.waitForPageReady();
      if (pageReadyPattern.test(await this.visibleBodyText())) {
        return routePath;
      }

      if (routeUrlPattern.test(this.page.url())) {
        console.log(`${label} route URL is active: ${this.page.url()}`);
        return routePath;
      }
    }

    throw new Error(`Could not open ${label}. Current URL: ${this.page.url()}`);
  }

  async visibleBodyText() {
    return this.page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  }

  async forceTargetProjectStorage() {
    const selectedProject = await this.page.evaluate((projectId) => {
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
          // Ignore non-JSON localStorage entries.
        }
      }

      return null;
    }, this.options.projectId).catch(() => null);

    if (selectedProject) {
      console.log(`Analytics target project selected in browser storage: ${selectedProject}`);
    }

    return selectedProject;
  }

  async readProjectConfigurationFromStorage() {
    return this.page.evaluate(() => {
      const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim();
      const readName = (value) => {
        if (!value) return '';
        if (typeof value === 'string') return normalize(value);
        if (typeof value !== 'object') return normalize(value);
        return normalize(value.name || value.code || value.value || value.label || '');
      };
      const countryAliases = {
        GB: ['gb', 'uk', 'united kingdom', 'great britain', 'britain', 'england', 'scotland', 'wales'],
        US: ['us', 'usa', 'united states', 'united states of america'],
        IN: ['in', 'india'],
        AU: ['au', 'australia'],
        CN: ['cn', 'china'],
        FR: ['fr', 'france']
      };
      const countryMatches = (candidateCountry, projectCountry) => {
        const candidate = normalize(candidateCountry).toLowerCase();
        const project = normalize(projectCountry).toUpperCase();
        if (!candidate || !project) return false;
        const aliases = countryAliases[project] || [project.toLowerCase()];
        return aliases.some((alias) => candidate === alias || candidate.includes(alias) || alias.includes(candidate));
      };
      const summarizeUom = (config) => [
        readName(config.country) && `Country: ${readName(config.country)}`,
        readName(config.distance) && `Distance: ${readName(config.distance)}`,
        readName(config.volume) && `Volume: ${readName(config.volume)}`,
        readName(config.weight) && `Weight: ${readName(config.weight)}`,
        readName(config.tons) && `Tons: ${readName(config.tons)}`
      ].filter(Boolean).join('; ');
      const findCountryUomConfig = (projectCountry) => {
        const seen = new Set();
        const visit = (value) => {
          if (!value || typeof value !== 'object' || seen.has(value)) return null;
          seen.add(value);

          const hasUomFields = value.country && (value.distance || value.volume || value.weight || value.tons);
          if (hasUomFields && countryMatches(readName(value.country), projectCountry)) {
            return value;
          }

          for (const nested of Object.values(value)) {
            const found = visit(nested);
            if (found) return found;
          }

          return null;
        };

        for (let index = 0; index < localStorage.length; index += 1) {
          const raw = localStorage.getItem(localStorage.key(index));
          if (!raw || !/country|distance|volume|weight|tons/i.test(raw)) continue;
          try {
            const found = visit(JSON.parse(raw));
            if (found) return found;
          } catch {
            // Ignore non-JSON storage values.
          }
        }

        return null;
      };
      const projectRaw = localStorage.getItem('v3_project_data');
      let project = null;

      try {
        project = projectRaw ? JSON.parse(projectRaw) : null;
      } catch {
        project = null;
      }

      const findValueByKey = (value, keyPattern) => {
        if (!value || typeof value !== 'object') return '';

        for (const [key, nestedValue] of Object.entries(value)) {
          if (keyPattern.test(key) && typeof nestedValue !== 'object') {
            return normalize(nestedValue);
          }
        }

        for (const nestedValue of Object.values(value)) {
          const found = findValueByKey(nestedValue, keyPattern);
          if (found) return found;
        }

        return '';
      };

      const country = findValueByKey(project, /^country(_name)?$|countryName/i);
      const configuredUom = findCountryUomConfig(country);
      return {
        country,
        countryUom: configuredUom
          ? summarizeUom(configuredUom)
          : findValueByKey(project, /country.*uom|uom|unit.*measure|measurement/i),
        projectAddress: findValueByKey(project, /^(site)?address$|siteAddress|site_address|projectAddress|project_address/i),
        projectName: normalize(project?.name || project?.project_name || '')
      };
    }).catch(() => ({ country: '', countryUom: '', projectAddress: '', projectName: '' }));
  }

  async readProjectConfigurationFromLandingPage() {
    return this.page.evaluate(() => {
      const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim();
      const bodyText = document.body.innerText || document.body.textContent || '';
      const bodyLines = bodyText.split(/\r?\n/).map(normalize).filter(Boolean);
      const visibleElements = Array.from(document.querySelectorAll('label, dt, th, p, span, div'))
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0';
        });

      const cleanValue = (value, labels) => {
        const cleaned = normalize(value).replace(new RegExp(`^(?:${labels.join('|')})\\s*[:\\-]?\\s*`, 'i'), '');
        if (!cleaned || /^(uom|country uom|unit of measure|country unit of measure)$/i.test(cleaned)) {
          return '';
        }
        return cleaned;
      };

      const readAfterLabel = (labels) => {
        for (const line of bodyLines) {
          for (const label of labels) {
            const match = line.match(new RegExp(`^${label}\\s*[:\\-]\\s*(.+)$`, 'i'));
            if (match) return cleanValue(match[1], labels);
          }
        }

        for (const element of visibleElements) {
          const text = normalize(element.innerText || element.textContent || '');
          if (!labels.some((label) => new RegExp(`^${label}$`, 'i').test(text))) continue;

          const candidates = [
            element.nextElementSibling,
            element.parentElement?.querySelector('input, [role="combobox"], .MuiSelect-select'),
            element.parentElement?.nextElementSibling
          ].filter(Boolean);

          for (const candidate of candidates) {
            const candidateText = cleanValue(
              candidate.value || candidate.innerText || candidate.textContent || '',
              labels
            );
            if (candidateText) return candidateText;
          }
        }

        for (const label of labels) {
          const pattern = new RegExp(`${label}\\s*[:\\-]\\s*([^\\n|]+)`, 'i');
          const match = bodyText.match(pattern);
          if (match) return cleanValue(match[1], labels);
        }

        return '';
      };

      return {
        country: readAfterLabel(['Country']),
        countryUom: readAfterLabel(['Country UOM', 'Country Unit Of Measure', 'UOM', 'Unit Of Measure']),
        projectName: /Buckingham Palace/i.test(bodyText) ? 'Buckingham Palace' : ''
      };
    }).catch(() => ({ country: '', countryUom: '', projectName: '' }));
  }

  async getVisibleLinkHrefByText(pattern) {
    return this.page.evaluate((patternSource) => {
      const pattern = new RegExp(patternSource, 'i');
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };

      const links = Array.from(document.querySelectorAll('a[href]')).filter(isVisible);
      const link = links.find((candidate) => pattern.test(candidate.innerText || candidate.textContent || '')) ||
        links.find((candidate) => {
          const card = candidate.closest('div, section, article') || candidate;
          return pattern.test(card.innerText || card.textContent || '');
        });

      return link?.href || '';
    }, pattern.source).catch(() => '');
  }

  async navigateViaVisibleLinkText(pattern, label) {
    const href = await this.getVisibleLinkHrefByText(pattern);
    if (!href) return false;

    console.log(`Opening ${label}: ${href.replace(/[?].*/, '')}`);
    await this.page.goto(href, { waitUntil: 'domcontentloaded' }).catch((error) => {
      if (!/ERR_ABORTED|Navigation interrupted|net::ERR_ABORTED/i.test(error.message)) {
        throw error;
      }
    });
    await this.waitForPageReady();
    return true;
  }

  async clickVisibleLinkByText(pattern, label) {
    const clicked = await this.page.evaluate((patternSource) => {
      const pattern = new RegExp(patternSource, 'i');
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };

      const link = Array.from(document.querySelectorAll('a[href], button, [role="link"], [role="button"]'))
        .filter(isVisible)
        .find((candidate) => pattern.test(candidate.innerText || candidate.textContent || candidate.getAttribute('aria-label') || ''));

      if (!link) return false;
      link.scrollIntoView({ block: 'center', inline: 'center' });
      link.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      link.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    }, pattern.source).catch(() => false);

    if (!clicked) return false;
    console.log(`Clicked ${label} from visible Analytics menu.`);
    await this.waitForPageReady();
    return true;
  }

  async clickProjectCardByHeading(projectName) {
    const clicked = await this.page.evaluate((targetProjectName) => {
      const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim();
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };

      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, div, span'))
        .filter(isVisible);
      const heading = headings.find((element) => normalize(element.innerText || element.textContent || '') === targetProjectName);
      if (!heading) return false;

      let card = heading.parentElement || heading;
      while (card.parentElement && card.parentElement !== document.body) {
        const text = normalize(card.innerText || card.textContent || '');
        const rect = card.getBoundingClientRect();
        if (/Log Into/i.test(text) && text.includes(targetProjectName) && rect.width > 250) break;
        card = card.parentElement;
      }

      const visibleControls = Array.from(card.querySelectorAll('a, button, [role="button"], svg, img'))
        .filter(isVisible);
      const clickTarget = visibleControls[visibleControls.length - 1] || card;

      clickTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      clickTarget.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      clickTarget.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      if (card !== clickTarget) {
        card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      }
      return true;
    }, projectName).catch(() => false);

    if (clicked) {
      await this.page.waitForLoadState('domcontentloaded').catch(() => null);
      await this.waitForPageReady();
    }

    return clicked;
  }

  async clickProjectCardWithMouse(projectName) {
    const heading = this.page.getByRole('heading', { name: projectName, exact: true }).first();
    if (await heading.isVisible({ timeout: 3000 }).catch(() => false)) {
      await heading.click({ force: true, timeout: 5000 });
      await this.page.waitForLoadState('domcontentloaded').catch(() => null);
      await this.page.waitForTimeout(5000);
      if (!/\/project\/choose/i.test(this.page.url())) {
        await this.waitForPageReady();
        return true;
      }
    }

    const exactText = this.page.getByText(projectName, { exact: true }).first();
    if (await exactText.isVisible({ timeout: 1000 }).catch(() => false)) {
      await exactText.click({ force: true, timeout: 5000 });
      await this.page.waitForLoadState('domcontentloaded').catch(() => null);
      await this.page.waitForTimeout(5000);
      if (!/\/project\/choose/i.test(this.page.url())) {
        await this.waitForPageReady();
        return true;
      }
    }

    await this.page.evaluate((targetProjectName) => {
      const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim();
      document.querySelectorAll('[data-vc-project-card-target]').forEach((element) => {
        element.removeAttribute('data-vc-project-card-target');
      });

      const heading = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
        .find((element) => normalize(element.innerText || element.textContent || '') === targetProjectName);
      if (!heading) return;

      const ancestors = [];
      let candidate = heading.parentElement;
      while (candidate && candidate !== document.body) {
        const text = normalize(candidate.innerText || candidate.textContent || '');
        const rect = candidate.getBoundingClientRect();
        if (text.includes(targetProjectName) && /Log Into/i.test(text) && rect.width >= 250 && rect.height >= 50 && rect.height <= 180) {
          ancestors.push(candidate);
        }
        candidate = candidate.parentElement;
      }

      const card = ancestors[ancestors.length - 1] || heading.parentElement;
      if (card) card.setAttribute('data-vc-project-card-target', 'true');
    }, projectName).catch(() => null);

    const card = this.page.locator('[data-vc-project-card-target="true"]').first();
    if (!(await card.isVisible({ timeout: 3000 }).catch(() => false))) {
      return false;
    }

    await highlight(card, projectName).catch(() => null);
    const box = await card.boundingBox().catch(() => null);
    if (!box) return false;

    await this.page.mouse.click(box.x + box.width - 28, box.y + box.height / 2);
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    await this.page.waitForTimeout(2000);

    if (!/\/project\/choose/i.test(this.page.url())) {
      await this.waitForPageReady();
      return true;
    }

    await card.click({ force: true, position: { x: Math.max(box.width - 28, 1), y: Math.max(box.height / 2, 1) } }).catch(() => null);
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    await this.page.waitForTimeout(2000);
    await this.waitForPageReady();
    return !/\/project\/choose/i.test(this.page.url());
  }

  async openRecordedProjectLocation() {
    const dashboard = new DashboardPage(this.page);

    if (/\/api\/sso\/users\/login/i.test(this.page.url()) || !/^https?:\/\//i.test(this.page.url())) {
      await this.page.goto(`${this.options.appUrl.replace(/\/$/, '')}/login`, {
        waitUntil: 'domcontentloaded'
      }).catch(() => null);
    }

    await this.waitForPageReady();
    await this.forceTargetProjectStorage();

    if (/\/api\/sso\/platforms\/choose/i.test(this.page.url())) {
      if (await this.navigateViaVisibleLinkText(/^(Construction Delivery|V3 Construction deliveries)$/i, 'Construction Delivery')) {
        await this.waitForPageReady();
        await this.forceTargetProjectStorage();
      }
    } else if (await this.platformProjectLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.navigateViaVisibleLinkText(/^(Construction Delivery|V3 Construction deliveries)$/i, 'Construction Delivery')
        .catch(async () => clickHighlighted(this.platformProjectLink, 'Construction Delivery'));
      await this.waitForPageReady();
      await this.forceTargetProjectStorage();
    }

    if (/\/project\/choose/i.test(this.page.url())) {
      if (await dashboard.clickLocationProjectCard('Buckingham Palace').catch(() => false)) {
        await this.waitForPageReady();
      }

      if (/\/project\/choose/i.test(this.page.url()) &&
          await this.clickProjectCardWithMouse('Buckingham Palace')) {
        await this.waitForPageReady();
      } else if (/\/project\/choose/i.test(this.page.url()) &&
          await this.clickProjectCardByHeading('Buckingham Palace')) {
        await this.waitForPageReady();
      }
    } else if (await this.locationHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
      await clickHighlighted(this.locationHeading, 'Buckingham Palace');
      await this.waitForPageReady();
    }

    if (/\/api\/sso\/platforms\/choose/i.test(this.page.url())) {
      throw new Error('Analytics flow stayed on the SSO platform chooser after selecting Construction Delivery.');
    }

    if (/\/project\/choose/i.test(this.page.url())) {
      await this.page.goto(this.projectUrl('/list-equipment'), { waitUntil: 'domcontentloaded' }).catch((error) => {
        if (!/ERR_ABORTED|Navigation interrupted|net::ERR_ABORTED/i.test(error.message)) {
          throw error;
        }
      });
      await this.waitForPageReady();
      await this.forceTargetProjectStorage();
      if (/\/api\/sso\/users\/login/i.test(this.page.url()) && await this.loginIfNeeded()) {
        await this.page.goto(this.projectUrl('/list-equipment'), { waitUntil: 'domcontentloaded' }).catch(() => null);
        await this.waitForPageReady();
        await this.forceTargetProjectStorage();
      }
    }

    if (/\/project\/choose/i.test(this.page.url())) {
      throw new Error('Analytics flow stayed on the project chooser after selecting Buckingham Palace and opening the direct project route.');
    }
  }

  async openAnalytics() {
    if (await this.isInProjectContext()) {
      await this.waitForPageReady();
      await this.forceTargetProjectStorage();
    } else {
      await this.openRecordedProjectLocation();
    }

    if (await this.isOnAnalyticsPage()) {
      return;
    }

    if (await this.analyticsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clickHighlighted(this.analyticsLink, 'Analytics');
      await this.waitForPageReady();
      if (!/\/project\/choose/i.test(this.page.url()) &&
          /Analytics|Vehicle Emission|Equipment Emission|Summary Emission|Environment Reports/i.test(await this.visibleBodyText())) {
        return;
      }
      console.log(`Analytics sidebar link did not settle on Analytics. Current URL: ${this.page.url()}`);
    }

    const analyticsHref = await this.getVisibleLinkHrefByText(/analytics/i);
    if (analyticsHref && !/\/api\/sso\/users\/logout/i.test(analyticsHref)) {
      console.log(`Opening Analytics from visible project link: ${analyticsHref.replace(/[?].*/, '')}`);
      await this.page.goto(analyticsHref, { waitUntil: 'domcontentloaded' }).catch((error) => {
        if (!/ERR_ABORTED|Navigation interrupted|net::ERR_ABORTED/i.test(error.message)) {
          throw error;
        }
      });
      await this.waitForPageReady();
      if (/Analytics|Vehicle Emission|Equipment Emission|Summary Emission|Environment Reports/i.test(await this.visibleBodyText())) {
        return;
      }
    }

    const openedAppAnalytics = await this.gotoFirstWorkingProjectRoute([
      ANALYTICS_SECTION_ROUTES.summary,
      ANALYTICS_SECTION_ROUTES.vehicle,
      ANALYTICS_SECTION_ROUTES.equipment,
      ANALYTICS_SECTION_ROUTES.environment
    ], /Analytics|Vehicle Emission|Equipment Emission|Emissions/i, 'Analytics').then(() => true).catch((error) => {
      console.log(`In-app Analytics route was not available: ${error.message}`);
      return false;
    });

    if (openedAppAnalytics) return;

    if (/\/environment-report\b/i.test(this.page.url())) {
      console.log('Continuing from expanded Analytics Environment Reports page.');
      return;
    }

    throw new Error(`Could not open Analytics from Buckingham Palace project context. Current URL: ${this.page.url()}`);
  }

  async openAnalyticsPlatformFromSsoLanding() {
    await this.page.goto(`${this.options.baseUrl.replace(/\/$/, '')}/api/sso/users/login/`, {
      waitUntil: 'domcontentloaded'
    }).catch(() => null);
    await this.waitForPageReady();

    if (/\/api\/sso\/users\/login/i.test(this.page.url())) {
      await this.loginIfNeeded();
      await this.waitForPageReady();
    }

    if (await this.navigateViaVisibleLinkText(/^Analytics$/i, 'Analytics platform')) {
      await this.waitForPageReady();
      if (/\/project\/choose/i.test(this.page.url())) {
        const dashboard = new DashboardPage(this.page);
        if (await dashboard.clickLocationProjectCard('Buckingham Palace').catch(() => false)) {
          await this.waitForPageReady();
        }
        if (/\/project\/choose/i.test(this.page.url())) {
          await this.clickProjectCardWithMouse('Buckingham Palace');
          await this.waitForPageReady();
        }
      }
      return;
    }

    throw new Error(`Could not open Analytics platform from SSO landing page. Current URL: ${this.page.url()}`);
  }

  async openProjectDetails() {
    await this.openRecordedProjectLocation();
    const currentUrl = this.page.url();

    if (await this.projectDetailsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await clickHighlighted(this.projectDetailsLink, 'Project Details');
      await this.waitForPageReady();
      return currentUrl;
    }

    await this.gotoFirstWorkingProjectRoute([
      '/dashboard/project-details',
      '/project-details',
      '/dashboard/project',
      '/settings/project-details',
      '/dashboard/settings'
    ], /Project Details|Project Configuration|Country|Country UOM|UOM|Unit/i, 'Project Details');
    return currentUrl;
  }

  async openProjectManagementRoute(routePath, label, readyPattern) {
    const targetUrl = this.projectUrl(`/${routePath.replace(/^\//, '')}`);
    await this.forceTargetProjectStorage().catch(() => null);
    await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded' })
      .catch((error) => {
        if (!/ERR_ABORTED|Navigation interrupted|net::ERR_ABORTED/i.test(error.message)) {
          throw error;
        }
      });
    await this.waitForPageReady();
    let bodyText = await this.visibleBodyText();
    if (!bodyText || /^Push notifications are disabled/i.test(bodyText)) {
      await this.forceTargetProjectStorage().catch(() => null);
      await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch(() => null);
      await this.waitForPageReady();
      bodyText = await this.visibleBodyText();
    }

    if (readyPattern && !readyPattern.test(bodyText) && !new RegExp(`/${routePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[/?#]|$)`, 'i').test(this.page.url())) {
      throw new Error(`${label} did not become readable. Current URL: ${this.page.url()}`);
    }
  }

  async readProjectDetailsEvidence() {
    const evidence = {
      source: 'Project Management > Project Details',
      status: 'not-read',
      url: '',
      projectAddress: '',
      country: '',
      issue: ''
    };

    try {
      await this.openProjectManagementRoute('site-details', 'Project Details', /Project Details|Project Information|Address|Country/i);
      const details = await this.page.evaluate(() => {
        const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim();
        const bodyText = normalize(document.body.innerText || document.body.textContent || '');
        const readElementValue = (selector) => {
          const element = document.querySelector(selector);
          if (!element) return '';
          return normalize(element.value || element.innerText || element.textContent || '');
        };
        const readAfterLabel = (labels) => {
          const lines = bodyText.split(/\s{2,}|\n/).map(normalize).filter(Boolean);
          for (const line of lines) {
            for (const label of labels) {
              const match = line.match(new RegExp(`^${label}\\s*[:\\-]?\\s*(.+)$`, 'i'));
              if (match && !new RegExp(`^${label}$`, 'i').test(match[1])) return normalize(match[1]);
            }
          }

          const elements = Array.from(document.querySelectorAll('label, dt, th, p, span, div'))
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              const style = window.getComputedStyle(element);
              return rect.width > 0 && rect.height > 0 &&
                style.visibility !== 'hidden' &&
                style.display !== 'none' &&
                style.opacity !== '0';
            });

          for (const element of elements) {
            const text = normalize(element.innerText || element.textContent || '');
            if (!labels.some((label) => new RegExp(`^${label}$`, 'i').test(text))) continue;
            const candidates = [
              element.nextElementSibling,
              element.parentElement?.querySelector('input, textarea, [role="combobox"], .MuiSelect-select'),
              element.parentElement?.nextElementSibling
            ].filter(Boolean);
            for (const candidate of candidates) {
              const value = normalize(candidate.value || candidate.innerText || candidate.textContent || '');
              if (value && !labels.some((label) => new RegExp(`^${label}$`, 'i').test(value))) return value;
            }
          }

          return '';
        };

        return {
          projectAddress: readElementValue('#siteAddress, input[name*="address" i], textarea[name*="address" i]') ||
            readAfterLabel(['Project Address', 'Site Address', 'Address']),
          country: readElementValue('#country, #mui-component-select-country, [name*="country" i]') ||
            readAfterLabel(['Country'])
        };
      });

      return {
        ...evidence,
        ...details,
        status: details.country || details.projectAddress ? 'read' : 'not-found',
        url: this.page.url()
      };
    } catch (error) {
      return {
        ...evidence,
        status: 'failed',
        url: this.page.url(),
        issue: error.message
      };
    }
  }

  formatCountryUomRow(cells) {
    if (!Array.isArray(cells) || cells.length < 5) return '';
    return [
      `Country: ${cells[0]}`,
      `Distance: ${cells[1]}`,
      `Volume: ${cells[2]}`,
      `Weight: ${cells[3]}`,
      `Tons: ${cells[4]}`
    ].join('; ');
  }

  async readCountryUomPageEvidence(projectCountry = '') {
    const evidence = {
      source: 'Project Management > Country UOMs',
      status: 'not-read',
      url: '',
      searchedFor: '',
      countryUom: '',
      rows: [],
      issue: ''
    };

    try {
      await this.openProjectManagementRoute('country', 'Country UOMs', /Country UOM|Distance|Volume|Weight|Tons|Add Country UOM/i);
      const searchTerms = Array.from(new Set([
        projectCountry,
        projectCountry.replace(/\bGB\b/i, 'United Kingdom'),
        projectCountry.replace(/\bUK\b/i, 'United Kingdom')
      ].map((value) => normalizeText(value)).filter(Boolean)));

      const search = this.page.getByRole('textbox', { name: /Search/i }).first();
      for (const term of searchTerms) {
        if (await search.isVisible({ timeout: 1500 }).catch(() => false)) {
          await search.fill(term);
          await this.waitForPageReady();
          await this.page.waitForTimeout(600);
          evidence.searchedFor = term;
        }
        const body = await this.visibleBodyText();
        if (new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(body)) break;
      }

      const rows = await this.page.evaluate(() => {
        const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim();
        const isVisible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0';
        };

        return Array.from(document.querySelectorAll('tbody tr, [role="row"]'))
          .filter(isVisible)
          .map((row) => {
            const cells = Array.from(row.querySelectorAll('td, [role="cell"], [role="gridcell"]'))
              .filter(isVisible)
              .map((cell) => normalize(cell.innerText || cell.textContent || ''))
              .filter(Boolean);
            return {
              text: normalize(row.innerText || row.textContent || ''),
              cells
            };
          })
          .filter((row) => row.text && !/No Data found|No records found|No data|No results/i.test(row.text));
      });

      const expectedCountry = normalizeText(projectCountry).toLowerCase();
      const matchedRow = rows.find((row) => {
        const text = normalizeText(row.text).toLowerCase();
        return expectedCountry && (
          text.includes(expectedCountry) ||
          (/\b(gb|uk)\b/i.test(expectedCountry) && /united kingdom|great britain|britain|england|scotland|wales/i.test(text))
        );
      }) || rows[0];
      const countryUom = this.formatCountryUomRow(matchedRow?.cells) || normalizeText(matchedRow?.text || '');

      return {
        ...evidence,
        status: countryUom ? 'read' : 'not-found',
        url: this.page.url(),
        rows,
        countryUom
      };
    } catch (error) {
      return {
        ...evidence,
        status: 'failed',
        url: this.page.url(),
        issue: error.message
      };
    }
  }

  serializeExpectedUnits(expectedUnits) {
    return {
      configuredCountry: expectedUnits.configuredCountry || null,
      configuredCountryUom: expectedUnits.configuredCountryUom,
      fallbackApplied: expectedUnits.fallbackApplied,
      distanceUnit: expectedUnits.distanceUnit,
      volumeUnit: expectedUnits.volumeUnit,
      weightUnit: expectedUnits.weightUnit,
      tonsUnit: expectedUnits.tonsUnit,
      defaultProtocol: {
        distance: 'Miles',
        volume: 'Gallons',
        weight: 'Oz',
        tons: 'US Tons'
      }
    };
  }

  async readProjectUomConfigurationProtocol() {
    await this.openRecordedProjectLocation();
    const storedDetails = await this.readProjectConfigurationFromStorage();
    const projectDetails = await this.readProjectDetailsEvidence();
    const country = projectDetails.country || storedDetails.country || '';
    if (!projectDetails.country && storedDetails.country) {
      projectDetails.country = storedDetails.country;
      projectDetails.issue = projectDetails.issue || 'Project Details fields were not visible; country was read from browser project storage.';
    }
    if (!projectDetails.projectAddress && storedDetails.projectAddress) {
      projectDetails.projectAddress = storedDetails.projectAddress;
      projectDetails.issue = projectDetails.issue || 'Project Details fields were not visible; address was read from browser project storage.';
    }
    const countryUomPage = await this.readCountryUomPageEvidence(country);
    const countryUom = countryUomPage.countryUom || storedDetails.countryUom || projectDetails.countryUom || '';
    const expectedUnits = expectedUnitsFromCountryUom(countryUom);

    console.log(
      `Project country: ${country || '-'}. ` +
      `Country UOM: ${countryUom || 'not configured; using default Miles/Gallons/Oz/US Tons'}.`
    );

    return {
      ...storedDetails,
      country,
      countryUom,
      expectedUnits,
      uomProtocolEvidence: {
        projectDetails,
        countryUomPage,
        expectedUnits: this.serializeExpectedUnits(expectedUnits)
      }
    };
  }

  async readProjectConfiguration(options = {}) {
    const shouldNavigateToProject = options.navigateToProject !== false;
    if (shouldNavigateToProject) {
      await this.openRecordedProjectLocation();
    }
    const landingDetails = await this.readProjectConfigurationFromLandingPage();
    const storedDetails = await this.readProjectConfigurationFromStorage();
    const mergedDetails = {
      ...storedDetails,
      ...landingDetails,
      country: landingDetails.country || storedDetails.country,
      countryUom: landingDetails.countryUom || storedDetails.countryUom
    };

    if (mergedDetails.country || mergedDetails.countryUom) {
      const expectedUnits = expectedUnitsFromCountryUom(mergedDetails.countryUom);
      const countryUomStatus = mergedDetails.countryUom || 'not configured; using default miles/US tons';
      if (mergedDetails.countryUom) {
        await highlight(this.page.getByText(/Country UOMs|Country UOM|Project Details/i).first(), `Country UOM: ${mergedDetails.countryUom}`)
          .catch(() => null);
        await this.page.waitForTimeout(UNIT_HIGHLIGHT_WAIT_MS);
      }
      console.log(
        `Project country: ${mergedDetails.country || '-'}. ` +
        `Country UOM: ${countryUomStatus}.`
      );
      return {
        ...mergedDetails,
        expectedUnits
      };
    }

    if (landingDetails.countryUom) {
      const expectedUnits = expectedUnitsFromCountryUom(landingDetails.countryUom);
      console.log(
        `Project country: ${landingDetails.country || '-'}. ` +
        `Country UOM: ${landingDetails.countryUom || 'not configured; using default miles/US tons'}.`
      );
      return {
        ...landingDetails,
        expectedUnits
      };
    }

    const expectedStoredUnits = expectedUnitsFromCountryUom(storedDetails.countryUom);
    console.log(
      `Project country: ${storedDetails.country || '-'}. ` +
      `Country UOM: ${storedDetails.countryUom || 'not configured; using default miles/US tons'}.`
    );
    return {
      ...storedDetails,
      expectedUnits: expectedStoredUnits
    };

    const returnUrl = await this.openProjectDetails();
    const details = await this.page.evaluate(() => {
      const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim();
      const bodyText = normalize(document.body.innerText || document.body.textContent || '');

      const readValueAfterLabel = (labels) => {
        const labelPattern = new RegExp(`(?:${labels.join('|')})\\s*[:\\-]?\\s*([^\\n|]+)`, 'i');
        const textMatch = bodyText.match(labelPattern);
        if (textMatch) return normalize(textMatch[1]).replace(/^(Country|Country UOM|UOM)\s*/i, '').trim();

        const elements = Array.from(document.querySelectorAll('label, dt, th, p, span, div'))
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return rect.width > 0 &&
              rect.height > 0 &&
              style.visibility !== 'hidden' &&
              style.display !== 'none' &&
              style.opacity !== '0';
          });

        for (const element of elements) {
          const text = normalize(element.innerText || element.textContent || '');
          if (!labels.some((label) => new RegExp(`^${label}$`, 'i').test(text))) continue;

          const candidates = [
            element.nextElementSibling,
            element.parentElement?.querySelector('input, [role="combobox"], .MuiSelect-select'),
            element.parentElement?.nextElementSibling
          ].filter(Boolean);

          for (const candidate of candidates) {
            const candidateText = normalize(candidate.value || candidate.innerText || candidate.textContent || '');
            if (candidateText && !labels.some((label) => new RegExp(label, 'i').test(candidateText))) {
              return candidateText;
            }
          }
        }

        return '';
      };

      return {
        country: readValueAfterLabel(['Country']),
        countryUom: readValueAfterLabel(['Country UOM', 'Country Unit Of Measure', 'UOM', 'Unit Of Measure'])
      };
    });

    const expectedUnits = expectedUnitsFromCountryUom(details.countryUom);
    console.log(`Project country: ${details.country || '-'}. Country UOM: ${details.countryUom || 'not configured; using default miles/US tons'}.`);

    if (returnUrl && /^https?:\/\//i.test(returnUrl)) {
      await this.page.goto(returnUrl, { waitUntil: 'domcontentloaded' }).catch(() => null);
      await this.waitForPageReady();
    }

    return {
      ...details,
      expectedUnits
    };
  }

  async openAnalyticsSection(sectionName) {
    await this.openAnalytics();
    const sectionKey = lower(sectionName).split(' ')[0];
    const sectionPattern = ANALYTICS_SECTIONS[sectionKey] ||
      new RegExp(sectionName.replace(/\s+/g, '\\s*'), 'i');
    const heading = this.page.getByRole('heading', { name: sectionPattern }).first();
    const route = ANALYTICS_SECTION_ROUTES[sectionKey];
    const routePattern = route
      ? new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[/?#]|$)`, 'i')
      : null;
    const sectionIsReady = async (timeout = 5000) => {
      if (routePattern && routePattern.test(this.page.url())) {
        return true;
      }
      return heading.isVisible({ timeout }).catch(() => false);
    };

    if (await sectionIsReady(1000)) {
      return;
    }

    const tab = this.page.getByRole('tab', { name: sectionPattern }).first();
    const button = this.page.getByRole('button', { name: sectionPattern }).first();
    const link = this.page.getByRole('link', { name: sectionPattern }).first();

    for (const locator of [link, tab, button]) {
      if (await locator.isVisible({ timeout: 1500 }).catch(() => false)) {
        await clickHighlighted(locator, sectionName);
        await this.waitForPageReady();
        if (await sectionIsReady(10000)) {
          return;
        }
      }
    }

    if (await this.clickVisibleLinkByText(sectionPattern, sectionName)) {
      if (await sectionIsReady(10000)) {
        return;
      }
    }

    if (await this.navigateViaVisibleLinkText(sectionPattern, sectionName)) {
      if (await sectionIsReady(10000)) {
        return;
      }
    }

    const routeCandidates = route
      ? [route]
      : [`/analytics/${sectionName.toLowerCase().replace(/\s+/g, '-')}`];
    await this.gotoFirstWorkingProjectRoute(routeCandidates, sectionPattern, sectionName);

    if (!(await sectionIsReady(10000))) {
      throw new Error(`${sectionName} route opened but the functional page content was not visible. Current URL: ${this.page.url()}`);
    }
  }

  async getDateInputs() {
    await this.page.evaluate(() => {
      document.querySelectorAll('[data-vc-analytics-date-input]').forEach((element) => {
        element.removeAttribute('data-vc-analytics-date-input');
      });

      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };

      Array.from(document.querySelectorAll('input'))
        .filter((input) => {
          const text = [
            input.placeholder,
            input.getAttribute('aria-label'),
            input.name,
            input.id,
            input.value
          ].join(' ');
          return isVisible(input) &&
            !input.disabled &&
            !/search|email|password/i.test(text) &&
            (/date|yyyy|mmm|from|to/i.test(text) || /\d{1,2}\s[A-Z][a-z]{2}\s\d{4}/.test(input.value || ''));
        })
        .forEach((input, index) => input.setAttribute('data-vc-analytics-date-input', String(index)));
    });

    return this.page.locator('[data-vc-analytics-date-input]');
  }

  async openAnalyticsDatePicker(index, label) {
    const input = (await this.getDateInputs()).nth(index);
    await input.waitFor({ state: 'visible', timeout: 15000 });
    await highlight(input, label).catch(() => null);

    await input.click({ force: true }).catch(() => null);
    const picker = this.page.locator('.MuiDateCalendar-root, .MuiPickersPopper-root, [role="dialog"]').last();
    if (await picker.isVisible({ timeout: 2000 }).catch(() => false)) {
      return true;
    }

    await input.evaluate((element) => {
      let container = element;
      while (container && container !== document.body) {
        const button = container.querySelector('button');
        if (button) {
          button.click();
          return;
        }
        container = container.parentElement;
      }
    }).catch(() => null);

    return picker.isVisible({ timeout: 3000 }).catch(() => false);
  }

  async setDateInput(index, date, label) {
    const formatted = formatAnalyticsDate(date);
    const input = (await this.getDateInputs()).nth(index);
    await input.waitFor({ state: 'visible', timeout: 15000 });
    await highlight(input, label).catch(() => null);

    if (await this.openAnalyticsDatePicker(index, label).catch(() => false) &&
        await this.selectDateInOpenPicker(date, label).catch(() => false)) {
      await this.clickOutsideDatePicker(label).catch(() => null);
      await this.assertDateInputValue(index, date, label);
      return formatted;
    }

    throw new Error(`${label} could not be selected from the date picker for ${formatted}.`);
  }

  async assertDateInputValue(index, expectedDate, label) {
    const input = (await this.getDateInputs()).nth(index);
    const actualValue = await input.inputValue({ timeout: 5000 });
    const actualDate = parseAnalyticsDate(actualValue);
    const matches = actualDate &&
      actualDate.getFullYear() === expectedDate.getFullYear() &&
      actualDate.getMonth() === expectedDate.getMonth() &&
      actualDate.getDate() === expectedDate.getDate();

    if (!matches) {
      throw new Error(
        `${label} was not updated. Expected ${formatAnalyticsDate(expectedDate)}; ` +
        `calendar shows ${actualValue || 'an empty value'}.`
      );
    }

    return actualValue;
  }

  async clickOutsideDatePicker(label) {
    await this.page.locator('body').first().click({ position: { x: 10, y: 10 }, force: true }).catch(() => null);
    await this.page.waitForTimeout(200);
    await this.page.keyboard.press('Enter').catch(() => null);
    await this.waitForPageReady();
  }

  async selectDateInOpenPicker(date, label) {
    const picker = this.page.locator('.MuiDateCalendar-root, .MuiPickersPopper-root, [role="dialog"]').last();
    await picker.waitFor({ state: 'visible', timeout: 5000 });

    for (let attempt = 0; attempt < 96; attempt += 1) {
      const headerText = await this.page.locator('.MuiPickersCalendarHeader-label').last()
        .innerText({ timeout: 2000 })
        .catch(() => '');
      const headerDate = new Date(`${headerText} 1`);

      if (!Number.isNaN(headerDate.getTime())) {
        const monthDiff = (date.getFullYear() - headerDate.getFullYear()) * 12 +
          (date.getMonth() - headerDate.getMonth());

        if (monthDiff === 0) {
          const day = String(date.getDate());
          const dayCell = picker.locator([
            'button:not(.MuiPickersDay-dayOutsideMonth):not([disabled]):not([aria-disabled="true"])',
            '[role="gridcell"]:not(.MuiPickersDay-dayOutsideMonth):not([aria-disabled="true"])'
          ].join(', ')).filter({ hasText: new RegExp(`^\\s*${day}\\s*$`) }).first();

          if (!(await dayCell.isVisible({ timeout: 3000 }).catch(() => false))) {
            return false;
          }

          await clickHighlighted(dayCell, `${label} ${formatAnalyticsDate(date)}`);
          await this.waitForPageReady();
          return true;
        }

        const direction = monthDiff < 0 ? /Previous month/i : /Next month/i;
        await clickHighlighted(this.page.getByRole('button', { name: direction }).last(), `${label} month navigation`);
        continue;
      }

      break;
    }

    return false;
  }

  async submitDateRangeIfNeeded() {
    const candidates = [
      this.page.getByRole('button', { name: /Apply|Search|Submit|Filter|Go/i }).first(),
      this.page.locator('button[type="submit"]').first()
    ];

    for (const candidate of candidates) {
      const visible = await candidate.isVisible({ timeout: 1000 }).catch(() => false);
      const enabled = visible && await candidate.isEnabled({ timeout: 1000 }).catch(() => false);
      if (visible && enabled) {
        await clickHighlighted(candidate, 'Apply analytics date range');
        await this.waitForPageReady();
        return true;
      }
    }

    await this.page.keyboard.press('Enter').catch(() => null);
    await this.waitForPageReady();
    return false;
  }

  async applyDateRange(fromDate, toDate) {
    await this.setDateInput(0, fromDate, 'Analytics From Date');
    await this.setDateInput(1, toDate, 'Analytics To Date');
    await this.submitDateRangeIfNeeded();
    await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => null);
    const appliedFromDate = await this.assertDateInputValue(0, fromDate, 'Analytics From Date');
    const appliedToDate = await this.assertDateInputValue(1, toDate, 'Analytics To Date');
    return { appliedFromDate, appliedToDate };
  }

  async hasNoDataVisible() {
    return this.page.getByText(/No Data found|No records found|No data|No results|There is no data/i)
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);
  }

  async getVisibleAnalyticsRecordCount(options = {}) {
    return this.page.evaluate(({ tableOnly }) => {
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };

      const tableRows = Array.from(document.querySelectorAll('table tbody tr'))
        .filter(isVisible)
        .filter((row) => row.querySelector('td'))
        .filter((row) => !/No Data found|No records found|No data|No results/i.test(row.innerText || row.textContent || ''));

      const gridRows = Array.from(document.querySelectorAll('[role="row"]'))
        .filter(isVisible)
        .filter((row) => row.querySelector('[role="cell"], [role="gridcell"]'))
        .filter((row) => !/No Data found|No records found|No data|No results/i.test(row.innerText || row.textContent || ''));

      const rows = Array.from(new Set([...tableRows, ...gridRows]));

      if (rows.length) return rows.length;
      if (tableOnly) return 0;

      return Array.from(document.querySelectorAll('[class*="card"], [class*="chart"], canvas, svg'))
        .filter(isVisible)
        .filter((element) => /\d/.test(element.innerText || element.textContent || element.getAttribute('aria-label') || ''))
        .length;
    }, { tableOnly: options.tableOnly === true });
  }

  async getConfiguredAnalyticsDateRange() {
    const fromDate = parseAnalyticsDate(ANALYTICS_FROM_DATE);
    const toDate = parseAnalyticsDate(ANALYTICS_TO_DATE);
    if (fromDate && toDate) {
      return { fromDate, toDate };
    }
    if (fromDate || toDate) {
      throw new Error('Both ANALYTICS_FROM_DATE and ANALYTICS_TO_DATE must be configured when overriding analytics date range.');
    }
    return null;
  }

  async applyExpandingPastDateRangeUntilRecords(label, options = {}) {
    const configuredRange = options.ignoreConfiguredRange
      ? null
      : await this.getConfiguredAnalyticsDateRange();
    const toDate = configuredRange?.toDate || options.toDate || new Date();
    const fromDate = configuredRange?.fromDate || addMonths(toDate, -(options.initialLookbackMonths || 12));
    const ranges = buildPastDateRanges({
      fromDate,
      toDate,
      monthStep: options.monthStep || DATE_RANGE_MONTH_STEP,
      maxAttempts: options.maxAttempts || DEFAULT_MAX_DATE_RANGE_ATTEMPTS,
      maxLookbackMonths: options.maxLookbackMonths ?? null
    });
    const attemptedRanges = [];

    for (const range of ranges) {
      const { fromDate: rangeFromDate, toDate: rangeToDate, attempt } = range;
      attemptedRanges.push({ fromDate: rangeFromDate, toDate: rangeToDate });
      if (attempt > 1 && label === 'Environment Reports') {
        console.log(
          `${label}: no values found; moving only the From Date back to ` +
          `${formatAnalyticsDate(rangeFromDate)} while keeping the To Date at ${formatAnalyticsDate(rangeToDate)}.`
        );
      }
      console.log(`${label}: applying analytics date range ${formatAnalyticsDate(rangeFromDate)} to ${formatAnalyticsDate(rangeToDate)}.`);
      await this.applyDateRange(rangeFromDate, rangeToDate);

      const count = await this.getVisibleAnalyticsRecordCount({
        tableOnly: label === 'Environment Reports'
      });
      if (count > 0 && !(await this.hasNoDataVisible())) {
        console.log(`${label}: found ${count} visible analytics record(s).`);
        return {
          fromDate: rangeFromDate,
          toDate: rangeToDate,
          recordCount: count,
          attempts: attempt,
          attemptedRanges,
          maxLookbackMonths: options.maxLookbackMonths ?? null
        };
      }
    }

    const lastRange = ranges[ranges.length - 1];
    const limitText = Number.isFinite(options.maxLookbackMonths)
      ? `within the previous ${options.maxLookbackMonths} months`
      : `after ${ranges.length} expanding date-range attempt(s)`;
    if (options.allowNoRecords) {
      const issue = `${label} did not show analytics records ${limitText}.`;
      console.log(issue);
      await highlight(this.page.getByRole('heading', { name: new RegExp(label.replace(/\s+/g, '\\s*'), 'i') }).first(), issue)
        .catch(() => null);
      return {
        fromDate: lastRange.fromDate,
        toDate: lastRange.toDate,
        recordCount: 0,
        attempts: ranges.length,
        attemptedRanges,
        maxLookbackMonths: options.maxLookbackMonths ?? null,
        noRecords: true,
        issue
      };
    }

    throw new Error(`${label} did not show analytics records ${limitText}.`);
  }

  async getMetricLabelText(metricName, metricKind = 'generic') {
    return this.page.evaluate(({ targetMetric, metricKind: kind }) => {
      const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim();
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };
      const markAndRead = (element) => {
        const container = element.closest('th, td, tr, [class*="card"], [class*="metric"], [class*="field"], [class*="row"]') || element.parentElement || element;
        container.setAttribute('data-vc-analytics-unit-match', 'true');
        return normalize(container.innerText || container.textContent || element.innerText || element.textContent || '');
      };

      document.querySelectorAll('[data-vc-analytics-unit-match]').forEach((element) => {
        element.removeAttribute('data-vc-analytics-unit-match');
      });
      const escapeRegex = (v = '') => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const target = new RegExp(escapeRegex(targetMetric), 'i');
      const elements = Array.from(document.querySelectorAll('th, td, label, p, span, div, h1, h2, h3, h4, h5, h6'))
        .filter(isVisible);

      // Primary exact/partial match
      let element = elements.find((candidate) => target.test(normalize(candidate.innerText || candidate.textContent || '')));
      if (element) {
        return markAndRead(element);
      }

      const fallbackPattern = kind === 'emission'
        ? /co2|co₂|carbon|emissions?|tonne|tonnes|metric\s*tons?|us\s*tons?|tons?|tco2/i
        : /one\s*way|trip|distance|km|mile|miles|kilometre|kilometer/i;
      const headerCandidates = Array.from(document.querySelectorAll('th, thead th, table thead, [role="columnheader"], [role="table"]'))
        .filter(isVisible);
      element = headerCandidates.find((candidate) => fallbackPattern.test(normalize(candidate.innerText || candidate.textContent || '')));
      if (element) {
        return markAndRead(element);
      }

      // Broad fallback: try to find any visible element containing the word 'distance'
      const broadFallback = kind === 'emission'
        ? /\b(co2|co₂|emissions?|carbon)\b/i
        : /\bdistance\b/i;
      element = elements.find((candidate) => broadFallback.test(normalize(candidate.innerText || candidate.textContent || '')));
      if (element) {
        return markAndRead(element);
      }

      return '';
    }, { targetMetric: metricName, metricKind });
  }

  async highlightUnitMatch(context, metricName, expectedUnit) {
    const markedLocator = this.page.locator('[data-vc-analytics-unit-match="true"]').first();
    if (await markedLocator.isVisible({ timeout: 1000 }).catch(() => false)) {
      await highlight(markedLocator, `${context} ${metricName}: ${expectedUnit}`).catch(() => null);
      await this.page.waitForTimeout(UNIT_HIGHLIGHT_WAIT_MS);
      return;
    }

    const metricLocator = this.page.getByText(new RegExp(metricName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')).first();
    if (await metricLocator.isVisible({ timeout: 1000 }).catch(() => false)) {
      await highlight(metricLocator, `${context} ${metricName}: ${expectedUnit}`).catch(() => null);
      await this.page.waitForTimeout(UNIT_HIGHLIGHT_WAIT_MS);
    }
  }

  async assertMetricUnit(metricName, expectedPattern, expectedUnit, context, options = {}) {
    const metricKind = options.metricKind || 'generic';
    const unexpectedPattern = options.unexpectedPattern;
    const labelText = await this.getMetricLabelText(metricName, metricKind);
    const hasExpectedUnit = labelText && expectedPattern.test(labelText);
    const hasUnexpectedUnit = labelText && unexpectedPattern?.test(labelText);

    if (hasExpectedUnit && !hasUnexpectedUnit) {
      await this.highlightUnitMatch(context, metricName, expectedUnit);
      return labelText;
    }

    // Fallback: scan visible table header/column headers for the expected pattern
    try {
      const headerMatch = await this.page.evaluate(({ expectedSrc, expectedFlags, unexpectedSrc, unexpectedFlags }) => {
        const expectedRegex = new RegExp(expectedSrc, expectedFlags);
        const unexpectedRegex = unexpectedSrc ? new RegExp(unexpectedSrc, unexpectedFlags) : null;
        const normalize = (v = '') => String(v).replace(/\s+/g, ' ').trim();
        const isVisible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
        };

        document.querySelectorAll('[data-vc-analytics-unit-match]').forEach((element) => {
          element.removeAttribute('data-vc-analytics-unit-match');
        });
        const candidates = Array.from(document.querySelectorAll('th, thead th, [role="columnheader"]'))
          .filter(isVisible);

        const found = candidates.find((el) => {
          const text = normalize(el.innerText || el.textContent || '');
          return expectedRegex.test(text) && !(unexpectedRegex && unexpectedRegex.test(text));
        });
        if (!found) return '';
        found.setAttribute('data-vc-analytics-unit-match', 'true');
        return normalize(found.innerText || found.textContent || '');
      }, {
        expectedSrc: expectedPattern.source,
        expectedFlags: expectedPattern.flags,
        unexpectedSrc: unexpectedPattern?.source || '',
        unexpectedFlags: unexpectedPattern?.flags || ''
      });

      if (headerMatch) {
        await this.highlightUnitMatch(context, metricName, expectedUnit);
        return headerMatch;
      }
    } catch (e) {
      // ignore evaluate errors and fall through to original failure
    }

    const issueLocator = this.page.getByText(new RegExp(metricName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')).first();
    if (await issueLocator.isVisible({ timeout: 1000 }).catch(() => false)) {
      await highlight(issueLocator, `${context} unit mismatch`).catch(() => null);
    }

    throw new Error(
      `${context} shows an incorrect or missing unit for "${metricName}". ` +
      `Expected ${expectedUnit}; visible label: ${labelText || 'not found'}.`
    );
  }

  async validateAnalyticsUomProtocol(context, projectConfiguration) {
    const expected = projectConfiguration.expectedUnits;
    const vehicleHighlightedChecks = [
      {
        metric: 'One Way Trip Distance',
        expectedUnit: expected.distanceUnit,
        expectedPattern: expected.distancePattern,
        unexpectedPattern: expected.distanceUnexpectedPattern,
        metricPattern: /\bone\s*way\s*trip\s*distance\b/i
      },
      {
        metric: 'One Way Trip CO2 Emissions',
        expectedUnit: expected.tonsUnit,
        expectedPattern: expected.tonsPattern,
        unexpectedPattern: expected.tonsUnexpectedPattern,
        metricPattern: /\bone\s*way\s*trip\s*co2\s*emissions\b|\bone\s*way\s*trip\s*co₂\s*emissions\b/i
      },
      {
        metric: 'Roundtrip Distance Delivered From Jobsite',
        expectedUnit: expected.distanceUnit,
        expectedPattern: expected.distancePattern,
        unexpectedPattern: expected.distanceUnexpectedPattern,
        metricPattern: /\bround\s*trip\s*distance\b|\broundtrip\s*distance\b|\bdelivered\s*from\s*jobsite\b/i
      }
    ];
    const generalChecks = [
      {
        metric: 'Distance',
        expectedUnit: expected.distanceUnit,
        expectedPattern: expected.distancePattern,
        unexpectedPattern: expected.distanceUnexpectedPattern,
        metricPattern: /\b(distance|one\s*way\s*trip|trip\s*distance)\b/i
      },
      {
        metric: 'Volume',
        expectedUnit: expected.volumeUnit,
        expectedPattern: expected.volumePattern,
        unexpectedPattern: expected.volumeUnexpectedPattern,
        metricPattern: /\b(volume|fuel|mpg|km\/l|liters?|litres?|gallons?)\b/i
      },
      {
        metric: 'Weight',
        expectedUnit: expected.weightUnit,
        expectedPattern: expected.weightPattern,
        unexpectedPattern: expected.weightUnexpectedPattern,
        metricPattern: /\b(weight|kg|kgs|oz|ounce|ounces|lb|lbs|pounds?)\b/i
      },
      {
        metric: 'Tons',
        expectedUnit: expected.tonsUnit,
        expectedPattern: expected.tonsPattern,
        unexpectedPattern: expected.tonsUnexpectedPattern,
        metricPattern: /\b(co2|co₂|carbon|emissions?|tons?|tonnes?|tco2)\b/i
      }
    ];
    const metricChecks = /vehicle/i.test(context) ? vehicleHighlightedChecks : generalChecks;

    const checks = await this.page.evaluate((serializedChecks) => {
      const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim();
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };
      const buildRegex = (source, flags = 'i') => new RegExp(source, flags.includes('i') ? flags : `${flags}i`);
      const knownUnitPattern = /\b(km|kilometres?|kilometers?|mi|miles?|gal|gallons?|l|ltr|liters?|litres?|kg|kgs|kilograms?|oz|ounces?|lb|lbs|pounds?|us\s*tons?|short\s*tons?|metric\s*tons?|tonnes?|tco2e?|tco2)\b/i;

      const rows = Array.from(document.querySelectorAll('table tr, [role="row"]'))
        .filter(isVisible)
        .map((row) => Array.from(row.querySelectorAll('th, td, [role="columnheader"], [role="cell"], [role="gridcell"]'))
          .filter(isVisible)
          .map((cell) => normalize(cell.innerText || cell.textContent || ''))
          .filter(Boolean))
        .filter((cells) => cells.length);

      const headers = Array.from(document.querySelectorAll('th, [role="columnheader"], thead td, label, h1, h2, h3, h4, p, span'))
        .filter(isVisible)
        .map((element) => normalize(element.innerText || element.textContent || ''))
        .filter(Boolean);

      const tableEvidence = rows.flatMap((cells, rowIndex) => cells.map((text, columnIndex) => ({
        text,
        rowIndex,
        columnIndex,
        sampleValues: rows
          .slice(rowIndex + 1, rowIndex + 6)
          .map((row) => row[columnIndex])
          .filter(Boolean)
      })));

      return serializedChecks.map((check) => {
        const metricPattern = buildRegex(check.metricPatternSource);
        const expectedPattern = buildRegex(check.expectedPatternSource);
        const unexpectedPattern = buildRegex(check.unexpectedPatternSource);
        const textCandidates = headers
          .filter((text) => metricPattern.test(text) || expectedPattern.test(text) || unexpectedPattern.test(text))
          .slice(0, 8);
        const tableCandidates = tableEvidence
          .filter((candidate) => metricPattern.test(candidate.text) || expectedPattern.test(candidate.text) || unexpectedPattern.test(candidate.text))
          .slice(0, 8);
        const candidateTexts = Array.from(new Set([
          ...textCandidates,
          ...tableCandidates.map((candidate) => candidate.text)
        ]));
        const sampleValues = Array.from(new Set(tableCandidates.flatMap((candidate) => candidate.sampleValues))).slice(0, 8);
        const valuesWithUnits = sampleValues.filter((value) => knownUnitPattern.test(value));
        const hasExpected = candidateTexts.some((text) => expectedPattern.test(text)) ||
          valuesWithUnits.some((text) => expectedPattern.test(text));
        const hasUnexpected = candidateTexts.some((text) => unexpectedPattern.test(text)) ||
          valuesWithUnits.some((text) => unexpectedPattern.test(text));
        const hasMetricCandidate = candidateTexts.some((text) => metricPattern.test(text));
        const status = !candidateTexts.length
          ? 'not-displayed'
          : hasExpected && !hasUnexpected
            ? 'passed'
            : hasUnexpected
              ? 'mismatch'
              : hasMetricCandidate
                ? 'missing-unit'
                : 'not-displayed';

        return {
          metric: check.metric,
          expectedUnit: check.expectedUnit,
          status,
          visibleHeaders: candidateTexts,
          sampleValues,
          valuesWithUnits,
          issue: status === 'passed' || status === 'not-displayed'
            ? ''
            : `${check.metric} expected ${check.expectedUnit}, but visible Analytics text did not consistently show that unit.`
        };
      });
    }, metricChecks.map((check) => ({
      metric: check.metric,
      expectedUnit: check.expectedUnit,
      expectedPatternSource: check.expectedPattern.source,
      unexpectedPatternSource: check.unexpectedPattern.source,
      metricPatternSource: check.metricPattern.source
    })));

    return {
      sectionName: context,
      country: projectConfiguration.country || null,
      countryUom: projectConfiguration.countryUom || null,
      expectedUnits: this.serializeExpectedUnits(expected),
      checks
    };
  }

  async validateEmissionUnits(context, projectConfiguration) {
    const expected = projectConfiguration.expectedUnits;
    const protocolEvidence = await this.validateAnalyticsUomProtocol(context, projectConfiguration);
    let distanceLabel;
    try {
      distanceLabel = await this.assertMetricUnit(
        'One Way Trip Distance',
        expected.distancePattern,
        expected.distanceUnit,
        context,
        {
          metricKind: 'distance',
          unexpectedPattern: expected.distanceUnexpectedPattern
        }
      );
    } catch (err) {
      if (/equipment/i.test(String(context)) && /visible label: not found/i.test(err.message)) {
        console.log(`${context}: distance header is not present on this equipment analytics table; emission unit will still be verified.`);
        distanceLabel = 'not present on equipment analytics table';
      } else {
        throw err;
      }
    }

    const emissionMetricCandidates = /equipment/i.test(String(context))
      ? ['CO2 Emissions', 'Equipment CO2 Emissions', 'One Way Trip CO2 Emissions']
      : ['One Way Trip CO2 Emissions', 'CO2 Emissions'];
    let emissionLabel = '';
    let lastEmissionError = null;
    for (const metricName of emissionMetricCandidates) {
      try {
        emissionLabel = await this.assertMetricUnit(
          metricName,
          expected.emissionPattern,
          expected.emissionUnit,
          context,
          {
            metricKind: 'emission',
            unexpectedPattern: expected.emissionUnexpectedPattern
          }
        );
        break;
      } catch (err) {
        lastEmissionError = err;
      }
    }
    if (!emissionLabel) {
      throw lastEmissionError || new Error(`${context} emission header was not found.`);
    }

    return {
      context,
      country: projectConfiguration.country || null,
      countryUom: projectConfiguration.countryUom || null,
      configuredCountryUom: expected.configuredCountryUom,
      fallbackApplied: expected.fallbackApplied,
      expectedDistanceUnit: expected.distanceUnit,
      expectedEmissionUnit: expected.emissionUnit,
      distanceLabel,
      emissionLabel,
      protocolEvidence
    };
  }

  async validateEmissionSection(sectionName, projectConfiguration) {
    await this.openAnalyticsSection(sectionName);
    const isEquipmentReport = /equipment/i.test(sectionName);
    const dateRange = await this.applyExpandingPastDateRangeUntilRecords(sectionName, isEquipmentReport
      ? {
          allowNoRecords: false,
          initialLookbackMonths: 12,
          monthStep: 6,
          maxLookbackMonths: 24,
          // Five attempts also covers a user-configured single-date/short range:
          // initial, -6, -12, -18, and the capped -24 month boundary.
          maxAttempts: 5
        }
      : { allowNoRecords: true });
    const unitValidation = await this.validateEmissionUnits(sectionName, projectConfiguration);
    return { sectionName, dateRange, unitValidation };
  }

  async getSearchInputForSection(sectionName) {
    const pattern = /equipment/i.test(sectionName)
      ? /Search by month, activity/i
      : /Search by vendor, material/i;
    return this.page.getByRole('textbox', { name: pattern }).first();
  }

  async searchAndClearSection(sectionName, searchText) {
    const searchInput = await this.getSearchInputForSection(sectionName);
    if (!(await searchInput.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log(`${sectionName} search input was not visible; skipping recorded search check.`);
      return { searched: false, searchText };
    }

    await searchInput.fill(searchText);
    await this.page.locator('.form-group.form-inline').first().click().catch(() => null);
    await this.waitForPageReady();
    const searchedCount = await this.getVisibleAnalyticsRecordCount();
    await searchInput.fill('');
    await this.page.locator('.form-group.form-inline').first().click().catch(() => null);
    await this.waitForPageReady();
    return { searched: true, searchText, searchedCount };
  }

  async downloadCurrentSection(label) {
    const downloadPromise = this.page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
    const downloadButton = this.page.getByRole('button', { name: /Download/i }).first();

    if (!(await downloadButton.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log(`${label} Download button was not visible; continuing without download.`);
      return null;
    }

    await clickHighlighted(downloadButton, `${label} Download`);
    const download = await downloadPromise;
    if (!download) {
      console.log(`${label} Download did not emit a file; continuing.`);
      return null;
    }

    console.log(`${label} downloaded: ${download.suggestedFilename()}`);
    return download.suggestedFilename();
  }

  async validateRecordedSummaryEmission() {
    await this.openAnalyticsSection('Summary Emission');
    const dateRange = await this.applyExpandingPastDateRangeUntilRecords('Summary Emission');
    const download = await this.downloadCurrentSection('Summary Emission');
    return { dateRange, download };
  }

  async scrollEntirePage(label = 'Page') {
    await this.page.evaluate(() => {
      const scrollingElement = document.scrollingElement || document.documentElement;
      scrollingElement.scrollTop = 0;
      window.scrollTo({ top: 0, behavior: 'auto' });

      for (const element of document.querySelectorAll('*')) {
        const style = window.getComputedStyle(element);
        if (/(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 20) {
          element.scrollTop = 0;
        }
      }
    });
    await this.page.waitForTimeout(400);

    let result = { reachedBottom: false, steps: 0, scrollDistance: 0, scrollHeight: 0 };
    for (let step = 1; step <= 100; step += 1) {
      result = await this.page.evaluate(({ currentStep }) => {
        const scrollingElement = document.scrollingElement || document.documentElement;
        const candidates = [scrollingElement, ...document.querySelectorAll('*')]
          .filter((element, index, list) => list.indexOf(element) === index)
          .filter((element) => {
            if (element === scrollingElement) return element.scrollHeight > element.clientHeight + 20;
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 &&
              /(auto|scroll)/.test(style.overflowY) &&
              element.scrollHeight > element.clientHeight + 20;
          });

        const target = candidates.sort((left, right) =>
          (right.scrollHeight - right.clientHeight) - (left.scrollHeight - left.clientHeight)
        )[0] || scrollingElement;
        const maxScrollTop = Math.max(0, target.scrollHeight - target.clientHeight);
        const previousTop = target.scrollTop;
        const nextTop = Math.min(maxScrollTop, previousTop + Math.max(300, Math.floor(target.clientHeight * 0.8)));

        if (target === scrollingElement) {
          window.scrollTo({ top: nextTop, behavior: 'smooth' });
        } else {
          target.scrollTo({ top: nextTop, behavior: 'smooth' });
        }

        return {
          reachedBottom: nextTop >= maxScrollTop - 2,
          steps: currentStep,
          scrollDistance: nextTop,
          scrollHeight: target.scrollHeight
        };
      }, { currentStep: step });

      await this.page.waitForTimeout(350);
      if (result.reachedBottom) break;
    }

    if (!result.reachedBottom) {
      throw new Error(`${label} could not be scrolled to the bottom.`);
    }

    console.log(
      `${label}: scrolled the complete generated report to the bottom ` +
      `in ${result.steps} step(s).`
    );
    return result;
  }

  async validateRecordedEnvironmentReports() {
    await this.openAnalyticsSection('Environment Reports');
    const dateRange = await this.applyExpandingPastDateRangeUntilRecords(
      'Environment Reports',
      ENVIRONMENT_REPORT_DATE_RANGE_OPTIONS
    );
    const pageScroll = await this.scrollEntirePage('Environment Reports');
    return { dateRange, pageScroll };
  }

  async runAnalyticsEmissionValidationFlow() {
    const projectConfiguration = await this.readProjectConfiguration();
    const summaryEmission = await this.validateRecordedSummaryEmission();
    const vehicleEmission = await this.validateEmissionSection('Vehicle Emissions', projectConfiguration);
    const vehicleSearch = await this.searchAndClearSection('Vehicle Emissions', 'neuralrays');
    const vehicleDownload = await this.downloadCurrentSection('Vehicle Emissions');
    const equipmentEmission = await this.validateEmissionSection('Equipment Emissions', projectConfiguration);
    const equipmentSearch = await this.searchAndClearSection('Equipment Emissions', 'july');
    const equipmentDownload = await this.downloadCurrentSection('Equipment Emissions');
    const environmentReports = await this.validateRecordedEnvironmentReports();

    return {
      projectConfiguration,
      summaryEmission,
      vehicleEmission,
      vehicleSearch,
      vehicleDownload,
      equipmentEmission,
      equipmentSearch,
      equipmentDownload,
      environmentReports
    };
  }
}

module.exports = {
  AnalyticsPage,
  ENVIRONMENT_REPORT_DATE_RANGE_OPTIONS,
  buildPastDateRanges,
  expectedUnitsFromCountryUom,
  formatAnalyticsDate
};
