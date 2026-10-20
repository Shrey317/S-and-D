// Creates only this project's isolated cluster and named development/test databases.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

const root = resolve('.local');
const data = join(root, 'postgres');
const bin =
  process.env.PG_BIN || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/18/bin' : '');
const executable = (name) =>
  bin ? join(bin, name + (process.platform === 'win32' ? '.exe' : '')) : name;
const port = 55432;
mkdirSync(root, { recursive: true });
const secretsFile = join(root, 'database-secrets.json');
const secrets = existsSync(secretsFile)
  ? JSON.parse(readFileSync(secretsFile, 'utf8'))
  : {
      owner: randomBytes(24).toString('hex'),
      reader: randomBytes(24).toString('hex'),
    };
writeFileSync(secretsFile, JSON.stringify(secrets), { mode: 0o600 });
function run(name, args, allowFailure = false) {
  const result = spawnSync(executable(name), args, {
    encoding: 'utf8',
    windowsHide: true,
    stdio: name === 'pg_ctl' ? 'ignore' : 'pipe',
    timeout: 60000,
  });
  if (result.status !== 0 && !allowFailure)
    throw new Error(
      `${name} failed: ${result.stderr || 'Check local PostgreSQL installation and log.'}`,
    );
  return result.status;
}
if (!existsSync(join(data, 'PG_VERSION'))) {
  const passwordFile = join(root, 'postgres-password');
  writeFileSync(passwordFile, secrets.owner, { mode: 0o600 });
  run('initdb', [
    '-D',
    data,
    '-U',
    'sd_owner',
    '--pwfile',
    passwordFile,
    '--auth=scram-sha-256',
    '--encoding=UTF8',
    '--locale=C',
  ]);
}
if (run('pg_ctl', ['-D', data, 'status'], true) !== 0) {
  run('pg_ctl', [
    '-D',
    data,
    '-l',
    join(root, 'postgres.log'),
    '-o',
    `-h 127.0.0.1 -p ${port}`,
    '-w',
    'start',
  ]);
}
const base = `postgresql://sd_owner:${secrets.owner}@127.0.0.1:${port}`;
const admin = new pg.Client({ connectionString: base + '/postgres' });
await admin.connect();
try {
  for (const name of ['sd_catalog_dev', 'sd_catalog_test']) {
    if (!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])).rowCount)
      await admin.query(`CREATE DATABASE ${name}`);
  }
  if (!(await admin.query("SELECT 1 FROM pg_roles WHERE rolname='sd_catalog_reader'")).rowCount)
    await admin.query('CREATE ROLE sd_catalog_reader NOLOGIN NOBYPASSRLS');
  if (!(await admin.query("SELECT 1 FROM pg_roles WHERE rolname='sd_runtime'")).rowCount) {
    // Random hex only; values are never printed or supplied on the process command line.
    await admin.query(
      `CREATE ROLE sd_runtime LOGIN PASSWORD '${secrets.reader}' INHERIT NOBYPASSRLS`,
    );
  }
  await admin.query('GRANT sd_catalog_reader TO sd_runtime');
} finally {
  await admin.end();
}
for (const database of ['sd_catalog_dev', 'sd_catalog_test']) {
  const connection = new pg.Client({ connectionString: base + '/' + database });
  await connection.connect();
  try {
    const exists = await connection.query(
      `SELECT to_regclass('commerce."DevelopmentMarker"') AS marker`,
    );
    if (exists.rows[0].marker)
      await connection.query(
        `INSERT INTO commerce."DevelopmentMarker" (id, purpose) VALUES ('local-catalog', 'isolated development only') ON CONFLICT (id) DO NOTHING`,
      );
  } finally {
    await connection.end();
  }
}
const envPath = resolve('.env.local');
if (!existsSync(envPath)) {
  writeFileSync(
    envPath,
    `APP_ENV=development\nNEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000\nDATABASE_ENABLED=true\nCATALOG_ALLOW_SAMPLES=true\nDATABASE_URL=postgresql://sd_runtime:${secrets.reader}@127.0.0.1:${port}/sd_catalog_dev\nDIRECT_URL=${base}/sd_catalog_dev\nTEST_DATABASE_URL=${base}/sd_catalog_test\nTEST_READER_URL=postgresql://sd_runtime:${secrets.reader}@127.0.0.1:${port}/sd_catalog_test\nCLOUDINARY_ENABLED=false\nNEXT_TELEMETRY_DISABLED=1\n`,
    { mode: 0o600 },
  );
  console.log(
    'Isolated PostgreSQL started on loopback port 55432; .env.local created. No existing environment file overwritten.',
  );
} else
  console.log(
    'Isolated PostgreSQL available. Existing .env.local preserved; use .local/database-secrets.json for local configuration.',
  );
