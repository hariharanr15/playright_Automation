const { getActionDelayMs, getHighlightDurationMs, isDemoMode } = require('./execution-mode');

async function demoPause() {
  const delayMs = getActionDelayMs();
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

async function highlight(locator, label = 'interaction') {
  if (!isDemoMode()) {
    return;
  }

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

    await new Promise((resolve) => setTimeout(resolve, getHighlightDurationMs()));

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
  await demoPause();
}

async function fillHighlighted(locator, value, label) {
  await locator.waitFor({ state: 'visible' });
  await highlight(locator, label);
  await locator.fill(value);
  await demoPause();
}

async function selectHighlighted(locator, value, label) {
  await locator.waitFor({ state: 'visible' });
  await highlight(locator, label);
  await locator.selectOption(value);
  await demoPause();
}

async function checkHighlighted(locator, checked, label) {
  await locator.waitFor({ state: 'visible' });
  await highlight(locator, label);
  await locator.setChecked(checked);
  await demoPause();
}

async function uploadHighlighted(locator, filePaths, label) {
  await locator.waitFor({ state: 'attached' });
  await highlight(locator, label);
  await locator.setInputFiles(filePaths);
  await demoPause();
}

module.exports = {
  checkHighlighted,
  clickHighlighted,
  fillHighlighted,
  highlight,
  selectHighlighted,
  uploadHighlighted
};
