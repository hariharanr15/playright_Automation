const {
  expectVisible,
  openAuthenticatedDashboard,
  openBookingList,
  runStep,
  test
} = require('../support/test-base');
const { DashboardPage } = require('../../pages/dashboard.page');
const { DeliveryBookingPage } = require('../../pages/booking/delivery.booking.page');
const { Filter } = require('../../pages/booking/Filter');

test.describe('Smoke Tests - Booking Application', () => {
  test.describe.configure({ mode: 'serial' });

  test('Smoke TC-01 - authenticated dashboard and booking list are accessible', async ({ page }) => {
    const dashboard = new DashboardPage(page);

    await runStep(page, 'Open authenticated dashboard', async () => {
      await openAuthenticatedDashboard(page);
    }, async () => {
      await expectVisible(dashboard.projectLink.or(dashboard.projectLinkFallback1), 'Project link');
    });

    await runStep(page, 'Select project', async () => {
      await dashboard.selectProject();
    }, async () => {
      await expectVisible(dashboard.location, 'Location heading');
    });

    await runStep(page, 'Select location', async () => {
      await dashboard.selectLocation();
    }, async () => {
      await expectVisible(dashboard.bookingMenu, 'Booking menu');
    });

    await runStep(page, 'Open booking list', async () => {
      await dashboard.goToBookings();
    }, async () => {
      await expectVisible(page.getByRole('button', { name: /New Booking/i }), 'New Booking button');
    });
  });

  test('Smoke TC-02 - delivery booking reaches time-slot selection', async ({ page }) => {
    const deliveryBooking = new DeliveryBookingPage(page);

    await runStep(page, 'Open Booking List', async () => {
      await openBookingList(page);
    }, async () => {
      await expectVisible(page.getByRole('button', { name: /New Booking/i }), 'New Booking button');
    });

    await runStep(page, 'Start New Booking', async () => {
      await deliveryBooking.startNewBooking();
    }, async () => {
      await expectVisible(page.getByText(/What kind of booking do you/i), 'Booking type selection');
    });

    await runStep(page, 'Select Delivery booking type', async () => {
      await deliveryBooking.selectBookingType();
    }, async () => {
      await deliveryBooking.waitForStep('Scheduling Information');
    });

    await runStep(page, 'Complete Scheduling Information', async () => {
      await deliveryBooking.completeSchedulingInformation();
    }, async () => {
      await deliveryBooking.waitForStep('Booking Date');
    });

    await runStep(page, 'Select Booking Date', async () => {
      await deliveryBooking.selectFirstAvailableBookingDate();
    }, async () => {
      await deliveryBooking.waitForStep('Booking Time');
    });

    await runStep(page, 'Select Booking Time', async () => {
      await deliveryBooking.selectFirstAvailableBookingTime();
    }, async () => {
      await expectVisible(page.locator('body'), 'Delivery booking time-slot state');
    });
  });

  test('Smoke TC-03 - booking list filters can be applied', async ({ page }) => {
    const filter = new Filter(page);
    let result;

    await runStep(page, 'Open Booking List', async () => {
      await openBookingList(page);
    }, async () => {
      await expectVisible(page.getByRole('button', { name: /New Booking/i }), 'New Booking button');
    });

    await runStep(page, 'Apply Booking List filters', async () => {
      result = await filter.applyCodegenRecordedFilterFlow({
        includeCalendarRecordFlow: false,
        skipLayout: true
      });
    }, async () => {
      if (!result || result.finalRecordCount < 1) {
        throw new Error('Filtered Booking List did not return records.');
      }
    });
  });
});
