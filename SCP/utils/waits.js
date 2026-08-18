async function waitForNetworkIdleOrTimeout(page, timeout = 10000) {
  await Promise.race([
    page.waitForLoadState('networkidle', { timeout }).catch(() => null),
    page.waitForTimeout(timeout)
  ]);
}

module.exports = { waitForNetworkIdleOrTimeout };
