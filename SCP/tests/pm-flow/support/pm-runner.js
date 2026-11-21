// Runs the Project Management flow scenario by scenario in one page and records every step.
// Each step gets at most two attempts. After a second failure the step is recorded as Failed (with a
// screenshot) and the flow continues with the next step; a failed "critical" step (for example opening
// the page) blocks only the remaining steps of its own scenario.
const fs = require('fs');
const path = require('path');
const { setBanner, setNavPath } = require('./pm-visuals');
const { redactUrlsInText } = require('../../../utils/evidence');
const { KNOWN_DEFECTS } = require('../../../config/scp-known-defects');

// A failure whose message matches a registered known defect is reported as "Known Defect", not Failed.
// The defect must also belong to the scenario: its `modules` include the scenario's module, or its `scenarioIds`
// list the scenario. Without this, a generic signature (e.g. a download timeout) would relabel any module's failure.
const appliesTo = (defect, scenario = {}) => {
  if (Array.isArray(defect.scenarioIds) && defect.scenarioIds.includes(scenario.id)) return true;
  return !defect.modules || defect.modules.includes(scenario.module);
};
const knownDefect = (message, scenario) => KNOWN_DEFECTS.find(defect => defect.signature && appliesTo(defect, scenario) && defect.signature.test(message));

const MAX_ATTEMPTS = 2;
const stepInterval = () => {
  const value = Number(process.env.PM_FLOW_STEP_INTERVAL_MS ?? 800);
  return Number.isFinite(value) && value >= 0 ? value : 800;
};
const slug = value => String(value).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 80);
const clean = message => redactUrlsInText(String(message || '').split('\n').filter(line => !/^\s+at /.test(line)).join('\n')).trim().slice(0, 1200);

class PmRun {
  constructor({ suite, page, outDir, recover, only }) {
    this.suite = suite;
    this.page = page;
    this.outDir = outDir;
    this.recover = recover || (async () => {});
    // Closes only an open dropdown list (never a form).
    this.recoverLight = async () => {
      if (await page.getByRole('listbox').filter({ visible: true }).count().catch(() => 0)) await page.keyboard.press('Escape');
    };
    this.only = only && only.length ? new Set(only) : null;
    this.result = { suite, startedAt: new Date().toISOString(), environment: {}, scenarios: [] };
    this.data = {}; // values shared between scenarios of one run
    fs.mkdirSync(path.join(outDir, 'screenshots'), { recursive: true });
  }

  selected(id) { return !this.only || this.only.has(id); }

  // Records a scenario that is intentionally not executed (deferred / out of scope).
  skip(meta, reason) {
    if (!this.selected(meta.id)) return;
    this.result.scenarios.push({ ...meta, status: 'Skipped', reason, steps: [], startedAt: new Date().toISOString(), durationMs: 0 });
  }

  // Stops the remaining scenarios (recorded as Blocked) when the shared session itself is unusable.
  abort(reason) { this.aborted = reason; }

  async scenario(meta, body) {
    // Sign-in (always: true) runs even in a re-run limited with --only.
    if (!meta.always && !this.selected(meta.id)) return;
    if (this.aborted) {
      this.result.scenarios.push({ ...meta, status: 'Blocked', reason: this.aborted, steps: [], startedAt: new Date().toISOString(), durationMs: 0 });
      return;
    }
    const record = { ...meta, status: 'Running', steps: [], startedAt: new Date().toISOString() };
    this.result.scenarios.push(record);
    const started = Date.now();
    const title = `${meta.id} · ${meta.submodule} · ${meta.title}`;
    console.log(`\n▶ [${this.suite}] ${title}`);
    await setBanner(this.page, { suite: this.suite.toUpperCase(), title, step: '' });
    if (meta.navPath) await setNavPath(this.page, meta.navPath);
    const context = { blocked: null, step: (name, fn, options) => this.step(record, context, title, name, fn, options) };
    // Records what the app did in the running step, for expected results that are not confirmed yet (Ev. "I").
    context.observe = text => {
      const step = record.steps[record.steps.length - 1];
      if (!step) return;
      step.reason = `${step.reason ? `${step.reason} · ` : ''}Observed: ${text}`;
      console.log(`      observed: ${text}`);
    };
    try {
      await body(context);
    } catch (error) {
      // Steps never throw; this only catches mistakes in the scenario body itself.
      record.steps.push({ name: 'Scenario body', status: 'Failed', attempts: [{ number: 1, error: clean(error.message) }], durationMs: 0 });
    }
    // A failed scenario may leave a form half-filled; close it so the next scenario starts clean.
    // A known defect is an expected result, so the form stays open for the scenarios that continue in it.
    if (record.steps.some(step => ['Failed', 'Blocked'].includes(step.status))) await this.recover().catch(() => null);
    record.durationMs = Date.now() - started;
    record.finishedAt = new Date().toISOString();
    const statuses = record.steps.map(step => step.status);
    record.status = statuses.includes('Failed') ? 'Failed' : statuses.includes('Blocked') ? 'Blocked' : statuses.includes('Known Defect') ? 'Known Defect' : 'Passed';
    if (record.status === 'Known Defect') record.defects = [...new Set(record.steps.map(step => step.defect).filter(Boolean))];
    const retried = record.steps.filter(step => step.retried).length;
    if (retried) record.retriedSteps = retried;
    console.log(`  ${record.status === 'Passed' ? '✔' : '✖'} ${meta.id} ${record.status} (${(record.durationMs / 1000).toFixed(1)} s)`);
    return record;
  }

  async step(record, context, title, name, fn, options = {}) {
    const step = { name, status: 'Running', attempts: [], startedAt: new Date().toISOString() };
    record.steps.push(step);
    const started = Date.now();
    if (context.blocked) {
      step.status = 'Blocked';
      step.reason = `Not executed: required step "${context.blocked}" failed`;
      step.durationMs = 0;
      console.log(`    ⏭ ${name} – blocked`);
      return undefined;
    }
    await setBanner(this.page, { suite: this.suite.toUpperCase(), title, step: name });
    let value;
    // options.attempts (1 or 2) overrides the default; the E2E smoke runs every step once.
    const maxAttempts = Number.isInteger(options.attempts) && options.attempts > 0 ? Math.min(options.attempts, MAX_ATTEMPTS) : MAX_ATTEMPTS;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const entry = { number: attempt, startedAt: new Date().toISOString() };
      step.attempts.push(entry);
      try {
        value = await fn();
        entry.status = 'Passed';
        step.status = 'Passed';
        break;
      } catch (error) {
        entry.status = 'Failed';
        entry.error = clean(error.message);
        entry.screenshot = await this.capture(`${record.id}-${slug(name)}-attempt${attempt}`);
        console.log(`    ✖ ${name} – attempt ${attempt} failed: ${entry.error.split('\n')[0]}`);
        // A registered known defect is the real result: record it, do not retry.
        if (knownDefect(entry.error, record)) break;
        // Between attempts only close an open dropdown; an open form stays open for the retry and the next steps.
        if (attempt < maxAttempts) await this.recoverLight().catch(() => null);
      }
    }
    if (step.status !== 'Passed') {
      const defect = step.attempts.map(item => knownDefect(item.error || '', record)).find(Boolean);
      if (defect) { step.status = 'Known Defect'; step.defect = defect.id; console.log(`    ⚠ ${name} – known defect ${defect.id}`); }
      else step.status = 'Failed';
      if (options.critical && !defect) context.blocked = name;
      await this.recoverLight().catch(() => null);
    } else {
      // A pass on the second attempt is kept visible: the first attempt's error stays in step.attempts.
      if (step.attempts.length > 1) step.retried = true;
      console.log(`    ✔ ${name}${step.retried ? ' (passed on retry)' : ''}`);
    }
    step.durationMs = Date.now() - started;
    if (stepInterval()) await this.page.waitForTimeout(stepInterval());
    return value;
  }

  async capture(name) {
    if (!this.page || this.page.isClosed()) return null;
    const file = path.join('screenshots', `${slug(name)}.png`);
    await this.page.screenshot({ path: path.join(this.outDir, file), timeout: 8000 }).catch(() => null);
    return fs.existsSync(path.join(this.outDir, file)) ? file.replace(/\\/g, '/') : null;
  }

  summary() {
    const count = status => this.result.scenarios.filter(item => item.status === status).length;
    return { total: this.result.scenarios.length, passed: count('Passed'), failed: count('Failed'), blocked: count('Blocked'), knownDefects: count('Known Defect'), skipped: count('Skipped') };
  }

  finish() {
    this.result.finishedAt = new Date().toISOString();
    this.result.summary = this.summary();
    this.result.rerun = this.result.scenarios.filter(item => ['Failed', 'Blocked'].includes(item.status)).map(item => item.id);
    fs.writeFileSync(path.join(this.outDir, 'results.json'), JSON.stringify(this.result, null, 2));
    return this.result;
  }
}

module.exports = { PmRun, knownDefect };
