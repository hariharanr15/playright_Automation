const { test, expect } = require('@playwright/test');
const { expandIssueRows } = require('../../../utils/issue-table-rows');
const cell = (text, rowSpan = 1, colSpan = 1) => ({ text: String(text), rowSpan, colSpan });
test('Issue table contract: consume subtotal rowspan without losing the next record or a subcontractor named Total', () => {
  const rows = [
    { group: 0, cells: [cell('A', 3), cell('P1'), ...[1, 2, 3, 4, 5, 6].map(value => cell(value))] },
    { group: 0, cells: [cell('P2'), ...[7, 8, 9, 10, 11, 12].map(value => cell(value))] },
    { group: 0, cells: [cell('Total'), ...[8, 10, 12, 14, 16, 18].map(value => cell(value))] },
    { group: 0, cells: [cell('Total'), cell('P3'), ...[1, 2, 3, 4, 5, 6].map(value => cell(value))] }
  ];
  const actual = expandIssueRows(rows, [{ project_id: 'P1' }, { project_id: 'P2' }, { project_id: 'P3' }]);
  expect(actual).toEqual([
    ['A', 'P1', '1', '2', '3', '4', '5', '6'], ['A', 'P2', '7', '8', '9', '10', '11', '12'],
    ['Total', 'P3', '1', '2', '3', '4', '5', '6']
  ]);
});
test('Issue table contract: identical rows survive and rowspans do not leak across rowgroups', () => {
  const rows = [
    { group: 0, cells: [cell('A', 0), cell('P1')] },
    { group: 0, cells: [cell('P1')] },
    { group: 1, cells: [cell('B'), cell('P2')] }
  ];
  expect(expandIssueRows(rows, [{ project_id: 'P1' }, { project_id: 'P2' }])).toEqual([
    ['A', 'P1'], ['A', 'P1'], ['B', 'P2']
  ]);
});
