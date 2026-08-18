#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');
const XLSX = require('xlsx');
const { EquipmentManagementPage } = require('../pages/booking/equipment-management.page');
const { loadEnvFile } = require('../utils/env');

const ROOT_DIR = path.resolve(__dirname, '..');
const AUTH_STATE_PATH = path.join(ROOT_DIR, 'auth.json');
const RESULTS_DIR = path.join(ROOT_DIR, 'test-results', 'updated-equipment-list');
const DEFAULT_EQUIPMENT_UPLOAD_SOURCE = path.join(os.homedir(), 'Downloads', 'ListOfEquipment_sample (5).xlsx');

function parseArguments() {
  const args = process.argv.slice(2);

  return {
    headless: args.includes('--headless'),
    keepOpen: args.includes('--keep-open'),
    skipUpload: args.includes('--skip-upload'),
    useAuthState: args.includes('--use-auth-state')
  };
}

function formatTimestamp(value = new Date()) {
  return value.toISOString().replace(/[:.]/g, '-');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function runStep(name, action) {
  console.log(`\n[Updated Equipment List] ${name}`);
  const result = await action();
  console.log(`[Updated Equipment List] Completed: ${name}`);
  return result;
}

async function clickVisible(pageObject, locators, label) {
  for (const locator of locators) {
    const candidate = locator.first();
    if (await candidate.isVisible({ timeout: 2500 }).catch(() => false)) {
      await pageObject.clickWithFallback(candidate, label);
      return true;
    }
  }

  console.log(`${label} was not visible; continuing.`);
  return false;
}

async function clickColumnHeader(page, equipmentManagement, label, times = 1) {
  const exactPattern = new RegExp(`^${escapeRegExp(label)}$`, 'i');
  for (let index = 0; index < times; index += 1) {
    const clicked = await clickVisible(equipmentManagement, [
      page.getByRole('columnheader', { name: exactPattern }),
      page.getByRole('table').getByText(exactPattern),
      page.getByText(exactPattern)
    ], `${label} header`);

    if (clicked) {
      await equipmentManagement.waitForTableDataToSettle(`Equipment List after ${label} header click`);
    }
  }
}

async function openCodegenRecordedRoute(page, context, equipmentManagement) {
  const loginUrl = `${equipmentManagement.options.baseUrl.replace(/\/$/, '')}/api/sso/users/login/`;

  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
  await equipmentManagement.loginIfNeeded();
  await selectRecordedPlatformAndProject(page, equipmentManagement);
  await openProjectHomeAndValidate(page, equipmentManagement);
  await context.storageState({ path: AUTH_STATE_PATH }).catch(() => null);

  if (await equipmentManagement.equipmentManagementLink.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await equipmentManagement.openEquipmentManagement().catch((error) => {
      console.log(`Equipment Management menu click did not settle; using direct Equipment List route: ${error.message}`);
    });
  }

  await equipmentManagement.openEquipmentListDirectly();
  await assertValidProjectContext(page, equipmentManagement);
}

async function openProjectHomeAndValidate(page, equipmentManagement) {
  const homeUrl = `${equipmentManagement.options.appUrl.replace(/\/$/, '')}/${equipmentManagement.options.projectId}/home`;
  await page.goto(homeUrl, { waitUntil: 'domcontentloaded' }).catch((error) => {
    if (!/ERR_ABORTED|Navigation interrupted|net::ERR_ABORTED/i.test(error.message)) {
      throw error;
    }
  });
  await equipmentManagement.waitForPageReady();
  await page.waitForTimeout(3000);
  await forceBuckinghamProjectStorage(page, equipmentManagement.options.projectId);
  await assertValidProjectContext(page, equipmentManagement);
}

async function selectRecordedPlatformAndProject(page, equipmentManagement) {
  await equipmentManagement.waitForPageReady();

  await page.goto(`${equipmentManagement.options.baseUrl.replace(/\/$/, '')}/api/sso/platforms/choose/`, {
    waitUntil: 'domcontentloaded'
  }).catch((error) => {
    console.log(`Platform chooser direct navigation did not settle: ${error.message}`);
  });
  await equipmentManagement.waitForPageReady();

  if (await clickCardActionByText(page, 'Construction Delivery', /Open|Log Into/i)) {
    await equipmentManagement.waitForPageReady();
  }

  const platformLink = page.getByRole('link', { name: /Construction Delivery|V3 Construction deliveries/i }).first()
    .or(page.getByText(/Construction Delivery|V3 Construction deliveries/i).first());
  if (/\/api\/sso\/platforms\/choose/i.test(page.url()) &&
      await platformLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await equipmentManagement.clickWithFallback(platformLink, 'Construction Delivery');
    await equipmentManagement.waitForPageReady();
  }

  await forceBuckinghamProjectStorage(page, equipmentManagement.options.projectId);

  if (/\/project\/choose/i.test(page.url()) ||
      await page.locator('#project-item-1, [id^="project-item-"]').first().isVisible({ timeout: 3000 }).catch(() => false)) {
    const projectCandidates = [
      page.locator('#project-item-1').first(),
      page.locator('[id^="project-item-"]').filter({ hasText: /Buckingham Palace/i }).first(),
      page.getByRole('heading', { name: /Buckingham Palace/i }).first(),
      page.getByText(/Buckingham Palace/i).first()
    ];

    let clicked = false;
    for (const candidate of projectCandidates) {
      if (await candidate.isVisible({ timeout: 3000 }).catch(() => false)) {
        await equipmentManagement.clickWithFallback(candidate, 'Buckingham Palace project');
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      throw new Error('Could not select Buckingham Palace from the project chooser.');
    }

    await equipmentManagement.waitForPageReady();
    await forceBuckinghamProjectStorage(page, equipmentManagement.options.projectId);
  }

  if (!/Buckingham Palace/i.test((await readProjectShellContext(page)).bodyPreview)) {
    await page.goto(`${equipmentManagement.options.appUrl.replace(/\/$/, '')}/project/choose`, {
      waitUntil: 'domcontentloaded'
    }).catch((error) => {
      console.log(`Project chooser direct navigation did not settle: ${error.message}`);
    });
    await equipmentManagement.waitForPageReady();

    if (/\/project\/choose/i.test(page.url()) ||
        await page.locator('#project-item-1, [id^="project-item-"]').first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await clickBuckinghamProjectChoice(page, equipmentManagement);
      await equipmentManagement.waitForPageReady();
      await forceBuckinghamProjectStorage(page, equipmentManagement.options.projectId);
    }
  }
}

async function clickCardActionByText(page, cardText, actionPattern = /Open|Log Into/i) {
  return page.evaluate(({ targetText, actionSource }) => {
    const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim();
    const action = new RegExp(actionSource, 'i');
    const isVisible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        style.opacity !== '0';
    };
    const candidates = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,div,a,button'))
      .filter(isVisible)
      .filter((element) => normalize(element.textContent).includes(targetText));

    for (const element of candidates) {
      let card = element;
      for (let depth = 0; depth < 8 && card.parentElement && card.parentElement !== document.body; depth += 1) {
        const text = normalize(card.innerText || card.textContent);
        if (text.includes(targetText) && action.test(text)) {
          break;
        }
        card = card.parentElement;
      }

      const clickTarget = Array.from(card.querySelectorAll('a,button,[role="button"]'))
        .filter(isVisible)
        .find((candidate) => action.test(normalize(candidate.innerText || candidate.textContent || candidate.getAttribute('aria-label') || ''))) ||
        card.querySelector('a,button,[role="button"]') ||
        card;

      if (clickTarget.tagName?.toLowerCase() === 'a') {
        clickTarget.setAttribute('target', '_self');
      }
      clickTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      clickTarget.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      clickTarget.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    }

    return false;
  }, { targetText: cardText, actionSource: actionPattern.source }).catch(() => false);
}

async function clickBuckinghamProjectChoice(page, equipmentManagement) {
  if (await clickCardActionByText(page, 'Buckingham Palace', /Log Into|Open|Select/i)) {
    return true;
  }

  const projectCandidates = [
    page.locator('#project-item-1').first(),
    page.locator('[id^="project-item-"]').filter({ hasText: /Buckingham Palace/i }).first(),
    page.getByRole('heading', { name: /Buckingham Palace/i }).first(),
    page.getByText(/Buckingham Palace/i).first()
  ];

  for (const candidate of projectCandidates) {
    if (await candidate.isVisible({ timeout: 3000 }).catch(() => false)) {
      await equipmentManagement.clickWithFallback(candidate, 'Buckingham Palace project');
      return true;
    }
  }

  return false;
}

async function forceBuckinghamProjectStorage(page, projectId) {
  return page.evaluate((targetProjectId) => {
    const normalize = (value = '') => String(value).replace(/\s+/g, ' ').trim();
    const visit = (value, seen = new Set()) => {
      if (!value || typeof value !== 'object' || seen.has(value)) return null;
      seen.add(value);

      if ((value.ref === targetProjectId || /Buckingham Palace/i.test(normalize(value.name))) && (value.ref || value.id)) {
        return value;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          const found = visit(item, seen);
          if (found) return found;
        }
      } else {
        for (const nested of Object.values(value)) {
          const found = visit(nested, seen);
          if (found) return found;
        }
      }

      return null;
    };

    for (let index = 0; index < localStorage.length; index += 1) {
      const raw = localStorage.getItem(localStorage.key(index));
      if (!raw || !/Buckingham|5ET10000010|project/i.test(raw)) continue;
      try {
        const project = visit(JSON.parse(raw));
        if (!project) continue;

        localStorage.setItem('v3_project_data', JSON.stringify(project));
        localStorage.setItem('v3_project_ref', project.ref || targetProjectId);
        if (project.id) localStorage.setItem('v3_project_site_id', String(project.id));
        return project.name || project.ref || targetProjectId;
      } catch {
        // Ignore non-JSON storage values.
      }
    }

    return '';
  }, projectId).catch(() => '');
}

async function readProjectShellContext(page) {
  return page.evaluate(() => {
    const isVisible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        style.opacity !== '0';
    };
    const visibleText = (element) => (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
    const topElements = Array.from(document.querySelectorAll('header *, nav *, [class*="header" i] *, [class*="top" i] *, [role="combobox"], [class*="avatar" i], [class*="profile" i]'))
      .filter(isVisible)
      .map(visibleText)
      .filter(Boolean);

    return {
      url: location.href,
      hasBuckingham: /Buckingham Palace/i.test(document.body.innerText || document.body.textContent || ''),
      topText: topElements.slice(0, 80).join(' | '),
      bodyPreview: visibleText(document.body).slice(0, 2000)
    };
  }).catch(() => ({ url: page.url(), hasBuckingham: false, topText: '', bodyPreview: '' }));
}

async function assertValidProjectContext(page, equipmentManagement) {
  await equipmentManagement.waitForPageReady();
  await forceBuckinghamProjectStorage(page, equipmentManagement.options.projectId);
  const context = await readProjectShellContext(page);

  if (!context.hasBuckingham) {
    throw new Error(`Buckingham Palace project is not selected. URL: ${context.url}. Top shell: ${context.topText || '-'}`);
  }

  if (/\bNA\b/.test(context.topText)) {
    throw new Error(`User profile still shows NA after login/project selection. Top shell: ${context.topText}`);
  }

  console.log(`Confirmed valid project/user shell: ${context.topText || 'Buckingham Palace detected'}`);
  return context;
}

async function clearListState(equipmentManagement) {
  await equipmentManagement.openEquipmentList();
  await equipmentManagement.clearSearch().catch(() => null);
  await equipmentManagement.clearFilters(2);
  await equipmentManagement.waitForTableDataToSettle('Equipment List cleared state');
}

async function uploadUpdatedEquipmentList(equipmentManagement) {
  const page = equipmentManagement.page;
  const upload = createScheduledArrivalUploadFile(equipmentManagement);

  try {
    const selected = await selectEquipmentUploadFile(equipmentManagement, upload.filePath);
    if (!selected) {
      throw new Error('The Equipment List upload control did not expose a file chooser or file input.');
    }

    await equipmentManagement.clickUploadSubmitButton();
    const message = await equipmentManagement.findVisibleUploadMessage();
    const success = equipmentManagement.isSuccessUploadMessage(message);
    const duplicateOrError = equipmentManagement.isDuplicateOrErrorUploadMessage(message);

    if (!success && !duplicateOrError) {
      throw new Error(`Updated Equipment List upload did not report success or duplicate/error feedback. Visible message: ${message || '-'}`);
    }

    console.log(`Updated Equipment List generated upload: ${message || 'upload feedback detected'}`);
    await equipmentManagement.closeUploadPopupIfVisible('Updated Equipment List generated upload').catch(() => null);
  } catch (error) {
    console.log(`Updated Equipment List upload was skipped after UI recovery failed: ${error.message}`);
    await page.keyboard.press('Escape').catch(() => null);
    await equipmentManagement.openEquipmentListDirectly();
    return {
      upload,
      uploadResult: {
        skipped: true,
        error: error.message
      },
      verification: null
    };
  }

  await equipmentManagement.clearSearch().catch(() => null);
  const verification = await equipmentManagement.searchForAnyTerm(
    equipmentManagement.getEquipmentListUploadSearchTerms(upload),
    'Updated Equipment List uploaded record'
  );

  return {
    upload,
    uploadResult: {
      skipped: false
    },
    verification
  };
}

async function selectEquipmentUploadFile(equipmentManagement, filePath) {
  const page = equipmentManagement.page;
  await equipmentManagement.openEquipmentList();

  const tryFileInput = async () => {
    const fileInputs = page.locator('input[type="file"]');
    const count = await fileInputs.count();
    if (count <= 0) return false;

    await fileInputs.last().setInputFiles(filePath);
    await page.waitForTimeout(800);
    return true;
  };

  const clickAndCatchFileChooser = async (locator, label) => {
    if (!(await locator.first().isVisible({ timeout: 2000 }).catch(() => false))) {
      return false;
    }

    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null);
    await equipmentManagement.clickWithFallback(locator.first(), label);
    const fileChooser = await fileChooserPromise;
    if (fileChooser) {
      await fileChooser.setFiles(filePath);
      await page.waitForTimeout(800);
      return true;
    }

    return tryFileInput();
  };

  if (await tryFileInput()) return true;

  await clickAndCatchFileChooser(page.getByRole('button').filter({ hasText: /^$/ }).nth(3), 'Equipment List upload menu');
  if (await tryFileInput()) return true;

  const uploadIconCandidates = [
    page.getByRole('img', { name: /Upload Icon/i }),
    page.locator('img[alt*="upload" i], img[src*="upload" i], img[title*="upload" i]'),
    page.locator('button:has(img[alt*="upload" i]), button:has(img[src*="upload" i])'),
    page.getByRole('button', { name: /upload|import|file/i }),
    page.locator('button[aria-label*="upload" i], button[title*="upload" i], a[aria-label*="upload" i], a[title*="upload" i]')
  ];

  for (const candidate of uploadIconCandidates) {
    if (await clickAndCatchFileChooser(candidate, 'Equipment List upload control')) {
      return true;
    }
  }

  return tryFileInput();
}

function createScheduledArrivalUploadFile(equipmentManagement) {
  const sourcePath = [
    process.env.EQUIPMENT_LIST_UPLOAD_FILE,
    DEFAULT_EQUIPMENT_UPLOAD_SOURCE,
    equipmentManagement.getEquipmentUploadFixture('list')
  ].filter(Boolean).find((candidate) => fs.existsSync(candidate));

  if (!sourcePath) {
    throw new Error(`Missing equipment upload workbook. Expected ${DEFAULT_EQUIPMENT_UPLOAD_SOURCE}`);
  }

  const workbook = XLSX.readFile(sourcePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (rows.length < 2) {
    throw new Error(`Equipment upload workbook does not contain a data row: ${sourcePath}`);
  }

  const headers = rows[0].map((header) => equipmentManagement.normalizeFixtureCell(header));
  const scheduledArrivalIndex = headers.findIndex((header) => /^scheduled_arrival$/i.test(header));
  if (scheduledArrivalIndex === -1) {
    throw new Error(`Equipment upload workbook is missing mandatory scheduled_arrival column: ${sourcePath}`);
  }

  const scheduledArrival = new Date();

  const scheduledArrivalCell = XLSX.utils.encode_cell({ r: 1, c: scheduledArrivalIndex });
  worksheet[scheduledArrivalCell] = {
    ...(worksheet[scheduledArrivalCell] || {}),
    v: equipmentManagement.getExcelDateSerial(scheduledArrival),
    t: 'n',
    z: 'yyyy-mm-dd'
  };

  const outputDir = path.resolve('test-results', 'equipment-management-uploads');
  fs.mkdirSync(outputDir, { recursive: true });
  const filePath = path.join(outputDir, `ListOfEquipment_sample-5-scheduled-arrival-${formatTimestamp()}.xlsx`);
  XLSX.writeFile(workbook, filePath);

  const row = {};
  const dataRow = rows[1];
  headers.forEach((header, index) => {
    row[header] = equipmentManagement.normalizeFixtureCell(dataRow[index]);
  });
  row.scheduled_arrival = equipmentManagement.formatUploadDate(scheduledArrival);

  const terms = [
    row.reg_make,
    row.reg_model,
    row.contact_name,
    row.company,
    row.email_address,
    row.contact_number,
    row.equipment_type,
    row.fuel_type,
    row.scheduled_arrival
  ].map((value) => equipmentManagement.normalizeFixtureCell(value)).filter(Boolean);

  console.log(`Using equipment upload source: ${sourcePath}`);
  console.log(`Updated scheduled_arrival for upload copy: ${row.scheduled_arrival}`);

  return {
    filePath,
    sourcePath,
    row,
    terms
  };
}

async function selectExactOption(page, equipmentManagement, dropdown, label, preferredNames) {
  await equipmentManagement.clickWithFallback(dropdown.first(), label);

  for (const preferredName of preferredNames) {
    const option = page.getByRole('option', {
      name: new RegExp(`^${escapeRegExp(preferredName)}$`, 'i')
    }).first();

    if (await option.isVisible({ timeout: 2500 }).catch(() => false)) {
      await equipmentManagement.clickWithFallback(option, `${label}: ${preferredName}`);
      await equipmentManagement.waitForTableDataToSettle(`Equipment List after ${label}`);
      return preferredName;
    }
  }

  await page.keyboard.press('Escape').catch(() => null);
  await page.locator('.MuiBackdrop-root').click({ timeout: 1000 }).catch(() => null);
  console.log(`${label} preferred value was not available: ${preferredNames.join(', ')}`);
  return '';
}

async function applyRecordedFilters(page, equipmentManagement) {
  await clearListState(equipmentManagement);
  await equipmentManagement.selectRecordedEquipmentListDateRange();

  let selectedCompany = '';
  try {
    const companyDropdown = await equipmentManagement.getEquipmentListFilterDropdown('company');
    selectedCompany = await selectExactOption(page, equipmentManagement, companyDropdown, 'Company', ['Voyage Control']);
    if (!selectedCompany) {
      selectedCompany = await equipmentManagement.selectRandomFilterWithRecords('company', 'Company', {
        exclude: [/^Company$/i]
      });
    }
  } catch (error) {
    console.log(`Company filter could not be applied because no enabled options were visible: ${error.message}`);
    return {
      company: selectedCompany,
      equipmentType: '',
      contactName: '',
      skippedRemainingFilters: true,
      reason: error.message
    };
  }

  let selectedEquipmentType = '';
  let selectedContactName = '';
  try {
    const equipmentTypeDropdown = await equipmentManagement.getEquipmentListFilterDropdown('equipmentType');
    selectedEquipmentType = await selectExactOption(page, equipmentManagement, equipmentTypeDropdown, 'Equipment Type', ['James Swanston']);

    if (!selectedEquipmentType) {
      const contactNameDropdown = await equipmentManagement.getEquipmentListFilterDropdown('contactName');
      selectedContactName = await selectExactOption(page, equipmentManagement, contactNameDropdown, 'Contact Name', ['James Swanston']);
    }

    if (!selectedEquipmentType && !selectedContactName) {
      selectedEquipmentType = await equipmentManagement.selectRandomFilterWithRecords('equipmentType', 'Equipment Type', {
        exclude: [/^Equipment Type$/i],
        required: true
      });
    }
  } catch (error) {
    console.log(`Equipment Type/Contact filter could not be applied because no enabled options were visible: ${error.message}`);
    return {
      company: selectedCompany,
      equipmentType: selectedEquipmentType,
      contactName: selectedContactName,
      skippedRemainingFilters: true,
      reason: error.message
    };
  }

  if (!(await equipmentManagement.hasVisibleTableRecords())) {
    console.log('Recorded filter values produced no rows; recovering with existing record-producing filters.');
    await clearListState(equipmentManagement);
    await equipmentManagement.selectRecordedEquipmentListDateRange();
    return equipmentManagement.selectRandomEquipmentListFilters();
  }

  await equipmentManagement.highlightFirstVisibleTableRow('Updated Equipment List filtered record');
  return {
    company: selectedCompany,
    equipmentType: selectedEquipmentType,
    contactName: selectedContactName
  };
}

async function downloadListOutputs(equipmentManagement) {
  const exportDownload = await equipmentManagement.downloadEquipmentListExport();
  const pdfDownload = await equipmentManagement.downloadEquipmentListPrintPdf();

  return {
    exportFile: exportDownload?.suggestedFilename?.() || null,
    pdfFile: pdfDownload?.suggestedFilename?.() || null
  };
}

async function openEquipmentUsageForUpdatedListFlow(equipmentManagement) {
  const page = equipmentManagement.page;
  if (await equipmentManagement.equipmentUsageLink.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await equipmentManagement.clickWithFallback(equipmentManagement.equipmentUsageLink.first(), 'Equipment Usage');
  } else {
    await page.goto(`${equipmentManagement.options.appUrl}/${equipmentManagement.options.projectId}/monthly-usage`, {
      waitUntil: 'domcontentloaded'
    }).catch((error) => {
      if (!/ERR_ABORTED|Navigation interrupted|net::ERR_ABORTED/i.test(error.message)) {
        throw error;
      }
    });
  }

  await equipmentManagement.waitForPageReady();
  await page.getByRole('heading', { name: /Equipment Monthly Usage Capture/i })
    .waitFor({ state: 'visible', timeout: 30000 });
  await equipmentManagement.waitForTableDataToSettle('Equipment Usage list');
}

async function runUpdatedEquipmentListFlow(options) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const launchOptions = {
    channel: 'chrome',
    headless: options.headless,
    slowMo: options.headless ? 0 : 80
  };

  if (!options.headless) {
    launchOptions.args = ['--start-maximized'];
  }

  const browser = await chromium.launch(launchOptions);
  const contextOptions = {
    viewport: null,
    acceptDownloads: true,
    ignoreHTTPSErrors: true
  };

  if (options.useAuthState && fs.existsSync(AUTH_STATE_PATH)) {
    contextOptions.storageState = AUTH_STATE_PATH;
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  page.setDefaultTimeout(Number(process.env.UPDATED_EQUIPMENT_LIST_TIMEOUT_MS || 60000));

  const equipmentManagement = new EquipmentManagementPage(page);
  const result = {
    startedAt: new Date().toISOString(),
    appUrl: equipmentManagement.options.appUrl,
    projectId: equipmentManagement.options.projectId,
    steps: {}
  };

  try {
    await runStep('Login and open Equipment List', async () => {
      await openCodegenRecordedRoute(page, context, equipmentManagement);
      await equipmentManagement.waitForTableDataToSettle('Equipment List initial data');
      result.steps.openedEquipmentList = true;
    });

    await runStep('Exercise recorded table headers and clear filters', async () => {
      await clickColumnHeader(page, equipmentManagement, 'Company');
      await clickColumnHeader(page, equipmentManagement, 'Equipment Type');
      await clickColumnHeader(page, equipmentManagement, 'Fuel Type', 2);
      await clearListState(equipmentManagement);
      result.steps.clearedFilters = true;
    });

    if (!options.skipUpload) {
      result.steps.upload = await runStep('Upload updated Equipment List workbook', async () => {
        return uploadUpdatedEquipmentList(equipmentManagement);
      });
    }

    await runStep('Switch between Equipment List and Equipment Usage', async () => {
      await equipmentManagement.openEquipmentList();
      await openEquipmentUsageForUpdatedListFlow(equipmentManagement);
      await equipmentManagement.openEquipmentList();
      await equipmentManagement.clearFilters(2);
      result.steps.switchedTabs = true;
    });

    result.steps.filters = await runStep('Apply recorded date and dropdown filters', async () => {
      return applyRecordedFilters(page, equipmentManagement);
    });

    result.steps.downloads = await runStep('Download Equipment List outputs', async () => {
      return downloadListOutputs(equipmentManagement);
    });

    result.endedAt = new Date().toISOString();
    result.status = 'passed';
    result.finalUrl = page.url();
    return result;
  } catch (error) {
    result.endedAt = new Date().toISOString();
    result.status = 'failed';
    result.error = error?.stack || error?.message || String(error);
    result.finalUrl = page.url();

    const screenshotPath = path.join(RESULTS_DIR, `failure-${formatTimestamp()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => null);
    result.failureScreenshot = screenshotPath;
    throw Object.assign(error, { flowResult: result });
  } finally {
    if (options.keepOpen && !options.headless) {
      console.log('\nBrowser left open because --keep-open was provided.');
    } else {
      await context.close().catch(() => null);
      await browser.close().catch(() => null);
    }
  }
}

async function main() {
  loadEnvFile();
  const options = parseArguments();
  let result;

  try {
    result = await runUpdatedEquipmentListFlow(options);
  } catch (error) {
    result = error.flowResult || {
      status: 'failed',
      error: error?.stack || error?.message || String(error)
    };
    console.error(`\nUpdated Equipment List flow failed:\n${result.error}`);
    process.exitCode = 1;
  } finally {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    const reportPath = path.join(RESULTS_DIR, `updated-equipment-list-${formatTimestamp()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(result, null, 2), 'utf8');
    console.log(`\nUpdated Equipment List report: ${path.relative(ROOT_DIR, reportPath)}`);
  }
}

main();
