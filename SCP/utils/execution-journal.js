const fs = require('fs');
const path = require('path');
const { createHash, randomUUID } = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');
const activeStep = new AsyncLocalStorage();
const MAX_ATTEMPTS = 2;
const stableId = (file, title) => `SCP-${createHash('sha256').update(`${file.replace(/\\/g, '/')}:${title}`).digest('hex').slice(0, 12)}`;
// A title may declare its requirement ID ("SCP-UM-001 ..."); otherwise the ID is derived from file and title.
const scenarioId = (file, title) => /^(SCP-[A-Z]+-\d+(?:\.\d+)?)\b/.exec(title)?.[1] || stableId(file, title);
class DependencyBlocked extends Error {
  constructor(message) { super(`BLOCKED: ${message}`); this.name = 'DependencyBlocked'; }
}
function classification(error) {
  if (/BLOCKED:/.test(error.message)) return 'Missing prerequisite';
  if (/Application defect:/i.test(error.message)) return 'Product defect';
  if (/net::|ERR_NETWORK|ENOTFOUND|ECONN|browser.*closed/i.test(error.message)) return 'Environment';
  return error.failureCategory || 'Unclassified: inspect evidence';
}
function plain(value) {
  return JSON.parse(JSON.stringify(value, (key, item) =>
    /password|access.?token|authorization|cookie/i.test(key) || ['browser', 'procurement', 'scpSession'].includes(key) ||
    (key === 'page' && !(item && typeof item === 'object' && typeof item.probed === 'boolean')) || typeof item === 'function' ? undefined : item));
}
class ExecutionJournal {
  constructor({ directory, scenario, context = {}, evidence = async () => null }) {
    this.runId = randomUUID(); this.scenario = scenario; this.context = context; this.evidence = evidence;
    this.file = path.join(directory, `${scenario.id}-${createHash('sha256').update(JSON.stringify(context)).digest('hex').slice(0, 8)}.json`); this.definitions = new Map();
    if (fs.existsSync(this.file)) {
      this.state = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (JSON.stringify(this.state.context) !== JSON.stringify(context)) throw new DependencyBlocked('Recovery checkpoint belongs to a different project, site or account');
    } else this.state = { version: 1, scenario, context, data: {}, steps: {}, history: [] };
    this.steps = []; this.save();
  }
  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(plain(this.state), null, 2));
    // Windows scanners can briefly lock a checkpoint during atomic replacement.
    // Retry that local file operation once; never rerun the business action here.
    try { fs.renameSync(temporary, this.file); }
    catch (error) {
      if (!['EPERM', 'EBUSY'].includes(error.code)) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
      fs.renameSync(temporary, this.file);
    }
  }
  data(key, factory) {
    if (!(key in this.state.data)) { this.state.data[key] = plain(factory()); this.save(); }
    return this.state.data[key];
  }
  setData(key, value) { this.state.data[key] = plain(value); this.save(); }
  relatedData(scenarioId) {
    if (!/^SCP-[a-z0-9.-]+$/i.test(scenarioId)) throw new Error('Related scenario ID is invalid');
    const suffix = createHash('sha256').update(JSON.stringify(this.context)).digest('hex').slice(0, 8);
    const file = path.join(path.dirname(this.file), `${scenarioId}-${suffix}.json`);
    if (!fs.existsSync(file)) return null;
    const related = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (JSON.stringify(related.context) !== JSON.stringify(this.context)) throw new DependencyBlocked('Related data belongs to a different account, project or environment');
    return plain(related.data);
  }
  define(steps) {
    for (const step of steps) this.definitions.set(step.id, step);
    const visit = (id, path = new Set()) => {
      if (path.has(id)) throw new Error(`Dependency cycle at ${id}`);
      for (const parent of this.definitions.get(id)?.dependsOn || []) visit(parent, new Set([...path, id]));
    };
    for (const id of this.definitions.keys()) visit(id);
  }
  blockDependents(id) {
    for (const definition of this.definitions.values()) {
      if ((definition.dependsOn || []).includes(id)) {
        const blocked = { ...definition, status: 'Blocked', attempts: [], attemptCount: 0, blockedBy: id,
          actual: `Not executed because ${id} did not pass`, runId: this.runId };
        this.state.steps[definition.id] = blocked;
        const index = this.steps.findIndex(step => step.id === definition.id);
        if (index >= 0) this.steps[index] = blocked; else this.steps.push(blocked);
        this.blockDependents(definition.id);
      }
    }
  }
  async execute(definition, action) {
    // One retry owner per action: nested wrappers cannot multiply the limit.
    if (activeStep.getStore()) return action();
    const step = { ...definition, runId: this.runId, status: 'Running', attempts: [], startedAt: new Date().toISOString() };
    const previousStep = this.state.steps[definition.id];
    delete step.verify;
    const missing = (definition.dependsOn || []).find(id => this.state.steps[id]?.status !== 'Passed');
    if (missing) {
      step.status = 'Blocked'; step.blockedBy = missing; step.attemptCount = 0;
      step.actual = `Required step ${missing} has not passed`;
      this.steps = this.steps.filter(item => item.id !== step.id); this.steps.push(step); this.state.steps[step.id] = step; this.save();
      throw new DependencyBlocked(step.actual);
    }
    this.steps = this.steps.filter(item => item.id !== step.id); this.steps.push(step);
    if (this.state.steps[step.id]?.runId !== this.runId && this.state.steps[step.id]) this.state.history.push(plain(this.state.steps[step.id]));
    let lastError;
    const limit = definition.group ? 1 : MAX_ATTEMPTS;
    for (let attempt = 1; attempt <= limit; attempt++) {
      const entry = { number: attempt, startedAt: new Date().toISOString(), status: 'Running', actionExecuted: false };
      step.attempts.push(entry); step.attemptCount = attempt;
      const previous = this.runningStep; this.runningStep = step;
      try {
        if (attempt === 1 && !definition.group && !definition.verify && definition.mutation && previousStep &&
            previousStep.runId !== this.runId && previousStep.attempts?.some(item => item.actionExecuted)) {
          throw new DependencyBlocked('A prior creation/update attempt is checkpointed; supply a live existence verifier before repeating it');
        }
        if (definition.verify) {
          const existing = await activeStep.run(step, () => definition.verify());
          if (!existing || !['complete', 'missing', 'unknown'].includes(existing.status)) throw new Error('Existence verifier must return complete, missing or unknown');
          if (existing.status === 'complete') {
            entry.status = 'Passed'; entry.reused = true; entry.actual = 'Validated existing records; no action repeated';
            step.status = 'Passed'; step.actual = entry.actual;
            if (existing.value !== undefined) step.records = plain(existing.value);
            return existing.value;
          }
          if (existing.status === 'unknown') throw new DependencyBlocked(existing.reason || 'Existing record state cannot be verified safely');
        } else if (attempt > 1 && (definition.mutation || step.mutationObserved)) {
          entry.retrySuppressed = true;
          throw new DependencyBlocked('The previous attempt may have saved data; an existence verifier is required before repeating this action');
        }
        entry.actionExecuted = true;
        const value = definition.group ? await action({ attempt }) : await activeStep.run(step, () => action({ attempt }));
        if (definition.verify) {
          const confirmed = await activeStep.run(step, () => definition.verify());
          if (confirmed?.status !== 'complete') throw new Error('The action completed but its saved result could not be validated');
          if (confirmed.value !== undefined) step.records = plain(confirmed.value);
        }
        entry.status = 'Passed'; step.status = 'Passed';
        entry.actual = definition.success || 'Action and its declared assertions completed successfully';
        step.actual = entry.actual;
        return value;
      } catch (error) {
        lastError = error; entry.error = error.message; entry.reason = classification(error);
        entry.status = /BLOCKED:/.test(error.message) ? 'Blocked' : 'Failed';
        entry.evidence = await this.evidence({ step, attempt, error }).catch(evidenceError => ({ error: error.message, screenshotUnavailable: evidenceError.message }));
        if (entry.status === 'Blocked' || definition.group) break;
      } finally {
        this.runningStep = previous;
        entry.finishedAt = new Date().toISOString();
        step.finishedAt = entry.finishedAt;
        this.state.steps[step.id] = step; this.save();
      }
    }
    // A failed action stays Failed even if its duplicate-prevention check was Blocked.
    step.status = step.attempts.some(attempt => attempt.status === 'Failed') ? 'Failed' : 'Blocked';
    step.actual = lastError.message; step.failureReason = step.attempts.find(attempt => attempt.status === 'Failed')?.reason || classification(lastError);
    this.state.history.push(plain(step)); this.blockDependents(step.id); this.save();
    if (step.status === 'Failed' && /BLOCKED:/.test(lastError.message)) {
      const original = step.attempts.find(attempt => attempt.status === 'Failed');
      throw new Error(`${original.error}. Retry not executed: ${lastError.message.replace(/^BLOCKED:\s*/, '')}`);
    }
    throw lastError;
  }
  async runPlan(definitions) {
    this.define(definitions.map(({ action, ...definition }) => definition));
    for (const { action, ...definition } of definitions) {
      try { await this.execute(definition, action); } catch { /* Independent nodes continue; failures remain in the journal. */ }
    }
    return this.snapshot();
  }
  snapshot() { return plain({ scenario: this.scenario, context: this.context, runId: this.runId, checkpoint: this.file, data: this.state.data, steps: this.steps, history: this.state.history, observedWrites: this.observedWrites || [] }); }
}
function observeMutation(current) { const step = activeStep.getStore() || current; if (step) step.mutationObserved = true; }
module.exports = { ExecutionJournal, DependencyBlocked, stableId, scenarioId, MAX_ATTEMPTS, observeMutation, activeStep };
