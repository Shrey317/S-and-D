import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadLocalEnvironment, assertLocalTarget, toolingDatabase } from './database-tools';
import { cleanupTestOrders } from './payment-test-fixtures';
import { assertAdminRole } from '../src/server/db/admin-permissions';
import {
  saveCategory,
  saveProduct,
  saveVariant,
  adjustStock,
  completeOrder,
  cancelLegacyOrder,
  savePromotion,
  saveSettings,
  addOrderNote,
  approveAddress,
} from '../src/server/admin/repository';
import { overview } from '../src/server/admin/overview';
import {
  changeBasket,
  readBasket,
  placeOrder,
  expireReservations,
} from '../src/server/checkout/repository';
import {
  recordVerifiedReceipt,
  requestRefund,
  resolveRefund,
} from '../src/server/payments/repository';
import { POLICY_VERSION } from '../src/features/checkout/rules';
loadLocalEnvironment();
const urls = [
  process.env.TEST_DATABASE_URL!,
  process.env.TEST_ADMIN_DATABASE_URL!,
  process.env.TEST_COMMERCE_DATABASE_URL!,
  process.env.TEST_PAYMENT_DATABASE_URL!,
  process.env.TEST_READER_URL!,
];
for (const url of urls) {
  assertLocalTarget(url, 'test');
  assert.equal(new URL(url).pathname, '/sd_catalog_test');
}
const [db, admin, commerce, payments, reader] = urls.map(toolingDatabase) as [
  ReturnType<typeof toolingDatabase>,
  ReturnType<typeof toolingDatabase>,
  ReturnType<typeof toolingDatabase>,
  ReturnType<typeof toolingDatabase>,
  ReturnType<typeof toolingDatabase>,
];
const actor = randomUUID(),
  customers: string[] = [],
  promotions: string[] = [],
  reason = 'Isolated administrator integration test',
  tag = randomUUID().slice(0, 8);
let categoryId = '',
  productId = '',
  variantId = '',
  otherVariant = '',
  stage = 'setup',
  passed = 0;
const originalSettings = await db.checkoutSettings.findUniqueOrThrow({ where: { id: 'store' } }),
  originalStore = await db.storeSettings.findUniqueOrThrow({ where: { id: 'store' } });
async function check(name: string, work: () => Promise<void>) {
  stage = name;
  await work();
  passed++;
  console.log(`PASS ${name}`);
}
const productData = () => ({
  id: productId,
  name: `Admin test ${tag}`,
  slug: `admin-test-${tag}`,
  categoryId,
  description: 'Local test produce',
  state: 'ACTIVE',
  featured: true,
  isSample: true,
  reason,
});
const variantData = () => ({
  id: variantId,
  productId,
  sku: `ADMIN-${tag}`,
  label: '1 kg box',
  unit: 'BOX',
  price: '10.00',
  active: true,
  lowStockThreshold: 5,
  reason,
});
async function stock(amount: number) {
  const b = await db.inventoryBalance.findUniqueOrThrow({ where: { variantId } });
  await adjustStock(admin, actor, {
    variantId,
    key: randomUUID(),
    version: b.version,
    onHand: amount,
    reason,
  });
}
async function basket(code = '', quantity = 1) {
  const customerId = randomUUID();
  customers.push(customerId);
  await changeBasket(commerce, { customerId }, variantId, quantity, 'add', true);
  const b = await readBasket(commerce, { customerId }, true, code);
  return {
    customerId,
    input: {
      key: randomUUID(),
      quote: b.quote,
      name: 'Admin Test Customer',
      phone: '0835043385',
      method: 'COLLECTION' as const,
      paymentMethod: 'COLLECTION' as const,
      promotionCode: code,
      accepted: true as const,
      policyVersion: POLICY_VERSION,
    } as const,
    b,
  };
}
async function order(code = '') {
  const data = await basket(code);
  const id = await placeOrder(
    commerce,
    data.customerId,
    'admin-test@example.test',
    data.input,
    true,
  );
  return db.order.findUniqueOrThrow({ where: { id }, include: { payment: true } });
}
async function paid(id: string, amount: string) {
  await recordVerifiedReceipt(payments, actor, {
    paymentId: id,
    key: randomUUID(),
    amount,
    reference: `cash-${randomUUID()}`,
    reason,
    verified: true,
  });
}
async function promo(extra: Record<string, unknown> = {}) {
  const id = await savePromotion(admin, actor, {
    version: 0,
    name: `Test offer ${tag}`,
    code: `OFFER-${randomUUID().slice(0, 8)}`,
    kind: 'FIXED',
    value: '2.00',
    quantityA: 1,
    quantityB: 1,
    startsAt: new Date(Date.now() - 86400000).toISOString(),
    endsAt: new Date(Date.now() + 86400000).toISOString(),
    active: true,
    maxUses: 100,
    perCustomer: 1,
    reason,
    ...extra,
  });
  promotions.push(id);
  return db.promotion.findUniqueOrThrow({ where: { id } });
}
try {
  await db.administratorGrant.create({ data: { customerId: actor, reason } });
  await check(
    'restricted admin role rejects escalation, ledger writes and history deletion',
    async () => {
      await assertAdminRole(admin);
      await assert.rejects(assertAdminRole(db));
      await assert.rejects(assertAdminRole(commerce));
      await assert.rejects(admin.administratorGrant.deleteMany());
      await assert.rejects(admin.adminAudit.deleteMany());
      await assert.rejects(admin.inventoryAdjustment.deleteMany());
      await assert.rejects(admin.payment.updateMany({ data: { state: 'PAID' } }));
      await assert.rejects(admin.order.updateMany({ data: { snapshot: {} } }));
    },
  );
  await check('catalog mutations require a grant and publish real variant identities', async () => {
    const input = {
      name: `Test category ${tag}`,
      slug: `test-${tag}`,
      description: 'Integration fixtures',
      position: 100,
      active: true,
      reason,
    };
    await assert.rejects(saveCategory(admin, randomUUID(), input));
    categoryId = await saveCategory(admin, actor, input);
    productId = await saveProduct(admin, actor, { ...productData(), id: undefined });
    variantId = await saveVariant(admin, actor, { ...variantData(), id: undefined });
    otherVariant = await saveVariant(admin, actor, {
      ...variantData(),
      id: undefined,
      sku: `ADMIN-B-${tag}`,
      label: 'Second pack',
      price: '20.00',
    });
    await stock(100);
    const second = await db.inventoryBalance.findUniqueOrThrow({
      where: { variantId: otherVariant },
    });
    await adjustStock(admin, actor, {
      variantId: otherVariant,
      key: randomUUID(),
      version: second.version,
      onHand: 100,
      reason,
    });
    assert.equal(
      (await reader.product.findUniqueOrThrow({ where: { id: productId } })).name,
      productData().name,
    );
  });
  await check(
    'stock corrections are versioned, idempotent and cannot consume reservations',
    async () => {
      const b = await db.inventoryBalance.findUniqueOrThrow({ where: { variantId } }),
        input = { variantId, key: randomUUID(), version: b.version, onHand: 99, reason };
      await adjustStock(admin, actor, input);
      await adjustStock(admin, actor, input);
      assert.equal(await db.inventoryAdjustment.count({ where: { key: input.key } }), 1);
      const fresh = await db.inventoryBalance.findUniqueOrThrow({ where: { variantId } });
      const race = await Promise.allSettled(
        [98, 97].map((onHand) =>
          adjustStock(admin, actor, {
            variantId,
            key: randomUUID(),
            version: fresh.version,
            onHand,
            reason,
          }),
        ),
      );
      assert.equal(race.filter((r) => r.status === 'fulfilled').length, 1);
      const o = await order();
      await assert.rejects(stock(0));
      assert.equal(
        await db.inventoryReservation.count({ where: { orderId: o.id, state: 'HELD' } }),
        1,
      );
    },
  );
  await check(
    'fulfilment requires payment and consumes stock once under concurrent completion',
    async () => {
      const o = await order();
      await assert.rejects(completeOrder(admin, actor, o.id, reason));
      await paid(o.payment!.id, o.total.toFixed(2));
      const before = await db.inventoryBalance.findUniqueOrThrow({ where: { variantId } });
      await Promise.all([
        completeOrder(admin, actor, o.id, reason),
        completeOrder(admin, actor, o.id, reason),
      ]);
      const after = await db.inventoryBalance.findUniqueOrThrow({ where: { variantId } });
      assert.equal(after.onHand, before.onHand - 1);
      assert.equal(after.reserved, before.reserved - 1);
      assert.equal((await db.order.findUniqueOrThrow({ where: { id: o.id } })).status, 'COLLECTED');
      assert.equal(await db.inventoryAdjustment.count({ where: { orderId: o.id } }), 1);
      await addOrderNote(admin, actor, o.id, 'Internal test note');
      assert.equal(await db.orderNote.count({ where: { orderId: o.id } }), 1);
    },
  );
  await check(
    'legacy test cancellation releases allocations once and rejects ledger orders',
    async () => {
      const b = await basket(),
        id = await placeOrder(
          commerce,
          b.customerId,
          'test@example.test',
          { ...b.input, paymentMethod: 'TEST' },
          true,
        );
      const before = await db.inventoryBalance.findUniqueOrThrow({ where: { variantId } });
      await Promise.all([
        cancelLegacyOrder(admin, actor, id, reason),
        cancelLegacyOrder(admin, actor, id, reason),
      ]);
      const after = await db.inventoryBalance.findUniqueOrThrow({ where: { variantId } });
      assert.equal(after.reserved, before.reserved - 1);
      assert.equal(after.onHand, before.onHand);
      assert.equal((await db.order.findUniqueOrThrow({ where: { id } })).status, 'CANCELLED');
      const ledgerOrder = await order();
      await assert.rejects(cancelLegacyOrder(admin, actor, ledgerOrder.id, reason));
    },
  );
  await check(
    'product archive and category deactivation preserve historical snapshots',
    async () => {
      const o = await order(),
        snapshot = JSON.stringify(o.snapshot);
      await saveProduct(admin, actor, { ...productData(), state: 'ARCHIVED' });
      assert.equal(await reader.product.findUnique({ where: { id: productId } }), null);
      assert.equal(
        JSON.stringify((await db.order.findUniqueOrThrow({ where: { id: o.id } })).snapshot),
        snapshot,
      );
      await saveProduct(admin, actor, productData());
      await saveCategory(admin, actor, {
        id: categoryId,
        name: `Test category ${tag}`,
        slug: `test-${tag}`,
        description: 'Integration fixtures',
        position: 100,
        active: false,
        reason,
      });
      assert.equal(await reader.product.findUnique({ where: { id: productId } }), null);
      await db.category.update({ where: { id: categoryId }, data: { active: true } });
    },
  );
  await check(
    'percentage specials and two-variant bundles calculate authoritative discounts',
    async () => {
      const percent = await promo({ kind: 'PERCENT', value: '10.00', productId });
      const a = await basket(percent.code!);
      assert.equal(a.b.discount, '1.00');
      assert.equal(a.b.total, '9.00');
      const bundle = await promo({
        kind: 'BUNDLE',
        value: '4.00',
        variantA: variantId,
        variantB: otherVariant,
        quantityA: 2,
        quantityB: 1,
      });
      const b = await basket(bundle.code!, 2);
      assert.equal(b.b.discount, '0.00');
      await changeBasket(commerce, { customerId: b.customerId }, otherVariant, 1, 'add', true);
      const quote = await readBasket(commerce, { customerId: b.customerId }, true, bundle.code!);
      assert.equal(quote.discount, '4.00');
      assert.equal(quote.total, '36.00');
    },
  );
  await check(
    'last promotion redemption cannot be oversubscribed and order snapshots retain discount',
    async () => {
      const p = await promo({ maxUses: 1 }),
        a = await basket(p.code!),
        b = await basket(p.code!);
      const result = await Promise.allSettled(
        [a, b].map((i) => placeOrder(commerce, i.customerId, 'test@example.test', i.input, true)),
      );
      assert.equal(result.filter((r) => r.status === 'fulfilled').length, 1);
      const redemption = await db.promotionRedemption.findFirstOrThrow({
        where: { promotionId: p.id },
      });
      assert.equal(redemption.discount.toFixed(2), '2.00');
      assert.equal(
        (await db.order.findUniqueOrThrow({ where: { id: redemption.orderId } })).total.toFixed(2),
        '8.00',
      );
    },
  );
  await check(
    'promotion edits invalidate quotes and expiry releases redemption capacity',
    async () => {
      const p = await promo({ maxUses: 1 }),
        a = await basket(p.code!);
      await db.promotion.update({
        where: { id: p.id },
        data: { value: '3.00', version: { increment: 1 } },
      });
      await assert.rejects(
        placeOrder(commerce, a.customerId, 'test@example.test', a.input, true),
        /changed/,
      );
      const b = await readBasket(commerce, { customerId: a.customerId }, true, p.code!);
      const id = await placeOrder(
        commerce,
        a.customerId,
        'test@example.test',
        { ...a.input, quote: b.quote, paymentMethod: 'TEST' },
        true,
      );
      await db.order.update({ where: { id }, data: { expiresAt: new Date(0) } });
      await expireReservations(commerce);
      assert.equal((await basket(p.code!)).b.discount, '3.00');
    },
  );
  await check(
    'settings are versioned and capacity prevents two orders claiming the last planned date',
    async () => {
      const s = await db.storeSettings.findUniqueOrThrow({ where: { id: 'store' } }),
        c = await db.checkoutSettings.findUniqueOrThrow({ where: { id: 'store' } });
      const input = {
        ...s,
        ...c,
        storeVersion: s.version,
        closedDates: '',
        dailyCapacity: 1,
        reason,
      };
      await saveSettings(admin, actor, input);
      await assert.rejects(saveSettings(admin, actor, input), /changed/);
      const a = await basket(),
        b = await basket();
      assert.equal(a.b.planningDate, b.b.planningDate);
      const result = await Promise.allSettled(
        [a, b].map((i) => placeOrder(commerce, i.customerId, 'test@example.test', i.input, true)),
      );
      assert.equal(result.filter((r) => r.status === 'fulfilled').length, 1);
      await db.checkoutSettings.update({ where: { id: 'store' }, data: { dailyCapacity: 0 } });
    },
  );
  await check(
    'address approvals bind the exact saved address and current rule version',
    async () => {
      const customerId = randomUUID();
      customers.push(customerId);
      await db.customerProfile.create({ data: { id: customerId } });
      const address = await db.address.create({
        data: {
          customerId,
          label: 'Test',
          recipient: 'Test Customer',
          phone: '0835043385',
          street: '1 Test Street',
          suburb: 'Lenasia',
          city: 'Johannesburg',
          postalCode: '1827',
        },
      });
      await approveAddress(
        admin,
        actor,
        address.id,
        new Date(Date.now() + 86400000).toISOString(),
        reason,
        true,
      );
      assert.equal(
        (await db.deliveryApproval.findUniqueOrThrow({ where: { addressId: address.id } }))
          .zoneVersion,
        (await db.checkoutSettings.findUniqueOrThrow({ where: { id: 'store' } })).version,
      );
      await approveAddress(admin, actor, address.id, '', reason, false);
      assert.equal(
        await db.deliveryApproval.findUnique({ where: { addressId: address.id } }),
        null,
      );
    },
  );
  await check(
    'dashboard excludes test orders and subtracts completed partial refunds',
    async () => {
      assert.equal(Number((await overview(admin)).money?.monthly), 0);
      const o = await order();
      await paid(o.payment!.id, o.total.toFixed(2));
      await completeOrder(admin, actor, o.id, reason);
      await db.order.update({
        where: { id: o.id },
        data: { snapshot: { ...(o.snapshot as object), isTest: false } },
      });
      assert.equal(Number((await overview(admin)).money?.daily), 10);
      const r = await requestRefund(payments, actor, {
        paymentId: o.payment!.id,
        key: randomUUID(),
        amount: '2.00',
        reason,
      });
      await resolveRefund(payments, actor, r, 'COMPLETE', `refund-${randomUUID()}`, reason);
      assert.equal(Number((await overview(admin)).money?.daily), 8);
      const remaining = await requestRefund(payments, actor, {
        paymentId: o.payment!.id,
        key: randomUUID(),
        amount: '8.00',
        reason,
      });
      await resolveRefund(payments, actor, remaining, 'COMPLETE', `refund-${randomUUID()}`, reason);
      assert.equal(Number((await overview(admin)).money?.daily), 0);
    },
  );
  console.log(`${passed} administration integration checks passed.`);
} catch (error) {
  console.error(`FAILED ${stage}`);
  throw error;
} finally {
  await cleanupTestOrders(db, customers);
  await db.cart.deleteMany({ where: { customerId: { in: customers } } });
  await db.deliveryApproval.deleteMany({ where: { customerId: { in: customers } } });
  await db.customerProfile.deleteMany({ where: { id: { in: customers } } });
  await db.promotion.deleteMany({ where: { id: { in: promotions } } });
  await db.inventoryAdjustment.deleteMany({ where: { actorId: actor } });
  await db.adminAudit.deleteMany({ where: { actorId: actor } });
  if (productId) {
    await db.inventoryBalance.deleteMany({ where: { variant: { productId } } });
    await db.productVariant.deleteMany({ where: { productId } });
    await db.product.delete({ where: { id: productId } });
  }
  if (categoryId) await db.category.delete({ where: { id: categoryId } });
  await db.administratorGrant.deleteMany({ where: { customerId: actor } });
  await db.checkoutSettings.update({ where: { id: 'store' }, data: originalSettings });
  await db.storeSettings.update({ where: { id: 'store' }, data: originalStore });
  await Promise.all([db, admin, commerce, payments, reader].map((d) => d.$disconnect()));
}
