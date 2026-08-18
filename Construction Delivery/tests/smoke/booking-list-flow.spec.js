const {
  expect,
  expectVisible,
  openBookingList,
  runStep,
  test
} = require('../support/test-base');
const { BookingListPage } = require('../../pages/booking/booking-list.page');
const { Filter } = require('../../pages/booking/filter.page');

test.describe('Smoke Tests - Booking List Flow', () => {
  test('Booking List tab complete non-mutating flow', async ({ page }) => {
    const bookingList = new BookingListPage(page);
    const filter = new Filter(page);
    let statusCounts;
    let sortedRefs;
    let visitedStatuses = [];
    let filterResult;

    await runStep(page, 'Open Booking List tab', async () => {
      await openBookingList(page);
      await bookingList.waitForList();
    }, async () => {
      await expectVisible(page.getByRole('button', { name: /New Booking/i }), 'New Booking button');
    });

    await runStep(page, 'Verify Booking List status counts', async () => {
      statusCounts = await bookingList.getStatusTabCounts();
    }, async () => {
      const missingCounts = ['All', ...bookingList.statuses].filter((status) => !Number.isInteger(statusCounts[status]));
      expect(missingCounts).toEqual([]);
      expect(statusCounts.All).toBeGreaterThanOrEqual(0);
    });

    await runStep(page, 'Sort Booking List by Booking Ref', async () => {
      sortedRefs = await bookingList.sortByBookingRef('ascending');
    }, async () => {
      expect(sortedRefs.length).toBeGreaterThan(0);
      expect(bookingList.isBookingRefsSorted(sortedRefs, 'ascending')).toBe(true);
    });

    await runStep(page, 'Visit Booking List status tabs', async () => {
      for (const status of bookingList.statuses) {
        await bookingList.openStatusTab(status);
        visitedStatuses.push(status);
      }
    }, async () => {
      expect(visitedStatuses).toEqual(bookingList.statuses);
    });

    await runStep(page, 'Apply Booking List filters', async () => {
      await openBookingList(page);
      filterResult = await filter.applyCodegenRecordedFilterFlow({
        includeCalendarRecordFlow: false,
        skipLayout: true,
        allowEmptyFilterResults: true
      });
    }, async () => {
      expect(filterResult.selections.length).toBeGreaterThan(0);
      expect(
        filterResult.finalRecordCount > 0 || filterResult.finalEmptyFilterResultAccepted
      ).toBe(true);
    });
  });
});
