const { ProcurementLogPage } = require('../../pages/procurement-log/procurement-log.page');

async function runProcurementLogFlow({ page, siteSelector, runData, data, runStep, dataPrefix = 'procurement' }) {
  const procurementLog = new ProcurementLogPage(page);
  const capture = (key, value, source) => runData.captureData(`${dataPrefix}${key}`, value, source);

  await runStep(page, 'Open the independent Procurement Log module', async () => {
    await procurementLog.open();
  });

  await runStep(page, `Create unique submittal ${data.submittalNumber}`, async () => {
    await procurementLog.createSubmittal(data);
    capture('Log', data, 'Procurement Log');
  });

  await runStep(page, `Add component ${data.componentItem}`, async () => {
    await procurementLog.addComponent(data);
    capture('Component', {
      submittalNumber: data.submittalNumber,
      material: data.material,
      supplier: data.supplier,
      item: data.componentItem,
      quantity: data.componentQuantity,
      value: data.componentValue
    }, 'Procurement Log > Component');
  });

  await runStep(page, `Select delivery site ${data.deliverySite}`, async () => {
    await siteSelector.ensureSite(data.deliverySite);
  });

  await runStep(page, `Order component ${data.componentItem}`, async () => {
    await procurementLog.orderComponent(data);
  });

  await runStep(page, `Log delivery at ${data.deliveryLocation}`, async () => {
    const delivery = await procurementLog.logDelivery(data);
    capture('Delivery', {
      submittalNumber: data.submittalNumber,
      component: data.componentItem,
      displayedItem: delivery.item,
      site: data.deliverySite,
      location: data.deliveryLocation,
      quantity: data.deliveryQuantity
    }, 'Procurement Log > Delivery');
  });

  await runStep(page, 'Complete the Pre-Shipping checklist', async () => {
    await procurementLog.completePreShippingChecklist(data);
    capture('PreShippingChecklist', data.submittalNumber, 'Procurement Log > Pre-Shipping Checklist');
  });

  await runStep(page, 'Approve the Pre-Shipping checklist', async () => {
    await procurementLog.approvePreShippingChecklist(data);
  });

  await runStep(page, 'Update the delivery date', async () => {
    await procurementLog.updateDeliveryDate(5);
    capture('ActualDeliveryDateUpdated', data.submittalNumber, 'Procurement Log > Delivery Date');
  });

  await runStep(page, 'Generate the initial GRN', async () => {
    await procurementLog.generateGrn();
  });

  await runStep(page, `Set shipping mode to ${data.shippingMode}`, async () => {
    await procurementLog.updateShippingInformation(data);
    capture('ShippingInformation', {
      submittalNumber: data.submittalNumber,
      mode: data.shippingMode,
      reference: data.shippingReference
    }, 'Procurement Log > Shipping Information');
  });

  await runStep(page, 'Add delivery conditions', async () => {
    await procurementLog.addDeliveryConditions(data);
    capture('DeliveryConditions', {
      submittalNumber: data.submittalNumber,
      conditions: data.deliveryConditions
    }, 'Procurement Log > Delivery Conditions');
  });

  await runStep(page, 'Generate the final GRN', async () => {
    await procurementLog.generateGrn();
    capture('GeneratedGrn', data.submittalNumber, 'Procurement Log > GRN');
  });

  return { procurementLog, data };
}

module.exports = { runProcurementLogFlow };
