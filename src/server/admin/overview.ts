import type { PrismaClient } from '@/generated/prisma/client';
export async function overview(db: PrismaClient) {
  const [money] = await db.$queryRaw<
    { daily: string; monthly: string }[]
  >`SELECT COALESCE(sum(o.total-p.refunded) FILTER(WHERE (o."createdAt" AT TIME ZONE 'Africa/Johannesburg')::date=(CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Johannesburg')::date),0)::text AS daily, COALESCE(sum(o.total-p.refunded) FILTER(WHERE date_trunc('month',o."createdAt" AT TIME ZONE 'Africa/Johannesburg')=date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Johannesburg')),0)::text AS monthly FROM commerce."Order" o JOIN commerce."Payment" p ON p."orderId"=o.id WHERE o.status IN ('DELIVERED','COLLECTED') AND o."paymentStatus" IN ('PAID','PARTIALLY_REFUNDED') AND o.snapshot->>'isTest'='false' AND p.exception IS NULL AND p.received=o.total AND p.refunded<o.total`;
  const [counts, low, recent] = await Promise.all([
    db.order.groupBy({ by: ['status'], _count: true }),
    db.$queryRaw<
      { id: string; name: string; label: string; available: number }[]
    >`SELECT v.id,p.name,v.label,b."onHand"-b.reserved AS available FROM commerce."ProductVariant" v JOIN commerce."Product" p ON p.id=v."productId" JOIN commerce."InventoryBalance" b ON b."variantId"=v.id WHERE v.active AND p.state='ACTIVE' AND b."onHand"-b.reserved<=v."lowStockThreshold" ORDER BY available,v.id LIMIT 10`,
    db.order.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
  ]);
  const best = await db.$queryRaw<
    { name: string; quantity: bigint }[]
  >`SELECT line->>'name' AS name,sum((line->>'quantity')::integer)::bigint AS quantity FROM commerce."Order" o CROSS JOIN LATERAL jsonb_array_elements(o.snapshot->'lines') line JOIN commerce."Payment" p ON p."orderId"=o.id WHERE o.status IN ('DELIVERED','COLLECTED') AND o."paymentStatus" IN ('PAID','PARTIALLY_REFUNDED') AND o.snapshot->>'isTest'='false' AND p.exception IS NULL AND p.refunded<o.total GROUP BY line->>'name' ORDER BY quantity DESC,name LIMIT 5`;
  return { money, counts, low, recent, best };
}
