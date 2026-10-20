import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { loadLocalEnvironment, assertLocalTarget, toolingDatabase } from './database-tools';
loadLocalEnvironment();
const url = process.env.DIRECT_URL!;
assertLocalTarget(url, process.env.APP_ENV);
if (process.env.COMMUNICATIONS_DATABASE_URL)
  assertLocalTarget(process.env.COMMUNICATIONS_DATABASE_URL, process.env.APP_ENV);
const db = toolingDatabase(url);
try {
  const secrets = JSON.parse(readFileSync('.local/database-secrets.json', 'utf8'));
  secrets.communications ??= randomBytes(32).toString('hex');
  if (!/^[a-f0-9]{64}$/.test(secrets.communications))
    throw new Error('Invalid generated local credential.');
  const roles = await db.$queryRaw<
    { rolname: string }[]
  >`SELECT rolname FROM pg_roles WHERE rolname='sd_communications'`;
  if (!roles.length)
    await db.$executeRawUnsafe(
      `CREATE ROLE sd_communications LOGIN INHERIT NOBYPASSRLS PASSWORD '${secrets.communications}'`,
    );
  await db.$executeRawUnsafe('GRANT sd_communications_worker TO sd_communications');
  const runtime = new URL(url);
  runtime.username = 'sd_communications';
  runtime.password = secrets.communications;
  const test = new URL(runtime);
  test.pathname = '/sd_catalog_test';
  let env = readFileSync('.env.local', 'utf8');
  for (const [key, value] of Object.entries({
    EMAIL_CAPTURE_ENABLED: 'true',
    COMMUNICATIONS_DATABASE_URL: runtime.href,
    TEST_COMMUNICATIONS_DATABASE_URL: test.href,
  })) {
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    env = pattern.test(env)
      ? env.replace(pattern, `${key}=${value}`)
      : `${env.trimEnd()}\n${key}=${value}\n`;
  }
  writeFileSync('.local/database-secrets.json', JSON.stringify(secrets), { mode: 0o600 });
  writeFileSync('.env.local', env, { mode: 0o600 });
  console.log(
    'Restricted local communications worker configured. Local captures only; no external mail enabled.',
  );
} finally {
  await db.$disconnect();
}
