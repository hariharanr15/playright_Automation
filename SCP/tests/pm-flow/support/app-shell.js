// Application shell changes of the staging release of 23 Nov 2026 (evening):
//  - an "Analytics cookies" consent banner (Microsoft Clarity) covers the bottom of every page until it is answered.
//    The automation always answers "Reject" (the privacy-preserving choice); the answer is kept in a cookie.
//  - the left menu collapses to icons in narrow windows, so headless runs use a fixed 1920 × 1080 window (see
//    playwright.pm-flow.config.js and SHELL_VIEWPORT below).
const HEADLESS = /^true$/i.test(process.env.PM_FLOW_HEADLESS || '');
// Window size for extra browser contexts: the maximised window when headed, 1920 × 1080 when headless.
const SHELL_VIEWPORT = HEADLESS ? { width: 1920, height: 1080 } : null;

async function rejectAnalyticsCookies(page) {
  if (page.__scpConsent) return;
  page.__scpConsent = true;
  const banner = page.getByText('Analytics cookies', { exact: true });
  await page.addLocatorHandler(banner, async () => {
    await page.getByRole('button', { name: 'Reject', exact: true }).first().click({ timeout: 5000 }).catch(() => {});
  }, { noWaitAfter: true }).catch(() => {});
}

// Installs the consent handler on every page of a context (existing and future ones).
async function prepareContext(context) {
  if (context.__scpShell) return context;
  context.__scpShell = true;
  for (const p of context.pages()) await rejectAnalyticsCookies(p);
  context.on('page', p => { rejectAnalyticsCookies(p); });
  return context;
}

module.exports = { rejectAnalyticsCookies, prepareContext, SHELL_VIEWPORT };
