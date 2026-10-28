const { MODULES } = require('../../config/scp-module-registry');
const { LeftNavigationPage } = require('../../pages/left-navigation.page');
const { sessionIndicates } = require('./access-model');

const DENIAL = /not authori[sz]ed|access denied|permission denied|(do not|don't) have (the )?permission|forbidden/i;

class PermissionResolver {
  constructor(page, config, projectSelector) {
    this.page = page; this.config = config; this.projectSelector = projectSelector;
    this.navigation = new LeftNavigationPage(page);
    this.probeRoutes = process.env.SCP_ACCESS_ROUTE_PROBE !== 'false';
  }

  // Resolves access for the currently selected project only; callers re-resolve after every project or account change.
  async resolve(projectName, expectedActions = {}, moduleIds) {
    const role = (await this.projectSelector.sessionProjects()).find(project => project.name.toLowerCase() === projectName.toLowerCase())?.role || null;
    const tree = await this.navigation.captureTree();
    const modules = [];
    for (const module of MODULES.filter(item => !moduleIds || moduleIds.includes(item.id))) {
      const navMatches = LeftNavigationPage.matches(tree, module.nav);
      const navVisible = navMatches.length > 0;
      const page = this.probeRoutes ? await this.probe(module, projectName) : { probed: false, reachable: navVisible, reason: 'Route probe disabled' };
      const actionNames = [...new Set([...(module.actions || []).map(action => action.name), ...Object.keys(expectedActions[module.id] || {})])];
      const actions = [];
      for (const name of actionNames) {
        if (!(module.actions || []).some(action => action.name === name)) {
          actions.push({ name, visible: null, reason: 'Action needs its own page/data context; it is not a declared landing-page control' });
          continue;
        }
        actions.push({ name, visible: page.probed && page.reachable ? await this.page.getByRole('button', { name }).first()
          .waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false) : null });
      }
      modules.push({ id: module.id, name: module.name, order: module.order, navVisible, navPaths: navMatches.map(item => [...item.path, item.label].join(' > ')),
        page, actions, sessionIndicates: sessionIndicates(module, role) });
    }
    await this.page.goto(this.config.managementDashboardUrl, { waitUntil: 'domcontentloaded' });
    return { project: projectName, role: role && { code: role.code, name: role.name, permissionCount: role.permissions.length, permissions: role.permissions },
      navigation: tree, modules };
  }

  async probe(module, projectName) {
    const origin = new URL(this.config.baseUrl).origin;
    const deniedResponses = [];
    const listener = response => {
      const url = new URL(response.url());
      if (url.origin === origin && url.pathname.startsWith('/api/') && [401, 403].includes(response.status()) && deniedResponses.length < 20) {
        deniedResponses.push({ method: response.request().method(), path: url.pathname, status: response.status() });
      }
    };
    this.page.on('response', listener);
    try {
      const navigation = await this.page.goto(new URL(`/${module.route}`, this.config.baseUrl).href, { waitUntil: 'domcontentloaded' });
      if (navigation?.status() >= 500) return { probed: true, reachable: null, failureCategory: 'Environment',
        httpStatus: navigation.status(), reason: `Module page returned HTTP ${navigation.status()}`, deniedResponses };
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
      await this.page.getByText(/^\s*Loading\b/i).first().waitFor({ state: 'hidden', timeout: 45000 }).catch(() => null);
      const headingVisible = module.heading ? await this.page.getByRole('heading', { name: module.heading }).first()
        .waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false) : null;
      const finalPath = new URL(this.page.url()).pathname;
      const onRoute = new RegExp(`^/${module.route}/?$`, 'i').test(finalPath);
      if (!onRoute && (new URL(this.page.url()).origin !== origin || /\/(login|sign-?in|sso|platform)(\/|$)/i.test(finalPath))) {
        return { probed: true, reachable: null, failureCategory: 'Authentication', reason: `Session returned to authentication (${finalPath})`, deniedResponses };
      }
      const denied = await this.page.getByText(DENIAL).first().isVisible().catch(() => false);
      const activeProject = await this.projectSelector.activeProjectName().catch(() => 'unavailable');
      const reachable = onRoute && !denied && headingVisible !== false;
      const reason = !onRoute ? `Redirected to ${finalPath}` : denied ? 'Access denial message shown' :
        headingVisible === false ? `Heading "${module.heading}" not shown` : 'Opened';
      const incomplete = onRoute && !denied && headingVisible === false;
      return { probed: true, reachable: incomplete ? null : reachable, ...(incomplete ? { failureCategory: 'Incomplete page' } : {}), reason, finalPath, deniedResponses,
        projectContext: activeProject.toLowerCase() === projectName.toLowerCase() ? 'retained' : `changed to ${activeProject}` };
    } catch (error) {
      return { probed: true, reachable: null, failureCategory: 'Environment', reason: `Probe error: ${error.message.split('\n')[0]}`, deniedResponses };
    } finally {
      this.page.off('response', listener);
    }
  }
}

module.exports = { PermissionResolver };
