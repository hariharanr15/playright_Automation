const { expect } = require('@playwright/test');
const { ReadOnlyReportPage } = require('./read-only-report.page');
const { number, sum, one } = require('../../utils/scp-readonly');
const definitions = {
  aggregate: { label: 'Aggregate Stats', route: 'aggregate-stats', endpoint: 'project_master/get_project_aggregation/', projectScoped: true },
  financial: { label: 'Financial Forecast', route: 'financial-forecast', endpoint: 'financial_forecast/forecast/', projectScoped: true },
  invoiced: { label: 'Submittal Invoiced Orders', route: 'submittal-invoiced-orders', endpoint: 'submittal_master/tov_analytics_by_project_id/', projectScoped: true },
  outflow: { label: 'Submittal Outflow Projection', route: 'submittal-level-outflow-projection', endpoint: 'submittal_master/tov_analytics_by_project_id/', projectScoped: true },
  emissions: { label: 'Emission Report', route: 'emissions-report', endpoint: 'emissions/project-summary/', projectScoped: true },
  epd: { label: 'EPD Report', route: 'epd-report', endpoint: 'epd/project-summary/', projectScoped: true },
  inventory: { label: 'Inventory Report', route: 'inventory-reports', endpoint: 'ledger_balance/consumption_analytics/', projectScoped: true },
  subcontractor: { label: 'Subcontractor Issues', route: 'subcontractor-issues', endpoint: 'project_master/get_supplier_issues/', projectScoped: true },
  supplier: { label: 'Supplier Issues', route: 'supplier-issues', endpoint: 'project_master/get_supplier_issues/', projectScoped: true },
  status: { label: 'Status Report', route: 'status-report', endpoint: 'submittal_status/by_submittal/', projectScoped: false }
};
class AnalyticsPage extends ReadOnlyReportPage {
  async load(key, config) { const result = await this.open(definitions[key], config); this.requestUrl = result.requestUrl; return result.body; }
  async expectAggregate(body) {
    await this.tableFields(body.data, 'PROJECT', { PROJECT: 'project_id', SUBMITTALS: 'submittal_count', MATERIALS: 'material_count', LOCATIONS: 'location_count', SUPPLIERS: 'supplier_count', USERS: 'users_count' });
    for (const field of ['submittal_count', 'material_count', 'location_count', 'supplier_count', 'users_count']) for (const record of body.data) expect(record[field]).toBeGreaterThanOrEqual(0);
  }
  async expectTov(body, outflow = false) {
    const mapping = outflow ? { 'Submittal No': 'submittal_no', Material: 'material_name', 'Value Orders Received': 'value_orders_received',
      'Value Of Orders Not Yet Received': 'value_pending_to_be_received', 'Delivery Next Week Count': 'delivery_next_week_count',
      'Delivery in 2 Weeks Count': 'delivery_in_2_weeks_count', 'Delivery in 3 Weeks Count': 'delivery_in_3_weeks_count' } :
      { 'Submittal No': 'submittal_no', Material: 'material_name', 'Total Component Qty': 'total_component_qty', 'Qty Orders Placed': 'qty_orders_placed',
        'Qty Orders Received': 'qty_orders_received', 'Qty Pending to be Received': 'qty_pending_to_be_received', 'Value Orders Placed': 'value_orders_placed', 'Value Orders Received': 'value_orders_received' };
    await this.tableFields(body.data, 'Submittal No', mapping);
    for (const record of body.data) {
      expect(record.qty_pending_to_be_received, `Quantity reconciliation: ${record.submittal_no}`).toBe(Number(record.qty_orders_placed) - Number(record.qty_orders_received));
      expect(Number(record.value_pending_to_be_received).toFixed(2), `Value reconciliation: ${record.submittal_no}`).toBe((Number(record.value_orders_placed) - Number(record.value_orders_received)).toFixed(2));
    }
  }
  async expectFinancial(body) {
    const data = body.data; const terms = data.payment_terms;
    expect(terms.on_order_pct + terms.on_delivery_pct + terms.on_installation_pct).toBe(100);
    let cumulative = 0;
    for (const month of data.timeline) {
      const total = month.order + month.delivery + month.installation;
      expect(month.total.toFixed(2)).toBe(total.toFixed(2)); cumulative += total;
      expect(month.cumulative.toFixed(2)).toBe(cumulative.toFixed(2));
    }
    expect(data.summary.total_forecast.toFixed(2)).toBe(cumulative.toFixed(2));
    for (const [field, source] of [['total_forecast_ordered', 'order'], ['total_forecast_delivered', 'delivery'], ['total_forecast_installed', 'installation']]) expect(data.summary[field].toFixed(2)).toBe(sum(data.timeline, source).toFixed(2));
    for (const [label, value] of [['Total Contract Value', data.summary.total_value], ['Forecast at Order', data.summary.total_forecast_ordered],
      ['Forecast on Delivery', data.summary.total_forecast_delivered], ['Forecast on Install', data.summary.total_forecast_installed], ['Total Forecast', data.summary.total_forecast]]) {
      const card = this.main.getByText(label, { exact: true }).locator('..'); await expect(card).toHaveCount(1);
      expect(number(await card.innerText())).toBe(value);
    }
    await this.tableFields(data.timeline, 'MONTH', { MONTH: 'month', 'AT ORDER': 'order', 'ON DELIVERY': 'delivery', 'ON INSTALL': 'installation', 'MONTH TOTAL': 'total', CUMULATIVE: 'cumulative' }, { zeroAsDash: true });
  }
  async expectIssues(body, grouped = false) {
    if (grouped) {
      const { SubcontractorIssuesPage } = require('./subcontractor-issues.page');
      const report = new SubcontractorIssuesPage(this.page);
      report.table = this.main.getByRole('table');
      return report.expectRecords(body.data);
    }
    await this.tableFields(body.data, 'Subcontractor', { Subcontractor: 'subcontractor', 'Project Name': 'project_id', 'Delays in Raising PO': 'delays_in_raising_po',
      'Delays in Confirming PO': 'delays_in_confirming_po', 'PO Schedule Impact': 'po_schedule_impact', 'Delays in Booking': 'delays_in_booking', 'Delivery Impacted': 'delivery_impacted', 'Over-Deliveries': 'over_deliveries' }, { rowKeys: ['Subcontractor', 'Project Name'], grouped });
  }
}
module.exports = { AnalyticsPage, definitions };
