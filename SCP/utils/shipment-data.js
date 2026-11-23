function qualifyShipmentRoute(body, projectId, excludeSubmittals = []) {
  if (!Array.isArray(body.data)) throw new Error('Shipment route source must return a record list');
  if (body.data.some(record => record.project_id !== projectId)) throw new Error('Shipment source includes a different project');
  const groups = new Map();
  for (const record of body.data) {
    if (!record.submittal) continue;
    if (excludeSubmittals.includes(record.submittal)) continue;
    const group = groups.get(record.submittal) || []; group.push(record); groups.set(record.submittal, group);
  }
  for (const group of groups.values()) {
    const origin = group.find(record => record.manufacturer_country?.trim() && record.manufacturer_city?.trim());
    if (!origin) continue;
    const journey = group.find(record => record.manufacturer_country === origin.manufacturer_country &&
      record.port_of_origin?.trim() && record.port_of_destination?.trim() && record.port_of_origin !== record.port_of_destination);
    if (journey) return { country: origin.manufacturer_country, city: origin.manufacturer_city,
      loadingPort: journey.port_of_origin, dischargePort: journey.port_of_destination, projectId,
      sourceIds: [origin.shipment_id, journey.shipment_id], sourceSubmittal: origin.submittal };
  }
  return null;
}
module.exports = { qualifyShipmentRoute };
