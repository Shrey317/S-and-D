import Link from 'next/link';
import { requireIdentity } from '@/server/auth/identity';
import { getCommerceDatabase } from '@/server/db/commerce-client';
import { readOrders, expireReservations } from '@/server/checkout/repository';
import { formatRand } from '@/features/catalog/money';
import { serverEnv } from '@/config/env.server';
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const identity = await requireIdentity('/account/orders');
  const query = await searchParams;
  const page = /^[1-9]\d{0,3}$/.test(query.page || '') ? Number(query.page) : 1;
  const db = serverEnv.CART_ENABLED ? await getCommerceDatabase() : null;
  if (db) await expireReservations(db);
  const orders = db ? await readOrders(db, identity.id, undefined, page) : [];
  return (
    <>
      <h1 className="text-3xl font-bold">Your orders</h1>
      <p className="mt-4 text-muted-foreground">
        Local test orders only. No payments or fulfilment.
      </p>
      <div className="mt-8 grid gap-4">
        {orders.map((order) => (
          <article className="rounded-2xl border p-5" key={order.id}>
            <h2 className="break-all text-lg font-semibold">
              <Link href={`/account/orders/${order.id}`}>Order {order.id}</Link>
            </h2>
            <p className="mt-3">
              {order.createdAt.toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg' })} ·{' '}
              {order.method === 'COLLECTION' ? 'Collection' : 'Delivery'}
            </p>
            <p className="mt-2">
              {order.status} · {order.paymentStatus} · {formatRand(order.total.toFixed(2))}
            </p>
          </article>
        ))}
      </div>
      {!orders.length && (
        <p className="mt-8">
          No orders on this page.{' '}
          <Link href="/shop" className="underline">
            Explore the shop
          </Link>
        </p>
      )}
      <nav className="mt-8 flex gap-6" aria-label="Order pages">
        {page > 1 && <Link href={`/account/orders?page=${page - 1}`}>Previous page</Link>}
        {orders.length === 20 && <Link href={`/account/orders?page=${page + 1}`}>Next page</Link>}
      </nav>
    </>
  );
}
