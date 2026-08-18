const path = require('path');
const { expect, test } = require('../support/test-base');
const { CalendarBookingPage } = require('../../pages/booking/calendar.booking.page');

async function runCalendarViewRegression(page, testInfo, viewName) {
  const calendar = new CalendarBookingPage(page, {
    reportDir: path.resolve('reports', 'calendar-regression')
  });
  const result = await calendar.runCalendarRegressionFlow({
    views: [viewName],
    writeReport: true
  });
  const scenario = result.scenarios.find((item) => item.viewName === viewName);

  await testInfo.attach(`${viewName.toLowerCase().replace(/\s+/g, '-')}-regression-result`, {
    body: JSON.stringify(result, null, 2),
    contentType: 'application/json'
  });

  expect(result.status).toBe('passed');
  expect(scenario.status).toBe('passed');
  expect(scenario.steps.viewSelected.selected).toBeTruthy();
  expect(scenario.steps.navigation.previousChanged).toBeTruthy();
  expect(scenario.steps.navigation.nextReturnedOrChanged).toBeTruthy();
  expect(scenario.steps.print.triggered).toBeTruthy();
  expect(scenario.steps.filters.selectedCount).toBeGreaterThanOrEqual(1);

  return scenario;
}

test.describe('Regression Tests - Calendar Module @calendar @regression', () => {
  test.describe.configure({ mode: 'serial' });

  test('Calendar view booking interaction drag filter and print @calendar-view @booking-edit @drag-drop @filter @print', async ({ page }, testInfo) => {
    const scenario = await runCalendarViewRegression(page, testInfo, 'Calendar');

    expect(scenario.steps.day.selected).toBeTruthy();
    expect(scenario.steps.week.selected).toBeTruthy();
    expect(scenario.steps.bookingInteraction.skipped).toBeFalsy();
    expect(scenario.steps.dragDrop.skipped).toBeFalsy();
  });

  test('Resource view booking search drag filter and print @resource-view @booking-edit @drag-drop @filter @print', async ({ page }, testInfo) => {
    const scenario = await runCalendarViewRegression(page, testInfo, 'Resource');

    expect(scenario.steps.dropdown.selected || scenario.steps.dropdown.reason).toBeTruthy();
    if (!scenario.steps.recordSearch.found) {
      expect(scenario.steps.bookingInteraction.skipped).toBeTruthy();
      expect(scenario.steps.dragDrop.skipped).toBeTruthy();
    }
  });

  test('Access Points view booking search drag filter and print @access-points-view @booking-edit @drag-drop @filter @print', async ({ page }, testInfo) => {
    const scenario = await runCalendarViewRegression(page, testInfo, 'Access Points');

    expect(scenario.steps.dropdown.selected || scenario.steps.dropdown.reason).toBeTruthy();
    if (!scenario.steps.recordSearch.found) {
      expect(scenario.steps.bookingInteraction.skipped).toBeTruthy();
      expect(scenario.steps.dragDrop.skipped).toBeTruthy();
    }
  });
});
