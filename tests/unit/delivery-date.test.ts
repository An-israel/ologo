import { describe, expect, it } from 'vitest';
// The exact file the theme serves, so the storefront and the tests share one implementation.
import { addWorkingDays, estimateDelivery, formatShort, isWorkingDay, londonNow } from '../../theme/assets/delivery-date.js';

const holidays2026 = ['2026-12-25', '2026-12-28', '2027-01-01'];

describe('delivery estimate', () => {
  it('uses UK time, not the visitor time zone', () => {
    // 23:30 UTC on 30 June 2026 is 00:30 on 1 July in London (BST)
    expect(londonNow(new Date('2026-06-30T23:30:00Z'))).toEqual({ date: '2026-07-01', hour: 0 });
    // In winter London equals UTC
    expect(londonNow(new Date('2026-11-12T13:59:00Z'))).toEqual({ date: '2026-11-12', hour: 13 });
  });

  it('skips weekends and bank holidays', () => {
    const set = new Set(holidays2026);
    expect(isWorkingDay('2026-11-14', set)).toBe(false); // Saturday
    expect(isWorkingDay('2026-12-28', set)).toBe(false); // Boxing Day substitute
    expect(addWorkingDays('2026-11-13', 1, set)).toBe('2026-11-16'); // Fri + 1 = Mon
    expect(addWorkingDays('2026-12-24', 1, set)).toBe('2026-12-29'); // skips 25, 26, 27, 28
  });

  it('counts processing then delivery in working days', () => {
    // Thursday 12 Nov 2026, 10:00 UK. Processing 1 day -> dispatch Fri 13. 2 to 5 working days -> Tue 17 to Fri 20.
    const result = estimateDelivery({ now: new Date('2026-11-12T10:00:00Z'), processingDays: 1, deliveryMinDays: 2, deliveryMaxDays: 5, cutoffHour: 14, bankHolidays: [] });
    expect(result).toEqual({ from: '2026-11-17', to: '2026-11-20' });
    expect(formatShort('2026-11-18')).toBe('Wed 18 Nov');
  });

  it('starts the next working day after the cut-off, and over a weekend', () => {
    const base = { processingDays: 3, deliveryMinDays: 5, deliveryMaxDays: 10, cutoffHour: 14, bankHolidays: [] };
    const beforeCutoff = estimateDelivery({ ...base, now: new Date('2026-11-12T13:00:00Z') });
    const afterCutoff = estimateDelivery({ ...base, now: new Date('2026-11-12T15:00:00Z') });
    expect(beforeCutoff).toEqual({ from: '2026-11-24', to: '2026-12-01' });
    expect(afterCutoff).toEqual({ from: '2026-11-25', to: '2026-12-02' });
    // Saturday: processing starts Monday 16, dispatch Thursday 19
    const saturday = estimateDelivery({ ...base, now: new Date('2026-11-14T09:00:00Z') });
    expect(saturday).toEqual({ from: '2026-11-26', to: '2026-12-03' });
  });

  it('skips a bank holiday inside the range (fixed test date)', () => {
    const r = estimateDelivery({ now: new Date('2026-12-21T09:00:00Z'), processingDays: 1, deliveryMinDays: 1, deliveryMaxDays: 3, cutoffHour: 14, bankHolidays: holidays2026 });
    // start Mon 21, dispatch Tue 22, +1 = Wed 23, +3 = Tue 29 (24 Thu, then 29 after 25/26/27/28)
    expect(r).toEqual({ from: '2026-12-23', to: '2026-12-29' });
  });

  it('shows nothing when any fact is missing', () => {
    expect(estimateDelivery({ processingDays: 3, deliveryMinDays: null, deliveryMaxDays: 10 })).toBeNull();
    expect(estimateDelivery({ processingDays: null, deliveryMinDays: 5, deliveryMaxDays: 10 })).toBeNull();
    expect(estimateDelivery({ processingDays: 3, deliveryMinDays: 8, deliveryMaxDays: 5 })).toBeNull();
    expect(estimateDelivery({ processingDays: '', deliveryMinDays: '5', deliveryMaxDays: '10' })).toBeNull();
  });
});
