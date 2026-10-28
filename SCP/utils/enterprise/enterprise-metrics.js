const { ScpBlocked, requireValue } = require('../scp-readonly');
const average = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
function date(value) {
  if (!value) return null;
  const text = String(value).slice(0, 10);
  let year, month, day;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) [year, month, day] = text.split('-').map(Number);
  else if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(text)) [day, month, year] = text.split(/[-/]/).map(Number);
  else throw new ScpBlocked(`Unqualified source date ${value}`);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) throw new Error(`Invalid date ${value}`);
  return timestamp;
}
function deliveryMetrics(deliveries) {
  const completed = deliveries.filter(d => d.actualDate);
  const lateDays = []; let onTime = 0;
  for (const delivery of completed) {
    const deadline = requireValue(delivery.componentExpectedDate || delivery.requiredOnSite, `Delivery ${delivery.id} has no qualified component deadline`);
    const difference = (date(delivery.actualDate) - date(deadline)) / 86400000;
    if (difference <= 0) onTime++; else lateDays.push(difference);
  }
  return { completed: completed.length, onTime, late: lateDays.length, rate: completed.length ? onTime / completed.length : null, avgDelay: average(lateDays) };
}
function actualWeeks(delivery) {
  if (!delivery.actualDate) return null;
  requireValue(delivery.poDate, `Delivery ${delivery.id} has no PO date`);
  return (date(delivery.actualDate) - date(delivery.poDate)) / (86400000 * 7);
}
function forecast(component) {
  const value = component.leadTimeConfirmed ? component.confirmedWeeks : component.defaultWeeks;
  requireValue(value, `Component ${component.id} forecast/default mapping is missing`);
  if (!Number.isFinite(Number(value))) throw new Error(`Invalid forecast for ${component.id}`);
  return Number(value);
}
// BUGS-325 Lead-Time Variance: per Component, (average Actual Lead Time − Planned) ÷ Planned × 100, averaged over Components
// with at least one delivered Delivery. Planned = confirmed lead time, else the Supplier-to-Material default (defaultWeeks).
// A Component whose Actual or Planned lead time cannot be formed (no PO Date, no or zero Planned) is listed in `excluded`.
function variance(components, deliveries) {
  const values = []; const included = []; const excluded = [];
  for (const component of components) {
    const delivered = deliveries.filter(d => d.componentId === component.id && d.actualDate);
    if (!delivered.length) continue;
    const planned = component.leadTimeConfirmed ? component.confirmedWeeks : component.defaultWeeks;
    const reason = delivered.some(d => !d.poDate) ? 'no PO Date'
      : planned === null || planned === undefined || planned === '' ? 'no confirmed or Supplier-to-Material lead time'
        : !Number.isFinite(Number(planned)) ? `invalid planned lead time ${planned}` : Number(planned) === 0 ? 'zero planned lead time' : null;
    if (reason) { excluded.push({ id: component.id, projectId: component.projectId, reason }); continue; }
    const pct = (average(delivered.map(actualWeeks)) - Number(planned)) / Number(planned) * 100;
    values.push(pct); included.push({ id: component.id, projectId: component.projectId, planned: Number(planned), pct });
  }
  return { value: average(values), sample: values.length, included, excluded };
}
// BUGS-325 Enterprise View, recalculated from the accessible projects' source records (see docs/ENTERPRISE_REQUIREMENTS_BUGS-325.md).
// unread: { [projectRef]: unread alert count } or null when alerts are not part of the check.
function enterpriseView(source, projects, unread = null) {
  const submittals = [...new Map(source.submittals.map(record => [record.id, record])).values()];
  const scoped = ref => {
    const subs = ref ? submittals.filter(s => s.projectId === ref) : submittals;
    const ids = new Set(subs.map(s => s.id));
    const components = source.components.filter(c => ids.has(c.submittalId));
    const componentIds = new Set(components.map(c => c.id));
    const deliveries = source.deliveries.filter(d => componentIds.has(d.componentId));
    const onTime = deliveryMetrics(deliveries);
    const spendBySupplier = {};
    for (const c of components) spendBySupplier[c.supplierName] = (spendBySupplier[c.supplierName] || 0) + Number(c.price || 0) * Number(c.actual_quantity || 0);
    return { submittals: subs.length, open: openSubmittals(subs, components).length,
      onTime: { onTime: onTime.onTime, total: onTime.completed, rate: onTime.rate }, variance: variance(components, deliveries),
      spend: Object.values(spendBySupplier).reduce((a, b) => a + b, 0), spendBySupplier,
      alerts: unread ? (ref ? unread[ref] || 0 : Object.values(unread).reduce((a, b) => a + b, 0)) : null };
  };
  return { projects: projects.length, ...scoped(null),
    alertProjects: unread ? Object.values(unread).filter(count => count > 0).length : null,
    perProject: Object.fromEntries(projects.map(project => [project.ref, { name: project.name, ...scoped(project.ref) }])) };
}
function openSubmittals(submittals, components) {
  return submittals.filter(s => s.status !== 'delivered' || !components.some(c => c.submittalId === s.id));
}
function benchmarkStatus(delta) { return delta === null ? null : delta < -1 ? 'below_avg' : delta > 1 ? 'above_avg' : 'on_par'; }
function performance(components, deliveries, asOf) {
  const today = date(asOf); const completed = deliveries.filter(d => d.actualDate);
  const active = components.filter(c => Number(c.receivedQuantity ?? 0) < Number(c.quantity));
  return { delivery: deliveryMetrics(deliveries), active: active.length,
    overdue: active.filter(c => c.expectedDate && date(c.expectedDate) < today).length,
    confirmedRate: components.length ? components.filter(c => c.leadTimeConfirmed).length / components.length : null,
    averageForecast: average(components.map(forecast)),
    // Exact cutoff convention is part of the external source contract, not silently selected here.
    completed, today };
}
module.exports = { average, date, deliveryMetrics, actualWeeks, forecast, variance, enterpriseView, openSubmittals, benchmarkStatus, performance };
