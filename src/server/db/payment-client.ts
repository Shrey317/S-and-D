import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { serverEnv } from '@/config/env.server';
import { assertPaymentRole } from './payment-permissions';
const globalDb = globalThis as unknown as { paymentDb?: PrismaClient };
export async function getPaymentDatabase() {
  if (!serverEnv.PAYMENTS_ENABLED || !serverEnv.PAYMENT_DATABASE_URL)
    throw new Error('Payment processing is unavailable.');
  globalDb.paymentDb ??= new PrismaClient({
    adapter: new PrismaPg(
      {
        connectionString: serverEnv.PAYMENT_DATABASE_URL,
        options: '-c timezone=UTC',
        max: 4,
        connectionTimeoutMillis: 5000,
      },
      { schema: 'commerce' },
    ),
  });
  await assertPaymentRole(globalDb.paymentDb);
  return globalDb.paymentDb;
}
