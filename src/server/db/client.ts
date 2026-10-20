import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { serverEnv } from '@/config/env.server';
import { assertStorefrontRole } from './permissions';

const globalDb = globalThis as unknown as { catalogDb?: PrismaClient };
export async function getDatabase() {
  if (!serverEnv.DATABASE_ENABLED || !serverEnv.DATABASE_URL) return null;
  if (!globalDb.catalogDb) {
    globalDb.catalogDb = new PrismaClient({
      adapter: new PrismaPg(
        {
          connectionString: serverEnv.DATABASE_URL,
          options: '-c timezone=UTC',
          max: 3,
          connectionTimeoutMillis: 5000,
          idleTimeoutMillis: 10000,
        },
        { schema: 'commerce' },
      ),
    });
  }
  await assertStorefrontRole(globalDb.catalogDb);
  return globalDb.catalogDb;
}
