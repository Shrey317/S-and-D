import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireIdentity } from '@/server/auth/identity';
import { getCommerceDatabase } from '@/server/db/commerce-client';
import { withOwner, expireReservations } from '@/server/checkout/repository';
import { serverEnv } from '@/config/env.server';
import { paymentLabels, type PaymentMethod, isOnline } from '@/features/payments/methods';
import { paymentRequest } from '@/server/payments/payfast';
import { payfastConfig } from '@/server/payments/config';
import { formatRand } from '@/features/catalog/money';
import { Button } from '@/components/ui/button';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Payment status' };
export default async function PaymentPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const identity = await requireIdentity('/account/orders'),
    { paymentId } = await params;
  if (!z.uuid().safeParse(paymentId).success) notFound();
  const db = await getCommerceDatabase();
  await expireReservations(db);
  const payment = await withOwner(db, { customerId: identity.id }, (tx) =>
    tx.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: true,
        refunds: {
          select: { id: true, amount: true, state: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    }),
  );
  if (!payment) notFound();
  const online = isOnline(payment.method);
  const canPay =
    online &&
    serverEnv.PAYFAST_ENABLED &&
    payment.state === 'AWAITING_PAYMENT' &&
    payment.order.status === 'PENDING' &&
    payment.order.expiresAt > new Date() &&
    !payment.exception;
  const form = canPay
    ? paymentRequest(payfastConfig(), {
        id: payment.id,
        amount: payment.expected.toFixed(2),
        method: payment.method,
      })
    : null;
  return (
    <main id="main-content" className="site-container py-12 sm:py-16">
      <div className="max-w-2xl">
        <p className="eyebrow">Local payment preview</p>
        <h1 className="mt-3 text-3xl font-bold">Payment status</h1>
        <p className="mt-5 rounded-xl bg-secondary p-5">
          Test order only. Do not send real money. Returning from Payfast does not confirm payment;
          a verified notification or reconciled receipt is required.
        </p>
        <dl className="mt-7 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="font-semibold">Method</dt>
            <dd>{paymentLabels[payment.method as PaymentMethod]}</dd>
          </div>
          <div>
            <dt className="font-semibold">Status</dt>
            <dd>{payment.state.replaceAll('_', ' ')}</dd>
          </div>
          <div>
            <dt className="font-semibold">Order amount</dt>
            <dd>{formatRand(payment.expected.toFixed(2))}</dd>
          </div>
          <div>
            <dt className="font-semibold">Verified received</dt>
            <dd>{formatRand(payment.received.toFixed(2))}</dd>
          </div>
          <div>
            <dt className="font-semibold">Completed refunds</dt>
            <dd>{formatRand(payment.refunded.toFixed(2))}</dd>
          </div>
        </dl>
        {payment.exception && (
          <p className="mt-5 rounded-xl border p-5">
            Payment needs review. Do not pay again or travel to collect until the store confirms the
            next step. Any money received is recorded separately from fulfilment.
          </p>
        )}
        {form && (
          <form action={form.url} method="post" className="mt-6">
            {Object.entries(form.fields).map(([name, value]) => (
              <input type="hidden" key={name} name={name} value={value} />
            ))}
            <Button type="submit">Continue to Payfast sandbox</Button>
            <p className="mt-3 text-sm">
              Sandbox uses a test wallet. Card and Instant EFT bank journeys require separate
              approved live verification.
            </p>
          </form>
        )}
        {online && !serverEnv.PAYFAST_ENABLED && (
          <p className="mt-5">Payfast sandbox is not configured yet.</p>
        )}
        {payment.method === 'MANUAL_EFT' && (
          <section className="mt-6 rounded-xl border p-5">
            <h2 className="font-semibold">Manual EFT instructions</h2>
            {serverEnv.MANUAL_EFT_ENABLED &&
            payment.state === 'UNPAID' &&
            payment.order.status === 'PENDING' &&
            payment.order.expiresAt > new Date() &&
            !payment.exception ? (
              <>
                <p className="mt-3">
                  Bank: {serverEnv.MANUAL_EFT_BANK_NAME}
                  <br />
                  Account holder: {serverEnv.MANUAL_EFT_ACCOUNT_NAME}
                  <br />
                  Account: {serverEnv.MANUAL_EFT_ACCOUNT_NUMBER}
                  <br />
                  Branch: {serverEnv.MANUAL_EFT_BRANCH_CODE}
                </p>
                <p className="mt-3 break-all">Reference: {payment.id}</p>
                <p className="mt-3">
                  A proof-of-payment upload is not confirmation. The administrator must verify
                  cleared funds. This is a test order: do not transfer money.
                </p>
              </>
            ) : (
              <p className="mt-3">
                Transfer instructions are unavailable for this payment. Do not make a transfer;
                contact the store if you need help reconciling an existing receipt.
              </p>
            )}
          </section>
        )}
        {!online && payment.method !== 'MANUAL_EFT' && payment.state === 'UNPAID' && (
          <p className="mt-5">
            {payment.method === 'COD'
              ? 'Cash is recorded only after receipt at delivery.'
              : 'Payment is recorded only after receipt at collection.'}{' '}
            This test allocation remains unpaid until an administrator records a verified receipt or
            cancels it.
          </p>
        )}
        {(online || payment.method === 'MANUAL_EFT') && (
          <p className="mt-5">
            Unpaid reservation deadline:{' '}
            {payment.order.expiresAt.toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })}{' '}
            SAST. An expired order must be reviewed before fulfilment, even if payment arrives
            later.
          </p>
        )}
        {payment.refunds.length > 0 && (
          <section className="mt-7">
            <h2 className="text-xl font-semibold">Refund progress</h2>
            {payment.refunds.map((refund) => (
              <p key={refund.id} className="mt-3">
                {formatRand(refund.amount.toFixed(2))} ·{' '}
                {refund.state === 'REQUESTED'
                  ? 'Requested — not yet completed'
                  : refund.state.toLowerCase()}
              </p>
            ))}
          </section>
        )}
        <div className="mt-8 flex flex-wrap gap-5">
          <a className="underline" href={`/payments/${payment.id}/status`}>
            Refresh payment status
          </a>
          <Link className="underline" href={`/account/orders/${payment.orderId}`}>
            View order
          </Link>
        </div>
      </div>
    </main>
  );
}
