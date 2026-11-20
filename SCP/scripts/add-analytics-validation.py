"""Add the Analytics validation sheets to the consolidated SCP regression workbook.

Usage:
  python scripts/add-analytics-validation.py --data reports/analytics-validation-20261118/analytics-validation.json \
      --workbook reports/management/SCP_Full_Regression_Management_Report_20261118.xlsx

Re-running replaces the Analytics sheets (idempotent). Coverage values are COUNTIFS formulas on 'Analytics Test Cases'.
Run it again after build-management-workbook.py, which rebuilds the workbook from scratch.
"""
import argparse, json, os, re
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.formatting.rule import CellIsRule

SHEETS = ['Analytics UI Inventory', 'Analytics Test Cases', 'Analytics Test Steps', 'Analytics Coverage',
          'Analytics Data Validation', 'Analytics Defect Register', 'Analytics Export Validation']
# Existing automated scenarios that cover a validation case (app-regression.spec.js).
AUTOMATED = {'ANA-SUB-05': 'ANA-REG-02 (updated 18 Nov: opens its own page, checks request + file)', 'ANA-STR-02': 'ANA-REG-03', 'ANA-TOV-01': 'ANA-REG-05 (updated 18 Nov: TOV group › Financial Forecast)'}
HDR = PatternFill('solid', fgColor='1F4E78')
FILL = {'PASS': 'C6EFCE', 'FAIL': 'FFC7CE', 'BLOCKED': 'FFEB9C', 'NOT EXECUTED': 'D9D9D9', 'High': 'FFC7CE', 'Medium': 'FFEB9C', 'Low': 'DDEBF7'}

def table(wb, name, header, rows, widths, color_col=None, tname=None):
    ws = wb.create_sheet(name)
    ws.append(header)
    for r in rows:
        ws.append(r)
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w
    for c in ws[1]:
        c.font = Font(bold=True, color='FFFFFF'); c.fill = HDR; c.alignment = Alignment(wrap_text=True, vertical='center')
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.alignment = Alignment(wrap_text=True, vertical='top')
    ws.freeze_panes = 'A2'
    t = Table(displayName=tname or 'T_' + re.sub(r'\W', '', name), ref=ws.dimensions)
    t.tableStyleInfo = TableStyleInfo(name='TableStyleMedium2', showRowStripes=True)
    ws.add_table(t)
    if color_col:
        col = openpyxl.utils.get_column_letter(color_col)
        for k, v in FILL.items():
            ws.conditional_formatting.add(f'{col}2:{col}{ws.max_row}', CellIsRule(operator='equal', formula=[f'"{k}"'], fill=PatternFill('solid', fgColor=v)))
    return ws

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--data', required=True); ap.add_argument('--workbook', required=True)
    a = ap.parse_args()
    d = json.load(open(a.data, encoding='utf-8')); m = d['meta']
    wb = openpyxl.load_workbook(a.workbook)
    for s in SHEETS:
        if s in wb.sheetnames:
            del wb[s]
    env = f"{m['environment']} · {m['project']} · venue {m['venue']}"
    sev = {x[0]: x[3] for x in d['defects'] if len(x) < 8}

    table(wb, SHEETS[0], ['Analytics Section', 'Sub-section', 'KPI / Chart / Table', 'Description', 'Data Source (API)',
                          'Calculation Logic (observed)', 'Filters', 'Export Support', 'Observations'],
          d['inventory'], [22, 14, 34, 34, 40, 44, 26, 26, 34])

    cases = []
    for tc, sec, scen, st, dref, actual in d['cases']:
        auto = AUTOMATED.get(tc, '')
        cases.append([tc, 'Analytics', sec, scen, 'Y', 'Y' if auto else 'N', auto, 'Y',
                      'Y' if st in ('PASS', 'FAIL') else 'N', st, dref, sev.get(dref, ''), actual, 'MCP (built-in browser) + API', m['date']])
    table(wb, SHEETS[1], ['Test Case ID', 'Module', 'Sub-module', 'Scenario', 'Documented', 'Automated', 'Automation Ref', 'Planned',
                          'Executed', 'Status', 'Defect ID', 'Severity', 'Actual Result / Evidence', 'Execution Method', 'Executed On'],
          cases, [13, 11, 24, 46, 11, 10, 22, 9, 9, 13, 14, 10, 52, 22, 12], color_col=10)

    steps = []
    for tc, sec, scen, st, dref, actual in d['cases']:
        steps.append([tc, f'{tc}-S01', sec, f'Open Analytics › {sec} with project NRVC_Hall and venue {m["venue"]}',
                      'Page loads with data for the selected project', 'Page loaded; requests captured', 'PASS', env, ''])
        steps.append([tc, f'{tc}-S02', sec, scen, 'As described by the scenario', actual, st, env, dref])
        if any(k in actual for k in ('API', '=', 'source', 'onClick', '→')):
            steps.append([tc, f'{tc}-S03', sec, 'Compare UI value with the API response / source records',
                          'UI = API = source', actual, st, env, dref])
    table(wb, SHEETS[2], ['Test Case ID', 'Step ID', 'Sub-module', 'Action', 'Expected Result', 'Actual Result', 'Status', 'Environment', 'Defect ID'],
          steps, [13, 16, 22, 50, 32, 52, 12, 40, 14], color_col=7)

    # Coverage (formulas)
    ws = wb.create_sheet(SHEETS[3]); TC = "'Analytics Test Cases'!"
    ws['A1'] = 'Analytics coverage (formulas on Analytics Test Cases)'; ws['A1'].font = Font(bold=True, size=13)
    ws['A2'] = f"{env} · {m['date']} · identified = documented validation scenarios of this pass. {m.get('decisions', '')}"; ws['A2'].font = Font(italic=True, color='595959')
    hdr = ['Sub-module', 'Identified', 'Documented', 'Automated', 'Planned', 'Executed', 'Passed', 'Failed', 'Blocked', 'Not Executed',
           'UI Inventory Coverage', 'Automation Coverage', 'Execution Coverage', 'Pass %']
    ws.append([]); ws.append(hdr)
    for c in ws[4]:
        c.font = Font(bold=True, color='FFFFFF'); c.fill = HDR; c.alignment = Alignment(wrap_text=True)
    secs = list(dict.fromkeys(x[1] for x in d['cases']))
    first = 5
    for i, s in enumerate(secs + ['TOTAL']):
        r = first + i
        if s == 'TOTAL':
            ws.append([s] + [f'=SUM({c}{first}:{c}{r - 1})' for c in 'BCDEFGHIJ'])
        else:
            f = lambda col, val: f'=COUNTIFS({TC}C:C,$A{r},{TC}{col}:{col},"{val}")'
            ws.append([s, f'=COUNTIFS({TC}C:C,$A{r})', f('E', 'Y'), f('F', 'Y'), f('H', 'Y'), f('I', 'Y'),
                       f('J', 'PASS'), f('J', 'FAIL'), f('J', 'BLOCKED'), f('J', 'NOT EXECUTED')])
        ws[f'K{r}'] = f'=IF(B{r}=0,"",C{r}/B{r})'; ws[f'L{r}'] = f'=IF(B{r}=0,"",D{r}/B{r})'
        ws[f'M{r}'] = f'=IF(E{r}=0,"",F{r}/E{r})'; ws[f'N{r}'] = f'=IF(F{r}=0,"",G{r}/F{r})'
        for col in 'KLMN':
            ws[f'{col}{r}'].number_format = '0.0%'
    for c in ws[ws.max_row]:
        c.font = Font(bold=True)
    tot = ws.max_row
    ws.append([])
    ws.append(['Counts behind each percentage'])
    ws[f'A{ws.max_row}'].font = Font(bold=True)
    for label, num, den in [('UI Inventory Coverage', 'C', 'B'), ('Automation Coverage', 'D', 'B'), ('Execution Coverage', 'F', 'E'), ('Pass %', 'G', 'F')]:
        ws.append([label, f'={num}{tot}&" / "&{den}{tot}'])
    ws.append([])
    ws.append(['Open defects by severity', 'High', 'Medium', 'Low'])
    ws[f'A{ws.max_row}'].font = Font(bold=True)
    D = "'Analytics Defect Register'!"
    ws.append(['Analytics defects', f'=COUNTIFS({D}E:E,"High",{D}P:P,"Open")', f'=COUNTIFS({D}E:E,"Medium",{D}P:P,"Open")', f'=COUNTIFS({D}E:E,"Low",{D}P:P,"Open")'])
    if d.get('proposed'):
        # The 12 proposed regression cases of the master workbook, executed through MCP via the linked validation cases.
        status_of = {x[0]: x[3] for x in d['cases']}
        ws.append([])
        ws.append(['Proposed case (master workbook)', 'Page', 'Scenario', 'Executed via', 'Result'])
        for c in ws[ws.max_row]:
            c.font = Font(bold=True, color='FFFFFF'); c.fill = HDR
        for pid, page_, scen, via in d['proposed']:
            sts = [status_of.get(v.strip(), 'NOT EXECUTED') for v in via.split(',')]
            res = 'FAIL' if 'FAIL' in sts else 'PASS' if all(s == 'PASS' for s in sts) else 'BLOCKED' if 'BLOCKED' in sts else 'NOT EXECUTED'
            ws.append([pid, page_, scen, via, res])
            ws.cell(ws.max_row, 5).fill = PatternFill('solid', fgColor=FILL.get(res, 'FFFFFF'))
        ws.column_dimensions['C'].width = 11
    ws.column_dimensions['A'].width = 30
    for col in 'BCDEFGHIJ':
        ws.column_dimensions[col].width = 11
    for col in 'KLMN':
        ws.column_dimensions[col].width = 14
    ws.freeze_panes = 'B5'

    table(wb, SHEETS[4], ['Section', 'Value', 'UI', 'API', 'Source / Recalculated', 'Comparison'], d['data'], [24, 34, 22, 26, 30, 20])

    cases_by_def = {}
    for x in d['cases']:
        if x[4]:
            cases_by_def.setdefault(x[4], []).append(x[0])
    ev = 'reports/analytics-validation-20261118/'
    drows = []
    for row in d['defects']:
        did, sec, title, s, desc, exp, act = row[:7]; status = row[7] if len(row) > 7 else 'Open'
        kind = 'Registered (confirmed by team)' if did.startswith('SCP-DEF') else 'New – needs triage'
        evidence = ev + ('subcontractor-export-evidence.txt; screenshots/ana-sub-*.jpg' if did in ('SCP-DEF-014', 'ANA-DEF-25')
                         else 'screenshots/ana-agg-project-id-instead-of-name.jpg' if did == 'ANA-DEF-03'
                         else 'Emissions_Report_20261118.csv' if did == 'ANA-DEF-27' else 'ANALYTICS_VALIDATION_2026-11-18.md')
        drows.append([did, kind, 'Analytics', sec, s, 'P1' if s == 'High' else 'P2' if s == 'Medium' else 'P3' if s == 'Low' else '—', title, desc,
                      f'Sign in, select NRVC_Hall / {m["venue"]}, open Analytics › {sec}; observe and compare with the API response',
                      exp, act, ', '.join(cases_by_def.get(did, [])), evidence, m['environment'], m['date'], status])
    table(wb, SHEETS[5], ['Defect ID', 'Type', 'Module', 'Sub-module', 'Severity', 'Priority', 'Title', 'Description', 'Steps to Reproduce',
                          'Expected', 'Actual', 'Test Case IDs', 'Evidence', 'Environment', 'Detected On', 'Status'],
          drows, [13, 22, 10, 22, 10, 9, 40, 56, 44, 28, 28, 16, 40, 30, 12, 9], color_col=5)

    table(wb, SHEETS[6], ['Page', 'Control', 'Request', 'Response', 'File', 'Content check', 'Result'], d['exports'],
          [22, 26, 50, 22, 34, 46, 14], color_col=7)

    # Place the Analytics sheets after the master sheets.
    wb.save(a.workbook)
    print(f'{a.workbook}: {len(d["cases"])} cases, {len(steps)} steps, {len(d["defects"])} defects, {len(d["inventory"])} inventory rows')

if __name__ == '__main__':
    main()
