import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { notFound } from 'next/navigation';
import { adminContext } from '@/server/admin/context';
import { AdminScreen, Panel } from '@/components/admin/ui';
import { ActionForm } from '@/components/account/action-form';
import { resendAction } from '@/server/communications/actions';
import { deliveryLabel, noticeTitles } from '@/features/communications/messages';
import { mailRequestSchema } from '@/server/communications/worker';
export default async function EmailPage({ params }: { params: Promise<{ messageId: string }> }) {
  const { db } = await adminContext(),
    { messageId } = await params;
  if (!z.uuid().safeParse(messageId).success) notFound();
  const m = await db.emailMessage.findUnique({ where: { id: messageId } });
  if (!m) notFound();
  const [attempts, events] = await Promise.all([
    db.emailAttempt.findMany({ where: { messageId }, orderBy: { number: 'asc' } }),
    m.providerId
      ? db.emailDelivery.findMany({
          where: { providerId: m.providerId },
          orderBy: { occurredAt: 'asc' },
        })
      : [],
  ]);
  const request = mailRequestSchema.safeParse(m.request);
  return (
    <AdminScreen
      title={noticeTitles[m.kind] || 'Email record'}
      description="Provider acceptance is not delivery. Local captures never leave this application."
    >
      <p>
        {m.status} · {m.audience.toLowerCase()} · {deliveryLabel(events.map((e) => e.type))}
      </p>
      <Link className="underline" href={`/admin/orders/${m.orderId}`}>
        View order
      </Link>
      {request.success ? (
        <Panel title="Message content">
          <p className="break-all">To: {request.data.to}</p>
          <p className="my-3 font-semibold">{request.data.subject}</p>
          <pre className="whitespace-pre-wrap break-words font-sans text-sm">
            {request.data.text}
          </pre>
        </Panel>
      ) : (
        <p>Content will be rendered and frozen when processing begins.</p>
      )}
      <Panel title="Attempts">
        {attempts.map((a) => (
          <p className="mb-3" key={a.id}>
            Attempt {a.number} · {a.status} · {a.detail}
          </p>
        ))}
        {!attempts.length && <p>No processing attempts yet.</p>}
      </Panel>
      <Panel title="Delivery events">
        {events.map((e) => (
          <p key={e.id}>
            {e.type} · {e.occurredAt.toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })}{' '}
            SAST
          </p>
        ))}
        {!events.length && <p>No verified provider delivery events.</p>}
      </Panel>
      {m.audience === 'CUSTOMER' && ['CAPTURED', 'ACCEPTED', 'FAILED'].includes(m.status) && (
        <Panel title="Request another copy">
          <p className="mb-4">
            This queues an additional copy of this event. Check prior attempts and delivery records
            first; the customer may receive a duplicate. Bounced or complained recipients remain
            suppressed.
          </p>
          <ActionForm
            action={resendAction}
            hidden={{ id: m.id, key: randomUUID() }}
            label="Queue another copy"
            fields={[
              {
                name: 'confirmed',
                label: 'I reviewed the history and want an additional copy',
                type: 'checkbox',
              },
            ]}
          />
        </Panel>
      )}
    </AdminScreen>
  );
}
