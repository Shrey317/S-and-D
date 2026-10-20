import { z } from 'zod';

export const emailSchema = z.email().trim().toLowerCase().max(254);
export const passwordSchema = z.string().min(12, 'Use at least 12 characters.').max(128);
export const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^(?:0[1-9]\d{8}|\+27[1-9]\d{8})$/,
    'Use a South African phone number, for example 0835043385.',
  );
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.union([phoneSchema, z.literal('')]),
});
export const addressSchema = z.object({
  id: z.uuid().optional(),
  label: z.string().trim().min(1).max(40),
  recipient: z.string().trim().min(2).max(100),
  phone: phoneSchema,
  street: z.string().trim().min(3).max(200),
  suburb: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  postalCode: z.string().regex(/^\d{4}$/),
  instructions: z.string().trim().max(500),
  isDefault: z.boolean(),
});
export type AddressInput = z.infer<typeof addressSchema>;
export type FormResult = { status: 'idle' | 'error' | 'success'; message: string };
export const initialFormResult: FormResult = { status: 'idle', message: '' };

// Only local application destinations; reject encoded separators, auth loops and protocol-relative URLs.
export function safeReturnTo(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > 500 ||
    !/^\/(?:cart|checkout|account(?:\/[a-z-]+)?|shop(?:\/[a-z0-9-]+)?)(?:\?[a-zA-Z0-9=&_-]*)?$/.test(
      value,
    )
  )
    return '/account';
  return value;
}
