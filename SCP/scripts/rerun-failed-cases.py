"""Re-run only the failed scenarios of a full regression (plus the parents they need), suite by suite.

Usage:
  python scripts/rerun-failed-cases.py --run reports/full-regression-<stamp> [--plan-only]

Selection per suite:
  * failed / known-defect scenarios of that run
  * + parent scenarios whose return value or run.data they read (static scan of the spec)
  * suites in FULL_SUITES run completely: their scenarios share UI and closure state, so a failed case cannot run alone
    (PL part 3 delivery chain, E2E smoke chain) or another suite depends on their data (PL part 1 stocks Inventory).
Writes reports/rerun-failed-<stamp>/suites.json in the same shape as run-full-regression.js, so
build-management-workbook.py --rerun <folder> can merge it. Videos are off (screenshots stay) to save time.
"""
import argparse, datetime as dt, json, os, re, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SPEC = {'app-regression': 'app-regression.spec.js', 'tickets': 'tickets-regression.spec.js', 'regression': 'pm-regression.spec.js',
        'pl-regression2': 'pl-regression-2.spec.js', 'regression2': 'pm-regression-part2.spec.js', 'pl-regression': 'pl-regression.spec.js',
        'inv-regression': 'inv-regression.spec.js', 'pl-regression3': 'pl-regression-3.spec.js', 'e2e-smoke': 'e2e-smoke.spec.js'}
FULL_SUITES = {'pl-regression': 'stocks the material Inventory needs (run right before inv-regression)',
               'pl-regression3': 'delivery chain shares one submittal and page state',
               'e2e-smoke': 'end-to-end chain with prerequisites'}
ORDER = ['app-regression', 'tickets', 'regression', 'pl-regression2', 'regression2', 'pl-regression', 'inv-regression',
         'pl-regression3', 'e2e-smoke']

def parents(suite, results, failed):
    src = open(os.path.join(ROOT, 'tests', 'pm-flow', SPEC[suite]), encoding='utf-8').read()
    order = [x['id'] for x in results['scenarios']]
    pos = {i: m.start() for i in order for m in [re.search(r"['\"`]" + re.escape(i) + r"['\"`]", src)] if m}
    ids = sorted(pos, key=pos.get)
    bodies = {i: src[pos[i]:(pos[ids[k + 1]] if k + 1 < len(ids) else len(src))] for k, i in enumerate(ids)}
    # Helper functions (`const siteFile = (…) => …`) can read run.data for the scenario that calls them
    # (UPL-SITE-08 → siteUpload → siteFile → data.siteTemplate from UPL-SITE-02), so a body is expanded with the
    # definitions of the helpers it calls (two levels deep).
    helpers = {}
    for m in re.finditer(r"\n(\s+)const (\w+) = (?:async\s*)?(?:\([^)]*\)|\w+)\s*=>", src):
        end = re.search(r"\n" + m.group(1) + r"(?:const |await |let |for |if )", src[m.end():])
        helpers[m.group(2)] = src[m.start():m.end() + (end.start() if end else 2000)]
    def expand(text, depth=2):
        extra = ''.join(h for n, h in helpers.items() if re.search(r"\b" + re.escape(n) + r"\(", text))
        return text + (expand(extra, depth - 1) if depth and extra else extra)
    bodies_x = {i: expand(b) for i, b in bodies.items()}
    prod = {}
    for i, body in bodies.items():
        m = re.search(r"(?:const|let)\s+(\w+)\s*=\s*await\s+run\.scenario\([^;]*$", src[max(0, pos[i] - 200):pos[i]])
        if m:
            prod.setdefault(m.group(1), i)
        for key in re.findall(r"\bdata\.(\w+)\s*=[^=]", body):
            prod.setdefault('data.' + key, i)
    def guarded(name, p, i):
        # Scenario i sits inside an open `if (...name...) {` block placed after producer p (e.g. `if (comp.status === 'Passed') {`).
        seg = src[pos[p]:pos[i]]
        for m in re.finditer(r"\bif\s*\([^)]*\b" + re.escape(name) + r"\b[^)]*\)\s*\{", seg):
            tail = seg[m.end():]
            if tail.count('{') - tail.count('}') >= 0:
                return True
        return False
    def deps(i, seen):
        out = set()
        for name, p in prod.items():
            pat = r"\bdata\." + re.escape(name[5:]) + r"\b" if name.startswith('data.') else r"\b" + re.escape(name) + r"\b"
            if p != i and p not in seen and pos.get(p, 1e12) < pos.get(i, 0) and (
                    re.search(pat, bodies_x.get(i, '')) or (not name.startswith('data.') and guarded(name, p, i))):
                seen.add(p); out |= {p} | deps(p, seen)
        return out
    need = set(failed)
    for f in failed:
        need |= deps(f, set())
    always = {x['id'] for x in results['scenarios'] if x.get('always')}
    return [i for i in order if i in need - always]

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--run', required=True); ap.add_argument('--plan-only', action='store_true')
    ap.add_argument('--suites', help='comma-separated subset of suites to re-run (default: every suite with failures)')
    a = ap.parse_args()
    base = json.load(open(os.path.join(ROOT, a.run, 'suites.json'), encoding='utf-8'))
    entries = {e['suite']: e for e in base['suites']}
    stamp = dt.datetime.utcnow().strftime('%Y-%m-%dT%H-%M-%S-%fZ')[:-4] + 'Z'
    out = os.path.join(ROOT, 'reports', f'rerun-failed-{stamp}')
    plan = {'startedAt': dt.datetime.utcnow().isoformat() + 'Z', 'baseRun': os.path.basename(a.run.rstrip('/\\')), 'suites': []}
    pick = set(a.suites.split(',')) if a.suites else None
    for suite in ORDER:
        if pick and suite not in pick:
            continue
        res = json.load(open(os.path.join(entries[suite]['reportDir'], 'results.json'), encoding='utf-8'))
        failed = [x['id'] for x in res['scenarios'] if x['status'] in ('Failed', 'Known Defect')]
        if not failed:
            continue
        full = suite in FULL_SUITES
        sel = [] if full else parents(suite, res, failed)
        plan['suites'].append({'suite': suite, 'failed': failed, 'only': sel, 'mode': 'full suite' if full else 'failed + parents',
                               'why': FULL_SUITES.get(suite, '')})
    for s in plan['suites']:
        print(f"{s['suite']:15} {s['mode']:17} failed {len(s['failed']):2}  selected {len(s['only']) or 'all'}")
    if a.plan_only:
        return
    os.makedirs(out, exist_ok=True)
    save = lambda: json.dump(plan, open(os.path.join(out, 'suites.json'), 'w', encoding='utf-8'), indent=2)
    save()
    pm_dir = os.path.join(ROOT, 'reports', 'pm-flow')
    env = {**os.environ, 'PM_FLOW_VIDEO': 'off', 'E2E_VIDEO': 'off'}
    for s in plan['suites']:
        before = set(os.listdir(pm_dir))
        s['startedAt'] = dt.datetime.utcnow().isoformat() + 'Z'; save()
        print(f"\n==================== re-run {s['suite']} ({s['mode']}) – {dt.datetime.now():%H:%M:%S} ====================", flush=True)
        cmd = ['node', os.path.join('scripts', 'run-pm-flow.js'), s['suite']] + ([f"--only={','.join(s['only'])}"] if s['only'] else [])
        r = subprocess.run(cmd, cwd=ROOT, env=env)
        fresh = sorted(d for d in os.listdir(pm_dir) if d not in before and d.startswith(f"{s['suite']}-"))
        s['reportDir'] = os.path.join(pm_dir, fresh[-1]) if fresh else None
        s['exitCode'] = r.returncode; s['finishedAt'] = dt.datetime.utcnow().isoformat() + 'Z'; save()
    plan['finishedAt'] = dt.datetime.utcnow().isoformat() + 'Z'; save()
    print(f'\nRe-run finished: {out}')

if __name__ == '__main__':
    main()
