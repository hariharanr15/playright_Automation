// The single sign-in of a PM flow run: login page → Project Admin sign-in → Supply Chain Planner → project.
const { expect } = require('@playwright/test');
const { LoginPage } = require('../../../pages/login.page');
const { PlatformChooserPage } = require('../../../pages/platform-chooser.page');
const { ProjectSelectorPage } = require('../../../pages/project-selector.page');
const { PM } = require('./pm-navigator');

async function signIn({ run, page, config, ui, id, suite }) {
  const record = await run.scenario({ id, module: 'Project Management', submodule: 'Login and project', suite,
    title: `Sign in as Project Admin and select ${config.projectName}`, navPath: [PM], always: true }, async s => {
    await s.step('Open the login page', async () => {
      await page.goto(config.loginUrl, { waitUntil: 'domcontentloaded' });
      await ui.visible(page.getByRole('heading', { name: 'Welcome To Voyage Control' }), 'Login heading');
    }, { critical: true });
    await s.step('Sign in as Project Admin', async () => {
      await new LoginPage(page).login(config.username, config.password);
      await ui.visible(page.getByRole('heading', { name: config.username, exact: true }), 'Signed-in user');
    }, { critical: true });
    await s.step('Open Supply Chain Planner', async () => {
      await new PlatformChooserPage(page, config).openSupplyChainPlanner();
      await expect(page).toHaveURL(/\/management-dashboard\/?$/);
    }, { critical: true });
    await s.step(`Select project ${config.projectName}`, async () => {
      await new ProjectSelectorPage(page, config).ensureProject(config.projectName);
    }, { critical: true });
  });
  if (record.status !== 'Passed') run.abort(`Sign-in or project selection failed (${id})`);
  return record.status === 'Passed';
}

module.exports = { signIn };
