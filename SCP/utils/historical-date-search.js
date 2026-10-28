const { shiftCalendarMonths, currentCalendarDate } = require('./calendar-date');
const { selectCalendarDate } = require('./date-picker');
const { ScpBlocked } = require('./scp-readonly');

function searchRanges(today, policy = 'historical') {
  if (policy === 'task-chart') return [{ from: '2025-10-01', to: today }];
  if (policy !== 'historical') throw new Error(`Unsupported date-search policy: ${policy}`);
  return [2, 4, 6, 8, 10, 12].map(months => ({
    from: shiftCalendarMonths(today, -months), to: shiftCalendarMonths(today, 1)
  }));
}

// Adapters must apply AND verify both UI/request bounds, await loading, validate
// the complete returned population and return records. Errors never mean empty.
async function searchHistoricalDates({ page, info, context, applyAndValidate,
  policy = 'historical', today, timeZone }) {
  if (!context?.module || !context?.scenario) throw new Error('Date search requires module and scenario context');
  if (typeof applyAndValidate !== 'function') throw new Error('A source-aware date-filter adapter is required');
  const attempts = [];
  const current = today || await currentCalendarDate(page, timeZone);
  try {
    for (const range of searchRanges(current, policy)) {
      const attempt = { ...range, outcome: 'Applying' }; attempts.push(attempt);
      const result = await applyAndValidate(range);
      if (!result || !Array.isArray(result.records)) throw new Error('Date adapter must return validated records, including [] for confirmed empty results');
      attempt.count = result.records.length;
      attempt.outcome = result.records.length ? 'Records found' : 'Confirmed empty';
      if (result.records.length) return { ...result, range, attempts };
    }
    throw new ScpBlocked(`No Test Data Available: ${context.module} / ${context.submodule || ''} / ${context.scenario}; ${attempts.length} attempt(s); ${attempts.at(-1).from} to ${attempts.at(-1).to}`);
  } catch (error) {
    if (attempts.at(-1)?.outcome === 'Applying') attempts.at(-1).outcome = 'Failed to apply or validate';
    throw error;
  } finally {
    if (info) await info.attach('date-search-evidence', {
      body: Buffer.from(JSON.stringify({ ...context, policy, currentDate: current, attempts }, null, 2)), contentType: 'application/json'
    });
  }
}

// Shared UI adapter primitive; page objects retain their own response/load and
// source validation contracts. Calendar callers may supply their existing picker.
async function selectFilterDate(page, input, value) {
  if (await input.getAttribute('type') === 'date') {
    await input.fill(value);
  } else await selectCalendarDate(page, input, value);
}
async function setDateInputs({ page, from, to, range, select = selectFilterDate, apply }) {
  await select(page, to, range.to);
  await select(page, from, range.from);
  if (apply) await apply();
}
module.exports = { searchRanges, searchHistoricalDates, setDateInputs };
