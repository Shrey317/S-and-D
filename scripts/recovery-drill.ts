import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import { assertLocalTarget, loadLocalEnvironment, toolingDatabase } from './database-tools';
import { assertStorefrontRole } from '../src/server/db/permissions';
import { assertCommunicationsRole } from '../src/server/db/communications-permissions';

loadLocalEnvironment();
const source = new URL(process.env.TEST_DATABASE_URL!);
assertLocalTarget(source.href, 'test');
assert.equal(source.pathname, '/sd_catalog_test');
const name = `sd_restore_${Date.now()}_${randomBytes(4).toString('hex')}`;
assert.match(name, /^sd_restore_\d+_[a-f0-9]{8}$/);
const root = resolve('.local/recovery', name);
mkdirSync(root, { recursive: true, mode: 0o700 });
const plain = join(root, 'database.dump'),
  restored = join(root, 'verified.dump');
const key = randomBytes(32),
  iv = randomBytes(12);
const adminUrl = new URL(source);
adminUrl.pathname = '/postgres';
const control = new pg.Client({ connectionString: adminUrl.href });
const from = new pg.Client({ connectionString: source.href });
const target = new URL(source);
target.pathname = `/${name}`;
const into = new pg.Client({ connectionString: target.href });
let created = false,
  connected = false;
const started = Date.now();
function command(tool: string, args: string[]) {
  const bin =
    process.env.PG_BIN ||
    (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/18/bin' : '');
  const result = spawnSync(
    bin ? join(bin, `${tool}${process.platform === 'win32' ? '.exe' : ''}`) : tool,
    args,
    {
      env: {
        ...process.env,
        PGHOST: source.hostname,
        PGPORT: source.port || '5432',
        PGUSER: decodeURIComponent(source.username),
        PGPASSWORD: decodeURIComponent(source.password),
        PGCONNECT_TIMEOUT: '5',
      },
      windowsHide: true,
      timeout: 120000,
      encoding: 'utf8',
    },
  );
  if (result.status !== 0) throw new Error(`${tool} failed; recovery drill did not pass.`);
}
async function manifest(client: pg.Client) {
  const tables = (
    await client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname='commerce' ORDER BY tablename",
    )
  ).rows;
  const data: { table: string; count: number; hash: string }[] = [];
  for (const { tablename } of tables) {
    assert.match(tablename, /^[A-Za-z0-9_]+$/);
    const rows = (
      await client.query(
        `SELECT row_to_json(t)::text AS value FROM commerce."${tablename}" t ORDER BY row_to_json(t)::text`,
      )
    ).rows as { value: string }[];
    data.push({
      table: tablename,
      count: rows.length,
      hash: createHash('sha256')
        .update(rows.map((r) => r.value).join('\n'))
        .digest('hex'),
    });
  }
  const policies = (
    await client.query(
      "SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='commerce' ORDER BY tablename,policyname",
    )
  ).rows;
  const constraints = (
    await client.query(
      "SELECT conrelid::regclass::text AS table_name,conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='commerce'::regnamespace ORDER BY 1,2",
    )
  ).rows;
  // pg_restore may distribute a varchar[] -> text[] cast over its literal
  // elements. Normalize only this lossless cast, retaining every value/operator.
  const normalize = (value: string) =>
    value
      .replace(/\('((?:[^']|'')*)'::character varying\)::text/g, "'$1'::character varying")
      .replace(/\((ARRAY\[[^\]]*\])\)::text\[\]/g, '$1');
  for (const constraint of constraints) {
    constraint.definition = normalize(constraint.definition);
  }
  for (const policy of policies) {
    if (policy.qual) policy.qual = normalize(policy.qual);
    if (policy.with_check) policy.with_check = normalize(policy.with_check);
  }
  const triggers = (
    await client.query(
      "SELECT event_object_table,trigger_name,action_statement FROM information_schema.triggers WHERE trigger_schema='commerce' ORDER BY 1,2,event_manipulation",
    )
  ).rows;
  return { data, policies, constraints, triggers };
}
try {
  await control.connect();
  await from.connect();
  const before = await manifest(from);
  // A random new name and no --clean option prevent overwriting any existing database.
  await control.query(`CREATE DATABASE "${name}"`);
  created = true;
  command('pg_dump', ['--format=custom', '--file', plain, '--dbname', 'sd_catalog_test']);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(readFileSync(plain)), cipher.final()]);
  writeFileSync(join(root, 'database.aes'), Buffer.concat([iv, cipher.getAuthTag(), encrypted]), {
    mode: 0o600,
  });
  rmSync(plain);
  const archive = readFileSync(join(root, 'database.aes'));
  const decipher = createDecipheriv('aes-256-gcm', key, archive.subarray(0, 12));
  decipher.setAuthTag(archive.subarray(12, 28));
  writeFileSync(
    restored,
    Buffer.concat([decipher.update(archive.subarray(28)), decipher.final()]),
    { mode: 0o600 },
  );
  command('pg_restore', ['--exit-on-error', '--dbname', name, restored]);
  await into.connect();
  connected = true;
  assert.deepEqual(await manifest(into), before, 'Restored data/security definitions differ.');
  assert.deepEqual(await manifest(from), before, 'Source changed during drill; rerun while idle.');
  for (const [url, guard] of [
    [process.env.TEST_READER_URL!, assertStorefrontRole],
    [process.env.TEST_COMMUNICATIONS_DATABASE_URL!, assertCommunicationsRole],
  ] as const) {
    const login = new URL(url);
    login.pathname = `/${name}`;
    const db = toolingDatabase(login.href);
    try {
      await guard(db);
    } finally {
      await db.$disconnect();
    }
  }
  const tampered = Buffer.from(archive);
  tampered[tampered.length - 1] = tampered[tampered.length - 1]! ^ 1;
  assert.throws(() => {
    const check = createDecipheriv('aes-256-gcm', key, tampered.subarray(0, 12));
    check.setAuthTag(tampered.subarray(12, 28));
    check.update(tampered.subarray(28));
    check.final();
  });
  writeFileSync(
    join(root, 'report.json'),
    JSON.stringify(
      {
        status: 'passed',
        source: 'sd_catalog_test',
        at: new Date().toISOString(),
        elapsedMs: Date.now() - started,
        tables: before.data.length,
        rows: before.data.reduce((n, r) => n + r.count, 0),
        checked: [
          'all commerce table digests',
          'RLS policies',
          'constraints',
          'triggers',
          'restricted role guards',
          'authenticated encryption tamper rejection',
        ],
        limitations:
          'Same-cluster synthetic-data drill; existing roles reused. Auth database, remote storage and off-site key recovery not verified. Ephemeral key discarded; this archive is not an operational backup.',
      },
      null,
      2,
    ),
  );
  console.log(
    `PASS encrypted backup/restore drill: ${before.data.length} tables; report ${join(root, 'report.json')}`,
  );
} finally {
  key.fill(0);
  rmSync(plain, { force: true });
  rmSync(restored, { force: true });
  if (connected) await into.end();
  await from.end();
  if (created) await control.query(`DROP DATABASE "${name}"`);
  await control.end();
}
