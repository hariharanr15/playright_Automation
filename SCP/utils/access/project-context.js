const { ProjectSelectorPage } = require('../../pages/project-selector.page');
const { PermissionResolver } = require('./permission-resolver');

// Holds the selected project for one account session; access is cached per project and dropped on every switch.
class ProjectContext {
  constructor(page, config) {
    this.page = page; this.config = config;
    this.selector = new ProjectSelectorPage(page, config);
    this.resolver = new PermissionResolver(page, config, this.selector);
    this.current = null; this.access = null; this.history = [];
  }

  async discover() {
    const session = await this.selector.sessionProjects();
    const ui = await this.selector.availableProjects().catch(error => ({ error: error.message.split('\n')[0] }));
    return { session, ui: Array.isArray(ui) ? ui : [], uiError: Array.isArray(ui) ? null : ui.error,
      source: Array.isArray(ui) && ui.length ? 'Project selector' : 'Session metadata (project selector list unavailable)' };
  }

  async select(projectName) {
    const previous = await this.selector.activeProjectName().catch(() => null);
    const switched = await this.selector.ensureProject(projectName);
    this.current = projectName; this.access = null;
    this.history.push({ from: previous, to: projectName, switched, at: new Date().toISOString() });
    return switched;
  }

  async resolveAccess(expectedActions) {
    if (!this.current) throw new Error('Select a project before resolving access');
    await this.selector.expectActiveProject(this.current);
    this.access = await this.resolver.resolve(this.current, expectedActions);
    return this.access;
  }
}

module.exports = { ProjectContext };
