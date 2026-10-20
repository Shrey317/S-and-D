import 'server-only';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { isAdministrator, requireIdentity } from '@/server/auth/identity';
import { getAdminDatabase } from '@/server/db/admin-client';
import { getAccountDatabase } from '@/server/db/account-client';
import { consumeAuthLimit } from '@/server/auth/rate-limit';
import { serverEnv } from '@/config/env.server';
export async function adminContext(mutation = false) {
  if (!(await isAdministrator())) notFound();
  const identity = await requireIdentity();
  if (mutation) {
    if ((await headers()).get('origin') !== new URL(serverEnv.NEXT_PUBLIC_SITE_URL).origin)
      throw new Error('Invalid origin.');
    if (
      !(await consumeAuthLimit(
        await getAccountDatabase(),
        serverEnv.AUTH_RATE_LIMIT_SECRET!,
        `admin:${identity.id}`,
        60,
        60,
      ))
    )
      throw new Error('Too many administrator changes.');
  }
  return { db: await getAdminDatabase(), actor: identity.id };
}
