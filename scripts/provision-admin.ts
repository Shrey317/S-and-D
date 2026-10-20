import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { loadLocalEnvironment, toolingDatabase } from './database-tools';
loadLocalEnvironment();
async function main() {
  const [operation, rawId, reason] = process.argv.slice(2);
  const id = z.uuid().parse(rawId);
  if (
    !['grant', 'revoke'].includes(operation || '') ||
    !reason ||
    reason.length < 10 ||
    reason.length > 500
  )
    throw new Error(
      'Usage: admin:provision grant|revoke <auth UUID> <reviewed reason, 10–500 characters>',
    );
  if (
    !process.env.DIRECT_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_ADMIN_KEY
  )
    throw new Error('Operator-only database and Auth admin credentials required.');
  const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_ADMIN_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await auth.auth.admin.getUserById(id);
  if (
    operation === 'grant' &&
    (error ||
      !data.user?.email_confirmed_at ||
      data.user.is_anonymous ||
      !data.user.factors?.some(
        (factor) => factor.factor_type === 'totp' && factor.status === 'verified',
      ))
  )
    throw new Error('Grant requires a confirmed user with a verified authenticator.');
  const db = toolingDatabase(process.env.DIRECT_URL);
  try {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(736401)::text`;
      if (operation === 'revoke') {
        await tx.administratorGrant.deleteMany({ where: { customerId: id } });
        return;
      }
      if (await tx.administratorGrant.count({ where: { customerId: { not: id } } }))
        throw new Error(
          'A sole administrator already exists. Revoke that grant before a controlled transfer.',
        );
      await tx.administratorGrant.upsert({
        where: { customerId: id },
        create: { customerId: id, reason },
        update: { reason, grantedAt: new Date() },
      });
    });
    console.log(
      `Administrator ${operation} completed for the specified UUID. Record this operation and reason in the restricted operator log.`,
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error(
    'Administrator provisioning failed. Verify operator credentials, confirmed identity, MFA and the sole-administrator rule. No secrets were logged.',
  );
  process.exitCode = 1;
});
