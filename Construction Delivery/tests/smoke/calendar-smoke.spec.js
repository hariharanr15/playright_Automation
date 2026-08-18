const path = require('path');
const { expect, test } = require('../support/test-base');
const { CalendarBookingPage } = require('../../pages/booking/calendar.booking.page');

test.describe('Smoke Tests - Calendar Module @calendar @smoke', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ permissions: ['notifications'] });

  test('Calendar default state and view availability @calendar-view', async ({ page }, testInfo) => {
    const calendar = new CalendarBookingPage(page, {
      reportDir: path.resolve('reports', 'calendar-smoke')
    });

    await calendar.navigateToCalendar();
    const defaultState = await calendar.verifyDefaultState();

    await testInfo.attach('calendar-default-state', {
      body: JSON.stringify(defaultState, null, 2),
      contentType: 'application/json'
    });

    expect(defaultState.allProjectBookingsSelected).toBeTruthy();
    expect(defaultState.defaultCalendarVisible).toBeTruthy();
    expect(defaultState.viewOptions.Calendar).toBeTruthy();
    expect(defaultState.viewOptions.Resource).toBeTruthy();
    expect(defaultState.viewOptions['Access Points']).toBeTruthy();
  });

  test('Calendar smoke flow validates day week navigation and filters @calendar-view @filter', async ({ page }, testInfo) => {
    const calendar = new CalendarBookingPage(page, {
      reportDir: path.resolve('reports', 'calendar-smoke')
    });
    const result = await calendar.runCalendarSmokeFlow({
      views: ['Calendar'],
      writeReport: true
    });

    await testInfo.attach('calendar-smoke-result', {
      body: JSON.stringify(result, null, 2),
      contentType: 'application/json'
    });

    const calendarScenario = result.scenarios.find((scenario) => scenario.viewName === 'Calendar');
    expect(result.status).toBe('passed');
    expect(calendarScenario.status).toBe('passed');
    expect(calendarScenario.steps.day.selected).toBeTruthy();
    expect(calendarScenario.steps.week.selected).toBeTruthy();
    expect(calendarScenario.steps.navigation.changed).toBeTruthy();
    expect(calendarScenario.steps.navigation.nextReturnedOrChanged).toBeTruthy();
    expect(calendarScenario.steps.filters.selectedCount).toBeGreaterThanOrEqual(1);
  });
});
