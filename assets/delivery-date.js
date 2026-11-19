/*
 * Ornis delivery estimate. Pure functions plus a <delivery-estimate> element.
 * All dates are calendar dates in UK time (Europe/London), never the visitor's time zone.
 * The same file is unit tested by Vitest (tests/unit/delivery-date.test.ts).
 */

const DAY_MS = 86400000;

/** Calendar date (YYYY-MM-DD) and hour in Europe/London for a given instant. */
export function londonNow(instant = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (type) => parts.find((p) => p.type === type).value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}

const toUTC = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const toISO = (ms) => new Date(ms).toISOString().slice(0, 10);

/** @param {string} iso @param {Set<string>} holidays */
export function isWorkingDay(iso, holidays) {
  const day = new Date(toUTC(iso)).getUTCDay();
  return day !== 0 && day !== 6 && !holidays.has(iso);
}

/** Move forward `count` working days from `iso` (count 0 returns iso). */
/** @param {string} iso @param {number} count @param {Set<string>} holidays */
export function addWorkingDays(iso, count, holidays) {
  let ms = toUTC(iso);
  let left = count;
  while (left > 0) {
    ms += DAY_MS;
    if (isWorkingDay(toISO(ms), holidays)) left -= 1;
  }
  return toISO(ms);
}

/** @param {string} iso @param {Set<string>} holidays */
export function nextWorkingDay(iso, holidays) {
  let ms = toUTC(iso) + DAY_MS;
  while (!isWorkingDay(toISO(ms), holidays)) ms += DAY_MS;
  return toISO(ms);
}

const toInt = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};

/**
 * Returns { from, to } as YYYY-MM-DD, or null when any fact is missing so no estimate is shown.
 * Orders placed after the cut-off hour, or on a weekend or bank holiday, start processing on the next working day.
 * @param {{ now?: Date, processingDays?: unknown, deliveryMinDays?: unknown, deliveryMaxDays?: unknown, cutoffHour?: unknown, bankHolidays?: string[] }} input
 * @returns {{ from: string, to: string } | null}
 */
export function estimateDelivery({ now = new Date(), processingDays, deliveryMinDays, deliveryMaxDays, cutoffHour = 14, bankHolidays = [] }) {
  const processing = toInt(processingDays);
  const min = toInt(deliveryMinDays);
  const max = toInt(deliveryMaxDays);
  if (processing === null || min === null || max === null || max < min) return null;
  const holidays = new Set((bankHolidays || []).map((d) => String(d).trim()).filter(Boolean));
  const { date, hour } = londonNow(now);
  let start = date;
  if (!isWorkingDay(date, holidays) || hour >= toInt(cutoffHour ?? 14)) start = nextWorkingDay(date, holidays);
  const dispatch = addWorkingDays(start, processing, holidays);
  return { from: addWorkingDays(dispatch, min, holidays), to: addWorkingDays(dispatch, max, holidays) };
}

/** "Tue 18 Nov" in British English. */
export function formatShort(iso) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(toUTC(iso)))
    .replace(',', '');
}

if (typeof window !== 'undefined' && window.customElements && !window.customElements.get('delivery-estimate')) {
  class DeliveryEstimate extends HTMLElement {
    connectedCallback() {
      const facts = (window.Ornis && window.Ornis.facts) || {};
      const result = estimateDelivery({
        now: this.dataset.now ? new Date(this.dataset.now) : new Date(),
        processingDays: facts.processingDays,
        deliveryMinDays: this.dataset.min || facts.deliveryMinDays,
        deliveryMaxDays: this.dataset.max || facts.deliveryMaxDays,
        cutoffHour: facts.cutoffHour,
        bankHolidays: facts.bankHolidays,
      });
      if (!result) { this.hidden = true; return; }
      const template = (facts.strings && facts.strings.arrives) || 'Order today, arrives between [from] and [to]';
      const text = template.replace('[from]', formatShort(result.from)).replace('[to]', formatShort(result.to));
      const target = this.querySelector('[data-estimate-text]') || this;
      target.textContent = text;
      this.hidden = false;
    }
  }
  window.customElements.define('delivery-estimate', DeliveryEstimate);
}
