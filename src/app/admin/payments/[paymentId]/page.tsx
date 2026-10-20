import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { notFound } from 'next/navigation';
import { isAdministrator } from '@/server/auth/identity';
import { getPaymentDatabase } from '@/server/db/payment-client';
import { ActionForm } from '@/components/account/action-form';
import {
  receiptAction,
  refundRequestAction,
  refundResolveAction,
  cancelPaymentAction,
} from '@/server/payments/actions';
import { formatRand } from '@/features/catalog/money';
export const dynamic = 'force-dynamic';
export default async function PaymentAdminPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  if (!(await isAdministrator())) notFound();
  const { paymentId } = await params;
  if (!z.uuid().safeParse(paymentId).success) notFound();
  const db = await getPaymentDatabase();
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: true,
      refunds: { orderBy: { createdAt: 'desc' }, take: 100 },
      receipts: { orderBy: { createdAt: 'desc' }, take: 100 },
      events: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  });
  if (!payment) notFound();
  const audits = await db.paymentAudit.findMany({
    where: { paymentId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return (
    <main id="main-content" className="site-container py-12">
      <div className="max-w-3xl">
        <Link href="/admin/payments" className="underline">
          All payments
        </Link>
        <h1 className="mt-5 text-3xl font-bold">Payment reconciliation</h1>
        <p className="mt-4 break-all">Reference: {payment.id}</p>
        <p className="mt-4 rounded-xl bg-secondary p-5">
          Local test records only. No action here sends money to Payfast or a bank. Completion must
          be checked externally and recorded with its unique reference.
        </p>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <dt>Payment status</dt>
            <dd className="font-semibold">{payment.state}</dd>
          </div>
          <div>
            <dt>Order status</dt>
            <dd className="font-semibold">{payment.order.status}</dd>
          </div>
          <div>
            <dt>Expected</dt>
            <dd>{formatRand(payment.expected.toFixed(2))}</dd>
          </div>
          <div>
            <dt>Verified received / refunded</dt>
            <dd>
              {formatRand(payment.received.toFixed(2))} / {formatRand(payment.refunded.toFixed(2))}
            </dd>
          </div>
        </dl>
        {payment.exception && (
          <p className="mt-5 border p-5">
            Review required: {payment.exception.replaceAll('_', ' ')}. Do not fulfil an expired
            order or accept another payment before resolving the discrepancy.
          </p>
        )}
        <section className="mt-8 rounded-xl border p-6">
          <h2 className="mb-5 text-xl font-semibold">Record verified receipt</h2>
          <p className="mb-5 text-sm">
            Check the bank, cash receipt or Payfast dashboard first. A browser return or uploaded
            proof is insufficient. For Payfast, use its numeric transaction ID to prevent double
            counting with notifications.
          </p>
          <ActionForm
            action={receiptAction}
            hidden={{ paymentId, key: randomUUID() }}
            label="Record verified receipt"
            fields={[
              {
                name: 'amount',
                label: 'Verified amount (ZAR, two decimals)',
                required: true,
                pattern: '[0-9]+[.][0-9]{2}',
                value: payment.expected.toFixed(2),
              },
              {
                name: 'reference',
                label: 'Bank, cash or Payfast transaction reference',
                required: true,
                maxLength: 120,
              },
              {
                name: 'reason',
                label: 'Verification evidence and reason',
                required: true,
                minLength: 10,
                maxLength: 500,
              },
              {
                name: 'verified',
                label: 'I checked the external record and verified that funds were received.',
                type: 'checkbox',
              },
            ]}
          />
        </section>
        <section className="mt-8 rounded-xl border p-6">
          <h2 className="mb-5 text-xl font-semibold">Request refund</h2>
          <ActionForm
            action={refundRequestAction}
            hidden={{ paymentId, key: randomUUID() }}
            label="Request refund"
            fields={[
              {
                name: 'amount',
                label: 'Refund amount (ZAR, two decimals)',
                required: true,
                pattern: '[0-9]+[.][0-9]{2}',
              },
              {
                name: 'reason',
                label: 'Refund reason',
                required: true,
                minLength: 10,
                maxLength: 500,
              },
            ]}
          />
        </section>
        <section className="mt-8">
          <h2 className="text-xl font-semibold">Refund requests</h2>
          {payment.refunds.map((refund) => (
            <article key={refund.id} className="mt-4 rounded-xl border p-5">
              <p>
                {formatRand(refund.amount.toFixed(2))} · {refund.state}
              </p>
              <p className="mt-2">{refund.reason}</p>
              {refund.state === 'REQUESTED' && (
                <div className="mt-5 grid gap-6">
                  <ActionForm
                    action={refundResolveAction}
                    hidden={{ refundId: refund.id, resolution: 'COMPLETE' }}
                    label="Record externally completed refund"
                    fields={[
                      {
                        name: 'reference',
                        label: 'External refund reference',
                        required: true,
                        maxLength: 120,
                      },
                      {
                        name: 'reason',
                        label: 'Completion evidence',
                        required: true,
                        minLength: 10,
                        maxLength: 500,
                      },
                      {
                        name: 'verified',
                        label:
                          'I verified the refund completed externally; this is not just a request.',
                        type: 'checkbox',
                      },
                    ]}
                  />
                  <ActionForm
                    action={refundResolveAction}
                    hidden={{ refundId: refund.id, resolution: 'CANCEL' }}
                    label="Cancel refund request"
                    fields={[
                      {
                        name: 'reason',
                        label: 'Cancellation reason',
                        required: true,
                        minLength: 10,
                        maxLength: 500,
                      },
                    ]}
                  />
                </div>
              )}
            </article>
          ))}
        </section>
        <section className="mt-8 rounded-xl border p-6">
          <h2 className="mb-5 text-xl font-semibold">Cancel order allocation</h2>
          <p className="mb-5">
            Only unpaid or fully refunded, unfulfilled orders can release stock here.
          </p>
          <ActionForm
            action={cancelPaymentAction}
            hidden={{ paymentId }}
            label="Cancel allocation"
            fields={[
              {
                name: 'reason',
                label: 'Reason for cancelling the allocation',
                required: true,
                minLength: 10,
                maxLength: 500,
              },
            ]}
          />
        </section>
        <section className="mt-8">
          <h2 className="text-xl font-semibold">Verified receipts</h2>
          {payment.receipts.map((r) => (
            <p key={r.id} className="mt-3 break-all">
              {r.reference} · {formatRand(r.amount.toFixed(2))}
            </p>
          ))}
        </section>
        <section className="mt-8">
          <h2 className="text-xl font-semibold">Recent payment events</h2>
          {payment.events.map((e) => (
            <p key={e.id} className="mt-3 break-all">
              {e.kind.replaceAll('_', ' ')} ·{' '}
              {e.kind === 'ADMIN_RECEIPT' ? 'Recorded' : e.outcome.replaceAll('_', ' ')}
            </p>
          ))}
        </section>
        <section className="mt-8">
          <h2 className="text-xl font-semibold">Recent administrator audit</h2>
          {audits.map((a) => (
            <p key={a.id} className="mt-3 break-all">
              {a.action} · {a.detail}
              <br />
              {a.createdAt.toISOString()} · {a.actorId}
            </p>
          ))}
        </section>
      </div>
    </main>
  );
}
