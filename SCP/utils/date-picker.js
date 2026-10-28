const { expect } = require('@playwright/test');
async function selectCalendarDate(page, input, iso) {
  const [year, month, day] = iso.split('-').map(Number);
  let rejectLoop;
  const loop = new Promise((resolve, reject) => { rejectLoop = reject; });
  const listener = message => { if (/Maximum update depth exceeded/.test(message.text())) rejectLoop(new Error('Application calendar entered a React maximum-update-depth loop')); };
  page.on('console', listener);
  try {
    await Promise.race([loop, (async () => {
      await input.click();
      const calendar = page.locator('div.border.rounded-lg.shadow-lg.p-4.w-80').filter({ has: page.locator('[data-date]') });
      await expect(calendar, 'One active application calendar').toHaveCount(1);
      const yearControl = calendar.locator('select').filter({ has: page.locator(`option[value="${year}"]`) });
      const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)));
      const monthControl = calendar.locator('select').filter({ has: page.getByRole('option', { name: monthName, exact: true }) });
      await yearControl.selectOption(String(year)); await monthControl.selectOption({ label: monthName });
      const target = calendar.locator(`[data-date="${iso}"]`);
      await expect(target).toHaveCount(1); await target.click();
      await expect(calendar).toHaveCount(0);
    })()]);
  } catch (error) {
    if (/maximum-update-depth/.test(error.message)) await require('./shared-browser').discardUnresponsivePage(page);
    throw error;
  } finally { page.off('console', listener); }
}
module.exports = { selectCalendarDate };
