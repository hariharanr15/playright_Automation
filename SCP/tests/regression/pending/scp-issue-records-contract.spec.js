const { test, expect } = require('@playwright/test');
const { sourceTuples, multiset, nameCounts } = require('../../../utils/issue-records');
const { groupedSortDirections } = require('../../../utils/issue-records');
const make = (subcontractor, project_id, delays) => ({ subcontractor, project_id, delays_in_raising_po: delays,
  delays_in_confirming_po: 2, po_schedule_impact: 3, delays_in_booking: 4, delivery_impacted: 5, over_deliveries: 6 });
test('Issue record contract: repeated subcontractor and project preserve distinct associated values', () => {
  const rows = sourceTuples([make('A', 'P', 1), make('A', 'P', 9)]);
  expect(rows).toHaveLength(2); expect(nameCounts(rows)).toEqual([['A', 2]]);
  expect(multiset(rows)).not.toEqual(multiset([rows[0]]));
});
test('Issue record contract: identical visible records retain their multiplicity', () => {
  const record = make('A', 'P', 1); const rows = sourceTuples([record, { ...record }]);
  expect(multiset(rows)).toHaveLength(2); expect(multiset(rows)[0]).toBe(multiset(rows)[1]);
});
test('Issue record contract: ordering changes preserve records while changed field associations fail', () => {
  const records = [make('A', 'P1', 1), make('A', 'P2', 9)];
  expect(multiset(sourceTuples(records))).toEqual(multiset(sourceTuples([...records].reverse())));
  expect(multiset(sourceTuples(records))).not.toEqual(multiset(sourceTuples([make('A', 'P1', 9), make('A', 'P2', 1)])));
});
test('Issue record contract: legitimate subcontractor named Total is not removed', () => {
  expect(sourceTuples([make('Total', 'P', 1)])).toHaveLength(1);
});
test('Issue record contract: missing seventh detail never becomes an invented zero', () => {
  const record = make('A', 'P', 1); delete record.over_deliveries;
  expect(() => sourceTuples([record])).toThrow('missing required field over_deliveries');
});
test('Issue sort contract: project ordering is within name groups rather than global', () => {
  const rows = [['A', 'P2'], ['A', 'P3'], ['B', 'P1'], ['B', 'P4']];
  expect(groupedSortDirections(rows, 1)).toEqual({ directions: ['ascending'], varied: true });
  expect(rows).toHaveLength(4);
});
test('Issue sort contract: opposite directions across name groups fail', () => {
  expect(groupedSortDirections([['A', 'P1'], ['A', 'P2'], ['B', 'P4'], ['B', 'P3']], 1).directions).toEqual([]);
});
test('Issue sort contract: identical values cannot demonstrate direction and case ties need no invented ordering', () => {
  expect(groupedSortDirections([['A', 'p1'], ['A', 'P1'], ['B', 'P2']], 1)).toEqual({ directions: ['ascending', 'descending'], varied: false });
});
