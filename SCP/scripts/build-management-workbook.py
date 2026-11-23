"""Build the consolidated SCP regression management workbook from real execution results.

Usage:
  python scripts/build-management-workbook.py [--run reports/full-regression-<stamp>] [--watch MINUTES]

Sources (nothing is estimated):
  * reports/full-regression-*/suites.json and each suite's reports/pm-flow/<suite>-<stamp>/results.json
  * config/scp-known-defects.js (registered known defects, read through node)
  * docs/functional-discovery/APP_MAP_SWEEP.md (UI discovery sweep) + navigation paths seen in the run
  * docs/functional-discovery/AUTOMATION_PROGRESS_2026-11-03.md section 6 (regression cases proposed, not yet written)

Output: reports/management/SCP_Full_Regression_Management_Report_<YYYYMMDD>.xlsx (rewritten atomically, so it can be
re-run while the regression is still executing; suites not yet finished show as NOT EXECUTED).
"""
import argparse, collections, datetime as dt, glob, json, os, re, subprocess, sys, time

from openpyxl import Workbook
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PM_DIR = os.path.join(ROOT, 'reports', 'pm-flow')
ANSI = re.compile(r'\x1b\[[0-9;]*m')

SUITE_TITLES = {
    'app-regression': 'Other modules regression', 'tickets': 'Ticket regression (BUGS)',
    'regression': 'Project Management regression part 1', 'pl-regression2': 'Procurement Log regression part 2',
    'regression2': 'Project Management regression part 2', 'pl-regression': 'Procurement Log regression part 1',
    'inv-regression': 'Inventory regression', 'pl-regression3': 'Procurement Log regression part 3',
    'e2e-smoke': 'E2E smoke (TC-01 … TC-26)',
}
MODULE_ORDER = ['Authentication & Setup', 'Project Management', 'User Management', 'Procurement Log',
                'Inventory Management', 'First Delivery Inspections', 'International Shipments',
                'Management Dashboard', 'Analytics', 'Enterprise', 'Document Management', 'Cross-module E2E']
TICKET_MODULE = {'BUGS-508/507': 'Project Management', 'BUGS-517': 'Procurement Log', 'BUGS-543': 'Project Management',
                 'BUGS-548': 'Project Management', 'BUGS-155': 'Procurement Log'}
MODULE_ALIAS = {'Supplier Management': 'User Management', 'FDI Configuration': 'Project Management',
                'First Delivery Inspection': 'First Delivery Inspections', 'Setup': 'Authentication & Setup',
                'Authentication': 'Authentication & Setup', 'Homepage': 'Management Dashboard'}
STATUS_MAP = {'Passed': 'PASS', 'Failed': 'FAIL', 'Known Defect': 'FAIL', 'Blocked': 'BLOCKED', 'Skipped': 'SKIPPED'}
# A skipped scenario still counts as automated only when its check runs inside another automated scenario.
COVERED_ELSEWHERE = re.compile(r'^(Covered (by|as|in)|Runs (in|with) |Checked in |Loss 1 is executed)', re.I)

def clean(text, limit=1500):
    text = ANSI.sub('', str(text or '')).strip()
    return text if len(text) <= limit else text[:limit - 1] + '…'

def first_line(text):
    return clean(text).split('\n')[0]

def parse_ts(value):
    try:
        return dt.datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone() if value else None
    except ValueError:
        return None

def fmt_ts(value):
    t = parse_ts(value)
    return t.strftime('%Y-%m-%d %H:%M:%S') if t else ''

def norm_module(scn, suite):
    if suite == 'e2e-smoke':
        return 'Cross-module E2E'
    mod = scn.get('module') or ''
    for key, target in TICKET_MODULE.items():
        if mod.startswith(key):
            return target
    return MODULE_ALIAS.get(mod, mod)

def screen_of(scn):
    nav = [p for p in (scn.get('navPath') or []) if p]
    return ' > '.join(nav[:2]) if nav else (scn.get('module') or '')

def priority_of(category, suite):
    c = (category or '').lower()
    if suite == 'e2e-smoke' or c in ('setup', 'login and project', 'authentication'):
        return 'P1'
    if c.startswith(('negative', 'boundary', 'deferred', 'security')):
        return 'P3'
    return 'P2'

def skip_category(reason):
    r = (reason or '').lower()
    rules = [
        ('Covered by another scenario', r'^(covered|runs (in|with)|checked in|loss 1 is executed)'),
        ('Prerequisite failed', r'prerequisite|no signed-in account|grn not generated|setup failed|^[a-z0-9.-]+ failed$'),
        ('Role / second login required', r'sign-in failed'),
        ('External system / mailbox', r'procore|thelink|yopmail|mailbox|external'),
        ('Two-phase batch (next day)', r'two-phase|batch|next day'),
        ('Role / second login required', r'role|org admin|inspector login|view-only|supplier_'),
        ('Approval required (shared or irreversible data)', r'approval|cannot be undone|same as nav-08|would be deleted|changes the shared|changes organisations|shared roles|real bank question'),
        ('Requirement unclear (user triage)', r'triage|requirement'),
        ('Test data / configuration missing', r'needs a sample|no second project|run npm run|not yet assigned|set scp_|no active project|needs an|needs a working|data created|week fields'),
        ('Known defect prevents the action', r'scp-def-'),
        ('Automation not written yet', r'not automated|not written|not in this pass|cross-module|api endpoint|manual'),
    ]
    for name, pattern in rules:
        if re.search(pattern, r):
            return name
    return 'Other'

NEXT_ACTION = {
    'Covered by another scenario': 'None – verified inside the referenced scenario.',
    'Prerequisite failed': 'Fix or triage the failed prerequisite, then re-run the dependent chain.',
    'External system / mailbox': 'Run manually or provide a test double / approved external access.',
    'Two-phase batch (next day)': 'Seed today and verify after the 05:00–06:00 IST batch on the next day.',
    'Role / second login required': 'Provide approved role accounts (Supplier, Subcontractor, Org Admin, view-only).',
    'Approval required (shared or irreversible data)': 'Obtain product-owner approval or a disposable project.',
    'Requirement unclear (user triage)': 'Product owner to confirm the requirement, then automate.',
    'Test data / configuration missing': 'Provide the named test data / environment variable.',
    'Known defect prevents the action': 'Retest after the referenced defect is fixed.',
    'Automation not written yet': 'Write the automation (planned backlog).',
    'Suite not yet executed': 'Wait for / re-run the suite.',
    'Other': 'Review reason and plan.',
}

def load_known_defects():
    js = ("const {KNOWN_DEFECTS}=require('./config/scp-known-defects.js');"
          "console.log(JSON.stringify(KNOWN_DEFECTS.map(d=>({...d,title:String(d.title),signature:String(d.signature||'')}))))")
    out = subprocess.run(['node', '-e', js], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=True)
    return json.loads(out.stdout)

def load_app_map():
    path = os.path.join(ROOT, 'docs', 'functional-discovery', 'APP_MAP_SWEEP.md')
    rows = []
    for line in open(path, encoding='utf-8'):
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        if len(cells) == 4 and cells[1].startswith(('`', '**`')) and cells[0] != 'Menu':
            rows.append({'menu': cells[0], 'route': cells[1].replace('`', '').replace('*', ''),
                         'content': cells[2].replace('`', '').replace('**', ''), 'rows': cells[3]})
    return rows

# Regression cases proposed on 3 Nov 2026 for pages that only have smoke coverage (AUTOMATION_PROGRESS §6 item 4).
# BOM Validation is not listed: its regression case is registered as DOC-REG-12 (skipped, needs a sample BOM).
PROPOSED = [('Enterprise', 'Enterprise > Supplier Performance', 2), ('Enterprise', 'Enterprise > Lead Time Benchmarks', 2),
            ('Analytics', 'Analytics > Lead Time Analysis', 1), ('Analytics', 'Analytics > Supplier Issues', 3),
            ('Analytics', 'Analytics > Aggregate Stats', 2), ('Analytics', 'Analytics > Supply Chain Intelligence', 2),
            ('Analytics', 'Analytics > Emissions Report', 2), ('Analytics', 'Analytics > Inventory Reports', 2)]

EXCLUDED = [
    ('User Management', 'Roles', 'Supplier / Subcontractor / view-only role journeys', 'Inaccessible',
     'Needs approved role accounts; only the Project Admin account is configured for regression.'),
    ('Administration', 'Super Admin / Org Admin portal', 'Organisation administration app', 'Inaccessible',
     'Separate application and login; not in the approved scope.'),
    ('Document Management', 'Spec Documents', 'Send to TheLink', 'Not Testable',
     'Pushes to an external system (TheLink); not executed without approval.'),
    ('Document Management', 'EPD Report', 'Scan Procore for EPDs', 'Not Testable',
     'Calls Procore (external system); excluded by product-owner rule.'),
    ('Management Dashboard', 'Alerts', 'Daily alert batch (05:00–06:00 IST) outcomes', 'Not Testable',
     'Two-phase check across days; cannot be verified inside a single run.'),
    ('Project Management', 'Sub-Contractors', 'Sub-Contractors PDF upload', 'Not Testable',
     'No approved sample file / not automated.'),
    ('Analytics', 'Supply Chain Intelligence', 'Dismiss / Dismiss all disruptions', 'Not Testable',
     'Irreversible on the shared project; excluded without approval.'),
    ('Analytics', 'Emissions Report', 'Auto-Generate Emissions', 'Not Testable',
     'Changes shared data; excluded without approval.'),
]

def latest_run():
    runs = sorted(d for d in glob.glob(os.path.join(ROOT, 'reports', 'full-regression-2*')) if os.path.isdir(d)
                  and re.search(r'full-regression-\d{4}-\d{2}-\d{2}T', d))
    return runs[-1] if runs else None

def suite_dir_for(run_start, suite, entry):
    if entry and entry.get('reportDir') and os.path.isdir(entry['reportDir']):
        return entry['reportDir']
    start = parse_ts(run_start)
    cands = []
    for d in glob.glob(os.path.join(PM_DIR, f'{suite}-*')):
        m = re.search(r'-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)$', d)
        if not m:
            continue
        t = dt.datetime.strptime(m.group(1), '%Y-%m-%dT%H-%M-%S-%fZ').replace(tzinfo=dt.timezone.utc)
        if start and t >= start.astimezone(dt.timezone.utc):
            cands.append(d)
    return sorted(cands)[-1] if cands else None

def baseline_scenarios(suite, run_start):
    """Scenario list of the suite's most recent complete run before this regression started."""
    start = parse_ts(run_start).astimezone(dt.timezone.utc)
    # Prefer the suite as recorded by the latest earlier full regression (holds merged/complete suite results).
    for plan_path in sorted(glob.glob(os.path.join(ROOT, 'reports', 'full-regression-*', 'suites.json')),
                            key=os.path.getmtime, reverse=True):
        try:
            prior = json.load(open(plan_path, encoding='utf-8'))
        except Exception:
            continue
        if parse_ts(prior.get('startedAt')) and parse_ts(prior['startedAt']).astimezone(dt.timezone.utc) >= start:
            continue
        for e in prior.get('suites', []):
            p = os.path.join(e.get('reportDir') or '', 'results.json')
            if e.get('suite') == suite and e.get('reportDir') and os.path.exists(p):
                try:
                    return json.load(open(p, encoding='utf-8')).get('scenarios', [])
                except Exception:
                    pass
    best = None
    for d in glob.glob(os.path.join(PM_DIR, f'{suite}-*', 'results.json')):
        m = re.search(r'-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)[\\/]', d)
        if not m:
            continue
        t = dt.datetime.strptime(m.group(1), '%Y-%m-%dT%H-%M-%S-%fZ').replace(tzinfo=dt.timezone.utc)
        if t < start and (best is None or t > best[0]):
            try:
                data = json.load(open(d, encoding='utf-8'))
            except Exception:
                continue
            if data.get('finishedAt'):
                best = (t, data.get('scenarios', []))
    return best[1] if best else []

RECORD_RE = re.compile(r'\b(?:[A-Z]{2,5}\d{10}(?:-[A-Z0-9]+)*|SUB-\d{3,6}|PLD\d{4}-SUB-\d{2})\b')
QUOTED_RE = re.compile(r'"([^"]{1,80})"')

def convert_steps(scn, tc_id, module, suite, d, user, envtxt, prefix='S', execution='Run 1'):
    steps, evidence = [], []
    for i, s in enumerate(scn.get('steps', []), 1):
        name = clean(s.get('name'), 600)
        action, _, expected = name.partition(' → ')
        attempts = s.get('attempts') or []
        errs = [a.get('error') for a in attempts if a.get('error')]
        shots = [a.get('screenshot') for a in attempts if a.get('screenshot')]
        sstat = {'Passed': 'PASS', 'Failed': 'FAIL', 'Known Defect': 'FAIL', 'Blocked': 'BLOCKED',
                 'Skipped': 'SKIPPED'}.get(s.get('status'), 'NOT EXECUTED')
        observed = clean(s.get('reason'), 500)
        if sstat == 'PASS':
            actual = observed or 'Expected result observed (assertion passed).'
        elif sstat == 'FAIL':
            actual = (first_line(errs[-1]) if errs else '') + (f' | {observed}' if observed else '')
        else:
            actual = observed or 'Not reached.'
        records = sorted(set(RECORD_RE.findall(name + ' ' + observed)))
        step_id = f'{tc_id}-{prefix}{i:02d}'
        shot_path = os.path.relpath(os.path.join(d, shots[-1]), ROOT) if shots and d else ''
        steps.append({
            'tc': tc_id, 'step': step_id, 'module': module, 'screen': screen_of(scn), 'scenario': clean(scn.get('title'), 200),
            'action': action.strip(), 'data': '; '.join(dict.fromkeys(QUOTED_RE.findall(name)))[:300],
            'expected': expected.strip() or 'Action completes without error.', 'actual': actual, 'status': sstat,
            'start': fmt_ts(s.get('startedAt')), 'duration': round((s.get('durationMs') or 0) / 1000, 1),
            'user': user, 'env': envtxt, 'evidence': shot_path, 'records': ', '.join(records),
            'retries': max(len(attempts) - 1, 0), 'defect': s.get('defect') or '',
            'failure': first_line(errs[-1]) if errs and sstat != 'PASS' else '', 'execution': execution,
        })
        if shot_path:
            evidence.append({'type': 'Screenshot', 'suite': suite, 'tc': tc_id, 'step': step_id, 'path': shot_path,
                             'record': ', '.join(records), 'note': f'{execution} {sstat}: {action.strip()[:110]}'})
    return steps, evidence

def collect(run_dir):
    plan = json.load(open(os.path.join(run_dir, 'suites.json'), encoding='utf-8'))
    run_id = os.path.basename(run_dir)
    entries = {e['suite']: e for e in plan.get('suites', [])}
    order = list(SUITE_TITLES)
    cases, steps, evidence, suites = [], [], [], []
    seen_ids = set()
    for suite in order:
        entry = entries.get(suite)
        d = suite_dir_for(plan['startedAt'], suite, entry) if entry else None
        res_path = os.path.join(d, 'results.json') if d else None
        res = None
        if res_path and os.path.exists(res_path):
            try:
                res = json.load(open(res_path, encoding='utf-8'))
            except json.JSONDecodeError:
                res = None  # being written right now
        finished = bool(entry and entry.get('finishedAt'))
        state = 'Completed' if finished else ('Running' if entry else 'Not started')
        suites.append({'suite': suite, 'title': SUITE_TITLES[suite], 'state': state, 'dir': d, 'result': res,
                       'entry': entry or {}})
        scenarios = list((res or {}).get('scenarios', []))
        if state != 'Completed':
            # Suite not finished: list the scenarios it still has to run (from its last earlier run) as NOT EXECUTED.
            base = baseline_scenarios(suite, plan['startedAt'])
            have = {s['id'] for s in scenarios}
            for b in base:
                if b['id'] not in have:
                    scenarios.append({**{k: b.get(k) for k in ('id', 'module', 'submodule', 'title', 'navPath')},
                                      'status': None, 'steps': [], '_baseline_status': b.get('status'),
                                      'reason': b.get('reason') if b.get('status') == 'Skipped' else 'Suite not yet executed in this run'})
        if not scenarios:
            continue
        res = res or {}
        env = res.get('environment', {})
        user = f"{env.get('account', '')} ({env.get('role', '')})"
        envtxt = f"{env.get('baseUrl', '')} · project {env.get('project', '')}"
        for vid in ('run.mp4', 'e2e-run.mp4', 'report.html'):
            if d and os.path.exists(os.path.join(d, vid)):
                evidence.append({'type': 'Video' if vid.endswith('mp4') else 'HTML report', 'suite': suite, 'tc': '',
                                 'step': '', 'path': os.path.relpath(os.path.join(d, vid), ROOT), 'record': '',
                                 'note': f'{SUITE_TITLES[suite]} – full suite {"recording" if vid.endswith("mp4") else "report"}'})
        for scn in scenarios:
            native = scn.get('status') or ''
            # A scenario without a status in an unfinished suite has not run yet.
            status = STATUS_MAP.get(native, 'NOT EXECUTED')
            reason = clean(scn.get('reason'), 400)
            auto_native = native or scn.get('_baseline_status') or ''  # automation exists independently of this run
            covered = auto_native == 'Skipped' and bool(COVERED_ELSEWHERE.search(reason))
            automated = auto_native in ('Passed', 'Failed', 'Known Defect', 'Blocked') or covered
            basis = ('Executable automation' if auto_native in ('Passed', 'Failed', 'Known Defect', 'Blocked')
                     else 'Verified inside another automated scenario' if covered
                     else f'Registered, not automated: {skip_category(reason)}' if auto_native == 'Skipped'
                     else 'Registered; result pending')
            module = norm_module(scn, suite)
            tc_id = scn['id'] if scn['id'] not in seen_ids else f"{scn['id']} ({suite})"  # same ID reused by another suite
            seen_ids.add(scn['id'])
            defect_ids = sorted(set((scn.get('defects') or []) + [s.get('defect') for s in scn.get('steps', []) if s.get('defect')]))
            failure = ''
            if status == 'FAIL':
                bad = next((s for s in scn.get('steps', []) if s.get('status') not in ('Passed', None)), None)
                if bad:
                    errs = [a.get('error') for a in bad.get('attempts', []) if a.get('error')]
                    failure = first_line(errs[-1]) if errs else clean(bad.get('reason'), 300)
            st_list = scn.get('steps', [])
            cases.append({
                'tc': tc_id, 'module': module, 'screen': screen_of(scn), 'category': scn.get('submodule') or '',
                'title': clean(scn.get('title'), 300), 'suite': suite, 'priority': priority_of(scn.get('submodule'), suite),
                'documented': 'Y', 'automated': 'Y' if automated else 'N', 'basis': basis, 'planned': 'Y',
                'executed': 'Y' if status in ('PASS', 'FAIL') else 'N', 'status': status, 'native': native or 'Pending',
                'defects': ', '.join(defect_ids), 'reason': reason, 'failure': failure, 'steps': len(st_list),
                'steps_passed': sum(1 for s in st_list if s.get('status') == 'Passed'),
                'duration': round((scn.get('durationMs') or 0) / 1000, 1), 'start': fmt_ts(scn.get('startedAt')),
                'end': fmt_ts(scn.get('finishedAt')), 'run': run_id,
            })
            st, ev = convert_steps(scn, tc_id, module, suite, d, user, envtxt)
            steps += st; evidence += ev
    return plan, run_id, suites, cases, steps, evidence

def merge_rerun(rerun_dir, cases, steps, evidence, regress=None, n=1):
    """Apply a re-run of failed cases: originally failed cases take the re-run verdict; both executions keep their steps."""
    plan = json.load(open(os.path.join(rerun_dir, 'suites.json'), encoding='utf-8'))
    rr_id = os.path.basename(rerun_dir.rstrip('/\\'))
    by_key = {(c['suite'], c['tc'].split(' (')[0]): c for c in cases}
    for c in cases:  # first re-run records the base status; later re-runs keep it
        c.setdefault('orig_status', c['status']); c.setdefault('rr_status', ''); c.setdefault('rr_run', '')
    regress = {} if regress is None else regress
    summary = {'suites': [], 'regressions': regress, 'run': rr_id}
    for e in plan.get('suites', []):
        p = os.path.join(e.get('reportDir') or '', 'results.json')
        if not e.get('reportDir') or not os.path.exists(p):
            summary['suites'].append({**e, 'state': 'not run'})
            continue
        res = json.load(open(p, encoding='utf-8'))
        env = res.get('environment', {})
        user = f"{env.get('account', '')} ({env.get('role', '')})"
        envtxt = f"{env.get('baseUrl', '')} · project {env.get('project', '')}"
        failed = set(e.get('failed', []))
        summary['suites'].append({**e, 'state': 'done', 'summary': res.get('summary', {})})
        seen = set()
        for scn in res.get('scenarios', []):
            c = by_key.get((e['suite'], scn['id']))
            if not c:
                continue
            seen.add(scn['id'])
            new = STATUS_MAP.get(scn.get('status') or '', 'NOT EXECUTED')
            if scn['id'] not in failed:
                if c['orig_status'] == 'PASS' and new == 'FAIL':
                    regress[c['tc']] = f"{c['tc']} ({c['module']}): passed on the base run, failed in {rr_id}"
                elif new == 'PASS':
                    regress.pop(c['tc'], None)  # a later re-run passed it again
                continue
            c['rr_status'], c['rr_run'] = new, rr_id
            # Final verdict = latest execution.
            c['status'], c['native'] = new, scn.get('status') or 'Pending'
            c['executed'] = 'Y' if new in ('PASS', 'FAIL') else 'N'
            c['defects'] = ', '.join(sorted(set((scn.get('defects') or []) + [x.get('defect') for x in scn.get('steps', []) if x.get('defect')])))
            c['failure'] = ''
            if new == 'FAIL':
                bad = next((x for x in scn.get('steps', []) if x.get('status') not in ('Passed', None)), None)
                if bad:
                    errs = [a.get('error') for a in bad.get('attempts', []) if a.get('error')]
                    c['failure'] = first_line(errs[-1]) if errs else clean(bad.get('reason'), 300)
            if new not in ('PASS', 'FAIL'):
                c['reason'] = clean(scn.get('reason'), 400) or 'Not reached on the re-run'
            c['steps'] = len(scn.get('steps', []))
            c['steps_passed'] = sum(1 for x in scn.get('steps', []) if x.get('status') == 'Passed')
            c['duration'] = round((scn.get('durationMs') or 0) / 1000, 1)
            c['start'], c['end'], c['run'] = fmt_ts(scn.get('startedAt')), fmt_ts(scn.get('finishedAt')), rr_id
            st, ev = convert_steps(scn, c['tc'], c['module'], e['suite'], e['reportDir'], user, envtxt, prefix=f'RR{n}-S', execution=f'Re-run {n}')
            steps += st
            evidence += ev
        for f in failed - seen:  # selected but never reached (e.g. a guard skipped it): keep the base verdict
            c = by_key.get((e['suite'], f))
            if c and not c['rr_status']:
                c['rr_status'], c['rr_run'] = 'NOT EXECUTED', rr_id
    return summary

def build_defects(cases, steps, known):
    by_def = collections.defaultdict(list)
    for c in cases:
        for d in filter(None, c['defects'].split(', ')):
            by_def[d].append(c)
    step_by_tc = collections.defaultdict(list)
    for s in steps:
        step_by_tc[s['tc']].append(s)
    rows = []
    for k in known:
        linked = by_def.get(k['id'], [])
        fsteps = [s for c in linked for s in step_by_tc[c['tc']] if s['defect'] == k['id'] or s['status'] == 'FAIL']
        fs = fsteps[0] if fsteps else None
        modules = k.get('modules') or ['']
        rows.append({
            'id': k['id'], 'kind': 'Registered (confirmed by team)', 'module': norm_module({'module': modules[0]}, ''),
            'sub': fs['screen'] if fs else '', 'feature': k['title'][:120], 'title': k['title'][:200],
            'desc': k['summary'], 'pre': 'Staging, project NRVC_Hall, Project Admin account.',
            'repro': ' → '.join(s['action'] for s in step_by_tc[linked[0]['tc']][:8]) if linked else 'See description.',
            'expected': fs['expected'] if fs else 'See description.', 'actual': fs['actual'] if fs else 'See description.',
            'severity': 'Unassigned', 'priority': 'Unassigned', 'tcs': ', '.join(c['tc'] for c in linked),
            'steps': ', '.join(s['step'] for s in fsteps), 'evidence': fs['evidence'] if fs else '',
            'error': fs['failure'] if fs else '', 'first': k.get('recordedOn', ''), 'status': 'Open',
            'retest': f'Reproduced in this run ({len(linked)} scenario(s))' if linked else 'Not reproduced / not exercised in this run',
            'remarks': f"Detection signature: {k.get('signature', '')[:200]}",
        })
    # Failures with no registered defect: grouped by the observation ID quoted in the failure, else one per scenario.
    groups = collections.OrderedDict()
    for c in cases:
        if c['status'] == 'FAIL' and not c['defects']:
            obs = re.search(r'\bOBS-[A-Z]+-\d+', c['failure'] + ' ' + c['reason'])
            groups.setdefault((c['module'], obs.group(0) if obs else c['tc']), []).append(c)
    stamp = dt.date.today().strftime('%Y%m%d')
    for n, ((module, key), linked) in enumerate(groups.items(), 1):
        fsteps = [s for c in linked for s in step_by_tc[c['tc']] if s['status'] == 'FAIL']
        fs = fsteps[0] if fsteps else None
        rows.append({
            'id': f'CAND-{stamp}-{n:03d}', 'kind': 'Candidate – needs triage (unconfirmed)', 'module': module,
            'sub': linked[0]['screen'], 'feature': linked[0]['title'], 'title': (fs['failure'] if fs else linked[0]['failure'])[:200] or linked[0]['title'],
            'desc': f"Regression failure not matched to a registered defect{f' (observation {key})' if key.startswith('OBS-') else ''}. "
                    'Not yet classified as application defect, test-data issue, environment issue or automation failure.',
            'pre': 'Staging, project NRVC_Hall, Project Admin account.',
            'repro': ' → '.join(s['action'] for s in step_by_tc[linked[0]['tc']][:8]),
            'expected': fs['expected'] if fs else '', 'actual': fs['actual'] if fs else linked[0]['failure'],
            'severity': 'Unassigned', 'priority': 'Unassigned', 'tcs': ', '.join(c['tc'] for c in linked),
            'steps': ', '.join(s['step'] for s in fsteps), 'evidence': fs['evidence'] if fs else '',
            'error': fs['failure'] if fs else '', 'first': linked[0]['start'], 'status': 'Needs triage',
            'retest': 'Failed in this run', 'remarks': 'Confirm with a manual reproduction before registering as a defect.',
        })
    order = {m: i for i, m in enumerate(MODULE_ORDER)}
    rows.sort(key=lambda r: (order.get(r['module'], 99), r['kind'] != 'Registered (confirmed by team)', r['id']))
    return rows

def history_rows():
    rows = []
    for d in sorted(glob.glob(os.path.join(ROOT, 'reports', 'full-regression-*', 'suites.json')) +
                    glob.glob(os.path.join(ROOT, 'reports', 'rerun-failed-*', 'suites.json'))):
        try:
            plan = json.load(open(d, encoding='utf-8'))
        except Exception:
            continue
        run = os.path.basename(os.path.dirname(d))
        for e in plan.get('suites', []):
            res = None
            p = os.path.join(e.get('reportDir') or '', 'results.json')
            if e.get('reportDir') and os.path.exists(p):
                try:
                    res = json.load(open(p, encoding='utf-8'))
                except Exception:
                    pass
            s = (res or {}).get('summary', {})
            env = (res or {}).get('environment', {})
            rows.append([run, e.get('suite'), e.get('title') or SUITE_TITLES.get(e.get('suite'), ''), env.get('baseUrl', ''),
                         env.get('browser', ''), fmt_ts(e.get('startedAt')), fmt_ts(e.get('finishedAt')),
                         s.get('total'), s.get('passed'), s.get('failed'), s.get('knownDefects'), s.get('blocked'),
                         s.get('skipped'), e.get('exitCode'), clean(e.get('source') or e.get('note') or (f"Re-run of failed cases ({e.get('mode')}): {len(e.get('failed', []))} failed case(s) re-tested" if e.get('failed') else ''), 300)])
    return rows

# ---------------------------------------------------------------- workbook
HDR_FILL = PatternFill('solid', fgColor='1F3864'); HDR_FONT = Font(bold=True, color='FFFFFF')
TITLE_FONT = Font(bold=True, size=16, color='1F3864'); SUB_FONT = Font(bold=True, size=12, color='1F3864')
THIN = Side(style='thin', color='BFBFBF'); BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical='top')
STATUS_FILLS = {'PASS': 'C6EFCE', 'FAIL': 'FFC7CE', 'BLOCKED': 'FFEB9C', 'SKIPPED': 'D9D9D9', 'NOT EXECUTED': 'EDEDED'}

def table_sheet(wb, name, headers, rows, widths, status_col=None, wrap_cols=()):
    ws = wb.create_sheet(name)
    ws.append(headers)
    for r in rows:
        ws.append(r)
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    for cell in ws[1]:
        cell.fill, cell.font, cell.alignment = HDR_FILL, HDR_FONT, Alignment(wrap_text=True, vertical='center')
    ws.freeze_panes = 'A2'
    last = get_column_letter(len(headers))
    if rows:
        tname = re.sub(r'\W', '', name)
        t = Table(displayName=f'T_{tname}', ref=f'A1:{last}{len(rows) + 1}')
        t.tableStyleInfo = TableStyleInfo(name='TableStyleLight9', showRowStripes=True)
        ws.add_table(t)
        for col in wrap_cols:
            for c in ws[get_column_letter(col)][1:]:
                c.alignment = WRAP
        if status_col:
            colL = get_column_letter(status_col)
            for st, color in STATUS_FILLS.items():
                ws.conditional_formatting.add(f'{colL}2:{colL}{len(rows) + 1}',
                                              CellIsRule(operator='equal', formula=[f'"{st}"'], fill=PatternFill('solid', fgColor=color)))
    else:
        ws.auto_filter.ref = f'A1:{last}1'
    return ws

def build(run_dir, out_path, rerun_dirs=None):
    plan, run_id, suites, cases, steps, evidence = collect(run_dir)
    for st in steps:
        st.setdefault('execution', 'Run 1')
    known = load_known_defects()
    defects = build_defects(cases, steps, known)
    rerun = None
    for n, rd in enumerate(rerun_dirs or [], 1):
        r = merge_rerun(rd, cases, steps, evidence, rerun['regressions'] if rerun else None, n)
        rerun = {**r, 'run': (rerun['run'] + ' + ' if rerun else '') + r['run']}
    if rerun:
        rerun['regressions'] = list(rerun['regressions'].values())
        status_of = {c['tc']: c for c in cases}
        for d in defects:
            linked = [status_of[t] for t in filter(None, d['tcs'].split(', ')) if t in status_of and status_of[t].get('rr_status')]
            if not linked:
                continue
            still = [c['tc'] for c in linked if c['rr_status'] == 'FAIL']
            passed = [c['tc'] for c in linked if c['rr_status'] == 'PASS']
            other = [c['tc'] for c in linked if c['rr_status'] not in ('FAIL', 'PASS')]
            d['retest'] = '; '.join(x for x in [
                d.get('retest') or '',  # base-run result stays first (metric 6 counts "Reproduced*")
                f"Re-run: still failing ({', '.join(still)})" if still else '',
                f"Re-run: passed ({', '.join(passed)})" if passed else '',
                f"Re-run: not reached ({', '.join(other)})" if other else ''] if x)
            if d['kind'].startswith('Candidate') and passed and not still:
                d['status'] = 'Not reproduced on re-run'
                d['remarks'] = 'Failed on the base run, passed on the re-run: likely intermittent (timing, data or automation). Confirm before closing.'
            elif d['kind'].startswith('Registered') and passed and not still:
                d['remarks'] = 'Linked case passed on the re-run: check whether the defect was fixed before closing it. ' + d['remarks']
    # Proposed (identified, not documented in detail, not automated) scenarios.
    for module, screen, count in PROPOSED:
        tag = re.sub(r'[^A-Z]', '', screen.split('>')[-1].title())[:4]
        for i in range(1, count + 1):
            cases.append({'tc': f'PROP-{tag}-{i:02d}', 'module': module, 'screen': screen, 'category': 'Proposed regression',
                          'title': f'{screen.split(" > ")[-1]}: regression case {i} of {count} (page has smoke coverage only)',
                          'suite': '—', 'priority': 'P3', 'documented': 'N', 'automated': 'N',
                          'basis': 'Identified gap: proposed 3 Nov 2026, not written', 'planned': 'N', 'executed': 'N',
                          'status': 'NOT EXECUTED', 'native': 'Not automated', 'defects': '', 'reason': 'Automation not written yet',
                          'failure': '', 'steps': 0, 'steps_passed': 0, 'duration': 0, 'start': '', 'end': '', 'run': run_id,
                          'orig_status': 'NOT EXECUTED', 'rr_status': '', 'rr_run': ''})
    modules = [m for m in MODULE_ORDER if any(c['module'] == m for c in cases)]
    modules += sorted({c['module'] for c in cases} - set(modules))

    wb = Workbook()
    wb.remove(wb.active)
    exec_ws = wb.create_sheet('Executive Summary')

    # Sheet 2 – UI inventory
    navs = collections.defaultdict(list)
    for c in cases:
        navs[c['screen']].append(c)
    inv_rows, seen = [], set()
    def inv_add(module, sub, screen, route, ui, func, testability, remarks):
        cs = navs.get(screen, [])
        loaded = 'Y' if any(c['status'] in ('PASS', 'FAIL') for c in cs) else ('—' if not cs else 'N')
        inv_rows.append([module, sub, screen, route, ui, func, 'Project Admin', testability, len(cs),
                         sum(1 for c in cs if c['automated'] == 'Y'), loaded, remarks])
        seen.add(screen)
    for r in load_app_map():
        menu = r['menu'].replace('**', '')
        parts = [p.strip() for p in menu.split('>')]
        module = parts[0]
        screen = menu if len(parts) > 1 else menu
        if module == 'User Management' and len(parts) > 1 and parts[1] == 'User Management':
            screen = 'User Management'
        inv_add(norm_module({'module': module}, ''), parts[-1], screen, r['route'], r['content'],
                'Open page from the menu; read, filter, search and export as listed', 'Testable',
                f"Discovery sweep 2 Nov 2026 (rows seen: {r['rows']})")
    for screen, cs in sorted(navs.items()):
        if screen in seen or screen in ('—', ''):
            continue
        m = cs[0]['module']
        cats = sorted({c['category'] for c in cs if c['category']})
        inv_add(m, screen.split(' > ')[-1], screen, '', 'Forms, grids, actions exercised by the scenarios',
                'Scenario categories: ' + ', '.join(cats)[:300], 'Testable', 'Screen identified from the regression navigation paths')
    for module, sub, func, testability, remarks in EXCLUDED:
        inv_rows.append([module, sub, sub, '', func, func, 'Various', testability, 0, 0, '—', remarks])
    table_sheet(wb, 'UI Inventory', ['Module', 'Sub-module', 'Screen', 'Route', 'UI Elements', 'Available Functionality',
                                     'User Role', 'Testability', 'Scenario Count', 'Automated Scenarios',
                                     'Loaded in this run', 'Remarks'], inv_rows,
                [22, 24, 38, 26, 60, 50, 14, 14, 10, 11, 10, 50], wrap_cols=(5, 6, 12))

    # Sheet 4 – test cases (written before coverage so formulas reference it)
    tc_hdr = ['Test Case ID', 'Module', 'Sub-module / Screen', 'Category', 'Test Scenario', 'Suite', 'Priority',
              'Documented', 'Automated', 'Automation Basis', 'Planned', 'Executed', 'Status', 'Native Status',
              'Defect IDs', 'Skip / Block Reason', 'Failure Reason', 'Steps', 'Steps Passed', 'Duration (s)',
              'Started', 'Finished', 'Run ID', 'Base Run Status', 'Re-run Status', 'Re-run ID']
    tc_rows = [[c['tc'], c['module'], c['screen'], c['category'], c['title'], c['suite'], c['priority'], c['documented'],
                c['automated'], c['basis'], c['planned'], c['executed'], c['status'], c['native'], c['defects'],
                c['reason'], c['failure'], c['steps'], c['steps_passed'], c['duration'], c['start'], c['end'], c['run'],
                c.get('orig_status', c['status']), c.get('rr_status', ''), c.get('rr_run', '')]
               for c in cases]

    # Sheet 3 – coverage (formula-driven from 'Test Cases')
    cov = wb.create_sheet('Module Coverage')
    cov_hdr = ['Module', 'Identified', 'Documented', 'Automated', 'Planned', 'Executed', 'Passed', 'Failed', 'Blocked',
               'Skipped', 'Not Executed', 'Documentation Coverage', 'Automation Coverage', 'Execution Coverage', 'Pass %',
               'Defects (registered)', 'Defect candidates', 'Automation (n/d)', 'Execution (n/d)', 'Pass (n/d)', 'Status']
    cov.append(cov_hdr)
    TC = "'Test Cases'!"
    for i, m in enumerate(modules, 2):
        f = lambda col, val: f'COUNTIFS({TC}$B:$B,$A{i},{TC}${col}:${col},"{val}")'
        cov.append([m, f'=COUNTIFS({TC}$B:$B,$A{i})', '=' + f('H', 'Y'), '=' + f('I', 'Y'), '=' + f('K', 'Y'),
                    '=' + f('L', 'Y'), '=' + f('M', 'PASS'), '=' + f('M', 'FAIL'), '=' + f('M', 'BLOCKED'),
                    '=' + f('M', 'SKIPPED'), '=' + f('M', 'NOT EXECUTED'),
                    f'=IF(B{i}=0,0,C{i}/B{i})', f'=IF(B{i}=0,0,D{i}/B{i})', f'=IF(E{i}=0,0,F{i}/E{i})',
                    f'=IF(F{i}=0,0,G{i}/F{i})',
                    f"=COUNTIFS('Defect Register'!$C:$C,$A{i},'Defect Register'!$B:$B,\"Registered*\")",
                    f"=COUNTIFS('Defect Register'!$C:$C,$A{i},'Defect Register'!$B:$B,\"Candidate*\")",
                    f'=D{i}&" / "&B{i}', f'=F{i}&" / "&E{i}', f'=G{i}&" / "&F{i}',
                    f'=IF(E{i}=0,"NOT AUTOMATED",IF(F{i}=E{i},IF(H{i}=0,"COMPLETE – ALL PASS","COMPLETE – FAILURES"),IF(F{i}=0,"NOT EXECUTED","PARTIAL")))'])
    tot = len(modules) + 2
    cov.append(['TOTAL'] + [f'=SUM({get_column_letter(c)}2:{get_column_letter(c)}{tot - 1})' for c in range(2, 12)] +
               [f'=IF(B{tot}=0,0,C{tot}/B{tot})', f'=IF(B{tot}=0,0,D{tot}/B{tot})', f'=IF(E{tot}=0,0,F{tot}/E{tot})',
                f'=IF(F{tot}=0,0,G{tot}/F{tot})', f'=SUM(P2:P{tot - 1})', f'=SUM(Q2:Q{tot - 1})',
                f'=D{tot}&" / "&B{tot}', f'=F{tot}&" / "&E{tot}', f'=G{tot}&" / "&F{tot}', ''])
    for cell in cov[1]:
        cell.fill, cell.font, cell.alignment = HDR_FILL, HDR_FONT, Alignment(wrap_text=True, vertical='center')
    for cell in cov[tot]:
        cell.font = Font(bold=True)
    for r in range(2, tot + 1):
        for c in range(12, 16):
            cov.cell(r, c).number_format = '0.0%'
    for i, w in enumerate([26] + [10] * 10 + [13] * 4 + [11, 11, 14, 14, 14, 24], 1):
        cov.column_dimensions[get_column_letter(i)].width = w
    cov.freeze_panes = 'B2'
    cov.auto_filter.ref = f'A1:U{tot - 1}'
    cov.cell(tot + 2, 1, 'Sub-module coverage').font = SUB_FONT
    sub_hdr = ['Module', 'Sub-module / Screen', 'Identified', 'Automated', 'Planned', 'Executed', 'Passed', 'Failed',
               'Automation Coverage', 'Execution Coverage', 'Pass %']
    base = tot + 3
    for j, h in enumerate(sub_hdr, 1):
        c = cov.cell(base, j, h); c.fill, c.font = HDR_FILL, HDR_FONT
    pairs = sorted({(c['module'], c['screen']) for c in cases}, key=lambda p: (modules.index(p[0]), p[1]))
    for k, (m, s) in enumerate(pairs, base + 1):
        g = lambda col, val: f'=COUNTIFS({TC}$B:$B,$A{k},{TC}$C:$C,$B{k},{TC}${col}:${col},"{val}")'
        row = [m, s, f'=COUNTIFS({TC}$B:$B,$A{k},{TC}$C:$C,$B{k})', g('I', 'Y'), g('K', 'Y'), g('L', 'Y'), g('M', 'PASS'),
               g('M', 'FAIL'), f'=IF(C{k}=0,0,D{k}/C{k})', f'=IF(E{k}=0,0,F{k}/E{k})', f'=IF(F{k}=0,0,G{k}/F{k})']
        for j, v in enumerate(row, 1):
            cov.cell(k, j, v)
        for j in (9, 10, 11):
            cov.cell(k, j).number_format = '0.0%'

    table_sheet(wb, 'Test Cases', tc_hdr, tc_rows,
                [16, 22, 34, 18, 60, 14, 8, 10, 10, 36, 8, 9, 13, 13, 16, 40, 50, 7, 8, 9, 18, 18, 30, 13, 13, 30],
                status_col=13, wrap_cols=(5, 16, 17))
    st_hdr = ['Test Case ID', 'Step ID', 'Module', 'Sub-module / Screen', 'Test Scenario', 'Action Performed', 'Test Data Used',
              'Expected Result', 'Actual Result', 'Status', 'Executed At', 'Duration (s)', 'Active User / Role',
              'Environment', 'Evidence', 'Record IDs', 'Retry Count', 'Defect ID', 'Failure Reason', 'Execution']
    table_sheet(wb, 'Test Steps', st_hdr,
                [[s['tc'], s['step'], s['module'], s['screen'], s['scenario'], s['action'], s['data'], s['expected'],
                  s['actual'], s['status'], s['start'], s['duration'], s['user'], s['env'], s['evidence'], s['records'],
                  s['retries'], s['defect'], s['failure'], s['execution']] for s in steps],
                [16, 19, 20, 28, 40, 60, 30, 50, 55, 12, 18, 9, 30, 40, 50, 22, 8, 13, 50, 11], status_col=10, wrap_cols=(6, 8, 9))
    df_hdr = ['Defect ID', 'Type', 'Module', 'Sub-module', 'Feature', 'Defect Title', 'Detailed Description',
              'Preconditions', 'Reproduction Steps', 'Expected Result', 'Actual Result', 'Severity', 'Priority',
              'Environment', 'Browser', 'Test Case IDs', 'Test Step IDs', 'Evidence', 'Console / Error',
              'First Detected', 'Current Status', 'Retest Result', 'Remarks']
    browser = next((s['result'].get('environment', {}).get('browser') for s in suites if s['result']), '')
    base_url = next((s['result'].get('environment', {}).get('baseUrl') for s in suites if s['result']), '')
    table_sheet(wb, 'Defect Register', df_hdr,
                [[d['id'], d['kind'], d['module'], d['sub'], d['feature'], d['title'], d['desc'], d['pre'], d['repro'],
                  d['expected'], d['actual'], d['severity'], d['priority'], f'Staging {base_url}', browser, d['tcs'],
                  d['steps'], d['evidence'], d['error'], d['first'], d['status'], d['retest'], d['remarks']] for d in defects],
                [15, 22, 20, 26, 36, 50, 60, 30, 60, 40, 50, 11, 11, 30, 24, 24, 28, 45, 50, 18, 13, 30, 40], wrap_cols=(6, 7, 9, 10, 11))
    bs_rows = []
    for c in cases:
        if c['status'] in ('BLOCKED', 'SKIPPED', 'NOT EXECUTED'):
            cat = skip_category(c['reason']) if c['native'] != 'Pending' else 'Suite not yet executed'
            bs_rows.append([c['tc'], c['module'], c['screen'], c['title'], c['status'], c['reason'] or c['native'], cat,
                            NEXT_ACTION.get(cat, NEXT_ACTION['Other'])])
    table_sheet(wb, 'Blocked & Skipped', ['Test Case ID', 'Module', 'Sub-module / Screen', 'Test Scenario', 'Status', 'Reason',
                                          'Dependency Category', 'Recommended Next Action'], bs_rows,
                [16, 22, 30, 50, 13, 60, 32, 50], status_col=5, wrap_cols=(4, 6, 8))
    table_sheet(wb, 'Evidence Register', ['Evidence Type', 'Suite', 'Test Case ID', 'Step ID', 'Path (relative to SCP/)', 'Record IDs', 'Description'],
                [[e['type'], e['suite'], e['tc'], e['step'], e['path'], e['record'], e['note']] for e in evidence],
                [14, 16, 16, 19, 90, 24, 70])
    table_sheet(wb, 'Execution History', ['Run ID', 'Suite', 'Suite Title', 'Environment', 'Browser', 'Started', 'Finished',
                                          'Scenarios', 'Passed', 'Failed', 'Known Defects', 'Blocked', 'Skipped', 'Exit Code', 'Notes'],
                history_rows(), [36, 15, 34, 40, 26, 18, 18, 9, 8, 8, 10, 8, 8, 8, 60], wrap_cols=(15,))

    # Sheet 1 – executive summary (formulas only for metrics)
    ws = exec_ws
    ws.column_dimensions['A'].width = 48; ws.column_dimensions['B'].width = 18; ws.column_dimensions['C'].width = 22
    for col in 'DEFGHI':
        ws.column_dimensions[col].width = 16
    ws['A1'] = 'SCP Full Regression – Management Summary'; ws['A1'].font = TITLE_FONT
    done = sum(1 for s in suites if s['state'] == 'Completed')
    ws['A2'] = (f"Run {run_id} · staging {base_url} · project NRVC_Hall · Project Admin · {browser} · "
                f"suites completed {done}/{len(suites)} · workbook generated {dt.datetime.now():%Y-%m-%d %H:%M}")
    if rerun:
        ws['A2'] = ws['A2'].value + f" · failed cases re-run in {rerun['run']} (final status = latest execution)"
    ws['A2'].font = Font(italic=True, color='595959')
    C = "'Module Coverage'!"
    T = f'{tot}'
    D = "'Defect Register'!"
    metrics = [
        ('Overall regression status', f'=IF({C}F{T}={C}E{T},"COMPLETED",IF({C}F{T}>0,"PARTIALLY COMPLETED","NOT COMPLETED"))', None, None),
        ('1. SCP modules identified', f'=COUNTA({C}A2:A{tot - 1})', None, None),
        ('Total identified testable scenarios', f'={C}B{T}', None, None),
        ('Total documented scenarios', f'={C}C{T}', None, None),
        ('Total automated scenarios', f'={C}D{T}', None, None),
        ('Total planned scenarios (registered in suites)', f'={C}E{T}', None, None),
        ('Total executed scenarios', f'={C}F{T}', None, None),
        ('Total passed scenarios', f'={C}G{T}', None, None),
        ('Total failed scenarios', f'={C}H{T}', None, None),
        ('Total blocked scenarios', f'={C}I{T}', None, None),
        ('Total skipped scenarios', f'={C}J{T}', None, None),
        ('Total not executed scenarios', f'={C}K{T}', None, None),
        ('Total test steps recorded', "=COUNTA('Test Steps'!B:B)-1", None, None),
        ('2. UI inventory documentation coverage', f'={C}L{T}', f'={C}C{T}&" / "&{C}B{T}', 'pct'),
        ('3. Automation coverage', f'={C}M{T}', f'={C}D{T}&" / "&{C}B{T}', 'pct'),
        ('4. Execution coverage', f'={C}N{T}', f'={C}F{T}&" / "&{C}E{T}', 'pct'),
        ('5. Pass percentage', f'={C}O{T}', f'={C}G{T}&" / "&{C}F{T}', 'pct'),
        ('6. Registered defects reproduced in this run', f'=COUNTIFS({D}B:B,"Registered*",{D}V:V,"Reproduced*")', None, None),
        ('   New failures needing triage (defect candidates)', f'=COUNTIFS({D}B:B,"Candidate*")', None, None),
        ('   Registered known defects (all, open)', f'=COUNTIFS({D}B:B,"Registered*")', None, None),
        ('7. Critical / High defects open', f'=COUNTIFS({D}L:L,"Critical",{D}U:U,"<>Closed")+COUNTIFS({D}L:L,"High",{D}U:U,"<>Closed")', None, None),
        ('   Defects by severity: Critical / High / Medium / Low / Unassigned',
         f'=COUNTIF({D}L:L,"Critical")&" / "&COUNTIF({D}L:L,"High")&" / "&COUNTIF({D}L:L,"Medium")&" / "&COUNTIF({D}L:L,"Low")&" / "&COUNTIF({D}L:L,"Unassigned")', None, None),
        ('8. Modules with incomplete automation coverage', f'=COUNTIF({C}M2:M{tot - 1},"<1")&" of "&COUNTA({C}A2:A{tot - 1})', None, None),
        ('9. Scenarios outstanding (failed + blocked + skipped + not executed)', f'={C}H{T}+{C}I{T}+{C}J{T}+{C}K{T}', None, None),
    ]
    if rerun:
        metrics += [
            ('Re-run of failed cases: failed on the base run', f'=COUNTIF({TC}X:X,"FAIL")', None, None),
            ('   Re-run: passed', f'=COUNTIFS({TC}X:X,"FAIL",{TC}Y:Y,"PASS")', None, None),
            ('   Re-run: still failing', f'=COUNTIFS({TC}X:X,"FAIL",{TC}Y:Y,"FAIL")', None, None),
            ('   Re-run: blocked / not reached', f'=COUNTIFS({TC}X:X,"FAIL",{TC}Y:Y,"<>PASS",{TC}Y:Y,"<>FAIL")', None, None),
            ('   Registered defects still failing on re-run', f'=COUNTIFS({D}B:B,"Registered*",{D}V:V,"*Re-run: still failing*")', None, None),
            ('   Defect candidates not reproduced on re-run', f'=COUNTIFS({D}B:B,"Candidate*",{D}U:U,"Not reproduced on re-run")', None, None),
        ]
    ws['A4'] = 'Metric'; ws['B4'] = 'Value'; ws['C4'] = 'Numerator / Denominator'
    for c in ws[4][:3]:
        c.fill, c.font = HDR_FILL, HDR_FONT
    for r, (label, formula, nd, kind) in enumerate(metrics, 5):
        ws.cell(r, 1, label); ws.cell(r, 2, formula)
        if nd:
            ws.cell(r, 3, nd)
        if kind == 'pct':
            ws.cell(r, 2).number_format = '0.0%'
        for c in range(1, 4):
            ws.cell(r, c).border = BORDER
    ws['B5'].font = Font(bold=True, size=12)
    ws.conditional_formatting.add('B5', FormulaRule(formula=['B5="COMPLETED"'], fill=PatternFill('solid', fgColor='C6EFCE')))
    ws.conditional_formatting.add('B5', FormulaRule(formula=['B5<>"COMPLETED"'], fill=PatternFill('solid', fgColor='FFEB9C')))
    r0 = 5 + len(metrics) + 1
    ws.cell(r0, 1, 'Module-wise summary').font = SUB_FONT
    hdr = ['Module', 'UI Scenarios', 'Automation Coverage', 'Execution Coverage', 'Pass %', 'Registered Defects',
           'Defect Candidates', 'Status']
    for j, h in enumerate(hdr, 1):
        c = ws.cell(r0 + 1, j, h); c.fill, c.font = HDR_FILL, HDR_FONT; c.alignment = Alignment(wrap_text=True)
    for k, m in enumerate(modules):
        r, src = r0 + 2 + k, k + 2
        vals = [f'={C}A{src}', f'={C}B{src}', f'={C}M{src}', f'={C}N{src}', f'={C}O{src}', f'={C}P{src}', f'={C}Q{src}', f'={C}U{src}']
        for j, v in enumerate(vals, 1):
            cell = ws.cell(r, j, v); cell.border = BORDER
            if j in (3, 4, 5):
                cell.number_format = '0.0%'
    last = r0 + 1 + len(modules)
    for col in 'CDE':
        ws.conditional_formatting.add(f'{col}{r0 + 2}:{col}{last}', CellIsRule(operator='greaterThanOrEqual', formula=['0.9'], fill=PatternFill('solid', fgColor='C6EFCE')))
        ws.conditional_formatting.add(f'{col}{r0 + 2}:{col}{last}', CellIsRule(operator='between', formula=['0.6', '0.8999'], fill=PatternFill('solid', fgColor='FFEB9C')))
        ws.conditional_formatting.add(f'{col}{r0 + 2}:{col}{last}', CellIsRule(operator='lessThan', formula=['0.6'], fill=PatternFill('solid', fgColor='FFC7CE')))
    rr = last + 2
    ws.cell(rr, 1, '10. Outstanding testing and risks').font = SUB_FONT
    cats = collections.Counter(row[6] for row in bs_rows)
    notes = [f'{n} scenario(s): {cat} → {NEXT_ACTION.get(cat, "")}' for cat, n in cats.most_common()]
    if rerun:
        notes += [f'Re-run regression (base PASS, re-run FAIL): {r}' for r in rerun['regressions']] or ['Re-run: no previously passing case failed in the re-executed chains.']
    notes += ['Defect severity/priority is not recorded in the known-defect registry; it must be assigned by the team (shown as "Unassigned").',
              'Defect candidates are failures not yet triaged; they may be application defects, test-data, environment or automation issues.',
              'Excluded / inaccessible functionality is listed at the end of the UI Inventory sheet and is not counted as testable.']
    for i, n in enumerate(notes, rr + 1):
        ws.cell(i, 1, n).alignment = Alignment(wrap_text=False)
    dr = rr + len(notes) + 2
    ws.cell(dr, 1, 'Metric definitions').font = SUB_FONT
    defs = ['Identified = scenarios registered in the regression suites + regression cases proposed for smoke-only pages.',
            'Documented = scenario has a written title and step-level actions/expected results (proposed cases are not documented yet).',
            'Automated = executable automation ran, or the check is verified inside another automated scenario. Skipped cases waiting on approval, data, external systems or new code are NOT automated.',
            'Planned = registered in the regression suites for this run. Executed = reached a PASS/FAIL verdict. Known-defect results count as FAIL.',
            'Overall percentages are computed from totals, not averaged across modules.']
    for i, n in enumerate(defs, dr + 1):
        ws.cell(i, 1, n)
    ws.freeze_panes = 'A5'
    ws.sheet_view.showGridLines = False
    ws.page_setup.orientation = 'landscape'; ws.page_setup.fitToWidth = 1; ws.sheet_properties.pageSetUpPr.fitToPage = True

    wb.calculation.fullCalcOnLoad = True
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    tmp = out_path + '.tmp.xlsx'
    wb.save(tmp)
    try:
        os.replace(tmp, out_path)
    except PermissionError:
        alt = out_path.replace('.xlsx', f'_{dt.datetime.now():%H%M%S}.xlsx')
        os.replace(tmp, alt)
        out_path = alt
        print('Workbook is open in Excel; wrote', alt)
    return out_path, cases, steps, defects, suites

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--run'); ap.add_argument('--watch', type=float, default=0); ap.add_argument('--out'); ap.add_argument('--rerun', action='append', help='re-run folder; repeat to apply several in order (latest wins)')
    a = ap.parse_args()
    run_dir = os.path.abspath(a.run) if a.run else latest_run()
    if not run_dir:
        sys.exit('No reports/full-regression-* run found.')
    stamp = os.path.basename(run_dir)[len('full-regression-'):][:10].replace('-', '')
    rerun_dirs = [os.path.abspath(x) for x in a.rerun or []]
    if rerun_dirs:
        stamp = os.path.basename(rerun_dirs[-1].rstrip('/\\'))[len('rerun-failed-'):][:10].replace('-', '')
    out = a.out or os.path.join(ROOT, 'reports', 'management', f'SCP_Full_Regression_Management_Report_{stamp}.xlsx')
    while True:
        path, cases, steps, defects, suites = build(run_dir, out, rerun_dirs)
        c = collections.Counter(x['status'] for x in cases)
        print(f'[{dt.datetime.now():%H:%M:%S}] {path}: {len(cases)} cases, {len(steps)} steps, {dict(c)}, '
              f'{len(defects)} defect rows, suites done {sum(s["state"] == "Completed" for s in suites)}/{len(suites)}', flush=True)
        plan = json.load(open(os.path.join(run_dir, 'suites.json'), encoding='utf-8'))
        if not a.watch or plan.get('finishedAt'):
            break
        time.sleep(a.watch * 60)

if __name__ == '__main__':
    main()
