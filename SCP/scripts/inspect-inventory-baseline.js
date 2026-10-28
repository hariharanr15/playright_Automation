const fs = require('fs');
const path = require('path');
require('../utils/env').loadEnvFile();
const { chromium } = require('@playwright/test');
const { getScpConfig } = require('../config/scp.config');
const { AppShellPage } = require('../pages/app-shell.page');
const { PlatformChooserPage } = require('../pages/platform-chooser.page');
const { ManagementDashboardPage } = require('../pages/management-dashboard/management-dashboard.page');
const { ProjectSelectorPage } = require('../pages/project-selector.page');
const { read } = require('../utils/scp-readonly');
const { currentCalendarDate, addCalendarDays } = require('../utils/calendar-date');

(async () => {
  const file = path.resolve(process.argv[2]);
  const params = JSON.parse(fs.readFileSync(file, 'utf8'));
  const config = getScpConfig();
  const browser = await chromium.launch({ channel: 'chrome', headless: false });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const origin = new URL(config.baseUrl).origin;
    await context.route('**/api/**', route => {
      const request = route.request();
      if (new URL(request.url()).origin === origin && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return route.abort('blockedbyclient');
      return route.continue();
    });
    const page = await context.newPage();
    await new AppShellPage(page, config).open();
    await new PlatformChooserPage(page, config).openSupplyChainPlanner();
    await new ManagementDashboardPage(page, config).expectLoaded();
    const selector = new ProjectSelectorPage(page, config);
    await selector.ensureProject(config.projectName);
    if (params.project_id !== await selector.activeProjectReference()) throw new Error('Baseline source must belong to the active project');
    const today = await currentCalendarDate(page);
    const result = await read(page, 'inventory/list_inv_action/', { ...params, from_date: addCalendarDays(today, -30), to_date: today, location_id: '' });
    fs.writeFileSync(path.join(path.dirname(file), 'baseline-source.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ opening: result.data.opening_balance, closing: result.data.closing_balance,
      activities: result.data.activities.map(entry => ({ action: entry.utility_action_name, value: entry.total_value, source: entry.source })) }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
