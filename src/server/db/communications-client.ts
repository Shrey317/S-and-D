import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { serverEnv } from '@/config/env.server';
import { assertCommunicationsRole } from './communications-permissions';
const globals = globalThis as unknown as { communicationsDb?: PrismaClient };
export async function getCommunicationsDatabase() {
  if (!serverEnv.COMMUNICATIONS_DATABASE_URL)
    throw new Error('Communications database is not configured.');
  globals.communicationsDb ??= new PrismaClient({
    adapter: new PrismaPg(
      {
        connectionString: serverEnv.COMMUNICATIONS_DATABASE_URL,
        options: '-c timezone=UTC',
        max: 3,
        connectionTimeoutMillis: 5000,
      },
      { schema: 'commerce' },
    ),
  });
  await assertCommunicationsRole(globals.communicationsDb);
  return globals.communicationsDb;
}
