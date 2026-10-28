const fs = require('fs');
const { test, expect } = require('../../../fixtures/readonlyTest');
const { InternationalShipmentsPage } = require('../../../pages/international-shipments/international-shipments.page');
const { ScpBlocked } = require('../../../utils/scp-readonly');
const { qualifyShipmentRoute } = require('../../../utils/shipment-data');

test('International Shipment: qualify a project-scoped origin and port route without changing records', async ({ readonly: ctx, executionJournal }, info) => {
  const view = new InternationalShipmentsPage(ctx.page);
  await view.open(); await ctx.assertContext();
  const projectId = await ctx.projectSelector.activeProjectReference();
  const body = await test.step('Read shipment routes for only the selected project', () => ctx.read('international_shipment/list-by-project/', { project_id: projectId }));
  await info.attach('shipment-project-source', { body: Buffer.from(JSON.stringify(body)), contentType: 'application/json' });
  const existingOwned = executionJournal.relatedData('SCP-IS-101')?.ownedShipmentData?.submittalId;
  const route = qualifyShipmentRoute(body, projectId, existingOwned ? [existingOwned] : []);
  if (!route) throw new ScpBlocked('No existing project-scoped shipment provides a complete origin country/city and loading/discharge port route. A qualified route allocation is required before creating a new owned shipment');
  expect(route.projectId).toBe(projectId);
  const destination = info.outputPath('qualified-shipment-route.json');
  fs.writeFileSync(destination, JSON.stringify({ ...route, project: ctx.config.projectName, sourceEndpoint: 'international_shipment/list-by-project/', qualifiedAt: new Date().toISOString() }, null, 2));
  await info.attach('qualified-shipment-route', { path: destination, contentType: 'application/json' });
});
