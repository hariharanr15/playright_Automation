const { test } = require('../../../fixtures/readonlyTest');
const { verifyBusinessContract } = require('../../../utils/business-contract');
// Each case has a working reconciliation executor. Missing external rules/data
// fail explicitly as Blocked instead of reducing validation to page visibility.
for (const key of ['supplyChainIntelligence', 'emissionsFactors', 'inventoryConsumption', 'statusClassification', 'supplierIssues',
  'subcontractorIssues', 'financialForecastSource', 'invoicedOrdersSource', 'outflowSource', 'epdCarbonFactors',
  'poDocumentValidation', 'bomDocumentValidation', 'fdiNotificationRecipients']) {
  test(`Independent business reconciliation: ${key}`, async ({ readonly: ctx }, info) => {
    await verifyBusinessContract(ctx, info, key);
  });
}
