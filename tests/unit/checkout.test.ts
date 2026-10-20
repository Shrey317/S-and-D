import { describe, it, expect } from 'vitest';
import { cents, decimal, planningDate } from '@/features/checkout/rules';
import { parseServerEnv } from '@/config/env.schema';
describe('checkout money and scheduling', () => {
  it('adds decimal amounts exactly and rejects malformed/overflow totals', () => {
    expect(decimal(cents('0.10') + cents('0.20'))).toBe('0.30');
    expect(decimal(cents('12.50') * 3n)).toBe('37.50');
    expect(() => cents('-1.00')).toThrow();
    expect(() => cents('1.001')).toThrow();
    expect(() => decimal(100000000000000n)).toThrow();
  });
  it('keeps nominal cutoff separate from same-day promises in Johannesburg', () => {
    expect(planningDate(new Date('2026-10-17T16:59:00Z'), [])).toBe('2026-10-18');
    expect(planningDate(new Date('2026-10-17T17:00:00Z'), [])).toBe('2026-10-19');
    expect(planningDate(new Date('2026-12-31T16:59:00Z'), ['2027-01-01'])).toBe('2027-01-02');
  });
  it('cannot enable local test checkout in production', () => {
    expect(() =>
      parseServerEnv({
        APP_ENV: 'production',
        NEXT_PUBLIC_SITE_URL: 'https://example.com',
        LOCAL_CHECKOUT_ENABLED: 'true',
      }),
    ).toThrow(/LOCAL_CHECKOUT_ENABLED/);
  });
});
