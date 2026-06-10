const { chromium } = require('playwright');
const { Filter } = require('../pages/booking/filter.page');
const { EditBookingPage } = require('../pages/booking/edit.booking.page');

(async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: process.argv.includes('--headless') || false
  });
  const context = await browser.newContext({
    storageState: 'auth.json',
    ignoreHTTPSErrors: true,
    viewport: { width: 1600, height: 900 }
  });
  const page = await context.newPage();

  try {
    await page.goto('https://stg-app.voyagecontrol.com/5ET10000010/booking', {
      waitUntil: 'domcontentloaded'
    });

    const filter = new Filter(page);
    await filter.navigateToCalendarScreen();
    await filter.selectBookingScope('My Bookings').catch(() => null);
    await filter.openFilterPanel();
    await filter.selectAdvancedFilterValues();
    await filter.applyFiltersAndWait();
    await filter.waitForCalendar();

    const hoverDetails = await filter.hoverFirstCalendarBooking('Calendar');
    await filter.openFirstCalendarBooking('Calendar');
    await page.getByRole('button', { name: /Edit Booking|Edit/i }).first().click();
    await filter.clickThisBookingOnlyForCalendarEditIfVisible();
    await page.getByRole('heading', { name: /Edit Booking/i }).waitFor({ state: 'visible', timeout: 30000 });

    const editBooking = new EditBookingPage(page);
    await editBooking.waitForEditFormReady();
    if (await page.getByRole('button', { name: /^Next$/i }).first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await editBooking.clickFormButton('Next', 'Next');
    } else {
      await editBooking.clickEditStepTab('Booking Date');
    }
    await page.getByText('Choose date', { exact: true }).first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => null);
    await editBooking.openEditBookingDatePicker();
    await page.mouse.click(374, 268).catch(() => null);
    await page.waitForTimeout(2000);

    const snapshot = await page.evaluate(() => {
      const visible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      };

      return Array.from(document.querySelectorAll('button, [role="button"], [role="grid"], [role="gridcell"], [role="dialog"], .MuiDateCalendar-root, .MuiPickersPopper-root, .MuiPopover-root, [class*="calendar"], [class*="Calendar"], [class*="date"], [class*="Date"]'))
        .filter(visible)
        .slice(0, 160)
        .map((element, index) => {
          const rect = element.getBoundingClientRect();
          return {
            index,
            tag: element.tagName,
            role: element.getAttribute('role'),
            text: (element.innerText || element.textContent || element.getAttribute('aria-label') || element.value || '').replace(/\s+/g, ' ').trim().slice(0, 160),
            className: String(element.className || '').slice(0, 160),
            disabled: Boolean(element.disabled) || element.getAttribute('aria-disabled') || element.getAttribute('disabled'),
            rect: [Math.round(rect.left), Math.round(rect.top), Math.round(rect.width), Math.round(rect.height)]
          };
        });
    });

    console.log(JSON.stringify({
      url: page.url(),
      hoverDetails,
      body: (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim().slice(0, 3000),
      snapshot
    }, null, 2));
  } finally {
    await context.close().catch(() => null);
    await browser.close().catch(() => null);
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
