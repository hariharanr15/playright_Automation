function highlightMs() {
  return Number(process.env.HIGHLIGHT_MS || 0);
}

function actionPauseMs() {
  return Number(process.env.ACTION_PAUSE_MS || 0);
}

function visualEffectsDisabled() {
  return /^(1|true|yes)$/i.test(process.env.DISABLE_AUTOMATION_VISUALS || '');
}

function isDetachedElementError(error) {
  return /not attached to the DOM|Element is not attached/i.test(error?.message || '');
}

async function highlight(locator, label = 'interaction') {
  if (visualEffectsDisabled()) {
    return;
  }

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

    await new Promise((resolve) => setTimeout(resolve, highlightMs()));

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

async function clickHighlighted(locator, label, clickOptions = {}) {
  await locator.waitFor({ state: 'visible' });

  try {
    await highlight(locator, label);
  } catch (error) {
    if (!isDetachedElementError(error)) throw error;
    await locator.waitFor({ state: 'visible' });
  }

  await locator.click(clickOptions);
  await new Promise((resolve) => setTimeout(resolve, actionPauseMs()));
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
  await new Promise((resolve) => setTimeout(resolve, actionPauseMs()));
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
  await new Promise((resolve) => setTimeout(resolve, actionPauseMs()));
}

module.exports = { checkHighlighted, clickHighlighted, fillHighlighted, highlight };
