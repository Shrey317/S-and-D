import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { loadLocalEnvironment, assertLocalTarget, toolingDatabase } from './database-tools';
loadLocalEnvironment();
const url = process.env.DIRECT_URL!;
assertLocalTarget(url, process.env.APP_ENV);
if (process.env.PAYMENT_DATABASE_URL)
  assertLocalTarget(process.env.PAYMENT_DATABASE_URL, process.env.APP_ENV);
const db = toolingDatabase(url);
try {
  const secrets = JSON.parse(readFileSync('.local/database-secrets.json', 'utf8'));
  secrets.payment ??= randomBytes(32).toString('hex');
  if (!/^[a-f0-9]{64}$/.test(secrets.payment))
    throw new Error('Invalid generated local credential.');
  const roles = await db.$queryRaw<
    { rolname: string }[]
  >`SELECT rolname FROM pg_roles WHERE rolname='sd_payments'`;
  if (!roles.length)
    await db.$executeRawUnsafe(
      `CREATE ROLE sd_payments LOGIN INHERIT NOBYPASSRLS PASSWORD '${secrets.payment}'`,
    );
  await db.$executeRawUnsafe('GRANT sd_payment_processor TO sd_payments');
  const runtime = new URL(url);
  runtime.username = 'sd_payments';
  runtime.password = secrets.payment;
  const test = new URL(runtime);
  test.pathname = '/sd_catalog_test';
  let env = readFileSync('.env.local', 'utf8');
  for (const [key, value] of Object.entries({
    PAYMENTS_ENABLED: 'true',
    PAYMENT_DATABASE_URL: runtime.href,
    TEST_PAYMENT_DATABASE_URL: test.href,
  })) {
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    env = pattern.test(env)
      ? env.replace(pattern, `${key}=${value}`)
      : `${env.trimEnd()}\n${key}=${value}\n`;
  }
  writeFileSync('.local/database-secrets.json', JSON.stringify(secrets), { mode: 0o600 });
  writeFileSync('.env.local', env, { mode: 0o600 });
  console.log(
    'Restricted local payment records enabled. Payfast, bank details and live payments were not enabled.',
  );
} finally {
  await db.$disconnect();
}
