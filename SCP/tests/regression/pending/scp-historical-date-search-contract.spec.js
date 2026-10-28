const { test, expect } = require('@playwright/test');
const { searchRanges, searchHistoricalDates } = require('../../../utils/historical-date-search');
const context = { module: 'Contract', scenario: 'Historical search' };
test('Historical dates: anchored month-end ranges stop at twelve months with unchanged To', () => {
  const ranges = searchRanges('2024-08-31');
  expect(ranges.map(r => r.from)).toEqual(['2024-06-30', '2024-04-30', '2024-02-29', '2023-12-31', '2023-10-31', '2023-08-31']);
  expect(ranges.every(r => r.to === '2024-09-30')).toBe(true);
});
test('Historical dates: stop immediately at first confirmed records', async () => {
  const seen = [];
  const result = await searchHistoricalDates({ today: '2026-01-31', context, applyAndValidate: async range => {
    seen.push(range); return { records: seen.length === 2 ? [{ id: 'fixture' }] : [] };
  } });
  expect(seen).toHaveLength(2); expect(result.range).toEqual({ from: '2025-09-30', to: '2026-02-28' });
});
test('Historical dates: six confirmed empty results are Blocked, never Passed', async () => {
  let calls = 0;
  await expect(searchHistoricalDates({ today: '2026-10-25', context, applyAndValidate: async () => {
    calls++; return { records: [] };
  } })).rejects.toThrow(/BLOCKED: No Test Data Available/);
  expect(calls).toBe(6);
});
test('Historical dates: API or filter failure never triggers fallback', async () => {
  let calls = 0;
  await expect(searchHistoricalDates({ today: '2026-10-25', context, applyAndValidate: async () => {
    calls++; throw new Error('HTTP 403');
  } })).rejects.toThrow('HTTP 403'); expect(calls).toBe(1);
});
test('Task Chart dates: fixed start and dynamic supplied today with no historical fallback', async () => {
  const seen = [];
  await expect(searchHistoricalDates({ today: '2026-10-25', policy: 'task-chart', context,
    applyAndValidate: async range => { seen.push(range); return { records: [] }; }
  })).rejects.toThrow(/No Test Data Available/);
  expect(seen).toEqual([{ from: '2025-10-01', to: '2026-10-25' }]);
});
test('Historical dates: missing source records is a failure rather than an empty result', async () => {
  await expect(searchHistoricalDates({ today: '2026-10-25', context, applyAndValidate: async () => ({}) }))
    .rejects.toThrow('validated records');
});
