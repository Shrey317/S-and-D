import { describe, it, expect } from 'vitest';
import { discountFor } from '@/features/admin/promotions';
import { planningDate, firstPlanningDate } from '@/features/checkout/rules';
const lines = [
  { variantId: 'a', productId: 'fruit', quantity: 3, price: '10.01' },
  { variantId: 'b', productId: 'veg', quantity: 2, price: '20.00' },
];
describe('administration money and planning', () => {
  const settings = {
      closedDates: [] as string[],
      cutoff: '19:00',
      sameDayEnabled: true,
      sameDayCutoff: '17:00',
      dailyCapacity: 5,
    },
    store = {
      weekdayOpen: '08:45',
      weekdayClose: '18:00',
      sundayOpen: '09:00',
      sundayClose: '16:00',
    };
  it('offers same-day only after opening and before both cutoffs', () => {
    expect(firstPlanningDate(new Date('2026-10-19T06:44:00Z'), settings, store)).toBe('2026-10-20');
    expect(firstPlanningDate(new Date('2026-10-19T06:45:00Z'), settings, store)).toBe('2026-10-19');
    expect(firstPlanningDate(new Date('2026-10-19T15:00:00Z'), settings, store)).toBe('2026-10-20');
    expect(firstPlanningDate(new Date('2026-10-19T17:00:00Z'), settings, store)).toBe('2026-10-21');
  });
  it('honours Sunday closing even when the same-day cutoff is later', () => {
    expect(firstPlanningDate(new Date('2026-10-18T13:59:00Z'), settings, store)).toBe('2026-10-18');
    expect(firstPlanningDate(new Date('2026-10-18T14:00:00Z'), settings, store)).toBe('2026-10-19');
  });
  it('requires explicit same-day permission, positive capacity and an open date', () => {
    const now = new Date('2026-10-19T08:00:00Z');
    for (const change of [
      { sameDayEnabled: false },
      { dailyCapacity: 0 },
      { closedDates: ['2026-10-19'] },
    ])
      expect(firstPlanningDate(now, { ...settings, ...change }, store)).toBe('2026-10-20');
  });
  it('rounds percentage discounts down to cents on qualifying products', () =>
    expect(
      discountFor({ kind: 'PERCENT', value: '12.50', productId: 'fruit', bundle: [] }, lines),
    ).toBe('3.75'));
  it('caps fixed discounts to eligible totals and does not discount other products', () => {
    expect(
      discountFor({ kind: 'FIXED', value: '100.00', productId: 'fruit', bundle: [] }, lines),
    ).toBe('30.03');
    expect(
      discountFor({ kind: 'FIXED', value: '10.00', productId: 'missing', bundle: [] }, lines),
    ).toBe('0.00');
  });
  it('applies a bundle discount only to complete sets and caps it at their cost', () => {
    const offer = {
      kind: 'BUNDLE',
      value: '5.00',
      productId: null,
      bundle: [
        { variantId: 'a', quantity: 2 },
        { variantId: 'b', quantity: 1 },
      ],
    };
    expect(discountFor(offer, lines)).toBe('5.00');
    expect(discountFor({ ...offer, value: '100.00' }, lines)).toBe('40.02');
    expect(discountFor(offer, [lines[0]!])).toBe('0.00');
  });
  it('uses the configured SAST cutoff for conservative planning', () => {
    expect(planningDate(new Date('2026-10-19T15:30:00Z'), [], '17:00')).toBe('2026-10-21');
    expect(planningDate(new Date('2026-10-19T15:30:00Z'), [], '19:00')).toBe('2026-10-20');
  });
});
