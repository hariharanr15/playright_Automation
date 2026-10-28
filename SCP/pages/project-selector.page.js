const { expect } = require('@playwright/test');
const { BasePage } = require('./base.page');

class ProjectSelectorPage extends BasePage {
  constructor(page, config) {
    super(page);
    this.config = config;
    this.headerSelectors = page.locator('div[role="button"].bg-inputBg:visible');
    this.projectSelector = this.headerSelectors.first();
  }

  async activeProjectName() {
    await this.projectSelector.waitFor({ state: 'visible', timeout: 30000 });
    return (await this.projectSelector.innerText()).replace(/\s+/g, ' ').trim();
  }

  async activeProjectSession() {
    const activeProject = await this.activeProjectName();
    const projectSession = await this.page.evaluate((projectName) => {
      const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      return (userInfo.projects || []).find((project) => (
        String(project.name || '').replace(/\s+/g, ' ').trim().toLowerCase() === projectName.toLowerCase()
      ));
    }, activeProject);

    if (!projectSession) {
      throw new Error(`The session metadata does not contain active project ${activeProject}.`);
    }
    return projectSession;
  }

  async activeOrganizationName() {
    const projectSession = await this.activeProjectSession();

    const organization = projectSession?.organization?.name?.trim();
    if (!organization) {
      throw new Error(`The session metadata does not contain an organization for active project ${projectSession.name}.`);
    }
    return organization;
  }

  async activeProjectReference() {
    const projectSession = await this.activeProjectSession();
    if (!projectSession.ref) {
      throw new Error(`The session metadata does not contain a reference for active project ${projectSession.name}.`);
    }
    return projectSession.ref;
  }

  // Projects the session associates with this account on the configured platform, with each project's own role.
  async sessionProjects() {
    const projects = await this.page.evaluate(() => JSON.parse(localStorage.getItem('userInfo') || '{}').projects || []);
    const platform = String(this.config.platformName || '').toLowerCase();
    return projects
      .filter(project => !project.platform || !platform || String(project.platform.name || '').toLowerCase() === platform)
      .map(project => ({
        name: String(project.name || '').replace(/\s+/g, ' ').trim(),
        ref: project.ref,
        organization: project.organization?.name,
        role: project.role ? { code: project.role.code, name: project.role.name, permissions: project.role.permissions || [] } : null
      }));
  }

  async availableProjects() {
    await this.clickFirstVisible([{ locator: this.projectSelector, label: 'Project selector' }], 'Project selector', 20000);
    const options = this.page.locator('[role="option"]:visible, [role="menuitem"]:visible');
    await options.first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => null);
    const names = (await options.allInnerTexts()).map(name => name.replace(/\s+/g, ' ').trim()).filter(Boolean);
    await this.page.keyboard.press('Escape');
    await options.first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => null);
    return [...new Set(names)];
  }

  async ensureProject(projectName = this.config.projectName) {
    if (!projectName) {
      throw new Error('SCP project name is required. Configure SCP_PROJECT_NAME.');
    }

    if ((await this.activeProjectName()) === projectName) {
      await this.expectActiveProject(projectName);
      return false;
    }

    await this.clickFirstVisible([
      { locator: this.projectSelector, label: 'Project selector' }
    ], 'Project selector', 20000);

    const optionPattern = new RegExp(`^${this.escapeForRegex(projectName)}$`, 'i');
    await this.clickFirstVisible([
      { locator: this.page.getByRole('option', { name: optionPattern }), label: projectName },
      { locator: this.page.getByRole('menuitem', { name: optionPattern }), label: projectName },
      { locator: this.page.getByText(projectName, { exact: true }), label: projectName }
    ], `Project ${projectName}`, 20000);

    await this.expectActiveProject(projectName);
    return true;
  }

  async expectActiveProject(projectName = this.config.projectName) {
    await expect(this.projectSelector, `Active SCP project should be ${projectName}`).toHaveText(
      new RegExp(`^\\s*${this.escapeForRegex(projectName)}\\s*$`, 'i'),
      { timeout: 30000 }
    );
  }

  escapeForRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = { ProjectSelectorPage };
