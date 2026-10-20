import assert from 'node:assert/strict';
import { cleanupTestOrders } from './payment-test-fixtures';
import { randomUUID } from 'node:crypto';
import { assertLocalTarget, loadLocalEnvironment, toolingDatabase } from './database-tools';
import { assertCommerceRole } from '../src/server/db/commerce-permissions';
import { assertAccountRole } from '../src/server/db/account-permissions';
import { assertStorefrontRole } from '../src/server/db/permissions';
import {
  readBasket,
  changeBasket,
  placeOrder,
  readOrders,
  reorder,
  expireReservations,
  hash,
  addressHash,
  withOwner,
  type Snapshot,
} from '../src/server/checkout/repository';
import { POLICY_VERSION, type CheckoutInput } from '../src/features/checkout/rules';
loadLocalEnvironment();
const url = process.env.TEST_DATABASE_URL!,
  writerUrl = process.env.TEST_COMMERCE_DATABASE_URL!;
for (const value of [url, writerUrl]) {
  assertLocalTarget(value, 'test');
  assert.equal(new URL(value).pathname, '/sd_catalog_test');
}
const db = toolingDatabase(url),
  writer = toolingDatabase(writerUrl);
const customers = Array.from({ length: 10 }, () => randomUUID());
const guests = [hash(randomUUID()), hash(randomUUID())];
let passed = 0,
  stage = 'setup';
async function check(name: string, work: () => Promise<void>) {
  stage = name;
  await work();
  passed++;
  console.log(`PASS ${name}`);
}
let variantId = '',
  originalPrice = '';
let originalStock = 0;
async function input(
  customerId: string,
  extra: Partial<CheckoutInput> = {},
): Promise<CheckoutInput> {
  const basket = await readBasket(writer, { customerId }, true);
  return {
    key: randomUUID(),
    quote: basket.quote,
    name: 'Local Test Customer',
    phone: '0835043385',
    method: 'COLLECTION',
    accepted: true,
    policyVersion: POLICY_VERSION,
    ...extra,
  };
}
try {
  const variant = await db.productVariant.findFirstOrThrow({
    where: { product: { slug: 'sample-apples' }, label: '500 g pack' },
    include: { inventory: true },
  });
  variantId = variant.id;
  originalPrice = variant.price.toFixed(2);
  originalStock = variant.inventory!.onHand;
  await check(
    'commerce capability guard rejects owner and prevents account/catalog role reuse',
    async () => {
      await assertCommerceRole(writer);
      await assert.rejects(assertCommerceRole(db));
      await assert.rejects(assertAccountRole(writer));
      await assert.rejects(assertStorefrontRole(writer));
      await assert.rejects(
        writer.checkoutSettings.update({ where: { id: 'store' }, data: { deliveryEnabled: true } }),
      );
      await assert.rejects(writer.order.updateMany({ data: { paymentStatus: 'PAID' } }));
      await assert.rejects(
        writer.productVariant.update({ where: { id: variantId }, data: { price: '0.01' } }),
      );
    },
  );
  await check(
    'opaque guest cart persists; concurrent account merge happens exactly once',
    async () => {
      await changeBasket(writer, { guestHash: guests[0]! }, variantId, 2, 'add', true);
      assert.equal(
        (await readBasket(writer, { guestHash: guests[0]! }, true)).lines[0]?.quantity,
        2,
      );
      await changeBasket(writer, { customerId: customers[0]! }, variantId, 1, 'add', true);
      await Promise.all([
        readBasket(writer, { customerId: customers[0]!, guestHash: guests[0]! }, true),
        readBasket(writer, { customerId: customers[0]!, guestHash: guests[0]! }, true),
      ]);
      assert.equal(
        (await readBasket(writer, { customerId: customers[0]! }, true)).lines[0]?.quantity,
        3,
      );
      assert.equal((await readBasket(writer, { guestHash: guests[0]! }, true)).lines.length, 0);
    },
  );
  await check(
    'database ownership hides another cart and rejects cross-customer inserts',
    async () => {
      assert.equal((await writer.cart.findMany()).length, 0);
      const cart = await db.cart.findUniqueOrThrow({ where: { customerId: customers[0]! } });
      await withOwner(writer, { customerId: customers[1]! }, async (tx) => {
        assert.equal(await tx.cartLine.count({ where: { cartId: cart.id } }), 0);
      });
      await assert.rejects(
        withOwner(writer, { customerId: customers[1]! }, (tx) =>
          tx.cartLine.create({ data: { cartId: cart.id, variantId, quantity: 1 } }),
        ),
      );
    },
  );
  await check(
    'price change rejects stale quote without reserving stock or emptying basket',
    async () => {
      const request = await input(customers[0]!);
      await db.productVariant.update({ where: { id: variantId }, data: { price: '6.00' } });
      await assert.rejects(
        placeOrder(writer, customers[0]!, 'local@example.test', request, true),
        /changed/,
      );
      assert.equal(
        (await readBasket(writer, { customerId: customers[0]! }, true)).lines[0]?.quantity,
        3,
      );
      assert.equal(await db.order.count({ where: { customerId: customers[0]! } }), 0);
    },
  );
  let firstOrder = '';
  await check(
    'duplicate concurrent checkout creates one unpaid immutable order and one reservation',
    async () => {
      const request = await input(customers[0]!);
      const results = await Promise.all([
        placeOrder(writer, customers[0]!, 'local@example.test', request, true),
        placeOrder(writer, customers[0]!, 'local@example.test', request, true),
      ]);
      assert.equal(results[0], results[1]);
      firstOrder = results[0]!;
      const order = await db.order.findUniqueOrThrow({ where: { id: firstOrder } });
      assert.equal(order.total.toFixed(2), '18.00');
      assert.equal(order.paymentStatus, 'UNPAID');
      const timing = await db.$queryRaw<
        { seconds: number }[]
      >`SELECT EXTRACT(EPOCH FROM ("expiresAt"-CURRENT_TIMESTAMP))::float8 AS seconds FROM commerce."Order" WHERE id=${firstOrder}::uuid`;
      assert.ok(
        timing[0]!.seconds > 1150 && timing[0]!.seconds <= 1200,
        'Database and application must agree on the 20-minute hold.',
      );
      assert.equal(await db.inventoryReservation.count({ where: { orderId: firstOrder } }), 1);
      assert.equal((await readBasket(writer, { customerId: customers[0]! }, true)).lines.length, 0);
      await assert.rejects(
        placeOrder(
          writer,
          customers[0]!,
          'local@example.test',
          { ...request, name: 'Changed request' },
          true,
        ),
        /already used/,
      );
    },
  );
  await check('orders and confirmation data are private to the verified owner', async () => {
    assert.equal((await readOrders(writer, customers[1]!, firstOrder)).length, 0);
    assert.equal((await readOrders(writer, customers[0]!, firstOrder)).length, 1);
    assert.equal((await writer.order.findMany()).length, 0);
    await assert.rejects(reorder(writer, customers[1]!, firstOrder, true), /not found/);
  });
  await check('expiry releases unpaid stock once and never releases paid orders', async () => {
    await expireReservations(writer);
    assert.equal(
      (await db.order.findUniqueOrThrow({ where: { id: firstOrder } })).status,
      'PENDING',
    );
    await db.order.update({
      where: { id: firstOrder },
      data: { expiresAt: new Date(0), paymentStatus: 'PAID' },
    });
    await expireReservations(writer);
    assert.equal(
      (await db.inventoryReservation.findFirstOrThrow({ where: { orderId: firstOrder } })).state,
      'HELD',
    );
    await db.order.update({ where: { id: firstOrder }, data: { paymentStatus: 'UNPAID' } });
    await Promise.all([expireReservations(writer), expireReservations(writer)]);
    await expireReservations(writer);
    assert.equal(
      (await db.inventoryBalance.findUniqueOrThrow({ where: { variantId } })).reserved,
      0,
    );
    assert.equal(
      (await db.order.findUniqueOrThrow({ where: { id: firstOrder } })).status,
      'EXPIRED',
    );
  });
  await check(
    'reorder uses current prices and available quantities, preserving historical totals',
    async () => {
      await db.productVariant.update({ where: { id: variantId }, data: { price: '7.00' } });
      await db.inventoryBalance.update({ where: { variantId }, data: { onHand: 2 } });
      const messages = await reorder(writer, customers[0]!, firstOrder, true);
      assert.ok(messages.some((s) => s.includes('omitted')));
      const basket = await readBasket(writer, { customerId: customers[0]! }, true);
      assert.equal(basket.total, '14.00');
      assert.equal(basket.lines[0]?.quantity, 2);
      assert.equal(
        (await db.order.findUniqueOrThrow({ where: { id: firstOrder } })).total.toFixed(2),
        '18.00',
      );
    },
  );
  await check('concurrent last-pack checkout cannot oversell', async () => {
    await db.inventoryBalance.update({ where: { variantId }, data: { onHand: 1 } });
    await changeBasket(writer, { customerId: customers[2]! }, variantId, 1, 'add', true);
    await changeBasket(writer, { customerId: customers[3]! }, variantId, 1, 'add', true);
    const a = await input(customers[2]!),
      b = await input(customers[3]!);
    const outcomes = await Promise.allSettled([
      placeOrder(writer, customers[2]!, 'a@example.test', a, true),
      placeOrder(writer, customers[3]!, 'b@example.test', b, true),
    ]);
    assert.equal(outcomes.filter((v) => v.status === 'fulfilled').length, 1);
    assert.equal(
      (await db.inventoryBalance.findUniqueOrThrow({ where: { variantId } })).reserved,
      1,
    );
    await db.order.updateMany({
      where: { customerId: { in: customers.slice(2, 4) } },
      data: { expiresAt: new Date(0) },
    });
    await expireReservations(writer);
    await db.inventoryBalance.update({ where: { variantId }, data: { onHand: 10 } });
  });
  await check(
    'delivery requires exact current owner-address approval and enabled rules',
    async () => {
      const customerId = customers[4]!;
      await db.customerProfile.create({ data: { id: customerId } });
      const address = await db.address.create({
        data: {
          customerId,
          label: 'Test',
          recipient: 'Local Test',
          phone: '0835043385',
          street: '1 Test Street',
          suburb: 'Lenasia',
          city: 'Johannesburg',
          postalCode: '1827',
          instructions: '',
        },
      });
      await changeBasket(writer, { customerId }, variantId, 1, 'add', true);
      await assert.rejects(
        placeOrder(
          writer,
          customerId,
          'test@example.test',
          await input(customerId, { method: 'DELIVERY', addressId: address.id }),
          true,
        ),
        /Delivery/,
      );
      await db.checkoutSettings.update({ where: { id: 'store' }, data: { deliveryEnabled: true } });
      await assert.rejects(
        placeOrder(
          writer,
          customerId,
          'test@example.test',
          await input(customerId, { method: 'DELIVERY', addressId: address.id }),
          true,
        ),
        /approval/,
      );
      await db.deliveryApproval.create({
        data: {
          addressId: address.id,
          customerId,
          addressHash: addressHash(address),
          zoneVersion: 1,
          expiresAt: new Date(Date.now() + 3600000),
          reason: 'Isolated test fixture only',
        },
      });
      await db.address.update({ where: { id: address.id }, data: { street: '2 Test Street' } });
      await assert.rejects(
        placeOrder(
          writer,
          customerId,
          'test@example.test',
          await input(customerId, { method: 'DELIVERY', addressId: address.id }),
          true,
        ),
        /approval/,
      );
      await db.address.update({ where: { id: address.id }, data: { street: '1 Test Street' } });
      const id = await placeOrder(
        writer,
        customerId,
        'test@example.test',
        await input(customerId, { method: 'DELIVERY', addressId: address.id }),
        true,
      );
      const snapshot = (await db.order.findUniqueOrThrow({ where: { id } }))
        .snapshot as unknown as Snapshot;
      assert.equal(snapshot.deliveryFee, '0.00');
      assert.equal(snapshot.address?.street, '1 Test Street');
      await db.address.update({ where: { id: address.id }, data: { street: 'Changed later' } });
      assert.equal(
        ((await db.order.findUniqueOrThrow({ where: { id } })).snapshot as unknown as Snapshot)
          .address?.street,
        '1 Test Street',
      );
    },
  );
  await check('store suspension and collection disable fail closed', async () => {
    await changeBasket(writer, { customerId: customers[5]! }, variantId, 1, 'add', true);
    await db.checkoutSettings.update({ where: { id: 'store' }, data: { suspended: true } });
    await assert.rejects(
      placeOrder(writer, customers[5]!, 'test@example.test', await input(customers[5]!), true),
      /unavailable/,
    );
    await db.checkoutSettings.update({
      where: { id: 'store' },
      data: { suspended: false, collectionEnabled: false },
    });
    await assert.rejects(
      placeOrder(writer, customers[5]!, 'test@example.test', await input(customers[5]!), true),
      /unavailable/,
    );
  });
  console.log(`${passed} checkout integration checks passed.`);
} catch (error) {
  console.error(`FAILED ${stage}`);
  throw error;
} finally {
  await db.checkoutSettings.update({
    where: { id: 'store' },
    data: { deliveryEnabled: false, collectionEnabled: true, suspended: false },
  });
  await db.order.updateMany({
    where: { customerId: { in: customers } },
    data: { expiresAt: new Date(0), paymentStatus: 'UNPAID' },
  });
  await expireReservations(writer);
  await cleanupTestOrders(db, customers);
  await db.cart.deleteMany({
    where: { OR: [{ customerId: { in: customers } }, { guestHash: { in: guests } }] },
  });
  await db.deliveryApproval.deleteMany({ where: { customerId: { in: customers } } });
  await db.customerProfile.deleteMany({ where: { id: { in: customers } } });
  if (variantId) {
    await db.productVariant.update({ where: { id: variantId }, data: { price: originalPrice } });
    await db.inventoryBalance.update({ where: { variantId }, data: { onHand: originalStock } });
  }
  await Promise.all([db.$disconnect(), writer.$disconnect()]);
}
