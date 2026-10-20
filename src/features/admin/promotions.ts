import { cents, decimal } from '@/features/checkout/rules';
export type Offer = {
  kind: string;
  value: string;
  productId: string | null;
  bundle: { variantId: string; quantity: number }[];
};
export function discountFor(
  offer: Offer,
  lines: { variantId: string; productId: string; quantity: number; price: string }[],
) {
  const eligible = lines.filter((l) => !offer.productId || l.productId === offer.productId);
  const subtotal = eligible.reduce((sum, l) => sum + cents(l.price) * BigInt(l.quantity), 0n);
  let discount = 0n;
  if (offer.kind === 'PERCENT') discount = (subtotal * cents(offer.value)) / 10000n;
  else if (offer.kind === 'FIXED') discount = cents(offer.value);
  else if (offer.kind === 'BUNDLE' && offer.bundle.length) {
    const sets = Math.min(
      ...offer.bundle.map((b) =>
        Math.floor((lines.find((l) => l.variantId === b.variantId)?.quantity || 0) / b.quantity),
      ),
    );
    const cost =
      offer.bundle.reduce(
        (sum, b) =>
          sum +
          cents(lines.find((l) => l.variantId === b.variantId)?.price || '0.00') *
            BigInt(b.quantity),
        0n,
      ) * BigInt(sets);
    discount = cents(offer.value) * BigInt(sets);
    if (discount > cost) discount = cost;
  }
  return decimal(discount > subtotal ? subtotal : discount);
}
