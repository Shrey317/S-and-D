import { z } from 'zod';
import type { PrismaClient, Prisma } from '@/generated/prisma/client';
import { withAdmin, audit } from '@/server/admin/repository';
import { noticeSchema, whatsappDraft } from '@/features/communications/messages';
import { CheckoutError } from '@/features/checkout/rules';
export async function prepareWhatsapp(
  db: PrismaClient,
  actor: string,
  orderId: string,
  key: string,
) {
  z.uuid().parse(orderId);
  z.uuid().parse(key);
  return withAdmin(db, actor, async (tx) => {
    const previous = await tx.manualCommunication.findUnique({ where: { key } });
    if (previous) {
      if (previous.orderId !== orderId || previous.actorId !== actor)
        throw new CheckoutError('Draft reference already used.');
      return previous.id;
    }
    const o = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    const draft = whatsappDraft(
      noticeSchema.parse({ ...o, total: o.total.toFixed(2), orderId: o.id }),
    );
    const row = await tx.manualCommunication.create({
      data: { orderId, actorId: actor, key, ...draft },
    });
    await audit(tx, actor, 'PREPARE_WHATSAPP', row.id, 'Draft prepared; no message sent.');
    return row.id;
  });
}
export async function openWhatsapp(db: PrismaClient, actor: string, id: string) {
  z.uuid().parse(id);
  return withAdmin(db, actor, async (tx) => {
    const row = await tx.manualCommunication.findUniqueOrThrow({ where: { id } });
    if (row.state === 'MARKED_SENT')
      throw new CheckoutError('This draft is already marked sent. Prepare a new draft if needed.');
    await tx.manualCommunication.update({
      where: { id },
      data: { state: 'OPENED', openedAt: new Date() },
    });
    await audit(tx, actor, 'OPEN_WHATSAPP', id, 'Click-to-chat opened; sending remains manual.');
    return `https://wa.me/${row.phone}?text=${encodeURIComponent(row.text)}`;
  });
}
export async function markWhatsapp(
  db: PrismaClient,
  actor: string,
  id: string,
  confirmed: boolean,
  reason: string,
) {
  z.uuid().parse(id);
  z.literal(true).parse(confirmed);
  z.string().trim().min(10).max(500).parse(reason);
  return withAdmin(db, actor, async (tx) => {
    const row = await tx.manualCommunication.findUniqueOrThrow({ where: { id } });
    if (row.state === 'MARKED_SENT') return;
    if (row.state !== 'OPENED')
      throw new CheckoutError('Open and manually send the draft before recording it.');
    await tx.manualCommunication.update({
      where: { id },
      data: { state: 'MARKED_SENT', markedAt: new Date() },
    });
    await audit(
      tx,
      actor,
      'MARK_WHATSAPP_SENT',
      id,
      `Administrator attestation only; delivery unverified. ${reason}`,
    );
  });
}
export async function resendNotice(
  db: PrismaClient,
  actor: string,
  id: string,
  key: string,
  confirmed: boolean,
) {
  z.uuid().parse(id);
  z.uuid().parse(key);
  z.literal(true).parse(confirmed);
  return withAdmin(db, actor, async (tx) => {
    const original = await tx.emailMessage.findUniqueOrThrow({ where: { id } });
    if (
      original.audience !== 'CUSTOMER' ||
      !['CAPTURED', 'ACCEPTED', 'FAILED'].includes(original.status)
    )
      throw new CheckoutError(
        'Reconcile pending or uncertain attempts before requesting another message.',
      );
    const row = await tx.emailMessage.upsert({
      where: { eventKey: `resend:${key}` },
      create: {
        eventKey: `resend:${key}`,
        orderId: original.orderId,
        kind: original.kind,
        audience: original.audience,
        payload: original.payload as Prisma.InputJsonValue,
      },
      update: {},
    });
    if (row.orderId !== original.orderId || row.kind !== original.kind)
      throw new CheckoutError('Resend reference already used.');
    await audit(
      tx,
      actor,
      'REQUEST_EMAIL_RESEND',
      row.id,
      'Administrator requested an additional copy; delivery is not confirmed.',
    );
    return row.id;
  });
}
export async function readNotification(db: PrismaClient, actor: string, id: string) {
  z.uuid().parse(id);
  return withAdmin(db, actor, async (tx) => {
    await tx.adminNotification.update({ where: { id }, data: { readAt: new Date() } });
    await audit(tx, actor, 'READ_NOTIFICATION', id, 'Notification acknowledged.');
  });
}
