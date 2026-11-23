"""Read-only report generation: tracker XML + registered tests + preserved run evidence.

Run from SCP. No application queries, credentials, test execution or workbook writes.
"""
import collections
import csv
import json
import re
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / 'reports'
OUT = REPORTS / 'scp-pending-summary'
TRACKER = Path(r'C:\Users\VC\Downloads\AI Automation testing -Status Tracker (2).xlsx')
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

# Explicit workbook row mapping. A passing subset never closes a module.
# pattern, code, critical workflow, remaining acceptance/data requirements, priority
MAP = {
  2: (r'Dashboard:.*Alerts|Dashboard: required Alerts', 'tests/regression/management-dashboard/', 'Personal unread/read/all, charts, dates and archive configuration', 'Required Alert distribution/category/ageing charts; independent archived-event source; fresh-project default and second-user isolation', 'P1'),
  3: (r'Dashboard:.*Notifications', 'tests/regression/management-dashboard/', 'Personal record sets, pie/category reconciliation and date range', 'Ageing request date scope; independent archive source and second-user allocation', 'P1'),
  4: (r'Dashboard:.*Tasks', 'tests/regression/management-dashboard/', 'Task rendering, record sets, chart populations and dates', 'Task render crash; source/chart count mismatch; archive/status independence prerequisites', 'P1'),
  6: (r'Enterprise View:|Enterprise access:|Enterprise calculation:|Enterprise context:', 'tests/regression/enterprise/scp-enterprise-view.spec.js; tests/regression/enterprise/scp-enterprise-source-contracts.spec.js; tests/regression/enterprise/scp-enterprise-context-integration.spec.js', 'Summary, project/site context, refresh, spend, date-scoped CSV and independent Procurement reconciliation', 'Zero display contract; independent access/variance/OTD population fixtures; unsupported requested drill-down/search/report interfaces', 'P1'),
  7: (r'Supplier Inbox:', 'tests/regression/enterprise/scp-supplier-inbox*.spec.js', 'Section identities, qualification, project/material/supplier/Pending With filters and reset', 'Missing checklist component summary; truncated full-list requirement; role isolation/related-record navigation evidence', 'P1'),
  8: (r'Supplier Performance', 'tests/regression/enterprise/scp-supplier-performance.spec.js; tests/regression/enterprise/scp-enterprise-source-contracts.spec.js', 'Six KPI/table values and 6/12 month trends', 'Independent raw population/formula fixture; unavailable comparison/drill-down/export acceptance decisions', 'P1'),
  9: (r'Lead Time Benchmarks', 'tests/regression/enterprise/scp-lead-time-benchmarks.spec.js; tests/regression/enterprise/scp-enterprise-source-contracts.spec.js', 'Completed-only delivery KPIs, category averages, delta and sort', 'Zero averages rendered as dashes; independent client/platform/industry reference; missing-data status policy', 'P1'),
  12: (r'^UNMATCHED$', 'tests/regression/procurement-log/scp-procurement-log.spec.js; tests/support/procurement-log-flow.js', 'Create and Search exact submittal with project association', 'Existing workflow is partial; mandatory/boundary/status/role cases need dedicated relational data and acceptance rules', 'P0'),
  13: (r'^UNMATCHED$', 'tests/support/procurement-log-flow.js', 'Create exact related component, UOM, quantities and dates', 'Partial shared create flow; independent mandatory, business-boundary and edit cases remain', 'P0'),
  14: (r'^UNMATCHED$', 'tests/support/procurement-log-flow.js', 'Schedule/log delivery and verify exact component relationship', 'Partial shared flow; receiving/schedule/over-delivery/date/status rules and dedicated allocations remain', 'P0'),
  16: (r'fdiNotificationRecipients', 'tests/regression/first-delivery-inspections/; tests/smoke/first-delivery-inspections/', 'Inspection identity, form, photos, roles and recipient outcomes', 'Independent recipients/role allocations and product acceptance rules; never reuse SUB-2026-525; old tests can mutate and were not rerun here', 'P0'),
  18: (r'^UNMATCHED$', 'tests/smoke/international-shipments/; tests/regression/international-shipments/', 'Risk dashboard source identities and risk classification', 'Existing two cases cover partial functionality; independent risk/forecast definitions and dedicated records remain', 'P2'),
  19: (r'^UNMATCHED$', 'tests/regression/international-shipments/', 'Delay qualification and exact affected procurement records', 'Delay threshold/date-source fixtures and alert recipient rules not supplied', 'P2'),
  20: (r'^UNMATCHED$', 'tests/regression/international-shipments/', 'Flag/review state and persisted ownership', 'Dedicated mutation allocation/confirmed review rules; no new safe reconciliation oracle', 'P2'),
  21: (r'^UNMATCHED$', 'tests/smoke/international-shipments/', 'Shipment identity, scope and related procurement records', 'Existing partial read-only navigation; shipment lifecycle/source data rules remain', 'P2'),
  24: (r'^UNMATCHED$', 'tests/smoke/user-management/; tests/regression/user-management/scp-user-management.spec.js', 'User identities, permissions and persisted changes', 'Dedicated distinct role accounts/notification oracle; existing credentials cannot prove multi-user isolation', 'P2'),
  25: (r'^UNMATCHED$', 'tests/regression/user-management/supplier-list/scp-supplier-list.spec.js', 'Supplier identity and category/material/lead-time relationships', 'Existing partial mutable scenario; distinct validation rules and exclusive supplier allocations remain', 'P2'),
  27: (r'^UNMATCHED$', 'tests/regression/inventory-management/; tests/smoke/inventory-management/; test-data/bulk-upload/', 'Exact material/site, manual movements, balance history, Search, Procurement dates and bulk upload', 'Latest preserved Inventory result 14 Passed / 1 Failed; Add Activity calendar React crash remains; report consumption date/site fixture separate', 'P0'),
  29: (r'All Documents:', 'tests/regression/pending/scp-document-management.spec.js', 'Exact listed identities, project count, page metadata and no-match Search', 'Positive search/category/sort/page traversal and every supported download/content acceptance remain partial', 'P2'),
  30: (r'Spec Documents:', 'tests/regression/pending/scp-document-management.spec.js', 'Saved document/spec association and exact download filename/size', 'Existing specification download endpoint returns 404; positive document lifecycle requires dedicated files and supported rules', 'P1'),
  31: (r'po-validation:|poDocumentValidation', 'tests/regression/pending/scp-document-management.spec.js; tests/regression/pending/scp-independent-business-contracts.spec.js', 'Reject unsupported format before upload; independent PO reconciliation contract', 'Positive parse/mismatch validation requires approved source PO files and mapping rules; generic contract is not end-to-end coverage', 'P2'),
  32: (r'bom-validation:|bomDocumentValidation', 'tests/regression/pending/scp-document-management.spec.js; tests/regression/pending/scp-independent-business-contracts.spec.js', 'Reject unsupported format before upload; independent BOM reconciliation contract', 'Positive parse/mismatch validation requires approved BOM files and quantity/UOM matching rules', 'P2'),
  33: (r'Analytics: EPD|epdCarbonFactors', 'tests/regression/pending/scp-analytics.spec.js; tests/regression/pending/scp-independent-business-contracts.spec.js', 'EPD count/status distribution and displayed carbon totals', 'Current zero-data checks cannot prove positive carbon calculation; independent parsed EPD factors and report contents needed', 'P2'),
  40: (r'^UNMATCHED$', 'features/project-management/project-management-navigation.feature; features/step-definitions/common-utilities.steps.js', 'Reference utility Search, exact values and persistence', 'Existing Cucumber coverage partial; negative/permission/business acceptance incomplete; not rerun', 'P2'),
  41: (r'^UNMATCHED$', 'features/project-management/project-management-navigation.feature; features/step-definitions/reference-data.steps.js', 'UOM identity and material associations', 'Distinct unit/duplicate/conversion rules and dedicated mutable reference allocation remain', 'P2'),
  42: (r'^UNMATCHED$', 'features/project-management/project-management-navigation.feature; features/step-definitions/reference-data.steps.js', 'Category identities and related materials', 'Partial reference workflow; unique/duplicate/used-category rules and role oracle remain', 'P2'),
  44: (r'Dashboard: configured archive period', 'features/step-definitions/configuration-options.steps.js; tests/regression/management-dashboard/scp-management-dashboard-archive.spec.js', 'Read exact configured archive period and all supported values without saving', 'Fresh-project default, archive restoration and independent source population need isolated data', 'P1'),
  45: (r'^UNMATCHED$', 'tests/regression/first-delivery-inspections/scp-first-delivery-inspection-config.spec.js', 'Configured inspection requirements and role visibility', 'Preserved partial settings coverage; dedicated role/configuration allocations and notification source remain', 'P1'),
  46: (r'^UNMATCHED$', 'features/step-definitions/remaining-project-management.steps.js; pages/project-management/inventory-control.page.js', 'Inventory configuration and project/site rules', 'Existing partial settings coverage; configuration-boundary rules and isolated project needed', 'P1'),
  47: (r'^UNMATCHED$', 'pages/project-management/material-master.page.js; features/step-definitions/remaining-project-management.steps.js', 'Material identity/UOM/category associations', 'Existing partial create/search flow; complete distinct validation/edit/permission rules not supplied', 'P1'),
  48: (r'^UNMATCHED$', 'features/step-definitions/remaining-project-management.steps.js', 'Checklist definitions, required answers and delivery ownership', 'Existing partial settings flow; dedicated checklists and independent supplier/subcontractor role allocation needed', 'P1'),
  49: (r'Project Management: Bulk Upload Status', 'tests/regression/pending/scp-project-management-readonly.spec.js', 'Exact uploader/file identities and success/failure outcomes', 'Legacy null statuses with both success/failure files need confirmed mixed-result classification; complete pagination/download outcomes remain', 'P1'),
  50: (r'^UNMATCHED$', 'features/step-definitions/remaining-project-management.steps.js', 'Procurement configuration persistence and downstream effect', 'Existing partial setting workflow; exclusive project and field dependency acceptance remain', 'P1'),
  51: (r'^UNMATCHED$', 'features/step-definitions/remaining-project-management.steps.js; pages/site-selector.page.js', 'Exact site identities, project association and isolation', 'Partial navigation/settings coverage; exclusive site mutation/boundary fixtures needed', 'P1'),
  52: (r'Project Management: Submittal Manager', 'tests/regression/pending/scp-project-management-readonly.spec.js', 'Verify the currently supported submittal management surface', 'Deployed page is repurposed; replacement integration-specific workflows are explicitly excluded', 'P2'),
  54: (r'^UNMATCHED$', 'features/step-definitions/remaining-project-management.steps.js; pages/project-management/watched-materials.page.js', 'Per-user watch association and Dashboard reflection', 'Existing partial workflow; another user and independent notification/archival fixtures required', 'P2'),
  56: (r'Analytics: Aggregate Stats', 'tests/regression/pending/scp-analytics.spec.js', 'Exact selected-project aggregate counts and table', 'Independent source count reconciliation, date controls and exports not fully covered', 'P1'),
  57: (r'Lead Time Analysis:', 'tests/regression/pending/scp-lead-time-analysis.spec.js; pages/enterprise/lead-time-benchmarks.page.js', 'Analytics navigation, delivery metrics and shared benchmark category calculations', 'Actual deployed route shares Enterprise benchmark API and all-accessible-project scope; zero display/reference-data blockers apply', 'P1'),
  58: (r'supplyChainIntelligence', 'tests/regression/pending/scp-independent-business-contracts.spec.js', 'Independent disruption/risk source reconciliation', 'Approved disruption/risk formulas, source data and date/filter contracts absent; contract executor alone is not functional coverage', 'P2'),
  59: (r'Analytics: Emission|emissionsFactors', 'tests/regression/pending/scp-analytics.spec.js; tests/regression/pending/scp-independent-business-contracts.spec.js', 'Mode/submittal mass totals, distance and kg/tonne conversion', 'Current zero totals do not prove emission factors; independent positive transport data/factors and export content needed', 'P2'),
  60: (r'Analytics: Inventory Report|inventoryConsumption', 'tests/regression/pending/scp-analytics.spec.js; tests/regression/pending/scp-independent-business-contracts.spec.js', 'Project/site/material consumption and closing ledger balance', 'Allocated positive report material/site/date basis and independent movement source required', 'P1'),
  61: (r'Analytics: Status Report|statusClassification', 'tests/regression/pending/scp-analytics.spec.js; tests/regression/pending/scp-independent-business-contracts.spec.js', 'Returned quantities displayed under exact status headers', 'Independent status classification/date rules, filter/export validation remain', 'P1'),
  62: (r'Analytics: Subcontractor Issues|subcontractorIssues', 'tests/regression/pending/scp-analytics.spec.js; tests/regression/pending/scp-independent-business-contracts.spec.js', 'Grouped subcontractor/project issues, quantities and subtotals', 'Grouped/rowspan layout and missing quantity-cell alignment require investigation; independent issue definitions/source absent', 'P2'),
  63: (r'Analytics: Supplier Issues|supplierIssues', 'tests/regression/pending/scp-analytics.spec.js; tests/regression/pending/scp-independent-business-contracts.spec.js', 'Exact supplier/project issue identities and counts', 'Zero-valued source counts display as dashes; independent issue classifications, formatting contract and selected-project scope remain', 'P2'),
  64: (r'Analytics: Financial Forecast|financialForecastSource', 'tests/regression/pending/scp-analytics.spec.js; tests/regression/pending/scp-independent-business-contracts.spec.js', 'Payment percentages, timeline sums/cumulative values, summary cards and table', 'Independent underlying order/delivery/install/date/payment-term calculation rules and source fixture remain', 'P1'),
  65: (r'Analytics: Submittal Invoiced Orders|invoicedOrdersSource', 'tests/regression/pending/scp-analytics.spec.js; tests/regression/pending/scp-independent-business-contracts.spec.js', 'Exact quantities, monetary values and pending arithmetic', 'Independent source invoice/order rules, filters and export acceptance remain', 'P1'),
  66: (r'Analytics: Submittal Outflow Projection|outflowSource', 'tests/regression/pending/scp-analytics.spec.js; tests/regression/pending/scp-independent-business-contracts.spec.js', 'Received/pending values, weekly counts and balance arithmetic', 'Independent projection date/week/calendar/source rules, filters and exports remain', 'P1'),
}

def read_json(path):
    raw = path.read_bytes()
    return json.loads(raw.decode('utf-16') if raw.startswith(b'\xff\xfe') else raw.decode('utf-8-sig'))

def registrations():
    result = []
    def walk(node):
        result.extend({'title': s['title'], 'file': s['file']} for s in node.get('specs', []))
        for child in node.get('suites', []): walk(child)
    walk(read_json(REPORTS / 'scp-pending-registration.json'))
    return result

def enterprise_families(cases):
    plan = read_json(REPORTS / 'enterprise-analysis/scenario-matrix.json')
    # Complete-plan traceability includes gaps; API rendering is not independent
    # calculation coverage. Unimplemented controls are never silently marked Done.
    mapping = {
      'S01': 'Enterprise navigation:|Enterprise smoke:', 'S02': 'Enterprise smoke:',
      'S03': 'Enterprise access: exact', 'S04': 'Enterprise access: exact', 'S05': 'Enterprise access: exact',
      'S06': 'changing any available|Enterprise context:', 'E01': 'Enterprise access: exact', 'E02': 'independent Procurement open',
      'E03': 'on-time source reconciliation', 'E04': 'component-weighted Actual',
      'E05': 'cards, status totals', 'E06': 'supplier spend', 'E07': 'cards, status totals',
      'E08': 'category planned averages', 'E09': 'client/platform/industry',
      'E10': 'single-day range refreshes', 'E12': 'CSV exact business|single-day range refreshes',
      'I01': 'Supplier Inbox:.*summary, exact', 'I02': 'full-list requirement',
      'I03': 'Unconfirmed Lead Times summary', 'I04': 'Overdue Items summary',
      'I05': 'Deliveries to Schedule summary', 'I06': 'Pending Pre-Shipping Checklists summary',
      'I08': 'Supplier Inbox: exact', 'I09': 'deterministic no-match', 'I11': 'Pending With filter', 'I12': 'allocated exact component Open',
      'P01': 'Supplier Performance calculation: completed-only',
      'P02': 'Supplier Performance calculation: active/overdue', 'P03': 'Supplier Performance calculation: active/overdue',
      'P04': 'Supplier Performance calculation: active/overdue', 'P05': 'Supplier Performance calculation: active/overdue',
      'P06': 'Supplier Performance calculation: completed-only',
      'P07': 'six/twelve|six-month|6/12|month', 'P08': 'six/twelve|six-month|6/12|month',
      'P09': 'Supplier Performance: all KPI', 'P10': 'Supplier Performance: all KPI',
      'B01': 'completed, on-time, late|actual delivery averages', 'B02': 'completed, on-time, late|actual delivery averages',
      'B03': 'all category values|actual delivery averages',
      'B04': 'client/platform/industry', 'B05': 'client/platform/industry', 'B06': 'client/platform/industry',
      'B07': 'all category values|exact -1/\\+1', 'B08': 'client/platform/industry',
      'B09': 'client/platform/industry', 'B10': 'all category values', 'B11': 'sort both directions',
    }
    blocked_gaps = {'E11': 'Missing invalid/no-data date cases and a confirmed boundary/reset contract',
      'I07': 'Blocked: isolated enabled/disabled checklist configurations are not allocated',
      'I10': 'Blocked: required/expected date eligibility and inclusive boundary rules need confirmation',
      'B12': 'Blocked: incomplete-input and no-population benchmark display/status policy needs confirmation'}
    result = []
    for row in plan['rows']:
        ident = row['Scenario'].split(':')[0]
        matched = [c for c in cases if re.search(mapping.get(ident, '^UNMATCHED$'), c['title'])]
        status = 'Partially Implemented'
        if matched and any(c['status'] == 'Failed' for c in matched): status = 'Failed'
        elif matched and all(c['status'] == 'Blocked' for c in matched): status = 'Blocked'
        elif matched and all(c['status'] == 'Implemented but Unverified' for c in matched): status = 'Implemented but Unverified'
        elif ident in ('S01', 'S02', 'S06', 'E02', 'I11', 'I12') and matched and all(c['status'] == 'Passed' for c in matched): status = 'Verified Passed'
        elif not matched: status = 'Blocked' if blocked_gaps.get(ident, '').startswith('Blocked') else 'Missing'
        result.append(dict(row, **{'Current Coverage': status,
          'Current Evidence': [{'test': c['title'], 'status': c['status'], 'run': c['run']} for c in matched],
          'Remaining Limit': blocked_gaps.get(ident, 'Only the named assertions have evidence; independent populations, other branches and unavailable controls are not implied covered.')}))
    return result

def main():
    OUT.mkdir(exist_ok=True)
    latest = {}; runs = []
    for file in sorted(REPORTS.glob('scp-pending-*/coverage.json'), key=lambda p: p.stat().st_mtime):
        body = read_json(file)
        if 'scenarios' not in body: continue  # Exclude this script's consolidated output.
        runs.append({'directory': file.parent.name, 'counts': dict(collections.Counter(s['status'] for s in body['scenarios']))})
        for item in body['scenarios']:
            item = dict(item, run=file.parent.name)
            item['file'] = Path(item['file']).relative_to(ROOT / 'tests').as_posix()
            latest[(item['file'], item['title'])] = item
    cases = []
    for registered in registrations():
        case = latest.get((registered['file'], registered['title']))
        cases.append(case or dict(registered, status='Implemented but Unverified', errors=[], run=None))
    with zipfile.ZipFile(TRACKER) as archive:
        strings = [''.join(s.itertext()) for s in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('m:si', NS)]
        sheet = ET.fromstring(archive.read('xl/worksheets/sheet1.xml'))
        cells = {}
        for cell in sheet.findall('.//m:sheetData/m:row/m:c', NS):
            value = cell.find('m:v', NS)
            if value is not None: cells[cell.attrib['r']] = strings[int(value.text)] if cell.attrib.get('t') == 's' else value.text
    matrix = []; module = ''; submodule = ''
    for row in range(2, 67):
        if f'B{row}' in cells:
            module = cells[f'B{row}'].strip()
            submodule = module
        submodule = cells.get(f'C{row}', submodule).strip()
        if row not in MAP: continue
        pattern, code, workflow, gaps, priority = MAP[row]
        results = [case for case in cases if re.search(pattern, case['title'])]
        counts = collections.Counter(c['status'] for c in results)
        status = 'Failed' if counts['Failed'] else 'Blocked' if results and counts['Blocked'] == len(results) else 'Partially Implemented'
        if row == 27: status = 'Failed'
        evidence = '; '.join(f"{r['title']} = {r['status']} ({r['run'] or 'not executed'})" for r in results) or 'Preserved legacy coverage only; not re-executed in this read-only phase'
        if row == 27: evidence = 'reports/inventory-final-summary.md: 14 Passed / 1 Failed across exact full/recheck scenarios'
        matrix.append({'Tracker Row': row, 'Module': module, 'Submodule': cells.get(f'D{row}', submodule), 'Critical Workflow': workflow,
          'Existing Test': code, 'Coverage Status': status, 'Last Execution Evidence': evidence, 'Missing Steps': gaps,
          'Risk': 'High' if priority in ('P0', 'P1') else 'Medium', 'Priority': priority,
          'Tracker Smoke': cells.get(f'E{row}', 'blank'), 'Tracker Regression': cells.get(f'F{row}', 'blank')})
    assert len(matrix) == 47, len(matrix)
    counts = dict(collections.Counter(c['status'] for c in cases))
    output = {'scope': '47 non-red tracker rows; excluded rows 10,35-38,53 and Construction Delivery', 'registeredNewCases': len(cases), 'latestExactCaseCounts': counts, 'runs': runs, 'cases': cases, 'moduleMatrix': matrix}
    (OUT / 'coverage.json').write_text(json.dumps(output, indent=2), encoding='utf-8')
    (OUT / 'enterprise-family-traceability.json').write_text(json.dumps(enterprise_families(cases), indent=2), encoding='utf-8')
    finding_lines = ['# Remaining failures and blockers', '',
      'These are latest exact-case results, not complete module classifications. Native Playwright reports missing-data Blocked cases as non-passing; coverage.json distinguishes them. Historical harness failures remain in their original runs.', '']
    for status in ['Failed', 'Blocked', 'Implemented but Unverified']:
        finding_lines.extend([f'## {status}', ''])
        for case in cases:
            if case['status'] != status: continue
            error = re.sub(r'\x1b\[[0-9;]*m', '', '\n'.join(case.get('errors', [])))
            finding_lines.extend([f"### {case['title']}", '', f"Code: `{case['file']}`. Evidence: `{case.get('run') or 'not executed'}`.", '',
              '```text', error[:2200] or 'No execution evidence recorded.', '```', ''])
    (OUT / 'FINDINGS.md').write_text('\n'.join(finding_lines) + '\n', encoding='utf-8')
    with (OUT / 'module-matrix.csv').open('w', newline='', encoding='utf-8-sig') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(matrix[0])); writer.writeheader(); writer.writerows(matrix)
    scenario_matrix = []
    for case in cases:
        matching = [row for row in matrix if re.search(MAP[row['Tracker Row']][0], case['title'])]
        row = matching[0] if matching else None
        module = row['Module'] if row else 'Enterprise'
        submodule = row['Submodule'] if row else 'Shared scope'
        if case['file'].startswith('smoke/enterprise/'):
            module = 'Enterprise'; submodule = case['title'].split('Enterprise smoke: ')[1].split(' data and')[0]
        if case['title'].startswith('Enterprise context:'): submodule = 'Shared scope'
        if 'Enterprise calculator:' in case['title']: submodule = 'Calculator helper (not application coverage)'
        runtime = case['status']
        status = {'Passed': 'Verified Passed', 'Skipped': 'Implemented but Unverified'}.get(runtime, runtime)
        limitation = ('Only the exact executed assertions are verified. ' if runtime == 'Passed' else
          'Recorded failure/blocker must be resolved; later assertions may not have executed. ')
        if row: limitation += row['Missing Steps']
        scenario_matrix.append({'Module': module, 'Submodule': submodule, 'Critical Workflow': case['title'],
          'Test Type': 'Smoke' if case['file'].startswith('smoke/') else 'Regression',
          'Existing Test': f"tests/{case['file']}:{case.get('line', '')}", 'Coverage Status': status,
          'Last Execution Evidence': f"{case.get('run') or 'not executed'}/coverage.json; runtime {runtime}",
          'Missing Steps': limitation, 'Risk': row['Risk'] if row else 'High', 'Priority': row['Priority'] if row else 'P1'})
    with (OUT / 'scenario-matrix.csv').open('w', newline='', encoding='utf-8-sig') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(scenario_matrix[0])); writer.writeheader(); writer.writerows(scenario_matrix)
    lines = ['# SCP pending implementation and evidence', '',
      f"New registered cases: **{len(cases)}**. Latest result per exact case: **{counts}**. One case validates only calculator boundaries; these are not all distinct business workflows.", '',
      'Preserved baseline: 59 in-scope registered Playwright/Cucumber cases before these additions. New registrations do not establish complete application coverage. Tracker Done cells are historical labels only.', '',
      'Only guarded read-only tests were executed in this phase. Existing Inventory data-changing results are reported separately (14 Passed / 1 Failed). No module is declared complete.', '',
      '## Execution reports', '']
    for run in runs: lines.append(f"- [{run['directory']}](../{run['directory']}/html/index.html): {run['counts']}")
    lines += ['', '## Module-wise remaining work', '', '| Tracker row | Module / submodule | Current coverage | Critical workflow / remaining work | Priority |', '|---|---|---|---|---|']
    for r in matrix: lines.append(f"| {r['Tracker Row']} | {r['Module']} / {r['Submodule']} | {r['Coverage Status']} | {r['Critical Workflow']}. Remaining: {r['Missing Steps']} | {r['Priority']} |")
    lines += ['', 'Exact code mapping and execution evidence for every tracker row are in [module-matrix.csv](module-matrix.csv). New scenario-by-scenario mapping is in [scenario-matrix.csv](scenario-matrix.csv), with full results in [coverage.json](coverage.json). The older baseline is preserved separately, not reclassified as passed by these additions.', '',
      'Stabilize Inventory first: reproduce and fix the deployed Add Activity calendar crash, then rehearse the retained exact-material/site manual/bulk cases. Next stabilize Procurement relationships and dates, followed by FDI using dedicated records. Enterprise/Dashboard failures and missing independent source/account fixtures remain explicit; current credentials do not supply those oracles.', '',
      'Pending With correction: the deployed Inbox has buttons; the corrected button-filter scenario replaces the mistaken dropdown assumption. Analytics Lead Time Analysis shares the Enterprise benchmark API and explicitly covers all accessible projects. Historical failed runs remain preserved.', '',
      'Passed rendering/API consistency is separate from independent business calculation validation. Missing role accounts, archived-event sources, supplier/industry baselines, source documents and business formulas remain Blocked or partial. Generic source-contract infrastructure is not complete domain coverage.', '',
      'See [registered case/step counts](COUNTS.md), [remaining failures and blockers](FINDINGS.md), and [evidence integrity](QUALITY.md).']
    (OUT / 'README.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    enterprise_count = sum('/enterprise/' in c['file'] for c in cases)
    total_registered = 59 + len(cases)
    counts_text = [
      '# SCP registered cases and named steps', '',
      '| In-scope area | Registered cases |', '|---|---:|',
      '| Management Dashboard | 20 |', f'| Enterprise | {enterprise_count} |', '| Procurement Log | 1 |',
      '| First Delivery Inspection, settings and notification contract | 20 |',
      '| International Shipments | 2 |', '| User Management | 3 |', '| Supplier List | 1 |',
      '| Inventory Management, manual and bulk | 15 |', '| Document Management including EPD | 10 |',
      '| Project Management, Playwright and Cucumber | 16 |', '| Analytics including TOV | 20 |',
      '| SCP navigation | 3 |', f'| **Total** | **{total_registered}** |', '',
      f'Registration evidence: {47 + len(cases)} Playwright cases before exclusions; exclude two Setup Wizard cases = {45 + len(cases)}. Add 14 in-scope Cucumber scenarios = {total_registered}. Construction Delivery is outside these counts.', '',
      f'New guarded suite: {len(cases)} registered cases, including one calculator boundary case. The baseline also includes an FDI fixture guard. Registered cases are not all distinct business workflows and do not prove complete application coverage.', '',
      'Named step definition count: the previous baseline is up to 263; new fixed-loop calls contribute 14 (four Enterprise smoke steps, eight Inbox expand/collapse steps, two Enterprise summary/project steps). Combined planned total is **up to 277 named steps**. This counts explicit test.step/Gherkin groups, not every click, assertion, fixture, hook or trace action. Failed/blocked cases execute fewer steps.', '',
      f'The totals do not imply {total_registered} Passed or 277 executed steps. See coverage.json for current exact-case execution results; historical reports remain separate.'
    ]
    (OUT / 'COUNTS.md').write_text('\n'.join(counts_text) + '\n', encoding='utf-8')
    print(json.dumps({'rows': len(matrix), 'registered': len(cases), 'counts': counts}))

if __name__ == '__main__': main()
