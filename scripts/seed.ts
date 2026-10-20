import { assertLocalTarget, loadLocalEnvironment, toolingDatabase } from './database-tools';
import { seedCatalog } from './seed-data';

loadLocalEnvironment();
async function main() {
  const url = process.env.DIRECT_URL;
  if (!url) throw new Error('DIRECT_URL is required');
  assertLocalTarget(url, process.env.APP_ENV);
  const db = toolingDatabase(url);
  try {
    await seedCatalog(db);
    console.log(
      'Development catalog ready: 30 clearly labelled samples, no customer/order/payment data.',
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error(
    'Seed refused or failed. Confirm local target, environment and development marker. No credentials were logged.',
  );
  process.exitCode = 1;
});
