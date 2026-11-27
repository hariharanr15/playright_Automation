// Checks on a FRESH test project (user, 22 Nov 2026: use a fresh, unconfigured project, not SCP_Testing_Ram). The project
// is the newest "SCP Auto Test <run>" created by roles-write (PM-REG-ROLE-22) with the admin account as owner; configuring it
// permanently is fine. NRVC_Hall is only read.
//   PM-REG-PSC-05 The "PreShipping Checklist" menu item follows the Pre-Shipping toggle (Configuration Options).
//   PM-REG-CFG-18 Currency is set per project: a different currency on the fresh project leaves NRVC_Hall unchanged.
const { test, expect } = require('@playwright/test');
const { runPmSuite } = require('./support/pm-flow');
const { plKit } = require('./support/pl-flow');
const { ProjectSelectorPage } = require('../../pages/project-selector.page');

const SUITE = 'Fresh project checks';
const meta = (id, sub, title, kind = 'Integration') => ({ id, module: 'Project Management', submodule: sub, suite: SUITE, title, kind, navPath: ['Project Management', sub] });
const esc = v => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test.describe.configure({ mode: 'serial' });
test.setTimeout(60 * 60 * 1000);

test('Fresh project checks', async ({ page, browserName }) => {
  await runPmSuite({ page, browserName, suite: SUITE, scenarios: async ({ run, config }) => {
    const k = plKit(page);
    const { main, listbox } = k;
    const selector = new ProjectSelectorPage(page, config);
    const st = {};
    const openConfig = async () => { await page.goto('/configuration-options', { waitUntil: 'domcontentloaded' }); await k.settle(3000); await main.getByText('GRN', { exact: true }).first().waitFor({ timeout: 30000 }); };
    const toggle = label => main.locator('div.justify-between', { has: page.locator('p', { hasText: new RegExp(`^${esc(label)}`) }) }).last().locator('div.w-16.rounded-full').first();
    const isOn = async label => !/bg-switchGray/.test(await toggle(label).getAttribute('class'));
    const weekInputs = () => main.locator('input[type="text"]');
    const currencyButton = () => main.locator('div.justify-between', { has: page.locator('p', { hasText: /^Currency Type/ }) }).last().getByRole('button').first();
    const save = async () => { await main.getByRole('button', { name: 'Save', exact: true }).first().click(); await k.settle(2500); return (await page.getByRole('status').allInnerTexts()).join(' | '); };
    const menuHasPreShipping = async () => {
      await page.goto('/management-dashboard', { waitUntil: 'domcontentloaded' }); await k.settle(3000);
      const nav = page.locator('nav');
      const pm = nav.getByRole('button', { name: 'Project Management', exact: true }).first();
      // Menu of 24 Nov 2026: Project Management › Project Settings › PreShipping Checklist.
      const btn = name => nav.getByRole('button', { name, exact: true }).first();
      if (!(await btn('Project Settings').isVisible().catch(() => false))) { await pm.click().catch(() => null); await k.settle(600); }
      if (!(await btn('Configuration Options').isVisible().catch(() => false))) await btn('Project Settings').click().catch(() => null);
      await k.settle(800);
      return nav.getByRole('button', { name: 'PreShipping Checklist', exact: true }).first().isVisible().catch(() => false);
    };

    const setup = await run.scenario({ ...meta('FRP-SETUP', 'Setup', 'Sign in; find the fresh project', 'Setup'), always: true }, async s => {
      await k.signIn(s, config);
      await s.step('NRVC_Hall › Configuration Options → record the Currency Type', async () => {
        await openConfig(); st.nrvcCurrency = (await currencyButton().innerText()).trim(); s.observe(`NRVC_Hall currency: ${st.nrvcCurrency}`);
      }, { critical: true });
      await s.step('Header project selector → the newest "SCP Auto Test …" project (created by PM-REG-ROLE-22) is offered; switch to it', async () => {
        const projects = (await selector.sessionProjects()).map(p => p.name).filter(n => /^SCP Auto Test \d+/.test(n)).sort();
        st.fresh = projects.pop();
        s.observe(`fresh project: ${st.fresh || 'none'}`);
        expect(st.fresh, 'a fresh "SCP Auto Test" project for this account').toBeTruthy();
        await selector.ensureProject(st.fresh);
      }, { critical: true });
    });
    if (setup.status !== 'Passed') { run.abort('No fresh project'); return; }

    try {
      await run.scenario(meta('PM-REG-PSC-05', 'Configuration Options', 'The PreShipping Checklist menu item follows the Pre-Shipping toggle'), async s => {
        await s.step(`${'Fresh project'} › Configuration Options: fill empty week fields with 1 (a fresh project may be configured), "Pre-Shipping Checklist" Off, Save → PM menu has no "PreShipping Checklist"`, async () => {
          await openConfig();
          for (let i = 0; i < 3; i++) if (!(await weekInputs().nth(i).inputValue())) await weekInputs().nth(i).fill('1');
          if (await isOn('Pre-Shipping Checklist')) await toggle('Pre-Shipping Checklist').click();
          s.observe(`save: ${await save() || '(no message)'}`);
          await openConfig(); expect(await isOn('Pre-Shipping Checklist')).toBe(false);
          expect(await menuHasPreShipping(), 'menu item hidden while Off').toBe(false);
        }, { critical: true });
        await s.step('"Pre-Shipping Checklist" On, Save → the menu shows "PreShipping Checklist"', async () => {
          await openConfig(); await toggle('Pre-Shipping Checklist').click(); await save();
          expect(await menuHasPreShipping(), 'menu item shown while On').toBe(true);
        });
        await s.step('Off again, Save → hidden again', async () => {
          await openConfig(); if (await isOn('Pre-Shipping Checklist')) await toggle('Pre-Shipping Checklist').click(); await save();
          expect(await menuHasPreShipping(), 'hidden again').toBe(false);
        });
      });
      await run.scenario(meta('PM-REG-CFG-18', 'Configuration Options', 'Currency is set per project'), async s => {
        await s.step(`Fresh project › Configuration Options › "Currency Type": choose a currency other than NRVC_Hall's (${st.nrvcCurrency}), Save, reload → kept`, async () => {
          await openConfig();
          await currencyButton().click(); await k.settle(800);
          const other = (await listbox().getByRole('option').allInnerTexts()).map(t => t.trim()).find(t => t && t.toLowerCase() !== st.nrvcCurrency.toLowerCase());
          expect(other, 'another currency').toBeTruthy();
          await listbox().getByRole('option', { name: other, exact: true }).first().click();
          await save(); await openConfig();
          st.freshCurrency = (await currencyButton().innerText()).trim();
          s.observe(`fresh project currency: ${st.freshCurrency}`);
          expect(st.freshCurrency).toBe(other);
        });
        await s.step(`Switch back to ${config.projectName} › Configuration Options → still ${st.nrvcCurrency}`, async () => {
          await selector.ensureProject(config.projectName);
          await openConfig();
          expect((await currencyButton().innerText()).trim()).toBe(st.nrvcCurrency);
        });
      });
    } finally {
      await selector.ensureProject(config.projectName).catch(() => null);
    }
  } });
});
