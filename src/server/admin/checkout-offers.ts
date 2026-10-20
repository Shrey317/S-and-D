import type { Prisma } from '@/generated/prisma/client';
import { discountFor } from '@/features/admin/promotions';
import { cents } from '@/features/checkout/rules';
export async function checkoutOffer(
  tx: Prisma.TransactionClient,
  lines: { variantId: string; productId: string; quantity: number; price: string }[],
  code: string,
  lock: boolean,
) {
  const now = new Date();
  const rows = await tx.promotion.findMany({
    where: { active: true, startsAt: { lte: now }, endsAt: { gt: now }, code: code || null },
    orderBy: { id: 'asc' },
  });
  if (lock)
    for (const p of rows) await tx.$queryRaw`SELECT commerce.lock_promotion(${p.id}::uuid)::text`;
  // Read again after locks: an administrator may have edited/disabled an offer while we waited.
  const fresh = lock
    ? await tx.promotion.findMany({
        where: {
          id: { in: rows.map((p) => p.id) },
          active: true,
          startsAt: { lte: new Date() },
          endsAt: { gt: new Date() },
          code: code || null,
        },
        orderBy: { id: 'asc' },
      })
    : rows;
  let chosen: { id: string; version: number; name: string; discount: string } | null = null;
  for (const p of fresh) {
    const [uses] = await tx.$queryRaw<
      { total: bigint; customer: bigint }[]
    >`SELECT * FROM commerce.promotion_uses(${p.id}::uuid)`;
    if (!uses || uses.total >= p.maxUses || uses.customer >= p.perCustomer) continue;
    const discount = discountFor(
      {
        kind: p.kind,
        value: p.value.toFixed(2),
        productId: p.productId,
        bundle: p.bundle as { variantId: string; quantity: number }[],
      },
      lines,
    );
    if (cents(discount) > 0n && (!chosen || cents(discount) > cents(chosen.discount)))
      chosen = { id: p.id, version: p.version, name: p.name, discount };
  }
  return {
    promotion: chosen,
    promotionError:
      code && !chosen
        ? 'This code is unavailable, exhausted or does not match your basket. Remove it or choose another code.'
        : null,
  };
}
