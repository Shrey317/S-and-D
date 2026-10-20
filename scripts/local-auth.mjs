import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, createHmac } from 'node:crypto';
import { loadEnvFile } from 'node:process';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

if (!existsSync('.env.local')) throw new Error('Run db:local first.');
loadEnvFile('.env.local');
const target = new URL(process.env.DIRECT_URL || 'http://unconfigured');
const localDevelopment =
  process.env.APP_ENV === 'development' &&
  target.port === '55432' &&
  target.pathname === '/sd_catalog_dev' &&
  existsSync('.local/database-secrets.json');
const localCi =
  process.env.CI === 'true' &&
  process.env.APP_ENV === 'test' &&
  target.pathname === '/sd_catalog_test';
if (target.hostname !== '127.0.0.1' || (!localDevelopment && !localCi))
  throw new Error('Only the isolated development database is supported.');
if (
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:54321'
)
  throw new Error('Existing hosted Auth configuration must not be overwritten.');
mkdirSync('.local', { recursive: true });
const secrets = existsSync('.local/database-secrets.json')
  ? JSON.parse(readFileSync('.local/database-secrets.json', 'utf8'))
  : {};
for (const key of ['account', 'authDb', 'authJwt', 'authRateLimit'])
  secrets[key] ??= randomBytes(32).toString('hex');
writeFileSync('.local/database-secrets.json', JSON.stringify(secrets), { mode: 0o600 });
const db = new pg.Client({ connectionString: target.href });
await db.connect();
try {
  if (!(await db.query("SELECT 1 FROM pg_roles WHERE rolname='sd_account_writer'")).rowCount)
    throw new Error('Run db:migrate before auth:local.');
  if (!(await db.query("SELECT 1 FROM pg_roles WHERE rolname='sd_accounts'")).rowCount)
    await db.query(
      `CREATE ROLE sd_accounts LOGIN INHERIT NOBYPASSRLS PASSWORD '${secrets.account}'`,
    );
  await db.query('GRANT sd_account_writer TO sd_accounts');
} finally {
  await db.end();
}
function token(role) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ role, iss: 'supabase', iat: 1700000000, exp: 2000000000 }),
  ).toString('base64url');
  const signature = createHmac('sha256', secrets.authJwt)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}
writeFileSync(
  '.local/local-auth.env',
  `AUTH_DB_PASSWORD=${secrets.authDb}\nAUTH_JWT_SECRET=${secrets.authJwt}\n`,
  { mode: 0o600 },
);
writeFileSync(
  '.local/auth-test-secrets.json',
  JSON.stringify({ serviceRole: token('service_role') }),
  { mode: 0o600 },
);
const accountUrl = new URL(target);
accountUrl.username = 'sd_accounts';
accountUrl.password = secrets.account;
const testUrl = new URL(accountUrl);
testUrl.pathname = '/sd_catalog_test';
const values = {
  NEXT_PUBLIC_SITE_URL: localCi ? 'http://127.0.0.1:3100' : 'http://127.0.0.1:3000',
  AUTH_ENABLED: 'true',
  GOOGLE_AUTH_ENABLED: 'false',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: token('anon'),
  ACCOUNT_DATABASE_URL: accountUrl.href,
  TEST_ACCOUNT_DATABASE_URL: testUrl.href,
  AUTH_RATE_LIMIT_SECRET: secrets.authRateLimit,
};
let env = readFileSync('.env.local', 'utf8');
for (const [key, value] of Object.entries(values)) {
  const line = new RegExp(`^${key}=.*$`, 'm');
  env = line.test(env)
    ? env.replace(line, `${key}=${value}`)
    : `${env.trimEnd()}\n${key}=${value}\n`;
}
function compose(args) {
  const result = spawnSync(
    'docker',
    ['compose', '--env-file', '.local/local-auth.env', '-f', 'supabase/local/compose.yml', ...args],
    { stdio: 'inherit', windowsHide: true, timeout: 300000 },
  );
  if (result.status !== 0)
    throw new Error(
      'Local Auth startup failed. Environment unchanged; retry after Docker is ready.',
    );
}
compose(['up', '-d', '--wait', 'db', 'mail']);
compose([
  'exec',
  '-T',
  'db',
  'psql',
  '-U',
  'auth_owner',
  '-d',
  'auth_local',
  '-v',
  'ON_ERROR_STOP=1',
  '-c',
  "CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION auth_owner; DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='postgres') THEN CREATE ROLE postgres NOLOGIN; END IF; END $$;",
]);
compose(['up', '-d', '--wait']);
writeFileSync('.env.local', env, { mode: 0o600 });
console.log(
  'Local Auth configured on loopback 54321; captured email inbox on 54324. Restart/rebuild the app. No hosted services or external mail used.',
);
