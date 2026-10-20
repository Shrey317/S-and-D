export const paymentMethods = [
  'TEST',
  'PAYFAST_CARD',
  'PAYFAST_EFT',
  'MANUAL_EFT',
  'COD',
  'COLLECTION',
] as const;
export type PaymentMethod = (typeof paymentMethods)[number];
export const paymentLabels: Record<PaymentMethod, string> = {
  TEST: 'Test reservation only',
  PAYFAST_CARD: 'Payfast card (sandbox)',
  PAYFAST_EFT: 'Payfast Instant EFT (sandbox)',
  MANUAL_EFT: 'Manual EFT',
  COD: 'Cash on delivery',
  COLLECTION: 'Payment on collection',
};
export function isOnline(method: string) {
  return method === 'PAYFAST_CARD' || method === 'PAYFAST_EFT';
}
export function holdMinutes(method: PaymentMethod) {
  return method === 'MANUAL_EFT' ? 1440 : isOnline(method) || method === 'TEST' ? 20 : null;
}
export function compatibleMethod(payment: PaymentMethod, fulfilment: 'DELIVERY' | 'COLLECTION') {
  if (payment === 'COD') return fulfilment === 'DELIVERY';
  if (payment === 'COLLECTION') return fulfilment === 'COLLECTION';
  return true;
}
