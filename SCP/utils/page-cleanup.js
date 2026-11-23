// Leaves the current page usable for the next scenario without a page load: waits for loading backdrops to clear,
// then closes any dialog a scenario left open (Cancel, close / ×, Escape). Nothing is saved.
const BACKDROP = 'div.fixed.inset-0';

async function clearLeftovers(page) {
  if (page.isClosed()) return false;
  const backdrop = page.locator(BACKDROP).filter({ visible: true }).first();
  // Loading backdrops disappear by themselves; a dialog's backdrop does not.
  await backdrop.waitFor({ state: 'hidden', timeout: 8000 }).catch(() => null);
  for (let attempt = 0; attempt < 3 && await backdrop.isVisible().catch(() => false); attempt += 1) {
    const outside = locator => locator.filter({ visible: true }).filter({ hasNot: page.locator('nav') });
    const cancel = outside(page.getByRole('button', { name: /^(Cancel|Close)$/i })).last();
    const cross = outside(page.locator('button[aria-label*="close" i], button:has(svg.lucide-x), button:has-text("×")')).last();
    if (await cancel.isVisible().catch(() => false)) await cancel.click({ timeout: 3000 }).catch(() => null);
    else if (await cross.isVisible().catch(() => false)) await cross.click({ timeout: 3000 }).catch(() => null);
    else await page.keyboard.press('Escape').catch(() => null);
    await page.waitForTimeout(600);
  }
  return !(await backdrop.isVisible().catch(() => false));
}

// Procurement Log and Inventory continue on the current page between scenarios (one login, one site, no landing-page
// round trip); the other modules keep their per-scenario start from the Management Dashboard.
function continuesOnPage() {
  return ['procurement-log', 'inventory-management'].includes(process.env.SCP_REGRESSION_MODULE || '');
}

module.exports = { clearLeftovers, continuesOnPage };
