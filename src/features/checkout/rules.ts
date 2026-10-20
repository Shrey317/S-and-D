import { z } from 'zod';
import { phoneSchema } from '@/features/account/validation';
import { paymentMethods } from '@/features/payments/methods';

export const POLICY_VERSION = 'local-preview-2026-10-17';
export const checkoutSchema = z.object({
  key: z.uuid(),
  quote: z.string().regex(/^[a-f0-9]{64}$/),
  name: z.string().trim().min(2).max(100),
  phone: phoneSchema,
  method: z.enum(['COLLECTION', 'DELIVERY']),
  paymentMethod: z.enum(paymentMethods).default('TEST'),
  promotionCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{0,40}$/)
    .default(''),
  addressId: z.uuid().optional(),
  accepted: z.literal(true),
  policyVersion: z.literal(POLICY_VERSION),
});
export type CheckoutInput = z.input<typeof checkoutSchema>;
export class CheckoutError extends Error {}
export function cents(value: string): bigint {
  if (!/^\d{1,12}\.\d{2}$/.test(value)) throw new CheckoutError('Invalid price.');
  return BigInt(value.replace('.', ''));
}
export function decimal(value: bigint) {
  if (value < 0n || value > 99999999999999n)
    throw new CheckoutError('Basket total exceeds the limit.');
  return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
}
/** Conservative planning date only. No same-day promise or selectable slot. */
export function planningDate(now: Date, closedDates: string[], cutoff = '19:00') {
  // South Africa is UTC+02:00 throughout the year.
  const local = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const afterCutoff = local.toISOString().slice(11, 16) >= cutoff;
  local.setUTCDate(local.getUTCDate() + (afterCutoff ? 2 : 1));
  for (let i = 0; i < 366; i++) {
    const date = local.toISOString().slice(0, 10);
    if (!closedDates.includes(date)) return date;
    local.setUTCDate(local.getUTCDate() + 1);
  }
  throw new CheckoutError('Fulfilment is unavailable. Please try again later.');
}

/** Capacity must still be checked atomically when an order is placed. */
export function firstPlanningDate(
  now: Date,
  settings: {
    closedDates: string[];
    cutoff: string;
    sameDayEnabled: boolean;
    sameDayCutoff: string;
    dailyCapacity: number;
  },
  store: { weekdayOpen: string; weekdayClose: string; sundayOpen: string; sundayClose: string },
) {
  const local = new Date(now.getTime() + 7200000),
    clock = local.toISOString().slice(11, 16),
    today = local.toISOString().slice(0, 10);
  const opening = local.getUTCDay() === 0 ? store.sundayOpen : store.weekdayOpen;
  const closing = local.getUTCDay() === 0 ? store.sundayClose : store.weekdayClose;
  if (
    settings.sameDayEnabled &&
    settings.dailyCapacity > 0 &&
    clock >= opening &&
    clock < closing &&
    clock < settings.cutoff &&
    clock < settings.sameDayCutoff &&
    !settings.closedDates.includes(today)
  )
    return today;
  return planningDate(now, settings.closedDates, settings.cutoff);
}
