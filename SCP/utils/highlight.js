const DEFAULT_HIGHLIGHT_MS = Number(process.env.HIGHLIGHT_MS || 500);
const DEFAULT_ACTION_PAUSE_MS = Number(process.env.ACTION_PAUSE_MS || 300);

async function highlight(locator, label = 'interaction') {
  try {
    await locator.scrollIntoViewIfNeeded({ timeout: 5000 });
    await locator.evaluate((element, interactionLabel) => {
      const previousOutline = element.style.outline;
      const previousBoxShadow = element.style.boxShadow;

      element.dataset.previousOutline = previousOutline;
      element.dataset.previousBoxShadow = previousBoxShadow;
      element.dataset.highlightLabel = interactionLabel;
      element.style.outline = '4px solid #2563eb';
      element.style.boxShadow = '0 0 0 8px rgba(37, 99, 235, 0.28)';
    }, label);

    await new Promise((resolve) => setTimeout(resolve, DEFAULT_HIGHLIGHT_MS));

    await locator.evaluate((element) => {
      element.style.outline = element.dataset.previousOutline || '';
      element.style.boxShadow = element.dataset.previousBoxShadow || '';
      delete element.dataset.previousOutline;
      delete element.dataset.previousBoxShadow;
      delete element.dataset.highlightLabel;
    }).catch(() => null);
  } catch (error) {
    console.log(`Skipping highlight for ${label}: ${error.message}`);
  }
}

async function clickHighlighted(locator, label, clickOptions = {}) {
  await locator.waitFor({ state: 'visible' });
  await highlight(locator, label);
  await locator.click(clickOptions);
  await new Promise((resolve) => setTimeout(resolve, DEFAULT_ACTION_PAUSE_MS));
}

async function fillHighlighted(locator, value, label) {
  await locator.waitFor({ state: 'visible' });
  await highlight(locator, label);
  await locator.fill(value);
  await new Promise((resolve) => setTimeout(resolve, DEFAULT_ACTION_PAUSE_MS));
}

module.exports = { clickHighlighted, fillHighlighted, highlight };
