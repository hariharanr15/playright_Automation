const { test: base, expect } = require('./baseTest');
const { loadAllocation, read, ScpBlocked, excluded } = require('../utils/scp-readonly');
const { isHeadless } = require('../utils/execution-mode');

const test = base.extend({
  readonly: async ({ scpProject }, use, info) => {
    const { page, scpSession } = scpProject;
    const allocation = loadAllocation(); const attemptedWrites = []; const consoleErrors = []; const pageErrors = [];
    await page.setViewportSize({ width: 1920, height: 1080 });
    const guard = async route => {
      const request = route.request(); const url = new URL(request.url());
      const reportQuery = request.method() === 'POST' && /^\/api\/submittal_status\/(by_submittal|by_supplier|by_material|submittal_status_counts|count_of_submittal_component)\/?$/.test(url.pathname);
      // The common shell loads active system messages itself; this is not a test
      // navigating to or exercising the excluded System Messages module.
      const shellMessageRead = request.method() === 'GET' && url.pathname === '/api/system_messages/active/';
      if ((!shellMessageRead && excluded.test(url.pathname)) || (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && !reportQuery)) {
        attemptedWrites.push({ method: request.method(), path: url.pathname });
        return route.abort('blockedbyclient');
      }
      return route.continue();
    };
    const listener = message => { if (message.type() === 'error' && consoleErrors.length < 30) consoleErrors.push(message.text()); };
    const uncaught = error => { if (pageErrors.length < 30) pageErrors.push(error.message); };
    page.on('console', listener);
    page.on('pageerror', uncaught);
    await scpSession.context.route('**/api/**', guard);
    const assertContext = async () => scpProject.projectSelector.expectActiveProject(scpProject.config.projectName);
    try {
      await assertContext();
      // Optional execution allocation: preserve existing callers and verify the
      // starting site explicitly for an approved application-wide rehearsal.
      if (process.env.SCP_EXECUTION_SITE) {
        await scpProject.siteSelector.ensureSite(process.env.SCP_EXECUTION_SITE);
        await assertContext();
        expect(await scpProject.siteSelector.activeSiteName(), 'Approved starting site').toBe(process.env.SCP_EXECUTION_SITE);
        await info.attach('execution-start-context', { body: Buffer.from(JSON.stringify({
          project: await scpProject.projectSelector.activeProjectName(), site: await scpProject.siteSelector.activeSiteName()
        })), contentType: 'application/json' });
      }
      await use({ ...scpProject, allocation, assertContext, read: (endpoint, params) => read(page, endpoint, params) });
      expect(attemptedWrites, 'Read-only automation must attempt no mutations or excluded endpoints').toEqual([]);
      expect(pageErrors, 'Application must raise no uncaught page errors').toEqual([]);
      expect(consoleErrors.filter(message => /Unhandled render error caught by ErrorBoundary|Maximum update depth exceeded/.test(message)), 'Application render errors must not be hidden by a later successful assertion').toEqual([]);
    } catch (error) {
      if (error instanceof ScpBlocked) info.annotations.push({ type: 'blocked', description: error.message });
      throw error;
    } finally {
      await scpSession.context.unroute('**/api/**', guard);
      page.off('console', listener);
      page.off('pageerror', uncaught);
      await info.attach('read-only-guard', { body: Buffer.from(JSON.stringify({ attemptedWrites, consoleErrors, pageErrors }, null, 2)), contentType: 'application/json' });
      if (info.status !== info.expectedStatus && !page.isClosed()) {
        const screenshot = await page.screenshot({ fullPage: isHeadless(), timeout: 5000 }).catch(() => null);
        if (screenshot) await info.attach('scp-failure', { body: screenshot, contentType: 'image/png' });
      }
    }
  }
});
module.exports = { test, expect };
