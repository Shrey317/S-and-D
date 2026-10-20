import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireIdentity } from '@/server/auth/identity';
import { getCommerceDatabase } from '@/server/db/commerce-client';
import {
  readOrders,
  expireReservations,
  withOwner,
  type Snapshot,
} from '@/server/checkout/repository';
import { reorderAction } from '@/server/checkout/actions';
import { ActionForm } from './action-form';
import { formatRand } from '@/features/catalog/money';
export async function OrderDetail({
  id,
  confirmation = false,
}: {
  id: string;
  confirmation?: boolean;
}) {
  const identity = await requireIdentity('/account/orders');
  if (!z.uuid().safeParse(id).success) notFound();
  const db = await getCommerceDatabase();
  await expireReservations(db);
  const order = (await readOrders(db, identity.id, id))[0];
  if (!order) notFound();
  const snapshot = order.snapshot as unknown as Snapshot;
  const payment = await withOwner(db, { customerId: identity.id }, (tx) =>
    tx.payment.findUnique({ where: { orderId: order.id } }),
  );
  return (
    <div className="max-w-3xl">
      <p className="eyebrow">Local test order</p>
      <h1 className="mt-3 text-3xl font-bold">
        {confirmation ? 'Test order created' : 'Order details'}
      </h1>
      <p className="mt-4 break-all text-sm">Reference: {order.id}</p>
      <p className="mt-5 rounded-xl bg-secondary p-5">
        This is a local test order and will not be fulfilled. Do not transfer real money. Payment
        status below comes from verified records, never a browser return.
      </p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="font-semibold">Order status</dt>
          <dd>{order.status === 'PENDING' ? 'Pending' : order.status.toLowerCase()}</dd>
        </div>
        <div>
          <dt className="font-semibold">Payment status</dt>
          <dd>{order.paymentStatus === 'UNPAID' ? 'Unpaid' : order.paymentStatus.toLowerCase()}</dd>
        </div>
        <div>
          <dt className="font-semibold">Fulfilment</dt>
          <dd>{order.method === 'COLLECTION' ? 'Collection' : 'Delivery'}</dd>
        </div>
        <div>
          <dt className="font-semibold">Provisional planning date</dt>
          <dd>{snapshot.planningDate} · awaiting confirmation</dd>
        </div>
      </dl>
      {payment && (
        <p className="mt-5">
          <Link className="underline" href={`/payments/${payment.id}/status`}>
            View payment instructions and status
          </Link>
          {order.paymentException && (
            <span className="mt-2 block">
              Payment needs review. Contact the store before making another payment.
            </span>
          )}
        </p>
      )}
      <section className="mt-8 rounded-2xl border p-6">
        <h2 className="text-xl font-semibold">Order summary</h2>
        {snapshot.lines.map((line) => (
          <p key={line.variantId} className="mt-4">
            {line.quantity} × {line.name} · {line.label}
            <br />
            {formatRand(line.price)} each · {formatRand(line.total)}
          </p>
        ))}
        <hr className="my-5" />
        <p>Subtotal: {formatRand(snapshot.subtotal)}</p>
        <p>Discount: {formatRand(snapshot.discount)}</p>
        <p>Delivery / collection: {formatRand(snapshot.deliveryFee)}</p>
        <p className="mt-3 text-xl font-bold">Total: {formatRand(order.total.toFixed(2))}</p>
        <p className="mt-2 text-sm">No VAT charged.</p>
      </section>
      <section className="mt-6">
        <h2 className="text-xl font-semibold">Contact and fulfilment details</h2>
        <p className="mt-3">
          {snapshot.name}
          <br />
          {snapshot.phone}
          <br />
          {snapshot.email}
        </p>
        {snapshot.address ? (
          <p className="mt-3">
            {snapshot.address.recipient}
            <br />
            {snapshot.address.street}
            <br />
            {snapshot.address.suburb}, {snapshot.address.city}, {snapshot.address.postalCode}
            <br />
            {snapshot.address.instructions}
          </p>
        ) : (
          <p className="mt-3">
            Collection: 155 Gemsbok Street, Lenasia. Wait for readiness confirmation before
            travelling.
          </p>
        )}
      </section>
      <div className="mt-8">
        <ActionForm
          action={reorderAction}
          hidden={{ orderId: order.id }}
          label="Add available items to basket"
        />
      </div>
      <div className="mt-6 flex flex-wrap gap-5">
        <Link className="underline" href="/cart">
          View basket
        </Link>
        <Link className="underline" href="/account/orders">
          Order history
        </Link>
      </div>
    </div>
  );
}
