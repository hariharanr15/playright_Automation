// Small UI helpers shared by the PM flow specs. Every check outlines the element it verifies.
const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');
const { focus } = require('./pm-visuals');

function pmUi(page, navigator, outDir) {
  const main = page.locator('main');
  const modal = () => navigator.overlay();
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();

  const visible = async (locator, label, timeout = 15000) => {
    await expect(locator.first(), `${label} should be visible`).toBeVisible({ timeout });
    await focus(locator);
  };
  const headers = table => table.locator('thead th').allInnerTexts().then(list => list.map(clean).filter(Boolean));
  const rowTexts = (scope = main) => scope.locator('tbody tr').allInnerTexts().then(list => list.map(clean));
  const countText = async (pattern = /(\d+)\s+(items|categories|sites|logs|total)/) => ((await main.innerText()).match(pattern) || [])[0] || '';
  const button = (name, scope = main) => scope.getByRole('button', { name, exact: true }).first();
  const click = async (locator, label) => { await visible(locator, label); await locator.first().click(); };

  const openForm = async (name, title) => {
    await click(button(name), name);
    await expect(modal(), `${title || name} form should open`).toBeVisible({ timeout: 15000 });
    if (title) await visible(modal().getByText(title, { exact: true }), `${title} title`);
    return modal();
  };
  const inModal = async texts => {
    for (const text of texts) await visible(modal().getByText(text, { exact: typeof text === 'string' }), `"${text}" in the form`);
  };
  // Opens a custom dropdown (button) and returns its option texts, then closes it.
  const dropdownOptions = async trigger => {
    await click(trigger, 'Dropdown');
    const options = page.getByRole('listbox').last().getByRole('option');
    await expect(options.first(), 'Dropdown options').toBeVisible({ timeout: 10000 });
    const list = (await options.allInnerTexts()).map(clean).filter(Boolean);
    await page.keyboard.press('Escape');
    return list;
  };
  const selectOptions = select => select.locator('option').allInnerTexts().then(list => list.map(clean));

  // Clicks a control that downloads a file and saves it in the run folder.
  const download = async (trigger, label) => {
    await visible(trigger, label);
    const [file] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), trigger.first().click()]);
    const dir = path.join(outDir, 'downloads');
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, `${Date.now()}-${file.suggestedFilename()}`);
    await file.saveAs(target);
    return { name: file.suggestedFilename(), path: target, size: fs.statSync(target).size };
  };

  // Picks a date in the app's calendar (read-only text input → popup with month and year <select>s and a day grid).
  // The grid also shows greyed days of the neighbouring months: for day ≤ 14 the first match is in the shown month, for ≥ 15 the last.
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const pickDate = async (input, date) => {
    await click(input, 'Date');
    const calendar = page.locator('div.rounded-lg.shadow-lg', { has: page.locator('select') }).filter({ visible: true }).last();
    await expect(calendar, 'Calendar').toBeVisible({ timeout: 10000 });
    await calendar.locator('select').nth(0).selectOption(MONTHS[date.getMonth()]);
    await calendar.locator('select').nth(1).selectOption(String(date.getFullYear()));
    const days = calendar.locator('div.h-10.w-10').getByText(String(date.getDate()), { exact: true });
    const day = date.getDate() <= 14 ? days.first() : days.last();
    await focus(day); await day.click();
    await page.keyboard.press('Escape').catch(() => null);
  };

  return { main, modal, clean, visible, headers, rowTexts, countText, button, click, openForm, inModal, dropdownOptions, selectOptions, download, pickDate };
}

module.exports = { pmUi };
