import type { PrismaClient } from '@/generated/prisma/client';
export async function assertAccountRole(db: PrismaClient) {
  const rows = await db.$queryRaw<{ safe: boolean }[]>`
    SELECT NOT r.rolsuper AND NOT r.rolbypassrls AND NOT r.rolcreaterole AND NOT r.rolcreatedb
      AND pg_has_role(current_user, 'sd_account_writer', 'MEMBER')
      AND NOT has_schema_privilege(current_user, 'commerce', 'CREATE')
      AND NOT EXISTS (
        SELECT 1 FROM pg_tables t WHERE t.schemaname='commerce'
        AND (t.tableowner=current_user OR has_table_privilege(current_user, format('%I.%I', t.schemaname, t.tablename), 'TRUNCATE')
          OR (t.tablename NOT IN ('CustomerProfile','Address','WishlistItem','AuthRateLimit')
          AND has_table_privilege(current_user, format('%I.%I', t.schemaname, t.tablename), 'INSERT,UPDATE,DELETE')))
      ) AS safe FROM pg_roles r WHERE r.rolname=current_user`;
  if (!rows[0]?.safe)
    throw new Error('Account database role must have restricted account privileges.');
}
