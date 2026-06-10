const DEFAULT_HIGHLIGHT_MS = Number(process.env.HIGHLIGHT_MS || 700);
const DEFAULT_ACTION_PAUSE_MS = Number(process.env.ACTION_PAUSE_MS || 500);

function isDetachedElementError(error) {
  return /not attached to the DOM|Element is not attached/i.test(error?.message || '');
}

async function highlight(locator, label = 'interaction') {
  try {
    await locator.scrollIntoViewIfNeeded({ timeout: 5000 });

    await locator.evaluate(
      (element, interactionLabel) => {
        const previousOutline = element.style.outline;
        const previousBoxShadow = element.style.boxShadow;
        const previousTransition = element.style.transition;

        element.dataset.previousOutline = previousOutline;
        element.dataset.previousBoxShadow = previousBoxShadow;
        element.dataset.previousTransition = previousTransition;
        element.dataset.highlightLabel = interactionLabel;

        element.style.transition = 'outline 120ms ease, box-shadow 120ms ease';
        element.style.outline = '4px solid #ff2d55';
        element.style.boxShadow = '0 0 0 8px rgba(255, 45, 85, 0.28)';
      },
      label
    );

    await new Promise((resolve) => setTimeout(resolve, DEFAULT_HIGHLIGHT_MS));

    await locator.evaluate((element) => {
      element.style.outline = element.dataset.previousOutline || '';
      element.style.boxShadow = element.dataset.previousBoxShadow || '';
      element.style.transition = element.dataset.previousTransition || '';

      delete element.dataset.previousOutline;
      delete element.dataset.previousBoxShadow;
      delete element.dataset.previousTransition;
      delete element.dataset.highlightLabel;
    }).catch(() => null);
  } catch (error) {
    console.log(`Skipping highlight for ${label}: ${error.message}`);
  }
}

async function clickHighlighted(locator, label) {
  await locator.waitFor({ state: 'visible' });

  try {
    await highlight(locator, label);
  } catch (error) {
    if (!isDetachedElementError(error)) throw error;
    await locator.waitFor({ state: 'visible' });
  }

  await locator.click();
  await new Promise((resolve) => setTimeout(resolve, DEFAULT_ACTION_PAUSE_MS));
}

async function fillHighlighted(locator, value, label) {
  await locator.waitFor({ state: 'visible' });
  try {
    await highlight(locator, label);
  } catch (error) {
    if (!isDetachedElementError(error)) throw error;
    await locator.waitFor({ state: 'visible' });
  }
  await locator.fill(value);
  await new Promise((resolve) => setTimeout(resolve, DEFAULT_ACTION_PAUSE_MS));
}

async function checkHighlighted(locator, label) {
  await locator.waitFor({ state: 'visible' });

  if (await locator.isChecked()) {
    return;
  }

  try {
    await highlight(locator, label);
  } catch (error) {
    if (!isDetachedElementError(error)) throw error;
    await locator.waitFor({ state: 'visible' });
  }
  await locator.check();
  await new Promise((resolve) => setTimeout(resolve, DEFAULT_ACTION_PAUSE_MS));
}

module.exports = { checkHighlighted, clickHighlighted, fillHighlighted, highlight };
