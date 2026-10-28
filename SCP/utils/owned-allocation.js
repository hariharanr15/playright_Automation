function qualifyOwnedDelivery(scenarios, project, site, sourceReport) {
  for (const scenario of scenarios || []) {
    const owned = scenario.data?.inventoryOwned;
    if (scenario.status !== 'Passed' || scenario.context?.project !== project || !owned?.deliveryCompleted) continue;
    const { data, master, submittal, schedule } = owned;
    if (!data || !master || !submittal || !schedule || data.ownerProject !== project || data.ownerSite !== site ||
        !/^Inventory QA /i.test(master.material_name) || data.material !== master.material_name ||
        data.submittalNumber === 'SUB-2026-525' || data.submittalId !== submittal.submittal_id ||
        data.specificationNumber !== submittal.spec_section_no || (submittal.submittal_no && data.submittalNumber !== submittal.submittal_no) ||
        schedule.material_id !== master.material_master_id || data.deliveryRecord?.submittal_schedule !== schedule.submittal_schedule_id ||
        Number(data.deliveryRecord.quantity) !== Number(data.deliveryQuantity) || !(data.grn?.file_size > 0) ||
        data.grn.file_name !== `GRN_${data.deliveryRecord.schedule_delivery_id}.pdf`) continue;
    return { project, site, sourceCase: scenario.title, sourceReport, qualifiedAt: new Date().toISOString(), data, master, submittal, schedule };
  }
  return null;
}
module.exports = { qualifyOwnedDelivery };
