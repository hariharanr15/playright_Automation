const BOOKING_TYPES = Object.freeze([
  {
    key: 'delivery',
    label: 'Delivery',
    flowName: 'Delivery Booking',
    defaultIndex: 0,
    mandatory: true,
    patterns: [/delivery/i]
  },
  {
    key: 'recurring',
    label: 'Recurring',
    flowName: 'Recurring Booking',
    defaultIndex: 1,
    mandatory: false,
    patterns: [/recurr/i]
  },
  {
    key: 'multiVehicle',
    label: 'Multi-Vehicle',
    flowName: 'Multi-Vehicle Booking',
    defaultIndex: 2,
    mandatory: false,
    patterns: [/multi[\s-]*vehicle/i, /multi/i]
  },
  {
    key: 'resourceOnly',
    label: 'Resource-Only',
    flowName: 'Resource-only Booking',
    defaultIndex: 3,
    mandatory: false,
    patterns: [/resource[\s-]*only/i, /resource/i]
  }
]);

function normalizeBookingTypeLabel(value) {
  return String(value || '')
    .replace(/resource\s+booking/i, 'Resource-Only')
    .replace(/resource\s*only/i, 'Resource-Only')
    .replace(/multi\s*vehicle/i, 'Multi-Vehicle')
    .replace(/\s+/g, ' ')
    .trim();
}

function bookingTypeByLabel(label) {
  const normalized = normalizeBookingTypeLabel(label);
  return BOOKING_TYPES.find((type) =>
    type.label.toLowerCase() === normalized.toLowerCase() ||
    type.flowName.toLowerCase() === normalized.toLowerCase() ||
    type.patterns.some((pattern) => pattern.test(normalized))
  ) || null;
}

async function discoverAvailableBookingTypes(page) {
  const rawTypes = await page.evaluate((typeDefinitions) => {
    const isVisible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0';
    };
    const isEnabled = (element) => {
      const style = window.getComputedStyle(element);
      const className = String(element.className || '');
      return !element.disabled &&
        element.getAttribute('disabled') === null &&
        element.getAttribute('aria-disabled') !== 'true' &&
        style.pointerEvents !== 'none' &&
        !/\bdisabled\b/i.test(className) &&
        Number(style.opacity || '1') >= 0.45;
    };
    const textFor = (element) => [
      element.innerText,
      element.textContent,
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.getAttribute('alt'),
      Array.from(element.querySelectorAll('img'))
        .map((image) => [image.alt, image.title, image.src].filter(Boolean).join(' '))
        .join(' ')
    ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    const classify = (text) => {
      for (const type of typeDefinitions) {
        if (type.patterns.some((source) => new RegExp(source, 'i').test(text))) {
          return type.key;
        }
      }
      return null;
    };
    const nearestClickable = (element) => {
      let current = element;
      for (let depth = 0; current && depth < 5; depth += 1) {
        if (current.matches('button, a, label, [role="button"], .book-type-block, [class*="book-type" i]')) {
          return current;
        }
        current = current.parentElement;
      }
      return element;
    };

    const selectors = [
      '.book-type-block',
      '[class*="book-type-block" i]',
      '[class*="booking-type" i]',
      '[class*="book-type" i]',
      'button',
      '[role="button"]',
      'label'
    ].join(', ');
    const candidates = Array.from(document.querySelectorAll(selectors))
      .filter(isVisible)
      .map((element) => {
        const target = nearestClickable(element);
        const text = textFor(target) || textFor(element);
        const key = classify(text);
        return key ? { key, enabled: isEnabled(target), text } : null;
      })
      .filter(Boolean);

    const byKey = new Map();
    for (const candidate of candidates) {
      const existing = byKey.get(candidate.key);
      byKey.set(candidate.key, {
        key: candidate.key,
        enabled: Boolean(existing?.enabled || candidate.enabled),
        text: existing?.text || candidate.text
      });
    }

    return Array.from(byKey.values());
  }, BOOKING_TYPES.map((type) => ({
    key: type.key,
    patterns: type.patterns.map((pattern) => pattern.source)
  })));

  const byKey = new Map(rawTypes.map((type) => [type.key, type]));
  const delivery = byKey.get('delivery');
  if (!delivery) {
    const firstCardVisible = await page.locator('.book-type-img img, .book-type-block, [class*="book-type" i]')
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    if (firstCardVisible) {
      byKey.set('delivery', {
        key: 'delivery',
        enabled: true,
        text: 'Delivery fallback: first visible booking card'
      });
    }
  }

  return BOOKING_TYPES.map((type) => ({
    ...type,
    available: byKey.has(type.key),
    enabled: byKey.get(type.key)?.enabled ?? false,
    sourceText: byKey.get(type.key)?.text || null
  }));
}

async function clickBookingType(page, label, fallbackIndex = 0) {
  const type = bookingTypeByLabel(label) || BOOKING_TYPES.find((candidate) => candidate.defaultIndex === fallbackIndex);
  const clickTarget = await page.evaluate((typeDefinition) => {
    const isVisible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.pointerEvents !== 'none' &&
        Number(style.opacity || '1') >= 0.45;
    };
    const textFor = (element) => [
      element.innerText,
      element.textContent,
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.getAttribute('alt'),
      Array.from(element.querySelectorAll('img'))
        .map((image) => [image.alt, image.title, image.src].filter(Boolean).join(' '))
        .join(' ')
    ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    const patterns = typeDefinition.patterns.map((source) => new RegExp(source, 'i'));
    const labels = typeDefinition.labels || [];
    const selector = 'img, p, span, label, button, [role="button"], .book-type-block, [class*="book-type" i]';
    const exactLabel = (text) => labels.some((candidate) => candidate.toLowerCase() === text.toLowerCase());
    const containsOtherType = (text) => typeDefinition.otherLabels
      .some((candidate) => new RegExp(candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text));
    const cardFor = (element) => {
      let current = element;
      for (let depth = 0; current && depth < 7; depth += 1) {
        const rect = current.getBoundingClientRect();
        const text = textFor(current);
        const hasCardShape = rect.width >= 120 && rect.width <= 360 && rect.height >= 90 && rect.height <= 260;
        const hasTypeMarker = patterns.some((pattern) => pattern.test(text)) ||
          Array.from(current.querySelectorAll('img')).some((image) => patterns.some((pattern) => pattern.test([image.alt, image.title, image.src].filter(Boolean).join(' '))));
        if (hasCardShape && hasTypeMarker && !containsOtherType(text)) {
          return current;
        }
        current = current.parentElement;
      }
      return element;
    };

    const candidates = Array.from(document.querySelectorAll(selector))
      .filter(isVisible)
      .map((element) => {
        const text = textFor(element);
        const imageText = element.tagName?.toLowerCase() === 'img'
          ? [element.alt, element.title, element.src].filter(Boolean).join(' ')
          : '';
        if (!patterns.some((pattern) => pattern.test(text) || pattern.test(imageText))) return null;
        if (containsOtherType(text)) return null;
        const card = cardFor(element);
        const rect = card.getBoundingClientRect();
        const ownRect = element.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          text,
          score: (exactLabel(text) ? 0 : 1000) + Math.round(ownRect.width * ownRect.height) + text.length
        };
      })
      .filter(Boolean)
      .sort((left, right) => {
        return left.score - right.score || left.y - right.y || left.x - right.x;
      });
    return candidates[0] || null;
  }, {
    labels: [type?.label, normalizeBookingTypeLabel(type?.label)].filter(Boolean),
    otherLabels: BOOKING_TYPES
      .filter((candidate) => candidate.key !== type?.key)
      .map((candidate) => candidate.label),
    patterns: (type?.patterns || []).map((pattern) => pattern.source)
  }).catch(() => false);

  if (clickTarget?.x && clickTarget?.y) {
    await page.mouse.click(clickTarget.x, clickTarget.y);
    await page.waitForTimeout(500);
    return true;
  }

  const fallback = page.locator('.book-type-block, [class*="book-type-block" i]').nth(fallbackIndex);
  await fallback.waitFor({ state: 'visible', timeout: 10000 });
  await fallback.click({ force: true });
  await page.waitForTimeout(500);
  return true;
}

module.exports = {
  BOOKING_TYPES,
  bookingTypeByLabel,
  clickBookingType,
  discoverAvailableBookingTypes,
  normalizeBookingTypeLabel
};
