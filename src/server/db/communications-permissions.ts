import type { PrismaClient } from '@/generated/prisma/client';
export async function assertCommunicationsRole(db: PrismaClient) {
  const [row] = await db.$queryRaw<
    { safe: boolean }[]
  >`SELECT NOT r.rolsuper AND NOT r.rolbypassrls AND NOT r.rolcreaterole AND NOT r.rolcreatedb AND pg_has_role(current_user,'sd_communications_worker','MEMBER') AND current_setting('TimeZone')='UTC' AND NOT has_schema_privilege(current_user,'commerce','CREATE') AND NOT has_table_privilege(current_user,'commerce."Order"','SELECT,INSERT,UPDATE,DELETE') AND NOT has_table_privilege(current_user,'commerce."EmailMessage"','INSERT,DELETE') AND NOT has_column_privilege(current_user,'commerce."EmailMessage"','payload','UPDATE') AND NOT EXISTS(SELECT 1 FROM pg_tables t WHERE t.schemaname='commerce' AND (t.tableowner=current_user OR has_table_privilege(current_user,format('%I.%I',t.schemaname,t.tablename),'TRUNCATE') OR (t.tablename NOT IN ('EmailMessage','EmailAttempt','EmailDelivery','AdminNotification') AND has_table_privilege(current_user,format('%I.%I',t.schemaname,t.tablename),'INSERT,UPDATE,DELETE')))) AS safe FROM pg_roles r WHERE r.rolname=current_user`;
  if (!row?.safe) throw new Error('Communications requires its restricted UTC worker role.');
}
