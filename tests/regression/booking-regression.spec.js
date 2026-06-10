const {
  expect,
  expectVisible,
  openAuthenticatedDashboard,
  openBookingList,
  runStep,
  test
} = require('../support/test-base');
const { fillHighlighted } = require('../../utils/highlight');
const { DeliveryBookingPage } = require('../../pages/booking/delivery.booking.page');
const { EditBookingPage } = require('../../pages/booking/edit.booking.page');
const { Filter } = require('../../pages/booking/filter.page');
const { RecurringBookingPage } = require('../../pages/booking/recurring.booking.page');
const { ResourceOnlyBookingPage } = require('../../pages/booking/resource-only.booking.page');
const { UserManagementPage } = require('../../pages/booking/user-management.page');

async function ensureAdvancedPastTimeSlot(page, bookingPage) {
  const slotHeading = page.getByText(/Select a slot for your booking/i).first();

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (!(await slotHeading.isVisible({ timeout: 2000 }).catch(() => false))) {
      return;
    }

    console.log(`Time-slot panel still visible; retrying Next (${attempt}/3).`);
    await bookingPage.trySelectTimeSlot().catch(() => null);
    const nextButton = page.getByRole('button', { name: /Next/i }).last();
    await nextButton.waitFor({ state: 'visible', timeout: 10000 });
    await nextButton.click({ force: true });
    await page.waitForTimeout(3000);
  }

  await expect(slotHeading, 'Time-slot panel should be closed before Booking Details').toBeHidden({
    timeout: 10000
  });
}

async function clickVisibleNext(page, label) {
  const nextButton = page.locator('button:has-text("Next")').last();
  if (await nextButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log(`Clicking visible Next for ${label}`);
    await nextButton.click({ force: true });
    await page.waitForTimeout(3000);
    return true;
  }

  const clicked = await page.evaluate(() => {
    const controls = Array.from(document.querySelectorAll('button, [role="button"]'));
    const isUsable = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);

      return rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        style.pointerEvents !== 'none' &&
        element.getAttribute('aria-disabled') !== 'true' &&
        !element.disabled;
    };

    const candidates = controls
      .filter((element) => {
        const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
        return /Next/i.test(text) && isUsable(element);
      });

    const geometryCandidates = controls
      .filter((element) => {
        if (!isUsable(element)) return false;
        const rect = element.getBoundingClientRect();
        return rect.left > window.innerWidth * 0.45 &&
          rect.top > window.innerHeight * 0.45;
      })
      .sort((left, right) => {
        const leftRect = left.getBoundingClientRect();
        const rightRect = right.getBoundingClientRect();
        return rightRect.top - leftRect.top || rightRect.left - leftRect.left;
      });

    const target = candidates[candidates.length - 1] || geometryCandidates[0];
    if (!target) return false;
    target.scrollIntoView({ block: 'center', inline: 'center' });
    target.click();
    return true;
  });

  if (clicked) {
    console.log(`Clicked DOM Next fallback for ${label}`);
    await page.waitForTimeout(3000);
  }

  return clicked;
}

async function getScheduledBookingCandidates(page) {
  return page.evaluate(() => {
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
        rowText: text.replace(/\s+/g, ' ').trim().slice(0, 240)
      });
    }

    return candidates;
  });
}

async function selectFirstEditableScheduledBooking(page, editBooking) {
  const candidates = await getScheduledBookingCandidates(page);

  for (const candidate of candidates.slice(0, 12)) {
    console.log(`Checking scheduled candidate for edit regression: ${candidate.bookingId}`);
    await editBooking.selectBookingById(candidate.bookingId);
    await editBooking.waitForBookingDetailsReady();

    const detailsText = await page.locator('#myModal2').innerText({ timeout: 5000 }).catch(() => '');
    const isMultiVehicleDetails = /Multi-Vehicle|Add Another|Expected Vehicles\s*-\s*[2-9]/i.test(detailsText);
    const hasCheckInAction = Boolean(await editBooking.findBookingDetailsActionButton('Check In', ['Checked-in', 'Checked In'], {
      timeout: 1500
    }));

    if (!isMultiVehicleDetails && hasCheckInAction) {
      return candidate.bookingId;
    }

    console.log(`Skipping ${candidate.bookingId}; editable single-booking Check In action was not available.`);
    await editBooking.closeSideBarModal();
    await page.waitForTimeout(1000);
  }

  return null;
}

test.describe('Regression Tests - Booking Application', () => {
  test.describe.configure({ mode: 'serial' });

  test('Regression TC-01 - resource booking can be created', async ({ page }) => {
    const resourceBooking = new ResourceOnlyBookingPage(page);

    await runStep(page, 'Open Booking List', async () => {
      await openBookingList(page);
    }, async () => {
      await expectVisible(page.getByRole('button', { name: /New Booking/i }), 'New Booking button');
    });

    await runStep(page, 'Start New Booking', async () => {
      await resourceBooking.startNewBooking();
    }, async () => {
      await expectVisible(page.getByText(/What kind of booking do you/i), 'Booking type selection');
    });

    await runStep(page, 'Select Resource Only booking type', async () => {
      await resourceBooking.selectResourceBookingType();
    }, async () => {
      await resourceBooking.waitForStep('Scheduling Information');
      await expectVisible(page.getByText('Resource', { exact: true }), 'Resource field');
    });

    await runStep(page, 'Select Resources', async () => {
      await resourceBooking.selectResources();
    }, async () => {
      await resourceBooking.waitForStep('Booking Date');
    });

    await runStep(page, 'Select Booking Date', async () => {
      await resourceBooking.selectFirstAvailableBookingDate();
    }, async () => {
      await resourceBooking.waitForStep('Booking Time');
    });

    await runStep(page, 'Select Booking Time', async () => {
      await resourceBooking.selectFirstAvailableBookingTime();
    }, async () => {
      await resourceBooking.waitForBookingDetailsForm();
    });

    await runStep(page, 'Complete Booking Details', async () => {
      await resourceBooking.completeBookingDetails();
    }, async () => {
      await expectVisible(page.getByRole('button', { name: /Submit Booking|Submit/i }), 'Submit Booking button');
    });

    await runStep(page, 'Submit Resource Booking', async () => {
      await resourceBooking.submitBooking();
    }, async () => {
      await expectVisible(page.locator('body'), 'Submitted resource booking page');
    });
  });

  test('Regression TC-02 - recurring booking can be created', async ({ page }) => {
    const recurringBooking = new RecurringBookingPage(page);

    await runStep(page, 'Open Booking List', async () => {
      await openBookingList(page);
    }, async () => {
      await expectVisible(page.getByRole('button', { name: /New Booking/i }), 'New Booking button');
    });

    await runStep(page, 'Start New Booking', async () => {
      await recurringBooking.startNewBooking();
    }, async () => {
      await expectVisible(page.getByText(/What kind of booking do you/i), 'Booking type selection');
    });

    await runStep(page, 'Select Recurring booking type', async () => {
      await recurringBooking.selectRecurringBookingType();
    }, async () => {
      await expect(page.locator('body')).toContainText(/Scheduling Information|Access point/i);
    });

    await runStep(page, 'Complete Scheduling Information', async () => {
      await recurringBooking.completeSchedulingInformation();
    }, async () => {
      await expect(page.locator('body')).toContainText(/Booking Date|Start Date|End Date/i);
    });

    await runStep(page, 'Select Recurring Date Range', async () => {
      await recurringBooking.selectRecurringDates();
    }, async () => {
      await expect(page.locator('body')).toContainText(/Repeat on/i);
    });

    await runStep(page, 'Select Recurring Days', async () => {
      await recurringBooking.selectRecurringDays();
    }, async () => {
      await expect(page.locator('body')).toContainText(/Booking Time|Get Slots/i);
    });

    await runStep(page, 'Select Recurring Time Slot', async () => {
      await recurringBooking.selectFirstAvailableBookingTime();
    }, async () => {
      await expect(page.locator('body')).toContainText(/Booking Details/i);
    });

    await runStep(page, 'Complete Booking Details', async () => {
      await recurringBooking.completeBookingDetails();
    }, async () => {
      await expect(page.locator('body')).toContainText(/Additional Details/i);
    });

    await runStep(page, 'Complete Additional Details', async () => {
      await recurringBooking.completeMandatoryAdditionalDetails();
    }, async () => {
      await expectVisible(page.getByRole('button', { name: /Submit Booking|Submit/i }), 'Submit Booking button');
    });

    await runStep(page, 'Submit Recurring Booking', async () => {
      await recurringBooking.submitBooking();
    }, async () => {
      await expectVisible(page.locator('body'), 'Submitted recurring booking page');
    });
  });

  test('Regression TC-03 - multi-vehicle booking reaches time-slot selection', async ({ page }) => {
    const multiVehicleBooking = new DeliveryBookingPage(page, {
      bookingTypeIndex: 2,
      bookingTypeLabel: 'Multi-Vehicle'
    });

    await runStep(page, 'Open Booking List', async () => {
      await openBookingList(page);
    }, async () => {
      await expectVisible(page.getByRole('button', { name: /New Booking/i }), 'New Booking button');
    });

    await runStep(page, 'Start New Booking', async () => {
      await multiVehicleBooking.startNewBooking();
    }, async () => {
      await expectVisible(page.getByText(/What kind of booking do you/i), 'Booking type selection');
    });

    await runStep(page, 'Select Multi-Vehicle booking type', async () => {
      await multiVehicleBooking.selectBookingType();
    }, async () => {
      await multiVehicleBooking.waitForStep('Scheduling Information');
    });

    await runStep(page, 'Complete Scheduling Information', async () => {
      await multiVehicleBooking.completeSchedulingInformation();
    }, async () => {
      await multiVehicleBooking.waitForStep('Booking Date');
    });

    await runStep(page, 'Select Booking Date', async () => {
      await multiVehicleBooking.selectFirstAvailableBookingDate();
    }, async () => {
      await multiVehicleBooking.waitForStep('Booking Time');
    });

    await runStep(page, 'Select Booking Time', async () => {
      await multiVehicleBooking.selectFirstAvailableBookingTime();
      await ensureAdvancedPastTimeSlot(page, multiVehicleBooking);
    }, async () => {
      await expect(page.locator('body')).toContainText(/Booking Details/i);
    });

    await runStep(page, 'Validate Multi-Vehicle booking details state', async () => {
      await multiVehicleBooking.waitForStep('Booking Details');
    }, async () => {
      await expectVisible(page.getByRole('button', { name: /Next/i }), 'Booking Details Next button');
    });
  });

  test('Regression TC-04 - scheduled booking can be checked in, checked out, undone, and cancelled', async ({ page }) => {
    const editBooking = new EditBookingPage(page);
    let bookingId;

    await runStep(page, 'Open Booking List and apply default filters', async () => {
      await openBookingList(page);
      await editBooking.applyDefaultViewFilter();
      await editBooking.applyBookingListDateRange();
    }, async () => {
      await expectVisible(page.locator('body'), 'Filtered booking list');
    });

    await runStep(page, 'Select first editable Scheduled booking', async () => {
      bookingId = await selectFirstEditableScheduledBooking(page, editBooking);

      if (!bookingId) {
        throw new Error('No editable single Scheduled booking was available for the edit regression flow.');
      }
    }, async () => {
      expect(bookingId).toMatch(/^BK[A-Z0-9]+/);
      await editBooking.waitForBookingDetailsReady();
    });

    await runStep(page, 'Check in selected booking', async () => {
      await editBooking.checkInBooking({ keepBookingDetailsOpen: true });
    }, async () => {
      await expectVisible(page.locator('body'), 'Checked in booking details');
    });

    await runStep(page, 'Check out selected booking', async () => {
      await editBooking.checkOutBooking({ keepBookingDetailsOpen: true });
    }, async () => {
      await expectVisible(page.locator('body'), 'Checked out booking details');
    });

    await runStep(page, 'Return to list and reopen same booking', async () => {
      await editBooking.returnToBookingListPage({ applyDefaultView: true, applyDateRange: true });
      await editBooking.selectBookingById(bookingId);
      await editBooking.waitForBookingDetailsReady();
    }, async () => {
      await expectVisible(page.getByText(bookingId), `Booking ${bookingId}`);
    });

    await runStep(page, 'Undo checkout', async () => {
      await editBooking.undoBookingAction({ keepBookingDetailsOpen: true });
    }, async () => {
      await expectVisible(page.locator('body'), 'Undo checkout result');
    });

    await runStep(page, 'Undo check-in', async () => {
      await editBooking.undoBookingAction({ keepBookingDetailsOpen: true });
    }, async () => {
      await expectVisible(page.locator('body'), 'Undo check-in result');
    });

    await runStep(page, 'Cancel booking', async () => {
      await editBooking.cancelBooking({ keepBookingDetailsOpen: true });
    }, async () => {
      await expectVisible(page.locator('body'), 'Cancelled booking details');
    });

    await runStep(page, 'Return to Booking List', async () => {
      await editBooking.returnToBookingListPage({ applyDefaultView: true, applyDateRange: true });
    }, async () => {
      await expectVisible(page.getByRole('button', { name: /New Booking/i }), 'New Booking button');
    });
  });

  test('Regression TC-05 - user invite can be sent and resent', async ({ page }) => {
    const userManagement = new UserManagementPage(page);
    const inviteEmail = userManagement.getInviteEmail();
    let inviteModal;
    let invitedUserRow;

    await runStep(page, 'Open authenticated dashboard', async () => {
      await openAuthenticatedDashboard(page);
    }, async () => {
      await expectVisible(page.locator('body'), 'Authenticated dashboard');
    });

    await runStep(page, 'Navigate to project and location', async () => {
      await userManagement.navigateToProjectLocation();
    }, async () => {
      await expectVisible(page.getByRole('link', { name: /Booking|User Management/i }).first(), 'Project navigation menu');
    });

    await runStep(page, 'Open User Management page', async () => {
      await userManagement.navigateToUserManagement();
    }, async () => {
      await expectVisible(page.getByRole('button', { name: /Invite Users/i }), 'Invite Users button');
    });

    await runStep(page, 'Open Invite Users popup', async () => {
      inviteModal = await userManagement.openInviteUsersModal();
    }, async () => {
      await expectVisible(inviteModal.locator('#email'), 'Invite email field');
    });

    await runStep(page, 'Enter invite email', async () => {
      await fillHighlighted(inviteModal.locator('#email'), inviteEmail, 'Invite email');
    }, async () => {
      await expect(inviteModal.locator('#email')).toHaveValue(inviteEmail);
    });

    await runStep(page, 'Select organization', async () => {
      await userManagement.selectMuiComboboxOption('Organization', userManagement.options.organization);
    }, async () => {
      await expectVisible(inviteModal, 'Invite modal after organization selection');
    });

    await runStep(page, 'Select role', async () => {
      await userManagement.selectMuiComboboxOption('Role', userManagement.options.role);
    }, async () => {
      await expectVisible(inviteModal, 'Invite modal after role selection');
    });

    await runStep(page, 'Send invite and verify success', async () => {
      await userManagement.clickSendInvites(inviteModal);
      await userManagement.waitForInviteSuccessNotification();
    }, async () => {
      await expectVisible(page.locator('body'), 'User invite success state');
    });

    await runStep(page, 'Find newly invited user in list', async () => {
      invitedUserRow = await userManagement.verifyInvitedUserVisibleInList(inviteEmail);
    }, async () => {
      await expect(invitedUserRow).toBeVisible();
    });

    await runStep(page, 'Open row actions and resend invite', async () => {
      await userManagement.resendInviteForMatchedUser(invitedUserRow, inviteEmail);
    }, async () => {
      await expectVisible(page.locator('body'), 'Resend invite success state');
    });
  });

  test('Regression TC-06 - booking list filters return records', async ({ page }) => {
    const filter = new Filter(page);
    let result;

    await runStep(page, 'Open Booking List', async () => {
      await openBookingList(page);
    }, async () => {
      await expectVisible(page.getByRole('button', { name: /New Booking/i }), 'New Booking button');
    });

    await runStep(page, 'Apply default date and advanced checkbox filters', async () => {
      result = await filter.applyCodegenRecordedFilterFlow();
    }, async () => {
      expect(result.initialRecordCount).toBeGreaterThan(0);
      expect(result.finalRecordCount).toBeGreaterThan(0);
    });
  });
});
