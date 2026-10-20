import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { loadLocalEnvironment, assertLocalTarget, toolingDatabase } from './database-tools';
loadLocalEnvironment();
const url = process.env.DIRECT_URL!;
assertLocalTarget(url, process.env.APP_ENV);
if (process.env.ADMIN_DATABASE_URL)
  assertLocalTarget(process.env.ADMIN_DATABASE_URL, process.env.APP_ENV);
const db = toolingDatabase(url);
try {
  const secrets = JSON.parse(readFileSync('.local/database-secrets.json', 'utf8'));
  secrets.administration ??= randomBytes(32).toString('hex');
  if (!/^[a-f0-9]{64}$/.test(secrets.administration))
    throw new Error('Invalid generated local credential.');
  const roles = await db.$queryRaw<
    { rolname: string }[]
  >`SELECT rolname FROM pg_roles WHERE rolname='sd_administration'`;
  if (!roles.length)
    await db.$executeRawUnsafe(
      `CREATE ROLE sd_administration LOGIN INHERIT NOBYPASSRLS PASSWORD '${secrets.administration}'`,
    );
  await db.$executeRawUnsafe('GRANT sd_admin_writer TO sd_administration');
  const runtime = new URL(url);
  runtime.username = 'sd_administration';
  runtime.password = secrets.administration;
  const test = new URL(runtime);
  test.pathname = '/sd_catalog_test';
  let env = readFileSync('.env.local', 'utf8');
  for (const [key, value] of Object.entries({
    ADMIN_DATABASE_URL: runtime.href,
    TEST_ADMIN_DATABASE_URL: test.href,
  })) {
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    env = pattern.test(env)
      ? env.replace(pattern, `${key}=${value}`)
      : `${env.trimEnd()}\n${key}=${value}\n`;
  }
  writeFileSync('.local/database-secrets.json', JSON.stringify(secrets), { mode: 0o600 });
  writeFileSync('.env.local', env, { mode: 0o600 });
  console.log(
    'Restricted local administration database configured. No administrator identity was granted.',
  );
} finally {
  await db.$disconnect();
}
