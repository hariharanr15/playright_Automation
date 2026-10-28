function bulkJobDecision(job, kind) {
  if (!job || typeof job.is_finished !== 'boolean') throw new Error('Bulk upload status must identify whether the job has finished');
  if (!job.is_finished) return { status: 'unknown', reason: 'The existing upload is still processing; it must not be submitted again' };
  if (!['success', 'failed'].includes(job.status)) throw new Error('Bulk upload returned an unrecognized terminal status');
  return { status: job.status === 'success' || kind === 'negative' ? 'complete' : 'missing', value: job };
}
function recoverBulkActivities(rows, records, submittalId, scheduleId) {
  if (!Array.isArray(records)) throw new Error('Committed upload recovery requires authoritative inventory activities');
  return rows.map(row => {
    const action = row.Action.toLowerCase().replace(/ /g, '_');
    const matches = records.filter(record => record.comments === row.Comments && record.utility_action_name === action);
    if (matches.length !== 1) throw new Error(`Committed bulk row ${row.Action} has ${matches.length} saved matches; do not resubmit it`);
    const saved = matches[0];
    const signedQuantity = (row.Action === 'Incoming Load' ? 1 : -1) * Number(row.Quantity);
    if (saved.submittal_id !== submittalId || saved.schedule_id !== scheduleId || Number(saved.action_quantity) !== signedQuantity) {
      throw new Error(`Committed bulk row ${row.Action} has different owned identifiers or quantity`);
    }
    return { action: row.Action, quantity: Number(row.Quantity), comments: row.Comments, source: row['From Location'], destination: row['To Location'] };
  });
}
module.exports = { bulkJobDecision, recoverBulkActivities };
