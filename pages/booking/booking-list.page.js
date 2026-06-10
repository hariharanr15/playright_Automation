const { clickHighlighted, highlight } = require('../../utils/highlight');

class BookingListPage {
  constructor(page) {
    this.page = page;
    this.actionWaitMs = Number(process.env.BOOKING_LIST_ACTION_WAIT_MS || 3000);
    this.hoverWaitMs = Number(process.env.BOOKING_LIST_HOVER_WAIT_MS || this.actionWaitMs);
    this.statuses = [
      'Active',
      'Scheduled',
      'Checked In',
      'Checked Out',
      'For Approval',
      'Refused',
      'Declined',
      'Cancelled'
    ];
    this.countableStatuses = this.statuses.filter((status) => status !== 'Active');
  }

  async pause(label = 'Booking List action') {
    if (label) {
      console.log(`Waiting after ${label} (${this.actionWaitMs} ms)...`);
    }
    await this.page.waitForTimeout(this.actionWaitMs);
  }

  async waitForList() {
    await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    await this.page.locator('[role="progressbar"], .MuiCircularProgress-root').first()
      .waitFor({ state: 'hidden', timeout: 30000 })
      .catch(() => null);
    await this.pause('Booking List load');
  }

  statusPattern(status) {
    const patterns = {
      'Checked In': String.raw`Checked\s*-?\s*In`,
      'Checked Out': String.raw`Checked\s*-?\s*Out`,
      'For Approval': String.raw`For\s+Approval`
    };

    return patterns[status] || status.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, String.raw`\s+`);
  }

  async openStatusTab(status) {
    const pattern = new RegExp(`^${this.statusPattern(status)}\\s+\\d+$`, 'i');
    const tabCandidates = [
      this.page.getByRole('tab', { name: pattern }).first(),
      this.page.getByRole('button', { name: pattern }).first(),
      this.page.getByRole('link', { name: pattern }).first(),
      this.page.getByText(pattern).first()
    ];

    for (const tab of tabCandidates) {
      if (await tab.isVisible({ timeout: 2500 }).catch(() => false)) {
        await clickHighlighted(tab, `${status} tab`);
        await this.waitForList();
        await this.pause(`${status} tab selection`);
        return true;
      }
    }

    const marked = await this.page.evaluate(({ statusLabel, statusSource }) => {
      document.querySelectorAll('[data-vc-status-tab="true"]').forEach((element) => {
        element.removeAttribute('data-vc-status-tab');
      });

      const normalizedStatus = statusLabel.toLowerCase().replace(/\s+/g, ' ').trim();
      const statusPattern = new RegExp(`^${statusSource}$`, 'i');
      const isDisplayed = (element) => {
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
      };
      const isInsideBookingRows = (element) => Boolean(
        element.closest('table, tbody, thead, tr, td, th, [role="row"], [role="cell"], [role="columnheader"]')
      );
      const textOf = (element) => (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
      const isClickable = (element) => {
        if (!element) return false;
        const tagName = element.tagName.toLowerCase();
        return tagName === 'button' ||
          tagName === 'a' ||
          element.getAttribute('role') === 'tab' ||
          element.getAttribute('role') === 'button' ||
          window.getComputedStyle(element).cursor === 'pointer' ||
          typeof element.onclick === 'function';
      };
      const clickableAncestor = (element) => {
        let current = element;
        for (let depth = 0; current && depth < 6; depth += 1) {
          if (isClickable(current)) return current;
          current = current.parentElement;
        }

        return element;
      };

      const candidates = Array.from(document.querySelectorAll('button, a, [role="tab"], [role="button"], li, span, div'))
        .filter((element) => isDisplayed(element) && !isInsideBookingRows(element));

      const exactLabel = candidates.find((element) => {
        const text = textOf(element).toLowerCase();
        return text === normalizedStatus || statusPattern.test(text);
      });
      const labelWithCount = candidates.find((element) => {
        const text = textOf(element);
        return new RegExp(`^${statusSource}\\s+\\d+$`, 'i').test(text);
      });
      const nearbyCountLabel = candidates.find((element) => {
        const text = textOf(element).toLowerCase();
        if (text !== normalizedStatus) return false;

        const parentText = textOf(element.parentElement || element);
        return new RegExp(`\\b${statusSource}\\b\\s+\\d+`, 'i').test(parentText);
      });

      const target = clickableAncestor(labelWithCount || nearbyCountLabel || exactLabel);
      if (!target) {
        return false;
      }

      target.setAttribute('data-vc-status-tab', 'true');
      return true;
    }, { statusLabel: status, statusSource: this.statusPattern(status) });

    if (marked) {
      const tab = this.page.locator('[data-vc-status-tab="true"]').first();
      await clickHighlighted(tab, `${status} tab`);
      await this.waitForList();
      await this.pause(`${status} tab selection`);
      return true;
    }

    throw new Error(`Could not find Booking List status tab: ${status}.`);
  }

  async getStatusTabCounts() {
    const statuses = ['All', ...this.statuses];

    return await this.page.evaluate((statusLabels) => {
      const isDisplayed = (element) => {
        const style = window.getComputedStyle(element);
        return style.display !== 'none' &&
          style.visibility !== 'hidden';
      };
      const isInsideBookingRows = (element) => Boolean(
        element.closest('table, tbody, thead, tr, td, th, [role="row"], [role="cell"], [role="columnheader"]')
      );
      const patternFor = (label) => {
        const source = label
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\s+/g, String.raw`\s+`)
          .replace(/Checked\\s\+Out/i, String.raw`Checked\s*-?\s*Out`)
          .replace(/Checked\\s\+In/i, String.raw`Checked\s*-?\s*In`);
        return new RegExp(`^${source}\\s+(\\d+)$`, 'i');
      };

      const visibleTexts = Array.from(document.querySelectorAll('button, a, [role="tab"], [role="button"], li, span, div'))
        .filter((element) => isDisplayed(element) && !isInsideBookingRows(element))
        .map((element) => (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);

      const counts = {};

      for (const label of statusLabels) {
        const elementPattern = patternFor(label);
        const elementText = visibleTexts.find((text) => elementPattern.test(text));
        const elementMatch = elementText ? elementText.match(elementPattern) : null;

        if (elementMatch) {
          counts[label] = Number(elementMatch[1]);
        }
      }

      return counts;
    }, statuses);
  }

  async assertAllCountMatchesStatusTabs() {
    const counts = await this.getStatusTabCounts();
    const missing = ['All', ...this.statuses].filter((status) => !Number.isInteger(counts[status]));

    if (missing.length > 0) {
      throw new Error(`Missing Booking List status count(s): ${missing.join(', ')}. Found: ${JSON.stringify(counts)}`);
    }

    const individualTotal = this.countableStatuses.reduce((total, status) => total + counts[status], 0);
    if (individualTotal !== counts.All) {
      throw new Error(`All count mismatch. All=${counts.All}, individual statuses total=${individualTotal}, counts=${JSON.stringify(counts)}`);
    }

    return counts;
  }

  async getVisibleBookingIds() {
    return await this.page.evaluate(() => {
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden';
      };

      const ids = [];
      const rows = Array.from(document.querySelectorAll('table tbody tr, tr, [role="row"], .booking-row, .table-row'));
      for (const row of rows) {
        if (!isVisible(row)) continue;
        const match = (row.innerText || row.textContent || '').match(/BK[A-Z0-9]{10,}/);
        if (match) ids.push(match[0]);
      }

      return Array.from(new Set(ids));
    });
  }

  async getVisibleBookingRowKeys() {
    return await this.page.evaluate(() => {
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden';
      };

      const keys = [];
      const textCounts = new Map();
      const rows = Array.from(document.querySelectorAll('table tbody tr, tr, [role="row"], .booking-row, .table-row'));
      for (const row of rows) {
        if (!isVisible(row)) continue;
        const text = (row.innerText || row.textContent || '').replace(/\s+/g, ' ').trim();
        if (!/BK[A-Z0-9]{10,}/.test(text)) continue;
        const occurrence = (textCounts.get(text) || 0) + 1;
        textCounts.set(text, occurrence);
        keys.push(`${text} #${occurrence}`);
      }

      return Array.from(new Set(keys));
    });
  }

  async getVisibleBookingRefs() {
    return await this.page.evaluate(() => {
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden';
      };

      const refs = [];
      const rows = Array.from(document.querySelectorAll('table tbody tr, [role="row"], .booking-row, .table-row'));
      for (const row of rows) {
        if (!isVisible(row)) continue;
        const match = (row.innerText || row.textContent || '').match(/BK[A-Z0-9]{10,}/);
        if (match) refs.push(match[0]);
      }

      return Array.from(new Set(refs));
    });
  }

  compareBookingRefs(left, right) {
    return String(left).localeCompare(String(right), undefined, {
      numeric: true,
      sensitivity: 'base'
    });
  }

  isBookingRefsSorted(refs, direction = 'ascending') {
    const factor = direction === 'descending' ? -1 : 1;

    return refs.every((ref, index) => {
      if (index === 0) return true;
      return this.compareBookingRefs(refs[index - 1], ref) * factor <= 0;
    });
  }

  async markBookingRefSortHeader() {
    return await this.page.evaluate(() => {
      document.querySelectorAll('[data-vc-booking-ref-sort-header="true"]').forEach((element) => {
        element.removeAttribute('data-vc-booking-ref-sort-header');
      });

      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden';
      };
      const textOf = (element) => (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
      const clickableAncestor = (element) => {
        let current = element;
        for (let depth = 0; current && depth < 8; depth += 1) {
          if (
            current.matches('button, a, th, [role="button"], [role="columnheader"], .MuiDataGrid-columnHeader') ||
            window.getComputedStyle(current).cursor === 'pointer' ||
            typeof current.onclick === 'function'
          ) {
            return current;
          }
          current = current.parentElement;
        }

        return element;
      };

      const candidates = Array.from(document.querySelectorAll(
        'th, [role="columnheader"], button, [role="button"], .MuiDataGrid-columnHeader, span, div'
      )).filter((element) => {
        if (!isVisible(element)) return false;
        if (element.closest('tbody, [role="rowgroup"]')) return false;
        return /(^|\b)Booking\s*Ref(\b|$)/i.test(textOf(element));
      });

      const exact = candidates.find((element) => /^Booking\s*Ref$/i.test(textOf(element)));
      const target = clickableAncestor(exact || candidates[0]);
      if (!target) return false;

      target.setAttribute('data-vc-booking-ref-sort-header', 'true');
      return true;
    });
  }

  async sortByBookingRef(direction = 'ascending') {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if (!await this.markBookingRefSortHeader()) {
        throw new Error('Could not find the Booking Ref column header to sort the Booking List.');
      }

      const header = this.page.locator('[data-vc-booking-ref-sort-header="true"]').first();
      await clickHighlighted(header, `Booking Ref sort ${direction}`);
      await this.waitForList();
      await this.pause(`Booking Ref sort attempt ${attempt}`);

      const refs = await this.getVisibleBookingRefs();
      if (refs.length <= 1 || this.isBookingRefsSorted(refs, direction)) {
        return refs;
      }
    }

    const refs = await this.getVisibleBookingRefs();
    throw new Error(`Booking Ref column did not sort ${direction}. Visible refs: ${refs.join(', ') || 'none'}`);
  }

  async markNextPaginationButton() {
    return await this.page.evaluate(() => {
      document.querySelectorAll('[data-vc-pagination-next="true"]').forEach((element) => {
        element.removeAttribute('data-vc-pagination-next');
      });

      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden';
      };
      const isEnabled = (element) => !element.disabled &&
        element.getAttribute('aria-disabled') !== 'true' &&
        !/\bdisabled\b/i.test(element.className || '');

      const controls = Array.from(document.querySelectorAll('button, a, [role="button"]'))
        .filter((control) => isVisible(control) && isEnabled(control));
      const explicitNext = controls.find((control) => {
        const label = [
          control.innerText,
          control.textContent,
          control.getAttribute('aria-label'),
          control.getAttribute('title'),
          control.getAttribute('data-testid'),
          control.outerHTML
        ].filter(Boolean).join(' ');
        return /\bnext\b|NavigateNext|KeyboardArrowRight|chevron_right/i.test(label);
      });

      const target = explicitNext || controls
        .filter((control) => {
          const rect = control.getBoundingClientRect();
          const text = (control.innerText || control.textContent || '').replace(/\s+/g, ' ').trim();
          return rect.top > window.innerHeight * 0.55 &&
            rect.left > window.innerWidth * 0.45 &&
            (/^>$|^›$|^»$/.test(text) || control.querySelector('svg'));
        })
        .sort((left, right) => {
          const leftRect = left.getBoundingClientRect();
          const rightRect = right.getBoundingClientRect();
          return rightRect.left - leftRect.left;
        })[0];

      if (!target) return false;
      target.setAttribute('data-vc-pagination-next', 'true');
      return true;
    });
  }

  async clickNextPageIfAvailable() {
    if (!await this.markNextPaginationButton()) {
      return false;
    }

    const beforeRows = (await this.getVisibleBookingRowKeys()).join('|');
    const nextButton = this.page.locator('[data-vc-pagination-next="true"]').first();
    await clickHighlighted(nextButton, 'Next page');
    await this.waitForList();
    await this.pause('pagination next page');
    const afterRows = (await this.getVisibleBookingRowKeys()).join('|');
    return beforeRows !== afterRows;
  }

  async collectCurrentPageBookingRows(expectedCount = 0) {
    const seen = new Set();
    const getScrollState = async () => await this.page.evaluate(() => {
      const isScrollable = (element) => {
        const style = window.getComputedStyle(element);
        return element.scrollHeight > element.clientHeight + 2 &&
          !/hidden/i.test(style.overflowY || '');
      };
      const table = document.querySelector('table');
      const candidates = [
        table?.parentElement,
        table?.closest('[role="tabpanel"]'),
        ...Array.from(document.querySelectorAll('main, section, [role="tabpanel"], div'))
      ].filter(Boolean);
      const target = candidates.find(isScrollable) || document.scrollingElement || document.documentElement;

      target.setAttribute('data-vc-booking-scroll-container', 'true');
      return {
        top: target.scrollTop,
        maxTop: Math.max(0, target.scrollHeight - target.clientHeight),
        canScroll: target.scrollHeight > target.clientHeight + 2
      };
    });

    await this.page.evaluate(() => {
      const previous = document.querySelector('[data-vc-booking-scroll-container="true"]');
      if (previous) previous.removeAttribute('data-vc-booking-scroll-container');
    }).catch(() => null);

    await getScrollState();
    await this.page.locator('[data-vc-booking-scroll-container="true"]').evaluate((element) => {
      element.scrollTop = 0;
    }).catch(() => null);
    await this.page.waitForTimeout(500);

    for (let scrollAttempt = 0; scrollAttempt < 30; scrollAttempt += 1) {
      const visibleRows = await this.getVisibleBookingRowKeys();
      visibleRows.forEach((rowKey) => seen.add(rowKey));

      if (expectedCount > 0 && seen.size >= expectedCount) {
        break;
      }

      const state = await getScrollState();
      if (!state.canScroll || state.top >= state.maxTop - 2) {
        break;
      }

      await this.page.locator('[data-vc-booking-scroll-container="true"]').evaluate((element) => {
        element.scrollTop += Math.max(160, Math.floor(element.clientHeight * 0.8));
      }).catch(() => null);
      await this.page.waitForTimeout(500);
    }

    await this.page.locator('[data-vc-booking-scroll-container="true"]').evaluate((element) => {
      element.scrollTop = 0;
    }).catch(() => null);

    return Array.from(seen);
  }

  async countBookingsAcrossPaginationForStatus(status, expectedCount, options = {}) {
    const throwOnMismatch = options.throwOnMismatch ?? true;
    await this.openStatusTab(status);
    const seen = new Set();

    for (let pageIndex = 0; pageIndex < 100; pageIndex++) {
      const visibleRows = await this.collectCurrentPageBookingRows(expectedCount);
      visibleRows.forEach((rowKey) => seen.add(rowKey));

      if (seen.size >= expectedCount) {
        break;
      }

      if (!await this.clickNextPageIfAvailable()) {
        break;
      }
    }

    if (throwOnMismatch && seen.size !== expectedCount) {
      throw new Error(`${status} pagination count mismatch. Expected ${expectedCount}, counted ${seen.size}.`);
    }

    return seen.size;
  }

  async getPaginatedStatusCounts(tabCounts) {
    const observed = {};

    for (const status of this.statuses) {
      try {
        observed[status] = await this.countBookingsAcrossPaginationForStatus(status, tabCounts[status], {
          throwOnMismatch: false
        });
      } catch (error) {
        console.log(`Could not count ${status} records across pagination: ${error.message}`);
        observed[status] = null;
      }
    }

    return observed;
  }

  async assertPaginatedStatusCountsMatchAll(tabCounts) {
    const observed = await this.getPaginatedStatusCounts(tabCounts);
    const observedTotal = this.countableStatuses.reduce((total, status) => total + observed[status], 0);
    if (observedTotal !== tabCounts.All) {
      throw new Error(`Paginated status total mismatch. All=${tabCounts.All}, observed total=${observedTotal}, observed=${JSON.stringify(observed)}`);
    }

    return observed;
  }

  escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  buildCountVerificationHtml(tabCounts, paginatedCounts) {
    const tabTotal = this.countableStatuses.reduce((total, status) => total + (tabCounts[status] || 0), 0);
    const paginatedTotal = this.countableStatuses.reduce((total, status) => total + (paginatedCounts[status] || 0), 0);
    const matched = tabCounts.All === tabTotal && tabCounts.All === paginatedTotal;
    const rows = this.statuses.map((status) => {
      const tabCount = tabCounts[status] || 0;
      const paginatedCount = paginatedCounts[status] || 0;
      const statusMatched = tabCount === paginatedCount;

      return `
        <tr>
          <td>${this.escapeHtml(status)}</td>
          <td>${tabCount}</td>
          <td>${paginatedCount}</td>
          <td class="${statusMatched ? 'pass' : 'fail'}">${statusMatched ? 'Matched' : 'Mismatch'}</td>
        </tr>`;
    }).join('');

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Booking List Count Verification</title>
  <style>
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      color: #1f2937;
      background: #f8fafc;
    }
    main {
      max-width: 980px;
      margin: 0 auto;
      padding: 32px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 28px;
      letter-spacing: 0;
    }
    .summary {
      margin: 20px 0;
      padding: 18px;
      border: 1px solid ${matched ? '#16a34a' : '#dc2626'};
      background: ${matched ? '#f0fdf4' : '#fef2f2'};
      border-radius: 6px;
    }
    .result {
      font-size: 20px;
      font-weight: 700;
      color: ${matched ? '#15803d' : '#b91c1c'};
    }
    .counts {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-top: 16px;
    }
    .metric {
      padding: 14px;
      border: 1px solid #cbd5e1;
      background: #fff;
      border-radius: 6px;
    }
    .metric span {
      display: block;
      color: #64748b;
      font-size: 13px;
      margin-bottom: 6px;
    }
    .metric strong {
      font-size: 24px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: #fff;
      border: 1px solid #cbd5e1;
    }
    th,
    td {
      padding: 12px 14px;
      border-bottom: 1px solid #e2e8f0;
      text-align: left;
    }
    th {
      background: #e2e8f0;
    }
    .pass {
      color: #15803d;
      font-weight: 700;
    }
    .fail {
      color: #b91c1c;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <main>
    <h1>Booking List Count Verification</h1>
    <p>All count is verified against individual status counts and paginated booking records.</p>
    <section class="summary">
      <div class="result">${matched ? 'Record counts matched' : 'Record counts did not match'}</div>
      <div class="counts">
        <div class="metric"><span>All count</span><strong>${tabCounts.All || 0}</strong></div>
        <div class="metric"><span>Status tab total</span><strong>${tabTotal}</strong></div>
        <div class="metric"><span>Paginated record total</span><strong>${paginatedTotal}</strong></div>
      </div>
    </section>
    <table>
      <thead>
        <tr>
          <th>Status</th>
          <th>Status tab count</th>
          <th>Paginated record count</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </main>
</body>
</html>`;
  }

  async openCountVerificationResultTab(tabCounts, paginatedCounts) {
    const resultPage = await this.page.context().newPage();
    await resultPage.setContent(this.buildCountVerificationHtml(tabCounts, paginatedCounts), {
      waitUntil: 'domcontentloaded'
    });
    await resultPage.bringToFront();
    await resultPage.waitForTimeout(this.actionWaitMs);
    return resultPage;
  }

  async findBookingRowsByStatus(status) {
    const source = this.statusPattern(status);

    return await this.page.evaluate((statusSource) => {
      document.querySelectorAll('[data-vc-booking-row-id]').forEach((element) => {
        element.removeAttribute('data-vc-booking-row-id');
      });

      const statusPattern = new RegExp(`\\b${statusSource}\\b`, 'i');
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden';
      };

      const candidates = Array.from(document.querySelectorAll('table tbody tr, tr, [role="row"], .booking-row, .table-row'));
      const seen = new Set();
      const rows = [];

      for (const row of candidates) {
        if (!isVisible(row)) continue;
        const text = row.innerText || row.textContent || '';
        const bookingIdMatch = text.match(/BK[A-Z0-9]{10,}/);
        if (!bookingIdMatch || !statusPattern.test(text)) continue;

        const bookingId = bookingIdMatch[0];
        if (seen.has(bookingId)) continue;

        seen.add(bookingId);
        row.setAttribute('data-vc-booking-row-id', bookingId);
        rows.push({
          bookingId,
          rowText: text.replace(/\s+/g, ' ').trim().slice(0, 300)
        });
      }

      return rows;
    }, source);
  }

  async markBookingRow(bookingId) {
    return await this.page.evaluate((id) => {
      document.querySelectorAll('[data-vc-booking-row-id]').forEach((element) => {
        element.removeAttribute('data-vc-booking-row-id');
      });

      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden';
      };

      const rows = Array.from(document.querySelectorAll('table tbody tr, tr, [role="row"], .booking-row, .table-row'));
      const row = rows.find((candidate) => isVisible(candidate) && (candidate.innerText || candidate.textContent || '').includes(id));
      if (!row) return false;

      row.setAttribute('data-vc-booking-row-id', id);
      return true;
    }, bookingId);
  }

  rowLocator(bookingId) {
    return this.page.locator(`[data-vc-booking-row-id="${bookingId}"]`).first();
  }

  async hoverBookingStatus(bookingId, status = null) {
    if (!await this.markBookingRow(bookingId)) {
      throw new Error(`Could not find booking row ${bookingId}.`);
    }

    const row = this.rowLocator(bookingId);
    await row.scrollIntoViewIfNeeded().catch(() => null);
    const statusText = status
      ? row.getByText(new RegExp(this.statusPattern(status), 'i')).first()
      : null;

    if (statusText && await statusText.isVisible({ timeout: 1000 }).catch(() => false)) {
      await highlight(statusText, `${status} status`);
      await statusText.hover({ force: true });
    } else {
      await highlight(row, `Booking ${bookingId}`);
      await row.hover({ force: true });
    }

    await this.page.waitForTimeout(this.hoverWaitMs);
  }

  async getVisibleStatusActionsForRow(bookingId) {
    return await this.page.evaluate((id) => {
      const row = document.querySelector(`[data-vc-booking-row-id="${id}"]`);
      if (!row) return [];

      const rowRect = row.getBoundingClientRect();
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0';
      };
      const classify = (text) => {
        if (/check\s*[- ]?\s*in|checked-in|checkin|how_to_reg|assignment_turned_in|check_circle/i.test(text)) {
          return 'checkIn';
        }
        if (/check\s*[- ]?\s*out|checked-out|checkout|logout|exit_to_app/i.test(text)) {
          return 'checkOut';
        }
        if (/refuse|refused|reject|decline|not_interested|block/i.test(text)) {
          return 'refuse';
        }

        return null;
      };

      return Array.from(document.querySelectorAll('button, a, [role="button"]'))
        .filter(isVisible)
        .map((control) => {
          const rect = control.getBoundingClientRect();
          const text = [
            control.innerText,
            control.textContent,
            control.getAttribute('title'),
            control.getAttribute('aria-label'),
            control.getAttribute('data-testid'),
            control.className,
            control.outerHTML
          ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

          return {
            text,
            type: classify(text),
            inRow: row.contains(control),
            nearRow: rect.bottom >= rowRect.top - 8 &&
              rect.top <= rowRect.bottom + 8 &&
              rect.left >= rowRect.left - 8 &&
              rect.right <= rowRect.right + 160
          };
        })
        .filter((action) => (action.inRow || action.nearRow) && action.type);
    }, bookingId);
  }

  async getRowStatusActions(bookingId, status = null) {
    await this.hoverBookingStatus(bookingId, status);
    return await this.getVisibleStatusActionsForRow(bookingId);
  }

  async markStatusAction(bookingId, actionType) {
    return await this.page.evaluate(({ id, action }) => {
      document.querySelectorAll('[data-vc-status-action]').forEach((element) => {
        element.removeAttribute('data-vc-status-action');
      });

      const row = document.querySelector(`[data-vc-booking-row-id="${id}"]`);
      if (!row) return false;

      const rowRect = row.getBoundingClientRect();
      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 &&
          rect.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0';
      };
      const classify = (text) => {
        if (/check\s*[- ]?\s*in|checked-in|checkin|how_to_reg|assignment_turned_in|check_circle/i.test(text)) {
          return 'checkIn';
        }
        if (/check\s*[- ]?\s*out|checked-out|checkout|logout|exit_to_app/i.test(text)) {
          return 'checkOut';
        }
        if (/refuse|refused|reject|decline|not_interested|block/i.test(text)) {
          return 'refuse';
        }

        return null;
      };

      const controls = Array.from(document.querySelectorAll('button, a, [role="button"]'))
        .filter(isVisible)
        .map((control) => {
          const rect = control.getBoundingClientRect();
          const text = [
            control.innerText,
            control.textContent,
            control.getAttribute('title'),
            control.getAttribute('aria-label'),
            control.getAttribute('data-testid'),
            control.className,
            control.outerHTML
          ].filter(Boolean).join(' ');

          return {
            control,
            text,
            type: classify(text),
            inRow: row.contains(control),
            nearRow: rect.bottom >= rowRect.top - 8 &&
              rect.top <= rowRect.bottom + 8 &&
              rect.left >= rowRect.left - 8 &&
              rect.right <= rowRect.right + 160
          };
        })
        .filter((candidate) => candidate.inRow || candidate.nearRow);

      const typedInRow = controls.find((candidate) => candidate.inRow && candidate.type === action);
      const typedNearRow = controls.find((candidate) => candidate.nearRow && candidate.type === action);
      const rowControls = controls.filter((candidate) => candidate.inRow).map((candidate) => candidate.control);
      const nearbyControls = controls.filter((candidate) => candidate.nearRow).map((candidate) => candidate.control);
      const fallback = action === 'refuse'
        ? (rowControls[1] || nearbyControls[1])
        : (rowControls[0] || nearbyControls[0]);
      const target = typedInRow?.control || typedNearRow?.control || fallback;
      if (!target) return false;

      target.setAttribute('data-vc-status-action', action);
      return true;
    }, { id: bookingId, action: actionType });
  }

  async confirmStatusPromptIfVisible(actionLabel) {
    const candidates = [
      this.page.getByRole('button', { name: /^Yes$/i }).first(),
      this.page.getByRole('button', { name: /^Confirm$/i }).first(),
      this.page.getByRole('button', { name: new RegExp(`^${actionLabel}$`, 'i') }).last(),
      this.page.locator(`button:has-text("${actionLabel}"), [role="button"]:has-text("${actionLabel}")`).last()
    ];

    for (const candidate of candidates) {
      if (await candidate.isVisible({ timeout: 2500 }).catch(() => false)) {
        await clickHighlighted(candidate, `Confirm ${actionLabel}`);
        await this.waitForList();
        await this.pause(`${actionLabel} confirmation`);
        return true;
      }
    }

    return false;
  }

  async clickRowStatusAction(bookingId, actionType, status = null) {
    await this.hoverBookingStatus(bookingId, status);

    if (!await this.markStatusAction(bookingId, actionType)) {
      throw new Error(`Could not find ${actionType} hover action for booking ${bookingId}.`);
    }

    const action = this.page.locator(`[data-vc-status-action="${actionType}"]`).first();
    await action.waitFor({ state: 'visible' });
    await highlight(action, actionType);
    await action.click({ force: true });
    await this.pause(`${actionType} click`);
    await this.confirmStatusPromptIfVisible(actionType === 'refuse' ? 'Refuse' : 'Yes');
    await this.waitForList();
  }

  async findBookingAcrossCurrentPagination(bookingId, expectedStatus) {
    const source = this.statusPattern(expectedStatus);

    for (let pageIndex = 0; pageIndex < 100; pageIndex += 1) {
      const found = await this.page.evaluate(({ id, statusSource }) => {
        const statusPattern = new RegExp(`\\b${statusSource}\\b`, 'i');
        const rows = Array.from(document.querySelectorAll('table tbody tr, tr, [role="row"], .booking-row, .table-row'));
        return rows.some((row) => {
          const text = row.innerText || row.textContent || '';
          return text.includes(id) && statusPattern.test(text);
        });
      }, { id: bookingId, statusSource: source });

      if (found) {
        await this.markBookingRow(bookingId);
        return true;
      }

      if (!await this.clickNextPageIfAvailable()) {
        break;
      }
    }

    return false;
  }

  async waitForBookingStatus(bookingId, expectedStatus, timeout = 30000) {
    const source = this.statusPattern(expectedStatus);
    try {
      await this.page.waitForFunction(
        ({ id, statusSource }) => {
          const statusPattern = new RegExp(`\\b${statusSource}\\b`, 'i');
          const rows = Array.from(document.querySelectorAll('table tbody tr, tr, [role="row"], .booking-row, .table-row'));
          return rows.some((row) => {
            const text = row.innerText || row.textContent || '';
            return text.includes(id) && statusPattern.test(text);
          });
        },
        { id: bookingId, statusSource: source },
        { timeout }
      );
    } catch (error) {
      await this.openStatusTab(expectedStatus);
      if (!await this.findBookingAcrossCurrentPagination(bookingId, expectedStatus)) {
        throw error;
      }
    }

    await this.markBookingRow(bookingId);
    await this.pause(`${bookingId} ${expectedStatus} status verification`);
  }

  async findScheduledBookingWithActions(requiredActions = ['checkIn', 'refuse']) {
    await this.openStatusTab('All');
    const scheduledRows = await this.findBookingRowsByStatus('Scheduled');

    for (const row of scheduledRows) {
      const actions = await this.getRowStatusActions(row.bookingId, 'Scheduled');
      await this.pause(`${row.bookingId} Scheduled hover action discovery`);
      const actionTypes = new Set(actions.map((action) => action.type));

      if (requiredActions.every((action) => actionTypes.has(action))) {
        return {
          ...row,
          actions
        };
      }
    }

    throw new Error(`No Scheduled booking exposed the expected hover action(s): ${requiredActions.join(', ')}.`);
  }
}

module.exports = { BookingListPage };
