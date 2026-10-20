import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { assertLocalTarget, loadLocalEnvironment, toolingDatabase } from './database-tools';
loadLocalEnvironment();
const url = process.env.DIRECT_URL!;
assertLocalTarget(url, process.env.APP_ENV);
if (process.env.COMMERCE_DATABASE_URL)
  assertLocalTarget(process.env.COMMERCE_DATABASE_URL, process.env.APP_ENV);
const db = toolingDatabase(url);
try {
  const secrets = JSON.parse(readFileSync('.local/database-secrets.json', 'utf8'));
  secrets.commerce ??= randomBytes(32).toString('hex');
  if (!/^[a-f0-9]{64}$/.test(secrets.commerce)) throw new Error('Invalid local credential shape.');
  const roles = await db.$queryRaw<
    { rolname: string }[]
  >`SELECT rolname FROM pg_roles WHERE rolname='sd_commerce'`;
  if (!roles.length)
    await db.$executeRawUnsafe(
      `CREATE ROLE sd_commerce LOGIN INHERIT NOBYPASSRLS PASSWORD '${secrets.commerce}'`,
    );
  await db.$executeRawUnsafe('GRANT sd_commerce_writer TO sd_commerce');
  const runtime = new URL(url);
  runtime.username = 'sd_commerce';
  runtime.password = secrets.commerce;
  const test = new URL(runtime);
  test.pathname = '/sd_catalog_test';
  let env = readFileSync('.env.local', 'utf8');
  for (const [key, value] of Object.entries({
    CART_ENABLED: 'true',
    LOCAL_CHECKOUT_ENABLED: 'true',
    COMMERCE_DATABASE_URL: runtime.href,
    TEST_COMMERCE_DATABASE_URL: test.href,
  })) {
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    env = pattern.test(env)
      ? env.replace(pattern, `${key}=${value}`)
      : `${env.trimEnd()}\n${key}=${value}\n`;
  }
  writeFileSync('.local/database-secrets.json', JSON.stringify(secrets), { mode: 0o600 });
  writeFileSync('.env.local', env, { mode: 0o600 });
  console.log(
    'Isolated local cart and test checkout configured. No hosted services or payments enabled.',
  );
} finally {
  await db.$disconnect();
}
