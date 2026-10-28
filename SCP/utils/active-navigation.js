const { isFastMode, isHeadless } = require('./execution-mode');
const { MODULES } = require('../config/scp-module-registry');

// Marks the left-navigation entry for the current route so observers can see which module is executing.
// Visual only: it never clicks, expands or navigates, and it is skipped in fast or headless runs.
function markActiveNavigation(routes) {
  // Stage processes attaching to the shared browser each register this script; run it once per document.
  if (window.__scpActiveNavigation) return;
  window.__scpActiveNavigation = true;
  const ATTRIBUTE = 'data-scp-automation-active';
  const install = () => {
    if (!document.head || document.getElementById('scp-automation-active-nav-style')) return;
    const style = document.createElement('style');
    style.id = 'scp-automation-active-nav-style';
    style.textContent = `[${ATTRIBUTE}] { outline: 3px solid #2563eb !important; outline-offset: -3px;
      background-color: rgba(37, 99, 235, 0.12) !important; border-radius: 6px; }`;
    document.head.appendChild(style);
  };
  const route = value => value.replace(/\/+$/, '') || '/';
  let scheduled = false;
  const refresh = () => {
    scheduled = false;
    install();
    const nav = document.querySelector('nav');
    if (!nav) return;
    const current = route(location.pathname);
    const text = node => (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim().replace(/\s+\d{1,4}\+?$/, '');
    let best = null;
    let bestLength = 0;
    for (const link of nav.querySelectorAll('a[href]')) {
      let path;
      try { path = route(new URL(link.getAttribute('href'), location.href).pathname); } catch { continue; }
      if (path === '/' || !(current === path || current.startsWith(`${path}/`))) continue;
      if (path.length > bestLength) { best = link; bestLength = path.length; }
    }
    // SCP renders module entries as buttons; resolve the route through the module registry's navigation labels.
    const module = routes.find(item => current === `/${item.route}` || current.startsWith(`/${item.route}/`));
    if (!best && module) {
      const buttons = [...nav.querySelectorAll('button, [role="button"], [role="menuitem"]')];
      best = module.labels.map(label => buttons.find(node => text(node).toLowerCase() === label.toLowerCase())).find(Boolean) || null;
    }
    // Otherwise use the entry the application itself styles as selected.
    if (!best) best = [...nav.querySelectorAll('button.font-semibold[class*="bg-primaryShades"]')].pop() || null;
    for (const marked of nav.querySelectorAll(`[${ATTRIBUTE}]`)) if (marked !== best) marked.removeAttribute(ATTRIBUTE);
    if (best && !best.hasAttribute(ATTRIBUTE)) best.setAttribute(ATTRIBUTE, '');
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(refresh);
  };
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function (...args) { const result = original.apply(this, args); schedule(); return result; };
  }
  window.addEventListener('popstate', schedule);
  // childList only: our own attribute changes must not retrigger the observer.
  const start = () => { new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true }); schedule(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}

async function installActiveNavigationHighlight(context) {
  if (isFastMode() || isHeadless()) return;
  const routes = MODULES.filter(module => module.route).map(module => ({ route: module.route, labels: module.nav.map(item => item.label) }));
  await context.addInitScript(markActiveNavigation, routes);
}

module.exports = { installActiveNavigationHighlight };
