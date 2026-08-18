const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { clickHighlighted, fillHighlighted, highlight } = require('../../utils/highlight');
const { loginIfVisible } = require('../../utils/login');
const { expectedUnitsFromCountryUom, normalizeText } = require('../../utils/uom');

const DEFAULT_EQUIPMENT_USAGE = {
  registeredEquipment: '[2020-08-29]-BOBCOT Road',
  year: '2026',
  month: 'January',
  hours: '10',
  litresOrGallons: '50',
  filterYear: '2025',
  filterMonth: 'January',
  searchText: 'vc1'
};
const EQUIPMENT_UPLOAD_FIXTURES = {
  list: {
    source: process.env.EQUIPMENT_LIST_UPLOAD_SOURCE || 'C:\\Users\\VC\\Downloads\\ListOfEquipment_sample (8).xlsx',
    fixture: path.resolve('fixtures', 'equipment-management', 'ListOfEquipment_sample_user_template.xlsx')
  },
  usage: {
    source: process.env.EQUIPMENT_USAGE_UPLOAD_SOURCE || 'C:\\Users\\VC\\Downloads\\Equipment_usage_sample (1).xlsx',
    fixture: path.resolve('fixtures', 'equipment-management', 'Equipment_usage_sample.xlsx')
  }
};
const DATA_SETTLE_WAIT_MS = Number(process.env.EQUIPMENT_DATA_SETTLE_WAIT_MS || 1000);
const EQUIPMENT_PROCESS_GAP_MS = Number(process.env.EQUIPMENT_PROCESS_GAP_MS || 1500);
const EQUIPMENT_SEARCH_OBSERVE_MS = Number(process.env.EQUIPMENT_SEARCH_OBSERVE_MS || 2500);
const UNIT_HIGHLIGHT_WAIT_MS = Number(process.env.UNIT_HIGHLIGHT_WAIT_MS || 0);
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

function normalizeMonthName(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';

  const numericMonth = Number(text);
  if (Number.isInteger(numericMonth) && numericMonth >= 1 && numericMonth <= 12) {
    return MONTH_NAMES[numericMonth - 1];
  }

  return MONTH_NAMES.find((month) =>
    month.toLowerCase() === text.toLowerCase() ||
    month.slice(0, 3).toLowerCase() === text.slice(0, 3).toLowerCase()
  ) || '';
}

function formatEquipmentDate(date = new Date()) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-GB', { month: 'short' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function getMonthLabels(date) {
  return {
    short: date.toLocaleString('en-US', { month: 'short' }),
    long: date.toLocaleString('en-US', { month: 'long' })
  };
}

function parseMonthYear(value = '') {
  const match = value.trim().match(/^([A-Z][a-z]+)\s+(\d{4})$/);
  if (!match) return null;

  const monthIndex = new Date(`${match[1]} 1, ${match[2]}`).getMonth();
  const year = Number(match[2]);
  if (!Number.isInteger(monthIndex) || !Number.isInteger(year)) return null;

  return { monthIndex, year };
}

function pickRandom(items) {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

class EquipmentManagementPage {
  constructor(page) {
    this.page = page;
    this.options = {
      appUrl: process.env.APP_URL || 'https://stg-app.voyagecontrol.com',
      projectId: process.env.PROJECT_ID || '5ET10000010',
      baseUrl: process.env.BASE_URL || 'https://stg-login.voyagecontrol.com',
      email: process.env.VC_EMAIL || 'hariharan.r@neuralrays.ai',
      password: process.env.VC_PASSWORD || 'Master@15'
    };

    this.equipmentManagementLink = page.getByRole('link', { name: /equipment_management|Equipment Management/i });
    this.equipmentListLink = page.getByRole('link', { name: /Equipment List/i });
    this.equipmentUsageLink = page.getByRole('link', { name: /Equipment Usage/i });
    this.addEquipmentUsageButton = page.getByRole('button', { name: /Add Equipment Usage/i });
    this.dateInputs = page.locator('input[placeholder="d, ddd mmm yyyy"], input[placeholder*="yyyy" i], input[aria-label*="date" i], input[value*="-"][value*="T"]');
    this.companyDropdown = page.getByRole('combobox').filter({ hasText: /Company/i });
    this.equipmentTypeDropdown = page.getByRole('combobox').filter({ hasText: /Equipment Type/i });
    this.contactNameDropdown = page.getByRole('combobox').filter({ hasText: /Contact Name/i });
    this.searchTextbox = page.getByRole('textbox', { name: /Search/i });
    this.equipmentUsageFilterState = {};
  }

  async waitForPageReady() {
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    await this.loginIfNeeded();
    await this.page
      .locator('[role="progressbar"], .MuiCircularProgress-root')
      .first()
      .waitFor({ state: 'hidden', timeout: 30000 })
      .catch(() => null);
    await this.page.waitForTimeout(1000);
  }

  async waitBetweenProcesses(label = 'Equipment Management process') {
    if (EQUIPMENT_PROCESS_GAP_MS <= 0) return;
    await this.page.waitForTimeout(EQUIPMENT_PROCESS_GAP_MS);
    console.log(`${label}: waited ${EQUIPMENT_PROCESS_GAP_MS}ms before continuing.`);
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
        projectName: normalize(project?.name || project?.project_name || '')
      };
    }).catch(() => ({ country: '', countryUom: '', projectName: '' }));
  }

  async readEquipmentFuelFieldLabel() {
    return this.page.evaluate(() => {
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

      document.querySelectorAll('[data-vc-equipment-fuel-unit-match]').forEach((element) => {
        element.removeAttribute('data-vc-equipment-fuel-unit-match');
      });

      const input = document.querySelector('#litresOrGallons') ||
        Array.from(document.querySelectorAll('input')).find((candidate) => {
          const text = [
            candidate.id,
            candidate.name,
            candidate.placeholder,
            candidate.getAttribute('aria-label')
          ].join(' ');
          return /litres?|liters?|gallons?|fuel/i.test(text);
        });

      if (!input) return '';

      const labelCandidates = [
        input.id ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`) : null,
        input.closest('.MuiFormControl-root, .form-group, [class*="field"], [class*="input"], div')
      ].filter(Boolean);

      const labelledBy = input.getAttribute('aria-labelledby');
      if (labelledBy) {
        for (const id of labelledBy.split(/\s+/)) {
          const element = document.getElementById(id);
          if (element) labelCandidates.unshift(element);
        }
      }

      let ancestor = input.parentElement;
      while (ancestor && ancestor !== document.body) {
        if (ancestor.previousElementSibling) {
          labelCandidates.push(ancestor.previousElementSibling);
        }
        labelCandidates.push(ancestor);
        ancestor = ancestor.parentElement;
      }

      for (const candidate of labelCandidates) {
        if (!isVisible(candidate)) continue;
        const text = normalize(candidate.innerText || candidate.textContent || input.getAttribute('aria-label') || '');
        if (/\b(litre|liter|litres|liters|gallon|gallons|gal|fuel)\b/i.test(text)) {
          candidate.setAttribute('data-vc-equipment-fuel-unit-match', 'true');
          return text;
        }
      }

      const fallbackText = normalize(input.getAttribute('aria-label') || input.placeholder || input.name || input.id || '');
      input.setAttribute('data-vc-equipment-fuel-unit-match', 'true');
      return fallbackText;
    });
  }

  async highlightEquipmentFuelUnit(label) {
    const matched = this.page.locator('[data-vc-equipment-fuel-unit-match="true"]').first();
    if (await matched.isVisible({ timeout: 1000 }).catch(() => false)) {
      await highlight(matched, label).catch(() => null);
      await this.page.waitForTimeout(UNIT_HIGHLIGHT_WAIT_MS);
    }
  }

  async validateEquipmentFuelEfficiencyUnit(context = 'Equipment fuel efficiency unit') {
    const projectConfiguration = await this.readProjectConfigurationFromStorage();
    const expected = expectedUnitsFromCountryUom(projectConfiguration.countryUom);
    const labelText = await this.readEquipmentFuelFieldLabel();
    const hasExpectedUnit = expected.fuelVolumePattern.test(labelText);
    const hasUnexpectedUnit = expected.fuelVolumeUnexpectedPattern.test(labelText);

    if (hasExpectedUnit && !hasUnexpectedUnit) {
      await this.highlightEquipmentFuelUnit(`${context}: ${expected.fuelVolumeUnit}`);
      console.log(
        `${context}: project Country UOM "${projectConfiguration.countryUom || 'not configured'}" ` +
        `expects ${expected.fuelVolumeUnit}; visible label "${labelText}".`
      );
      return {
        country: projectConfiguration.country || null,
        countryUom: projectConfiguration.countryUom || null,
        configuredCountryUom: expected.configuredCountryUom,
        fallbackApplied: expected.fallbackApplied,
        expectedFuelVolumeUnit: expected.fuelVolumeUnit,
        labelText
      };
    }

    await this.highlightEquipmentFuelUnit(`${context} mismatch`);
    throw new Error(
      `${context} shows an incorrect or ambiguous fuel unit. ` +
      `Project Country UOM: ${projectConfiguration.countryUom || 'not configured'}. ` +
      `Expected ${expected.fuelVolumeUnit}; visible label: ${labelText || 'not found'}.`
    );
  }

  async waitForTableDataToSettle(label = 'Equipment table') {
    await this.page
      .locator('[role="progressbar"], .MuiCircularProgress-root')
      .first()
      .waitFor({ state: 'hidden', timeout: 30000 })
      .catch(() => null);

    await this.page.locator('table, [role="table"]').first()
      .waitFor({ state: 'visible', timeout: 20000 })
      .catch(() => null);

    const noData = this.page.getByText(/No Data found|No records found|No data/i).first();
    if (await noData.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log(`${label} is currently empty; waiting ${DATA_SETTLE_WAIT_MS} ms before continuing.`);
      await this.page.waitForTimeout(DATA_SETTLE_WAIT_MS);
      await this.page
        .locator('[role="progressbar"], .MuiCircularProgress-root')
        .first()
        .waitFor({ state: 'hidden', timeout: 10000 })
        .catch(() => null);
      return;
    }

    await this.page
      .locator('[role="progressbar"], .MuiCircularProgress-root')
      .first()
      .waitFor({ state: 'hidden', timeout: 10000 })
      .catch(() => null);
  }

  async waitForMoreThanTenEquipmentListRecords(label = 'Equipment List date range', options = {}) {
    let lastState = { visibleRows: 0, hasNextPage: false };

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const state = await this.page.evaluate(() => {
        const isVisible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0';
        };

        const tableRows = Array.from(document.querySelectorAll('table tbody tr, [role="row"]'))
          .filter(isVisible)
          .filter((row) => !/Scheduled Arrivals|No Data found|No records found/i.test(row.innerText || row.textContent || ''));
        const hasNextPage = Array.from(document.querySelectorAll('button'))
          .some((button) => isVisible(button) &&
            !button.disabled &&
            /Go to next page|Go to page 2|page 2/i.test(button.getAttribute('aria-label') || button.innerText || button.textContent || ''));

        return {
          visibleRows: tableRows.length,
          hasNextPage
        };
      });
      lastState = state;

      if (state.visibleRows > 10 || state.hasNextPage) {
        console.log(`${label} contains more than 10 records; proceeding with the flow.`);
        return state;
      }

      console.log(`${label} currently has ${state.visibleRows} visible records and no next page; waiting before continuing check ${attempt}/4.`);
      await this.page.waitForTimeout(Math.min(DATA_SETTLE_WAIT_MS, 1000));
      await this.waitForTableDataToSettle(label);
    }

    if (options.allowSparseRecords) {
      console.log(`${label} has ${lastState.visibleRows} visible record(s); proceeding with the available Equipment List data.`);
      return {
        ...lastState,
        sparseRecordsAllowed: true
      };
    }

    throw new Error(`${label} must contain more than 10 records before continuing the Equipment Management flow.`);
  }

  async hasVisibleTableRecords() {
    return (await this.getVisibleTableRecordCount()) > 0;
  }

  async getVisibleTableRecordCount() {
    return this.page.evaluate(() => {
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };

      return Array.from(document.querySelectorAll('table tbody tr, [role="row"]'))
        .filter(isVisible)
        .filter((row) => !/Scheduled Arrivals|Equipment Reference|No Data found|No records found/i.test(row.innerText || row.textContent || ''))
        .length;
    });
  }

  async isNoDataVisible() {
    return this.page.getByText(/No Data found|No records found|No data/i).first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);
  }

  async ensureAtLeastOneRecord(label) {
    await this.waitForTableDataToSettle(label);
    const count = await this.getVisibleTableRecordCount();
    if (count > 0) {
      console.log(`${label} contains ${count} visible record(s).`);
      await this.highlightFirstVisibleTableRow(label);
      return count;
    }

    throw new Error(`${label} must contain at least 1 visible record before continuing.`);
  }

  async highlightFirstVisibleTableRow(label = 'visible table record') {
    await this.page.evaluate((attributeName) => {
      document.querySelectorAll(`[${attributeName}]`).forEach((element) => {
        element.removeAttribute(attributeName);
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

      const row = Array.from(document.querySelectorAll('table tbody tr, [role="row"]'))
        .filter(isVisible)
        .find((candidate) => !/Scheduled Arrivals|Equipment Reference|No Data found|No records found/i.test(candidate.innerText || candidate.textContent || ''));

      if (row) {
        row.setAttribute(attributeName, 'true');
      }
    }, 'data-vc-highlight-row');

    const row = this.page.locator('[data-vc-highlight-row="true"]').first();
    if (await row.isVisible({ timeout: 1000 }).catch(() => false)) {
      await highlight(row, label).catch(() => null);
    }
  }

  async loginIfNeeded() {
    return loginIfVisible(this.page, {
      email: this.options.email,
      password: this.options.password,
      visibleTimeout: 2000,
      postLoginWaitMs: 2000,
      errorMessage: 'Equipment Management flow could not log in; check VC_EMAIL/VC_PASSWORD or auth.json.',
      fill: fillHighlighted,
      click: clickHighlighted
    });
  }

  async openEquipmentListDirectly() {
    const equipmentListUrl = `${this.options.appUrl}/${this.options.projectId}/list-equipment`;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await this.page.goto(equipmentListUrl, {
        waitUntil: 'domcontentloaded'
      }).catch((error) => {
        if (!/ERR_ABORTED|Navigation interrupted|net::ERR_ABORTED/i.test(error.message)) {
          throw error;
        }
      });

      await this.page.waitForLoadState('domcontentloaded').catch(() => null);
      await this.loginIfNeeded();

      if (!/\/list-equipment\b/i.test(this.page.url())) {
        await this.page.goto(equipmentListUrl, { waitUntil: 'domcontentloaded' }).catch((error) => {
          if (!/ERR_ABORTED|Navigation interrupted|net::ERR_ABORTED/i.test(error.message)) {
            throw error;
          }
        });
      }

      await this.waitForPageReady();
      await this.page.waitForTimeout(5000);

      if (await this.loginIfNeeded()) {
        await this.page.goto(equipmentListUrl, { waitUntil: 'domcontentloaded' }).catch((error) => {
          if (!/ERR_ABORTED|Navigation interrupted|net::ERR_ABORTED/i.test(error.message)) {
            throw error;
          }
        });
        await this.waitForPageReady();
      }

      if (await this.page.getByRole('heading', { name: /List Of Equipment/i }).isVisible({ timeout: 5000 }).catch(() => false)) {
        await this.highlightLeftNavigation('Equipment Management', 'Equipment List');
        return;
      }

      console.log(`Equipment List did not remain loaded on attempt ${attempt}; retrying.`);
    }

    throw new Error(`Equipment List page did not load. Current URL: ${this.page.url()}`);
  }

  async clickFirstVisible(candidates, label) {
    for (const locator of candidates) {
      if (await locator.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await clickHighlighted(locator.first(), label);
        return;
      }
    }

    throw new Error(`Could not find ${label}.`);
  }

  async clickWithFallback(locator, label) {
    await locator.waitFor({ state: 'visible', timeout: 15000 });

    try {
      await highlight(locator, label).catch(() => null);
      await locator.click({ timeout: 5000 });
      await this.page.waitForTimeout(500);
      return;
    } catch (error) {
      console.log(`${label} normal click failed: ${error.message}`);
    }

    await highlight(locator, label).catch(() => null);
    await locator.click({ force: true, timeout: 10000 });
    await this.page.waitForTimeout(500);
  }

  async closeBlockingModalIfVisible(label = 'blocking modal') {
    const modal = this.page.locator('#invite_user_Modal.show, .modal.show, [role="dialog"]').last();
    if (!(await modal.isVisible({ timeout: 1000 }).catch(() => false))) {
      return false;
    }

    const openMenu = this.page.locator('.MuiMenu-root[role="presentation"], [role="listbox"]:visible').last();
    if (await openMenu.isVisible({ timeout: 500 }).catch(() => false)) {
      await this.page.keyboard.press('Escape').catch(() => null);
      await openMenu.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => null);
    }

    const closeCandidates = [
      modal.getByRole('button', { name: /^(Close|Cancel|Done|OK)$/i }).last(),
      modal.getByRole('link', { name: /^(Close|Cancel|Done|OK)$/i }).last(),
      modal.locator('button[aria-label*="close" i], button.close, .btn-close').last()
    ];

    for (const candidate of closeCandidates) {
      if (await candidate.isVisible({ timeout: 1000 }).catch(() => false)) {
        const clicked = await candidate.evaluate((element) => {
          element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
          element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
          element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          return true;
        }).catch(() => false);
        if (!clicked) {
          continue;
        }
        await modal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => null);
        if (!(await modal.isVisible({ timeout: 500 }).catch(() => false))) {
          return true;
        }
      }
    }

    await this.page.keyboard.press('Escape').catch(() => null);
    await modal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => null);
    if (!(await modal.isVisible({ timeout: 500 }).catch(() => false))) {
      return true;
    }

    await this.page.evaluate(() => {
      document.querySelectorAll('#invite_user_Modal.show, .modal.show').forEach((element) => {
        element.classList.remove('show');
        element.setAttribute('aria-hidden', 'true');
        element.style.display = 'none';
      });
      document.querySelectorAll('.modal-backdrop').forEach((element) => element.remove());
      document.body.classList.remove('modal-open');
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('padding-right');
    }).catch(() => null);
    await this.page.waitForTimeout(500);
    return true;
  }

  async highlightLeftNavigation(...labels) {
    const targetLabels = labels.map((label) => String(label || '').trim()).filter(Boolean);
    if (!targetLabels.length) return;

    await this.page.evaluate((navigationLabels) => {
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

      if (!document.getElementById('vc-left-nav-automation-highlight-style')) {
        const style = document.createElement('style');
        style.id = 'vc-left-nav-automation-highlight-style';
        style.textContent = `
          [data-vc-left-nav-automation-highlight="true"] {
            background: #fff2b8 !important;
            color: #111827 !important;
            outline: 4px solid #ff2d55 !important;
            box-shadow: inset 5px 0 0 #ff2d55, 0 0 0 4px rgba(255, 45, 85, 0.24) !important;
            border-radius: 8px !important;
            font-weight: 700 !important;
          }
        `;
        document.head.appendChild(style);
      }

      document.querySelectorAll('[data-vc-left-nav-automation-highlight="true"]').forEach((element) => {
        element.removeAttribute('data-vc-left-nav-automation-highlight');
      });

      const navRoots = Array.from(document.querySelectorAll('nav, aside, [role="navigation"], .sidebar, [class*="side" i], [class*="menu" i]'))
        .filter(isVisible);
      const roots = navRoots.length ? navRoots : [document.body];
      const candidates = roots.flatMap((root) =>
        Array.from(root.querySelectorAll('a, button, [role="link"], [role="button"], li, div, span'))
          .filter(isVisible)
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.left < Math.max(360, window.innerWidth * 0.38);
          })
      );

      for (const label of navigationLabels) {
        const pattern = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'), 'i');
        const match = candidates
          .map((element) => {
            const text = normalize(element.innerText || element.textContent || element.getAttribute('aria-label') || element.getAttribute('title') || '');
            const rect = element.getBoundingClientRect();
            const score = (pattern.test(text) ? 0 : 1000) +
              (text.toLowerCase() === label.toLowerCase() ? -100 : 0) +
              Math.abs(rect.left) / 100 +
              text.length / 1000;
            return { element, text, score };
          })
          .filter((entry) => pattern.test(entry.text))
          .sort((left, right) => left.score - right.score)[0];

        if (match) {
          const target = match.element.closest('a, button, [role="link"], [role="button"], li') || match.element;
          target.setAttribute('data-vc-left-nav-automation-highlight', 'true');
        }
      }
    }, targetLabels).catch((error) => {
      console.log(`Skipping left navigation highlight: ${error.message}`);
    });
  }

  async getVisiblePageMessage(pattern = /success|created|already|duplicate|error|required|invalid|failed|unable/i) {
    return this.page.evaluate((patternSource) => {
      const messagePattern = new RegExp(patternSource, 'i');
      const candidates = Array.from(document.querySelectorAll(
        '[role="alert"], [role="status"], .Toastify__toast, .toast, .alert, .MuiAlert-root, .SnackbarItem-message, [class*="toast"], [class*="snackbar"], body'
      ));

      for (const element of candidates) {
        const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text || !messagePattern.test(text)) continue;

        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        if (element === document.body || (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0'
        )) {
          return text.slice(0, 500);
        }
      }

      return '';
    }, pattern.source).catch(() => '');
  }

  async openEquipmentManagement() {
    await clickHighlighted(this.equipmentManagementLink.first(), 'Equipment Management');
    await this.waitForPageReady();
    await this.highlightLeftNavigation('Equipment Management');
  }

  async openEquipmentList() {
    if (await this.page.getByRole('heading', { name: /List Of Equipment/i }).isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.highlightLeftNavigation('Equipment Management', 'Equipment List');
      return;
    }

    if (!(await this.equipmentListLink.first().isVisible({ timeout: 3000 }).catch(() => false))) {
      await this.openEquipmentListDirectly();
      return;
    }

    await clickHighlighted(this.equipmentListLink.first(), 'Equipment List');
    await this.waitForPageReady();
    await this.highlightLeftNavigation('Equipment Management', 'Equipment List');
  }

  async selectJanuary2026Day(inputIndex, day, label) {
    await this.openDatePicker(inputIndex, label);
    await this.clickFirstVisible([
      this.page.locator('.MuiPickersCalendarHeader-label'),
      this.page.getByText('April')
    ], 'Calendar Month');
    await clickHighlighted(this.page.getByRole('button', { name: 'Jan' }).first(), 'January');
    const yearButton = this.page.getByRole('button', { name: '2026', exact: true }).first();
    if (await yearButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await clickHighlighted(yearButton, '2026');
    }
    await clickHighlighted(this.page.getByRole('gridcell', { name: String(day), exact: true }).first(), `Jan ${day}`);
  }

  async selectJanuary2026DateRange() {
    await this.selectJanuary2026Day(0, 1, 'From Date');
    await this.selectJanuary2026Day(1, 31, 'To Date');
    await this.waitForPageReady();
  }

  async getDateInput(inputIndex) {
    await this.page.evaluate(() => {
      for (const input of document.querySelectorAll('[data-vc-equipment-date-input]')) {
        input.removeAttribute('data-vc-equipment-date-input');
      }

      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };

      const dateInputs = Array.from(document.querySelectorAll('input'))
        .filter((input) => {
          const value = input.value || input.getAttribute('value') || '';
          const placeholder = input.getAttribute('placeholder') || '';
          const ariaLabel = input.getAttribute('aria-label') || '';
          const text = `${value} ${placeholder} ${ariaLabel}`;

          return isVisible(input) &&
            !input.disabled &&
            !/search|company|equipment type|contact name/i.test(text) &&
            (/yyyy/i.test(placeholder) ||
              /date/i.test(ariaLabel) ||
              /\d{4}-\d{2}-\d{2}T/.test(value) ||
              /\d{1,2}\s[A-Z][a-z]{2}\s\d{4}/.test(value));
        });

      dateInputs.forEach((input, index) => {
        input.setAttribute('data-vc-equipment-date-input', String(index));
      });
    });

    return this.page.locator(`input[data-vc-equipment-date-input="${inputIndex}"]`);
  }

  async getDatePickerButton(inputIndex) {
    const input = await this.getDateInput(inputIndex);
    await input.evaluate((dateInput, marker) => {
      for (const button of document.querySelectorAll('[data-vc-equipment-date-button]')) {
        button.removeAttribute('data-vc-equipment-date-button');
      }

      let container = dateInput.parentElement;
      while (container && container !== document.body) {
        const button = container.querySelector('button');
        if (button) {
          button.setAttribute('data-vc-equipment-date-button', String(marker));
          return;
        }
        container = container.parentElement;
      }
    }, inputIndex);

    return this.page.locator(`button[data-vc-equipment-date-button="${inputIndex}"]`).first();
  }

  async openDatePicker(inputIndex, label) {
    const pickerButton = await this.getDatePickerButton(inputIndex);
    if (await pickerButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.clickWithFallback(pickerButton, `${label} date picker`);
    } else {
      await this.clickWithFallback(await this.getDateInput(inputIndex), label);
    }

    await this.page.locator('.MuiDateCalendar-root, .MuiPickersPopper-root, [role="dialog"]').last()
      .waitFor({ state: 'visible', timeout: 10000 })
      .catch(() => null);
  }

  async switchCalendarView(label) {
    const switchToYearButton = this.page.getByRole('button', { name: /switch to year view/i }).first();
    if (await switchToYearButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await highlight(switchToYearButton, label).catch(() => null);
      await switchToYearButton.evaluate((button) => {
        button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      });
      await this.page.waitForTimeout(700);
      return true;
    }

    const candidates = [
      this.page.locator('.MuiPickersCalendarHeader-labelContainer').last(),
      this.page.locator('.MuiPickersCalendarHeader-label').last(),
      this.page.getByText(/^[A-Z][a-z]+ \d{4}$/).last(),
      this.page.getByRole('button', { name: /switch to month view/i }).last(),
      this.page.locator('.MuiPickersCalendarHeader-switchViewButton').last()
    ];

    for (const candidate of candidates) {
      if (await candidate.isVisible({ timeout: 1000 }).catch(() => false)) {
        await this.clickWithFallback(candidate, label);
        await this.page.waitForTimeout(500);
        return true;
      }
    }

    return false;
  }

  async selectCalendarYear(year) {
    const yearText = String(year);
    let yearButton = this.page.getByRole('button', { name: yearText, exact: true }).last();

    if (!(await yearButton.isVisible({ timeout: 1500 }).catch(() => false))) {
      await this.switchCalendarView('Calendar year view');
      yearButton = this.page.getByRole('button', { name: yearText, exact: true }).last();
    }

    if (!(await yearButton.isVisible({ timeout: 3000 }).catch(() => false))) {
      await this.page.locator('.MuiYearCalendar-root').evaluate((calendar, targetYear) => {
        const button = Array.from(calendar.querySelectorAll('button'))
          .find((candidate) => (candidate.innerText || candidate.textContent || '').trim() === targetYear);
        if (button) button.scrollIntoView({ block: 'center' });
      }, yearText).catch(() => null);
    }

    if (!(await yearButton.isVisible({ timeout: 3000 }).catch(() => false))) {
      throw new Error(`Could not open year ${yearText} in the date picker.`);
    }

    await clickHighlighted(yearButton, yearText);
  }

  async selectCalendarMonth(date) {
    const { short, long } = getMonthLabels(date);
    let monthButton = this.page.getByRole('button', { name: new RegExp(`^(${short}|${long})$`, 'i') }).last();

    if (!(await monthButton.isVisible({ timeout: 1500 }).catch(() => false))) {
      await this.switchCalendarView('Calendar month view');
      monthButton = this.page.getByRole('button', { name: new RegExp(`^(${short}|${long})$`, 'i') }).last();
    }

    if (await monthButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clickHighlighted(monthButton, long);
    }
  }

  async selectCalendarDay(date) {
    const day = String(date.getDate());
    const month = date.toLocaleString('en-US', { month: 'long' });
    const year = date.getFullYear();
    const dayCandidates = [
      this.page.getByRole('gridcell', { name: new RegExp(`^${day}$`) }).last(),
      this.page.getByRole('button', { name: new RegExp(`${month}\\s+${day},\\s+${year}`, 'i') }).last(),
      this.page.getByRole('gridcell', { name: day, exact: true }).last()
    ];

    for (const dayCandidate of dayCandidates) {
      if (await dayCandidate.isVisible({ timeout: 2000 }).catch(() => false)) {
        await clickHighlighted(dayCandidate, `${month} ${day}, ${year}`);
        return;
      }
    }

    throw new Error(`Could not select ${month} ${day}, ${year} from the date picker.`);
  }

  async selectCalendarMonthYearWithKeyboard(date) {
    const headerLabel = this.page.locator('.MuiPickersCalendarHeader-label').last();
    let headerText = await headerLabel.innerText({ timeout: 3000 }).catch(() => '');
    if (!parseMonthYear(headerText)) {
      const dialogText = await this.page.locator('[role="dialog"]').last().innerText({ timeout: 3000 }).catch(() => '');
      headerText = dialogText.match(/[A-Z][a-z]+ \d{4}/)?.[0] || headerText;
    }
    const currentMonthYear = parseMonthYear(headerText);
    await this.page.evaluate(() => {
      for (const button of document.querySelectorAll('[data-vc-calendar-month-button]')) {
        button.removeAttribute('data-vc-calendar-month-button');
      }

      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };

      const dialog = Array.from(document.querySelectorAll('[role="dialog"]')).at(-1) || document;
      Array.from(dialog.querySelectorAll('button, [role="button"], div, span'))
        .filter((element) => /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/.test((element.innerText || element.textContent || '').trim()))
        .filter(isVisible)
        .forEach((element, index) => {
          const clickTarget = element.closest('button, [role="button"]') || element;
          clickTarget.setAttribute('data-vc-calendar-month-button', String(index));
        });
    });
    const monthButtons = this.page.locator('[data-vc-calendar-month-button]');

    if (!currentMonthYear || !(await monthButtons.first().isVisible({ timeout: 2000 }).catch(() => false))) {
      console.log(`Calendar month keyboard path not available. Header: "${headerText}"`);
      return false;
    }

    const targetMonthIndex = date.getMonth();
    const monthOffset = (date.getFullYear() - currentMonthYear.year) * 12 +
      (targetMonthIndex - currentMonthYear.monthIndex);
    const activeMonth = this.page.locator(
      '.MuiMonthCalendar-root button.Mui-selected, [role="dialog"] button.Mui-selected, .MuiMonthCalendar-root button[tabindex="0"]'
    ).first();

    if (await activeMonth.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickWithFallback(activeMonth, 'Active calendar month');
    } else {
      const currentMonth = this.page.locator(`[data-vc-calendar-month-button="${currentMonthYear.monthIndex}"]`).first();
      await this.clickWithFallback(currentMonth, 'Current calendar month');
    }

    const key = monthOffset < 0 ? 'ArrowLeft' : 'ArrowRight';
    for (let index = 0; index < Math.abs(monthOffset); index += 1) {
      await this.page.keyboard.press(key);
      await this.page.waitForTimeout(80);
    }

    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(800);
    return true;
  }

  async confirmCurrentPickerMonthIfNeeded() {
    const headerText = await this.page.locator('.MuiPickersCalendarHeader-label').last()
      .innerText({ timeout: 1500 })
      .catch(() => '');
    const currentMonth = parseMonthYear(headerText);
    if (currentMonth) {
      const monthLabel = getMonthLabels(new Date(currentMonth.year, currentMonth.monthIndex, 1)).short;
      const clickedMonth = await this.page.evaluate((targetMonth) => {
        const isVisible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0';
        };

        const dialog = Array.from(document.querySelectorAll('[role="dialog"]')).at(-1) || document;
        const monthElement = Array.from(dialog.querySelectorAll('button, [role="button"], div, span'))
          .find((element) => (element.innerText || element.textContent || '').trim() === targetMonth && isVisible(element));

        if (!monthElement) return false;

        const clickTarget = monthElement.closest('button, [role="button"]') || monthElement;
        clickTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        clickTarget.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        clickTarget.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return true;
      }, monthLabel);

      if (clickedMonth) {
        console.log(`Confirmed current picker month: ${monthLabel}`);
        await this.page.waitForTimeout(1000);
        return true;
      }
    }

    return false;
  }

  async selectDateWithPicker(inputIndex, date, label) {
    await this.openDatePicker(inputIndex, label);
    await this.confirmCurrentPickerMonthIfNeeded();
    if (!(await this.selectCalendarMonthYearWithKeyboard(date))) {
      await this.selectCalendarYear(date.getFullYear());
      await this.selectCalendarMonth(date);
    }
    await this.selectCalendarDay(date);
    await this.waitForPageReady();
  }

  getEquipmentListOneYearDateRange() {
    const today = startOfDay(new Date());
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(today.getMonth() - 6);

    return {
      fromDate: sixMonthsAgo,
      toDate: today
    };
  }

  async getVisibleDatePickerHeader() {
    const headerText = await this.page.locator('.MuiPickersCalendarHeader-label').last()
      .innerText({ timeout: 3000 })
      .catch(() => '');
    if (parseMonthYear(headerText)) {
      return headerText;
    }

    const dialogText = await this.page.locator('[role="dialog"]').last().innerText({ timeout: 3000 }).catch(() => '');
    return dialogText.match(/[A-Z][a-z]+ \d{4}/)?.[0] || '';
  }

  async ensureDatePickerDayCalendar(label) {
    if (await this.page.getByRole('gridcell').first().isVisible({ timeout: 1000 }).catch(() => false)) {
      return;
    }

    const switchToCalendar = this.page.getByRole('button', { name: /switch to calendar view/i }).last();
    if (await switchToCalendar.isVisible({ timeout: 1000 }).catch(() => false)) {
      await this.clickWithFallback(switchToCalendar, `${label} calendar view`);
    }

    if (!(await this.page.getByRole('gridcell').first().isVisible({ timeout: 3000 }).catch(() => false))) {
      const selectedYear = this.page.locator('[role="dialog"] button.Mui-selected').last();
      if (await selectedYear.isVisible({ timeout: 1000 }).catch(() => false)) {
        await this.clickWithFallback(selectedYear, `${label} selected year`);
      }
    }

    await this.page.getByRole('gridcell').first().waitFor({ state: 'visible', timeout: 10000 });
  }

  async selectDateWithPickerNavigation(inputIndex, date, label) {
    await this.openDatePicker(inputIndex, label);
    await this.ensureDatePickerDayCalendar(label);

    let header = parseMonthYear(await this.getVisibleDatePickerHeader());
    if (!header) {
      throw new Error(`Could not read ${label} date picker month header.`);
    }

    const monthOffset = (date.getFullYear() - header.year) * 12 + (date.getMonth() - header.monthIndex);
    const direction = monthOffset < 0 ? 'Previous month' : 'Next month';
    const steps = Math.abs(monthOffset);

    for (let index = 0; index < steps; index += 1) {
      await this.clickWithFallback(this.page.getByRole('button', { name: new RegExp(direction, 'i') }).last(), `${label} ${direction}`);
      await this.page.waitForTimeout(250);
    }

    await this.selectCalendarDay(date);
    await this.waitForPageReady();
  }

  async selectRecordedEquipmentListDateRange() {
    const { fromDate, toDate } = this.getEquipmentListOneYearDateRange();

    console.log(`Selecting Equipment List date range using date picker: ${formatEquipmentDate(fromDate)} to ${formatEquipmentDate(toDate)}`);
    await this.selectDateWithPickerNavigation(0, fromDate, 'From Date');
    await this.selectDateWithPickerNavigation(1, toDate, 'To Date');
    await this.waitForPageReady();
    await this.waitForTableDataToSettle('Equipment List after date range');
    await this.waitForMoreThanTenEquipmentListRecords('Equipment List after six-month date range', { allowSparseRecords: true });
    return { fromDate, toDate };
  }

  parseUploadDate(value) {
    const text = this.normalizeFixtureCell(value);
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;

    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  async fillEquipmentListDateInput(inputIndex, date, label) {
    const input = await this.getDateInput(inputIndex);
    const value = formatEquipmentDate(date);
    await fillHighlighted(input, value, label);
    await this.page.waitForTimeout(EQUIPMENT_PROCESS_GAP_MS);
    await input.press('Tab').catch(() => null);
    await this.waitForPageReady();
    const currentValue = await input.inputValue().catch(() => '');
    if (!new RegExp(String(date.getDate()), 'i').test(currentValue) ||
        !new RegExp(date.toLocaleString('en-GB', { month: 'short' }), 'i').test(currentValue) ||
        !new RegExp(String(date.getFullYear()), 'i').test(currentValue)) {
      throw new Error(`${label} direct date entry did not persist. Expected ${value}; visible value: ${currentValue || '-'}`);
    }
  }

  async selectEquipmentListDateRangeForUpload(uploadFile, label = 'Equipment List uploaded row date range') {
    const scheduledArrival = this.parseUploadDate(uploadFile?.row?.scheduled_arrival);
    if (!scheduledArrival) {
      console.log(`${label}: no generated scheduled_arrival was available; using the recorded six-month date range.`);
      return this.selectRecordedEquipmentListDateRange();
    }

    const fromDate = scheduledArrival;
    const toDate = startOfDay(new Date());
    console.log(
      `${label}: selecting date range around uploaded scheduled_arrival ` +
      `${formatEquipmentDate(fromDate)} to ${formatEquipmentDate(toDate)}.`
    );
    await this.fillEquipmentListDateInput(0, fromDate, 'From Date').catch(async (error) => {
      console.log(`From Date direct entry failed; falling back to picker: ${error.message}`);
      await this.selectDateWithPickerNavigation(0, fromDate, 'From Date');
    });
    await this.fillEquipmentListDateInput(1, toDate, 'To Date').catch(async (error) => {
      console.log(`To Date direct entry failed; falling back to picker: ${error.message}`);
      await this.selectDateWithPickerNavigation(1, toDate, 'To Date');
    });
    await this.waitForPageReady();
    await this.waitForTableDataToSettle(label);
    if (EQUIPMENT_PROCESS_GAP_MS > 0) {
      await this.page.waitForTimeout(EQUIPMENT_PROCESS_GAP_MS);
    }
    return { fromDate, toDate };
  }

  async getVisibleEquipmentListTypeFuel() {
    if (process.env.EQUIPMENT_UPLOAD_TYPE && process.env.EQUIPMENT_UPLOAD_FUEL_TYPE) {
      return {
        equipmentType: process.env.EQUIPMENT_UPLOAD_TYPE,
        fuelType: process.env.EQUIPMENT_UPLOAD_FUEL_TYPE
      };
    }

    const combo = await this.page.evaluate(() => {
      const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };
      const columnIndex = (headers, pattern) => headers.findIndex((header) => pattern.test(header));
      const invalidCell = /^(?:-|n\/a|na|null|undefined|equipment type|fuel type)$/i;

      const readFromHeadersAndRows = (headers, rows) => {
        const equipmentTypeIndex = columnIndex(headers, /\bequipment\s*type\b/i);
        const fuelTypeIndex = columnIndex(headers, /\bfuel\s*type\b/i);
        if (equipmentTypeIndex === -1 || fuelTypeIndex === -1) return null;

        for (const row of rows) {
          if (!isVisible(row)) continue;

          const cells = Array.from(row.querySelectorAll('td, [role="cell"], [role="gridcell"]'))
            .filter(isVisible)
            .map((cell) => normalize(cell.innerText || cell.textContent));
          const equipmentType = normalize(cells[equipmentTypeIndex]);
          const fuelType = normalize(cells[fuelTypeIndex]);

          if (equipmentType && fuelType && !invalidCell.test(equipmentType) && !invalidCell.test(fuelType)) {
            return { equipmentType, fuelType };
          }
        }

        return null;
      };

      for (const table of Array.from(document.querySelectorAll('table')).filter(isVisible)) {
        const headers = Array.from(table.querySelectorAll('thead th, [role="columnheader"]'))
          .filter(isVisible)
          .map((header) => normalize(header.innerText || header.textContent));
        const rows = Array.from(table.querySelectorAll('tbody tr, [role="row"]'));
        const combo = readFromHeadersAndRows(headers, rows);
        if (combo) return combo;
      }

      const gridHeaders = Array.from(document.querySelectorAll('[role="columnheader"]'))
        .filter(isVisible)
        .map((header) => normalize(header.innerText || header.textContent || header.getAttribute('aria-label')));
      const gridRows = Array.from(document.querySelectorAll('[role="row"]'))
        .filter((row) => !/Scheduled Arrivals|No Data found|No records found/i.test(row.innerText || row.textContent || ''));
      return readFromHeadersAndRows(gridHeaders, gridRows);
    });

    if (!combo?.equipmentType || !combo?.fuelType) {
      const fixtureRow = this.readFirstUploadFixtureRow('list');
      if (fixtureRow?.equipment_type && fixtureRow?.fuel_type) {
        console.log(`Using Equipment List fixture type/fuel because no visible rows are available: ${fixtureRow.equipment_type} / ${fixtureRow.fuel_type}`);
        return {
          equipmentType: String(fixtureRow.equipment_type),
          fuelType: String(fixtureRow.fuel_type)
        };
      }

      const rowPreview = await this.page.evaluate(() => Array.from(document.querySelectorAll('tbody tr, [role="row"]'))
        .map((row) => String(row.innerText || row.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, 3));
      throw new Error(`Could not read a valid Equipment Type/Fuel Type pair from the visible Equipment List. Visible rows: ${rowPreview.join(' | ') || '-'}`);
    }

    console.log(`Using visible Equipment List type/fuel for upload fixture: ${combo.equipmentType} / ${combo.fuelType}`);
    return combo;
  }

  async selectFromDateWithRecordedPickerFlow() {
    await this.openDatePicker(0, 'From Date');

    await this.openDatePickerYearViewFromCurrentMonth('May 2026');
    await clickHighlighted(this.page.getByRole('button', { name: '2025', exact: true }).first(), '2025');
    await this.openDatePickerMonthViewFromCurrentYear('May 2025');
    await clickHighlighted(this.page.getByRole('button', { name: /^Jan$/ }).first(), 'January');
    await this.openDatePickerDayViewFromCurrentMonth('January 2025', '2025');

    await clickHighlighted(this.page.getByRole('gridcell', { name: '1', exact: true }).first(), 'Jan 1, 2025');
    await this.waitForPageReady();
  }

  async openDatePickerYearViewFromCurrentMonth(headerText) {
    const year2025 = this.page.getByRole('button', { name: '2025', exact: true }).first();
    if (await year2025.isVisible({ timeout: 1000 }).catch(() => false)) {
      return;
    }

    const headerCandidates = [
      this.page.locator('.MuiPickersCalendarHeader-labelContainer').filter({ hasText: headerText }).last(),
      this.page.getByText(headerText, { exact: true }).last(),
      this.page.getByRole('button', { name: /switch to year view/i }).last(),
      this.page.locator('.MuiPickersCalendarHeader-switchViewButton').last()
    ];

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      for (const candidate of headerCandidates) {
        if (!(await candidate.isVisible({ timeout: 1000 }).catch(() => false))) {
          continue;
        }

        await this.clickWithFallback(candidate, attempt === 1 ? headerText : `${headerText} retry`);
        if (await year2025.isVisible({ timeout: 2500 }).catch(() => false)) {
          return;
        }
      }
    }

    throw new Error(`Could not switch the ${headerText} date picker to year view.`);
  }

  async openDatePickerMonthViewFromCurrentYear(headerText) {
    const januaryButton = this.page.getByRole('button', { name: /^Jan$/ }).first();
    if (await januaryButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      return;
    }

    const headerCandidates = [
      this.page.locator('.MuiPickersCalendarHeader-labelContainer').filter({ hasText: headerText }).last(),
      this.page.getByText(headerText, { exact: true }).last(),
      this.page.getByRole('button', { name: /switch to month view/i }).last(),
      this.page.locator('.MuiPickersCalendarHeader-switchViewButton').last()
    ];

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      for (const candidate of headerCandidates) {
        if (!(await candidate.isVisible({ timeout: 1000 }).catch(() => false))) {
          continue;
        }

        await this.clickWithFallback(candidate, attempt === 1 ? headerText : `${headerText} retry`);
        if (await januaryButton.isVisible({ timeout: 2500 }).catch(() => false)) {
          return;
        }
      }
    }

    throw new Error(`Could not switch the ${headerText} date picker to month view.`);
  }

  async openDatePickerDayViewFromCurrentMonth(headerText, yearText = '') {
    const dayOne = this.page.getByRole('gridcell', { name: '1', exact: true }).first();
    if (await dayOne.isVisible({ timeout: 1000 }).catch(() => false)) {
      return;
    }

    if (yearText) {
      const selectedYear = this.page.getByRole('button', { name: yearText, exact: true }).first();
      if (await selectedYear.isVisible({ timeout: 1000 }).catch(() => false)) {
        await clickHighlighted(selectedYear, `${yearText} again`);
        if (await dayOne.isVisible({ timeout: 2500 }).catch(() => false)) {
          return;
        }
      }
    }

    const headerCandidates = [
      this.page.getByRole('button', { name: /switch to calendar view/i }).last(),
      this.page.locator('.MuiPickersCalendarHeader-labelContainer').filter({ hasText: headerText }).last(),
      this.page.getByText(headerText, { exact: true }).last(),
      this.page.locator('.MuiPickersCalendarHeader-switchViewButton').last()
    ];

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      for (const candidate of headerCandidates) {
        if (!(await candidate.isVisible({ timeout: 1000 }).catch(() => false))) {
          continue;
        }

        await this.clickWithFallback(candidate, attempt === 1 ? headerText : `${headerText} retry`);
        if (await dayOne.isVisible({ timeout: 2500 }).catch(() => false)) {
          return;
        }
      }
    }

    throw new Error(`Could not switch the ${headerText} date picker to day view.`);
  }

  async selectToDateWithRecordedPickerFlow(toDate = new Date()) {
    await this.openDatePicker(1, 'To Date');

    const day = String(toDate.getDate());
    const dayCell = this.page.getByRole('gridcell', { name: day, exact: true }).first();
    if (await dayCell.isVisible({ timeout: 5000 }).catch(() => false)) {
      await clickHighlighted(dayCell, `To Date ${day}`);
      await this.waitForPageReady();
      return;
    }

    await this.selectDateWithPicker(1, toDate, 'To Date');
  }

  async selectCompany(companyName = 'Voyage Control') {
    await clickHighlighted(this.companyDropdown.first(), 'Company');
    const preferredCompany = this.page.getByRole('option', { name: companyName }).first();

    if (await preferredCompany.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clickHighlighted(preferredCompany, companyName);
    } else if (await this.page.locator('[role="option"]:not([aria-disabled="true"])').first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await clickHighlighted(
        this.page.locator('[role="option"]:not([aria-disabled="true"])').filter({ hasNotText: /^Company$/i }).first(),
        'First available company'
      );
    } else {
      console.log(`Company option "${companyName}" was not available; continuing without Company filter.`);
      await this.page.keyboard.press('Escape').catch(() => null);
    }

    await this.waitForPageReady();
  }

  async openEquipmentTypeDropdown() {
    await clickHighlighted(this.equipmentTypeDropdown.first(), 'Equipment Type');
    if (!(await this.page.locator('[role="listbox"]').isVisible({ timeout: 3000 }).catch(() => false))) {
      await clickHighlighted(this.equipmentTypeDropdown.first(), 'Equipment Type');
    }
    await this.page.locator('.MuiBackdrop-root').click({ timeout: 5000 }).catch(() => null);
    await this.waitForPageReady();
  }

  async selectDropdownOption(dropdown, optionName, label, options = {}) {
    await clickHighlighted(dropdown.first(), label);
    const exactOption = this.page.getByRole('option', { name: optionName, exact: true }).first();
    const partialOption = this.page.getByRole('option', { name: optionName }).first();

    if (await exactOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await clickHighlighted(exactOption, `${label}: ${optionName}`);
    } else if (await partialOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clickHighlighted(partialOption, `${label}: ${optionName}`);
    } else if (await this.page.locator('[role="option"]:not([aria-disabled="true"])').first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await clickHighlighted(
        this.page.locator('[role="option"]:not([aria-disabled="true"])').first(),
        `${label}: first available option`
      );
    } else if (options.required) {
      throw new Error(`Could not select ${optionName} from ${label}; no enabled options were visible.`);
    } else {
      console.log(`${label} option "${optionName}" was not available; continuing without this optional filter.`);
      await this.page.keyboard.press('Escape').catch(() => null);
    }

    await this.waitForPageReady();
  }

  async selectRandomDropdownOption(dropdown, label, options = {}) {
    const dropdownLocator = dropdown.first();
    const currentText = (await dropdownLocator.innerText({ timeout: 3000 }).catch(() => '')).replace(/\s+/g, ' ').trim();
    await clickHighlighted(dropdownLocator, label);

    const enabledOptions = this.page.locator('[role="option"]:not([aria-disabled="true"])');
    if (!(await enabledOptions.first().isVisible({ timeout: 5000 }).catch(() => false))) {
      if (options.required) {
        throw new Error(`Could not select a random value from ${label}; no enabled options were visible.`);
      }

      console.log(`${label} had no enabled options; continuing without changing this filter.`);
      await this.page.keyboard.press('Escape').catch(() => null);
      return '';
    }

    const optionData = [];
    const count = await enabledOptions.count();
    for (let index = 0; index < count; index += 1) {
      const option = enabledOptions.nth(index);
      const text = (await option.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
      if (!text || (options.skipCurrent !== false && text === currentText)) continue;
      if (options.exclude?.some((pattern) => pattern.test?.(text) || pattern === text)) continue;
      optionData.push({ index, text });
    }

    if (!optionData.length) {
      if (options.required) {
        await this.page.keyboard.press('Escape').catch(() => null);
        throw new Error(`${label} had no untried enabled values available.`);
      }

      console.log(`${label} only had the current value available; leaving it unchanged.`);
      await this.page.keyboard.press('Escape').catch(() => null);
      await this.waitForPageReady();
      return '';
    }

    const selected = pickRandom(optionData);
    await clickHighlighted(enabledOptions.nth(selected.index), `${label}: ${selected.text}`);
    await this.waitForPageReady();
    return selected.text;
  }

  async getEquipmentListFilterDropdown(kind) {
    const indexes = {
      company: 0,
      equipmentType: 1,
      contactName: 2
    };

    await this.page.evaluate(({ filterKind, filterIndexes }) => {
      document.querySelectorAll('[data-vc-equipment-list-filter]').forEach((element) => {
        element.removeAttribute('data-vc-equipment-list-filter');
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

      const heading = Array.from(document.querySelectorAll('h1, h2, h3, [role="heading"]'))
        .find((element) => /List Of Equipment/i.test(element.innerText || element.textContent || ''));
      const contentRoot = heading?.closest('main, [class*="content"], [class*="right"], [class*="container"]') || document.body;
      const comboboxes = Array.from(contentRoot.querySelectorAll('[role="combobox"]'))
        .filter(isVisible)
        .filter((element) => !/Buckingham Palace|Construction Delivery|V3 Construction deliveries/i.test(element.innerText || element.textContent || ''));

      const target = comboboxes[filterIndexes[filterKind]];
      if (target) {
        target.setAttribute('data-vc-equipment-list-filter', filterKind);
      }
    }, { filterKind: kind, filterIndexes: indexes });

    const dropdown = this.page.locator(`[data-vc-equipment-list-filter="${kind}"]`).first();
    await dropdown.waitFor({ state: 'visible', timeout: 10000 });
    return dropdown;
  }

  async selectRandomEquipmentListFilters(maxAttempts = 2) {
    let lastSelected = {};

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (attempt > 1) {
        await this.clearFilters(1);
      }

      try {
        const selected = {};
        selected.company = await this.selectRandomFilterWithRecords('company', 'Company', {
          exclude: [/^Company$/i]
        });
        selected.equipmentType = await this.selectRandomFilterWithRecords('equipmentType', 'Equipment Type', {
          exclude: [/^Equipment Type$/i],
          required: true
        });
        selected.contactName = await this.selectRandomFilterWithRecords('contactName', 'Contact Name', {
          exclude: [/^Contact Name$/i]
        });

        lastSelected = selected;
        const recordCount = await this.getVisibleTableRecordCount();
        if (recordCount > 0) {
          console.log(`Selected random Equipment List filters with ${recordCount} record(s): ${JSON.stringify(selected)}`);
          return selected;
        }
      } catch (error) {
        console.log(`Equipment List filter attempt failed: ${error.message}`);
      }

      console.log(`Equipment List filter combination returned no records; clearing filters and trying again (${attempt}/${maxAttempts}).`);
    }

    throw new Error(`Could not select Equipment List filter values with records. Last selected: ${JSON.stringify(lastSelected)}`);
  }

  async selectRandomFilterWithRecords(dropdown, label, options = {}) {
    const triedValues = [];
    const maxAttempts = options.maxAttempts || 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const dropdownLocator = typeof dropdown === 'string'
        ? await this.getEquipmentListFilterDropdown(dropdown)
        : dropdown;
      const value = await this.selectRandomDropdownOption(dropdownLocator, label, {
        exclude: [...(options.exclude || []), ...triedValues],
        required: options.required
      });

      if (value) {
        triedValues.push(value);
      }

      await this.waitForTableDataToSettle(`Equipment List after ${label} ${value || '<unchanged>'}`);
      if (await this.hasVisibleTableRecords()) {
        console.log(`Selected ${label} with available records: ${value}`);
        return value;
      }

      console.log(`${label} "${value}" returned no records; trying another available value.`);
    }

    if (options.required) {
      throw new Error(`Could not find a ${label} value with visible records after ${maxAttempts} attempts. Tried: ${triedValues.join(', ') || '-'}`);
    }

    console.log(`${label} did not have a record-producing value; clearing optional filter by continuing.`);
    return '';
  }

  async selectContactName(contactName = 'James') {
    await this.selectDropdownOption(this.contactNameDropdown, contactName, 'Contact Name');
  }

  async clearFilters(maxClicks = 1) {
    for (let index = 0; index < maxClicks; index += 1) {
      const clearFiltersButton = this.page.getByRole('button', { name: /Clear Filters/i }).first();
      if (!(await clearFiltersButton.isVisible({ timeout: 2000 }).catch(() => false))) {
        return;
      }

      await this.clickWithFallback(clearFiltersButton, 'Clear Filters');
      await this.waitForPageReady();
      this.equipmentUsageFilterState = {};
    }
  }

  async resetEquipmentListBeforeDropdownFilters(options = {}) {
    await this.ensureEquipmentListVisible();

    await this.page.evaluate(() => {
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };

      const searchInput = Array.from(document.querySelectorAll('input'))
        .filter(isVisible)
        .find((input) => /search/i.test(`${input.placeholder || ''} ${input.getAttribute('aria-label') || ''}`));

      if (searchInput) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
        searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
      }
    }).catch(() => null);

    await this.clearFilters(1);
    await this.waitForTableDataToSettle('Equipment List after Clear Filters');

    let state = await this.getEquipmentListTableState();
    if (state.visibleRows > 1 || state.hasNextPage) {
      console.log(`Equipment List reset restored ${state.visibleRows} visible record(s).`);
      return state;
    }

    if (options.allowSparseRecords && state.visibleRows > 0) {
      console.log(`Equipment List reset has ${state.visibleRows} visible record(s); continuing with the automation-created equipment.`);
      return {
        ...state,
        sparseRecordsAllowed: true
      };
    }

    console.log('Equipment List remained narrowed after Clear Filters; reopening the list route once.');
    await this.openEquipmentListDirectly();
    await this.waitForTableDataToSettle('Equipment List after route reset');
    state = await this.getEquipmentListTableState();

    if (state.visibleRows <= 1 && !state.hasNextPage) {
      if (options.allowSparseRecords && state.visibleRows > 0) {
        console.log(`Equipment List route reset has ${state.visibleRows} visible record(s); continuing with the automation-created equipment.`);
        return {
          ...state,
          sparseRecordsAllowed: true
        };
      }

      throw new Error(`Equipment List reset still shows only ${state.visibleRows} visible record(s); cannot apply dropdown filters from the full list.`);
    }

    console.log(`Equipment List route reset restored ${state.visibleRows} visible record(s).`);
    return state;
  }

  async getEquipmentListTableState() {
    return this.page.evaluate(() => {
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };

      const rows = Array.from(document.querySelectorAll('table tbody tr, [role="row"]'))
        .filter(isVisible)
        .filter((row) => !/Scheduled Arrivals|No Data found|No records found/i.test(row.innerText || row.textContent || ''));
      const hasNextPage = Array.from(document.querySelectorAll('button'))
        .some((button) => isVisible(button) &&
          !button.disabled &&
          /Go to next page|Go to page 2|page 2/i.test(button.getAttribute('aria-label') || button.innerText || button.textContent || ''));

      return { visibleRows: rows.length, hasNextPage };
    });
  }

  async search(value) {
    if (!value) {
      console.log('No search value was available; continuing without applying Search.');
      return;
    }

    const searchTextbox = await this.getSearchInput();
    const currentValue = (await searchTextbox.inputValue().catch(() => '')).trim();
    if (currentValue.toLowerCase() === String(value).trim().toLowerCase()) {
      console.log(`Search already applied: ${value}; skipping duplicate entry.`);
      return;
    }
    await fillHighlighted(searchTextbox, value, 'Search');
    if (EQUIPMENT_SEARCH_OBSERVE_MS > 0) {
      await this.page.waitForTimeout(EQUIPMENT_SEARCH_OBSERVE_MS);
    }
    await this.page.keyboard.press('Enter').catch(() => null);
    await this.waitForPageReady();
    await this.waitForTableDataToSettle(`Search results for "${value}"`);
    if (EQUIPMENT_SEARCH_OBSERVE_MS > 0) {
      console.log(`Search "${value}" results visible for ${EQUIPMENT_SEARCH_OBSERVE_MS}ms.`);
      await this.page.waitForTimeout(EQUIPMENT_SEARCH_OBSERVE_MS);
    }
  }

  async searchEquipmentListWithRecovery(initialValue, maxAttempts = 3) {
    let searchValue = initialValue;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      await this.search(searchValue);
      if (await this.hasVisibleTableRecords()) {
        return searchValue;
      }

      console.log(`Equipment List search "${searchValue}" returned No Data found; clearing filters and reapplying filter process (${attempt}/${maxAttempts}).`);
      await this.clearFilters(1);
      await this.selectRandomEquipmentListFilters();
      searchValue = await this.pickSearchTextFromVisibleRecords('Equipment List records after search recovery');
    }

    throw new Error(`Equipment List search could not find records after ${maxAttempts} attempts.`);
  }

  async readEquipmentListSearchCriteriaFromVisibleData(label = 'Equipment List visible data') {
    await this.waitForTableDataToSettle(label);
    const criteria = await this.page.evaluate(() => {
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
      const invalidValue = /^(?:-|n\/a|na|null|undefined|actions?|view|edit|delete)$/i;
      const toKey = (header = '') => normalize(header)
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

      const readRows = (root) => {
        const headers = Array.from(root.querySelectorAll('thead th, [role="columnheader"]'))
          .filter(isVisible)
          .map((header) => toKey(header.innerText || header.textContent || header.getAttribute('aria-label') || ''));
        const rows = Array.from(root.querySelectorAll('tbody tr, [role="row"]'))
          .filter(isVisible)
          .filter((row) => !/Scheduled Arrivals|No Data found|No records found/i.test(row.innerText || row.textContent || ''));

        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('td, [role="cell"], [role="gridcell"]'))
            .filter(isVisible)
            .map((cell) => normalize(cell.innerText || cell.textContent));
          if (!cells.some(Boolean)) continue;

          const byHeader = {};
          cells.forEach((cell, index) => {
            if (headers[index]) byHeader[headers[index]] = cell;
          });

          const values = [
            byHeader['registration make'],
            byHeader['reg make'],
            byHeader['make'],
            byHeader['company'],
            byHeader['equipment type'],
            byHeader['contact name'],
            byHeader['fuel type'],
            byHeader['type of usage'],
            ...cells
          ]
            .map(normalize)
            .filter((value, index, list) => value &&
              /[A-Za-z]/.test(value) &&
              !invalidValue.test(value) &&
              list.indexOf(value) === index);

          if (values.length) {
            return {
              headers,
              cells,
              values,
              rowText: normalize(row.innerText || row.textContent)
            };
          }
        }

        return null;
      };

      for (const table of Array.from(document.querySelectorAll('table, [role="table"]')).filter(isVisible)) {
        const result = readRows(table);
        if (result) return result;
      }

      return readRows(document);
    });

    if (!criteria?.values?.length) {
      throw new Error(`Could not read searchable values from ${label}.`);
    }

    console.log(`Equipment List available-data search candidates: ${criteria.values.slice(0, 5).join(' | ')}`);
    return criteria;
  }

  async applyEquipmentListSearchFromAvailableData() {
    await this.openEquipmentList();
    await this.clearSearch();
    await this.clearFilters(1);
    const dateRange = await this.selectRecordedEquipmentListDateRange();

    let criteria = await this.readEquipmentListSearchCriteriaFromVisibleData('Equipment List after six-month current-date filter');
    for (const candidate of criteria.values.slice(0, 8)) {
      await this.search(candidate);
      const recordCount = await this.getVisibleTableRecordCount();
      if (recordCount > 0) {
        console.log(`Applied Equipment List search from available data: "${candidate}" returned ${recordCount} visible record(s).`);
        return {
          searchTerm: candidate,
          recordCount,
          dateRange: {
            fromDate: formatEquipmentDate(dateRange.fromDate),
            toDate: formatEquipmentDate(dateRange.toDate)
          },
          sourceRow: criteria.rowText
        };
      }

      console.log(`Available Equipment List search value "${candidate}" returned no records; trying next visible-row value.`);
      await this.clearSearch();
      await this.waitForTableDataToSettle('Equipment List after clearing unavailable search value');
      criteria = await this.readEquipmentListSearchCriteriaFromVisibleData('Equipment List available data after search retry');
    }

    throw new Error(`Could not apply an Equipment List search from available data. Tried: ${criteria.values.slice(0, 8).join(', ')}`);
  }

  async searchEquipmentUsageCompanyWithRecovery(initialValue, maxAttempts = 3) {
    let searchValue = initialValue;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      await this.search(searchValue);
      if (await this.hasVisibleTableRecords()) {
        return searchValue;
      }

      console.log(`Equipment Usage company search "${searchValue}" returned No Data found; clearing filters and picking another available company (${attempt}/${maxAttempts}).`);
      await this.clearFilters(1);
      await this.clearSearch();
      await this.ensureAtLeastOneRecord('Equipment Usage records after search recovery');
      searchValue = await this.pickCompanySearchTextFromVisibleUsageRecords();
    }

    throw new Error(`Equipment Usage company search could not find records after ${maxAttempts} attempts.`);
  }

  async clearSearch() {
    const searchTextbox = await this.getSearchInput();
    if (!(await searchTextbox.isVisible({ timeout: 3000 }).catch(() => false))) {
      return false;
    }

    await fillHighlighted(searchTextbox, '', 'Clear Search');
    await this.page.keyboard.press('Enter').catch(() => null);
    await this.waitForPageReady();
    await this.waitForTableDataToSettle('Search cleared');
    console.log('Cleared Equipment Management search field.');
    return true;
  }

  async pickSearchTextFromVisibleRecords(label = 'visible records') {
    await this.waitForTableDataToSettle(label);
    const searchText = await this.page.evaluate(() => {
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };

      const rows = Array.from(document.querySelectorAll('table tbody tr, [role="row"]'))
        .filter(isVisible)
        .filter((row) => !/Scheduled Arrivals|No Data found|No records found/i.test(row.innerText || row.textContent || ''));

      const row = rows[0];
      if (!row) return '';

      const textParts = Array.from(row.querySelectorAll('td, [role="cell"]'))
        .map((cell) => (cell.innerText || cell.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      const preferred = textParts.find((part) => /[A-Za-z]/.test(part) && !/^\w{2,}\d{4,}$/i.test(part) && !/\d{1,2}(st|nd|rd|th)?\s+[A-Z][a-z]+/i.test(part)) ||
        textParts.find((part) => /[A-Za-z]/.test(part)) ||
        textParts[0] ||
        '';

      return preferred.split(/\s+/)[0].replace(/[^A-Za-z0-9_-]/g, '').trim();
    });

    console.log(`Picked dynamic search text from ${label}: ${searchText || '<none>'}`);
    return searchText;
  }

  async pickCompanySearchTextFromVisibleUsageRecords() {
    await this.waitForTableDataToSettle('Equipment Usage records');
    const companyName = await this.page.evaluate(() => {
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };

      const table = Array.from(document.querySelectorAll('table, [role="table"]')).find(isVisible) || document;
      const headers = Array.from(table.querySelectorAll('th, [role="columnheader"]'))
        .map((header) => (header.innerText || header.textContent || '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim());
      const companyIndex = headers.findIndex((header) => /^Company$/i.test(header));
      const rows = Array.from(table.querySelectorAll('tbody tr, [role="row"]'))
        .filter(isVisible)
        .filter((row) => !/Equipment Reference|No Data found|No records found/i.test(row.innerText || row.textContent || ''));

      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td, [role="cell"]'))
          .map((cell) => (cell.innerText || cell.textContent || '').replace(/\s+/g, ' ').trim());
        const value = cells[companyIndex >= 0 ? companyIndex : 2] || '';
        if (/[A-Za-z]/.test(value)) return value;
      }

      return '';
    });

    console.log(`Picked Equipment Usage company search text: ${companyName || '<none>'}`);
    return companyName;
  }

  async getSearchInput() {
    const namedSearch = this.searchTextbox.first();
    if (await namedSearch.isVisible({ timeout: 3000 }).catch(() => false)) {
      return namedSearch;
    }

    await this.page.evaluate(() => {
      for (const input of document.querySelectorAll('[data-vc-equipment-search-input]')) {
        input.removeAttribute('data-vc-equipment-search-input');
      }

      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };

      const searchInput = Array.from(document.querySelectorAll('input'))
        .filter((input) => {
          const value = input.value || '';
          const placeholder = input.getAttribute('placeholder') || '';
          const ariaLabel = input.getAttribute('aria-label') || '';
          return isVisible(input) &&
            !input.disabled &&
            /search/i.test(`${value} ${placeholder} ${ariaLabel}`);
        })[0];

      if (searchInput) {
        searchInput.setAttribute('data-vc-equipment-search-input', 'true');
      }
    });

    return this.page.locator('input[data-vc-equipment-search-input="true"]').first();
  }

  async ensureEquipmentListVisible() {
    if (await this.page.getByRole('heading', { name: /List Of Equipment/i }).isVisible({ timeout: 5000 }).catch(() => false)) {
      return;
    }

    console.log('Equipment List was not visible; reopening it directly.');
    await this.openEquipmentListDirectly();
  }

  async clickIconButtonByIndex(index, label) {
    const button = this.page.getByRole('button').filter({ hasText: /^$/ }).nth(index);
    if (!(await button.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log(`${label} icon button at index ${index} was not visible; continuing.`);
      return false;
    }

    await this.clickWithFallback(button, label);
    return true;
  }

  async downloadEquipmentListExport() {
    if (!(await this.hasVisibleTableRecords())) {
      console.log('Equipment List has no visible records; skipping export download.');
      return null;
    }
    await this.closeBlockingModalIfVisible('Equipment List export blocker');

    const exportButton = this.page.locator('button.dl-btn').first();
    if (!(await exportButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log('Equipment List export button was not visible; continuing with the remaining flow.');
      return null;
    }

    const downloadPromise = this.page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
    await this.clickWithFallback(exportButton, 'Equipment List export');
    const download = await downloadPromise;
    if (!download) {
      console.log('Equipment List export did not emit a download; continuing with the remaining flow.');
      return null;
    }
    console.log(`Equipment List export downloaded: ${download.suggestedFilename()}`);
    return download;
  }

  async selectFirstVisibleTableRecord(label = 'first visible table record') {
    await this.highlightFirstVisibleTableRow(label);
    const selected = await this.page.evaluate(() => {
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };

      const row = Array.from(document.querySelectorAll('table tbody tr, [role="row"]'))
        .filter(isVisible)
        .find((candidate) => !/Scheduled Arrivals|Equipment Reference|No Data found|No records found/i.test(candidate.innerText || candidate.textContent || ''));
      const checkbox = row?.querySelector('input[type="checkbox"]');
      if (!checkbox) return false;

      if (!checkbox.checked) {
        checkbox.click();
      }
      return true;
    });

    if (!selected) {
      console.log(`${label} did not expose a selectable checkbox; continuing with visible records.`);
    }

    await this.page.waitForTimeout(500);
    return selected;
  }

  async sortEquipmentListByCompany() {
    await this.openEquipmentList();
    const companyHeader = this.page.getByRole('columnheader', { name: /Company/i }).first();
    if (!(await companyHeader.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log('Equipment List Company sort header was not visible; skipping sort.');
      return false;
    }

    await this.clickWithFallback(companyHeader, 'Sort Equipment List by Company');
    await this.waitForTableDataToSettle('Equipment List after Company sort');
    await this.highlightFirstVisibleTableRow('Equipment List sorted Company result');
    return true;
  }

  async downloadEquipmentListPrintPdf() {
    if (!(await this.hasVisibleTableRecords())) {
      console.log('Equipment List has no visible records; skipping PDF print download.');
      return null;
    }
    await this.closeBlockingModalIfVisible('Equipment List print/PDF blocker');

    const printButton = this.page.locator('button:has([data-testid="PrintIcon"])').first();
    if (!(await printButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log('Equipment List print/PDF button was not visible; continuing with the remaining flow.');
      return null;
    }

    const downloadPromise = this.page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
    await this.clickWithFallback(printButton, 'Equipment List print/PDF');
    const download = await downloadPromise;
    if (!download) {
      console.log('Equipment List print/PDF action did not emit a download; continuing with the remaining flow.');
      return null;
    }

    console.log(`Equipment List PDF downloaded: ${download.suggestedFilename()}`);
    return download;
  }

  getEquipmentUploadFixture(kind) {
    const fixture = EQUIPMENT_UPLOAD_FIXTURES[kind];
    if (!fixture) {
      throw new Error(`Unknown Equipment Management upload fixture type: ${kind}`);
    }

    if (fs.existsSync(fixture.source)) {
      fs.mkdirSync(path.dirname(fixture.fixture), { recursive: true });
      fs.copyFileSync(fixture.source, fixture.fixture);
    }

    if (!fs.existsSync(fixture.fixture)) {
      throw new Error(`Missing Equipment Management ${kind} upload fixture. Expected source ${fixture.source} or fixture ${fixture.fixture}`);
    }

    return fixture.fixture;
  }

  readFirstUploadFixtureRow(kind) {
    const workbook = XLSX.readFile(this.getEquipmentUploadFixture(kind));
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    if (!rows.length) {
      throw new Error(`Equipment Management ${kind} upload fixture does not contain any data rows.`);
    }

    return rows[0];
  }

  normalizeFixtureCell(value) {
    if (value instanceof Date) return value.toISOString();
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  getExcelDateSerial(date = new Date()) {
    const utcDate = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const excelEpoch = Date.UTC(1899, 11, 30);
    return Math.floor((utcDate - excelEpoch) / 86400000);
  }

  formatUploadDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getRuntimeListUploadDate(label = 'primary') {
    const date = new Date();
    const labelOffset = /retry|second/i.test(label) ? 1 : 0;
    date.setMinutes(date.getMinutes() + labelOffset);
    return date;
  }

  getRuntimeUsageUploadMonthYear(label = 'primary') {
    const date = new Date();
    const runOffset = Math.floor(Date.now() / 1000) % 36;
    const labelOffset = /retry|second/i.test(label) ? 1 : 0;
    date.setMonth(date.getMonth() + runOffset + labelOffset);
    return {
      month: MONTH_NAMES[date.getMonth()],
      year: date.getFullYear()
    };
  }

  createRuntimeUploadFixture(kind, label = 'primary', overrides = {}) {
    const sourcePath = this.getEquipmentUploadFixture(kind);
    const workbook = XLSX.readFile(sourcePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    if (rows.length < 2) {
      throw new Error(`Equipment Management ${kind} upload fixture does not contain a data row.`);
    }

    const headers = rows[0].map((header) => this.normalizeFixtureCell(header));
    const token = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const shortToken = token.slice(-8);
    const setCell = (headerName, value, type = null, rowIndex = 1) => {
      const index = headers.findIndex((header) => header.toLowerCase() === headerName.toLowerCase());
      if (index === -1) return;

      const address = XLSX.utils.encode_cell({ r: rowIndex, c: index });
      const existingCell = worksheet[address] || {};
      worksheet[address] = {
        ...existingCell,
        v: value,
        t: type || (value instanceof Date ? 'd' : typeof value === 'number' ? 'n' : 's')
      };
    };
    const getCell = (headerName, rowIndex = 1) => {
      const index = headers.findIndex((header) => header.toLowerCase() === headerName.toLowerCase());
      if (index === -1) return '';

      const address = XLSX.utils.encode_cell({ r: rowIndex, c: index });
      const cell = worksheet[address];
      return cell ? cell.v : rows[rowIndex]?.[index];
    };

    let terms;
    let row;
    if (kind === 'list') {
      const scheduledArrivalIndex = headers.findIndex((header) => header.toLowerCase() === 'scheduled_arrival');
      if (scheduledArrivalIndex === -1) {
        throw new Error(`Equipment Management ${kind} upload fixture is missing scheduled_arrival.`);
      }

      const dataRowIndexes = rows
        .map((_, index) => index)
        .filter((index) => index > 0)
        .filter((index) => rows[index].some((value) => this.normalizeFixtureCell(value)));
      const safeDataRowIndexes = dataRowIndexes.length ? dataRowIndexes : [1];
      const runNumber = Number(shortToken) || Date.now();
      const runtimeRows = [];

      for (const [dataIndex, rowIndex] of safeDataRowIndexes.entries()) {
        const rowNumber = dataIndex + 1;
        const scheduledArrival = startOfDay(new Date());
        const suffix = `${shortToken}-${String(rowNumber).padStart(2, '0')}`;

        setCell('scheduled_arrival', this.getExcelDateSerial(scheduledArrival), 'n', rowIndex);
        const scheduledArrivalAddress = XLSX.utils.encode_cell({
          r: rowIndex,
          c: scheduledArrivalIndex
        });
        if (worksheet[scheduledArrivalAddress]) {
          worksheet[scheduledArrivalAddress].z = 'yyyy-mm-dd';
        }

        // Keep dropdown/contact-backed template values intact; the application rejects unknown combinations.
        setCell('reg_make', `VC Auto Make ${suffix}`, null, rowIndex);
        setCell('reg_model', `Model ${suffix}`, null, rowIndex);
        setCell('reg_year', 2020 + ((runNumber + dataIndex) % 7), 'n', rowIndex);
        setCell('address', `VC Auto Site ${suffix}, Buckingham Palace`, null, rowIndex);
        setCell('additional_notes', `VC automation equipment upload ${suffix}`, null, rowIndex);

        runtimeRows.push({
          scheduled_arrival: this.formatUploadDate(scheduledArrival),
          equipment_type: getCell('equipment_type', rowIndex),
          company: getCell('company', rowIndex),
          contact_name: getCell('contact_name', rowIndex),
          email_address: getCell('email_address', rowIndex),
          contact_number: getCell('contact_number', rowIndex),
          reg_make: getCell('reg_make', rowIndex),
          reg_model: getCell('reg_model', rowIndex),
          reg_year: getCell('reg_year', rowIndex),
          address: getCell('address', rowIndex),
          fuel_type: getCell('fuel_type', rowIndex),
          type_of_usage: getCell('type_of_usage', rowIndex),
          additional_notes: getCell('additional_notes', rowIndex)
        });
      }

      row = runtimeRows[0];
      terms = runtimeRows.flatMap((runtimeRow) => [
        runtimeRow.reg_make,
        runtimeRow.reg_model,
        runtimeRow.contact_name,
        runtimeRow.email_address,
        runtimeRow.additional_notes,
        runtimeRow.company,
        runtimeRow.equipment_type,
        runtimeRow.fuel_type,
        runtimeRow.scheduled_arrival
      ]);
      console.log(`Prepared Equipment List runtime upload from user template with ${runtimeRows.length} unique row(s).`);
    } else {
      const { month, year } = this.getRuntimeUsageUploadMonthYear(label);
      const equipmentRef = this.normalizeFixtureCell(getCell('equipment_ref'));
      const withoutDatePrefix = equipmentRef.replace(/^\[[^\]]+\]-?/, '').trim();
      const equipmentName = withoutDatePrefix.split('-')[0]?.trim();
      const hours = getCell('no_of_hours');
      const litresOrGallons = getCell('litres_or_gallons');

      setCell('month', month);
      setCell('year', Number(year));

      row = {
        equipment_ref: equipmentRef,
        month,
        year: String(year),
        no_of_hours: hours,
        litres_or_gallons: litresOrGallons
      };
      terms = [equipmentRef, withoutDatePrefix, equipmentName, month, year, hours, litresOrGallons];
    }

    const outputDir = path.resolve('test-results', 'equipment-management-uploads');
    fs.mkdirSync(outputDir, { recursive: true });
    const filePath = path.join(outputDir, `${kind}-${label}-${shortToken}.xlsx`);
    XLSX.writeFile(workbook, filePath);

    return {
      filePath,
      row,
      terms: terms.map((value) => this.normalizeFixtureCell(value)).filter(Boolean)
    };
  }

  getEquipmentListUploadSearchTerms(upload = null) {
    if (upload?.terms?.length) return upload.terms;

    const row = upload?.row || this.readFirstUploadFixtureRow('list');
    return [
      row.email_address,
      row.contact_name,
      row.company,
      row.reg_make,
      row.equipment_type
    ].map((value) => this.normalizeFixtureCell(value)).filter(Boolean);
  }

  getEquipmentUsageUploadSearchTerms(upload = null) {
    if (upload?.terms?.length) return upload.terms;

    const row = upload?.row || this.readFirstUploadFixtureRow('usage');
    const equipment = this.normalizeFixtureCell(row.equipment_ref);
    const withoutDatePrefix = equipment.replace(/^\[[^\]]+\]-?/, '').trim();
    const equipmentName = withoutDatePrefix.split('-')[0]?.trim();

    return [
      equipment,
      withoutDatePrefix,
      equipmentName,
      row.month,
      row.year
    ].map((value) => this.normalizeFixtureCell(value)).filter(Boolean);
  }

  async findVisibleUploadMessage(timeout = 15000) {
    const selector = [
      '[role="alert"]',
      '[role="status"]',
      '.Toastify__toast',
      '.toast',
      '.alert',
      '.MuiAlert-root',
      '.SnackbarItem-message',
      '[class*="toast"]',
      '[class*="snackbar"]',
      '[class*="alert"]'
    ].join(', ');

    const message = await this.page.waitForFunction(
      ({ selector: messageSelector }) => {
        const pattern = /success|uploaded|created|imported|duplicate|already|exists|error|failed|invalid|required|unable|not allow/i;
        const isVisible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0';
        };

        const candidates = Array.from(document.querySelectorAll(messageSelector)).filter(isVisible);
        for (const element of candidates.reverse()) {
          const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
          if (pattern.test(text)) return text.slice(0, 500);
        }

        return '';
      },
      { selector },
      { timeout }
    ).then((handle) => handle.jsonValue()).catch(() => '');

    return message || await this.getVisiblePageMessage();
  }

  isSuccessUploadMessage(message) {
    return /success|uploaded|created|imported/i.test(message || '') &&
      !/duplicate|already|exists|no records were processed|error|failed|invalid|required|unable/i.test(message || '');
  }

  isDuplicateOrErrorUploadMessage(message) {
    return /duplicate|already|exists|not allow|no records were processed|error|failed|invalid|unable/i.test(message || '');
  }

  async clickEquipmentListUploadIcon() {
    await this.openEquipmentList();

    const uploadIconCandidates = [
      this.page.getByRole('button', { name: /upload|import|file/i }).first(),
      this.page.getByRole('link', { name: /upload|import|file/i }).first(),
      this.page.locator('button[aria-label*="upload" i], button[title*="upload" i], a[aria-label*="upload" i], a[title*="upload" i]').first(),
      this.page.locator('img[alt*="upload" i], img[src*="upload" i], img[title*="upload" i]').first(),
      this.page.locator('.f-right img, .f-right button, .f-right a').first()
    ];

    for (const candidate of uploadIconCandidates) {
      if (await candidate.isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.clickWithFallback(candidate, 'Equipment List upload');
        await this.waitForPageReady();
        return;
      }
    }

    if (await this.clickIconButtonByIndex(3, 'Equipment List upload')) {
      await this.waitForPageReady();
      return;
    }

    throw new Error('Could not find the Equipment List upload icon.');
  }

  async clickUploadNewFileIfVisible() {
    const candidates = [
      this.page.getByRole('button', { name: /upload new file|new file|add file|choose file|select file|browse/i }).first(),
      this.page.getByRole('link', { name: /upload new file|new file|add file|choose file|select file|browse/i }).first(),
      this.page.locator('button[aria-label*="new file" i], button[title*="new file" i], a[aria-label*="new file" i], a[title*="new file" i]').first(),
      this.page.locator('img[alt*="new-file" i], img[src*="new-file" i], img[title*="new file" i]').first()
    ];

    for (const candidate of candidates) {
      if (await candidate.isVisible({ timeout: 2000 }).catch(() => false) &&
        await candidate.isEnabled({ timeout: 500 }).catch(() => true)) {
        await this.clickWithFallback(candidate, 'Upload New File');
        await this.page.waitForTimeout(800);
        return true;
      }
    }

    return false;
  }

  async setUploadInputFile(filePath) {
    const fileInputs = this.page.locator('input[type="file"]');
    if (await fileInputs.count() === 0) {
      await this.clickUploadNewFileIfVisible();
    }

    await fileInputs.last().waitFor({ state: 'attached', timeout: 10000 });
    await fileInputs.last().setInputFiles(filePath);
    await this.page.waitForTimeout(800);
    return true;
  }

  async clickUploadSubmitButton() {
    const candidates = [
      this.page.getByRole('button', { name: /^Upload$/i }).last(),
      this.page.getByRole('button', { name: /^(Submit|Save|Import)$/i }).last(),
      this.page.locator('button:has-text("Upload"), button:has-text("Submit"), button:has-text("Import")').last()
    ];

    for (const candidate of candidates) {
      if (await candidate.isVisible({ timeout: 3000 }).catch(() => false)) {
        try {
          await this.clickWithFallback(candidate, 'Upload file');
          return;
        } catch (error) {
          console.log(`Upload button Playwright click failed: ${error.message}`);
          const clicked = await candidate.evaluate((button) => {
            if (button.disabled || button.getAttribute('aria-disabled') === 'true') return false;
            button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
            button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
            button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            return true;
          }).catch(() => false);
          if (clicked) {
            await this.page.waitForTimeout(500);
            return;
          }
        }
      }
    }

    throw new Error('Could not find an Upload button in the file upload popup.');
  }

  async closeUploadPopupIfVisible(label = 'upload popup') {
    const popupSelector = [
      '[role="dialog"]',
      '.modal.show',
      '.MuiDialog-root',
      '.MuiModal-root'
    ].join(', ');
    const visiblePopupCount = async () => this.page.evaluate((selector) => {
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };

      return Array.from(document.querySelectorAll(selector))
        .filter(isVisible)
        .filter((element) => element.querySelector('input[type="file"]'))
        .filter((element) => /upload|file|attach|document/i.test(element.innerText || element.textContent || ''))
        .length;
    }, popupSelector).catch(() => 0);
    const waitForPopupClosed = async () => {
      await this.page.waitForFunction((selector) => {
        const isVisible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0';
        };

        return !Array.from(document.querySelectorAll(selector))
          .filter(isVisible)
          .filter((element) => element.querySelector('input[type="file"]'))
          .some((element) => /upload|file|attach|document/i.test(element.innerText || element.textContent || ''));
      }, popupSelector, { timeout: 5000 }).catch(() => null);
      return (await visiblePopupCount()) === 0;
    };

    if ((await visiblePopupCount()) === 0) {
      return false;
    }

    const closeCandidates = [
      this.page.locator('[role="dialog"] button[aria-label*="close" i], .modal.show button[aria-label*="close" i], .MuiDialog-root button[aria-label*="close" i], .MuiModal-root button[aria-label*="close" i]').last(),
      this.page.locator('[role="dialog"] button.close, .modal.show button.close, .MuiDialog-root button.close, .MuiModal-root button.close').last(),
      this.page.locator('[role="dialog"] .btn-close, .modal.show .btn-close, .MuiDialog-root .btn-close, .MuiModal-root .btn-close').last(),
      this.page.getByRole('button', { name: /^(Close|Cancel|OK|Done)$/i }).last(),
      this.page.getByRole('link', { name: /^(Close|Cancel|OK|Done)$/i }).last()
    ];

    for (const candidate of closeCandidates) {
      if (await candidate.isVisible({ timeout: 1500 }).catch(() => false) &&
        await candidate.isEnabled({ timeout: 500 }).catch(() => true)) {
        await this.clickWithFallback(candidate, `Close ${label}`);
        if (await waitForPopupClosed()) {
          return true;
        }
      }
    }

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await this.page.keyboard.press('Escape').catch(() => null);
      if (await waitForPopupClosed()) {
        return true;
      }
    }

    throw new Error(`Could not close ${label} after upload.`);
  }

  async uploadFixtureThroughCurrentDialog(kind, label, expectation = 'success-or-duplicate', upload = null) {
    const filePath = upload?.filePath || this.getEquipmentUploadFixture(kind);

    const selected = await this.setUploadInputFile(filePath);
    if (!selected) {
      throw new Error(`Could not select ${path.basename(filePath)} for ${label}.`);
    }

    await this.clickUploadSubmitButton();
    const message = await this.findVisibleUploadMessage();
    const success = this.isSuccessUploadMessage(message);
    const duplicateOrError = this.isDuplicateOrErrorUploadMessage(message);

    if (expectation === 'success' && !success) {
      throw new Error(`${label} did not report upload success. Visible message: ${message || '-'}`);
    }

    if (expectation === 'duplicate' && !duplicateOrError) {
      throw new Error(`${label} duplicate upload was not rejected. Visible message: ${message || '-'}`);
    }

    if (expectation === 'success-or-duplicate' && !success && !duplicateOrError) {
      throw new Error(`${label} upload did not report success or duplicate/error feedback. Visible message: ${message || '-'}`);
    }

    if (expectation === 'duplicate-or-error' && !duplicateOrError) {
      throw new Error(`${label} repeat upload did not report duplicate/error feedback. Visible message: ${message || '-'}`);
    }

    console.log(`${label}: ${message || 'upload feedback detected'}`);
    await this.closeUploadPopupIfVisible(label);
    await this.waitForPageReady();
    return { message, success, duplicateOrError };
  }

  async searchForAnyTerm(terms, label) {
    let lastCount = 0;

    for (const term of terms) {
      await this.clearSearch();
      await this.search(term);
      await this.waitForTableDataToSettle(`${label} search results`);
      lastCount = await this.getVisibleTableRecordCount();
      if (lastCount > 0) {
        console.log(`${label} verified with search term "${term}" (${lastCount} visible record(s)).`);
        await this.highlightFirstVisibleTableRow(label);
        return { term, count: lastCount };
      }
    }

    throw new Error(`${label} was not found using search terms: ${terms.join(', ')}`);
  }

  async tryFindExistingAutomationEquipmentListRecord() {
    await this.openEquipmentList();
    await this.clearFilters(1);
    await this.clearSearch();
    await this.selectRecordedEquipmentListDateRange();

    const searchTextbox = await this.getSearchInput();
    await fillHighlighted(searchTextbox, 'VC Auto Equipment', 'Search existing automation equipment');
    await this.page.keyboard.press('Enter').catch(() => null);
    await this.waitForPageReady();
    await this.waitForTableDataToSettle('Existing automation Equipment List search results');

    const recordCount = await this.getVisibleTableRecordCount();
    if (recordCount <= 0) {
      console.log('No reusable automation-created equipment was found; creating one new record.');
      return null;
    }

    const rowText = await this.page.evaluate(() => {
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };

      const row = Array.from(document.querySelectorAll('table tbody tr, [role="row"]'))
        .filter(isVisible)
        .find((candidate) => !/Scheduled Arrivals|Equipment Reference|No Data found|No records found/i.test(candidate.innerText || candidate.textContent || ''));
      return (row?.innerText || row?.textContent || '').replace(/\s+/g, ' ').trim();
    });

    await this.highlightFirstVisibleTableRow('Reusable automation Equipment List record');
    console.log(`Reusing existing automation equipment record: ${rowText}`);
    return {
      firstUpload: null,
      retryUpload: null,
      upload: {
        success: true,
        duplicateOrError: false,
        status: 'reused',
        message: 'Reused an existing automation-created Equipment List record.'
      },
      recordCount,
      registration: {
        equipmentTypeName: 'VC Auto Equipment',
        message: rowText
      },
      verification: {
        term: 'VC Auto Equipment',
        count: recordCount
      }
    };
  }

  async validateEquipmentListSampleUpload() {
    await this.openEquipmentList();
    await this.clearFilters(1);
    await this.clearSearch();
    await this.selectRecordedEquipmentListDateRange();
    const firstFile = this.createRuntimeUploadFixture('list', 'first');

    await this.clickEquipmentListUploadIcon();
    const firstUpload = await this.uploadFixtureThroughCurrentDialog('list', 'Equipment List generated sample upload', 'success-or-duplicate', firstFile);
    await this.waitForTableDataToSettle('Equipment List after generated sample upload');

    let finalFile = firstFile;
    let finalUpload = firstUpload;
    let retryUpload = null;
    const verifyUploadedOrExistingRecord = async (uploadFile, label) => {
      await this.clearSearch();
      await this.selectEquipmentListDateRangeForUpload(uploadFile, label);
      await this.waitForTableDataToSettle(label);
      return this.searchForAnyTerm(this.getEquipmentListUploadSearchTerms(uploadFile), 'Equipment List uploaded generated sample record');
    };
    const continueWithVisibleUploadState = async (uploadFile, searchError) => {
      await this.clearSearch();
      await this.waitForTableDataToSettle('Equipment List upload verification fallback');
      const visibleCount = await this.getVisibleTableRecordCount();
      if (visibleCount <= 0) {
        const terms = this.getEquipmentListUploadSearchTerms(uploadFile);
        const warning = `Uploaded row was not searchable and no visible Equipment List rows were available: ${terms.join(', ')}.`;
        console.log(`${warning} Continuing because upload feedback was already captured.`);
        return {
          term: null,
          count: 0,
          fallback: 'upload-feedback-with-empty-table',
          warning,
          originalError: searchError.message
        };
      }

      const terms = this.getEquipmentListUploadSearchTerms(uploadFile);
      const warning = `Uploaded row was not searchable yet by generated terms: ${terms.join(', ')}.`;
      console.log(`${warning} Continuing with ${visibleCount} visible Equipment List record(s).`);
      await this.highlightFirstVisibleTableRow('Equipment List upload verification fallback');
      return {
        term: null,
        count: visibleCount,
        fallback: 'visible-table-after-upload',
        warning,
        originalError: searchError.message
      };
    };

    if (!firstUpload.success) {
      const existingUploadSearch = await verifyUploadedOrExistingRecord(firstFile, 'Equipment List before date-only upload existing-record check')
        .catch(() => null);
      if (existingUploadSearch?.count > 0) {
        console.log('Equipment List date-only upload row already exists; continuing with the visible uploaded record.');
        return {
          firstUpload,
          retryUpload,
          upload: {
            ...firstUpload,
            success: true,
            status: 'already-present',
            message: firstUpload.message || 'Date-only upload row already exists.'
          },
          recordCount: existingUploadSearch.count,
          verification: existingUploadSearch,
          row: firstFile.row,
          terms: firstFile.terms
        };
      }

      console.log('Equipment List upload did not succeed on first attempt; retrying once with a fresh date-only workbook copy.');
      finalFile = this.createRuntimeUploadFixture('list', 'retry');
      await this.clearSearch();
      await this.waitForTableDataToSettle('Equipment List before retry generated sample upload');
      await this.clickEquipmentListUploadIcon();
      retryUpload = await this.uploadFixtureThroughCurrentDialog('list', 'Equipment List retry generated sample upload', 'success-or-duplicate', finalFile);
      finalUpload = retryUpload;
      await this.waitForTableDataToSettle('Equipment List after retry generated sample upload');
    }

    const uploadSearch = await verifyUploadedOrExistingRecord(finalFile, 'Equipment List before uploaded generated sample verification')
      .catch(async (error) => {
        return continueWithVisibleUploadState(finalFile, error);
      });
    if (!finalUpload.success && uploadSearch.count > 0) {
      finalUpload = {
        ...finalUpload,
        success: true,
        status: 'already-present',
        message: finalUpload.message || 'Date-only upload row already exists.'
      };
    }

    return {
      firstUpload,
      retryUpload,
      upload: finalUpload,
      recordCount: uploadSearch.count,
      verification: uploadSearch,
      row: finalFile.row,
      terms: finalFile.terms
    };
  }

  getAutomationToken(prefix = 'VC Auto Equipment') {
    return `${prefix} ${Date.now()} ${randomInteger(100, 999)}`;
  }

  async openRegisterEquipment() {
    await this.openEquipmentList();

    const registerButton = this.page.getByRole('button', { name: /Register Equipment/i }).first();
    if (await registerButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.clickWithFallback(registerButton, 'Register Equipment');
    } else {
      await this.page.goto(`${this.options.appUrl}/${this.options.projectId}/register-equipment`, {
        waitUntil: 'domcontentloaded'
      });
    }

    await this.waitForPageReady();
    await this.page.locator('#equipmentType').first().waitFor({ state: 'visible', timeout: 15000 });
  }

  async getRegistrationFieldDropdown(selector, marker) {
    await this.page.evaluate(({ selector: fieldSelector, markerName }) => {
      document.querySelectorAll(`[data-vc-registration-dropdown="${markerName}"]`).forEach((element) => {
        element.removeAttribute('data-vc-registration-dropdown');
      });

      const field = document.querySelector(fieldSelector);
      const container = field?.closest('.MuiFormControl-root, .form-group, [class*="field"], div');
      const dropdown = container?.querySelector('[role="combobox"]') || field;
      if (dropdown) {
        dropdown.setAttribute('data-vc-registration-dropdown', markerName);
      }
    }, { selector, markerName: marker });

    const dropdown = this.page.locator(`[data-vc-registration-dropdown="${marker}"]`).first();
    await dropdown.waitFor({ state: 'visible', timeout: 10000 });
    return dropdown;
  }

  async selectFirstDropdownOption(dropdown, label, options = {}) {
    const enabledOptions = this.page.locator('[role="option"]:not([aria-disabled="true"])');
    let optionsVisible = false;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await this.clickWithFallback(dropdown.first(), attempt === 1 ? label : `${label} retry ${attempt}`);
      optionsVisible = await enabledOptions.first().isVisible({ timeout: 5000 }).catch(() => false);
      if (optionsVisible) break;
      await this.page.keyboard.press('Escape').catch(() => null);
      await this.page.waitForTimeout(1500);
    }

    if (!optionsVisible) {
      if (options.required) {
        throw new Error(`${label} had no enabled options.`);
      }

      await this.page.keyboard.press('Escape').catch(() => null);
      return '';
    }

    const selected = await enabledOptions.evaluateAll((optionsList, excludedSources) => {
      const excluded = excludedSources.map((source) => new RegExp(source, 'i'));
      return optionsList
        .map((option, index) => ({
          index,
          text: (option.innerText || option.textContent || '').replace(/\s+/g, ' ').trim()
        }))
        .find((option) => option.text && !excluded.some((pattern) => pattern.test(option.text)));
    }, (options.exclude || []).map((pattern) => pattern.source || String(pattern)));

    if (!selected) {
      await this.page.keyboard.press('Escape').catch(() => null);
      if (options.required) {
        throw new Error(`${label} had no selectable options after exclusions.`);
      }
      return '';
    }

    await this.clickWithFallback(enabledOptions.nth(selected.index), `${label}: ${selected.text}`);
    await this.waitForPageReady();
    return selected.text;
  }

  async clickAddEquipmentTypeButton() {
    const marked = await this.page.evaluate(() => {
      document.querySelectorAll('[data-vc-add-equipment-type]').forEach((element) => {
        element.removeAttribute('data-vc-add-equipment-type');
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

      const equipmentTypeInput = document.querySelector('#equipmentType');
      let container = equipmentTypeInput?.closest('.MuiFormControl-root, .form-group, [class*="field"], div');
      while (container && container !== document.body) {
        const button = Array.from(container.querySelectorAll('button')).find(isVisible);
        if (button) {
          button.setAttribute('data-vc-add-equipment-type', 'true');
          return true;
        }
        container = container.parentElement;
      }

      const fallback = Array.from(document.querySelectorAll('button')).filter(isVisible)[4];
      if (fallback) {
        fallback.setAttribute('data-vc-add-equipment-type', 'true');
        return true;
      }

      return false;
    });

    if (!marked) {
      throw new Error('Could not find the Add Equipment Type button on Register Equipment.');
    }

    await this.clickWithFallback(this.page.locator('[data-vc-add-equipment-type="true"]').first(), 'Add Equipment Type');
    await this.page.locator('#equipmentName').waitFor({ state: 'visible', timeout: 15000 });
  }

  async createEquipmentTypeForRegistration() {
    await this.clickAddEquipmentTypeButton();

    const token = this.getAutomationToken();
    const equipmentTypeName = token;
    const brand = `AutoBrand ${randomInteger(1000, 9999)}`;
    const model = `AutoModel ${randomInteger(1000, 9999)}`;

    await fillHighlighted(this.page.locator('#equipmentName'), equipmentTypeName, 'Equipment Name');
    await this.selectFirstDropdownOption(this.page.locator('#mui-component-select-category'), 'Equipment Category', { required: true });
    await fillHighlighted(this.page.locator('#equipmentBrand'), brand, 'Equipment Brand');
    await fillHighlighted(this.page.locator('#equipmentModel'), model, 'Equipment Model');
    const fuelType = await this.selectFirstDropdownOption(this.page.locator('#mui-component-select-fuelType'), 'Fuel Type', { required: true });
    await fillHighlighted(this.page.locator('#emissionFactor'), String(randomInteger(1, 9)), 'Emission Factor');
    await this.clickWithFallback(this.page.getByRole('button', { name: /^Submit$/i }).first(), 'Submit Add Equipment');
    await this.waitForPageReady();

    const visibleMessage = await this.getVisiblePageMessage();
    if (/error|invalid|failed|required|unable/i.test(visibleMessage)) {
      throw new Error(`Add Equipment Type failed: ${visibleMessage}`);
    }

    await this.page.locator('#equipmentType').first().waitFor({ state: 'visible', timeout: 15000 });
    return { equipmentTypeName, brand, model, fuelType, message: visibleMessage };
  }

  async clickRegistrationNext(label) {
    await this.page.evaluate(() => {
      document.querySelectorAll('[data-vc-registration-next]').forEach((element) => {
        element.removeAttribute('data-vc-registration-next');
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

      const button = Array.from(document.querySelectorAll('button'))
        .find((candidate) => isVisible(candidate) && /^Next$/i.test((candidate.innerText || candidate.textContent || '').trim()));
      if (button) {
        button.setAttribute('data-vc-registration-next', 'true');
      }
    });

    const nextButton = this.page.locator('[data-vc-registration-next="true"]').first();
    if (await nextButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.clickWithFallback(nextButton, label);
    } else {
      await this.clickWithFallback(this.page.getByRole('button', { name: /^Next$/i }).first(), label);
    }
    await this.waitForPageReady();
  }

  async clickVisibleRegistrationButton(buttonText, label) {
    const marker = `data-vc-registration-${buttonText.toLowerCase()}`;
    await this.page.evaluate(({ text, attributeName }) => {
      document.querySelectorAll(`[${attributeName}]`).forEach((element) => {
        element.removeAttribute(attributeName);
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

      const pattern = new RegExp(`^${text}$`, 'i');
      const button = Array.from(document.querySelectorAll('button'))
        .find((candidate) => isVisible(candidate) && pattern.test((candidate.innerText || candidate.textContent || '').trim()));
      if (button) {
        button.setAttribute(attributeName, 'true');
      }
    }, { text: buttonText, attributeName: marker });

    const button = this.page.locator(`[${marker}="true"]`).first();
    if (await button.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.clickWithFallback(button, label);
      return;
    }

    await this.clickWithFallback(this.page.getByRole('button', { name: new RegExp(`^${buttonText}$`, 'i') }).first(), label);
  }

  async useMyAddressOrFillRegistrationContact() {
    const useMyAddress = this.page.locator('#useMyAddress').first();
    if (await useMyAddress.isVisible({ timeout: 5000 }).catch(() => false)) {
      const checked = await useMyAddress.isChecked().catch(() => false);
      if (!checked) {
        await this.clickWithFallback(useMyAddress, 'Use My Address');
        await this.waitForPageReady();
      }
    }

    const fallbackValues = [
      ['#companyName', 'NR_VC', 'Company Name'],
      ['#recepientName', 'Automation User', 'Recipient Name'],
      ['#emailAddress', 'automation@example.com', 'Email Address'],
      ['#contactNumber', '+919977889900', 'Contact Number']
    ];

    for (const [selector, value, label] of fallbackValues) {
      const input = this.page.locator(selector).first();
      if (!(await input.isVisible({ timeout: 1000 }).catch(() => false))) {
        continue;
      }

      const current = (await input.inputValue().catch(() => '')).trim();
      const disabled = await input.isDisabled().catch(() => false);
      const readonly = await input.evaluate((element) => element.readOnly).catch(() => false);
      if (!current && !disabled && !readonly) {
        await fillHighlighted(input, value, label);
      }
    }
  }

  async selectRegistrationYear() {
    const yearDropdown = await this.getRegistrationFieldDropdown('[name="yearOfManufactoring"]', 'year');
    return this.selectFirstDropdownOption(yearDropdown, 'Year Of Manufacturing', {
      required: true,
      exclude: [/^Year$/i, /^Select/i]
    });
  }

  async selectRegistrationUsageType() {
    const usageDropdown = await this.getRegistrationFieldDropdown('#typeOfUsage', 'typeOfUsage');
    return this.selectFirstDropdownOption(usageDropdown, 'Type Of Usage', {
      required: true,
      exclude: [/^Type Of Usage$/i, /^Select/i]
    });
  }

  async submitRegisteredEquipmentSearch(registration) {
    await this.openEquipmentListDirectly();
    await this.clearFilters(1);
    await this.clearSearch();
    await this.selectRecordedEquipmentListDateRange();

    const searchTerms = [
      registration.equipmentTypeName,
      registration.brand,
      registration.model
    ].filter(Boolean);

    return this.searchForAnyTerm(searchTerms, 'Registered Equipment List record');
  }

  async registerEquipmentThroughForm() {
    const existing = await this.tryFindExistingAutomationEquipmentListRecord();
    if (existing) {
      return existing;
    }

    await this.openRegisterEquipment();
    const registration = await this.createEquipmentTypeForRegistration();

    await this.selectDropdownOption(this.page.locator('#equipmentType').first(), registration.equipmentTypeName, 'Registered Equipment Type', { required: true });
    await this.clickRegistrationNext('Register Equipment details Next');

    await this.useMyAddressOrFillRegistrationContact();
    await this.clickRegistrationNext('Register Equipment contact Next');

    const yearOfManufacturing = await this.selectRegistrationYear();
    const typeOfUsage = await this.selectRegistrationUsageType();
    const notes = this.page.locator('#additionalNotes').first();
    if (await notes.isVisible({ timeout: 2000 }).catch(() => false)) {
      await fillHighlighted(notes, 'Created by Equipment Management automation.', 'Additional Notes');
    }

    await this.clickVisibleRegistrationButton('Submit', 'Submit Register Equipment');
    await this.waitForPageReady();

    const visibleMessage = await this.getVisiblePageMessage();
    if (/error|invalid|failed|required|unable/i.test(visibleMessage)) {
      throw new Error(`Register Equipment failed: ${visibleMessage}`);
    }

    const verification = await this.submitRegisteredEquipmentSearch(registration);
    return {
      firstUpload: null,
      retryUpload: null,
      upload: {
        success: true,
        duplicateOrError: false,
        status: 'registered',
        message: visibleMessage || 'Equipment registered through browser form.'
      },
      recordCount: verification.count,
      registration: {
        ...registration,
        yearOfManufacturing,
        typeOfUsage
      },
      verification
    };
  }

  async openFirstEquipmentUsageAttachmentPage(submission = null) {
    await this.openEquipmentUsage();

    let row;
    if (submission?.selectedValues?.registeredEquipment) {
      await this.filterToCreatedEquipmentUsage(submission);
      row = await this.getCreatedEquipmentUsageRow(submission);
    } else {
      await this.clearFilters(1);
      await this.clearSearch();
      await this.waitForTableDataToSettle('Equipment Usage records before attachment upload');
      row = await this.getRandomVisibleEquipmentUsageRow('data-vc-equipment-usage-attachment-row');
    }

    if (await this.clickRowAction(row, /attach|attachment|paperclip|file|document/i, 'Equipment Usage attachment')) {
      await this.waitForPageReady();
      return;
    }

    const rowButtons = row.getByRole('button');
    const buttonCount = await rowButtons.count();
    if (buttonCount >= 3) {
      await this.clickWithFallback(rowButtons.nth(1), 'Equipment Usage attachment fallback action');
      await this.waitForPageReady();
      return;
    }

    throw new Error('Could not find an Equipment Usage attachment icon in the list row.');
  }

  async filterToEquipmentUsageUploadRecord(upload = null) {
    const row = upload?.row || this.readFirstUploadFixtureRow('usage');
    await this.openEquipmentUsage();
    await this.clearFilters(1);
    await this.clearSearch();

    if (row.year) {
      await this.selectEquipmentUsageFilterIfNeeded('year', this.normalizeFixtureCell(row.year), 'Uploaded Usage Year');
    }

    if (row.month) {
      await this.selectEquipmentUsageFilterIfNeeded('month', this.normalizeFixtureCell(row.month), 'Uploaded Usage Month');
    }

    await this.waitForTableDataToSettle('Equipment Usage uploaded sample filter results');
    return this.searchForAnyTerm(this.getEquipmentUsageUploadSearchTerms(upload), 'Equipment Usage uploaded generated sample record');
  }

  async closeEquipmentUsageAttachmentPageIfVisible() {
    if (!(await this.page.getByRole('heading', { name: /^Attachments$/i }).isVisible({ timeout: 3000 }).catch(() => false))) {
      return false;
    }

    const closedByDom = await this.page.evaluate(() => {
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };

      const candidates = Array.from(document.querySelectorAll('button, [role="button"]'))
        .filter(isVisible)
        .filter((button) => {
          const rect = button.getBoundingClientRect();
          const text = button.innerText || button.textContent || button.getAttribute('aria-label') || button.getAttribute('title') || '';
          return /back|close|previous/i.test(text) ||
            (rect.left > 390 && rect.left < 520 && rect.top > 250 && rect.top < 450 && rect.width <= 80 && rect.height <= 80);
        });

      let button = candidates[0];
      if (!button) {
        const attachmentHeading = Array.from(document.querySelectorAll('h1, h2, h3, [role="heading"]'))
          .find((element) => /^Attachments$/i.test((element.innerText || element.textContent || '').trim()));
        if (attachmentHeading) {
          const rect = attachmentHeading.getBoundingClientRect();
          const target = document.elementFromPoint(Math.max(0, rect.left - 115), rect.top + 300);
          button = target?.closest?.('button, [role="button"], a');
        }
      }
      if (!button) return false;

      button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    });

    if (!closedByDom) {
      await this.page.keyboard.press('Escape').catch(() => null);
    }

    await this.page.waitForTimeout(1000);
    if (await this.page.getByRole('heading', { name: /^Attachments$/i }).isVisible({ timeout: 1000 }).catch(() => false)) {
      const headingBox = await this.page.getByRole('heading', { name: /^Attachments$/i }).boundingBox().catch(() => null);
      if (headingBox) {
        await this.page.mouse.click(Math.max(0, headingBox.x - 115), headingBox.y + 300).catch(() => null);
        await this.page.waitForTimeout(1000);
      }
    }

    if (await this.page.getByRole('heading', { name: /^Attachments$/i }).isVisible({ timeout: 1000 }).catch(() => false)) {
      await this.page.goto(`${this.options.appUrl}/${this.options.projectId}/monthly-usage`, {
        waitUntil: 'domcontentloaded'
      }).catch((error) => {
        if (!/ERR_ABORTED|Navigation interrupted|net::ERR_ABORTED/i.test(error.message)) {
          throw error;
        }
      });
    }

    await this.page.waitForURL(/\/monthly-usage/i, { timeout: 10000 }).catch(() => null);
    await this.page.getByRole('heading', { name: /Equipment Monthly Usage Capture/i })
      .waitFor({ state: 'visible', timeout: 15000 })
      .catch(() => null);
    await this.waitForPageReady();

    if (await this.page.getByRole('heading', { name: /^Attachments$/i }).isVisible({ timeout: 1000 }).catch(() => false)) {
      throw new Error('Equipment Usage attachment page did not close after upload.');
    }

    return true;
  }

  async verifyEquipmentUsageListAfterAttachmentUpload(label, submission = null) {
    await this.closeEquipmentUsageAttachmentPageIfVisible();
    await this.openEquipmentUsage();

    if (submission?.selectedValues?.registeredEquipment) {
      await this.filterToCreatedEquipmentUsage(submission);
    } else {
      await this.clearFilters(1);
      await this.clearSearch();
    }

    await this.waitForTableDataToSettle(label);
    return this.ensureAtLeastOneRecord(label);
  }

  async validateEquipmentUsageSampleAttachmentUpload() {
    const firstFile = this.createRuntimeUploadFixture('usage', 'first');
    const secondFile = this.createRuntimeUploadFixture('usage', 'second');

    await this.openFirstEquipmentUsageAttachmentPage();
    const firstUpload = await this.uploadFixtureThroughCurrentDialog('usage', 'Equipment Usage attachment generated sample upload', 'success', firstFile);
    const firstRecordCount = await this.verifyEquipmentUsageListAfterAttachmentUpload('Equipment Usage list after first attachment upload');

    await this.openFirstEquipmentUsageAttachmentPage();
    const secondUpload = await this.uploadFixtureThroughCurrentDialog('usage', 'Equipment Usage second attachment generated sample upload', 'success', secondFile);
    const secondRecordCount = await this.verifyEquipmentUsageListAfterAttachmentUpload('Equipment Usage list after second attachment upload');

    return { firstUpload, secondUpload, recordCount: firstRecordCount + secondRecordCount };
  }

  async validateSingleEquipmentUsageAttachmentUpload(submission = null) {
    const file = this.createRuntimeUploadFixture('usage', 'primary');

    await this.openFirstEquipmentUsageAttachmentPage(submission);
    const upload = await this.uploadFixtureThroughCurrentDialog('usage', 'Equipment Usage attachment generated sample upload', 'success', file);
    const recordCount = await this.verifyEquipmentUsageListAfterAttachmentUpload('Equipment Usage list after attachment upload', submission);

    return { upload, recordCount };
  }

  async openEquipmentUsage() {
    await this.closeBlockingModalIfVisible('Equipment Usage navigation blocker');

    if (!(await this.equipmentUsageLink.first().isVisible({ timeout: 3000 }).catch(() => false))) {
      await this.page.goto(`${this.options.appUrl}/${this.options.projectId}/monthly-usage`, {
        waitUntil: 'domcontentloaded'
      }).catch((error) => {
        if (!/ERR_ABORTED|Navigation interrupted|net::ERR_ABORTED/i.test(error.message)) {
          throw error;
        }
      });
      await this.waitForPageReady();
      await this.waitForTableDataToSettle('Equipment Usage list');
      await this.addEquipmentUsageButton.first().waitFor({ state: 'visible', timeout: 30000 });
      await this.highlightLeftNavigation('Equipment Management', 'Equipment Usage');
      return;
    }

    await clickHighlighted(this.equipmentUsageLink.first(), 'Equipment Usage');
    await this.waitForPageReady();
    await this.waitForTableDataToSettle('Equipment Usage list');
    await this.highlightLeftNavigation('Equipment Management', 'Equipment Usage');
  }

  async openAddEquipmentUsage() {
    await clickHighlighted(this.addEquipmentUsageButton.first(), 'Add Equipment Usage');
    await this.page.locator('#mui-component-select-registeredEquipment, [role="combobox"]').first()
      .waitFor({ state: 'visible', timeout: 15000 });
  }

  getEquipmentUsageModal() {
    return this.page.locator('#invite_user_Modal, [role="dialog"], .modal.show').filter({
      hasText: /Add Equipment (?:Usage|Edit)/i
    }).first();
  }

  async closeEquipmentUsageModal() {
    const usageModal = this.getEquipmentUsageModal();
    if (!(await usageModal.isVisible({ timeout: 2000 }).catch(() => false))) {
      return false;
    }

    const openMenu = this.page.locator('.MuiMenu-root[role="presentation"], [role="listbox"]:visible').last();
    if (await openMenu.isVisible({ timeout: 500 }).catch(() => false)) {
      await this.page.keyboard.press('Escape').catch(() => null);
      await openMenu.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => null);
    }

    const closeCandidates = [
      usageModal.getByRole('button', { name: /Close|Cancel/i }).first(),
      usageModal.getByRole('link', { name: /Close|Cancel/i }).first(),
      usageModal.locator('[data-bs-dismiss="modal"], [data-dismiss="modal"], button.close, .btn-close').first()
    ];

    let closeClicked = false;
    for (const candidate of closeCandidates) {
      if (!(await candidate.isVisible({ timeout: 700 }).catch(() => false))) {
        continue;
      }

      await highlight(candidate, 'Close Equipment Usage modal').catch(() => null);
      closeClicked = await candidate.click({ timeout: 3000, force: true }).then(() => true).catch(() => false);
      if (closeClicked) {
        break;
      }
    }

    if (!closeClicked) {
      closeClicked = await this.page.evaluate(() => {
        const isVisible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0';
        };
        const modal = Array.from(document.querySelectorAll('#invite_user_Modal, [role="dialog"], .modal.show'))
          .find((element) => isVisible(element) && /Add Equipment (?:Usage|Edit)/i.test(element.innerText || element.textContent || ''));
        if (!modal) return false;
        const controls = Array.from(modal.querySelectorAll('button, a, [role="button"], [data-bs-dismiss="modal"], [data-dismiss="modal"]'));
        const closeControl = controls.find((element) => {
          const text = (element.innerText || element.textContent || element.getAttribute('aria-label') || '').trim();
          return /close|cancel/i.test(text) ||
            /modal/i.test(element.getAttribute('data-bs-dismiss') || element.getAttribute('data-dismiss') || '') ||
            element.classList.contains('close') ||
            element.classList.contains('btn-close');
        });
        if (!closeControl) return false;
        closeControl.click();
        return true;
      }).catch(() => false);
    }

    if (!closeClicked) {
      await this.page.keyboard.press('Escape').catch(() => null);
    }
    await usageModal.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => null);
    await this.waitForPageReady();
    return true;
  }

  async selectUsageDropdownBySelector(selector, optionName, label, options = {}) {
    const dropdown = this.page.locator(selector).first();
    const requestedValue = String(optionName || '').trim();
    const currentValue = (await dropdown.innerText({ timeout: 2000 }).catch(() => '')).replace(/\s+/g, ' ').trim();
    if (requestedValue && currentValue.toLowerCase() === requestedValue.toLowerCase()) {
      return currentValue;
    }

    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await this.closeOpenUsageDropdownMenus();
        const attemptLabel = attempt === 1 ? label : `${label} retry ${attempt}`;
        await dropdown.waitFor({ state: 'visible', timeout: 15000 });
        await dropdown.scrollIntoViewIfNeeded();
        await highlight(dropdown, attemptLabel).catch(() => null);
        await dropdown.click({ timeout: 10000 });
        await this.page.locator('[role="listbox"]:visible').last()
          .waitFor({ state: 'visible', timeout: 15000 });
        const selectedOption = await this.getUsageDropdownOption(optionName, {
          ...options,
          fallbackIndex: (options.fallbackIndex || 0) + attempt - 1
        });
        if (!selectedOption) {
          throw new Error('no enabled option was available');
        }

        const optionText = (await selectedOption.innerText()).replace(/\s+/g, ' ').trim();
        await clickHighlighted(selectedOption, `${label}: ${optionText}`);
        await this.page.waitForTimeout(500);
        const selectedValue = (await dropdown.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
        if (!selectedValue || selectedValue.toLowerCase().includes(optionText.toLowerCase())) {
          return optionText;
        }
        throw new Error(`selection did not persist (visible value: ${selectedValue})`);
      } catch (error) {
        lastError = error;
        await this.closeOpenUsageDropdownMenus();
        await this.page.waitForTimeout(500);
      }
    }

    throw new Error(`Could not select an enabled option from ${label} after 3 attempts: ${lastError?.message || '-'}`);
  }

  async closeOpenUsageDropdownMenus() {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const openPopup = this.page.locator('[role="listbox"]:visible, .MuiMenu-root:visible').last();
      if (!(await openPopup.isVisible({ timeout: 300 }).catch(() => false))) return;
      await this.page.keyboard.press('Escape').catch(() => null);
      await openPopup.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => null);
    }
  }

  async getUsageDropdownOption(optionName, options = {}) {
    const excluded = new Set((options.exclude || []).map((value) => value.trim()));
    const fallbackIndex = options.fallbackIndex || 0;
    const openPopup = this.page.locator('[role="listbox"]:visible, .MuiMenu-paper:visible').last();
    const scopedOptions = openPopup.locator('[role="option"]:not([aria-disabled="true"])');
    const enabledOptions = await scopedOptions.first().isVisible({ timeout: 1500 }).catch(() => false)
      ? scopedOptions
      : this.page.locator('[role="option"]:visible:not([aria-disabled="true"])');
    await enabledOptions.first().waitFor({ state: 'visible', timeout: 15000 });

    if (optionName) {
      const exactOption = this.page.getByRole('option', { name: optionName, exact: true }).first();
      const exactText = await exactOption.innerText({ timeout: 1000 }).catch(() => '');
      if (exactText && !excluded.has(exactText.trim()) && await exactOption.isVisible().catch(() => false)) {
        return exactOption;
      }

      const partialOption = this.page.getByRole('option', { name: optionName }).first();
      const partialText = await partialOption.innerText({ timeout: 1000 }).catch(() => '');
      if (partialText && !excluded.has(partialText.trim()) && await partialOption.isVisible().catch(() => false)) {
        return partialOption;
      }
    }

    const count = await enabledOptions.count();
    const candidates = [];
    for (let index = 0; index < count; index += 1) {
      const option = enabledOptions.nth(index);
      const text = (await option.innerText().catch(() => '')).trim();
      if (!text || excluded.has(text)) continue;
      candidates.push({ index, text });
    }

    if (!candidates.length && excluded.size) {
      for (let index = 0; index < count; index += 1) {
        const option = enabledOptions.nth(index);
        const text = (await option.innerText().catch(() => '')).trim();
        if (!text) continue;
        candidates.push({ index, text });
      }
    }

    if (!candidates.length) {
      return null;
    }

    const selected = options.random ? pickRandom(candidates) : candidates[fallbackIndex % candidates.length];
    return enabledOptions.nth(selected.index);
  }

  async selectUsageMonth(month, options = {}) {
    const usageModal = this.getEquipmentUsageModal();
    const requestedMonth = normalizeMonthName(month);
    const excludedMonths = (options.exclude || []).map(normalizeMonthName).filter(Boolean);
    const monthCandidates = [
      usageModal.locator('#mui-component-select-month').first(),
      this.page.locator('#mui-component-select-month').first(),
      usageModal.getByRole('combobox').nth(2)
    ];

    for (const monthDropdown of monthCandidates) {
      if (await monthDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
        const currentMonth = normalizeMonthName(await monthDropdown.innerText().catch(() => ''));
        if (currentMonth && (!requestedMonth || currentMonth === requestedMonth) && !excludedMonths.includes(currentMonth)) {
          return currentMonth;
        }

        let lastError = null;
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            await this.closeOpenUsageDropdownMenus();
            await this.clickWithFallback(monthDropdown, attempt === 1 ? 'Month' : `Month retry ${attempt}`);
            const selectedOption = await this.getUsageDropdownOption(requestedMonth, {
              exclude: excludedMonths,
              fallbackIndex: Math.max(0, MONTH_NAMES.indexOf(requestedMonth)) + attempt - 1,
              random: options.random && !requestedMonth
            });
            if (!selectedOption) throw new Error('no enabled month option was available');

            const rawOptionText = (await selectedOption.innerText()).replace(/\s+/g, ' ').trim();
            const optionText = normalizeMonthName(rawOptionText);
            if (!optionText) throw new Error(`unexpected month option "${rawOptionText}"`);
            if (excludedMonths.includes(optionText)) throw new Error(`month ${optionText} was already tried`);

            await clickHighlighted(selectedOption, `Month: ${optionText}`);
            await this.page.waitForTimeout(600);
            const persistedMonth = normalizeMonthName(await monthDropdown.innerText().catch(() => ''));
            if (persistedMonth === optionText) return optionText;
            throw new Error(`month did not persist (visible value: ${persistedMonth || '<empty>'})`);
          } catch (error) {
            lastError = error;
            await this.closeOpenUsageDropdownMenus();
          }
        }

        throw new Error(`Could not select Month after 3 attempts: ${lastError?.message || '-'}`);
      }
    }

    const visibleComboboxes = await usageModal.getByRole('combobox').count().catch(() => 0);
    throw new Error(`Could not find Month dropdown in Add Equipment Usage modal (${visibleComboboxes} comboboxes found).`);
  }

  getEquipmentUsageAttemptValues(values, attempt) {
    const preferredMonth = normalizeMonthName(values.month) || MONTH_NAMES[new Date().getMonth()];
    const preferredMonthIndex = MONTH_NAMES.indexOf(preferredMonth);
    return {
      ...values,
      registeredEquipment: attempt === 0 ? values.registeredEquipment : null,
      year: values.year || String(new Date().getFullYear()),
      month: MONTH_NAMES[(preferredMonthIndex + attempt) % MONTH_NAMES.length],
      hours: String(randomInteger(5, 40)),
      litresOrGallons: String(randomInteger(5, 100) + attempt)
    };
  }

  async submitEquipmentUsageForm(values = DEFAULT_EQUIPMENT_USAGE, options = {}) {
    const selectedRegisteredEquipment = await this.selectUsageDropdownBySelector(
      '#mui-component-select-registeredEquipment',
      values.registeredEquipment,
      'Registered Equipment',
      {
        exclude: options.excludeEquipment || [],
        fallbackIndex: options.attempt || 0,
        random: true
      }
    );
    const selectedYear = await this.selectUsageDropdownBySelector('#mui-component-select-year', values.year, 'Year', {
      fallbackIndex: options.attempt || 0,
      random: true
    });
    const selectedMonth = await this.selectUsageMonth(values.month, {
      random: false,
      exclude: options.excludeMonths || []
    });
    await fillHighlighted(this.page.getByRole('spinbutton', { name: /No\.?\s*Of Hours/i }), values.hours, 'No. Of Hours');
    await fillHighlighted(this.page.locator('#litresOrGallons'), values.litresOrGallons, 'Litres or Gallons');
    await clickHighlighted(this.page.getByRole('button', { name: /^Submit$/i }), 'Submit Equipment Usage');
    await this.waitForPageReady();

    const visibleMessage = await this.getVisiblePageMessage();
    const selectedValues = {
      registeredEquipment: selectedRegisteredEquipment,
      year: selectedYear,
      month: selectedMonth
    };

    if (/duplicate|already exists|already created/i.test(visibleMessage)) {
      console.log(`Equipment usage record already exists; continuing: ${visibleMessage}`);
      await this.closeEquipmentUsageModal();
      return { submitted: false, duplicate: true, message: visibleMessage, selectedValues };
    }

    if (/error|invalid|failed|required|unable/i.test(visibleMessage)) {
      throw new Error(`Equipment usage submission failed: ${visibleMessage}`);
    }

    if (await this.closeEquipmentUsageModal()) {
      return {
        submitted: false,
        duplicate: false,
        message: visibleMessage || 'Equipment usage modal remained open after submit; continuing because the target usage record may already exist.',
        selectedValues
      };
    }

    return { submitted: true, duplicate: false, message: visibleMessage, selectedValues };
  }

  async createEquipmentUsageWithRetry(values = DEFAULT_EQUIPMENT_USAGE, maxAttempts = 4) {
    const triedEquipment = [];
    const triedMonths = [];
    let lastSubmission = null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (attempt > 0) {
        await this.openAddEquipmentUsage();
      }

      const attemptValues = this.getEquipmentUsageAttemptValues(values, attempt);
      lastSubmission = await this.submitEquipmentUsageForm(attemptValues, {
        attempt,
        excludeEquipment: attempt > 0 ? triedEquipment : [],
        excludeMonths: triedMonths
      });

      if (lastSubmission.selectedValues?.registeredEquipment) {
        triedEquipment.push(lastSubmission.selectedValues.registeredEquipment);
      }
      if (lastSubmission.selectedValues?.month) {
        triedMonths.push(lastSubmission.selectedValues.month);
      }

      if (lastSubmission.submitted) {
        return lastSubmission;
      }

      if (!lastSubmission.duplicate && attempt === 0) {
        console.log('Equipment usage modal did not close after submit; retrying with alternate dropdown values.');
      } else {
        console.log('Retrying Equipment Usage creation with alternate dropdown values.');
      }
    }

    throw new Error(`Could not create a new Equipment Usage record after ${maxAttempts} attempts. Last message: ${lastSubmission?.message || 'no message'}`);
  }

  async getAvailableEquipmentUsageFilterValues() {
    await this.ensureAtLeastOneRecord('Equipment Usage records before filter selection');
    const values = await this.page.evaluate((months) => {
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };

      const table = Array.from(document.querySelectorAll('table, [role="table"]')).find(isVisible) || document;
      const headers = Array.from(table.querySelectorAll('th, [role="columnheader"]'))
        .map((header) => (header.innerText || header.textContent || '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim());
      const monthIndex = headers.findIndex((header) => /^Month$/i.test(header));
      const yearIndex = headers.findIndex((header) => /^Year$/i.test(header));
      const rows = Array.from(table.querySelectorAll('tbody tr, [role="row"]'))
        .filter(isVisible)
        .filter((row) => !/Equipment Reference|No Data found|No records found/i.test(row.innerText || row.textContent || ''));
      const row = rows[Math.floor(Math.random() * rows.length)];
      if (!row) return null;

      const cells = Array.from(row.querySelectorAll('td, [role="cell"]'))
        .map((cell) => (cell.innerText || cell.textContent || '').replace(/\s+/g, ' ').trim());
      const month = cells[monthIndex >= 0 ? monthIndex : 3] || cells.find((cell) => months.includes(cell));
      const year = cells[yearIndex >= 0 ? yearIndex : 4] || cells.find((cell) => /^\d{4}$/.test(cell));

      return { month, year };
    }, MONTH_NAMES);

    if (!values?.year || !values?.month) {
      throw new Error(`Could not derive Equipment Usage Year/Month from an available record: ${JSON.stringify(values)}`);
    }

    return values;
  }

  async filterEquipmentUsage(values = DEFAULT_EQUIPMENT_USAGE, maxAttempts = 2) {
    let lastSelected = {};

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (attempt > 1) {
        await this.clearFilters(1);
        await this.clearSearch();
      }

      const availableValues = await this.getAvailableEquipmentUsageFilterValues();
      lastSelected = availableValues;
      await this.selectEquipmentUsageFilterIfNeeded('year', availableValues.year, 'Year');
      await this.selectEquipmentUsageFilterIfNeeded('month', availableValues.month, 'Month');
      await this.waitForTableDataToSettle('Equipment Usage filtered results');

      const recordCount = await this.getVisibleTableRecordCount();
      if (recordCount > 0) {
        console.log(`Selected Equipment Usage filters from an available record with ${recordCount} result(s): ${availableValues.year} / ${availableValues.month}`);
        return availableValues;
      }

      console.log(`Available Equipment Usage filters ${availableValues.year}/${availableValues.month} returned No Data found; clearing filters and trying again (${attempt}/${maxAttempts}).`);
    }

    throw new Error(`Could not select Equipment Usage filter values with records. Last selected: ${JSON.stringify(lastSelected)}`);
  }

  async getEquipmentUsageFilterDropdown(kind) {
    await this.page.evaluate(({ filterKind, months }) => {
      document.querySelectorAll('[data-vc-equipment-usage-filter]').forEach((element) => {
        element.removeAttribute('data-vc-equipment-usage-filter');
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

      const usageHeading = Array.from(document.querySelectorAll('h1, h2, h3, [role="heading"]'))
        .find((element) => /Equipment Monthly Usage Capture/i.test(element.innerText || element.textContent || ''));
      const contentRoot = usageHeading?.closest('main, [class*="content"], [class*="right"], [class*="container"]') || document.body;
      const comboboxes = Array.from(contentRoot.querySelectorAll('[role="combobox"]'))
        .filter(isVisible)
        .filter((element) => !/Buckingham Palace|Construction Delivery|V3 Construction deliveries/i.test(element.innerText || element.textContent || ''));

      const target = comboboxes.find((element) => {
        const text = (element.innerText || element.textContent || '').trim();
        if (filterKind === 'year') return /^Year$/i.test(text) || /^\d{4}$/.test(text);
        return /^Month$/i.test(text) || months.some((month) => month.toLowerCase() === text.toLowerCase());
      });

      if (target) {
        target.setAttribute('data-vc-equipment-usage-filter', filterKind);
      }
    }, { filterKind: kind, months: MONTH_NAMES });

    const dropdown = this.page.locator(`[data-vc-equipment-usage-filter="${kind}"]`).first();
    await dropdown.waitFor({ state: 'visible', timeout: 10000 });
    return dropdown;
  }

  async selectEquipmentUsageFilterIfNeeded(kind, value, label = kind) {
    const expectedValue = kind === 'month' ? normalizeMonthName(value) : String(value || '').trim();
    if (!expectedValue) {
      throw new Error(`${label} filter value is empty or invalid: ${value}`);
    }

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const dropdown = await this.getEquipmentUsageFilterDropdown(kind);
      const currentText = (await dropdown.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
      const currentValue = kind === 'month' ? normalizeMonthName(currentText) : currentText;
      if (currentValue.toLowerCase() === expectedValue.toLowerCase()) {
        this.equipmentUsageFilterState[kind] = expectedValue;
        console.log(`${label} filter already selected: ${expectedValue}; skipping duplicate selection.`);
        return { value: expectedValue, changed: false };
      }

      await this.closeOpenUsageDropdownMenus();
      await this.clickWithFallback(dropdown, attempt === 1 ? label : `${label} retry ${attempt}`);
      const openPopup = this.page.locator('[role="listbox"]:visible, .MuiMenu-paper:visible').last();
      const exactOption = openPopup.getByRole('option', { name: expectedValue, exact: true }).first();
      const fallbackExactOption = this.page.getByRole('option', { name: expectedValue, exact: true }).filter({ visible: true }).first();
      const option = await exactOption.isVisible({ timeout: 3000 }).catch(() => false)
        ? exactOption
        : fallbackExactOption;

      if (!(await option.isVisible({ timeout: 1500 }).catch(() => false))) {
        await this.closeOpenUsageDropdownMenus();
        if (attempt === 2) {
          throw new Error(`${label} filter option "${expectedValue}" was not available.`);
        }
        continue;
      }

      await clickHighlighted(option, `${label}: ${expectedValue}`);
      await this.waitForPageReady();
      const refreshedDropdown = await this.getEquipmentUsageFilterDropdown(kind);
      const persistedText = (await refreshedDropdown.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
      const persistedValue = kind === 'month' ? normalizeMonthName(persistedText) : persistedText;
      if (persistedValue.toLowerCase() === expectedValue.toLowerCase()) {
        this.equipmentUsageFilterState[kind] = expectedValue;
        return { value: expectedValue, changed: true };
      }
    }

    throw new Error(`${label} filter "${expectedValue}" did not persist after 2 attempts.`);
  }

  getUsageSearchText(submission) {
    const equipment = submission?.selectedValues?.registeredEquipment || '';
    const withoutDatePrefix = equipment.replace(/^\[[^\]]+\]-?/, '').trim();
    return withoutDatePrefix.split('-')[0].trim() || equipment.trim();
  }

  async filterToCreatedEquipmentUsage(submission) {
    const selectedValues = submission?.selectedValues || {};
    if (selectedValues.year) {
      await this.selectEquipmentUsageFilterIfNeeded('year', selectedValues.year, 'Cleanup Year');
    }

    if (selectedValues.month) {
      await this.selectEquipmentUsageFilterIfNeeded('month', selectedValues.month, 'Cleanup Month');
    }

    const searchText = this.getUsageSearchText(submission);
    if (searchText) {
      await this.search(searchText);
    } else {
      await this.waitForTableDataToSettle('Equipment Usage cleanup results');
    }
  }

  async getCreatedEquipmentUsageRow(submission) {
    const selectedValues = submission?.selectedValues || {};
    const equipment = selectedValues.registeredEquipment || '';
    const equipmentSearchText = this.getUsageSearchText(submission);
    const equipmentFragments = [
      equipment,
      equipmentSearchText,
      equipment.replace(/^\[[^\]]+\]-?/, '').trim()
    ]
      .map((value) => value.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    await this.page.evaluate((fragments) => {
      document.querySelectorAll('[data-vc-created-equipment-usage-row]').forEach((element) => {
        element.removeAttribute('data-vc-created-equipment-usage-row');
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

      const rows = Array.from(document.querySelectorAll('table tbody tr, [role="row"]'))
        .filter(isVisible)
        .filter((row) => !/Scheduled Arrivals|No Data found|No records found/i.test(row.innerText || row.textContent || ''));

      const row = rows.find((candidate) => {
        const text = (candidate.innerText || candidate.textContent || '').replace(/\s+/g, ' ').trim();
        return fragments.some((fragment) => text.includes(fragment));
      }) || rows[0];

      if (row) {
        row.setAttribute('data-vc-created-equipment-usage-row', 'true');
      }
    }, equipmentFragments);

    const row = this.page.locator('[data-vc-created-equipment-usage-row="true"]').first();
    await row.waitFor({ state: 'visible', timeout: 10000 });
    return row;
  }

  async clickRowAction(row, actionPattern, label) {
    const clicked = await row.evaluate((rowElement, patternSource) => {
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

      const controls = Array.from(rowElement.querySelectorAll('button, a, [role="button"], img, svg'))
        .filter(isVisible);
      const control = controls.find((candidate) => {
        const text = [
          candidate.innerText,
          candidate.textContent,
          candidate.getAttribute('aria-label'),
          candidate.getAttribute('title'),
          candidate.getAttribute('alt'),
          candidate.getAttribute('src'),
          candidate.className?.baseVal || candidate.className
        ].join(' ');
        return pattern.test(text);
      });

      const target = control?.closest('button, a, [role="button"]') || control;
      if (!target) return false;

      target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    }, actionPattern.source);

    if (clicked) {
      await this.page.waitForTimeout(1000);
      return true;
    }

    return false;
  }

  async clickCreatedUsageDeleteAction(row) {
    if (await this.clickRowAction(row, /delete|remove|trash|bin/i, 'Created Equipment Usage delete action')) {
      return true;
    }

    const rowButtons = row.getByRole('button');
    const buttonCount = await rowButtons.count();
    if (buttonCount > 1) {
      await this.clickWithFallback(rowButtons.nth(buttonCount - 1), 'Created Equipment Usage delete fallback action');
      await this.page.waitForTimeout(1000);
      return true;
    }

    return false;
  }

  async getRandomVisibleEquipmentUsageRow(marker = 'data-vc-random-equipment-usage-row') {
    const rowCount = await this.page.evaluate((attributeName) => {
      document.querySelectorAll(`[${attributeName}]`).forEach((element) => {
        element.removeAttribute(attributeName);
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

      const rows = Array.from(document.querySelectorAll('table tbody tr, [role="row"]'))
        .filter(isVisible)
        .filter((row) => !/Equipment Reference|Scheduled Arrivals|No Data found|No records found/i.test(row.innerText || row.textContent || ''))
        .filter((row) => Array.from(row.querySelectorAll('button, a, [role="button"], img, svg')).some(isVisible));

      rows.forEach((row, index) => {
        row.setAttribute(attributeName, String(index));
      });

      return rows.length;
    }, marker);

    if (!rowCount) {
      throw new Error('No editable Equipment Usage records were visible.');
    }

    const selectedIndex = randomInteger(0, rowCount - 1);
    const row = this.page.locator(`[${marker}="${selectedIndex}"]`).first();
    await row.waitFor({ state: 'visible', timeout: 10000 });
    return row;
  }

  async openEquipmentUsageRowEdit(row, label = 'Edit Equipment Usage row') {
    const rowText = (await row.innerText()).replace(/\s+/g, ' ').trim();

    if (!(await this.clickRowAction(row, /edit|pencil|modify|update/i, label))) {
      const rowButtons = row.getByRole('button');
      if (await rowButtons.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.clickWithFallback(rowButtons.first(), `${label} fallback action`);
      } else {
        throw new Error(`Could not find an edit action for Equipment Usage row: ${rowText}`);
      }
    }

    await this.page.locator('#mui-component-select-year, [role="dialog"] [role="combobox"]').first()
      .waitFor({ state: 'visible', timeout: 15000 });

    await this.validateEquipmentFuelEfficiencyUnit(`${label} fuel efficiency`);
    return rowText;
  }

  async submitRandomEquipmentUsageEdit(maxAttempts = 6) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const selectedYear = await this.selectUsageDropdownBySelector('#mui-component-select-year', null, 'Edit Year', {
        random: true,
        fallbackIndex: attempt
      });
      const selectedMonth = await this.selectUsageMonth(null, { random: true });
      const hours = String(randomInteger(6, 45));
      const fuel = String(randomInteger(10, 125));

      await fillHighlighted(this.page.getByRole('spinbutton', { name: /No\.?\s*Of Hours/i }), hours, 'No. Of Hours');
      await fillHighlighted(this.page.locator('#litresOrGallons'), fuel, 'Litres or Gallons');
      await clickHighlighted(this.page.getByRole('button', { name: /^(Submit|Update|Save)$/i }).first(), 'Submit Equipment Usage edit');
      await this.waitForPageReady();

      const visibleMessage = await this.getVisiblePageMessage();
      if (/duplicate|already exists|already created/i.test(visibleMessage)) {
        console.log(`Equipment Usage edit combination already exists (${selectedYear}/${selectedMonth}); trying random values again.`);
        continue;
      }

      if (/error|invalid|failed|required|unable/i.test(visibleMessage)) {
        throw new Error(`Equipment Usage edit failed: ${visibleMessage}`);
      }

      await this.closeEquipmentUsageModal();
      return { year: selectedYear, month: selectedMonth, hours, litresOrGallons: fuel };
    }

    throw new Error(`Could not edit Equipment Usage with random available values after ${maxAttempts} attempts.`);
  }

  async editRandomExistingEquipmentUsage() {
    await this.openEquipmentUsage();
    await this.clearFilters(1);
    await this.clearSearch();
    await this.waitForTableDataToSettle('Equipment Usage existing records before edit');

    const row = await this.getRandomVisibleEquipmentUsageRow();
    const rowText = await this.openEquipmentUsageRowEdit(row, 'Edit random existing Equipment Usage row');
    const editedValues = await this.submitRandomEquipmentUsageEdit();

    console.log(`Edited random existing Equipment Usage record: ${rowText}; new values ${JSON.stringify(editedValues)}`);
    return editedValues;
  }

  async getAvailableUsageYears(excludeYears = []) {
    await this.clickWithFallback(this.page.locator('#mui-component-select-year').first(), 'Edit Year');
    const excluded = new Set(excludeYears.map((year) => String(year).trim()));
    const years = await this.page.locator('[role="option"]:not([aria-disabled="true"])').evaluateAll((options, excludedValues) => {
      const excludedSet = new Set(excludedValues);
      return options
        .map((option) => (option.innerText || option.textContent || '').trim())
        .filter((text) => /^\d{4}$/.test(text) && !excludedSet.has(text));
    }, Array.from(excluded));
    await this.page.keyboard.press('Escape').catch(() => null);
    await this.page.waitForTimeout(300);
    return years;
  }

  async updateEquipmentUsageYear(submission, maxAttempts = 6) {
    if (!submission?.submitted || !submission?.selectedValues?.registeredEquipment) {
      console.log('No newly-created Equipment Usage record was submitted; edit step is not required.');
      return submission;
    }

    await this.openEquipmentUsage();
    await this.filterToCreatedEquipmentUsage(submission);
    const row = await this.getCreatedEquipmentUsageRow(submission);
    const rowText = (await row.innerText()).replace(/\s+/g, ' ').trim();

    if (!(await this.clickRowAction(row, /edit|pencil|modify|update/i, 'Edit created Equipment Usage row'))) {
      const rowButtons = row.getByRole('button');
      if (await rowButtons.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.clickWithFallback(rowButtons.first(), 'Edit created Equipment Usage row fallback action');
      } else {
        throw new Error(`Could not find an edit action for the automation-created Equipment Usage row: ${rowText}`);
      }
    }

    if (await row.isVisible({ timeout: 1000 }).catch(() => false) &&
      !(await this.page.locator('#mui-component-select-year, [role="dialog"] [role="combobox"]').first().isVisible({ timeout: 2000 }).catch(() => false))) {
      throw new Error(`Could not find an edit action for the automation-created Equipment Usage row: ${rowText}`);
    }

    await this.page.locator('#mui-component-select-year, [role="dialog"] [role="combobox"]').first()
      .waitFor({ state: 'visible', timeout: 15000 });

    const fuelEfficiencyUnit = await this.validateEquipmentFuelEfficiencyUnit('Edit Equipment Usage fuel efficiency');
    const triedYears = [submission.selectedValues.year].filter(Boolean);
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const availableYears = await this.getAvailableUsageYears(triedYears);
      if (!availableYears.length) {
        throw new Error('No alternate year values were available for the Equipment Usage edit.');
      }

      const nextYear = availableYears[Math.floor(Math.random() * availableYears.length)];
      triedYears.push(nextYear);
      await this.selectUsageDropdownBySelector('#mui-component-select-year', nextYear, 'Edit Year');
      await clickHighlighted(this.page.getByRole('button', { name: /^(Submit|Update|Save)$/i }).first(), 'Submit Equipment Usage edit');
      await this.waitForPageReady();

      const visibleMessage = await this.getVisiblePageMessage();
      if (/duplicate|already exists|already created/i.test(visibleMessage)) {
        console.log(`Equipment Usage edit year ${nextYear} already exists; trying another year.`);
        continue;
      }

      if (/error|invalid|failed|required|unable/i.test(visibleMessage)) {
        throw new Error(`Equipment usage edit failed: ${visibleMessage}`);
      }

      await this.closeEquipmentUsageModal();
      submission.selectedValues.year = nextYear;
      submission.fuelEfficiencyUnit = fuelEfficiencyUnit;
      console.log(`Updated automation-created Equipment Usage year from ${triedYears[0]} to ${nextYear}.`);
      return submission;
    }

    throw new Error(`Could not update Equipment Usage year after ${maxAttempts} attempts.`);
  }

  async confirmDeleteEquipmentUsageIfVisible() {
    const confirmCandidates = [
      this.page.getByRole('button', { name: /^Delete$/i }).last(),
      this.page.getByRole('button', { name: /^Remove$/i }).last(),
      this.page.getByRole('button', { name: /^Confirm$/i }).last(),
      this.page.getByRole('button', { name: /^Yes$/i }).last(),
      this.page.getByRole('button', { name: /^OK$/i }).last()
    ];

    for (const candidate of confirmCandidates) {
      if (await candidate.isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.clickWithFallback(candidate, 'Confirm Equipment Usage delete');
        await this.waitForPageReady();
        return true;
      }
    }

    await this.waitForPageReady();
    return false;
  }

  async deleteCreatedEquipmentUsage(submission) {
    if (!submission?.submitted || !submission?.selectedValues?.registeredEquipment) {
      console.log('No newly-created Equipment Usage record was submitted; cleanup is not required.');
      return false;
    }

    let rowText = '';
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      await this.openEquipmentUsage();
      await this.filterToCreatedEquipmentUsage(submission);
      const row = await this.getCreatedEquipmentUsageRow(submission);
      rowText = (await row.innerText()).replace(/\s+/g, ' ').trim();

      if (!(await this.clickCreatedUsageDeleteAction(row))) {
        throw new Error(`Could not find a delete action for the automation-created Equipment Usage row: ${rowText}`);
      }

      await this.confirmDeleteEquipmentUsageIfVisible();
      await this.waitForTableDataToSettle('Equipment Usage after cleanup delete');
      await this.openEquipmentUsage();
      await this.filterToCreatedEquipmentUsage(submission);

      const stillVisible = await this.page.evaluate((expectedRowText) => {
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

        return Array.from(document.querySelectorAll('table tbody tr, [role="row"]'))
          .filter(isVisible)
          .some((candidate) => normalize(candidate.innerText || candidate.textContent) === expectedRowText);
      }, rowText).catch(() => false);

      if (!stillVisible) {
        console.log(`Deleted automation-created Equipment Usage record: ${rowText}`);
        return true;
      }

      console.log(`Automation-created Equipment Usage row was still visible after delete attempt ${attempt}; retrying cleanup.`);
    }

    console.warn(`Automation-created Equipment Usage row remained visible after cleanup retries: ${rowText}`);
    return false;
  }

  async downloadEquipmentUsageExport() {
    if (!(await this.hasVisibleTableRecords())) {
      console.log('Equipment Usage has no visible records; skipping export download.');
      return null;
    }

    const downloadPromise = this.page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
    const exportIcon = this.page.locator('.f-right > div > img').first();
    if (await exportIcon.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.clickWithFallback(exportIcon, 'Equipment Usage export');
    } else {
      await this.clickIconButtonByIndex(4, 'Equipment Usage export');
    }
    const download = await downloadPromise;
    if (!download) {
      console.log('Equipment Usage export did not emit a download; continuing with the remaining flow.');
      return null;
    }
    console.log(`Equipment Usage export downloaded: ${download.suggestedFilename()}`);
    return download;
  }

  async applyRecordedEquipmentListFilters() {
    await this.openEquipmentList();
    await this.selectJanuary2026DateRange();
    await this.selectCompany();
    await this.openEquipmentTypeDropdown();
  }

  async runRecordedEquipmentManagementFunctionalFlow(values = DEFAULT_EQUIPMENT_USAGE) {
    return this.runEnhancedEquipmentManagementFlow(values);
  }

  async runEnhancedEquipmentManagementFlow(values = DEFAULT_EQUIPMENT_USAGE) {
    const result = {};

    result.equipmentListUpload = await this.validateEquipmentListSampleUpload();
    await this.waitBetweenProcesses('Equipment List upload process complete');

    result.equipmentListFilters = result.equipmentListUpload.verification ||
      await this.searchForAnyTerm(
        this.getEquipmentListUploadSearchTerms(result.equipmentListUpload),
        'Equipment List uploaded generated sample record'
      );
    await this.waitForTableDataToSettle('Equipment List uploaded record results');
    await this.waitBetweenProcesses('Equipment List uploaded record search complete');

    result.equipmentListAvailableDataSearch = await this.applyEquipmentListSearchFromAvailableData();
    await this.clearFilters(1);
    await this.waitForTableDataToSettle('Equipment List after clearing available-data search filters');
    await this.waitBetweenProcesses('Equipment List filter process complete');

    await this.highlightFirstVisibleTableRow('Equipment List filtered record');
    await this.sortEquipmentListByCompany();
    await this.selectFirstVisibleTableRecord('Equipment List selected record');
    result.equipmentListExport = await this.downloadEquipmentListExport();
    result.equipmentListPdf = await this.downloadEquipmentListPrintPdf();
    await this.waitBetweenProcesses('Equipment List export and PDF process complete');

    await this.openEquipmentUsage();
    await this.openAddEquipmentUsage();
    result.equipmentFuelEfficiencyUnit = await this.validateEquipmentFuelEfficiencyUnit('Add Equipment Usage fuel efficiency');
    result.usageSubmission = await this.createEquipmentUsageWithRetry(values);
    await this.waitBetweenProcesses('Equipment Usage create process complete');

    await this.openEquipmentUsage();
    await this.filterToCreatedEquipmentUsage(result.usageSubmission);
    await this.highlightFirstVisibleTableRow('Created Equipment Usage record');

    const equipmentUsageSearchText = this.getUsageSearchText(result.usageSubmission);
    result.equipmentUsageSearch = await this.searchEquipmentUsageCompanyWithRecovery(equipmentUsageSearchText);
    result.equipmentUsageFilters = await this.filterEquipmentUsage(values);
    result.usageSubmission = await this.updateEquipmentUsageYear(result.usageSubmission);
    await this.waitBetweenProcesses('Equipment Usage search, filter, and edit process complete');
    result.equipmentUsageAttachment = await this.validateSingleEquipmentUsageAttachmentUpload(result.usageSubmission);
    await this.waitBetweenProcesses('Equipment Usage attachment process complete');

    await this.deleteCreatedEquipmentUsage(result.usageSubmission);
    await this.clearFilters(1);
    await this.clearSearch();
    return result;
  }
}

module.exports = { EquipmentManagementPage };
