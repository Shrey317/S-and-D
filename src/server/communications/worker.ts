import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { PrismaClient, EmailMessage, Prisma } from '@/generated/prisma/client';
import { noticeSchema } from '@/features/communications/messages';
import { renderNotice } from '@/emails/order-notice';
import { assertCommunicationsRole } from '@/server/db/communications-permissions';
import { alertDeliveryFailure } from './delivery';
export const mailRequestSchema = z.object({
  from: z.email(),
  to: z.email(),
  subject: z.string().max(240),
  html: z.string(),
  text: z.string(),
});
export type MailRequest = z.infer<typeof mailRequestSchema>;
export type WorkerConfig = {
  enabled: boolean;
  capture: boolean;
  siteUrl: string;
  from?: string | undefined;
  adminEmail?: string | undefined;
};
export type SendMail = (request: MailRequest, key: string) => Promise<string>;
export class MailFailure extends Error {
  constructor(public permanent: boolean) {
    super(permanent ? 'Provider rejected request' : 'Provider temporarily unavailable');
  }
}
export async function claimMessage(db: PrismaClient) {
  return db.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<
      EmailMessage[]
    >`SELECT * FROM commerce."EmailMessage" WHERE (status='PENDING' AND "availableAt"<=now()) OR (status='PROCESSING' AND "leaseUntil"<=now()) ORDER BY "createdAt",id FOR UPDATE SKIP LOCKED LIMIT 1`;
    if (!row) return null;
    if (
      row.attempts >= 6 ||
      (row.firstAttemptAt && Date.now() - row.firstAttemptAt.getTime() > 23 * 3600000)
    ) {
      await tx.emailMessage.update({
        where: { id: row.id },
        data: {
          status: 'REVIEW',
          leaseToken: null,
          leaseUntil: null,
          lastError: 'Retry limit reached; reconcile before sending again',
        },
      });
      await tx.adminNotification.createMany({
        data: [{ eventKey: `email-review:${row.id}`, orderId: row.orderId, kind: 'EMAIL_REVIEW' }],
        skipDuplicates: true,
      });
      return null;
    }
    await tx.emailAttempt.updateMany({
      where: { messageId: row.id, status: 'STARTED' },
      data: { status: 'ABANDONED', detail: 'Lease expired; outcome uncertain' },
    });
    const message = await tx.emailMessage.update({
      where: { id: row.id },
      data: {
        status: 'PROCESSING',
        leaseToken: randomUUID(),
        leaseUntil: new Date(Date.now() + 120000),
        firstAttemptAt: row.firstAttemptAt || new Date(),
        attempts: { increment: 1 },
      },
    });
    await tx.emailAttempt.create({
      data: {
        messageId: row.id,
        number: message.attempts,
        status: 'STARTED',
        detail: 'Lease acquired',
      },
    });
    return message;
  });
}
export async function runMailBatch(
  db: PrismaClient,
  config: WorkerConfig,
  send: SendMail,
  limit = 10,
) {
  await assertCommunicationsRole(db);
  if (!config.enabled && !config.capture) return { processed: 0 };
  let processed = 0;
  const deadline = Date.now() + 45000;
  for (let i = 0; i < Math.min(limit, 20); i++) {
    if (Date.now() >= deadline) break;
    const message = await claimMessage(db);
    if (!message) break;
    let mode = message.mode,
      request: MailRequest | undefined;
    try {
      const notice = noticeSchema.parse(message.payload);
      mode ||= config.capture || notice.snapshot.isTest ? 'CAPTURE' : 'RESEND';
      // Test records may never leave the application, even if hosted mail is enabled later.
      if (
        (notice.snapshot.isTest && mode !== 'CAPTURE') ||
        (mode === 'RESEND' && !config.enabled) ||
        (mode === 'CAPTURE' && !config.capture && !notice.snapshot.isTest)
      )
        throw new MailFailure(true);
      request = message.request
        ? mailRequestSchema.parse(message.request)
        : mailRequestSchema.parse({
            from: mode === 'CAPTURE' ? 'orders@example.test' : config.from,
            to:
              message.audience === 'ADMIN'
                ? mode === 'CAPTURE'
                  ? 'administrator@example.test'
                  : config.adminEmail
                : notice.snapshot.email,
            ...(await renderNotice(message.kind, notice, message.audience, config.siteUrl)),
          });
      const frozen = await db.emailMessage.updateMany({
        where: { id: message.id, leaseToken: message.leaseToken, status: 'PROCESSING' },
        data: { mode, request: request as Prisma.InputJsonValue },
      });
      if (!frozen.count) continue;
      if (mode === 'RESEND') {
        const [blocked] = await db.$queryRaw<
          { blocked: boolean }[]
        >`SELECT EXISTS(SELECT 1 FROM commerce."EmailDelivery" d JOIN commerce."EmailMessage" m ON m."providerId"=d."providerId" WHERE m.request->>'to'=${request.to} AND d.type IN ('email.bounced','email.complained','email.suppressed')) AS blocked`;
        if (blocked?.blocked) throw new MailFailure(true);
      }
      const providerId =
        mode === 'CAPTURE'
          ? `capture:${message.id}`
          : await send(request, `sd-email/${message.id}`);
      await db.$transaction(async (tx) => {
        const won = await tx.emailMessage.updateMany({
          where: { id: message.id, leaseToken: message.leaseToken, status: 'PROCESSING' },
          data: {
            status: mode === 'CAPTURE' ? 'CAPTURED' : 'ACCEPTED',
            providerId,
            leaseToken: null,
            leaseUntil: null,
            lastError: null,
          },
        });
        if (won.count)
          await tx.emailAttempt.update({
            where: { messageId_number: { messageId: message.id, number: message.attempts } },
            data: {
              status: mode === 'CAPTURE' ? 'CAPTURED' : 'ACCEPTED',
              detail:
                mode === 'CAPTURE'
                  ? 'Captured locally; not sent'
                  : 'Provider accepted; delivery unconfirmed',
            },
          });
        if (won.count && mode === 'RESEND') await alertDeliveryFailure(tx, providerId);
      });
    } catch (error) {
      const permanent =
        error instanceof z.ZodError || (error instanceof MailFailure && error.permanent);
      await db.$transaction(async (tx) => {
        const status = permanent ? 'FAILED' : message.attempts >= 6 ? 'REVIEW' : 'PENDING';
        const detail = permanent
          ? 'Invalid, suppressed or rejected message'
          : 'Delivery outcome uncertain; retry uses the same request and key';
        const won = await tx.emailMessage.updateMany({
          where: { id: message.id, leaseToken: message.leaseToken, status: 'PROCESSING' },
          data: {
            status,
            leaseToken: null,
            leaseUntil: null,
            lastError: detail,
            availableAt: new Date(Date.now() + Math.min(3600000, 30000 * 2 ** message.attempts)),
          },
        });
        if (won.count) {
          await tx.emailAttempt.update({
            where: { messageId_number: { messageId: message.id, number: message.attempts } },
            data: { status, detail },
          });
          if (status !== 'PENDING')
            await tx.adminNotification.createMany({
              data: [
                {
                  eventKey: `email-review:${message.id}`,
                  orderId: message.orderId,
                  kind: 'EMAIL_REVIEW',
                },
              ],
              skipDuplicates: true,
            });
        }
      });
    }
    processed++;
  }
  return { processed };
}
