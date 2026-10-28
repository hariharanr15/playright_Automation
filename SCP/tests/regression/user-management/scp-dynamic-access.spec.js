const fs = require('fs');
const path = require('path');
const { test, expect } = require('../../../fixtures/baseTest');
const { getScpConfig } = require('../../../config/scp.config');
const { AppShellPage } = require('../../../pages/app-shell.page');
const { PlatformChooserPage } = require('../../../pages/platform-chooser.page');
const { ManagementDashboardPage } = require('../../../pages/management-dashboard/management-dashboard.page');
const { ScpBlocked, excluded } = require('../../../utils/scp-readonly');
const sharedBrowser = require('../../../utils/shared-browser');
const { ProjectContext } = require('../../../utils/access/project-context');
const { STATUS, loadExpectations, accountsToValidate, evaluateModule, carriedOver, maskEmail } = require('../../../utils/access/access-model');

// Read-only: access is discovered from navigation and GET page loads; every SCP business write is aborted.
const config = getScpConfig();
const expectations = loadExpectations();
const accounts = accountsToValidate(config, expectations);
const matrixFile = path.resolve(process.env.SCP_ACCESS_MATRIX_FILE ||
  path.join(process.env.SCP_EXECUTION_DIR || path.join('reports', `access-${new Date().toISOString().slice(0, 10)}`), 'access-matrix.json'));

function saveCombinations(account, combinations) {
  const matrix = fs.existsSync(matrixFile) ? JSON.parse(fs.readFileSync(matrixFile, 'utf8')) : { combinations: [] };
  matrix.generatedAt = new Date().toISOString();
  matrix.expectationsSource = expectations ? path.resolve(process.env.SCP_ACCESS_EXPECTATIONS) : null;
  matrix.combinations = [...matrix.combinations.filter(item => item.account !== account.label), ...combinations];
  fs.mkdirSync(path.dirname(matrixFile), { recursive: true });
  fs.writeFileSync(matrixFile, JSON.stringify(matrix, null, 2));
}

for (const account of accounts) {
  const id = account.index === 0 ? 'SCP-UM-001' : `SCP-UM-001.${account.index + 1}`;
  test(`${id} Dynamic project access: ${account.label}`, async ({ browser, executionJournal }, info) => {
    const username = process.env[account.usernameEnv];
    const password = process.env[account.passwordEnv];
    if (!username || !password) throw new ScpBlocked(`Configure ${account.usernameEnv} and ${account.passwordEnv} for ${account.label}`);
    const primaryUsername = config.accounts[config.defaultRole]?.username || config.username;
    const primary = username.trim().toLowerCase() === String(primaryUsername).trim().toLowerCase();
    const accountConfig = { ...config, username, password };
    // Shared-browser runs switch accounts in the run's single tab: the previous user's cookies and storage are cleared first.
    const shared = sharedBrowser.isSharedBrowser();
    const { context, page: sharedPage } = shared ? await sharedBrowser.sharedContextAndPage(browser)
      : { context: await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1920, height: 1080 } }) };
    const origin = new URL(config.baseUrl).origin;
    const blockedWrites = [];
    const guard = route => {
      const request = route.request(); const url = new URL(request.url());
      const shellRead = request.method() === 'GET' && url.pathname === '/api/system_messages/active/';
      if (url.origin === origin && ((!shellRead && excluded.test(url.pathname)) || !['GET', 'HEAD', 'OPTIONS'].includes(request.method()))) {
        blockedWrites.push({ method: request.method(), path: url.pathname });
        return route.abort('blockedbyclient');
      }
      return route.continue();
    };
    await context.route('**/api/**', guard);
    const page = sharedPage || await context.newPage();
    if (shared) await sharedBrowser.ensureAccountSession(page, config, username);
    executionJournal.page = page;
    Object.assign(executionJournal.scenario, {
      objective: 'Verify that navigation, module pages and action controls follow the access configured for each selected project, without carrying access over between projects',
      prerequisites: [`Credentials in ${account.usernameEnv}/${account.passwordEnv}`, expectations ? `Authoritative expectations: ${path.basename(process.env.SCP_ACCESS_EXPECTATIONS)}` : 'No expectations file: access is recorded as observed, not validated'],
      expected: 'Each user-project combination shows and enforces only its configured access; switching projects does not retain the previous project\'s navigation' });
    const combinations = [];
    try {
      await test.step(`Log in as ${account.label}`, async () => {
        await new AppShellPage(page, accountConfig).open();
        await new PlatformChooserPage(page, accountConfig).openSupplyChainPlanner();
        await new ManagementDashboardPage(page, accountConfig).expectLoaded();
        if (shared) {
          expect(await sharedBrowser.signedInEmail(page), 'The shared tab must be signed in as this account, with no previous user carried over')
            .toBe(username.trim().toLowerCase());
        }
      });
      const projectContext = new ProjectContext(page, accountConfig);
      const projects = await test.step('Capture the projects associated with the account', async () => {
        const discovered = await projectContext.discover();
        executionJournal.setData('projects', { account: account.label, user: maskEmail(username), ...discovered,
          session: discovered.session.map(project => ({ name: project.name, organization: project.organization, role: project.role && `${project.role.name} (${project.role.code})` })) });
        return discovered;
      });
      const associated = new Set([...projects.session.map(project => project.name), ...projects.ui].map(name => name.toLowerCase()));
      const names = [...new Map([...projects.session.map(project => project.name), ...projects.ui].map(name => [name.toLowerCase(), name])).values()];
      const targets = account.projects === 'all' ? names.map(project => ({ project })) : account.projects;
      if (!targets.length) throw new ScpBlocked('No associated projects could be discovered for this account');
      test.setTimeout(Math.max(info.timeout, targets.length * 10 * 60000));
      let previous = null;
      for (const target of targets) {
        const combination = { account: account.label, user: maskEmail(username), primary, project: target.project,
          expectedRole: target.expectedRole || null, source: target.source || null, modules: [] };
        combinations.push(combination);
        if (!associated.has(target.project.toLowerCase())) {
          combination.error = 'Project is not associated with this account';
          combination.status = target.modules ? STATUS.failed : STATUS.notAccessible;
          continue;
        }
        try {
          const switched = await test.step(`Select project ${target.project}`, () => projectContext.select(target.project));
          previous ||= switched ? projectContext.history.at(-1).from : null;
          if (previous && switched) {
            await test.step(`Confirm navigation from ${previous} is not carried into ${target.project}`, async () => {
              const afterSwitch = await projectContext.resolver.navigation.captureTree();
              await page.reload({ waitUntil: 'domcontentloaded' });
              await projectContext.selector.expectActiveProject(target.project);
              const afterReload = await projectContext.resolver.navigation.captureTree();
              combination.carriedOver = carriedOver(afterSwitch, afterReload);
              expect.soft(combination.carriedOver, `Navigation shown after switching to ${target.project} must match a clean load of that project`).toEqual([]);
            });
          }
          const access = await test.step(`Resolve navigation, page and action access on ${target.project}`, () => projectContext.resolveAccess(target.actions || {}));
          await test.step(`Validate access on ${target.project} against ${target.modules ? 'the configured permissions' : 'observation only'}`, async () => {
            combination.role = access.role && { code: access.role.code, name: access.role.name, permissionCount: access.role.permissionCount };
            combination.navigation = access.navigation.map(item => [...item.path, item.label].join(' > '));
            for (const observation of access.modules) {
              combination.modules.push({ ...observation, evaluation: evaluateModule(observation, target.modules?.[observation.id], target.actions?.[observation.id]) });
            }
            if (target.expectedRole && access.role) {
              combination.roleMatches = [access.role.code, access.role.name].some(value => String(value).toLowerCase() === target.expectedRole.toLowerCase());
              expect.soft(combination.roleMatches, `Effective role on ${target.project} should be ${target.expectedRole}; session reports ${access.role.name}`).toBe(true);
            }
            for (const module of combination.modules) {
              expect.soft(module.evaluation.status, `${target.project} / ${module.name}: ${module.evaluation.note}; ${module.evaluation.findings.join('; ') || 'no findings'}`)
                .not.toBe(STATUS.failed);
              if (module.page.projectContext && module.page.projectContext !== 'retained') {
                expect.soft(module.page.projectContext, `${module.name} must keep ${target.project} selected`).toBe('retained');
              }
            }
            const failed = combination.modules.some(module => module.evaluation.status === STATUS.failed) || combination.roleMatches === false;
            const unknown = combination.modules.some(module => module.evaluation.status === STATUS.unknown);
            combination.roleUnobserved = Boolean(target.expectedRole && !access.role);
            combination.validated = combination.modules.every(module => module.evaluation.validated) && !combination.roleUnobserved;
            combination.status = failed ? STATUS.failed : unknown || combination.roleUnobserved ? 'Blocked' : combination.validated ? 'Validated' : 'Observed';
            const image = await page.locator('nav').first().screenshot({ timeout: 10000 }).catch(() => null);
            if (image) await info.attach(`Navigation: ${account.label} / ${target.project}`, { body: image, contentType: 'image/png' });
          });
          previous = target.project;
        } catch (error) {
          combination.error = error.message.split('\n')[0];
          combination.status = 'Failed';
          await page.goto(config.managementDashboardUrl, { waitUntil: 'domcontentloaded' }).catch(() => null);
        }
      }
    } finally {
      saveCombinations(account, combinations);
      executionJournal.setData('access', combinations.map(item => ({ project: item.project, status: item.status, error: item.error,
        role: item.role, carriedOver: item.carriedOver,
        modules: item.modules.map(module => ({ module: module.name, status: module.evaluation.status, validated: module.evaluation.validated,
          navigation: module.navVisible, page: module.page.reason, findings: module.evaluation.findings })) })));
      executionJournal.setData('blockedWrites', blockedWrites);
      await info.attach('scp-access-matrix', { body: Buffer.from(JSON.stringify(combinations, null, 2)), contentType: 'application/json' });
      if (shared) {
        await context.unroute('**/api/**', guard);
        executionJournal.setData('sharedSession', { account: maskEmail(username), signedInAfter: maskEmail(await sharedBrowser.signedInEmail(page)) });
      } else await context.close();
    }
    if (combinations.some(item => item.status === STATUS.failed || item.modules.some(module => module.evaluation.status === STATUS.failed))) {
      info.annotations.push({ type: 'access-validation-failed', description: 'Observed access differs from the configured permissions' });
    }
    const errors = combinations.filter(item => item.error && item.status !== STATUS.notAccessible);
    expect(errors.map(item => `${item.project}: ${item.error}`), 'Every configured user-project combination must be evaluated').toEqual([]);
    expect(blockedWrites, 'Access discovery must not attempt SCP business writes').toEqual([]);
    const incomplete = combinations.flatMap(combination => combination.modules.filter(module => module.evaluation.status === STATUS.unknown)
      .map(module => `${combination.project} / ${module.name}`));
    if (incomplete.length) throw new ScpBlocked(`Access could not be established for ${incomplete.join(', ')}`);
    if (combinations.some(item => item.roleUnobserved)) throw new ScpBlocked('An expected effective role could not be observed');
  });
}
