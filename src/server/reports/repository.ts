import type { PrismaClient } from '@/generated/prisma/client';
import { reportRange } from '@/features/reports/rules';
import { cents, decimal } from '@/features/checkout/rules';
type Sale = {
  id: string;
  customerId: string;
  name: string;
  day: string;
  gross: string;
  refunds: string;
  net: string;
  lines: { variantId: string; name: string; quantity: number }[];
};
export async function readReports(
  db: PrismaClient,
  raw: { from?: string | undefined; to?: string | undefined },
) {
  const range = reportRange(raw);
  return db.$transaction(
    async (tx) => {
      const sales = await tx.$queryRaw<
        Sale[]
      >`SELECT o.id,o."customerId",o.snapshot->>'name' AS name,to_char(o."createdAt" AT TIME ZONE 'Africa/Johannesburg','YYYY-MM-DD') AS day,o.total::text AS gross,p.refunded::text AS refunds,(o.total-p.refunded)::text AS net,o.snapshot->'lines' AS lines FROM commerce."Order" o JOIN commerce."Payment" p ON p."orderId"=o.id WHERE o."createdAt">=${range.start} AND o."createdAt"<${range.end} AND o.status IN ('DELIVERED','COLLECTED') AND o."paymentStatus" IN ('PAID','PARTIALLY_REFUNDED','REFUNDED') AND o.snapshot->>'isTest'='false' AND p.exception IS NULL AND p.received=o.total ORDER BY o."createdAt",o.id LIMIT 5001`;
      const variants = await tx.productVariant.findMany({
        include: { product: true, inventory: true },
        orderBy: [{ sku: 'asc' }, { id: 'asc' }],
        take: 5001,
      });
      const profiles = await tx.customerProfile.findMany({ orderBy: { id: 'asc' }, take: 5001 });
      const performance = await tx.$queryRaw<
        { status: string; method: string; orders: number }[]
      >`SELECT status,method,count(*)::integer AS orders FROM commerce."Order" WHERE "createdAt">=${range.start} AND "createdAt"<${range.end} AND snapshot->>'isTest'='false' GROUP BY status,method ORDER BY status,method`;
      if ([sales, variants, profiles].some((rows) => rows.length > 5000))
        throw new Error(
          'Report exceeds 5,000 records. Narrow the dates or arrange an operator export.',
        );
      const totals = { gross: 0n, refunds: 0n, net: 0n };
      const days = new Map<
        string,
        { gross: bigint; refunds: bigint; net: bigint; orders: number }
      >();
      for (let d = Date.parse(range.from); d <= Date.parse(range.to); d += 86400000)
        days.set(new Date(d).toISOString().slice(0, 10), {
          gross: 0n,
          refunds: 0n,
          net: 0n,
          orders: 0,
        });
      const customers = new Map<
        string,
        { id: string; name: string; phone: string; orders: number; net: bigint }
      >(
        profiles.map((p) => [p.id, { id: p.id, name: p.name, phone: p.phone, orders: 0, net: 0n }]),
      );
      const best = new Map<string, { id: string; name: string; quantity: number }>();
      for (const sale of sales) {
        const day = days.get(sale.day)!;
        day.orders++;
        for (const key of ['gross', 'refunds', 'net'] as const) {
          const amount = cents(sale[key]);
          totals[key] += amount;
          day[key] += amount;
        }
        const customer = customers.get(sale.customerId) || {
          id: sale.customerId,
          name: sale.name,
          phone: '',
          orders: 0,
          net: 0n,
        };
        customer.orders++;
        customer.net += cents(sale.net);
        customers.set(sale.customerId, customer);
        // Refund amounts have no returned-unit record. Fully refunded orders do not contribute popularity.
        if (cents(sale.net) > 0n)
          for (const line of sale.lines) {
            const item = best.get(line.variantId) || {
              id: line.variantId,
              name: line.name,
              quantity: 0,
            };
            item.quantity += line.quantity;
            best.set(line.variantId, item);
          }
      }
      const daily = [...days].map(([date, v]) => ({
        date,
        orders: v.orders,
        gross: decimal(v.gross),
        refunds: decimal(v.refunds),
        net: decimal(v.net),
      }));
      const months = new Map<
        string,
        { orders: number; gross: bigint; refunds: bigint; net: bigint }
      >();
      for (const d of daily) {
        const key = d.date.slice(0, 7),
          m = months.get(key) || { orders: 0, gross: 0n, refunds: 0n, net: 0n };
        m.orders += d.orders;
        m.gross += cents(d.gross);
        m.refunds += cents(d.refunds);
        m.net += cents(d.net);
        months.set(key, m);
      }
      return {
        from: range.from,
        to: range.to,
        generatedAt: new Date().toISOString(),
        performance,
        totals: {
          orders: sales.length,
          gross: decimal(totals.gross),
          refunds: decimal(totals.refunds),
          net: decimal(totals.net),
        },
        daily,
        monthly: [...months].map(([month, m]) => ({
          month,
          orders: m.orders,
          gross: decimal(m.gross),
          refunds: decimal(m.refunds),
          net: decimal(m.net),
        })),
        bestsellers: [...best.values()].sort(
          (a, b) => b.quantity - a.quantity || a.id.localeCompare(b.id),
        ),
        sales: sales.map((sale) => ({
          id: sale.id,
          customerId: sale.customerId,
          name: sale.name,
          day: sale.day,
          gross: sale.gross,
          refunds: sale.refunds,
          net: sale.net,
        })),
        inventory: variants.map((v) => ({
          sku: v.sku,
          name: v.product.name,
          label: v.label,
          state: v.product.state,
          active: v.active,
          price: v.price.toFixed(2),
          physical: v.inventory?.onHand || 0,
          reserved: v.inventory?.reserved || 0,
          available: (v.inventory?.onHand || 0) - (v.inventory?.reserved || 0),
          threshold: v.lowStockThreshold,
        })),
        customers: [...customers.values()].map((c) => ({ ...c, net: decimal(c.net) })),
      };
    },
    { isolationLevel: 'RepeatableRead', timeout: 15000 },
  );
}
export type Report = Awaited<ReturnType<typeof readReports>>;
