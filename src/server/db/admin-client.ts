import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { serverEnv } from '@/config/env.server';
import { assertAdminRole } from './admin-permissions';
import { databaseConnection } from './connection';
const globalDb = globalThis as unknown as { adminDb?: PrismaClient };
export async function getAdminDatabase() {
  if (!serverEnv.ADMIN_DATABASE_URL) throw new Error('Administration database is not configured.');
  globalDb.adminDb ??= new PrismaClient({
    adapter: new PrismaPg(
      {
        ...databaseConnection(serverEnv.ADMIN_DATABASE_URL),
        options: '-c timezone=UTC',
        max: 4,
        connectionTimeoutMillis: 5000,
      },
      { schema: 'commerce' },
    ),
  });
  await assertAdminRole(globalDb.adminDb);
  return globalDb.adminDb;
}
