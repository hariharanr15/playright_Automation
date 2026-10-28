const fs = require('fs');
const path = require('path');
const { test: base, expect } = require('./readonlyTest');
const { ScpBlocked, requireValue, one } = require('../utils/scp-readonly');
const { ProcurementLogPage } = require('../pages/procurement-log/procurement-log.page');
const { date } = require('../utils/enterprise/enterprise-metrics');

const test = base.extend({
  procurementReadonly: async ({ readonly: ctx }, use, info) => {
    const file = requireValue(process.env.SCP_PROCUREMENT_DATA,
      'SCP_PROCUREMENT_DATA must identify a qualified dedicated Procurement record manifest');
    const fixture = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
    if (!fixture.sourceCase || !fixture.qualifiedAt || !fixture.data || !fixture.master || !fixture.schedule || !fixture.submittal) {
      throw new ScpBlocked('Incomplete qualified Procurement allocation');
    }
    expect(fixture.project).toBe(ctx.config.projectName);
    expect(fixture.data.submittalNumber).not.toBe('SUB-2026-525');
    expect(fixture.data.material).toMatch(/^Inventory QA /i);
    const assertContext = async () => {
      await ctx.assertContext();
      expect(await ctx.siteSelector.activeSiteName(), 'Exact allocated Procurement site').toBe(fixture.site);
    };
    await ctx.siteSelector.ensureSite(fixture.site);
    await assertContext();
    const projectId = await ctx.projectSelector.activeProjectReference();
    expect(fixture.master.project_id, 'Owned material must belong to the exact active project').toBe(projectId);
    const source = await ctx.read('submittal_schedule/list_submittal_schedules/', {
      project_id: projectId, submittal_id: fixture.submittal.submittal_id
    });
    const component = one(source.data.schedules, record => record.submittal_schedule_id === fixture.schedule.submittal_schedule_id,
      'Dedicated saved Procurement component');
    expect(component.material_id).toBe(fixture.master.material_master_id);
    expect(component.material_name).toBe(fixture.master.material_name);
    expect(component.uom_name).toBe(fixture.master.uom_name);
    expect(Number(component.actual_quantity)).toBe(Number(fixture.data.componentQuantity));
    expect(Number(component.price)).toBe(Number(fixture.data.componentValue));
    expect(date(component.date_required_on_site), 'Saved required-on-site calendar date').toBe(date(fixture.schedule.date_required_on_site));
    const procurement = new ProcurementLogPage(ctx.page);
    await procurement.open();
    await assertContext();
    await info.attach('qualified-procurement-source', { body: Buffer.from(JSON.stringify({
      project: fixture.project, site: fixture.site, sourceCase: fixture.sourceCase, component, submittal: fixture.submittal
    })), contentType: 'application/json' });
    await use({ ...ctx, fixture, component, procurement, assertContext });
    await assertContext();
  }
});
module.exports = { test, expect };
