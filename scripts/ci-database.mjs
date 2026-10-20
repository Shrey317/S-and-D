import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import pg from 'pg';

const connectionString = process.env.TEST_DATABASE_URL;
if (process.env.CI !== 'true' || !connectionString || existsSync('.env.local'))
  throw new Error('Fresh CI environment required.');
const target = new URL(connectionString);
if (target.hostname !== '127.0.0.1' || target.pathname !== '/sd_catalog_test')
  throw new Error('Isolated loopback test database required.');
const client = new pg.Client({ connectionString });
const password = randomBytes(24).toString('hex');
await client.connect();
try {
  await client.query('CREATE ROLE sd_catalog_reader NOLOGIN NOBYPASSRLS');
  await client.query(`CREATE ROLE sd_runtime LOGIN INHERIT NOBYPASSRLS PASSWORD '${password}'`);
  await client.query('GRANT sd_catalog_reader TO sd_runtime');
} finally {
  await client.end();
}
target.username = 'sd_runtime';
target.password = password;
writeFileSync(
  '.env.local',
  `APP_ENV=test\nDATABASE_ENABLED=true\nCATALOG_ALLOW_SAMPLES=true\nDATABASE_URL=${target.href}\nDIRECT_URL=${connectionString}\nTEST_READER_URL=${target.href}\nTEST_DATABASE_URL=${connectionString}\n`,
  { mode: 0o600 },
);
console.log('Ephemeral CI database roles configured.');
