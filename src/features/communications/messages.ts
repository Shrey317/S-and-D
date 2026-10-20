import { z } from 'zod';
export const noticeSchema = z.object({
  orderId: z.uuid(),
  status: z.string().max(30),
  paymentStatus: z.string().max(40),
  total: z.string().regex(/^\d{1,12}\.\d{2}$/),
  method: z.enum(['COLLECTION', 'DELIVERY']),
  snapshot: z.object({
    name: z.string().max(100),
    phone: z.string().max(20),
    email: z.email(),
    isTest: z.boolean(),
    planningDate: z.string().max(10),
    lines: z
      .array(
        z.object({
          name: z.string().max(160),
          label: z.string().max(80),
          quantity: z.number().int().min(1).max(99),
          total: z.string(),
        }),
      )
      .max(100),
  }),
});
export type Notice = z.infer<typeof noticeSchema>;
export const noticeTitles: Record<string, string> = {
  ORDER_RECEIVED: 'Order received',
  PAYMENT_CONFIRMED: 'Payment confirmed',
  FULFILMENT_COMPLETED: 'Fulfilment completed',
  ORDER_CANCELLED: 'Order closed',
  REFUND_COMPLETED: 'Refund completed',
  PAYMENT_EXCEPTION: 'Payment needs review',
  EMAIL_REVIEW: 'Email needs review',
};
export function noticeSummary(kind: string, n: Notice) {
  switch (kind) {
    case 'ORDER_RECEIVED':
      return 'Your order has been received. This is not a fulfilment promise; the shop will confirm arrangements.';
    case 'PAYMENT_CONFIRMED':
      return 'The payment record has been verified. Fulfilment arrangements remain separate.';
    case 'FULFILMENT_COMPLETED':
      return n.method === 'COLLECTION'
        ? 'The shop has recorded your order as collected.'
        : 'The shop has recorded your order as delivered.';
    case 'ORDER_CANCELLED':
      return n.status === 'EXPIRED'
        ? 'This order expired and its held stock was released. Contact the shop if you have already paid.'
        : 'This order was cancelled. Contact the shop with any questions.';
    case 'REFUND_COMPLETED':
      return 'The shop has recorded an externally completed refund. This notice does not initiate a refund. Please review your payment record for the amount.';
    case 'PAYMENT_EXCEPTION':
      return 'A payment exception requires administrator reconciliation. Do not fulfil until it is resolved.';
    default:
      throw new Error('Unsupported notice.');
  }
}
export function whatsappDraft(n: Notice) {
  const phone = n.snapshot.phone.replace(/\D/g, '').replace(/^0/, '27');
  if (!/^27[1-9]\d{8}$/.test(phone))
    throw new Error('A valid South African customer phone is required.');
  const name = n.snapshot.name.replace(/[\r\n]+/g, ' ');
  const text = `${n.snapshot.isTest ? 'LOCAL TEST — not a real purchase.\n\n' : ''}Hello ${name}, thank you for ordering from S & D Fruit and Veg! Your order #${n.orderId} has been received. Your order total is R${n.total}. Fulfilment: ${n.method === 'DELIVERY' ? 'Delivery' : 'Collection'}. Current order status: ${n.status}; payment: ${n.paymentStatus}. We will confirm arrangements and keep you informed about your order. Thank you for shopping with us!`;
  return { phone, text };
}
export function deliveryLabel(types: string[]) {
  for (const [type, label] of [
    ['email.complained', 'Complaint reported'],
    ['email.bounced', 'Bounced'],
    ['email.failed', 'Delivery failed'],
    ['email.suppressed', 'Suppressed'],
    ['email.delivered', 'Delivered to recipient mail server'],
    ['email.delivery_delayed', 'Delivery delayed'],
    ['email.sent', 'Provider sent'],
  ] as const)
    if (types.includes(type)) return label;
  return 'No delivery event received';
}
