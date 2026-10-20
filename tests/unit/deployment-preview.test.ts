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
