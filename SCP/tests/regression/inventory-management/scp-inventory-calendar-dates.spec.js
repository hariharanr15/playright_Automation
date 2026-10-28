const { test, expect } = require('@playwright/test');
const { shiftCalendarMonths, defaultInventoryRange } = require('../../../utils/calendar-date');
// Fixed mathematical boundary fixtures; live UI expected dates are always dynamic.
for (const [name, source, offset, expected] of [
  ['non-leap month end', '2026-01-31', 1, '2026-02-28'],
  ['leap month end', '2024-01-31', 1, '2024-02-29'],
  ['backward leap clamp', '2024-04-30', -2, '2024-02-29'],
  ['backward ordinary clamp', '2026-04-30', -2, '2026-02-28'],
  ['same day preserved', '2026-03-31', -2, '2026-01-31'],
  ['previous year', '2026-01-25', -2, '2025-11-25'],
  ['next year', '2026-12-25', 1, '2027-01-25'],
  ['century non-leap', '1900-01-31', 1, '1900-02-28'],
  ['century leap', '2000-01-31', 1, '2000-02-29']
]) test(`Inventory calendar arithmetic: ${name}`, () => expect(shiftCalendarMonths(source, offset)).toBe(expected));
test('Inventory calendar arithmetic: both bounds derive independently from the current day', () => {
  expect(defaultInventoryRange('2024-03-31')).toEqual({ from: '2024-01-31', to: '2024-04-30' });
});
