import { describe, expect, it } from 'vitest';
import { parseServerEnv } from '@/config/env.schema';
import { parsePublicEnv } from '@/config/env.public';

describe('environment validation', () => {
  it('runs the foundation without external credentials', () => {
    const env = parseServerEnv({});
    expect(env.DATABASE_ENABLED).toBe(false);
    expect(env.AUTH_ENABLED).toBe(false);
    expect(env.CLOUDINARY_ENABLED).toBe(false);
    expect(env.EMAIL_ENABLED).toBe(false);
    expect(env.PAYFAST_ENABLED).toBe(false);
    expect(env.PAYFAST_MODE).toBe('sandbox');
  });

  it('does not treat the string false as enabled', () => {
    expect(parseServerEnv({ EMAIL_ENABLED: 'false' }).EMAIL_ENABLED).toBe(false);
  });

  it.each(['TRUE', 'yes', '1', ''])('rejects ambiguous boolean input %s', (value) => {
    expect(() => parseServerEnv({ AUTH_ENABLED: value })).toThrow('AUTH_ENABLED');
  });

  it.each([
    ['DATABASE_ENABLED', 'DATABASE_URL'],
    ['AUTH_ENABLED', 'NEXT_PUBLIC_SUPABASE_URL'],
    ['CLOUDINARY_ENABLED', 'CLOUDINARY_API_SECRET'],
    ['EMAIL_ENABLED', 'RESEND_API_KEY'],
    ['PAYFAST_ENABLED', 'PAYFAST_MERCHANT_ID'],
  ])('fails when %s is enabled without configuration', (flag, field) => {
    expect(() => parseServerEnv({ [flag]: 'true' })).toThrow(field);
  });

  it('accepts a configured runtime database without migration credentials', () => {
    const env = parseServerEnv({
      DATABASE_ENABLED: 'true',
      DATABASE_URL: 'postgresql://user:example@localhost:5432/test',
    });
    expect(env.DATABASE_ENABLED).toBe(true);
    expect(env.DIRECT_URL).toBeUndefined();
  });

  it('accepts fully configured sandbox services', () => {
    const env = parseServerEnv({
      NEXT_PUBLIC_SITE_URL: 'https://sandbox-store.example.com',
      PAYMENTS_ENABLED: 'true',
      PAYMENT_DATABASE_URL: 'postgresql://payment:example@localhost:5432/test',
      AUTH_ENABLED: 'true',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
      ACCOUNT_DATABASE_URL: 'postgresql://account:example@localhost:5432/test',
      AUTH_RATE_LIMIT_SECRET: 'a'.repeat(64),
      CLOUDINARY_ENABLED: 'true',
      CLOUDINARY_CLOUD_NAME: 'test-cloud',
      CLOUDINARY_API_KEY: 'test-key',
      CLOUDINARY_API_SECRET: 'test-secret',
      EMAIL_ENABLED: 'true',
      COMMUNICATIONS_DATABASE_URL: 'postgresql://worker:example@localhost:5432/test',
      RESEND_WEBHOOK_SECRET: 'whsec_test',
      RESEND_API_KEY: 'test-key',
      EMAIL_FROM: 'orders@example.com',
      ADMIN_NOTIFICATION_EMAIL: 'owner@example.com',
      PAYFAST_ENABLED: 'true',
      PAYFAST_MERCHANT_ID: 'test-id',
      PAYFAST_MERCHANT_KEY: 'test-key',
      PAYFAST_PASSPHRASE: 'test-passphrase',
    });
    expect(env.PAYFAST_ENABLED).toBe(true);
  });

  it('allows blank optional secrets when services are disabled', () => {
    expect(
      parseServerEnv({ DATABASE_URL: '', DIRECT_URL: '', RESEND_API_KEY: '', EMAIL_FROM: '' })
        .RESEND_API_KEY,
    ).toBeUndefined();
  });

  it.each(['http://shop.example.com', 'https://localhost', 'https://127.0.0.1'])(
    'rejects unsafe production origin %s',
    (url) => {
      expect(() => parseServerEnv({ APP_ENV: 'production', NEXT_PUBLIC_SITE_URL: url })).toThrow(
        'NEXT_PUBLIC_SITE_URL',
      );
    },
  );

  it('accepts HTTPS production configuration without implying launch readiness', () => {
    expect(
      parseServerEnv({ APP_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://shop.example.com' })
        .APP_ENV,
    ).toBe('production');
  });

  it('requires HTTPS for production authentication', () => {
    expect(() =>
      parseServerEnv({
        APP_ENV: 'production',
        NEXT_PUBLIC_SITE_URL: 'https://shop.example.com',
        NEXT_PUBLIC_SUPABASE_URL: 'http://auth.example.com',
      }),
    ).toThrow('NEXT_PUBLIC_SUPABASE_URL');
  });

  it('rejects live payments even when the payment integration is disabled', () => {
    expect(() => parseServerEnv({ PAYFAST_MODE: 'live' })).toThrow('PAYFAST_MODE');
  });

  it('does not expose credential values through validation errors', () => {
    const secret = 'PRIVATE-CREDENTIAL-MUST-NOT-LEAK';
    expect(() =>
      parseServerEnv({
        DATABASE_ENABLED: 'true',
        DATABASE_URL: `https://user:${secret}@example.com`,
      }),
    ).toThrow('DATABASE_URL');
    try {
      parseServerEnv({ DATABASE_URL: secret });
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });

  it('strips server secrets from the public configuration', () => {
    const env = parsePublicEnv({
      NEXT_PUBLIC_SITE_URL: 'https://shop.example.com',
      RESEND_API_KEY: 'private-secret',
      DATABASE_URL: 'private-db',
    });
    expect(env).not.toHaveProperty('RESEND_API_KEY');
    expect(env).not.toHaveProperty('DATABASE_URL');
  });

  it.each([
    'not-a-url',
    'ftp://example.com',
    'https://user:secret@example.com',
    'https://example.com/?key=secret',
    'https://example.com/path',
  ])('rejects unsafe public origin %s without exposing its value', (value) => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SITE_URL: value })).toThrow('NEXT_PUBLIC_SITE_URL');
    expect(() => parseServerEnv({ NEXT_PUBLIC_SITE_URL: value })).toThrow('NEXT_PUBLIC_SITE_URL');
  });

  it('reports malformed database URLs by field name', () => {
    expect(() => parseServerEnv({ DATABASE_URL: 'not-a-url' })).toThrow('DATABASE_URL');
  });
});
