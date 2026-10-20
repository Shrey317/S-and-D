import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { requireIdentity } from '@/server/auth/identity';
import { currentBasket } from '@/server/checkout/service';
import { getAccountDatabase } from '@/server/db/account-client';
import { readAccount } from '@/server/account/repository';
import { serverEnv } from '@/config/env.server';
import { CheckoutForm } from '@/components/storefront/checkout-form';
import { formatRand } from '@/features/catalog/money';
import { enabledPaymentMethods } from '@/server/payments/config';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Checkout' };
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ promotion?: string }>;
}) {
  const identity = await requireIdentity('/checkout');
  const code = (await searchParams).promotion?.trim().toUpperCase() || '';
  const basket = await currentBasket(/^[A-Z0-9_-]{0,40}$/.test(code) ? code : 'INVALID-CODE');
  const account = await readAccount(await getAccountDatabase(), identity.id);
  const valid = Boolean(
    basket?.lines.length && basket.lines.every((line) => line.quantity <= line.available),
  );
  return (
    <main id="main-content" className="site-container py-12 sm:py-16">
      <p className="eyebrow">Local ordering preview</p>
      <h1 className="mt-3 text-4xl font-bold">Checkout</h1>
      {!basket?.lines.length ? (
        <p className="mt-8">
          Your basket is empty.{' '}
          <Link href="/shop" className="underline">
            Continue shopping
          </Link>
        </p>
      ) : (
        <div className="mt-10 grid items-start gap-10 lg:grid-cols-[1fr_360px]">
          <aside className="grid gap-4 rounded-2xl border p-6 lg:order-last">
            <h2 className="text-xl font-semibold">Review your order</h2>
            {basket.lines.map((line) => (
              <p key={line.variantId}>
                {line.quantity} × {line.name} · {line.label}
                <br />
                {formatRand(line.total)}
              </p>
            ))}
            <hr />
            <p>Subtotal: {formatRand(basket.subtotal)}</p>
            <p>
              Discount: {formatRand(basket.discount)}{' '}
              {basket.promotion && `· ${basket.promotion.name}`}
            </p>
            <p>Delivery / collection: Free</p>
            <form action="/checkout" className="grid gap-3">
              <label>
                Promotion code
                <input
                  name="promotion"
                  defaultValue={code}
                  maxLength={40}
                  className="mt-2 min-h-12 w-full rounded-lg border bg-card px-3"
                />
              </label>
              <button className="min-h-11 rounded-lg border px-4" type="submit">
                Apply code
              </button>
              {code && (
                <Link href="/checkout" className="underline">
                  Remove code
                </Link>
              )}
            </form>
            {basket.promotionError && <p role="alert">{basket.promotionError}</p>}
            <p className="text-xl font-bold">Total: {formatRand(basket.total)}</p>
            <p>No VAT charged.</p>
            <p className="text-sm">
              Provisional planning date: {basket.planningDate}. This is not a confirmed collection
              or delivery promise.{' '}
              {basket.settings.sameDayEnabled
                ? 'Same-day planning remains subject to store confirmation.'
                : 'Same-day fulfilment is not offered.'}
            </p>
            <p className="text-sm">
              Ordering cutoff: {basket.settings.cutoff}, Johannesburg time. After cutoff, planning
              starts one day later. Store hours and readiness confirmation are separate.
            </p>
            {!valid && <p role="alert">Stock has changed. Adjust your basket before continuing.</p>}
            <Link href="/cart" className="underline">
              Edit basket
            </Link>
          </aside>
          <CheckoutForm
            paymentMethods={enabledPaymentMethods()}
            checkoutKey={randomUUID()}
            quote={basket.quote}
            promotionCode={basket.promotionCode}
            name={account.profile.name}
            phone={account.profile.phone}
            addresses={account.addresses.map(({ id, label, street }) => ({ id, label, street }))}
            enabled={serverEnv.LOCAL_CHECKOUT_ENABLED && valid && !basket.promotionError}
          />
        </div>
      )}
    </main>
  );
}
