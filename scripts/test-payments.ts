import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { loadLocalEnvironment, assertLocalTarget, toolingDatabase } from './database-tools';
import { cleanupTestOrders } from './payment-test-fixtures';
import { assertPaymentRole } from '../src/server/db/payment-permissions';
import {
  changeBasket,
  readBasket,
  placeOrder,
  expireReservations,
  withOwner,
  addressHash,
} from '../src/server/checkout/repository';
import { POLICY_VERSION } from '../src/features/checkout/rules';
import type { PaymentMethod } from '../src/features/payments/methods';
import type { VerifiedNotification } from '../src/server/payments/payfast';
import {
  applyNotification,
  recordVerifiedReceipt,
  requestRefund,
  resolveRefund,
  cancelAllocation,
} from '../src/server/payments/repository';
loadLocalEnvironment();
const urls = [
  process.env.TEST_DATABASE_URL!,
  process.env.TEST_COMMERCE_DATABASE_URL!,
  process.env.TEST_PAYMENT_DATABASE_URL!,
];
for (const url of urls) {
  assertLocalTarget(url, 'test');
  assert.equal(new URL(url).pathname, '/sd_catalog_test');
}
const [db, commerce, processor] = urls.map(toolingDatabase) as [
  ReturnType<typeof toolingDatabase>,
  ReturnType<typeof toolingDatabase>,
  ReturnType<typeof toolingDatabase>,
];
const customers: string[] = [],
  actor = randomUUID();
let variantId = '',
  originalStock = 0,
  passed = 0,
  stage = 'setup';
const reason = 'Verified isolated test fixture only';
async function check(name: string, work: () => Promise<void>) {
  stage = name;
  await work();
  passed++;
  console.log(`PASS ${name}`);
}
async function order(method: PaymentMethod = 'PAYFAST_CARD') {
  const customerId = randomUUID();
  customers.push(customerId);
  await changeBasket(commerce, { customerId }, variantId, 1, 'add', true);
  const basket = await readBasket(commerce, { customerId }, true);
  const id = await placeOrder(
    commerce,
    customerId,
    'payment-test@example.test',
    {
      key: randomUUID(),
      quote: basket.quote,
      name: 'Payment Test',
      phone: '0835043385',
      method: 'COLLECTION',
      paymentMethod: method,
      accepted: true,
      policyVersion: POLICY_VERSION,
    },
    true,
  );
  const payment = await db.payment.findUniqueOrThrow({ where: { orderId: id } });
  return { ...payment, customerId };
}
let serial = 1000;
function notice(
  paymentId: string,
  amount = '5.50',
  status: VerifiedNotification['status'] = 'COMPLETE',
  providerId = String(++serial),
): VerifiedNotification {
  const base = { paymentId, providerId, status, amount };
  return { ...base, eventKey: createHash('sha256').update(JSON.stringify(base)).digest('hex') };
}
const state = (id: string) =>
  db.payment.findUniqueOrThrow({ where: { id }, include: { order: true } });
const held = (orderId: string) =>
  db.inventoryReservation.count({ where: { orderId, state: 'HELD' } });
try {
  const variant = await db.productVariant.findFirstOrThrow({
    where: { product: { slug: 'sample-apples' }, label: '500 g pack' },
    include: { inventory: true },
  });
  variantId = variant.id;
  originalStock = variant.inventory!.onHand;
  assert.equal(variant.price.toFixed(2), '5.50');
  await db.inventoryBalance.update({ where: { variantId }, data: { onHand: 200 } });
  await db.administratorGrant.create({ data: { customerId: actor, reason } });
  await check(
    'restricted payment role cannot alter stock, snapshots, grants or audit history',
    async () => {
      await assertPaymentRole(processor);
      await assert.rejects(assertPaymentRole(db));
      await assert.rejects(assertPaymentRole(commerce));
      await assert.rejects(
        processor.inventoryBalance.update({ where: { variantId }, data: { onHand: 999 } }),
      );
      await assert.rejects(processor.order.updateMany({ data: { snapshot: { forged: true } } }));
      await assert.rejects(processor.paymentAudit.deleteMany());
      await assert.rejects(processor.administratorGrant.deleteMany());
    },
  );
  await check('payment reads are owner isolated and commerce cannot mark paid', async () => {
    const p = await order();
    assert.equal(await commerce.payment.count(), 0);
    await withOwner(commerce, { customerId: p.customerId }, async (tx) => {
      assert.equal(await tx.payment.count({ where: { id: p.id } }), 1);
      await assert.rejects(tx.payment.update({ where: { id: p.id }, data: { state: 'PAID' } }));
    });
    await withOwner(commerce, { customerId: randomUUID() }, async (tx) => {
      assert.equal(await tx.payment.count({ where: { id: p.id } }), 0);
    });
  });
  await check(
    'concurrent notification replay credits once and failure cannot undo paid',
    async () => {
      const p = await order(),
        n = notice(p.id);
      await Promise.all([applyNotification(processor, n), applyNotification(processor, n)]);
      assert.equal((await state(p.id)).received.toFixed(2), '5.50');
      assert.equal(await db.paymentReceipt.count({ where: { paymentId: p.id } }), 1);
      assert.equal(
        await applyNotification(processor, notice(p.id, '5.50', 'FAILED')),
        'IGNORED_AFTER_RECEIPT',
      );
      assert.equal((await state(p.id)).order.paymentStatus, 'PAID');
      assert.equal(await held(p.orderId), 1);
    },
  );
  await check(
    'failure releases once and late success records funds without reviving cancelled order',
    async () => {
      const p = await order(),
        n = notice(p.id, '5.50', 'FAILED');
      await applyNotification(processor, n);
      await applyNotification(processor, n);
      assert.equal(await held(p.orderId), 0);
      await applyNotification(processor, notice(p.id));
      const result = await state(p.id);
      assert.equal(result.order.status, 'CANCELLED');
      assert.equal(result.order.paymentStatus, 'PAID');
      assert.equal(result.exception, 'LATE_PAYMENT_OR_ORDER_CLOSED');
    },
  );
  await check(
    'expiry and late notification race releases stock and preserves verified funds',
    async () => {
      const p = await order();
      await db.order.update({ where: { id: p.orderId }, data: { expiresAt: new Date(0) } });
      await Promise.all([expireReservations(commerce), applyNotification(processor, notice(p.id))]);
      const result = await state(p.id);
      assert.equal(result.received.toFixed(2), '5.50');
      assert.equal(result.order.status, 'EXPIRED');
      assert.equal(result.exception, 'LATE_PAYMENT_OR_ORDER_CLOSED');
      assert.equal(await held(p.orderId), 0);
      await expireReservations(commerce);
      assert.equal((await state(p.id)).state, 'PAID');
    },
  );
  await check('amount mismatch and extra provider payments retain money for review', async () => {
    const p = await order();
    await applyNotification(processor, notice(p.id, '4.50'));
    assert.equal((await state(p.id)).state, 'REVIEW');
    assert.notEqual((await state(p.id)).order.paymentStatus, 'PAID');
    await applyNotification(processor, notice(p.id, '5.50'));
    const result = await state(p.id);
    assert.equal(result.received.toFixed(2), '10.00');
    assert.equal(result.state, 'REVIEW');
    assert.equal(await held(p.orderId), 1);
  });
  await check('provider reference cannot be credited to two orders', async () => {
    const a = await order(),
      b = await order(),
      ref = String(++serial);
    const outcomes = await Promise.all([
      applyNotification(processor, notice(a.id, '5.50', 'COMPLETE', ref)),
      applyNotification(processor, notice(b.id, '5.50', 'COMPLETE', ref)),
    ]);
    assert.deepEqual(outcomes.sort(), ['PAID', 'REFERENCE_CONFLICT']);
    assert.equal(await db.paymentReceipt.count({ where: { reference: `PAYFAST:${ref}` } }), 1);
  });
  await check('collection remains unpaid with allocation; manual EFT expires', async () => {
    const offline = await order('COLLECTION'),
      eft = await order('MANUAL_EFT');
    await db.order.updateMany({
      where: { id: { in: [offline.orderId, eft.orderId] } },
      data: { expiresAt: new Date(0) },
    });
    await expireReservations(commerce);
    assert.equal((await state(offline.id)).state, 'UNPAID');
    assert.equal(await held(offline.orderId), 1);
    assert.equal((await state(eft.id)).state, 'EXPIRED');
    assert.equal(await held(eft.orderId), 0);
    await assert.rejects(applyNotification(processor, notice(offline.id)));
    await cancelAllocation(processor, actor, offline.id, reason);
    await cancelAllocation(processor, actor, offline.id, reason);
    assert.equal(await held(offline.orderId), 0);
  });
  await check(
    'COD requires approved delivery and remains unpaid until verified receipt',
    async () => {
      const customerId = randomUUID();
      customers.push(customerId);
      await db.customerProfile.create({ data: { id: customerId } });
      const address = await db.address.create({
        data: {
          customerId,
          label: 'Test',
          recipient: 'Payment Test',
          phone: '0835043385',
          street: '1 Test Street',
          suburb: 'Lenasia',
          city: 'Johannesburg',
          postalCode: '1827',
          instructions: '',
        },
      });
      await db.checkoutSettings.update({ where: { id: 'store' }, data: { deliveryEnabled: true } });
      await db.deliveryApproval.create({
        data: {
          addressId: address.id,
          customerId,
          addressHash: addressHash(address),
          zoneVersion: 1,
          expiresAt: new Date(Date.now() + 3600000),
          reason,
        },
      });
      await changeBasket(commerce, { customerId }, variantId, 1, 'add', true);
      const basket = await readBasket(commerce, { customerId }, true);
      const input = {
        key: randomUUID(),
        quote: basket.quote,
        name: 'Payment Test',
        phone: '0835043385',
        accepted: true as const,
        policyVersion: POLICY_VERSION,
        paymentMethod: 'COD' as const,
      } as const;
      await assert.rejects(
        placeOrder(
          commerce,
          customerId,
          'payment-test@example.test',
          { ...input, method: 'COLLECTION' },
          true,
        ),
      );
      const orderId = await placeOrder(
        commerce,
        customerId,
        'payment-test@example.test',
        { ...input, method: 'DELIVERY', addressId: address.id },
        true,
      );
      const p = await db.payment.findUniqueOrThrow({ where: { orderId } });
      await db.order.update({ where: { id: orderId }, data: { expiresAt: new Date(0) } });
      await expireReservations(commerce);
      assert.equal((await state(p.id)).state, 'UNPAID');
      assert.equal(await held(orderId), 1);
      await recordVerifiedReceipt(processor, actor, {
        paymentId: p.id,
        key: randomUUID(),
        amount: '5.50',
        reference: `cod-${randomUUID()}`,
        reason,
        verified: true,
      });
      assert.equal((await state(p.id)).state, 'PAID');
      assert.equal((await state(p.id)).exception, null);
      await db.checkoutSettings.update({
        where: { id: 'store' },
        data: { deliveryEnabled: false },
      });
    },
  );
  await check(
    'verified offline receipt requires admin, exact amount and idempotent reference',
    async () => {
      const p = await order('COLLECTION'),
        input = {
          paymentId: p.id,
          key: randomUUID(),
          amount: '5.50',
          reference: `cash-${randomUUID()}`,
          reason,
          verified: true as const,
        };
      await assert.rejects(recordVerifiedReceipt(processor, randomUUID(), input));
      await assert.rejects(recordVerifiedReceipt(processor, actor, { ...input, amount: '4.50' }));
      await recordVerifiedReceipt(processor, actor, input);
      await recordVerifiedReceipt(processor, actor, input);
      assert.equal((await state(p.id)).state, 'PAID');
      assert.equal(await db.paymentReceipt.count({ where: { paymentId: p.id } }), 1);
      assert.equal(await db.paymentAudit.count({ where: { paymentId: p.id } }), 1);
      await assert.rejects(cancelAllocation(processor, actor, p.id, reason));
    },
  );
  await check(
    'refund request is not completion; partial/full refunds and replays conserve totals',
    async () => {
      const p = await order();
      await applyNotification(processor, notice(p.id));
      const input = { paymentId: p.id, key: randomUUID(), amount: '2.00', reason };
      const r = await requestRefund(processor, actor, input);
      assert.equal(await requestRefund(processor, actor, input), r);
      assert.equal((await state(p.id)).refunded.toFixed(2), '0.00');
      assert.equal((await state(p.id)).state, 'PAID');
      const ref = `refund-${randomUUID()}`;
      await resolveRefund(processor, actor, r, 'COMPLETE', ref, reason);
      await resolveRefund(processor, actor, r, 'COMPLETE', ref, reason);
      assert.equal((await state(p.id)).state, 'PARTIALLY_REFUNDED');
      const requests = await Promise.allSettled(
        [1, 2].map(() =>
          requestRefund(processor, actor, {
            paymentId: p.id,
            key: randomUUID(),
            amount: '3.50',
            reason,
          }),
        ),
      );
      assert.equal(requests.filter((r) => r.status === 'fulfilled').length, 1);
      const remaining = requests.find(
        (r) => r.status === 'fulfilled',
      )! as PromiseFulfilledResult<string>;
      await resolveRefund(
        processor,
        actor,
        remaining.value,
        'COMPLETE',
        `refund-${randomUUID()}`,
        reason,
      );
      assert.equal((await state(p.id)).refunded.toFixed(2), '5.50');
      assert.equal((await state(p.id)).order.paymentStatus, 'REFUNDED');
      await cancelAllocation(processor, actor, p.id, reason);
      assert.equal(await held(p.orderId), 0);
    },
  );
  await check(
    'cancelled refund frees budget and external refund references are unique',
    async () => {
      const a = await order(),
        b = await order();
      await applyNotification(processor, notice(a.id));
      await applyNotification(processor, notice(b.id));
      const cancelled = await requestRefund(processor, actor, {
        paymentId: a.id,
        key: randomUUID(),
        amount: '5.50',
        reason,
      });
      await resolveRefund(processor, actor, cancelled, 'CANCEL', '', reason);
      const ra = await requestRefund(processor, actor, {
          paymentId: a.id,
          key: randomUUID(),
          amount: '5.50',
          reason,
        }),
        rb = await requestRefund(processor, actor, {
          paymentId: b.id,
          key: randomUUID(),
          amount: '5.50',
          reason,
        }),
        ref = `refund-${randomUUID()}`;
      await resolveRefund(processor, actor, ra, 'COMPLETE', ref, reason);
      await assert.rejects(resolveRefund(processor, actor, rb, 'COMPLETE', ref, reason));
      assert.equal((await state(b.id)).refunded.toFixed(2), '0.00');
    },
  );
  console.log(`${passed} payment integration checks passed.`);
} catch (error) {
  console.error(`FAILED ${stage}`);
  throw error;
} finally {
  await cleanupTestOrders(db, customers);
  await db.checkoutSettings.update({ where: { id: 'store' }, data: { deliveryEnabled: false } });
  await db.deliveryApproval.deleteMany({ where: { customerId: { in: customers } } });
  await db.customerProfile.deleteMany({ where: { id: { in: customers } } });
  await db.cart.deleteMany({ where: { customerId: { in: customers } } });
  await db.administratorGrant.deleteMany({ where: { customerId: actor } });
  if (variantId)
    await db.inventoryBalance.update({ where: { variantId }, data: { onHand: originalStock } });
  await Promise.all([db.$disconnect(), commerce.$disconnect(), processor.$disconnect()]);
}
