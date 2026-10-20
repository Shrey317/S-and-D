import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
const origin = 'http://127.0.0.1:3200';
const probe = createServer();
await new Promise<void>((resolve, reject) => {
  probe.once('error', reject);
  probe.listen(3200, '127.0.0.1', () =>
    probe.close((error) => (error ? reject(error) : resolve())),
  );
});
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3200'],
  {
    windowsHide: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      APP_ENV: 'test',
      NEXT_PUBLIC_SITE_URL: origin,
      DATABASE_ENABLED: 'true',
      DATABASE_URL: 'postgresql://unavailable:dummy@127.0.0.1:1/sd_catalog_test',
      DIRECT_URL: '',
      AUTH_ENABLED: 'false',
      CART_ENABLED: 'false',
      LOCAL_CHECKOUT_ENABLED: 'false',
      PAYMENTS_ENABLED: 'false',
      PAYFAST_ENABLED: 'false',
      MANUAL_EFT_ENABLED: 'false',
      PAYFAST_INSTANT_EFT_ENABLED: 'false',
      EMAIL_ENABLED: 'false',
      EMAIL_CAPTURE_ENABLED: 'false',
      CLOUDINARY_ENABLED: 'false',
    },
  },
);
try {
  let home: Response | undefined;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      home = await fetch(origin, { signal: AbortSignal.timeout(10000) });
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  assert.equal(home?.status, 200, 'Home must render safe defaults during catalog outage.');
  const catalog = await fetch(`${origin}/shop`);
  assert.equal(catalog.status, 200);
  const html = await catalog.text();
  assert.ok(html.includes('catalog is temporarily unavailable'));
  for (const forbidden of ['postgresql://', 'ECONNREFUSED', 'dummy@'])
    assert.ok(!html.includes(forbidden));
  console.log(
    'PASS database outage: safe home, recoverable catalog, no connection detail leakage.',
  );
} finally {
  server.kill();
}
