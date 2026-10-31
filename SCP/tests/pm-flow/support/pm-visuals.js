// Visual cues for the Project Management flow: a scenario banner in the page header, an outline on the
// active left-menu path (module, group, page) and a short outline on the element being used.
// Visual only: nothing here clicks or navigates. Banner text and menu path live in sessionStorage so they
// survive full page loads; the init script re-applies them after every render.

function installPmVisuals() {
  if (window.__pmFlowVisuals) return;
  window.__pmFlowVisuals = true;
  const BANNER_ID = 'pm-flow-banner';
  const NAV_ATTR = 'data-pm-flow-active';
  const read = key => { try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; } };

  const ensureStyle = () => {
    if (!document.head || document.getElementById('pm-flow-style')) return;
    const style = document.createElement('style');
    style.id = 'pm-flow-style';
    style.textContent = `
      #${BANNER_ID} { position: fixed; top: 6px; left: 50%; transform: translateX(-50%); z-index: 2147483647;
        max-width: 46vw; padding: 6px 14px; border-radius: 8px; pointer-events: none;
        font: 600 12px/1.35 'Segoe UI', Arial, sans-serif; color: #fff; background: rgba(15, 118, 110, 0.94);
        box-shadow: 0 4px 14px rgba(0,0,0,.25); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      #${BANNER_ID} .pm-suite { background: #fff; color: #0f766e; border-radius: 4px; padding: 0 6px; margin-right: 8px; }
      #${BANNER_ID} .pm-step { display: block; font-weight: 400; opacity: .92; overflow: hidden; text-overflow: ellipsis; }
      [${NAV_ATTR}="group"] { outline: 2px dashed #0f766e !important; outline-offset: -2px; border-radius: 6px; }
      [${NAV_ATTR}="page"] { outline: 3px solid #0f766e !important; outline-offset: -3px; border-radius: 6px;
        background-color: rgba(15, 118, 110, 0.14) !important; }
      [data-pm-flow-focus] { outline: 3px solid #f59e0b !important; outline-offset: 2px; }`;
    document.head.appendChild(style);
  };

  const renderBanner = () => {
    const banner = read('pmFlowBanner');
    let node = document.getElementById(BANNER_ID);
    if (!banner) { if (node) node.remove(); return; }
    if (!document.body) return;
    if (!node) { node = document.createElement('div'); node.id = BANNER_ID; document.body.appendChild(node); }
    const text = `${banner.suite}|${banner.title}|${banner.step || ''}`;
    if (node.dataset.text === text) return;
    node.dataset.text = text;
    node.textContent = '';
    const suite = document.createElement('span'); suite.className = 'pm-suite'; suite.textContent = banner.suite;
    const step = document.createElement('span'); step.className = 'pm-step'; step.textContent = banner.step ? `Step: ${banner.step}` : '';
    node.append(suite, document.createTextNode(banner.title), step);
  };

  const renderNav = () => {
    const path = read('pmFlowNav') || [];
    const nav = document.querySelector('nav');
    if (!nav) return;
    const label = node => (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim().replace(/\s+\d{1,4}\+?$/, '');
    const items = [...nav.querySelectorAll('button, a, [role="button"]')];
    const wanted = new Map();
    path.forEach((name, index) => {
      const match = items.find(item => label(item).toLowerCase() === String(name).toLowerCase());
      if (match) wanted.set(match, index === path.length - 1 ? 'page' : 'group');
    });
    for (const marked of nav.querySelectorAll(`[${NAV_ATTR}]`)) if (!wanted.has(marked)) marked.removeAttribute(NAV_ATTR);
    for (const [item, kind] of wanted) if (item.getAttribute(NAV_ATTR) !== kind) item.setAttribute(NAV_ATTR, kind);
  };

  let scheduled = false;
  const refresh = () => { scheduled = false; ensureStyle(); renderBanner(); renderNav(); };
  const schedule = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(refresh); } };
  window.__pmFlowRefresh = refresh;
  // childList only, so the attributes set here do not retrigger the observer.
  const start = () => { new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true }); schedule(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}

async function installVisuals(context) {
  await context.addInitScript(installPmVisuals);
}

async function setBanner(page, banner) {
  await page.evaluate(value => {
    sessionStorage.setItem('pmFlowBanner', JSON.stringify(value));
    if (window.__pmFlowRefresh) window.__pmFlowRefresh();
  }, banner).catch(() => null);
}

async function setNavPath(page, path) {
  await page.evaluate(value => {
    sessionStorage.setItem('pmFlowNav', JSON.stringify(value));
    if (window.__pmFlowRefresh) window.__pmFlowRefresh();
  }, path).catch(() => null);
}

// Outlines the element briefly so an observer can follow the action. Never fails the step.
async function focus(locator, ms = 450) {
  const target = locator.first();
  try {
    await target.scrollIntoViewIfNeeded({ timeout: 3000 });
    await target.evaluate(element => element.setAttribute('data-pm-flow-focus', ''));
    await new Promise(resolve => setTimeout(resolve, ms));
    await target.evaluate(element => element.removeAttribute('data-pm-flow-focus')).catch(() => null);
  } catch { /* visual only */ }
}

module.exports = { installVisuals, setBanner, setNavPath, focus };
