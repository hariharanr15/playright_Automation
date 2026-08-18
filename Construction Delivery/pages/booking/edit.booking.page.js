const fs = require('fs');
const path = require('path');
const { checkHighlighted, clickHighlighted, fillHighlighted, highlight } = require('../../utils/highlight');
const { projectManagementBookingPreferences } = require('../../utils/project-management-setup-state');
const { DashboardPage } = require('./dashboard.page');

class EditBookingPage {
  constructor(page, options = {}) {
    this.page = page;
    this.options = options;

    // Login elements
    this.emailInput = page.getByRole('textbox', { name: 'Email:' });
    this.passwordInput = page.getByRole('textbox', { name: 'Password:' });
    this.loginButton = page.getByRole('button', { name: 'Login', exact: true });

    // Navigation elements
    this.projectLink = page.getByRole('link', { name: /Construction Delivery|V3 Construction deliveries/i });
    this.locationHeading = page.getByRole('heading', { name: 'Buckingham Palace' });
    this.bookingListLink = page.getByRole('link', { name: 'booking_list Booking List' });

    // Booking list elements
    this.layoutDropdown = page.locator('div').filter({ hasText: /^Layout 1 Value$/ }).first();
    this.defaultViewOption = page.getByRole('option', { name: 'Default View' });
    
    // Booking action elements
    this.checkInButton = page.getByRole('button', { name: 'Check In' });
    this.checkOutButton = page.getByRole('button', { name: 'Check Out' });
    this.undoButton = page.getByRole('button', { name: 'Undo' });
    this.confirmYesButton = page.getByRole('button', { name: 'Yes' });
    this.sideBarModalButton = page.locator('.btn.side-bar-modal-btn');
  }

  async login() {
    const baseUrl = process.env.BASE_URL || 'https://stg-login.voyagecontrol.com';
    const email = process.env.VC_EMAIL || 'priyanka.dl@neuralrays.ai';
    const password = process.env.VC_PASSWORD || '2C@53WsTQ#&ffSQ&';

    console.log('🔐 Logging into the application...');
    
    await this.page.goto(`${baseUrl}/api/sso/users/login/`, { waitUntil: 'domcontentloaded' });

    const emailField = this.page.getByRole('textbox', { name: 'Email:' });
    if (await emailField.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailField.fill(email);
      await this.page.getByRole('textbox', { name: 'Password:' }).fill(password);
      await this.page.getByRole('button', { name: 'Login', exact: true }).click();
      await this.page.waitForLoadState('domcontentloaded');
    }
    
    console.log('✅ Login completed');
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

  async waitForPageState(locator, label, timeout = 30000) {
    await Promise.race([
      this.page.waitForLoadState('domcontentloaded').catch(() => null),
      this.page.waitForTimeout(1500)
    ]);

    await locator.waitFor({ state: 'visible', timeout }).catch(() => {
      throw new Error(`${label} did not load`);
    });
  }

  async navigateToProject() {
    console.log('🏗️ Selecting project...');
    
    const projectCandidates = [
      { locator: this.page.getByRole('link', { name: /Construction Delivery|V3 Construction deliveries/i }), label: 'Project link', timeout: 10000 },
      { locator: this.page.getByText(/Construction Delivery|V3 Construction deliveries/i), label: 'Project text' },
      { locator: this.page.locator('a:has-text("Construction Delivery"), a:has-text("V3 Construction")'), label: 'Project fallback' },
      { locator: this.page.locator('[href*="construction"], [href*="v3"]'), label: 'Project href' }
    ];

    await this.clickFirstVisible(projectCandidates, 'Could not click on any project link');
    await this.waitForPageState(this.locationHeading, 'Location page');
    
    console.log('✅ Project selected');
  }

  async selectLocation() {
    console.log('📍 Selecting location...');
    
    const locationCandidates = [
      { locator: this.page.getByRole('heading', { name: 'Buckingham Palace' }), label: 'Location heading', timeout: 10000 },
      { locator: this.page.getByText('Buckingham Palace').first(), label: 'Location text' },
      { locator: this.page.locator('[title*="Buckingham"], [alt*="Buckingham"]'), label: 'Location attribute' }
    ];

    await this.clickFirstVisible(locationCandidates, 'Could not click on any location');
    await this.waitForPageState(this.bookingListLink, 'Booking menu');
    
    console.log('✅ Location selected');
  }

  async navigateToBookingListViaDashboard() {
    console.log('📋 Navigating to booking list via dashboard...');
    
    const dashboard = new DashboardPage(this.page);
    await dashboard.selectProject();
    await dashboard.selectLocation();
    await dashboard.goToBookings();
    
    await this.applyDefaultViewFilter();
    
    console.log('✅ Booking list loaded');
  }

  async navigateToBookingList() {
    console.log('📋 Navigating to booking list...');
    
    await clickHighlighted(this.bookingListLink, 'Booking List');
    
    await this.applyDefaultViewFilter();
    
    console.log('✅ Booking list loaded');
  }

  async openScheduledTab() {
    console.log('Opening Scheduled booking tab...');

    const scheduledTabCandidates = [
      this.page.getByText(/^Scheduled\s+\d+$/).first(),
      this.page.locator('button:has-text("Scheduled"), a:has-text("Scheduled")').first(),
      this.page.locator('text=Scheduled').first()
    ];

    for (const scheduledTab of scheduledTabCandidates) {
      if (await scheduledTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await clickHighlighted(scheduledTab, 'Scheduled tab');
        await this.page.waitForTimeout(1500);
        console.log('Scheduled booking tab opened');
        return;
      }
    }

    throw new Error('Could not find the Scheduled tab on the booking list page.');
  }

  async applyDefaultViewFilter() {
    console.log('Applying Default View filter...');

    const layoutCandidates = [
      this.layoutDropdown,
      this.page.getByRole('combobox').filter({ hasText: /Layout|View|Value/i }).first(),
      this.page.locator('div').filter({ hasText: /^Layout\s+\d+\s+Value$/ }).first(),
      this.page.locator('button:has-text("Layout"), [role="button"]:has-text("Layout")').first()
    ];

    for (const layoutDropdown of layoutCandidates) {
      if (await layoutDropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
        await clickHighlighted(layoutDropdown, 'Layout dropdown');

        const defaultViewCandidates = [
          this.defaultViewOption,
          this.page.getByRole('option', { name: /Default View/i }).first(),
          this.page.getByText('Default View', { exact: true }).first(),
          this.page.locator('[role="option"]:has-text("Default View"), li:has-text("Default View")').first()
        ];

        for (const defaultViewOption of defaultViewCandidates) {
          if (await defaultViewOption.isVisible({ timeout: 3000 }).catch(() => false)) {
            await clickHighlighted(defaultViewOption, 'Default View');
            await this.page.waitForTimeout(1500);
            console.log('Default View filter applied');
            return true;
          }
        }

        await this.page.keyboard.press('Escape').catch(() => null);
      }
    }

    console.log('Default View filter was not visible; continuing with current view.');
    return false;
  }

  addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  addMonths(date, months) {
    const result = new Date(date);
    const dayOfMonth = result.getDate();

    result.setMonth(result.getMonth() + months);

    if (result.getDate() !== dayOfMonth) {
      result.setDate(0);
    }

    return result;
  }

  formatBookingListDate(date) {
    const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear();

    return `${date.getDate()}, ${weekday} ${month} ${year}`;
  }

  getDefaultBookingListDateRange(referenceDate = new Date()) {
    return {
      fromDate: this.addDays(referenceDate, 1),
      toDate: this.addMonths(referenceDate, 1)
    };
  }

  async applyBookingListDateRange(options = {}) {
    const referenceDate = options.referenceDate ?? new Date();
    const { fromDate, toDate } = this.getDefaultBookingListDateRange(referenceDate);
    const fromDateText = options.fromDateText ?? this.formatBookingListDate(fromDate);
    const toDateText = options.toDateText ?? this.formatBookingListDate(toDate);

    console.log(`Applying Booking List date range: ${fromDateText} to ${toDateText}`);

    const dateInputs = this.page.locator('input[placeholder="d, ddd mmm yyyy"]');
    await dateInputs.first().waitFor({ state: 'visible', timeout: 10000 });

    if (await dateInputs.count() < 2) {
      throw new Error('Could not find both From and To date fields on the Booking List page.');
    }

    await fillHighlighted(dateInputs.nth(0), fromDateText, 'From date');
    await this.page.keyboard.press('Enter').catch(() => null);
    await this.page.keyboard.press('Escape').catch(() => null);

    await fillHighlighted(dateInputs.nth(1), toDateText, 'To date');
    await this.page.keyboard.press('Enter').catch(() => null);
    await this.page.keyboard.press('Escape').catch(() => null);

    const filterButton = this.page.locator('button:has-text("Filter"), .filter-btn').first();
    await clickHighlighted(filterButton, 'Filter');
    await this.waitForBookingListToLoad();

    console.log('Booking List date range applied');
  }

  async selectBookingById(bookingId) {
    console.log(`🎯 Selecting booking: ${bookingId}`);
    
    // First, close any open modals that might interfere
    await this.closeAnyOpenModals();
    
    // Try multiple strategies to select the booking
    const selectionStrategies = [
      // Strategy 1: Standard cell selection
      async () => {
        const bookingCell = this.page.getByRole('cell', { name: bookingId });
        await clickHighlighted(bookingCell, `Booking ${bookingId}`);
        return true;
      },
      // Strategy 2: Force click on cell
      async () => {
        const bookingCell = this.page.getByRole('cell', { name: bookingId });
        await bookingCell.click({ force: true });
        return true;
      },
      // Strategy 3: Find and click using text content
      async () => {
        const bookingElement = this.page.locator(`text=${bookingId}`).first();
        await bookingElement.click({ force: true });
        return true;
      },
      // Strategy 4: JavaScript click
      async () => {
        return await this.page.evaluate((id) => {
          const elements = Array.from(document.querySelectorAll('*'));
          const bookingElement = elements.find(el => el.textContent && el.textContent.includes(id));
          if (bookingElement) {
            bookingElement.click();
            return true;
          }
          return false;
        }, bookingId);
      }
    ];
    
    let success = false;
    for (const strategy of selectionStrategies) {
      try {
        const result = await strategy();
        if (result) {
          await this.page.waitForTimeout(1000);
          success = true;
          break;
        }
      } catch (error) {
        console.log(`Booking selection strategy failed: ${error.message}`);
        // Close any modals that might have opened and try again
        await this.closeAnyOpenModals();
      }
    }
    
    if (!success) {
      throw new Error(`Failed to select booking ${bookingId} with all strategies`);
    }
    
    console.log(`✅ Booking ${bookingId} selected`);
  }

  async selectFirstAvailableBooking() {
    console.log('🔍 Looking for first available booking to edit...');
    
    // Wait for the booking list to load and verify it's populated
    await this.waitForBookingListToLoad();
    await this.throwIfBookingListIsEmpty();
    
    // Try to find any booking with a booking ID pattern
    const firstBooking = await this.page.evaluate(() => {
      // Look for booking IDs in various table structures
      const selectors = [
        'table tbody tr',
        'tr',
        '.booking-row',
        '.table-row',
        '[class*="row"]',
        'div[role="row"]'
      ];
      for (const selector of selectors) {
        const rows = Array.from(document.querySelectorAll(selector));
        console.log(`Checking ${rows.length} rows with selector: ${selector}`);
        
        for (const row of rows) {
          const text = row.innerText || row.textContent || '';
          
          // Look for booking ID pattern (like BK5ET10000003763)
          const bookingIdMatch = text.match(/BK[A-Z0-9]{10,}/);
          if (bookingIdMatch) {
            const bookingId = bookingIdMatch[0];
            console.log(`Found booking ID: ${bookingId} in text: ${text.substring(0, 100)}`);
            
            return {
              bookingId: bookingId,
              rowText: text.substring(0, 200),
              selector: selector
            };
          }
        }
      }
      
      // If no booking ID pattern found, look for any cell that might contain a booking reference
      const cells = Array.from(document.querySelectorAll('td, th, .cell, [role="cell"]'));
      console.log(`Checking ${cells.length} cells for booking references`);
      
      for (const cell of cells) {
        const text = cell.innerText || cell.textContent || '';
        if (text && text.length > 5 && text.length < 50) {
          // Look for any alphanumeric pattern that might be a booking ID
          const possibleId = text.match(/[A-Z]{2}[A-Z0-9]{8,}/);
          if (possibleId) {
            console.log(`Found possible booking ID: ${possibleId[0]} in cell: ${text}`);
            return {
              bookingId: possibleId[0],
              rowText: text,
              selector: 'cell'
            };
          }
        }
      }
      
      return null;
    });

    if (!firstBooking) {
      // Debug: Let's see what's actually on the page
      await this.debugBookingListContent();
      throw new Error('No bookings found in the list');
    }
    
    console.log(`📋 Found booking: ${firstBooking.bookingId}`);
    console.log(`📝 Row preview: ${firstBooking.rowText}`);
    console.log(`🔍 Found using selector: ${firstBooking.selector}`);
    
    // Select the booking by ID
    await this.selectBookingById(firstBooking.bookingId);
    
    return firstBooking.bookingId;
  }

  async selectFirstScheduledBooking() {
    const booking = await this.selectFirstBookingByStatus(['Scheduled']);
    return booking.bookingId;
  }

  async findFirstBookingByStatus(statuses = []) {
    await this.waitForBookingListToLoad();
    await this.throwIfBookingListIsEmpty();

    const normalizedStatuses = statuses.map((status) => status.toLowerCase());

    return await this.page.evaluate((targetStatuses) => {
      const statusPatterns = [
        { name: 'Checked In', normalized: 'checked in', pattern: /\bChecked\s*-?\s*In\b/i },
        { name: 'Scheduled', normalized: 'scheduled', pattern: /\bScheduled\b/i },
        { name: 'Checked Out', normalized: 'checked out', pattern: /\bChecked\s*-?\s*Out\b/i }
      ];

      const selectors = [
        'table tbody tr',
        'tr',
        '.booking-row',
        '.table-row',
        'div[role="row"]',
        '[class*="row"]'
      ];

      const detectStatus = (text) => {
        const detected = statusPatterns.find((status) => status.pattern.test(text));
        return detected || null;
      };

      const detectVehicleCount = (row, bookingId) => {
        const cellTexts = Array.from(row.querySelectorAll('td, [role="cell"]'))
          .map((cell) => (cell.innerText || cell.textContent || '').trim())
          .filter(Boolean);
        const bookingIndex = cellTexts.findIndex((text) => text.includes(bookingId));
        const cellsBeforeBooking = bookingIndex === -1 ? cellTexts : cellTexts.slice(0, bookingIndex);
        const numericCells = cellsBeforeBooking
          .map((text) => text.match(/^\d+$/) ? Number(text) : null)
          .filter((value) => value !== null);

        return numericCells.length > 0 ? numericCells[numericCells.length - 1] : null;
      };

      const seenBookingIds = new Set();
      const bookings = [];

      for (const selector of selectors) {
        const rows = Array.from(document.querySelectorAll(selector));

        for (const row of rows) {
          const text = row.innerText || row.textContent || '';
          const bookingIdMatch = text.match(/BK[A-Z0-9]{10,}/);

          if (!bookingIdMatch) {
            continue;
          }

          const bookingId = bookingIdMatch[0];
          if (seenBookingIds.has(bookingId)) {
            continue;
          }

          const status = detectStatus(text);
          if (!status) {
            continue;
          }
          const vehicleCount = detectVehicleCount(row, bookingId);

          seenBookingIds.add(bookingId);
          bookings.push({
            bookingId,
            status: status.name,
            normalizedStatus: status.normalized,
            rowText: text.substring(0, 240),
            selector,
            vehicleCount
          });
        }
      }

      if (bookings.length === 0) {
        return null;
      }

      const targetBookings = bookings.filter((booking) => targetStatuses.includes(booking.normalizedStatus));
      return targetBookings.find((booking) => booking.vehicleCount === 1) || targetBookings[0] || null;
    }, normalizedStatuses);
  }

  async selectFirstBookingByStatus(statuses = []) {
    console.log(`Looking for first booking with status: ${statuses.join(' or ')}`);

    const booking = await this.findFirstBookingByStatus(statuses);

    if (!booking) {
      await this.debugBookingListContent();
      throw new Error(`No booking found with status: ${statuses.join(' or ')}`);
    }

    console.log(`Found ${booking.status} booking: ${booking.bookingId}`);
    console.log(`Row preview: ${booking.rowText}`);

    await this.selectBookingById(booking.bookingId);
    return booking;
  }

  async selectFirstCheckedInOrScheduledBooking() {
    return await this.selectFirstBookingByStatus(['Checked In', 'Scheduled']);
  }

  async selectFirstCheckedInBooking() {
    return await this.selectFirstBookingByStatus(['Checked In']);
  }

  // Keep the original method for backward compatibility
  async selectFirstCheckInBooking() {
    console.log('🔄 Redirecting to selectFirstScheduledBooking for better compatibility...');
    return await this.selectFirstScheduledBooking();
  }

  // Fallback method to create a demo booking for testing
  async createDemoBookingIfNeeded() {
    console.log('🔧 Attempting to create a demo booking for testing...');
    
    try {
      const newBookingButton = this.page.getByRole('link', { name: 'New Booking' });
      if (await newBookingButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('📝 Creating a new demo booking...');
        await clickHighlighted(newBookingButton, 'New Booking');
        
        // Wait for booking form to load
        await this.page.waitForTimeout(3000);
        
        // This would need to be customized based on the actual booking form
        console.log('⚠️ Demo booking creation would require form completion - skipping for now');
        
        // Navigate back to booking list
        await this.page.goBack();
        await this.waitForBookingListToLoad();
        
        return false;
      }
    } catch (error) {
      console.log('❌ Could not create demo booking:', error.message);
      return false;
    }
    
    return false;
  }

  async waitForBookingListToLoad() {
    console.log('⏳ Waiting for booking list to load...');
    
    // Wait for common booking list indicators
    const indicators = [
      this.page.locator('table'),
      this.page.locator('.booking-list'),
      this.page.locator('[role="table"]'),
      this.page.locator('tbody tr'),
      this.page.getByText(/BK[A-Z0-9]+/)
    ];
    
    let loaded = false;
    for (const indicator of indicators) {
      if (await indicator.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('✅ Booking list indicator found');
        loaded = true;
        break;
      }
    }
    
    if (!loaded) {
      console.log('⚠️ No booking list indicators found, continuing anyway...');
    }
    
    // Additional wait for content to populate
    await this.page.waitForTimeout(3000);
  }

  async findBookingDetailsActionButton(actionName, aliases = [], options = {}) {
    const timeout = options.timeout ?? 15000;
    const deadline = Date.now() + timeout;
    const bookingModal = this.page.locator('#myModal2');
    await bookingModal.waitFor({ state: 'visible', timeout: 10000 });

    const actionNames = [actionName, ...aliases];

    while (Date.now() < deadline) {
      const controls = bookingModal.locator('button, [role="button"], a');
      const count = await controls.count();

      for (let index = 0; index < count; index++) {
        const control = controls.nth(index);

        if (!await control.isVisible({ timeout: 500 }).catch(() => false)) {
          continue;
        }

        const label = await control.evaluate((element) => {
          return [
            element.innerText,
            element.textContent,
            element.getAttribute('title'),
            element.getAttribute('aria-label')
          ]
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        }).catch(() => '');

        const normalizedLabel = label.toLowerCase();
        const hasActionName = actionNames.some((name) => normalizedLabel.includes(name.toLowerCase()));

        if (hasActionName) {
          return control;
        }
      }

      await this.page.waitForTimeout(500);
    }

    return null;
  }

  async waitForBookingDetailsReady(timeout = 30000) {
    const bookingModal = this.page.locator('#myModal2');
    await bookingModal.waitFor({ state: 'visible', timeout: 10000 });

    await this.page.waitForFunction(
      () => {
        const modal = document.querySelector('#myModal2');
        if (!modal) {
          return false;
        }

        const text = modal.innerText || modal.textContent || '';
        const visibleBackdrops = Array.from(document.querySelectorAll('.MuiBackdrop-root, .modal-backdrop'))
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return rect.width > 0 &&
              rect.height > 0 &&
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              style.opacity !== '0';
          });

        const visibleLoaders = Array.from(modal.querySelectorAll('[role="progressbar"], .MuiCircularProgress-root, [class*="loader"], [class*="Loader"], [class*="spinner"], [class*="Spinner"]'))
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return rect.width > 0 &&
              rect.height > 0 &&
              style.display !== 'none' &&
              style.visibility !== 'hidden';
          });

        return text.includes('Booking Information') &&
          !/TRANSLATION\.UNDEFINED/i.test(text) &&
          visibleBackdrops.length === 0 &&
          visibleLoaders.length === 0;
      },
      null,
      { timeout }
    ).catch(() => null);

    await this.page.waitForTimeout(500);
  }

  async openBookingDetailsMoreMenu() {
    const bookingModal = this.page.locator('#myModal2');
    await bookingModal.waitFor({ state: 'visible', timeout: 10000 });

    const menuCandidates = [
      bookingModal.locator('[aria-haspopup="menu"], [aria-haspopup="true"]').last(),
      bookingModal.locator('.dropdown-toggle, [data-toggle="dropdown"], [data-bs-toggle="dropdown"]').last()
    ];

    for (const menuCandidate of menuCandidates) {
      if (await menuCandidate.isVisible({ timeout: 1000 }).catch(() => false)) {
        await menuCandidate.click({ force: true }).catch(() => null);
        await this.page.waitForTimeout(500);
        return true;
      }
    }

    return await bookingModal.evaluate((modal) => {
      const modalRect = modal.getBoundingClientRect();
      const controls = Array.from(modal.querySelectorAll('button, [role="button"], a'));
      const visibleControls = controls.filter((control) => {
        const rect = control.getBoundingClientRect();
        const style = window.getComputedStyle(control);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          rect.right > modalRect.right - 100 &&
          rect.top < modalRect.top + 120;
      });

      const target = visibleControls[visibleControls.length - 1];
      if (!target) {
        return false;
      }

      target.click();
      return true;
    }).catch(() => false);
  }

  async findOpenMenuActionButton(actionName, aliases = [], options = {}) {
    const timeout = options.timeout ?? 5000;
    const deadline = Date.now() + timeout;
    const actionNames = [actionName, ...aliases];

    while (Date.now() < deadline) {
      const controls = this.page.locator(
        '.dropdown-menu.show button, .dropdown-menu.show a, [role="menuitem"], button, [role="button"], a'
      );
      const count = await controls.count();

      for (let index = 0; index < count; index++) {
        const control = controls.nth(index);

        if (!await control.isVisible({ timeout: 500 }).catch(() => false)) {
          continue;
        }

        const label = await control.evaluate((element) => {
          return [
            element.innerText,
            element.textContent,
            element.getAttribute('title'),
            element.getAttribute('aria-label')
          ]
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        }).catch(() => '');

        const normalizedLabel = label.toLowerCase();
        if (actionNames.some((name) => normalizedLabel.includes(name.toLowerCase()))) {
          return control;
        }
      }

      await this.page.waitForTimeout(500);
    }

    return null;
  }

  async clickBookingDetailsAction(actionName, aliases = []) {
    await this.waitForBookingDetailsReady();

    let actionButton = await this.findBookingDetailsActionButton(actionName, aliases, { timeout: 5000 });

    if (!actionButton) {
      await this.openBookingDetailsMoreMenu();
      actionButton = await this.findOpenMenuActionButton(actionName, aliases, { timeout: 5000 });
    }

    if (!actionButton) {
      throw new Error(`Could not find ${actionName} action in booking details panel.`);
    }

    await actionButton.waitFor({ state: 'visible', timeout: 15000 });

    try {
      await highlight(actionButton, actionName);
      await actionButton.click({ force: true, timeout: 10000 });
    } catch (error) {
      console.log(`${actionName} force click failed, trying DOM click: ${error.message}`);
      await highlight(actionButton, actionName).catch(() => null);
      await actionButton.evaluate((element) => element.click());
    }

    await this.page.waitForTimeout(3000);
  }

  async clickBookingDetailsActionIfAvailable(actionName, aliases = []) {
    await this.waitForBookingDetailsReady();

    let actionButton = await this.findBookingDetailsActionButton(actionName, aliases, { timeout: 1500 });

    if (!actionButton) {
      await this.openBookingDetailsMoreMenu();
      actionButton = await this.findOpenMenuActionButton(actionName, aliases, { timeout: 1500 });
    }

    if (!actionButton) {
      await this.page.keyboard.press('Escape').catch(() => null);
      return false;
    }

    try {
      await highlight(actionButton, actionName);
      await actionButton.click({ force: true, timeout: 10000 });
    } catch (error) {
      console.log(`${actionName} force click failed, trying DOM click: ${error.message}`);
      await highlight(actionButton, actionName).catch(() => null);
      await actionButton.evaluate((element) => element.click());
    }

    await this.page.waitForTimeout(3000);
    return true;
  }

  async completeBookingDetailsAction(actionName, aliases = [], options = {}) {
    const maxClicks = options.maxClicks ?? 5;
    let clickCount = 0;

    for (let attempt = 0; attempt < maxClicks; attempt++) {
      await this.waitForBookingDetailsReady();
      const actionButton = await this.findBookingDetailsActionButton(actionName, aliases, {
        timeout: clickCount === 0 ? 15000 : 1000
      });

      if (!actionButton) {
        if (clickCount > 0) {
          return clickCount;
        }

        throw new Error(`Could not find ${actionName} action in booking details panel.`);
      }

      try {
        await highlight(actionButton, actionName);
        await actionButton.click({ force: true, timeout: 10000 });
      } catch (error) {
        console.log(`${actionName} force click failed, trying DOM click: ${error.message}`);
        await highlight(actionButton, actionName).catch(() => null);
        await actionButton.evaluate((element) => element.click());
      }

      clickCount++;
      await this.confirmIfPromptVisible(`Confirm ${actionName}`);
      await this.page.waitForTimeout(2500);
    }

    throw new Error(`${actionName} action was still visible after ${maxClicks} clicks.`);
  }

  async confirmIfPromptVisible(label = 'Confirm action') {
    const yesButtonCandidates = [
      this.confirmYesButton,
      this.page.getByRole('button', { name: 'Yes', exact: true }).first(),
      this.page.locator('button:has-text("Yes"), [role="button"]:has-text("Yes")').first()
    ];

    for (const yesButton of yesButtonCandidates) {
      if (await yesButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await clickHighlighted(yesButton, label);
        await this.page.waitForTimeout(1500);
        return true;
      }
    }

    return false;
  }

  async confirmUndoPromptVisible() {
    const thisBookingOnlyCandidates = [
      this.page.getByRole('button', { name: /This booking only/i }).first(),
      this.page.getByRole('menuitem', { name: /This booking only/i }).first(),
      this.page.getByRole('option', { name: /This booking only/i }).first(),
      this.page.locator(
        'button:has-text("This booking only"), [role="button"]:has-text("This booking only"), [role="menuitem"]:has-text("This booking only"), [role="option"]:has-text("This booking only")'
      ).first(),
      this.page.getByText(/This booking only/i).first()
    ];

    for (const thisBookingOnly of thisBookingOnlyCandidates) {
      if (await thisBookingOnly.isVisible({ timeout: 3000 }).catch(() => false)) {
        try {
          await clickHighlighted(thisBookingOnly, 'This booking only');
          await this.page.waitForTimeout(1500);
          return true;
        } catch (error) {
          console.log(`This booking only option failed: ${error.message}`);
        }
      }
    }

    return await this.confirmIfPromptVisible('Confirm Undo');
  }

  async findCancelBookingConfirmationButton(timeout = 10000) {
    const found = await this.page.waitForFunction(
      () => {
        document.querySelectorAll('[data-vc-cancel-booking-confirm="true"]').forEach((element) => {
          element.removeAttribute('data-vc-cancel-booking-confirm');
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

        const promptPattern = /cancel this booking|are you sure you want to cancel/i;
        const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
        const cancelButton = buttons.find((button) => {
          const text = (button.innerText || button.textContent || '').replace(/\s+/g, ' ').trim();
          if (!/^Cancel Booking$/i.test(text) ||
              !isVisible(button) ||
              button.disabled ||
              button.getAttribute('aria-disabled') === 'true') {
            return false;
          }

          let ancestor = button.parentElement;
          while (ancestor && ancestor !== document.body) {
            const ancestorText = ancestor.innerText || ancestor.textContent || '';
            if (promptPattern.test(ancestorText)) {
              return true;
            }
            ancestor = ancestor.parentElement;
          }

          return promptPattern.test(document.body.innerText || document.body.textContent || '');
        });

        if (cancelButton) {
          cancelButton.setAttribute('data-vc-cancel-booking-confirm', 'true');
          return true;
        }

        return false;
      },
      null,
      { timeout }
    ).then(() => true).catch(() => false);

    if (!found) {
      return null;
    }

    const cancelBookingButton = this.page.locator('[data-vc-cancel-booking-confirm="true"]').first();
    if (await cancelBookingButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      return cancelBookingButton;
    }

    return null;
  }

  async waitForCancelBookingConfirmationToClose(timeout = 10000) {
    await this.page.waitForFunction(
      () => {
        const isVisible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0';
        };

        const promptPattern = /cancel this booking|are you sure you want to cancel/i;
        const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
        const visiblePromptButton = buttons.find((button) => {
          const buttonText = (button.innerText || button.textContent || '').replace(/\s+/g, ' ').trim();
          if (!/^Cancel Booking$/i.test(buttonText) || !isVisible(button)) {
            return false;
          }

          let ancestor = button.parentElement;
          while (ancestor && ancestor !== document.body) {
            const ancestorText = ancestor.innerText || ancestor.textContent || '';
            if (promptPattern.test(ancestorText) && isVisible(ancestor)) {
              return true;
            }
            ancestor = ancestor.parentElement;
          }

          return false;
        });

        return !visiblePromptButton;
      },
      null,
      { timeout }
    );
  }

  async isCancelBookingConfirmationVisible(timeout = 1000) {
    return await this.findCancelBookingConfirmationButton(timeout)
      .then((button) => Boolean(button))
      .catch(() => false);
  }

  async waitForCancelBookingConfirmationToStayClosed(timeout = 5000) {
    await this.waitForCancelBookingConfirmationToClose(timeout);
    await this.page.waitForTimeout(3000);

    if (await this.isCancelBookingConfirmationVisible(500)) {
      throw new Error('Cancel Booking popup is still visible after the click attempt');
    }
  }

  async getCancelBookingModalConfirmPoint() {
    return this.page.evaluate(() => {
      const promptPattern = /cancel this booking|are you sure you want to cancel/i;
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };

      const promptElements = Array.from(document.querySelectorAll('body *')).filter((element) => {
        const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
        const rect = element.getBoundingClientRect();
        return promptPattern.test(text) &&
          isVisible(element) &&
          rect.width >= 300 &&
          rect.width <= 900 &&
          rect.height >= 140 &&
          rect.height <= 600;
      });

      const modal = promptElements
        .sort((left, right) => {
          const leftRect = left.getBoundingClientRect();
          const rightRect = right.getBoundingClientRect();
          return (leftRect.width * leftRect.height) - (rightRect.width * rightRect.height);
        })[0];

      if (!modal) {
        return null;
      }

      const exactCancelButton = Array.from(modal.querySelectorAll('button, [role="button"], div, span'))
        .find((element) => {
          const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
          return /^Cancel Booking$/i.test(text) && isVisible(element);
        });

      if (exactCancelButton) {
        const buttonRect = exactCancelButton.getBoundingClientRect();
        return {
          x: buttonRect.left + buttonRect.width / 2,
          y: buttonRect.top + buttonRect.height / 2,
          source: 'exact-button'
        };
      }

      const modalRect = modal.getBoundingClientRect();
      return {
        x: modalRect.left + modalRect.width * 0.72,
        y: modalRect.top + modalRect.height * 0.78,
        source: 'modal-ratio'
      };
    });
  }

  async getCancelBookingButtonCenter() {
    return this.page.evaluate(() => {
      const promptPattern = /cancel this booking|are you sure you want to cancel/i;
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };

      const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
      for (const button of buttons) {
        const buttonText = (button.innerText || button.textContent || '').replace(/\s+/g, ' ').trim();
        if (!/^Cancel Booking$/i.test(buttonText) ||
            !isVisible(button) ||
            button.disabled ||
            button.getAttribute('aria-disabled') === 'true') {
          continue;
        }

        let ancestor = button.parentElement;
        let belongsToCancelPrompt = false;
        while (ancestor && ancestor !== document.body) {
          const ancestorText = ancestor.innerText || ancestor.textContent || '';
          if (promptPattern.test(ancestorText) && isVisible(ancestor)) {
            belongsToCancelPrompt = true;
            break;
          }
          ancestor = ancestor.parentElement;
        }

        if (!belongsToCancelPrompt) {
          continue;
        }

        const rect = button.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const topElement = document.elementFromPoint(x, y);

        return {
          x,
          y,
          topText: topElement ? (topElement.innerText || topElement.textContent || '').replace(/\s+/g, ' ').trim() : '',
          topTagName: topElement ? topElement.tagName : ''
        };
      }

      return null;
    });
  }

  async dispatchCancelBookingClickFromDom() {
    return this.page.evaluate(() => {
      const promptPattern = /cancel this booking|are you sure you want to cancel/i;
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };

      const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
      for (const button of buttons) {
        const buttonText = (button.innerText || button.textContent || '').replace(/\s+/g, ' ').trim();
        if (!/^Cancel Booking$/i.test(buttonText) ||
            !isVisible(button) ||
            button.disabled ||
            button.getAttribute('aria-disabled') === 'true') {
          continue;
        }

        let ancestor = button.parentElement;
        let belongsToCancelPrompt = false;
        while (ancestor && ancestor !== document.body) {
          const ancestorText = ancestor.innerText || ancestor.textContent || '';
          if (promptPattern.test(ancestorText) && isVisible(ancestor)) {
            belongsToCancelPrompt = true;
            break;
          }
          ancestor = ancestor.parentElement;
        }

        if (!belongsToCancelPrompt) {
          continue;
        }

        const rect = button.getBoundingClientRect();
        const init = {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2
        };
        const topElement = document.elementFromPoint(init.clientX, init.clientY);
        const eventTarget = topElement && button.contains(topElement) ? topElement : button;
        const PointerCtor = window.PointerEvent || window.MouseEvent;

        button.focus();
        eventTarget.dispatchEvent(new PointerCtor('pointerover', init));
        eventTarget.dispatchEvent(new PointerCtor('pointerenter', init));
        eventTarget.dispatchEvent(new MouseEvent('mouseover', init));
        eventTarget.dispatchEvent(new MouseEvent('mouseenter', init));
        eventTarget.dispatchEvent(new PointerCtor('pointerdown', init));
        eventTarget.dispatchEvent(new MouseEvent('mousedown', init));
        eventTarget.dispatchEvent(new PointerCtor('pointerup', init));
        eventTarget.dispatchEvent(new MouseEvent('mouseup', init));
        eventTarget.dispatchEvent(new MouseEvent('click', init));

        if (typeof button.click === 'function') {
          button.click();
        }

        return true;
      }

      return false;
    });
  }

  async clickCancelBookingConfirmationButton() {
    const cancelBookingButton = await this.findCancelBookingConfirmationButton();

    if (!cancelBookingButton) {
      return false;
    }

    await cancelBookingButton.scrollIntoViewIfNeeded().catch(() => null);
    await highlight(cancelBookingButton, 'Cancel Booking').catch(() => null);
    await this.page.waitForTimeout(500);

    const clickAttempts = [
      {
        label: 'role exact last button',
        run: async () => this.page.getByRole('button', { name: /^Cancel Booking$/i }).last().click({ timeout: 5000 })
      },
      {
        label: 'marked confirmation button',
        run: async () => cancelBookingButton.click({ timeout: 5000 })
      },
      {
        label: 'forced marked confirmation button',
        run: async () => cancelBookingButton.click({ force: true, timeout: 5000 })
      },
      {
        label: 'button center mouse click',
        run: async () => {
          const center = await this.getCancelBookingButtonCenter();
          if (!center) throw new Error('Could not calculate Cancel Booking center point');
          console.log(`Cancel Booking center target: ${Math.round(center.x)}, ${Math.round(center.y)}; top=${center.topTagName || 'unknown'} "${center.topText || ''}"`);
          await this.page.mouse.click(center.x, center.y);
        }
      },
      {
        label: 'modal geometry mouse click',
        run: async () => {
          const point = await this.getCancelBookingModalConfirmPoint();
          if (!point) throw new Error('Could not calculate Cancel Booking modal confirmation point');
          console.log(`Cancel Booking modal target: ${Math.round(point.x)}, ${Math.round(point.y)}; source=${point.source}`);
          await this.page.mouse.move(point.x, point.y);
          await this.page.mouse.down();
          await this.page.waitForTimeout(120);
          await this.page.mouse.up();
        }
      },
      {
        label: 'top element DOM click',
        run: async () => {
          const center = await this.getCancelBookingButtonCenter();
          if (!center) throw new Error('Could not calculate Cancel Booking center point');
          await this.page.evaluate(({ x, y }) => {
            const target = document.elementFromPoint(x, y);
            if (!target) {
              throw new Error('No element is present at Cancel Booking center point');
            }
            target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window }));
            target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window }));
            target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window }));
          }, center);
        }
      },
      {
        label: 'bounding box mouse down/up',
        run: async () => {
          const box = await cancelBookingButton.boundingBox();
          if (!box) throw new Error('Cancel Booking button has no bounding box');
          await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await this.page.mouse.down();
          await this.page.waitForTimeout(80);
          await this.page.mouse.up();
        }
      },
      {
        label: 'keyboard enter',
        run: async () => {
          await cancelBookingButton.focus();
          await this.page.keyboard.press('Enter');
        }
      },
      {
        label: 'keyboard space',
        run: async () => {
          await cancelBookingButton.focus();
          await this.page.keyboard.press('Space');
        }
      },
      {
        label: 'full DOM event dispatch',
        run: async () => {
          const clicked = await this.dispatchCancelBookingClickFromDom();
          if (!clicked) throw new Error('DOM could not find Cancel Booking button');
        }
      }
    ];

    let lastError = null;
    for (const attempt of clickAttempts) {
      try {
        console.log(`Trying Cancel Booking confirmation via ${attempt.label}...`);
        await attempt.run();
        await this.waitForCancelBookingConfirmationToStayClosed(5000);
        return true;
      } catch (error) {
        lastError = error;
        console.log(`Cancel Booking click attempt failed: ${error.message}`);

        const dialogStillVisible = await this.isCancelBookingConfirmationVisible(1000);

        if (!dialogStillVisible) {
          return true;
        }
      }
    }

    if (lastError) {
      throw lastError;
    }

    return false;
  }

  async confirmCancelPromptVisible() {
    const thisBookingOnlyCandidates = [
      this.page.getByRole('button', { name: /This booking only/i }).first(),
      this.page.getByRole('menuitem', { name: /This booking only/i }).first(),
      this.page.getByRole('option', { name: /This booking only/i }).first(),
      this.page.locator(
        'button:has-text("This booking only"), [role="button"]:has-text("This booking only"), [role="menuitem"]:has-text("This booking only"), [role="option"]:has-text("This booking only")'
      ).first()
    ];

    let selectedThisBookingOnly = false;
    for (const thisBookingOnly of thisBookingOnlyCandidates) {
      if (await thisBookingOnly.isVisible({ timeout: 2000 }).catch(() => false)) {
        await clickHighlighted(thisBookingOnly, 'This booking only');
        await this.page.waitForTimeout(1500);
        selectedThisBookingOnly = true;
        break;
      }
    }

    if (await this.clickCancelBookingConfirmationButton()) {
      await this.page.waitForTimeout(1500);
      return true;
    }

    const cancelDialog = this.page
      .locator('[role="dialog"], .modal.show, .MuiDialog-root, .swal2-popup')
      .filter({ hasText: /cancel this booking|Are you sure you want to cancel/i })
      .first();

    if (await cancelDialog.isVisible({ timeout: 5000 }).catch(() => false)) {
      const cancelBookingButton = cancelDialog.getByRole('button', { name: /^Cancel Booking$/i }).first();
      if (await cancelBookingButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await clickHighlighted(cancelBookingButton, 'Cancel Booking');
        await this.page.waitForTimeout(1500);
        return true;
      }

      const cancelBookingText = cancelDialog.locator('button:has-text("Cancel Booking")').first();
      if (await cancelBookingText.isVisible({ timeout: 3000 }).catch(() => false)) {
        await clickHighlighted(cancelBookingText, 'Cancel Booking');
        await this.page.waitForTimeout(1500);
        return true;
      }
    }

    const confirmCancelCandidates = [
      this.page.getByRole('button', { name: /Cancel Booking/i }).first(),
      this.page.locator('[role="dialog"] button:has-text("Cancel Booking"), .modal.show button:has-text("Cancel Booking")').first()
    ];

    for (const cancelButton of confirmCancelCandidates) {
      if (await cancelButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await clickHighlighted(cancelButton, 'Confirm Cancel');
        await this.page.waitForTimeout(1500);
        return true;
      }
    }

    if (await this.confirmIfPromptVisible('Confirm Cancel')) {
      return true;
    }

    return selectedThisBookingOnly && !(await this.isCancelBookingConfirmationVisible(1000));
  }

  async hasAnyBookingIdOnPage() {
    return await this.page.evaluate(() => /BK[A-Z0-9]{10,}/.test(document.body.innerText || ''));
  }

  async throwIfBookingListIsEmpty() {
    const hasBookingId = await this.hasAnyBookingIdOnPage();

    if (hasBookingId) {
      return;
    }

    const bookingCounts = await this.page.evaluate(() => {
      const text = document.body.innerText || '';
      const statuses = [
        'All',
        'Active',
        'Scheduled',
        'Checked In',
        'Checked out',
        'For Approval',
        'Refused',
        'Declined'
      ];

      return statuses.reduce((counts, status) => {
        const pattern = new RegExp(`${status}\\s+(\\d+)`, 'i');
        const match = text.match(pattern);
        counts[status] = match ? Number(match[1]) : null;
        return counts;
      }, {});
    });

    const knownCounts = Object.values(bookingCounts).filter((count) => count !== null);

    if (knownCounts.length > 0 && knownCounts.every((count) => count === 0)) {
      throw new Error('No bookings are available in the current booking list date range.');
    }
  }

  async debugBookingListContent() {
    console.log('🔍 Debugging booking list content...');
    
    const pageInfo = await this.page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        bodyText: document.body.innerText.substring(0, 500),
        tableCount: document.querySelectorAll('table').length,
        rowCount: document.querySelectorAll('tr').length,
        cellCount: document.querySelectorAll('td, th').length
      };
    });
    
    console.log('📄 Page Info:', pageInfo);
  }

  async checkInBooking(options = {}) {
    const keepBookingDetailsOpen = options.keepBookingDetailsOpen ?? false;

    console.log('✅ Checking in booking...');

    if (keepBookingDetailsOpen) {
      await this.completeBookingDetailsAction('Check In');
      console.log('✅ Booking checked in');
      return;
    }
    
    // Close any open modals first
    if (!keepBookingDetailsOpen) {
      await this.closeAnyOpenModals();
    }
    
    // Try multiple strategies to check in
    const checkInStrategies = [
      // Strategy 1: Standard button click
      async () => {
        const checkInButton = this.checkInButton.first();
        await checkInButton.waitFor({ state: 'visible', timeout: 5000 });
        await clickHighlighted(checkInButton, 'Check In');
        return true;
      },
      // Strategy 2: Force click
      async () => {
        await this.checkInButton.first().click({ force: true, timeout: 5000 });
        return true;
      },
      // Strategy 3: Find any Check In button
      async () => {
        const checkInBtn = this.page.locator('button:has-text("Check In"), [title*="Check In"]').first();
        await checkInBtn.click({ force: true, timeout: 5000 });
        return true;
      },
      // Strategy 4: JavaScript click
      async () => {
        return await this.page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
          const checkInButton = buttons.find(btn =>
            btn.textContent && btn.textContent.toLowerCase().includes('check in')
          );
          if (checkInButton) {
            checkInButton.click();
            return true;
          }
          return false;
        });
      }
    ];
    
    let success = false;
    for (const strategy of checkInStrategies) {
      try {
        const result = await strategy();
        if (result) {
          await this.page.waitForTimeout(2000);
          success = true;
          break;
        }
      } catch (error) {
        console.log(`Check in strategy failed: ${error.message}`);
        if (!keepBookingDetailsOpen) {
          await this.closeAnyOpenModals();
        }
      }
    }
    
    if (!success) {
      throw new Error('Failed to check in booking with all strategies');
    }
    
    console.log('✅ Booking checked in');
  }

  async checkOutBooking(options = {}) {
    const keepBookingDetailsOpen = options.keepBookingDetailsOpen ?? false;

    console.log('🚪 Checking out booking...');

    if (keepBookingDetailsOpen) {
      await this.completeBookingDetailsAction('Check Out', ['Checked-Out', 'Checked Out']);
      console.log('✅ Booking checked out');
      return;
    }
    
    // Close any open modals first
    if (!keepBookingDetailsOpen) {
      await this.closeAnyOpenModals();
    }
    
    // Try multiple strategies to check out
    const checkOutStrategies = [
      // Strategy 1: Standard button click
      async () => {
        const checkOutBtn = this.page.getByRole('button', { name: 'Check Out' }).first();
        await checkOutBtn.waitFor({ state: 'visible', timeout: 5000 });
        await clickHighlighted(checkOutBtn, 'Check Out button');
        return true;
      },
      // Strategy 2: Force click on Check Out button
      async () => {
        const checkOutBtn = this.page.getByRole('button', { name: 'Check Out' }).first();
        await checkOutBtn.click({ force: true, timeout: 5000 });
        return true;
      },
      // Strategy 3: Find any Check Out button by text
      async () => {
        const checkOutBtn = this.page.locator('button:has-text("Check Out"), [title*="Check Out"]').first();
        await checkOutBtn.click({ force: true, timeout: 5000 });
        return true;
      },
      // Strategy 4: JavaScript click
      async () => {
        return await this.page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
          const checkOutButton = buttons.find(btn =>
            btn.textContent && btn.textContent.toLowerCase().includes('check out')
          );
          if (checkOutButton) {
            checkOutButton.click();
            return true;
          }
          return false;
        });
      },
      // Strategy 5: Check if already checked out
      async () => {
        const checkedOutStatus = this.page.locator('#myModal2').getByText(/Checked\s*out/i).first();
        if (await checkedOutStatus.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('✅ Booking is already checked out');
          return true;
        }
        return false;
      }
    ];
    
    let success = false;
    for (const strategy of checkOutStrategies) {
      try {
        const result = await strategy();
        if (result) {
          await this.page.waitForTimeout(2000);
          success = true;
          break;
        }
      } catch (error) {
        console.log(`Check out strategy failed: ${error.message}`);
        if (!keepBookingDetailsOpen) {
          await this.closeAnyOpenModals();
        }
      }
    }
    
    if (!success) {
      throw new Error('Failed to check out booking with all strategies');
    }
    
    console.log('✅ Booking checked out');
  }

  async undoBookingAction(options = {}) {
    const keepBookingDetailsOpen = options.keepBookingDetailsOpen ?? false;
    console.log('↩️ Undoing booking action...');
    
    if (keepBookingDetailsOpen) {
      await this.clickBookingDetailsAction('Undo', ['Reinstate']);
    } else {
      await clickHighlighted(this.undoButton, 'Undo');
    }
    
    await this.confirmUndoPromptVisible();
    
    await this.page.waitForTimeout(1000);
    console.log('✅ Booking action undone');
  }

  async cancelBooking(options = {}) {
    const keepBookingDetailsOpen = options.keepBookingDetailsOpen ?? false;

    console.log('Cancelling booking...');

    if (keepBookingDetailsOpen) {
      await this.clickBookingDetailsAction('Cancel', ['Cancel Booking']);
    } else {
      const cancelButton = this.page.getByRole('button', { name: 'Cancel' }).first();
      await clickHighlighted(cancelButton, 'Cancel');
    }

    const cancelConfirmed = await this.confirmCancelPromptVisible();
    if (!cancelConfirmed) {
      throw new Error('Cancel confirmation popup appeared, but Cancel Booking was not clicked successfully.');
    }

    await this.waitForCancelBookingConfirmationToClose(10000).catch((error) => {
      throw new Error(`Cancel Booking popup did not close after confirmation: ${error.message}`);
    });

    await this.page.waitForTimeout(2000);
    console.log('Booking cancelled');
  }

  async clickEditBookingAction() {
    console.log('Opening Edit Booking form...');

    await this.clickBookingDetailsAction('Edit Booking', ['Edit']);
    await this.clickThisBookingOnlyForEditIfVisible();
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);

    await this.page.getByRole('heading', { name: /Edit Booking/i }).waitFor({
      state: 'visible',
      timeout: 30000
    });
    await this.waitForEditFormReady();
    console.log('Edit Booking form opened');
  }

  async clickThisBookingOnlyForEditIfVisible() {
    const prompt = this.page
      .locator('[role="dialog"], .modal.show, .MuiDialog-root, body')
      .filter({ hasText: /part of a recurring booking series|edit just this booking|all bookings in the series/i })
      .first();

    if (!await prompt.isVisible({ timeout: 5000 }).catch(() => false)) {
      return false;
    }

    const thisBookingOnlyCandidates = [
      this.page.getByRole('button', { name: /^This Booking Only$/i }).first(),
      this.page.getByRole('button', { name: /This booking only/i }).first(),
      prompt.getByRole('button', { name: /This booking only/i }).first(),
      this.page.locator('button:has-text("This Booking Only"), [role="button"]:has-text("This Booking Only")').first()
    ];

    for (const thisBookingOnly of thisBookingOnlyCandidates) {
      if (await thisBookingOnly.isVisible({ timeout: 1500 }).catch(() => false)) {
        await clickHighlighted(thisBookingOnly, 'This Booking Only');
        await this.page.waitForLoadState('domcontentloaded').catch(() => null);
        await this.page.waitForTimeout(1500);
        return true;
      }
    }

    throw new Error('Recurring booking edit prompt appeared, but This Booking Only was not clickable.');
  }

  async waitForEditFormReady(timeout = 30000) {
    await this.page.waitForFunction(
      () => {
        const text = document.body.innerText || '';
        const visibleBackdrops = Array.from(document.querySelectorAll('.MuiBackdrop-root'))
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return rect.width > 0 &&
              rect.height > 0 &&
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              style.opacity !== '0';
          });
        const visibleLoaders = Array.from(document.querySelectorAll('[role="progressbar"], .MuiCircularProgress-root, [class*="loader"], [class*="Loader"], [class*="spinner"], [class*="Spinner"]'))
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return rect.width > 0 &&
              rect.height > 0 &&
              style.display !== 'none' &&
              style.visibility !== 'hidden';
          });

        return text.includes('Scheduling Information') &&
          visibleBackdrops.length === 0 &&
          visibleLoaders.length === 0;
      },
      null,
      { timeout }
    ).catch(() => null);

    await this.page.waitForTimeout(500);
  }

  async clickFormButton(buttonName, label = buttonName) {
    const button = this.page.getByRole('button', { name: buttonName }).first();
    let sawDisabledButton = false;

    for (let attempt = 0; attempt < 20; attempt++) {
      if (await button.isVisible({ timeout: 1000 }).catch(() => false)) {
        if (await button.isEnabled().catch(() => false)) {
          await button.scrollIntoViewIfNeeded().catch(() => null);
          await clickHighlighted(button, label);
          await this.page.waitForTimeout(1500);
          return;
        }

        sawDisabledButton = true;
        await this.page.waitForTimeout(750);
        continue;
      }

      await this.page.mouse.wheel(0, 500);
      await this.page.waitForTimeout(500);
    }

    if (sawDisabledButton && !await button.isEnabled().catch(() => false)) {
      throw new Error(`${label} button is visible but remains disabled.`);
    }

    await button.scrollIntoViewIfNeeded().catch(() => null);
    await clickHighlighted(button, label);
    await this.page.waitForTimeout(1500);
  }

  async clickFormButtonIfEnabled(buttonName, label = buttonName, timeout = 3000) {
    const button = this.page.getByRole('button', { name: buttonName }).first();
    if (!(await button.isVisible({ timeout }).catch(() => false))) {
      return false;
    }

    if (!(await button.isEnabled().catch(() => false))) {
      return false;
    }

    await button.scrollIntoViewIfNeeded().catch(() => null);
    await clickHighlighted(button, label);
    await this.page.waitForTimeout(1500);
    return true;
  }

  async clickEditStepTab(stepName) {
    const tab = this.page
      .locator('button, [role="button"], div, span')
      .filter({ hasText: new RegExp(`^\\s*${this.escapeRegExp(stepName)}\\s*$`, 'i') })
      .first();

    if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clickHighlighted(tab, stepName);
      await this.page.waitForTimeout(1500);
      return true;
    }

    return false;
  }

  async dismissOpenMenus() {
    await this.page.keyboard.press('Escape').catch(() => null);
    await this.page.waitForTimeout(300);

    const backdrop = this.page.locator('.MuiBackdrop-root:visible').first();
    if (await backdrop.isVisible({ timeout: 800 }).catch(() => false)) {
      await backdrop.click({ force: true }).catch(() => null);
      await this.page.waitForTimeout(500);
    }
  }

  async selectVisibleOption(optionName, label = optionName) {
    const option = this.page.getByRole('option', { name: optionName }).first();
    await option.waitFor({ state: 'visible', timeout: 10000 });
    await clickHighlighted(option, label);
  }

  async selectAccessPoint(accessPointName = 'North Gate') {
    console.log(`Selecting access point: ${accessPointName}`);
    await this.waitForEditFormReady();

    const accessPointCandidates = [
      this.page.getByRole('combobox', { name: /South Gate|North Gate/i }).first(),
      this.page.locator('[role="combobox"]').filter({ hasText: /South Gate|North Gate/i }).first(),
      this.page.locator('#mui-component-select-accessPoint, [id*="accessPoint"]').first()
    ];

    await this.clickFirstVisible(
      accessPointCandidates.map((locator, index) => ({
        locator,
        label: `Access point selector ${index + 1}`,
        timeout: 5000
      })),
      'Could not find access point selector'
    );

    await this.selectVisibleOption(accessPointName, accessPointName);
  }

  async selectVehicleType(vehicleType = 'Tipper Truck') {
    console.log(`Selecting vehicle type: ${vehicleType}`);
    await this.waitForEditFormReady();

    const vehicleSelectors = [
      this.page.getByRole('combobox', { name: /Tipper Truck|Car|Pump Truck|Garbage Truck/i }).first(),
      this.page.locator('#mui-component-select-vehicleType, [id*="vehicleType"]').first(),
      this.page.locator('.col-md-6').first()
    ];

    await this.clickFirstVisible(
      vehicleSelectors.map((locator, index) => ({
        locator,
        label: `Vehicle type selector ${index + 1}`,
        timeout: 5000
      })),
      'Could not find vehicle type selector'
    );

    await this.selectVisibleOption(vehicleType, vehicleType);
  }

  async selectFuelType(fuelType = 'Diesel') {
    console.log(`Selecting fuel type: ${fuelType}`);
    await this.waitForEditFormReady();

    const fuelSelectors = [
      this.page.locator('#mui-component-select-fuelType'),
      this.page.getByRole('combobox', { name: /Diesel|Petrol|Electric/i }).first(),
      this.page.locator('[id*="fuelType"]').first()
    ];

    await this.clickFirstVisible(
      fuelSelectors.map((locator, index) => ({
        locator,
        label: `Fuel type selector ${index + 1}`,
        timeout: 5000
      })),
      'Could not find fuel type selector'
    );

    await this.selectVisibleOption(fuelType, fuelType);
  }

  async selectResource(resourceName = 'Forklift') {
    console.log(`Selecting resource: ${resourceName}`);
    await this.waitForEditFormReady();

    const selectedResource = this.page.locator('#mui-component-select-resource');
    if (await selectedResource.isVisible({ timeout: 3000 }).catch(() => false)) {
      const selectedText = await selectedResource.innerText().catch(() => '');
      if (selectedText.includes(resourceName)) {
        console.log(`${resourceName} is already selected`);
        return;
      }
    }

    const resourceSelectors = [
      this.page.getByLabel('', { exact: true }).first(),
      this.page.locator('[role="combobox"]').last(),
      this.page.locator('input[role="combobox"], input[aria-autocomplete="list"]').last()
    ];

    await this.clickFirstVisible(
      resourceSelectors.map((locator, index) => ({
        locator,
        label: `Resource selector ${index + 1}`,
        timeout: 5000
      })),
      'Could not find resource selector'
    );

    const resourceOption = this.page.getByRole('option', { name: resourceName }).first();

    if (await resourceOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await resourceOption.click({ force: true });
    } else if (await selectedResource.isVisible({ timeout: 1000 }).catch(() => false)) {
      const selectedText = await selectedResource.innerText().catch(() => '');
      if (!selectedText.includes(resourceName)) {
        throw new Error(`Could not find resource option: ${resourceName}`);
      }
    } else {
      throw new Error(`Could not find resource option: ${resourceName}`);
    }

    const backdrop = this.page.locator('.MuiBackdrop-root').first();
    if (await backdrop.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.page.keyboard.press('Escape').catch(() => null);
      await backdrop.click({ force: true }).catch(() => null);
    }
  }

  async saveEditBookingSteps() {
    console.log('Saving edit booking steps...');

    await this.clickFormButton('Next', 'Next');
    await this.clickFormButton('Save Changes', 'Save Changes');

    const timeSlot = this.page.getByText(/:00 PM - 5:00 PM/).first();
    if (await timeSlot.isVisible({ timeout: 10000 }).catch(() => false)) {
      await clickHighlighted(timeSlot, 'Time slot');
    }

    await this.clickFormButton('Save Changes', 'Save Changes');

    const activeCheckbox = this.page.locator('#active');
    if (await activeCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
      await activeCheckbox.check({ force: true });
    }

    await this.clickFormButton(/Save ChangesForward|Save Changes/i, 'Save Changes Forward');
  }

  async submitEditedBooking() {
    console.log('Submitting edited booking...');

    const additionalComment = this.page.locator('div').filter({ hasText: /^Additional CommentComment0\/500$/ }).first();
    if (await additionalComment.isVisible({ timeout: 5000 }).catch(() => false)) {
      await clickHighlighted(additionalComment, 'Additional Comment');
    }

    await this.page.getByRole('button', { name: 'Submit Booking' }).scrollIntoViewIfNeeded().catch(() => null);
    await clickHighlighted(this.page.getByRole('button', { name: 'Submit Booking' }).first(), 'Submit Booking');
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    await this.page.waitForTimeout(3000);
  }

  normalizeText(value = '') {
    return String(value).replace(/\s+/g, ' ').trim();
  }

  async getVisibleText(locator) {
    return this.normalizeText(await locator.innerText().catch(async () => {
      return await locator.inputValue().catch(() => '');
    }));
  }

  async getScheduledBookingCandidatesForEdit() {
    await this.waitForBookingListToLoad();
    await this.throwIfBookingListIsEmpty();

    return await this.page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr, tr, .booking-row, .table-row, div[role="row"]'));
      const seen = new Set();
      const candidates = [];

      for (const row of rows) {
        const text = row.innerText || row.textContent || '';
        const bookingIdMatch = text.match(/BK[A-Z0-9]{10,}/);
        if (!bookingIdMatch || !/\bScheduled\b/i.test(text)) {
          continue;
        }

        const bookingId = bookingIdMatch[0];
        if (seen.has(bookingId)) {
          continue;
        }

        seen.add(bookingId);
        candidates.push({
          bookingId,
          rowText: text.replace(/\s+/g, ' ').trim().slice(0, 260)
        });
      }

      return candidates;
    });
  }

  detectBookingTypeFromText(text) {
    const normalized = this.normalizeText(text).toLowerCase();

    if (normalized.includes('multi-vehicle') || normalized.includes('multi vehicle')) {
      return 'Multi-Vehicle';
    }

    if (normalized.includes('recurring')) {
      return 'Recurring';
    }

    if (normalized.includes('resource only') || normalized.includes('resource-only')) {
      return 'Resource-only';
    }

    if (normalized.includes('delivery')) {
      return 'Delivery';
    }

    if (normalized.includes('expected vehicles') || normalized.includes('add another')) {
      return 'Multi-Vehicle';
    }

    return 'Delivery';
  }

  bookingTypeMatches(detectedType, targetType) {
    const normalize = (value) => this.normalizeText(value).toLowerCase().replace(/[^a-z0-9]/g, '');
    return normalize(detectedType) === normalize(targetType);
  }

  escapeRegExp(value = '') {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async selectScheduledBookingForEditType(targetType, attemptedBookingIds = new Set(), options = {}) {
    const candidates = await this.getScheduledBookingCandidatesForEdit();
    const maxCandidates = options.maxCandidates ?? 20;

    for (const candidate of candidates.slice(0, maxCandidates)) {
      if (attemptedBookingIds.has(candidate.bookingId)) {
        continue;
      }

      console.log(`Checking ${targetType} candidate: ${candidate.bookingId}`);
      await this.selectBookingById(candidate.bookingId);
      await this.waitForBookingDetailsReady();

      const detailsText = await this.page.locator('#myModal2').innerText({ timeout: 5000 }).catch(() => '');
      const detectedType = this.detectBookingTypeFromText(detailsText || candidate.rowText);
      const hasEditAction = Boolean(await this.findBookingDetailsActionButton('Edit Booking', ['Edit'], { timeout: 2000 }));

      if (this.bookingTypeMatches(detectedType, targetType) && hasEditAction) {
        return {
          bookingId: candidate.bookingId,
          bookingType: detectedType,
          rowText: candidate.rowText
        };
      }

      console.log(`Skipping ${candidate.bookingId}; detected ${detectedType}, target ${targetType}, edit action ${hasEditAction ? 'available' : 'not available'}.`);
      attemptedBookingIds.add(candidate.bookingId);
      await this.closeSideBarModal();
      await this.page.waitForTimeout(1200);
    }

    return null;
  }

  async selectPreferredDeliveryBookingForEdit(preferredBookingId = null) {
    const bookingId = preferredBookingId || process.env.EDIT_DELIVERY_BOOKING_ID || 'BK5ET10000003706';
    const bookingCell = this.page.getByRole('cell', { name: bookingId }).first();
    const bookingText = this.page.getByText(bookingId, { exact: true }).first();

    if (!await bookingCell.isVisible({ timeout: 3000 }).catch(() => false) &&
        !await bookingText.isVisible({ timeout: 1000 }).catch(() => false)) {
      return null;
    }

    console.log(`Using preferred Delivery booking from recording: ${bookingId}`);
    await this.selectBookingById(bookingId);
    await this.waitForBookingDetailsReady();

    const editAction = await this.findBookingDetailsActionButton('Edit Booking', ['Edit'], { timeout: 3000 });
    if (!editAction) {
      throw new Error(`Preferred Delivery booking ${bookingId} was visible, but Edit Booking was not available.`);
    }

    return {
      bookingId,
      bookingType: 'Delivery',
      rowText: ''
    };
  }

  async findFirstVisibleLocator(candidates) {
    for (const candidate of candidates) {
      const locator = candidate && typeof candidate.isVisible === 'function' ? candidate : candidate.locator;
      const timeout = candidate && typeof candidate.timeout === 'number' ? candidate.timeout : 1500;

      if (locator && await locator.isVisible({ timeout }).catch(() => false)) {
        return locator;
      }
    }

    return null;
  }

  async getOpenOptions() {
    await this.page.waitForTimeout(500);

    return await this.page.locator('[role="option"]').evaluateAll((options) => {
      return options
        .map((option, index) => {
          const text = (option.innerText || option.textContent || '').replace(/\s+/g, ' ').trim();
          const rect = option.getBoundingClientRect();
          const style = window.getComputedStyle(option);
          const disabled = option.getAttribute('aria-disabled') === 'true' ||
            option.disabled ||
            option.className.toString().toLowerCase().includes('disabled');

          return {
            index,
            text,
            visible: Boolean(text) &&
              rect.width > 0 &&
              rect.height > 0 &&
              style.visibility !== 'hidden' &&
              style.display !== 'none' &&
              !disabled
          };
        })
        .filter((option) => option.visible);
    }).catch(() => []);
  }

  async replaceDropdownWithAlternative({ label, selectors, preferredOptions = [], optional = true }) {
    await this.waitForEditFormReady();

    const dropdown = await this.findFirstVisibleLocator(selectors);
    if (!dropdown) {
      if (optional) {
        return { field: label, status: 'kept', before: null, after: null, reason: 'Dropdown not available for this booking type.' };
      }

      throw new Error(`${label} dropdown was not available.`);
    }

    const before = await this.getVisibleText(dropdown);
    await dropdown.scrollIntoViewIfNeeded().catch(() => null);
    await clickHighlighted(dropdown, `${label} dropdown`);

    const options = await this.getOpenOptions();
    const normalizedBefore = before.toLowerCase();
    const candidateTexts = [
      ...preferredOptions,
      ...options.map((option) => option.text)
    ];

    const nextValue = candidateTexts.find((candidateText) => {
      const option = options.find((item) => item.text.toLowerCase() === candidateText.toLowerCase());
      return option && option.text.toLowerCase() !== normalizedBefore;
    });

    if (!nextValue) {
      await this.page.keyboard.press('Escape').catch(() => null);
      return { field: label, status: 'kept', before, after: before, reason: 'No alternative option available.' };
    }

    const optionLocator = this.page.locator('[role="option"]').filter({ hasText: new RegExp(`^\\s*${this.escapeRegExp(nextValue)}\\s*$`, 'i') }).first();
    await clickHighlighted(optionLocator, `${label}: ${nextValue}`);
    await this.dismissOpenMenus();
    await this.page.waitForTimeout(800);

    return { field: label, status: 'changed', before, after: nextValue, reason: null };
  }

  async openEditBookingDatePicker() {
    const directPickerTriggers = [
      this.page.getByRole('button', { name: /choose date|calendar/i }).first(),
      this.page.locator('button[aria-label*="Choose date"], button[aria-label*="calendar"]').first()
    ];

    for (const picker of directPickerTriggers) {
      if (await picker.isVisible({ timeout: 1000 }).catch(() => false)) {
        await clickHighlighted(picker, 'Open edit date picker').catch(() => null);
        await this.page.waitForTimeout(700);
        return true;
      }
    }

    const marked = await this.page.evaluate(() => {
      document.querySelectorAll('[data-vc-edit-date-picker-trigger="true"]').forEach((element) => {
        element.removeAttribute('data-vc-edit-date-picker-trigger');
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

      const dateTextPattern = /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+\s+\d{4}/;
      const chooseDateHeading = Array.from(document.querySelectorAll('label, p, div, span'))
        .find((element) => (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim() === 'Choose date' && isVisible(element));
      const headingRect = chooseDateHeading ? chooseDateHeading.getBoundingClientRect() : null;

      const candidates = Array.from(document.querySelectorAll('button, [role="button"], input, div, span'))
        .filter((element) => {
          if (!isVisible(element)) return false;
          const rect = element.getBoundingClientRect();
          const text = (element.innerText || element.textContent || element.value || '').replace(/\s+/g, ' ').trim();
          return rect.left > 300 &&
            rect.top > 200 &&
            (!headingRect || (rect.top > headingRect.bottom && rect.top < headingRect.bottom + 120)) &&
            rect.width >= 180 &&
            rect.width <= 520 &&
            rect.height >= 35 &&
            rect.height <= 90 &&
            dateTextPattern.test(text);
        })
        .sort((left, right) => {
          const leftRect = left.getBoundingClientRect();
          const rightRect = right.getBoundingClientRect();
          return leftRect.top - rightRect.top || leftRect.left - rightRect.left;
        });

      const target = candidates[0];
      if (!target) return null;

      target.setAttribute('data-vc-edit-date-picker-trigger', 'true');
      const rect = target.getBoundingClientRect();
      return { x: rect.left + Math.min(44, rect.width / 2), y: rect.top + rect.height / 2 };
    });

    if (!marked) {
      return false;
    }

    const trigger = this.page.locator('[data-vc-edit-date-picker-trigger="true"]').first();
    await clickHighlighted(trigger, 'Choose date');
    await this.page.evaluate(({ x, y }) => {
      const markedTrigger = document.querySelector('[data-vc-edit-date-picker-trigger="true"]');
      if (!markedTrigger) return;

      const clickTargets = [
        document.elementFromPoint(x, y),
        markedTrigger,
        markedTrigger.closest('button, [role="button"], label, .MuiInputBase-root, .MuiFormControl-root, div')
      ].filter(Boolean);
      const uniqueTargets = Array.from(new Set(clickTargets));
      const PointerCtor = window.PointerEvent || window.MouseEvent;

      for (const target of uniqueTargets) {
        const eventInit = {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: x,
          clientY: y
        };
        target.dispatchEvent(new PointerCtor('pointerover', eventInit));
        target.dispatchEvent(new PointerCtor('pointerenter', eventInit));
        target.dispatchEvent(new MouseEvent('mouseover', eventInit));
        target.dispatchEvent(new MouseEvent('mouseenter', eventInit));
        target.dispatchEvent(new PointerCtor('pointerdown', eventInit));
        target.dispatchEvent(new MouseEvent('mousedown', eventInit));
        target.dispatchEvent(new PointerCtor('pointerup', eventInit));
        target.dispatchEvent(new MouseEvent('mouseup', eventInit));
        target.dispatchEvent(new MouseEvent('click', eventInit));
        if (typeof target.click === 'function') {
          target.click();
        }
      }
    }, marked).catch(() => null);
    await this.page.mouse.click(marked.x, marked.y).catch(() => null);
    await this.page.waitForTimeout(700);
    return true;
  }

  async selectAlternativeEditDate() {
    await this.waitForEditFormReady();
    await this.page.getByText('Choose date', { exact: true }).first().waitFor({
      state: 'visible',
      timeout: 20000
    }).catch(() => null);
    await this.openEditBookingDatePicker();

    const customCalendarDate = await this.page.evaluate(() => {
      const availableDay = Array.from(document.querySelectorAll('#booking-calender .day.enable-day, #booking-calender .date.enable-day'))
        .map((element) => element.closest('.day') || element)
        .find((element) => {
          const className = String(element.className || '').toLowerCase();
          const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
          return text &&
            !className.includes('disable-date') &&
            !className.includes('selected');
        });

      if (!availableDay) {
        return null;
      }

      availableDay.setAttribute('data-vc-edit-alt-date', 'true');
      const rect = availableDay.getBoundingClientRect();
      const eventInit = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
      };
      const PointerCtor = window.PointerEvent || window.MouseEvent;

      availableDay.dispatchEvent(new PointerCtor('pointerover', eventInit));
      availableDay.dispatchEvent(new MouseEvent('mouseover', eventInit));
      availableDay.dispatchEvent(new PointerCtor('pointerdown', eventInit));
      availableDay.dispatchEvent(new MouseEvent('mousedown', eventInit));
      availableDay.dispatchEvent(new PointerCtor('pointerup', eventInit));
      availableDay.dispatchEvent(new MouseEvent('mouseup', eventInit));
      availableDay.dispatchEvent(new MouseEvent('click', eventInit));

      if (typeof availableDay.click === 'function') {
        availableDay.click();
      }

      return (availableDay.innerText || availableDay.textContent || '').replace(/\s+/g, ' ').trim();
    });

    if (customCalendarDate) {
      await this.page.waitForTimeout(1000);
      return {
        field: 'Booking date',
        status: 'changed',
        before: null,
        after: customCalendarDate,
        reason: null
      };
    }

    await this.page.waitForFunction(
      () => {
        const visible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0';
        };

        const pickerSelector = [
          '.MuiDateCalendar-root',
          '.MuiPickersPopper-root',
          '.MuiPopover-root',
          '.react-datepicker',
          '[class*="datepicker"]',
          '[class*="DatePicker"]',
          '[class*="calendar"]',
          '[class*="Calendar"]',
          '[role="dialog"]',
          '[role="grid"]'
        ].join(',');

        return Array.from(document.querySelectorAll(pickerSelector))
          .some((container) => {
            const rect = container.getBoundingClientRect();
            return visible(container) &&
              rect.left > 250 &&
              rect.top > 100 &&
              rect.width < 700 &&
              /\b\d{1,2}\b/.test(container.innerText || container.textContent || '');
          });
      },
      null,
      { timeout: 10000 }
    ).catch(() => null);

    const marked = await this.page.evaluate(() => {
      document.querySelectorAll('[data-vc-edit-alt-date="true"]').forEach((element) => {
        element.removeAttribute('data-vc-edit-alt-date');
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

      const isDisabled = (element) => {
        const className = String(element.className || '').toLowerCase();
        return element.disabled ||
          element.getAttribute('aria-disabled') === 'true' ||
          element.getAttribute('disabled') !== null ||
          className.includes('disabled') ||
          className.includes('outside') ||
          className.includes('dayoutsidemonth');
      };

      const pickerSelector = [
        '.MuiDateCalendar-root',
        '.MuiPickersPopper-root',
        '.MuiPopover-root',
        '.react-datepicker',
        '[class*="datepicker"]',
        '[class*="DatePicker"]',
        '[class*="calendar"]',
        '[class*="Calendar"]',
        '[role="dialog"]',
        '[role="grid"]'
      ].join(',');
      const pickerContainers = Array.from(document.querySelectorAll(pickerSelector))
        .filter((container) => {
          const rect = container.getBoundingClientRect();
          return isVisible(container) &&
            rect.left > 250 &&
            rect.top > 100 &&
            rect.width < 700 &&
            /\b\d{1,2}\b/.test(container.innerText || container.textContent || '');
        });
      const root = pickerContainers.find((container) => /\b\d{1,2}\b/.test(container.innerText || container.textContent || ''));
      if (!root) {
        return null;
      }

      const candidates = Array.from(root.querySelectorAll('button.MuiPickersDay-root, .MuiDayCalendar-weekContainer button, [role="gridcell"] button, [role="gridcell"], button, [class*="day"], [class*="Day"]'))
        .filter((element) => {
          const text = (element.innerText || element.textContent || element.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return /(?:^|\s)\d{1,2}(?:\s|$)/.test(text) &&
            rect.width <= 90 &&
            rect.height <= 90 &&
            style.pointerEvents !== 'none' &&
            isVisible(element) &&
            !isDisabled(element);
        })
        .map((element) => {
          const className = String(element.className || '').toLowerCase();
          const rect = element.getBoundingClientRect();
          return {
            element,
            selected: element.getAttribute('aria-selected') === 'true' || className.includes('selected'),
            text: (element.innerText || element.textContent || element.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().match(/\d{1,2}/)?.[0] || '',
            top: rect.top,
            left: rect.left
          };
        })
        .sort((left, right) => Number(left.selected) - Number(right.selected) || left.top - right.top || left.left - right.left);

      const candidate = candidates.find((item) => !item.selected) || candidates[0];
      if (!candidate) {
        return null;
      }

      candidate.element.setAttribute('data-vc-edit-alt-date', 'true');
      return { text: candidate.text, selected: candidate.selected };
    });

    if (!marked) {
      const loaderVisible = await this.page.locator('[role="progressbar"], .MuiCircularProgress-root, [class*="loader"], [class*="Loader"], [class*="spinner"], [class*="Spinner"]').first().isVisible({ timeout: 1000 }).catch(() => false);
      return {
        field: 'Booking date',
        status: 'kept',
        before: null,
        after: null,
        reason: loaderVisible ? 'Booking date availability did not finish loading.' : 'No alternative date available.'
      };
    }

    const dateCell = this.page.locator('[data-vc-edit-alt-date="true"]').first();
    await clickHighlighted(dateCell, `First available date ${marked.text}`);
    await this.page.waitForTimeout(1000);
    return {
      field: 'Booking date',
      status: marked.selected ? 'kept' : 'changed',
      before: null,
      after: marked.text,
      reason: marked.selected ? 'Only the already selected date was available.' : null
    };
  }

  async selectAlternativeEditTimeSlot() {
    await this.waitForEditFormReady();

    const getSlotsButton = this.page.getByRole('button', { name: /Get Slots/i }).first();
    if (await getSlotsButton.isVisible({ timeout: 1500 }).catch(() => false) &&
        await getSlotsButton.isEnabled().catch(() => false)) {
      await clickHighlighted(getSlotsButton, 'Get Slots');
      await this.page.waitForTimeout(1500);
    }

    for (let attempt = 0; attempt < 6; attempt++) {
      const marked = await this.page.evaluate(() => {
        document.querySelectorAll('[data-vc-edit-alt-time="true"]').forEach((element) => {
          element.removeAttribute('data-vc-edit-alt-time');
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

        const exactSlotPattern = /^\d{1,2}:\d{2}\s*(?:AM|PM)?\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM)?$/i;
        const candidates = Array.from(document.querySelectorAll('button, [role="button"], div, span'))
          .filter((element) => {
            const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
            const className = String(element.className || '').toLowerCase();
            const disabled = element.disabled ||
              element.getAttribute('aria-disabled') === 'true' ||
              className.includes('disabled');
            const rect = element.getBoundingClientRect();

            return exactSlotPattern.test(text) &&
              rect.left > 250 &&
              rect.top > 250 &&
              rect.width >= 80 &&
              rect.width <= 260 &&
              rect.height >= 20 &&
              rect.height <= 80 &&
              isVisible(element) &&
              !disabled &&
              !className.includes('selected');
          })
          .sort((left, right) => {
            const leftRect = left.getBoundingClientRect();
            const rightRect = right.getBoundingClientRect();
            return (leftRect.top - rightRect.top) ||
              (leftRect.left - rightRect.left) ||
              ((leftRect.width * leftRect.height) - (rightRect.width * rightRect.height));
          });

        const candidate = candidates[0];
        if (!candidate) {
          return null;
        }

        candidate.setAttribute('data-vc-edit-alt-time', 'true');
        const rect = candidate.getBoundingClientRect();
        return {
          text: (candidate.innerText || candidate.textContent || '').replace(/\s+/g, ' ').trim(),
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        };
      });

      if (!marked) {
        await this.page.waitForTimeout(1000);
        continue;
      }

      const timeSlot = this.page.locator('[data-vc-edit-alt-time="true"]').first();
      await timeSlot.scrollIntoViewIfNeeded().catch(() => null);
      await highlight(timeSlot, `First available time ${marked.text}`).catch(() => null);

      await this.page.evaluate(() => {
          const target = document.querySelector('[data-vc-edit-alt-time="true"]');
          if (!target) return;
          const clickable = target.closest('button, [role="button"]') || target;
          const rect = target.getBoundingClientRect();
          const eventInit = {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2
          };
          const topElement = document.elementFromPoint(eventInit.clientX, eventInit.clientY);
          const targets = [topElement, target, clickable].filter(Boolean);
          const uniqueTargets = Array.from(new Set(targets));

          for (const eventTarget of uniqueTargets) {
            const PointerCtor = window.PointerEvent || window.MouseEvent;
            eventTarget.dispatchEvent(new PointerCtor('pointerover', eventInit));
            eventTarget.dispatchEvent(new PointerCtor('pointerenter', eventInit));
            eventTarget.dispatchEvent(new MouseEvent('mouseover', eventInit));
            eventTarget.dispatchEvent(new MouseEvent('mouseenter', eventInit));
            eventTarget.dispatchEvent(new PointerCtor('pointerdown', eventInit));
            eventTarget.dispatchEvent(new MouseEvent('mousedown', eventInit));
            eventTarget.dispatchEvent(new PointerCtor('pointerup', eventInit));
            eventTarget.dispatchEvent(new MouseEvent('mouseup', eventInit));
            eventTarget.dispatchEvent(new MouseEvent('click', eventInit));
          }

          if (typeof clickable.click === 'function') {
            clickable.click();
          }
        });
      await this.page.mouse.click(marked.x, marked.y).catch(() => null);
      await this.page.waitForTimeout(1500);

      const saveEnabled = await this.page.getByRole('button', { name: 'Save Changes' }).first().isEnabled().catch(() => false);
      if (saveEnabled) {
        return { field: 'Time slot', status: 'changed', before: null, after: marked.text, reason: null };
      }
    }

    return { field: 'Time slot', status: 'kept', before: null, after: null, reason: 'No alternative time slot available or selectable.' };
  }

  async isBookingTimeStepVisible() {
    return await this.page.evaluate(() => {
      const text = document.body.innerText || '';
      return /Select a slot for your booking|Show more time slots|Morning\s+Afternoon|Afternoon\s+Evening|\b\d{1,2}:\d{2}\s*(?:AM|PM)?\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM)?\b/i.test(text);
    }).catch(() => false);
  }

  async isBookingDateStepVisible() {
    return await this.page.evaluate(() => {
      const text = document.body.innerText || '';
      return /Booking Date/i.test(text) &&
        !/Select a slot for your booking|Show more time slots|Morning\s+Afternoon|Afternoon\s+Evening/i.test(text);
    }).catch(() => false);
  }

  async completeAdditionalEditFields() {
    const results = [];

    const freeText = this.page.locator('input[name="Free Text 22"]').first();
    if (await freeText.isVisible({ timeout: 4000 }).catch(() => false)) {
      const value = `Updated by automation ${new Date().toISOString()}`;
      await fillHighlighted(freeText, value, 'Free Text 22');
      results.push({ field: 'Free Text 22', status: 'changed', before: null, after: value, reason: null });
    } else {
      results.push({ field: 'Free Text 22', status: 'kept', before: null, after: null, reason: 'Field not visible.' });
    }

    const selectField = this.page.locator('[id="mui-component-select-Select Field 24"]').first();
    if (await selectField.isVisible({ timeout: 3000 }).catch(() => false)) {
      results.push(await this.replaceDropdownWithAlternative({
        label: 'Select Field 24',
        selectors: [selectField],
        preferredOptions: ['D'],
        optional: true
      }));
    }

    const materialField = this.page.locator('[id="mui-component-select-Material List 277"]').first();
    if (await materialField.isVisible({ timeout: 3000 }).catch(() => false)) {
      results.push(await this.replaceDropdownWithAlternative({
        label: 'Material List 277',
        selectors: [materialField],
        preferredOptions: ['Electrical and Elecrtonics', 'Electrical and Electronics'],
        optional: true
      }));
    }

    return results;
  }

  async safeSaveEditBookingSteps(options = {}) {
    const results = [];
    const requireDateTime = options.requireDateTime ?? false;
    const allowUnchangedDateTime = options.allowUnchangedDateTime ?? false;
    console.log('Saving edit booking with safe replacement of date and time slot...');

    const nextButton = this.page.getByRole('button', { name: /^Next$/i }).first();
    if (await nextButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickFormButton(/^Next$/i, 'Next');
    } else if (!await this.clickEditStepTab('Booking Date')) {
      throw new Error('Could not navigate to Booking Date step before selecting the first available date.');
    }

    if (await this.isBookingTimeStepVisible()) {
      const timeResult = await this.selectAlternativeEditTimeSlot();
      results.push(timeResult);

      if (requireDateTime && timeResult.status !== 'changed') {
        throw new Error(`Delivery edit could not select an available time slot: ${timeResult.reason || 'unknown reason'}`);
      }
    } else {
      const dateResult = await this.selectAlternativeEditDate();
      results.push(dateResult);

      if (requireDateTime && dateResult.status !== 'changed') {
        throw new Error(`Delivery edit could not select an available booking date: ${dateResult.reason || 'unknown reason'}`);
      }

      if (dateResult.status === 'changed' || !allowUnchangedDateTime) {
        await this.clickFormButton('Save Changes', 'Save Changes date');
      } else if (!await this.clickFormButtonIfEnabled('Save Changes', 'Save unchanged date')) {
        await this.clickEditStepTab('Booking Time');
      }

      if (await this.isBookingTimeStepVisible()) {
        const timeResult = await this.selectAlternativeEditTimeSlot();
        results.push(timeResult);

        if (requireDateTime && timeResult.status !== 'changed') {
          throw new Error(`Delivery edit could not select an available time slot: ${timeResult.reason || 'unknown reason'}`);
        }
      } else {
        const timeResult = { field: 'Time slot', status: 'kept', before: null, after: null, reason: 'Booking time step was not visible.' };
        results.push(timeResult);

        if (requireDateTime) {
          throw new Error(`Delivery edit could not select an available time slot: ${timeResult.reason}`);
        }
      }
    }

    const timeResult = results.find((result) => result.field === 'Time slot');
    if (!timeResult || timeResult.status === 'changed' || !allowUnchangedDateTime) {
      await this.clickFormButton('Save Changes', 'Save Changes time');
    } else if (!await this.clickFormButtonIfEnabled('Save Changes', 'Save unchanged time')) {
      await this.clickEditStepTab('Booking Details');
    }

    const activeCheckbox = this.page.locator('#active');
    if (await activeCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
      const wasChecked = await activeCheckbox.isChecked().catch(() => false);
      if (!wasChecked) {
        await checkHighlighted(activeCheckbox, 'Active');
      }
      results.push({ field: 'Active checkbox', status: wasChecked ? 'kept' : 'changed', before: wasChecked, after: true, reason: null });
    }

    if (!allowUnchangedDateTime ||
        !await this.clickFormButtonIfEnabled(/Save ChangesForward|Save Changes/i, 'Save Changes Forward')) {
      if (!allowUnchangedDateTime) {
        await this.clickFormButton(/Save ChangesForward|Save Changes/i, 'Save Changes Forward');
      } else {
        await this.clickEditStepTab('Additional Details');
      }
    }
    results.push(...await this.completeAdditionalEditFields());

    return results;
  }

  getEditReplacementSelectors() {
    return {
      accessPoint: [
        this.page.locator('#mui-component-select-accessPoint, [id*="accessPoint"]').first(),
        this.page.getByRole('combobox', { name: /gate/i }).first(),
        this.page.locator('[role="combobox"]').filter({ hasText: /gate/i }).first()
      ],
      vehicleType: [
        this.page.locator('#mui-component-select-vehicleType, [id*="vehicleType"]').first(),
        this.page.getByRole('combobox', { name: /truck|car|vehicle/i }).first()
      ],
      fuelType: [
        this.page.locator('#mui-component-select-fuelType, [id*="fuelType"]').first(),
        this.page.getByRole('combobox', { name: /diesel|petrol|electric|fuel/i }).first()
      ],
      resource: [
        this.page.locator('#mui-component-select-resource, [id*="resource"]').first(),
        this.page.locator('input[role="combobox"], input[aria-autocomplete="list"]').last(),
        this.page.locator('[role="combobox"]').last()
      ]
    };
  }

  async applySafeEditReplacementsForType(bookingType, options = {}) {
    const selectors = this.getEditReplacementSelectors();
    const results = [];
    const setup = projectManagementBookingPreferences();

    results.push(await this.replaceDropdownWithAlternative({
      label: 'Access point',
      selectors: selectors.accessPoint,
      preferredOptions: [setup.accessPointName, 'Gate 17', 'North Gate', 'South Gate'].filter(Boolean),
      optional: true
    }));

    if (bookingType !== 'Resource-only') {
      results.push(await this.replaceDropdownWithAlternative({
        label: 'Vehicle type',
        selectors: selectors.vehicleType,
        preferredOptions: [setup.vehicleName, 'Tipper Truck', 'Pump Truck', 'Car'].filter(Boolean),
        optional: true
      }));

      results.push(await this.replaceDropdownWithAlternative({
        label: 'Fuel type',
        selectors: selectors.fuelType,
        preferredOptions: [setup.vehicleFuelType, 'Electric', 'Diesel', 'Petrol'].filter(Boolean),
        optional: true
      }));
    }

    results.push(await this.replaceDropdownWithAlternative({
      label: 'Resource',
      selectors: selectors.resource,
      preferredOptions: [setup.resourceName, 'Forklift', 'Tower Crane'].filter(Boolean),
      optional: true
    }));

    const schedulingSection = this.page.locator('div').filter({ hasText: 'Scheduling InformationBooking' }).nth(5);
    if (await schedulingSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      await clickHighlighted(schedulingSection, 'Scheduling Information');
    }

    results.push(...await this.safeSaveEditBookingSteps({
      requireDateTime: options.requireDateTime ?? bookingType === 'Delivery',
      allowUnchangedDateTime: options.allowUnchangedDateTime ?? false
    }));

    return results;
  }

  async returnToEditSchedulingInformation() {
    console.log('Returning to Scheduling Information to try another availability combination...');

    for (let attempt = 0; attempt < 4; attempt++) {
      const schedulingSelector = await this.findFirstVisibleLocator(this.getEditReplacementSelectors().accessPoint);
      if (schedulingSelector) {
        await this.waitForEditFormReady();
        return;
      }

      const backButton = this.page.getByRole('button', { name: /^Back$/i }).first();
      if (!await backButton.isVisible({ timeout: 1500 }).catch(() => false)) {
        break;
      }

      await clickHighlighted(backButton, 'Back');
      await this.page.waitForTimeout(1500);

      if (await this.findFirstVisibleLocator(this.getEditReplacementSelectors().accessPoint)) {
        await this.waitForEditFormReady();
        return;
      }
    }

    await this.waitForEditFormReady();
  }

  async applyDeliveryEditReplacementsWithAvailability(options = {}) {
    const maxAttempts = options.maxAttempts ?? 4;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`Trying Delivery edit availability combination ${attempt}/${maxAttempts}...`);
        return await this.applySafeEditReplacementsForType('Delivery', { requireDateTime: true });
      } catch (error) {
        lastError = error;
        const availabilityIssue = /available booking date|available time slot|availability/i.test(error.message);

        if (!availabilityIssue || attempt === maxAttempts) {
          throw error;
        }

        console.log(`Availability combination ${attempt} did not work: ${error.message}`);
        await this.returnToEditSchedulingInformation();
      }
    }

    throw lastError || new Error('Delivery edit could not find an available date/time combination.');
  }

  async submitSafelyEditedBooking() {
    console.log('Submitting safely edited booking...');
    const submitButton = this.page.getByRole('button', { name: /Submit Booking|Submit/i }).first();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        break;
      }

      if (attempt === 0) {
        await this.clickEditStepTab('Additional Details');
      } else if (!await this.clickFormButtonIfEnabled(/Save ChangesForward|Save Changes/i, 'Advance edit form', 2000)) {
        await this.clickFormButtonIfEnabled(/^Next$/i, 'Next edit step', 2000);
      }

      await this.page.mouse.wheel(0, 700).catch(() => null);
      await this.page.waitForTimeout(1500);
    }

    if (await submitButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await submitButton.scrollIntoViewIfNeeded().catch(() => null);
      await clickHighlighted(submitButton, 'Submit Booking');
    } else {
      const markedSaveButton = await this.page.evaluate(() => {
        document.querySelectorAll('[data-vc-final-save-button="true"]').forEach((element) => {
          element.removeAttribute('data-vc-final-save-button');
        });

        const visible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 &&
            rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.pointerEvents !== 'none';
        };

        const buttons = Array.from(document.querySelectorAll('button, [role="button"]'))
          .filter((element) => {
            const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
            return /Save Changes/i.test(text) &&
              visible(element) &&
              !element.disabled &&
              element.getAttribute('aria-disabled') !== 'true';
          })
          .sort((left, right) => {
            const leftRect = left.getBoundingClientRect();
            const rightRect = right.getBoundingClientRect();
            return rightRect.top - leftRect.top || rightRect.left - leftRect.left;
          });

        const button = buttons[0];
        if (!button) {
          return false;
        }

        button.setAttribute('data-vc-final-save-button', 'true');
        return true;
      });

      if (markedSaveButton) {
        await clickHighlighted(this.page.locator('[data-vc-final-save-button="true"]').first(), 'Final Save Changes');
      } else {
        console.log('No final Submit Booking button was visible; continuing after saved edit steps.');
      }
    }

    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    await this.page.waitForTimeout(3000);
  }

  async performEditFormReplacementForAllTypes(options = {}) {
    const targetTypes = options.targetTypes || ['Delivery', 'Recurring', 'Multi-Vehicle', 'Resource-only'];
    const actionInterval = options.actionInterval ?? 2500;
    const attemptedBookingIds = new Set();
    const results = [];
    const processedBookingIds = [];

    await this.login();
    await this.navigateToBookingListViaDashboard();
    await this.applyDefaultViewFilter();
    await this.applyBookingListDateRange();

    for (const bookingType of targetTypes) {
      const startedAt = Date.now();
      const typeResult = {
        name: `Edit form replacement - ${bookingType}`,
        flowName: 'Edit Booking Form Replacement',
        bookingType,
        bookingId: null,
        status: 'passed',
        duration: 0,
        timestamp: new Date().toISOString(),
        fields: [],
        error: null
      };

      try {
        await this.returnToBookingListPage({ applyDefaultView: true, applyDateRange: true }).catch(async () => {
          await this.navigateToBookingListViaDashboard();
          await this.applyBookingListDateRange();
        });

        const booking = await this.selectScheduledBookingForEditType(bookingType, attemptedBookingIds);
        if (!booking) {
          typeResult.fields.push({
            field: 'Booking selection',
            status: 'kept',
            before: null,
            after: null,
            reason: `No editable scheduled ${bookingType} record was available.`
          });
          continue;
        }

        attemptedBookingIds.add(booking.bookingId);
        typeResult.bookingId = booking.bookingId;
        processedBookingIds.push(booking.bookingId);

        await this.clickEditBookingAction();
        typeResult.fields.push(...await this.applySafeEditReplacementsForType(bookingType));
        await this.submitSafelyEditedBooking();
      } catch (error) {
        typeResult.status = 'failed';
        typeResult.error = error.message;
      } finally {
        typeResult.duration = Date.now() - startedAt;
        results.push(typeResult);
        await this.page.waitForTimeout(actionInterval);
      }
    }

    return {
      bookingIds: processedBookingIds,
      tests: results
    };
  }

  async performDeliveryBookingEditFlow(options = {}) {
    console.log('Starting Delivery booking edit flow...');

    await this.login();
    await this.navigateToBookingListViaDashboard();
    await this.applyDefaultViewFilter();
    await this.applyBookingListDateRange();

    let bookingId = options.bookingId || process.env.EDIT_DELIVERY_BOOKING_ID || null;

    if (bookingId) {
      await this.selectBookingById(bookingId);
      await this.waitForBookingDetailsReady();
    } else {
      const booking = await this.selectPreferredDeliveryBookingForEdit() ||
        await this.selectScheduledBookingForEditType('Delivery', new Set(), { maxCandidates: 6 });
      if (!booking) {
        throw new Error('No editable Scheduled Delivery booking was available in the current date range.');
      }

      bookingId = booking.bookingId;
    }

    await this.clickEditBookingAction();
    const fields = await this.applyDeliveryEditReplacementsWithAvailability();
    await this.submitSafelyEditedBooking();

    console.log(`Delivery booking edit flow completed for booking: ${bookingId}`);
    return {
      bookingId,
      fields
    };
  }

  async closeAnyOpenModals() {
    console.log('🔄 Checking for open modals...');
    
    // Close booking details modal specifically first
    const bookingModal = this.page.locator('#myModal2');
    if (await bookingModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('📋 Closing booking details modal...');
      
      // Try multiple strategies to close the modal
      const closeStrategies = [
        // Strategy 1: Close button
        async () => {
          const closeButton = bookingModal.locator('.close, .btn-close, [data-dismiss="modal"], .modal-header .close').first();
          if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
            await closeButton.click({ force: true });
            return true;
          }
          return false;
        },
        // Strategy 2: Click outside modal
        async () => {
          await this.page.click('body', { position: { x: 10, y: 10 }, force: true });
          return true;
        },
        // Strategy 3: Press Escape
        async () => {
          await this.page.keyboard.press('Escape');
          return true;
        },
        // Strategy 4: Hide modal with JavaScript
        async () => {
          await this.page.evaluate(() => {
            const modal = document.querySelector('#myModal2');
            if (modal) {
              modal.style.display = 'none';
              modal.classList.remove('show');
              // Remove backdrop if exists
              const backdrop = document.querySelector('.modal-backdrop');
              if (backdrop) backdrop.remove();
            }
          });
          return true;
        }
      ];
      
      for (const strategy of closeStrategies) {
        try {
          await strategy();
          await this.page.waitForTimeout(1000);
          
          // Check if modal is closed
          if (!await bookingModal.isVisible({ timeout: 1000 }).catch(() => false)) {
            console.log('✅ Modal closed successfully');
            break;
          }
        } catch (error) {
          console.log(`Modal close strategy failed: ${error.message}`);
        }
      }
    }

    // Check for other modals and close them
    const otherModals = [
      '.modal.show',
      '.modal.fade.show',
      '[role="dialog"]'
    ];
    
    for (const modalSelector of otherModals) {
      const modal = this.page.locator(modalSelector);
      if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log(`🔄 Closing modal: ${modalSelector}`);
        try {
          await this.page.evaluate((selector) => {
            const modal = document.querySelector(selector);
            if (modal) {
              modal.style.display = 'none';
              modal.classList.remove('show');
            }
          }, modalSelector);
        } catch (error) {
          console.log(`Failed to close modal ${modalSelector}: ${error.message}`);
        }
      }
    }

    // Final cleanup - remove any modal backdrops
    await this.page.evaluate(() => {
      const backdrops = document.querySelectorAll('.modal-backdrop');
      backdrops.forEach(backdrop => backdrop.remove());
    });
    
    await this.page.waitForTimeout(500);
    console.log('✅ Modal check completed');
  }

  async closeSideBarModal() {
    console.log('❌ Closing side bar modal...');
    
    if (await this.sideBarModalButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await clickHighlighted(this.sideBarModalButton, 'Close modal');
    }
    
    console.log('✅ Modal closed');
  }

  async returnToBookingListPage(options = {}) {
    const applyDefaultView = options.applyDefaultView ?? false;
    const applyDateRange = options.applyDateRange ?? false;

    console.log('Returning to Booking List page...');

    await this.closeSideBarModal();
    await this.closeAnyOpenModals();

    if (await this.bookingListLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clickHighlighted(this.bookingListLink, 'Booking List');
      await this.waitForBookingListToLoad();
    } else {
      await this.page.waitForLoadState('domcontentloaded').catch(() => null);
      await this.page.getByRole('heading', { name: 'Booking List' }).waitFor({
        state: 'visible',
        timeout: 10000
      });
    }

    if (applyDefaultView) {
      await this.applyDefaultViewFilter();
    }

    if (applyDateRange) {
      await this.applyBookingListDateRange();
    }

    console.log('Booking List page is visible');
  }

  async selectBookingDate(dateText) {
    console.log(`📅 Selecting booking date: ${dateText}`);
    
    const dateCell = this.page.getByRole('cell', { name: dateText });
    await clickHighlighted(dateCell.first(), `Date ${dateText}`);
    
    console.log(`✅ Date ${dateText} selected`);
  }

  async verifyBookingStatus(expectedStatus) {
    console.log(`🔍 Verifying booking status: ${expectedStatus}`);
    
    const statusElement = this.page.getByText(expectedStatus, { exact: true });
    const isVisible = await statusElement.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (isVisible) {
      console.log(`✅ Booking status verified: ${expectedStatus}`);
      return true;
    } else {
      console.log(`❌ Expected status '${expectedStatus}' not found`);
      return false;
    }
  }

  // Main workflow for editing booking
  async editExistingBooking(bookingId = 'BK5ET10000003763') {
    try {
      console.log('🚀 Starting edit booking workflow...');
      
      // Login and navigation using DashboardPage
      await this.login();
      await this.navigateToBookingListViaDashboard();
      
      // Select and edit booking
      await this.selectBookingById(bookingId);
      await this.checkInBooking();
      await this.checkOutBooking();
      
      // Undo operations (as per original flow)
      await this.undoBookingAction();
      await this.undoBookingAction();
      
      // Close modal and interact with date
      await this.closeSideBarModal();
      await this.selectBookingDate('Wed, 6th May');
      
      // Final check in/out cycle
      await this.page.getByText('Check In').click();
      await this.checkOutBooking();
      await this.closeSideBarModal();
      
      // Verify final status
      await this.verifyBookingStatus('Checked out');
      
      console.log('✅ Edit booking workflow completed successfully');
      
    } catch (error) {
      console.error('❌ Edit booking workflow failed:', error.message);
      throw error;
    }
  }

  async performScheduledRegressionScenario() {
    try {
      console.log('Starting Scheduled booking regression scenario...');

      await this.login();
      await this.navigateToBookingListViaDashboard();
      await this.openScheduledTab();

      const bookingId = await this.selectFirstScheduledBooking();
      console.log(`Selected Scheduled booking: ${bookingId}`);

      console.log('Clicking Check In...');
      await this.checkInBooking({ keepBookingDetailsOpen: true });

      console.log('Clicking Check Out...');
      await this.checkOutBooking({ keepBookingDetailsOpen: true });

      console.log('Clicking Undo...');
      await this.undoBookingAction({ keepBookingDetailsOpen: true });

      console.log('Clicking Check Out again...');
      await this.checkOutBooking({ keepBookingDetailsOpen: true });

      await this.returnToBookingListPage();

      console.log(`Scheduled booking regression scenario completed for booking: ${bookingId}`);
      return bookingId;
    } catch (error) {
      console.error('Scheduled booking regression scenario failed:', error.message);
      throw error;
    }
  }

  async performEditBookingRegressionScenario(options = {}) {
    const actionInterval = options.actionInterval ?? 3000;
    const undoInterval = options.undoInterval ?? actionInterval;

    try {
      console.log('Starting full edit booking regression scenario...');

      await this.login();
      await this.navigateToBookingListViaDashboard();
      await this.applyDefaultViewFilter();
      await this.applyBookingListDateRange();

      const bookingId = await this.selectFirstScheduledBooking();
      console.log(`Selected Scheduled booking: ${bookingId}`);

      console.log('Clicking Check In...');
      await this.checkInBooking({ keepBookingDetailsOpen: true });

      console.log(`Waiting ${actionInterval}ms before checkout...`);
      await this.page.waitForTimeout(actionInterval);

      console.log('Clicking Check Out...');
      await this.checkOutBooking({ keepBookingDetailsOpen: true });

      console.log('Returning to Booking List before reopening the same booking...');
      await this.returnToBookingListPage({ applyDefaultView: true, applyDateRange: true });

      console.log(`Reopening the same booking: ${bookingId}`);
      await this.selectBookingById(bookingId);
      await this.waitForBookingDetailsReady();

      console.log('Clicking Undo for the same booking...');
      await this.undoBookingAction({ keepBookingDetailsOpen: true });

      console.log(`Waiting ${undoInterval}ms before second undo...`);
      await this.page.waitForTimeout(undoInterval);

      console.log('Clicking Undo again for the same booking...');
      await this.undoBookingAction({ keepBookingDetailsOpen: true });

      console.log(`Waiting ${undoInterval}ms before cancel...`);
      await this.page.waitForTimeout(undoInterval);

      console.log('Clicking Cancel...');
      await this.cancelBooking({ keepBookingDetailsOpen: true });

      await this.returnToBookingListPage({ applyDefaultView: true, applyDateRange: true });

      console.log(`Full edit booking regression scenario completed for booking: ${bookingId}`);
      return bookingId;
    } catch (error) {
      console.error('Full edit booking regression scenario failed:', error.message);
      throw error;
    }
  }

  async performRecordedEditBookingFormScenario(bookingId = 'BK5ET10000003797') {
    try {
      console.log('Starting recorded edit booking form scenario...');

      await this.login();
      await this.navigateToBookingListViaDashboard();
      await this.selectBookingById(bookingId);

      console.log('Undoing booking where available before editing...');
      for (let attempt = 1; attempt <= 2; attempt++) {
        const undoClicked = await this.clickBookingDetailsActionIfAvailable('Undo', ['Reinstate']);

        if (!undoClicked) {
          console.log(`Undo action not available on attempt ${attempt}; continuing to Edit Booking.`);
          break;
        }

        await this.confirmUndoPromptVisible();
        await this.page.waitForTimeout(1500);
        console.log(`Undo attempt ${attempt} completed`);
      }

      await this.clickEditBookingAction();

      await this.selectAccessPoint('North Gate');
      await this.selectVehicleType('Tipper Truck');
      await this.selectFuelType('Diesel');

      const schedulingSection = this.page.locator('div').filter({ hasText: 'Scheduling InformationBooking' }).nth(5);
      if (await schedulingSection.isVisible({ timeout: 5000 }).catch(() => false)) {
        await clickHighlighted(schedulingSection, 'Scheduling Information');
      }

      await this.selectResource('Forklift');
      await this.saveEditBookingSteps();
      await this.submitEditedBooking();

      console.log(`Recorded edit booking form scenario completed for booking: ${bookingId}`);
      return bookingId;
    } catch (error) {
      console.error('Recorded edit booking form scenario failed:', error.message);
      throw error;
    }
  }

  // Simplified check-in/check-out workflow
  async performCheckInOut(bookingId = null) {
    let selectedBookingId = bookingId;
    if (bookingId) {
      console.log(`🔄 Performing check-in/out for specific booking: ${bookingId}`);
      await this.selectBookingById(bookingId);
    } else {
      console.log('🔄 Performing check-in/out for first "Scheduled" booking...');
      selectedBookingId = await this.selectFirstScheduledBooking();
      console.log(`📋 Selected booking: ${selectedBookingId}`);
    }
    
    await this.checkInBooking();
    await this.checkOutBooking();
    
    console.log('✅ Check-in/out completed');
    return selectedBookingId;
  }

  // Enhanced workflow specifically for Check In bookings
  async performCheckInEditFlow(bookingId = null) {
    try {
      console.log('🚀 Starting Check In booking edit flow...');
      
      if (bookingId) {
        console.log(`🎯 Targeting specific booking: ${bookingId}`);
        await this.selectBookingById(bookingId);
      } else {
        console.log('🔍 Auto-selecting first "Check in" booking...');
        const selectedBookingId = await this.selectFirstCheckInBooking();
        console.log(`📋 Selected Check in booking: ${selectedBookingId}`);
        bookingId = selectedBookingId;
      }
      
      // Close any open modals first
      await this.closeAnyOpenModals();
      
      // Perform check-in
      console.log('✅ Performing check-in...');
      await this.checkInBooking();
      await this.page.waitForTimeout(2000); // Wait for status update
      
      // Verify check-in status
      const checkedIn = await this.verifyBookingStatus('Checked in');
      if (checkedIn) {
        console.log('✅ Check-in verified successfully');
      }
      
      // Perform check-out
      console.log('🚪 Performing check-out...');
      await this.checkOutBooking();
      await this.page.waitForTimeout(2000); // Wait for status update
      
      // Verify check-out status
      const checkedOut = await this.verifyBookingStatus('Checked out');
      if (checkedOut) {
        console.log('✅ Check-out verified successfully');
      }
      
      // Close any remaining modals
      await this.closeAnyOpenModals();
      
      console.log(`✅ Check In booking edit flow completed successfully for booking: ${bookingId}`);
      return bookingId;
      
    } catch (error) {
      console.error('❌ Check In booking edit flow failed:', error.message);
      
      // Capture screenshot on failure
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const screenshotPath = path.join('screenshots', `check_in_edit_failure_${timestamp}.png`);
        fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
        await this.page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`📸 Failure screenshot saved: ${screenshotPath}`);
      } catch (screenshotError) {
        console.log('Could not capture failure screenshot:', screenshotError.message);
      }
      
      throw error;
    }
  }

  // Complete Check In booking automation workflow
  async automateCheckInBookingEdit() {
    try {
      console.log('🚀 Starting complete Check In booking automation...');
      
      // Login and navigation
      await this.login();
      await this.navigateToBookingListViaDashboard();
      
      // Perform the check-in edit flow
      let bookingId;

      try {
        bookingId = await this.performCheckInEditFlow();
      } catch (scheduledError) {
        console.log('⚠️ Scheduled booking flow was not available. Trying any available booking...');
        bookingId = await this.selectFirstAvailableBooking();
        await this.performCheckInOut(bookingId);
      }
      
      console.log(`✅ Complete Check In booking automation completed for booking: ${bookingId}`);
      return bookingId;
      
    } catch (error) {
      console.error('❌ Complete Check In booking automation failed:', error.message);
      throw error;
    }
  }

  // Booking status management
  async reinstateBooking(bookingId) {
    console.log(`🔄 Reinstating booking: ${bookingId}`);
    
    await this.selectBookingById(bookingId);
    await this.undoBookingAction();
    
    console.log('✅ Booking reinstated');
  }

  async isVisible(locator) {
    return locator.isVisible().catch(() => false);
  }
}

module.exports = { EditBookingPage };
