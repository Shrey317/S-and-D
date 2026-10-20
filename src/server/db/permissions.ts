import type { PrismaClient } from '@/generated/prisma/client';
export async function assertStorefrontRole(db: PrismaClient) {
  const rows = await db.$queryRaw<{ safe: boolean }[]>`
    SELECT NOT r.rolsuper AND NOT r.rolbypassrls
      AND pg_has_role(current_user, 'sd_catalog_reader', 'MEMBER')
      AND NOT has_schema_privilege(current_user, 'commerce', 'CREATE')
      AND NOT EXISTS (
        SELECT 1 FROM pg_tables t WHERE t.schemaname='commerce'
        AND (t.tableowner=current_user OR has_table_privilege(current_user, format('%I.%I', t.schemaname, t.tablename), 'INSERT,UPDATE,DELETE,TRUNCATE'))
      ) AS safe FROM pg_roles r WHERE r.rolname=current_user`;
  if (!rows[0]?.safe)
    throw new Error('Storefront database role must be a restricted catalog reader.');
}
