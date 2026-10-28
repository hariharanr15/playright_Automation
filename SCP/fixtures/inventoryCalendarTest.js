const fs = require('fs');
const { test: base, expect } = require('./inventoryTest');
const { prepareContext } = require('../tests/support/inventory-management-flow');
const { InventoryActivityCalendarPage } = require('../pages/inventory-management/inventory-activity-calendar.page');
const { excluded } = require('../utils/scp-readonly');
const test = base.extend({
  inventoryCalendar: async ({ inventory: ctx }, use, info) => {
    const attemptedWrites = []; const errors = [];
    const guard = async route => {
      const request = route.request(); const url = new URL(request.url());
      const shellRead = request.method() === 'GET' && url.pathname === '/api/system_messages/active/';
      if ((!shellRead && excluded.test(url.pathname)) || !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        attemptedWrites.push({ method: request.method(), path: url.pathname });
        return route.abort('blockedbyclient');
      }
      return route.continue();
    };
    const listener = error => errors.push(error.message);
    await ctx.scpSession.context.route('**/api/**', guard);
    ctx.page.on('pageerror', listener);
    try {
      await prepareContext(ctx);
      ctx.calendarMaterial = ctx.reference;
      if (process.env.SCP_PROCUREMENT_DATA) {
        const owned = JSON.parse(fs.readFileSync(process.env.SCP_PROCUREMENT_DATA, 'utf8'));
        expect(owned.project).toBe(ctx.allocation.project);
        expect(owned.site).toBe(ctx.allocation.site);
        expect(owned.master.project_id).toBe(await ctx.projectSelector.activeProjectReference());
        expect(owned.data.submittalNumber).not.toBe('SUB-2026-525');
        ctx.calendarMaterial = owned.master;
      }
      const calendar = new InventoryActivityCalendarPage(ctx);
      await use({ ...ctx, calendar });
      expect(attemptedWrites, 'Calendar validation must perform no mutations/excluded workflows').toEqual([]);
      expect(errors, 'Calendar must emit no uncaught application errors').toEqual([]);
    } finally {
      ctx.page.off('pageerror', listener);
      await ctx.scpSession.context.unroute('**/api/**', guard);
      await info.attach('inventory-calendar-readonly-guard', { body: Buffer.from(JSON.stringify({ attemptedWrites, errors })), contentType: 'application/json' });
    }
  }
});
module.exports = { test, expect };
