import { z } from 'zod';
import { publicEnvSchema } from './env.public';

const optionalText = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);
const enabledFlag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');
const optionalUrl = (protocols: string[]) =>
  z.preprocess(
    (value) => (value === '' ? undefined : value),
    z
      .url()
      .refine((value) => URL.canParse(value) && protocols.includes(new URL(value).protocol))
      .optional(),
  );

export const serverEnvSchema = publicEnvSchema
  .extend({
    APP_ENV: z.enum(['development', 'test', 'preview', 'production']).default('development'),
    DATABASE_ENABLED: enabledFlag,
    DATABASE_URL: optionalUrl(['postgres:', 'postgresql:']),
    DIRECT_URL: optionalUrl(['postgres:', 'postgresql:']),
    CATALOG_ALLOW_SAMPLES: enabledFlag,
    AUTH_ENABLED: enabledFlag,
    GOOGLE_AUTH_ENABLED: enabledFlag,
    ACCOUNT_DATABASE_URL: optionalUrl(['postgres:', 'postgresql:']),
    CART_ENABLED: enabledFlag,
    LOCAL_CHECKOUT_ENABLED: enabledFlag,
    COMMERCE_DATABASE_URL: optionalUrl(['postgres:', 'postgresql:']),
    AUTH_RATE_LIMIT_SECRET: optionalText,
    CLOUDINARY_ENABLED: enabledFlag,
    CLOUDINARY_CLOUD_NAME: optionalText,
    CLOUDINARY_API_KEY: optionalText,
    CLOUDINARY_API_SECRET: optionalText,
    EMAIL_ENABLED: enabledFlag,
    EMAIL_CAPTURE_ENABLED: enabledFlag,
    COMMUNICATIONS_DATABASE_URL: optionalUrl(['postgres:', 'postgresql:']),
    RESEND_WEBHOOK_SECRET: optionalText,
    COMMUNICATIONS_WORKER_TOKEN: optionalText,
    RESEND_API_KEY: optionalText,
    EMAIL_FROM: z.preprocess((value) => (value === '' ? undefined : value), z.email().optional()),
    ADMIN_NOTIFICATION_EMAIL: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.email().optional(),
    ),
    PAYFAST_ENABLED: enabledFlag,
    PAYMENTS_ENABLED: enabledFlag,
    PAYMENT_DATABASE_URL: optionalUrl(['postgres:', 'postgresql:']),
    ADMIN_DATABASE_URL: optionalUrl(['postgres:', 'postgresql:']),
    PAYFAST_INSTANT_EFT_ENABLED: enabledFlag,
    PAYFAST_TRUSTED_PROXY: z.enum(['none', 'netlify']).default('none'),
    MANUAL_EFT_ENABLED: enabledFlag,
    MANUAL_EFT_BANK_NAME: optionalText,
    MANUAL_EFT_ACCOUNT_NAME: optionalText,
    MANUAL_EFT_ACCOUNT_NUMBER: optionalText,
    MANUAL_EFT_BRANCH_CODE: optionalText,
    PAYFAST_MODE: z.enum(['sandbox', 'live']).default('sandbox'),
    PAYFAST_MERCHANT_ID: optionalText,
    PAYFAST_MERCHANT_KEY: optionalText,
    PAYFAST_PASSPHRASE: optionalText,
  })
  .superRefine((env, context) => {
    const requireFields = (enabled: boolean, fields: (keyof typeof env)[]) => {
      if (!enabled) return;
      for (const field of fields) {
        if (!env[field]) {
          context.addIssue({
            code: 'custom',
            path: [field],
            message: 'Required for enabled service',
          });
        }
      }
    };

    requireFields(env.DATABASE_ENABLED, ['DATABASE_URL']);
    requireFields(env.CART_ENABLED, ['COMMERCE_DATABASE_URL']);
    requireFields(env.PAYMENTS_ENABLED, ['PAYMENT_DATABASE_URL']);
    requireFields(env.MANUAL_EFT_ENABLED, [
      'MANUAL_EFT_BANK_NAME',
      'MANUAL_EFT_ACCOUNT_NAME',
      'MANUAL_EFT_ACCOUNT_NUMBER',
      'MANUAL_EFT_BRANCH_CODE',
    ]);
    if (
      env.LOCAL_CHECKOUT_ENABLED &&
      (!['development', 'test'].includes(env.APP_ENV) || !env.AUTH_ENABLED || !env.CART_ENABLED)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['LOCAL_CHECKOUT_ENABLED'],
        message: 'Local checkout requires development/test, accounts and carts.',
      });
    }
    if (env.CATALOG_ALLOW_SAMPLES && !['development', 'test'].includes(env.APP_ENV)) {
      context.addIssue({
        code: 'custom',
        path: ['CATALOG_ALLOW_SAMPLES'],
        message: 'Sample catalog is development/test only',
      });
    }
    // DIRECT_URL is migration-only: it must not be required in application runtime secrets.
    requireFields(env.AUTH_ENABLED, [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      'ACCOUNT_DATABASE_URL',
      'AUTH_RATE_LIMIT_SECRET',
    ]);
    if (env.AUTH_ENABLED && (env.AUTH_RATE_LIMIT_SECRET?.length ?? 0) < 32) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_RATE_LIMIT_SECRET'],
        message: 'Use at least 32 random characters',
      });
    }
    requireFields(env.CLOUDINARY_ENABLED, [
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
    ]);
    requireFields(env.EMAIL_ENABLED, [
      'RESEND_API_KEY',
      'EMAIL_FROM',
      'ADMIN_NOTIFICATION_EMAIL',
      'COMMUNICATIONS_DATABASE_URL',
      'RESEND_WEBHOOK_SECRET',
    ]);
    requireFields(env.EMAIL_CAPTURE_ENABLED, ['COMMUNICATIONS_DATABASE_URL']);
    if (env.EMAIL_CAPTURE_ENABLED && env.EMAIL_ENABLED)
      context.addIssue({
        code: 'custom',
        path: ['EMAIL_CAPTURE_ENABLED'],
        message: 'Choose local capture or hosted delivery, not both.',
      });
    if (env.EMAIL_CAPTURE_ENABLED && !['development', 'test'].includes(env.APP_ENV))
      context.addIssue({
        code: 'custom',
        path: ['EMAIL_CAPTURE_ENABLED'],
        message: 'Local capture requires development/test.',
      });
    if (env.COMMUNICATIONS_WORKER_TOKEN && env.COMMUNICATIONS_WORKER_TOKEN.length < 32)
      context.addIssue({
        code: 'custom',
        path: ['COMMUNICATIONS_WORKER_TOKEN'],
        message: 'Use at least 32 random characters.',
      });
    requireFields(env.PAYFAST_ENABLED, [
      'PAYMENTS_ENABLED',
      'PAYFAST_MERCHANT_ID',
      'PAYFAST_MERCHANT_KEY',
      'PAYFAST_PASSPHRASE',
    ]);

    // Invalid URLs already have schema issues; do not throw outside Zod's safeParse.
    if (!URL.canParse(env.NEXT_PUBLIC_SITE_URL)) return;
    const siteUrl = new URL(env.NEXT_PUBLIC_SITE_URL);
    if (
      env.PAYFAST_ENABLED &&
      (siteUrl.protocol !== 'https:' ||
        ['localhost', '127.0.0.1', '[::1]'].includes(siteUrl.hostname))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['NEXT_PUBLIC_SITE_URL'],
        message: 'Payfast sandbox requires a public HTTPS callback origin.',
      });
    }
    requireFields(env.MANUAL_EFT_ENABLED, ['PAYMENTS_ENABLED']);
    requireFields(env.PAYFAST_INSTANT_EFT_ENABLED, ['PAYFAST_ENABLED']);
    if (
      env.APP_ENV === 'production' &&
      (siteUrl.protocol !== 'https:' ||
        ['localhost', '127.0.0.1', '[::1]'].includes(siteUrl.hostname))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['NEXT_PUBLIC_SITE_URL'],
        message: 'Production requires public HTTPS origin',
      });
    }
    if (
      env.NEXT_PUBLIC_SUPABASE_URL &&
      URL.canParse(env.NEXT_PUBLIC_SUPABASE_URL) &&
      new URL(env.NEXT_PUBLIC_SUPABASE_URL).protocol !== 'https:' &&
      env.APP_ENV === 'production'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['NEXT_PUBLIC_SUPABASE_URL'],
        message: 'Production authentication requires HTTPS',
      });
    }
    if (env.PAYFAST_MODE === 'live') {
      context.addIssue({
        code: 'custom',
        path: ['PAYFAST_MODE'],
        message:
          'Live payments require separate owner activation and are not enabled in this release',
      });
    }
  });

/** Pure parser: no process access, network access or credential logging. */
export function parseServerEnv(input: Record<string, unknown>) {
  const result = serverEnvSchema.safeParse(input);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    // Do not serialize Zod errors: they can contain sensitive input values.
    throw new Error(
      `Invalid server configuration: ${names.join(', ')}. Check .env.example; live payments are not enabled.`,
    );
  }
  return result.data;
}
