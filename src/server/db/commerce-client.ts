import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { serverEnv } from '@/config/env.server';
import { assertCommerceRole } from './commerce-permissions';
const globalDb = globalThis as unknown as { commerceDb?: PrismaClient };
export async function getCommerceDatabase() {
  if (!serverEnv.CART_ENABLED || !serverEnv.COMMERCE_DATABASE_URL)
    throw new Error('Baskets are unavailable.');
  globalDb.commerceDb ??= new PrismaClient({
    adapter: new PrismaPg(
      {
        connectionString: serverEnv.COMMERCE_DATABASE_URL,
        options: '-c timezone=UTC',
        max: 4,
        connectionTimeoutMillis: 5000,
      },
      { schema: 'commerce' },
    ),
  });
  await assertCommerceRole(globalDb.commerceDb);
  return globalDb.commerceDb;
}
