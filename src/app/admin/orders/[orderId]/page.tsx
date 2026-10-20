import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { prepareAction } from '@/server/communications/actions';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { adminContext } from '@/server/admin/context';
import { AdminScreen, Panel, reasonField } from '@/components/admin/ui';
import { ActionForm } from '@/components/account/action-form';
import { completeAction, noteAction, cancelLegacyAction } from '@/server/admin/actions';
import { cancelPaymentAction } from '@/server/payments/actions';
import { formatRand } from '@/features/catalog/money';
import type { Snapshot } from '@/server/checkout/repository';
export default async function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { db } = await adminContext(),
    { orderId } = await params;
  if (!z.uuid().safeParse(orderId).success) notFound();
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { payment: true, reservations: true },
  });
  if (!order) notFound();
  const notes = await db.orderNote.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    s = order.snapshot as unknown as Snapshot;
  return (
    <AdminScreen
      title="Order details"
      description={
        s.isTest ? 'Local test record — do not fulfil a real purchase from this order.' : undefined
      }
    >
      <p className="break-all">
        Reference {order.id} · {order.status} · Payment {order.paymentStatus}
      </p>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel title="Customer and fulfilment">
          <p>
            {s.name} · {s.phone}
          </p>
          <p className="break-all">{s.email}</p>
          <p className="mt-3">
            {order.method} · Planning date {s.planningDate}
          </p>
          {s.address && <p className="mt-3">{Object.values(s.address).join(', ')}</p>}
          <Link
            className="mt-4 inline-block underline"
            href={`/admin/customers/${order.customerId}`}
          >
            Customer profile
          </Link>
        </Panel>
        <Panel title="Order snapshot">
          {s.lines?.map((line) => (
            <p key={line.variantId} className="mb-3">
              {line.quantity} × {line.name} · {line.label} · {formatRand(line.total)}
            </p>
          ))}
          <p>Discount {formatRand(s.discount || '0.00')}</p>
          <p className="mt-3 text-xl font-bold">Total {formatRand(order.total.toFixed(2))}</p>
          {order.payment && (
            <Link
              className="mt-4 inline-block underline"
              href={`/admin/payments/${order.payment.id}`}
            >
              Reconcile payment / manage refunds
            </Link>
          )}
        </Panel>
        <Panel title="Complete fulfilment">
          <p className="mb-4">
            Verify payment, stock allocation and actual handover. Completion consumes held packs
            once; it does not change payment status.
          </p>
          <ActionForm
            action={completeAction}
            hidden={{ orderId }}
            label={order.method === 'DELIVERY' ? 'Mark delivered' : 'Mark collected'}
            fields={[reasonField]}
            disabled={order.status !== 'PENDING'}
          />
        </Panel>
        {order.payment ? (
          <Panel title="Cancel allocation">
            <p className="mb-4">
              Received funds must be fully refunded first. Completed orders cannot be cancelled.
            </p>
            <ActionForm
              action={cancelPaymentAction}
              hidden={{ paymentId: order.payment.id }}
              label="Cancel allocation"
              fields={[reasonField]}
              disabled={!['PENDING', 'EXPIRED'].includes(order.status)}
            />
          </Panel>
        ) : (
          <Panel title="Cancel test allocation">
            <ActionForm
              action={cancelLegacyAction}
              hidden={{ orderId }}
              label="Cancel test allocation"
              fields={[reasonField]}
              disabled={!['PENDING', 'EXPIRED'].includes(order.status)}
            />
          </Panel>
        )}
      </div>
      <Panel title="Internal notes">
        <Link className="mb-5 inline-block underline" href="/admin/communications">
          Email and communication history
        </Link>
        <ActionForm
          action={prepareAction}
          hidden={{ orderId, key: randomUUID() }}
          label="Prepare WhatsApp confirmation"
        />
        <ActionForm
          action={noteAction}
          hidden={{ orderId }}
          label="Add internal note"
          fields={[
            {
              name: 'text',
              label: 'Note (administrator only)',
              type: 'textarea',
              required: true,
              minLength: 2,
              maxLength: 1000,
            },
          ]}
        />
        {notes.map((n) => (
          <p key={n.id} className="mt-5 whitespace-pre-wrap break-words">
            {n.text}
            <br />
            <span className="text-sm text-muted-foreground">
              {n.createdAt.toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })} SAST
            </span>
          </p>
        ))}
      </Panel>
    </AdminScreen>
  );
}
