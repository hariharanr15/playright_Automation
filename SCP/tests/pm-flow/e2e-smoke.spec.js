// SCP end-to-end smoke (P0) – "SCP – Updated End-to-End Smoke Automation Requirements" (TC-01 … TC-24), 12 Nov 2026.
// Execution order follows §15 of the requirements: login and homepage → master data → FDI configuration → one submittal
// (primary material, then "+ Add material" in the drawer) → components, lead time, bookings → Procurement Log status
// filter / export / Assign Responsible / Bulk Edit / Alert → Supplier and Subcontractor approvals → delivery and GRN →
// FDI inspection → Management Dashboard → Analytics → report → logout.
// One browser tab at 100 % zoom; account transitions by logout → pause → login:
//   Project Admin → existing Supplier (SCP_SUPPLIER_*) → NEW Subcontractor user → Project Admin.
// Records per run, named "<type> <N> <YYYYMMDD>" with N = next free number of the day: 1 material category, 1 material
// (upload only – Add Material is never opened), 1 supplier and 1 subcontractor record, 1 normal-organisation user
// (Subcontractor login subcontractor<N><DDMMYYYY>@yopmail.com in Voyage Control, not SSO), 1 FDI question set with 1 group and 2 questions (+ FDI category when the form offers "add"),
// 1 inspector mapping, exactly 1 submittal (secondary material SCP_E2E_MATERIAL_2 added with "+ Add material"),
// 1 component, booking and GRN per material, 1 alert rule, 1 inspection. Bulk Edit changes the Spec Description of two
// EARLIER run submittals (never this run's). Every creation step looks for its record first, so a retry never duplicates it.
// Pauses: E2E_ACTION_PAUSE_MS before every browser action (launcher, default 300), E2E_STEP_PAUSE_MS between steps (2000),
// E2E_LOGIN_PAUSE_MS before logins (3000), E2E_USER_PAUSE_MS after the user invite (2000). E2E_STEP_TIMEOUT_MS (300000)
// stops a step that makes no progress for 5 minutes; such a step is not retried.
// Report: e2e-report.html (rewritten after every step) and e2e-report.pdf.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { runPmSuite } = require('./support/pm-flow');
const { e2eKit, norm, esc, ddmmyyyy } = require('./support/e2e-kit');
const { e2eKitV2, nextSeq } = require('./support/e2e-kit-v2');
const { writeE2eReport, writeE2ePdf, summarise, compareAnalytics } = require('./support/e2e-report');
const { maskEmail } = require('../../utils/access/access-model');

if (!process.env.PM_FLOW_STEP_INTERVAL_MS) process.env.PM_FLOW_STEP_INTERVAL_MS = process.env.E2E_STEP_PAUSE_MS || '2000';
const LOGIN_PAUSE = Number(process.env.E2E_LOGIN_PAUSE_MS || 3000);
const USER_PAUSE = Number(process.env.E2E_USER_PAUSE_MS || 2000);
// With the optional manual YOPmail pause a person may need several minutes: allow 15 minutes per step then.
const STEP_LIMIT = Number(process.env.E2E_STEP_TIMEOUT_MS || (/^(1|true|yes)$/i.test(process.env.SCP_YOPMAIL_MANUAL_VERIFY || '') && !HEADLESS ? 900000 : 300000));
// A screenshot after every executed step (E2E_SCREENSHOT_EVERY_STEP=false limits it to evidence steps and failures).
const SHOT_EVERY_STEP = !/^(false|0|off)$/i.test(process.env.E2E_SCREENSHOT_EVERY_STEP || '');
const SUITE = 'E2E Smoke';
const stamp = new Date();
const D = stamp.toISOString().replace(/\D/g, '').slice(2, 12); // yymmddHHMM (UTC) – internal tag for PO / shipping references
const RUN = `E2E${D}`;
const pad = n => String(n).padStart(2, '0');
const DATE = `${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}`; // YYYYMMDD (local) – record names
const HHMM = `${pad(stamp.getHours())}${pad(stamp.getMinutes())}`;
const SITE = process.env.SCP_E2E_SITE || process.env.SCP_PL_SITE || 'Warehoust _NR';
const USER_ORG = process.env.SCP_E2E_USER_ORG || 'Voyage Control';
const MATERIAL_2 = process.env.SCP_E2E_MATERIAL_2 || '43 Inches';
const INSPECTOR_ROLE = process.env.SCP_E2E_INSPECTOR_ROLE || 'Subcontractor';
// Who approves the checklist in TC-16 and becomes the FDI inspector in TC-18:
//   existing (default) – the existing Subcontractor account SCP_SUBCONTRACTOR_*; also the fallback when activation fails.
//   invite             – the user invited in TC-06, activated from YOPmail. YOPmail shows a Cloudflare human check that the
//                        automation never answers, so this mode falls back unless SCP_YOPMAIL_MANUAL_VERIFY=1 (a person
//                        completes the check in a headed run). The user asked for no manual intervention (22 Nov 2026).
// TC-06 creates and verifies the invitation in both modes.
const HEADLESS = /^(1|true)$/i.test(process.env.PM_FLOW_HEADLESS || '');
// Default "existing" (pre-created Subcontractor account). "invite" (SCP_E2E_SUBCON_LOGIN=invite) activates the TC-06 user
// through its mail.tm mailbox; 22 Nov 2026 SCP's invitation did not reach the mail.tm inbox within 5 minutes, so invite
// is opt-in until delivery is proven. A failed activation falls back to the existing account.
const SUBCON_LOGIN = /^invite$/i.test(process.env.SCP_E2E_SUBCON_LOGIN || '') ? 'invite' : 'existing';
const FILTER_STATUS = process.env.SCP_E2E_FILTER_STATUS || 'Ordered';
const BULK_SEARCH = process.env.SCP_E2E_BULK_SEARCH || 'E2E26';
const ALERT_CONDITION = process.env.SCP_E2E_ALERT_CONDITION || '>=';
const ALERT_VALUE = process.env.SCP_E2E_ALERT_VALUE || '100';
const SYMBOL = { INR: '₹', USD: '$', GBP: '£', EUR: '€', AED: 'AED', AUD: 'A$', CAD: 'C$', SGD: 'S$', JPY: '¥' };
const today = new Date(stamp.getFullYear(), stamp.getMonth(), stamp.getDate());
const plusDays = d => new Date(today.getFullYear(), today.getMonth(), today.getDate() + d);
const TODAY = ddmmyyyy(today);
// PO date accepted by the server (poToday in pl-flow.js, SCP-DEF-074); Expected Delivery is counted from it.
const PO_DAY = require('./support/pl-flow').poToday();

const meta = (id, module, title, navPath) => ({ id, module, submodule: module, suite: SUITE, title, navPath });
const S = {
  login: meta('TC-01', 'Authentication', 'Login, project and location selected once', ['Management Dashboard']),
  home: meta('TC-02', 'Homepage', 'Homepage tabs, widgets, KPIs, Alerts / Notifications / Tasks baseline', ['Management Dashboard']),
  analyticsBefore: meta('TC-02B', 'Analytics', 'Analytics baseline: every page, sub-tab and section before any setup', ['Analytics']),
  category: meta('TC-03', 'Project Management', 'Create Material Category', ['Project Management', 'Material Category']),
  material: meta('TC-04', 'Project Management', 'Upload new material (Material Master upload only)', ['Project Management', 'Material Master']),
  suppliers: meta('TC-05', 'Supplier Management', 'Create exactly one normal Supplier (Is Sub-Contractor OFF)', ['User Management', 'Supplier List']),
  user: meta('TC-06', 'User Management', 'Create one normal organisation user', ['User Management', 'User Management']),
  mapping: meta('TC-07', 'Supplier Management', 'Material-to-Supplier mapping (one popup)', ['User Management', 'Supplier List']),
  fdiSet: meta('TC-19', 'FDI Configuration', 'FDI question set, category, group and questions', ['Project Management', 'First Delivery Inspection Config']),
  submittal: meta('TC-08', 'Procurement Log', 'Create one submittal with the primary material', ['Procurement Log']),
  secondMaterial: meta('TC-09', 'Procurement Log', 'Add the secondary material with "+ Add material"', ['Procurement Log']),
  components: meta('TC-10', 'Procurement Log', 'Components and lead-time confirmation', ['Procurement Log']),
  booking: meta('TC-10B', 'Procurement Log', 'Delivery booking for each component', ['Procurement Log']),
  statusExport: meta('TC-11', 'Procurement Log', 'Status filter and Export', ['Procurement Log']),
  assign: meta('TC-12', 'Procurement Log', 'Assign Responsible user', ['Procurement Log']),
  bulk: meta('TC-13', 'Procurement Log', 'Bulk Edit Spec Description: Confirm, then Roll Back validation', ['Procurement Log']),
  alert: meta('TC-14', 'Procurement Log', 'Create Procurement alert', ['Procurement Log']),
  entInbox: meta('TC-14B', 'Enterprise', 'Supplier Inbox lists the run delivery under Pending Pre-Shipping Checklists', ['Enterprise', 'Supplier Inbox']),
  shipment: meta('TC-14C', 'International Shipments', 'Log an international shipment for the run submittal', ['Enterprise', 'Enterprise Shipments']),
  supplierApproval: meta('TC-15', 'Supplier', 'Logout Project Admin, login Supplier, Supplier approval', ['Procurement Log']),
  subconApproval: meta('TC-16', 'Subcontractor', 'Logout Supplier, login Subcontractor, Subcontractor approval', ['Procurement Log']),
  delivery: meta('TC-17', 'Procurement Log', 'Logout Subcontractor, login Project Admin, complete deliveries', ['Procurement Log']),
  grn: meta('TC-17B', 'Procurement Log', 'Generate and verify GRN; submittal delivered', ['Procurement Log']),
  inspector: meta('TC-18', 'FDI Configuration', 'Assign the new user as inspector of the new material', ['Project Management', 'First Delivery Inspection Config']),
  fdiRecord: meta('TC-20', 'First Delivery Inspections', 'FDI record generated for the run delivery', ['First Delivery Inspections']),
  fdiInspect: meta('TC-21', 'First Delivery Inspections', 'Self Assign, fill, save and submit the inspection', ['First Delivery Inspections']),
  fdiView: meta('TC-22', 'First Delivery Inspections', 'Filter and view the submitted inspection', ['First Delivery Inspections']),
  dashboard: meta('TC-23', 'Management Dashboard', 'Previous vs current KPI values', ['Management Dashboard']),
  inbox: meta('TC-23B', 'Alerts / Notifications / Tasks', 'Alerts, Notifications and Tasks of the run', ['Management Dashboard']),
  entAfter: meta('TC-24B', 'Enterprise', 'Enterprise after the flow: checklist no longer pending, run supplier in Enterprise View', ['Enterprise', 'Enterprise View']),
  analytics: meta('TC-24', 'Analytics', 'Analytics after the flow (every page, compared with TC-02B) and reference data / configuration', ['Analytics']),
  report: meta('TC-25', 'Reporting', 'Detailed execution report generated', ['Management Dashboard']),
  logout: meta('TC-26', 'Authentication', 'Logout the active account', ['Management Dashboard'])
};

test.describe.configure({ mode: 'serial' });
test.setTimeout(3 * 60 * 60 * 1000);

test('SCP – End-to-end smoke', async ({ page }) => {
  await runPmSuite({ page, suite: SUITE, scenarios: async ({ run, config, navigator, outDir }) => {
    const kit = e2eKit(page, { config, navigator, outDir });
    const v2 = e2eKitV2(page, { kit, navigator, outDir, config, site: SITE });
    const { k } = kit;
    const env = run.result.environment;
    env.logins = 0; env.projectSelections = 0;
    const R = run.data;
    const RESPONSIBLE = process.env.SCP_E2E_RESPONSIBLE || config.username;
    Object.assign(R, {
      run: RUN, date: DATE, site: SITE, category: {}, supplier: {}, subcon: {}, fdi: {},
      newUser: { password: process.env.SCP_INVITED_USER_PASSWORD, role: 'Subcontractor', organization: USER_ORG, lastName: DATE,
        phoneNumber: '9876501234', addressLine1: '1 Test Street', addressLine2: 'Smoke Lane', state: 'Tamil Nadu', city: 'Chennai', country: 'India', postalCode: '600001' },
      submittal: { scheduleId: `${stamp.toISOString().replace(/\D/g, '').slice(0, 12)}01` }
    });
    // The two materials of the submittal: quantity, component value, mapped lead time, required date and the expected
    // delivery (PO date today + lead time). The new material's name is fixed in TC-04 (next free "Material N <date>").
    const M = [
      { key: 'new', name: null, qty: 10, value: 1000, weeks: 1, roj: plusDays(28) },
      { key: 'existing', name: MATERIAL_2, qty: 5, value: 500, weeks: 2, roj: plusDays(35) }
    ];
    for (const m of M) { m.expected = new Date(PO_DAY.getFullYear(), PO_DAY.getMonth(), PO_DAY.getDate() + 7 * m.weeks); m.po = `${RUN}-PO-${m.key.toUpperCase()}`; }
    R.materials = M;
    const sub = R.submittal;
    const sessions = []; const recordsTable = []; const dashboard = { rows: [] }; const home = {}; const analytics = { before: {}, after: {} };
    const current = { role: 'Signed out', org: '' };
    const records = {};
    let lastRecordId = null;

    // ---------- report plumbing ----------
    const flush = () => { try { writeE2eReport({ result: run.result, records: recordsTable, sessions, dashboard, home: home.tabs ? home : null, analytics, title: `SCP E2E Smoke ${DATE} (${RUN})`, video: process.env.PM_FLOW_VIDEO === 'on' ? 'e2e-run.mp4' : null }, outDir); } catch (e) { console.log(`report write failed: ${e.message}`); } };
    const slug = t => String(t).replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 50);
    // Every step gets a Step ID, the active role/organisation, its end time, the record it created, a screenshot, and the
    // report is rewritten at once (results survive an unexpected stop). A step that makes no progress for E2E_STEP_TIMEOUT_MS
    // is stopped with the page URL in the error; it is not retried (its first attempt may still be acting on the page).
    const runnerStep = run.step.bind(run);
    run.step = async (rec, context, title, name, fn, options = {}) => {
      lastRecordId = null;
      let timedOut = false;
      const guarded = async () => {
        if (timedOut) throw new Error(`Not retried: the first attempt made no progress for ${STEP_LIMIT / 60000} min`);
        let timer;
        try {
          return await Promise.race([fn(), new Promise((_, reject) => { timer = setTimeout(() => { timedOut = true; reject(new Error(`No progress for ${STEP_LIMIT / 60000} min on ${new URL(page.url()).pathname} – step stopped`)); }, STEP_LIMIT); })]);
        } finally { clearTimeout(timer); }
      };
      // Each step runs ONCE (no automatic re-execution); a failure is recorded with its screenshot and the flow goes on.
      const value = await runnerStep(rec, context, title, name, guarded, { attempts: 1, ...options });
      const step = rec.steps[rec.steps.length - 1];
      step.id = `${rec.id}.${String(rec.steps.length).padStart(2, '0')}`;
      step.role = current.role; step.org = current.org;
      step.finishedAt = new Date().toISOString();
      step.mandatory = !options.optional;
      if (lastRecordId) step.recordId = lastRecordId;
      if ((options.evidence || SHOT_EVERY_STEP) && step.status === 'Passed') step.evidence = await run.capture(`${step.id}-${slug(name)}`);
      flush();
      return value;
    };
    // A test case counts as passed for its dependants when every MANDATORY step passed (optional findings do not block).
    const ok = r => !!r && (r.status === 'Passed' || r.status === 'Known Defect' || (r.steps.length > 0 && r.steps.every(st => st.status === 'Passed' || st.status === 'Known Defect' || st.mandatory === false)));
    const block = (m, reason) => {
      const rec = { ...m, status: 'Blocked', reason, steps: [], startedAt: new Date().toISOString(), durationMs: 0 };
      run.result.scenarios.push(rec); flush();
      console.log(`\n⏭ ${m.id} Blocked – ${reason}`);
      return rec;
    };
    const scenario = async (key, needs, body) => {
      const missing = needs.find(n => !ok(records[n]));
      records[key] = missing ? block(S[key], `Prerequisite ${S[missing].id} (${S[missing].title}) did not pass`) : await run.scenario(S[key], body);
      flush();
      return records[key];
    };
    const record = (module, what, id, name, role, note) => { recordsTable.push({ module, record: what, id, name, role, note }); lastRecordId = `${what}: ${id || name}`; flush(); };

    // Login / logout transitions with account, role, organisation, times, status and a screenshot.
    const transition = async (action, who, fn) => {
      const entry = { seq: sessions.length + 1, action, account: maskEmail(who.email), role: who.role, organization: '', startedAt: new Date().toISOString(), status: 'RUNNING' };
      sessions.push(entry); flush();
      console.log(`  ⇄ ${entry.seq}. ${action} – ${who.role} (${entry.account})`);
      try {
        await fn();
        entry.status = 'PASS';
        if (/login/i.test(action)) { current.role = who.role; current.org = ''; env.logins += 1; } else { entry.organization = current.org; current.role = 'Signed out'; current.org = ''; }
      } catch (error) { entry.status = 'FAIL'; entry.error = error.message.split('\n')[0]; throw error; } finally {
        entry.finishedAt = new Date().toISOString();
        entry.screenshot = await run.capture(`session-${entry.seq}-${slug(action)}-${slug(who.role)}`);
        flush();
      }
    };
    const pause = async () => { if (LOGIN_PAUSE) await page.waitForTimeout(LOGIN_PAUSE); };
    const confirmSession = async (s, verifyRole, expectOrg) => {
      const role = await kit.projectRole(); const org = await kit.activeOrganization();
      current.org = org || '';
      const last = [...sessions].reverse().find(x => /login/i.test(x.action)); if (last) last.organization = org || '';
      s.observe(`Active user ${await kit.activeUser()} · role ${role} · organisation ${org}`);
      expect(role, `Signed in with the correct account (role ${verifyRole})`).toMatch(new RegExp(verifyRole, 'i'));
      if (expectOrg) expect(norm(org), `Organisation ${expectOrg}`).toBe(norm(expectOrg));
    };
    // Each login is a new session, so project and site are selected once per login (never again while signed in).
    const loginAs = async (s, who, verifyRole, expectOrg) => {
      await s.step(`Wait for the login page, pause ${LOGIN_PAUSE / 1000} s, log in as ${who.role} (${maskEmail(who.email)}) → that account is the active user`, async () => {
        await pause();
        await transition('Login', who, () => kit.signInAs({ username: who.email, password: who.password }));
      }, { critical: true, evidence: true });
      await s.step(`Open Supply Chain Planner, select ${config.projectName} and ${SITE} (once for this login) → role "${verifyRole}"${expectOrg ? `, organisation ${expectOrg}` : ''}`, async () => {
        await kit.enterProject(SITE); env.projectSelections += 1; loginSelection();
        await confirmSession(s, verifyRole, expectOrg);
      }, { critical: true });
    };
    const logoutAs = (s, who) => s.step(`Log out ${who.role} (avatar menu › Logout) → login page shown`, () => transition('Logout', who, () => kit.signOut()), { critical: true, evidence: true });

    // ---------- Procurement Log navigation (any role) ----------
    const drawer = async () => {
      // Re-opened through the menu and search (no page reload, which would reset the header site).
      if (!(sub.id && page.url().includes(`submittal=${sub.id}`) && !page.url().includes('schedule='))) {
        await navigator.clearLayers();
        const { listed, count } = await kit.findSubmittal(sub.number);
        expect(listed, `${sub.number} listed (${count})`).toBe(true);
        await k.openSubmittal(sub.description);
      }
      await k.addComponentButton().waitFor({ timeout: 30000 });
      await k.settle(1500);
    };
    // TC-25: project + location are selected once per login and kept in the run context (v2.siteContext); before a
    // Procurement Log action the header location is only READ (ensureLocationSelected) - the dropdown is opened only when
    // the app has cleared/changed it. Every check is logged in env.siteChecks for the execution report.
    env.siteChecks = v2.siteChecks;
    const loginSelection = () => {
      v2.siteContext.project = config.projectName; v2.siteContext.location = SITE;
      v2.siteChecks.push({ at: 'Login (new session)', time: new Date().toISOString(), found: '', outcome: 'PASS – Location selected successfully (new login session)' });
    };
    const keepSite = async where => { if (await v2.keepSite(where)) { env.siteReselections = v2.siteReselections; await k.menu('Procurement Log').catch(() => null); } };
    // Reopens the run submittal through the Procurement Log menu and search: fresh data without a page reload.
    const reopenDrawer = async () => {
      const { listed, count } = await kit.findSubmittal(sub.number);
      expect(listed, `${sub.number} listed (${count})`).toBe(true);
      await k.openSubmittal(sub.description);
      await k.addComponentButton().waitFor({ timeout: 30000 });
      await k.settle(1500);
    };
    const reopenComponent = async m => {
      await reopenDrawer();
      await k.openComponent(m.name);
      await k.settle(500);
    };
    const atComponent = async m => {
      await keepSite(`Component ${m.name}`);
      await drawer();
      const cell = () => k.componentRow(m.name);
      // The submittal drawer sometimes opens with an empty components table ("No data found", 20 Nov 2026 TC-16):
      // reopen it once through the Procurement Log menu and search (no page reload: that resets the header site).
      if (!(await cell().isVisible({ timeout: 15000 }).catch(() => false))) {
        await navigator.clearLayers();
        await k.menu('Procurement Log').catch(() => null);
        await keepSite(`Component ${m.name} (drawer reopened)`);
        await reopenDrawer();
      }
      await k.openComponent(m.name);
      await k.settle(500);
    };

    const PA = { email: config.username, password: config.password, role: 'Project Admin' };
    const SUP = { email: config.accounts.supplier.username, password: config.accounts.supplier.password, role: 'Supplier (existing account)' };
    const NEW = { email: null, password: R.newUser.password, role: 'Subcontractor (new user)' };
    const EXISTING_SUBCON = { email: config.accounts.subcontractor.username, password: config.accounts.subcontractor.password,
      role: 'Subcontractor (existing account)' };
    // The account used by TC-16 (approval), TC-17 (logout) and TC-18 (inspector). In "invite" mode it switches to the
    // existing account when the YOPmail activation fails (fallback, recorded in TC-16).
    let subconLogin = SUBCON_LOGIN;
    let SUBCON = subconLogin === 'invite' ? NEW : EXISTING_SUBCON;
    console.log(`Run ${DATE} (tag ${RUN})`);

    try {
      // ================= TC-01 Login and project selection =================
      records.login = await run.scenario({ ...S.login, always: true }, async s => {
        await s.step(`Open the SCP login page and log in as Project Admin (${maskEmail(PA.email)}) → that account is the active user`, () => transition('Login', PA, () => kit.signInAs({ username: PA.email, password: PA.password })), { critical: true, evidence: true });
        await s.step(`Supply Chain Planner; select project ${config.projectName} and location ${SITE} exactly once → header shows both; role Project Admin`, async () => {
          await kit.enterProject(SITE); env.projectSelections += 1; loginSelection();
          const h = await kit.header();
          const projects = (await new (require('../../pages/project-selector.page').ProjectSelectorPage)(page, config).sessionProjects()).map(p => p.name);
          s.observe(`Project ${h.project} · site ${h.site} · ${projects.length} project(s) on the account`);
          expect(norm(h.project)).toBe(norm(config.projectName));
          expect(norm(h.site)).toContain(norm(SITE));
          expect(projects.map(norm), `${config.projectName} is one of the account's projects`).toContain(norm(config.projectName));
          await confirmSession(s, 'Admin');
        }, { critical: true });
        await s.step('Browser zoom → 100 % (device scale factor 1)', async () => {
          const ratio = await page.evaluate(() => window.devicePixelRatio);
          s.observe(`devicePixelRatio ${ratio}`);
          expect(ratio).toBe(1);
        });
      });
      if (!ok(records.login)) { run.abort('Project Admin login or project selection failed'); return; }

      // ================= TC-02 Homepage =================
      await scenario('home', ['login'], async s => {
        await s.step('Homepage (Management Dashboard) shown → main navigation tabs captured with their visibility', async () => {
          Object.assign(home, await v2.homepage());
          await page.waitForTimeout(2000); // the homepage stays on screen long enough to be seen in the run video
          s.observe(home.tabs.map(t => `${t.name}${t.visible ? '' : ' (hidden)'}`).join(', '));
          for (const tab of ['Management Dashboard', 'Procurement Log', 'First Delivery Inspections', 'User Management', 'Project Management', 'Analytics']) expect(home.tabs.map(t => t.name), `Tab ${tab}`).toContain(tab);
        }, { critical: true, evidence: true });
        await s.step('Homepage widgets and modules → summary KPIs, dashboard views and urgent issues captured', async () => {
          s.observe(`${Object.entries(home.widgets).map(([n, v]) => `${n}: ${v}`).join(' · ')} · views ${home.views.join(', ')} · urgent ${home.urgent}`);
          expect(home.widgets['Open submittals'], 'Open submittals widget').not.toBe('');
          expect(home.views.join(' '), 'Dashboard / Alerts / Notifications / Tasks views').toMatch(/Dashboard[\s\S]*Alerts[\s\S]*Notifications[\s\S]*Tasks/);
        });
        await s.step('Management Dashboard baseline (project, no date filter on the KPIs) → KPIs, submittals by status and every category row captured', async () => {
          R.filters = { project: config.projectName, site: SITE, dateFilter: 'none (dashboard KPIs are project-wide)' };
          R.before = await kit.readDashboard('*');
          dashboard.beforeShot = await run.capture('dashboard-before');
          const b = R.before;
          s.observe(`In scope ${b.categoriesInScope}; open ${b.open} of ${b.total}; deliveries ${b.deliveriesOnTime} of ${b.deliveriesWithDate}; by status ${JSON.stringify(b.byStatus || b.statusRaw)}; ${Object.keys(b.categories).length} category rows`);
          expect(b.total, 'Total submittals read').not.toBeNull();
          expect(b.byStatus, 'Status counts read').toBeTruthy();
        }, { critical: true, evidence: true });
        await s.step('Alerts, Notifications and Tasks → unread counts captured (baseline)', async () => {
          R.inboxBefore = {};
          for (const tab of ['Alerts', 'Notifications', 'Tasks']) R.inboxBefore[tab] = await kit.inboxCount(tab);
          home.inbox = R.inboxBefore;
          s.observe(JSON.stringify(R.inboxBefore));
        }, { evidence: true });
        await s.step('Homepage screenshot → saved for the report', async () => {
          await k.main.getByRole('button', { name: /^Dashboard$/ }).first().click().catch(() => null); await k.settle(1500);
          home.shot = await run.capture('homepage');
          expect(home.shot).toBeTruthy();
        });
      });

      // ================= TC-02B Analytics baseline (before any master-data / procurement activity) =================
      await scenario('analyticsBefore', ['login'], async s => {
        for (const name of v2.ANALYTICS_PAGES) {
          await s.step(`Analytics › ${name} (baseline) → location verified; every sub-tab visited; page scrolled to the end with screenshots; filters, KPI values and tables captured`, async () => {
            const r = analytics.before[name] = await v2.analyticsPage(name, 'before');
            const sec = r.sections;
            s.observe(`${r.url} · sections ${sec.map(x => x.tab).join(', ')} · ${sec.reduce((a, x) => a + Object.keys(x.metrics).length, 0)} KPI value(s) · ${sec.reduce((a, x) => a + x.tables.reduce((b, t) => b + t.rows.length, 0), 0)} table row(s) · filters ${[...new Set(sec.flatMap(x => x.filters))].join(' | ') || 'none'} · ${r.shots.length} screenshot(s)`);
            expect(r.shots.length, 'Screenshots').toBeGreaterThan(0);
          }, { evidence: true });
        }
        await s.step('Configuration Options → every setting captured (baseline)', async () => {
          analytics.configBefore = await v2.configurationOptions();
          s.observe(Object.entries(analytics.configBefore).map(([k2, v]) => `${k2}: ${v}`).join(' · '));
          expect(Object.keys(analytics.configBefore).length, 'Settings read').toBeGreaterThan(0);
        }, { evidence: true });
      });

      // ================= TC-03 Material category =================
      await scenario('category', ['login'], async s => {
        await s.step(`Material Category: search "${DATE}" → next free name "Material Category <N> ${DATE}" (not used yet)`, async () => {
          if (!R.category.name) {
            const names = await v2.categoryNames(DATE);
            R.category.name = `Material Category ${nextSeq(names, 'Material Category', DATE)} ${DATE}`;
            s.observe(`${names.filter(n => /Material Category/i.test(n)).length} category name(s) of today; using "${R.category.name}"`);
          }
          expect(await kit.categoryExists(R.category.name), 'Name not used yet').toBeFalsy();
        }, { critical: true });
        await s.step(`Project Management › Reference Data › Material Category › "Add Material Category": Name "<new name>", "Add" (once) → form closes`, async () => {
          const r = await kit.createCategory(R.category.name);
          if (!r.created) s.observe('Category already created by the first attempt – not created again');
          else { R.category.id = r.id; s.observe(`${R.category.name}: HTTP ${r.status}${r.id ? `, id ${r.id}` : ''}`); }
        }, { critical: true, evidence: true });
        await s.step('Material Category: search the new name → listed exactly once (name and created date recorded)', async () => {
          const row = await kit.categoryRow(R.category.name);
          expect(row.count, 'Listed once').toBe(1);
          R.category.createdAt = row.cells[1];
          record('Project Management', 'Material category', R.category.id || '', R.category.name, 'Project Admin', `Created ${row.cells[1] || ''}`);
          s.observe(row.cells.join(' | '));
        }, { critical: true });
      });

      // ================= TC-04 Material upload =================
      await scenario('material', ['category'], async s => {
        const m = M[0];
        await s.step(`Material Master: search "${DATE}" → next free name "Material <N> ${DATE}"`, async () => {
          if (!m.name) {
            const names = await v2.materialNames(DATE);
            m.name = `Material ${nextSeq(names, 'Material', DATE)} ${DATE}`;
            s.observe(`${names.length} material name(s) of today; using "${m.name}"`);
          }
        }, { critical: true });
        await s.step('Material Master › "Upload" › "Download Template" (Manual Entry / Add Material is not opened) → template with sheet "Materials" and UoM list', async () => {
          const t = await kit.downloadMaterialTemplate();
          expect(t.sheets).toContain('Materials');
          const wanted = process.env.SCP_E2E_UOM;
          R.uom = wanted ? t.uoms.find(u => norm(u) === norm(wanted)) : t.uoms[0];
          expect(R.uom, 'UoM available').toBeTruthy();
          R.template = t.path;
          s.observe(`${t.name}; UoM "${R.uom}"`);
        }, { critical: true });
        await s.step(`Material Master › "Upload" › "Upload File" (once): one row "<new material>" in the new category → Total rows 1, Succeeded 1, Duplicates 0, Rejected 0, New categories 0`, async () => {
          if (await kit.findMaterial(m.name)) { s.observe('Material already created by the first attempt – not uploaded again'); return; }
          const result = await kit.uploadMaterials({ template: R.template, tag: RUN, rows: [{ category: R.category.name, material_name: m.name, uom: R.uom }] });
          R.upload = result;
          s.observe(`${m.name} · ${result.file}: ${result.summary}`);
          expect(result.seen.filter(x => x.startsWith('prompt')), 'No unknown-category/UoM prompt').toEqual([]);
          const n = label => Number((result.summary.match(new RegExp(`${label}\\s*(\\d+)`, 'i')) || [])[1]);
          expect([n('Total rows'), n('Succeeded'), n('Duplicates'), n('Rejected'), n('New categories created')]).toEqual([1, 1, 0, 0, 0]);
        }, { critical: true, evidence: true });
        await s.step('Material Master: search the new material → exactly one material in the new category, UoM recorded; Material ID stored', async () => {
          await expect.poll(async () => (await kit.materialRows(m.name)).filter(c => norm(c[3]) === norm(m.name)).length, { timeout: 30000 }).toBe(1);
          const found = await kit.findMaterial(m.name);
          expect(norm(found.category), 'Mapped to the new category').toBe(norm(R.category.name));
          expect(norm(found.uom)).toBe(norm(R.uom));
          Object.assign(m, { id: found.id, listedName: found.name, category: found.category, uom: found.uom });
          record('Project Management', 'Material (primary)', found.id, found.name, 'Project Admin', `Category ${found.category} · UoM ${found.uom} · ${R.upload?.file || ''}`);
          s.observe(`Material ID ${found.id}`);
        }, { critical: true });
        await s.step(`Material Master: existing secondary material "${MATERIAL_2}" → listed; its ID and category recorded`, async () => {
          const x = await kit.findMaterial(MATERIAL_2);
          expect(x, `${MATERIAL_2} exists`).toBeTruthy();
          Object.assign(M[1], { id: x.id, category: x.category, listedName: x.name, uom: x.uom });
          s.observe(`${x.name} · ID ${x.id} · category ${x.category}`);
        }, { critical: true });
      });
      for (const m of M) m.name = m.listedName || m.name;

      // ================= TC-05 Exactly one normal Supplier =================
      // 12 Nov 2026 rule: one normal Supplier per run ("Is Sub-Contractor" OFF), "Add Supplier" and "Save" once each; no
      // Supplier List subcontractor record is created (the Subcontractor approvals use the invited Subcontractor user, TC-06).
      await scenario('suppliers', ['login'], async s => {
        const supplierNamesToday = names => names.filter(n => new RegExp(`^\\s*Supplier\\s*\\d+\\s+${DATE}(?!\\d)`).test(n));
        await s.step(`User Management › Supplier List: search "${DATE}" → next free name "Supplier <N> ${DATE}"`, async () => {
          if (!R.supplier.name) {
            const names = await v2.supplierNames(DATE);
            R.supplier.before = supplierNamesToday(names);
            R.supplier.name = `Supplier ${nextSeq(names, 'Supplier', DATE)} ${DATE}`;
            R.supplier.email = `supplier.${DATE}${HHMM}@yopmail.com`;
            s.observe(`${R.supplier.before.length} supplier(s) of today; using "${R.supplier.name}"`);
          }
        }, { critical: true });
        await s.step(`Supplier List › "Add Supplier" (once): "Is Sub-Contractor" OFF on open and before saving (never switched); name ${R.supplier.name || '"Supplier <N> <date>"'}, address and contact entered once; "Save" once → toast "added successfully"`, async () => {
          const r = await kit.ensureSupplier({ name: R.supplier.name, email: R.supplier.email, subcontractor: false, tag: RUN });
          s.observe(r.created ? `${R.supplier.name} saved with "Is Sub-Contractor" OFF (checked on open and before Save)` : `${R.supplier.name} already exists – not created again`);
        }, { critical: true, evidence: true });
        await s.step('Supplier List: the new supplier → exactly one row, Type "Supplier" (not Subcontractor); exactly one supplier created in this run; Supplier ID stored for mapping, submittal and procurement', async () => {
          const found = await kit.supplierRow(R.supplier.name);
          expect(found, `${R.supplier.name} listed`).toBeTruthy();
          expect(await k.rows().filter({ has: page.getByRole('cell', { name: R.supplier.name, exact: true }) }).count(), 'Exactly one row').toBe(1);
          expect(found.values.Type, 'Normal supplier, Is Sub-Contractor OFF').toMatch(/^Supplier$/);
          R.supplier.id = found.values['Supplier ID'];
          const after = supplierNamesToday(await v2.supplierNames(DATE));
          const added = after.filter(n => !R.supplier.before.includes(n));
          s.observe(`Type "${found.values.Type}", ID ${R.supplier.id}; suppliers of today ${R.supplier.before.length} → ${after.length} (new: ${added.join(', ') || 'none'})`);
          expect(added, 'Exactly one supplier created in this execution').toEqual([R.supplier.name]);
          record('Supplier Management', 'Supplier record', R.supplier.id, R.supplier.name, 'Project Admin', 'Normal supplier (Is Sub-Contractor OFF); used for mapping, submittal and procurement');
          await page.waitForTimeout(2000);
        }, { critical: true });
      });

      // ================= TC-06 Normal organisation user =================
      await scenario('user', ['login'], async s => {
        // The invited Subcontractor user (Subcontractor approvals in TC-16) logs in with "subcontractor<N><DDMMYYYY>@yopmail.com",
        // N = next number not yet used by a user today. Since 22 Nov 2026 the address is a mail.tm mailbox created through its
        // API, so TC-16 reads the invitation without a browser mailbox and no human check (SCP_E2E_INVITE_MAILBOX=yopmail keeps
        // the old "@yopmail.com" address).
        await s.step(`User Management: search "subcontractor" → next free login "subcontractor<N><DDMMYYYY>…"; create its mail.tm mailbox (API)`, async () => {
          if (!R.newUser.email) {
            const dmy = `${DATE.slice(6, 8)}${DATE.slice(4, 6)}${DATE.slice(0, 4)}`;
            const emails = await v2.userEmails(dmy); // only today's e-mails (the list is paged)
            const used = emails.map(e => (e.match(new RegExp(`^subcontractor(\\d+)${dmy}`)) || [])[1]).filter(Boolean).map(Number);
            const n = (used.length ? Math.max(...used) : 0) + 1;
            R.subcon.seq = n;
            // mail.tm can be unavailable or rate-limited (22 Nov 2026): then the old YOPmail address is used, the invite is
            // still sent, and TC-16 falls back to the existing Subcontractor account – the flow never stops here.
            R.subcon.email = `subcontractor${n}${dmy}@yopmail.com`;
            if (!/^yopmail$/i.test(process.env.SCP_E2E_INVITE_MAILBOX || '')) {
              try { R.subcon.email = (await require('../../utils/mailtm').createMailbox(`subcontractor${n}${dmy}`)).address; }
              catch (error) { s.observe(`mail.tm unavailable (${String(error.message).slice(0, 120)}): YOPmail address used; TC-16 will fall back to the existing Subcontractor account`); }
            }
            Object.assign(R.newUser, { firstName: `subcontractor${n}`, displayName: `subcontractor${n} ${DATE}`, email: R.subcon.email });
            s.observe(`${used.length} subcontractor login(s) of today; using "${R.newUser.displayName}" (${maskEmail(R.newUser.email)})`);
          }
          NEW.email = R.newUser.email;
        }, { critical: true });
        let invite;
        await s.step(`User Management › "Invite Users" (normal, non-SSO user): e-mail, Role "Subcontractor", Organization "${USER_ORG}" (existing organisation; no SSO organisation created); "Send Invites" once → toast "Invite Sent Successfully"; pause ${USER_PAUSE / 1000} s`, async () => {
          invite = await kit.ensureInvite({ email: R.newUser.email, role: 'Subcontractor', organization: USER_ORG });
          if (!invite.sent) { s.observe('Invite already sent by the first attempt – not sent again'); return; }
          R.newUser.organization = invite.organization;
          record('User Management', 'User (normal organisation user)', '', `${R.newUser.displayName} (${maskEmail(R.newUser.email)})`, 'Subcontractor', `Organisation ${invite.organization}; login verified in TC-16`);
          s.observe(`Organisation "${invite.organization}" (${invite.offeredCount} organisations offered)`);
          await page.waitForTimeout(USER_PAUSE);
        }, { critical: true, evidence: true });
        await s.step(`Invited user → organisation "${USER_ORG}" (normal organisation user, not SSO)`, async () => {
          s.observe(`Organisation "${R.newUser.organization}"`);
          expect(norm(R.newUser.organization)).toBe(norm(USER_ORG));
        });
      });

      // ================= TC-07 Material-to-supplier mapping =================
      await scenario('mapping', ['material', 'suppliers'], async s => {
        let result;
        await s.step(`Supplier ${R.supplier.name} › "Map Material" (panel opened once): ${M.map(m => `${m.name} – ${m.weeks} week(s)`).join(', ')}, "SUBMIT" per missing material; panel closed once`, async () => {
          result = await kit.ensureMappings({ supplier: R.supplier.name, items: M.map(m => ({ material: m.name, weeks: m.weeks })) });
          s.observe(result.added.length ? `Mapped ${result.added.join(', ')}` : 'Both materials already mapped by the first attempt');
        }, { critical: true, evidence: true });
        await s.step('Mapping rows → each material listed once with its Material ID and lead time', async () => {
          for (const m of M) {
            const rows = result.rows.filter(x => norm(x).includes(norm(m.name)));
            s.observe(`${m.name}: ${rows[0] || 'not listed'}`);
            expect(rows.length, `${m.name} mapped once`).toBe(1);
            expect(rows[0]).toContain(m.id);
            expect(rows[0].trim().endsWith(String(m.weeks))).toBe(true);
          }
          record('Supplier Management', 'Material mapping', R.supplier.id, `${R.supplier.name} ← ${M.map(m => m.name).join(', ')}`, 'Project Admin', M.map(m => `${m.name} ${m.weeks} wk`).join(' · '));
        }, { critical: true });
      });

      // ================= TC-19 FDI question set (configured before the submittal) =================
      await scenario('fdiSet', ['material'], async s => {
        const F = R.fdi;
        await s.step(`First Delivery Inspection Config: existing question sets → next free "FDI Question Set <N> ${DATE}", "FDI Category <N> ${DATE}", "FDI Group <N> ${DATE}"`, async () => {
          if (!F.set) {
            const n = nextSeq(await v2.fdiSetNames(), 'FDI Question Set', DATE);
            Object.assign(F, { set: `FDI Question Set ${n} ${DATE}`, category: `FDI Category ${n} ${DATE}`, group: `FDI Group ${n} ${DATE}`,
              questions: [`Delivered quantity matches the PO (FDI ${n} ${DATE})`, `Packaging and labels are intact (FDI ${n} ${DATE})`] });
          }
          s.observe(`${F.set} · ${F.category} · ${F.group}`);
        }, { critical: true });
        await s.step(`"New Question Set": name, Specific categories = the run material category "${R.category.name}" (links ${M[0].name}) and new category "<FDI Category>", "Create Question Set" → set tab appears`, async () => {
          const r = await v2.createFdiSet({ name: F.set, categories: [R.category.name], addCategory: F.category });
          if (!r.created) s.observe('Question set already created by the first attempt');
          else { F.categoryAdded = r.categoryAdded; s.observe(r.categoryAdded ? `FDI category "${r.categoryAdded}" added` : `"Search or add a category" offered no add control for "${F.category}" – set covers ${R.category.name}`); }
          record('FDI Configuration', 'FDI question set', '', F.set, 'Project Admin', `Categories ${[R.category.name, F.categoryAdded].filter(Boolean).join(', ')}`);
        }, { critical: true, evidence: true });
        await s.step(`FDI category "<FDI Category>" created with the set`, async () => {
          if (!F.categoryAdded) throw new Error(`New Question Set offered no way to add category "${F.category}" from "Search or add a category"`);
          record('FDI Configuration', 'FDI category', '', F.category, 'Project Admin', `In ${F.set}`);
        }, { optional: true });
        await s.step(`Set › "Manage Groups" › "Add Group": "<FDI Group>" → listed in the groups table`, async () => {
          const r = await v2.addFdiGroup(F.set, F.group);
          if (!r.created) s.observe('Group already added by the first attempt');
          record('FDI Configuration', 'FDI group', '', F.group, 'Project Admin', `In ${F.set}`);
        }, { critical: true });
        for (const q of F.questions) {
          await s.step(`Set › "Add Question": "${q}", Answer Type "Text" → listed in the set`, async () => {
            const r = await v2.addFdiQuestion(F.set, q, 'Text');
            if (!r.created) s.observe('Question already added by the first attempt');
          }, { critical: true });
          await s.step(`Question "${q}" › Group = "<FDI Group>" → kept`, () => v2.setQuestionGroup(F.set, q, F.group), { critical: true });
        }
        await s.step('Question set → both questions in the group, type text, Enabled; set covers the run material category', async () => {
          const qs = await v2.setQuestions(F.set);
          s.observe(qs.map(q => `${q.text} [${q.group}, ${q.type}, ${q.status}]`).join(' · '));
          for (const text of F.questions) {
            const q = qs.find(x => x.text.includes(text));
            expect(q, `${text} in the set`).toBeTruthy();
            expect(q.group).toBe(F.group);
            expect(q.type).toMatch(/text/i);
            expect(q.status).toMatch(/Enabled/i);
          }
          await expect(v2.setTab(F.set)).toContainText(R.category.name);
        }, { critical: true, evidence: true });
        await s.step(`Supplier association → the question set has no supplier field (sets are chosen by material category); ${R.supplier.name} recorded`, async () => {
          s.observe(`Set "${F.set}" applies to deliveries of ${M[0].name} (category ${R.category.name}) from any supplier, including ${R.supplier.name}`);
        }, { optional: true });
      });

      // ================= TC-08 Submittal (primary material only) =================
      await scenario('submittal', ['mapping'], async s => {
        await s.step(`Procurement Log: search "${DATE}" → next free submittal number "submittal <N> ${DATE}"`, async () => {
          if (!sub.number) {
            const numbers = await v2.submittalNumbers(DATE);
            const n = nextSeq(numbers, 'submittal', DATE);
            Object.assign(sub, { number: `submittal ${n} ${DATE}`, spec: `SPEC-${DATE}-${n}`, description: `E2E smoke submittal ${n} ${DATE}` });
            s.observe(`${numbers.length} submittal(s) matching today; using "${sub.number}"`);
          }
        }, { critical: true });
        await s.step(`Procurement Log › "Add Submittal" (once): number, spec, description, Schedule Id ${sub.scheduleId}, supplier ${R.supplier.name}, ONLY material ${M[0].name} → toast "Submittal added successfully"`, async () => {
          const { listed } = await kit.findSubmittal(sub.number);
          if (listed) { s.observe('Submittal already created by the first attempt – not created again'); return; }
          await k.addSubmittal({ ...sub, supplier: R.supplier.name, materials: [M[0].name] });
          await k.toast('Submittal added successfully');
        }, { critical: true, evidence: true });
        await s.step(`Search the submittal → exactly one, Supplier ${R.supplier.name}, Source "Manual", Material Name exactly ${M[0].name} (one material)`, async () => {
          await k.search(sub.number);
          await expect.poll(() => k.rows().filter({ has: page.getByRole('cell', { name: sub.number, exact: true }) }).count(), { timeout: 20000 }).toBe(1);
          const v = await kit.submittalRowValues(sub.number, sub.description);
          s.observe(`${sub.number}: Material Name "${v['Material Name']}"`);
          expect(v['Supplier Name']).toBe(R.supplier.name);
          expect(v.Source).toBe('Manual');
          expect(norm(v['Material Name']), 'Exactly one material').toBe(norm(M[0].name));
        }, { critical: true });
        await s.step('Open the submittal → Submittal ID stored', async () => {
          await k.openSubmittal(sub.description);
          sub.id = new URL(page.url()).searchParams.get('submittal');
          expect(sub.id).toBeTruthy();
          record('Procurement Log', 'Submittal', sub.id, sub.number, 'Project Admin', `${R.supplier.name} · created with ${M[0].name}`);
        }, { critical: true, evidence: true });
      });

      // ================= TC-09 Secondary material with "+ Add material" =================
      await scenario('secondMaterial', ['submittal'], async s => {
        await s.step(`Open the submittal (component creation drawer) → Materials bar shows ${M[0].name} (primary)`, async () => {
          await drawer();
          const mats = await v2.drawerMaterials();
          s.observe(`Materials: ${mats.join(', ')}`);
          expect(mats.map(norm)).toContain(norm(M[0].name));
          await expect(page.getByText('(primary)').first().locator('xpath=..')).toContainText(M[0].name);
        }, { critical: true, evidence: true });
        await s.step(`Materials bar › "+ Add material" › ${M[1].name} → chip added to the same submittal`, async () => {
          const r = await v2.addMaterialInDrawer(M[1].name);
          s.observe(r.added ? `Before: ${r.before.join(', ')} · after: ${r.after.join(', ')}${r.toast ? ` · ${r.toast}` : ''}` : `${M[1].name} already added by the first attempt`);
          expect(r.after.map(norm)).toEqual(expect.arrayContaining(M.map(m => norm(m.name))));
        }, { critical: true, evidence: true });
        await s.step(`Reopen the submittal from the Procurement Log → same Submittal ID ${sub.id || ''}; materials exactly ${M.map(m => m.name).join(' and ')}; "(primary)" still ${M[0].name}`, async () => {
          await reopenDrawer();
          expect(new URL(page.url()).searchParams.get('submittal'), 'Submittal ID unchanged').toBe(sub.id);
          const mats = await v2.drawerMaterials();
          s.observe(`Materials: ${mats.join(', ')}`);
          expect(mats.map(norm).sort()).toEqual(M.map(m => norm(m.name)).sort());
          await expect(page.getByText('(primary)').first().locator('xpath=..')).toContainText(M[0].name);
        }, { critical: true });
        await s.step(`Procurement Log: search the submittal → still exactly one submittal (no new one); Material Name "${M[0].name} +1"`, async () => {
          await k.openLog(); await k.search(sub.number);
          // The search result can arrive after the count is first read (22 Nov 2026 03:10 run): wait for it.
          await expect.poll(() => k.rows().filter({ has: page.getByRole('cell', { name: sub.number, exact: true }) }).count(), { message: 'One submittal', timeout: 20000 }).toBe(1);
          const v = await kit.submittalRowValues(sub.number, sub.description);
          s.observe(`Material Name "${v['Material Name']}"`);
          expect(v['Material Name']).toContain(M[0].name);
          expect(v['Material Name']).toMatch(/\+1\b/);
        }, { critical: true });
      });

      // ================= TC-10 Components and lead time =================
      await scenario('components', ['secondMaterial'], async s => {
        for (const m of M) {
          await s.step(`Submittal › "Add component": material ${m.name}, Date Req. on Site ${ddmmyyyy(m.roj)}, QTY ${m.qty}, Value ${m.value}, PO ${m.po}, PO Date ${ddmmyyyy(PO_DAY)} → toast "Schedule added successfully!", status "Ordered"`, async () => {
            await drawer();
            if (await k.componentRow(m.name).count()) s.observe('Component already created by the first attempt – not created again');
            else await k.addComponent({ material: m.name, rojDate: m.roj, qty: m.qty, value: m.value, po: m.po, poDate: PO_DAY });
            expect(await k.componentStatus(m.name)).toBe('Ordered');
          }, { critical: true, evidence: true });
        }
        await s.step(`Submittal → exactly ${M.length} components, one per material`, async () => {
          await drawer();
          const rows = k.componentRows();
          expect(await rows.count(), 'Components on the submittal').toBe(M.length);
          for (const m of M) {
            expect(await k.componentRow(m.name).count(), `${m.name} component`).toBe(1);
            record('Procurement Log', 'Component', `${sub.number} / ${m.name}`, `${m.name} × ${m.qty}`, 'Project Admin', `Value ${m.value} · PO ${m.po}`);
          }
        }, { critical: true });
        for (const m of M) {
          // Since the staging release of 23 Nov 2026 the component row shows no "Expected Delivery" date; the expected
          // date (PO Date + lead time) is used as the booking date in TC-10B and checked there as "Next delivery".
          await s.step(`${m.name}: lead time shown by the application → ${m.weeks} week(s) (supplier mapping); expected delivery = PO Date + ${m.weeks} week(s) = ${ddmmyyyy(m.expected)} (booked in TC-10B)`, async () => {
            await drawer();
            const lt = await kit.leadTime(m.name);
            s.observe(`Lead time ${lt.weeks} week(s), "${lt.status}", next delivery "${lt.expected || '—'}", ROJ ${lt.required}`);
            expect(lt.weeks).toBe(String(m.weeks));
          }, { critical: true });
          await s.step(`${m.name}: component "⋯" › "Lead time" › ${m.weeks} week(s), tick confirm, "Submit" → lead time shows exactly "Confirmed" and still ${m.weeks} week(s)`, async () => {
            await drawer();
            if ((await kit.leadTime(m.name)).status !== 'Confirmed') await kit.confirmLeadTime(m.name, m.weeks);
            const lt = await kit.leadTime(m.name);
            s.observe(`Lead time ${lt.weeks} week(s), "${lt.status}"`);
            expect(lt.status).toBe('Confirmed');
            expect(lt.weeks).toBe(String(m.weeks));
          }, { critical: true, evidence: true });
          await s.step(`${m.name}: business rule → Expected Delivery ${ddmmyyyy(m.expected)} on or before Date Required on Site ${ddmmyyyy(m.roj)}; not "At Risk"`, async () => {
            const lt = await kit.leadTime(m.name);
            expect(lt.required).toBe(ddmmyyyy(m.roj));
            expect(m.expected <= m.roj).toBe(true);
            expect(lt.componentStatus).not.toMatch(/Risk/i);
          }, { critical: true });
        }
      });

      // ================= TC-10B Delivery bookings =================
      await scenario('booking', ['components'], async s => {
        for (const m of M) {
          await s.step(`${m.name} › "⋯" › "Open component" › "Log delivery": delivery date ${ddmmyyyy(m.expected)} (confirmed expected date), first location of ${SITE}, item ${m.name}, QTY ${m.qty}, "Add" → the delivery offers "Pre-shipping info"`, async () => {
            await atComponent(m);
            if (await kit.visibleDeliveries().count() || await kit.deliveryRow().count()) { s.observe('Delivery already logged by the first attempt – not logged again'); return; }
            m.delivery = await kit.logDelivery({ material: m.name, qty: m.qty, date: m.expected, tag: `${RUN}-${m.key}` });
          }, { critical: true, evidence: true });
          await s.step(`${m.name}: reopen the component → exactly one booking, dated ${ddmmyyyy(m.expected)}, on the run submittal; the submittal shows it as "Next delivery"`, async () => {
            await reopenDrawer();
            expect((await kit.leadTime(m.name)).expected, 'Next delivery on the component row').toBe(ddmmyyyy(m.expected));
            await reopenComponent(m);
            expect(await kit.visibleDeliveries().count(), 'One booking').toBe(1);
            expect(await kit.deliveryRow().innerText()).toContain(ddmmyyyy(m.expected));
            const body = norm(await page.locator('body').innerText());
            for (const v of [sub.number, R.supplier.name, m.name]) expect(body, `${v} shown with the booking`).toContain(norm(v));
            m.schedule = new URL(page.url()).searchParams.get('schedule');
            m.url = page.url();
            record('Procurement Log', 'Delivery booking', m.schedule, `${m.name} × ${m.qty}`, 'Project Admin', `Delivery ${ddmmyyyy(m.expected)} · ${(m.delivery || {}).location || ''}`);
          }, { critical: true });
        }
      });

      // ================= TC-11 Status filter and Export =================
      await scenario('statusExport', ['submittal'], async s => {
        let filtered; let exported;
        await s.step(`Procurement Log › "Status" › "${FILTER_STATUS}" → every listed row has Status "${FILTER_STATUS}"; item count recorded`, async () => {
          filtered = await v2.statusFilter(FILTER_STATUS);
          s.observe(`${filtered.count} item(s); this page ${filtered.values.length} row(s): ${[...new Set(filtered.values)].join(', ')}`);
          expect(filtered.values.length, 'Rows with this status').toBeGreaterThan(0);
          expect(new Set(filtered.values)).toEqual(new Set([FILTER_STATUS]));
        }, { critical: true, evidence: true });
        await s.step(`"Export" with the "${FILTER_STATUS}" filter → Submittal_Report_<yyyymmdd>.xlsx downloaded`, async () => {
          exported = await v2.exportLog();
          s.observe(`${exported.name}: sheet "${exported.sheet}", ${exported.data.length} data row(s), ${exported.header.length} columns`);
          expect(exported.name).toMatch(/^Submittal_Report_\d{8}\.xlsx$/);
          record('Procurement Log', 'Export', exported.name, `Status ${FILTER_STATUS}`, 'Project Admin', path.relative(outDir, exported.path));
        }, { critical: true });
        await s.step(`Export content → one data row per filtered submittal (Procurement Log item count, all pages), every row status "${FILTER_STATUS}"`, async () => {
          const { header, data } = exported;
          expect(header, 'Status column in the export').toContain('Status');
          const statuses = [...new Set(data.map(r => norm(r.Status).replace(/_/g, ' ')))];
          s.observe(`${data.length} data row(s); Status values ${statuses.join(', ')}; Procurement Log ${filtered.count} item(s)`);
          expect(statuses, `Every exported row is ${FILTER_STATUS}`).toEqual([norm(FILTER_STATUS)]);
          expect(data.length, 'Export rows = filtered item count (all pages)').toBe(filtered.count);
          exported.numbers = data.map(r => r['Submittal No']);
        });
        await s.step(`Filtered list › search the run submittal → listed (it is "${FILTER_STATUS}") and in the export; clear the filter`, async () => {
          await k.search(sub.number);
          const n = await expect.poll(() => k.rows().filter({ has: page.getByRole('cell', { name: sub.number, exact: true }) }).count(), { timeout: 15000 }).toBe(1).then(() => 1, () => 0);
          expect(exported.numbers || [], 'Run submittal in the export').toContain(sub.number);
          s.observe(`${sub.number}: ${n} row(s) in the filtered list`);
          await k.search('');
          await v2.clearStatusFilter(FILTER_STATUS);
          expect(n).toBe(1);
        });
      });

      // ================= TC-12 Assign Responsible =================
      await scenario('assign', ['submittal'], async s => {
        await s.step(`Run submittal › row "⋮" › "Assign Responsible" → "Responsible — <submittal>" › "Add a Responsible person": ${maskEmail(RESPONSIBLE)}, "Add" once → listed as Responsible; "Done"`, async () => {
          R.responsible = await v2.assignResponsible(sub.number, RESPONSIBLE);
          s.observe(`Chosen "${R.responsible.label.replace(/[\w.+-]+@[\w.-]+/, x => maskEmail(x))}"`);
        }, { critical: true, evidence: true });
        await s.step(`Procurement Log: the run submittal → "Responsible" shows the assigned user`, async () => {
          // Since the 23 Nov 2026 (evening) release the cell also holds an "Edit" (or "Assign") button.
          const value = String(await v2.rowValue(sub.number, 'Responsible')).replace(/\s+(Edit|Assign)\s*$/, '');
          s.observe(`Responsible "${value}"`);
          expect(norm(value)).toBe(norm(R.responsible.name));
          record('Procurement Log', 'Responsible user', sub.number, R.responsible.name, 'Project Admin', maskEmail(RESPONSIBLE));
        }, { critical: true });
      });

      // ================= TC-13 Bulk Edit =================
      // Uses two EARLIER run submittals (owned test data); the run submittal keeps its Spec Description, which opens it.
      // Application flow (seen 12 Nov 2026): Preview Changes › "Confirm & Apply" applies the values and puts the batch in
      // review – banner "Bulk Update #N — reviewing changes … disabled until you Confirm or Roll Back" – then "Confirm"
      // keeps it (toast "Bulk update confirmed.") and "Roll Back" restores the previous values.
      await scenario('bulk', ['login'], async s => {
        const B = R.bulk = R.bulk || {};
        await s.step('Procurement Log → no bulk update is waiting for review (a pending review blocks search and filters)', async () => {
          const pending = await v2.pendingBulk();
          if (pending && !(B.review1 && pending.includes(`#${B.review1}`))) throw new Error(`A bulk update is already waiting for review, not started by this run: "${pending}"`);
        }, { critical: true });
        await s.step(`Procurement Log: search "${BULK_SEARCH}" → two earlier run submittals chosen (not this run's)`, async () => {
          if (!B.numbers) {
            const numbers = await v2.submittalNumbers(BULK_SEARCH);
            B.numbers = numbers.filter(n => /^E2E\d{10}-SUB$|^submittal \d+ \d{8}$/i.test(n) && n !== sub.number).slice(0, 2);
          }
          s.observe(B.numbers.join(', '));
          expect(B.numbers.length, 'Two eligible earlier run submittals').toBe(2);
          if (!B.before) { B.before = {}; for (const n of B.numbers) B.before[n] = await v2.rowValue(n, 'Spec Description'); }
        }, { critical: true });
        await s.step('Bulk Edit Log → batches counted (baseline)', async () => {
          const { entries } = await v2.bulkLog();
          if (B.logBefore == null) B.logBefore = entries.length;
          s.observe(`${entries.length} batch(es); latest "${entries[0] || '-'}"`);
          await page.keyboard.press('Escape');
        });
        await s.step('Tick both rows › "Select Columns for Bulk Edit" › "Spec Description" › "Next" › value "Spec description Update at <date time>" › "Preview Changes" → preview lists both records and the new value', async () => {
          if (!B.value) B.value = `Spec description Update at ${new Date().toLocaleString('en-GB')}`;
          if (B.applied1) { s.observe('Already applied by the first attempt'); return; }
          const p = await v2.bulkPreview(BULK_SEARCH, B.numbers, B.value);
          s.observe(p.text.slice(0, 300));
          expect(p.text).toMatch(/This will update 2 records/);
          expect(p.text).toContain(B.value);
          for (const n of B.numbers) expect(p.text).toContain(n);
        }, { critical: true, evidence: true });
        await s.step('Preview › "Confirm & Apply" (once) → banner "Bulk Update #N — reviewing changes", 2 applied', async () => {
          if (!B.applied1) {
            B.applied1 = true; // never clicked twice
            await v2.confirmAndApply();
          }
          const pending = await v2.pendingBulk();
          s.observe(pending || 'no review banner');
          expect(pending, 'Review banner').toMatch(/reviewing changes/);
          expect(pending).toMatch(/2 applied/);
          B.review1 = (pending.match(/#(\d+)/) || [])[1];
        }, { critical: true, evidence: true });
        await s.step('Banner › "Confirm" (once) → toast "Bulk update confirmed."; banner gone', async () => {
          if (!B.confirmed1) {
            B.confirmed1 = true;
            const message = await v2.resolveBulk('Confirm');
            s.observe(message || 'no toast');
            expect(message).toMatch(/Bulk update confirmed/i);
          }
          expect(await v2.pendingBulk(), 'No review banner').toBeNull();
        }, { critical: true, evidence: true });
        await s.step('Both submittals → Spec Description equals the confirmed value', async () => {
          for (const n of B.numbers) {
            const v = await v2.rowValue(n, 'Spec Description');
            s.observe(`${n}: "${v}" (was "${B.before[n]}")`);
            expect(v).toBe(B.value);
          }
          record('Procurement Log', 'Bulk edit (Spec Description, confirmed)', `#${B.review1} · ${B.numbers.join(', ')}`, B.value, 'Project Admin', `Was: ${B.numbers.map(n => B.before[n]).join(' | ')}`);
        }, { critical: true });
        await s.step('Bulk Edit Log → the confirmed "Spec Description" batch is listed', async () => {
          const { entries } = await v2.bulkLog();
          s.observe(`${entries.length} batch(es); latest "${entries[0]}"`);
          await page.keyboard.press('Escape');
          expect(entries.some(e => e.includes(`#${B.review1}`) && /Spec Description/.test(e)), `Bulk Update #${B.review1} listed`).toBe(true);
        });
        // Rollback validation: a second edit is applied for review and then rolled back.
        await s.step('Second bulk edit: same rows › Spec Description › another timestamped value › "Preview Changes" → preview shows the new value', async () => {
          if (!B.value2) B.value2 = `Spec description Update at ${new Date().toLocaleString('en-GB')} (rolled back)`;
          if (B.applied2) { s.observe('Already applied by the first attempt'); return; }
          const p = await v2.bulkPreview(BULK_SEARCH, B.numbers, B.value2);
          expect(p.text).toContain(B.value2);
        }, { critical: true, evidence: true });
        await s.step('Preview › "Confirm & Apply" (once) → second batch waiting for review; rows show the pending value', async () => {
          if (!B.applied2) { B.applied2 = true; await v2.confirmAndApply(); }
          const pending = await v2.pendingBulk();
          s.observe(pending || 'no review banner');
          expect(pending, 'Review banner').toMatch(/reviewing changes/);
          B.review2 = (pending.match(/#(\d+)/) || [])[1];
          expect(B.review2, 'A new batch number').not.toBe(B.review1);
        }, { critical: true, evidence: true });
        await s.step('Banner › "Roll Back" (once) → banner gone; the pending update is discarded', async () => {
          if (!B.rolledBack) {
            B.rolledBack = true;
            const message = await v2.resolveBulk('Roll Back');
            s.observe(message || 'no toast');
          }
          expect(await v2.pendingBulk(), 'No review banner').toBeNull();
        }, { critical: true, evidence: true });
        await s.step('Both submittals → Spec Description back to the confirmed value (second update not committed)', async () => {
          for (const n of B.numbers) {
            const v = await v2.rowValue(n, 'Spec Description');
            s.observe(`${n}: "${v}"`);
            expect(v).toBe(B.value);
          }
          const { entries } = await v2.bulkLog();
          s.observe(`Bulk Edit Log latest: "${entries[0]}"`);
          await page.keyboard.press('Escape');
          record('Procurement Log', 'Bulk edit (rolled back)', `#${B.review2}`, B.value2, 'Project Admin', 'Rolled back from review; values restored');
        }, { critical: true, evidence: true });
      });
      // Safety net: a review left open by a failed TC-13 step blocks Procurement Log search for the rest of the run. Only
      // a batch THIS run applied is rolled back here (never another session's).
      if (R.bulk?.applied1 || R.bulk?.applied2) {
        const pending = await v2.pendingBulk().catch(() => null);
        const ours = pending && [R.bulk.review1, R.bulk.review2].filter(Boolean).some(n => pending.includes(`#${n}`));
        if (ours) { console.log(`  ⚠ ${pending.slice(0, 60)} left in review by TC-13 – rolled back`); await v2.resolveBulk('Roll Back').catch(e => console.log(`  roll back failed: ${e.message.split('\n')[0]}`)); }
      }

      // ================= TC-14 Procurement alert =================
      await scenario('alert', ['submittal'], async s => {
        const A = R.alert = R.alert || { message: `Alert for ${sub.number}: total count at or above ${ALERT_VALUE}` };
        // 27 Nov 2026 (issue justification): the alert field is a numeric custom field created in Procurement Log
        // Configuration › "+ Add Log Fields"; one "Alert Count <run>" field is created once and reused by later runs.
        await s.step('Project Management › Procurement Log Configuration › "+ Add Log Fields": an "Alert Count" custom field of a numeric type exists (created now when missing) → listed as "(Custom)"', async () => {
          if (A.field) return;
          const f = await v2.ensureAlertField(D);
          A.field = f.name;
          s.observe(f.created ? `Created "${f.name}" (type ${f.type}; types offered: ${f.types.join(', ')})` : `Reused existing custom field "${f.name}"`);
          record('Procurement Log', 'Custom field (alert)', f.name, f.created ? f.type : 'reused', 'Project Admin', f.created ? 'Created for the alert' : 'Existing field reused');
        }, { critical: true, evidence: true });
        await s.step(`Run submittal › row "⋮" › "Alert" › "Add Alert": field (the "Alert Count" custom field), condition "${ALERT_CONDITION}", value ${ALERT_VALUE}, message, recipient ${R.responsible?.name || '(none chosen)'}, "Submit" once → toast "Alert created successfully!"`, async () => {
          const r = await v2.createAlert({ number: sub.number, field: process.env.SCP_E2E_ALERT_FIELD || A.field, condition: ALERT_CONDITION, value: ALERT_VALUE, message: A.message, user: R.responsible?.name });
          if (!r.created) { s.observe('Alert already created by the first attempt'); return; }
          Object.assign(A, r);
          s.observe(`Field "${r.field}" (offered: ${r.fields.join(', ')}); recipient ${r.user || 'none'}`);
        }, { critical: true, evidence: true });
        await s.step('Alert list of the submittal → the rule shows its field, condition, value, message, user and status', async () => {
          const row = await v2.alertRow(A.message);
          await expect(row).toBeVisible({ timeout: 15000 });
          A.row = (await row.innerText()).replace(/\s+/g, ' ').trim();
          s.observe(A.row);
          expect(A.row).toContain(ALERT_CONDITION);
          expect(A.row).toContain(ALERT_VALUE);
          // The alert list shows the recipient by e-mail (the picker shows the display name): either identifies the user.
          if (R.responsible?.name) {
            const ids = [R.responsible.name, R.responsible.email, RESPONSIBLE].filter(Boolean).map(x => norm(x));
            expect(ids.some(id => norm(A.row).includes(id)), `Recipient (${R.responsible.name} / ${maskEmail(RESPONSIBLE)}) in the alert row`).toBe(true);
          }
          A.status = (A.row.match(/\b(Created|Sent|Triggered|Active)\b/i) || [])[1] || '';
          record('Procurement Log', 'Alert rule', sub.number, A.message, 'Project Admin', A.row.slice(0, 160));
        }, { critical: true });
        // Agreed 12 Nov 2026: the alert field is a custom field without a value on the run submittal, so "${ALERT_CONDITION} ${ALERT_VALUE}"
        // is not met - the rule is created but not sent.
        await s.step(`Alert condition "${ALERT_CONDITION} ${ALERT_VALUE}" not met by the run submittal (custom field) → rule stays "Created", not sent`, async () => {
          await page.keyboard.press('Escape');
          s.observe(`Alert status "${A.status || 'unknown'}"`);
          expect(A.status, 'Alert rule status').toMatch(/Created|Active/i);
        });
      });

      // ================= TC-14B / TC-14C Enterprise and International Shipments (added 23 Nov 2026) =================
      // Supplier Inbox: a section is collapsed (▼) and shows counts; filter by the run submittal, expand, read the rows.
      const entMain = page.getByRole('main');
      const flatText = async () => (await entMain.innerText()).replace(/\s+/g, ' ');
      const inboxFor = async (number, section) => {
        await k.menu('Supplier Inbox', 'Enterprise').catch(() => null);
        if (!/\/supplier-inbox/.test(page.url())) await page.goto('/supplier-inbox', { waitUntil: 'domcontentloaded' });
        await k.settle(2500);
        await expect.poll(async () => /\d+ SUBMITTALS/i.test(await flatText()), { timeout: 30000 }).toBe(true);
        const box = entMain.getByPlaceholder(/SUB-/i).first();
        await box.fill(number); await box.press('Enter').catch(() => {}); await k.settle(3500);
        const txt = await flatText();
        const count = Number((txt.match(new RegExp(`${section} .*?(\\d+) SUBMITTALS`, 'i')) || [])[1] || 0);
        const head = entMain.getByText(new RegExp(`^${section}$`, 'i')).first();
        let open = txt;
        for (let i = 0; i < 2 && count && !open.slice(open.indexOf(section), open.indexOf(section) + 1500).includes(number); i++) { await head.click().catch(() => {}); await k.settle(2000); open = await flatText(); }
        const at = open.indexOf(section); const part = open.slice(at, at + 1500);
        return { count, listed: part.includes(number), part: part.slice(0, 400) };
      };
      // 24 Nov 2026: Supplier Inbox was removed (/supplier-inbox opens My Work) – skipped until client question 3 is answered.
      if (!process.env.SCP_SUPPLIER_INBOX) { records.entInbox = { ...S.entInbox, status: 'Skipped', reason: 'Skipped (25 Nov 2026): Supplier Inbox removed – /supplier-inbox opens My Work; awaiting client question 3', steps: [], startedAt: new Date().toISOString(), durationMs: 0 }; run.result.scenarios.push(records.entInbox); flush(); } else
      await scenario('entInbox', ['booking'], async s => {
        await s.step(`Enterprise › Supplier Inbox: Submittal filter "${sub.number}" → the run delivery (booked, checklist not yet filled) is listed under "Pending Pre-Shipping Checklists"`, async () => {
          const r = await inboxFor(sub.number, 'Pending Pre-Shipping Checklists');
          s.observe(`Pending Pre-Shipping Checklists: ${r.count} submittal(s); listed: ${r.listed} · ${r.part.slice(0, 300)}`);
          expect(r.count, 'Pending Pre-Shipping Checklists has no submittal for the run').toBeGreaterThan(0);
          expect(r.listed, `Run submittal ${sub.number} not inside Pending Pre-Shipping Checklists`).toBe(true);
          R.inboxPending = r.count;
        }, { evidence: true });
      });
      // Enterprise Shipments › "+ Log Shipment" for the run submittal; the International Shipments list can need ~200 s to load.
      const fieldAfter = async (scope, label, value) => {
        const el = scope.getByText(new RegExp(`^${esc(label)}\\s*\\*?$`)).first().locator('xpath=following::*[self::input or self::textarea][1]');
        await el.fill(String(value));
      };
      await scenario('shipment', ['submittal'], async s => {
        await s.step(`Enterprise › Enterprise Shipments › "+ Log Shipment": Project ${config.projectName}, Submittal ${sub.number}, Manufacturer "Mfr ${RUN}", country "South Korea", Container # "C${RUN}", ports Busan → Chennai, "Log shipment" → toast "Shipment logged."`, async () => {
          await k.menu('Enterprise Shipments', 'Enterprise').catch(() => null);
          if (!/\/enterprise-shipments/.test(page.url())) await page.goto('/enterprise-shipments', { waitUntil: 'domcontentloaded' });
          await k.settle(2500);
          await entMain.getByRole('button', { name: /Log Shipment/i }).first().click(); await k.settle(800);
          const dlg = page.locator('div.shadow-xl').filter({ has: page.getByRole('button', { name: 'Log shipment', exact: true }) }).last();
          const sels = dlg.locator('select');
          await sels.nth(0).selectOption({ label: (await sels.nth(0).locator('option').allInnerTexts()).find(t => t.includes(config.projectName)) });
          await expect.poll(async () => sels.nth(1).locator('option').count(), { timeout: 60000 }).toBeGreaterThan(1);
          const opt = (await sels.nth(1).locator('option').allInnerTexts()).find(t => t.startsWith(sub.number));
          expect(opt, `Run submittal ${sub.number} not offered in Log Shipment`).toBeTruthy();
          await sels.nth(1).selectOption({ label: opt });
          await fieldAfter(dlg, 'Manufacturer name', `Mfr ${RUN}`);
          await fieldAfter(dlg, 'Manufacturer country', 'South Korea');
          await fieldAfter(dlg, 'Container #', `C${RUN}`);
          await fieldAfter(dlg, 'Port of origin', 'Busan'); await fieldAfter(dlg, 'Port of destination', 'Chennai');
          await page.getByRole('button', { name: 'Log shipment', exact: true }).click();
          await expect(page.getByRole('status').filter({ hasText: 'Shipment logged.' }).first()).toBeVisible({ timeout: 15000 });
          record('International Shipments', 'Shipment', sub.number, `Container C${RUN}`, 'Project Admin', 'Busan to Chennai');
        }, { critical: true, evidence: true });
        await s.step(`Enterprise Shipments: search "${sub.number}" → a row for the run submittal is listed`, async () => {
          await page.goto('/enterprise-shipments', { waitUntil: 'domcontentloaded' }); await k.settle(2500);
          await entMain.getByPlaceholder(/^Search submittal/).fill(sub.number); await k.settle(2000);
          const row = entMain.locator('tbody tr').filter({ hasText: sub.number }).first();
          await expect(row).toBeVisible({ timeout: 30000 });
          s.observe((await row.innerText()).replace(/\s+/g, ' ').slice(0, 200));
        });
        await s.step(`International Shipments (the list can need ~200 s): the run submittal ${sub.number} is listed`, async () => {
          const started = Date.now();
          await page.goto('/international-shipments', { waitUntil: 'domcontentloaded' });
          await expect(page.getByText('Total International').first()).toBeVisible({ timeout: 360000 });
          await expect.poll(async () => (await flatText()).includes(sub.number), { timeout: 60000 }).toBe(true);
          s.observe(`Listed after ${Math.round((Date.now() - started) / 1000)} s`);
        });
      });

      // ================= TC-15 Supplier approval =================
      await scenario('supplierApproval', ['booking'], async s => {
        await logoutAs(s, PA);
        await loginAs(s, SUP, 'Supplier');
        for (const m of M) {
          await s.step(`Supplier: Procurement Log › ${sub.number} › ${m.name} → its booking is listed`, () => atComponent(m), { critical: true });
          await s.step(`Supplier: ${m.name} booking › "Delivery actions" › "Pre-shipping info": comment and YES for every question, supplier note, "Confirm Checklist" → toast "Shipping Details updated successfully!"`, async () => {
            if ((await kit.deliveryIcons()).includes('Approve pre-shipping checklist')) { s.observe('Checklist already confirmed by the first attempt'); return; }
            const r = await kit.fillChecklist(`${RUN}-${m.key}`);
            s.observe(`${r.answered} questions answered, ${r.comments} comments`);
          }, { critical: true, evidence: true });
          await s.step(`Supplier: ${m.name} booking status (component reopened) → waiting for subcontractor approval`, async () => {
            await reopenComponent(m);
            m.iconsAfterSupplier = await kit.deliveryIcons();
            s.observe(`Actions: ${m.iconsAfterSupplier.join(', ')}`);
            expect(m.iconsAfterSupplier).toContain('Approve pre-shipping checklist');
          }, { critical: true });
        }
      });

      // ================= TC-16 Subcontractor approval =================
      await scenario('subconApproval', ['supplierApproval', 'user'], async s => {
        await logoutAs(s, SUP);
        let activated = false;
        if (subconLogin === 'invite') {
          // STEP: activate the invited user from its mailbox (mail.tm API since 22 Nov 2026; no human check). Fallback: when
          // the invitation cannot be read or the activation fails, the existing Subcontractor account approves instead.
          await s.step(`Pause ${LOGIN_PAUSE / 1000} s; mailbox ${maskEmail(R.newUser.email)} (read through the mail.tm API) › "Accept Invite" → set password → profile "${R.newUser.displayName}" → signed in (no organisation setup); if YOPmail cannot be read, the existing Subcontractor account is used instead`, async () => {
            await pause();
            try {
              await transition('Login (invite activation)', NEW, () => kit.activateInvite(R.newUser, t => s.observe(t)));
              activated = true;
            } catch (error) {
              if (!EXISTING_SUBCON.email || !EXISTING_SUBCON.password) throw error; // no fallback account configured
              const reason = String(error.message || error).split('\n')[0].slice(0, 200);
              s.observe(`FALLBACK: invite activation failed (${reason}); the existing Subcontractor account (${maskEmail(EXISTING_SUBCON.email)}) approves instead`);
              subconLogin = 'existing';
              SUBCON = EXISTING_SUBCON;
              await kit.signOut().catch(() => null);
            }
          }, { critical: true, evidence: true, attempts: 1 });
        }
        if (activated) {
          await s.step('Log out after activation → login page (the account then uses the standard login)', () => transition('Logout', NEW, () => kit.signOut()), { critical: true });
          await loginAs(s, NEW, 'Subcontractor', R.newUser.organization);
        } else {
          await loginAs(s, SUBCON, 'Subcontractor', USER_ORG);
        }
        for (const m of M) {
          await s.step(`Subcontractor: Procurement Log › ${sub.number} › ${m.name} → its booking awaits approval`, async () => {
            await atComponent(m);
            expect(await kit.deliveryIcons()).toEqual(expect.arrayContaining(['Approve pre-shipping checklist']));
          }, { critical: true });
          await s.step(`Subcontractor: ${m.name} booking › "Delivery actions" › "Approve pre-shipping checklist": comment, "Approve" → toast "Checklist Generated Successfully!"`, () => kit.approveChecklist(`${RUN}-${m.key}`), { critical: true, evidence: true });
          await s.step(`Subcontractor: ${m.name} booking status (component reopened) → "Pre-shipping checklist (approved)"`, async () => {
            await reopenComponent(m);
            m.iconsAfterSubcontractor = await kit.deliveryIcons();
            s.observe(`Actions: ${m.iconsAfterSubcontractor.join(', ')}`);
            expect(m.iconsAfterSubcontractor).toContain('Pre-shipping checklist (approved)');
            expect(m.iconsAfterSubcontractor).not.toContain('Approve pre-shipping checklist');
          }, { critical: true });
        }
      });

      // ================= TC-17 Delivery completion =================
      await scenario('delivery', ['subconApproval'], async s => {
        await logoutAs(s, SUBCON);
        await loginAs(s, PA, 'Admin');
        for (const m of M) {
          await s.step(`${m.name}: lead time reconfirmed → "Confirmed"; next delivery ${ddmmyyyy(m.expected)}`, async () => {
            await drawer();
            const lt = await kit.leadTime(m.name);
            expect(lt.status).toBe('Confirmed');
            expect(lt.expected).toBe(ddmmyyyy(m.expected));
          }, { critical: true });
          await s.step(`${m.name}: booking › supplier and subcontractor approvals done ("Pre-shipping checklist (approved)", no pending checklist action); component not "Received" before its Actual Delivery Date is entered`, async () => {
            await drawer();
            m.statusBeforeActual = await k.componentStatus(m.name);
            s.observe(`Component status before the Actual Delivery Date: "${m.statusBeforeActual}"`);
            expect(m.statusBeforeActual, 'Not Received while the Actual Delivery Date is empty').not.toBe('Received');
            await atComponent(m);
            const icons = await kit.deliveryIcons();
            s.observe(`Actions: ${icons.join(', ')}`);
            expect(icons).toContain('Pre-shipping checklist (approved)');
            expect(icons).not.toContain('Approve pre-shipping checklist');
          }, { critical: true });
          await s.step(`${m.name}: booking › "Receive" › Actual Date Of Delivery ${TODAY}, "Update" → the delivery moves to "Received" with a receipt number`, async () => { m.receipt = (await kit.setActualDate(today)).receipt; s.observe(`Receipt ${m.receipt}`); }, { critical: true });
          await s.step(`${m.name}: received delivery › "Delivery actions" › "Update shipping info": mode "Other", reference, origin, note → toast "Shipping Details updated successfully!"`, () => kit.shippingInfo(`${RUN}-${m.key}`), { critical: true, evidence: true });
          let shortage;
          await s.step(`${m.name}: received delivery › "Delivery actions" › "Update delivery condition": Goods ${m.qty}, Damage 0 → toast "Delivery Conditions updated successfully!"`, async () => {
            await atComponent(m);
            ({ shortage } = await kit.deliveryConditions({ good: m.qty, damage: 0 }));
            m.shortage = shortage;
            s.observe(`Goods ${m.qty}, Damage 0, Shortage shown ${shortage}`);
          }, { critical: true, evidence: true });
          await s.step(`${m.name}: Shortage for the complete delivery → 0`, async () => {
            if (shortage !== 0) throw new Error(`Shortage QTY was calculated from the component quantity (${shortage} instead of 0)`);
          });
        }
      });

      // ================= TC-17B GRN =================
      await scenario('grn', ['delivery'], async s => {
        for (const m of M) {
          await s.step(`${m.name}: received delivery › "Delivery actions" › "Generate GRN" → toast "GRN Generated Successfully!"; GRN PDF captured`, async () => {
            await atComponent(m);
            if (!(await kit.deliveryIcons()).includes('Generate GRN')) throw new Error('"Generate GRN" is not offered on the booking');
            if (m.grnRequested) { s.observe('GRN already requested by the first attempt – not generated again'); return; }
            m.grnRequested = true;
            m.grn = await kit.generateGrn(`${RUN}-${m.key}`);
            s.observe(`${m.grn.note}${m.grn.name ? ` · ${m.grn.name}` : ''}`);
          }, { critical: true, evidence: true });
          await s.step(`${m.name}: GRN PDF (submittal › Files › GRN entry of the receipt › Download) → "GOODS RECEIVED NOTE" with a Receipt No., PO ${m.po}, shipping ${RUN}-${m.key}-SHIP, supplier ID, received ${TODAY}, item ${m.name} × ${m.qty}`, async () => {
            if (!m.grn?.file) { await atComponent(m); m.grn = { ...(m.grn || {}), ...(await kit.downloadGrn(`${RUN}-${m.key}`)) }; }
            const g = m.grn;
            s.observe(`${g.name}: Receipt ${g.receipt} · PO ${g.po} · shipping ${g.shipping} · supplier ${g.supplier} · received ${g.received}`);
            expect(g.title, 'Goods Received Note').toMatch(/GOODS RECEIVED NOTE/i);
            expect(g.receipt, 'Receipt No.').toMatch(/^RCV-\d+$/);
            expect(g.po).toBe(m.po);
            expect(g.shipping).toBe(`${RUN}-${m.key}-SHIP`);
            expect(g.supplier).toBe(R.supplier.id);
            expect(g.received).toBe(TODAY);
            const item = g.lines.findIndex(l => norm(l).endsWith(norm(m.name)) || norm(l) === norm(m.name));
            expect(item, `GRN item line for ${m.name}`).toBeGreaterThanOrEqual(0);
            expect(g.lines.slice(item, item + 3).join(' '), 'GRN item quantity').toMatch(new RegExp(`(^|\\s)${m.qty}(\\.0+)?\\s`));
            record('Procurement Log', 'GRN', g.receipt, `${g.name} · ${m.name} × ${m.qty}`, 'Project Admin', `${sub.number} · booking ${m.schedule} · ${path.relative(outDir, g.file)}`);
          }, { evidence: true });
          await s.step(`${m.name}: component view → received in good order ${m.qty}, nothing remaining, Value delivered recorded; component status "Received"`, async () => {
            await atComponent(m); // the GRN download ends on the submittal page (Files section)
            const c = await kit.componentSummary();
            s.observe(JSON.stringify(c));
            expect(c['QTY Received']).toMatch(new RegExp(`^${m.qty}\\b`));
            expect(c['Remaining QTY To Be Delivered']).toMatch(/^0\b/);
            m.valueDelivered = { text: c['Value Delivered'], amount: Number((c['Value Delivered'] || '').replace(/[^\d.]/g, '')), currency: (c['Value Delivered'] || '').replace(/[\d.,\s]/g, '') };
            await drawer();
            await expect.poll(() => k.componentStatus(m.name), { timeout: 30000 }).toBe('Received');
          }, { evidence: true });
        }
        // Business rule (confirmed 12 Nov 2026): "Delivered" only once the required actual date is entered on the booking.
        // The grid column "Actual Delivery Date" is recorded for information only (not a defect, not a known-defect tag).
        await s.step(`Procurement Log: the run submittal → Status "Delivered" only after the Actual Delivery Date ${TODAY} was entered on every booking (before: ${M.map(m => m.statusBeforeActual || '?').join(' / ')})`, async () => {
          const v = await kit.submittalRowValues(sub.number, sub.description);
          R.submittal.finalStatus = v.Status; R.submittal.actualDeliveryDate = v['Actual Delivery Date'];
          s.observe(`Before the actual date: ${M.map(m => `${m.name} "${m.statusBeforeActual}"`).join(', ')} · after: submittal "${v.Status}" · grid column Actual Delivery Date "${v['Actual Delivery Date']}" (information only)`);
          for (const m of M) expect(m.statusBeforeActual, `${m.name} not Received before its actual date`).not.toBe('Received');
          expect(v.Status).toBe('Delivered');
        });
        await s.step(`User Management: ${maskEmail(R.newUser.email)} → ${subconLogin === 'invite' ? '"Active"' : 'listed (invite not accepted: existing Subcontractor account used)'}, role Subcontractor, organisation ${R.newUser.organization}`, async () => {
          const row = await kit.invitedListed(R.newUser.email, 120000);
          s.observe(row.replace(/[\w.+-]+@[\w.-]+/g, x => maskEmail(x)));
          expect(row).toMatch(/Subcontractor/);
          // A pending invite row reads "Invited - <email> - <role>" with no organisation (20 Nov 2026).
          if (subconLogin === 'invite') { expect(row).toMatch(/Active/); expect(row).toContain(R.newUser.organization); }
          else expect(row).toMatch(/Invited/);
        });
      });

      // ================= TC-18 Inspector =================
      // Runs after the new user accepted the invite (TC-16): an invited user is not offered as a project member before.
      await scenario('inspector', ['material', 'user', 'subconApproval'], async s => {
        const inspector = subconLogin === 'invite'
          ? { email: R.newUser.email, label: `the new user, organisation ${R.newUser.organization}`, name: R.newUser.displayName }
          : { email: SUBCON.email, label: `the existing Subcontractor account, organisation ${USER_ORG}`, name: 'Existing Subcontractor' };
        await s.step(`FDI Config › "Add Inspector": project member ${maskEmail(inspector.email)} (${inspector.label}), role "${INSPECTOR_ROLE}" if offered, scope "Specific Materials" = ${M[0].name} → inspector row listed`, async () => {
          const r = await v2.addInspector({ email: inspector.email, role: INSPECTOR_ROLE, material: M[0].name });
          s.observe(r.created ? `${r.member} as ${r.role}: ${r.row}` : `Already listed: ${r.row}`);
          if (r.created) record('FDI Configuration', 'Inspector mapping', '', `${inspector.name} → ${M[0].name}`, 'Project Admin', `Role ${r.role}`);
        }, { critical: true, evidence: true });
        await s.step(`Inspectors table → ${maskEmail(inspector.email)} covers ${M[0].name} (scoped to it, or "All Materials"${subconLogin === 'invite' ? '' : ' for the existing account'}); status recorded`, async () => {
          const row = await v2.inspectorRow(inspector.email).innerText();
          s.observe(row.replace(/\s+/g, ' '));
          // A new user is added scoped to the run material. The existing account was already an inspector for
          // "All Materials" (20 Nov 2026), so "Add Inspector" leaves it unchanged.
          if (subconLogin === 'invite') expect(row).toContain(M[0].name);
          else expect(row.includes(M[0].name) || /All Materials/i.test(row), `${M[0].name} or All Materials`).toBe(true);
        }, { critical: true });
        await s.step(`Project Admin ${maskEmail(PA.email)} → an enabled inspector covering ${M[0].name} (performs the inspection in TC-21)`, async () => {
          const row = (await v2.inspectorRow(PA.email).innerText()).replace(/\s+/g, ' ');
          s.observe(row);
          expect(row).toMatch(/Enabled/);
          expect(row).toMatch(new RegExp(`All Materials|${esc(M[0].name)}`));
        });
      });

      // ================= TC-20 FDI record of the run delivery =================
      await scenario('fdiRecord', ['grn', 'fdiSet'], async s => {
        await s.step(`First Delivery Inspections → a record for ${M[0].name} / ${R.supplier.name} / ${sub.number} is generated (first delivery of the new material)`, async () => {
          await v2.openFdiList();
          const row = await v2.fdi.waitForGeneratedRecord({ material: M[0].name, supplier: R.supplier.name, submittal: sub.number }, 180000);
          R.fdi.record = await v2.fdi.rowData(row);
          s.observe(JSON.stringify(R.fdi.record));
          record('First Delivery Inspections', 'FDI record', sub.number, M[0].name, 'Project Admin', `Status ${R.fdi.record.status}`);
        }, { critical: true, evidence: true });
        await s.step(`FDI record → material, supplier, submittal and delivery date ${TODAY} match the run; status "Auditor Not Yet Assigned" (or already assigned/completed by the first attempt)`, async () => {
          const r = R.fdi.record;
          expect(norm(r.material).startsWith(norm(M[0].name)), `material cell "${r.material}" starts with ${M[0].name} (since 24 Nov the cell also shows the FDI question set)`).toBe(true); expect(norm(r.supplier)).toBe(norm(R.supplier.name)); expect(norm(r.submittal)).toBe(norm(sub.number));
          expect(r.deliveryDate).toBe(TODAY);
          expect(r.status).toMatch(/Auditor Not Yet Assigned|Awaiting Inspection Completion|Inspection Completed/i);
        }, { critical: true });
        await s.step(`Second material ${M[1].name} (not its first delivery) → no FDI record for the run submittal`, async () => {
          const rows = await v2.fdi.rows().filter({ hasText: M[1].name }).filter({ hasText: sub.number }).count();
          s.observe(`${rows} record(s)`);
          expect(rows).toBe(0);
        }, { optional: true });
      });

      // ================= TC-21 FDI inspection =================
      await scenario('fdiInspect', ['fdiRecord'], async s => {
        const F = R.fdi;
        const fdiRow = async () => { await v2.openFdiList(); await v2.fdiFilter({ material: M[0].name }); const row = v2.fdiRow(sub.number); await expect(row).toBeVisible({ timeout: 20000 }); return row; };
        await s.step(`FDI record › "Self Assign" (Project Admin, enabled inspector for all materials) → status "Awaiting Inspection Completion", assigned to ${maskEmail(PA.email)}`, async () => {
          const row = await fdiRow();
          const data = await v2.fdi.rowData(row);
          if (/Inspection Completed/i.test(data.status) || data.assignedTo.toLowerCase().includes(PA.email.toLowerCase())) { s.observe(`Already ${data.status} / ${data.assignedTo}`); return; }
          await v2.fdi.selfAssign(row, PA.email);
        }, { critical: true, evidence: true });
        await s.step(`"Fill Inspection Report" → questionnaire shows the run questions (${F.questions?.length || 0}) of ${F.set}; every response filled; photo added when uploads are enabled; "Save Progress"`, async () => {
          const row = await fdiRow();
          if (/Inspection Completed/i.test((await v2.fdi.rowData(row)).status)) { F.done = true; s.observe('Already submitted by the first attempt'); return; }
          await v2.fdi.openReport(row);
          // The questionnaire loads after the page (spinner; "No inspection questions configured…" shows meanwhile): wait for it.
          const missing = async () => { const t = await page.locator('main').innerText().catch(() => ''); return (F.questions || []).filter(q => !t.includes(q)); };
          await expect.poll(missing, { timeout: 45000, intervals: [1000], message: 'Run questions in the inspection report' }).toEqual([]);
          F.answers = await v2.fdi.fillReport(RUN);
          const add = page.getByRole('button', { name: 'Add photo', exact: true });
          if (await add.isVisible().catch(() => false)) { const shot = path.join(outDir, 'fdi-evidence.png'); await page.screenshot({ path: shot }); await v2.fdi.uploadPhoto(shot); F.photo = true; }
          await v2.fdi.saveProgress();
          s.observe(`${F.answers.length} response(s) filled${F.photo ? ', 1 photo' : ''}`);
        }, { critical: true, evidence: true });
        await s.step('Saved values → every response field keeps the entered value', async () => {
          if (F.done) return;
          const values = await (await v2.fdi.reportQuestions()).evaluateAll(els => els.map(e => e.value));
          expect(values).toEqual(F.answers);
        }, { critical: true });
        await s.step('"Inspection outcome": product matches "Yes", quantity damaged 0, a completed status; "Submit Inspection" (once) → status "inspection completed"', async () => {
          if (F.done) return;
          F.done = true;
          await v2.fdi.submit();
          if (v2.fdi.lastOutcome) s.observe(`Inspection outcome: match "${v2.fdi.lastOutcome.match?.value}" (options ${(v2.fdi.lastOutcome.match?.options || []).join(' / ')}), status "${v2.fdi.lastOutcome.status?.value}" (options ${(v2.fdi.lastOutcome.status?.options || []).join(' / ')})`);
        }, { critical: true, evidence: true });
        await s.step(`FDI list → the run record shows "Inspection Completed", inspector ${maskEmail(PA.email)}`, async () => {
          const data = await v2.fdi.rowData(await fdiRow());
          s.observe(`${data.status} · ${maskEmail(data.assignedTo)}`);
          expect(data.status).toMatch(/Inspection Completed/i);
          expect(data.assignedTo.toLowerCase()).toContain(PA.email.toLowerCase());
          record('First Delivery Inspections', 'FDI inspection', sub.number, `${M[0].name} – completed`, 'Project Admin', `${(F.answers || []).length} responses`);
        }, { critical: true });
      });

      // ================= TC-22 FDI filter and view =================
      await scenario('fdiView', ['fdiInspect'], async s => {
        const F = R.fdi;
        await s.step(`First Delivery Inspections › filters Material "${M[0].name}" and Status "Inspection Completed" → the run record is listed and every row matches the filter`, async () => {
          await v2.openFdiList();
          await v2.fdiFilter({ material: M[0].name, status: 'Inspection Completed' });
          await expect(v2.fdiRow(sub.number)).toBeVisible({ timeout: 20000 });
          const rows = await v2.fdi.rows().allInnerTexts();
          s.observe(`${rows.length} row(s)`);
          expect(rows.every(r => r.includes(M[0].name) && /Inspection Completed/i.test(r))).toBe(true);
        }, { critical: true, evidence: true });
        await s.step('"View" → Inspection Detail: material, submittal, status "inspection completed", inspector, the run questions and their answers', async () => {
          await v2.fdiRow(sub.number).getByRole('button', { name: 'View', exact: true }).click();
          await page.waitForURL(/\/first-delivery-inspection\/[^/]+\/?$/, { timeout: 30000 }); await k.settle(2000);
          const text = await page.locator('main').innerText();
          F.viewUrl = new URL(page.url()).pathname;
          for (const v of [M[0].name, sub.number, 'inspection completed', PA.email, ...(F.questions || []), ...(F.answers || []).slice(0, 2)]) expect(text, `"${v}" on the detail page`).toContain(v);
          s.observe(`${F.viewUrl} · ${(text.match(/Inspection Responses \(\d+\)/) || [''])[0]}`);
        }, { critical: true, evidence: true });
      });

      // ================= TC-23 Dashboard previous vs current =================
      await scenario('dashboard', ['grn'], async s => {
        const b = R.before; let a;
        const row = (area, metric, before, after, expected, pass, note) => { dashboard.rows = dashboard.rows.filter(r => !(r.area === area && r.metric === metric)); dashboard.rows.push({ area, metric, before, after, expected, status: pass === null ? 'N/A' : pass ? 'PASS' : 'FAIL', note }); flush(); };
        const [newCat, oldCat] = [R.category.name, M[1].category];
        await s.step('Management Dashboard (same project, same filters as the baseline) → current values captured', async () => {
          a = R.after = await kit.readDashboard([newCat, oldCat]);
          dashboard.afterShot = await run.capture('dashboard-after');
          s.observe(`In scope ${a.categoriesInScope}; open ${a.open} of ${a.total}; deliveries ${a.deliveriesOnTime} of ${a.deliveriesWithDate}; by status ${JSON.stringify(a.byStatus || a.statusRaw)}`);
        }, { critical: true, evidence: true });
        await s.step('Submittal count → +1 (one submittal, however many components)', async () => { row('Procurement counts', 'Submittal count', b.total, a.total, '+1', a.total - b.total === 1); expect(a.total - b.total).toBe(1); });
        await s.step('Submittals by status → counts add up to the total; "Delivered" +1; open submittals unchanged', async () => {
          const sum = Object.values(a.byStatus || {}).reduce((x, y) => x + y, 0);
          row('Procurement counts', 'Delivered submittals', b.byStatus?.Delivered, a.byStatus?.Delivered, '+1', a.byStatus?.Delivered - b.byStatus?.Delivered === 1, `status counts sum ${sum}, total ${a.total}`);
          row('Procurement counts', 'Open submittals', b.open, a.open, '0', a.open === b.open, 'The run submittal is delivered');
          expect(sum).toBe(a.total);
          expect(a.byStatus.Delivered - b.byStatus.Delivered).toBe(1);
          expect(a.open).toBe(b.open);
        });
        // Business rule confirmed by the user (11 Nov 2026): a submittal is counted once, under the category of its PRIMARY
        // material; other materials' categories do not change. Spend: known issue SCP-DEF-049.
        await s.step('Material categories in scope → +1 (the new category, the primary material\'s, now has a submittal)', async () => {
          row('KPIs', 'Material categories in scope', b.categoriesInScope, a.categoriesInScope, '+1', a.categoriesInScope - b.categoriesInScope === 1);
          expect(a.categoriesInScope - b.categoriesInScope).toBe(1);
        });
        await s.step(`Delivery count → deliveries with an actual date +${M.length} and on-time deliveries +${M.length} (one per component)`, async () => {
          row('Delivery counts', 'Deliveries with an actual date', b.deliveriesWithDate, a.deliveriesWithDate, `+${M.length}`, a.deliveriesWithDate - b.deliveriesWithDate === M.length);
          row('Delivery counts', 'On-time deliveries', b.deliveriesOnTime, a.deliveriesOnTime, `+${M.length}`, a.deliveriesOnTime - b.deliveriesOnTime === M.length);
          expect(a.deliveriesWithDate - b.deliveriesWithDate).toBe(M.length);
          expect(a.deliveriesOnTime - b.deliveriesOnTime).toBe(M.length);
        });
        const nb = b.categories[newCat] || { total: 0, open: 0, spend: 0, absent: true }; const na = a.categories[newCat] || {};
        await s.step(`Materials row of the new category (primary material) → row appears with submittals 1, open 0`, async () => {
          row('Procurement counts', `${newCat}: submittals`, nb.total, na.total, '+1', na.total - nb.total === 1, 'Primary material category');
          row('Procurement counts', `${newCat}: open`, nb.open, na.open, '0', na.open === nb.open);
          expect(na.absent, `${newCat} row present`).toBeFalsy();
          expect(na.total - nb.total).toBe(1);
          expect(na.open).toBe(nb.open);
        });
        const plTotal = M.reduce((x, m) => x + (m.valueDelivered?.amount || 0), 0);
        const plCurrency = M[0].valueDelivered?.currency || '';
        // BUGS-596 (dev review 27 Nov 2026): Dashboard spend = received quantity × (price ÷ ordered quantity), where the
        // component Value is the price and the ordered quantity is the full QTY once a PO number exists. Each run component
        // is delivered in full (logDelivery qty = QTY), so the expected rise is Σ Value; it must also equal the Procurement
        // Log "Value Delivered" and use the project currency (the $ part is SCP-DEF-049).
        const expectedSpend = M.reduce((x, m) => x + (m.qty ? m.qty * (m.value / m.qty) : 0), 0);
        await s.step(`Procurement value of the new category → Spend rises by Σ received × (Value ÷ ordered QTY) = ${M.map(m => `${m.qty} × (${m.value} ÷ ${m.qty})`).join(' + ')} = ${expectedSpend} (BUGS-596), equal to the Procurement Log "Value Delivered" (${M.map(m => m.valueDelivered?.text).join(' + ')}), in the same currency`, async () => {
          const delta = na.spend - nb.spend;
          const pass = delta === expectedSpend && delta === plTotal && na.currency === plCurrency;
          row('Procurement value', `${newCat}: spend`, nb.spend, na.spend, `+${expectedSpend} ${plCurrency}`, pass,
            `dashboard "${na.cells?.[7] || ''}"; BUGS-596 formula ${expectedSpend}; Procurement Log Value Delivered ${M.map(m => `${m.name} ${m.valueDelivered?.text}`).join(' + ')}; old rule Σ QTY × Value = ${M.reduce((x, m) => x + m.qty * m.value, 0)}`);
          s.observe(`Dashboard change ${delta} ${na.currency}; expected (BUGS-596) ${expectedSpend}; Procurement Log ${plTotal} ${plCurrency}`);
          if (!pass) throw new Error(`Dashboard spend differs from the Procurement Log Value Delivered: dashboard +${delta} ${na.currency}, expected ${expectedSpend} (received × Value ÷ ordered QTY, BUGS-596), Procurement Log ${plTotal} ${plCurrency}`);
        });
        if (oldCat && norm(oldCat) !== norm(newCat)) {
          const ob = b.categories[oldCat] || { total: 0, open: 0, spend: 0 }; const oa = a.categories[oldCat] || { total: 0, open: 0, spend: 0 };
          await s.step(`Materials row "${oldCat}" (${M[1].name}, not the primary material) → unchanged: submittals, open and spend`, async () => {
            row('Procurement counts', `${oldCat}: submittals`, ob.total, oa.total, '0', oa.total === ob.total, 'Not the primary material category');
            row('Procurement counts', `${oldCat}: open`, ob.open, oa.open, '0', oa.open === ob.open);
            row('Procurement value', `${oldCat}: spend`, ob.spend, oa.spend, '0', oa.spend === ob.spend);
            expect(oa.total).toBe(ob.total);
            expect(oa.open).toBe(ob.open);
            expect(oa.spend).toBe(ob.spend);
          });
        }
        await s.step(`Delivered quantity → no quantity KPI on the Management Dashboard; delivered quantities verified per component (TC-17B) and in Analytics (TC-24): ${M.map(m => `${m.name} ${m.qty}`).join(', ')}`, async () => {
          const text = await k.main.innerText();
          const hits = (text.match(/[^\n]*\b(delivered quantity|qty delivered|units delivered)\b[^\n]*/gi) || []).slice(0, 3);
          row('Delivered quantity', 'Quantity KPI', '—', '—', `+${M.reduce((x, m) => x + m.qty, 0)} (Procurement Log)`, null, hits.length ? `Dashboard mentions: ${hits.join(' / ')}` : 'Not shown on the Management Dashboard');
          s.observe(hits.length ? hits.join(' / ') : 'No delivered-quantity figure on the Management Dashboard');
        }, { optional: true });
        await s.step('Alerts, Notifications, Tasks → unread counts compared with the baseline (shared project: other users also change them)', async () => {
          R.inboxAfter = {};
          for (const tab of ['Alerts', 'Notifications', 'Tasks']) {
            R.inboxAfter[tab] = await kit.inboxCount(tab);
            row(tab, 'Unread count', R.inboxBefore?.[tab], R.inboxAfter[tab], 'increase', R.inboxAfter[tab] > (R.inboxBefore?.[tab] ?? Infinity));
          }
          s.observe(JSON.stringify({ before: R.inboxBefore, after: R.inboxAfter }));
        }, { optional: true });
      });

      // ================= TC-23B Alerts, notifications, tasks =================
      await scenario('inbox', ['grn'], async s => {
        const NO = esc(sub.number);
        // From 00:00 to 05:30 IST the inbox dates items with the server's UTC date, the day before (SCP-DEF-074): that date
        // is accepted too and noted.
        const SERVER_DAY = ddmmyyyy(require('./support/pl-flow').poToday());
        if (SERVER_DAY !== TODAY) s.observe(`Server date ${SERVER_DAY} differs from the browser date ${TODAY}; items dated ${SERVER_DAY} count as today (SCP-DEF-074)`);
        const datedToday = text => text.includes(TODAY) || text.includes(SERVER_DAY);
        const check = async (tab, pattern, label) => {
          const rows = await kit.inboxRows(tab, pattern);
          s.observe(`${tab}: ${rows.length} match(es)${rows[0] ? ` – "${rows[0].text.slice(0, 170)}"` : ''}`);
          expect(rows.length, `${label} in ${tab}`).toBeGreaterThan(0);
          expect(datedToday(rows[0].text), `${label} dated today (${TODAY}${SERVER_DAY !== TODAY ? ` or server date ${SERVER_DAY}` : ''})`).toBe(true);
          return rows;
        };
        // Alerts users get for this flow (confirmed by the user, 11 Nov 2026): "Pre-Shipping Checklist has been pending.",
        // "Pre-Shipping Checklist has been approved." and "Delivery of N units of … logged for submittal …".
        await s.step(`Alerts → "Pre-Shipping Checklist has been pending." at least ${M.length} times today (one per booking)`, async () => {
          const rows = (await kit.inboxRows('Alerts', /Pre-Shipping Checklist has been pending/i)).filter(r => datedToday(r.text));
          s.observe(`${rows.length} checklist-pending alert(s) dated today on the first pages`);
          expect(rows.length).toBeGreaterThanOrEqual(M.length);
        }, { evidence: true });
        for (const m of M) {
          await s.step(`Alerts → "Delivery of ${m.qty} units of ${m.name} logged for submittal ${sub.number}", dated today`, () => check('Alerts', new RegExp(`Delivery of ${m.qty} units of ${esc(m.name)} logged for submittal ${NO}`, 'i'), `${m.name} delivery alert`));
          await s.step(`Notifications → "Delivery of ${m.qty} units of ${m.name} has been received at site for submittal ${sub.number}", dated today`, () => check('Notifications', new RegExp(`Delivery of ${m.qty} units of ${esc(m.name)} has been received at site for submittal ${NO}`, 'i'), `${m.name} received notification`));
        }
        await s.step(`Alerts → "Pre-Shipping Checklist has been approved." at least ${M.length} times today (one per booking)`, async () => {
          const rows = (await kit.inboxRows('Alerts', /Pre-Shipping Checklist has been approved/i)).filter(r => datedToday(r.text));
          s.observe(`${rows.length} checklist-approved alert(s) dated today on the first pages`);
          expect(rows.length).toBeGreaterThanOrEqual(M.length);
        });
        await s.step(`Tasks → "First delivery of ${M[0].name} received … submittal ${sub.number}" (new material), dated today, with a status`, async () => {
          const rows = await check('Tasks', new RegExp(`First delivery of ${esc(M[0].name)} received[\\s\\S]*submittal ${NO}`, 'i'), 'First-delivery inspection task');
          expect(rows[0].text).toMatch(/Created|Not Started|In Progress|Completed/);
        }, { evidence: true });
        await s.step(`Alerts → the TC-14 rule "${R.alert?.message || ''}" (condition ${ALERT_CONDITION} ${ALERT_VALUE} not met) is not in the Alerts list`, async () => {
          const rows = await kit.inboxRows('Alerts', new RegExp(esc(R.alert?.message || 'no-alert-rule'), 'i'), { pages: 2 });
          s.observe(rows.length ? `Unexpected: ${rows[0].text.slice(0, 160)}` : 'Not in the Alerts list – as expected (condition not met)');
          expect(rows.length).toBe(0);
        });
        await s.step(`Tasks → no first-delivery task expected for ${M[1].name} (not its first delivery) → recorded`, async () => {
          const rows = await kit.inboxRows('Tasks', new RegExp(`First delivery of ${esc(M[1].name)} received[\\s\\S]*submittal ${NO}`, 'i'));
          s.observe(rows.length ? `Unexpected: ${rows[0].text.slice(0, 160)}` : 'None – as expected');
          expect(rows.length).toBe(0);
        }, { optional: true });
      });

      // ================= TC-24 Analytics vs reference data =================
      await scenario('analytics', ['grn'], async s => {
        const C = R.config = R.config || {};
        await s.step('Configuration Options → every setting unchanged since the baseline (TC-02B)', async () => {
          const now = await v2.configurationOptions();
          const diff = Object.keys({ ...(analytics.configBefore || {}), ...now }).filter(k2 => (analytics.configBefore || {})[k2] !== now[k2]);
          s.observe(diff.length ? diff.map(k2 => `${k2}: "${(analytics.configBefore || {})[k2]}" → "${now[k2]}"`).join(' · ') : `${Object.keys(now).length} setting(s), none changed`);
          expect(diff, 'Configuration Options changed during the run').toEqual([]);
        }, { evidence: true });
        await s.step('Project Management › Configuration Options → configured "Currency Type" captured', async () => {
          C.currency = await v2.configuredCurrency();
          C.code = (C.currency.match(/^[A-Z]{3}/) || [''])[0];
          C.symbol = SYMBOL[C.code] || C.code;
          s.observe(`${C.currency} (symbol ${C.symbol})`);
          expect(C.code, 'Currency code').toMatch(/^[A-Z]{3}$/);
        }, { critical: true, evidence: true });
        await s.step('Reference Data › Common Utilities → the configured currency is a "currency_type" utility', async () => {
          const text = await v2.listText('Common Utilities');
          const listed = text.split('\n').some(l => norm(l).startsWith(norm(C.currency)) && /currency_type/.test(l));
          s.observe(listed ? `${C.currency} · currency_type listed` : `${C.currency} not on the first page of Common Utilities`);
          expect(listed).toBe(true);
        }, { optional: true, evidence: true });
        await s.step(`Reference Data › Common UoM → the materials' units (${[...new Set(M.map(m => m.uom).filter(Boolean))].join(', ')}) are listed`, async () => {
          const text = norm(await v2.listText('Common UoM'));
          const missing = [...new Set(M.map(m => m.uom).filter(Boolean))].filter(u => !text.includes(norm(u)));
          s.observe(missing.length ? `Not on the first page: ${missing.join(', ')}` : 'All listed');
          expect(missing).toEqual([]);
        }, { optional: true, evidence: true });
        await s.step('Procurement Log "Value Delivered" of the run components → in the configured currency', async () => {
          const symbols = [...new Set(M.map(m => m.valueDelivered?.currency).filter(Boolean))];
          s.observe(`${M.map(m => `${m.name} ${m.valueDelivered?.text}`).join(' · ')}; configured ${C.symbol}`);
          expect(symbols).toEqual([C.symbol]);
        }, { critical: true });
        const total = M.reduce((x, m) => x + m.qty, 0);
        const qty = v => Number(String(v || '').replace(/[^\d.]/g, '')) || 0;
        await s.step(`Analytics › Status Report › "Generate" → row for ${sub.number}: material ${M[0].name}, supplier ${R.supplier.name}, ${total} units across its quantity columns (both components)`, async () => {
          const r = await v2.statusReportRow(sub.number);
          expect(r.cells, `${sub.number} in the Status Report`).toBeTruthy();
          C.statusReport = r.values;
          s.observe(JSON.stringify(r.values));
          expect(norm(r.values.Material)).toBe(norm(M[0].name));
          expect(norm(r.values.Supplier)).toBe(norm(R.supplier.name));
          const sum = r.heads.filter(h => /^QTY/i.test(h) && !/Issues/i.test(h)).reduce((x, h) => x + qty(r.values[h]), 0);
          expect(sum, 'Units of the submittal in the Status Report').toBe(total);
          record('Analytics', 'Status Report row', sub.number, `${M[0].name} · ${R.supplier.name}`, 'Project Admin', r.heads.slice(3).map(h => `${h} ${r.values[h]}`).join(' · '));
        }, { evidence: true });
        // The report placed today's delivered units under "Not Ordered and Safe" (12 Nov), while earlier runs' submittals
        // show them as delivered: recorded as an observation (the report appears to refresh later).
        await s.step(`Status Report → the ${total} delivered units are under "QTY Delivered On Time"`, async () => {
          const v = C.statusReport || {};
          const delivered = qty(v['QTY Delivered On Time']);
          if (delivered !== total) throw new Error(`Status Report shows ${delivered} under "QTY Delivered On Time" for the delivered submittal (${Object.entries(v).slice(3).map(([h, x]) => `${h} ${x}`).join(', ')})`);
        }, { optional: true });
        await s.step(`Analytics › Lead Time Analysis → category "${R.category.name}" (primary material) is listed`, async () => {
          const r = await v2.leadTimeAnalysisRow(R.category.name);
          s.observe(r.cells ? r.heads.map((h, i) => `${h}: ${r.cells[i]}`).slice(0, 6).join(' · ') : 'Not listed');
          expect(r.cells, `${R.category.name} in Lead Time Analysis`).toBeTruthy();
        }, { evidence: true });
        for (const name of v2.ANALYTICS_PAGES) {
          await s.step(`Analytics › ${name} (after the flow) → same project, location and filters as the baseline; every sub-tab visited; scrolled with screenshots; values captured`, async () => {
            const r = analytics.after[name] = await v2.analyticsPage(name, 'after');
            const b = analytics.before[name];
            const d = compareAnalytics(b ? { [name]: b } : {}, { [name]: r }).filter(x => x.change !== 'same');
            s.observe(`${r.sections.length} section(s) · ${d.length} difference(s) vs the baseline${d.length ? `: ${d.slice(0, 6).map(x => `${x.tab} › ${x.key}: "${String(x.before).slice(0, 40)}" → "${String(x.after).slice(0, 40)}"`).join(' · ')}` : ''}`);
            expect(b, `Baseline of ${name} (TC-02B)`).toBeTruthy();
            expect(r.sections.map(x => x.tab), 'Same sections as the baseline').toEqual(b.sections.map(x => x.tab));
          }, { evidence: true });
        }
        await s.step('Analytics before vs after → every page compared; differences listed and highlighted in the report', async () => {
          const rows = compareAnalytics(analytics.before, analytics.after);
          const changed = rows.filter(x => x.change !== 'same');
          analytics.summary = Object.fromEntries(v2.ANALYTICS_PAGES.map(n => [n, changed.filter(x => x.page === n).length]));
          s.observe(`${rows.length} value(s) compared, ${changed.length} difference(s): ${Object.entries(analytics.summary).map(([n, c]) => `${n} ${c}`).join(' · ')}`);
          expect(Object.keys(analytics.after).length, 'Pages captured after the flow').toBe(v2.ANALYTICS_PAGES.length);
          flush();
        });
        await s.step(`Management Dashboard spend of "${R.category.name}" → shown in the configured currency (${C.symbol})`, async () => {
          const cur = (R.after?.categories?.[R.category.name] || {}).currency;
          s.observe(`Dashboard spend "${R.after?.categories?.[R.category.name]?.cells?.[7] || ''}" (currency ${cur || '?'}); configured ${C.currency}`);
          if (cur !== C.symbol) throw new Error(`Dashboard spend differs from the Procurement Log Value Delivered: currency "${cur}" instead of the configured ${C.currency} (${C.symbol})`);
        });
      });

      // ================= TC-24B Enterprise after the flow (added 23 Nov 2026) =================
      await scenario('entAfter', ['grn'], async s => {
        // Supplier Inbox removed on 24 Nov 2026 (client question 3): its check runs only when SCP_SUPPLIER_INBOX is set.
        if (!process.env.SCP_SUPPLIER_INBOX) s.observe('Supplier Inbox check not run: page removed (/supplier-inbox opens My Work) – awaiting client question 3');
        else await s.step(`Enterprise › Supplier Inbox: Submittal filter "${sub.number}" → no longer under "Pending Pre-Shipping Checklists" (the checklist was confirmed and approved in TC-15/16)`, async () => {
          const r = await inboxFor(sub.number, 'Pending Pre-Shipping Checklists');
          s.observe(`before the approvals: ${R.inboxPending ?? '?'} submittal(s); now: ${r.count}`);
          expect(r.count, 'Run submittal still listed under Pending Pre-Shipping Checklists after the approvals').toBe(0);
        });
        await s.step(`Enterprise › Enterprise View: Supplier table (with "% of total") → the run supplier "${R.supplier.name || '(not created)'}" is listed with a spend value`, async () => {
          await k.menu('Enterprise View', 'Enterprise').catch(() => null);
          if (!/\/enterprise-view/.test(page.url())) await page.goto('/enterprise-view', { waitUntil: 'domcontentloaded' });
          await k.settle(3000);
          const table = entMain.locator('table').filter({ has: page.getByRole('columnheader', { name: '% of total' }) }).first();
          const rows = await table.locator('tbody tr').evaluateAll(trs => trs.map(tr => [...tr.querySelectorAll('td')].map(td => td.innerText.replace(/\s+/g, ' ').trim())));
          const mine = rows.find(r => norm(r[0] || '') === norm(R.supplier.name || ''));
          s.observe(mine ? `Run supplier row: ${mine.join(' · ')}` : `Run supplier not among ${rows.length} rows`);
          expect(mine, `Run supplier ${R.supplier.name} not in the Enterprise View supplier table`).toBeTruthy();
        });
      });

      // ================= TC-25 Reporting =================
      await scenario('report', ['login'], async s => {
        await s.step('Final validation → category, material, supplier, subcontractor, user, FDI set, one submittal with two materials, components, bookings, GRNs, FDI inspection recorded', async () => {
          const have = recordsTable.map(r => r.record);
          s.observe(have.join(', '));
          for (const what of ['Material category', 'Material (primary)', 'Supplier record', 'User (normal organisation user)', 'FDI question set', 'Submittal']) expect(have, what).toContain(what);
          expect(have.filter(x => x === 'Submittal').length, 'One submittal').toBe(1);
          expect(have.filter(x => x === 'Component').length, 'Components').toBe(M.length);
          expect(have.filter(x => x === 'Delivery booking').length, 'Bookings').toBe(M.length);
          expect(have.filter(x => x === 'GRN').length, 'GRNs').toBe(M.length);
          expect(have, 'FDI inspection').toContain('FDI inspection');
        });
        await s.step(`Project and location selected once per login (${env.projectSelections} selection(s) for ${env.logins} login(s))`, async () => {
          // Counted against the sign-ins that select the project (loginAs). An invite activation – including one that fell
          // back to the existing account – signs in without that selection, so it is not counted (fixed 22 Nov 2026).
          expect(env.projectSelections).toBe(sessions.filter(x => x.action === 'Login').length);
        });
        await s.step('Location reuse in the Procurement Log → location verified before each action; dropdown opened only when the app had cleared/changed it; no FAIL', async () => {
          env.siteReselections = v2.siteReselections;
          const checks = v2.siteChecks.filter(c => !/^Login/.test(c.at));
          const n = re => checks.filter(c => re.test(c.outcome)).length;
          s.observe(`${checks.length} location check(s): ${n(/skipped/)} "PASS – Existing location verified; selection skipped", ${n(/selected successfully/)} "PASS – Location selected successfully", ${n(/^FAIL/)} "FAIL – Required location could not be selected"`);
          expect(checks.filter(c => /^FAIL/.test(c.outcome)).map(c => `${c.at}: ${c.error}`), 'Location could not be selected').toEqual([]);
          // A re-selection is only legitimate when the header did NOT show the target (cleared / changed by the app).
          expect(checks.filter(c => /selected successfully/.test(c.outcome) && c.found && norm(c.found).includes(norm(SITE))).length, 'Same location selected again although already active').toBe(0);
        });
        await s.step('Location never cleared/changed by the application after selection (0 re-selections needed)', async () => {
          const changed = v2.siteChecks.filter(c => /selected successfully/.test(c.outcome) && !/^Login/.test(c.at));
          s.observe(changed.length ? changed.map(c => `${c.at}: header showed "${c.found}"`).join(' · ') : 'Location stayed on the selected value');
          expect(changed.length, 'The application reset the header location').toBe(0);
        }, { optional: true });
        await s.step('Execution report → e2e-report.html exists; every executed step has an ID, status, duration and a screenshot', async () => {
          flush();
          const steps = run.result.scenarios.flatMap(x => x.steps).filter(x => x.status !== 'Running');
          expect(fs.existsSync(path.join(outDir, 'e2e-report.html'))).toBe(true);
          expect(steps.filter(x => !x.id || x.durationMs == null || !x.status), 'Steps without ID/status/duration').toEqual([]);
          const noShot = steps.filter(x => ['Failed', 'Known Defect'].includes(x.status) && !(x.attempts || []).some(a => a.screenshot));
          expect(noShot.map(x => x.id), 'Failures without a screenshot').toEqual([]);
          if (SHOT_EVERY_STEP) expect(steps.filter(x => x.status === 'Passed' && !x.evidence).map(x => x.id), 'Passed steps without a screenshot').toEqual([]);
          s.observe(`${steps.length} steps recorded`);
        });
        await s.step('Execution report → e2e-report.pdf generated', async () => {
          const pdf = await writeE2ePdf(outDir);
          expect(fs.statSync(pdf).size).toBeGreaterThan(1000);
        });
      });

      // ================= TC-26 Logout =================
      if (current.role !== 'Signed out') {
        const who = current.role === PA.role ? PA : current.role === SUP.role ? SUP : SUBCON;
        records.logout = await run.scenario(S.logout, async s => {
          await s.step('Management Dashboard → final screenshot', async () => {
            await navigator.clearLayers(); await k.menu('Management Dashboard'); await k.settle(2000);
          }, { evidence: true });
          await logoutAs(s, who);
        });
      } else block(S.logout, 'No signed-in account to log out');
    } finally {
      run.result.environment.role = sessions.map(x => `${x.action} ${x.role}`).join(' → ');
      fs.writeFileSync(path.join(outDir, 'run-records.json'), JSON.stringify({ ...R, newUser: { ...R.newUser, password: undefined }, sessions, records: recordsTable, dashboard, home }, null, 2));
      run.result.finishedAt = new Date().toISOString();
      flush();
      await writeE2ePdf(outDir).then(f => console.log(`E2E PDF: ${f}`), e => console.log(`E2E PDF not written: ${e.message.split('\n')[0]}`));
      const sm = summarise(run.result);
      console.log(`\nE2E SMOKE ${sm.overall}: ${sm.cases.total} test cases, ${sm.total} steps – ${sm.pass} PASS, ${sm.fail} FAIL, ${sm.skipped} SKIPPED, ${sm.blocked} BLOCKED`);
      console.log(`E2E report: ${path.join(outDir, 'e2e-report.html')}`);
    }
  } });
});
