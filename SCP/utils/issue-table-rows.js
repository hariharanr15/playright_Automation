// Expand presentation-only rowspans. Never collapse or deduplicate record rows.
function expandIssueRows(rows, records) {
  const projects = new Set(records.map(record => String(record.project_id)));
  let spans = []; let group; const output = [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (row.group !== group) { spans = []; group = row.group; }
    if (!row.cells.length || row.cells.length === 1 && row.cells[0].colSpan > 1) continue;
    const values = [];
    for (let column = 0; column < spans.length; column++) if (spans[column]?.remaining > 0) {
      values[column] = spans[column].text; spans[column].remaining--;
    }
    let column = 0;
    for (const cell of row.cells) {
      while (values[column] !== undefined) column++;
      values[column] = cell.text.trim();
      const remaining = cell.rowSpan === 0 ? rows.slice(rowIndex + 1).filter(candidate => candidate.group === group).length : cell.rowSpan - 1;
      if (remaining > 0) spans[column] = { text: values[column], remaining };
      column++;
    }
    // A subtotal uses Total in place of a project value. A real record named
    // Total still has its actual source project and remains in the population.
    if (/^Total$/i.test(row.cells[0].text.trim()) && !projects.has(values[1])) continue;
    output.push(values);
  }
  return output;
}
module.exports = { expandIssueRows };
