import { Resend } from 'resend';
import { z } from 'zod';
import type { PrismaClient, Prisma } from '@/generated/prisma/client';
const eventSchema = z.object({
  type: z.string().max(40),
  created_at: z.iso.datetime({ offset: true }),
  data: z.object({ email_id: z.uuid() }),
});
const supported = [
  'email.sent',
  'email.delivered',
  'email.bounced',
  'email.complained',
  'email.failed',
  'email.suppressed',
  'email.delivery_delayed',
];
export function verifiedDelivery(raw: string, headers: Headers, secret: string) {
  const id = z.string().min(1).max(200).parse(headers.get('svix-id'));
  const data = new Resend('verification-only').webhooks.verify({
    payload: raw,
    headers: {
      id,
      timestamp: headers.get('svix-timestamp') || '',
      signature: headers.get('svix-signature') || '',
    },
    webhookSecret: secret,
  });
  const event = eventSchema.parse(data);
  return supported.includes(event.type)
    ? {
        id,
        providerId: event.data.email_id,
        type: event.type,
        occurredAt: new Date(event.created_at),
      }
    : null;
}
export async function recordDelivery(
  db: PrismaClient,
  event: NonNullable<ReturnType<typeof verifiedDelivery>>,
) {
  // Preserve valid early events even if provider acceptance has not yet committed locally.
  await db.emailDelivery.createMany({ data: [event], skipDuplicates: true });
  const existing = await db.emailDelivery.findUniqueOrThrow({ where: { id: event.id } });
  if (
    existing.providerId !== event.providerId ||
    existing.type !== event.type ||
    existing.occurredAt.getTime() !== event.occurredAt.getTime()
  )
    throw new Error('Conflicting delivery event.');
  await alertDeliveryFailure(db, event.providerId);
}
export async function alertDeliveryFailure(db: Prisma.TransactionClient, providerId: string) {
  const failed = await db.emailDelivery.findFirst({
    where: {
      providerId,
      type: { in: ['email.bounced', 'email.complained', 'email.failed', 'email.suppressed'] },
    },
  });
  if (!failed) return;
  const message = await db.emailMessage.findUnique({ where: { providerId } });
  if (message)
    await db.adminNotification.createMany({
      data: [
        { eventKey: `email-review:${message.id}`, orderId: message.orderId, kind: 'EMAIL_REVIEW' },
      ],
      skipDuplicates: true,
    });
}
