import { describe, expect, it } from 'vitest';
import { previewDeploymentIssues } from '@/config/deployment-preview';

const preview = { APP_ENV: 'preview', NEXT_PUBLIC_SITE_URL: 'https://sd-review.netlify.app' };
describe('first hosted preview gate', () => {
  it('accepts a credential-free assigned HTTPS preview without contacting services', () => {
    expect(previewDeploymentIssues(preview)).toEqual([]);
  });
  it.each([
    'http://localhost:3000',
    'https://127.0.0.1',
    'https://[::1]',
    'https://replace.invalid',
    'https://example.com',
    'https://sd-review.netlify.app/path',
    'https://user:secret@sd-review.netlify.app',
  ])('rejects an unsuitable origin %s', (origin) => {
    expect(
      previewDeploymentIssues({ ...preview, NEXT_PUBLIC_SITE_URL: origin }).length,
    ).toBeGreaterThan(0);
  });
  it('rejects inherited local mode, sample data and order/payment activation', () => {
    for (const setting of [
      { APP_ENV: 'development' },
      { APP_ENV: 'production' },
      { CATALOG_ALLOW_SAMPLES: 'true' },
      { LOCAL_CHECKOUT_ENABLED: 'true' },
      { PAYFAST_MODE: 'live' },
      { EMAIL_ENABLED: 'true' },
      { AUTH_ENABLED: 'true' },
    ])
      expect(previewDeploymentIssues({ ...preview, ...setting }).length).toBeGreaterThan(0);
  });
  it('rejects credentials even when their integration is disabled and never includes their values', () => {
    for (const field of [
      'DIRECT_URL',
      'DATABASE_URL',
      'RESEND_API_KEY',
      'SUPABASE_ADMIN_KEY',
      'TEST_DATABASE_URL',
      'PGPASSWORD',
      'NEXT_PUBLIC_PRIVATE_TOKEN',
    ]) {
      const issues = previewDeploymentIssues({ ...preview, [field]: 'DO_NOT_LOG_THIS_SECRET' });
      expect(issues.length).toBeGreaterThan(0);
      expect(JSON.stringify(issues)).not.toContain('DO_NOT_LOG_THIS_SECRET');
    }
  });
  it('does not allow truthy strings or malformed flags through the gate', () => {
    expect(previewDeploymentIssues({ ...preview, CART_ENABLED: 'yes' }).length).toBeGreaterThan(0);
  });
});

const project = 'chxpreqcdrmakbyoydnv';
const connection = (role: string) =>
  `postgresql://${role}.${project}:test-secret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=verify-full`;
const staging = {
  ...preview,
  DEPLOYMENT_PROFILE: 'supabase-staging',
  DATABASE_ENABLED: 'true',
  AUTH_ENABLED: 'true',
  DATABASE_URL: connection('sd_catalog_app'),
  ACCOUNT_DATABASE_URL: connection('sd_accounts_app'),
  NEXT_PUBLIC_SUPABASE_URL: `https://${project}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${'a'.repeat(32)}`,
  AUTH_RATE_LIMIT_SECRET: 'test-only-secret'.repeat(4),
};

describe('Supabase staging deployment gate', () => {
  it('accepts the selected project with separate restricted pooler logins', () => {
    expect(previewDeploymentIssues(staging)).toEqual([]);
  });
  it('requires explicit staging selection and a complete configuration', () => {
    for (const setting of [
      { DEPLOYMENT_PROFILE: undefined },
      { DEPLOYMENT_PROFILE: 'production' },
      { DATABASE_ENABLED: 'false' },
      { AUTH_ENABLED: 'false' },
      { AUTH_RATE_LIMIT_SECRET: '' },
      { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_private' },
      { NEXT_PUBLIC_SUPABASE_URL: 'https://another-project.supabase.co' },
    ])
      expect(previewDeploymentIssues({ ...staging, ...setting }).length).toBeGreaterThan(0);
  });
  it('rejects owner credentials, wrong projects, local connections and weakened TLS', () => {
    for (const url of [
      connection('postgres'),
      connection('sd_migrator'),
      connection('sd_catalog_app').replace(project, 'otherproject'),
      connection('sd_catalog_app').replace('aws-0', 'aws-1'),
      connection('sd_catalog_app').replace(':6543', ':5432'),
      connection('sd_catalog_app').replace('verify-full', 'require'),
      connection('sd_catalog_app') + '&sslmode=disable',
      connection('sd_catalog_app') + '&ssl=false',
      'postgresql://reader:secret@127.0.0.1:55432/sd_catalog_dev',
    ])
      expect(previewDeploymentIssues({ ...staging, DATABASE_URL: url }).length).toBeGreaterThan(0);
    expect(
      previewDeploymentIssues({ ...staging, ACCOUNT_DATABASE_URL: staging.DATABASE_URL }).length,
    ).toBeGreaterThan(0);
  });
  it('keeps unrelated integrations and operator credentials blocked without logging values', () => {
    for (const setting of [
      { DIRECT_URL: connection('sd_migrator') },
      { SUPABASE_SERVICE_ROLE_KEY: 'DO_NOT_LOG_THIS_SECRET' },
      { RESEND_API_KEY: 'DO_NOT_LOG_THIS_SECRET' },
      { ADMIN_DATABASE_URL: connection('sd_admin_app') },
      { CART_ENABLED: 'true' },
      { PAYMENTS_ENABLED: 'true' },
      { GOOGLE_AUTH_ENABLED: 'true' },
      { CLOUDINARY_ENABLED: 'true' },
      { EMAIL_ENABLED: 'true' },
    ]) {
      const issues = previewDeploymentIssues({ ...staging, ...setting });
      expect(issues.length).toBeGreaterThan(0);
      expect(JSON.stringify(issues)).not.toContain('DO_NOT_LOG_THIS_SECRET');
      expect(JSON.stringify(issues)).not.toContain('test-secret');
    }
  });
});
