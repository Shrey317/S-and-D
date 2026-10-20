import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isAdministrator } from '@/server/auth/identity';
import { getPaymentDatabase } from '@/server/db/payment-client';
import { serverEnv } from '@/config/env.server';
import { formatRand } from '@/features/catalog/money';
import { paymentLabels, type PaymentMethod } from '@/features/payments/methods';
export const dynamic = 'force-dynamic';
export default async function PaymentsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  if (!(await isAdministrator())) notFound();
  const raw = (await searchParams).page,
    page = /^[1-9]\d{0,3}$/.test(raw || '') ? Number(raw) : 1;
  const rows = serverEnv.PAYMENTS_ENABLED
    ? await (
        await getPaymentDatabase()
      ).payment.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 20,
        skip: (page - 1) * 20,
      })
    : [];
  return (
    <main id="main-content" className="site-container py-12">
      <p className="eyebrow">Administrator · local preview</p>
      <h1 className="mt-3 text-3xl font-bold">Payments and reconciliation</h1>
      <p className="mt-4">
        Record only verified receipts and externally completed refunds. This local environment
        contains test orders; never transfer real money.
      </p>
      <div className="mt-8 grid gap-4">
        {rows.map((payment) => (
          <article key={payment.id} className="rounded-xl border p-5">
            <h2 className="break-all font-semibold">
              <Link href={`/admin/payments/${payment.id}`}>Payment {payment.id}</Link>
            </h2>
            <p className="mt-3">
              {paymentLabels[payment.method as PaymentMethod]} · {payment.state} ·{' '}
              {formatRand(payment.expected.toFixed(2))}
            </p>
            {payment.exception && (
              <p className="mt-2 font-semibold">
                Needs review: {payment.exception.replaceAll('_', ' ')}
              </p>
            )}
          </article>
        ))}
      </div>
      {!rows.length && <p className="mt-8">No payments on this page.</p>}
      <nav className="mt-8 flex gap-5" aria-label="Payment pages">
        {page > 1 && <Link href={`/admin/payments?page=${page - 1}`}>Previous page</Link>}
        {rows.length === 20 && <Link href={`/admin/payments?page=${page + 1}`}>Next page</Link>}
      </nav>
    </main>
  );
}
