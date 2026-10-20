import { z } from 'zod';
import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient, Payment, Order } from '@/generated/prisma/client';
import { cents, decimal, CheckoutError } from '@/features/checkout/rules';
import { isOnline } from '@/features/payments/methods';
import type { VerifiedNotification } from './payfast';
type Tx = Prisma.TransactionClient;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
async function locked<T>(
  db: PrismaClient,
  paymentId: string,
  work: (tx: Tx, payment: Payment, order: Order) => Promise<T>,
) {
  z.uuid().parse(paymentId);
  return db.$transaction(
    async (tx) => {
      const reference = await tx.payment.findUnique({
        where: { id: paymentId },
        select: { orderId: true },
      });
      if (!reference) throw new CheckoutError('Payment not found.');
      // Shared discipline with expiry: order, payment, then every balance in variant-ID order.
      await tx.$queryRaw`SELECT id FROM commerce."Order" WHERE id=${reference.orderId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM commerce."Payment" WHERE id=${paymentId}::uuid FOR UPDATE`;
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      const order = await tx.order.findUniqueOrThrow({ where: { id: reference.orderId } });
      return work(tx, payment, order);
    },
    { timeout: 15000, maxWait: 10000 },
  );
}
async function release(tx: Tx, orderId: string) {
  const held = await tx.inventoryReservation.findMany({
    where: { orderId, state: 'HELD' },
    orderBy: { variantId: 'asc' },
  });
  for (const line of held)
    await tx.inventoryBalance.update({
      where: { variantId: line.variantId },
      data: { reserved: { decrement: line.quantity }, version: { increment: 1 } },
    });
  await tx.inventoryReservation.updateMany({
    where: { orderId, state: 'HELD' },
    data: { state: 'RELEASED' },
  });
}
async function event(tx: Tx, paymentId: string, key: string, kind: string, outcome: string) {
  await tx.paymentEvent.create({ data: { paymentId, key, kind, outcome } });
  return outcome;
}
async function assertAdmin(tx: Tx, actorId: string) {
  z.uuid().parse(actorId);
  if (!(await tx.administratorGrant.findUnique({ where: { customerId: actorId } })))
    throw new CheckoutError('Administrator access required.');
}
async function audit(tx: Tx, actorId: string, paymentId: string, action: string, detail: string) {
  await tx.paymentAudit.create({ data: { actorId, paymentId, action, detail } });
}

async function receipt(tx: Tx, payment: Payment, order: Order, reference: string, amount: string) {
  // A provider transaction/receipt cannot be credited to two orders, even under concurrency.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${reference}, 6))::text`;
  const prior = await tx.paymentReceipt.findUnique({ where: { reference } });
  if (prior) {
    if (prior.paymentId === payment.id && prior.amount.toFixed(2) === amount) return 'DUPLICATE';
    await tx.payment.update({
      where: { id: payment.id },
      data: { exception: 'REFERENCE_CONFLICT' },
    });
    await tx.order.update({
      where: { id: order.id },
      data: { paymentException: 'REFERENCE_CONFLICT' },
    });
    return 'REFERENCE_CONFLICT';
  }
  if (cents(amount) <= 0n) throw new CheckoutError('Receipt amount must be positive.');
  await tx.paymentReceipt.create({ data: { paymentId: payment.id, reference, amount } });
  const received = decimal(cents(payment.received.toFixed(2)) + cents(amount));
  const mismatch =
    amount !== payment.expected.toFixed(2) || cents(payment.received.toFixed(2)) > 0n;
  const deadlineApplies = isOnline(payment.method) || payment.method === 'MANUAL_EFT';
  const late = order.status !== 'PENDING' || (deadlineApplies && order.expiresAt <= new Date());
  const exception = mismatch
    ? 'AMOUNT_MISMATCH_OR_EXTRA_PAYMENT'
    : late
      ? 'LATE_PAYMENT_OR_ORDER_CLOSED'
      : null;
  if (late && order.status === 'PENDING') {
    await release(tx, order.id);
    await tx.order.update({ where: { id: order.id }, data: { status: 'EXPIRED' } });
  }
  await tx.payment.update({
    where: { id: payment.id },
    data: { received, state: mismatch ? 'REVIEW' : 'PAID', exception },
  });
  await tx.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: mismatch
        ? order.paymentStatus === 'PAID'
          ? 'PAID'
          : 'AWAITING_PAYMENT'
        : 'PAID',
      paymentException: exception,
    },
  });
  return exception || 'PAID';
}

export async function applyNotification(db: PrismaClient, notification: VerifiedNotification) {
  return locked(db, notification.paymentId, async (tx, payment, order) => {
    if (!isOnline(payment.method)) throw new CheckoutError('Provider does not match this payment.');
    const prior = await tx.paymentEvent.findUnique({ where: { key: notification.eventKey } });
    if (prior) {
      if (prior.paymentId !== payment.id) throw new CheckoutError('Event conflict.');
      return prior.outcome;
    }
    let outcome: string;
    if (notification.status === 'COMPLETE')
      outcome = await receipt(
        tx,
        payment,
        order,
        `PAYFAST:${notification.providerId}`,
        notification.amount,
      );
    else if (notification.amount !== payment.expected.toFixed(2)) outcome = 'REJECTED_AMOUNT';
    else if (notification.status === 'PENDING') outcome = 'PENDING';
    else if (cents(payment.received.toFixed(2)) > 0n) outcome = 'IGNORED_AFTER_RECEIPT';
    else {
      await release(tx, order.id);
      await tx.payment.update({ where: { id: payment.id }, data: { state: 'FAILED' } });
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'FAILED',
          ...(order.status === 'PENDING' ? { status: 'CANCELLED' } : {}),
        },
      });
      outcome = 'FAILED';
    }
    return event(tx, payment.id, notification.eventKey, `PAYFAST_${notification.status}`, outcome);
  });
}
const referenceSchema = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .regex(/^[A-Za-z0-9 ._:/-]+$/);
const reasonSchema = z.string().trim().min(10).max(500);
export const recordReceiptSchema = z.object({
  paymentId: z.uuid(),
  key: z.uuid(),
  amount: z.string().regex(/^\d{1,12}\.\d{2}$/),
  reference: referenceSchema,
  reason: reasonSchema,
  verified: z.literal(true),
});
export async function recordVerifiedReceipt(
  db: PrismaClient,
  actorId: string,
  raw: z.input<typeof recordReceiptSchema>,
) {
  const input = recordReceiptSchema.parse(raw);
  return locked(db, input.paymentId, async (tx, payment, order) => {
    await assertAdmin(tx, actorId);
    if (input.amount !== payment.expected.toFixed(2))
      throw new CheckoutError('Record the exact order amount. Investigate mismatches separately.');
    if (isOnline(payment.method) && !/^\d{1,40}$/.test(input.reference))
      throw new CheckoutError('Use the Payfast transaction ID from the verified dashboard record.');
    const key = digest(`admin-receipt:${input.key}`),
      fingerprint = digest(JSON.stringify(input));
    const prior = await tx.paymentEvent.findUnique({ where: { key } });
    if (prior) {
      if (prior.paymentId !== payment.id || prior.outcome !== fingerprint)
        throw new CheckoutError('Receipt reference already used.');
      return;
    }
    const result = await receipt(
      tx,
      payment,
      order,
      `${isOnline(payment.method) ? 'PAYFAST' : 'MANUAL'}:${input.reference}`,
      input.amount,
    );
    await event(tx, payment.id, key, 'ADMIN_RECEIPT', fingerprint);
    await audit(
      tx,
      actorId,
      payment.id,
      'RECORD_VERIFIED_RECEIPT',
      `${result}: ${input.reason}`.slice(0, 500),
    );
  });
}
export const refundRequestSchema = z.object({
  paymentId: z.uuid(),
  key: z.uuid(),
  amount: z.string().regex(/^\d{1,12}\.\d{2}$/),
  reason: reasonSchema,
});
export async function requestRefund(
  db: PrismaClient,
  actorId: string,
  raw: z.input<typeof refundRequestSchema>,
) {
  const input = refundRequestSchema.parse(raw);
  if (cents(input.amount) <= 0n) throw new CheckoutError('Refund amount must be positive.');
  return locked(db, input.paymentId, async (tx, payment) => {
    await assertAdmin(tx, actorId);
    const prior = await tx.refund.findUnique({ where: { key: input.key } });
    if (prior) {
      if (
        prior.paymentId !== payment.id ||
        prior.amount.toFixed(2) !== input.amount ||
        prior.reason !== input.reason
      )
        throw new CheckoutError('Refund request reference already used.');
      return prior.id;
    }
    const existing = await tx.refund.findMany({
      where: { paymentId: payment.id, state: { in: ['REQUESTED', 'COMPLETED'] } },
    });
    if (
      existing.reduce((sum, r) => sum + cents(r.amount.toFixed(2)), 0n) + cents(input.amount) >
      cents(payment.received.toFixed(2))
    )
      throw new CheckoutError('Refund requests exceed verified money received.');
    const refund = await tx.refund.create({
      data: {
        paymentId: payment.id,
        key: input.key,
        amount: input.amount,
        reason: input.reason,
        requestedBy: actorId,
      },
    });
    await audit(
      tx,
      actorId,
      payment.id,
      'REQUEST_REFUND',
      `${input.amount}: ${input.reason}`.slice(0, 500),
    );
    return refund.id;
  });
}
export async function resolveRefund(
  db: PrismaClient,
  actorId: string,
  refundId: string,
  action: 'COMPLETE' | 'CANCEL',
  reference: string,
  reason: string,
) {
  z.uuid().parse(refundId);
  reasonSchema.parse(reason);
  if (action === 'COMPLETE') reference = referenceSchema.parse(reference);
  const found = await db.refund.findUnique({ where: { id: refundId } });
  if (!found) throw new CheckoutError('Refund not found.');
  return locked(db, found.paymentId, async (tx, payment, order) => {
    await assertAdmin(tx, actorId);
    const refund = await tx.refund.findUniqueOrThrow({ where: { id: refundId } });
    if (refund.state !== 'REQUESTED') {
      if (
        action === 'COMPLETE' &&
        refund.state === 'COMPLETED' &&
        refund.externalReference === reference
      )
        return;
      if (action === 'CANCEL' && refund.state === 'CANCELLED') return;
      throw new CheckoutError('This refund has already been resolved.');
    }
    if (action === 'COMPLETE') {
      const total = decimal(cents(payment.refunded.toFixed(2)) + cents(refund.amount.toFixed(2)));
      if (cents(total) > cents(payment.received.toFixed(2)))
        throw new CheckoutError('Refund exceeds verified funds.');
      await tx.refund.update({
        where: { id: refund.id },
        data: {
          state: 'COMPLETED',
          externalReference: reference,
          completedBy: actorId,
          completedAt: new Date(),
        },
      });
      const state = total === payment.received.toFixed(2) ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
      await tx.payment.update({ where: { id: payment.id }, data: { refunded: total, state } });
      await tx.order.update({ where: { id: order.id }, data: { paymentStatus: state } });
    } else await tx.refund.update({ where: { id: refund.id }, data: { state: 'CANCELLED' } });
    await audit(tx, actorId, payment.id, `${action}_REFUND`, reason);
  });
}
export async function cancelAllocation(
  db: PrismaClient,
  actorId: string,
  paymentId: string,
  reason: string,
) {
  reasonSchema.parse(reason);
  return locked(db, paymentId, async (tx, payment, order) => {
    await assertAdmin(tx, actorId);
    if (payment.received.toFixed(2) !== payment.refunded.toFixed(2))
      throw new CheckoutError(
        'Reconcile or refund received funds before cancelling the allocation.',
      );
    if (order.status === 'CANCELLED') return;
    if (!['PENDING', 'EXPIRED'].includes(order.status))
      throw new CheckoutError('Fulfilled orders cannot be cancelled here.');
    await release(tx, order.id);
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'CANCELLED',
        ...(cents(payment.received.toFixed(2)) === 0n ? { paymentStatus: 'FAILED' } : {}),
      },
    });
    if (cents(payment.received.toFixed(2)) === 0n)
      await tx.payment.update({ where: { id: payment.id }, data: { state: 'FAILED' } });
    await audit(tx, actorId, payment.id, 'CANCEL_ALLOCATION', reason);
  });
}
