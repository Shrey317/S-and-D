import type { PrismaClient } from '@/generated/prisma/client';
export async function assertAdminRole(db: PrismaClient) {
  const rows = await db.$queryRaw<
    { safe: boolean }[]
  >`SELECT NOT r.rolsuper AND NOT r.rolbypassrls AND NOT r.rolcreaterole AND NOT r.rolcreatedb AND pg_has_role(current_user,'sd_admin_writer','MEMBER') AND current_setting('TimeZone')='UTC' AND NOT has_schema_privilege(current_user,'commerce','CREATE')
 AND NOT has_table_privilege(current_user,'commerce."AdministratorGrant"','INSERT,UPDATE,DELETE')
 AND NOT has_table_privilege(current_user,'commerce."AdminAudit"','UPDATE,DELETE') AND NOT has_table_privilege(current_user,'commerce."InventoryAdjustment"','UPDATE,DELETE')
 AND NOT has_table_privilege(current_user,'commerce."Payment"','INSERT,UPDATE,DELETE')
 AND NOT has_column_privilege(current_user,'commerce."Order"','snapshot','UPDATE')
 AND NOT has_column_privilege(current_user,'commerce."Order"','paymentStatus','UPDATE')
 AND NOT EXISTS(SELECT 1 FROM pg_tables t WHERE t.schemaname='commerce' AND (t.tableowner=current_user OR has_table_privilege(current_user,format('%I.%I',t.schemaname,t.tablename),'TRUNCATE'))) AS safe FROM pg_roles r WHERE r.rolname=current_user`;
  if (!rows[0]?.safe) throw new Error('Administration requires its restricted UTC database role.');
}
