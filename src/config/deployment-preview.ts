import { serverEnvSchema } from './env.schema';
import { publicEnvSchema } from './env.public';

const stagingProject = 'chxpreqcdrmakbyoydnv';

/** Checks the selected preview stage. Never authorizes orders or live payments. */
export function previewDeploymentIssues(input: Record<string, unknown>): string[] {
  const issues = new Set<string>();
  const profile = input.DEPLOYMENT_PROFILE ?? 'credential-free';
  const catalogAdmin = profile === 'catalog-admin-staging';
  const staging = profile === 'supabase-staging' || catalogAdmin;
  if (profile !== 'credential-free' && !staging) issues.add('Unknown preview DEPLOYMENT_PROFILE.');
  const parsed = serverEnvSchema.safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues)
      issues.add(`Invalid configuration: ${issue.path.join('.')}`);
  }
  if (input.APP_ENV !== 'preview') issues.add('APP_ENV must be preview.');
  try {
    const url = new URL(String(input.NEXT_PUBLIC_SITE_URL || ''));
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      !url.hostname.includes('.') ||
      /^\d+[.\d]*$/.test(url.hostname) ||
      url.hostname.includes(':') ||
      /(^|\.)(localhost|local|test|invalid|example|example\.com|example\.org|example\.net)$/.test(
        url.hostname,
      )
    )
      throw new Error('origin');
  } catch {
    issues.add(
      'NEXT_PUBLIC_SITE_URL must be the assigned public HTTPS origin, without a path or placeholder.',
    );
  }
  const flags = [
    'DATABASE_ENABLED',
    'CATALOG_ALLOW_SAMPLES',
    'AUTH_ENABLED',
    'GOOGLE_AUTH_ENABLED',
    'CART_ENABLED',
    'LOCAL_CHECKOUT_ENABLED',
    'CLOUDINARY_ENABLED',
    'EMAIL_ENABLED',
    'EMAIL_CAPTURE_ENABLED',
    'PAYMENTS_ENABLED',
    'PAYFAST_ENABLED',
    'PAYFAST_INSTANT_EFT_ENABLED',
    'MANUAL_EFT_ENABLED',
  ];
  for (const field of flags) {
    if (catalogAdmin && field === 'CLOUDINARY_ENABLED') {
      if (input[field] !== 'true')
        issues.add('Enable Cloudinary for hosted catalog administration.');
      continue;
    }
    if (staging && ['DATABASE_ENABLED', 'AUTH_ENABLED'].includes(field)) {
      if (input[field] !== 'true') issues.add(`${field} must be true for Supabase staging.`);
      continue;
    }
    if (input[field] !== undefined && input[field] !== 'false')
      issues.add(`${field} must be false for this hosted preview.`);
  }
  if (input.PAYFAST_MODE !== undefined && input.PAYFAST_MODE !== 'sandbox')
    issues.add('PAYFAST_MODE must remain sandbox.');
  if (input.PAYFAST_TRUSTED_PROXY !== undefined && input.PAYFAST_TRUSTED_PROXY !== 'none')
    issues.add('PAYFAST_TRUSTED_PROXY must remain none.');
  const permitted = new Set([
    'APP_ENV',
    'NEXT_PUBLIC_SITE_URL',
    'PAYFAST_MODE',
    'PAYFAST_TRUSTED_PROXY',
    ...flags,
  ]);
  if (staging) {
    if (catalogAdmin) {
      for (const field of [
        'ADMIN_DATABASE_URL',
        'CLOUDINARY_CLOUD_NAME',
        'CLOUDINARY_API_KEY',
        'CLOUDINARY_API_SECRET',
      ])
        permitted.add(field);
    }
    for (const field of [
      'DATABASE_URL',
      'ACCOUNT_DATABASE_URL',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      'AUTH_RATE_LIMIT_SECRET',
    ])
      permitted.add(field);
    if (input.NEXT_PUBLIC_SUPABASE_URL !== `https://${stagingProject}.supabase.co`)
      issues.add('NEXT_PUBLIC_SUPABASE_URL must identify the approved staging project.');
    if (
      !/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(
        String(input.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ''),
      )
    )
      issues.add('Use a current Supabase publishable key for staging.');
    for (const [field, role] of [
      ['DATABASE_URL', 'sd_catalog_app'],
      ['ACCOUNT_DATABASE_URL', 'sd_accounts_app'],
      ...(catalogAdmin ? [['ADMIN_DATABASE_URL', 'sd_admin_app']] : []),
    ] as const) {
      try {
        const url = new URL(String(input[field] ?? ''));
        if (
          !['postgres:', 'postgresql:'].includes(url.protocol) ||
          url.hostname !== 'aws-0-eu-west-1.pooler.supabase.com' ||
          url.port !== '6543' ||
          url.pathname !== '/postgres' ||
          url.hash ||
          decodeURIComponent(url.username) !== `${role}.${stagingProject}` ||
          !url.password ||
          url.searchParams.get('sslmode') !== 'verify-full' ||
          [...url.searchParams.keys()].some((key) => key !== 'sslmode') ||
          url.searchParams.getAll('sslmode').length !== 1
        )
          throw new Error('connection');
      } catch {
        issues.add(
          `${field} must use its restricted staging login, transaction pooler and verified TLS.`,
        );
      }
    }
  }
  // Only the explicitly selected stage may receive its integration credentials.
  for (const field of Object.keys(serverEnvSchema.shape)) {
    if (!permitted.has(field) && String(input[field] ?? '').trim())
      issues.add(`Remove ${field} from this preview deployment.`);
  }
  if (
    Object.entries(input).some(
      ([key, value]) =>
        /^(TEST_.*(?:URL|KEY|SECRET)|SUPABASE_(?:ADMIN_KEY|SERVICE_ROLE_KEY|SECRET_KEY)|PGPASSWORD)$/.test(
          key,
        ) && String(value ?? '').trim(),
    )
  )
    issues.add(
      'Remove operator, migration, PostgreSQL password and test credentials from deployment.',
    );
  const publicNames: readonly string[] = publicEnvSchema.keyof().options;
  if (
    Object.keys(input).some((key) => key.startsWith('NEXT_PUBLIC_') && !publicNames.includes(key))
  )
    issues.add('Unexpected NEXT_PUBLIC_ variable: expose only the public schema allowlist.');
  return [...issues];
}
