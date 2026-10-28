const columns = [
  ['Subcontractor', 'subcontractor'], ['Project Name', 'project_id'],
  ['Delays in Raising PO', 'delays_in_raising_po'], ['Delays in Confirming PO', 'delays_in_confirming_po'],
  ['PO Schedule Impact', 'po_schedule_impact'], ['Delays in Booking', 'delays_in_booking'],
  ['Delivery Impacted', 'delivery_impacted'], ['Over-Deliveries', 'over_deliveries']
];
function numeric(value) {
  const text = String(value ?? '').trim().replace(/,/g, '');
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) throw new Error(`Issue value must be numeric, received ${JSON.stringify(value)}`);
  const result = Number(text);
  if (!Number.isFinite(result)) throw new Error('Issue value must be finite');
  return result;
}
function sourceTuples(records) {
  return records.map(record => columns.map(([, key], index) => {
    if (record[key] === undefined || record[key] === null) throw new Error(`Issue source missing required field ${key}`);
    return index < 2 ? String(record[key]).trim() : numeric(record[key]);
  }));
}
// Array comparison preserves multiplicity, including identical visible records.
const multiset = rows => rows.map(row => JSON.stringify(row)).sort();
function nameCounts(rows) {
  const result = new Map();
  for (const row of rows) result.set(row[0], (result.get(row[0]) || 0) + 1);
  return [...result].sort(([a], [b]) => a.localeCompare(b));
}
function groupedSortDirections(rows, column) {
  const groups = new Map();
  for (const row of rows) {
    const key = column === 0 ? null : row[0];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(column < 2 ? row[column].toLowerCase() : numeric(row[column]));
  }
  const directions = new Set(['ascending', 'descending']); let varied = false;
  for (const values of groups.values()) for (let i = 1; i < values.length; i++) {
    const comparison = column < 2 ? values[i - 1].localeCompare(values[i]) : values[i - 1] - values[i];
    if (comparison) varied = true;
    if (comparison > 0) directions.delete('ascending');
    if (comparison < 0) directions.delete('descending');
  }
  return { directions: [...directions], varied };
}
module.exports = { columns, numeric, sourceTuples, multiset, nameCounts, groupedSortDirections };
