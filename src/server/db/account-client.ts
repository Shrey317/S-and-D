import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { serverEnv } from '@/config/env.server';
import { assertAccountRole } from './account-permissions';
const globalDb = globalThis as unknown as { accountDb?: PrismaClient };
export async function getAccountDatabase() {
  if (!serverEnv.AUTH_ENABLED || !serverEnv.ACCOUNT_DATABASE_URL)
    throw new Error('Accounts are unavailable.');
  globalDb.accountDb ??= new PrismaClient({
    adapter: new PrismaPg(
      {
        connectionString: serverEnv.ACCOUNT_DATABASE_URL,
        options: '-c timezone=UTC',
        max: 3,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 10000,
      },
      { schema: 'commerce' },
    ),
  });
  await assertAccountRole(globalDb.accountDb);
  return globalDb.accountDb;
}
