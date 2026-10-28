const { test } = require('node:test');
const assert = require('node:assert/strict');
const { qualifyShipmentRoute } = require('../../utils/shipment-data');
const origin = { project_id: 'P', submittal: 'owned-source', shipment_id: 'flag', manufacturer_country: 'China', manufacturer_city: 'Shenzhen' };
const journey = { project_id: 'P', submittal: 'owned-source', shipment_id: 'container', manufacturer_country: 'China', port_of_origin: 'Shenzhen', port_of_destination: 'Chennai' };
test('origin and ports are joined only through the same project and submittal', () => {
  assert.deepEqual(qualifyShipmentRoute({ data: [origin, journey] }, 'P').sourceIds, ['flag', 'container']);
  assert.equal(qualifyShipmentRoute({ data: [origin, { ...journey, submittal: 'other' }] }, 'P'), null);
  assert.equal(qualifyShipmentRoute({ data: [origin, journey] }, 'P', ['owned-source']), null);
});
test('foreign project rows and inconsistent origin countries cannot qualify a route', () => {
  assert.throws(() => qualifyShipmentRoute({ data: [origin, { ...journey, project_id: 'Q' }] }, 'P'), /different project/);
  assert.equal(qualifyShipmentRoute({ data: [origin, { ...journey, manufacturer_country: 'Japan' }] }, 'P'), null);
});
