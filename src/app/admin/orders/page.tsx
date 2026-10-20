import Link from 'next/link';
import { z } from 'zod';
import { adminContext } from '@/server/admin/context';
import { AdminScreen, Search, Pager, pagination } from '@/components/admin/ui';
import { formatRand } from '@/features/catalog/money';
import type { Snapshot } from '@/server/checkout/repository';
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { db } = await adminContext(),
    params = await searchParams,
    q = (params.q || '').slice(0, 100),
    page = pagination(params.page);
  const rows = await db.order.findMany({
    where: q
      ? {
          OR: [
            ...(z.uuid().safeParse(q).success ? [{ id: q }] : []),
            { snapshot: { path: ['name'], string_contains: q } },
            { snapshot: { path: ['email'], string_contains: q } },
          ],
        }
      : {},
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 20,
    skip: (page - 1) * 20,
  });
  return (
    <AdminScreen title="Orders">
      <Search q={q} placeholder="Search order ID, customer name or email" />
      {rows.map((o) => (
        <article key={o.id} className="rounded-xl border p-5">
          <h2 className="break-all font-semibold">
            <Link className="underline" href={`/admin/orders/${o.id}`}>
              Order {o.id}
            </Link>
          </h2>
          <p className="mt-3">
            {(o.snapshot as unknown as Snapshot).name} · {o.method} · {o.status} · {o.paymentStatus}{' '}
            · {formatRand(o.total.toFixed(2))}
          </p>
          <p className="mt-2">
            {(o.snapshot as unknown as Snapshot).isTest ? 'TEST ORDER' : 'Retail order'}
          </p>
        </article>
      ))}
      {!rows.length && <p>No matching orders.</p>}
      <Pager path="/admin/orders" page={page} more={rows.length === 20} q={q} />
    </AdminScreen>
  );
}
