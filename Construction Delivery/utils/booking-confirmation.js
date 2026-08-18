const BOOKING_REF_PATTERN = /BK[A-Z0-9]{10,}/;
const BOOKING_SUCCESS_PATTERN = /booking\s+created|created\s+booking|thank\s+you\s+for\s+booking|booking\s+(?:submitted|confirmed|approved)\s+successfully|booking\s+successfully\s+(?:submitted|confirmed|created|approved)|(?:submitted|confirmed|created|approved)\s+successfully.{0,80}booking/i;
const FORM_ERROR_PATTERN = /required|mandatory|please select|please enter|invalid|failed|unable|error/i;

async function visibleConfirmationMessages(page) {
  return page.evaluate(({ successSource }) => {
    const successPattern = new RegExp(successSource, 'i');
    const selectors = [
      '[role="alert"]',
      '[role="status"]',
      '.Toastify__toast',
      '.toast',
      '.alert',
      '.MuiAlert-root',
      '.SnackbarItem-message',
      '[class*="toast"]',
      '[class*="snackbar"]',
      '[class*="alert"]',
      '[class*="notification"]'
    ];
    const isVisible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0';
    };
    const normalize = (text) => (text || '').replace(/\s+/g, ' ').trim();
    const messages = Array.from(document.querySelectorAll(selectors.join(', ')))
      .filter(isVisible)
      .map((element) => normalize(element.innerText || element.textContent))
      .filter((text) => text && successPattern.test(text));

    const bodyText = normalize(document.body.innerText || document.body.textContent || '');
    if (successPattern.test(bodyText)) {
      const match = bodyText.match(successPattern);
      if (match) {
        const start = Math.max(0, match.index - 80);
        const end = Math.min(bodyText.length, match.index + match[0].length + 160);
        messages.push(bodyText.slice(start, end));
      }
    }

    return Array.from(new Set(messages));
  }, { successSource: BOOKING_SUCCESS_PATTERN.source });
}

async function visibleFormErrors(page) {
  return page.evaluate(({ errorSource }) => {
    const errorPattern = new RegExp(errorSource, 'i');
    const selectors = [
      '[role="alert"]',
      '.Mui-error',
      '[aria-invalid="true"]',
      '[class*="error"]',
      '[class*="invalid"]'
    ];
    const isVisible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden';
    };

    return Array.from(document.querySelectorAll(selectors.join(', ')))
      .filter(isVisible)
      .map((element) => (element.innerText || element.textContent || element.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim())
      .filter((text) => text && errorPattern.test(text))
      .slice(0, 6);
  }, { errorSource: FORM_ERROR_PATTERN.source });
}

async function waitForBookingConfirmation(page, bookingTypeLabel = 'Booking', timeout = 45000) {
  await page
    .locator('[role="progressbar"], .MuiCircularProgress-root')
    .first()
    .waitFor({ state: 'hidden', timeout })
    .catch(() => null);

  const confirmation = await page.waitForFunction(
    ({ successSource }) => {
      const successPattern = new RegExp(successSource, 'i');
      const selectors = [
        '[role="alert"]',
        '[role="status"]',
        '.Toastify__toast',
        '.toast',
        '.alert',
        '.MuiAlert-root',
        '.SnackbarItem-message',
        '[class*="toast"]',
        '[class*="snackbar"]',
        '[class*="alert"]',
        '[class*="notification"]'
      ];
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0';
      };
      const normalize = (text) => (text || '').replace(/\s+/g, ' ').trim();
      const message = Array.from(document.querySelectorAll(selectors.join(', ')))
        .filter(isVisible)
        .map((element) => normalize(element.innerText || element.textContent))
        .find((text) => successPattern.test(text));

      if (message) {
        return message;
      }

      const bodyText = normalize(document.body.innerText || document.body.textContent || '');
      const bodyMatch = bodyText.match(successPattern);
      if (bodyMatch) {
        const start = Math.max(0, bodyMatch.index - 80);
        const end = Math.min(bodyText.length, bodyMatch.index + bodyMatch[0].length + 160);
        return bodyText.slice(start, end);
      }

      return false;
    },
    { successSource: BOOKING_SUCCESS_PATTERN.source },
    { timeout }
  ).then((handle) => handle.jsonValue()).catch(() => null);

  if (confirmation) {
    const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    const bookingRef = String(confirmation).match(BOOKING_REF_PATTERN)?.[0] ||
      String(bodyText).match(BOOKING_REF_PATTERN)?.[0] ||
      null;
    console.log(`${bookingTypeLabel} confirmation detected: ${confirmation}`);
    return { message: confirmation, bookingRef };
  }

  const errors = await visibleFormErrors(page).catch(() => []);
  const messages = await visibleConfirmationMessages(page).catch(() => []);
  const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
  const visibleText = bodyText.replace(/\s+/g, ' ').trim().slice(0, 1000);

  throw new Error(
    `${bookingTypeLabel} was submitted, but no booking confirmation success message appeared. ` +
    `URL: ${page.url()}. ` +
    `Visible confirmation candidates: ${messages.join(' | ') || '-'}. ` +
    `Visible validation/error messages: ${errors.join(' | ') || '-'}. ` +
    `Page text: ${visibleText || '-'}`
  );
}

module.exports = { waitForBookingConfirmation };
