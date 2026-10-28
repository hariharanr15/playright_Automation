const fs = require('fs');
const path = require('path');
const { test, expect } = require('../../../fixtures/readonlyTest');
const { EnterpriseViewPage } = require('../../../pages/enterprise/enterprise-view.page');
const { SupplierPerformancePage } = require('../../../pages/enterprise/supplier-performance.page');
const { LeadTimeBenchmarksPage } = require('../../../pages/enterprise/lead-time-benchmarks.page');
const { requireValue, one, unique, ScpBlocked } = require('../../../utils/scp-readonly');
const { isHeadless } = require('../../../utils/execution-mode');
const { average, actualWeeks, deliveryMetrics, forecast, performance, date, benchmarkStatus } = require('../../../utils/enterprise/enterprise-metrics');

async function source(ctx, info) {
  const file = requireValue(ctx.allocation.enterprise?.sourceFile, 'Independent Enterprise sourceFile required: projects, components, deliveries, asOf, accountRef and provenance; use approved existing records');
  const value = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  requireValue(value.provenance, 'Independent source provenance is required; Enterprise summary output cannot be its own oracle');
  const ref = await ctx.page.evaluate(() => JSON.parse(localStorage.getItem('userInfo') || '{}').ref);
  expect(value.accountRef, 'Source population belongs to the authenticated account').toBe(ref);
  for (const key of ['projects', 'components', 'deliveries', 'submittals']) expect(Array.isArray(value[key]), key).toBe(true);
  requireValue(value.asOf, 'Source reference date is required');
  expect(date(value.asOf)).toBe(await ctx.page.evaluate(() => { const n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); }));
  await info.attach('independent-enterprise-source', { path: path.resolve(file), contentType: 'application/json' });
  return value;
}
test('Enterprise access: exact current-account project and organisation allowlist', async ({ readonly: ctx }, info) => {
  const data = await source(ctx, info); const view = new EnterpriseViewPage(ctx.page); const actual = await view.load();
  expect(view.projects.map(p => p.project_no).sort()).toEqual(data.projects.map(p => p.ref).sort());
  expect(actual.projects).toBe(data.projects.length); expect(actual.organizations).toBe(unique(data.projects, 'organizationRef'));
});
test('Enterprise access: changing any available SCP header project does not narrow enterprise scope', async ({ readonly: ctx }) => {
  test.setTimeout(180000);
  const view = new EnterpriseViewPage(ctx.page); const baseline = await view.load();
  const input = label => view.main.getByText(label, { exact: true }).locator('..').getByRole('textbox');
  const from = new Date(date(await input('From').inputValue())).toISOString().slice(0, 10);
  const to = new Date(date(await input('To').inputValue())).toISOString().slice(0, 10);
  const baselineProjects = view.projects.map(p => p.project_no).sort();
  const allowed = new Set(view.projects.map(p => p.project_no));
  const projects = await ctx.page.evaluate(() => JSON.parse(localStorage.getItem('userInfo') || '{}').projects || []);
  const matches = projects.filter(p => allowed.has(p.ref));
  expect(matches.length).toBeGreaterThan(0);
  try {
    for (const project of matches) {
      // The project is changed from the header while staying on /enterprise-view.
      const { summary: ui } = await view.changeInPlace(async () => {
        await ctx.projectSelector.ensureProject(project.name);
        await ctx.projectSelector.expectActiveProject(project.name);
      }, ctx.read);
      expect(view.projects.map(p => p.project_no).sort()).toEqual(baselineProjects);
      expect(ui).toEqual(baseline);
      const params = new URLSearchParams({ from_date: from, to_date: to, project_id: project.ref });
      const actual = await ctx.read(`enterprise/summary/?${params}`);
      expect(actual.data).toEqual(baseline);
    }
  } finally { await ctx.projectSelector.ensureProject(ctx.config.projectName); }
});
// Rendered Enterprise View: KPI cards, chart/section headings, every table row and the applied date filters.
async function renderedEnterprise(view) {
  return view.main.evaluate(main => {
    const text = node => node.innerText.replace(/\s+/g, ' ').trim();
    return {
      filters: [...main.querySelectorAll('input')].filter(input => input.type !== 'hidden').map(input => input.value),
      cards: [...main.querySelectorAll('.text-2xl')].map(value => text(value.parentElement)),
      headings: [...main.querySelectorAll('h1, h2, h3, h4')].map(text),
      tables: [...main.querySelectorAll('table')].map(table => [...table.rows].map(text))
    };
  });
}
test('Enterprise cross-project: NRVC_Hall and LLE-Test show the same consolidated data', async ({ readonly: ctx }, info) => {
  test.setTimeout(180000);
  const names = String(process.env.SCP_ENTERPRISE_PROJECTS || 'NRVC_Hall,LLE-Test').split(',').map(name => name.trim()).filter(Boolean);
  const associated = await ctx.page.evaluate(() => JSON.parse(localStorage.getItem('userInfo') || '{}').projects || []);
  // Project names are matched ignoring case, spaces and hyphens ("LLE-Test" is "LLE - Test" in the application).
  const key = name => String(name).toLowerCase().replace(/[\s-]+/g, '');
  const projects = names.map(name => associated.find(project => key(project.name) === key(name)));
  const missing = names.filter((name, index) => !projects[index]);
  if (missing.length) throw new ScpBlocked(`The signed-in account is not associated with ${missing.join(', ')}; cross-project Enterprise comparison needs every listed project`);
  // Enterprise View is opened once; each project is then selected from the header on /enterprise-view itself.
  const view = new EnterpriseViewPage(ctx.page); await view.load();
  const captured = {}; const differences = [];
  try {
    for (const project of projects) {
      const { summary, refetched, redirectedTo } = await view.changeInPlace(async () => {
        await ctx.projectSelector.ensureProject(project.name);
        await ctx.projectSelector.expectActiveProject(project.name);
      }, ctx.read);
      captured[project.name] = { url: ctx.page.url(), redirectedTo, refetched, summary, projectsInScope: view.projects.map(item => item.project_no).sort(), rendered: await renderedEnterprise(view) };
      await info.attach(`enterprise-${project.name}`, { body: await ctx.page.screenshot({ fullPage: isHeadless() }), contentType: 'image/png' });
      // Enterprise is cross-project: every listed associated project contributes, whichever one is selected.
      for (const contributor of projects) {
        if (!captured[project.name].projectsInScope.includes(contributor.ref)) differences.push(`${project.name}: ${contributor.name} (${contributor.ref}) is missing from Enterprise scope`);
      }
    }
    const [first, ...others] = projects.map(project => project.name);
    for (const name of others) {
      for (const part of ['summary', 'projectsInScope', 'rendered']) {
        if (JSON.stringify(captured[name][part]) !== JSON.stringify(captured[first][part])) differences.push(`${part} differs between ${first} and ${name}`);
      }
    }
  } finally {
    await info.attach('enterprise-cross-project-comparison', { body: Buffer.from(JSON.stringify({ projects: names, differences, captured }, null, 2)), contentType: 'application/json' });
    await ctx.projectSelector.ensureProject(ctx.config.projectName);
  }
  expect(differences, 'Enterprise must show the same consolidated data for every associated project (see enterprise-cross-project-comparison)').toEqual([]);
});
// Lead-Time Variance is recalculated from live source records in scp-enterprise-view.spec.js (BUGS-325).
test('Supplier Performance calculation: active/overdue, confirmed percentage and planned average', async ({ readonly: ctx }, info) => {
  const data = await source(ctx, info); const expected = performance(data.components, data.deliveries, data.asOf);
  const view = new SupplierPerformancePage(ctx.page); const actual = (await view.load()).kpis;
  expect(actual.active_schedules).toBe(expected.active); expect(actual.overdue_schedules).toBe(expected.overdue);
  expect(actual.confirmed_lead_times_rate).toBe(expected.confirmedRate === null ? null : Number(expected.confirmedRate.toFixed(4)));
  expect(actual.avg_lead_time_weeks).toBe(expected.averageForecast === null ? null : Number(expected.averageForecast.toFixed(1)));
});
test('Supplier Performance calculation: completed-only OTD and independently counted 90-day/month buckets', async ({ readonly: ctx }, info) => {
  const data = await source(ctx, info); const view = new SupplierPerformancePage(ctx.page); const actual = await view.load();
  const expected = deliveryMetrics(data.deliveries);
  expect(actual.kpis.on_time_delivery_rate).toBe(expected.rate === null ? null : Number(expected.rate.toFixed(4)));
  expect(requireValue(data.last90DaysInclusive, 'Confirm whether 90-day cutoff includes the first day')).toBe(true);
  const cutoff = date(data.asOf) - 90 * 86400000;
  expect(actual.kpis.total_deliveries_last_90d).toBe(data.deliveries.filter(d => d.actualDate && date(d.actualDate) >= cutoff && date(d.actualDate) <= date(data.asOf)).length);
  for (const bucket of actual.deliveries_per_month) {
    expect(bucket.delivered).toBe(data.deliveries.filter(d => d.actualDate && new Date(date(d.actualDate)).toISOString().startsWith(bucket.month)).length);
  }
});
test('Lead Time Benchmarks calculation: actual delivery averages, late population and mean delay', async ({ readonly: ctx }, info) => {
  const data = await source(ctx, info); const view = new LeadTimeBenchmarksPage(ctx.page); const actual = await view.load(); const expected = deliveryMetrics(data.deliveries);
  expect(actual.delivery_performance.total_delivered).toBe(expected.completed);
  expect(actual.delivery_performance.on_time).toBe(expected.onTime); expect(actual.delivery_performance.late).toBe(expected.late);
  expect(actual.delivery_performance.avg_delay_days).toBe(expected.avgDelay === null ? null : Number(expected.avgDelay.toFixed(1)));
  for (const record of actual.comparisons) {
    const durations = data.deliveries.filter(d => d.category === record.category && d.actualDate).map(actualWeeks);
    expect(record.your_sample).toBe(durations.length);
    expect(record.your_avg_weeks).toBe(durations.length ? Number(average(durations).toFixed(1)) : null);
  }
});
test('Lead Time Benchmarks calculation: client/platform/industry independent authorised reference values', async ({ readonly: ctx }, info) => {
  const data = await source(ctx, info);
  const reference = requireValue(data.benchmarkReference, 'Approved organisation/platform/industry reference fixture is required; do not request unauthorised raw records');
  const view = new LeadTimeBenchmarksPage(ctx.page); const actual = await view.load();
  for (const row of actual.comparisons) {
    const expected = one(reference, r => r.category === row.category, 'Independent category baseline');
    for (const field of ['client_avg_weeks', 'platform_avg_weeks', 'industry_avg_weeks', 'platform_min_weeks', 'platform_max_weeks', 'industry_min_weeks', 'industry_max_weeks']) expect(row[field], `${row.category}/${field}`).toBe(expected[field]);
  }
});

// Mathematical boundary checks validate the calculator only, not application coverage.
test('Enterprise calculator: exact -1/+1 benchmark boundaries and missing delta', async () => {
  expect(benchmarkStatus(-1)).toBe('on_par'); expect(benchmarkStatus(1)).toBe('on_par');
  expect(benchmarkStatus(-1 - Number.EPSILON * 2)).toBe('below_avg');
  expect(benchmarkStatus(1 + Number.EPSILON * 2)).toBe('above_avg'); expect(benchmarkStatus(null)).toBeNull();
});
