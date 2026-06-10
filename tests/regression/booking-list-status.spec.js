const {
  expect,
  expectVisible,
  openBookingList,
  runStep,
  test
} = require('../support/test-base');
const { BookingListPage } = require('../../pages/booking/booking-list.page');

const BOOKING_LIST_STEP_WAIT_MS = Number(process.env.BOOKING_LIST_STEP_WAIT_MS || 4000);

async function runSlowBookingListStep(page, title, action, validate) {
  await runStep(page, title, async () => {
    await page.waitForTimeout(BOOKING_LIST_STEP_WAIT_MS);
    await action();
    await page.waitForTimeout(BOOKING_LIST_STEP_WAIT_MS);
  }, validate);
}

test.describe('Regression Tests - Booking List Status Actions', () => {
  test.describe.configure({ mode: 'serial' });

  test('Regression TC-07 - Booking List All count matches status counts across pagination', async ({ page }) => {
    const bookingList = new BookingListPage(page);
    let tabCounts;
    let paginatedCounts;

    await runSlowBookingListStep(page, 'Open Booking List', async () => {
      await openBookingList(page);
      await bookingList.waitForList();
    }, async () => {
      await expectVisible(page.getByRole('button', { name: /New Booking/i }), 'New Booking button');
    });

    await runSlowBookingListStep(page, 'Verify All count equals visible status tab counts', async () => {
      tabCounts = await bookingList.getStatusTabCounts();
      await bookingList.pause('All count verification');
    }, async () => {
      const missingCounts = ['All', ...bookingList.statuses].filter((status) => !Number.isInteger(tabCounts[status]));
      expect(missingCounts).toEqual([]);
      expect(tabCounts.All).toBeGreaterThanOrEqual(0);
    });

    await runSlowBookingListStep(page, 'Verify each status count with pagination', async () => {
      paginatedCounts = await bookingList.getPaginatedStatusCounts(tabCounts);
      await bookingList.pause('pagination status count verification');
      await bookingList.openCountVerificationResultTab(tabCounts, paginatedCounts);
    }, async () => {
      const statusTabTotal = bookingList.countableStatuses.reduce((total, status) => total + tabCounts[status], 0);
      const paginatedTotal = bookingList.countableStatuses.reduce((total, status) => total + paginatedCounts[status], 0);
      for (const status of bookingList.statuses) {
        expect(paginatedCounts[status], `${status} paginated count should match tab count`).toBe(tabCounts[status]);
      }
      expect(statusTabTotal).toBe(tabCounts.All);
      expect(paginatedTotal).toBe(tabCounts.All);
    });
  });

  test('Regression TC-08 - Scheduled row hover actions support Check-in and Check-out from Booking List', async ({ page }) => {
    const bookingList = new BookingListPage(page);
    let booking;
    let checkedInActions;

    await runSlowBookingListStep(page, 'Open Booking List', async () => {
      await openBookingList(page);
      await bookingList.waitForList();
    }, async () => {
      await expectVisible(page.getByRole('button', { name: /New Booking/i }), 'New Booking button');
    });

    await runSlowBookingListStep(page, 'Find Scheduled booking with Check-in and Refuse hover icons', async () => {
      booking = await bookingList.findScheduledBookingWithActions(['checkIn', 'refuse']);
      await bookingList.pause('Scheduled booking hover icon verification');
    }, async () => {
      expect(booking.bookingId).toMatch(/^BK[A-Z0-9]+/);
      expect(booking.actions.map((action) => action.type)).toEqual(expect.arrayContaining(['checkIn', 'refuse']));
    });

    await runSlowBookingListStep(page, 'Click Check-in icon and verify only Check-out remains', async () => {
      await bookingList.clickRowStatusAction(booking.bookingId, 'checkIn', 'Scheduled');
      await bookingList.pause('Check-in action');
      await bookingList.waitForBookingStatus(booking.bookingId, 'Checked In');
      await bookingList.pause('Checked In status update');
      checkedInActions = await bookingList.getRowStatusActions(booking.bookingId, 'Checked In');
      await bookingList.pause('Checked In hover action verification');
    }, async () => {
      const actionTypes = checkedInActions.map((action) => action.type);
      expect(actionTypes).toContain('checkOut');
      expect(actionTypes).not.toContain('checkIn');
      expect(actionTypes).not.toContain('refuse');
    });

    await runSlowBookingListStep(page, 'Click Check-out icon and verify Checked Out status', async () => {
      await bookingList.clickRowStatusAction(booking.bookingId, 'checkOut', 'Checked In');
      await bookingList.pause('Check-out action');
      await bookingList.waitForBookingStatus(booking.bookingId, 'Checked Out');
      await bookingList.pause('Checked Out status update');
    }, async () => {
      await expect(page.locator(`[data-vc-booking-row-id="${booking.bookingId}"]`)).toContainText(/Checked\s*-?\s*Out/i);
    });
  });

  test('Regression TC-09 - Refused Booking List row cannot be modified again', async ({ page }) => {
    const bookingList = new BookingListPage(page);
    let booking;
    let refusedActions;

    await runSlowBookingListStep(page, 'Open Booking List', async () => {
      await openBookingList(page);
      await bookingList.waitForList();
    }, async () => {
      await expectVisible(page.getByRole('button', { name: /New Booking/i }), 'New Booking button');
    });

    await runSlowBookingListStep(page, 'Find Scheduled booking with Refuse hover icon', async () => {
      booking = await bookingList.findScheduledBookingWithActions(['refuse']);
      await bookingList.pause('Refuse hover icon verification');
    }, async () => {
      expect(booking.bookingId).toMatch(/^BK[A-Z0-9]+/);
      expect(booking.actions.map((action) => action.type)).toContain('refuse');
    });

    await runSlowBookingListStep(page, 'Click Refuse icon and verify Refused status', async () => {
      await bookingList.clickRowStatusAction(booking.bookingId, 'refuse', 'Scheduled');
      await bookingList.pause('Refuse action');
      await bookingList.waitForBookingStatus(booking.bookingId, 'Refused');
      await bookingList.pause('Refused status update');
      refusedActions = await bookingList.getRowStatusActions(booking.bookingId, 'Refused');
      await bookingList.pause('Refused row non-modifiable verification');
    }, async () => {
      expect(refusedActions.map((action) => action.type)).not.toEqual(expect.arrayContaining(['checkIn', 'checkOut', 'refuse']));
    });
  });

  test('Regression TC-10 - Booking List can be sorted by Booking Ref', async ({ page }) => {
    const bookingList = new BookingListPage(page);
    let sortedRefs;

    await runSlowBookingListStep(page, 'Open Booking List', async () => {
      await openBookingList(page);
      await bookingList.waitForList();
    }, async () => {
      await expectVisible(page.getByRole('button', { name: /New Booking/i }), 'New Booking button');
    });

    await runSlowBookingListStep(page, 'Sort Booking List by Booking Ref', async () => {
      sortedRefs = await bookingList.sortByBookingRef('ascending');
      await bookingList.pause('Booking Ref sort verification');
    }, async () => {
      expect(sortedRefs.length).toBeGreaterThan(0);
      expect(bookingList.isBookingRefsSorted(sortedRefs, 'ascending')).toBe(true);
    });
  });
});
