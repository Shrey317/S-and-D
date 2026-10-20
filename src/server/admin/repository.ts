import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import {
  productSchema,
  categorySchema,
  variantSchema,
  stockSchema,
  settingsSchema,
  promotionSchema,
  reason as reasonSchema,
} from '@/features/admin/validation';
import { CheckoutError, cents } from '@/features/checkout/rules';
import { addressHash } from '@/server/checkout/repository';
type Tx = Prisma.TransactionClient;
export async function audit(
  tx: Tx,
  actorId: string,
  action: string,
  entityId: string,
  detail: string,
) {
  await tx.adminAudit.create({
    data: { actorId, action, entityId, detail: detail.slice(0, 1000) },
  });
}
export async function withAdmin<T>(
  db: PrismaClient,
  actorId: string,
  work: (tx: Tx) => Promise<T>,
) {
  z.uuid().parse(actorId);
  return db.$transaction(
    async (tx) => {
      if (!(await tx.administratorGrant.findUnique({ where: { customerId: actorId } })))
        throw new CheckoutError('Administrator access required.');
      // A small store benefits from one configuration lock: catalog edits, capacity and checkout serialize.
      await tx.$queryRaw`SELECT id FROM commerce."CheckoutSettings" WHERE id='store' FOR UPDATE`;
      return work(tx);
    },
    { timeout: 15000, maxWait: 10000 },
  );
}
export async function saveProduct(db: PrismaClient, actor: string, raw: unknown) {
  const { id, reason, ...data } = productSchema.parse(raw);
  return withAdmin(db, actor, async (tx) => {
    const row = id
      ? await tx.product.update({ where: { id }, data })
      : await tx.product.create({ data });
    await audit(tx, actor, id ? 'EDIT_PRODUCT' : 'CREATE_PRODUCT', row.id, reason);
    return row.id;
  });
}
export async function saveCategory(db: PrismaClient, actor: string, raw: unknown) {
  const { id, reason, ...data } = categorySchema.parse(raw);
  return withAdmin(db, actor, async (tx) => {
    const row = id
      ? await tx.category.update({ where: { id }, data })
      : await tx.category.create({ data });
    await audit(tx, actor, id ? 'EDIT_CATEGORY' : 'CREATE_CATEGORY', row.id, reason);
    return row.id;
  });
}
export async function saveVariant(db: PrismaClient, actor: string, raw: unknown) {
  const { id, reason, ...data } = variantSchema.parse(raw);
  return withAdmin(db, actor, async (tx) => {
    if (id) {
      const old = await tx.productVariant.findUniqueOrThrow({ where: { id } });
      if (old.productId !== data.productId)
        throw new CheckoutError('A variant cannot move between products.');
    }
    const row = id
      ? await tx.productVariant.update({ where: { id }, data })
      : await tx.productVariant.create({ data: { ...data, inventory: { create: {} } } });
    await audit(
      tx,
      actor,
      id ? 'EDIT_VARIANT' : 'CREATE_VARIANT',
      row.id,
      `${reason}; price ${data.price}, active ${data.active}`,
    );
    return row.id;
  });
}
export async function adjustStock(db: PrismaClient, actor: string, raw: unknown) {
  const input = stockSchema.parse(raw);
  return withAdmin(db, actor, async (tx) => {
    await tx.$queryRaw`SELECT "variantId" FROM commerce."InventoryBalance" WHERE "variantId"=${input.variantId}::uuid FOR UPDATE`;
    const prior = await tx.inventoryAdjustment.findUnique({ where: { key: input.key } });
    if (prior) {
      if (
        prior.variantId !== input.variantId ||
        prior.after !== input.onHand ||
        prior.reason !== input.reason
      )
        throw new CheckoutError('Adjustment reference already used.');
      return;
    }
    const balance = await tx.inventoryBalance.findUniqueOrThrow({
      where: { variantId: input.variantId },
    });
    if (balance.version !== input.version)
      throw new CheckoutError('Stock changed. Refresh before correcting it.');
    if (input.onHand < balance.reserved)
      throw new CheckoutError(
        'Stock cannot fall below allocated packs. Resolve the affected orders first.',
      );
    await tx.inventoryBalance.update({
      where: { variantId: input.variantId },
      data: { onHand: input.onHand, version: { increment: 1 } },
    });
    await tx.inventoryAdjustment.create({
      data: {
        key: input.key,
        variantId: input.variantId,
        actorId: actor,
        before: balance.onHand,
        after: input.onHand,
        reason: input.reason,
      },
    });
    await audit(
      tx,
      actor,
      'ADJUST_STOCK',
      input.variantId,
      `${balance.onHand} → ${input.onHand}; ${input.reason}`,
    );
  });
}
export async function completeOrder(
  db: PrismaClient,
  actor: string,
  orderId: string,
  reason: string,
) {
  z.uuid().parse(orderId);
  reasonSchema.parse(reason);
  return withAdmin(db, actor, async (tx) => {
    await tx.$queryRaw`SELECT id FROM commerce."Order" WHERE id=${orderId}::uuid FOR UPDATE`;
    // All payment writers acquire this same order lock before changing the ledger.
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { payment: true, reservations: { orderBy: { variantId: 'asc' } } },
    });
    if (['DELIVERED', 'COLLECTED'].includes(order.status)) return;
    if (order.status !== 'PENDING' || order.paymentException || order.payment?.exception)
      throw new CheckoutError('Only pending orders without exceptions can be completed.');
    const p = order.payment;
    if (
      !p ||
      p.refunded.toFixed(2) !== '0.00' ||
      (cents(order.total.toFixed(2)) > 0n &&
        (p.state !== 'PAID' || p.received.toFixed(2) !== order.total.toFixed(2)))
    )
      throw new CheckoutError('Verify the full payment before completing fulfilment.');
    if (!order.reservations.length || order.reservations.some((r) => r.state !== 'HELD'))
      throw new CheckoutError('This order has no complete active stock allocation.');
    for (const line of order.reservations) {
      await tx.$queryRaw`SELECT "variantId" FROM commerce."InventoryBalance" WHERE "variantId"=${line.variantId}::uuid FOR UPDATE`;
      const balance = await tx.inventoryBalance.findUniqueOrThrow({
        where: { variantId: line.variantId },
      });
      if (balance.onHand < line.quantity || balance.reserved < line.quantity)
        throw new CheckoutError('Inventory reconciliation required.');
      await tx.inventoryBalance.update({
        where: { variantId: line.variantId },
        data: {
          onHand: { decrement: line.quantity },
          reserved: { decrement: line.quantity },
          version: { increment: 1 },
        },
      });
      await tx.inventoryAdjustment.create({
        data: {
          key: randomUUID(),
          variantId: line.variantId,
          actorId: actor,
          before: balance.onHand,
          after: balance.onHand - line.quantity,
          orderId,
          reason: `Fulfilment: ${reason}`.slice(0, 500),
        },
      });
    }
    await tx.inventoryReservation.updateMany({
      where: { orderId, state: 'HELD' },
      data: { state: 'CONSUMED' },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { status: order.method === 'DELIVERY' ? 'DELIVERED' : 'COLLECTED' },
    });
    await audit(tx, actor, 'COMPLETE_ORDER', orderId, reason);
  });
}
export async function cancelLegacyOrder(
  db: PrismaClient,
  actor: string,
  orderId: string,
  reason: string,
) {
  z.uuid().parse(orderId);
  reasonSchema.parse(reason);
  return withAdmin(db, actor, async (tx) => {
    await tx.$queryRaw`SELECT id FROM commerce."Order" WHERE id=${orderId}::uuid FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { payment: true, reservations: { orderBy: { variantId: 'asc' } } },
    });
    if (order.payment || (order.snapshot as { isTest?: boolean }).isTest !== true)
      throw new CheckoutError('Use payment reconciliation to cancel this order.');
    if (order.status === 'CANCELLED') return;
    if (!['PENDING', 'EXPIRED'].includes(order.status))
      throw new CheckoutError('Completed orders cannot be cancelled.');
    for (const line of order.reservations.filter((r) => r.state === 'HELD')) {
      await tx.$queryRaw`SELECT "variantId" FROM commerce."InventoryBalance" WHERE "variantId"=${line.variantId}::uuid FOR UPDATE`;
      const balance = await tx.inventoryBalance.findUniqueOrThrow({
        where: { variantId: line.variantId },
      });
      if (balance.reserved < line.quantity)
        throw new CheckoutError('Inventory reconciliation required.');
      await tx.inventoryBalance.update({
        where: { variantId: line.variantId },
        data: { reserved: { decrement: line.quantity }, version: { increment: 1 } },
      });
    }
    await tx.inventoryReservation.updateMany({
      where: { orderId, state: 'HELD' },
      data: { state: 'RELEASED' },
    });
    await tx.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });
    await audit(tx, actor, 'CANCEL_TEST_ORDER', orderId, reason);
  });
}
export async function addOrderNote(db: PrismaClient, actor: string, orderId: string, text: string) {
  z.uuid().parse(orderId);
  z.string().trim().min(2).max(1000).parse(text);
  return withAdmin(db, actor, async (tx) => {
    await tx.orderNote.create({ data: { orderId, actorId: actor, text } });
    await audit(tx, actor, 'ADD_ORDER_NOTE', orderId, 'Internal note added.');
  });
}
export async function saveSettings(db: PrismaClient, actor: string, raw: unknown) {
  const i = settingsSchema.parse(raw);
  return withAdmin(db, actor, async (tx) => {
    await tx.$queryRaw`SELECT id FROM commerce."CheckoutSettings" WHERE id='store' FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM commerce."StoreSettings" WHERE id='store' FOR UPDATE`;
    const checkout = await tx.checkoutSettings.findUniqueOrThrow({ where: { id: 'store' } }),
      store = await tx.storeSettings.findUniqueOrThrow({ where: { id: 'store' } });
    if (checkout.version !== i.version || store.version !== i.storeVersion)
      throw new CheckoutError('Settings changed. Refresh before saving.');
    await tx.checkoutSettings.update({
      where: { id: 'store' },
      data: {
        version: { increment: 1 },
        collectionEnabled: i.collectionEnabled,
        deliveryEnabled: i.deliveryEnabled,
        suspended: i.suspended,
        cutoff: i.cutoff,
        sameDayEnabled: i.sameDayEnabled,
        sameDayCutoff: i.sameDayCutoff,
        dailyCapacity: i.dailyCapacity,
        closedDates: [...new Set(i.closedDates.split(/[\s,]+/).filter(Boolean))],
      },
    });
    await tx.storeSettings.update({
      where: { id: 'store' },
      data: {
        version: { increment: 1 },
        phone: i.phone.startsWith('0') ? `+27${i.phone.slice(1)}` : i.phone,
        address: i.address,
        weekdayOpen: i.weekdayOpen,
        weekdayClose: i.weekdayClose,
        sundayOpen: i.sundayOpen,
        sundayClose: i.sundayClose,
        announcement: i.announcement,
        about: i.about,
      },
    });
    await audit(
      tx,
      actor,
      'EDIT_SETTINGS',
      'store',
      `${i.reason}; delivery ${i.deliveryEnabled}, cutoff ${i.cutoff}, same-day ${i.sameDayEnabled}, capacity ${i.dailyCapacity}. Address approvals require revalidation.`,
    );
  });
}
export async function approveAddress(
  db: PrismaClient,
  actor: string,
  addressId: string,
  expiresAt: string,
  reason: string,
  approved: boolean,
) {
  z.uuid().parse(addressId);
  reasonSchema.parse(reason);
  const expiry = new Date(expiresAt);
  if (
    approved &&
    (!Number.isFinite(expiry.getTime()) ||
      expiry <= new Date() ||
      expiry.getTime() > Date.now() + 366 * 86400000)
  )
    throw new CheckoutError('Approval needs a future expiry within one year.');
  return withAdmin(db, actor, async (tx) => {
    await tx.$queryRaw`SELECT id FROM commerce."CheckoutSettings" WHERE id='store' FOR SHARE`;
    const address = await tx.address.findUniqueOrThrow({ where: { id: addressId } }),
      settings = await tx.checkoutSettings.findUniqueOrThrow({ where: { id: 'store' } });
    if (approved) {
      const data = {
        customerId: address.customerId,
        addressHash: addressHash(address),
        zoneVersion: settings.version,
        expiresAt: expiry,
        reason,
      };
      await tx.deliveryApproval.upsert({
        where: { addressId },
        create: { addressId, ...data },
        update: data,
      });
    } else await tx.deliveryApproval.deleteMany({ where: { addressId } });
    await audit(tx, actor, approved ? 'APPROVE_ADDRESS' : 'REVOKE_ADDRESS', addressId, reason);
  });
}
export async function savePromotion(db: PrismaClient, actor: string, raw: unknown) {
  const i = promotionSchema.parse(raw);
  return withAdmin(db, actor, async (tx) => {
    if (i.id) {
      await tx.$queryRaw`SELECT id FROM commerce."Promotion" WHERE id=${i.id}::uuid FOR UPDATE`;
      const old = await tx.promotion.findUniqueOrThrow({ where: { id: i.id } });
      if (old.version !== i.version)
        throw new CheckoutError('Promotion changed. Refresh before saving.');
    }
    const bundle =
      i.kind === 'BUNDLE'
        ? [
            { variantId: i.variantA!, quantity: i.quantityA },
            { variantId: i.variantB!, quantity: i.quantityB },
          ]
        : [];
    if (
      bundle.length &&
      (await tx.productVariant.count({ where: { id: { in: bundle.map((b) => b.variantId) } } })) !==
        2
    )
      throw new CheckoutError('Select existing bundle variants.');
    const data = {
      name: i.name,
      code: i.code || null,
      kind: i.kind,
      value: i.value,
      productId: i.kind === 'BUNDLE' ? null : i.productId || null,
      bundle,
      startsAt: new Date(i.startsAt),
      endsAt: new Date(i.endsAt),
      active: i.active,
      maxUses: i.maxUses,
      perCustomer: i.perCustomer,
    };
    const result = i.id
      ? await tx.promotion.update({
          where: { id: i.id },
          data: { ...data, version: { increment: 1 } },
        })
      : await tx.promotion.create({ data });
    await audit(tx, actor, i.id ? 'EDIT_PROMOTION' : 'CREATE_PROMOTION', result.id, i.reason);
    return result.id;
  });
}
