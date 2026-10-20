import { z } from 'zod';
import { phoneSchema } from '@/features/account/validation';
export const reason = z.string().trim().min(10).max(500);
const optionalId = z.preprocess((v) => (v === '' ? undefined : v), z.uuid().optional());
const money = z.string().regex(/^\d{1,10}\.\d{2}$/);
const version = z.coerce.number().int().min(0);
export const productSchema = z.object({
  id: optionalId,
  name: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(120),
  categoryId: z.uuid(),
  description: z.string().trim().min(5).max(5000),
  state: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
  featured: z.boolean(),
  isSample: z.boolean(),
  reason,
});
export const categorySchema = z.object({
  id: optionalId,
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
  description: z.string().trim().max(2000),
  position: z.coerce.number().int().min(0).max(1000),
  active: z.boolean(),
  reason,
});
export const variantSchema = z.object({
  id: optionalId,
  productId: z.uuid(),
  sku: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{2,80}$/),
  label: z.string().trim().min(2).max(80),
  unit: z.enum(['KG', 'BOX', 'PACK', 'EACH', 'BUNCH', 'BAG']),
  price: money,
  active: z.boolean(),
  lowStockThreshold: z.coerce.number().int().min(0).max(100000),
  reason,
});
export const stockSchema = z.object({
  variantId: z.uuid(),
  key: z.uuid(),
  version,
  onHand: z.coerce.number().int().min(0).max(1000000),
  reason,
});
const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const settingsSchema = z
  .object({
    version,
    storeVersion: version,
    phone: phoneSchema,
    address: z.string().trim().min(10).max(240),
    weekdayOpen: clock,
    weekdayClose: clock,
    sundayOpen: clock,
    sundayClose: clock,
    announcement: z.string().trim().max(240),
    about: z.string().trim().min(10).max(3000),
    collectionEnabled: z.boolean(),
    deliveryEnabled: z.boolean(),
    suspended: z.boolean(),
    cutoff: clock,
    sameDayEnabled: z.boolean(),
    sameDayCutoff: clock,
    dailyCapacity: z.coerce.number().int().min(0).max(10000),
    closedDates: z.string().max(5000),
    reason,
  })
  .superRefine((v, ctx) => {
    if (v.weekdayOpen >= v.weekdayClose || v.sundayOpen >= v.sundayClose)
      ctx.addIssue({ code: 'custom', message: 'Closing time must follow opening time.' });
    if (v.sameDayEnabled && (!v.dailyCapacity || v.sameDayCutoff > v.cutoff))
      ctx.addIssue({
        code: 'custom',
        message:
          'Same-day needs a positive capacity and an eligibility cutoff no later than the ordering cutoff.',
      });
    for (const day of v.closedDates.split(/[\s,]+/).filter(Boolean))
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
        !Number.isFinite(Date.parse(day)) ||
        new Date(day).toISOString().slice(0, 10) !== day
      )
        ctx.addIssue({ code: 'custom', message: 'Use valid closure dates in YYYY-MM-DD format.' });
  });
export const promotionSchema = z
  .object({
    id: optionalId,
    version,
    name: z.string().trim().min(2).max(100),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{0,40}$/),
    kind: z.enum(['PERCENT', 'FIXED', 'BUNDLE']),
    value: money,
    productId: optionalId,
    variantA: optionalId,
    variantB: optionalId,
    quantityA: z.coerce.number().int().min(1).max(99),
    quantityB: z.coerce.number().int().min(1).max(99),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    active: z.boolean(),
    maxUses: z.coerce.number().int().min(1).max(1000000),
    perCustomer: z.coerce.number().int().min(1).max(1000000),
    reason,
  })
  .superRefine((v, ctx) => {
    if (Number(v.value) <= 0 || (v.kind === 'PERCENT' && Number(v.value) > 100))
      ctx.addIssue({
        code: 'custom',
        message: 'Choose a positive discount; percentages cannot exceed 100.',
      });
    if (Date.parse(v.startsAt) >= Date.parse(v.endsAt))
      ctx.addIssue({ code: 'custom', message: 'End must follow start.' });
    if (v.kind === 'BUNDLE' && (!v.variantA || !v.variantB || v.variantA === v.variantB))
      ctx.addIssue({ code: 'custom', message: 'Choose two different variants for a bundle.' });
  });
