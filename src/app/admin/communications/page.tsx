import Link from 'next/link';
import { adminContext } from '@/server/admin/context';
import { AdminScreen, Pager, pagination } from '@/components/admin/ui';
import { serverEnv } from '@/config/env.server';
import { captureAction } from '@/server/communications/actions';
import { noticeTitles } from '@/features/communications/messages';
export default async function CommunicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { db } = await adminContext(),
    page = pagination((await searchParams).page);
  const [rows, drafts] = await Promise.all([
    db.emailMessage.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 20,
      skip: (page - 1) * 20,
    }),
    db.manualCommunication.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      skip: (page - 1) * 20,
    }),
  ]);
  return (
    <AdminScreen
      title="Communications"
      description="Queued, locally captured, provider-accepted and delivered emails are different states. WhatsApp drafts are sent manually."
    >
      <p>
        {serverEnv.EMAIL_CAPTURE_ENABLED
          ? 'Local capture enabled. No external email is sent.'
          : serverEnv.EMAIL_ENABLED
            ? 'Hosted email configured; provider delivery still needs verification.'
            : 'Email delivery disabled. Events remain queued.'}
      </p>
      {serverEnv.EMAIL_CAPTURE_ENABLED && !serverEnv.EMAIL_ENABLED && (
        <form action={captureAction}>
          <button className="min-h-12 rounded-lg border px-5" type="submit">
            Capture next 10 queued emails locally
          </button>
        </form>
      )}
      <h2 className="text-xl font-semibold">Email queue</h2>
      {rows.map((m) => (
        <article className="rounded-xl border p-5" key={m.id}>
          <Link className="underline" href={`/admin/communications/email/${m.id}`}>
            {noticeTitles[m.kind] || m.kind} · {m.audience.toLowerCase()}
          </Link>
          <p>
            {m.status} · {m.attempts} attempts
          </p>
          <p className="break-all">Order {m.orderId}</p>
          {m.lastError && <p>{m.lastError}</p>}
        </article>
      ))}
      {!rows.length && <p>No queued emails yet.</p>}
      <h2 className="text-xl font-semibold">Manual WhatsApp records</h2>
      {drafts.map((d) => (
        <p key={d.id}>
          <Link className="break-all underline" href={`/admin/communications/whatsapp/${d.id}`}>
            Order {d.orderId} · {d.state.replaceAll('_', ' ')}
          </Link>
        </p>
      ))}
      {!drafts.length && <p>Prepare a message from an order to begin.</p>}
      <Pager
        path="/admin/communications"
        page={page}
        more={rows.length === 20 || drafts.length === 20}
      />
    </AdminScreen>
  );
}
