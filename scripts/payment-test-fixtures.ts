import { z } from 'zod';
import type { PrismaClient } from '../src/generated/prisma/client';
/** Disposable test fixtures only. No application/runtime import. */
export async function cleanupTestOrders(db: PrismaClient, customerIds: string[]) {
  customerIds.forEach((id) => z.uuid().parse(id));
  const databases = await db.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  if (databases[0]?.name !== 'sd_catalog_test')
    throw new Error('Test cleanup requires sd_catalog_test.');
  await db.$transaction(async (tx) => {
    const orders = await tx.order.findMany({
        where: { customerId: { in: customerIds } },
        select: { id: true },
      }),
      ids = orders.map((o) => o.id);
    const messages = await tx.emailMessage.findMany({
      where: { orderId: { in: ids } },
      select: { id: true, providerId: true },
    });
    await tx.emailDelivery.deleteMany({
      where: { providerId: { in: messages.flatMap((m) => (m.providerId ? [m.providerId] : [])) } },
    });
    await tx.emailAttempt.deleteMany({ where: { messageId: { in: messages.map((m) => m.id) } } });
    await tx.emailMessage.deleteMany({ where: { orderId: { in: ids } } });
    await tx.adminNotification.deleteMany({ where: { orderId: { in: ids } } });
    await tx.manualCommunication.deleteMany({ where: { orderId: { in: ids } } });
    const held = await tx.inventoryReservation.findMany({
      where: { orderId: { in: ids }, state: 'HELD' },
      orderBy: { variantId: 'asc' },
    });
    for (const line of held)
      await tx.inventoryBalance.update({
        where: { variantId: line.variantId },
        data: { reserved: { decrement: line.quantity }, version: { increment: 1 } },
      });
    const consumed = await tx.inventoryReservation.findMany({
      where: { orderId: { in: ids }, state: 'CONSUMED' },
      orderBy: { variantId: 'asc' },
    });
    for (const line of consumed)
      await tx.inventoryBalance.update({
        where: { variantId: line.variantId },
        data: { onHand: { increment: line.quantity }, version: { increment: 1 } },
      });
    await tx.orderNote.deleteMany({ where: { orderId: { in: ids } } });
    await tx.inventoryAdjustment.deleteMany({ where: { orderId: { in: ids } } });
    await tx.promotionRedemption.deleteMany({ where: { orderId: { in: ids } } });
    const payments = await tx.payment.findMany({
        where: { orderId: { in: ids } },
        select: { id: true },
      }),
      paymentIds = payments.map((p) => p.id);
    await tx.paymentAudit.deleteMany({ where: { paymentId: { in: paymentIds } } });
    await tx.paymentEvent.deleteMany({ where: { paymentId: { in: paymentIds } } });
    await tx.refund.deleteMany({ where: { paymentId: { in: paymentIds } } });
    await tx.paymentReceipt.deleteMany({ where: { paymentId: { in: paymentIds } } });
    await tx.payment.deleteMany({ where: { id: { in: paymentIds } } });
    await tx.inventoryReservation.deleteMany({ where: { orderId: { in: ids } } });
    await tx.order.deleteMany({ where: { id: { in: ids } } });
  });
}
