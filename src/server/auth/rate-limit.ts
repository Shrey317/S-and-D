import { createHmac } from 'node:crypto';
import type { PrismaClient } from '@/generated/prisma/client';

export async function consumeAuthLimit(
  db: PrismaClient,
  secret: string,
  subject: string,
  limit: number,
  seconds = 900,
) {
  const key = createHmac('sha256', secret).update(subject).digest('hex');
  // Atomic fixed window shared by every app instance; stores no raw email/IP/password.
  const result = await db.$queryRaw<{ hits: number }[]>`
    INSERT INTO commerce."AuthRateLimit" (key, hits, "expiresAt") VALUES (${key}, 1, now() + make_interval(secs => ${seconds}))
    ON CONFLICT (key) DO UPDATE SET
      hits = CASE WHEN commerce."AuthRateLimit"."expiresAt" <= now() THEN 1 ELSE LEAST(commerce."AuthRateLimit".hits + 1, 1000000) END,
      "expiresAt" = CASE WHEN commerce."AuthRateLimit"."expiresAt" <= now() THEN now() + make_interval(secs => ${seconds}) ELSE commerce."AuthRateLimit"."expiresAt" END
    RETURNING hits`;
  await db.$executeRaw`DELETE FROM commerce."AuthRateLimit" WHERE key IN (SELECT key FROM commerce."AuthRateLimit" WHERE "expiresAt" < now() - interval '1 day' LIMIT 100)`;
  return (result[0]?.hits ?? limit + 1) <= limit;
}
