import Link from 'next/link';
import { adminContext } from '@/server/admin/context';
import { AdminScreen, Pager, pagination } from '@/components/admin/ui';
import { ActionForm } from '@/components/account/action-form';
import { readAction } from '@/server/communications/actions';
import { noticeTitles } from '@/features/communications/messages';
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { db } = await adminContext(),
    page = pagination((await searchParams).page);
  const rows = await db.adminNotification.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: (page - 1) * 20,
    take: 20,
  });
  return (
    <AdminScreen
      title="Notifications"
      description="Order and payment alerts are saved with their source events. Acknowledging an alert does not change an order or confirm a message was sent."
    >
      <Link className="underline" href="/admin/communications">
        Email queue and communication history
      </Link>
      {rows.map((n) => (
        <article className="rounded-xl border p-5" key={n.id}>
          <h2 className="text-xl font-semibold">{noticeTitles[n.kind] || n.kind}</h2>
          <p className="my-3">
            {n.createdAt.toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })} SAST ·{' '}
            {n.readAt ? 'Acknowledged' : 'Unread'}
          </p>
          <Link className="break-all underline" href={`/admin/orders/${n.orderId}`}>
            Order {n.orderId}
          </Link>
          {!n.readAt && <ActionForm action={readAction} hidden={{ id: n.id }} label="Mark read" />}
        </article>
      ))}
      {!rows.length && <p>No notifications yet.</p>}
      <Pager path="/admin/notifications" page={page} more={rows.length === 20} />
    </AdminScreen>
  );
}
