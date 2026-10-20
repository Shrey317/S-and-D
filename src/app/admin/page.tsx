import Link from 'next/link';
import { serverEnv } from '@/config/env.server';
import { adminContext } from '@/server/admin/context';
import { overview } from '@/server/admin/overview';
import { AdminScreen, Panel } from '@/components/admin/ui';
import { formatRand } from '@/features/catalog/money';
export const dynamic = 'force-dynamic';
export default async function AdminPage() {
  if (!serverEnv.ADMIN_DATABASE_URL)
    return (
      <AdminScreen title="Administrator access verified">
        <p>
          Configure the administration database using the local setup guide to open store tools.
        </p>
        <Link href="/admin/payments">Payments and reconciliation</Link>
      </AdminScreen>
    );
  const { db } = await adminContext(),
    data = await overview(db);
  const unread = await db.adminNotification.count({ where: { readAt: null } });
  const count = (status: string) => data.counts.find((c) => c.status === status)?._count || 0;
  return (
    <AdminScreen
      title="Store overview"
      description="Your operator grant and two-step session are verified. Local orders are test records. Net sales exclude test, unpaid, cancelled and fully refunded orders; partial refunds reduce sales."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {unread > 0 && (
          <div
            className="rounded-xl border bg-secondary p-5 sm:col-span-2 lg:col-span-4"
            role="status"
          >
            <Link href="/admin/notifications" className="font-semibold underline">
              {unread} unread order or communication alerts
            </Link>
          </div>
        )}
        {[
          ['Today’s net sales', formatRand(data.money?.daily || '0.00')],
          ['This month', formatRand(data.money?.monthly || '0.00')],
          ['Pending orders (including tests)', count('PENDING')],
          ['Completed orders (including tests)', count('DELIVERED') + count('COLLECTED')],
        ].map(([label, value]) => (
          <Panel key={String(label)} title={String(label)}>
            <p className="text-2xl font-bold">{value}</p>
          </Panel>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Sales use the order date in Johannesburg time.{' '}
        <Link className="underline" href="/admin/reports">
          Open reports and Excel exports
        </Link>{' '}
        ·{' '}
        <Link className="underline" href="/admin/notifications">
          Review notifications
        </Link>
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Low stock">
          {data.low.length ? (
            data.low.map((v) => (
              <p key={v.id} className="mb-3">
                <Link
                  className="underline"
                  href={`/admin/inventory?q=${encodeURIComponent(v.name)}`}
                >
                  {v.name} · {v.label}
                </Link>{' '}
                — {v.available} available
              </p>
            ))
          ) : (
            <p>No active variants below their alert threshold.</p>
          )}
        </Panel>
        <Panel title="Bestselling products">
          {data.best.length ? (
            data.best.map((b) => (
              <p key={b.name}>
                {b.name}: {String(b.quantity)} packs
              </p>
            ))
          ) : (
            <p>No qualifying real sales yet.</p>
          )}
        </Panel>
      </div>
      <Panel title="Recent orders">
        {data.recent.length ? (
          data.recent.map((o) => (
            <p key={o.id} className="mb-4 break-all">
              <Link className="underline" href={`/admin/orders/${o.id}`}>
                Order {o.id}
              </Link>{' '}
              · {o.status} · {formatRand(o.total.toFixed(2))}
            </p>
          ))
        ) : (
          <p>No orders yet.</p>
        )}
      </Panel>
    </AdminScreen>
  );
}
