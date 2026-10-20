import Link from 'next/link';
import type { Metadata } from 'next';
import { z } from 'zod';
import { notFound } from 'next/navigation';
import { adminContext } from '@/server/admin/context';
import { AdminScreen, Panel, reasonField } from '@/components/admin/ui';
import { ActionForm } from '@/components/account/action-form';
import { markAction } from '@/server/communications/actions';
// Native form posts need their origin; same-origin still withholds the referrer from WhatsApp.
export const metadata: Metadata = { referrer: 'same-origin' };
export default async function DraftPage({ params }: { params: Promise<{ draftId: string }> }) {
  const { db } = await adminContext(),
    { draftId } = await params;
  if (!z.uuid().safeParse(draftId).success) notFound();
  const d = await db.manualCommunication.findUnique({ where: { id: draftId } });
  if (!d) notFound();
  return (
    <AdminScreen
      title="WhatsApp confirmation"
      description="Review the saved draft, open WhatsApp and send it yourself. Opening the link never counts as sending or delivery."
    >
      <p>State: {d.state.replaceAll('_', ' ')}</p>
      <Link className="underline" href={`/admin/orders/${d.orderId}`}>
        Return to order
      </Link>
      <Panel title="Review message">
        <p className="mb-4">Customer contact: +{d.phone}</p>
        <pre className="whitespace-pre-wrap break-words font-sans">{d.text}</pre>
      </Panel>
      {d.state !== 'MARKED_SENT' && (
        <form
          action="/admin/communications/whatsapp/open"
          method="post"
          target="_blank"
          rel="noopener"
        >
          <input type="hidden" name="id" value={d.id} />
          <button className="min-h-12 rounded-lg border px-5" type="submit">
            Open WhatsApp draft in a new tab
          </button>
          <p className="mt-3 text-sm">
            After manually sending, refresh this page to record your action.
          </p>
        </form>
      )}
      <Panel title="Record manual sending">
        <ActionForm
          action={markAction}
          hidden={{ id: d.id }}
          label="Mark manually sent"
          disabled={d.state !== 'OPENED'}
          fields={[
            {
              name: 'confirmed',
              label: 'I personally sent this exact message in WhatsApp',
              type: 'checkbox',
            },
            reasonField,
          ]}
        />
        {d.state === 'MARKED_SENT' && (
          <p>Administrator marked this message sent. Recipient delivery is unverified.</p>
        )}
      </Panel>
    </AdminScreen>
  );
}
