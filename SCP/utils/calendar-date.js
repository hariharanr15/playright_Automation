const { date } = require('./enterprise/enterprise-metrics');
const iso = timestamp => new Date(timestamp).toISOString().slice(0, 10);
function shiftCalendarMonths(value, months) {
  if (!Number.isInteger(months)) throw new Error('Calendar month offset must be an integer');
  const source = new Date(date(value));
  const target = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(source.getUTCDate(), lastDay));
  return iso(target.getTime());
}
function defaultInventoryRange(today) {
  return { from: shiftCalendarMonths(today, -2), to: shiftCalendarMonths(today, 1) };
}
function addCalendarDays(value, days) { return iso(date(value) + days * 86400000); }
function displayDate(value) { return iso(date(value)).split('-').reverse().join('/'); }
async function currentCalendarDate(page, timeZone = process.env.SCP_TIMEZONE || 'Asia/Calcutta') {
  return page.evaluate(zone => {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const value = type => parts.find(part => part.type === type).value;
    return `${value('year')}-${value('month')}-${value('day')}`;
  }, timeZone);
}
module.exports = { shiftCalendarMonths, defaultInventoryRange, addCalendarDays, displayDate, currentCalendarDate };
