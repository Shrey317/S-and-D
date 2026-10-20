import { loadLocalEnvironment, toolingDatabase } from './database-tools';
import { assertCommerceRole } from '../src/server/db/commerce-permissions';
import { expireReservations } from '../src/server/checkout/repository';
loadLocalEnvironment();
if (!process.env.COMMERCE_DATABASE_URL) throw new Error('COMMERCE_DATABASE_URL required.');
const db = toolingDatabase(process.env.COMMERCE_DATABASE_URL);
try {
  await assertCommerceRole(db);
  await expireReservations(db);
  console.log('Expired unpaid reservation batch processed.');
} finally {
  await db.$disconnect();
}
